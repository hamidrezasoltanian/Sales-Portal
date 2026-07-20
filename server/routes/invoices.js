'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { loadCenterAccessContext } = require('../lib/center-access');
const { resolveCenterOwner } = require('../lib/center-ownership');

const router = express.Router();

function uid() { return 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function payUid() { return 'pmt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function isManager(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}
function canIssueInvoice(role) {
  return isManager(role) || role === 'مالی';
}

function attributionSql(alias) {
  const a = alias || 'i';
  return `COALESCE(NULLIF(TRIM(${a}.commission_owner), ''), ${a}.created_by)`;
}

async function nextInvoiceNo(jalaliDate) {
  const year = (jalaliDate || '').split('/')[0] || String(new Date().getFullYear());
  const r = await query(
    `SELECT MAX(CAST(SUBSTRING(invoice_no FROM '\\d+$') AS INTEGER)) AS max_seq
     FROM invoices WHERE invoice_no LIKE $1`,
    [`INV-${year}-%`]
  );
  let nextSeq = 1;
  if (r.rows.length > 0 && r.rows[0].max_seq !== null) {
    nextSeq = parseInt(r.rows[0].max_seq, 10) + 1;
  }
  return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Freeze sales beneficiary at invoice issue time:
 * center owner NOW → else proforma sales_owner → else proforma created_by.
 */
async function resolveCommissionOwnerSnapshot(pf) {
  let owner = null;
  if (pf.center_key) {
    try {
      const ctx = await loadCenterAccessContext({});
      owner = resolveCenterOwner(pf.center_key, ctx.edits, ctx.ownerMaps);
    } catch (e) {
      console.warn('[invoices] center owner resolve:', e.message);
    }
  }
  if (!owner) {
    owner = (pf.sales_owner && String(pf.sales_owner).trim()) || pf.created_by || null;
  }
  let name = owner || '';
  if (owner) {
    const ur = await query(
      'SELECT display_name FROM app_users WHERE username = $1 LIMIT 1',
      [owner]
    ).catch(function () { return { rows: [] }; });
    if (ur.rows.length && ur.rows[0].display_name) name = ur.rows[0].display_name;
  }
  return { owner: owner || null, name: name || null };
}

// GET /api/invoices
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, month, from, to, employee } = req.query;
    const conds = [], params = [];

    if (status) { conds.push(`i.status = $${params.length + 1}`); params.push(status); }
    if (month && !from && !to)  { conds.push(`i.jalali_date LIKE $${params.length + 1}`); params.push(month + '%'); }
    if (from)   { conds.push(`i.jalali_date >= $${params.length + 1}`); params.push(from); }
    if (to)     { conds.push(`i.jalali_date <= $${params.length + 1}`); params.push(to); }
    if (employee && isManager(req.user.role)) {
      conds.push(`${attributionSql('i')} = $${params.length + 1}`); params.push(employee);
    } else if (!isManager(req.user.role)) {
      conds.push(`${attributionSql('i')} = $${params.length + 1}`); params.push(req.user.username);
    }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(
      `SELECT i.*,
        COALESCE(SUM(p.amount), 0) AS paid_amount,
        COUNT(p.id) AS payment_count
       FROM invoices i
       LEFT JOIN invoice_payments p ON p.invoice_id = i.id
       ${where}
       GROUP BY i.id
       ORDER BY i.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(r.rows);
  } catch (e) {
    console.error('[invoices GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/invoices/from-proforma/:id — convert approved proforma to invoice
router.post('/from-proforma/:id', requireAuth, async (req, res) => {
  try {
    if (!canIssueInvoice(req.user.role)) {
      return res.status(403).json({ error: 'فقط واحد مالی یا مدیر می‌تواند فاکتور صادر کند' });
    }

    // Check if invoice already exists for this proforma
    const existing = await query(
      'SELECT id, invoice_no, commission_owner, commission_owner_name FROM invoices WHERE proforma_id = $1',
      [req.params.id]
    );
    if (existing.rows.length) {
      await query(
        `UPDATE proformas SET status = 'invoiced', updated_at = NOW()
         WHERE id = $1 AND status = 'approved'`,
        [req.params.id]
      );
      return res.json({ already: true, invoice: existing.rows[0] });
    }

    // Load proforma
    const pfRes = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!pfRes.rows.length) return res.status(404).json({ error: 'پیش‌فاکتور یافت نشد' });
    const pf = pfRes.rows[0];
    if (pf.status !== 'approved') return res.status(400).json({ error: 'فقط پیش‌فاکتورهای تأیید شده قابل تبدیل هستند' });

    const { jalali_date: pfDate } = req.body;
    const jalaliDate = pfDate || pf.jalali_date || '';
    const invoiceNo = await nextInvoiceNo(jalaliDate);
    const id = uid();

    const items = pf.items || [];
    const subtotal = parseFloat(pf.subtotal) || 0;
    const discAmt  = parseFloat(pf.disc_amt) || 0;
    const taxPct   = parseFloat(pf.tax_pct) || parseFloat(req.body.tax_pct) || 9;
    const taxAmt   = parseFloat(pf.tax_amt) || Math.round((subtotal - discAmt) * taxPct / 100);
    const total    = parseFloat(pf.total) || (subtotal - discAmt + taxAmt);

    const snap = await resolveCommissionOwnerSnapshot(pf);

    const r = await query(
      `INSERT INTO invoices (
         id, invoice_no, proforma_id, jalali_date, center_key, center_name,
         items, subtotal, tax_pct, tax_amt, total, status, created_by,
         commission_owner, commission_owner_name
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'issued',$12,$13,$14) RETURNING *`,
      [id, invoiceNo, pf.id, jalaliDate, pf.center_key, pf.center_name,
       JSON.stringify(items), subtotal, taxPct, taxAmt, total, req.user.username,
       snap.owner, snap.name]
    );
    await query(
      `UPDATE proformas SET status = 'invoiced', updated_at = NOW() WHERE id = $1`,
      [pf.id]
    ).catch(function () {});

    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('[invoices from-proforma]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'فاکتور یافت نشد' });
    const inv = r.rows[0];

    const attributed = (inv.commission_owner && String(inv.commission_owner).trim()) || inv.created_by;
    if (!isManager(req.user.role) && attributed !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    const payments = await query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY created_at',
      [req.params.id]
    );
    inv.payments = payments.rows;
    inv.paid_amount = payments.rows.reduce((s, p) => s + parseFloat(p.amount), 0);
    res.json(inv);
  } catch (e) {
    console.error('[invoices/:id GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/invoices/:id — update status or notes
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { status, notes } = req.body;
    const valid = ['issued', 'partial', 'paid', 'cancelled'];
    if (status && !valid.includes(status)) return res.status(400).json({ error: 'وضعیت نامعتبر' });

    const r = await query(
      `UPDATE invoices SET
         status = COALESCE($2, status),
         notes  = COALESCE($3, notes)
       WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, notes || null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'فاکتور یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[invoices PUT]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/invoices/:id/payment — register payment
router.post('/:id/payment', requireAuth, async (req, res) => {
  try {
    const { amount, method, ref_no, jalali_date, notes } = req.body;
    if (!amount || !jalali_date) return res.status(400).json({ error: 'مبلغ و تاریخ الزامی است' });

    const invRes = await query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!invRes.rows.length) return res.status(404).json({ error: 'فاکتور یافت نشد' });

    const id = payUid();
    await query(
      `INSERT INTO invoice_payments (id, invoice_id, amount, method, ref_no, jalali_date, registered_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.params.id, parseFloat(amount), method || 'transfer', ref_no || null, jalali_date, req.user.username, notes || null]
    );

    // Update invoice status based on paid amount
    const paid = await query(
      'SELECT COALESCE(SUM(amount),0) AS total FROM invoice_payments WHERE invoice_id = $1',
      [req.params.id]
    );
    const paidTotal = parseFloat(paid.rows[0].total);
    const invTotal = parseFloat(invRes.rows[0].total);
    const newStatus = paidTotal >= invTotal ? 'paid' : 'partial';
    await query('UPDATE invoices SET status=$2 WHERE id=$1', [req.params.id, newStatus]);

    res.status(201).json({ ok: true, paid_amount: paidTotal, status: newStatus });
  } catch (e) {
    console.error('[invoices/payment POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

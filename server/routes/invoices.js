'use strict';

const express = require('express');
const { pool, query } = require('../db');
const { requireAuth } = require('../auth');
const { loadCenterAccessContext } = require('../lib/center-access');
const { resolveCenterOwner } = require('../lib/center-ownership');

const router = express.Router();

function uid() { return 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function payUid() { return 'pmt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function lineUid() { return 'invi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function receiptUid() { return 'pod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
  // Retired after introducing sales orders. Keeping this route avoids a 404 for
  // older clients, but it can never create an invoice outside the controlled flow.
  return res.status(410).json({
    error: 'صدور مستقیم فاکتور از پیش‌فاکتور متوقف شده است؛ مسیر الزامی: سفارش فروش ← حواله رزرو شده ← فاکتور',
  });
  /* istanbul ignore next: legacy implementation retained temporarily for rollback */
  try {
    // Do not let the legacy endpoint bypass the new stock-controlled flow.
    const linkedOrder = await query(
      "SELECT id FROM sales_orders WHERE proforma_id=$1 AND status <> 'cancelled'",
      [req.params.id]
    ).catch(function () { return { rows: [] }; });
    if (linkedOrder.rows.length) {
      return res.status(409).json({
        error: 'ابتدا حواله سفارش فروش را ثبت کنید؛ فاکتور فقط از حواله رزرو‌شده صادر می‌شود',
        salesOrderId: linkedOrder.rows[0].id,
      });
    }
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

// POST /api/invoices/from-dispatches — the only fulfillment path for new sales orders.
// Reserved lots become approved exits atomically with invoice creation.
router.post('/from-dispatches', requireAuth, async (req, res) => {
  if (!canIssueInvoice(req.user.role)) return res.status(403).json({ error: 'فقط مالی یا مدیر می‌تواند فاکتور صادر کند' });
  const client = await pool.connect();
  try {
    const b = req.body || {};
    if (!b.salesOrderId) return res.status(400).json({ error: 'salesOrderId الزامی است' });
    await client.query('BEGIN');
    const orderR = await client.query('SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE', [b.salesOrderId]);
    if (!orderR.rows.length) return res.status(404).json({ error: 'سفارش فروش یافت نشد' });
    const order = orderR.rows[0];
    if (order.status === 'cancelled') return res.status(400).json({ error: 'سفارش لغو شده است' });
    const dispatchR = await client.query(
      `SELECT t.*, oi.item_name, oi.unit_price, oi.qty_ordered, oi.qty_invoiced
       FROM wms_transactions t
       JOIN sales_order_items oi ON oi.id=t.sales_order_item_id
       WHERE t.sales_order_id=$1 AND t.status='reserved'
       ORDER BY t.created_at FOR UPDATE`, [order.id]
    );
    if (!dispatchR.rows.length) return res.status(400).json({ error: 'حواله رزرو شده‌ای برای فاکتور وجود ندارد' });
    const already = await client.query(`SELECT id,invoice_no FROM invoices WHERE sales_order_id=$1 AND status <> 'cancelled'`, [order.id]);
    if (already.rows.length && !b.allowAdditionalInvoice) return res.status(409).json({ error: 'برای این سفارش فاکتور فعال وجود دارد', invoice: already.rows[0] });
    const pfDate = await client.query('SELECT jalali_date FROM proformas WHERE id=$1', [order.proforma_id]);
    const jalaliDate = b.jalali_date || (pfDate.rows[0] && pfDate.rows[0].jalali_date) || '';
    const invoiceNo = await nextInvoiceNo(jalaliDate);
    const invoiceId = uid();
    const taxPct = Number(b.tax_pct == null ? 9 : b.tax_pct);
    let subtotal = 0;
    const items = [];
    for (const d of dispatchR.rows) {
      const lineTotal = Number(d.qty) * Number(d.unit_price || d.sale_price || 0);
      subtotal += lineTotal;
      items.push({ prodId: d.product_id, name: d.item_name, qty: Number(d.qty), unitPrice: Number(d.unit_price || d.sale_price || 0), lineTotal });
    }
    const taxAmt = Math.round(subtotal * taxPct / 100);
    const total = subtotal + taxAmt;
    const invoiceR = await client.query(
      `INSERT INTO invoices (id,invoice_no,proforma_id,sales_order_id,jalali_date,center_key,center_name,items,subtotal,tax_pct,tax_amt,total,status,wms_status,created_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'issued','awaiting_delivery',$13,$14) RETURNING *`,
      [invoiceId, invoiceNo, order.proforma_id, order.id, jalaliDate, order.center_key, order.center_name,
       JSON.stringify(items), subtotal, taxPct, taxAmt, total, req.user.username, b.notes || '']
    );
    for (const d of dispatchR.rows) {
      const lineId = lineUid();
      const lotR = await client.query('SELECT * FROM wms_lots WHERE id=$1 FOR UPDATE', [d.lot_id]);
      if (!lotR.rows.length || Number(lotR.rows[0].reserved_qty || 0) < Number(d.qty)) throw new Error('رزرو لات معتبر نیست');
      const lot = lotR.rows[0];
      const lineTotal = Number(d.qty) * Number(d.unit_price || d.sale_price || 0);
      await client.query(
        `INSERT INTO invoice_items (id,invoice_id,sales_order_item_id,product_id,description,qty,unit_price,tax_pct,line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [lineId, invoiceId, d.sales_order_item_id, d.product_id, d.item_name, Number(d.qty), Number(d.unit_price || d.sale_price || 0), taxPct, lineTotal]
      );
      await client.query(`INSERT INTO invoice_line_dispatches (id,invoice_id,invoice_item_id,sales_order_item_id,wms_transaction_id,lot_id,qty,lot_no_snapshot,expiry_snapshot,dispatched_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [uid('ild'), invoiceId, lineId, d.sales_order_item_id, d.id, d.lot_id, Number(d.qty), lot.lot_no || '', lot.expiry || null]
      );
      await client.query(`UPDATE wms_lots SET qty=qty-$1,reserved_qty=reserved_qty-$1 WHERE id=$2`, [Number(d.qty), d.lot_id]);
      await client.query(`UPDATE wms_transactions SET status='approved',invoice_id=$2 WHERE id=$1`, [d.id, invoiceId]);
      await client.query(`UPDATE sales_order_items SET qty_invoiced=qty_invoiced+$1 WHERE id=$2`, [Number(d.qty), d.sales_order_item_id]);
    }
    await client.query(`UPDATE sales_orders SET status='invoiced',updated_at=NOW() WHERE id=$1`, [order.id]);
    await client.query(`UPDATE proformas SET status='invoiced',updated_at=NOW() WHERE id=$1 AND status='approved'`, [order.proforma_id]).catch(function () {});
    await client.query(`UPDATE sales_work_items SET status='done',updated_at=NOW() WHERE id=$1`, [`sales_order:${order.id}:finance`]);
    await client.query(`INSERT INTO sales_work_items (id,source_type,source_id,queue,title,meta)
      VALUES ($1,'invoice',$2,'delivery',$3,$4::jsonb)
      ON CONFLICT (id) DO UPDATE SET status='open',updated_at=NOW()`,
      [`invoice:${invoiceId}:delivery`, invoiceId, `تحویل و دریافت رسید برای فاکتور ${invoiceNo}`, JSON.stringify({ invoiceNo, orderNo: order.order_no })]);
    await client.query('COMMIT');
    res.status(201).json(invoiceR.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    console.error('[invoices from-dispatches]', e.message);
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// Delivery is prohibited until invoice exists. A receipt activates receivables when payment is incomplete.
router.post('/:id/delivery-receipt', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    if (!b.receiver_name) return res.status(400).json({ error: 'نام تحویل‌گیرنده الزامی است' });
    await client.query('BEGIN');
    const invR = await client.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!invR.rows.length) return res.status(404).json({ error: 'فاکتور یافت نشد' });
    const inv = invR.rows[0];
    if (inv.status === 'cancelled') return res.status(400).json({ error: 'فاکتور لغو شده است' });
    const txns = await client.query(`SELECT * FROM wms_transactions WHERE invoice_id=$1 AND status='approved' FOR UPDATE`, [inv.id]);
    if (!txns.rows.length) return res.status(400).json({ error: 'فاکتور حواله خروج معتبر ندارد' });
    const existing = await client.query(`SELECT * FROM delivery_receipts WHERE invoice_id=$1 AND status='received'`, [inv.id]);
    if (existing.rows.length) { await client.query('COMMIT'); return res.json({ already: true, receipt: existing.rows[0] }); }
    const id = receiptUid(); const no = 'POD-' + Date.now().toString(36).toUpperCase();
    const receipt = await client.query(`INSERT INTO delivery_receipts (id,receipt_no,invoice_id,receiver_name,receiver_role,carrier,tracking_no,attachment_url,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [id,no,inv.id,b.receiver_name,b.receiver_role || '',b.carrier || '',b.tracking_no || '',b.attachment_url || '',req.user.username]);
    await client.query(`UPDATE wms_transactions SET status='delivered',delivered_at=NOW() WHERE invoice_id=$1 AND status='approved'`, [inv.id]);
    const paidR = await client.query(`SELECT COALESCE(SUM(amount),0) AS total FROM invoice_payments WHERE invoice_id=$1`, [inv.id]);
    const paid = Number(paidR.rows[0].total || 0), total = Number(inv.total || 0);
    const dueDate = b.due_date || '';
    const rStatus = paid >= total ? 'settled' : 'open';
    await client.query(`INSERT INTO receivables (id,invoice_id,center_key,total_amount,paid_amount,outstanding_amount,due_date,status,owner,opened_at,settled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),CASE WHEN $8='settled' THEN NOW() ELSE NULL END)
      ON CONFLICT (invoice_id) DO UPDATE SET paid_amount=EXCLUDED.paid_amount,outstanding_amount=EXCLUDED.outstanding_amount,due_date=EXCLUDED.due_date,status=EXCLUDED.status,opened_at=NOW(),updated_at=NOW()`,
      [uid('ar'), inv.id, inv.center_key, total, paid, Math.max(0,total-paid), dueDate, rStatus, b.owner || '']);
    await client.query(`UPDATE invoices SET status=$2,wms_status='delivered' WHERE id=$1`, [inv.id, paid >= total ? 'paid' : 'issued']);
    await client.query(`UPDATE sales_work_items SET status='done',updated_at=NOW() WHERE id=$1`, [`invoice:${inv.id}:delivery`]);
    if (paid < total) await client.query(`INSERT INTO sales_work_items (id,source_type,source_id,queue,title,meta)
      VALUES ($1,'receivable',$2,'collections',$3,$4::jsonb)
      ON CONFLICT (id) DO UPDATE SET status='open',updated_at=NOW()`,
      [`receivable:${inv.id}:collections`, inv.id, `پیگیری مطالبات فاکتور ${inv.invoice_no}`, JSON.stringify({ invoiceNo: inv.invoice_no, outstanding: total-paid, dueDate })]);
    await client.query('COMMIT'); res.status(201).json({ receipt: receipt.rows[0], receivableStatus: rStatus, outstanding: Math.max(0,total-paid) });
  } catch (e) { await client.query('ROLLBACK').catch(function () {}); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
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
    await query(
      `UPDATE receivables SET paid_amount=$2, outstanding_amount=GREATEST(0,total_amount-$2),
         status=CASE WHEN $2 >= total_amount THEN 'settled' WHEN $2 > 0 THEN 'partial' ELSE status END,
         settled_at=CASE WHEN $2 >= total_amount THEN NOW() ELSE settled_at END, updated_at=NOW()
       WHERE invoice_id=$1`,
      [req.params.id, paidTotal]
    ).catch(function () {});
    if (paidTotal >= invTotal) {
      await query(`UPDATE sales_work_items SET status='done',updated_at=NOW() WHERE id=$1`, [`receivable:${req.params.id}:collections`]).catch(function () {});
    }

    res.status(201).json({ ok: true, paid_amount: paidTotal, status: newStatus });
  } catch (e) {
    console.error('[invoices/payment POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

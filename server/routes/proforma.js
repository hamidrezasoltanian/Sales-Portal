'use strict';

const express    = require('express');
const { z }      = require('zod');
const { query }  = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('proforma', level)(req, res, next);
});

// ── Zod schemas ────────────────────────────────────────────────────────────
const ItemSchema = z.object({
  prodId:      z.string().default(''),
  catalogCode: z.string().default(''),
  name:        z.string().min(1, 'نام کالا الزامی است'),
  unit:        z.string().default('عدد'),
  qty:         z.coerce.number().min(1),
  unitPrice:   z.coerce.number().min(0),
  discPct:     z.coerce.number().min(0).max(100).default(0),
});

const CreateSchema = z.object({
  centerKey:      z.string().default(''),
  centerName:     z.string().default(''),
  items:          z.array(ItemSchema).min(1, 'حداقل یک ردیف لازم است'),
  note:           z.string().default(''),
  managerNote:    z.string().default(''),
  taxPct:         z.coerce.number().min(0).max(100).default(9),
  discountPct:    z.coerce.number().min(0).max(100).default(0),
  jalaliDate:     z.string().default(''),
  validDays:      z.coerce.number().min(1).max(365).default(30),
  buyerNatId:     z.string().default(''),
  buyerEcoCode:   z.string().default(''),
  buyerRegId:     z.string().default(''),
  buyerAddress:   z.string().default(''),
  buyerPhone:     z.string().default(''),
  buyerPostal:    z.string().default(''),
  hasCommission:  z.coerce.boolean().default(false),
  commissionAmt:  z.coerce.number().min(0).default(0),
  commissionNote: z.string().default(''),
});

const ActionSchema = z.object({
  action: z.enum(['send','approve','reject','cancel','reopen']),
  note:   z.string().default(''),
});

// ── Helper: validate with zod, return 400 on error ─────────────────────────
function validate(schema, data, res) {
  const r = schema.safeParse(data);
  if (!r.success) {
    res.status(400).json({ error: r.error.errors[0].message });
    return null;
  }
  return r.data;
}

// ── Helper: build row object from DB row ───────────────────────────────────
function rowToObj(r) {
  return {
    id:             r.id,
    no:             r.no,
    jalaliDate:     r.jalali_date,
    validDays:      r.valid_days,
    centerKey:      r.center_key,
    centerName:     r.center_name,
    items:          r.items,
    subtotal:       Number(r.subtotal),
    discountPct:    Number(r.discount_pct),
    discAmt:        Number(r.disc_amt),
    taxPct:         Number(r.tax_pct),
    taxAmt:         Number(r.tax_amt),
    total:          Number(r.total),
    note:           r.note,
    status:         r.status,
    createdBy:      r.created_by,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
    sentAt:         r.sent_at,
    respondedAt:    r.responded_at,
    respondedBy:    r.responded_by,
    managerNote:    r.manager_note,
    versions:       r.versions || [],
    hasCommission:  !!r.has_commission,
    commissionAmt:  Number(r.commission_amt || 0),
    commissionNote: r.commission_note || '',
    buyerNatId:     r.buyer_nat_id || '',
    buyerEcoCode:   r.buyer_eco_code || '',
    buyerRegId:     r.buyer_reg_id || '',
    buyerAddress:   r.buyer_address || '',
    buyerPhone:     r.buyer_phone || '',
    buyerPostal:    r.buyer_postal || '',
  };
}

// ── GET /api/proforma ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, center, owner, q } = req.query;
    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (center) { conditions.push(`center_key = $${idx++}`); params.push(center); }
    if (owner)  { conditions.push(`created_by = $${idx++}`); params.push(owner); }
    if (q)      { conditions.push(`(center_name ILIKE $${idx} OR items::text ILIKE $${idx})`); params.push('%' + q + '%'); idx++; }
    if (!isManager) { conditions.push(`created_by = $${idx++}`); params.push(req.user.username); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows  = await query(
      `SELECT * FROM proformas ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );
    res.json(rows.rows.map(rowToObj));
  } catch(e) {
    console.error('[proforma GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── POST /api/proforma — create ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const d = validate(CreateSchema, req.body, res);
    if (!d) return;

    // Auto-number PF-1404-0001 (use MAX to avoid duplicate key on delete)
    const year = (d.jalaliDate || '').split('/')[0] || String(new Date().getFullYear());
    const maxRes = await query(
      `SELECT MAX(CAST(SUBSTRING(no FROM '\\d+$') AS INTEGER)) as max_seq 
       FROM proformas 
       WHERE no LIKE $1`,
      [`PF-${year}-%`]
    );

    let nextSeq = 1;
    if (maxRes.rows.length > 0 && maxRes.rows[0].max_seq !== null) {
      nextSeq = parseInt(maxRes.rows[0].max_seq) + 1;
    }

    const seq = String(nextSeq).padStart(4, '0');
    const no = `PF-${year}-${seq}`;

    // Item-level discount calculation
    const itemsFull = d.items.map(function(i) {
      const base = i.qty * i.unitPrice;
      const disc = Math.round(base * (i.discPct || 0) / 100);
      return Object.assign({}, i, { lineTotal: base - disc });
    });

    const subtotal  = itemsFull.reduce(function(s, i){ return s + i.lineTotal; }, 0);
    const discAmt   = Math.round(subtotal * d.discountPct / 100);
    const taxAmt    = Math.round((subtotal - discAmt) * d.taxPct / 100);
    const total     = subtotal - discAmt + taxAmt;

    const id = 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const r = await query(
      `INSERT INTO proformas
         (id, no, jalali_date, valid_days, center_key, center_name, items,
          subtotal, discount_pct, disc_amt, tax_pct, tax_amt, total,
          note, manager_note, buyer_nat_id, buyer_eco_code, buyer_reg_id,
          buyer_address, buyer_phone, buyer_postal,
          has_commission, commission_amt, commission_note,
          status, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, 
          $8, $9, $10, $11, $12, $13, 
          $14, $15, $16, $17, $18, 
          $19, $20, $21, 
          $22, $23, $24, 
          'draft', $25, NOW(), NOW())
       RETURNING *`,
      [id, no, d.jalaliDate||null, d.validDays, d.centerKey, d.centerName,
       JSON.stringify(itemsFull), subtotal, d.discountPct, discAmt,
       d.taxPct, taxAmt, total, d.note, d.managerNote,
       d.buyerNatId, d.buyerEcoCode, d.buyerRegId, d.buyerAddress, d.buyerPhone, d.buyerPostal,
       d.hasCommission||false, d.commissionAmt||0, d.commissionNote||'',
       req.user.username]
    );
    res.status(201).json(rowToObj(r.rows[0]));
  } catch(e) {
    console.error('[proforma POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── GET /api/proforma/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    res.json(rowToObj(r.rows[0]));
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});

// ── GET /api/proforma/:id/versions ──────────────────────────────────
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT versions FROM proformas WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    res.json(r.rows[0].versions || []);
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});

// ── PUT /api/proforma/:id — update draft ────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const isSuperAdmin = req.session?.user?.role === 'سوپر ادمین';
    if (!['draft','approved'].includes(existing.rows[0].status) && !isSuperAdmin) {
      return res.status(400).json({ error: 'فقط پیش‌نویس یا تایید شده قابل ویرایش است (سوپر ادمین می‌تواند هر وضعیتی را ویرایش کند)' });
    }

    const d = validate(CreateSchema.partial(), req.body, res);
    if (!d) return;

    const pf = rowToObj(existing.rows[0]);

    // Snapshot current state before updating (version history)
    const snapshot = {
      at:       new Date().toISOString(),
      by:       pf.createdBy,
      items:    pf.items,
      total:    pf.total,
      subtotal: pf.subtotal,
      discAmt:  pf.discAmt,
      taxAmt:   pf.taxAmt,
      note:     pf.note,
    };

    // Recalculate item-level discounts
    const rawItems = d.items || pf.items;
    const items = rawItems.map(function(i) {
      const base = i.qty * i.unitPrice;
      const disc = Math.round(base * (i.discPct || 0) / 100);
      return Object.assign({}, i, { lineTotal: base - disc });
    });

    const taxPct    = d.taxPct      !== undefined ? d.taxPct      : pf.taxPct;
    const discPct   = d.discountPct !== undefined ? d.discountPct : pf.discountPct;
    const subtotal  = items.reduce(function(s, i){ return s + i.lineTotal; }, 0);
    const discAmt   = Math.round(subtotal * discPct / 100);
    const taxAmt    = Math.round((subtotal - discAmt) * taxPct / 100);
    const total     = subtotal - discAmt + taxAmt;

    const r = await query(
      `UPDATE proformas SET
         jalali_date=$1, valid_days=$2, center_key=$3, center_name=$4,
         items=$5, subtotal=$6, discount_pct=$7, disc_amt=$8,
         tax_pct=$9, tax_amt=$10, total=$11, note=$12, manager_note=$13,
         buyer_nat_id=$14, buyer_eco_code=$15, buyer_reg_id=$16, buyer_address=$17,
         buyer_phone=$18, buyer_postal=$19,
         has_commission=$20, commission_amt=$21, commission_note=$22,
         updated_at=NOW(),
         versions = versions || $23::jsonb
       WHERE id=$24 RETURNING *`,
      [d.jalaliDate||pf.jalaliDate, d.validDays||pf.validDays,
       d.centerKey||pf.centerKey, d.centerName||pf.centerName,
       JSON.stringify(items), subtotal, discPct, discAmt,
       taxPct, taxAmt, total, d.note!==undefined?d.note:pf.note,
       d.managerNote!==undefined?d.managerNote:pf.managerNote,
       d.buyerNatId!==undefined?d.buyerNatId:pf.buyerNatId,
       d.buyerEcoCode!==undefined?d.buyerEcoCode:pf.buyerEcoCode,
       d.buyerRegId!==undefined?d.buyerRegId:pf.buyerRegId,
       d.buyerAddress!==undefined?d.buyerAddress:pf.buyerAddress,
       d.buyerPhone!==undefined?d.buyerPhone:pf.buyerPhone,
       d.buyerPostal!==undefined?d.buyerPostal:pf.buyerPostal,
       d.hasCommission!==undefined?d.hasCommission:pf.hasCommission,
       d.commissionAmt!==undefined?d.commissionAmt:pf.commissionAmt,
       d.commissionNote!==undefined?d.commissionNote:pf.commissionNote,
       JSON.stringify([snapshot]),
       req.params.id]
    );
    res.json(rowToObj(r.rows[0]));
  } catch(e) {
    console.error('[proforma PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── POST /api/proforma/:id/action — workflow ────────────────────────────────
const TRANSITIONS = {
  draft:     ['send','cancel'],
  sent:      ['approve','reject','cancel'],
  approved:  ['cancel','reject'],
  rejected:  ['reopen'],
  cancelled: ['reopen'],
};

router.post('/:id/action', requireAuth, async (req, res) => {
  try {
    const d = validate(ActionSchema, req.body, res);
    if (!d) return;

    const existing = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const pf = existing.rows[0];

    const allowed = TRANSITIONS[pf.status] || [];
    if (!allowed.includes(d.action)) {
      return res.status(400).json({
        error: `عملیات '${d.action}' در وضعیت '${pf.status}' مجاز نیست`,
      });
    }

    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);

    let updateSQL = '';
    let params    = [];

    if (d.action === 'send') {
      updateSQL = `SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`;
      params    = [req.params.id];
    } else if (d.action === 'approve') {
      if (!isManager) return res.status(403).json({ error: 'فقط مدیر می‌تواند تأیید کند' });
      updateSQL = `SET status='approved', responded_at=NOW(), responded_by=$2, manager_note=$3, updated_at=NOW() WHERE id=$1`;
      params    = [req.params.id, req.user.username, d.note];
    } else if (d.action === 'reject') {
      if (!isManager) return res.status(403).json({ error: 'فقط مدیر می‌تواند رد کند' });
      updateSQL = `SET status='rejected', responded_at=NOW(), responded_by=$2, manager_note=$3, updated_at=NOW() WHERE id=$1`;
      params    = [req.params.id, req.user.username, d.note];
    } else if (d.action === 'cancel') {
      updateSQL = `SET status='cancelled', updated_at=NOW() WHERE id=$1`;
      params    = [req.params.id];
    } else if (d.action === 'reopen') {
      updateSQL = `SET status='draft', responded_at=NULL, responded_by=NULL, manager_note='', updated_at=NOW() WHERE id=$1`;
      params    = [req.params.id];
    }

    const r = await query(`UPDATE proformas ${updateSQL} RETURNING *`, params);
    const updated = rowToObj(r.rows[0]);
    res.json(updated);

    // Push Telegram notifications (non-blocking, only if enabled in settings)
    try {
      const settingsRow = await query("SELECT value FROM app_settings WHERE key = 'telegramNotify'");
      const notifyEnabled = !settingsRow.rows.length || settingsRow.rows[0].value !== false;
      if (!notifyEnabled) throw new Error('telegram notify disabled');
      const bot = require('../bot/telegram');
      if (d.action === 'send') {
        const msg = '📄 پیشفاکتور ' + updated.no + ' از ' + req.user.username +
          ' در انتظار تأیید است.\n💰 مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼\n👤 مشتری: ' + (updated.centerName || '—');
        bot.notifyManagers(msg).catch(function(){});
      } else if (d.action === 'approve' || d.action === 'reject') {
        const label = d.action === 'approve' ? '✅ تأیید شد' : '❌ رد شد';
        const msg   = '📄 پیشفاکتور ' + updated.no + ' ' + label + ' توسط ' + req.user.username +
          (d.note ? '\n📝 ' + d.note : '');
        bot.notifyAll(msg).catch(function(){});
      }
    } catch(e) {}
  } catch(e) {
    console.error('[proforma action]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── DELETE /api/proforma/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT status FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const isSuperAdmin = req.session?.user?.role === 'سوپر ادمین';
    const status = existing.rows[0].status;
    // Allow deletion of draft, cancelled, rejected, or approved statuses
    // Super admin can delete any status
    if (!isSuperAdmin && !['draft','cancelled','rejected','approved'].includes(status)) {
      return res.status(400).json({ error: 'فقط پیش‌نویس، لغو شده، رد شده یا تایید شده را می‌توان حذف کرد' });
    }
    await query('DELETE FROM proformas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});

module.exports = router;

'use strict';

const express    = require('express');
const multer     = require('multer');
const { z }      = require('zod');
const { query }  = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const { createDispatchFromProforma, getDispatchForProforma } = require('../lib/wms-dispatch');
const {
  computeExpiryDate, appendProformaEvent, appendAuditLog, runAutoExpire, LOSS_REASONS,
  buildProformaTimeline, parseAuditLog,
} = require('../lib/proforma-helpers');
const {
  loadDiscountCaps, exceedsDiscountCap, canApproveDiscount, maxDiscountPct, getDiscountCap,
} = require('../lib/pf-discount');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, function(err) {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'حجم فایل بیش از ۱۵ مگابایت است' });
    }
    if (err) return res.status(400).json({ error: 'خطا در آپلود فایل' });
    next();
  });
}

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
  unitCost:    z.coerce.number().min(0).default(0),
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
  wmsWarehouseId: z.string().default(''),
  channel:          z.string().default('direct'),
  currency:         z.string().default('IRR'),
  exchangeRate:     z.coerce.number().min(0).default(1),
  paymentTerms:     z.string().default(''),
  salesOwner:       z.string().default(''),
  supportOwner:     z.string().default(''),
  parentProformaId: z.string().default(''),
  expiryDate:       z.string().default(''),
});

const ActionSchema = z.object({
  action: z.enum(['send','approve','reject','cancel','reopen','negotiate','expire','approve_disc','reject_disc']),
  note:   z.string().default(''),
  lossReason:     z.string().default(''),
  lossCompetitor: z.string().default(''),
});

function isManagerRole(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}
function isSuperAdminRole(role) {
  return role === 'سوپر ادمین';
}
function isFinanceRole(role) {
  return role === 'مالی';
}
function canViewProforma(user, row) {
  if (isManagerRole(user.role)) return true;
  return row.created_by === user.username;
}
function canEditProforma(user, row) {
  if (isSuperAdminRole(user.role)) return true;
  if (row.status === 'draft') {
    return row.created_by === user.username || isManagerRole(user.role);
  }
  if (row.status === 'sent') {
    return row.created_by === user.username || isManagerRole(user.role);
  }
  if (row.status === 'approved') return isManagerRole(user.role);
  return false;
}

// ── Helper: validate with zod, return 400 on error ─────────────────────────

function pfExtendedFields(d, reqUser) {
  const jalali = d.jalaliDate || '';
  const validDays = d.validDays || 30;
  const expiry = d.expiryDate || computeExpiryDate(jalali, validDays) || null;
  return {
    expiry,
    channel: d.channel || 'direct',
    currency: d.currency || 'IRR',
    exchangeRate: d.exchangeRate != null ? d.exchangeRate : 1,
    paymentTerms: d.paymentTerms || '',
    salesOwner: d.salesOwner || '',
    supportOwner: d.supportOwner || '',
    parentProformaId: d.parentProformaId || null,
  };
}

function validate(schema, data, res) {
  const r = schema.safeParse(data);
  if (!r.success) {
    res.status(400).json({ error: r.error.errors[0].message });
    return null;
  }
  return r.data;
}

// ── Helper: full snapshot before edit (version history) ─────────────────────
function buildProformaSnapshot(pf, by) {
  return {
    at:              new Date().toISOString(),
    by:              by || '',
    jalaliDate:      pf.jalaliDate || '',
    validDays:       pf.validDays,
    centerKey:       pf.centerKey || '',
    centerName:      pf.centerName || '',
    items:           pf.items || [],
    subtotal:        pf.subtotal,
    discountPct:     pf.discountPct,
    discAmt:         pf.discAmt,
    taxPct:          pf.taxPct,
    taxAmt:          pf.taxAmt,
    total:           pf.total,
    note:            pf.note || '',
    managerNote:     pf.managerNote || '',
    status:          pf.status || '',
    buyerNatId:      pf.buyerNatId || '',
    buyerEcoCode:    pf.buyerEcoCode || '',
    buyerRegId:      pf.buyerRegId || '',
    buyerAddress:    pf.buyerAddress || '',
    buyerPhone:      pf.buyerPhone || '',
    buyerPostal:     pf.buyerPostal || '',
    hasCommission:   !!pf.hasCommission,
    commissionAmt:   pf.commissionAmt || 0,
    commissionNote:  pf.commissionNote || '',
    wmsWarehouseId:  pf.wmsWarehouseId || '',
    wmsDispatchIds:  pf.wmsDispatchIds || [],
    channel:         pf.channel || 'direct',
    currency:        pf.currency || 'IRR',
    exchangeRate:    pf.exchangeRate || 1,
    paymentTerms:    pf.paymentTerms || '',
    salesOwner:      pf.salesOwner || '',
    supportOwner:    pf.supportOwner || '',
    parentProformaId: pf.parentProformaId || '',
    expiryDate:      pf.expiryDate || '',
  };
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
    wmsDispatchIds: r.wms_dispatch_ids || [],
    wmsWarehouseId: r.wms_warehouse_id || '',
    expiryDate:     r.expiry_date || computeExpiryDate(r.jalali_date, r.valid_days) || '',
    channel:        r.channel || 'direct',
    currency:       r.currency || 'IRR',
    exchangeRate:   Number(r.exchange_rate || 1),
    paymentTerms:   r.payment_terms || '',
    lossReason:     r.loss_reason || '',
    lossCompetitor: r.loss_competitor || '',
    parentProformaId: r.parent_proforma_id || '',
    salesOwner:     r.sales_owner || '',
    supportOwner:   r.support_owner || '',
    auditLog:       r.audit_log || [],
    lastFollowupAt: r.last_followup_at || null,
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

// GET /api/proforma/stats — dashboard counts (before /:id)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);
    const params = [];
    let where = '';
    if (!isManager) { where = ' WHERE created_by = $1'; params.push(req.user.username); }
    const dateWhere = where
      ? where + " AND jalali_date IS NOT NULL AND jalali_date != ''"
      : " WHERE jalali_date IS NOT NULL AND jalali_date != ''";

    const [byStatus, byMonth, totals] = await Promise.all([
      query(`SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total),0) AS total_value FROM proformas${where} GROUP BY status`, params),
      query(`SELECT LEFT(jalali_date, 7) AS month, COUNT(*)::int AS cnt,
                    COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS approved_total
             FROM proformas${dateWhere}
             GROUP BY 1 ORDER BY month DESC LIMIT 12`, params),
      query(`SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status IN ('approved','invoiced'))::int AS approved,
                    COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS approved_value,
                    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) FILTER (WHERE status IN ('approved','invoiced'))::numeric, 1) AS avg_cycle_days
             FROM proformas${where}`, params),
    ]);

    const curMonth = (req.query.month || '').trim();
    let mom = null, yoy = null;
    if (curMonth) {
      const parts = curMonth.split('/');
      const prevM = parts.length >= 2 ? (function(){
        var y=+parts[0], m=+parts[1]; m--; if(m<1){m=12;y--;} return y+'/'+String(m).padStart(2,'0');
      })() : '';
      const prevY = parts.length >= 1 ? ((+parts[0]-1)+'/'+parts.slice(1).join('/')) : '';
      const [curR, prevMR, prevYR] = await Promise.all([
        query(`SELECT COUNT(*)::int AS cnt, COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS val FROM proformas WHERE LEFT(jalali_date,7)=$1`, [curMonth]),
        prevM ? query(`SELECT COUNT(*)::int AS cnt, COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS val FROM proformas WHERE LEFT(jalali_date,7)=$1`, [prevM]) : { rows:[{cnt:0,val:0}] },
        prevY ? query(`SELECT COUNT(*)::int AS cnt, COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS val FROM proformas WHERE LEFT(jalali_date,7)=$1`, [prevY]) : { rows:[{cnt:0,val:0}] },
      ]);
      const cv = Number(curR.rows[0].val)||0, pv = Number(prevMR.rows[0].val)||0, yv = Number(prevYR.rows[0].val)||0;
      mom = { month: curMonth, count: curR.rows[0].cnt, approvedValue: cv, prevMonth: prevM, prevValue: pv, pct: pv ? Math.round((cv-pv)/pv*1000)/10 : null };
      yoy = { month: curMonth, prevYearMonth: prevY, prevValue: yv, pct: yv ? Math.round((cv-yv)/yv*1000)/10 : null };
    }

    res.json({
      ok: true,
      byStatus: byStatus.rows.map(r => ({ status: r.status, count: r.cnt, totalValue: Number(r.total_value) })),
      byMonth: byMonth.rows.map(r => ({ month: r.month, count: r.cnt, approvedTotal: Number(r.approved_total) })),
      totals: totals.rows[0] || {},
      mom, yoy,
    });
  } catch (e) {
    console.error('[proforma stats]', e.message);
    res.status(500).json({ error: e.message });
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
          has_commission, commission_amt, commission_note, wms_warehouse_id,
          expiry_date, channel, currency, exchange_rate, payment_terms,
          sales_owner, support_owner, parent_proforma_id,
          status, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, 
          $8, $9, $10, $11, $12, $13, 
          $14, $15, $16, $17, $18, 
          $19, $20, $21, 
          $22, $23, $24, $25,
          $26, $27, $28, $29, $30,
          $31, $32, $33,
          'draft', $34, NOW(), NOW())
       RETURNING *`,
      (function(){
         var ext = pfExtendedFields(d, req.user.username);
         return [id, no, d.jalaliDate||null, d.validDays, d.centerKey, d.centerName,
       JSON.stringify(itemsFull), subtotal, d.discountPct, discAmt,
       d.taxPct, taxAmt, total, d.note, d.managerNote,
       d.buyerNatId, d.buyerEcoCode, d.buyerRegId, d.buyerAddress, d.buyerPhone, d.buyerPostal,
       d.hasCommission||false, d.commissionAmt||0, d.commissionNote||'',
       d.wmsWarehouseId || null,
       ext.expiry, ext.channel, ext.currency, ext.exchangeRate, ext.paymentTerms,
       ext.salesOwner, ext.supportOwner, ext.parentProformaId,
       req.user.username];
       })()
    );
    await appendProformaEvent(id, 'created', req.user.username, 'ایجاد ' + no, { centerKey: d.centerKey });
    res.status(201).json(rowToObj(r.rows[0]));
  } catch(e) {
    console.error('[proforma POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Proforma file attachments (routes before /:id) ───────────────────────────

router.get('/files/:fileId', requireAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const r = await query(
      `SELECT f.*, p.created_by FROM proforma_files f
       JOIN proformas p ON p.id = f.proforma_id WHERE f.id = $1`,
      [fileId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    const row = r.rows[0];
    if (!canViewProforma(req.user, { created_by: row.created_by })) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const dl = req.query.dl === '1';
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      (dl ? 'attachment' : 'inline') + '; filename*=UTF-8\'\'' + encodeURIComponent(row.filename)
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(row.data);
  } catch (e) {
    console.error('[proforma file GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/files/:fileId', requireAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const meta = await query(
      `SELECT f.id, f.uploaded_by, p.status, p.created_by FROM proforma_files f
       JOIN proformas p ON p.id = f.proforma_id WHERE f.id = $1`,
      [fileId]
    );
    if (!meta.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    const row = meta.rows[0];
    const isOwner = row.uploaded_by === req.user.username;
    const isMgr = isManagerRole(req.user.role);
    if (!isOwner && !isMgr) return res.status(403).json({ error: 'دسترسی ندارید' });
    if (!['draft', 'sent'].includes(row.status) && !isMgr) {
      return res.status(400).json({ error: 'فقط در وضعیت پیش‌نویس یا ارسال‌شده قابل حذف است' });
    }
    await query('DELETE FROM proforma_files WHERE id = $1', [fileId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[proforma file DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});



// GET /api/proforma/calendar — items for team calendar overlay
router.get('/calendar', requireAuth, async (req, res) => {
  try {
    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);
    const params = [];
    let where = " WHERE status IN ('sent','negotiating','approved','pending_disc') AND expiry_date IS NOT NULL AND expiry_date != ''";
    if (!isManager) { where += ' AND created_by = $1'; params.push(req.user.username); }
    const r = await query(
      `SELECT id, no, center_name, center_key, expiry_date, status, total,
              COALESCE(NULLIF(sales_owner,''), created_by) AS owner
       FROM proformas ${where} ORDER BY expiry_date LIMIT 300`,
      params
    );
    res.json(r.rows.map(x => ({
      id: x.id, no: x.no, centerName: x.center_name, centerKey: x.center_key,
      expiryDate: x.expiry_date, status: x.status, total: Number(x.total), owner: x.owner,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proforma/workload — open PF count per expert (manager)
router.get('/workload', requireAuth, async (req, res) => {
  try {
    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);
    if (!isManager) return res.status(403).json({ error: 'فقط مدیر' });
    const r = await query(`
      SELECT COALESCE(NULLIF(sales_owner,''), created_by) AS expert,
             COUNT(*)::int AS open_count,
             COALESCE(SUM(total),0) AS open_value,
             COUNT(*) FILTER (WHERE status IN ('sent','negotiating'))::int AS pending_count
      FROM proformas
      WHERE status IN ('sent','negotiating','approved')
      GROUP BY 1 ORDER BY open_count DESC
    `);
    res.json({ ok: true, rows: r.rows.map(x => ({
      expert: x.expert,
      openCount: x.open_count,
      openValue: Number(x.open_value),
      pendingCount: x.pending_count,
    })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proforma/reports/summary
router.get('/reports/summary', requireAuth, async (req, res) => {
  try {
    const isManager = ['مدیر', 'سوپر ادمین'].includes(req.user.role);
    const params = [];
    let where = '';
    if (!isManager) { where = ' WHERE created_by = $1'; params.push(req.user.username); }
    const [byExpert, byStatus, lossReasons] = await Promise.all([
      query(`SELECT COALESCE(NULLIF(sales_owner,''), created_by) AS expert,
                    COUNT(*)::int AS cnt,
                    COALESCE(SUM(total),0) AS total_val,
                    COUNT(*) FILTER (WHERE status IN ('approved','invoiced'))::int AS won,
                    COUNT(*) FILTER (WHERE status = 'rejected')::int AS lost
             FROM proformas${where} GROUP BY 1 ORDER BY total_val DESC`, params),
      query(`SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total),0) AS total_val FROM proformas${where} GROUP BY status`, params),
      query(`SELECT loss_reason, COUNT(*)::int AS cnt FROM proformas WHERE loss_reason IS NOT NULL AND loss_reason != '' GROUP BY loss_reason ORDER BY cnt DESC`),
    ]);
    res.json({
      ok: true,
      byExpert: byExpert.rows,
      byStatus: byStatus.rows,
      lossReasons: lossReasons.rows,
      lossReasonLabels: LOSS_REASONS,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proforma/expire-check — manual trigger
router.post('/expire-check', requireAuth, async (req, res) => {
  try {
    if (!['مدیر', 'سوپر ادمین'].includes(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const n = await runAutoExpire();
    res.json({ ok: true, expired: n });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proforma/:id/timeline — must stay before bare GET /:id
router.get('/:id/timeline', requireAuth, async (req, res) => {
  try {
    const pf = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!pf.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, pf.rows[0])) return res.status(403).json({ error: 'دسترسی ندارید' });
    const row = pf.rows[0];
    let dbEvents = [];
    try {
      const events = await query(
        'SELECT * FROM proforma_events WHERE proforma_id = $1 ORDER BY event_at DESC LIMIT 100',
        [req.params.id]
      );
      dbEvents = events.rows || [];
    } catch (evErr) {
      console.warn('[proforma timeline] proforma_events:', evErr.message);
    }
    const timeline = buildProformaTimeline(row, dbEvents);
    res.json({
      ok: true,
      proformaId: req.params.id,
      no: row.no,
      timeline,
      auditLog: parseAuditLog(row.audit_log),
      events: dbEvents.map(e => ({
        id: e.id, type: e.event_type, at: e.event_at, actor: e.actor, note: e.note, meta: e.meta || {},
      })),
    });
  } catch (e) {
    console.error('[proforma timeline]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proforma/:id/followup — record follow-up activity
router.post('/:id/followup', requireAuth, async (req, res) => {
  try {
    const pf = await query('SELECT created_by, status FROM proformas WHERE id = $1', [req.params.id]);
    if (!pf.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, pf.rows[0])) return res.status(403).json({ error: 'دسترسی ندارید' });
    const body = req.body || {};
    const note = body.note || '';
    const ftype = body.type || 'followup';
    const meta = Object.assign({}, body);
    await appendProformaEvent(req.params.id, ftype, req.user.username, note, meta);
    await query('UPDATE proformas SET last_followup_at = NOW(), updated_at = NOW() WHERE id = $1', [req.params.id]);
    if (ftype === 'outcome_inactive' && body.lostReasonKey) {
      await query(
        'UPDATE proformas SET loss_reason = $2 WHERE id = $1 AND (loss_reason IS NULL OR loss_reason = \'\')',
        [req.params.id, body.lostReasonKey]
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/proforma/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, r.rows[0])) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(rowToObj(r.rows[0]));
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});


// ── GET /api/proforma/:id/versions ──────────────────────────────────
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT created_by, versions FROM proformas WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, r.rows[0])) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(r.rows[0].versions || []);
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});

router.get('/:id/files/list', requireAuth, async (req, res) => {
  try {
    const pf = await query('SELECT created_by FROM proformas WHERE id = $1', [req.params.id]);
    if (!pf.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, pf.rows[0])) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      `SELECT id, filename, mime_type, file_size, uploaded_by, created_at
       FROM proforma_files WHERE proforma_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ files: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/:id/files', requireAuth, handleUpload, async (req, res) => {
  try {
    const pf = await query('SELECT id, status, created_by FROM proformas WHERE id = $1', [req.params.id]);
    if (!pf.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const row = pf.rows[0];
    const isMgr = isManagerRole(req.user.role);
    const canUpload =
      (['draft', 'sent'].includes(row.status) &&
        (row.created_by === req.user.username || isMgr)) ||
      (row.status === 'approved' && isMgr);
    if (!canUpload) {
      return res.status(403).json({ error: 'در این وضعیت امکان افزودن پیوست نیست' });
    }
    if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشده' });
    const f = req.file;
    const allowed = /^(image\/|application\/pdf|application\/msword|application\/vnd\.|text\/plain)/;
    if (!allowed.test(f.mimetype || '')) {
      return res.status(400).json({ error: 'فرمت مجاز: تصویر، PDF، Word، Excel' });
    }
    const r = await query(
      `INSERT INTO proforma_files (proforma_id, filename, mime_type, file_size, data, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, filename, mime_type, file_size, uploaded_by, created_at`,
      [req.params.id, f.originalname, f.mimetype, f.size, f.buffer, req.user.username]
    );
    res.status(201).json({ ok: true, file: r.rows[0] });
  } catch (e) {
    console.error('[proforma file POST]', e.message);
    res.status(500).json({ error: 'خطای ذخیره فایل' });
  }
});

router.get('/:id/dispatch', requireAuth, async (req, res) => {
  try {
    const pf = await query('SELECT created_by FROM proformas WHERE id = $1', [req.params.id]);
    if (!pf.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    if (!canViewProforma(req.user, pf.rows[0])) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const transactions = await getDispatchForProforma(req.params.id);
    res.json({ transactions: transactions });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── POST /api/proforma/:id/restore — restore a saved version ────────────────
router.post('/:id/restore', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const row = existing.rows[0];
    const isSuperAdmin = isSuperAdminRole(req.user.role);
    if (!canEditProforma(req.user, row) && !isSuperAdmin) {
      return res.status(403).json({ error: 'دسترسی ویرایش ندارید' });
    }
    if (!['draft', 'approved', 'sent'].includes(row.status) && !isSuperAdmin) {
      return res.status(400).json({ error: 'فقط پیش‌نویس، ارسال‌شده یا تایید شده قابل ویرایش است' });
    }

    const versionIndex = parseInt(req.body?.versionIndex, 10);
    const versions = row.versions || [];
    if (isNaN(versionIndex) || versionIndex < 0 || versionIndex >= versions.length) {
      return res.status(400).json({ error: 'شماره نسخه نامعتبر است' });
    }
    const snap = versions[versionIndex];
    if (!snap) return res.status(404).json({ error: 'نسخه یافت نشد' });

    const pf = rowToObj(row);
    const snapshot = buildProformaSnapshot(pf, req.user.username);

    const items = (snap.items || []).map(function (i) {
      const base = (i.qty || 0) * (i.unitPrice || 0);
      const disc = Math.round(base * (i.discPct || 0) / 100);
      return Object.assign({}, i, { lineTotal: i.lineTotal != null ? i.lineTotal : (base - disc) });
    });
    const subtotal = snap.subtotal != null ? snap.subtotal : items.reduce(function (s, i) { return s + (i.lineTotal || 0); }, 0);
    const discPct = snap.discountPct != null ? snap.discountPct : Number(row.discount_pct);
    const discAmt = snap.discAmt != null ? snap.discAmt : Math.round(subtotal * discPct / 100);
    const taxPct = snap.taxPct != null ? snap.taxPct : Number(row.tax_pct);
    const taxAmt = snap.taxAmt != null ? snap.taxAmt : Math.round((subtotal - discAmt) * taxPct / 100);
    const total = snap.total != null ? snap.total : (subtotal - discAmt + taxAmt);

    const r = await query(
      `UPDATE proformas SET
         jalali_date=$1, valid_days=$2, center_key=$3, center_name=$4,
         items=$5, subtotal=$6, discount_pct=$7, disc_amt=$8,
         tax_pct=$9, tax_amt=$10, total=$11, note=$12, manager_note=$13,
         buyer_nat_id=$14, buyer_eco_code=$15, buyer_reg_id=$16, buyer_address=$17,
         buyer_phone=$18, buyer_postal=$19,
         has_commission=$20, commission_amt=$21, commission_note=$22,
         wms_warehouse_id=$23,
         expiry_date=$24, channel=$25, currency=$26, exchange_rate=$27, payment_terms=$28,
         sales_owner=$29, support_owner=$30, parent_proforma_id=$31,
         updated_at=NOW(),
         versions = versions || $32::jsonb
       WHERE id=$33 RETURNING *`,
      [
        snap.jalaliDate || row.jalali_date, snap.validDays || row.valid_days,
        snap.centerKey || row.center_key, snap.centerName || row.center_name,
        JSON.stringify(items), subtotal, discPct, discAmt,
        taxPct, taxAmt, total,
        snap.note != null ? snap.note : row.note,
        snap.managerNote != null ? snap.managerNote : row.manager_note,
        snap.buyerNatId != null ? snap.buyerNatId : (row.buyer_nat_id || ''),
        snap.buyerEcoCode != null ? snap.buyerEcoCode : (row.buyer_eco_code || ''),
        snap.buyerRegId != null ? snap.buyerRegId : (row.buyer_reg_id || ''),
        snap.buyerAddress != null ? snap.buyerAddress : (row.buyer_address || ''),
        snap.buyerPhone != null ? snap.buyerPhone : (row.buyer_phone || ''),
        snap.buyerPostal != null ? snap.buyerPostal : (row.buyer_postal || ''),
        snap.hasCommission != null ? !!snap.hasCommission : !!row.has_commission,
        snap.commissionAmt != null ? snap.commissionAmt : Number(row.commission_amt || 0),
        snap.commissionNote != null ? snap.commissionNote : (row.commission_note || ''),
        snap.wmsWarehouseId != null ? (snap.wmsWarehouseId || null) : (row.wms_warehouse_id || null),
        snap.expiryDate || row.expiry_date || null,
        snap.channel || row.channel || 'direct',
        snap.currency || row.currency || 'IRR',
        snap.exchangeRate != null ? snap.exchangeRate : (Number(row.exchange_rate) || 1),
        snap.paymentTerms != null ? snap.paymentTerms : (row.payment_terms || ''),
        snap.salesOwner || row.sales_owner || row.created_by,
        snap.supportOwner != null ? snap.supportOwner : (row.support_owner || ''),
        snap.parentProformaId || row.parent_proforma_id || null,
        JSON.stringify([snapshot]),
        req.params.id,
      ]
    );
    res.json(rowToObj(r.rows[0]));
  } catch (e) {
    console.error('[proforma restore]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── PUT /api/proforma/:id — update draft ────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const row = existing.rows[0];
    const isSuperAdmin = isSuperAdminRole(req.user.role);
    if (!canEditProforma(req.user, row) && !isSuperAdmin) {
      return res.status(403).json({ error: 'دسترسی ویرایش ندارید' });
    }
    if (!['draft','approved','sent'].includes(row.status) && !isSuperAdmin) {
      return res.status(400).json({ error: 'فقط پیش‌نویس، ارسال‌شده یا تایید شده قابل ویرایش است (سوپر ادمین می‌تواند هر وضعیتی را ویرایش کند)' });
    }

    const d = validate(CreateSchema.partial(), req.body, res);
    if (!d) return;

    const pf = rowToObj(row);

    // Snapshot full state before updating (version history)
    const snapshot = buildProformaSnapshot(pf, req.user.username);

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

    const ext = pfExtendedFields(Object.assign({}, pf, d), pf.salesOwner || pf.createdBy);
    if (d.expiryDate) ext.expiry = d.expiryDate;

    const r = await query(
      `UPDATE proformas SET
         jalali_date=$1, valid_days=$2, center_key=$3, center_name=$4,
         items=$5, subtotal=$6, discount_pct=$7, disc_amt=$8,
         tax_pct=$9, tax_amt=$10, total=$11, note=$12, manager_note=$13,
         buyer_nat_id=$14, buyer_eco_code=$15, buyer_reg_id=$16, buyer_address=$17,
         buyer_phone=$18, buyer_postal=$19,
         has_commission=$20, commission_amt=$21, commission_note=$22,
         wms_warehouse_id=$23,
         expiry_date=$24, channel=$25, currency=$26, exchange_rate=$27, payment_terms=$28,
         sales_owner=$29, support_owner=$30, parent_proforma_id=$31,
         updated_at=NOW(),
         versions = versions || $32::jsonb
       WHERE id=$33 RETURNING *`,
      [
        d.jalaliDate || pf.jalaliDate, d.validDays || pf.validDays,
        d.centerKey || pf.centerKey, d.centerName || pf.centerName,
        JSON.stringify(items), subtotal, discPct, discAmt,
        taxPct, taxAmt, total, d.note !== undefined ? d.note : pf.note,
        d.managerNote !== undefined ? d.managerNote : pf.managerNote,
        d.buyerNatId !== undefined ? d.buyerNatId : pf.buyerNatId,
        d.buyerEcoCode !== undefined ? d.buyerEcoCode : pf.buyerEcoCode,
        d.buyerRegId !== undefined ? d.buyerRegId : pf.buyerRegId,
        d.buyerAddress !== undefined ? d.buyerAddress : pf.buyerAddress,
        d.buyerPhone !== undefined ? d.buyerPhone : pf.buyerPhone,
        d.buyerPostal !== undefined ? d.buyerPostal : pf.buyerPostal,
        d.hasCommission !== undefined ? d.hasCommission : pf.hasCommission,
        d.commissionAmt !== undefined ? d.commissionAmt : pf.commissionAmt,
        d.commissionNote !== undefined ? d.commissionNote : pf.commissionNote,
        d.wmsWarehouseId !== undefined ? (d.wmsWarehouseId || null) : (pf.wmsWarehouseId || null),
        ext.expiry,
        d.channel || pf.channel || 'direct',
        d.currency || pf.currency || 'IRR',
        d.exchangeRate != null ? d.exchangeRate : (pf.exchangeRate || 1),
        d.paymentTerms != null ? d.paymentTerms : (pf.paymentTerms || ''),
        d.salesOwner || pf.salesOwner || pf.createdBy,
        d.supportOwner != null ? d.supportOwner : (pf.supportOwner || ''),
        d.parentProformaId || pf.parentProformaId || null,
        JSON.stringify([snapshot]),
        req.params.id,
      ]
    );
    res.json(rowToObj(r.rows[0]));
  } catch(e) {
    console.error('[proforma PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});


// POST /api/proforma/:id/revise — new draft version linked to parent
router.post('/:id/revise', requireAuth, async (req, res) => {
  try {
    const src = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!src.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const row = src.rows[0];
    if (!canViewProforma(req.user, row)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const pf = rowToObj(row);
    const year = (pf.jalaliDate || '').split('/')[0] || String(new Date().getFullYear());
    const maxRes = await query(
      `SELECT MAX(CAST(SUBSTRING(no FROM '\\d+$') AS INTEGER)) as max_seq FROM proformas WHERE no LIKE $1`,
      [`PF-${year}-%`]
    );
    let nextSeq = 1;
    if (maxRes.rows.length && maxRes.rows[0].max_seq != null) nextSeq = parseInt(maxRes.rows[0].max_seq) + 1;
    const no = `PF-${year}-${String(nextSeq).padStart(4, '0')}`;
    const id = 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ext = pfExtendedFields({ jalaliDate: pf.jalaliDate, validDays: pf.validDays, channel: pf.channel, currency: pf.currency, exchangeRate: pf.exchangeRate, paymentTerms: pf.paymentTerms, salesOwner: pf.salesOwner, supportOwner: pf.supportOwner, parentProformaId: pf.id }, req.user.username);
    const r = await query(
      `INSERT INTO proformas (id, no, jalali_date, valid_days, center_key, center_name, items, subtotal, discount_pct, disc_amt, tax_pct, tax_amt, total, note, manager_note, buyer_nat_id, buyer_eco_code, buyer_reg_id, buyer_address, buyer_phone, buyer_postal, has_commission, commission_amt, commission_note, wms_warehouse_id, expiry_date, channel, currency, exchange_rate, payment_terms, sales_owner, support_owner, parent_proforma_id, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,'draft',$34,NOW(),NOW()) RETURNING *`,
      [id, no, pf.jalaliDate, pf.validDays, pf.centerKey, pf.centerName, JSON.stringify(pf.items||[]), pf.subtotal, pf.discountPct, pf.discAmt, pf.taxPct, pf.taxAmt, pf.total, pf.note, '', pf.buyerNatId, pf.buyerEcoCode, pf.buyerRegId, pf.buyerAddress, pf.buyerPhone, pf.buyerPostal, pf.hasCommission, pf.commissionAmt, pf.commissionNote, pf.wmsWarehouseId||null, ext.expiry, ext.channel, ext.currency, ext.exchangeRate, ext.paymentTerms, ext.salesOwner, ext.supportOwner, pf.id, req.user.username]
    );
    await appendProformaEvent(pf.id, 'revision_created', req.user.username, 'نسخه جدید ' + no, { newId: id });
    await appendProformaEvent(id, 'revision_from', req.user.username, 'از ' + pf.no, { parentId: pf.id });
    res.status(201).json(rowToObj(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/proforma/:id/action — workflow ────────────────────────────────
const TRANSITIONS = {
  draft:         ['send','cancel'],
  pending_disc:  ['approve_disc','reject_disc','cancel'],
  sent:          ['negotiate','approve','reject','cancel','expire'],
  negotiating:   ['approve','reject','cancel','expire'],
  approved:      ['cancel','reject'],
  rejected:      ['reopen'],
  cancelled:     ['reopen'],
  expired:       ['reopen'],
  invoiced:      [],
};

router.post('/:id/action', requireAuth, async (req, res) => {
  try {
    const d = validate(ActionSchema, req.body, res);
    if (!d) return;

    const { executeProformaAction } = require('../lib/proforma-action');
    const result = await executeProformaAction(req.params.id, d.action, req.user, {
      note: d.note || '',
      lossReason: d.lossReason || '',
      lossCompetitor: d.lossCompetitor || '',
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.proforma);
    try { require('../lib/inbox-hooks').onProformaChange(req.params.id); } catch (_) {}

    try {
      const hub = require('../lib/notification-hub');
      const updated = result.proforma;
      const action = (typeof d !== 'undefined' && d && d.action) ? d.action : '';
      const notifyEnabled = true;
      const msg = 'پیش‌فاکتور ' + (updated.no || updated.id) + ' — ' + action
        + ((d && d.note) ? (' — ' + d.note) : '');
      if (updated && updated.created_by) {
        await hub.createNotification({
          id: 'pf_' + action + '_' + updated.id + '_' + updated.created_by,
          to: updated.created_by,
          from: req.user.username,
          msg,
          type: 'proforma',
          meta: { proformaId: updated.id, proformaNo: updated.no, action },
          skipDedup: true,
        });
      }
      if (notifyEnabled) {
        try {
          const bot = require('../bot/telegram');
          bot.notifyAll(msg).catch(function () {});
        } catch (_) {}
      }
    } catch (e) {
      console.error('[proforma notify]', e.message);
    }
  } catch(e) {
    console.error('[proforma action]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── DELETE /api/proforma/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT status, created_by FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const isSuperAdmin = isSuperAdminRole(req.user.role);
    const isManager = isManagerRole(req.user.role);
    const row = existing.rows[0];
    const status = row.status;
    const isOwner = row.created_by === req.user.username;

    if (!isSuperAdmin) {
      if (!isManager && !isOwner) {
        return res.status(403).json({ error: 'دسترسی ندارید' });
      }
      if (!isManager && status === 'approved') {
        return res.status(403).json({ error: 'فقط مدیر می‌تواند پیشفاکتور تأییدشده را حذف کند' });
      }
      if (!['draft','cancelled','rejected','approved'].includes(status)) {
        return res.status(400).json({ error: 'فقط پیش‌نویس، لغو شده، رد شده یا تایید شده را می‌توان حذف کرد' });
      }
    }
    await query('DELETE FROM proformas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'خطای سرور' }); }
});

module.exports = router;

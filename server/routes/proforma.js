'use strict';

const express    = require('express');
const multer     = require('multer');
const { z }      = require('zod');
const { query }  = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const { createDispatchFromProforma, getDispatchForProforma } = require('../lib/wms-dispatch');

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
});

const ActionSchema = z.object({
  action: z.enum(['send','approve','reject','cancel','reopen']),
  note:   z.string().default(''),
});

function isManagerRole(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}
function isSuperAdminRole(role) {
  return role === 'سوپر ادمین';
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

    res.json({
      ok: true,
      byStatus: byStatus.rows.map(r => ({ status: r.status, count: r.cnt, totalValue: Number(r.total_value) })),
      byMonth: byMonth.rows.map(r => ({ month: r.month, count: r.cnt, approvedTotal: Number(r.approved_total) })),
      totals: totals.rows[0] || {},
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
          status, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, 
          $8, $9, $10, $11, $12, $13, 
          $14, $15, $16, $17, $18, 
          $19, $20, $21, 
          $22, $23, $24, $25,
          'draft', $26, NOW(), NOW())
       RETURNING *`,
      [id, no, d.jalaliDate||null, d.validDays, d.centerKey, d.centerName,
       JSON.stringify(itemsFull), subtotal, d.discountPct, discAmt,
       d.taxPct, taxAmt, total, d.note, d.managerNote,
       d.buyerNatId, d.buyerEcoCode, d.buyerRegId, d.buyerAddress, d.buyerPhone, d.buyerPostal,
       d.hasCommission||false, d.commissionAmt||0, d.commissionNote||'',
       d.wmsWarehouseId || null,
       req.user.username]
    );
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
         updated_at=NOW(),
         versions = versions || $24::jsonb
       WHERE id=$25 RETURNING *`,
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

    const r = await query(
      `UPDATE proformas SET
         jalali_date=$1, valid_days=$2, center_key=$3, center_name=$4,
         items=$5, subtotal=$6, discount_pct=$7, disc_amt=$8,
         tax_pct=$9, tax_amt=$10, total=$11, note=$12, manager_note=$13,
         buyer_nat_id=$14, buyer_eco_code=$15, buyer_reg_id=$16, buyer_address=$17,
         buyer_phone=$18, buyer_postal=$19,
         has_commission=$20, commission_amt=$21, commission_note=$22,
         wms_warehouse_id=$23,
         updated_at=NOW(),
         versions = versions || $24::jsonb
       WHERE id=$25 RETURNING *`,
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
       d.wmsWarehouseId !== undefined ? (d.wmsWarehouseId || null) : (pf.wmsWarehouseId || null),
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
  invoiced:  [],
};

router.post('/:id/action', requireAuth, async (req, res) => {
  try {
    const d = validate(ActionSchema, req.body, res);
    if (!d) return;

    const existing = await query('SELECT * FROM proformas WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'پیشفاکتور یافت نشد' });
    const pf = existing.rows[0];

    if (!canViewProforma(req.user, pf)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    const allowed = TRANSITIONS[pf.status] || [];
    if (!allowed.includes(d.action)) {
      return res.status(400).json({
        error: `عملیات '${d.action}' در وضعیت '${pf.status}' مجاز نیست`,
      });
    }

    const isManager = isManagerRole(req.user.role);
    const isOwner   = pf.created_by === req.user.username;

    if (d.action === 'send' && !isOwner && !isManager) {
      return res.status(403).json({ error: 'فقط سازنده می‌تواند ارسال کند' });
    }
    if (d.action === 'cancel' && !isOwner && !isManager) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (d.action === 'reopen' && !isOwner && !isManager) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

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

    let wmsDispatch = null;
    if (d.action === 'approve') {
      try {
        wmsDispatch = await createDispatchFromProforma(updated, req.user.username);
        if (wmsDispatch && wmsDispatch.transactionIds) {
          updated.wmsDispatchIds = wmsDispatch.transactionIds;
        }
      } catch (dispatchErr) {
        console.error('[proforma approve dispatch]', dispatchErr.message);
        wmsDispatch = { error: dispatchErr.message };
      }
    }

    res.json(Object.assign({}, updated, { wmsDispatch: wmsDispatch }));

    // In-app + Telegram notifications
    try {
      const hub = require('../lib/notification-hub');
      const settingsRow = await query("SELECT value FROM app_settings WHERE key = 'telegramNotify'");
      const notifyEnabled = !settingsRow.rows.length || settingsRow.rows[0].value !== false;

      if (d.action === 'send') {
        const msg = '📄 پیشفاکتور ' + updated.no + ' از ' + req.user.username +
          ' در انتظار تأیید است — مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼';
        const mgrs = await query(
          `SELECT username FROM app_users WHERE active = true AND role IN ('مدیر', 'سوپر ادمین')`
        );
        for (const m of mgrs.rows) {
          await hub.createNotification({
            id: 'pf_sent_' + updated.id + '_' + m.username,
            to: m.username,
            from: req.user.username,
            msg,
            centerKey: updated.centerKey || null,
            type: 'proforma',
            meta: { proformaId: updated.id, proformaNo: updated.no, action: 'pending' },
            priority: 1,
            skipDedup: true,
          });
        }
        if (notifyEnabled) {
          const bot = require('../bot/telegram');
          const tgMsg = '📄 پیشفاکتور ' + updated.no + ' از ' + req.user.username +
            ' در انتظار تأیید است.\n💰 مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼\n👤 مشتری: ' + (updated.centerName || '—');
          bot.notifyManagers(tgMsg).catch(function () {});
        }
      } else if (d.action === 'approve' || d.action === 'reject') {
        const label = d.action === 'approve' ? '✅ تأیید شد' : '❌ رد شد';
        const msg = '📄 پیشفاکتور ' + updated.no + ' ' + label + ' توسط ' + req.user.username +
          (d.note ? ' — ' + d.note : '');
        if (updated.created_by) {
          await hub.createNotification({
            id: 'pf_' + d.action + '_' + updated.id + '_' + updated.created_by,
            to: updated.created_by,
            from: req.user.username,
            msg,
            type: 'proforma',
            meta: { proformaId: updated.id, proformaNo: updated.no, action: d.action },
            skipDedup: true,
          });
        }
        if (notifyEnabled) {
          const bot = require('../bot/telegram');
          bot.notifyAll(msg).catch(function () {});
        }
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

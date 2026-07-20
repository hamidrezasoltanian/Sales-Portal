'use strict';

const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

const ENTITIES = {
  finance: 'trade_finance_items',
  clearance: 'trade_clearances',
  supplier: 'trade_suppliers_new',
};
const ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|docx?|xlsx?)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: function(req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.test(file.originalname || '')) return cb(null, true);
    cb(new Error('فرمت فایل مجاز نیست'));
  },
});

function isManager(role) { return role === 'مدیر' || role === 'سوپر ادمین'; }
function entityType(value) { return ENTITIES[value] ? value : null; }

async function accessibleEntity(req, type, id) {
  const table = ENTITIES[type];
  const result = await query(`SELECT id, employee FROM ${table} WHERE id=$1`, [id]);
  const entity = result.rows[0];
  if (!entity) return { status: 404, error: 'رکورد موردنظر یافت نشد' };
  if (!isManager(req.user.role) && entity.employee !== req.user.username) {
    return { status: 403, error: 'دسترسی به این مدرک مجاز نیست' };
  }
  return { entity: entity };
}

async function attachmentWithAccess(req, id) {
  const result = await query(
    'SELECT id, entity_type, entity_id, filename, mime_type, file_size, data, uploaded_by, created_at FROM trade_attachments WHERE id=$1',
    [id]
  );
  const file = result.rows[0];
  if (!file) return { status: 404, error: 'فایل یافت نشد' };
  const access = await accessibleEntity(req, file.entity_type, file.entity_id);
  if (access.error) return access;
  return { file: file };
}

router.get('/list/:type/:entityId', requirePermission('trade-kpi', 'view'), async function(req, res) {
  try {
    const type = entityType(req.params.type);
    if (!type) return res.status(400).json({ error: 'نوع پیوست نامعتبر است' });
    const access = await accessibleEntity(req, type, req.params.entityId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const result = await query(
      `SELECT id, filename, mime_type, file_size, uploaded_by, created_at
       FROM trade_attachments WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC`,
      [type, req.params.entityId]
    );
    res.json({ files: result.rows });
  } catch (e) {
    console.error('[trade-files list]', e.message);
    res.status(500).json({ error: 'خطا در دریافت مدارک' });
  }
});

router.post('/upload/:type/:entityId', requirePermission('trade-kpi', 'edit'), upload.array('files', 10), async function(req, res) {
  try {
    const type = entityType(req.params.type);
    if (!type) return res.status(400).json({ error: 'نوع پیوست نامعتبر است' });
    const access = await accessibleEntity(req, type, req.params.entityId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'فایلی انتخاب نشده است' });

    const files = [];
    for (const item of req.files) {
      const id = crypto.randomUUID();
      const result = await query(
        `INSERT INTO trade_attachments (id,entity_type,entity_id,filename,mime_type,file_size,data,uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,filename,mime_type,file_size,uploaded_by,created_at`,
        [id, type, req.params.entityId, item.originalname, item.mimetype, item.size, item.buffer, req.user.username]
      );
      files.push(result.rows[0]);
    }
    res.status(201).json({ ok: true, files: files });
  } catch (e) {
    console.error('[trade-files upload]', e.message);
    res.status(500).json({ error: 'خطا در ذخیره مدرک' });
  }
});

router.get('/:id', requirePermission('trade-kpi', 'view'), async function(req, res) {
  try {
    const access = await attachmentWithAccess(req, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const file = access.file;
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', (req.query.dl === '1' ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(file.filename));
    res.send(file.data);
  } catch (e) {
    console.error('[trade-files get]', e.message);
    res.status(500).json({ error: 'خطا در دریافت فایل' });
  }
});

router.delete('/:id', requirePermission('trade-kpi', 'edit'), async function(req, res) {
  try {
    const access = await attachmentWithAccess(req, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    await query('DELETE FROM trade_attachments WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[trade-files delete]', e.message);
    res.status(500).json({ error: 'خطا در حذف مدرک' });
  }
});

module.exports = router;

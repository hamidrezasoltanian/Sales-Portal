'use strict';

const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function encodeCenterKey(key) {
  return String(key || '').trim();
}

// GET /api/center-files/list/:centerKey
router.get('/list/:centerKey', async function (req, res) {
  try {
    const ck = encodeCenterKey(decodeURIComponent(req.params.centerKey));
    const r = await query(
      'SELECT id, filename, mime_type, file_size, uploaded_by, created_at FROM center_files WHERE center_key = $1 ORDER BY created_at DESC',
      [ck]
    );
    res.json({ files: r.rows });
  } catch (e) {
    console.error('[center-files list]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/center-files/upload/:centerKey
router.post('/upload/:centerKey', upload.array('files', 10), async function (req, res) {
  try {
    const ck = encodeCenterKey(decodeURIComponent(req.params.centerKey));
    if (!ck) return res.status(400).json({ error: 'center_key نامعتبر' });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'فایلی ارسال نشده' });
    const inserted = [];
    for (const f of req.files) {
      const r = await query(
        `INSERT INTO center_files (center_key, filename, mime_type, file_size, data, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, filename, mime_type, file_size, uploaded_by, created_at`,
        [ck, f.originalname, f.mimetype, f.size, f.buffer, req.user.username]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ ok: true, files: inserted });
  } catch (e) {
    console.error('[center-files upload]', e.message);
    res.status(500).json({ error: 'خطای ذخیره فایل' });
  }
});

// GET /api/center-files/:id
router.get('/:id', async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const r = await query('SELECT filename, mime_type, data FROM center_files WHERE id = $1', [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    const { filename, mime_type, data } = r.rows[0];
    const dl = req.query.dl === '1';
    res.setHeader('Content-Type', mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', (dl ? 'attachment' : 'inline') + '; filename*=UTF-8\'\'' + encodeURIComponent(filename));
    res.send(data);
  } catch (e) {
    console.error('[center-files get]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/center-files/:id
router.delete('/:id', async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const r = await query('DELETE FROM center_files WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[center-files delete]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

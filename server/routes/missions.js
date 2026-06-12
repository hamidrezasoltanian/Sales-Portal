'use strict';

const express = require('express');
const multer  = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// Multer error handler — catches LIMIT_FILE_SIZE and returns 413 instead of 500
function handleUpload(req, res, next) {
  upload.single('file')(req, res, function(err) {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'حجم فایل بیش از ۱۰ مگابایت است' });
    }
    if (err) return res.status(400).json({ error: 'خطا در آپلود فایل' });
    next();
  });
}

// POST /api/missions/files — upload one file for a mission expense
router.post('/files', requireAuth, handleUpload, async (req, res) => {
  const { missionId, expenseId } = req.body;
  if (!missionId) return res.status(400).json({ error: 'missionId الزامی است' });
  if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشده' });
  try {
    const f = req.file;
    const r = await query(
      `INSERT INTO mission_files (mission_id, expense_id, filename, mime_type, file_size, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, mime_type, file_size, uploaded_by, created_at`,
      [String(missionId), expenseId ? String(expenseId) : null, f.originalname, f.mimetype, f.size, f.buffer, req.user.username]
    );
    res.json({ ok: true, id: r.rows[0].id, file: r.rows[0] });
  } catch (e) {
    console.error('[missions/upload]', e.message);
    res.status(500).json({ error: 'خطای ذخیره فایل' });
  }
});

// GET /api/missions/files/list/:missionId — list files for a mission
// Must be registered BEFORE /files/:id to avoid route shadowing
router.get('/files/list/:missionId', requireAuth, async (req, res) => {
  const missionId = req.params.missionId;
  if (!missionId || missionId.trim() === '') return res.status(400).json({ error: 'missionId الزامی است' });
  try {
    const r = await query(
      'SELECT id, expense_id, filename, mime_type, file_size, uploaded_by, created_at FROM mission_files WHERE mission_id = $1 ORDER BY created_at ASC',
      [missionId]
    );
    res.json({ files: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/missions/files/:id — retrieve file
router.get('/files/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    const r = await query('SELECT filename, mime_type, data FROM mission_files WHERE id = $1', [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    const { filename, mime_type, data } = r.rows[0];
    const dl = req.query.dl === '1';
    res.setHeader('Content-Type', mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      (dl ? 'attachment' : 'inline') + '; filename*=UTF-8\'\'' + encodeURIComponent(filename));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  } catch (e) {
    console.error('[missions/get]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/missions/files/:id — only the uploader can delete their own file
router.delete('/files/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    // Single atomic CTE: DELETE only if owner matches; use snapshot to distinguish
    // 404 (never existed) from 403 (exists but wrong owner) without a TOCTOU race.
    const r = await query(`
      WITH del AS (
        DELETE FROM mission_files WHERE id = $1 AND uploaded_by = $2 RETURNING id
      ),
      existed AS (
        SELECT id FROM mission_files WHERE id = $1
      )
      SELECT
        EXISTS(SELECT 1 FROM existed) AS existed,
        EXISTS(SELECT 1 FROM del)     AS deleted
    `, [id, req.user.username]);
    const { existed, deleted } = r.rows[0];
    if (!existed) return res.status(404).json({ error: 'فایل یافت نشد' });
    if (!deleted)  return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[missions/delete]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

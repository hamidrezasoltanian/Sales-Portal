'use strict';

const express = require('express');
const path = require('path');
const { requireAuth, requireManager } = require('../auth');
const { query } = require('../db');
const autoBackup = require('../lib/auto-backup');

const router = express.Router();
router.use(requireAuth);
router.use(requireManager);

router.get('/status', async function (req, res) {
  try {
    const status = await autoBackup.getStatus();
    res.json({ ok: true, status });
  } catch (e) {
    console.error('[backups/status]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/files', async function (req, res) {
  try {
    res.json({ ok: true, files: autoBackup.listBackupFiles() });
  } catch (e) {
    console.error('[backups/files]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/snapshots', async function (req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const result = await query(
      `SELECT id, saved_at, saved_by FROM app_data_history WHERE key = 'main' ORDER BY saved_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ ok: true, snapshots: result.rows });
  } catch (e) {
    console.error('[backups/snapshots]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/run', async function (req, res) {
  try {
    const mode = req.body && req.body.mode === 'appdata' ? 'appdata' : 'scheduled';
    const result = await autoBackup.runBackupScript(mode, req.user.username);
    res.json({ ok: true, result: { filePath: result.filePath, sizeBytes: result.sizeBytes } });
  } catch (e) {
    console.error('[backups/run]', e.message);
    res.status(500).json({ error: 'بکاپ ناموفق: ' + e.message });
  }
});

router.get('/download/:filename', function (req, res) {
  try {
    const fp = autoBackup.resolveDownloadPath(req.params.filename);
    if (!fp) return res.status(404).json({ error: 'فایل یافت نشد' });
    res.download(fp, path.basename(fp));
  } catch (e) {
    console.error('[backups/download]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

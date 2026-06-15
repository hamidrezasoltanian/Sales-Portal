'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/wms — load WMS state
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await query(`SELECT value FROM app_data WHERE key = 'wms'`);
    if (r.rows.length === 0) return res.json(null);
    res.json(r.rows[0].value);
  } catch (e) {
    console.error('[wms GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/wms — save WMS state
router.put('/', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'داده نامعتبر' });
    }
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('wms', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [data, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[wms PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

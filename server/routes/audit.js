'use strict';
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();
router.use(requireAuth);

// POST /api/audit — log a change
router.post('/', async (req, res) => {
  const { centerKey, centerName, field, oldValue, newValue } = req.body || {};
  if (!centerKey || !field) return res.status(400).json({ error: 'centerKey و field الزامی است' });
  try {
    await query(
      `INSERT INTO center_audit (center_key, center_name, field, old_value, new_value, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [centerKey, centerName || '', field, String(oldValue ?? ''), String(newValue ?? ''), req.user.username]
    );
    return res.json({ ok: true });
  } catch(e) {
    console.error('[audit POST]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/audit?key=center_123&limit=20 — get audit history for a center
router.get('/', async (req, res) => {
  const { key, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 200);
  try {
    let result;
    if (key) {
      result = await query(
        'SELECT * FROM center_audit WHERE center_key = $1 ORDER BY changed_at DESC LIMIT $2',
        [key, lim]
      );
    } else {
      result = await query(
        'SELECT * FROM center_audit ORDER BY changed_at DESC LIMIT $1',
        [lim]
      );
    }
    return res.json(result.rows);
  } catch(e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

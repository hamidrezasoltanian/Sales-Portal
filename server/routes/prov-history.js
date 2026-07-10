'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();

// POST /api/prov-history — append one province ownership change
router.post('/', requireAuth, async function (req, res) {
  try {
    const h = req.body || {};
    if (!h.provId) return res.status(400).json({ error: 'provId الزامی است' });
    await query(
      `INSERT INTO province_history (province_id, province_name, from_owner, from_name, to_owner, to_name, action_date, action_ts, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        h.provId, h.provName || '', h.from || null, h.fromName || null,
        h.to || null, h.toName || null, h.at || '', h.ts || Date.now(),
      ]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[prov-history POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// DELETE /api/prov-history — manager clears all
router.delete('/', requireManager, async function (req, res) {
  try {
    const result = await query('DELETE FROM province_history RETURNING id');
    res.json({ ok: true, deleted: result.rows.length });
  } catch (e) {
    console.error('[prov-history DELETE]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

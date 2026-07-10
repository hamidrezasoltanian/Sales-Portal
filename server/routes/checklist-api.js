'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const _UPSERT = `INSERT INTO daily_checklists (date, username, items, note, updated_at, updated_by)
  VALUES ($1, $2, $3, $4, NOW(), $5)
  ON CONFLICT (date, username) DO UPDATE SET
    items = EXCLUDED.items,
    note = EXCLUDED.note,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by
  RETURNING date, username, items, note`;

// POST /api/checklist — upsert one day/user checklist
router.post('/', requireAuth, async function (req, res) {
  try {
    const { date, username, items, note } = req.body || {};
    if (!date || !username) {
      return res.status(400).json({ error: 'date و username الزامی هستند' });
    }
    const result = await query(_UPSERT, [
      date,
      username,
      JSON.stringify(items || []),
      note || '',
      req.user.username,
    ]);
    const row = result.rows[0];
    res.json({
      ok: true,
      key: date + '_' + username,
      checklist: { items: row.items || [], note: row.note || '' },
    });
  } catch (e) {
    console.error('[checklist-api POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

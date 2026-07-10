'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function rowToObj(r) {
  return {
    id: Number(r.id),
    userId: r.username,
    month: r.month,
    done: !!r.done,
    note: r.note || '',
  };
}

// POST /api/mission-log — upsert mission for user+month
router.post('/', requireAuth, async function (req, res) {
  try {
    const { userId, month, done, note, id } = req.body || {};
    if (!userId || !month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    const entryId = id || Date.now();
    // Delete existing entry for same user+month (one mission per user per month)
    await query('DELETE FROM mission_log WHERE username = $1 AND month = $2', [userId, month]);
    const result = await query(
      `INSERT INTO mission_log (id, username, month, done, note, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [entryId, userId, month, !!done, note || null, req.user.username]
    );
    res.json({ ok: true, entry: rowToObj(result.rows[0]) });
  } catch (e) {
    console.error('[mission-log POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// DELETE /api/mission-log?userId=&month=
router.delete('/', requireAuth, async function (req, res) {
  try {
    const { userId, month } = req.query;
    if (!userId || !month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    const result = await query(
      'DELETE FROM mission_log WHERE username = $1 AND month = $2 RETURNING id',
      [userId, month]
    );
    res.json({ ok: true, deleted: result.rows.length });
  } catch (e) {
    console.error('[mission-log DELETE]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

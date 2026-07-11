'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { isManagerRole } = require('../lib/roles');

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

router.get('/', requireAuth, async function (req, res) {
  try {
    const params = [];
    const conditions = [];
    if (req.query.month) { params.push(req.query.month); conditions.push('month = $' + params.length); }
    if (isManagerRole(req.user.role) && req.query.userId) {
      params.push(req.query.userId); conditions.push('username = $' + params.length);
    } else if (!isManagerRole(req.user.role)) {
      params.push(req.user.username); conditions.push('username = $' + params.length);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const result = await query('SELECT * FROM mission_log' + where + ' ORDER BY month DESC, username', params);
    res.json({ entries: result.rows.map(rowToObj) });
  } catch (e) {
    console.error('[mission-log GET]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// POST /api/mission-log — upsert mission for user+month
router.post('/', requireAuth, async function (req, res) {
  try {
    const { userId, month, done, note, id } = req.body || {};
    if (!userId || !month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    if (!isManagerRole(req.user.role) && userId !== req.user.username) {
      return res.status(403).json({ error: 'ثبت مأموریت برای کاربر دیگر مجاز نیست' });
    }
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
    if (!isManagerRole(req.user.role) && userId !== req.user.username) {
      return res.status(403).json({ error: 'حذف مأموریت کاربر دیگر مجاز نیست' });
    }
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

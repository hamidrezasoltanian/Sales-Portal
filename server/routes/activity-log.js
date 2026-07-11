'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { isManagerRole } = require('../lib/roles');

const router = express.Router();

const TABLES = {
  call: 'call_log',
  visit: 'visit_log',
  sales: 'sales_log',
};

function rowToEntry(type, r) {
  if (type === 'sales') {
    return {
      id: Number(r.id),
      date: r.date,
      userId: r.username,
      centerName: r.center_name || '',
      centerKey: r.center_key || null,
      amount: Number(r.amount) || 0,
      isCash: !!r.is_cash,
    };
  }
  return {
    id: Number(r.id),
    date: r.date,
    userId: r.username,
    count: r.count || 0,
    note: r.note || '',
  };
}

// POST /api/activity-log — append one log entry (call | visit | sales)
router.post('/', requireAuth, async function (req, res) {
  try {
    const type = (req.body && req.body.type) || '';
    const entry = (req.body && req.body.entry) || {};
    const table = TABLES[type];
    if (!table) return res.status(400).json({ error: 'type باید call، visit یا sales باشد' });
    if (!entry.id) return res.status(400).json({ error: 'entry.id الزامی است' });

    const user = req.user.username;
    let result;

    if (type === 'call') {
      result = await query(
        `INSERT INTO call_log (id, date, username, count, note, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date, username = EXCLUDED.username, count = EXCLUDED.count,
           note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [entry.id, entry.date || '', isManagerRole(req.user.role) && entry.userId ? entry.userId : user, entry.count || 1, entry.note || null, user]
      );
    } else if (type === 'visit') {
      const note = entry.centerName
        ? (entry.note ? entry.centerName + ' — ' + entry.note : entry.centerName)
        : (entry.note || null);
      result = await query(
        `INSERT INTO visit_log (id, date, username, count, note, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date, username = EXCLUDED.username, count = EXCLUDED.count,
           note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [entry.id, entry.date || '', isManagerRole(req.user.role) && entry.userId ? entry.userId : user, entry.count || 1, note, user]
      );
    } else {
      result = await query(
        `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date, username = EXCLUDED.username, center_name = EXCLUDED.center_name,
           center_key = EXCLUDED.center_key, amount = EXCLUDED.amount, is_cash = EXCLUDED.is_cash,
           updated_at = NOW(), updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [
          entry.id, entry.date || '', isManagerRole(req.user.role) && entry.userId ? entry.userId : user,
          entry.centerName || '', entry.centerKey || null,
          entry.amount || 0, !!entry.isCash, user,
        ]
      );
    }

    res.status(201).json({ ok: true, type, entry: rowToEntry(type, result.rows[0]) });
  } catch (e) {
    console.error('[activity-log POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// GET /api/activity-log?type=call|visit|sales&limit=100&username=
router.get('/', requireAuth, async function (req, res) {
  try {
    const type = req.query.type || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const username = isManagerRole(req.user.role) ? (req.query.username || '') : req.user.username;
    const types = type && TABLES[type] ? [type] : ['call', 'visit', 'sales'];
    const out = [];

    for (const t of types) {
      const table = TABLES[t];
      const params = [];
      let where = '';
      if (username) {
        params.push(username);
        where = ' WHERE username = $1';
      }
      params.push(limit);
      const r = await query(
        'SELECT * FROM ' + table + where + ' ORDER BY date DESC, id DESC LIMIT $' + params.length,
        params
      );
      r.rows.forEach(function (row) {
        const e = rowToEntry(t, row);
        e._type = t;
        out.push(e);
      });
    }

    out.sort(function (a, b) {
      if (a.date === b.date) return (b.id || 0) - (a.id || 0);
      return (b.date || '') < (a.date || '') ? -1 : 1;
    });
    res.json({ ok: true, entries: out.slice(0, limit) });
  } catch (e) {
    console.error('[activity-log GET]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// DELETE /api/activity-log/:type/:id
router.delete('/:type/:id', requireAuth, async function (req, res) {
  try {
    const type = req.params.type;
    const table = TABLES[type];
    if (!table) return res.status(400).json({ error: 'type نامعتبر' });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    if (!isManagerRole(req.user.role)) {
      const access = await query('SELECT username FROM ' + table + ' WHERE id = $1', [id]);
      if (!access.rows.length) return res.status(404).json({ error: 'یافت نشد' });
      if (access.rows[0].username !== req.user.username) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }

    const result = await query('DELETE FROM ' + table + ' WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true, deleted: id });
  } catch (e) {
    console.error('[activity-log DELETE]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// ── Helper: map DB row → camelCase object ──────────────────────────────────
function rowToObj(r) {
  return {
    id:        r.id,
    to:        r.to_user,
    msg:       r.msg,
    centerKey: r.center_key,
    at:        r.at,
    read:      r.read,
  };
}

// ── GET /api/notifications ─────────────────────────────────────────────────
// Query params: ?to=username, ?unread=true
router.get('/', requireAuth, async function (req, res) {
  try {
    const conditions = [];
    const params = [];

    const isManager = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
    const targetUser = req.query.to || (!isManager ? req.user.username : null);

    if (targetUser) {
      params.push(targetUser);
      conditions.push(`to_user = $${params.length}`);
    }
    if (req.query.unread === 'true') {
      conditions.push(`read = false`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sqlResult = await query(
      `SELECT * FROM notifications ${where} ORDER BY at DESC LIMIT 200`,
      params
    );
    const sqlRows = sqlResult.rows.map(rowToObj);
    const sqlIds = new Set(sqlRows.map(r => r.id));

    // Fall back / merge with blob notifications (data may not be migrated to SQL yet)
    let blobRows = [];
    try {
      const blobRes = await query(`SELECT value FROM app_data WHERE key = 'main'`);
      const blob = blobRes.rows[0]?.value;
      const blobNotifs = Array.isArray(blob?.notifications) ? blob.notifications : [];
      blobRows = blobNotifs
        .filter(n => n.id && !sqlIds.has(n.id))
        .filter(n => !targetUser || n.to === targetUser)
        .filter(n => req.query.unread !== 'true' || !n.read)
        .map(n => ({
          id: n.id,
          to: n.to || null,
          msg: n.msg || n.message || '',   // blob uses "message", SQL uses "msg"
          centerKey: n.centerKey || null,
          at: n.at || new Date().toISOString(),
          read: !!n.read,
        }));
    } catch (_) {}

    const all = [...sqlRows, ...blobRows]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 200);

    res.json(all);
  } catch (e) {
    console.error('[notifications GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications ────────────────────────────────────────────────
router.post('/', requireAuth, async function (req, res) {
  try {
    const { id, to, msg, centerKey, at } = req.body;
    if (!id || !to || !msg) {
      return res.status(400).json({ error: 'فیلدهای id، to و msg الزامی هستند' });
    }
    const result = await query(
      `INSERT INTO notifications (id, to_user, msg, center_key, at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, to, msg, centerKey || null, at ? new Date(at) : new Date()]
    );
    res.status(201).json(rowToObj(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'اعلان با این شناسه قبلاً ثبت شده' });
    }
    console.error('[notifications POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PUT /api/notifications/:id/read ───────────────────────────────────────
router.put('/:id/read', requireAuth, async function (req, res) {
  try {
    const result = await query(
      `UPDATE notifications SET read = true WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[notifications PUT /:id/read]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/read-all ──────────────────────────────────────
// Mark all notifications as read for the current user (or ?to= if manager)
router.post('/read-all', requireAuth, async function (req, res) {
  try {
    const isManager = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
    const targetUser = (isManager && req.body.to) ? req.body.to : req.user.username;
    const result = await query(
      `UPDATE notifications SET read = true WHERE to_user = $1 AND read = false RETURNING id`,
      [targetUser]
    );
    res.json({ updated: result.rows.length });
  } catch (e) {
    console.error('[notifications POST /read-all]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const result = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

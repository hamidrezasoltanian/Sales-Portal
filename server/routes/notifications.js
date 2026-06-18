'use strict';

const express = require('express');
const { query, pool } = require('../db');
const { requireAuth } = require('../auth');

// Lazy-load bot to avoid circular deps
let _tgNotify = null;
function getTgNotify() {
  if (!_tgNotify) { try { _tgNotify = require('../bot/telegram').notifyUser; } catch(e) {} }
  return _tgNotify;
}

// Lazy-load SSE broadcast to avoid circular deps at module load
let _broadcast = null;
function getBroadcast() {
  if (!_broadcast) { try { _broadcast = require('./events').broadcast; } catch(e) {} }
  return _broadcast;
}

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
    const notif = rowToObj(result.rows[0]);
    // Push to Telegram if the recipient has an active bot session
    const tgNotify = getTgNotify();
    if (tgNotify) tgNotify(to, '🔔 ' + msg).catch(function(){});
    // Broadcast SSE so the recipient's open browser tab sees the badge update immediately
    const broadcast = getBroadcast();
    if (broadcast) broadcast('notif_new', { to, msg, id: notif.id });
    res.status(201).json(notif);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'اعلان با این شناسه قبلاً ثبت شده' });
    }
    console.error('[notifications POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── Helper: mark a blob notification read in app_data 'main' ────────────────
// Most in-app notifications live in the DB blob (DB.notifications), not the SQL
// table. Marking them read must persist back into the blob, otherwise the next
// GET re-serves them as unread.
async function _markBlobNotifRead(id, allForUser) {
  const client = await require('../db').pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query("SELECT value FROM app_data WHERE key = 'main' FOR UPDATE");
    if (!cur.rows.length) { await client.query('ROLLBACK'); return 0; }
    const blob = cur.rows[0].value || {};
    const notifs = Array.isArray(blob.notifications) ? blob.notifications : [];
    let changed = 0;
    notifs.forEach(function (n) {
      const match = allForUser ? (n.to === allForUser && !n.read) : (n.id === id);
      if (match && !n.read) { n.read = true; changed++; }
      else if (match && allForUser) { /* already read */ }
    });
    if (changed > 0) {
      blob.notifications = notifs;
      await client.query("UPDATE app_data SET value = $1, updated_at = NOW() WHERE key = 'main'", [blob]);
    }
    await client.query('COMMIT');
    return changed;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[notifications _markBlobNotifRead]', e.message);
    return 0;
  } finally {
    client.release();
  }
}

// ── GET /api/notifications/count ──────────────────────────────────────────
// Lightweight endpoint: returns just the unread count for the current user.
router.get('/count', requireAuth, async function (req, res) {
  try {
    const isManager = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
    const targetUser = req.query.to || (!isManager ? req.user.username : null);

    // Count from SQL
    let sqlCount = 0;
    if (targetUser) {
      const r = await query(`SELECT COUNT(*) AS c FROM notifications WHERE to_user = $1 AND read = false`, [targetUser]);
      sqlCount = parseInt(r.rows[0].c, 10) || 0;
    } else {
      const r = await query(`SELECT COUNT(*) AS c FROM notifications WHERE read = false`);
      sqlCount = parseInt(r.rows[0].c, 10) || 0;
    }

    // Count from blob (unread only, not already in SQL)
    let blobCount = 0;
    try {
      const blobRes = await query(`SELECT value FROM app_data WHERE key = 'main'`);
      const blob = blobRes.rows[0]?.value;
      const blobNotifs = Array.isArray(blob?.notifications) ? blob.notifications : [];
      // Get SQL ids to avoid double-counting
      const sqlIds = targetUser
        ? new Set((await query(`SELECT id FROM notifications WHERE to_user = $1`, [targetUser])).rows.map(r => r.id))
        : new Set((await query(`SELECT id FROM notifications`)).rows.map(r => r.id));
      blobCount = blobNotifs.filter(function(n) {
        return !n.read && !sqlIds.has(n.id) && (!targetUser || n.to === targetUser);
      }).length;
    } catch (_) {}

    res.json({ count: sqlCount + blobCount });
  } catch (e) {
    console.error('[notifications GET /count]', e.message);
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
      // Not in SQL → it's a blob notification; persist read state into the blob
      await _markBlobNotifRead(req.params.id, null);
      return res.json({ ok: true, blob: true });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[notifications PUT /:id/read]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/read-all ──────────────────────────────────────
// Mark all notifications as read for the current user (or ?to= if manager).
// A manager with no ?to= sees everyone's notifications, so mark them all.
router.post('/read-all', requireAuth, async function (req, res) {
  try {
    const isManager = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
    const markEveryone = isManager && !req.body.to;
    const targetUser = req.body.to || req.user.username;

    // SQL table
    const sqlResult = markEveryone
      ? await query(`UPDATE notifications SET read = true WHERE read = false RETURNING id`)
      : await query(`UPDATE notifications SET read = true WHERE to_user = $1 AND read = false RETURNING id`, [targetUser]);

    // Blob notifications
    const blobCount = await _markBlobReadAll(markEveryone ? null : targetUser);

    res.json({ updated: sqlResult.rows.length + blobCount });
  } catch (e) {
    console.error('[notifications POST /read-all]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// Mark all blob notifications read. If user is null, mark every unread one.
async function _markBlobReadAll(user) {
  const client = await require('../db').pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query("SELECT value FROM app_data WHERE key = 'main' FOR UPDATE");
    if (!cur.rows.length) { await client.query('ROLLBACK'); return 0; }
    const blob = cur.rows[0].value || {};
    const notifs = Array.isArray(blob.notifications) ? blob.notifications : [];
    let changed = 0;
    notifs.forEach(function (n) {
      if (n.read) return;
      if (user && n.to !== user) return;
      n.read = true; changed++;
    });
    if (changed > 0) {
      blob.notifications = notifs;
      await client.query("UPDATE app_data SET value = $1, updated_at = NOW() WHERE key = 'main'", [blob]);
    }
    await client.query('COMMIT');
    return changed;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[notifications _markBlobReadAll]', e.message);
    return 0;
  } finally {
    client.release();
  }
}

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const nid = req.params.id;
    const sqlResult = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [nid]);
    // Also remove from blob (handles legacy blob-only notifications)
    const client = await pool.connect();
    let blobRemoved = 0;
    try {
      await client.query('BEGIN');
      const cur = await client.query("SELECT value FROM app_data WHERE key = 'main' FOR UPDATE");
      if (cur.rows.length) {
        const blob = cur.rows[0].value || {};
        const notifs = Array.isArray(blob.notifications) ? blob.notifications : [];
        const before = notifs.length;
        blob.notifications = notifs.filter(function(n) { return n.id !== nid; });
        blobRemoved = before - blob.notifications.length;
        if (blobRemoved > 0) {
          await client.query("UPDATE app_data SET value = $1, updated_at = NOW() WHERE key = 'main'", [blob]);
        }
      }
      await client.query('COMMIT');
    } catch (_) {
      try { await client.query('ROLLBACK'); } catch (__) {}
    } finally {
      client.release();
    }
    if (!sqlResult.rows.length && !blobRemoved) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

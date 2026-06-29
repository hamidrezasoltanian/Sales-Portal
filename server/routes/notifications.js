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
    centerKeys: r.center_keys || null,
    at:        r.at,
    read:      r.read,
    type:      r.type || 'general',
    meta:      r.meta || null,
    sentAt:    r.sent_at || null,   // null = pending (not yet pushed to Telegram)
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
    res.json(sqlResult.rows.map(rowToObj));
  } catch (e) {
    console.error('[notifications GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications ────────────────────────────────────────────────
router.post('/', requireAuth, async function (req, res) {
  try {
    const { id, to, msg, centerKey, centerKeys, at, type, meta, autoSend } = req.body;
    if (!id || !to || !msg) {
      return res.status(400).json({ error: 'فیلدهای id، to و msg الزامی هستند' });
    }
    // autoSend: true (default) = push to Telegram immediately
    //           false          = store as pending, no immediate Telegram push
    const shouldPush = autoSend !== false;
    const result = await query(
      `INSERT INTO notifications (id, to_user, msg, center_key, center_keys, at, type, meta, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, to, msg, centerKey || null,
       (centerKeys && centerKeys.length) ? JSON.stringify(centerKeys) : null,
       at ? new Date(at) : new Date(),
       type || 'general', meta ? JSON.stringify(meta) : null,
       shouldPush ? new Date() : null]   // sent_at tracks delivery time
    );
    const notif = rowToObj(result.rows[0]);
    // Push to Telegram only if autoSend is enabled
    if (shouldPush) {
      const tgNotify = getTgNotify();
      if (tgNotify) tgNotify(to, '🔔 ' + msg).catch(function(){});
    }
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

async function _markBlobNotifRead() { return 0; }

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

    res.json({ count: sqlCount });
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

async function _markBlobReadAll() { return 0; }

// ── POST /api/notifications/send-pending ─────────────────────────────────
// Manager manually triggers delivery of pending (autoSend=false) notifications.
router.post('/send-pending', requireAuth, async function (req, res) {
  try {
    const isManager = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
    if (!isManager) return res.status(403).json({ error: 'فقط مدیر مجاز است' });

    // Find all unsent notifications (sent_at IS NULL)
    const pending = await query(
      `SELECT * FROM notifications WHERE sent_at IS NULL ORDER BY at ASC LIMIT 100`
    );
    if (!pending.rows.length) return res.json({ sent: 0 });

    const tgNotify = getTgNotify();
    const broadcast = getBroadcast();
    let sent = 0;
    for (const row of pending.rows) {
      const notif = rowToObj(row);
      if (tgNotify) {
        try { await tgNotify(notif.to, '🔔 ' + notif.msg); } catch(_) {}
      }
      await query(`UPDATE notifications SET sent_at = NOW() WHERE id = $1`, [notif.id]);
      if (broadcast) broadcast('notif_new', { to: notif.to, msg: notif.msg, id: notif.id });
      sent++;
    }
    res.json({ sent });
  } catch (e) {
    console.error('[notifications POST /send-pending]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const nid = req.params.id;
    const sqlResult = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [nid]);
    if (!sqlResult.rows.length) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

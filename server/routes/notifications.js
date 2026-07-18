'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const hub = require('../lib/notification-hub');
const { isManagerRole } = require('../lib/roles');
const engine = require('../lib/notification-engine');

let _tgNotify = null;
function getTgNotify() {
  if (!_tgNotify) { try { _tgNotify = require('../bot/telegram').notifyUser; } catch (e) {} }
  return _tgNotify;
}

let _broadcast = null;
function getBroadcast() {
  if (!_broadcast) { try { _broadcast = require('./events').broadcast; } catch (e) {} }
  return _broadcast;
}

function inboxHook() {
  try { return require('../lib/inbox-hooks'); } catch (_) { return null; }
}

const router = express.Router();

function rowToObj(r) {
  return engine.rowToObj(r);
}

// ── GET /api/notifications ─────────────────────────────────────────────────
router.get('/', requireAuth, async function (req, res) {
  try {
    const conditions = [];
    const params = [];

    const isManager = isManagerRole(req.user.role);
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
      `SELECT * FROM notifications ${where} ORDER BY
         CASE severity
           WHEN 'critical' THEN 1 WHEN 'high' THEN 2
           WHEN 'medium' THEN 3 ELSE 4 END,
         at DESC
       LIMIT 200`,
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
    const { id, to, msg, centerKey, centerKeys, at, type, meta, autoSend, severity, bucket, actionUrl, forceBell } = req.body;
    if (!to || !msg) {
      return res.status(400).json({ error: 'فیلدهای to و msg الزامی هستند' });
    }

    const result = await engine.emitNotification({
      id: id || undefined,
      to,
      msg,
      centerKey: centerKey || null,
      centerKeys: centerKeys || null,
      at: at || null,
      type: type || 'general',
      meta: meta || null,
      autoSend: autoSend,
      severity: severity || null,
      bucket: bucket || (meta && meta.bucket) || null,
      dedupHours: (meta && meta.dedupHours) || 24,
      actionUrl: actionUrl || (meta && meta.actionUrl) || null,
      forceBell: forceBell === true || (type && !engine.ROUTINE_TYPES.has(type)),
    });

    if (result.skipped && !result.notif) {
      return res.status(201).json({ ok: true, skipped: true, reason: result.reason || 'skipped' });
    }

    // Legacy clients expect the notif object; if telegram-only digest, synthesize ack
    if (!result.notif) {
      return res.status(201).json({ ok: true, channels: result.channels, skipped: true, reason: 'no_bell' });
    }

    res.status(201).json(result.notif);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'اعلان با این شناسه قبلاً ثبت شده' });
    }
    console.error('[notifications POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/notifications/count ──────────────────────────────────────────
router.get('/count', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    const targetUser = req.query.to || (!isManager ? req.user.username : null);

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

// ── GET /api/notifications/my-prefs ───────────────────────────────────────
router.get('/my-prefs', requireAuth, async function (req, res) {
  try {
    const row = await engine.getUserPrefs(req.user.username);
    res.json(engine.userPrefsToApi(row));
  } catch (e) {
    console.error('[notifications GET /my-prefs]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PUT /api/notifications/my-prefs ───────────────────────────────────────
router.put('/my-prefs', requireAuth, async function (req, res) {
  try {
    const saved = await engine.saveUserPrefs(req.user.username, req.body || {});
    res.json(engine.userPrefsToApi(saved));
  } catch (e) {
    console.error('[notifications PUT /my-prefs]', e.message);
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
      return res.json({ ok: true, blob: true });
    }
    // Deactivate any legacy inbox copy
    const hooks = inboxHook();
    if (hooks && hooks.onNotificationChange) {
      hooks.onNotificationChange(req.params.id);
    }
    const broadcast = getBroadcast();
    if (broadcast) {
      broadcast('inbox-changed', { reason: 'notif-read', id: req.params.id });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[notifications PUT /:id/read]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/read-all ──────────────────────────────────────
router.post('/read-all', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    const markEveryone = isManager && !req.body.to;
    const targetUser = req.body.to || req.user.username;

    const sqlResult = markEveryone
      ? await query(`UPDATE notifications SET read = true WHERE read = false RETURNING id`)
      : await query(`UPDATE notifications SET read = true WHERE to_user = $1 AND read = false RETURNING id`, [targetUser]);

    // Deactivate legacy notification inbox rows for this user
    if (markEveryone) {
      await query(
        `UPDATE inbox_items SET active = FALSE, updated_at = NOW()
         WHERE source_type = 'notification' AND active = TRUE`
      ).catch(function () {});
    } else {
      await query(
        `UPDATE inbox_items SET active = FALSE, updated_at = NOW()
         WHERE source_type = 'notification' AND active = TRUE AND owner = $1`,
        [targetUser]
      ).catch(function () {});
    }

    const broadcast = getBroadcast();
    if (broadcast) broadcast('inbox-changed', { reason: 'notif-read-all', to: targetUser });

    res.json({ updated: sqlResult.rows.length });
  } catch (e) {
    console.error('[notifications POST /read-all]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/send-pending ─────────────────────────────────
router.post('/send-pending', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    if (!isManager) return res.status(403).json({ error: 'فقط مدیر مجاز است' });

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
        try { await tgNotify(notif.to, '🔔 ' + notif.msg); } catch (_) {}
      }
      await query(`UPDATE notifications SET sent_at = NOW() WHERE id = $1`, [notif.id]);
      if (broadcast) broadcast('notif_new', { to: notif.to, msg: notif.msg, id: notif.id, type: notif.type, severity: notif.severity });
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
    await query(
      `UPDATE inbox_items SET active = FALSE, updated_at = NOW()
       WHERE source_type = 'notification' AND source_id = $1`,
      [nid]
    ).catch(function () {});
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/telegram-push ─────────────────────────────────
router.post('/telegram-push', requireAuth, async function (req, res) {
  try {
    const { to, msg } = req.body;
    if (!to || !msg) return res.status(400).json({ error: 'to and msg required' });
    const tgNotify = getTgNotify();
    if (tgNotify) {
      tgNotify(to, '🔔 ' + msg).catch(function () {});
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications POST /telegram-push]', e.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Invalidate global prefs cache when settings change — exported helper
router.invalidatePrefsCaches = engine.invalidatePrefsCaches;


// ── from telegram-notif merge ──
router.post('/telegram-link', requireAuth, async function (req, res) {
  try {
    const data = await hub.createTelegramLinkToken(req.user.username);
    res.json({
      token: data.token,
      expiresAt: data.expiresAt,
      hint: 'در تلگرام دستور /link ' + data.token + ' را بفرستید',
    });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── from telegram-notif merge ──
router.get('/prefs', requireAuth, async function (req, res) {
  try {
    const username = req.query.user && isManagerRole(req.user.role)
      ? req.query.user
      : req.user.username;
    const prefs = await hub.getUserPrefs(username);
    res.json({ username, prefs });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── from telegram-notif merge ──
router.put('/prefs', requireAuth, async function (req, res) {
  try {
    const username = req.body.username && isManagerRole(req.user.role)
      ? req.body.username
      : req.user.username;
    const saved = await hub.saveUserPrefs(username, req.body.prefs || req.body);
    res.json({ username, prefs: saved });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── from telegram-notif merge ──
router.get('/inbox', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    const viewAll = isManager && req.query.all === 'true';
    const targetUser = viewAll ? null : (req.query.to || req.user.username);
    const conditions = [];
    const params = [];

    if (targetUser) {
      params.push(targetUser);
      conditions.push(`to_user = $${params.length}`);
    }
    if (req.query.unread === 'true') conditions.push('read = false');
    if (req.query.type) {
      params.push(req.query.type);
      conditions.push(`type = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sqlResult = await query(
      `SELECT * FROM notifications ${where} ORDER BY at DESC LIMIT 200`,
      params
    );
    res.json(sqlResult.rows.map(rowToObj));
  } catch (e) {
    console.error('[notifications GET /inbox]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── from telegram-notif merge ──
router.post('/:id/action', requireAuth, async function (req, res) {
  try {
    const action = (req.body.action || '').trim();
    if (!action) return res.status(400).json({ error: 'action الزامی است' });

    const r = await query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'اعلان یافت نشد' });
    const row = r.rows[0];
    const isManager = isManagerRole(req.user.role);
    if (row.to_user !== req.user.username && !isManager) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const notif = await hub.recordAction(req.params.id, row.to_user, action);
    const response = { ok: true, action, notif };

    if (action === 'ack') {
      await hub.createAckReply(rowToObj(row), req.user.username, req.user.display_name || req.user.username);
    }

    if (action === 'task' && row.meta && row.meta.taskId) {
      response.taskId = row.meta.taskId;
    }
    if ((action === 'call' || action === 'brief' || action === 'center') && row.center_key) {
      const parts = row.center_key.split('_');
      response.center = { rtype: parts[0], rid: parts.slice(1).join('_'), centerKey: row.center_key };
    }
    if (action === 'proforma' && row.meta && row.meta.proformaId) {
      response.proformaId = row.meta.proformaId;
    }

    res.json(response);
  } catch (e) {
    console.error('[notifications POST /:id/action]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── from telegram-notif merge ──
router.get('/push-vapid', requireAuth, function (req, res) {
  try {
    const wp = require('../lib/web-push-sender');
    const key = wp.getPublicKey();
    if (!key) return res.json({ configured: false, publicKey: null });
    res.json({ configured: true, publicKey: key });
  } catch (e) {
    res.status(500).json({ error: 'internal error' });
  }
});

// ── from telegram-notif merge ──
router.post('/push-subscribe', requireAuth, async function (req, res) {
  try {
    const sub = req.body.subscription || req.body;
    const wp = require('../lib/web-push-sender');
    if (!wp.getPublicKey()) return res.status(503).json({ error: 'Web Push پیکربندی نشده (VAPID)' });
    await wp.saveSubscription(req.user.username, sub);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.invalidatePrefsCaches = engine.invalidatePrefsCaches;

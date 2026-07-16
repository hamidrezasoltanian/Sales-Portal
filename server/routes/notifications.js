'use strict';

const express = require('express');
const { query, pool } = require('../db');
const { requireAuth } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const hub = require('../lib/notification-hub');

const router = express.Router();

function rowToObj(r) {
  return hub.rowToObj(r);
}

// ── GET /api/notifications/inbox ───────────────────────────────────────────
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

// ── GET /api/notifications/prefs ───────────────────────────────────────────
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

// ── PUT /api/notifications/prefs ───────────────────────────────────────────
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

// ── POST /api/notifications/telegram-link ──────────────────────────────────
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
    console.error('[notifications GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications ────────────────────────────────────────────────
router.post('/', requireAuth, async function (req, res) {
  try {
    const { id, to, msg, centerKey, centerKeys, at, type, meta, autoSend, priority } = req.body;
    if (!id || !to || !msg) {
      return res.status(400).json({ error: 'فیلدهای id، to و msg الزامی هستند' });
    }

    const result = await hub.createNotification({
      id,
      to,
      from: req.body.from || req.user.username,
      msg,
      centerKey,
      centerKeys,
      at,
      type,
      meta,
      autoSend,
      priority,
    });

    if (result.skipped) {
      return res.status(201).json({ ok: true, skipped: true, reason: result.reason });
    }
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'خطا' });
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

router.get('/count', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    const targetUser = req.query.to || (!isManager ? req.user.username : null);
    let sqlCount = 0;
    if (targetUser) {
      const r = await query(
        `SELECT COUNT(*) AS c FROM notifications WHERE to_user = $1 AND read = false`,
        [targetUser]
      );
      sqlCount = parseInt(r.rows[0].c, 10) || 0;
    } else {
      const r = await query(`SELECT COUNT(*) AS c FROM notifications WHERE read = false`);
      sqlCount = parseInt(r.rows[0].c, 10) || 0;
    }
    res.json({ count: sqlCount });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.put('/:id/read', requireAuth, async function (req, res) {
  try {
    const notif = await hub.markNotifRead(req.params.id, req.user.username);
    if (!notif) return res.json({ ok: true });
    res.json(notif);
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/notifications/:id/action ─────────────────────────────────────
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

router.post('/read-all', requireAuth, async function (req, res) {
  try {
    const isManager = isManagerRole(req.user.role);
    const markEveryone = isManager && !req.body.to;
    const targetUser = req.body.to || req.user.username;
    const sqlResult = markEveryone
      ? await query(`UPDATE notifications SET read = true WHERE read = false RETURNING id`)
      : await query(
        `UPDATE notifications SET read = true WHERE to_user = $1 AND read = false RETURNING id`,
        [targetUser]
      );
    res.json({ updated: sqlResult.rows.length });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.post('/send-pending', requireAuth, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر مجاز است' });
    const pending = await query(
      `SELECT * FROM notifications WHERE sent_at IS NULL ORDER BY at ASC LIMIT 100`
    );
    if (!pending.rows.length) return res.json({ sent: 0 });

    let sent = 0;
    for (const row of pending.rows) {
      const notif = rowToObj(row);
      const prefs = await hub.getUserPrefs(notif.to);
      await hub.pushTelegram(notif, prefs);
      await query(`UPDATE notifications SET sent_at = NOW() WHERE id = $1`, [notif.id]);
      const broadcast = require('./events').broadcast;
      if (broadcast) broadcast('notif_new', { to: notif.to, msg: notif.msg, id: notif.id });
      sent++;
    }
    res.json({ sent });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const sqlResult = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (!sqlResult.rows.length) return res.status(404).json({ error: 'اعلان یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.post('/telegram-push', requireAuth, async function (req, res) {
  try {
    const { to, msg } = req.body;
    if (!to || !msg) return res.status(400).json({ error: 'to and msg required' });
    const tg = require('../bot/telegram').notifyUser;
    if (tg) tg(to, '🔔 ' + msg).catch(function () {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;

'use strict';

const { query } = require('../db');
const { calcTodayJ } = require('./jalali-utils');

let _globalPrefsCache = null;
let _globalPrefsTs = 0;

const DEFAULT_GLOBAL_PREFS = {
  enabled: true,
  autoSend: true,
  types: {
    morning_brief: true,
    followup: true,
    task: true,
    owner_change: true,
    general: true,
  manager_request: true,
    ack: true,
    proforma: true,
    support: true,
    hr: true,
    letters: true,
  },
};

const DEFAULT_USER_PREFS = {
  enabled: true,
  channels: { web: true, telegram: true, browser: true },
  types: {},
  digest_mode: 'instant',
};

function rowToObj(r) {
  return {
    id: r.id,
    to: r.to_user,
    from: r.from_user || null,
    msg: r.msg,
    centerKey: r.center_key,
    centerKeys: r.center_keys || null,
    at: r.at,
    read: r.read,
    type: r.type || 'general',
    meta: r.meta || null,
    sentAt: r.sent_at || null,
    priority: r.priority != null ? r.priority : 2,
    actionTaken: r.action_taken || null,
  };
}

async function getGlobalPrefs() {
  if (_globalPrefsCache && (Date.now() - _globalPrefsTs) < 60000) {
    return _globalPrefsCache;
  }
  try {
    const r = await query("SELECT value FROM app_settings WHERE key = 'notifPrefs'");
    const raw = (r.rows[0] && r.rows[0].value) || {};
    _globalPrefsCache = {
      enabled: raw.enabled !== false,
      autoSend: raw.autoSend !== false,
      types: Object.assign({}, DEFAULT_GLOBAL_PREFS.types, raw.types || {}),
    };
  } catch (e) {
    _globalPrefsCache = Object.assign({}, DEFAULT_GLOBAL_PREFS);
  }
  _globalPrefsTs = Date.now();
  return _globalPrefsCache;
}

function invalidateGlobalPrefsCache() {
  _globalPrefsCache = null;
  _globalPrefsTs = 0;
}

async function getUserPrefs(username) {
  const global = await getGlobalPrefs();
  let user = Object.assign({}, DEFAULT_USER_PREFS);
  try {
    const r = await query('SELECT * FROM user_notif_prefs WHERE username = $1', [username]);
    if (r.rows.length) {
      const row = r.rows[0];
      user = {
        enabled: row.enabled !== false,
        channels: Object.assign({}, DEFAULT_USER_PREFS.channels, row.channels || {}),
        types: row.types || {},
        quiet_hours: row.quiet_hours || null,
        digest_mode: row.digest_mode || 'instant',
      };
    }
  } catch (e) { /* table may not exist yet */ }

  const mergedTypes = Object.assign({}, global.types, user.types);
  return {
    enabled: global.enabled && user.enabled,
    autoSend: global.autoSend,
    channels: user.channels,
    types: mergedTypes,
    quiet_hours: user.quiet_hours,
    digest_mode: user.digest_mode,
  };
}

async function saveUserPrefs(username, prefs) {
  await query(
    `INSERT INTO user_notif_prefs (username, enabled, channels, types, quiet_hours, digest_mode, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (username) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       channels = EXCLUDED.channels,
       types = EXCLUDED.types,
       quiet_hours = EXCLUDED.quiet_hours,
       digest_mode = EXCLUDED.digest_mode,
       updated_at = NOW()`,
    [
      username,
      prefs.enabled !== false,
      JSON.stringify(prefs.channels || DEFAULT_USER_PREFS.channels),
      JSON.stringify(prefs.types || {}),
      prefs.quiet_hours ? JSON.stringify(prefs.quiet_hours) : null,
      prefs.digest_mode || 'instant',
    ]
  );
  return getUserPrefs(username);
}

function isTypeAllowed(prefs, type) {
  if (!prefs || prefs.enabled === false) return false;
  const t = type || 'general';
  if (prefs.types && prefs.types[t] === false) return false;
  return true;
}

function inQuietHours(prefs) {
  const qh = prefs && prefs.quiet_hours;
  if (!qh || !qh.start || !qh.end) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const parse = function (s) {
    const p = String(s).split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };
  const start = parse(qh.start);
  const end = parse(qh.end);
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

async function hasRecentNotif(toUser, type, hours) {
  const h = hours || 24;
  try {
    const r = await query(
      `SELECT 1 FROM notifications
       WHERE to_user = $1 AND type = $2 AND read = false
         AND at > NOW() - ($3 || ' hours')::interval
       LIMIT 1`,
      [toUser, type || 'general', String(h)]
    );
    return r.rows.length > 0;
  } catch (e) {
    return false;
  }
}

function buildTelegramKeyboard(notif) {
  const id = notif.id;
  const type = notif.type || 'general';
  const hasCenter = !!(notif.centerKey || (notif.centerKeys && notif.centerKeys.length));
  const rows = [];

  if (type === 'followup' || type === 'manager_request') {
    if (hasCenter) {
      rows.push([
        { text: '📞 ثبت تماس', callback_data: 'na:' + id + ':call' },
        { text: '📋 خلاصه', callback_data: 'na:' + id + ':brief' },
      ]);
    }
    rows.push([{ text: '✓ انجام شد', callback_data: 'na:' + id + ':ack' }]);
  } else if (type === 'task') {
    rows.push([{ text: '📋 باز کردن وظیفه', callback_data: 'na:' + id + ':task' }]);
    rows.push([{ text: '✅ انجام شد', callback_data: 'na:' + id + ':task_done' }]);
  } else if (type === 'morning_brief') {
    rows.push([{ text: '☀️ برنامه امروز', callback_data: 'na:' + id + ':today' }]);
  } else if (type === 'owner_change' && hasCenter) {
    rows.push([{ text: '🔍 مشاهده مرکز', callback_data: 'na:' + id + ':center' }]);
  } else if (type === 'proforma' && notif.meta && notif.meta.proformaId) {
    const pid = notif.meta.proformaId;
    rows.push([
      { text: '✅ تأیید', callback_data: 'pf_approve:' + pid },
      { text: '❌ رد', callback_data: 'pf_reject:' + pid },
    ]);
    rows.push([{ text: '👁 جزئیات', callback_data: 'na:' + id + ':proforma' }]);
  } else if (type !== 'ack') {
    rows.push([{ text: '✓ انجام شد', callback_data: 'na:' + id + ':ack' }]);
  }

  return rows.length ? { inline_keyboard: rows } : null;
}

let _tgNotifyRich = null;
function getTgNotifyRich() {
  if (!_tgNotifyRich) {
    try { _tgNotifyRich = require('../bot/telegram').notifyUser; } catch (e) {}
  }
  return _tgNotifyRich;
}

let _broadcast = null;
function getBroadcast() {
  if (!_broadcast) { try { _broadcast = require('../routes/events').broadcast; } catch (e) {} }
  return _broadcast;
}

async function pushTelegram(notif, prefs) {
  if (!prefs || prefs.channels.telegram === false) return;
  const tg = getTgNotifyRich();
  if (!tg) return;
  const kb = buildTelegramKeyboard(notif);
  await tg(notif.to, '🔔 ' + notif.msg, kb ? { reply_markup: kb } : undefined).catch(function () {});
}

async function createNotification(opts) {
  const {
    id, to, from, msg, centerKey, centerKeys, at, type, meta, autoSend, priority, skipDedup,
  } = opts;
  if (!id || !to || !msg) {
    return { ok: false, error: 'id, to, msg required' };
  }

  const notifType = type || 'general';
  const global = await getGlobalPrefs();
  const userPrefs = await getUserPrefs(to);

  if (!isTypeAllowed(global, notifType) || !isTypeAllowed(userPrefs, notifType)) {
    return { ok: true, skipped: true, reason: 'disabled' };
  }

  if (!skipDedup && await hasRecentNotif(to, notifType)) {
    return { ok: true, skipped: true, reason: 'dedup' };
  }

  const shouldPush = autoSend !== false && global.autoSend !== false && !inQuietHours(userPrefs);
  const result = await query(
    `INSERT INTO notifications
       (id, to_user, from_user, msg, center_key, center_keys, at, type, meta, sent_at, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      id, to, from || null, msg, centerKey || null,
      (centerKeys && centerKeys.length) ? JSON.stringify(centerKeys) : null,
      at ? new Date(at) : new Date(),
      notifType,
      meta ? JSON.stringify(meta) : null,
      shouldPush ? new Date() : null,
      priority != null ? priority : 2,
    ]
  );

  if (!result.rows.length) {
    return { ok: true, skipped: true, reason: 'duplicate' };
  }

  const notif = rowToObj(result.rows[0]);

  if (shouldPush) {
    await pushTelegram(notif, userPrefs);
  }

  const broadcast = getBroadcast();
  if (broadcast) {
    broadcast('notif_new', {
      to: notif.to,
      from: notif.from,
      msg: notif.msg,
      id: notif.id,
      type: notif.type,
    });
  }

  return { ok: true, notif };
}

async function markNotifRead(id, username) {
  const r = await query(
    `UPDATE notifications SET read = true WHERE id = $1
     AND ($2::text IS NULL OR to_user = $2)
     RETURNING *`,
    [id, username || null]
  );
  if (!r.rows.length) return null;
  const notif = rowToObj(r.rows[0]);
  const broadcast = getBroadcast();
  if (broadcast) broadcast('notif_updated', { id, to: notif.to, read: true });
  return notif;
}

async function recordAction(id, username, action) {
  const r = await query(
    `UPDATE notifications SET read = true, action_taken = $3
     WHERE id = $1 AND to_user = $2 RETURNING *`,
    [id, username, action]
  );
  if (!r.rows.length) return null;
  return rowToObj(r.rows[0]);
}

async function createAckReply(original, actorUsername, actorName) {
  if (!original.from || original.from === actorUsername) return null;
  const cName = original.centerKey || '';
  const replyMsg = (actorName || actorUsername) + ' تأیید کرد' +
    (cName ? ' مرکز مرتبط' : '') + ' — انجام شد ✓';
  return createNotification({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    to: original.from,
    from: actorUsername,
    msg: replyMsg,
    centerKey: original.centerKey,
    type: 'ack',
    skipDedup: true,
  });
}

function genLinkToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function createTelegramLinkToken(username) {
  const token = genLinkToken();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await query(
    `INSERT INTO telegram_link_tokens (token, username, expires_at)
     VALUES ($1, $2, $3)`,
    [token, username, expires]
  );
  return { token, expiresAt: expires.toISOString() };
}

async function consumeTelegramLinkToken(token, chatId) {
  const r = await query(
    `UPDATE telegram_link_tokens SET used_at = NOW()
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL
     RETURNING username`,
    [String(token || '').toUpperCase()]
  );
  if (!r.rows.length) return null;
  return r.rows[0].username;
}

async function notifySimple(opts) {
  return createNotification({
    id: opts.id || ('ntf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
    to: opts.to,
    from: opts.from || null,
    msg: opts.msg,
    type: opts.type || 'general',
    centerKey: opts.centerKey || null,
    centerKeys: opts.centerKeys || null,
    meta: opts.meta || null,
    priority: opts.priority,
    autoSend: opts.autoSend,
    skipDedup: true,
  });
}

module.exports = {
  rowToObj,
  getGlobalPrefs,
  getUserPrefs,
  saveUserPrefs,
  invalidateGlobalPrefsCache,
  isTypeAllowed,
  hasRecentNotif,
  buildTelegramKeyboard,
  createNotification,
  markNotifRead,
  recordAction,
  createAckReply,
  pushTelegram,
  createTelegramLinkToken,
  consumeTelegramLinkToken,
  calcTodayJ,
  notifySimple,
};

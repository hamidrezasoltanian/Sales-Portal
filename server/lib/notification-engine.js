'use strict';

/**
 * Notification Event Engine
 *
 * Single entry point for creating notifications. Decides:
 *  - severity from type
 *  - whether to create a bell row (events only; routine work stays in cartable)
 *  - per-user + global prefs
 *  - atomic dedup via notification_fired
 *  - Telegram / SSE channels
 *
 * Cartable (inbox_items) is NOT fed from notifications — work items come from
 * tasks / week_entries / center followups / proformas / HR.
 */

const { query } = require('../db');

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

/** Types that represent scheduled/routine work — never spam the bell. */
const ROUTINE_TYPES = new Set(['morning_brief', 'followup', 'digest']);

/** Default severity by type */
const TYPE_SEVERITY = {
  manager_request: 'critical',
  owner_change: 'high',
  task: 'high',
  proforma: 'high',
  digest: 'medium',
  morning_brief: 'low',
  followup: 'low',
  ack: 'low',
  general: 'medium',
};

let _globalPrefsCache = null;
let _globalPrefsTs = 0;
const _userPrefsCache = new Map();

function getBroadcast() {
  try { return require('../routes/events').broadcast; } catch (_) { return null; }
}

function getTgNotify() {
  try { return require('../bot/telegram').notifyUser; } catch (_) { return null; }
}

function invalidatePrefsCaches() {
  _globalPrefsCache = null;
  _globalPrefsTs = 0;
  _userPrefsCache.clear();
}

async function getGlobalPrefs() {
  if (_globalPrefsCache && (Date.now() - _globalPrefsTs) < 60000) {
    return _globalPrefsCache;
  }
  try {
    const r = await query("SELECT value FROM app_settings WHERE key = 'notifPrefs'");
    _globalPrefsCache = (r.rows[0] && r.rows[0].value) || {};
  } catch (_) {
    _globalPrefsCache = {};
  }
  _globalPrefsTs = Date.now();
  return _globalPrefsCache;
}

async function getUserPrefs(userId) {
  if (!userId) return null;
  const cached = _userPrefsCache.get(userId);
  if (cached && (Date.now() - cached.ts) < 60000) return cached.prefs;
  try {
    const r = await query(
      'SELECT * FROM user_notification_settings WHERE user_id = $1',
      [userId]
    );
    const prefs = r.rows[0] || null;
    _userPrefsCache.set(userId, { prefs, ts: Date.now() });
    return prefs;
  } catch (_) {
    return null;
  }
}

function resolveSeverity(type, explicit) {
  if (explicit && SEVERITY_RANK[explicit]) return explicit;
  return TYPE_SEVERITY[type] || 'medium';
}

function meetsMinSeverity(severity, minSeverity) {
  const s = SEVERITY_RANK[severity] || 2;
  const m = SEVERITY_RANK[minSeverity || 'low'] || 1;
  return s >= m;
}

/**
 * Decide if this notification should create a bell row.
 * Routine types are cartable-only unless forceBell is set.
 */
function shouldCreateBell(type, opts, userPrefs) {
  if (opts.forceBell) return true;
  if (opts.skipBell) return false;
  if (ROUTINE_TYPES.has(type)) {
    // Digests may optionally appear in bell if user opted in
    if (type === 'digest' && userPrefs && userPrefs.digest_bell) return true;
    return false;
  }
  if (userPrefs && userPrefs.bell === false) return false;
  return true;
}

function isTypeAllowed(type, globalPrefs, userPrefs) {
  if (globalPrefs && globalPrefs.enabled === false) return false;
  if (userPrefs && userPrefs.enabled === false) return false;
  const t = type || 'general';
  if (userPrefs && userPrefs.types && userPrefs.types[t] === false) return false;
  if (globalPrefs && globalPrefs.types && globalPrefs.types[t] === false) return false;
  return true;
}

/**
 * Atomic dedup: returns true if we may fire (inserted or expired old row).
 * ttlHours default 24.
 */
async function tryAcquireDedup(userId, bucket, ttlHours) {
  if (!bucket || !userId) return true;
  const ttl = Math.max(1, ttlHours || 24);
  try {
    // Delete expired
    await query(
      `DELETE FROM notification_fired
       WHERE user_id = $1 AND bucket = $2
         AND fired_at < NOW() - ($3 || ' hours')::interval`,
      [userId, bucket, String(ttl)]
    );
    const ins = await query(
      `INSERT INTO notification_fired (user_id, bucket, fired_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, bucket) DO NOTHING
       RETURNING user_id`,
      [userId, bucket]
    );
    return ins.rows.length > 0;
  } catch (e) {
    console.warn('[notif-engine] dedup failed:', e.message);
    return true; // fail open so real events still deliver
  }
}

function makeId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Emit a notification event.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.msg
 * @param {string} [opts.type]
 * @param {string} [opts.severity]
 * @param {string} [opts.centerKey]
 * @param {string[]} [opts.centerKeys]
 * @param {object} [opts.meta]
 * @param {string} [opts.bucket] - dedup key
 * @param {number} [opts.dedupHours]
 * @param {string} [opts.actionUrl]
 * @param {string} [opts.id]
 * @param {boolean} [opts.autoSend]
 * @param {boolean} [opts.forceBell] - force into notifications table even for routine
 * @param {boolean} [opts.skipBell]
 * @param {boolean} [opts.telegramOnly] - digest-style: only telegram, no bell
 * @returns {Promise<{ok, skipped?, reason?, notif?}>}
 */
async function emitNotification(opts) {
  const to = opts.to;
  const msg = opts.msg;
  if (!to || !msg) return { ok: false, skipped: true, reason: 'missing_fields' };

  const type = opts.type || 'general';
  const severity = resolveSeverity(type, opts.severity);
  const globalPrefs = await getGlobalPrefs();
  const userPrefs = await getUserPrefs(to);

  if (!isTypeAllowed(type, globalPrefs, userPrefs)) {
    return { ok: true, skipped: true, reason: 'disabled' };
  }

  if (!meetsMinSeverity(severity, userPrefs && userPrefs.min_severity)) {
    return { ok: true, skipped: true, reason: 'below_min_severity' };
  }

  if (opts.bucket) {
    const acquired = await tryAcquireDedup(to, opts.bucket, opts.dedupHours);
    if (!acquired) return { ok: true, skipped: true, reason: 'dedup' };
  }

  const createBell = !opts.telegramOnly && shouldCreateBell(type, opts, userPrefs);
  const wantTelegram =
    (opts.autoSend !== false) &&
    (globalPrefs.autoSend !== false) &&
    (userPrefs ? userPrefs.telegram !== false : true) &&
    (type === 'digest'
      ? (userPrefs ? userPrefs.digest_telegram !== false : true)
      : true);

  let notif = null;

  if (createBell) {
    const id = opts.id || makeId();
    const meta = opts.meta || null;
    const result = await query(
      `INSERT INTO notifications
         (id, to_user, msg, center_key, center_keys, at, type, meta, sent_at, severity, action_url, bucket)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id, to, msg,
        opts.centerKey || null,
        (opts.centerKeys && opts.centerKeys.length) ? JSON.stringify(opts.centerKeys) : null,
        opts.at ? new Date(opts.at) : new Date(),
        type,
        meta ? JSON.stringify(meta) : null,
        wantTelegram ? new Date() : null,
        severity,
        opts.actionUrl || null,
        opts.bucket || null,
      ]
    );
    notif = rowToObj(result.rows[0]);

    const broadcast = getBroadcast();
    if (broadcast) {
      broadcast('notif_new', { to, msg, id: notif.id, type, severity });
    }
  } else if (wantTelegram && opts.bucket) {
    // Telegram-only digest: still mark sent via a lightweight log row optional —
    // we just push telegram without a bell row.
  }

  if (wantTelegram) {
    const tg = getTgNotify();
    if (tg) {
      const prefix = severity === 'critical' ? '🚨 ' : severity === 'high' ? '🔔 ' : '📌 ';
      tg(to, prefix + msg).catch(function () {});
    }
    // If we created a bell row without sent_at yet but telegram fired, mark it
    if (notif && !notif.sentAt) {
      await query('UPDATE notifications SET sent_at = NOW() WHERE id = $1', [notif.id]).catch(function () {});
    }
  }

  return { ok: true, notif, skipped: !createBell && !wantTelegram, channels: { bell: createBell, telegram: wantTelegram } };
}

function rowToObj(r) {
  if (!r) return null;
  return {
    id: r.id,
    to: r.to_user,
    msg: r.msg,
    centerKey: r.center_key,
    centerKeys: r.center_keys || null,
    at: r.at,
    read: r.read,
    type: r.type || 'general',
    meta: r.meta || null,
    sentAt: r.sent_at || null,
    severity: r.severity || 'medium',
    actionUrl: r.action_url || null,
    bucket: r.bucket || null,
  };
}

/**
 * Upsert per-user notification settings.
 */
async function saveUserPrefs(userId, patch) {
  const cur = (await getUserPrefs(userId)) || {};
  const enabled = patch.enabled != null ? !!patch.enabled : (cur.enabled !== false);
  const bell = patch.bell != null ? !!patch.bell : (cur.bell !== false);
  const telegram = patch.telegram != null ? !!patch.telegram : (cur.telegram !== false);
  const digestTelegram = patch.digestTelegram != null ? !!patch.digestTelegram
    : (patch.digest_telegram != null ? !!patch.digest_telegram : (cur.digest_telegram !== false));
  const digestBell = patch.digestBell != null ? !!patch.digestBell
    : (patch.digest_bell != null ? !!patch.digest_bell : !!cur.digest_bell);
  const minSeverity = patch.minSeverity || patch.min_severity || cur.min_severity || 'low';
  const types = patch.types != null ? patch.types : (cur.types || {});

  await query(
    `INSERT INTO user_notification_settings
       (user_id, enabled, bell, telegram, digest_telegram, digest_bell, min_severity, types, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       bell = EXCLUDED.bell,
       telegram = EXCLUDED.telegram,
       digest_telegram = EXCLUDED.digest_telegram,
       digest_bell = EXCLUDED.digest_bell,
       min_severity = EXCLUDED.min_severity,
       types = EXCLUDED.types,
       updated_at = NOW()`,
    [userId, enabled, bell, telegram, digestTelegram, digestBell, minSeverity, JSON.stringify(types)]
  );
  _userPrefsCache.delete(userId);
  return getUserPrefs(userId);
}

function userPrefsToApi(row) {
  if (!row) {
    return {
      enabled: true, bell: true, telegram: true,
      digestTelegram: true, digestBell: false,
      minSeverity: 'low', types: {},
    };
  }
  return {
    enabled: row.enabled !== false,
    bell: row.bell !== false,
    telegram: row.telegram !== false,
    digestTelegram: row.digest_telegram !== false,
    digestBell: !!row.digest_bell,
    minSeverity: row.min_severity || 'low',
    types: row.types || {},
  };
}

module.exports = {
  emitNotification,
  getGlobalPrefs,
  getUserPrefs,
  saveUserPrefs,
  userPrefsToApi,
  invalidatePrefsCaches,
  tryAcquireDedup,
  resolveSeverity,
  ROUTINE_TYPES,
  TYPE_SEVERITY,
  SEVERITY_RANK,
  rowToObj,
  makeId,
};

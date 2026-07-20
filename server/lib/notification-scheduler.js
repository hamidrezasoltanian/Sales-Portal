'use strict';

/**
 * Server-side notification scheduler (Asia/Tehran).
 *
 * - Morning digest 08:00: one combined summary per expert (overdue + today + undated)
 * - Afternoon nudge 15:00: today items still open
 * - Weekly manager digest: Saturdays 09:00
 *
 * Digests go primarily to Telegram; bell only if user opted digest_bell.
 * Work items themselves live in inbox_items (cartable) — no duplicate spam.
 */

const { query } = require('../db');
const { todayJalaliStr } = require('./jalali-mini');
const { emitNotification } = require('./notification-engine');

const TZ = 'Asia/Tehran';
const _lastSlotKey = new Map();
let _timer = null;
let _running = false;

function getTehranParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date || new Date());
  const map = {};
  parts.forEach(function (p) { if (p.type !== 'literal') map[p.type] = p.value; });
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    weekday: map.weekday, // Mon, Tue, ... Sat, Sun
    dateKey: map.year + '-' + map.month + '-' + map.day,
  };
}

async function listActiveExperts() {
  try {
    const r = await query(
      `SELECT username, display_name, role FROM app_users
       WHERE active = TRUE
         AND role NOT IN ('مهمان', 'guest')
       ORDER BY username`
    );
    return r.rows;
  } catch (e) {
    console.warn('[notif-scheduler] listActiveExperts:', e.message);
    return [];
  }
}

async function countInboxBuckets(owner) {
  const today = todayJalaliStr();
  const r = await query(
    `SELECT
       COUNT(*) FILTER (WHERE due_at IS NOT NULL AND due_at != '' AND due_at < $2)::int AS overdue,
       COUNT(*) FILTER (WHERE due_at = $2)::int AS today,
       COUNT(*) FILTER (
         WHERE (due_at IS NULL OR due_at = '')
           AND source_type IN ('week', 'followup')
       )::int AS undated,
       COUNT(*)::int AS total
     FROM inbox_items
     WHERE active = TRUE
       AND owner = $1
       AND (snoozed_until IS NULL OR snoozed_until = '' OR snoozed_until <= $2)
       AND source_type NOT IN ('notification')`,
    [owner, today]
  );
  return r.rows[0] || { overdue: 0, today: 0, undated: 0, total: 0 };
}

function buildDigestMsg(name, counts, kind) {
  const parts = [];
  if (counts.overdue) parts.push(counts.overdue + ' معوق');
  if (counts.today) parts.push(counts.today + ' امروز');
  if (counts.undated) parts.push(counts.undated + ' بدون تاریخ');
  if (!parts.length) return null;
  const greeting = kind === 'afternoon'
    ? '📋 یادآوری بعدازظهر'
    : '🌅 خلاصه کارتابل امروز';
  return greeting + (name ? ' — ' + name : '') + ':\n'
    + parts.join(' · ')
    + '\n👉 کارتابل خانه را باز کنید.';
}

async function runMorningDigest() {
  const today = todayJalaliStr();
  const experts = await listActiveExperts();
  let sent = 0;
  for (const u of experts) {
    if (u.role === 'مدیر' || u.role === 'سوپر ادمین') continue;
    const counts = await countInboxBuckets(u.username);
    const msg = buildDigestMsg(u.display_name || u.username, counts, 'morning');
    if (!msg) continue;
    const result = await emitNotification({
      to: u.username,
      msg,
      type: 'digest',
      severity: counts.overdue > 0 ? 'medium' : 'low',
      bucket: 'digest_morning:' + today,
      dedupHours: 20,
      actionUrl: '/?tab=home&filter=overdue',
      meta: { kind: 'morning', counts, filter: counts.overdue ? 'overdue' : 'today' },
      // Prefer telegram; bell only if user digest_bell
      telegramOnly: false,
      autoSend: true,
    });
    if (result.ok && !result.skipped) sent++;
    else if (result.channels && result.channels.telegram) sent++;
  }
  return sent;
}

async function runAfternoonNudge() {
  const today = todayJalaliStr();
  const experts = await listActiveExperts();
  let sent = 0;
  for (const u of experts) {
    if (u.role === 'مدیر' || u.role === 'سوپر ادمین') continue;
    const counts = await countInboxBuckets(u.username);
    if (!counts.today && !counts.overdue) continue;
    const msg = buildDigestMsg(u.display_name || u.username, {
      overdue: counts.overdue,
      today: counts.today,
      undated: 0,
    }, 'afternoon');
    if (!msg) continue;
    const result = await emitNotification({
      to: u.username,
      msg,
      type: 'digest',
      severity: 'low',
      bucket: 'digest_afternoon:' + today,
      dedupHours: 12,
      actionUrl: '/?tab=home&filter=today',
      meta: { kind: 'afternoon', counts, filter: 'today' },
      autoSend: true,
    });
    if (result.ok && (result.notif || (result.channels && result.channels.telegram))) sent++;
  }
  return sent;
}

async function runWeeklyManagerDigest() {
  const today = todayJalaliStr();
  const managers = (await listActiveExperts()).filter(function (u) {
    return u.role === 'مدیر' || u.role === 'سوپر ادمین';
  });
  if (!managers.length) return 0;

  const experts = (await listActiveExperts()).filter(function (u) {
    return u.role !== 'مدیر' && u.role !== 'سوپر ادمین';
  });
  const lines = [];
  for (const u of experts) {
    const c = await countInboxBuckets(u.username);
    if (!c.overdue && !c.today) continue;
    lines.push((u.display_name || u.username) + ': '
      + (c.overdue ? '🔴 ' + c.overdue + ' معوق' : '')
      + (c.overdue && c.today ? '، ' : '')
      + (c.today ? c.today + ' امروز' : ''));
  }
  if (!lines.length) return 0;

  let msg = '📊 خلاصه هفتگی تیم ' + today + ':\n' + lines.join('\n');

  // Append server sales KPI scores for current Jalali month
  try {
    const salesKpi = require('./sales-kpi');
    const month = salesKpi.currentJMonth();
    const kpiLines = [];
    for (const u of experts) {
      try {
        const fin = await salesKpi.getFinalizedRow(u.username, month);
        const data = fin || await salesKpi.calcKPIs(u.username, month);
        const overall = fin ? fin.overall : data.overall;
        kpiLines.push((u.display_name || u.username) + ': ' + overall + '/100');
      } catch (_) {}
    }
    if (kpiLines.length) {
      msg += '\n\n📈 KPI فروش ' + month + ':\n' + kpiLines.join('\n');
    }
  } catch (e) {
    console.warn('[notif-scheduler] weekly KPI:', e.message);
  }

  let sent = 0;
  for (const m of managers) {
    const result = await emitNotification({
      to: m.username,
      msg,
      type: 'digest',
      severity: 'medium',
      bucket: 'digest_weekly:' + today,
      dedupHours: 6 * 24,
      forceBell: true,
      meta: { kind: 'weekly_manager' },
      autoSend: true,
    });
    // Weekly uses bucket with today for weekly uniqueness — override:
    if (result.skipped && result.reason === 'dedup') continue;
    if (result.ok) sent++;
  }
  // Fix weekly bucket to be week-based: re-emit with better bucket already uses month.
  // Use Saturday date as key — already today on Saturday.
  return sent;
}

async function tick() {
  if (_running) return;
  _running = true;
  try {
    const t = getTehranParts();
    // Morning 08:00–08:05
    if (t.hour === 8 && t.minute < 5) {
      const key = t.dateKey + '_morning';
      if (!_lastSlotKey.get(key)) {
        _lastSlotKey.set(key, true);
        const n = await runMorningDigest();
        console.log('[notif-scheduler] morning digest sent≈' + n);
      }
    }
    // Afternoon 15:00–15:05
    if (t.hour === 15 && t.minute < 5) {
      const key = t.dateKey + '_afternoon';
      if (!_lastSlotKey.get(key)) {
        _lastSlotKey.set(key, true);
        const n = await runAfternoonNudge();
        console.log('[notif-scheduler] afternoon nudge sent≈' + n);
      }
    }
    // Saturday (= Sat in en-GB) at 09:00 — weekly manager
    if (t.weekday === 'Sat' && t.hour === 9 && t.minute < 5) {
      const key = t.dateKey + '_weekly';
      if (!_lastSlotKey.get(key)) {
        _lastSlotKey.set(key, true);
        const n = await runWeeklyManagerDigest();
        console.log('[notif-scheduler] weekly manager digest sent≈' + n);
      }
    }
  } catch (e) {
    console.error('[notif-scheduler]', e.message);
  } finally {
    _running = false;
  }
}

function startNotificationScheduler() {
  if (process.env.NOTIF_SCHEDULER === '0') {
    console.log('[notif-scheduler] disabled (NOTIF_SCHEDULER=0)');
    return;
  }
  if (_timer) return;
  _timer = setInterval(tick, 60 * 1000);
  if (_timer.unref) _timer.unref();
  console.log('[notif-scheduler] started — morning 08:00, afternoon 15:00, weekly Sat 09:00 (' + TZ + ')');
}

module.exports = {
  startNotificationScheduler,
  tick,
  runMorningDigest,
  runAfternoonNudge,
  runWeeklyManagerDigest,
};

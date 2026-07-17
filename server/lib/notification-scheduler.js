'use strict';

const { query } = require('../db');
const { calcTodayJ } = require('./jalali-utils');
const digest = require('./digest-builder');

let _timer = null;
let _lastMorning = '';
let _lastAfternoon = '';
let _lastWeeklyKpi = '';
let _lastMonthly = '';
let _startupDone = false;

async function getCrmSetting(key) {
  try {
    const r = await query('SELECT value FROM app_settings WHERE key = $1', [key]);
    if (!r.rows.length) return null;
    const v = r.rows[0].value;
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch (e) {
    return null;
  }
}

async function setCrmSetting(key, value, by) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
    [key, JSON.stringify(value), by || 'scheduler']
  );
}

async function tick() {
  try {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const today = calcTodayJ();
    const dateKey = today;

    if (!_startupDone) {
      _startupDone = true;
      const last = await getCrmSetting('lastStartupReminder');
      if (last !== today) {
        await digest.runOverdueFollowupReminders(today);
        await digest.runNoFollowupDateReminders(today);
        await setCrmSetting('lastStartupReminder', today);
        console.log('[notif-scheduler] startup reminders for', today);
      }
    }

    if (h === 9 && m === 0 && _lastMorning !== dateKey) {
      _lastMorning = dateKey;
      const last = await getCrmSetting('lastMorningReminder');
      if (last !== today) {
        const n = await digest.runMorningBriefing(today);
        await setCrmSetting('lastMorningReminder', today);
        console.log('[notif-scheduler] morning briefing sent:', n);
      }
    }

    if (h === 15 && m === 0 && _lastAfternoon !== dateKey) {
      _lastAfternoon = dateKey;
      const last = await getCrmSetting('lastAfternoonReminder');
      if (last !== today) {
        const n = await digest.runAfternoonReminders(today);
        await setCrmSetting('lastAfternoonReminder', today);
        console.log('[notif-scheduler] afternoon reminders sent:', n);
      }
    }

    // دوشنبه ۹:۰۵ — KPI هفتگی in-app
    if (now.getDay() === 1 && h === 9 && m === 5 && _lastWeeklyKpi !== dateKey) {
      _lastWeeklyKpi = dateKey;
      const last = await getCrmSetting('lastWeeklyKpiDigest');
      if (last !== today) {
        const n = await digest.runWeeklyKpiDigest(today);
        await setCrmSetting('lastWeeklyKpiDigest', today);
        console.log('[notif-scheduler] weekly KPI digest:', n);
      }
    }

    // روز اول هر ماه شمسی — خلاصه ماهانه
    const jParts = today.split('/').map(Number);
    if (jParts[2] === 1 && h === 9 && m === 10 && _lastMonthly !== dateKey) {
      _lastMonthly = dateKey;
      const last = await getCrmSetting('lastMonthlyDigest');
      if (last !== today) {
        const n = await digest.runMonthlySummary(today);
        await setCrmSetting('lastMonthlyDigest', today);
        console.log('[notif-scheduler] monthly digest:', n);
      }
    }
  } catch (e) {
    console.error('[notif-scheduler] tick error:', e.message);
  }
}

function startNotificationScheduler() {
  if (_timer) return;
  console.log('[notif-scheduler] started');
  setTimeout(tick, 12000);
  _timer = setInterval(tick, 60000);
}

function stopNotificationScheduler() {
  if (_timer) clearInterval(_timer);
  _timer = null;
}

module.exports = { startNotificationScheduler, stopNotificationScheduler };

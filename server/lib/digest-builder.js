'use strict';

const { query } = require('../db');
const { calcTodayJ } = require('./jalali-utils');
const hub = require('./notification-hub');

async function getExpertsWithSessions() {
  try {
    const r = await query(
      `SELECT DISTINCT username FROM app_users WHERE active = true AND role NOT IN ('مهمان')`
    );
    return r.rows.map(function (row) { return row.username; });
  } catch (e) {
    return [];
  }
}

async function morningBriefingForExpert(username, today) {
  const r = await query(
    `SELECT COALESCE(center_name, value->>'centerName') AS cname
     FROM week_entries
     WHERE COALESCE(scheduled_date, value->>'scheduledDate') = $1
       AND (done IS NOT TRUE AND (value->>'done')::boolean IS NOT TRUE)
       AND COALESCE(added_by, value->>'addedBy') = $2
     ORDER BY COALESCE(center_name, value->>'centerName')
     LIMIT 20`,
    [today, username]
  );
  return r.rows.map(function (row) { return row.cname || '—'; });
}

async function runMorningBriefing(today) {
  today = today || calcTodayJ();
  const experts = await getExpertsWithSessions();
  let sent = 0;
  for (const exp of experts) {
    const items = await morningBriefingForExpert(exp, today);
    if (!items.length) continue;
    const msg = '🌅 برنامه امروز شما: ' + items.length + ' مرکز برای بازدید:\n• '
      + items.slice(0, 5).join('\n• ')
      + (items.length > 5 ? '\nو ' + (items.length - 5) + ' مورد دیگر' : '')
      + '\nروز خوبی داشته باشید! 💪';
    const res = await hub.createNotification({
      id: 'mb_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      type: 'morning_brief',
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

async function runAfternoonReminders(today) {
  today = today || calcTodayJ();
  const r = await query(
    `SELECT COALESCE(added_by, value->>'addedBy') AS expert,
            COALESCE(rtype, value->>'rtype') || '_' || COALESCE(rid, value->>'rid') AS center_key,
            COALESCE(center_name, value->>'centerName') AS cname
     FROM week_entries
     WHERE COALESCE(scheduled_date, value->>'scheduledDate') = $1
       AND (done IS NOT TRUE AND (value->>'done')::boolean IS NOT TRUE)
       AND COALESCE(added_by, value->>'addedBy') IS NOT NULL`,
    [today]
  );
  const byExpert = {};
  r.rows.forEach(function (row) {
    const exp = row.expert;
    if (!exp) return;
    if (!byExpert[exp]) byExpert[exp] = [];
    byExpert[exp].push({ name: row.cname || '—', key: row.center_key });
  });

  let sent = 0;
  for (const exp of Object.keys(byExpert)) {
    const items = byExpert[exp];
    if (!items.length) continue;
    const msg = '📋 برنامه امروز: ' + items.length + ' مرکز برای بازدید دارید:\n• '
      + items.slice(0, 5).map(function (x) { return x.name; }).join('\n• ')
      + (items.length > 5 ? '\nو ' + (items.length - 5) + ' مورد دیگر' : '')
      + '\nوارد برنامه هفته شوید.';
    const res = await hub.createNotification({
      id: 'ar_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      centerKey: items[0].key,
      centerKeys: items.map(function (x) { return x.key; }),
      type: 'followup',
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

async function runOverdueFollowupReminders(today) {
  today = today || calcTodayJ();
  const r = await query(
    `SELECT COALESCE(data->>'owner', '') AS owner,
            center_key,
            COALESCE(data->>'nameOverride', '') AS name_override,
            data->>'followupDate' AS fd
     FROM center_edits
     WHERE (data->>'followupDate') IS NOT NULL
       AND (data->>'followupDate') < $1
       AND COALESCE(data->>'status', '') NOT IN ('lost','inactive','غیرفعال','قرارداد بسته شد')
       AND COALESCE(data->>'owner', '') <> ''`,
    [today]
  );

  const byExpert = {};
  r.rows.forEach(function (row) {
    const exp = row.owner;
    if (!byExpert[exp]) byExpert[exp] = [];
    byExpert[exp].push({
      key: row.center_key,
      name: row.name_override || row.center_key,
      date: row.fd,
    });
  });

  let sent = 0;
  for (const exp of Object.keys(byExpert)) {
    const items = byExpert[exp];
    const msg = '⚠️ ' + items.length + ' مرکز معوق پیگیری:\n• '
      + items.slice(0, 5).map(function (x) { return x.name + ' (' + x.date + ')'; }).join('\n• ')
      + (items.length > 5 ? '\nو ' + (items.length - 5) + ' مورد دیگر' : '')
      + '\nلطفاً پیگیری کنید.';
    const res = await hub.createNotification({
      id: 'od_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      centerKey: items[0].key,
      centerKeys: items.map(function (x) { return x.key; }),
      type: 'followup',
      priority: 1,
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

async function runNoFollowupDateReminders(today) {
  today = today || calcTodayJ();
  const r = await query(
    `SELECT COALESCE(data->>'owner', '') AS owner, center_key,
            COALESCE(data->>'nameOverride', '') AS name_override
     FROM center_edits
     WHERE (data->>'followupDate') IS NULL OR (data->>'followupDate') = ''
       AND COALESCE(data->>'status', '') NOT IN ('lost','inactive','غیرفعال','قرارداد بسته شد','قرارداد بسته شد')
       AND COALESCE(data->>'owner', '') <> ''`
  );

  const byExpert = {};
  r.rows.forEach(function (row) {
    const exp = row.owner;
    if (!byExpert[exp]) byExpert[exp] = [];
    byExpert[exp].push({ key: row.center_key, name: row.name_override || row.center_key });
  });

  let sent = 0;
  for (const exp of Object.keys(byExpert)) {
    const items = byExpert[exp];
    if (items.length > 10) items.length = 10;
    const msg = '📅 ' + items.length + ' مرکز بدون تاریخ پیگیری:\n• '
      + items.slice(0, 5).map(function (x) { return x.name; }).join('\n• ')
      + (items.length > 5 ? '\nو ' + (items.length - 5) + ' مورد دیگر' : '')
      + '\nبرای هر مرکز تاریخ تنظیم کنید.';
    const res = await hub.createNotification({
      id: 'nd_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      centerKey: items[0].key,
      centerKeys: items.map(function (x) { return x.key; }),
      type: 'followup',
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

async function expertWeeklyStats(username) {
  const weekStart = calcTodayJ(); // simplified — use 7-day window from SQL
  const today = calcTodayJ();
  const [calls, visits, done, overdue] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(count),0)::int AS c FROM call_log
       WHERE username = $1 AND updated_at >= NOW() - INTERVAL '7 days'`,
      [username]
    ).catch(function () { return { rows: [{ c: 0 }] }; }),
    query(
      `SELECT COALESCE(SUM(count),0)::int AS c FROM visit_log
       WHERE username = $1 AND updated_at >= NOW() - INTERVAL '7 days'`,
      [username]
    ).catch(function () { return { rows: [{ c: 0 }] }; }),
    query(
      `SELECT COUNT(*)::int AS c FROM week_entries
       WHERE COALESCE(added_by, value->>'addedBy') = $1
         AND (done = true OR (value->>'done')::boolean = true)
         AND COALESCE(done_date, value->>'doneDate') >= $2`,
      [username, weekStart]
    ).catch(function () { return { rows: [{ c: 0 }] }; }),
    query(
      `SELECT COUNT(*)::int AS c FROM center_edits
       WHERE data->>'owner' = $1 AND (data->>'followupDate') < $2
         AND COALESCE(data->>'status','') NOT IN ('lost','inactive','غیرفعال','قرارداد بسته شد')`,
      [username, today]
    ).catch(function () { return { rows: [{ c: 0 }] }; }),
  ]);
  return {
    calls: calls.rows[0].c || 0,
    visits: visits.rows[0].c || 0,
    done: done.rows[0].c || 0,
    overdue: overdue.rows[0].c || 0,
  };
}

async function runWeeklyKpiDigest(today) {
  today = today || calcTodayJ();
  const experts = await getExpertsWithSessions();
  let sent = 0;
  for (const exp of experts) {
    const s = await expertWeeklyStats(exp);
    const msg = '📈 خلاصه هفتگی شما: 📞' + s.calls + ' تماس | 🤝' + s.visits + ' ملاقات | ✅' + s.done + ' انجام'
      + (s.overdue ? ' | ⚠️' + s.overdue + ' معوق' : '');
    const res = await hub.createNotification({
      id: 'wk_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      type: 'general',
      meta: { digest: 'weekly_kpi' },
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

async function runMonthlySummary(today) {
  today = today || calcTodayJ();
  const experts = await getExpertsWithSessions();
  let sent = 0;
  for (const exp of experts) {
    const [sales, tasks] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(count),0)::int AS c FROM sales_log
         WHERE username = $1 AND updated_at >= NOW() - INTERVAL '30 days'`,
        [exp]
      ).catch(function () { return { rows: [{ c: 0 }] }; }),
      query(
        `SELECT COUNT(*)::int AS c FROM tasks
         WHERE owner = $1 AND (done = true OR status = 'done')
           AND updated_at >= NOW() - INTERVAL '30 days'`,
        [exp]
      ).catch(function () { return { rows: [{ c: 0 }] }; }),
    ]);
    const msg = '📊 خلاصه ماهانه: 💰' + (sales.rows[0].c || 0) + ' فروش ثبت‌شده | 📌' + (tasks.rows[0].c || 0) + ' وظیفه انجام‌شده';
    const res = await hub.createNotification({
      id: 'mo_' + today.replace(/\//g, '') + '_' + exp,
      to: exp,
      msg,
      type: 'general',
      meta: { digest: 'monthly' },
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}

module.exports = {
  runMorningBriefing,
  runAfternoonReminders,
  runOverdueFollowupReminders,
  runNoFollowupDateReminders,
  runWeeklyKpiDigest,
  runMonthlySummary,
  morningBriefingForExpert,
  getExpertsWithSessions,
  expertWeeklyStats,
};

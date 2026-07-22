'use strict';

/**
 * Server-side sales KPI (SoT). Client must display only — never recompute for money.
 *
 * Conversion / sales amount SoT:
 *   1) Paid invoices attributed to user (commission_owner) for the Jalali month
 *   2) Else sales_log only
 *   Never add center status «قرارداد بسته شد» on top (no double-count).
 *
 * Score cap: intentional 100% — overperformance does not inflate score
 * (quality over quantity). Documented product decision Jul 2026.
 */

const { query } = require('../db');
const { p2, g2j, todayJalaliStr } = require('./jalali-mini');

const DEFAULT_WEIGHTS = {
  conversion: 20,
  retention: 20,
  visits: 15,
  calls: 15,
  sales: 15,
  mission: 5,
  cash: 10,
};

const DEFAULT_TARGETS = {
  callsPerDay: 10,
  visitsPerWeek: 5,
  salesCount: 5,
  salesAmount: 0,
  cashPct: 50,
  retentionTarget: 90,
};

/** Intentional product policy: no overperformance bonus above 100%. */
const SCORE_CAP = 100;
const ALLOW_OVERPERFORMANCE_BONUS = false;

function currentJMonth() {
  const t = todayJalaliStr();
  return t.slice(0, 7);
}

function jMonthBounds(month) {
  const pts = String(month || '').split('/');
  const jy = parseInt(pts[0], 10);
  const jm = parseInt(pts[1], 10);
  if (!jy || !jm) return null;
  const lastDay = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
  return {
    start: jy + '/' + p2(jm) + '/01',
    end: jy + '/' + p2(jm) + '/' + p2(lastDay),
    jy,
    jm,
    lastDay,
  };
}

function workingDaysInJMonth(month) {
  const pts = String(month || '').split('/');
  const jm = parseInt(pts[1], 10);
  if (jm <= 6) return 26;
  if (jm <= 11) return 25;
  return 24;
}

function prevJMonth(month) {
  const pts = String(month).split('/');
  let jy = parseInt(pts[0], 10);
  let jm = parseInt(pts[1], 10) - 1;
  if (jm < 1) {
    jm = 12;
    jy -= 1;
  }
  return jy + '/' + p2(jm);
}

function scoreRatio(actual, target) {
  if (!(target > 0)) return 0;
  const raw = (actual / target) * 100;
  if (ALLOW_OVERPERFORMANCE_BONUS) return Math.min(raw, 150);
  return Math.min(raw, SCORE_CAP);
}

async function getActiveWeights(asOfMonth) {
  // Effective-dated: latest version with effective_from <= month end (or month key)
  try {
    const r = await query(
      `SELECT weights, effective_from, id FROM kpi_weight_versions
       WHERE effective_from <= $1
       ORDER BY effective_from DESC, id DESC LIMIT 1`,
      [asOfMonth || currentJMonth()]
    );
    if (r.rows.length) {
      const w = r.rows[0].weights || {};
      return {
        weights: Object.assign({}, DEFAULT_WEIGHTS, w),
        versionId: r.rows[0].id,
        effectiveFrom: r.rows[0].effective_from,
      };
    }
  } catch (_) {}
  // Legacy fallback: app_settings.kpi_weights
  try {
    const s = await query(`SELECT value FROM app_settings WHERE key = 'kpi_weights' LIMIT 1`);
    if (s.rows.length && s.rows[0].value) {
      const v = typeof s.rows[0].value === 'string' ? JSON.parse(s.rows[0].value) : s.rows[0].value;
      return { weights: Object.assign({}, DEFAULT_WEIGHTS, v), versionId: null, effectiveFrom: null };
    }
  } catch (_) {}
  return { weights: Object.assign({}, DEFAULT_WEIGHTS), versionId: null, effectiveFrom: null };
}

async function getUserTargets(username, month) {
  const r = await query(
    `SELECT calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct, retention_target, region_key
     FROM kpi_user_targets WHERE username = $1 AND month = $2`,
    [username, month]
  );
  if (!r.rows.length) return Object.assign({}, DEFAULT_TARGETS);
  const row = r.rows[0];
  return {
    callsPerDay: row.calls_per_day != null ? row.calls_per_day : DEFAULT_TARGETS.callsPerDay,
    visitsPerWeek: row.visits_per_week != null ? row.visits_per_week : DEFAULT_TARGETS.visitsPerWeek,
    salesCount: row.sales_count != null ? row.sales_count : DEFAULT_TARGETS.salesCount,
    salesAmount: Number(row.sales_amount) || 0,
    cashPct: row.cash_pct != null ? row.cash_pct : DEFAULT_TARGETS.cashPct,
    retentionTarget: row.retention_target != null ? row.retention_target : DEFAULT_TARGETS.retentionTarget,
    regionKey: row.region_key || null,
  };
}

async function getRegionRetentionOverride(regionKey) {
  if (!regionKey) return null;
  try {
    const r = await query(
      `SELECT retention_target FROM kpi_region_targets WHERE region_key = $1`,
      [regionKey]
    );
    if (r.rows.length && r.rows[0].retention_target != null) {
      return parseFloat(r.rows[0].retention_target);
    }
  } catch (_) {}
  return null;
}

async function getPaidInvoiceSales(username, month) {
  const r = await query(
    `SELECT i.id, i.total, i.jalali_date
     FROM invoices i
     WHERE i.status = 'paid' AND i.jalali_date LIKE $2
       AND COALESCE(NULLIF(TRIM(i.commission_owner), ''), i.created_by) = $1`,
    [username, month + '%']
  );
  const lines = r.rows;
  return {
    count: lines.length,
    amount: lines.reduce(function (s, x) { return s + (parseFloat(x.total) || 0); }, 0),
  };
}

async function getSalesLogMonth(username, bounds) {
  const r = await query(
    `SELECT amount, is_cash FROM sales_log
     WHERE username = $1 AND date >= $2 AND date <= $3`,
    [username, bounds.start, bounds.end]
  );
  const rows = r.rows;
  const cashCnt = rows.filter(function (x) { return x.is_cash; }).length;
  return {
    count: rows.length,
    amount: rows.reduce(function (s, x) { return s + (parseFloat(x.amount) || 0); }, 0),
    cashPct: rows.length ? (cashCnt / rows.length) * 100 : 0,
  };
}

/**
 * Conversion + sales amount: paid invoices first; else sales_log.
 * Never merges both and never adds center-status deals.
 */
async function getConversionSales(username, bounds, month) {
  const inv = await getPaidInvoiceSales(username, month);
  if (inv.count > 0) {
    return {
      salesCount: inv.count,
      salesAmount: inv.amount,
      cashPct: null,
      source: 'paid_invoices',
    };
  }
  const log = await getSalesLogMonth(username, bounds);
  return {
    salesCount: log.count,
    salesAmount: log.amount,
    cashPct: log.cashPct,
    source: 'sales_log',
  };
}

/**
 * Counts only completed, attributable work for the selected Jalali month.
 *
 * Primary source is the activity log, which is written under the username of
 * the person who actually submits the outcome. A week-plan card is not work
 * by itself and an unfinished card therefore has no KPI effect.
 *
 * For legacy completed cards created before the interaction audit trail, keep
 * a compatibility fallback. It is used only when no interaction is linked to
 * the card; its attribution can only be the old card creator (added_by).
 * A same-day manual log by that legacy creator consumes one fallback unit.
 */
async function getActivityMonthData(username, bounds, kind) {
  const isVisit = kind === 'visit';
  const logTable = isVisit ? 'visit_log' : 'call_log';
  const actionWhere = isVisit
    ? "we.action_type IN ('visit', 'meeting', 'committee')"
    : "COALESCE(we.action_type, 'call') NOT IN ('visit', 'meeting', 'committee')";
  const results = await Promise.all([
    query(
      'SELECT date, count FROM ' + logTable + ' ' +
      'WHERE username = $1 AND date >= $2 AND date <= $3',
      [username, bounds.start, bounds.end]
    ),
    query(
      'SELECT we.id, we.done_date, we.scheduled_date, we.week_id ' +
      'FROM week_entries we ' +
      'WHERE we.added_by = $1 AND we.done = true AND ' + actionWhere + ' ' +
      "AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) >= $2 " +
      "AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) <= $3 " +
      "AND NOT EXISTS (SELECT 1 FROM center_interactions ci WHERE ci.week_entry_id = we.id AND ci.mode = 'done')",
      [username, bounds.start, bounds.end]
    ),
  ]);
  const manualByDate = {};
  let manualTotal = 0;
  results[0].rows.forEach(function (row) {
    const n = parseInt(row.count, 10) || 1;
    manualTotal += n;
    manualByDate[row.date] = (manualByDate[row.date] || 0) + n;
  });
  let legacyCompletedTotal = 0;
  results[1].rows.forEach(function (row) {
    const completionDate = row.done_date || row.scheduled_date || row.week_id || '';
    // Old fallback clients could create a manual log but had no interaction ID.
    // Never let that one physical activity become two KPI units.
    if (completionDate && manualByDate[completionDate] > 0) {
      manualByDate[completionDate] -= 1;
      return;
    }
    legacyCompletedTotal += 1;
  });
  return {
    total: manualTotal + legacyCompletedTotal,
    manualTotal,
    legacyCompletedTotal,
    // Keep this alias for existing clients while making its meaning explicit.
    weeklyTotal: legacyCompletedTotal,
    weeklyCompleted: legacyCompletedTotal,
    weeklyScheduled: 0,
  };
}

async function getCallsMonthData(username, bounds) {
  return getActivityMonthData(username, bounds, 'call');
}

async function getVisitsMonthData(username, bounds) {
  return getActivityMonthData(username, bounds, 'visit');
}

async function getMissionMonth(username, month) {
  const r = await query(
    `SELECT done, note FROM mission_log WHERE username = $1 AND month = $2 LIMIT 1`,
    [username, month]
  );
  if (!r.rows.length) return null;
  return { done: !!r.rows[0].done, note: r.rows[0].note || '' };
}

/**
 * Rolling three-month customer retention.
 * A customer center is retained when it has at least one official issued
 * invoice in the three Jalali months ending in `month`. Invoice ownership is
 * resolved through the center's current owner, never commission attribution.
 */
async function getRetentionData(username, month) {
  const bounds = jMonthBounds(month);
  const startMonth = prevJMonth(prevJMonth(month));
  const windowStart = startMonth + '/01';
  const r = await query(
    `WITH customer_centers AS (
       SELECT center_key
       FROM center_edits
       WHERE COALESCE(data->>'owner','') = $1
         AND COALESCE(data->>'lead','') = 'مشتری'
     ), purchases AS (
       SELECT DISTINCT center_key
       FROM invoices
       WHERE status = 'issued'
         AND COALESCE(center_key, '') <> ''
         AND jalali_date >= $2 AND jalali_date <= $3
     )
     SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM purchases p WHERE p.center_key = c.center_key
            ))::int AS retained
     FROM customer_centers c`,
    [username, windowStart, bounds.end]
  );
  const total = r.rows[0] ? r.rows[0].total : 0;
  const retained = r.rows[0] ? r.rows[0].retained : 0;
  return {
    retained,
    total,
    pct: total > 0 ? Math.round((retained / total) * 100) : 0,
    windowStart,
    windowEnd: bounds.end,
  };
}

/** Touchpoint fallback when call_log empty: distinct centers touched this month via change_log. */
async function getAutoCallTouchpoints(username, bounds) {
  try {
    // change_log.at is ISO Gregorian; filter by converting bounds roughly via date prefix on Jalali... 
    // Use updated month window: rows where by=user and at in calendar range of Jalali month.
    const { j2g } = require('./jalali-mini');
    const pts = bounds.start.split('/').map(Number);
    const pte = bounds.end.split('/').map(Number);
    const gs = j2g(pts[0], pts[1], pts[2]);
    const ge = j2g(pte[0], pte[1], pte[2]);
    const startIso = new Date(gs[0], gs[1] - 1, gs[2], 0, 0, 0).toISOString();
    const endIso = new Date(ge[0], ge[1] - 1, ge[2], 23, 59, 59).toISOString();
    const r = await query(
      `SELECT COUNT(DISTINCT rkey)::int AS n FROM change_log
       WHERE "by" = $1 AND at >= $2 AND at <= $3`,
      [username, startIso, endIso]
    );
    return (r.rows[0] && r.rows[0].n) || 0;
  } catch (e) {
    console.warn('[sales-kpi] auto touchpoints:', e.message);
    return 0;
  }
}

function dayElapsedInMonth(bounds, wd) {
  const today = todayJalaliStr();
  if (today < bounds.start) return 0;
  if (today > bounds.end) return wd;
  // Approximate: day-of-month * (wd / lastDay)
  const day = parseInt(today.split('/')[2], 10) || 1;
  return Math.min(wd, Math.max(1, Math.round((day / bounds.lastDay) * wd)));
}

async function calcKPIs(username, month) {
  month = month || currentJMonth();
  const bounds = jMonthBounds(month);
  if (!bounds) throw new Error('ماه نامعتبر');

  const [weightInfo, targets, conv, callsData, visitsData, mission, retention] = await Promise.all([
    getActiveWeights(month),
    getUserTargets(username, month),
    getConversionSales(username, bounds, month),
    getCallsMonthData(username, bounds),
    getVisitsMonthData(username, bounds),
    getMissionMonth(username, month),
    getRetentionData(username, month),
  ]);
  const visitsTotal = visitsData.total;

  let retentionTarget = targets.retentionTarget;
  const regionOverride = await getRegionRetentionOverride(targets.regionKey);
  if (regionOverride != null) retentionTarget = regionOverride;

  const wd = workingDaysInJMonth(month);
  // Only completed work in the selected month counts. A planned/future card has no KPI effect.
  // change_log touchpoints are deliberately excluded from the KPI.
  const totalCalls = callsData.total;
  const callsAutoMode = false;

  const avgCalls = wd > 0 ? totalCalls / wd : 0;
  const avgVisits = visitsTotal / 4.3;
  const cashPct = conv.cashPct != null ? conv.cashPct : 0;

  const _w = weightInfo.weights;
  const s1 = scoreRatio(conv.salesCount, targets.salesCount);
  const s2 = scoreRatio(retention.pct, retentionTarget);
  const s3 = scoreRatio(avgVisits, targets.visitsPerWeek);
  const s4 = scoreRatio(avgCalls, targets.callsPerDay);
  const s5 = targets.salesAmount > 0
    ? scoreRatio(conv.salesAmount, targets.salesAmount)
    : scoreRatio(conv.salesCount, targets.salesCount);
  const s6 = mission && mission.done ? SCORE_CAP : 0;
  const s7 = conv.source === 'sales_log' && conv.salesCount > 0
    ? scoreRatio(cashPct, targets.cashPct)
    : 0;

  const kpis = [
    {
      id: 'conversion', name: 'نرخ تبدیل لید', icon: '🔄', weight: _w.conversion, score: s1,
      actual: conv.salesCount, target: targets.salesCount, unit: 'قرارداد',
      tip: conv.source === 'paid_invoices'
        ? 'فاکتورهای پرداخت‌شده (بدون double-count با وضعیت مرکز)'
        : 'از sales_log (فاکتور paid نداشت)',
      auto: true, source: conv.source,
    },
    {
      id: 'retention', name: 'نرخ حفظ مشتری', icon: '🤝', weight: _w.retention, score: s2,
      actual: retention.pct, target: retentionTarget, unit: 'درصد',
      tip: retention.retained + ' مرکزِ خریدکرده از ' + retention.total + ' مرکز مشتری'
        + ' · بازه ' + retention.windowStart + ' تا ' + retention.windowEnd
        + (targets.regionKey ? ' · منطقه ' + targets.regionKey : ''),
      auto: true,
    },
    {
      id: 'visits', name: 'ویزیت حضوری هفتگی', icon: '🚗', weight: _w.visits, score: s3,
      actual: Math.round(avgVisits * 10) / 10, target: targets.visitsPerWeek, unit: 'ویزیت/هفته',
      tip: 'این ماه: ' + visitsTotal + ' ویزیت (ثبت دستی: ' + visitsData.manualTotal
        + ' · کارت تکمیل‌شدهٔ قدیمی: ' + visitsData.legacyCompletedTotal + ')', auto: true,
    },
    {
      id: 'calls', name: 'تماس روزانه', icon: '📞', weight: _w.calls, score: s4,
      actual: Math.round(avgCalls * 10) / 10, target: targets.callsPerDay, unit: 'تماس/روز',
      tip: 'مجموع ' + totalCalls + ' در ' + wd + ' روز کاری (ثبت دستی: ' + callsData.manualTotal
        + ' · کارت تکمیل‌شدهٔ قدیمی: ' + callsData.legacyCompletedTotal + ')',
      auto: false,
    },
    {
      id: 'sales', name: 'تارگت فروش', icon: '💰', weight: _w.sales, score: s5,
      actual: targets.salesAmount > 0 ? conv.salesAmount : conv.salesCount,
      target: targets.salesAmount > 0 ? targets.salesAmount : targets.salesCount,
      unit: targets.salesAmount > 0 ? 'ریال' : 'قرارداد',
      tip: 'منبع: ' + conv.source, auto: false, source: conv.source,
    },
    {
      id: 'mission', name: 'ماموریت ماهانه', icon: '✈️', weight: _w.mission, score: s6,
      actual: s6 ? 1 : 0, target: 1, unit: '', binary: true,
      tip: mission ? (mission.done ? 'انجام شد' : 'برنامه‌ریزی') : 'ثبت نشده', auto: false,
    },
    {
      id: 'cash', name: 'فروش نقدی', icon: '💵', weight: _w.cash, score: s7,
      actual: Math.round(cashPct), target: targets.cashPct, unit: 'درصد',
      tip: conv.source === 'paid_invoices'
        ? 'برای فاکتور paid فعلاً محاسبه نمی‌شود'
        : Math.round(cashPct) + '% از sales_log',
      auto: false,
    },
  ];

  const overall = Math.round(
    kpis.reduce(function (s, k) { return s + k.score * (k.weight / 100); }, 0)
  );

  const dayElapsed = dayElapsedInMonth(bounds, wd);
  const forecast = {};
  if (dayElapsed > 0) {
    kpis.forEach(function (k) {
      forecast[k.id] = Math.min((k.score / dayElapsed) * wd, 150);
    });
    forecast.overall = Math.min((overall / dayElapsed) * wd, 150);
  }

  return {
    kpis,
    overall,
    userId: username,
    month,
    targets,
    dayElapsed,
    dayTotal: wd,
    forecast,
    callsAutoMode,
    conversionSource: conv.source,
    visitBreakdown: visitsData,
    callBreakdown: callsData,
    weightVersionId: weightInfo.versionId,
    weightEffectiveFrom: weightInfo.effectiveFrom,
    scoreCap: SCORE_CAP,
    allowOverperformanceBonus: ALLOW_OVERPERFORMANCE_BONUS,
    computedAt: new Date().toISOString(),
    server: true,
  };
}

async function logKpiConfigAudit(actor, field, oldValue, newValue, note) {
  try {
    await query(
      `INSERT INTO kpi_config_audit (actor, field, old_value, new_value, note)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        actor || '',
        field,
        JSON.stringify(oldValue == null ? null : oldValue),
        JSON.stringify(newValue == null ? null : newValue),
        note || null,
      ]
    );
  } catch (e) {
    console.warn('[sales-kpi] audit:', e.message);
  }
}

async function upsertWeightVersion(weights, effectiveFrom, actor) {
  const from = effectiveFrom || currentJMonth();
  const prev = await getActiveWeights(from);
  const r = await query(
    `INSERT INTO kpi_weight_versions (weights, effective_from, created_by)
     VALUES ($1::jsonb, $2, $3) RETURNING id`,
    [JSON.stringify(Object.assign({}, DEFAULT_WEIGHTS, weights || {})), from, actor || null]
  );
  await logKpiConfigAudit(actor, 'weights', prev.weights, weights, 'effective_from=' + from);
  // Keep legacy key in sync for old clients
  try {
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ('kpi_weights', $1::jsonb, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(Object.assign({}, DEFAULT_WEIGHTS, weights || {})), actor || null]
    );
  } catch (_) {}
  return r.rows[0];
}

async function finalizeMonth(username, month, opts) {
  opts = opts || {};
  const data = await calcKPIs(username, month);
  const scores = {};
  data.kpis.forEach(function (k) { scores[k.id] = Math.round(k.score); });

  await query(
    `INSERT INTO sales_kpi_monthly (
       username, month, overall, scores, targets, weights_version_id,
       conversion_source, finalized, finalized_at, finalized_by, data, updated_at
     ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,TRUE,NOW(),$8,$9::jsonb,NOW())
     ON CONFLICT (username, month) DO UPDATE SET
       overall = EXCLUDED.overall,
       scores = EXCLUDED.scores,
       targets = EXCLUDED.targets,
       weights_version_id = EXCLUDED.weights_version_id,
       conversion_source = EXCLUDED.conversion_source,
       finalized = TRUE,
       finalized_at = NOW(),
       finalized_by = EXCLUDED.finalized_by,
       data = EXCLUDED.data,
       updated_at = NOW()
     WHERE sales_kpi_monthly.finalized = FALSE OR $10 = TRUE`,
    [
      username,
      month,
      data.overall,
      JSON.stringify(scores),
      JSON.stringify(data.targets),
      data.weightVersionId,
      data.conversionSource,
      opts.by || 'system',
      JSON.stringify(data),
      !!opts.force,
    ]
  );

  // Mirror into kpi_history for trend chart compatibility
  const snap = {
    userId: username,
    month,
    overall: data.overall,
    savedAt: new Date().toISOString(),
    scores,
    server: true,
    conversionSource: data.conversionSource,
  };
  await query(
    `INSERT INTO kpi_history (username, month, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (username, month) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [username, month, JSON.stringify(snap)]
  );

  return data;
}

async function getFinalizedRow(username, month) {
  const r = await query(
    `SELECT * FROM sales_kpi_monthly WHERE username = $1 AND month = $2 AND finalized = TRUE`,
    [username, month]
  );
  return r.rows[0] || null;
}

async function finalizeAllActiveExperts(month, opts) {
  month = month || prevJMonth(currentJMonth());
  const users = await query(
    `SELECT username FROM app_users
     WHERE active = TRUE AND role IN ('کارشناس فروش', 'مدیر', 'سوپر ادمین')
       AND username <> 'guest'`
  );
  const results = [];
  for (const u of users.rows) {
    try {
      const d = await finalizeMonth(u.username, month, opts);
      results.push({ username: u.username, ok: true, overall: d.overall });
    } catch (e) {
      results.push({ username: u.username, ok: false, error: e.message });
    }
  }
  return { month, results };
}

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_TARGETS,
  SCORE_CAP,
  ALLOW_OVERPERFORMANCE_BONUS,
  currentJMonth,
  jMonthBounds,
  prevJMonth,
  calcKPIs,
  getActiveWeights,
  upsertWeightVersion,
  logKpiConfigAudit,
  finalizeMonth,
  finalizeAllActiveExperts,
  getFinalizedRow,
  getRetentionData,
};

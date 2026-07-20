'use strict';

/**
 * Finalize previous Jalali month sales KPI for all experts.
 * Runs daily at 01:15 Asia/Tehran; idempotent (skips already finalized unless forced).
 */

const salesKpi = require('./sales-kpi');

const TZ = 'Asia/Tehran';
const _lastSlotKey = new Map();
let _timer = null;

function getTehranParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date || new Date());
  const map = {};
  parts.forEach(function (p) { if (p.type !== 'literal') map[p.type] = p.value; });
  return {
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    dateKey: map.year + '-' + map.month + '-' + map.day,
  };
}

async function tick() {
  if (process.env.SALES_KPI_SCHEDULER === '0') return;
  const t = getTehranParts();
  // 01:15 Tehran — finalize previous month (safe after month rollover)
  if (t.hour !== 1 || t.minute < 15 || t.minute > 16) return;
  const slot = t.dateKey + '_sales_kpi_finalize';
  if (_lastSlotKey.get('finalize') === slot) return;
  _lastSlotKey.set('finalize', slot);

  try {
    const month = salesKpi.prevJMonth(salesKpi.currentJMonth());
    console.log('[sales-kpi-scheduler] finalizing month', month);
    const out = await salesKpi.finalizeAllActiveExperts(month, { by: 'cron' });
    const ok = out.results.filter(function (r) { return r.ok; }).length;
    console.log('[sales-kpi-scheduler] done', month, ok + '/' + out.results.length);
  } catch (e) {
    console.error('[sales-kpi-scheduler]', e.message);
  }
}

function startSalesKpiScheduler() {
  if (process.env.SALES_KPI_SCHEDULER === '0') {
    console.log('[sales-kpi-scheduler] disabled');
    return;
  }
  if (_timer) return;
  _timer = setInterval(tick, 60 * 1000);
  console.log('[sales-kpi-scheduler] started (01:15 Tehran, prev Jalali month)');
}

module.exports = { startSalesKpiScheduler, tick };

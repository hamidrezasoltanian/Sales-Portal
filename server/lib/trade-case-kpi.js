'use strict';
/**
 * Sync trade_cases step completion → trade_kpi tables (phase 4 bridge).
 */
const { query } = require('../db');
const { dateToJalali } = require('./wms-jalali');

function uid(prefix) {
  return (prefix || 'tk') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function detectIndicator(stepTitle, stepMeta) {
  if (stepMeta && stepMeta.kpiIndicator) return stepMeta.kpiIndicator;
  const t = String(stepTitle || '').toLowerCase();
  if (/ترخیص|گمرک|customs|clearance/.test(t)) return 'customs';
  if (/تامین|سورس|supplier|source/.test(t)) return 'supplier';
  if (/مالی|finance|cost|هزینه/.test(t)) return 'finance';
  if (/گزارش|report|روزانه/.test(t)) return 'report';
  return null;
}

function findStep(template, stepId) {
  if (!template || !Array.isArray(template.steps)) return null;
  return template.steps.find((s) => s.id === stepId) || null;
}

function fieldVal(data, names) {
  if (!data) return '';
  for (const n of names) {
    if (data[n] != null && data[n] !== '') return String(data[n]);
  }
  return '';
}

async function syncClearance(employee, month, caseRow, stepData) {
  const data = stepData.data || {};
  const title = fieldVal(data, ['title', 'عنوان', 'محموله']) || caseRow.title;
  const start = fieldVal(data, ['start_date', 'startDate', 'تاریخ_شروع', 'تاریخ شروع']) || dateToJalali(new Date()).slice(0, 10);
  const existing = await query(
    'SELECT id FROM trade_clearances WHERE employee=$1 AND jalali_month=$2 AND title=$3 LIMIT 1',
    [employee, month, title]
  );
  if (existing.rows.length) {
    await query(
      `UPDATE trade_clearances SET start_date=$2, status='completed', end_date=$3, actual_days=$4
       WHERE id=$1`,
      [existing.rows[0].id, start, dateToJalali(new Date()).slice(0, 10), null]
    );
    return;
  }
  await query(
    `INSERT INTO trade_clearances (id, employee, jalali_month, title, start_date, end_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,'completed')`,
    [uid('tcl'), employee, month, title, start, dateToJalali(new Date()).slice(0, 10)]
  );
}

async function syncSupplier(employee, month, caseRow, stepData) {
  const data = stepData.data || {};
  const name = fieldVal(data, ['company_name', 'companyName', 'نام', 'تامین‌کننده', 'برند']);
  if (!name) return;
  const existing = await query(
    'SELECT id FROM trade_suppliers_new WHERE employee=$1 AND jalali_month=$2 AND company_name=$3 LIMIT 1',
    [employee, month, name]
  );
  if (existing.rows.length) return;
  await query(
    `INSERT INTO trade_suppliers_new (id, employee, jalali_month, company_name, country, product_category, approved_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      uid('tsn'),
      employee,
      month,
      name,
      fieldVal(data, ['country', 'کشور']) || '',
      fieldVal(data, ['product_category', 'category', 'حوزه']) || '',
      'auto_case_sync',
    ]
  );
}

async function syncFinance(employee, month, caseRow, stepData) {
  const data = stepData.data || {};
  const title = fieldVal(data, ['title', 'عنوان']) || caseRow.title;
  const amount = parseFloat(fieldVal(data, ['amount', 'مبلغ', 'value']) || '0') || 0;
  if (!amount) return;
  await query(
    `INSERT INTO trade_finance_items (id, employee, jalali_month, title, type, amount, verified_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid('tfi'), employee, month, title, 'cost_reduction', amount, 'auto_case_sync']
  );
}

async function syncDailyReport(employee, month, stepData) {
  const data = stepData.data || {};
  const summary = fieldVal(data, ['summary', 'خلاصه', 'note', 'یادداشت']);
  if (!summary) return;
  const today = dateToJalali(new Date()).slice(0, 10);
  const existing = await query(
    'SELECT id FROM trade_daily_reports WHERE employee=$1 AND report_date=$2',
    [employee, today]
  );
  if (existing.rows.length) {
    await query(
      'UPDATE trade_daily_reports SET summary=$2, activities=$3 WHERE id=$1',
      [existing.rows[0].id, summary, fieldVal(data, ['activities', 'فعالیت‌ها']) || '']
    );
    return;
  }
  await query(
    `INSERT INTO trade_daily_reports (id, employee, report_date, jalali_month, summary, activities)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [uid('tdr'), employee, today, month, summary, fieldVal(data, ['activities', 'فعالیت‌ها']) || '']
  );
}

async function syncKpiFromCaseStep(caseRow, template, stepId, stepPayload) {
  if (!caseRow || !stepPayload || !stepPayload.completed_at) return { synced: false };
  const employee = caseRow.assigned_to;
  const month = caseRow.jalali_month || dateToJalali(new Date()).slice(0, 7);
  if (!employee || !month) return { synced: false };

  const step = findStep(template, stepId);
  const indicator = detectIndicator(step && step.title, step);
  if (!indicator) return { synced: false, reason: 'no_indicator' };

  try {
    if (indicator === 'customs') await syncClearance(employee, month, caseRow, stepPayload);
    else if (indicator === 'supplier') await syncSupplier(employee, month, caseRow, stepPayload);
    else if (indicator === 'finance') await syncFinance(employee, month, caseRow, stepPayload);
    else if (indicator === 'report') await syncDailyReport(employee, month, stepPayload);
    return { synced: true, indicator };
  } catch (e) {
    console.warn('[trade-case-kpi]', e.message);
    return { synced: false, error: e.message };
  }
}

async function syncAllCompletedSteps(caseRow, template) {
  if (!caseRow || !template) return [];
  let stepsData = caseRow.steps_data;
  if (!stepsData) stepsData = {};
  if (typeof stepsData === 'string') {
    try { stepsData = JSON.parse(stepsData); } catch (e) { stepsData = {}; }
  }
  const out = [];
  for (const stepId of Object.keys(stepsData)) {
    const payload = stepsData[stepId];
    if (payload && payload.completed_at) {
      out.push(await syncKpiFromCaseStep(caseRow, template, stepId, payload));
    }
  }
  return out;
}

module.exports = { syncKpiFromCaseStep, syncAllCompletedSteps, detectIndicator };

'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'سوپر ادمین') return res.status(403).json({ error: 'فقط سوپر ادمین دسترسی دارد' });
  next();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// GET /api/payroll/settings
router.get('/settings', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await query(`SELECT * FROM commission_settings WHERE id='default'`);
    res.json(r.rows[0] || { base_pct: 1.0, tier_threshold: 2000000000, tier_step_amount: 500000000, tier_step_pct: 0.1, kpi_threshold: 80, kpi_multiplier: 2.0 });
  } catch (e) {
    console.error('[payroll/settings GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/payroll/settings
router.put('/settings', requireAuth, requireSuperAdmin, async (req, res) => {
  const { base_pct, tier_threshold, tier_step_amount, tier_step_pct, kpi_threshold, kpi_multiplier } = req.body || {};
  try {
    await query(
      `INSERT INTO commission_settings (id, base_pct, tier_threshold, tier_step_amount, tier_step_pct, kpi_threshold, kpi_multiplier, updated_by, updated_at)
       VALUES ('default',$1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (id) DO UPDATE SET
         base_pct=$1, tier_threshold=$2, tier_step_amount=$3,
         tier_step_pct=$4, kpi_threshold=$5, kpi_multiplier=$6,
         updated_by=$7, updated_at=NOW()`,
      [base_pct ?? 1.0, tier_threshold ?? 2000000000, tier_step_amount ?? 500000000,
       tier_step_pct ?? 0.1, kpi_threshold ?? 80, kpi_multiplier ?? 2.0, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[payroll/settings PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// Calculate commission rate and amount
function calcCommission(salesTotal, commSettings, kpiAboveThreshold) {
  const { base_pct, tier_threshold, tier_step_amount, tier_step_pct, kpi_multiplier } = commSettings;
  let rate = parseFloat(base_pct) / 100;
  const total = parseFloat(salesTotal) || 0;
  const threshold = parseFloat(tier_threshold);
  const stepAmt = parseFloat(tier_step_amount);
  const stepPct = parseFloat(tier_step_pct) / 100;
  const multiplier = parseFloat(kpi_multiplier);
  const effectiveStepPct = kpiAboveThreshold ? stepPct * multiplier : stepPct;
  if (total > threshold && stepAmt > 0) {
    const tiers = Math.ceil((total - threshold) / stepAmt);
    rate += tiers * effectiveStepPct;
  }
  return { rate: Math.round(rate * 1000) / 10, amount: Math.round(total * rate) };
}

// GET /api/payroll/calculate/:month  (Jalali YYYY/MM)
router.get('/calculate/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است (YYYY/MM)' });
  }
  try {
    const rows = await _calcMonth(month, req.user.username);
    res.json(rows);
  } catch (e) {
    console.error('[payroll/calculate]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/payroll/finalize/:employee/:month — finalize one employee
router.post('/finalize/:employee/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { employee, month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const calcData = await _calcMonth(month, req.user.username);
    const row = calcData.rows.find(r => r.employee === employee);
    if (!row) return res.status(404).json({ error: 'کارمند یافت نشد' });
    await _upsertPayrollRecord(row, month, req.user.username);
    res.json({ ok: true });
  } catch (e) {
    console.error('[payroll/finalize]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/payroll/finalize-all/:month — finalize all employees
router.post('/finalize-all/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const calcData = await _calcMonth(month, req.user.username);
    for (const row of calcData.rows) {
      await _upsertPayrollRecord(row, month, req.user.username);
    }
    res.json({ ok: true, count: calcData.rows.length });
  } catch (e) {
    console.error('[payroll/finalize-all]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/payroll/records
router.get('/records', requireAuth, requireSuperAdmin, async (req, res) => {
  const { month, employee } = req.query;
  const conds = [], params = [];
  if (month) { conds.push(`month=$${params.length+1}`); params.push(month); }
  if (employee) { conds.push(`employee=$${params.length+1}`); params.push(employee); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const r = await query(`SELECT * FROM payroll_records ${where} ORDER BY month DESC, employee`, params);
    res.json(r.rows);
  } catch (e) {
    console.error('[payroll/records]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── helpers ──────────────────────────────────────────────────────

function _prevQuarterMonth(jalaliMonth) {
  const [y, m] = jalaliMonth.split('/').map(Number);
  const quarter = Math.floor((m - 1) / 3);
  const prevQ = quarter === 0 ? 3 : quarter - 1;
  const prevY = quarter === 0 ? y - 1 : y;
  const firstM = prevQ * 3 + 1;
  return `${prevY}/${String(firstM).padStart(2, '0')}`;
}

async function _calcMonth(month, callerUser) {
  const settingsRes = await query(`SELECT * FROM commission_settings WHERE id='default'`);
  const settings = settingsRes.rows[0] || { base_pct: 1.0, tier_threshold: 2000000000, tier_step_amount: 500000000, tier_step_pct: 0.1, kpi_threshold: 80, kpi_multiplier: 2.0 };

  const users = (await query(`SELECT username, display_name, department, salary_amount, commission_pct FROM app_users WHERE active=true ORDER BY display_name`)).rows;

  // Fetch finalized records for this month to know which are already locked
  const finalizedRes = await query(`SELECT employee FROM payroll_records WHERE month=$1 AND finalized=true`, [month]);
  const finalizedSet = new Set(finalizedRes.rows.map(r => r.employee));

  const rows = [];
  for (const u of users) {
    const pfRes = await query(
      `SELECT COALESCE(SUM(total),0) AS sales_total FROM proformas WHERE created_by=$1 AND status='approved' AND jalali_date LIKE $2`,
      [u.username, `${month}%`]
    );
    const salesTotal = parseFloat(pfRes.rows[0].sales_total) || 0;

    const prevMonth = _prevQuarterMonth(month);
    const kpiRes = await query(
      `SELECT avg_score FROM trade_kpi_monthly WHERE employee=$1 AND month LIKE $2 AND finalized=true ORDER BY month DESC LIMIT 1`,
      [u.username, `${prevMonth}%`]
    );
    const kpiScore = kpiRes.rows.length ? parseFloat(kpiRes.rows[0].avg_score) : null;
    const kpiAbove = kpiScore != null && kpiScore >= (parseFloat(settings.kpi_threshold) || 80);

    const kpiBonusRes = await query(
      `SELECT COALESCE(SUM(hygiene_bonus),0) AS kpi_bonus FROM trade_kpi_monthly WHERE employee=$1 AND month LIKE $2`,
      [u.username, `${month}%`]
    );
    const kpiBonus = parseFloat(kpiBonusRes.rows[0].kpi_bonus) || 0;

    const baseSalary = parseFloat(u.salary_amount) || 0;

    // Use user's individual commission_pct as base rate; fall back to global base_pct
    const userSettings = Object.assign({}, settings, { base_pct: (parseFloat(u.commission_pct) > 0 ? u.commission_pct : settings.base_pct) });
    const { rate, amount: commissionAmount } = calcCommission(salesTotal, userSettings, kpiAbove);
    const totalPay = baseSalary + kpiBonus + commissionAmount;

    rows.push({
      employee: u.username,
      display_name: u.display_name,
      department: u.department || '',
      base_salary: baseSalary,
      kpi_bonus: kpiBonus,
      kpi_score: kpiScore,
      sales_total: salesTotal,
      commission_pct: rate,
      commission_amount: commissionAmount,
      total_pay: totalPay,
      finalized: finalizedSet.has(u.username),
    });
  }

  return { month, settings, rows };
}

async function _upsertPayrollRecord(row, month, createdBy) {
  await query(
    `INSERT INTO payroll_records (id, employee, month, base_salary, kpi_bonus, sales_total, commission_pct, commission_amount, total_pay, finalized, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
     ON CONFLICT (employee, month) DO UPDATE SET
       base_salary=$4, kpi_bonus=$5, sales_total=$6,
       commission_pct=$7, commission_amount=$8, total_pay=$9,
       finalized=true, created_by=$10`,
    [uid(), row.employee, month, row.base_salary, row.kpi_bonus, row.sales_total,
     row.commission_pct, row.commission_amount, row.total_pay, createdBy]
  );
}

module.exports = router;

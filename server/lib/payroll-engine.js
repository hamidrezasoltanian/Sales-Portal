'use strict';

const { query } = require('../db');
const hrLeave = require('./hr-leave');
const { loadDeductionSettings, calcProgressiveTax, adjustTargetForLeave } = require('./payroll-deductions');
const {
  isTradeEmployee,
  getMilestoneBonusForMonth,
  getTradeKpiPayrollRow,
  getCommissionSettings,
} = require('./trade-payroll');

const WORKFLOW = {
  DRAFT: 'draft',
  MANAGER_REVIEW: 'manager_review',
  FINANCIAL: 'financial_approval',
  LOCKED: 'locked',
  PUBLISHED: 'published',
};

const LOCKED_STATUSES = new Set([WORKFLOW.LOCKED, WORKFLOW.PUBLISHED]);

const WORKFLOW_TRANSITIONS = {
  draft: ['manager_review'],
  manager_review: ['financial_approval', 'draft'],
  financial_approval: ['locked', 'manager_review'],
  locked: ['published'],
  published: [],
};

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function monthWorkingDays(hrSettings) {
  const annual = Number(hrSettings && hrSettings.annualWorkingDays) || 26;
  return Math.round((annual / 12) * 100) / 100;
}

function calcCommission(salesTotal, commSettings, kpiAboveThreshold, basePctOverride) {
  const base_pct = basePctOverride > 0 ? basePctOverride : (commSettings.base_pct || 1);
  const { tier_threshold, tier_step_amount, tier_step_pct, kpi_multiplier } = commSettings;
  let rate = parseFloat(base_pct) / 100;
  const total = parseFloat(salesTotal) || 0;
  const threshold = parseFloat(tier_threshold) || 0;
  const stepAmt = parseFloat(tier_step_amount) || 0;
  const stepPct = parseFloat(tier_step_pct) / 100;
  const multiplier = parseFloat(kpi_multiplier) || 1;
  const effectiveStepPct = kpiAboveThreshold ? stepPct * multiplier : stepPct;
  if (total > threshold && stepAmt > 0) {
    const tiers = Math.ceil((total - threshold) / stepAmt);
    rate += tiers * effectiveStepPct;
  }
  return { rate: Math.round(rate * 1000) / 10, amount: Math.round(total * rate) };
}

function prorateAmount(monthlyAmount, workingDays, monthDays) {
  const amt = Number(monthlyAmount) || 0;
  const wd = Number(workingDays) || 0;
  const md = Number(monthDays) || 26;
  if (amt <= 0 || md <= 0) return 0;
  return Math.round((amt / md) * wd);
}

function calcLegalDeductionsOnInsurable(insurableBase, grossPay, settings) {
  const insurable = Math.max(0, Number(insurableBase) || 0);
  const gross = Math.max(0, Number(grossPay) || 0);
  const insPct = (settings && settings.insuranceEmployeePct) || 7;
  const exempt = (settings && settings.taxExemptAmount) || 0;
  const insurance = Math.round(insurable * insPct / 100);
  const taxable = Math.max(0, gross - insurance - exempt);
  const tax = calcProgressiveTax(taxable);
  const netPay = Math.max(0, gross - insurance - tax);
  return { insurance, tax, net_pay: netPay, total_deductions: insurance + tax };
}

async function getActiveContract(employee, month) {
  const r = await query(
    `SELECT * FROM employee_contracts
     WHERE employee = $1 AND active = TRUE
       AND (start_date IS NULL OR start_date = '' OR start_date <= $3)
       AND (end_date IS NULL OR end_date = '' OR end_date >= $2)
     ORDER BY created_at DESC LIMIT 1`,
    [employee, month + '/01', month + '/31']
  );
  if (r.rows.length) return r.rows[0];
  const u = await query(
    'SELECT username, salary_amount, commission_pct FROM app_users WHERE username = $1',
    [employee]
  );
  if (!u.rows.length) return null;
  const row = u.rows[0];
  const tgt = await query(
    'SELECT target_amount FROM sales_targets WHERE employee = $1 AND month = $2',
    [employee, month]
  );
  const fallback = parseFloat(row.salary_amount) || 0;
  return {
    id: null,
    employee,
    base_salary: fallback,
    salary_insurable: fallback,
    salary_non_insurable: 0,
    housing_allowance: 0,
    grocery_allowance: 0,
    child_allowance: 0,
    commission_pct: row.commission_pct || 0,
    sales_target: tgt.rows[0] ? tgt.rows[0].target_amount : 0,
  };
}

async function getLeavePayrollImpact(employee, month) {
  const r = await query(
    `SELECT type, working_days_calc, days FROM leave_requests
     WHERE employee = $1 AND status = 'approved'
       AND (from_date LIKE $2 OR to_date LIKE $2 OR (from_date <= $3 AND to_date >= $4))`,
    [employee, month + '%', month + '/31', month + '/01']
  );
  let annual = 0;
  let unpaid = 0;
  r.rows.forEach(function (row) {
    const d = Number(row.working_days_calc || row.days) || 0;
    if (row.type === 'unpaid') unpaid += d;
    else if (row.type === 'sick') unpaid += Math.max(0, d - 3);
    else if (row.type === 'personal') unpaid += d;
    else if (row.type === 'annual' || row.type === 'mission') annual += d;
  });
  return { annualLeaveDays: annual, unpaidLeaveDays: unpaid };
}

async function getCommissionEligibleSales(employee, month) {
  const paid = await query(
    `SELECT COALESCE(SUM(i.total), 0) AS sales_total, COUNT(i.id)::int AS invoice_count
     FROM invoices i
     JOIN proformas p ON p.id = i.proforma_id
     WHERE p.created_by = $1 AND i.status = 'paid' AND i.jalali_date LIKE $2`,
    [employee, month + '%']
  );
  const salesTotal = parseFloat(paid.rows[0].sales_total) || 0;
  if (salesTotal > 0) {
    return { salesTotal, source: 'paid_invoices', invoiceCount: paid.rows[0].invoice_count };
  }
  const invoiced = await query(
    `SELECT COALESCE(SUM(p.total), 0) AS sales_total, COUNT(p.id)::int AS pf_count
     FROM proformas p
     WHERE p.created_by = $1 AND p.status = 'invoiced' AND p.jalali_date LIKE $2`,
    [employee, month + '%']
  );
  return {
    salesTotal: parseFloat(invoiced.rows[0].sales_total) || 0,
    source: 'invoiced_proforma',
    invoiceCount: invoiced.rows[0].pf_count,
  };
}

async function getApprovedVariables(employee, month) {
  const r = await query(
    `SELECT var_type, COALESCE(SUM(amount), 0) AS total
     FROM payroll_monthly_variables
     WHERE employee = $1 AND month = $2 AND status = 'approved'
     GROUP BY var_type`,
    [employee, month]
  );
  const out = { advance: 0, bonus: 0, penalty: 0, overtime: 0 };
  r.rows.forEach(function (row) {
    if (out[row.var_type] !== undefined) out[row.var_type] = parseFloat(row.total) || 0;
  });
  return out;
}

async function getStoredRecord(employee, month) {
  const r = await query(
    'SELECT * FROM payroll_records WHERE employee = $1 AND month = $2',
    [employee, month]
  );
  return r.rows[0] || null;
}

async function calcEmployeePayroll(user, month, options) {
  options = options || {};
  const stored = await getStoredRecord(user.username, month);
  if (stored && LOCKED_STATUSES.has(stored.status) && !options.forceRecalc) {
    return rowFromStored(stored, user);
  }

  const hrSettings = await hrLeave.loadHrSettings();
  const dedSettings = await loadDeductionSettings();
  const commSettings = options.commSettings || await getCommissionSettings();
  const contract = await getActiveContract(user.username, month);
  const mdays = monthWorkingDays(hrSettings);
  const leaveImpact = await getLeavePayrollImpact(user.username, month);
  const workingDays = Math.max(0, mdays - leaveImpact.unpaidLeaveDays);
  const vars = await getApprovedVariables(user.username, month);

  const salaryInsurable = parseFloat(contract.salary_insurable) || parseFloat(contract.base_salary) || 0;
  const salaryNonInsurable = parseFloat(contract.salary_non_insurable) || 0;
  const baseSalary = salaryInsurable + salaryNonInsurable;
  const housing = parseFloat(contract.housing_allowance) || 0;
  const grocery = parseFloat(contract.grocery_allowance) || 0;
  const child = parseFloat(contract.child_allowance) || 0;

  const proratedInsurable = prorateAmount(salaryInsurable, workingDays, mdays);
  const proratedNonInsurable = prorateAmount(salaryNonInsurable, workingDays, mdays);
  const proratedBase = proratedInsurable + proratedNonInsurable;
  const proratedHousing = prorateAmount(housing, workingDays, mdays);
  const proratedGrocery = prorateAmount(grocery, workingDays, mdays);
  const continuousBenefits = proratedBase + proratedHousing + proratedGrocery + child;

  const tradeUser = isTradeEmployee(user);
  let salesTotal = 0;
  let salesSource = 'none';
  let kpiScore = null;
  let kpiAbove = false;
  let kpiBonus = 0;
  let commissionAmount = 0;
  let commissionPct = 0;

  if (tradeUser) {
    const tradeKpi = await getTradeKpiPayrollRow(user.username, month);
    kpiScore = tradeKpi ? parseFloat(tradeKpi.kpi_score) : null;
    kpiAbove = !!(tradeKpi && tradeKpi.gate_passed);
    kpiBonus = (tradeKpi ? parseFloat(tradeKpi.hygiene_bonus) || 0 : 0)
      + (await getMilestoneBonusForMonth(user.username, month));
  } else {
    const sales = await getCommissionEligibleSales(user.username, month);
    salesTotal = sales.salesTotal;
    salesSource = sales.source;
    const prevMonth = _prevQuarterMonth(month);
    const kpiRes = await query(
      `SELECT COALESCE(final_score, avg_score) AS kpi_score FROM trade_kpi_monthly
       WHERE employee = $1 AND month LIKE $2 AND finalized = true ORDER BY month DESC LIMIT 1`,
      [user.username, `${prevMonth}%`]
    );
    kpiScore = kpiRes.rows.length ? parseFloat(kpiRes.rows[0].kpi_score) : null;
    kpiAbove = kpiScore != null && kpiScore >= (parseFloat(commSettings.kpi_threshold) || 80);
    const kpiBonusRes = await query(
      `SELECT COALESCE(SUM(hygiene_bonus), 0) AS kpi_bonus FROM trade_kpi_monthly
       WHERE employee = $1 AND month LIKE $2`,
      [user.username, `${month}%`]
    );
    kpiBonus = parseFloat(kpiBonusRes.rows[0].kpi_bonus) || 0;
    const pct = parseFloat(contract.commission_pct) > 0 ? contract.commission_pct : commSettings.base_pct;
    const comm = calcCommission(salesTotal, commSettings, kpiAbove, pct);
    commissionPct = comm.rate;
    commissionAmount = comm.amount;
  }

  const rawTarget = parseFloat(contract.sales_target) || null;
  const annualLeave = leaveImpact.annualLeaveDays;
  const adjustedTarget = rawTarget != null
    ? adjustTargetForLeave(rawTarget, mdays, annualLeave)
    : null;

  const overtimePay = vars.overtime;
  const bonusTotal = vars.bonus + kpiBonus;
  const penaltyTotal = vars.penalty;
  const advanceTotal = vars.advance;

  const grossPay = continuousBenefits + commissionAmount + overtimePay + vars.bonus + kpiBonus;
  const insurableBase = proratedInsurable + proratedHousing + proratedGrocery;
  const deductions = calcLegalDeductionsOnInsurable(insurableBase, grossPay, dedSettings);
  const netPay = Math.max(0, grossPay - deductions.total_deductions - advanceTotal - penaltyTotal);

  const status = stored ? (stored.status || WORKFLOW.DRAFT) : WORKFLOW.DRAFT;
  const finalized = LOCKED_STATUSES.has(status) || !!stored?.finalized;

  return {
    employee: user.username,
    display_name: user.display_name,
    department: user.department || '',
    employee_type: tradeUser ? 'trade' : 'sales',
    contract_id: contract.id,
    status,
    finalized,
    month_working_days: mdays,
    working_days: workingDays,
    unpaid_leave_days: leaveImpact.unpaidLeaveDays,
    annual_leave_days: annualLeave,
    leave_days: annualLeave + leaveImpact.unpaidLeaveDays,
    base_salary: baseSalary,
    salary_insurable: salaryInsurable,
    salary_non_insurable: salaryNonInsurable,
    prorated_base: proratedBase,
    prorated_insurable: proratedInsurable,
    prorated_non_insurable: proratedNonInsurable,
    housing_allowance: proratedHousing,
    grocery_allowance: proratedGrocery,
    child_allowance: child,
    kpi_bonus: kpiBonus,
    kpi_score: kpiScore,
    kpi_gate_passed: kpiAbove,
    sales_total: salesTotal,
    sales_source: salesSource,
    commission_pct: commissionPct,
    commission_amount: commissionAmount,
    sales_target_raw: rawTarget,
    sales_target_adjusted: adjustedTarget,
    overtime_pay: overtimePay,
    bonus_total: bonusTotal,
    penalty_total: penaltyTotal,
    advance_total: advanceTotal,
    gross_pay: grossPay,
    total_pay: grossPay,
    insurance: deductions.insurance,
    tax: deductions.tax,
    net_pay: netPay,
    calc_snapshot: {
      stages: [
        { stage: 1, title: 'روزهای کارکرد', working_days: workingDays, month_days: mdays },
        { stage: 2, title: 'مزایای مستمر', amount: continuousBenefits },
        { stage: 3, title: 'پورسانت', amount: commissionAmount, sales: salesTotal, source: salesSource },
        { stage: 4, title: 'تعدیل تارگت', raw: rawTarget, adjusted: adjustedTarget },
        { stage: 5, title: 'ناخالص', amount: grossPay },
        { stage: 6, title: 'کسورات', insurance: deductions.insurance, tax: deductions.tax },
        { stage: 7, title: 'خالص', amount: netPay },
      ],
    },
  };
}

function rowFromStored(stored, user) {
  return Object.assign({}, stored, {
    display_name: user.display_name,
    department: user.department || '',
    employee_type: isTradeEmployee(user) ? 'trade' : 'sales',
    finalized: LOCKED_STATUSES.has(stored.status) || stored.finalized,
    total_pay: stored.gross_pay || stored.total_pay,
  });
}

function _prevQuarterMonth(jalaliMonth) {
  const parts = jalaliMonth.split('/').map(Number);
  const y = parts[0];
  const m = parts[1];
  const quarter = Math.floor((m - 1) / 3);
  const prevQ = quarter === 0 ? 3 : quarter - 1;
  const prevY = quarter === 0 ? y - 1 : y;
  const firstM = prevQ * 3 + 1;
  return `${prevY}/${String(firstM).padStart(2, '0')}`;
}

async function calcMonthPayroll(month, options) {
  const settingsRes = await query(`SELECT * FROM commission_settings WHERE id='default'`);
  const settings = settingsRes.rows[0] || {};
  const users = (await query(
    `SELECT username, display_name, role, department, salary_amount, commission_pct
     FROM app_users WHERE active = true ORDER BY display_name`
  )).rows;
  const rows = [];
  for (const u of users) {
    rows.push(await calcEmployeePayroll(u, month, Object.assign({}, options, { commSettings: settings })));
  }
  return { month, settings, rows };
}

async function upsertDraftRecord(row, month, createdBy) {
  const id = uid('pr_');
  await query(
    `INSERT INTO payroll_records (
      id, employee, month, contract_id, status,
      base_salary, salary_insurable, salary_non_insurable, prorated_base,
      housing_allowance, grocery_allowance, child_allowance,
      kpi_bonus, sales_total, commission_pct, commission_amount,
      month_working_days, working_days, unpaid_leave_days, annual_leave_days, leave_days,
      sales_target_raw, sales_target_adjusted,
      overtime_pay, bonus_total, penalty_total, advance_total,
      gross_pay, total_pay, insurance, tax, net_pay,
      calc_snapshot, finalized, created_by, frozen_at
    ) VALUES (
      $1,$2,$3,$4,'draft',
      $5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,
      $16,$17,$18,$19,$20,
      $21,$22,
      $23,$24,$25,$26,
      $27,$28,$29,$30,$31,
      $32,false,$33,NOW()
    )
    ON CONFLICT (employee, month) DO UPDATE SET
      contract_id = EXCLUDED.contract_id,
      base_salary = EXCLUDED.base_salary,
      salary_insurable = EXCLUDED.salary_insurable,
      salary_non_insurable = EXCLUDED.salary_non_insurable,
      prorated_base = EXCLUDED.prorated_base,
      housing_allowance = EXCLUDED.housing_allowance,
      grocery_allowance = EXCLUDED.grocery_allowance,
      child_allowance = EXCLUDED.child_allowance,
      kpi_bonus = EXCLUDED.kpi_bonus,
      sales_total = EXCLUDED.sales_total,
      commission_pct = EXCLUDED.commission_pct,
      commission_amount = EXCLUDED.commission_amount,
      month_working_days = EXCLUDED.month_working_days,
      working_days = EXCLUDED.working_days,
      unpaid_leave_days = EXCLUDED.unpaid_leave_days,
      annual_leave_days = EXCLUDED.annual_leave_days,
      leave_days = EXCLUDED.leave_days,
      sales_target_raw = EXCLUDED.sales_target_raw,
      sales_target_adjusted = EXCLUDED.sales_target_adjusted,
      overtime_pay = EXCLUDED.overtime_pay,
      bonus_total = EXCLUDED.bonus_total,
      penalty_total = EXCLUDED.penalty_total,
      advance_total = EXCLUDED.advance_total,
      gross_pay = EXCLUDED.gross_pay,
      total_pay = EXCLUDED.total_pay,
      insurance = EXCLUDED.insurance,
      tax = EXCLUDED.tax,
      net_pay = EXCLUDED.net_pay,
      calc_snapshot = EXCLUDED.calc_snapshot,
      frozen_at = NOW(),
      created_by = EXCLUDED.created_by
    WHERE payroll_records.status NOT IN ('locked', 'published')`,
    [
      id, row.employee, month, row.contract_id,
      row.base_salary, row.salary_insurable || 0, row.salary_non_insurable || 0, row.prorated_base,
      row.housing_allowance, row.grocery_allowance, row.child_allowance,
      row.kpi_bonus, row.sales_total, row.commission_pct, row.commission_amount,
      row.month_working_days, row.working_days, row.unpaid_leave_days, row.annual_leave_days, row.leave_days,
      row.sales_target_raw, row.sales_target_adjusted,
      row.overtime_pay, row.bonus_total, row.penalty_total, row.advance_total,
      row.gross_pay, row.gross_pay, row.insurance, row.tax, row.net_pay,
      JSON.stringify(row.calc_snapshot || {}), createdBy,
    ]
  );
}

async function transitionStatus(employee, month, toStatus, actor, note) {
  const r = await query(
    'SELECT status FROM payroll_records WHERE employee = $1 AND month = $2',
    [employee, month]
  );
  if (!r.rows.length) return { error: 'رکورد حقوق یافت نشد', status: 404 };
  const from = r.rows[0].status || WORKFLOW.DRAFT;
  if (LOCKED_STATUSES.has(from) && toStatus !== WORKFLOW.PUBLISHED) {
    return { error: 'رکورد قفل شده قابل ویرایش نیست', status: 403 };
  }
  const allowed = WORKFLOW_TRANSITIONS[from] || [];
  if (!allowed.includes(toStatus)) {
    return { error: `انتقال از ${from} به ${toStatus} مجاز نیست`, status: 400 };
  }
  const extras = [];
  if (toStatus === WORKFLOW.LOCKED) {
    extras.push('finalized = true', 'locked_at = NOW()');
  }
  if (toStatus === WORKFLOW.PUBLISHED) {
    extras.push('published_at = NOW()');
  }
  await query(
    `UPDATE payroll_records SET status = $3${extras.length ? ', ' + extras.join(', ') : ''}
     WHERE employee = $1 AND month = $2`,
    [employee, month, toStatus]
  );
  await query(
    `INSERT INTO payroll_workflow_log (id, employee, month, from_status, to_status, actor, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid('pwl_'), employee, month, from, toStatus, actor, note || null]
  );
  return { ok: true, from, to: toStatus };
}

module.exports = {
  WORKFLOW,
  LOCKED_STATUSES,
  calcCommission,
  prorateAmount,
  calcLegalDeductionsOnInsurable,
  getActiveContract,
  getLeavePayrollImpact,
  getCommissionEligibleSales,
  getApprovedVariables,
  calcEmployeePayroll,
  calcMonthPayroll,
  upsertDraftRecord,
  transitionStatus,
};

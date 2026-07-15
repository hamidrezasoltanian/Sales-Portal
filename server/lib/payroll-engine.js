'use strict';

const { query } = require('../db');
const hrLeave = require('./hr-leave');
const { loadDeductionSettings, calcProgressiveTaxWithBrackets, adjustTargetForLeave, loadTaxBrackets } = require('./payroll-deductions');
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
  financial_approval: ['locked', 'manager_review', 'draft'],
  locked: ['published', 'draft'],
  published: ['draft'],
};

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function monthWorkingDays(hrSettings) {
  const annual = Number(hrSettings && hrSettings.annualWorkingDays) || 26;
  return Math.round((annual / 12) * 100) / 100;
}

function calcCommission(salesTotal, commSettings, kpiAboveThreshold, basePctOverride) {
  // Tier ladder base: contract override if >0, else global base_pct (documented rule)
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

function calcLegalDeductionsOnInsurable(insurableBase, grossPay, settings, taxBrackets) {
  const insurable = Math.max(0, Number(insurableBase) || 0);
  const gross = Math.max(0, Number(grossPay) || 0);
  const insPct = (settings && settings.insuranceEmployeePct) || 7;
  const empPct = (settings && settings.insuranceEmployerPct) || 23;
  const exempt = (settings && settings.taxExemptAmount) || 0;
  const insurance = Math.round(insurable * insPct / 100);
  const insuranceEmployer = Math.round(insurable * empPct / 100);
  const taxable = Math.max(0, gross - insurance - exempt);
  const brackets = taxBrackets && taxBrackets.length ? taxBrackets : null;
  const tax = brackets
    ? calcProgressiveTaxWithBrackets(taxable, brackets)
    : calcProgressiveTaxWithBrackets(taxable, require('./payroll-deductions').FALLBACK_BRACKETS);
  const netPay = Math.max(0, gross - insurance - tax);
  return {
    insurance,
    insurance_employer: insuranceEmployer,
    tax,
    net_pay: netPay,
    total_deductions: insurance + tax,
    tax_brackets_source: brackets ? 'db' : 'fallback',
  };
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
  // Deterministic rule: ONLY paid invoices in month; no proforma fallback (prevents double-count).
  // Attribution: COALESCE(sales_owner, created_by) on linked proforma.
  const r = await query(
    `SELECT i.id AS invoice_id, i.invoice_no, i.total, i.jalali_date, i.proforma_id,
            p.no AS proforma_no,
            COALESCE(NULLIF(TRIM(p.sales_owner), ''), p.created_by) AS attributed_to,
            p.commission_amt AS pricing_commission_amt
     FROM invoices i
     JOIN proformas p ON p.id = i.proforma_id
     WHERE i.status = 'paid' AND i.jalali_date LIKE $2
       AND COALESCE(NULLIF(TRIM(p.sales_owner), ''), p.created_by) = $1
     ORDER BY i.jalali_date, i.id`,
    [employee, month + '%']
  );
  const lines = r.rows.map(function (row) {
    return {
      invoice_id: row.invoice_id,
      invoice_no: row.invoice_no,
      proforma_id: row.proforma_id,
      proforma_no: row.proforma_no,
      jalali_date: row.jalali_date,
      total: parseFloat(row.total) || 0,
      pricing_commission_amt: parseFloat(row.pricing_commission_amt) || 0,
    };
  });
  const salesTotal = lines.reduce(function (s, x) { return s + x.total; }, 0);
  const pricingCommissionTotal = lines.reduce(function (s, x) { return s + x.pricing_commission_amt; }, 0);
  return {
    salesTotal,
    source: 'paid_invoices_only',
    rule: 'paid_invoices_only; attribution=COALESCE(sales_owner,created_by); no proforma fallback',
    invoiceCount: lines.length,
    lines,
    pricing_commission_total: pricingCommissionTotal,
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
  const taxBrackets = await loadTaxBrackets(month.split('/')[0]);
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
    // Sales employees: tier KPI multiplier not tied to trade_kpi_monthly (trade-only table).
    // Until sales_kpi_monthly exists, tier ladder uses global settings without KPI boost.
    kpiScore = null;
    kpiAbove = false;
    kpiBonus = 0;
    const pct = parseFloat(contract.commission_pct) > 0 ? contract.commission_pct : commSettings.base_pct;
    const comm = calcCommission(salesTotal, commSettings, kpiAbove, pct);
    commissionPct = comm.rate;
    commissionAmount = comm.amount;
    var salesBreakdown = sales;
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
  const deductions = calcLegalDeductionsOnInsurable(insurableBase, grossPay, dedSettings, taxBrackets);
  const rawNet = grossPay - deductions.total_deductions - advanceTotal - penaltyTotal;
  const netDebtCarry = rawNet < 0 ? Math.abs(Math.round(rawNet)) : 0;
  const netPay = Math.max(0, Math.round(rawNet));

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
    insurance_employer: deductions.insurance_employer,
    tax: deductions.tax,
    net_pay: netPay,
    net_debt_carry: netDebtCarry,
    calc_snapshot: {
      rule_sales: 'paid_invoices_only; attribution=COALESCE(sales_owner,created_by)',
      rule_commission_base: (parseFloat(contract.commission_pct) > 0
        ? 'contract.commission_pct=' + contract.commission_pct
        : 'global.base_pct=' + (commSettings.base_pct || 1)),
      inputs: {
        contract_id: contract.id,
        leave: leaveImpact,
        variables: vars,
        sales: tradeUser ? null : (typeof salesBreakdown !== 'undefined' ? salesBreakdown : null),
        trade_kpi: tradeUser ? { month, note: 'trade_kpi_monthly only' } : null,
      },
      stages: [
        { stage: 1, title: 'روزهای کارکرد', working_days: workingDays, month_days: mdays, unpaid_leave: leaveImpact.unpaidLeaveDays },
        { stage: 2, title: 'مزایای مستمر', amount: continuousBenefits, prorated_insurable: proratedInsurable },
        { stage: 3, title: 'پورسانت', amount: commissionAmount, pct: commissionPct, sales: salesTotal, source: salesSource },
        { stage: 4, title: 'تعدیل تارگت (گزارشی)', raw: rawTarget, adjusted: adjustedTarget, note: 'does not affect commission yet' },
        { stage: 5, title: 'ناخالص', amount: grossPay },
        { stage: 6, title: 'کسورات', insurance: deductions.insurance, insurance_employer: deductions.insurance_employer, tax: deductions.tax },
        { stage: 7, title: 'خالص', amount: netPay, net_debt_carry: netDebtCarry, advances: advanceTotal, penalties: penaltyTotal },
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

async function calcCommissionReconciliation(month) {
  const users = (await query(
    `SELECT username, display_name, role, department FROM app_users WHERE active = true`
  )).rows;
  const calcData = await calcMonthPayroll(month);
  const rows = [];
  for (const u of users) {
    const sales = await getCommissionEligibleSales(u.username, month);
    const payrollRow = calcData.rows.find(function (r) { return r.employee === u.username; }) || {};
    rows.push({
      employee: u.username,
      display_name: u.display_name,
      department: u.department,
      payroll_commission: parseFloat(payrollRow.commission_amount) || 0,
      payroll_commission_pct: payrollRow.commission_pct || 0,
      pricing_commission_on_paid: sales.pricing_commission_total || 0,
      sales_total_paid: sales.salesTotal,
      gap: (parseFloat(payrollRow.commission_amount) || 0) - (sales.pricing_commission_total || 0),
      invoice_lines: sales.lines || [],
      note: 'pricing commission_amt on proforma vs payroll % tier — different models until unified',
    });
  }
  return { month, rows };
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

async function upsertDraftRecord(row, month, createdBy, options) {
  options = options || {};
  const force = !!options.force;
  const newStatus = options.status || (force && options.reopen ? WORKFLOW.DRAFT : (row.status || WORKFLOW.DRAFT));
  const id = uid('pr_');
  const whereClause = force
    ? ''
    : ` WHERE payroll_records.status NOT IN ('locked', 'published')`;
  const statusOnInsert = force && options.reopen ? WORKFLOW.DRAFT : (row.status || WORKFLOW.DRAFT);
  const finalizedVal = (force && options.reopen) ? false : (LOCKED_STATUSES.has(newStatus) ? true : false);
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
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,
      $16,$17,$18,$19,$20,
      $21,$22,
      $23,$24,$25,$26,
      $27,$28,$29,$30,$31,
      $32,$33,$34,NOW()
    )
    ON CONFLICT (employee, month) DO UPDATE SET
      contract_id = EXCLUDED.contract_id,
      status = $35,
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
      finalized = $36,
      frozen_at = NOW(),
      locked_at = CASE WHEN $36 = false THEN NULL ELSE payroll_records.locked_at END,
      published_at = CASE WHEN $36 = false THEN NULL ELSE payroll_records.published_at END,
      created_by = EXCLUDED.created_by` + whereClause,
    [
      id, row.employee, month, row.contract_id, statusOnInsert,
      row.base_salary, row.salary_insurable || 0, row.salary_non_insurable || 0, row.prorated_base,
      row.housing_allowance, row.grocery_allowance, row.child_allowance,
      row.kpi_bonus, row.sales_total, row.commission_pct, row.commission_amount,
      row.month_working_days, row.working_days, row.unpaid_leave_days, row.annual_leave_days, row.leave_days,
      row.sales_target_raw, row.sales_target_adjusted,
      row.overtime_pay, row.bonus_total, row.penalty_total, row.advance_total,
      row.gross_pay, row.gross_pay, row.insurance, row.tax, row.net_pay,
      JSON.stringify(row.calc_snapshot || {}), finalizedVal, createdBy,
      force && options.reopen ? WORKFLOW.DRAFT : newStatus,
      finalizedVal,
    ]
  );
}

async function reopenPayrollRecord(employee, month, actor, note, user) {
  const stored = await getStoredRecord(employee, month);
  if (!stored) return { error: 'رکورد حقوق یافت نشد', status: 404 };
  const from = stored.status || WORKFLOW.DRAFT;
  if (from === WORKFLOW.DRAFT) return { ok: true, already: true, from };
  const payrollWorkflow = require('./payroll-workflow');
  const u = user || { role: 'مدیر', username: actor };
  if (!payrollWorkflow.canManagerEditPayroll(u)) {
    return { error: 'فقط مدیر یا سوپر ادمین می‌تواند پس از تأیید ویرایش کند', status: 403 };
  }
  const result = await transitionStatus(employee, month, WORKFLOW.DRAFT, actor, note || 'بازگشت برای ویرایش', { user: u });
  if (result.error) return result;
  return { ok: true, from, to: WORKFLOW.DRAFT };
}

async function recalcAndSaveEmployee(employee, month, actor, options) {
  options = options || {};
  const payrollWorkflow = require('./payroll-workflow');
  const u = options.user || { role: 'مدیر', username: actor };
  if (!payrollWorkflow.canManagerEditPayroll(u)) {
    return { error: 'فقط مدیر یا سوپر ادمین می‌تواند محاسبه مجدد انجام دهد', status: 403 };
  }
  const users = await query(
    `SELECT username, display_name, role, department, salary_amount, commission_pct
     FROM app_users WHERE username = $1 AND active = true`,
    [employee]
  );
  if (!users.rows.length) return { error: 'کارمند یافت نشد', status: 404 };
  const stored = await getStoredRecord(employee, month);
  const prevStatus = stored ? (stored.status || WORKFLOW.DRAFT) : WORKFLOW.DRAFT;
  if (stored && stored.status && stored.status !== WORKFLOW.DRAFT) {
    const reopen = await reopenPayrollRecord(employee, month, actor, 'بازگشت برای محاسبه مجدد', u);
    if (reopen.error) return reopen;
  }
  const settingsRes = await query(`SELECT * FROM commission_settings WHERE id='default'`);
  const row = await calcEmployeePayroll(users.rows[0], month, {
    forceRecalc: true,
    commSettings: settingsRes.rows[0] || {},
  });
  row.status = WORKFLOW.DRAFT;
  row.finalized = false;
  await upsertDraftRecord(row, month, actor, { force: true, reopen: true });
  await query(
    `INSERT INTO payroll_workflow_log (id, employee, month, from_status, to_status, actor, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid('pwl_'), employee, month, prevStatus, 'recalc', actor, options.note || 'محاسبه مجدد پس از تأیید']
  );
  return { ok: true, row };
}

async function transitionStatus(employee, month, toStatus, actor, note, options) {
  options = options || {};
  const payrollWorkflow = require('./payroll-workflow');
  const r = await query(
    'SELECT status FROM payroll_records WHERE employee = $1 AND month = $2',
    [employee, month]
  );
  if (!r.rows.length) return { error: 'رکورد حقوق یافت نشد', status: 404 };
  const from = r.rows[0].status || WORKFLOW.DRAFT;
  if (LOCKED_STATUSES.has(from) && toStatus !== WORKFLOW.PUBLISHED && toStatus !== WORKFLOW.DRAFT) {
    return { error: 'رکورد قفل شده — برای ویرایش ابتدا به پیش‌نویس بازگردانید', status: 403 };
  }
  const allowed = WORKFLOW_TRANSITIONS[from] || [];
  if (!allowed.includes(toStatus)) {
    return { error: `انتقال از ${from} به ${toStatus} مجاز نیست`, status: 400 };
  }
  const user = options.user || { role: 'سوپر ادمین', username: actor };

  if (toStatus === WORKFLOW.DRAFT && from !== WORKFLOW.DRAFT) {
    if (!payrollWorkflow.canManagerEditPayroll(user)) {
      return { error: 'فقط مدیر یا سوپر ادمین می‌تواند پس از تأیید ویرایش کند', status: 403 };
    }
  } else {
    const auth = payrollWorkflow.assertTransition(user, from, toStatus, { force: options.force });
    if (!auth.ok) return { error: auth.error, status: auth.status || 403 };
  }

  const extras = [];
  if (toStatus === WORKFLOW.LOCKED) {
    extras.push('finalized = true', 'locked_at = NOW()');
  }
  if (toStatus === WORKFLOW.PUBLISHED) {
    extras.push('published_at = NOW()');
  }
  if (toStatus === WORKFLOW.DRAFT) {
    extras.push('finalized = false', 'locked_at = NULL', 'published_at = NULL');
  }
  await query(
    `UPDATE payroll_records SET status = $3${extras.length ? ', ' + extras.join(', ') : ''}
     WHERE employee = $1 AND month = $2`,
    [employee, month, toStatus]
  );
  const logNote = (note || '') + (options.force ? ' [override]' : '');
  await query(
    `INSERT INTO payroll_workflow_log (id, employee, month, from_status, to_status, actor, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid('pwl_'), employee, month, from, toStatus, actor, logNote || null]
  );
  return { ok: true, from, to: toStatus };
}

async function assertPayrollMonthEditable(employee, month) {
  const r = await query(
    'SELECT status FROM payroll_records WHERE employee = $1 AND month = $2',
    [employee, month]
  );
  if (!r.rows.length) return { ok: true };
  const st = r.rows[0].status || WORKFLOW.DRAFT;
  if (LOCKED_STATUSES.has(st)) {
    return {
      error: 'رکورد حقوق قفل شده — برای ویرایش ابتدا به پیش‌نویس بازگردانید',
      status: 403,
      current_status: st,
    };
  }
  return { ok: true };
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
  calcCommissionReconciliation,
  upsertDraftRecord,
  transitionStatus,
  reopenPayrollRecord,
  recalcAndSaveEmployee,
  assertPayrollMonthEditable,
};

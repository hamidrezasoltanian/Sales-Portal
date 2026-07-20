'use strict';

const express = require('express');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const payrollEngine = require('../lib/payroll-engine');
const payrollWorkflow = require('../lib/payroll-workflow');
const { isManagerRole } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

function requirePayrollView(req, res, next) {
  return requirePermission('payroll', 'view')(req, res, next);
}

function requirePayrollEdit(req, res, next) {
  return requirePermission('payroll', 'manage')(req, res, next);
}

function requirePayrollApprove(req, res, next) {
  return requirePermission('payroll', 'approve')(req, res, next);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// GET /api/payroll/settings
router.get('/settings', requirePayrollEdit, async (req, res) => {
  try {
    const r = await query(`SELECT * FROM commission_settings WHERE id='default'`);
    res.json(r.rows[0] || { base_pct: 1.0, tier_threshold: 2000000000, tier_step_amount: 500000000, tier_step_pct: 0.1, kpi_threshold: 80, kpi_multiplier: 2.0 });
  } catch (e) {
    console.error('[payroll/settings GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/payroll/settings
router.put('/settings', requirePayrollEdit, async (req, res) => {
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

// GET /api/payroll/calculate/:month
router.get('/calculate/:month', requirePayrollView, async (req, res) => {
  const { month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است (YYYY/MM)' });
  }
  try {
    const data = await payrollEngine.calcMonthPayroll(month);
    res.json(data);
  } catch (e) {
    console.error('[payroll/calculate]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/payroll/reconciliation/:month — pricing commission_amt vs payroll tier commission
router.get('/reconciliation/:month', requirePayrollView, async (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست' });
  try {
    const data = await payrollEngine.calcCommissionReconciliation(month);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/draft/:month — freeze draft records (روز ۲۵)
router.post('/draft/:month', requirePayrollEdit, async (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست' });
  try {
    const data = await payrollEngine.calcMonthPayroll(month);
    let count = 0;
    for (const row of data.rows) {
      await payrollEngine.upsertDraftRecord(row, month, req.user.username);
      count++;
    }
    res.json({ ok: true, count, status: payrollEngine.WORKFLOW.DRAFT });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/reopen/:employee/:month — مدیر/سوپرادمین: بازگشت به پیش‌نویس پس از تأیید
router.post('/reopen/:employee/:month', requirePayrollEdit, async (req, res) => {
  const { employee, month } = req.params;
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست' });
  try {
    const result = await payrollEngine.reopenPayrollRecord(
      employee, month, req.user.username, (req.body && req.body.note) || '', req.user
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/recalc/:employee/:month — محاسبه مجدد + ذخیره (پس از تأیید)
router.post('/recalc/:employee/:month', requirePayrollEdit, async (req, res) => {
  const { employee, month } = req.params;
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست' });
  try {
    const result = await payrollEngine.recalcAndSaveEmployee(
      employee, month, req.user.username, { user: req.user, note: req.body && req.body.note }
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function normalizePayrollMonth(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/-/g, '/');
  return s;
}

// POST /api/payroll/workflow/:employee/:month — role-based transitions
router.post('/workflow/:employee/:month', async (req, res, next) => {
  const { status } = req.body || {};
  const to = status;
  if (to === payrollEngine.WORKFLOW.DRAFT || to === payrollEngine.WORKFLOW.MANAGER_REVIEW || to === payrollEngine.WORKFLOW.FINANCIAL) {
    return requirePayrollEdit(req, res, next);
  }
  if (to === payrollEngine.WORKFLOW.LOCKED) {
    return requirePayrollApprove(req, res, next);
  }
  if (to === payrollEngine.WORKFLOW.PUBLISHED) {
    return requirePayrollEdit(req, res, next);
  }
  return requirePayrollEdit(req, res, next);
}, async (req, res) => {
  const employee = req.params.employee;
  const month = normalizePayrollMonth((req.body && req.body.month) || req.params.month);
  const { status, note, force } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status الزامی است' });
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست است (YYYY/MM)' });
  try {
    const result = await payrollEngine.transitionStatus(
      employee, month, status, req.user.username, note, { user: req.user, force: !!force }
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback when proxies decode %2F → /workflow/:employee/1405/04
router.post('/workflow/:employee/:year/:mon', async (req, res, next) => {
  req.params.month = `${req.params.year}/${req.params.mon}`;
  const { status } = req.body || {};
  const to = status;
  if (to === payrollEngine.WORKFLOW.DRAFT || to === payrollEngine.WORKFLOW.MANAGER_REVIEW || to === payrollEngine.WORKFLOW.FINANCIAL) {
    return requirePayrollEdit(req, res, next);
  }
  if (to === payrollEngine.WORKFLOW.LOCKED) {
    return requirePayrollApprove(req, res, next);
  }
  if (to === payrollEngine.WORKFLOW.PUBLISHED) {
    return requirePayrollEdit(req, res, next);
  }
  return requirePayrollEdit(req, res, next);
}, async (req, res) => {
  const employee = req.params.employee;
  const month = normalizePayrollMonth((req.body && req.body.month) || req.params.month);
  const { status, note, force } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status الزامی است' });
  if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'فرمت ماه نادرست است (YYYY/MM)' });
  try {
    const result = await payrollEngine.transitionStatus(
      employee, month, status, req.user.username, note, { user: req.user, force: !!force }
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/workflow-all/:month — bulk transition (same status for all draft records)
router.post('/workflow-all/:month', requirePayrollEdit, async (req, res) => {
  const { month } = req.params;
  const { status, note } = req.body || {};
  if (!status || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'ماه و status الزامی است' });
  }
  try {
    const recs = await query(
      `SELECT employee, status FROM payroll_records WHERE month = $1 AND status != $2`,
      [month, payrollEngine.WORKFLOW.PUBLISHED]
    );
    let count = 0;
    const errors = [];
    for (const row of recs.rows) {
      const result = await payrollEngine.transitionStatus(
        row.employee, month, status, req.user.username, note, { user: req.user }
      );
      if (result.error) errors.push({ employee: row.employee, error: result.error });
      else count++;
    }
    res.json({ ok: true, count, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/finalize/:employee/:month — deprecated alias: must be financial_approval → locked
router.post('/finalize/:employee/:month', requirePayrollApprove, async (req, res) => {
  const { employee, month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const stored = await query(
      'SELECT status FROM payroll_records WHERE employee = $1 AND month = $2',
      [employee, month]
    );
    const current = stored.rows[0] ? stored.rows[0].status : payrollEngine.WORKFLOW.DRAFT;
    if (current !== payrollEngine.WORKFLOW.FINANCIAL) {
      const calcData = await payrollEngine.calcMonthPayroll(month);
      const row = calcData.rows.find(function (r) { return r.employee === employee; });
      if (!row) return res.status(404).json({ error: 'کارمند یافت نشد' });
      await payrollEngine.upsertDraftRecord(row, month, req.user.username);
      return res.status(400).json({
        error: 'قفل مستقیم مجاز نیست. ابتدا: پیش‌نویس → بررسی مدیر → تأیید مالی. وضعیت فعلی: ' + current,
        current_status: current,
        next_actions: payrollWorkflow.nextActionsFor(req.user, current),
      });
    }
    const calcData = await payrollEngine.calcMonthPayroll(month);
    const row = calcData.rows.find(function (r) { return r.employee === employee; });
    if (!row) return res.status(404).json({ error: 'کارمند یافت نشد' });
    await payrollEngine.upsertDraftRecord(row, month, req.user.username);
    const result = await payrollEngine.transitionStatus(
      employee, month, payrollEngine.WORKFLOW.LOCKED, req.user.username, 'تأیید مالی و قفل',
      { user: req.user }
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error('[payroll/finalize]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/payroll/finalize-all/:month — bulk lock only if all at financial_approval
router.post('/finalize-all/:month', requirePayrollApprove, async (req, res) => {
  const { month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const calcData = await payrollEngine.calcMonthPayroll(month);
    let count = 0;
    const skipped = [];
    for (const row of calcData.rows) {
      const st = await query(
        'SELECT status FROM payroll_records WHERE employee = $1 AND month = $2',
        [row.employee, month]
      );
      const current = st.rows[0] ? st.rows[0].status : payrollEngine.WORKFLOW.DRAFT;
      if (current !== payrollEngine.WORKFLOW.FINANCIAL) {
        skipped.push({ employee: row.employee, status: current });
        continue;
      }
      await payrollEngine.upsertDraftRecord(row, month, req.user.username);
      const result = await payrollEngine.transitionStatus(
        row.employee, month, payrollEngine.WORKFLOW.LOCKED, req.user.username, 'تأیید مالی گروهی',
        { user: req.user }
      );
      if (!result.error) count++;
    }
    res.json({ ok: true, count, skipped });
  } catch (e) {
    console.error('[payroll/finalize-all]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Contracts ────────────────────────────────────────────────────────────────

router.get('/contracts', requirePayrollEdit, async (req, res) => {
  try {
    const params = [];
    let sql = 'SELECT c.*, u.display_name FROM employee_contracts c LEFT JOIN app_users u ON u.username = c.employee WHERE c.active = TRUE';
    if (req.query.employee) {
      params.push(req.query.employee);
      sql += ' AND c.employee = $' + params.length;
    }
    sql += ' ORDER BY c.employee';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/contracts', requirePayrollEdit, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.employee) return res.status(400).json({ error: 'کارمند الزامی است' });
    const saved = await require('../lib/employee-contract').upsertEmployeeContract(
      b.employee, b, req.user.username
    );
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Monthly variables (مساعده / پاداش / جریمه) ─────────────────────────────

router.get('/variables', requirePayrollEdit, async (req, res) => {
  try {
    const { month, employee, status } = req.query;
    const params = [];
    let sql = 'SELECT * FROM payroll_monthly_variables WHERE 1=1';
    if (month) { params.push(month); sql += ' AND month = $' + params.length; }
    if (employee) { params.push(employee); sql += ' AND employee = $' + params.length; }
    if (status) { params.push(status); sql += ' AND status = $' + params.length; }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/variables', requirePayrollEdit, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.employee || !b.month || !b.var_type || b.amount == null) {
      return res.status(400).json({ error: 'کارمند، ماه، نوع و مبلغ الزامی است' });
    }
    const mutable = await payrollEngine.assertPayrollMonthEditable(b.employee, b.month);
    if (mutable.error) return res.status(mutable.status || 403).json({ error: mutable.error });
    const id = uid();
    const r = await query(
      `INSERT INTO payroll_monthly_variables (id, employee, month, var_type, amount, title, notes, disciplinary_action_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, b.employee, b.month, b.var_type, parseFloat(b.amount) || 0,
        b.title || null, b.notes || null, b.disciplinary_action_id || null, req.user.username]
    );
    try {
      require('../lib/inbox-hooks').onPayrollVariableChange(id);
    } catch (_) {}
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/variables/:id/approve', requirePayrollApprove, async (req, res) => {
  try {
    const approve = req.body && req.body.approve !== false;
    const r = await query(
      `UPDATE payroll_monthly_variables SET status = $2, approved_by = $3, approved_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, approve ? 'approved' : 'rejected', req.user.username]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    try { require('../lib/inbox-hooks').onPayrollVariableChange(req.params.id); } catch (_) {}
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payroll/targets?month=YYYY/MM
router.get('/targets', requirePayrollView, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'پارامتر month الزامی است' });
    const r = await query('SELECT * FROM sales_targets WHERE month=$1 ORDER BY employee', [month]);
    res.json(r.rows);
  } catch (e) {
    console.error('[payroll/targets GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/targets/:employee/:month', requirePayrollEdit, async (req, res) => {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { employee, month } = req.params;
    const { target_amount } = req.body;
    if (target_amount === undefined) return res.status(400).json({ error: 'target_amount الزامی است' });
    const id = 'tgt_' + employee + '_' + month.replace('/', '');
    await query(
      `INSERT INTO sales_targets (id, employee, month, target_amount, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (employee, month) DO UPDATE SET target_amount=$4, created_by=$5, updated_at=NOW()`,
      [id, employee, month, parseFloat(target_amount) || 0, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[payroll/targets PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/payroll/actuals?month= — commission-eligible sales
router.get('/actuals', requirePayrollView, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'پارامتر month الزامی است' });
    const users = (await query('SELECT username, display_name FROM app_users WHERE active = true')).rows;
    const rows = [];
    for (const u of users) {
      const sales = await payrollEngine.getCommissionEligibleSales(u.username, month);
      rows.push({
        employee: u.username,
        display_name: u.display_name,
        actual_amount: sales.salesTotal,
        source: sales.source,
        rule: sales.rule,
        proforma_count: sales.invoiceCount,
        pricing_commission_total: sales.pricing_commission_total,
        lines: sales.lines,
      });
    }
    rows.sort(function (a, b) { return b.actual_amount - a.actual_amount; });
    res.json(rows);
  } catch (e) {
    console.error('[payroll/actuals GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/records', requirePayrollView, async (req, res) => {
  const { month, employee } = req.query;
  const conds = []; const params = [];
  if (month) { conds.push(`month=$${params.length + 1}`); params.push(month); }
  if (employee) { conds.push(`employee=$${params.length + 1}`); params.push(employee); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const r = await query(`SELECT * FROM payroll_records ${where} ORDER BY month DESC, employee`, params);
    res.json(r.rows);
  } catch (e) {
    console.error('[payroll/records]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/payroll/my/:month — published payslip for self
router.get('/my/:month', requireAuth, async (req, res) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}\/\d{2}$/.test(month)) return res.status(400).json({ error: 'ماه نامعتبر' });
    const r = await query(
      `SELECT * FROM payroll_records WHERE employee = $1 AND month = $2 AND status = 'published'`,
      [req.user.username, month]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: 'فیش منتشرشده‌ای برای این ماه نیست' });
    }
    res.json({ ok: true, record: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Off-cycle corrections (do not rewrite published snapshot)
router.get('/corrections', requirePayrollView, async (req, res) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS payroll_corrections (
      id TEXT PRIMARY KEY, employee TEXT NOT NULL, original_month TEXT NOT NULL,
      apply_month TEXT NOT NULL, amount DECIMAL(15,2) NOT NULL, reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', created_by TEXT, approved_by TEXT,
      approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    )`).catch(function () {});
    const params = [];
    let sql = 'SELECT * FROM payroll_corrections WHERE 1=1';
    if (req.query.month) { params.push(req.query.month); sql += ' AND apply_month = $' + params.length; }
    if (req.query.employee) { params.push(req.query.employee); sql += ' AND employee = $' + params.length; }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/corrections', requirePayrollEdit, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.employee || !b.original_month || b.amount == null) {
      return res.status(400).json({ error: 'کارمند، ماه اصلی و مبلغ الزامی است' });
    }
    const pub = await query(
      `SELECT status FROM payroll_records WHERE employee = $1 AND month = $2`,
      [b.employee, b.original_month]
    );
    if (!pub.rows.length || pub.rows[0].status !== 'published') {
      return res.status(400).json({ error: 'اصلاح فقط برای ماه منتشرشده مجاز است — در غیر این صورت ویرایش/محاسبه مجدد کنید' });
    }
    // Default apply to next Jalali month
    let applyMonth = b.apply_month;
    if (!applyMonth) {
      const salesKpi = require('../lib/sales-kpi');
      const pts = b.original_month.split('/');
      let jy = parseInt(pts[0], 10);
      let jm = parseInt(pts[1], 10) + 1;
      if (jm > 12) { jm = 1; jy += 1; }
      applyMonth = jy + '/' + String(jm).padStart(2, '0');
    }
    await query(`CREATE TABLE IF NOT EXISTS payroll_corrections (
      id TEXT PRIMARY KEY, employee TEXT NOT NULL, original_month TEXT NOT NULL,
      apply_month TEXT NOT NULL, amount DECIMAL(15,2) NOT NULL, reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', created_by TEXT, approved_by TEXT,
      approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    )`).catch(function () {});
    const id = 'pcorr_' + uid();
    const r = await query(
      `INSERT INTO payroll_corrections (id, employee, original_month, apply_month, amount, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, b.employee, b.original_month, applyMonth, parseFloat(b.amount) || 0, b.reason || null, req.user.username]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/corrections/:id/approve', requirePayrollApprove, async (req, res) => {
  try {
    const approve = req.body && req.body.approve !== false;
    const r = await query(
      `UPDATE payroll_corrections SET status = $2, approved_by = $3, approved_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, approve ? 'approved' : 'rejected', req.user.username]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

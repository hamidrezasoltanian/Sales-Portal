'use strict';

const express = require('express');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const payrollEngine = require('../lib/payroll-engine');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('hr', level)(req, res, next);
});

function requireSuperAdmin(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'سوپر ادمین' || role === 'مدیر') return next();
  return res.status(403).json({ error: 'فقط مدیر دسترسی دارد' });
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

// GET /api/payroll/calculate/:month
router.get('/calculate/:month', requireAuth, requireSuperAdmin, async (req, res) => {
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

// POST /api/payroll/draft/:month — freeze draft records (روز ۲۵)
router.post('/draft/:month', requireAuth, requireSuperAdmin, async (req, res) => {
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

// POST /api/payroll/workflow/:employee/:month
router.post('/workflow/:employee/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { employee, month } = req.params;
  const { status, note } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status الزامی است' });
  try {
    const result = await payrollEngine.transitionStatus(employee, month, status, req.user.username, note);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payroll/finalize/:employee/:month — lock record
router.post('/finalize/:employee/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { employee, month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const calcData = await payrollEngine.calcMonthPayroll(month);
    const row = calcData.rows.find(function (r) { return r.employee === employee; });
    if (!row) return res.status(404).json({ error: 'کارمند یافت نشد' });
    await payrollEngine.upsertDraftRecord(row, month, req.user.username);
    const result = await payrollEngine.transitionStatus(
      employee, month, payrollEngine.WORKFLOW.LOCKED, req.user.username, 'نهایی‌سازی'
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error('[payroll/finalize]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/payroll/finalize-all/:month
router.post('/finalize-all/:month', requireAuth, requireSuperAdmin, async (req, res) => {
  const { month } = req.params;
  if (!month || !/^\d{4}\/\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'فرمت ماه نادرست است' });
  }
  try {
    const calcData = await payrollEngine.calcMonthPayroll(month);
    for (const row of calcData.rows) {
      await payrollEngine.upsertDraftRecord(row, month, req.user.username);
      await payrollEngine.transitionStatus(
        row.employee, month, payrollEngine.WORKFLOW.LOCKED, req.user.username, 'نهایی‌سازی گروهی'
      );
    }
    res.json({ ok: true, count: calcData.rows.length });
  } catch (e) {
    console.error('[payroll/finalize-all]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Contracts ────────────────────────────────────────────────────────────────

router.get('/contracts', requireAuth, requireSuperAdmin, async (req, res) => {
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

router.post('/contracts', requireAuth, requireSuperAdmin, async (req, res) => {
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

router.get('/variables', requireAuth, requireSuperAdmin, async (req, res) => {
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

router.post('/variables', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.employee || !b.month || !b.var_type || b.amount == null) {
      return res.status(400).json({ error: 'کارمند، ماه، نوع و مبلغ الزامی است' });
    }
    const id = uid();
    const r = await query(
      `INSERT INTO payroll_monthly_variables (id, employee, month, var_type, amount, title, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, b.employee, b.month, b.var_type, parseFloat(b.amount) || 0,
        b.title || null, b.notes || null, req.user.username]
    );
    try {
      require('../lib/inbox-hooks').onPayrollVariableChange(id);
    } catch (_) {}
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/variables/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
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
router.get('/targets', requireAuth, async (req, res) => {
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

router.put('/targets/:employee/:month', requireAuth, async (req, res) => {
  try {
    if (!['مدیر', 'سوپر ادمین'].includes(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
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
router.get('/actuals', requireAuth, async (req, res) => {
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
        proforma_count: sales.invoiceCount,
      });
    }
    rows.sort(function (a, b) { return b.actual_amount - a.actual_amount; });
    res.json(rows);
  } catch (e) {
    console.error('[payroll/actuals GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/records', requireAuth, requireSuperAdmin, async (req, res) => {
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

module.exports = router;

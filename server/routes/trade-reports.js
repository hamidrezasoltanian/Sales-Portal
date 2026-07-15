'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  requirePermission('trade-kpi', 'view')(req, res, next);
});

function isManager(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

// GET /api/trade-reports/summary?month=1404/04&assigned_to=user
router.get('/summary', async function (req, res) {
  try {
    const month = req.query.month || '';
    let assigned = req.query.assigned_to || '';
    const user = req.user;
    if (!isManager(user.role)) assigned = user.username;
    if (!month) return res.status(400).json({ error: 'month الزامی است' });

    const params = [month];
    let empClause = '';
    if (assigned) {
      empClause = ' AND assigned_to=$2';
      params.push(assigned);
    }

    const casesR = await query(
      `SELECT status, is_finalized, COUNT(*)::int AS n FROM trade_cases
       WHERE jalali_month=$1 ${empClause} GROUP BY status, is_finalized`,
      params
    );

    const kpiParams = assigned ? [assigned, month] : [month];
    const kpiEmpClause = assigned ? 'employee=$1 AND month=$2' : 'month=$1';

    const scoreR = assigned
      ? await query(`SELECT final_score, finalized FROM trade_kpi_monthly WHERE employee=$1 AND month=$2`, [assigned, month])
      : { rows: [] };

    const clrR = await query(
      assigned
        ? 'SELECT COUNT(*)::int AS n FROM trade_clearances WHERE employee=$1 AND jalali_month=$2'
        : 'SELECT COUNT(*)::int AS n FROM trade_clearances WHERE jalali_month=$1',
      assigned ? [assigned, month] : [month]
    );

    const repR = await query(
      assigned
        ? 'SELECT COUNT(*)::int AS n FROM trade_daily_reports WHERE employee=$1 AND jalali_month=$2'
        : 'SELECT COUNT(*)::int AS n FROM trade_daily_reports WHERE jalali_month=$1',
      assigned ? [assigned, month] : [month]
    );

    const supR = await query(
      assigned
        ? 'SELECT COUNT(*)::int AS n FROM trade_suppliers_new WHERE employee=$1 AND jalali_month=$2'
        : 'SELECT COUNT(*)::int AS n FROM trade_suppliers_new WHERE jalali_month=$1',
      assigned ? [assigned, month] : [month]
    );

    const active = casesR.rows.filter((r) => r.status === 'active' && !r.is_finalized)
      .reduce((s, r) => s + r.n, 0);
    const finalized = casesR.rows.filter((r) => r.is_finalized || r.status === 'finalized')
      .reduce((s, r) => s + r.n, 0);

    res.json({
      month,
      employee: assigned || null,
      cases: { active, finalized, breakdown: casesR.rows },
      clearances: clrR.rows[0] ? clrR.rows[0].n : 0,
      dailyReports: repR.rows[0] ? repR.rows[0].n : 0,
      suppliers: supR.rows[0] ? supR.rows[0].n : 0,
      kpiMonthly: scoreR.rows[0] || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trade-reports/cases-by-template?month=
router.get('/cases-by-template', async function (req, res) {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: 'month الزامی است' });
    const { rows } = await query(
      `SELECT t.name, t.id, COUNT(c.id)::int AS case_count,
              SUM(CASE WHEN c.is_finalized THEN 1 ELSE 0 END)::int AS finalized_count
       FROM trade_process_templates t
       LEFT JOIN trade_cases c ON c.template_id=t.id AND c.jalali_month=$1 AND c.status='active'
       WHERE t.is_active=TRUE
       GROUP BY t.id, t.name
       ORDER BY case_count DESC`,
      [month]
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

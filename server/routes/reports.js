'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireManager(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'مدیر' || role === 'سوپر ادمین') return next();
  return res.status(403).json({ error: 'فقط مدیر دسترسی دارد' });
}

// GET /api/reports/sales-trend?months=6
router.get('/sales-trend', requireAuth, requireManager, async (req, res) => {
  const months = Math.min(24, parseInt(req.query.months) || 6);
  try {
    const r = await query(`
      SELECT
        created_by AS employee,
        LEFT(jalali_date, 7) AS month,
        COUNT(*) AS count,
        SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END) AS approved_total,
        COUNT(CASE WHEN status IN ('approved','invoiced') THEN 1 END) AS approved_count,
        COUNT(CASE WHEN status='rejected' THEN 1 END) AS rejected_count
      FROM proformas
      WHERE jalali_date IS NOT NULL AND jalali_date != ''
      GROUP BY created_by, LEFT(jalali_date, 7)
      ORDER BY month DESC, employee
    `);

    const users = await query(`SELECT username, display_name FROM app_users`);
    const nameMap = {};
    users.rows.forEach(u => { nameMap[u.username] = u.display_name || u.username; });

    // Get distinct months (most recent N)
    const allMonths = [...new Set(r.rows.map(row => row.month))].sort().reverse().slice(0, months);

    const rows = r.rows
      .filter(row => allMonths.includes(row.month))
      .map(row => ({
        ...row,
        display_name: nameMap[row.employee] || row.employee,
        approved_total: parseInt(row.approved_total) || 0,
        approved_count: parseInt(row.approved_count) || 0,
        rejected_count: parseInt(row.rejected_count) || 0,
        count: parseInt(row.count) || 0,
      }));

    res.json({ rows, months: allMonths });
  } catch (e) {
    console.error('[reports/sales-trend]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/reports/pipeline
router.get('/pipeline', requireAuth, requireManager, async (req, res) => {
  try {
    const byStatus = await query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total),0) AS total_value
      FROM proformas GROUP BY status ORDER BY count DESC
    `);

    const byEmployee = await query(`
      SELECT
        created_by AS employee,
        COUNT(*) AS total,
        COUNT(CASE WHEN status IN ('approved','invoiced') THEN 1 END) AS approved,
        COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS approved_value
      FROM proformas
      GROUP BY created_by ORDER BY approved_value DESC
    `);

    const trend = await query(`
      SELECT LEFT(jalali_date,7) AS month,
             COUNT(*) AS count,
             COALESCE(SUM(CASE WHEN status IN ('approved','invoiced') THEN total ELSE 0 END),0) AS approved_total,
             COALESCE(SUM(total),0) AS all_total
      FROM proformas
      WHERE jalali_date IS NOT NULL AND jalali_date != ''
      GROUP BY LEFT(jalali_date,7)
      ORDER BY month DESC LIMIT 12
    `);

    const cycleR = await query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::numeric, 1) AS avg_days
      FROM proformas WHERE status IN ('approved','invoiced')
    `);

    const users = await query(`SELECT username, display_name FROM app_users`);
    const nameMap = {};
    users.rows.forEach(u => { nameMap[u.username] = u.display_name || u.username; });

    res.json({
      byStatus: byStatus.rows.map(r => ({ ...r, count: parseInt(r.count), total_value: parseInt(r.total_value) })),
      byEmployee: byEmployee.rows.map(r => ({
        ...r,
        display_name: nameMap[r.employee] || r.employee,
        total: parseInt(r.total),
        approved: parseInt(r.approved),
        approved_value: parseInt(r.approved_value),
      })),
      trend: trend.rows.map(r => ({ ...r, count: parseInt(r.count), approved_total: parseInt(r.approved_total), all_total: parseInt(r.all_total) })),
      avgCycleDays: parseFloat(cycleR.rows[0]?.avg_days) || 0,
    });
  } catch (e) {
    console.error('[reports/pipeline]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/reports/support-stats
router.get('/support-stats', requireAuth, requireManager, async (req, res) => {
  try {
    const byStatus = await query(`SELECT status, COUNT(*) AS count FROM support_tickets GROUP BY status ORDER BY count DESC`);
    const byCategory = await query(`SELECT COALESCE(category,'other') AS category, COUNT(*) AS count FROM support_tickets GROUP BY category ORDER BY count DESC`);
    const byAssignee = await query(`
      SELECT assigned_to,
             COUNT(*) AS total,
             COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END) AS resolved
      FROM support_tickets WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to ORDER BY total DESC
    `);
    const totalR = await query(`SELECT COUNT(*) AS total FROM support_tickets`);
    const openR  = await query(`SELECT COUNT(*) AS open FROM support_tickets WHERE status NOT IN ('resolved','closed','cancelled')`);
    const avgR   = await query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric,1) AS avg_hours
      FROM support_tickets WHERE resolved_at IS NOT NULL
    `);
    const slaR   = await query(`
      SELECT COUNT(*) AS overdue FROM support_tickets
      WHERE status NOT IN ('resolved','closed','cancelled')
        AND sla_deadline IS NOT NULL
        AND sla_deadline < to_char(NOW(),'YYYY-MM-DD')
    `);

    const users = await query(`SELECT username, display_name FROM app_users`);
    const nameMap = {};
    users.rows.forEach(u => { nameMap[u.username] = u.display_name || u.username; });

    res.json({
      total: parseInt(totalR.rows[0]?.total) || 0,
      open: parseInt(openR.rows[0]?.open) || 0,
      avgResolutionHours: parseFloat(avgR.rows[0]?.avg_hours) || 0,
      overdueSLA: parseInt(slaR.rows[0]?.overdue) || 0,
      byStatus: byStatus.rows.map(r => ({ ...r, count: parseInt(r.count) })),
      byCategory: byCategory.rows.map(r => ({ ...r, count: parseInt(r.count) })),
      byAssignee: byAssignee.rows.map(r => ({
        ...r,
        display_name: nameMap[r.assigned_to] || r.assigned_to,
        total: parseInt(r.total),
        resolved: parseInt(r.resolved),
      })),
    });
  } catch (e) {
    console.error('[reports/support-stats]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/reports/payroll-history?months=12
router.get('/payroll-history', requireAuth, requireManager, async (req, res) => {
  const months = Math.min(36, parseInt(req.query.months) || 12);
  try {
    const monthTotals = await query(`
      SELECT month, SUM(total_pay) AS total, SUM(commission_amount) AS commission, COUNT(*) AS headcount
      FROM payroll_records
      GROUP BY month ORDER BY month DESC LIMIT $1
    `, [months]);

    const cutoff = monthTotals.rows.length ? monthTotals.rows[monthTotals.rows.length - 1].month : null;
    let r;
    if (cutoff) {
      r = await query(`
        SELECT p.employee, COALESCE(u.display_name, p.employee) AS display_name,
               p.month, p.base_salary, p.kpi_bonus, p.sales_total,
               p.commission_pct, p.commission_amount, p.total_pay, p.finalized
        FROM payroll_records p
        LEFT JOIN app_users u ON u.username = p.employee
        WHERE p.month >= $1
        ORDER BY p.month DESC, p.employee
      `, [cutoff]);
    } else {
      r = await query(`
        SELECT p.employee, COALESCE(u.display_name, p.employee) AS display_name,
               p.month, p.base_salary, p.kpi_bonus, p.sales_total,
               p.commission_pct, p.commission_amount, p.total_pay, p.finalized
        FROM payroll_records p
        LEFT JOIN app_users u ON u.username = p.employee
        ORDER BY p.month DESC, p.employee LIMIT 500
      `);
    }

    res.json({
      rows: r.rows.map(row => ({
        ...row,
        base_salary: parseFloat(row.base_salary) || 0,
        kpi_bonus: parseFloat(row.kpi_bonus) || 0,
        sales_total: parseFloat(row.sales_total) || 0,
        commission_pct: parseFloat(row.commission_pct) || 0,
        commission_amount: parseFloat(row.commission_amount) || 0,
        total_pay: parseFloat(row.total_pay) || 0,
      })),
      monthTotals: monthTotals.rows.map(row => ({
        ...row,
        total: parseFloat(row.total) || 0,
        commission: parseFloat(row.commission) || 0,
        headcount: parseInt(row.headcount) || 0,
      })),
    });
  } catch (e) {
    console.error('[reports/payroll-history]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/reports/activity-summary?months=6
router.get('/activity-summary', requireAuth, requireManager, async (req, res) => {
  const months = Math.min(24, parseInt(req.query.months) || 6);
  try {
    const users = await query(`SELECT username, display_name FROM app_users`);
    const nameMap = {};
    users.rows.forEach(u => { nameMap[u.username] = u.display_name || u.username; });

    const [calls, visits, sales, edits] = await Promise.all([
      query(`SELECT username, LEFT(date, 7) AS month, SUM(count)::int AS cnt
             FROM call_log WHERE date IS NOT NULL AND date != ''
             GROUP BY username, LEFT(date, 7)`).catch(() => ({ rows: [] })),
      query(`SELECT username, LEFT(date, 7) AS month, SUM(count)::int AS cnt
             FROM visit_log WHERE date IS NOT NULL AND date != ''
             GROUP BY username, LEFT(date, 7)`).catch(() => ({ rows: [] })),
      query(`SELECT username, LEFT(date, 7) AS month, COUNT(*)::int AS cnt
             FROM sales_log WHERE date IS NOT NULL AND date != ''
             GROUP BY username, LEFT(date, 7)`).catch(() => ({ rows: [] })),
      query(`SELECT "by" AS username, to_char(at, 'YYYY') || '/' ||
             LPAD(to_char(at, 'MM'), 2, '0') AS month, COUNT(*)::int AS cnt
             FROM change_log GROUP BY "by", 2`).catch(() => ({ rows: [] })),
    ]);

    const allMonths = new Set();
    [calls, visits, sales, edits].forEach(function (src) {
      src.rows.forEach(function (r) { if (r.month) allMonths.add(r.month); });
    });
    const monthList = [...allMonths].sort().reverse().slice(0, months);

    const byUser = {};
    function inc(src, key) {
      src.rows.forEach(function (r) {
        if (!r.username || !r.month || !monthList.includes(r.month)) return;
        if (!byUser[r.username]) byUser[r.username] = {};
        if (!byUser[r.username][r.month]) byUser[r.username][r.month] = { calls: 0, visits: 0, sales: 0, edits: 0 };
        byUser[r.username][r.month][key] = (byUser[r.username][r.month][key] || 0) + (parseInt(r.cnt) || 0);
      });
    }
    inc(calls, 'calls');
    inc(visits, 'visits');
    inc(sales, 'sales');
    inc(edits, 'edits');

    res.json({ ok: true, months: monthList, byUser, nameMap });
  } catch (e) {
    console.error('[reports/activity-summary]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/competitor
router.get('/competitor', requireAuth, requireManager, async (req, res) => {
  try {
    const search = (req.query.search || req.query.q || '').trim();
    const r = await query(
      `WITH comp_rows AS (
         SELECT ce.center_key,
                trim(c.competitor) AS competitor,
                COALESCE(ce.data->>'nameOverride', ce.data->>'name', ce.center_key) AS center_name,
                COALESCE(ce.data->>'owner', '') AS owner
         FROM center_edits ce
         CROSS JOIN LATERAL (
           SELECT jsonb_array_elements_text(ce.data->'competitors') AS competitor
           WHERE jsonb_typeof(ce.data->'competitors') = 'array'
             AND jsonb_array_length(ce.data->'competitors') > 0
           UNION ALL
           SELECT trim(x) AS competitor
           FROM unnest(
             string_to_array(
               regexp_replace(COALESCE(ce.data->>'competitor', ''), '[،/]', ',', 'g'),
               ','
             )
           ) AS x
           WHERE (jsonb_typeof(ce.data->'competitors') IS DISTINCT FROM 'array'
                  OR COALESCE(jsonb_array_length(ce.data->'competitors'), 0) = 0)
             AND trim(x) <> ''
         ) c
         WHERE trim(c.competitor) <> ''
       )
       SELECT competitor,
              COUNT(DISTINCT center_key)::int AS cnt,
              jsonb_agg(DISTINCT jsonb_build_object(
                'centerKey', center_key,
                'centerName', center_name,
                'owner', owner
              )) AS centers
       FROM comp_rows
       WHERE ($1 = '' OR competitor ILIKE '%' || $1 || '%')
       GROUP BY competitor
       ORDER BY cnt DESC, competitor
       LIMIT 50`,
      [search]
    ).catch(() => ({ rows: [] }));
    res.json({ ok: true, rows: r.rows, search });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/coverage
router.get('/coverage', requireAuth, requireManager, async (req, res) => {
  try {
    const edits = await query(
      `SELECT center_key, data->>'owner' AS owner FROM center_edits`
    ).catch(() => ({ rows: [] }));
    const scheduled = await query(
      `SELECT DISTINCT rtype || '_' || rid AS center_key FROM week_entries WHERE done = FALSE`
    ).catch(() => ({ rows: [] }));
    const schedSet = new Set(scheduled.rows.map(r => r.center_key));
    let withOwner = 0, scheduledCount = 0;
    edits.rows.forEach(function (e) {
      if (e.owner) withOwner++;
      if (schedSet.has(e.center_key)) scheduledCount++;
    });
    res.json({
      ok: true,
      totalCenters: edits.rows.length,
      withOwner,
      scheduledInWeekPlan: scheduledCount,
      unowned: edits.rows.length - withOwner,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/pipeline-value — center oppValue by lead/status
router.get('/pipeline-value', requireAuth, requireManager, async (req, res) => {
  try {
    const r = await query(
      `SELECT data->>'lead' AS lead, data->>'status' AS status,
              COUNT(*)::int AS cnt,
              COALESCE(SUM((NULLIF(data->>'oppValue',''))::numeric),0) AS total_value
       FROM center_edits
       WHERE data->>'lead' IS NOT NULL
       GROUP BY 1, 2 ORDER BY total_value DESC`
    ).catch(() => ({ rows: [] }));
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

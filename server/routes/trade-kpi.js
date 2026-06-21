'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../auth');

function isManager(role) { return ['مدیر', 'سوپر ادمین'].includes(role); }
function isSuperAdmin(role) { return role === 'سوپر ادمین'; }
function canAccessTrade(role) { return ['مدیر', 'سوپر ادمین', 'کارشناس بازرگانی'].includes(role); }
function uid(prefix) { return (prefix || 't') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

// ── Score Calculation ────────────────────────────────────────────────────────
async function calcScore(employee, month, targets) {
  // 1. Customs clearances
  const clearancesR = await query(
    'SELECT * FROM trade_clearances WHERE employee=$1 AND jalali_month=$2',
    [employee, month]
  );
  const completed = clearancesR.rows.filter(function(r) { return r.status === 'completed'; });
  const customsCount = completed.length;
  const avgDays = completed.length > 0
    ? completed.reduce(function(s, r) { return s + (parseInt(r.actual_days) || 0); }, 0) / completed.length
    : 0;
  let customsScore = targets.customs_target > 0
    ? Math.min(100, (customsCount / targets.customs_target) * 100) : 0;
  if (avgDays > 0 && targets.customs_days_target > 0 && avgDays > targets.customs_days_target) {
    customsScore *= (targets.customs_days_target / avgDays);
  }

  // 2. Daily reports
  const reportsR = await query(
    'SELECT COUNT(*) AS cnt FROM trade_daily_reports WHERE employee=$1 AND jalali_month=$2',
    [employee, month]
  );
  const reportCount = parseInt(reportsR.rows[0].cnt) || 0;
  const workingDays = 26;
  const reportScore = Math.min(100, (reportCount / workingDays) * 100);

  // 3. Admin tasks
  const monthDash = month.replace('/', '-');
  const adminTasksR = await query(
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN status='done' OR completed_at IS NOT NULL THEN 1 END) AS done
     FROM trade_tasks WHERE assigned_to=$1
     AND (LEFT(deadline,7)=$2 OR LEFT(created_at::text,7)=$3)
     AND (category='admin' OR category='پیگیری اداری' OR category IS NULL)`,
    [employee, monthDash, monthDash]
  );
  const adminDone = parseInt(adminTasksR.rows[0] && adminTasksR.rows[0].done) || 0;
  const adminScore = targets.admin_target > 0
    ? Math.min(100, (adminDone / targets.admin_target) * 100) : 0;

  // 4. Suppliers (only approved count)
  const suppliersR = await query(
    'SELECT COUNT(*) AS cnt FROM trade_suppliers_new WHERE employee=$1 AND jalali_month=$2 AND approved_by IS NOT NULL',
    [employee, month]
  );
  const supplierCount = parseInt(suppliersR.rows[0] && suppliersR.rows[0].cnt) || 0;
  const supplierScore = targets.supplier_target > 0
    ? Math.min(100, (supplierCount / targets.supplier_target) * 100) : 0;

  // 5. Finance improvements (only verified)
  const financeR = await query(
    'SELECT COALESCE(SUM(amount),0) AS total FROM trade_finance_items WHERE employee=$1 AND jalali_month=$2 AND verified_by IS NOT NULL',
    [employee, month]
  );
  const financeTotal = parseFloat(financeR.rows[0] && financeR.rows[0].total) || 0;
  const financeScore = parseFloat(targets.finance_target) > 0
    ? Math.min(100, (financeTotal / parseFloat(targets.finance_target)) * 100) : 0;

  // 6. Team tasks
  const teamTasksR = await query(
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN status='done' THEN 1 END) AS done
     FROM trade_tasks WHERE assigned_to=$1 AND LEFT(created_at::text,7)=$2`,
    [employee, monthDash]
  );
  const teamTotal = parseInt(teamTasksR.rows[0] && teamTasksR.rows[0].total) || 0;
  const teamDone = parseInt(teamTasksR.rows[0] && teamTasksR.rows[0].done) || 0;
  const teamScore = teamTotal > 0 ? Math.min(100, (teamDone / teamTotal) * 100) : 100;

  // 7. Warehouse reconciliation
  const warehouseR = await query(
    'SELECT resolved FROM trade_warehouse_rec WHERE employee=$1 AND jalali_month=$2',
    [employee, month]
  );
  const warehouseScore = warehouseR.rows.length > 0
    ? (warehouseR.rows[0].resolved ? 100 : 40)
    : 0;

  // Final weighted score
  const w = targets;
  const totalWeight = parseFloat(w.customs_weight) + parseFloat(w.report_weight) +
    parseFloat(w.admin_weight) + parseFloat(w.supplier_weight) +
    parseFloat(w.finance_weight) + parseFloat(w.team_weight) + parseFloat(w.warehouse_weight);

  const finalScore = totalWeight > 0 ? (
    (customsScore * parseFloat(w.customs_weight) +
      reportScore * parseFloat(w.report_weight) +
      adminScore * parseFloat(w.admin_weight) +
      supplierScore * parseFloat(w.supplier_weight) +
      financeScore * parseFloat(w.finance_weight) +
      teamScore * parseFloat(w.team_weight) +
      warehouseScore * parseFloat(w.warehouse_weight)) / totalWeight
  ) : 0;

  return {
    final: Math.round(finalScore * 10) / 10,
    dimensions: {
      customs: {
        score: Math.round(customsScore),
        count: customsCount,
        avgDays: Math.round(avgDays * 10) / 10,
        target: parseInt(targets.customs_target),
        daysTarget: parseInt(targets.customs_days_target),
        weight: parseFloat(w.customs_weight)
      },
      report: {
        score: Math.round(reportScore),
        count: reportCount,
        workingDays: workingDays,
        weight: parseFloat(w.report_weight)
      },
      admin: {
        score: Math.round(adminScore),
        done: adminDone,
        target: parseInt(targets.admin_target),
        weight: parseFloat(w.admin_weight)
      },
      supplier: {
        score: Math.round(supplierScore),
        count: supplierCount,
        target: parseInt(targets.supplier_target),
        weight: parseFloat(w.supplier_weight)
      },
      finance: {
        score: Math.round(financeScore),
        total: financeTotal,
        target: parseFloat(targets.finance_target),
        weight: parseFloat(w.finance_weight)
      },
      team: {
        score: Math.round(teamScore),
        done: teamDone,
        total: teamTotal,
        weight: parseFloat(w.team_weight)
      },
      warehouse: {
        score: warehouseScore,
        resolved: (warehouseR.rows[0] && warehouseR.rows[0].resolved) || false,
        submitted: warehouseR.rows.length > 0,
        weight: parseFloat(w.warehouse_weight)
      }
    }
  };
}

function defaultTargets() {
  return {
    customs_target: 5, customs_days_target: 10, customs_weight: 20,
    report_weight: 15, admin_target: 10, admin_weight: 20,
    supplier_target: 2, supplier_weight: 15, finance_target: 0,
    finance_weight: 15, team_weight: 10, warehouse_weight: 5
  };
}

// ── Tasks ────────────────────────────────────────────────────────────────────
router.get('/tasks', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { status, category, assigned_to } = req.query;
    let where = [], params = [];
    if (!isManager(user.role)) {
      where.push('assigned_to=$' + (params.length + 1)); params.push(user.username);
    } else if (assigned_to) {
      where.push('assigned_to=$' + (params.length + 1)); params.push(assigned_to);
    }
    if (status) { where.push('status=$' + (params.length + 1)); params.push(status); }
    if (category) { where.push('category=$' + (params.length + 1)); params.push(category); }
    const sql = 'SELECT * FROM trade_tasks' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { title, category, assigned_to, deadline, priority, center_key, center_name, notes, status, stages, milestone_id } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی' });
    const id = uid('ttask');
    await query(
      `INSERT INTO trade_tasks (id,title,category,assigned_to,created_by,deadline,priority,center_key,center_name,notes,status,stages,milestone_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, title, category || 'other', assigned_to || user.username, user.username,
        deadline || null, priority || 2, center_key || null, center_name || null, notes || null,
        status || 'open', JSON.stringify(stages || []), milestone_id || null]
    );
    const { rows } = await query('SELECT * FROM trade_tasks WHERE id=$1', [id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tasks/:id', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    if (!isManager(user.role)) {
      const { rows } = await query('SELECT assigned_to FROM trade_tasks WHERE id=$1', [id]);
      if (!rows.length || rows[0].assigned_to !== user.username) return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const { title, category, assigned_to, deadline, completed_at, status, priority, center_key, center_name, notes, stages } = req.body;
    await query(
      `UPDATE trade_tasks SET
         title=COALESCE($2,title), category=COALESCE($3,category),
         assigned_to=COALESCE($4,assigned_to), deadline=$5,
         completed_at=$6, status=COALESCE($7,status), priority=COALESCE($8,priority),
         center_key=$9, center_name=$10, notes=$11,
         stages=COALESCE($12::jsonb,stages), updated_at=NOW()
       WHERE id=$1`,
      [id, title || null, category || null, assigned_to || null, deadline || null,
        completed_at || null, status || null, priority || null, center_key || null,
        center_name || null, notes || null, stages ? JSON.stringify(stages) : null]
    );
    const { rows } = await query('SELECT * FROM trade_tasks WHERE id=$1', [id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tasks/:id', requireAuth, async function(req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query('DELETE FROM trade_tasks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings (kanban columns) ────────────────────────────────────────────────
router.get('/settings', requireAuth, async function(req, res) {
  try {
    const { rows } = await query("SELECT value FROM app_data WHERE key='trade_settings'");
    res.json(rows.length ? rows[0].value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', requireAuth, async function(req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query(
      "INSERT INTO app_data (key,value) VALUES ('trade_settings',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=$1::jsonb, updated_at=NOW()",
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Milestones ───────────────────────────────────────────────────────────────
router.get('/milestones', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { rows } = isManager(user.role)
      ? await query('SELECT * FROM trade_milestones ORDER BY created_at DESC')
      : await query('SELECT * FROM trade_milestones WHERE employee=$1 ORDER BY created_at DESC', [user.username]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/milestones', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { employee, project_type, title, description, metric_value, metric_unit, bonus_amount, achieved_at, notes } = req.body;
    if (!project_type || !title) return res.status(400).json({ error: 'اطلاعات ناقص' });
    const emp = isManager(user.role) ? (employee || user.username) : user.username;
    const id = uid('ms');
    await query(
      `INSERT INTO trade_milestones (id,employee,project_type,title,description,metric_value,metric_unit,bonus_amount,achieved_at,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, emp, project_type, title, description || null, metric_value || null, metric_unit || null, bonus_amount || null, achieved_at || null, notes || null]
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/milestones/:id', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { status, notes, bonus_amount } = req.body;
    if (status && ['approved', 'paid'].includes(status) && !isManager(user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const approved_by = isManager(user.role) ? user.username : null;
    await query(
      `UPDATE trade_milestones SET status=COALESCE($2,status), notes=COALESCE($3,notes),
       bonus_amount=COALESCE($4,bonus_amount), approved_by=COALESCE($5,approved_by) WHERE id=$1`,
      [req.params.id, status || null, notes || null, bonus_amount || null, approved_by || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/milestones/:id', requireAuth, async function(req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query('DELETE FROM trade_milestones WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── KPI History ──────────────────────────────────────────────────────────────
router.get('/kpi-history/:employee', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { employee } = req.params;
    if (!isManager(user.role) && user.username !== employee) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { rows } = await query(
      'SELECT * FROM trade_kpi_monthly WHERE employee=$1 ORDER BY month DESC LIMIT 6',
      [employee]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Finalize ─────────────────────────────────────────────────────────────────
router.post('/finalize/:employee/:month', requireAuth, async function(req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { employee, month } = req.params;
    const { notes } = req.body;
    const tgR = await query('SELECT * FROM trade_kpi_targets WHERE employee=$1 AND month=$2', [employee, month]);
    const tg = tgR.rows[0] || defaultTargets();
    const scoreData = await calcScore(employee, month, tg);
    const id = uid('kpim');
    await query(
      `INSERT INTO trade_kpi_monthly (id,employee,month,final_score,dimensions,targets,gate_passed,finalized,finalized_at,notes)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,true,NOW(),$8)
       ON CONFLICT (employee,month) DO UPDATE SET
         final_score=$4,dimensions=$5::jsonb,targets=$6::jsonb,
         gate_passed=$7,finalized=true,finalized_at=NOW(),notes=$8`,
      [id, employee, month, scoreData.final,
        JSON.stringify(scoreData.dimensions), JSON.stringify(tg),
        scoreData.final >= 80, notes || null]
    );
    res.json({ ok: true, score: scoreData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── KPI Targets ──────────────────────────────────────────────────────────────
router.get('/targets/:employee/:month', requireAuth, async function(req, res) {
  try {
    const r = await query(
      'SELECT * FROM trade_kpi_targets WHERE employee=$1 AND month=$2',
      [req.params.employee, req.params.month]
    );
    res.json(r.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/targets/:employee/:month', requireAuth, async function(req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { employee, month } = req.params;
    const {
      customs_target, customs_days_target, customs_weight, report_weight,
      admin_target, admin_weight, supplier_target, supplier_weight,
      finance_target, finance_weight, team_weight, warehouse_weight
    } = req.body;
    const id = employee + '_' + month;
    await query(
      `INSERT INTO trade_kpi_targets
         (id,employee,month,customs_target,customs_days_target,customs_weight,report_weight,
          admin_target,admin_weight,supplier_target,supplier_weight,finance_target,finance_weight,
          team_weight,warehouse_weight,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (employee,month) DO UPDATE SET
         customs_target=$4,customs_days_target=$5,customs_weight=$6,report_weight=$7,
         admin_target=$8,admin_weight=$9,supplier_target=$10,supplier_weight=$11,
         finance_target=$12,finance_weight=$13,team_weight=$14,warehouse_weight=$15`,
      [id, employee, month,
        customs_target || 5, customs_days_target || 10, customs_weight || 20,
        report_weight || 15, admin_target || 10, admin_weight || 20,
        supplier_target || 2, supplier_weight || 15, finance_target || 0,
        finance_weight || 15, team_weight || 10, warehouse_weight || 5,
        req.user.username]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Score ────────────────────────────────────────────────────────────────────
router.get('/score/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const tgR = await query('SELECT * FROM trade_kpi_targets WHERE employee=$1 AND month=$2', [employee, month]);
    const tg = tgR.rows[0] || defaultTargets();
    const scoreData = await calcScore(employee, month, tg);
    res.json(scoreData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Clearances ───────────────────────────────────────────────────────────────
router.get('/clearances/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM trade_clearances WHERE employee=$1 AND jalali_month=$2 ORDER BY created_at DESC',
      [employee, month]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clearances', requireAuth, async function(req, res) {
  try {
    const { employee, jalali_month, title, start_date, target_days, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی' });
    const id = 'cl_' + Date.now();
    await query(
      'INSERT INTO trade_clearances (id,employee,jalali_month,title,start_date,target_days,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, employee || req.user.username, jalali_month, title, start_date || null, target_days || 10, notes || null]
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/clearances/:id', requireAuth, async function(req, res) {
  try {
    const { status, end_date, actual_days, notes } = req.body;
    // Auto-calculate actual_days if completing and start/end known
    let days = actual_days || null;
    if (!days && status === 'completed' && end_date) {
      const rowR = await query('SELECT start_date FROM trade_clearances WHERE id=$1', [req.params.id]);
      if (rowR.rows[0] && rowR.rows[0].start_date) {
        // Both are Jalali YYYY/MM/DD strings — approximate via days between
        // Simple approach: pass actual_days from client; if not provided, leave null
      }
    }
    await query(
      `UPDATE trade_clearances SET
         status=COALESCE($1,status), end_date=COALESCE($2,end_date),
         actual_days=COALESCE($3,actual_days), notes=COALESCE($4,notes)
       WHERE id=$5`,
      [status || null, end_date || null, days, notes || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/clearances/:id', requireAuth, async function(req, res) {
  try {
    await query('DELETE FROM trade_clearances WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Daily Reports ────────────────────────────────────────────────────────────
router.get('/reports/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM trade_daily_reports WHERE employee=$1 AND jalali_month=$2 ORDER BY report_date DESC',
      [employee, month]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/reports', requireAuth, async function(req, res) {
  try {
    const { employee, jalali_month, report_date, summary, activities, issues } = req.body;
    if (!report_date || !jalali_month) return res.status(400).json({ error: 'تاریخ الزامی' });
    const emp = employee || req.user.username;
    const id = 'rpt_' + Date.now();
    await query(
      `INSERT INTO trade_daily_reports (id,employee,jalali_month,report_date,summary,activities,issues)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (employee,report_date) DO UPDATE SET summary=$5,activities=$6,issues=$7`,
      [id, emp, jalali_month, report_date, summary || null, activities || null, issues || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Suppliers ────────────────────────────────────────────────────────────────
router.get('/suppliers/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM trade_suppliers_new WHERE employee=$1 AND jalali_month=$2 ORDER BY created_at DESC',
      [employee, month]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers', requireAuth, async function(req, res) {
  try {
    const { employee, jalali_month, company_name, country, product_category } = req.body;
    if (!company_name) return res.status(400).json({ error: 'نام الزامی' });
    const id = 'sup_' + Date.now();
    await query(
      'INSERT INTO trade_suppliers_new (id,employee,jalali_month,company_name,country,product_category) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, employee || req.user.username, jalali_month, company_name, country || '', product_category || '']
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/suppliers/:id', requireAuth, async function(req, res) {
  try {
    if (req.body.approved) {
      if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
      await query(
        'UPDATE trade_suppliers_new SET approved_by=$1, status=$2 WHERE id=$3',
        [req.user.username, 'qualified', req.params.id]
      );
    } else {
      const { company_name, country, product_category, status, notes } = req.body;
      await query(
        `UPDATE trade_suppliers_new SET
           company_name=COALESCE($1,company_name), country=COALESCE($2,country),
           product_category=COALESCE($3,product_category), status=COALESCE($4,status),
           notes=COALESCE($5,notes)
         WHERE id=$6`,
        [company_name || null, country || null, product_category || null, status || null, notes || null, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:id', requireAuth, async function(req, res) {
  try {
    await query('DELETE FROM trade_suppliers_new WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Finance Items ────────────────────────────────────────────────────────────
router.get('/finance/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM trade_finance_items WHERE employee=$1 AND jalali_month=$2 ORDER BY created_at DESC',
      [employee, month]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/finance', requireAuth, async function(req, res) {
  try {
    const { employee, jalali_month, title, type, amount, description } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی' });
    const id = 'fin_' + Date.now();
    await query(
      'INSERT INTO trade_finance_items (id,employee,jalali_month,title,type,amount,description) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, employee || req.user.username, jalali_month, title, type || 'cost_reduction', amount || 0, description || null]
    );
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/finance/:id', requireAuth, async function(req, res) {
  try {
    if (req.body.verified) {
      if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
      await query(
        'UPDATE trade_finance_items SET verified_by=$1, status=$2 WHERE id=$3',
        [req.user.username, 'verified', req.params.id]
      );
    } else {
      const { title, type, amount, description, status } = req.body;
      await query(
        `UPDATE trade_finance_items SET
           title=COALESCE($1,title), type=COALESCE($2,type),
           amount=COALESCE($3,amount), description=COALESCE($4,description),
           status=COALESCE($5,status)
         WHERE id=$6`,
        [title || null, type || null, amount || null, description || null, status || null, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/finance/:id', requireAuth, async function(req, res) {
  try {
    await query('DELETE FROM trade_finance_items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Warehouse Reconciliation ─────────────────────────────────────────────────
router.get('/warehouse/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    if (!isManager(req.user.role) && req.user.username !== employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM trade_warehouse_rec WHERE employee=$1 AND jalali_month=$2',
      [employee, month]
    );
    res.json(r.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/warehouse/:employee/:month', requireAuth, async function(req, res) {
  try {
    const { employee, month } = req.params;
    const { gov_count, real_count, software_count, discrepancies, resolved } = req.body;
    const id = 'wrec_' + employee + '_' + month.replace('/', '_');
    await query(
      `INSERT INTO trade_warehouse_rec (id,employee,jalali_month,gov_count,real_count,software_count,discrepancies,resolved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (employee,jalali_month) DO UPDATE SET
         gov_count=$4,real_count=$5,software_count=$6,discrepancies=$7,resolved=$8`,
      [id, employee, month, gov_count || 0, real_count || 0, software_count || 0, discrepancies || '', resolved || false]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Trade employees list ─────────────────────────────────────────────────────
router.get('/employees', requireAuth, async function(req, res) {
  try {
    const { rows } = await query(
      "SELECT username, display_name FROM app_users WHERE active=true ORDER BY display_name"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

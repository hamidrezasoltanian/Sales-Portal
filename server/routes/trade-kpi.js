'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../db');

const { requireAuth } = require('../auth');
function isManager(role) { return ['مدیر', 'سوپر ادمین'].includes(role); }
function isSuperAdmin(role) { return role === 'سوپر ادمین'; }
function canAccessTrade(role) { return ['مدیر', 'سوپر ادمین', 'کارشناس بازرگانی'].includes(role); }
function uid(prefix) { return (prefix||'t') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── Tasks ────────────────────────────────────────────────────────────────
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { status, category, assigned_to } = req.query;
    let where = [], params = [];
    if (!isManager(user.role)) { where.push(`assigned_to=$${params.length+1}`); params.push(user.username); }
    else if (assigned_to) { where.push(`assigned_to=$${params.length+1}`); params.push(assigned_to); }
    if (status) { where.push(`status=$${params.length+1}`); params.push(status); }
    if (category) { where.push(`category=$${params.length+1}`); params.push(category); }
    const sql = `SELECT * FROM trade_tasks${where.length?' WHERE '+where.join(' AND '):''} ORDER BY created_at DESC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { title, category, assigned_to, deadline, priority, center_key, center_name, notes, status, stages, milestone_id } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی' });
    const id = uid('ttask');
    await query(
      `INSERT INTO trade_tasks (id,title,category,assigned_to,created_by,deadline,priority,center_key,center_name,notes,status,stages,milestone_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, title, category||'other', assigned_to||user.username, user.username,
       deadline||null, priority||2, center_key||null, center_name||null, notes||null,
       status||'open', JSON.stringify(stages||[]), milestone_id||null]
    );
    const { rows } = await query('SELECT * FROM trade_tasks WHERE id=$1', [id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
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
      [id, title||null, category||null, assigned_to||null, deadline||null,
       completed_at||null, status||null, priority||null, center_key||null,
       center_name||null, notes||null, stages ? JSON.stringify(stages) : null]
    );
    const { rows } = await query('SELECT * FROM trade_tasks WHERE id=$1', [id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query('DELETE FROM trade_tasks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── KPI ──────────────────────────────────────────────────────────────────
async function calcLiveKPI(employee, month) {
  const { rows } = await query(
    'SELECT indicator, SUM(points)::int AS total FROM trade_kpi_deductions WHERE employee=$1 AND month=$2 GROUP BY indicator',
    [employee, month]
  );
  const s = { customs:100, sla:100, traceability:100, reporting:100, teamwork:100 };
  rows.forEach(function(r){ if(s.hasOwnProperty(r.indicator)) s[r.indicator] = Math.max(0, 100 - (r.total||0)); });
  const avg = (s.customs + s.sla + s.traceability + s.reporting + s.teamwork) / 5;
  return { scores: s, avg: Math.round(avg*100)/100, gate_passed: avg >= 80 };
}

router.get('/kpi/:employee/:month', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { employee, month } = req.params;
    if (!isManager(user.role) && user.username !== employee) return res.status(403).json({ error: 'دسترسی ندارید' });
    const fin = await query('SELECT * FROM trade_kpi_monthly WHERE employee=$1 AND month=$2', [employee, month]);
    if (fin.rows.length && fin.rows[0].finalized) return res.json({ finalized: true, data: fin.rows[0], deductions: [] });
    const live = await calcLiveKPI(employee, month);
    const deds = await query('SELECT * FROM trade_kpi_deductions WHERE employee=$1 AND month=$2 ORDER BY created_at', [employee, month]);
    res.json({ finalized: false, live, deductions: deds.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/kpi-history/:employee', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { employee } = req.params;
    if (!isManager(user.role) && user.username !== employee) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { rows } = await query('SELECT * FROM trade_kpi_monthly WHERE employee=$1 ORDER BY month DESC LIMIT 12', [employee]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deductions', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { employee, month, indicator, points, reason, ref_task_id } = req.body;
    if (!employee || !month || !indicator || !points || !reason) return res.status(400).json({ error: 'اطلاعات ناقص' });
    const id = uid('ded');
    await query(
      'INSERT INTO trade_kpi_deductions (id,employee,month,indicator,points,reason,ref_task_id,registered_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, employee, month, indicator, parseInt(points), reason, ref_task_id||null, req.user.username]
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/deductions/:id', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query('DELETE FROM trade_kpi_deductions WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/finalize/:employee/:month', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { employee, month } = req.params;
    const { notes } = req.body;
    const live = await calcLiveKPI(employee, month);
    const bonus = live.gate_passed ? 5000000 : 0;
    const id = uid('kpim');
    await query(
      `INSERT INTO trade_kpi_monthly
         (id,employee,month,score_customs,score_sla,score_traceability,score_reporting,score_teamwork,avg_score,gate_passed,hygiene_bonus,finalized,finalized_at,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW(),$12)
       ON CONFLICT (employee,month) DO UPDATE SET
         score_customs=$4,score_sla=$5,score_traceability=$6,score_reporting=$7,score_teamwork=$8,
         avg_score=$9,gate_passed=$10,hygiene_bonus=$11,finalized=true,finalized_at=NOW(),notes=$12`,
      [id, employee, month, live.scores.customs, live.scores.sla, live.scores.traceability,
       live.scores.reporting, live.scores.teamwork, live.avg, live.gate_passed, bonus, notes||null]
    );
    res.json({ ok: true, live, bonus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Milestones ───────────────────────────────────────────────────────────
router.get('/milestones', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { rows } = isManager(user.role)
      ? await query('SELECT * FROM trade_milestones ORDER BY created_at DESC')
      : await query('SELECT * FROM trade_milestones WHERE employee=$1 ORDER BY created_at DESC', [user.username]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/milestones', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { employee, project_type, title, description, metric_value, metric_unit, bonus_amount, achieved_at, notes } = req.body;
    if (!project_type || !title) return res.status(400).json({ error: 'اطلاعات ناقص' });
    const emp = isManager(user.role) ? (employee||user.username) : user.username;
    const id = uid('ms');
    await query(
      `INSERT INTO trade_milestones (id,employee,project_type,title,description,metric_value,metric_unit,bonus_amount,achieved_at,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, emp, project_type, title, description||null, metric_value||null, metric_unit||null, bonus_amount||null, achieved_at||null, notes||null]
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/milestones/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canAccessTrade(user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
    const { status, notes, bonus_amount } = req.body;
    if (status && ['approved','paid'].includes(status) && !isManager(user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const approved_by = isManager(user.role) ? user.username : null;
    await query(
      `UPDATE trade_milestones SET status=COALESCE($2,status), notes=COALESCE($3,notes),
       bonus_amount=COALESCE($4,bonus_amount), approved_by=COALESCE($5,approved_by) WHERE id=$1`,
      [req.params.id, status||null, notes||null, bonus_amount||null, approved_by||null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Salary (super-admin only) ────────────────────────────────────────────
router.get('/salary/:employee', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user.role)) return res.status(403).json({ error: 'فقط سوپر ادمین' });
    const { rows } = await query('SELECT salary_amount, salary_level FROM employees WHERE username=$1', [req.params.employee]);
    res.json(rows[0] || { salary_amount: null, salary_level: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/salary/:employee', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user.role)) return res.status(403).json({ error: 'فقط سوپر ادمین' });
    const { salary_amount } = req.body;
    await query('UPDATE employees SET salary_amount=$1 WHERE username=$2', [salary_amount, req.params.employee]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings (kanban columns) ─────────────────────────────────────────────
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const { rows } = await query("SELECT value FROM app_data WHERE key='trade_settings'");
    res.json(rows.length ? rows[0].value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await query(
      "INSERT INTO app_data (key,value) VALUES ('trade_settings',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=$1::jsonb, updated_at=NOW()",
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Trade employees list (for manager to select target employee) ───────────
router.get('/employees', requireAuth, async (req, res) => {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { rows } = await query("SELECT username, full_name, position FROM employees WHERE active=true AND department='بازرگانی'");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

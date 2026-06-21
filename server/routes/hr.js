'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../db');

const { requireAuth } = require('../auth');

function isManagerRole(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}

// ── GET /api/hr/employees ────────────────────────────────────────────────────
router.get('/employees', requireAuth, async function(req, res) {
  try {
    const r = await query(
      `SELECT e.*, u.display_name AS user_display_name, u.role AS user_role, u.color AS user_color
       FROM employees e
       LEFT JOIN app_users u ON u.username = e.username
       WHERE e.active = true
       ORDER BY e.department, e.full_name`
    );
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/hr/employees ───────────────────────────────────────────────────
router.post('/employees', requireAuth, async function(req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { username, full_name, national_id, hire_date, department, position, manager, phone, salary_level, employment_type, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'نام الزامی است' });

    const id = 'emp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const r = await query(
      `INSERT INTO employees (id, username, full_name, national_id, hire_date, department, position, manager, phone, salary_level, employment_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, username || null, full_name, national_id || null, hire_date || null,
       department || null, position || null, manager || null, phone || null,
       parseInt(salary_level) || 2, employment_type || 'full_time', notes || null]
    );

    // Initialize leave balance for this year
    const year = new Date().getFullYear();
    const empId = username || id;
    await query(
      `INSERT INTO leave_balance (employee, annual_total, annual_used, year)
       VALUES ($1, 30, 0, $2) ON CONFLICT (employee) DO NOTHING`,
      [empId, year]
    );

    res.status(201).json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/hr/employees/:id ────────────────────────────────────────────────
router.get('/employees/:id', requireAuth, async function(req, res) {
  try {
    const r = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    res.json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/hr/employees/:id ────────────────────────────────────────────────
router.put('/employees/:id', requireAuth, async function(req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { full_name, national_id, hire_date, department, position, manager, phone, salary_level, employment_type, notes, active } = req.body;

    const r = await query(
      `UPDATE employees SET
         full_name = COALESCE($2, full_name),
         national_id = COALESCE($3, national_id),
         hire_date = COALESCE($4, hire_date),
         department = COALESCE($5, department),
         position = COALESCE($6, position),
         manager = COALESCE($7, manager),
         phone = COALESCE($8, phone),
         salary_level = COALESCE($9, salary_level),
         employment_type = COALESCE($10, employment_type),
         notes = COALESCE($11, notes),
         active = COALESCE($12, active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, full_name, national_id, hire_date, department, position,
       manager, phone, salary_level ? parseInt(salary_level) : null,
       employment_type, notes, active !== undefined ? active : null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    res.json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/hr/leave ────────────────────────────────────────────────────────
router.get('/leave', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const { status, employee } = req.query;

    const conditions = [];
    const params = [];

    if (!isMgr) {
      params.push(user.username);
      conditions.push('employee = $' + params.length);
    } else if (employee) {
      params.push(employee);
      conditions.push('employee = $' + params.length);
    }

    if (status) {
      params.push(status);
      conditions.push('status = $' + params.length);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const r = await query(`SELECT * FROM leave_requests ${where} ORDER BY created_at DESC LIMIT 100`, params);
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/hr/leave ───────────────────────────────────────────────────────
router.post('/leave', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const { type, from_date, to_date, days, reason } = req.body;
    if (!from_date || !to_date) return res.status(400).json({ error: 'تاریخ الزامی است' });

    const id = 'lv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const r = await query(
      `INSERT INTO leave_requests (id, employee, type, from_date, to_date, days, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, user.username, type || 'annual', from_date, to_date, parseFloat(days) || 1, reason || null]
    );

    // Notify manager
    try {
      const managers = await query(`SELECT username FROM app_users WHERE role IN ('مدیر','سوپر ادمین') AND active = true`);
      for (const mgr of managers.rows) {
        await query(
          `INSERT INTO notifications (id, to_user, msg, at) VALUES ($1, $2, $3, NOW())`,
          ['ntf_' + Date.now() + '_' + mgr.username,
           mgr.username,
           '📋 درخواست مرخصی از ' + user.username + ': ' + from_date + ' تا ' + to_date]
        );
      }
    } catch(_) {}

    res.status(201).json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/hr/leave/:id ────────────────────────────────────────────────────
router.put('/leave/:id', requireAuth, async function(req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'وضعیت نامعتبر' });

    const r = await query(
      `UPDATE leave_requests SET status = $2, approved_by = $3 WHERE id = $1 RETURNING *`,
      [req.params.id, status, req.user.username]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'درخواست یافت نشد' });

    const leave = r.rows[0];

    // Update balance if approved
    if (status === 'approved' && leave.type === 'annual') {
      await query(
        `INSERT INTO leave_balance (employee, annual_total, annual_used, year)
         VALUES ($1, 30, $2, $3)
         ON CONFLICT (employee) DO UPDATE SET annual_used = leave_balance.annual_used + $2`,
        [leave.employee, parseFloat(leave.days) || 0, new Date().getFullYear()]
      );
    }

    // Notify employee
    try {
      await query(
        `INSERT INTO notifications (id, to_user, msg, at) VALUES ($1, $2, $3, NOW())`,
        ['ntf_' + Date.now(), leave.employee,
         (status === 'approved' ? '✅ مرخصی تأیید شد: ' : '❌ مرخصی رد شد: ') + leave.from_date + ' تا ' + leave.to_date]
      );
    } catch(_) {}

    res.json(leave);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/hr/leave/balance/:employee ──────────────────────────────────────
router.get('/leave/balance/:employee', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    if (!isManagerRole(user.role) && user.username !== req.params.employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query('SELECT * FROM leave_balance WHERE employee = $1', [req.params.employee]);
    res.json(r.rows[0] || { employee: req.params.employee, annual_total: 30, annual_used: 0, year: new Date().getFullYear() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

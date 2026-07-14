'use strict';

const express = require('express');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const hrLeave = require('../lib/hr-leave');
const employeeContract = require('../lib/employee-contract');

const router = express.Router();
router.use(requireAuth);

function hrView(req, res, next) { return requirePermission('hr', 'view')(req, res, next); }
function hrEdit(req, res, next) { return requirePermission('hr', 'edit')(req, res, next); }

function isManagerRole(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

async function notifyUser(toUser, msg) {
  try {
    await query(
      'INSERT INTO notifications (id, to_user, msg, at) VALUES ($1, $2, $3, NOW())',
      [uid('ntf_'), toUser, msg]
    );
  } catch (_) {}
}

async function syncEmployeeFromUsers() {
  const users = await query(
    `SELECT username, display_name, role, department, direct_manager FROM app_users WHERE active = true`
  );
  for (const u of users.rows) {
    const ex = await query('SELECT id FROM employees WHERE username = $1', [u.username]);
    if (ex.rows.length) {
      await query(
        `UPDATE employees SET manager = COALESCE(NULLIF(manager,''), $2) WHERE username = $1 AND (manager IS NULL OR manager = '')`,
        [u.username, u.direct_manager || '']
      ).catch(function () {});
      continue;
    }
    const id = uid('emp_');
    const dept = u.department || (
      u.role === 'بازرگانی' ? 'بازرگانی' :
      u.role === 'کارشناس فروش' ? 'فروش' :
      u.role === 'مدیر' ? 'مدیریت' : 'عمومی'
    );
    await query(
      `INSERT INTO employees (id, username, full_name, department, position, manager, employment_type)
       VALUES ($1,$2,$3,$4,$5,$6,'full_time') ON CONFLICT DO NOTHING`,
      [id, u.username, u.display_name, dept, u.role, u.direct_manager || '']
    );
    await hrLeave.ensureLeaveBalance(u.username, hrLeave.currentJalaliYear());
  }
}

// ── Employees ───────────────────────────────────────────────────────────────

router.get('/employees', hrView, async function (req, res) {
  try {
    await syncEmployeeFromUsers();
    const isMgr = isManagerRole(req.user.role);
    let r;
    if (isMgr) {
      r = await query(
        `SELECT e.*, u.display_name AS user_display_name, u.role AS user_role,
                u.color AS user_color, u.department AS user_department
         FROM employees e LEFT JOIN app_users u ON u.username = e.username
         WHERE e.active = true ORDER BY e.department, e.full_name`
      );
    } else {
      r = await query(
        `SELECT e.*, u.display_name AS user_display_name, u.role AS user_role,
                u.color AS user_color, u.department AS user_department
         FROM employees e LEFT JOIN app_users u ON u.username = e.username
         WHERE e.active = true AND e.username = $1`,
        [req.user.username]
      );
    }
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/contracts/expiring', hrView, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const today = require('../lib/jalali-mini').todayJalaliStr();
    const limit = require('../lib/jalali-mini').addJalaliDays(today, days);
    const r = await query(
      `SELECT id, username, full_name, contract_end_date, department
       FROM employees WHERE active = true AND contract_end_date IS NOT NULL AND contract_end_date != ''
         AND contract_end_date >= $1 AND contract_end_date <= $2
       ORDER BY contract_end_date`,
      [today, limit]
    );
    res.json({ items: r.rows, days, today });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/employees', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const body = req.body || {};
    if (!body.full_name) return res.status(400).json({ error: 'نام الزامی است' });
    const id = uid('emp_');
    const r = await query(
      `INSERT INTO employees (id, username, full_name, national_id, hire_date, contract_end_date,
        department, position, manager, phone, salary_level, employment_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, body.username || null, body.full_name, body.national_id || null, body.hire_date || null,
        body.contract_end_date || null, body.department || null, body.position || null,
        body.manager || null, body.phone || null, parseInt(body.salary_level, 10) || 2,
        body.employment_type || 'full_time', body.notes || null]
    );
    const empKey = body.username || id;
    await hrLeave.ensureLeaveBalance(empKey, hrLeave.currentJalaliYear());
    if (body.username && (body.salary_insurable != null || body.salary_non_insurable != null)) {
      await employeeContract.upsertEmployeeContract(body.username, body, req.user.username);
    }
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'کد ملی تکراری است' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/employees/:id', hrView, async function (req, res) {
  try {
    const r = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    if (!isManagerRole(req.user.role) && r.rows[0].username !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/employees/:id/contract', hrView, async function (req, res) {
  try {
    const r = await query('SELECT username FROM employees WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    if (!isManagerRole(req.user.role) && r.rows[0].username !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (!r.rows[0].username) return res.json(null);
    const contract = await employeeContract.getActiveContract(r.rows[0].username);
    res.json(contract);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/employees/:id/contract', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const r = await query('SELECT username FROM employees WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    if (!r.rows[0].username) {
      return res.status(400).json({ error: 'ابتدا نام کاربری سیستم را برای کارمند ثبت کنید' });
    }
    const saved = await employeeContract.upsertEmployeeContract(
      r.rows[0].username, req.body || {}, req.user.username
    );
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/employees/:id', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const b = req.body || {};
    const r = await query(
      `UPDATE employees SET
         full_name = COALESCE($2, full_name), national_id = COALESCE($3, national_id),
         hire_date = COALESCE($4, hire_date), contract_end_date = COALESCE($5, contract_end_date),
         department = COALESCE($6, department), position = COALESCE($7, position),
         manager = COALESCE($8, manager), phone = COALESCE($9, phone),
         salary_level = COALESCE($10, salary_level), employment_type = COALESCE($11, employment_type),
         notes = COALESCE($12, notes), active = COALESCE($13, active)
       WHERE id = $1 RETURNING *`,
      [req.params.id, b.full_name, b.national_id, b.hire_date, b.contract_end_date, b.department,
        b.position, b.manager, b.phone, b.salary_level != null ? parseInt(b.salary_level, 10) : null,
        b.employment_type, b.notes, b.active !== undefined ? b.active : null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    if (b.username && r.rows[0].username !== b.username) {
      await query('UPDATE employees SET username = $2 WHERE id = $1', [req.params.id, b.username]);
    }
    const empUsername = b.username || r.rows[0].username;
    if (empUsername && (b.salary_insurable != null || b.salary_non_insurable != null)) {
      await employeeContract.upsertEmployeeContract(empUsername, b, req.user.username);
    }
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'کد ملی تکراری است' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/offboard/:id', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const reason = (req.body && req.body.reason) || '';
    const reassignTo = req.body && req.body.reassignTo;
    const r = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const emp = r.rows[0];
    if (emp.username && reassignTo) {
      await query(
        `UPDATE tasks SET owner = $1, updated_at = NOW() WHERE owner = $2 AND done = false`,
        [reassignTo, emp.username]
      );
      await query(
        `UPDATE week_entries SET added_by = $1, updated_at = NOW() WHERE added_by = $2 AND done = false`,
        [reassignTo, emp.username]
      );
    }
    await query(
      `UPDATE employees SET active = false, offboarded_at = NOW(), offboard_reason = $2 WHERE id = $1`,
      [req.params.id, reason]
    );
    if (emp.username) {
      await query('UPDATE app_users SET active = false WHERE username = $1', [emp.username]).catch(function () {});
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Leave ───────────────────────────────────────────────────────────────────

router.get('/leave', hrView, async function (req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const conditions = [];
    const params = [];
    if (!isMgr) {
      params.push(user.username);
      conditions.push('employee = $' + params.length);
    } else if (req.query.employee) {
      params.push(req.query.employee);
      conditions.push('employee = $' + params.length);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push('status = $' + params.length);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const r = await query(`SELECT * FROM leave_requests ${where} ORDER BY created_at DESC LIMIT 200`, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/leave/balance/:employee', hrView, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role) && req.user.username !== req.params.employee) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const bal = await hrLeave.getLeaveBalance(req.params.employee);
    res.json(bal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/leave/:id', hrView, async function (req, res) {
  try {
    const r = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const row = r.rows[0];
    if (!isManagerRole(req.user.role) && row.employee !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/leave', hrView, async function (req, res) {
  try {
    const user = req.user;
    const b = req.body || {};
    const validation = await hrLeave.validateLeaveRequest({
      employee: user.username,
      type: b.type || 'annual',
      from_date: b.from_date,
      to_date: b.to_date,
      is_half_day: !!b.is_half_day,
      days: b.days,
      medical_doc_note: b.medical_doc_note,
    });
    if (validation.error) return res.status(validation.status || 400).json({ error: validation.error });

    const id = uid('lv_');
    const r = await query(
      `INSERT INTO leave_requests (id, employee, type, from_date, to_date, days, reason, is_half_day,
        half_day_period, medical_doc_note, working_days_calc, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
      [id, user.username, b.type || 'annual', b.from_date, b.to_date, validation.workingDays,
        b.reason || null, !!b.is_half_day, b.half_day_period || null, b.medical_doc_note || null,
        validation.workingDays]
    );

    const approver = await hrLeave.resolveApprover(user.username, b.from_date);
    if (approver) {
      await notifyUser(approver, '📋 درخواست مرخصی از ' + user.username + ': ' + b.from_date + ' تا ' + b.to_date);
    }
    try { require('../lib/inbox-hooks').onLeaveChange(id); } catch (_) {}

    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/leave/:id', hrEdit, async function (req, res) {
  try {
    const status = req.body && req.body.status;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'وضعیت نامعتبر' });
    }
    const existing = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const leave = existing.rows[0];
    if (!(await hrLeave.canUserApproveLeave(req.user, leave))) {
      return res.status(403).json({ error: 'شما تأییدکننده این درخواست نیستید' });
    }

    let result;
    if (status === 'approved') {
      result = await hrLeave.approveLeaveAtomic(req.params.id, req.user.username);
    } else {
      result = await hrLeave.rejectLeave(req.params.id, req.user.username);
    }
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    await notifyUser(
      result.leave.employee,
      (status === 'approved' ? '✅ مرخصی تأیید شد: ' : '❌ مرخصی رد شد: ') +
        result.leave.from_date + ' تا ' + result.leave.to_date
    );
    try { require('../lib/inbox-hooks').onLeaveChange(req.params.id); } catch (_) {}
    res.json(result.leave);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/leave/:id/cancel', hrView, async function (req, res) {
  try {
    const result = await hrLeave.cancelLeaveAtomic(
      req.params.id,
      req.user.username,
      isManagerRole(req.user.role),
      req.body && req.body.reason
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    try { require('../lib/inbox-hooks').onLeaveChange(req.params.id); } catch (_) {}
    res.json(result.leave);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Delegation ──────────────────────────────────────────────────────────────

router.get('/delegations', hrView, async function (req, res) {
  try {
    const isMgr = isManagerRole(req.user.role);
    const params = [];
    let sql = 'SELECT * FROM approval_delegations WHERE active = TRUE';
    if (!isMgr) {
      params.push(req.user.username);
      sql += ' AND (approver = $1 OR delegate_username = $1)';
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/delegations', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    if (!b.delegate_username || !b.from_date || !b.to_date) {
      return res.status(400).json({ error: 'فیلدهای الزامی ناقص است' });
    }
    const approver = b.approver || req.user.username;
    if (!isManagerRole(req.user.role) && approver !== req.user.username) {
      return res.status(403).json({ error: 'فقط برای خودتان می‌توانید جانشین تعیین کنید' });
    }
    const id = uid('dlg_');
    const r = await query(
      `INSERT INTO approval_delegations (id, approver, delegate_username, from_date, to_date, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, approver, b.delegate_username, b.from_date, b.to_date, b.reason || null, req.user.username]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Disciplinary ──────────────────────────────────────────────────────────────

router.get('/disciplinary', hrView, async function (req, res) {
  try {
    const isMgr = isManagerRole(req.user.role);
    if (!isMgr && req.query.employee !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const params = [];
    let sql = 'SELECT * FROM disciplinary_actions WHERE active = TRUE';
    if (req.query.employee) {
      params.push(req.query.employee);
      sql += ' AND employee = $' + params.length;
    } else if (!isMgr) {
      params.push(req.user.username);
      sql += ' AND employee = $' + params.length;
    }
    sql += ' ORDER BY issued_at DESC LIMIT 100';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/disciplinary', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const b = req.body || {};
    if (!b.employee || !b.title) return res.status(400).json({ error: 'کارمند و عنوان الزامی است' });
    const id = uid('pip_');
    const r = await query(
      `INSERT INTO disciplinary_actions (id, employee, action_type, severity, title, description, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, b.employee, b.action_type || 'warning', b.severity || 'warning', b.title, b.description || null, req.user.username]
    );
    await notifyUser(b.employee, '⚠️ اقدام انضباطی: ' + b.title);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Documents ─────────────────────────────────────────────────────────────────

router.get('/documents', hrView, async function (req, res) {
  try {
    const employee = req.query.employee;
    if (isManagerRole(req.user.role) && !employee) {
      const r = await query(
        'SELECT * FROM employee_documents ORDER BY created_at DESC LIMIT 200'
      );
      return res.json(r.rows);
    }
    const emp = employee || req.user.username;
    if (!isManagerRole(req.user.role) && emp !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      'SELECT * FROM employee_documents WHERE employee = $1 ORDER BY created_at DESC LIMIT 100',
      [emp]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/documents', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const employee = b.employee || req.user.username;
    if (!isManagerRole(req.user.role) && employee !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const id = uid('doc_');
    const r = await query(
      `INSERT INTO employee_documents (id, employee, doc_type, title, expires_at, file_path, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, employee, b.doc_type || 'other', b.title, b.expires_at || null, b.file_path || null, b.notes || null, req.user.username]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Holidays & settings ───────────────────────────────────────────────────────

router.get('/holidays', hrView, async function (req, res) {
  try {
    const r = await query('SELECT * FROM public_holidays ORDER BY jalali_date');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/settings', hrView, async function (req, res) {
  try {
    const r = await query("SELECT * FROM hr_settings WHERE id = 'default'");
    res.json(r.rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/settings', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const b = req.body || {};
    await query(
      `UPDATE hr_settings SET
         annual_working_days = COALESCE($1, annual_working_days),
         carry_over_max = COALESCE($2, carry_over_max),
         friday_off = COALESCE($3, friday_off),
         insurance_employee_pct = COALESCE($4, insurance_employee_pct),
         tax_exempt_amount = COALESCE($5, tax_exempt_amount),
         updated_at = NOW()
       WHERE id = 'default'`,
      [b.annual_working_days, b.carry_over_max, b.friday_off, b.insurance_employee_pct, b.tax_exempt_amount]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import-users', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await syncEmployeeFromUsers();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Attendance ──────────────────────────────────────────────────────────────

router.get('/attendance', hrView, async function (req, res) {
  try {
    const isMgr = isManagerRole(req.user.role);
    const params = [];
    let sql = 'SELECT * FROM attendance_logs WHERE 1=1';
    if (!isMgr) {
      params.push(req.user.username);
      sql += ' AND employee = $' + params.length;
    } else if (req.query.employee) {
      params.push(req.query.employee);
      sql += ' AND employee = $' + params.length;
    }
    if (req.query.month) {
      params.push(req.query.month + '%');
      sql += ' AND jalali_date LIKE $' + params.length;
    }
    sql += ' ORDER BY jalali_date DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/attendance', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const employee = String(b.employee || '').trim();
    const jalaliDate = String(b.jalali_date || '').trim().replace(/[۰-۹]/g, function (d) {
      return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    });
    if (!employee || !jalaliDate) {
      return res.status(400).json({ error: 'کارمند و تاریخ الزامی است' });
    }
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(jalaliDate)) {
      return res.status(400).json({ error: 'فرمت تاریخ باید ۱۴۰۴/۰۴/۰۱ باشد' });
    }
    function normTime(v) {
      if (!v) return null;
      const t = String(v).trim().replace(/[۰-۹]/g, function (d) {
        return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      });
      if (!t) return null;
      if (/^\d{1,2}:\d{2}$/.test(t)) {
        const p = t.split(':');
        return String(parseInt(p[0], 10)).padStart(2, '0') + ':' + p[1] + ':00';
      }
      if (/^\d{4}$/.test(t)) return t.slice(0, 2) + ':' + t.slice(2) + ':00';
      if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) return t;
      return null;
    }
    const id = uid('att_');
    const r = await query(
      `INSERT INTO attendance_logs (id, employee, jalali_date, check_in, check_out, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (employee, jalali_date) DO UPDATE SET
         check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
         notes = EXCLUDED.notes, source = EXCLUDED.source
       RETURNING *`,
      [id, employee, jalaliDate, normTime(b.check_in), normTime(b.check_out),
        b.source || 'manual', b.notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

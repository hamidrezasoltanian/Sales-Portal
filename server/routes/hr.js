'use strict';

const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const hrLeave = require('../lib/hr-leave');
const employeeContract = require('../lib/employee-contract');
const hub = require('../lib/notification-hub');
const {
  syncAllEmployeesFromUsers,
  mirrorUserProfileToEmployee,
  writeThroughProfileToUser,
} = require('../lib/user-employee-sync');

const router = express.Router();
router.use(requireAuth);

const obMaterialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

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

/** Prefer app_users SoT profile fields when username is linked. */
function applyUserProfileOverlay(row) {
  if (!row || !row.username) return row;
  if (row.user_display_name) row.full_name = row.user_display_name;
  if (row.user_phone != null) row.phone = row.user_phone;
  if (row.user_department != null) row.department = row.user_department;
  if (row.user_direct_manager != null) row.manager = row.user_direct_manager;
  return row;
}

const EMP_USER_JOIN_SELECT =
  `SELECT e.*, u.display_name AS user_display_name, u.role AS user_role,
          u.color AS user_color, u.department AS user_department,
          u.phone AS user_phone, u.direct_manager AS user_direct_manager
   FROM employees e LEFT JOIN app_users u ON u.username = e.username`;

// ── Employees ───────────────────────────────────────────────────────────────

router.get('/employees', hrView, async function (req, res) {
  try {
    await syncAllEmployeesFromUsers();
    const isMgr = isManagerRole(req.user.role);
    let r;
    if (isMgr) {
      r = await query(
        `${EMP_USER_JOIN_SELECT}
         WHERE e.active = true ORDER BY COALESCE(NULLIF(u.department,''), e.department), COALESCE(u.display_name, e.full_name)`
      );
    } else {
      r = await query(
        `${EMP_USER_JOIN_SELECT}
         WHERE e.active = true AND e.username = $1`,
        [req.user.username]
      );
    }
    res.json(r.rows.map(applyUserProfileOverlay));
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
    if (!body.full_name && !body.username) return res.status(400).json({ error: 'نام الزامی است' });
    const id = uid('emp_');

    // If linked to app_users, seed profile from SoT (then optional write-through of form edits)
    let fullName = body.full_name || '';
    let phone = body.phone || null;
    let department = body.department || null;
    let manager = body.manager || null;
    if (body.username) {
      const u = await query(
        'SELECT display_name, phone, department, direct_manager FROM app_users WHERE username = $1',
        [body.username]
      );
      if (u.rows.length) {
        fullName = fullName || u.rows[0].display_name || body.username;
        phone = phone != null ? phone : (u.rows[0].phone || null);
        department = department || u.rows[0].department || null;
        manager = manager != null ? manager : (u.rows[0].direct_manager || null);
      }
    }
    if (!fullName) return res.status(400).json({ error: 'نام الزامی است' });

    const r = await query(
      `INSERT INTO employees (id, username, full_name, national_id, hire_date, contract_end_date,
        department, position, manager, phone, salary_level, employment_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, body.username || null, fullName, body.national_id || null, body.hire_date || null,
        body.contract_end_date || null, department, body.position || null,
        manager, phone, parseInt(body.salary_level, 10) || 2,
        body.employment_type || 'full_time', body.notes || null]
    );
    const empKey = body.username || id;
    await hrLeave.ensureLeaveBalance(empKey, hrLeave.currentJalaliYear());
    if (body.username) {
      const wt = {};
      if (body.full_name) wt.full_name = body.full_name;
      if (body.phone != null && body.phone !== '') wt.phone = body.phone;
      if (body.department != null && body.department !== '') wt.department = body.department;
      if (body.manager != null) wt.manager = body.manager;
      if (Object.keys(wt).length) await writeThroughProfileToUser(body.username, wt);
      else await mirrorUserProfileToEmployee(body.username);
    }
    if (body.username && (
      body.salary_insurable != null ||
      body.salary_non_insurable != null ||
      body.commission_pct != null ||
      body.sales_target != null ||
      body.housing_allowance != null ||
      body.grocery_allowance != null ||
      body.child_allowance != null
    )) {
      await employeeContract.upsertEmployeeContract(body.username, body, req.user.username);
    }
    const out = await query(`${EMP_USER_JOIN_SELECT} WHERE e.id = $1`, [id]);
    res.status(201).json(applyUserProfileOverlay(out.rows[0] || r.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'کد ملی تکراری است' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/employees/:id', hrView, async function (req, res) {
  try {
    const r = await query(`${EMP_USER_JOIN_SELECT} WHERE e.id = $1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    if (!isManagerRole(req.user.role) && r.rows[0].username !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(applyUserProfileOverlay(r.rows[0]));
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
    if (contract) return res.json(contract);
    // Fallback: show profile rates from app_users when no contract row yet
    const u = await query(
      'SELECT salary_amount, commission_pct FROM app_users WHERE username = $1',
      [r.rows[0].username]
    );
    if (!u.rows.length) return res.json(null);
    const row = u.rows[0];
    return res.json({
      id: null,
      employee: r.rows[0].username,
      base_salary: parseFloat(row.salary_amount) || 0,
      salary_insurable: parseFloat(row.salary_amount) || 0,
      salary_non_insurable: 0,
      housing_allowance: 0,
      grocery_allowance: 0,
      child_allowance: 0,
      commission_pct: parseFloat(row.commission_pct) || 0,
      sales_target: 0,
      start_date: null,
      _from_app_users: true,
    });
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
    const prevEmp = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!prevEmp.rows.length) return res.status(404).json({ error: 'کارمند یافت نشد' });
    const prev = prevEmp.rows[0];

    // Link / relink username first
    let empUsername = prev.username;
    if (b.username !== undefined && b.username !== prev.username) {
      await query('UPDATE employees SET username = $2 WHERE id = $1', [req.params.id, b.username || null]);
      empUsername = b.username || null;
    }

    // HR-only fields always on employees
    await query(
      `UPDATE employees SET
         national_id = COALESCE($2, national_id),
         hire_date = COALESCE($3, hire_date),
         contract_end_date = COALESCE($4, contract_end_date),
         position = COALESCE($5, position),
         salary_level = COALESCE($6, salary_level),
         employment_type = COALESCE($7, employment_type),
         notes = COALESCE($8, notes),
         active = COALESCE($9, active)
       WHERE id = $1`,
      [
        req.params.id,
        b.national_id,
        b.hire_date,
        b.contract_end_date,
        b.position,
        b.salary_level != null ? parseInt(b.salary_level, 10) : null,
        b.employment_type,
        b.notes,
        b.active !== undefined ? b.active : null,
      ]
    );

    if (empUsername) {
      // Profile SoT = app_users: write-through then mirror
      if (
        b.full_name !== undefined ||
        b.phone !== undefined ||
        b.department !== undefined ||
        b.manager !== undefined ||
        b.active !== undefined
      ) {
        if (b.manager !== undefined) {
          const { detectDirectManagerCycle } = require('../lib/direct-manager');
          const cycleErr = await detectDirectManagerCycle(empUsername, b.manager, query);
          if (cycleErr) return res.status(400).json({ error: cycleErr });
        }
        const prevUser = await query(
          'SELECT direct_manager FROM app_users WHERE username = $1',
          [empUsername]
        );
        await writeThroughProfileToUser(empUsername, {
          full_name: b.full_name,
          phone: b.phone,
          department: b.department,
          manager: b.manager,
          active: b.active,
        });
        if (b.manager !== undefined && prevUser.rows.length) {
          const { logAccessChange } = require('../lib/access-audit');
          const { invalidateAuthCache } = require('../auth');
          invalidateAuthCache(empUsername);
          await logAccessChange({
            actor: req.user.username,
            targetUser: empUsername,
            field: 'direct_manager',
            oldValue: prevUser.rows[0].direct_manager || '',
            newValue: b.manager || '',
            note: 'synced from HR employee form (write-through to app_users)',
          });
        }
      } else {
        await mirrorUserProfileToEmployee(empUsername);
      }
    } else {
      // Unlinked employee: profile fields live on employees only
      await query(
        `UPDATE employees SET
           full_name = COALESCE($2, full_name),
           department = COALESCE($3, department),
           manager = COALESCE($4, manager),
           phone = COALESCE($5, phone)
         WHERE id = $1`,
        [req.params.id, b.full_name, b.department, b.manager, b.phone]
      );
    }

    if (empUsername && (
      b.salary_insurable != null ||
      b.salary_non_insurable != null ||
      b.commission_pct != null ||
      b.sales_target != null ||
      b.housing_allowance != null ||
      b.grocery_allowance != null ||
      b.child_allowance != null
    )) {
      await employeeContract.upsertEmployeeContract(empUsername, b, req.user.username);
    }

    const out = await query(`${EMP_USER_JOIN_SELECT} WHERE e.id = $1`, [req.params.id]);
    res.json(applyUserProfileOverlay(out.rows[0]));
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

// ── Disciplinary (ماده ۵ — نظام پلکانی) ───────────────────────────────────────

const DISCIPLINARY_LADDER = [
  {
    step: 1,
    action_type: 'verbal_warning',
    severity: 'light',
    title: 'تذکر شفاهی (ثبت در پرونده)',
    applies_to: 'تخلف سبک، بار اول',
    score_deduction: 0,
    bonus_cut: false,
  },
  {
    step: 2,
    action_type: 'written_warning',
    severity: 'light',
    title: 'تذکر کتبی',
    applies_to: 'تکرار تخلف سبک',
    score_deduction: 0,
    bonus_cut: false,
  },
  {
    step: 3,
    action_type: 'written_reprimand',
    severity: 'medium',
    title: 'توبیخ کتبی + کسر امتیاز عملکرد و قطع پاداش دوره',
    applies_to: 'تخلف متوسط',
    score_deduction: 1,
    bonus_cut: true,
  },
  {
    step: 4,
    action_type: 'final_warning',
    severity: 'medium',
    title: 'اخطار نهاییِ کتبی',
    applies_to: 'تکرار تخلف متوسط',
    score_deduction: 0,
    bonus_cut: false,
  },
  {
    step: 5,
    action_type: 'termination',
    severity: 'severe',
    title: 'خاتمه‌ی قرارداد با رعایت تشریفات قانونی و تأیید مرجع',
    applies_to: 'تخلف شدید یا تکرار پس از اخطار',
    score_deduction: 0,
    bonus_cut: false,
  },
];

function ladderByStep(step) {
  const s = parseInt(step, 10);
  return DISCIPLINARY_LADDER.find(function (x) { return x.step === s; }) || null;
}

router.get('/disciplinary/ladder', hrView, function (req, res) {
  res.json({ article: 'ماده ۵', title: 'نظام پلکانی برخورد', steps: DISCIPLINARY_LADDER });
});

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
    sql += ' ORDER BY issued_at DESC LIMIT 200';
    const r = await query(sql, params);

    // خلاصه بالاترین مرحله فعال هر کارمند
    const byEmp = {};
    r.rows.forEach(function (row) {
      const st = parseInt(row.step, 10) || 0;
      if (!byEmp[row.employee] || st > byEmp[row.employee].max_step) {
        byEmp[row.employee] = { employee: row.employee, max_step: st, last_at: row.issued_at, last_title: row.title };
      }
    });

    res.json({
      items: r.rows,
      summary: Object.keys(byEmp).map(function (k) { return byEmp[k]; }),
      ladder: DISCIPLINARY_LADDER,
      article: 'ماده ۵',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/disciplinary', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const b = req.body || {};
    if (!b.employee) return res.status(400).json({ error: 'کارمند الزامی است' });

    let step = parseInt(b.step, 10);
    if (isNaN(step) || step < 1 || step > 5) {
      // سازگاری با فرم قدیمی
      step = 1;
    }
    const def = ladderByStep(step);
    if (!def) return res.status(400).json({ error: 'مرحله نامعتبر' });

    const title = (b.title && String(b.title).trim()) || def.title;
    const actionType = b.action_type || def.action_type;
    const severity = b.severity || def.severity || b.offense_level || 'light';
    const offenseLevel = b.offense_level || def.severity;
    const scoreDeduction = b.score_deduction != null ? Number(b.score_deduction) : def.score_deduction;
    const bonusCut = b.bonus_cut != null ? !!b.bonus_cut : !!def.bonus_cut;

    if (step === 5 && !b.confirm_termination) {
      return res.status(400).json({
        error: 'برای مرحله ۵ (خاتمه قرارداد) تأیید صریح الزامی است',
        require_confirm: true,
      });
    }

    const id = uid('pip_');
    const r = await query(
      `INSERT INTO disciplinary_actions
         (id, employee, action_type, severity, title, description, issued_by,
          step, offense_level, score_deduction, bonus_cut, legal_ref, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        id,
        b.employee,
        actionType,
        severity,
        title,
        b.description || null,
        req.user.username,
        step,
        offenseLevel,
        isNaN(scoreDeduction) ? 0 : scoreDeduction,
        bonusCut,
        b.legal_ref || 'ماده ۵',
        b.notes || null,
      ]
    );

    await notifyUser(
      b.employee,
      '⚠️ اقدام انضباطی (ماده ۵ — مرحله ' + step + '): ' + title
    );

    // Auto-create pending payroll penalty when bonus_cut or score_deduction
    let payrollVar = null;
    if (bonusCut || (scoreDeduction && scoreDeduction > 0)) {
      try {
        const salesKpi = require('../lib/jalali-mini');
        const month = salesKpi.todayJalaliStr().slice(0, 7);
        const penaltyAmt = Math.max(1, isNaN(scoreDeduction) ? 1 : scoreDeduction) * 5000000;
        const vid = uid('pmv_');
        const vr = await query(
          `INSERT INTO payroll_monthly_variables
             (id, employee, month, var_type, amount, title, notes, disciplinary_action_id, created_by, status)
           VALUES ($1,$2,$3,'penalty',$4,$5,$6,$7,$8,'pending')
           RETURNING *`,
          [
            vid,
            b.employee,
            month,
            penaltyAmt,
            'جریمه انضباطی — مرحله ' + step,
            'خودکار از ماده ۵: ' + title,
            id,
            req.user.username,
          ]
        );
        payrollVar = vr.rows[0];
        try { require('../lib/inbox-hooks').onPayrollVariableChange(vid); } catch (_) {}
      } catch (pe) {
        console.warn('[disciplinary] auto penalty:', pe.message);
      }
    }

    res.status(201).json(Object.assign({}, r.rows[0], { payroll_variable: payrollVar }));
  } catch (e) {
    console.error('[disciplinary POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/disciplinary/:id/resolve', hrEdit, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const r = await query(
      `UPDATE disciplinary_actions SET resolved_at = NOW()
       WHERE id = $1 AND active = TRUE RETURNING *`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Documents ─────────────────────────────────────────────────────────────────

router.get('/documents', hrView, async function (req, res) {
  try {
    const employee = req.query.employee;
    const selectList =
      `id, employee, doc_type, title, expires_at, file_path, notes, created_by, created_at,
       filename, mime_type, file_size, (file_data IS NOT NULL) AS has_file`;
    if (isManagerRole(req.user.role) && !employee) {
      const r = await query(
        `SELECT ${selectList} FROM employee_documents ORDER BY created_at DESC LIMIT 200`
      );
      return res.json(r.rows);
    }
    const emp = employee || req.user.username;
    if (!isManagerRole(req.user.role) && emp !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const r = await query(
      `SELECT ${selectList} FROM employee_documents WHERE employee = $1 ORDER BY created_at DESC LIMIT 100`,
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

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/documents/upload', hrEdit, docUpload.single('file'), async function (req, res) {
  try {
    const b = req.body || {};
    const employee = b.employee || req.user.username;
    if (!isManagerRole(req.user.role) && employee !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (!req.file) return res.status(400).json({ error: 'فایل الزامی است' });
    const title = String(b.title || req.file.originalname || 'مدرک').trim();
    const id = uid('doc_');
    await query(
      `ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS filename TEXT`
    ).catch(function () {});
    await query(
      `ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type TEXT`
    ).catch(function () {});
    await query(
      `ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size INT`
    ).catch(function () {});
    await query(
      `ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_data BYTEA`
    ).catch(function () {});

    const r = await query(
      `INSERT INTO employee_documents
         (id, employee, doc_type, title, expires_at, notes, created_by,
          filename, mime_type, file_size, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, employee, doc_type, title, expires_at, notes, created_by, created_at,
                 filename, mime_type, file_size, (file_data IS NOT NULL) AS has_file`,
      [
        id, employee, b.doc_type || 'other', title, b.expires_at || null, b.notes || null,
        req.user.username, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('[hr documents upload]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/documents/:id/download', hrView, async function (req, res) {
  try {
    const r = await query(
      `SELECT id, employee, title, filename, mime_type, file_data, file_path
       FROM employee_documents WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const doc = r.rows[0];
    if (!isManagerRole(req.user.role) && doc.employee !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (!doc.file_data) return res.status(404).json({ error: 'فایل پیوست نشده' });
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + encodeURIComponent(doc.filename || doc.title || 'document') + '"'
    );
    res.send(doc.file_data);
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
    const result = await syncAllEmployeesFromUsers();
    res.json({ ok: true, created: result.created, updated: result.updated });
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

// ═══ Onboarding checklist ═══════════════════════════════════════════════════
const hrOnboarding = require('../lib/hr-onboarding');

router.get('/onboarding/template', hrView, async function (req, res) {
  try {
    const phases = await hrOnboarding.getTemplate();
    const kb = await hrOnboarding.getKb();
    res.json({ phases, kb });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/onboarding/phases', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'عنوان فاز الزامی است' });
    const id = hrOnboarding.uid('obp_');
    const phaseKey = b.phase_key || ('PHASE_CUSTOM_' + Date.now());
    const maxOrd = await query('SELECT COALESCE(MAX(sort_order),-1)::int AS m FROM hr_onboarding_phases');
    const sort = b.sort_order != null ? parseInt(b.sort_order, 10) : ((maxOrd.rows[0] && maxOrd.rows[0].m) + 1);
    const r = await query(
      `INSERT INTO hr_onboarding_phases (id, phase_key, title, timeline, owner_label, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, phaseKey, b.title, b.timeline || '', b.owner_label || '', b.description || '', sort]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding/phases/:id', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE hr_onboarding_phases SET
         title = COALESCE($2, title),
         timeline = COALESCE($3, timeline),
         owner_label = COALESCE($4, owner_label),
         description = COALESCE($5, description),
         sort_order = COALESCE($6, sort_order),
         active = COALESCE($7, active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.title != null ? b.title : null,
        b.timeline != null ? b.timeline : null,
        b.owner_label != null ? b.owner_label : null,
        b.description != null ? b.description : null,
        b.sort_order != null ? parseInt(b.sort_order, 10) : null,
        typeof b.active === 'boolean' ? b.active : null,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'فاز یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/onboarding/tasks', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    if (!b.phase_id || !b.task_name) return res.status(400).json({ error: 'فاز و عنوان تسک الزامی است' });
    const id = hrOnboarding.uid('obt_');
    const taskKey = b.task_key || ('TASK_' + Date.now());
    const maxOrd = await query(
      'SELECT COALESCE(MAX(sort_order),-1)::int AS m FROM hr_onboarding_tasks WHERE phase_id = $1',
      [b.phase_id]
    );
    const sort = b.sort_order != null ? parseInt(b.sort_order, 10) : ((maxOrd.rows[0] && maxOrd.rows[0].m) + 1);
    const r = await query(
      `INSERT INTO hr_onboarding_tasks
         (id, phase_id, task_key, category, task_name, assigned_to, is_required, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        id, b.phase_id, taskKey, b.category || '', b.task_name,
        b.assigned_to || '', b.is_required !== false, sort,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding/tasks/:id', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE hr_onboarding_tasks SET
         task_name = COALESCE($2, task_name),
         category = COALESCE($3, category),
         assigned_to = COALESCE($4, assigned_to),
         is_required = COALESCE($5, is_required),
         sort_order = COALESCE($6, sort_order),
         active = COALESCE($7, active),
         phase_id = COALESCE($8, phase_id),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.task_name != null ? b.task_name : null,
        b.category != null ? b.category : null,
        b.assigned_to != null ? b.assigned_to : null,
        typeof b.is_required === 'boolean' ? b.is_required : null,
        b.sort_order != null ? parseInt(b.sort_order, 10) : null,
        typeof b.active === 'boolean' ? b.active : null,
        b.phase_id || null,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'تسک یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/onboarding/tasks/:id', hrEdit, async function (req, res) {
  try {
    const r = await query(
      `UPDATE hr_onboarding_tasks SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'تسک یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/onboarding/assignments', hrView, async function (req, res) {
  try {
    await hrOnboarding.ensureOnboardingSeeded();
    const status = req.query.status || '';
    let sql = `SELECT a.*,
      (SELECT COUNT(*)::int FROM hr_onboarding_checks c
         JOIN hr_onboarding_tasks t ON t.id = c.task_id AND t.active
       WHERE c.assignment_id = a.id AND c.done) AS done_count,
      (SELECT COUNT(*)::int FROM hr_onboarding_tasks t WHERE t.active) AS total_count
      FROM hr_onboarding_assignments a`;
    const params = [];
    if (status) {
      params.push(status);
      sql += ` WHERE a.status = $1`;
    }
    sql += ' ORDER BY a.created_at DESC LIMIT 100';
    const r = await query(sql, params);
    res.json({ items: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/onboarding/assignments', hrEdit, async function (req, res) {
  try {
    await hrOnboarding.ensureOnboardingSeeded();
    const b = req.body || {};
    const username = b.employee_username || b.username;
    if (!username) return res.status(400).json({ error: 'کارمند الزامی است' });

    const open = await query(
      `SELECT id FROM hr_onboarding_assignments
       WHERE employee_username = $1 AND status = 'in_progress' LIMIT 1`,
      [username]
    );
    if (open.rows.length) {
      return res.status(400).json({ error: 'برای این کارمند انبوردینگ فعال وجود دارد', id: open.rows[0].id });
    }

    let empId = b.employee_id || null;
    let empName = b.employee_name || username;
    const emp = await query(
      `SELECT id, full_name FROM employees WHERE username = $1 OR id = $2 LIMIT 1`,
      [username, empId || '']
    );
    if (emp.rows.length) {
      empId = emp.rows[0].id;
      empName = emp.rows[0].full_name || empName;
    }

    const id = hrOnboarding.uid('oba_');
    const a = await query(
      `INSERT INTO hr_onboarding_assignments
         (id, employee_id, employee_username, employee_name, mentor_username, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, empId, username, empName, b.mentor_username || null, b.notes || null, req.user.username]
    );

    const tasks = await query(`SELECT id FROM hr_onboarding_tasks WHERE active = TRUE`);
    for (const t of tasks.rows) {
      await query(
        `INSERT INTO hr_onboarding_checks (assignment_id, task_id, done)
         VALUES ($1,$2,FALSE) ON CONFLICT DO NOTHING`,
        [id, t.id]
      );
    }

    res.status(201).json(a.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/onboarding/assignments/:id', hrView, async function (req, res) {
  try {
    const a = await query('SELECT * FROM hr_onboarding_assignments WHERE id = $1', [req.params.id]);
    if (!a.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const phases = await hrOnboarding.getTemplate();
    const checks = await query(
      `SELECT * FROM hr_onboarding_checks WHERE assignment_id = $1`,
      [req.params.id]
    );
    const checkMap = {};
    checks.rows.forEach(function (c) { checkMap[c.task_id] = c; });
    const phasesWithProgress = phases.map(function (p) {
      return Object.assign({}, p, {
        tasks: (p.tasks || []).map(function (t) {
          const c = checkMap[t.id] || {};
          return Object.assign({}, t, {
            done: !!c.done,
            done_at: c.done_at || null,
            done_by: c.done_by || null,
            note: c.note || '',
          });
        }),
      });
    });
    let done = 0;
    let total = 0;
    let reqDone = 0;
    let reqTotal = 0;
    phasesWithProgress.forEach(function (p) {
      (p.tasks || []).forEach(function (t) {
        total++;
        if (t.done) done++;
        if (t.is_required) {
          reqTotal++;
          if (t.done) reqDone++;
        }
      });
    });
    res.json({
      assignment: a.rows[0],
      phases: phasesWithProgress,
      progress: { done, total, reqDone, reqTotal, pct: total ? Math.round((done / total) * 100) : 0 },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding/assignments/:id/checks/:taskId', hrEdit, async function (req, res) {
  try {
    const done = !!(req.body && req.body.done);
    const note = (req.body && req.body.note) || null;
    const r = await query(
      `INSERT INTO hr_onboarding_checks (assignment_id, task_id, done, done_at, done_by, note)
       VALUES ($1,$2,$3, CASE WHEN $3 THEN NOW() ELSE NULL END, $4, $5)
       ON CONFLICT (assignment_id, task_id) DO UPDATE SET
         done = EXCLUDED.done,
         done_at = CASE WHEN EXCLUDED.done THEN NOW() ELSE NULL END,
         done_by = EXCLUDED.done_by,
         note = COALESCE(EXCLUDED.note, hr_onboarding_checks.note)
       RETURNING *`,
      [req.params.id, req.params.taskId, done, req.user.username, note]
    );

    // auto-complete assignment when all required tasks done
    const left = await query(
      `SELECT COUNT(*)::int AS c
       FROM hr_onboarding_tasks t
       LEFT JOIN hr_onboarding_checks c
         ON c.task_id = t.id AND c.assignment_id = $1
       WHERE t.active AND t.is_required AND COALESCE(c.done, FALSE) = FALSE`,
      [req.params.id]
    );
    if ((left.rows[0] && left.rows[0].c) === 0) {
      await query(
        `UPDATE hr_onboarding_assignments
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'in_progress'`,
        [req.params.id]
      );
    } else {
      await query(
        `UPDATE hr_onboarding_assignments
         SET status = 'in_progress', completed_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding/assignments/:id', hrEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE hr_onboarding_assignments SET
         status = COALESCE($2, status),
         mentor_username = COALESCE($3, mentor_username),
         notes = COALESCE($4, notes),
         completed_at = CASE WHEN $2 = 'completed' THEN NOW()
           WHEN $2 = 'in_progress' THEN NULL ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, b.status || null, b.mentor_username != null ? b.mentor_username : null, b.notes != null ? b.notes : null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ Onboarding materials (جزوه / فایل / ویدیو) ═════════════════════════════

const OB_MAT_KINDS = { booklet: true, file: true, video: true };

function mapMaterialRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    phase_id: row.phase_id,
    phase_title: row.phase_title || null,
    external_url: row.external_url,
    filename: row.filename,
    mime_type: row.mime_type,
    file_size: row.file_size,
    has_file: !!(row.has_file != null ? row.has_file : row.data),
    sort_order: row.sort_order,
    active: row.active,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get('/onboarding/materials', hrView, async function (req, res) {
  try {
    const kind = req.query.kind || '';
    const params = [];
    let sql =
      `SELECT m.id, m.kind, m.title, m.description, m.phase_id, m.external_url,
              m.filename, m.mime_type, m.file_size, m.sort_order, m.active,
              m.uploaded_by, m.created_at, m.updated_at,
              (m.data IS NOT NULL) AS has_file,
              p.title AS phase_title
       FROM hr_onboarding_materials m
       LEFT JOIN hr_onboarding_phases p ON p.id = m.phase_id
       WHERE m.active = TRUE`;
    if (kind && OB_MAT_KINDS[kind]) {
      params.push(kind);
      sql += ` AND m.kind = $${params.length}`;
    }
    sql += ' ORDER BY m.kind, m.sort_order, m.created_at DESC';
    const r = await query(sql, params);
    res.json({ items: r.rows.map(mapMaterialRow) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/onboarding/materials', hrEdit, obMaterialUpload.single('file'), async function (req, res) {
  try {
    const b = req.body || {};
    const kind = String(b.kind || 'file');
    if (!OB_MAT_KINDS[kind]) return res.status(400).json({ error: 'نوع نامعتبر (booklet/file/video)' });
    const title = String(b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });
    const externalUrl = String(b.external_url || '').trim() || null;
    const file = req.file;
    if (!file && !externalUrl) {
      return res.status(400).json({ error: 'فایل یا لینک خارجی الزامی است' });
    }
    if (file && file.size > 80 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم فایل حداکثر ۸۰ مگابایت' });
    }
    const id = uid('obm_');
    const maxOrd = await query(
      'SELECT COALESCE(MAX(sort_order),-1)::int AS m FROM hr_onboarding_materials WHERE kind = $1',
      [kind]
    );
    const sort = b.sort_order != null ? parseInt(b.sort_order, 10) : ((maxOrd.rows[0] && maxOrd.rows[0].m) + 1);
    const phaseId = b.phase_id || null;
    const r = await query(
      `INSERT INTO hr_onboarding_materials
         (id, kind, title, description, phase_id, external_url,
          filename, mime_type, file_size, data, sort_order, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, kind, title, description, phase_id, external_url,
                 filename, mime_type, file_size, sort_order, active,
                 uploaded_by, created_at, updated_at, (data IS NOT NULL) AS has_file`,
      [
        id,
        kind,
        title,
        b.description || '',
        phaseId || null,
        externalUrl,
        file ? file.originalname : null,
        file ? file.mimetype : null,
        file ? file.size : null,
        file ? file.buffer : null,
        isNaN(sort) ? 0 : sort,
        req.user.username,
      ]
    );
    res.status(201).json(mapMaterialRow(r.rows[0]));
  } catch (e) {
    console.error('[hr onboarding materials POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding/materials/:id', hrEdit, obMaterialUpload.single('file'), async function (req, res) {
  try {
    const b = req.body || {};
    const existing = await query(
      'SELECT * FROM hr_onboarding_materials WHERE id = $1 AND active = TRUE',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const cur = existing.rows[0];
    const kind = b.kind != null ? String(b.kind) : cur.kind;
    if (!OB_MAT_KINDS[kind]) return res.status(400).json({ error: 'نوع نامعتبر' });
    const title = b.title != null ? String(b.title).trim() : cur.title;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });
    const externalUrl = b.external_url != null
      ? (String(b.external_url).trim() || null)
      : cur.external_url;
    const file = req.file;
    const phaseId = b.phase_id !== undefined ? (b.phase_id || null) : cur.phase_id;
    const description = b.description != null ? b.description : cur.description;

    let sql;
    let params;
    if (file) {
      sql = `UPDATE hr_onboarding_materials SET
               kind=$2, title=$3, description=$4, phase_id=$5, external_url=$6,
               filename=$7, mime_type=$8, file_size=$9, data=$10, updated_at=NOW()
             WHERE id=$1
             RETURNING id, kind, title, description, phase_id, external_url,
                       filename, mime_type, file_size, sort_order, active,
                       uploaded_by, created_at, updated_at, (data IS NOT NULL) AS has_file`;
      params = [
        req.params.id, kind, title, description, phaseId, externalUrl,
        file.originalname, file.mimetype, file.size, file.buffer,
      ];
    } else {
      sql = `UPDATE hr_onboarding_materials SET
               kind=$2, title=$3, description=$4, phase_id=$5, external_url=$6, updated_at=NOW()
             WHERE id=$1
             RETURNING id, kind, title, description, phase_id, external_url,
                       filename, mime_type, file_size, sort_order, active,
                       uploaded_by, created_at, updated_at, (data IS NOT NULL) AS has_file`;
      params = [req.params.id, kind, title, description, phaseId, externalUrl];
    }
    const r = await query(sql, params);
    res.json(mapMaterialRow(r.rows[0]));
  } catch (e) {
    console.error('[hr onboarding materials PUT]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/onboarding/materials/:id', hrEdit, async function (req, res) {
  try {
    const r = await query(
      `UPDATE hr_onboarding_materials SET active = FALSE, updated_at = NOW()
       WHERE id = $1 AND active = TRUE RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/onboarding/materials/:id/download', hrView, async function (req, res) {
  try {
    const r = await query(
      `SELECT filename, mime_type, data FROM hr_onboarding_materials
       WHERE id = $1 AND active = TRUE`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const row = r.rows[0];
    if (!row.data) return res.status(404).json({ error: 'فایل پیوست ندارد — از لینک استفاده کنید' });
    const filename = row.filename || 'material.bin';
    const dl = req.query.dl === '1';
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      (dl ? 'attachment' : 'inline') + '; filename*=UTF-8\'\'' + encodeURIComponent(filename)
    );
    res.send(row.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

'use strict';

const { pool, query } = require('../db');
const {
  todayJalaliStr, parseJalali, j2g, jAdd, formatJalali, compareJalali,
} = require('./jalali-mini');

const DEFAULT_ANNUAL_WORKING = 26;
const DEFAULT_CARRY_MAX = 9;

function currentJalaliYear() {
  return todayJalaliStr().split('/')[0];
}

function gregWeekday(jalaliStr) {
  const j = parseJalali(jalaliStr);
  if (!j) return 0;
  const g = j2g(j[0], j[1], j[2]);
  const d = new Date(g[0], g[1] - 1, g[2]);
  return d.getDay(); // 0=Sun ... 5=Fri 6=Sat
}

async function loadHrSettings() {
  const r = await query("SELECT * FROM hr_settings WHERE id = 'default'");
  const s = r.rows[0] || {};
  return {
    annualWorkingDays: Number(s.annual_working_days) || DEFAULT_ANNUAL_WORKING,
    carryOverMax: Number(s.carry_over_max) || DEFAULT_CARRY_MAX,
    fridayOff: s.friday_off !== false,
  };
}

async function loadHolidaySet() {
  const r = await query('SELECT jalali_date FROM public_holidays');
  return new Set(r.rows.map(function (x) { return x.jalali_date; }));
}

function iterJalaliDays(fromStr, toStr) {
  const out = [];
  const start = parseJalali(fromStr);
  const end = parseJalali(toStr);
  if (!start || !end || compareJalali(fromStr, toStr) > 0) return out;
  let cur = start;
  let guard = 0;
  while (compareJalali(formatJalali(cur), toStr) <= 0 && guard < 400) {
    out.push(formatJalali(cur));
    cur = jAdd(cur[0], cur[1], cur[2], 1);
    guard++;
  }
  return out;
}

async function calcWorkingDays(fromStr, toStr, opts) {
  const settings = opts.settings || await loadHrSettings();
  const holidays = opts.holidays || await loadHolidaySet();
  const days = iterJalaliDays(fromStr, toStr);
  let n = 0;
  days.forEach(function (d) {
    if (settings.fridayOff && gregWeekday(d) === 5) return;
    if (holidays.has(d)) return;
    n += 1;
  });
  return n;
}

async function ensureLeaveBalance(employee, jalaliYear) {
  const settings = await loadHrSettings();
  const r = await query('SELECT * FROM leave_balance WHERE employee = $1', [employee]);
  if (r.rows.length) {
    const row = r.rows[0];
    if (String(row.jalali_year || '') !== String(jalaliYear)) {
      const carry = Math.min(Number(row.carry_over) || 0, settings.carryOverMax);
      const unused = Math.max(0, (Number(row.annual_total) || settings.annualWorkingDays) - (Number(row.annual_used) || 0));
      const newCarry = Math.min(unused, settings.carryOverMax);
      await query(
        `UPDATE leave_balance SET jalali_year = $2, annual_total = $3, annual_used = 0, carry_over = $4 WHERE employee = $1`,
        [employee, jalaliYear, settings.annualWorkingDays, newCarry]
      );
    }
    return;
  }
  await query(
    `INSERT INTO leave_balance (employee, annual_total, annual_used, carry_over, year, jalali_year)
     VALUES ($1, $2, 0, 0, $3, $4) ON CONFLICT (employee) DO NOTHING`,
    [employee, settings.annualWorkingDays, new Date().getFullYear(), jalaliYear]
  );
}

async function getLeaveBalance(employee) {
  const jy = currentJalaliYear();
  await ensureLeaveBalance(employee, jy);
  const r = await query('SELECT * FROM leave_balance WHERE employee = $1', [employee]);
  const row = r.rows[0] || {
    employee, annual_total: DEFAULT_ANNUAL_WORKING, annual_used: 0, carry_over: 0, jalali_year: jy,
  };
  const total = Number(row.annual_total) || DEFAULT_ANNUAL_WORKING;
  const used = Number(row.annual_used) || 0;
  const carry = Number(row.carry_over) || 0;
  return Object.assign({}, row, {
    annual_total: total,
    annual_used: used,
    carry_over: carry,
    remaining: total + carry - used,
  });
}

async function hasLeaveOverlap(employee, fromDate, toDate, excludeId) {
  const params = [employee, toDate, fromDate];
  let sql = `SELECT id FROM leave_requests
    WHERE employee = $1 AND status IN ('pending','approved')
      AND from_date <= $2 AND to_date >= $3`;
  if (excludeId) {
    params.push(excludeId);
    sql += ' AND id != $' + params.length;
  }
  const r = await query(sql, params);
  return r.rows.length > 0;
}

async function validateLeaveRequest(payload) {
  const { employee, type, from_date, to_date, is_half_day, days } = payload;
  if (!from_date || !to_date) return { error: 'تاریخ الزامی است', status: 400 };
  if (compareJalali(from_date, to_date) > 0) return { error: 'تاریخ پایان قبل از شروع است', status: 400 };

  let workingDays = await calcWorkingDays(from_date, to_date);
  if (is_half_day) workingDays = 0.5;
  else if (days != null && Number(days) > 0) {
    const manual = Number(days);
    if (Math.abs(manual - workingDays) > 0.01) workingDays = manual;
  }

  if (await hasLeaveOverlap(employee, from_date, to_date, payload.excludeId)) {
    return { error: 'هم‌پوشانی با مرخصی دیگر', status: 409 };
  }

  if (type === 'annual') {
    const bal = await getLeaveBalance(employee);
    if (workingDays > bal.remaining) {
      return { error: 'مانده مرخصی کافی نیست (باقی‌مانده: ' + bal.remaining + ' روز)', status: 400 };
    }
  }

  if (type === 'sick' && workingDays > 3 && !payload.medical_doc_note) {
    return { error: 'برای استعلاجی بیش از ۳ روز، یادداشت/پیوست پزشکی الزامی است', status: 400 };
  }

  return { ok: true, workingDays };
}

async function resolveApprover(employeeUsername, onDate) {
  const today = onDate || todayJalaliStr();
  const u = await query(
    `SELECT u.direct_manager, e.manager AS emp_manager FROM app_users u
     LEFT JOIN employees e ON e.username = u.username
     WHERE u.username = $1`,
    [employeeUsername]
  );
  let approver = (u.rows[0] && (u.rows[0].direct_manager || u.rows[0].emp_manager)) || '';

  const deleg = await query(
    `SELECT delegate_username FROM approval_delegations
     WHERE approver = $1 AND active = TRUE AND from_date <= $2 AND to_date >= $2
     ORDER BY created_at DESC LIMIT 1`,
    [approver, today]
  );
  if (deleg.rows.length) return deleg.rows[0].delegate_username;

  if (approver) {
    const mgrLeave = await query(
      `SELECT id FROM leave_requests WHERE employee = $1 AND status = 'approved'
       AND from_date <= $2 AND to_date >= $2 LIMIT 1`,
      [approver, today]
    );
    if (mgrLeave.rows.length) {
      const backup = await query(
        `SELECT delegate_username FROM approval_delegations
         WHERE approver = $1 AND active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [approver]
      );
      if (backup.rows.length) return backup.rows[0].delegate_username;
      const superM = await query(
        `SELECT username FROM app_users WHERE role = 'سوپر ادمین' AND active = TRUE LIMIT 1`
      );
      if (superM.rows.length) return superM.rows[0].username;
    }
  }

  if (!approver) {
    const m = await query(
      `SELECT username FROM app_users WHERE role IN ('مدیر','سوپر ادمین') AND active = TRUE LIMIT 1`
    );
    approver = m.rows[0] ? m.rows[0].username : '';
  }
  return approver;
}

async function canUserApproveLeave(user, leave) {
  if (['مدیر', 'سوپر ادمین'].includes(user.role)) {
    if (user.role === 'سوپر ادمین') return true;
    const expected = await resolveApprover(leave.employee, leave.from_date);
    return user.username === expected || !expected;
  }
  const expected = await resolveApprover(leave.employee, leave.from_date);
  return user.username === expected;
}

async function approveLeaveAtomic(leaveId, approverUsername) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lr = await client.query('SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE', [leaveId]);
    if (!lr.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'درخواست یافت نشد', status: 404 };
    }
    const leave = lr.rows[0];
    if (leave.status !== 'pending') {
      await client.query('ROLLBACK');
      return { error: 'این درخواست قبلاً رسیدگی شده', status: 409 };
    }

    const days = Number(leave.working_days_calc || leave.days) || 0;
    if (leave.type === 'annual') {
      const jy = currentJalaliYear();
      await client.query(
        `INSERT INTO leave_balance (employee, annual_total, annual_used, carry_over, year, jalali_year)
         VALUES ($1, $2, 0, 0, $3, $4) ON CONFLICT (employee) DO NOTHING`,
        [leave.employee, DEFAULT_ANNUAL_WORKING, new Date().getFullYear(), jy]
      );
      const balR = await client.query('SELECT * FROM leave_balance WHERE employee = $1 FOR UPDATE', [leave.employee]);
      const bal = balR.rows[0];
      const total = Number(bal.annual_total) || DEFAULT_ANNUAL_WORKING;
      const used = Number(bal.annual_used) || 0;
      const carry = Number(bal.carry_over) || 0;
      if (used + days > total + carry + 0.001) {
        await client.query('ROLLBACK');
        return { error: 'مانده مرخصی کافی نیست', status: 400 };
      }
      await client.query(
        'UPDATE leave_balance SET annual_used = annual_used + $2 WHERE employee = $1',
        [leave.employee, days]
      );
    }

    const upd = await client.query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $2 WHERE id = $1 RETURNING *`,
      [leaveId, approverUsername]
    );
    await client.query('COMMIT');
    return { ok: true, leave: upd.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    throw e;
  } finally {
    client.release();
  }
}

async function rejectLeave(leaveId, approverUsername) {
  const r = await query(
    `UPDATE leave_requests SET status = 'rejected', approved_by = $2 WHERE id = $1 AND status = 'pending' RETURNING *`,
    [leaveId, approverUsername]
  );
  if (!r.rows.length) return { error: 'درخواست یافت نشد یا قبلاً رسیدگی شده', status: 404 };
  return { ok: true, leave: r.rows[0] };
}

async function cancelLeaveAtomic(leaveId, username, isManager, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lr = await client.query('SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE', [leaveId]);
    if (!lr.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'یافت نشد', status: 404 };
    }
    const leave = lr.rows[0];
    if (!isManager && leave.employee !== username) {
      await client.query('ROLLBACK');
      return { error: 'دسترسی ندارید', status: 403 };
    }
    if (leave.status === 'cancelled') {
      await client.query('ROLLBACK');
      return { error: 'قبلاً لغو شده', status: 409 };
    }

    if (leave.status === 'approved' && leave.type === 'annual') {
      const days = Number(leave.working_days_calc || leave.days) || 0;
      await client.query(
        'UPDATE leave_balance SET annual_used = GREATEST(0, annual_used - $2) WHERE employee = $1',
        [leave.employee, days]
      );
    }

    const upd = await client.query(
      `UPDATE leave_requests SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2, cancel_reason = $3
       WHERE id = $1 RETURNING *`,
      [leaveId, username, reason || null]
    );
    await client.query('COMMIT');
    return { ok: true, leave: upd.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    throw e;
  } finally {
    client.release();
  }
}

async function getApprovedLeaveDaysInMonth(employee, jalaliMonth) {
  const r = await query(
    `SELECT working_days_calc, days, from_date, to_date, type FROM leave_requests
     WHERE employee = $1 AND status = 'approved'
       AND type IN ('annual','sick','personal')
       AND (from_date LIKE $2 OR to_date LIKE $2 OR (from_date <= $3 AND to_date >= $4))`,
    [employee, jalaliMonth + '%', jalaliMonth + '/31', jalaliMonth + '/01']
  );
  let total = 0;
  const monthPrefix = jalaliMonth + '/';
  r.rows.forEach(function (row) {
    if (row.from_date && row.from_date.startsWith(monthPrefix)) {
      total += Number(row.working_days_calc || row.days) || 0;
      return;
    }
    total += Number(row.working_days_calc || row.days) || 0;
  });
  return total;
}

module.exports = {
  currentJalaliYear,
  calcWorkingDays,
  getLeaveBalance,
  ensureLeaveBalance,
  validateLeaveRequest,
  hasLeaveOverlap,
  resolveApprover,
  canUserApproveLeave,
  approveLeaveAtomic,
  rejectLeave,
  cancelLeaveAtomic,
  getApprovedLeaveDaysInMonth,
  loadHrSettings,
  iterJalaliDays,
};

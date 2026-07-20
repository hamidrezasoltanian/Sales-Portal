'use strict';

/**
 * Profile SoT = app_users.
 * Linked employees rows mirror: full_name, phone, department, manager, active.
 * HR-only fields (national_id, hire_date, contract_end, position, employment_type, notes)
 * stay on employees and are never overwritten here.
 */

const { query } = require('../db');

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function defaultDeptForRole(role) {
  if (role === 'بازرگانی') return 'بازرگانی';
  if (role === 'کارشناس فروش') return 'فروش';
  if (role === 'مدیر' || role === 'سوپر ادمین') return 'مدیریت';
  return 'عمومی';
}

/**
 * Ensure every active app_user has an employees row and mirror SoT fields.
 * @returns {{ created: number, updated: number }}
 */
async function syncAllEmployeesFromUsers() {
  const users = await query(
    `SELECT username, display_name, role, department, direct_manager, phone, active
     FROM app_users WHERE username IS NOT NULL AND username <> ''`
  );
  let created = 0;
  let updated = 0;
  for (const u of users.rows) {
    const r = await mirrorUserProfileToEmployee(u);
    if (r === 'created') created++;
    else if (r === 'updated') updated++;
  }
  return { created, updated };
}

/**
 * Mirror one user profile into employees (create if missing and user active).
 * @param {object|string} userOrUsername — username or row with profile fields
 * @returns {'created'|'updated'|'skipped'}
 */
async function mirrorUserProfileToEmployee(userOrUsername) {
  let u = userOrUsername;
  if (typeof userOrUsername === 'string') {
    const r = await query(
      `SELECT username, display_name, role, department, direct_manager, phone, active
       FROM app_users WHERE username = $1`,
      [userOrUsername]
    );
    if (!r.rows.length) return 'skipped';
    u = r.rows[0];
  }
  if (!u || !u.username) return 'skipped';

  const ex = await query('SELECT id FROM employees WHERE username = $1', [u.username]);
  const phone = u.phone || '';
  const manager = u.direct_manager || '';
  const fullName = u.display_name || u.username;
  const active = u.active !== false;

  if (ex.rows.length) {
    // On update: mirror SoT exactly (empty department stays empty)
    const dept = u.department != null ? String(u.department) : '';
    await query(
      `UPDATE employees SET
         full_name = $2,
         phone = $3,
         department = $4,
         manager = $5,
         active = $6
       WHERE username = $1`,
      [u.username, fullName, phone, dept, manager, active]
    );
    return 'updated';
  }

  if (!active) return 'skipped';

  const dept = (u.department && String(u.department).trim())
    ? u.department
    : defaultDeptForRole(u.role);
  const id = uid('emp_');
  await query(
    `INSERT INTO employees (id, username, full_name, department, position, manager, phone, employment_type, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'full_time',TRUE)
     ON CONFLICT DO NOTHING`,
    [id, u.username, fullName, dept, u.role || null, manager, phone]
  );
  try {
    const hrLeave = require('./hr-leave');
    await hrLeave.ensureLeaveBalance(u.username, hrLeave.currentJalaliYear());
  } catch (_) {}
  return 'created';
}

/**
 * Write profile fields from HR form into app_users (SoT), then mirror to employees.
 * Only updates provided (non-undefined) fields.
 */
async function writeThroughProfileToUser(username, fields) {
  if (!username) return;
  const updates = [];
  const params = [username];
  let idx = 2;
  if (fields.display_name !== undefined || fields.full_name !== undefined) {
    updates.push(`display_name = $${idx++}`);
    params.push(fields.display_name != null ? fields.display_name : fields.full_name);
  }
  if (fields.phone !== undefined) {
    updates.push(`phone = $${idx++}`);
    params.push(fields.phone || '');
  }
  if (fields.department !== undefined) {
    updates.push(`department = $${idx++}`);
    params.push(fields.department || '');
  }
  if (fields.direct_manager !== undefined || fields.manager !== undefined) {
    updates.push(`direct_manager = $${idx++}`);
    params.push(
      fields.direct_manager != null ? (fields.direct_manager || '') : (fields.manager || '')
    );
  }
  if (fields.active !== undefined) {
    updates.push(`active = $${idx++}`);
    params.push(!!fields.active);
  }
  if (!updates.length) {
    await mirrorUserProfileToEmployee(username);
    return;
  }
  await query(
    `UPDATE app_users SET ${updates.join(', ')} WHERE username = $1`,
    params
  );
  await mirrorUserProfileToEmployee(username);
}

module.exports = {
  syncAllEmployeesFromUsers,
  mirrorUserProfileToEmployee,
  writeThroughProfileToUser,
  defaultDeptForRole,
};

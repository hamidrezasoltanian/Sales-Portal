'use strict';

const { normalizeRole, isManagerRole } = require('./roles');
const { resolvePermLevel, levelSatisfies } = require('./perm-resolve');

/**
 * Salary / commission — payroll operators only (not hr:view).
 */
function canSeeSensitiveUserFields(requester) {
  if (!requester) return false;
  if (isManagerRole(requester.role)) return true;
  const payroll = resolvePermLevel(requester, 'payroll');
  if (levelSatisfies(payroll, 'manage') || levelSatisfies(payroll, 'approve')) return true;
  const hr = resolvePermLevel(requester, 'hr');
  if (hr === 'edit') return true;
  return false;
}

function canSeePermissions(requester) {
  return requester && isManagerRole(requester.role);
}

function canSeeHrOrgFields(requester) {
  if (!requester) return false;
  if (isManagerRole(requester.role)) return true;
  const hr = resolvePermLevel(requester, 'hr');
  return hr === 'view' || hr === 'edit';
}

function serializeUser(row, requester) {
  const base = {
    username: row.username,
    display_name: row.display_name,
    role: normalizeRole(row.role),
    color: row.color,
    phone: row.phone || '',
    active: row.active,
  };

  if (canSeePermissions(requester)) {
    const out = Object.assign({}, base, {
      department: row.department || '',
      direct_manager: row.direct_manager || '',
      share_with_manager: !!row.share_with_manager,
      permissions: row.permissions || {},
      manager_scope: row.manager_scope || null,
    });
    if (row.commission_pct !== undefined && row.commission_pct !== null) {
      out.commission_pct = row.commission_pct;
    }
    if (row.salary_amount !== undefined && row.salary_amount !== null) {
      out.salary_amount = row.salary_amount;
    }
    return out;
  }

  const out = Object.assign({}, base);
  if (canSeeHrOrgFields(requester)) {
    out.department = row.department || '';
  }
  if (canSeeSensitiveUserFields(requester)) {
    if (row.commission_pct !== undefined && row.commission_pct !== null) {
      out.commission_pct = row.commission_pct;
    }
    if (row.salary_amount !== undefined && row.salary_amount !== null) {
      out.salary_amount = row.salary_amount;
    }
  }
  return out;
}

module.exports = {
  canSeeSensitiveUserFields,
  canSeePermissions,
  canSeeHrOrgFields,
  serializeUser,
};

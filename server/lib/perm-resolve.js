'use strict';

const { ROLE_DEFAULTS, getRoleModuleDefaults } = require('./roles');
const { SEGREGATED_MODULES, normalizeLevel } = require('./permissions-schema');

/**
 * Resolve effective permission level for a user+module. Fail-closed on unknown values.
 */
function resolvePermLevel(user, module) {
  if (!user || !module) return 'none';

  const perms = user.permissions || {};
  const modules = perms.modules || {};

  if (Object.prototype.hasOwnProperty.call(modules, module)) {
    return normalizeLevel(modules[module]);
  }

  const role = user.role;
  const defs = getRoleModuleDefaults ? getRoleModuleDefaults(role) : ((ROLE_DEFAULTS[role] || {}).modules || {});
  if (defs && defs[module] !== undefined) return normalizeLevel(defs[module]);

  return 'none';
}

function levelSatisfies(have, need) {
  const h = normalizeLevel(have);
  if (need === 'view') return h === 'view' || h === 'manage' || h === 'edit' || h === 'approve';
  if (need === 'manage') return h === 'manage' || h === 'edit';
  if (need === 'approve') return h === 'approve' || h === 'edit';
  if (need === 'edit') return h === 'edit';
  return false;
}

/** Manager auto-bypass is disabled for workflow-segregated modules. */
function managerBypassAllowed(module) {
  return !SEGREGATED_MODULES.has(module);
}

function isManagerRole(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

module.exports = {
  resolvePermLevel,
  levelSatisfies,
  managerBypassAllowed,
  isManagerRole,
  SEGREGATED_MODULES,
};

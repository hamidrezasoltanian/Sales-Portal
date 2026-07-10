'use strict';

const { ROLE_DEFAULTS } = require('./lib/roles');

function requirePermission(module, level = 'view') {
  return function (req, res, next) {
    const role = req.user && req.user.role;
    if (role === 'مدیر' || role === 'سوپر ادمین') return next();

    const perms = (req.user && req.user.permissions) || {};
    const modules = perms.modules || {};

    // Get user-specific level, or fallback to role defaults
    let userLevel = modules[module];
    if (userLevel === undefined && role && ROLE_DEFAULTS[role]) {
      userLevel = ROLE_DEFAULTS[role].modules[module];
    }

    // Default fallback if absolutely undefined: none/false (or 'view' if perms is completely empty for backward compatibility)
    if (userLevel === undefined) {
      if (!perms.modules) {
        // Legacy user with no permissions defined at all -> default to role-based permission
        userLevel = ROLE_DEFAULTS[role] ? ROLE_DEFAULTS[role].modules[module] : 'none';
      } else {
        userLevel = 'none';
      }
    }

    if (level === 'view' && (userLevel === 'view' || userLevel === 'edit')) return next();
    if (level === 'edit' && userLevel === 'edit') return next();

    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  };
}

module.exports = { requirePermission, ROLE_DEFAULTS };

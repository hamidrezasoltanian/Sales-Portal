'use strict';

// Permission middleware for granular access control.
// Usage: router.get('/...', requireAuth, requirePermission('pricing', 'view'), handler)
//
// Managers and super-admins always pass through.
// For other users: checks the permissions JSONB column on app_users (loaded via auth token).
// If permissions is empty ({}) → full access (backward-compatible).
function requirePermission(module, level = 'view') {
  return function (req, res, next) {
    const role = req.user && req.user.role;
    if (role === 'مدیر' || role === 'سوپر ادمین') return next();

    const perms = (req.user && req.user.permissions) || {};
    const modules = perms.modules || {};

    // Empty permissions object = full access (backward-compatible default)
    if (!perms.modules) return next();

    const userLevel = modules[module];
    if (level === 'view' && (userLevel === 'view' || userLevel === 'edit')) return next();
    if (level === 'edit' && userLevel === 'edit') return next();

    return res.status(403).json({ error: 'دسترسی ندارید' });
  };
}

module.exports = { requirePermission };

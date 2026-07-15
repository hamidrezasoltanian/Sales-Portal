'use strict';

const { resolvePermLevel, levelSatisfies, managerBypassAllowed } = require('./lib/perm-resolve');

function requirePermission(module, level = 'view') {
  return function (req, res, next) {
    const user = req.user;
    const role = user && user.role;

    if (managerBypassAllowed(module) && (role === 'مدیر' || role === 'سوپر ادمین')) {
      return next();
    }

    const userLevel = resolvePermLevel(user, module);
    if (levelSatisfies(userLevel, level)) return next();

    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  };
}

module.exports = { requirePermission };

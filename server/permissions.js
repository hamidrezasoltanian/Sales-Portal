'use strict';

// دسترسی‌های پیش‌فرض بر اساس نقش — زمانی اعمال می‌شود که permissions.modules کاربر خالی باشد.
// مدیر / سوپر ادمین قبل از این بررسی از طریق role check عبور می‌کنند.
const DEFAULT_PERMISSIONS = {
  'IT': {
    modules: {
      settings: 'edit', changelog: 'edit', activities: 'view',
    }
  },
  'بازرگانی': {
    modules: {
      wms: 'edit', proforma: 'edit', letters: 'edit',
      support: 'edit', contacts: 'edit',
      provinces: 'view', weekplan: 'view', calendar: 'view',
    }
  },
  'مالی': {
    modules: {
      receivables: 'edit', pricing: 'edit', proforma: 'edit', letters: 'edit',
      provinces: 'view', weekplan: 'view', wms: 'view',
    }
  },
  'کارشناس فروش': {
    modules: {
      weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      tasks: 'edit', support: 'edit', contacts: 'edit',
      provinces: 'view', activities: 'view',
    }
  },
  'مهمان': {
    modules: {
      home: 'view', provinces: 'view', calendar: 'view',
    }
  },
};

// میدل‌ور کنترل دسترسی ماژولار
// استفاده: router.get('/...', requireAuth, requirePermission('pricing', 'view'), handler)
function requirePermission(module, level = 'view') {
  return function (req, res, next) {
    const role = req.user && req.user.role;
    if (role === 'مدیر' || role === 'سوپر ادمین') return next();

    const perms = (req.user && req.user.permissions) || {};

    // permissions.modules خالی است → اعمال دسترسی پیش‌فرض بر اساس نقش
    if (!perms.modules) {
      const defaults = DEFAULT_PERMISSIONS[role];
      if (!defaults) return next(); // نقش ناشناخته → دسترسی کامل
      const roleLevel = (defaults.modules || {})[module];
      if (level === 'view' && (roleLevel === 'view' || roleLevel === 'edit')) return next();
      if (level === 'edit' && roleLevel === 'edit') return next();
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    // permissions.modules مقدار دارد → بررسی مستقیم
    const userLevel = (perms.modules || {})[module];
    if (level === 'view' && (userLevel === 'view' || userLevel === 'edit')) return next();
    if (level === 'edit' && userLevel === 'edit') return next();

    return res.status(403).json({ error: 'دسترسی ندارید' });
  };
}

module.exports = { requirePermission, DEFAULT_PERMISSIONS };

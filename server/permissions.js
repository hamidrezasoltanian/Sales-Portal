'use strict';

const ROLE_DEFAULTS = {
  'مدیر': {
    modules: {
      provinces: 'edit', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'edit', tasks: 'edit', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit',
      'trade-kpi': 'edit', kpi: 'edit', manager: 'edit', changelog: 'edit', wms: 'edit', letters: 'edit'
    }
  },
  'سوپر ادمین': {
    modules: {
      provinces: 'edit', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'edit', tasks: 'edit', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit',
      'trade-kpi': 'edit', kpi: 'edit', manager: 'edit', changelog: 'edit', wms: 'edit', letters: 'edit'
    }
  },
  'IT': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'none', support: 'view', hcp: 'view', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'edit', wms: 'none', letters: 'none'
    }
  },
  'بازرگانی': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'none',
      'trade-kpi': 'edit', kpi: 'none', manager: 'none', changelog: 'none', wms: 'edit', letters: 'edit'
    }
  },
  'مالی': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'none', hcp: 'none', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'view', letters: 'edit'
    }
  },
  'کارشناس فروش': {
    modules: {
      provinces: 'view', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'view', tasks: 'edit', mtr: 'none', pricing: 'view',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'none'
    }
  },
  'مهمان': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'none', support: 'none', hcp: 'none', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'none'
    }
  }
};

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

/* ═══ public/js/roles.js — shared role constants (mirror server/lib/roles.js) ═══ */
var ALL_ROLES = ['مدیر', 'کارشناس فروش', 'سوپر ادمین', 'بازرگانی', 'مالی', 'IT', 'مهمان'];
var MANAGER_ROLES = ['مدیر', 'سوپر ادمین', 'admin', 'manager'];
var DEFAULT_COMPANY_NAME = 'آتنا زیست درمان';
var DEPARTMENTS = ['فروش', 'بازرگانی', 'مالی', 'مدیریت', 'فنی', 'اداری', 'عمومی'];

var ROLE_ALIASES = {
  'کارشناس بازرگانی': 'بازرگانی',
  admin: 'مدیر',
  manager: 'مدیر'
};

function crmNormalizeRole(role) {
  if (!role) return 'کارشناس فروش';
  return ROLE_ALIASES[role] || role;
}

var CRM_ROLE_DEFAULTS = {
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
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'edit'
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

function crmIsManagerRole(role) {
  return MANAGER_ROLES.indexOf(crmNormalizeRole(role)) >= 0;
}

function crmIsSuperAdminRole(role) {
  return role === 'سوپر ادمین';
}

/** نقش فعلی: اول members، بعد JWT/session */
function crmResolveCurrentRole() {
  if (typeof currentUser !== 'undefined' && currentUser) {
    var members = typeof umGetMembers === 'function' ? umGetMembers() : [];
    var me = members.find(function (m) { return m.id === currentUser; });
    if (me && me.role) return crmNormalizeRole(me.role);
  }
  if (typeof window !== 'undefined' && window._authUserRole) {
    return crmNormalizeRole(window._authUserRole);
  }
  return '';
}

/** سطل زباله / بازیابی / بکاپ مدیریتی — مدیر یا سوپر ادمین */
function crmCanDataAdmin() {
  var role = crmResolveCurrentRole();
  return crmIsManagerRole(role) || crmIsSuperAdminRole(role);
}

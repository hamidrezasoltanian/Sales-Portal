/* ═══ public/js/roles.js — shared role constants (mirror server/lib/roles.js) ═══ */
var ALL_ROLES = ['مدیر', 'کارشناس فروش', 'سوپر ادمین', 'بازرگانی', 'مالی', 'IT', 'مهمان'];
var MANAGER_ROLES = ['مدیر', 'سوپر ادمین', 'admin', 'manager'];
var DEFAULT_COMPANY_NAME = 'آتنا زیست درمان';
var DEPARTMENTS = ['فروش', 'بازرگانی', 'مالی', 'مدیریت', 'فنی', 'اداری', 'عمومی'];
var CRM_SEGREGATED_MODULES = { payroll: 1, proforma: 1 };

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
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit', payroll: 'manage',
      'trade-kpi': 'edit', kpi: 'edit', manager: 'edit', changelog: 'edit', wms: 'edit', letters: 'edit',
      workflows: 'edit'
    }
  },
  'سوپر ادمین': {
    modules: {
      provinces: 'edit', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'edit', tasks: 'edit', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit', payroll: 'edit',
      'trade-kpi': 'edit', kpi: 'edit', manager: 'edit', changelog: 'edit', wms: 'edit', letters: 'edit',
      workflows: 'edit'
    }
  },
  'IT': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'none', support: 'view', hcp: 'view', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'edit', wms: 'none', letters: 'none',
      workflows: 'view'
    }
  },
  'بازرگانی': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'view',
      payroll: 'none', 'trade-kpi': 'edit', kpi: 'none', manager: 'none', changelog: 'none', wms: 'edit', letters: 'edit',
      workflows: 'edit'
    }
  },
  'مالی': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'none', hcp: 'none', hr: 'none', payroll: 'approve',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'view', letters: 'edit',
      workflows: 'view'
    }
  },
  'کارشناس فروش': {
    modules: {
      provinces: 'view', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'view', tasks: 'edit', mtr: 'none', pricing: 'view',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'view',
      payroll: 'none', 'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'edit',
      workflows: 'edit'
    }
  },
  'مهمان': {
    modules: {
      provinces: 'none', weekplan: 'none', calendar: 'none', checklist: 'none',
      activity: 'none', tasks: 'none', mtr: 'none', pricing: 'none',
      proforma: 'none', support: 'none', hcp: 'none', hr: 'none', payroll: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'none',
      workflows: 'none'
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

function crmNormalizePermLevel(level) {
  if (level === 'view' || level === 'manage' || level === 'edit' || level === 'approve') return level;
  return 'none';
}

function crmLevelSatisfies(have, need) {
  var h = crmNormalizePermLevel(have);
  if (need === 'view') return h === 'view' || h === 'manage' || h === 'edit' || h === 'approve';
  if (need === 'manage') return h === 'manage' || h === 'edit';
  if (need === 'approve') return h === 'approve' || h === 'edit';
  if (need === 'edit') return h === 'edit';
  return false;
}

function crmManagerBypassAllowed(module) {
  return !CRM_SEGREGATED_MODULES[module];
}

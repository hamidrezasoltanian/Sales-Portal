'use strict';

const MANAGER_ROLES = ['مدیر', 'سوپر ادمین'];
const ALL_ROLES = ['مدیر', 'کارشناس فروش', 'سوپر ادمین', 'بازرگانی', 'مالی', 'IT', 'مهمان'];
const DEFAULT_COMPANY_NAME = 'آتنا زیست درمان';
const DEPARTMENTS = ['فروش', 'بازرگانی', 'مالی', 'مدیریت', 'فنی', 'اداری', 'عمومی'];

/** Legacy alias — normalize old role strings to canonical ALL_ROLES values */
const ROLE_ALIASES = {
  'کارشناس بازرگانی': 'بازرگانی',
  admin: 'مدیر',
  manager: 'مدیر',
};

function normalizeRole(role) {
  if (!role) return 'کارشناس فروش';
  return ROLE_ALIASES[role] || role;
}

function isValidRole(role) {
  return ALL_ROLES.includes(normalizeRole(role));
}

const ROLE_DEFAULTS = {
  'مدیر': {
    modules: {
      provinces: 'edit', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'edit', tasks: 'edit', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit',
      'trade-kpi': 'edit', kpi: 'edit', manager: 'edit', changelog: 'edit', wms: 'edit', letters: 'edit',
      workflows: 'edit'
    }
  },
  'سوپر ادمین': {
    modules: {
      provinces: 'edit', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'edit', tasks: 'edit', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'edit',
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
      'trade-kpi': 'edit', kpi: 'none', manager: 'none', changelog: 'none', wms: 'edit', letters: 'edit',
      workflows: 'edit'
    }
  },
  'مالی': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'edit', pricing: 'edit',
      proforma: 'edit', support: 'none', hcp: 'none', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'view', letters: 'edit',
      workflows: 'view'
    }
  },
  'کارشناس فروش': {
    modules: {
      provinces: 'view', weekplan: 'edit', calendar: 'edit', checklist: 'edit',
      activity: 'view', tasks: 'edit', mtr: 'none', pricing: 'view',
      proforma: 'edit', support: 'edit', hcp: 'edit', hr: 'view',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'edit',
      workflows: 'edit'
    }
  },
  'مهمان': {
    modules: {
      provinces: 'view', weekplan: 'view', calendar: 'view', checklist: 'view',
      activity: 'view', tasks: 'view', mtr: 'none', pricing: 'none',
      proforma: 'none', support: 'none', hcp: 'none', hr: 'none',
      'trade-kpi': 'none', kpi: 'none', manager: 'none', changelog: 'none', wms: 'none', letters: 'none',
      workflows: 'none'
    }
  }
};

function isManagerRole(role) {
  return MANAGER_ROLES.includes(role);
}

module.exports = {
  MANAGER_ROLES,
  ALL_ROLES,
  DEPARTMENTS,
  DEFAULT_COMPANY_NAME,
  ROLE_DEFAULTS,
  ROLE_ALIASES,
  isManagerRole,
  normalizeRole,
  isValidRole,
};

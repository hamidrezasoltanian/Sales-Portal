'use strict';

/** Canonical module keys — must match server/lib/roles.js ROLE_DEFAULTS */
const KNOWN_MODULES = [
  'provinces', 'weekplan', 'calendar', 'checklist', 'activity', 'tasks',
  'mtr', 'pricing', 'proforma', 'support', 'hcp', 'hr', 'payroll',
  'trade-kpi', 'kpi', 'manager', 'changelog', 'wms', 'letters', 'workflows',
];

const VALID_LEVELS = new Set(['none', 'view', 'manage', 'edit', 'approve']);

/** Modules where manager golden-rule bypass is disabled (workflow segregation). */
const SEGREGATED_MODULES = new Set(['payroll', 'proforma']);

function normalizeLevel(level) {
  if (typeof level !== 'string') return 'none';
  const v = level.trim().toLowerCase();
  return VALID_LEVELS.has(v) ? v : 'none';
}

/**
 * Validate permissions JSONB — fail-closed: unknown module keys and invalid levels are rejected.
 * @returns {{ ok: boolean, error?: string, value?: object }}
 */
function validatePermissions(input) {
  if (input === null || input === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'permissions باید شیء JSON باشد' };
  }

  const out = {};
  const modules = input.modules;
  if (modules !== undefined) {
    if (typeof modules !== 'object' || Array.isArray(modules)) {
      return { ok: false, error: 'permissions.modules باید شیء باشد' };
    }
    out.modules = {};
    for (const key of Object.keys(modules)) {
      if (!KNOWN_MODULES.includes(key)) {
        return { ok: false, error: 'ماژول نامعتبر: ' + key };
      }
      const lvl = modules[key];
      if (!VALID_LEVELS.has(lvl)) {
        return { ok: false, error: 'سطح دسترسی نامعتبر برای ' + key + ': ' + String(lvl) };
      }
      out.modules[key] = lvl;
    }
  }

  const provinces = input.provinces;
  if (provinces !== undefined) {
    if (!Array.isArray(provinces)) {
      return { ok: false, error: 'permissions.provinces باید آرایه باشد' };
    }
    const bad = provinces.find(function (p) { return typeof p !== 'string' || !p.trim(); });
    if (bad !== undefined) {
      return { ok: false, error: 'شناسه استان نامعتبر در permissions.provinces' };
    }
    out.provinces = provinces.map(function (p) { return p.trim(); });
  }

  return { ok: true, value: out };
}

module.exports = {
  KNOWN_MODULES,
  VALID_LEVELS,
  SEGREGATED_MODULES,
  normalizeLevel,
  validatePermissions,
};

'use strict';

/**
 * Manager data scope — independent of role.
 *
 * Shapes:
 *   { type: 'global' }                      — full center access (default for مدیران)
 *   { type: 'provinces', ids: ['tehran',…] } — regional manager
 *   { type: 'team' }                        — legacy (UI removed); ACL uses ownership + share_with_manager
 *   { type: 'none' }                        — non-manager / unused
 *
 * Team sharing is now per-expert: app_users.share_with_manager → direct_manager.
 *
 * SAFETY: missing/invalid scope on a manager role → treated as global
 * so existing users keep current behavior until an admin narrows them.
 */

const { isManagerRole } = require('./roles');
const { getCenterProvinceId } = require('./center-ownership');

const VALID_TYPES = new Set(['global', 'provinces', 'team', 'none']);

function normalizeManagerScope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { type: 'none' };
  }
  const type = String(raw.type || 'none');
  if (!VALID_TYPES.has(type)) return { type: 'none' };
  if (type === 'provinces') {
    const ids = Array.isArray(raw.ids)
      ? raw.ids.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
      : [];
    return { type: 'provinces', ids: ids };
  }
  return { type: type };
}

/**
 * Effective scope for center ACL.
 * Super-admin → always global.
 * Manager with missing/none → global (safe default).
 * Non-manager → none (ownership path applies).
 */
function effectiveManagerScope(user) {
  if (!user) return { type: 'none' };
  if (user.role === 'سوپر ادمین') return { type: 'global' };
  if (!isManagerRole(user.role)) return { type: 'none' };
  const raw = user.manager_scope != null ? user.manager_scope : user.managerScope;
  const s = normalizeManagerScope(raw);
  if (!raw || s.type === 'none') return { type: 'global' };
  if (s.type === 'provinces' && (!s.ids || !s.ids.length)) return { type: 'global' };
  return s;
}

function userHasGlobalCenterAccess(user) {
  return effectiveManagerScope(user).type === 'global';
}

function isScopedManager(user) {
  if (!user || !isManagerRole(user.role) || user.role === 'سوپر ادمین') return false;
  const t = effectiveManagerScope(user).type;
  return t === 'provinces' || t === 'team';
}

/** Validate payload from API; returns { ok, value, error } */
function validateManagerScope(raw, role) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'manager_scope نامعتبر است' };
  }
  const s = normalizeManagerScope(raw);
  if (s.type === 'none') {
    return { ok: true, value: { type: 'none' } };
  }
  if (!isManagerRole(role) && role !== undefined) {
    // Non-managers should not carry a real scope
    return { ok: true, value: { type: 'none' } };
  }
  if (s.type === 'provinces' && (!s.ids || !s.ids.length)) {
    return { ok: false, error: 'برای محدوده استانی حداقل یک استان لازم است' };
  }
  // Legacy: reject new team scopes from API; keep reading old rows via normalize
  if (s.type === 'team') {
    return { ok: false, error: 'محدوده «تیم» حذف شده — از تیک «اشتراک با مدیر مستقیم» روی کارشناس استفاده کنید' };
  }
  return { ok: true, value: s };
}

function defaultManagerScopeForRole(role) {
  if (role === 'سوپر ادمین' || role === 'مدیر') return { type: 'global' };
  return { type: 'none' };
}

function provinceInScope(scopeIds, centerKey, ownerMaps) {
  if (!scopeIds || !scopeIds.length) return false;
  const provinceId = getCenterProvinceId(centerKey, ownerMaps);
  if (!provinceId) return false;
  return scopeIds.indexOf(provinceId) >= 0;
}

/**
 * Ownerless centers policy.
 * Default ALLOW preserves current production behavior.
 * Set CENTER_OWNERLESS_POLICY=deny to require explicit owner.
 */
function ownerlessCentersAllowed() {
  const v = String(process.env.CENTER_OWNERLESS_POLICY || 'allow').toLowerCase();
  return v !== 'deny' && v !== 'false' && v !== '0';
}

module.exports = {
  normalizeManagerScope,
  effectiveManagerScope,
  userHasGlobalCenterAccess,
  isScopedManager,
  validateManagerScope,
  defaultManagerScopeForRole,
  provinceInScope,
  ownerlessCentersAllowed,
  VALID_TYPES,
};

'use strict';

const { query } = require('../db');
const {
  buildOwnerMaps,
  resolveCenterOwner,
  isManagerRole,
  getCenterProvinceId,
  getUserProvinceAllowlist,
} = require('./center-ownership');
const {
  effectiveManagerScope,
  userHasGlobalCenterAccess,
  provinceInScope,
  ownerlessCentersAllowed,
} = require('./manager-scope');

/**
 * Experts who opted in (share_with_manager) and list this user as direct_manager.
 */
async function loadDelegatedOwners(username) {
  if (!username) return new Set();
  const r = await query(
    `SELECT username FROM app_users
     WHERE active = TRUE
       AND share_with_manager = TRUE
       AND NULLIF(BTRIM(direct_manager), '') = $1`,
    [username]
  );
  return new Set(r.rows.map(function (row) { return row.username; }));
}

async function loadCenterAccessContext(opts) {
  opts = opts || {};
  const [masterR, extraR, editsR] = await Promise.all([
    query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    query('SELECT id, row_num AS row, province_id, owner FROM center_extras'),
    query('SELECT center_key, data FROM center_edits'),
  ]);
  const centersMaster = {};
  masterR.rows.forEach(function (r) { centersMaster[r.key] = r.data; });
  const edits = {};
  editsR.rows.forEach(function (r) { edits[r.center_key] = r.data || {}; });

  const forUser = opts.forUser;
  let delegatedOwners = new Set();
  if (forUser && forUser.username) {
    delegatedOwners = await loadDelegatedOwners(forUser.username);
  }

  return {
    edits,
    ownerMaps: buildOwnerMaps(centersMaster, extraR.rows),
    delegatedOwners: delegatedOwners,
    // legacy alias (team scope UI removed; keep for older callers)
    teamUsernames: delegatedOwners,
  };
}

function provinceAllowed(user, centerKey, ownerMaps) {
  const allowlist = getUserProvinceAllowlist(user);
  if (!allowlist || !allowlist.length) return true;
  const provinceId = getCenterProvinceId(centerKey, ownerMaps);
  if (!provinceId) return true;
  return allowlist.includes(provinceId);
}

function canAccessCenter(user, centerKey, context) {
  if (!user || !centerKey) return false;

  // سوپر ادمین و مدیر سراسری: همه چیز
  if (user.role === 'سوپر ادمین') return true;
  if (isManagerRole(user.role) && userHasGlobalCenterAccess(user)) return true;

  const ownerMaps = context && context.ownerMaps;
  const edits = context && context.edits;
  const delegated = context && context.delegatedOwners;

  if (isManagerRole(user.role)) {
    const scope = effectiveManagerScope(user);
    if (scope.type === 'provinces') {
      if (provinceInScope(scope.ids, centerKey, ownerMaps)) return true;
      // additive: زیردستانی که تیک اشتراک زده‌اند
      const owner = resolveCenterOwner(centerKey, edits, ownerMaps);
      if (owner && delegated && delegated.has(owner)) return true;
      if (!owner) return ownerlessCentersAllowed();
      return false;
    }
  }

  if (!provinceAllowed(user, centerKey, ownerMaps)) return false;

  const owner = resolveCenterOwner(centerKey, edits, ownerMaps);
  if (!owner) return ownerlessCentersAllowed();
  if (owner === user.username) return true;
  if (delegated && delegated.has(owner)) return true;
  return false;
}

async function userCanAccessCenter(user, centerKey) {
  const context = await loadCenterAccessContext({ forUser: user });
  return canAccessCenter(user, centerKey, context);
}

function requireCenterAccess(getCenterKey) {
  return async function (req, res, next) {
    try {
      const centerKey = typeof getCenterKey === 'function'
        ? getCenterKey(req)
        : (req.params.centerKey || req.params.center_key || req.query.center_key || req.body.centerKey || req.body.center_key);
      if (!centerKey) return res.status(400).json({ error: 'centerKey الزامی است' });
      if (!(await userCanAccessCenter(req.user, centerKey))) {
        return res.status(403).json({ error: 'دسترسی به این مرکز مجاز نیست' });
      }
      next();
    } catch (e) {
      console.error('[center-access]', e.message);
      res.status(500).json({ error: 'خطای بررسی دسترسی' });
    }
  };
}

module.exports = {
  loadCenterAccessContext,
  loadDelegatedOwners,
  canAccessCenter,
  userCanAccessCenter,
  requireCenterAccess,
};

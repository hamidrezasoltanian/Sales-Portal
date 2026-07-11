'use strict';

const { query } = require('../db');
const {
  buildOwnerMaps,
  resolveCenterOwner,
  isManagerRole,
  getCenterProvinceId,
  getUserProvinceAllowlist,
} = require('./center-ownership');

async function loadCenterAccessContext() {
  const [masterR, extraR, editsR] = await Promise.all([
    query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    query('SELECT id, row_num AS row, province_id, owner FROM center_extras'),
    query('SELECT center_key, data FROM center_edits'),
  ]);
  const centersMaster = {};
  masterR.rows.forEach(function (r) { centersMaster[r.key] = r.data; });
  const edits = {};
  editsR.rows.forEach(function (r) { edits[r.center_key] = r.data || {}; });
  return { edits, ownerMaps: buildOwnerMaps(centersMaster, extraR.rows) };
}

function provinceAllowed(user, centerKey) {
  const allowlist = getUserProvinceAllowlist(user);
  if (!allowlist || !allowlist.length) return true;
  const provinceId = getCenterProvinceId(centerKey);
  return !!provinceId && allowlist.includes(provinceId);
}

function canAccessCenter(user, centerKey, context) {
  if (!user || !centerKey) return false;
  if (isManagerRole(user.role)) return true;
  if (!provinceAllowed(user, centerKey)) return false;
  const owner = resolveCenterOwner(centerKey, context.edits, context.ownerMaps);
  // Unassigned centers remain available for team intake.
  return !owner || owner === user.username;
}

async function userCanAccessCenter(user, centerKey) {
  const context = await loadCenterAccessContext();
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
  canAccessCenter,
  userCanAccessCenter,
  requireCenterAccess,
};

'use strict';

const { MANAGER_ROLES: MANAGER_ROLE_LIST, isManagerRole } = require('./roles');
const MANAGER_ROLES = new Set(MANAGER_ROLE_LIST);

/** Default-deny: only these top-level DB keys may be exposed to non-managers (then row-filtered). */
const EXPERT_DB_GET_ALLOWLIST = new Set([
  'edits', 'notes', 'rTags', 'tags', 'weekTags', 'weekEntries', 'events', 'checklist',
  'extra', 'settings', 'callLog', 'visitLog', 'salesLog', 'changeLog', 'tasks', 'notifications',
  '_serverTs',
]);

/** Default-deny: only these keys may be written by non-managers via PUT /api/data/db. */
const EXPERT_DB_PUT_ALLOWLIST = new Set([
  'edits', 'notes', 'rTags', 'weekEntries', 'events', 'checklist', 'callLog', 'visitLog', 'kpiTargets',
]);

function pickAllowlistedKeys(obj, allowSet) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  allowSet.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
  });
  return out;
}

function isExpertRole(role) {
  return role === 'کارشناس فروش';
}

/** Build lookup maps for static center ownership from master data + extras. */
function buildOwnerMaps(centersMaster, extraRows) {
  const staticOwners = {};

  if (centersMaster && centersMaster.CENTERS) {
  const centers = centersMaster.CENTERS;
    if (Array.isArray(centers)) {
      centers.forEach(function (c) {
        if (c && c.id != null && c.owner) {
          staticOwners['center_' + c.id] = c.owner;
        }
      });
    }
  }

  if (centersMaster && centersMaster.PC_RAW) {
    const pcRaw = centersMaster.PC_RAW;
    if (typeof pcRaw === 'object') {
      Object.keys(pcRaw).forEach(function (provId) {
        const list = pcRaw[provId];
        if (!Array.isArray(list)) return;
        list.forEach(function (c, idx) {
          if (c && c.owner) {
            staticOwners['pc_' + provId + '||' + (idx + 1)] = c.owner;
          }
        });
      });
    }
  }

  // Extra centers are stored as center_extras.id (often "pc_new_…" / "new_…")
  // while edit keys are recK(rtype,id) → "pc_"+id or "center_"+id.
  // Older bugs created ids like "pc_new_TS" → edit key "pc_pc_new_TS".
  const extraOwners = {};
  const provinceByKey = {};
  (extraRows || []).forEach(function (row) {
    if (!row || row.id == null) return;
    const id = String(row.id);
    const keys = ['center_' + id, 'pc_' + id, 'extra_' + id];
    if (row.province_id != null && row.row != null) {
      keys.push('pc_' + row.province_id + '||' + row.row);
    }
    keys.forEach(function (k) {
      if (row.owner) extraOwners[k] = row.owner;
      if (row.province_id) provinceByKey[k] = String(row.province_id);
    });
  });

  return { staticOwners, extraOwners, provinceByKey };
}

function getProvinceEditKey(provId) {
  if (!provId) return '';
  if (provId === 'tehran') return 'center_tehran';
  return 'pc_' + provId;
}

function resolveProvinceOwner(provId, edits) {
  if (!provId || !edits) return null;
  const key = getProvinceEditKey(provId);
  const pe = edits[key];
  if (pe && pe.owner) return pe.owner;
  return null;
}

/**
 * Canonical owner resolution (mirrors frontend getCenterOwner chain).
 * @param {string} centerKey - e.g. center_42 or pc_tehran||3
 * @param {object} edits - DB.edits map
 * @param {object} ownerMaps - from buildOwnerMaps
 */
function resolveCenterOwner(centerKey, edits, ownerMaps) {
  const edit = edits && edits[centerKey];
  if (edit && edit.owner) return edit.owner;

  const provId = getCenterProvinceId(centerKey, ownerMaps);
  if (provId) {
    const po = resolveProvinceOwner(provId, edits);
    if (po) return po;
  }

  if (ownerMaps.staticOwners[centerKey]) return ownerMaps.staticOwners[centerKey];
  if (ownerMaps.extraOwners[centerKey]) return ownerMaps.extraOwners[centerKey];

  return null;
}

function userOwnsCenter(username, centerKey, edits, ownerMaps) {
  const owner = resolveCenterOwner(centerKey, edits, ownerMaps);
  return owner === username;
}

/** Province id from center_key — tehran centers use center_* prefix */
function getCenterProvinceId(centerKey, ownerMaps) {
  if (!centerKey || typeof centerKey !== 'string') return null;
  if (ownerMaps && ownerMaps.provinceByKey && ownerMaps.provinceByKey[centerKey]) {
    return ownerMaps.provinceByKey[centerKey];
  }
  if (centerKey.startsWith('pc_')) {
    const rest = centerKey.slice(3);
    const sepIdx = rest.indexOf('||');
    if (sepIdx > 0) return rest.slice(0, sepIdx);
    // Extra/manual ids (pc_new_*, pc_pc_new_*) are not province ids — leave unknown
    if (rest.indexOf('new_') >= 0) return null;
    return rest;
  }
  if (centerKey.startsWith('center_')) return 'tehran';
  if (centerKey.startsWith('extra_')) {
    if (ownerMaps && ownerMaps.provinceByKey && ownerMaps.provinceByKey[centerKey]) {
      return ownerMaps.provinceByKey[centerKey];
    }
    return null;
  }
  return null;
}

function applyProvinceRestriction(allowedKeys, allowedProvinces, ownerMaps) {
  if (!allowedProvinces || !allowedProvinces.length) return allowedKeys;
  const out = new Set();
  allowedKeys.forEach(function (key) {
    const pid = getCenterProvinceId(key, ownerMaps);
    // Unknown province (manual extras without map): keep if already ownership-allowed
    if (!pid || allowedProvinces.includes(pid)) out.add(key);
  });
  return out;
}

function getUserProvinceAllowlist(user) {
  const perms = (user && user.permissions) || {};
  return Array.isArray(perms.provinces) && perms.provinces.length ? perms.provinces : null;
}

function filterObjectByCenterKeys(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).forEach(function (key) {
    if (allowedKeys.has(key)) out[key] = obj[key];
  });
  return out;
}

function filterArrayByCenterKey(arr, allowedKeys, keyField) {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(function (item) {
    if (!item) return false;
    const ck = item[keyField || 'centerKey'] || item.rkey || item.center_key;
    if (!ck) return true;
    return allowedKeys.has(ck);
  });
}

/**
 * Filter full DB payload for sales experts — global managers / super-admin see everything.
 * Delegated centers (share_with_manager → direct_manager) are additive for any viewer.
 * @param {object} [accessOpts] — { delegatedOwners?: Set<string>, teamUsernames?: Set (legacy) }
 */
function filterDbForUser(db, user, ownerMaps, accessOpts) {
  if (!db) return db;
  const { userHasGlobalCenterAccess, effectiveManagerScope, ownerlessCentersAllowed } = require('./manager-scope');
  if (user.role === 'سوپر ادمین' || userHasGlobalCenterAccess(user)) return db;

  accessOpts = accessOpts || {};
  const scope = effectiveManagerScope(user);
  // Non-global managers keep full DB shape, then center-filter (incl. legacy team scope)
  const isMgrScoped = isManagerRole(user.role) && scope.type !== 'global';
  const delegated = accessOpts.delegatedOwners || accessOpts.teamUsernames || new Set();

  const base = pickAllowlistedKeys(db, EXPERT_DB_GET_ALLOWLIST);
  const edits = base.edits || db.edits || {};
  let allowed = new Set();

  if (isMgrScoped && scope.type === 'provinces') {
    Object.keys(edits).forEach(function (key) {
      if (applyProvinceRestriction(new Set([key]), scope.ids, ownerMaps).has(key)) allowed.add(key);
    });
    Object.keys(ownerMaps.staticOwners || {}).forEach(function (key) {
      if (applyProvinceRestriction(new Set([key]), scope.ids, ownerMaps).has(key)) allowed.add(key);
    });
    Object.keys(ownerMaps.extraOwners || {}).forEach(function (key) {
      if (applyProvinceRestriction(new Set([key]), scope.ids, ownerMaps).has(key)) allowed.add(key);
    });
  } else {
    Object.keys(edits).forEach(function (key) {
      if (userOwnsCenter(user.username, key, edits, ownerMaps)) allowed.add(key);
    });
    Object.keys(ownerMaps.staticOwners || {}).forEach(function (key) {
      if (ownerMaps.staticOwners[key] === user.username) allowed.add(key);
    });
    Object.keys(ownerMaps.extraOwners || {}).forEach(function (key) {
      if (ownerMaps.extraOwners[key] === user.username) allowed.add(key);
    });
    const provAllow = getUserProvinceAllowlist(user);
    if (provAllow) {
      allowed = applyProvinceRestriction(allowed, provAllow, ownerMaps);
    }
  }

  if (delegated && delegated.size) {
    Object.keys(edits).forEach(function (key) {
      const owner = resolveCenterOwner(key, edits, ownerMaps);
      if (owner && delegated.has(owner)) allowed.add(key);
    });
    Object.keys(ownerMaps.staticOwners || {}).forEach(function (key) {
      if (delegated.has(ownerMaps.staticOwners[key])) allowed.add(key);
    });
    Object.keys(ownerMaps.extraOwners || {}).forEach(function (key) {
      if (delegated.has(ownerMaps.extraOwners[key])) allowed.add(key);
    });
  }

  const filtered = Object.assign({}, isMgrScoped ? db : base);
  if (isMgrScoped) Object.assign(filtered, db);

  filtered.edits = filterObjectByCenterKeys(edits, allowed);
  filtered.notes = filterObjectByCenterKeys(base.notes || db.notes, allowed);
  filtered.rTags = filterObjectByCenterKeys(base.rTags || base.tags || db.rTags || db.tags, allowed);

  const weekSrc = base.weekEntries || db.weekEntries;
  if (weekSrc) {
    const we = {};
    Object.keys(weekSrc).forEach(function (k) {
      const entry = weekSrc[k];
      if (!entry) return;
      const recKey = entry.rtype && entry.rid != null
        ? entry.rtype + '_' + entry.rid
        : (k.split(':::')[1] || '');
      if (recKey && allowed.has(recKey)) we[k] = entry;
      else if (entry.addedBy === user.username) we[k] = entry;
      else if (entry.addedBy && delegated.has(entry.addedBy)) we[k] = entry;
    });
    filtered.weekEntries = we;
  }

  const changeLog = base.changeLog || db.changeLog;
  if (changeLog) {
    filtered.changeLog = changeLog.filter(function (cl) {
      return !cl.rkey || allowed.has(cl.rkey);
    });
  }

  const salesLog = base.salesLog || db.salesLog;
  if (salesLog) {
    filtered.salesLog = salesLog.filter(function (s) {
      return !s.centerKey || allowed.has(s.centerKey);
    });
  }

  const tasks = base.tasks || db.tasks;
  if (tasks) {
    filtered.tasks = (tasks || []).filter(function (t) {
      if (t.owner === user.username) return true;
      if (t.centerKey && allowed.has(t.centerKey)) return true;
      if (t.owner && delegated.has(t.owner)) return true;
      return false;
    });
  }

  const events = base.events || db.events;
  if (events) {
    filtered.events = (events || []).filter(function (ev) {
      if (isMgrScoped) {
        if (!ev.owner) return true;
        if (ev.owner === user.username) return true;
        if (delegated.has(ev.owner)) return true;
        if (scope.type === 'provinces') return true;
        return false;
      }
      if (!ev.owner || ev.owner === user.username) return true;
      if (delegated.has(ev.owner)) return true;
      return false;
    });
  }

  if (!isMgrScoped) {
    if (base.callLog) {
      filtered.callLog = (base.callLog || []).filter(function (l) {
        return !l.userId || l.userId === user.username;
      });
    }
    if (base.visitLog) {
      filtered.visitLog = (base.visitLog || []).filter(function (l) {
        return !l.userId || l.userId === user.username;
      });
    }
    if (base.checklist) {
      const ck = {};
      Object.keys(base.checklist || {}).forEach(function (k) {
        if (k.endsWith('_' + user.username)) ck[k] = base.checklist[k];
      });
      filtered.checklist = ck;
    }
    if (base.notifications) {
      filtered.notifications = (base.notifications || []).filter(function (n) {
        return n.to === user.username;
      });
    }
    if (base.settings) {
      filtered.settings = Object.assign({}, base.settings);
      delete filtered.settings.anthropicKey;
      if (filtered.settings.members) {
        filtered.settings.members = filtered.settings.members.map(function (m) {
          return { id: m.id, name: m.name, role: m.role, active: m.active, color: m.color };
        });
      }
    }
  }

  filtered._rbacFiltered = true;
  return filtered;
}

/**
 * Strip unauthorized center mutations from PUT body for experts.
 * Returns { body, rejected } where rejected lists blocked center keys.
 */
function filterPutBodyForUser(body, user, serverEdits, ownerMaps) {
  if (!body) return { body: body, rejected: [] };
  const { userHasGlobalCenterAccess } = require('./manager-scope');
  if (userHasGlobalCenterAccess(user)) return { body: body, rejected: [] };

  // Scoped managers: reject writes outside canAccessCenter — use ownership helpers
  // For now, non-global managers fall through to ownership checks like experts,
  // but province-scoped managers may edit any center in their provinces.
  const { effectiveManagerScope } = require('./manager-scope');
  const scope = effectiveManagerScope(user);
  const isProvMgr = isManagerRole(user.role) && scope.type === 'provinces';
  const isTeamMgr = isManagerRole(user.role) && scope.type === 'team';

  const rejected = [];
  const picked = isManagerRole(user.role) ? Object.assign({}, body) : pickAllowlistedKeys(body, EXPERT_DB_PUT_ALLOWLIST);
  const out = Object.assign({}, picked);

  if (!isManagerRole(user.role)) {
    Object.keys(body).forEach(function (key) {
      if (!EXPERT_DB_PUT_ALLOWLIST.has(key)) rejected.push('deny:' + key);
    });
  }

  function centerOk(key) {
    if (isProvMgr) {
      return applyProvinceRestriction(new Set([key]), scope.ids, ownerMaps).has(key);
    }
    if (isTeamMgr) {
      const owner = resolveCenterOwner(key, serverEdits, ownerMaps);
      // Without team set on PUT path, fall back to own centers only (safe)
      return owner === user.username;
    }
    if (!userOwnsCenter(user.username, key, serverEdits, ownerMaps)) return false;
    const provAllow = getUserProvinceAllowlist(user);
    if (provAllow && !applyProvinceRestriction(new Set([key]), provAllow, ownerMaps).has(key)) return false;
    return true;
  }

  function checkKeys(collection, label) {
    if (!collection || typeof collection !== 'object') return collection;
    const filtered = {};
    Object.keys(collection).forEach(function (key) {
      if (!centerOk(key)) {
        rejected.push(label + ':' + key);
        return;
      }
      filtered[key] = collection[key];
    });
    return filtered;
  }

  if (out.edits) out.edits = checkKeys(out.edits, 'edits');
  if (out.notes) out.notes = checkKeys(out.notes, 'notes');
  const tags = out.rTags || out.tags;
  if (tags) {
    const ft = checkKeys(tags, 'tags');
    out.rTags = ft;
    delete out.tags;
  }

  if (out.weekEntries) {
    const we = {};
    Object.keys(out.weekEntries).forEach(function (k) {
      const entry = out.weekEntries[k];
      const recKey = entry && entry.rtype && entry.rid != null
        ? entry.rtype + '_' + entry.rid
        : (k.split(':::')[1] || '');
      if (recKey && centerOk(recKey)) {
        we[k] = entry;
      } else if (entry && entry.addedBy === user.username) {
        we[k] = entry;
      } else {
        rejected.push('weekEntries:' + k);
      }
    });
    out.weekEntries = we;
  }

  if (!isManagerRole(user.role)) {
    if (out.settings) delete out.settings;
    if (out.provOverrides !== undefined) delete out.provOverrides;
    if (out.kpiTargets) {
      const kt = {};
      Object.keys(out.kpiTargets).forEach(function (k) {
        if (k.startsWith(user.username + ':')) kt[k] = out.kpiTargets[k];
      });
      out.kpiTargets = kt;
    }
  }

  return { body: out, rejected: rejected };
}

module.exports = {
  MANAGER_ROLES,
  isManagerRole,
  isExpertRole,
  buildOwnerMaps,
  resolveCenterOwner,
  userOwnsCenter,
  getCenterProvinceId,
  applyProvinceRestriction,
  getUserProvinceAllowlist,
  filterDbForUser,
  filterPutBodyForUser,
};

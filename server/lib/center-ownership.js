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

/**
 * Canonical owner resolution (mirrors frontend _wpGetOwner chain).
 * @param {string} centerKey - e.g. center_42 or pc_tehran||3
 * @param {object} edits - DB.edits map
 * @param {object} ownerMaps - from buildOwnerMaps
 */
function resolveCenterOwner(centerKey, edits, ownerMaps) {
  const edit = edits && edits[centerKey];
  if (edit && edit.owner) return edit.owner;
  if (ownerMaps.staticOwners[centerKey]) return ownerMaps.staticOwners[centerKey];
  if (ownerMaps.extraOwners[centerKey]) return ownerMaps.extraOwners[centerKey];
  // Province-level owner fallback for pc centers
  if (centerKey.startsWith('pc_')) {
    const rest = centerKey.slice(3);
    const sepIdx = rest.indexOf('||');
    if (sepIdx > 0) {
      const provId = rest.slice(0, sepIdx);
      const provKey = 'pc_' + provId;
      const provEdit = edits && edits[provKey];
      if (provEdit && provEdit.owner) return provEdit.owner;
    }
  }

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
 * Filter full DB payload for sales experts — managers see everything.
 */
function filterDbForUser(db, user, ownerMaps) {
  if (!db || isManagerRole(user.role)) return db;

  const base = pickAllowlistedKeys(db, EXPERT_DB_GET_ALLOWLIST);
  const edits = base.edits || {};
  let allowed = new Set();
  Object.keys(edits).forEach(function (key) {
    if (userOwnsCenter(user.username, key, edits, ownerMaps)) allowed.add(key);
  });

  // Also include centers where static/extra owner matches even if no edit row yet
  Object.keys(ownerMaps.staticOwners).forEach(function (key) {
    if (ownerMaps.staticOwners[key] === user.username) allowed.add(key);
  });
  Object.keys(ownerMaps.extraOwners).forEach(function (key) {
    if (ownerMaps.extraOwners[key] === user.username) allowed.add(key);
  });

  const provAllow = getUserProvinceAllowlist(user);
  if (provAllow) {
    allowed = applyProvinceRestriction(allowed, provAllow, ownerMaps);
  }

  const filtered = Object.assign({}, base);
  filtered.edits = filterObjectByCenterKeys(edits, allowed);
  filtered.notes = filterObjectByCenterKeys(base.notes, allowed);
  filtered.rTags = filterObjectByCenterKeys(base.rTags || base.tags, allowed);

  if (base.weekEntries) {
    const we = {};
    Object.keys(base.weekEntries).forEach(function (k) {
      const entry = base.weekEntries[k];
      if (!entry) return;
      const recKey = entry.rtype && entry.rid != null
        ? entry.rtype + '_' + entry.rid
        : (k.split(':::')[1] || '');
      if (recKey && allowed.has(recKey)) we[k] = entry;
      else if (entry.addedBy === user.username) we[k] = entry;
    });
    filtered.weekEntries = we;
  }

  if (base.changeLog) {
    filtered.changeLog = base.changeLog.filter(function (cl) {
      return !cl.rkey || allowed.has(cl.rkey);
    });
  }

  if (base.salesLog) {
    filtered.salesLog = base.salesLog.filter(function (s) {
      return !s.centerKey || allowed.has(s.centerKey);
    });
  }

  if (base.tasks) {
    filtered.tasks = (base.tasks || []).filter(function (t) {
      if (t.owner === user.username) return true;
      if (t.centerKey && allowed.has(t.centerKey)) return true;
      return false;
    });
  }

  if (base.events) {
    filtered.events = (base.events || []).filter(function (ev) {
      return !ev.owner || ev.owner === user.username;
    });
  }

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

  filtered._rbacFiltered = true;
  return filtered;
}

/**
 * Strip unauthorized center mutations from PUT body for experts.
 * Returns { body, rejected } where rejected lists blocked center keys.
 */
function filterPutBodyForUser(body, user, serverEdits, ownerMaps) {
  if (!body || isManagerRole(user.role)) return { body: body, rejected: [] };

  const rejected = [];
  const picked = pickAllowlistedKeys(body, EXPERT_DB_PUT_ALLOWLIST);
  const out = Object.assign({}, picked);

  Object.keys(body).forEach(function (key) {
    if (!EXPERT_DB_PUT_ALLOWLIST.has(key)) rejected.push('deny:' + key);
  });

  function checkKeys(collection, label) {
    if (!collection || typeof collection !== 'object') return collection;
    const filtered = {};
    const provAllow = getUserProvinceAllowlist(user);
    Object.keys(collection).forEach(function (key) {
      if (!userOwnsCenter(user.username, key, serverEdits, ownerMaps)) {
        rejected.push(label + ':' + key);
        return;
      }
      if (provAllow && !applyProvinceRestriction(new Set([key]), provAllow, ownerMaps).has(key)) {
        rejected.push(label + ':' + key + ':province');
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
      const provAllow = getUserProvinceAllowlist(user);
      const provOk = !provAllow || !recKey || applyProvinceRestriction(new Set([recKey]), provAllow, ownerMaps).has(recKey);
      if (recKey && userOwnsCenter(user.username, recKey, serverEdits, ownerMaps) && provOk) {
        we[k] = entry;
      } else if (entry && entry.addedBy === user.username && provOk) {
        we[k] = entry;
      } else {
        rejected.push('weekEntries:' + k);
      }
    });
    out.weekEntries = we;
  }

  if (out.settings) {
    delete out.settings;
  }
  if (out.provOverrides !== undefined) {
    delete out.provOverrides;
  }
  if (out.kpiTargets) {
    const kt = {};
    Object.keys(out.kpiTargets).forEach(function (k) {
      if (k.startsWith(user.username + ':')) kt[k] = out.kpiTargets[k];
    });
    out.kpiTargets = kt;
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

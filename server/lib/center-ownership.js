'use strict';

const MANAGER_ROLES = new Set(['مدیر', 'سوپر ادمین']);

function isManagerRole(role) {
  return MANAGER_ROLES.has(role);
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

  const extraOwners = {};
  (extraRows || []).forEach(function (row) {
    if (row && row.id && row.owner) {
      extraOwners['center_' + row.id] = row.owner;
      if (row.province_id != null && row.row != null) {
        extraOwners['pc_' + row.province_id + '||' + row.row] = row.owner;
      }
    }
  });

  return { staticOwners, extraOwners };
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

  const edits = db.edits || {};
  const allowed = new Set();
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

  const filtered = Object.assign({}, db);
  filtered.edits = filterObjectByCenterKeys(edits, allowed);
  filtered.notes = filterObjectByCenterKeys(db.notes, allowed);
  filtered.rTags = filterObjectByCenterKeys(db.rTags || db.tags, allowed);

  if (db.weekEntries) {
    const we = {};
    Object.keys(db.weekEntries).forEach(function (k) {
      const entry = db.weekEntries[k];
      if (!entry) return;
      const recKey = entry.rtype && entry.rid != null
        ? entry.rtype + '_' + entry.rid
        : (k.split(':::')[1] || '');
      if (recKey && allowed.has(recKey)) we[k] = entry;
      else if (entry.addedBy === user.username) we[k] = entry;
    });
    filtered.weekEntries = we;
  }

  if (db.changeLog) {
    filtered.changeLog = db.changeLog.filter(function (cl) {
      return !cl.rkey || allowed.has(cl.rkey);
    });
  }

  if (db.salesLog) {
    filtered.salesLog = db.salesLog.filter(function (s) {
      return !s.centerKey || allowed.has(s.centerKey);
    });
  }

  if (db.tasks) {
    filtered.tasks = (db.tasks || []).filter(function (t) {
      if (t.owner === user.username) return true;
      if (t.centerKey && allowed.has(t.centerKey)) return true;
      return false;
    });
  }

  if (db.events) {
    filtered.events = (db.events || []).filter(function (ev) {
      return !ev.owner || ev.owner === user.username;
    });
  }

  if (db.settings) {
    filtered.settings = Object.assign({}, db.settings);
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
  const out = Object.assign({}, body);

  function checkKeys(collection, label) {
    if (!collection || typeof collection !== 'object') return collection;
    const filtered = {};
    Object.keys(collection).forEach(function (key) {
      if (userOwnsCenter(user.username, key, serverEdits, ownerMaps)) {
        filtered[key] = collection[key];
      } else {
        rejected.push(label + ':' + key);
      }
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
      if (recKey && userOwnsCenter(user.username, recKey, serverEdits, ownerMaps)) {
        we[k] = entry;
      } else if (entry && entry.addedBy === user.username) {
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
  filterDbForUser,
  filterPutBodyForUser,
};

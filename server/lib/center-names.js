'use strict';

const { query } = require('../db');

function parseCenterKey(centerKey) {
  if (!centerKey) return { rtype: '', rid: '' };
  const parts = String(centerKey).split('_');
  return { rtype: parts[0] || '', rid: parts.slice(1).join('_') };
}

function fallbackLabel(centerKey) {
  if (!centerKey || centerKey === '_none') return 'سایر / بدون مرکز';
  const { rtype, rid } = parseCenterKey(centerKey);
  if (rtype === 'pc' && /^new\s?\d/i.test(rid)) return 'پتانسیل جدید';
  if (rtype === 'pc') return 'پتانسیل';
  const stripped = String(centerKey).replace(/^(center|pc)_/, '').replace(/_/g, ' ').trim();
  if (/^new\s+\d+$/i.test(stripped)) return 'پتانسیل جدید';
  return stripped || centerKey;
}

function titleCenterName(title) {
  if (!title || title.indexOf(' — ') < 0) return null;
  const part = title.split(' — ')[0].trim();
  if (!part || part.indexOf('پیگیری') === 0) return null;
  if (/^pc\s*new/i.test(part)) return null;
  if (/^new\s+\d+$/i.test(part)) return null;
  if (part === 'مرکز') return null;
  return part;
}

function centerKeyAliases(centerKey) {
  const aliases = [];
  if (!centerKey) return aliases;
  aliases.push(centerKey);
  const { rtype, rid } = parseCenterKey(centerKey);
  if (rid) aliases.push(rid);
  if (rtype === 'center' && rid && !rid.startsWith('c_') && !rid.startsWith('mz_t_')) {
    aliases.push('c_' + rid);
    aliases.push('mz_t_' + rid);
  }
  return Array.from(new Set(aliases.filter(Boolean)));
}

function isWeakDisplayName(name) {
  if (!name) return true;
  const s = String(name).trim();
  if (!s || s === 'مرکز' || s === 'پتانسیل') return true;
  if (/^c \d+$/i.test(s)) return true;
  if (/^mz_t_\d+$/i.test(s)) return true;
  if (/^new\s+\d+$/i.test(s)) return true;
  return false;
}

async function loadMasterNameMap(keys) {
  const map = {};
  const unique = Array.from(new Set((keys || []).filter(Boolean)));
  if (!unique.length) return map;

  const centerIds = new Set();
  const pcLookups = [];
  unique.forEach(function (k) {
    const p = parseCenterKey(k);
    if (p.rtype === 'center' && p.rid) centerIds.add(String(p.rid));
    else if (p.rtype === 'pc' && p.rid) pcLookups.push({ key: k, rid: String(p.rid) });
  });

  if (centerIds.size) {
    const r = await query("SELECT data FROM centers_master WHERE key = 'CENTERS'");
    const centers = (r.rows[0] && r.rows[0].data) || [];
    unique.forEach(function (k) {
      const rid = parseCenterKey(k).rid;
      if (!rid) return;
      const c = centers.find(function (x) { return String(x.id) === String(rid); });
      if (c && c.name) map[k] = c.name;
    });
  }

  if (pcLookups.length) {
    const r = await query("SELECT data FROM centers_master WHERE key = 'PC_RAW'");
    const raw = (r.rows[0] && r.rows[0].data) || {};
    pcLookups.forEach(function (lk) {
      const provId = lk.rid.split('||')[0];
      const arr = raw[provId] || [];
      const c = arr.find(function (x) { return String(x.id) === lk.rid; });
      if (c && c.name) map[lk.key] = c.name;
    });
  }

  return map;
}

async function loadCenterNameMap(keys) {
  const map = {};
  const unique = Array.from(new Set((keys || []).filter(function (k) { return k && k !== '_none'; })));
  if (!unique.length) return map;

  const aliasToOrig = {};
  const allAliases = [];
  unique.forEach(function (k) {
    centerKeyAliases(k).forEach(function (alias) {
      allAliases.push(alias);
      if (!aliasToOrig[alias]) aliasToOrig[alias] = [];
      if (aliasToOrig[alias].indexOf(k) < 0) aliasToOrig[alias].push(k);
    });
  });

  const cacheR = await query(
    'SELECT center_key, center_name FROM crm_centers_cache WHERE center_key = ANY($1)',
    [Array.from(new Set(allAliases))]
  );
  cacheR.rows.forEach(function (r) {
    if (!r.center_name) return;
    (aliasToOrig[r.center_key] || []).forEach(function (origK) {
      if (!map[origK]) map[origK] = r.center_name;
    });
  });

  const missing = unique.filter(function (k) { return !map[k]; });
  if (missing.length) {
    const editR = await query(
      'SELECT center_key, data FROM center_edits WHERE center_key = ANY($1)',
      [missing]
    );
    editR.rows.forEach(function (r) {
      const d = r.data || {};
      const nm = d.nameOverride || d.name;
      if (nm) map[r.center_key] = nm;
    });
  }

  const stillMissing = unique.filter(function (k) { return !map[k]; });
  if (stillMissing.length) {
    const weAliases = [];
    stillMissing.forEach(function (k) { centerKeyAliases(k).forEach(function (a) { weAliases.push(a); }); });
    const weR = await query(
      `SELECT DISTINCT ON (rec_key) rec_key, center_name
       FROM week_entries
       WHERE rec_key = ANY($1) AND center_name IS NOT NULL AND center_name != ''
       ORDER BY rec_key, updated_at DESC NULLS LAST`,
      [Array.from(new Set(weAliases))]
    );
    weR.rows.forEach(function (r) {
      if (!r.center_name) return;
      (aliasToOrig[r.rec_key] || []).forEach(function (origK) {
        if (!map[origK]) map[origK] = r.center_name;
      });
    });
  }

  const masterMap = await loadMasterNameMap(unique.filter(function (k) { return !map[k]; }));
  Object.keys(masterMap).forEach(function (k) {
    if (!map[k] && masterMap[k]) map[k] = masterMap[k];
  });

  unique.forEach(function (k) {
    if (!map[k]) map[k] = fallbackLabel(k);
  });
  return map;
}

async function resolveCenterDisplayName(centerKey) {
  if (!centerKey || centerKey === '_none') return 'سایر / بدون مرکز';
  const map = await loadCenterNameMap([centerKey]);
  return map[centerKey] || fallbackLabel(centerKey);
}

function enrichItemsWithCenterNames(items, nameMap) {
  return (items || []).map(function (item) {
    const fromTitle = titleCenterName(item.title);
    const key = item.centerKey;
    let centerName = item.centerName || null;
    if (!centerName && fromTitle && !isWeakDisplayName(fromTitle)) centerName = fromTitle;
    if (!centerName && key && nameMap[key] && !isWeakDisplayName(nameMap[key])) centerName = nameMap[key];
    if (!centerName && key) centerName = nameMap[key] || fallbackLabel(key);
    return Object.assign({}, item, { centerName: centerName || 'سایر / بدون مرکز' });
  });
}

async function enrichInboxItems(items) {
  const keys = (items || []).map(function (i) { return i.centerKey; }).filter(Boolean);
  const nameMap = await loadCenterNameMap(keys);
  return enrichItemsWithCenterNames(items, nameMap);
}

module.exports = {
  parseCenterKey,
  centerKeyAliases,
  fallbackLabel,
  titleCenterName,
  loadCenterNameMap,
  loadMasterNameMap,
  resolveCenterDisplayName,
  enrichItemsWithCenterNames,
  enrichInboxItems,
};

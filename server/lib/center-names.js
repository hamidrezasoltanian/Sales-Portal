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

async function loadCenterNameMap(keys) {
  const map = {};
  const unique = Array.from(new Set((keys || []).filter(function (k) { return k && k !== '_none'; })));
  if (!unique.length) return map;

  const cacheR = await query(
    'SELECT center_key, center_name FROM crm_centers_cache WHERE center_key = ANY($1)',
    [unique]
  );
  cacheR.rows.forEach(function (r) {
    if (r.center_name) map[r.center_key] = r.center_name;
  });

  const missing = unique.filter(function (k) { return !map[k]; });
  if (missing.length) {
    const editR = await query(
      'SELECT center_key, data FROM center_edits WHERE center_key = ANY($1)',
      [missing]
    );
    editR.rows.forEach(function (r) {
      const d = r.data || {};
      if (d.nameOverride) map[r.center_key] = d.nameOverride;
    });
  }

  const stillMissing = unique.filter(function (k) { return !map[k]; });
  if (stillMissing.length) {
    const weR = await query(
      `SELECT DISTINCT ON (rec_key) rec_key, center_name
       FROM week_entries
       WHERE rec_key = ANY($1) AND center_name IS NOT NULL AND center_name != ''
       ORDER BY rec_key, updated_at DESC NULLS LAST`,
      [stillMissing]
    );
    weR.rows.forEach(function (r) {
      if (r.center_name) map[r.rec_key] = r.center_name;
    });
  }

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
    if (!centerName && fromTitle) centerName = fromTitle;
    if (!centerName && key && nameMap[key]) centerName = nameMap[key];
    if (!centerName && key) centerName = fallbackLabel(key);
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
  fallbackLabel,
  titleCenterName,
  loadCenterNameMap,
  resolveCenterDisplayName,
  enrichItemsWithCenterNames,
  enrichInboxItems,
};

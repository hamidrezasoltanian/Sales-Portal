'use strict';

const { query } = require('../db');

function normText(s) {
  return String(s || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase()
    .trim();
}

async function loadCenterCatalog() {
  const result = await query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')");
  const centers = [];
  let tehran = [];
  let pcRaw = {};
  for (const row of result.rows) {
    if (row.key === 'CENTERS') tehran = Array.isArray(row.data) ? row.data : [];
    if (row.key === 'PC_RAW') pcRaw = row.data && typeof row.data === 'object' ? row.data : {};
  }

  for (const c of tehran) {
    if (!c || c.id == null) continue;
    const id = String(c.id);
    centers.push({
      centerKey: `center_${id}`,
      rtype: 'center',
      rid: id,
      name: c.nameOverride || c.name || id,
      province: 'تهران',
      owner: c.owner || '',
    });
  }

  for (const [provId, list] of Object.entries(pcRaw)) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c) continue;
      const n = c.n != null ? String(c.n) : '';
      const rid = `${provId}||${n}`;
      centers.push({
        centerKey: `pc_${rid}`,
        rtype: 'pc',
        rid,
        name: c.nameOverride || c.name || rid,
        province: provId,
        owner: c.owner || '',
      });
    }
  }

  return centers;
}

async function searchLetterCenters(q, limit = 30) {
  const catalog = await loadCenterCatalog();
  const needle = normText(q);
  let list = catalog;
  if (needle) {
    list = catalog.filter((c) => {
      const hay = normText(`${c.name} ${c.province} ${c.owner}`);
      return hay.includes(needle);
    });
  }
  return list.slice(0, Math.min(Math.max(limit, 1), 100));
}

async function resolveCenterName(centerKey) {
  if (!centerKey) return '';
  const catalog = await loadCenterCatalog();
  const hit = catalog.find((c) => c.centerKey === centerKey);
  return hit ? hit.name : '';
}

module.exports = {
  loadCenterCatalog,
  searchLetterCenters,
  resolveCenterName,
};

#!/usr/bin/env node
'use strict';
/**
 * List orphan center_edits whose center_key province ≠ address province.
 * Usage: node scripts/audit-province-mismatch.js [--limit=50]
 */
const { pool } = require('../server/db');
const {
  loadCatalog,
  resolveOrphanProvince,
  PROV_ID_TO_NAME,
  extractDisplayNameFromEdit,
} = require('../server/lib/center-merge-suggestions');

async function main() {
  const limitArg = process.argv.find(function (a) { return a.startsWith('--limit='); });
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

  const { orphanEdits } = await loadCatalog();
  const mismatches = [];
  orphanEdits.forEach(function (o) {
    const ctx = resolveOrphanProvince(o);
    if (!ctx.provinceMismatch) return;
    mismatches.push({
      key: o.center_key,
      from: PROV_ID_TO_NAME[ctx.keyProv] || ctx.keyProv,
      to: PROV_ID_TO_NAME[ctx.addrProv] || ctx.addrProv,
      name: extractDisplayNameFromEdit(o.data, o.center_key),
      address: (o.data && o.data.address || '').slice(0, 80),
    });
  });

  console.log('══════════════════════════════════════════════════');
  console.log('  Province mismatch orphans:', mismatches.length);
  console.log('══════════════════════════════════════════════════');
  mismatches.slice(0, limit).forEach(function (m) {
    console.log('\n' + m.key);
    console.log('  نام:', m.name);
    console.log('  کلید:', m.from, '→ آدرس:', m.to);
    console.log('  آدرس:', m.address);
  });
  if (mismatches.length > limit) {
    console.log('\n... and', mismatches.length - limit, 'more (use --limit=N)');
  }

  await pool.end();
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});

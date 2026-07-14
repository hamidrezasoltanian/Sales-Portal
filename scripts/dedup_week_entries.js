#!/usr/bin/env node
'use strict';

/**
 * One-shot cleanup: keep one active (non-done) week_entries row per rec_key.
 * Keeps the lexicographically newest week_id; deletes older duplicates.
 *
 * Usage: node scripts/dedup_week_entries.js
 */

const { query, pool } = require('../server/db');

async function main() {
  const r = await query(`
    SELECT id, key, week_id, rec_key, done
    FROM week_entries
    WHERE done = false
      AND rec_key IS NOT NULL
      AND rec_key != ''
    ORDER BY rec_key, week_id DESC
  `);

  const groups = {};
  r.rows.forEach(function (row) {
    if (!groups[row.rec_key]) groups[row.rec_key] = [];
    groups[row.rec_key].push(row);
  });

  let deleted = 0;
  const keys = Object.keys(groups);
  for (let i = 0; i < keys.length; i++) {
    const rows = groups[keys[i]];
    if (rows.length <= 1) continue;
    rows.sort(function (a, b) {
      return (b.week_id || '').localeCompare(a.week_id || '');
    });
    const keep = rows[0];
    for (let j = 1; j < rows.length; j++) {
      await query('DELETE FROM week_entries WHERE id = $1', [rows[j].id]);
      deleted++;
      console.log('[dedup] removed', rows[j].key, '→ kept', keep.key);
    }
  }

  console.log('[dedup] done — deleted', deleted, 'duplicate row(s) across', keys.length, 'centers');
  await pool.end();
}

main().catch(function (e) {
  console.error('[dedup] failed:', e.message);
  process.exit(1);
});

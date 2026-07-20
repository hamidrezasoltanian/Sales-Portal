#!/usr/bin/env node
'use strict';
/**
 * Build center merge suggestions (orphan edits → similar master centers).
 * Usage:
 *   node scripts/build-merge-suggestions.js           # write to DB
 *   node scripts/build-merge-suggestions.js --dry-run   # report only
 *   node scripts/build-merge-suggestions.js --min-score 80
 */
const { pool } = require('../server/db');
const { buildMergeSuggestions } = require('../server/lib/center-merge-suggestions');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const minArg = process.argv.find(function (a) { return a.startsWith('--min-score='); });
  const minScore = minArg ? parseInt(minArg.split('=')[1], 10) : 70;

  console.log('══════════════════════════════════════════════════');
  console.log('  Center merge suggestions', dryRun ? '(DRY RUN)' : '');
  console.log('══════════════════════════════════════════════════');
  console.log('Min score:', minScore);

  const result = await buildMergeSuggestions({ dryRun, minScore });

  console.log('\nOrphan edits scanned:', result.orphanCount);
  console.log('Suggestions found:', result.suggestionCount);
  if (!dryRun) {
    console.log('Inserted:', result.inserted, '| Updated:', result.updated, '| Skipped:', result.skipped);
  } else if (result.suggestions && result.suggestions.length) {
    console.log('\nSample (first 15):');
    result.suggestions.slice(0, 15).forEach(function (s) {
      console.log(' ', s.match_score + '%', s.source_key, '→', s.target_key);
      console.log('    ', (s.source_display_name || '').slice(0, 40), '↔', (s.target_display_name || '').slice(0, 40));
    });
  }

  await pool.end();
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});

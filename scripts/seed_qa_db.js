#!/usr/bin/env node
'use strict';

/**
 * Seed minimal QA data for persistence/UI tests (not for production).
 *
 * Usage:
 *   PG_DATABASE=atena_crm_test node scripts/seed_qa_db.js
 *   npm run seed:qa
 */

const { query, pool, initSchema } = require('../server/db');

const QA_CENTER_ID = 'qa_seed_1';
const QA_CENTER_KEY = 'center_' + QA_CENTER_ID;
const QA_CENTER = {
  status: 'فعال',
  owner: 'Sarah.hosseini',
  potential: 2,
  lead: 'سرنخ',
  followupDate: '1404/02/15',
  nameOverride: 'مرکز تست QA',
};

async function main() {
  console.log('[seed:qa] Initializing schema...');
  await initSchema();

  console.log('[seed:qa] Seeding center_edits...');
  await query(
    `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), 'seed_qa')
     ON CONFLICT (center_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), updated_by = 'seed_qa'`,
    [QA_CENTER_KEY, JSON.stringify(QA_CENTER)]
  );

  console.log('[seed:qa] Seeding sample note...');
  await query(
    `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), 'seed_qa')
     ON CONFLICT (center_key) DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = 'seed_qa'`,
    [QA_CENTER_KEY, JSON.stringify([{ text: 'یادداشت seed QA', date: '1404/01/01', user: 'seed', ts: new Date().toISOString() }])]
  );

  console.log('[seed:qa] Seeding tag definitions...');
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ('tagDefinitions', $1, NOW(), 'seed_qa')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'seed_qa'`,
    [JSON.stringify([{ id: 1, name: 'VIP', color: '#dc2626' }, { id: 2, name: 'QA-Tag', color: '#6366f1' }])]
  );

  console.log('[seed:qa] Seeding center_extras (visible in provinces UI)...');
  await query(
    `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
     VALUES ($1, 0, $2, 2, 'خصوصی', 'سرنخ', 'tehran', 'Sarah.hosseini', NOW(), 'seed_qa')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(), updated_by = 'seed_qa'`,
    [QA_CENTER_ID, 'مرکز تست QA']
  );

  console.log('[seed:qa] Done. Center key:', QA_CENTER_KEY, '| extra id:', QA_CENTER_ID);
  await pool.end();
}

main().catch(function (e) {
  console.error('[seed:qa] FAILED:', e.message);
  process.exit(1);
});

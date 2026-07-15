#!/usr/bin/env node
'use strict';
/**
 * Inventory EZ Dashboard data sources (PostgreSQL or SQLite).
 * Usage:
 *   node scripts/inventory-ez-db.js
 *   EZ_DATABASE_URL=postgresql://... node scripts/inventory-ez-db.js
 *   EZ_SQLITE_PATH=/path/to/ez_dashboard.db node scripts/inventory-ez-db.js
 */

const path = require('path');
const fs = require('fs');

const DEFAULT_SQLITE = path.join(
  process.env.HOME || '',
  'App', 'frontend-ez-dashboard', 'database', 'ez_dashboard.db'
);

const TABLES_PG = [
  'workflows', 'workflow_steps', 'workflow_fields',
  'orders', 'order_items', 'products', 'proformas', 'proforma_items', 'activities', 'users',
];

const TABLES_SQLITE = [
  'workflows', 'workflow_steps', 'workflow_fields',
  'orders', 'products', 'proformas', 'activities', 'users',
];

async function inventoryPostgres(url) {
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  const out = { source: 'postgresql', url: url.replace(/:[^:@]+@/, ':***@'), tables: {} };
  for (const t of TABLES_PG) {
    try {
      const r = await client.query('SELECT COUNT(*)::int AS n FROM ' + t);
      out.tables[t] = r.rows[0].n;
    } catch (e) {
      out.tables[t] = { error: e.message };
    }
  }
  await client.end();
  return out;
}

async function inventorySqlite(dbPath) {
  let sqlite3;
  try { sqlite3 = require('sqlite3'); } catch (e) {
    return { source: 'sqlite', path: dbPath, error: 'sqlite3 not installed — run npm install sqlite3' };
  }
  if (!fs.existsSync(dbPath)) {
    return { source: 'sqlite', path: dbPath, error: 'file not found' };
  }
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  const get = (sql) => new Promise((resolve, reject) => {
    db.get(sql, (err, row) => (err ? reject(err) : resolve(row)));
  });
  const out = { source: 'sqlite', path: dbPath, tables: {} };
  for (const t of TABLES_SQLITE) {
    try {
      const row = await get('SELECT COUNT(*) AS n FROM ' + t);
      out.tables[t] = row.n;
    } catch (e) {
      out.tables[t] = { error: e.message };
    }
  }
  db.close();
  return out;
}

async function main() {
  const pgUrl = process.env.EZ_DATABASE_URL || process.env.DATABASE_URL_EZ;
  const sqlitePath = process.env.EZ_SQLITE_PATH || DEFAULT_SQLITE;

  let report;
  if (pgUrl && pgUrl.includes('postgres')) {
    report = await inventoryPostgres(pgUrl);
  } else {
    report = await inventorySqlite(sqlitePath);
    if (report.error && pgUrl) {
      console.warn('PostgreSQL failed, trying sqlite...');
      report = await inventorySqlite(sqlitePath);
    }
  }

  console.log(JSON.stringify(report, null, 2));

  const orders = report.tables && report.tables.orders;
  const workflows = report.tables && report.tables.workflows;
  console.log('\n--- Summary ---');
  console.log('Workflows:', typeof workflows === 'number' ? workflows : workflows);
  console.log('Orders (cases):', typeof orders === 'number' ? orders : orders);
  if (report.error) process.exit(1);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});

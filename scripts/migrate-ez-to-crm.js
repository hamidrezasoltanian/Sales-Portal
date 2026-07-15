#!/usr/bin/env node
'use strict';
/**
 * Migrate EZ Dashboard workflows + orders → Click CRM trade_process_templates + trade_cases.
 *
 * Usage:
 *   node scripts/migrate-ez-to-crm.js --dry-run
 *   node scripts/migrate-ez-to-crm.js --apply
 *
 * Env:
 *   EZ_SQLITE_PATH — default ~/App/frontend-ez-dashboard/database/ez_dashboard.db
 *   EZ_DATABASE_URL — PostgreSQL ez_dashboard (optional)
 *   PG_DATABASE — target CRM DB (default from .env / atena_crm)
 *   npm install sqlite3 sqlite  — only if sqlite3 CLI is not on PATH
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Load .env manually (no dotenv dependency)
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
} catch (e) { /* ignore */ }

const { Pool } = require('pg');

const DRY = !process.argv.includes('--apply');
const DEFAULT_SQLITE = path.join(
  process.env.HOME || '',
  'App', 'frontend-ez-dashboard', 'database', 'ez_dashboard.db'
);

function uid(prefix) {
  return 'mig_' + (prefix || 'x') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function normalizeField(f) {
  return {
    id: f.id,
    name: f.name || f.field_name || ('field_' + f.id),
    label: f.label || f.field_label || f.name || 'فیلد',
    type: f.type || f.field_type || 'text',
    required: !!(f.required || f.is_required),
    width: f.width === 'full' ? 'full' : 'half',
    options: [],
  };
}

async function loadFromSqlite(dbPath) {
  if (!fs.existsSync(dbPath)) throw new Error('SQLite not found: ' + dbPath);

  function cliQuery(sql) {
    const safe = sql.replace(/"/g, '""');
    try {
      const out = execSync('sqlite3 -json "' + dbPath.replace(/"/g, '""') + '" "' + safe + '"', {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      const t = (out || '').trim();
      return t ? JSON.parse(t) : [];
    } catch (e) {
      if (String(e.message || '').includes('sqlite3')) {
        throw new Error('sqlite3 CLI not found. Install: sudo apt install sqlite3 — or npm install sqlite3 sqlite');
      }
      throw e;
    }
  }

  let workflows;
  try {
    workflows = cliQuery('SELECT * FROM workflows WHERE is_active IS NULL OR is_active = 1');
  } catch (cliErr) {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    workflows = await db.all('SELECT * FROM workflows WHERE is_active IS NULL OR is_active = 1');
    const templates = [];
    for (const w of workflows) {
      const steps = await db.all(
        'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC',
        [w.id]
      );
      const normSteps = [];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const fields = await db.all(
          'SELECT * FROM workflow_fields WHERE step_id = ? ORDER BY field_order ASC',
          [s.id]
        );
        normSteps.push({
          id: s.id,
          title: s.title || s.name || ('مرحله ' + (i + 1)),
          order: s.step_order != null ? s.step_order : i,
          fields: fields.map(normalizeField),
        });
      }
      templates.push({
        id: w.id,
        name: w.name,
        description: w.description || '',
        category: w.category || '',
        steps: normSteps,
        version: w.version || 1,
        created_by: w.created_by || 'migration',
      });
    }
    const orders = await db.all('SELECT * FROM orders ORDER BY created_at ASC');
    await db.close();
    return { templates, orders };
  }

  const templates = [];
  for (const w of workflows) {
    const steps = cliQuery('SELECT * FROM workflow_steps WHERE workflow_id = \'' + String(w.id).replace(/'/g, "''") + '\' ORDER BY step_order ASC');
    const normSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const fields = cliQuery('SELECT * FROM workflow_fields WHERE step_id = \'' + String(s.id).replace(/'/g, "''") + '\' ORDER BY field_order ASC');
      normSteps.push({
        id: s.id,
        title: s.title || s.name || ('مرحله ' + (i + 1)),
        order: s.step_order != null ? s.step_order : i,
        fields: fields.map(normalizeField),
      });
    }
    templates.push({
      id: w.id,
      name: w.name,
      description: w.description || '',
      category: w.category || '',
      steps: normSteps,
      version: w.version || 1,
      created_by: w.created_by || 'migration',
    });
  }

  const orders = cliQuery('SELECT * FROM orders ORDER BY created_at ASC');
  return { templates, orders };
}

async function loadFromPostgres(url) {
  const client = new (require('pg').Client)({ connectionString: url });
  await client.connect();
  const wRes = await client.query('SELECT * FROM workflows WHERE is_active IS NOT FALSE');
  const templates = [];
  for (const w of wRes.rows) {
    const sRes = await client.query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC',
      [w.id]
    );
    const normSteps = [];
    for (let i = 0; i < sRes.rows.length; i++) {
      const s = sRes.rows[i];
      const fRes = await client.query(
        'SELECT * FROM workflow_fields WHERE step_id = $1 ORDER BY field_order ASC',
        [s.id]
      );
      normSteps.push({
        id: s.id,
        title: s.title || s.name || ('مرحله ' + (i + 1)),
        order: s.step_order != null ? s.step_order : i,
        fields: fRes.rows.map(normalizeField),
      });
    }
    templates.push({
      id: w.id,
      name: w.name,
      description: w.description || '',
      category: w.category || '',
      steps: normSteps,
      version: w.version || 1,
      created_by: w.created_by || 'migration',
    });
  }
  const oRes = await client.query('SELECT * FROM orders ORDER BY created_at ASC');
  await client.end();
  return { templates, orders: oRes.rows };
}

function parseStepsData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

async function applyMigration(pool, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let tplCount = 0;
    let caseCount = 0;

    for (const t of data.templates) {
      const exists = await client.query('SELECT 1 FROM trade_process_templates WHERE id=$1', [t.id]);
      if (exists.rows.length) continue;
      await client.query(
        `INSERT INTO trade_process_templates (id, name, description, category, steps, version, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [t.id, t.name, t.description, t.category, JSON.stringify(t.steps), t.version, t.created_by]
      );
      tplCount++;
    }

    for (const o of data.orders) {
      const caseId = o.id;
      const exists = await client.query('SELECT 1 FROM trade_cases WHERE id=$1', [caseId]);
      if (exists.rows.length) continue;
      const caseNumber = o.order_number || ('ORD-MIG-' + caseId.slice(0, 8));
      const title = o.title || o.customer_name || caseNumber;
      await client.query(
        `INSERT INTO trade_cases (
           id, case_number, title, template_id, template_version, assigned_to,
           steps_data, is_finalized, finalized_at, jalali_month, priority, notes, status, created_by, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING`,
        [
          caseId,
          caseNumber,
          title,
          o.workflow_id || null,
          1,
          o.assigned_to || o.created_by || 'migration',
          JSON.stringify(parseStepsData(o.steps_data)),
          !!o.is_finalized,
          o.is_finalized ? (o.updated_at || new Date()) : null,
          null,
          (o.priority || 'normal').toLowerCase(),
          o.notes || '',
          o.is_finalized ? 'finalized' : 'active',
          o.created_by || 'migration',
          o.created_at || new Date(),
        ]
      );
      caseCount++;
    }

    if (DRY) {
      await client.query('ROLLBACK');
      return { tplCount, caseCount, dryRun: true };
    }
    await client.query('COMMIT');
    return { tplCount, caseCount, dryRun: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const pgUrl = process.env.EZ_DATABASE_URL;
  const sqlitePath = process.env.EZ_SQLITE_PATH || DEFAULT_SQLITE;

  console.log(DRY ? '🔍 DRY RUN (use --apply to write)' : '⚠️  APPLYING migration');

  let data;
  if (pgUrl && pgUrl.includes('postgres')) {
    console.log('Source: PostgreSQL EZ');
    data = await loadFromPostgres(pgUrl);
  } else {
    console.log('Source: SQLite', sqlitePath);
    data = await loadFromSqlite(sqlitePath);
  }

  console.log('Templates:', data.templates.length, '| Orders:', data.orders.length);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    database: process.env.PG_DATABASE || 'atena_crm',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
  });

  const result = await applyMigration(pool, data);
  console.log('Result:', result);
  await pool.end();
}

main().catch(function (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
});

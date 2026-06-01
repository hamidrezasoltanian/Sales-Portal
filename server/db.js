'use strict';

// Load .env manually (no dotenv dependency needed)
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(function(line) {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
} catch (e) {}

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'atena_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      username VARCHAR(100) PRIMARY KEY,
      display_name VARCHAR(200) NOT NULL,
      role VARCHAR(50) DEFAULT 'کارشناس فروش',
      color VARCHAR(20) DEFAULT '#0ea5e9',
      phone VARCHAR(20) DEFAULT '',
      active BOOLEAN DEFAULT true,
      password_hash VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_data (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by VARCHAR(100)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS centers_master (
      key VARCHAR(50) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS distribution_proposals (
      id SERIAL PRIMARY KEY,
      created_by VARCHAR(100),
      status VARCHAR(20) DEFAULT 'draft',
      rules JSONB,
      assignments JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS center_audit (
      id SERIAL PRIMARY KEY,
      center_key VARCHAR(200) NOT NULL,
      center_name VARCHAR(300),
      field VARCHAR(100),
      old_value TEXT,
      new_value TEXT,
      changed_by VARCHAR(100),
      changed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_center_audit_key ON center_audit(center_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_center_audit_at ON center_audit(changed_at DESC)`);

  // Seed default users if not exist
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'Atena@1234';

  const defaultUsers = [
    { username: 'Sarah.hosseini',        name: 'سارا حسینی',         role: 'مدیر',           color: '#8b5cf6', pwd: adminPassword },
    { username: 'Reyhane.kashisaz',      name: 'ریحانه کاشی‌ساز',   role: 'کارشناس فروش',  color: '#0ea5e9', pwd: defaultPassword },
    { username: 'Hamidreza.soltanian',   name: 'حمیدرضا سلطانیان', role: 'سوپر ادمین',     color: '#dc2626', pwd: adminPassword },
    { username: 'Rambod.ghasemi',        name: 'رامبد قاسمی',        role: 'کارشناس فروش',  color: '#f59e0b', pwd: defaultPassword },
    { username: 'guest',                 name: 'مهمان',               role: 'مهمان',          color: '#64748b', pwd: 'guest' },
  ];

  for (const u of defaultUsers) {
    const exists = await query('SELECT username FROM app_users WHERE username = $1', [u.username]);
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash(u.pwd, 10);
      await query(
        `INSERT INTO app_users (username, display_name, role, color, active, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [u.username, u.name, u.role, u.color, true, hash]
      );
      console.log('[DB] User seeded:', u.username);
    }
  }

  console.log('[DB] Schema initialized');
}

module.exports = { pool, query, initSchema };

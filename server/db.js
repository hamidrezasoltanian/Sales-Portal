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

  await query(`
    CREATE TABLE IF NOT EXISTS center_contacts (
      id SERIAL PRIMARY KEY,
      center_key VARCHAR(200) NOT NULL,
      center_name VARCHAR(300),
      contact_name VARCHAR(200),
      contact_title VARCHAR(200),
      phones TEXT[],
      address TEXT,
      updated_by VARCHAR(100),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_center_contacts_key ON center_contacts(center_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_center_contacts_name ON center_contacts(contact_name)`);

  // Products catalog
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      code VARCHAR(50),
      unit VARCHAR(50) DEFAULT 'عدد',
      active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Versioned price lists (header)
  await query(`
    CREATE TABLE IF NOT EXISTS price_lists (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL,
      name VARCHAR(200),
      buyer_type VARCHAR(30) NOT NULL,
      effective_from DATE,
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      active BOOLEAN DEFAULT true
    )
  `);

  // Price matrix per product x buyer_type x qty_tier x pay_type
  await query(`
    CREATE TABLE IF NOT EXISTS price_list_items (
      id SERIAL PRIMARY KEY,
      price_list_id INTEGER REFERENCES price_lists(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      qty_tier INTEGER NOT NULL CHECK(qty_tier BETWEEN 0 AND 3),
      pay_type VARCHAR(10) NOT NULL CHECK(pay_type IN ('d30','d60','cash')),
      price BIGINT NOT NULL,
      base_price BIGINT,
      UNIQUE(price_list_id, product_id, qty_tier, pay_type)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_pli_list ON price_list_items(price_list_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pli_product ON price_list_items(product_id)`);

  // Commission rules: 3 fixed-amount levels per product per price list version
  await query(`
    CREATE TABLE IF NOT EXISTS commission_rules (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      price_list_id INTEGER REFERENCES price_lists(id) ON DELETE CASCADE,
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),
      amount BIGINT NOT NULL DEFAULT 0,
      label VARCHAR(100),
      UNIQUE(price_list_id, product_id, level)
    )
  `);

  // Per-center pricing configuration
  await query(`
    CREATE TABLE IF NOT EXISTS center_pricing_config (
      id SERIAL PRIMARY KEY,
      center_key VARCHAR(200) NOT NULL UNIQUE,
      center_name VARCHAR(300),
      buyer_type VARCHAR(30) DEFAULT 'hospital',
      commission_level INTEGER CHECK(commission_level BETWEEN 1 AND 3),
      discount_pct DECIMAL(5,2) DEFAULT 0,
      discount_ceiling_pct DECIMAL(5,2) DEFAULT 5,
      notes TEXT,
      updated_by VARCHAR(100),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Price quotes (header)
  await query(`
    CREATE TABLE IF NOT EXISTS price_quotes (
      id SERIAL PRIMARY KEY,
      quote_number VARCHAR(50) UNIQUE,
      center_key VARCHAR(200),
      center_name VARCHAR(300),
      buyer_type VARCHAR(30),
      pay_type VARCHAR(10) DEFAULT 'd30',
      price_list_id INTEGER REFERENCES price_lists(id),
      created_by VARCHAR(100),
      status VARCHAR(20) DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected','sent')),
      manager_notes TEXT,
      approved_by VARCHAR(100),
      approved_at TIMESTAMPTZ,
      total_base BIGINT DEFAULT 0,
      total_final BIGINT DEFAULT 0,
      total_commission BIGINT DEFAULT 0,
      total_discount BIGINT DEFAULT 0,
      jalali_date VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_pq_center ON price_quotes(center_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pq_status ON price_quotes(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pq_created ON price_quotes(created_at DESC)`);

  // Quote line items
  await query(`
    CREATE TABLE IF NOT EXISTS price_quote_items (
      id SERIAL PRIMARY KEY,
      quote_id INTEGER REFERENCES price_quotes(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name VARCHAR(300),
      qty INTEGER NOT NULL DEFAULT 1,
      qty_tier INTEGER DEFAULT 0,
      unit_base_price BIGINT DEFAULT 0,
      unit_suggested_price BIGINT DEFAULT 0,
      unit_final_price BIGINT DEFAULT 0,
      unit_commission BIGINT DEFAULT 0,
      unit_discount BIGINT DEFAULT 0,
      line_total BIGINT DEFAULT 0,
      notes TEXT
    )
  `);

  // Product file attachments
  await query(`
    CREATE TABLE IF NOT EXISTS product_files (
      id SERIAL PRIMARY KEY,
      prod_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER DEFAULT 0,
      data BYTEA NOT NULL,
      uploaded_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_product_files_prod ON product_files(prod_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS mission_files (
      id SERIAL PRIMARY KEY,
      mission_id TEXT NOT NULL,
      expense_id TEXT DEFAULT '',
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER DEFAULT 0,
      data BYTEA NOT NULL,
      uploaded_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_mission_files_mid ON mission_files(mission_id)`);

  // Auto-save history for app_data (keeps last 30 versions per key)
  await query(`
    CREATE TABLE IF NOT EXISTS app_data_history (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) NOT NULL,
      value JSONB NOT NULL,
      saved_at TIMESTAMPTZ DEFAULT NOW(),
      saved_by VARCHAR(100)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_adh_key_at ON app_data_history(key, saved_at DESC)`);

  // week_entries: individual rows per week-plan entry (permanent fix for concurrency)
  await query(`
    CREATE TABLE IF NOT EXISTS week_entries (
      key VARCHAR(600) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by VARCHAR(100)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_we_updated ON week_entries(updated_at DESC)`);

  // One-time migration: move existing weekEntries from main blob to dedicated table
  // Uses a transaction so a mid-migration crash doesn't leave partial state
  try {
    const tableCount = await query('SELECT 1 FROM week_entries LIMIT 1');
    if (tableCount.rows.length === 0) {
      const mainRow = await query("SELECT value FROM app_data WHERE key = 'main'");
      if (mainRow.rows.length > 0) {
        const mainVal = mainRow.rows[0].value;
        const we = (mainVal && mainVal.weekEntries) ? mainVal.weekEntries : {};
        const keys = Object.keys(we);
        if (keys.length > 0) {
          console.log(`[DB] Migrating ${keys.length} weekEntries to week_entries table...`);
          const migClient = await pool.connect();
          try {
            await migClient.query('BEGIN');
            for (const k of keys) {
              await migClient.query(
                `INSERT INTO week_entries (key, value, updated_by) VALUES ($1, $2, 'migration') ON CONFLICT (key) DO NOTHING`,
                [k, JSON.stringify(we[k])]
              );
            }
            const newVal = Object.assign({}, mainVal);
            delete newVal.weekEntries;
            await migClient.query(`UPDATE app_data SET value = $1 WHERE key = 'main'`, [JSON.stringify(newVal)]);
            await migClient.query('COMMIT');
            console.log(`[DB] weekEntries migration complete: ${keys.length} entries moved`);
          } catch (txErr) {
            await migClient.query('ROLLBACK').catch(() => {});
            throw txErr;
          } finally {
            migClient.release();
          }
        }
      }
    }
  } catch (migErr) {
    console.warn('[DB] weekEntries migration warning:', migErr.message);
  }

  // Seed products and initial price list if products table is empty
  const prodCount = await query('SELECT COUNT(*) FROM products');
  if (parseInt(prodCount.rows[0].count) === 0) {
    const seedProducts = [
      { name: 'سوزن تمام اتوماتیک برند Geotek',                                   sort_order: 1 },
      { name: 'سوزن نیمه اتوماتیک برند Geotek به همراه کواکسیال',               sort_order: 2 },
      { name: 'سوزن گان برند Geotek',                                              sort_order: 3 },
      { name: 'سوزن شیبا برند Geotek',                                             sort_order: 4 },
      { name: 'سوزن مغز استخوان برند Geotek',                                     sort_order: 5 },
      { name: 'سوزن تمام اتوماتیک برند Geotek مدل Pro',                          sort_order: 6 },
      { name: 'سوزن تمام اتوماتیک برند Curaway',                                  sort_order: 7 },
      { name: 'سوزن نیمه اتوماتیک برند Curaway',                                  sort_order: 8 },
      { name: 'سوزن کواکسیال برند Curaway',                                       sort_order: 9 },
      { name: 'کاتتر شریانی آرتر لاین Intra سایز 4fr×18g×11cm',               sort_order: 10 },
      { name: 'کاتتر شریانی آرتر لاین Intra سایز 3fr×20g×8cm',                sort_order: 11 },
      { name: 'کاتتر شریانی آرتر لاین Intra سایز 2fr×22g×6cm',                sort_order: 12 },
      { name: 'رابط یورین بگ آتنا',                                               sort_order: 13 },
    ];

    // p[tierIdx][payIdx] — tier: 0=≤20,1=21-50,2=51-100,3=>100 — pay: 0=d30,1=d60,2=cash
    const seedPrices = [
      { base: 56900000, p:[[55200000,56900000,53500000],[53500000,56900000,51800000],[51800000,53500000,50100000],[50100000,51800000,48400000]] },
      { base: 38300000, p:[[37200000,38300000,36100000],[36100000,38300000,34900000],[34900000,36100000,33800000],[33800000,34900000,32600000]] },
      { base: 23600000, p:[[22900000,23600000,22200000],[22200000,23600000,21500000],[21500000,22200000,20800000],[20800000,21500000,20100000]] },
      { base: 17800000, p:[[17300000,17800000,16800000],[16800000,17800000,16200000],[16200000,16800000,15700000],[15700000,16200000,15200000]] },
      { base: 35100000, p:[[34100000,35100000,33000000],[33000000,35100000,32000000],[32000000,33000000,30900000],[30900000,32000000,29900000]] },
      { base: 78000000, p:[[75700000,78000000,73400000],[73400000,78000000,71000000],[71000000,73400000,68700000],[68700000,71000000,66300000]] },
      { base: 51000000, p:[[49500000,51000000,48000000],[48000000,51000000,46500000],[46500000,48000000,44900000],[44900000,46500000,43400000]] },
      { base: 31100000, p:[[30200000,31100000,29300000],[29300000,31100000,28400000],[28400000,29300000,27400000],[27400000,28400000,26500000]] },
      { base:  8510000, p:[[ 8300000, 8510000, 8000000],[ 8000000, 8510000, 7800000],[ 7800000, 8000000, 7500000],[ 7500000, 7800000, 7300000]] },
      { base: 50500000, p:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]] },
      { base: 50500000, p:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]] },
      { base: 56400000, p:[[54800000,56400000,53100000],[53100000,56400000,51400000],[51400000,53100000,49700000],[49700000,51400000,48000000]] },
      { base:  4450000, p:[[ 4400000, 4450000, 4200000],[ 4200000, 4450000, 4100000],[ 4100000, 4200000, 4000000],[ 4000000, 4100000, 3800000]] },
    ];

    const productIds = [];
    for (let i = 0; i < seedProducts.length; i++) {
      const p = seedProducts[i];
      const r = await query(
        `INSERT INTO products (name, unit, active, sort_order) VALUES ($1, 'عدد', true, $2) RETURNING id`,
        [p.name, p.sort_order]
      );
      productIds.push(r.rows[0].id);
    }
    console.log('[DB] Products seeded:', productIds.length);

    // Create initial price list for colleague buyer_type
    const plRes = await query(
      `INSERT INTO price_lists (version, name, buyer_type, effective_from, created_by, active)
       VALUES (1, 'لیست قیمت اولیه همکاران', 'colleague', NOW()::DATE, 'system', true)
       RETURNING id`
    );
    const priceListId = plRes.rows[0].id;

    const payTypes = ['d30', 'd60', 'cash'];
    for (let i = 0; i < seedPrices.length; i++) {
      const sp = seedPrices[i];
      const productId = productIds[i];
      for (let tier = 0; tier < 4; tier++) {
        for (let payIdx = 0; payIdx < 3; payIdx++) {
          await query(
            `INSERT INTO price_list_items (price_list_id, product_id, qty_tier, pay_type, price, base_price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [priceListId, productId, tier, payTypes[payIdx], sp.p[tier][payIdx], sp.base]
          );
        }
      }
    }
    console.log('[DB] Price list seeded for colleague buyer_type');
  }

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

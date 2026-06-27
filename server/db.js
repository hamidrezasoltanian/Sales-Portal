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

  // ════════════════════════════════════════
  // WMS — proper normalized tables
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS wms_products (
      id          VARCHAR(50) PRIMARY KEY,
      name        VARCHAR(300) NOT NULL,
      full_name   VARCHAR(500),
      brand       VARCHAR(200),
      size        VARCHAR(100),
      catalog_code VARCHAR(100),
      irc_code    VARCHAR(100),
      unit        VARCHAR(50) DEFAULT 'عدد',
      category    VARCHAR(100),
      reorder_point INTEGER DEFAULT 10,
      note        TEXT DEFAULT '',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_prod_active ON wms_products(active)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_prod_code ON wms_products(catalog_code)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_warehouses (
      id          VARCHAR(50) PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      location    TEXT,
      manager_id  VARCHAR(100),
      note        TEXT DEFAULT '',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_counterparties (
      id          VARCHAR(50) PRIMARY KEY,
      name        VARCHAR(300) NOT NULL,
      type        VARCHAR(20) CHECK(type IN ('supplier','customer','both')),
      phone       VARCHAR(50),
      address     TEXT,
      tax_code    VARCHAR(50),
      email       VARCHAR(200),
      note        TEXT DEFAULT '',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_cp_type ON wms_counterparties(type)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_lots (
      id              VARCHAR(50) PRIMARY KEY,
      product_id      VARCHAR(50) REFERENCES wms_products(id) ON DELETE RESTRICT,
      warehouse_id    VARCHAR(50) REFERENCES wms_warehouses(id) ON DELETE RESTRICT,
      lot_no          VARCHAR(200) NOT NULL,
      qty             INTEGER NOT NULL DEFAULT 0,
      expiry          DATE,
      purchase_price  BIGINT DEFAULT 0,
      counterparty_id VARCHAR(50),
      txn_id          VARCHAR(50),
      lot_date        TIMESTAMPTZ,
      entered_by      VARCHAR(100),
      approved_by     VARCHAR(100),
      ttac_no         VARCHAR(100) DEFAULT '',
      imed_status     VARCHAR(50) DEFAULT 'not_registered',
      imed_ref_no     VARCHAR(100) DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_lots_product ON wms_lots(product_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_lots_warehouse ON wms_lots(warehouse_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_lots_expiry ON wms_lots(expiry)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_lots_lotno ON wms_lots(lot_no)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_transactions (
      id                 VARCHAR(50) PRIMARY KEY,
      txn_no             VARCHAR(50) UNIQUE,
      type               VARCHAR(20) CHECK(type IN ('entry','exit')),
      txn_type           VARCHAR(50),
      product_id         VARCHAR(50) REFERENCES wms_products(id),
      lot_id             VARCHAR(50) REFERENCES wms_lots(id),
      warehouse_id       VARCHAR(50) REFERENCES wms_warehouses(id),
      qty                INTEGER NOT NULL DEFAULT 0,
      unit_price         BIGINT DEFAULT 0,
      sale_price         BIGINT DEFAULT 0,
      counterparty_id    VARCHAR(50),
      from_warehouse_id  VARCHAR(50),
      to_warehouse_id    VARCHAR(50),
      by_user            VARCHAR(100),
      txn_date           TIMESTAMPTZ DEFAULT NOW(),
      status             VARCHAR(20) DEFAULT 'pending',
      note               TEXT DEFAULT '',
      ref_no             VARCHAR(100),
      imed_status        VARCHAR(50) DEFAULT 'not_registered',
      imed_ref_no        VARCHAR(100) DEFAULT '',
      imed_date          VARCHAR(50) DEFAULT '',
      ttac_no            VARCHAR(100) DEFAULT '',
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_type ON wms_transactions(type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_product ON wms_transactions(product_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_date ON wms_transactions(txn_date DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_status ON wms_transactions(status)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_purchase_orders (
      id                VARCHAR(50) PRIMARY KEY,
      po_no             VARCHAR(50) UNIQUE,
      supplier_id       VARCHAR(50),
      warehouse_id      VARCHAR(50),
      requested_by      VARCHAR(100),
      approved_by       VARCHAR(100),
      approved_at       TIMESTAMPTZ,
      status            VARCHAR(20) DEFAULT 'draft',
      items             JSONB DEFAULT '[]',
      po_date           DATE,
      expected_delivery DATE,
      note              TEXT DEFAULT '',
      imed_status       VARCHAR(50) DEFAULT 'not_registered',
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_po_status ON wms_purchase_orders(status)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_recalls (
      id           VARCHAR(50) PRIMARY KEY,
      lot_id       VARCHAR(50),
      product_id   VARCHAR(50),
      severity     VARCHAR(20),
      status       VARCHAR(20) DEFAULT 'open',
      description  TEXT,
      affected_qty INTEGER,
      action       TEXT,
      resolved_at  TIMESTAMPTZ,
      created_by   VARCHAR(100),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_audit_log (
      id          BIGSERIAL PRIMARY KEY,
      user_id     VARCHAR(100),
      user_name   VARCHAR(200),
      action      VARCHAR(100),
      entity      VARCHAR(50),
      entity_id   VARCHAR(50),
      detail      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_audit_entity ON wms_audit_log(entity, entity_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wms_audit_at ON wms_audit_log(created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS wms_settings (
      key   VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ════════════════════════════════════════
  // PROFORMAS — proper normalized table
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS proformas (
      id             VARCHAR(50) PRIMARY KEY,
      no             VARCHAR(50) UNIQUE,
      jalali_date    VARCHAR(20),
      valid_days     INTEGER DEFAULT 30,
      center_key     VARCHAR(200),
      center_name    VARCHAR(300),
      items          JSONB DEFAULT '[]',
      subtotal       BIGINT DEFAULT 0,
      discount_pct   DECIMAL(5,2) DEFAULT 0,
      disc_amt       BIGINT DEFAULT 0,
      tax_pct        DECIMAL(5,2) DEFAULT 9,
      tax_amt        BIGINT DEFAULT 0,
      total          BIGINT DEFAULT 0,
      note           TEXT DEFAULT '',
      status         VARCHAR(20) DEFAULT 'draft'
                     CHECK(status IN ('draft','sent','approved','rejected','cancelled')),
      created_by     VARCHAR(100),
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      sent_at        TIMESTAMPTZ,
      responded_at   TIMESTAMPTZ,
      responded_by   VARCHAR(100),
      manager_note   TEXT DEFAULT ''
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_pf_status ON proformas(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pf_center ON proformas(center_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pf_created_by ON proformas(created_by)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pf_created_at ON proformas(created_at DESC)`);

  // Auto-migrate proformas from blob → table (run once)
  await _migrateProformasFromBlob();

  // Auto-migrate WMS from blob → tables (run once)
  await _migrateWMSFromBlob();

  // ════════════════════════════════════════
  // TASKS — extracted from DB.tasks blob
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner TEXT,
      due_date TEXT,
      priority INTEGER DEFAULT 2,
      status TEXT DEFAULT 'todo',
      center_key TEXT,
      note TEXT DEFAULT '',
      subtasks JSONB DEFAULT '[]',
      done BOOLEAN DEFAULT FALSE,
      done_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add missing columns to existing tasks tables (idempotent)
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner TEXT`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TEXT`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo'`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS center_key TEXT`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring TEXT DEFAULT 'none'`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS activity JSONB DEFAULT '[]'`);
  await query(`CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`).catch(()=>{});

  // ════════════════════════════════════════
  // WEEK ENTRIES — key/value store (key = "{weekId}:::{rtype}:::{rid}")
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS week_entries (
      key VARCHAR(600) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by VARCHAR(100)
    )
  `);
  // Ensure key column exists (handles old columnar schema on existing installs)
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS key VARCHAR(600)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS value JSONB`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_we_updated ON week_entries(updated_at DESC)`).catch(()=>{});
  // Proper column-based schema for week-entries route
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS id TEXT`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS week_id VARCHAR(20)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS rec_key VARCHAR(400)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS rtype VARCHAR(20)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS rid VARCHAR(300)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS scheduled_date VARCHAR(12)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS action_type VARCHAR(20) DEFAULT 'call'`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS added_by VARCHAR(100)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS center_name VARCHAR(300)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS week_tag_id VARCHAR(100)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS done_date VARCHAR(12)`).catch(()=>{});
  await query(`ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_we_id ON week_entries(id) WHERE id IS NOT NULL`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_we_week_id ON week_entries(week_id)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_we_added_by ON week_entries(added_by)`).catch(()=>{});

  // ════════════════════════════════════════
  // NOTIFICATIONS — extracted from DB.notifications blob
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      to_user TEXT NOT NULL,
      msg TEXT NOT NULL,
      center_key TEXT,
      at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT FALSE
    )
  `);
  // Add missing columns to existing notifications tables (idempotent)
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS to_user TEXT`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS msg TEXT`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS center_key TEXT`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS at TIMESTAMPTZ DEFAULT NOW()`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general'`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta JSONB`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS center_keys JSONB`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_to ON notifications(to_user)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_at ON notifications(at DESC)`).catch(()=>{});

  // ════════════════════════════════════════
  // CHANGE LOG — extracted from DB.changeLog blob
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS change_log (
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL,
      by TEXT NOT NULL,
      rkey TEXT NOT NULL,
      field TEXT NOT NULL,
      val JSONB
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_changelog_rkey ON change_log(rkey)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_changelog_at ON change_log(at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_changelog_by ON change_log(by)`);

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
    const exists = await query('SELECT username, password_hash FROM app_users WHERE username = $1', [u.username]);
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash(u.pwd, 10);
      await query(
        `INSERT INTO app_users (username, display_name, role, color, active, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [u.username, u.name, u.role, u.color, true, hash]
      );
      console.log('[DB] User seeded:', u.username);
    } else if (!exists.rows[0].password_hash) {
      // Backfill password for users created before password feature was added
      const hash = await bcrypt.hash(u.pwd, 10);
      await query('UPDATE app_users SET password_hash=$1 WHERE username=$2', [hash, u.username]);
      console.log('[DB] User password backfilled:', u.username);
    }
  }

  // ════════════════════════════════════════
  // SUPPORT TICKETS — پشتیبان فروش
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      center_key   TEXT,
      center_name  TEXT,
      reporter     TEXT,
      assigned_to  TEXT,
      category     TEXT DEFAULT 'other',
      priority     INT DEFAULT 2,
      status       TEXT DEFAULT 'open',
      sla_deadline TEXT,
      description  TEXT,
      resolution   TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      resolved_at  TIMESTAMPTZ,
      done         BOOLEAN DEFAULT false
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_tkt_status ON support_tickets(status)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkt_assigned ON support_tickets(assigned_to)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkt_reporter ON support_tickets(reporter)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkt_center ON support_tickets(center_key)`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id           TEXT PRIMARY KEY,
      ticket_id    TEXT REFERENCES support_tickets(id) ON DELETE CASCADE,
      author       TEXT,
      body         TEXT,
      at           TIMESTAMPTZ DEFAULT NOW(),
      is_internal  BOOLEAN DEFAULT false
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_cmt_ticket ON ticket_comments(ticket_id)`).catch(()=>{});

  // ════════════════════════════════════════
  // HR / EMPLOYEES — منابع انسانی
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id              TEXT PRIMARY KEY,
      username        TEXT,
      full_name       TEXT,
      national_id     TEXT,
      hire_date       TEXT,
      department      TEXT,
      position        TEXT,
      manager         TEXT,
      phone           TEXT,
      salary_level    INT DEFAULT 2,
      employment_type TEXT DEFAULT 'full_time',
      active          BOOLEAN DEFAULT true,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id           TEXT PRIMARY KEY,
      employee     TEXT,
      type         TEXT DEFAULT 'annual',
      from_date    TEXT,
      to_date      TEXT,
      days         DECIMAL(4,1),
      reason       TEXT,
      status       TEXT DEFAULT 'pending',
      approved_by  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests(employee)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status)`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS leave_balance (
      employee     TEXT PRIMARY KEY,
      annual_total DECIMAL(5,1) DEFAULT 30,
      annual_used  DECIMAL(5,1) DEFAULT 0,
      year         INT
    )
  `);

  // salary_amount column (super-admin only visibility)
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_amount DECIMAL(15,2)`).catch(()=>{});

  // ════════════════════════════════════════
  // TRADE KPI — بازرگانی
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS trade_tasks (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      category     TEXT DEFAULT 'other',
      assigned_to  TEXT,
      created_by   TEXT,
      deadline     TEXT,
      completed_at TEXT,
      status       TEXT DEFAULT 'open',
      priority     INT DEFAULT 2,
      center_key   TEXT,
      center_name  TEXT,
      milestone_id TEXT,
      stages       JSONB DEFAULT '[]',
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ttasks_assigned ON trade_tasks(assigned_to)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_ttasks_status ON trade_tasks(status)`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS trade_kpi_deductions (
      id            TEXT PRIMARY KEY,
      employee      TEXT NOT NULL,
      month         TEXT NOT NULL,
      indicator     TEXT NOT NULL,
      points        INT NOT NULL,
      reason        TEXT NOT NULL,
      ref_task_id   TEXT,
      registered_by TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_tded_emp_month ON trade_kpi_deductions(employee,month)`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS trade_kpi_monthly (
      id                 TEXT PRIMARY KEY,
      employee           TEXT NOT NULL,
      month              TEXT NOT NULL,
      score_customs      INT DEFAULT 100,
      score_sla          INT DEFAULT 100,
      score_traceability INT DEFAULT 100,
      score_reporting    INT DEFAULT 100,
      score_teamwork     INT DEFAULT 100,
      avg_score          DECIMAL(5,2),
      gate_passed        BOOLEAN,
      hygiene_bonus      DECIMAL(15,2) DEFAULT 0,
      finalized          BOOLEAN DEFAULT false,
      finalized_at       TIMESTAMPTZ,
      notes              TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, month)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_milestones (
      id           TEXT PRIMARY KEY,
      employee     TEXT NOT NULL,
      project_type TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      metric_value DECIMAL(15,2),
      metric_unit  TEXT,
      bonus_amount DECIMAL(15,2),
      status       TEXT DEFAULT 'pending',
      achieved_at  TEXT,
      approved_by  TEXT,
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_tms_emp ON trade_milestones(employee)`).catch(()=>{});

  // ── Phase A: Permission + Payroll columns ──────────────────────────────────
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS direct_manager VARCHAR(100) DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`).catch(()=>{});
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS commission_pct DECIMAL(5,2) DEFAULT 1.0`).catch(()=>{});
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS salary_amount DECIMAL(15,2) DEFAULT 0`).catch(()=>{});
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT ''`).catch(()=>{});

  // Faradis customers cache — add extended contact fields (safe migration)
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS person_name TEXT DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS phone2 TEXT DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS mobile2 TEXT DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS fax TEXT DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`).catch(()=>{});
  await query(`ALTER TABLE faradis_customers_cache ADD COLUMN IF NOT EXISTS national_code TEXT DEFAULT ''`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS commission_settings (
      id              TEXT PRIMARY KEY DEFAULT 'default',
      base_pct        DECIMAL(5,2) DEFAULT 1.0,
      tier_threshold  BIGINT DEFAULT 2000000000,
      tier_step_amount BIGINT DEFAULT 500000000,
      tier_step_pct   DECIMAL(5,2) DEFAULT 0.1,
      kpi_threshold   INT DEFAULT 80,
      kpi_multiplier  DECIMAL(4,2) DEFAULT 2.0,
      updated_by      TEXT,
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // seed default row
  await query(`INSERT INTO commission_settings (id) VALUES ('default') ON CONFLICT DO NOTHING`).catch(()=>{});

  await query(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id               TEXT PRIMARY KEY,
      employee         TEXT NOT NULL,
      month            TEXT NOT NULL,
      base_salary      DECIMAL(15,2) DEFAULT 0,
      kpi_bonus        DECIMAL(15,2) DEFAULT 0,
      sales_total      DECIMAL(15,2) DEFAULT 0,
      commission_pct   DECIMAL(5,2) DEFAULT 0,
      commission_amount DECIMAL(15,2) DEFAULT 0,
      total_pay        DECIMAL(15,2) DEFAULT 0,
      notes            TEXT,
      finalized        BOOLEAN DEFAULT false,
      created_by       TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, month)
    )
  `);


  // ════════════════════════════════════════
  // TRADE KPI — goal-based 7-dimension tables (new system)
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS trade_kpi_targets (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      month TEXT NOT NULL,
      customs_target INT DEFAULT 5,
      customs_days_target INT DEFAULT 10,
      customs_weight DECIMAL(5,2) DEFAULT 20,
      report_weight DECIMAL(5,2) DEFAULT 15,
      admin_target INT DEFAULT 10,
      admin_weight DECIMAL(5,2) DEFAULT 20,
      supplier_target INT DEFAULT 2,
      supplier_weight DECIMAL(5,2) DEFAULT 15,
      finance_target DECIMAL(15,2) DEFAULT 0,
      finance_weight DECIMAL(5,2) DEFAULT 15,
      team_weight DECIMAL(5,2) DEFAULT 10,
      warehouse_weight DECIMAL(5,2) DEFAULT 5,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, month)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_daily_reports (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      report_date TEXT NOT NULL,
      jalali_month TEXT NOT NULL,
      summary TEXT,
      activities TEXT,
      issues TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, report_date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_clearances (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      jalali_month TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      target_days INT DEFAULT 10,
      actual_days INT,
      status TEXT DEFAULT 'in_progress',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_suppliers_new (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      jalali_month TEXT NOT NULL,
      company_name TEXT NOT NULL,
      country TEXT DEFAULT '',
      product_category TEXT DEFAULT '',
      has_iran_rep BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'identified',
      notes TEXT,
      approved_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_finance_items (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      jalali_month TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'cost_reduction',
      amount DECIMAL(15,2) DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'proposed',
      verified_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trade_warehouse_rec (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      jalali_month TEXT NOT NULL,
      gov_count INT DEFAULT 0,
      real_count INT DEFAULT 0,
      software_count INT DEFAULT 0,
      discrepancies TEXT DEFAULT '',
      resolved BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, jalali_month)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_targets_emp_month ON trade_kpi_targets(employee,month)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_reports_emp_month ON trade_daily_reports(employee,jalali_month)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_clearances_emp_month ON trade_clearances(employee,jalali_month)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_suppliers_emp_month ON trade_suppliers_new(employee,jalali_month)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_finance_emp_month ON trade_finance_items(employee,jalali_month)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_tkpi_warehec_emp_month ON trade_warehouse_rec(employee,jalali_month)`).catch(()=>{});

  // ════════════════════════════════════════
  // INVOICES — from approved proformas
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id          TEXT PRIMARY KEY,
      invoice_no  TEXT UNIQUE,
      proforma_id TEXT,
      jalali_date TEXT NOT NULL,
      center_key  TEXT,
      center_name TEXT,
      items       JSONB DEFAULT '[]',
      subtotal    DECIMAL(15,2) DEFAULT 0,
      tax_pct     DECIMAL(5,2) DEFAULT 9,
      tax_amt     DECIMAL(15,2) DEFAULT 0,
      total       DECIMAL(15,2) DEFAULT 0,
      status      TEXT DEFAULT 'issued',
      created_by  TEXT,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id            TEXT PRIMARY KEY,
      invoice_id    TEXT REFERENCES invoices(id),
      amount        DECIMAL(15,2) NOT NULL,
      method        TEXT DEFAULT 'transfer',
      ref_no        TEXT,
      jalali_date   TEXT NOT NULL,
      registered_by TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_proforma ON invoices(proforma_id)`).catch(()=>{});
  await query(`CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv ON invoice_payments(invoice_id)`).catch(()=>{});

  // ════════════════════════════════════════
  // SALES TARGETS — monthly per employee
  // ════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS sales_targets (
      id            TEXT PRIMARY KEY,
      employee      TEXT NOT NULL,
      month         TEXT NOT NULL,
      target_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_by    TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee, month)
    )
  `);

  // Faradis accounting integration cache
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_sales_cache (
      id            BIGSERIAL PRIMARY KEY,
      factor_id     INT NOT NULL,
      factor_num    TEXT,
      factor_date   INT,              -- Jalali YYYYMMDD
      jalali_month  TEXT,             -- 'YYYY/MM'
      marketer_num  TEXT,
      visitor_num   TEXT,
      crm_username  TEXT,             -- mapped from marketer/visitor
      company_id    INT,
      company_name  TEXT,
      company_code  TEXT,
      total_amount  DECIMAL(15,2) DEFAULT 0,
      sub_total     DECIMAL(15,2) DEFAULT 0,
      discount      DECIMAL(15,2) DEFAULT 0,
      tax           DECIMAL(15,2) DEFAULT 0,
      synced_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(factor_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS faradis_marketer_map (
      id            SERIAL PRIMARY KEY,
      marketer_num  TEXT,
      visitor_num   TEXT,
      crm_username  TEXT NOT NULL,
      notes         TEXT,
      created_by    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(marketer_num, visitor_num)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS faradis_sync_log (
      id            SERIAL PRIMARY KEY,
      jalali_month  TEXT NOT NULL,
      rows_fetched  INT DEFAULT 0,
      rows_inserted INT DEFAULT 0,
      status        TEXT DEFAULT 'ok',   -- ok | error
      error_msg     TEXT,
      triggered_by  TEXT,
      synced_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_faradis_sales_month ON faradis_sales_cache(jalali_month)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_faradis_sales_username ON faradis_sales_cache(crm_username)`);

  await query(`
    CREATE TABLE IF NOT EXISTS faradis_customers_cache (
      company_num BIGINT PRIMARY KEY,
      company_name TEXT,
      company_code TEXT,
      person_name TEXT DEFAULT '',
      phone TEXT,
      phone2 TEXT DEFAULT '',
      mobile TEXT,
      mobile2 TEXT DEFAULT '',
      fax TEXT DEFAULT '',
      email TEXT DEFAULT '',
      national_code TEXT DEFAULT '',
      state_name TEXT,
      city_name TEXT,
      address TEXT,
      type_name TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS center_faradis_link (
      id SERIAL PRIMARY KEY,
      crm_center_key TEXT UNIQUE NOT NULL,
      crm_center_name TEXT,
      faradis_company_num BIGINT,
      faradis_company_name TEXT,
      matched_by TEXT DEFAULT 'manual',
      confidence INT DEFAULT 100,
      confirmed_by TEXT,
      confirmed_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS center_faradis_rejected (
      crm_center_key TEXT,
      faradis_company_num BIGINT,
      rejected_by TEXT,
      rejected_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (crm_center_key, faradis_company_num)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS faradis_factors_cache (
      factor_num BIGINT PRIMARY KEY,
      factor_code TEXT,
      factor_date TIMESTAMPTZ,
      jalali_date TEXT,
      jalali_month TEXT,
      factor_type INT DEFAULT 1,
      marketer_num TEXT,
      visitor_num TEXT,
      company_num BIGINT,
      company_name TEXT,
      total_amount DECIMAL(15,2) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_faradis_factors_company ON faradis_factors_cache(company_num)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_faradis_factors_month ON faradis_factors_cache(jalali_month)`);

  // Faradis products
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_stuffs_cache (
      stuff_num BIGINT PRIMARY KEY,
      stuff_code TEXT,
      stuff_name TEXT,
      unit_name TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Faradis invoice line items (with product reference)
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_factor_rows_cache (
      factor_row_num BIGINT PRIMARY KEY,
      factor_num BIGINT NOT NULL,
      stuff_num BIGINT,
      stuff_name TEXT,
      count1 DECIMAL(15,3) DEFAULT 0,
      price DECIMAL(15,2) DEFAULT 0,
      total_price DECIMAL(15,2) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ffr_factor ON faradis_factor_rows_cache(factor_num)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ffr_stuff ON faradis_factor_rows_cache(stuff_num)`);

  // Faradis inventory (aggregated per store+product)
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_inventory_cache (
      store_num BIGINT NOT NULL,
      store_name TEXT,
      stuff_num BIGINT NOT NULL,
      stuff_name TEXT,
      stuff_code TEXT,
      count_all DECIMAL(15,3) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (store_num, stuff_num)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fi_stuff ON faradis_inventory_cache(stuff_num)`);

  // Faradis followers/marketers list
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_followers_cache (
      follower_num BIGINT PRIMARY KEY,
      follower_code TEXT,
      follower_name TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Cache of CRM centers pushed from frontend (avoids dependency on centers_master)
  await query(`
    CREATE TABLE IF NOT EXISTS crm_centers_cache (
      center_key TEXT PRIMARY KEY,
      center_name TEXT NOT NULL,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Faradis مطالبات cache
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_receivables_cache (
      company_num BIGINT PRIMARY KEY,
      company_name TEXT DEFAULT '',
      company_code TEXT DEFAULT '',
      total_sales DECIMAL(18,2) DEFAULT 0,
      total_returns DECIMAL(18,2) DEFAULT 0,
      total_received DECIMAL(18,2) DEFAULT 0,
      balance DECIMAL(18,2) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Faradis برگشت‌های فروش cache
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_returns_cache (
      factor_num BIGINT PRIMARY KEY,
      factor_date TIMESTAMPTZ,
      company_num BIGINT,
      company_name TEXT DEFAULT '',
      total_amount DECIMAL(18,2) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fret_company ON faradis_returns_cache(company_num)`);

  // Faradis خریدها cache
  await query(`
    CREATE TABLE IF NOT EXISTS faradis_purchases_cache (
      factor_num BIGINT PRIMARY KEY,
      factor_date TIMESTAMPTZ,
      company_num BIGINT,
      company_name TEXT DEFAULT '',
      total_amount DECIMAL(18,2) DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fpurch_company ON faradis_purchases_cache(company_num)`);

  console.log('[DB] Schema initialized');
}

// ── Migrate proformas from app_data blob → proformas table ─────────────────
async function _migrateProformasFromBlob() {
  try {
    const existing = await query('SELECT COUNT(*) FROM proformas');
    if (parseInt(existing.rows[0].count) > 0) return;
    const blob = await query(`SELECT value FROM app_data WHERE key = 'proformas'`);
    if (!blob.rows.length || !blob.rows[0].value) return;
    const list = blob.rows[0].value;
    if (!Array.isArray(list) || !list.length) return;
    for (const pf of list) {
      await query(
        `INSERT INTO proformas
           (id,no,jalali_date,valid_days,center_key,center_name,items,
            subtotal,discount_pct,disc_amt,tax_pct,tax_amt,total,note,
            status,created_by,created_at,updated_at,sent_at,
            responded_at,responded_by,manager_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                 $15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (id) DO NOTHING`,
        [
          pf.id, pf.no, pf.jalaliDate||null, pf.validDays||30,
          pf.centerKey||'', pf.centerName||'',
          JSON.stringify(pf.items||[]),
          pf.subtotal||0, pf.discountPct||0, pf.discAmt||0,
          pf.taxPct||9, pf.taxAmt||0, pf.total||0,
          pf.note||'', pf.status||'draft', pf.createdBy||'',
          pf.createdAt||new Date().toISOString(),
          pf.updatedAt||new Date().toISOString(),
          pf.sentAt||null, pf.respondedAt||null,
          pf.respondedBy||null, pf.managerNote||'',
        ]
      );
    }
    console.log('[DB] Migrated', list.length, 'proformas from blob → table');
  } catch(e) {
    console.error('[DB] proforma migration error:', e.message);
  }
}

// ── Migrate WMS from app_data blob → wms_* tables ──────────────────────────
async function _migrateWMSFromBlob() {
  try {
    const existing = await query('SELECT COUNT(*) FROM wms_products');
    if (parseInt(existing.rows[0].count) > 0) return;
    const blob = await query(`SELECT value FROM app_data WHERE key = 'wms'`);
    if (!blob.rows.length || !blob.rows[0].value) return;
    const S = blob.rows[0].value;

    // products
    for (const p of (S.products||[])) {
      await query(
        `INSERT INTO wms_products (id,name,full_name,brand,size,catalog_code,irc_code,unit,category,reorder_point,note,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [p.id,p.name||'',p.fullName||'',p.brand||'',p.size||'',
         p.catalogCode||'',p.ircCode||'',p.unit||'عدد',p.category||'',
         p.reorderPoint||10,p.note||'',p.active!==false]
      );
    }
    // warehouses
    for (const w of (S.warehouses||[])) {
      await query(
        `INSERT INTO wms_warehouses (id,name,location,manager_id,note,active)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [w.id,w.name||'',w.location||'',w.managerId||'',w.note||'',w.active!==false]
      );
    }
    // counterparties
    for (const c of (S.counterparties||[])) {
      const t = ['supplier','customer','both'].includes(c.type) ? c.type : 'both';
      await query(
        `INSERT INTO wms_counterparties (id,name,type,phone,address,tax_code,email,note,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [c.id,c.name||'',t,c.phone||'',c.address||'',c.taxCode||'',c.email||'',c.note||'',c.active!==false]
      );
    }
    // lots
    for (const l of (S.lots||[])) {
      await query(
        `INSERT INTO wms_lots (id,product_id,warehouse_id,lot_no,qty,expiry,purchase_price,
          counterparty_id,txn_id,lot_date,entered_by,approved_by,ttac_no,imed_status,imed_ref_no)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
        [l.id,l.productId||null,l.warehouseId||null,l.lotNo||'',l.qty||0,
         l.expiry||null,l.purchasePrice||0,l.counterpartyId||null,
         l.txnId||null,l.date||null,l.enteredBy||null,l.approvedBy||null,
         l.ttacNo||'',l.imedStatus||'not_registered',l.imedRefNo||'']
      );
    }
    // transactions
    for (const t of (S.transactions||[])) {
      await query(
        `INSERT INTO wms_transactions
           (id,txn_no,type,txn_type,product_id,lot_id,warehouse_id,qty,unit_price,sale_price,
            counterparty_id,from_warehouse_id,to_warehouse_id,by_user,txn_date,status,note,
            ref_no,imed_status,imed_ref_no,imed_date,ttac_no)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (id) DO NOTHING`,
        [t.id,t.txnNo||null,t.type||'entry',t.txnType||'',
         t.productId||null,t.lotId||null,t.warehouseId||null,
         t.qty||0,t.unitPrice||0,t.salePrice||0,t.counterpartyId||null,
         t.fromWarehouseId||null,t.toWarehouseId||null,t.by||null,
         t.date||new Date().toISOString(),t.status||'pending',
         t.note||'',t.refNo||'',t.imedStatus||'not_registered',
         t.imedRefNo||'',t.imedDate||'',t.ttacNo||'']
      );
    }
    // purchase orders
    for (const po of (S.purchaseOrders||[])) {
      await query(
        `INSERT INTO wms_purchase_orders (id,po_no,supplier_id,warehouse_id,requested_by,
          approved_by,approved_at,status,items,po_date,expected_delivery,note,imed_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
        [po.id,po.poNo||null,po.supplierId||null,po.warehouseId||null,
         po.requestedBy||null,po.approvedBy||null,po.approvedAt||null,
         po.status||'draft',JSON.stringify(po.items||[]),
         po.date||null,po.expectedDelivery||null,po.note||'',
         po.imedStatus||'not_registered']
      );
    }
    // settings (printConfig, priceLists, priceItems, seq)
    const settingsKeys = ['printConfig','priceLists','priceItems','priceHistory','seq'];
    for (const k of settingsKeys) {
      if (S[k]) {
        await query(
          `INSERT INTO wms_settings (key,value,updated_at) VALUES ($1,$2,NOW())
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [k, JSON.stringify(S[k])]
        );
      }
    }

    console.log('[DB] WMS migrated from blob → tables ✓');
    console.log('[DB]   products:', (S.products||[]).length,
                'warehouses:', (S.warehouses||[]).length,
                'lots:', (S.lots||[]).length,
                'transactions:', (S.transactions||[]).length);
  } catch(e) {
    console.error('[DB] WMS migration error:', e.message);
  }
}

module.exports = { pool, query, initSchema };

'use strict';

// Load .env if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
} catch (e) {}

const fs = require('fs');
const { query, initSchema } = require('./db');

async function migrate() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node server/migrate.js backup.json');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('[Migrate] Reading file:', filePath);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('[Migrate] Failed to parse JSON:', e.message);
    process.exit(1);
  }

  // Initialize schema first
  await initSchema();

  // Detect format: could be { atena_crm_v2: {...DB} } or just the DB object directly
  // or a full backup format: { db: {...}, mtr: {...}, users: [...], centers: {...} }
  let mainDB = null;
  let mtrData = null;
  let centersData = null;

  if (raw.db && typeof raw.db === 'object') {
    // Full backup format
    console.log('[Migrate] Detected full backup format');
    mainDB = raw.db;
    mtrData = raw.mtr || null;
    centersData = raw.centers || null;

    if (raw.users && Array.isArray(raw.users)) {
      console.log('[Migrate] Restoring', raw.users.length, 'users...');
      for (const u of raw.users) {
        if (!u.username) continue;
        await query(
          `INSERT INTO app_users (username, display_name, role, color, phone, active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE
           SET display_name = $2, role = $3, color = $4, phone = $5, active = $6`,
          [u.username, u.display_name || u.username, u.role || 'کارشناس فروش', u.color || '#0ea5e9', u.phone || '', u.active !== false]
        );
      }
      console.log('[Migrate] Users restored');
    }
  } else if (raw.atena_crm_v2) {
    // localStorage export format: { atena_crm_v2: {...DB} }
    console.log('[Migrate] Detected localStorage export format (atena_crm_v2 key)');
    mainDB = raw.atena_crm_v2;

    // Look for MTR keys (atena_mtr_*, am_data, au2, etc.)
    const mtrKeys = ['am_data', 'au2', 'am4', 'aml', 'asnap'];
    const mtrBundle = {};
    let hasMtr = false;
    mtrKeys.forEach(function (k) {
      if (raw[k]) { mtrBundle[k] = raw[k]; hasMtr = true; }
    });
    // Also look for atena_mtr_* prefixed keys
    Object.keys(raw).forEach(function (k) {
      if (k.startsWith('atena_mtr_')) { mtrBundle[k] = raw[k]; hasMtr = true; }
    });
    if (hasMtr) mtrData = mtrBundle;
  } else {
    // Assume the JSON itself is the DB object
    console.log('[Migrate] Assuming raw DB object format');
    mainDB = raw;
  }

  // Extract CENTERS and PC_RAW from mainDB if present
  if (mainDB) {
    if (mainDB.CENTERS || mainDB.PC_RAW) {
      centersData = centersData || {};
      if (mainDB.CENTERS) centersData.CENTERS = mainDB.CENTERS;
      if (mainDB.PC_RAW) centersData.PC_RAW = mainDB.PC_RAW;
    }
  }

  // Store main DB
  if (mainDB) {
    console.log('[Migrate] Storing main DB data...');
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('main', $1, NOW(), 'migrate')
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'migrate'`,
      [JSON.stringify(mainDB)]
    );
    console.log('[Migrate] Main DB stored ✅');
  }

  // Store MTR data
  if (mtrData) {
    console.log('[Migrate] Storing MTR data...');
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('mtr', $1, NOW(), 'migrate')
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'migrate'`,
      [JSON.stringify(mtrData)]
    );
    console.log('[Migrate] MTR data stored ✅');
  }

  // Store centers master data
  if (centersData) {
    if (centersData.CENTERS && Array.isArray(centersData.CENTERS)) {
      console.log('[Migrate] Storing CENTERS master (' + centersData.CENTERS.length + ' centers)...');
      await query(
        `INSERT INTO centers_master (key, data, updated_at)
         VALUES ('CENTERS', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(centersData.CENTERS)]
      );
      console.log('[Migrate] CENTERS stored ✅');
    }
    if (centersData.PC_RAW && typeof centersData.PC_RAW === 'object') {
      console.log('[Migrate] Storing PC_RAW master...');
      await query(
        `INSERT INTO centers_master (key, data, updated_at)
         VALUES ('PC_RAW', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(centersData.PC_RAW)]
      );
      console.log('[Migrate] PC_RAW stored ✅');
    }
  }

  console.log('[Migrate] ✅ Migration complete!');
  process.exit(0);
}

migrate().catch(function (e) {
  console.error('[Migrate] Fatal error:', e.message);
  process.exit(1);
});

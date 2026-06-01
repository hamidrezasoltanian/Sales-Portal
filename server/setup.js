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

const { initSchema } = require('./db');

async function setup() {
  console.log('[Setup] Connecting to PostgreSQL...');
  console.log('[Setup] Host:', process.env.PG_HOST || 'localhost');
  console.log('[Setup] Database:', process.env.PG_DATABASE || 'atena_crm');
  console.log('[Setup] User:', process.env.PG_USER || 'postgres');

  try {
    await initSchema();
    console.log('[Setup] ✅ Database schema initialized successfully!');
    console.log('[Setup] Admin user: Sarah.hosseini');
    console.log('[Setup] Admin password:', process.env.ADMIN_PASSWORD || 'admin123');
    process.exit(0);
  } catch (e) {
    console.error('[Setup] ❌ Error:', e.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Make sure PostgreSQL is running');
    console.error('  2. Create the database: createdb atena_crm');
    console.error('  3. Set correct env vars in .env file (copy from .env.example)');
    console.error('  4. Make sure the user has CREATE TABLE permissions');
    process.exit(1);
  }
}

setup();

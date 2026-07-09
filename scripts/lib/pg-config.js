'use strict';

const path = require('path');
const fs = require('fs');

// Load .env from project root when running scripts directly
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  });
})();

function getPgConfig() {
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'atena_crm',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
  };
}

function requirePgConfig() {
  const cfg = getPgConfig();
  if (!cfg.password) {
    throw new Error('PG_PASSWORD not set. Configure database credentials in .env');
  }
  return cfg;
}

module.exports = { getPgConfig, requirePgConfig };

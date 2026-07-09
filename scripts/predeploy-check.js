#!/usr/bin/env node
'use strict';

/**
 * Pre-deploy checklist — run before pm2 restart on production.
 * Usage: node scripts/predeploy-check.js
 * Exit 0 = OK, 1 = block deploy
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

const errors = [];
const warnings = [];
const isProd = process.env.NODE_ENV === 'production';

function req(name, msg) {
  if (!process.env[name]) errors.push(msg || name + ' is not set');
}

function warnIf(cond, msg) {
  if (cond) warnings.push(msg);
}

req('PG_DATABASE', 'PG_DATABASE is not set');
req('PG_PASSWORD', 'PG_PASSWORD is not set');
req('JWT_SECRET', 'JWT_SECRET is not set');

warnIf(
  process.env.JWT_SECRET === 'change-this-to-a-random-secret-string',
  'JWT_SECRET is still the default insecure value'
);

warnIf(
  !process.env.PRICING_ACCESS_PASSWORD_HASH && !process.env.PRICING_ACCESS_PASSWORD,
  'Pricing margin password not configured (PRICING_ACCESS_PASSWORD_HASH)'
);

warnIf(
  process.env.NODE_ENV !== 'production' && process.env.PG_DATABASE === 'atena_crm',
  'Dev environment using production database name — run scripts/setup_dev_db.sh'
);

warnIf(
  !fs.existsSync(path.join(__dirname, '..', 'public', 'dist', 'assets', 'main.js')),
  'Vue build missing — run npm run build before deploy'
);

// Legacy secrets should not appear in active source
const grepTargets = ['public/js/pricing.js', 'server/routes/data.js'];
const badPatterns = [/62604193/, /adminS@2/];
grepTargets.forEach(function (f) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  const c = fs.readFileSync(p, 'utf8');
  badPatterns.forEach(function (rx) {
    if (rx.test(c)) errors.push('Hardcoded secret found in ' + f);
  });
});

console.log('=== Click CRM pre-deploy check ===');
console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');
console.log('PG_DATABASE:', process.env.PG_DATABASE || '(not set)');

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach(function (w) { console.log('  ⚠ ' + w); });
}

if (errors.length) {
  console.log('\nErrors (deploy blocked):');
  errors.forEach(function (e) { console.log('  ✗ ' + e); });
  process.exit(1);
}

console.log('\n✅ Pre-deploy check passed' + (isProd ? ' (production)' : ''));
process.exit(0);

#!/usr/bin/env node
'use strict';

/**
 * Post-audit secret rotation checklist — run manually on production after deploy.
 * Does NOT rotate secrets automatically; prints required operator actions.
 */
const fs = require('fs');
const path = require('path');

console.log('=== Click CRM — Secret Rotation Checklist ===\n');

const steps = [
  '1. Rotate MS-SQL user `ma` password on 192.168.4.4 (Faradis) — old password was in git history',
  '2. Set FARADIS_SERVER, FARADIS_USER, FARADIS_PASSWORD in production .env',
  '3. Generate new JWT_SECRET: openssl rand -base64 48',
  '4. Set PRICING_ACCESS_PASSWORD_HASH (bcrypt) — retire client-side password 62604193',
  '5. Run: git filter-repo or BFG to purge secrets from git history (coordinate with team)',
  '6. Revoke any Telegram bot token if it was ever committed',
  '7. Run: node scripts/predeploy-check.js && npm test',
  '8. pm2 restart sales-portal',
];

steps.forEach(function (s) { console.log('  ☐ ' + s); });

const envExample = path.join(__dirname, '..', '.env.example');
if (fs.existsSync(envExample)) {
  console.log('\nSee .env.example for required variables.');
}

console.log('\nAfter rotation, verify: git grep -E "62604193|adminS@2" -- . ":(exclude)scripts/rotate-secrets-checklist.js"');
process.exit(0);

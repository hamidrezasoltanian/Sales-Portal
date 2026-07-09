'use strict';

/**
 * Security & RBAC unit/integration tests
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../server/db');
const {
  buildOwnerMaps,
  filterDbForUser,
  filterPutBodyForUser,
} = require('../server/lib/center-ownership');

const TEST_PORT = 3101;
const BASE = `http://localhost:${TEST_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';

const EXPERT = '_tsec_expert';
const OTHER = '_tsec_other';
const MANAGER = '_tsec_manager';

let serverProc = null;
let passed = 0;
let failed = 0;

function token(username, role, tv) {
  return jwt.sign(
    { username, role, name: 'Test ' + username, tv: tv != null ? tv : 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function req(method, urlPath, body, tok) {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers.Authorization = 'Bearer ' + tok;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const r = http.request(
      { hostname: 'localhost', port: TEST_PORT, path: urlPath, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
        });
      }
    );
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(maxMs = 15000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/health');
      if (r.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('server not ready');
}

async function setup() {
  process.env.PRICING_ACCESS_PASSWORD = 'test-pricing-pw';
  const hash = await bcrypt.hash('test-pricing-pw', 4);

  await query(
    `INSERT INTO app_users (username, display_name, role, color, active, token_version)
     VALUES ($1, $2, $3, '#6366f1', true, 0)
     ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role, active = true, token_version = 0`,
    [EXPERT, 'Expert', 'کارشناس فروش']
  );
  await query(
    `INSERT INTO app_users (username, display_name, role, color, active, token_version)
     VALUES ($1, $2, $3, '#6366f1', true, 0)
     ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role, active = true, token_version = 0`,
    [OTHER, 'Other', 'کارشناس فروش']
  );
  await query(
    `INSERT INTO app_users (username, display_name, role, color, active, token_version)
     VALUES ($1, $2, $3, '#6366f1', true, 0)
     ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role, active = true, token_version = 0`,
    [MANAGER, 'Manager', 'مدیر']
  );

  await query(
    `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
     VALUES ('center_owned', $1, NOW(), 'system'),
            ('center_foreign', $2, NOW(), 'system')
     ON CONFLICT (center_key) DO UPDATE SET data = EXCLUDED.data`,
    [
      JSON.stringify({ owner: EXPERT, status: 'فعال' }),
      JSON.stringify({ owner: OTHER, status: 'فعال' }),
    ]
  );
}

async function teardown() {
  await query(`DELETE FROM center_edits WHERE center_key IN ('center_owned', 'center_foreign')`);
  await query(`DELETE FROM app_users WHERE username = ANY($1)`, [[EXPERT, OTHER, MANAGER]]);
}

function testOwnershipHelpers() {
  console.log('\n📋 Unit: center ownership helpers');
  const ownerMaps = buildOwnerMaps({}, []);
  const edits = {
    center_a: { owner: 'alice' },
    center_b: { owner: 'bob' },
  };
  const user = { username: 'alice', role: 'کارشناس فروش' };
  const filtered = filterDbForUser({ edits, notes: { center_a: [], center_b: [] } }, user, ownerMaps);
  assert(Object.keys(filtered.edits).length === 1, 'expert sees only owned center edits');
  assert(filtered.edits.center_a, 'owned center present');

  const put = filterPutBodyForUser(
    { edits: { center_a: { status: 'x' }, center_b: { status: 'y' } } },
    user,
    edits,
    ownerMaps
  );
  assert(!put.body.edits.center_b, 'foreign center stripped from PUT');
  assert(put.rejected.length === 1, 'rejected foreign key logged');
}

async function testRbacApi() {
  console.log('\n📋 API: expert cannot read foreign center via GET /db');
  const tok = token(EXPERT, 'کارشناس فروش');
  const r = await req('GET', '/api/data/db', null, tok);
  assert(r.status === 200, 'GET /db → 200');
  assert(!r.body.edits.center_foreign, 'foreign center hidden');
  assert(!!r.body.edits.center_owned, 'owned center visible');
  assert(r.body._rbacFiltered === true, '_rbacFiltered flag set');
}

async function testManagerSeesAll() {
  console.log('\n📋 API: manager sees all centers');
  const tok = token(MANAGER, 'مدیر');
  const r = await req('GET', '/api/data/db', null, tok);
  assert(r.status === 200, 'manager GET → 200');
  assert(!!r.body.edits.center_foreign, 'manager sees foreign center');
}

async function testPricingCostsGated() {
  console.log('\n📋 API: pricing costs require mgmt access');
  const tok = token(EXPERT, 'کارشناس فروش');
  const denied = await req('GET', '/api/pricing/costs', null, tok);
  assert(denied.status === 403, 'expert without mgmt → 403');

  const mgr = await req('GET', '/api/pricing/costs', null, token(MANAGER, 'مدیر'));
  assert(mgr.status === 200, 'manager can read costs');
  assert(mgr.body['1'] > 0, 'cost data returned');
}

async function testPricingVerify() {
  console.log('\n📋 API: pricing mgmt verify');
  const tok = token(EXPERT, 'کارشناس فروش');
  const bad = await req('POST', '/api/pricing/mgmt/verify', { password: 'wrong' }, tok);
  assert(bad.status === 401, 'wrong password → 401');
  const ok = await req('POST', '/api/pricing/mgmt/verify', { password: 'test-pricing-pw' }, tok);
  assert(ok.status === 200, 'correct password → 200');
}

async function testLogoutRevokesToken() {
  console.log('\n📋 API: logout increments token_version');
  const tok = token(EXPERT, 'کارشناس فروش', 0);
  const before = await req('GET', '/api/auth/me', null, tok);
  assert(before.status === 200, 'token valid before logout');
  await req('POST', '/api/auth/logout', null, tok);
  const after = await req('GET', '/api/auth/me', null, tok);
  assert(after.status === 401, 'token invalid after logout');
}

async function main() {
  console.log('🔐 Security tests — port ' + TEST_PORT);
  testOwnershipHelpers();

  serverProc = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(TEST_PORT), PRICING_ACCESS_PASSWORD: 'test-pricing-pw' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer();
    await setup();
    await testRbacApi();
    await testManagerSeesAll();
    await testPricingCostsGated();
    await testPricingVerify();
    await testLogoutRevokesToken();
  } finally {
    await teardown().catch(() => {});
    if (serverProc) serverProc.kill('SIGTERM');
    await pool.end().catch(() => {});
  }

  console.log('\n────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

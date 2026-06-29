'use strict';

/**
 * Integration tests for behavioral bugs — runs a real server on port 3099
 * and hits it with HTTP requests to verify runtime behavior.
 *
 * Scenarios covered:
 *   1. PUT /api/data/db returns _serverTs
 *   2. Conflict detection: stale _clientTs → 409
 *   3. No false positive: fresh _clientTs → 200
 *   4. Multi-tab: Tab 2 refreshes after Tab 1 saves, then can save without 409
 *   5. SSE: save with cid-A does NOT deliver db-updated to same cid-A
 *   6. SSE: save with cid-A DOES deliver db-updated to cid-B (same user)
 *   7. SSE: save by user-A DOES deliver db-updated to user-B
 *
 * Usage:
 *   node tests/behavioral.test.js
 *   npm test
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3099;
const BASE = `http://localhost:${TEST_PORT}`;

// We generate tokens directly — no need to bcrypt a password.
// The server verifies JWT signature AND checks the user exists+active in DB,
// so we create temp test users in setup().
const jwt = require('jsonwebtoken');
const { query, pool } = require('../server/db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';

const TEST_USERS = ['_tbeh_u1', '_tbeh_u2'];
let serverProc = null;
let passed = 0, failed = 0, skipped = 0;
let _originalDB = null; // backup of main DB before tests

// ─── Utilities ────────────────────────────────────────────────────────────────

function token(username) {
  return jwt.sign(
    { username, role: 'کارشناس فروش', name: 'Test ' + username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function req(method, urlPath, body, tok, cid) {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    if (cid) headers['X-Cid'] = cid;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const r = http.request(
      { hostname: 'localhost', port: TEST_PORT, path: urlPath, method, headers },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

/** Connect to SSE, collect events for `ms` milliseconds, then return them. */
function listenSSE(tok, cid, ms = 2000) {
  return new Promise(resolve => {
    const events = [];
    const urlPath = '/api/events/stream' + (cid ? '?cid=' + encodeURIComponent(cid) : '');
    const r = http.request(
      { hostname: 'localhost', port: TEST_PORT, path: urlPath, method: 'GET',
        headers: { Authorization: 'Bearer ' + tok } },
      res => {
        let buf = '';
        res.on('data', chunk => {
          buf += chunk.toString();
          // SSE messages end with \n\n
          const parts = buf.split('\n\n');
          buf = parts.pop(); // keep incomplete tail
          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (line.startsWith('data: ')) {
                try { events.push(JSON.parse(line.slice(6))); } catch {}
              }
            }
          }
        });
        res.on('error', () => {});
      }
    );
    r.on('error', () => {});
    r.end();
    setTimeout(() => { try { r.destroy(); } catch {} resolve(events); }, ms);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function assert(condition, msg) {
  if (condition) {
    console.log('  ✅ ' + msg);
    passed++;
  } else {
    console.log('  ❌ ' + msg);
    failed++;
  }
}

function skip(msg) {
  console.log('  ⏭  ' + msg + ' (رد شد)');
  skipped++;
}

async function waitForServer(maxMs = 15000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/health', null, null, null);
      if (r.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('سرور آماده نشد');
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

async function setup() {
  // Create temp test users (no password_hash — we use JWT directly)
  for (const u of TEST_USERS) {
    await query(
      `INSERT INTO app_users (username, display_name, role, color, active)
       VALUES ($1, $2, 'کارشناس فروش', '#6366f1', true)
       ON CONFLICT (username) DO UPDATE SET active = true`,
      [u, 'Behavioral Test ' + u]
    );
  }

  // Backup current main DB data
  const r = await query("SELECT value FROM app_data WHERE key = 'main'");
  _originalDB = r.rows.length ? r.rows[0].value : null;
}

async function teardown() {
  // Restore original DB data
  if (_originalDB !== null) {
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('main', $1, NOW(), '_test_restore')
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = '_test_restore'`,
      [JSON.stringify(_originalDB)]
    );
  }

  // Remove test users
  await query(`DELETE FROM app_users WHERE username = ANY($1)`, [TEST_USERS]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function test1_savereturnsServerTs() {
  console.log('\n📋 Test 1: PUT /api/data/db باید _serverTs برگرداند');
  const tok = token(TEST_USERS[0]);

  const get = await req('GET', '/api/data/db', null, tok);
  assert(get.status === 200, 'GET /api/data/db → 200');
  assert('_serverTs' in get.body, '_serverTs در GET response وجود دارد (حتی اگر null باشد)');

  const put = await req('PUT', '/api/data/db',
    { ...(get.body), _clientTs: get.body._serverTs, _test1: true },
    tok, 'cid-t1');
  assert(put.status === 200, 'PUT /api/data/db → 200');
  assert(typeof put.body._serverTs === 'string', '_serverTs در PUT response: ' + put.body._serverTs);
}

async function test2_conflictDetection() {
  console.log('\n📋 Test 2: timestamp کهنه باید 409 بدهد (conflict detection)');
  const tok = token(TEST_USERS[0]);

  const get = await req('GET', '/api/data/db', null, tok);
  const T0 = get.body._serverTs;

  // First save advances the timestamp
  const put1 = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: T0, _adv: 1 }, tok, 'cid-t2a');
  assert(put1.status === 200, 'PUT اول موفق (' + put1.status + ')');
  const T1 = put1.body._serverTs;
  assert(T1 !== T0, 'timestamp پیشرفت: ' + T0 + ' → ' + T1);

  // Second save with stale T0 → must 409
  const put2 = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: T0, _stale: 1 }, tok, 'cid-t2b');
  assert(put2.status === 409,
    'PUT با timestamp کهنه → 409 (got ' + put2.status + ')');
}

async function test3_noFalsePositive() {
  console.log('\n📋 Test 3: timestamp درست → نباید 409 بدهد');
  const tok = token(TEST_USERS[0]);

  const get = await req('GET', '/api/data/db', null, tok);

  const put1 = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: get.body._serverTs, _fp1: 1 }, tok, 'cid-t3');
  assert(put1.status === 200, 'PUT اول → 200');

  // Use fresh _serverTs from put1 response
  const put2 = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: put1.body._serverTs, _fp2: 1 }, tok, 'cid-t3');
  assert(put2.status === 200,
    'PUT دوم با _clientTs به‌روز → 200 (بدون false positive)');
}

async function test4_multiTabScenario() {
  console.log('\n📋 Test 4: سناریوی multi-tab — Tab 2 بعد از GET refresh باید save کند');
  const tok = token(TEST_USERS[0]);

  // Both tabs see T0 at page load
  const get = await req('GET', '/api/data/db', null, tok);
  const T0 = get.body._serverTs;

  // Tab 1 saves → server timestamp advances to T1
  const tab1 = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: T0, _tab1: 1 }, tok, 'cid-tab1');
  assert(tab1.status === 200, 'Tab 1 save موفق');
  const T1 = tab1.body._serverTs;

  // Tab 2 tries with stale T0 → 409 (expected — this is the BUG scenario)
  const tab2stale = await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: T0, _tab2stale: 1 }, tok, 'cid-tab2');
  assert(tab2stale.status === 409,
    'Tab 2 با timestamp کهنه → 409 (conflict واقعی، درست است)');

  // Tab 2 simulates SSE-triggered _sseReloadDB: re-fetches DB, gets T1
  const tab2refresh = await req('GET', '/api/data/db', null, tok);
  assert(tab2refresh.body._serverTs === T1,
    'Tab 2 بعد از refresh، T1 را می‌بیند: ' + tab2refresh.body._serverTs);

  // Tab 2 saves with fresh T1 → must succeed (THE FIX)
  const tab2save = await req('PUT', '/api/data/db',
    { ...tab2refresh.body, _clientTs: T1, _tab2fresh: 1 }, tok, 'cid-tab2');
  assert(tab2save.status === 200,
    'Tab 2 بعد از SSE-refresh → save موفق (' + tab2save.status + ')');
}

async function test5_sseExcludesOwnCid() {
  console.log('\n📋 Test 5: SSE — save با cid-A نباید به خود cid-A event بفرستد');
  const tok = token(TEST_USERS[0]);
  const myCid = 'cid-selfexclude-' + Date.now();

  // Start listening BEFORE saving
  const ssePromise = listenSSE(tok, myCid, 2200);
  await sleep(300); // let SSE connect

  const get = await req('GET', '/api/data/db', null, tok);
  await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: get.body._serverTs, _t5: 1 }, tok, myCid);

  const events = await ssePromise;
  const dbEvents = events.filter(e => e.type === 'db-updated');
  assert(dbEvents.length === 0,
    'cid یکسان: هیچ db-updated دریافت نشد (got ' + dbEvents.length + ')');
}

async function test6_sseDeliversToDifferentCid() {
  console.log('\n📋 Test 6: SSE — save از cid-A باید به cid-B (همان کاربر) تحویل داده شود');
  const tok = token(TEST_USERS[0]);
  const cidA = 'cid-sender-' + Date.now();
  const cidB = 'cid-receiver-' + Date.now();

  // cid-B listens
  const ssePromise = listenSSE(tok, cidB, 2200);
  await sleep(300);

  const get = await req('GET', '/api/data/db', null, tok);
  // cid-A saves
  await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: get.body._serverTs, _t6: 1 }, tok, cidA);

  const events = await ssePromise;
  const dbEvents = events.filter(e => e.type === 'db-updated');
  assert(dbEvents.length >= 1,
    'cid متفاوت (همان کاربر): db-updated دریافت شد (' + dbEvents.length + ' events)');
  if (dbEvents.length > 0) {
    assert(dbEvents[0].by === TEST_USERS[0],
      'event شامل نام کاربر صادرکننده: ' + dbEvents[0].by);
  }
}

async function test7_sseDeliversToOtherUser() {
  console.log('\n📋 Test 7: SSE — save از user-A باید به user-B تحویل داده شود');
  const tokA = token(TEST_USERS[0]);
  const tokB = token(TEST_USERS[1]);

  const ssePromise = listenSSE(tokB, 'cid-userB-' + Date.now(), 2200);
  await sleep(300);

  const get = await req('GET', '/api/data/db', null, tokA);
  await req('PUT', '/api/data/db',
    { ...get.body, _clientTs: get.body._serverTs, _t7: 1 },
    tokA, 'cid-userA-' + Date.now());

  const events = await ssePromise;
  const dbEvents = events.filter(e => e.type === 'db-updated');
  assert(dbEvents.length >= 1,
    'user متفاوت: db-updated دریافت شد (' + dbEvents.length + ' events)');
}

async function test8_hcpAndAffiliationEndpoints() {
  console.log('\n📋 Test 8: HCP & Affiliations — مدیریت پزشکان و ارتباطات مراکز');
  const tok = token(TEST_USERS[0]);

  // 1. Create HCP
  const hcpPayload = {
    name: 'دکتر تست بهمنی',
    specialty: 'رادیولوژی مداخله‌ای',
    rank: 'استاد',
    medicalCouncilNo: '12345-TEST',
    phones: ['09129999999'],
    email: 'test@hcp.com',
    notes: 'توضیحات تست'
  };
  const createHcp = await req('POST', '/api/hcps', hcpPayload, tok);
  assert(createHcp.status === 201, 'ثبت پزشک جدید موفق بود (201)');
  assert(createHcp.body.id && createHcp.body.id.startsWith('hcp_'), 'شناسه پزشک hcp_ دارد');
  const hcpId = createHcp.body.id;

  // 2. Search HCP
  const searchHcp = await req('GET', '/api/hcps?q=' + encodeURIComponent('بهمنی'), null, tok);
  assert(searchHcp.status === 200, 'جستجوی پزشکان موفق بود (200)');
  assert(searchHcp.body.some(h => h.id === hcpId), 'پزشک ثبت شده در نتایج جستجو وجود دارد');

  // 3. Create Affiliation
  const affPayload = {
    centerKey: 'center_test_center_1',
    hcpId: hcpId,
    role: 'رئیس بخش رادیولوژی',
    influenceLevel: 'KOL',
    workingHours: 'شنبه‌ها و دوشنبه‌ها',
    notes: 'توضیحات ارتباط تست'
  };
  const createAff = await req('POST', '/api/hcps/affiliations', affPayload, tok);
  assert(createAff.status === 201, 'ایجاد ارتباط پزشک با مرکز موفق بود (211/201)');
  assert(createAff.body.id, 'شناسه ارتباط تولید شده است');
  const affId = createAff.body.id;

  // 4. Get Center Affiliations
  const getCenterAffs = await req('GET', '/api/hcps/centers/center_test_center_1/affiliations', null, tok);
  assert(getCenterAffs.status === 200, 'دریافت ارتباطات مرکز موفق بود (200)');
  assert(getCenterAffs.body.some(a => a.id === affId), 'ارتباط ایجاد شده در مرکز وجود دارد');

  // 5. Update Affiliation
  const updateAffPayload = {
    role: 'مدیر کلینیک رادیولوژی مداخله‌ای',
    influenceLevel: 'Decision Maker',
    workingHours: 'یکشنبه‌ها',
    notes: 'تغییر توضیحات'
  };
  const updateAff = await req('PUT', '/api/hcps/affiliations/' + affId, updateAffPayload, tok);
  assert(updateAff.status === 200, 'ویرایش ارتباط موفق بود (200)');
  assert(updateAff.body.role === 'مدیر کلینیک رادیولوژی مداخله‌ای', 'سمت ویرایش شد');

  // 6. Delete Affiliation
  const deleteAff = await req('DELETE', '/api/hcps/affiliations/' + affId, null, tok);
  assert(deleteAff.status === 200, 'قطع ارتباط موفق بود (200)');

  // 7. Delete HCP
  const deleteHcp = await req('DELETE', '/api/hcps/' + hcpId, null, tok);
  assert(deleteHcp.status === 200, 'حذف پزشک موفق بود (200)');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Flow CRM — Behavioral Integration Tests');
  console.log('════════════════════════════════════════════════════════');
  console.log('  Port: ' + TEST_PORT);

  // Start server as child process
  serverProc = spawn('node', ['server/index.js'], {
    env: Object.assign({}, process.env, { PORT: String(TEST_PORT) }),
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverReady = false;
  serverProc.stdout.on('data', d => {
    const line = d.toString().trim();
    if (!serverReady) process.stdout.write('  [srv] ' + line + '\n');
  });
  serverProc.stderr.on('data', d => {
    process.stderr.write('  [srv-err] ' + d.toString().trim() + '\n');
  });
  serverProc.on('exit', code => {
    if (!serverReady) process.stderr.write('  سرور قبل از آماده شدن بسته شد (exit ' + code + ')\n');
  });

  let exitCode = 0;
  try {
    process.stdout.write('  در انتظار آماده شدن سرور');
    await waitForServer(20000);
    serverReady = true;
    console.log('... آماده\n');

    await setup();
    console.log('  ✅ test users ایجاد شدند، DB پشتیبان گرفته شد');

    await test1_savereturnsServerTs();
    await test2_conflictDetection();
    await test3_noFalsePositive();
    await test4_multiTabScenario();
    await test5_sseExcludesOwnCid();
    await test6_sseDeliversToDifferentCid();
    await test7_sseDeliversToOtherUser();
    await test8_hcpAndAffiliationEndpoints();

  } catch (err) {
    console.error('\n❌ خطای غیرمنتظره:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    try { await teardown(); console.log('\n  ✅ DB بازگردانده شد، test users حذف شدند'); }
    catch (e) { console.error('\n  ⚠ teardown خطا:', e.message); }

    if (serverProc) { try { serverProc.kill(); } catch {} }

    await pool.end().catch(() => {});

    const total = passed + failed + skipped;
    console.log('\n' + '═'.repeat(56));
    console.log(
      '  ✅ Passed: ' + passed +
      '   ❌ Failed: ' + failed +
      (skipped ? '   ⏭  Skipped: ' + skipped : '') +
      '   / Total: ' + total
    );
    console.log('═'.repeat(56));

    exitCode = failed > 0 ? 1 : 0;
    // Give pool.end() time to flush, then exit
    setTimeout(() => process.exit(exitCode), 200);
  }
}

main();

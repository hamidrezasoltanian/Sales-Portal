'use strict';

/**
 * Persistence integration tests — every major write endpoint:
 * CREATE → GET verify → UPDATE → GET verify → cleanup
 *
 * Usage: node tests/persistence.test.js
 * Starts its own server on port 3097 (PostgreSQL required).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const { query, pool } = require('../server/db');

const TEST_PORT = parseInt(process.env.TEST_PORT || '3097', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';
const TEST_MANAGER = '_tpersist_mgr';

let passed = 0;
let failed = 0;
let serverProc = null;
let authToken = '';
const PREFIX = '_persist_' + Date.now();

function managerToken(username) {
  return jwt.sign(
    { username, role: 'مدیر', name: 'Persist Test Manager' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(maxMs = 20000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/health');
      if (r.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('سرور آماده نشد');
}

function req(method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined && body !== null && !(body instanceof Buffer)
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
    if (authToken) headers.Authorization = 'Bearer ' + authToken;
    if (bodyStr && !(body instanceof Buffer)) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    } else if (body instanceof Buffer) {
      headers['Content-Length'] = body.length;
      if (!(extraHeaders && extraHeaders['Content-Type'])) {
        delete headers['Content-Type'];
      }
    }
    const r = http.request(
      { hostname: 'localhost', port: TEST_PORT, path: urlPath, method, headers },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );
    r.on('error', reject);
    if (body instanceof Buffer) r.write(body);
    else if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function setup() {
  await query(
    `INSERT INTO app_users (username, display_name, role, color, active)
     VALUES ($1, $2, 'مدیر', '#6366f1', true)
     ON CONFLICT (username) DO UPDATE SET role = 'مدیر', active = true`,
    [TEST_MANAGER, 'Persistence Test Manager']
  );
  authToken = managerToken(TEST_MANAGER);
}

async function teardown() {
  const like = '%' + PREFIX + '%';
  await query('DELETE FROM center_edits WHERE center_key LIKE $1', [like]).catch(() => {});
  await query('DELETE FROM center_notes WHERE center_key LIKE $1', [like]).catch(() => {});
  await query('DELETE FROM calendar_events WHERE title LIKE $1', [like]).catch(() => {});
  await query('DELETE FROM daily_checklists WHERE note LIKE $1', [like]).catch(() => {});
  await query('DELETE FROM call_log WHERE note LIKE $1', [like]).catch(() => {});
  await query('DELETE FROM tasks WHERE id LIKE $1', ['tk_' + PREFIX + '%']).catch(() => {});
  await query('DELETE FROM week_entries WHERE id LIKE $1', ['we_' + PREFIX + '%']).catch(() => {});
  await query('DELETE FROM app_users WHERE username = $1', [TEST_MANAGER]).catch(() => {});
}

function multipart(fields, fileField, fileName, fileBuf, mime) {
  const boundary = '----PersistTest' + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + v + '\r\n');
  }
  parts.push(
    '--' + boundary + '\r\nContent-Disposition: form-data; name="' + fileField + '"; filename="' + fileName + '"\r\n' +
    'Content-Type: ' + mime + '\r\n\r\n'
  );
  const tail = '\r\n--' + boundary + '--\r\n';
  return {
    boundary,
    body: Buffer.concat([Buffer.from(parts.join('')), fileBuf, Buffer.from(tail)]),
  };
}

async function authReady() {
  const r = await req('GET', '/api/data/db');
  assert(r.status === 200, 'auth GET db → 200');
  return r.body;
}

// ─── 1. Main DB blob ───────────────────────────────────────────────────────
async function testDbBlob() {
  console.log('\n📦 1. PUT /api/data/db — blob persistence');
  const get = await req('GET', '/api/data/db');
  assert(get.status === 200, 'GET db → 200');
  const db = get.body;
  const key = 'center_' + PREFIX;
  db.edits = db.edits || {};
  db.edits[key] = { status: 'تماس گرفته شد', owner: 'TEST_MANAGER', _ts: Date.now() };
  db.notes = db.notes || {};
  db.notes[key] = [{ text: 'یادداشت تست persistence', by: 'TEST_MANAGER', date: '1404/01/01' }];
  const put = await req('PUT', '/api/data/db', {
    edits: db.edits,
    notes: db.notes,
    _clientTs: db._serverTs,
  });
  assert(put.status === 200, 'PUT db → 200');
  const get2 = await req('GET', '/api/data/db');
  assert(get2.body.edits && get2.body.edits[key], 'edit persisted in GET');
  assert(get2.body.notes && get2.body.notes[key] && get2.body.notes[key].length, 'note persisted in GET');
}

// ─── 2. PATCH partial (centers only — weekEntries ignored) ─────────────────
async function testDbPatch() {
  console.log('\n📦 2. PATCH /api/data/patch — center edit persistence');
  const get = await req('GET', '/api/data/db');
  const key = 'pc_' + PREFIX + '||1';
  const patch = {
    _clientTs: get.body._serverTs,
    edits: { [key]: { status: 'پیشنهاد', followupDate: '1404/04/15' } },
  };
  const r = await req('PATCH', '/api/data/patch', patch);
  assert(r.status === 200, 'PATCH → 200 (' + r.status + ')');
  const get2 = await req('GET', '/api/data/db');
  assert(get2.body.edits && get2.body.edits[key], 'patch edit in db');
  const weKey = '1404w01:::' + key;
  assert(!get2.body.weekEntries || !get2.body.weekEntries[weKey], 'weekEntries not via patch (SQL-only)');
}

// ─── 2b. Centers PATCH API ───────────────────────────────────────────────
async function testCentersPatch() {
  console.log('\n🏥 2b. PATCH /api/centers/:key');
  const key = 'center_' + PREFIX;
  const r = await req('PATCH', '/api/centers/' + encodeURIComponent(key), {
    field: 'status',
    val: 'تماس گرفته شد',
    centerName: 'تست persistence',
  });
  assert(r.status === 200, 'PATCH center → 200 (' + r.status + ')');
  const get = await req('GET', '/api/centers/' + encodeURIComponent(key));
  assert(get.status === 200, 'GET center → 200');
  assert(get.body.data && get.body.data.status === 'تماس گرفته شد', 'center status persisted');
}

async function testCenterInteractions() {
  console.log('\n🤝 2b2. Center interactions (idempotency + fan-out + rollback)');
  const key = 'center_' + PREFIX;
  const idem = 'idem_' + PREFIX;
  const payload = {
    mode: 'quick',
    actionType: 'call',
    result: 'تماس موفق',
    note: PREFIX + ' interaction test',
    centerName: 'تست',
    occurredDate: '1404/04/15',
    idempotencyKey: idem,
  };
  const create = await req('POST', '/api/centers/' + encodeURIComponent(key) + '/interactions', payload, { 'X-Idempotency-Key': idem });
  assert(create.status === 201, 'POST interaction → 201 (' + create.status + ')');
  assert(create.body.interaction && create.body.interaction.id, 'interaction id returned');
  assert(Array.isArray(create.body.notes) && create.body.notes.length >= 1, 'interaction response includes notes');

  const notesGet = await req('GET', '/api/centers/' + encodeURIComponent(key) + '/notes');
  assert(notesGet.status === 200, 'GET center notes → 200');
  assert(Array.isArray(notesGet.body.notes) && notesGet.body.notes.length >= 1, 'GET notes returns saved note');

  const replay = await req('POST', '/api/centers/' + encodeURIComponent(key) + '/interactions', payload, { 'X-Idempotency-Key': idem });
  assert(replay.status === 200, 'idempotent replay → 200 (' + replay.status + ')');
  assert(replay.body.replay === true, 'replay flag true');

  const cnt = await query('SELECT COUNT(*)::int AS c FROM center_interactions WHERE idempotency_key = $1', [idem]);
  assert(cnt.rows[0].c === 1, 'single interaction row after idempotent retry');

  const noKey = await req('POST', '/api/centers/' + encodeURIComponent(key) + '/interactions', { mode: 'quick', actionType: 'call' });
  assert(noKey.status === 400, 'missing idempotency → 400');

  const badIdem = 'bad_' + PREFIX;
  const bad = await req('POST', '/api/centers/' + encodeURIComponent(key) + '/interactions', {
    mode: 'done',
    actionType: 'visit',
    outcome: 'followup',
    note: 'should rollback',
    weekEntryId: 'nonexistent_week_id_' + PREFIX,
    idempotencyKey: badIdem,
  }, { 'X-Idempotency-Key': badIdem });
  assert(bad.status === 404, 'invalid week entry → 404 (' + bad.status + ')');
  const badCnt = await query('SELECT COUNT(*)::int AS c FROM center_interactions WHERE idempotency_key = $1', [badIdem]);
  assert(badCnt.rows[0].c === 0, 'rollback: no interaction row on failure');
  const notesR = await query('SELECT notes FROM center_notes WHERE center_key = $1', [key]);
  const notes = notesR.rows.length ? (notesR.rows[0].notes || []) : [];
  const hasRollbackNote = notes.some(function (n) { return (n.text || '').indexOf('should rollback') >= 0; });
  assert(!hasRollbackNote, 'rollback: no orphan note on failure');

  const timeline = await req('GET', '/api/center-reports/' + encodeURIComponent(key) + '/timeline');
  assert(timeline.status === 200, 'timeline merge → 200');
  const hasIx = (timeline.body.events || []).some(function (e) { return e.type === 'interaction'; });
  assert(hasIx, 'timeline includes interaction event');
}

async function testCalendarEvents() {
  console.log('\n📅 2c. Calendar events SQL API');
  const evId = Math.floor(Date.now() / 1000) % 2000000000;
  const create = await req('POST', '/api/calendar-events', {
    id: evId,
    title: 'رویداد تست ' + PREFIX,
    desc: 'تست persistence',
    startMs: Date.now(),
    allDay: true,
    color: '#0ea5e9',
    owner: 'TEST_MANAGER',
  });
  assert(create.status === 200, 'POST calendar-event → 200 (' + create.status + ')');
  const list = await req('GET', '/api/data/collections/events');
  assert(Array.isArray(list.body) && list.body.some(function (e) { return e.id === evId; }), 'event in collections/events');
  const del = await req('DELETE', '/api/calendar-events/' + evId);
  assert(del.status === 200, 'DELETE calendar-event → 200');
}

// ─── 2d. Checklist SQL ───────────────────────────────────────────────────
async function testChecklistApi() {
  console.log('\n✅ 2d. Checklist SQL API');
  const date = '1404/04/24';
  const user = 'TEST_MANAGER';
  const create = await req('POST', '/api/checklist', {
    date: date,
    username: user,
    items: [{ id: 1, done: true }],
    note: 'تست ' + PREFIX,
  });
  assert(create.status === 200, 'POST checklist → 200 (' + create.status + ')');
  const get = await req('GET', '/api/data/collections/checklist/' + encodeURIComponent(date) + '/' + encodeURIComponent(user));
  assert(get.status === 200, 'GET checklist collection → 200');
  assert(get.body.note && get.body.note.includes(PREFIX), 'checklist note persisted');
}

// ─── 2e. Activity log idempotency ────────────────────────────────────────
async function testActivityLog() {
  console.log('\n📞 2e. Activity log SQL API (idempotent upsert)');
  const logId = Date.now();
  const entry = { id: logId, date: '1404/04/24', userId: 'TEST_MANAGER', count: 5, note: PREFIX };
  const create = await req('POST', '/api/activity-log', { type: 'call', entry: entry });
  assert(create.status === 201, 'POST activity-log → 201 (' + create.status + ')');
  const retry = await req('POST', '/api/activity-log', { type: 'call', entry: Object.assign({}, entry, { count: 7 }) });
  assert(retry.status === 201, 'POST activity-log retry → 201');
  const list = await req('GET', '/api/activity-log?type=call&limit=20&username=TEST_MANAGER');
  assert(list.status === 200, 'GET activity-log → 200');
  const found = (list.body.entries || []).filter(function (e) { return e.id === logId; });
  assert(found.length === 1, 'single row after idempotent upsert');
  assert(found[0].count === 7, 'count updated on retry');
  await req('DELETE', '/api/activity-log/call/' + logId);
}

// ─── 2f. KPI data API ────────────────────────────────────────────────────
async function testKpiData() {
  console.log('\n📊 2f. KPI data SQL API');
  const month = '1404/04';
  const t = await req('POST', '/api/kpi-data/user-target', {
    username: 'TEST_MANAGER',
    month: month,
    callsPerDay: 12,
    visitsPerWeek: 6,
    salesCount: 4,
    salesAmount: 0,
    cashPct: 55,
  });
  assert(t.status === 200, 'POST kpi user-target → 200 (' + t.status + ')');
  const hist = await req('POST', '/api/kpi-data/history', {
    userId: 'TEST_MANAGER',
    month: month,
    overall: 85,
    scores: { calls: 90 },
    savedAt: new Date().toISOString(),
  });
  assert(hist.status === 200, 'POST kpi history → 200');
  const snap = await req('GET', '/api/kpi-data/history?user=TEST_MANAGER&month=' + encodeURIComponent(month));
  assert(snap.status === 200 && snap.body.history && snap.body.history.length, 'kpi history persisted');

  const actuals = await req('GET', '/api/kpi-data/actuals?user=TEST_MANAGER&month=' + encodeURIComponent(month));
  assert(actuals.status === 200, 'GET kpi actuals → 200');
  assert(actuals.body.ok === true, 'kpi actuals ok:true');
  assert(typeof actuals.body.totals === 'object', 'kpi actuals has totals');
}

// ─── 2g. Tags API ─────────────────────────────────────────────────────────
async function testTagsApi() {
  console.log('\n🏷 2g. Tags SQL API');
  const centerKey = 'center_' + PREFIX;
  const r = await req('PATCH', '/api/tags/centers/' + encodeURIComponent(centerKey), {
    tagIds: ['tag_test_' + PREFIX],
  });
  assert(r.status === 200, 'PATCH center tags → 200 (' + r.status + ')');
}

// ─── 2h. Mission log ─────────────────────────────────────────────────────
async function testMissionLog() {
  console.log('\n✈️ 2h. Mission log SQL API');
  const month = '1404/04';
  const create = await req('POST', '/api/mission-log', {
    userId: 'TEST_MANAGER',
    month: month,
    done: true,
    note: 'تست ' + PREFIX,
  });
  assert(create.status === 200, 'POST mission-log → 200 (' + create.status + ')');
  await req('DELETE', '/api/mission-log?userId=TEST_MANAGER&month=' + encodeURIComponent(month));
}

// ─── 3. Tasks SQL ──────────────────────────────────────────────────────────
async function testTasks() {
  console.log('\n📌 3. Tasks SQL API');
  const tid = 'tk_' + PREFIX;
  const create = await req('POST', '/api/tasks', {
    id: tid, title: 'وظیفه تست persistence', owner: 'TEST_MANAGER',
    dueDate: '1404/04/20', priority: 2, status: 'todo', createdBy: 'TEST_MANAGER',
  });
  assert(create.status === 201, 'POST task → 201 (' + create.status + ')');
  const list = await req('GET', '/api/tasks');
  assert(Array.isArray(list.body) && list.body.some(t => t.id === tid), 'task in GET list');
  const upd = await req('PUT', '/api/tasks/' + tid, { title: 'وظیفه ویرایش شده', status: 'doing' });
  assert(upd.status === 200, 'PUT task → 200');
  assert(upd.body.title === 'وظیفه ویرایش شده', 'task title updated');
  await req('DELETE', '/api/tasks/' + tid);
}

// ─── 3b. Tasks in GET /api/data/db ─────────────────────────────────────────
async function testTasksInDb() {
  console.log('\n📌 3b. Tasks in GET /api/data/db');
  const get = await req('GET', '/api/data/db');
  assert(Array.isArray(get.body.tasks), 'GET db includes tasks array');
}

// ─── 4. Week entries SQL ───────────────────────────────────────────────────
async function testWeekEntries() {
  console.log('\n📋 4. Week entries SQL API');
  const weId = 'we_' + PREFIX;
  const weekId = '1404w02';
  const rid = PREFIX;
  const recKey = 'center_' + rid;
  const create = await req('POST', '/api/week-entries', {
    id: weId,
    weekId,
    recKey,
    rtype: 'center',
    rid,
    scheduledDate: '1404/04/12',
    actionType: 'visit',
    addedBy: 'TEST_MANAGER',
    centerName: 'مرکز تست',
  });
  assert(create.status === 201 || create.status === 200, 'POST week-entry → ' + create.status);
  const get = await req('GET', '/api/week-entries');
  assert(get.status === 200, 'GET week-entries → 200');
  const entries = Array.isArray(get.body) ? get.body : [];
  const has = entries.some(e => e.id === weId || e.recKey === recKey);
  assert(has, 'week entry persisted');
  if (create.body && create.body.id) {
    await req('DELETE', '/api/week-entries/' + encodeURIComponent(create.body.id));
  }
}

// ─── 5. Notifications ────────────────────────────────────────────────────
async function testNotifications() {
  console.log('\n🔔 5. Notifications');
  const nid = 'ntf_' + PREFIX;
  const create = await req('POST', '/api/notifications', {
    id: nid,
    to: 'TEST_MANAGER',
    msg: 'اعلان تست ' + PREFIX,
    centerKey: '',
  });
  assert(create.status === 201 || create.status === 200, 'POST notification → ' + create.status);
  if (create.body.disabled) {
    console.log('  ⏭ notifications SQL disabled in this build — skipping list check');
    return;
  }
  const returnedId = create.body.id || create.body.notification?.id;
  assert(returnedId, 'notification id returned');
  const list = await req('GET', '/api/notifications?to=TEST_MANAGER');
  assert(list.status === 200, 'GET notifications → 200');
  const found = (list.body || []).some(n => n.id === returnedId || (n.msg && n.msg.includes(PREFIX)));
  assert(found, 'notification in list');
  await req('PUT', '/api/notifications/' + returnedId + '/read');
}

async function testNotifPrefsAndInbox() {
  console.log('\n🔔 5b. Notification prefs + inbox');
  const prefs = await req('GET', '/api/notifications/prefs');
  assert(prefs.status === 200, 'GET prefs → 200');
  const put = await req('PUT', '/api/notifications/prefs', {
    prefs: { channels: { web: true, telegram: true, browser: true }, digest_mode: 'instant' },
  });
  assert(put.status === 200, 'PUT prefs → 200');
  const inbox = await req('GET', '/api/notifications/inbox');
  assert(inbox.status === 200, 'GET inbox → 200');
}

// ─── 6. Proforma ───────────────────────────────────────────────────────────
async function testProforma() {
  console.log('\n📄 6. Proforma CRUD + file');
  const create = await req('POST', '/api/proforma', {
    centerKey: '', centerName: 'مشتری تست ' + PREFIX,
    items: [{ prodId: '', catalogCode: '', name: 'کالای تست', unit: 'عدد', qty: 2, unitPrice: 1000000, discPct: 0 }],
    note: 'تست persistence', jalaliDate: '1404/04/01', validDays: 30, taxPct: 0, discountPct: 0,
  });
  assert(create.status === 201, 'POST proforma → 201 (' + create.status + ')');
  const pfId = create.body.id;
  assert(pfId, 'proforma id');
  const get = await req('GET', '/api/proforma/' + pfId);
  assert(get.status === 200 && get.body.centerName.includes(PREFIX), 'GET proforma persisted');
  const upd = await req('PUT', '/api/proforma/' + pfId, {
    centerName: 'مشتری ویرایش ' + PREFIX,
    items: create.body.items,
    note: 'ویرایش شد', jalaliDate: '1404/04/01', validDays: 30, taxPct: 0, discountPct: 0,
  });
  assert(upd.status === 200, 'PUT proforma → 200');
  assert(upd.body.note === 'ویرایش شد', 'proforma note updated');
  assert(upd.body.versions && upd.body.versions.length >= 1, 'proforma version saved');
  const snap = upd.body.versions[upd.body.versions.length - 1];
  assert(snap.centerName && snap.centerName.includes(PREFIX), 'snapshot has centerName');
  assert(Array.isArray(snap.items) && snap.items.length > 0, 'snapshot has items');
  assert(snap.jalaliDate === '1404/04/01', 'snapshot has jalaliDate');
  assert(snap.validDays === 30, 'snapshot has validDays');
  const restore = await req('POST', '/api/proforma/' + pfId + '/restore', { versionIndex: 0 });
  assert(restore.status === 200, 'POST proforma restore → 200 (' + restore.status + ')');
  assert(restore.body.note === 'تست persistence', 'restore reverted note from snapshot');
  assert(restore.body.versions && restore.body.versions.length > upd.body.versions.length, 'restore appends current state to versions');
  const mp = multipart({}, 'file', 'test.txt', Buffer.from('persistence test file'), 'text/plain');
  const fileRes = await req('POST', '/api/proforma/' + pfId + '/files', mp.body, {
    'Content-Type': 'multipart/form-data; boundary=' + mp.boundary,
  });
  assert(fileRes.status === 201, 'POST proforma file → 201 (' + fileRes.status + ')');
  const files = await req('GET', '/api/proforma/' + pfId + '/files/list');
  assert(files.body.files && files.body.files.length > 0, 'file listed after upload');
  await req('DELETE', '/api/proforma/' + pfId);
}

// ─── 7. WMS ────────────────────────────────────────────────────────────────
async function testWms() {
  console.log('\n📦 7. WMS product + warehouse + transaction');
  const p = await req('POST', '/api/wms/products', {
    name: 'محصول تست ' + PREFIX, fullName: 'محصول تست کامل', brand: 'Test', unit: 'عدد',
    catalogCode: 'TST-' + PREFIX, salePrice: 500000, active: true,
  });
  assert(p.status === 201 || p.status === 200, 'POST wms product → ' + p.status);
  const pid = p.body.id;
  assert(pid, 'product id returned');
  const w = await req('POST', '/api/wms/warehouses', {
    name: 'انبار تست ' + PREFIX, location: 'تهران', active: true,
  });
  assert(w.status === 201 || w.status === 200, 'POST wms warehouse → ' + w.status);
  const wid = w.body.id;
  assert(wid, 'warehouse id returned');
  const products = await req('GET', '/api/wms/products');
  const prodList = Array.isArray(products.body) ? products.body : [];
  assert(prodList.some(x => x.id === pid), 'product in GET list');
  const pricing = await req('GET', '/api/wms/products/' + pid + '/pricing?buyer_type=hospital');
  assert(pricing.status === 200, 'GET wms product pricing → 200');
  assert(pricing.body.wmsProduct && pricing.body.wmsProduct.id === pid, 'pricing returns wms product');
  const matrix = await req('GET', '/api/wms/pricing/matrix?buyer_type=hospital');
  assert(matrix.status === 200, 'GET wms pricing matrix → 200');
  assert(Array.isArray(matrix.body.products), 'pricing matrix has products array');
  const compare = await req('GET', '/api/wms/pricing/compare?pay_type=d30');
  assert(compare.status === 200, 'GET wms pricing compare → 200');
  assert(Array.isArray(compare.body.products), 'pricing compare has products');
  const hist = await req('GET', '/api/pricing/prices/history');
  assert(hist.status === 200, 'GET pricing history → 200');
  assert(Array.isArray(hist.body), 'pricing history is array');
  const entry = await req('POST', '/api/wms/transactions', {
    type: 'entry', txnType: 'purchase', productId: pid, warehouseId: wid,
    qty: 5, note: 'ورود تست persistence', status: 'approved',
  });
  assert(entry.status === 201, 'POST wms entry → 201 (' + entry.status + ')');
  const txn = await req('POST', '/api/wms/transactions', {
    type: 'exit', txnType: 'internal', productId: pid, warehouseId: wid,
    qty: 1, note: 'تست persistence', status: 'pending',
  });
  assert(txn.status === 201, 'POST wms transaction → 201 (' + txn.status + ')');
  assert(txn.body.id, 'transaction id returned');
  const txns = await req('GET', '/api/wms/transactions?limit=50');
  const list = Array.isArray(txns.body) ? txns.body : (txns.body.rows || []);
  assert(list.some(t => t.id === txn.body.id), 'transaction in GET list');
}

// ─── 8. Letters ────────────────────────────────────────────────────────────
async function testLetters() {
  console.log('\n✉️ 8. Letters');
  const create = await req('POST', '/api/letters', {
    type: 'internal', subject: 'نامه تست ' + PREFIX, body: 'متن تست',
    priority: 'normal', classification: 'normal', status: 'draft',
  });
  assert(create.status === 200 || create.status === 201, 'POST letter → ' + create.status);
  const lid = create.body.letter?.id || create.body.id;
  assert(lid, 'letter id');
  const list = await req('GET', '/api/letters?tab=drafts');
  assert(list.status === 200, 'GET letters → 200');
  const letters = list.body.letters || [];
  assert(letters.some(l => l.id === lid || (l.subject && l.subject.includes(PREFIX))), 'letter in list');
  const upd = await req('PUT', '/api/letters/' + lid, {
    type: 'internal', subject: 'نامه ویرایش ' + PREFIX, body: 'متن ویرایش',
    priority: 'normal', classification: 'normal',
  });
  assert(upd.status === 200, 'PUT letter → 200');
}

// ─── 9. Support ────────────────────────────────────────────────────────────
async function testSupport() {
  console.log('\n🎧 9. Support tickets');
  const create = await req('POST', '/api/support', {
    title: 'تیکت تست ' + PREFIX,
    description: 'شرح مشکل تست',
    priority: 'normal',
    category: 'technical',
  });
  assert(create.status === 201 || create.status === 200, 'POST support → ' + create.status);
  const sid = create.body.id || create.body.ticket?.id;
  assert(sid, 'support ticket id');
  const list = await req('GET', '/api/support');
  assert(list.status === 200, 'GET support → 200');
  const tickets = Array.isArray(list.body) ? list.body : (list.body.tickets || []);
  assert(tickets.some(t => t.id === sid), 'ticket in list');
  const comment = await req('POST', '/api/support/' + sid + '/comment', { body: 'کامنت تست' });
  assert(comment.status === 200 || comment.status === 201, 'POST comment → ' + comment.status);
}

// ─── 10. Changelog ─────────────────────────────────────────────────────────
async function testChangelog() {
  console.log('\n🗃 10. Changelog POST');
  const entry = {
    at: new Date().toISOString(),
    by: 'TEST_MANAGER',
    rkey: 'center_' + PREFIX,
    field: 'status',
    val: 'تست changelog',
  };
  const r = await req('POST', '/api/changelog', entry);
  assert(r.status === 200 || r.status === 201, 'POST changelog → ' + r.status);
  const list = await req('GET', '/api/changelog?limit=10');
  assert(list.status === 200, 'GET changelog → 200');
}

// ─── 11. Settings in DB ────────────────────────────────────────────────────
async function testSettingsKv() {
  console.log('\n⚙️ 11. Settings KV persistence');
  const get = await req('GET', '/api/data/db');
  const db = get.body;
  db.settings = db.settings || {};
  db.settings['_test_' + PREFIX] = { saved: true, at: Date.now() };
  const put = await req('PUT', '/api/data/db', {
    settings: db.settings,
    _clientTs: db._serverTs,
  });
  assert(put.status === 200, 'PUT settings in db → 200');
  const get2 = await req('GET', '/api/data/db');
  assert(get2.body.settings && get2.body.settings['_test_' + PREFIX], 'settings key persisted');
}

// ─── 12. Center pricing modal API ───────────────────────────────────────────
async function testCenterPricing() {
  console.log('\n💰 12. Center pricing list (profile modal)');
  const key = 'center_' + PREFIX;
  const r = await req('GET', '/api/pricing/center/' + encodeURIComponent(key) + '/prices?pay_type=d30&qty=1');
  assert(r.status === 200, 'GET center prices → 200');
  assert(r.body.buyer_type, 'center prices has buyer_type');
  assert(Array.isArray(r.body.products), 'center prices has products array');
}

// ─── Runner ────────────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Flow CRM — Persistence Tests (port ' + TEST_PORT + ')');
  console.log('════════════════════════════════════════════════════════');

  serverProc = spawn('node', ['server/index.js'], {
    env: Object.assign({}, process.env, { PORT: String(TEST_PORT) }),
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stderr.on('data', d => process.stderr.write('  [srv-err] ' + d.toString().trim() + '\n'));

  let exitCode = 0;
  try {
    process.stdout.write('  در انتظار آماده شدن سرور');
    await waitForServer(20000);
    console.log('... آماده\n');

    await setup();
    await authReady();

    await testDbBlob();
    await testDbPatch();
    await testCentersPatch();
    await testCenterInteractions();
    await testCalendarEvents();
    await testChecklistApi();
    await testActivityLog();
    await testKpiData();
    await testTagsApi();
    await testMissionLog();
    await testTasks();
    await testTasksInDb();
    await testWeekEntries();
    await testNotifications();
    await testNotifPrefsAndInbox();
    await testProforma();
    await testWms();
    await testLetters();
    await testSupport();
    await testChangelog();
    await testSettingsKv();
    await testCenterPricing();
  } catch (e) {
    console.error('\n❌ Fatal:', e.message);
    failed++;
  } finally {
    try { await teardown(); } catch (e) { console.error('  ⚠ teardown:', e.message); }
    if (serverProc) { try { serverProc.kill(); } catch {} }
    await pool.end().catch(() => {});

    console.log('\n' + '═'.repeat(56));
    console.log('  ✅ Passed: ' + passed + '   ❌ Failed: ' + failed);
    console.log('═'.repeat(56));
    exitCode = failed > 0 ? 1 : 0;
    setTimeout(() => process.exit(exitCode), 200);
  }
}

main();

'use strict';

/**
 * Persistence integration tests — every major write endpoint:
 * CREATE → GET verify → UPDATE → GET verify → cleanup
 *
 * Usage: node tests/persistence.test.js
 * Requires: PostgreSQL + server on PORT (default 3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.TEST_PORT || process.env.PORT || '3000', 10);
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let cookie = '';
const PREFIX = '_persist_' + Date.now();

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

function req(method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined && body !== null && !(body instanceof Buffer)
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
    if (cookie) headers.Cookie = cookie;
    if (bodyStr && !(body instanceof Buffer)) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    } else if (body instanceof Buffer) {
      headers['Content-Length'] = body.length;
      if (!(extraHeaders && extraHeaders['Content-Type'])) {
        delete headers['Content-Type'];
      }
    }
    const r = http.request(
      { hostname: 'localhost', port: PORT, path: urlPath, method, headers },
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

async function login() {
  const r = await req('POST', '/api/auth/login', {
    username: 'Sarah.hosseini',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  assert(r.status === 200, 'login → 200');
  const setCookie = r.headers['set-cookie'];
  if (setCookie) cookie = setCookie.map(c => c.split(';')[0]).join('; ');
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
  db.edits[key] = { status: 'تماس گرفته شد', owner: 'Sarah.hosseini', _ts: Date.now() };
  db.notes = db.notes || {};
  db.notes[key] = [{ text: 'یادداشت تست persistence', by: 'Sarah.hosseini', date: '1404/01/01' }];
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

// ─── 2. PATCH partial ──────────────────────────────────────────────────────
async function testDbPatch() {
  console.log('\n📦 2. PATCH /api/data/patch — partial persistence');
  const get = await req('GET', '/api/data/db');
  const key = 'pc_' + PREFIX + '||1';
  const patch = {
    _clientTs: get.body._serverTs,
    edits: { [key]: { status: 'پیشنهاد', followupDate: '1404/04/15' } },
    weekEntries: {
      ['1404w01:::' + key]: {
        rtype: 'pc', rid: PREFIX + '||1', scheduledDate: '1404/04/10',
        actionType: 'call', done: false, addedBy: 'Sarah.hosseini',
      },
    },
  };
  const r = await req('PATCH', '/api/data/patch', patch);
  assert(r.status === 200, 'PATCH → 200 (' + r.status + ')');
  const get2 = await req('GET', '/api/data/db');
  const weKey = '1404w01:::' + key;
  assert(get2.body.edits && get2.body.edits[key], 'patch edit in db');
  assert(get2.body.weekEntries && get2.body.weekEntries[weKey], 'patch weekEntry in db');
}

// ─── 3. Tasks SQL ──────────────────────────────────────────────────────────
async function testTasks() {
  console.log('\n📌 3. Tasks SQL API');
  const tid = 'tk_' + PREFIX;
  const create = await req('POST', '/api/tasks', {
    id: tid, title: 'وظیفه تست persistence', owner: 'Sarah.hosseini',
    dueDate: '1404/04/20', priority: 2, status: 'todo', createdBy: 'Sarah.hosseini',
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
    addedBy: 'Sarah.hosseini',
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
    to: 'Sarah.hosseini',
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
  const list = await req('GET', '/api/notifications');
  assert(list.status === 200, 'GET notifications → 200');
  const found = (list.body || []).some(n => n.id === returnedId || (n.msg && n.msg.includes(PREFIX)));
  assert(found, 'notification in list');
  await req('PUT', '/api/notifications/' + returnedId + '/read');
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
    by: 'Sarah.hosseini',
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
  console.log('  Flow CRM — Persistence Tests (port ' + PORT + ')');
  console.log('════════════════════════════════════════════════════════');

  try {
    const health = await req('GET', '/api/health');
    if (health.status !== 200) throw new Error('Server not healthy on port ' + PORT);
    await login();

    await testDbBlob();
    await testDbPatch();
    await testTasks();
    await testTasksInDb();
    await testWeekEntries();
    await testNotifications();
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
  }

  console.log('\n' + '═'.repeat(56));
  console.log('  ✅ Passed: ' + passed + '   ❌ Failed: ' + failed);
  console.log('═'.repeat(56));
  process.exit(failed > 0 ? 1 : 0);
}

main();

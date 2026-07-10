'use strict';

/**
 * QA Persistence Agent — simulates real user flows and verifies data survives
 * a full DB reload (GET /api/data/db), including concurrent partial saves.
 *
 * Usage:
 *   node tests/qa-persistence-agent.js
 *   node tests/qa-persistence-agent.js --loop 3   # retry up to 3 rounds
 *   npm run test:qa
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3098;
const BASE = 'http://localhost:' + TEST_PORT;
const jwt = require('jsonwebtoken');
const { query, pool } = require('../server/db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';
const TEST_USER = '_qa_agent_user';
const TEST_USER2 = '_qa_agent_user2';
const loopMax = parseInt((process.argv.find(function (a) { return a.startsWith('--loop'); }) || '').split('=')[1] || process.argv[process.argv.indexOf('--loop') + 1] || '1', 10);

let serverProc = null;
let passed = 0;
let failed = 0;
let _originalDB = null;

function token(username, role) {
  return jwt.sign(
    { username, role: role || 'کارشناس فروش', name: 'QA ' + username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function req(method, urlPath, body, tok, cid) {
  return new Promise(function (resolve, reject) {
    const bodyStr = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers.Authorization = 'Bearer ' + tok;
    if (cid) headers['X-Cid'] = cid;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const r = http.request(
      { hostname: 'localhost', port: TEST_PORT, path: urlPath, method, headers },
      function (res) {
        let data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () {
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

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function assert(condition, msg) {
  if (condition) { console.log('  ✅ ' + msg); passed++; return true; }
  console.log('  ❌ ' + msg); failed++; return false;
}

/** Simulate page refresh — reload full DB from server. */
async function refreshDb(tok) {
  const r = await req('GET', '/api/data/db', null, tok);
  if (r.status !== 200) throw new Error('refreshDb failed: ' + r.status);
  return r.body;
}

async function waitForServer(maxMs) {
  const deadline = Date.now() + (maxMs || 20000);
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/health', null, null);
      if (r.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('server not ready');
}

async function setup() {
  for (const u of [TEST_USER, TEST_USER2]) {
    await query(
      `INSERT INTO app_users (username, display_name, role, color, active)
       VALUES ($1, $2, 'کارشناس فروش', '#6366f1', true)
       ON CONFLICT (username) DO UPDATE SET active = true`,
      [u, 'QA Agent ' + u]
    );
  }
  const r = await query("SELECT value FROM app_data WHERE key = 'main'");
  _originalDB = r.rows.length ? r.rows[0].value : null;
}

async function teardown() {
  if (_originalDB !== null) {
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('main', $1, NOW(), '_qa_restore')
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = '_qa_restore'`,
      [JSON.stringify(_originalDB)]
    );
  }
  await query('DELETE FROM app_users WHERE username = ANY($1)', [[TEST_USER, TEST_USER2]]);
  // cleanup test artifacts
  await query("DELETE FROM center_edits WHERE center_key LIKE 'qa_%'");
  await query("DELETE FROM center_notes WHERE center_key LIKE 'qa_%'");
  await query('DELETE FROM call_log WHERE id >= 9900000000000 AND id < 9900000099999');
  await query('DELETE FROM visit_log WHERE id >= 9900000000000 AND id < 9900000099999');
  await query('DELETE FROM sales_log WHERE id >= 9900000000000 AND id < 9900000099999');
  await query('DELETE FROM app_events WHERE id >= 990000000 AND id < 990000999');
  await query("DELETE FROM daily_checklists WHERE username LIKE '_qa_%'");
  await query("DELETE FROM week_entries WHERE key LIKE 'qa_%'");
}

// ─── User-flow scenarios ─────────────────────────────────────────────────────

async function flow_centerPatchSurvivesBulkSave(tok) {
  console.log('\n🔄 Flow: center PATCH → bulk PUT without edits → refresh');
  const key = 'qa_center_' + Date.now();
  const patch = await req('PATCH', '/api/centers/' + encodeURIComponent(key), {
    field: 'status', val: 'فعال', centerName: 'QA Center', oldValue: '',
  }, tok);
  if (!assert(patch.status === 200, 'PATCH center status')) return;

  const put = await req('PUT', '/api/data/db', { settings: {} }, tok);
  assert(put.status === 200, 'residual PUT /db succeeds');

  const get = await req('GET', '/api/centers/' + encodeURIComponent(key), null, tok);
  assert(get.body && get.body.data && get.body.data.status === 'فعال', 'status persisted after refresh');

  await query('DELETE FROM center_edits WHERE center_key = $1', [key]);
}

async function flow_noteAddDelete(tok) {
  console.log('\n🔄 Flow: add note → delete note → refresh');
  const key = 'qa_note_' + Date.now();
  const post = await req('POST', '/api/centers/' + encodeURIComponent(key) + '/notes',
    { text: 'QA test note', date: '1404/01/01' }, tok);
  if (!assert(post.status === 200 && post.body.notes && post.body.notes.length === 1, 'POST note')) return;

  const del = await req('DELETE', '/api/centers/' + encodeURIComponent(key) + '/notes/0', null, tok);
  assert(del.status === 200 && del.body.notes && del.body.notes.length === 0, 'DELETE note');

  const notesR = await query('SELECT notes FROM center_notes WHERE center_key = $1', [key]);
  const notes = notesR.rows.length ? notesR.rows[0].notes : [];
  assert(Array.isArray(notes) && notes.length === 0, 'note gone after refresh');

  await query('DELETE FROM center_notes WHERE center_key = $1', [key]);
}

async function flow_activityLogSurvivesPartialSave(tok) {
  console.log('\n🔄 Flow: activity log POST → partial PUT → refresh');
  const id = 9900000000001;
  const post = await req('POST', '/api/activity-log', {
    type: 'call',
    entry: { id, date: '1404/01/10', userId: TEST_USER, count: 3, note: 'QA call' },
  }, tok);
  if (!assert(post.status === 201, 'POST activity call log')) return;

  const put = await req('PUT', '/api/data/db', { tags: [] }, tok);
  assert(put.status === 200, 'PUT without callLog key');

  const db = await refreshDb(tok);
  const found = (db.callLog || []).some(function (l) { return Number(l.id) === id && l.count === 3; });
  assert(found, 'callLog entry survived partial bulk save');

  await req('DELETE', '/api/activity-log/call/' + id, null, tok);
}

async function flow_concurrentActivityLogs(tok, tok2) {
  console.log('\n🔄 Flow: two users append call logs concurrently');
  const id1 = 9900000000002;
  const id2 = 9900000000003;
  const [p1, p2] = await Promise.all([
    req('POST', '/api/activity-log', { type: 'call', entry: { id: id1, date: '1404/01/11', userId: TEST_USER, count: 1 } }, tok),
    req('POST', '/api/activity-log', { type: 'call', entry: { id: id2, date: '1404/01/11', userId: TEST_USER2, count: 2 } }, tok2),
  ]);
  assert(p1.status === 201 && p2.status === 201, 'both concurrent POSTs succeed');

  const db = await refreshDb(tok);
  const has1 = (db.callLog || []).some(function (l) { return Number(l.id) === id1; });
  const has2 = (db.callLog || []).some(function (l) { return Number(l.id) === id2; });
  assert(has1 && has2, 'both entries present after refresh');

  await req('DELETE', '/api/activity-log/call/' + id1, null, tok);
  await req('DELETE', '/api/activity-log/call/' + id2, null, tok2);
}

async function flow_calendarEvent(tok) {
  console.log('\n🔄 Flow: calendar event upsert → refresh');
  const evId = 990000001;
  const post = await req('POST', '/api/calendar-events', {
    id: evId, title: 'QA Event', desc: 'test', startMs: 1700000000000, allDay: true, color: '#6366f1', owner: TEST_USER,
  }, tok);
  if (!assert(post.status === 200, 'POST calendar event')) return;

  const db = await refreshDb(tok);
  const ev = (db.events || []).find(function (e) { return e.id === evId; });
  assert(ev && ev.title === 'QA Event', 'event persisted after refresh');

  await req('DELETE', '/api/calendar-events/' + evId, null, tok);
}

async function flow_checklist(tok) {
  console.log('\n🔄 Flow: checklist upsert → partial save → refresh');
  const date = '1404/01/20';
  const post = await req('POST', '/api/checklist', {
    date, username: TEST_USER,
    items: [{ id: 1, text: 'QA item', done: true }],
    note: 'QA checklist note',
  }, tok);
  if (!assert(post.status === 200, 'POST checklist')) return;

  await req('PUT', '/api/data/db', { extra: [] }, tok);

  const db = await refreshDb(tok);
  const key = date + '_' + TEST_USER;
  const cl = db.checklist && db.checklist[key];
  assert(cl && cl.note === 'QA checklist note', 'checklist survived partial bulk save');

  await query('DELETE FROM daily_checklists WHERE date = $1 AND username = $2', [date, TEST_USER]);
}

async function flow_weekEntry(tok) {
  console.log('\n🔄 Flow: week entry create → bulk PUT without weekEntries → refresh');
  const weekId = '1404/01/05';
  const entryId = 'qa_entry_' + Date.now();
  const rid = 'qa_' + Date.now();
  const create = await req('POST', '/api/week-entries', {
    id: entryId,
    weekId: weekId,
    recKey: 'center_' + rid,
    rtype: 'center',
    rid: rid,
    scheduledDate: '1404/01/05',
    actionType: 'call',
    centerName: 'QA Week Center',
    addedBy: TEST_USER,
  }, tok);
  if (!assert(create.status === 201 || create.status === 200, 'POST week entry')) return;

  await req('PUT', '/api/data/db', { settings: {} }, tok);

  const list = await req('GET', '/api/week-entries?week_id=' + encodeURIComponent(weekId), null, tok);
  const row = (list.body || []).find(function (r) { return r.id === entryId; });
  assert(row && row.scheduledDate === '1404/01/05', 'week entry survived bulk save without weekEntries');

  await req('DELETE', '/api/week-entries/' + encodeURIComponent(entryId), null, tok);
}

async function flow_missionLog(tok) {
  console.log('\n🔄 Flow: mission log POST → partial PUT → refresh');
  const month = '1404/01';
  const post = await req('POST', '/api/mission-log', {
    userId: TEST_USER, month: month, done: true, note: 'QA mission', id: 9900000000104,
  }, tok);
  if (!assert(post.status === 200, 'POST mission log')) return;
  await req('PUT', '/api/data/db', { settings: {} }, tok);
  const db = await refreshDb(tok);
  const found = (db.missionLog || []).some(function (l) {
    return l.userId === TEST_USER && l.month === month && l.done === true;
  });
  assert(found, 'mission log survived partial bulk save');
  await req('DELETE', '/api/mission-log?userId=' + encodeURIComponent(TEST_USER) + '&month=' + encodeURIComponent(month), null, tok);
}

async function flow_tags(tok, mgrTok) {
  console.log('\n🔄 Flow: global tags PUT → center tag PATCH → refresh');
  const tags = [{ id: 9901, name: 'QA-VIP', color: '#6366f1' }];
  const put = await req('PUT', '/api/tags', tags, mgrTok);
  if (!assert(put.status === 200, 'PUT global tags')) return;
  const centerKey = 'qa_tag_center_' + Date.now();
  const patch = await req('PATCH', '/api/tags/centers/' + encodeURIComponent(centerKey), { tagIds: [9901] }, tok);
  assert(patch.status === 200, 'PATCH center tags');
  await req('PUT', '/api/data/db', {}, tok);
  const db = await refreshDb(tok);
  assert((db.tags || []).some(function (t) { return t.id === 9901; }), 'global tags in refresh');
  assert(db.rTags && db.rTags[centerKey] && db.rTags[centerKey].indexOf(9901) >= 0, 'center tags in refresh');
  await query('DELETE FROM center_tags WHERE center_key = $1', [centerKey]);
  await query("DELETE FROM app_settings WHERE key = 'tagDefinitions'");
}

async function flow_kpiTarget(tok) {
  console.log('\n🔄 Flow: KPI user target POST → refresh');
  const month = '1404/02';
  const post = await req('POST', '/api/kpi-data/user-target', {
    username: TEST_USER, month: month, callsPerDay: 12, visitsPerWeek: 6,
  }, tok);
  if (!assert(post.status === 200, 'POST kpi user target')) return;
  const db = await refreshDb(tok);
  const t = db.kpiTargets && db.kpiTargets[TEST_USER + ':' + month];
  assert(t && t.callsPerDay === 12, 'KPI target persisted');
  await query('DELETE FROM kpi_user_targets WHERE username = $1 AND month = $2', [TEST_USER, month]);
}

async function flow_managerFollowup(mgrTok) {
  console.log('\n🔄 Flow: manager follow-up PUT → partial PUT → refresh');
  const recKey = 'center_qa_mgr_' + Date.now();
  const task = {
    rtype: 'center', id: '1', name: 'QA Mgr Task',
    assignedTo: TEST_USER, note: 'follow up', assignedAt: '1404/01/01',
    done: false, doneAt: '',
  };
  const put = await req('PUT', '/api/manager-followups/' + encodeURIComponent(recKey), task, mgrTok);
  if (!assert(put.status === 200, 'PUT manager followup')) return;
  await req('PUT', '/api/data/db', { settings: {} }, mgrTok);
  const db = await refreshDb(mgrTok);
  assert(db.managerTasks && db.managerTasks[recKey] && db.managerTasks[recKey].note === 'follow up',
    'manager task survived partial bulk save');
  await req('DELETE', '/api/manager-followups/' + encodeURIComponent(recKey), null, mgrTok);
}

async function flow_seededCenterPatch(tok) {
  console.log('\n🔄 Flow: seeded center PATCH → refresh');
  const key = 'center_qa_seed_1';
  await query(
    `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), 'qa_test')
     ON CONFLICT (center_key) DO NOTHING`,
    [key, JSON.stringify({ status: 'فعال', owner: 'Sarah.hosseini' })]
  ).catch(function () {});
  const patch = await req('PATCH', '/api/centers/' + encodeURIComponent(key), {
    field: 'status', val: 'مذاکره', centerName: 'QA Seed', oldValue: 'فعال',
  }, tok);
  if (!assert(patch.status === 200, 'PATCH seeded center')) return;
  const get = await req('GET', '/api/centers/' + encodeURIComponent(key), null, tok);
  assert(get.body && get.body.data && get.body.data.status === 'مذاکره', 'seeded center status persisted');
}

async function runAllFlows() {
  passed = 0;
  failed = 0;
  const tok = token(TEST_USER);
  const tok2 = token(TEST_USER2);
  const mgrTok = jwt.sign(
    { username: '_qa_mgr', role: 'مدیر', name: 'QA Manager' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  await query(
    `INSERT INTO app_users (username, display_name, role, color, active)
     VALUES ('_qa_mgr', 'QA Manager', 'مدیر', '#6366f1', true)
     ON CONFLICT (username) DO UPDATE SET role = 'مدیر', active = true`
  ).catch(function () {});

  await flow_centerPatchSurvivesBulkSave(tok);
  await flow_noteAddDelete(tok);
  await flow_activityLogSurvivesPartialSave(tok);
  await flow_concurrentActivityLogs(tok, tok2);
  await flow_calendarEvent(tok);
  await flow_checklist(tok);
  await flow_weekEntry(tok);
  await flow_missionLog(tok);
  await flow_tags(tok, mgrTok);
  await flow_kpiTarget(tok);
  await flow_managerFollowup(mgrTok);
  await flow_seededCenterPatch(tok);

  await query("DELETE FROM app_users WHERE username = '_qa_mgr'").catch(function () {});

  return failed === 0;
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Flow CRM — QA Persistence Agent');
  console.log('  Port: ' + TEST_PORT + ' | Loop max: ' + loopMax);
  console.log('══════════════════════════════════════════════════════════');

  serverProc = spawn('node', ['server/index.js'], {
    env: Object.assign({}, process.env, { PORT: String(TEST_PORT) }),
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stderr.on('data', function (d) { process.stderr.write('[srv] ' + d.toString()); });

  let exitCode = 1;
  try {
    await waitForServer(25000);
    await setup();

    for (let round = 1; round <= loopMax; round++) {
      if (loopMax > 1) console.log('\n─── Round ' + round + '/' + loopMax + ' ───');
      const ok = await runAllFlows();
      if (ok) {
        console.log('\n✅ All flows passed' + (loopMax > 1 ? ' (round ' + round + ')' : ''));
        exitCode = 0;
        break;
      }
      if (round < loopMax) {
        console.log('\n⚠ Failures detected — retrying...');
        await sleep(500);
      }
    }

    if (exitCode !== 0) {
      console.log('\n❌ QA agent finished with failures after ' + loopMax + ' round(s)');
    }
  } catch (err) {
    console.error('\n❌ QA agent error:', err.message);
    exitCode = 1;
  } finally {
    try { await teardown(); } catch (e) { console.error('teardown:', e.message); }
    if (serverProc) try { serverProc.kill(); } catch {}
    await pool.end().catch(function () {});

    console.log('\n──────────────────────────────────────────────────────────');
    console.log('  Passed: ' + passed + ' | Failed: ' + failed);
    console.log('──────────────────────────────────────────────────────────');
    process.exit(exitCode);
  }
}

main();

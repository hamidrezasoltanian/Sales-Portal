'use strict';

const { mergeNoteArrays } = require('../server/lib/db-merge');
const { resolveCounterpartyFromCenterKey } = require('../server/lib/wms-dispatch');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

console.log('🛡 XSS / merge unit tests');

// esc() mirror (same as core.js)
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripScripts(html) {
  return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

const xss = '<img src=x onerror=alert(1)>';
assert(esc(xss).indexOf('<') === -1, 'esc() neutralizes angle brackets');
assert(stripScripts('<script>alert(1)</script>hi').indexOf('script') === -1, 'stripScripts removes script tags');

const merged = mergeNoteArrays(
  [{ text: 'a', by: 'u1', date: '1' }],
  [{ text: 'b', by: 'u2', date: '2' }]
);
assert(merged.length === 2, 'mergeNoteArrays keeps both notes');
const merged2 = mergeNoteArrays(
  [{ text: 'a', by: 'u1', date: '1' }],
  [{ text: 'a', by: 'u1', date: '1' }, { text: 'b', by: 'u2', date: '2' }]
);
assert(merged2.length === 2, 'mergeNoteArrays dedupes identical notes');

console.log('\n📦 WMS dispatch helpers');
assert(resolveCounterpartyFromCenterKey('center_c_12') === 'center_c_12', 'center key maps to counterparty');
assert(resolveCounterpartyFromCenterKey('pc_tehran||3') === 'pc_tehran||3', 'pc key maps to counterparty');
assert(resolveCounterpartyFromCenterKey('') === null, 'empty key returns null');
assert(resolveCounterpartyFromCenterKey('foo') === null, 'invalid key returns null');

console.log('\n────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);

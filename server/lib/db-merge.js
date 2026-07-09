'use strict';

/** Merge note arrays — dedupe by text+author+date signature. */
function mergeNoteArrays(serverNotes, incomingNotes) {
  const existing = Array.isArray(serverNotes) ? serverNotes : [];
  const incoming = Array.isArray(incomingNotes) ? incomingNotes : [];
  const map = {};
  existing.forEach(function (n) {
    if (!n) return;
    const key = (n.text || '') + ':::' + (n.by || n.user || '') + ':::' + (n.date || n.at || '');
    map[key] = n;
  });
  incoming.forEach(function (n) {
    if (!n) return;
    const key = (n.text || '') + ':::' + (n.by || n.user || '') + ':::' + (n.date || n.at || '');
    map[key] = n;
  });
  return Object.values(map);
}

/** Merge week entry maps — incoming wins per key unless server entry is newer. */
function mergeWeekEntries(serverWE, incomingWE) {
  const out = Object.assign({}, serverWE || {});
  Object.keys(incomingWE || {}).forEach(function (k) {
    const inc = incomingWE[k];
    const srv = out[k];
    if (!srv) {
      out[k] = inc;
      return;
    }
    const incTs = inc && (inc._ts || inc.doneDate || 0);
    const srvTs = srv && (srv._ts || srv.doneDate || 0);
    if (incTs >= srvTs) out[k] = Object.assign({}, srv, inc);
  });
  return out;
}

module.exports = { mergeNoteArrays, mergeWeekEntries };

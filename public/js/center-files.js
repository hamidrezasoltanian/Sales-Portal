/* center-files.js — document attachments per center */
function _cfCenterKey(rtype, rid) { return rtype + '_' + rid; }

function _cfLoadSection(rtype, rid, domId) {
  var ck = _cfCenterKey(rtype, rid);
  var el = document.getElementById('cmFiles_' + domId);
  if (!el) return;
  fetch('/api/center-files/list/' + encodeURIComponent(ck))
    .then(function (r) { return r.ok ? r.json() : { files: [] }; })
    .then(function (d) { _cfRenderList(el, ck, d.files || [], domId); })
    .catch(function () { el.innerHTML = '<span style="color:#ef4444;font-size:11px">خطا در بارگذاری فایل‌ها</span>'; });
}

function _cfRenderList(el, ck, files, domId) {
  var rows = files.map(function (f) {
    var sz = f.file_size > 1048576 ? (f.file_size / 1048576).toFixed(1) + ' MB' : Math.round(f.file_size / 1024) + ' KB';
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px">'
      + '<a href="/api/center-files/' + f.id + '" target="_blank" style="flex:1;color:#0369a1;text-decoration:none">📎 ' + esc(f.filename) + '</a>'
      + '<span style="color:var(--text-muted);font-size:10px">' + sz + '</span>'
      + '<button onclick="_cfDelete(' + f.id + ',\'' + ck + '\',\'' + domId + '\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:10px">✕</button>'
      + '</div>';
  }).join('');
  el.innerHTML = (rows || '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">فایلی پیوست نشده</div>')
    + '<label style="display:inline-block;margin-top:8px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:600">'
    + '📤 آپلود فایل<input type="file" multiple style="display:none" onchange="_cfUpload(this,\'' + ck + '\',\'' + domId + '\')"></label>';
}

function _cfUpload(inp, ck, domId) {
  if (!inp.files || !inp.files.length) return;
  var fd = new FormData();
  for (var i = 0; i < inp.files.length; i++) fd.append('files', inp.files[i]);
  fetch('/api/center-files/upload/' + encodeURIComponent(ck), { method: 'POST', body: fd })
    .then(function (r) { return r.json(); })
    .then(function () {
      inp.value = '';
      var parts = ck.split('_');
      var rtype = parts[0];
      var rid = parts.slice(1).join('_');
      _cfLoadSection(rtype, rid, domId);
      showToast('✅ فایل آپلود شد', 2000);
    })
    .catch(function () { showToast('⚠ خطا در آپلود'); });
}

function _cfDelete(id, ck, domId) {
  if (!confirm('فایل حذف شود؟')) return;
  fetch('/api/center-files/' + id, { method: 'DELETE' }).then(function () {
    var parts = ck.split('_');
    _cfLoadSection(parts[0], parts.slice(1).join('_'), domId);
  });
}

// KOL center keys cache for list badges
window._kolCenterKeys = window._kolCenterKeys || null;
function loadKolCenterKeys(cb) {
  if (window._kolCenterKeys) { if (cb) cb(window._kolCenterKeys); return; }
  fetch('/api/hcps/kol-centers')
    .then(function (r) { return r.ok ? r.json() : { keys: [] }; })
    .then(function (d) {
      window._kolCenterKeys = {};
      (d.keys || []).forEach(function (k) { window._kolCenterKeys[k] = true; });
      if (cb) cb(window._kolCenterKeys);
    })
    .catch(function () { window._kolCenterKeys = {}; if (cb) cb({}); });
}

function centerHasKol(rtype, id) {
  if (!window._kolCenterKeys) return false;
  return !!window._kolCenterKeys[rtype + '_' + id];
}

/* Global search (Ctrl+K) + quick search — loaded eagerly for header buttons */
var _gSearchSel = 0;

function _gsAllowedProvIds() {
  return (window._myPermissions && window._myPermissions.provinces && window._myPermissions.provinces.length)
    ? window._myPermissions.provinces : null;
}

function _gsProvId(rtype, id) {
  if (rtype === 'center') return 'tehran';
  var s = String(id || '');
  var i = s.indexOf('||');
  return i > 0 ? s.slice(0, i) : '';
}

function _gsPassAccess(rtype, id) {
  var provId = _gsProvId(rtype, id);
  var allowed = _gsAllowedProvIds();
  if (allowed && provId && allowed.indexOf(provId) < 0) return false;
  return true;
}

/** Searchable text for a center (name, override, address, contacts, …) */
function _gsCenterHaystack(rtype, id, rawName) {
  var e = getE(rtype, id) || {};
  var parts = [
    typeof _getCenterName === 'function' ? _getCenterName(rtype, id) : rawName,
    rawName,
    e.nameOverride,
    e.name,
    e.address,
    e.status,
    e.competitor,
    e.type,
    e.lead,
  ];
  if (Array.isArray(e.competitors)) parts = parts.concat(e.competitors);
  if (Array.isArray(e.contacts)) {
    e.contacts.forEach(function (ct) {
      if (!ct) return;
      parts.push(ct.name, ct.title, (ct.phones || []).join(' '));
    });
  }
  var cacheKey = rtype + '|' + id; var cache = window._gsHaystackCache || (window._gsHaystackCache = Object.create(null)); if (cache[cacheKey]) return cache[cacheKey]; return (cache[cacheKey] = fNorm(parts.filter(Boolean).join(' ')));
}

function _gsScoreMatch(qn, hay, displayName) {
  var tokens = qn.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.some(function (t) { return hay.indexOf(t) < 0; })) return 0;
  var nd = fNorm(String(displayName || ""));
  if (nd === qn) return 120;
  if (nd.indexOf(qn) === 0) return 105;
  if (nd.indexOf(qn) >= 0) return 90;
  var inName = tokens.filter(function (t) { return nd.indexOf(t) >= 0; }).length;
  return 45 + Math.min(30, inName * 10);
}

function _gsIsInMaster(rtype, id) {
  var sid = String(id);
  if (rtype === 'center') {
    return (CENTERS || []).some(function (c) { return String(c.id) === sid; });
  }
  var pid = sid.split('||')[0];
  if (typeof _buildPCCache === 'function') _buildPCCache();
  return ((_PC_CACHE && _PC_CACHE[pid]) || []).some(function (c) { return String(c.id) === sid; });
}

/**
 * Collect center hits across master + extra + orphan edits.
 * @returns {Array<{score,icon,title,sub,rtype,id,centerKey}>}
 */
function _gsCollectCenterHits(q, maxN) {
  maxN = maxN || 80;
  var qn = fNorm((q || '').trim());
  if (!qn) return [];

  if (typeof _buildPCCache === 'function') _buildPCCache();

  var hits = [];
  var seen = new Set();

  function addHit(rtype, id, rawName, icon, provLabel, centerKey) {
    var sk = (centerKey || (rtype + '_' + id));
    if (seen.has(sk)) return;
    if (!_gsPassAccess(rtype, id)) return;

    var hay = _gsCenterHaystack(rtype, id, rawName);
    var display = typeof _getCenterName === 'function' ? _getCenterName(rtype, id) : (rawName || id);
    var score = _gsScoreMatch(qn, hay, display);
    if (score <= 0) return;

    seen.add(sk);
    var e = getE(rtype, id) || {};
    hits.push({
      score: score,
      icon: icon || (rtype === 'center' ? '🏥' : '🏢'),
      title: display,
      sub: e.status || provLabel || (centerKey && ! _gsIsInMaster(rtype, id) ? 'داده CRM (بدون ردیف لیست)' : 'بدون تماس'),
      rtype: rtype,
      id: id,
      centerKey: centerKey || (typeof recK === 'function' ? recK(rtype, id) : rtype + '_' + id),
    });
  }

  (CENTERS || []).forEach(function (c) {
    addHit('center', c.id, c.name, '🏥', 'تهران');
  });

  Object.keys(_PC_CACHE || {}).forEach(function (pv) {
    if (pv === 'tehran') return;
    var prov = (typeof PROVINCES !== 'undefined' ? PROVINCES : []).find(function (p) { return p.id === pv; });
    var plabel = prov ? prov.name : pv;
    (_PC_CACHE[pv] || []).forEach(function (c) {
      addHit('pc', c.id, c.name, '🏢', plabel);
    });
  });

  var mainCIds = new Set((CENTERS || []).map(function (c) { return String(c.id); }));
  (DB.extra || []).forEach(function (c) {
    var rt = c.province_id === 'tehran' ? 'center' : 'pc';
    if (rt === 'center' && mainCIds.has(String(c.id))) return;
    addHit(rt, c.id, c.name, '➕', c.province_id || 'اضافه‌شده');
  });

  // Orphan center_edits (import میزیتو / کلید قدیمی) — searchable by address etc.
  Object.keys(DB.edits || {}).forEach(function (key) {
    if (seen.has(key)) return;
    if (!key.startsWith('center_') && !key.startsWith('pc_')) return;
    if (/^pc_p\d+$/.test(key) || key === 'center_tehran') return;
    var e = DB.edits[key] || {};
    if (e._archived || e._mergedInto) return;

    var rt = key.startsWith('center_') ? 'center' : 'pc';
    var cid = key.slice(rt.length + 1);
    if (_gsIsInMaster(rt, cid)) return;

    var raw = e.nameOverride || e.name || (e.address ? String(e.address).split(/[\n,،]/)[0] : '') || cid;
    addHit(rt, cid, raw, '🔗', 'orphan', key);
  });

  hits.sort(function (a, b) { return b.score - a.score; });
  return hits.slice(0, maxN);
}

function _gsOpenCenterHit(hit) {
  if (!hit) return;
  if (typeof openCenterModal === 'function') {
    openCenterModal(hit.rtype, hit.id, hit.centerKey);
  }
}

function openGSearch() {
  window._gsHaystackCache = Object.create(null);
  document.getElementById('gSearchOverlay').classList.add('open');
  setTimeout(function () {
    var el = document.getElementById('gSearchInput');
    if (el) { el.value = ''; el.focus(); }
    gSearchQuery('');
  }, 50);
}

function closeGSearch() { document.getElementById('gSearchOverlay').classList.remove('open'); }

function gSearchQuery(q) {
  q = (q || '').trim();
  var res = [];

  if (q.length >= 1) {
    _gsCollectCenterHits(q, 70).forEach(function (h) {
      var rt = h.rtype;
      var cid = h.id;
      var ck = h.centerKey;
      res.push({
        icon: h.icon,
        title: esc(h.title),
        sub: esc(h.sub),
        action: (function (_rt, _cid, _ck) {
          return function () {
            closeGSearch();
            if (typeof openCenterModal === 'function') openCenterModal(_rt, _cid, _ck);
          };
        })(rt, cid, ck),
      });
    });

    var qn = fNorm(q);
    (DB.events || []).forEach(function (ev) {
      if (!ev || !ev.title || res.length >= 90) return;
      if (_gsScoreMatch(qn, fNorm(ev.title), ev.title) > 0) {
        res.push({
          icon: '🗓',
          title: esc(ev.title),
          sub: esc(ev.date || ''),
          action: function () { closeGSearch(); switchTab('calendar'); },
        });
      }
    });
    (PROVINCES || []).forEach(function (p) {
      if (res.length >= 100) return;
      var pn = p.name || p.n || '';
      if (_gsScoreMatch(qn, fNorm(pn), pn) > 0) {
        var pid = p.id;
        res.push({
          icon: '🗺',
          title: esc(pn),
          sub: 'استان',
          action: function () { closeGSearch(); switchTab('provinces'); openProvince(pid); },
        });
      }
    });
  }

  _gSearchSel = 0;
  var el = document.getElementById('gSearchResults');
  if (!el) return;
  if (!res.length) {
    el.innerHTML = '<div class="gs-empty">' + (q ? 'نتیجه‌ای یافت نشد' : 'برای جستجو تایپ کنید…') + '</div>';
    el._results = [];
    return;
  }
  el.innerHTML = res.map(function (r, i) {
    return '<div class="gs-item' + (i === 0 ? ' gs-sel' : '') + '" data-idx="' + i + '" onmouseenter="gSearchHover(' + i + ')" onclick="gSearchExec(' + i + ')">'
      + '<span class="gs-icon">' + r.icon + '</span>'
      + '<div class="gs-main"><div class="gs-title">' + r.title + '</div>' + (r.sub ? '<div class="gs-sub">' + r.sub + '</div>' : '') + '</div>'
      + '</div>';
  }).join('');
  el._results = res;
}

function gSearchHover(i) {
  _gSearchSel = i;
  var items = document.querySelectorAll('.gs-item');
  items.forEach(function (el, j) { el.classList.toggle('gs-sel', j === i); });
}

function gSearchExec(i) {
  var el = document.getElementById('gSearchResults');
  if (!el || !el._results) return;
  var r = el._results[i];
  if (r && r.action) r.action();
}

function gSearchKey(e) {
  var el = document.getElementById('gSearchResults');
  var items = el ? el.querySelectorAll('.gs-item') : [];
  if (e.key === 'ArrowDown') { e.preventDefault(); _gSearchSel = Math.min(_gSearchSel + 1, items.length - 1); gSearchHover(_gSearchSel); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _gSearchSel = Math.max(_gSearchSel - 1, 0); gSearchHover(_gSearchSel); }
  else if (e.key === 'Enter') { e.preventDefault(); gSearchExec(_gSearchSel); }
  else if (e.key === 'Escape') { closeGSearch(); }
}

// ════════════════════════ QUICK SEARCH ═══════════════
function openQS() {
  window._gsHaystackCache = Object.create(null);
  var o = document.getElementById('qsOverlay');
  if (o) { o.style.display = 'flex'; setTimeout(function () { var i = document.getElementById('qsInput'); if (i) { i.focus(); i.select(); } }, 60); }
}

function closeQS() {
  var o = document.getElementById('qsOverlay');
  if (o) o.style.display = 'none';
  var i = document.getElementById('qsInput'); if (i) i.value = '';
  var r = document.getElementById('qsResults');
  if (r) r.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">برای جستجو تایپ کنید (Ctrl+K برای باز کردن)</div>';
}

function qsSearch(q) {
  var r = document.getElementById('qsResults');
  if (!r) return;
  if (!q || q.length < 2) {
    r.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">حداقل ۲ حرف وارد کنید</div>';
    return;
  }

  var results = [];
  _gsCollectCenterHits(q, 90).forEach(function (h) {
    var _rt = h.rtype;
    var _id = String(h.id).replace(/'/g, "\\'");
    var _ck = (h.centerKey || '').replace(/'/g, "\\'");
    var typeLabel = h.icon === '➕' ? 'مرکز اضافه‌شده' : (h.icon === '🔗' ? 'داده CRM' : (_rt === 'center' ? 'مرکز تهران' : 'مرکز استانی'));
    results.push({
      type: typeLabel,
      icon: h.icon,
      name: h.title,
      sub: h.sub,
      action: "openCenterModal('" + _rt + "','" + _id + "','" + _ck + "');closeQS()",
    });
  });

  var qn = fNorm(q);
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    var we = DB.weekEntries[k];
    var nm = we.centerName || we.mtrCustomer || '';
    if (nm && _gsScoreMatch(qn, fNorm(nm), nm) > 0) {
      results.push({ type: 'برنامه هفته', icon: '📅', name: nm, sub: we.scheduledDate || 'بدون تاریخ', action: "switchTab('weekplan');closeQS()" });
    }
  });
  Object.keys(DB.notes || {}).forEach(function (k) {
    (DB.notes[k] || []).forEach(function (n) {
      if (!n || !n.text) return;
      if (_gsScoreMatch(qn, fNorm(n.text), n.text) > 0) {
        results.push({
          type: 'یادداشت',
          icon: '📝',
          name: n.text.substring(0, 70) + (n.text.length > 70 ? '…' : ''),
          sub: k,
          action: 'closeQS()',
        });
      }
    });
  });

  if (!results.length) {
    r.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">نتیجه‌ای یافت نشد</div>';
    return;
  }
  r.innerHTML = results.slice(0, 80).map(function (item) {
    return '<div onclick="' + item.action + '" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;cursor:pointer;transition:.15s" onmouseover="this.style.background=\'var(--bg-raised)\'" onmouseout="this.style.background=\'\'">'
      + '<span style="font-size:18px">' + item.icon + '</span>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.name) + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted)">' + esc(item.type) + (item.sub ? ' — ' + esc(item.sub) : '') + '</div>'
      + '</div></div>';
  }).join('') + (results.length > 80 ? '<div style="text-align:center;padding:8px;font-size:11px;color:var(--text-muted)">... و ' + (results.length - 80) + ' نتیجه دیگر</div>' : '');
}

/* faradis-match.js — Faradis CRM center matching UI
   Renders into #faradisMatchPanel via renderFaradisMatchPanel()
   All text Persian, RTL layout, no external deps */
'use strict';

(function() {

var _fmState = {
  tab: 'pending',        // 'pending' | 'approved' | 'search'
  suggestions: [],       // current page of suggestions
  currentIdx: 0,         // index in suggestions array
  selectedSugIdx: 0,     // which suggestion is selected for current center
  centerOffset: 0,       // track center-level pagination
  hasMore: true,         // whether more center batches exist
  totalUnlinked: 0,      // total unlinked count
  loading: false,
  status: null,          // {customers_cached, total_links, pending_estimate}
  links: [],             // approved links
  linksTotal: 0,
  linksOffset: 0,
  searchResults: [],
  searchQ: '',
};

// ── Entry point ───────────────────────────────────────────────────────────

window.renderFaradisMatchPanel = function() {
  var el = document.getElementById('faradisMatchPanel');
  if (!el) return;
  el.innerHTML = _fmBuildShell();
  _fmSyncCRMCenters();  // push frontend center list to backend cache
  _fmLoadStatus();
  _fmSwitchTab(_fmState.tab);
};

// ── Sync CRM centers from frontend to backend ─────────────────────────────

function _fmSyncCRMCenters() {
  try {
    var centers = [];
    // Collect all provinces and their centers
    if (typeof getAllProvinces === 'function') {
      var provs = getAllProvinces();
      provs.forEach(function(prov) {
        if (!prov || !prov.id) return;
        var provCenters = [];
        if (typeof getProvCenters === 'function') {
          provCenters = getProvCenters(prov.id) || [];
        }
        provCenters.forEach(function(c) {
          if (!c) return;
          var key = c.key || c.id;
          var name = c.name || c.n || '';
          if (!key || !name) return;
          centers.push({ key: String(key), name: String(name) });
        });
      });
    }
    // Also try window._CENTERS (Tehran master list)
    if (typeof window._CENTERS !== 'undefined' && Array.isArray(window._CENTERS)) {
      window._CENTERS.forEach(function(c) {
        if (!c) return;
        var id = c.id || c.key;
        var name = c.name || c.n || '';
        if (!id || !name) return;
        var key = String(id).startsWith('c_') ? String(id) : 'c_' + String(id);
        centers.push({ key: key, name: String(name) });
      });
    }
    if (centers.length === 0) return;
    fetch('/api/faradis-match/sync-crm-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centers: centers }),
    }).catch(function(){});  // fire-and-forget, ignore errors
  } catch (e) {
    // non-critical, ignore
  }
}

// ── Shell HTML ────────────────────────────────────────────────────────────

function _fmBuildShell() {
  return '<div style="max-width:900px;margin:0 auto;font-family:Vazirmatn,sans-serif">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'
    +   '<h2 style="margin:0;font-size:18px;color:var(--text-primary)">🔗 تطبیق مراکز CRM ↔ فرادیس</h2>'
    +   '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    +     '<button id="fmSyncBtn" onclick="window._fmDoSync()" style="'
    +       'padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;'
    +       'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 دریافت مشتریان فرادیس</button>'
    +     '<button id="fdSyncAllBtn" onclick="window._fdSyncAll()" style="'
    +       'padding:6px 14px;border-radius:7px;border:none;background:#374151;color:#fff;'
    +       'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 Sync همه</button>'
    +     '<button id="fmSyncFactorsBtn" onclick="window._fmDoSyncFactors()" style="'
    +       'padding:6px 14px;border-radius:7px;border:none;background:#059669;color:#fff;'
    +       'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">📊 دریافت فاکتورها</button>'
    +     '<button onclick="window._fdSyncAll && window._fdSyncAll()" style="'
    +       'padding:6px 14px;border-radius:7px;border:none;background:#7c3aed;color:#fff;'
    +       'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 Sync همه</button>'
    +     '<div id="fmStatusBar" style="font-size:12px;color:var(--text-muted)">در حال بارگذاری…</div>'
    +   '</div>'
    + '</div>'
    + '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;flex-wrap:wrap">'
    +   _fmTabBtn('pending','⏳ در انتظار')
    +   _fmTabBtn('approved','✅ تایید شده')
    +   _fmTabBtn('search','🔍 جستجو')
    +   _fmTabBtn('team','👥 تیم فروش')
    +   _fmTabBtn('inventory','📦 موجودی')
    +   _fmTabBtn('mapping','🗺 نگاشت')
    +   _fmTabBtn('receivables','💰 مطالبات')
    + '</div>'
    + '<div id="fmTabContent"></div>'
    + '</div>';
}

function _fmTabBtn(tab, label) {
  var active = _fmState.tab === tab;
  return '<button onclick="window._fmSwitchTab(\'' + tab + '\')" id="fmTabBtn_' + tab + '" style="'
    + 'padding:8px 18px;border:none;border-bottom:' + (active ? '2px solid #6366f1' : '2px solid transparent') + ';'
    + 'background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:' + (active ? '700' : '400') + ';'
    + 'color:' + (active ? '#6366f1' : 'var(--text-secondary)') + ';margin-bottom:-2px">'
    + label + '</button>';
}

// ── Tab switching ─────────────────────────────────────────────────────────

window._fmSwitchTab = _fmSwitchTab;
function _fmSwitchTab(tab) {
  _fmState.tab = tab;
  // Update tab button styles
  ['pending','approved','search','team','inventory','mapping','receivables'].forEach(function(t) {
    var btn = document.getElementById('fmTabBtn_' + t);
    if (!btn) return;
    var active = t === tab;
    btn.style.borderBottom = active ? '2px solid #6366f1' : '2px solid transparent';
    btn.style.fontWeight = active ? '700' : '400';
    btn.style.color = active ? '#6366f1' : 'var(--text-secondary)';
  });
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  if (tab === 'pending') {
    _fmState.centerOffset = 0;
    _fmState.hasMore = true;
    _fmState.currentIdx = 0;
    _fmState.selectedSugIdx = 0;
    _fmState.suggestions = [];
    _fmLoadSuggestions();
  } else if (tab === 'approved') {
    _fmState.linksOffset = 0;
    _fmState.links = [];
    _fmLoadLinks();
  } else if (tab === 'search') {
    _fmRenderSearch();
  } else if (tab === 'team') {
    content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">در حال بارگذاری...</div>';
    if (typeof window.renderFdTeamSales === 'function') {
      window.renderFdTeamSales('fmTabContent');
    } else {
      content.innerHTML = '<div style="padding:20px;color:#ef4444">ماژول faradis-data.js بارگذاری نشده</div>';
    }
  } else if (tab === 'inventory') {
    content.innerHTML = '<div style="margin-bottom:12px;display:flex;gap:8px">'
      + '<button onclick="window._fdSyncInventory && window._fdSyncInventory()" style="padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">🔄 Sync موجودی فرادیس</button>'
      + '<button onclick="window._fdSyncStuffs && window._fdSyncStuffs()" style="padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">🔄 Sync محصولات</button>'
      + '</div><div id="fdInventoryContainer"></div>';
    if (typeof window.renderFdInventory === 'function') {
      window.renderFdInventory('fdInventoryContainer');
    } else {
      document.getElementById('fdInventoryContainer').innerHTML = '<div style="padding:20px;color:#ef4444">ماژول faradis-data.js بارگذاری نشده</div>';
    }
  } else if (tab === 'mapping') {
    content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">در حال بارگذاری...</div>';
    if (typeof window.renderFdFollowers === 'function') {
      window.renderFdFollowers('fmTabContent');
    } else {
      content.innerHTML = '<div style="padding:20px;color:#ef4444">ماژول faradis-data.js بارگذاری نشده</div>';
    }
  } else if (tab === 'receivables') {
    content.innerHTML = '<div style="margin-bottom:12px;display:flex;gap:8px">'
      + '<button onclick="window._fdSyncReceivables && window._fdSyncReceivables()" style="padding:6px 14px;border-radius:7px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">🔄 Sync مطالبات</button>'
      + '</div><div id="fdReceivablesContainer"></div>';
    if (typeof window.renderFdReceivables === 'function') {
      window.renderFdReceivables('fdReceivablesContainer');
    }
  }
}

// ── Status bar ────────────────────────────────────────────────────────────

function _fmLoadStatus() {
  fetch('/api/faradis-match/status')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      _fmState.status = d;
      var bar = document.getElementById('fmStatusBar');
      if (!bar) return;
      if (d.error) { bar.textContent = 'خطا: ' + d.error; return; }
      var linked = d.total_links || 0;
      var total = (d.total_links || 0) + (d.pending_estimate || 0);
      var pct = total > 0 ? Math.round(linked / total * 100) : 0;
      bar.innerHTML = '<span style="font-weight:600;color:#6366f1">' + linked + '</span>'
        + '<span style="color:var(--text-muted)">/' + total + ' تطبیق</span>'
        + ' <span style="color:var(--text-muted);font-size:11px">(' + pct + '%)</span>'
        + ' | مشتریان فرادیس: <span style="font-weight:600">' + (d.customers_cached || 0) + '</span>'
        + ' | فاکتورها: <span style="font-weight:600">' + (d.factors_cached || 0) + '</span>';
    })
    .catch(function(e) {
      var bar = document.getElementById('fmStatusBar');
      if (bar) bar.textContent = 'خطا در بارگذاری وضعیت';
    });
}

// ── Sync customers from Faradis ───────────────────────────────────────────

window._fmDoSync = function() {
  var btn = document.getElementById('fmSyncBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال دریافت…'; }
  fetch('/api/faradis-match/sync-customers', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 دریافت مشتریان فرادیس'; }
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 4000); return; }
      if (typeof showToast === 'function') showToast('✅ ' + d.count + ' مشتری از فرادیس دریافت شد');
      _fmLoadStatus();
      if (_fmState.tab === 'pending') {
        _fmState.centerOffset = 0;
        _fmState.hasMore = true;
        _fmState.currentIdx = 0;
        _fmState.selectedSugIdx = 0;
        _fmState.suggestions = [];
        _fmLoadSuggestions();
      }
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 دریافت مشتریان فرادیس'; }
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 4000);
    });
};

// ── Suggestions / pending tab ─────────────────────────────────────────────

function _fmLoadSuggestions() {
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  if (_fmState.loading) return;
  _fmState.loading = true;
  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ در حال بارگذاری پیشنهادات…</div>';
  fetch('/api/faradis-match/suggestions?center_offset=' + _fmState.centerOffset + '&batch_size=100')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      _fmState.loading = false;
      if (data.error) {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444">خطا: ' + _fmEsc(data.error) + '</div>';
        return;
      }
      var results = data.results || [];
      _fmState.hasMore = data.has_more || false;
      _fmState.totalUnlinked = data.total_unlinked || 0;
      if (results.length > 0) {
        _fmState.centerOffset = data.next_center_offset || (_fmState.centerOffset + 100);
      }
      _fmState.suggestions = results;
      _fmState.currentIdx = 0;
      _fmState.selectedSugIdx = 0;
      _fmRenderPending();
    })
    .catch(function(e) {
      _fmState.loading = false;
      if (content) content.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444">خطا: ' + e.message + '</div>';
    });
}

function _fmRenderPending() {
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  var sugs = _fmState.suggestions;

  // Empty: show "all done" or auto-load next batch
  if (!sugs || sugs.length === 0) {
    if (_fmState.hasMore) {
      // Auto-advance to next batch of centers
      _fmLoadSuggestions();
      return;
    }
    content.innerHTML = '<div style="text-align:center;padding:60px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">🎉</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">همه مراکز بررسی شدند!</div>'
      + '<div style="font-size:13px;color:var(--text-muted)">مراکز بیشتری برای تطبیق وجود ندارد.</div>'
      + '<button onclick="window._fmRestart()" style="margin-top:16px;padding:8px 20px;border-radius:7px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:13px">🔄 شروع مجدد</button>'
      + '</div>';
    return;
  }
  var idx = _fmState.currentIdx;
  if (idx >= sugs.length) {
    // Current batch exhausted, load next batch
    _fmLoadSuggestions();
    return;
  }
  var item = sugs[idx];
  var sug = item.suggestions[_fmState.selectedSugIdx] || item.suggestions[0];
  var total = sugs.length;

  var html = '<div style="margin-bottom:12px;font-size:12px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">'
    + '<span>مرکز ' + (idx + 1) + ' از ' + total + '</span>'
    + '<div style="display:flex;gap:6px">'
    + '<button onclick="window._fmSkip()" style="padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:12px">⏭ بعدی</button>'
    + '</div></div>';

  // Main matching card
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';

  // Left: CRM center
  html += '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:16px">'
    + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600">📍 مرکز در CRM</div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px">' + _fmEsc(item.crm_name) + '</div>'
    + '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + _fmEsc(item.crm_key) + '</div>'
    + '</div>';

  // Right: selected suggestion
  html += '<div style="background:' + (sug ? '#f0fdf4' : 'var(--bg-raised)') + ';'
    + 'border:2px solid ' + (sug ? '#16a34a' : 'var(--border)') + ';border-radius:10px;padding:16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
    + '<div style="font-size:11px;color:var(--text-muted);font-weight:600">🏢 پیشنهاد فرادیس</div>'
    + (sug ? '<span style="background:' + _fmConfColor(sug.confidence) + ';color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">' + sug.confidence + '٪</span>' : '')
    + '</div>';
  if (sug) {
    html += '<div style="font-size:14px;font-weight:700;color:#15803d;margin-bottom:6px">' + _fmEsc(sug.company_name) + '</div>'
      + '<div style="font-size:11px;color:var(--text-muted);line-height:1.7">'
      + (sug.company_code ? '<div>کد: <b>' + _fmEsc(sug.company_code) + '</b></div>' : '')
      + (sug.phone ? '<div>تلفن: <b>' + _fmEsc(sug.phone) + '</b></div>' : '')
      + (sug.state_name || sug.city_name ? '<div>شهر: <b>' + _fmEsc((sug.city_name || '') + (sug.state_name ? ' — ' + sug.state_name : '')) + '</b></div>' : '')
      + '</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--text-muted)">پیشنهادی موجود نیست</div>';
  }
  html += '</div>';
  html += '</div>'; // end grid

  // Alternative suggestions
  if (item.suggestions.length > 1) {
    html += '<div style="margin-bottom:12px">'
      + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600">پیشنهادات دیگر:</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    item.suggestions.forEach(function(s, i) {
      var sel = i === _fmState.selectedSugIdx;
      html += '<div onclick="window._fmSelectSug(' + i + ')" style="'
        + 'cursor:pointer;padding:8px 12px;border-radius:8px;'
        + 'border:2px solid ' + (sel ? '#6366f1' : 'var(--border)') + ';'
        + 'background:' + (sel ? '#ede9fe' : 'var(--bg-raised)') + ';'
        + 'font-size:12px;max-width:220px">'
        + '<div style="font-weight:600;color:var(--text-primary)">' + _fmEsc(s.company_name) + '</div>'
        + '<div style="font-size:10px;color:var(--text-muted)">'
        + (s.company_code ? 'کد: ' + _fmEsc(s.company_code) + ' | ' : '')
        + '<span style="color:' + _fmConfColor(s.confidence) + ';font-weight:700">' + s.confidence + '٪</span>'
        + '</div></div>';
    });
    html += '</div></div>';
  }

  // Action buttons
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  if (sug) {
    html += '<button onclick="window._fmApprove()" style="'
      + 'padding:8px 20px;border-radius:7px;border:none;background:#16a34a;color:#fff;'
      + 'cursor:pointer;font-family:inherit;font-size:13px;font-weight:700">✅ تایید این تطبیق</button>'
      + '<button onclick="window._fmReject()" style="'
      + 'padding:8px 16px;border-radius:7px;border:1px solid #ef4444;background:none;color:#ef4444;'
      + 'cursor:pointer;font-family:inherit;font-size:13px">❌ رد این پیشنهاد</button>';
  }
  html += '<button onclick="window._fmOpenManualSearch()" style="'
    + 'padding:8px 16px;border-radius:7px;border:1px solid var(--border);background:var(--bg-raised);'
    + 'cursor:pointer;font-family:inherit;font-size:13px">🔍 جستجوی دستی</button>'
    + '<button onclick="window._fmSkip()" style="'
    + 'padding:8px 16px;border-radius:7px;border:1px solid var(--border);background:var(--bg-raised);'
    + 'cursor:pointer;font-family:inherit;font-size:13px;color:var(--text-muted)">⏭ بعدی</button>';
  html += '</div>';

  // Manual search inline area
  html += '<div id="fmManualSearch" style="display:none;margin-top:14px;border-top:1px solid var(--border);padding-top:14px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">🔍 جستجوی دستی در فرادیس</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<input id="fmManualQ" type="text" placeholder="نام مشتری فرادیس…" oninput="window._fmManualSearch()" '
    + 'style="flex:1;padding:8px 12px;border:1px solid var(--border-input);border-radius:7px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)">'
    + '</div>'
    + '<div id="fmManualResults"></div>'
    + '</div>';

  content.innerHTML = html;
}

window._fmSelectSug = function(i) {
  _fmState.selectedSugIdx = i;
  _fmRenderPending();
};

window._fmSkip = function() {
  _fmState.currentIdx++;
  _fmState.selectedSugIdx = 0;
  _fmRenderPending();
};

window._fmRestart = function() {
  _fmState.centerOffset = 0;
  _fmState.hasMore = true;
  _fmState.currentIdx = 0;
  _fmState.selectedSugIdx = 0;
  _fmState.suggestions = [];
  _fmLoadSuggestions();
};

window._fmApprove = function() {
  var sugs = _fmState.suggestions;
  var idx = _fmState.currentIdx;
  if (!sugs || idx >= sugs.length) return;
  var item = sugs[idx];
  var sug = item.suggestions[_fmState.selectedSugIdx] || item.suggestions[0];
  if (!sug) return;
  fetch('/api/faradis-match/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crm_key: item.crm_key,
      crm_name: item.crm_name,
      company_num: sug.company_num,
      company_name: sug.company_name,
      matched_by: 'auto',
      confidence: sug.confidence,
    }),
  })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 3000); return; }
      if (typeof showToast === 'function') showToast('✅ تطبیق تایید شد');
      // Remove this item from list and advance
      _fmState.suggestions.splice(idx, 1);
      _fmState.selectedSugIdx = 0;
      if (_fmState.currentIdx >= _fmState.suggestions.length && _fmState.suggestions.length > 0) {
        _fmState.currentIdx = _fmState.suggestions.length - 1;
      }
      _fmRenderPending();
      _fmLoadStatus();
    })
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 3000);
    });
};

window._fmReject = function() {
  var sugs = _fmState.suggestions;
  var idx = _fmState.currentIdx;
  if (!sugs || idx >= sugs.length) return;
  var item = sugs[idx];
  var sug = item.suggestions[_fmState.selectedSugIdx] || item.suggestions[0];
  if (!sug) return;
  fetch('/api/faradis-match/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm_key: item.crm_key, company_num: sug.company_num }),
  })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 3000); return; }
      if (typeof showToast === 'function') showToast('رد شد');
      // Remove rejected suggestion from this item
      item.suggestions.splice(_fmState.selectedSugIdx, 1);
      _fmState.selectedSugIdx = 0;
      if (item.suggestions.length === 0) {
        // No more suggestions for this center, skip it
        _fmState.suggestions.splice(idx, 1);
        if (_fmState.currentIdx >= _fmState.suggestions.length && _fmState.suggestions.length > 0) {
          _fmState.currentIdx = _fmState.suggestions.length - 1;
        }
      }
      _fmRenderPending();
    })
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 3000);
    });
};

window._fmOpenManualSearch = function() {
  var area = document.getElementById('fmManualSearch');
  if (!area) return;
  area.style.display = area.style.display === 'none' ? '' : 'none';
  if (area.style.display !== 'none') {
    var inp = document.getElementById('fmManualQ');
    if (inp) inp.focus();
  }
};

window._fmManualSearch = function() {
  var inp = document.getElementById('fmManualQ');
  if (!inp) return;
  var q = inp.value.trim();
  if (!q) {
    var res = document.getElementById('fmManualResults');
    if (res) res.innerHTML = '';
    return;
  }
  fetch('/api/faradis-match/search?q=' + encodeURIComponent(q))
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var res = document.getElementById('fmManualResults');
      if (!res) return;
      if (!Array.isArray(data) || data.length === 0) {
        res.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px">نتیجه‌ای یافت نشد</div>';
        return;
      }
      var html = '<div style="display:flex;flex-direction:column;gap:6px">';
      data.forEach(function(c) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;'
          + 'padding:8px 12px;border:1px solid var(--border);border-radius:7px;background:var(--bg-raised)">'
          + '<div>'
          + '<div style="font-size:13px;font-weight:600;color:var(--text-primary)">' + _fmEsc(c.company_name) + '</div>'
          + '<div style="font-size:11px;color:var(--text-muted)">'
          + (c.company_code ? 'کد: ' + _fmEsc(c.company_code) + ' | ' : '')
          + (c.phone ? 'تلفن: ' + _fmEsc(c.phone) + ' | ' : '')
          + (c.city_name ? 'شهر: ' + _fmEsc(c.city_name) : '')
          + '</div></div>'
          + '<button onclick="window._fmManualApprove(' + c.company_num + ',\'' + _fmEscAttr(c.company_name) + '\')" style="'
          + 'padding:5px 12px;border-radius:6px;border:none;background:#16a34a;color:#fff;'
          + 'cursor:pointer;font-family:inherit;font-size:11px;font-weight:600">انتخاب</button>'
          + '</div>';
      });
      html += '</div>';
      res.innerHTML = html;
    })
    .catch(function(){});
};

window._fmManualApprove = function(companyNum, companyName) {
  var sugs = _fmState.suggestions;
  var idx = _fmState.currentIdx;
  if (!sugs || idx >= sugs.length) return;
  var item = sugs[idx];
  fetch('/api/faradis-match/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crm_key: item.crm_key,
      crm_name: item.crm_name,
      company_num: companyNum,
      company_name: companyName,
      matched_by: 'manual',
      confidence: 100,
    }),
  })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 3000); return; }
      if (typeof showToast === 'function') showToast('✅ تطبیق دستی ثبت شد');
      _fmState.suggestions.splice(idx, 1);
      _fmState.selectedSugIdx = 0;
      if (_fmState.currentIdx >= _fmState.suggestions.length && _fmState.suggestions.length > 0) {
        _fmState.currentIdx = _fmState.suggestions.length - 1;
      }
      _fmRenderPending();
      _fmLoadStatus();
    })
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 3000);
    });
};

// ── Approved links tab ────────────────────────────────────────────────────

function _fmLoadLinks() {
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ در حال بارگذاری…</div>';
  fetch('/api/faradis-match/links?offset=' + _fmState.linksOffset + '&limit=50')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      _fmState.links = d.links || [];
      _fmState.linksTotal = d.total || 0;
      _fmRenderApproved();
    })
    .catch(function(e) {
      if (content) content.innerHTML = '<div style="color:#ef4444;padding:20px">خطا: ' + e.message + '</div>';
    });
}

function _fmRenderApproved() {
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  var links = _fmState.links;
  var html = '<div style="margin-bottom:10px;font-size:12px;color:var(--text-muted)">'
    + 'مجموع: <b>' + _fmState.linksTotal + '</b> تطبیق تایید شده'
    + '</div>';
  if (!links || links.length === 0) {
    html += '<div style="text-align:center;padding:40px;color:var(--text-muted)">هنوز تطبیقی تایید نشده است</div>';
    content.innerHTML = html;
    return;
  }
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--bg-raised);text-align:right">'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">مرکز CRM</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">مشتری فرادیس</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">روش</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">اطمینان</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">تایید کننده</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">اطلاعات</th>'
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border)">حذف</th>'
    + '</tr></thead><tbody>';
  links.forEach(function(l) {
    html += '<tr style="border-bottom:1px solid var(--border)">'
      + '<td style="padding:8px 10px"><div style="font-weight:600">' + _fmEsc(l.crm_center_name || '') + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted);font-family:monospace">' + _fmEsc(l.crm_center_key) + '</div></td>'
      + '<td style="padding:8px 10px"><div style="font-weight:600">' + _fmEsc(l.faradis_company_name || '') + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted)">' + l.faradis_company_num + '</div></td>'
      + '<td style="padding:8px 10px">' + _fmEsc(l.matched_by === 'manual' ? 'دستی' : 'خودکار') + '</td>'
      + '<td style="padding:8px 10px"><span style="background:' + _fmConfColor(l.confidence) + ';color:#fff;border-radius:8px;padding:2px 7px;font-size:11px">' + l.confidence + '٪</span></td>'
      + '<td style="padding:8px 10px;font-size:11px">' + _fmEsc(l.confirmed_by || '') + '</td>'
      + '<td style="padding:8px 10px">'
      + '<button onclick="window._fdShowCenterProducts && window._fdShowCenterProducts(\'' + _fmEscAttr(l.crm_center_key) + '\',this)" style="padding:3px 8px;border-radius:5px;border:1px solid #6366f1;background:none;color:#6366f1;cursor:pointer;font-family:inherit;font-size:10px">📦 محصولات</button>'
      + '<div style="display:none"></div>'
      + '<button onclick="window._fdShowEnrichment && window._fdShowEnrichment(\'' + _fmEscAttr(l.crm_center_key) + '\',this)" style="padding:3px 8px;border-radius:5px;border:1px solid #059669;background:none;color:#059669;cursor:pointer;font-family:inherit;font-size:10px">📋 اطلاعات</button>'
      + '<div style="display:none"></div>'
      + '<button onclick="window._fdShowReceivable && window._fdShowReceivable(\'' + _fmEscAttr(l.crm_center_key) + '\',this)" style="padding:3px 8px;border-radius:5px;border:1px solid #ef4444;background:none;color:#ef4444;cursor:pointer;font-family:inherit;font-size:10px">💰 مطالبه</button>'
      + '<div style="display:none"></div>'
      + '</td>'
      + '<td style="padding:8px 10px"><button onclick="window._fmDeleteLink(' + l.id + ')" style="'
      + 'padding:3px 10px;border-radius:5px;border:1px solid #ef4444;background:none;color:#ef4444;'
      + 'cursor:pointer;font-family:inherit;font-size:11px">🗑</button></td>'
      + '</tr>';
  });
  html += '</tbody></table></div>';

  if (_fmState.linksTotal > (_fmState.linksOffset + links.length)) {
    html += '<div style="text-align:center;margin-top:14px">'
      + '<button onclick="window._fmLinksMore()" style="padding:7px 20px;border-radius:7px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:12px">بارگذاری بیشتر</button>'
      + '</div>';
  }
  content.innerHTML = html;
}

window._fmDeleteLink = function(id) {
  if (!confirm('آیا از حذف این تطبیق مطمئن هستید؟')) return;
  fetch('/api/faradis-match/links/' + id, { method: 'DELETE' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 3000); return; }
      if (typeof showToast === 'function') showToast('تطبیق حذف شد');
      _fmState.linksOffset = 0;
      _fmState.links = [];
      _fmLoadLinks();
      _fmLoadStatus();
    })
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 3000);
    });
};

window._fmLinksMore = function() {
  _fmState.linksOffset += _fmState.links.length;
  fetch('/api/faradis-match/links?offset=' + _fmState.linksOffset + '&limit=50')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      _fmState.links = _fmState.links.concat(d.links || []);
      _fmRenderApproved();
    })
    .catch(function(){});
};

// ── Search tab ────────────────────────────────────────────────────────────

function _fmRenderSearch() {
  var content = document.getElementById('fmTabContent');
  if (!content) return;
  content.innerHTML = '<div style="max-width:700px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-primary)">🔍 مرور مشتریان فرادیس</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:14px">'
    + '<input id="fmSearchQ" type="text" placeholder="جستجو بر اساس نام، تلفن، کد…" oninput="window._fmDoSearch()" value="' + _fmEscAttr(_fmState.searchQ) + '" '
    + 'style="flex:1;padding:10px 14px;border:1px solid var(--border-input);border-radius:7px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)">'
    + '</div>'
    + '<div id="fmSearchResults"><div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ در حال بارگذاری…</div></div>'
    + '</div>';
  // Auto-load first 50 customers
  _fmDoSearchOrAll(_fmState.searchQ || '');
  var inp = document.getElementById('fmSearchQ');
  if (inp) inp.focus();
}

window._fmDoSearch = function() {
  var inp = document.getElementById('fmSearchQ');
  if (!inp) return;
  var q = inp.value.trim();
  _fmState.searchQ = q;
  _fmDoSearchOrAll(q);
};

function _fmDoSearchOrAll(q) {
  var url = q
    ? '/api/faradis-match/search?q=' + encodeURIComponent(q)
    : '/api/faradis-match/search?q=&limit=50';
  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(data) {
      _fmState.searchResults = Array.isArray(data) ? data : [];
      var res = document.getElementById('fmSearchResults');
      if (res) res.innerHTML = _fmBuildSearchResults(_fmState.searchResults);
    })
    .catch(function(e) {
      var res = document.getElementById('fmSearchResults');
      if (res) res.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fmEsc(e.message) + '</div>';
    });
}

function _fmBuildSearchResults(data) {
  if (!data || data.length === 0) return '<div style="font-size:13px;color:var(--text-muted);padding:12px">نتیجه‌ای یافت نشد</div>';
  var html = '<div style="display:flex;flex-direction:column;gap:8px">';
  data.forEach(function(c) {
    html += '<div style="padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised)">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      + '<div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:3px">' + _fmEsc(c.company_name) + '</div>'
      + '<div style="font-size:11px;color:var(--text-muted);line-height:1.8">'
      + (c.company_code ? '<span>کد: <b>' + _fmEsc(c.company_code) + '</b> | </span>' : '')
      + (c.phone ? '<span>تلفن: ' + _fmEsc(c.phone) + ' | </span>' : '')
      + (c.mobile ? '<span>موبایل: ' + _fmEsc(c.mobile) + ' | </span>' : '')
      + (c.city_name ? '<span>شهر: ' + _fmEsc(c.city_name) + '</span>' : '')
      + (c.state_name ? '<span> / ' + _fmEsc(c.state_name) + '</span>' : '')
      + '</div>'
      + (c.address ? '<div style="font-size:11px;color:var(--text-muted);margin-top:3px">آدرس: ' + _fmEsc(c.address) + '</div>' : '')
      + '<button onclick="window._fmShowFactors(' + c.company_num + ',this)" style="'
      + 'padding:4px 10px;border-radius:5px;border:1px solid #6366f1;background:none;color:#6366f1;'
      + 'cursor:pointer;font-family:inherit;font-size:11px;margin-top:6px">📊 تاریخچه فروش</button>'
      + '<div class="fm-factor-detail" style="display:none"></div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted);text-align:left;flex-shrink:0;margin-right:8px">'
      + '<div>شناسه: ' + c.company_num + '</div>'
      + (c.type_name ? '<div>' + _fmEsc(c.type_name) + '</div>' : '')
      + '</div></div></div>';
  });
  html += '</div>';
  return html;
}

// ── Sync factors from Faradis ─────────────────────────────────────────────

window._fmDoSyncFactors = function() {
  var btn = document.getElementById('fmSyncFactorsBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال دریافت…'; }
  fetch('/api/faradis-match/sync-factors', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '📊 دریافت فاکتورها'; }
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 4000); return; }
      if (typeof showToast === 'function') showToast('✅ ' + d.count + ' فاکتور از فرادیس دریافت شد');
      _fmLoadStatus();
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '📊 دریافت فاکتورها'; }
      if (typeof showToast === 'function') showToast('❌ خطا: ' + e.message, 4000);
    });
};

// ── Factor history handler ────────────────────────────────────────────────

window._fmShowFactors = function(companyNum, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') { detail.style.display = 'none'; btn.textContent = '📊 تاریخچه فروش'; return; }
  btn.textContent = '⏳';
  detail.style.display = '';
  detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">در حال بارگذاری…</div>';
  fetch('/api/faradis-match/factors/' + companyNum)
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '📊 تاریخچه فروش';
      if (d.error) { detail.innerHTML = '<div style="color:#ef4444;font-size:11px">' + _fmEsc(d.error) + '</div>'; return; }
      var monthly = d.monthly || [];
      if (monthly.length === 0) { detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">فاکتوری یافت نشد</div>'; return; }
      var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">ماه</th>'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">فاکتور فروش</th>'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">پیش‌فاکتور</th>'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">تعداد</th>'
        + '</tr></thead><tbody>';
      monthly.forEach(function(m) {
        var inv = parseFloat(m.invoiced || 0);
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:4px 8px">' + _fmEsc(m.jalali_month) + '</td>'
          + '<td style="padding:4px 8px;font-weight:600">' + (inv > 0 ? (inv/1000000).toFixed(1) + 'M' : '—') + '</td>'
          + '<td style="padding:4px 8px">' + (parseFloat(m.quoted||0) > 0 ? (parseFloat(m.quoted)/1000000).toFixed(1) + 'M' : '—') + '</td>'
          + '<td style="padding:4px 8px">' + (parseInt(m.invoice_count||0) + parseInt(m.quote_count||0)) + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      detail.innerHTML = html;
    })
    .catch(function(e) {
      btn.textContent = '📊 تاریخچه فروش';
      detail.innerHTML = '<div style="color:#ef4444;font-size:11px">خطا: ' + _fmEsc(e.message) + '</div>';
    });
};

// ── Utility ───────────────────────────────────────────────────────────────

function _fmEsc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function _fmEscAttr(s) {
  return _fmEsc(s).replace(/'/g,'&#39;');
}

function _fmConfColor(conf) {
  if (conf >= 70) return '#16a34a';
  if (conf >= 40) return '#d97706';
  return '#6b7280';
}

window._fdSyncInventory = function() {
  fetch('/api/faradis-data/sync-inventory', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (typeof showToast === 'function') showToast(d.ok ? '✅ ' + d.count + ' ردیف موجودی' : '❌ ' + d.error, 4000);
      if (d.ok && typeof renderFdInventory === 'function') renderFdInventory('fdInventoryContainer');
    }).catch(function(e){ if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000); });
};
window._fdSyncStuffs = function() {
  fetch('/api/faradis-data/sync-stuffs', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (typeof showToast === 'function') showToast(d.ok ? '✅ ' + d.count + ' محصول' : '❌ ' + d.error, 4000);
    }).catch(function(e){ if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000); });
};

})(); // end IIFE

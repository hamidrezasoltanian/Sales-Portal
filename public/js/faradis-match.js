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
  offset: 0,
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
  _fmLoadStatus();
  _fmSwitchTab(_fmState.tab);
};

// ── Shell HTML ────────────────────────────────────────────────────────────

function _fmBuildShell() {
  return '<div style="max-width:900px;margin:0 auto;font-family:Vazirmatn,sans-serif">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'
    +   '<h2 style="margin:0;font-size:18px;color:var(--text-primary)">🔗 تطبیق مراکز CRM ↔ فرادیس</h2>'
    +   '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    +     '<button id="fmSyncBtn" onclick="window._fmDoSync()" style="'
    +       'padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;'
    +       'cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 دریافت مشتریان فرادیس</button>'
    +     '<div id="fmStatusBar" style="font-size:12px;color:var(--text-muted)">در حال بارگذاری…</div>'
    +   '</div>'
    + '</div>'
    + '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">'
    +   _fmTabBtn('pending','⏳ در انتظار')
    +   _fmTabBtn('approved','✅ تایید شده')
    +   _fmTabBtn('search','🔍 جستجو')
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
  ['pending','approved','search'].forEach(function(t) {
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
    _fmState.offset = 0;
    _fmState.currentIdx = 0;
    _fmState.suggestions = [];
    _fmLoadSuggestions();
  } else if (tab === 'approved') {
    _fmState.linksOffset = 0;
    _fmState.links = [];
    _fmLoadLinks();
  } else if (tab === 'search') {
    _fmRenderSearch();
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
        + ' | مشتریان فرادیس: <span style="font-weight:600">' + (d.customers_cached || 0) + '</span>';
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
        _fmState.offset = 0;
        _fmState.currentIdx = 0;
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
  fetch('/api/faradis-match/suggestions?offset=' + _fmState.offset + '&limit=20')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      _fmState.loading = false;
      if (!Array.isArray(data)) {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444">خطا: ' + (data.error || 'پاسخ نامعتبر') + '</div>';
        return;
      }
      _fmState.suggestions = data;
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
  if (!sugs || sugs.length === 0) {
    content.innerHTML = '<div style="text-align:center;padding:60px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">🎉</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">همه مراکز بررسی شدند!</div>'
      + '<div style="font-size:13px;color:var(--text-muted)">مراکز بیشتری برای تطبیق وجود ندارد.</div>'
      + '<button onclick="window._fmLoadMore()" style="margin-top:16px;padding:8px 20px;border-radius:7px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:13px">🔄 بارگذاری بیشتر</button>'
      + '</div>';
    return;
  }
  var idx = _fmState.currentIdx;
  if (idx >= sugs.length) {
    // Reload next page
    _fmState.offset += sugs.length;
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

window._fmLoadMore = function() {
  _fmState.offset = 0;
  _fmState.currentIdx = 0;
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
  content.innerHTML = '<div style="max-width:600px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-primary)">🔍 جستجو در مشتریان فرادیس</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:14px">'
    + '<input id="fmSearchQ" type="text" placeholder="نام مشتری فرادیس را وارد کنید…" oninput="window._fmDoSearch()" value="' + _fmEscAttr(_fmState.searchQ) + '" '
    + 'style="flex:1;padding:10px 14px;border:1px solid var(--border-input);border-radius:7px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)">'
    + '</div>'
    + '<div id="fmSearchResults">' + (_fmState.searchResults.length ? _fmBuildSearchResults(_fmState.searchResults) : '') + '</div>'
    + '</div>';
  var inp = document.getElementById('fmSearchQ');
  if (inp) inp.focus();
}

window._fmDoSearch = function() {
  var inp = document.getElementById('fmSearchQ');
  if (!inp) return;
  var q = inp.value.trim();
  _fmState.searchQ = q;
  if (!q) {
    var res = document.getElementById('fmSearchResults');
    if (res) res.innerHTML = '';
    _fmState.searchResults = [];
    return;
  }
  fetch('/api/faradis-match/search?q=' + encodeURIComponent(q))
    .then(function(r){ return r.json(); })
    .then(function(data) {
      _fmState.searchResults = Array.isArray(data) ? data : [];
      var res = document.getElementById('fmSearchResults');
      if (res) res.innerHTML = _fmBuildSearchResults(_fmState.searchResults);
    })
    .catch(function(){});
};

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
      + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted);text-align:left;flex-shrink:0;margin-right:8px">'
      + '<div>شناسه: ' + c.company_num + '</div>'
      + (c.type_name ? '<div>' + _fmEsc(c.type_name) + '</div>' : '')
      + '</div></div></div>';
  });
  html += '</div>';
  return html;
}

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

})(); // end IIFE

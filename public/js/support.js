/* ═══════════════════════════════════════════════════════
   Support Panel — پشتیبان فروش
   Kanban: open → in_progress → waiting → resolved → closed
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {

var _supportData    = [];
var _supportStats   = {};
var _supportFilter  = 'all';  // all / open / resolved / mine
var _supportLoading = false;

var CATEGORIES = {
  complaint: '😤 شکایت',
  service:   '🔧 خدمات',
  training:  '📚 آموزش',
  other:     '📋 سایر',
};

var PRIORITIES = {
  1: { label: 'پایین',    icon: '🔵' },
  2: { label: 'متوسط',   icon: '🟡' },
  3: { label: 'بالا',    icon: '🔴' },
  4: { label: 'بحرانی',  icon: '🚨' },
};

var STATUSES = [
  { key: 'open',          label: 'باز',          color: '#3b82f6' },
  { key: 'in_progress',   label: 'در جریان',     color: '#f59e0b' },
  { key: 'waiting',       label: 'انتظار مشتری', color: '#8b5cf6' },
  { key: 'resolved',      label: 'حل شده',       color: '#10b981' },
  { key: 'closed',        label: 'بسته',         color: '#64748b' },
];

// ── Public entry point ───────────────────────────────────────────────────────
window.renderSupportPanel = function() {
  var el = document.getElementById('supportRoot');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">در حال بارگذاری…</div>';
  loadSupportData(function() { renderSupport(el); });
};

// ── Load data ────────────────────────────────────────────────────────────────
function loadSupportData(cb) {
  if (_supportLoading) return;
  _supportLoading = true;

  var params = '';
  if (_supportFilter === 'open')     params = '?status=open';
  else if (_supportFilter === 'resolved') params = '?status=resolved';
  else if (_supportFilter === 'mine') {
    var cu = (typeof currentUser !== 'undefined') ? currentUser : '';
    params = '?assigned_to=' + encodeURIComponent(cu);
  }

  fetch('/api/support' + params + (params ? '&limit=100' : '?limit=100'))
    .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
    .then(function(d) {
      _supportLoading = false;
      _supportData  = d.tickets || [];
      _supportStats = d.statusCounts || {};
      if (cb) cb();
    })
    .catch(function() { _supportLoading = false; if (cb) cb(); });
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderSupport(el) {
  var isMgr = (typeof _isManager === 'function') ? _isManager() : false;
  var todayISO = new Date().toISOString().slice(0, 10);

  var totalOpen = (_supportStats.open || 0) + (_supportStats.in_progress || 0) + (_supportStats.waiting || 0);

  var html = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">';
  html += '<h2 style="margin:0;font-size:20px;color:#1e293b">🎧 پشتیبان فروش</h2>';
  html += '<span style="background:#3b82f6;color:#fff;border-radius:12px;padding:2px 10px;font-size:13px">' + totalOpen + ' باز</span>';
  html += '<button onclick="window._spOpenNew()" style="margin-right:auto;background:#6366f1;color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-size:14px">➕ تیکت جدید</button>';
  html += '</div>';

  // Filter bar
  var filters = [
    { key: 'all',       label: 'همه' },
    { key: 'open',      label: 'باز (' + ((_supportStats.open||0)+(_supportStats.in_progress||0)+(_supportStats.waiting||0)) + ')' },
    { key: 'resolved',  label: 'حل‌شده' },
    { key: 'mine',      label: 'تخصیص به من' },
  ];

  html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
  filters.forEach(function(f) {
    var active = f.key === _supportFilter;
    html += '<button onclick="window._spSetFilter(\'' + f.key + '\')" style="padding:5px 14px;border-radius:20px;border:2px solid ' + (active ? '#6366f1' : '#e2e8f0') + ';background:' + (active ? '#6366f1' : '#fff') + ';color:' + (active ? '#fff' : '#64748b') + ';cursor:pointer;font-size:13px">' + f.label + '</button>';
  });
  html += '</div>';

  // Kanban columns
  html += '<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:16px;min-height:400px">';
  STATUSES.forEach(function(st) {
    var tickets = _supportData.filter(function(t) { return t.status === st.key; });
    html += '<div style="min-width:240px;flex:1;background:#f8fafc;border-radius:12px;padding:12px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
    html += '<span style="width:10px;height:10px;border-radius:50%;background:' + st.color + ';display:inline-block"></span>';
    html += '<b style="font-size:14px;color:#1e293b">' + st.label + '</b>';
    html += '<span style="margin-right:auto;background:#e2e8f0;border-radius:10px;padding:1px 8px;font-size:12px">' + tickets.length + '</span>';
    html += '</div>';

    tickets.forEach(function(t) {
      var pri = PRIORITIES[t.priority] || PRIORITIES[2];
      var cat = CATEGORIES[t.category] || '📋 سایر';
      var slaBreached = t.sla_deadline && t.sla_deadline < todayISO && st.key !== 'resolved' && st.key !== 'closed';

      html += '<div onclick="window._spOpenTicket(\'' + esc(t.id) + '\')" style="background:#fff;border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer;border:1px solid ' + (slaBreached ? '#fca5a5' : '#e2e8f0') + ';border-right:4px solid ' + st.color + ';transition:box-shadow .15s" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.08)\'" onmouseout="this.style.boxShadow=\'\'">';
      html += '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">';
      html += '<span title="' + pri.label + '">' + pri.icon + '</span>';
      html += '<span style="font-size:14px;font-weight:600;color:#1e293b;flex:1;line-height:1.3">' + esc(t.title) + '</span>';
      html += '</div>';

      if (t.center_name) {
        html += '<div style="font-size:12px;color:#64748b;margin-bottom:4px">🏥 ' + esc(t.center_name) + '</div>';
      }
      html += '<div style="font-size:12px;color:#64748b;margin-bottom:4px">' + cat + '</div>';

      if (t.assigned_to) {
        html += '<div style="font-size:12px;color:#64748b">👤 ' + esc(t.assigned_to) + '</div>';
      }

      if (slaBreached) {
        html += '<div style="font-size:11px;color:#ef4444;margin-top:4px;font-weight:600">⚠️ SLA گذشته: ' + t.sla_deadline + '</div>';
      } else if (t.sla_deadline) {
        html += '<div style="font-size:11px;color:#64748b;margin-top:4px">⏰ مهلت: ' + t.sla_deadline + '</div>';
      }

      if (t.comment_count > 0) {
        html += '<div style="font-size:11px;color:#94a3b8;margin-top:4px">💬 ' + t.comment_count + ' کامنت</div>';
      }

      html += '</div>'; // ticket card
    });

    if (!tickets.length) {
      html += '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">خالی</div>';
    }

    html += '</div>'; // column
  });
  html += '</div>'; // kanban

  el.innerHTML = html;
}

// ── Global helpers ───────────────────────────────────────────────────────────
window._spSetFilter = function(f) {
  _supportFilter = f;
  var el = document.getElementById('supportRoot');
  if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">در حال بارگذاری…</div>';
  loadSupportData(function() { renderSupport(el); });
};

window._spOpenNew = function() {
  var isMgr = (typeof _isManager === 'function') ? _isManager() : false;

  var usersOpts = '';
  if (typeof USERS !== 'undefined') {
    Object.entries(USERS).forEach(function(e) {
      usersOpts += '<option value="' + esc(e[0]) + '">' + esc(e[1]) + '</option>';
    });
  }

  var body = '<div style="display:flex;flex-direction:column;gap:14px">';
  body += '<div><label style="font-size:13px;color:#64748b">عنوان تیکت *</label><input id="spNewTitle" class="form-input" placeholder="خلاصه مشکل..." style="width:100%;margin-top:4px"></div>';
  body += '<div><label style="font-size:13px;color:#64748b">دسته‌بندی</label><select id="spNewCat" class="form-input" style="width:100%;margin-top:4px">';
  Object.entries(CATEGORIES).forEach(function(e) { body += '<option value="' + e[0] + '">' + e[1] + '</option>'; });
  body += '</select></div>';
  body += '<div><label style="font-size:13px;color:#64748b">اولویت</label><select id="spNewPri" class="form-input" style="width:100%;margin-top:4px">';
  Object.entries(PRIORITIES).forEach(function(e) { body += '<option value="' + e[0] + '">' + e[1].icon + ' ' + e[1].label + '</option>'; });
  body += '</select></div>';
  body += '<div><label style="font-size:13px;color:#64748b">نام مرکز (اختیاری)</label><input id="spNewCenter" class="form-input" placeholder="نام مرکز..." style="width:100%;margin-top:4px"></div>';
  if (isMgr) {
    body += '<div><label style="font-size:13px;color:#64748b">تخصیص به</label><select id="spNewAssign" class="form-input" style="width:100%;margin-top:4px"><option value="">انتخاب کنید...</option>' + usersOpts + '</select></div>';
  }
  body += '<div><label style="font-size:13px;color:#64748b">توضیحات</label><textarea id="spNewDesc" class="form-input" rows="4" placeholder="شرح کامل مشکل..." style="width:100%;margin-top:4px;resize:vertical"></textarea></div>';
  body += '</div>';

  var footer = '<button onclick="window._spSubmitNew()" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer">✅ ثبت تیکت</button>';
  footer += ' <button onclick="closeModal(\'spNewModal\')" style="background:#f1f5f9;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">لغو</button>';

  if (typeof openModal === 'function') openModal('spNewModal', '🎧 تیکت جدید', body, footer, { lg: true });
};

window._spSubmitNew = function() {
  var title   = (document.getElementById('spNewTitle') || {}).value || '';
  var cat     = (document.getElementById('spNewCat') || {}).value || 'other';
  var pri     = (document.getElementById('spNewPri') || {}).value || '2';
  var center  = (document.getElementById('spNewCenter') || {}).value || '';
  var assign  = (document.getElementById('spNewAssign') || {}).value || '';
  var desc    = (document.getElementById('spNewDesc') || {}).value || '';

  if (!title.trim()) { alert('عنوان الزامی است'); return; }

  fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.trim(), category: cat, priority: parseInt(pri), center_name: center || null, assigned_to: assign || null, description: desc || null }),
  })
    .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
    .then(function() {
      if (typeof closeModal === 'function') closeModal('spNewModal');
      if (typeof showToast === 'function') showToast('✅ تیکت ثبت شد', 2000);
      window._spSetFilter(_supportFilter);
    })
    .catch(function(e) { alert('خطا در ثبت: ' + (e.message || e)); });
};

window._spOpenTicket = function(id) {
  fetch('/api/support/' + encodeURIComponent(id))
    .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
    .then(function(d) { _renderTicketModal(d.ticket, d.comments); })
    .catch(function(e) { alert('خطا: ' + (e.message || e)); });
};

function _renderTicketModal(t, comments) {
  var isMgr = (typeof _isManager === 'function') ? _isManager() : false;
  var pri   = PRIORITIES[t.priority] || PRIORITIES[2];
  var cat   = CATEGORIES[t.category] || '📋';

  var statusOpts = '';
  STATUSES.forEach(function(s) {
    statusOpts += '<option value="' + s.key + '"' + (t.status === s.key ? ' selected' : '') + '>' + s.label + '</option>';
  });

  var body = '<div style="display:flex;flex-direction:column;gap:12px">';
  body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
  body += '<span>' + pri.icon + ' ' + pri.label + '</span>';
  body += '<span>' + cat + '</span>';
  if (t.assigned_to) body += '<span>👤 ' + esc(t.assigned_to) + '</span>';
  if (t.center_name) body += '<span>🏥 ' + esc(t.center_name) + '</span>';
  if (t.sla_deadline) body += '<span>⏰ ' + t.sla_deadline + '</span>';
  body += '</div>';

  if (t.description) {
    body += '<div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:14px;color:#475569">' + esc(t.description) + '</div>';
  }

  if (isMgr) {
    body += '<div style="display:flex;gap:8px;align-items:center">';
    body += '<label style="font-size:13px;color:#64748b;white-space:nowrap">تغییر وضعیت:</label>';
    body += '<select id="spStatusSel" class="form-input" style="flex:1" onchange="window._spUpdateStatus(\'' + esc(t.id) + '\',this.value)">' + statusOpts + '</select>';
    body += '</div>';
  }

  if (t.resolution) {
    body += '<div style="background:#d1fae5;border-radius:8px;padding:10px;font-size:14px"><b>✅ راه‌حل:</b> ' + esc(t.resolution) + '</div>';
  }

  // Comments
  body += '<div style="margin-top:8px"><b style="font-size:14px">💬 کامنت‌ها</b><div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">';
  (comments || []).forEach(function(c) {
    var isInternal = c.is_internal;
    body += '<div style="background:' + (isInternal ? '#fefce8' : '#f8fafc') + ';border-radius:8px;padding:10px;font-size:13px">';
    if (isInternal) body += '<span style="color:#f59e0b;font-size:11px;font-weight:600">🔒 داخلی — </span>';
    body += '<b>' + esc(c.author) + '</b>: ' + esc(c.body);
    body += '<div style="font-size:11px;color:#94a3b8;margin-top:4px">' + (c.at ? new Date(c.at).toLocaleString('fa-IR') : '') + '</div>';
    body += '</div>';
  });
  if (!comments || !comments.length) body += '<div style="color:#94a3b8;font-size:13px">هنوز کامنتی ثبت نشده</div>';
  body += '</div></div>';

  // Add comment
  body += '<div style="display:flex;flex-direction:column;gap:8px">';
  body += '<textarea id="spCmtBody" class="form-input" rows="3" placeholder="کامنت جدید..." style="width:100%;resize:vertical"></textarea>';
  if (isMgr) {
    body += '<label style="font-size:13px"><input type="checkbox" id="spCmtInternal" style="margin-left:4px"> یادداشت داخلی (مشتری نمی‌بیند)</label>';
  }
  body += '<button onclick="window._spAddComment(\'' + esc(t.id) + '\')" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;align-self:flex-start">💬 ارسال</button>';
  body += '</div>';
  body += '</div>';

  var footer = '';
  if (isMgr) {
    footer += '<div style="display:flex;gap:8px;align-items:center">';
    footer += '<label style="font-size:13px;color:#64748b">راه‌حل:</label>';
    footer += '<input id="spResolution" class="form-input" style="flex:1" placeholder="خلاصه راه‌حل..." value="' + esc(t.resolution || '') + '">';
    footer += '<button onclick="window._spSaveResolution(\'' + esc(t.id) + '\')" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer">ثبت</button>';
    footer += '</div>';
  }

  if (typeof openModal === 'function') openModal('spTicketModal', '🎧 ' + esc(t.title), body, footer, { lg: true });
}

window._spUpdateStatus = function(id, status) {
  fetch('/api/support/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status }),
  })
    .then(function() {
      if (typeof showToast === 'function') showToast('✅ وضعیت تغییر کرد', 1500);
      window._spSetFilter(_supportFilter);
    });
};

window._spSaveResolution = function(id) {
  var res = (document.getElementById('spResolution') || {}).value || '';
  fetch('/api/support/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution: res, status: 'resolved' }),
  })
    .then(function() {
      if (typeof closeModal === 'function') closeModal('spTicketModal');
      if (typeof showToast === 'function') showToast('✅ تیکت حل شد', 2000);
      window._spSetFilter(_supportFilter);
    });
};

window._spAddComment = function(id) {
  var body = (document.getElementById('spCmtBody') || {}).value || '';
  var internal = (document.getElementById('spCmtInternal') || {}).checked || false;
  if (!body.trim()) return;

  fetch('/api/support/' + encodeURIComponent(id) + '/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: body.trim(), is_internal: internal }),
  })
    .then(function(r) { return r.json(); })
    .then(function() {
      if (document.getElementById('spCmtBody')) document.getElementById('spCmtBody').value = '';
      if (typeof showToast === 'function') showToast('💬 کامنت ثبت شد', 1500);
      window._spOpenTicket(id); // re-open to refresh
    });
};

})();

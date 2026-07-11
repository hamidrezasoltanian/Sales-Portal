/* CRM completion patches — deals/files/workflow/HCP wiring helpers,
   action types, done-logs, activity SQL, overdue lead filter, MTR sync fix */
(function () {
  'use strict';

  // ── Shared action type labels ─────────────────────────────────────────────
  if (!window.ACTION_TYPE_LABELS) {
    window.ACTION_TYPE_LABELS = {
      call: '📞 تماس',
      visit: '🤝 ملاقات',
      price_send: '📄 ارسال قیمت',
      sample_send: '🧪 ارسال نمونه',
      committee: '🏛 پیگیری کمیته',
      meeting: '👥 جلسه',
      followup: '🔄 پیگیری',
    };
  }
  window.wpActKeys = function () {
    return Object.keys(window.ACTION_TYPE_LABELS);
  };
  window.wpActLabel = function (t) {
    return (window.ACTION_TYPE_LABELS && window.ACTION_TYPE_LABELS[t]) || window.ACTION_TYPE_LABELS.call;
  };
  window.wpActOptionsHtml = function (selected) {
    selected = selected || 'call';
    return wpActKeys().map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' +
        ACTION_TYPE_LABELS[k] + '</option>';
    }).join('');
  };
  window.wpActBg = function (t) {
    var map = {
      call: '#0ea5e9', visit: '#8b5cf6', price_send: '#059669',
      sample_send: '#d97706', committee: '#b45309', meeting: '#7c3aed', followup: '#64748b',
    };
    return map[t] || '#0ea5e9';
  };

  // ── HCP lazy load for center modal ────────────────────────────────────────
  window._loadCenterHcpLazy = function (rtype, rid, domId) {
    if (typeof _hcpLoadCenterAffiliations === 'function') {
      _hcpLoadCenterAffiliations(rtype, rid, domId);
      return;
    }
    if (typeof ensureTabScripts === 'function') {
      ensureTabScripts('hcp').then(function () {
        if (typeof _hcpLoadCenterAffiliations === 'function') {
          _hcpLoadCenterAffiliations(rtype, rid, domId);
        } else if (typeof _refreshContactsArea === 'function') {
          _refreshContactsArea(rtype, rid, domId);
        }
      }).catch(function () {
        if (typeof _refreshContactsArea === 'function') _refreshContactsArea(rtype, rid, domId);
      });
    }
  };

  // ── Activity log → SQL ────────────────────────────────────────────────────
  window._postActivityLog = function (type, entry) {
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type: type, entry: entry }),
    }).catch(function () {});
  };

  // ── Patch toggleWpActionType to cycle all types ───────────────────────────
  var _origToggle = window.toggleWpActionType;
  window.toggleWpActionType = function (eKey) {
    if (!DB.weekEntries || !DB.weekEntries[eKey]) return;
    var keys = wpActKeys();
    var cur = DB.weekEntries[eKey].actionType || 'call';
    var idx = keys.indexOf(cur);
    DB.weekEntries[eKey].actionType = keys[(idx + 1) % keys.length];
    var _wat = DB.weekEntries[eKey];
    if (_wat && _wat.sqlId) {
      fetch('/api/week-entries/' + encodeURIComponent(_wat.sqlId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: _wat.actionType }),
      }).catch(function () {});
    }
    if (typeof _wpSaveWeek === 'function') _wpSaveWeek([eKey]);
    if (typeof renderWeekPlan === 'function') renderWeekPlan();
  };

  // ── Enhance openExpertReport with done-logs tab ───────────────────────────
  window._doneLogsCache = {};
  window.loadExpertDoneLogs = async function (memberId, from, to, page) {
    page = page || 1;
    var q = '?page=' + page + '&limit=50';
    if (from) q += '&from=' + encodeURIComponent(from);
    if (to) q += '&to=' + encodeURIComponent(to);
    var r = await fetch('/api/manager-reports/expert/' + encodeURIComponent(memberId) + '/done-logs' + q, {
      credentials: 'same-origin',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };

  window.renderDoneLogsHtml = function (data) {
    var entries = (data && data.entries) || [];
    if (!entries.length) {
      return '<div style="padding:24px;text-align:center;color:var(--text-muted)">گزارش انجام‌شده‌ای یافت نشد</div>';
    }
    var rows = entries.map(function (e) {
      return '<tr>' +
        '<td style="font-size:11px">' + esc(e.doneDate || e.scheduledDate || '—') + '</td>' +
        '<td style="font-size:12px;font-weight:600">' + esc(e.centerName || e.recKey || '—') + '</td>' +
        '<td style="font-size:11px">' + esc(wpActLabel(e.actionType || 'call')) + '</td>' +
        '<td style="font-size:11px">' + esc(e.doneResult || '—') + '</td>' +
        '<td style="font-size:11px;color:var(--text-secondary)">' + esc((e.doneNote || '').substring(0, 80)) + '</td>' +
        '<td style="font-size:11px;text-align:center">' + (e.doneAmount ? esc(String(e.doneAmount)) : '—') + '</td>' +
        '</tr>';
    }).join('');
    var pager = '';
    if (data.pages > 1) {
      pager = '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;align-items:center">' +
        '<button class="btn-secondary" style="font-size:11px" onclick="_doneLogsPage(' + (data.page - 1) + ')"' +
        (data.page <= 1 ? ' disabled' : '') + '>قبلی</button>' +
        '<span style="font-size:11px">صفحه ' + data.page + ' از ' + data.pages + ' (' + data.total + ')</span>' +
        '<button class="btn-secondary" style="font-size:11px" onclick="_doneLogsPage(' + (data.page + 1) + ')"' +
        (data.page >= data.pages ? ' disabled' : '') + '>بعدی</button></div>';
    }
    return '<div class="tw"><table><thead><tr>' +
      '<th>تاریخ</th><th>مرکز</th><th>نوع</th><th>نتیجه</th><th>یادداشت</th><th>مبلغ</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager;
  };

  window._doneLogsState = { memberId: '', from: '', to: '', page: 1 };

  window._doneLogsPage = function (page) {
    if (page < 1) return;
    var s = window._doneLogsState;
    s.page = page;
    loadExpertDoneLogs(s.memberId, s.from, s.to, page).then(function (data) {
      var el = document.getElementById('erDoneLogsBody');
      if (el) el.innerHTML = renderDoneLogsHtml(data);
    }).catch(function (e) {
      var el = document.getElementById('erDoneLogsBody');
      if (el) el.innerHTML = '<div style="padding:16px;color:#dc2626">خطا: ' + esc(e.message) + '</div>';
    });
  };

  window.refreshDoneLogsFromReport = function (memberId) {
    var fromEl = document.getElementById('rptFrom');
    var toEl = document.getElementById('rptTo');
    window._doneLogsState = {
      memberId: memberId,
      from: fromEl ? fromEl.value : '',
      to: toEl ? toEl.value : '',
      page: 1
    };
    var host = document.getElementById('rptDoneLogsSection');
    if (!host) {
      var rptBody = document.getElementById('rptBody');
      if (!rptBody || !rptBody.parentNode) return;
      host = document.createElement('div');
      host.id = 'rptDoneLogsSection';
      host.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:12px';
      host.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div style="font-weight:700;font-size:13px">📝 آرشیو گزارش‌های انجام‌شده</div>' +
        '<button class="btn-secondary" style="font-size:11px" onclick="_doneLogsPage(1)">🔄 بروزرسانی</button></div>' +
        '<div id="erDoneLogsBody"><div style="padding:16px;text-align:center;color:var(--text-muted)">⏳ بارگذاری...</div></div>';
      rptBody.parentNode.appendChild(host);
    }
    _doneLogsPage(1);
  };

  var _origOpenExpertReport = window.openExpertReport;
  window.openExpertReport = function (memberId) {
    if (_origOpenExpertReport) _origOpenExpertReport(memberId);
    setTimeout(function () {
      refreshDoneLogsFromReport(memberId);
    }, 400);
  };

  console.log('[crm-complete] patches loaded');
})();

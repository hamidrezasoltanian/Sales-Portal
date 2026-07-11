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

  var _origBuildExpertReportHtml = window.buildExpertReportHtml;
  if (typeof _origBuildExpertReportHtml === 'function') {
    window.buildExpertReportHtml = function (memberId, from, to) {
      var html = _origBuildExpertReportHtml(memberId, from, to);
      // Inject done-logs tab button if tab bar exists
      if (html && html.indexOf('erDoneLogsBody') < 0) {
        html = html.replace(
          /(id="erTabBody"[^>]*>)/,
          '$1<div id="erDoneLogsBody" style="display:none"></div>'
        );
      }
      return html;
    };
  }

  // Patch openExpertReport to load done-logs after open
  var _origOpenExpertReport = window.openExpertReport;
  window.openExpertReport = function (memberId) {
    if (_origOpenExpertReport) _origOpenExpertReport(memberId);
    setTimeout(function () {
      var fromEl = document.getElementById('erFrom');
      var toEl = document.getElementById('erTo');
      var from = fromEl ? fromEl.value : '';
      var to = toEl ? toEl.value : '';
      window._doneLogsState = { memberId: memberId, from: from, to: to, page: 1 };

      // Add tab button if missing
      var tabs = document.querySelector('#erTabs, .er-tabs, [data-er-tabs]');
      var modal = document.querySelector('.modal.act, .modal[style*="display: block"], #mExpertReport');
      if (!document.getElementById('erDoneLogsTab')) {
        var tabBar = document.querySelector('[id^="er"] .tabs, .modal-body .tabs');
        if (!tabBar) {
          // Find first button group in expert report modal
          var body = document.querySelector('#erBody') || (modal && modal.querySelector('.modal-body'));
          if (body && !document.getElementById('erDoneLogsBody')) {
            var sec = document.createElement('div');
            sec.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:12px';
            sec.innerHTML =
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
              '<div style="font-weight:700;font-size:13px">📝 گزارش‌های انجام‌شده (نتیجه / یادداشت / مبلغ)</div>' +
              '<button class="btn-secondary" style="font-size:11px" onclick="_doneLogsPage(1)">🔄 بروزرسانی</button></div>' +
              '<div id="erDoneLogsBody"><div style="padding:16px;text-align:center;color:var(--text-muted)">⏳ بارگذاری...</div></div>';
            body.appendChild(sec);
          }
        }
      }
      _doneLogsPage(1);
    }, 400);
  };

  // ── Overdue: lead filter + aging already exists; enhance ──────────────────
  var _origFilterOverdue = window.filterOverdueList;
  window.filterOverdueList = function () {
    if (_origFilterOverdue) _origFilterOverdue();
    // Add lead filter UI if missing
    var bar = document.getElementById('odSearch');
    if (bar && !document.getElementById('odLead')) {
      var sel = document.createElement('select');
      sel.id = 'odLead';
      sel.style.cssText = 'padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px';
      sel.innerHTML = '<option value="">همه وضعیت‌ها</option>' +
        '<option value="فرصت">فرصت</option>' +
        '<option value="سرنخ">سرنخ</option>' +
        '<option value="لید">لید</option>' +
        '<option value="مشتری">مشتری</option>';
      sel.onchange = function () {
        window._odFilters = window._odFilters || {};
        window._odFilters.lead = sel.value;
        if (_origFilterOverdue) {
          // Re-filter: temporarily wrap by hiding rows
          var rows = document.querySelectorAll('#odListBody tr[data-lead]');
          if (rows.length) {
            rows.forEach(function (tr) {
              var lead = tr.getAttribute('data-lead') || '';
              tr.style.display = (!sel.value || lead === sel.value) ? '' : 'none';
            });
          } else {
            _origFilterOverdue();
          }
        }
      };
      bar.parentNode.insertBefore(sel, bar.nextSibling);
    }
  };

  // Patch openOverdueList to annotate rows with lead after render
  var _origOpenOverdue = window.openOverdueList;
  window.openOverdueList = function (memberId) {
    if (_origOpenOverdue) _origOpenOverdue(memberId);
    setTimeout(function () {
      if (typeof filterOverdueList === 'function') filterOverdueList();
      // Annotate rows
      try {
        var tbody = document.getElementById('odListBody');
        if (!tbody) return;
        Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
          if (tr.dataset.leadAnnotated) return;
          var btn = tr.querySelector('[onclick*="openCenterModal"]');
          if (!btn) return;
          var m = (btn.getAttribute('onclick') || '').match(/openCenterModal\('([^']+)','([^']+)'/);
          if (!m) return;
          var e = typeof getE === 'function' ? getE(m[1], m[2]) : {};
          tr.setAttribute('data-lead', e.lead || '');
          tr.dataset.leadAnnotated = '1';
          if (e.lead) {
            var td = tr.cells[0];
            if (td && td.innerHTML.indexOf('data-lead-badge') < 0) {
              td.innerHTML += ' <span data-lead-badge style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px">' +
                esc(e.lead) + (e.oppGrade ? ' ' + e.oppGrade : '') + '</span>';
            }
          }
        });
      } catch (e) { /* ignore */ }
    }, 200);
  };

  // ── One-click reschedule from overdue (ensure helpers exist) ──────────────
  window.odReschedule = function (rtype, rid, days) {
    days = days || 7;
    if (typeof todayStr !== 'function' || typeof j2g !== 'function') return;
    var t = todayStr().split('/');
    var g = j2g(parseInt(t[0], 10), parseInt(t[1], 10), parseInt(t[2], 10));
    var d = new Date(g[0], g[1] - 1, g[2] + days);
    var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    var nd = j[0] + '/' + (j[1] < 10 ? '0' : '') + j[1] + '/' + (j[2] < 10 ? '0' : '') + j[2];
    if (typeof setE === 'function') setE(rtype, rid, 'followupDate', nd);
    if (typeof showToast === 'function') showToast('پیگیری به ' + nd + ' منتقل شد');
    if (typeof filterOverdueList === 'function') filterOverdueList();
  };

  // ── MTR sync consolidation ────────────────────────────────────────────────
  if (typeof window._mtrPullSync === 'function') {
    window._mtrPullSync = function () {
      if (typeof mtrFaradisSync === 'function') return mtrFaradisSync();
      return fetch('/api/mtr/sync', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json(); });
    };
  }

  console.log('[crm-complete] patches loaded');
})();

/* CRM completion patches — deals/files/workflow/HCP wiring helpers,
   action types, done-logs, activity SQL, overdue lead filter, MTR sync fix */
(function () {
  'use strict';

  // ── Shared action type labels (قابل ویرایش از تنظیمات) ───────────────────
  var _DEFAULT_ACTION_TYPE_LABELS = {
    call: '📞 تماس',
    visit: '🤝 ملاقات',
    price_send: '📄 ارسال قیمت',
    sample_send: '🧪 ارسال نمونه',
    committee: '🏛 پیگیری کمیته',
    meeting: '👥 جلسه',
    followup: '🔄 پیگیری',
  };
  window._DEFAULT_ACTION_TYPE_LABELS = _DEFAULT_ACTION_TYPE_LABELS;

  window.applyActionTypeLabels = function (map) {
    var src = map && typeof map === 'object' ? map : _DEFAULT_ACTION_TYPE_LABELS;
    var next = {};
    Object.keys(src).forEach(function (k) {
      var id = String(k).trim();
      var label = String(src[k] || '').trim();
      if (!id || !label) return;
      next[id] = label;
    });
    if (!Object.keys(next).length) next = Object.assign({}, _DEFAULT_ACTION_TYPE_LABELS);
    window.ACTION_TYPE_LABELS = next;
    if (typeof ACTION_TYPE_LABELS !== 'undefined') {
      try { ACTION_TYPE_LABELS = next; } catch (_) {}
    }
    return next;
  };

  /** خطوط تنظیمات: id|برچسب — یا فقط برچسب (id خودکار از slug) */
  window.parseActionTypeListText = function (text) {
    var map = {};
    String(text || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var id, label;
      var pipe = line.indexOf('|');
      if (pipe >= 0) {
        id = line.slice(0, pipe).trim();
        label = line.slice(pipe + 1).trim();
      } else {
        label = line;
        id = line.replace(/[^\u0600-\u06FFa-zA-Z0-9_]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || ('act_' + Date.now().toString(36));
      }
      if (!id || !label) return;
      id = id.replace(/\s+/g, '_');
      map[id] = label;
    });
    return map;
  };

  window.actionTypeListToText = function (map) {
    var src = map || window.ACTION_TYPE_LABELS || _DEFAULT_ACTION_TYPE_LABELS;
    return Object.keys(src).map(function (k) { return k + '|' + src[k]; }).join('\n');
  };

  window.loadActionTypesFromSettings = function () {
    var list = (typeof DB !== 'undefined' && DB.settings && DB.settings.actionTypeList) || null;
    if (Array.isArray(list) && list.length) {
      var map = {};
      list.forEach(function (row) {
        if (!row) return;
        if (typeof row === 'string') {
          var p = window.parseActionTypeListText(row);
          Object.keys(p).forEach(function (k) { map[k] = p[k]; });
        } else if (row.id && row.label) {
          map[row.id] = row.label;
        }
      });
      return window.applyActionTypeLabels(map);
    }
    if (list && typeof list === 'object' && !Array.isArray(list)) {
      return window.applyActionTypeLabels(list);
    }
    return window.applyActionTypeLabels(_DEFAULT_ACTION_TYPE_LABELS);
  };

  if (!window.ACTION_TYPE_LABELS) {
    window.applyActionTypeLabels(_DEFAULT_ACTION_TYPE_LABELS);
  }
  window.wpActKeys = function () {
    return Object.keys(window.ACTION_TYPE_LABELS || _DEFAULT_ACTION_TYPE_LABELS);
  };
  window.wpActLabel = function (t) {
    var labels = window.ACTION_TYPE_LABELS || _DEFAULT_ACTION_TYPE_LABELS;
    return labels[t] || labels.call || '📞 تماس';
  };
  window.wpActOptionsHtml = function (selected) {
    selected = selected || 'call';
    var labels = window.ACTION_TYPE_LABELS || _DEFAULT_ACTION_TYPE_LABELS;
    return wpActKeys().map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' +
        esc(labels[k] || k) + '</option>';
    }).join('');
  };
  window.wpActBg = function (t) {
    var map = {
      call: '#0ea5e9', visit: '#8b5cf6', price_send: '#059669',
      sample_send: '#d97706', committee: '#b45309', meeting: '#7c3aed', followup: '#64748b',
    };
    if (map[t]) return map[t];
    // رنگ پایدار برای انواع سفارشی
    var hues = [200, 260, 150, 30, 340, 180, 80];
    var keys = wpActKeys();
    var idx = Math.max(0, keys.indexOf(t));
    return 'hsl(' + hues[idx % hues.length] + ' 70% 42%)';
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

  // ── Patch toggleWpActionType: persist via API, soft-render (no race) ─────
  window.toggleWpActionType = function (eKey) {
    if (!DB.weekEntries || !DB.weekEntries[eKey]) return;
    var keys = typeof wpActKeys === 'function' ? wpActKeys() : Object.keys(window.ACTION_TYPE_LABELS || { call: 1, visit: 1 });
    if (!keys.length) keys = ['call', 'visit'];
    var cur = DB.weekEntries[eKey].actionType || 'call';
    var idx = keys.indexOf(cur);
    var next = keys[(idx < 0 ? 0 : idx + 1) % keys.length];
    DB.weekEntries[eKey].actionType = next;
    var saveP = typeof saveWeekEntryApi === 'function'
      ? saveWeekEntryApi(eKey, DB.weekEntries[eKey])
      : Promise.resolve();
    saveP.then(function () {
      if (typeof renderWeekPlan === 'function') renderWeekPlan({ soft: true });
      else if (typeof _debouncedRenderWeekPlan === 'function') _debouncedRenderWeekPlan();
    }).catch(function () {
      if (typeof showToast === 'function') showToast('⚠ ذخیره نوع پیگیری ناموفق', 2500);
    });
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

  // ── Settings: row-based action types editor ───────────────────────────────
  window._canEditActionTypes = function () {
    if (typeof _isManager === 'function' && _isManager()) return true;
    if (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) return true;
    if (typeof crmCanDataAdmin === 'function' && crmCanDataAdmin()) return true;
    var role = (typeof crmResolveCurrentRole === 'function' ? crmResolveCurrentRole() : '') || window._authUserRole || '';
    if (role === 'سوپروایزر' || role === 'مدیر' || role === 'سوپر ادمین') return true;
    return false;
  };

  window.openActionTypesSettings = function () {
    if (!window._canEditActionTypes()) {
      if (typeof showToast === 'function') showToast('⚠ فقط مدیر می‌تواند انواع پیگیری را ویرایش کند');
      return;
    }
    var labels = window.ACTION_TYPE_LABELS || _DEFAULT_ACTION_TYPE_LABELS;
    window._actTypesPending = Object.keys(labels).map(function (id) {
      return { id: id, label: labels[id] };
    });
    window._renderActTypesEditor();
  };

  window._renderActTypesEditor = function () {
    var rows = window._actTypesPending || [];
    var body = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.6">'
      + 'این انواع در برنامه هفته، تخصیص، و کلیک روی بج کارت استفاده می‌شوند. '
      + 'شناسه لاتین بدون فاصله باشد (مثل <code>call</code>، <code>price_send</code>).'
      + '</div>'
      + '<div id="actTypesRows" style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;margin-bottom:10px">'
      + rows.map(function (r, i) {
        return '<div style="display:flex;gap:6px;align-items:center;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:6px 8px">'
          + '<input class="ed-inp" style="width:110px;font-family:monospace;font-size:11px" id="actId_' + i + '" value="' + esc(r.id) + '" placeholder="id" dir="ltr">'
          + '<input class="ed-inp" style="flex:1;font-size:12px" id="actLabel_' + i + '" value="' + esc(r.label) + '" placeholder="برچسب نمایشی">'
          + '<button type="button" onclick="_actTypeRemoveRow(' + i + ')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px" title="حذف">✕</button>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<button type="button" onclick="_actTypeAddRow()" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit">+ نوع جدید</button>';

    var foot = '<button class="btn-secondary" onclick="closeModal(\'actTypesModal\')">انصراف</button>'
      + '<button class="btn-primary" onclick="_actTypeSave()">💾 ذخیره انواع</button>';
    if (typeof openModal === 'function') {
      openModal('actTypesModal', '📋 انواع پیگیری برنامه هفته', body, foot, { lg: true });
    }
  };

  window._actTypeCollectRows = function () {
    var out = [];
    var i = 0;
    while (document.getElementById('actId_' + i) || document.getElementById('actLabel_' + i)) {
      var idEl = document.getElementById('actId_' + i);
      var labEl = document.getElementById('actLabel_' + i);
      if (idEl || labEl) {
        var id = ((idEl && idEl.value) || '').trim().replace(/\s+/g, '_');
        var label = ((labEl && labEl.value) || '').trim();
        if (id && label) out.push({ id: id, label: label });
      }
      i++;
      if (i > 80) break;
    }
    return out;
  };

  window._actTypeAddRow = function () {
    window._actTypesPending = window._actTypeCollectRows();
    window._actTypesPending.push({ id: 'custom_' + Date.now().toString(36).slice(-4), label: '' });
    window._renderActTypesEditor();
  };

  window._actTypeRemoveRow = function (idx) {
    window._actTypesPending = window._actTypeCollectRows();
    window._actTypesPending.splice(idx, 1);
    if (!window._actTypesPending.length) {
      window._actTypesPending = [{ id: 'call', label: '📞 تماس' }, { id: 'visit', label: '🤝 ملاقات' }];
    }
    window._renderActTypesEditor();
  };

  window._actTypeSave = function () {
    var rows = window._actTypeCollectRows();
    if (!rows.length) {
      if (typeof showToast === 'function') showToast('⚠ حداقل یک نوع لازم است');
      return;
    }
    var map = {};
    rows.forEach(function (r) { map[r.id] = r.label; });
    if (typeof applyActionTypeLabels === 'function') applyActionTypeLabels(map);
    if (!DB.settings) DB.settings = {};
    DB.settings.actionTypeList = rows;
    var patch = { actionTypeList: rows };
    var done = function () {
      if (typeof closeModal === 'function') closeModal('actTypesModal');
      if (typeof wpBuildDefaultActType === 'function') wpBuildDefaultActType();
      if (typeof showToast === 'function') showToast('✅ انواع پیگیری ذخیره شد', 2500);
    };
    if (typeof patchCrmSetting === 'function') patchCrmSetting('actionTypeList', rows);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || r.status);
        return d;
      });
    }).then(done).catch(function (e) {
      console.warn('[actTypeSave]', e && e.message);
      done();
    });
  };

  console.log('[crm-complete] patches loaded');
})();
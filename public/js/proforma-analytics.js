// ════════════════════════════════════════════════════════════════════════════
// PROFORMA ANALYTICS — reports, advanced filters, workload, timeline, tasks
// Extends proforma.js without removing existing features
// ════════════════════════════════════════════════════════════════════════════
'use strict';

var PF_CHANNELS = {
  direct: 'تماس مستقیم',
  tender: 'مناقصه',
  visit: 'ویزیت حضوری',
  web: 'وب‌سایت',
};

var PF_PAYMENT_TERMS = {
  cash: 'نقد',
  installment: 'اقساط',
  check: 'چک',
  credit30: 'اعتبار ۳۰ روز',
  credit60: 'اعتبار ۶۰ روز',
};

var PF_LOSS_REASONS = {
  price_high: 'قیمت بالا',
  competitor: 'رقیب',
  need_change: 'تغییر نیاز مشتری',
  no_response: 'عدم پاسخ مشتری',
  other: 'سایر',
};

var _pfDateFrom = '';
var _pfDateTo = '';
var _pfAmtMin = '';
var _pfAmtMax = '';
var _pfChannelF = '';
var _pfQuickF = '';
var _pfShowReports = false;
var _pfReportTab = 'category';
var _pfWorkload = null;

function _pfLoadSavedFilters() {
  try {
    var raw = localStorage.getItem('pfSavedFilters_' + (typeof currentUser !== 'undefined' ? currentUser : 'all'));
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function _pfSaveFilterPreset(name) {
  var preset = {
    name: name,
    search: _pfSearch, owner: _pfOwnerF, cat: _pfCatF, prod: _pfProdF,
    dateFrom: _pfDateFrom, dateTo: _pfDateTo, channel: _pfChannelF,
    amountMin: _pfAmtMin, amountMax: _pfAmtMax, quick: _pfQuickF, status: _pfFilter,
  };
  var list = _pfLoadSavedFilters().filter(function(p) { return p.name !== name; });
  list.unshift(preset);
  if (list.length > 12) list = list.slice(0, 12);
  localStorage.setItem('pfSavedFilters_' + currentUser, JSON.stringify(list));
  showToast('✅ فیلتر «' + name + '» ذخیره شد');
}

function _pfApplyPreset(preset) {
  _pfSearch = preset.search || '';
  _pfOwnerF = preset.owner || '';
  _pfCatF = preset.cat || '';
  _pfProdF = preset.prod || '';
  _pfDateFrom = preset.dateFrom || '';
  _pfDateTo = preset.dateTo || '';
  _pfChannelF = preset.channel || '';
  _pfAmtMin = preset.amountMin || '';
  _pfAmtMax = preset.amountMax || '';
  _pfQuickF = preset.quick || '';
  if (preset.status) _pfFilter = preset.status;
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfComputeExpiry(pf) {
  if (pf.expiryDate) return pf.expiryDate;
  if (!pf.jalaliDate || !pf.validDays) return '';
  if (typeof jAdd === 'function') {
    var p = pf.jalaliDate.split('/');
    if (p.length >= 3) {
      var j = jAdd(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10), pf.validDays || 0);
      return j[0] + '/' + p2(j[1]) + '/' + p2(j[2]);
    }
  }
  return '';
}

function _pfApplyAdvancedFilters(list) {
  var today = typeof todayStr === 'function' ? todayStr() : '';
  return list.filter(function(pf) {
    if (_pfDateFrom && (pf.jalaliDate || '') < _pfDateFrom) return false;
    if (_pfDateTo && (pf.jalaliDate || '') > _pfDateTo) return false;
    if (_pfAmtMin && _pfPfAmount(pf) < Number(_pfAmtMin)) return false;
    if (_pfAmtMax && _pfPfAmount(pf) > Number(_pfAmtMax)) return false;
    if (_pfChannelF && (pf.channel || 'direct') !== _pfChannelF) return false;
    if (_pfQuickF === 'today') {
      if ((pf.jalaliDate || '') !== today) return false;
    } else if (_pfQuickF === 'week') {
      if (!pf.jalaliDate) return false;
    } else if (_pfQuickF === 'near_expiry') {
      var exp = _pfComputeExpiry(pf);
      if (!exp || exp < today || exp > (typeof jAdd === 'function' ? (function() {
        var t = today.split('/');
        var e = jAdd(parseInt(t[0],10), parseInt(t[1],10), parseInt(t[2],10), 3);
        return e[0]+'/'+p2(e[1])+'/'+p2(e[2]);
      })() : exp)) return false;
    } else if (_pfQuickF === 'no_followup') {
      if (pf.lastFollowupAt) return false;
      if (!['sent','negotiating'].includes(pf.status)) return false;
    } else if (_pfQuickF === 'high_disc') {
      if ((pf.discountPct || 0) < 15) return false;
    }
    return true;
  });
}

function _pfOnAdvancedFilterChange() {
  _pfDateFrom = (document.getElementById('pfDateFrom') || {}).value || '';
  _pfDateTo = (document.getElementById('pfDateTo') || {}).value || '';
  _pfAmtMin = (document.getElementById('pfAmtMin') || {}).value || '';
  _pfAmtMax = (document.getElementById('pfAmtMax') || {}).value || '';
  _pfChannelF = (document.getElementById('pfChannelSel') || {}).value || '';
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfOnQuickFilter(q) {
  _pfQuickF = (_pfQuickF === q) ? '' : q;
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfClearAllFilters() {
  _pfClearFilters();
  _pfDateFrom = _pfDateTo = _pfAmtMin = _pfAmtMax = _pfChannelF = _pfQuickF = '';
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfBuildAdvancedFilterBar() {
  var chOpts = '<option value="">همه کانال‌ها</option>' +
    Object.keys(PF_CHANNELS).map(function(k) {
      return '<option value="' + k + '"' + (_pfChannelF === k ? ' selected' : '') + '>' + PF_CHANNELS[k] + '</option>';
    }).join('');
  var saved = _pfLoadSavedFilters();
  var savedOpts = saved.map(function(p, i) {
    return '<option value="' + i + '">' + esc(p.name) + '</option>';
  }).join('');

  var quickBtns = [
    { id: 'today', label: 'امروز' },
    { id: 'near_expiry', label: 'نزدیک انقضا' },
    { id: 'no_followup', label: 'بدون پیگیری' },
    { id: 'high_disc', label: 'تخفیف بالا' },
  ].map(function(q) {
    var on = _pfQuickF === q.id;
    return '<button onclick="_pfOnQuickFilter(\'' + q.id + '\')" style="padding:4px 10px;border-radius:14px;border:1px solid ' +
      (on ? 'var(--brand)' : '#e2e8f0') + ';background:' + (on ? '#eef2ff' : 'white') + ';font-size:11px;font-family:inherit;cursor:pointer">' +
      q.label + '</button>';
  }).join('');

  return '<div id="pfAdvFilterBar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;padding:8px 12px;background:#fff;border:1px dashed #cbd5e1;border-radius:10px">' +
    '<input id="pfDateFrom" type="text" placeholder="از تاریخ" value="' + esc(_pfDateFrom) + '" onclick="openJDP(this,function(v){document.getElementById(\'pfDateFrom\').value=v;_pfOnAdvancedFilterChange()})" style="width:100px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit">' +
    '<input id="pfDateTo" type="text" placeholder="تا تاریخ" value="' + esc(_pfDateTo) + '" onclick="openJDP(this,function(v){document.getElementById(\'pfDateTo\').value=v;_pfOnAdvancedFilterChange()})" style="width:100px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit">' +
    '<input id="pfAmtMin" type="number" placeholder="حداقل مبلغ" value="' + esc(_pfAmtMin) + '" onchange="_pfOnAdvancedFilterChange()" style="width:110px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit">' +
    '<input id="pfAmtMax" type="number" placeholder="حداکثر مبلغ" value="' + esc(_pfAmtMax) + '" onchange="_pfOnAdvancedFilterChange()" style="width:110px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit">' +
    '<select id="pfChannelSel" onchange="_pfOnAdvancedFilterChange()" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit">' + chOpts + '</select>' +
    '<div style="display:flex;gap:4px;flex-wrap:wrap">' + quickBtns + '</div>' +
    (saved.length ? '<select onchange="if(this.value!==\'\'){_pfApplyPreset((' + JSON.stringify(saved) + ')[this.value]);this.value=\'\'}" style="padding:5px 8px;border:1px solid #bae6fd;border-radius:6px;font-size:11px;font-family:inherit;background:#f0f9ff"><option value="">⭐ فیلترهای ذخیره</option>' + savedOpts + '</select>' : '') +
    '<button onclick="var n=prompt(\'نام فیلتر:\');if(n)_pfSaveFilterPreset(n)" style="padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;font-size:11px;font-family:inherit;cursor:pointer" title="ذخیره فیلتر فعلی">💾</button>' +
    '<button onclick="_pfToggleReports()" style="padding:4px 12px;border:1px solid #86efac;border-radius:6px;background:#f0fdf4;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600">📊 گزارش</button>' +
    '<button onclick="pfExportFiltered()" style="padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:white;font-size:11px;font-family:inherit;cursor:pointer">📥 Excel</button>' +
  '</div>';
}

function _pfToggleReports() {
  _pfShowReports = !_pfShowReports;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfBuildReportsPanel(list) {
  if (!_pfShowReports) return '';
  var tabs = [
    { id: 'category', label: 'دسته کالا' },
    { id: 'product', label: 'کالا' },
    { id: 'expert', label: 'مسئول' },
    { id: 'planning', label: 'برنامه‌ریزی' },
    { id: 'funnel', label: 'قیف فروش' },
  ];
  var tabBtns = tabs.map(function(t) {
    return '<button onclick="_pfReportTab=\'' + t.id + '\';_pfToggleReports();_pfToggleReports()" style="padding:5px 12px;border-radius:8px;border:1px solid ' +
      (_pfReportTab === t.id ? 'var(--brand)' : '#e2e8f0') + ';background:' + (_pfReportTab === t.id ? '#eef2ff' : 'white') +
      ';font-size:11px;font-family:inherit;cursor:pointer">' + t.label + '</button>';
  }).join('');

  var body = '';
  if (_pfReportTab === 'planning') {
    var rows = _pfBuildPlanningRows(list);
    body = '<div style="overflow-x:auto;max-height:320px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' +
      '<thead><tr style="background:#f8fafc;position:sticky;top:0"><th style="padding:6px;text-align:right">مسئول</th><th>مرکز</th><th>دسته</th><th>کالا</th><th>مبلغ</th><th>وضعیت</th><th>عمل</th></tr></thead><tbody>' +
      rows.slice(0, 100).map(function(r) {
        return '<tr style="border-top:1px solid #f1f5f9"><td>' + esc(r.expert) + '</td><td>' + esc(r.centerName) + '</td><td>' + esc(r.category) +
          '</td><td>' + esc(r.product) + '</td><td style="font-family:monospace">' + fmtNum(r.amount) + '</td><td>' + esc(r.status) +
          '</td><td>' + (r.pfId && r.rawStatus !== 'invoiced' ? '<button onclick="pfAddToToday(\'' + r.pfId + '\')" style="font-size:10px;padding:2px 6px;border:1px solid #86efac;border-radius:4px;background:#dcfce7;cursor:pointer">➕</button>' : '') + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  } else if (_pfReportTab === 'funnel') {
    var stages = ['sent', 'negotiating', 'approved', 'invoiced', 'rejected', 'expired'];
    body = '<div style="display:flex;gap:8px;flex-wrap:wrap">' + stages.map(function(st) {
      var cnt = list.filter(function(p) { return p.status === st; }).length;
      var val = list.filter(function(p) { return p.status === st; }).reduce(function(s, p) { return s + _pfPfAmount(p); }, 0);
      return '<div style="flex:1;min-width:90px;text-align:center;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">' +
        '<div style="font-size:18px;font-weight:800;color:var(--brand)">' + cnt + '</div>' +
        '<div style="font-size:10px;color:#64748b">' + _pfStatusLabel(st) + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:4px">' + fmtNum(val) + ' ﷼</div></div>';
    }).join('') + '</div>';
  } else {
    var agg = _pfBuildAggReport(list, _pfReportTab);
    body = '<div style="overflow-x:auto;max-height:320px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' +
      '<thead><tr style="background:#f8fafc;position:sticky;top:0"><th style="padding:6px;text-align:right">عنوان</th><th>پیش‌فاکتور</th><th>تعداد</th><th>مبلغ</th><th>مراکز</th></tr></thead><tbody>' +
      agg.slice(0, 50).map(function(r) {
        return '<tr style="border-top:1px solid #f1f5f9"><td><strong>' + esc(r.label) + '</strong>' +
          (r.sub ? '<div style="font-size:10px;color:#94a3b8">' + esc(r.sub) + '</div>' : '') +
          '</td><td>' + r.pfCount + '</td><td>' + fmtNum(r.qty) + '</td><td style="font-family:monospace;font-weight:700">' + fmtNum(r.amount) + '</td><td>' + r.centerCount + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  return '<div style="margin-bottom:14px;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
      '<div style="font-weight:700;font-size:14px;color:#1e293b">📊 گزارش پیش‌فاکتور (' + list.length + ' مورد فیلترشده)</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap">' + tabBtns + '</div>' +
    '</div>' + body + '</div>';
}

async function _pfLoadWorkload() {
  if (!_pfIsManager()) return;
  try {
    var r = await fetch('/api/proforma/workload');
    if (r.status === 404) { _pfWorkload = null; return; }
    if (r.ok) _pfWorkload = await r.json();
  } catch (_) {}
}

function _pfBuildWorkloadBar() {
  if (!_pfIsManager() || !_pfWorkload || !_pfWorkload.rows) return '';
  var rows = _pfWorkload.rows.slice(0, 6);
  if (!rows.length) return '';
  return '<div style="margin-bottom:12px;padding:10px 14px;background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1px solid #d8b4fe;border-radius:10px">' +
    '<div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:8px">⚖️ بار کاری فروشندگان (پیش‌فاکتور باز)</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    rows.map(function(w) {
      var name = typeof _pfCreatorName === 'function' ? _pfCreatorName(w.expert) : w.expert;
      return '<div style="flex:1;min-width:120px;background:white;border:1px solid #e9d5ff;border-radius:8px;padding:8px;text-align:center">' +
        '<div style="font-size:12px;font-weight:700;color:#6d28d9">' + esc(name) + '</div>' +
        '<div style="font-size:16px;font-weight:800;color:#1e293b">' + w.openCount + ' <span style="font-size:10px;font-weight:400;color:#94a3b8">باز</span></div>' +
        '<div style="font-size:10px;color:#64748b">' + fmtNum(w.openValue) + ' ﷼</div></div>';
    }).join('') +
    '</div></div>';
}

function pfExportFiltered() {
  var list = _pfGetFilteredList();
  if (typeof XLSX === 'undefined') { showToast('❌ کتابخانه Excel لود نشده'); return; }
  var rows = list.map(function(pf) {
    return {
      'شماره': pf.no,
      'تاریخ': pf.jalaliDate,
      'انقضا': _pfComputeExpiry(pf),
      'مرکز': pf.centerName,
      'مبلغ': pf.total,
      'وضعیت': _pfStatusLabel(pf.status),
      'مسئول': _pfGetResponsibleName(pf),
      'کانال': PF_CHANNELS[pf.channel] || pf.channel || '',
      'شرایط پرداخت': PF_PAYMENT_TERMS[pf.paymentTerms] || pf.paymentTerms || '',
      'ردیف کالا': (pf.items || []).length,
    };
  });
  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'پیشفاکتور');
  XLSX.writeFile(wb, 'proforma-export-' + (typeof todayStr === 'function' ? todayStr() : 'export') + '.xlsx');
  showToast('✅ ' + rows.length + ' ردیف export شد');
}

function pfCreateTask(pfId) {
  var pf = _pfList.find(function(p) { return p.id === pfId; });
  if (!pf) return;
  if (typeof openTaskModal !== 'function') { showToast('❌ ماژول وظایف لود نشده'); return; }
  var exp = _pfComputeExpiry(pf);
  openTaskModal(null, {
    title: 'پیگیری پیش‌فاکتور ' + (pf.no || ''),
    owner: _pfGetResponsibleId(pf) || pf.createdBy || currentUser,
    dueDate: exp || (typeof todayStr === 'function' ? todayStr() : ''),
    priority: 2,
    centerKey: pf.centerKey || '',
    note: 'پیش‌فاکتور ' + pf.no + ' — ' + (pf.centerName || ''),
  });
}

function _pfAutoTaskOnSend(pf) {
  if (!pf || typeof openTaskModal !== 'function') return;
  _ensureTasks && _ensureTasks();
  if (!DB.tasks) DB.tasks = [];
  var owner = _pfGetResponsibleId(pf) || pf.createdBy || currentUser;
  var due = typeof todayStr === 'function' ? todayStr() : '';
  if (typeof jAdd === 'function' && due) {
    var t = due.split('/');
    var j = jAdd(parseInt(t[0],10), parseInt(t[1],10), parseInt(t[2],10), 2);
    due = j[0] + '/' + p2(j[1]) + '/' + p2(j[2]);
  }
  var task = {
    id: 'pf_task_' + Date.now(),
    title: '📞 پیگیری اولیه — ' + (pf.no || ''),
    owner: owner,
    dueDate: due,
    priority: 2,
    status: 'todo',
    done: false,
    centerKey: pf.centerKey || '',
    note: 'تسک خودکار پس از ارسال پیش‌فاکتور',
    subtasks: [],
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  };
  DB.tasks.push(task);
  if (typeof saveDB === 'function') saveDB();
  if (typeof sendNotif === 'function') sendNotif(owner, '📌 تسک پیگیری پیش‌فاکتور ' + pf.no + ' ساخته شد', pf.centerKey);
}

function _pfWrapProformaCore() {
  if (typeof _pfApplySearch !== 'function' || _pfApplySearch._pfWrapped) return;
  var origSearch = _pfApplySearch;
  _pfApplySearch = function(list) {
    return _pfApplyAdvancedFilters(origSearch(list));
  };
  _pfApplySearch._pfWrapped = true;

  if (typeof pfAction === 'function' && !pfAction._pfWrapped) {
    var origAction = pfAction;
    pfAction = async function(id, action, note, extra) {
      if (action === 'send') {
        var pfBefore = _pfList.find(function(p) { return p.id === id; });
        await origAction(id, action, note, extra);
        var pf = _pfList.find(function(p) { return p.id === id; }) || pfBefore;
        if (pf) _pfAutoTaskOnSend(pf);
        return;
      }
      return origAction(id, action, note, extra);
    };
    pfAction._pfWrapped = true;
  }

  if (typeof _renderPfPanel === 'function' && !_renderPfPanel._pfAnalyticsWrapped) {
    var origRender = _renderPfPanel;
    _renderPfPanel = function(el) {
      _pfLoadWorkload();
      origRender(el);
      if (!el) return;
      var searchBar = document.getElementById('pfSearchBar');
      if (searchBar && !document.getElementById('pfAdvFilterBar')) {
        searchBar.insertAdjacentHTML('afterend', _pfBuildAdvancedFilterBar());
      }
      var statsEl = el.querySelector('[data-pf-stats]');
      if (statsEl && !document.getElementById('pfWorkloadBar')) {
        var wbHtml = _pfBuildWorkloadBar();
        if (wbHtml) statsEl.insertAdjacentHTML('afterend', wbHtml.replace('<div style=', '<div id="pfWorkloadBar" style='));
      }
      if (_pfShowReports && !document.getElementById('pfReportsPanel')) {
        var filtered = _pfGetFilteredList();
        var tableDiv = document.getElementById('pfListTbody');
        if (tableDiv && tableDiv.closest('div')) {
          tableDiv.closest('div').insertAdjacentHTML('beforebegin',
            _pfBuildReportsPanel(filtered).replace('<div style=', '<div id="pfReportsPanel" style='));
        }
      }
    };
    _renderPfPanel._pfAnalyticsWrapped = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _pfWrapProformaCore);
} else {
  setTimeout(_pfWrapProformaCore, 100);
}

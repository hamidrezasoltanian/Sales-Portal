'use strict';
/* بازرگانی — KPI مبتنی بر هدف (۷ شاخص) */
(function() {

  var _tkTab = 'score';  // score | kanban | customs | report | admin | supplier | finance | team | warehouse
  var _tkEmployee = '';
  var _tkMonth = '';
  var _tkScore = null;
  var _tkTargets = null;
  var _tkMonthRecord = null;
  var _tkTradeEmployees = null;
  var _tkTemplates = [];
  var _tkCases = [];
  var _tkCaseFilter = 'active';
  var _tkWmsImporting = false;

  // ── Date helpers ───────────────────────────────────────────────────────────
  var _TK_JMONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  function _tkJYear() {
    var d = new Date();
    var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j[0];
  }

  function _tkMonthKey(year, month) {
    return year + '/' + (typeof p2 === 'function' ? p2(month) : String(month).padStart(2, '0'));
  }

  function _tkMonthLabel(year, month) {
    return _TK_JMONTHS[month - 1] + ' ' + year;
  }

  function _tkMonthLabelFromKey(key) {
    var parts = String(key || '').split('/');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    return year && month >= 1 && month <= 12 ? _tkMonthLabel(year, month) : String(key || '');
  }

  function _tkBuildMonthOptions() {
    var curYear = _tkJYear();
    var out = [];
    for (var y = curYear; y >= curYear - 2; y--) {
      for (var m = 1; m <= 12; m++) {
        out.push({ value: _tkMonthKey(y, m), label: _tkMonthLabel(y, m) });
      }
    }
    out.sort(function(a, b) { return b.value.localeCompare(a.value); });
    return out;
  }

  function _tkDateInput(id, value, width, placeholder) {
    var ph = placeholder || '۱۴۰۴/۰۱/۰۱';
    return '<input id="' + id + '" type="text" value="' + esc(value || '') + '" readonly placeholder="' + ph + '" ' +
      'style="' + _tkInputStyle(width || 120) + 'cursor:pointer" ' +
      'onclick="if(typeof openJDP===\'function\')openJDP(this,function(v){this.value=v})">';
  }

  function _tkCurrentMonth() {
    var d = new Date();
    var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j[0] + '/' + String(j[1]).padStart(2, '0');
  }

  function _tkToday() {
    var d = new Date();
    var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0');
  }

  function _tkIsManager() {
    if (typeof _isManager === 'function') return _isManager();
    return false;
  }

  function _tkAPI(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    if (body) opts.body = JSON.stringify(body);
    return fetch('/api/trade-kpi' + path, opts).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.status); });
      return r.json();
    });
  }

  function _tkTradeAPI(method, resource, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    if (body) opts.body = JSON.stringify(body);
    return fetch('/api/' + resource + path, opts).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.status); });
      return r.json();
    });
  }

  function _tkGetTradeMembers() {
    var out = [];
    var seen = {};
    function add(id, name) {
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push({ id: id, name: name || id });
    }
    var members = (typeof DB !== 'undefined' && DB.settings && DB.settings.members) ? DB.settings.members : [];
    if (!members.length && typeof _DEFAULT_MEMBERS !== 'undefined') members = _DEFAULT_MEMBERS;
    members.forEach(function(m) {
      if (m.active === false) return;
      var role = m.role || '';
      if (role === 'بازرگانی' || role === 'کارشناس بازرگانی' || role.indexOf('بازرگانی') >= 0) {
        add(m.id, m.name);
      }
    });
    if (!out.length && Array.isArray(_tkTradeEmployees) && _tkTradeEmployees.length) {
      _tkTradeEmployees.forEach(function(m) {
        add(m.username, m.display_name || (typeof USERS !== 'undefined' ? USERS[m.username] : m.username));
      });
    }
    if (!out.length && typeof USERS !== 'undefined') {
      Object.keys(USERS).forEach(function(uid) { add(uid, USERS[uid]); });
    }
    return out;
  }

  function _tkBuildEmpSelect() {
    var members = _tkGetTradeMembers();
    if (!_tkIsManager()) return '';
    if (!members.length) {
      return '<span style="font-size:.82rem;color:#f59e0b">کارشناس بازرگانی تعریف نشده — از تنظیمات نقش «بازرگانی» اضافه کنید</span>';
    }
    if (!_tkEmployee) _tkEmployee = members[0].id;
    var html = '<select onchange="window._tkSetEmployee(this.value)" style="' + _tkInputStyle() + 'min-width:160px">' +
      '<option value="">انتخاب کارشناس</option>';
    members.forEach(function(m) {
      html += '<option value="' + esc(m.id) + '"' + (m.id === _tkEmployee ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    });
    html += '</select>';
    return html;
  }

  function _tkRefreshTradeEmployees() {
    _tkAPI('GET', '/employees').then(function(rows) {
      if (rows && rows.length) _tkTradeEmployees = rows;
    }).catch(function() { /* keep local members */ });
  }

  function _tkFmt(n) {
    if (!n) return '۰';
    n = parseFloat(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' میلیارد';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' میلیون';
    return n.toLocaleString('fa-IR');
  }

  function _tkBar(pct) {
    pct = Math.min(100, Math.max(0, pct || 0));
    var bg = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return '<div style="flex:1;background:#e2e8f0;border-radius:99px;height:12px;overflow:hidden">' +
      '<div style="width:' + pct + '%;background:' + bg + ';height:100%;border-radius:99px;transition:width .5s"></div>' +
      '</div>';
  }

  function _tkScoreColor(pct) {
    return pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  }

  function _tkDefaultTargets() {
    return {
      customs_target: 5, customs_days_target: 10, customs_weight: 20,
      report_weight: 15, admin_target: 10, admin_weight: 20,
      supplier_target: 2, supplier_weight: 15, finance_target: 0,
      finance_weight: 15, team_weight: 10, warehouse_weight: 5
    };
  }

  function _tkInputStyle(w) {
    return 'border:1px solid #e2e8f0;border-radius:7px;padding:6px 10px;font-family:inherit;font-size:.85rem;' +
      (w ? 'width:' + (typeof w === 'number' ? w + 'px' : w) + ';' : '') + 'box-sizing:border-box';
  }

  function _tkTextareaStyle() {
    return 'width:100%;border:1px solid #e2e8f0;border-radius:7px;padding:8px 10px;font-family:inherit;font-size:.85rem;resize:vertical;box-sizing:border-box';
  }

  function _tkBtnStyle() {
    return 'padding:7px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem;white-space:nowrap';
  }

  function _tkDimHeader(title, dim, help) {
    var score = dim ? dim.score : 0;
    var color = _tkScoreColor(score);
    return '<div style="background:#fff;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<h3 style="margin:0;font-size:1rem;font-weight:700">' + title + '</h3>' +
        '<span style="font-size:1.4rem;font-weight:800;color:' + color + '">' + score + '<span style="font-size:.8rem">٪</span></span>' +
      '</div>' +
      _tkBar(score) +
      '<div style="margin-top:10px;font-size:.78rem;color:#6b7280;background:#f8fafc;border-radius:6px;padding:8px">' + help + '</div>' +
      '</div>';
  }

  // ── Main render ────────────────────────────────────────────────────────────
  window.renderTradeKPIPanel = function() {
    if (!_tkMonth) _tkMonth = _tkCurrentMonth();
    if (!_tkEmployee) {
      if (!_tkIsManager() && typeof currentUser !== 'undefined') _tkEmployee = currentUser;
    }

    var root = document.getElementById('tradeKPIRoot');
    if (!root) return;

    // Period selection stays in the header while only the panel body refreshes.
    var periodParts = String(_tkMonth).split('/');
    var selectedYear = parseInt(periodParts[0], 10) || _tkJYear();
    var selectedMonth = parseInt(periodParts[1], 10) || 1;
    var yearOptions = [];
    for (var yi = _tkJYear() + 1; yi >= _tkJYear() - 4; yi--) {
      yearOptions.push('<option value="' + yi + '"' + (yi === selectedYear ? ' selected' : '') + '>' + yi + '</option>');
    }
    var monthOptions = _TK_JMONTHS.map(function(name, index) {
      var value = index + 1;
      return '<option value="' + value + '"' + (value === selectedMonth ? ' selected' : '') + '>' + name + '</option>';
    }).join('');
    var periodNav = '<div style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px">' +
      '<span style="font-size:.72rem;color:#64748b">دوره ارزیابی</span>' +
      '<select id="tkPeriodMonth" onchange="window._tkSetPeriodFromControls()" style="' + _tkInputStyle(96) + '">' + monthOptions + '</select>' +
      '<select id="tkPeriodYear" onchange="window._tkSetPeriodFromControls()" style="' + _tkInputStyle(76) + '">' + yearOptions.join('') + '</select>' +
      '<button type="button" onclick="window._tkUseCurrentMonth()" style="padding:5px 8px;border:0;background:transparent;color:#4f46e5;cursor:pointer;font-family:inherit;font-size:.76rem">ماه جاری</button>' +
      '</div>';

    var empSel = _tkBuildEmpSelect();
    _tkRefreshTradeEmployees();

    var tabs = [
      { id: 'cases',     icon: '📂', label: 'پرونده‌ها' },
      { id: 'score',     icon: '📊', label: 'نمره KPI' },
      { id: 'history',   icon: '📈', label: 'تاریخچه' },
      { id: 'kanban',    icon: '📌', label: 'وظایف' },
      { id: 'customs',   icon: '📦', label: 'ترخیص' },
      { id: 'report',    icon: '📋', label: 'گزارش روزانه' },
      { id: 'admin',     icon: '📁', label: 'پیگیری اداری' },
      { id: 'supplier',  icon: '🔍', label: 'تامین‌کننده' },
      { id: 'finance',   icon: '💰', label: 'بهبود مالی' },
      { id: 'team',      icon: '👥', label: 'تیمی' },
      { id: 'warehouse', icon: '🏭', label: 'انبار' },
      { id: 'milestones', icon: '🏆', label: 'پاداش پروژه' },
      { id: 'deductions', icon: '➖', label: 'کسورات' },
      { id: 'treports',  icon: '📈', label: 'گزارش بازرگانی' }
    ];
    if (_tkIsManager()) {
      tabs.splice(2, 0, { id: 'templates', icon: '⚙️', label: 'فرآیندها' });
    }

    var tabBtns = tabs.map(function(t) {
      var active = t.id === _tkTab;
      return '<button onclick="window._tkSetTab(\'' + t.id + '\')" ' +
        'style="padding:6px 12px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.83rem;' +
        'background:' + (active ? '#6366f1' : '#f1f5f9') + ';color:' + (active ? '#fff' : '#374151') + '">' +
        t.icon + ' ' + t.label + '</button>';
    }).join('');

    var empLabel = '';
    if (_tkEmployee) {
      var empName = (typeof USERS !== 'undefined' && USERS[_tkEmployee]) ? USERS[_tkEmployee] : _tkEmployee;
      empLabel = '<span id="tkEmployeeContext" style="font-size:.82rem;color:#6b7280">کارشناس: <b>' + esc(empName) + '</b></span>';
    }

    root.innerHTML =
      '<div style="max-width:900px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
          '<h2 style="margin:0;font-size:1.1rem;font-weight:700">🏭 بازرگانی — KPI</h2>' +
          periodNav + empSel + empLabel +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">' + tabBtns + '</div>' +
        '<div id="tkContent"><div style="text-align:center;padding:40px;color:#9ca3af">در حال بارگذاری...</div></div>' +
      '</div>';

    if (_tkEmployee && _tkMonth) {
      _tkLoadAndRender();
    } else {
      var msg = !_tkMonth
        ? 'خطا در تنظیم ماه'
        : (_tkIsManager() ? 'لطفاً یک کارشناس انتخاب کنید' : 'در حال بارگذاری هویت کاربر...');
      document.getElementById('tkContent').innerHTML =
        '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">' + msg + '</div>';
    }
  };

  window._tkSetTab = function(id) {
    if (id !== 'kanban' && window._tasksEmbed) window._tasksEmbed = null;
    _tkTab = id;
    window.renderTradeKPIPanel();
  };
  function _tkSyncPeriodControls() {
    var parts = String(_tkMonth || '').split('/');
    var monthEl = document.getElementById('tkPeriodMonth');
    var yearEl = document.getElementById('tkPeriodYear');
    if (monthEl) monthEl.value = String(parseInt(parts[1], 10) || 1);
    if (yearEl) yearEl.value = String(parseInt(parts[0], 10) || _tkJYear());
  }

  window._tkSetMonth = function(m) {
    _tkMonth = m;
    _tkScore = null;
    _tkSyncPeriodControls();
    _tkLoadAndRender();
  };
  window._tkSetPeriodFromControls = function() {
    var month = parseInt((document.getElementById('tkPeriodMonth') || {}).value, 10);
    var year = parseInt((document.getElementById('tkPeriodYear') || {}).value, 10);
    if (!month || !year) return;
    window._tkSetMonth(_tkMonthKey(year, month));
  };
  window._tkShiftMonth = function(delta) {
    var parts = String(_tkMonth || _tkCurrentMonth()).split('/');
    var year = parseInt(parts[0], 10) || _tkJYear();
    var month = (parseInt(parts[1], 10) || 1) + Number(delta || 0);
    while (month < 1) { month += 12; year--; }
    while (month > 12) { month -= 12; year++; }
    window._tkSetMonth(_tkMonthKey(year, month));
  };
  window._tkUseCurrentMonth = function() { window._tkSetMonth(_tkCurrentMonth()); };
  window._tkSetEmployee = function(e) {
    _tkEmployee = e || '';
    _tkScore = null;
    var context = document.getElementById('tkEmployeeContext');
    if (context) {
      var name = (typeof USERS !== 'undefined' && USERS[_tkEmployee]) ? USERS[_tkEmployee] : _tkEmployee;
      context.innerHTML = 'کارشناس: <b>' + esc(name || '') + '</b>';
    }
    _tkLoadAndRender();
  };

  function _tkFilesAPI(method, path, body) {
    var opts = { method: method, credentials: 'same-origin' };
    if (body) opts.body = body;
    return fetch('/api/trade-files' + path, opts).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.status); });
      return r.json();
    });
  }

  function _tkFileIcon(file) {
    if ((file.mime_type || '').indexOf('image/') === 0) return '🖼️';
    if (file.mime_type === 'application/pdf') return '📕';
    return '📄';
  }

  function _tkRenderFiles(type, id) {
    var list = document.getElementById('tkFilesList');
    if (!list) return;
    list.innerHTML = '<div style="color:#94a3b8;padding:10px">در حال دریافت مدارک…</div>';
    _tkFilesAPI('GET', '/list/' + encodeURIComponent(type) + '/' + encodeURIComponent(id)).then(function(data) {
      var files = data.files || [];
      if (!files.length) {
        list.innerHTML = '<div style="padding:12px;background:#fffbeb;border-radius:8px;color:#92400e;font-size:.82rem">هنوز مدرکی ثبت نشده است.</div>';
        return;
      }
      list.innerHTML = files.map(function(file) {
        var url = '/api/trade-files/' + encodeURIComponent(file.id);
        var preview = (file.mime_type || '').indexOf('image/') === 0
          ? '<img src="' + url + '" alt="" style="width:42px;height:42px;object-fit:cover;border-radius:7px;border:1px solid #e2e8f0">'
          : '<span style="font-size:1.35rem">' + _tkFileIcon(file) + '</span>';
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9">' +
          preview + '<div style="min-width:0;flex:1"><div style="font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(file.filename) + '</div>' +
          '<div style="font-size:.72rem;color:#94a3b8">' + Math.ceil((file.file_size || 0) / 1024) + ' KB</div></div>' +
          '<button type="button" onclick="window._tkPreviewTradeFile(\'' + file.id + '\',\'' + esc(file.mime_type || '') + '\')" style="border:0;background:#eef2ff;color:#4f46e5;padding:5px 8px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.76rem">پیش‌نمایش</button>' +
          '<a href="' + url + '?dl=1" style="font-size:.76rem;color:#475569">دانلود</a>' +
          '<button type="button" onclick="window._tkDeleteTradeFile(\'' + file.id + '\',\'' + type + '\',\'' + id + '\')" style="border:0;background:none;color:#ef4444;cursor:pointer;font-family:inherit;font-size:.76rem">حذف</button>' +
          '</div>';
      }).join('');
    }).catch(function(e) { list.innerHTML = '<div style="color:#ef4444;padding:10px">خطا: ' + esc(e.message) + '</div>'; });
  }

  window._tkOpenTradeFiles = function(type, id, title, required) {
    var hint = required ? '<div style="background:#fef2f2;color:#991b1b;padding:9px;border-radius:8px;font-size:.8rem;margin-bottom:10px">برای تأیید بهبود مالی، دست‌کم یک مدرک هزینه یا درآمد الزامی است.</div>' :
      '<div style="background:#f8fafc;color:#475569;padding:9px;border-radius:8px;font-size:.8rem;margin-bottom:10px">تصویر، PDF یا فایل Word/Excel را بارگذاری کنید. تصویر و PDF قابل پیش‌نمایش هستند.</div>';
    openModal('tk_files', '📎 مدارک — ' + esc(title || ''), hint +
      '<input id="tkFilesInput" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx" style="width:100%;font-family:inherit">' +
      '<div id="tkFilesList" style="margin-top:12px"></div>',
      '<button type="button" onclick="window._tkUploadTradeFiles(\'' + type + '\',\'' + id + '\')" style="' + _tkBtnStyle() + '">بارگذاری مدارک</button>', { lg: true, rawTitle: true, rawBody: true, rawFoot: true });
    _tkRenderFiles(type, id);
  };

  window._tkUploadTradeFiles = function(type, id) {
    var input = document.getElementById('tkFilesInput');
    if (!input || !input.files || !input.files.length) { if (typeof showToast === 'function') showToast('ابتدا فایل را انتخاب کنید'); return; }
    var form = new FormData();
    Array.prototype.forEach.call(input.files, function(file) { form.append('files', file); });
    _tkFilesAPI('POST', '/upload/' + encodeURIComponent(type) + '/' + encodeURIComponent(id), form)
      .then(function() { input.value = ''; _tkRenderFiles(type, id); if (typeof showToast === 'function') showToast('✅ مدارک ذخیره شد'); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkPreviewTradeFile = function(id, mime) {
    var url = '/api/trade-files/' + encodeURIComponent(id);
    var body = String(mime || '').indexOf('image/') === 0
      ? '<img src="' + url + '" alt="پیش‌نمایش مدرک" style="max-width:100%;max-height:70vh;display:block;margin:auto">'
      : (mime === 'application/pdf' ? '<iframe src="' + url + '" title="پیش‌نمایش PDF" style="width:100%;height:70vh;border:0"></iframe>' :
        '<div style="padding:18px;text-align:center;color:#64748b">برای این نوع فایل پیش‌نمایش درون‌برنامه‌ای وجود ندارد.</div>');
    openModal('tk_file_preview', 'پیش‌نمایش مدرک', body, '<a href="' + url + '?dl=1" style="color:#4f46e5">دانلود فایل</a>', { lg: true, rawBody: true, rawFoot: true });
  };

  window._tkDeleteTradeFile = function(id, type, entityId) {
    if (!confirm('این مدرک حذف شود؟')) return;
    _tkFilesAPI('DELETE', '/' + encodeURIComponent(id)).then(function() { _tkRenderFiles(type, entityId); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  function _tkLoadAndRender() {
    var cont = document.getElementById('tkContent');
    if (!cont) return;
    var emp = encodeURIComponent(_tkEmployee);
    var mon = encodeURIComponent(_tkMonth);

    var promises;
    if (_tkTab === 'cases') {
      promises = [
        _tkTradeAPI('GET', 'trade-templates', '/').catch(function() { return { templates: [] }; }),
        _tkTradeAPI('GET', 'trade-cases', '/?month=' + mon + '&assigned_to=' + emp + '&status=' + encodeURIComponent(_tkCaseFilter)).catch(function() { return { cases: [] }; })
      ];
    } else if (_tkTab === 'templates' || _tkTab === 'treports') {
      promises = [];
    } else {
      promises = [
        _tkAPI('GET', '/score/' + emp + '/' + mon).catch(function() { return null; }),
        _tkAPI('GET', '/targets/' + emp + '/' + mon).catch(function() { return null; })
      ];
      if (_tkTab === 'score' || _tkTab === 'history') {
        promises.push(_tkAPI('GET', '/kpi-history/' + emp).catch(function() { return []; }));
      } else if (_tkTab === 'customs') promises.push(_tkAPI('GET', '/clearances/' + emp + '/' + mon).catch(function() { return []; }));
      else if (_tkTab === 'report') promises.push(_tkAPI('GET', '/reports/' + emp + '/' + mon).catch(function() { return []; }));
      else if (_tkTab === 'supplier') promises.push(_tkAPI('GET', '/suppliers/' + emp + '/' + mon).catch(function() { return []; }));
      else if (_tkTab === 'finance') promises.push(_tkAPI('GET', '/finance/' + emp + '/' + mon).catch(function() { return []; }));
      else if (_tkTab === 'warehouse') promises.push(_tkAPI('GET', '/warehouse/' + emp + '/' + mon).catch(function() { return null; }));
      else if (_tkTab === 'milestones') promises.push(_tkAPI('GET', '/milestones?employee=' + emp).catch(function() { return []; }));
      else if (_tkTab === 'deductions') promises.push(_tkAPI('GET', '/deductions/' + emp + '/' + mon).catch(function() { return []; }));
      else if (_tkTab === 'kanban') {
        promises = [];
      } else if (_tkTab === 'admin' || _tkTab === 'team') {
        promises = [
          _tkAPI('GET', '/score/' + emp + '/' + mon).catch(function() { return null; })
        ];
      }
    }

    Promise.all(promises).then(function(res) {
      if (_tkTab === 'cases') {
        _tkTemplates = (res[0] && res[0].templates) || [];
        _tkCases = (res[1] && res[1].cases) || [];
        _tkRenderCases(cont);
        return;
      }
      if (_tkTab === 'templates' && typeof window._tkRenderTemplates === 'function') {
        window._tkRenderTemplates(cont);
        return;
      }
      if (_tkTab === 'treports' && typeof window._tkRenderTradeReports === 'function') {
        window._tkRenderTradeReports(cont);
        return;
      }
      if (_tkTab === 'kanban') {
        _tkRenderTradeTasks(cont);
        return;
      }

      _tkScore = res[0];
      _tkTargets = res[1] || _tkDefaultTargets();
      var extra = res[2];

      if (_tkTab === 'score') {
        var hist = extra || [];
        _tkMonthRecord = hist.find(function(h) { return h.month === _tkMonth; }) || null;
        _tkRenderScore(cont);
      } else if (_tkTab === 'history') _tkRenderHistory(cont, extra || []);
      else if (_tkTab === 'customs') _tkRenderCustoms(cont, extra || []);
      else if (_tkTab === 'report') _tkRenderReport(cont, extra || []);
      else if (_tkTab === 'supplier') _tkRenderSupplier(cont, extra || []);
      else if (_tkTab === 'finance') _tkRenderFinance(cont, extra || []);
      else if (_tkTab === 'warehouse') _tkRenderWarehouse(cont, extra);
      else if (_tkTab === 'admin') _tkRenderAdmin(cont);
      else if (_tkTab === 'team') _tkRenderTeam(cont);
      else if (_tkTab === 'milestones') _tkRenderMilestones(cont, extra || []);
      else if (_tkTab === 'deductions') _tkRenderDeductions(cont, extra || []);
    }).catch(function(e) {
      cont.innerHTML = '<div style="color:#ef4444;padding:20px">خطا: ' + esc(e.message) + '</div>';
    });
  }

  // ── Trade cases (EZ merge) ─────────────────────────────────────────────────
  function _tkCaseProgress(c, tpl) {
    if (!tpl || !tpl.steps || !tpl.steps.length) return 0;
    if (c.isFinalized) return 100;
    var done = 0;
    tpl.steps.forEach(function(s) {
      if (c.stepsData && c.stepsData[s.id] && c.stepsData[s.id].completed_at) done++;
    });
    return Math.round((done / tpl.steps.length) * 100);
  }

  function _tkRenderCases(cont) {
    var tplMap = {};
    _tkTemplates.forEach(function(t) { tplMap[t.id] = t; });

    var html = '<div style="background:#f8fafc;border-radius:12px;padding:14px;border:1px solid #e2e8f0;margin-bottom:14px;font-size:.8rem;color:#64748b;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<span>پرونده‌های بازرگانی — کلیک برای جزئیات. تکمیل مرحله → KPI خودکار.</span>' +
      '<select onchange="window._tkSetCaseFilter(this.value)" style="' + _tkInputStyle(130) + 'font-size:.78rem">' +
      '<option value="active"' + (_tkCaseFilter === 'active' ? ' selected' : '') + '>فعال</option>' +
      '<option value="finalized"' + (_tkCaseFilter === 'finalized' ? ' selected' : '') + '>نهایی‌شده</option>' +
      '<option value="all"' + (_tkCaseFilter === 'all' ? ' selected' : '') + '>همه</option>' +
      '</select></div>';

    if (_tkTemplates.length) {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
        '<h4 style="margin:0 0 12px;font-size:.9rem">+ پرونده جدید</h4>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<div style="flex:2;min-width:180px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">عنوان</label>' +
        '<input id="tkc_new_title" placeholder="مثلاً: ترخیص محموله X" style="' + _tkInputStyle('100%') + '"></div>' +
        '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">فرآیند</label>' +
        '<select id="tkc_new_tpl" style="' + _tkInputStyle(180) + '">' +
        _tkTemplates.map(function(t) {
          return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
        }).join('') + '</select></div>' +
        '<button onclick="window._tkAddCase()" style="' + _tkBtnStyle() + '">+ ایجاد</button>' +
        '</div></div>';
    } else {
      html += '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:14px;font-size:.85rem;color:#9a3412">' +
        'هنوز قالب فرآیندی تعریف نشده. مدیر می‌تواند با <code>migrate-ez-to-crm.js</code> یا API <code>/api/trade-templates</code> قالب اضافه کند.</div>';
    }

    if (!_tkCases.length) {
      html += '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">پرونده‌ای برای این ماه ثبت نشده</div>';
    } else {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">';
      _tkCases.forEach(function(c) {
        var tpl = tplMap[c.templateId];
        var pct = _tkCaseProgress(c, tpl);
        var stLabel = c.isFinalized ? '✅ نهایی' : (pct >= 100 ? '⏳ آماده نهایی' : '🔄 ' + pct + '٪');
        html += '<div style="padding:12px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer" onclick="window._tkOpenCase(\'' + c.id + '\')">' +
          '<div style="flex:1;min-width:200px">' +
          '<div style="font-size:.9rem;font-weight:600;color:#1e293b">' + esc(c.title) + '</div>' +
          '<div style="font-size:.75rem;color:#6b7280;margin-top:3px">' + esc(c.caseNumber || '') +
          (tpl ? ' · ' + esc(tpl.name) : '') + '</div></div>' +
          '<div style="min-width:120px;flex:1">' + _tkBar(pct) + '</div>' +
          '<span style="font-size:.8rem;white-space:nowrap">' + stLabel + '</span>' +
          (!c.isFinalized ? '<button onclick="event.stopPropagation();window._tkFinalizeCase(\'' + c.id + '\')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem">نهایی</button>' : '') +
          '</div>';
      });
      html += '</div>';
    }
    cont.innerHTML = html;
  }

  window._tkAddCase = function() {
    var title = (document.getElementById('tkc_new_title') || {}).value.trim();
    var templateId = (document.getElementById('tkc_new_tpl') || {}).value;
    if (!title) { if (typeof showToast === 'function') showToast('عنوان الزامی است'); return; }
    if (!templateId) { if (typeof showToast === 'function') showToast('قالب الزامی است'); return; }
    _tkTradeAPI('POST', 'trade-cases', '/', {
      title: title,
      templateId: templateId,
      assignedTo: _tkEmployee,
      jalaliMonth: _tkMonth
    }).then(function(created) {
      if (typeof showToast === 'function') showToast('✅ پرونده ایجاد شد');
      _tkLoadAndRender();
      if (created && created.id && typeof window._tkOpenCase === 'function') {
        setTimeout(function() { window._tkOpenCase(created.id); }, 300);
      }
    }).catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkFinalizeCase = function(id) {
    if (!confirm('پرونده نهایی شود؟')) return;
    _tkTradeAPI('POST', 'trade-cases', '/' + id + '/finalize', {})
      .then(function(res) {
        var msg = '✅ پرونده نهایی شد';
        if (res && res.kpiSynced) msg += ' · KPI: ' + res.kpiSynced + ' مرحله';
        if (typeof showToast === 'function') showToast(msg);
        _tkLoadAndRender();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkSetCaseFilter = function(f) {
    _tkCaseFilter = f || 'active';
    _tkLoadAndRender();
  };

  window._tkOnTradeCaseSSE = function(data) {
    if (typeof currentTab !== 'undefined' && currentTab !== 'trade-kpi') return;
    if (_tkTab === 'cases' && typeof _tkLoadAndRender === 'function') _tkLoadAndRender();
    if (_tkTab === 'treports' && typeof window._tkRenderTradeReports === 'function') {
      var cont = document.getElementById('tkContent');
      if (cont) window._tkRenderTradeReports(cont);
    }
  };

  // ── Score dashboard ────────────────────────────────────────────────────────
  function _tkRenderScore(cont) {
    var sc = _tkScore;
    var tg = _tkTargets;

    if (!sc) {
      cont.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">اطلاعاتی برای این ماه ثبت نشده</div>';
      if (_tkIsManager()) {
        cont.innerHTML += '<div style="margin-top:16px">' + _tkTargetsForm() + '</div>';
      }
      return;
    }

    var dims = sc.dimensions || {};
    var final = sc.final || 0;
    var rawFinal = sc.rawFinal != null ? sc.rawFinal : final;
    var deductions = sc.deductions || 0;
    var color = _tkScoreColor(final);
    var isFinalized = _tkMonthRecord && _tkMonthRecord.finalized;

    var dimRows = [
      { key: 'customs',   icon: '📦', label: 'ترخیص گمرکی',   d: dims.customs,
        detail: dims.customs ? dims.customs.count + ' از ' + dims.customs.target + ' مورد' + (dims.customs.avgDays ? ' · میانگین ' + dims.customs.avgDays + ' روز' : '') : '—' },
      { key: 'report',    icon: '📋', label: 'گزارش روزانه',   d: dims.report,
        detail: dims.report ? dims.report.count + ' از ' + dims.report.workingDays + ' روز' : '—' },
      { key: 'admin',     icon: '📁', label: 'پیگیری اداری',   d: dims.admin,
        detail: dims.admin ? dims.admin.done + ' از ' + dims.admin.target + ' وظیفه' : '—' },
      { key: 'supplier',  icon: '🔍', label: 'تامین‌کننده',    d: dims.supplier,
        detail: dims.supplier ? dims.supplier.count + ' از ' + dims.supplier.target + ' سورس' : '—' },
      { key: 'finance',   icon: '💰', label: 'بهبود مالی',     d: dims.finance,
        detail: dims.finance ? _tkFmt(dims.finance.total) + ' از ' + _tkFmt(dims.finance.target) + ' ریال' : '—' },
      { key: 'team',      icon: '👥', label: 'مشارکت تیمی',    d: dims.team,
        detail: dims.team ? dims.team.done + ' از ' + dims.team.total + ' وظیفه' : '—' },
      { key: 'warehouse', icon: '🏭', label: 'تطبیق انبار',    d: dims.warehouse,
        detail: dims.warehouse
          ? (dims.warehouse.submitted ? (dims.warehouse.resolved ? '✅ تطبیق داده شده' : '⏳ ثبت شده، در انتظار') : '❌ ثبت نشده')
          : '❌ ثبت نشده' }
    ];

    var html = '';
    if (isFinalized) {
      html += '<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.88rem;color:#065f46">' +
        '🔒 این ماه نهایی شده · نمره قفل‌شده: <b>' + (_tkMonthRecord.final_score || final) + '</b>' +
        (_tkMonthRecord.finalized_at ? ' · ' + String(_tkMonthRecord.finalized_at).slice(0, 10) : '') +
        '</div>';
    }

    html += '<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px;text-align:center">' +
      '<div style="font-size:.9rem;color:#6b7280;margin-bottom:8px">نمره کلی · ' + _tkMonth + (isFinalized ? ' (قفل)' : ' (زنده)') + '</div>' +
      '<div style="font-size:3.5rem;font-weight:800;color:' + color + '">' + final + '</div>' +
      '<div style="font-size:.85rem;color:#9ca3af;margin-bottom:8px">از ۱۰۰</div>' +
      (deductions > 0 ? '<div style="font-size:.8rem;color:#ef4444;margin-bottom:8px">شامل ' + deductions + ' امتیاز کسر · خام: ' + rawFinal + '</div>' : '') +
      '<div style="max-width:400px;margin:0 auto">' + _tkBar(final) + '</div>' +
      (final >= 80
        ? '<div style="margin-top:12px;color:#10b981;font-size:.9rem">✅ آستانه پاداش (۸۰) تکمیل شد</div>'
        : '<div style="margin-top:12px;color:#f59e0b;font-size:.85rem">برای دریافت پاداش به ' + (80 - final).toFixed(1) + ' امتیاز دیگر نیاز است</div>') +
      '</div>';

    html += '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:16px">' +
      '<h3 style="margin:0 0 16px;font-size:.95rem;font-weight:600">جزئیات نمره</h3>';

    dimRows.forEach(function(row) {
      var score = row.d ? row.d.score : 0;
      var weight = row.d ? row.d.weight : 0;
      var contribution = Math.round(score * weight) / 100;
      html += '<div style="margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">' +
          '<span style="font-size:.87rem;font-weight:600;cursor:pointer;color:#6366f1" onclick="window._tkSetTab(\'' + row.key + '\')">' + row.icon + ' ' + row.label + '</span>' +
          '<span style="font-size:.82rem;color:#6b7280">' + row.detail + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          _tkBar(score) +
          '<span style="min-width:40px;font-size:.82rem;color:' + _tkScoreColor(score) + ';font-weight:700">' + score + '٪</span>' +
        '</div>' +
        '<div style="font-size:.74rem;color:#9ca3af;margin-top:2px;text-align:left;direction:ltr">وزن ' + weight + '٪ → ' + contribution.toFixed(1) + ' امتیاز</div>' +
        '</div>';
    });

    html += '</div>';

    // Formula explanation
    html += '<div style="background:#f8fafc;border-radius:12px;padding:14px;border:1px solid #e2e8f0;font-size:.8rem;color:#64748b;margin-bottom:16px">' +
      '<b>📐 نحوه محاسبه:</b> نمره هر شاخص = (واقعی ÷ هدف) × ۱۰۰ · ' +
      'نمره کلی = جمع (نمره × وزن) ÷ مجموع وزن‌ها · ' +
      'برای ترخیص: اگر میانگین روزها بیشتر از هدف باشد، نمره کاهش می‌یابد · کسورات مدیر از نمره نهایی کم می‌شود' +
      '</div>';

    if (_tkIsManager()) {
      if (!isFinalized) {
        html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:16px">' +
          '<h3 style="margin:0 0 10px;font-size:.9rem;font-weight:600">🔒 نهایی‌سازی ماه</h3>' +
          '<p style="margin:0 0 12px;font-size:.8rem;color:#6b7280">پس از نهایی‌سازی، نمره قفل می‌شود و در payroll قابل استفاده است.</p>' +
          '<textarea id="tk_finalize_notes" rows="2" placeholder="یادداشت مدیر (اختیاری)..." style="' + _tkTextareaStyle() + '"></textarea>' +
          '<button onclick="window._tkFinalizeMonth()" style="margin-top:10px;padding:8px 18px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.88rem">نهایی‌سازی ' + _tkMonth + '</button>' +
          '</div>';
      }
      html += '<div id="tkTargetsWrap">' + _tkTargetsForm() + '</div>';
    }

    cont.innerHTML = html;
  }

  function _tkTargetsForm() {
    var tg = _tkTargets || _tkDefaultTargets();
    return '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0">' +
      '<h3 style="margin:0 0 14px;font-size:.9rem;font-weight:600">⚙️ تنظیم اهداف ماه (مدیر)</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">' +
        _tkTargetInput('customs_target', 'هدف ترخیص (تعداد)', tg.customs_target) +
        _tkTargetInput('customs_days_target', 'حداکثر روز هر ترخیص', tg.customs_days_target) +
        _tkTargetInput('customs_weight', 'وزن ترخیص (٪)', tg.customs_weight) +
        _tkTargetInput('report_weight', 'وزن گزارش روزانه (٪)', tg.report_weight) +
        _tkTargetInput('admin_target', 'هدف پیگیری اداری (تعداد)', tg.admin_target) +
        _tkTargetInput('admin_weight', 'وزن پیگیری اداری (٪)', tg.admin_weight) +
        _tkTargetInput('supplier_target', 'هدف تامین‌کننده (تعداد)', tg.supplier_target) +
        _tkTargetInput('supplier_weight', 'وزن تامین‌کننده (٪)', tg.supplier_weight) +
        _tkTargetInput('finance_target', 'هدف بهبود مالی (ریال)', tg.finance_target) +
        _tkTargetInput('finance_weight', 'وزن بهبود مالی (٪)', tg.finance_weight) +
        _tkTargetInput('team_weight', 'وزن مشارکت تیمی (٪)', tg.team_weight) +
        _tkTargetInput('warehouse_weight', 'وزن تطبیق انبار (٪)', tg.warehouse_weight) +
      '</div>' +
      '<button onclick="window._tkSaveTargets()" style="margin-top:14px;' + _tkBtnStyle() + '">ذخیره اهداف</button>' +
      '</div>';
  }

  function _tkTargetInput(key, label, val) {
    return '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">' + label + '</label>' +
      '<input id="tkt_' + key + '" type="number" value="' + (val || 0) + '" ' +
      'style="' + _tkInputStyle('100%') + '"></div>';
  }

  window._tkSaveTargets = function() {
    var tg = {};
    ['customs_target', 'customs_days_target', 'customs_weight', 'report_weight',
      'admin_target', 'admin_weight', 'supplier_target', 'supplier_weight',
      'finance_target', 'finance_weight', 'team_weight', 'warehouse_weight'].forEach(function(k) {
      var el = document.getElementById('tkt_' + k);
      if (el) tg[k] = parseFloat(el.value) || 0;
    });
    _tkAPI('POST', '/targets/' + encodeURIComponent(_tkEmployee) + '/' + encodeURIComponent(_tkMonth), tg)
      .then(function() {
        if (typeof showToast === 'function') showToast('✅ اهداف ذخیره شد');
        _tkLoadAndRender();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Trade tasks → main CRM tasks module ───────────────────────────────────
  function _tkTradeDeptTasks() {
    if (typeof DB === 'undefined' || !DB.tasks) return [];
    return DB.tasks.filter(function(t) {
      if ((t.department || '') !== 'بازرگانی') return false;
      if (_tkEmployee && t.owner !== _tkEmployee) return false;
      return true;
    });
  }

  function _tkRenderTradeTasks(cont) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8">در حال بارگذاری وظایف...</div>';
    function _mount() {
      window._tasksEmbed = {
        active: true,
        container: cont,
        department: 'بازرگانی',
        owner: _tkEmployee || (typeof currentUser !== 'undefined' ? currentUser : '')
      };
      if (typeof _taskFilter !== 'undefined') _taskFilter = 'all';
      if (typeof renderTasksPanel === 'function') {
        renderTasksPanel();
      } else {
        cont.innerHTML = '<div style="color:#ef4444;padding:20px">ماژول وظایف در دسترس نیست</div>';
      }
    }
    if (typeof renderTasksPanel === 'function') {
      _mount();
    } else if (typeof ensureTabScripts === 'function') {
      ensureTabScripts('tasks').then(_mount).catch(function(e) {
        cont.innerHTML = '<div style="color:#ef4444;padding:20px">خطا: ' + esc(e.message) + '</div>';
      });
    } else {
      _mount();
    }
  }

  function _tkEnsureTasksThen(fn) {
    if (typeof _ensureTasks === 'function') {
      fn();
      return;
    }
    if (typeof ensureTabScripts === 'function') {
      ensureTabScripts('tasks').then(fn).catch(function() { fn(); });
    } else {
      fn();
    }
  }

  window._tkOpenTradeTask = function(tid) {
    _tkEnsureTasksThen(function() {
      if (typeof openTaskModal === 'function') openTaskModal(tid);
    });
  };

  // ── Customs clearances ─────────────────────────────────────────────────────
  function _tkRenderCustoms(cont, list) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.customs;
    var html = _tkDimHeader('📦 ترخیص گمرکی', dim,
      'هر ترخیص گمرکی که تکمیل می‌شود یک مورد ثبت کنید. زمان تکمیل در نمره‌دهی تأثیر دارد — اگر از هدف بیشتر شود نمره کاهش می‌یابد.');

    html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<h4 style="margin:0 0 12px;font-size:.9rem;color:#374151">+ ثبت ترخیص جدید</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">عنوان / محموله</label>' +
        '<input id="tkc_title" placeholder="مثلاً: ترخیص دستگاه X" style="' + _tkInputStyle(220) + '"></div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">تاریخ شروع (جلالی)</label>' +
        _tkDateInput('tkc_start', _tkToday(), 120, _tkToday()) + '</div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">حداکثر روز مجاز</label>' +
        '<input id="tkc_days" type="number" value="' + ((_tkTargets && _tkTargets.customs_days_target) || 10) + '" style="' + _tkInputStyle(80) + '"></div>' +
        '<button onclick="window._tkAddClearance()" style="' + _tkBtnStyle() + '">ثبت</button>' +
      '</div></div>';

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز ترخیصی در این ماه ثبت نشده</div>';
    } else {
      html += list.map(function(item) {
        var st = item.status;
        var statusLabel = st === 'completed' ? '✅ تکمیل' : st === 'delayed' ? '⚠️ تأخیر' : '🔄 در حال انجام';
        var statusColor = st === 'completed' ? '#10b981' : st === 'delayed' ? '#f59e0b' : '#6366f1';
        return '<div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div>' +
              '<div style="font-size:.9rem;font-weight:600">' + esc(item.title) + '</div>' +
              '<div style="font-size:.78rem;color:#6b7280;margin-top:3px">' +
                (item.start_date ? 'شروع: ' + item.start_date : '') +
                (item.end_date ? ' · پایان: ' + item.end_date : '') +
                (item.actual_days ? ' · ' + item.actual_days + ' روز' : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<span style="font-size:.8rem;color:' + statusColor + ';background:' + statusColor + '18;padding:3px 10px;border-radius:99px">' + statusLabel + '</span>' +
              (st === 'in_progress'
                ? '<button onclick="window._tkCompleteClearance(\'' + item.id + '\')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">تکمیل</button>'
                : '') +
              '<button onclick="window._tkOpenTradeFiles(\'clearance\',\'' + item.id + '\',\'' + esc(item.title) + '\',false)" style="padding:4px 10px;background:#eef2ff;color:#4f46e5;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">📎 مدارک</button>' +
              '<button onclick="window._tkDelClearance(\'' + item.id + '\')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:.8rem;padding:4px">حذف</button>' +
            '</div>' +
          '</div></div>';
      }).join('');
    }

    cont.innerHTML = html;
  }

  window._tkAddClearance = function() {
    var title = (document.getElementById('tkc_title') || {}).value.trim();
    var start = (document.getElementById('tkc_start') || {}).value.trim();
    var days = parseInt((document.getElementById('tkc_days') || {}).value) || 10;
    if (!title) { if (typeof showToast === 'function') showToast('عنوان الزامی است'); return; }
    _tkAPI('POST', '/clearances', { employee: _tkEmployee, jalali_month: _tkMonth, title: title, start_date: start, target_days: days })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkCompleteClearance = function(id) {
    _tkAPI('PUT', '/clearances/' + id, { status: 'completed', end_date: _tkToday() })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDelClearance = function(id) {
    _tkAPI('DELETE', '/clearances/' + id)
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Daily reports ──────────────────────────────────────────────────────────
  function _tkRenderReport(cont, list) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.report;
    var html = _tkDimHeader('📋 گزارش روزانه', dim,
      'هر روز کاری یک گزارش کوتاه ثبت کنید. فقط یک گزارش در روز امکان‌پذیر است. ۲۶ روز کاری در ماه در نظر گرفته می‌شود.');

    var today = _tkToday();
    var todayReport = list.find(function(r) { return r.report_date === today; });

    if (!todayReport) {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:2px solid #6366f1;margin-bottom:14px">' +
        '<h4 style="margin:0 0 12px;font-size:.9rem;color:#6366f1">📝 گزارش امروز (' + today + ')</h4>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<textarea id="tkr_summary" placeholder="خلاصه فعالیت‌های امروز..." style="' + _tkTextareaStyle() + '" rows="2"></textarea>' +
          '<textarea id="tkr_activities" placeholder="جزئیات کارهای انجام شده..." style="' + _tkTextareaStyle() + '" rows="2"></textarea>' +
          '<textarea id="tkr_issues" placeholder="مشکلات و موارد پیگیری..." style="' + _tkTextareaStyle() + '" rows="1"></textarea>' +
          '<button onclick="window._tkSubmitReport()" style="' + _tkBtnStyle() + ';align-self:flex-start">ثبت گزارش امروز</button>' +
        '</div></div>';
    } else {
      html += '<div style="background:#d1fae5;border-radius:12px;padding:14px;margin-bottom:14px;color:#065f46;font-size:.88rem">' +
        '✅ گزارش امروز (' + today + ') ثبت شده است</div>';
    }

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز گزارشی در این ماه ثبت نشده</div>';
    } else {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">' +
        '<h4 style="margin:0 0 12px;font-size:.88rem;color:#374151">گزارش‌های این ماه (' + list.length + ' روز)</h4>' +
        list.slice().reverse().map(function(r) {
          return '<div style="border-bottom:1px solid #f1f5f9;padding:10px 0">' +
            '<div style="font-size:.82rem;font-weight:600;color:#374151">' + r.report_date + '</div>' +
            (r.summary ? '<div style="font-size:.8rem;color:#6b7280;margin-top:2px">' + esc(r.summary) + '</div>' : '') +
            '</div>';
        }).join('') + '</div>';
    }

    cont.innerHTML = html;
  }

  window._tkSubmitReport = function() {
    var summary = (document.getElementById('tkr_summary') || {}).value.trim();
    var activities = (document.getElementById('tkr_activities') || {}).value.trim();
    var issues = (document.getElementById('tkr_issues') || {}).value.trim();
    _tkAPI('POST', '/reports', {
      employee: _tkEmployee, jalali_month: _tkMonth,
      report_date: _tkToday(), summary: summary, activities: activities, issues: issues
    })
      .then(function() { if (typeof showToast === 'function') showToast('✅ گزارش ثبت شد'); _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Suppliers ──────────────────────────────────────────────────────────────
  function _tkRenderSupplier(cont, list) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.supplier;
    var html = _tkDimHeader('🔍 توسعه تامین‌کننده', dim,
      'سورس‌های جدیدی که در ایران نماینده ندارند و مرتبط با حوزه کاری هستند. مدیر باید تأیید کند تا در نمره محاسبه شود.');

    html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<h4 style="margin:0 0 12px;font-size:.9rem;color:#374151">+ معرفی سورس جدید</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">نام شرکت / برند</label>' +
        '<input id="tks_name" placeholder="نام تامین‌کننده" style="' + _tkInputStyle(200) + '"></div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">کشور</label>' +
        '<input id="tks_country" placeholder="مثلاً: آلمان" style="' + _tkInputStyle(100) + '"></div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">حوزه محصول</label>' +
        '<input id="tks_cat" placeholder="دسته‌بندی" style="' + _tkInputStyle(150) + '"></div>' +
        '<button onclick="window._tkAddSupplier()" style="' + _tkBtnStyle() + '">ثبت</button>' +
      '</div></div>';

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز سورسی معرفی نشده</div>';
    } else {
      html += list.map(function(s) {
        var approved = !!s.approved_by;
        return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e2e8f0;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div>' +
              '<div style="font-size:.9rem;font-weight:600">' + esc(s.company_name) + '</div>' +
              '<div style="font-size:.78rem;color:#6b7280">' + esc(s.country || '') + (s.product_category ? ' · ' + esc(s.product_category) : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
              (approved
                ? '<span style="font-size:.78rem;color:#10b981;background:#d1fae5;padding:3px 10px;border-radius:99px">✅ تأیید شده</span>'
                : '<span style="font-size:.78rem;color:#f59e0b;background:#fef3c7;padding:3px 10px;border-radius:99px">⏳ در انتظار تأیید</span>') +
              '<button onclick="window._tkOpenTradeFiles(\'supplier\',\'' + s.id + '\',\'' + esc(s.company_name) + '\',false)" style="padding:4px 10px;background:#eef2ff;color:#4f46e5;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">📎 کاتالوگ/گواهی</button>' +
              (_tkIsManager() && !approved ? '<button onclick="window._tkApproveSupplier(\'' + s.id + '\')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">تأیید</button>' : '') +
              '<button onclick="window._tkDelSupplier(\'' + s.id + '\')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:.8rem;padding:4px">حذف</button>' +
            '</div>' +
          '</div></div>';
      }).join('');
    }

    cont.innerHTML = html;
  }

  window._tkAddSupplier = function() {
    var name = (document.getElementById('tks_name') || {}).value.trim();
    var country = (document.getElementById('tks_country') || {}).value.trim();
    var cat = (document.getElementById('tks_cat') || {}).value.trim();
    if (!name) { if (typeof showToast === 'function') showToast('نام الزامی است'); return; }
    _tkAPI('POST', '/suppliers', { employee: _tkEmployee, jalali_month: _tkMonth, company_name: name, country: country, product_category: cat })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkApproveSupplier = function(id) {
    _tkAPI('PUT', '/suppliers/' + id, { approved: true })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDelSupplier = function(id) {
    _tkAPI('DELETE', '/suppliers/' + id)
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Finance improvements ───────────────────────────────────────────────────
  function _tkRenderFinance(cont, list) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.finance;
    var html = _tkDimHeader('💰 بهبود مالی', dim,
      'کارهایی که منجر به افزایش سود یا کاهش هزینه شده‌اند. مبلغ تأثیر را وارد کنید. مدیر باید تأیید کند تا در نمره محاسبه شود.');

    html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<h4 style="margin:0 0 12px;font-size:.9rem;color:#374151">+ ثبت بهبود مالی</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">عنوان</label>' +
        '<input id="tkf_title" placeholder="توضیح کوتاه" style="' + _tkInputStyle(220) + '"></div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">نوع</label>' +
        '<select id="tkf_type" style="' + _tkInputStyle(130) + '">' +
          '<option value="cost_reduction">کاهش هزینه</option>' +
          '<option value="revenue_increase">افزایش درآمد</option>' +
        '</select></div>' +
        '<div><label style="font-size:.78rem;color:#6b7280;display:block;margin-bottom:3px">مبلغ (ریال)</label>' +
        '<input id="tkf_amount" type="number" placeholder="0" style="' + _tkInputStyle(130) + '"></div>' +
        '<button onclick="window._tkAddFinance()" style="' + _tkBtnStyle() + '">ثبت</button>' +
      '</div></div>';

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز موردی ثبت نشده</div>';
    } else {
      var totalAmt = list.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
      var verifiedAmt = list.filter(function(r) { return r.verified_by; }).reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
      html += '<div style="background:#f0fdf4;border-radius:10px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:#166534">' +
        'جمع ثبت‌شده: ' + _tkFmt(totalAmt) + ' ریال · تأیید شده: ' + _tkFmt(verifiedAmt) + ' ریال</div>';
      html += list.map(function(f) {
        var verified = !!f.verified_by;
        var typeLabel = f.type === 'revenue_increase' ? 'افزایش درآمد' : 'کاهش هزینه';
        return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e2e8f0;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div>' +
              '<div style="font-size:.9rem;font-weight:600">' + esc(f.title) + '</div>' +
              '<div style="font-size:.78rem;color:#6b7280">' + typeLabel + ' · ' + _tkFmt(f.amount) + ' ریال</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
              (verified
                ? '<span style="font-size:.78rem;color:#10b981;background:#d1fae5;padding:3px 10px;border-radius:99px">✅ تأیید</span>'
                : '<span style="font-size:.78rem;color:#f59e0b;background:#fef3c7;padding:3px 10px;border-radius:99px">⏳ انتظار</span>') +
              '<button onclick="window._tkOpenTradeFiles(\'finance\',\'' + f.id + '\',\'' + esc(f.title) + '\',true)" style="padding:4px 10px;background:#eef2ff;color:#4f46e5;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">📎 مدرک الزامی</button>' +
              (_tkIsManager() && !verified ? '<button onclick="window._tkVerifyFinance(\'' + f.id + '\')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">تأیید</button>' : '') +
              '<button onclick="window._tkDelFinance(\'' + f.id + '\')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:.8rem;padding:4px">حذف</button>' +
            '</div>' +
          '</div></div>';
      }).join('');
    }

    cont.innerHTML = html;
  }

  window._tkAddFinance = function() {
    var title = (document.getElementById('tkf_title') || {}).value.trim();
    var type = (document.getElementById('tkf_type') || {}).value;
    var amount = parseFloat((document.getElementById('tkf_amount') || {}).value) || 0;
    if (!title) { if (typeof showToast === 'function') showToast('عنوان الزامی است'); return; }
    _tkAPI('POST', '/finance', { employee: _tkEmployee, jalali_month: _tkMonth, title: title, type: type, amount: amount })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkVerifyFinance = function(id) {
    _tkAPI('PUT', '/finance/' + id, { verified: true })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDelFinance = function(id) {
    _tkAPI('DELETE', '/finance/' + id)
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Warehouse reconciliation ───────────────────────────────────────────────
  function _tkRenderWarehouse(cont, data) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.warehouse;
    var html = _tkDimHeader('🏭 تطبیق انبار ماهانه', dim,
      'یک بار در ماه سه موجودی را مقایسه کنید: اداره کل (مجازی) · انبار واقعی · نرم‌افزار WMS. اگر اعداد تطبیق داشتند و تیک بزنید، نمره کامل (۱۰۰) ثبت می‌شود.');

    var d = data || {};
    html += '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">' +
        '<span style="font-size:.88rem;font-weight:600;color:#374151">مقایسه موجودی ماهانه</span>' +
        '<button onclick="window._tkImportWms()" id="tkw_import_btn"' + (_tkWmsImporting ? ' disabled' : '') +
        ' style="padding:6px 12px;background:' + (_tkWmsImporting ? '#94a3b8' : '#0ea5e9') + ';color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:.8rem">' +
        (_tkWmsImporting ? '⏳ در حال بارگذاری...' : '📥 بارگذاری از WMS') + '</button>' +
      '</div>';
    if (d.wms_synced_at) {
      html += '<div style="font-size:.78rem;color:#0369a1;background:#f0f9ff;border-radius:8px;padding:8px 10px;margin-bottom:12px">' +
        'آخرین sync WMS: ' + String(d.wms_synced_at).slice(0, 16).replace('T', ' ') +
        ' · ' + (d.wms_sku_count || 0) + ' قلم · ' + (d.wms_total_qty || 0) + ' واحد' +
        '</div>';
    }
    html +=
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:16px">' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">📄 اداره کل (مجازی)</label>' +
        '<input id="tkw_gov" type="number" value="' + (d.gov_count || 0) + '" style="' + _tkInputStyle('100%') + '"></div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">🏭 انبار واقعی</label>' +
        '<input id="tkw_real" type="number" value="' + (d.real_count || 0) + '" style="' + _tkInputStyle('100%') + '"></div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">💻 نرم‌افزار WMS</label>' +
        '<input id="tkw_soft" type="number" value="' + (d.software_count || 0) + '" style="' + _tkInputStyle('100%') + '"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">مغایرت‌ها و توضیحات</label>' +
      '<textarea id="tkw_disc" rows="2" style="' + _tkTextareaStyle() + '">' + esc(d.discrepancies || '') + '</textarea></div>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer">' +
          '<input type="checkbox" id="tkw_resolved"' + (d.resolved ? ' checked' : '') + '> مغایرت‌ها رفع شده / اعداد تطبیق دارند' +
        '</label>' +
        '<button onclick="window._tkSaveWarehouse()" style="' + _tkBtnStyle() + '">ذخیره تطبیق ماه</button>' +
      '</div></div>';

    cont.innerHTML = html;
  }

  window._tkSaveWarehouse = function() {
    var gov = parseInt((document.getElementById('tkw_gov') || {}).value) || 0;
    var real = parseInt((document.getElementById('tkw_real') || {}).value) || 0;
    var soft = parseInt((document.getElementById('tkw_soft') || {}).value) || 0;
    var disc = (document.getElementById('tkw_disc') || {}).value.trim();
    var resolved = !!(document.getElementById('tkw_resolved') || {}).checked;
    _tkAPI('PUT', '/warehouse/' + encodeURIComponent(_tkEmployee) + '/' + encodeURIComponent(_tkMonth),
      { gov_count: gov, real_count: real, software_count: soft, discrepancies: disc, resolved: resolved })
      .then(function() { if (typeof showToast === 'function') showToast('✅ تطبیق ذخیره شد'); _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkImportWms = function() {
    if (_tkWmsImporting) return;
    _tkWmsImporting = true;
    var btn = document.getElementById('tkw_import_btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال بارگذاری...'; btn.style.background = '#94a3b8'; }
    _tkAPI('GET', '/warehouse-wms-snapshot')
      .then(function(snap) {
        var gov = parseInt((document.getElementById('tkw_gov') || {}).value) || 0;
        var real = parseInt((document.getElementById('tkw_real') || {}).value) || 0;
        return _tkAPI('PUT', '/warehouse/' + encodeURIComponent(_tkEmployee) + '/' + encodeURIComponent(_tkMonth), {
          gov_count: gov,
          real_count: real || snap.total_qty,
          software_count: snap.total_qty,
          discrepancies: (document.getElementById('tkw_disc') || {}).value.trim(),
          resolved: !!(document.getElementById('tkw_resolved') || {}).checked,
          import_wms: true
        }).then(function() { return snap; });
      })
      .then(function(snap) {
        if (typeof showToast === 'function') showToast('✅ WMS: ' + snap.sku_count + ' قلم، ' + snap.total_qty + ' واحد');
        _tkWmsImporting = false;
        _tkLoadAndRender();
      })
      .catch(function(e) {
        _tkWmsImporting = false;
        if (typeof showToast === 'function') showToast('خطا: ' + e.message);
        _tkLoadAndRender();
      });
  };

  // ── Admin tasks (from main tasks module) ───────────────────────────────────
  function _tkRenderAdmin(cont) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.admin;
    var html = _tkDimHeader('📁 پیگیری اداری', dim,
      'وظایف بازرگانی از ماژول اصلی وظایف — دپارتمان «بازرگانی». تکمیل‌شده در نمره KPI لحاظ می‌شود.');
    _tkEnsureTasksThen(function() {
      var adminTasks = _tkTradeDeptTasks();
      if (!adminTasks.length) {
        html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">' +
          'وظیفه‌ای برای این کارشناس ثبت نشده<br>' +
          '<span style="font-size:.8rem">از تب <b>وظایف</b> در بازرگانی یا تب 📌 وظایف اصلی اضافه کنید</span></div>';
      } else {
        html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">';
        adminTasks.forEach(function(t) {
          var done = t.status === 'done' || !!t.done;
          html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="window._tkOpenTradeTask(\'' + t.id + '\')">' +
            '<span style="font-size:1rem">' + (done ? '✅' : '⬜') + '</span>' +
            '<div style="flex:1">' +
            '<div style="font-size:.87rem;' + (done ? 'text-decoration:line-through;color:#9ca3af' : '') + '">' + esc(t.title) + '</div>' +
            (t.dueDate ? '<div style="font-size:.75rem;color:#9ca3af">سررسید: ' + esc(t.dueDate) + '</div>' : '') +
            '</div></div>';
        });
        html += '</div>';
      }
      cont.innerHTML = html;
    });
  }

  // ── Team tasks (from main tasks module) ────────────────────────────────────
  function _tkRenderTeam(cont) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.team;
    var html = _tkDimHeader('👥 مشارکت تیمی', dim,
      'نسبت تکمیل وظایف بازرگانی این کارشناس (همان داده تب وظایف اصلی).');
    _tkEnsureTasksThen(function() {
      var myTasks = _tkTradeDeptTasks();
      var done = myTasks.filter(function(t) { return t.status === 'done' || t.done; });
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">' +
        '<div style="display:flex;gap:20px;margin-bottom:12px">' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#374151">' + myTasks.length + '</div><div style="font-size:.78rem;color:#6b7280">کل وظایف</div></div>' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#10b981">' + done.length + '</div><div style="font-size:.78rem;color:#6b7280">تکمیل شده</div></div>' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#ef4444">' + (myTasks.length - done.length) + '</div><div style="font-size:.78rem;color:#6b7280">باقی‌مانده</div></div>' +
        '</div>';
      if (myTasks.length > 0) html += _tkBar(done.length / myTasks.length * 100);
      html += '<div style="margin-top:12px;text-align:center"><button type="button" onclick="window._tkSetTab(\'kanban\')" style="padding:6px 14px;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.8rem">📌 مدیریت در کانبان وظایف</button></div>';
      html += '</div>';
      cont.innerHTML = html;
    });
  }

  // ── KPI History ────────────────────────────────────────────────────────────
  function _tkRenderHistory(cont, list) {
    if (!list.length) {
      cont.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز ماهی نهایی نشده</div>';
      return;
    }
    var html = '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">' +
      '<h3 style="margin:0 0 14px;font-size:.95rem;font-weight:600">📈 تاریخچه ماهانه</h3>';
    list.forEach(function(row) {
      var score = row.final_score != null ? parseFloat(row.final_score) : parseFloat(row.avg_score);
      if (isNaN(score)) score = 0;
      var color = _tkScoreColor(score);
      var active = row.month === _tkMonth;
      html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;cursor:pointer' + (active ? ';background:#f8fafc;margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:8px' : '') + '" onclick="window._tkSetMonth(\'' + row.month + '\');window._tkSetTab(\'score\')">' +
        '<div style="min-width:72px;font-size:.88rem;font-weight:700;color:#374151">' + row.month + '</div>' +
        '<div style="flex:1">' + _tkBar(score) + '</div>' +
        '<div style="min-width:48px;font-size:1rem;font-weight:800;color:' + color + ';text-align:left">' + score + '</div>' +
        '<div style="min-width:80px;font-size:.75rem;text-align:left">' +
          (row.finalized ? (row.gate_passed ? '<span style="color:#10b981">✅ پاداش</span>' : '<span style="color:#f59e0b">🔒 قفل</span>') : '<span style="color:#9ca3af">—</span>') +
        '</div>' +
        '</div>';
    });
    html += '</div>';
    cont.innerHTML = html;
  }

  window._tkFinalizeMonth = function() {
    if (!_tkIsManager() || !_tkEmployee || !_tkMonth) return;
    if (!confirm('ماه ' + _tkMonth + ' برای ' + _tkEmployee + ' نهایی شود؟')) return;
    var notes = (document.getElementById('tk_finalize_notes') || {}).value.trim();
    _tkAPI('POST', '/finalize/' + encodeURIComponent(_tkEmployee) + '/' + encodeURIComponent(_tkMonth), { notes: notes || null })
      .then(function(r) {
        if (typeof showToast === 'function') showToast('✅ ماه نهایی شد · نمره: ' + (r.score && r.score.final));
        _tkLoadAndRender();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Milestones ─────────────────────────────────────────────────────────────
  var _TK_MS_TYPES = {
    clearance: 'ترخیص', sourcing: 'تامین', cost_save: 'صرفه‌جویی', project: 'پروژه', other: 'سایر'
  };
  var _TK_MS_STATUS = {
    pending: { label: 'در انتظار', color: '#f59e0b' },
    approved: { label: 'تأیید شده', color: '#10b981' },
    paid: { label: 'پرداخت شده', color: '#6366f1' }
  };

  function _tkRenderMilestones(cont, list) {
    var html = '<div style="background:#f8fafc;border-radius:12px;padding:14px;border:1px solid #e2e8f0;margin-bottom:14px;font-size:.8rem;color:#64748b">' +
      'دستاوردهای بزرگ (ترخیص موفق، سورسینگ مهم، صرفه‌جویی قابل توجه) با پاداش جداگانه ثبت می‌شوند.</div>';

    html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<h4 style="margin:0 0 12px;font-size:.9rem">+ ثبت دستاورد</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<div style="flex:2;min-width:180px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">عنوان</label>' +
        '<input id="tkms_title" placeholder="مثلاً: ترخیص محموله X" style="' + _tkInputStyle('100%') + '"></div>' +
        '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">نوع</label>' +
        '<select id="tkms_type" style="' + _tkInputStyle(120) + '">' +
        Object.keys(_TK_MS_TYPES).map(function(k) { return '<option value="' + k + '">' + _TK_MS_TYPES[k] + '</option>'; }).join('') +
        '</select></div>' +
        '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">پاداش (ریال)</label>' +
        '<input id="tkms_bonus" type="number" placeholder="0" style="' + _tkInputStyle(120) + '"></div>' +
        '<button onclick="window._tkAddMilestone()" style="' + _tkBtnStyle() + '">ثبت</button>' +
      '</div></div>';

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">هنوز دستاوردی ثبت نشده</div>';
    } else {
      html += list.map(function(m) {
        var st = _TK_MS_STATUS[m.status] || _TK_MS_STATUS.pending;
        return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e2e8f0;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">' +
            '<div>' +
              '<div style="font-size:.9rem;font-weight:600">' + esc(m.title) + '</div>' +
              '<div style="font-size:.78rem;color:#6b7280;margin-top:3px">' +
                (_TK_MS_TYPES[m.project_type] || m.project_type) +
                (m.bonus_amount ? ' · ' + _tkFmt(m.bonus_amount) + ' ریال' : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
              '<span style="font-size:.75rem;color:' + st.color + ';background:' + st.color + '18;padding:3px 10px;border-radius:99px">' + st.label + '</span>' +
              (_tkIsManager() && m.status === 'pending' ? '<button onclick="window._tkApproveMilestone(\'' + m.id + '\')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem">تأیید</button>' : '') +
              (_tkIsManager() && m.status === 'approved' ? '<button onclick="window._tkPayMilestone(\'' + m.id + '\')" style="padding:4px 10px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem">پرداخت</button>' : '') +
              (_tkIsManager() ? '<button onclick="window._tkDelMilestone(\'' + m.id + '\')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:.8rem">حذف</button>' : '') +
            '</div>' +
          '</div></div>';
      }).join('');
    }
    cont.innerHTML = html;
  }

  window._tkAddMilestone = function() {
    var title = (document.getElementById('tkms_title') || {}).value.trim();
    var project_type = (document.getElementById('tkms_type') || {}).value;
    var bonus = parseFloat((document.getElementById('tkms_bonus') || {}).value) || 0;
    if (!title) { if (typeof showToast === 'function') showToast('عنوان الزامی است'); return; }
    _tkAPI('POST', '/milestones', { employee: _tkEmployee, project_type: project_type, title: title, bonus_amount: bonus, jalali_month: _tkMonth })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkApproveMilestone = function(id) {
    _tkAPI('PUT', '/milestones/' + id, { status: 'approved' })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkPayMilestone = function(id) {
    _tkAPI('PUT', '/milestones/' + id, { status: 'paid' })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDelMilestone = function(id) {
    if (!confirm('حذف شود؟')) return;
    _tkAPI('DELETE', '/milestones/' + id)
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Deductions ─────────────────────────────────────────────────────────────
  var _TK_INDICATORS = {
    customs: 'ترخیص', report: 'گزارش روزانه', admin: 'پیگیری اداری',
    supplier: 'تامین‌کننده', finance: 'بهبود مالی', team: 'تیمی',
    warehouse: 'انبار', general: 'عمومی'
  };

  function _tkRenderDeductions(cont, list) {
    var total = list.reduce(function(s, d) { return s + (parseInt(d.points) || 0); }, 0);
    var html = '<div style="background:#fef2f2;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.85rem;color:#991b1b">' +
      'جمع کسورات این ماه: <b>' + total + '</b> امتیاز · از نمره نهایی کم می‌شود</div>';

    if (_tkIsManager()) {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px">' +
        '<h4 style="margin:0 0 12px;font-size:.9rem">+ ثبت کسر امتیاز</h4>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">شاخص</label>' +
          '<select id="tkd_ind" style="' + _tkInputStyle(130) + '">' +
          Object.keys(_TK_INDICATORS).map(function(k) { return '<option value="' + k + '">' + _TK_INDICATORS[k] + '</option>'; }).join('') +
          '</select></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">امتیاز کسر</label>' +
          '<input id="tkd_pts" type="number" min="1" max="100" value="5" style="' + _tkInputStyle(70) + '"></div>' +
          '<div style="flex:2;min-width:180px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">دلیل</label>' +
          '<input id="tkd_reason" placeholder="توضیح کوتاه..." style="' + _tkInputStyle('100%') + '"></div>' +
          '<button onclick="window._tkAddDeduction()" style="padding:7px 14px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">ثبت کسر</button>' +
        '</div></div>';
    } else {
      html += '<div style="font-size:.8rem;color:#6b7280;margin-bottom:12px">کسورات فقط توسط مدیر ثبت می‌شود.</div>';
    }

    if (!list.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">کسوراتی ثبت نشده</div>';
    } else {
      html += list.map(function(d) {
        return '<div style="background:#fff;border-radius:10px;padding:12px 14px;border:1px solid #fee2e2;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<div>' +
              '<div style="font-size:.88rem;font-weight:600;color:#991b1b">−' + d.points + ' امتیاز · ' + (_TK_INDICATORS[d.indicator] || d.indicator) + '</div>' +
              '<div style="font-size:.78rem;color:#6b7280;margin-top:2px">' + esc(d.reason) + '</div>' +
              '<div style="font-size:.72rem;color:#9ca3af;margin-top:2px">ثبت: ' + esc(d.registered_by || '') + '</div>' +
            '</div>' +
            (_tkIsManager() ? '<button onclick="window._tkDelDeduction(\'' + d.id + '\')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:.8rem">حذف</button>' : '') +
          '</div></div>';
      }).join('');
    }
    cont.innerHTML = html;
  }

  window._tkAddDeduction = function() {
    var indicator = (document.getElementById('tkd_ind') || {}).value;
    var points = parseInt((document.getElementById('tkd_pts') || {}).value) || 0;
    var reason = (document.getElementById('tkd_reason') || {}).value.trim();
    if (!reason) { if (typeof showToast === 'function') showToast('دلیل الزامی است'); return; }
    _tkAPI('POST', '/deductions', { employee: _tkEmployee, month: _tkMonth, indicator: indicator, points: points, reason: reason })
      .then(function() { if (typeof showToast === 'function') showToast('✅ کسر ثبت شد'); _tkLoadAndRender(); window._tkSetTab('score'); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDelDeduction = function(id) {
    if (!confirm('کسر حذف شود؟')) return;
    _tkAPI('DELETE', '/deductions/' + id)
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkLoadAndRender = _tkLoadAndRender;

  window._tkExpose = {
    tradeAPI: _tkTradeAPI,
    api: _tkAPI,
    dateInput: _tkDateInput,
    inputStyle: _tkInputStyle,
    textareaStyle: _tkTextareaStyle,
    btnStyle: _tkBtnStyle,
    isManager: _tkIsManager,
    employee: function() { return _tkEmployee; },
    month: function() { return _tkMonth; }
  };

})();

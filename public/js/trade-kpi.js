'use strict';
/* بازرگانی — KPI مبتنی بر هدف (۷ شاخص) */
(function() {

  var _tkTab = 'score';  // score | kanban | customs | report | admin | supplier | finance | team | warehouse
  var _tkAllTasks = [];
  var _TK_COLS = [
    { id: 'todo',    label: 'باید انجام شود', color: '#6366f1' },
    { id: 'doing',   label: 'در حال انجام',   color: '#f59e0b' },
    { id: 'waiting', label: 'منتظر',           color: '#8b5cf6' },
    { id: 'done',    label: 'تکمیل شده',      color: '#10b981' },
  ];
  var _tkEmployee = '';
  var _tkMonth = '';
  var _tkScore = null;
  var _tkTargets = null;
  var _tkMonthRecord = null;

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
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch('/api/trade-kpi' + path, opts).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.status); });
      return r.json();
    });
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

    // Month selector — all 12 months per year (current + 2 previous years)
    var monthOpts = _tkBuildMonthOptions();
    var monthSel = '<select onchange="window._tkSetMonth(this.value)" style="' + _tkInputStyle() + 'min-width:140px">' +
      monthOpts.map(function(o) {
        return '<option value="' + o.value + '"' + (o.value === _tkMonth ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('') + '</select>';

    var empSel = '';
    if (_tkIsManager() && typeof USERS !== 'undefined') {
      var _tradeMembers = (typeof _DEFAULT_MEMBERS !== 'undefined' && _DEFAULT_MEMBERS.length)
        ? _DEFAULT_MEMBERS.filter(function(m) { return (m.role === 'بازرگانی' || m.role === 'کارشناس بازرگانی') && m.active !== false; })
        : Object.keys(USERS).map(function(uid) { return { id: uid, name: USERS[uid] }; });
      if (_tradeMembers.length) {
        empSel = '<select onchange="window._tkSetEmployee(this.value)" style="' + _tkInputStyle() + '">' +
          '<option value="">انتخاب کارشناس بازرگانی</option>';
        _tradeMembers.forEach(function(m) {
          empSel += '<option value="' + m.id + '"' + (m.id === _tkEmployee ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
        });
        empSel += '</select>';
      }
    }

    var tabs = [
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
      { id: 'deductions', icon: '➖', label: 'کسورات' }
    ];

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
      empLabel = '<span style="font-size:.82rem;color:#6b7280">کارشناس: <b>' + esc(empName) + '</b></span>';
    }

    root.innerHTML =
      '<div style="max-width:900px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
          '<h2 style="margin:0;font-size:1.1rem;font-weight:700">🏭 بازرگانی — KPI</h2>' +
          monthSel + empSel + empLabel +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">' + tabBtns + '</div>' +
        '<div id="tkContent"><div style="text-align:center;padding:40px;color:#9ca3af">در حال بارگذاری...</div></div>' +
      '</div>';

    if (_tkEmployee && _tkMonth) {
      _tkLoadAndRender();
    } else {
      document.getElementById('tkContent').innerHTML =
        '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">' +
        (_tkIsManager() ? 'لطفاً یک کارشناس انتخاب کنید' : 'در حال بارگذاری...') + '</div>';
    }
  };

  window._tkSetTab = function(id) { _tkTab = id; window.renderTradeKPIPanel(); };
  window._tkSetMonth = function(m) { _tkMonth = m; _tkScore = null; window.renderTradeKPIPanel(); };
  window._tkSetEmployee = function(e) { _tkEmployee = e; _tkScore = null; window.renderTradeKPIPanel(); };

  function _tkLoadAndRender() {
    var cont = document.getElementById('tkContent');
    if (!cont) return;
    var emp = encodeURIComponent(_tkEmployee);
    var mon = encodeURIComponent(_tkMonth);

    var promises = [
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
    else if (_tkTab === 'kanban' || _tkTab === 'admin' || _tkTab === 'team') promises.push(_tkAPI('GET', '/tasks').catch(function() { return []; }));

    Promise.all(promises).then(function(res) {
      _tkScore = res[0];
      _tkTargets = res[1] || _tkDefaultTargets();
      var extra = res[2];

      if (_tkTab === 'score') {
        var hist = extra || [];
        _tkMonthRecord = hist.find(function(h) { return h.month === _tkMonth; }) || null;
        _tkRenderScore(cont);
      } else if (_tkTab === 'history') _tkRenderHistory(cont, extra || []);
      else if (_tkTab === 'kanban') _tkRenderKanban(cont, extra || []);
      else if (_tkTab === 'customs') _tkRenderCustoms(cont, extra || []);
      else if (_tkTab === 'report') _tkRenderReport(cont, extra || []);
      else if (_tkTab === 'supplier') _tkRenderSupplier(cont, extra || []);
      else if (_tkTab === 'finance') _tkRenderFinance(cont, extra || []);
      else if (_tkTab === 'warehouse') _tkRenderWarehouse(cont, extra);
      else if (_tkTab === 'admin') _tkRenderAdmin(cont, extra || []);
      else if (_tkTab === 'team') _tkRenderTeam(cont, extra || []);
      else if (_tkTab === 'milestones') _tkRenderMilestones(cont, extra || []);
      else if (_tkTab === 'deductions') _tkRenderDeductions(cont, extra || []);
    }).catch(function(e) {
      cont.innerHTML = '<div style="color:#ef4444;padding:20px">خطا: ' + esc(e.message) + '</div>';
    });
  }

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

  // ── Kanban وظایف بازرگانی ─────────────────────────────────────────────────
  function _tkRenderKanban(cont, tasks) {
    _tkAllTasks = tasks;
    var cols = _TK_COLS;
    var PRIORITY = { 1: { label: 'کم', color: '#10b981' }, 2: { label: 'متوسط', color: '#f59e0b' }, 3: { label: 'بالا', color: '#ef4444' } };

    var addForm =
      '<div style="background:#f8fafc;border-radius:12px;padding:14px;border:1px solid #e2e8f0;margin-bottom:16px">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
          '<div style="flex:2;min-width:180px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">عنوان وظیفه</label>' +
          '<input id="tka_title" placeholder="عنوان وظیفه جدید..." style="' + _tkInputStyle('100%') + '"></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">مهلت</label>' +
          _tkDateInput('tka_deadline', '', 120) + '</div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">اولویت</label>' +
          '<select id="tka_priority" style="' + _tkInputStyle(90) + '"><option value="1">کم</option><option value="2" selected>متوسط</option><option value="3">بالا</option></select></div>' +
          '<button onclick="_tkAddTask()" style="' + _tkBtnStyle() + '">+ افزودن</button>' +
        '</div>' +
      '</div>';

    var board = '<div style="display:grid;grid-template-columns:repeat(' + cols.length + ',1fr);gap:12px;overflow-x:auto">';
    cols.forEach(function(col) {
      var colTasks = tasks.filter(function(t) { return (t.status || 'todo') === col.id; });
      var cards = colTasks.map(function(t) {
        var p = PRIORITY[t.priority] || PRIORITY[2];
        return '<div style="background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #e2e8f0;margin-bottom:8px;cursor:pointer" onclick="_tkOpenTask(\'' + t.id + '\')">' +
          '<div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:6px">' + esc(t.title) + '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between">' +
            '<span style="font-size:.72rem;color:' + p.color + ';background:' + p.color + '18;padding:2px 7px;border-radius:99px">' + p.label + '</span>' +
            (t.deadline ? '<span style="font-size:.72rem;color:#9ca3af">' + t.deadline + '</span>' : '') +
          '</div>' +
          (t.assigned_to ? '<div style="font-size:.72rem;color:#6b7280;margin-top:4px">👤 ' + esc(typeof USERS!=='undefined'?USERS[t.assigned_to]||t.assigned_to:t.assigned_to) + '</div>' : '') +
          '</div>';
      }).join('');

      board += '<div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:' + col.color + '"></div>' +
          '<span style="font-size:.85rem;font-weight:600;color:#374151">' + col.label + '</span>' +
          '<span style="margin-right:auto;font-size:.75rem;color:#9ca3af;background:#f1f5f9;border-radius:99px;padding:1px 7px">' + colTasks.length + '</span>' +
        '</div>' +
        '<div id="tkcol_' + col.id + '" style="min-height:80px">' + cards + '</div>' +
        '</div>';
    });
    board += '</div>';

    cont.innerHTML = '<div>' + addForm + board + '</div>';
  }

  window._tkAddTask = function() {
    var title = (document.getElementById('tka_title') || {}).value.trim();
    var deadline = (document.getElementById('tka_deadline') || {}).value.trim();
    var priority = parseInt((document.getElementById('tka_priority') || {}).value) || 2;
    if (!title) { if (typeof showToast === 'function') showToast('عنوان الزامی است'); return; }
    _tkAPI('POST', '/tasks', { title, deadline: deadline || null, priority, status: 'todo', assigned_to: _tkEmployee || null, category: 'بازرگانی' })
      .then(function() { _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkOpenTask = function(id) {
    var t = _tkAllTasks.find(function(x) { return x.id === id; });
    if (!t) return;
    var cols = _TK_COLS;
    var statusOpts = cols.map(function(c) {
      return '<option value="' + c.id + '"' + (t.status === c.id ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');
    var body =
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:3px">عنوان</label>' +
        '<input id="tke_title" value="' + esc(t.title) + '" style="' + _tkInputStyle('100%') + '"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<div style="flex:1"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:3px">وضعیت</label>' +
          '<select id="tke_status" style="' + _tkInputStyle('100%') + '">' + statusOpts + '</select></div>' +
          '<div style="flex:1"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:3px">مهلت</label>' +
          _tkDateInput('tke_deadline', t.deadline || '', '100%') + '</div>' +
        '</div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:3px">یادداشت</label>' +
        '<textarea id="tke_note" rows="2" style="' + _tkTextareaStyle() + '">' + esc(t.note || '') + '</textarea></div>' +
      '</div>';
    var footer =
      '<button onclick="_tkSaveTask(\'' + id + '\')" style="' + _tkBtnStyle() + '">ذخیره</button>' +
      '<button onclick="_tkDeleteTask(\'' + id + '\')" style="padding:7px 14px;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem;margin-right:8px">حذف</button>';
    if (typeof openModal === 'function') openModal('tkEditModal', esc(t.title), body, footer);
  };

  window._tkSaveTask = function(id) {
    var title = (document.getElementById('tke_title') || {}).value.trim();
    var status = (document.getElementById('tke_status') || {}).value;
    var deadline = (document.getElementById('tke_deadline') || {}).value.trim();
    var note = (document.getElementById('tke_note') || {}).value.trim();
    _tkAPI('PUT', '/tasks/' + id, { title, status, deadline: deadline || null, note: note || null })
      .then(function() { if (typeof closeModal === 'function') closeModal('tkEditModal'); _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkDeleteTask = function(id) {
    _tkAPI('DELETE', '/tasks/' + id)
      .then(function() { if (typeof closeModal === 'function') closeModal('tkEditModal'); _tkLoadAndRender(); })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
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
        '<button onclick="window._tkImportWms()" style="padding:6px 12px;background:#0ea5e9;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:.8rem">📥 بارگذاری از WMS</button>' +
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
        _tkLoadAndRender();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  // ── Admin tasks ────────────────────────────────────────────────────────────
  function _tkRenderAdmin(cont, tasks) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.admin;
    var html = _tkDimHeader('📁 پیگیری اداری', dim,
      'وظایف اداری این کارشناس که در سیستم تخصیص داده شده‌اند. وظایف تکمیل‌شده در نمره محاسبه می‌شوند.');
    var myTasks = tasks.filter(function(t) { return t.assigned_to === _tkEmployee; });
    var adminTasks = myTasks.filter(function(t) {
      return !t.category || t.category === 'admin' || t.category === 'پیگیری اداری' || t.category === 'بازرگانی';
    });
    if (!adminTasks.length) {
      html += '<div style="text-align:center;padding:30px;color:#9ca3af;background:#f8fafc;border-radius:12px">' +
        'وظیفه اداری برای این کارشناس در این ماه ثبت نشده<br><span style="font-size:.8rem">وظایف از تب وظایف اصلی مدیریت می‌شوند</span>' +
        '</div>';
    } else {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">' +
        adminTasks.map(function(t) {
          var done = t.status === 'done' || !!t.completed_at;
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
            '<span style="font-size:1rem">' + (done ? '✅' : '⬜') + '</span>' +
            '<div style="flex:1">' +
              '<div style="font-size:.87rem;' + (done ? 'text-decoration:line-through;color:#9ca3af' : '') + '">' + esc(t.title) + '</div>' +
              (t.deadline ? '<div style="font-size:.75rem;color:#9ca3af">مهلت: ' + t.deadline + '</div>' : '') +
            '</div>' +
            '</div>';
        }).join('') +
        '</div>';
    }
    cont.innerHTML = html;
  }

  // ── Team tasks ─────────────────────────────────────────────────────────────
  function _tkRenderTeam(cont, tasks) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.team;
    var html = _tkDimHeader('👥 مشارکت تیمی', dim,
      'نسبت وظایف تیمی که این کارشناس تکمیل کرده است. وظایف از تب وظایف تخصیص داده می‌شوند.');
    var myTasks = tasks.filter(function(t) { return t.assigned_to === _tkEmployee; });
    var done = myTasks.filter(function(t) { return t.status === 'done'; });
    html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0">' +
      '<div style="display:flex;gap:20px;margin-bottom:12px">' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#374151">' + myTasks.length + '</div><div style="font-size:.78rem;color:#6b7280">تخصیص داده شده</div></div>' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#10b981">' + done.length + '</div><div style="font-size:.78rem;color:#6b7280">تکمیل شده</div></div>' +
        '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#ef4444">' + (myTasks.length - done.length) + '</div><div style="font-size:.78rem;color:#6b7280">باقی‌مانده</div></div>' +
      '</div>';
    if (myTasks.length > 0) {
      html += _tkBar(done.length / myTasks.length * 100);
    }
    html += '</div>';
    cont.innerHTML = html;
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

})();

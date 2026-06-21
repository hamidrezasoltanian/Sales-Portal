'use strict';
/* بازرگانی — KPI مبتنی بر هدف (۷ شاخص) */
(function() {

  var _tkTab = 'score';  // score | customs | report | admin | supplier | finance | team | warehouse
  var _tkEmployee = '';
  var _tkMonth = '';
  var _tkScore = null;
  var _tkTargets = null;

  // ── Date helpers ───────────────────────────────────────────────────────────
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

    // Month selector — current + 5 previous months
    var months = [];
    var d = new Date();
    for (var i = 0; i < 6; i++) {
      var mm = d.getMonth() + 1 - i;
      var yy = d.getFullYear();
      while (mm < 1) { mm += 12; yy--; }
      var j = g2j(yy, mm, 1);
      months.push(j[0] + '/' + String(j[1]).padStart(2, '0'));
    }

    var monthSel = '<select onchange="window._tkSetMonth(this.value)" style="' + _tkInputStyle() + '">' +
      months.map(function(m) {
        return '<option value="' + m + '"' + (m === _tkMonth ? ' selected' : '') + '>' + m + '</option>';
      }).join('') + '</select>';

    var empSel = '';
    if (_tkIsManager() && typeof USERS !== 'undefined') {
      empSel = '<select onchange="window._tkSetEmployee(this.value)" style="' + _tkInputStyle() + '">' +
        '<option value="">انتخاب کارشناس</option>';
      Object.keys(USERS).forEach(function(uid) {
        empSel += '<option value="' + uid + '"' + (uid === _tkEmployee ? ' selected' : '') + '>' + esc(USERS[uid] || uid) + '</option>';
      });
      empSel += '</select>';
    }

    var tabs = [
      { id: 'score',     icon: '📊', label: 'نمره KPI' },
      { id: 'customs',   icon: '📦', label: 'ترخیص' },
      { id: 'report',    icon: '📋', label: 'گزارش روزانه' },
      { id: 'admin',     icon: '📁', label: 'پیگیری اداری' },
      { id: 'supplier',  icon: '🔍', label: 'تامین‌کننده' },
      { id: 'finance',   icon: '💰', label: 'بهبود مالی' },
      { id: 'team',      icon: '👥', label: 'تیمی' },
      { id: 'warehouse', icon: '🏭', label: 'انبار' }
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

    if (_tkTab === 'customs') promises.push(_tkAPI('GET', '/clearances/' + emp + '/' + mon).catch(function() { return []; }));
    else if (_tkTab === 'report') promises.push(_tkAPI('GET', '/reports/' + emp + '/' + mon).catch(function() { return []; }));
    else if (_tkTab === 'supplier') promises.push(_tkAPI('GET', '/suppliers/' + emp + '/' + mon).catch(function() { return []; }));
    else if (_tkTab === 'finance') promises.push(_tkAPI('GET', '/finance/' + emp + '/' + mon).catch(function() { return []; }));
    else if (_tkTab === 'warehouse') promises.push(_tkAPI('GET', '/warehouse/' + emp + '/' + mon).catch(function() { return null; }));
    else if (_tkTab === 'admin' || _tkTab === 'team') promises.push(_tkAPI('GET', '/tasks').catch(function() { return []; }));

    Promise.all(promises).then(function(res) {
      _tkScore = res[0];
      _tkTargets = res[1] || _tkDefaultTargets();
      var extra = res[2];

      if (_tkTab === 'score') _tkRenderScore(cont);
      else if (_tkTab === 'customs') _tkRenderCustoms(cont, extra || []);
      else if (_tkTab === 'report') _tkRenderReport(cont, extra || []);
      else if (_tkTab === 'supplier') _tkRenderSupplier(cont, extra || []);
      else if (_tkTab === 'finance') _tkRenderFinance(cont, extra || []);
      else if (_tkTab === 'warehouse') _tkRenderWarehouse(cont, extra);
      else if (_tkTab === 'admin') _tkRenderAdmin(cont, extra || []);
      else if (_tkTab === 'team') _tkRenderTeam(cont, extra || []);
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
    var color = _tkScoreColor(final);

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

    var html = '<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px;text-align:center">' +
      '<div style="font-size:.9rem;color:#6b7280;margin-bottom:8px">نمره کلی · ' + _tkMonth + '</div>' +
      '<div style="font-size:3.5rem;font-weight:800;color:' + color + '">' + final + '</div>' +
      '<div style="font-size:.85rem;color:#9ca3af;margin-bottom:16px">از ۱۰۰</div>' +
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
      'برای ترخیص: اگر میانگین روزها بیشتر از هدف باشد، نمره کاهش می‌یابد' +
      '</div>';

    if (_tkIsManager()) {
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
        '<input id="tkc_start" placeholder="مثلاً: ' + _tkToday() + '" value="' + _tkToday() + '" style="' + _tkInputStyle(120) + '"></div>' +
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

  // ── Admin tasks ────────────────────────────────────────────────────────────
  function _tkRenderAdmin(cont, tasks) {
    var dim = _tkScore && _tkScore.dimensions && _tkScore.dimensions.admin;
    var html = _tkDimHeader('📁 پیگیری اداری', dim,
      'وظایف اداری این کارشناس که در سیستم تخصیص داده شده‌اند. وظایف تکمیل‌شده در نمره محاسبه می‌شوند.');
    var myTasks = tasks.filter(function(t) { return t.assigned_to === _tkEmployee; });
    var adminTasks = myTasks.filter(function(t) {
      return t.category === 'admin' || t.category === 'پیگیری اداری' || !t.category;
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

})();

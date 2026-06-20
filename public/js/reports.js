/* Reports Panel — گزارش‌های تحلیلی */
(function () {
  'use strict';

  var _rTab = 'sales'; // sales | pipeline | activity | competitor | coverage | payroll | support | mission

  var STATUS_LABELS = {
    draft: 'پیش‌نویس', sent: 'ارسال‌شده', approved: 'تأیید', rejected: 'رد', cancelled: 'لغو'
  };
  var STATUS_COLORS = {
    draft: '#94a3b8', sent: '#60a5fa', approved: '#34d399', rejected: '#f87171', cancelled: '#d1d5db'
  };
  var CAT_LABELS = {
    complaint: 'شکایت', service: 'خدمات پس از فروش', training: 'آموزش', other: 'سایر'
  };

  function _fmtMoney(n) {
    n = parseFloat(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.?0+$/, '') + ' میلیارد';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' میلیون';
    return n.toLocaleString('fa-IR');
  }

  function _fmtNum(n) {
    return (parseFloat(n) || 0).toLocaleString('fa-IR');
  }

  function _bar(pct, color) {
    color = color || '#6366f1';
    pct = Math.min(100, Math.max(0, pct));
    return '<div style="flex:1;background:#e2e8f0;border-radius:4px;height:18px;overflow:hidden">' +
      '<div style="width:' + pct + '%;background:' + color + ';height:100%;border-radius:4px;transition:width .4s"></div>' +
      '</div>';
  }

  function _barRow(label, pct, color, valueStr) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<div style="width:130px;text-align:right;font-size:.83rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + label + '</div>' +
      _bar(pct, color) +
      '<div style="width:100px;font-size:.83rem;color:#374151;text-align:left;direction:ltr">' + valueStr + '</div>' +
      '</div>';
  }

  function _card(title, value, sub, color) {
    color = color || '#6366f1';
    return '<div style="background:#fff;border-radius:10px;padding:14px 18px;border:1px solid #e2e8f0;min-width:130px;flex:1">' +
      '<div style="font-size:.78rem;color:#6b7280;margin-bottom:4px">' + title + '</div>' +
      '<div style="font-size:1.35rem;font-weight:700;color:' + color + '">' + value + '</div>' +
      (sub ? '<div style="font-size:.75rem;color:#9ca3af;margin-top:2px">' + sub + '</div>' : '') +
      '</div>';
  }

  function _section(title, body) {
    return '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:16px">' +
      '<h3 style="margin:0 0 16px;font-size:1rem;font-weight:600;color:#1e293b">' + title + '</h3>' +
      body + '</div>';
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  window.renderReportsPanel = function () {
    var root = document.getElementById('reportsRoot');
    if (!root) return;

    var tabs = [
      { id: 'sales',      icon: '📈', label: 'فروش' },
      { id: 'pipeline',   icon: '🔄', label: 'قیف فروش' },
      { id: 'activity',   icon: '📊', label: 'فعالیت‌ها' },
      { id: 'competitor', icon: '🥊', label: 'رقبا' },
      { id: 'coverage',   icon: '🗺',  label: 'پوشش استان' },
      { id: 'payroll',    icon: '💵', label: 'حقوق تاریخی' },
      { id: 'support',    icon: '🎧', label: 'پشتیبانی' },
      { id: 'mission',    icon: '✈',  label: 'ماموریت' },
    ];

    var isSuperAdmin = typeof _isSuperAdmin === 'function' ? _isSuperAdmin() :
      (typeof window._authUserRole !== 'undefined' && window._authUserRole === 'سوپر ادمین');

    var tabBtns = tabs.map(function (t) {
      if (t.id === 'payroll' && !isSuperAdmin) return '';
      return '<button onclick="window._rSetTab(\'' + t.id + '\')" id="rTab_' + t.id + '" ' +
        'style="padding:7px 14px;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem;' +
        'background:' + (_rTab === t.id ? '#6366f1' : '#f1f5f9') + ';' +
        'color:' + (_rTab === t.id ? '#fff' : '#374151') + ';transition:all .2s">' +
        t.icon + ' ' + t.label + '</button>';
    }).join('');

    root.innerHTML =
      '<div style="max-width:1100px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
          '<h2 style="margin:0;font-size:1.25rem;font-weight:700">📊 گزارش‌های تحلیلی</h2>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">' + tabBtns + '</div>' +
        '<div id="rContent"><div style="text-align:center;padding:40px;color:#9ca3af">در حال بارگذاری...</div></div>' +
      '</div>';

    _rRender();
  };

  window._rSetTab = function (id) {
    _rTab = id;
    window.renderReportsPanel();
  };

  function _rRender() {
    var cont = document.getElementById('rContent');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">در حال بارگذاری...</div>';

    if (_rTab === 'sales')      _rSales(cont);
    else if (_rTab === 'pipeline')   _rPipeline(cont);
    else if (_rTab === 'activity')   _rActivity(cont);
    else if (_rTab === 'competitor') _rCompetitor(cont);
    else if (_rTab === 'coverage')   _rCoverage(cont);
    else if (_rTab === 'payroll')    _rPayroll(cont);
    else if (_rTab === 'support')    _rSupport(cont);
    else if (_rTab === 'mission')    _rMission(cont);
  }

  // ── 1. فروش ────────────────────────────────────────────────────────────────

  function _rSales(cont) {
    fetch('/api/reports/sales-trend?months=6')
      .then(function (r) { return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;}); })
      .then(function (data) {
        var rows = data.rows || [];
        var months = data.months || [];

        if (!rows.length) {
          cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">هنوز داده‌ای وجود ندارد</p>';
          return;
        }

        // Group by employee
        var empMap = {};
        rows.forEach(function (r) {
          if (!empMap[r.employee]) empMap[r.employee] = { name: r.display_name, months: {}, totalApproved: 0 };
          empMap[r.employee].months[r.month] = r;
          empMap[r.employee].totalApproved += r.approved_total;
        });

        var emps = Object.keys(empMap).sort(function (a, b) {
          return empMap[b].totalApproved - empMap[a].totalApproved;
        });

        var maxTotal = 0;
        emps.forEach(function (e) { if (empMap[e].totalApproved > maxTotal) maxTotal = empMap[e].totalApproved; });

        // Monthly totals row
        var monthTotals = {};
        months.forEach(function (m) { monthTotals[m] = 0; });
        rows.forEach(function (r) { monthTotals[r.month] = (monthTotals[r.month] || 0) + r.approved_total; });

        // Summary cards
        var grandTotal = Object.values(monthTotals).reduce(function (s, v) { return s + v; }, 0);
        var totalPFs = rows.reduce(function (s, r) { return s + r.count; }, 0);
        var totalApproved = rows.reduce(function (s, r) { return s + r.approved_count; }, 0);
        var convRate = totalPFs > 0 ? Math.round((totalApproved / totalPFs) * 100) : 0;

        var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
          _card('مجموع فروش تأیید‌شده', _fmtMoney(grandTotal), months.length + ' ماه گذشته', '#10b981') +
          _card('نرخ تبدیل', convRate + '٪', totalApproved + ' از ' + totalPFs + ' پیش‌فاکتور', '#6366f1') +
          _card('تعداد پیش‌فاکتور', _fmtNum(totalPFs), 'کل در بازه', '#f59e0b') +
          '</div>';

        // Table: employees × months
        var thMonths = months.map(function (m) { return '<th style="padding:6px 10px;background:#f8fafc;font-weight:600;font-size:.8rem;white-space:nowrap">' + m + '</th>'; }).join('');
        var tBody = emps.map(function (e) {
          var emp = empMap[e];
          var cells = months.map(function (m) {
            var row = emp.months[m];
            if (!row) return '<td style="padding:6px 10px;text-align:center;color:#9ca3af">—</td>';
            return '<td style="padding:6px 10px;text-align:center;font-size:.82rem">' +
              '<div style="font-weight:600;color:#10b981">' + _fmtMoney(row.approved_total) + '</div>' +
              '<div style="color:#9ca3af;font-size:.75rem">' + row.approved_count + '/' + row.count + ' تأیید</div>' +
              '</td>';
          }).join('');
          return '<tr style="border-bottom:1px solid #f1f5f9">' +
            '<td style="padding:8px 12px;font-weight:600;white-space:nowrap">' + (emp.name || e) + '</td>' +
            cells +
            '<td style="padding:8px 12px;font-weight:700;color:#10b981;white-space:nowrap">' + _fmtMoney(emp.totalApproved) + '</td>' +
            '</tr>';
        }).join('');

        // Total row
        var totalCells = months.map(function (m) {
          return '<td style="padding:6px 10px;text-align:center;font-weight:600;font-size:.82rem;color:#6366f1">' + _fmtMoney(monthTotals[m] || 0) + '</td>';
        }).join('');

        html += _section('جزئیات فروش به تفکیک کارشناس',
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
          '<thead><tr>' +
          '<th style="padding:6px 12px;text-align:right;background:#f8fafc;font-weight:600;font-size:.8rem">کارشناس</th>' +
          thMonths +
          '<th style="padding:6px 10px;background:#f8fafc;font-weight:600;font-size:.8rem">جمع</th>' +
          '</tr></thead><tbody>' +
          tBody +
          '<tr style="background:#f0fdf4"><td style="padding:8px 12px;font-weight:700">جمع ماه</td>' + totalCells + '<td style="padding:8px 12px;font-weight:700;color:#10b981">' + _fmtMoney(grandTotal) + '</td></tr>' +
          '</tbody></table></div>');

        // Bar chart per employee total
        html += _section('مقایسه کارشناسان (جمع ۶ ماه)',
          emps.map(function (e) {
            var pct = maxTotal > 0 ? Math.round((empMap[e].totalApproved / maxTotal) * 100) : 0;
            return _barRow(empMap[e].name || e, pct, '#10b981', _fmtMoney(empMap[e].totalApproved));
          }).join(''));

        cont.innerHTML = html;
      })
      .catch(function (e) {
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:30px">خطا: ' + e.message + '</p>';
      });
  }

  // ── 2. قیف فروش ────────────────────────────────────────────────────────────

  function _rPipeline(cont) {
    fetch('/api/reports/pipeline')
      .then(function (r) { return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;}); })
      .then(function (data) {
        var byStatus = data.byStatus || [];
        var byEmp    = data.byEmployee || [];
        var trend    = data.trend || [];

        var totalCount = byStatus.reduce(function (s, r) { return s + r.count; }, 0);
        var totalValue = byStatus.reduce(function (s, r) { return s + r.total_value; }, 0);
        var approved   = byStatus.find(function (r) { return r.status === 'approved'; }) || {};
        var convRate   = totalCount > 0 ? Math.round(((approved.count || 0) / totalCount) * 100) : 0;

        var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
          _card('کل پیش‌فاکتور', _fmtNum(totalCount), 'همه وضعیت‌ها', '#6366f1') +
          _card('ارزش کل', _fmtMoney(totalValue), 'ریال', '#f59e0b') +
          _card('نرخ تبدیل', convRate + '٪', (approved.count||0) + ' تأیید از ' + totalCount, '#10b981') +
          _card('میانگین چرخه', (data.avgCycleDays||0).toFixed(0) + ' روز', 'از ایجاد تا تأیید', '#8b5cf6') +
          '</div>';

        // Funnel by status
        var maxCount = Math.max.apply(null, byStatus.map(function(r){ return r.count; }).concat([1]));
        html += _section('قیف به تفکیک وضعیت',
          byStatus.map(function (r) {
            var pct = Math.round((r.count / maxCount) * 100);
            return _barRow(STATUS_LABELS[r.status] || r.status, pct, STATUS_COLORS[r.status] || '#6366f1',
              r.count + ' — ' + _fmtMoney(r.total_value));
          }).join(''));

        // By employee
        var maxEmpVal = Math.max.apply(null, byEmp.map(function(r){ return r.approved_value; }).concat([1]));
        html += _section('عملکرد کارشناسان',
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
          '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:8px 12px;text-align:right">کارشناس</th>' +
          '<th style="padding:8px 12px">کل</th><th style="padding:8px 12px">تأیید</th>' +
          '<th style="padding:8px 12px">نرخ تبدیل</th><th style="padding:8px 12px">ارزش تأیید</th>' +
          '</tr></thead><tbody>' +
          byEmp.map(function (e) {
            var rate = e.total > 0 ? Math.round((e.approved / e.total) * 100) : 0;
            return '<tr style="border-bottom:1px solid #f1f5f9">' +
              '<td style="padding:8px 12px;font-weight:600">' + (e.display_name||e.employee) + '</td>' +
              '<td style="padding:8px 12px;text-align:center">' + e.total + '</td>' +
              '<td style="padding:8px 12px;text-align:center;color:#10b981;font-weight:600">' + e.approved + '</td>' +
              '<td style="padding:8px 12px;text-align:center">' + rate + '٪</td>' +
              '<td style="padding:8px 12px;text-align:center;font-weight:600">' + _fmtMoney(e.approved_value) + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>');

        // Trend
        if (trend.length) {
          var maxTrend = Math.max.apply(null, trend.map(function(r){return r.approved_total;}).concat([1]));
          html += _section('روند ماهانه فروش تأیید‌شده',
            trend.slice().reverse().map(function (r) {
              var pct = Math.round((r.approved_total / maxTrend) * 100);
              return _barRow(r.month, pct, '#10b981', _fmtMoney(r.approved_total) + ' (' + r.count + ')');
            }).join(''));
        }

        cont.innerHTML = html;
      })
      .catch(function (e) {
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:30px">خطا: ' + e.message + '</p>';
      });
  }

  // ── 3. فعالیت‌ها ───────────────────────────────────────────────────────────

  function _rActivity(cont) {
    if (typeof DB === 'undefined' || !DB) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">داده‌ای بارگذاری نشده</p>';
      return;
    }

    var callLog    = DB.callLog    || [];
    var visitLog   = DB.visitLog   || [];
    var salesLog   = DB.salesLog   || [];
    var changeLog  = DB.changeLog  || [];

    // Get last 6 months
    var now = typeof todayStr === 'function' ? todayStr() : '';
    var nowParts = now ? now.split('/').map(Number) : [1403, 1, 1];
    var months6 = [];
    for (var i = 0; i < 6; i++) {
      var m = nowParts[1] - i;
      var y = nowParts[0];
      while (m <= 0) { m += 12; y--; }
      months6.push(y + '/' + (m < 10 ? '0' + m : String(m)));
    }
    var months6Set = new Set(months6);

    function getMonth(dateStr) {
      if (!dateStr) return null;
      var parts = String(dateStr).split('/');
      if (parts.length >= 2) return parts[0] + '/' + (parts[1].length < 2 ? '0' + parts[1] : parts[1]);
      return null;
    }

    // Aggregate by user+month
    var byUser = {}; // {user: {month: {calls, visits, sales, edits}}}

    function inc(user, month, key) {
      if (!user || !month || !months6Set.has(month)) return;
      if (!byUser[user]) byUser[user] = {};
      if (!byUser[user][month]) byUser[user][month] = { calls: 0, visits: 0, sales: 0, edits: 0 };
      byUser[user][month][key]++;
    }

    callLog.forEach(function (e) { inc(e.by || e.user, getMonth(e.date || e.at), 'calls'); });
    visitLog.forEach(function (e) { inc(e.by || e.user, getMonth(e.date || e.at), 'visits'); });
    salesLog.forEach(function (e) { inc(e.by || e.user, getMonth(e.date || e.at), 'sales'); });
    changeLog.forEach(function (e) {
      var m = getMonth(e.date || (e.at ? e.at.slice(0, 10) : null));
      if (m) {
        // Convert Gregorian at to Jalali month approx
        var user = e.by || e.user;
        if (!user || !m) return;
        if (!byUser[user]) byUser[user] = {};
        if (!byUser[user][m]) byUser[user][m] = { calls: 0, visits: 0, sales: 0, edits: 0 };
        byUser[user][m].edits++;
      }
    });

    var USERS_map = typeof USERS !== 'undefined' ? USERS : {};
    var users = Object.keys(byUser);
    if (!users.length) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">داده فعالیتی وجود ندارد</p>';
      return;
    }

    // Summary totals
    var totals = { calls: 0, visits: 0, sales: 0, edits: 0 };
    users.forEach(function (u) {
      months6.forEach(function (m) {
        var d = (byUser[u] && byUser[u][m]) || {};
        totals.calls  += d.calls  || 0;
        totals.visits += d.visits || 0;
        totals.sales  += d.sales  || 0;
        totals.edits  += d.edits  || 0;
      });
    });

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
      _card('تماس‌ها', _fmtNum(totals.calls), '۶ ماه گذشته', '#3b82f6') +
      _card('ویزیت‌ها', _fmtNum(totals.visits), '۶ ماه گذشته', '#10b981') +
      _card('ثبت فروش', _fmtNum(totals.sales), '۶ ماه گذشته', '#f59e0b') +
      _card('ویرایش‌ها', _fmtNum(totals.edits), '۶ ماه گذشته', '#8b5cf6') +
      '</div>';

    // Table
    var thMonths = months6.map(function (m) {
      return '<th style="padding:6px 8px;font-size:.78rem;text-align:center;background:#f8fafc;white-space:nowrap">' + m + '</th>';
    }).join('');

    var tbody = users.map(function (u) {
      var name = USERS_map[u] || u;
      var rowTotals = { calls: 0, visits: 0, sales: 0 };
      var cells = months6.map(function (m) {
        var d = (byUser[u] && byUser[u][m]) || {};
        rowTotals.calls  += d.calls  || 0;
        rowTotals.visits += d.visits || 0;
        rowTotals.sales  += d.sales  || 0;
        var hasData = d.calls || d.visits || d.sales;
        return '<td style="padding:6px 8px;text-align:center;font-size:.8rem">' +
          (hasData ? '<span style="color:#3b82f6">📞' + (d.calls||0) + '</span> ' +
                     '<span style="color:#10b981">🚗' + (d.visits||0) + '</span>' : '<span style="color:#d1d5db">—</span>') +
          '</td>';
      }).join('');
      return '<tr style="border-bottom:1px solid #f1f5f9">' +
        '<td style="padding:8px 12px;font-weight:600;white-space:nowrap">' + name + '</td>' +
        cells +
        '<td style="padding:8px 12px;text-align:center;font-size:.8rem">' +
          '<span style="color:#3b82f6">📞' + rowTotals.calls + '</span> ' +
          '<span style="color:#10b981">🚗' + rowTotals.visits + '</span>' +
        '</td></tr>';
    }).join('');

    html += _section('فعالیت ماهانه به تفکیک کارشناس (📞 تماس | 🚗 ویزیت)',
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      '<thead><tr><th style="padding:6px 12px;text-align:right;background:#f8fafc;font-size:.8rem">کارشناس</th>' +
      thMonths + '<th style="padding:6px 8px;background:#f8fafc;font-size:.78rem">جمع</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody></table></div>');

    cont.innerHTML = html;
  }

  // ── 4. رقبا ────────────────────────────────────────────────────────────────

  function _rCompetitor(cont) {
    if (typeof DB === 'undefined' || !DB || !DB.edits) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">داده بارگذاری نشده</p>';
      return;
    }

    var compMap = {}; // {name: {count, provinces: Set}}
    var provCompMap = {}; // {province: {comp: count}}

    Object.keys(DB.edits || {}).forEach(function (key) {
      var e = DB.edits[key];
      if (!e || !e.competitor || !e.competitor.trim()) return;
      var comps = e.competitor.split(/[،,\/\n]+/).map(function (c) { return c.trim(); }).filter(Boolean);
      var provId = null;
      if (key.indexOf('||') > -1) provId = key.split('||')[0];
      else if (key.startsWith('c_') || key.startsWith('mz_')) provId = 'tehran';

      comps.forEach(function (comp) {
        if (!compMap[comp]) compMap[comp] = { count: 0, provinces: new Set() };
        compMap[comp].count++;
        if (provId) compMap[comp].provinces.add(provId);

        if (provId) {
          if (!provCompMap[provId]) provCompMap[provId] = {};
          provCompMap[provId][comp] = (provCompMap[provId][comp] || 0) + 1;
        }
      });
    });

    var comps = Object.keys(compMap).sort(function (a, b) { return compMap[b].count - compMap[a].count; });
    if (!comps.length) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">هنوز رقیبی ثبت نشده</p>';
      return;
    }

    var maxCount = compMap[comps[0]].count;
    var colors = ['#ef4444','#f97316','#f59e0b','#84cc16','#06b6d4','#6366f1','#8b5cf6','#ec4899'];

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
      _card('رقبای شناسایی‌شده', _fmtNum(comps.length), 'در پایگاه داده', '#ef4444') +
      _card('مراکزی با رقیب', _fmtNum(Object.keys(DB.edits||{}).filter(function(k){return (DB.edits[k]||{}).competitor;}).length), 'از کل مراکز', '#f97316') +
      _card('پرتکرارترین', comps[0] || '—', compMap[comps[0]] ? compMap[comps[0]].count + ' مرکز' : '', '#8b5cf6') +
      '</div>';

    html += _section('رتبه‌بندی رقبا',
      comps.slice(0, 15).map(function (comp, i) {
        var pct = Math.round((compMap[comp].count / maxCount) * 100);
        var provs = compMap[comp].provinces.size;
        return _barRow(comp, pct, colors[i % colors.length],
          compMap[comp].count + ' مرکز' + (provs > 0 ? ' / ' + provs + ' استان' : ''));
      }).join(''));

    // Top provinces by competitor presence
    var provSorted = Object.keys(provCompMap).sort(function (a, b) {
      var aTotal = Object.values(provCompMap[a]).reduce(function (s, v) { return s + v; }, 0);
      var bTotal = Object.values(provCompMap[b]).reduce(function (s, v) { return s + v; }, 0);
      return bTotal - aTotal;
    }).slice(0, 8);

    if (provSorted.length) {
      var provGetName = typeof _getProvName === 'function' ? _getProvName :
        (typeof getAllProvinces === 'function' ? function (id) {
          var provs = getAllProvinces();
          var p = provs.find(function (pp) { return pp.id === id; });
          return p ? p.name : id;
        } : function (id) { return id; });

      html += _section('استان‌های با بیشترین حضور رقبا',
        provSorted.map(function (pId) {
          var topComps = Object.keys(provCompMap[pId])
            .sort(function (a, b) { return provCompMap[pId][b] - provCompMap[pId][a]; })
            .slice(0, 3)
            .map(function (c) { return c + '(' + provCompMap[pId][c] + ')'; })
            .join('، ');
          var total = Object.values(provCompMap[pId]).reduce(function (s, v) { return s + v; }, 0);
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:.85rem">' +
            '<div style="font-weight:600">' + provGetName(pId) + '</div>' +
            '<div style="color:#6b7280">' + topComps + '</div>' +
            '<div style="font-weight:600;color:#ef4444;min-width:40px;text-align:left">' + total + '</div>' +
            '</div>';
        }).join(''));
    }

    cont.innerHTML = html;
  }

  // ── 5. پوشش استان‌ها ───────────────────────────────────────────────────────

  function _rCoverage(cont) {
    if (typeof DB === 'undefined' || !DB || typeof getAllProvinces !== 'function') {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">داده بارگذاری نشده</p>';
      return;
    }

    var today = typeof todayStr === 'function' ? todayStr() : '';
    var edits = DB.edits || {};
    var weekEntries = DB.weekEntries || {};

    // Last scheduled date per center
    var lastScheduled = {}; // centerKey → jalali date
    Object.keys(weekEntries).forEach(function (k) {
      var we = weekEntries[k];
      var parts = k.split(':::');
      if (parts.length < 2) return;
      var weekId = parts[0];
      var recKey = parts[1];
      var d = we.scheduledDate || weekId;
      if (!lastScheduled[recKey] || d > lastScheduled[recKey]) lastScheduled[recKey] = d;
    });

    var provs = getAllProvinces();
    var provData = [];

    provs.forEach(function (prov) {
      var centers = typeof getProvCenters === 'function' ? getProvCenters(prov.id) : [];
      if (!centers || !centers.length) return;

      var p1p2 = centers.filter(function (c) {
        var e = edits[c.rkey || (c.rtype + '_' + c.id)] || {};
        var pot = e.potential || c.potential || '';
        return pot === 'P1' || pot === 'P2';
      });

      var neverScheduled = 0, stale30 = 0, stale90 = 0, scheduled = 0;
      centers.forEach(function (c) {
        var key = c.rkey || (c.rtype + '_' + c.id);
        var last = lastScheduled[key];
        if (!last) { neverScheduled++; return; }
        var daysDiff = 0;
        if (today && last) {
          var tp = today.split('/').map(Number);
          var lp = last.split('/').map(Number);
          if (typeof jMs === 'function') {
            daysDiff = Math.round((jMs(tp[0],tp[1],tp[2]) - jMs(lp[0],lp[1],lp[2])) / 86400000);
          }
        }
        if (daysDiff > 90) stale90++;
        else if (daysDiff > 30) stale30++;
        else scheduled++;
      });

      var p1p2Unscheduled = p1p2.filter(function (c) {
        var key = c.rkey || (c.rtype + '_' + c.id);
        return !lastScheduled[key];
      }).length;

      provData.push({
        id: prov.id,
        name: prov.name,
        total: centers.length,
        p1p2: p1p2.length,
        p1p2Unscheduled: p1p2Unscheduled,
        neverScheduled: neverScheduled,
        stale30: stale30,
        stale90: stale90,
        scheduled: scheduled,
        coveragePct: centers.length > 0 ? Math.round((scheduled / centers.length) * 100) : 0,
      });
    });

    provData.sort(function (a, b) { return (b.p1p2Unscheduled + b.stale90) - (a.p1p2Unscheduled + a.stale90); });

    var totalCenters    = provData.reduce(function (s, p) { return s + p.total; }, 0);
    var totalNever      = provData.reduce(function (s, p) { return s + p.neverScheduled; }, 0);
    var totalP1P2Unsched = provData.reduce(function (s, p) { return s + p.p1p2Unscheduled; }, 0);
    var totalActive     = provData.reduce(function (s, p) { return s + p.scheduled; }, 0);

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
      _card('کل مراکز', _fmtNum(totalCenters), 'در همه استان‌ها', '#6366f1') +
      _card('فعال (۳۰ روز)', _fmtNum(totalActive), 'برنامه‌ریزی شده', '#10b981') +
      _card('هرگز برنامه‌ریزی نشده', _fmtNum(totalNever), 'مرکز', '#ef4444') +
      _card('P1/P2 بدون برنامه', _fmtNum(totalP1P2Unsched), 'اولویت بالا', '#f97316') +
      '</div>';

    html += _section('وضعیت پوشش به تفکیک استان',
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.83rem">' +
      '<thead><tr style="background:#f8fafc">' +
      '<th style="padding:8px 12px;text-align:right">استان</th>' +
      '<th style="padding:8px;text-align:center">کل</th>' +
      '<th style="padding:8px;text-align:center">P1/P2</th>' +
      '<th style="padding:8px;text-align:center;color:#ef4444">P1/P2 بی‌برنامه</th>' +
      '<th style="padding:8px;text-align:center;color:#10b981">فعال</th>' +
      '<th style="padding:8px;text-align:center;color:#f97316">بی‌برنامه</th>' +
      '<th style="padding:8px;text-align:center">پوشش</th>' +
      '</tr></thead><tbody>' +
      provData.map(function (p) {
        var coverColor = p.coveragePct >= 60 ? '#10b981' : p.coveragePct >= 30 ? '#f59e0b' : '#ef4444';
        return '<tr style="border-bottom:1px solid #f1f5f9">' +
          '<td style="padding:8px 12px;font-weight:600">' + p.name + '</td>' +
          '<td style="padding:8px;text-align:center">' + p.total + '</td>' +
          '<td style="padding:8px;text-align:center;color:#8b5cf6">' + p.p1p2 + '</td>' +
          '<td style="padding:8px;text-align:center;color:#ef4444;font-weight:' + (p.p1p2Unscheduled > 0 ? '700' : '400') + '">' + p.p1p2Unscheduled + '</td>' +
          '<td style="padding:8px;text-align:center;color:#10b981">' + p.scheduled + '</td>' +
          '<td style="padding:8px;text-align:center;color:#f97316">' + p.neverScheduled + '</td>' +
          '<td style="padding:8px;text-align:center">' +
            '<div style="display:flex;align-items:center;gap:6px;justify-content:center">' +
            _bar(p.coveragePct, coverColor) +
            '<span style="min-width:30px;font-weight:600;color:' + coverColor + '">' + p.coveragePct + '٪</span>' +
            '</div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>');

    cont.innerHTML = html;
  }

  // ── 6. حقوق تاریخی ─────────────────────────────────────────────────────────

  function _rPayroll(cont) {
    fetch('/api/reports/payroll-history?months=12')
      .then(function (r) { return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;}); })
      .then(function (data) {
        var rows = data.rows || [];
        var monthTotals = data.monthTotals || [];

        if (!rows.length) {
          cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">هنوز رکوردی نهایی نشده</p>';
          return;
        }

        // Group by employee
        var empMap = {};
        rows.forEach(function (r) {
          if (!empMap[r.employee]) empMap[r.employee] = { name: r.display_name || r.employee, months: {}, totalPay: 0 };
          empMap[r.employee].months[r.month] = r;
          empMap[r.employee].totalPay += r.total_pay;
        });
        var allMonths = [...new Set(rows.map(function(r){return r.month;}).sort())].reverse();
        var emps = Object.keys(empMap).sort(function(a,b){return empMap[b].totalPay - empMap[a].totalPay;});

        var grandTotal = monthTotals.reduce(function(s,r){return s+r.total;},0);
        var grandComm  = monthTotals.reduce(function(s,r){return s+r.commission;},0);

        var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
          _card('جمع حقوق کل', _fmtMoney(grandTotal), allMonths.length + ' ماه', '#6366f1') +
          _card('جمع پورسانت کل', _fmtMoney(grandComm), 'کمیسیون', '#10b981') +
          _card('ماه‌های ثبت‌شده', _fmtNum(allMonths.length), 'ماه نهایی', '#f59e0b') +
          '</div>';

        // Table per employee × month
        var thMonths = allMonths.slice(0, 8).map(function(m){
          return '<th style="padding:6px 8px;font-size:.78rem;text-align:center;background:#f8fafc;white-space:nowrap">' + m + '</th>';
        }).join('');

        var tbody = emps.map(function(e){
          var emp = empMap[e];
          var cells = allMonths.slice(0, 8).map(function(m){
            var r = emp.months[m];
            if (!r) return '<td style="padding:6px 8px;text-align:center;color:#d1d5db">—</td>';
            return '<td style="padding:6px 8px;text-align:center;font-size:.8rem">' +
              '<div style="font-weight:600;color:#6366f1">' + _fmtMoney(r.total_pay) + '</div>' +
              '<div style="color:#9ca3af;font-size:.72rem">پورسانت: ' + _fmtMoney(r.commission_amount) + '</div>' +
              (r.finalized ? '<div style="color:#10b981;font-size:.7rem">✅ نهایی</div>' : '<div style="color:#f59e0b;font-size:.7rem">⏳ موقت</div>') +
              '</td>';
          }).join('');
          return '<tr style="border-bottom:1px solid #f1f5f9">' +
            '<td style="padding:8px 12px;font-weight:600;white-space:nowrap">' + emp.name + '</td>' +
            cells +
            '<td style="padding:8px 12px;font-weight:700;color:#6366f1;white-space:nowrap">' + _fmtMoney(emp.totalPay) + '</td>' +
            '</tr>';
        }).join('');

        html += _section('تاریخچه حقوق و پورسانت (۱۲ ماه)',
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
          '<thead><tr><th style="padding:6px 12px;text-align:right;background:#f8fafc;font-size:.8rem">کارشناس</th>' +
          thMonths + '<th style="padding:6px 8px;background:#f8fafc;font-size:.78rem">جمع</th></tr></thead>' +
          '<tbody>' + tbody + '</tbody></table></div>');

        // Monthly totals trend
        if (monthTotals.length) {
          var maxMonthTotal = Math.max.apply(null, monthTotals.map(function(r){return r.total;}).concat([1]));
          html += _section('روند ماهانه هزینه حقوق',
            monthTotals.slice().reverse().map(function(r){
              var pct = Math.round((r.total / maxMonthTotal) * 100);
              return _barRow(r.month, pct, '#6366f1',
                _fmtMoney(r.total) + ' / ' + r.headcount + ' نفر');
            }).join(''));
        }

        cont.innerHTML = html;
      })
      .catch(function(e){
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:30px">خطا: ' + e.message + '</p>';
      });
  }

  // ── 7. پشتیبانی ────────────────────────────────────────────────────────────

  function _rSupport(cont) {
    fetch('/api/reports/support-stats')
      .then(function(r){ return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;}); })
      .then(function(data) {
        var STATUS_FA = { open:'باز', in_progress:'در حال انجام', waiting:'منتظر', resolved:'حل‌شده', closed:'بسته' };
        var CAT_FA    = { complaint:'شکایت', service:'خدمات', training:'آموزش', other:'سایر' };
        var STATUS_CLR = { open:'#ef4444', in_progress:'#f59e0b', waiting:'#3b82f6', resolved:'#10b981', closed:'#9ca3af' };

        var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
          _card('کل تیکت‌ها', _fmtNum(data.total), 'همه زمان‌ها', '#6366f1') +
          _card('باز', _fmtNum(data.open), 'نیاز به پیگیری', '#ef4444') +
          _card('SLA تأخیر', _fmtNum(data.overdueSLA), 'از مهلت گذشته', '#f97316') +
          _card('میانگین حل', (data.avgResolutionHours||0).toFixed(1) + ' ساعت', 'از ثبت تا حل', '#10b981') +
          '</div>';

        // By status
        var maxStatus = Math.max.apply(null, data.byStatus.map(function(r){return r.count;}).concat([1]));
        html += _section('وضعیت تیکت‌ها',
          data.byStatus.map(function(r){
            return _barRow(STATUS_FA[r.status]||r.status, Math.round(r.count/maxStatus*100),
              STATUS_CLR[r.status]||'#6366f1', r.count + ' تیکت');
          }).join(''));

        // By category
        var maxCat = Math.max.apply(null, data.byCategory.map(function(r){return r.count;}).concat([1]));
        html += _section('دسته‌بندی',
          data.byCategory.map(function(r){
            return _barRow(CAT_FA[r.category]||r.category, Math.round(r.count/maxCat*100),
              '#8b5cf6', r.count + ' تیکت');
          }).join(''));

        // By assignee
        if (data.byAssignee && data.byAssignee.length) {
          html += _section('عملکرد پشتیبان‌ها',
            '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
            '<thead><tr style="background:#f8fafc">' +
            '<th style="padding:8px 12px;text-align:right">نام</th>' +
            '<th style="padding:8px;text-align:center">کل</th>' +
            '<th style="padding:8px;text-align:center">حل‌شده</th>' +
            '<th style="padding:8px;text-align:center">نرخ</th>' +
            '</tr></thead><tbody>' +
            data.byAssignee.map(function(r){
              var rate = r.total > 0 ? Math.round((r.resolved/r.total)*100) : 0;
              var rateColor = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';
              return '<tr style="border-bottom:1px solid #f1f5f9">' +
                '<td style="padding:8px 12px;font-weight:600">' + (r.display_name||r.assigned_to) + '</td>' +
                '<td style="padding:8px;text-align:center">' + r.total + '</td>' +
                '<td style="padding:8px;text-align:center;color:#10b981">' + r.resolved + '</td>' +
                '<td style="padding:8px;text-align:center;font-weight:700;color:' + rateColor + '">' + rate + '٪</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>');
        }

        cont.innerHTML = html;
      })
      .catch(function(e){
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:30px">خطا: ' + e.message + '</p>';
      });
  }

  // ── 8. ماموریت ─────────────────────────────────────────────────────────────

  function _rMission(cont) {
    if (typeof DB === 'undefined' || !DB) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">داده بارگذاری نشده</p>';
      return;
    }

    var missionLog = DB.missionLog || [];
    if (!missionLog.length) {
      cont.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px">هنوز ماموریتی ثبت نشده</p>';
      return;
    }

    var USERS_map = typeof USERS !== 'undefined' ? USERS : {};

    // Aggregate by user
    var byUser = {};
    var byMonth = {};
    var totalCost = 0;

    missionLog.forEach(function (m) {
      var user = m.by || m.user || m.addedBy || '';
      var date = m.date || m.at || '';
      var monthKey = date ? date.slice(0, 7) : '';
      var cost = parseFloat(m.cost || m.amount || m.expenses || 0) || 0;
      totalCost += cost;

      if (!byUser[user]) byUser[user] = { count: 0, cost: 0 };
      byUser[user].count++;
      byUser[user].cost += cost;

      if (monthKey) {
        if (!byMonth[monthKey]) byMonth[monthKey] = { count: 0, cost: 0 };
        byMonth[monthKey].count++;
        byMonth[monthKey].cost += cost;
      }
    });

    var usersSorted = Object.keys(byUser).sort(function(a,b){return byUser[b].count - byUser[a].count;});
    var maxUserCount = Math.max.apply(null, usersSorted.map(function(u){return byUser[u].count;}).concat([1]));
    var monthsSorted = Object.keys(byMonth).sort().reverse().slice(0, 6);
    var maxMonthCost = Math.max.apply(null, monthsSorted.map(function(m){return byMonth[m].cost;}).concat([1]));

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">' +
      _card('کل ماموریت‌ها', _fmtNum(missionLog.length), 'ثبت‌شده', '#6366f1') +
      _card('جمع هزینه', _fmtMoney(totalCost), 'ریال', '#ef4444') +
      _card('کارشناسان', _fmtNum(usersSorted.length), 'نفر', '#10b981') +
      '</div>';

    html += _section('ماموریت‌ها به تفکیک کارشناس',
      usersSorted.map(function(u){
        var pct = Math.round((byUser[u].count / maxUserCount) * 100);
        return _barRow(USERS_map[u]||u, pct, '#6366f1',
          byUser[u].count + ' مورد' + (byUser[u].cost > 0 ? ' / ' + _fmtMoney(byUser[u].cost) : ''));
      }).join(''));

    if (monthsSorted.length) {
      html += _section('روند ماهانه ماموریت‌ها',
        monthsSorted.slice().reverse().map(function(m){
          var pct = byMonth[m].cost > 0 ? Math.round((byMonth[m].cost / maxMonthCost) * 100) : 20;
          return _barRow(m, pct, '#8b5cf6',
            byMonth[m].count + ' مورد' + (byMonth[m].cost > 0 ? ' / ' + _fmtMoney(byMonth[m].cost) : ''));
        }).join(''));
    }

    cont.innerHTML = html;
  }

})();

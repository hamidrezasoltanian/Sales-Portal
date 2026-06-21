/* Expert Personal Dashboard — داشبورد شخصی کارشناس */
(function () {
  'use strict';

  // ── helpers ──────────────────────────────────────────────────────────────

  function _fmtMoney(n) {
    n = parseFloat(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.?0+$/, '') + ' م.ت';
    if (n >= 1e6) return Math.round(n / 1e6) + ' م.ت';
    return n.toLocaleString('fa-IR');
  }

  function _todayJalali() {
    if (typeof todayStr === 'function') return todayStr();
    var d = new Date();
    return (d.getFullYear() - 621) + '/' +
      String(d.getMonth() + 1).padStart(2, '0') + '/' +
      String(d.getDate()).padStart(2, '0');
  }

  function _thisWeekRange() {
    var today = _todayJalali();
    var parts = today.split('/').map(Number);
    // Get start of Jalali week (Saturday)
    var d = new Date();
    var dow = d.getDay(); // 0=Sun,6=Sat
    var daysFromSat = (dow + 1) % 7;
    var start = new Date(d); start.setDate(d.getDate() - daysFromSat);
    var end   = new Date(start); end.setDate(start.getDate() + 6);
    function jDate(dt) {
      if (typeof g2j === 'function') {
        var r = g2j(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
        return r[0] + '/' + String(r[1]).padStart(2,'0') + '/' + String(r[2]).padStart(2,'0');
      }
      return (dt.getFullYear()-621) + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + String(dt.getDate()).padStart(2,'0');
    }
    return { start: jDate(start), end: jDate(end) };
  }

  function _currentJalaliMonth() {
    var t = _todayJalali();
    return t.slice(0, 7); // YYYY/MM
  }

  function _dayName(jalaliDate) {
    if (!jalaliDate || typeof j2g !== 'function') return '';
    var parts = jalaliDate.split('/').map(Number);
    try {
      var g = j2g(parts[0], parts[1], parts[2]);
      var dow = new Date(g[0], g[1]-1, g[2]).getDay();
      return ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'][dow] || '';
    } catch(e) { return ''; }
  }

  function _isOverdueDate(d) {
    if (!d) return false;
    return d < _todayJalali();
  }

  // ── gather data from in-memory DB ────────────────────────────────────────

  function _gatherData(user, isMgr) {
    var db = window.DB || {};
    var edits = db.edits || {};
    var weekEntries = db.weekEntries || {};
    var tasks = db.tasks || [];
    var today = _todayJalali();
    var week = _thisWeekRange();

    // Today's scheduled entries for this user
    var todayEntries = [];
    Object.keys(weekEntries).forEach(function(k) {
      var we = weekEntries[k];
      if (!we || we.done) return;
      var owner = we.addedBy || we.owner || '';
      if (!isMgr && owner !== user) return;
      if (we.scheduledDate === today) todayEntries.push(we);
    });

    // This week's entries
    var weekPlan = [];
    Object.keys(weekEntries).forEach(function(k) {
      var we = weekEntries[k];
      if (!we || we.done) return;
      var owner = we.addedBy || we.owner || '';
      if (!isMgr && owner !== user) return;
      var d = we.scheduledDate || '';
      if (d >= week.start && d <= week.end) weekPlan.push(we);
    });
    weekPlan.sort(function(a,b){ return (a.scheduledDate||'') < (b.scheduledDate||'') ? -1 : 1; });

    // Overdue followups
    var overdue = [];
    Object.keys(edits).forEach(function(rkey) {
      var e = edits[rkey];
      if (!e) return;
      var owner = e.owner || '';
      if (!isMgr && owner !== user) return;
      var fd = e.followupDate || '';
      if (!fd || !_isOverdueDate(fd)) return;
      if (['قرارداد بسته شد','غیرفعال'].includes(e.status)) return;
      var parts = rkey.split('_');
      var rtype = parts[0] === 'pc' ? 'pc' : 'center';
      overdue.push({ rkey: rkey, rtype: rtype, name: e.nameOverride || rkey, followupDate: fd, status: e.status || '', potential: e.potential || 4 });
    });
    overdue.sort(function(a,b){ return a.followupDate < b.followupDate ? -1 : 1; });

    // My open tasks
    var myTasks = (Array.isArray(tasks) ? tasks : []).filter(function(t) {
      return !t.done && (t.owner === user || t.createdBy === user);
    }).sort(function(a,b){
      if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.priority||2) - (a.priority||2);
    });

    // Recent done this week
    var doneThisWeek = [];
    Object.keys(weekEntries).forEach(function(k) {
      var we = weekEntries[k];
      if (!we || !we.done) return;
      var owner = we.addedBy || we.owner || '';
      if (!isMgr && owner !== user) return;
      var dd = we.doneDate || '';
      if (dd >= week.start && dd <= week.end) doneThisWeek.push(we);
    });

    return { todayEntries: todayEntries, weekPlan: weekPlan, overdue: overdue, myTasks: myTasks, doneThisWeek: doneThisWeek, today: today, week: week };
  }

  // ── rendering ────────────────────────────────────────────────────────────

  function _card(icon, title, value, sub, color, onclick) {
    color = color || '#6366f1';
    return '<div style="background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0;flex:1;min-width:130px;' +
      (onclick ? 'cursor:pointer;' : '') + '" ' + (onclick ? 'onclick="' + onclick + '"' : '') + '>' +
      '<div style="font-size:1.4rem;margin-bottom:4px">' + icon + '</div>' +
      '<div style="font-size:.78rem;color:#6b7280;margin-bottom:2px">' + title + '</div>' +
      '<div style="font-size:1.3rem;font-weight:700;color:' + color + '">' + value + '</div>' +
      (sub ? '<div style="font-size:.72rem;color:#9ca3af;margin-top:2px">' + sub + '</div>' : '') +
    '</div>';
  }

  function _section(title, body, extra) {
    return '<div style="background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:14px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
        '<h3 style="margin:0;font-size:.95rem;font-weight:700;color:#1e293b">' + title + '</h3>' +
        (extra || '') +
      '</div>' +
      body +
    '</div>';
  }

  function _centerRow(we, today) {
    var name = we.centerName || we.name || '—';
    var d = we.scheduledDate || '';
    var isToday = d === today;
    var dayLbl = isToday ? '<span style="color:#6366f1;font-weight:700">امروز</span>' : (_dayName(d) + ' ' + (d.slice(8) || ''));
    var typeIcon = we.actionType === 'visit' ? '🤝' : '📞';
    var typeLabel = we.actionType === 'visit' ? 'ملاقات' : 'تماس';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9">' +
      '<span style="font-size:1.1rem">' + typeIcon + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</div>' +
        '<div style="font-size:.75rem;color:#9ca3af">' + typeLabel + '</div>' +
      '</div>' +
      '<div style="font-size:.78rem;color:#6b7280;white-space:nowrap">' + dayLbl + '</div>' +
    '</div>';
  }

  function _overdueRow(item) {
    var age = '';
    try {
      if (typeof j2g === 'function' && item.followupDate) {
        var parts = item.followupDate.split('/').map(Number);
        var g = j2g(parts[0], parts[1], parts[2]);
        var diff = Math.round((Date.now() - new Date(g[0], g[1]-1, g[2]).getTime()) / 86400000);
        age = diff + ' روز';
      }
    } catch(e){}
    var potColor = ['','#10b981','#6366f1','#f59e0b','#94a3b8'][item.potential] || '#94a3b8';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;cursor:pointer" ' +
      'onclick="if(typeof openCenterModal===\'function\')openCenterModal(\'' + esc(item.rtype) + '\',\'' + esc(item.rkey.replace(/^[^_]+_/, '')) + '\')">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + potColor + ';flex-shrink:0"></span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.name) + '</div>' +
        '<div style="font-size:.75rem;color:#9ca3af">' + esc(item.status) + '</div>' +
      '</div>' +
      '<div style="font-size:.78rem;color:#ef4444;white-space:nowrap;font-weight:600">' + esc(age) + ' تأخیر</div>' +
    '</div>';
  }

  function _taskRow(t) {
    var overdue = t.dueDate && t.dueDate < _todayJalali();
    var priColor = ['','#10b981','#f59e0b','#ef4444'][t.priority||2] || '#6b7280';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;cursor:pointer" ' +
      'onclick="if(typeof openTaskModal===\'function\')openTaskModal(\'' + esc(t.id) + '\')">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + priColor + ';flex-shrink:0"></span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.title||'—') + '</div>' +
        (t.centerKey ? '<div style="font-size:.75rem;color:#9ca3af">' + esc(t.centerKey) + '</div>' : '') +
      '</div>' +
      (t.dueDate ? '<div style="font-size:.78rem;white-space:nowrap;color:' + (overdue ? '#ef4444' : '#6b7280') + ';font-weight:' + (overdue?'700':'400') + '">' + t.dueDate + (overdue ? ' 🔴' : '') + '</div>' : '') +
    '</div>';
  }

  // ── main render ───────────────────────────────────────────────────────────

  window.renderExpertDashboard = function () {
    var el = document.getElementById('homePanel');
    if (!el) return;

    var user = typeof currentUser !== 'undefined' ? currentUser : '';
    var isMgr = typeof _isManager === 'function' ? _isManager() : false;
    var displayName = (typeof USERS !== 'undefined' && USERS[user]) ? USERS[user] : user;
    var today = _todayJalali();
    var month = _currentJalaliMonth();

    var data = _gatherData(user, isMgr);

    // Build summary cards first (sync data from DB)
    var overdueCount = data.overdue.length;
    var taskCount = data.myTasks.length;
    var overdueTaskCount = data.myTasks.filter(function(t){ return t.dueDate && t.dueDate < today; }).length;
    var weekCount = data.weekPlan.length;
    var doneCount = data.doneThisWeek.length;

    // Greeting
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'عصر بخیر' : 'شب بخیر';

    var html =
      '<div style="max-width:1000px;margin:0 auto;padding:4px 0">' +

      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:20px">' +
        '<div>' +
          '<div style="font-size:1.3rem;font-weight:700;color:#1e293b">' + greet + ' ' + esc(displayName) + ' 👋</div>' +
          '<div style="font-size:.83rem;color:#6b7280;margin-top:2px">امروز ' + today + ' — ' + _dayName(today) + '</div>' +
        '</div>' +
        '<button onclick="window.renderExpertDashboard()" style="padding:6px 14px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:.83rem;cursor:pointer;color:#374151">🔄 بروزرسانی</button>' +
      '</div>' +

      // Summary cards
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px" id="edSummaryCards">' +
        _card('📅', 'برنامه این هفته', weekCount + ' مرکز', doneCount + ' انجام شده', '#6366f1', "switchTab('weekplan')") +
        _card('🔴', 'پیگیری معوق', overdueCount + ' مرکز', 'نیاز به تماس فوری', overdueCount > 0 ? '#ef4444' : '#10b981') +
        _card('📌', 'وظایف باز', taskCount + ' وظیفه', overdueTaskCount > 0 ? overdueTaskCount + ' سررسید گذشته 🔴' : 'بدون تأخیر',
          overdueTaskCount > 0 ? '#ef4444' : '#10b981', "switchTab('tasks')") +
        '<div id="edSalesCard" style="background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0;flex:1;min-width:130px">' +
          '<div style="font-size:1.4rem;margin-bottom:4px">💰</div>' +
          '<div style="font-size:.78rem;color:#6b7280;margin-bottom:2px">فروش ماه جاری</div>' +
          '<div style="font-size:1rem;color:#9ca3af">در حال بارگذاری...</div>' +
        '</div>' +
      '</div>' +

      // Today's schedule
      (data.todayEntries.length
        ? _section('☀️ برنامه امروز (' + data.todayEntries.length + ')',
            data.todayEntries.map(function(we){ return _centerRow(we, today); }).join('') ||
            '<div style="color:#9ca3af;font-size:.83rem">موردی نیست</div>')
        : _section('☀️ برنامه امروز', '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:.85rem">امروز مرکزی برنامه‌ریزی نشده<br><button onclick="switchTab(\'weekplan\')" style="margin-top:8px;padding:6px 14px;background:#6366f1;color:white;border:none;border-radius:7px;font-family:inherit;font-size:.82rem;cursor:pointer">برو به برنامه هفته</button></div>')) +

      // Overdue followups
      (overdueCount > 0
        ? _section('🔴 پیگیری معوق (' + overdueCount + ')',
            data.overdue.slice(0, 8).map(_overdueRow).join('') +
            (overdueCount > 8 ? '<div style="text-align:center;padding:8px;font-size:.8rem;color:#6366f1;cursor:pointer" onclick="switchTab(\'provinces\')">' + (overdueCount - 8) + ' مورد دیگر...</div>' : ''))
        : '') +

      // Open tasks
      (taskCount > 0
        ? _section('📌 وظایف باز (' + taskCount + ')',
            data.myTasks.slice(0, 6).map(_taskRow).join('') +
            (taskCount > 6
              ? '<div style="text-align:center;padding:8px;font-size:.8rem;color:#6366f1;cursor:pointer" onclick="switchTab(\'tasks\')">' + (taskCount - 6) + ' وظیفه دیگر...</div>'
              : ''),
            '<button onclick="if(typeof openTaskModal===\'function\')openTaskModal()" style="padding:4px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-family:inherit;font-size:.78rem;cursor:pointer">+ وظیفه جدید</button>')
        : _section('📌 وظایف',
            '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:.85rem">وظیفه باز ندارید 🎉</div>',
            '<button onclick="if(typeof openTaskModal===\'function\')openTaskModal()" style="padding:4px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-family:inherit;font-size:.78rem;cursor:pointer">+ وظیفه جدید</button>')) +

      // This week plan (next 5 items)
      (data.weekPlan.length > 0
        ? _section('📅 برنامه هفته (' + weekCount + ')',
            data.weekPlan.slice(0, 6).map(function(we){ return _centerRow(we, today); }).join('') +
            (weekCount > 6 ? '<div style="text-align:center;padding:8px;font-size:.8rem;color:#6366f1;cursor:pointer" onclick="switchTab(\'weekplan\')">' + (weekCount - 6) + ' مورد دیگر...</div>' : ''),
            '<button onclick="switchTab(\'weekplan\')" style="padding:4px 12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:.78rem;cursor:pointer;color:#374151">برنامه کامل</button>')
        : '') +

      '</div>';

    el.innerHTML = html;

    // Load sales data async
    _loadSalesCard(user, month, isMgr);
  };

  function _loadSalesCard(user, month, isMgr) {
    var card = document.getElementById('edSalesCard');
    if (!card) return;

    Promise.all([
      fetch('/api/payroll/actuals?month=' + encodeURIComponent(month)).then(function(r){return r.ok?r.json():[];}),
      fetch('/api/payroll/targets?month=' + encodeURIComponent(month)).then(function(r){return r.ok?r.json():[];})
    ]).then(function(res) {
      var actuals = Array.isArray(res[0]) ? res[0] : (res[0].rows||[]);
      var targets = Array.isArray(res[1]) ? res[1] : (res[1].rows||[]);

      var myActual = actuals.find(function(a){ return a.employee === user; }) || {};
      var myTarget = targets.find(function(t){ return t.employee === user; }) || {};

      var sales  = parseFloat(myActual.actual_amount||0);
      var target = parseFloat(myTarget.target_amount||0);
      var pct    = target > 0 ? Math.round(sales/target*100) : null;
      var color  = pct === null ? '#6b7280' : pct >= 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';

      card.innerHTML =
        '<div style="font-size:1.4rem;margin-bottom:4px">💰</div>' +
        '<div style="font-size:.78rem;color:#6b7280;margin-bottom:2px">فروش ماه ' + month.slice(5) + '</div>' +
        '<div style="font-size:1.15rem;font-weight:700;color:' + color + '">' + _fmtMoney(sales) + '</div>' +
        (target > 0
          ? '<div style="margin-top:6px"><div style="height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:' + Math.min(100,pct||0) + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>' +
            '<div style="font-size:.7rem;color:#9ca3af;margin-top:2px">' + (pct||0) + '٪ از هدف</div></div>'
          : '<div style="font-size:.7rem;color:#9ca3af;margin-top:2px">هدف تعریف نشده</div>');
    }).catch(function(){
      var c = document.getElementById('edSalesCard');
      if (c) c.querySelector('div:last-child').textContent = '';
    });
  }

})();

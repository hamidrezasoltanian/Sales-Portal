/* Expert Personal Dashboard — داشبورد شخصی و پیشرفته کارشناس */
(function () {
  'use strict';

  // ── Inject Premium CSS Styles ─────────────────────────────────────────────
  function _injectPremiumStyles() {
    if (document.getElementById('dbPremiumStyles')) return;
    const style = document.createElement('style');
    style.id = 'dbPremiumStyles';
    style.textContent = `
      .db-container {
        animation: dbFadeIn 0.4s ease-out;
        max-width: 1100px;
        margin: 0 auto;
        padding: 4px 0;
        font-family: inherit;
      }
      @keyframes dbFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .db-header-banner {
        background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);
        border-radius: 20px;
        padding: 24px 30px;
        color: #ffffff;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .db-header-title {
        font-size: 1.55rem;
        font-weight: 900;
        margin-bottom: 6px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        color: #ffffff;
      }
      .db-header-sub {
        font-size: 0.85rem;
        opacity: 0.85;
      }
      .db-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
        margin-bottom: 24px;
      }
      .db-action-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none;
        color: var(--text-primary);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.02);
      }
      .db-action-card:hover {
        transform: translateY(-3px);
        border-color: #6366f1;
        box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
        background: linear-gradient(135deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.05) 100%);
      }
      .db-action-icon {
        font-size: 1.6rem;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .db-action-card:hover .db-action-icon {
        background: #6366f1;
        color: #ffffff;
        transform: scale(1.05);
      }
      .db-action-text {
        display: flex;
        flex-direction: column;
      }
      .db-action-title {
        font-weight: 700;
        font-size: 0.88rem;
        color: var(--text-primary);
      }
      .db-action-desc {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .db-metrics-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .db-metric-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
        transition: all 0.25s ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      }
      .db-metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
        border-color: rgba(99, 102, 241, 0.25);
      }
      .db-metric-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .db-metric-title {
        font-size: 0.78rem;
        color: var(--text-muted);
        font-weight: 600;
      }
      .db-metric-icon {
        font-size: 1.4rem;
        opacity: 0.8;
      }
      .db-metric-value {
        font-size: 1.45rem;
        font-weight: 900;
        color: var(--text-primary);
        line-height: 1.2;
      }
      .db-metric-sub {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-top: 4px;
      }
      .db-section {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.01);
      }
      .db-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 10px;
        border-bottom: 1px dashed var(--border);
      }
      .db-section-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .db-list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: var(--bg-raised);
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
      }
      .db-list-item:hover {
        background: var(--bg-card);
        border-color: rgba(99, 102, 241, 0.3);
        transform: translateX(-2px);
      }
      .db-quick-dial {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid rgba(99, 102, 241, 0.2);
        background: rgba(99, 102, 241, 0.05);
        color: #6366f1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.95rem;
        flex-shrink: 0;
      }
      .db-quick-dial:hover {
        background: #6366f1;
        color: #ffffff;
        transform: scale(1.1);
        box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
      }
      .db-checkbox {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border: 2px solid var(--border-input);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        background: var(--bg-input);
        flex-shrink: 0;
      }
      .db-checkbox:hover {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.05);
      }
      .db-checkbox.checked {
        background: #10b981;
        border-color: #10b981;
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function _fmtMoney(n) {
    n = parseFloat(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.?0+$/, '') + ' میلیارد تومان';
    if (n >= 1e6) return Math.round(n / 1e6) + ' میلیون تومان';
    return n.toLocaleString('fa-IR') + ' تومان';
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
    var d = new Date();
    var dow = d.getDay(); 
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
    return t.slice(0, 7); 
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

    var todayEntries = [];
    Object.keys(weekEntries).forEach(function(k) {
      var we = weekEntries[k];
      if (!we || we.done) return;
      var owner = we.addedBy || we.owner || '';
      if (!isMgr && owner !== user) return;
      if (we.scheduledDate === today) todayEntries.push(we);
    });

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

    var overdue = [];
    Object.keys(edits).forEach(function(rkey) {
      var e = edits[rkey];
      if (!e) return;
      var owner = e.owner || '';
      if (!isMgr && owner !== user) return;
      var fd = e.followupDate || '';
      if (!fd || !_isOverdueDate(fd)) return;
      if (['قرار داد بسته شد','قرارداد بسته شد','غیرفعال'].includes(e.status)) return;
      var parts = rkey.split('_');
      var rtype = parts[0] === 'pc' ? 'pc' : 'center';
      overdue.push({ rkey: rkey, rtype: rtype, name: e.nameOverride || e.name || rkey, followupDate: fd, status: e.status || '', potential: e.potential || 4 });
    });
    overdue.sort(function(a,b){ return a.followupDate < b.followupDate ? -1 : 1; });

    var myTasks = (Array.isArray(tasks) ? tasks : []).filter(function(t) {
      return !t.done && (isMgr || t.owner === user || t.createdBy === user);
    }).sort(function(a,b){
      if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.priority||2) - (a.priority||2);
    });

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

  // ── rendering functions ───────────────────────────────────────────────────

  function _centerRow(we, today) {
    var name = we.centerName || we.name || '—';
    var d = we.scheduledDate || '';
    var isToday = d === today;
    var dayLbl = isToday ? '<span style="color:#6366f1;font-weight:700">امروز</span>' : (_dayName(d) + ' ' + (d.slice(8) || ''));
    var typeIcon = we.actionType === 'visit' ? '🤝' : '📞';
    var typeLabel = we.actionType === 'visit' ? 'ملاقات حضوری' : 'تماس تلفنی';
    
    return '<div class="db-list-item">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">' +
        '<span style="font-size:1.25rem">' + typeIcon + '</span>' +
        '<div style="min-width:0">' +
          '<div style="font-weight:700;font-size:.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">' + typeLabel + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:.78rem;color:var(--text-muted)">' + dayLbl + '</span>' +
        '<button class="db-quick-dial" onclick="event.stopPropagation();quickCallLog(\'' + esc(we.rtype || 'center') + '\',\'' + esc(we.rid || we.recKey || '') + '\',\'' + esc(name) + '\')" title="ثبت سریع نتیجه و تماس">' +
          '📞' +
        '</button>' +
      '</div>' +
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
    
    var potColor = ['','#10b981','#6366f1','#f59e0b','#ef4444'][item.potential] || '#94a3b8';
    var cleanId = item.rkey.replace(/^[^_]+_/, '');
    
    return '<div class="db-list-item" style="cursor:pointer" onclick="if(typeof openCenterModal===\'function\')openCenterModal(\'' + esc(item.rtype) + '\',\'' + esc(cleanId) + '\')">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">' +
        '<span style="width:10px;height:10px;border-radius:50%;background:' + potColor + ';flex-shrink:0;box-shadow:0 0 8px ' + potColor + '"></span>' +
        '<div style="min-width:0">' +
          '<div style="font-weight:700;font-size:.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.name) + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">' + esc(item.status) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<span class="badge-overdue" style="background:#fee2e2;color:#ef4444;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">' + esc(age) + ' تأخیر</span>' +
        '<button class="db-quick-dial" onclick="event.stopPropagation();quickCallLog(\'' + esc(item.rtype) + '\',\'' + esc(cleanId) + '\',\'' + esc(item.name) + '\')" title="ثبت سریع نتیجه پیگیری">' +
          '📞' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function _taskRow(t) {
    var overdue = t.dueDate && t.dueDate < _todayJalali();
    var priColor = ['','#10b981','#f59e0b','#ef4444'][t.priority||2] || '#6b7280';
    var priLabel = ['','کم','متوسط','فوری'][t.priority||2] || 'متوسط';
    
    return '<div class="db-list-item">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">' +
        '<div class="db-checkbox" onclick="event.stopPropagation();window.toggleTaskHome(\'' + esc(t.id) + '\')" title="علامت‌گذاری به عنوان انجام شده">' +
          '✓' +
        '</div>' +
        '<div style="min-width:0;cursor:pointer" onclick="if(typeof openTaskModal===\'function\')openTaskModal(\'' + esc(t.id) + '\')">' +
          '<div style="font-weight:700;font-size:.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.title||'—') + '</div>' +
          '<div style="font-size:.72rem;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:6px">' +
            '<span style="color:' + priColor + ';font-weight:700">• اولویت ' + priLabel + '</span>' +
            (t.centerKey ? '<span>| مرکز: ' + esc(t.centerKey) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (t.dueDate ? '<div style="font-size:.75rem;white-space:nowrap;color:' + (overdue ? '#ef4444' : 'var(--text-muted)') + ';font-weight:' + (overdue?'700':'500') + '">' + t.dueDate + (overdue ? ' ⏳' : '') + '</div>' : '') +
    '</div>';
  }

  // ── main render function ──────────────────────────────────────────────────

  window.renderExpertDashboard = function () {
    var el = document.getElementById('homePanel');
    if (!el) return;

    _injectPremiumStyles();

    var user = typeof currentUser !== 'undefined' ? currentUser : '';
    var isMgr = typeof _isManager === 'function' ? _isManager() : false;
    var displayName = (typeof USERS !== 'undefined' && USERS[user]) ? USERS[user] : user;
    var today = _todayJalali();
    var month = _currentJalaliMonth();

    var data = _gatherData(user, isMgr);

    // Calculate metrics
    var overdueCount = data.overdue.length;
    var taskCount = data.myTasks.length;
    var overdueTaskCount = data.myTasks.filter(function(t){ return t.dueDate && t.dueDate < today; }).length;
    var weekCount = data.weekPlan.length;
    var doneCount = data.doneThisWeek.length;
    var weekPct = weekCount > 0 ? Math.round(doneCount / weekCount * 100) : 0;

    // Greeting text based on hour
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'روز بخیر' : 'عصر بخیر';

    // Daily motivation quote or tip
    var dailyTip = 'با ثبت فعالیت‌های خود به صورت منظم، گزارش‌های آماری خود را دقیق‌تر نگه دارید.';
    if (overdueCount > 0) {
      dailyTip = 'امروز شما ' + overdueCount + ' مورد پیگیری معوق دارید. لطفا با تماس تلفنی کار را شروع کنید.';
    } else if (data.todayEntries.length > 0) {
      dailyTip = 'برنامه امروز شما شامل ' + data.todayEntries.length + ' ملاقات/تماس است. روز خوبی داشته باشید!';
    }

    var html =
      '<div class="db-container">' +

        // 1. Greet Banner
        '<div class="db-header-banner">' +
          '<div>' +
            '<div class="db-header-title">' + greet + '، ' + esc(displayName) + ' عزیز! 🌟</div>' +
            '<div class="db-header-sub">امروز ' + today + ' — ' + _dayName(today) + ' | ' + dailyTip + '</div>' +
          '</div>' +
          '<button onclick="window.renderExpertDashboard()" style="padding:8px 16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;font-family:inherit;font-size:.8rem;cursor:pointer;color:#ffffff;font-weight:700;transition:all 0.2s" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.12)\'">🔄 بروزرسانی داشبورد</button>' +
        '</div>' +

        // 2. Launchpad (Quick Actions Panel)
        '<div class="db-actions-grid">' +
          '<div class="db-action-card" onclick="openGSearch()">' +
            '<div class="db-action-icon">🔍</div>' +
            '<div class="db-action-text">' +
              '<span class="db-action-title">جستجو سریع مراکز</span>' +
              '<span class="db-action-desc">کلیدهای میانبر Ctrl + K</span>' +
            '</div>' +
          '</div>' +
          '<div class="db-action-card" onclick="_hcpOpenCreateModal()">' +
            '<div class="db-action-icon">➕</div>' +
            '<div class="db-action-text">' +
              '<span class="db-action-title">ثبت پزشک جدید</span>' +
              '<span class="db-action-desc">افزودن به دفترچه پزشکان</span>' +
            '</div>' +
          '</div>' +
          '<div class="db-action-card" onclick="switchTab(\'weekplan\')">' +
            '<div class="db-action-icon">📅</div>' +
            '<div class="db-action-text">' +
              '<span class="db-action-title">برنامه‌ریزی هفته</span>' +
              '<span class="db-action-desc">تنظیم برنامه جلسات و تماس‌ها</span>' +
            '</div>' +
          '</div>' +
          '<div class="db-action-card" onclick="openTaskModal()">' +
            '<div class="db-action-icon">📌</div>' +
            '<div class="db-action-text">' +
              '<span class="db-action-title">تعریف وظیفه جدید</span>' +
              '<span class="db-action-desc">ثبت کارهای روزانه شخصی</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // 3. KPI Metrics Rows
        '<div class="db-metrics-row">' +
          // Weekly schedule conversion
          '<div class="db-metric-card" onclick="switchTab(\'weekplan\')">' +
            '<div class="db-metric-header">' +
              '<span class="db-metric-title">پیشرفت برنامه‌های هفته</span>' +
              '<span class="db-metric-icon">📅</span>' +
            '</div>' +
            '<div>' +
              '<div class="db-metric-value">' + doneCount + ' از ' + weekCount + '</div>' +
              '<div class="db-progress-bar">' +
                '<div class="db-progress-fill" style="width:' + weekPct + '%;background:#6366f1"></div>' +
              '</div>' +
              '<div class="db-metric-sub">' + weekPct + '٪ برنامه‌های ثبت‌شده این هفته تکمیل شده</div>' +
            '</div>' +
          '</div>' +

          // Overdue centers
          '<div class="db-metric-card" onclick="switchTab(\'provinces\')">' +
            '<div class="db-metric-header">' +
              '<span class="db-metric-title">پیگیری‌های معوق</span>' +
              '<span class="db-metric-icon">🔴</span>' +
            '</div>' +
            '<div>' +
              '<div class="db-metric-value" style="color:' + (overdueCount > 0 ? '#ef4444' : '#10b981') + '">' + overdueCount + ' مرکز</div>' +
              '<div class="db-metric-sub">' + (overdueCount > 0 ? 'نیاز به تماس و پیگیری فوری' : 'بسیار عالی! تمام پیگیری‌ها به‌روز هستند') + '</div>' +
            '</div>' +
          '</div>' +

          // Open tasks
          '<div class="db-metric-card" onclick="switchTab(\'tasks\')">' +
            '<div class="db-metric-header">' +
              '<span class="db-metric-title">وظایف در انتظار انجام</span>' +
              '<span class="db-metric-icon">📌</span>' +
            '</div>' +
            '<div>' +
              '<div class="db-metric-value" style="color:' + (overdueTaskCount > 0 ? '#f59e0b' : 'var(--text-primary)') + '">' + taskCount + ' وظیفه</div>' +
              '<div class="db-metric-sub">' + (overdueTaskCount > 0 ? overdueTaskCount + ' وظیفه سررسید گذشته ⚠️' : 'بدون وظیفه معوق') + '</div>' +
            '</div>' +
          '</div>' +

          // Sales volume card
          '<div id="edSalesCard" class="db-metric-card">' +
            '<div class="db-metric-header">' +
              '<span class="db-metric-title">فروش ماه جاری</span>' +
              '<span class="db-metric-icon">💰</span>' +
            '</div>' +
            '<div style="font-size:0.9rem;color:var(--text-muted)">در حال بارگذاری اطلاعات فروش...</div>' +
          '</div>' +
        '</div>' +

        // 4. Two-Column Dashboard Content Layout
        '<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;flex-wrap:wrap">' +

          // Right Column (Main: Today's schedule + Overdue)
          '<div>' +
            // Today's Agenda
            '<div class="db-section">' +
              '<div class="db-section-header">' +
                '<h3 class="db-section-title">☀️ برنامه کاری امروز شما</h3>' +
                (data.todayEntries.length > 0 ? '<span style="background:rgba(99,102,241,0.1);color:#6366f1;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">' + data.todayEntries.length + ' برنامه</span>' : '') +
              '</div>' +
              (data.todayEntries.length > 0
                ? data.todayEntries.map(function(we){ return _centerRow(we, today); }).join('')
                : '<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:.85rem">' +
                    'امروز هیچ برنامه ملاقات یا تماسی ثبت نکرده‌اید.<br>' +
                    '<button onclick="switchTab(\'weekplan\')" style="margin-top:12px;padding:8px 16px;background:#6366f1;color:#ffffff;border:none;border-radius:10px;font-family:inherit;font-size:.8rem;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,0.2)">برو به برنامه‌ریزی هفته</button>' +
                  '</div>') +
            '</div>' +

            // Overdue followups list
            (overdueCount > 0
              ? '<div class="db-section">' +
                  '<div class="db-section-header">' +
                    '<h3 class="db-section-title" style="color:#ef4444">🔴 پیگیری‌های معوقه دارای تاخیر</h3>' +
                    '<span style="background:#fee2e2;color:#ef4444;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">' + overdueCount + ' مرکز</span>' +
                  '</div>' +
                  data.overdue.slice(0, 6).map(_overdueRow).join('') +
                  (overdueCount > 6 ? '<div style="text-align:center;padding:8px 0 0 0;font-size:.8rem;color:#6366f1;cursor:pointer;font-weight:700" onclick="switchTab(\'provinces\')">مشاهده همه پیگیری‌های معوق (' + (overdueCount - 6) + ' مورد دیگر) ←</div>' : '') +
                '</div>'
              : '') +
          '</div>' +

          // Left Column (Sidebar: Open tasks + Weekly summary)
          '<div>' +
            // My Tasks list
            '<div class="db-section">' +
              '<div class="db-section-header">' +
                '<h3 class="db-section-title">📌 وظایف من</h3>' +
                '<button onclick="if(typeof openTaskModal===\'function\')openTaskModal()" style="padding:4px 10px;background:#6366f1;color:#ffffff;border:none;border-radius:8px;font-family:inherit;font-size:.75rem;font-weight:700;cursor:pointer">+ جدید</button>' +
              '</div>' +
              (taskCount > 0
                ? data.myTasks.slice(0, 6).map(_taskRow).join('') +
                  (taskCount > 6 ? '<div style="text-align:center;padding:8px 0 0 0;font-size:.78rem;color:#6366f1;cursor:pointer;font-weight:700" onclick="switchTab(\'tasks\')">مشاهده همه وظایف (' + (taskCount - 6) + ' مورد دیگر) ←</div>' : '')
                : '<div style="text-align:center;padding:24px 12px;color:var(--text-muted);font-size:.8rem">هیچ وظیفه بازی ندارید! 🎉</div>') +
            '</div>' +

            // Weekly Summary
            (data.weekPlan.length > 0
              ? '<div class="db-section">' +
                  '<div class="db-section-header">' +
                    '<h3 class="db-section-title">📅 برنامه این هفته</h3>' +
                    '<button onclick="switchTab(\'weekplan\')" style="padding:4px 10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:.75rem;cursor:pointer;color:var(--text-primary)">مشاهده کل</button>' +
                  '</div>' +
                  data.weekPlan.slice(0, 5).map(function(we){ return _centerRow(we, today); }).join('') +
                  (weekCount > 5 ? '<div style="text-align:center;padding:8px 0 0 0;font-size:.78rem;color:#6366f1;cursor:pointer;font-weight:700" onclick="switchTab(\'weekplan\')">' + (weekCount - 5) + ' برنامه دیگر در این هفته ←</div>' : '') +
                '</div>'
              : '') +
          '</div>' +

        '</div>' +

      '</div>';

    el.innerHTML = html;

    // Load sales data async
    _loadSalesCard(user, month, isMgr);
  };

  // Wrapper for checkbox clicks to complete tasks from homepage instantly
  window.toggleTaskHome = function (tid) {
    if (typeof _toggleTask === 'function') {
      _toggleTask(tid);
      showToast('✓ وظیفه با موفقیت انجام شد');
      // Delay slightly for visual effect then refresh dashboard
      setTimeout(function() {
        if (typeof renderExpertDashboard === 'function') renderExpertDashboard();
      }, 250);
    }
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
      var statusLbl = pct === null ? '' : pct >= 100 ? 'بسیار عالی 🌟' : pct >= 70 ? 'خوب و در مسیر هدف 👍' : 'نیازمند تلاش بیشتر ⚡';

      card.innerHTML = `
        <div class="db-metric-header">
          <span class="db-metric-title">فروش ماه ${month.slice(5)}</span>
          <span class="db-metric-icon">💰</span>
        </div>
        <div>
          <div class="db-metric-value" style="color:${color}">${_fmtMoney(sales)}</div>
          ${target > 0
            ? `<div class="db-progress-bar">
                 <div class="db-progress-fill" style="width:${Math.min(100, pct)}%;background:${color}"></div>
               </div>
               <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                 <span style="font-size:.7rem;color:var(--text-muted)">هدف: ${_fmtMoney(target)} (${pct}٪)</span>
                 <span style="font-size:.7rem;color:${color};font-weight:700">${statusLbl}</span>
               </div>`
            : `<div class="db-metric-sub">هدفی برای این ماه تعیین نشده است</div>`
          }
        </div>
      `;
    }).catch(function(){
      var c = document.getElementById('edSalesCard');
      if (c) c.innerHTML = `
        <div class="db-metric-header">
          <span class="db-metric-title">فروش ماه ${month.slice(5)}</span>
          <span class="db-metric-icon">💰</span>
        </div>
        <div class="db-metric-sub">خطا در بارگذاری اطلاعات فروش</div>
      `;
    });
  }

})();

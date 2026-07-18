/* Week Planner — تخصیص برنامه هفتگی توسط مدیر */
(function () {
  'use strict';

  var WP_ALL_EXPERTS = '__all__';

  var _wpState = {
    expertId: '',
    expertList: [],
    filterExpert: '',
    weekId: '',
    weekEnd: '',
    customStart: '',
    customEnd: '',
    mode: 'week',
    actionType: 'all',
    centers: [],
    selected: {},
    rowTypes: {},
    // filters
    search: '',
    filterStatus: '',
    filterPotential: '',
    filterLastContact: '',
    filterScheduled: 'unscheduled',
    filterProvId: '',
    filterLead: '',
    sortBy: 'priority',
    visibleCount: 80,
  };
  // HTML onchange handlers need global access (IIFE scope otherwise throws)
  window._wpState = _wpState;

  var _WP_ACT_FALLBACK = {
    call: '📞 تماس',
    visit: '🤝 ملاقات',
    price_send: '📄 ارسال قیمت',
    sample_send: '🧪 ارسال نمونه',
    committee: '🏛 پیگیری کمیته',
    meeting: '👥 جلسه',
    followup: '🔄 پیگیری',
  };

  function _wpActLabels() {
    return (typeof ACTION_TYPE_LABELS !== 'undefined' && ACTION_TYPE_LABELS) ? ACTION_TYPE_LABELS : _WP_ACT_FALLBACK;
  }

  function _wpActOptionsHtml(selected, withAll) {
    var labels = _wpActLabels();
    var html = '';
    if (withAll) {
      html += '<option value="all"' + (selected === 'all' || !selected ? ' selected' : '') + '>✨ همه — انتخاب برای هر مرکز</option>';
    }
    Object.keys(labels).forEach(function (k) {
      html += '<option value="' + k + '"' + (selected === k ? ' selected' : '') + '>' + labels[k] + '</option>';
    });
    return html;
  }

  function _wpResolveActionType(rkey) {
    if (_wpState.actionType && _wpState.actionType !== 'all') return _wpState.actionType;
    return (_wpState.rowTypes && _wpState.rowTypes[rkey]) || 'call';
  }

  function _wpActHint() {
    if (_wpState.actionType === 'all') {
      return 'برای هر مرکز در جدول، نوع اقدام جداگانه انتخاب کنید (پیش‌فرض: تماس).';
    }
    var labels = _wpActLabels();
    return 'همه مراکز انتخاب‌شده با نوع «' + (labels[_wpState.actionType] || _wpState.actionType) + '» ثبت می‌شوند.';
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function _todayJ() {
    var d = new Date();
    return typeof g2j === 'function' ? g2j(d.getFullYear(), d.getMonth()+1, d.getDate()) : [d.getFullYear()-621, d.getMonth()+1, d.getDate()];
  }

  function _todayStr() {
    var t = _todayJ();
    return t[0] + '/' + p2(t[1]) + '/' + p2(t[2]);
  }

  function _workDays(startStr, endStr) {
    var days = [];
    var parts = startStr.split('/').map(Number);
    var cur = [parts[0], parts[1], parts[2]];
    var endParts = endStr.split('/').map(Number);
    var endMs = jMs(endParts[0], endParts[1], endParts[2]);
    var safety = 0;
    while (jMs(cur[0], cur[1], cur[2]) <= endMs && safety++ < 60) {
      if (jDow(cur[0], cur[1], cur[2]) !== 6) days.push(cur[0]+'/'+p2(cur[1])+'/'+p2(cur[2]));
      var next = jAdd(cur[0], cur[1], cur[2], 1);
      cur = [next[0], next[1], next[2]];
    }
    return days;
  }

  function _dayLabel(jalaliDate) {
    if (!jalaliDate) return '';
    var parts = jalaliDate.split('/').map(Number);
    var dow = jDow(parts[0], parts[1], parts[2]);
    var names = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
    return (names[dow]||'') + ' ' + jalaliDate.slice(5);
  }

  function _isOverdue(fd) { return fd && fd < _todayStr(); }

  function _daysSince(jalaliDate) {
    if (!jalaliDate) return null;
    try {
      var parts = jalaliDate.split('/').map(Number);
      var g = j2g(parts[0], parts[1], parts[2]);
      return Math.round((Date.now() - new Date(g[0], g[1]-1, g[2]).getTime()) / 86400000);
    } catch(e) { return null; }
  }

  function _autoSpread(centerIds, workDays) {
    if (!workDays.length) return {};
    var map = {};
    centerIds.forEach(function(id, idx) { map[id] = workDays[idx % workDays.length]; });
    return map;
  }

  function _fNorm(s) {
    return typeof fNorm === 'function' ? fNorm(s) : (s||'').toLowerCase();
  }

  // ── load centers ─────────────────────────────────────────────────────────

  function _loadCenters(expertId) {
    if (typeof _buildPCCache === 'function') _buildPCCache();
    var db = window.DB || {};
    var edits = db.edits || {};
    var centers = [];
    var weekEntries = db.weekEntries || {};
    var allMode = expertId === WP_ALL_EXPERTS;
    var ownerSet = null;
    if (allMode) {
      ownerSet = {};
      (_wpState.expertList || []).forEach(function (u) { ownerSet[u.id] = true; });
    } else if (expertId) {
      ownerSet = {};
      ownerSet[expertId] = true;
    }

    // Pre-build scheduled set for O(1) lookup instead of O(n) .some() per center
    var _wpScheduledSet = new Set();
    Object.values(weekEntries).forEach(function(we) {
      if (!we.done && we.scheduledDate && _wpState.weekId && _wpState.weekEnd &&
          we.scheduledDate >= _wpState.weekId && we.scheduledDate <= _wpState.weekEnd) {
        _wpScheduledSet.add(we.rtype + '_' + we.rid);
      }
    });

    if (typeof getAllProvinces === 'function') {
      getAllProvinces().forEach(function(p) {
        var rtype = typeof getProvType === 'function' ? getProvType(p.id) : (p.id === 'tehran' ? 'center' : 'pc');
        var provCenters = typeof getProvCenters === 'function' ? getProvCenters(p.id) : [];
        provCenters.forEach(function(c) {
          var e = edits[rtype + '_' + c.id] || {};
          var owner = e.owner || c.owner || '';
          if (!ownerSet || !ownerSet[owner]) return;
          if (['غیرفعال'].includes(e.status || '')) return;

          var fd = e.followupDate || '';
          var potential = parseInt(e.potential) || 4;
          var lastChangeMs = e._lastActivity || 0;
          var lastContactDate = e._lastContactDate || '';
          var daysSince = lastChangeMs ? Math.round((Date.now() - lastChangeMs) / 86400000) : null;

          var alreadyScheduled = _wpScheduledSet.has(rtype + '_' + c.id);
          var ownerName = (typeof USERS !== 'undefined' && USERS[owner]) ? USERS[owner] : owner;

          centers.push({
            id: c.id, rtype: rtype, rkey: rtype+'_'+c.id,
            name: e.nameOverride || c.name || c.id,
            potential: potential,
            status: e.status || '',
            lead: e.lead || c.lead || 'سرنخ',
            followupDate: fd,
            isOverdue: _isOverdue(fd),
            daysSince: daysSince,
            lastContactDate: lastContactDate,
            alreadyScheduled: alreadyScheduled,
            provId: p.id,
            provName: p.name || p.id,
            ownerId: owner,
            ownerName: ownerName,
          });
        });
      });
    }

    _wpState.centers = centers;
  }

  function _applyFilters() {
    var centers = _wpState.centers.slice();
    var today = _todayStr();

    // text search
    if (_wpState.search) {
      var q = _fNorm(_wpState.search);
      centers = centers.filter(function(c) { return _fNorm(c.name).indexOf(q) >= 0; });
    }

    // status
    if (_wpState.filterStatus) {
      centers = centers.filter(function(c) { return c.status === _wpState.filterStatus; });
    }

    // potential
    if (_wpState.filterPotential) {
      var fp = parseInt(_wpState.filterPotential);
      if (_wpState.filterPotential === 'overdue') {
        centers = centers.filter(function(c) { return c.isOverdue; });
      } else if (_wpState.filterPotential === '12') {
        centers = centers.filter(function(c) { return c.potential <= 2 || c.isOverdue; });
      } else {
        centers = centers.filter(function(c) { return c.potential === fp; });
      }
    }

    // last contact
    if (_wpState.filterLastContact) {
      if (_wpState.filterLastContact === 'never') {
        centers = centers.filter(function(c) { return c.daysSince === null; });
      } else {
        var days = parseInt(_wpState.filterLastContact);
        centers = centers.filter(function(c) { return c.daysSince === null || c.daysSince >= days; });
      }
    }

    // scheduled / unscheduled
    if (_wpState.filterScheduled === 'unscheduled') {
      centers = centers.filter(function(c) { return !c.alreadyScheduled; });
    } else if (_wpState.filterScheduled === 'scheduled') {
      centers = centers.filter(function(c) { return c.alreadyScheduled; });
    }

    // province
    if (_wpState.filterProvId) {
      centers = centers.filter(function(c) { return c.provId === _wpState.filterProvId; });
    }

    // lead
    if (_wpState.filterLead) {
      centers = centers.filter(function(c) { return c.lead === _wpState.filterLead; });
    }

    // expert (only in all-experts mode)
    if (_wpState.expertId === WP_ALL_EXPERTS && _wpState.filterExpert) {
      centers = centers.filter(function(c) { return c.ownerId === _wpState.filterExpert; });
    }

    // sort
    centers.sort(function(a, b) {
      if (_wpState.sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'fa');
      }
      if (_wpState.sortBy === 'lastcontact') {
        var da = a.daysSince === null ? 9999 : a.daysSince;
        var db2 = b.daysSince === null ? 9999 : b.daysSince;
        return db2 - da;
      }
      // default: priority
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.potential !== b.potential) return a.potential - b.potential;
      var dA = a.daysSince === null ? 0 : a.daysSince;
      var dB = b.daysSince === null ? 0 : b.daysSince;
      return dB - dA;
    });

    return centers;
  }

  // ── compute date range ────────────────────────────────────────────────────

  function _computeRange() {
    if (_wpState.mode === 'week') return { start: _wpState.weekId, end: _wpState.weekEnd };
    if (_wpState.mode === '3day') {
      var t = _todayJ();
      var days = [], cur = jAdd(t[0], t[1], t[2], 1);
      cur = [cur[0], cur[1], cur[2]];
      while (days.length < 3) {
        if (jDow(cur[0], cur[1], cur[2]) !== 6) days.push(cur.slice());
        cur = jAdd(cur[0], cur[1], cur[2], 1); cur = [cur[0], cur[1], cur[2]];
      }
      var s = days[0][0]+'/'+p2(days[0][1])+'/'+p2(days[0][2]);
      var e = days[2][0]+'/'+p2(days[2][1])+'/'+p2(days[2][2]);
      _wpState.weekId = s; _wpState.weekEnd = e;
      return { start: s, end: e };
    }
    if (_wpState.mode === 'custom') {
      _wpState.weekId = _wpState.customStart; _wpState.weekEnd = _wpState.customEnd;
      return { start: _wpState.customStart, end: _wpState.customEnd };
    }
    return { start: '', end: '' };
  }

  // ── render panel ─────────────────────────────────────────────────────────

  // fallback if expert-targets.js not yet loaded
  if (typeof window._etSetView !== 'function') {
    window._etSetView = function (v) {
      window._wpPlannerView = v;
      try { if (v !== 'guide') localStorage.setItem('wp_planner_seen', '1'); } catch (e) {}
      if (typeof renderWeekPlannerPanel === 'function') renderWeekPlannerPanel();
    };
  }

  window.renderWeekPlannerPanel = function () {
    var el = document.getElementById('weekPlannerPanel');
    if (!el) return;

    // اولین بازدید مدیر → تب راهنما تا سه لایه سیستم روشن شود
    if (!window._wpPlannerView) {
      try {
        window._wpPlannerView = localStorage.getItem('wp_planner_seen') ? 'assign' : 'guide';
      } catch (e) { window._wpPlannerView = 'assign'; }
    }
    var view = window._wpPlannerView;
    if (view !== 'guide') {
      try { localStorage.setItem('wp_planner_seen', '1'); } catch (e2) {}
    }
    var tab = function (id, label) {
      var on = view === id;
      return '<button onclick="window._etSetView(\'' + id + '\')" style="padding:8px 16px;border:none;border-bottom:2px solid ' + (on ? '#6366f1' : 'transparent') + ';background:transparent;font-family:inherit;font-size:.88rem;font-weight:' + (on ? '700' : '500') + ';color:' + (on ? '#6366f1' : '#64748b') + ';cursor:pointer">' + label + '</button>';
    };

    var chrome =
      '<div style="max-width:1100px;margin:0 auto">' +
      '<h2 style="margin:0 0 4px;font-size:1.2rem;font-weight:700;color:#1e293b">📋 برنامه تیم — تخصیص و هدف</h2>' +
      '<div style="font-size:.8rem;color:#64748b;margin-bottom:10px">مدیر اینجا کار را برنامه‌ریزی می‌کند؛ کارشناس در تب «برنامه هفته» و «خانه» انجام می‌دهد.</div>' +
      '<div style="display:flex;gap:4px;border-bottom:1px solid #e2e8f0;margin-bottom:14px">' +
        tab('assign', '۱. تخصیص مراکز') +
        tab('quota', '۲. اهداف عددی (Quota)') +
        tab('guide', '❓ راهنما') +
      '</div>' +
      '<div id="wpPlannerBody"></div></div>';

    el.innerHTML = chrome;
    var body = document.getElementById('wpPlannerBody');
    if (!body) return;

    if (view === 'guide') {
      _renderGuidePanel(body);
      return;
    }
    if (view === 'quota') {
      if (typeof window.renderExpertTargetsPanel === 'function') {
        window.renderExpertTargetsPanel(body);
      } else {
        body.innerHTML = '<div style="padding:20px;color:#94a3b8">ماژول اهداف بارگذاری نشده — صفحه را رفرش کنید</div>';
      }
      return;
    }

    _renderAssignPanel(body);
  };

  function _renderGuidePanel(el) {
    el.innerHTML =
      '<div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;line-height:1.9;color:#334155;font-size:.9rem">' +
        '<h3 style="margin:0 0 12px;color:#1e293b;font-size:1.05rem">سیستم برنامه هفته در یک نگاه</h3>' +
        '<p style="margin:0 0 14px">این سیستم سه لایه دارد. اگر این‌ها را قاطی کنید گیج می‌شوید:</p>' +
        '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:.85rem">' +
          '<tr style="background:#f8fafc"><th style="text-align:right;padding:8px;border:1px solid #e2e8f0">لایه</th><th style="text-align:right;padding:8px;border:1px solid #e2e8f0">سؤال</th><th style="text-align:right;padding:8px;border:1px solid #e2e8f0">کجا</th></tr>' +
          '<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>تخصیص مراکز</b></td><td style="padding:8px;border:1px solid #e2e8f0">این مرکز کِی؟</td><td style="padding:8px;border:1px solid #e2e8f0">همین تب → تخصیص</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>هدف (Quota)</b></td><td style="padding:8px;border:1px solid #e2e8f0">این هفته چند تا Done؟</td><td style="padding:8px;border:1px solid #e2e8f0">همین تب → اهداف</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>اجرا</b></td><td style="padding:8px;border:1px solid #e2e8f0">الان چه کار کنم؟</td><td style="padding:8px;border:1px solid #e2e8f0">تب برنامه هفته / خانه</td></tr>' +
        '</table>' +
        '<h4 style="margin:0 0 8px;color:#1e293b">مثال واقعی</h4>' +
        '<ol style="margin:0 0 14px 18px;padding:0">' +
          '<li>مدیر برای «رامبد» هدف می‌گذارد: <b>۲۰ Done این هفته</b>، حداقل ۶ پرریسک.</li>' +
          '<li>مدیر ۳ مرکز مهم را هم دستی تخصیص می‌دهد (تعهد ثابت — از ۲۰ کم می‌شود).</li>' +
          '<li>رامبد در «برنامه هفته» بقیه را می‌چیند و کار می‌کند.</li>' +
          '<li>هر Done → نوار پیشرفت Quota جلو می‌رود. فقط برنامه‌چیدن بدون Done = صفر.</li>' +
        '</ol>' +
        '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;font-size:.82rem;color:#92400e">' +
          '<b>نکته:</b> خانه (کارتابل) لیست کارهای معوق/امروز است. زنگ 🔔 فقط خبرهای جدید است — نه لیست کار روزانه.' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button onclick="window._etSetView(\'assign\')" style="padding:8px 14px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-family:inherit;cursor:pointer;font-weight:600">رفتن به تخصیص</button>' +
          '<button onclick="window._etSetView(\'quota\')" style="padding:8px 14px;background:#fff;color:#6366f1;border:1px solid #6366f1;border-radius:8px;font-family:inherit;cursor:pointer;font-weight:600">رفتن به اهداف</button>' +
        '</div>' +
      '</div>';
  }

  function _renderAssignPanel(el) {
    var weeks = typeof wpGetWeeks === 'function' ? wpGetWeeks() : [];
    var currentWeekId = typeof wpCurrentWeekId === 'function' ? wpCurrentWeekId() : '';
    if (!_wpState.weekId && currentWeekId) {
      var cw = weeks.find(function (w) { return w.id === currentWeekId; });
      if (cw) { _wpState.weekId = cw.wsStr; _wpState.weekEnd = cw.weStr; }
    }

    var activeWeeksMap = {};
    Object.keys(DB.weekEntries || {}).forEach(function (k) {
      var we = DB.weekEntries[k];
      if (we && !we.done) {
        activeWeeksMap[k.split(':::')[0]] = true;
      }
    });

    var weekOpts = weeks.map(function (w) {
      var suffix = '';
      if (w.isCurrent) suffix = ' ◀ این هفته';
      else if (activeWeeksMap[w.id]) suffix = ' 🔴 (کار مانده)';
      else if (w.isPast) suffix = ' ✓';
      return '<option value="' + w.wsStr + '|' + w.weStr + '"' + ((_wpState.weekId === w.wsStr) ? ' selected' : '') + '>' + esc(w.label) + suffix + ' </option>';
    }).join('');

    var inp = function (style, extra) {
      return 'padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:.85rem;' + (style || '') + '" ' + (extra || '');
    };

    var modeBtn = function (m, lbl) {
      var active = _wpState.mode === m;
      return '<button onclick="window._wpSetMode(\'' + m + '\')" style="flex:1;padding:7px 4px;border:1px solid ' + (active ? '#6366f1' : '#e2e8f0') + ';border-radius:7px;font-family:inherit;font-size:.82rem;cursor:pointer;background:' + (active ? '#6366f1' : '#fff') + ';color:' + (active ? '#fff' : '#374151') + '">' + lbl + '</button>';
    };

    var dateRangeHtml =
      _wpState.mode === 'week'
        ? '<div style="flex:2;min-width:200px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">هفته</label>' +
          '<select id="wpWeekSel" onchange="window._wpOnWeekChange(this.value)" style="width:100%;' + inp() + '></select></div>'.replace('></select>', '>' + weekOpts + '</select>')
        : _wpState.mode === 'custom'
          ? '<div style="flex:1;min-width:110px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">از</label>' +
            '<input type="text" id="wpCustomStart" placeholder="۱۴۰۴/۰۳/۱۵" value="' + (_wpState.customStart || '') + '" onchange="window._wpState.customStart=this.value" style="width:100%;box-sizing:border-box;' + inp() + '></div>' +
            '<div style="flex:1;min-width:110px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">تا</label>' +
            '<input type="text" id="wpCustomEnd" placeholder="۱۴۰۴/۰۳/۱۸" value="' + (_wpState.customEnd || '') + '" onchange="window._wpState.customEnd=this.value" style="width:100%;box-sizing:border-box;' + inp() + '></div>'
          : '<div style="flex:1;min-width:180px;padding:9px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:.83rem;color:#15803d;display:flex;align-items:center">📅 ۳ روز کاری از فردا</div>';

    el.innerHTML =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:.8rem;color:#1e40af;line-height:1.6">' +
        '<b>تخصیص مراکز چیست؟</b> انتخاب مرکزهای مشخص برای یک کارشناس یا <b>همه کارشناسان</b> در یک بازه. با «همه کارشناسان» می‌توانید انتخاب گروهی و تخصیص یک‌جا برای چند نفر انجام دهید. برای عدد کلی هدف → زیرتب «اهداف».' +
      '</div>' +
      '<div style="background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:14px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
          '<div style="flex:1.2;min-width:200px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">کاربر <span id="wpExpertHint" style="color:#94a3b8;font-weight:500"></span></label>' +
          '<select id="wpExpertSel" onchange="window._wpOnExpertChange(this.value)" style="width:100%;' + inp() + '"><option value="">در حال بارگذاری…</option></select></div>' +
          '<div style="flex:1;min-width:160px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">بازه زمانی</label>' +
          '<div style="display:flex;gap:4px">' + modeBtn('week', 'هفتگی') + modeBtn('3day', '۳ روز') + modeBtn('custom', 'دلخواه') + '</div></div>' +
          dateRangeHtml +
          '<div style="flex:1.1;min-width:200px">' +
            '<label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">نوع اقدام</label>' +
            '<select id="wpActionType" onchange="window._wpOnActionTypeChange(this.value)" style="width:100%;' + inp('font-weight:600') + '">' +
              _wpActOptionsHtml(_wpState.actionType || 'all', true) +
            '</select>' +
            '<div id="wpActHint" style="font-size:.72rem;color:#64748b;margin-top:5px;line-height:1.45">' + _wpActHint() + '</div>' +
          '</div>' +
          '<button onclick="window._wpLoadCenters()" style="padding:9px 22px;background:#6366f1;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.9rem;cursor:pointer;font-weight:600;white-space:nowrap">بارگذاری مراکز ▼</button>' +
        '</div>' +
      '</div>' +
      '<div id="wpCenterList"></div>';

    // Fill expert dropdown from /api/users (all active)
    function fillExperts(users) {
      _wpState.expertList = users || [];
      var sel = document.getElementById('wpExpertSel');
      if (!sel) return;
      var hint = document.getElementById('wpExpertHint');
      if (hint) {
        hint.textContent = _wpState.expertId === WP_ALL_EXPERTS
          ? '(همه — ' + users.length + ' نفر)'
          : '(' + users.length + ' نفر)';
      }
      sel.innerHTML = '<option value="">— انتخاب کنید —</option>' +
        '<option value="' + WP_ALL_EXPERTS + '"' + ((_wpState.expertId === WP_ALL_EXPERTS) ? ' selected' : '') + '>👥 همه کارشناسان</option>' +
        users.map(function (u) {
          var label = esc(u.name) + (u.role ? ' — ' + esc(u.role) : '');
          return '<option value="' + esc(u.id) + '"' + ((_wpState.expertId === u.id) ? ' selected' : '') + '>' + label + '</option>';
        }).join('');
    }
    if (typeof window._etLoadUsersForPlanner === 'function') {
      window._etLoadUsersForPlanner(fillExperts);
    } else {
      fetch('/api/users').then(function (r) { return r.json(); }).then(function (list) {
        fillExperts((list || []).filter(function (m) {
          return m.active !== false && m.username !== 'guest' && m.role !== 'مهمان';
        }).map(function (m) {
          return { id: m.username, name: m.display_name, role: m.role };
        }));
      }).catch(function () {});
    }
  }

  // ── render list with filters ──────────────────────────────────────────────

  function _wpRenderList(range) {
    var el = document.getElementById('wpCenterList');
    if (!el) return;

    var workDays = _workDays(range.start, range.end);
    var allMode = _wpState.expertId === WP_ALL_EXPERTS;
    var expertName = allMode
      ? 'همه کارشناسان'
      : ((typeof USERS !== 'undefined' && USERS[_wpState.expertId])
        ? USERS[_wpState.expertId]
        : _wpState.expertId);

    // Unique statuses and provinces from loaded centers
    var statusSet = {}, provSet = {};
    _wpState.centers.forEach(function(c) {
      if (c.status) statusSet[c.status] = true;
      if (c.provId) provSet[c.provId] = c.provName || c.provId;
    });

    var filtered = _applyFilters();

    var potColor = function(p) { return ['','#10b981','#6366f1','#f59e0b','#94a3b8'][p]||'#94a3b8'; };

    // ── filter bar ───────────────────────────────────────────────────────────
    var sel = function(id, val, onch, opts) {
      return '<select id="'+id+'" onchange="'+onch+'" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:.8rem;background:#fff">'+opts+'</select>';
    };

    var potOpts =
      '<option value="">همه پتانسیل‌ها</option>' +
      '<option value="12"'+(_wpState.filterPotential==='12'?' selected':'')+'>⭐ P1 + P2 + معوق</option>' +
      '<option value="1"'+(_wpState.filterPotential==='1'?' selected':'')+'>P1</option>' +
      '<option value="2"'+(_wpState.filterPotential==='2'?' selected':'')+'>P2</option>' +
      '<option value="3"'+(_wpState.filterPotential==='3'?' selected':'')+'>P3</option>' +
      '<option value="overdue"'+(_wpState.filterPotential==='overdue'?' selected':'')+'>🔴 معوق</option>';

    var statusOpts = '<option value="">همه وضعیت‌ها</option>' +
      Object.keys(statusSet).map(function(s) {
        return '<option value="'+esc(s)+'"'+(_wpState.filterStatus===s?' selected':'')+'>'+esc(s)+'</option>';
      }).join('');

    var contactOpts =
      '<option value="">هر زمان</option>' +
      '<option value="30"'+(_wpState.filterLastContact==='30'?' selected':'')+'>بیش از ۳۰ روز</option>' +
      '<option value="60"'+(_wpState.filterLastContact==='60'?' selected':'')+'>بیش از ۶۰ روز</option>' +
      '<option value="90"'+(_wpState.filterLastContact==='90'?' selected':'')+'>بیش از ۹۰ روز</option>' +
      '<option value="never"'+(_wpState.filterLastContact==='never'?' selected':'')+'>هرگز تماس نشده</option>';

    var scheduledOpts =
      '<option value="">همه</option>' +
      '<option value="unscheduled"'+(_wpState.filterScheduled==='unscheduled'?' selected':'')+'>بدون برنامه این بازه</option>' +
      '<option value="scheduled"'+(_wpState.filterScheduled==='scheduled'?' selected':'')+'>دارای برنامه</option>';

    var LEAD_VALS = (typeof LEAD_LIST !== 'undefined') ? LEAD_LIST : ['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'];
    var leadOpts = '<option value="">همه سرنخ‌ها</option>' +
      LEAD_VALS.map(function(l) { return '<option value="'+esc(l)+'"'+(_wpState.filterLead===l?' selected':'')+'>'+esc(l)+'</option>'; }).join('');

    var provOpts = '<option value="">همه استان‌ها</option>' +
      Object.keys(provSet).map(function(pid) {
        return '<option value="'+esc(pid)+'"'+(_wpState.filterProvId===pid?' selected':'')+'>'+esc(provSet[pid])+'</option>';
      }).join('');

    var expertOpts = '';
    if (allMode) {
      var ownerSet = {};
      _wpState.centers.forEach(function(c) {
        if (c.ownerId) ownerSet[c.ownerId] = c.ownerName || c.ownerId;
      });
      expertOpts = '<option value="">همه کارشناسان</option>' +
        Object.keys(ownerSet).sort(function(a, b) {
          return (ownerSet[a] || '').localeCompare(ownerSet[b] || '', 'fa');
        }).map(function(oid) {
          return '<option value="'+esc(oid)+'"'+(_wpState.filterExpert===oid?' selected':'')+'>'+esc(ownerSet[oid])+'</option>';
        }).join('');
    }

    var sortOpts =
      '<option value="priority"'+(_wpState.sortBy==='priority'?' selected':'')+'>اولویت</option>' +
      '<option value="lastcontact"'+(_wpState.sortBy==='lastcontact'?' selected':'')+'>آخرین تماس</option>' +
      '<option value="name"'+(_wpState.sortBy==='name'?' selected':'')+'>نام</option>';

    var filterBar =
      '<div style="padding:14px 18px;border-bottom:1px solid #f1f5f9;background:#f8fafc;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
        // text search
        '<input type="text" id="wpSearch" placeholder="🔍 جستجوی نام مرکز..." value="'+esc(_wpState.search)+'" ' +
          'oninput="window._wpSetFilter(\'search\',this.value)" ' +
          'style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:.8rem;min-width:180px;flex:1">' +
        sel('wpFPot', _wpState.filterPotential, "window._wpSetFilter('potential',this.value)", potOpts) +
        sel('wpFStatus', _wpState.filterStatus, "window._wpSetFilter('status',this.value)", statusOpts) +
        sel('wpFContact', _wpState.filterLastContact, "window._wpSetFilter('lastcontact',this.value)", contactOpts) +
        sel('wpFSched', _wpState.filterScheduled, "window._wpSetFilter('scheduled',this.value)", scheduledOpts) +
        sel('wpFProv', _wpState.filterProvId, "window._wpSetFilter('prov',this.value)", provOpts) +
        (allMode ? sel('wpFExpert', _wpState.filterExpert, "window._wpSetFilter('expert',this.value)", expertOpts) : '') +
        sel('wpFLead', _wpState.filterLead, "window._wpSetFilter('lead',this.value)", leadOpts) +
        '<div style="display:flex;align-items:center;gap:5px;margin-right:auto">' +
          '<span style="font-size:.75rem;color:#6b7280;white-space:nowrap">مرتب بر اساس:</span>' +
          sel('wpSort', _wpState.sortBy, "window._wpSetFilter('sort',this.value)", sortOpts) +
        '</div>' +
      '</div>';

    // ── table ────────────────────────────────────────────────────────────────
    var selectedKeys = Object.keys(_wpState.selected);
    var selectedCount = selectedKeys.length;

    var visibleFiltered = filtered.slice(0, _wpState.visibleCount);
    var hasMore = filtered.length > _wpState.visibleCount;
    var tableRows = visibleFiltered.map(function(c) {
      var checked = (c.rkey in _wpState.selected);
      var dayOverride = (typeof _wpState.selected[c.rkey] === 'string') ? _wpState.selected[c.rkey] : '';
      var dayOpts = '<option value="">پخش خودکار</option>' +
        workDays.map(function(d) {
          return '<option value="'+d+'"'+(dayOverride===d?' selected':'')+'>'+_dayLabel(d)+'</option>';
        }).join('');

      var lastStr = c.daysSince !== null ? c.daysSince + ' روز پیش' : 'هرگز';
      var overdueTag = c.isOverdue ? '<span style="font-size:.68rem;padding:2px 6px;background:#fef2f2;color:#dc2626;border-radius:10px;display:inline-block">معوق</span>' : '';
      var schedTag   = c.alreadyScheduled ? '<span style="font-size:.68rem;padding:2px 6px;background:#f0fdf4;color:#16a34a;border-radius:10px;display:inline-block">✓ برنامه دارد</span>' : '';
      var provTag    = '<span style="font-size:.68rem;padding:2px 6px;background:#f1f5f9;color:#64748b;border-radius:10px;display:inline-block">'+esc(c.provName||c.provId)+'</span>';
      var ownerTag   = allMode ? '<span style="font-size:.68rem;padding:2px 6px;background:#dbeafe;color:#1e40af;border-radius:10px;display:inline-block">👤 '+esc(c.ownerName||c.ownerId)+'</span>' : '';

      var typeCell = '';
      if (_wpState.actionType === 'all') {
        var rowType = (_wpState.rowTypes && _wpState.rowTypes[c.rkey]) || 'call';
        typeCell = '<td style="padding:8px 10px;width:150px">' +
          '<select onchange="window._wpSetRowType(\''+esc(c.rkey)+'\',this.value)" ' +
            (checked ? '' : 'disabled ') +
            'style="width:100%;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:.75rem;opacity:'+(checked?'1':'.55')+'">' +
            _wpActOptionsHtml(rowType, false) +
          '</select></td>';
      }

      return '<tr style="border-bottom:1px solid #f1f5f9'+(c.isOverdue?';background:#fff8f8':'')+(c.alreadyScheduled?';opacity:.5':'') + '">' +
        '<td style="padding:8px 10px;width:34px">' +
          '<input type="checkbox"'+(checked?' checked':'')+(c.alreadyScheduled?' disabled title="این بازه برنامه دارد"':'')+
          ' onchange="window._wpToggle(\''+esc(c.rkey)+'\',this.checked)" style="width:16px;height:16px;cursor:pointer">' +
        '</td>' +
        '<td style="padding:8px 10px">' +
          '<div style="font-weight:600;font-size:.88rem">'+esc(c.name)+'</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">'+ownerTag+provTag+(c.status?'<span style="font-size:.68rem;padding:2px 6px;background:#f8fafc;color:#64748b;border-radius:10px;display:inline-block">'+esc(c.status)+'</span>':'')+overdueTag+schedTag+'</div>' +
        '</td>' +
        '<td style="padding:8px 10px;white-space:nowrap;text-align:center">' +
          '<span style="font-size:.85rem;font-weight:700;color:'+potColor(c.potential)+'">P'+c.potential+'</span>' +
        '</td>' +
        '<td style="padding:8px 10px;font-size:.8rem;color:#6b7280;white-space:nowrap">' +
          (c.followupDate ? '<div style="color:'+(c.isOverdue?'#dc2626':'#374151')+';font-weight:'+(c.isOverdue?'700':'400')+'">'+c.followupDate+'</div>' : '') +
          '<div style="color:#94a3b8;font-size:.75rem">'+lastStr+'</div>' +
        '</td>' +
        typeCell +
        '<td style="padding:8px 10px;width:155px">' +
          '<select onchange="window._wpSetDay(\''+esc(c.rkey)+'\',this.value)" style="width:100%;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:.78rem">'+dayOpts+'</select>' +
        '</td>' +
      '</tr>';
    }).join('');

    var actLabel = _wpState.actionType === 'all'
      ? 'نوع per مرکز'
      : (_wpActLabels()[_wpState.actionType] || _wpState.actionType);
    var colSpan = _wpState.actionType === 'all' ? 6 : 5;
    var typeHead = _wpState.actionType === 'all'
      ? '<th style="padding:8px 10px;font-size:.75rem;font-weight:600;color:#6b7280;text-align:right">نوع اقدام</th>'
      : '';

    function _wpSelectedExpertCount(keys) {
      var s = {};
      keys.forEach(function (k) {
        var c = _wpState.centers.find(function (x) { return x.rkey === k; });
        if (c && c.ownerId) s[c.ownerId] = true;
      });
      return Object.keys(s).length;
    }

    function _wpPreviewScopeLabel(keys) {
      if (!allMode) return 'برای ' + esc(expertName) + ' — ' + range.start;
      var nExp = _wpSelectedExpertCount(keys);
      return 'برای ' + keys.length + ' مرکز از ' + nExp + ' کارشناس — ' + range.start;
    }

    // ── preview ───────────────────────────────────────────────────────────────
    var previewHtml = '';
    if (selectedCount > 0) {
      var withDay    = selectedKeys.filter(function(k){ return _wpState.selected[k]; });
      var withoutDay = selectedKeys.filter(function(k){ return !_wpState.selected[k]; });
      var autoSpread = _autoSpread(withoutDay, workDays);
      var dayBuckets = {};
      workDays.forEach(function(d){ dayBuckets[d] = []; });
      withDay.forEach(function(k){ var d=_wpState.selected[k]; if(!dayBuckets[d])dayBuckets[d]=[]; dayBuckets[d].push(k); });
      withoutDay.forEach(function(k){ var d=autoSpread[k]; if(!dayBuckets[d])dayBuckets[d]=[]; dayBuckets[d].push(k); });

      var typeSummary = '';
      if (_wpState.actionType === 'all') {
        var typeCounts = {};
        selectedKeys.forEach(function(k) {
          var t = _wpResolveActionType(k);
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        typeSummary = '<div style="font-size:.75rem;color:#64748b;margin-bottom:8px">ترکیب نوع: ' +
          Object.keys(typeCounts).map(function(t) {
            return (_wpActLabels()[t] || t) + ' <b>' + typeCounts[t] + '</b>';
          }).join(' · ') + '</div>';
      } else {
        typeSummary = '<div style="font-size:.75rem;color:#64748b;margin-bottom:8px">نوع یکسان: <b>' + esc(actLabel) + '</b></div>';
      }

      previewHtml =
        '<div style="font-size:.83rem;font-weight:600;color:#374151;margin-bottom:8px">پیش‌نمایش توزیع:</div>' +
        typeSummary +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
          workDays.map(function(d) {
            var n = (dayBuckets[d]||[]).length;
            return '<div style="flex:1;min-width:80px;background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0;text-align:center">' +
              '<div style="font-size:.7rem;font-weight:700;color:#374151;margin-bottom:3px">'+_dayLabel(d)+'</div>' +
              '<div style="font-size:1.2rem;font-weight:800;color:'+(n>5?'#ef4444':n>0?'#6366f1':'#d1d5db')+'">'+n+'</div>' +
              '<div style="font-size:.65rem;color:#9ca3af">مرکز</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
          '<button onclick="window._wpSubmit()" style="padding:10px 28px;background:#10b981;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
            '✅ افزودن '+selectedCount+' مرکز به برنامه' +
          '</button>' +
          '<button onclick="window.wpOpenPlannerBulkMove()" style="padding:10px 24px;background:#8b5cf6;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
            '🔄 انتقال به هفته دیگر (بدون روز)' +
          '</button>' +
          '<span style="font-size:.8rem;color:#6b7280;margin-right:12px">'+_wpPreviewScopeLabel(selectedKeys)+'</span>' +
        '</div>';
    }

    el.innerHTML =
      '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">' +

        // top bar
        '<div style="padding:12px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<span style="font-size:.88rem;font-weight:600;color:#374151">'+esc(expertName)
            +(allMode ? ' ('+new Set(_wpState.centers.map(function(c){return c.ownerId;})).size+' کارشناس)' : '')
            +' — '+range.start+' تا '+range.end+' ('+workDays.length+' روز کاری) · '+esc(actLabel)+'</span>' +
          '<span style="font-size:.82rem;color:#6366f1;font-weight:600">'+filtered.length+' مرکز</span>' +
        '</div>' +

        filterBar +

        // select-all bar
        '<div style="padding:9px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;background:#fafafa">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.82rem">' +
            '<input type="checkbox" id="wpSelectAll" onchange="window._wpSelectAll(this.checked)" style="width:15px;height:15px"> انتخاب همه نمایش‌یافته‌ها' +
          '</label>' +
          '<span id="wpSelCount" style="font-size:.82rem;color:#6366f1;font-weight:600">'+selectedCount+' انتخاب شده</span>' +
          '<button id="wpClearBtn" onclick="window._wpClearAll()" style="padding:3px 10px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:.78rem;cursor:pointer;background:#fff;display:'+(selectedCount>0?'inline':'none')+'">پاک‌کردن</button>' +
        '</div>' +

        '<div style="overflow-x:auto">' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">' +
              '<th style="padding:8px 10px;width:34px"></th>' +
              '<th style="padding:8px 10px;font-size:.75rem;font-weight:600;color:#6b7280;text-align:right">مرکز</th>' +
              '<th style="padding:8px 10px;font-size:.75rem;font-weight:600;color:#6b7280;text-align:center">پتانسیل</th>' +
              '<th style="padding:8px 10px;font-size:.75rem;font-weight:600;color:#6b7280;text-align:right">پیگیری / آخرین</th>' +
              typeHead +
              '<th style="padding:8px 10px;font-size:.75rem;font-weight:600;color:#6b7280;text-align:right">روز</th>' +
            '</tr></thead>' +
            '<tbody>'+(tableRows||'<tr><td colspan="'+colSpan+'" style="padding:32px;text-align:center;color:#9ca3af">مرکزی با این فیلترها پیدا نشد</td></tr>')+(hasMore ? '<tr><td colspan="'+colSpan+'" style="padding:12px;text-align:center"><button onclick="window._wpShowMore()" style="padding:7px 22px;border:1px solid #6366f1;border-radius:7px;font-family:inherit;font-size:.83rem;cursor:pointer;background:#fff;color:#6366f1">نمایش '+(filtered.length-_wpState.visibleCount)+' مرکز دیگر از '+(filtered.length)+' مرکز</button></td></tr>' : '')+'</tbody>' +
          '</table>' +
        '</div>' +

        (previewHtml ? '<div id="wpPreviewArea" style="padding:16px 18px;border-top:1px solid #f1f5f9;background:#fafafa">'+previewHtml+'</div>' : '<div id="wpPreviewArea" style="display:none"></div>') +
      '</div>';
  }


  // Partial update: only refresh count badge + preview without re-rendering the table
  function _wpUpdateSummaryArea() {
    var range = _computeRange();
    var workDays = _workDays(range.start, range.end);
    var selectedKeys = Object.keys(_wpState.selected);
    var selectedCount = selectedKeys.length;

    // update count badge
    var badge = document.getElementById('wpSelCount');
    if (badge) badge.textContent = selectedCount + ' انتخاب شده';

    // show/hide clear button
    var clearBtn = document.getElementById('wpClearBtn');
    if (clearBtn) clearBtn.style.display = selectedCount > 0 ? '' : 'none';

    // update preview + submit area
    var previewEl = document.getElementById('wpPreviewArea');
    if (!previewEl) return;

    if (selectedCount === 0) { previewEl.style.display = 'none'; return; }

    var withDay    = selectedKeys.filter(function(k){ return _wpState.selected[k]; });
    var withoutDay = selectedKeys.filter(function(k){ return !_wpState.selected[k]; });
    var autoSpread = _autoSpread(withoutDay, workDays);
    var dayBuckets = {};
    workDays.forEach(function(d){ dayBuckets[d] = []; });
    withDay.forEach(function(k){ var d=_wpState.selected[k]; if(!dayBuckets[d])dayBuckets[d]=[]; dayBuckets[d].push(k); });
    withoutDay.forEach(function(k){ var d=autoSpread[k]; if(!dayBuckets[d])dayBuckets[d]=[]; dayBuckets[d].push(k); });

    var expertName = _wpState.expertId === WP_ALL_EXPERTS
      ? 'همه کارشناسان'
      : ((typeof USERS !== 'undefined' && USERS[_wpState.expertId])
        ? USERS[_wpState.expertId]
        : _wpState.expertId);

    function _wpScopeLabel(keys) {
      if (_wpState.expertId !== WP_ALL_EXPERTS) return 'برای ' + esc(expertName) + ' — ' + range.start;
      var s = {};
      keys.forEach(function (k) {
        var c = _wpState.centers.find(function (x) { return x.rkey === k; });
        if (c && c.ownerId) s[c.ownerId] = true;
      });
      return 'برای ' + keys.length + ' مرکز از ' + Object.keys(s).length + ' کارشناس — ' + range.start;
    }

    previewEl.style.display = '';
    var typeSummary = '';
    if (_wpState.actionType === 'all') {
      var typeCounts = {};
      selectedKeys.forEach(function(k) {
        var t = _wpResolveActionType(k);
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      typeSummary = '<div style="font-size:.75rem;color:#64748b;margin-bottom:8px">ترکیب نوع: ' +
        Object.keys(typeCounts).map(function(t) {
          return (_wpActLabels()[t] || t) + ' <b>' + typeCounts[t] + '</b>';
        }).join(' · ') + '</div>';
    } else {
      typeSummary = '<div style="font-size:.75rem;color:#64748b;margin-bottom:8px">نوع یکسان: <b>' +
        esc(_wpActLabels()[_wpState.actionType] || _wpState.actionType) + '</b></div>';
    }
    previewEl.innerHTML =
      '<div style="font-size:.83rem;font-weight:600;color:#374151;margin-bottom:8px">پیش‌نمایش توزیع:</div>' +
      typeSummary +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
        workDays.map(function(d) {
          var n = (dayBuckets[d]||[]).length;
          return '<div style="flex:1;min-width:80px;background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0;text-align:center">' +
            '<div style="font-size:.7rem;font-weight:700;color:#374151;margin-bottom:3px">'+_dayLabel(d)+'</div>' +
            '<div style="font-size:1.2rem;font-weight:800;color:'+(n>5?'#ef4444':n>0?'#6366f1':'#d1d5db')+'">'+n+'</div>' +
            '<div style="font-size:.65rem;color:#9ca3af">مرکز</div></div>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
        '<button onclick="window._wpSubmit()" style="padding:10px 28px;background:#10b981;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
          '✅ افزودن '+selectedCount+' مرکز به برنامه' +
        '</button>' +
        '<button onclick="window.wpOpenPlannerBulkMove()" style="padding:10px 24px;background:#8b5cf6;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
          '🔄 انتقال به هفته دیگر (بدون روز)' +
        '</button>' +
        '<span style="font-size:.8rem;color:#6b7280;margin-right:12px">'+_wpScopeLabel(selectedKeys)+'</span>' +
      '</div>';
  }

  window._wpShowMore = function() {
    _wpState.visibleCount += 80;
    _wpRenderList(_computeRange());
  };

  // ── event handlers ────────────────────────────────────────────────────────

  window._wpSetMode = function(m) {
    _wpState.mode = m;
    window.renderWeekPlannerPanel();
  };

  window._wpOnExpertChange = function(v) {
    _wpState.expertId = v;
    _wpState.selected = {};
    _wpState.rowTypes = {};
    if (v !== WP_ALL_EXPERTS) _wpState.filterExpert = '';
    var hint = document.getElementById('wpExpertHint');
    if (hint && _wpState.expertList.length) {
      hint.textContent = v === WP_ALL_EXPERTS
        ? '(همه — ' + _wpState.expertList.length + ' نفر)'
        : '(' + _wpState.expertList.length + ' نفر)';
    }
  };

  window._wpOnActionTypeChange = function(v) {
    _wpState.actionType = v || 'all';
    var hint = document.getElementById('wpActHint');
    if (hint) hint.textContent = _wpActHint();
    if (_wpState.actionType !== 'all') {
      _wpState.rowTypes = {};
    }
    var list = document.getElementById('wpCenterList');
    if (list && list.innerHTML) {
      _wpRenderList(_computeRange());
    }
  };

  window._wpSetRowType = function(rkey, val) {
    if (!_wpState.rowTypes) _wpState.rowTypes = {};
    _wpState.rowTypes[rkey] = val || 'call';
    _wpUpdateSummaryArea();
  };

  window._wpOnWeekChange = function(v) {
    var parts = v.split('|');
    _wpState.weekId = parts[0]||''; _wpState.weekEnd = parts[1]||'';
  };

  window._wpSetFilter = function(key, val) {
    if (key === 'search')       _wpState.search = val;
    if (key === 'potential')    _wpState.filterPotential = val;
    if (key === 'status')       _wpState.filterStatus = val;
    if (key === 'lastcontact')  _wpState.filterLastContact = val;
    if (key === 'scheduled')    _wpState.filterScheduled = val;
    if (key === 'prov')         _wpState.filterProvId = val;
    if (key === 'lead')         _wpState.filterLead = val;
    if (key === 'expert')       _wpState.filterExpert = val;
    if (key === 'sort')         _wpState.sortBy = val;
    _wpState.visibleCount = 80;
    _wpRenderList(_computeRange());
  };

  window._wpLoadCenters = function() {
    var expertId = (document.getElementById('wpExpertSel')||{}).value || _wpState.expertId;
    _wpState.expertId = expertId;
    _wpState.actionType = (document.getElementById('wpActionType')||{}).value || _wpState.actionType || 'all';
    if (_wpState.actionType !== 'all') _wpState.rowTypes = {};
    if (_wpState.mode === 'custom') {
      _wpState.customStart = ((document.getElementById('wpCustomStart')||{}).value||'').trim();
      _wpState.customEnd   = ((document.getElementById('wpCustomEnd')||{}).value||'').trim();
    }
    if (!expertId) { if (typeof showToast==='function') showToast('کارشناس یا «همه کارشناسان» را انتخاب کنید'); return; }
    if (expertId === WP_ALL_EXPERTS && !_wpState.expertList.length) {
      if (typeof showToast==='function') showToast('لیست کاربران هنوز بارگذاری نشده — چند ثانیه صبر کنید');
      return;
    }
    var range = _computeRange();
    if (!range.start||!range.end) { if (typeof showToast==='function') showToast('بازه زمانی را تعریف کنید'); return; }
    _loadCenters(expertId);
    _wpState.selected = {};
    _wpState.visibleCount = 80;
    _wpState.filterScheduled = 'unscheduled'; // default: show unscheduled
    _wpRenderList(range);
  };

  window._wpToggle = function(rkey, checked) {
    if (checked) {
      _wpState.selected[rkey] = _wpState.selected[rkey] || '';
      if (_wpState.actionType === 'all' && !_wpState.rowTypes[rkey]) {
        _wpState.rowTypes[rkey] = 'call';
      }
    } else {
      delete _wpState.selected[rkey];
    }
    requestAnimationFrame(function () {
      if (_wpState.actionType === 'all') {
        _wpRenderList(_computeRange());
      } else {
        _wpUpdateSummaryArea();
      }
    });
  };

  window._wpSetDay = function(rkey, day) {
    if (rkey in _wpState.selected) _wpState.selected[rkey] = day;
    _wpUpdateSummaryArea();
  };

  window._wpSelectAll = function(checked) {
    var visible = _applyFilters();
    if (checked) {
      visible.forEach(function(c) {
        if (!c.alreadyScheduled) _wpState.selected[c.rkey] = _wpState.selected[c.rkey] || '';
      });
    } else {
      _wpState.selected = {};
    }
    _wpRenderList(_computeRange());
  };

  window._wpClearAll = function() {
    _wpState.selected = {};
    document.querySelectorAll('#wpCenterList input[type=checkbox]').forEach(function(cb){ cb.checked = false; });
    _wpUpdateSummaryArea();
  };

  window._wpSubmit = function() {
    var range = _computeRange();
    if (!range.start||!range.end) { if(typeof showToast==='function') showToast('بازه زمانی مشخص نیست'); return; }
    var selectedKeys = Object.keys(_wpState.selected);
    if (!selectedKeys.length) { if(typeof showToast==='function') showToast('مرکزی انتخاب نشده'); return; }

    var workDays = _workDays(range.start, range.end);
    var withDay    = selectedKeys.filter(function(k){ return _wpState.selected[k]; });
    var withoutDay = selectedKeys.filter(function(k){ return !_wpState.selected[k]; });
    var autoSpread = _autoSpread(withoutDay, workDays);
    var weekId = _wpState.weekId || range.start;
    var singleExpert = _wpState.expertId !== WP_ALL_EXPERTS;

    var entries = [];
    selectedKeys.forEach(function(rkey) {
      var c = _wpState.centers.find(function(x){ return x.rkey === rkey; });
      if (!c) return;
      var scheduledDate = _wpState.selected[rkey] || autoSpread[rkey] || workDays[0] || '';
      var actionType = _wpResolveActionType(rkey);
      var assignee = singleExpert ? _wpState.expertId : (c.ownerId || _wpState.expertId);
      entries.push({
        id: 'we_'+Date.now()+'_'+Math.random().toString(36).slice(2,5)+'_'+c.id.slice(-4),
        weekId: weekId, recKey: c.rtype+'_'+c.id,
        rtype: c.rtype, rid: c.id,
        scheduledDate: scheduledDate, actionType: actionType,
        addedBy: assignee, centerName: c.name,
        assignmentSource: 'manager_fixed',
      });
    });

    var btn = document.querySelector('[onclick="window._wpSubmit()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'در حال افزودن...'; }

    var done = 0, errors = 0;
    function postNext(i) {
      if (i >= entries.length) {
        if (typeof showToast==='function') showToast('✅ '+done+' مرکز به برنامه اضافه شد'+(errors>0?' ('+errors+' خطا)':''));
        _wpState.selected = {};
        if (typeof loadDB==='function') loadDB().then(function(){ window._wpLoadCenters(); });
        else window._wpLoadCenters();
        return;
      }
      fetch('/api/week-entries', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entries[i])
      }).then(function(r){ if(r.ok) done++; else errors++; postNext(i+1); })
        .catch(function(){ errors++; postNext(i+1); });
    }
    postNext(0);
  };

  window.wpOpenPlannerBulkMove = function() {
    var selectedKeys = Object.keys(_wpState.selected);
    if (!selectedKeys.length) {
      if(typeof showToast==='function') showToast('مرکزی انتخاب نشده');
      return;
    }
    
    var wks = typeof wpGetWeeks === 'function' ? wpGetWeeks() : [];
    
    var activeWeeksMap = {};
    Object.keys(DB.weekEntries || {}).forEach(function(k) {
      var we = DB.weekEntries[k];
      if (we && !we.done) {
        activeWeeksMap[k.split(':::')[0]] = true;
      }
    });

    var shown = []; var seen = {};
    var pastWks = wks.filter(function(w){return w.isPast;});
    var recentPastWks = pastWks.slice(-3);
    wks.filter(function(w){return w.isCurrent||!w.isPast;}).slice(0,8)
      .concat(pastWks.filter(function(w){return activeWeeksMap[w.id] || recentPastWks.some(function(r){return r.id===w.id;});}))
      .forEach(function(w){if(!seen[w.id]){seen[w.id]=true;shown.push(w);}});
    shown.sort(function(a,b){return a.num-b.num;});

    var body = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">انتقال گروهی ' + selectedKeys.length + ' مرکز انتخابی به کدام هفته انجام شود؟ (بدون تعیین روز)</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px;max-height:55vh;overflow-y:auto">'
      + shown.map(function(wt){
        return '<button class="btn-primary" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text-primary);cursor:pointer;font-family:inherit" onclick="window.wpDoPlannerBulkMove(\'' + wt.id + '\')">'
          + '<span style="font-weight:600">' + esc(wt.label) + '</span>'
          + '<span style="font-size:11px;background:#8b5cf620;color:#8b5cf6;border:1px solid #8b5cf644;padding:2px 8px;border-radius:10px">انتقال ↪</span>'
          + '</button>';
      }).join('') + '</div>';

    if (typeof openModal === 'function') {
      openModal('wpPlannerBulkMoveModal', '🔄 انتقال گروهی به هفته دیگر', body, '<button class="btn-secondary" onclick="closeModal(\'wpPlannerBulkMoveModal\')">انصراف</button>');
    }
  };

  window.wpDoPlannerBulkMove = function(targetWeekId) {
    var selectedKeys = Object.keys(_wpState.selected);
    if (!selectedKeys.length) return;

    var singleExpert = _wpState.expertId !== WP_ALL_EXPERTS;

    var entries = [];
    selectedKeys.forEach(function(rkey) {
      var c = _wpState.centers.find(function(x){ return x.rkey === rkey; });
      if (!c) return;
      var actionType = _wpResolveActionType(rkey);
      var assignee = singleExpert ? _wpState.expertId : (c.ownerId || _wpState.expertId);

      if (typeof wpRemoveFromOtherWeeks === 'function') {
        wpRemoveFromOtherWeeks(c.rtype + '_' + c.id, targetWeekId);
      }

      entries.push({
        id: 'we_'+Date.now()+'_'+Math.random().toString(36).slice(2,5)+'_'+c.id.slice(-4),
        weekId: targetWeekId, recKey: c.rtype+'_'+c.id,
        rtype: c.rtype, rid: c.id,
        scheduledDate: null, actionType: actionType,
        addedBy: assignee, centerName: c.name,
        assignmentSource: 'manager_fixed',
      });
    });

    if (typeof closeModal === 'function') {
      closeModal('wpPlannerBulkMoveModal');
    }

    var done = 0, errors = 0;
    function postNext(i) {
      if (i >= entries.length) {
        if (typeof showToast==='function') showToast('✅ '+done+' مرکز به هفته جدید منتقل شد');
        _wpState.selected = {};
        if (typeof loadDB==='function') loadDB().then(function(){ window._wpLoadCenters(); });
        else window._wpLoadCenters();
        return;
      }
      fetch('/api/week-entries', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entries[i])
      }).then(function(r){ if(r.ok) done++; else errors++; postNext(i+1); })
        .catch(function(){ errors++; postNext(i+1); });
    }
    postNext(0);
  };

})();
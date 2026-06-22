/* Week Planner — تخصیص برنامه هفتگی توسط مدیر */
(function () {
  'use strict';

  var _wpState = {
    expertId: '',
    weekId: '',
    weekEnd: '',
    customStart: '',
    customEnd: '',
    mode: 'week',
    actionType: 'call',
    centers: [],
    selected: {},
    // filters
    search: '',
    filterStatus: '',
    filterPotential: '',
    filterLastContact: '',
    filterScheduled: 'unscheduled',
    filterProvId: '',
    sortBy: 'priority',
  };

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
          if (owner !== expertId) return;
          if (['غیرفعال'].includes(e.status || '')) return;

          var fd = e.followupDate || '';
          var potential = parseInt(e.potential) || 4;
          var lastChangeMs = e._lastActivity || 0;
          var lastContactDate = e._lastContactDate || '';
          var daysSince = lastChangeMs ? Math.round((Date.now() - lastChangeMs) / 86400000) : null;

          var alreadyScheduled = _wpScheduledSet.has(rtype + '_' + c.id);

          centers.push({
            id: c.id, rtype: rtype, rkey: rtype+'_'+c.id,
            name: e.nameOverride || c.name || c.id,
            potential: potential,
            status: e.status || '',
            followupDate: fd,
            isOverdue: _isOverdue(fd),
            daysSince: daysSince,
            lastContactDate: lastContactDate,
            alreadyScheduled: alreadyScheduled,
            provId: p.id,
            provName: p.name || p.id,
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

  window.renderWeekPlannerPanel = function () {
    var el = document.getElementById('weekPlannerPanel');
    if (!el) return;

    var users = typeof _DEFAULT_MEMBERS !== 'undefined' ? _DEFAULT_MEMBERS : [];
    var experts = users.filter(function(u) {
      return u.active !== false;
    });

    var weeks = typeof wpGetWeeks === 'function' ? wpGetWeeks() : [];
    var currentWeekId = typeof wpCurrentWeekId === 'function' ? wpCurrentWeekId() : '';
    if (!_wpState.weekId && currentWeekId) {
      var cw = weeks.find(function(w) { return w.id === currentWeekId; });
      if (cw) { _wpState.weekId = cw.wsStr; _wpState.weekEnd = cw.weStr; }
    }

    var expertOpts = '<option value="">— انتخاب کنید —</option>' +
      experts.map(function(u) {
        return '<option value="'+esc(u.id)+'"'+((_wpState.expertId===u.id)?' selected':'')+'>'+esc(u.name)+'</option>';
      }).join('');

    var weekOpts = weeks.filter(function(w){ return !w.isPast; }).map(function(w) {
      return '<option value="'+w.wsStr+'|'+w.weStr+'"'+((_wpState.weekId===w.wsStr)?' selected':'')+'>'+esc(w.label)+(w.isCurrent?' ← این هفته':'')+' </option>';
    }).join('');

    var inp = function(style, extra) {
      return 'padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:.85rem;' + (style||'') + '" ' + (extra||'');
    };

    var modeBtn = function(m, lbl) {
      var active = _wpState.mode === m;
      return '<button onclick="window._wpSetMode(\''+m+'\')" style="flex:1;padding:7px 4px;border:1px solid '+(active?'#6366f1':'#e2e8f0')+';border-radius:7px;font-family:inherit;font-size:.82rem;cursor:pointer;background:'+(active?'#6366f1':'#fff')+';color:'+(active?'#fff':'#374151')+'">'+lbl+'</button>';
    };

    var dateRangeHtml =
      _wpState.mode === 'week'
        ? '<div style="flex:2;min-width:200px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">هفته</label>' +
          '<select id="wpWeekSel" onchange="window._wpOnWeekChange(this.value)" style="width:100%;'+inp()+'></select></div>'.replace('></select>', '>'+weekOpts+'</select>')
        : _wpState.mode === 'custom'
          ? '<div style="flex:1;min-width:110px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">از</label>' +
            '<input type="text" id="wpCustomStart" placeholder="۱۴۰۴/۰۳/۱۵" value="'+(_wpState.customStart||'')+'" onchange="_wpState.customStart=this.value" style="width:100%;box-sizing:border-box;'+inp()+'></div>' +
            '<div style="flex:1;min-width:110px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">تا</label>' +
            '<input type="text" id="wpCustomEnd" placeholder="۱۴۰۴/۰۳/۱۸" value="'+(_wpState.customEnd||'')+'" onchange="_wpState.customEnd=this.value" style="width:100%;box-sizing:border-box;'+inp()+'></div>'
          : '<div style="flex:1;min-width:180px;padding:9px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:.83rem;color:#15803d;display:flex;align-items:center">📅 ۳ روز کاری از فردا</div>';

    el.innerHTML =
      '<div style="max-width:1100px;margin:0 auto">' +
      '<h2 style="margin:0 0 16px;font-size:1.2rem;font-weight:700;color:#1e293b">📋 تخصیص برنامه هفتگی</h2>' +

      // ── Config card ───────────────────────────────────────────────────────
      '<div style="background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:14px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +

          '<div style="flex:1;min-width:150px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">کارشناس</label>' +
          '<select id="wpExpertSel" onchange="window._wpOnExpertChange(this.value)" style="width:100%;'+inp()+'></select>'.replace('></select>', '>'+expertOpts+'</select>')+'</div>'+

          '<div style="flex:1;min-width:150px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">بازه</label>' +
          '<div style="display:flex;gap:4px">'+modeBtn('week','هفتگی')+modeBtn('3day','۳ روز')+modeBtn('custom','دلخواه')+'</div></div>'+

          dateRangeHtml +

          '<div style="min-width:110px"><label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px">نوع</label>' +
          '<select id="wpActionType" onchange="_wpState.actionType=this.value" style="width:100%;'+inp()+'">' +
            '<option value="call"'+(_wpState.actionType==='call'?' selected':'')+'>📞 تماس</option>' +
            '<option value="visit"'+(_wpState.actionType==='visit'?' selected':'')+'>🤝 ملاقات</option>' +
          '</select></div>' +

          '<button onclick="window._wpLoadCenters()" style="padding:9px 22px;background:#6366f1;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.9rem;cursor:pointer;font-weight:600;white-space:nowrap">بارگذاری مراکز ▼</button>' +

        '</div>' +
      '</div>' +

      // Center list placeholder
      '<div id="wpCenterList"></div>' +

      '</div>';
  };

  // ── render list with filters ──────────────────────────────────────────────

  function _wpRenderList(range) {
    var el = document.getElementById('wpCenterList');
    if (!el) return;

    var workDays = _workDays(range.start, range.end);
    var members = typeof _DEFAULT_MEMBERS !== 'undefined' ? _DEFAULT_MEMBERS : [];
    var expertMember = members.find(function(u){ return u.id === _wpState.expertId; });
    var expertName = expertMember ? expertMember.name : _wpState.expertId;

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

    var provOpts = '<option value="">همه استان‌ها</option>' +
      Object.keys(provSet).map(function(pid) {
        return '<option value="'+esc(pid)+'"'+(_wpState.filterProvId===pid?' selected':'')+'>'+esc(provSet[pid])+'</option>';
      }).join('');

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
        '<div style="display:flex;align-items:center;gap:5px;margin-right:auto">' +
          '<span style="font-size:.75rem;color:#6b7280;white-space:nowrap">مرتب بر اساس:</span>' +
          sel('wpSort', _wpState.sortBy, "window._wpSetFilter('sort',this.value)", sortOpts) +
        '</div>' +
      '</div>';

    // ── table ────────────────────────────────────────────────────────────────
    var selectedKeys = Object.keys(_wpState.selected);
    var selectedCount = selectedKeys.length;

    var tableRows = filtered.map(function(c) {
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

      return '<tr style="border-bottom:1px solid #f1f5f9'+(c.isOverdue?';background:#fff8f8':'')+(c.alreadyScheduled?';opacity:.5':'') + '">' +
        '<td style="padding:8px 10px;width:34px">' +
          '<input type="checkbox"'+(checked?' checked':'')+(c.alreadyScheduled?' disabled title="این بازه برنامه دارد"':'')+
          ' onchange="window._wpToggle(\''+esc(c.rkey)+'\',this.checked)" style="width:16px;height:16px;cursor:pointer">' +
        '</td>' +
        '<td style="padding:8px 10px">' +
          '<div style="font-weight:600;font-size:.88rem">'+esc(c.name)+'</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">'+provTag+(c.status?'<span style="font-size:.68rem;padding:2px 6px;background:#f8fafc;color:#64748b;border-radius:10px;display:inline-block">'+esc(c.status)+'</span>':'')+overdueTag+schedTag+'</div>' +
        '</td>' +
        '<td style="padding:8px 10px;white-space:nowrap;text-align:center">' +
          '<span style="font-size:.85rem;font-weight:700;color:'+potColor(c.potential)+'">P'+c.potential+'</span>' +
        '</td>' +
        '<td style="padding:8px 10px;font-size:.8rem;color:#6b7280;white-space:nowrap">' +
          (c.followupDate ? '<div style="color:'+(c.isOverdue?'#dc2626':'#374151')+';font-weight:'+(c.isOverdue?'700':'400')+'">'+c.followupDate+'</div>' : '') +
          '<div style="color:#94a3b8;font-size:.75rem">'+lastStr+'</div>' +
        '</td>' +
        '<td style="padding:8px 10px;width:155px">' +
          '<select onchange="window._wpSetDay(\''+esc(c.rkey)+'\',this.value)" style="width:100%;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:.78rem">'+dayOpts+'</select>' +
        '</td>' +
      '</tr>';
    }).join('');

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

      previewHtml =
        '<div style="font-size:.83rem;font-weight:600;color:#374151;margin-bottom:8px">پیش‌نمایش توزیع:</div>' +
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
        '<button onclick="window._wpSubmit()" style="padding:10px 28px;background:#10b981;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
          '✅ افزودن '+selectedCount+' مرکز به برنامه' +
        '</button>' +
        '<span style="font-size:.8rem;color:#6b7280;margin-right:12px">برای '+esc(expertName)+' — '+range.start+'</span>';
    }

    el.innerHTML =
      '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">' +

        // top bar
        '<div style="padding:12px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<span style="font-size:.88rem;font-weight:600;color:#374151">'+esc(expertName)+' — '+range.start+' تا '+range.end+' ('+workDays.length+' روز کاری)</span>' +
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

        // table
        '<div style="max-height:460px;overflow-y:auto">' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead style="position:sticky;top:0;z-index:1"><tr style="background:#f8fafc">' +
              '<th style="padding:8px 10px;width:34px"></th>' +
              '<th style="padding:8px 10px;text-align:right;font-size:.78rem;font-weight:600">مرکز</th>' +
              '<th style="padding:8px 10px;text-align:center;font-size:.78rem;font-weight:600">P</th>' +
              '<th style="padding:8px 10px;text-align:right;font-size:.78rem;font-weight:600">پیگیری / آخرین تماس</th>' +
              '<th style="padding:8px 10px;text-align:right;font-size:.78rem;font-weight:600">روز (اختیاری)</th>' +
            '</tr></thead>' +
            '<tbody>'+(tableRows||'<tr><td colspan="5" style="padding:32px;text-align:center;color:#9ca3af">مرکزی با این فیلترها پیدا نشد</td></tr>')+'</tbody>' +
          '</table>' +
        '</div>' +

        '<div id="wpPreviewArea" style="padding:16px 18px;border-top:1px solid #f1f5f9;background:#f0fdf4;display:'+(selectedCount>0?'':'none')+'">'+previewHtml+'</div>' +

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

    var members = typeof _DEFAULT_MEMBERS !== 'undefined' ? _DEFAULT_MEMBERS : [];
    var expertMember = members.find(function(u){ return u.id === _wpState.expertId; });
    var expertName = expertMember ? expertMember.name : _wpState.expertId;

    previewEl.style.display = '';
    previewEl.innerHTML =
      '<div style="font-size:.83rem;font-weight:600;color:#374151;margin-bottom:8px">پیش‌نمایش توزیع:</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
        workDays.map(function(d) {
          var n = (dayBuckets[d]||[]).length;
          return '<div style="flex:1;min-width:80px;background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0;text-align:center">' +
            '<div style="font-size:.7rem;font-weight:700;color:#374151;margin-bottom:3px">'+_dayLabel(d)+'</div>' +
            '<div style="font-size:1.2rem;font-weight:800;color:'+(n>5?'#ef4444':n>0?'#6366f1':'#d1d5db')+'">'+n+'</div>' +
            '<div style="font-size:.65rem;color:#9ca3af">مرکز</div></div>';
        }).join('') +
      '</div>' +
      '<button onclick="window._wpSubmit()" style="padding:10px 28px;background:#10b981;color:white;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:700">' +
        '✅ افزودن '+selectedCount+' مرکز به برنامه' +
      '</button>' +
      '<span style="font-size:.8rem;color:#6b7280;margin-right:12px">برای '+esc(expertName)+' — '+range.start+'</span>';
  }

  // ── event handlers ────────────────────────────────────────────────────────

  window._wpSetMode = function(m) {
    _wpState.mode = m;
    window.renderWeekPlannerPanel();
  };

  window._wpOnExpertChange = function(v) {
    _wpState.expertId = v;
    _wpState.selected = {};
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
    if (key === 'sort')         _wpState.sortBy = val;
    _wpRenderList(_computeRange());
  };

  window._wpLoadCenters = function() {
    var expertId = (document.getElementById('wpExpertSel')||{}).value || _wpState.expertId;
    _wpState.expertId = expertId;
    _wpState.actionType = (document.getElementById('wpActionType')||{}).value || _wpState.actionType;
    if (_wpState.mode === 'custom') {
      _wpState.customStart = ((document.getElementById('wpCustomStart')||{}).value||'').trim();
      _wpState.customEnd   = ((document.getElementById('wpCustomEnd')||{}).value||'').trim();
    }
    if (!expertId) { if (typeof showToast==='function') showToast('کارشناس را انتخاب کنید'); return; }
    var range = _computeRange();
    if (!range.start||!range.end) { if (typeof showToast==='function') showToast('بازه زمانی را تعریف کنید'); return; }
    _loadCenters(expertId);
    _wpState.selected = {};
    _wpState.filterScheduled = 'unscheduled'; // default: show unscheduled
    _wpRenderList(range);
  };

  window._wpToggle = function(rkey, checked) {
    if (checked) { _wpState.selected[rkey] = _wpState.selected[rkey] || ''; }
    else { delete _wpState.selected[rkey]; }
    _wpUpdateSummaryArea();
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
    var actionType = _wpState.actionType || 'call';
    var expertId = _wpState.expertId;

    var entries = [];
    selectedKeys.forEach(function(rkey) {
      var c = _wpState.centers.find(function(x){ return x.rkey === rkey; });
      if (!c) return;
      var scheduledDate = _wpState.selected[rkey] || autoSpread[rkey] || workDays[0] || '';
      entries.push({
        id: 'we_'+Date.now()+'_'+Math.random().toString(36).slice(2,5)+'_'+c.id.slice(-4),
        weekId: weekId, recKey: c.rtype+'_'+c.id,
        rtype: c.rtype, rid: c.id,
        scheduledDate: scheduledDate, actionType: actionType,
        addedBy: expertId, centerName: c.name,
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

})();

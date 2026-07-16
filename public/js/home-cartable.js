/* ═══ Home Cartable — multi-view (list / tree / calendar / kanban / matrix) ═══ */
(function () {
  'use strict';

  var VIEW_OPTS = [
    { id: 'tree', icon: '📍', label: 'درخت مرکز' },
    { id: 'calendar', icon: '📅', label: 'تقویم' },
    { id: 'kanban', icon: '📊', label: 'کانبان' },
    { id: 'list', icon: '📋', label: 'لیست' },
    { id: 'matrix', icon: '🧮', label: 'ماتریس', mgrOnly: true },
  ];

  var _cbState = {
    view: localStorage.getItem('cb_view') || 'tree',
    treeMode: localStorage.getItem('cb_tree_mode') || 'center',
    scope: localStorage.getItem('cb_scope') || 'mine',
    owner: '',
    filter: 'all',
    search: '',
    types: [],
    offset: 0,
    limit: 50,
    loading: false,
    data: null,
    matrixData: null,
    treeTeamData: null,
    subordinates: null,
    expanded: {},
    itemById: {},
  };

  var TYPE_OPTS = [
    { id: 'task', label: 'وظیفه' }, { id: 'week', label: 'برنامه هفته' },
    { id: 'followup', label: 'پیگیری' }, { id: 'proforma', label: 'پیش‌فاکتور' },
    { id: 'notification', label: 'اعلان' }, { id: 'support', label: 'پشتیبانی' },
    { id: 'workflow', label: 'گردش‌کار' }, { id: 'hr_leave', label: 'مرخصی' },
    { id: 'trade_task', label: 'بازرگانی' }, { id: 'letter', label: 'نامه' }, { id: 'mtr', label: 'مطالبات' },
  ];

  function _isMgr() { return typeof _isManager === 'function' && _isManager(); }

  function _userName(id) {
    if (typeof USERS !== 'undefined' && USERS[id]) return USERS[id];
    if (typeof umGetMembers === 'function') {
      var m = umGetMembers().find(function (x) { return x.id === id; });
      if (m) return m.name || id;
    }
    return id;
  }

  function _expertsList() {
    if (_cbState.subordinates && _cbState.subordinates.length) {
      return _cbState.subordinates.map(function (id) { return { id: id, name: _userName(id) }; });
    }
    if (typeof umGetActive !== 'function') return [];
    return umGetActive().filter(function (m) {
      return m.id !== currentUser && m.role !== 'مهمان' && m.role !== 'guest';
    });
  }

  function _today() { return typeof todayStr === 'function' ? todayStr() : ''; }

  function _cmpJ(a, b) { return String(a || '').localeCompare(String(b || '')); }

  function _normJ(s) {
    if (!s) return '';
    var p = String(s).trim().split('/');
    if (p.length < 3) return String(s || '');
    return p[0] + '/' + p2(parseInt(p[1], 10)) + '/' + p2(parseInt(p[2], 10));
  }

  function _jalaliStr(j) { return j[0] + '/' + p2(j[1]) + '/' + p2(j[2]); }

  function _addDays(n) {
    var t = _today().split('/').map(Number);
    var j = jAdd(t[0], t[1], t[2], n);
    return _jalaliStr(j);
  }

  function _daysUntil(targetStr) {
    var today = _today();
    if (targetStr === today) return 0;
    for (var n = 1; n <= 366; n++) {
      var d = _addDays(n);
      if (d === targetStr) return n;
      if (_cmpJ(d, targetStr) > 0) return n;
    }
    return 1;
  }

  function _weekDays() {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(_addDays(i));
    return out;
  }

  function _typeIcon(type) {
    var map = {
      task: '📋', week: '📅', followup: '📌', proforma: '📄',
      notification: '🔔', support: '🎧', workflow: '⚙️', hr_leave: '🏖️',
      trade_task: '📦', letter: '✉️', mtr: '💰',
    };
    return map[type] || '•';
  }

  function _isApproval(item) {
    return item.action === 'proforma_approve' || item.action === 'hr_leave' || item.action === 'letter_sign';
  }

  function _isThisWeek(item) {
    var today = _today();
    var due = _normJ(item.dueAt);
    if (!due || item.urgency === 'overdue' || item.urgency === 'today') return false;
    if (_cmpJ(due, today) <= 0) return false;
    return _daysUntil(due) <= 7;
  }

  function _centerName(item) {
    if (item.centerName && item.centerName !== 'سایر / بدون مرکز' && !/^c \d+$/i.test(item.centerName)) {
      return item.centerName;
    }
    if (item.title && item.title.indexOf(' — ') >= 0) {
      var part = item.title.split(' — ')[0].trim();
      if (part && part.indexOf('پیگیری') !== 0 && !/^pc\s*new/i.test(part) && !/^new\s+\d+$/i.test(part)
          && part !== 'مرکز' && !/^c \d+$/i.test(part)) {
        return part;
      }
    }
    var key = item.centerKey;
    if (key) {
      if (typeof getRecLabel === 'function') {
        var lbl = getRecLabel(key);
        if (lbl && lbl !== key && lbl !== '?' && !/^new\s+\d+$/i.test(lbl)) return lbl;
      }
      if (typeof _getCenterNameFromKey === 'function') {
        var cn = _getCenterNameFromKey(key);
        if (cn && cn !== key) return cn;
      }
    }
    if (key && /^pc_/i.test(key)) return 'پتانسیل جدید';
    if (key) {
      var stripped = String(key).replace(/^(center|pc)_/i, '').replace(/_/g, ' ').trim();
      if (/^new\s+\d+$/i.test(stripped)) return 'پتانسیل جدید';
      if (stripped) return stripped;
    }
    return 'سایر / بدون مرکز';
  }

  function _pickBestCenterName(items, key) {
    var best = '';
    (items || []).forEach(function (it) {
      var n = _centerName(it);
      if (!n || n === 'سایر / بدون مرکز' || n === 'پتانسیل جدید') return;
      if (!best || n.length > best.length) best = n;
    });
    if (best) return best;
    return items && items.length ? _centerName(items[0]) : (key ? _centerName({ centerKey: key }) : 'سایر / بدون مرکز');
  }

  function _groupByCenter(items) {
    var map = {};
    (items || []).forEach(function (item) {
      var key = item.centerKey || '_none';
      if (!map[key]) {
        map[key] = {
          key: key,
          name: _pickBestCenterName([item], key),
          items: [],
          overdueCount: 0,
          maxSeverity: 0,
        };
      }
      map[key].items.push(item);
      map[key].name = _pickBestCenterName(map[key].items, key);
      if (item.urgency === 'overdue') map[key].overdueCount++;
      if (item.severityScore > map[key].maxSeverity) map[key].maxSeverity = item.severityScore;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
      return b.maxSeverity - a.maxSeverity;
    });
  }

  function _severityClass(item) {
    if (item.urgency !== 'overdue') return 'cb-sev-' + (item.urgency || 'pending');
    var d = Number(item.overdueDays) || 1;
    if (d >= 30) return 'cb-sev-critical';
    if (d >= 14) return 'cb-sev-high';
    if (d >= 7) return 'cb-sev-mid';
    return 'cb-sev-low';
  }

  function _urgencyBadge(item) {
    if (item.urgency === 'overdue') {
      return '<span class="cb-badge cb-badge-overdue">' + (Number(item.overdueDays) || 1) + ' روز تأخیر</span>';
    }
    if (item.urgency === 'today') return '<span class="cb-badge cb-badge-today">امروز</span>';
    return '';
  }

  function _indexItems(items) {
    _cbState.itemById = {};
    (items || []).forEach(function (it) { _cbState.itemById[it.id] = it; });
  }

  function _itemHasReportAction(item) {
    return item && (item.action === 'week' || item.action === 'followup' || item.type === 'followup' || (item.action === 'center' && item.centerKey));
  }

  function _cbIsFollowupItem(item) {
    return item && (item.type === 'followup' || item.action === 'followup' || (item.action === 'center' && item.centerKey));
  }

  function _cbOpenFollowupInteraction(item) {
    if (!item || typeof openCenterInteraction !== 'function') return;
    var ckey = item.centerKey || (item.meta && item.meta.centerKey) || '';
    if (!ckey) return;
    openCenterInteraction({
      centerKey: ckey,
      centerName: _centerName(item),
      actionType: 'followup',
    });
  }

  function _centerNameLink(name, centerKey) {
    if (!centerKey || centerKey === '_none') return esc(name);
    return '<button type="button" class="cb-center-link" onclick="_cbOpenCenterProfile(event,\'' + esc(centerKey) + '\')" title="پروفایل مرکز">' + esc(name) + '</button>';
  }

  function _miniDetailText(item, cname) {
    var title = item.title || '';
    if (cname && title.indexOf(cname) === 0) {
      var rest = title.slice(cname.length).replace(/^[\s—\-]+/, '').trim();
      if (rest) return esc(rest);
    }
    if (item.subtitle) return esc(item.subtitle);
    return '';
  }

  window._cbOpenCenterProfile = function (e, centerKey) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!centerKey || typeof openCenterModal !== 'function') return;
    if (typeof parseCenterRef === 'function') {
      var ref = parseCenterRef(null, centerKey);
      if (ref && ref.rid) { openCenterModal(ref.rtype, ref.rid, centerKey); return; }
    }
    var parts = String(centerKey).split('_');
    if (parts.length >= 2) openCenterModal(parts[0], parts.slice(1).join('_'), centerKey);
  };

  window._cbForceInboxFilterAll = function () {
    _cbState.filter = 'all';
    _cbState.offset = 0;
  };

  function _cbOpenItem(item) {
    if (!item) return;
    var meta = item.meta || {};
    switch (item.action) {
      case 'task':
        if (typeof openTaskModal === 'function') openTaskModal(meta.taskId);
        else if (typeof switchTab === 'function') switchTab('tasks');
        break;
      case 'week':
        if (typeof openCenterInteraction === 'function') {
          var rt = meta.rtype || 'center';
          var rd = meta.rid || '';
          if (meta.recKey && typeof parseCenterRef === 'function') {
            var wref = parseCenterRef(null, meta.recKey);
            rt = wref.rtype;
            rd = wref.rid;
          }
          var weekEntryKey = '';
          if (meta.weekId && DB && DB.weekEntries) {
            Object.keys(DB.weekEntries).some(function (k) {
              if (DB.weekEntries[k].sqlId === meta.weekId) { weekEntryKey = k; return true; }
              return false;
            });
          }
          openCenterInteraction({
            rtype: rt,
            rid: rd,
            centerName: (item && item.title) || '',
            weekEntryKey: weekEntryKey,
            actionType: 'call',
          });
        } else if (meta.rtype && meta.rid && typeof quickCallLog === 'function') {
          quickCallLog(meta.rtype, meta.rid);
        } else if (typeof switchTab === 'function') switchTab('weekplan');
        break;
      case 'followup':
        _cbOpenFollowupInteraction(item);
        break;
      case 'center':
        if (_cbIsFollowupItem(item)) {
          _cbOpenFollowupInteraction(item);
        } else if (meta.centerKey && typeof openCenterModal === 'function') {
          var parts = String(meta.centerKey).split('_');
          if (parts.length >= 2) openCenterModal(parts[0], parts.slice(1).join('_'));
        } else if (typeof switchTab === 'function') switchTab('provinces');
        break;
      case 'proforma':
      case 'proforma_approve':
        if (meta.pfId && typeof pfOpenEdit === 'function') {
          if (typeof switchTab === 'function') switchTab('proforma');
          setTimeout(function () { pfOpenEdit(meta.pfId); }, 200);
        } else if (typeof switchTab === 'function') switchTab('proforma');
        break;
      case 'support':
        if (meta.ticketId && typeof window._spOpenTicket === 'function') {
          if (typeof switchTab === 'function') switchTab('support');
          setTimeout(function () { window._spOpenTicket(meta.ticketId); }, 200);
        } else if (typeof switchTab === 'function') switchTab('support');
        break;
      case 'workflow':
        if (meta.wfId && typeof openWfInstanceDetail === 'function') {
          if (typeof switchTab === 'function') switchTab('workflows');
          setTimeout(function () { openWfInstanceDetail(meta.wfId); }, 200);
        } else if (typeof switchTab === 'function') switchTab('workflows');
        break;
      case 'hr_leave':
        if (typeof switchTab === 'function') switchTab('hr');
        if (meta.leaveId && typeof window._hrOpenLeaveById === 'function') {
          setTimeout(function () { window._hrOpenLeaveById(meta.leaveId); }, 350);
        }
        break;
      case 'letter_pending':
      case 'letter_sign':
      case 'letter_followup':
        if (typeof switchTab === 'function') switchTab('letters');
        break;
      case 'mtr':
        if (typeof switchTab === 'function') switchTab('mtr');
        break;
      case 'trade_task':
        if (typeof switchTab === 'function') switchTab('trade-kpi');
        break;
      case 'notification':
        if (meta.notifId) {
          fetch('/api/notifications/' + encodeURIComponent(meta.notifId) + '/read', { method: 'PUT' }).catch(function () {});
        }
        if (item.centerKey && typeof openCenterModal === 'function') {
          var p = String(item.centerKey).split('_');
          if (p.length >= 2) openCenterModal(p[0], p.slice(1).join('_'));
        }
        break;
      default:
        if (typeof switchTab === 'function') switchTab('tasks');
    }
  }
  window._cbOpenItem = _cbOpenItem;

  window._cbOpenById = function (id) { _cbOpenItem(_cbState.itemById[id]); };

  window._cbOpenByIdx = function (idx) {
    if (!_cbState.data || !_cbState.data.items || !_cbState.data.items[idx]) return;
    _cbOpenItem(_cbState.data.items[idx]);
  };

  window._cbToggleNode = function (key) {
    _cbState.expanded[key] = !_cbState.expanded[key];
    _refreshViewOnly();
  };

  window._cbQuickComplete = function (e, itemId) {
    if (e) e.stopPropagation();
    var _doneItem = _cbState.itemById && _cbState.itemById[itemId];
    fetch('/api/inbox/actions/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () {
        if (_doneItem && _doneItem.centerKey && typeof window.markNotifsForCenterRead === 'function') {
          window.markNotifsForCenterRead(_doneItem.centerKey);
        }
        renderHomeCartable();
      })
      .catch(function (err) { alert(err.message || 'خطا'); });
  };

  window._cbQuickSnooze = function (e, itemId, days) {
    if (e) e.stopPropagation();
    fetch('/api/inbox/actions/snooze', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId, days: days != null ? days : 1 }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function (d) {
        if (typeof showToast === 'function') {
          showToast('⏸ فقط نمایش کارتابل به‌تأخیر افتاد — تاریخ پیگیری مرکز عوض نشد' + (d.snoozedUntil ? ' (تا ' + d.snoozedUntil + ')' : ''), 4000);
        }
        if (typeof _cbRefreshInboxLive === 'function') _cbRefreshInboxLive();
        else renderHomeCartable();
      })
      .catch(function (err) { alert(err.message || 'خطا'); });
  };

  window._cbCalReschedule = function (e, dayStr) {
    if (e) e.preventDefault();
    var itemId = e.dataTransfer.getData('text/plain');
    var item = _cbState.itemById[itemId];
    if (!item || !dayStr) return;
    var normDay = _normJ(dayStr);
    if (_cbIsFollowupItem(item)) {
      var ckey = item.centerKey || (item.meta && item.meta.centerKey);
      if (!ckey || typeof patchCenterField !== 'function') return;
      patchCenterField(ckey, 'followupDate', normDay, { centerName: _centerName(item) })
        .then(function (res) {
          if (res && res.inboxWarning && typeof showToast === 'function') showToast('⚠ ' + res.inboxWarning, 5000);
          else if (typeof showToast === 'function') showToast('✓ تاریخ پیگیری به ' + normDay + ' منتقل شد');
          if (typeof _scheduleInboxRefresh === 'function') _scheduleInboxRefresh();
        })
        .catch(function () { if (typeof showToast === 'function') showToast('خطا در تغییر تاریخ پیگیری'); });
      return;
    }
    if (item.type === 'week' && item.meta && item.meta.weekId) {
      fetch('/api/week-entries/' + encodeURIComponent(item.meta.weekId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: normDay }),
      }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'خطا'); return d; }); })
        .then(function () {
          if (typeof showToast === 'function') showToast('✓ برنامه هفته به ' + normDay + ' منتقل شد');
          if (typeof _scheduleInboxRefresh === 'function') _scheduleInboxRefresh();
        })
        .catch(function (err) { if (typeof showToast === 'function') showToast('⚠ ' + (err.message || 'خطا در جابجایی برنامه هفته')); });
      return;
    }
    if (typeof showToast === 'function') {
      showToast('فقط پیگیری و برنامه هفته با کشیدن روی روز قابل جابجایی هستند — برای سایر موارد از 🕐 (به‌تعویق نمایش) استفاده کنید', 4500);
    }
  };

  window._cbDragStart = function (e, itemId) {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  window._cbDragOver = function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  window._cbKanbanDrop = function (e, col) {
    e.preventDefault();
    var itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    var days = col === 'today' ? 0 : col === 'week' ? 3 : 1;
    window._cbQuickSnooze(null, itemId, days);
  };

  // legacy alias — تقویم از reschedule واقعی استفاده می‌کند نه snooze
  window._cbCalDrop = window._cbCalReschedule;

  window._cbMatrixDrill = function (username, bucket) {
    _cbState.view = 'list';
    _cbState.scope = username === currentUser ? 'mine' : 'team';
    _cbState.owner = username === currentUser ? '' : username;
    _cbState.filter = bucket === 'week' ? 'week' : bucket;
    _cbState.offset = 0;
    localStorage.setItem('cb_view', 'list');
    renderHomeCartable(_cbState.scope);
  };

  window._cbPanic = function () {
    if (!_isMgr() || _cbState.scope !== 'team' || !_cbState.owner) {
      alert('ابتدا کارشناس را در حالت «کارهای کارشناس» انتخاب کنید');
      return;
    }
    var toOwner = prompt('انتقال همه کارهای «' + _userName(_cbState.owner) + '» به کدام کارشناس؟ (نام کاربری)');
    if (!toOwner || toOwner === _cbState.owner) return;
    fetch('/api/inbox/panic', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromOwner: _cbState.owner, toOwner: toOwner.trim() }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function (d) {
        alert('انجام شد — وظایف: ' + (d.reassigned && d.reassigned.tasks) + ' · هفته: ' + (d.reassigned && d.reassigned.weeks));
        renderHomeCartable('team');
      })
      .catch(function (err) { alert(err.message || 'خطا'); });
  };

  window._cbSetView = function (v) {
    _cbState.view = v;
    _cbState.offset = 0;
    localStorage.setItem('cb_view', v);
    renderHomeCartable();
  };

  window._cbSetTreeMode = function (m) {
    _cbState.treeMode = m;
    localStorage.setItem('cb_tree_mode', m);
    renderHomeCartable();
  };

  function _buildViewSwitcher() {
    return '<div class="cb-view-tabs">' + VIEW_OPTS.map(function (v) {
      if (v.mgrOnly && !_isMgr()) return '';
      return '<button type="button" class="cb-view-btn' + (_cbState.view === v.id ? ' active' : '') +
        '" onclick="_cbSetView(\'' + v.id + '\')" title="' + esc(v.label) + '">' + v.icon + ' ' + esc(v.label) + '</button>';
    }).join('') + '</div>';
  }

  function _showOwnerTag() {
    return _cbState.scope === 'all';
  }

  function _ownerTag(item) {
    if (!_showOwnerTag() || !item || !item.owner) return '';
    return '<span class="cb-owner-tag">' + esc(_userName(item.owner)) + '</span>';
  }

  function _buildToolbar() {
    var mgr = _isMgr();
    var experts = _expertsList();
    var ownerOpts = experts.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (_cbState.owner === m.id ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
    }).join('');

    var scopeTabs = '';
    if (mgr && _cbState.view !== 'matrix') {
      scopeTabs = '<div class="cb-scope-tabs">' +
        '<button type="button" class="cb-scope-btn' + (_cbState.scope === 'mine' ? ' active' : '') + '" onclick="renderHomeCartable(\'mine\')">👤 من</button>' +
        '<button type="button" class="cb-scope-btn' + (_cbState.scope === 'all' ? ' active' : '') + '" onclick="renderHomeCartable(\'all\')" title="من + همه کارشناس‌ها">🌐 همه</button>' +
        '<button type="button" class="cb-scope-btn' + (_cbState.scope === 'team' ? ' active' : '') + '" onclick="renderHomeCartable(\'team\')">👥 کارشناس</button>' +
      '</div>';
    }

    var teamPick = '';
    if (mgr && _cbState.scope === 'team' && _cbState.view !== 'matrix') {
      teamPick = '<select class="cb-owner-select form-input" onchange="_cbSetOwner(this.value)">' +
        '<option value="">— کارشناس —</option>' + ownerOpts + '</select>' +
        '<button type="button" class="cb-panic-btn" onclick="_cbPanic()">🚨 Panic</button>';
    }

    var treeMode = '';
    if (_cbState.view === 'tree' && mgr) {
      treeMode = '<div class="cb-tree-mode">' +
        '<button type="button" class="cb-tree-mode-btn' + (_cbState.treeMode === 'center' ? ' active' : '') + '" onclick="_cbSetTreeMode(\'center\')">بر اساس مرکز</button>' +
        '<button type="button" class="cb-tree-mode-btn' + (_cbState.treeMode === 'team' ? ' active' : '') + '" onclick="_cbSetTreeMode(\'team\')">کارشناس › مرکز</button>' +
      '</div>';
    }

    var filters = ['all', 'overdue', 'today', 'approval'];
    var filterLabels = { all: 'همه', overdue: 'معوق', today: 'امروز', approval: 'تأییدات' };
    var filterHtml = _cbState.view === 'matrix' ? '' : filters.map(function (f) {
      if (f === 'approval' && !mgr) return '';
      return '<button type="button" class="cb-filter-btn' + (_cbState.filter === f ? ' active' : '') + '" onclick="_cbSetFilter(\'' + f + '\')">' + filterLabels[f] + '</button>';
    }).join('') +
      '<button type="button" class="cb-filter-reset" onclick="_cbResetFilters()" title="پاک کردن فیلترها">✕</button>';

    var typeChips = _cbState.view === 'matrix' ? '' : TYPE_OPTS.map(function (t) {
      var on = _cbState.types.indexOf(t.id) >= 0;
      return '<button type="button" class="cb-type-chip' + (on ? ' on' : '') + '" onclick="_cbToggleType(\'' + t.id + '\')">' + t.label + '</button>';
    }).join('');

    return '<div class="cb-toolbar">' + _buildViewSwitcher() + scopeTabs + teamPick + treeMode +
      (_cbState.view !== 'matrix' ? '<div class="cb-search-row"><input class="cb-search form-input" placeholder="جستجو..." value="' + esc(_cbState.search) + '" oninput="_cbSetSearch(this.value)" /></div>' : '') +
      (_cbState.view !== 'matrix' ? '<div class="cb-filter-row">' + filterHtml + '</div>' : '') +
      (_cbState.view !== 'matrix' && typeChips ? '<div class="cb-type-row">' + typeChips + '</div>' : '') +
      '<button type="button" class="cb-refresh-btn" onclick="renderHomeCartable()" title="بروزرسانی">🔄</button></div>';
  }

  window._cbSetOwner = function (id) { _cbState.owner = id || ''; _cbState.offset = 0; renderHomeCartable('team'); };
  window._cbSetFilter = function (f) { _cbState.filter = f || 'all'; _cbState.offset = 0; renderHomeCartable(); };
  window._cbResetFilters = function () {
    _cbState.filter = 'all';
    _cbState.search = '';
    _cbState.types = [];
    _cbState.offset = 0;
    renderHomeCartable();
  };
  window._cbSetSearch = function (v) {
    _cbState.search = v || ''; _cbState.offset = 0;
    clearTimeout(window._cbSearchT);
    window._cbSearchT = setTimeout(function () { renderHomeCartable(); }, 350);
  };
  window._cbToggleType = function (t) {
    var i = _cbState.types.indexOf(t);
    if (i >= 0) _cbState.types.splice(i, 1); else _cbState.types.push(t);
    _cbState.offset = 0; renderHomeCartable();
  };
  window._cbPage = function (dir) {
    var total = (_cbState.data && _cbState.data.total) || 0;
    var next = _cbState.offset + dir * _cbState.limit;
    if (next < 0 || next >= total) return;
    _cbState.offset = next;
    _loadData();
  };

  function _renderMini(item, draggable, showDue) {
    var canDrag = draggable && (item.canSnooze || _cbIsFollowupItem(item) || item.type === 'week');
    var drag = canDrag ? ' draggable="true" ondragstart="_cbDragStart(event,\'' + esc(item.id) + '\')"' : '';
    var ckey = item.centerKey;
    var cname = _centerName(item);
    var nameHtml;
    if (item.type === 'notification') {
      var noteLines = (item.title || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var head = (noteLines[0] || '').replace(/^⚠️\s*/, '').trim();
      var more = noteLines.length > 1
        ? '<div class="cb-mini-note-more">' + esc(noteLines.slice(1, 4).join(' · ')) + (noteLines.length > 4 ? '…' : '') + '</div>'
        : '';
      nameHtml = '<span class="cb-mini-note-head">' + esc(head) + '</span>' + more;
    } else if (ckey && ckey !== '_none') {
      nameHtml = _centerNameLink(cname, ckey);
    } else {
      nameHtml = esc(item.title);
    }
    var detail = (ckey && ckey !== '_none' && item.type !== 'notification') ? _miniDetailText(item, cname) : '';
    var dueTag = (showDue && item.dueAt)
      ? '<span class="cb-mini-due">' + esc(_normJ(item.dueAt)) + '</span>' : '';
    var typeTag = '<span class="cb-mini-type">' + esc(item.typeLabel || item.type || '') + '</span>';
    var reportBtn = _itemHasReportAction(item)
      ? '<button type="button" class="cb-mini-act" title="ثبت تماس / گزارش" onclick="event.stopPropagation();_cbOpenById(\'' + esc(item.id) + '\')">📞</button>'
      : '';
    return '<div class="cb-mini ' + _severityClass(item) + '"' + drag + ' onclick="_cbOpenById(\'' + esc(item.id) + '\')" role="button">' +
      '<div class="cb-mini-top">' +
        '<span class="cb-mini-ico">' + _typeIcon(item.type) + '</span>' +
        typeTag + dueTag + _ownerTag(item) + _urgencyBadge(item) +
      '</div>' +
      '<div class="cb-mini-name">' + nameHtml + '</div>' +
      (detail ? '<div class="cb-mini-detail">' + detail + '</div>' : '') +
      (reportBtn ? '<div class="cb-mini-foot">' + reportBtn + '</div>' : '') +
    '</div>';
  }

  function _renderItemTitle(item) {
    var ckey = item.centerKey;
    var cname = _centerName(item);
    if (ckey && ckey !== '_none' && item.title && item.title.indexOf(cname) >= 0) {
      var suffix = item.title.replace(cname, '').replace(/^[\s—\-]+/, '').trim();
      return _centerNameLink(cname, ckey) + (suffix ? '<span class="cb-item-title-sub"> — ' + esc(suffix) + '</span>' : '');
    }
    if (ckey && ckey !== '_none') return _centerNameLink(cname, ckey);
    return esc(item.title);
  }

  function _renderItem(item, idx) {
    var actions = '';
    if (_itemHasReportAction(item)) {
      actions += '<button type="button" class="cb-act cb-act-report" title="ثبت تماس / گزارش" onclick="event.stopPropagation();_cbOpenById(\'' + esc(item.id) + '\')">📞</button>';
    }
    if (item.canQuickComplete) actions += '<button type="button" class="cb-act cb-act-ok" title="تکمیل" onclick="_cbQuickComplete(event,\'' + esc(item.id) + '\')">✓</button>';
    if (item.canSnooze) actions += '<button type="button" class="cb-act cb-act-snooze" title="به‌تعویق نمایش (تاریخ مرکز عوض نمی‌شود)" onclick="_cbQuickSnooze(event,\'' + esc(item.id) + '\',1)">🕐</button>';
    var valHint = (item.monetaryValue > 0 && (item.type === 'proforma' || item.type === 'mtr'))
      ? '<span class="cb-val">' + Number(item.monetaryValue).toLocaleString('fa-IR') + '</span>' : '';
    return '<div class="cb-item ' + _severityClass(item) + '" onclick="_cbOpenByIdx(' + idx + ')" role="button">' +
      '<div class="cb-item-icon">' + _typeIcon(item.type) + '</div><div class="cb-item-body">' +
      '<div class="cb-item-top"><span class="cb-item-type">' + esc(item.typeLabel) + '</span>' + _ownerTag(item) + _urgencyBadge(item) + valHint +
      (item.dueAt ? '<span class="cb-item-due">' + esc(item.dueAt) + '</span>' : '') + '</div>' +
      '<div class="cb-item-title">' + _renderItemTitle(item) + '</div>' +
      (item.subtitle ? '<div class="cb-item-sub">' + esc(item.subtitle) + '</div>' : '') +
      '</div><div class="cb-item-actions">' + actions + '</div><div class="cb-item-arrow">‹</div></div>';
  }

  function _renderList(data) {
    if (!data || !data.items || !data.items.length) return '<div class="cb-empty">✨ کارتابل خالی است</div>';
    var today = _today();
    var lanes = { overdue: [], today: [], upcoming: [], other: [] };
    data.items.forEach(function (item) {
      var due = _normJ(item.dueAt);
      if (item.urgency === 'overdue') lanes.overdue.push(item);
      else if (item.urgency === 'today') lanes.today.push(item);
      else if (due && _cmpJ(due, today) > 0 && _daysUntil(due) <= 14) lanes.upcoming.push(item);
      else lanes.other.push(item);
    });
    var html = '';
    [{ k: 'overdue', l: '🔴 معوق' }, { k: 'today', l: '🔵 امروز' }, { k: 'upcoming', l: '📅 پیش‌رو' }, { k: 'other', l: '📋 سایر' }].forEach(function (lane) {
      if (!lanes[lane.k].length) return;
      html += '<div class="cb-lane cb-lane-' + lane.k + '"><div class="cb-lane-hdr">' + lane.l + ' <span class="cb-lane-n">' + lanes[lane.k].length + '</span></div>';
      lanes[lane.k].forEach(function (item) { html += _renderItem(item, data.items.indexOf(item)); });
      html += '</div>';
    });
    return html;
  }

  function _renderTreeCenter(data) {
    var centers = _groupByCenter(data.items || []);
    if (!centers.length) return '<div class="cb-empty">✨ کارتابل خالی است</div>';
    var html = '<div class="cb-tree">';
    if (_cbState.scope === 'team' && data.targetUser) {
      html += '<div class="cb-tree-expert-hdr">👤 ' + esc(_userName(data.targetUser)) + '</div>';
    }
    centers.forEach(function (c) {
      var nkey = 'c:' + c.key;
      var open = _cbState.expanded[nkey] !== false;
      var hot = c.overdueCount > 0 ? ' cb-tree-hot' : '';
      html += '<div class="cb-tree-node' + hot + '">' +
        '<div class="cb-tree-row" onclick="_cbToggleNode(\'' + esc(nkey) + '\')">' +
          '<span class="cb-tree-caret">' + (open ? '▼' : '◀') + '</span>' +
          '<span class="cb-tree-ico">📍</span>' +
          '<span class="cb-tree-label">' + (c.key && c.key !== '_none' ? _centerNameLink(c.name, c.key) : esc(c.name)) + '</span>' +
          (c.overdueCount ? '<span class="cb-tree-badge cb-tree-badge-red">' + c.overdueCount + ' معوق</span>' : '') +
          '<span class="cb-tree-badge">' + c.items.length + '</span>' +
        '</div>';
      if (open) {
        html += '<div class="cb-tree-children">';
        c.items.forEach(function (item) { html += _renderMini(item, true); });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _applyViewFilters(items) {
    var out = items || [];
    var f = _cbState.filter || 'all';
    if (f === 'overdue') out = out.filter(function (it) { return it.urgency === 'overdue'; });
    else if (f === 'today') out = out.filter(function (it) { return it.urgency === 'today'; });
    else if (f === 'approval') out = out.filter(function (it) { return _isApproval(it); });
    if (_cbState.types.length) {
      out = out.filter(function (it) { return _cbState.types.indexOf(it.type) >= 0; });
    }
    if (_cbState.search) {
      var q = String(_cbState.search).trim().toLowerCase();
      out = out.filter(function (it) {
        return (it.title || '').toLowerCase().includes(q)
          || (it.subtitle || '').toLowerCase().includes(q)
          || (it.centerKey || '').toLowerCase().includes(q)
          || (it.owner || '').toLowerCase().includes(q);
      });
    }
    return out;
  }

  function _renderTreeTeam(treeData) {
    if (!treeData || !treeData.experts || !treeData.experts.length) {
      return '<div class="cb-empty">داده‌ای برای نمایش تیم نیست</div>';
    }
    var html = '<div class="cb-tree">';
    treeData.experts.forEach(function (ex) {
      var ekey = 'e:' + ex.username;
      var eopen = _cbState.expanded[ekey] !== false;
      var filteredCenters = (ex.centers || []).map(function (c) {
        var items = _applyViewFilters(c.items);
        if (!items.length) return null;
        return {
          centerKey: c.centerKey,
          centerName: c.centerName,
          items: items,
          overdueCount: items.filter(function (it) { return it.urgency === 'overdue'; }).length,
        };
      }).filter(Boolean);
      if (!filteredCenters.length) return;
      var exOverdue = filteredCenters.reduce(function (s, c) { return s + c.overdueCount; }, 0);
      var exTotal = filteredCenters.reduce(function (s, c) { return s + c.items.length; }, 0);
      html += '<div class="cb-tree-node' + (exOverdue ? ' cb-tree-hot' : '') + '">' +
        '<div class="cb-tree-row cb-tree-expert" onclick="_cbToggleNode(\'' + esc(ekey) + '\')">' +
          '<span class="cb-tree-caret">' + (eopen ? '▼' : '◀') + '</span> 👤 <span class="cb-tree-label">' +
            esc(_userName(ex.username)) + (ex.isSelf ? ' <span class="cb-owner-tag">من</span>' : '') +
          '</span>' +
          (exOverdue ? '<span class="cb-tree-badge cb-tree-badge-red">' + exOverdue + ' معوق</span>' : '') +
          '<span class="cb-tree-badge">' + exTotal + '</span></div>';
      if (eopen) {
        filteredCenters.forEach(function (c) {
          var ckey = ekey + ':c:' + (c.centerKey || '_none');
          var copen = _cbState.expanded[ckey] !== false;
          html += '<div class="cb-tree-node cb-tree-indent' + (c.overdueCount ? ' cb-tree-hot' : '') + '">' +
            '<div class="cb-tree-row" onclick="_cbToggleNode(\'' + esc(ckey) + '\')">' +
              '<span class="cb-tree-caret">' + (copen ? '▼' : '◀') + '</span> 📍 <span class="cb-tree-label">' +
                (c.centerKey && c.centerKey !== '_none' ? _centerNameLink(c.centerName, c.centerKey) : esc(c.centerName)) +
              '</span>' +
              (c.overdueCount ? '<span class="cb-tree-badge cb-tree-badge-red">' + c.overdueCount + '</span>' : '') +
              '<span class="cb-tree-badge">' + c.items.length + '</span></div>';
          if (copen) {
            html += '<div class="cb-tree-children">';
            c.items.forEach(function (item) { html += _renderMini(item, true, true); });
            html += '</div>';
          }
          html += '</div>';
        });
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderTree(data) {
    if (_isMgr() && (_cbState.treeMode === 'team' || _cbState.scope === 'all') && _cbState.treeTeamData) {
      return _renderTreeTeam(_cbState.treeTeamData);
    }
    return _renderTreeCenter(data);
  }

  function _isScheduledCartableItem(item) {
    return item && (item.type === 'followup' || item.type === 'week' || item.type === 'task');
  }

  function _calendarTypesParam() {
    if (_cbState.types.length) return _cbState.types.join(',');
    if (_cbState.view === 'calendar') return 'followup,week,task';
    return '';
  }

  function _renderCalendar(data) {
    var items = data.items || [];
    var days = _weekDays();
    var today = _today();
    var byDay = {};
    days.forEach(function (d) { byDay[d] = []; });
    var overdueBacklog = [];
    var farFuture = [];
    var alerts = [];

    items.forEach(function (item) {
      if (item.type === 'notification' || item.type === 'support' || item.type === 'letter') {
        alerts.push(item);
        return;
      }
      var due = _normJ(item.dueAt);
      if (!due) {
        if (_isScheduledCartableItem(item)) overdueBacklog.push(item);
        else alerts.push(item);
        return;
      }
      if (_cmpJ(due, today) < 0) {
        overdueBacklog.push(item);
        return;
      }
      if (byDay[due]) {
        byDay[due].push(item);
      } else if (_cmpJ(due, days[6]) > 0) {
        farFuture.push(item);
      } else {
        overdueBacklog.push(item);
      }
    });

    var html = '<div class="cb-cal-wrap"><div class="cb-cal-backlog" ondragover="_cbDragOver(event)">' +
      '<div class="cb-cal-backlog-hdr">🔴 معوق <span>' + overdueBacklog.length + '</span></div>' +
      '<div class="cb-cal-backlog-list">';
    overdueBacklog.forEach(function (item) { html += _renderMini(item, true, true); });
    html += '</div>';
    if (farFuture.length) {
      html += '<div class="cb-cal-future-hdr">📅 بعد از این هفته <span>' + farFuture.length + '</span></div>' +
        '<div class="cb-cal-backlog-list">';
      farFuture.forEach(function (item) { html += _renderMini(item, true, true); });
      html += '</div>';
    }
    if (alerts.length) {
      html += '<div class="cb-cal-alerts-hdr">🔔 اعلان <span>' + alerts.length + '</span></div>' +
        '<div class="cb-cal-backlog-list">';
      alerts.forEach(function (item) { html += _renderMini(item, false, false); });
      html += '</div>';
    }
    html += '<p class="cb-cal-hint">کشیدن روی روز = تغییر تاریخ پیگیری / برنامه هفته · 🕐 = فقط به‌تعویق نمایش در کارتابل</p></div><div class="cb-cal-grid">';
    days.forEach(function (d, i) {
      var labels = ['امروز', 'فردا', '+۲', '+۳', '+۴', '+۵', '+۶'];
      var n = (byDay[d] || []).length;
      html += '<div class="cb-cal-col' + (d === today ? ' cb-cal-today' : '') + '" ondragover="_cbDragOver(event)" ondrop="_cbCalReschedule(event,\'' + esc(d) + '\')">' +
        '<div class="cb-cal-day-hdr"><span>' + labels[i] + (n ? ' · ' + n : '') + '</span><code>' + esc(d) + '</code></div>' +
        '<div class="cb-cal-day-body">';
      (byDay[d] || []).forEach(function (item) { html += _renderMini(item, true, true); });
      html += '</div></div>';
    });
    html += '</div></div>';
    return html;
  }

  function _renderKanban(data) {
    var items = data.items || [];
    var cols = {
      overdue: { label: '🔴 معوق', items: [] },
      today: { label: '🔵 امروز', items: [] },
      week: { label: '📆 این هفته', items: [] },
      approval: { label: '✅ تأییدات', items: [] },
    };
    items.forEach(function (item) {
      if (_isApproval(item)) cols.approval.items.push(item);
      else if (item.urgency === 'overdue') cols.overdue.items.push(item);
      else if (item.urgency === 'today') cols.today.items.push(item);
      else if (_isThisWeek(item)) cols.week.items.push(item);
      else cols.week.items.push(item);
    });
    var html = '<div class="cb-kanban">';
    ['overdue', 'today', 'week', 'approval'].forEach(function (k) {
      if (k === 'approval' && !cols.approval.items.length && !_isMgr()) return;
      html += '<div class="cb-kan-col cb-kan-' + k + '" ondragover="_cbDragOver(event)" ondrop="_cbKanbanDrop(event,\'' + k + '\')">' +
        '<div class="cb-kan-hdr">' + cols[k].label + ' <span>' + cols[k].items.length + '</span></div>' +
        '<div class="cb-kan-body">';
      cols[k].items.forEach(function (item) { html += _renderMini(item, true); });
      html += '</div></div>';
    });
    html += '</div><p class="cb-cal-hint">کانبان: کشیدن بین ستون‌ها = به‌تعویق نمایش (تاریخ مرکز عوض نمی‌شود)</p>';
    return html;
  }

  function _renderWarnings(data) {
    var list = (data && data.warnings) || [];
    if (!list.length) return '';
    return list.map(function (w) {
      return '<div class="cb-warn-banner">⚠️ ' + esc(w.message || w.code || '') + '</div>';
    }).join('');
  }

  function _updateWarnings(data) {
    var el = document.getElementById('cbPartialBanner');
    if (el) el.innerHTML = _renderWarnings(data);
  }

  function _heatClass(n) {
    if (!n) return 'cb-mx-z';
    if (n >= 5) return 'cb-mx-h4';
    if (n >= 3) return 'cb-mx-h3';
    if (n >= 2) return 'cb-mx-h2';
    return 'cb-mx-h1';
  }

  function _renderMatrix(matrixData) {
    if (!matrixData || !matrixData.rows || !matrixData.rows.length) {
      return '<div class="cb-empty">داده‌ای برای ماتریس تیم نیست</div>';
    }
    var cols = [
      { k: 'overdue', l: 'معوق' }, { k: 'today', l: 'امروز' },
      { k: 'approval', l: 'تأیید' }, { k: 'week', l: 'این هفته' },
    ];
    var html = '<div class="cb-matrix-wrap"><table class="cb-matrix"><thead><tr><th>کارشناس</th>';
    cols.forEach(function (c) { html += '<th>' + c.l + '</th>'; });
    html += '<th>کل</th></tr></thead><tbody>';
    matrixData.rows.forEach(function (row) {
      html += '<tr class="' + (row.isSelf ? 'cb-mx-self' : '') + '"><td class="cb-mx-name">👤 ' + esc(_userName(row.username)) + '</td>';
      cols.forEach(function (c) {
        var n = row[c.k] || 0;
        html += '<td class="cb-mx-cell ' + _heatClass(n) + '"' + (n ? ' onclick="_cbMatrixDrill(\'' + esc(row.username) + '\',\'' + c.k + '\')" role="button"' : '') + '>' +
          (n ? '<span class="cb-mx-dot">' + n + '</span>' : '·') + '</td>';
      });
      html += '<td class="cb-mx-total">' + (row.total || 0) + '</td></tr>';
    });
    html += '</tbody></table><p class="cb-cal-hint">کلیک روی سلول = drill-down به لیست فیلترشده</p></div>';
    return html;
  }

  function _renderStats(data) {
    if (!data || !data.counts) return '';
    var c = data.counts;
    var items = (data.items || []);
    if (_cbState.view === 'calendar') {
      var today = _today();
      var calOverdue = 0;
      var calToday = 0;
      var calUpcoming = 0;
      items.forEach(function (item) {
        if (!_isScheduledCartableItem(item)) return;
        var due = _normJ(item.dueAt);
        if (!due || _cmpJ(due, today) < 0) calOverdue++;
        else if (due === today) calToday++;
        else calUpcoming++;
      });
      c = { overdue: calOverdue, today: calToday, approval: c.approval || 0 };
    }
    var total = data.total != null ? data.total : c.all;
    return '<div class="cb-stats">' +
      '<div class="cb-stat"><span class="cb-stat-n">' + total + '</span><span class="cb-stat-l">کل</span></div>' +
      '<div class="cb-stat cb-stat-warn"><span class="cb-stat-n">' + (c.overdue || 0) + '</span><span class="cb-stat-l">معوق</span></div>' +
      '<div class="cb-stat cb-stat-info"><span class="cb-stat-n">' + (c.today || 0) + '</span><span class="cb-stat-l">امروز</span></div>' +
      (_isMgr() ? '<div class="cb-stat cb-stat-ok"><span class="cb-stat-n">' + (c.approval || 0) + '</span><span class="cb-stat-l">تأیید</span></div>' : '') +
    '</div>';
  }

  function _renderPager(data) {
    if (_cbState.view !== 'list' || !data || data.total <= _cbState.limit) return '';
    var from = data.offset + 1;
    var to = Math.min(data.offset + data.items.length, data.total);
    return '<div class="cb-pager"><button type="button" class="cb-page-btn" onclick="_cbPage(-1)"' + (data.offset <= 0 ? ' disabled' : '') + '>قبلی</button>' +
      '<span class="cb-page-info">' + from + '–' + to + ' از ' + data.total + '</span>' +
      '<button type="button" class="cb-page-btn" onclick="_cbPage(1)"' + (!data.hasMore ? ' disabled' : '') + '>بعدی</button></div>';
  }

  function _renderMain() {
    var listEl = document.getElementById('cbListArea');
    if (!listEl) return;
    if (_cbState.view === 'matrix') {
      listEl.innerHTML = _renderMatrix(_cbState.matrixData);
      return;
    }
    if (!_cbState.data) return;
    var map = { list: _renderList, tree: _renderTree, calendar: _renderCalendar, kanban: _renderKanban };
    listEl.innerHTML = (map[_cbState.view] || _renderList)(_cbState.data);
  }

  function _refreshViewOnly() {
    _renderMain();
    var pagerEl = document.getElementById('cbPagerArea');
    if (pagerEl && _cbState.data) pagerEl.innerHTML = _renderPager(_cbState.data);
  }

  window._cbRefreshInboxLive = function () {
    if (!document.getElementById('cbListArea')) return Promise.resolve();
    window._cbInboxDirty = false;
    var promises = [_fetchInbox()];
    if (_cbState.view === 'tree' && _isMgr() && (_cbState.treeMode === 'team' || _cbState.scope === 'all')) {
      promises.push(_fetchJson('/api/inbox/tree-team'));
    }
    return Promise.all(promises).then(function (results) {
      var data = results[0];
      _cbState.data = data;
      _indexItems(data.items || []);
      if (results[1]) _cbState.treeTeamData = results[1];
      var statsEl = document.getElementById('cbStatsArea');
      if (statsEl) statsEl.innerHTML = _renderStats(data);
      _updateWarnings(data);
      _refreshViewOnly();
      if (typeof updateHomeInboxBadge === 'function') updateHomeInboxBadge();
    }).catch(function () {});
  };

  function _fetchJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      var ct = (r.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        return r.text().then(function (body) {
          throw new Error(body.trim().startsWith('<') ? 'سرور به‌روز نیست' : 'پاسخ نامعتبر');
        });
      }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || String(r.status)); return d; });
    });
  }

  function _loadSubordinates(cb) {
    if (!_isMgr()) { _cbState.subordinates = []; return cb(); }
    _fetchJson('/api/inbox/subordinates').then(function (d) {
      _cbState.subordinates = d.subordinates || []; cb();
    }).catch(function () { cb(); });
  }

  function _inboxApiFilter() {
    return _cbState.filter || 'all';
  }

  function _inboxApiLimit() {
    if (_cbState.view === 'list') return _cbState.limit;
    if (_cbState.scope === 'all') return 1500;
    return 500;
  }

  function _fetchInbox() {
    var limit = _inboxApiLimit();
    var qs = '?scope=' + encodeURIComponent(_cbState.scope) +
      '&filter=' + encodeURIComponent(_inboxApiFilter()) +
      '&limit=' + limit + '&offset=' + (_cbState.view === 'list' ? _cbState.offset : 0);
    if (_cbState.search) qs += '&search=' + encodeURIComponent(_cbState.search);
    var calTypes = _calendarTypesParam();
    if (calTypes) qs += '&types=' + encodeURIComponent(calTypes);
    else if (_cbState.types.length) qs += '&types=' + encodeURIComponent(_cbState.types.join(','));
    if (_cbState.scope === 'team' && _cbState.owner) qs += '&owner=' + encodeURIComponent(_cbState.owner);
    if (_cbState.view === 'calendar' || _cbState.view === 'list') qs += '&weekAhead=7';
    if (_cbState.view === 'calendar') qs += '&calendar=1';
    return _fetchJson('/api/inbox' + qs);
  }

  function _loadData() {
    window._cbInboxDirty = false;
    var listEl = document.getElementById('cbListArea');
    if (listEl) listEl.innerHTML = '<div class="cb-loading">در حال بارگذاری...</div>';

    if (_cbState.view === 'matrix') {
      if (!_isMgr()) { _cbState.view = 'tree'; localStorage.setItem('cb_view', 'tree'); }
      return _fetchJson('/api/inbox/matrix').then(function (d) {
        _cbState.matrixData = d;
        _renderMain();
        var statsEl = document.getElementById('cbStatsArea');
        if (statsEl) {
          var tot = (d.rows || []).reduce(function (s, r) { return s + (r.total || 0); }, 0);
          var od = (d.rows || []).reduce(function (s, r) { return s + (r.overdue || 0); }, 0);
          statsEl.innerHTML = '<div class="cb-stats"><div class="cb-stat"><span class="cb-stat-n">' + (d.rows || []).length + '</span><span class="cb-stat-l">کارشناس</span></div>' +
            '<div class="cb-stat cb-stat-warn"><span class="cb-stat-n">' + od + '</span><span class="cb-stat-l">معوق کل</span></div>' +
            '<div class="cb-stat"><span class="cb-stat-n">' + tot + '</span><span class="cb-stat-l">آیتم کل</span></div></div>';
        }
        document.getElementById('cbPagerArea').innerHTML = '';
      });
    }

    var promises = [_fetchInbox()];
    if (_cbState.view === 'tree' && _isMgr() && (_cbState.treeMode === 'team' || _cbState.scope === 'all')) {
      promises.push(_fetchJson('/api/inbox/tree-team'));
    }

    return Promise.all(promises).then(function (results) {
      var data = results[0];
      _cbState.data = data;
      _indexItems(data.items || []);
      if (results[1]) _cbState.treeTeamData = results[1];

      var statsEl = document.getElementById('cbStatsArea');
      var pagerEl = document.getElementById('cbPagerArea');
      if (statsEl) statsEl.innerHTML = _renderStats(data);
      _updateWarnings(data);
      _renderMain();
      if (pagerEl) pagerEl.innerHTML = _renderPager(data);

      var panel = document.getElementById('homePanel');
      var sub = panel && panel.querySelector('.cb-sub');
      if (sub) {
        if (data.scope === 'all') sub.textContent = 'نمایش: من + همه کارشناس‌ها · ' + _today();
        else if (data.scope === 'team' && data.targetUser) sub.textContent = 'نمایش: ' + _userName(data.targetUser) + ' · ' + _today();
        else sub.textContent = _userName(currentUser) + ' · ' + _today();
      }
      if (typeof updateHomeInboxBadge === 'function') updateHomeInboxBadge();
    });
  }

  function renderHomeCartable(scope) {
    var panel = document.getElementById('homePanel');
    if (!panel) return;

    if (scope === 'mine' || scope === 'team' || scope === 'all') {
      _cbState.scope = scope;
      localStorage.setItem('cb_scope', scope);
    }
    if (!_isMgr()) { _cbState.scope = 'mine'; if (_cbState.view === 'matrix') _cbState.view = 'tree'; }

    _loadSubordinates(function () {
      if (_cbState.scope === 'team' && !_cbState.owner && _cbState.view !== 'matrix') {
        var experts = _expertsList();
        if (experts.length) _cbState.owner = experts[0].id;
      }

      panel.innerHTML = '<div class="cb-wrap cb-view-' + esc(_cbState.view) + '">' +
        '<div class="cb-header"><div><h2 class="cb-title">📥 کارتابل</h2>' +
        '<p class="cb-sub">' + esc(_userName(currentUser)) + ' · ' + _today() + '</p></div></div>' +
        _buildToolbar() +
        '<div id="cbStatsArea"></div><div id="cbPartialBanner"></div>' +
        '<div id="cbListArea" class="cb-list"><div class="cb-loading">در حال بارگذاری...</div></div>' +
        '<div id="cbPagerArea"></div></div>';

      _loadData().catch(function (e) {
        var listEl = document.getElementById('cbListArea');
        if (listEl) listEl.innerHTML = '<div class="cb-empty cb-error">⚠️ ' + esc(e.message) + '</div>';
      });
    });
  }

  window.renderHomeCartable = renderHomeCartable;
  window.renderHome = renderHomeCartable;

  function updateHomeInboxBadge() {
    _fetchJson('/api/inbox/count').then(function (d) {
      var badge = document.getElementById('homeInboxBadge');
      if (!badge) return;
      var n = Number(d.count) || 0;
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.style.display = n > 0 ? 'inline-block' : 'none';
      badge.title = n ? (d.overdue ? d.overdue + ' معوق · ' : '') + (d.today ? d.today + ' امروز' : '') : '';
    }).catch(function () {});
  }
  window.updateHomeInboxBadge = updateHomeInboxBadge;

  if (window._cbInboxDirty && document.getElementById('cbListArea') && typeof window._scheduleInboxRefresh === 'function') {
    window._scheduleInboxRefresh();
  }
})();

/* Expert Targets (Quota) — manager UI; decoupled from week_entries */
(function () {
  'use strict';

  var _etState = {
    board: [],
    loading: false,
    users: null,
  };

  function _etEsc(s) {
    return typeof esc === 'function' ? esc(s) : String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /** All active users except guest — always prefer live /api/users */
  function _etLoadUsers(cb) {
    if (_etState.users && _etState.users.length) {
      if (cb) cb(_etState.users);
      return Promise.resolve(_etState.users);
    }
    return fetch('/api/users')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var users = (list || []).map(function (m) {
          return {
            id: m.username || m.id,
            name: m.display_name || m.name || m.username,
            role: m.role || '',
            active: m.active !== false,
          };
        }).filter(function (u) {
          return u.id && u.id !== 'guest' && u.role !== 'مهمان' && u.active !== false;
        });
        users.sort(function (a, b) {
          var rank = function (r) {
            if (r === 'کارشناس فروش' || r === 'کارشناس') return 0;
            if (r === 'مدیر' || r === 'سوپر ادمین') return 1;
            return 2;
          };
          var d = rank(a.role) - rank(b.role);
          if (d !== 0) return d;
          return (a.name || '').localeCompare(b.name || '', 'fa');
        });
        _etState.users = users;
        if (cb) cb(users);
        return users;
      })
      .catch(function () {
        var fallback = [];
        if (typeof umGetActive === 'function') {
          fallback = umGetActive().filter(function (m) {
            return m.active !== false && m.role !== 'مهمان' && m.id !== 'guest';
          }).map(function (m) { return { id: m.id, name: m.name, role: m.role || '', active: true }; });
        } else if (typeof _DEFAULT_MEMBERS !== 'undefined') {
          fallback = _DEFAULT_MEMBERS.filter(function (u) {
            return u.active !== false && u.id !== 'guest';
          }).map(function (m) { return { id: m.id, name: m.name, role: m.role || '', active: true }; });
        }
        _etState.users = fallback;
        if (cb) cb(fallback);
        return fallback;
      });
  }

  function _etExperts() {
    return _etState.users || [];
  }

  function _etExpertName(id) {
    var m = _etExperts().find(function (x) { return x.id === id; });
    if (m) return m.name;
    if (typeof USERS !== 'undefined' && USERS[id]) return USERS[id];
    return id;
  }

  function _etOptionLabel(u) {
    var role = u.role ? ' — ' + u.role : '';
    return _etEsc(u.name) + role;
  }

  function _etCurrentWeekKey() {
    if (typeof wpCurrentWeekId === 'function') return wpCurrentWeekId() || '';
    return '';
  }

  function _etCurrentMonthKey() {
    if (typeof todayStr === 'function') {
      var t = todayStr().split('/');
      return t[0] + '/' + t[1];
    }
    return '';
  }

  function _etColor(c) {
    if (c === 'green') return '#16a34a';
    if (c === 'red') return '#dc2626';
    return '#d97706';
  }

  function _etBar(pct, color) {
    var w = Math.min(100, Math.round((pct || 0) * 100));
    return '<div style="height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden">' +
      '<div style="height:100%;width:' + w + '%;background:' + _etColor(color) + ';border-radius:99px;transition:width .3s"></div></div>';
  }

  function _etHowItWorksHtml() {
    return '<details open style="background:linear-gradient(135deg,#eef2ff,#f8fafc);border:1px solid #c7d2fe;border-radius:12px;padding:12px 16px;margin-bottom:14px">' +
      '<summary style="cursor:pointer;font-weight:700;font-size:.9rem;color:#3730a3">❓ این سیستم چطور کار می‌کند؟</summary>' +
      '<div style="margin-top:12px;font-size:.82rem;color:#334155;line-height:1.85">' +
        '<div style="font-weight:700;margin-bottom:6px;color:#1e293b">سه بخش جدا:</div>' +
        '<ol style="margin:0 0 12px 18px;padding:0">' +
          '<li style="margin-bottom:8px"><b>تخصیص مراکز</b> — مدیر می‌گوید «این مرکز را فلان روز انجام بده» (= تعهد ثابت).</li>' +
          '<li style="margin-bottom:8px"><b>اهداف (Quota)</b> — مدیر می‌گوید «این هفته ۲۵ کار Done کن، حداقل ۸ تا پرریسک». مرکز مشخص نمی‌شود؛ فقط عدد هدف است.</li>' +
          '<li style="margin-bottom:8px"><b>برنامه هفته / خانه</b> — کارشناس کار را می‌بیند و با Done تمام می‌کند.</li>' +
        '</ol>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.8rem">' +
          '<b>مسیر:</b> هدف یا تخصیص → کارشناس انجام می‌دهد → فقط <b>Done</b> شمرده می‌شود → نوار پیشرفت بالا می‌آید' +
        '</div>' +
        '<div style="font-size:.78rem;color:#64748b">⚠️ فقط برنامه‌چیدن کافی نیست. بدون Done پیشرفت صفر است.</div>' +
      '</div>' +
    '</details>';
  }

  window._etSetView = function (v) {
    window._wpPlannerView = v;
    try { if (v !== 'guide') localStorage.setItem('wp_planner_seen', '1'); } catch (e) {}
    if (typeof renderWeekPlannerPanel === 'function') renderWeekPlannerPanel();
  };

  window._etLoadBoard = function () {
    _etState.loading = true;
    var el = document.getElementById('etBoard');
    if (el) el.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8">در حال بارگذاری…</div>';
    _etLoadUsers().then(function () {
      return fetch('/api/expert-targets/board');
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _etState.board = (d && d.items) || [];
        _etState.loading = false;
        _etRenderBoard();
      })
      .catch(function () {
        _etState.loading = false;
        if (el) el.innerHTML = '<div style="padding:20px;color:#dc2626">خطا در بارگذاری اهداف</div>';
      });
  };

  function _etRenderBoard() {
    var el = document.getElementById('etBoard');
    if (!el) return;
    if (!_etState.board.length) {
      el.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8">هنوز هدفی تعریف نشده — از فرم بالا بسازید</div>';
      return;
    }
    el.innerHTML = _etState.board.map(function (item) {
      var t = item.target;
      var p = item.progress || {};
      var name = _etExpertName(t.expertId);
      var label = t.periodType === 'month' ? ('ماه ' + t.periodKey) : ('هفته ' + t.periodKey);
      return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#fff">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div>' +
            '<div style="font-weight:700;font-size:.95rem;color:#1e293b">' + _etEsc(name) + '</div>' +
            '<div style="font-size:.78rem;color:#64748b;margin-top:2px">' + _etEsc(label) +
              ' · هدف ' + t.targetCount +
              (t.minPriorityCount ? ' · حداقل ' + t.minPriorityCount + ' پرریسک' : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<span style="font-size:.75rem;font-weight:700;color:' + _etColor(p.color) + '">' +
              (p.doneTotal || 0) + ' / ' + t.targetCount + ' انجام‌شده' +
            '</span>' +
            '<button onclick="window._etDrill(\'' + t.id + '\')" style="font-size:.72rem;padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;font-family:inherit">جزئیات</button>' +
            '<button onclick="window._etAction(\'' + t.id + '\',\'lock\')" style="font-size:.72rem;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;font-family:inherit" title="قفل">🔒</button>' +
            '<button onclick="window._etAction(\'' + t.id + '\',\'close\')" style="font-size:.72rem;padding:4px 8px;border:1px solid #fee2e2;border-radius:6px;background:#fff;color:#b91c1c;cursor:pointer;font-family:inherit" title="بستن">✕</button>' +
          '</div>' +
        '</div>' +
        _etBar(p.progressPct, p.color) +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:.72rem;color:#64748b">' +
          '<span>آزاد: <b style="color:#6366f1">' + (p.freeSlots != null ? p.freeSlots : '—') + '</b></span>' +
          '<span>تعهد ثابت: <b>' + (p.committedTotal || 0) + '</b></span>' +
          '<span>پرریسک: <b style="color:' + (p.priorityOk ? '#16a34a' : '#dc2626') + '">' +
            (p.donePriority || 0) + '/' + (t.minPriorityCount || 0) + '</b></span>' +
          (p.quotaMet ? '<span style="color:#16a34a;font-weight:700">✓ محقق شد</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  window._etDrill = function (id) {
    fetch('/api/expert-targets/' + encodeURIComponent(id) + '/progress')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var p = d.progress || {};
        var t = d.target || {};
        var body = '<div style="font-size:12px;margin-bottom:10px;color:var(--text-secondary)">' +
          _etEsc(_etExpertName(t.expertId)) + ' — ' + _etEsc(t.periodKey) + '</div>' +
          '<div style="margin-bottom:12px">' + _etBar(p.progressPct, p.color) +
          '<div style="font-size:12px;margin-top:6px"><b>' + (p.doneTotal || 0) + '</b> از <b>' + t.targetCount + '</b> انجام‌شده' +
          (t.minPriorityCount ? ' · پرریسک: ' + (p.donePriority || 0) + '/' + t.minPriorityCount : '') +
          '</div></div>';
        if (p.children && p.children.length) {
          body += '<div style="font-weight:600;font-size:12px;margin-bottom:6px">زیرهدف‌های هفتگی</div>';
          body += p.children.map(function (c) {
            return '<div style="padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;font-size:11px">' +
              _etEsc(c.periodKey) + ': ' + c.doneTotal + '/' + c.targetCount +
              ' · آزاد ' + c.freeSlots + '</div>';
          }).join('');
        }
        if (p.openList && p.openList.length) {
          body += '<div style="font-weight:600;font-size:12px;margin:10px 0 6px">باز (هنوز Done نشده)</div>' +
            '<div style="max-height:180px;overflow:auto">' +
            p.openList.map(function (x) {
              return '<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--border)">' +
                _etEsc(x.centerName || x.recKey) +
                (x.priority ? ' <span style="color:#dc2626">پرریسک</span>' : '') +
                (x.source === 'manager_fixed' ? ' <span style="color:#6366f1">ثابت</span>' : '') +
                '</div>';
            }).join('') + '</div>';
        }
        if (typeof openModal === 'function') {
          openModal('etDrill', '📊 پیشرفت هدف', body, '<button class="btn-secondary" onclick="closeModal(\'etDrill\')">بستن</button>', { lg: true });
        }
      })
      .catch(function () { if (typeof showToast === 'function') showToast('خطا در دریافت جزئیات'); });
  };

  window._etAction = function (id, action) {
    if (action === 'close' && !confirm('این هدف بسته شود؟')) return;
    fetch('/api/expert-targets/' + encodeURIComponent(id) + '/' + action, { method: 'POST' })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () {
        if (typeof showToast === 'function') showToast('✅ به‌روز شد');
        window._etLoadBoard();
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast(e.message || 'خطا'); });
  };

  window._etSubmit = function () {
    var expertId = ((document.getElementById('etExpert') || {}).value || '').trim();
    var periodType = ((document.getElementById('etPeriodType') || {}).value || 'week');
    var periodKey = ((document.getElementById('etPeriodKey') || {}).value || '').trim();
    var targetCount = parseInt((document.getElementById('etTarget') || {}).value, 10);
    var minPriority = parseInt((document.getElementById('etMinPri') || {}).value, 10) || 0;
    var dailyWip = parseInt((document.getElementById('etWip') || {}).value, 10);
    var note = ((document.getElementById('etNote') || {}).value || '').trim();
    if (!expertId) { showToast('کاربر را انتخاب کنید'); return; }
    if (!periodKey) { showToast('بازه را مشخص کنید'); return; }
    if (!targetCount || targetCount < 1) { showToast('عدد هدف نامعتبر'); return; }
    if (minPriority > targetCount) { showToast('حداقل پرریسک نمی‌تواند از هدف بیشتر باشد'); return; }

    var payload = {
      expertId: expertId,
      periodType: periodType,
      periodKey: periodKey,
      targetCount: targetCount,
      minPriorityCount: minPriority,
      dailyWipCap: isNaN(dailyWip) ? 5 : dailyWip,
      note: note,
      filters: {
        poolPriority: { overdue: true, potentialMax: 2 },
        excludeStatuses: ['غیرفعال', 'قرارداد بسته شد', 'عدم نیاز فاکتور کنسل شد'],
        excludeGateKinds: ['imed', 'ntsw', 'ttac', 'regulatory'],
      },
      status: 'active',
    };
    if (periodType === 'week') payload.weekIds = [periodKey];

    var btn = document.getElementById('etSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    fetch('/api/expert-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'خطا'); return d; }); })
      .then(function () {
        if (typeof showToast === 'function') showToast('✅ هدف ثبت شد');
        window._etLoadBoard();
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast(e.message || 'خطا'); })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'ثبت هدف'; }
      });
  };

  window._etOnPeriodType = function () {
    var pt = ((document.getElementById('etPeriodType') || {}).value || 'week');
    var inp = document.getElementById('etPeriodKey');
    if (!inp) return;
    if (pt === 'month') {
      inp.value = _etCurrentMonthKey();
      inp.placeholder = '۱۴۰۵/۰۴';
    } else {
      inp.value = _etCurrentWeekKey();
      inp.placeholder = 'شنبه شروع هفته YYYY/MM/DD';
    }
  };

  function _etFillExpertSelect(users) {
    var sel = document.getElementById('etExpert');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">— انتخاب کاربر —</option>' +
      users.map(function (u) {
        return '<option value="' + _etEsc(u.id) + '"' + (cur === u.id ? ' selected' : '') + '>' + _etOptionLabel(u) + '</option>';
      }).join('');
    var hint = document.getElementById('etExpertHint');
    if (hint) hint.textContent = '(' + users.length + ' نفر)';
  }

  window.renderExpertTargetsPanel = function (hostEl) {
    if (!hostEl) return;
    var weekKey = _etCurrentWeekKey();

    hostEl.innerHTML =
      '<div style="max-width:960px;margin:0 auto">' +
        _etHowItWorksHtml() +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:14px">' +
          '<div style="font-size:.88rem;font-weight:700;margin-bottom:4px;color:#1e293b">🎯 تعریف هدف هفتگی / ماهانه</div>' +
          '<div style="font-size:.75rem;color:#64748b;margin-bottom:12px;line-height:1.5">' +
            'عدد هدف برای یک کاربر. فقط وقتی در برنامه هفته <b>Done</b> شود شمرده می‌شود.' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">' +
            '<div style="flex:1.4;min-width:200px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">کاربر <span id="etExpertHint" style="font-weight:500;color:#94a3b8"></span></label>' +
              '<select id="etExpert" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"><option value="">در حال بارگذاری…</option></select></div>' +
            '<div style="min-width:110px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">نوع بازه</label>' +
              '<select id="etPeriodType" onchange="window._etOnPeriodType()" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit">' +
                '<option value="week">هفته</option><option value="month">ماه</option></select></div>' +
            '<div style="flex:1;min-width:150px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">کلید بازه</label>' +
              '<input id="etPeriodKey" value="' + _etEsc(weekKey) + '" placeholder="شنبه هفته YYYY/MM/DD" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"></div>' +
            '<div style="min-width:80px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">هدف</label>' +
              '<input id="etTarget" type="number" min="1" value="25" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"></div>' +
            '<div style="min-width:90px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">حداقل پرریسک</label>' +
              '<input id="etMinPri" type="number" min="0" value="8" title="معوق یا P1/P2" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"></div>' +
            '<div style="min-width:70px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">سقف روز</label>' +
              '<input id="etWip" type="number" min="1" value="5" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"></div>' +
            '<div style="flex:1;min-width:140px"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:4px">یادداشت</label>' +
              '<input id="etNote" placeholder="اختیاری" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit"></div>' +
            '<button id="etSubmitBtn" onclick="window._etSubmit()" style="padding:9px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer">ثبت هدف</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
          '<div style="font-size:.9rem;font-weight:700;color:#1e293b">پیشرفت نسبت به هدف</div>' +
          '<button onclick="window._etLoadBoard()" style="padding:6px 12px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;font-family:inherit;cursor:pointer;font-size:.8rem">🔄 بروزرسانی</button>' +
        '</div>' +
        '<div id="etBoard"></div>' +
      '</div>';

    _etState.users = null;
    _etLoadUsers(function (users) { _etFillExpertSelect(users); });
    window._etLoadBoard();
  };

  window._etLoadUsersForPlanner = _etLoadUsers;
})();

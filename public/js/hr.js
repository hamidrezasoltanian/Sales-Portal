/* HR Module — منابع انسانی */
(function () {
  'use strict';

  var _hrView = 'employees'; // employees | leave | delegation | disciplinary | documents | attendance
  var _hrLeaveFilter = 'all'; // all | pending | approved | rejected | mine
  var _hrUsersCache = null;

  window.renderHRPanel = function () {
    var root = document.getElementById('hrRoot');
    if (!root) return;

    var isManager = (typeof _isManager === 'function' && _isManager()) ||
      (typeof currentUser !== 'undefined' && currentUser && window.USERS && false); // fallback

    // Try to detect manager via session info
    try {
      if (typeof window._currentUserRole !== 'undefined') {
        isManager = ['مدیر', 'سوپر ادمین'].includes(window._currentUserRole);
      }
    } catch (_) {}

    root.innerHTML =
      '<div style="max-width:1100px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
          '<h2 style="margin:0;font-size:1.25rem;font-weight:700">👥 منابع انسانی</h2>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button onclick="window._hrSetView(\'employees\')" class="btn-pill' + (_hrView === 'employees' ? ' active' : '') + '" id="hrVEmployees">👤 کارمندان</button>' +
            '<button onclick="window._hrSetView(\'leave\')" class="btn-pill' + (_hrView === 'leave' ? ' active' : '') + '" id="hrVLeave">📅 مرخصی</button>' +
            (isManager ? '<button onclick="window._hrSetView(\'delegation\')" class="btn-pill' + (_hrView === 'delegation' ? ' active' : '') + '">🔀 جانشینی</button>' : '') +
            (isManager ? '<button onclick="window._hrSetView(\'disciplinary\')" class="btn-pill' + (_hrView === 'disciplinary' ? ' active' : '') + '">⚠️ انضباطی</button>' : '') +
            (isManager ? '<button onclick="window._hrSetView(\'documents\')" class="btn-pill' + (_hrView === 'documents' ? ' active' : '') + '">📎 مدارک</button>' : '') +
            (isManager ? '<button onclick="window._hrSetView(\'attendance\')" class="btn-pill' + (_hrView === 'attendance' ? ' active' : '') + '">🕐 حضور</button>' : '') +
            (isManager ? '<button onclick="window._hrOpenNewEmployee()" style="background:#6366f1;color:#fff;border:none;padding:7px 16px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.9rem">+ کارمند جدید</button>' : '') +
          '</div>' +
        '</div>' +
        '<div id="hrContent"></div>' +
        '<div id="hrContractAlert"></div>' +
      '</div>';

    _addHRStyles();
    if (isManager) _hrLoadContractAlerts();
    _hrRenderContent();
  };

  function _hrLoadContractAlerts() {
    fetch('/api/hr/contracts/expiring?days=30')
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function (d) {
        var el = document.getElementById('hrContractAlert');
        if (!el || !d.items || !d.items.length) return;
        el.innerHTML = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px">' +
          '⚠️ <b>' + d.items.length + ' قرارداد</b> در ۳۰ روز آینده منقضی می‌شود: ' +
          d.items.map(function (x) { return esc(x.full_name) + ' (' + esc(x.contract_end_date) + ')'; }).join(' · ') +
          '</div>';
      })
      .catch(function () {});
  }

  window._hrSetView = function (v) {
    _hrView = v;
    document.querySelectorAll('.btn-pill').forEach(function (b) { b.classList.remove('active'); });
    var btn = document.getElementById('hrV' + v.charAt(0).toUpperCase() + v.slice(1));
    if (btn) btn.classList.add('active');
    _hrRenderContent();
  };

  function _hrRenderContent() {
    if (_hrView === 'employees') _hrLoadEmployees();
    else if (_hrView === 'leave') _hrLoadLeave();
    else if (_hrView === 'delegation') _hrLoadDelegations();
    else if (_hrView === 'disciplinary') _hrLoadDisciplinary();
    else if (_hrView === 'documents') _hrLoadDocuments();
    else if (_hrView === 'attendance') _hrLoadAttendance();
  }

  function _hrNormDigits(s) {
    if (!s) return '';
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(s).replace(/[۰-۹]/g, function (d) { return String(fa.indexOf(d)); });
  }

  function _hrNormJalaliDate(s) {
    return _hrNormDigits(s).trim();
  }

  function _hrNormTime(s) {
    var t = _hrNormDigits(s).trim();
    if (!t) return '';
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      var p = t.split(':');
      return String(parseInt(p[0], 10)).padStart(2, '0') + ':' + p[1];
    }
    if (/^\d{4}$/.test(t)) return t.slice(0, 2) + ':' + t.slice(2);
    return t;
  }

  function _hrTodayJalali() {
    if (typeof todayStr === 'function') return todayStr();
    return '';
  }

  function _hrFetchUsers(force) {
    if (_hrUsersCache && !force) return Promise.resolve(_hrUsersCache);
    return fetch('/api/users')
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
      .then(function (users) {
        _hrUsersCache = (users || []).filter(function (u) { return u.active !== false && u.username; });
        _hrUsersCache.sort(function (a, b) {
          return String(a.display_name || a.username).localeCompare(String(b.display_name || b.username), 'fa');
        });
        return _hrUsersCache;
      });
  }

  function _hrUserSelectHtml(id, selected, options) {
    options = options || {};
    var placeholder = options.placeholder || 'انتخاب کنید…';
    var filterFn = options.filter || function () { return true; };
    var users = (_hrUsersCache || []).filter(filterFn);
    var html = '<select id="' + esc(id) + '" class="hr-input">' +
      '<option value="">' + esc(placeholder) + '</option>';
    users.forEach(function (u) {
      var label = (u.display_name || u.username) + ' (@' + u.username + ')';
      if (options.showRole && u.role) label += ' — ' + u.role;
      html += '<option value="' + esc(u.username) + '"' + (selected === u.username ? ' selected' : '') + '>' + esc(label) + '</option>';
    });
    html += '</select>';
    return html;
  }

  function _hrUserSelectField(label, id, selected, options) {
    return '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">' + label + '</label>' +
      _hrUserSelectHtml(id, selected, options) + '</div>';
  }

  // ── Employee Directory ───────────────────────────────────────────────────────

  function _hrLoadEmployees() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px">در حال بارگذاری...</p>';

    fetch('/api/hr/employees')
      .then(function (r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
      .then(function (employees) {
        _hrRenderEmployees(employees);
      })
      .catch(function () {
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">خطا در بارگذاری لیست کارمندان</p>';
      });
  }

  function _hrRenderEmployees(employees) {
    var cont = document.getElementById('hrContent');
    if (!cont) return;

    if (!employees || !employees.length) {
      cont.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280">' +
        '<div style="font-size:2.5rem;margin-bottom:8px">👤</div>' +
        '<p>هنوز کارمندی ثبت نشده</p>' +
        '<button onclick="window._hrImportUsers()" style="margin-top:8px;padding:9px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.9rem">📥 وارد کردن از کاربران اپ</button>' +
        '</div>';
      return;
    }

    // Group by department
    var depts = {};
    employees.forEach(function (e) {
      var d = e.department || 'سایر';
      if (!depts[d]) depts[d] = [];
      depts[d].push(e);
    });

    var empTypeLabels = { full_time: 'تمام وقت', part_time: 'پاره وقت', contractor: 'پیمانکار' };
    var salaryLabels = ['', '۱', '۲', '۳', '۴', '۵'];

    var html = '';
    Object.keys(depts).forEach(function (dept) {
      html += '<div style="margin-bottom:24px">' +
        '<h3 style="font-size:1rem;font-weight:600;color:#374151;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb">🏢 ' + esc(dept) + ' <span style="font-size:.8rem;color:#6b7280;font-weight:400">(' + depts[dept].length + ' نفر)</span></h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

      depts[dept].forEach(function (e) {
        var initials = (e.full_name || '').split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2);
        var color = e.user_color || '#6366f1';
        html +=
          '<div class="hr-emp-card" onclick="window._hrOpenEmployee(\'' + esc(e.id) + '\')">' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<div style="width:48px;height:48px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;font-weight:700;flex-shrink:0">' + esc(initials) + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:600;font-size:.95rem;color:#111827">' + esc(e.full_name || '') + '</div>' +
                '<div style="font-size:.8rem;color:#6b7280;margin-top:2px">' + esc(e.position || '') + '</div>' +
                (e.username ? '<div style="font-size:.75rem;color:#9ca3af;margin-top:2px">@' + esc(e.username) + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
              (e.phone ? '<span style="font-size:.78rem;color:#374151;background:#f3f4f6;padding:3px 8px;border-radius:12px">📞 ' + esc(e.phone) + '</span>' : '') +
              '<span style="font-size:.78rem;color:#374151;background:#f3f4f6;padding:3px 8px;border-radius:12px">' + (empTypeLabels[e.employment_type] || e.employment_type || '') + '</span>' +
              (e.hire_date ? '<span style="font-size:.78rem;color:#374151;background:#f3f4f6;padding:3px 8px;border-radius:12px">📅 ' + esc(e.hire_date) + '</span>' : '') +
            '</div>' +
          '</div>';
      });

      html += '</div></div>';
    });

    cont.innerHTML = html;
  }

  window._hrOpenEmployee = function (id) {
    fetch('/api/hr/employees/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
      .then(function (e) {
        _hrShowEmployeeModal(e);
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast('❌ خطا: ' + (e.message || e)); });
  };

  function _hrShowEmployeeModal(e) {
    var empTypeLabels = { full_time: 'تمام وقت', part_time: 'پاره وقت', contractor: 'پیمانکار' };
    var isManager = _hrIsManager();

    var body =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        _hrField('نام کامل', e.full_name) +
        _hrField('نام کاربری', e.username ? '@' + e.username : '—') +
        _hrField('کد ملی', e.national_id) +
        _hrField('تاریخ استخدام', e.hire_date) +
        _hrField('پایان قرارداد', e.contract_end_date) +
        _hrField('دپارتمان', e.department) +
        _hrField('سمت', e.position) +
        _hrField('مدیر مستقیم', e.manager) +
        _hrField('تلفن', e.phone) +
        _hrField('نوع استخدام', empTypeLabels[e.employment_type] || e.employment_type) +
        _hrField('سطح حقوقی', e.salary_level ? 'سطح ' + e.salary_level : '—') +
      '</div>' +
      (e.notes ? '<div style="margin-top:12px;padding:10px;background:#f9fafb;border-radius:8px;font-size:.87rem;color:#374151"><b>یادداشت:</b> ' + esc(e.notes) + '</div>' : '') +
      '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button onclick="window._hrViewLeaveBalance(\'' + esc(e.username || e.id) + '\')" style="background:#ede9fe;color:#6d28d9;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.87rem">📊 مانده مرخصی</button>' +
        (isManager ? '<button onclick="window._hrEditEmployee(\'' + esc(e.id) + '\')" style="background:#f3f4f6;color:#374151;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.87rem">✏️ ویرایش</button>' : '') +
        (isManager && e.active ? '<button onclick="window._hrDeactivate(\'' + esc(e.id) + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.87rem">🚫 غیرفعال</button>' : '') +
        (isManager && e.active ? '<button onclick="window._hrOffboard(\'' + esc(e.id) + '\',\'' + esc(e.username || '') + '\')" style="background:#7f1d1d;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.87rem">📤 خروج از سازمان</button>' : '') +
      '</div>';

    if (typeof openModal === 'function') {
      openModal('hrEmpModal', '👤 ' + esc(e.full_name || ''), body, '', { lg: true });
    } else {
      alert(e.full_name + '\n' + (e.position || '') + '\n' + (e.department || ''));
    }
  }

  function _hrField(label, val) {
    return '<div style="background:#f9fafb;border-radius:8px;padding:10px">' +
      '<div style="font-size:.75rem;color:#6b7280;margin-bottom:3px">' + label + '</div>' +
      '<div style="font-size:.9rem;color:#111827;font-weight:500">' + esc(val || '—') + '</div>' +
    '</div>';
  }

  window._hrViewLeaveBalance = function (emp) {
    fetch('/api/hr/leave/balance/' + encodeURIComponent(emp))
      .then(function (r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
      .then(function (b) {
        var used = parseFloat(b.annual_used) || 0;
        var total = parseFloat(b.annual_total) || 30;
        var remaining = total - used;
        var pct = Math.min(100, Math.round((used / total) * 100));
        var body =
          '<div style="text-align:center;padding:16px 0">' +
            '<div style="font-size:2rem;font-weight:700;color:#6366f1">' + remaining + '</div>' +
            '<div style="color:#6b7280;font-size:.87rem;margin-bottom:16px">روز مرخصی باقی‌مانده از ' + total + ' روز</div>' +
            '<div style="background:#e5e7eb;border-radius:999px;height:12px;overflow:hidden;max-width:300px;margin:0 auto">' +
              '<div style="background:#6366f1;width:' + pct + '%;height:100%;border-radius:999px;transition:width .4s"></div>' +
            '</div>' +
            '<div style="margin-top:8px;font-size:.8rem;color:#6b7280">' + used + ' روز استفاده شده (' + pct + '%)</div>' +
            '<div style="margin-top:4px;font-size:.75rem;color:#9ca3af">سال: ' + (b.year || new Date().getFullYear()) + '</div>' +
          '</div>';
        if (typeof openModal === 'function') {
          openModal('hrBalModal', '📊 مانده مرخصی', body, '', {});
        }
      });
  };

  window._hrDeactivate = function (id) {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این کارمند را غیرفعال کنید؟')) return;
    fetch('/api/hr/employees/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        if (typeof closeModal === 'function') closeModal('hrEmpModal');
        if (typeof showToast === 'function') showToast('کارمند غیرفعال شد', 2000);
        _hrLoadEmployees();
      });
  };

  window._hrEditEmployee = function (id) {
    Promise.all([
      fetch('/api/hr/employees/' + encodeURIComponent(id))
        .then(function (r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); }),
      fetch('/api/hr/employees/' + encodeURIComponent(id) + '/contract')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
    ])
      .then(function (res) {
        _hrOpenEditModal(res[0], res[1]);
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast('❌ خطا: ' + (e.message || e)); });
  };

  window._hrOpenNewEmployee = function () {
    _hrOpenEditModal(null);
  };

  function _hrOpenEditModal(e, contract) {
    contract = contract || {};
    var isNew = !e;
    var isManager = _hrIsManager();
    _hrFetchUsers().then(function () {
      var salaryBlock = '';
      if (isManager) {
        salaryBlock =
          '<div style="margin-top:16px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">' +
            '<div style="font-weight:700;color:#166534;margin-bottom:10px">💰 حقوق و قرارداد</div>' +
            '<p style="font-size:.78rem;color:#4b5563;margin:0 0 10px;line-height:1.5">' +
              'حقوق را اینجا ثبت کنید. بخش <strong>داخل لیست بیمه</strong> مبنای کسر بیمه است؛ ' +
              'بخش <strong>خارج لیست بیمه</strong> در ناخالص لحاظ می‌شود ولی مشمول بیمه نیست.' +
            '</p>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
              '<div><label style="font-size:.8rem;color:#166534;display:block;margin-bottom:4px">حقوق داخل لیست بیمه (ریال)</label>' +
                '<input id="hrEF_salary_ins" class="hr-input" type="number" min="0" value="' + esc(String(contract.salary_insurable || contract.base_salary || '')) + '" placeholder="مثلاً ۲۶۰۰۰۰۰۰"></div>' +
              '<div><label style="font-size:.8rem;color:#166534;display:block;margin-bottom:4px">مزایای خارج لیست بیمه (ریال)</label>' +
                '<input id="hrEF_salary_non" class="hr-input" type="number" min="0" value="' + esc(String(contract.salary_non_insurable || '')) + '" placeholder="مثلاً ۵۰۰۰۰۰۰"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">کمک مسکن (ریال)</label>' +
                '<input id="hrEF_housing" class="hr-input" type="number" min="0" value="' + esc(String(contract.housing_allowance || '')) + '"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">بن کارگری (ریال)</label>' +
                '<input id="hrEF_grocery" class="hr-input" type="number" min="0" value="' + esc(String(contract.grocery_allowance || '')) + '"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">حق اولاد (ریال)</label>' +
                '<input id="hrEF_child" class="hr-input" type="number" min="0" value="' + esc(String(contract.child_allowance || '')) + '"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">درصد پورسانت</label>' +
                '<input id="hrEF_comm_pct" class="hr-input" type="number" min="0" step="0.1" value="' + esc(String(contract.commission_pct || '')) + '" placeholder="مثلاً ۱"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تارگت فروش ماهانه (ریال)</label>' +
                '<input id="hrEF_target" class="hr-input" type="number" min="0" value="' + esc(String(contract.sales_target || '')) + '"></div>' +
              '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تاریخ شروع قرارداد</label>' +
                '<input id="hrEF_contract_start" class="hr-input" value="' + esc(contract.start_date || '') + '" placeholder="۱۴۰۴/۰۱/۰۱"></div>' +
            '</div>' +
          '</div>';
      }

      var body =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">نام کامل *</label><input id="hrEF_fullname" class="hr-input" value="' + esc(e ? e.full_name || '' : '') + '" placeholder="نام و نام خانوادگی"></div>' +
          _hrUserSelectField('نام کاربری', 'hrEF_username', e ? e.username || '' : '', { placeholder: 'کاربر سیستم را انتخاب کنید', showRole: true }) +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">کد ملی</label><input id="hrEF_nid" class="hr-input" value="' + esc(e ? e.national_id || '' : '') + '"></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تاریخ استخدام</label><input id="hrEF_hire" class="hr-input" value="' + esc(e ? e.hire_date || '' : '') + '" placeholder="۱۴۰۲/۰۱/۰۱"></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">پایان قرارداد</label><input id="hrEF_contract_end" class="hr-input" value="' + esc(e ? e.contract_end_date || '' : '') + '" placeholder="۱۴۰۵/۱۲/۲۹"></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">دپارتمان</label><input id="hrEF_dept" class="hr-input" value="' + esc(e ? e.department || '' : '') + '" placeholder="فروش، اداری، ..."></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">سمت</label><input id="hrEF_pos" class="hr-input" value="' + esc(e ? e.position || '' : '') + '"></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تلفن</label><input id="hrEF_phone" class="hr-input" value="' + esc(e ? e.phone || '' : '') + '"></div>' +
          _hrUserSelectField('مدیر مستقیم', 'hrEF_manager', e ? e.manager || '' : '', { placeholder: 'مدیر را انتخاب کنید', showRole: true }) +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">نوع استخدام</label><select id="hrEF_etype" class="hr-input"><option value="full_time"' + (e && e.employment_type === 'full_time' ? ' selected' : '') + '>تمام وقت</option><option value="part_time"' + (e && e.employment_type === 'part_time' ? ' selected' : '') + '>پاره وقت</option><option value="contractor"' + (e && e.employment_type === 'contractor' ? ' selected' : '') + '>پیمانکار</option></select></div>' +
          '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">سطح حقوقی (۱-۵)</label><select id="hrEF_slevel" class="hr-input"><option value="1"' + (e && e.salary_level === 1 ? ' selected' : '') + '>سطح ۱</option><option value="2"' + (!e || e.salary_level === 2 ? ' selected' : '') + '>سطح ۲</option><option value="3"' + (e && e.salary_level === 3 ? ' selected' : '') + '>سطح ۳</option><option value="4"' + (e && e.salary_level === 4 ? ' selected' : '') + '>سطح ۴</option><option value="5"' + (e && e.salary_level === 5 ? ' selected' : '') + '>سطح ۵</option></select></div>' +
        '</div>' +
        salaryBlock +
        '<div style="margin-top:12px"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">یادداشت</label><textarea id="hrEF_notes" class="hr-input" rows="2" style="resize:vertical">' + esc(e ? e.notes || '' : '') + '</textarea></div>';

      var footer =
        '<button onclick="window._hrSaveEmployee(\'' + (e ? e.id : '') + '\')" style="background:#6366f1;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-family:inherit">💾 ذخیره</button>';

      if (typeof openModal === 'function') {
        openModal('hrEditEmpModal', isNew ? '+ کارمند جدید' : '✏️ ویرایش کارمند', body, footer, { lg: true });
      }
    }).catch(function (err) {
      if (typeof showToast === 'function') showToast('خطا در بارگذاری لیست کاربران: ' + (err.message || err));
    });
  }

  window._hrSaveEmployee = function (id) {
    function numVal(elId) {
      var v = (document.getElementById(elId) || {}).value;
      if (v === '' || v == null) return null;
      return parseFloat(String(v).replace(/,/g, '')) || 0;
    }

    var data = {
      full_name: (document.getElementById('hrEF_fullname') || {}).value || '',
      username: (document.getElementById('hrEF_username') || {}).value || '',
      national_id: (document.getElementById('hrEF_nid') || {}).value || '',
      hire_date: (document.getElementById('hrEF_hire') || {}).value || '',
      contract_end_date: (document.getElementById('hrEF_contract_end') || {}).value || '',
      department: (document.getElementById('hrEF_dept') || {}).value || '',
      position: (document.getElementById('hrEF_pos') || {}).value || '',
      phone: (document.getElementById('hrEF_phone') || {}).value || '',
      manager: (document.getElementById('hrEF_manager') || {}).value || '',
      employment_type: (document.getElementById('hrEF_etype') || {}).value || 'full_time',
      salary_level: parseInt((document.getElementById('hrEF_slevel') || {}).value) || 2,
      notes: (document.getElementById('hrEF_notes') || {}).value || '',
    };

    if (_hrIsManager()) {
      data.salary_insurable = numVal('hrEF_salary_ins');
      data.salary_non_insurable = numVal('hrEF_salary_non');
      data.housing_allowance = numVal('hrEF_housing');
      data.grocery_allowance = numVal('hrEF_grocery');
      data.child_allowance = numVal('hrEF_child');
      data.commission_pct = numVal('hrEF_comm_pct');
      data.sales_target = numVal('hrEF_target');
      data.start_date = (document.getElementById('hrEF_contract_start') || {}).value || '';
    }

    if (!data.full_name.trim()) {
      if (typeof showToast === 'function') showToast('نام کامل الزامی است', 2000);
      return;
    }

    var isNew = !id;
    var url = isNew ? '/api/hr/employees' : '/api/hr/employees/' + encodeURIComponent(id);
    fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) { if (typeof showToast === 'function') showToast('خطا: ' + res.error, 3000); return; }
        if (typeof closeModal === 'function') { closeModal('hrEditEmpModal'); closeModal('hrEmpModal'); }
        if (typeof showToast === 'function') showToast(isNew ? '✅ کارمند ثبت شد' : '✅ اطلاعات ذخیره شد', 2000);
        _hrLoadEmployees();
      })
      .catch(function () {
        if (typeof showToast === 'function') showToast('خطا در اتصال به سرور', 2500);
      });
  };

  // ── Leave Requests ───────────────────────────────────────────────────────────

  function _hrLoadLeave() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px">در حال بارگذاری...</p>';

    var qs = _hrLeaveFilter === 'all' || _hrLeaveFilter === 'mine' ? '' : '?status=' + _hrLeaveFilter;
    fetch('/api/hr/leave' + qs)
      .then(function (r) { return r.json(); })
      .then(function (requests) {
        _hrRenderLeave(requests);
      })
      .catch(function () {
        cont.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">خطا در بارگذاری</p>';
      });
  }

  function _hrRenderLeave(requests) {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    var isManager = _hrIsManager();

    var typeLabels = { annual: 'استحقاقی', sick: 'استعلاجی', personal: 'شخصی', mission: 'مأموریت', unpaid: 'بدون حقوق' };
    var statusLabels = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
    var statusColors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

    var filterBar =
      '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:.85rem;color:#6b7280">فیلتر:</span>' +
        ['all', 'pending', 'approved', 'rejected'].map(function (f) {
          var labels = { all: 'همه', pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
          return '<button onclick="window._hrSetLeaveFilter(\'' + f + '\')" class="btn-pill' + (_hrLeaveFilter === f ? ' active' : '') + '">' + labels[f] + '</button>';
        }).join('') +
        '<button onclick="window._hrOpenLeaveForm()" style="margin-right:auto;background:#6366f1;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.87rem">+ درخواست مرخصی</button>' +
      '</div>';

    if (!requests || !requests.length) {
      cont.innerHTML = filterBar + '<div style="text-align:center;padding:40px;color:#6b7280"><div style="font-size:2.5rem;margin-bottom:8px">📅</div><p>درخواست مرخصی یافت نشد</p></div>';
      return;
    }

    var rows = requests.map(function (r) {
      var statusColor = statusColors[r.status] || '#6b7280';
      var statusLabel = statusLabels[r.status] || r.status;
      var typeLabel = typeLabels[r.type] || r.type;
      return '<tr onclick="window._hrOpenLeaveDetail(\'' + esc(r.id) + '\')" style="cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'\'">' +
        '<td style="padding:10px 12px">' + esc(r.employee) + '</td>' +
        '<td style="padding:10px 12px">' + esc(typeLabel) + '</td>' +
        '<td style="padding:10px 12px">' + esc(r.from_date) + ' تا ' + esc(r.to_date) + '</td>' +
        '<td style="padding:10px 12px;text-align:center">' + (r.days || 1) + ' روز</td>' +
        '<td style="padding:10px 12px;text-align:center"><span style="background:' + statusColor + '20;color:' + statusColor + ';padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600">' + statusLabel + '</span></td>' +
        '<td style="padding:10px 12px;font-size:.8rem;color:#6b7280">' + _hrFmtDate(r.created_at) + '</td>' +
      '</tr>';
    }).join('');

    cont.innerHTML = filterBar +
      '<div style="overflow-x:auto;border-radius:12px;border:1px solid #e5e7eb">' +
        '<table style="width:100%;border-collapse:collapse;font-size:.88rem">' +
          '<thead><tr style="background:#f9fafb">' +
            '<th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">کارمند</th>' +
            '<th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">نوع</th>' +
            '<th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">بازه</th>' +
            '<th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">روزها</th>' +
            '<th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">وضعیت</th>' +
            '<th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">تاریخ ثبت</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  window._hrSetLeaveFilter = function (f) {
    _hrLeaveFilter = f;
    _hrLoadLeave();
  };

  window._hrOpenLeaveForm = function () {
    var body =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">نوع مرخصی</label><select id="hrLF_type" class="hr-input"><option value="annual">استحقاقی</option><option value="sick">استعلاجی</option><option value="personal">شخصی</option><option value="mission">مأموریت</option><option value="unpaid">بدون حقوق</option></select></div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تعداد روز</label><input id="hrLF_days" class="hr-input" type="number" min="0.5" step="0.5" value="1"></div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">از تاریخ *</label><input id="hrLF_from" class="hr-input" placeholder="۱۴۰۴/۰۴/۰۱"></div>' +
        '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">تا تاریخ *</label><input id="hrLF_to" class="hr-input" placeholder="۱۴۰۴/۰۴/۰۳"></div>' +
        '<div style="grid-column:1/-1"><label><input type="checkbox" id="hrLF_half"> نیم‌روز</label></div>' +
      '</div>' +
      '<div style="margin-top:12px"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">یادداشت پزشکی (استعلاجی &gt;۳ روز)</label><input id="hrLF_medical" class="hr-input" placeholder="شماره گواهی / توضیح"></div>' +
      '<div style="margin-top:12px"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">دلیل</label><textarea id="hrLF_reason" class="hr-input" rows="2" placeholder="توضیح دلیل مرخصی (اختیاری)" style="resize:vertical"></textarea></div>';

    var footer = '<button onclick="window._hrSubmitLeave()" style="background:#6366f1;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-family:inherit">📅 ثبت درخواست</button>';

    if (typeof openModal === 'function') {
      openModal('hrLeaveFormModal', '📅 درخواست مرخصی جدید', body, footer, {});
    }
  };

  window._hrSubmitLeave = function () {
    var data = {
      type: (document.getElementById('hrLF_type') || {}).value || 'annual',
      from_date: (document.getElementById('hrLF_from') || {}).value || '',
      to_date: (document.getElementById('hrLF_to') || {}).value || '',
      days: parseFloat((document.getElementById('hrLF_days') || {}).value) || 1,
      reason: (document.getElementById('hrLF_reason') || {}).value || '',
      is_half_day: !!(document.getElementById('hrLF_half') || {}).checked,
      medical_doc_note: (document.getElementById('hrLF_medical') || {}).value || '',
    };

    if (!data.from_date || !data.to_date) {
      if (typeof showToast === 'function') showToast('تاریخ شروع و پایان الزامی است', 2000);
      return;
    }

    fetch('/api/hr/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) { if (typeof showToast === 'function') showToast('خطا: ' + res.error, 3000); return; }
        if (typeof closeModal === 'function') closeModal('hrLeaveFormModal');
        if (typeof showToast === 'function') showToast('✅ درخواست مرخصی ثبت شد', 2000);
        _hrLoadLeave();
      });
  };

  window._hrOpenLeaveById = function (id) {
    fetch('/api/hr/leave/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function (req) { _hrShowLeaveModal(req); })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._hrOpenLeaveDetail = function (id) {
    window._hrOpenLeaveById(id);
  };

  function _hrShowLeaveModal(req) {
    var isManager = _hrIsManager();
    var typeLabels = { annual: 'استحقاقی', sick: 'استعلاجی', personal: 'شخصی', mission: 'مأموریت', unpaid: 'بدون حقوق' };
    var statusLabels = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
    var statusColors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
    var sc = statusColors[req.status] || '#6b7280';

    var body =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        _hrField('کارمند', req.employee) +
        _hrField('نوع', typeLabels[req.type] || req.type) +
        _hrField('از تاریخ', req.from_date) +
        _hrField('تا تاریخ', req.to_date) +
        _hrField('تعداد روز', req.days + ' روز') +
        '<div style="background:#f9fafb;border-radius:8px;padding:10px"><div style="font-size:.75rem;color:#6b7280;margin-bottom:3px">وضعیت</div><span style="background:' + sc + '20;color:' + sc + ';padding:3px 10px;border-radius:12px;font-size:.85rem;font-weight:600">' + (statusLabels[req.status] || req.status) + '</span></div>' +
      '</div>' +
      (req.reason ? '<div style="background:#f9fafb;border-radius:8px;padding:10px;margin-bottom:12px;font-size:.87rem;color:#374151"><b>دلیل:</b> ' + esc(req.reason) + '</div>' : '') +
      (req.approved_by ? '<div style="font-size:.8rem;color:#6b7280;margin-bottom:12px">تأیید/رد توسط: ' + esc(req.approved_by) + '</div>' : '');

    var footer = '';
    if (isManager && req.status === 'pending') {
      footer =
        '<button onclick="window._hrActLeave(\'' + esc(req.id) + '\',\'approved\')" style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:inherit;margin-left:8px">✅ تأیید</button>' +
        '<button onclick="window._hrActLeave(\'' + esc(req.id) + '\',\'rejected\')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:inherit">❌ رد</button>';
    } else if (req.status === 'pending' || req.status === 'approved') {
      footer += '<button onclick="window._hrCancelLeave(\'' + esc(req.id) + '\')" style="background:#f3f4f6;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:inherit">🚫 لغو</button>';
    }

    if (typeof openModal === 'function') {
      openModal('hrLeaveDetailModal', '📅 جزئیات درخواست مرخصی', body, footer, {});
    }
  }

  window._hrCancelLeave = function (id) {
    var reason = prompt('دلیل لغو (اختیاری):') || '';
    fetch('/api/hr/leave/' + encodeURIComponent(id) + '/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () {
        if (typeof closeModal === 'function') closeModal('hrLeaveDetailModal');
        if (typeof showToast === 'function') showToast('درخواست لغو شد', 2000);
        _hrLoadLeave();
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  function _hrLoadDelegations() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    Promise.all([
      _hrFetchUsers(),
      fetch('/api/hr/delegations').then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); }),
    ])
      .then(function (results) {
        var rows = results[1];
        var form = '<div style="background:#f9fafb;padding:12px;border-radius:10px;margin-bottom:12px">' +
          '<div style="font-weight:600;margin-bottom:8px">تعیین جانشین تأیید</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">جانشین</label>' +
            _hrUserSelectHtml('hrDlg_user', '', { placeholder: 'جانشین را انتخاب کنید', showRole: true }) + '</div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">از تاریخ</label><input id="hrDlg_from" class="hr-input" placeholder="۱۴۰۴/۰۱/۰۱"></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">تا تاریخ</label><input id="hrDlg_to" class="hr-input" placeholder="۱۴۰۴/۰۱/۱۵"></div>' +
          '</div><button onclick="window._hrSaveDelegation()" style="margin-top:8px;background:#6366f1;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer">ذخیره</button></div>';
        var list = (rows || []).map(function (d) {
          return '<div style="padding:8px;border-bottom:1px solid #eee;font-size:13px">' + esc(d.approver) + ' → ' + esc(d.delegate_username) + ' · ' + esc(d.from_date) + ' تا ' + esc(d.to_date) + '</div>';
        }).join('');
        cont.innerHTML = form + (list || '<p style="color:#6b7280">جانشینی ثبت نشده</p>');
      })
      .catch(function (e) {
        if (cont) cont.innerHTML = '<p style="color:#dc2626;padding:12px">خطا: ' + esc(e.message) + '</p>';
      });
  }

  window._hrSaveDelegation = function () {
    var delegate = (document.getElementById('hrDlg_user') || {}).value;
    if (!delegate) { if (typeof showToast === 'function') showToast('جانشین را انتخاب کنید'); return; }
    fetch('/api/hr/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegate_username: (document.getElementById('hrDlg_user') || {}).value,
        from_date: (document.getElementById('hrDlg_from') || {}).value,
        to_date: (document.getElementById('hrDlg_to') || {}).value,
      }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () { if (typeof showToast === 'function') showToast('جانشین ثبت شد'); _hrLoadDelegations(); })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  function _hrLoadDisciplinary() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    Promise.all([
      _hrFetchUsers(),
      fetch('/api/hr/disciplinary').then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); }),
    ])
      .then(function (results) {
        var rows = results[1];
        var form = '<div style="background:#fef2f2;padding:12px;border-radius:10px;margin-bottom:12px">' +
          '<div style="margin-bottom:6px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">کارمند</label>' +
            _hrUserSelectHtml('hrPip_emp', '', { placeholder: 'کارمند را انتخاب کنید', showRole: true }) + '</div>' +
          '<input id="hrPip_title" class="hr-input" placeholder="عنوان (مثلاً تذکر کتبی)" style="margin-bottom:6px">' +
          '<textarea id="hrPip_desc" class="hr-input" rows="2" placeholder="شرح"></textarea>' +
          '<button onclick="window._hrSaveDisciplinary()" style="margin-top:8px;background:#dc2626;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer">ثبت</button></div>';
        var list = (rows || []).map(function (d) {
          return '<div style="padding:10px;border:1px solid #fecaca;border-radius:8px;margin-bottom:8px;font-size:13px"><b>' + esc(d.employee) + '</b> — ' + esc(d.title) + '<div style="color:#6b7280;margin-top:4px">' + esc(d.description || '') + '</div></div>';
        }).join('');
        cont.innerHTML = form + (list || '<p>موردی ثبت نشده</p>');
      })
      .catch(function (e) {
        if (cont) cont.innerHTML = '<p style="color:#dc2626;padding:12px">خطا: ' + esc(e.message) + '</p>';
      });
  }

  window._hrSaveDisciplinary = function () {
    var emp = (document.getElementById('hrPip_emp') || {}).value;
    if (!emp) { if (typeof showToast === 'function') showToast('کارمند را انتخاب کنید'); return; }
    fetch('/api/hr/disciplinary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee: (document.getElementById('hrPip_emp') || {}).value,
        title: (document.getElementById('hrPip_title') || {}).value,
        description: (document.getElementById('hrPip_desc') || {}).value,
        action_type: 'pip',
        severity: 'warning',
      }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () { if (typeof showToast === 'function') showToast('ثبت شد'); _hrLoadDisciplinary(); })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._hrOffboard = function (id, username) {
    _hrFetchUsers().then(function () {
      var body =
        '<div style="margin-bottom:12px"><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">دلیل خروج</label>' +
        '<textarea id="hrOff_reason" class="hr-input" rows="2" placeholder="دلیل خروج از سازمان"></textarea></div>' +
        (username ? '<div><label style="font-size:.8rem;color:#6b7280;display:block;margin-bottom:4px">انتقال وظایف باز به</label>' +
          _hrUserSelectHtml('hrOff_reassign', '', {
            placeholder: 'کارشناس جایگزین (اختیاری)',
            showRole: true,
            filter: function (u) { return u.username !== username; },
          }) + '</div>' : '');
      var footer =
        '<button onclick="window._hrConfirmOffboard(\'' + esc(id) + '\')" style="background:#7f1d1d;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:inherit">تأیید خروج</button>';
      if (typeof openModal === 'function') {
        openModal('hrOffboardModal', '📤 خروج از سازمان', body, footer, {});
      }
    }).catch(function (e) {
      if (typeof showToast === 'function') showToast('خطا: ' + e.message);
    });
  };

  window._hrConfirmOffboard = function (id) {
    if (!confirm('دسترسی CRM قطع و کاربر غیرفعال می‌شود. ادامه؟')) return;
    var reason = (document.getElementById('hrOff_reason') || {}).value || '';
    var reassignEl = document.getElementById('hrOff_reassign');
    var reassignTo = reassignEl ? reassignEl.value : '';
    fetch('/api/hr/offboard/' + encodeURIComponent(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason, reassignTo: reassignTo || null }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () {
        if (typeof closeModal === 'function') { closeModal('hrOffboardModal'); closeModal('hrEmpModal'); }
        if (typeof showToast === 'function') showToast('فرآیند خروج ثبت شد');
        _hrLoadEmployees();
      })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  function _hrLoadDocuments() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    Promise.all([
      _hrFetchUsers(),
      fetch('/api/hr/documents').then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); }),
    ])
      .then(function (results) {
        var rows = results[1];
        var form = '<div style="background:#f0fdf4;padding:12px;border-radius:10px;margin-bottom:12px">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">کارمند</label>' +
            _hrUserSelectHtml('hrDoc_emp', '', { placeholder: 'کارمند را انتخاب کنید', showRole: true }) + '</div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">نوع</label><input id="hrDoc_type" class="hr-input" placeholder="گواهی/قرارداد"></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">عنوان</label><input id="hrDoc_title" class="hr-input" placeholder="عنوان مدرک"></div>' +
          '</div><input id="hrDoc_exp" class="hr-input" placeholder="انقضا (۱۴۰۵/۰۱/۰۱)" style="margin-top:8px">' +
          '<button onclick="window._hrSaveDocument()" style="margin-top:8px;background:#059669;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer">ثبت مدرک</button></div>';
        var list = (rows || []).map(function (d) {
          return '<div style="padding:8px;border-bottom:1px solid #eee;font-size:13px"><b>' + esc(d.employee) + '</b> · ' + esc(d.doc_type) + ' — ' + esc(d.title) +
            (d.expires_at ? ' <span style="color:#b45309">تا ' + esc(d.expires_at) + '</span>' : '') + '</div>';
        }).join('');
        cont.innerHTML = form + (list || '<p style="color:#6b7280">مدرکی ثبت نشده</p>');
      })
      .catch(function (e) {
        if (cont) cont.innerHTML = '<p style="color:#dc2626;padding:12px">خطا: ' + esc(e.message) + '</p>';
      });
  }

  window._hrSaveDocument = function () {
    var emp = (document.getElementById('hrDoc_emp') || {}).value;
    if (!emp) { if (typeof showToast === 'function') showToast('کارمند را انتخاب کنید'); return; }
    fetch('/api/hr/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee: (document.getElementById('hrDoc_emp') || {}).value,
        doc_type: (document.getElementById('hrDoc_type') || {}).value,
        title: (document.getElementById('hrDoc_title') || {}).value,
        expires_at: (document.getElementById('hrDoc_exp') || {}).value,
      }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () { if (typeof showToast === 'function') showToast('مدرک ثبت شد'); _hrLoadDocuments(); })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  function _hrLoadAttendance() {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    Promise.all([
      _hrFetchUsers(),
      fetch('/api/hr/attendance').then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); }),
    ])
      .then(function (results) {
        var rows = results[1];
        var todayDate = _hrTodayJalali();
        var form = '<div style="background:#eff6ff;padding:12px;border-radius:10px;margin-bottom:12px">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">کارمند</label>' +
            _hrUserSelectHtml('hrAtt_emp', '', { placeholder: 'کارمند را انتخاب کنید', showRole: true }) + '</div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">تاریخ *</label><input id="hrAtt_date" class="hr-input" value="' + esc(todayDate) + '" placeholder="۱۴۰۴/۰۴/۰۱" dir="ltr"></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">ورود</label><input id="hrAtt_in" class="hr-input" placeholder="08:30" dir="ltr"></div>' +
          '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:4px">خروج</label><input id="hrAtt_out" class="hr-input" placeholder="17:00" dir="ltr"></div>' +
          '</div><button onclick="window._hrSaveAttendance()" style="margin-top:8px;background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer">ثبت حضور</button></div>';
        var list = (rows || []).map(function (a) {
          return '<div style="padding:8px;border-bottom:1px solid #eee;font-size:13px">' + esc(a.employee) + ' · ' + esc(a.jalali_date) +
            ' ورود:' + esc(a.check_in || '—') + ' خروج:' + esc(a.check_out || '—') + '</div>';
        }).join('');
        cont.innerHTML = form + (list || '<p style="color:#6b7280">ثبت حضوری نیست</p>');
      })
      .catch(function (e) {
        if (cont) cont.innerHTML = '<p style="color:#dc2626;padding:12px">خطا: ' + esc(e.message) + '</p>';
      });
  }

  window._hrSaveAttendance = function () {
    var emp = (document.getElementById('hrAtt_emp') || {}).value;
    var jalaliDate = _hrNormJalaliDate((document.getElementById('hrAtt_date') || {}).value);
    var checkIn = _hrNormTime((document.getElementById('hrAtt_in') || {}).value);
    var checkOut = _hrNormTime((document.getElementById('hrAtt_out') || {}).value);
    if (!emp) { if (typeof showToast === 'function') showToast('کارمند را انتخاب کنید'); return; }
    if (!jalaliDate) { if (typeof showToast === 'function') showToast('تاریخ شمسی الزامی است'); return; }
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(jalaliDate)) {
      if (typeof showToast === 'function') showToast('فرمت تاریخ: ۱۴۰۴/۰۴/۰۱');
      return;
    }
    fetch('/api/hr/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee: emp,
        jalali_date: jalaliDate,
        check_in: checkIn || null,
        check_out: checkOut || null,
      }),
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function () { if (typeof showToast === 'function') showToast('حضور ثبت شد'); _hrLoadAttendance(); })
      .catch(function (e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._hrActLeave = function (id, status) {
    fetch('/api/hr/leave/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) { if (typeof showToast === 'function') showToast('خطا: ' + res.error, 3000); return; }
        if (typeof closeModal === 'function') closeModal('hrLeaveDetailModal');
        if (typeof showToast === 'function') showToast(status === 'approved' ? '✅ مرخصی تأیید شد' : '❌ مرخصی رد شد', 2000);
        _hrLoadLeave();
        if (typeof updateHomeInboxBadge === 'function') updateHomeInboxBadge();
      });
  };

  // ── Utilities ────────────────────────────────────────────────────────────────

  function _hrIsManager() {
    try {
      if (typeof window._currentUserRole !== 'undefined') {
        return ['مدیر', 'سوپر ادمین'].includes(window._currentUserRole);
      }
      if (typeof _isManager === 'function') return _isManager();
    } catch (_) {}
    return false;
  }

  function _hrFmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (typeof g2j === 'function') {
        var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0');
      }
      return d.toLocaleDateString('fa-IR');
    } catch (_) {
      return iso.slice(0, 10);
    }
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _addHRStyles() {
    if (document.getElementById('hrStyles')) return;
    var style = document.createElement('style');
    style.id = 'hrStyles';
    style.textContent =
      '.hr-emp-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;cursor:pointer;transition:box-shadow .2s,transform .15s}' +
      '.hr-emp-card:hover{box-shadow:0 4px 16px rgba(99,102,241,.13);transform:translateY(-2px)}' +
      '.hr-input{width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-family:inherit;font-size:.88rem;box-sizing:border-box;outline:none;transition:border-color .15s}' +
      '.hr-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}' +
      '.btn-pill{background:#f3f4f6;color:#374151;border:none;padding:6px 14px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:.83rem;transition:background .15s}' +
      '.btn-pill:hover{background:#e5e7eb}' +
      '.btn-pill.active{background:#6366f1;color:#fff}';
    document.head.appendChild(style);
  }

  window._hrImportUsers = function() {
    fetch('/api/hr/import-users', { method: 'POST' })
      .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); })
      .then(function(d) {
        if (typeof showToast === 'function') showToast('✅ ' + d.imported + ' کارمند وارد شد');
        _hrLoadEmployees();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

})();

/* HR Onboarding — چک‌لیست انبوردینگ پرسنل */
(function () {
  'use strict';

  var _obMode = 'assignments'; // assignments | template | knowledge | materials
  var _obCache = null;
  var _obDetailId = null;
  var _obMatFilter = 'all';
  var _obMatCache = [];

  function esc(s) {
    return (typeof window.esc === 'function') ? window.esc(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
  }

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
          return d;
        });
      });
  }

  window._hrLoadOnboarding = function () {
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    cont.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">' +
        '<button class="btn-pill' + (_obMode === 'assignments' ? ' active' : '') + '" onclick="window._obSetMode(\'assignments\')">✅ چک‌لیست پرسنل</button>' +
        '<button class="btn-pill' + (_obMode === 'template' ? ' active' : '') + '" onclick="window._obSetMode(\'template\')">📋 قالب فازها</button>' +
        '<button class="btn-pill' + (_obMode === 'materials' ? ' active' : '') + '" onclick="window._obSetMode(\'materials\')">📁 جزوه و رسانه</button>' +
        '<button class="btn-pill' + (_obMode === 'knowledge' ? ' active' : '') + '" onclick="window._obSetMode(\'knowledge\')">📚 دانش و ارزش‌ها</button>' +
        (_obMode === 'assignments'
          ? '<button onclick="window._obOpenAssign()" style="margin-right:auto;background:#6366f1;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">+ شروع انبوردینگ</button>'
          : '') +
        (_obMode === 'template'
          ? '<button onclick="window._obAddPhase()" style="margin-right:auto;background:#0ea5e9;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">+ فاز جدید</button>'
          : '') +
        (_obMode === 'materials'
          ? '<button onclick="window._obOpenMaterial()" style="margin-right:auto;background:#059669;color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">+ افزودن محتوا</button>'
          : '') +
      '</div>' +
      '<div id="obBody"><div style="text-align:center;color:#94a3b8;padding:30px">در حال بارگذاری…</div></div>';

    if (_obMode === 'assignments') _obLoadAssignments();
    else if (_obMode === 'template') _obLoadTemplate();
    else if (_obMode === 'materials') _obLoadMaterials();
    else _obLoadKnowledge();
  };

  window._obSetMode = function (m) {
    _obMode = m;
    _obDetailId = null;
    window._hrLoadOnboarding();
  };

  function _obLoadAssignments() {
    api('/api/hr/onboarding/assignments')
      .then(function (d) {
        var el = document.getElementById('obBody');
        if (!el) return;
        var items = d.items || [];
        if (!items.length) {
          el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px">' +
            'هنوز انبوردینگی شروع نشده.<br><span style="font-size:12px">با «شروع انبوردینگ» برای کارمند جدید چک‌لیست بسازید.</span></div>';
          return;
        }
        el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
          items.map(function (a) {
            var pct = a.total_count ? Math.round((a.done_count / a.total_count) * 100) : 0;
            var st = a.status === 'completed'
              ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:11px">تکمیل شده</span>'
              : '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:999px;font-size:11px">در جریان</span>';
            return '<div class="hr-emp-card" style="cursor:pointer" onclick="window._obOpenDetail(\'' + esc(a.id) + '\')">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
                '<div><div style="font-weight:700">' + esc(a.employee_name || a.employee_username) + '</div>' +
                '<div style="font-size:12px;color:#64748b">' + esc(a.employee_username) +
                (a.mentor_username ? ' · مربی: ' + esc(a.mentor_username) : '') + '</div></div>' +
                st +
              '</div>' +
              '<div style="margin-top:10px;background:#e2e8f0;border-radius:999px;height:8px;overflow:hidden">' +
                '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6366f1,#22c55e)"></div></div>' +
              '<div style="font-size:11px;color:#64748b;margin-top:6px">' + (a.done_count || 0) + ' از ' + (a.total_count || 0) + ' تسک · ' + pct + '٪</div>' +
            '</div>';
          }).join('') + '</div>';
      })
      .catch(function (e) {
        var el = document.getElementById('obBody');
        if (el) el.innerHTML = '<p style="color:#dc2626">' + esc(e.message) + '</p>';
      });
  }

  window._obOpenAssign = function () {
    api('/api/hr/employees').then(function (data) {
      var emps = (data && (data.items || data.employees || data)) || [];
      if (!Array.isArray(emps)) emps = [];
      emps = emps.filter(function (e) { return e.active !== false && e.username; });
      var opts = emps.map(function (e) {
        return '<option value="' + esc(e.username || '') + '" data-id="' + esc(e.id || '') + '" data-name="' + esc(e.full_name || '') + '">' +
          esc(e.full_name || e.username) + ' (' + esc(e.username || '') + ')</option>';
      }).join('');
      var mentorOpts = '<option value="">— بدون مربی —</option>' + opts;
      var body =
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<div><label style="font-size:12px;color:#64748b">کارمند *</label>' +
          '<select id="obAssignUser" class="hr-input" onchange="window._obSyncMentorOptions()">' + opts + '</select></div>' +
          '<div><label style="font-size:12px;color:#64748b">مربی (اختیاری)</label>' +
          '<select id="obAssignMentor" class="hr-input">' + mentorOpts + '</select></div>' +
          '<div><label style="font-size:12px;color:#64748b">یادداشت</label>' +
          '<textarea id="obAssignNotes" class="hr-input" rows="2"></textarea></div>' +
        '</div>';
      openModal('obAssignModal', 'شروع انبوردینگ', body,
        '<button class="btn-secondary" onclick="closeModal(\'obAssignModal\')">انصراف</button>' +
        '<button class="btn-primary" onclick="window._obSubmitAssign()">شروع</button>',
        { lg: false });
      window._obSyncMentorOptions();
    }).catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obSyncMentorOptions = function () {
    var empSel = document.getElementById('obAssignUser');
    var mentSel = document.getElementById('obAssignMentor');
    if (!empSel || !mentSel) return;
    var empUser = empSel.value;
    var prev = mentSel.value;
    Array.prototype.forEach.call(mentSel.options, function (opt) {
      if (!opt.value) { opt.hidden = false; return; }
      opt.hidden = opt.value === empUser;
    });
    if (prev === empUser) mentSel.value = '';
  };

  window._obSubmitAssign = function () {
    var sel = document.getElementById('obAssignUser');
    if (!sel || !sel.value) return toast('کارمند را انتخاب کنید');
    var opt = sel.options[sel.selectedIndex];
    var mentorSel = document.getElementById('obAssignMentor');
    var mentor = (mentorSel && mentorSel.value) || '';
    if (mentor && mentor === sel.value) return toast('مربی نمی‌تواند همان کارمند باشد');
    api('/api/hr/onboarding/assignments', {
      method: 'POST',
      body: JSON.stringify({
        employee_username: sel.value,
        employee_id: opt.getAttribute('data-id') || null,
        employee_name: opt.getAttribute('data-name') || sel.value,
        mentor_username: mentor || null,
        notes: (document.getElementById('obAssignNotes') || {}).value || null,
      }),
    }).then(function (a) {
      closeModal('obAssignModal');
      toast('✅ انبوردینگ شروع شد');
      window._obOpenDetail(a.id);
    }).catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obOpenDetail = function (id) {
    _obDetailId = id;
    var cont = document.getElementById('hrContent');
    if (!cont) return;
    cont.innerHTML = '<div id="obBody"><div style="text-align:center;color:#94a3b8;padding:30px">بارگذاری چک‌لیست…</div></div>';
    api('/api/hr/onboarding/assignments/' + encodeURIComponent(id))
      .then(function (d) {
        var a = d.assignment || {};
        var prog = d.progress || {};
        var html =
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center">' +
            '<div><button onclick="window._obSetMode(\'assignments\')" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-family:inherit">← بازگشت</button>' +
            '<span style="margin-right:12px;font-weight:700;font-size:1.05rem">' + esc(a.employee_name || a.employee_username) + '</span></div>' +
            '<div style="font-size:13px;color:#475569">پیشرفت: <b>' + (prog.pct || 0) + '٪</b> · الزامی ' + (prog.reqDone || 0) + '/' + (prog.reqTotal || 0) + '</div>' +
          '</div>' +
          '<div style="background:#e2e8f0;border-radius:999px;height:10px;overflow:hidden;margin-bottom:16px">' +
            '<div style="height:100%;width:' + (prog.pct || 0) + '%;background:linear-gradient(90deg,#6366f1,#22c55e);transition:width .3s"></div></div>';

        (d.phases || []).forEach(function (p, pi) {
          var tasks = p.tasks || [];
          var doneN = tasks.filter(function (t) { return t.done; }).length;
          html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:12px;overflow:hidden">' +
            '<div style="padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
              '<div><div style="font-weight:700">' + esc(p.title) + '</div>' +
              '<div style="font-size:11px;color:#64748b">' + esc(p.timeline || '') +
              (p.owner_label ? ' · ' + esc(p.owner_label) : '') + '</div></div>' +
              '<span style="font-size:12px;color:#6366f1;font-weight:600">' + doneN + '/' + tasks.length + '</span>' +
            '</div><div style="padding:8px 10px">';
          tasks.forEach(function (t) {
            html += '<label style="display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:8px;cursor:pointer;' +
              (t.done ? 'background:#f0fdf4;' : '') + '" onclick="event.stopPropagation()">' +
              '<input type="checkbox" ' + (t.done ? 'checked' : '') +
              ' onchange="window._obToggleCheck(\'' + esc(id) + '\',\'' + esc(t.id) + '\',this.checked)" ' +
              ' style="margin-top:3px;width:16px;height:16px;accent-color:#6366f1">' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:13px;' + (t.done ? 'text-decoration:line-through;color:#64748b' : 'color:#0f172a') + '">' +
                  esc(t.task_name) +
                  (t.is_required ? ' <span style="color:#dc2626;font-size:10px">*</span>' : '') +
                '</div>' +
                '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' +
                  esc(t.category || '') + (t.assigned_to ? ' · ' + esc(t.assigned_to) : '') +
                '</div>' +
              '</div></label>';
          });
          html += '</div></div>';
        });

        var el = document.getElementById('obBody');
        if (el) el.innerHTML = html;
        else cont.innerHTML = '<div id="obBody">' + html + '</div>';
      })
      .catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obToggleCheck = function (assignId, taskId, done) {
    api('/api/hr/onboarding/assignments/' + encodeURIComponent(assignId) + '/checks/' + encodeURIComponent(taskId), {
      method: 'PUT',
      body: JSON.stringify({ done: !!done }),
    }).then(function () {
      window._obOpenDetail(assignId);
    }).catch(function (e) {
      toast('⚠ ' + e.message);
      window._obOpenDetail(assignId);
    });
  };

  function _obLoadTemplate() {
    api('/api/hr/onboarding/template')
      .then(function (d) {
        _obCache = d;
        var el = document.getElementById('obBody');
        if (!el) return;
        var phases = d.phases || [];
        var html = phases.map(function (p) {
          var tasks = p.tasks || [];
          return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:12px;overflow:hidden">' +
            '<div style="padding:12px 14px;background:#f8fafc;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
              '<div><div style="font-weight:700">' + esc(p.title) + '</div>' +
              '<div style="font-size:11px;color:#64748b">' + esc(p.phase_key) + ' · ' + esc(p.timeline || '') + '</div></div>' +
              '<div style="display:flex;gap:6px">' +
                '<button onclick="window._obEditPhase(\'' + esc(p.id) + '\')" style="font-size:11px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">ویرایش فاز</button>' +
                '<button onclick="window._obAddTask(\'' + esc(p.id) + '\')" style="font-size:11px;border:none;background:#6366f1;color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">+ تسک</button>' +
              '</div></div>' +
            '<div style="padding:6px 10px 10px">' +
            tasks.map(function (t) {
              return '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px;border-bottom:1px solid #f1f5f9;align-items:flex-start">' +
                '<div style="flex:1"><div style="font-size:13px">' + esc(t.task_name) +
                (t.is_required ? ' <span style="color:#dc2626">*</span>' : '') + '</div>' +
                '<div style="font-size:11px;color:#94a3b8">' + esc(t.category || '') + ' · ' + esc(t.assigned_to || '') + '</div></div>' +
                '<div style="display:flex;gap:4px">' +
                  '<button onclick="window._obEditTask(\'' + esc(t.id) + '\')" style="font-size:11px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">ویرایش</button>' +
                  '<button onclick="window._obDeleteTask(\'' + esc(t.id) + '\')" style="font-size:11px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">حذف</button>' +
                '</div></div>';
            }).join('') +
            (!tasks.length ? '<div style="padding:12px;color:#94a3b8;font-size:12px;text-align:center">تسکی نیست — افزودن کنید</div>' : '') +
            '</div></div>';
        }).join('');
        el.innerHTML = html || '<p style="color:#64748b">قالبی نیست.</p>';
      })
      .catch(function (e) {
        var el = document.getElementById('obBody');
        if (el) el.innerHTML = '<p style="color:#dc2626">' + esc(e.message) + '</p>';
      });
  }

  window._obAddPhase = function () {
    var body =
      '<div style="display:grid;gap:10px">' +
        '<div><label style="font-size:12px;color:#64748b">عنوان *</label><input id="obPhTitle" class="hr-input" placeholder="مثلاً هفته پنجم"></div>' +
        '<div><label style="font-size:12px;color:#64748b">بازه زمانی</label><input id="obPhTime" class="hr-input" placeholder="Week 5"></div>' +
        '<div><label style="font-size:12px;color:#64748b">مسئول فاز</label><input id="obPhOwner" class="hr-input" placeholder="HR & Manager"></div>' +
        '<div><label style="font-size:12px;color:#64748b">توضیح</label><textarea id="obPhDesc" class="hr-input" rows="2"></textarea></div>' +
      '</div>';
    openModal('obPhaseModal', 'فاز جدید', body,
      '<button class="btn-secondary" onclick="closeModal(\'obPhaseModal\')">انصراف</button>' +
      '<button class="btn-primary" onclick="window._obSavePhase()">ذخیره</button>');
  };

  window._obEditPhase = function (id) {
    var p = null;
    (_obCache && _obCache.phases || []).forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return;
    var body =
      '<div style="display:grid;gap:10px">' +
        '<input type="hidden" id="obPhId" value="' + esc(id) + '">' +
        '<div><label style="font-size:12px;color:#64748b">عنوان *</label><input id="obPhTitle" class="hr-input" value="' + esc(p.title) + '"></div>' +
        '<div><label style="font-size:12px;color:#64748b">بازه زمانی</label><input id="obPhTime" class="hr-input" value="' + esc(p.timeline || '') + '"></div>' +
        '<div><label style="font-size:12px;color:#64748b">مسئول فاز</label><input id="obPhOwner" class="hr-input" value="' + esc(p.owner_label || '') + '"></div>' +
        '<div><label style="font-size:12px;color:#64748b">توضیح</label><textarea id="obPhDesc" class="hr-input" rows="2">' + esc(p.description || '') + '</textarea></div>' +
      '</div>';
    openModal('obPhaseModal', 'ویرایش فاز', body,
      '<button class="btn-secondary" onclick="closeModal(\'obPhaseModal\')">انصراف</button>' +
      '<button class="btn-primary" onclick="window._obSavePhase()">ذخیره</button>');
  };

  window._obSavePhase = function () {
    var id = (document.getElementById('obPhId') || {}).value;
    var payload = {
      title: (document.getElementById('obPhTitle') || {}).value,
      timeline: (document.getElementById('obPhTime') || {}).value,
      owner_label: (document.getElementById('obPhOwner') || {}).value,
      description: (document.getElementById('obPhDesc') || {}).value,
    };
    if (!payload.title) return toast('عنوان الزامی است');
    var req = id
      ? api('/api/hr/onboarding/phases/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) })
      : api('/api/hr/onboarding/phases', { method: 'POST', body: JSON.stringify(payload) });
    req.then(function () {
      closeModal('obPhaseModal');
      toast('✅ ذخیره شد');
      _obLoadTemplate();
    }).catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obAddTask = function (phaseId) {
    var body =
      '<input type="hidden" id="obTkPhase" value="' + esc(phaseId) + '">' +
      '<div style="display:grid;gap:10px">' +
        '<div><label style="font-size:12px;color:#64748b">عنوان تسک *</label><input id="obTkName" class="hr-input"></div>' +
        '<div><label style="font-size:12px;color:#64748b">دسته</label><input id="obTkCat" class="hr-input" placeholder="مثلاً System Training"></div>' +
        '<div><label style="font-size:12px;color:#64748b">مسئول اقدام</label><input id="obTkAssign" class="hr-input" placeholder="HR / New Hire"></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="obTkReq" checked> اجباری</label>' +
      '</div>';
    openModal('obTaskModal', 'تسک جدید', body,
      '<button class="btn-secondary" onclick="closeModal(\'obTaskModal\')">انصراف</button>' +
      '<button class="btn-primary" onclick="window._obSaveTask()">ذخیره</button>');
  };

  window._obEditTask = function (taskId) {
    var t = null;
    (_obCache && _obCache.phases || []).forEach(function (p) {
      (p.tasks || []).forEach(function (x) { if (x.id === taskId) t = x; });
    });
    if (!t) return;
    var body =
      '<input type="hidden" id="obTkId" value="' + esc(taskId) + '">' +
      '<input type="hidden" id="obTkPhase" value="' + esc(t.phase_id) + '">' +
      '<div style="display:grid;gap:10px">' +
        '<div><label style="font-size:12px;color:#64748b">عنوان تسک *</label><input id="obTkName" class="hr-input" value="' + esc(t.task_name) + '"></div>' +
        '<div><label style="font-size:12px;color:#64748b">دسته</label><input id="obTkCat" class="hr-input" value="' + esc(t.category || '') + '"></div>' +
        '<div><label style="font-size:12px;color:#64748b">مسئول اقدام</label><input id="obTkAssign" class="hr-input" value="' + esc(t.assigned_to || '') + '"></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="obTkReq"' + (t.is_required ? ' checked' : '') + '> اجباری</label>' +
      '</div>';
    openModal('obTaskModal', 'ویرایش تسک', body,
      '<button class="btn-secondary" onclick="closeModal(\'obTaskModal\')">انصراف</button>' +
      '<button class="btn-primary" onclick="window._obSaveTask()">ذخیره</button>');
  };

  window._obSaveTask = function () {
    var id = (document.getElementById('obTkId') || {}).value;
    var payload = {
      phase_id: (document.getElementById('obTkPhase') || {}).value,
      task_name: (document.getElementById('obTkName') || {}).value,
      category: (document.getElementById('obTkCat') || {}).value,
      assigned_to: (document.getElementById('obTkAssign') || {}).value,
      is_required: !!(document.getElementById('obTkReq') || {}).checked,
    };
    if (!payload.task_name) return toast('عنوان تسک الزامی است');
    var req = id
      ? api('/api/hr/onboarding/tasks/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) })
      : api('/api/hr/onboarding/tasks', { method: 'POST', body: JSON.stringify(payload) });
    req.then(function () {
      closeModal('obTaskModal');
      toast('✅ ذخیره شد');
      _obLoadTemplate();
    }).catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obDeleteTask = function (taskId) {
    if (!confirm('این تسک از قالب غیرفعال شود؟')) return;
    api('/api/hr/onboarding/tasks/' + encodeURIComponent(taskId), { method: 'DELETE' })
      .then(function () { toast('حذف شد'); _obLoadTemplate(); })
      .catch(function (e) { toast('⚠ ' + e.message); });
  };

  function _obLoadKnowledge() {
    api('/api/hr/onboarding/template')
      .then(function (d) {
        var kb = d.kb || {};
        var el = document.getElementById('obBody');
        if (!el) return;
        var meta = kb.metadata || {};
        var values = kb.values_system || [];
        var objs = kb.objection_handling_scripts || [];
        var evals = (kb.evaluation_schema && kb.evaluation_schema.criteria) || [];
        var html = '';
        html += '<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:14px;margin-bottom:12px">' +
          '<div style="font-weight:700;margin-bottom:6px">🏢 بستر سازمانی</div>' +
          '<div style="font-size:13px;line-height:1.7;color:#334155">' + esc(meta.mission || '') + '</div>' +
          (meta.vision ? '<div style="font-size:12px;color:#6366f1;margin-top:8px">چشم‌انداز: ' + esc(meta.vision) + '</div>' : '') +
          '</div>';
        html += '<div style="font-weight:700;margin:12px 0 8px">💎 ارزش‌های سازمانی</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:16px">' +
          values.map(function (v) {
            return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff">' +
              '<div style="font-weight:700;font-size:13px;margin-bottom:4px">' + esc(v.value_name) + '</div>' +
              '<div style="font-size:12px;color:#64748b;line-height:1.6">' + esc(v.definition || '') + '</div></div>';
          }).join('') + '</div>';
        html += '<div style="font-weight:700;margin:12px 0 8px">🗣️ پاسخ به مخالفت‌ها</div>';
        objs.forEach(function (o) {
          html += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px;background:#fff">' +
            '<div style="font-weight:700;color:#b45309;font-size:13px">«' + esc(o.objection_text) + '»</div>' +
            '<div style="font-size:12px;color:#334155;margin-top:6px;line-height:1.7">' + esc(o.standard_response_fa) + '</div></div>';
        });
        html += '<div style="font-weight:700;margin:12px 0 8px">📊 معیارهای ارزیابی</div><ul style="margin:0;padding-right:18px;color:#334155;font-size:13px;line-height:1.8">';
        evals.forEach(function (c) {
          html += '<li>' + esc(c.metric) + ' <span style="color:#94a3b8;font-size:11px">(' + esc(c.code) + ')</span></li>';
        });
        html += '</ul>';
        el.innerHTML = html;
      })
      .catch(function (e) {
        var el = document.getElementById('obBody');
        if (el) el.innerHTML = '<p style="color:#dc2626">' + esc(e.message) + '</p>';
      });
  }

  var _OB_KIND_LABEL = { booklet: '📖 جزوه', file: '📎 فایل', video: '🎬 ویدیو' };

  function _obFmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _obMatFileUrl(id) {
    return '/api/hr/onboarding/materials/' + encodeURIComponent(id) + '/download';
  }

  function _obIsImageMime(mime, filename) {
    var m = String(mime || '').toLowerCase();
    if (m.indexOf('image/') === 0) return true;
    var f = String(filename || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(f);
  }

  function _obIsPdfMime(mime, filename) {
    var m = String(mime || '').toLowerCase();
    if (m === 'application/pdf' || m.indexOf('pdf') >= 0) return true;
    return /\.pdf$/i.test(String(filename || ''));
  }

  function _obIsVideoMime(mime, filename) {
    var m = String(mime || '').toLowerCase();
    if (m.indexOf('video/') === 0) return true;
    return /\.(mp4|webm|ogg|mkv|mov)$/i.test(String(filename || ''));
  }

  function _obEmbedExternalUrl(url) {
    url = String(url || '').trim();
    if (!url) return null;
    var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return 'https://www.youtube.com/embed/' + yt[1];
    var ap = url.match(/aparat\.com\/v\/([A-Za-z0-9_-]+)/i);
    if (ap) return 'https://www.aparat.com/video/video/embed/videohash/' + ap[1] + '/vt/frame';
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { video: url };
    return { iframe: url };
  }

  function _obMatThumbHtml(m) {
    var wrap =
      'style="width:88px;height:66px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;' +
      'display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer"';
    if (m.has_file && _obIsImageMime(m.mime_type, m.filename)) {
      return '<div ' + wrap + ' onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')">' +
        '<img src="' + _obMatFileUrl(m.id) + '" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
    }
    if (m.has_file && _obIsPdfMime(m.mime_type, m.filename)) {
      return '<div ' + wrap + ' onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')" title="پیش‌نمایش PDF">' +
        '<span style="font-size:22px">📄</span></div>';
    }
    if (m.has_file && _obIsVideoMime(m.mime_type, m.filename)) {
      return '<div ' + wrap + ' onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')" title="پخش ویدیو">' +
        '<span style="font-size:22px">▶️</span></div>';
    }
    if (m.external_url) {
      return '<div ' + wrap + ' onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')" title="پیش‌نمایش لینک">' +
        '<span style="font-size:22px">' + (m.kind === 'video' ? '🎬' : '🔗') + '</span></div>';
    }
    if (m.has_file) {
      return '<div ' + wrap + ' onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')">' +
        '<span style="font-size:22px">📎</span></div>';
    }
    return '';
  }

  function _obLoadMaterials() {
    var q = _obMatFilter !== 'all' ? ('?kind=' + encodeURIComponent(_obMatFilter)) : '';
    api('/api/hr/onboarding/materials' + q)
      .then(function (d) {
        _obMatCache = d.items || [];
        var el = document.getElementById('obBody');
        if (!el) return;
        var filters = [
          { k: 'all', l: 'همه' },
          { k: 'booklet', l: 'جزوه' },
          { k: 'file', l: 'فایل' },
          { k: 'video', l: 'ویدیو' },
        ];
        var bar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
          filters.map(function (f) {
            return '<button class="btn-pill' + (_obMatFilter === f.k ? ' active' : '') +
              '" onclick="window._obSetMatFilter(\'' + f.k + '\')">' + f.l + '</button>';
          }).join('') + '</div>';

        if (!_obMatCache.length) {
          el.innerHTML = bar +
            '<div style="text-align:center;padding:40px;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px">' +
            'هنوز محتوایی ثبت نشده.<br><span style="font-size:12px">جزوه PDF، فایل آموزشی یا لینک/فایل ویدیو اضافه کنید.</span></div>';
          return;
        }

        el.innerHTML = bar + '<div style="display:flex;flex-direction:column;gap:10px">' +
          _obMatCache.map(function (m) {
            var canPreview = !!(m.has_file || m.external_url);
            var actions = '';
            if (canPreview) {
              actions += '<button onclick="window._obPreviewMaterial(\'' + esc(m.id) + '\')" style="font-size:11px;border:1px solid #a5b4fc;background:#eef2ff;color:#3730a3;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">👁 پیش‌نمایش</button>';
            }
            if (m.has_file) {
              actions += '<a href="' + _obMatFileUrl(m.id) + '?dl=1" style="font-size:11px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:4px 10px;text-decoration:none;color:#334155">دانلود</a>';
            }
            if (m.external_url) {
              actions += '<a href="' + esc(m.external_url) + '" target="_blank" rel="noopener" style="font-size:11px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:6px;padding:4px 10px;text-decoration:none;color:#065f46">لینک خارجی</a>';
            }
            actions += '<button onclick="window._obOpenMaterial(\'' + esc(m.id) + '\')" style="font-size:11px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">ویرایش</button>';
            actions += '<button onclick="window._obDeleteMaterial(\'' + esc(m.id) + '\')" style="font-size:11px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">حذف</button>';

            return '<div class="hr-emp-card" style="cursor:default">' +
              '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">' +
                _obMatThumbHtml(m) +
                '<div style="flex:1;min-width:180px">' +
                  '<div style="font-size:11px;color:#64748b;margin-bottom:4px">' +
                    (_OB_KIND_LABEL[m.kind] || m.kind) +
                    (m.phase_title ? ' · ' + esc(m.phase_title) : '') +
                  '</div>' +
                  '<div style="font-weight:700">' + esc(m.title) + '</div>' +
                  (m.description ? '<div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.6">' + esc(m.description) + '</div>' : '') +
                  '<div style="font-size:11px;color:#94a3b8;margin-top:6px">' +
                    (m.filename ? esc(m.filename) + (m.file_size ? ' · ' + _obFmtSize(m.file_size) : '') : '') +
                    (m.external_url && !m.filename ? 'لینک خارجی' : '') +
                    (m.uploaded_by ? ' · ' + esc(m.uploaded_by) : '') +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap">' + actions + '</div>' +
              '</div></div>';
          }).join('') + '</div>';
      })
      .catch(function (e) {
        var el = document.getElementById('obBody');
        if (el) el.innerHTML = '<p style="color:#dc2626">' + esc(e.message) + '</p>';
      });
  }

  window._obSetMatFilter = function (k) {
    _obMatFilter = k || 'all';
    _obLoadMaterials();
  };

  window._obPreviewMaterial = function (id) {
    var m = null;
    _obMatCache.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return toast('محتوا یافت نشد');

    var body = '';
    var fileUrl = _obMatFileUrl(m.id);

    if (m.has_file && _obIsImageMime(m.mime_type, m.filename)) {
      body = '<div style="text-align:center;background:#0f172a;border-radius:10px;padding:12px">' +
        '<img src="' + fileUrl + '" alt="' + esc(m.title) + '" style="max-width:100%;max-height:70vh;border-radius:6px;object-fit:contain"></div>';
    } else if (m.has_file && _obIsPdfMime(m.mime_type, m.filename)) {
      body = '<iframe src="' + fileUrl + '#toolbar=1" title="' + esc(m.title) +
        '" style="width:100%;height:72vh;border:1px solid #e2e8f0;border-radius:10px;background:#fff"></iframe>';
    } else if (m.has_file && _obIsVideoMime(m.mime_type, m.filename)) {
      body = '<video src="' + fileUrl + '" controls playsinline style="width:100%;max-height:72vh;border-radius:10px;background:#000"></video>';
    } else if (m.external_url) {
      var emb = _obEmbedExternalUrl(m.external_url);
      if (typeof emb === 'string') {
        body = '<iframe src="' + esc(emb) + '" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'style="width:100%;height:72vh;border:0;border-radius:10px;background:#000"></iframe>';
      } else if (emb && emb.video) {
        body = '<video src="' + esc(emb.video) + '" controls playsinline style="width:100%;max-height:72vh;border-radius:10px;background:#000"></video>';
      } else {
        body = '<iframe src="' + esc(m.external_url) + '" style="width:100%;height:72vh;border:1px solid #e2e8f0;border-radius:10px"></iframe>' +
          '<div style="font-size:12px;color:#64748b;margin-top:8px">اگر پیش‌نمایش نمایش داده نشد، از لینک خارجی استفاده کنید.</div>';
      }
    } else if (m.has_file) {
      body =
        '<div style="text-align:center;padding:36px 16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px">' +
          '<div style="font-size:40px;margin-bottom:10px">📎</div>' +
          '<div style="font-weight:700;margin-bottom:6px">' + esc(m.filename || m.title) + '</div>' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:14px">این نوع فایل پیش‌نمایش درون‌برنامه‌ای ندارد.</div>' +
          '<a class="btn-primary" href="' + fileUrl + '?dl=1" style="display:inline-block;text-decoration:none;padding:8px 16px;border-radius:8px;background:#6366f1;color:#fff">دانلود فایل</a>' +
        '</div>';
    } else {
      body = '<p style="color:#64748b;text-align:center">محتوایی برای پیش‌نمایش نیست.</p>';
    }

    if (m.description) {
      body += '<div style="margin-top:12px;font-size:13px;color:#475569;line-height:1.7">' + esc(m.description) + '</div>';
    }

    var foot =
      '<button class="btn-secondary" onclick="closeModal(\'obMatPreviewModal\')">بستن</button>' +
      (m.has_file
        ? '<a class="btn-secondary" href="' + fileUrl + '?dl=1" style="text-decoration:none;display:inline-flex;align-items:center">دانلود</a>'
        : '') +
      (m.external_url
        ? '<a class="btn-secondary" href="' + esc(m.external_url) + '" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">باز کردن لینک</a>'
        : '');

    openModal('obMatPreviewModal', 'پیش‌نمایش: ' + esc(m.title), body, foot, { xl: true });
  };

  function _obMatPhaseOptions(selected) {
    var phases = (_obCache && _obCache.phases) || [];
    var opts = '<option value="">— بدون فاز —</option>';
    phases.forEach(function (p) {
      opts += '<option value="' + esc(p.id) + '"' + (selected === p.id ? ' selected' : '') + '>' + esc(p.title) + '</option>';
    });
    return opts;
  }

  window._obOpenMaterial = function (id) {
    var existing = null;
    if (id) {
      _obMatCache.forEach(function (x) { if (x.id === id) existing = x; });
    }
    var loadPhases = (_obCache && _obCache.phases && _obCache.phases.length)
      ? Promise.resolve(_obCache)
      : api('/api/hr/onboarding/template').then(function (d) { _obCache = d; return d; });

    loadPhases.then(function () {
      var m = existing || {};
      var body =
        '<input type="hidden" id="obMatId" value="' + esc(m.id || '') + '">' +
        '<div style="display:grid;gap:10px">' +
          '<div><label style="font-size:12px;color:#64748b">نوع *</label>' +
          '<select id="obMatKind" class="hr-input">' +
            '<option value="booklet"' + (m.kind === 'booklet' ? ' selected' : '') + '>📖 جزوه</option>' +
            '<option value="file"' + ((!m.kind || m.kind === 'file') ? ' selected' : '') + '>📎 فایل</option>' +
            '<option value="video"' + (m.kind === 'video' ? ' selected' : '') + '>🎬 ویدیو</option>' +
          '</select></div>' +
          '<div><label style="font-size:12px;color:#64748b">عنوان *</label>' +
          '<input id="obMatTitle" class="hr-input" value="' + esc(m.title || '') + '" placeholder="مثلاً راهنمای محصولات"></div>' +
          '<div><label style="font-size:12px;color:#64748b">توضیح</label>' +
          '<textarea id="obMatDesc" class="hr-input" rows="2">' + esc(m.description || '') + '</textarea></div>' +
          '<div><label style="font-size:12px;color:#64748b">مرتبط با فاز</label>' +
          '<select id="obMatPhase" class="hr-input">' + _obMatPhaseOptions(m.phase_id) + '</select></div>' +
          '<div><label style="font-size:12px;color:#64748b">لینک خارجی (آپارات / یوتیوب / Drive)</label>' +
          '<input id="obMatUrl" class="hr-input" dir="ltr" style="text-align:left" value="' + esc(m.external_url || '') + '" placeholder="https://..."></div>' +
          '<div><label style="font-size:12px;color:#64748b">آپلود فایل' +
            (m.has_file ? ' <span style="color:#059669">(فایل فعلی: ' + esc(m.filename || 'موجود') + ')</span>' : '') +
          '</label>' +
          '<input type="file" id="obMatFile" class="hr-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.webm,.mkv,.zip">' +
          '<div style="font-size:11px;color:#94a3b8;margin-top:4px">حداکثر ۸۰ مگابایت — برای ویدیوهای بلند ترجیحاً لینک بگذارید</div></div>' +
        '</div>';
      openModal('obMatModal', m.id ? 'ویرایش محتوا' : 'افزودن جزوه / فایل / ویدیو', body,
        '<button class="btn-secondary" onclick="closeModal(\'obMatModal\')">انصراف</button>' +
        '<button class="btn-primary" onclick="window._obSaveMaterial()">ذخیره</button>',
        { lg: true });
    }).catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obSaveMaterial = function () {
    var id = (document.getElementById('obMatId') || {}).value;
    var title = ((document.getElementById('obMatTitle') || {}).value || '').trim();
    if (!title) return toast('عنوان الزامی است');
    var fd = new FormData();
    fd.append('kind', (document.getElementById('obMatKind') || {}).value || 'file');
    fd.append('title', title);
    fd.append('description', (document.getElementById('obMatDesc') || {}).value || '');
    fd.append('phase_id', (document.getElementById('obMatPhase') || {}).value || '');
    fd.append('external_url', (document.getElementById('obMatUrl') || {}).value || '');
    var fileInput = document.getElementById('obMatFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      fd.append('file', fileInput.files[0]);
    }
    if (!id && !(fileInput && fileInput.files && fileInput.files[0]) && !(document.getElementById('obMatUrl') || {}).value) {
      return toast('فایل یا لینک خارجی را وارد کنید');
    }
    var url = id
      ? '/api/hr/onboarding/materials/' + encodeURIComponent(id)
      : '/api/hr/onboarding/materials';
    fetch(url, { method: id ? 'PUT' : 'POST', body: fd, credentials: 'include' })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
          return d;
        });
      })
      .then(function () {
        closeModal('obMatModal');
        toast('✅ ذخیره شد');
        _obLoadMaterials();
      })
      .catch(function (e) { toast('⚠ ' + e.message); });
  };

  window._obDeleteMaterial = function (id) {
    if (!confirm('این محتوا حذف شود؟')) return;
    api('/api/hr/onboarding/materials/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function () { toast('حذف شد'); _obLoadMaterials(); })
      .catch(function (e) { toast('⚠ ' + e.message); });
  }
})();

/* workflows.js — user-definable process / workflow module */
var _wfDefinitions = [];
var _wfInstances = [];
var _wfCurrentDefId = null;
var _wfFilter = 'mine'; // mine | all | active

function _wfSortedStages(def) {
  return (def.stages || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
}

function _wfGetDef(id) {
  return _wfDefinitions.find(function (d) { return d.id === id; });
}

function _wfLoadDefinitions(cb) {
  fetch('/api/workflows/definitions')
    .then(function (r) { return r.ok ? r.json() : { definitions: [] }; })
    .then(function (d) {
      _wfDefinitions = d.definitions || [];
      if (!_wfCurrentDefId && _wfDefinitions.length) {
        try { _wfCurrentDefId = localStorage.getItem('_wfDef') || _wfDefinitions[0].id; } catch (e) { _wfCurrentDefId = _wfDefinitions[0].id; }
      }
      if (cb) cb();
    })
    .catch(function () { _wfDefinitions = []; if (cb) cb(); });
}

function _wfLoadInstances(cb) {
  if (!_wfCurrentDefId) { _wfInstances = []; if (cb) cb(); return; }
  var q = '/api/workflows/instances?definitionId=' + encodeURIComponent(_wfCurrentDefId) + '&status=active';
  if (_wfFilter === 'mine') q += '&owner=' + encodeURIComponent(currentUser);
  fetch(q)
    .then(function (r) { return r.ok ? r.json() : { instances: [] }; })
    .then(function (d) { _wfInstances = d.instances || []; if (cb) cb(); })
    .catch(function () { _wfInstances = []; if (cb) cb(); });
}

function renderWorkflowsPanel() {
  var el = document.getElementById('workflowsPanel');
  if (!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ بارگذاری گردش‌کار...</div>';
  _wfLoadDefinitions(function () {
    _wfLoadInstances(function () { _wfRenderPanel(el); });
  });
}

function _wfRenderPanel(el) {
  var def = _wfGetDef(_wfCurrentDefId);
  var stages = def ? _wfSortedStages(def) : [];
  var canEdit = typeof _isManager === 'function' && _isManager();

  var html = '<div class="task-wrap" style="max-width:1400px;margin:0 auto;padding:12px">';
  html += '<div class="task-filters" style="margin-bottom:14px;flex-wrap:wrap">';
  html += '<span style="font-size:16px;font-weight:700;color:var(--text-primary);margin-left:8px">🔄 گردش‌کار</span>';

  if (_wfDefinitions.length) {
    html += '<select id="wfDefSelect" onchange="_wfSelectDef(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">';
    _wfDefinitions.forEach(function (d) {
      html += '<option value="' + esc(d.id) + '"' + (d.id === _wfCurrentDefId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
    });
    html += '</select>';
  }

  html += [['mine', 'موارد من'], ['all', 'همه']].map(function (f) {
    return '<button class="task-filter-btn' + (_wfFilter === f[0] ? ' active' : '') + '" onclick="_wfFilter=\'' + f[0] + '\';renderWorkflowsPanel()">' + f[1] + '</button>';
  }).join('');

  html += '<button class="btn-primary" style="margin-right:auto;font-size:12px;padding:6px 16px" onclick="openWfInstanceModal()">+ مورد جدید</button>';
  if (canEdit) {
    html += '<button onclick="openWfDefEditor()" style="font-size:11px;padding:5px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-family:inherit">⚙️ تعریف فرآیند</button>';
    html += '<button onclick="openWfDefCreate()" style="font-size:11px;padding:5px 12px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;cursor:pointer;font-family:inherit">+ فرآیند جدید</button>';
  }
  html += '</div>';

  if (!def) {
    html += '<div style="text-align:center;padding:40px;color:var(--text-muted)">هیچ فرآیندی تعریف نشده. مدیر می‌تواند فرآیند جدید بسازد.</div></div>';
    el.innerHTML = html;
    return;
  }

  if (def.description) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;padding:8px 12px;background:var(--bg-raised);border-radius:8px">' + esc(def.description) + '</div>';
  }

  html += '<div class="tk-board">';
  stages.forEach(function (st) {
    var colItems = _wfInstances.filter(function (i) { return i.currentStage === st.id; });
    html += '<div class="tk-col" data-stage="' + esc(st.id) + '"'
      + ' ondragover="event.preventDefault();this.classList.add(\'tk-drop-over\')" ondragleave="this.classList.remove(\'tk-drop-over\')" ondrop="wfDrop(event,\'' + esc(st.id) + '\')">'
      + '<div class="tk-col-head" style="border-top:3px solid ' + (st.color || '#6366f1') + '">'
      + '<span style="color:' + (st.color || '#6366f1') + ';font-weight:700">' + esc(st.label || st.id) + '</span>'
      + '<span class="tk-col-cnt">' + colItems.length + '</span>'
      + '</div><div class="tk-col-body">';
    if (!colItems.length) {
      html += '<div class="tk-col-empty">—</div>';
    } else {
      colItems.forEach(function (inst) { html += _wfRenderCard(inst, st); });
    }
    html += '</div></div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
}

function _wfSelectDef(id) {
  _wfCurrentDefId = id;
  try { localStorage.setItem('_wfDef', id); } catch (e) {}
  renderWorkflowsPanel();
}

function _wfRenderCard(inst, st) {
  var today = todayStr();
  var overdue = inst.dueDate && inst.dueDate < today;
  var owner = USERS[inst.owner] || inst.owner || '';
  var priCls = ['', 'task-pri-1', 'task-pri-2', 'task-pri-3'][inst.priority || 2] || 'task-pri-2';
  return '<div class="tk-card" draggable="true" ondragstart="wfDragStart(event,\'' + esc(inst.id) + '\')" ondragend="wfDragEnd(event)" onclick="openWfInstanceDetail(\'' + esc(inst.id) + '\')">'
    + '<div class="tk-card-title">' + esc(inst.title) + '</div>'
    + '<div class="tk-card-meta">'
    + (owner ? '<span class="tk-owner">' + esc(owner) + '</span>' : '')
    + (inst.dueDate ? '<span style="color:' + (overdue ? '#ef4444' : 'var(--text-muted)') + ';font-size:10px">📅 ' + esc(inst.dueDate) + '</span>' : '')
    + (inst.centerName ? '<span class="tk-center-chip">🏥 ' + esc(inst.centerName.substring(0, 18)) + '</span>' : '')
    + (inst.data && inst.data.amount ? '<span style="font-size:10px;color:#0369a1">💰 ' + esc(String(inst.data.amount)) + ' M</span>' : '')
    + '</div></div>';
}

var _wfDragId = null;
function wfDragStart(ev, id) { _wfDragId = id; ev.dataTransfer.setData('text/plain', id); }
function wfDragEnd() { _wfDragId = null; document.querySelectorAll('.tk-col').forEach(function (c) { c.classList.remove('tk-drop-over'); }); }

function wfDrop(ev, toStage) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('tk-drop-over');
  var id = ev.dataTransfer.getData('text/plain') || _wfDragId;
  if (!id) return;
  var inst = _wfInstances.find(function (i) { return i.id === id; });
  if (!inst || inst.currentStage === toStage) return;
  fetch('/api/workflows/instances/' + encodeURIComponent(id) + '/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: toStage, note: 'انتقال از کانبان' }),
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.d.error || 'انتقال مجاز نیست')); renderWorkflowsPanel(); return; }
      showToast('✅ مرحله به‌روز شد', 2000);
      renderWorkflowsPanel();
    })
    .catch(function () { showToast('⚠ خطا در انتقال'); });
}

function openWfInstanceModal(prefill) {
  prefill = prefill || {};
  window._wfPendingCenterKey = prefill.centerKey || '';
  var def = _wfGetDef(_wfCurrentDefId);
  if (!def) { showToast('⚠ ابتدا یک فرآیند انتخاب کنید'); return; }
  var members = typeof umGetActive === 'function' ? umGetActive() : ((DB.settings && DB.settings.members) || _DEFAULT_MEMBERS);
  var ownerOpts = members.filter(function (m) { return m.active !== false && m.id !== 'guest'; }).map(function (m) {
    return '<option value="' + esc(m.id) + '"' + ((prefill.owner || currentUser) === m.id ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
  }).join('');

  var fieldHtml = (def.fields || []).map(function (f) {
    var val = (prefill.data && prefill.data[f.key]) || '';
    if (f.type === 'number') {
      return '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">' + esc(f.label) + '</label>'
        + '<input id="wfF_' + f.key + '" type="number" value="' + esc(String(val)) + '" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px"></div>';
    }
    return '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">' + esc(f.label) + '</label>'
      + '<input id="wfF_' + f.key + '" value="' + esc(String(val)) + '" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px"></div>';
  }).join('');

  var body = '<div style="font-size:12px">'
    + '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">عنوان *</label>'
    + '<input id="wfInstTitle" value="' + esc(prefill.title || '') + '" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px"></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
    + '<div><label style="font-size:11px;font-weight:600">مسئول</label><select id="wfInstOwner" style="width:100%;padding:6px;border-radius:6px;font-family:inherit">' + ownerOpts + '</select></div>'
    + '<div><label style="font-size:11px;font-weight:600">سررسید</label><input id="wfInstDue" readonly value="' + esc(prefill.dueDate || '') + '" class="fd-inp" style="width:100%;padding:6px 8px;cursor:pointer"></div>'
    + '</div>'
    + '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">مرکز (اختیاری)</label>'
    + '<input id="wfInstCenter" value="' + esc(prefill.centerName || '') + '" placeholder="نام مرکز..." style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px"></div>'
    + fieldHtml
    + '</div>';

  openModal('wfInstModal', '➕ مورد جدید — ' + esc(def.name), body,
    '<button class="btn-secondary" onclick="closeModal(\'wfInstModal\')">انصراف</button>'
    + '<button class="btn-primary" onclick="_wfSubmitInstance()">ایجاد</button>');
  setTimeout(function () {
    var di = document.getElementById('wfInstDue');
    if (di) openJDP(di, function (v) { di.value = v; });
  }, 100);
}

function _wfSubmitInstance() {
  var def = _wfGetDef(_wfCurrentDefId);
  if (!def) return;
  var title = (document.getElementById('wfInstTitle') || {}).value || '';
  if (!title.trim()) { showToast('⚠ عنوان الزامی است'); return; }
  var data = {};
  (def.fields || []).forEach(function (f) {
    var el = document.getElementById('wfF_' + f.key);
    if (!el) return;
    data[f.key] = f.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
  });
  var centerName = (document.getElementById('wfInstCenter') || {}).value || '';
  fetch('/api/workflows/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      definitionId: def.id,
      title: title.trim(),
      owner: (document.getElementById('wfInstOwner') || {}).value || currentUser,
      dueDate: (document.getElementById('wfInstDue') || {}).value || '',
      centerKey: window._wfPendingCenterKey || '',
      centerName: centerName.trim(),
      data: data,
    }),
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.d.error || 'خطا')); return; }
      closeModal('wfInstModal');
      window._wfPendingCenterKey = '';
      showToast('✅ مورد ایجاد شد', 2000);
      renderWorkflowsPanel();
    })
    .catch(function () { showToast('⚠ خطا در ایجاد'); });
}

function openWfInstanceDetail(id) {
  fetch('/api/workflows/instances/' + encodeURIComponent(id))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.instance) { showToast('⚠ مورد یافت نشد'); return; }
      _wfShowInstanceDetail(d.instance, d.history || []);
    })
    .catch(function () { showToast('⚠ خطا'); });
}

function _wfShowInstanceDetail(inst, history) {
  var def = _wfGetDef(inst.definitionId);
  var stages = def ? _wfSortedStages(def) : [];
  var curSt = stages.find(function (s) { return s.id === inst.currentStage; });
  var allowed = stages.filter(function (s) {
    return s.id !== inst.currentStage && def && (
      !(def.transitions || []).length || (def.transitions || []).some(function (t) { return t.from === inst.currentStage && t.to === s.id; })
    );
  });

  var btnHtml = allowed.map(function (s) {
    return '<button onclick="_wfDoAction(\'' + esc(inst.id) + '\',\'' + esc(s.id) + '\')" style="background:' + (s.color || '#6366f1') + '22;color:' + (s.color || '#6366f1') + ';border:1px solid ' + (s.color || '#6366f1') + '55;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;margin:2px">→ ' + esc(s.label) + '</button>';
  }).join('');

  var histHtml = history.slice(0, 15).map(function (h) {
    var at = h.at ? h.at.slice(0, 16).replace('T', ' ') : '';
    return '<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--border)">'
      + '<span style="color:var(--text-muted)">' + at + '</span> '
      + esc(USERS[h.by_user] || h.by_user) + ': '
      + esc(h.from_stage || '—') + ' → ' + esc(h.to_stage)
      + (h.note ? ' — ' + esc(h.note) : '')
      + '</div>';
  }).join('') || '<div style="font-size:11px;color:var(--text-muted)">بدون تاریخچه</div>';

  var body = '<div style="font-size:12px">'
    + '<div style="font-weight:700;font-size:14px;margin-bottom:8px">' + esc(inst.title) + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
    + '<span style="background:' + ((curSt && curSt.color) || '#6366f1') + '22;color:' + ((curSt && curSt.color) || '#6366f1') + ';padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700">' + esc((curSt && curSt.label) || inst.currentStage) + '</span>'
    + (inst.owner ? '<span>👤 ' + esc(USERS[inst.owner] || inst.owner) + '</span>' : '')
    + (inst.dueDate ? '<span>📅 ' + esc(inst.dueDate) + '</span>' : '')
    + (inst.centerName ? '<span>🏥 ' + esc(inst.centerName) + '</span>' : '')
    + '</div>'
    + (btnHtml ? '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;margin-bottom:4px">انتقال به مرحله:</div>' + btnHtml + '</div>' : '')
    + '<div style="background:var(--bg-raised);border-radius:8px;padding:10px;margin-top:8px">'
    + '<div style="font-size:11px;font-weight:700;margin-bottom:6px">📜 تاریخچه</div>' + histHtml
    + '</div></div>';

  openModal('wfDetailModal', 'جزئیات گردش‌کار', body,
    '<button style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="if(confirm(\'لغو شود؟\'))_wfCancel(\'' + esc(inst.id) + '\')">لغو</button>'
    + '<button class="btn-secondary" onclick="closeModal(\'wfDetailModal\')">بستن</button>', { lg: true });
}

function _wfDoAction(id, toStage) {
  var note = prompt('یادداشت انتقال (اختیاری):') || '';
  fetch('/api/workflows/instances/' + encodeURIComponent(id) + '/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: toStage, note: note }),
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.d.error || 'خطا')); return; }
      closeModal('wfDetailModal');
      showToast('✅ انتقال انجام شد', 2000);
      renderWorkflowsPanel();
    });
}

function _wfCancel(id) {
  fetch('/api/workflows/instances/' + encodeURIComponent(id) + '/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'لغو توسط کاربر' }),
  })
    .then(function () { closeModal('wfDetailModal'); showToast('لغو شد'); renderWorkflowsPanel(); });
}

// ── Definition editor (manager) ───────────────────────────────────────────

function openWfDefCreate() {
  openWfDefEditor(null);
}

function openWfDefEditor(defId) {
  var def = defId ? _wfGetDef(defId) : null;
  if (!def && defId) { showToast('⚠ فرآیند یافت نشد'); return; }
  window._wfEditDef = def ? JSON.parse(JSON.stringify(def)) : {
    id: '',
    name: 'فرآیند جدید',
    description: '',
    stages: [
      { id: 'start', label: 'شروع', color: '#64748b', order: 0 },
      { id: 'doing', label: 'در حال انجام', color: '#6366f1', order: 1 },
      { id: 'done', label: 'پایان', color: '#22c55e', order: 2, isFinal: true },
    ],
    transitions: [],
    fields: [],
  };

  function renderStages() {
    return window._wfEditDef.stages.map(function (s, i) {
      return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
        + '<input type="color" value="' + (s.color || '#6366f1') + '" onchange="_wfEditStage(' + i + ',\'color\',this.value)" style="width:28px;height:28px;border:none;background:none">'
        + '<input value="' + esc(s.label || '') + '" onchange="_wfEditStage(' + i + ',\'label\',this.value)" placeholder="عنوان مرحله" style="flex:1;padding:5px 8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px">'
        + '<input value="' + esc(s.id || '') + '" onchange="_wfEditStage(' + i + ',\'id\',this.value)" placeholder="شناسه" dir="ltr" style="width:90px;padding:5px;font-size:11px;border:1px solid var(--border-input);border-radius:5px">'
        + '<label style="font-size:10px;display:flex;gap:3px;align-items:center"><input type="checkbox"' + (s.isFinal ? ' checked' : '') + ' onchange="_wfEditStage(' + i + ',\'isFinal\',this.checked)">پایانی</label>'
        + (i > 0 ? '<button onclick="_wfRemoveStage(' + i + ')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;padding:2px 6px;cursor:pointer">✕</button>' : '')
        + '</div>';
    }).join('');
  }

  window._wfEditStage = function (i, field, val) {
    if (field === 'isFinal') window._wfEditDef.stages[i].isFinal = !!val;
    else window._wfEditDef.stages[i][field] = val;
    document.getElementById('wfStagesRows').innerHTML = renderStages();
  };
  window._wfRemoveStage = function (i) {
    window._wfEditDef.stages.splice(i, 1);
    window._wfEditDef.stages.forEach(function (s, idx) { s.order = idx; });
    document.getElementById('wfStagesRows').innerHTML = renderStages();
  };
  window._wfAddStage = function () {
    var n = window._wfEditDef.stages.length;
    window._wfEditDef.stages.push({ id: 'stage_' + Date.now(), label: 'مرحله ' + (n + 1), color: '#8b5cf6', order: n });
    document.getElementById('wfStagesRows').innerHTML = renderStages();
  };

  var transLines = (window._wfEditDef.transitions || []).map(function (t) {
    return t.from + ' → ' + t.to;
  }).join('\n');

  var body = '<div style="font-size:12px;max-height:65vh;overflow-y:auto">'
    + '<div style="margin-bottom:8px"><label style="font-weight:600">نام فرآیند</label>'
    + '<input id="wfDefName" value="' + esc(window._wfEditDef.name) + '" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit"></div>'
    + '<div style="margin-bottom:8px"><label style="font-weight:600">توضیحات</label>'
    + '<input id="wfDefDesc" value="' + esc(window._wfEditDef.description || '') + '" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit"></div>'
    + '<div style="margin-bottom:10px"><label style="font-weight:700">مراحل</label>'
    + '<div id="wfStagesRows">' + renderStages() + '</div>'
    + '<button onclick="_wfAddStage()" style="margin-top:6px;padding:4px 12px;font-size:11px;border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit">+ مرحله</button></div>'
    + '<div style="margin-bottom:8px"><label style="font-weight:700">انتقال‌های مجاز <span style="font-weight:400;color:var(--text-muted)">(هر خط: from → to — خالی = همه مجاز)</span></label>'
    + '<textarea id="wfDefTrans" rows="5" style="width:100%;padding:6px;font-size:11px;font-family:monospace;direction:ltr;border:1px solid var(--border-input);border-radius:6px">' + esc(transLines) + '</textarea></div>'
    + '</div>';

  openModal('wfDefModal', '⚙️ ' + (def ? 'ویرایش فرآیند' : 'فرآیند جدید'), body,
    '<button class="btn-secondary" onclick="closeModal(\'wfDefModal\')">انصراف</button>'
    + '<button class="btn-primary" onclick="_wfSaveDef()">💾 ذخیره</button>', { lg: true });
}

function _wfSaveDef() {
  var d = window._wfEditDef;
  if (!d) return;
  d.name = (document.getElementById('wfDefName') || {}).value || d.name;
  d.description = (document.getElementById('wfDefDesc') || {}).value || '';
  var transRaw = (document.getElementById('wfDefTrans') || {}).value || '';
  d.transitions = [];
  transRaw.split('\n').forEach(function (line) {
    var m = line.trim().match(/^(\S+)\s*→\s*(\S+)$/);
    if (m) d.transitions.push({ from: m[1], to: m[2] });
  });

  var isNew = !d.id || !_wfGetDef(d.id);
  var url = isNew ? '/api/workflows/definitions' : '/api/workflows/definitions/' + encodeURIComponent(d.id);
  var method = isNew ? 'POST' : 'PUT';

  fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
    .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.body.error || 'خطا')); return; }
      closeModal('wfDefModal');
      _wfCurrentDefId = res.body.id;
      try { localStorage.setItem('_wfDef', res.body.id); } catch (e) {}
      showToast('✅ فرآیند ذخیره شد', 2500);
      renderWorkflowsPanel();
    })
    .catch(function () { showToast('⚠ خطا در ذخیره'); });
}

// Create workflow instance from center modal
function wfCreateFromCenter(rtype, rid, name) {
  _wfLoadDefinitions(function () {
    if (!_wfDefinitions.length) { showToast('⚠ فرآیندی تعریف نشده'); return; }
    _wfCurrentDefId = _wfCurrentDefId || _wfDefinitions[0].id;
    openWfInstanceModal({
      title: name || 'پیگیری مرکز',
      centerKey: rtype + '_' + rid,
      centerName: name,
      owner: currentUser,
      data: {}
    });
  });
}

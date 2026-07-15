/* ═══ public/js/center-interactions.js ═══ */
/* UI واحد ثبت تعامل — ثبت سریع + ثبت نتیجه برنامه هفته */

var CI_MODAL_ID = 'centerInteractionModal';
var _QCL_TPLS = [
  'علاقه‌مند به بررسی محصول — پیگیری بعدی تعیین شد',
  'نیاز به بررسی بیشتر — ارسال بروشور درخواست شد',
  'پاسخگو نبود — پیگیری مجدد لازم است',
  'ویزیت انجام شد — نتیجه مثبت / منتظر تصمیم نهایی',
];

function _ciNewIdempotencyKey() {
  return 'ci_' + (currentUser || 'u') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

/** تبدیل rtype+rid یا recKey کامل به شکل استاندارد (همان منطق server parseCenterKey) */
function parseCenterRef(rtype, ridOrRecKey) {
  var s = String(ridOrRecKey || '').trim();
  var rt = rtype || 'center';
  if (!s) return { rtype: rt, rid: '', centerKey: '' };
  if (s.indexOf('pc_') === 0) {
    return { rtype: 'pc', rid: s.slice(3), centerKey: s };
  }
  if (s.indexOf('center_') === 0) {
    return { rtype: 'center', rid: s.slice(7), centerKey: s };
  }
  if (rt && s.indexOf(rt + '_') === 0) {
    var pure = s.slice(rt.length + 1);
    return { rtype: rt, rid: pure, centerKey: rt + '_' + pure };
  }
  var ck = typeof recK === 'function' ? recK(rt, s) : rt + '_' + s;
  return { rtype: rt, rid: s, centerKey: ck };
}

function postCenterInteraction(centerKey, payload) {
  var key = payload.idempotencyKey || _ciNewIdempotencyKey();
  payload.idempotencyKey = key;
  return fetch('/api/centers/' + encodeURIComponent(centerKey) + '/interactions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.json().then(function (j) {
      if (!r.ok) return Promise.reject(j);
      return j;
    });
  });
}

function _ciRefreshCenterNotesUI(rtype, rid, centerKey) {
  if (typeof refreshCenterProfileNotes === 'function') {
    refreshCenterProfileNotes(rtype, rid, centerKey);
  }
}

function _ciApplyInteractionResult(centerKey, rtype, rid, res) {
  if (!res || !res.interaction) return;
  var ix = res.interaction;
  var proj = ix.projections || {};
  var ck = res.centerKey || centerKey;

  if (typeof ensureKPIDB === 'function') ensureKPIDB();
  if (typeof reloadActivityLogsFromApi === 'function') reloadActivityLogsFromApi();

  // سرور در همان تراکنش interaction فیلدهای مرکز را PATCH کرده — فقط sync محلی
  var refreshInbox = function () {
    if (res.inboxWarning && typeof showToast === 'function') {
      showToast('⚠ ' + res.inboxWarning, 5000);
    } else if (res.inboxSync && res.inboxSync.active && res.inboxSync.dueAt && typeof showToast === 'function') {
      var td = typeof todayStr === 'function' ? todayStr() : '';
      if (res.inboxSync.dueAt !== td && String(res.inboxSync.dueAt).localeCompare(td) > 0) {
        showToast('📅 پیگیری در ' + res.inboxSync.dueAt + ' — در ستون پیش‌رو / تقویم دیده می‌شود', 4000);
      }
    }
    if (typeof window._cbForceInboxFilterAll === 'function') window._cbForceInboxFilterAll();
    if (typeof _scheduleInboxRefresh === 'function') {
      setTimeout(function () { _scheduleInboxRefresh(); }, 300);
    }
  };

  var editReload = typeof reloadCenterEditFromApi === 'function'
    ? reloadCenterEditFromApi(ck)
    : Promise.resolve();
  if (editReload && typeof editReload.then === 'function') {
    editReload.then(refreshInbox).catch(refreshInbox);
  } else {
    refreshInbox();
  }

  if (typeof DB !== 'undefined') {
    if (!DB.notes) DB.notes = {};
    if (res.notes && Array.isArray(res.notes)) {
      DB.notes[ck] = res.notes;
    } else if (proj.noteText) {
      if (!DB.notes[ck]) DB.notes[ck] = [];
      var dup = DB.notes[ck].some(function (n) { return n.interactionId === ix.id; });
      if (!dup) {
        DB.notes[ck].push({
          text: proj.noteText,
          date: ix.occurredDate,
          user: USERS[currentUser] || currentUser,
          by: currentUser,
          interactionId: ix.id,
          ts: Date.now(),
        });
      }
    }
  }

  if (typeof ensureCenterNotesLoaded === 'function') {
    ensureCenterNotesLoaded(ck, rtype, rid);
  } else {
    _ciRefreshCenterNotesUI(rtype, rid, ck);
  }

  if (currentTab === 'kpi' && typeof renderKPIPanel === 'function') {
    setTimeout(renderKPIPanel, 200);
  }
}

function _ciActOptions(selected) {
  var types = [
    ['call', '📞 تماس'], ['visit', '🤝 ملاقات'], ['price_send', '📄 ارسال قیمت'],
    ['sample_send', '🧪 ارسال نمونه'], ['committee', '🏛 پیگیری کمیته'],
    ['meeting', '👥 جلسه'], ['followup', '🔄 پیگیری'],
  ];
  return types.map(function (t) {
    return '<option value="' + t[0] + '"' + (selected === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
  }).join('');
}

function _ciNoteBlock() {
  return '<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📝 یادداشت</label>'
    + '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px">'
    + '<button type="button" onclick="_qclTemplate(0)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">✅ علاقه‌مند</button>'
    + '<button type="button" onclick="_qclTemplate(1)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">📄 ارسال بروشور</button>'
    + '<button type="button" onclick="_qclTemplate(2)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">📵 عدم پاسخ</button>'
    + '<button type="button" onclick="_qclTemplate(3)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">🤝 پس از ویزیت</button>'
    + '</div>'
    + '<textarea id="ci_note" rows="3" placeholder="خلاصه مکالمه یا نتیجه..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;background:var(--bg-input);color:var(--text-primary)"></textarea></div>';
}

function _ciQuickResultBlock() {
  return '<div id="ci_quick_result_wrap"><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📊 نتیجه تماس</label>'
    + '<select id="ci_quick_result" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'
    + '<option value="">-- انتخاب --</option>'
    + '<option>تماس موفق - علاقه‌مند</option>'
    + '<option>تماس موفق - بی‌علاقه</option>'
    + '<option>قرار ویزیت گذاشته شد</option>'
    + '<option>پیگیری بعدی لازم است</option>'
    + '<option>عدم پاسخگویی</option>'
    + '<option>مشغول / بعداً تماس</option>'
    + '</select></div>';
}

function _ciScheduledOutcomeBlock(actLabel) {
  return '<div id="ci_scheduled_wrap">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">نتیجه این ' + esc(actLabel) + ' چه بود؟ <span style="color:#dc2626">*</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">'
    + '<label style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer" onclick="_ciSelectOutcome(this,\'followup\')">'
    + '<input type="radio" name="ci_outcome" value="followup" style="margin-top:2px;flex-shrink:0"> '
    + '<div><div style="font-weight:600;font-size:12px">🔄 نیاز به پیگیری دارد</div><div style="font-size:10px;color:var(--text-muted)">جلسه / تماس بعدی برنامه‌ریزی می‌شود</div></div></label>'
    + '<label style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer" onclick="_ciSelectOutcome(this,\'won\')">'
    + '<input type="radio" name="ci_outcome" value="won" style="margin-top:2px;flex-shrink:0"> '
    + '<div><div style="font-weight:600;font-size:12px">✅ قرارداد / فروش بسته شد</div></div></label>'
    + '<label style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer" onclick="_ciSelectOutcome(this,\'inactive\')">'
    + '<input type="radio" name="ci_outcome" value="inactive" style="margin-top:2px;flex-shrink:0"> '
    + '<div><div style="font-weight:600;font-size:12px">❌ غیرفعال / رد شد</div></div></label>'
    + '</div>'
    + '<div id="ci_followup_sec" style="display:none;margin-bottom:10px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px">'
    + '<label style="font-size:12px;font-weight:700;color:#0369a1;display:block;margin-bottom:6px">📅 تاریخ پیگیری بعدی <span style="color:#dc2626">*</span></label>'
    + '<input id="ci_nextdate" type="text" value="" readonly placeholder="انتخاب تاریخ..." style="width:100%;box-sizing:border-box;cursor:pointer;padding:6px 8px;border:1px solid #7dd3fc;border-radius:6px;font-family:inherit;font-size:12px" onclick="openJDP(this,function(v){document.getElementById(\'ci_nextdate\').value=v;_ciCheckSubmit();})">'
    + '</div>'
    + '<div id="ci_won_sec" style="display:none;margin-bottom:10px;padding:10px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:7px">'
    + '<label style="font-size:12px;font-weight:700;color:#166534;display:block;margin-bottom:6px">💰 مبلغ قرارداد (میلیون تومان)</label>'
    + '<input id="ci_amount" type="number" min="0" step="0.1" placeholder="مثلاً: 12.5" style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #86efac;border-radius:5px;font-size:12px;font-family:inherit">'
    + '</div>'
    + '<div id="ci_inactive_sec" style="display:none;margin-bottom:10px;padding:10px 12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:7px">'
    + '<label style="font-size:12px;font-weight:700;color:#991b1b;display:block;margin-bottom:6px">❌ دلیل غیرفعال شدن</label>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">'
    + ['رقیب برد', 'قیمت بالا', 'نیاز نداشتن', 'زمان‌بندی نامناسب', 'عدم دسترسی به تصمیم‌گیر', 'سایر'].map(function (r) {
      return '<button type="button" onclick="_ciLostSelect(this,\'' + r + '\')" data-ci-lrb="1" style="padding:4px 10px;border-radius:20px;border:1px solid #fca5a5;background:#fee2e2;color:#991b1b;cursor:pointer;font-size:11px;font-family:inherit">' + r + '</button>';
    }).join('')
    + '</div><input type="hidden" id="ci_lost_reason"></div>'
    + '</div>';
}

/**
 * مودال واحد — ctx:
 *   rtype, rid, centerName
 *   weekEntryKey → ثبت نتیجه برنامه (scheduled)
 *   بدون weekEntryKey → ثبت سریع (quick)
 */
function openCenterInteraction(ctx) {
  ctx = ctx || {};
  var weekEntryKey = ctx.weekEntryKey || '';
  var isScheduled = !!weekEntryKey;
  var rtype = ctx.rtype || 'center';
  var rid = ctx.rid || '';
  var actionType = ctx.actionType || 'call';

  if (weekEntryKey && DB.weekEntries && DB.weekEntries[weekEntryKey]) {
    var we = DB.weekEntries[weekEntryKey];
    actionType = we.actionType || actionType;
    rtype = we.rtype || (we.recKey ? we.recKey.split('_')[0] : rtype);
    rid = we.rid || (we.recKey ? we.recKey.split('_').slice(1).join('_') : rid);
    ctx.pfNo = ctx.pfNo || we.pfNo;
    ctx.pfId = ctx.pfId || we.pfId;
    if (!ctx.centerName) ctx.centerName = we.centerName || '';
  } else if (ctx.centerKey) {
    var ref = parseCenterRef(null, ctx.centerKey);
    rtype = ref.rtype;
    rid = ref.rid;
  } else {
    var norm = parseCenterRef(rtype, rid);
    rtype = norm.rtype;
    rid = norm.rid;
  }

  var centerName = ctx.centerName || (typeof _getCenterName === 'function' ? _getCenterName(rtype, rid) : rid);
  var centerKey = ctx.centerKey || (typeof recK === 'function' ? recK(rtype, rid) : rtype + '_' + rid);

  window._ciCtx = {
    rtype: rtype,
    rid: rid,
    centerKey: centerKey,
    centerName: centerName,
    weekEntryKey: weekEntryKey,
    isScheduled: isScheduled,
    actionType: actionType,
    pfNo: ctx.pfNo || '',
    pfId: ctx.pfId || '',
  };

  var e = typeof getE === 'function' ? getE(rtype, rid) : {};
  var actLabel = (typeof wpActLabel === 'function' ? wpActLabel(actionType) : (actionType === 'visit' ? 'مراجعه' : 'تماس'));
  var pfCtx = ctx.pfNo || ctx.pfId || '';

  var body = '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<div style="padding:8px 12px;background:var(--bg-raised);border-radius:7px;font-size:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
    + '<span>مرکز: <b>' + esc(centerName) + '</b></span>'
    + '<span style="color:var(--text-muted)">|</span>'
    + '<span class="ci-badge" style="font-size:10px;padding:2px 8px;border-radius:12px;background:' + (isScheduled ? '#dbeafe' : '#f3e8ff') + ';color:' + (isScheduled ? '#1d4ed8' : '#7c3aed') + '">'
    + (isScheduled ? '📅 برنامه هفته' : '⚡ ثبت آزاد') + '</span>'
    + '</div>';

  if (pfCtx) {
    body += '<div style="padding:6px 10px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;font-size:12px">📄 پیش‌فاکتور: <b>' + esc(ctx.pfNo || String(ctx.pfId)) + '</b></div>';
  }

  body += '<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🎯 نوع فعالیت</label>'
    + '<select id="ci_act_type" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px"'
    + (isScheduled ? ' disabled' : '') + '>'
    + _ciActOptions(actionType) + '</select></div>';

  if (isScheduled) {
    body += _ciScheduledOutcomeBlock(actLabel);
  } else {
    body += _ciQuickResultBlock();
    body += '<div id="ci_quick_fd_wrap"><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📅 پیگیری بعدی</label>'
      + '<input type="text" id="ci_quick_fd" readonly placeholder="انتخاب تاریخ..." onclick="openJDP(this,function(v){document.getElementById(\'ci_quick_fd\').value=v;})" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer;background:var(--bg-input);color:var(--text-primary)" value="' + esc(e.followupDate || '') + '">'
      + '</div>';
  }

  body += _ciNoteBlock() + '</div>';

  var title = isScheduled
    ? (pfCtx ? ('✅ پیگیری پیش‌فاکتور ' + esc(ctx.pfNo || '')) : ('✅ ثبت نتیجه — ' + esc(actLabel)))
    : ('📞 ثبت تعامل — ' + esc(centerName));

  var foot = '<button class="btn-secondary" onclick="closeModal(\'' + CI_MODAL_ID + '\')">انصراف</button>'
    + '<button id="ci_submit_btn" class="btn-primary" onclick="_ciSubmit()"'
    + (isScheduled ? ' disabled style="opacity:.45;cursor:not-allowed"' : '') + '>ثبت</button>';

  openModal(CI_MODAL_ID, title, body, foot);

  var preset = window._wpDonePreset;
  window._wpDonePreset = null;
  if (preset && isScheduled) {
    setTimeout(function () {
      var lbl = document.querySelector('label[onclick*="_ciSelectOutcome"][onclick*="\'' + preset + '\'"]');
      _ciSelectOutcome(lbl, preset);
    }, 60);
  }
}

function _ciSelectOutcome(lbl, val) {
  document.querySelectorAll('[name="ci_outcome"]').forEach(function (r) {
    var p = r.closest('label');
    if (p) p.style.borderColor = 'var(--border)';
  });
  if (lbl) lbl.style.borderColor = val === 'won' ? '#22c55e' : val === 'inactive' ? '#ef4444' : '#38bdf8';
  var r = document.querySelector('[name="ci_outcome"][value="' + val + '"]');
  if (r) r.checked = true;
  var fu = document.getElementById('ci_followup_sec');
  var wo = document.getElementById('ci_won_sec');
  var ina = document.getElementById('ci_inactive_sec');
  if (fu) fu.style.display = val === 'followup' ? '' : 'none';
  if (wo) wo.style.display = val === 'won' ? '' : 'none';
  if (ina) ina.style.display = val === 'inactive' ? '' : 'none';
  if (val === 'followup') {
    var nd = document.getElementById('ci_nextdate');
    if (nd && !nd.value && typeof todayStr === 'function' && typeof jAddDays === 'function') {
      var td = todayStr().split('/').map(Number);
      var df = jAddDays(td[0], td[1], td[2], 7);
      nd.value = df[0] + '/' + (df[1] < 10 ? '0' + df[1] : df[1]) + '/' + (df[2] < 10 ? '0' + df[2] : df[2]);
    }
  }
  _ciCheckSubmit();
}

function _ciLostSelect(btn, reason) {
  document.querySelectorAll('[data-ci-lrb]').forEach(function (b) {
    b.style.background = '#fee2e2';
    b.style.borderColor = '#fca5a5';
    b.style.color = '#991b1b';
  });
  btn.style.background = '#dc2626';
  btn.style.color = '#fff';
  btn.style.borderColor = '#dc2626';
  var inp = document.getElementById('ci_lost_reason');
  if (inp) inp.value = reason;
}

function _ciCheckSubmit() {
  var ctx = window._ciCtx || {};
  var btn = document.getElementById('ci_submit_btn');
  if (!btn) return;
  if (!ctx.isScheduled) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    return;
  }
  var r = document.querySelector('[name="ci_outcome"]:checked');
  var ok = !!r;
  if (r && r.value === 'followup') {
    var nd = document.getElementById('ci_nextdate');
    ok = !!(nd && nd.value);
  }
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '.45';
  btn.style.cursor = ok ? 'pointer' : 'not-allowed';
}

function _qclTemplate(i) {
  var el = document.getElementById('ci_note');
  if (el) {
    var t = _QCL_TPLS[i] || '';
    el.value = (el.value ? el.value + '\n' : '') + t;
    el.focus();
  }
}

function _ciSubmit() {
  var ctx = window._ciCtx || {};
  if (!ctx.rtype || !ctx.rid) { showToast('مرکز نامعتبر'); return; }

  if (ctx.isScheduled && ctx.weekEntryKey) {
    if (typeof _wpFinishDone === 'function') {
      _wpFinishDone(ctx.weekEntryKey);
    }
    return;
  }

  var result = ((document.getElementById('ci_quick_result') || {}).value || '');
  var note = ((document.getElementById('ci_note') || {}).value || '').trim();
  var fd = ((document.getElementById('ci_quick_fd') || {}).value || '');
  var actType = ((document.getElementById('ci_act_type') || {}).value || 'call');
  if (!result && !note) { showToast('نتیجه یا یادداشت را وارد کنید'); return; }

  var centerKey = ctx.centerKey || (typeof recK === 'function' ? recK(ctx.rtype, ctx.rid) : ctx.rtype + '_' + ctx.rid);
  postCenterInteraction(centerKey, {
    mode: 'quick',
    actionType: actType,
    result: result,
    note: note,
    followupDate: fd || null,
    centerName: ctx.centerName,
    occurredDate: typeof todayStr === 'function' ? todayStr() : '',
    idempotencyKey: _ciNewIdempotencyKey(),
  }).then(function (res) {
    _ciApplyInteractionResult(centerKey, ctx.rtype, ctx.rid, res);
    closeModal(CI_MODAL_ID);
    showToast(res.replay ? '✓ قبلاً ثبت شده بود' : '✓ تعامل ثبت شد');
    if (typeof renderExpertDashboard === 'function') renderExpertDashboard();
    if (typeof renderDashboard === 'function') renderDashboard();
  }).catch(function (err) {
    showToast('⚠ ' + (err.error || 'خطا در ثبت تعامل'), 3000);
  });
}

function quickCallLog(rtype, rid, centerName) {
  var ref = parseCenterRef(rtype, rid);
  openCenterInteraction({ rtype: ref.rtype, rid: ref.rid, centerName: centerName });
}

function _submitQCL(rtype, rid, modalId) {
  window._ciCtx = { rtype: rtype, rid: rid, isScheduled: false };
  _ciSubmit();
}

/** @deprecated — از openCenterInteraction استفاده کنید */
function wpMarkDoneKeyFromCi(eKey) {
  if (!DB.weekEntries || !DB.weekEntries[eKey]) return;
  var we = DB.weekEntries[eKey];
  var rtype = we.rtype || (we.recKey ? we.recKey.split('_')[0] : 'center');
  var rid = we.rid || (we.recKey ? we.recKey.split('_').slice(1).join('_') : '');
  var cname = we.centerName || '';
  openCenterInteraction({
    rtype: rtype,
    rid: rid,
    centerName: cname,
    weekEntryKey: eKey,
    actionType: we.actionType || 'call',
    pfNo: we.pfNo,
    pfId: we.pfId,
  });
}

window.openCenterInteraction = openCenterInteraction;
window.postCenterInteraction = postCenterInteraction;
window.quickCallLog = quickCallLog;
window._submitQCL = _submitQCL;
window._qclTemplate = _qclTemplate;
window._ciNewIdempotencyKey = _ciNewIdempotencyKey;
window._ciApplyInteractionResult = _ciApplyInteractionResult;
window._ciSelectOutcome = _ciSelectOutcome;
window._ciLostSelect = _ciLostSelect;
window._ciCheckSubmit = _ciCheckSubmit;
window._ciSubmit = _ciSubmit;
window.parseCenterRef = parseCenterRef;

/* ═══ public/js/center-merge.js — orphan edit merge suggestions ═══ */

function _cmsEsc(s) {
  return typeof esc === 'function' ? esc(s) : String(s || '').replace(/[<>&"']/g, function (c) {
    return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function _cmsSnapLine(snap, key, label) {
  var v = snap && snap[key];
  if (v == null || v === '') return '';
  return '<span class="cms-meta-item"><b>' + label + ':</b> ' + _cmsEsc(String(v)) + '</span>';
}

function _cmsParseCenterKey(centerKey) {
  if (!centerKey || typeof centerKey !== 'string') return null;
  if (centerKey.startsWith('center_')) {
    return { rtype: 'center', id: centerKey.slice(7), centerKey: centerKey };
  }
  if (centerKey.startsWith('pc_')) {
    return { rtype: 'pc', id: centerKey.slice(3), centerKey: centerKey };
  }
  return null;
}

function _cmsOpenProfileByKey(centerKey) {
  var p = _cmsParseCenterKey(centerKey);
  if (!p || typeof openCenterModal !== 'function') {
    showToast('⚠️ باز کردن پروفایل ممکن نیست');
    return;
  }
  openCenterModal(p.rtype, p.id, p.centerKey);
}

function _cmsNameLink(centerKey, name, title) {
  var label = _cmsEsc(name || centerKey);
  title = _cmsEsc(title || 'مشاهده پروفایل');
  return '<button type="button" class="cms-name-link" data-center-key="' + _cmsEsc(centerKey) + '" title="' + title + '">'
    + label + ' <span class="cms-name-link-hint">↗</span></button>';
}

function _cmsRenderBanner(container, centerKey, suggestions) {
  if (!container) return;
  if (!suggestions || !suggestions.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  var html = '<div class="cms-banner">';
  html += '<div class="cms-banner-head">⚠️ ' + suggestions.length + ' رکورد CRM مشابه (از import قبلی) پیدا شد — ادغام اختیاری است</div>';
  suggestions.forEach(function (s) {
    var snap = s.snapshot || {};
    var srcKey = s.sourceKey || '';
    var tgtKey = s.targetKey || centerKey;
    html += '<div class="cms-card" data-sid="' + s.id + '">'
      + '<div class="cms-card-title">'
      + '<span class="cms-score">' + s.matchScore + '%</span> '
      + (s.matchReason === 'province_mismatch'
        ? '<span class="cms-warn-tag" title="آدرس در استان دیگری است — احتمالاً import اشتباه">📍 استان اشتباه</span> '
        : '')
      + '<span class="cms-card-label">رکورد مشابه:</span> '
      + _cmsNameLink(srcKey, s.sourceName || srcKey, 'باز کردن پروفایل رکورد CRM مشابه')
      + '<span class="cms-key">' + _cmsEsc(srcKey) + '</span>'
      + '</div>'
      + '<div class="cms-card-compare">'
      + '<span class="cms-card-label">مرکز در لیست:</span> '
      + _cmsNameLink(tgtKey, s.targetName || tgtKey, 'باز کردن پروفایل مرکز در لیست master')
      + '</div>'
      + '<div class="cms-card-meta">'
      + _cmsSnapLine(snap, 'status', 'وضعیت')
      + _cmsSnapLine(snap, 'owner', 'مالک')
      + _cmsSnapLine(snap, 'followupDate', 'پیگیری')
      + (snap.contactCount ? '<span class="cms-meta-item"><b>تماس:</b> ' + snap.contactCount + '</span>' : '')
      + '</div>'
      + '<div class="cms-card-actions">'
      + '<button type="button" class="cms-btn cms-btn-merge" data-act="merge" data-id="' + s.id + '">🔗 ادغام</button>'
      + '<button type="button" class="cms-btn cms-btn-sep" data-act="separate" data-id="' + s.id + '">➕ مرکز جداگانه</button>'
      + '<button type="button" class="cms-btn cms-btn-diff" data-act="diff" data-id="' + s.id + '" data-tkey="' + _cmsEsc(centerKey) + '">✏️ نام متفاوت است</button>'
      + '<button type="button" class="cms-btn cms-btn-later" data-act="defer" data-id="' + s.id + '">⏭ بعداً</button>'
      + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';

  container.querySelectorAll('.cms-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var act = btn.getAttribute('data-act');
      var id = parseInt(btn.getAttribute('data-id'), 10);
      var sug = suggestions.find(function (x) { return x.id === id; });
      if (!sug) return;
      if (act === 'merge') _cmsOpenMergePreview(sug, centerKey);
      else if (act === 'separate') _cmsSeparate(id, sug);
      else if (act === 'diff') _cmsRenameDismiss(id, sug);
      else if (act === 'defer') _cmsDefer(id, container, centerKey);
    });
  });

  container.querySelectorAll('.cms-name-link').forEach(function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var ck = btn.getAttribute('data-center-key');
      if (ck) _cmsOpenProfileByKey(ck);
    });
  });
}

function _cmsLoadMergeSuggestions(centerKey, modalDomId) {
  var box = document.getElementById('cmMergeSuggestBox');
  if (!box || !centerKey) return;
  box.innerHTML = '<div class="cms-loading">در حال بررسی مراکز مشابه…</div>';
  box.style.display = 'block';
  fetch('/api/center-merge/for/' + encodeURIComponent(centerKey), { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      _cmsRenderBanner(box, centerKey, (j && j.suggestions) || []);
    })
    .catch(function () {
      box.style.display = 'none';
    });
}

function _cmsOpenMergePreview(sug, targetKey) {
  var snap = sug.snapshot || {};
  var fields = [
    { key: 'status', label: 'وضعیت' },
    { key: 'owner', label: 'مسئول' },
    { key: 'lead', label: 'Lead' },
    { key: 'followupDate', label: 'تاریخ پیگیری' },
    { key: 'address', label: 'آدرس' },
    { key: 'potential', label: 'پتانسیل' },
  ];
  var body = '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px">داده orphan با این مرکز ادغام می‌شود. رکورد قبلی archive می‌ماند (حذف نمی‌شود).</p>'
    + '<div class="cms-preview-grid">';
  fields.forEach(function (f) {
    var sv = snap[f.key];
    if (sv == null || sv === '') return;
    body += '<div class="cms-preview-row"><label>' + f.label + ' (orphan)</label>'
      + '<select class="cms-pref" data-field="' + f.key + '">'
      + '<option value="prefer_target">نگه‌داشتن مقدار فعلی مرکز</option>'
      + '<option value="source">استفاده از orphan</option>'
      + '</select>'
      + '<span class="cms-preview-val">' + _cmsEsc(String(sv)) + '</span></div>';
  });
  body += '</div>';
  var foot = '<button type="button" class="btn-secondary" onclick="closeModal(\'cmsMergePrev\')">انصراف</button>'
    + '<button type="button" class="btn-primary" id="cmsMergeConfirmBtn">✓ تأیید ادغام</button>';
  openModal('cmsMergePrev', '🔗 ادغام با «' + _cmsEsc(sug.sourceName || sug.sourceKey) + '»', body, foot, { lg: true });
  setTimeout(function () {
    var btn = document.getElementById('cmsMergeConfirmBtn');
    if (btn) {
      btn.onclick = function () {
        var prefs = {};
        document.querySelectorAll('.cms-pref').forEach(function (sel) {
          prefs[sel.getAttribute('data-field')] = sel.value;
        });
        btn.disabled = true;
        fetch('/api/center-merge/' + sug.id + '/merge', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldPrefs: prefs }),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) { showToast('⚠️ ' + (res.j.error || 'خطا')); return; }
            closeModal('cmsMergePrev');
            showToast('✅ ادغام انجام شد', 3000);
            if (typeof loadDB === 'function') {
              loadDB().then(function () {
                if (typeof renderTable === 'function') renderTable();
                if (typeof renderBanner === 'function') renderBanner();
              });
            }
            var box = document.getElementById('cmMergeSuggestBox');
            if (box) _cmsLoadMergeSuggestions(targetKey);
          })
          .catch(function () { btn.disabled = false; showToast('خطا در ادغام'); });
      };
    }
  }, 50);
}

function _cmsSeparate(id, sug) {
  var defaultName = sug.sourceName || '';
  var name = prompt('نام مرکز جداگانه در لیست master:', defaultName);
  if (name === null) return;
  fetch('/api/center-merge/' + id + '/separate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠️ ' + (res.j.error || 'خطا')); return; }
      showToast('✅ مرکز «' + (res.j.name || name) + '» به لیست اضافه شد', 3500);
      if (typeof loadMasterCenters === 'function') loadMasterCenters().then(function () { if (typeof renderTable === 'function') renderTable(); });
      var box = document.getElementById('cmMergeSuggestBox');
      if (box) box.style.display = 'none';
    })
    .catch(function () { showToast('خطا'); });
}

function _cmsRenameDismiss(id, sug) {
  var newName = prompt('در صورت نیاز نام این مرکز را اصلاح کنید (خالی = فقط رد پیشنهاد):', '');
  if (newName === null) return;
  fetch('/api/center-merge/' + id + '/rename-dismiss', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName: newName.trim() }),
  })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠️ ' + (res.j.error || 'خطا')); return; }
      showToast('پیشنهاد رد شد', 2000);
      var box = document.getElementById('cmMergeSuggestBox');
      if (box) {
        var card = box.querySelector('[data-sid="' + id + '"]');
        if (card) card.remove();
        if (!box.querySelector('.cms-card')) box.style.display = 'none';
      }
      if (newName.trim() && typeof renderTable === 'function') renderTable();
    })
    .catch(function () { showToast('خطا'); });
}

function _cmsDefer(id, container, centerKey) {
  fetch('/api/center-merge/' + id + '/defer', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: 30 }),
  })
    .then(function (r) { return r.json(); })
    .then(function () {
      showToast('⏭ تا ۳۰ روز دیگر یادآوری نمی‌شود', 2500);
      var card = container.querySelector('[data-sid="' + id + '"]');
      if (card) card.remove();
      if (!container.querySelector('.cms-card')) container.style.display = 'none';
    })
    .catch(function () { showToast('خطا'); });
}

window._cmLoadMergeSuggestions = _cmsLoadMergeSuggestions;
window._cmsOpenProfileByKey = _cmsOpenProfileByKey;

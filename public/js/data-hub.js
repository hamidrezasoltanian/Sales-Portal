/* ═══ Data Hub — unified backup / import / export (Settings) ═══ */

var _dhStatus = null;
var _dhSnapshots = null;

function _dhIsAdmin() {
  if (typeof crmCanDataAdmin === 'function' && crmCanDataAdmin()) return true;
  if (typeof _isManager === 'function' && _isManager()) return true;
  if (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) return true;
  return false;
}

function openDataHub() {
  var isMgr = _dhIsAdmin();
  var tabs = [
    { id: 'auto', label: '⏰ بکاپ خودکار', mgr: true },
    { id: 'trash', label: '🗑 سطل زباله', mgr: true },
    { id: 'export', label: '⬇️ خروجی', mgr: false },
    { id: 'import', label: '⬆️ ورود', mgr: false },
    { id: 'restore', label: '📂 بازیابی', mgr: true },
  ].filter(function (t) { return !t.mgr || isMgr; });

  var tabBtns = tabs.map(function (t, i) {
    return '<button class="dh-tablink" id="dhLink_' + t.id + '" onclick="dhSwitchTab(\'' + t.id + '\')" '
      + 'style="flex:1;padding:8px 6px;border:none;border-radius:6px;background:' + (i === 0 ? '#1e3a5f' : 'transparent')
      + ';color:' + (i === 0 ? '#fff' : '#475569') + ';font-family:inherit;font-size:11px;font-weight:' + (i === 0 ? '700' : '400') + ';cursor:pointer">'
      + t.label + '</button>';
  }).join('');

  var body = '<div>'
    + '<div style="display:flex;gap:4px;margin-bottom:14px;background:var(--bg-raised);border-radius:8px;padding:3px;flex-wrap:wrap">'
    + tabBtns
    + '</div>'
    + '<div id="dhPanel_auto" class="dh-panel">' + _dhAutoPanelHtml(isMgr) + '</div>'
    + '<div id="dhPanel_trash" class="dh-panel" style="display:none">' + _dhTrashPanelHtml(isMgr) + '</div>'
    + '<div id="dhPanel_export" class="dh-panel" style="display:none">' + _dhExportPanelHtml(isMgr) + '</div>'
    + '<div id="dhPanel_import" class="dh-panel" style="display:none">' + _dhImportPanelHtml(isMgr) + '</div>'
    + '<div id="dhPanel_restore" class="dh-panel" style="display:none">' + _dhRestorePanelHtml(isMgr) + '</div>'
    + '</div>';

  openModal('dataHubModal', '📂 مدیریت داده‌ها — ورود / خروجی / بکاپ', body,
    '<button class="btn-secondary" onclick="closeModal(\'dataHubModal\')">بستن</button>',
    { lg: true });

  if (isMgr) _dhLoadBackupStatus();
}

function openUnifiedBackup() { openDataHub(); }

function dhSwitchTab(tab) {
  ['auto', 'trash', 'export', 'import', 'restore'].forEach(function (t) {
    var panel = document.getElementById('dhPanel_' + t);
    var link = document.getElementById('dhLink_' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (link) {
      link.style.background = t === tab ? '#1e3a5f' : 'transparent';
      link.style.color = t === tab ? '#fff' : '#475569';
      link.style.fontWeight = t === tab ? '700' : '400';
    }
  });
  if (tab === 'restore' && _dhIsAdmin()) _dhLoadSnapshots();
  if (tab === 'auto' && _dhIsAdmin()) _dhLoadBackupStatus();
  if (tab === 'trash' && _dhIsAdmin()) _dhLoadTrash();
}

function _dhTrashPanelHtml(isMgr) {
  if (!isMgr) {
    return '<div style="font-size:12px;color:var(--text-muted);padding:20px;text-align:center">سطل زباله فقط برای مدیر و سوپر ادمین قابل مشاهده است.</div>';
  }
  return '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">حذف‌های اخیر مراکز، وظایف، پزشکان، یادداشت‌ها، فرصت‌ها و فایل‌ها — قابل بازیابی توسط مدیر یا سوپر ادمین.</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">'
    + '<input type="search" id="dhTrashSearch" placeholder="🔍 جستجو نام، کلید، حذف‌کننده…" oninput="_dhTrashSearchDebounced()" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">'
    + '<select id="dhTrashFilter" onchange="_dhLoadTrash()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">'
    + '<option value="">همه انواع</option>'
    + '<option value="center">مراکز</option>'
    + '<option value="task">وظایف</option>'
    + '<option value="hcp">پزشکان</option>'
    + '<option value="center_note">یادداشت</option>'
    + '<option value="center_deal">فرصت فروش</option>'
    + '<option value="center_file">فایل مرکز</option>'
    + '</select>'
    + '<button type="button" onclick="_dhLoadTrash()" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:12px">🔄 بروزرسانی</button>'
    + '</div>'
    + '<div id="dhTrashList" style="max-height:360px;overflow-y:auto;font-size:12px">⏳ بارگذاری...</div>';
}

function _dhLoadTrash() {
  var el = document.getElementById('dhTrashList');
  if (!el) return;
  var type = (document.getElementById('dhTrashFilter') || {}).value || '';
  var q = (document.getElementById('dhTrashSearch') || {}).value || '';
  q = q.trim();
  var url = '/api/trash?limit=200' + (type ? '&type=' + encodeURIComponent(type) : '') + (q ? '&q=' + encodeURIComponent(q) : '');
  el.innerHTML = '⏳ بارگذاری...';
  fetch(url, { credentials: 'same-origin' })
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ('خطا ' + r.status));
        return d;
      });
    })
    .then(function (d) {
      var items = d.items || [];
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">' + (q ? 'نتیجه‌ای یافت نشد' : 'سطل زباله خالی است ✨') + '</div>';
        return;
      }
      el.innerHTML = '<table style="width:100%;border-collapse:collapse">'
        + '<thead><tr style="background:var(--bg-raised);text-align:right">'
        + '<th style="padding:6px 8px">نوع</th><th style="padding:6px 8px">عنوان</th><th style="padding:6px 8px">حذف‌کننده</th><th style="padding:6px 8px">تاریخ</th><th style="padding:6px 8px">عملیات</th>'
        + '</tr></thead><tbody>'
        + items.map(function (it) {
          var dt = it.deletedAt ? String(it.deletedAt).slice(0, 16).replace('T', ' ') : '—';
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:6px 8px;white-space:nowrap">' + esc(it.label || it.entityType) + (it.sensitive ? ' 🔒' : '') + '</td>'
            + '<td style="padding:6px 8px">' + esc(it.title || it.entityId) + '</td>'
            + '<td style="padding:6px 8px;font-size:11px">' + esc(it.deletedBy || '—') + '</td>'
            + '<td style="padding:6px 8px;font-size:11px;white-space:nowrap">' + esc(dt) + '</td>'
            + '<td style="padding:6px 8px;white-space:nowrap">'
            + '<button type="button" onclick="_dhRestoreTrash(' + it.id + ')" style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit;margin-left:4px">↩ بازیابی</button>'
            + '<button type="button" onclick="_dhPurgeTrash(' + it.id + ')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">🗑 دائمی</button>'
            + '</td></tr>';
        }).join('')
        + '</tbody></table>';
    })
    .catch(function (e) {
      el.innerHTML = '<div style="color:#dc2626;padding:12px">خطا: ' + esc(e.message) + '</div>';
    });
}

function _dhRestoreTrash(id) {
  if (!confirm('این مورد بازیابی شود؟')) return;
  fetch('/api/trash/' + id + '/restore', { method: 'POST', credentials: 'same-origin' })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.d.error || 'خطا در بازیابی')); return; }
      showToast('✅ بازیابی شد');
      _dhLoadTrash();
      if (typeof loadMasterCenters === 'function') loadMasterCenters().then(function () { if (typeof renderTable === 'function') renderTable(); });
      if (typeof renderTasksPanel === 'function') renderTasksPanel();
      if (typeof _hcpSearch === 'function') _hcpSearch();
    })
    .catch(function () { showToast('⚠ خطا در بازیابی'); });
}

function _dhPurgeTrash(id) {
  if (!confirm('حذف دائمی — این عمل غیرقابل بازگشت است. ادامه می‌دهید؟')) return;
  fetch('/api/trash/' + id + '/purge', { method: 'DELETE', credentials: 'same-origin' })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { showToast('⚠ ' + (res.d.error || 'خطا')); return; }
      showToast('🗑 حذف دائمی شد');
      _dhLoadTrash();
    })
    .catch(function () { showToast('⚠ خطا'); });
}
window._dhLoadTrash = _dhLoadTrash;
window._dhRestoreTrash = _dhRestoreTrash;
window._dhPurgeTrash = _dhPurgeTrash;
var _dhTrashSearchTimer = null;
function _dhTrashSearchDebounced() {
  if (_dhTrashSearchTimer) clearTimeout(_dhTrashSearchTimer);
  _dhTrashSearchTimer = setTimeout(_dhLoadTrash, 280);
}
window._dhTrashSearchDebounced = _dhTrashSearchDebounced;

function _dhAutoPanelHtml(isMgr) {
  if (!isMgr) {
    return '<div style="font-size:12px;color:var(--text-muted);padding:20px;text-align:center">بکاپ خودکار فقط برای مدیر و سوپر ادمین قابل مشاهده است.</div>';
  }
  return '<div id="dhAutoContent" style="font-size:12px;color:var(--text-muted);padding:16px;text-align:center">⏳ در حال بارگذاری وضعیت بکاپ...</div>';
}

function _dhExportPanelHtml(isMgr) {
  var lastBK = '';
  try { lastBK = localStorage.getItem('alb_' + (typeof USER !== 'undefined' && USER.name || currentUser || '')) || ''; } catch (e) {}
  var html = '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:12px">'
    + '<strong style="color:#0369a1">خروجی JSON</strong> — CRM، مطالبات، و داده‌های محلی در یک فایل'
    + (lastBK ? '<div style="margin-top:6px;font-size:11px;color:var(--text-muted)">آخرین بکاپ محلی: ' + esc(lastBK) + '</div>' : '')
    + '</div>'
    + '<button onclick="dhExportUnified()" style="width:100%;background:linear-gradient(135deg,#1e3a5f,#0ea5e9);color:#fff;border:none;border-radius:7px;padding:11px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">⬇️ بکاپ کامل JSON (CRM + مطالبات)</button>'
    + '<button onclick="exportDBJson()" style="width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">📄 خروجی JSON فقط CRM</button>';
  if (isMgr) {
    html += '<button onclick="downloadServerBackup()" style="width:100%;background:linear-gradient(135deg,#166534,#16a34a);color:#fff;border:none;border-radius:7px;padding:10px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">☁️ بکاپ سرور (SQL — همه کاربران)</button>';
  }
  html += '<div style="border-top:1px solid var(--border);margin:6px 0;padding-top:10px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:8px">📊 خروجی مراکز (Excel/CSV)</div>'
    + '<button onclick="exportCentersExcel();showToast(\'✅ فایل اکسل مراکز دانلود شد\')" style="width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">📊 دانلود همه مراکز (CSV)</button>'
    + '<button onclick="exportCSV();showToast(\'✅ CSV استان فعلی دانلود شد\')" style="width:100%;margin-top:6px;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">📋 خروجی استان جاری (CSV)</button>'
    + '</div></div>';
  return html;
}

function _dhImportPanelHtml(isMgr) {
  return '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:11px 14px;font-size:12px">'
    + '<strong style="color:#92400e">ورود مراکز از Excel</strong><br>'
    + '<span style="color:#78350f">دو روش: جایگزینی کل لیست اصلی، یا افزودن مراکز جدید به CRM</span>'
    + '</div>'
    + '<button onclick="closeModal(\'dataHubModal\');openDBManager()" style="width:100%;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:7px;padding:11px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">📦 جایگزینی دیتابیس مراکز (Excel)</button>'
    + '<button onclick="document.getElementById(\'importCentersInp\').click()" style="width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">📥 افزودن مراکز جدید (Excel)</button>'
    + '<button onclick="closeModal(\'dataHubModal\');openImport()" style="width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">➕ ورود مراکز به استان فعلی</button>'
    + '<a href="#" onclick="downloadDBTemplate();return false" style="text-align:center;color:#0ea5e9;font-size:11px">📥 دانلود قالب نمونه Excel</a>'
    + (isMgr ? '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:10px">'
      + '<button onclick="if(confirm(\'پاکسازی همه داده‌های CRM؟\'))clearAllData()" style="width:100%;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">🗑 پاکسازی داده‌های CRM</button>'
      + '</div>' : '')
    + '</div>';
}

function _dhRestorePanelHtml(isMgr) {
  var html = '<div style="display:flex;flex-direction:column;gap:12px">'
    + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:11px 14px;font-size:12px">'
    + '<strong style="color:#c2410c">⚠️ بازیابی JSON</strong> — تمام داده‌های فعلی جایگزین می‌شوند.'
    + '</div>'
    + '<label style="display:block;padding:18px;border:2px dashed #f59e0b;border-radius:8px;text-align:center;cursor:pointer;background:#fffbeb" onclick="document.getElementById(\'restoreInp\').click()">'
    + '<div style="font-size:26px;margin-bottom:4px">📂</div>'
    + '<div style="font-size:13px;font-weight:700;color:#92400e">انتخاب فایل بکاپ JSON</div>'
    + '<div style="font-size:11px;color:#a16207;margin-top:3px">فرمت v3/v4/v5 · CRM + مطالبات</div>'
    + '</label>'
    + '<button onclick="document.getElementById(\'dhJsonImportInp\').click()" style="width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:inherit;font-size:12px;cursor:pointer">📄 بازیابی JSON فقط CRM</button>'
    + '<input type="file" id="dhJsonImportInp" accept=".json" style="display:none" onchange="importDBJson(this)">';
  if (isMgr) {
    html += '<div style="border-top:1px solid var(--border);padding-top:12px">'
      + '<div style="font-size:12px;font-weight:700;margin-bottom:8px">🕐 نسخه‌های ذخیره‌شده (SQL)</div>'
      + '<div id="dhSnapshotsList" style="max-height:220px;overflow-y:auto;font-size:11px;color:var(--text-muted)">⏳ بارگذاری...</div>'
      + '</div>';
  }
  html += '</div>';
  return html;
}

function _dhLoadBackupStatus() {
  var el = document.getElementById('dhAutoContent');
  if (!el) return;
  fetch('/api/backups/status').then(function (r) { return r.json(); }).then(function (d) {
    if (!d.ok || !d.status) { el.textContent = 'خطا در دریافت وضعیت'; return; }
    _dhStatus = d.status;
    var s = d.status;
    var latest = s.latestFile;
    el.innerHTML = '<div style="text-align:right">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + _dhStatBox('وضعیت', s.cronPrimary ? '⏰ Cron (OS)' : (s.enabled ? '✅ Node' : '⏸ غیرفعال'), s.cronPrimary ? '#0ea5e9' : (s.enabled ? '#16a34a' : '#94a3b8'))
      + _dhStatBox('نگهداری', s.retentionDays + ' روز', '#6366f1')
      + _dhStatBox('زمان‌بندی', '11 · 13 · 18', '#0ea5e9')
      + _dhStatBox('تعداد فایل', String(s.fileCount || 0), '#f59e0b')
      + '</div>'
      + '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;font-size:11px">'
      + '<div><strong>منطقه زمانی:</strong> ' + esc(s.timezone) + ' · <strong>الان:</strong> ' + esc(s.tehranNow) + '</div>'
      + '<div style="margin-top:4px;color:var(--text-muted)">مسیر: <code style="font-size:10px">' + esc(s.backupDir) + '</code></div>'
      + '<div style="margin-top:4px;font-size:10px;color:var(--text-muted)">'
      + (s.cronPrimary
        ? '⏰ زمان‌بندی روی cron (مستقل از PM2) · health-check هر ساعت'
        : '⚠️ Node scheduler فعال — توصیه: AUTO_BACKUP_SCHEDULER=false + setup-backup-cron.sh')
      + '</div>'
      + (latest ? '<div style="margin-top:6px">آخرین بکاپ: <strong>' + esc(latest.name) + '</strong> (' + esc(latest.sizeHuman) + ') — ' + esc(latest.createdAt.slice(0, 16).replace('T', ' ')) + '</div>' : '<div style="margin-top:6px;color:#dc2626">هنوز بکاپی ثبت نشده</div>')
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:12px">'
      + '<button onclick="dhRunBackup(\'scheduled\')" style="flex:1;background:#166534;color:#fff;border:none;border-radius:6px;padding:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">▶️ بکاپ کامل الان</button>'
      + '<button onclick="dhRunBackup(\'appdata\')" style="flex:1;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:9px;font-family:inherit;font-size:12px;cursor:pointer">💾 بکاپ سبک</button>'
      + '</div>'
      + _dhFilesTable(s.files || [])
      + '</div>';
  }).catch(function (e) {
    el.textContent = 'خطا: ' + e.message;
  });
}

function _dhStatBox(label, value, color) {
  return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px;border-right:3px solid ' + color + '">'
    + '<div style="font-size:10px;color:var(--text-muted)">' + label + '</div>'
    + '<div style="font-size:14px;font-weight:700;margin-top:2px">' + value + '</div></div>';
}

function _dhFilesTable(files) {
  if (!files.length) return '<div style="font-size:11px;color:var(--text-muted)">فایلی یافت نشد</div>';
  var rows = files.slice(0, 15).map(function (f) {
    return '<tr style="border-bottom:1px solid var(--border)">'
      + '<td style="padding:5px 4px">' + esc(f.name) + '</td>'
      + '<td style="padding:5px 4px;white-space:nowrap">' + esc(f.sizeHuman) + '</td>'
      + '<td style="padding:5px 4px;white-space:nowrap;font-size:10px">' + esc(f.createdAt.slice(0, 16).replace('T', ' ')) + '</td>'
      + '<td style="padding:5px 4px"><a href="/api/backups/download/' + encodeURIComponent(f.name) + '" download style="color:#0ea5e9;font-size:10px">⬇️</a></td>'
      + '</tr>';
  }).join('');
  return '<div style="font-size:11px;font-weight:700;margin-bottom:4px">📁 فایل‌های بکاپ (۱۵ مورد اخیر)</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="color:var(--text-muted)">'
    + '<th style="text-align:right;padding:4px">فایل</th><th>حجم</th><th>تاریخ</th><th></th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

function dhRunBackup(mode) {
  showToast('⏳ در حال گرفتن بکاپ...');
  fetch('/api/backups/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: mode || 'scheduled' }),
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.ok) {
      showToast('✅ بکاپ با موفقیت گرفته شد', 3000);
      _dhLoadBackupStatus();
    } else {
      showToast('❌ ' + (d.error || 'خطا'));
    }
  }).catch(function (e) { showToast('❌ ' + e.message); });
}

function _dhLoadSnapshots() {
  var el = document.getElementById('dhSnapshotsList');
  if (!el) return;
  fetch('/api/backups/snapshots?limit=30').then(function (r) { return r.json(); }).then(function (d) {
    if (!d.ok || !d.snapshots || !d.snapshots.length) {
      el.innerHTML = '<div style="padding:8px">نسخه‌ای یافت نشد</div>';
      return;
    }
    _dhSnapshots = d.snapshots;
    el.innerHTML = d.snapshots.map(function (s) {
      var at = s.saved_at instanceof Object ? String(s.saved_at).slice(0, 19) : String(s.saved_at).slice(0, 19);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid var(--border)">'
        + '<span>#' + s.id + ' · ' + esc(at.replace('T', ' ')) + ' · ' + esc(s.saved_by || '—') + '</span>'
        + '<button onclick="dhRestoreSnapshot(' + s.id + ')" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:inherit">بازیابی</button>'
        + '</div>';
    }).join('');
  }).catch(function (e) {
    el.textContent = 'خطا: ' + e.message;
  });
}

function dhRestoreSnapshot(id) {
  if (!confirm('⚠️ بازیابی نسخه #' + id + '؟\nداده‌های فعلی CRM با این نسخه جایگزین می‌شوند.')) return;
  showToast('⏳ در حال بازیابی...');
  fetch('/api/data/history/' + id + '/restore', { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) {
        showToast('✅ بازیابی شد — صفحه رفرش می‌شود', 2500);
        setTimeout(function () { location.reload(); }, 2600);
      } else {
        showToast('❌ ' + (d.error || 'خطا'));
      }
    }).catch(function (e) { showToast('❌ ' + e.message); });
}

function dhExportUnified() {
  var doExport = function () {
    if (typeof unifiedExport === 'function') {
      unifiedExport();
      return;
    }
    var repName = (typeof USER !== 'undefined' && USER.name) || currentUser || '';
    var payload = {
      ver: 5, app: 'atena_unified', date: todayStr(),
      exportedAt: new Date().toISOString(),
      user: repName, db: DB,
    };
    if (typeof loadData === 'function' && typeof META !== 'undefined') {
      payload.mtrMeta = JSON.parse(JSON.stringify(META));
      payload.mtrData = loadData();
      payload.mtrUser = { name: USER.name, role: USER.role || 'rep' };
    }
    idbGet('centersDB').then(function (centersData) {
      payload.centersDB = centersData || null;
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'atena_backup_' + todayStr().replace(/\//g, '-') + '.json';
      a.click();
      showToast('💾 بکاپ JSON دانلود شد', 3000);
      try { localStorage.setItem('alb_' + repName, todayStr()); } catch (e) {}
    });
  };
  if (typeof loadData !== 'function' && typeof ensureTabScripts === 'function') {
    ensureTabScripts('mtr').then(doExport).catch(doExport);
  } else {
    doExport();
  }
}

function ubSwitchTab(tab) { dhSwitchTab(tab === 'export' ? 'export' : 'restore'); }

document.addEventListener('keydown', function (e) {
  if (!e || typeof e.key !== 'string') return;
  var tgt = e.target;
  var inInput = tgt && typeof tgt.matches === 'function' && tgt.matches('input,textarea,select');
  if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !inInput) {
    e.preventDefault();
    openDataHub();
  }
});

/* ═══ public/js/manager.js ═══ */
// ═══ Safety fallbacks: these are defined in core.js / onboarding.js but guard
//     against any loading-order or cache issue so init() never throws ReferenceError ═══
if (typeof initSSE === 'undefined') {
  window.initSSE = function() { console.warn('[CRM] initSSE stub — will retry'); };
}
if (typeof checkEmptyDB === 'undefined') {
  window.checkEmptyDB = function() {};
}
if (typeof cleanupOrphanedEntries === 'undefined') {
  window.cleanupOrphanedEntries = function() { return {removedWP:0,removedFU:0}; };
}
// ════════════════════════ INIT ════════════════════════
var _typeFilterBuilt=false;
function buildTypeFilter(){
  if(_typeFilterBuilt)return;_typeFilterBuilt=true;
  var types=new Set();
  CENTERS.forEach(function(c){if(c.type)types.add(c.type.trim());});
  Object.values(PC_RAW).forEach(function(arr){arr.forEach(function(r){if(r[3])types.add(r[3].replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim());});});
  (DB.extra||[]).forEach(function(c){if(c.type)types.add(c.type.trim());});
  var ft=document.getElementById('fType');
  if(ft){
    var prev=ft.value;
    ft.innerHTML='<option value="">همه انواع</option>';
    Array.from(types).sort().forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;ft.appendChild(o);});
    if(prev)ft.value=prev;
  }
}
// ════════════════════════ SETTINGS MODAL ═════════════════════════════
function openSettings(){
  var s=DB.settings||{};
  var members=s.members||_DEFAULT_MEMBERS;
  var companyName=s.companyName||'آتنا زیست درمان';
  var companyInfo=s.companyInfo||'';
  var sipDomain=s.sipDomain||'';
  var anthropicKey=s.anthropicKey||'';
  var ckItems=s.ckItems||CK_ITEMS_DEFAULT;

  var membersHtml=members.map(function(m,i){
    return'<tr id="mrow_'+i+'">'
      +'<td><input class="ed-inp" style="width:110px" value="'+esc(m.id)+'" id="mid_'+i+'" placeholder="کد کاربری (انگلیسی)"></td>'
      +'<td><input class="ed-inp" style="width:110px" value="'+esc(m.name)+'" id="mname_'+i+'" placeholder="نام و نام خانوادگی"></td>'
      +'<td><input class="ed-inp" style="width:90px" value="'+esc(m.role||'')+'" id="mrole_'+i+'" placeholder="سمت"></td>'
      +'<td><button onclick="removeMemberRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px">✕</button></td>'
      +'</tr>';
  }).join('');

  var ckHtml=ckItems.map(function(item,i){
    return'<div id="ckrow_'+i+'" style="display:flex;gap:6px;align-items:center;margin-bottom:5px">'
      +'<input class="ed-inp" style="flex:1" value="'+esc(item.t)+'" id="ckt_'+i+'" placeholder="متن وظیفه">'
      +'<label style="font-size:11px;display:flex;gap:3px;align-items:center"><input type="checkbox" id="ckmgr_'+i+'"'+(item.mgr?' checked':'')+'>مدیر</label>'
      +'<button onclick="removeCKRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">✕</button>'
      +'</div>';
  }).join('');

  var body='<div style="margin-bottom:14px;background:linear-gradient(135deg,#f0f9ff,#faf5ff);border:1px solid #bae6fd;border-radius:10px;padding:12px 16px">'
    +'<div style="font-size:11px;font-weight:700;color:#0c4a6e;margin-bottom:10px">⚡ دسترسی سریع به تنظیمات</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">'
    +'<button onclick="closeModal(\'settingsModal\');openUserMgmt()" style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:1px solid #c7d2fe;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-family:inherit;color:#4338ca">👥<span>مدیریت کاربران</span></button>'
    +(_isManager()?'<button onclick="switchTab(\'kpi\');closeModal(\'settingsModal\')" style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-family:inherit;color:#16a34a">📊<span>پنل KPI</span></button>':'')
    +'<button onclick="openTkColumnsModal();closeModal(\'settingsModal\')" style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:1px solid #fde68a;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-family:inherit;color:#92400e">📌<span>ستون‌های وظایف</span></button>'
    +(_isManager()?'<button onclick="closeModal(\'settingsModal\');openDailyMonitor()" style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:1px solid #fbcfe8;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-family:inherit;color:#9d174d">📋<span>گزارش روزانه</span></button>':'')
    +(_isManager()?'<button onclick="closeModal(\'settingsModal\');openOverdueList()" style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:1px solid #fca5a5;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-family:inherit;color:#991b1b">⚠️<span>معوقات</span></button>':'')
    +'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام شرکت</label>'
    +'<input id="stgCompanyName" class="ed-inp" style="width:100%" value="'+esc(companyName)+'" placeholder="نام شرکت"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">توضیحات/اطلاعات شرکت</label>'
    +'<input id="stgCompanyInfo" class="ed-inp" style="width:100%" value="'+esc(companyInfo)+'" placeholder="توضیحات اختیاری"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">📞 آدرس سرور SIP (VoIP)</label>'
    +'<input id="stgSipDomain" class="ed-inp" style="width:100%" value="'+esc(sipDomain)+'" placeholder="مثلاً: pbx.company.com">'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">برای تماس با Linphone — خالی = tel:</div>'
    +'</div>'
    +'</div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">🤖 کلید API کلود (Anthropic)</label>'
    +'<input id="stgAnthropicKey" class="ed-inp" style="width:100%" type="password" value="'+esc(anthropicKey)+'" placeholder="sk-ant-api03-...">'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">برای جستجوی هوشمند مراکز (KPI ← مراکز کشف‌شده)</div>'
    +'</div>'
    +'<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:3px">👥 مدیریت کاربران</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">کارشناسان، نقش‌ها، رنگ‌ها، مالکیت استان‌ها و جابجایی مراکز</div>'
    +'</div>'
    +'<button onclick="closeModal(\'settingsModal\');openUserMgmt()" style="background:var(--brand);color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600">باز کردن ←</button>'
    +'</div>'
    +'<div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<label style="font-size:12px;font-weight:700">✅ وظایف چک‌لیست روزانه</label>'
    +'<button onclick="addCKRow()" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:11px">+ وظیفه جدید</button>'
    +'</div>'
    +'<div id="ckItemsList" style="max-height:220px;overflow-y:auto;padding:4px 0">'+ckHtml+'</div>'
    +'</div>'
    // ── برچسب‌های مراکز
    +'<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +'<label style="font-size:12px;font-weight:700">🏷 برچسب‌های مراکز</label>'
    +'<button onclick="addTagRow()" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:11px">+ برچسب جدید</button>'
    +'</div>'
    +'<div id="tagsSettingsList" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;min-height:32px">'
    +(DB.tags||[]).map(function(t,i){
      return'<div style="display:flex;align-items:center;gap:4px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:4px 6px">'
        +'<input type="color" value="'+t.color+'" id="tagcolor_'+t.id+'" style="width:24px;height:24px;border:none;cursor:pointer;background:none" title="رنگ">'
        +'<input type="text" value="'+esc(t.name)+'" id="tagname_'+t.id+'" style="border:none;background:none;font-size:12px;width:90px;outline:1px solid transparent" onfocus="this.style.outline=\'1px solid #0ea5e9\'" onblur="this.style.outline=\'1px solid transparent\'">'
        +'<button onclick="deleteTagFromSettings(\''+t.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;padding:1px 5px;font-size:11px">✕</button>'
        +'</div>';
    }).join('')
    +'</div></div>';

  // بخش ویرایش لیست‌های سیستمی — فقط مدیر
  if(_isManager()){
    body+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      +'<label style="font-size:12px;font-weight:700">⚙ ویرایش لیست‌های سیستمی</label>'
      +'<span style="font-size:10px;color:var(--text-muted);background:var(--bg-raised);border-radius:4px;padding:2px 7px">فقط مدیر</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:7px 10px;margin-bottom:10px">'
      +'⚠ هر آیتم در یک خط — تغییر وضعیت‌ها بر داده‌های ثبت‌شده تأثیر می‌گذارد.</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📊 وضعیت‌ها</label>'
      +'<textarea id="stgStatusList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+STATUS_LIST.join('\n')+'</textarea></div>'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🎯 سرنخ‌ها</label>'
      +'<textarea id="stgLeadList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+LEAD_LIST.join('\n')+'</textarea></div>'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🏥 نوع مراکز</label>'
      +'<textarea id="stgTypeList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+TYPE_LIST.join('\n')+'</textarea></div>'
      +'</div></div>';
  }
  var foot='<button class="btn-secondary" onclick="closeModal(\'settingsModal\')">انصراف</button>'
    +'<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #fcd34d;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="cleanupOrphanedEntries(true);renderDashboard()">🧹 پاک‌سازی ورودی‌های منسوخ</button>'
    +'<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #7dd3fc;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="var n=wpDeduplicateEntries();if(n>0){saveDBSync();_debouncedRenderWeekPlan();showToast(\'✅ \'+n+\' ورودی تکراری هفته حذف شد\',3000);}else{showToast(\'✅ هیچ تکراری یافت نشد\');}">📋 حذف تکراری‌های هفته</button>'
    +'<button class="btn-primary" onclick="saveSettings()">💾 ذخیره تنظیمات</button>';
  // Backup/Restore JSON section
  body += '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">💾 پشتیبان‌گیری داده‌ها</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="exportDBJson()" class="btn-secondary" style="font-size:12px">📥 دانلود پشتیبان JSON</button>'
    +'<label class="btn-secondary" style="font-size:12px;cursor:pointer">📤 بازیابی از فایل<input type="file" accept=".json" onchange="importDBJson(this)" style="display:none"></label>'
    +'</div>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:6px">پشتیبان شامل همه مراکز، یادداشت‌ها، تنظیمات و مطالبات می‌شود</div>'
    +'</div>';
  // Data management section
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="font-size:12px;font-weight:700;margin-bottom:10px">📂 مدیریت داده‌ها</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">'
    +'<button onclick="closeModal(\'settingsModal\');openUnifiedBackup()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">💾</span><span style=\"font-weight:600\">بک‌آپ / ریستور</span><span style=\"color:var(--text-muted);font-size:10px\">خروجی و بازیابی داده</span></button>'
    +'<button onclick="closeModal(\'settingsModal\');openDBManager()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📦</span><span style=\"font-weight:600\">دیتابیس مراکز</span><span style=\"color:var(--text-muted);font-size:10px\">مدیریت لیست اصلی</span></button>'
    +'<button onclick="closeModal(\'settingsModal\');document.getElementById(\'importCentersInp\').click()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📥</span><span style=\"font-weight:600\">ورود از اکسل</span><span style=\"color:var(--text-muted);font-size:10px\">افزودن مراکز جدید</span></button>'
    +'<button onclick="exportCentersExcel();closeModal(\'settingsModal\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📊</span><span style=\"font-weight:600\">خروجی اکسل</span><span style=\"color:var(--text-muted);font-size:10px\">دانلود همه مراکز</span></button>'
    +'<button onclick="if(confirm(\'پاکسازی همه داده‌ها؟\'))clearAllData()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid #fca5a5;border-radius:8px;background:#fee2e220;cursor:pointer;font-size:11px;font-family:inherit;color:#dc2626"><span style=\"font-size:18px\">🗑</span><span style=\"font-weight:600\">پاکسازی داده‌ها</span><span style=\"font-size:10px\">حذف کامل اطلاعات</span></button>'
    +(_isManager()?'<button onclick="closeModal(\'settingsModal\');openDistributionWizard()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid #c4b5fd;border-radius:8px;background:#f5f3ff;cursor:pointer;font-size:11px;font-family:inherit;color:#5b21b6"><span style=\"font-size:18px\">🔀</span><span style=\"font-weight:600\">تقسیم مراکز</span><span style=\"color:var(--text-muted);font-size:10px\">توزیع بین کارشناسان</span></button>':'')
    +'</div></div>';
  // ── Notification settings section ──────────────────────────────────────────
  var _np = (DB.settings&&DB.settings.notifPrefs)||{};
  var _npEnabled  = _np.enabled  !== false;   // default true
  var _npAuto     = _np.autoSend !== false;   // default true
  var _npTypes    = _np.types || {};
  function _npChk(k){ return (_npTypes[k] !== false) ? 'checked' : ''; }
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    + '<div><div style="font-size:12px;font-weight:700;color:var(--text-primary)">🔔 تنظیمات اعلان‌ها</div>'
    + '<div style="font-size:11px;color:var(--text-muted)">کنترل ارسال و نوع اعلان‌های خودکار سیستم</div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    // enable/disable toggle
    + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
    + '<input type="checkbox" id="stgNotifEnabled" style="width:16px;height:16px;cursor:pointer;accent-color:var(--brand)"'
    + (_npEnabled ? ' checked' : '') + '>'
    + '<div><div style="font-size:12px;font-weight:600">اعلان‌ها فعال</div>'
    + '<div style="font-size:10px;color:var(--text-muted)">ارسال و نمایش اعلان‌های خودکار</div></div></label>'
    // auto/manual toggle
    + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
    + '<input type="checkbox" id="stgNotifAuto" style="width:16px;height:16px;cursor:pointer;accent-color:var(--brand)"'
    + (_npAuto ? ' checked' : '') + '>'
    + '<div><div style="font-size:12px;font-weight:600">ارسال خودکار</div>'
    + '<div style="font-size:10px;color:var(--text-muted)">غیرفعال = اعلان‌ها در صف انتظار باقی می‌مانند</div></div></label>'
    + '</div>'
    + '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">نوع اعلان‌های فعال:</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 8px">'
    + '<input type="checkbox" id="stgNtMorning" style="accent-color:var(--brand)" ' + _npChk('morning_brief') + '>🌅 بریفینگ صبحگاهی</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 8px">'
    + '<input type="checkbox" id="stgNtFollowup" style="accent-color:var(--brand)" ' + _npChk('followup') + '>⚠️ مراکز معوق و بدون تاریخ</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 8px">'
    + '<input type="checkbox" id="stgNtTask" style="accent-color:var(--brand)" ' + _npChk('task') + '>📌 وظایف جدید</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 8px">'
    + '<input type="checkbox" id="stgNtOwner" style="accent-color:var(--brand)" ' + _npChk('owner_change') + '>🔄 تغییر مالکیت مرکز</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 8px">'
    + '<input type="checkbox" id="stgNtGeneral" style="accent-color:var(--brand)" ' + _npChk('general') + '>📩 پیام‌های مستقیم مدیر</label>'
    + '</div></div>';
  // ── KPI targets quick-access (manager only)
  if(_isManager()){
    var _kpiExperts=(typeof umGetActive==='function'?umGetActive():[]).filter(function(m){return m.id!=='guest'&&m.role!=='مدیر'&&m.role!=='سوپر ادمین';});
    body+='<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">';
    body+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    body+='<div><div style="font-size:12px;font-weight:700;color:var(--text-primary)">🎯 اهداف KPI کارشناسان</div>';
    body+='<div style="font-size:11px;color:var(--text-muted)">تنظیم اهداف ماهانه تماس، ویزیت و فروش برای هر کارشناس</div></div>';
    body+='<button onclick="switchTab(\'kpi\');closeModal(\'settingsModal\')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">📊 رفتن به KPI</button>';
    body+='</div>';
    body+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">';
    _kpiExperts.forEach(function(m){
      var t=(typeof getKPITarget==='function')?getKPITarget(m.id,currentJMonth()):{callsPerDay:10,visitsPerWeek:5};
      body+='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:8px 10px">';
      body+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">';
      body+='<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+(m.color||'#94a3b8')+';flex-shrink:0"></span>';
      body+='<span style="font-size:11px;font-weight:700;color:var(--text-primary)">'+esc(m.name)+'</span></div>';
      body+='<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px">📞 '+t.callsPerDay+'/روز  •  🚗 '+t.visitsPerWeek+'/هفته</div>';
      body+='<button onclick="closeModal(\'settingsModal\');openKPITargets(\''+m.id+'\',\''+currentJMonth()+'\')" style="width:100%;background:var(--brand);color:#fff;border:none;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:10px;font-family:inherit">🎯 تنظیم هدف ماه جاری</button>';
      body+='</div>';
    });
    body+='</div></div>';
  }
  openModal('settingsModal','⚙ تنظیمات نرم‌افزار',body,foot,{lg:true});
}

function addMemberRow(){
  var tbody=document.getElementById('membersTable');if(!tbody)return;
  var i=tbody.rows.length;
  var tr=document.createElement('tr');tr.id='mrow_'+i;
  tr.innerHTML='<td><input class="ed-inp" style="width:110px" id="mid_'+i+'" placeholder="کد کاربری"></td>'
    +'<td><input class="ed-inp" style="width:110px" id="mname_'+i+'" placeholder="نام"></td>'
    +'<td><input class="ed-inp" style="width:90px" id="mrole_'+i+'" placeholder="سمت"></td>'
    +'<td><button onclick="removeMemberRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px">✕</button></td>';
  tbody.appendChild(tr);
}
function removeMemberRow(i){var r=document.getElementById('mrow_'+i);if(r)r.remove();}

function addCKRow(){
  var list=document.getElementById('ckItemsList');if(!list)return;
  var i=list.children.length;
  var div=document.createElement('div');div.id='ckrow_'+i;
  div.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:5px';
  div.innerHTML='<input class="ed-inp" style="flex:1" id="ckt_'+i+'" placeholder="متن وظیفه">'
    +'<label style="font-size:11px;display:flex;gap:3px;align-items:center"><input type="checkbox" id="ckmgr_'+i+'">مدیر</label>'
    +'<button onclick="removeCKRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">✕</button>';
  list.appendChild(div);
}
function removeCKRow(i){var r=document.getElementById('ckrow_'+i);if(r)r.remove();}

function saveSettings(){
  var companyName=(document.getElementById('stgCompanyName').value||'').trim()||'شرکت';
  var companyInfo=(document.getElementById('stgCompanyInfo').value||'').trim();
  // Members managed via openUserMgmt — preserve existing
  var members = umGetMembers();
  // collect ck items
  var ckList=document.getElementById('ckItemsList');
  var ckItems=[];
  if(ckList){Array.from(ckList.children).forEach(function(div,i){
    var t=(document.getElementById('ckt_'+i)||{}).value;
    var mgr=(document.getElementById('ckmgr_'+i)||{}).checked;
    if(t&&t.trim())ckItems.push({id:i+1,t:t.trim(),mgr:mgr||undefined});
  });}
  if(!ckItems.length)ckItems=null;
  if(!DB.settings)DB.settings={};
  DB.settings.companyName=companyName;
  DB.settings.companyInfo=companyInfo;
  var _sipDomRaw=(document.getElementById('stgSipDomain')||{}).value||'';
  DB.settings.sipDomain=_sipDomRaw.trim().replace(/^\/+|\/+$/g,'');
  var _anthKey=(document.getElementById('stgAnthropicKey')||{}).value||'';
  if(_anthKey.trim())DB.settings.anthropicKey=_anthKey.trim();
  DB.settings.members=members;
  DB.settings.ckItems=ckItems;
  // ذخیره تنظیمات اعلان‌ها
  var _npE=document.getElementById('stgNotifEnabled');
  var _npA=document.getElementById('stgNotifAuto');
  if(_npE||_npA){
    if(!DB.settings.notifPrefs)DB.settings.notifPrefs={};
    if(_npE)DB.settings.notifPrefs.enabled=_npE.checked;
    if(_npA)DB.settings.notifPrefs.autoSend=_npA.checked;
    DB.settings.notifPrefs.types={
      morning_brief:!!(document.getElementById('stgNtMorning')||{checked:true}).checked,
      followup:!!(document.getElementById('stgNtFollowup')||{checked:true}).checked,
      task:!!(document.getElementById('stgNtTask')||{checked:true}).checked,
      owner_change:!!(document.getElementById('stgNtOwner')||{checked:true}).checked,
      general:!!(document.getElementById('stgNtGeneral')||{checked:true}).checked
    };
  }
  // ذخیره برچسب‌های ویرایش‌شده
  if(!DB.tags)DB.tags=[];
  DB.tags.forEach(function(t){
    var nameEl=document.getElementById('tagname_'+t.id);
    var colorEl=document.getElementById('tagcolor_'+t.id);
    if(nameEl&&nameEl.value.trim())t.name=nameEl.value.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    if(colorEl)t.color=colorEl.value;
  });
  // ذخیره لیست‌های سفارشی
  if(_isManager()){
    var _staTa=document.getElementById('stgStatusList');
    if(_staTa){var _sl=_staTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_sl.length>=2){DB.settings.statusList=_sl;STATUS_LIST=_sl;}}
    var _ldTa=document.getElementById('stgLeadList');
    if(_ldTa){var _ll=_ldTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_ll.length>=2){DB.settings.leadList=_ll;LEAD_LIST=_ll;}}
    var _tpTa=document.getElementById('stgTypeList');
    if(_tpTa){var _tl=_tpTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_tl.length>=1){DB.settings.typeList=_tl;TYPE_LIST=_tl;}}
  }
  saveDB();
  buildUSERS();
  closeModal('settingsModal');
  rebuildFilters();
  if(currentTab==='checklist')renderChecklist();
  showToast('✅ تنظیمات ذخیره شد',2500);
}

function addTagRow(){
  if(!DB.tags)DB.tags=[];
  var colors=['#0ea5e9','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#ec4899','#84cc16'];
  var newTag={id:'tag_'+Date.now(),name:'برچسب جدید',color:colors[DB.tags.length%colors.length]};
  DB.tags.push(newTag);saveDB();
  var list=document.getElementById('tagsSettingsList');
  if(!list)return;
  var div=document.createElement('div');
  div.style.cssText='display:flex;align-items:center;gap:4px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:4px 6px';
  div.innerHTML='<input type="color" value="'+newTag.color+'" id="tagcolor_'+newTag.id+'" style="width:24px;height:24px;border:none;cursor:pointer;background:none">'
    +'<input type="text" value="'+newTag.name+'" id="tagname_'+newTag.id+'" style="border:none;background:none;font-size:12px;width:90px;outline:1px solid #0ea5e9" autofocus>'
    +'<button onclick="deleteTagFromSettings(\''+newTag.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;padding:1px 5px;font-size:11px">✕</button>';
  list.appendChild(div);
  setTimeout(function(){div.querySelector('input[type=text]').focus();},50);
}

function deleteTagFromSettings(tagId){
  if(!confirm('این برچسب از همه مراکز حذف می‌شود. ادامه می‌دهید؟'))return;
  DB.tags=(DB.tags||[]).filter(function(t){return t.id!==tagId;});
  Object.keys(DB.rTags||{}).forEach(function(k){
    DB.rTags[k]=(DB.rTags[k]||[]).filter(function(id){return id!==tagId;});
  });
  saveDB();
  var el=document.getElementById('tagcolor_'+tagId);
  if(el&&el.closest('div'))el.closest('div').remove();
}

// ════════════════════════ MANAGER KPI PANEL ══════════════════════
function renderManagerPanel(){
  var el=document.getElementById('managerPanel');if(!el)return;
  var today=todayStr();
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  // compute stats per member (active only — inactive owner centers won't be counted)
  var stats={};
  members.filter(function(m){return m.active!==false;}).forEach(function(m){
    stats[m.id]={name:m.name,role:m.role||'',contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
  });
  // scan all edits
  _buildPCCache();
  var allProvs=getAllProvinces();
  allProvs.forEach(function(p){
    var rtype=getProvType(p.id);
    var centers=getProvCenters(p.id);
    centers.forEach(function(c){
      var e=getE(rtype,c.id);
      var owner=e.owner||c.owner||'';
      if(!stats[owner])return;
      stats[owner].totalAssigned++;
      var st=e.status||'بدون تماس';
      if(st==='قرارداد بسته شد')stats[owner].contracted++;
      else if(st==='ملاقات انجام شد')stats[owner].meetings++;
      else if(st==='پیشنهاد ارسال شد')stats[owner].proposals++;
      else if(st==='تماس اولیه')stats[owner].firstContact++;
      var fd=e.followupDate||'';
      if(fd&&fd<today&&st!=='قرارداد بسته شد'&&st!=='غیرفعال')stats[owner].overdue++;
      if(fd&&fd===today)stats[owner].followupToday++;
      if(isStalled(rtype,c.id))stats[owner].stalled++;
    });
  });
  // totals
  var total={contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
  Object.values(stats).forEach(function(s){Object.keys(total).forEach(function(k){total[k]+=s[k]||0;});});

  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0)+(DB.extra||[]).length;

  var html='<div style="padding:14px">';
  // quick-action bar for manager
  html+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">'
    +'<button onclick="openDailyMonitor()" style="flex:1;min-width:200px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📋 گزارش فعالیت امروز</button>'
    +'<button onclick="openOverdueList()" style="flex:1;min-width:160px;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🔴 پیگیری‌های معوق</button>'
    +'</div>';
  // summary cards
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px">';
  [
    {n:totalCenters,l:'کل مراکز',c:'#0ea5e9'},
    {n:total.totalAssigned,l:'مراکز تخصیص‌یافته',c:'#8b5cf6'},
    {n:total.contracted,l:'قرارداد بسته شد ✓',c:'#22c55e'},
    {n:total.meetings,l:'ملاقات انجام شد',c:'#f59e0b'},
    {n:total.proposals,l:'پیشنهاد ارسال',c:'#0284c7'},
    {n:total.overdue,l:'پیگیری معوق 🔴',c:'#dc2626',click:'openOverdueList()'},
    {n:total.followupToday,l:'پیگیری امروز 📅',c:'#f59e0b'},
    {n:total.stalled,l:'راکد +۳۰روز 🟠',c:'#ea580c'},
  ].forEach(function(k){
    html+='<div class="kpi-card" style="border-right-color:'+k.c+(k.click?';cursor:pointer':'')+'"'+(k.click?' onclick="'+k.click+'"':'')+'>'
      +'<div class="kpi-num" style="font-size:28px">'+k.n+'</div>'
      +'<div class="kpi-label">'+k.l+'</div></div>';
  });
  html+='</div>';

  // per-member table
  html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden">'
    +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📋 عملکرد کارشناسان</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px 10px;text-align:right">کارشناس</th>'
    +'<th style="padding:8px 10px;text-align:center">مراکز</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#22c55e">قرارداد ✓</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#f59e0b">ملاقات</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#0284c7">پیشنهاد</th>'
    +'<th style="padding:8px 10px;text-align:center;color:var(--text-muted)">تماس اولیه</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#dc2626">معوق 🔴</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#f59e0b">امروز 📅</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#ea580c">راکد</th>'
    +'<th style="padding:8px 10px;text-align:center">نرخ تبدیل</th>'
    +'</tr></thead><tbody>';

  members.filter(function(m){return m.id!=='guest'&&m.active!==false;}).forEach(function(m,i){
    var s=stats[m.id]||{contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
    var conv=s.totalAssigned>0?Math.round((s.contracted/s.totalAssigned)*100):0;
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    html+='<tr style="background:'+bg+';border-bottom:1px solid #f1f5f9">'
      +'<td style="padding:8px 10px;font-weight:600;cursor:pointer" onclick="openManagerDrilldown(\''+m.id+'\')" title="کلیک برای جزئیات"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+(window.umGetColor?umGetColor(m.id):'#94a3b8')+'"></span>'+esc(m.name)+'</span><br><span style="font-size:10px;color:var(--text-muted);font-weight:400">'+esc(m.role)+'</span></td>'
      +'<td style="text-align:center;padding:8px">'+s.totalAssigned+'</td>'
      +'<td style="text-align:center;padding:8px;font-weight:700;color:#16a34a">'+s.contracted+'</td>'
      +'<td style="text-align:center;padding:8px;color:#854d0e">'+s.meetings+'</td>'
      +'<td style="text-align:center;padding:8px;color:#0369a1">'+s.proposals+'</td>'
      +'<td style="text-align:center;padding:8px;color:var(--text-secondary)">'+s.firstContact+'</td>'
      +'<td style="text-align:center;padding:8px;color:#dc2626;font-weight:600;cursor:pointer" onclick="openOverdueList(\''+m.id+'\')">'+s.overdue+(s.overdue>0?' 🔴':'')+'</td>'
      +'<td style="text-align:center;padding:8px;color:#854d0e">'+s.followupToday+'</td>'
      +'<td style="text-align:center;padding:8px;color:#ea580c">'+s.stalled+'</td>'
      +'<td style="text-align:center;padding:8px">'
        +'<div style="background:#e2e8f0;border-radius:9px;height:8px;width:70px;display:inline-block;overflow:hidden">'
        +'<div style="background:#22c55e;height:100%;width:'+Math.min(100,conv)+'%"></div></div>'
        +'<span style="font-size:11px;margin-right:4px">'+conv+'%</span>'
      +'</td>'
      +'<td style="text-align:center;padding:8px">'
        +'<button onclick="event.stopPropagation();openExpertReport(\''+m.id+'\')" style="font-size:10px;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-family:inherit">📊 گزارش</button>'
      +'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div></div>';

  // ── Pipeline Matrix (potential x status) ──────────────────
  (function(){
    var potLevels=[1,2,3,4];
    var potLabels={'1':'پتانسیل ۱ (بالا)','2':'پتانسیل ۲','3':'پتانسیل ۳','4':'پتانسیل ۴ (پایین)'};
    var potColors={'1':'#16a34a','2':'#0284c7','3':'#f59e0b','4':'#94a3b8'};
    var matrix={};
    potLevels.forEach(function(p){matrix[p]={};STATUS_LIST.forEach(function(s){matrix[p][s]=[];});});
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var pot=String(e.potential!==undefined?e.potential:(c.potential||4));
        var st=e.status||'بدون تماس';
        if(matrix[pot]&&matrix[pot][st]!==undefined){
          matrix[pot][st].push({rtype:rt,id:c.id,name:e.nameOverride||c.name});
        }
      });
    });
    var stColors={'بدون تماس':'#94a3b8','تماس اولیه':'#0ea5e9','ملاقات انجام شد':'#f59e0b','پیشنهاد ارسال شد':'#0284c7','قرارداد بسته شد':'#22c55e','غیرفعال':'#dc2626'};
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:18px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 ماتریس پایپ‌لاین — پتانسیل × وضعیت</div>'
      +'<div style="overflow-x:auto;padding:12px"><table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:6px 10px;text-align:right;white-space:nowrap">پتانسیل</th>';
    STATUS_LIST.forEach(function(s){
      html+='<th style="padding:6px 8px;text-align:center;border-right:1px solid var(--border);white-space:nowrap;color:'+(stColors[s]||'#555')+'">'
        +esc(s)+'</th>';
    });
    html+='<th style="padding:6px 8px;text-align:center;font-weight:700">جمع</th>'
      +'</tr></thead><tbody>';
    potLevels.forEach(function(p){
      var rowTotal=0;
      STATUS_LIST.forEach(function(s){rowTotal+=(matrix[p][s]||[]).length;});
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:6px 10px;font-weight:700;color:'+(potColors[p]||'#555')+'">'+potLabels[p]+'</td>';
      STATUS_LIST.forEach(function(s){
        var cells=matrix[p][s]||[];
        var cnt=cells.length;
        var tooltip=cells.slice(0,5).map(function(c){return c.name;}).join('، ')+(cells.length>5?'…':'');
        html+='<td style="text-align:center;padding:6px 8px;border-right:1px solid var(--border)">'
          +(cnt>0?'<span title="'+esc(tooltip)+'" style="display:inline-block;min-width:24px;padding:2px 6px;border-radius:10px;background:'+(stColors[s]||'#e2e8f0')+'22;color:'+(stColors[s]||'#555')+';font-weight:700;cursor:default">'+cnt+'</span>':'<span style="color:var(--text-muted)">—</span>')
          +'</td>';
      });
      html+='<td style="text-align:center;padding:6px 8px;font-weight:700">'+rowTotal+'</td>'
        +'</tr>';
    });
    // totals row
    html+='<tr style="background:var(--bg-raised);font-weight:700"><td style="padding:6px 10px">جمع کل</td>';
    var grandTotal=0;
    STATUS_LIST.forEach(function(s){
      var colTotal=potLevels.reduce(function(sum,p){return sum+(matrix[p][s]||[]).length;},0);
      grandTotal+=colTotal;
      html+='<td style="text-align:center;padding:6px 8px;border-right:1px solid var(--border)">'+colTotal+'</td>';
    });
    html+='<td style="text-align:center;padding:6px 8px">'+grandTotal+'</td></tr>';
    html+='</tbody></table></div></div>';
  })();
  // ── 📊 خلاصه امروز Widget ──
  (function(){
    var todayW = todayStr();
    var todayActs = (DB.changeLog||[]).filter(function(l){
      if(!l.at) return false;
      var dp = l.at.slice(0,10).split('-').map(Number);
      if(dp.length!==3) return false;
      var jd = g2j(dp[0],dp[1],dp[2]);
      return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]) === todayW;
    });
    var totalActsToday = todayActs.length;
    var scheduledToday = 0, doneToday = 0, overdueTotal = 0;
    var byExpertProgress = {};
    _buildPCCache();
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      var we = DB.weekEntries[k];
      if(we.rtype === 'mtr') return;
      var owner = _wpGetOwner(we)||'__none__';
      if(we.scheduledDate === todayW){
        scheduledToday++;
        if(!byExpertProgress[owner]) byExpertProgress[owner]={sched:0,done:0,name:USERS[owner]||owner};
        byExpertProgress[owner].sched++;
        var acts = _getTodayActivities(we.rtype||'center', we.rid||'', todayW);
        if(we.done || acts.length>0){
          doneToday++;
          byExpertProgress[owner].done++;
        }
      } else if(we.scheduledDate && we.scheduledDate < todayW && !we.done){
        var actOnDay = _getActivitiesOnDate(we.rtype||'center', we.rid||'', we.scheduledDate);
        if(actOnDay.length===0) overdueTotal++;
      }
    });
    var pctToday = scheduledToday>0 ? Math.round((doneToday/scheduledToday)*100) : 0;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:18px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 خلاصه امروز — '+todayW+'</div>'
      +'<div style="padding:14px">'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px">'
      +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16a34a">'+totalActsToday+'</div><div style="font-size:11px;color:#166534">فعالیت ثبت‌شده امروز</div></div>'
      +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#1d4ed8">'+scheduledToday+'</div><div style="font-size:11px;color:#1e40af">پیگیری امروز</div></div>'
      +'<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#dc2626">'+overdueTotal+'</div><div style="font-size:11px;color:#991b1b">سررسید گذشته 🔴</div></div>'
      +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16a34a">'+pctToday+'%</div><div style="font-size:11px;color:#166534">درصد انجام</div></div>'
      +'</div>';
    if(Object.keys(byExpertProgress).length){
      html+='<div style="font-size:12px;font-weight:700;margin-bottom:8px">📊 پیشرفت کارشناسان</div>';
      Object.keys(byExpertProgress).sort().forEach(function(exp){
        var ep=byExpertProgress[exp];
        var epPct=ep.sched>0?Math.round((ep.done/ep.sched)*100):0;
        var epColor=(window.umGetColor?umGetColor(exp):'#94a3b8');
        html+='<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;font-size:12px">'
          +'<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+epColor+'"></span>'
          +'<span style="min-width:100px">'+esc(ep.name)+'</span>'
          +'<div style="flex:1;background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden">'
          +'<div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:'+Math.min(100,epPct)+'%;transition:width .4s"></div>'
          +'</div>'
          +'<span style="font-size:11px;color:var(--text-muted);min-width:60px">'+ep.done+'/'+ep.sched+' ('+epPct+'%)</span>'
          +'</div>';
      });
    }
    html+='<div style="text-align:center;margin-top:10px">'
      +'<button onclick="openDailyMonitor()" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:6px 18px;cursor:pointer;font-size:12px;font-family:inherit">📊 گزارش کامل</button>'
      +'</div>'
      +'</div></div>';
  })();

  // ── عملکرد ماه جاری vs هدف ──────────────────────────────────────────────────
  (function(){
    var mon=currentJMonth();
    var activeMembers=members.filter(function(m){return m.active!==false&&m.role!=='مهمان'&&m.role!=='سوپر ادمین';});
    if(!activeMembers.length)return;
    html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px">';
    html+='<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">';
    html+='<span>📊 عملکرد ماه جاری vs هدف</span>';
    html+='<span style="font-size:10px;font-weight:400;color:var(--text-muted)">'+mon+'</span>';
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
    activeMembers.forEach(function(m){
      var uid=m.id;
      try{
        var t=getKPITarget(uid,mon);
        var calls=getCallsMonth(uid,mon);
        var visits=getVisitsMonth(uid,mon);
        var sales=getSalesMonth(uid,mon);
        var totalCalls=calls.reduce(function(s,l){return s+(l.count||0);},0);
        var totalVisits=visits.total||0;
        var totalSales=sales.length;
        var totalAmt=sales.reduce(function(s,l){return s+(l.amount||0);},0);
        // monthly target from daily/weekly targets
        var b=jMonthBounds(mon);var wd=workingDaysInJMonth(mon);
        var tCalls=Math.round((t.callsPerDay||10)*wd);
        var tVisits=Math.round((t.visitsPerWeek||5)*4.3);
        var tSales=t.salesCount||5;
        function pct(a,t2){return t2>0?Math.min(100,Math.round(a/t2*100)):0;}
        function bar(a,t2,col){
          var p=pct(a,t2);
          var c=p>=100?'#16a34a':p>=60?'#f59e0b':'#dc2626';
          return '<div style="flex:1;background:#e2e8f0;border-radius:6px;height:6px;overflow:hidden"><div style="height:100%;width:'+p+'%;background:'+c+';transition:width .4s"></div></div>';
        }
        var clr=typeof umGetColor==='function'?umGetColor(uid):'#6366f1';
        html+='<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">';
        html+='<div style="font-weight:700;font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px">';
        html+='<span style="width:9px;height:9px;border-radius:50%;background:'+clr+';flex-shrink:0"></span>';
        html+=esc(m.name)+'</div>';
        // calls row
        html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="font-size:10px;color:var(--text-muted);width:40px">تماس</span>';
        html+=bar(totalCalls,tCalls);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalCalls+'/'+tCalls+'</span></div>';
        // visits row
        html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="font-size:10px;color:var(--text-muted);width:40px">ویزیت</span>';
        html+=bar(totalVisits,tVisits);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalVisits+'/'+tVisits+'</span></div>';
        // sales row
        html+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--text-muted);width:40px">فروش</span>';
        html+=bar(totalSales,tSales);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalSales+'/'+tSales+'</span></div>';
        if(totalAmt>0){
          html+='<div style="margin-top:6px;font-size:10px;color:#16a34a;font-weight:700">💰 '+fM(totalAmt*1000000)+'</div>';
        }
        html+='</div>';
      }catch(e){}
    });
    html+='</div></div>';
  })();

  // ── نتایج تماس‌های اخیر ──────────────────────────────────────────────────
  (function(){
    var recentDone=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
      .filter(function(we){return we.done&&(we.doneNote||we.doneResult||we.doneObstacle||we.doneAmount);})
      .sort(function(a,b){return (b.doneDate||'')<(a.doneDate||'')?-1:1;}).slice(0,25);
    if(!recentDone.length)return;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:14px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📝 نتایج تماس‌های اخیر</div>'
      +'<div style="padding:10px;max-height:320px;overflow-y:auto">';
    recentDone.forEach(function(we){
      var own=_wpGetOwner(we)||'';
      var ownName=USERS[own]||own;
      var clr=typeof umGetColor==='function'?umGetColor(own):'#6366f1';
      var name = we.centerName || getRecLabel(we.recKey || (we.rtype + '_' + we.rid)) || '';
      html+='<div style="border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:11px">'
        +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+clr+'"></span>'
        +'<span style="font-weight:600">'+esc(name)+'</span>'
        +'<span style="color:var(--text-muted);font-size:10px">'+esc(ownName)+'</span>'
        +'<span style="margin-right:auto;color:var(--text-muted);font-size:10px">'+esc(we.doneDate||'')+'</span>'
        +'</div>';
      if(we.doneResult)html+='<div><span style="color:#0369a1;font-weight:600">نتیجه: </span>'+esc(we.doneResult)+'</div>';
      if(we.doneNote)html+='<div><span style="color:#7c3aed;font-weight:600">یادداشت: </span>'+esc(we.doneNote)+'</div>';
      if(we.doneObstacle)html+='<div><span style="color:#dc2626;font-weight:600">مانع: </span>'+esc(we.doneObstacle)+'</div>';
      if(we.doneAmount)html+='<div><span style="color:#16a34a;font-weight:600">مبلغ: </span>'+(typeof fM==='function'?fM(we.doneAmount*1000000):we.doneAmount)+'</div>';
      html+='</div>';
    });
    html+='</div></div>';
  })();

  // ── قیف فروش ─────────────────────────────────────────────────────────
  (function(){
    _buildPCCache();
    var stCounts={};
    STATUS_LIST.forEach(function(s){stCounts[s]=0;});
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var st=e.status||'بدون تماس';
        if(stCounts[st]!==undefined)stCounts[st]++;
      });
    });
    var funnelSts=STATUS_LIST.filter(function(s){return s!=='غیرفعال'&&s!=='عدم نیاز فاکتور کنسل شد';}); // exclude closed statuses from funnel
    var maxVal=Math.max.apply(null,funnelSts.map(function(s){return stCounts[s]||0;}));
    if(maxVal===0)return;
    var fColors=['#94a3b8','#0ea5e9','#f59e0b','#0284c7','#22c55e'];
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📉 قیف فروش</div>'
      +'<div style="padding:14px;display:flex;flex-direction:column;gap:8px">';
    funnelSts.forEach(function(st,i){
      var cnt=stCounts[st]||0;
      var pct=maxVal>0?Math.round((cnt/maxVal)*100):0;
      var prevCnt=i>0?(stCounts[funnelSts[i-1]]||0):cnt;
      var convPct=prevCnt>0?Math.round((cnt/prevCnt)*100):100;
      var clr=fColors[i]||'#94a3b8';
      html+='<div>'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
        +'<span style="font-size:11px;min-width:140px;font-weight:600">'+esc(st)+'</span>'
        +'<span style="font-size:12px;font-weight:700;color:'+clr+';min-width:30px">'+cnt+'</span>'
        +(i>0?'<span style="font-size:10px;color:var(--text-muted)">تبدیل از قبلی: '+convPct+'%</span>':'')
        +'</div>'
        +'<div style="background:var(--bg-raised);border-radius:6px;height:10px;overflow:hidden">'
        +'<div style="background:'+clr+';height:100%;width:'+pct+'%;border-radius:6px;transition:width .4s"></div>'
        +'</div></div>';
    });
    html+='<div style="margin-top:4px;font-size:10px;color:var(--text-muted)">مراکز غیرفعال: '+(stCounts['غیرفعال']||0)+'</div>';
    html+='</div></div>';
  })();

  // ── گزارش رقبا ────────────────────────────────────────────────────────
  (function(){
    _buildPCCache();
    var compMap={};
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var comp=(e.competitor||'').trim();
        if(!comp)return;
        if(!compMap[comp])compMap[comp]={count:0,names:[]};
        compMap[comp].count++;
        if(compMap[comp].names.length<3)compMap[comp].names.push(e.nameOverride||c.name||'');
      });
    });
    var comps=Object.keys(compMap).sort(function(a,b){return compMap[b].count-compMap[a].count;}).slice(0,8);
    if(!comps.length)return;
    var maxComp=compMap[comps[0]].count;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">🤖 رقبای اصلی</div>'
      +'<div style="padding:12px;display:flex;flex-direction:column;gap:6px">';
    comps.forEach(function(comp,i){
      var info=compMap[comp];
      var pct=maxComp>0?Math.round((info.count/maxComp)*100):0;
      var clr=['#dc2626','#ea580c','#f59e0b','#84cc16','#22c55e','#0ea5e9','#8b5cf6','#ec4899'][i]||'#94a3b8';
      html+='<div>'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">'
        +'<span style="font-size:11px;font-weight:700;flex:1">'+esc(comp)+'</span>'
        +'<span style="font-size:11px;color:'+clr+';font-weight:700">'+info.count+' مرکز</span>'
        +'</div>'
        +'<div style="background:var(--bg-raised);border-radius:4px;height:6px;overflow:hidden">'
        +'<div style="background:'+clr+';height:100%;width:'+pct+'%;border-radius:4px"></div>'
        +'</div>'
        +(info.names.length?'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">مثال: '+esc(info.names.join('، '))+'</div>':'')
        +'</div>';
    });
    html+='</div></div>';
  })();

  // ── سرعت Pipeline ────────────────────────────────────────────────────
  (function(){
    var expVel={};
    var stOrder={};
    STATUS_LIST.forEach(function(s,i){stOrder[s]=i;});
    (DB.changeLog||[]).filter(function(l){return l.field==='status'&&l.at&&l.by;}).forEach(function(l){
      if(!expVel[l.by])expVel[l.by]={transitions:[],lastAt:null,lastSt:null};
      var ev=expVel[l.by];
      if(ev.lastAt&&ev.lastSt){
        var days=Math.round((new Date(l.at)-new Date(ev.lastAt))/(86400000));
        if(days>=0&&days<=90)ev.transitions.push(days);
      }
      ev.lastAt=l.at;ev.lastSt=l.val;
    });
    var rows=Object.keys(expVel).filter(function(uid){return expVel[uid].transitions.length>=2;});
    if(!rows.length)return;
    rows.sort(function(a,b){
      var avgA=expVel[a].transitions.reduce(function(s,v){return s+v;},0)/expVel[a].transitions.length;
      var avgB=expVel[b].transitions.reduce(function(s,v){return s+v;},0)/expVel[b].transitions.length;
      return avgA-avgB;
    });
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">⚡ سرعت پیشروی در Pipeline</div>'
      +'<div style="padding:12px"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:6px 10px;text-align:right">کارشناس</th>'
      +'<th style="padding:6px 8px;text-align:center">میانگین روز بین تغییر وضعیت</th>'
      +'<th style="padding:6px 8px;text-align:center">تعداد تغییر</th>'
      +'<th style="padding:6px 8px;text-align:center">ارزیابی</th>'
      +'</tr></thead><tbody>';
    rows.forEach(function(uid){
      var ev=expVel[uid];
      var avg=Math.round(ev.transitions.reduce(function(s,v){return s+v;},0)/ev.transitions.length);
      var name=USERS[uid]||uid;
      var clr=avg<=7?'#16a34a':avg<=21?'#f59e0b':'#dc2626';
      var label=avg<=7?'🟢 سریع':avg<=21?'🟡 معمولی':'🔴 کُند';
      var expClr=typeof umGetColor==='function'?umGetColor(uid):'#94a3b8';
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:7px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+expClr+';margin-left:6px"></span>'+esc(name)+'</td>'
        +'<td style="text-align:center;padding:7px 8px;font-weight:700;color:'+clr+'">'+avg+' روز</td>'
        +'<td style="text-align:center;padding:7px 8px;color:var(--text-muted)">'+ev.transitions.length+'</td>'
        +'<td style="text-align:center;padding:7px 8px">'+label+'</td>'
        +'</tr>';
    });
    html+='</tbody></table></div></div>';
  })();

  // ── تحلیل win/loss ──
  (function(){
    var reasons={};
    var totalLost=0,totalWon=0;
    Object.values(DB.edits||{}).forEach(function(e){
      if(!e)return;
      if(e.status==='قرارداد بسته شد')totalWon++;
      if(e.status==='غیرفعال'){
        totalLost++;
        var r=e.lostReason||'نامشخص';
        reasons[r]=(reasons[r]||0)+1;
      }
    });
    var sortedR=Object.keys(reasons).sort(function(a,b){return reasons[b]-reasons[a];});
    if(totalLost>0||totalWon>0){
      var winRate=totalLost+totalWon>0?Math.round(100*totalWon/(totalWon+totalLost)):0;
      html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
        +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 تحلیل برد / باخت</div>'
        +'<div style="padding:12px">'
        +'<div style="display:flex;gap:16px;margin-bottom:10px">'
        +'<div style="flex:1;text-align:center;background:#f0fdf4;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#16a34a">'+totalWon+'</div>'
        +'<div style="font-size:11px;color:#15803d">✅ قرارداد بسته</div>'
        +'</div>'
        +'<div style="flex:1;text-align:center;background:#fef2f2;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#dc2626">'+totalLost+'</div>'
        +'<div style="font-size:11px;color:#b91c1c">❌ از دست رفته</div>'
        +'</div>'
        +'<div style="flex:1;text-align:center;background:#eff6ff;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#2563eb">'+winRate+'%</div>'
        +'<div style="font-size:11px;color:#1d4ed8">نرخ برد</div>'
        +'</div>'
        +'</div>';
      if(sortedR.length){
        html+='<div style="font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-muted)">دلایل از دست دادن مشتری:</div>';
        sortedR.slice(0,6).forEach(function(r){
          var cnt=reasons[r];
          var pct=Math.round(100*cnt/totalLost);
          html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
            +'<div style="flex:0 0 120px;font-size:11px;color:var(--text-primary)">'+esc(r)+'</div>'
            +'<div style="flex:1;background:var(--bg-raised);border-radius:4px;height:14px;overflow:hidden">'
            +'<div style="width:'+pct+'%;background:#dc2626;height:100%;border-radius:4px"></div>'
            +'</div>'
            +'<div style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+cnt+' ('+pct+'%)</div>'
            +'</div>';
        });
      }
      html+='</div></div>';
    }
  })();

  // ── خلاصه هفتگی (فقط شنبه نمایش داده می‌شود) ──
  (function(){
    var tj=todayStr().split('/');
    var dow=typeof jDow==='function'?jDow(parseInt(tj[0]),parseInt(tj[1]),parseInt(tj[2])):null;
    if(dow!==0)return; // فقط شنبه
    var today=todayStr();
    var weekAgo=addDaysToJalali(today,-7);
    var calls=0,visits=0,sales=0,newContracts=0,newLeads=0;
    Object.values(DB.edits||{}).forEach(function(e){
      if(!e)return;
      if(e.status==='قرارداد بسته شد'&&e._ts){
        var d=new Date(e._ts);
        var g=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
        var ds=p2(g[0])+'/'+p2(g[1])+'/'+p2(g[2]);
        if(ds>=weekAgo)newContracts++;
      }
    });
    (DB.changeLog||[]).forEach(function(log){
      if(!log||!log.at)return;
      var d=new Date(log.at);
      var g=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      var ds=p2(g[0])+'/'+p2(g[1])+'/'+p2(g[2]);
      if(ds<weekAgo)return;
      if(log.field==='status'&&log.val==='قرارداد بسته شد')newContracts++;
      if(log.field==='status')newLeads++;
    });
    (DB.callLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)calls++;});
    (DB.visitLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)visits++;});
    (DB.salesLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)sales++;});
    html+='<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;box-shadow:0 2px 8px rgba(99,102,241,.3);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;color:#fff;border-bottom:1px solid rgba(255,255,255,.2)">📋 خلاصه هفته گذشته</div>'
      +'<div style="padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+calls+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">📞 تماس</div>'
      +'</div>'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+visits+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">🚶 ویزیت</div>'
      +'</div>'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+newContracts+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">🏆 قرارداد جدید</div>'
      +'</div>'
      +'</div></div>';
  })();


  // ── Stale Records (exceeded stage followup interval) ────────
  (function(){
    var staleItems=[];
    var nowMs=new Date().getTime();
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var st=e.status||'';
        if(st==='قرارداد بسته شد'||st==='غیرفعال')return;
        var lead=e.lead||'';
        if(!lead||lead==='ندارد'||lead==='بدون مصرف')return;
        var maxDays=_getStageMaxDays(lead,e.oppGrade,e.customerStatus);
        var lastAct=_getLastActivityDate(rt,c.id);
        var lastMs=lastAct?new Date(lastAct).getTime():(e._ts?new Date(e._ts).getTime():0);
        if(!lastMs)return;
        var daysSince=Math.floor((nowMs-lastMs)/(86400000));
        if(daysSince>maxDays){
          staleItems.push({name:e.nameOverride||c.name,owner:e.owner||c.owner||'',lead:lead,days:daysSince,maxDays:maxDays,rtype:rt,id:c.id});
        }
      });
    });
    if(!staleItems.length)return;
    staleItems.sort(function(a,b){return(b.days-b.maxDays)-(a.days-a.maxDays);});
    var topStale=staleItems.slice(0,10);
    html+='<div style="background:var(--bg-raised);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border)">'
      +'<div style="font-weight:700;margin-bottom:10px;font-size:14px;color:var(--text)">⚠️ مراکز بدون پیگیری (بیش از حد مجاز)</div>'
      +'<div style="font-size:11px;color:#64748b;margin-bottom:8px">'+staleItems.length+' مرکز از حداکثر فاصله پیگیری مرحله خود گذشته‌اند</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:#f1f5f9">'
      +'<th style="padding:4px 8px;text-align:right;color:#64748b">مرکز</th>'
      +'<th style="padding:4px 8px;text-align:center;color:#64748b">مرحله</th>'
      +'<th style="padding:4px 8px;text-align:center;color:#64748b">مسئول</th>'
      +'<th style="padding:4px 8px;text-align:center;color:#64748b">روز گذشته</th>'
      +'<th style="padding:4px 8px;text-align:center;color:#64748b">حداکثر</th>'
      +'</tr></thead><tbody>';
    topStale.forEach(function(it){
      var ownerName=USERS[it.owner]||it.owner||'-';
      var excess=it.days-it.maxDays;
      var urgColor=excess>14?'#ef4444':excess>7?'#f97316':'#f59e0b';
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:4px 8px;"><a href="#" onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\');return false;" style="color:#2563eb;text-decoration:none;font-weight:600">'+esc(it.name)+'</a></td>'
        +'<td style="padding:4px 8px;text-align:center"><span style="background:#e0e7ff;color:#3730a3;border-radius:4px;padding:1px 6px">'+it.lead+'</span></td>'
        +'<td style="padding:4px 8px;text-align:center;color:#64748b">'+esc(ownerName)+'</td>'
        +'<td style="padding:4px 8px;text-align:center;font-weight:700;color:'+urgColor+'">'+it.days+'</td>'
        +'<td style="padding:4px 8px;text-align:center;color:#94a3b8">'+it.maxDays+'</td>'
        +'</tr>';
    });
    html+='</tbody></table>';
    if(staleItems.length>10)html+='<div style="font-size:10px;color:#94a3b8;margin-top:6px;text-align:center">و '+(staleItems.length-10)+' مرکز دیگر...</div>';
    html+='</div>';
  })();

  // ── Competitor Report ─────────────────────────────────────
  (function(){
    var compMap={};
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var comp=(e.competitor||'').trim();
        if(!comp)return;
        if(!compMap[comp])compMap[comp]={name:comp,centers:[],advantage:'',buyReason:''};
        compMap[comp].centers.push({rtype:rt,id:c.id,name:e.nameOverride||c.name,owner:e.owner||c.owner||''});
        if(e.competitorAdvantage&&!compMap[comp].advantage)compMap[comp].advantage=e.competitorAdvantage;
        if(e.buyReasonFromCompetitor&&!compMap[comp].buyReason)compMap[comp].buyReason=e.buyReasonFromCompetitor;
      });
    });
    var comps=Object.values(compMap).sort(function(a,b){return b.centers.length-a.centers.length;});
    if(!comps.length)return;
    html+='<div style="background:var(--bg-raised);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border)">'
      +'<div style="font-weight:700;margin-bottom:10px;font-size:14px;color:var(--text)">🥊 گزارش رقبا</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:#f1f5f9">'
      +'<th style="padding:4px 8px;text-align:right;color:#64748b">رقیب</th>'
      +'<th style="padding:4px 8px;text-align:right;color:#64748b">مراکز تحت پوشش رقیب</th>'
      +'<th style="padding:4px 8px;text-align:right;color:#64748b">مزیت رقیب</th>'
      +'<th style="padding:4px 8px;text-align:right;color:#64748b">دلیل خرید</th>'
      +'</tr></thead><tbody>';
    comps.forEach(function(cp){
      var centersListHtml = cp.centers.map(function(c){
        var ownerName = USERS[c.owner] || c.owner || '';
        var displayLabel = esc(c.name) + (ownerName ? ' (' + esc(ownerName) + ')' : '');
        return '<a href="#" onclick="openCenterModal(\''+c.rtype+'\',\''+c.id+'\');return false;" style="color:#2563eb;text-decoration:none;font-weight:600;margin-left:8px;display:inline-block;background:#eff6ff;padding:2px 6px;border-radius:4px;border:1px solid #bfdbfe;font-size:10px;margin-bottom:4px">📍 '+displayLabel+'</a>';
      }).join('');
      
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:8px 8px;font-weight:600;color:var(--text);vertical-align:top;width:120px">'+esc(cp.name)+' <span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;border-radius:10px;padding:2px 6px">'+cp.centers.length+'</span></td>'
        +'<td style="padding:8px 8px;vertical-align:top">'+centersListHtml+'</td>'
        +'<td style="padding:8px 8px;color:#64748b;font-size:10px;vertical-align:top">'+esc(cp.advantage||'-')+'</td>'
        +'<td style="padding:8px 8px;color:#64748b;font-size:10px;vertical-align:top">'+esc(cp.buyReason||'-')+'</td>'
        +'</tr>';
    });
    html+='</tbody></table></div>';
  })();

  // ── 📊 جدول نرخ تبدیل و اثربخشی کارشناسان ──────────────────────────
  (function(){
    _buildPCCache();
    var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
    var activeExperts=allMem.filter(function(m){return m.role!=='manager';});
    
    var stats={};
    activeExperts.forEach(function(m){
      stats[m.id] = {name:m.name, total:0, leads:0, opps:0, custs:0, dormant:0};
    });
    
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var owner=e.owner||c.owner||'';
        if(!owner || !stats[owner]) return;
        
        var statObj = stats[owner];
        statObj.total++;
        
        var lead=e.lead||c.lead||'سرنخ';
        if(lead==='مشتری'){
          statObj.custs++;
          var cs=_computeCustomerStatus(rt,c.id);
          if(cs==='dormant') statObj.dormant++;
        } else if(lead==='فرصت'){
          statObj.opps++;
        } else if(lead==='سرنخ'||lead==='لید'){
          statObj.leads++;
        }
      });
    });

    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">👥 نرخ تبدیل و اثربخشی کارشناسان</div>'
      +'<div style="overflow-x:auto;padding:10px">'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:6px 8px;text-align:right;color:#64748b">کارشناس</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#64748b">کل مراکز</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#64748b">سرنخ/لید</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#64748b">فرصت‌ها</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#16a34a">مشتریان</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#2563eb">نرخ تبدیل فرصت</th>'
      +'<th style="padding:6px 8px;text-align:center;color:#dc2626">خوابیده (ریزش)</th>'
      +'</tr></thead><tbody>';
      
    activeExperts.forEach(function(m){
      var s=stats[m.id];
      if(!s) return;
      var oppPct = s.total > 0 ? Math.round(((s.opps + s.custs) / s.total) * 100) : 0;
      var dormantPct = s.custs > 0 ? Math.round((s.dormant / s.custs) * 100) : 0;
      var color = (window.umGetColor ? umGetColor(m.id) : '#94a3b8');
      
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:8px;font-weight:600"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:'+color+'"></span>'+esc(s.name)+'</span></td>'
        +'<td style="text-align:center;padding:8px;font-weight:700">'+s.total+'</td>'
        +'<td style="text-align:center;padding:8px;color:var(--text-muted)">'+s.leads+'</td>'
        +'<td style="text-align:center;padding:8px;color:#f59e0b;font-weight:700">'+s.opps+'</td>'
        +'<td style="text-align:center;padding:8px;color:#16a34a;font-weight:700">'+s.custs+'</td>'
        +'<td style="text-align:center;padding:8px;font-weight:700;color:#2563eb">'+oppPct+'%</td>'
        +'<td style="text-align:center;padding:8px">'
          +(s.dormant > 0 ? '<span style="background:#fee2e2;color:#dc2626;border-radius:4px;padding:2px 6px;font-weight:700">'+s.dormant+' ('+dormantPct+'%)</span>' : '<span style="color:#16a34a">۰</span>')
        +'</td>'
        +'</tr>';
    });
    
    html+='</tbody></table></div></div>';
  })();

  // ── 📊 گزارش جریان و تحرکات پایپ‌لاین در ۷ روز گذشته ──────────
  (function(){
    var now=new Date();
    var weekAgoMs=now.getTime()-(7*24*60*60*1000);
    var movements=[];
    
    (DB.changeLog||[]).forEach(function(l){
      if(!l || !l.at || l.field!=='lead') return;
      var t = new Date(l.at).getTime();
      if(t < weekAgoMs) return;
      
      movements.push(l);
    });
    
    movements.reverse(); // newest first
    
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">⚡ تحرکات و ارتقای مراحل فروش در ۷ روز گذشته</div>'
      +'<div style="padding:12px;max-height:240px;overflow-y:auto">';
      
    if(!movements.length){
      html+='<div style="text-align:center;padding:20px;color:var(--text-muted)">هیچ حرکتی در پایپ‌لاین در ۷ روز گذشته ثبت نشده است.</div>';
    } else {
      movements.slice(0,30).forEach(function(l){
        var cName=_clGetName(l.rkey);
        var rparts=l.rkey.split('_');
        var rtype=rparts[0]; var rid=rparts.slice(1).join('_');
        var expName=USERS[l.by]||l.by||'—';
        var dp=l.at.slice(0,10).split('-').map(Number);
        var jd=g2j(dp[0],dp[1],dp[2]);
        var dateStr=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2])+' '+l.at.slice(11,16);
        
        var valBadge = esc(l.val);
        var badgeColor = '#6366f1';
        if(l.val==='مشتری') badgeColor='#16a34a';
        else if(l.val==='فرصت') badgeColor='#f59e0b';
        else if(l.val==='سرنخ') badgeColor='#0284c7';
        
        html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">'
          +'<div>'
            +'<a href="#" onclick="openCenterModal(\''+rtype+'\',\''+rid+'\');return false;" style="color:#2563eb;text-decoration:none;font-weight:700;margin-left:6px">🏥 '+esc(cName)+'</a>'
            +'ارتقا به مرحله <span style="background:'+badgeColor+'22;color:'+badgeColor+';padding:2px 6px;border-radius:4px;font-weight:700">'+valBadge+'</span>'
          +'</div>'
          +'<div style="text-align:left;color:var(--text-muted)">'
            +'<span>👤 '+esc(expName)+'</span> &nbsp; '
            +'<span style="font-size:10px">'+dateStr+'</span>'
          +'</div>'
          +'</div>';
      });
      if(movements.length > 30){
        html+='<div style="text-align:center;font-size:10px;color:var(--text-muted);margin-top:6px">نمایش ۳۰ حرکت اخیر از '+movements.length+' مورد</div>';
      }
    }
    html+='</div></div>';
  })();

  html+='<div id="mgrWinLossCard" style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
    +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">🏆 برد / باخت — دلایل از دست دادن</div>'
    +'<div id="mgrWinLossBody" style="padding:12px;color:var(--text-muted);font-size:11px">⏳ بارگذاری...</div>'
    +'</div>';

  html+='<div style="text-align:center;margin-top:10px">'
    +'<button onclick="renderManagerPanel()" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-family:inherit">🔄 بروزرسانی</button>'
    +'</div></div>';

  el.innerHTML=html;
  _loadMgrWinLossCard();
  _maybeSaveWeeklySnapshot();
}

// ════════════════════════ MANAGER DRILLDOWN ════════════════════
function openManagerDrilldown(memberId){
  _buildPCCache();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var m=allMem.find(function(x){return x.id===memberId;});
  if(!m)return;
  var today=todayStr();
  var centers=[];
  getAllProvinces().forEach(function(p){
    var rt=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(rt,c.id);
      if((e.owner||c.owner||'')!==memberId)return;
      var rkey=rt+'_'+c.id;
      var fd=e.followupDate||'';
      var isOverdue=fd&&fd<today&&e.status!=='قرارداد بسته شد'&&e.status!=='غیرفعال';
      var noteArr=(DB.notes&&DB.notes[rkey])||[];
      var recentLog=(DB.changeLog||[]).filter(function(l){return l.rkey===rkey;}).slice(-25);
      var doneEntries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
        .filter(function(we){var r2=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');var i2=we.rid||(we.recKey?we.recKey.split('_').slice(1).join('_'):'');return r2===rt&&i2===c.id&&we.done&&(we.doneNote||we.doneResult||we.doneObstacle||we.doneAmount);})
        .sort(function(a,b){return (b.doneDate||'')<(a.doneDate||'')?-1:1;}).slice(0,5);
      centers.push({rtype:rt,id:c.id,name:e.nameOverride||c.name||'?',status:e.status||'بدون تماس',lead:e.lead||c.lead||'سرنخ',followupDate:fd,isOverdue:isOverdue,potential:e.potential||c.potential||4,noteArr:noteArr,recentLog:recentLog,rkey:rkey,doneEntries:doneEntries});
    });
  });
  centers.sort(function(a,b){
    if(a.isOverdue&&!b.isOverdue)return -1;
    if(!a.isOverdue&&b.isOverdue)return 1;
    if(a.followupDate&&b.followupDate)return a.followupDate<b.followupDate?-1:1;
    if(a.followupDate)return -1;
    if(b.followupDate)return 1;
    return 0;
  });
  var stColors={'بدون تماس':'#94a3b8','تماس اولیه':'#0ea5e9','ملاقات انجام شد':'#f59e0b','پیشنهاد ارسال شد':'#0284c7','قرارداد بسته شد':'#22c55e','غیرفعال':'#dc2626'};
  var grouped={};
  centers.forEach(function(c){grouped[c.status]=(grouped[c.status]||0)+1;});
  // ── قیف فروش (لید→سرنخ→فرصت→مشتری) ──
  var funnelStages=['لید','سرنخ','فرصت','مشتری'];
  var funnelColors={'لید':'#f59e0b','سرنخ':'#0ea5e9','فرصت':'#8b5cf6','مشتری':'#22c55e'};
  var funnelCounts={};
  funnelStages.forEach(function(s){funnelCounts[s]=0;});
  centers.forEach(function(c){if(funnelCounts[c.lead]!==undefined)funnelCounts[c.lead]++;});
  var totalForFunnel=centers.length||1;
  var body='<div style="font-size:12px">';
  // status badges
  body+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  Object.keys(grouped).forEach(function(st){
    body+='<span style="padding:3px 10px;border-radius:20px;font-size:11px;background:'+(stColors[st]||'#e2e8f0')+'22;color:'+(stColors[st]||'#555')+';border:1px solid '+(stColors[st]||'#e2e8f0')+'44">'+esc(st)+': '+grouped[st]+'</span>';
  });
  body+='</div>';
  // Sales funnel
  body+='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px">';
  body+='<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">📊 قیف فروش ('+centers.length+' مرکز)</div>';
  body+='<div style="display:flex;gap:0;align-items:stretch">';
  funnelStages.forEach(function(s,idx){
    var cnt=funnelCounts[s]||0;
    var pct=Math.round(cnt/totalForFunnel*100);
    var clr=funnelColors[s]||'#94a3b8';
    var arrow=idx<funnelStages.length-1?'<div style="display:flex;align-items:center;color:var(--text-muted);font-size:16px;padding:0 2px">›</div>':'';
    body+='<div style="flex:1;text-align:center;padding:6px 4px;border:1px solid '+clr+'33;border-radius:6px;background:'+clr+'11;margin-left:2px">';
    body+='<div style="font-size:16px;font-weight:700;color:'+clr+'">'+cnt+'</div>';
    body+='<div style="font-size:10px;color:'+clr+';font-weight:600">'+esc(s)+'</div>';
    body+='<div style="font-size:10px;color:var(--text-muted)">'+pct+'٪</div>';
    body+='</div>';
    if(arrow)body+=arrow;
  });
  body+='</div>';
  // نرخ تبدیل
  var lid=funnelCounts['لید']||0;var sar=funnelCounts['سرنخ']||0;var fur=funnelCounts['فرصت']||0;var msh=funnelCounts['مشتری']||0;
  body+='<div style="font-size:10px;color:var(--text-muted);margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">';
  if(lid)body+='<span>لید→سرنخ: <b style="color:#0ea5e9">'+Math.round(sar/(lid+sar+fur+msh)*100||0)+'٪</b></span>';
  if(sar)body+='<span>سرنخ→فرصت: <b style="color:#8b5cf6">'+Math.round(fur/(sar+fur+msh)*100||0)+'٪</b></span>';
  if(fur)body+='<span>فرصت→مشتری: <b style="color:#22c55e">'+Math.round(msh/(fur+msh)*100||0)+'٪</b></span>';
  body+='</div>';
  body+='</div>';
  // Lead conversion timing
  body+=renderLeadTimingHtml(memberId);
  if(!centers.length){
    body+='<div style="text-align:center;padding:30px;color:var(--text-muted)">مرکزی تخصیص داده نشده</div>';
  } else {
    body+='<div style="max-height:60vh;overflow-y:auto;padding-bottom:4px">';
    centers.forEach(function(c,i){
      var fdStyle=c.isOverdue?'color:#dc2626;font-weight:700':'color:var(--text-secondary)';
      var stColor=stColors[c.status]||'#94a3b8';
      var lastAct=c.recentLog.length?c.recentLog[c.recentLog.length-1]:null;
      var fmtDate=function(isoAt){if(!isoAt)return'';var dp=isoAt.slice(0,10).split('-').map(Number);if(dp.length!==3)return'';var jd=g2j(dp[0],dp[1],dp[2]);return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);};
      body+='<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">'
        +'<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:var(--bg-card);flex-wrap:wrap" '
        +'onclick="var d=document.getElementById(\'mdr_'+i+'\');if(d){d.style.display=d.style.display===\'none\'?\'block\':\'none\';}">'
        +'<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+stColor+'"></span>'
        +'<span style="font-weight:600;flex:1;min-width:80px">'+esc(c.name)+'</span>'
        +'<span style="font-size:10px;padding:2px 7px;border-radius:9px;background:'+stColor+'22;color:'+stColor+'">'+esc(c.status)+'</span>'
        +(c.followupDate?'<span style="font-size:11px;'+fdStyle+'">'+c.followupDate+(c.isOverdue?' 🔴':'')+'</span>':'')
        +'<span style="font-size:10px;color:var(--text-muted)">P'+c.potential+'</span>'
        +'<button onclick="event.stopPropagation();closeModal(\'mgrDrilldown\');setTimeout(function(){openCenterModal(\''+c.rtype+'\',\''+c.id+'\');},100)" style="padding:2px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:10px;font-family:inherit">باز کردن</button>'
        +'</div>'
        +'<div id="mdr_'+i+'" style="display:none;padding:10px 12px;border-top:1px solid var(--border);background:var(--bg-raised)">';
      if(c.noteArr&&c.noteArr.length){
        var _allNotes=c.noteArr.slice().reverse();
        body+='<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:4px">📝 یادداشت‌ها ('+c.noteArr.length+'):</div><div style="max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">';
        _allNotes.forEach(function(n){
          var nt=typeof n==='string'?n:(n.text||n.body||'');
          if(!nt)return;
          var nd=n&&n.date?n.date:(n&&n.at?fmtDate(n.at):'');var nb=n&&(n.by||n.user)?(USERS[n.by||n.user]||(n.by||n.user)):'';
          body+='<div style="font-size:11px;background:var(--bg-input);border-radius:5px;padding:5px 8px">'
            +(nd||nb?'<span style="font-size:10px;color:var(--text-muted)">'+esc(nd)+(nd&&nb?' · ':'')+esc(nb)+'</span><br>':'')
            +esc(nt)+'</div>';
        });
        body+='</div></div>';
      }
      if(lastAct){
        body+='<div style="font-size:11px"><span style="font-weight:700;color:#7c3aed">آخرین تغییر:</span> '+esc(lastAct.field||'')+' → '+esc(String(lastAct.val||''))+'<span style="color:var(--text-muted);margin-right:6px">('+fmtDate(lastAct.at)+' - '+esc(lastAct.by||'')+')</span></div>';
      }
      if(c.recentLog.length>1){
        body+='<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">';
        c.recentLog.slice(0,-1).reverse().slice(0,20).forEach(function(l){
          body+='<div style="font-size:10px;color:var(--text-muted);padding:1px 0">'+fmtDate(l.at)+' — '+esc(l.field||'')+': '+esc(String(l.val||''))+'</div>';
        });
        body+='</div>';
      }
      if(!(c.noteArr&&c.noteArr.length)&&!lastAct){
        body+='<div style="font-size:11px;color:var(--text-muted)">فعالیتی ثبت نشده</div>';
      }
      if(c.doneEntries&&c.doneEntries.length){
        body+='<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:3px">📝 نتایج ثبت‌شده:</div>';
        c.doneEntries.forEach(function(de){
          body+='<div style="font-size:10px;color:var(--text-secondary);padding:2px 0">';
          body+='<span style="color:var(--text-muted)">'+esc(de.doneDate||'')+'</span> ';
          if(de.doneResult)body+='<span style="color:#0369a1">'+esc(de.doneResult)+'</span> ';
          if(de.doneObstacle)body+='<span style="color:#dc2626">[مانع: '+esc(de.doneObstacle)+']</span> ';
          if(de.doneAmount)body+='<span style="color:#16a34a">['+de.doneAmount+'M]</span>';
          body+='</div>';
        });
        body+='</div>';
      }
      body+='</div></div>';
    });
    body+='</div>';
  }
  body+='</div>';
  openModal('mgrDrilldown','🔍 جزئیات: '+esc(m.name)+' (مجموعه '+centers.length+' مرکز)',body,'<button style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:inherit" onclick="closeModal(\'mgrDrilldown\');setTimeout(function(){openExpertReport(\''+memberId+'\');},150)">📊 گزارش کامل</button><button class="btn-secondary" onclick="closeModal(\'mgrDrilldown\')">بستن</button>',{lg:true});
}

function overdueSnooze(rtype,id,days,listMemberId){
  var e=getE(rtype,id);
  var fd=todayStr(); // Snooze relative to today!
  var parts=fd.split('/').map(Number);
  var gDate=j2g(parts[0],parts[1],parts[2]);
  var d=new Date(gDate[0],gDate[1]-1,gDate[2]+days);
  var nj=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  var newDate=nj[0]+'/'+p2(nj[1])+'/'+p2(nj[2]);
  setE(rtype,id,'followupDate',newDate);
  saveDB(); // Save changes to DB & sync to server!
  renderBanner();
  showToast('⏰ تعویق تا '+newDate,2000);
  closeModal('overdueList');
  setTimeout(function(){openOverdueList(listMemberId||undefined);},150);
}

function overduePickDate(rtype,id,listMemberId){
  var inp=document.createElement('input');
  inp.type='text';inp.style.cssText='position:fixed;opacity:0;pointer-events:none;top:50%;left:50%;';
  document.body.appendChild(inp);
  openJDP(inp,function(v){
    inp.remove();
    if(!v)return;
    setE(rtype,id,'followupDate',v);
    saveDB(); // Save changes to DB & sync to server!
    renderBanner();
    showToast('📅 تاریخ جدید: '+v,2000);
    closeModal('overdueList');
    setTimeout(function(){openOverdueList(listMemberId||undefined);},150);
  });
}
var _odFilters = {memberId: '', search: '', bucket: 'all'};

function openOverdueList(memberId){
  _odFilters.memberId = memberId || '';
  _odFilters.search = '';
  _odFilters.bucket = 'all';
  
  var allMem = (DB.settings && DB.settings.members) || _DEFAULT_MEMBERS;
  
  var body = '<div style="font-size:12px">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;background:var(--bg-raised);padding:8px;border-radius:8px;border:1px solid var(--border)">'
    + '<input type="text" id="odSearch" placeholder="🔍 جستجو مرکز..." oninput="_odFilters.search=this.value;filterOverdueList()" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px;min-width:140px">'
    + '<select id="odMember" onchange="_odFilters.memberId=this.value;filterOverdueList()" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px">'
    + '<option value="">👥 همه کارشناسان</option>'
    + allMem.filter(function(m){return m.role!=='manager';}).map(function(m){
        return '<option value="'+m.id+'"'+(_odFilters.memberId===m.id?' selected':'')+'>'+esc(m.name)+'</option>';
      }).join('')
    + '</select>'
    + '<select id="odBucket" onchange="_odFilters.bucket=this.value;filterOverdueList()" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px">'
    + '<option value="all">📅 همه بازه‌ها</option>'
    + '<option value="week">🔴 این هفته (۱–۷ روز)</option>'
    + '<option value="month">🟠 این ماه (۸–۳۰ روز)</option>'
    + '<option value="old">⚫ قدیمی (بیش از ۳۰ روز)</option>'
    + '</select>'
    + '</div>'
    + '<div id="overdueListBody" style="max-height:60vh;overflow-y:auto"></div>'
    + '</div>';
    
  openModal('overdueList', '🔴 پیگیری‌های معوق', body, '<button class="btn-secondary" onclick="closeModal(\'overdueList\')">بستن</button>', {lg:true});
  filterOverdueList();
}

function filterOverdueList() {
  _buildPCCache();
  var today = todayStr();
  var allMem = (DB.settings && DB.settings.members) || _DEFAULT_MEMBERS;
  var items = [];
  
  var memberId = _odFilters.memberId;
  var searchQ = fNorm(_odFilters.search || '');
  var bucketFilter = _odFilters.bucket;

  getAllProvinces().forEach(function(p){
    var rt = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e = getE(rt,c.id);
      var owner = e.owner || c.owner || '';
      if(memberId && owner !== memberId) return;
      var fd = e.followupDate || '';
      if(!fd || fd >= today || e.status === 'قرارداد بسته شد' || e.status === 'غیرفعال') return;
      
      var name = e.nameOverride || c.name || '?';
      if(searchQ && fNorm(name).indexOf(searchQ) < 0) return;
      
      var mObj = allMem.find(function(x){return x.id === owner;});
      var _fdp2 = fd.split('/').map(Number);
      var _fdg2 = j2g(_fdp2[0],_fdp2[1],_fdp2[2]);
      var midnightToday = new Date(); midnightToday.setHours(0,0,0,0);
      var midnightFd = new Date(_fdg2[0],_fdg2[1]-1,_fdg2[2]);
      var daysAgo = Math.round((midnightToday.getTime() - midnightFd.getTime()) / 86400000);
      
      items.push({
        rtype: rt,
        id: c.id,
        name: name,
        followupDate: fd,
        status: e.status || 'بدون تماس',
        ownerName: mObj ? mObj.name : (owner || 'بدون مسئول'),
        potential: e.potential || c.potential || 4,
        daysAgo: daysAgo
      });
    });
  });
  
  items.sort(function(a,b){return a.followupDate < b.followupDate ? -1 : 1;});

  var renderRow = function(c){
    var rescheduleTreeId = 'rtree_' + c.rtype + '_' + c.id;
    return '<div style="border-bottom:1px solid var(--border);padding:6px 0;">'
      + '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;background:var(--bg-card)">'
      + '<span style="color:#dc2626;font-size:11px;min-width:60px;font-weight:700">'+c.followupDate+'</span>'
      + '<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:9px;min-width:44px;text-align:center">'+c.daysAgo+' روز</span>'
      + '<span style="flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name)+'</span>'
      + '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+esc(c.ownerName)+'</span>'
      + '<button onclick="toggleRescheduleTree(\''+c.rtype+'\',\''+c.id+'\',\''+c.followupDate+'\')" style="padding:3px 7px;background:#f3f4f6;color:#374151;border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تاریخچه جابجایی">🕒 تاریخچه</button>'
      + '<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',3,\''+memberId+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۳ روز">+۳</button>'
      + '<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',7,\''+memberId+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۷ روز">+۷</button>'
      + '<button onclick="overduePickDate(\''+c.rtype+'\',\''+c.id+'\',\''+memberId+'\')" style="padding:3px 7px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تاریخ جدید">📅</button>'
      + '<button onclick="closeModal(\'overdueList\');setTimeout(function(){openCenterModal(\''+c.rtype+'\',\''+c.id+'\');},100)" style="padding:3px 9px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">پیگیری</button>'
      + '</div>'
      + '<div id="'+rescheduleTreeId+'" style="display:none;margin-top:4px;"></div>'
      + '</div>';
  };

  var buckets = [
    {id:'week', label:'🔴 این هفته', sub:'۱–۷ روز', min:1, max:7, clr:'#dc2626', items:[]},
    {id:'month', label:'🟠 این ماه', sub:'۸–۳۰ روز', min:8, max:30, clr:'#ea580c', items:[]},
    {id:'old', label:'⚫ قدیمی', sub:'بیش از ۳۰ روز', min:31, max:999999, clr:'#64748b', items:[]}
  ];

  items.forEach(function(c){
    for(var bi=0; bi<buckets.length; bi++){
      if(c.daysAgo >= buckets[bi].min && c.daysAgo <= buckets[bi].max){
        buckets[bi].items.push(c);
        break;
      }
    }
  });

  var body = '';
  var displayedCount = 0;
  
  buckets.forEach(function(bk){
    if(bucketFilter !== 'all' && bk.id !== bucketFilter) return;
    if(!bk.items.length) return;
    
    body += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0 4px;border-bottom:2px solid var(--border);margin-bottom:8px;margin-top:12px">'
      + '<span style="font-size:12px;font-weight:700;color:'+bk.clr+'">'+bk.label+'</span>'
      + '<span style="font-size:10px;color:var(--text-muted)">'+bk.sub+'</span>'
      + '<span style="font-size:11px;background:'+bk.clr+'22;color:'+bk.clr+';border-radius:9px;padding:1px 8px;font-weight:700">'+bk.items.length+' مرکز</span>'
      + '</div>';
      
    bk.items.forEach(function(c){
      body += renderRow(c);
      displayedCount++;
    });
  });

  if(displayedCount === 0){
    body = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-weight:700">🔍 موردی یافت نشد!</div>';
  }

  var container = document.getElementById('overdueListBody');
  if(container) container.innerHTML = body;
  
  var titleEl = document.querySelector('#modal_overdueList .modal-title');
  if(titleEl) titleEl.innerHTML = '🔴 پیگیری‌های معوق ('+items.length+')';
}

function toggleRescheduleTree(rtype, rid, currentFollowupDate) {
  var rescheduleTreeId = 'rtree_' + rtype + '_' + rid;
  var el = document.getElementById(rescheduleTreeId);
  if(!el) return;
  if(el.style.display === 'none') {
    el.innerHTML = buildRescheduleTree(rtype, rid, currentFollowupDate);
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function buildRescheduleTree(rtype, rid, currentFollowupDate) {
  var rkey = rtype + '_' + rid;
  var logs = (DB.changeLog || []).filter(function(l) {
    return l.rkey === rkey && l.field === 'followupDate';
  });
  
  logs.sort(function(a, b) { return a.at < b.at ? -1 : 1; });
  
  var html = '<div style="font-size:10.5px;color:var(--text-secondary);padding:6px 12px 6px 36px;margin:2px 0 6px 0;background:var(--bg-raised);border-radius:6px;border-right:3px solid var(--brand);line-height:1.6">';
  html += '<div style="font-weight:700;margin-bottom:4px;color:var(--text-primary)">📅 تاریخچه انتقال بین هفته و روز:</div>';
  
  var getWeekLabel = function(dStr) {
    var wk = getWeekForDate(dStr);
    return wk ? wk.label : 'خارج از محدوده هفته‌ها';
  };
  
  var steps = [];
  
  if (logs.length > 0) {
    logs.forEach(function(l) {
      var dStr = l.val;
      var wkLabel = getWeekLabel(dStr);
      var byName = USERS[l.by] || l.by || 'سیستم';
      steps.push({
        date: dStr,
        week: wkLabel,
        by: byName
      });
    });
  }
  
  if (steps.length === 0) {
    var wkLabel = getWeekLabel(currentFollowupDate);
    html += '<div style="color:var(--text-muted)">— هیچ جابجایی ثبت نشده است. (تاریخ فعلی: ' + currentFollowupDate + ' — ' + wkLabel + ')</div>';
  } else {
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var prefix = (i === steps.length - 1) ? '└─ ' : '├─ ';
      var bold = (i === steps.length - 1) ? 'font-weight:700;color:var(--brand);' : '';
      html += '<div style="' + bold + '">' + prefix 
        + 'انتقال به <b>' + s.date + '</b> (' + s.week + ')'
        + ' <span style="color:var(--text-muted);font-size:9.5px">توسط ' + esc(s.by) + '</span>'
        + '</div>';
    }
  }
  html += '</div>';
  return html;
}

function getWeekForDate(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split('/').map(Number);
  if (parts.length !== 3) return null;
  var dateMs = jMs(parts[0], parts[1], parts[2]);
  
  var yr = parts[0];
  var wks = typeof getYearWeeks === 'function' ? getYearWeeks(yr) : [];
  for (var i = 0; i < wks.length; i++) {
    var wk = wks[i];
    var wsMs = jMs(wk.wsArr[0], wk.wsArr[1], wk.wsArr[2]);
    var weMs = jMs(wk.weArr[0], wk.weArr[1], wk.weArr[2]);
    if (dateMs >= wsMs && dateMs <= weMs) {
      return wk;
    }
  }
  return null;
}
// ════════════════════════ EXPERT REPORT ════════════════════
function openExpertReport(memberId){
  _buildPCCache();
  var allMem=typeof umGetActive==='function'?umGetActive():((DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS);
  var m=allMem.find(function(x){return x.id===memberId;});
  if(!m)return;
  var mon=currentJMonth();
  // Compute default date range: first and last day of current month
  var monParts=mon.split('/');
  var fromDefault=monParts[0]+'/'+monParts[1]+'/01';
  var lastDay=jDIM(parseInt(monParts[0]),parseInt(monParts[1]));
  var toDefault=monParts[0]+'/'+monParts[1]+'/'+p2(lastDay);
  function buildReport(fromDate,toDate,apiData){
    window._rptApiCache=apiData||null;
    var allPlanned=Object.keys(DB.weekEntries||{}).map(function(k){
      var we = DB.weekEntries[k];
      we._key = k;
      return we;
    }).filter(function(we){
      var entryDate = we.scheduledDate || we._key.split(':::')[0] || '';
      return we.addedBy === memberId && entryDate >= fromDate && entryDate <= toDate;
    });

    var totalPlanned = apiData&&apiData.summary?apiData.summary.planned:allPlanned.length;
    var totalDone = apiData&&apiData.summary?apiData.summary.done:allPlanned.filter(function(we){ return we.done; }).length;
    var totalNotDone = totalPlanned - totalDone;
    var donePct = totalPlanned > 0 ? Math.round(totalDone / totalPlanned * 100) : 0;

    var _rptAllMem=typeof umGetActive==='function'?umGetActive():(((DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS).filter(function(x){return x.active!==false;}));
    var _rptMemOpts=_rptAllMem.map(function(x){return'<option value="'+esc(x.id)+'"'+(x.id===memberId?' selected':'')+'>'+esc(x.name||x.id)+'</option>';}).join('');
    var body='<div style="font-size:12px">';
    body+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;background:var(--bg-raised);border-radius:8px;padding:8px 12px">';
    body+='<span style="font-size:11px;font-weight:700;color:var(--text-secondary)">👤 کارشناس:</span>';
    body+='<select id="rptMember" onchange="openExpertReport(this.value)" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'+_rptMemOpts+'</select>';
    body+='</div>';
    body+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
    body+='<label style="font-size:11px">از: <input type="text" id="rptFrom" value="'+fromDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<label style="font-size:11px">تا: <input type="text" id="rptTo" value="'+toDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<button onclick="var f=document.getElementById(\'rptFrom\').value,t=document.getElementById(\'rptTo\').value;document.getElementById(\'rptBody\').innerHTML=buildExpertReportHtml(\''+memberId+'\',f,t)" style="padding:4px 12px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">🔍 فیلتر</button>';
    body+='</div>';
    body+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
    body+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#1d4ed8">'+totalPlanned+'</div><div style="font-size:11px;color:#1d4ed8">کل برنامه‌ها</div></div>';
    body+='<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#16a34a">'+totalDone+'</div><div style="font-size:11px;color:#16a34a">انجام شده ✓</div></div>';
    body+='<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#dc2626">'+totalNotDone+'</div><div style="font-size:11px;color:#dc2626">باقی‌مانده (اختلاف)</div></div>';
    body+='<div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#7c3aed">'+donePct+'٪</div><div style="font-size:11px;color:#7c3aed">نرخ تحقق</div></div>';
    body+='</div>';
    // قیف فروش برای این کارشناس
    body+='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px">';
    body+='<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">📊 قیف فروش (وضعیت فعلی مراکز)</div>';
    var _fStages=['لید','سرنخ','فرصت','مشتری'];
    var _fColors={'لید':'#f59e0b','سرنخ':'#0ea5e9','فرصت':'#8b5cf6','مشتری':'#22c55e'};
    var _fCnts={};_fStages.forEach(function(s){_fCnts[s]=0;});
    _buildPCCache();
    getAllProvinces().forEach(function(p){
      var rt=getProvType(p.id);
      getProvCenters(p.id).forEach(function(c){
        var e=getE(rt,c.id);
        if((e.owner||c.owner||'')!==memberId)return;
        var lead=e.lead||c.lead||'سرنخ';
        if(_fCnts[lead]!==undefined)_fCnts[lead]++;
      });
    });
    var _fTotal=Object.values(_fCnts).reduce(function(a,b){return a+b;},0)||1;
    body+='<div style="display:flex;gap:2px;align-items:stretch">';
    _fStages.forEach(function(s){
      var cnt=_fCnts[s]||0;var pct=Math.round(cnt/_fTotal*100);var clr=_fColors[s];
      body+='<div style="flex:1;text-align:center;padding:5px 3px;border:1px solid '+clr+'33;border-radius:5px;background:'+clr+'11">';
      body+='<div style="font-size:15px;font-weight:700;color:'+clr+'">'+cnt+'</div>';
      body+='<div style="font-size:10px;font-weight:600;color:'+clr+'">'+esc(s)+'</div>';
      body+='<div style="font-size:10px;color:var(--text-muted)">'+pct+'٪</div>';
      body+='</div>';
      if(s!=='مشتری')body+='<div style="display:flex;align-items:center;color:var(--text-muted);font-size:14px;padding:0 1px">›</div>';
    });
    body+='</div>';
    body+='</div>';
    body+=renderLeadTimingHtml(memberId);
    body+='<div id="rptBody">'+buildExpertReportHtml(memberId,fromDate,toDate)+'</div>';
    body+='</div>';
    var notifFoot='<button class="btn-secondary" onclick="closeModal(\'expertReport\')">بستن</button>';
    if(typeof _isManager==='function'&&_isManager()){
      notifFoot='<button style="background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="_sendReportNotif(\''+memberId+'\',\''+esc(m.name)+'\')">📨 ارسال اعلان</button>'+notifFoot;
    }
    openModal('expertReport','📊 گزارش '+esc(m.name)+' — '+fromDate+' تا '+toDate,body,notifFoot,{lg:true});
    // init date pickers after modal is open
    setTimeout(function(){
      var fi=document.getElementById('rptFrom');if(fi)openJDP(fi,function(v){fi.value=v;});
      var ti=document.getElementById('rptTo');if(ti)openJDP(ti,function(v){ti.value=v;});
    },100);
  }
  fetch('/api/manager-reports/expert/'+encodeURIComponent(memberId)+'?from='+encodeURIComponent(fromDefault)+'&to='+encodeURIComponent(toDefault))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(apiData){buildReport(fromDefault,toDefault,apiData);})
    .catch(function(){buildReport(fromDefault,toDefault,null);});
}
function _sendReportNotif(memberId,memberName){
  var body='<div style="font-size:12px">'
    +'<label style="display:block;margin-bottom:6px;font-weight:600">متن پیام به '+esc(memberName)+':</label>'
    +'<textarea id="rptNotifMsg" rows="4" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;background:var(--bg-input);color:var(--text-primary)" placeholder="مثال: عملکرد این هفته خوب بود، لطفاً گزارش مراکز P1 را تکمیل کنید..."></textarea>'
    +'</div>';
  openModal('rptNotifCompose','📨 ارسال اعلان به '+esc(memberName),body,
    '<button class="btn-secondary" onclick="closeModal(\'rptNotifCompose\')">لغو</button>'
    +'<button class="btn-primary" onclick="(function(){var msg=document.getElementById(\'rptNotifMsg\').value.trim();if(!msg){showToast(\'⚠ متن پیام خالی است\');return;}sendNotif(\''+memberId+'\',msg,\'\',[],\'manager_request\',null);closeModal(\'rptNotifCompose\');})()">ارسال 📨</button>'
  );
  setTimeout(function(){var t=document.getElementById('rptNotifMsg');if(t)t.focus();},100);
}
function buildExpertReportHtml(memberId,fromDate,toDate){
  var tab0Html = buildReportEntriesHtml(memberId, fromDate, toDate);
  var tab1Html = buildChangesByExpertHtml(memberId, fromDate, toDate);
  var tab2Html = buildChangesOnExpertCentersHtml(memberId, fromDate, toDate);
  var tab3Html = _buildRptActivityHtml(window._rptApiCache);
  var tab4Html = _buildRptSalesHtml(window._rptApiCache);

  var btnStyle = "padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;transition:all 0.2s;";
  
  var html = '<div style="display:flex;gap:6px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:6px">'
    + '<button class="report-tab-btn active" onclick="switchReportTab(0)" style="' + btnStyle + 'background:var(--brand,#6366f1);color:#fff">📋 تماس‌ها و ملاقات‌ها</button>'
    + '<button class="report-tab-btn" onclick="switchReportTab(1)" style="' + btnStyle + 'background:transparent;color:var(--text-secondary)">🔄 لاگ تغییرات کارشناس</button>'
    + '<button class="report-tab-btn" onclick="switchReportTab(2)" style="' + btnStyle + 'background:transparent;color:var(--text-secondary)">🏢 عملیات دیگران روی مراکز</button>'
    + '<button class="report-tab-btn" onclick="switchReportTab(3)" style="' + btnStyle + 'background:transparent;color:var(--text-secondary)">📞 فعالیت SQL</button>'
    + '<button class="report-tab-btn" onclick="switchReportTab(4)" style="' + btnStyle + 'background:transparent;color:var(--text-secondary)">💰 فروش / پیشفاکتور</button>'
    + '</div>';
    
  html += '<div id="rptTabContent_0" class="report-tab-content" style="display:block">' + tab0Html + '</div>';
  html += '<div id="rptTabContent_1" class="report-tab-content" style="display:none">' + tab1Html + '</div>';
  html += '<div id="rptTabContent_2" class="report-tab-content" style="display:none">' + tab2Html + '</div>';
  html += '<div id="rptTabContent_3" class="report-tab-content" style="display:none">' + tab3Html + '</div>';
  html += '<div id="rptTabContent_4" class="report-tab-content" style="display:none">' + tab4Html + '</div>';
  
  return html;
}

window.switchReportTab = function(index) {
  document.querySelectorAll('.report-tab-btn').forEach(function(btn, i) {
    btn.classList.toggle('active', i === index);
    btn.style.background = i === index ? 'var(--brand,#6366f1)' : 'transparent';
    btn.style.color = i === index ? '#fff' : 'var(--text-secondary)';
  });
  document.querySelectorAll('.report-tab-content').forEach(function(div, i) {
    div.style.display = i === index ? 'block' : 'none';
  });
};

function _isoToJalali(isoStr) {
  if (!isoStr) return '';
  try {
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    if (typeof g2j === 'function') {
      var r = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return r[0] + '/' + String(r[1]).padStart(2, '0') + '/' + String(r[2]).padStart(2, '0');
    }
    return (d.getFullYear() - 621) + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
  } catch (e) {
    return '';
  }
}

function buildChangesByExpertHtml(memberId, fromDate, toDate) {
  var logs = (DB.changeLog || []).filter(function(cl) {
    if (cl.by !== memberId) return false;
    var jalaliDate = _isoToJalali(cl.at);
    return jalaliDate && jalaliDate >= fromDate && jalaliDate <= toDate;
  }).sort(function(a,b){ return a.at < b.at ? 1 : -1; });

  if (!logs.length) return '<div style="text-align:center;padding:20px;color:var(--text-muted)">هیچ عملیاتی توسط این کارشناس در این بازه ثبت نشده است.</div>';

  var _FLBL={status:'وضعیت پیگیری',lead:'مرحله قیف',followupDate:'تاریخ پیگیری بعدی',potential:'سطح پتانسیل',competitor:'رقیب اصلی',owner:'مسئول مرکز',nameOverride:'نام مرکز'};

  var html = '<div style="max-height:40vh;overflow-y:auto">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ و ساعت</th><th style="padding:6px 8px;text-align:right">مرکز درمانی</th><th style="padding:6px 8px;text-align:right">بخش تغییر یافته</th><th style="padding:6px 8px;text-align:right">مقدار جدید</th></tr></thead><tbody>';
  
  logs.forEach(function(cl, i) {
    var bg = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)';
    var centerName = _getCenterNameFromKey(cl.rkey) || cl.rkey;
    var fieldLbl = _FLBL[cl.field] || cl.field;
    var valStr = typeof cl.val === 'object' ? JSON.stringify(cl.val) : String(cl.val || '—');
    var dt = new Date(cl.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' ' + _isoToJalali(cl.at);
    
    html += '<tr style="background:'+bg+';border-bottom:1px solid var(--border)">'
      + '<td style="padding:6px 8px;white-space:nowrap;direction:ltr;text-align:right">' + esc(dt) + '</td>'
      + '<td style="padding:6px 8px">' + esc(centerName) + '</td>'
      + '<td style="padding:6px 8px;font-weight:700">' + esc(fieldLbl) + '</td>'
      + '<td style="padding:6px 8px;color:#10b981;font-weight:600">' + esc(valStr) + '</td>'
      + '</tr>';
  });
  
  html += '</tbody></table></div>';
  return html;
}

function buildChangesOnExpertCentersHtml(memberId, fromDate, toDate) {
  var ownedCenterKeys = new Set();
  _buildPCCache();
  getAllProvinces().forEach(function(p) {
    var rt = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c) {
      var e = getE(rt, c.id);
      if ((e.owner || c.owner || '') === memberId) {
        ownedCenterKeys.add(rt + '_' + c.id);
      }
    });
  });

  var activities = [];
  
  (DB.changeLog || []).forEach(function(cl) {
    if (!ownedCenterKeys.has(cl.rkey)) return;
    if (cl.by === memberId) return;
    var jDate = _isoToJalali(cl.at);
    if (jDate && jDate >= fromDate && jDate <= toDate) {
      var fieldLbl = {status:'وضعیت پیگیری',lead:'مرحله قیف',followupDate:'تاریخ پیگیری',potential:'سطح پتانسیل',owner:'تغییر مسئول',nameOverride:'نام مرکز'}[cl.field] || cl.field;
      var valStr = typeof cl.val === 'object' ? JSON.stringify(cl.val) : String(cl.val || '');
      activities.push({
        at: cl.at,
        jDate: jDate,
        rkey: cl.rkey,
        by: cl.by,
        type: 'تغییر فیلد',
        desc: 'ویرایش ' + fieldLbl + ' به ' + valStr
      });
    }
  });

  Object.keys(DB.notes || {}).forEach(function(rkey) {
    if (!ownedCenterKeys.has(rkey)) return;
    var list = DB.notes[rkey] || [];
    list.forEach(function(n) {
      if (n.by === memberId) return;
      var jDate = _isoToJalali(n.at);
      if (jDate && jDate >= fromDate && jDate <= toDate) {
        activities.push({
          at: n.at,
          jDate: jDate,
          rkey: rkey,
          by: n.by,
          type: 'ثبت یادداشت',
          desc: n.text
        });
      }
    });
  });

  activities.sort(function(a,b){ return a.at < b.at ? 1 : -1; });

  if (!activities.length) return '<div style="text-align:center;padding:20px;color:var(--text-muted)">هیچ عملیاتی توسط سایر کاربران روی مراکز این کارشناس ثبت نشده است.</div>';

  var html = '<div style="max-height:40vh;overflow-y:auto">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ و ساعت</th><th style="padding:6px 8px;text-align:right">مرکز درمانی</th><th style="padding:6px 8px;text-align:right">انجام دهنده</th><th style="padding:6px 8px;text-align:right">نوع عملیات</th><th style="padding:6px 8px;text-align:right">شرح فعالیت</th></tr></thead><tbody>';

  activities.forEach(function(act, i) {
    var bg = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)';
    var centerName = _getCenterNameFromKey(act.rkey) || act.rkey;
    var dt = new Date(act.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' ' + act.jDate;
    var operatorName = (USERS && USERS[act.by]) ? USERS[act.by] : act.by;

    html += '<tr style="background:'+bg+';border-bottom:1px solid var(--border)">'
      + '<td style="padding:6px 8px;white-space:nowrap;direction:ltr;text-align:right">' + esc(dt) + '</td>'
      + '<td style="padding:6px 8px">' + esc(centerName) + '</td>'
      + '<td style="padding:6px 8px;font-weight:600;color:#1e3a8a">' + esc(operatorName) + '</td>'
      + '<td style="padding:6px 8px"><span style="font-size:10px;background:#fef3c7;color:#d97706;padding:2px 6px;border-radius:4px;font-weight:700">' + esc(act.type) + '</span></td>'
      + '<td style="padding:6px 8px;max-width:300px;overflow:hidden;text-overflow:ellipsis" title="'+esc(act.desc)+'">' + esc(act.desc) + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function buildReportEntriesHtml(memberId,fromDate,toDate){
  var entries=[];
  if(window._rptApiCache&&window._rptApiCache.weekEntries&&window._rptApiCache.weekEntries.length){
    entries=window._rptApiCache.weekEntries.map(function(we){
      return {
        scheduledDate:we.scheduledDate, centerName:we.centerName, actionType:we.actionType,
        done:we.done, doneDate:we.doneDate, doneResult:we.doneResult, doneNote:we.doneNote,
        doneObstacle:we.doneObstacle, doneAmount:we.doneAmount, rtype:we.rtype, rid:we.rid, addedBy:we.addedBy
      };
    });
  } else {
    entries=Object.keys(DB.weekEntries||{}).map(function(k){
      var we = DB.weekEntries[k]; we._key = k; return we;
    }).filter(function(we){
      var entryDate = we.scheduledDate || we._key.split(':::')[0] || '';
      return we.addedBy === memberId && entryDate >= fromDate && entryDate <= toDate;
    });
  }
  entries.sort(function(a,b){
    var da = a.scheduledDate || ''; var db = b.scheduledDate || '';
    return da < db ? 1 : -1;
  });

  if(!entries.length)return '<div style="text-align:center;padding:20px;color:var(--text-muted)">هیچ برنامه‌ای در این بازه زمانی یافت نشد.</div>';
  
  var _FLBL={status:'وضعیت',lead:'مرحله',followupDate:'پیگیری',potential:'پتانسیل',competitor:'رقیب',owner:'مسئول'};
  var _FCLR={status:'#6366f1',lead:'#0ea5e9',followupDate:'#f59e0b',potential:'#8b5cf6',competitor:'#ef4444',owner:'#22c55e'};
  var DAY=86400000;
  
  var html='<div style="max-height:50vh;overflow-y:auto">';
  html+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ برنامه</th><th style="padding:6px 8px;text-align:right">مرکز</th><th style="padding:6px 8px">نوع اقدام</th><th style="padding:6px 8px;text-align:center">وضعیت تحقق</th><th style="padding:6px 8px;text-align:right">تاریخ ثبت</th><th style="padding:6px 8px;text-align:right">نتیجه / یادداشت</th><th style="padding:6px 8px;text-align:right">مانع</th><th style="padding:6px 8px;text-align:right" title="تغییرات فیلدهای مرکز در روز فعالیت">🔄 تغییرات</th></tr></thead><tbody>';
  
  entries.forEach(function(we,i){
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    var typeLabel=(we.actionType==='visit')?'🤝 ملاقات':'📞 تماس';
    var entryDate = we.scheduledDate || we._key.split(':::')[0] || '';
    
    var statusHtml = we.done 
      ? '<span style="color:#16a34a;font-weight:700">✅ انجام شده</span>' 
      : '<span style="color:#ea580c;font-weight:700">⏳ در انتظار</span>';
      
    var changesHtml='<span style="color:var(--text-muted)">—</span>';
    if(we.done && we.doneDate && we.rtype && we.rid){
      try{
        var rkey=(we.rtype||'center')+'_'+(we.rid||'');
        var dp=we.doneDate.split('/');
        var doneMs=jMs(parseInt(dp[0]),parseInt(dp[1]),parseInt(dp[2]));
        var clChanges=(DB.changeLog||[]).filter(function(cl){
          if(cl.rkey!==rkey)return false;
          var ms=new Date(cl.at).getTime();
          return ms>=doneMs-DAY&&ms<=doneMs+2*DAY&&(cl.field in _FLBL);
        });
        if(clChanges.length){
          changesHtml='<div style="display:flex;flex-wrap:wrap;gap:3px">';
          clChanges.forEach(function(cl){
            var clr=_FCLR[cl.field]||'#94a3b8';
            var lbl=_FLBL[cl.field]||cl.field;
            var val=(cl.val||'').toString().slice(0,15);
            changesHtml+='<span title="'+esc(lbl)+': '+esc(cl.val||'')+'" style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:9px;background:'+clr+'22;color:'+clr+';border:1px solid '+clr+'44;white-space:nowrap">'+esc(lbl)+': '+esc(val)+'</span>';
          });
          changesHtml+='</div>';
        }
      }catch(_e){}
    }
    var displayName = we.centerName || getRecLabel(we.recKey || (we.rtype + '_' + we.rid)) || '';
    var outcomeText = we.doneResult ? ('[' + esc(we.doneResult) + '] ' + esc(we.doneNote || '')) : (we.doneNote ? esc(we.doneNote) : '—');
    
    html+='<tr style="background:'+bg+';border-bottom:1px solid var(--border)">';
    html+='<td style="padding:5px 8px;white-space:nowrap">'+esc(entryDate)+'</td>';
    html+='<td style="padding:5px 8px">'+esc(displayName)+'</td>';
    html+='<td style="padding:5px 8px;text-align:center">'+typeLabel+'</td>';
    html+='<td style="padding:5px 8px;text-align:center">'+statusHtml+'</td>';
    html+='<td style="padding:5px 8px;white-space:nowrap">'+esc(we.doneDate||'—')+'</td>';
    html+='<td style="padding:5px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis" title="'+esc(outcomeText)+'">'+esc(outcomeText)+'</td>';
    html+='<td style="padding:5px 8px;color:#dc2626">'+esc(we.doneObstacle||'—')+'</td>';
    html+='<td style="padding:5px 8px">'+changesHtml+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  return html;
}

function _loadMgrWinLossCard(){
  var el=document.getElementById('mgrWinLossBody');
  if(!el)return;
  fetch('/api/manager-reports/win-loss')
    .then(function(r){return r.ok?r.json():Promise.reject(new Error('API'));})
    .then(function(d){
      var won=d.wonCenters||{cnt:0,total_value:0};
      var lost=d.lostBreakdown||[];
      var html='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
      html+='<div style="flex:1;min-width:120px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#16a34a">'+(won.cnt||0)+'</div><div style="font-size:10px;color:#166534">برد (مشتری/قرارداد)</div></div>';
      html+='<div style="flex:1;min-width:120px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:#1d4ed8">'+Number(won.total_value||0).toLocaleString('fa-IR')+'</div><div style="font-size:10px;color:#1e40af">ارزش برد (M)</div></div>';
      html+='</div>';
      if(!lost.length){
        html+='<div style="color:var(--text-muted);font-size:11px">داده باخت ثبت نشده</div>';
      }else{
        var max=Math.max.apply(null,lost.map(function(x){return x.cnt||0;}).concat([1]));
        html+=lost.slice(0,12).map(function(row){
          var pct=Math.round((row.cnt||0)/max*100);
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px">'
            +'<span style="min-width:120px;font-weight:600">'+esc(row.reason||'—')+'</span>'
            +'<div style="flex:1;background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:#ef4444"></div></div>'
            +'<span style="min-width:36px;text-align:left;color:#ef4444;font-weight:700">'+(row.cnt||0)+'</span></div>';
        }).join('');
      }
      el.innerHTML=html;
    })
    .catch(function(){if(el)el.innerHTML='<span style="color:#94a3b8">خطا در بارگذاری win/loss</span>';});
}

function _maybeSaveWeeklySnapshot(){
  if(typeof _isManager!=='function'||!_isManager())return;
  try{
    var today=typeof todayStr==='function'?todayStr():'';
    if(!today)return;
    var parts=today.split('/').map(Number);
    var g=typeof j2g==='function'?j2g(parts[0],parts[1],parts[2]):null;
    if(!g)return;
    var dow=new Date(g[0],g[1]-1,g[2]).getDay();
    if(dow!==6)return;
    var weekKey=typeof wpCurrentWeekId==='function'?wpCurrentWeekId():today.substring(0,7);
    if(sessionStorage.getItem('mgrSnap_'+weekKey))return;
    var weVals=Object.values(DB.weekEntries||{});
    var snapshot={
      date:today,
      planned:weVals.length,
      done:weVals.filter(function(w){return w.done;}).length,
      experts:(typeof umGetActive==='function'?umGetActive():[]).filter(function(m){return m.role!=='مدیر'&&m.role!=='سوپر ادمین';}).length
    };
    fetch('/api/manager-reports/weekly-snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weekKey:weekKey,snapshot:snapshot})})
      .then(function(r){if(r.ok)sessionStorage.setItem('mgrSnap_'+weekKey,'1');})
      .catch(function(){});
  }catch(e){}
}

function _buildRptActivityHtml(cache){
  if(!cache||!cache.activity||!cache.activity.length){
    return '<div style="text-align:center;padding:20px;color:var(--text-muted)">فعالیت SQL در این بازه نیست</div>';
  }
  var html='<div style="max-height:45vh;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ</th><th style="padding:6px 8px">نوع</th><th style="padding:6px 8px;text-align:center">تعداد</th><th style="padding:6px 8px;text-align:right">یادداشت</th></tr></thead><tbody>';
  cache.activity.forEach(function(a,i){
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    var kind=a.kind==='visit'?'🚗 ویزیت':'📞 تماس';
    html+='<tr style="background:'+bg+'"><td style="padding:5px 8px">'+esc(a.date||'')+'</td><td style="padding:5px 8px;text-align:center">'+kind+'</td><td style="padding:5px 8px;text-align:center">'+(a.count||0)+'</td><td style="padding:5px 8px">'+esc(a.note||'—')+'</td></tr>';
  });
  html+='</tbody></table></div>';
  return html;
}

function _buildRptSalesHtml(cache){
  if(!cache)return '<div style="text-align:center;padding:20px;color:var(--text-muted)">داده SQL بارگذاری نشده</div>';
  var sales=cache.sales||[];
  var pfs=cache.proformas||[];
  var html='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html+='<div style="flex:1;min-width:100px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#16a34a">'+sales.length+'</div><div style="font-size:10px">فروش</div></div>';
  html+='<div style="flex:1;min-width:100px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#1d4ed8">'+Number(cache.summary&&cache.summary.salesTotal||0).toLocaleString('fa-IR')+'</div><div style="font-size:10px">جمع فروش</div></div>';
  html+='<div style="flex:1;min-width:100px;background:#faf5ff;border:1px solid #ddd6fe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#7c3aed">'+pfs.length+'</div><div style="font-size:10px">پیشفاکتور</div></div>';
  html+='</div>';
  if(sales.length){
    html+='<div style="font-weight:700;font-size:11px;margin-bottom:6px">💰 فروش‌ها</div><div style="max-height:25vh;overflow-y:auto;margin-bottom:12px"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--bg-raised)"><th>تاریخ</th><th>مرکز</th><th>مبلغ</th></tr></thead><tbody>';
    sales.forEach(function(s,i){
      html+='<tr style="background:'+(i%2?'var(--bg-raised)':'var(--bg-card)')+'"><td style="padding:4px 8px">'+esc(s.date||'')+'</td><td style="padding:4px 8px">'+esc(s.center_name||'')+'</td><td style="padding:4px 8px">'+Number(s.amount||0).toLocaleString('fa-IR')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(pfs.length){
    html+='<div style="font-weight:700;font-size:11px;margin-bottom:6px">📄 پیشفاکتورها</div><div style="max-height:25vh;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--bg-raised)"><th>شماره</th><th>تاریخ</th><th>وضعیت</th><th>مبلغ</th></tr></thead><tbody>';
    pfs.forEach(function(p,i){
      html+='<tr style="background:'+(i%2?'var(--bg-raised)':'var(--bg-card)')+'"><td style="padding:4px 8px">'+esc(p.no||'')+'</td><td style="padding:4px 8px">'+esc(p.jalaliDate||'')+'</td><td style="padding:4px 8px">'+esc(p.status||'')+'</td><td style="padding:4px 8px">'+Number(p.total||0).toLocaleString('fa-IR')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(!sales.length&&!pfs.length)html+='<div style="text-align:center;color:var(--text-muted);padding:12px">فروش یا پیشفاکتوری در این بازه نیست</div>';
  return html;
}

function computeLeadStageTiming(memberId){
  // Returns per-stage average days for this expert, using changeLog transitions
  _buildPCCache();
  var STAGES=['لید','سرنخ','فرصت','مشتری'];
  var stagePairs=[['لید','سرنخ'],['سرنخ','فرصت'],['فرصت','مشتری']];
  var timings={'لید→سرنخ':[],'سرنخ→فرصت':[],'فرصت→مشتری':[]};
  var centerLogs={};
  // Build per-center lead change log for centers owned by this member
  getAllProvinces().forEach(function(p){
    var rt=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(rt,c.id);
      if((e.owner||c.owner||'')!==memberId)return;
      var rkey=rt+'_'+c.id;
      var logs=(DB.changeLog||[]).filter(function(l){return l.rkey===rkey&&l.field==='lead'&&l.at;})
        .map(function(l){return{at:new Date(l.at).getTime(),val:l.val};})
        .sort(function(a,b){return a.at-b.at;});
      if(logs.length)centerLogs[rkey]=logs;
    });
  });
  // For each center, find transition times
  Object.keys(centerLogs).forEach(function(rkey){
    var logs=centerLogs[rkey];
    stagePairs.forEach(function(pair){
      var fromStage=pair[0],toStage=pair[1];
      var key=fromStage+'→'+toStage;
      var enterFrom=null;
      logs.forEach(function(l){
        if(l.val===fromStage)enterFrom=l.at;
        else if(l.val===toStage&&enterFrom){
          timings[key].push(Math.round((l.at-enterFrom)/(86400*1000)));
          enterFrom=null;
        }
      });
    });
  });
  var result={};
  Object.keys(timings).forEach(function(k){
    var arr=timings[k];
    result[k]=arr.length?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):null;
    result[k+'_count']=arr.length;
  });
  return result;
}

function renderLeadTimingHtml(memberId){
  var t=computeLeadStageTiming(memberId);
  var pairs=[['لید→سرنخ','#f59e0b→#0ea5e9','#f59e0b'],['سرنخ→فرصت','#0ea5e9→#8b5cf6','#0ea5e9'],['فرصت→مشتری','#8b5cf6→#22c55e','#8b5cf6']];
  var html='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px">';
  html+='<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">⏱ میانگین زمان تبدیل (روز)</div>';
  html+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  pairs.forEach(function(p){
    var key=p[0];var clr=p[2];
    var days=t[key];var cnt=t[key+'_count']||0;
    html+='<div style="flex:1;min-width:90px;border:1px solid '+clr+'33;border-radius:6px;padding:7px 10px;background:'+clr+'0d;text-align:center">';
    html+='<div style="font-size:14px;font-weight:700;color:'+clr+'">'+(days!==null?days+' روز':'—')+'</div>';
    html+='<div style="font-size:10px;color:var(--text-muted)">'+esc(key)+'</div>';
    html+='<div style="font-size:10px;color:var(--text-muted)">'+cnt+' نمونه</div>';
    html+='</div>';
  });
  html+='</div></div>';
  return html;
}

// ════════════════════════ EXCEL EXPORT (مراکز) ════════════════════

function importCentersFromExcel(event) {
  if (typeof XLSX === 'undefined') { showToast('⚠ کتابخانه Excel بارگذاری نشده'); return; }
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'binary' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) { showToast('⚠ فایل خالی است'); return; }
      
      var headers = rows[0].map(function(h) { return String(h).trim(); });
      var nameIdx = headers.findIndex(function(h) { return /نام|name/i.test(h); });
      var provIdx = headers.findIndex(function(h) { return /استان|province/i.test(h); });
      var typeIdx = headers.findIndex(function(h) { return /نوع|type/i.test(h); });
      var ownerIdx = headers.findIndex(function(h) { return /مسئول|owner|کارشناس/i.test(h); });
      var potIdx = headers.findIndex(function(h) { return /پتانسیل|potential/i.test(h); });
      
      if (nameIdx < 0) { showToast('⚠ ستون «نام» یافت نشد'); return; }
      
      var preview = rows.slice(1, 6).filter(function(r) { return r[nameIdx]; });
      
      var body = '<div style="font-size:12px;margin-bottom:12px;color:var(--text-muted)">شناسایی‌شده: '
        + (rows.length - 1) + ' ردیف — پیش‌نمایش ۵ ردیف اول:</div>'
        + '<div style="background:var(--bg-raised);border-radius:6px;padding:8px;margin-bottom:12px;font-size:11px;overflow-x:auto">'
        + '<table style="width:100%;border-collapse:collapse">'
        + '<tr style="border-bottom:1px solid var(--border)">'
        + ['نام','استان','نوع','مسئول','پتانسیل'].map(function(h){return '<th style="padding:4px 8px;text-align:right;color:var(--text-muted)">'+h+'</th>';}).join('')
        + '</tr>'
        + preview.map(function(r) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + ['نام','استان','نوع','مسئول','پتانسیل'].map(function(h, i) {
              var idx2 = [nameIdx, provIdx, typeIdx, ownerIdx, potIdx][i];
              return '<td style="padding:4px 8px">' + esc(idx2 >= 0 ? String(r[idx2]) : '—') + '</td>';
            }).join('')
            + '</tr>';
        }).join('')
        + '</table></div>'
        + '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px;font-size:11px;margin-bottom:10px">'
        + '⚠ مراکز وارد شده به عنوان «مراکز اضافه» (DB.extra) ذخیره می‌شوند.'
        + '</div>'
        + '<div style="font-size:12px">استان پیش‌فرض برای مراکز بدون استان: <select id="importProvDef" style="padding:4px;border:1px solid var(--border-input);border-radius:4px;font-family:inherit;font-size:11px">'
        + getAllProvinces().map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('')
        + '</select></div>';
      
      var rowsJson = JSON.stringify(rows);
      var foot = '<button class="btn-secondary" onclick="closeModal(\'importCentersModal\')">انصراف</button>'
        + '<button class="btn-primary" onclick="doImportCenters(JSON.parse(this.dataset.rows),'+nameIdx+','+provIdx+','+typeIdx+','+ownerIdx+','+potIdx+')" data-rows=\''+rowsJson.replace(/'/g,"&#39;")+'\'">✅ وارد کردن '+(rows.length-1)+' مرکز</button>';
      
      openModal('importCentersModal', '📥 وارد کردن مراکز از Excel', body, foot);
    } catch(err) {
      showToast('⚠ خطا در خواندن فایل: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function doImportCenters(rows, nameIdx, provIdx, typeIdx, ownerIdx, potIdx) {
  if (!DB.extra) DB.extra = [];
  var dataRows = rows.slice(1).filter(function(r) { return r[nameIdx]; });
  var defProv = (document.getElementById('importProvDef') || {}).value || 'tehran';
  var added = 0;
  
  dataRows.forEach(function(r) {
    var name = String(r[nameIdx]).trim();
    if (!name) return;
    var provRaw = provIdx >= 0 ? String(r[provIdx]).trim() : '';
    var province_id = defProv;
    if (provRaw) {
      var pFound = getAllProvinces().find(function(p) { return fNorm(p.name).indexOf(fNorm(provRaw)) >= 0; });
      if (pFound) province_id = pFound.id;
    }
    var id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    var entry = {
      id: id,
      name: name,
      province_id: province_id,
      type: typeIdx >= 0 ? String(r[typeIdx]).trim() : '',
      potential: potIdx >= 0 ? (parseInt(r[potIdx]) || 1) : 1,
      owner: '',
      source: 'excel_import'
    };
    if (ownerIdx >= 0 && r[ownerIdx]) {
      var ownerRaw = fNorm(String(r[ownerIdx]));
      var matchedOwner = Object.keys(USERS).find(function(uid) { return fNorm(USERS[uid]).indexOf(ownerRaw) >= 0; });
      if (matchedOwner) entry.owner = matchedOwner;
    }
    DB.extra.push(entry);
    added++;
  });
  
  saveDB();
  closeModal('importCentersModal');
  renderTable();
  showToast('✅ ' + added + ' مرکز وارد شد', 3000);
}

function exportCentersExcel(){
  _buildPCCache();
  var rows=[['استان','نام مرکز','نوع','پتانسیل','سرنخ','مسئول','وضعیت','پیگیری بعدی']];
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    var centers=getProvCenters(p.id);
    centers.forEach(function(c){
      var e=getE(rtype,c.id);
      rows.push([
        p.name,
        c.name,
        e.type||c.type||'',
        e.potential||c.potential||'',
        e.lead||c.lead||'',
        USERS[e.owner||c.owner||'']||e.owner||c.owner||'',
        e.status||'بدون تماس',
        e.followupDate||''
      ]);
    });
  });
  var csv=rows.map(function(r){return r.map(function(c){return'"'+(c||'').toString().replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_centers_'+todayStr().replace(/\//g,'-')+'.csv';a.click();
  showToast('خروجی اکسل مراکز دانلود شد ✅',2500);
}


// ══ Theme Toggle ══

function toggleTopMenu(){
  var d=document.getElementById('topMenuDropdown');
  if(d)d.classList.toggle('open');
  document.addEventListener('click',function closeMenu(e){
    if(!e.target.closest('#topMenuDropdown')&&!e.target.closest('#menuToggle')){
      d&&d.classList.remove('open');
      document.removeEventListener('click',closeMenu);
    }
  });
}

function toggleTheme(){
  var html=document.documentElement;
  var isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',isDark?'light':'dark');
  try{localStorage.setItem('atena_theme',isDark?'light':'dark');}catch(e){}
  var btn=document.getElementById('themeTglBtn');
  if(btn)btn.textContent=isDark?'🌙 دارک':'☀️ لایت';
}
function applyStoredTheme(){
  var t='light';try{t=localStorage.getItem('atena_theme')||'light';}catch(e){}
  document.documentElement.setAttribute('data-theme',t);
  var btn=document.getElementById('themeTglBtn');
  if(btn)btn.textContent=t==='dark'?'☀️ لایت':'🌙 دارک';
}

function _sendWeeklyDigest(){
  if(!_isManager())return;
  var lastSent=DB.settings&&DB.settings.lastWeeklyDigest||'';
  var today=todayStr();
  if(lastSent){
    var lp=lastSent.split('/').map(Number),tp=today.split('/').map(Number);
    var daysDiff=Math.round((jMs(tp[0],tp[1],tp[2])-jMs(lp[0],lp[1],lp[2]))/86400000);
    if(daysDiff<7)return;
  }
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var mon=currentJMonth();
  var lines=[];
  members.filter(function(m){return m.active!==false&&m.role!=='مهمان'&&m.role!=='سوپر ادمین'&&m.role!=='مدیر';}).forEach(function(m){
    try{
      var calls=getCallsMonth(m.id,mon).reduce(function(s,l){return s+(l.count||0);},0);
      var visits=(getVisitsMonth(m.id,mon).total||0);
      lines.push(m.name+': '+calls+' تماس، '+visits+' ملاقات');
    }catch(e){}
  });
  if(!lines.length)return;
  var msg='📊 خلاصه هفتگی '+mon+':\n'+lines.join(' | ');
  sendNotif(currentUser,msg,'');
  if(!DB.settings)DB.settings={};
  DB.settings.lastWeeklyDigest=today;
  saveDB();
}

async function init(){
  applyStoredTheme(); // early so no flash
  try{
    // Check auth first
    var authR=await fetch('/api/auth/me');
    if(authR.status===401){showLoginOverlay();return;}
    var authData=await authR.json();
    currentUser=authData.username||currentUser;
    window._authUserRole=authData.role||'';
    window._myPermissions=authData.permissions||{};
    window._myDepartment=authData.department||'';
    window._myDirectManager=authData.direct_manager||'';
  }catch(e){
    showLoginOverlay();return;
  }
  await loadDB();
  initSettings();initTags();initWeekTags();initEvents();_initNotif();
  _initBrowserNotif();
  setTimeout(_sendWeeklyDigest,3000);
  buildUSERS();updateNotifBadge();
  setTimeout(_setupAutoReminder,5000);
  // Restore tab BEFORE loadMasterCenters so that even if centers fail to load,
  // currentTab is always the right value (default was 'provinces' which was wrong).
  try{
    var _st=localStorage.getItem('_st');
    var _spid=localStorage.getItem('_spid');
    var _svm=localStorage.getItem('_svm');
    if(_svm&&['list','card','pipeline'].indexOf(_svm)>=0)_viewMode=_svm;
    if(_st&&['home','provinces','weekplan','calendar','checklist','activity','kpi','manager','mtr','pricing','tasks','changelog','proforma','support','hr','trade-kpi'].indexOf(_st)>=0)currentTab=_st;
    if(_spid)_currentProvId=_spid;
  }catch(e){}
  if(!_st) currentTab=_isManager()?'manager':'home';
  if(window.innerWidth<768) currentTab='home';
  if(_isManager()){
    document.querySelectorAll('.sb-manager-wrap').forEach(function(el){el.style.display='';});
  }
  (function(){
    var _ms=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
    var _me=_ms.find(function(m){return m.id===currentUser;});
    var _r=(_me?_me.role:'')||(window._authUserRole||'');
    if(_r==='مدیر'||_r==='سوپر ادمین'||_r==='کارشناس بازرگانی'){
      document.querySelectorAll('.sb-trade-wrap').forEach(function(el){el.style.display='';});
    }
    if(_r==='مدیر'||_r==='سوپر ادمین'){
      document.querySelectorAll('.sb-manager-wrap').forEach(function(el){el.style.display='';});
    }
    if(_r==='سوپر ادمین'){
      document.querySelectorAll('.sb-super-wrap').forEach(function(el){el.style.display='';});
    }
  })();
  // Apply granular permission hiding (additive — only hides, never shows what role already hides)
  (function(){
    var _allMods=['provinces','weekplan','calendar','checklist','activity','tasks','mtr','pricing','proforma','support','hr','trade-kpi','kpi','manager','changelog','wms','letters'];
    _allMods.forEach(function(mod){
      if(!_hasAccess(mod)){
        var btnId='tab_'+mod.replace('-','_');
        var btn=document.getElementById(btnId);
        if(btn)btn.style.display='none';
      }
    });
  })();
  loadMasterCenters().then(function(){
    _typeFilterBuilt=false;
    cleanupOrphanedEntries(false);
    var _dedup=wpDeduplicateEntries();if(_dedup>0){saveDBSync();console.info('[wp] dedup removed',_dedup,'duplicate week entries');}
    var _reconciled=wpReconcileFollowupDates();if(_reconciled>0){saveDBSync();console.info('[wp] reconciled',_reconciled,'missing week entries');}
    rebuildFilters();buildTypeFilter();
    switchTab(currentTab);
    _initOnboarding();
    var _clbtn=document.getElementById('tab_changelog');if(_clbtn)_clbtn.style.display=_isManager()?'':'none';
    var _tbtn=document.getElementById('tab_tasks');if(_tbtn)_tbtn.style.display='';
    // بعد از اتمام init، history navigation فعال می‌شود
    _navReady=true;
    try{history.replaceState({v:1,tab:currentTab,provId:_currentProvId||null},'',window.location.pathname+window.location.search);}catch(e){}
    checkEmptyDB();
    // Build cache + populate CNC now that PC_RAW is ready
    _PC_CACHE=null;_buildPCCache();
    if(currentTab==='weekplan') setTimeout(renderWeekPlan,100);
  }).catch(function(){
    rebuildFilters();buildTypeFilter();switchTab(currentTab);
    _initOnboarding();
    checkEmptyDB();
    if(currentTab==='weekplan') setTimeout(renderWeekPlan,100);
  });
  // ── بررسی پیگیری‌های سررسیده ──
  setTimeout(function(){
    try{
      var today=todayStr();
      var dueCnt=0;
      Object.keys(DB.edits||{}).forEach(function(k){
        var e=DB.edits[k];
        if(e&&e.followupDate&&e.followupDate<today&&e.followupDate!=='')dueCnt++;
      });
      if(dueCnt>0){
        showToast('⚠ '+dueCnt+' مرکز با پیگیری سررسیده دارید',5000);
        var tb=document.getElementById('tab_weekplan');
        if(tb&&tb.innerHTML.indexOf('badge-due')<0){
          tb.innerHTML='📋 برنامه هفته <span class="badge-due" style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;vertical-align:middle">'+dueCnt+'</span>';
        }
      }
    }catch(e2){}
  },1500);
  // ── هشدار مراکز خاموش (P1/P2 با ۳۰+ روز بی‌فعالیت) ──
  setTimeout(function(){
    try{
      _buildPCCache();
      var silentCenters=[];
      var nowMs=Date.now();
      var thirtyDaysMs=30*24*60*60*1000;
      function _checkSilent(arr,rtype){
        arr.forEach(function(r){
          var e=getE(rtype,r.id);
          var st=e.status||'بدون تماس';
          if(st==='غیرفعال'||st==='قرارداد بسته شد')return;
          var pot=parseInt(e.potential!==undefined?e.potential:r.potential||4);
          if(pot>2)return;
          var owner=e.owner||r.owner||'';
          if(!_isManager()&&owner!==currentUser)return;
          var lastTs=e._lastActivity||e._ts||0;
          if(!lastTs||(nowMs-lastTs)>=thirtyDaysMs){
            silentCenters.push({name:r.name,owner:owner,pot:pot});
          }
        });
      }
      getAllProvinces().forEach(function(p){
        var rt=getProvType(p.id);
        _checkSilent(getProvCenters(p.id),rt);
      });
      if(silentCenters.length>0){
        showToast('🔇 '+silentCenters.length+' مرکز P1/P2 بیش از ۳۰ روز است که فعالیتی ندارند',6000);
      }
    }catch(e3){}
  },3000);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeAllModals();closeQS();}
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGSearch();}
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){var ae=document.activeElement;var isInput=ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA');if(!isInput){e.preventDefault();undoEdit();}}
    if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){var ae2=document.activeElement;var isInput2=ae2&&(ae2.tagName==='INPUT'||ae2.tagName==='TEXTAREA');if(!isInput2){e.preventDefault();redoEdit();}}
  });
  initSSE();
}


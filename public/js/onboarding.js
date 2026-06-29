/* ═══ public/js/onboarding.js ═══ */
// ════════════════════════ ONBOARDING TUTORIAL ════════════════════════
var _TAB_TUTORIALS = {
  home: {
    title: 'خانه',
    steps: [
      {icon:'☀️', title:'امروز من', text:'مراکزی که برای امروز برنامه‌ریزی کردی — مستقیم دسترسی داری'},
      {icon:'🎯', title:'اولویت‌بندی هوشمند', text:'سیستم بر اساس پتانسیل و تاخیر، مهم‌ترین مراکز برای پیگیری رو اول نشون می‌ده'},
      {icon:'🔴', title:'پیگیری معوق', text:'مراکزی که تاریخ فالوآپشون گذشته — باید اول پیگیری بشن'},
      {icon:'📋', title:'بدون تاریخ', text:'مراکزی که هنوز تاریخ پیگیری ندارن — ردیف‌های نارنجی در جدول'},
    ]
  },
  provinces: {
    title: 'استان‌ها',
    steps: [
      {icon:'📞', title:'پانل تماس سریع', text:'دکمه 📞 کنار نام هر مرکز — آخرین یادداشت + ثبت تماس + تغییر فالوآپ بدون باز کردن مدال کامل'},
      {icon:'⊟', title:'نمای فشرده', text:'دکمه ⊟ بالای جدول — ستون‌های کم‌اهمیت (نوع، سرنخ، هفته) رو مخفی می‌کنه'},
      {icon:'+امروز', title:'اضافه به برنامه امروز', text:'دکمه +امروز کنار ستون هفته — یک‌کلیک مرکز رو به برنامه همین امروز اضافه می‌کنه'},
      {icon:'📅', title:'فالوآپ سریع', text:'دکمه‌های +۱ / +۳ / +۷ روز کنار تاریخ — بدون تایپ، فالوآپ رو جلو می‌بری'},
      {icon:'🔍', title:'فیلتر هوشمند', text:'فیلترهای overdue / nofollowup / stalled — مراکز مهم رو فوری پیدا کن'},
      {icon:'🌡️', title:'هیت‌مپ استان', text:'رنگ کارت استان: سبز = وضع خوب، زرد = متوسط، قرمز = معوق زیاد'},
    ]
  },
  weekplan: {
    title: 'برنامه هفته',
    steps: [
      {icon:'✅', title:'نتیجه اجباری', text:'وقتی «انجام شد» می‌زنی باید یکی رو انتخاب کنی: 🔄 پیگیری (تاریخ بعدی اجباری) / ✅ قرارداد / ❌ غیرفعال'},
      {icon:'📊', title:'KPI خودکار', text:'هر «انجام شد» در برنامه هفته، خودکار در KPI شمرده می‌شه — دیگه نیازی به ثبت دستی نیست'},
      {icon:'🎯', title:'درگ و دراپ', text:'مراکز رو بین روزهای مختلف هفته بکش و رها کن — تاریخ برنامه خودکار آپدیت می‌شه'},
      {icon:'👤', title:'فیلتر کارشناس', text:'با فیلتر بالا برنامه هر کارشناس رو جداگانه ببین — مدیر می‌تونه هر کارشناس رو انتخاب کنه'},
      {icon:'📞🤝', title:'شمارنده تماس', text:'در جدول مراکز badge سبز/آبی نشون می‌ده چند تماس و مراجعه برای اون مرکز ثبت شده'},
    ]
  },
  tasks: {
    title: 'وظایف',
    steps: [
      {icon:'🔄', title:'وظایف تکرارشونده', text:'تو مدال وظیفه، تکرار روزانه / هفتگی / ماهانه تنظیم کن — بعد از انجام، نسخه بعدی خودکار ساخته می‌شه'},
      {icon:'📋', title:'زیروظیفه ۳ سطحی', text:'«+ زیروظیفه» رو توی هر وظیفه بزن — تا ۳ سطح تودرتو پشتیبانی می‌شه'},
      {icon:'⚙️', title:'ستون‌های سفارشی', text:'دکمه ⚙️ ستون‌ها — هر کارشناس می‌تونه ستون‌های کانبان خودش رو بسازه'},
      {icon:'🔗', title:'لینک به مرکز', text:'هر وظیفه می‌تونه به یک مرکز وصل بشه — برای پیگیری فروش یک مشتری خاص'},
      {icon:'🏷️', title:'اولویت و مالک', text:'اولویت ۱-۳ و مالک وظیفه — مدیر می‌تونه به هر کارشناس وظیفه تخصیص بده'},
    ]
  },
  calendar: {
    title: 'تقویم',
    steps: [
      {icon:'📅', title:'سه نما', text:'تقویم ماهانه / هفتگی / لیستی — با دکمه‌های بالا جابجا شو'},
      {icon:'🔵', title:'رویدادها', text:'رویدادهای دستی رو با کلیک روی روز تقویم اضافه کن'},
      {icon:'🔴', title:'فالوآپ‌ها', text:'تاریخ‌های پیگیری مراکز در تقویم نمایش داده می‌شن'},
    ]
  },
  checklist: {
    title: 'چک‌لیست',
    steps: [
      {icon:'☑️', title:'امتیاز روزانه', text:'هر آیتم که تیک بزنی امتیاز می‌گیری — هدف ۱۰۰٪ روزانه'},
      {icon:'📊', title:'پیشرفت هفتگی', text:'نمودار امتیاز هر روز هفته رو بالای صفحه ببین'},
    ]
  },
  kpi: {
    title: 'KPI',
    steps: [
      {icon:'↑↓', title:'مقایسه هفتگی', text:'هفته جاری vs هفته قبل — فلش‌های سبز/قرمز تغییر رو نشون می‌دن'},
      {icon:'🚨', title:'هشدار صفر فعالیت', text:'اگه کارشناسی این هفته هیچ فعالیتی نداشته، بنر قرمز نشون داده می‌شه'},
      {icon:'📞', title:'ثبت از هفته‌برنامه', text:'هر «انجام شد» در برنامه هفته، خودکار اینجا شمرده می‌شه — بدون ثبت دستی'},
      {icon:'🎯', title:'اهداف ماهانه', text:'روی دکمه «هدف‌گذاری» هر کارشناس کلیک کن و هدف ماهانه تنظیم کن'},
    ]
  },
  manager: {
    title: 'بررسی مدیر',
    steps: [
      {icon:'👤', title:'کلیک روی کارشناس', text:'روی هر ردیف کارشناس کلیک کن — گزارش کامل با تمام مراکز و آخرین یادداشت‌ها'},
      {icon:'🔴', title:'معوق کلیک‌پذیر', text:'روی عدد معوق کلیک کن — لیست همه مراکز معوق اون کارشناس با یک‌کلیک'},
      {icon:'📊', title:'ماتریس پایپ‌لاین', text:'جدول پتانسیل × وضعیت — ببین هر کارشناس چقدر مرکز P1 در مذاکره داره'},
      {icon:'📋', title:'خلاصه امروز', text:'پایین صفحه: همه فعالیت‌های امروز تیم رو یکجا ببین'},
    ]
  },
};

var _obCurrentStep = 0;

function _onboardingDay(){
  try{
    var fu = DB.settings && DB.settings.firstUse && DB.settings.firstUse[currentUser];
    if(!fu) return 1;
    var parts = fu.split('/');
    var fuMs = jMs(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    var todayParts = todayStr().split('/');
    var todayMs = jMs(parseInt(todayParts[0]), parseInt(todayParts[1]), parseInt(todayParts[2]));
    var diff = Math.floor((todayMs - fuMs) / 86400000);
    return Math.max(1, Math.min(7, diff + 1));
  }catch(e){ return 1; }
}

// ── Tab Tutorial System ──────────────────────────────────────────────────────
function _obGetTabCount(tab){
  try{
    var data=JSON.parse(localStorage.getItem('ob_tab_v3')||'{}');
    return ((data[currentUser]||{})[tab])||0;
  }catch(e){return 0;}
}
function _obIncrTabCount(tab){
  try{
    var data=JSON.parse(localStorage.getItem('ob_tab_v3')||'{}');
    if(!data[currentUser])data[currentUser]={};
    data[currentUser][tab]=(_obGetTabCount(tab))+1;
    localStorage.setItem('ob_tab_v3',JSON.stringify(data));
  }catch(e){}
}
function _showTabTutorial(tab){
  var tut=_TAB_TUTORIALS[tab];
  if(!tut)return;
  if(_obGetTabCount(tab)>=3)return;
  var ex=document.getElementById('_tabTutPanel');if(ex)ex.remove();
  var remaining=3-_obGetTabCount(tab);
  var cards=tut.steps.map(function(s){
    return '<div style="background:rgba(255,255,255,.9);border-radius:8px;padding:9px 11px;flex:1;min-width:130px;max-width:210px;border:1px solid #c7d2fe">'
      +'<div style="font-size:15px;margin-bottom:2px">'+s.icon+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:#1e1b4b;margin-bottom:2px">'+s.title+'</div>'
      +'<div style="font-size:10px;color:#4b5563;line-height:1.5">'+s.text+'</div>'
      +'</div>';
  }).join('');
  var html='<div id="_tabTutPanel" style="position:relative;z-index:10;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1.5px solid #a5b4fc;border-radius:10px;padding:10px 14px;margin:8px 16px 4px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">'
    +'<span style="font-size:12px;font-weight:700;color:#4338ca;white-space:nowrap">🎓 راهنمای '+tut.title+'</span>'
    +'<span style="font-size:10px;color:#818cf8;flex:1">'+remaining+' بار دیگه نشون داده می‌شه</span>'
    +'<button onclick="_dismissTabTutorial(\''+tab+'\')" style="font-size:11px;padding:4px 14px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">✓ متوجه شدم</button>'
    +'</div>'
    +'<div style="display:flex;gap:7px;flex-wrap:wrap">'+cards+'</div>'
    +'</div>';
  // For provinces, inject before the provGrid/mainTable area
  var panelMap={
    home:'homePanel',weekplan:'wpPanel',tasks:'tasksPanel',calendar:'calPanel',
    checklist:'ckPanel',activity:'actPanel',kpi:'kpiPanel',manager:'managerPanel',
    changelog:'changelogPanel',mtr:'mtrPanel',pricing:'pricingPanel',proforma:'proformaPanel'
  };
  if(tab==='provinces'){
    var fb=document.getElementById('filtersBar');
    if(fb&&fb.parentNode){fb.parentNode.insertBefore(Object.assign(document.createElement('div'),{innerHTML:html}).firstChild,fb);}
    return;
  }
  var panelId=panelMap[tab];
  var panel=panelId?document.getElementById(panelId):null;
  if(panel){panel.insertAdjacentHTML('afterbegin',html);}
  else{document.body.insertAdjacentHTML('afterbegin',html);}
}
function _dismissTabTutorial(tab){
  _obIncrTabCount(tab);
  var el=document.getElementById('_tabTutPanel');
  if(el){el.style.animation='fadeOut .2s ease forwards';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},220);}
}
function _initOnboarding(){
  // Legacy: no-op (replaced by tab tutorial system)
}
function _shouldShowOnboarding(){return false;}
// ════════════════════════ END ONBOARDING ═════════════════════════════

var _sse = null;
var _sseReconnectTimer = null;
var _sseReloadTimer = null;
var _ssePendingBy = null;

function initSSE() {
  if (_sse) return;
  _sse = new EventSource('/api/events/stream?cid='+_sseClientId);
  _sse.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'db-updated') {
        _sseReloadDB(data.by);
      } else if (data.type === 'notif_new' && data.to === currentUser) {
        _refreshNotifs();
        if (data.msg) _firePushNotif('🔔 اعلان جدید', data.msg, 'notif-' + Date.now());
      }
    } catch(err) {}
  };
  _sse.onerror = function() {
    _sse.close(); _sse = null;
    clearTimeout(_sseReconnectTimer);
    _sseReconnectTimer = setTimeout(initSSE, 8000);
  };
}

function _sseReloadDB(byUser) {
  if (!byUser) return;
  // Skip own saves from THIS browser tab (not from Telegram)
  var _isTgBot = byUser && byUser.indexOf(':bot') !== -1;
  if (!_isTgBot && byUser === currentUser) return;
  // Update who triggered the last sync (for toast message)
  _ssePendingBy = _isTgBot ? byUser.replace(':bot','') : byUser;
  // Debounce: coalesce multiple rapid events into one fetch+render
  clearTimeout(_sseReloadTimer);
  _sseReloadTimer = setTimeout(function() {
    var triggeredBy = _ssePendingBy;
    _ssePendingBy = null;
    fetch('/api/data/db').then(function(r){ return r.ok ? r.json() : null; }).then(function(d) {
      if (!d || typeof d !== 'object') return;
      if (d._serverTs) _dbServerTs = d._serverTs;
      var merged = Object.assign({}, DB, d);
      merged.weekEntries = Object.assign({}, DB.weekEntries, d.weekEntries || {});
      merged.edits = Object.assign({}, DB.edits, d.edits || {});
      // Preserve local read=true — SSE must not un-read notifications the user already opened
      if (d.notifications && DB.notifications && DB.notifications.length) {
        var _localRead={};
        DB.notifications.forEach(function(n){if(n.read)_localRead[n.id]=true;});
        merged.notifications=(d.notifications||[]).map(function(n){
          return _localRead[n.id]?Object.assign({},n,{read:true}):n;
        });
      }
      delete merged._serverTs; delete merged._clientTs;
      Object.keys(merged).forEach(function(k) { DB[k] = merged[k]; });
      // Only re-render if no pending user save (avoids clobbering active edits)
      if (!_saveDebounceTimer) {
        if (currentTab === 'weekplan') renderWeekPlan();
        else if (currentTab === 'provinces') { renderDashboard(); renderTable(); }
        else if (currentTab === 'activity') renderActivity();
        else if (currentTab === 'kpi') renderKPIPanel();
        else if (currentTab === 'manager') renderManagerPanel();
      }
      var _tgSuffix = triggeredBy && triggeredBy.endsWith(':bot') ? ' (تلگرام)' : '';
      var _tgBy = triggeredBy ? triggeredBy.replace(':bot','') : null;
      var name = _tgBy ? (USERS[_tgBy] || _tgBy) : 'کاربر دیگری';
      showToast('🔄 ' + name + _tgSuffix + ' تغییراتی اعمال کرد', 2500);
    }).catch(function() {});
  }, 1500);
}


// ── پاک‌سازی ورودی‌های منسوخ (orphaned) ─────────────────────────
function _getAllValidRecKeys(){
  var valid=new Set();
  // تهران
  CENTERS.forEach(function(c){valid.add('center_'+c.id);});
  // استانی
  _buildPCCache();
  Object.keys(_PC_CACHE).forEach(function(provId){
    (_PC_CACHE[provId]||[]).forEach(function(c){valid.add('pc_'+c.id);});
  });
  // دستی
  (DB.extra||[]).forEach(function(c){
    var rtype=c.province_id==='tehran'?'center':'pc';
    valid.add(rtype+'_'+c.id);
  });
  return valid;
}

function cleanupOrphanedEntries(showReport){
  var valid=_getAllValidRecKeys();
  if(!valid.size)return; // دیتابیس خالی، چیزی پاک نکن

  var removedWP=0,removedFU=0;

  // weekEntries پاک‌سازی
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    var rk=we.recKey||(we.rtype?we.rtype+'_'+we.rid:'');
    if(rk&&!valid.has(rk)){
      _weRemove(k);removedWP++;
    }
  });

  // followupDate پاک‌سازی از edits مراکز حذف‌شده
  Object.keys(DB.edits||{}).forEach(function(k){
    if(!valid.has(k)&&DB.edits[k].followupDate){
      delete DB.edits[k].followupDate;removedFU++;
    }
  });

  if(removedWP||removedFU){
    saveDB();
    if(showReport)
      showToast('🧹 پاک‌سازی: '+removedWP+' ورودی هفته و '+removedFU+' پیگیری منسوخ حذف شد',4000);
  }else if(showReport){
    showToast('✅ هیچ ورودی منسوخی یافت نشد');
  }
  return{removedWP:removedWP,removedFU:removedFU};
}

// نمایش راهنما اگر دیتابیس خالی است
function checkEmptyDB(){
  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0)+(DB.extra||[]).length;
  var msg=document.getElementById('emptyDBMsg');
  if(!msg)return;
  var tw=document.querySelector('.table-wrap');
  var pg=document.getElementById('provGrid');
  if(totalCenters===0){
    msg.style.display='block';
    if(pg)pg.style.display='none';
    if(tw)tw.style.display='none';
  }else{
    msg.style.display='none';
    if(tw)tw.style.display='';
  }
}

// ═══════════════════════════════════════════════════════════════════

// ════════════════════════ ONBOARDING TUTORIAL ════════════════════════
var _OB_STEPS = [
  {
    day: 1,
    title: 'خوش آمدید به آتنا CRM!',
    tips: [
      'از منوی بالا تب <b>استان‌ها</b> را انتخاب کنید تا لیست استان‌ها را ببینید.',
      'روی یک استان کلیک کنید تا مراکز آن استان نمایش داده شود.',
      'می‌توانید مراکز را به صورت لیست، کانبان یا کارت مشاهده کنید.',
      'با کلیک روی هر مرکز، جزئیات و گزینه‌های ویرایش را باز کنید.'
    ]
  },
  {
    day: 2,
    title: 'پیگیری و برنامه هفته',
    tips: [
      'در صفحه مرکز، تاریخ پیگیری بعدی را تنظیم کنید.',
      'تب <b>برنامه هفته</b> نقشه بازدیدهای هفتگی شما را نشان می‌دهد.',
      'مراکزی که پیگیری سررسیده دارند با رنگ هشدار نمایش داده می‌شوند.',
      'مراکز را به روزهای مختلف هفته اضافه یا جابجا کنید.'
    ]
  },
  {
    day: 3,
    title: 'ثبت فعالیت',
    tips: [
      'در صفحه هر مرکز می‌توانید تماس، بازدید یا فروش ثبت کنید.',
      'بعد از بازدید، وضعیت مرکز را به‌روز کنید.',
      'تب <b>فعالیت‌ها</b> کل لاگ تماس‌ها و بازدیدها را نشان می‌دهد.',
      'می‌توانید هر فعالیت را به یک مرکز خاص مرتبط کنید.'
    ]
  },
  {
    day: 4,
    title: 'برچسب، وضعیت و سرنخ',
    tips: [
      'هر مرکز می‌تواند یک یا چند <b>برچسب</b> داشته باشد.',
      'وضعیت (مثلاً: در حال مذاکره، فروخته شده) را برای هر مرکز تنظیم کنید.',
      'سرنخ‌ها (Lead) نشان می‌دهند مرکز در چه مرحله‌ای از فرآیند فروش است.',
      'از فیلتر بالای لیست مراکز برای جستجو بر اساس وضعیت یا برچسب استفاده کنید.'
    ]
  },
  {
    day: 5,
    title: 'اعلان‌ها و یادآوری‌ها',
    tips: [
      'زنگ اعلان در بالای صفحه مراکز با پیگیری سررسیده را هشدار می‌دهد.',
      'می‌توانید یادآورهای دستی برای هر مرکز تنظیم کنید.',
      'تب <b>تقویم</b> رویدادها و سررسیدها را به صورت ماهانه نشان می‌دهد.',
      'اعلان‌های دیده‌شده را می‌توانید از پنل اعلان‌ها حذف کنید.'
    ]
  },
  {
    day: 6,
    title: 'وظایف و تایم‌لاین مرکز',
    tips: [
      'تب <b>چک‌لیست روزانه</b> وظایف روزانه شما را نشان می‌دهد.',
      'در صفحه هر مرکز، تایم‌لاین تمام تعاملات قابل مشاهده است.',
      'می‌توانید یادداشت‌های خصوصی برای هر مرکز ثبت کنید.',
      'وظایف انجام‌شده را تیک بزنید تا امتیاز روزانه شما محاسبه شود.'
    ]
  },
  {
    day: 7,
    title: 'گزارش و KPI',
    tips: [
      'تب <b>KPI</b> (فقط مدیر) اهداف و عملکرد تیم را نمایش می‌دهد.',
      'کارشناسان می‌توانند آمار شخصی خود را در تب فعالیت‌ها ببینند.',
      'از بخش تنظیمات می‌توانید داده‌ها را به اکسل خروجی بگیرید.',
      'آموزش راهنما را هر زمان از تنظیمات می‌توانید دوباره فعال کنید.'
    ]
  }
];

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

function _shouldShowOnboarding(){
  try{
    if(!currentUser) return false;
    if(DB.settings && DB.settings.onboardingDisabled && DB.settings.onboardingDisabled[currentUser]) return false;
    var fu = DB.settings && DB.settings.firstUse && DB.settings.firstUse[currentUser];
    if(!fu) return true; // firstUse not set yet — will be set in _initOnboarding
    var parts = fu.split('/');
    var fuMs = jMs(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    var todayParts = todayStr().split('/');
    var todayMs = jMs(parseInt(todayParts[0]), parseInt(todayParts[1]), parseInt(todayParts[2]));
    var diff = Math.floor((todayMs - fuMs) / 86400000);
    return diff < 7;
  }catch(e){ return false; }
}

function _initOnboarding(){
  try{
    if(!currentUser) return;
    if(!DB.settings) DB.settings = {};
    if(!DB.settings.firstUse) DB.settings.firstUse = {};
    if(!DB.settings.onboardingDisabled) DB.settings.onboardingDisabled = {};
    if(!DB.settings.firstUse[currentUser]){
      DB.settings.firstUse[currentUser] = todayStr();
      saveDB();
    }
    if(_shouldShowOnboarding()){
      setTimeout(_showOnboardingWidget, 800);
    }
  }catch(e){ console.warn('[onboarding] init error', e); }
}

function _showOnboardingWidget(){
  if(document.getElementById('onboardingWidget')) return;
  _obCurrentStep = 0;
  _obRenderWidget();
}

function _obRenderWidget(){
  var existing = document.getElementById('onboardingWidget');
  var wasMinimized = existing && existing.classList.contains('ob-minimized');
  if(existing) existing.remove();

  var step = _OB_STEPS[_obCurrentStep] || _OB_STEPS[0];
  var day = _obCurrentStep + 1;

  var dots = _OB_STEPS.map(function(s, i){
    return '<span class="ob-step-dot'+(i===_obCurrentStep?' active':'')+'" onclick="_obGoStep('+i+')" title="روز '+(i+1)+'" style="cursor:pointer"></span>';
  }).join('');

  var tips = step.tips.map(function(t){ return '<li>'+t+'</li>'; }).join('');

  var prevDisabled = _obCurrentStep === 0 ? 'disabled style="opacity:.4;cursor:default"' : '';
  var nextDisabled = _obCurrentStep === 6 ? 'disabled style="opacity:.4;cursor:default"' : '';

  var html = '<div id="onboardingWidget"'+(wasMinimized?' class="ob-minimized"':'')+'>'
    +'<div class="ob-header" onclick="_obToggleMinimize(event)">'
    +'<div class="ob-header-title"><span>🎓</span><span>راهنمای آموزشی — '+(7-_onboardingDay()+1)+'/۷ روز باقی‌مانده</span></div>'
    +'<div class="ob-header-btns" onclick="event.stopPropagation()">'
    +'<button class="ob-mini-btn" onclick="_obToggleMinimize(event)" title="کوچک/بزرگ">⊟</button>'
    +'</div>'
    +'</div>'
    +'<div id="onboardingBody">'
    +'<div class="ob-step-indicator">'+dots+'<span class="ob-step-label">روز '+day+' از ۷</span></div>'
    +'<div class="ob-body"><div class="ob-day-title">'+step.title+'</div><ul>'+tips+'</ul></div>'
    +'<div class="ob-footer" id="onboardingFooter">'
    +'<button class="ob-btn-dismiss" onclick="_dismissOnboarding(true)">بستن و غیرفعال‌کردن</button>'
    +'<div class="ob-nav-btns">'
    +'<button class="ob-btn-nav" '+prevDisabled+' onclick="_obGoStep('+(_obCurrentStep-1)+')">→ قبلی</button>'
    +'<button class="ob-btn-nav" '+nextDisabled+' onclick="_obGoStep('+(_obCurrentStep+1)+')">بعدی ←</button>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'</div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // click outside to minimize
  setTimeout(function(){
    document.addEventListener('click', _obOutsideClick, {capture: false, once: false, passive: true});
  }, 200);
}

var _obOutsideClickBound = false;
function _obOutsideClick(e){
  var w = document.getElementById('onboardingWidget');
  if(!w) { document.removeEventListener('click', _obOutsideClick); return; }
  if(!w.contains(e.target)){
    if(!w.classList.contains('ob-minimized')) w.classList.add('ob-minimized');
  }
}

function _obToggleMinimize(e){
  if(e) e.stopPropagation();
  var w = document.getElementById('onboardingWidget');
  if(w) w.classList.toggle('ob-minimized');
}

function _obGoStep(idx){
  if(idx < 0 || idx > 6) return;
  _obCurrentStep = idx;
  _obRenderWidget();
}

function _dismissOnboarding(disable){
  document.removeEventListener('click', _obOutsideClick);
  var w = document.getElementById('onboardingWidget');
  if(w) w.remove();
  if(disable && currentUser){
    if(!DB.settings) DB.settings = {};
    if(!DB.settings.onboardingDisabled) DB.settings.onboardingDisabled = {};
    DB.settings.onboardingDisabled[currentUser] = true;
    saveDB();
    showToast('آموزش راهنما غیرفعال شد. از تنظیمات می‌توانید دوباره فعال کنید.', 4000);
  }
}
function _reEnableOnboarding(){
  if(!currentUser) return;
  if(!DB.settings) DB.settings = {};
  if(!DB.settings.onboardingDisabled) DB.settings.onboardingDisabled = {};
  if(!DB.settings.firstUse) DB.settings.firstUse = {};
  delete DB.settings.onboardingDisabled[currentUser];
  // Reset firstUse to today so the 7-day window restarts
  DB.settings.firstUse[currentUser] = todayStr();
  saveDB();
  showToast('آموزش راهنما فعال شد!', 3000);
  setTimeout(_showOnboardingWidget, 500);
}
// ════════════════════════ END ONBOARDING ═════════════════════════════

var _sse = null;
var _sseReconnectTimer = null;

function initSSE() {
  if (_sse) return;
  _sse = new EventSource('/api/events/stream?cid='+_sseClientId);
  _sse.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'db-updated') {
        _sseReloadDB(data.by);
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
  fetch('/api/data/db').then(function(r){ return r.ok ? r.json() : null; }).then(function(d) {
    if (!d || typeof d !== 'object') return;
    if (d._serverTs) _dbServerTs = d._serverTs;
    var merged = Object.assign({}, DB, d);
    merged.weekEntries = Object.assign({}, DB.weekEntries, d.weekEntries || {});
    merged.edits = Object.assign({}, DB.edits, d.edits || {});
    delete merged._serverTs; delete merged._clientTs;
    Object.keys(merged).forEach(function(k) { DB[k] = merged[k]; });
    if (currentTab === 'weekplan') renderWeekPlan();
    else if (currentTab === 'provinces') { renderDashboard(); renderTable(); }
    else if (currentTab === 'activity') renderActivity();
    else if (currentTab === 'kpi') renderKPIPanel();
    var name = byUser ? (USERS[byUser] || byUser) : 'کاربر دیگری';
    showToast('🔄 ' + name + ' تغییراتی اعمال کرد', 3000);
  }).catch(function() {});
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
      delete DB.weekEntries[k];removedWP++;
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

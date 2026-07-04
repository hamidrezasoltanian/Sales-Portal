/* ═══ public/js/core.js ═══ */
/* ══ BLOCK 1: Centers placeholder ══ */
var PROVINCES = [{"id":"p1","row":1,"name":"فارس","potential":1,"biopsyPct":7.28,"owner":"Sarah.hosseini"},{"id":"p2","row":2,"name":"اصفهان","potential":1,"biopsyPct":7.68,"owner":"Sarah.hosseini"},{"id":"p3","row":3,"name":"سیستان و بلوچستان","potential":1,"biopsyPct":4.16,"owner":"Mohammad.seyedsalehi"},{"id":"p4","row":4,"name":"مازندران","potential":1,"biopsyPct":4.93,"owner":"Mohammad.seyedsalehi"},{"id":"p5","row":5,"name":"آذربایجان شرقی","potential":1,"biopsyPct":5.86,"owner":"Mohammad.seyedsalehi"},{"id":"p6","row":6,"name":"لرستان","potential":2,"biopsyPct":2.64,"owner":"Mohammad.seyedsalehi"},{"id":"p7","row":7,"name":"بوشهر","potential":2,"biopsyPct":1.74,"owner":"Mohammad.seyedsalehi"},{"id":"p8","row":8,"name":"گلستان","potential":2,"biopsyPct":2.8,"owner":"Mohammad.seyedsalehi"},{"id":"p9","row":9,"name":"خراسان جنوبی","potential":3,"biopsyPct":1.15,"owner":"Rambod.ghasemi"},{"id":"p10","row":10,"name":"چهارمحال و بختیاری","potential":3,"biopsyPct":1.42,"owner":"Mohammad.seyedsalehi"},{"id":"p11","row":11,"name":"اردبیل","potential":3,"biopsyPct":1.91,"owner":"Mohammad.seyedsalehi"},{"id":"p12","row":12,"name":"خراسان رضوی","potential":1,"biopsyPct":9.64,"owner":"Rambod.ghasemi"},{"id":"p13","row":13,"name":"یزد","potential":2,"biopsyPct":1.71,"owner":"Rambod.ghasemi"},{"id":"p14","row":14,"name":"قم","potential":2,"biopsyPct":1.94,"owner":"Rambod.ghasemi"},{"id":"p15","row":15,"name":"زنجان","potential":2,"biopsyPct":1.59,"owner":"Rambod.ghasemi"},{"id":"p16","row":16,"name":"مرکزی","potential":2,"biopsyPct":2.15,"owner":"Rambod.ghasemi"},{"id":"p17","row":17,"name":"گیلان","potential":2,"biopsyPct":3.81,"owner":"Rambod.ghasemi"},{"id":"p18","row":18,"name":"خراسان شمالی","potential":3,"biopsyPct":1.29,"owner":"Rambod.ghasemi"},{"id":"p19","row":19,"name":"ایلام","potential":3,"biopsyPct":0.87,"owner":"Rambod.ghasemi"},{"id":"p20","row":20,"name":"خوزستان","potential":1,"biopsyPct":7.07,"owner":"Reyhane.kashisaz"},{"id":"p21","row":21,"name":"کرمانشاه","potential":1,"biopsyPct":2.93,"owner":"Reyhane.kashisaz"},{"id":"p22","row":22,"name":"آذربایجان غربی","potential":1,"biopsyPct":4.9,"owner":"Reyhane.kashisaz"},{"id":"p23","row":23,"name":"کرمان","potential":1,"biopsyPct":4.75,"owner":"Reyhane.kashisaz"},{"id":"p24","row":24,"name":"البرز","potential":2,"biopsyPct":4.07,"owner":"Reyhane.kashisaz"},{"id":"p25","row":25,"name":"همدان","potential":2,"biopsyPct":2.6,"owner":"Reyhane.kashisaz"},{"id":"p26","row":26,"name":"قزوین","potential":2,"biopsyPct":1.91,"owner":"Reyhane.kashisaz"},{"id":"p27","row":27,"name":"کردستان","potential":2,"biopsyPct":2.4,"owner":"Reyhane.kashisaz"},{"id":"p28","row":28,"name":"هرمزگان","potential":2,"biopsyPct":2.66,"owner":"Reyhane.kashisaz"},{"id":"p29","row":29,"name":"کهگیلویه و بویراحمد","potential":3,"biopsyPct":1.07,"owner":"Reyhane.kashisaz"},{"id":"p30","row":30,"name":"سمنان","potential":3,"biopsyPct":1.05,"owner":"Reyhane.kashisaz"}];
var CENTERS = []; // loaded from IndexedDB
var PC_RAW = {}; // loaded from IndexedDB

/* ══ BLOCK 2: Main Application Code ══ */
// ════════════════════════ CONSTANTS ═══════════════════════
var STATUS_LIST=['بدون تماس','تماس اولیه','ملاقات انجام شد','پیشنهاد ارسال شد','قرارداد بسته شد','عدم نیاز فاکتور کنسل شد','غیرفعال'];
var STATUS_CLS=['st-0','st-1','st-2','st-3','st-4','st-5','st-5'];
var H_CLS=['h-st-0','h-st-1','h-st-2','h-st-3','h-st-4','h-st-5','h-st-5'];
var LEAD_LIST=['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'];
var TYPE_LIST=['بیمارستان','کلینیک','درمانگاه','مطب','آزمایشگاه','داروخانه','دیگر'];
var _PIPELINE_META={'بدون تماس':{ic:'⬜',c:'#94a3b8'},'تماس اولیه':{ic:'📞',c:'#0ea5e9'},'ملاقات انجام شد':{ic:'📋',c:'#8b5cf6'},'پیشنهاد ارسال شد':{ic:'📄',c:'#06b6d4'},'قرارداد بسته شد':{ic:'✅',c:'#22c55e'},'عدم نیاز فاکتور کنسل شد':{ic:'❌',c:'#f43f5e'},'غیرفعال':{ic:'🚫',c:'#ef4444'}};
var LEAD_CLS={'مشتری':'lead-cust','لید':'lead-lid','فرصت':'lead-opp','سرنخ':'lead-srnkh','ندارد':'lead-none','بدون مصرف':'lead-nouse'};
var J_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
var J_DAYS=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];
var USERS={}; // populated dynamically from settings
var CK_ITEMS_DEFAULT=[
  {id:1,t:'بررسی لیست پیگیری امروز'},{id:2,t:'تماس با حداقل ۵ مرکز'},{id:3,t:'ثبت نتیجه هر تماس'},
  {id:4,t:'ارسال پیشنهاد به مراکز علاقه‌مند'},{id:5,t:'پیگیری پیشنهادات قبلی'},
  {id:6,t:'تعیین تاریخ پیگیری بعدی'},{id:7,t:'بررسی موجودی نمونه‌ها'},
  {id:8,t:'ثبت گزارش بازدید میدانی'},{id:9,t:'بررسی رقبا'},{id:10,t:'تهیه لیست بازدید فردا'},
  {id:11,t:'هماهنگی با تیم پشتیبانی'},{id:12,t:'ارسال گزارش روزانه به مدیر'},
  {id:13,t:'بررسی آمار فروش هفته'},{id:14,t:'پیگیری قراردادهای در جریان'},
  {id:15,t:'تماس با مشتریان قدیمی برای تجدید'},{id:16,t:'بررسی تقویم قرارها هفته آینده'},
  {id:17,t:'ثبت مراکز جدید شناسایی‌شده'},{id:18,t:'مرور یادداشت‌های ملاقات‌های اخیر'},
  {id:19,t:'ارسال مواد آموزشی برای مراکز جدید'},{id:20,t:'هماهنگی زمان ارائه محصول'},
  {id:21,t:'ثبت شکایات مشتریان'},{id:22,t:'بررسی KPI هفتگی'},
  {id:23,t:'آپدیت اطلاعات تماس'},{id:24,t:'⚠️ تعیین ۵ مرکز اولویت هفته',mgr:true},
  {id:25,t:'⚠️ مرور گزارش کارشناسان',mgr:true},{id:26,t:'⚠️ برنامه‌ریزی ویزیت هفته',mgr:true},
  {id:27,t:'⚠️ بررسی هدف ماهانه',mgr:true}
];
function getCKItems(){return(DB.settings&&DB.settings.ckItems&&DB.settings.ckItems.length)?DB.settings.ckItems:CK_ITEMS_DEFAULT;}

// ════════════════════════ STATE ══════════════════════════
var currentUser='Sarah.hosseini';
var currentTab='provinces';
var _viewMode='list';
var _calView='month';
var _calDate=null;
var _ckDate=null;
var _currentProvId=null; // null=province list, string=open province
var _jdpCb=null;var _jdpInp=null;var _jdpDate=null;
var _tagPickerKey=null;
var _bannerFilterUser='';
var _bannerFilterTag=0;
var _globalOwnerFilter='';
var _quickFilter='';
var _sortField='';
var _sortDir=1;
var _selectedCenters=new Set();
var _provView='grid'; // 'grid' | 'list' | 'kanban'
var _compactTable=false;
var _nextTagId=1;var _nextWkId=1;var _nextEvId=1;

// ════════════════════════ JALALI ════════════════════════
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+(33*Math.floor(days/12053));days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return[jy,jm,jd];}
function toJalali(d){var r=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return r[0]+'-'+String(r[1]).padStart(2,'0')+'-'+String(r[2]).padStart(2,'0');}
function j2g(jy,jm,jd){var jy2=jy+1595;var days=-355668+(365*jy2)+(Math.floor(jy2/33)*8)+Math.floor(((jy2%33)+3)/4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);var gy=400*Math.floor(days/146097);days%=146097;if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}var gd=days+1;var sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];var gm=0;for(;gm<13&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return[gy,gm,gd];}
function todayJ(){var d=new Date();return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function todayStr(){var t=todayJ();return t[0]+'/'+p2(t[1])+'/'+p2(t[2]);}
function jDays(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return(((((jy-474)%2820)+474+38)*682)%2816<682)?30:29;}
function jDow(jy,jm,jd){var g=j2g(jy,jm,jd);return(new Date(g[0],g[1]-1,g[2]).getDay()+1)%7;}
function p2(n){return n<10?'0'+n:String(n);}
function jMs(jy,jm,jd){var g=j2g(jy,jm,jd);return new Date(g[0],g[1]-1,g[2]).getTime();}
function msToJ(ms){if(!ms)return'';var d=new Date(ms);var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return j[0]+'/'+p2(j[1])+'/'+p2(j[2]);}
function jAdd(jy,jm,jd,n){var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]+n);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function wkStart(jy,jm,jd){var dow=jDow(jy,jm,jd);var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]-dow);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}

// ════════════════════════ HELPERS ══════════════════════
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _safeColor(c){return(typeof c==='string'&&(/^#[0-9a-fA-F]{3,8}$/.test(c)||/^rgb/.test(c)||/^hsl/.test(c)))?c:'#888888';}
function fNorm(s){return(s||'').toString().toLowerCase().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[أإآا]/g,'ا').replace(/[\u200c\u200d]/g,' ').replace(/[۰-۹]/g,function(d){return'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)];}).replace(/\s+/g,' ').trim();}
function fMatch(q,t){return!q||fNorm(t).indexOf(fNorm(q))>=0;}
function nowTs(){return Date.now();}
function stCls(st){var i=STATUS_LIST.indexOf(st);return STATUS_CLS[i]||'st-0';}
function stHCls(st){var i=STATUS_LIST.indexOf(st);return H_CLS[i]||'h-st-0';}
function lCls(lead){var l=(lead||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim();return LEAD_CLS[l]||'lead-none';}

// ════════════════════════ STORAGE ══════════════════════
var _undoStack=[];
var _redoStack=[];
var MAX_UNDO=50;
var _undoSuppressed=false;
var _actPage=0;
var DB={edits:{},notes:{},tags:[],rTags:{},weekTags:[],weekEntries:{},_weDeletedKeys:[],events:[],checklist:{},extra:[],settings:null,kpiTargets:{},callLog:[],visitLog:[],salesLog:[],missionLog:[],provHistory:[],mtrFollower:{},mtrFollowerMap:{},changeLog:[],mtrTrend:[],notifications:[],tasks:[],kpiHistory:[]};
var _DEFAULT_MEMBERS=[]; // loaded from server via buildUSERS()

// ════════════════════════ SSE (Server-Sent Events) ════════════════════════
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
        if (typeof _refreshNotifs === 'function') _refreshNotifs();
        if (data.msg && typeof _firePushNotif === 'function') _firePushNotif('\uD83D\uDD14 اعلان جدید', data.msg, 'notif-' + Date.now());
      }
    } catch(err) {}
  };
  _sse.onerror = function() {
    _sse.close(); _sse = null;
    clearTimeout(_sseReconnectTimer);
    _sseReconnectTimer = setTimeout(initSSE, 8000);
  };
}
window.initSSE = initSSE;

function _sseReloadDB(byUser) {
  if (!byUser) return;
  var _isTgBot = byUser && byUser.indexOf(':bot') !== -1;
  if (!_isTgBot && byUser === currentUser) return;
  _ssePendingBy = _isTgBot ? byUser.replace(':bot','') : byUser;
  clearTimeout(_sseReloadTimer);
  _sseReloadTimer = setTimeout(function() {
    var triggeredBy = _ssePendingBy;
    _ssePendingBy = null;
    fetch('/api/data/db').then(function(r){ return r.ok ? r.json() : null; }).then(function(d) {
      if (!d || typeof d !== 'object') return;
      if (d._serverTs) _dbServerTs = d._serverTs;
      var merged = Object.assign({}, DB, d);
      merged.weekEntries = Object.assign({}, DB.weekEntries, d.weekEntries || {});
      var mergedEdits4 = Object.assign({}, d.edits || {});
      var localEdits4 = DB.edits || {};
      Object.keys(localEdits4).forEach(function(k) {
        var le = localEdits4[k] || {}; var se = mergedEdits4[k] || {};
        if ((le._ts || 0) >= (se._ts || 0)) mergedEdits4[k] = le;
        else mergedEdits4[k] = Object.assign({}, le, se);
      });
      merged.edits = mergedEdits4;
      if (d.notifications && DB.notifications && DB.notifications.length) {
        var _localRead={};
        DB.notifications.forEach(function(n){if(n.read)_localRead[n.id]=true;});
        merged.notifications=(d.notifications||[]).map(function(n){
          return _localRead[n.id]?Object.assign({},n,{read:true}):n;
        });
      }
      delete merged._serverTs; delete merged._clientTs;
      Object.keys(merged).forEach(function(k) { DB[k] = merged[k]; });
      if (!_saveDebounceTimer) {
        if (currentTab === 'weekplan' && typeof renderWeekPlan === 'function') renderWeekPlan();
        else if (currentTab === 'provinces' && typeof renderDashboard === 'function') { renderDashboard(); if(typeof renderTable==='function')renderTable(); }
        else if (currentTab === 'activity' && typeof renderActivity === 'function') renderActivity();
        else if (currentTab === 'kpi' && typeof renderKPIPanel === 'function') renderKPIPanel();
        else if (currentTab === 'manager' && typeof renderManagerPanel === 'function') renderManagerPanel();
      }
      var _tgSuffix = triggeredBy && triggeredBy.endsWith(':bot') ? ' (تلگرام)' : '';
      var _tgBy = triggeredBy ? triggeredBy.replace(':bot','') : null;
      var name = _tgBy ? (USERS[_tgBy] || _tgBy) : 'کاربر دیگری';
      if (typeof showToast === 'function') showToast('\uD83D\uDD04 ' + name + _tgSuffix + ' تغییراتی اعمال کرد', 2500);
    }).catch(function() {});
  }, 1500);
}

// نمایش راهنما اگر دیتابیس خالی است
function checkEmptyDB(){
  try{
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
  }catch(e){}
}
window.checkEmptyDB = checkEmptyDB;

// ── پاک‌سازی ورودی‌های منسوخ (orphaned) ─────────────────────────────
function _getAllValidRecKeys(){
  var valid=new Set();
  CENTERS.forEach(function(c){valid.add('center_'+c.id);});
  if(typeof _buildPCCache==='function')_buildPCCache();
  if(_PC_CACHE)Object.keys(_PC_CACHE).forEach(function(provId){
    (_PC_CACHE[provId]||[]).forEach(function(c){valid.add('pc_'+c.id);});
  });
  (DB.extra||[]).forEach(function(c){
    var rtype=c.province_id==='tehran'?'center':'pc';
    valid.add(rtype+'_'+c.id);
  });
  return valid;
}
function cleanupOrphanedEntries(showReport){
  var valid=_getAllValidRecKeys();
  if(!valid.size)return;
  var removedWP=0,removedFU=0;
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    var rk=we.recKey||(we.rtype?we.rtype+'_'+we.rid:'');
    if(rk&&!valid.has(rk)){_weRemove(k);removedWP++;}
  });
  Object.keys(DB.edits||{}).forEach(function(k){
    if(!valid.has(k)&&DB.edits[k].followupDate){delete DB.edits[k].followupDate;removedFU++;}
  });
  if(removedWP||removedFU){
    saveDB();
    if(showReport)showToast('🧹 پاک‌سازی: '+removedWP+' ورودی هفته و '+removedFU+' پیگیری منسوخ حذف شد',4000);
  }else if(showReport){showToast('✅ هیچ ورودی منسوخی یافت نشد');}
  return{removedWP:removedWP,removedFU:removedFU};
}
window.cleanupOrphanedEntries = cleanupOrphanedEntries;
// ════════════════════════ END SSE / DB helpers ═══════════════════════

// ── Login/Auth helpers ────────────────────────────────────────
function showLoginOverlay(){
  var o=document.getElementById('loginOverlay');
  if(o){o.style.display='flex';var u=document.getElementById('loginUser');if(u)u.focus();}
}
function hideLoginOverlay(){
  var o=document.getElementById('loginOverlay');
  if(o)o.style.display='none';
}
async function doLogin(){
  var u=(document.getElementById('loginUser')||{}).value||'';
  var p=(document.getElementById('loginPass')||{}).value||'';
  var errEl=document.getElementById('loginErr');
  if(errEl)errEl.style.display='none';
  try{
    var r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    var d=await r.json();
    if(!r.ok){if(errEl){errEl.textContent=d.error||'خطا';errEl.style.display='block';}return;}
    currentUser=d.user.username;
    hideLoginOverlay();
    init();
  }catch(e){
    if(errEl){errEl.textContent='خطا در اتصال به سرور';errEl.style.display='block';}
  }
}
async function doLogout(){
  try{await saveDBSync();}catch(e){}
  await fetch('/api/auth/logout',{method:'POST'}).catch(function(){});
  location.reload();
}

// ── Server sync state ─────────────────────────────────────────
var _serverSynced=false;
var _saveDebounceTimer=null;
var _dbServerTs=null; // tracks server updated_at for conflict detection
var _saveSeq=0; // sequence counter to ignore out-of-order fetch responses
var _lastSyncedDB=null;
var _editsKeysCache=null; // invalidated by setE/loadDB for memoized Object.keys(DB.edits)
function _getEditsKeys(){if(!_editsKeysCache)_editsKeysCache=Object.keys(DB.edits||{});return _editsKeysCache;}
function _invalidateEditsCache(){_editsKeysCache=null;}
var _wpRenderTimer=null;
function _debouncedRenderWeekPlan(){clearTimeout(_wpRenderTimer);_wpRenderTimer=setTimeout(renderWeekPlan,80);}
var _sseClientId=Math.random().toString(36).slice(2)+Date.now().toString(36); // unique per tab, used to exclude own SSE events

async function loadDB(){
  var _spinner=document.getElementById('loadingSpinner');
  if(_spinner)_spinner.style.display='flex';
  try{
    var r=await fetch('/api/data/db');
    if(r.status===401){if(_spinner)_spinner.style.display='none';showLoginOverlay();return;}
    var d=await r.json();
    if(d&&typeof d==='object'){
      _dbServerTs=d._serverTs||null;
      Object.keys(DB).forEach(function(k){if(k!=='_serverTs'&&d[k]!==undefined)DB[k]=d[k];});
    }
    // migrate legacy single-contact fields to contacts[] array
    var _migrated=false;
    Object.keys(DB.edits||{}).forEach(function(k){
      var e=DB.edits[k];
      if(!e.contacts&&(e.contactName||e.contactTitle||(e.phones&&e.phones.length))){
        e.contacts=[{name:e.contactName||'',title:e.contactTitle||'',phones:(e.phones||[]).slice()}];
        delete e.contactName;delete e.contactTitle;delete e.phones;
        _migrated=true;
      }
    });
    if(_migrated){saveDB();console.log('[migration] legacy contacts migrated');}
    _serverSynced=true;_invalidateEditsCache();
    _lastSyncedDB = JSON.parse(JSON.stringify(DB));
  }catch(e){
    console.warn('Server fetch failed, using empty DB:',e.message);
  }finally{
    var _sp2=document.getElementById('loadingSpinner');if(_sp2)_sp2.style.display='none';
  }
}
function _weRemove(k){
  delete DB.weekEntries[k];
  if(!DB._weDeletedKeys)DB._weDeletedKeys=[];
  if(DB._weDeletedKeys.indexOf(k)<0)DB._weDeletedKeys.push(k);
}
function _saveDBNow(){
  var payload=JSON.parse(JSON.stringify(DB));
  if(_dbServerTs)payload._clientTs=_dbServerTs;
  var seq=++_saveSeq; // capture sequence; ignore late-resolving responses
  return fetch('/api/data/db',{method:'PUT',headers:{'Content-Type':'application/json','X-Cid':_sseClientId},body:JSON.stringify(payload)})
    .then(function(r){
      if(r.status===409){
        // 409 means another user saved since our last known timestamp — merge and retry
        return r.json().catch(function(){return {};}).then(function(errData){
          var conflictBy = errData && errData.by ? (USERS && USERS[errData.by] ? USERS[errData.by] : errData.by) : null;
          return fetch('/api/data/db').then(function(r2){return r2.ok?r2.json():null;}).then(function(d){
            if(!d||typeof d!=='object'){showToast('⚠ خطای همگام‌سازی — لطفاً صفحه را رفرش کنید',5000);return;}
            if(d._serverTs)_dbServerTs=d._serverTs;
            
            // Perform the diff-based merge so local changes are preserved
            var merged = mergeDatabaseDiff(DB, d, _lastSyncedDB);
            
            if (d.notifications && DB.notifications && DB.notifications.length) {
              var _lr409={};DB.notifications.forEach(function(n){if(n.read)_lr409[n.id]=true;});
              merged.notifications=(d.notifications||[]).map(function(n){return _lr409[n.id]?Object.assign({},n,{read:true}):n;});
            }
            delete merged._serverTs;delete merged._clientTs;
            Object.keys(merged).forEach(function(k){DB[k]=merged[k];});
            _lastSyncedDB = JSON.parse(JSON.stringify(DB));
            if(conflictBy)showToast('🔄 تغییرات '+conflictBy+' ادغام شد',3000);
            
            // Retry save with updated timestamp
            var p2=JSON.parse(JSON.stringify(DB));
            if(_dbServerTs)p2._clientTs=_dbServerTs;
            return fetch('/api/data/db',{method:'PUT',headers:{'Content-Type':'application/json','X-Cid':_sseClientId},body:JSON.stringify(p2)})
              .then(function(r3){
                if(!r3.ok)return;
                return r3.json().then(function(res){
                  if(res&&res._serverTs)_dbServerTs=res._serverTs;
                  if(seq===_saveSeq) {
                    DB._weDeletedKeys=[];
                    _lastSyncedDB = JSON.parse(JSON.stringify(DB));
                  }
                });
              })
              .catch(function(){});
          }).catch(function(){showToast('⚠ خطای شبکه — لطفاً صفحه را رفرش کنید',5000);});
        });
      }
      return r.json().then(function(result){
        if(result&&result._serverTs&&seq===_saveSeq)_dbServerTs=result._serverTs;
        if(seq===_saveSeq) {
          DB._weDeletedKeys=[];
          _lastSyncedDB = JSON.parse(JSON.stringify(DB));
        }
      });
    })
    .catch(function(e){console.warn('saveDB sync failed:',e.message);});
}
function saveDB(){
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(function(){_saveDBNow();},600);
}
function saveDBSync(){clearTimeout(_saveDebounceTimer);return _saveDBNow();}

function exportDBJson(){
  var data=JSON.stringify({version:2,exportedAt:new Date().toISOString(),db:DB},null,2);
  var blob=new Blob([data],{type:'application/json'});
  var a=document.createElement('a');var _burl=URL.createObjectURL(blob);a.href=_burl;
  a.download='atena_crm_backup_'+todayStr().replace(/\//g,'-')+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(_burl);},60000);
  showToast('✅ پشتیبان دانلود شد');
}
function importDBJson(input){
  var file=input.files&&input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var parsed=JSON.parse(e.target.result);
      var src=parsed.db||parsed;
      if(!src||typeof src!=='object'||!src.edits)throw new Error('فایل معتبر نیست');
      if(!confirm('⚠ این عملیات داده‌های فعلی را جایگزین می‌کند. ادامه می‌دهید؟'))return;
      Object.assign(DB,src);
      saveDBSync();
      showToast('✅ داده‌ها بازیابی شدند — صفحه رفرش می‌شود',2000);
      setTimeout(function(){location.reload();},2200);
    }catch(err){showToast('❌ خطا: '+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}

// Server backup download
async function downloadServerBackup(){
  try{
    var r=await fetch('/api/data/backup');
    var d=await r.json();
    var blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='atena_backup_'+(new Date().toISOString().slice(0,10))+'.json';
    a.click();
    showToast('✅ بکاپ سرور دانلود شد',2500);
  }catch(e){showToast('⚠ خطا در دریافت بکاپ: '+e.message);}
}

function getWeekLabelForDate(dateStr){
  if(!dateStr) return '';
  var parts = dateStr.split('/').map(Number);
  if(parts.length!==3) return '';
  try {
    if(typeof getYearWeeks !== 'function') return '';
    var targetMs = jMs(parts[0], parts[1], parts[2]);
    var weeks = getYearWeeks(parts[0]);
    var w = weeks.find(function(wk){
      var wsMs = jMs(wk.wsArr[0], wk.wsArr[1], wk.wsArr[2]);
      var weMs = jMs(wk.weArr[0], wk.weArr[1], wk.weArr[2]);
      return targetMs >= wsMs && targetMs <= weMs;
    });
    if(w) return 'هفته ' + w.num;
    
    var prevWeeks = getYearWeeks(parts[0] - 1);
    var wPrev = prevWeeks.find(function(wk){
      var wsMs = jMs(wk.wsArr[0], wk.wsArr[1], wk.wsArr[2]);
      var weMs = jMs(wk.weArr[0], wk.weArr[1], wk.weArr[2]);
      return targetMs >= wsMs && targetMs <= weMs;
    });
    if(wPrev) return 'هفته ' + wPrev.num;
    
    var nextWeeks = getYearWeeks(parts[0] + 1);
    var wNext = nextWeeks.find(function(wk){
      var wsMs = jMs(wk.wsArr[0], wk.wsArr[1], wk.wsArr[2]);
      var weMs = jMs(wk.weArr[0], wk.weArr[1], wk.weArr[2]);
      return targetMs >= wsMs && targetMs <= weMs;
    });
    if(wNext) return 'هفته ' + wNext.num;
  } catch(e) {
    console.error('getWeekLabelForDate error:', e);
  }
  return '';
}


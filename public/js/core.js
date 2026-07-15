/* ═══ public/js/core.js ═══ */
/* ══ BLOCK 1: Centers placeholder ══ */
var PROVINCES = [{"id":"p1","row":1,"name":"فارس","potential":1,"biopsyPct":7.28,"owner":"Sarah.hosseini"},{"id":"p2","row":2,"name":"اصفهان","potential":1,"biopsyPct":7.68,"owner":"Sarah.hosseini"},{"id":"p3","row":3,"name":"سیستان و بلوچستان","potential":1,"biopsyPct":4.16,"owner":"Hamidreza.soltanian"},{"id":"p4","row":4,"name":"مازندران","potential":1,"biopsyPct":4.93,"owner":"Hamidreza.soltanian"},{"id":"p5","row":5,"name":"آذربایجان شرقی","potential":1,"biopsyPct":5.86,"owner":"Hamidreza.soltanian"},{"id":"p6","row":6,"name":"لرستان","potential":2,"biopsyPct":2.64,"owner":"Hamidreza.soltanian"},{"id":"p7","row":7,"name":"بوشهر","potential":2,"biopsyPct":1.74,"owner":"Hamidreza.soltanian"},{"id":"p8","row":8,"name":"گلستان","potential":2,"biopsyPct":2.8,"owner":"Hamidreza.soltanian"},{"id":"p9","row":9,"name":"خراسان جنوبی","potential":3,"biopsyPct":1.15,"owner":"Hamidreza.soltanian"},{"id":"p10","row":10,"name":"چهارمحال و بختیاری","potential":3,"biopsyPct":1.42,"owner":"Hamidreza.soltanian"},{"id":"p11","row":11,"name":"اردبیل","potential":3,"biopsyPct":1.91,"owner":"Hamidreza.soltanian"},{"id":"p12","row":12,"name":"خراسان رضوی","potential":1,"biopsyPct":9.64,"owner":"Hamidreza.soltanian"},{"id":"p13","row":13,"name":"یزد","potential":2,"biopsyPct":1.71,"owner":"Hamidreza.soltanian"},{"id":"p14","row":14,"name":"قم","potential":2,"biopsyPct":1.94,"owner":"Hamidreza.soltanian"},{"id":"p15","row":15,"name":"زنجان","potential":2,"biopsyPct":1.59,"owner":"Hamidreza.soltanian"},{"id":"p16","row":16,"name":"مرکزی","potential":2,"biopsyPct":2.15,"owner":"Hamidreza.soltanian"},{"id":"p17","row":17,"name":"گیلان","potential":2,"biopsyPct":3.81,"owner":"Hamidreza.soltanian"},{"id":"p18","row":18,"name":"خراسان شمالی","potential":3,"biopsyPct":1.29,"owner":"Hamidreza.soltanian"},{"id":"p19","row":19,"name":"ایلام","potential":3,"biopsyPct":0.87,"owner":"Hamidreza.soltanian"},{"id":"p20","row":20,"name":"خوزستان","potential":1,"biopsyPct":7.07,"owner":"Sarah.hosseini"},{"id":"p21","row":21,"name":"کرمانشاه","potential":1,"biopsyPct":2.93,"owner":"Sarah.hosseini"},{"id":"p22","row":22,"name":"آذربایجان غربی","potential":1,"biopsyPct":4.9,"owner":"Sarah.hosseini"},{"id":"p23","row":23,"name":"کرمان","potential":1,"biopsyPct":4.75,"owner":"Sarah.hosseini"},{"id":"p24","row":24,"name":"البرز","potential":2,"biopsyPct":4.07,"owner":"Sarah.hosseini"},{"id":"p25","row":25,"name":"همدان","potential":2,"biopsyPct":2.6,"owner":"Sarah.hosseini"},{"id":"p26","row":26,"name":"قزوین","potential":2,"biopsyPct":1.91,"owner":"Sarah.hosseini"},{"id":"p27","row":27,"name":"کردستان","potential":2,"biopsyPct":2.4,"owner":"Sarah.hosseini"},{"id":"p28","row":28,"name":"هرمزگان","potential":2,"biopsyPct":2.66,"owner":"Sarah.hosseini"},{"id":"p29","row":29,"name":"کهگیلویه و بویراحمد","potential":3,"biopsyPct":1.07,"owner":"Sarah.hosseini"},{"id":"p30","row":30,"name":"سمنان","potential":3,"biopsyPct":1.05,"owner":"Sarah.hosseini"}];
var CENTERS = []; // loaded from IndexedDB
var PC_RAW = {}; // loaded from IndexedDB

/* ══ BLOCK 2: Main Application Code ══ */
// ════════════════════════ CONSTANTS ═══════════════════════
var STATUS_LIST=['بدون تماس','تماس اولیه','ملاقات انجام شد','پیشنهاد ارسال شد','قرارداد بسته شد','عدم نیاز فاکتور کنسل شد','غیرفعال'];
var STATUS_CLS=['st-0','st-1','st-2','st-3','st-4','st-5','st-5'];
var H_CLS=['h-st-0','h-st-1','h-st-2','h-st-3','h-st-4','h-st-5','h-st-5'];
var LEAD_LIST=['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'];
var TYPE_LIST=['بیمارستان','کلینیک','درمانگاه','مطب','آزمایشگاه','داروخانه','دیگر'];
var PURCHASE_METHOD_LIST=['مستقیم','توزیع‌کننده','بیمارستانی','مناقصه'];
var CENTER_PAYMENT_TERMS_LIST=['نقدی','۳۰ روزه','۶۰ روزه','۹۰ روزه','اعتباری'];
var SHIP_METHOD_LIST=['پیک','پست','باربری','تحویل حضوری','تیپاکس','اسنپ','باربری مطمئن'];
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

function initEvents(){
  if(!DB.events)DB.events=[];
  if(DB.events.length){
    var _ids=DB.events.map(function(e){return typeof e.id==='number'&&!isNaN(e.id)?e.id:0;});
    _nextEvId=Math.max.apply(null,_ids)+1;
  }
}

// ════════════════════════ JALALI ════════════════════════
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+(33*Math.floor(days/12053));days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return[jy,jm,jd];}
function toJalali(d){var r=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return r[0]+'-'+String(r[1]).padStart(2,'0')+'-'+String(r[2]).padStart(2,'0');}
function j2g(jy,jm,jd){var jy2=jy+1595;var days=-355668+(365*jy2)+(Math.floor(jy2/33)*8)+Math.floor(((jy2%33)+3)/4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);var gy=400*Math.floor(days/146097);days%=146097;if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}var gd=days+1;var sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];var gm=0;for(;gm<13&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return[gy,gm,gd];}
function todayJ(){var d=new Date();return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function todayStr(){var t=todayJ();return t[0]+'/'+p2(t[1])+'/'+p2(t[2]);}
function jDays(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return(((((jy-474)%2820)+474+38)*682)%2816<682)?30:29;}
function jDow(jy,jm,jd){var g=j2g(jy,jm,jd);return(new Date(g[0],g[1]-1,g[2],12).getDay()+1)%7;}
function p2(n){return n<10?'0'+n:String(n);}
function jMs(jy,jm,jd){var g=j2g(jy,jm,jd);return new Date(g[0],g[1]-1,g[2],12).getTime();}
function msToJ(ms){if(!ms)return'';var d=new Date(ms);var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return j[0]+'/'+p2(j[1])+'/'+p2(j[2]);}
function jAdd(jy,jm,jd,n){var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]+n,12);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function addDaysToJalali(dateStr,days){
  if(!dateStr)return '';
  var parts=dateStr.split('/').map(Number);
  if(parts.length!==3)return dateStr;
  var d=jAdd(parts[0],parts[1],parts[2],days);
  return d[0]+'/'+p2(d[1])+'/'+p2(d[2]);
}
function wkStart(jy,jm,jd){var dow=jDow(jy,jm,jd);var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]-dow,12);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}

// ════════════════════════ HELPERS ══════════════════════
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _safeColor(c){return(typeof c==='string'&&(/^#[0-9a-fA-F]{3,8}$/.test(c)||/^rgb/.test(c)||/^hsl/.test(c)))?c:'#888888';}
function fNorm(s){return(s||'').toString().toLowerCase().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[أإآا]/g,'ا').replace(/[\u200c\u200d]/g,' ').replace(/[۰-۹]/g,function(d){return'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)];}).replace(/\s+/g,' ').trim();}
function fMatch(q,t){return!q||fNorm(t).indexOf(fNorm(q))>=0;}
function filterActiveNotes(notes){
  if(!Array.isArray(notes))return[];
  return notes.filter(function(n){return n&&!n._deletedAt;});
}
window.filterActiveNotes=filterActiveNotes;
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
var DB={edits:{},notes:{},tags:[],rTags:{},weekTags:[],weekEntries:{},_weDeletedKeys:[],events:[],checklist:{},extra:[],settings:null,provOverrides:{},kpiTargets:{},callLog:[],visitLog:[],salesLog:[],missionLog:[],provHistory:[],mtrFollower:{},mtrFollowerMap:{},changeLog:[],mtrTrend:[],notifications:[],tasks:[],kpiHistory:[]};
var _DEFAULT_MEMBERS=[]; // loaded from server via buildUSERS()

// ════════════════════════ SSE (Server-Sent Events) ════════════════════════
var _sse = null;
var _sseReconnectTimer = null;
var _sseReloadTimer = null;
var _ssePendingBy = null;
var _sseRetryMs = 2000;

function initSSE() {
  if (_sse) {
    try { _sse.close(); } catch (e) {}
    _sse = null;
  }
  clearTimeout(_sseReconnectTimer);
  _sse = new EventSource('/api/events/stream?cid=' + _sseClientId);
  _sse.onopen = function () {
    _sseRetryMs = 2000;
  };
  _sse.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'connected') return;
      if (data.type === 'db-updated') {
        _sseReloadDB(data.by);
      } else if (data.type === 'app-reload') {
        if (typeof showToast === 'function') showToast('🔄 نسخه جدید بارگذاری شد. بازنشانی صفحه...', 3500);
        setTimeout(function(){ location.reload(); }, 2500);
      } else if (data.type === 'notif_new' && data.to === currentUser) {
        if (typeof _refreshNotifs === 'function') _refreshNotifs();
        if (data.msg && typeof _firePushNotif === 'function') _firePushNotif('\uD83D\uDD14 اعلان جدید', data.msg, 'notif-' + Date.now());
      } else if (data.type === 'week-entry-changed') {
        if (typeof _wpOnWeekEntryChanged === 'function') _wpOnWeekEntryChanged(data);
      } else if (data.type === 'letter-changed') {
        if (typeof window._lettersOnSSE === 'function') window._lettersOnSSE(data);
      } else if (data.type === 'trade-case-changed') {
        if (typeof window._tkOnTradeCaseSSE === 'function') window._tkOnTradeCaseSSE(data);
      }
    } catch(err) {}
  };
  _sse.onerror = function() {
    try { _sse.close(); } catch (e) {}
    _sse = null;
    clearTimeout(_sseReconnectTimer);
    // ERR_INCOMPLETE_CHUNKED_ENCODING is normal after server restart — reconnect quietly
    _sseReconnectTimer = setTimeout(function () {
      if (document.visibilityState === 'hidden') return;
      initSSE();
      _sseRetryMs = Math.min(_sseRetryMs * 2, 30000);
    }, _sseRetryMs);
  };
}
window.initSSE = initSSE;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && (!_sse || _sse.readyState === EventSource.CLOSED)) initSSE();
  });
}

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
      var merged = mergeDatabaseDiff(DB, d, _lastSyncedDB);
      if (d.notifications && DB.notifications && DB.notifications.length) {
        var _localRead={};
        DB.notifications.forEach(function(n){if(n.read)_localRead[n.id]=true;});
        merged.notifications=(d.notifications||[]).map(function(n){
          return _localRead[n.id]?Object.assign({},n,{read:true}):n;
        });
      }
      delete merged._serverTs; delete merged._clientTs;
      Object.keys(merged).forEach(function(k) { DB[k] = merged[k]; });
      _lastSyncedDB = JSON.parse(JSON.stringify(DB));
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
  if(!valid.size)return {removedWP:0,removedFU:0};
  var removedWP=0,removedFU=0;
  var sqlDeleteIds=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we) return;
    var rk=we.recKey||(we.rtype?we.rtype+'_'+we.rid:'');
    if(!rk||valid.has(rk)) return;
    if(we.sqlId) sqlDeleteIds.push(String(we.sqlId));
    _weRemove(k);
    removedWP++;
  });
  if(sqlDeleteIds.length){
    fetch('/api/week-entries/bulk-delete',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ids:sqlDeleteIds}),
    }).catch(function(){});
  }
  var patchEdits={};
  Object.keys(DB.edits||{}).forEach(function(k){
    if(valid.has(k)||!DB.edits[k]||!DB.edits[k].followupDate) return;
    delete DB.edits[k].followupDate;
    patchEdits[k]=DB.edits[k];
    removedFU++;
  });
  if(removedFU&&Object.keys(patchEdits).length){
    if(typeof savePatchDB==='function') savePatchDB({edits:patchEdits});
    else saveDB();
  }
  if(showReport){
    if(removedWP||removedFU){
      showToast('🧹 پاک‌سازی: '+removedWP+' ورودی هفته و '+removedFU+' پیگیری منسوخ حذف شد',4000);
    }else{
      showToast('✅ هیچ ورودی منسوخی یافت نشد');
    }
  }else if(removedWP||removedFU){
    console.info('[cleanup] removed',removedWP,'orphan week entries,',removedFU,'orphan followups');
  }
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
  var u=((document.getElementById('loginUser')||{}).value||'').trim();
  var p=(document.getElementById('loginPass')||{}).value||'';
  var errEl=document.getElementById('loginErr');
  if(errEl)errEl.style.display='none';
  try{
    var r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    var d=await r.json();
    if(!r.ok){if(errEl){errEl.textContent=d.error||'خطا';errEl.style.display='block';}return;}
    currentUser=d.user.username;
    window._authUserRole=d.user.role||'';
    hideLoginOverlay();
    if(typeof window.mountVuePanels==='function'){
      window.mountVuePanels({username:d.user.username,role:d.user.role||''});
    }
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
    var r=await fetch('/api/data/db',{credentials:'same-origin'});
    if(r.status===401){if(_spinner)_spinner.style.display='none';showLoginOverlay();return;}
    if(!r.ok){
      var errMsg='خطا در بارگذاری دیتابیس ('+r.status+')';
      try{var errJ=await r.json();if(errJ&&errJ.error)errMsg=errJ.error;}catch(_e){}
      console.error('[loadDB]', errMsg);
      if(typeof showToast==='function')showToast('⚠️ '+errMsg+' — دوباره وارد شوید',6000,'e');
      if(r.status===401)showLoginOverlay();
      return;
    }
    var d=await r.json();

    // Check if there is an unsynced local backup in localStorage
    var isSynced = localStorage.getItem('atena_db_synced');
    var backupStr = localStorage.getItem('atena_db_backup');
    if (isSynced === 'false' && backupStr) {
      try {
        var backup = JSON.parse(backupStr);
        var lastSyncedStr = localStorage.getItem('atena_db_last_synced');
        var lastSynced = lastSyncedStr ? JSON.parse(lastSyncedStr) : null;
        
        console.warn('[AtenaSync] Unsynced local changes found in localStorage. Merging with server database...');
        
        // Merge backup changes on top of server database d
        var merged = mergeDatabaseDiff(backup, d, lastSynced || d);
        d = merged; // replace d with merged state
        
        // Trigger a save to sync these merged changes back to the server
        setTimeout(function() {
          saveDB();
          showToast('🔄 تغییرات ذخیره نشده محلی بازیابی و همگام‌سازی شدند', 4000);
        }, 1000);
      } catch(err) {
        console.error('[AtenaSync] Error merging local backup:', err.message);
      }
    }

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
    await loadWeekEntriesFromSQL();
    _lastSyncedDB = JSON.parse(JSON.stringify(DB));
    _loadKpiFromSql();

    if (isSynced !== 'false') {
      _clearLocalBackup();
    }
    await loadTasksFromSQL();
  }catch(e){
    console.warn('Server fetch failed, using empty DB:',e.message);
    if(typeof showToast==='function')showToast('⚠️ اتصال به دیتابیس برقرار نشد — سرور یا PostgreSQL را بررسی کنید',6000,'e');
  }finally{
    var _sp2=document.getElementById('loadingSpinner');if(_sp2)_sp2.style.display='none';
  }
}

async function loadWeekEntriesFromSQL(){
  try{
    var r=await fetch('/api/week-entries?done=false');
    if(!r.ok)return;
    var rows=await r.json();
    if(!Array.isArray(rows))return;
    DB.weekEntries={};
    rows.forEach(function(row){
      var mapped=wpRowToMem(row);
      DB.weekEntries[mapped.key]=mapped.entry;
    });
  }catch(e){
    console.warn('loadWeekEntriesFromSQL failed:',e.message);
  }
}
window.loadWeekEntriesFromSQL=loadWeekEntriesFromSQL;

async function loadTasksFromSQL(){
  try{
    var r=await fetch('/api/tasks');
    if(!r.ok)return;
    var tasks=await r.json();
    if(Array.isArray(tasks)){
      DB.tasks=tasks;
    }
  }catch(e){
    console.warn('loadTasksFromSQL failed:',e.message);
  }
}
window.loadTasksFromSQL=loadTasksFromSQL;

async function _loadKpiFromSql(){
  try{
    var mon=typeof currentJMonth==='function'?currentJMonth():'';
    var tR=await fetch('/api/kpi-data/targets'+(mon?'?month='+encodeURIComponent(mon):''));
    if(tR.ok){
      var td=await tR.json();
      if(td.targets){
        if(!DB.kpiTargets)DB.kpiTargets={};
        Object.keys(td.targets).forEach(function(u){
          if(!DB.kpiTargets[u])DB.kpiTargets[u]={};
          Object.assign(DB.kpiTargets[u],td.targets[u]);
        });
      }
    }
    var hR=await fetch('/api/kpi-data/history');
    if(hR.ok){
      var hd=await hR.json();
      if(hd.history&&hd.history.length){
        if(!DB.kpiHistory)DB.kpiHistory=[];
        hd.history.forEach(function(h){
          var entry=Object.assign({userId:h.userId,month:h.month},h.snap||{});
          var idx=DB.kpiHistory.findIndex(function(x){return x.userId===h.userId&&x.month===h.month;});
          if(idx>=0)DB.kpiHistory[idx]=entry;else DB.kpiHistory.push(entry);
        });
      }
    }
    var pR=await fetch('/api/kpi-data/province-targets');
    if(pR.ok){
      var pd=await pR.json();
      if(pd.targets)DB.kpiProvinceTargets=pd.targets;
    }
  }catch(e){console.warn('[kpi] SQL load:',e.message);}
}
function _weRemove(k){
  delete DB.weekEntries[k];
  if(!DB._weDeletedKeys)DB._weDeletedKeys=[];
  if(DB._weDeletedKeys.indexOf(k)<0)DB._weDeletedKeys.push(k);
}

var _patchQueue={};
var _patchTimer=null;

function savePatchDB(fragment, opts){
  if(!fragment||typeof fragment!=='object')return;
  opts=opts||{};
  ['edits','notes','rTags','tags','weekEntries','events','checklist','settings','kpiTargets','provOverrides'].forEach(function(key){
    var alt=key==='rTags'?'tags':null;
    var src=fragment[key]||fragment[alt];
    if(!src && key!=='provOverrides') return;
    if(key==='provOverrides' && fragment.provOverrides===undefined) return;
    var qk=key==='tags'?'rTags':key;
    if(!_patchQueue[qk])_patchQueue[qk]={};
    if(key==='events' && Array.isArray(src)){
      _patchQueue.events=(_patchQueue.events||[]).concat(src);
    } else if(typeof src==='object'&&!Array.isArray(src)){
      Object.keys(src).forEach(function(ck){_patchQueue[qk][ck]=src[ck];});
    } else {
      _patchQueue[qk]=src;
    }
  });
  if(fragment._weDeletedKeys){
    _patchQueue._weDeletedKeys=(_patchQueue._weDeletedKeys||[]).concat(fragment._weDeletedKeys);
  }
  if(fragment._deletedEventIds){
    _patchQueue._deletedEventIds=(_patchQueue._deletedEventIds||[]).concat(fragment._deletedEventIds);
  }
  if(fragment.extra&&Array.isArray(fragment.extra)){
    _patchQueue.extra=(_patchQueue.extra||[]).concat(fragment.extra);
  }
  _backupLocalDB();
  clearTimeout(_patchTimer);
  if(opts.immediate){_flushPatchQueue();}
  else{_patchTimer=setTimeout(function(){_flushPatchQueue();},400);}
}

function _flushPatchQueue(){
  if(!Object.keys(_patchQueue).length)return;
  var payload=JSON.parse(JSON.stringify(_patchQueue));
  _patchQueue={};
  if(_dbServerTs)payload._clientTs=_dbServerTs;
  var seq=++_saveSeq;
  fetch('/api/data/patch',{
    method:'PATCH',
    headers:{'Content-Type':'application/json','X-Cid':_sseClientId},
    body:JSON.stringify(payload)
  }).then(function(r){
    return r.json().then(function(res){
      if(r.ok&&res&&res._serverTs&&seq===_saveSeq){
        _dbServerTs=res._serverTs;
        DB._weDeletedKeys=[];
        _lastSyncedDB=JSON.parse(JSON.stringify(DB));
        _clearLocalBackup();
      }
    });
  }).catch(function(e){console.warn('savePatchDB failed:',e.message);});
}

function patchCrmSetting(key, value) {
  if (!DB.settings) DB.settings = {};
  DB.settings[key] = value;
  return fetch('/api/crm-settings/' + encodeURIComponent(key), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: value }),
  }).catch(function (e) { console.warn('[patchCrmSetting]', key, e.message); });
}

function saveGlobalTagsApi(tags) {
  return fetch('/api/tags', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tags),
  }).catch(function (e) { console.warn('[saveGlobalTagsApi]', e.message); });
}

function saveCenterExtraApi(c) {
  if (!c || !c.id) return;
  return fetch('/api/center-extras', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  }).catch(function (e) { console.warn('[saveCenterExtraApi]', e.message); });
}

function deleteCenterExtraApi(id) {
  if (!id) return;
  return fetch('/api/center-extras/' + encodeURIComponent(id), { method: 'DELETE' })
    .catch(function (e) { console.warn('[deleteCenterExtraApi]', e.message); });
}

function _wpNewWeId() {
  return 'we_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function wpRowToMem(row) {
  var k = row.weekId + ':::' + row.rtype + ':::' + row.rid;
  return {
    key: k,
    entry: {
      id: row.id, sqlId: row.id, weekId: row.weekId, recKey: row.recKey,
      rtype: row.rtype, rid: row.rid, scheduledDate: row.scheduledDate,
      actionType: row.actionType, done: row.done, doneDate: row.doneDate,
      addedBy: row.addedBy, centerName: row.centerName, weekTagId: row.weekTagId,
      doneNote: row.doneNote, doneResult: row.doneResult,
    },
  };
}

function deleteWeekEntryApi(we, eKey) {
  if (we && we.sqlId) {
    return fetch('/api/week-entries/' + encodeURIComponent(we.sqlId), { method: 'DELETE' })
      .then(function (r) { return r.ok || r.status === 404; })
      .catch(function () { return false; });
  }
  var key = eKey;
  if (!key && we && we.weekId && we.rtype && we.rid !== undefined) {
    key = we.weekId + ':::' + we.rtype + ':::' + we.rid;
  }
  if (!key) return Promise.resolve(true);
  return fetch('/api/week-entries/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys: [key] }),
  }).then(function (r) { return r.ok; }).catch(function () { return false; });
}

function wpRemoveFromOtherWeeks(recKey, keepWeekId) {
  return fetch('/api/week-entries/purge-center', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recKey: recKey, keepWeekId: keepWeekId || null }),
  }).then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .finally(function () {
      Object.keys(DB.weekEntries || {}).forEach(function (k) {
        if (keepWeekId && k.startsWith(keepWeekId + ':::')) return;
        var we = DB.weekEntries[k];
        if (!we || typeof we !== 'object' || we.done) return;
        if (!wpMatchRecKey(we, recKey)) return;
        _weRemove(k);
      });
    });
}

function wpMatchRecKey(we, recKey) {
  if (!we || !recKey) return false;
  var rk = we.recKey || ((we.rtype || '') + '_' + (we.rid || ''));
  if (rk === recKey) return true;
  var parts = recKey.split('_');
  if (parts.length >= 2) {
    var rt = parts[0];
    var rid = parts.slice(1).join('_');
    if (we.rtype === rt && String(we.rid) === rid) return true;
  }
  return false;
}

function wpFindActiveEntryKey(recKey, exceptWeekId) {
  var found = null;
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    if (found) return;
    if (exceptWeekId && k.startsWith(exceptWeekId + ':::')) return;
    var we = DB.weekEntries[k];
    if (!we || we.done || !wpMatchRecKey(we, recKey)) return;
    found = k;
  });
  return found;
}

function wpSyncCenterWeekEntriesFromApi(recKey) {
  return fetch('/api/week-entries?rec_key=' + encodeURIComponent(recKey) + '&done=false')
    .then(function (r) {
      if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
      return r.json();
    })
    .then(function (rows) {
      if (!Array.isArray(rows)) rows = [];
      rows.forEach(function (row) {
        var mapped = wpRowToMem(row);
        DB.weekEntries[mapped.key] = mapped.entry;
      });
      if (rows.length) {
        Object.keys(DB.weekEntries || {}).forEach(function (k) {
          var we = DB.weekEntries[k];
          if (!we || we.done || !wpMatchRecKey(we, recKey)) return;
          var stillThere = rows.some(function (row) {
            return row.weekId + ':::' + row.rtype + ':::' + row.rid === k;
          });
          if (!stillThere) _weRemove(k);
        });
      }
      return rows;
    });
}

function wpBulkDeleteEntries(keys) {
  if (!keys || !keys.length) return Promise.resolve(0);
  var ids = [];
  var keyList = [];
  keys.forEach(function (k) {
    var we = DB.weekEntries[k];
    if (we && we.sqlId) ids.push(we.sqlId);
    else keyList.push(k);
  });
  return fetch('/api/week-entries/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ids, keys: keyList }),
  }).then(function (r) { return r.ok ? r.json() : { deleted: 0 }; })
    .then(function (d) {
      keys.forEach(function (k) { _weRemove(k); });
      return d.deleted || keys.length;
    })
    .catch(function () {
      keys.forEach(function (k) { _weRemove(k); });
      return keys.length;
    });
}

function wpTransferWeekEntry(eKey, targetWeekId, opts) {
  opts = opts || {};
  var we = DB.weekEntries[eKey];
  if (!we) return Promise.resolve(null);
  var parsed = typeof wpParseEntryKey === 'function' ? wpParseEntryKey(eKey) : null;
  var rtype = parsed ? parsed.rtype : we.rtype;
  var rid = parsed ? parsed.rid : we.rid;
  var recKey = we.recKey || (rtype + '_' + rid);
  var newKey = typeof wpEntryKey === 'function'
    ? wpEntryKey(targetWeekId, rtype, rid)
    : (targetWeekId + ':::' + rtype + ':::' + rid);
  if (newKey === eKey) return Promise.resolve(newKey);

  var dupInTarget = [];
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    if (!k.startsWith(targetWeekId + ':::') || k === eKey) return;
    var we2 = DB.weekEntries[k];
    if (!we2 || we2.done) return;
    var rk2 = we2.recKey || (we2.rtype + '_' + we2.rid);
    if (rk2 === recKey) dupInTarget.push(k);
  });

  return Promise.all(dupInTarget.map(function (dk) {
    var dwe = DB.weekEntries[dk];
    return deleteWeekEntryApi(dwe, dk).finally(function () { _weRemove(dk); });
  })).then(function () {
    if (we.sqlId) {
      var body = { ids: [we.sqlId], weekId: targetWeekId };
      if (opts.scheduledDate !== undefined) body.scheduledDate = opts.scheduledDate;
      else if (opts.clearSchedule) body.scheduledDate = null;
      if (opts.actionType) body.actionType = opts.actionType;
      return fetch('/api/week-entries/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.ok ? r.json() : r.json().then(function (j) { return Promise.reject(new Error(j.error || r.status)); });
      }).then(function (rows) {
        var row = rows && rows[0];
        if (!row) throw new Error('انتقال ناموفق');
        var mapped = wpRowToMem(row);
        Object.keys(DB.weekEntries || {}).forEach(function (k) {
          var w2 = DB.weekEntries[k];
          if (!w2 || w2.done || !wpMatchRecKey(w2, recKey)) return;
          if (k !== mapped.key) _weRemove(k);
        });
        if (eKey !== mapped.key) _weRemove(eKey);
        DB.weekEntries[mapped.key] = Object.assign({}, mapped.entry, {
          scheduledDate: opts.scheduledDate !== undefined ? opts.scheduledDate
            : (opts.clearSchedule ? null : we.scheduledDate),
          actionType: opts.actionType || we.actionType,
          done: opts.done !== undefined ? opts.done : we.done,
          doneDate: opts.doneDate !== undefined ? opts.doneDate : we.doneDate,
          doneResult: we.doneResult, doneNote: we.doneNote,
        });
        return mapped.key;
      });
    }
    return wpRemoveFromOtherWeeks(recKey, targetWeekId).then(function () {
      var copy = Object.assign({}, we, {
        scheduledDate: opts.scheduledDate !== undefined ? opts.scheduledDate
          : (opts.clearSchedule ? null : we.scheduledDate),
        actionType: opts.actionType || we.actionType,
        done: opts.done !== undefined ? opts.done : false,
        doneDate: opts.doneDate !== undefined ? opts.doneDate : null,
        weekId: targetWeekId,
      });
      DB.weekEntries[newKey] = copy;
      _weRemove(eKey);
      return saveWeekEntryApi(newKey, copy).then(function () { return newKey; });
    });
  });
}

function saveWeekEntryApi(eKey, we) {
  if (!eKey || !we) return Promise.resolve(null);
  var pts = eKey.split(':::');
  var weekId = pts[0];
  var rtype = pts.length >= 3 ? pts[1] : we.rtype;
  var rid = pts.length >= 3 ? pts.slice(2).join(':::') : we.rid;
  if (we.sqlId) {
    return fetch('/api/week-entries/' + encodeURIComponent(we.sqlId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekId: weekId,
        scheduledDate: we.scheduledDate || null,
        actionType: we.actionType || 'call',
        done: !!we.done,
        doneDate: we.doneDate || null,
        doneResult: we.doneResult || null,
        doneNote: we.doneNote || null,
        doneAmount: we.doneAmount != null ? we.doneAmount : undefined,
        centerName: we.centerName || undefined,
      }),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.id && DB.weekEntries[eKey]) {
          DB.weekEntries[eKey].sqlId = d.id;
          if (d.weekId && d.weekId !== weekId) {
            var nk = d.weekId + ':::' + d.rtype + ':::' + d.rid;
            if (nk !== eKey) {
              DB.weekEntries[nk] = Object.assign({}, DB.weekEntries[eKey], wpRowToMem(d).entry);
              _weRemove(eKey);
            }
          }
        }
        return d;
      })
      .catch(function () { return null; });
  }
  return fetch('/api/week-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: _wpNewWeId(),
      weekId: weekId,
      recKey: we.recKey || (we.rtype + '_' + we.rid),
      rtype: we.rtype || rtype,
      rid: we.rid || rid,
      scheduledDate: we.scheduledDate || null,
      actionType: we.actionType || 'call',
      done: !!we.done,
      doneDate: we.doneDate || null,
      addedBy: we.addedBy || currentUser,
      centerName: we.centerName || '',
      weekTagId: we.weekTagId || null,
    }),
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.id && DB.weekEntries[eKey]) DB.weekEntries[eKey].sqlId = d.id;
    return d;
  }).catch(function () { return null; });
}

window.deleteWeekEntryApi = deleteWeekEntryApi;
window.wpRemoveFromOtherWeeks = wpRemoveFromOtherWeeks;
window.wpSyncCenterWeekEntriesFromApi = wpSyncCenterWeekEntriesFromApi;
window.wpBulkDeleteEntries = wpBulkDeleteEntries;
window.wpTransferWeekEntry = wpTransferWeekEntry;
window.wpMatchRecKey = wpMatchRecKey;
window.wpFindActiveEntryKey = wpFindActiveEntryKey;

function _cleanCenterData(rtype, id) {
  var recKey = rtype + '_' + id;
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    var we = DB.weekEntries[k];
    if (we.recKey === recKey || (we.rtype === rtype && we.rid === id)) _weRemove(k);
  });
  if (DB.edits[recKey]) delete DB.edits[recKey].followupDate;
  saveDB();
}

function patchCenterField(centerKey, field, val, opts) {
  opts = opts || {};
  return fetch('/api/centers/' + encodeURIComponent(centerKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      field: field,
      val: val,
      centerName: opts.centerName || '',
      oldValue: opts.oldValue,
    }),
  }).then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { return Promise.reject(j); }); })
    .catch(function (e) {
      console.warn('[patchCenterField]', centerKey, field, e.message || e.error);
      throw e;
    });
}

function postCenterNote(centerKey, text, extra) {
  return fetch('/api/centers/' + encodeURIComponent(centerKey) + '/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ text: text, date: todayStr() }, extra || {})),
  }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('note save failed')); });
}

function deleteCenterNoteApi(centerKey, index) {
  return fetch('/api/centers/' + encodeURIComponent(centerKey) + '/notes/' + index, {
    method: 'DELETE',
  }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('note delete failed')); });
}

function _buildSavePayload(fullSync){
  if(fullSync){
    var full=JSON.parse(JSON.stringify(DB));
    full._fullSync=true;
    return full;
  }
  // Residual blob: collections not yet on dedicated entity APIs (MTR stays here by design)
  var slim={};
  if(DB.settings&&Object.keys(DB.settings).length)slim.settings=DB.settings;
  if(DB.kpiTargets)slim.kpiTargets=DB.kpiTargets;
  if(DB.provOverrides)slim.provOverrides=DB.provOverrides;
  if(DB.events&&DB.events.length)slim.events=DB.events;
  if(DB.checklist&&Object.keys(DB.checklist).length)slim.checklist=DB.checklist;
  if(DB.salesLog&&DB.salesLog.length)slim.salesLog=DB.salesLog;
  if(DB.callLog&&DB.callLog.length)slim.callLog=DB.callLog;
  if(DB.visitLog&&DB.visitLog.length)slim.visitLog=DB.visitLog;
  if(DB.missionLog&&DB.missionLog.length)slim.missionLog=DB.missionLog;
  if(DB.provHistory&&DB.provHistory.length)slim.provHistory=DB.provHistory;
  if(DB.kpiHistory&&Object.keys(DB.kpiHistory).length)slim.kpiHistory=DB.kpiHistory;
  if(DB.extra&&DB.extra.length)slim.extra=DB.extra;
  if(DB._mtr)slim._mtr=DB._mtr;
  return slim;
}

function _saveDBNow(fullSync){
  var payload=_buildSavePayload(!!fullSync);
  if(_dbServerTs)payload._clientTs=_dbServerTs;
  var _payloadKeys=Object.keys(payload).filter(function(k){return k!=='_clientTs'&&k!=='_fullSync';});
  if(!fullSync&&_payloadKeys.length===0)return Promise.resolve();
  var seq=++_saveSeq; // capture sequence; ignore late-resolving responses
  return fetch('/api/data/db',{method:'PUT',headers:{'Content-Type':'application/json','X-Cid':_sseClientId},body:JSON.stringify(payload)})
    .then(function(r){
      if(r.status===409){
        // 409 means another user saved since our last known timestamp — merge and retry
        console.warn('[AtenaCRM] تداخل داده شناسایی شد. در حال ادغام خودکار تغییرات...');
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
            var p2=_buildSavePayload(!!fullSync);
            if(_dbServerTs)p2._clientTs=_dbServerTs;
            return fetch('/api/data/db',{method:'PUT',headers:{'Content-Type':'application/json','X-Cid':_sseClientId},body:JSON.stringify(p2)})
              .then(function(r3){
                if(!r3.ok)return;
                return r3.json().then(function(res){
                  if(res&&res._serverTs)_dbServerTs=res._serverTs;
                  if(seq===_saveSeq) {
                    DB._weDeletedKeys=[];
                    _lastSyncedDB = JSON.parse(JSON.stringify(DB));
                    console.info('%c[AtenaCRM] تداخل با موفقیت حل شد و داده‌ها در تلاش مجدد ذخیره شدند.', 'color: #10b981; font-weight: bold;');
                    _clearLocalBackup();
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
          _clearLocalBackup();
        }
      });
    })
    .catch(function(e){console.warn('saveDB sync failed:',e.message);});
}
function _backupLocalDB() {
  try {
    localStorage.setItem('atena_db_backup', JSON.stringify(DB));
    if (_lastSyncedDB) {
      try {
        localStorage.setItem('atena_db_last_synced', JSON.stringify(_lastSyncedDB));
      } catch(e2) {
        // If last-synced snapshot is too large, skip it — server is source of truth
        localStorage.removeItem('atena_db_last_synced');
      }
    }
    localStorage.setItem('atena_db_synced', 'false');
  } catch(e) {
    // Full backup failed (quota). Try a lightweight backup with just settings/edits/notes/tags.
    try {
      var lite = {
        settings:   DB.settings   || {},
        edits:      DB.edits      || {},
        notes:      DB.notes      || {},
        tags:       DB.tags       || {},
        events:     DB.events     || [],
        extra:      DB.extra      || [],
        _lite:      true
      };
      localStorage.setItem('atena_db_backup', JSON.stringify(lite));
      localStorage.removeItem('atena_db_last_synced');
      localStorage.setItem('atena_db_synced', 'false');
    } catch(e3) {
      // Nothing we can do — ignore silently
    }
  }
}

function _clearLocalBackup() {
  try {
    localStorage.setItem('atena_db_synced', 'true');
    localStorage.removeItem('atena_db_backup');
    localStorage.removeItem('atena_db_last_synced');
  } catch(e) {}
}
function saveDB(){
  _backupLocalDB();
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(function(){_saveDBNow();},600);
}
function saveDBSync(fullSync){
  _backupLocalDB();
  clearTimeout(_saveDebounceTimer);
  return _saveDBNow(!!fullSync);
}

function mergeDatabaseDiff(local, server, lastSynced) {
  var merged = Object.assign({}, server);
  lastSynced = lastSynced || {};

  var copy = function(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  };

  // 1. edits
  merged.edits = copy(server.edits || {});
  var localEdits = local.edits || {};
  var lastEdits = lastSynced.edits || {};
  Object.keys(localEdits).forEach(function(k) {
    var le = localEdits[k];
    var se = merged.edits[k];
    var lse = lastEdits[k];
    if (!se) {
      if (JSON.stringify(le) !== JSON.stringify(lse)) {
        merged.edits[k] = le;
      }
    } else {
      var leTs = le._ts || 0;
      var seTs = se._ts || 0;
      var mergedCenter;
      if (leTs >= seTs) {
        mergedCenter = Object.assign({}, se, le);
      } else {
        mergedCenter = Object.assign({}, le, se);
        Object.keys(le).forEach(function(field) {
          if (lse && JSON.stringify(le[field]) !== JSON.stringify(lse[field])) {
            mergedCenter[field] = le[field];
          }
        });
      }
      merged.edits[k] = mergedCenter;
    }
  });

  // 2. notes
  merged.notes = copy(server.notes || {});
  var localNotes = local.notes || {};
  Object.keys(localNotes).forEach(function(k) {
    var ln = localNotes[k] || [];
    var sn = merged.notes[k] || [];
    var map = {};
    sn.forEach(function(n) { map[n.text + ':::' + (n.by || n.user)] = n; });
    ln.forEach(function(n) { map[n.text + ':::' + (n.by || n.user)] = n; });
    merged.notes[k] = filterActiveNotes(Object.values(map));
  });
  Object.keys(merged.notes).forEach(function(k){
    merged.notes[k]=filterActiveNotes(merged.notes[k]);
  });

  // 3. weekEntries
  merged.weekEntries = copy(server.weekEntries || {});
  var localWE = local.weekEntries || {};
  var lastWE = lastSynced.weekEntries || {};
  Object.keys(localWE).forEach(function(k) {
    var le = localWE[k];
    var se = merged.weekEntries[k];
    var lse = lastWE[k];
    if (!se) {
      if (!lse) {
        merged.weekEntries[k] = le;
      }
    } else {
      var mergedWE = Object.assign({}, se, le);
      merged.weekEntries[k] = mergedWE;
    }
  });
  if (local._weDeletedKeys && local._weDeletedKeys.length > 0) {
    local._weDeletedKeys.forEach(function(dk) {
      delete merged.weekEntries[dk];
    });
  }

  // 4. checklist
  merged.checklist = copy(server.checklist || {});
  var localChecklist = local.checklist || {};
  var baseChecklist = lastSynced.checklist || {};
  var checklistKeys = {};
  Object.keys(merged.checklist).forEach(function(k) { checklistKeys[k] = true; });
  Object.keys(localChecklist).forEach(function(k) { checklistKeys[k] = true; });
  Object.keys(baseChecklist).forEach(function(k) { checklistKeys[k] = true; });
  Object.keys(checklistKeys).forEach(function(k) {
    var inServer = merged.checklist[k] !== undefined;
    var inLocal = localChecklist[k] !== undefined;
    var inBase = baseChecklist[k] !== undefined;
    if (inLocal && inServer) {
      merged.checklist[k] = localChecklist[k];
    } else if (inLocal && !inServer) {
      if (!inBase) {
        merged.checklist[k] = localChecklist[k];
      }
    } else if (!inLocal && inServer) {
      if (inBase) {
        delete merged.checklist[k];
      }
    }
  });

  // 5. settings
  merged.settings = Object.assign({}, server.settings || {}, local.settings || {});

  // provOverrides
  merged.provOverrides = Object.assign({}, server.provOverrides || {}, local.provOverrides || {});

  // 6. events
  var evMap = {};
  (server.events || []).forEach(function(ev) { if(ev.id) evMap[ev.id] = ev; });
  (local.events || []).forEach(function(ev) { if(ev.id) evMap[ev.id] = ev; });
  merged.events = Object.values(evMap);

  // 7. Lists/Logs
  var listKeys = ['salesLog', 'callLog', 'visitLog', 'missionLog', 'extra', 'provHistory', 'changeLog', 'tasks', 'kpiHistory'];
  listKeys.forEach(function(lk) {
    var sList = server[lk] || [];
    var lList = local[lk] || [];
    var baseList = lastSynced[lk] || [];

    var sMap = {}; sList.forEach(function(x) { var id = x.id || x.key || JSON.stringify(x); sMap[id] = x; });
    var lMap = {}; lList.forEach(function(x) { var id = x.id || x.key || JSON.stringify(x); lMap[id] = x; });
    var bMap = {}; baseList.forEach(function(x) { var id = x.id || x.key || JSON.stringify(x); bMap[id] = x; });

    var unionIds = {};
    Object.keys(sMap).forEach(function(id) { unionIds[id] = true; });
    Object.keys(lMap).forEach(function(id) { unionIds[id] = true; });
    Object.keys(bMap).forEach(function(id) { unionIds[id] = true; });

    var finalItems = [];
    Object.keys(unionIds).forEach(function(id) {
      var inServer = !!sMap[id];
      var inLocal = !!lMap[id];
      var inBase = !!bMap[id];

      if (inLocal && inServer) {
        finalItems.push(lMap[id]);
      } else if (inLocal && !inServer) {
        if (!inBase) {
          finalItems.push(lMap[id]);
        }
      } else if (!inLocal && inServer) {
        if (!inBase) {
          finalItems.push(sMap[id]);
        }
      }
    });
    merged[lk] = finalItems;
  });

  return merged;
}

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
      saveDBSync(true);
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

// تولید همه هفته‌های یک سال شمسی
function getYearWeeks(jYear){
  var weeks=[];var today=todayJ();
  var todayMs=jMs(today[0],today[1],today[2]);
  // شروع از اولین شنبه قبل یا مساوی ۱ فروردین
  var d1=[jYear,1,1];var dow=jDow(d1[0],d1[1],d1[2]);
  var cur=jAdd(d1[0],d1[1],d1[2],-dow);
  for(var wn=1;wn<=56;wn++){
    var end=jAdd(cur[0],cur[1],cur[2],6);
    if(cur[0]>jYear)break;
    if(end[0]<jYear){cur=jAdd(cur[0],cur[1],cur[2],7);continue;}
    var wsStr=cur[0]+'/'+p2(cur[1])+'/'+p2(cur[2]);
    var weStr=end[0]+'/'+p2(end[1])+'/'+p2(end[2]);
    var wsMs=jMs(cur[0],cur[1],cur[2]);var weMs=jMs(end[0],end[1],end[2]);
    var isCurrent=wsMs<=todayMs&&weMs>=todayMs;var isPast=weMs<todayMs;
    // label: هفته N — شهریور ۱ تا ۷
    var mStart=J_MONTHS[cur[1]-1];var mEnd=J_MONTHS[end[1]-1];
    var label='هفته '+wn+' — '+(cur[1]!==end[1]?mStart+' '+cur[2]+' تا '+mEnd+' '+end[2]:mStart+' '+cur[2]+' تا '+end[2]);
    weeks.push({id:wsStr,num:wn,wsStr:wsStr,weStr:weStr,wsArr:cur.slice(),weArr:end.slice(),label:label,isCurrent:isCurrent,isPast:isPast,jYear:jYear});
    cur=jAdd(cur[0],cur[1],cur[2],7);
  }
  return weeks;
}

// ساخت کلید weekEntries
function wpEntryKey(weekId,rtype,rid){return weekId+':::'+rtype+':::'+rid;}
function wpGetWeeks(){return getYearWeeks(typeof _wpYear !== 'undefined' && _wpYear ? _wpYear : todayJ()[0]);}
function getWeekId(dateStr){
  if(!dateStr)return null;
  var p=dateStr.split('/').map(Number);
  if(p.length!==3||isNaN(p[0]))return null;
  var ms=jMs(p[0],p[1],p[2]);
  var yrs=[p[0]-1,p[0],p[0]+1];
  for(var yi=0;yi<yrs.length;yi++){
    var wks=getYearWeeks(yrs[yi]);
    var w=wks.find(function(wk){
      return jMs(wk.wsArr[0],wk.wsArr[1],wk.wsArr[2])<=ms&&jMs(wk.weArr[0],wk.weArr[1],wk.weArr[2])>=ms;
    });
    if(w)return w.id;
  }
  return null;
}

// تطبیق خودکار تاریخ‌های پیگیری با برنامه هفته SQL
// opts.allowCreate / opts.allowMove — روی startup خاموش تا POST/transfer تکراری نشود
function wpReconcileFollowupDates(opts){
  opts=opts||{};
  var allowCreate=opts.allowCreate!==false;
  var allowMove=opts.allowMove!==false;
  if(!DB.edits)return 0;
  var added=0, updated=0, moved=0;
  var today=typeof todayStr==='function'?todayStr():'';
  Object.keys(DB.edits).forEach(function(k){
    var e=DB.edits[k];
    if(!e||!e.followupDate)return;
    var pts=k.split('_');
    if(pts.length<2)return;
    var rtype=pts[0];
    var rid=pts.slice(1).join('_');
    var val=e.followupDate;
    var _p=val.split('/').map(Number);
    if(_p.length!==3||isNaN(_p[0]))return;
    var foundWeekId=typeof getWeekId==='function'?getWeekId(val):null;
    if(!foundWeekId)return;
    var correctKey=wpEntryKey(foundWeekId,rtype,rid);
    var actionable=!today||val>=today;

    var activeKeys=[];
    Object.keys(DB.weekEntries||{}).forEach(function(wkKey){
      var we=DB.weekEntries[wkKey];
      if(!we||we.done)return;
      if(typeof wpMatchRecKey==='function'?wpMatchRecKey(we,k):(we.recKey||(we.rtype+'_'+we.rid))===k){
        activeKeys.push(wkKey);
      }
    });

    function _ensureCorrectEntry(){
      if(!allowCreate||!actionable)return;
      if(DB.weekEntries[correctKey])return;
      var cname=(typeof _getCenterName==='function'?_getCenterName(rtype,rid):'')||(rtype+'_'+rid);
      DB.weekEntries[correctKey]={
        scheduledDate:val,done:false,doneDate:null,rtype:rtype,rid:rid,recKey:k,
        centerName:cname,actionType:'call',addedBy:typeof currentUser!=='undefined'?currentUser:'system'
      };
      added++;
      if(typeof saveWeekEntryApi==='function'){
        saveWeekEntryApi(correctKey,DB.weekEntries[correctKey]);
      }
    }

    if(activeKeys.length===0){
      _ensureCorrectEntry();
      return;
    }

    var hasCorrect=activeKeys.indexOf(correctKey)>=0;
    if(hasCorrect){
      var we=DB.weekEntries[correctKey];
      if(we.scheduledDate!==val){
        we.scheduledDate=val;
        updated++;
        if(typeof saveWeekEntryApi==='function')saveWeekEntryApi(correctKey,we);
      }
      if(allowMove){
        activeKeys.forEach(function(wkKey){
          if(wkKey===correctKey)return;
          _weRemove(wkKey);
          moved++;
        });
        if(moved>0&&typeof wpRemoveFromOtherWeeks==='function'){
          wpRemoveFromOtherWeeks(k,foundWeekId);
        }
      }
      return;
    }

    if(!allowMove||!actionable)return;

    var srcKey=null;
    activeKeys.forEach(function(wkKey){
      if(!srcKey&&DB.weekEntries[wkKey]&&DB.weekEntries[wkKey].sqlId)srcKey=wkKey;
    });
    if(!srcKey)srcKey=activeKeys[0];

    if(DB.weekEntries[srcKey]&&DB.weekEntries[srcKey].sqlId&&typeof wpTransferWeekEntry==='function'){
      wpTransferWeekEntry(srcKey,foundWeekId,{scheduledDate:val,clearSchedule:false});
      moved++;
    }else{
      activeKeys.forEach(function(wkKey){_weRemove(wkKey);moved++;});
      _ensureCorrectEntry();
      if(typeof wpRemoveFromOtherWeeks==='function')wpRemoveFromOtherWeeks(k,foundWeekId);
    }
  });
  return added+updated+moved;
}



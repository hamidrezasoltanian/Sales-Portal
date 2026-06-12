/* ═══ public/js/core.js ═══ */
/* ══ BLOCK 1: Centers placeholder ══ */
var PROVINCES = [{"id":"p1","row":1,"name":"فارس","potential":1,"biopsyPct":7.28,"owner":"Sarah.hosseini"},{"id":"p2","row":2,"name":"اصفهان","potential":1,"biopsyPct":7.68,"owner":"Sarah.hosseini"},{"id":"p3","row":3,"name":"سیستان و بلوچستان","potential":1,"biopsyPct":4.16,"owner":"Mohammad.seyedsalehi"},{"id":"p4","row":4,"name":"مازندران","potential":1,"biopsyPct":4.93,"owner":"Mohammad.seyedsalehi"},{"id":"p5","row":5,"name":"آذربایجان شرقی","potential":1,"biopsyPct":5.86,"owner":"Mohammad.seyedsalehi"},{"id":"p6","row":6,"name":"لرستان","potential":2,"biopsyPct":2.64,"owner":"Mohammad.seyedsalehi"},{"id":"p7","row":7,"name":"بوشهر","potential":2,"biopsyPct":1.74,"owner":"Mohammad.seyedsalehi"},{"id":"p8","row":8,"name":"گلستان","potential":2,"biopsyPct":2.8,"owner":"Mohammad.seyedsalehi"},{"id":"p9","row":9,"name":"خراسان جنوبی","potential":3,"biopsyPct":1.15,"owner":"Rambod.ghasemi"},{"id":"p10","row":10,"name":"چهارمحال و بختیاری","potential":3,"biopsyPct":1.42,"owner":"Mohammad.seyedsalehi"},{"id":"p11","row":11,"name":"اردبیل","potential":3,"biopsyPct":1.91,"owner":"Mohammad.seyedsalehi"},{"id":"p12","row":12,"name":"خراسان رضوی","potential":1,"biopsyPct":9.64,"owner":"Rambod.ghasemi"},{"id":"p13","row":13,"name":"یزد","potential":2,"biopsyPct":1.71,"owner":"Rambod.ghasemi"},{"id":"p14","row":14,"name":"قم","potential":2,"biopsyPct":1.94,"owner":"Rambod.ghasemi"},{"id":"p15","row":15,"name":"زنجان","potential":2,"biopsyPct":1.59,"owner":"Rambod.ghasemi"},{"id":"p16","row":16,"name":"مرکزی","potential":2,"biopsyPct":2.15,"owner":"Rambod.ghasemi"},{"id":"p17","row":17,"name":"گیلان","potential":2,"biopsyPct":3.81,"owner":"Rambod.ghasemi"},{"id":"p18","row":18,"name":"خراسان شمالی","potential":3,"biopsyPct":1.29,"owner":"Rambod.ghasemi"},{"id":"p19","row":19,"name":"ایلام","potential":3,"biopsyPct":0.87,"owner":"Rambod.ghasemi"},{"id":"p20","row":20,"name":"خوزستان","potential":1,"biopsyPct":7.07,"owner":"Reyhane.kashisaz"},{"id":"p21","row":21,"name":"کرمانشاه","potential":1,"biopsyPct":2.93,"owner":"Reyhane.kashisaz"},{"id":"p22","row":22,"name":"آذربایجان غربی","potential":1,"biopsyPct":4.9,"owner":"Reyhane.kashisaz"},{"id":"p23","row":23,"name":"کرمان","potential":1,"biopsyPct":4.75,"owner":"Reyhane.kashisaz"},{"id":"p24","row":24,"name":"البرز","potential":2,"biopsyPct":4.07,"owner":"Reyhane.kashisaz"},{"id":"p25","row":25,"name":"همدان","potential":2,"biopsyPct":2.6,"owner":"Reyhane.kashisaz"},{"id":"p26","row":26,"name":"قزوین","potential":2,"biopsyPct":1.91,"owner":"Reyhane.kashisaz"},{"id":"p27","row":27,"name":"کردستان","potential":2,"biopsyPct":2.4,"owner":"Reyhane.kashisaz"},{"id":"p28","row":28,"name":"هرمزگان","potential":2,"biopsyPct":2.66,"owner":"Reyhane.kashisaz"},{"id":"p29","row":29,"name":"کهگیلویه و بویراحمد","potential":3,"biopsyPct":1.07,"owner":"Reyhane.kashisaz"},{"id":"p30","row":30,"name":"سمنان","potential":3,"biopsyPct":1.05,"owner":"Reyhane.kashisaz"}];
var CENTERS = []; // loaded from IndexedDB
var PC_RAW = {}; // loaded from IndexedDB

/* ══ BLOCK 2: Main Application Code ══ */
// ════════════════════════ CONSTANTS ═══════════════════════
var STATUS_LIST=['بدون تماس','تماس اولیه','ملاقات انجام شد','پیشنهاد ارسال شد','قرارداد بسته شد','غیرفعال'];
var STATUS_CLS=['st-0','st-1','st-2','st-3','st-4','st-5'];
var H_CLS=['h-st-0','h-st-1','h-st-2','h-st-3','h-st-4','h-st-5'];
var LEAD_LIST=['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'];
var TYPE_LIST=['بیمارستان','کلینیک','درمانگاه','مطب','آزمایشگاه','داروخانه','دیگر'];
var _PIPELINE_META={'بدون تماس':{ic:'⬜',c:'#94a3b8'},'تماس اولیه':{ic:'📞',c:'#0ea5e9'},'ملاقات انجام شد':{ic:'📋',c:'#8b5cf6'},'پیشنهاد ارسال شد':{ic:'📄',c:'#06b6d4'},'قرارداد بسته شد':{ic:'✅',c:'#22c55e'},'غیرفعال':{ic:'🚫',c:'#ef4444'}};
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
var _nextTagId=1;var _nextWkId=1;var _nextEvId=1;

// ════════════════════════ JALALI ════════════════════════
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+(33*Math.floor(days/12053));days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return[jy,jm,jd];}
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
var DB={edits:{},notes:{},tags:[],rTags:{},weekTags:[],weekEntries:{},events:[],checklist:{},extra:[],settings:null,kpiTargets:{},callLog:[],visitLog:[],salesLog:[],missionLog:[],provHistory:[],mtrFollower:{},mtrFollowerMap:{},changeLog:[],mtrTrend:[],notifications:[],tasks:[],kpiHistory:[]};
var _DEFAULT_MEMBERS=[]; // loaded from server via buildUSERS()

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
    _serverSynced=true;
  }catch(e){
    console.warn('Server fetch failed, using empty DB:',e.message);
  }finally{
    var _sp2=document.getElementById('loadingSpinner');if(_sp2)_sp2.style.display='none';
  }
}
function _saveDBNow(){
  var payload=JSON.parse(JSON.stringify(DB));
  if(_dbServerTs)payload._clientTs=_dbServerTs;
  var seq=++_saveSeq; // capture sequence; ignore late-resolving responses
  return fetch('/api/data/db',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){
      if(r.status===409){
        showToast('⚠ کاربر دیگری تغییراتی ذخیره کرده — صفحه بارگذاری می‌شود',5000);
        setTimeout(function(){location.reload();},5500);
        return;
      }
      return r.json().then(function(result){
        if(result&&result._serverTs&&seq===_saveSeq)_dbServerTs=result._serverTs;
      });
    })
    .catch(function(e){console.warn('saveDB sync failed:',e.message);});
}
function saveDB(){
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(function(){_saveDBNow();},300);
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


/* ═══ public/js/settings.js ═══ */
// ════════════════════════ SETTINGS ════════════════════════════════════

// ── جابجایی گروهی مراکز ──────────────────────────────────────
function openUserMgmt(){
  if(!_isManager()){showToast('⚠ فقط مدیران دسترسی دارند');return;}
  _UM_TAB='users';
  var foot='<button class="btn-secondary" onclick="closeModal(\'userMgmtModal\')">بستن</button>';
  openModal('userMgmtModal','👥 مدیریت کاربران','<div id="umWrap">'+_umBody()+'</div>',foot,{lg:true});
}
function openBulkReassign(){_UM_TAB='bulk';openUserMgmt();}
function umTab(t){_UM_TAB=t;var w=document.getElementById('umWrap');if(w)w.innerHTML=_umBody();}
function _umTabs(){
  var tabs=[['users','👤 کاربران'],['provinces','🗺 استان‌ها'],['bulk','🔀 جابجایی']];
  return '<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">'
    +tabs.map(function(t){
      var on=_UM_TAB===t[0];
      return '<button onclick="umTab(\''+t[0]+'\')" style="padding:8px 18px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:'+(on?700:400)+';color:'+(on?'var(--brand)':'var(--text-muted)')+';border-bottom:2.5px solid '+(on?'var(--brand)':'transparent')+';margin-bottom:-2px;transition:all .15s">'+t[1]+'</button>';
    }).join('')+'</div>';
}
function _umBody(){
  return _umTabs()+(_UM_TAB==='users'?_umUsers():_UM_TAB==='provinces'?_umProvinces():_umBulk());
}
function _umUsers(){
  var members=umGetMembers().filter(function(m){return m.id!=='guest';});
  var rows=members.map(function(m,i){
    var active=m.active!==false;
    var centers=umCountCenters(m.id);
    var color=m.color||_UM_COLORS[i%_UM_COLORS.length];
    var statusBg=active?'#dcfce7':'var(--bg-raised)';
    var statusTxt=active?'#15803d':'var(--text-muted)';
    var rowOp=active?1:.55;
    var roles=['مدیر','کارشناس فروش','سوپر ادمین','بازرگانی','مالی','IT','مهمان'];
    return '<tr style="opacity:'+rowOp+';border-bottom:1px solid var(--border)">'
      +'<td style="padding:9px 8px;width:28px"><div id="umdot_'+m.id+'" style="width:16px;height:16px;border-radius:50%;background:'+color+';cursor:pointer;border:2px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.15)" onclick="umPickColor(\''+m.id+'\',this)" title="تغییر رنگ"></div></td>'
      +'<td style="padding:9px 6px"><input id="um_name_'+m.id+'" value="'+esc(m.name)+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 9px;font-size:12.5px;font-family:inherit;color:var(--text-primary);width:130px"></td>'
      +(_isSuperAdmin()
        ? '<td style="padding:9px 6px"><input id="um_id_'+m.id+'" value="'+esc(m.id)+'" dir="ltr" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 8px;font-size:11px;font-family:monospace;color:var(--text-primary);width:130px" placeholder="نام کاربری"></td>'
        : '<td style="padding:9px 6px"><span dir="ltr" style="font-size:12px;font-family:monospace;color:var(--text-muted);padding:4px 8px;background:var(--bg-raised);border-radius:4px">'+esc(m.id)+'</span></td>')
      +'<td style="padding:9px 6px"><select id="um_role_'+m.id+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 7px;font-size:12px;font-family:inherit;color:var(--text-primary)">'
        +roles.map(function(r){return'<option'+(m.role===r?' selected':'')+'>'+r+'</option>';}).join('')
      +'</select></td>'
      +'<td style="padding:9px 6px"><input id="um_phone_'+m.id+'" value="'+esc(m.phone||'')+'" placeholder="09XXXXXXXXX" dir="ltr" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 8px;font-size:11px;font-family:monospace;color:var(--text-primary);width:115px"></td>'
      +'<td style="padding:9px 8px;text-align:center"><span style="font-size:11px;color:var(--text-muted)">🏥'+centers+'</span></td>'
      +'<td style="padding:9px 8px;text-align:center">'
        +'<span onclick="umToggleActive(\''+m.id+'\')" style="font-size:11px;background:'+statusBg+';color:'+statusTxt+';border-radius:20px;padding:3px 11px;cursor:pointer;font-weight:600;border:1px solid '+(active?'#86efac':'var(--border)')+'">'+( active?'● فعال':'○ غیرفعال')+'</span>'
      +'</td>'
      +'<td style="padding:9px 6px;white-space:nowrap">'
        +'<button onclick="umSaveUser(\''+m.id+'\')" title="ذخیره تغییرات" style="background:var(--brand-bg);color:var(--brand);border:1px solid var(--brand);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">💾 ذخیره</button> '
        +'<button onclick="umResetPassword(\''+m.id+'\')" title="تغییر رمز" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">🔑</button>'
        +(centers>0?' <button onclick="umReassignAll(\''+m.id+'\')" title="جابجایی مراکز" style="background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">🔀</button>':'')
      +'</td>'
    +'</tr>';
  }).join('');
  return '<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">'
    +'💡 غیرفعال‌کردن کاربر داده‌هایش را حذف نمی‌کند. برای جانشینی از 🔀 استفاده کنید.</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600"></th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">نام</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">کد ورود</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">نقش</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">موبایل</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600">مراکز</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600">وضعیت</th>'
    +'<th style="padding:8px;font-size:11px;color:var(--text-muted);font-weight:600">عملیات</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="umAddUser()" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit">+ افزودن کاربر</button>'
    +'</div>';
}
function _countCentersOf(userId){
  var n=0;
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    getProvCenters(p.id).forEach(function(ctr){
      var e=getE(rtype,ctr.id);
      if((e.owner||ctr.owner||'')==userId)n++;
    });
  });
  return n;
}

function previewBulkReassign(){
  var from=(document.getElementById('brFrom')||{}).value;
  var to=(document.getElementById('brTo')||{}).value;
  var prev=document.getElementById('brPreview');
  if(!prev)return;
  if(from===to){prev.innerHTML='<span style="color:#dc2626">⚠ مبدأ و مقصد یکسان هستند</span>';return;}
  var n=_countCentersOf(from);
  var fromName=USERS[from]||from, toName=USERS[to]||to;
  prev.innerHTML=n
    ?'<strong style="color:var(--text-primary)">'+n+' مرکز</strong> از <strong>'+esc(fromName)+'</strong> به <strong>'+esc(toName)+'</strong> منتقل می‌شود.'
    :'<span style="color:#d97706">هیچ مرکزی با مسئولیت مستقیم '+esc(fromName)+' یافت نشد.</span>';
}

function executeBulkReassign(){
  var from=(document.getElementById('brFrom')||{}).value;
  var to=(document.getElementById('brTo')||{}).value;
  if(!from||!to){showToast('⚠ هر دو کارشناس را انتخاب کنید');return;}
  if(from===to){showToast('⚠ مبدأ و مقصد یکسان است');return;}
  var count=0;
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    getProvCenters(p.id).forEach(function(ctr){
      var e=getE(rtype,ctr.id);
      if((e.owner||ctr.owner||'')==from){
        setE(rtype,ctr.id,'owner',to);
        count++;
      }
    });
  });
  if(count){
    showToast('✅ '+count+' مرکز به '+esc(USERS[to]||to)+' منتقل شد',3000);
    closeModal('bulkReassignModal');
    if(currentTab==='provinces'||currentTab==='centers')renderTable();
  } else {
    showToast('⚠ مرکزی با مسئولیت مستقیم '+esc(USERS[from]||from)+' یافت نشد');
  }
}


// ══════════════════════════════════════════════════════════════
// مدیریت کاربران — نسخه ۲
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// USER MANAGEMENT SYSTEM v2
// ══════════════════════════════════════════════════════════════

var _UM_TAB = 'users';
var _UM_COLORS = ['#0ea5e9','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];

// ── Helpers ───────────────────────────────────────────────────
function umGetMembers(){
  // Always prefer server data when loaded
  if(_DEFAULT_MEMBERS&&_DEFAULT_MEMBERS.length>0)return _DEFAULT_MEMBERS;
  return (DB.settings&&DB.settings.members)||[];
}
function umGetActive(){ return umGetMembers().filter(function(m){return m.active!==false&&m.id!=='guest';}); }
function umGetColor(userId){
  var m=umGetMembers().find(function(x){return x.id===userId;});
  if(m&&m.color)return m.color;
  var idx=umGetMembers().findIndex(function(x){return x.id===userId;});
  return _UM_COLORS[Math.max(0,idx)%_UM_COLORS.length];
}
function umCountCenters(userId){
  var n=0;
  if(typeof CENTERS!=='undefined')CENTERS.forEach(function(c){var e=getE('center',c.id);if((e.owner||c.owner||'')===userId)n++;});
  if(typeof _PC_CACHE!=='undefined'&&_PC_CACHE){Object.values(_PC_CACHE).forEach(function(arr){(arr||[]).forEach(function(c){var e=getE('pc',c.id);if((e.owner||c.owner||'')===userId)n++;});});}
  return n;
}

function umSaveUser(userId){
  var nameEl=document.getElementById('um_name_'+userId);
  var roleEl=document.getElementById('um_role_'+userId);
  var phoneEl=document.getElementById('um_phone_'+userId);
  var idEl=document.getElementById('um_id_'+userId);
  var dot=document.getElementById('umdot_'+userId);
  if(!nameEl)return;
  var newName=nameEl.value.trim();
  var newRole=roleEl?roleEl.value:'کارشناس فروش';
  var newPhone=phoneEl?phoneEl.value.trim():'';
  var newColor=dot?dot.style.background:'';
  var newId=idEl?idEl.value.trim():'';
  if(!newName){showToast('⚠ نام اجباری است');return;}
  if(newId&&newId!==userId&&!/^[a-zA-Z0-9._-]+$/.test(newId)){showToast('⚠ نام کاربری فقط حروف انگلیسی، اعداد و نقطه/خط تیره');return;}
  if(newId&&newId!==userId&&USERS[newId]){showToast('⚠ این نام کاربری قبلاً وجود دارد');return;}
  var payload={display_name:newName,role:newRole,phone:newPhone};
  if(newColor)payload.color=newColor;
  if(newId&&newId!==userId)payload.new_username=newId;
  fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(d){
      if(payload.new_username){
        var nu=payload.new_username;
        Object.keys(DB.edits||{}).forEach(function(k){if(DB.edits[k].owner===userId)DB.edits[k].owner=nu;});
        getAllProvinces().forEach(function(p){var e=getE(getProvType(p.id),p.id);if(e.owner===userId)setE(getProvType(p.id),p.id,'owner',nu);});
        saveDB();
      }
      showToast('✅ «'+newName+'» ذخیره شد');buildUSERS();setTimeout(function(){umTab('users');},300);
    })
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umAddUser(){
  var roles=['کارشناس فروش','مدیر','سوپر ادمین','بازرگانی','مالی','مهمان'];
  var body='<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام نمایشی *</label>'
    +'<input id="nu_name" class="ed-inp" style="width:100%;box-sizing:border-box" placeholder="نام کامل کارشناس"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام کاربری * (انگلیسی)</label>'
    +'<input id="nu_id" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box" placeholder="مثال: ali.ahmadi"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نقش</label>'
    +'<select id="nu_role" class="ed-inp" style="width:100%;box-sizing:border-box">'+roles.map(function(r){return'<option>'+r+'</option>';}).join('')+'</select></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">موبایل</label>'
    +'<input id="nu_phone" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box" placeholder="09xxxxxxxxx"></div>'
    +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px 12px;font-size:11px;color:#15803d">'
    +'🔑 رمز اولیه: نام‌کاربری + «123» (مثلاً ali.ahmadi123)</div>'
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'addUserModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="_umDoAddUser()">✅ ایجاد کاربر</button>';
  openModal('addUserModal','+ افزودن کاربر جدید',body,foot);
  setTimeout(function(){var el=document.getElementById('nu_name');if(el)el.focus();},80);
}

function _umDoAddUser(){
  var name=(document.getElementById('nu_name')||{}).value||'';
  var id=(document.getElementById('nu_id')||{}).value||'';
  var role=(document.getElementById('nu_role')||{}).value||'کارشناس فروش';
  var phone=(document.getElementById('nu_phone')||{}).value||'';
  name=name.trim();id=id.trim().replace(/\s/g,'');
  if(!name||!id){showToast('⚠ نام و نام‌کاربری اجباری‌اند');return;}
  if(!/^[a-zA-Z0-9._\-]+$/.test(id)){showToast('⚠ نام‌کاربری: فقط حروف لاتین، عدد، نقطه، خط‌تیره');return;}
  fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:id,display_name:name,role:role,phone:phone})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){
      closeModal('addUserModal');
      showToast('✅ کاربر «'+name+'» ایجاد شد · رمز: '+id+'123',4000);
      buildUSERS();
    })
    .catch(function(e){showToast('❌ '+e.message);});
}

function umToggleActive(userId){
  var m=umGetMembers().find(function(m){return m.id===userId;});
  if(!m)return;
  if(m.active!==false){
    umConfirmDeactivate(userId,m.name,umCountCenters(userId));
  } else {
    fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:true})})
      .then(function(r){if(!r.ok)throw new Error(r.status);})
      .then(function(){showToast('✅ «'+m.name+'» فعال شد');buildUSERS();setTimeout(function(){umTab('users');},300);})
      .catch(function(e){showToast('❌ خطا: '+e.message);});
  }
}

function umConfirmDeactivate(userId,userName,centerCount){
  var activeOthers=umGetActive().filter(function(m){return m.id!==userId;});
  var toOpts=activeOthers.map(function(m){return'<option value="'+m.id+'">'+esc(m.name)+'</option>';}).join('');
  var body='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:7px;padding:10px 14px;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px">🔒 غیرفعال‌کردن «'+esc(userName)+'»</div>'
    +(centerCount>0?'<div style="font-size:12px;color:#7f1d1d">این کاربر مسئول <strong>'+centerCount+' مرکز</strong> است.</div>':'<div style="font-size:12px;color:#7f1d1d">این کاربر مراکز مستقیمی ندارد.</div>')
    +'</div>'
    +(centerCount>0&&activeOthers.length>0?'<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">انتقال مراکز به (اختیاری):</label>'
    +'<select id="deact_to" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"><option value="">— بدون انتقال —</option>'+toOpts+'</select></div>':'')
    +'<div style="font-size:12px;color:var(--text-muted)">داده‌های کاربر حفظ می‌شود.</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'deactModal\')">لغو</button>'
    +'<button style="background:#dc2626;color:#fff;border:none;border-radius:5px;padding:7px 18px;cursor:pointer;font-size:12px;font-family:inherit" onclick="_umDoDeactivate(\''+userId+'\')">🔒 غیرفعال کن</button>';
  openModal('deactModal','غیرفعال‌کردن کاربر',body,foot);
}

function _umDoDeactivate(userId){
  var toEl=document.getElementById('deact_to');
  var toId=toEl?toEl.value:'';
  if(toId)_umReassignCenters(userId,toId);
  fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false})})
    .then(function(r){if(!r.ok)throw new Error(r.status);})
    .then(function(){
      closeModal('deactModal');
      var m=umGetMembers().find(function(m){return m.id===userId;});
      showToast('🔒 «'+(m?m.name:userId)+'» غیرفعال شد');
      buildUSERS();setTimeout(function(){umTab('users');},300);
    })
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umPickColor(userId,el){
  var input=document.createElement('input');
  input.type='color';
  input.value=el.style.background.startsWith('#')?el.style.background:'#0ea5e9';
  input.style.cssText='opacity:0;position:absolute;width:1px;height:1px';
  document.body.appendChild(input);
  input.addEventListener('change',function(){
    el.style.background=input.value;
    fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({color:input.value})})
      .then(function(){buildUSERS();}).catch(function(){});
    input.remove();
  });
  input.click();
}

function umResetPassword(userId){
  var m=umGetMembers().find(function(m){return m.id===userId;});
  if(!m)return;
  var body='<div style="margin-bottom:12px">'
    +'<label style="font-size:12px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:5px">رمز جدید برای «'+esc(m.name)+'»</label>'
    +'<input id="newpw_inp" type="password" placeholder="حداقل ۶ کاراکتر" style="width:100%;padding:9px 12px;border:1.5px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);">'
    +'</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">⚠ رمز جدید از این به بعد برای ورود استفاده می‌شود.</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'pwModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="umSavePassword(\''+userId+'\')">💾 ذخیره رمز</button>';
  openModal('pwModal','🔑 تغییر رمز',body,foot);
  setTimeout(function(){var el=document.getElementById('newpw_inp');if(el)el.focus();},80);
}

function umSavePassword(userId){
  var inp=document.getElementById('newpw_inp');
  if(!inp)return;
  var pw=inp.value.trim();
  if(pw.length<6){showToast('⚠ رمز باید حداقل ۶ کاراکتر باشد');return;}
  fetch('/api/users/'+encodeURIComponent(userId)+'/set-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){closeModal('pwModal');showToast('✅ رمز «'+userId+'» تغییر کرد');})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umReassignAll(fromId){
  _UM_TAB='bulk';
  var w=document.getElementById('umWrap');
  if(w){w.innerHTML=_umBody();}
  setTimeout(function(){
    var sel=document.getElementById('bulkFrom');
    if(sel)sel.value=fromId;
  },50);
}

// ── Tab 2: Provinces ──────────────────────────────────────────
function _umProvinces(){
  var provs=getAllProvinces();
  var activeMembers=umGetActive();
  var potColors=['','#16a34a','#0ea5e9','#f59e0b','#dc2626'];

  function getOwner(p){var e=getE(getProvType(p.id),p.id);return e.owner||p.owner||'';}

  // expert cards
  var expertCards=activeMembers.map(function(m){
    var myProvs=provs.filter(function(p){return getOwner(p)===m.id;})
      .sort(function(a,b){return a.potential-b.potential||b.biopsyPct-a.biopsyPct;});
    var totalBiopsy=myProvs.reduce(function(s,p){return s+(p.biopsyPct||0);},0);
    var cTotal=myProvs.reduce(function(s,p){return s+getProvCenters(p.id).length;},0);
    var potCounts={1:0,2:0,3:0,4:0};
    myProvs.forEach(function(p){potCounts[p.potential]++;});
    var color=umGetColor(m.id);
    var provRows=myProvs.map(function(p){
      var pc=potColors[p.potential]||'#94a3b8';
      return '<div style="display:flex;align-items:center;padding:5px 10px;border-bottom:1px solid var(--border)">'
        +'<span style="flex:1;font-size:11px;color:var(--text-primary)">'+esc(p.name)+'</span>'
        +'<span style="font-size:9px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:3px;padding:1px 5px;margin-left:6px">P'+p.potential+'</span>'
        +'<span style="font-size:11px;font-weight:700;color:var(--text-secondary);min-width:44px;text-align:left">'+p.biopsyPct+'٪</span>'
        +'</div>';
    }).join('');
    var potBadges=[1,2,3,4].filter(function(lvl){return potCounts[lvl]>0;})
      .map(function(lvl){var pc=potColors[lvl];return'<span style="font-size:10px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:4px;padding:2px 6px">P'+lvl+': '+potCounts[lvl]+'</span>';}).join('');
    return '<div style="flex:1;min-width:210px;background:var(--card);border:1.5px solid var(--border);border-radius:12px;overflow:hidden">'
      +'<div style="background:'+color+'18;border-bottom:2px solid '+color+';padding:10px 12px">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'
          +'<span style="width:11px;height:11px;border-radius:50%;background:'+color+';display:inline-block;flex-shrink:0"></span>'
          +'<span style="font-weight:700;font-size:13px;color:var(--text-primary)">'+esc(m.name)+'</span>'
        +'</div>'
        +'<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">'
          +'<span style="font-size:20px;font-weight:800;color:'+color+'">'+totalBiopsy.toFixed(1)+'<span style="font-size:11px;font-weight:500;color:var(--text-muted)">٪ سهم بازار</span></span>'
        +'</div>'
        +'<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">'
          +'<span style="font-size:11px;color:var(--text-muted)">'+myProvs.length+' استان · '+cTotal+' مرکز</span>'
        +'</div>'
        +(potBadges?'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">'+potBadges+'</div>':'')
      +'</div>'
      +'<div style="max-height:200px;overflow-y:auto">'
        +(provRows||'<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center">استانی تخصیص داده نشده</div>')
      +'</div>'
    +'</div>';
  }).join('');

  // unassigned
  var unassigned=provs.filter(function(p){return!getOwner(p);});

  // assignment table
  var rows=provs.map(function(p){
    var owner=getOwner(p);
    var color=owner?umGetColor(owner):'var(--border)';
    var cCount=getProvCenters(p.id).length;
    var pc=potColors[p.potential]||'#94a3b8';
    return '<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:6px 10px;font-weight:600;color:var(--text-primary)">'
        +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+color+';margin-left:6px;vertical-align:middle" id="pdot_'+p.id+'"></span>'
        +esc(p.name)
        +'<span style="font-size:10px;color:var(--text-muted);margin-right:4px"> · '+cCount+'</span>'
        +'<span style="font-size:9px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:3px;padding:1px 4px;margin-right:2px">P'+p.potential+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted)">'+p.biopsyPct+'٪</span>'
      +'</td>'
      +'<td style="padding:6px 8px">'
        +'<select id="pown_'+p.id+'" onchange="umProvOwnerChanged(\''+p.id+'\')" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:4px 8px;font-size:11px;font-family:inherit;color:var(--text-primary);width:150px">'
          +activeMembers.map(function(m){return'<option value="'+m.id+'"'+(owner===m.id?' selected':'')+'>'+esc(m.name)+'</option>';}).join('')
          +'<option value=""'+(owner?'':' selected')+'>بدون مسئول</option>'
        +'</select>'
      +'</td>'
    +'</tr>';
  }).join('');

  return '<div id="provExpertCards" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">'+expertCards+'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div style="font-size:12px;color:var(--text-muted)">'+provs.length+' استان'+(unassigned.length?' · <span style="color:#f59e0b;font-weight:600">'+unassigned.length+' بدون مسئول</span>':'')+' — تغییر فوری ذخیره می‌شود</div>'
      +'<div style="display:flex;gap:6px">'+'<button onclick="umQuickAssignProvinces()" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">⚡ تقسیم مساوی</button>'+'<button onclick="showProvHistory()" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:5px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">📋 تاریخچه تغییرات</button>'+'</div>'
    +'</div>'
    +'<div style="max-height:350px;overflow-y:auto;border:1px solid var(--border);border-radius:7px">'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead style="position:sticky;top:0;background:var(--bg-raised)"><tr>'
          +'<th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-muted);border-bottom:1.5px solid var(--border)">استان</th>'
          +'<th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-muted);border-bottom:1.5px solid var(--border)">مسئول</th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function umProvOwnerChanged(provId){
  var sel=document.getElementById('pown_'+provId);if(!sel)return;
  var newOwner=sel.value;
  // log history before changing
  var prevE=getE(getProvType(provId),provId);
  var prevOwner=prevE.owner||'';
  var prov=getAllProvinces().find(function(p){return p.id===provId;});
  var prevFallback=prov?prov.owner||'':'';
  var fromOwner=prevOwner||prevFallback;
  if(fromOwner!==newOwner){
    var members=umGetMembers();
    var fromName=fromOwner?(members.find(function(m){return m.id===fromOwner;})||{name:fromOwner}).name:'بدون مسئول';
    var toName=newOwner?(members.find(function(m){return m.id===newOwner;})||{name:newOwner}).name:'بدون مسئول';
    if(!DB.provHistory)DB.provHistory=[];
    DB.provHistory.push({provId:provId,provName:prov?prov.name:provId,from:fromOwner,fromName:fromName,to:newOwner,toName:toName,at:todayStr(),ts:Date.now()});
    saveDB();
  }
  setE(getProvType(provId),provId,'owner',newOwner);
  var dot=document.getElementById('pdot_'+provId);
  if(dot)dot.style.background=newOwner?umGetColor(newOwner):'var(--border)';
  try{renderProvList&&renderProvList();}catch(e){}
  // refresh expert cards
  var cardsEl=document.getElementById('provExpertCards');
  if(cardsEl){
    var tmp=document.createElement('div');tmp.innerHTML=_umProvinces();
    var newCards=tmp.querySelector('#provExpertCards');
    if(newCards)cardsEl.innerHTML=newCards.innerHTML;
  }
}

function umQuickAssignProvinces(){
  var active=umGetActive();if(!active.length)return;
  var provs=getAllProvinces();
  provs.forEach(function(p,i){
    var owner=active[i%active.length].id;
    setE(getProvType(p.id),p.id,'owner',owner);
    var sel=document.getElementById('pown_'+p.id);
    if(sel)sel.value=owner;
    var dot=document.getElementById('pdot_'+p.id);
    if(dot)dot.style.background=umGetColor(owner);
  });
  showToast('✅ '+provs.length+' استان بین '+active.length+' کارشناس تقسیم شد',2500);
  // Refresh summary
  setTimeout(function(){var w=document.getElementById('umWrap');if(w)w.innerHTML=_umBody();},300);
}

// ── Province History ──────────────────────────────────────────
function showProvHistory(){
  var hist=(DB.provHistory||[]).slice().reverse();
  if(!hist.length){
    openModal('provHistModal','📋 تاریخچه تغییرات مسئولین استان','<div style="padding:30px;text-align:center;color:var(--text-muted)">هنوز هیچ تغییری ثبت نشده است</div>','<button class="btn-secondary" onclick="closeModal(\'provHistModal\')">بستن</button>',{lg:true});
    return;
  }
  // Group by date
  var grouped={};
  hist.forEach(function(h){
    var d=h.at||'نامشخص';
    if(!grouped[d])grouped[d]=[];
    grouped[d].push(h);
  });
  var html='<div style="max-height:65vh;overflow-y:auto">';
  Object.keys(grouped).sort().reverse().forEach(function(date){
    html+='<div style="margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">📅 '+date+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px">';
    grouped[date].forEach(function(h){
      html+='<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px">'
        +'<span style="font-weight:700;font-size:12px;color:var(--text-primary);flex:1">'+esc(h.provName||h.provId)+'</span>'
        +'<span style="font-size:11px;color:var(--text-muted)">'+esc(h.fromName||'بدون مسئول')+'</span>'
        +'<span style="font-size:13px;color:#0ea5e9">→</span>'
        +'<span style="font-size:11px;font-weight:600;color:var(--text-primary)">'+esc(h.toName||'بدون مسئول')+'</span>'
      +'</div>';
    });
    html+='</div></div>';
  });
  html+='</div>';
  var foot='<button onclick="if(confirm(\'پاک کردن کل تاریخچه؟\')){DB.provHistory=[];saveDB();closeModal(\'provHistModal\');showToast(\'تاریخچه پاک شد\')}" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:5px 14px;cursor:pointer;font-size:11px;font-family:inherit">🗑 پاک کردن</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'provHistModal\')" style="margin-right:8px">بستن</button>';
  openModal('provHistModal','📋 تاریخچه تغییرات مسئولین استان',html,foot,{lg:true});
}

// ── Tab 3: Bulk Reassign ──────────────────────────────────────
function _umBulk(){
  var allMembers=umGetMembers().filter(function(m){return m.id!=='guest';});
  var active=umGetActive();
  var fromOpts=allMembers.map(function(m){
    var n=umCountCenters(m.id);
    var dot='● ';
    return '<option value="'+m.id+'">'+(m.active===false?'[غیرفعال] ':'')+esc(m.name)+' — '+n+' مرکز</option>';
  }).join('');
  var toOpts=active.map(function(m){
    return '<option value="'+m.id+'">'+esc(m.name)+'</option>';
  }).join('');

  return '<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:9px 14px;margin-bottom:16px;font-size:12px;color:var(--text-secondary)">'
    +'📌 تمام مراکز کارشناس مبدأ (مسئولیت مستقیم) به مقصد منتقل می‌شود. بک‌آپ پیش از اجرا توصیه می‌شود.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
    +'<div><label style="font-size:12px;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px">👤 مبدأ (از)</label>'
    +'<select id="brFrom" onchange="previewBulkReassign()" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12.5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+fromOpts+'</select></div>'
    +'<div><label style="font-size:12px;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px">👤 مقصد (به)</label>'
    +'<select id="brTo" onchange="previewBulkReassign()" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12.5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+toOpts+'</select></div>'
    +'</div>'
    +'<div id="brPreview" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px 14px;font-size:12px;color:var(--text-secondary);min-height:40px;margin-bottom:14px">برای پیش‌نمایش، از/به را انتخاب کنید.</div>'
    +'<button onclick="executeBulkReassign()" style="background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:9px 24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%">✅ انجام جابجایی</button>';
}



function buildUSERS(){
  // Fetch from server API and populate USERS map + _DEFAULT_MEMBERS
  fetch('/api/users')
    .then(function(r){return r.json();})
    .then(function(list){
      USERS={};
      _DEFAULT_MEMBERS=list.map(function(m){
        USERS[m.username]=m.display_name;
        return{id:m.username,name:m.display_name,role:m.role,color:m.color,phone:m.phone||'',active:m.active};
      });
      // Also sync to DB.settings.members so legacy code works
      if(DB.settings)DB.settings.members=_DEFAULT_MEMBERS;
      _buildUSERSUI();
      if(typeof buildOwnerFilter==='function')buildOwnerFilter();
    })
    .catch(function(){
      // Fallback to DB.settings.members if server unavailable
      USERS={};
      var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
      members.forEach(function(m){if(m.id&&m.name&&m.active!==false)USERS[m.id]=m.name;});
      _buildUSERSUI();
    });
}
function _buildUSERSUI(){
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var activeMembers=members.filter(function(m){return m.active!==false;});
  var sel=document.getElementById('uSel');
  if(sel){
    var cur=DB._lastUser||currentUser;
    sel.innerHTML=activeMembers.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+(m.role?' — '+m.role:'')+'</option>';}).join('');
    if(USERS[cur])sel.value=cur;
    else if(activeMembers.length)sel.value=activeMembers[0].id;
    currentUser=sel.value;
    var dot=document.getElementById('uSelDot');
    if(dot)dot.style.background=umGetColor(currentUser);
  }
  // Update currentUserDisplay (server-auth mode)
  var cuDisp=document.getElementById('currentUserDisplay');
  if(cuDisp)cuDisp.textContent=USERS[currentUser]||currentUser;
  // filterOwner dropdown
  var fown=document.getElementById('filterOwner');
  if(fown){
    var prevVal=fown.value;
    fown.innerHTML='<option value="">همه مسئولان</option>'
      +activeMembers.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';}).join('');
    if(prevVal)fown.value=prevVal;
  }
  if(!USERS[currentUser]&&activeMembers.length)currentUser=activeMembers[0].id;
  if(typeof _kpiUser!=='undefined'&&_kpiUser&&!USERS[_kpiUser])
    _kpiUser=Object.keys(USERS)[0]||null;
  var h1=document.getElementById('companyNameH1');
  var cn=(DB.settings&&DB.settings.companyName)||'پورتال فروش';
  if(h1)h1.textContent=cn;
}
function initSettings(){
  if(!DB.settings||!DB.settings.members){
    DB.settings={
      companyName:(DB.settings&&DB.settings.companyName)||'آتنا زیست درمان',
      members:(DB.settings&&DB.settings.members)||JSON.parse(JSON.stringify(_DEFAULT_MEMBERS)),
      ckItems:(DB.settings&&DB.settings.ckItems)||null,
      firstUse:(DB.settings&&DB.settings.firstUse)||{},
      onboardingDisabled:(DB.settings&&DB.settings.onboardingDisabled)||{}
    };
  }
  if(!DB.settings.firstUse)DB.settings.firstUse={};
  if(!DB.settings.onboardingDisabled)DB.settings.onboardingDisabled={};
  if(DB.settings.statusList&&DB.settings.statusList.length>=2)STATUS_LIST=DB.settings.statusList;
  if(DB.settings.leadList&&DB.settings.leadList.length>=2)LEAD_LIST=DB.settings.leadList;
  if(DB.settings.typeList&&DB.settings.typeList.length>=1)TYPE_LIST=DB.settings.typeList;
  buildUSERS();
}

// ════════════════════════ INDEXEDDB (Master Centers DB) ══════════════════
var _IDB_NAME='atenaCRM_master';
var _IDB_VER=1;
var _idbAvailable=null;
function _openIDB(){
  if(_idbAvailable===false)return Promise.reject('IDB unavailable');
  return new Promise(function(resolve,reject){
    try{
      if(typeof indexedDB==='undefined'){_idbAvailable=false;return reject('no IDB');}
      var req=indexedDB.open(_IDB_NAME,_IDB_VER);
      req.onupgradeneeded=function(e){
        var db=e.target.result;
        if(!db.objectStoreNames.contains('master'))
          db.createObjectStore('master',{keyPath:'key'});
      };
      req.onsuccess=function(e){_idbAvailable=true;resolve(e.target.result);};
      req.onerror=function(){_idbAvailable=false;reject(req.error);};
      req.onblocked=function(){_idbAvailable=false;reject('IDB blocked');};
    }catch(e){_idbAvailable=false;reject(e);}
  });
}
function idbGet(key){
  return _openIDB().then(function(db){
    return new Promise(function(resolve){
      var tx=db.transaction('master','readonly');
      var req=tx.objectStore('master').get(key);
      req.onsuccess=function(){
        var val=req.result?req.result.value:null;
        if(val){try{localStorage.setItem('_idb_bk_'+key,JSON.stringify(val));}catch(e){}}
        resolve(val);
      };
      req.onerror=function(){resolve(_idbLocalFallback(key));};
    });
  }).catch(function(){return _idbLocalFallback(key);});
}
function _idbLocalFallback(key){
  try{var s=localStorage.getItem('_idb_bk_'+key);return s?JSON.parse(s):null;}catch(e){return null;}
}
function idbSet(key,value){
  try{localStorage.setItem('_idb_bk_'+key,JSON.stringify(value));}catch(e){}
  return _openIDB().then(function(db){
    return new Promise(function(resolve){
      var tx=db.transaction('master','readwrite');
      tx.objectStore('master').put({key:key,value:value});
      tx.oncomplete=function(){resolve(true);};
      tx.onerror=function(){resolve(false);};
    });
  }).catch(function(){return false;});
}

// لود مراکز از IndexedDB و پر کردن CENTERS و PC_RAW
function loadMasterCenters(){
  return fetch('/api/data/centers/master')
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(d){
      if(d.CENTERS&&Array.isArray(d.CENTERS))CENTERS=d.CENTERS;
      if(d.PC_RAW&&typeof d.PC_RAW==='object'){
        Object.keys(PC_RAW).forEach(function(k){delete PC_RAW[k];});
        Object.keys(d.PC_RAW).forEach(function(k){PC_RAW[k]=d.PC_RAW[k];});
      }
      clearPCCache();_ALL_PROVS=null;
      console.log('[AtenaCRM] Master centers loaded from server');
    })
    .catch(function(e){
      // Fallback: try IndexedDB for offline use
      console.warn('[AtenaCRM] Server centers unavailable, trying IndexedDB:',e);
      return idbGet('centersDB').then(function(data){
        if(!data||!data.centers||!data.centers.length)return;
        var tehranCenters=[];
        var byProv={};
        data.centers.forEach(function(c){
          if(c.province_id==='tehran'){tehranCenters.push(c);}
          else{if(!byProv[c.province_id])byProv[c.province_id]=[];byProv[c.province_id].push(c);}
        });
        CENTERS.length=0;
        tehranCenters.forEach(function(c){CENTERS.push(c);});
        Object.keys(PC_RAW).forEach(function(k){delete PC_RAW[k];});
        PROVINCES.forEach(function(p){
          var arr=byProv[p.id];
          if(!arr||!arr.length)return;
          PC_RAW[p.name]=arr.map(function(c){return[c.row,c.name,c.potential,c.type||'',c.lead||'سرنخ'];});
        });
        clearPCCache();_ALL_PROVS=null;
        console.log('[AtenaCRM] Master DB loaded from IndexedDB: '+data.centers.length+' centers');
      });
    });
}

// ذخیره مراکز در IndexedDB
function saveMasterCenters(centers){
  return idbSet('centersDB',{centers:centers,updatedAt:new Date().toISOString()});
}
function recK(type,id){return type+'_'+id;}
function getE(type,id){return DB.edits[recK(type,id)]||{};}
function _getCenterName(type,id){
  var _over=(DB.edits[recK(type,id)]||{}).nameOverride;if(_over)return _over;
  if(type==='center'){var c=CENTERS.find(function(x){return x.id===id;});if(c)return c.name;}
  _buildPCCache();
  var provId=id.split('||')[0];
  var arr=_PC_CACHE[provId]||[];
  var c2=arr.find(function(x){return x.id===id;});
  if(c2)return c2.name;
  var ex=(DB.extra||[]).find(function(x){return x.id===id;});
  return ex?ex.name:id;
}
function getCenterById(rtype,id){
  if(rtype==='center'){return CENTERS.find(function(x){return x.id===id;})||null;}
  _buildPCCache();
  var provId=(id+'').split('||')[0];
  var arr=_PC_CACHE[provId]||[];
  var c=arr.find(function(x){return x.id===id;});
  if(c)return c;
  return (DB.extra||[]).find(function(x){return x.id===id;})||null;
}
function setE(type,id,field,val){var k=recK(type,id);if(!DB.edits[k])DB.edits[k]={};
  if(!_undoSuppressed){var _prevVal=DB.edits[k][field];_undoStack.push({type:type,id:id,field:field,val:_prevVal});if(_undoStack.length>MAX_UNDO)_undoStack.shift();_redoStack=[];}
  if(!_undoSuppressed){DB.changeLog=DB.changeLog||[];DB.changeLog.push({at:new Date().toISOString(),by:currentUser,rkey:type+'_'+id,field:field,val:val});if(DB.changeLog.length>500)DB.changeLog=DB.changeLog.slice(-500);}
  var _auditFields=['status','owner','lead','potential','followupDate','contactName','contactTitle','phones','address'];
  if(_auditFields.indexOf(field)>=0){
    var _oldV=DB.edits[k][field]!==undefined?DB.edits[k][field]:'';
    if(String(_oldV)!==String(val)){
      var _cName=_getCenterName(type,id);
      fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({centerKey:k,centerName:_cName,field:field,oldValue:_oldV,newValue:val})
      }).catch(function(){});
    }
  }
  DB.edits[k][field]=val;DB.edits[k]._ts=nowTs();
  if(field==='status'&&val==='غیرفعال'&&!_undoSuppressed)setTimeout(function(){_promptLostReason(type,id);},400);if(field==='status'||field==='lead'||field==='potential')DB.edits[k]._lastActivity=nowTs();if(field==='status')DB.edits[k]._statusChangedTs=nowTs();if(field==='followupDate'&&val){(function(){var _p=(val+'').split('/').map(Number);if(_p.length!==3||isNaN(_p[0]))return;var _ndMs=jMs(_p[0],_p[1],_p[2]);Object.keys(DB.weekEntries||{}).forEach(function(_wk){var _we=DB.weekEntries[_wk];if(_we.rtype!==type||_we.rid!==id||_we.done)return;var _wId=_wk.split(':::')[0];var _mWk=(typeof wpGetWeeks==='function'?wpGetWeeks():[]).find(function(w){return w.id===_wId;});if(!_mWk)return;var _wsMs=jMs(_mWk.wsArr[0],_mWk.wsArr[1],_mWk.wsArr[2]);var _weMs=jMs(_mWk.weArr[0],_mWk.weArr[1],_mWk.weArr[2]);if(_ndMs>=_wsMs&&_ndMs<=_weMs)_we.scheduledDate=val;});})();}saveDB();flashRow(id);if(currentTab==='kpi'&&(field==='status'||field==='lead'||field==='owner'))setTimeout(renderKPIPanel,300);if(field==='followupDate'&&currentTab==='weekplan')setTimeout(renderWeekPlan,50);if(field==='owner'&&val&&typeof sendNotif==='function'){(function(){var _oldOwner=(DB.edits[k]||{})._prevOwner||'';if(val!==_oldOwner&&val!==currentUser){var _cn=_getCenterName(type,id);sendNotif(val,'مرکز "'+_cn+'" به شما واگذار شد',type+'_'+id);}DB.edits[k]._prevOwner=val;})();}var _cFields=['contactName','contactTitle','phones','address','contacts'];if(_cFields.indexOf(field)>=0){  var _ce=DB.edits[k];  fetch('/api/contacts/'+encodeURIComponent(k),{method:'PUT',headers:{'Content-Type':'application/json'},    body:JSON.stringify({centerName:_getCenterName(type,id),      contacts:_ce.contacts||[],address:_ce.address||''})  }).catch(function(){});}}
function _lrSelect(btn,reason){
  document.querySelectorAll('[data-lrb]').forEach(function(b){
    b.style.background='var(--bg-raised)';b.style.color='var(--text-primary)';b.style.borderColor='var(--border)';
  });
  btn.style.background='#7c3aed';btn.style.color='#fff';btn.style.borderColor='#7c3aed';
  var inp=document.getElementById('lrReason');if(inp)inp.value=reason;
}
function _promptLostReason(rtype,id){
  var e=getE(rtype,id);
  if(e.lostReason)return;
  var name=_getCenterName(rtype,id);
  var reasons=['رقیب برد','قیمت بالا','نیاز نداشتن','زمان‌بندی نامناسب','عدم دسترسی به تصمیم‌گیر','سایر'];
  var body='<div style="font-size:12px">'
    +'<div style="color:var(--text-muted);margin-bottom:12px">مرکز «'+esc(name)+'» غیرفعال شد. ثبت دلیل به تحلیل فروش کمک می‌کند.</div>'
    +'<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px">دلیل از دست دادن</label>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'
    +reasons.map(function(r){
      return '<button onclick="_lrSelect(this,\''+r+'\')" data-lrb="1" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);cursor:pointer;font-size:11px;font-family:inherit">'+esc(r)+'</button>';
    }).join('')
    +'</div>'
    +'<input type="hidden" id="lrReason">'
    +'<label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">توضیح (اختیاری)</label>'
    +'<textarea id="lrNote" rows="2" placeholder="جزئیات بیشتر..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;background:var(--bg-input);color:var(--text-primary)"></textarea>'
    +'</div>';
  var foot='<button class="btn-primary" onclick="_saveLostReason(\''+rtype+'\',\''+id+'\')">ثبت دلیل</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'lostReasonModal\')">بعداً</button>';
  openModal('lostReasonModal','❌ دلیل غیرفعال شدن',body,foot);
}
function _saveLostReason(rtype,id){
  var reason=(document.getElementById('lrReason')||{}).value||'';
  var note=(document.getElementById('lrNote')||{}).value||'';
  if(!reason){showToast('لطفاً یک دلیل انتخاب کنید');return;}
  var k=recK(rtype,id);
  if(!DB.edits[k])DB.edits[k]={};
  DB.edits[k].lostReason=reason;
  if(note)DB.edits[k].lostNote=note;
  saveDB();
  closeModal('lostReasonModal');
  showToast('✅ دلیل ثبت شد',2000);
}
function rTags(type,id){return DB.rTags[recK(type,id)]||[];}
function tagById(id){return(DB.tags||[]).find(function(t){return t.id===id;});}
function undoEdit(){
  if(!_undoStack.length){showToast('⚠ چیزی برای بازگشت نیست');return;}
  var op=_undoStack.pop();
  var currVal=(getE(op.type,op.id)||{})[op.field];
  _redoStack.push({type:op.type,id:op.id,field:op.field,val:currVal});
  _undoSuppressed=true;try{setE(op.type,op.id,op.field,op.val);}finally{_undoSuppressed=false;}
  showToast('↩ بازگشت انجام شد');
  if(currentTab==='provinces')renderDashboard();
}
function redoEdit(){
  if(!_redoStack.length){showToast('⚠ چیزی برای تکرار نیست');return;}
  var op=_redoStack.pop();
  var currVal=(getE(op.type,op.id)||{})[op.field];
  _undoStack.push({type:op.type,id:op.id,field:op.field,val:currVal});
  _undoSuppressed=true;try{setE(op.type,op.id,op.field,op.val);}finally{_undoSuppressed=false;}
  showToast('↪ تکرار انجام شد');
  if(currentTab==='provinces')renderDashboard();
}


/* ═══ public/js/data.js ═══ */
// ════════════════════════ DATA HELPERS ════════════════
// تهران + ۳۰ استان دیگر — cached
var _ALL_PROVS=null;
function getAllProvinces(){
  if(!_ALL_PROVS)_ALL_PROVS=[{id:'tehran',row:0,name:'تهران',potential:1,biopsyPct:19.8,owner:null}].concat(PROVINCES);
  return _ALL_PROVS;
}
function getProvType(provId){return provId==='tehran'?'center':'pc';}
// Cache: PC_RAW یک بار normalize می‌شود — null = نیاز به rebuild دارد
var _PC_CACHE=null;
function _buildPCCache(){
  if(_PC_CACHE!==null&&Object.keys(_PC_CACHE).length>0)return;
  _PC_CACHE={};
  PROVINCES.forEach(function(p){
    var pname=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    var raw=PC_RAW[pname]||PC_RAW[p.id]||[];
    _PC_CACHE[p.id]=raw.map(function(r){
      if(Array.isArray(r)){
        return{id:p.id+'||'+r[0],row:r[0],name:(r[1]||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'),potential:r[2],type:r[3]||'',lead:r[4]||'سرنخ',province_id:p.id,owner:p.owner};
      } else {
        var rid=r.row||r[0]||0;
        return{id:r.id||(p.id+'||'+rid),row:rid,name:(r.name||r[1]||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'),potential:r.potential||r[2]||1,type:r.type||r[3]||'',lead:r.lead||r[4]||'سرنخ',province_id:p.id,owner:p.owner};
      }
    });
  });
  _PC_CACHE['tehran']=CENTERS; 

  // ── Populate CNC cache ──────────────────────────────
  _loadCNC();var _chg=false;
  Object.keys(_PC_CACHE).forEach(function(pv){
    (_PC_CACHE[pv]||[]).forEach(function(ct){
      if(!ct||!ct.id||!ct.name)return;
      var rk=(pv==='tehran'?'center_':'pc_')+ct.id;
      if(!_CNC[rk]){_CNC[rk]=ct.name;_chg=true;}
    });
  });
  if(_chg)try{localStorage.setItem('_cnc',JSON.stringify(_CNC));}catch(e){}
}function getProvCenters(provId){
  _buildPCCache();
  var useHardcoded=!(DB.hiddenProvs&&DB.hiddenProvs[provId]);
  var base=useHardcoded?(_PC_CACHE[provId]||[]):[];
  var extras=(DB.extra||[]).filter(function(c){return c.province_id===provId;});
  if(!extras.length)return base; // no copy needed
  return base.concat(extras);
}
function clearPCCache(){_PC_CACHE=null;}
function isStalled(type,id){
  var e=getE(type,id);var st=e.status||'بدون تماس';
  if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  var last=e._lastActivity||e._ts||0;if(!last)return false;
  return(nowTs()-last)>(30*24*3600*1000);
}
function isOverdue(type,id){
  var e=getE(type,id);var fd=e.followupDate||'';
  var st=e.status||'بدون تماس';if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  return fd&&fd<todayStr();
}


/* ═══ public/js/ui-core.js ═══ */
// ════════════════════════ UI FLASH / TOAST ════════════
function flashRow(id){
  var r=document.querySelector('[data-rowid="'+id+'"]');
  if(r){r.classList.remove('row-flash-ok');void r.offsetWidth;r.classList.add('row-flash-ok');}
}
var _toastTimer=null;
function showToast(msg,dur){
  var t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){t.classList.remove('show');},dur||2500);
}

// ════════════════════════ USER ═════════════════════════
function onUserChange(u){
  currentUser=u;DB._lastUser=u;saveDB();
  var _dot=document.getElementById('uSelDot');
  if(_dot&&typeof umGetColor!=='undefined')_dot.style.background=umGetColor(u);
  // تغییر کاربر = تغییر هویت، نه فیلتر — داده‌ها محو نمی‌شوند
  // برای فیلتر از fOwner در نوار فیلتر استفاده کنید
  renderDashboard();renderBanner();
  if(currentTab==='provinces'||currentTab==='province_view')renderTable();
  else if(currentTab==='checklist')renderChecklist();
  updateNotifBadge();
}

// ════════════════════════ TAB SWITCH ══════════════════
function switchTab(tab){
  if(tab!=='provinces')_currentProvId=null;
  currentTab=tab;
  try{localStorage.setItem('_st',tab);}catch(e){}
  _navPush(tab, null);
  ['home','provinces','weekplan','calendar','checklist','activity','changelog','tasks','manager','kpi','mtr','pricing'].forEach(function(t){
    var b=document.getElementById('tab_'+t);if(b)b.classList.toggle('active',t===tab);
  });
  document.getElementById('dash').style.display=(tab==='provinces')?'':'none';
  var _hp=document.getElementById('homePanel');if(_hp)_hp.style.display=(tab==='home')?'':'none';
  var _udp=document.getElementById('userDashPanel');if(_udp)_udp.style.display=(tab==='provinces')?'':'none';
  document.getElementById('banner').style.display='none';
  document.getElementById('filtersBar').style.display=(tab==='provinces')?'flex':'none';
  document.getElementById('tableArea').style.display=(tab==='provinces')?'':'none';
  document.getElementById('wpPanel').style.display=(tab==='weekplan')?'':'none';
  var _clp=document.getElementById('changelogPanel');if(_clp)_clp.style.display=(tab==='changelog')?'':'none';
  var _tp=document.getElementById('tasksPanel');if(_tp)_tp.style.display=(tab==='tasks')?'':'none';
  document.getElementById('calPanel').style.display=(tab==='calendar')?'':'none';
  document.getElementById('ckPanel').style.display=(tab==='checklist')?'':'none';
  document.getElementById('actPanel').style.display=(tab==='activity')?'':'none';
  var mp=document.getElementById('managerPanel');if(mp)mp.style.display=(tab==='manager')?'':'none';
  var kp=document.getElementById('kpiPanel');if(kp)kp.style.display=(tab==='kpi')?'':'none';
  var mtrp=document.getElementById('mtrPanel');if(mtrp)mtrp.style.display=(tab==='mtr')?'':'none';
  var pricingP=document.getElementById('pricingPanel');if(pricingP)pricingP.style.display=(tab==='pricing')?'':'none';
  if(tab==='mtr'&&typeof mtrLazyInit==='function')mtrLazyInit();
  if(tab==='pricing'&&typeof pricingLazyInit==='function')pricingLazyInit();
  // update mobile nav
  (function(){var tabs=['home','provinces','weekplan','calendar','checklist','activity','mtr'];document.querySelectorAll('.mob-tab').forEach(function(btn,i){btn.classList.toggle('active',tabs[i]===tab);});})();
  function _safeRender(fn, tabName) {
    try { fn(); } catch(err) {
      console.error('[switchTab] خطا در رندر تب '+tabName+':', err);
      var panel = document.getElementById(tabName+'Panel') || document.getElementById('dash');
      if(panel) panel.innerHTML = '<div style="padding:32px;text-align:center;color:#ef4444;font-size:14px">⚠ خطا در بارگذاری این بخش — لطفاً صفحه را رفرش کنید<br><small style="color:#94a3b8;font-size:11px">' + esc(err.message||String(err)) + '</small></div>';
    }
  }
  if(tab==='provinces'){
    _safeRender(function(){renderDashboard();renderBanner();},'provinces');
    if(!_currentProvId){
      var toShow=['srch','fOwner','lblOw','fType','fTag','lblTg'];
      toShow.forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
      if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
      var pg=document.getElementById('allCentersToggle');if(pg)pg.style.display='';
    } else {
      // restore province view UI if navigated back or refreshed with _currentProvId set
      var _act=document.getElementById('allCentersToggle');if(_act)_act.style.display='none';
      var _pb=document.getElementById('provBackBtn');if(_pb)_pb.style.display='';
      var _ab=document.getElementById('addCenterBtn');if(_ab)_ab.style.display='';
      var _hd=document.getElementById('provViewHead');
      if(_hd&&!_hd.textContent){var _pv=getAllProvinces().find(function(p){return p.id===_currentProvId;});_hd.textContent='🏥 مراکز '+(_pv?_pv.name:_currentProvId);}
      ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','fType','lblTp','viewSw','csvBtn','printBtn','xlsBtn','savePresetBtn','sortSel'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
      if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
      var _qf=document.getElementById('quickFilters');if(_qf)_qf.style.display='flex';
    }
    _safeRender(renderTable,'provinces');
  }
  else if(tab==='weekplan'){var _dmb=document.getElementById('wpDailyMonBtn');if(_dmb)_dmb.style.display=_isManager()?'':'none';_safeRender(renderWeekPlan,'weekplan');}
  else if(tab==='calendar')_safeRender(renderCalendar,'cal');
  else if(tab==='checklist')_safeRender(renderChecklist,'ck');
  else if(tab==='activity'){_actPage=0;_safeRender(renderActivity,'act');}
  else if(tab==='changelog')_safeRender(renderChangelog,'changelog');
  else if(tab==='tasks')_safeRender(renderTasksPanel,'tasks');
  else if(tab==='manager')_safeRender(renderManagerPanel,'manager');
  else if(tab==='kpi')_safeRender(renderKPIPanel,'kpi');
  else if(tab==='home')_safeRender(renderHome,'home');
  var _clBtn=document.getElementById('tab_changelog');if(_clBtn)_clBtn.style.display=_isManager()?'':'none';
  var _tBtn=document.getElementById('tab_tasks');if(_tBtn)_tBtn.style.display='';
}

// ════════════════════════ PROVINCE VIEW ═══════════════
function openProvince(provId){
  _currentProvId=provId;
  try{localStorage.setItem('_spid',provId);}catch(e){}
  _navPush('provinces', provId);
  currentTab='provinces';
  var prov=getAllProvinces().find(function(p){return p.id===provId;});
  var provName=prov?prov.name:provId;
  var hd=document.getElementById('provViewHead');
  if(hd)hd.textContent='🏥 مراکز '+provName;
  var act=document.getElementById('allCentersToggle');if(act)act.style.display='none';
  document.getElementById('dash').style.display='none';
  document.getElementById('banner').style.display='none';
  document.getElementById('filtersBar').style.display='flex';
  document.getElementById('tableArea').style.display='';
  // مطمئن شو table-wrap مخفی نیست
  var tw=document.querySelector('.table-wrap');if(tw)tw.style.display='';
  var emsg=document.getElementById('emptyDBMsg');if(emsg)emsg.style.display='none';
  var pb=document.getElementById('provBackBtn');if(pb)pb.style.display='';
  var ab=document.getElementById('addCenterBtn');if(ab)ab.style.display='';
  // نمایش filter controls
  ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','fType','lblTp','viewSw','csvBtn','printBtn','xlsBtn','savePresetBtn','sortSel'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='';
  });
  if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
  var qf=document.getElementById('quickFilters');if(qf)qf.style.display='flex';
  ['srch','fPot','fStatus','fLead','fOwner','fTag'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  rebuildFilters();
  renderProvTable();
}

function backToProvinces(){
  _currentProvId=null;
  try{localStorage.removeItem('_spid');}catch(e){}
  currentTab='provinces';
  var pb=document.getElementById('provBackBtn');if(pb)pb.style.display='none';
  var ab=document.getElementById('addCenterBtn');if(ab)ab.style.display='none';
  var hd=document.getElementById('provViewHead');if(hd)hd.textContent='';
  ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','viewSw','csvBtn','printBtn','hardToggleBtn','xlsBtn','savePresetBtn','filterPresetSel','sortSel'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  var qf=document.getElementById('quickFilters');if(qf)qf.style.display='none';
  var sb=document.getElementById('centerStatsBar');if(sb)sb.style.display='none';
  _quickFilter='';_globalOwnerFilter='';_selectedCenters=new Set();
  var bar=document.getElementById('centersBulkBar');if(bar)bar.classList.remove('active');
  // reset view
  _viewMode='list';
  // allCentersToggle را نمایش بده
  var act=document.getElementById('allCentersToggle');if(act)act.style.display='';
  switchTab('provinces');
}


// ════════════════════════ BROWSER HISTORY NAVIGATION ══════════════
var _navReady = false;   // set true after init completes
var _poppingState = false; // suppress pushState during popstate handling

function _navPush(tab, provId) {
  if (!_navReady || _poppingState) return;
  try {
    history.pushState({v:1, tab:tab, provId:provId||null}, '',
      window.location.pathname + window.location.search);
  } catch(e) {}
}

// دکمه بازگشت برنامه — اگر تاریخچه مرورگر وجود دارد از آن استفاده می‌کند
function appBack() {
  if (_navReady && window.history.length > 1) {
    history.back();
  } else {
    backToProvinces();
  }
}

window.addEventListener('popstate', function(e) {
  if (!_navReady) return;
  var state = e.state;
  _poppingState = true;
  try {
    if (!state || !state.v) {
      // بدون state — برگشت به لیست استان‌ها
      if (_currentProvId) backToProvinces();
      else switchTab('provinces');
    } else if (state.provId) {
      // بازگشت به نمای استان
      openProvince(state.provId);
    } else {
      // بازگشت به تب
      if (state.tab === 'provinces' && _currentProvId) backToProvinces();
      else switchTab(state.tab || 'provinces');
    }
  } catch(e2) { console.error('[nav] popstate error:', e2); }
  _poppingState = false;
});


/* ═══ public/js/dashboard.js ═══ */
// ════════════════════════ DASHBOARD ═══════════════════

// ════════════════════════ PERSONAL USER DASHBOARD ══════════════
// ════════════════════════ DASHBOARD HELPERS ════════════════════════
var _udExpandData={};
function _udExpand(uid){
  var d=_udExpandData[uid];if(!d)return;
  var body='<div style="display:flex;flex-direction:column;gap:5px;max-height:72vh;overflow-y:auto;padding:2px 4px">';
  if(!d.items.length){body+='<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">'+d.emptyMsg+'</div>';}
  else{d.items.forEach(function(it){body+=d.renderItem(it);});}
  body+='</div>';
  openModal('udExp_'+uid,d.title,body,'<button class="btn-secondary" onclick="closeModal(\'udExp_'+uid+'\')">بستن</button>',{xl:true});
}
function _dashPbar(pct,color,h){
  h=h||6;var r=Math.round(h/2);
  return '<div style="background:var(--bg-raised);border-radius:'+r+'px;height:'+h+'px;overflow:hidden">'
    +'<div style="background:'+color+';height:'+h+'px;border-radius:'+r+'px;width:'+Math.min(100,Math.max(0,pct))+'%;transition:width .4s"></div></div>';
}
function _dashBadge(n,bg,fg){
  return '<span style="background:'+bg+';color:'+fg+';font-size:10px;font-weight:700;border-radius:10px;padding:1px 7px;margin-right:4px">'+n+'</span>';
}
function _dashKpiCard(value,label,icon,color,sub,pct){
  return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;border-top:3px solid '+color+'">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
    +'<div><div style="font-size:26px;font-weight:900;color:var(--text-primary);line-height:1">'+value+'</div>'
    +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+label+'</div>'
    +(sub?'<div style="font-size:10px;color:var(--text-muted)">'+esc(sub)+'</div>':'')
    +'</div><div style="font-size:22px;opacity:.55">'+icon+'</div></div>'
    +(pct!==undefined?_dashPbar(pct,color,5):'')
    +'</div>';
}
var _dashSectionUidCounter=0;
function _dashSectionCard(title,items,emptyMsg,renderItem){
  var uid='dsc'+(++_dashSectionUidCounter);
  _udExpandData[uid]={title:title,items:items,emptyMsg:emptyMsg,renderItem:renderItem};
  var expandBtn='<button onclick="event.stopPropagation();_udExpand(\''+uid+'\')" title="نمایش همه" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:0 2px;line-height:1;margin-right:2px">⛶</button>';
  var html='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;min-width:0">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    +'<span style="font-size:12px;font-weight:700;color:var(--text-primary)">'+title+'</span>'
    +expandBtn+'</div>';
  if(!items.length){
    html+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:10px 0">'+emptyMsg+'</div>';
  } else {
    html+='<div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto">';
    items.slice(0,8).forEach(function(it){html+=renderItem(it);});
    if(items.length>8)html+='<div onclick="_udExpand(\''+uid+'\')" style="font-size:10px;color:#0ea5e9;text-align:center;padding:4px;cursor:pointer;border-radius:4px;background:var(--bg-raised)">▼ و '+(items.length-8)+' مورد دیگر — کلیک برای نمایش همه</div>';
    html+='</div>';
  }
  html+='</div>';
  return html;
}
function _dashCenterItem(it,dateColor,showMgrBtn){
  var potColor=it.pot<=1?'#ef4444':it.pot<=2?'#f59e0b':it.pot<=3?'#b45309':'#16a34a';
  var rk=it.rtype+'_'+it.id;var sn=(it.name||'').replace(/'/g,'&#39;');
  var mgrBtn='';
  if(showMgrBtn&&_isManager()){
    var isAssigned=!!(DB.managerTasks&&DB.managerTasks[rk]&&!DB.managerTasks[rk].done);
    mgrBtn='<button onclick="event.stopPropagation();mgrOpenAssign(\''+rk+'\',\''+it.rtype+'\',\''+it.id+'\',\''+sn+'\')" style="background:'+(isAssigned?'#fef9c3':'var(--bg-card)')+';color:#92400e;border:1px solid '+(isAssigned?'#fde68a':'var(--border)')+';border-radius:4px;font-size:10px;padding:1px 5px;cursor:pointer;font-family:inherit;flex-shrink:0;margin-right:3px">📌</button>';
  }
  return '<div onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:5px 7px;background:var(--bg-raised);border-radius:5px;cursor:pointer;font-size:11px;border:1px solid var(--border)">'
    +'<div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1">'
    +'<span style="font-size:9px;font-weight:700;color:'+potColor+';flex-shrink:0">P'+it.pot+'</span>'
    +'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary)">'+esc(it.name)+'</span>'
    +'</div>'
    +(it.fd?'<span style="font-size:10px;color:'+dateColor+';flex-shrink:0;margin-right:4px">'+it.fd+'</span>':'')
    +mgrBtn+'</div>';
}

// ════════════════════════ MANAGER PANELS ════════════════════════
function _renderManagerUserPanel(el){
  if(!el)return;
  ensureKPIDB();
  var today=todayStr();
  var month=currentJMonth();
  var mb=jMonthBounds(month);
  var wpWeekId=wpCurrentWeekId?wpCurrentWeekId():'';
  var EXPERTS=Object.keys(USERS).filter(function(uid){return uid!=='guest'&&USERS[uid];});

  var expData={};
  EXPERTS.forEach(function(uid){expData[uid]={uid:uid,name:USERS[uid],wpPlanned:0,wpDone:0,overdue:0,contracts:0};});

  // week plan per expert
  if(wpWeekId){
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      if(!k.startsWith(wpWeekId+':::'))return;
      var we=DB.weekEntries[k];
      var rk=we.recKey||(we.rtype+'_'+we.rid);
      var owner=(_getOwnerForRecKey?_getOwnerForRecKey(rk):'')||we.addedBy||'';
      if(!owner||!expData[owner])return;
      expData[owner].wpPlanned++;
      if(we.done)expData[owner].wpDone++;
    });
  }

  // overdue and contracts per expert
  Object.keys(DB.edits||{}).forEach(function(k){
    var e=DB.edits[k];var ow=e.owner||'';if(!ow||!expData[ow])return;
    var st=e.status||'';
    if(st!=='قرارداد بسته شد'&&st!=='غیرفعال'){
      var fd=e.followupDate||'';if(fd&&fd<today)expData[ow].overdue++;
    }
  });
  // contracts this month from salesLog
  (DB.salesLog||[]).forEach(function(l){
    if(!l.date||!l.userId||!expData[l.userId])return;
    if(l.date.slice(0,7)===month)expData[l.userId].contracts++;
  });
  // auto-conversions: edits whose _statusChangedTs is this month
  Object.keys(DB.edits||{}).forEach(function(k){
    var e=DB.edits[k];
    if(e.status!=='قرارداد بسته شد')return;
    var ts=e._statusChangedTs||0;if(!ts||ts<mb.startTs||ts>mb.endTs)return;
    var owner=e.owner||(_getOwnerForRecKey?_getOwnerForRecKey(k):'')||'';
    if(expData[owner])expData[owner].contracts++;
  });

  var totalPlanned=EXPERTS.reduce(function(s,u){return s+expData[u].wpPlanned;},0);
  var totalDone=EXPERTS.reduce(function(s,u){return s+expData[u].wpDone;},0);
  var totalOverdue=EXPERTS.reduce(function(s,u){return s+expData[u].overdue;},0);
  var teamPct=totalPlanned>0?Math.round(totalDone/totalPlanned*100):0;
  var teamColor=teamPct>=70?'#16a34a':teamPct>=40?'#d97706':'#dc2626';

  var html='<div style="background:linear-gradient(135deg,#fef3c7 0%,#fff7ed 100%);border:1px solid #fcd34d;border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:800;color:#92400e">📊 وضعیت تیم این هفته</div>'
    +'<div style="display:flex;gap:12px;font-size:11px;align-items:center">'
    +'<span style="color:#0369a1">برنامه: <strong>'+totalPlanned+'</strong></span>'
    +'<span style="color:#16a34a">انجام: <strong>'+totalDone+'</strong></span>'
    +(totalOverdue?'<span style="color:#dc2626">معوق: <strong>'+totalOverdue+'</strong></span>':'')
    +'<span style="font-size:13px;font-weight:800;color:'+teamColor+'">'+teamPct+'٪</span>'
    +'</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px">';

  EXPERTS.forEach(function(uid){
    var d=expData[uid];
    var pct=d.wpPlanned>0?Math.round(d.wpDone/d.wpPlanned*100):0;
    var bc=pct>=70?'#22c55e':pct>=40?'#f59e0b':'#94a3b8';
    html+='<div style="background:var(--bg-card);border:1px solid '+(d.overdue?'#fca5a5':'var(--border)')+';border-radius:8px;padding:10px 12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
      +'<span style="font-size:12px;font-weight:700;color:var(--text-primary)">'+esc(d.name)+'</span>'
      +'<span style="font-size:11px;font-weight:800;color:'+bc+'">'+pct+'٪</span>'
      +'</div>'
      +_dashPbar(pct,bc,7)
      +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:10px">'
      +'<span style="color:var(--text-muted)">📅 '+d.wpDone+'/'+d.wpPlanned+'</span>'
      +(d.overdue?'<span style="color:#dc2626;font-weight:700">⚠ '+d.overdue+' معوق</span>':'<span style="color:#16a34a">✓ بدون معوق</span>')
      +(d.contracts?'<span style="color:#16a34a">📝 '+d.contracts+' قرارداد</span>':'')
      +'</div></div>';
  });

  html+='</div></div>';
  el.innerHTML=html;
}

function _renderManagerDash(el){
  if(!el)return;
  ensureKPIDB();_buildPCCache();
  var today=todayStr();
  var EXPERTS=Object.keys(USERS).filter(function(uid){return uid!=='guest'&&USERS[uid];});
  var statusCounts={};
  var ownerStats={};
  EXPERTS.forEach(function(uid){
    ownerStats[uid]={uid:uid,name:USERS[uid],contracts:0,meetings:0,overdue:0,total:0,overdueItems:[]};
  });

  Object.keys(DB.edits||{}).forEach(function(k){
    var e=DB.edits[k];var st=e.status||'بدون تماس';
    statusCounts[st]=(statusCounts[st]||0)+1;
    var ow=e.owner||'';
    if(ow&&ownerStats[ow]){
      ownerStats[ow].total++;
      if(st==='قرارداد بسته شد')ownerStats[ow].contracts++;
      if(st==='ملاقات انجام شد')ownerStats[ow].meetings++;
      var fd=e.followupDate||'';
      if(fd&&fd<today&&st!=='قرارداد بسته شد'&&st!=='غیرفعال'){
        ownerStats[ow].overdue++;
        ownerStats[ow].overdueItems.push({recKey:k,fd:fd,name:getRecLabel(k)});
      }
    }
  });
  EXPERTS.forEach(function(uid){
    var s=ownerStats[uid];
    if(s.overdueItems.length)s.overdueItems.sort(function(a,b){return a.fd<b.fd?-1:1;});
  });

  var PIPELINE=STATUS_LIST.map(function(st){var m=_PIPELINE_META[st]||{ic:'▪',c:'#94a3b8'};return{st:st,ic:m.ic,c:m.c};});
  var pipelineTotal=Object.values(statusCounts).reduce(function(s,v){return s+v;},0)||1;
  var contracted=statusCounts['قرارداد بسته شد']||0;
  var overdueTotal=EXPERTS.reduce(function(s,u){return s+ownerStats[u].overdue;},0);
  var totalActive=Object.values(DB.edits||{}).filter(function(e){return e.status&&e.status!=='غیرفعال';}).length;
  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0)+(DB.extra||[]).length;
  var _pipelineActive=0;
  STATUS_LIST.forEach(function(st){if(st!=='بدون تماس'&&st!=='غیرفعال'&&st!=='قرارداد بسته شد')_pipelineActive+=statusCounts[st]||0;});
  var _convBase=contracted+_pipelineActive;var _convRate=_convBase>0?Math.round(contracted/_convBase*100):0;

  // مراکز در خطر: P3/P4 با followupDate قدیمی‌تر از ۲۱ روز یا بدون تاریخ
  var atRisk=[];
  var _cutoffTs=Date.now()-21*24*3600*1000;
  var _cutoffStr=msToJ(_cutoffTs);
  var validK=_getAllValidRecKeys?_getAllValidRecKeys():new Set();
  Object.keys(DB.edits||{}).forEach(function(k){
    if(validK.size&&!validK.has(k))return;
    var e=DB.edits[k];var st=e.status||'بدون تماس';
    if(st==='قرارداد بسته شد'||st==='غیرفعال')return;
    var pot=parseInt(e.potential||1);if(pot>2)return;
    var fd=e.followupDate||'';
    if(fd&&fd>=_cutoffStr)return; // has a recent followup date — OK
    var pts=k.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
    atRisk.push({recKey:k,rtype:tp,id:id,name:getRecLabel(k),pot:pot,fd:fd,owner:e.owner||''});
  });
  atRisk.sort(function(a,b){return b.pot-a.pot||(!a.fd&&b.fd?-1:a.fd&&!b.fd?1:a.fd<b.fd?-1:1);});

  // وظایف ارجاع‌شده
  var pendingTasks=[];var doneTasks=[];
  Object.keys(DB.managerTasks||{}).forEach(function(k){
    var t=DB.managerTasks[k];
    var item={recKey:k,name:t.name,rtype:t.rtype,id:t.id,assignedTo:t.assignedTo,note:t.note,assignedAt:t.assignedAt,doneAt:t.doneAt||''};
    if(t.done)doneTasks.push(item);else pendingTasks.push(item);
  });
  pendingTasks.sort(function(a,b){return a.assignedAt>b.assignedAt?1:-1;});
  doneTasks.sort(function(a,b){return a.doneAt>b.doneAt?-1:1;});

  // ── ردیف ۱: آمار کلی ──
  var R1='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">';
  R1+=_dashKpiCard(totalCenters,'کل مراکز','🏥','#0ea5e9','در '+getAllProvinces().length+' استان');
  R1+=_dashKpiCard(totalActive,'مراکز فعال','📞','#f59e0b','از کل مراکز');
  R1+=_dashKpiCard(overdueTotal,'پیگیری معوق','🔴','#ef4444',EXPERTS.filter(function(u){return ownerStats[u].overdue>0;}).length+' کارشناس');
  R1+=_dashKpiCard(contracted,'قرارداد بسته','✅','#22c55e',_convRate+'٪ نرخ تبدیل');
  R1+='</div>';

  // ── ردیف ۲: معوقات per expert + مراکز در خطر ──
  var R2='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';

  // معوقات به تفکیک کارشناس
  var sortedExp=EXPERTS.slice().sort(function(a,b){return ownerStats[b].overdue-ownerStats[a].overdue;});
  R2+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">🔴 معوقات به تفکیک کارشناس'
    +(overdueTotal?' '+_dashBadge(overdueTotal,'#ef4444','#fff'):'')
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">';
  sortedExp.forEach(function(uid){
    var s=ownerStats[uid];
    var oldest=s.overdueItems.length?s.overdueItems[0]:null;
    var rkParts=oldest?oldest.recKey.split('_'):[];
    var oldRt=rkParts[0]||'';var oldId=rkParts.slice(1).join('_')||'';
    R2+='<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:var(--bg-raised);border-radius:7px;border:1px solid '+(s.overdue?'#fca5a5':'var(--border)')+'">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:12px;font-weight:600;color:var(--text-primary)">'+esc(s.name)+'</div>'
      +(oldest?'<div style="font-size:10px;color:#dc2626;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openCenterModal(\''+oldRt+'\',\''+oldId+'\')">⏰ '+esc(oldest.name)+' — '+oldest.fd+'</div>':'<div style="font-size:10px;color:#16a34a;margin-top:1px">✓ بدون معوق</div>')
      +'</div>'
      +(s.overdue
        ?'<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;border-radius:8px;padding:2px 9px;flex-shrink:0">'+s.overdue+'</span>'
        :'<span style="color:#94a3b8;font-size:11px">—</span>'
      )+'</div>';
  });
  R2+='</div></div>';

  // مراکز در خطر
  R2+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">⚠ مراکز P1/P2 در خطر'
    +(atRisk.length?' '+_dashBadge(atRisk.length,'#f59e0b','#fff'):'')
    +'</div>';
  if(!atRisk.length){
    R2+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:20px 0">✅ مراکز P1/P2 وضعیت خوبی دارند</div>';
  } else {
    R2+='<div style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">';
    atRisk.slice(0,10).forEach(function(it){
      var potColor=it.pot<=2?'#f59e0b':it.pot===3?'#b45309':'#16a34a';
      R2+='<div onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-raised);border-radius:6px;cursor:pointer;border:1px solid var(--border);font-size:11px">'
        +'<span style="font-size:9px;font-weight:700;color:'+potColor+';flex-shrink:0">P'+it.pot+'</span>'
        +'<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.name)+'</span>'
        +'<span style="flex-shrink:0;font-size:10px;color:var(--text-muted)">'+esc(USERS[it.owner]||it.owner||'—')+'</span>'
        +(it.fd?'<span style="flex-shrink:0;font-size:10px;color:#dc2626">'+it.fd+'</span>':'<span style="flex-shrink:0;font-size:10px;color:#94a3b8">بدون تاریخ</span>')
        +'</div>';
    });
    if(atRisk.length>10)R2+='<div style="text-align:center;font-size:10px;color:var(--text-muted);padding:4px">و '+(atRisk.length-10)+' مرکز دیگر</div>';
    R2+='</div>';
  }
  R2+='</div></div>';

  // ── ردیف ۳: وظایف ارجاع‌شده + pipeline ──
  var R3='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

  // وظایف ارجاع‌شده
  R3+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">📌 وظایف ارجاع‌شده'
    +(pendingTasks.length?' '+_dashBadge(pendingTasks.length,'#f59e0b','#78350f'):'')
    +'</div>';
  if(!pendingTasks.length&&!doneTasks.length){
    R3+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:20px 0">هیچ وظیفه‌ای ارجاع نشده</div>';
  } else {
    R3+='<div style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">';
    pendingTasks.slice(0,5).forEach(function(t){
      R3+='<div style="display:flex;align-items:center;gap:6px;padding:7px 9px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px">'
        +'<div onclick="openCenterModal(\''+t.rtype+'\',\''+t.id+'\')" style="flex:1;cursor:pointer;min-width:0">'
        +'<div style="font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(t.name)+'</div>'
        +'<div style="color:#92400e;font-size:10px">'+esc(USERS[t.assignedTo]||t.assignedTo||'')+(t.note?' — '+esc(t.note):'')+'</div>'
        +'</div>'
        +'<span style="background:#fef3c7;color:#78350f;border-radius:8px;padding:2px 8px;font-size:10px;white-space:nowrap;flex-shrink:0">در انتظار</span>'
        +'</div>';
    });
    doneTasks.slice(0,3).forEach(function(t){
      R3+='<div style="display:flex;align-items:center;gap:6px;padding:6px 9px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;opacity:.75">'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:600;color:#166534;text-decoration:line-through;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(t.name)+'</div>'
        +'<div style="color:#16a34a;font-size:10px">✅ '+esc(USERS[t.assignedTo]||t.assignedTo||'')+'</div>'
        +'</div>'
        +'<span style="background:#dcfce7;color:#166534;border-radius:8px;padding:2px 8px;font-size:10px;white-space:nowrap;flex-shrink:0">انجام شد</span>'
        +'</div>';
    });
    R3+='</div>';
  }
  R3+='</div>';

  // pipeline
  R3+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px">🔄 وضعیت پایپ‌لاین</div>'
    +'<div style="display:flex;flex-direction:column;gap:7px">';
  PIPELINE.forEach(function(p){
    var cnt=statusCounts[p.st]||0;
    var pct=Math.round(cnt/pipelineTotal*100);
    R3+='<div>'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
      +'<span>'+p.ic+' '+p.st+'</span>'
      +'<span style="font-weight:700;color:var(--text-primary)">'+cnt+(pct>0?' <span style="font-size:10px;color:'+p.c+'">'+pct+'%</span>':'')+'</span>'
      +'</div>'
      +_dashPbar(Math.max(cnt?4:0,pct),p.c,6)
      +'</div>';
  });
  R3+='</div></div></div>';

  el.innerHTML=R1+R2+R3;
}

// ════════════════════════ EXPERT PANELS ════════════════════════
function _renderExpertUserPanel(el){
  if(!el)return;
  ensureKPIDB();_buildPCCache();
  var today=todayStr();
  var uname=USERS[currentUser]||currentUser;
  var wb=currentWeekBounds();
  var month=currentJMonth();

  // ── KPI این هفته ──
  var callsWeek=0;
  (DB.callLog||[]).forEach(function(l){
    if(l.userId!==currentUser)return;
    var ts=l.date?dateStrToTs(l.date):0;if(!ts)return;
    if(ts>=wb.startTs&&ts<=wb.endTs)callsWeek+=parseInt(l.count)||1;
  });
  Object.values(DB.weekEntries||{}).forEach(function(we){
    if(!we.done||we.actionType==='visit'||!we.doneDate)return;
    var ts=dateStrToTs(we.doneDate);if(!ts||ts<wb.startTs||ts>wb.endTs)return;
    var owner=(_getOwnerForRecKey?_getOwnerForRecKey(we.recKey||''):'')||we.addedBy||'';
    if(owner===currentUser)callsWeek++;
  });

  var visitsWeek=0;
  (DB.visitLog||[]).forEach(function(l){
    if(l.userId!==currentUser)return;
    var ts=l.date?dateStrToTs(l.date):0;if(!ts)return;
    if(ts>=wb.startTs&&ts<=wb.endTs)visitsWeek+=parseInt(l.count)||1;
  });
  Object.values(DB.weekEntries||{}).forEach(function(we){
    if(!we.done||we.actionType!=='visit'||!we.doneDate)return;
    var ts=dateStrToTs(we.doneDate);if(!ts||ts<wb.startTs||ts>wb.endTs)return;
    var owner=(_getOwnerForRecKey?_getOwnerForRecKey(we.recKey||''):'')||we.addedBy||'';
    if(owner===currentUser)visitsWeek++;
  });

  var contractsMonth=(getSalesMonth(currentUser,month)||[]).length+(getAutoConversions?getAutoConversions(currentUser,month):0);
  var kpiT=getKPITarget(currentUser,month);
  var callTarget=(kpiT.callsPerDay||10)*5;
  var visitTarget=kpiT.visitsPerWeek||5;
  var contractTarget=kpiT.salesCount||5;
  var callPct=callTarget>0?Math.round(callsWeek/callTarget*100):0;
  var visitPct=visitTarget>0?Math.round(visitsWeek/visitTarget*100):0;
  var contractPct=contractTarget>0?Math.round(contractsMonth/contractTarget*100):0;

  // ── برنامه امروز ──
  var wpWeekId=wpCurrentWeekId?wpCurrentWeekId():'';
  var todayItems=[];
  if(wpWeekId){
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      if(!k.startsWith(wpWeekId+':::'))return;
      var we=DB.weekEntries[k];
      if(we.scheduledDate!==today)return;
      var rk=we.recKey||(we.rtype&&we.rid?we.rtype+'_'+we.rid:'');if(!rk)return;
      var owner=(_getOwnerForRecKey?_getOwnerForRecKey(rk):'')||we.addedBy||'';
      if(owner!==currentUser)return;
      var pts=rk.split('_');
      todayItems.push({name:we.centerName||getRecLabel(rk)||'',done:we.done,actionType:we.actionType||'call',rtype:pts[0],id:pts.slice(1).join('_')});
    });
  }

  // ── pipeline شخصی ──
  var myCounts={};STATUS_LIST.forEach(function(st){myCounts[st]=0;});
  Object.keys(DB.edits||{}).forEach(function(k){
    var e=DB.edits[k];
    if((e.owner||'')!==currentUser)return;
    var st=e.status||'بدون تماس';
    myCounts[st]=(myCounts[st]||0)+1;
  });
  var myTotal=Object.values(myCounts).reduce(function(s,v){return s+v;},0)||1;

  // ── وظایف از مدیر ──
  var myTasks=[];
  Object.keys(DB.managerTasks||{}).forEach(function(k){
    var t=DB.managerTasks[k];
    if(t.done||t.assignedTo!==currentUser)return;
    myTasks.push({recKey:k,rtype:t.rtype,id:t.id,name:t.name,note:t.note,assignedAt:t.assignedAt});
  });
  myTasks.sort(function(a,b){return a.assignedAt>b.assignedAt?1:-1;});

  var html='<div style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin-bottom:14px">';
  html+='<div style="font-size:13px;font-weight:800;color:#1e40af;margin-bottom:12px">📈 عملکرد من — '+esc(uname)+'</div>';

  // وظایف مدیر
  if(myTasks.length){
    html+='<div style="background:#fffbeb;border:2px solid #fde68a;border-radius:8px;padding:10px 12px;margin-bottom:12px">'
      +'<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:7px">📌 وظایف ویژه از مدیر '+_dashBadge(myTasks.length,'#dc2626','#fff')+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto">';
    myTasks.slice(0,5).forEach(function(t){
      html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg-card);border:1px solid #fde68a;border-radius:5px">'
        +'<div onclick="openCenterModal(\''+t.rtype+'\',\''+t.id+'\')" style="flex:1;cursor:pointer;min-width:0">'
        +'<span style="font-weight:600;font-size:11px">'+esc(t.name)+'</span>'
        +(t.note?'<span style="font-size:10px;color:#92400e;margin-right:5px"> — '+esc(t.note)+'</span>':'')
        +'</div>'
        +'<button onclick="mgrDoneTask(\''+t.recKey+'\')" style="background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:4px;font-size:10px;padding:2px 7px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">✅ انجام شد</button>'
        +'</div>';
    });
    if(myTasks.length>5)html+='<div style="text-align:center;font-size:10px;color:var(--text-muted);padding:3px">و '+(myTasks.length-5)+' مورد دیگر</div>';
    html+='</div></div>';
  }

  // KPI ردیف
  html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
  html+=_dashKpiCard(callsWeek,'تماس این هفته','📞','#0ea5e9','هدف: '+callTarget,callPct);
  html+=_dashKpiCard(visitsWeek,'ویزیت این هفته','🚗','#8b5cf6','هدف: '+visitTarget,visitPct);
  html+=_dashKpiCard(contractsMonth,'قرارداد این ماه','✅','#22c55e','هدف: '+contractTarget,contractPct);
  html+='</div>';

  // برنامه امروز + pipeline
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  // برنامه امروز
  html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">📅 برنامه امروز'
    +(todayItems.length?' '+_dashBadge(todayItems.length,'#0ea5e9','#fff'):'')
    +'</div>';
  if(!todayItems.length){
    html+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:12px 0">برنامه‌ای برای امروز ندارید</div>';
  } else {
    html+='<div style="display:flex;flex-direction:column;gap:4px;max-height:130px;overflow-y:auto">';
    todayItems.forEach(function(it){
      var ic=it.actionType==='visit'?'🚗':'📞';
      html+='<div onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:'+(it.done?'#f0fdf4':'var(--bg-raised)')+';border-radius:5px;cursor:pointer;border:1px solid '+(it.done?'#bbf7d0':'var(--border)')+';font-size:11px">'
        +'<span>'+(it.done?'✅':ic)+'</span>'
        +'<span style="flex:1;'+(it.done?'text-decoration:line-through;opacity:.7':'')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.name)+'</span>'
        +'</div>';
    });
    html+='</div>';
  }
  html+='</div>';

  // pipeline شخصی
  html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">🔄 پایپ‌لاین من</div>'
    +'<div style="display:flex;flex-direction:column;gap:5px">';
  STATUS_LIST.forEach(function(st){
    var cnt=myCounts[st]||0;if(!cnt)return;
    var m=_PIPELINE_META[st]||{ic:'▪',c:'#94a3b8'};
    var pct=Math.round(cnt/myTotal*100);
    html+='<div><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">'
      +'<span>'+m.ic+' '+st+'</span><span style="font-weight:700">'+cnt+'</span></div>'
      +_dashPbar(Math.max(cnt?3:0,pct),m.c,5)+'</div>';
  });
  html+='</div></div></div>';

  html+='</div>'; // outer wrapper
  el.innerHTML=html;
}


function openPreCallBrief(rtype,rid){
  _buildPCCache();
  var r=null;
  if(rtype==='center'){r=(CENTERS||[]).find(function(c){return c.id===rid;});}
  else{Object.keys(_PC_CACHE||{}).forEach(function(pv){(_PC_CACHE[pv]||[]).forEach(function(c){if(c.id===rid)r=c;});});}
  if(!r)(DB.extra||[]).forEach(function(c){if(c.id===rid)r=c;});
  if(!r)r={id:rid,name:rid};
  var e=getE(rtype,rid);
  var rkey=rtype+'_'+rid;
  var notes=(DB.notes[rkey]||[]).slice(0,5);
  var hist=(DB.changeLog||[]).filter(function(h){return h.rkey===rkey;}).slice(-5).reverse();
  var td=todayStr();
  var body='<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px">📍 اطلاعات کلی</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">'
    +'<div><span style="color:var(--text-muted)">وضعیت: </span><strong>'+(e.status||'بدون تماس')+'</strong></div>'
    +'<div><span style="color:var(--text-muted)">پتانسیل: </span><strong>P'+(e.potential||r.potential||'؟')+'</strong></div>'
    +'<div><span style="color:var(--text-muted)">پیگیری: </span><strong style="color:'+((e.followupDate&&e.followupDate<td)?'#dc2626':'#16a34a')+'">'+( e.followupDate||'—')+'</strong></div>'
    +'<div><span style="color:var(--text-muted)">رقیب: </span><strong>'+(e.competitor||'ثبت نشده')+'</strong></div>'
    +'</div>'+(e.address?'<div style="margin-top:6px;font-size:11px"><span style="color:var(--text-muted)">آدرس: </span>'+esc(e.address)+'</div>':'')+'</div>';
  if(notes.length){
    body+='<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">'
      +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px">📝 آخرین یادداشت‌ها</div>';
    notes.forEach(function(n){
      var ds;if(n.date){ds=n.date;}else if(n.at){var _nd=new Date(n.at);var _jd=g2j(_nd.getFullYear(),_nd.getMonth()+1,_nd.getDate());ds=_jd[0]+'/'+p2(_jd[1])+'/'+p2(_jd[2]);}else{ds='';}
      body+='<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">'
        +'<span style="color:var(--text-muted);font-size:10px">'+ds+' &middot; '+esc(n.by||n.user||'')+'</span>'
        +'<div style="margin-top:2px">'+esc((n.text||'').substring(0,150))+'</div></div>';
    });
    body+='</div>';
  }
  if(hist.length){
    body+='<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">'
      +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px">🔄 آخرین تغییرات</div>';
    hist.forEach(function(h){
      var d=new Date(h.at||'');var jd=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      var ds=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
      body+='<div style="font-size:10.5px;color:var(--text-muted);padding:3px 0;border-bottom:1px solid var(--border)">'
        +'<span style="color:var(--text-secondary)">'+esc(h.field)+'</span>'
        +' ← '+esc(String(h.val||'—').substring(0,30))
        +' <span style="opacity:.6">'+esc(h.by||'')+' &middot; '+ds+'</span></div>';
    });
    body+='</div>';
  }
  body+='</div>';
  var _pcbId='pcb_'+rid;
  var foot='<button class="btn-secondary" onclick="closeModal(\''+_pcbId+'\')">بستن</button>'
    +'<button class="btn-primary" onclick="closeModal(\''+_pcbId+'\');quickCallLog(\''+rtype+'\',\''+rid+'\',\''+esc(r.name||rid)+'\')">📞 ثبت تماس</button>';
  openModal(_pcbId,'🎯 پیش از تماس — '+esc(r.name||rid),body,foot,{lg:true});
}

var _QCL_TPLS=['علاقه‌مند به بررسی محصول — پیگیری بعدی تعیین شد','نیاز به بررسی بیشتر — ارسال بروشور درخواست شد','پاسخگو نبود — پیگیری مجدد لازم است','ویزیت انجام شد — نتیجه مثبت / منتظر تصمیم نهایی'];
function _qclTemplate(i){var el=document.getElementById('qcl_note');if(el){var t=_QCL_TPLS[i]||'';el.value=(el.value?el.value+'\n':'')+t;el.focus();}}
function quickCallLog(rtype,rid,centerName){
  var id='qcl_'+rid;
  var e=getE(rtype,rid);
  var body='<div style="display:flex;flex-direction:column;gap:10px">'
    +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📊 نتیجه تماس</label>'
    +'<select id="qcl_result" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'
    +'<option value="">-- انتخاب --</option>'
    +'<option>تماس موفق - علاقه‌مند</option>'
    +'<option>تماس موفق - بی‌علاقه</option>'
    +'<option>قرار ویزیت گذاشته شد</option>'
    +'<option>پیگیری بعدی لازم است</option>'
    +'<option>عدم پاسخگویی</option>'
    +'<option>مشغول / بعداً تماس</option>'
    +'</select></div>'
    +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📝 یادداشت سریع</label>'
    +'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px">'
    +'<button type="button" onclick="_qclTemplate(0)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">✅ علاقه‌مند</button>'
    +'<button type="button" onclick="_qclTemplate(1)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">📄 ارسال بروشور</button>'
    +'<button type="button" onclick="_qclTemplate(2)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">📵 عدم پاسخ</button>'
    +'<button type="button" onclick="_qclTemplate(3)" style="font-size:10px;padding:3px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-family:inherit;color:var(--text-primary)">🤝 پس از ویزیت</button>'
    +'</div>'
    +'<textarea id="qcl_note" rows="3" placeholder="خلاصه مکالمه..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;background:var(--bg-input);color:var(--text-primary)"></textarea></div>'
    +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📅 پیگیری بعدی</label>'
    +'<input type="text" id="qcl_fd" readonly placeholder="انتخاب تاریخ..." onclick="openJDP(this,function(v){document.getElementById(\'qcl_fd\').value=v;})" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer;background:var(--bg-input);color:var(--text-primary)" value="'+esc(e.followupDate||'')+'">'
    +'</div></div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\''+id+'\')">لغو</button>'
    +'<button class="btn-primary" onclick="_submitQCL(\''+rtype+'\',\''+rid+'\',\''+id+'\')">ثبت تماس</button>';
  openModal(id,'📞 ثبت سریع — '+esc(centerName),body,foot);
}
function _submitQCL(rtype,rid,modalId){
  var result=((document.getElementById('qcl_result')||{}).value||'');
  var note=((document.getElementById('qcl_note')||{}).value||'').trim();
  var fd=((document.getElementById('qcl_fd')||{}).value||'');
  if(!result&&!note){showToast('نتیجه یا یادداشت را وارد کنید');return;}
  var txt=(result?'نتیجه: '+result+(note?'\n'+note:''):note);
  if(txt){
    if(!DB.notes[rtype+'_'+rid])DB.notes[rtype+'_'+rid]=[];
    DB.notes[rtype+'_'+rid].unshift({text:txt,by:currentUser,at:new Date().toISOString(),tags:[]});
  }
  if(fd)setE(rtype,rid,'followupDate',fd);
  saveDB();closeModal(modalId);showToast('✓ تماس ثبت شد');
}
function _renderExpertDash(el){
  if(!el)return;
  _buildPCCache();
  var today=todayStr();
  _dashSectionUidCounter=0;

  // ── جمع‌آوری مراکز کارشناس ──
  var myOverdue=[],myNoDate=[],myUpcoming=[],myRecommended=[],myWeekNoDate=[],myTodayEntries=[];

  function _collectCenters(arr,rtype){
    arr.forEach(function(r){
      var e=getE(rtype,r.id);
      if((e.owner||r.owner||'')!==currentUser)return;
      var st=e.status||'بدون تماس';
      if(st==='غیرفعال'||st==='قرارداد بسته شد')return;
      var fd=e.followupDate||'';
      var pot=parseInt(e.potential!==undefined?e.potential:r.potential||1);
      var item={rtype:rtype,id:r.id,name:r.name,pot:pot,status:st,fd:fd};
      if(!fd)myNoDate.push(item);
      else if(fd<today)myOverdue.push(item);
      else myUpcoming.push(item);
      if(pot<=2&&!e._lastActivity)myRecommended.push(item);
    });
  }
  _collectCenters(CENTERS,'center');
  Object.keys(_PC_CACHE||{}).forEach(function(pv){
    if(pv==='tehran')return;
    (_PC_CACHE[pv]||[]).forEach(function(r){_collectCenters([r],'pc');});
  });
  var _mainIds=new Set(CENTERS.map(function(c){return c.id;}));
  (DB.extra||[]).forEach(function(r){
    var rt=r.province_id==='tehran'?'center':'pc';
    if(rt==='center'&&_mainIds.has(r.id))return;
    _collectCenters([r],rt);
  });
  myOverdue.sort(function(a,b){return a.fd<b.fd?1:-1;});
  myUpcoming.sort(function(a,b){return a.fd>b.fd?1:-1;});
  myRecommended.sort(function(a,b){return a.pot-b.pot;});

  // مراکز در هفته بدون تاریخ
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we||we.scheduledDate||we.done)return;
    var rt=we.rtype||'';var ri=we.rid||'';if(!rt||!ri)return;
    if((getE(rt,ri).owner||'')!==currentUser)return;
    var parsed=wpParseEntryKey(k);
    myWeekNoDate.push({rtype:rt,id:ri,name:we.centerName||getRecLabel(rt+'_'+ri)||ri,weekId:parsed.weekId||'',eKey:k});
  });
  myWeekNoDate.sort(function(a,b){return a.weekId>b.weekId?-1:1;});

  // امروز من - مراکز برنامه‌ریزی‌شده برای امروز
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];if(!we||we.done)return;
    var rt=we.rtype||'';var ri=we.rid||'';if(!rt||!ri)return;
    var ownr=typeof _wpGetOwner==='function'?_wpGetOwner(we):(getE(rt,ri).owner||'');
    if(ownr!==currentUser)return;
    if(we.scheduledDate!==today)return;
    myTodayEntries.push({rtype:rt,id:ri,name:we.centerName||ri,actType:we.actionType||'call',eKey:k});
  });

  // مطالبات
  var myMtr=[];
  if(typeof DATA!=='undefined'&&DATA&&DATA.length){
    DATA.forEach(function(row){
      var member=(typeof mtrFindMember==='function')?mtrFindMember(row.follower):null;
      if(!member||(member.id!==currentUser&&member.name!==currentUser))return;
      var rem=parseFloat(row.remaining)||0;
      if(rem>0)myMtr.push({customer:row.customer||'—',invoice:row.invoice||'',rem:rem,od:parseFloat(row.overdue)||0});
    });
    myMtr.sort(function(a,b){return b.od-a.od;});
  }

  // ── اولویت‌بندی هوشمند ──
  var _smartPriority=(function(){
    var today2=todayStr();
    var scored=[];
    var _allItems=myOverdue.concat(myNoDate).concat(myUpcoming);
    _allItems.forEach(function(item){
      var e=getE(item.rtype,item.id);
      var potScore=(5-parseInt(item.pot||4))*20; // P1=80, P2=60, P3=40, P4=20
      var daysOver=0;
      if(item.fd&&item.fd<today2){
        var diff=Math.round((new Date()-new Date(item.fd.split('/').join('-')))/86400000);
        daysOver=Math.min(diff,60);
      } else if(!item.fd){
        daysOver=30; // no date = treat as somewhat overdue
      }
      var stScore={'بدون تماس':5,'تماس اولیه':10,'ملاقات انجام شد':15,'پیشنهاد ارسال شد':20}[item.status]||5;
      var score=potScore+daysOver*0.5+stScore;
      scored.push({item:item,score:score});
    });
    scored.sort(function(a,b){return b.score-a.score;});
    return scored.slice(0,5).map(function(x){return x.item;});
  })();

  var sections='';

  if(myTodayEntries.length){
    var _tHtml='<div style="grid-column:1/-1;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1.5px solid #38bdf8;border-radius:10px;padding:10px 14px">'
      +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px">☀️ امروز من ('+myTodayEntries.length+')'
      +'</div><div style="display:flex;flex-direction:column;gap:5px">';
    myTodayEntries.forEach(function(it){
      var ic=it.actType==='visit'?'🤝':'📞';
      _tHtml+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#fff;border-radius:6px;border:1px solid #bae6fd">'
        +'<button onclick="openCenterModal(\''+esc(it.rtype)+'\',\''+esc(it.id)+'\')" style="background:none;border:none;cursor:pointer;font-size:11px;font-weight:600;color:#0369a1;padding:0;text-align:right">'+esc(it.name)+'</button>'
        +'<div style="display:flex;gap:4px;align-items:center">'
        +'<span style="font-size:10px;background:#e0f2fe;padding:1px 6px;border-radius:5px">'+ic+'</span>'
        +'<button onclick="quickCallLog(\''+esc(it.rtype)+'\',\''+esc(it.id)+'\',\''+esc(it.name)+'\')" style="background:#0ea5e9;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:inherit">ثبت نتیجه</button>'
        +'</div></div>';
    });
    _tHtml+='</div></div>';
    sections+=_tHtml;
  }

  if(_smartPriority.length){
    var _spHtml='<div class="dash-section" style="background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1.5px solid #d8b4fe">'
      +'<div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:8px">🎯 امروز پیگیری کن ('+_smartPriority.length+')</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px">';
    _smartPriority.forEach(function(it){
      var _sc=parseInt(it.pot||4);
      var _fd=it.fd||'';
      var _ov=_fd&&_fd<today?'🔴 ':(!_fd?'⚪ ':'🟡 ');
      _spHtml+='<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;background:rgba(255,255,255,.7);border-radius:6px">'
        +'<span style="font-size:10px;background:#ede9fe;color:#7c3aed;border-radius:5px;padding:1px 5px;flex-shrink:0">P'+_sc+'</span>'
        +'<span style="'+(_ov==='🔴 '?'color:#dc2626;':'')+'font-weight:600;flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_ov+esc(it.name)+'</span>'
        +(_fd?'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+_fd+'</span>':'')
        +'<button onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="font-size:10px;background:#7c3aed;color:#fff;border:none;border-radius:5px;padding:2px 8px;cursor:pointer;font-family:inherit;flex-shrink:0">باز کن</button>'
        +'</div>';
    });
    _spHtml+='</div></div>';
    sections+=_spHtml;
  }
  sections+=_dashSectionCard(
    '🔴 پیگیری معوق ('+myOverdue.length+')',myOverdue,
    '✅ پیگیری معوقی ندارید',
    function(it){return _dashCenterItem(it,'#dc2626',false);}
  );
  sections+=_dashSectionCard(
    '📋 بدون تاریخ ('+myNoDate.length+')',myNoDate,
    '✅ همه مراکز تاریخ دارند',
    function(it){return _dashCenterItem(it,'#94a3b8',false);}
  );
  sections+=_dashSectionCard(
    '📅 برنامه آینده ('+myUpcoming.length+')',myUpcoming,
    'هیچ ویزیتی برنامه‌ریزی نشده',
    function(it){return _dashCenterItem(it,'#0369a1',false);}
  );
  sections+=_dashSectionCard(
    '⭐ مراکز پیشنهادی ('+myRecommended.length+')',myRecommended,
    'مرکز پیشنهادی وجود ندارد',
    function(it){return _dashCenterItem(it,'#94a3b8',false);}
  );
  sections+=_dashSectionCard(
    '📆 در هفته — بدون تاریخ ('+myWeekNoDate.length+')',myWeekNoDate,
    '✅ همه مراکز هفته‌بندی‌شده تاریخ دارند',
    function(it){
      return '<div onclick="openCenterModal(\''+esc(it.rtype)+'\',\''+esc(it.id)+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:5px 7px;background:var(--bg-raised);border-radius:5px;font-size:11px;border:1px solid var(--border);cursor:pointer">'
        +'<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.name)+'</span>'
        +'<span style="flex-shrink:0;margin-right:6px;color:#b45309;font-weight:600;font-size:10px">'+esc(it.weekId?'هفته '+it.weekId:'—')+'</span>'
        +'</div>';
    }
  );
  if(typeof DATA!=='undefined'){
    sections+=_dashSectionCard(
      '💰 مطالبات ('+myMtr.length+')',myMtr,
      'مطالبات فعالی ندارید',
      function(it){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 7px;background:var(--bg-raised);border-radius:5px;font-size:11px;border:1px solid var(--border)">'
          +'<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.customer)+'</span>'
          +'<span style="flex-shrink:0;color:'+(it.od>0?'#dc2626':'#0369a1')+';font-weight:600">'+Number(it.rem).toLocaleString()+'</span>'
          +'</div>';
      }
    );
  }

  el.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">'+sections+'</div>';
}

// ════════════════════════ MAIN DASHBOARD ENTRY POINTS ══════════════
function renderUserDashboard(){
  var el=document.getElementById('userDashPanel');if(!el)return;
  if(_isManager()){_renderManagerUserPanel(el);}
  else{_renderExpertUserPanel(el);}
}


// ════════════════════════ HOME PANEL ════════════════════════
// Default widgets per role
var _HOME_WIDGETS_EXPERT = ['today','overdue','priority','tasks','recent'];
var _HOME_WIDGETS_MANAGER = ['today','overdue','summary','tasks','recent'];

function _getHomeWidgets(){
  var prefs=(DB.settings&&DB.settings.homeWidgets&&DB.settings.homeWidgets[currentUser]);
  if(prefs&&prefs.length)return prefs;
  return _isManager()?_HOME_WIDGETS_MANAGER.slice():_HOME_WIDGETS_EXPERT.slice();
}

function _saveHomeWidgets(arr){
  if(!DB.settings)DB.settings={};
  if(!DB.settings.homeWidgets)DB.settings.homeWidgets={};
  DB.settings.homeWidgets[currentUser]=arr;
  saveDB();
}

function _homeRemoveWidget(wid){
  var arr=_getHomeWidgets().filter(function(x){return x!==wid;});
  _saveHomeWidgets(arr);
  renderHome();
}

function _homeAddWidget(wid){
  var arr=_getHomeWidgets();
  if(arr.indexOf(wid)<0){arr.push(wid);}
  _saveHomeWidgets(arr);
  renderHome();
}

function _homeOpenAddPanel(){
  var all=[
    {id:'today',label:'☀️ امروز من',desc:'کارهای امروز از برنامه هفته'},
    {id:'overdue',label:'🔴 معوق‌ها',desc:'مراکزی که پیگیری سررسیده'},
    {id:'priority',label:'🎯 اولویت‌های هوشمند',desc:'مراکز پیشنهادی برای تماس امروز'},
    {id:'tasks',label:'📌 وظایف من',desc:'کارت‌های kanban من'},
    {id:'recent',label:'🕐 مراکز اخیر',desc:'آخرین مراکزی که باز کردی'},
    {id:'summary',label:'📊 خلاصه مدیر',desc:'کارت‌های آماری (فقط مدیر)'},
    {id:'weekprogress',label:'📋 پیشرفت هفته',desc:'درصد انجام برنامه هفتگی'},
    {id:'silent',label:'🔇 مراکز خاموش',desc:'P1/P2 بدون فعالیت ۳۰+ روز'},
  ];
  var active=_getHomeWidgets();
  var body='<div style="display:flex;flex-direction:column;gap:8px">';
  all.forEach(function(w){
    var on=active.indexOf(w.id)>=0;
    body+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-raised);border-radius:7px;border:1px solid var(--border)">'
      +'<div><div style="font-size:13px;font-weight:600">'+w.label+'</div><div style="font-size:11px;color:var(--text-muted)">'+w.desc+'</div></div>'
      +'<button onclick="'+( on ? "_homeRemoveWidget('"+w.id+"')" : "_homeAddWidget('"+w.id+"')" )+';closeModal(\'homeAddModal\')" style="font-size:11px;padding:4px 10px;border-radius:5px;border:none;cursor:pointer;font-family:inherit;background:'+(on?'#fecaca':'#bbf7d0')+';color:'+(on?'#b91c1c':'#15803d')+';font-weight:600">'+(on?'حذف ✕':'افزودن ✓')+'</button>'
      +'</div>';
  });
  body+='</div>';
  openModal('homeAddModal','⚙️ مدیریت ویجت‌ها',body,'<button class="btn-secondary" onclick="closeModal(\'homeAddModal\')">بستن</button>',{lg:false});
}

function renderHome(){
  var el=document.getElementById('homePanel');
  if(!el)return;
  var widgets=_getHomeWidgets();
  var today=todayStr();
  _buildPCCache();
  var html='<div style="max-width:900px;margin:0 auto">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    +'<h2 style="margin:0;font-size:16px;font-weight:700;color:var(--brand)">🏠 خانه — '+( USERS[currentUser]||currentUser )+'</h2>'
    +'<button onclick="_homeOpenAddPanel()" style="font-size:11px;padding:5px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-family:inherit;color:var(--text-primary)">⚙️ مدیریت ویجت‌ها</button>'
    +'</div>';

  // ─── helper: widget wrapper ───
  function _wBox(title,content,wid){
    return '<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.07);overflow:hidden;margin-bottom:12px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border)">'
      +'<span style="font-weight:700;font-size:13px">'+title+'</span>'
      +'<button onclick="_homeRemoveWidget(\''+wid+'\')" title="حذف" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:0 2px" title="حذف ویجت">✕</button>'
      +'</div>'
      +'<div style="padding:10px 14px">'+content+'</div>'
      +'</div>';
  }

  widgets.forEach(function(wid){
    var boxContent='';

    if(wid==='today'){
      // ─── امروز من ───
      var todayEntries=[];
      var weekId=wpCurrentWeekId();
      Object.keys(DB.weekEntries||{}).forEach(function(k){
        var we=DB.weekEntries[k];
        if(!we||we.done)return;
        var owner=_wpGetOwner(we);
        if(!_isManager()&&owner!==currentUser)return;
        var wid2=k.split(':::')[0];
        if(wid2!==weekId)return;
        var schDate=we.scheduledDate||'';
        if(schDate===today)todayEntries.push(we);
      });
      if(!todayEntries.length){
        boxContent='<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:8px">برنامه‌ای برای امروز ندارید ✓</div>';
      } else {
        boxContent='<div style="display:flex;flex-direction:column;gap:5px">';
        todayEntries.slice(0,8).forEach(function(we){
          var nm=we.centerName||_getCenterName(we.rtype||'center',we.rid||we.recKey);
          var act=we.actionType==='visit'?'🚶 ویزیت':'📞 تماس';
          boxContent+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--bg-raised);border-radius:6px;font-size:12px">'
            +'<span>'+act+' — <b>'+esc(nm)+'</b></span>'
            +'<button onclick="quickCallLog(\''+esc(we.rtype||'center')+'\',\''+esc(we.rid||we.recKey||'')+'\',\''+esc(nm)+'\')" style="font-size:10px;padding:2px 8px;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:inherit">📞 ثبت</button>'
            +'</div>';
        });
        if(todayEntries.length>8)boxContent+='<div style="font-size:11px;color:var(--text-muted);text-align:center">+ '+(todayEntries.length-8)+' مورد دیگر</div>';
        boxContent+='</div>';
      }
      html+=_wBox('☀️ امروز من ('+todayEntries.length+')',boxContent,'today');
    }

    else if(wid==='overdue'){
      // ─── معوق‌ها ───
      var overdueItems=[];
      function _collectOv(arr,rtype){
        arr.forEach(function(r){
          var e=getE(rtype,r.id);
          if((e.owner||r.owner||'')!==currentUser&&!_isManager())return;
          var fd=e.followupDate||'';
          if(fd&&fd<today&&(e.status||'بدون تماس')!=='غیرفعال'&&(e.status||'')!=='قرارداد بسته شد'){
            overdueItems.push({name:r.name,rtype:rtype,id:r.id,fd:fd,owner:e.owner||r.owner||''});
          }
        });
      }
      getAllProvinces().forEach(function(p){_collectOv(getProvCenters(p.id),getProvType(p.id));});
      overdueItems.sort(function(a,b){return a.fd<b.fd?-1:1;});
      if(!overdueItems.length){
        boxContent='<div style="color:#16a34a;font-size:12px;text-align:center;padding:8px">✓ هیچ معوقی ندارید!</div>';
      } else {
        boxContent='<div style="display:flex;flex-direction:column;gap:4px">';
        overdueItems.slice(0,6).forEach(function(it){
          var _fdp=it.fd.split('/').map(Number);var _fdg=j2g(_fdp[0],_fdp[1],_fdp[2]);var daysAgo=Math.floor((new Date()-new Date(_fdg[0],_fdg[1]-1,_fdg[2]))/86400000);
          var clr=daysAgo>30?'#dc2626':daysAgo>7?'#f59e0b':'#6366f1';
          boxContent+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--bg-raised);border-radius:6px;font-size:12px">'
            +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>'+esc(it.name)+'</b></span>'
            +'<span style="color:'+clr+';font-size:11px;margin:0 8px;white-space:nowrap">'+daysAgo+' روز پیش</span>'
            +'<button onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="font-size:10px;padding:2px 8px;background:var(--brand);color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:inherit">باز کن</button>'
            +'</div>';
        });
        if(overdueItems.length>6)boxContent+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding-top:4px"><button onclick="openOverdueList()" style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--brand);text-decoration:underline">نمایش همه '+overdueItems.length+' مورد</button></div>';
        boxContent+='</div>';
      }
      html+=_wBox('🔴 معوق‌ها ('+overdueItems.length+')',boxContent,'overdue');
    }

    else if(wid==='priority'){
      // ─── اولویت‌های هوشمند ───
      var scored=[];
      function _collectPri(arr,rtype){
        arr.forEach(function(r){
          var e=getE(rtype,r.id);
          if(!_isManager()&&(e.owner||r.owner||'')!==currentUser)return;
          var st=e.status||'بدون تماس';
          if(st==='غیرفعال'||st==='قرارداد بسته شد')return;
          var pot=parseInt(e.potential!==undefined?e.potential:r.potential||4);
          if(pot>3)return;
          var fd=e.followupDate||'';
          var daysOver=fd&&fd<today?Math.floor((new Date()-new Date(fd.replace(/\//g,'-')))/86400000):0;
          var potScore=(5-pot)*20;
          var stScore={'بدون تماس':5,'تماس اولیه':10,'ملاقات انجام شد':15,'پیشنهاد ارسال شد':12}[st]||0;
          var score=potScore+daysOver*0.5+stScore;
          scored.push({name:r.name,rtype:rtype,id:r.id,score:score,pot:pot,st:st,fd:fd});
        });
      }
      getAllProvinces().forEach(function(p){_collectPri(getProvCenters(p.id),getProvType(p.id));});
      scored.sort(function(a,b){return b.score-a.score;});
      var top=scored.slice(0,5);
      if(!top.length){
        boxContent='<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:8px">مرکزی برای پیشنهاد وجود ندارد</div>';
      } else {
        boxContent='<div style="display:flex;flex-direction:column;gap:4px">';
        top.forEach(function(it,idx2){
          var medal=['🥇','🥈','🥉','4️⃣','5️⃣'][idx2]||'';
          boxContent+='<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg-raised);border-radius:6px;font-size:12px">'
            +'<span style="font-size:15px">'+medal+'</span>'
            +'<span style="flex:1;font-weight:600">'+esc(it.name)+'</span>'
            +'<span style="font-size:10px;background:#ede9fe;color:#5b21b6;padding:2px 6px;border-radius:10px">P'+it.pot+'</span>'
            +'<button onclick="quickCallLog(\''+it.rtype+'\',\''+it.id+'\',\''+esc(it.name)+'\')" style="font-size:10px;padding:2px 8px;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:inherit">📞</button>'
            +'</div>';
        });
        boxContent+='</div>';
      }
      html+=_wBox('🎯 اولویت‌های هوشمند',boxContent,'priority');
    }

    else if(wid==='tasks'){
      // ─── وظایف من ───
      var myTasks=(DB.tasks||[]).filter(function(t){
        return !t.done&&(t.owner===currentUser||_isManager());
      }).sort(function(a,b){
        if(a.priority!==b.priority)return (a.priority||3)-(b.priority||3);
        if(a.dueDate&&b.dueDate)return a.dueDate<b.dueDate?-1:1;
        return 0;
      });
      if(!myTasks.length){
        boxContent='<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:8px">وظیفه‌ای ندارید ✓</div>';
      } else {
        boxContent='<div style="display:flex;flex-direction:column;gap:4px">';
        myTasks.slice(0,5).forEach(function(t){
          var priClr=['','#dc2626','#f59e0b','#6b7280'][t.priority||3]||'#6b7280';
          var overdue=t.dueDate&&t.dueDate<today;
          boxContent+='<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg-raised);border-radius:6px;font-size:12px">'
            +'<span style="width:8px;height:8px;border-radius:50%;background:'+priClr+';flex-shrink:0"></span>'
            +'<span style="flex:1;'+(overdue?'color:#dc2626':'')+'">'+esc(t.title||'')+'</span>'
            +(t.dueDate?'<span style="font-size:10px;color:var(--text-muted)">'+t.dueDate+'</span>':'')
            +'<button onclick="openTaskModal(\''+t.id+'\')" style="font-size:10px;padding:2px 7px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-family:inherit">باز</button>'
            +'</div>';
        });
        if(myTasks.length>5)boxContent+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding-top:4px">+ '+(myTasks.length-5)+' وظیفه دیگر — <button onclick="switchTab(\'tasks\')" style="background:none;border:none;cursor:pointer;color:var(--brand);text-decoration:underline;font-size:11px">نمایش همه</button></div>';
        boxContent+='</div>';
      }
      html+=_wBox('📌 وظایف من ('+myTasks.length+')',boxContent,'tasks');
    }

    else if(wid==='recent'){
      // ─── مراکز اخیر ───
      if(!_recentCenters||!_recentCenters.length){
        boxContent='<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:8px">هنوز مرکزی باز نکرده‌اید</div>';
      } else {
        boxContent='<div style="display:flex;gap:6px;flex-wrap:wrap">';
        _recentCenters.slice(0,8).forEach(function(rc){
          boxContent+='<button onclick="openCenterModal(\''+rc.rtype+'\',\''+rc.id+'\')" style="font-size:12px;padding:5px 10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text-primary);font-family:inherit">'+esc(rc.name||rc.id)+'</button>';
        });
        boxContent+='</div>';
      }
      html+=_wBox('🕐 مراکز اخیر',boxContent,'recent');
    }

    else if(wid==='summary'&&_isManager()){
      // ─── خلاصه مدیر ───
      var total=0,active=0,contracts=0,inactive=0;
      Object.values(DB.edits||{}).forEach(function(e){
        if(!e)return;total++;
        var st=e.status||'بدون تماس';
        if(st==='قرارداد بسته شد')contracts++;
        else if(st==='غیرفعال')inactive++;
        else active++;
      });
      boxContent='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
        +'<div style="text-align:center;background:#f0fdf4;border-radius:8px;padding:10px"><div style="font-size:22px;font-weight:700;color:#16a34a">'+contracts+'</div><div style="font-size:11px;color:#15803d">قرارداد</div></div>'
        +'<div style="text-align:center;background:#eff6ff;border-radius:8px;padding:10px"><div style="font-size:22px;font-weight:700;color:#2563eb">'+active+'</div><div style="font-size:11px;color:#1d4ed8">فعال</div></div>'
        +'<div style="text-align:center;background:#fef2f2;border-radius:8px;padding:10px"><div style="font-size:22px;font-weight:700;color:#dc2626">'+inactive+'</div><div style="font-size:11px;color:#b91c1c">غیرفعال</div></div>'
        +'</div><div style="text-align:center;margin-top:8px"><button onclick="switchTab(\'manager\')" style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--brand);text-decoration:underline">جزئیات بیشتر →</button></div>';
      html+=_wBox('📊 خلاصه مدیر',boxContent,'summary');
    }

    else if(wid==='weekprogress'){
      // ─── پیشرفت هفته ───
      var weekId2=wpCurrentWeekId();
      var total2=0,done2=0;
      Object.keys(DB.weekEntries||{}).forEach(function(k){
        var we=DB.weekEntries[k];
        if(!we)return;
        if(!_isManager()&&_wpGetOwner(we)!==currentUser)return;
        if(k.split(':::')[0]!==weekId2)return;
        total2++;
        if(we.done)done2++;
      });
      var pct=total2>0?Math.round(100*done2/total2):0;
      boxContent='<div style="margin-bottom:6px;font-size:12px">'+done2+' از '+total2+' — '+pct+'% انجام شده</div>'
        +'<div style="background:var(--bg-raised);border-radius:6px;height:16px;overflow:hidden">'
        +'<div style="width:'+pct+'%;background:var(--brand);height:100%;border-radius:6px;transition:width .3s"></div>'
        +'</div>'
        +'<div style="text-align:center;margin-top:8px"><button onclick="switchTab(\'weekplan\')" style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--brand);text-decoration:underline">رفتن به برنامه هفته →</button></div>';
      html+=_wBox('📋 پیشرفت هفته',boxContent,'weekprogress');
    }

    else if(wid==='silent'){
      // ─── مراکز خاموش ───
      var silent=[];
      var nowMs2=Date.now();
      var thirtyMs=30*24*60*60*1000;
      function _chkSilent(arr,rtype){
        arr.forEach(function(r){
          var e=getE(rtype,r.id);
          var st=e.status||'بدون تماس';
          if(st==='غیرفعال'||st==='قرارداد بسته شد')return;
          var pot=parseInt(e.potential!==undefined?e.potential:r.potential||4);
          if(pot>2)return;
          if(!_isManager()&&(e.owner||r.owner||'')!==currentUser)return;
          var lastTs=e._lastActivity||e._ts||0;
          if(!lastTs||(nowMs2-lastTs)>=thirtyMs)silent.push({name:r.name,rtype:rtype,id:r.id,pot:pot,days:lastTs?Math.floor((nowMs2-lastTs)/86400000):null});
        });
      }
      getAllProvinces().forEach(function(p){_chkSilent(getProvCenters(p.id),getProvType(p.id));});
      silent.sort(function(a,b){return (b.days||999)-(a.days||999);});
      if(!silent.length){
        boxContent='<div style="color:#16a34a;font-size:12px;text-align:center;padding:8px">✓ همه مراکز P1/P2 فعال هستند</div>';
      } else {
        boxContent='<div style="display:flex;flex-direction:column;gap:4px">';
        silent.slice(0,5).forEach(function(it){
          boxContent+='<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg-raised);border-radius:6px;font-size:12px">'
            +'<span style="font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 5px;border-radius:10px">P'+it.pot+'</span>'
            +'<span style="flex:1">'+esc(it.name)+'</span>'
            +'<span style="font-size:10px;color:#dc2626">'+(it.days?it.days+' روز':'—')+'</span>'
            +'<button onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" style="font-size:10px;padding:2px 7px;background:var(--brand);color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:inherit">باز</button>'
            +'</div>';
        });
        if(silent.length>5)boxContent+='<div style="font-size:11px;color:var(--text-muted);text-align:center;padding-top:4px">+ '+(silent.length-5)+' مرکز دیگر</div>';
        boxContent+='</div>';
      }
      html+=_wBox('🔇 مراکز خاموش P1/P2 ('+silent.length+')',boxContent,'silent');
    }
  });

  // ─── Empty state ───
  if(!widgets.length){
    html+='<div style="text-align:center;padding:40px;color:var(--text-muted)">'
      +'<div style="font-size:40px;margin-bottom:8px">🪟</div>'
      +'<div style="font-size:14px;margin-bottom:12px">هیچ ویجتی انتخاب نشده</div>'
      +'<button onclick="_homeOpenAddPanel()" style="padding:8px 16px;background:var(--brand);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit">افزودن ویجت</button>'
      +'</div>';
  }

  html+='</div>';
  el.innerHTML=html;
}

function renderDashboard(){
  var el=document.getElementById('dash');if(!el||_currentProvId)return;
  renderUserDashboard();
  if(_isManager()){_renderManagerDash(el);}
  else{_renderExpertDash(el);}
}


// ════════════════════════ BANNER (followups) ═══════════
// بهینه: فقط edits که followupDate دارند
function getFollowups(){
  var today=todayStr();var items=[];
  _buildPCCache();
  var validK=_getAllValidRecKeys?_getAllValidRecKeys():new Set();
  Object.keys(DB.edits||{}).forEach(function(k){
    var e=DB.edits[k];var fd=e.followupDate||'';if(!fd||fd>today)return;
    var st=e.status||'بدون تماس';if(st==='قرارداد بسته شد'||st==='غیرفعال')return;
    var pts=k.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
    var name=id;var provName='';
    var isOrphan=validK.size>0&&!validK.has(k);
    if(!isOrphan){
      if(tp==='center'){
        var c=CENTERS.find(function(x){return x.id===id;});
        if(c)name=c.name;provName='تهران';
        var ex=(DB.extra||[]).find(function(x){return x.id===id;});
        if(ex)name=ex.name;
      }else if(tp==='pc'){
        var provId=id.split('||')[0];
        var cArr=_PC_CACHE[provId]||[];
        var found=cArr.find(function(x){return x.id===id;});
        if(found)name=found.name;
        var ex2=(DB.extra||[]).find(function(x){return x.id===id;});
        if(ex2)name=ex2.name;
        var pv=getAllProvinces().find(function(p){return p.id===provId;});
        if(pv)provName=pv.name;
      }
    }
    var _ow=e.owner||'';
    if(!_ow){
      if(tp==='center'){var _cco=CENTERS.find(function(x){return x.id===id;});if(_cco&&_cco.owner)_ow=_cco.owner;}
      else{var _pId3=id.split('||')[0];var _cArr3=_PC_CACHE[_pId3]||[];var _co3=_cArr3.find(function(x){return x.id===id;});if(_co3&&_co3.owner)_ow=_co3.owner;}
      if(!_ow){var _ex3=(DB.extra||[]).find(function(x){return x.id===id;});if(_ex3&&_ex3.owner)_ow=_ex3.owner;}
    }
    items.push({rtype:tp,id:id,name:name,date:fd,overdue:fd<today,
      owner:_ow,provName:provName,tags:rTags(tp,id),recKey:k,isOrphan:isOrphan});
  });
  return items;
}

function renderBanner(){
  var banner=document.getElementById('banner');if(!banner)return;
  if(_currentProvId){banner.style.display='none';return;}
  var allItems=getFollowups();
  // کارشناسان فقط پیگیری‌های خودشان را ببینند
  var effUser=_isExpert()?currentUser:_bannerFilterUser;
  var filtered=allItems.filter(function(it){
    if(effUser&&it.owner!==effUser)return false;
    if(_bannerFilterTag&&it.tags.indexOf(_bannerFilterTag)===-1)return false;
    return true;
  });
  // پنهان کردن فیلتر کارشناس برای کارشناس
  var buEl=document.getElementById('bannerUser');if(buEl)buEl.style.display=_isExpert()?'none':'';
  if(!filtered.length){banner.style.display='none';return;}
  banner.style.display='';
  // گروه‌بندی
  var overdueArr=filtered.filter(function(it){return it.overdue&&!it.isOrphan;});
  var todayArr=filtered.filter(function(it){return !it.overdue&&!it.isOrphan;});
  var orphanArr=filtered.filter(function(it){return it.isOrphan;});
  // آمار عنوان
  var titleEl=document.getElementById('tb_title');
  if(titleEl){
    var badges='';
    if(overdueArr.length)badges+=' <span style="background:#dc2626;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px">'+overdueArr.length+' معوق</span>';
    if(todayArr.length)badges+=' <span style="background:#f59e0b;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px">'+todayArr.length+' امروز</span>';
    titleEl.innerHTML='📅 پیگیری‌های امروز و معوق'+badges;
  }
  var tb=document.getElementById('tb_items');if(!tb)return;

  // Days overdue for an item
  function _odDays(it){
    if(!it.overdue||!it.date)return 0;
    var tp=todayStr().split('/').map(Number),dp=it.date.split('/').map(Number);
    return Math.max(0,Math.round((jMs(tp[0],tp[1],tp[2])-jMs(dp[0],dp[1],dp[2]))/86400000));
  }

  // Single row inside expert cards
  function _mkRow(it){
    var days=_odDays(it);
    var dc=days>30?'#dc2626':days>7?'#d97706':'#2563eb';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg-raised);border-radius:6px;margin-bottom:3px;cursor:pointer;border:1px solid var(--border);transition:all .1s" onclick="openCenterModal(\''+it.rtype+'\',\''+it.id+'\')" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'var(--bg-raised)\'">'
      +'<span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)">'+esc(it.name)+'</span>'
      +(it.overdue
        ?'<span style="font-size:10px;font-weight:700;color:'+dc+';white-space:nowrap;background:'+dc+'18;border-radius:4px;padding:1px 5px">'+days+' روز</span>'
        :'<span style="font-size:10px;color:#16a34a;font-weight:600;white-space:nowrap">امروز</span>')
      +'<span onclick="event.stopPropagation();bannerSnooze(\''+it.rtype+'\',\''+it.id+'\',event)" title="تعویق ۳ روز" style="cursor:pointer;font-size:10px;padding:2px 5px;background:#fef3c7;border-radius:4px;color:#92400e;flex-shrink:0">⏰</span>'
      +'</div>';
  }

  var html='';

  if(!_isExpert()){
    // ── MANAGER: grouped by expert ──
    // compute overdue task counts per expert
    var _today2=todayStr();
    var _tasksByExp={};
    (DB.tasks||[]).forEach(function(t){
      if(t.owner&&t.status!=='done'&&t.dueDate&&t.dueDate<=_today2){
        _tasksByExp[t.owner]=(_tasksByExp[t.owner]||0)+1;
      }
    });
    var byExpert={};
    filtered.forEach(function(it){
      if(it.isOrphan)return;
      var uid=it.owner||'__none__';
      if(!byExpert[uid])byExpert[uid]=[];
      byExpert[uid].push(it);
    });
    var expertKeys=Object.keys(byExpert).sort(function(a,b){
      return byExpert[b].filter(function(i){return i.overdue;}).length
            -byExpert[a].filter(function(i){return i.overdue;}).length;
    });
    html+='<div class="mgr-banner-grid">';
    expertKeys.forEach(function(uid){
      var items=byExpert[uid];
      var ov=items.filter(function(i){return i.overdue;});
      var td=items.filter(function(i){return !i.overdue;});
      var uname=uid==='__none__'?'بدون مسئول':(USERS[uid]||uid);
      var clr=typeof umGetColor==='function'?umGetColor(uid):'#6366f1';
      var sorted=items.slice().sort(function(a,b){return _odDays(b)-_odDays(a);});
      var top=sorted.slice(0,3),rest=sorted.length-3;
      html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
        +'<div style="background:'+clr+'22;border-bottom:1px solid var(--border);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">'
        +'<span style="font-weight:700;font-size:12px">'+esc(uname)+'</span>'
        +'<div style="display:flex;gap:5px;align-items:center">'
        +(ov.length?'<span style="background:#dc2626;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700">'+ov.length+' معوق</span>':'')
        +(td.length?'<span style="background:#f59e0b;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700">'+td.length+' امروز</span>':'')
        +(_tasksByExp[uid]?'<span style="background:#7c3aed;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700" title="وظایف سررسید">📌 '+_tasksByExp[uid]+'</span>':'')
        +(uid!=='__none__'?'<button onclick="openOverdueList(\''+uid+'\')" style="font-size:9px;padding:2px 6px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-family:inherit;color:var(--text-secondary)">همه</button>':'')
        +'</div></div>'
        +'<div style="padding:8px 10px">'
        +top.map(_mkRow).join('')
        +(rest>0?'<div style="font-size:10px;text-align:center;color:var(--brand);padding:5px 0;cursor:pointer;font-weight:600" onclick="openOverdueList(\''+uid+'\')">+ '+rest+' مرکز دیگر</div>':'')
        +'</div></div>';
    });
    if(orphanArr.length){
      html+='<div style="background:#fef3c7;border:1px dashed #d97706;border-radius:8px;padding:8px 10px;align-self:start">'
        +'<div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:4px">⚠ پیگیری مراکز حذف‌شده</div>'
        +'<div style="font-size:10px;color:#78350f;margin-bottom:6px">این مراکز از سیستم حذف شده‌اند اما تاریخ پیگیری دارند. با ✕ پیگیری را پاک کنید.</div>'
        +orphanArr.map(function(o){return'<span style="font-size:10px;text-decoration:line-through;color:#92400e" title="مرکز حذف‌شده — پیگیری باقی مانده">'+esc(o.id)+'</span>'
          +'<span onclick="clearOrphanFollowup(\''+o.recKey+'\')" title="حذف این پیگیری" style="cursor:pointer;color:#dc2626;font-size:11px;margin-right:6px"> ✕</span> ';}).join('')
        +'</div>';
    }
    html+='</div>';
  } else {
    // ── EXPERT: time-bucket view ──
    var urgent  =overdueArr.filter(function(i){return _odDays(i)>30;});
    var moderate=overdueArr.filter(function(i){var d=_odDays(i);return d>=7&&d<=30;});
    var recent  =overdueArr.filter(function(i){return _odDays(i)<7;});
    var buckets=[
      {label:'🔴 فوری (بیش از ۳۰ روز)',items:urgent,col:'#dc2626'},
      {label:'🟡 معوق (۷ تا ۳۰ روز)',items:moderate,col:'#d97706'},
      {label:'🔵 اخیر (کمتر از ۷ روز)',items:recent,col:'#2563eb'},
      {label:'📅 پیگیری امروز',items:todayArr,col:'#16a34a'}
    ];
    html+='<div style="display:flex;flex-direction:column;gap:10px">';
    buckets.forEach(function(b){
      if(!b.items.length)return;
      html+='<div>'
        +'<div style="font-size:10px;font-weight:700;color:'+b.col+';margin-bottom:5px">'+b.label+'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:4px">'
        +b.items.map(_mkRow).join('')
        +'</div></div>';
    });
    // show tasks due today/overdue in banner for expert
    var _myTasks=(DB.tasks||[]).filter(function(t){
      return t.owner===currentUser&&t.status!=='done'&&t.dueDate&&t.dueDate<=todayStr();
    });
    if(_myTasks.length){
      var _overTasks=_myTasks.filter(function(t){return t.dueDate<todayStr();});
      var _todTasks=_myTasks.filter(function(t){return t.dueDate===todayStr();});
      html+='<div><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:5px">📌 وظایف سررسید'+((_overTasks.length?(' ('+_overTasks.length+' معوق)'):'')+(_todTasks.length?(' + '+_todTasks.length+' امروز'):''))+'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:4px">';
      _myTasks.slice(0,6).forEach(function(t){
        var isOv=t.dueDate<todayStr();
        html+='<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg-raised);border-radius:7px;cursor:pointer" onclick="_taskSearch=\'\';_taskFilter=\'mine\';switchTab(\'tasks\')">';
        html+='<span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6d28d9">'+esc(t.title||'—')+'</span>';
        html+=(isOv?'<span style="font-size:10px;font-weight:700;color:#dc2626">'+t.dueDate+'</span>':'<span style="font-size:10px;color:#16a34a;font-weight:600">امروز</span>');
        html+='</div>';
      });
      if(_myTasks.length>6)html+='<div style="font-size:10px;text-align:center;color:var(--brand);padding:5px;cursor:pointer;font-weight:600" onclick="switchTab(\'tasks\')">+ '+(_myTasks.length-6)+' وظیفه دیگر</div>';
      html+='</div></div>';
    }
    html+='</div>';
  }
  tb.innerHTML=html;
}
function setBannerUser(v){_bannerFilterUser=v;renderBanner();}
function setBannerTag(v){_bannerFilterTag=v?parseInt(v):0;renderBanner();}
function bannerSnooze(rtype,id,ev){
  if(ev)ev.stopPropagation();
  var e=getE(rtype,id);
  var fd=e.followupDate||todayStr();
  var parts=fd.split('/').map(Number);
  var gDate=j2g(parts[0],parts[1],parts[2]);
  var d=new Date(gDate[0],gDate[1]-1,gDate[2]+3);
  var nj=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  var newDate=nj[0]+'/'+String(nj[1]).padStart(2,'0')+'/'+String(nj[2]).padStart(2,'0');
  setE(rtype,id,'followupDate',newDate);
  renderBanner();renderDashboard();
  showToast('⏰ تعویق تا '+newDate,2000);
}


/* ═══ public/js/provinces.js ═══ */
// ════════════════════════ TABLE RENDER ════════════════
function getFiltered(){
  var q=(document.getElementById('srch')||{}).value||'';
  var fp=(document.getElementById('fPot')||{}).value||'';
  var fs=(document.getElementById('fStatus')||{}).value||'';
  var fl=(document.getElementById('fLead')||{}).value||'';
  var fo=(document.getElementById('fOwner')||{}).value||'';
  var _ftEl=document.getElementById('fTag');var ft=_ftEl&&_ftEl.value?parseInt(_ftEl.value):0;
  var ftp=document.getElementById('fType')?document.getElementById('fType').value:'';
  var effectiveOwner=fo||_globalOwnerFilter||(_isExpert()?currentUser:'');
  var provId=_currentProvId;
  var rtype=getProvType(provId);
  var rows=getProvCenters(provId);
  return rows.filter(function(r){
    var e=getE(rtype,r.id);
    if(q&&!fMatch(q,r.name))return false;
    if(fp&&String(e.potential||r.potential)!==fp)return false;
    var st=e.status||'بدون تماس';if(fs&&st!==fs)return false;
    var lead=(e.lead||r.lead||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim();if(fl&&lead!==fl)return false;
    var owner=e.owner||r.owner||'';if(effectiveOwner&&owner!==effectiveOwner)return false;
    if(ftp){var ctype=e.type||r.type||'';if(ctype.indexOf(ftp)<0)return false;}
    if(ft){var tgs=rTags(rtype,r.id);if(tgs.indexOf(ft)===-1)return false;}
    // Quick filter
    if(_quickFilter==='overdue')return isOverdue(rtype,r.id);
    if(_quickFilter==='nofollowup'){return !e.followupDate;}
    if(_quickFilter==='noowner'){return !(e.owner||r.owner);}
    if(_quickFilter==='stalled')return isStalled(rtype,r.id);
    if(_quickFilter==='pot1'){return (e.potential||r.potential)==1;}
    return true;
  });
}


function _renderRecentCenters(container){
  if(!_recentCenters||!_recentCenters.length)return;
  var html='<div class="recent-centers-bar" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:7px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;overflow-x:auto;flex-wrap:nowrap">'
    +'<span style="font-size:10px;color:var(--text-muted);white-space:nowrap;font-weight:600">🕐 اخیر:</span>';
  _recentCenters.forEach(function(rc){
    var label=rc.name||rc.id;
    if(label.length>14)label=label.slice(0,14)+'…';
    html+='<button onclick="openCenterModal(\''+rc.rtype+'\',\''+rc.id+'\')" style="white-space:nowrap;font-size:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:3px 8px;cursor:pointer;color:var(--text-primary);font-family:inherit">'+esc(label)+'</button>';
  });
  html+='</div>';
  if(container){var old=container.querySelector('.recent-centers-bar');if(old)old.remove();container.insertAdjacentHTML('afterbegin',html);}
}

function renderTable(){
  if(!_currentProvId){
    if(_provView==='grid')renderProvList();
    else renderAllCenters(_provView);
    return;
  }
  if(_viewMode==='card'){renderCards();return;}
  if(_viewMode==='pipeline'){try{renderPipeline();}catch(e){_viewMode='list';renderProvTable();}return;}
  if(_viewMode==='kanban'){try{renderKanban();}catch(e){_viewMode='list';renderProvTable();}return;}
  renderProvTable();
}

// ════════════════════════ PROVINCE LIST ══════════════
function renderProvList(){
  var provs=getAllProvinces();
  // فیلتر search + owner روی province list
  var _plSearch=document.getElementById('srch')?document.getElementById('srch').value:'';
  var _plOwner=document.getElementById('fOwner')?document.getElementById('fOwner').value:_globalOwnerFilter;
  var effectiveProvOwner=_plOwner||(_isExpert()?currentUser:'');
  var filtProvs=provs.filter(function(p){
    if(_plSearch){var n=fNorm(p.name);if(n.indexOf(fNorm(_plSearch))<0)return false;}
    if(effectiveProvOwner&&p.id!=='tehran'){var e2=getE('pc',p.id);var ow=e2.owner||p.owner||'';if(ow!==effectiveProvOwner)return false;}
    return true;
  });
  var rows=filtProvs.map(function(p){
    var e=getE('pc',p.id);
    var owner=e.owner||p.owner||'';
    var ownerName=owner?(USERS[owner]||owner):'بدون مسئول';
    var ownerColor=owner&&typeof umGetColor==='function'?umGetColor(owner):'#e2e8f0';
    var isMyProv=(owner===currentUser);
    var dimmed=false; // پنهان نمی‌کنیم، فقط highlight می‌کنیم
    var tp=getProvType(p.id);
    // count از DB.edits بدون iterate همه مراکز
    var contracted=0,meetings=0,overdueCount=0;
    var today2=todayStr();
    Object.keys(DB.edits||{}).forEach(function(k){
      var e=DB.edits[k];
      // بررسی کن آیا مال این استان است
      var pts=k.split('_');var ktp=pts[0];var kid=pts.slice(1).join('_');
      var belongsHere=false;
      if(p.id==='tehran'&&ktp==='center')belongsHere=true;
      else if(ktp==='pc'&&kid.startsWith(p.id+'||'))belongsHere=true;
      if(!belongsHere)return;
      var st=e.status||'';
      if(st==='قرارداد بسته شد')contracted++;
      else if(st==='ملاقات انجام شد')meetings++;
      if(e.followupDate&&e.followupDate<today2&&st!=='قرارداد بسته شد'&&st!=='غیرفعال')overdueCount++;
    });
    var centers=getProvCenters(p.id); // برای تعداد کل مراکز
    var cls='prov-card'+(p.id==='tehran'?' tehran':'')+(isMyProv&&_globalOwnerFilter?' prov-mine':'')+(dimmed?' prov-dimmed':'');
    var style=dimmed?'opacity:.4;pointer-events:none':'';
    var ownerColor=owner?(isMyProv||!_globalOwnerFilter?'#0369a1':'#94a3b8'):'#cbd5e1';
    var cntLabel=String(centers.length);
    var div=document.createElement('div');
    div.className=cls;if(style)div.style.cssText=style;
    div.setAttribute('data-pid',p.id);
    div.onclick=function(){openProvince(this.getAttribute('data-pid'));};
    div.innerHTML=
      '<div class="prov-card-name">'+esc(p.name)+(overdueCount?'<span class="risk-badge" title="'+overdueCount+' پیگیری معوق">🟠</span>':'')+'</div>'
      +'<div style="font-size:11px;font-weight:600;margin:3px 0 6px;display:flex;align-items:center;gap:4px;color:'+ownerColor+'">'
      +'<span>👤</span><span>'+esc(ownerName)+'</span></div>'
      +'<div class="prov-card-stats">'
      +'<span class="prov-stat pot-'+p.potential+'">پ'+p.potential+'</span>'
      +'<span class="prov-stat" style="background:var(--bg-raised);color:var(--text-secondary)">'+cntLabel+' مرکز</span>'
      +(contracted?'<span class="prov-stat" style="background:#bbf7d0;color:#166534">'+contracted+' قرارداد ✓</span>':'')
      +(meetings?'<span class="prov-stat" style="background:#fef3c7;color:#854d0e">'+meetings+' ملاقات</span>':'')
      +'</div>'
      +(p.biopsyPct?'<div style="font-size:10px;color:var(--text-muted);margin-top:4px">بیوپسی: '+p.biopsyPct+'%</div>':'')
    +(p.id==='tehran'?(function(){
      var tCs=getProvCenters('tehran');
      var potG={1:0,2:0,3:0,4:0};
      tCs.forEach(function(cc){var ee=getE('center',cc.id);var lvl=ee.potential!==undefined?ee.potential:cc.potential||1;potG[lvl]=(potG[lvl]||0)+1;});
      var tot=tCs.length||1;
      var pClrs=['','#16a34a','#0ea5e9','#f59e0b','#dc2626'];
      var bars=[1,2,3,4].map(function(lvl){
        var n=potG[lvl]||0;if(!n)return'';
        var pc=pClrs[lvl];var pct=Math.round(n/tot*100);
        return '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">'
          +'<span style="font-size:9px;color:'+pc+';font-weight:700;width:18px;flex-shrink:0">P'+lvl+'</span>'
          +'<div style="flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden">'
            +'<div style="height:100%;width:'+pct+'%;background:'+pc+';border-radius:4px;min-width:3px"></div>'
          +'</div>'
          +'<span style="font-size:9px;color:var(--text-muted);min-width:24px;text-align:left">'+n+'</span>'
        +'</div>';
      }).join('');
      return '<div style="margin-top:7px;border-top:1px solid var(--border);padding-top:5px">'+bars+'</div>';
    })():'');
    return div;
  });
  // هید/نمایش table
  var tbl=document.getElementById('mainTable');if(tbl)tbl.style.display='none';
  var kb=document.getElementById('kanbanView');if(kb)kb.style.display='none';
  var cv=document.getElementById('cardView');if(cv)cv.style.display='none';
  var pg=document.getElementById('provGrid');if(!pg)return;
  pg.style.display='';
  // DOM-based render (no string)
  pg.innerHTML='';
  rows.forEach(function(d){pg.appendChild(d);});
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent=filtProvs.length+' استان'+(filtProvs.length<provs.length?' (فیلتر شده)':'')+(
    _globalOwnerFilter?' (فیلتر: '+esc(USERS[_globalOwnerFilter]||_globalOwnerFilter)+')':'');
}
// ════════════════════════ PROVINCE TABLE ═════════════
function renderProvTable(){
  var tbl=document.getElementById('mainTable');
  var pg=document.getElementById('provGrid');
  var kb=document.getElementById('kanbanView');var cv=document.getElementById('cardView');
  var pv=document.getElementById('pipelineView');if(pv)pv.style.display='none';
  if(tbl)tbl.style.display='';if(pg)pg.style.display='none';
  if(kb)kb.style.display='none';if(cv)cv.style.display='none';
  var rtype=getProvType(_currentProvId);
  var data=getFiltered();
  var today=todayStr();
  clearCenterSelection();
  // Mobile: show card list instead of table
  if(window.innerWidth<640){
    var _mt=document.getElementById('mainTable');if(_mt)_mt.style.display='none';
    var _ml=document.getElementById('mobCtrList');if(_ml)_ml.style.display='';
    renderMobileList(data,rtype,today);return;
  } else {
    var _ml2=document.getElementById('mobCtrList');if(_ml2)_ml2.style.display='none';
  }
  // Recent centers quick access bar
  (function(){var wrap=tbl?tbl.parentElement:null;if(wrap)_renderRecentCenters(wrap);})();
  // Pin sort: pinned at top, then apply _sortField within each group
  var pinnedKeys=new Set((DB.settings&&DB.settings.pinnedCenters)||[]);
  var pinnedData=data.filter(function(r){return pinnedKeys.has(recK(rtype,r.id));});
  var unpinnedData=data.filter(function(r){return !pinnedKeys.has(recK(rtype,r.id));});
  function sortGroup(arr){
    if(!_sortField)return arr;
    return arr.slice().sort(function(a,b){
      var ea=getE(rtype,a.id),eb=getE(rtype,b.id);
      var va,vb;
      if(_sortField==='name'){va=a.name;vb=b.name;}
      else if(_sortField==='potential'){va=parseInt(ea.potential||a.potential||9);vb=parseInt(eb.potential||b.potential||9);}
      else if(_sortField==='status'){va=STATUS_LIST.indexOf(ea.status||'بدون تماس');vb=STATUS_LIST.indexOf(eb.status||'بدون تماس');}
      else if(_sortField==='followupDate'){va=ea.followupDate||'9999';vb=eb.followupDate||'9999';}
      else if(_sortField==='lastActivity'){va=ea._lastActivity||ea._ts||0;vb=eb._lastActivity||eb._ts||0;}
      else if(_sortField==='type'){va=ea.type||a.type||'ω';vb=eb.type||b.type||'ω';}
      else if(_sortField==='lead'){va=LEAD_LIST.indexOf(ea.lead||a.lead||'');vb=LEAD_LIST.indexOf(eb.lead||b.lead||'');if(va<0)va=999;if(vb<0)vb=999;}
      else if(_sortField==='owner'){va=USERS[ea.owner||a.owner||'']||'ω';vb=USERS[eb.owner||b.owner||'']||'ω';}
      if(va<vb)return -_sortDir;if(va>vb)return _sortDir;return 0;
    });
  }
  data=sortGroup(pinnedData).concat(sortGroup(unpinnedData));
  var head=document.getElementById('tableHead');
  var body=document.getElementById('tableBody');
  if(!head||!body)return;
  function _sortTh(field,label){
    var arrow=_sortField===field?(_sortDir===1?' ↑':' ↓'):'';
    return '<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="setCenterSort(\''+field+'\')" title="مرتب‌سازی">'+label+arrow+'</th>';
  }
  head.innerHTML='<tr><th><input type="checkbox" id="selectAllCb" onclick="toggleSelectAll(this)" style="width:14px;height:14px;cursor:pointer;accent-color:#2563eb"></th>'
    +_sortTh('name','نام مرکز')
    +_sortTh('potential','پتانسیل')
    +_sortTh('type','نوع')
    +_sortTh('lead','سرنخ')
    +_sortTh('owner','مسئول')
    +_sortTh('status','وضعیت')
    +_sortTh('followupDate','پیگیری بعدی')
    +'<th>یادداشت</th>'
    +'<th>هفته</th>'
    +_sortTh('lastActivity','آخرین تماس')
    +'</tr>';
  body.innerHTML=data.length?data.map(function(r){
    var e=getE(rtype,r.id);
    var st=e.status||'بدون تماس';var sc=stCls(st);
    var lead=e.lead||r.lead||'سرنخ';var lc=lCls(lead);
    var pot=e.potential!==undefined?e.potential:r.potential;
    var fd=e.followupDate||'';
    var fdCls='fd-inp'+(fd&&fd<today?' ov':fd&&fd===today?' today':'');
    var notes=DB.notes[recK(rtype,r.id)]||[];
    var lastNote=notes.length?notes[notes.length-1]:null;
    var notePreview=lastNote?'<div style="font-size:9px;color:var(--text-muted);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px" title="'+esc(lastNote.text||'')+'">'+esc((lastNote.text||'').substring(0,40))+'</div>':'';
    // Row color class (Improvement 2)
    var rowCls='';
    if(st==='قرارداد بسته شد')rowCls='row-contracted';
    else if(isOverdue(rtype,r.id))rowCls='row-overdue';
    else if(fd&&fd<=addDaysToJalali(today,3))rowCls='row-upcoming';
    else if(isStalled(rtype,r.id))rowCls='row-stalled';
    // Pin
    var pinned=isPinned(rtype,r.id);
    var pinBtn='<button onclick="event.stopPropagation();togglePin(\''+rtype+'\',\''+r.id+'\')" title="'+(pinned?'رفع پین':'پین')+'" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 2px;opacity:'+(pinned?'1':'.3')+'" class="pin-btn">⭐</button>';
    // Phone
    var firstPhone=e.phones&&e.phones.length?e.phones[0]:'';
    var phoneHtml=firstPhone?'<a href="'+_phoneHref(firstPhone)+'" title="'+_phoneTitle()+'" style="display:block;font-size:9px;color:#0369a1;direction:ltr;text-decoration:none;margin-top:1px" onclick="event.stopPropagation()">📞 '+esc(firstPhone)+'</a>':'';
    // Last contact
    var lastTs=e._lastActivity||e._ts||0;
    var daysSince=lastTs?Math.floor((nowTs()-lastTs)/86400000):null;
    var lastContactHtml=daysSince===null
      ?'<span style="color:var(--text-muted);font-size:10px">—</span>'
      :daysSince===0?'<span style="color:#16a34a;font-size:10px;font-weight:600">امروز</span>'
      :daysSince<=7?'<span style="color:#0ea5e9;font-size:10px">'+daysSince+' روز</span>'
      :daysSince<=30?'<span style="color:#f59e0b;font-size:10px">'+daysSince+' روز</span>'
      :'<span style="color:#dc2626;font-size:10px;font-weight:600">'+daysSince+' روز 🔴</span>';
    return'<tr data-rowid="'+r.id+'" class="'+rowCls+'">'
      +'<td><input type="checkbox" class="row-cb" data-rid="'+r.id+'" data-rtype="'+rtype+'" onclick="toggleCenterSelect(this,\''+r.id+'\')" style="width:14px;height:14px;cursor:pointer;accent-color:#2563eb"></td>'
      +'<td>'
        +pinBtn
        +(isStalled(rtype,r.id)&&rowCls!=='row-contracted'?'<span class="risk-badge" title="۳۰+ روز بدون فعالیت">🔴</span>':'')
        +(isOverdue(rtype,r.id)&&rowCls!=='row-stalled'?'<span class="risk-badge" title="پیگیری معوق">🟠</span>':'')
        +(e.biopsyScore?'<span class="biopsy-badge" title="پتانسیل بیوپسی (امتیاز ۶-۱۰+) — '+(e.biopsyReasons||[]).join(' • ')+'">🔬 '+e.biopsyScore+'</span>':'')
        +(e.competitor?'<span title="رقیب: '+esc(e.competitor)+'" style="display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700;cursor:help;margin-right:3px">🤖 '+esc(e.competitor)+'</span>':'')
        +(function(){var _mi=typeof MTR_BY_CENTER!=='undefined'?MTR_BY_CENTER[r.id]:null;if(!_mi||!_mi.length)return '';var _ov=_mi.filter(function(x){return x.od>45;});var _warn=_mi.filter(function(x){return x.od>20&&x.od<=45;});var _col=_ov.length?'#dc2626':_warn.length?'#d97706':'#0ea5e9';return '<span title="مطالبات باز" style="background:'+_col+';color:var(--text-primary);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-right:5px;cursor:default">💰 '+_mi.length+'</span>';})()
        +'<button class="ctr-link" onclick="openCenterModal(\''+rtype+'\',\''+r.id+'\')">'+esc(r.name)+'</button>'
        +'<button onclick="event.stopPropagation();openPreCallBrief(\''+rtype+'\',\''+r.id+'\')" title="خلاصه قبل تماس" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;opacity:.6">🎯</button>'
        +phoneHtml
        +(e.phones&&e.phones.length||e.address||e.contactName||(e.contacts&&e.contacts.length)?'<button onclick="event.stopPropagation();showContactPopup(event,\''+rtype+'\',\''+r.id+'\')" title="اطلاعات تماس" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;color:#0369a1;vertical-align:middle">📋</button>':'')
        +renderTagCell(rtype,r.id)+'</td>'
      +'<td><select class="pot-btn pot-'+pot+'" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'potential\',parseInt(this.value));this.className=\'pot-btn pot-\'+this.value">'
        +[1,2,3,4].map(function(v){return'<option value="'+v+'"'+(pot==v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></td>'
      +(function(){var typeOpts=[''].concat(TYPE_LIST);var curType=e.type||r.type||'';return'<td><select class="ed-inp" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'type\',this.value)" style="width:90px">'+typeOpts.map(function(t){return'<option value="'+t+'"'+(curType===t?' selected':'')+'>'+(t||'-- نوع --')+'</option>';}).join('')+'</select></td>';})()

      +'<td><select class="ed-sel '+lc+'" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'lead\',this.value);this.className=\'ed-sel \'+(window.LEAD_CLS[this.value]||\'lead-none\')">'
        +LEAD_LIST.map(function(l){return'<option'+(l===lead?' selected':'')+'>'+l+'</option>';}).join('')+'</select></td>'
      +'<td style="white-space:nowrap"><span class="owner-dot" data-uid="'+encodeURIComponent(e.owner||r.owner||'')+'"></span>'
      +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'owner\',this.value);var _d=this.previousElementSibling;if(_d)_d.style.background=window.umGetColor?umGetColor(this.value):\'#e2e8f0\'">'
      +'<option value="">—</option>'
        +Object.keys(USERS).map(function(u){return'<option value="'+u+'"'+((e.owner||r.owner||'')==u?' selected':'')+'>'+USERS[u]+'</option>';}).join('')+'</select></td>'
      +'<td><select class="st-sel '+sc+'" onchange="onStatus(\''+rtype+'\',\''+r.id+'\',this)">'
        +STATUS_LIST.map(function(s,i){return'<option class="'+STATUS_CLS[i]+'"'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select>'
        +'<span class="st-print">'+st+'</span></td>'
      +'<td><input type="text" class="'+fdCls+'" value="'+fd+'" readonly onclick="openJDP(this,function(v){setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',v);this.value=v;renderBanner();renderProvTable();}.bind(this))" style="cursor:pointer"></td>'
      +'<td><button class="note-btn'+(notes.length?' has':'')+'" onclick="openNotes(\''+rtype+'\',\''+r.id+'\',\''+esc(r.name)+'\')">📝'+(notes.length?' '+notes.length:'')+'</button>'
        +'<input style="margin-right:4px;width:100px;border:1px solid var(--border-input);border-radius:4px;padding:2px 5px;font-size:10px;direction:rtl" placeholder="یادداشت سریع" onkeydown="if(event.key===\'Enter\'&&this.value.trim()){addNote(\''+rtype+'\',\''+r.id+'\',this.value,this);}">'
        +notePreview+'</td>'
      +(function(){var _rk2=rtype+'_'+r.id;var _inWk=Object.keys(DB.weekEntries||{}).some(function(k){var we=DB.weekEntries[k];return !we.done&&(we.recKey||(we.rtype+'_'+we.rid))===_rk2;});return '<td><button class="btn-assignweek" style="'+(_inWk?'background:#7c3aed':'')+'" onclick="openAssignWeekForCenter(\''+rtype+'\',\''+r.id+'\',\''+esc(r.name)+'\')">'+(_inWk?'↪ در هفته':'📋 هفته')+'</button></td>';})()
      +'<td>'+lastContactHtml+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="12" style="text-align:center;padding:40px;color:#94a3b8">نتیجه‌ای یافت نشد</td></tr>';
  rebuildFilters();
  buildPresetSelector();
  _renderCenterStatsBar(data,rtype);
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+data.length+' مرکز';
}
function onStatus(type,id,sel){
  var v=sel.value;sel.className='st-sel '+stCls(v);
  setE(type,id,'status',v);
}

function addCenter(){
  if(!_currentProvId){showToast('ابتدا یک استان را باز کنید');return;}
  var prov=getAllProvinces().find(function(p){return p.id===_currentProvId;});
  var provName=prov?prov.name:_currentProvId;

  var inputStyle='width:100%;padding:7px 8px;border:1.5px solid var(--border-input);border-radius:5px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--bg-input);color:var(--text-primary)';
  var labelStyle='font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px';

  var body='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div style="grid-column:1/-1"><label style="'+labelStyle+'">نام مرکز <span style="color:#ef4444">*</span></label>'
    +'<input id="ac_name" placeholder="مثلاً: بیمارستان میلاد تهران" style="'+inputStyle+'" autofocus></div>'
    +'<div><label style="'+labelStyle+'">نوع</label>'
    +'<select id="ac_type" style="'+inputStyle+'"><option value="">-- نوع --</option>'+TYPE_LIST.map(function(t){return'<option value="'+t+'">'+t+'</option>';}).join('')+'</select></div>'
    +'<div><label style="'+labelStyle+'">پتانسیل</label>'
    +'<select id="ac_pot" style="'+inputStyle+'">'
    +'<option value="1">۱ — بالا</option><option value="2" selected>۲ — متوسط</option>'
    +'<option value="3">۳ — پایین</option><option value="4">۴ — خیلی پایین</option>'
    +'</select></div>'
    +'<div><label style="'+labelStyle+'">نوع لید</label>'
    +'<select id="ac_lead" style="'+inputStyle+'">'
    +LEAD_LIST.map(function(l){return'<option'+(l==='سرنخ'?' selected':'')+'>'+l+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="'+labelStyle+'">مسئول</label>'
    +'<select id="ac_owner" style="'+inputStyle+'">'
    +Object.keys(USERS).map(function(u){return'<option value="'+u+'"'+(u===currentUser?' selected':'')+'>'+USERS[u]+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    +'<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:6px;padding:8px;margin-top:10px;font-size:11px;color:#0369a1">'
    +'استان: <strong>'+esc(provName)+'</strong></div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'addCenterModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="_doAddCenter()">➕ افزودن مرکز</button>';
  openModal('addCenterModal','➕ افزودن مرکز جدید',body,foot);
  setTimeout(function(){var n=document.getElementById('ac_name');if(n)n.focus();},100);
}

function _doAddCenter(){
  try{
    if(!_currentProvId){showToast('⚠ استان مشخص نیست');return;}
    var nameEl=document.getElementById('ac_name');
    if(!nameEl){showToast('⚠ خطای فرم');return;}
    var name=nameEl.value.trim();
    if(!name){showToast('نام مرکز را وارد کنید');return;}
    name=name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');

    var centers=getProvCenters(_currentProvId);
    var dup=centers.find(function(c){return fNorm(c.name)===fNorm(name);});
    var similar=!dup&&centers.find(function(c){return _centerNameSimilar(c.name,name);});
    if(dup){showToast('⚠ مرکز «'+dup.name+'» قبلاً ثبت شده',3000);return;}
    if(similar){if(!confirm('⚠ مرکز مشابه «'+similar.name+'» در این استان وجود دارد.\nآیا می‌خواهید «'+name+'» را اضافه کنید؟'))return;}

    var type=(document.getElementById('ac_type').value||'').trim()||'سایر';
    var pot=parseInt((document.getElementById('ac_pot')||{}).value)||2;
    var lead=(document.getElementById('ac_lead')||{}).value||'سرنخ';
    var owner=(document.getElementById('ac_owner')||{}).value||currentUser;
    var rtype=getProvType(_currentProvId);
    var maxRow=centers.length>0?Math.max.apply(null,centers.map(function(c){return c.row||0;})):0;
    var id=rtype+'_new_'+Date.now();

    if(!DB.extra)DB.extra=[];
    DB.extra.push({id:id,row:maxRow+1,name:name,potential:pot,type:type,lead:lead,province_id:_currentProvId,owner:owner});
    saveDB();
    closeModal('addCenterModal');
    // نمایش table-wrap اگه hidden بوده
    var tw=document.querySelector('.table-wrap');if(tw)tw.style.display='';
    renderProvTable();
    showToast('✅ مرکز "'+name+'" اضافه شد');
  }catch(err){
    showToast('❌ خطا: '+err.message,4000);
    console.error('_doAddCenter error:',err);
  }
}

// ════════════════════════ KANBAN / CARD ═════════════
function setViewMode(m){
  _viewMode=m;
  try{localStorage.setItem('_svm',m);}catch(e){}
  ['list','card','pipeline','kanban'].forEach(function(v){
    var b=document.getElementById('vb_'+v);if(b)b.classList.toggle('active',_viewMode===v);
  });
  renderTable();
}

function renderKanban(){
  var tbl=document.getElementById('mainTable');var pg=document.getElementById('provGrid');
  var cv=document.getElementById('cardView');var pv=document.getElementById('pipelineView');
  if(tbl)tbl.style.display='none';if(pg)pg.style.display='none';if(cv)cv.style.display='none';if(pv)pv.style.display='none';
  var kb=document.getElementById('kanbanView');if(!kb)return;
  kb.style.display='';
  var rtype=getProvType(_currentProvId);
  var data=getFiltered();
  if(_sortField){var _rktype=rtype;data=data.slice().sort(function(a,b){
    var ea=getE(_rktype,a.id),eb=getE(_rktype,b.id);var va,vb;
    if(_sortField==='name'){va=a.name;vb=b.name;}
    else if(_sortField==='potential'){va=parseInt(ea.potential||a.potential||9);vb=parseInt(eb.potential||b.potential||9);}
    else if(_sortField==='type'){va=ea.type||a.type||'ω';vb=eb.type||b.type||'ω';}
    else if(_sortField==='lead'){va=LEAD_LIST.indexOf(ea.lead||a.lead||'');vb=LEAD_LIST.indexOf(eb.lead||b.lead||'');if(va<0)va=999;if(vb<0)vb=999;}
    else if(_sortField==='owner'){va=USERS[ea.owner||a.owner||'']||'ω';vb=USERS[eb.owner||b.owner||'']||'ω';}
    else if(_sortField==='followupDate'){va=ea.followupDate||'9999';vb=eb.followupDate||'9999';}
    if(va<vb)return -_sortDir;if(va>vb)return _sortDir;return 0;
  });}
  var groups={};STATUS_LIST.forEach(function(s){groups[s]=[];});
  data.forEach(function(r){var st=getE(rtype,r.id).status||'بدون تماس';(groups[st]=groups[st]||[]).push(r);});
  kb.innerHTML='<div class="kanban-board">'+STATUS_LIST.map(function(st,idx){
    var rows=groups[st]||[];
    return'<div class="kanban-col" ondragover="event.preventDefault();this.classList.add(\'kanban-over\')" ondragleave="this.classList.remove(\'kanban-over\')" ondrop="event.preventDefault();this.classList.remove(\'kanban-over\');onKbDrop(event,\''+rtype+'\',\''+st+'\')">'
      +'<div class="kanban-col-head '+H_CLS[idx]+'">'+st+' <span class="kanban-cnt">'+rows.length+'</span></div>'
      +'<div class="kanban-col-body">'+rows.map(function(r){
        var e=getE(rtype,r.id);var fd=e.followupDate||'';
        return'<div class="kanban-card" draggable="true" ondragstart="event.dataTransfer.setData(\'id\',\''+r.id+'\')" onclick="openCenterModal(\''+rtype+'\',\''+r.id+'\')">'
          +'<div class="kanban-card-name">'+esc(r.name)+'</div>'
          +'<div class="kanban-card-meta">'
          +'<span class="pot-badge pot-'+(e.potential||r.potential)+'">'+(e.potential||r.potential)+'</span>'
          +(e.biopsyScore?'<span class="biopsy-badge" title="پتانسیل بیوپسی (امتیاز: اینترونشنال=۱۰، رادیولوژی=۷، اورولوژی=۶) — '+(e.biopsyReasons||[]).join(' • ')+'">🔬 '+e.biopsyScore+'</span>':'')
          +((e.type||r.type)?'<span class="cm-lead" style="font-size:10px">'+(e.type||r.type)+'</span>':'')
          +(fd?'<span class="kc-date">📅 '+fd+'</span>':'')
          +'</div></div>';
      }).join('')
      +'</div></div>';
  }).join('')+'</div>';
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+data.length+' (کانبان)';
}

function onKbDrop(ev,rtype,st){
  var id=ev.dataTransfer.getData('id');if(!id)return;
  setE(rtype,id,'status',st);renderTable();
}

function renderCards(){
  var tbl=document.getElementById('mainTable');var pg=document.getElementById('provGrid');
  var kb=document.getElementById('kanbanView');var pv=document.getElementById('pipelineView');
  if(tbl)tbl.style.display='none';if(pg)pg.style.display='none';if(kb)kb.style.display='none';if(pv)pv.style.display='none';
  var cv=document.getElementById('cardView');if(!cv)return;
  cv.style.display='';
  var rtype=getProvType(_currentProvId);
  var data=getFiltered();
  if(_sortField){var _rtype2=rtype;data=data.slice().sort(function(a,b){
    var ea=getE(_rtype2,a.id),eb=getE(_rtype2,b.id);var va,vb;
    if(_sortField==='name'){va=a.name;vb=b.name;}
    else if(_sortField==='potential'){va=parseInt(ea.potential||a.potential||9);vb=parseInt(eb.potential||b.potential||9);}
    else if(_sortField==='status'){va=STATUS_LIST.indexOf(ea.status||'بدون تماس');vb=STATUS_LIST.indexOf(eb.status||'بدون تماس');}
    else if(_sortField==='type'){va=ea.type||a.type||'ω';vb=eb.type||b.type||'ω';}
    else if(_sortField==='lead'){va=LEAD_LIST.indexOf(ea.lead||a.lead||'');vb=LEAD_LIST.indexOf(eb.lead||b.lead||'');if(va<0)va=999;if(vb<0)vb=999;}
    else if(_sortField==='owner'){va=USERS[ea.owner||a.owner||'']||'ω';vb=USERS[eb.owner||b.owner||'']||'ω';}
    else if(_sortField==='followupDate'){va=ea.followupDate||'9999';vb=eb.followupDate||'9999';}
    else if(_sortField==='lastActivity'){va=ea._lastActivity||ea._ts||0;vb=eb._lastActivity||eb._ts||0;}
    if(va<vb)return -_sortDir;if(va>vb)return _sortDir;return 0;
  });}
  var today=todayStr();
  cv.innerHTML='<div class="card-grid">'+data.map(function(r){
    var e=getE(rtype,r.id);var st=e.status||'بدون تماس';var sc=stCls(st);
    var fd=e.followupDate||'';var lead=e.lead||r.lead||'';
    var notes=DB.notes[recK(rtype,r.id)]||[];
    var stall=isStalled(rtype,r.id);var ov=isOverdue(rtype,r.id);
    return'<div class="data-card'+(stall?' danger':ov?' warn':'')+'" onclick="openCenterModal(\''+rtype+'\',\''+r.id+'\')">'
      +'<div class="card-head"><span class="card-title">'+esc(r.name)+'</span>'
      +'<span class="pot-badge pot-'+(e.potential||r.potential)+'">'+(e.potential||r.potential)+'</span>'
      +(e.biopsyScore?'<span class="biopsy-badge" title="'+(e.biopsyReasons||[]).join(' • ')+ '">🔬 '+e.biopsyScore+'</span>':'')
      +'</div>'
      +'<div class="card-st '+sc+'">'+st+'</div>'
      +'<div class="card-meta">'
      +((e.type||r.type)?'<span class="cm-lead" style="background:var(--bg-raised);color:var(--text-secondary)">'+(e.type||r.type)+'</span>':'')
      +(lead?'<span class="cm-lead">'+lead+'</span>':'')
      +(fd?'<span class="cm-date'+(ov?' ov':'')+'">📅 '+fd+'</span>':'')
      +(notes.length?'<span class="cm-notes">📝 '+notes.length+'</span>':'')
      +'</div></div>';
  }).join('')+'</div>';
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+data.length+' (کارت)';
}

function renderPipeline() {
  try{
  _buildPCCache();
  var rtype=getProvType(_currentProvId);
  var data=getFiltered();
  // hide sibling views, show pipeline container
  var tbl=document.getElementById('mainTable');if(tbl)tbl.style.display='none';
  var pg=document.getElementById('provGrid');if(pg)pg.style.display='none';
  var cv=document.getElementById('cardView');if(cv)cv.style.display='none';
  var kb=document.getElementById('kanbanView');if(kb)kb.style.display='none';
  var pv=document.getElementById('pipelineView');if(!pv)return;
  pv.style.display='';
  var groups={};
  STATUS_LIST.forEach(function(s){groups[s]=[];});
  data.forEach(function(r){
    var e=getE(rtype,r.id);var st=e.status||'بدون تماس';
    if(!groups[st])groups[st]=[];
    groups[st].push({r:r,e:e});
  });
  var ST_COLORS=['#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#22c55e','#ef4444'];
  var ST_ICONS=['⬜','📞','🤝','📋','✅','🚫'];
  var total=data.length;
  pv.innerHTML='<div class="pipeline-wrap"><div class="pipeline-cols">'
    +STATUS_LIST.map(function(st,idx){
      var items=groups[st]||[];
      var pct=total?Math.round(items.length/total*100):0;
      return'<div class="pipeline-col">'
        +'<div class="pipeline-col-head" style="background:'+ST_COLORS[idx]+'20;border-bottom:2px solid '+ST_COLORS[idx]+'">'
        +'<span>'+ST_ICONS[idx]+' '+st+'</span>'
        +'<span style="background:'+ST_COLORS[idx]+';color:#fff;border-radius:10px;padding:1px 7px">'+items.length+'</span>'
        +'</div>'
        +'<div style="padding:4px 8px;font-size:10px;color:var(--text-muted);border-bottom:1px solid var(--border)">'+pct+'% از کل</div>'
        +'<div class="pipeline-col-body">'
        +items.slice(0,50).map(function(item){
          var owner=USERS[item.e.owner||item.r.owner||'']||'';
          return'<div class="pipeline-card" style="border-right-color:'+ST_COLORS[idx]+'" onclick="openCenterModal(\''+rtype+'\',\''+item.r.id+'\')">'
            +'<div class="pc-name">'+esc(item.r.name)+'</div>'
            +'<div class="pc-meta">'+(owner?'👤 '+esc(owner):'')+(item.e.followupDate?' 📅 '+item.e.followupDate:'')+'</div>'
            +'</div>';
        }).join('')
        +(items.length>50?'<div style="text-align:center;font-size:10px;color:var(--text-muted);padding:4px">... و '+(items.length-50)+' مورد دیگر</div>':'')
        +'</div></div>';
    }).join('')
    +'</div></div>';
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+data.length+' (پایپلاین)';
  }catch(e){_viewMode='list';renderProvTable();}
}


function rebuildFilters(){
  buildTypeFilter();
  var fs=document.getElementById('fStatus');
  if(fs&&fs.children.length<=1){STATUS_LIST.forEach(function(s){var o=document.createElement('option');o.textContent=s;fs.appendChild(o);});}
  var fo=document.getElementById('fOwner');
  if(fo&&fo.children.length<=1){Object.keys(USERS).forEach(function(u){var o=document.createElement('option');o.value=u;o.textContent=USERS[u];fo.appendChild(o);});}
  var ft=document.getElementById('fTag');
  if(ft){ft.innerHTML='<option value="">همه برچسب‌ها</option>';(DB.tags||[]).forEach(function(t){var o=document.createElement('option');o.value=t.id;o.textContent=t.name;ft.appendChild(o);});}
  // banner filters
  var bu=document.getElementById('bannerUser');
  if(bu&&bu.children.length<=1){Object.keys(USERS).forEach(function(u){var o=document.createElement('option');o.value=u;o.textContent=USERS[u];bu.appendChild(o);});}
  var btg=document.getElementById('bannerTag');
  if(btg){btg.innerHTML='<option value="">همه برچسب‌ها</option>';(DB.tags||[]).forEach(function(t){var o=document.createElement('option');o.value=t.id;o.textContent=t.name;btg.appendChild(o);});}
}

// ════════════════════════ TAGS ════════════════════════
function initTags(){
  if(!DB.tags||!DB.tags.length){
    DB.tags=[{id:1,name:'VIP',color:'#dc2626'},{id:2,name:'مذاکره فعال',color:'#0ea5e9'},
      {id:3,name:'کلیدی',color:'#8b5cf6'},{id:4,name:'رقیب جدی',color:'#f97316'},
      {id:5,name:'نیاز پیگیری',color:'#f59e0b'},{id:6,name:'فرصت سفارش',color:'#22c55e'},
      {id:7,name:'بودجه محدود',color:'#64748b'},{id:8,name:'در صف معطل',color:'#94a3b8'}];
    _nextTagId=9;
  }else _nextTagId=Math.max.apply(null,DB.tags.map(function(t){return t.id;}))+1;
}
function renderTagCell(type,id){
  var tgs=rTags(type,id);
  return'<span class="tag-cell">'
    +tgs.map(function(tid){var t=tagById(tid);return t?'<span class="tag-badge" style="background:'+_safeColor(t.color)+'" title="'+esc(t.name)+'">'+esc(t.name)+'</span>':'';}).join('')
    +'<button class="tag-add-btn" onclick="event.stopPropagation();openTagMenu(event,\''+type+'\',\''+id+'\')">+</button>'
    +'</span>';
}
function openTagMenu(ev,type,id){
  ev.stopPropagation();closeTagMenu();
  var assigned=rTags(type,id);
  var menu=document.createElement('div');menu.className='tag-menu';menu.id='tagMenu';
  var top=Math.min(ev.clientY+6,window.innerHeight-300);
  var right=Math.max(window.innerWidth-ev.clientX+6,10);
  menu.style.top=top+'px';menu.style.right=right+'px';
  menu.innerHTML='<input class="tag-srch" placeholder="جستجو..." oninput="filterTagMenu(this.value,\''+type+'\',\''+id+'\')" id="tagSrch">'
    +'<div id="tagList">'+buildTagItems(type,id,assigned)+'</div>'
    +'<div class="tag-new" onclick="createTagPrompt()">+ برچسب جدید</div>';
  document.body.appendChild(menu);
  _tagPickerKey=recK(type,id);
  setTimeout(function(){
    document.getElementById('tagSrch').focus();
    document.addEventListener('click',closeTagMenuOutside);
  },50);
}
function buildTagItems(type,id,assigned){
  if(!assigned)assigned=rTags(type,id);
  return(DB.tags||[]).map(function(t){
    var sel=assigned.indexOf(t.id)!==-1;
    return'<div class="tag-item'+(sel?' sel':'')+'" onclick="toggleTag(\''+type+'\',\''+id+'\','+t.id+')">'
      +'<span><span class="tag-col" style="background:'+_safeColor(t.color)+'"></span>'+esc(t.name)+'</span>'
      +(sel?'<span>✓</span>':'')+'</div>';
  }).join('');
}
function filterTagMenu(q,type,id){
  var el=document.getElementById('tagList');if(!el)return;
  if(!q){el.innerHTML=buildTagItems(type,id,null);return;}
  var nq=fNorm(q);
  var assigned=rTags(type,id);
  el.innerHTML=(DB.tags||[]).filter(function(t){return fNorm(t.name).indexOf(nq)>=0;}).map(function(t){
    var sel=assigned.indexOf(t.id)!==-1;
    return'<div class="tag-item'+(sel?' sel':'')+'" onclick="toggleTag(\''+type+'\',\''+id+'\','+t.id+')">'
      +'<span><span class="tag-col" style="background:'+_safeColor(t.color)+'"></span>'+esc(t.name)+'</span>'
      +(sel?'<span>✓</span>':'')+'</div>';
  }).join('');
}
function toggleTag(type,id,tagId){
  var k=recK(type,id);if(!DB.rTags[k])DB.rTags[k]=[];
  var idx=DB.rTags[k].indexOf(tagId);
  if(idx===-1)DB.rTags[k].push(tagId);else DB.rTags[k].splice(idx,1);
  saveDB();closeTagMenu();
  if(_currentProvId)renderProvTable();else renderBanner();
}
function closeTagMenu(){var m=document.getElementById('tagMenu');if(m)m.remove();document.removeEventListener('click',closeTagMenuOutside);}
function closeTagMenuOutside(e){var m=document.getElementById('tagMenu');if(m&&!m.contains(e.target))closeTagMenu();}

function renderMobileList(data,rtype,today){
  var el=document.getElementById('mobCtrList');
  if(!el)return;
  var tbl=document.getElementById('mainTable');
  var wrap=tbl?tbl.parentElement:null;
  if(wrap)_renderRecentCenters(wrap);
  if(!data.length){el.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px">نتیجه‌ای یافت نشد</div>';return;}
  el.innerHTML=data.map(function(r){
    var e=getE(rtype,r.id);
    var st=e.status||'بدون تماس';var sc=stCls(st);
    var pot=e.potential!==undefined?e.potential:r.potential;
    var fd=e.followupDate||'';
    var fdCls='mob-fd-inp'+(fd&&fd<today?' ov':fd&&fd===today?' today':'');
    var rowCls='mob-ctr-card';
    if(st==='قرارداد بسته شد')rowCls+=' row-contracted';
    else if(isOverdue(rtype,r.id))rowCls+=' row-overdue';
    else if(fd&&fd<=addDaysToJalali(today,3))rowCls+=' row-upcoming';
    else if(isStalled(rtype,r.id))rowCls+=' row-stalled';
    var ownerName=USERS[e.owner||r.owner||'']||e.owner||r.owner||'';
    var ownerColor=window.umGetColor?umGetColor(e.owner||r.owner||''):'#e2e8f0';
    var notes=DB.notes[recK(rtype,r.id)]||[];
    var lastTs=e._lastActivity||e._ts||0;
    var daysSince=lastTs?Math.floor((nowTs()-lastTs)/86400000):null;
    var lastCls=daysSince===null?'color:var(--text-muted)':daysSince===0?'color:#16a34a;font-weight:600':daysSince<=7?'color:#0ea5e9':daysSince<=30?'color:#f59e0b':'color:#dc2626;font-weight:600';
    var lastLbl=daysSince===null?'—':daysSince===0?'امروز':daysSince+' روز پیش';
    var firstPhone=e.phones&&e.phones.length?e.phones[0]:'';
    return'<div class="'+rowCls+'" data-rowid="'+r.id+'">'
      +'<div class="mob-ctr-r1">'
        +'<button class="mob-ctr-name" onclick="openCenterModal(\''+rtype+'\',\''+r.id+'\')" title="باز کردن مرکز">'+esc(r.name)+'</button>'
        +(e.competitor?'<span title="رقیب: '+esc(e.competitor)+'" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:9px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:4px">🤖</span>':'')
        +(isOverdue(rtype,r.id)?'<span title="پیگیری معوق" style="font-size:11px">🟠</span>':'')
        +(isStalled(rtype,r.id)&&st!=='قرارداد بسته شد'?'<span title="۳۰+ روز بدون فعالیت" style="font-size:11px">🔴</span>':'')
        +(e.biopsyScore?'<span title="امتیاز بیوپسی" style="background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;border-radius:9px;padding:1px 6px;font-size:10px;font-weight:700">🔬 '+e.biopsyScore+'</span>':'')
        +'<span class="mob-pot pot-'+pot+'">P'+pot+'</span>'
      +'</div>'
      +'<div class="mob-ctr-r2">'
        +'<select class="mob-st-sel '+sc+'" onchange="onStatus(\''+rtype+'\',\''+r.id+'\',this);this.closest(\'.mob-ctr-card\').className=\'mob-ctr-card\'+(this.value===\'قرارداد بسته شد\'?\' row-contracted\':\'\')">'
          +STATUS_LIST.map(function(s,i){return'<option class="'+STATUS_CLS[i]+'"'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select>'
        +(ownerName?'<span class="mob-owner-pill" style="background:'+ownerColor+'">'+esc(ownerName)+'</span>':'')
      +'</div>'
      +'<div class="mob-ctr-r3">'
        +'<input type="text" class="'+fdCls+'" value="'+fd+'" readonly placeholder="تاریخ پیگیری" onclick="openJDP(this,function(v){setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',v);this.value=v;renderBanner();renderMobileList(getFiltered(),\''+rtype+'\',todayStr());}.bind(this))" style="cursor:pointer">'
        +(firstPhone?'<a href="'+_phoneHref(firstPhone)+'" title="'+_phoneTitle()+'" onclick="event.stopPropagation()" class="mob-act-btn" style="text-decoration:none">📞</a>':'')
        +'<button class="mob-act-btn" onclick="openPreCallBrief(\''+rtype+'\',\''+r.id+'\')" title="خلاصه قبل تماس">🎯</button>'
        +'<button class="mob-act-btn'+(notes.length?' primary':'')+'" onclick="openNotes(\''+rtype+'\',\''+r.id+'\',\''+esc(r.name)+'\')" title="یادداشت‌ها">📝'+(notes.length?' '+notes.length:'')+'</button>'
        +'<button class="mob-act-btn" onclick="quickCallLog(\''+rtype+'\',\''+r.id+'\',\''+esc(r.name)+'\')" title="ثبت سریع تماس">📋</button>'
        +(function(){var _rk2=rtype+'_'+r.id;var _inWk=Object.keys(DB.weekEntries||{}).some(function(k){var we=DB.weekEntries[k];return !we.done&&(we.recKey||(we.rtype+'_'+we.rid))===_rk2;});return '<button class="mob-act-btn'+(_inWk?' primary':'')+'" onclick="openAssignWeekForCenter(\''+rtype+'\',\''+r.id+'\',\''+esc(r.name)+'\')" title="افزودن به برنامه هفته">'+(_inWk?'↪':'📅')+'</button>';}())
        +'<span style="font-size:10px;'+lastCls+';margin-right:auto;padding-right:4px">'+lastLbl+'</span>'
      +'</div>'
    +'</div>';
  }).join('');
  rebuildFilters();
  buildPresetSelector();
  _renderCenterStatsBar(data,rtype);
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+data.length+' مرکز';
}

function createTagPrompt(){
  closeTagMenu();
  var name=prompt('نام برچسب جدید:');if(!name||!name.trim())return;
  var colors=['#0ea5e9','#22c55e','#f59e0b','#dc2626','#8b5cf6','#ec4899','#06b6d4','#64748b'];
  DB.tags.push({id:_nextTagId++,name:name.trim(),color:colors[Math.floor(Math.random()*colors.length)]});
  saveDB();rebuildFilters();showToast('برچسب "'+name.trim()+'" ساخته شد ✅');
}


/* ═══ public/js/center-modal.js ═══ */
// ════════════════════════ JDP ══════════════════════════
var _jdpOutsideHandler=null;
function openJDP(inp,cb){
  closeJDP();
  _jdpCb=cb;_jdpInp=inp;
  var today=todayJ();
  var cur=inp&&inp.value?inp.value.split('/').map(Number):today;
  _jdpDate=[cur[0]||today[0],cur[1]||today[1],1];
  var wrapTop=window.innerHeight/2-180;
  var wrapRight=window.innerWidth/2-115;
  if(inp&&inp.getBoundingClientRect){
    try{
      var rect=inp.getBoundingClientRect();
      if(rect.width>0||rect.height>0){
        wrapTop=Math.min(rect.bottom+4,window.innerHeight-290);
        wrapRight=Math.max(window.innerWidth-rect.right,10);
      }
    }catch(e){}
  }
  var wrap=document.createElement('div');wrap.id='jdpWrap';wrap.className='jdp-wrap';
  wrap.style.top=Math.max(10,wrapTop)+'px';wrap.style.right=Math.max(10,wrapRight)+'px';
  wrap.addEventListener('click',function(e){e.stopPropagation();});
  wrap.innerHTML=buildJDP();
  document.body.appendChild(wrap);
  // named handler برای بتوانیم آن را explicit حذف کنیم
  _jdpOutsideHandler=function(e){
    var w=document.getElementById('jdpWrap');
    if(w&&!w.contains(e.target)&&e.target!==inp)closeJDP();
  };
  setTimeout(function(){document.addEventListener('click',_jdpOutsideHandler);},150);
}
function buildJDP(){
  if(!_jdpDate)return'';
  var jy=_jdpDate[0],jm=_jdpDate[1];
  var total=jDays(jy,jm);var firstDow=jDow(jy,jm,1);
  var today=todayJ();var todayStr2=today[0]+'/'+p2(today[1])+'/'+p2(today[2]);
  var selStr=(_jdpInp&&_jdpInp.value)||'';
  var html='<div class="jdp-head">'
    +'<button onclick="jdpNav(-1)">◀</button>'
    +'<span>'+J_MONTHS[jm-1]+' '+jy+'</span>'
    +'<button onclick="jdpNav(1)">▶</button></div>'
    +'<div class="jdp-grid">'
    +['ش','ی','د','س','چ','پ','ج'].map(function(d){return'<div class="jdp-dow">'+d+'</div>';}).join('');
  // روزهای ماه قبل
  if(firstDow>0){
    var prevM=jm>1?jm-1:12;var prevY=jm>1?jy:jy-1;var prevTotal=jDays(prevY,prevM);
    for(var i=firstDow-1;i>=0;i--){
      var d2=prevTotal-i;
      html+='<div class="jdp-day other" onclick="jdpSelectOther('+prevY+','+prevM+','+d2+')">'+d2+'</div>';
    }
  }
  // روزهای ماه جاری
  for(var d=1;d<=total;d++){
    var dStr=jy+'/'+p2(jm)+'/'+p2(d);
    var cls='jdp-day'+(dStr===todayStr2?' today':'')+(dStr===selStr?' selected':'');
    html+='<div class="'+cls+'" onclick="jdpSel(\''+dStr+'\',event)">'+d+'</div>';
  }
  // روزهای ماه بعد
  var filled=firstDow+total;var remaining=(7-filled%7)%7;
  if(remaining>0){
    var nextM=jm<12?jm+1:1;var nextY=jm<12?jy:jy+1;
    for(var nd=1;nd<=remaining;nd++){
      html+='<div class="jdp-day other" onclick="jdpSelectOther('+nextY+','+nextM+','+nd+')">'+nd+'</div>';
    }
  }
  html+='</div>';return html;
}
function jdpNav(delta){
  if(!_jdpDate)return;
  _jdpDate[1]+=delta;
  if(_jdpDate[1]<1){_jdpDate[1]=12;_jdpDate[0]--;}
  if(_jdpDate[1]>12){_jdpDate[1]=1;_jdpDate[0]++;}
  var w=document.getElementById('jdpWrap');if(w)w.innerHTML=buildJDP();
}
function jdpSel(dateStr,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  var cb=_jdpCb;var inpEl=_jdpInp;
  closeJDP(); // اول ببند تا listener پاک شود
  if(inpEl)inpEl.value=dateStr;
  if(cb)cb(dateStr);
}
function jdpSelectOther(jy,jm,jd){
  _jdpDate=[jy,jm,1];
  var dateStr=jy+'/'+p2(jm)+'/'+p2(jd);
  jdpSel(dateStr);
}
function closeJDP(){
  var w=document.getElementById('jdpWrap');if(w)w.remove();
  if(_jdpOutsideHandler){document.removeEventListener('click',_jdpOutsideHandler);_jdpOutsideHandler=null;}
  _jdpCb=null;_jdpInp=null;
}

// ════════════════════════ MODAL (DOM-based) ════════════
function openModal(id,titleHTML,bodyHTML,footHTML,opts){
  closeModal(id);
  var overlay=document.createElement('div');
  overlay.className='m-overlay';overlay.id='mo_'+id;
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal(id);});
  var box=document.createElement('div');
  box.className='m-box'+(opts&&opts.lg?' lg':'')+(opts&&opts.xl?' xl':'');
  box.addEventListener('click',function(e){if(typeof closeTagMenu==='function')closeTagMenu();e.stopPropagation();});
  var head=document.createElement('div');head.className='m-head';
  head.innerHTML='<span>'+titleHTML+'</span><button class="m-close" onclick="closeModal(\''+id+'\')">✕</button>';
  var body=document.createElement('div');body.className='m-body';body.innerHTML=bodyHTML;
  var foot=document.createElement('div');foot.className='m-foot';foot.innerHTML=footHTML;
  box.appendChild(head);box.appendChild(body);box.appendChild(foot);
  overlay.appendChild(box);document.body.appendChild(overlay);
  return{overlay,box,body,foot};
}
function closeModal(id){
  var m=document.getElementById('mo_'+id);
  if(m)m.remove();
  // also close JDP if open
  closeJDP();
}
function closeAllModals(){
  document.querySelectorAll('.m-overlay').forEach(function(m){m.remove();});
  closeJDP();closeTagMenu();
}

// ════════════════════════ CENTER MODAL ══════════════

function showContactPopup(ev, rtype, id) {
  var e = getE(rtype, id);
  var popup = document.getElementById('centerContactPopup');
  if(!popup) return;
  var nameEl = document.getElementById('ccp-name');
  var bodyEl = document.getElementById('ccp-body');
  var contacts = _getContacts(rtype, id);
  if(nameEl)nameEl.textContent = (contacts.length===1&&contacts[0].name)?contacts[0].name:(contacts.length>0?contacts.length+' مخاطب':'اطلاعات تماس');
  var html = '';
  contacts.forEach(function(c, ci) {
    if(c.name||c.title||(c.phones&&c.phones.length)){
      if(contacts.length>1) html += '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-top:'+(ci>0?'8':'0')+'px;margin-bottom:3px">'+(c.name||'مخاطب '+(ci+1))+(c.title?' — '+c.title:'')+'</div>';
      else if(c.name||c.title) html += '<div class="contact-popup-row" style="font-weight:600;font-size:12px">'+(c.name||'')+(c.title?' ('+c.title+')':'')+'</div>';
      (c.phones||[]).forEach(function(p){
        if(p) html += '<div class="contact-popup-row"><a href="'+_phoneHref(p)+'" title="'+_phoneTitle()+'" onclick="event.stopPropagation()" style="color:#0369a1;text-decoration:none;direction:ltr;display:block">📞 '+esc(p)+'</a></div>';
      });
    }
  });
  if (e.address) html += '<div class="contact-popup-row" style="margin-top:5px;color:var(--text-secondary)">📍 '+esc(e.address)+'</div>';
  if(bodyEl)bodyEl.innerHTML = html || '<span style="color:var(--text-muted);font-size:11px">اطلاعاتی ثبت نشده</span>';
  var rect = ev.target.getBoundingClientRect();
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right - 10) + 'px';
  popup.style.left = 'auto';
  popup.classList.add('show');
  ev.stopPropagation();
}
function hideContactPopup() {
  var popup = document.getElementById('centerContactPopup');
  if (popup) popup.classList.remove('show');
}


/* ═══ public/js/pricing.js ═══ */
// ══════════════════════ PRICING MODULE ══════════════════════════════════════
var _plInited=false;
var _plPayMode='d30',_plViewMode='both',_plActiveMethod='rate',_plPending=null;
var _plMgmtOk=false;

var PL_DEFAULT_PRODUCTS=[
 {id:1,name:'سوزن تمام اتوماتیک برند Geotek',commType:'geotek_full',buyPrice:34121824,
  channels:{hospital:56870000,faradis:56900000,daramazon:62040000,tamin:70210000,modd:64700000,noor:70210000,barakat:63189000,bahman:59864000,salajeghe:60890000,doctor:54060000},
  repPrices:{base:56900000,tiers:[[55200000,56900000,53500000],[53500000,56900000,51800000],[51800000,53500000,50100000],[50100000,51800000,48400000]]}},
 {id:2,name:'سوزن نیمه اتوماتیک برند Geotek + کواکسیال',commType:'geotek_semi',buyPrice:22977196,
  channels:{hospital:38296000,faradis:38300000,daramazon:41777000,tamin:47279000,modd:43600000,noor:47279000,barakat:42552000,bahman:40312000,salajeghe:40990000,doctor:36390000},
  repPrices:{base:38300000,tiers:[[37200000,38300000,36100000],[36100000,38300000,34900000],[34900000,36100000,33800000],[33800000,34900000,32600000]]}},
 {id:3,name:'سوزن گان برند Geotek',commType:'geotek_gun',buyPrice:14144046,
  channels:{hospital:23574000,faradis:23600000,daramazon:25717000,tamin:29104000,modd:26800000,noor:29104000,barakat:26194000,bahman:24815000,salajeghe:25260000,doctor:22420000},
  repPrices:{base:23600000,tiers:[[22900000,23600000,22200000],[22200000,23600000,21500000],[21500000,22200000,20800000],[20800000,21500000,20100000]]}},
 {id:4,name:'سوزن شیبا برند Geotek',commType:'geotek_shiba',buyPrice:10645580,
  channels:{hospital:17743000,faradis:17800000,daramazon:19356000,tamin:21905000,modd:20200000,noor:21905000,barakat:19715000,bahman:18677000,salajeghe:19050000,doctor:16910000},
  repPrices:{base:17800000,tiers:[[17300000,17800000,16800000],[16800000,17800000,16200000],[16200000,16800000,15700000],[15700000,16200000,15200000]]}},
 {id:5,name:'سوزن مغز استخوان برند Geotek',commType:'geotek_bone',buyPrice:21050964,
  channels:{hospital:35085000,faradis:35100000,daramazon:38275000,tamin:43315000,modd:39900000,noor:43315000,barakat:38984000,bahman:36932000,salajeghe:37560000,doctor:33350000},
  repPrices:{base:35100000,tiers:[[34100000,35100000,33000000],[33000000,35100000,32000000],[32000000,33000000,30900000],[30900000,32000000,29900000]]}},
 {id:6,name:'سوزن تمام اتوماتیک برند Geotek مدل Pro',commType:'geotek_full',buyPrice:46782047,
  channels:{hospital:77971000,faradis:78000000,daramazon:85059000,tamin:96260000,modd:88700000,noor:96260000,barakat:86635000,bahman:82075000,salajeghe:83460000,doctor:74100000},
  repPrices:{base:78000000,tiers:[[75700000,78000000,73400000],[73400000,78000000,71000000],[71000000,73400000,68700000],[68700000,71000000,66300000]]}},
 {id:7,name:'سوزن تمام اتوماتیک برند Curaway',commType:'curaway',buyPrice:30328724,
  channels:{hospital:51000000,faradis:51000000,daramazon:null,tamin:62963000,modd:66667000,noor:null,barakat:56667000,bahman:null,salajeghe:null,doctor:48450000},
  repPrices:{base:51000000,tiers:[[49500000,51000000,48000000],[48000000,51000000,46500000],[46500000,48000000,44900000],[44900000,46500000,43400000]]}},
 {id:8,name:'سوزن نیمه اتوماتیک برند Curaway',commType:'curaway',buyPrice:18507376,
  channels:{hospital:31100000,faradis:31100000,daramazon:null,tamin:38396000,modd:40654000,noor:null,barakat:34556000,bahman:null,salajeghe:null,doctor:29550000},
  repPrices:{base:31100000,tiers:[[30200000,31100000,29300000],[29300000,31100000,28400000],[28400000,29300000,27400000],[27400000,28400000,26500000]]}},
 {id:9,name:'سوزن کواکسیال برند Curaway',commType:'curaway',buyPrice:5059530,
  channels:{hospital:8510000,faradis:8510000,daramazon:null,tamin:10507000,modd:11125000,noor:null,barakat:9456000,bahman:null,salajeghe:null,doctor:8090000},
  repPrices:{base:8510000,tiers:[[8300000,8510000,8000000],[8000000,8510000,7800000],[7800000,8000000,7500000],[7500000,7800000,7300000]]}},
 {id:10,name:'کاتتر آرتر لاین Intra 4fr×18g×11cm',commType:'intra',buyPrice:31516980,
  channels:{hospital:50500000,faradis:50500000,daramazon:null,tamin:62346000,modd:66014000,noor:null,barakat:56112000,bahman:null,salajeghe:null,doctor:47980000},
  repPrices:{base:50500000,tiers:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]]}},
 {id:11,name:'کاتتر آرتر لاین Intra 3fr×20g×8cm',commType:'intra',buyPrice:31516980,
  channels:{hospital:50500000,faradis:50500000,daramazon:null,tamin:62346000,modd:66014000,noor:null,barakat:56112000,bahman:null,salajeghe:null,doctor:47980000},
  repPrices:{base:50500000,tiers:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]]}},
 {id:12,name:'کاتتر آرتر لاین Intra 2fr×22g×6cm',commType:'intra',buyPrice:35224860,
  channels:{hospital:56400000,faradis:56400000,daramazon:null,tamin:69630000,modd:73726000,noor:null,barakat:62667000,bahman:null,salajeghe:null,doctor:53580000},
  repPrices:{base:56400000,tiers:[[54800000,56400000,53100000],[53100000,56400000,51400000],[51400000,53100000,49700000],[49700000,51400000,48000000]]}},
 {id:13,name:'رابط یورین بگ آتنا',commType:'intra',buyPrice:2780910,
  channels:{hospital:4450000,faradis:4450000,daramazon:null,tamin:5494000,modd:5817000,noor:null,barakat:4945000,bahman:null,salajeghe:null,doctor:4230000},
  repPrices:{base:4450000,tiers:[[4400000,4450000,4200000],[4200000,4450000,4100000],[4100000,4200000,4000000],[4000000,4100000,3800000]]}},
 {id:14,name:'ست نفروستومی PCN با مکانیزم قفل (سینگل نخدار)',commType:'neph_single',buyPrice:19813000,
  channels:{hospital:128900000,faradis:131400000,daramazon:null,tamin:162223000,modd:171765000,noor:162223000,barakat:146000000,bahman:null,salajeghe:null,doctor:124830000},
  repPrices:{base:131400000,tiers:[[127600000,131400000,123600000],[123400000,127100000,119600000],[119400000,123000000,115700000],[115300000,118700000,111700000]]}},
 {id:15,name:'ست نفروستومی PIGTAIL سینگل (Direct Puncture)',commType:'neph_single',buyPrice:18021000,
  channels:{hospital:117200000,faradis:119800000,daramazon:null,tamin:147902000,modd:156602000,noor:147902000,barakat:133112000,bahman:null,salajeghe:null,doctor:113810000},
  repPrices:{base:119800000,tiers:[[116100000,119800000,112700000],[112600000,116000000,109100000],[108900000,112100000,105500000],[105200000,108300000,101900000]]}},
 {id:16,name:'ست نفروستومی PIGTAIL با مکانیزم قفل (فول)',commType:'neph_full',buyPrice:36032000,
  channels:{hospital:234400000,faradis:236900000,daramazon:null,tamin:292470000,modd:309674000,noor:292470000,barakat:263223000,bahman:null,salajeghe:null,doctor:225060000},
  repPrices:{base:236900000,tiers:[[229800000,236900000,222700000],[222400000,229200000,215600000],[215200000,221900000,208500000],[207900000,214300000,201400000]]}}
];
var PL_DEFAULT_COMM={
  geotek_full:{p10:7021000,p7:4914700,p5:3510500,p4:null,p3:null,p2:null,mohakem:3600000,ghanbari:2000000,salajeghe_c:null},
  geotek_semi:{p10:4727900,p7:3309530,p5:2363950,p4:null,p3:null,p2:null,mohakem:2500000,ghanbari:1500000,salajeghe_c:null},
  geotek_gun: {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  geotek_shiba:{p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  geotek_bone:{p10:4331500,p7:3032050,p5:2165750,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  curaway:    {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  intra:      {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  neph_single:{p10:16222300,p7:11355610,p5:8111150,p4:null,p3:null,p2:null,mohakem:7200000,ghanbari:null,salajeghe_c:null},
  neph_full:  {p10:29247000,p7:20472900,p5:14623500,p4:null,p3:null,p2:null,mohakem:10800000,ghanbari:null,salajeghe_c:null}
};
var PL_DEFAULT_SETT={
  tiers:[{label:'تا ۲۰ عدد',max:20},{label:'۲۱-۵۰ عدد',max:50},{label:'۵۱-۱۰۰ عدد',max:100},{label:'بیش از ۱۰۰',max:999999}],
  commLabels:{p10:'۱۰٪',p7:'۷٪',p5:'۵٪',p4:'۴٪',p3:'۳٪',p2:'۲٪',mohakem:'محکم‌کار',ghanbari:'قنبری',salajeghe_c:'سلاجقه'},
  commNames:{geotek_full:'تمام ژئوتک',geotek_semi:'نیمه ژئوتک',geotek_gun:'گان ژئوتک',geotek_shiba:'شیبا ژئوتک',geotek_bone:'مغز استخوان',curaway:'Curaway',intra:'Intra / آتنا',neph_single:'نفروستومی سینگل',neph_full:'نفروستومی فول'},
  centers:{hospital:'بیمارستان',faradis:'فرادیس',daramazon:'درمازون',tamin:'تامین / نور / هاشمی',modd:'مدد',noor:'نور / هاشمی',barakat:'برکت / فیاض / آتیه / غیاثی',bahman:'بهمن',salajeghe:'سلاجقه',doctor:'پزشک / مرکز درمانی'},
  payLabels:{d30:'۳۰ روزه',d60:'۶۰ روزه',cash:'نقدی'}
};
var PL_CENTER_ICONS={hospital:'🏥',faradis:'🏪',daramazon:'🛒',tamin:'🏛',modd:'🏦',noor:'💙',barakat:'🌟',bahman:'🏢',salajeghe:'🏢',doctor:'👨‍⚕️'};
var PL_PAY_IDX={d30:0,d60:1,cash:2};

var _plP,_plCOMM,_plSETT,_plCOMMLabels,_plCOMMNames,_plCENTERS,_plPAYLBL,_plTIERS;
var _plRepQty=[],_plExpQty=[];

function plLoadData(){
  _plSETT=(DB.pricingSettings&&DB.pricingSettings.tiers)?DB.pricingSettings:JSON.parse(JSON.stringify(PL_DEFAULT_SETT));
  _plP=(DB.pricingProducts&&DB.pricingProducts.length)?DB.pricingProducts.map(function(p){return JSON.parse(JSON.stringify(p));}):PL_DEFAULT_PRODUCTS.map(function(p){return JSON.parse(JSON.stringify(p));});
  _plCOMM=(DB.pricingComm&&Object.keys(DB.pricingComm).length)?DB.pricingComm:JSON.parse(JSON.stringify(PL_DEFAULT_COMM));
  plApplySett();
  _plRepQty=_plP.map(function(){return 0;});
  _plExpQty=_plP.map(function(){return 0;});
}
function plApplySett(){
  var s=_plSETT;
  _plCOMMLabels=Object.assign({},s.commLabels);
  _plCOMMNames=Object.assign({},s.commNames);
  _plCENTERS=Object.assign({},s.centers);
  _plPAYLBL=Object.assign({},s.payLabels);
  _plTIERS=s.tiers.map(function(t,i){return{label:t.label,max:t.max,cls:['','t2','t3','t4'][i]||'t4'};});
}
function plSaveAll(){
  DB.pricingProducts=_plP;
  DB.pricingComm=_plCOMM;
  DB.pricingSettings=_plSETT;
  saveDB();
}
function plFmt(n){return n>0?n.toLocaleString():'—';}
function plPct(b,p){var d=(b-p)/b*100;return d>0.01?d.toFixed(1)+'%':null;}
function plToFa(n){return String(n).replace(/\d/g,function(d){return'۰۱۲۳۴۵۶۷۸۹'[d];});}
function plRound(n){return Math.round(n/1000)*1000;}
function plTierOf(q){for(var i=0;i<_plTIERS.length-1;i++)if(q<=_plTIERS[i].max)return i;return _plTIERS.length-1;}
function plMarginPct(buy,sell){return sell>0?((sell-buy)/sell*100).toFixed(1)+'%':'—';}
function plMarginCls(buy,sell){var m=(sell-buy)/sell*100;return m>=35?'pl-mhi':m>=25?'pl-mmid':'pl-mlo';}
function plReAnim(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}

function pricingLazyInit(){
  if(_plInited)return;
  _plInited=true;
  plLoadData();
  plRenderRep();
  document.getElementById('pl-upd-date').textContent='آخرین آپدیت: '+new Date().toLocaleDateString('fa-IR');
}

function plSwitchTab(t){
  ['rep','expert','mgmt'].forEach(function(k){
    var p=document.getElementById('pl-'+k);if(p)p.style.display=(k===t)?'':'none';
    var b=document.getElementById('pl-t-'+k);if(b)b.classList.toggle('on',k===t);
  });
  if(t==='expert')plRenderExpert();
  if(t==='mgmt'){
    if(_plMgmtOk){plRenderOverview();plRenderBuyInputs();plRenderSett();}
  }
}
function plCheckPw(){
  var inp=document.getElementById('pl-pw-inp');
  if(!inp)return;
  if(inp.value==='62604193'){
    _plMgmtOk=true;
    document.getElementById('pl-mgmt-lock').style.display='none';
    document.getElementById('pl-mgmt-panel').style.display='';
    document.getElementById('pl-pw-err').style.display='none';
    inp.value='';
    plRenderOverview();plRenderBuyInputs();plRenderSett();
    var exp=document.getElementById('pl-expert');
    if(exp&&exp.style.display!=='none')plRenderExpert();
  } else {
    document.getElementById('pl-pw-err').style.display='block';
    inp.value='';inp.focus();
  }
}
function plLockMgmt(){
  _plMgmtOk=false;
  document.getElementById('pl-mgmt-lock').style.display='';
  document.getElementById('pl-mgmt-panel').style.display='none';
  var inp=document.getElementById('pl-pw-inp');if(inp)inp.value='';
  plSwitchTab('rep');
  var exp=document.getElementById('pl-expert');
  if(exp&&exp.style.display!=='none')plRenderExpert();
}

function plSwitchMtab(t){
  ['overview','update','comm','sett'].forEach(function(k){
    var p=document.getElementById('pl-m-'+k);if(p)p.style.display=(k===t)?'':'none';
    var b=document.getElementById('pl-mt-'+k);if(b)b.classList.toggle('on',k===t);
  });
  if(t==='overview')plRenderOverview();
  if(t==='comm')plRenderCommEdit();
  if(t==='sett')plRenderSett();
}

// ── REP VIEW ──────────────────────────────────────────────────────────────────
function plRenderRep(){
  _plRefreshBadges();
  var pi=PL_PAY_IDX[_plPayMode],showU=_plViewMode!=='total',showT=_plViewMode!=='unit';
  var thU=document.getElementById('pl-th-unit'),thT=document.getElementById('pl-th-total');
  if(thU)thU.style.display=showU?'':'none';
  if(thT)thT.style.display=showT?'':'none';
  var tbody=document.getElementById('pl-rep-tbody');
  if(!tbody)return;
  tbody.innerHTML=_plP.map(function(prod,i){
    var q=_plRepQty[i]||0,ti=plTierOf(q),t=_plTIERS[ti];
    var up=prod.repPrices.tiers[ti][pi],tp=q>0?up*q:0,dc=plPct(prod.repPrices.base,up);
    var _catFiles=(_plCatBadge&&_plCatBadge[i])||0;
    return '<tr data-tier="'+ti+'">'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname" style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
      +esc(prod.name)
      +'<button onclick="openProductCatalogModal('+i+')" title="فایل\u2019های کاتالوگ" style="flex-shrink:0;padding:2px 7px;border-radius:5px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:10px;font-family:inherit;white-space:nowrap">'
      +'<span data-plbadge="'+i+'" style="background:#ede9fe;color:#6d28d9;border-radius:9px;padding:1px 4px;font-size:9px;font-weight:700;margin-left:2px;display:'+(_plCatBadge[i]?'inline':'none')+'">'+((_plCatBadge&&_plCatBadge[i])?_plCatBadge[i]:'')+'</span>'
      +'📎</button></td>'
      +'<td class="tc"><input class="pl-qty" type="number" min="0" value="'+(q||'')+'" placeholder="0" oninput="plSetRepQty('+i+',this.value)"></td>'
      +'<td><span class="pl-tbadge">'+esc(t.label)+'</span></td>'
      +'<td class="tr pl-price-u" '+(showU?'':'style="display:none"')+'>'+plFmt(up)+'</td>'
      +'<td class="tr pl-price-t" '+(showT?'':'style="display:none"')+'>'+( tp>0?plFmt(tp):'—')+'</td>'
      +'<td class="tc">'+(dc?'<span class="pl-disc-badge pl-disc-appear">−'+dc+'</span>':'<span style="color:var(--text-muted)">—</span>')+'</td>'
      +'</tr>';
  }).join('');
  plRenderRepSummary(false);
}
function plRenderRepSummary(anim){
  var pi=PL_PAY_IDX[_plPayMode],items=0,tq=0,tv=0;
  _plP.forEach(function(p,i){if(_plRepQty[i]>0){items++;tq+=_plRepQty[i];tv+=p.repPrices.tiers[plTierOf(_plRepQty[i])][pi]*_plRepQty[i];}});
  var sT=document.getElementById('pl-s-total');if(!sT)return;
  var prev=sT.textContent;
  document.getElementById('pl-s-items').textContent=plToFa(items);
  document.getElementById('pl-s-qty').textContent=plToFa(tq);
  sT.textContent=tv>0?plFmt(tv):'—';
  document.getElementById('pl-s-pay').textContent=_plPAYLBL[_plPayMode];
  document.getElementById('pl-rep-chip').textContent=items>0?(plToFa(items)+' قلم — جمع: '+plFmt(tv)+' ریال'):'تعداد سفارش را وارد کنید';
  if(anim&&sT.textContent!==prev)plReAnim(sT,'pl-sum-pulse');
}
function plSetRepQty(i,v){
  var nq=Math.max(0,parseInt(v)||0);_plRepQty[i]=nq;
  var pi=PL_PAY_IDX[_plPayMode],ti=plTierOf(nq),t=_plTIERS[ti];
  var up=_plP[i].repPrices.tiers[ti][pi],tp=nq>0?up*nq:0;
  var dc=plPct(_plP[i].repPrices.base,up);
  var rows=document.getElementById('pl-rep-tbody');if(!rows)return;
  var row=rows.rows[i];if(!row)return;
  row.dataset.tier=ti;
  row.cells[3].innerHTML='<span class="pl-tbadge">'+esc(t.label)+'</span>';
  row.cells[4].textContent=plFmt(up);row.cells[5].textContent=tp>0?plFmt(tp):'—';
  row.cells[6].innerHTML=dc?'<span class="pl-disc-badge pl-disc-appear">−'+dc+'</span>':'<span style="color:var(--text-muted)">—</span>';
  plReAnim(row,'pl-row-glow');plRenderRepSummary(true);
}
function plSetPay(m){
  _plPayMode=m;
  var btns=document.getElementById('pl-pay-btns');
  if(btns)Array.from(btns.children).forEach(function(b,i){b.classList.toggle('on',['d30','d60','cash'][i]===m);});
  plRenderRep();
}
function plSetView(m){
  _plViewMode=m;
  var btns=document.getElementById('pl-view-btns');
  if(btns)Array.from(btns.children).forEach(function(b,i){b.classList.toggle('on',['unit','both','total'][i]===m);});
  plRenderRep();
}
function plClearAll(){_plRepQty=_plP.map(function(){return 0;});plRenderRep();}

// ── PRODUCT CATALOG (FILE ATTACHMENTS PER PRODUCT) ────────────────────────────
var _plCatBadge = {}; // {displayIdx: count}

function _plRefreshBadges(){
  _plCatBadge={};
  if(!_plP||!_plP.length)return;
  _plP.forEach(function(prod,i){
    if(!prod||!prod.id)return;
    fetch('/api/files/list/'+prod.id,{credentials:'include'})
      .then(function(r){return r.ok?r.json():{files:[]};})
      .then(function(d){
        var n=(d.files||[]).length;
        _plCatBadge[i]=n;
        var b=document.querySelector('[data-plbadge="'+i+'"]');
        if(b){b.textContent=n>0?n:'';b.style.display=n>0?'inline':'none';}
      }).catch(function(){});
  });
}

function _plFmtSize(bytes){
  if(!bytes)return'';
  return bytes>1048576?(bytes/1048576).toFixed(1)+' MB':(bytes/1024).toFixed(0)+' KB';
}

function _plFileIcon(mime){
  if(!mime)return'📄';
  if(mime.startsWith('image/'))return'🖼';
  if(mime==='application/pdf')return'📕';
  if(mime.includes('word')||mime.includes('document'))return'📝';
  if(mime.includes('excel')||mime.includes('spreadsheet'))return'📊';
  return'📄';
}

function _plBuildFileRow(f, prodId, isPreview){
  var icon=_plFileIcon(f.mime_type);
  var sz=_plFmtSize(f.file_size);
  var url='/api/files/'+f.id;
  var previewHtml='';
  if(isPreview){
    if(f.mime_type&&f.mime_type.startsWith('image/')){
      previewHtml='<div style="margin:8px 0;text-align:center"><img src="'+url+'" style="max-width:100%;max-height:180px;border-radius:6px;border:1px solid var(--border)" onerror="this.style.display=\'none\'"></div>';
    } else if(f.mime_type==='application/pdf'){
      previewHtml='<div style="margin:8px 0"><iframe src="'+url+'" style="width:100%;height:220px;border:1px solid var(--border);border-radius:6px"></iframe></div>';
    }
  }
  return '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--bg-card);overflow:hidden">'
    +(previewHtml?previewHtml:'')
    +'<div style="display:flex;align-items:center;gap:8px;padding:8px 10px">'
    +'<span style="font-size:18px;flex-shrink:0">'+icon+'</span>'
    +'<div style="flex:1;overflow:hidden;min-width:0">'
    +'<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" dir="ltr">'+esc(f.filename)+'</div>'
    +(sz?'<div style="font-size:10px;color:var(--text-muted)">'+sz+'</div>':'')
    +'</div>'
    +'<a href="'+url+'" target="_blank" style="padding:3px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-size:10px;text-decoration:none;white-space:nowrap">👁 مشاهده</a>'
    +'<a href="'+url+'?dl=1" download="'+esc(f.filename)+'" style="padding:3px 8px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;cursor:pointer;font-size:10px;text-decoration:none">⬇</a>'
    +'<button onclick="plCatShr('+f.id+',\''+esc(f.filename)+'\')" style="padding:3px 8px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">📤</button>'
    +'<button onclick="plCatDel('+f.id+','+prodId+')" style="padding:3px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">✕</button>'
    +'</div></div>';
}

function openProductCatalogModal(prodIdx){
  var prod=_plP[prodIdx];if(!prod||!prod.id){showToast('محصول یافت نشد');return;}
  var prodId=prod.id;
  var body='<div style="font-size:12px">'
    +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">فایل‌های کاتالوگ: <strong>'+esc(prod.name)+'</strong></div>'
    +'<div id="plCatList" style="min-height:40px"><div style="text-align:center;padding:20px;color:var(--text-muted)">در حال بارگذاری...</div></div>'
    +'<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
    +'<label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px;border:2px dashed var(--border);border-radius:8px;cursor:pointer;background:var(--bg-raised)">'
    +'<span style="font-size:26px">☁️</span>'
    +'<span style="font-weight:700;color:var(--text-primary);font-size:12px">افزودن فایل جدید</span>'
    +'<span style="font-size:10px;color:var(--text-muted)">PDF، تصویر، Word و سایر فرمت‌ها — حداکثر ۲۰ مگابایت</span>'
    +'<input id="plCatUpInp" type="file" multiple style="display:none" onchange="plCatUpload('+prodIdx+','+prodId+',this)">'
    +'</label></div></div>';
  openModal('plCatModal','📎 فایل‌های کاتالوگ — '+esc(prod.name),body,'<button class="btn-secondary" onclick="closeModal(\'plCatModal\')">بستن</button>',{lg:true});
  _plCatLoadList(prodIdx, prodId);
}

function _plCatLoadList(prodIdx, prodId){
  fetch('/api/files/list/'+prodId,{credentials:'include'})
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(d){
      var el=document.getElementById('plCatList');
      if(!el)return;
      var files=d.files||[];
      if(!files.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">هیچ فایلی پیوست نشده<br><span style="font-size:10px">PDF، تصویر و سایر فرمت‌ها پشتیبانی می‌شوند</span></div>';return;}
      el.innerHTML=files.map(function(f){return _plBuildFileRow(f,prodId,true);}).join('');
    })
    .catch(function(e){
      var el=document.getElementById('plCatList');
      if(el)el.innerHTML='<div style="color:#dc2626;padding:10px;font-size:11px">خطا در بارگذاری فایل‌ها</div>';
    });
}

function plCatUpload(prodIdx, prodId, input){
  var files=Array.from(input.files||[]);
  if(!files.length)return;
  var fd=new FormData();
  files.forEach(function(f){fd.append('files',f);});
  var el=document.getElementById('plCatList');
  if(el){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">در حال آپلود...</div>';}
  fetch('/api/files/upload/'+prodId,{method:'POST',body:fd,credentials:'include'})
    .then(function(r){return r.ok?r.json():r.json().then(function(d){return Promise.reject(d.error||'خطا');});})
    .then(function(d){
      showToast('✅ '+( d.files?d.files.length:0)+' فایل آپلود شد');
      _plCatLoadList(prodIdx,prodId);
      _plCatBadge[prodIdx]=((_plCatBadge[prodIdx]||0))+(d.files?d.files.length:0);
      var b=document.querySelector('[data-plbadge="'+prodIdx+'"]');
      if(b){b.textContent=_plCatBadge[prodIdx];b.style.display='inline';}
    })
    .catch(function(e){showToast('⚠ آپلود ناموفق: '+e);_plCatLoadList(prodIdx,prodId);});
  input.value='';
}

function plCatShr(fileId, filename){
  var url=window.location.origin+'/api/files/'+fileId;
  if(navigator.share){
    navigator.share({title:filename,url:url}).catch(function(){});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(function(){showToast('📋 لینک کپی شد');});
  } else {
    window.open(url,'_blank');
  }
}

function plCatDel(fileId, prodId){
  var pw=prompt('🔒 برای حذف، رمز مدیریتی را وارد کنید:');
  if(pw===null)return;
  if(pw!=='62604193'){showToast('⛔ رمز اشتباه است');return;}
  fetch('/api/files/'+fileId,{method:'DELETE',credentials:'include'})
    .then(function(r){return r.ok?r.json():Promise.reject('خطا');})
    .then(function(){
      showToast('🗑 فایل حذف شد');
      // find prodIdx from prodId
      var prodIdx=_plP.findIndex(function(p){return p&&p.id===prodId;});
      if(_plCatBadge[prodIdx]>0)_plCatBadge[prodIdx]--;
      var b=document.querySelector('[data-plbadge="'+prodIdx+'"]');
      if(b){
        var n=_plCatBadge[prodIdx]||0;
        b.textContent=n>0?n:'';b.style.display=n>0?'inline':'none';
      }
      // reload list
      _plCatLoadList(prodIdx, prodId);
    })
    .catch(function(){showToast('⚠ خطا در حذف فایل');});
}

// ── EXPERT VIEW ───────────────────────────────────────────────────────────────
function plRenderExpert(){
  var cs=document.getElementById('pl-center-sel');if(!cs)return;
  var cv=cs.value;
  cs.innerHTML=Object.keys(_plCENTERS).map(function(k){return'<option value="'+k+'">'+(PL_CENTER_ICONS[k]||'')+' '+esc(_plCENTERS[k])+'</option>';}).join('');
  if(cv&&_plCENTERS[cv])cs.value=cv;
  var ts=document.getElementById('pl-comm-type-sel');if(ts){
    var tv=ts.value;
    ts.innerHTML=Object.keys(_plCOMMLabels).map(function(k){return'<option value="'+k+'">'+esc(_plCOMMLabels[k])+'</option>';}).join('');
    if(tv&&_plCOMMLabels[tv])ts.value=tv;
  }
  var center=cs.value||Object.keys(_plCENTERS)[0];
  var useComm=(document.getElementById('pl-comm-toggle')||{}).checked;
  var commKey=(document.getElementById('pl-comm-type-sel')||{}).value||Object.keys(_plCOMMLabels)[0];
  var lbl=document.getElementById('pl-comm-toggle-lbl');if(lbl)lbl.textContent=useComm?'بله':'خیر';
  var grp=document.getElementById('pl-comm-type-grp');if(grp)grp.style.display=useComm?'':'none';
  var thComm=document.getElementById('pl-th-comm');if(thComm)thComm.style.display=useComm?'':'none';
  var showMargin=_plMgmtOk;
  var thMarg=document.getElementById('pl-th-margin');if(thMarg)thMarg.style.display=showMargin?'':'none';
  var eMarginW=document.getElementById('pl-e-margin-wrap');if(eMarginW)eMarginW.style.display=showMargin?'':'none';
  var ePctW=document.getElementById('pl-e-pct-wrap');if(ePctW)ePctW.style.display=showMargin?'':'none';
  var chip=document.getElementById('pl-expert-chip');if(chip)chip.textContent=_plCENTERS[center]||center;
  var title=document.getElementById('pl-expert-title');if(title)title.textContent='قیمت‌های پیشنهادی — '+(_plCENTERS[center]||center);
  var totSell=0,totComm=0,totBuy=0;
  var tbody=document.getElementById('pl-expert-tbody');if(!tbody)return;
  tbody.innerHTML=_plP.map(function(prod,i){
    var price=prod.channels[center];
    var comm=useComm&&_plCOMM[prod.commType]?(_plCOMM[prod.commType][commKey]||0):0;
    var q=_plExpQty[i]||0;
    var totalSell=q>0&&price?price*q:0;
    var totalComm=q>0?comm*q:0;
    var netMargin=price?(price-prod.buyPrice-comm):0;
    var marginP=price?((netMargin/price)*100).toFixed(1)+'%':'—';
    var mCls=price&&netMargin>0?plMarginCls(prod.buyPrice+comm,price):'pl-mlo';
    if(q>0&&price){totSell+=price*q;totComm+=comm*q;totBuy+=prod.buyPrice*q;}
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname" style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
      +esc(prod.name)
      +'<button onclick="openProductCatalogModal('+i+')" title="فایل\u2019های کاتالوگ" style="flex-shrink:0;padding:2px 7px;border-radius:5px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:10px;font-family:inherit;white-space:nowrap">'
      +'<span data-plbadge="'+i+'" style="background:#ede9fe;color:#6d28d9;border-radius:9px;padding:1px 4px;font-size:9px;font-weight:700;margin-left:2px;display:'+(_plCatBadge[i]?'inline':'none')+'">'+((_plCatBadge&&_plCatBadge[i])?_plCatBadge[i]:'')+'</span>'
      +'📎</button></td>'
      +'<td class="tc"><input class="pl-qty" type="number" min="0" value="'+(q||'')+'" placeholder="0" oninput="plSetExpQty('+i+',this.value)"></td>'
      +'<td class="tr" style="font-weight:700;color:var(--text-primary)">'+(price?plFmt(price):'<span style="color:var(--text-muted)">موجود نیست</span>')+'</td>'
      +(useComm?'<td class="tr">'+(comm>0?'<span class="pl-comm-badge pl-comm-green">'+plFmt(comm)+'</span>':'<span class="pl-comm-badge pl-comm-na">—</span>')+'</td>':'')
      +(showMargin?'<td class="tc"><span class="pl-margin-chip '+mCls+'">'+(price?marginP:'—')+'</span></td>':'')
      +'<td class="tr pl-price-t">'+(totalSell>0?plFmt(totalSell):'—')+'</td>'
      +'</tr>';
  }).join('');
  var eSell=document.getElementById('pl-e-sell');if(eSell)eSell.textContent=totSell>0?plFmt(totSell):'—';
  var eComm=document.getElementById('pl-e-comm');if(eComm)eComm.textContent=totComm>0?plFmt(totComm):'—';
  var netC=totSell-totBuy-totComm;
  var eMarg=document.getElementById('pl-e-margin');if(eMarg)eMarg.textContent=netC>0?plFmt(netC):'—';
  var ePct=document.getElementById('pl-e-pct');if(ePct)ePct.textContent=totSell>0?(netC/totSell*100).toFixed(1)+'٪':'—';
}
function plSetExpQty(i,v){_plExpQty[i]=Math.max(0,parseInt(v)||0);plRenderExpert();}

// ── MANAGEMENT ────────────────────────────────────────────────────────────────
function _plCellEdit(i,field,isNum){
  var id='plcell-'+i+'-'+field;
  var sz=isNum===false?'wide':'';
  return '<td id="'+id+'" class="pl-cell-edit tc" onclick="plEditCell('+i+',\''+field+'\','+(!isNum)+')">'+
    (field==='buyPrice'?'<span style="color:#f59e0b;font-weight:700">'+plFmt(_plP[i].buyPrice)+'</span>':
     field==='name'?'<span class="pl-pname" style="font-size:12px">'+esc(_plP[i].name)+'</span>':
     (_plP[i].channels[field]?plFmt(_plP[i].channels[field]):'<span style="color:var(--text-muted)">—</span>'))+'</td>';
}
function plRenderOverview(){
  var tbody=document.getElementById('pl-overview-tbody');if(!tbody)return;
  var CHANS=['hospital','faradis','daramazon','tamin','modd','noor','barakat','bahman','salajeghe','doctor'];
  tbody.innerHTML=_plP.map(function(p,i){
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +_plCellEdit(i,'name',false)
      +_plCellEdit(i,'buyPrice',true)
      +_plCellEdit(i,'hospital',true)
      +'<td class="tc"><span class="pl-margin-chip '+plMarginCls(p.buyPrice,p.channels.hospital)+'">'+plMarginPct(p.buyPrice,p.channels.hospital)+'</span></td>'
      +_plCellEdit(i,'faradis',true)
      +_plCellEdit(i,'daramazon',true)
      +_plCellEdit(i,'tamin',true)
      +_plCellEdit(i,'modd',true)
      +_plCellEdit(i,'noor',true)
      +_plCellEdit(i,'barakat',true)
      +_plCellEdit(i,'bahman',true)
      +_plCellEdit(i,'salajeghe',true)
      +_plCellEdit(i,'doctor',true)
      +'</tr>';
  }).join('');
}
function plEditCell(prodIdx,field,isText){
  var id='plcell-'+prodIdx+'-'+field;
  var td=document.getElementById(id);if(!td)return;
  var cur=field==='name'?_plP[prodIdx].name:(field==='buyPrice'?_plP[prodIdx].buyPrice:(_plP[prodIdx].channels[field]||''));
  var inp='<input class="pl-cell-inp'+(isText?' wide':'')+'" type="'+(isText?'text':'number')+'" value="'+esc(String(cur))+'" min="0" '
    +'onblur="plSaveCell('+prodIdx+',\''+field+'\',this.value)" '
    +'onkeydown="if(event.key===\'Enter\')this.blur();if(event.key===\'Escape\'){event.preventDefault();plRenderOverview();}">';
  td.innerHTML=inp;
  var el=td.querySelector('input');if(el){el.focus();el.select();}
}
function plSaveCell(prodIdx,field,val){
  var p=_plP[prodIdx];
  if(field==='name'){
    var nm=val.trim();if(!nm)return plRenderOverview();
    p.name=nm;
  } else {
    var n=Math.round(parseFloat(val));
    if(isNaN(n)||n<0)return plRenderOverview();
    if(field==='buyPrice')p.buyPrice=n;
    else p.channels[field]=(n||null);
  }
  plSaveAll();plRenderOverview();plRenderRep();
  showToast('✅ ذخیره شد',1200);
}
function plRenderBuyInputs(){
  var grid=document.getElementById('pl-buy-grid');if(!grid)return;
  grid.innerHTML=_plP.map(function(p,i){
    return '<div class="pl-inp-row">'
      +'<span class="pl-inp-lbl">'+(p.name.length>28?p.name.substring(0,28)+'…':p.name)+'</span>'
      +'<input class="pl-num-inp" type="number" id="pl-buy-inp-'+i+'" placeholder="'+p.buyPrice.toLocaleString()+'" min="0">'
      +'</div>';
  }).join('');
}
function plSelMethod(m){
  _plActiveMethod=m;
  ['rate','buy','pct'].forEach(function(k){
    var mc=document.getElementById('pl-mc-'+k);if(mc)mc.classList.toggle('sel',k===m);
    var md=document.getElementById('pl-method-'+k);if(md)md.style.display=k===m?'block':'none';
  });
  var prev=document.getElementById('pl-preview-section');if(prev)prev.style.display='none';
  _plPending=null;
}
function plPreviewUpdate(method){
  var updates=[];
  if(method==='rate'){
    var pctVal=parseFloat((document.getElementById('pl-rate-pct')||{}).value);
    if(isNaN(pctVal)){showToast('⚠ درصد تغییر را وارد کنید');return;}
    var ratio=1+pctVal/100;
    updates=_plP.map(function(p,i){
      var nc={};Object.keys(p.channels).forEach(function(k){nc[k]=p.channels[k]?plRound(p.channels[k]*ratio):null;});
      return{idx:i,newBuy:plRound(p.buyPrice*ratio),ratio:ratio,newChannels:nc,newBase:plRound(p.repPrices.base*ratio)};
    });
  }else if(method==='buy'){
    updates=_plP.map(function(p,i){
      var el=document.getElementById('pl-buy-inp-'+i);
      var nv=el?parseFloat(el.value):NaN;
      if(!nv||isNaN(nv)){var nc2={};Object.keys(p.channels).forEach(function(k){nc2[k]=p.channels[k];});return{idx:i,newBuy:p.buyPrice,ratio:1,newChannels:nc2,newBase:p.repPrices.base,skip:true};}
      var ratio2=nv/p.buyPrice;
      var nc3={};Object.keys(p.channels).forEach(function(k){nc3[k]=p.channels[k]?plRound(p.channels[k]*ratio2):null;});
      return{idx:i,newBuy:nv,ratio:ratio2,newChannels:nc3,newBase:plRound(p.repPrices.base*ratio2)};
    });
  }else{
    var pv2=parseFloat((document.getElementById('pl-sell-pct')||{}).value);
    if(isNaN(pv2)){showToast('⚠ درصد افزایش را وارد کنید');return;}
    var ratio3=1+pv2/100;
    updates=_plP.map(function(p,i){
      var nc4={};Object.keys(p.channels).forEach(function(k){nc4[k]=p.channels[k]?plRound(p.channels[k]*ratio3):null;});
      return{idx:i,newBuy:p.buyPrice,ratio:ratio3,newChannels:nc4,newBase:plRound(p.repPrices.base*ratio3)};
    });
  }
  _plPending=updates;
  var prev2=document.getElementById('pl-preview-section');if(!prev2)return;
  document.getElementById('pl-preview-tbody').innerHTML=updates.map(function(u,i){
    var p=_plP[i];var diff=((u.ratio-1)*100).toFixed(1);
    var diffHtml=u.ratio>=1?'<span class="pl-diff-pos">+'+diff+'٪</span>':'<span class="pl-diff-neg">'+diff+'٪</span>';
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname">'+esc(p.name)+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.buyPrice)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#f59e0b">'+(u.skip?'—':plFmt(u.newBuy))+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.channels.faradis)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#16a34a">'+plFmt(u.newChannels.faradis)+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.channels.hospital)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#16a34a">'+plFmt(u.newChannels.hospital)+'</td>'
      +'<td class="tc">'+(u.skip?'—':diffHtml)+'</td>'
      +'</tr>';
  }).join('');
  prev2.style.display='block';
  prev2.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function plApplyUpdate(){
  if(!_plPending)return;
  _plPending.forEach(function(u,i){
    if(u.skip)return;
    var p=_plP[i];p.buyPrice=u.newBuy;
    Object.assign(p.channels,u.newChannels);
    var tiers=p.repPrices.tiers;p.repPrices.base=u.newBase;
    p.repPrices.tiers=tiers.map(function(tier){return tier.map(function(v){return plRound(v*u.ratio);});});
  });
  plSaveAll();plRenderRep();plRenderOverview();
  var prev=document.getElementById('pl-preview-section');if(prev)prev.style.display='none';
  _plPending=null;
  document.getElementById('pl-upd-date').textContent='آخرین آپدیت: '+new Date().toLocaleDateString('fa-IR');
  showToast('✅ قیمت‌ها با موفقیت بروزرسانی شد',3000);
}
function plCancelPreview(){var p=document.getElementById('pl-preview-section');if(p)p.style.display='none';_plPending=null;}

// ── COMMISSIONS ───────────────────────────────────────────────────────────────
function plRenderCommEdit(){
  var grid=document.getElementById('pl-comm-edit-grid');if(!grid)return;
  grid.innerHTML=Object.keys(_plCOMM).map(function(key){
    var vals=_plCOMM[key];
    return '<div class="pl-comm-item">'
      +'<div class="pl-cei-title">'+esc(_plCOMMNames[key]||key)+'</div>'
      +Object.keys(_plCOMMLabels).map(function(k){
        return '<div class="pl-cei-row">'
          +'<span class="pl-cei-lbl">'+esc(_plCOMMLabels[k])+'</span>'
          +'<input class="pl-cei-inp" type="number" id="plci-'+key+'-'+k+'" value="'+(vals[k]||'')+'" placeholder="—">'
          +'</div>';
      }).join('')
      +'</div>';
  }).join('');
}
function plSaveComm(){
  Object.keys(_plCOMM).forEach(function(key){
    Object.keys(_plCOMMLabels).forEach(function(k){
      var el=document.getElementById('plci-'+key+'-'+k);
      if(el){var v=parseFloat(el.value);_plCOMM[key][k]=isNaN(v)?null:v;}
    });
  });
  plSaveAll();
  var s=document.getElementById('pl-comm-status');
  if(s){s.textContent='✅ پورسانت‌ها با موفقیت ذخیره شدند';s.className='pl-status ok';setTimeout(function(){s.className='pl-status';},3000);}
}
function plResetComm(){
  if(!confirm('آیا از بازگشت به مقادیر اولیه مطمئن هستید؟'))return;
  _plCOMM=JSON.parse(JSON.stringify(PL_DEFAULT_COMM));
  plSaveAll();plRenderCommEdit();
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function _plSettObj(pfx){
  if(pfx==='plsp')return _plSETT.payLabels;
  if(pfx==='plsc')return _plSETT.centers;
  if(pfx==='plscl')return _plSETT.commLabels;
  if(pfx==='plscn')return _plSETT.commNames;
  return {};
}
function _plFlushObjSection(pfx){
  var obj=_plSettObj(pfx);var keys=Object.keys(obj);
  var newObj={};
  keys.forEach(function(k,i){
    var kEl=document.getElementById(pfx+'-key-'+i);
    var vEl=document.getElementById(pfx+'-val-'+i);
    var nk=kEl?kEl.value.trim():k;
    var nv=vEl?vEl.value.trim():obj[k];
    if(nk&&nv)newObj[nk]=nv;
  });
  keys.forEach(function(k){delete obj[k];});
  Object.assign(obj,newObj);
}
function _plFlushTiers(){
  _plSETT.tiers=_plSETT.tiers.map(function(t,i){
    var lbl=(document.getElementById('plst-lbl-'+i)||{}).value||t.label;
    var maxEl=document.getElementById('plst-max-'+i);
    var max=maxEl?(parseFloat(maxEl.value)||t.max):t.max;
    return{label:lbl.trim()||t.label,max:max};
  });
}
function _plObjSectionHTML(pfx,data,placeholder){
  var keys=Object.keys(data);
  var rows=keys.map(function(k,i){
    return '<div class="pl-sett-row">'
      +'<input class="pl-sett-inp" id="'+pfx+'-key-'+i+'" value="'+esc(k)+'" placeholder="کد" style="width:100px;flex:none;direction:ltr;font-size:11px">'
      +'<input class="pl-sett-inp" id="'+pfx+'-val-'+i+'" value="'+esc(data[k])+'" placeholder="'+esc(placeholder)+'">'
      +(keys.length>1?'<button onclick="plRemoveSettKey(\''+pfx+'\','+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;line-height:1;padding:0 3px;flex-shrink:0" title="حذف">✕</button>':'')
      +'</div>';
  }).join('');
  return rows
    +'<div style="display:flex;gap:5px;margin-top:4px">'
    +'<input id="'+pfx+'-new-key" type="text" placeholder="کد جدید..." style="width:100px;flex:none;direction:ltr;font-size:11px;padding:5px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<input id="'+pfx+'-new-val" type="text" placeholder="'+esc(placeholder)+'..." style="flex:1;font-size:12px;padding:5px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<button onclick="plAddSettKey(\''+pfx+'\')" style="padding:5px 14px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:12px;font-family:inherit;cursor:pointer;font-weight:700;flex-shrink:0">+ اضافه</button>'
    +'</div>';
}
function plAddSettKey(pfx){
  _plFlushObjSection(pfx);
  var kEl=document.getElementById(pfx+'-new-key');
  var vEl=document.getElementById(pfx+'-new-val');
  if(!kEl||!vEl)return;
  var k=kEl.value.trim();var v=vEl.value.trim();
  if(!k||!v){showToast('کد و نام نمایشی را وارد کنید');return;}
  var obj=_plSettObj(pfx);
  if(obj.hasOwnProperty(k)){showToast('این کد قبلاً وجود دارد');return;}
  obj[k]=v;kEl.value='';vEl.value='';
  plRenderSett();
}
function plRemoveSettKey(pfx,i){
  _plFlushObjSection(pfx);
  var obj=_plSettObj(pfx);var keys=Object.keys(obj);
  if(keys.length<=1){showToast('حداقل یک ردیف باید باقی بماند');return;}
  delete obj[keys[i]];
  plRenderSett();
}
function plAddTier(){
  _plFlushTiers();
  var n=_plSETT.tiers.length;
  var prevMax=n>1?_plSETT.tiers[n-2].max:100;
  _plSETT.tiers.splice(n-1,0,{label:'سطح جدید',max:prevMax+100});
  plRenderSett();
}
function plRemoveTier(i){
  _plFlushTiers();
  if(_plSETT.tiers.length<=1){showToast('حداقل یک سطح باید باقی بماند');return;}
  _plSETT.tiers.splice(i,1);
  plRenderSett();
}
function plRenderSett(){
  var tg=document.getElementById('pl-sett-tiers');
  if(tg){
    var tiersHtml=_plSETT.tiers.map(function(t,i){
      var isLast=i===_plSETT.tiers.length-1;
      return '<div class="pl-sett-row">'
        +'<input class="pl-sett-inp" id="plst-lbl-'+i+'" value="'+esc(t.label)+'" placeholder="نام سطح" style="flex:2">'
        +(isLast?'<span class="pl-sett-lbl" style="font-size:10px">بدون سقف</span>'
          :'<span class="pl-sett-lbl">حداکثر:</span><input class="pl-sett-inp num" id="plst-max-'+i+'" type="number" value="'+t.max+'" min="1">')
        +(i>0?'<button onclick="plRemoveTier('+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;line-height:1;padding:0 3px;flex-shrink:0" title="حذف">✕</button>':'<span style="width:22px;flex-shrink:0"></span>')
        +'</div>';
    }).join('');
    tg.innerHTML=tiersHtml
      +'<button onclick="plAddTier()" style="margin-top:4px;padding:5px 14px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:12px;font-family:inherit;cursor:pointer;font-weight:700">+ افزودن سطح</button>';
  }
  var pg=document.getElementById('pl-sett-pay');
  if(pg)pg.innerHTML=_plObjSectionHTML('plsp',_plSETT.payLabels,'نام نمایشی');
  var cg=document.getElementById('pl-sett-centers');
  if(cg)cg.innerHTML=_plObjSectionHTML('plsc',_plSETT.centers,'نام مرکز');
  var clg=document.getElementById('pl-sett-commlabels');
  if(clg)clg.innerHTML=_plObjSectionHTML('plscl',_plSETT.commLabels,'برچسب پورسانت');
  var cng=document.getElementById('pl-sett-commnames');
  if(cng)cng.innerHTML=_plObjSectionHTML('plscn',_plSETT.commNames,'نام دسته');
}
function plSaveSett(){
  _plFlushTiers();
  ['plsp','plsc','plscl','plscn'].forEach(_plFlushObjSection);
  plApplySett();plSaveAll();plRenderRep();plRenderSett();
  var s=document.getElementById('pl-sett-status');
  if(s){s.textContent='✅ تنظیمات با موفقیت ذخیره شد';s.className='pl-status ok';setTimeout(function(){s.className='pl-status';},3000);}
}
function plResetSett(){
  if(!confirm('آیا از بازگشت همه تنظیمات به حالت پیش‌فرض مطمئن هستید؟'))return;
  _plSETT=JSON.parse(JSON.stringify(PL_DEFAULT_SETT));
  plApplySett();plSaveAll();plRenderSett();plRenderRep();
}
// ════════════════ END PRICING MODULE ════════════════════════════

document.addEventListener('click', function(ev) {
  var popup = document.getElementById('centerContactPopup');
  if (popup && popup.classList.contains('show') && !popup.contains(ev.target)) hideContactPopup();
});
function openCenterAudit(centerKey, centerName) {
  var rtype=centerKey.split('_')[0], rid=centerKey.split('_')[1];
  var events=[];
  // changeLog
  (DB.changeLog||[]).filter(function(h){return h.rkey===centerKey;}).forEach(function(h){
    var d=new Date(h.at);
    var fmap={status:'وضعیت',owner:'مسئول',lead:'سرنخ',potential:'پتانسیل',followupDate:'تاریخ پیگیری',nameOverride:'نام',address:'آدرس','type':'نوع'};
    events.push({ts:d.getTime(),type:'change',icon:'✏️',color:'#8b5cf6',
      title:(fmap[h.field]||h.field)+' تغییر کرد',
      detail:'مقدار: '+String(h.val||'—').substring(0,40),
      by:h.by,at:d,dateStr:''});
  });
  // notes
  (DB.notes[rtype+'_'+rid]||[]).forEach(function(n){
    var dp=n.date?n.date.split('/').map(Number):(n.at?(function(){var _nd=new Date(n.at);return g2j(_nd.getFullYear(),_nd.getMonth()+1,_nd.getDate());}()):null);
    var g=dp?j2g(dp[0],dp[1],dp[2]):[2000,1,1];
    var ts=dp?new Date(g[0],g[1]-1,g[2]).getTime():0;
    events.push({ts:ts,type:'note',icon:'📝',color:'#0ea5e9',
      title:'یادداشت',detail:String(n.text||'').substring(0,60),by:n.by||n.user,at:null,dateStr:n.date||(n.at?fmtDate(n.at):'')||''});
  });
  // weekEntries done
  Object.values(DB.weekEntries||{}).filter(function(we){return we.recKey===centerKey&&we.done;}).forEach(function(we){
    var dp=we.doneDate?we.doneDate.split('/').map(Number):null;
    var ts=dp?jMs(dp[0],dp[1],dp[2]):0;
    var icon=we.actionType==='visit'?'🤝':'📞';
    events.push({ts:ts,type:'done',icon:icon,color:'#22c55e',
      title:(we.actionType==='visit'?'ویزیت انجام شد':'تماس انجام شد'),
      detail:(we.doneResult?'نتیجه: '+we.doneResult+' ':'')+(we.doneNote||''),
      by:we.addedBy||'',at:null,dateStr:we.doneDate||''});
  });
  // tasks
  (DB.tasks||[]).filter(function(t){return t.centerKey===centerKey;}).forEach(function(t){
    var dp=t.dueDate?t.dueDate.split('/').map(Number):null;
    var ts=dp?jMs(dp[0],dp[1],dp[2]):0;
    events.push({ts:ts,type:'task',icon:t.done?'✅':'📌',color:t.done?'#22c55e':'#f59e0b',
      title:(t.done?'وظیفه انجام شد':'وظیفه')+': '+String(t.title||'').substring(0,30),
      detail:t.note||'',by:t.owner||'',at:null,dateStr:t.dueDate||''});
  });

  events.sort(function(a,b){return b.ts-a.ts;});

    var body='<div style="max-height:70vh;overflow-y:auto;padding:8px 4px">';
  if(!events.length){
    body+='<div style="text-align:center;padding:30px;color:var(--text-muted)">هیچ رویدادی ثبت نشده</div>';
  } else {
    body+='<div style="position:relative;padding-right:32px">'
      +'<div style="position:absolute;right:14px;top:8px;bottom:8px;width:2px;background:var(--border)"></div>';
    events.forEach(function(ev){
      var dateStr=ev.dateStr||(ev.at?(function(){var d=ev.at,jd=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);}()):'');
      var timeStr=ev.at?(' '+p2(ev.at.getHours())+':'+p2(ev.at.getMinutes())):'';
      var byName=(typeof USERS!=='undefined'?USERS[ev.by]:null)||ev.by||'';
      body+='<div style="position:relative;margin-bottom:12px">'
        +'<div style="position:absolute;right:-26px;top:8px;width:16px;height:16px;border-radius:50%;background:'+ev.color+';border:2px solid var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:9px">'+ev.icon+'</div>'
        +'<div style="background:var(--bg-raised);border-radius:8px;padding:9px 12px;border:1px solid var(--border)">'
        +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
        +'<span style="font-weight:700;font-size:12px;color:'+ev.color+'">'+esc(ev.title)+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted);margin-right:auto">'+esc(dateStr+timeStr)+'</span>'
        +'</div>'
        +(ev.detail?'<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:3px">'+esc(ev.detail)+'</div>':'')
        +(byName?'<div style="font-size:10px;color:var(--text-muted)">👤 '+esc(byName)+'</div>':'')
        +'</div></div>';
    });
    body+='</div>';
  }
  body+='</div>';
  openModal('auditModal','📅 تاریخچه — '+esc(centerName),body,'<button class="btn-secondary" onclick="closeModal(\'auditModal\')">\u0628\u0633\u062a\u0646</button>',{lg:true});
}

function _updateExtraCenterProv(id,newProvId){
  var idx=(DB.extra||[]).findIndex(function(x){return x.id===id;});
  if(idx<0)return;
  DB.extra[idx].province_id=newProvId;
  clearPCCache();_ALL_PROVS=null;
  saveDB();showToast('✅ استان به‌روز شد');
}

function _getCompetitorList(){
  var comps={};
  Object.values(DB.edits||{}).forEach(function(e){
    if(e&&e.competitor&&e.competitor.trim()){
      e.competitor.trim().split(/[,،/]+/).forEach(function(c){
        c=c.trim();
        if(c.length>1)comps[c]=(comps[c]||0)+1;
      });
    }
  });
  return Object.keys(comps).sort(function(a,b){return comps[b]-comps[a];});
}

function openCenterModal(rtype,id){
  // Track recent centers
  var _rcKey=rtype+'_'+id;
  _recentCenters=_recentCenters.filter(function(x){return x.key!==_rcKey;});
  _recentCenters.unshift({key:_rcKey,rtype:rtype,id:id,name:_getCenterName(rtype,id),ts:Date.now()});
  if(_recentCenters.length>8)_recentCenters=_recentCenters.slice(0,8);
  var prov=_currentProvId;
  if(!prov){
    // باید استان را پیدا کنیم
    getAllProvinces().some(function(p){
      var pt=getProvType(p.id);
      if(pt===rtype||rtype==='center'&&p.id==='tehran'){
        var c=getProvCenters(p.id).find(function(x){return String(x.id)===String(id);});
        if(c){prov=p.id;return true;}
      }else if(pt==='pc'&&rtype==='pc'){
        var c2=getProvCenters(p.id).find(function(x){return String(x.id)===String(id);});
        if(c2){prov=p.id;return true;}
      }
      return false;
    });
  }
  var centers=getProvCenters(prov||'tehran');
  var r=centers.find(function(x){return String(x.id)===String(id);});
  if(!r){r=(DB.extra||[]).find(function(x){return String(x.id)===String(id);});}
  if(!r){showToast('مرکز یافت نشد');return;}
  var e=getE(rtype,r.id);
  var st=e.status||'بدون تماس';var lead=e.lead||r.lead||'سرنخ';
  var pot=e.potential!==undefined?e.potential:r.potential;
  var fd=e.followupDate||'';var today=todayStr();
  var notes=DB.notes[recK(rtype,r.id)]||[];
  var tgs=rTags(rtype,r.id);
  var wkEntries=Object.values(DB.weekEntries||{}).filter(function(we){return we.recKey===rtype+'_'+id;});
  var displayName=e.nameOverride||r.name;
  var isExtra=!!(DB.extra&&DB.extra.find(function(x){return x.id===r.id;}));
  var provObj=getAllProvinces().find(function(p){return p.id===(prov||'tehran');});
  var provName=provObj?provObj.name:'تهران';
  var inpStyle='width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';

  var body='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">نام مرکز</label>'
    +'<input type="text" value="'+esc(displayName)+'" style="'+inpStyle+'" '
    +'onchange="setE(\''+rtype+'\',\''+r.id+'\',\'nameOverride\',this.value.trim());var _th=document.querySelector(\'#mo_cm_'+id+' .m-head span\');if(_th)_th.textContent=\'🏥 \'+(this.value.trim()||\''+esc(displayName)+'\')" placeholder="نام مرکز..."></div>'
    +(isExtra
      ?'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">استان</label>'
        +'<select style="'+inpStyle+'" onchange="_updateExtraCenterProv(\''+r.id+'\',this.value)">'
        +getAllProvinces().map(function(p){return'<option value="'+p.id+'"'+(p.id===(prov||'tehran')?' selected':'')+'>'+p.name+'</option>';}).join('')
        +'</select></div>'
      :'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">استان</label>'
        +'<div style="'+inpStyle+';background:var(--bg-page);color:var(--text-muted)">'+esc(provName)+'</div></div>'
    )
    +'</div></div>'
    +'<div class="m-2col">'
    +'<div><label>پتانسیل</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'potential\',parseInt(this.value))">'
    +[1,2,3,4].map(function(v){return'<option value="'+v+'"'+(pot==v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div>'
    +'<div><label>مسئول</label>'
    +'<span class="owner-dot" data-uid="'+encodeURIComponent(e.owner||r.owner||'')+'"></span>'
    +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'owner\',this.value);var _d=this.previousElementSibling;if(_d)_d.style.background=window.umGetColor?umGetColor(this.value):\'#e2e8f0\'">'
    +'<option value="">—</option>'
    +Object.keys(USERS).map(function(u){return'<option value="'+u+'"'+((e.owner||r.owner||'')==u?' selected':'')+'>'+USERS[u]+'</option>';}).join('')+'</select></div>'
    +(function(){var _typeOpts=[''].concat(TYPE_LIST);var _curType=e.type||r.type||'';return'<div><label>نوع مرکز</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'type\',this.value)">'+_typeOpts.map(function(t){return'<option value="'+t+'"'+(_curType===t?' selected':'')+'>'+(t||'-- نوع --')+'</option>';}).join('')+'</select></div>';})()
    +'</div><div class="m-2col">'
    +'<div><label>وضعیت</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'status\',this.value)">'
    +STATUS_LIST.map(function(s){return'<option'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'
    +'<div><label>سرنخ</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'lead\',this.value)">'
    +LEAD_LIST.map(function(l){return'<option'+(l===lead?' selected':'')+'>'+l+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<label>تاریخ پیگیری بعدی</label>'
    +'<div style="display:flex;gap:5px;align-items:center">'
    +'<input id="mfd_'+id+'" type="text" value="'+fd+'" readonly class="fd-inp'+(fd&&fd<today?' ov':'')+'" style="cursor:pointer;flex:1" '
    +'onclick="openJDP(this,function(v){var _in=document.getElementById(\'mfd_'+id+'\');if(_in){_in.value=v;_in.className=\'fd-inp\'+(v&&v<todayStr()?\'ov\':\'\');}setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',v);renderBanner();if(currentTab===\'provinces\'&&_currentProvId)renderTable();if(currentTab===\'weekplan\')setTimeout(renderWeekPlan,80);})">'
    +(fd?'<button onclick="setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',\'\');document.getElementById(\'mfd_'+id+'\').value=\'\';document.getElementById(\'mfd_'+id+'\').className=\'fd-inp\';renderBanner();if(currentTab===\'provinces\'&&_currentProvId)renderTable();if(currentTab===\'weekplan\')setTimeout(renderWeekPlan,80);" title="حذف تاریخ" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:11px;white-space:nowrap">✕ حذف</button>':'')
    +'<button onclick="convertFollowupToTask(\''+esc(rtype)+'\',\''+esc(r.id)+'\')" title="تبدیل به وظیفه" style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:11px;white-space:nowrap">📌 وظیفه</button>'
    +'</div>'
    +'<label>برچسب‌ها</label>'
    +'<div id="tagArea_'+id+'" style="display:flex;flex-wrap:wrap;gap:4px;padding:7px;background:var(--bg-raised);border-radius:6px;min-height:30px;border:1px solid var(--border)">'
    +tgs.map(function(tid){var t=tagById(tid);return t?'<span class="tag-badge" style="background:'+_safeColor(t.color)+';display:inline-flex;align-items:center;gap:3px">'+esc(t.name)+'<button onclick="removeCenterTag(event,\''+rtype+'\',\''+r.id+'\',\''+tid+'\')" style="background:rgba(0,0,0,.2);border:none;color:var(--text-primary);width:14px;height:14px;border-radius:50%;cursor:pointer;font-size:9px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">✕</button></span>':'';}).join('')
    +'<button class="tag-add-btn" style="width:24px;height:24px;line-height:22px;font-size:14px" onclick="openTagMenu(event,\''+rtype+'\',\''+r.id+'\')">+</button>'
    +'</div>'
        // ── بخش اطلاعات تماس ──
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;margin-top:6px;border:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">'
    +'<span>📞 اطلاعات تماس</span>'
    +'<button onclick="addContact(\''+rtype+'\',\''+r.id+'\',\''+id+'\')" style="padding:3px 10px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:11px;font-family:inherit;cursor:pointer;font-weight:700">+ افزودن مخاطب</button>'
    +'</div>'
    +'<div id="contactsArea_'+id+'">'+_buildContactsHTML(rtype,r.id,id)+'</div>'
    // آدرس
    +'<label style="font-size:10px;margin-top:8px;display:block">آدرس</label>'
    +'<textarea id="maddr_'+id+'" placeholder="آدرس کامل مرکز..." rows="2" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;resize:vertical;background:var(--bg-input);color:var(--text-primary);direction:rtl" '
    +'onchange="setE(\''+rtype+'\',\''+r.id+'\',\'address\',this.value)">'+esc(e.address||'')+'</textarea>'
    +'<button onclick="var _v=document.getElementById(\'maddr_\'+\''+id+'\').value.trim();if(_v)window.open(\'https://www.google.com/maps/search/?api=1&query=\'+encodeURIComponent(_v),\'_blank\');else showToast(\'آدرس را وارد کنید\')" style="background:#f0f9ff;color:#0369a1;border:1px solid #7dd3fc;border-radius:5px;padding:3px 10px;font-size:11px;font-family:inherit;cursor:pointer;margin-top:4px">🗺 نقشه</button>'
    +'</div>'
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:8px 12px;margin-top:6px;border:1px solid var(--border)">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end">'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">🤖 رقیب اصلی</label>'
    +'<input type="text" list="compDatalist_'+r.id+'" value="'+esc(e.competitor||'')+'" placeholder="نام رقیب / برند..." onchange="setE(\''+rtype+'\',\''+r.id+'\',\'competitor\',this.value)" style="width:100%;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)"><datalist id="compDatalist_'+r.id+'">'+_getCompetitorList().map(function(c){return'<option value="'+esc(c)+'">';}).join('')+'</datalist></div>'
    +'<div id="cmCommission_'+r.id+'" style="font-size:10px;color:var(--text-muted);padding:4px 0"></div>'
    +'</div></div>'
    +'<div id="cmPricingInfo_'+r.id+'" style="background:var(--bg-raised);border-radius:8px;padding:8px 12px;margin-top:6px;border:1px solid var(--border);font-size:11px"><span style="color:var(--text-muted)">در حال بارگذاری قیمت‌گذاری...</span></div>'
   // برنامه هفته
    +(wkEntries.length?'<label>برنامه هفته</label><div style="background:var(--bg-raised);border-radius:5px;padding:7px;font-size:11px">'
    +wkEntries.map(function(we){
      var wt=DB.weekTags.find(function(w){return w.id===we.weekTagId;});
      var actType = we.actionType || 'call';
      var actIcon = actType === 'visit' ? '🤝 ویزیت' : '📞 تماس';
      return'<div style="display:flex;gap:7px;align-items:center;padding:2px 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-weight:600">'+(wt?esc(wt.name):'هفته')+'</span>'
        +'<span>→ '+(we.scheduledDate||'بدون تاریخ')+'</span>'
        +'<span style="font-size:9px;background:#e2e8f0;color:var(--text-primary);padding:2px 5px;border-radius:4px">'+actIcon+'</span>'
        +(we.done?'<span style="color:#16a34a;font-weight:bold">✓ '+we.doneDate+'</span>':'')
        +'</div>';}).join('')+'</div>':'')
    // ── یادداشت / گزارش ──
    +(function(){
      var allTags=DB.tags||[];
      var tagChips=allTags.length
        ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px" id="mnoteTagRow_'+id+'">'
          +allTags.map(function(t){
            return '<span onclick="_noteToggleTag(\''+id+'\','+t.id+')" data-tagid="'+t.id+'" '
              +'style="cursor:pointer;padding:2px 8px;border-radius:9px;font-size:10px;font-weight:600;border:1.5px solid var(--border);color:var(--text-secondary);background:var(--bg-raised);transition:all .15s" '
              +'class="note-tag-chip">'+esc(t.name)+'</span>';
          }).join('')
          +'</div>'
        :'';
      return '<div style="margin-top:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
        +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">'
        +'<span>📝 یادداشت / گزارش</span>'
        +'<span style="font-size:9px;font-weight:400;color:var(--text-muted)">Enter = ثبت &nbsp; Shift+Enter = خط جدید</span>'
        +'</div>'
        +'<textarea id="mnote_'+id+'" rows="4" placeholder="گزارش تماس، نتیجه ویزیت، توضیحات..." style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;line-height:1.6" onkeydown="_noteKeydown(event,\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')"></textarea>'
        +tagChips
        +'<div style="display:flex;justify-content:flex-end;margin-top:8px">'
        +'<button class="btn-primary" onclick="addNoteFromModal(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">✓ ثبت</button>'
        +'</div>'
        +'<div id="mNotesList_'+id+'" style="margin-top:10px">'
        +_renderNotesList(notes)
        +'</div></div>';
    })();

  // ── change history section ──
  var rkey=rtype+'_'+r.id;
  var hist=(DB.changeLog||[]).filter(function(h){return h.rkey===rkey;}).slice(-5).reverse();
  var fNames={status:'وضعیت',followupDate:'تاریخ پیگیری',contactName:'مخاطب',owner:'کارشناس',notes:'یادداشت',lead:'سرنخ',potential:'پتانسیل'};
  body+='<div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:8px;border:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">📋 تغییرات اخیر</div>'
    +(hist.length?hist.map(function(h){
      var d=new Date(h.at);var jd=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      var ds=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
      return'<div style="font-size:10.5px;color:var(--text-muted);padding:3px 0;border-bottom:1px solid var(--border)">'
        +'<span style="color:var(--text-secondary)">'+esc(fNames[h.field]||h.field)+'</span>'
        +' ← '+esc(String(h.val||'—').substring(0,30))
        +' <span style="opacity:.6;margin-right:4px">'+esc(h.by||'')+' · '+ds+'</span></div>';
    }).join(''):'<div style="font-size:11px;color:var(--text-muted)">هنوز تغییری ثبت نشده</div>')
    +'</div>';

  var foot='<button style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="closeModal(\'cm_'+id+'\');confirmDeleteCenter(\''+rtype+'\',\''+id+'\',\''+esc(displayName)+'\')">🗑 حذف</button>'
    +'<button style="background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openPreCallBrief(\''+rtype+'\',' +'\''+r.id+'\')">🎯 خلاصه</button>'
    +'<button style="background:#f0f9ff;color:#0369a1;border:1px solid #7dd3fc;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openCenterAudit(\''+recK(rtype,r.id)+'\',\''+esc(displayName)+'\')">📋 تاریخچه</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'cm_'+id+'\')">بستن</button>'
    +'<button class="btn-primary" onclick="openAssignWeekForCenter(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">📋 اضافه به هفته</button>';
  // ── مطالبات section ──
  if(typeof mtrCenterSection==='function'){
    if(typeof DATA!=='undefined'&&DATA.length&&!Object.keys(MTR_BY_CENTER).length)matchCentersToData();
    var mtrHtml=mtrCenterSection(r.id);
    if(mtrHtml) body+=mtrHtml;
  }
  openModal('cm_'+id,'🏥 '+esc(displayName),body,foot,{lg:true});
  if(window.umGetColor){setTimeout(function(){document.querySelectorAll('.owner-dot[data-uid]').forEach(function(d){var u=decodeURIComponent(d.dataset.uid);if(u)d.style.background=umGetColor(u);});},0);}
  // ── قیمت‌گذاری ──
  (function(_rid,_rname){
    fetch('/api/pricing/center/'+encodeURIComponent(_rname))
      .then(function(res){return res.json();})
      .then(function(cfg){
        var el=document.getElementById('cmPricingInfo_'+_rid);
        if(!el)return;
        var BUYER_FA={'public_hospital':'بیمارستان دولتی','private_hospital':'بیمارستان خصوصی','clinic':'کلینیک','lab':'آزمایشگاه','pharmacy':'داروخانه','other':'سایر'};
        if(!cfg){el.innerHTML='<span style="color:var(--text-muted);font-size:10px">اطلاعات قیمت‌گذاری یافت نشد</span>';return;}
        var parts=[];
        if(cfg.buyer_type)parts.push('🏷 نوع خریدار: <b>'+(BUYER_FA[cfg.buyer_type]||cfg.buyer_type)+'</b>');
        if(cfg.commission_level)parts.push('💼 سطح پورسانت: <b>'+cfg.commission_level+'</b>');
        if(parseFloat(cfg.discount_ceiling_pct)>0)parts.push('⬇ سقف تخفیف: <b>'+cfg.discount_ceiling_pct+'%</b>');
        if(cfg.payment_terms)parts.push('📅 شرایط پرداخت: <b>'+cfg.payment_terms+'</b>');
        el.innerHTML=parts.length?'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:5px">💰 قیمت‌گذاری</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+parts.map(function(p){return'<span style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;padding:2px 7px;color:var(--text-primary)">'+p+'</span>';}).join('')+'</div>':'<span style="color:var(--text-muted);font-size:10px">قیمت‌گذاری تنظیم نشده</span>';
  var elCom=document.getElementById('cmCommission_'+_rid);if(elCom){elCom.innerHTML=cfg&&cfg.commission_level?'<span style="font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;padding:3px 10px;font-weight:600">💼 پورسانت: '+esc(cfg.commission_level)+'</span>':'';}
      }).catch(function(){var el=document.getElementById('cmPricingInfo_'+_rid);if(el)el.style.display='none';});
  })(r.id, r.name);
}

function confirmDeleteCenter(rtype,id,name){
  closeAllModals();
  var isExtra=(id.indexOf('_new_')>=0);
  var body='<div style="text-align:center;padding:10px 0">'
    +'<div style="font-size:36px;margin-bottom:12px">🗑</div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px">حذف مرکز</div>'
    +'<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">«<strong>'+esc(name)+'</strong>»</div>'
    +'<div style="background:'+(isExtra?'#fef3c7':'#fef2f2')+';border:1px solid '+(isExtra?'#fcd34d':'#fca5a5')+';border-radius:7px;padding:10px;font-size:12px;color:'+(isExtra?'#92400e':'#991b1b')+';text-align:right">'
    +(isExtra
      ?'این مرکز به صورت دستی اضافه شده. حذف می‌شود.<br>داده‌های CRM (وضعیت، یادداشت) باقی می‌مانند.'
      :'این مرکز از دیتابیس اصلی حذف می‌شود.<br>داده‌های CRM (وضعیت، یادداشت) باقی می‌مانند.')
    +'</div></div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'delCenterModal\')">لغو</button>'
    +'<button style="background:#dc2626;color:var(--text-primary);border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600" '
    +'onclick="_doDeleteCenter(\''+rtype+'\',\''+id+'\')">🗑 حذف کن</button>';
  openModal('delCenterModal','حذف مرکز',body,foot);
}

function _doDeleteCenter(rtype,id){
  var isExtra=(id.indexOf('_new_')>=0);
  // پاک‌سازی داده‌های وابسته
  _cleanCenterData(rtype,id);
  if(isExtra){
    DB.extra=(DB.extra||[]).filter(function(c){return c.id!==id;});
    saveDB();closeModal('delCenterModal');
    clearPCCache();_ALL_PROVS=null;renderTable();
    showToast('✅ مرکز حذف شد');return;
  }
  // حذف از حافظه (CENTERS یا PC_RAW) و ذخیره روی سرور
  if(rtype==='center'){
    for(var _ci=CENTERS.length-1;_ci>=0;_ci--){
      var _cc=CENTERS[_ci];
      var _cid='c_'+(_cc.row||_cc.id||'');
      if(_cid===id||String(_cc.id)===String(id)){CENTERS.splice(_ci,1);break;}
    }
  }else{
    var _provId=id.split('||')[0];
    var _row=Number(id.split('||')[1]);
    PROVINCES.forEach(function(p){
      if(p.id===_provId){
        var _pname=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
        if(PC_RAW[_pname]){PC_RAW[_pname]=PC_RAW[_pname].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
        if(PC_RAW[p.id]){PC_RAW[p.id]=PC_RAW[p.id].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
      }
    });
  }
  clearPCCache();_ALL_PROVS=null;_typeFilterBuilt=false;
  var _newCENTERS=CENTERS.slice();
  var _newPC_RAW={};Object.keys(PC_RAW).forEach(function(k){_newPC_RAW[k]=PC_RAW[k];});
  fetch('/api/data/centers/master',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({CENTERS:_newCENTERS,PC_RAW:_newPC_RAW})
  }).then(function(r){
    if(!r.ok)console.error('[delete center] server save failed:',r.status);
    rebuildFilters();renderTable();
    closeModal('delCenterModal');
    showToast('✅ مرکز از دیتابیس حذف شد');
  }).catch(function(e){
    console.error('[delete center]',e.message);
    rebuildFilters();renderTable();
    closeModal('delCenterModal');
    showToast('✅ مرکز حذف شد');
  });
}

// پاک‌سازی weekEntries و followupDate مرکز حذف‌شده
function _cleanCenterData(rtype,id){
  var recKey=rtype+'_'+id;
  // حذف از weekEntries
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.recKey===recKey||(we.rtype===rtype&&we.rid===id))
      delete DB.weekEntries[k];
  });
  // حذف followupDate از DB.edits (بقیه CRM حفظ می‌شه)
  if(DB.edits[recKey])delete DB.edits[recKey].followupDate;
  saveDB();
}

// Note pending tags: {modalId: [tagId,...]}
var _notePendingTags = {};
// ── VoIP / SIP helper ────────────────────────────────────────────────────────
function _sipDomain(){ return (DB.settings&&DB.settings.sipDomain)||''; }
function _phoneHref(num){
  if(!num)return'tel:';
  var clean=String(num).replace(/\s/g,'');
  var sip=_sipDomain();
  if(sip) return 'sip:'+clean+'@'+sip;
  return 'tel:'+clean;
}
function _phoneTitle(){ return _sipDomain()?'تماس VoIP (Linphone)':'تماس تلفنی'; }


function _noteToggleTag(modalId, tagId){
  if(!_notePendingTags[modalId])_notePendingTags[modalId]=[];
  var arr=_notePendingTags[modalId];
  var idx=arr.indexOf(tagId);
  if(idx>=0){arr.splice(idx,1);}else{arr.push(tagId);}
  // Update chip styles
  var row=document.getElementById('mnoteTagRow_'+modalId);
  if(!row)return;
  row.querySelectorAll('.note-tag-chip').forEach(function(chip){
    var tid=parseInt(chip.dataset.tagid);
    var sel=arr.indexOf(tid)>=0;
    var t=(DB.tags||[]).find(function(x){return x.id===tid;});
    var col=t?(t.color||'#6366f1'):'#6366f1';
    chip.style.background=sel?col:'var(--bg-raised)';
    chip.style.color=sel?'#fff':'var(--text-secondary)';
    chip.style.borderColor=sel?col:'var(--border)';
  });
}

function _noteKeydown(ev,type,id,name){
  if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();addNoteFromModal(type,id,name);}
}

function _renderNotesList(notes){
  if(!notes||!notes.length) return '<div style="text-align:center;padding:10px;font-size:11px;color:var(--text-muted)">هنوز یادداشتی ثبت نشده</div>';
  return notes.slice().reverse().map(function(n,i){
    var lines=esc(n.text||'').replace(/\n/g,'<br>');
    var isFirst=i===0;
    var tagBadges='';
    if(n.noteTags&&n.noteTags.length){
      tagBadges='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">'
        +n.noteTags.map(function(tid){
          var t=(DB.tags||[]).find(function(x){return x.id===tid;});
          if(!t)return'';
          var col=t.color||'#6366f1';
          return'<span style="background:'+col+'22;color:'+col+';border:1px solid '+col+'55;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700">'+esc(t.name)+'</span>';
        }).join('')
        +'</div>';
    }
    return '<div class="note-item" style="'+(isFirst?'border-right:3px solid #6366f1;':'')+'padding-right:8px;margin-bottom:8px">'
      +'<div style="font-size:12px;line-height:1.6;color:var(--text-primary)">'+lines+'</div>'
      +tagBadges
      +'<div class="note-meta" style="margin-top:3px"><span style="font-weight:600">'+esc(n.by||n.user||'')+'</span>'
      +'<span style="margin-right:6px">'+esc(n.date||(n.at?fmtDate(n.at):'')||'')+'</span></div></div>';
  }).join('');
}

function addNoteFromModal(type,id,name){
  var inp=document.getElementById('mnote_'+id);
  if(!inp||!inp.value.trim())return;
  var tags=(_notePendingTags[id]||[]).slice();
  // addNote stores text; we post-patch last note with tags
  addNote(type,id,inp.value.trim(),null);
  var k=recK(type,id);
  if(tags.length){var arr=DB.notes[k];if(arr&&arr.length)arr[arr.length-1].noteTags=tags;}
  // clear
  inp.value='';inp.style.height='auto';
  _notePendingTags[id]=[];
  var row=document.getElementById('mnoteTagRow_'+id);
  if(row)row.querySelectorAll('.note-tag-chip').forEach(function(c){c.style.background='var(--bg-raised)';c.style.color='var(--text-secondary)';c.style.borderColor='var(--border)';});
  var nl=document.getElementById('mNotesList_'+id);
  if(nl) nl.innerHTML=_renderNotesList(DB.notes[k]||[]);
  var auditNl=document.getElementById('auNotes_'+k);
  if(auditNl) auditNl.innerHTML=_renderNotesList(DB.notes[k]||[]);
}

// ── برچسب مرکز ─────────────────────────────────────────────────
function removeCenterTag(ev,rtype,id,tagId){
  ev.stopPropagation();
  var k=recK(rtype,id);
  DB.rTags[k]=(DB.rTags[k]||[]).filter(function(t){return t!==tagId;});
  saveDB();
  // refresh tag area in modal
  var area=document.getElementById('tagArea_'+id);
  if(area){
    var tgs=rTags(rtype,id);
    area.innerHTML=tgs.map(function(tid){var t=tagById(tid);return t?'<span class="tag-badge" style="background:'+_safeColor(t.color)+';display:inline-flex;align-items:center;gap:3px">'+esc(t.name)+'<button onclick="removeCenterTag(event,\''+rtype+'\',\''+id+'\',\''+tid+'\')" style="background:rgba(0,0,0,.2);border:none;color:var(--text-primary);width:14px;height:14px;border-radius:50%;cursor:pointer;font-size:9px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">✕</button></span>':'';}).join('')
      +'<button class="tag-add-btn" style="width:24px;height:24px;line-height:22px;font-size:14px" onclick="openTagMenu(event,\''+rtype+'\',\''+id+'\')">+</button>';
  }
}

// ── Multi-contact helpers ─────────────────────────────────────────────────
function _getContacts(rtype,id){
  var e=getE(rtype,id);
  if(e.contacts&&e.contacts.length)return e.contacts.map(function(c){return{name:c.name||'',title:c.title||'',phones:(c.phones||[]).slice()};});
  if(e.contactName||e.contactTitle||(e.phones&&e.phones.length))
    return [{name:e.contactName||'',title:e.contactTitle||'',phones:(e.phones||[]).slice()}];
  return [];
}
function _saveContacts(rtype,id,contacts){
  setE(rtype,id,'contacts',contacts.slice());
}
function _refreshContactsArea(rtype,id,domId){
  var area=document.getElementById('contactsArea_'+(domId||id));
  if(area)area.innerHTML=_buildContactsHTML(rtype,id,domId||id);
}
function _waNum(ph){
  var n=(ph||'').replace(/[^0-9]/g,'');
  if(n.startsWith('0'))n='98'+n.slice(1);
  if(!n.startsWith('98'))n='98'+n;
  return n;
}
function _copyPhone(ph){
  if(!ph)return;
  if(navigator.clipboard){navigator.clipboard.writeText(ph).then(function(){showToast('📋 کپی شد: '+ph,1500);});}
  else{var ta=document.createElement('textarea');ta.value=ph;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('📋 کپی شد: '+ph,1500);}
}
function _buildContactsHTML(rtype,rid,domId){
  var contacts=_getContacts(rtype,rid);
  if(!contacts.length)return '<div style="color:var(--text-muted);font-size:11px;padding:4px 0;text-align:center">هنوز مخاطبی اضافه نشده</div>';
  var inp='width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';
  return contacts.map(function(c,ci){
    var phonesHtml=(c.phones||[]).map(function(ph,pi){
      return'<div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">'
        +'<a href="'+_phoneHref(ph)+'" style="font-size:13px;text-decoration:none;flex-shrink:0" title="'+_phoneTitle()+'" onclick="event.stopPropagation()">📞</a>'
        +'<input type="text" value="'+esc(ph)+'" style="flex:1;direction:ltr;font-size:12px;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" '
        +'onchange="updateContactPhone(\''+rtype+'\',\''+rid+'\','+ci+','+pi+',this.value)">'
        +'<button onclick="removeContactPhone(\''+rtype+'\',\''+rid+'\','+ci+','+pi+',\''+domId+'\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;padding:3px 7px;font-size:11px;flex-shrink:0">✕</button>'
        +(ph?'<a href="https://wa.me/'+_waNum(ph)+'" target="_blank" title="واتساپ" style="font-size:14px;text-decoration:none;flex-shrink:0">💬</a>':'')
        +'<button onclick="_copyPhone(\''+esc(ph)+'\')" title="کپی شماره" style="background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:11px;padding:2px 5px">📋</button>'
        +'</div>';
    }).join('');
    return'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:6px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<span style="font-size:11px;font-weight:700;color:var(--text-secondary)">مخاطب '+(ci+1)+'</span>'
      +'<button onclick="removeContact(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:11px;padding:0 2px" title="حذف مخاطب">🗑 حذف</button>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">'
      +'<div><label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px">نام</label>'
      +'<input type="text" value="'+esc(c.name)+'" placeholder="نام مخاطب..." style="'+inp+'" '
      +'onchange="updateContactField(\''+rtype+'\',\''+rid+'\','+ci+',\'name\',this.value)"></div>'
      +'<div><label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px">سمت</label>'
      +'<input type="text" value="'+esc(c.title)+'" placeholder="مثلاً: مدیر خرید..." style="'+inp+'" '
      +'onchange="updateContactField(\''+rtype+'\',\''+rid+'\','+ci+',\'title\',this.value)"></div>'
      +'</div>'
      +'<label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px">شماره‌های تماس</label>'
      +phonesHtml
      +'<div style="display:flex;gap:5px;margin-top:3px">'
      +'<input id="newPhone_'+domId+'_'+ci+'" type="text" placeholder="شماره جدید..." style="flex:1;direction:ltr;font-size:12px;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" '
      +'onkeydown="if(event.key===\'Enter\')addContactPhone(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')">'  
      +'<button onclick="addContactPhone(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')" style="background:#0ea5e9;color:#fff;border:none;border-radius:5px;cursor:pointer;padding:4px 10px;font-size:11px;font-family:inherit;flex-shrink:0">+</button>'
      +'</div>'
      +'</div>';
  }).join('');
}
function addContact(rtype,id,domId){
  var contacts=_getContacts(rtype,id);
  contacts.push({name:'',title:'',phones:[]});
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function removeContact(rtype,id,ci,domId){
  var contacts=_getContacts(rtype,id);
  contacts.splice(ci,1);
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function updateContactField(rtype,id,ci,field,val){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci][field]=val;
  _saveContacts(rtype,id,contacts);
}
function addContactPhone(rtype,id,ci,domId){
  var inp=document.getElementById('newPhone_'+(domId||id)+'_'+ci);
  if(!inp)return;
  var ph=inp.value.trim();if(!ph)return;
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  if((contacts[ci].phones||[]).indexOf(ph)>=0){showToast('این شماره قبلاً ثبت شده');return;}
  contacts[ci].phones.push(ph);
  _saveContacts(rtype,id,contacts);
  inp.value='';
  _refreshContactsArea(rtype,id,domId||id);
}
function removeContactPhone(rtype,id,ci,pi,domId){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci].phones.splice(pi,1);
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function updateContactPhone(rtype,id,ci,pi,val){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci].phones[pi]=val;
  _saveContacts(rtype,id,contacts);
}


/* ═══ public/js/weekplan.js ═══ */
// ════════════════════════ NOTES ════════════════════════
function addNote(type,id,text,inp){
  if(!text||!text.trim())return;
  var k=recK(type,id);if(!DB.notes[k])DB.notes[k]=[];
  DB.notes[k].push({text:text.trim(),date:todayStr(),user:USERS[currentUser]||currentUser,ts:nowTs()});
  saveDB();if(inp){inp.value='';showToast('یادداشت ذخیره شد ✅',1500);}
}

function openNotes(type,id,name){
  var k=recK(type,id);var notes=DB.notes[k]||[];
  var body='<div style="display:flex;gap:5px;margin-bottom:10px">'
    +'<input id="ntxt_'+id+'" type="text" placeholder="یادداشت جدید..." style="flex:1">'
    +'<button class="btn-primary" onclick="saveNoteAndRefresh(\''+type+'\',\''+id+'\',\''+esc(name||id)+'\')">ثبت</button>'
    +'</div>'
    +'<div id="nlist_'+id+'">'+renderNotesList(type,id)+'</div>';
  openModal('notes_'+id,'📝 یادداشت‌های '+esc(name||id),body,'<button class="btn-secondary" onclick="closeModal(\'notes_'+id+'\')">بستن</button>');
}

function renderNotesList(type,id){
  var notes=DB.notes[recK(type,id)]||[];
  if(!notes.length)return'<div style="text-align:center;color:var(--text-muted);padding:20px">یادداشتی ثبت نشده</div>';
  return notes.slice().reverse().map(function(n,i){
    var realIdx=notes.length-1-i;
    return'<div class="note-item">'+esc(n.text)
      +'<div class="note-meta"><span>'+esc(n.by||n.user||'')+'</span><span>'+(n.date||fmtDate(n.at)||'')+'</span>'
      +'<button class="note-del" onclick="delNoteAndRefresh(\''+type+'\',\''+id+'\','+realIdx+')">🗑</button>'
      +'</div></div>';
  }).join('');
}

function saveNoteAndRefresh(type,id,name){
  var inp=document.getElementById('ntxt_'+id);
  if(!inp||!inp.value.trim())return;
  addNote(type,id,inp.value.trim(),null);inp.value='';
  var nl=document.getElementById('nlist_'+id);if(nl)nl.innerHTML=renderNotesList(type,id);
}

function delNoteAndRefresh(type,id,idx){
  var k=recK(type,id);if(!DB.notes[k])return;
  DB.notes[k].splice(idx,1);saveDB();
  var nl=document.getElementById('nlist_'+id);if(nl)nl.innerHTML=renderNotesList(type,id);
}


// ════════════════ getRecLabel ════════════════

// ── Persistent Center Name Cache ─────────────────────────────
var _CNC = null; // {recKey: name}
function _loadCNC(){
  if(_CNC)return;
  try{var s=localStorage.getItem('_cnc');_CNC=s?JSON.parse(s):{};}
  catch(e){_CNC={};}
}
function _saveCNC(key,name){
  _loadCNC();
  if(_CNC[key]===name)return; // no change
  _CNC[key]=name;
  try{localStorage.setItem('_cnc',JSON.stringify(_CNC));}catch(e){}
}

function getRecLabel(recKey){
  _loadCNC();
  if(_CNC&&_CNC[recKey])return _CNC[recKey];
  if(!recKey)return'?';
  var pts=recKey.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
  if(tp==='mtr'){
    var mrow=typeof DATA!=='undefined'?DATA.find(function(r){return r.inv===id;}):null;
    if(mrow){var lbl='📄 '+mrow.customer+' ('+id+')';_saveCNC(recKey,lbl);return lbl;}
    return '📄 مطالبات: '+id;
  }
  if(tp==='center'){
    var _no=(DB.edits[recKey]||{}).nameOverride;if(_no){_saveCNC(recKey,_no);return _no;}
    var c=CENTERS.find(function(x){return x.id===id;});
    if(c){_saveCNC(recKey,c.name);return c.name;}
    var ex=(DB.extra||[]).find(function(x){return x.id===id;});
    if(ex){_saveCNC(recKey,ex.name);return ex.name;}
    // Fallback: search across all provinces cache
    if(_PC_CACHE){
      for(var _pv in _PC_CACHE){
        var _found=_PC_CACHE[_pv].find(function(x){return x.id===id;});
        if(_found)return _found.name;
      }
    }
    return id;
  }
  if(tp==='pc'){
    var _no2=(DB.edits[recKey]||{}).nameOverride;if(_no2){_saveCNC(recKey,_no2);return _no2;}
    _buildPCCache();
    var provId=id.split('||')[0];
    var arr=_PC_CACHE[provId]||[];
    var found=arr.find(function(x){return x.id===id;});
    if(found){_saveCNC(recKey,found.name);return found.name;}
    var ex2=(DB.extra||[]).find(function(x){return x.id===id;});
    if(ex2){_saveCNC(recKey,ex2.name);return ex2.name;}
    // full fallback search
    if(_PC_CACHE){for(var _pv2 in _PC_CACHE){var _f2=(_PC_CACHE[_pv2]||[]).find(function(x){return x.id===id;});if(_f2){_saveCNC(recKey,_f2.name);return _f2.name;}}}
    var _pvn=PROVINCES&&PROVINCES.find(function(p){return p.id===id.split('||')[0];});
    var _fb=(_pvn?_pvn.name+' ':'')+id;
    return _fb;
  }
  if(tp==='province'){
    var pv=getAllProvinces().find(function(p){return p.id===id;});
    return pv?pv.name:id;
  }
  return recKey;
}
// ═════════════════════════════════════════════
// ════════════════════════ WEEK PLAN (auto-generated) ═══════════
var _wpYear=null; // null = current year

function initWeekTags(){
  if(!DB.weekEntries)DB.weekEntries={};
  if(!DB.weekTags)DB.weekTags=[];
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

function wpCurrentYear(){return _wpYear||(todayJ()[0]);}

function wpGetWeeks(){return getYearWeeks(wpCurrentYear());}

function wpCurrentWeekId(){
  var today=todayJ();var todayMs=jMs(today[0],today[1],today[2]);
  var wks=wpGetWeeks();
  var cur=wks.find(function(w){return jMs(w.wsArr[0],w.wsArr[1],w.wsArr[2])<=todayMs&&jMs(w.weArr[0],w.weArr[1],w.weArr[2])>=todayMs;});
  return cur?cur.id:null;
}

// ساخت کلید weekEntries: wsStr||rtype||rid
function wpEntryKey(weekId,rtype,rid){return weekId+':::'+rtype+':::'+rid;}
function wpParseEntryKey(k){var i1=k.indexOf(':::');var i2=k.indexOf(':::',i1+3);return{weekId:k.slice(0,i1),rtype:k.slice(i1+3,i2),rid:k.slice(i2+3)};}

function wpBuildSelect(){
  var sel=document.getElementById('wpSel');if(!sel)return;
  var wks=wpGetWeeks();var yr=document.getElementById('wpYearLabel');
  if(yr)yr.textContent=wpCurrentYear();
  var curVal=sel.value;
  sel.innerHTML='';
  wks.forEach(function(w){
    var o=document.createElement('option');
    o.value=w.id;
    o.textContent=w.label+(w.isCurrent?' ◀ این هفته':w.isPast?' ✓':'');
    if(w.isCurrent)o.style.fontWeight='bold';
    if(w.isPast)o.style.color='#94a3b8';
    sel.appendChild(o);
  });
  // انتخاب پیش‌فرض: این هفته
  if(!curVal||!wks.find(function(w){return w.id===curVal;})){
    var thisWeek=wpCurrentWeekId();
    sel.value=thisWeek||wks[0].id;
  }else{sel.value=curVal;}
}

function wpYearNav(delta){
  _wpYear=(wpCurrentYear()+delta);
  wpBuildSelect();renderWeekPlan();
}
function wpGoThisWeek(){
  _wpYear=todayJ()[0];
  wpBuildSelect();
  var sel=document.getElementById('wpSel');
  if(sel){sel.value=wpCurrentWeekId()||sel.options[0].value;}
  renderWeekPlan();
}
function wpNav(delta){
  var sel=document.getElementById('wpSel');if(!sel)return;
  var opts=Array.from(sel.options);var idx=opts.findIndex(function(o){return o.value===sel.value;});
  var ni=Math.max(0,Math.min(opts.length-1,idx+delta));sel.value=opts[ni].value;
  renderWeekPlan();
}


function _isManager(){
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var me=members.find(function(m){return m.id===currentUser;});
  return me&&(me.role==='مدیر'||me.role==='admin'||me.role==='manager'||me.role==='سوپر ادمین');
}
function _isSuperAdmin(){
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var me=members.find(function(m){return m.id===currentUser;});
  return me&&me.role==='سوپر ادمین';
}
function _isExpert(){return !_isManager();}


function wpShowAllUnsched(btn){
  var grid = document.getElementById('wpMyUnschedGrid');
  if(grid) grid.innerHTML += decodeURIComponent(btn.dataset.full);
  btn.remove();
}


function wpClearFilters(){
  var s=document.getElementById('wpSearch');if(s)s.value='';
  var o=document.getElementById('wpOwnerFilter');if(o)o.value='';
  renderWeekPlan();
}
function wpExportExcel(){
  if(typeof XLSX==='undefined'){showToast('⚠ کتابخانه Excel بارگذاری نشده');return;}
  var sel=document.getElementById('wpSel');
  var weekId=sel?sel.value:'';
  if(!weekId){showToast('⚠ ابتدا یک هفته را انتخاب کنید');return;}
  var rows=[['نام مرکز','کارشناس','نوع','تاریخ','وضعیت']];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(!k.startsWith(weekId+':::'))return;
    var e=DB.weekEntries[k];
    var name=e.centerName||e.mtrCustomer||k;
    var owner=e.addedBy?USERS[e.addedBy]||e.addedBy:'';
    var type=e.rtype==='mtr'?'مطالبات':(e.actionType==='visit'?'ویزیت':'تماس');
    var date=e.scheduledDate||'بدون تاریخ';
    var status=e.done?'انجام شد':'در انتظار';
    rows.push([name,owner,type,date,status]);
  });
  if(rows.length===1){showToast('⚠ این هفته هیچ موردی ندارد');return;}
  var ws=XLSX.utils.aoa_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'برنامه هفته');
  XLSX.writeFile(wb,'weekplan_'+weekId.replace(/\//g,'-')+'.xlsx');
  showToast('✅ فایل Excel دانلود شد ('+( rows.length-1)+' مورد)',2500);
}
function wpBuildOwnerFilter(){
  var sel=document.getElementById('wpOwnerFilter');
  if(!sel)return;
  sel.innerHTML='<option value="">همه کارشناسان</option>';
  Object.keys(USERS).forEach(function(uid){
    if(uid==='guest')return;
    var opt=document.createElement('option');
    opt.value=uid;opt.textContent=USERS[uid];sel.appendChild(opt);
  });
  var filterRow=sel.closest?sel.closest('.wp-filter-row'):null;
  if(!_isManager()){
    sel.value=currentUser;
    if(filterRow)filterRow.style.display='none';
  } else {
    if(filterRow)filterRow.style.display='';
    if(_wpFclFilters.owner&&USERS[_wpFclFilters.owner])sel.value=_wpFclFilters.owner;
  }
}

function renderWeekPlan(){
  _buildPCCache();
  wpBuildSelect();
  wpBuildOwnerFilter();
  if(typeof _wpSelected!=='undefined'){_wpSelected.clear();var _bar=document.getElementById('wpBulkBar');if(_bar)_bar.classList.remove('active');}
  var wpSearchQ=(document.getElementById('wpSearch')||{}).value||'';
  var wpOwnerF=(document.getElementById('wpOwnerFilter')||{}).value||'';
  _wpFclFilters.owner = wpOwnerF;
  var sel = document.getElementById('wpSel');
  var weekId = sel && sel.value ? sel.value : null;
  var daysEl = document.getElementById('wpDays');
  if(!daysEl) return;
  if(!weekId || !wpGetWeeks().length){
    daysEl.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:50px;color:#94a3b8"><div style="font-size:32px;margin-bottom:10px">📋</div><div style="font-weight:600;margin-bottom:8px">هفته‌ای انتخاب نشده</div><div style="font-size:12px;color:#94a3b8">از منوی بالا (▾ انتخاب هفته) یک هفته را انتخاب کنید<br>یا روی «+ هفته جدید» کلیک کنید</div></div>';
    return;
  }
  var wk = wpGetWeeks().find(function(w){return w.id===weekId;});
  if(!wk){daysEl.innerHTML='<div style="text-align:center;padding:30px;color:#94a3b8">هفته یافت نشد</div>';return;}
  var today = todayStr();
  var days = [];
  for(var i=0; i<7; i++){
    var d = jAdd(wk.wsArr[0],wk.wsArr[1],wk.wsArr[2],i);
    days.push({str:d[0]+'/'+p2(d[1])+'/'+p2(d[2]), name:J_DAYS[i], isToday:d[0]+'/'+p2(d[1])+'/'+p2(d[2])===today});
  }

  // تابع کمکی برای یافتن دقیق مسئول مرکز
  var getCenterOwner = function(rtype, rid) {
    var e = getE(rtype, rid);
    if (e.owner) return e.owner;
    if (rtype === 'center') {
      var c = CENTERS.find(function(x){return x.id === rid;});
      if (c && c.owner) return c.owner;
    } else if (rtype === 'pc') {
      _buildPCCache();
      var provId = rid.split('||')[0];
      var arr = _PC_CACHE[provId] || [];
      var c = arr.find(function(x){return x.id === rid;});
      if (c && c.owner) return c.owner;
    }
    var ex = (DB.extra||[]).find(function(x){return x.id===rid;});
    if(ex && ex.owner) return ex.owner;
    return '';
  };

  // جمع‌آوری تمامی مراکزِ تخصیص یافته به این هفته
  var allEntries = [];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(!k.startsWith(weekId+':::')) return;
    var we = Object.assign({_key:k}, DB.weekEntries[k]);
    var rtype = we.rtype; var rid = we.rid;
    var owner = '';
    if(rtype && rid){
      owner = getCenterOwner(rtype, rid) || we.addedBy || '';
      // اعمال محدودیت نمایش برای کاربران غیر مدیر
      var addedBy=we.addedBy||'';
      // نمایش بر اساس مسئول مرکز (نه اضافه‌کننده)
      if(!_isManager() && owner && owner !== currentUser) return;
    }
    we._owner = owner;
    we._ownerName = owner ? (USERS[owner] || owner) : 'بدون مسئول';
    var _rk=we.recKey||(we.rtype&&we.rid?we.rtype+'_'+we.rid:'');
    _loadCNC();
    we._name = we.centerName || (_CNC&&_CNC[_rk]) || getRecLabel(_rk) || '?';
    // ── filter by owner + search ──
    if(wpOwnerF){
      var effOwner=owner||'';
      if(effOwner && effOwner !== wpOwnerF) return;
      if(!effOwner) return; // مرکز بدون مسئول در owner filter نشون نده
    }
    if(wpSearchQ){
      var lbl=we._name||'';
      if(fNorm(lbl).indexOf(fNorm(wpSearchQ))<0) return;
    }
    allEntries.push(we);
  });

  var byDay = {}; days.forEach(function(d){byDay[d.str]=[];});

  // مراکز با تاریخ → شبکه ۷ روزه | بقیه در صف انتظار یکپارچه
  allEntries.forEach(function(we){
    if(we.scheduledDate && byDay[we.scheduledDate] !== undefined){
      byDay[we.scheduledDate].push(we);
    }
  });

  var total = allEntries.length; 
  var done = allEntries.filter(function(e){return e.done;}).length;

  // رندر ۷ روز هفته
  daysEl.innerHTML = days.map(function(d){
    var items = byDay[d.str] || [];
    return '<div class="wp-day'+(d.isToday?' today':'')+'">'
      + '<div class="wp-day-head">'+d.name+'<br><small>'+d.str.split('/').slice(1).join('/')+'</small>'
      + (items.length?'<span class="wp-cnt">'+items.length+'</span>':'')+'</div>'
      + '<div class="wp-day-body" ondragover="event.preventDefault();this.classList.add(\'wp-drop-over\')" ondragleave="this.classList.remove(\'wp-drop-over\')" ondrop="wpDrop(event,\''+d.str+'\')">'
      + (items.length ? items.map(function(e){return renderWpItem(e,weekId);}).join('') : '<div class="wp-empty">—</div>')
      + '</div>'
      + '<button class="wp-add-btn" data-wid="'+weekId+'" data-dstr="'+d.str+'" onclick="wpPickForDay(this.getAttribute(\'data-wid\'),this.getAttribute(\'data-dstr\'))">+ انتقال</button>'
      + '</div>';
  }).join('');


  // نوار پیشرفت (Progress Bar)
  var oldProg = daysEl.parentNode ? daysEl.parentNode.querySelector('.wp-progress') : null;
  if(oldProg) oldProg.remove();
  if(total > 0 && daysEl.parentNode){
    var pEl = document.createElement('div'); pEl.className = 'wp-progress';
    pEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-raised);border-top:1px solid var(--border)">'
      + '<span style="font-size:12px;color:var(--text-secondary)">پیشرفت هفته:</span>'
      + '<div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">'
      + '<div style="height:100%;background:#22c55e;width:'+Math.round(done/total*100)+'%;transition:width .3s"></div></div>'
      + '<span style="font-size:11px;font-weight:700;color:#16a34a">'+done+' / '+total+'</span>'
      + (!_isManager() ? '<span style="font-size:10px;color:var(--text-muted)">— مراکز شما</span>' : '')
      + '</div>';
    daysEl.parentNode.appendChild(pEl);
  }
  renderWpFullCenterList();
}
// ════════════════════════ WP FULL CENTER LIST ════════════════════
var _wpFclOpen = true;
var _wpFclFilters = {q:'', owner:'', prov:''};

function renderWpFullCenterList() {
  var el = document.getElementById('wpFullCenterList');
  if (!el) return;

  var sel = document.getElementById('wpSel');
  var weekId = sel && sel.value ? sel.value : null;

  // helper: center owner
  var getCO = function(rtype, rid) {
    var e = getE(rtype, rid);
    if (e.owner) return e.owner;
    if (rtype === 'center') {
      var c = CENTERS.find(function(x){return x.id===rid;});
      if (c && c.owner) return c.owner;
    } else if (rtype === 'pc') {
      var arr = (_PC_CACHE[rid.split('||')[0]])||[];
      var c = arr.find(function(x){return x.id===rid;});
      if (c && c.owner) return c.owner;
    }
    return '';
  };
  // helper: province from center id
  var getPI = function(rtype, rid) {
    if (rtype === 'pc') {
      var pid = rid.split('||')[0];
      var p = getAllProvinces().find(function(x){return x.id===pid;});
      return {id:pid, name:p?p.name:''};
    }
    return {id:'tehran', name:'تهران'};
  };

  // ── Section 1: entries in this week WITHOUT a scheduled date ─────────
  var unschedEntries = [];
  var inWeekMap = {};
  if (weekId) {
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      if(!k.startsWith(weekId+':::')) return;
      var we = DB.weekEntries[k];
      var rtype = we.rtype||'center', rid = we.rid||'';
      var rk = we.recKey||(rtype+'_'+rid);
      inWeekMap[rk] = true;
      inWeekMap[rtype+'_'+rid] = true;
      if (we.scheduledDate || we.done || rtype==='mtr') return;
      var owner = getCO(rtype, rid);
      if (!_isManager() && owner && owner !== currentUser) return;
      var prov = getPI(rtype, rid);
      unschedEntries.push({
        _key:k, rtype:rtype, rid:rid, recKey:rk,
        name: we.centerName||getRecLabel(rk)||'?',
        owner:owner, ownerName:owner?(USERS[owner]||owner):'—',
        provId:prov.id, provName:prov.name,
        actionType:we.actionType||'call'
      });
    });
  }

  // ── Section 2: all province centers NOT in this week ─────────────────
  _buildPCCache();
  var allCenters = [];
  getAllProvinces().forEach(function(p){
    var tp = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var rk = tp+'_'+c.id;
      if (inWeekMap[rk]) return;
      var e = getE(tp, c.id);
      var owner = e.owner||c.owner||'';
      if(!_isManager()&&owner&&owner!==currentUser)return;
      allCenters.push({
        id:c.id, rtype:tp, recKey:rk,
        name:c.name||'',
        provId:p.id, provName:p.name||'',
        owner:owner, ownerName:owner?(USERS[owner]||owner):'—',
        status:e.status||'بدون تماس',
        followupDate:e.followupDate||''
      });
    });
  });

  // ── Apply unified filters ─────────────────────────────────────────────
  var q = fNorm(_wpFclFilters.q||'');
  var ownerF = _wpFclFilters.owner||'';
  var provF = _wpFclFilters.prov||'';

  var filtU = unschedEntries.filter(function(c){
    if (ownerF && c.owner!==ownerF) return false;
    if (provF && c.provId!==provF) return false;
    if (q && fNorm(c.name).indexOf(q)<0 && fNorm(c.ownerName).indexOf(q)<0 && fNorm(c.provName).indexOf(q)<0) return false;
    return true;
  });
  var filtC = allCenters.filter(function(c){
    if (ownerF && c.owner!==ownerF) return false;
    if (provF && c.provId!==provF) return false;
    if (q && fNorm(c.name).indexOf(q)<0 && fNorm(c.ownerName).indexOf(q)<0 && fNorm(c.provName).indexOf(q)<0) return false;
    return true;
  });

  // ── Build filter controls ─────────────────────────────────────────────
  var members = typeof umGetActive==='function' ? umGetActive() : [];
  var ownerOpts = '<option value="">همه کارشناسان</option>'
    + members.map(function(m){return '<option value="'+m.id+'"'+(ownerF===m.id?' selected':'')+'>'+esc(m.name)+'</option>';}).join('');
  var provOpts = '<option value="">همه استان‌ها</option>'
    + getAllProvinces().map(function(p){return '<option value="'+p.id+'"'+(provF===p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');

  var todaySt = todayStr();

  // ── Row renderers ─────────────────────────────────────────────────────
  var rowUnscheduled = function(c, n) {
    var oc = typeof umGetColor==='function' ? umGetColor(c.owner) : '#94a3b8';
    var ek = c._key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var ri = String(c.rid).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var aIcon = c.actionType==='visit' ? '🤝 ویزیت' : '📞 تماس';
    var aBg = c.actionType==='visit' ? '#ede9fe' : '#e0f2fe';
    var aCol = c.actionType==='visit' ? '#5b21b6' : '#0369a1';
    return '<tr style="background:#fffbeb">'
      +'<td style="color:var(--text-muted);font-size:10px;text-align:center;border-right:3px solid #f59e0b">'+n+'</td>'
      +'<td style="cursor:pointer" onclick="openCenterModal(\''+c.rtype+'\',\''+ri+'\')">'
        +'<span style="font-weight:600;color:var(--brand);text-decoration:underline dotted">'+esc(c.name)+'</span>'
        +' <span style="font-size:9px;background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:4px;padding:1px 5px">در هفته</span>'
      +'</td>'
      +'<td style="font-size:11px">'+esc(c.provName)+'</td>'
      +'<td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+oc+';margin-left:4px;vertical-align:middle"></span><span style="font-size:11px">'+esc(c.ownerName)+'</span></td>'
      +'<td><span style="font-size:10px;background:'+aBg+';color:'+aCol+';border-radius:4px;padding:2px 6px">'+aIcon+'</span></td>'
      +'<td></td>'
      +'<td style="white-space:nowrap">'
        +'<button class="wp-fcl-act-btn wp-fcl-act-sched" onclick="wpSetScheduleFromKey(\''+ek+'\')">📅 تعیین روز</button> '
        +'<button class="wp-fcl-act-btn" style="background:#fef3c7;color:#92400e;border-color:#fcd34d" onclick="wpMoveEntry(\''+ek+'\',\''+weekId+'\')">↪ هفته دیگر</button> '
        +'<button class="wp-fcl-act-btn wp-fcl-act-remove" onclick="wpRemoveEntry(\''+ek+'\')">✕</button>'
      +'</td>'
    +'</tr>';
  };

  var rowCenter = function(c, n) {
    var oc = typeof umGetColor==='function' ? umGetColor(c.owner) : '#94a3b8';
      var ri = String(c.id).replace(/'/g, "\\'");
    var stCl2 = stCls(c.status);
    var fd = c.followupDate
      ? '<span style="font-size:10px;background:'+(c.followupDate<todaySt?'#fee2e2':'#dbeafe')+';color:'+(c.followupDate<todaySt?'#991b1b':'#1e40af')+';border-radius:4px;padding:1px 5px">'+c.followupDate+'</span>'
      : '<span style="color:var(--text-muted);font-size:10px">—</span>';
    var act = weekId
      ? '<button class="wp-fcl-act-btn wp-fcl-act-add" onclick="wpFclAddToWeek(\''+weekId+'\',\''+c.rtype+'\',\''+ri+'\')">+ هفته</button>'
      : '<span style="font-size:10px;color:var(--text-muted)">هفته انتخاب نشده</span>';
    return '<tr>'
      +'<td style="color:var(--text-muted);font-size:10px;text-align:center">'+n+'</td>'
      +'<td style="cursor:pointer" onclick="openCenterModal(\''+c.rtype+'\',\''+ri+'\')">'
        +'<span style="font-weight:600;color:var(--brand);text-decoration:underline dotted">'+esc(c.name)+'</span>'
      +'</td>'
      +'<td style="font-size:11px">'+esc(c.provName)+'</td>'
      +'<td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+oc+';margin-left:4px;vertical-align:middle"></span><span style="font-size:11px">'+esc(c.ownerName)+'</span></td>'
      +'<td><span class="'+stCl2+'" style="padding:2px 7px;border-radius:8px;font-size:10px;font-weight:600">'+esc(c.status)+'</span></td>'
      +'<td>'+fd+'</td>'
      +'<td style="white-space:nowrap">'+act+'</td>'
    +'</tr>';
  };

  // ── Assemble table body ───────────────────────────────────────────────
  var tbody = '';
  var counter = 0;
  if (filtU.length) {
    tbody += '<tr style="background:linear-gradient(90deg,#fffbeb,var(--bg-raised));pointer-events:none">'
      +'<td colspan="7" style="padding:5px 10px;font-size:11px;font-weight:700;color:#92400e;border-top:2px solid #fcd34d;border-right:3px solid #f59e0b">'
      +'📌 در هفته جاری، بدون تاریخ &nbsp;·&nbsp; '+filtU.length+' مرکز'
      +'</td></tr>';
    filtU.forEach(function(c){ counter++; tbody += rowUnscheduled(c, counter); });
  }
  if (filtC.length) {
    tbody += '<tr style="background:var(--bg-raised);pointer-events:none">'
      +'<td colspan="7" style="padding:5px 10px;font-size:11px;font-weight:700;color:var(--text-secondary);border-top:2px solid var(--border)">'
      +'📋 مراکز آماده افزودن &nbsp;·&nbsp; '+filtC.length+' مرکز'
      +'</td></tr>';
    filtC.forEach(function(c){ counter++; tbody += rowCenter(c, counter); });
  }
  if (!counter) {
    tbody = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">✓ هیچ موردی یافت نشد</td></tr>';
  }

  var totalAll = unschedEntries.length + allCenters.length;
  var totalFilt = filtU.length + filtC.length;

  var html = '<div class="wp-fcl-wrap">'
    +'<div class="wp-fcl-header" onclick="wpFclToggle()">'
    +'<div class="wp-fcl-title">📋 صف انتظار مراکز'
    +(unschedEntries.length ? ' <span style="background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">'+unschedEntries.length+' در هفته</span>' : '')
    +' <span class="wp-fcl-badge">'+allCenters.length+'</span>'
    +(totalFilt!==totalAll ? '<span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-right:4px">'+totalFilt+' نمایش داده شده</span>' : '')
    +'</div>'
    +'<span class="wp-fcl-toggle" id="wpFclArrow">'+(_wpFclOpen?'▲':'▼')+'</span>'
    +'</div>'
    +'<div class="wp-fcl-body'+(_wpFclOpen?' open':'')+'" id="wpFclBody">'
    +'<div class="wp-fcl-filters">'
    +'<input type="text" placeholder="🔍 جستجو مرکز / استان / کارشناس..." value="'+esc(_wpFclFilters.q)+'" oninput="_wpFclFilters.q=this.value;renderWpFullCenterList()">'
    +'<select onchange="_wpFclFilters.owner=this.value;renderWpFullCenterList()">'+ownerOpts+'</select>'
    +'<select onchange="_wpFclFilters.prov=this.value;renderWpFullCenterList()">'+provOpts+'</select>'
    +'<button onclick="_wpFclFilters={q:\'\',owner:\'\',prov:\'\'};renderWpFullCenterList()" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-raised);cursor:pointer;font-size:11px;color:var(--text-muted)">✕ پاک</button>'
    +'</div>'
    +'<div class="wp-fcl-table-wrap" style="max-height:520px;overflow-y:auto">'
    +'<table class="wp-fcl-table"><thead><tr>'
    +'<th style="width:36px">#</th>'
    +'<th>نام مرکز</th><th>استان</th><th>کارشناس</th>'
    +'<th>وضعیت</th><th>پیگیری</th><th>عملیات</th>'
    +'</tr></thead><tbody id="wpFclTbody">'+tbody+'</tbody></table>'
    +'</div>'
    +'<div id="wpFclExpertSummaryDiv">'+_wpFclExpertSummary(filtC.concat(filtU))+'</div>'
    +'<div class="wp-fcl-footer">'
    +'<span id="wpFclFooterSpan">'+(unschedEntries.length?'<strong>'+unschedEntries.length+'</strong> در هفته بدون تاریخ &middot; ':'')+allCenters.length+' مرکز در صف</span>'
    +(weekId?'<span style="color:var(--text-muted)">«+ هفته» افزودن &middot; «📅 تعیین روز» زمان‌بندی</span>'
            :'<span style="color:#f59e0b">⚠ برای عملیات هفته انتخاب کنید</span>')
    +'</div>'
    +'</div>'
    +'</div>';

  var _existTbody = document.getElementById('wpFclTbody');
  if (_existTbody) {
    _existTbody.innerHTML = tbody;
    var _existFoot = document.getElementById('wpFclFooterSpan');
    if (_existFoot) _existFoot.innerHTML = (unschedEntries.length?'<strong>'+unschedEntries.length+'</strong> در هفته بدون تاریخ &middot; ':'')+allCenters.length+' مرکز در صف';
    var _existExp = document.getElementById('wpFclExpertSummaryDiv');
    if (_existExp) _existExp.innerHTML = _wpFclExpertSummary(filtC.concat(filtU));
    return;
  }
  el.innerHTML = html;
}

// wpPickForDay: afzoudan mrkz ba tarikh mostaghim be ruz morede nazar
var _wpPickDay = {weekId:'', dayStr:''};

function wpPickForDay(weekId, dayStr) {
  _buildPCCache();
  _wpPickDay = {weekId:weekId, dayStr:dayStr};
  var inWeekMap = {};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(!k.startsWith(weekId+':::')) return;
    var we = DB.weekEntries[k];
    inWeekMap[we.recKey||((we.rtype||'')+'_'+(we.rid||''))] = true;
  });
  var centers = [];
  getAllProvinces().forEach(function(p){
    var tp = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var rk = tp+'_'+c.id;
      if(inWeekMap[rk]) return;
      var e = getE(tp,c.id); var owner = e.owner||c.owner||'';
      if(!_isManager() && owner && owner!==currentUser) return;
      centers.push({id:c.id,rtype:tp,name:c.name||'',provName:p.name||'',owner:owner,ownerName:owner?(USERS[owner]||owner):'—'});
    });
  });
  var _centers = centers;
  var renderList = function(){
    var nq = fNorm((document.getElementById('wpPickSearch')||{}).value||'');
    var filtered = _centers.filter(function(c){return !nq||fNorm(c.name).indexOf(nq)>=0||fNorm(c.provName).indexOf(nq)>=0;});
    var rows = filtered.slice(0,80).map(function(c,i){
      return '<div class="wp-pick-row" data-idx="'+i+'" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer" onclick="wpPickSelect(this)">'
        +'<div>'
          +'<div style="font-weight:600;font-size:12px;color:var(--text-primary)">'+esc(c.name)+'</div>'
          +'<div style="font-size:10px;color:var(--text-muted)">'+esc(c.provName)+' — '+esc(c.ownerName)+'</div>'
        +'</div>'
        +'<span style="font-size:11px;color:var(--brand);flex-shrink:0">افزودن ←</span>'
        +'</div>';
    }).join('');
    var el = document.getElementById('wpPickList');
    if(el){
      el.innerHTML = rows || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">موردی یافت نشد</div>';
      // store filtered list for onclick lookup
      el._filtered = filtered;
    }
  };
  window._wpPickRenderList = renderList;
  var body = '<div style="margin-bottom:10px">'
    +'<input id="wpPickSearch" type="text" placeholder="🔍 جستجو مرکز / استان..." '
    +'style="width:100%;padding:8px 10px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box" '
    +'oninput="_wpPickRenderList()">'
    +'</div>'
    +'<div id="wpPickList" style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:6px"></div>';
  openModal('wpPickModal','📅 افزودن مرکز به '+dayStr, body,
    '<button class="btn-secondary" onclick="closeModal(\'wpPickModal\')">بستن</button>');
  setTimeout(function(){
    var el=document.getElementById('wpPickSearch');
    if(el)el.focus();
    renderList();
  },60);
}
// مرکز را از تمام هفته‌های دیگر حذف می‌کند تا فقط در یک هفته باشد
function wpRemoveFromOtherWeeks(recKey, keepWeekId){
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(keepWeekId && k.startsWith(keepWeekId+':::')) return;
    var we=DB.weekEntries[k];
    if(!we||typeof we!=='object')return;
    var rk=we.recKey||(we.rtype+'_'+we.rid);
    if(rk===recKey) delete DB.weekEntries[k];
  });
}

function wpDeduplicateEntries(){
  // یک مرکز فقط باید در یک هفته باشد — قدیمی‌ترین کپی‌ها حذف می‌شوند
  var byCenter={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we||typeof we!=='object')return;
    var rk=we.recKey||(we.rtype&&we.rid?we.rtype+'_'+we.rid:'');
    if(!rk)return;
    if(!byCenter[rk])byCenter[rk]=[];
    byCenter[rk].push(k);
  });
  var removed=0;
  Object.keys(byCenter).forEach(function(rk){
    var keys=byCenter[rk];
    if(keys.length<=1)return;
    // نگه‌داشتن هفته جدیدترین (بزرگ‌ترین weekId بر اساس مرتب‌سازی رشته‌ای)
    keys.sort();
    var keep=keys[keys.length-1];
    keys.forEach(function(k){
      if(k!==keep){delete DB.weekEntries[k];removed++;}
    });
  });
  return removed;
}

function wpPickSelect(row){
  var list = document.getElementById('wpPickList');
  if(!list||!list._filtered) return;
  var idx = parseInt(row.getAttribute('data-idx'), 10);
  var c = list._filtered[idx];
  if(!c) return;
  var weekId = _wpPickDay.weekId, dayStr = _wpPickDay.dayStr;
  var eKey = wpEntryKey(weekId, c.rtype, c.id);
  if(DB.weekEntries[eKey]){showToast('این مرکز قبلاً در این هفته است');closeModal('wpPickModal');return;}
  var _rk = c.rtype+'_'+c.id;
  var _wasInOther = Object.keys(DB.weekEntries||{}).some(function(k){
    if(k.startsWith(weekId+':::')) return false;
    var we=DB.weekEntries[k]; return (we.recKey||we.rtype+'_'+we.rid)===_rk;
  });
  wpRemoveFromOtherWeeks(_rk, weekId);
  DB.weekEntries[eKey]={
    scheduledDate:dayStr, done:false, doneDate:null,
    rtype:c.rtype, rid:c.id, recKey:c.rtype+'_'+c.id,
    centerName:c.name||getRecLabel(c.rtype+'_'+c.id),
    actionType:'call', addedBy:currentUser
  };
  saveDB();
  closeModal('wpPickModal');
  renderWeekPlan();
  showToast(_wasInOther ? 'مرکز از هفته قبلی منتقل شد 🔄' : 'مرکز به هفته اضافه شد ✅', 2000);
}

function _wpFclExpertSummary(filtered) {
  if (!filtered.length) return '';
  var counts = {};
  filtered.forEach(function(c) {
    var key = c.owner || '__none__';
    counts[key] = (counts[key] || 0) + 1;
  });
  var total = filtered.length;
  var members = typeof umGetActive === 'function' ? umGetActive() : [];
  var chips = Object.keys(counts).sort(function(a, b) {
    return counts[b] - counts[a];
  }).map(function(uid) {
    var n = counts[uid];
    var pct = Math.round(n / total * 100);
    var m = members.find(function(x) { return x.id === uid; });
    var name = m ? m.name : (USERS[uid] || (uid === '__none__' ? 'بدون مسئول' : uid));
    var color = m ? (m.color || '#94a3b8') : '#94a3b8';
    return '<div style="display:flex;align-items:center;gap:5px;padding:5px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;font-size:11px;white-space:nowrap">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:'+color+';flex-shrink:0"></span>'
      + '<span style="font-weight:600">'+esc(name)+'</span>'
      + '<span style="background:'+color+'22;color:'+color+';font-weight:700;padding:1px 7px;border-radius:10px;font-size:10px">'+n+'</span>'
      + '<span style="color:var(--text-muted);font-size:10px">('+pct+'\u0669)</span>'
      + '</div>';
  }).join('');
  return '<div style="padding:8px 12px;background:var(--bg-raised);border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
    + '<span style="font-size:11px;color:var(--text-muted);font-weight:600;flex-shrink:0">\u062a\u0648\u0632\u06cc\u0639 \u06a9\u0627\u0631\u0634\u0646\u0627\u0633\u0627\u0646:</span>'
    + chips + '</div>';
}

function wpFclToggle() {
  _wpFclOpen = !_wpFclOpen;
  var body = document.getElementById('wpFclBody');
  var arrow = document.getElementById('wpFclArrow');
  if (body) body.className = 'wp-fcl-body' + (_wpFclOpen ? ' open' : '');
  if (arrow) arrow.textContent = _wpFclOpen ? '\u25b2' : '\u25bc';
}

function wpFclAddToWeek(weekId, rtype, rid) {
  var eKey = wpEntryKey(weekId, rtype, rid);
  if (DB.weekEntries[eKey]) { showToast('این مرکز قبلاً در این هفته است'); return; }
  var _rk = rtype+'_'+rid;
  var _wasInOther = Object.keys(DB.weekEntries||{}).some(function(k){
    if(k.startsWith(weekId+':::')) return false;
    var we=DB.weekEntries[k]; return (we.recKey||we.rtype+'_'+we.rid)===_rk;
  });
  wpRemoveFromOtherWeeks(_rk, weekId);
  DB.weekEntries[eKey] = {
    scheduledDate: null, done: false, doneDate: null,
    rtype: rtype, rid: rid, recKey: rtype + '_' + rid,
    centerName: getRecLabel(rtype + '_' + rid),
    actionType: 'call', addedBy: currentUser
  };
  saveDB();
  renderWeekPlan();
  showToast(_wasInOther ? 'مرکز از هفته قبلی منتقل شد 🔄' : 'مرکز به هفته اضافه شد ✅', 2000);
}

function toggleWpActionType(eKey) {
  if (!DB.weekEntries[eKey]) return;
  var cur = DB.weekEntries[eKey].actionType || 'call';
  DB.weekEntries[eKey].actionType = (cur === 'call') ? 'visit' : 'call';
  saveDB();
  renderWeekPlan();
}

function renderWpItem(entry,weekId){
  var k=entry._key||'';var parsed=wpParseEntryKey(k);
  var rtype=entry.rtype||parsed.rtype||'center';var rid=entry.rid||parsed.rid||'?';
  var recKey=entry.recKey||(rtype+'_'+rid);
  var name=entry.centerName||entry._name||getRecLabel(recKey);var done=entry.done;
  // نمایش ویژه پیگیری مطالبات
  if(rtype==='mtr'){
    var amtStr=entry.mtrAmount?Math.round(entry.mtrAmount).toLocaleString('fa')+' ت':'';
    return '<div class="wp-item'+(done?' done':'')+'" data-ekey="'+k+'" draggable="true" ondragstart="event.stopPropagation();wpDragStart(event,\''+k+'\')" ondragend="wpDragEnd(event)" style="border-right-color:#dc2626;background:'+(done?'var(--bg-raised)':'#fef2f2')+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      +'<div class="wp-item-name" style="color:#991b1b">📄 '+esc(entry.mtrCustomer||rid)+'</div>'
      +(amtStr?'<span style="font-size:9px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:10px;font-weight:700;white-space:nowrap">'+amtStr+'</span>':'')
      +'</div>'
      +'<div class="wp-item-meta" style="color:#dc2626">مطالبات — ف'+esc(rid)+(done?' ✓':'')+'</div>'
      +'<div class="wp-item-actions">'
      +(done?'':`<button class="wp-btn done-btn" onclick="wpMarkDoneKey('`+k+`')">✓ وصول شد</button>`)
      +`<button class="wp-btn" style="border-color:#dc2626;color:#991b1b" onclick="wpRemoveEntry('`+k+`')">✕</button>`
      +'</div></div>';
  }
  
  var actType = entry.actionType || 'call';
  var actIcon = actType === 'visit' ? '🤝 ویزیت' : '📞 تماس';
  var actBg = actType === 'visit' ? '#8b5cf6' : '#0ea5e9';
  var isSel2 = _wpSelected.has(k);

  // نشانگر وضعیت (فقط مدیر): 🟠 بدون تاریخ | 🔴 معوق | 🟢 انجام شده | 🔴 امروز بدون گزارش
  var _todayDot = '';
  if(_isManager() && !done){
    var _today2=todayStr(),_sd2=entry.scheduledDate||'',_dc='',_dt='';
    var _chkAct=function(ds){return (DB.changeLog||[]).some(function(l){if(l.rkey!==rtype+'_'+rid||!l.at)return false;var _dp=l.at.slice(0,10).split('-').map(Number);if(_dp.length!==3)return false;var _jd=g2j(_dp[0],_dp[1],_dp[2]);return _jd[0]+'/'+p2(_jd[1])+'/'+p2(_jd[2])===ds;});};
    if(!_sd2){_dc='#f59e0b';_dt='بدون تاریخ';}
    else if(_sd2<_today2){var _had=_chkAct(_sd2);_dc=_had?'#22c55e':'#ef4444';_dt=_had?'انجام شد ('+_sd2+')':'سررسید گذشته — بدون گزارش ('+_sd2+')';}
    else if(_sd2===_today2){var _has=_chkAct(_today2);_dc=_has?'#22c55e':'#ef4444';_dt=_has?'فعالیت ثبت شده':'امروز — بدون گزارش';}
    if(_dc)_todayDot='<span title="'+_dt+'" style="width:8px;height:8px;border-radius:50%;background:'+_dc+';display:inline-block;flex-shrink:0;border:1px solid rgba(0,0,0,.15)"></span>';
  }

  return '<div class="wp-item'+(done?' done':'')+(!done&&isSel2?' wp-selected':'')+'" data-ekey="'+k+'" draggable="true" ondragstart="event.stopPropagation();wpDragStart(event,\''+k+'\')" ondragend="wpDragEnd(event)">'
    + '<input type="checkbox" class="wp-item-cb" '+(isSel2?'checked':'')+' onclick="event.stopPropagation();wpToggleSelect(\''+(k)+'\')" title="انتخاب">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-left:18px;">'
    + '<div class="wp-item-name" onclick="openCenterModal(\''+rtype+'\',\''+rid+'\')" style="cursor:pointer;text-decoration:underline dotted;color:var(--brand);display:flex;align-items:center;gap:4px">'+_todayDot+esc(name)+'</div>'
    + '<span style="font-size:9px; cursor:pointer; background:'+actBg+'; color:var(--text-primary); padding:2px 5px; border-radius:4px; white-space:nowrap;" onclick="toggleWpActionType(\''+k+'\')" title="تغییر نوع پیگیری با یک کلیک">'+actIcon+'</span>'
    + '</div>'
    + (function(){var _ce=getE(rtype,rid);var _st=_ce.status||'بدون تماس';var _owId=_wpGetOwner(entry);var _ow=USERS[_owId]||_owId||'';var _fd=_ce.followupDate||'';var _owHtml=_ow?'<span style="display:inline-block;background:#dbeafe;color:#1e40af;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin-right:4px">👤 '+esc(_ow)+'</span>':'';return '<div class="wp-item-meta" style="margin-top:3px">'+_owHtml+'<span style="font-size:9px;color:var(--text-muted)">'+_st+( (_fd)?' 📅 '+_fd:'')+' '+(done?'✓ '+entry.doneDate:'')+'</span></div>';})()
    + '<div class="wp-item-actions">'
    + (done?'' : '<button class="wp-btn done-btn" onclick="wpMarkDoneKey(\''+ k +'\')">✓ انجام شد</button>')
    + '<button class="wp-btn move-btn" onclick="wpSetScheduleFromKey(\''+ k +'\')">📅 تنظیم</button>'
    + '<button class="wp-btn" style="border-color:#0ea5e9;color:#0369a1" onclick="wpMoveEntry(\''+ k +'\',\''+ weekId +'\')">↪ هفته دیگر</button>'
    + '<button class="wp-btn" style="border-color:#dc2626;color:#991b1b" onclick="wpRemoveEntry(\''+ k +'\')">✕</button>'
    + '</div></div>';
}
var _wpSelected = new Set();

function wpToggleSelect(eKey){
  if(_wpSelected.has(eKey)) _wpSelected.delete(eKey);
  else _wpSelected.add(eKey);
  _wpUpdateBulkBar();
  var el = document.querySelector('.wp-item[data-ekey="'+eKey+'"]');
  if(el){
    if(_wpSelected.has(eKey)) el.classList.add('wp-selected');
    else el.classList.remove('wp-selected');
  }
}

function _wpUpdateBulkBar(){
  var bar = document.getElementById('wpBulkBar');
  var cnt = document.getElementById('wpBulkCount');
  if(!bar) return;
  if(_wpSelected.size > 0){
    bar.classList.add('active');
    if(cnt) cnt.textContent = _wpSelected.size + ' مورد انتخاب شده';
  } else {
    bar.classList.remove('active');
  }
}

function wpClearSelection(){
  _wpSelected.clear();
  document.querySelectorAll('.wp-item.wp-selected').forEach(function(el){ el.classList.remove('wp-selected'); });
  document.querySelectorAll('.wp-item-cb').forEach(function(cb){ cb.checked = false; });
  _wpUpdateBulkBar();
}

function wpBulkDone(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  keys.forEach(function(k){
    if(DB.weekEntries[k]){ DB.weekEntries[k].done=true; DB.weekEntries[k].doneDate=todayStr(); }
  });
  saveDB(); wpClearSelection(); renderWeekPlan();
  showToast('✅ '+keys.length+' مورد به عنوان انجام‌شده ثبت شد — در تب فعالیت‌ها قابل مشاهده است',3000);
}

function wpBulkRemove(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  if(!confirm(keys.length+' مورد از برنامه هفته حذف شود؟')) return;
  keys.forEach(function(k){ delete DB.weekEntries[k]; });
  saveDB(); wpClearSelection(); renderWeekPlan();
  showToast('🗑 '+keys.length+' مورد حذف شد',2000);
}

function wpBulkMove(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  var sel = document.getElementById('wpSel');
  var currentWeekId = sel ? sel.value : null;
  var weeks = wpGetWeeks();
  var futureWeeks = weeks.filter(function(w){ return w.id!==currentWeekId && !w.isPast; }).slice(0,10);
  var pastWeeks = weeks.filter(function(w){ return w.id!==currentWeekId && w.isPast; }).slice(-4);
  var shown = pastWeeks.concat(futureWeeks);
  var body = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">'+keys.length+' مورد انتخابی را به کدام هفته منتقل کنید؟</div>'
    +'<div style="display:flex;flex-direction:column;gap:4px;max-height:55vh;overflow-y:auto">'
    +shown.map(function(wt){
      return '<button onclick="wpDoBulkMove(\'' + wt.id + '\')" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);cursor:pointer;font-family:inherit">'
        +'<span style="font-weight:600;color:var(--text-primary)">'+esc(wt.label)+'</span>'
        +'<span style="font-size:11px;background:#0ea5e920;color:#0ea5e9;border:1px solid #0ea5e944;padding:2px 8px;border-radius:10px">انتقال</span>'
        +'</button>';
    }).join('')+'</div>';
  openModal('wpBulkMoveModal','📦 انتقال گروهی — '+keys.length+' مورد به هفته دیگر',body,'<button class="btn-secondary" onclick="closeModal(\'wpBulkMoveModal\')">انصراف</button>');
}

function wpDoBulkMove(targetWeekId){
  var keys = Array.from(_wpSelected);
  keys.forEach(function(eKey){
    if(!DB.weekEntries[eKey]) return;
    var we = DB.weekEntries[eKey];
    var parsed = wpParseEntryKey(eKey);
    var recKey = we.recKey||((parsed.rtype||we.rtype||'')+'_'+(parsed.rid||we.rid||''));
    wpRemoveFromOtherWeeks(recKey, targetWeekId);
    var newKey = wpEntryKey(targetWeekId, parsed.rtype||we.rtype||'', parsed.rid||we.rid||'');
    if(newKey !== eKey) DB.weekEntries[newKey] = Object.assign({}, we, {scheduledDate:null, done:false, doneDate:null});
    if(newKey !== eKey) delete DB.weekEntries[eKey];
  });
  saveDB(); wpClearSelection(); closeModal('wpBulkMoveModal'); renderWeekPlan();
  showToast('↪ '+keys.length+' مورد منتقل شد',2500);
}

function wpMarkDoneKey(eKey){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  var rtype=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');
  var rid=we.rid||(we.recKey?we.recKey.split('_').slice(1).join('_'):'');
  var cname=we.name||'';
  if(!cname&&rtype&&rid){var c=getCenterById(rtype,rid);if(c)cname=c.name||c.hosp_name||'';}
  // Default next date: today + 7 days in Jalali
  var td=todayStr();var tdp=td.split('/').map(Number);
  var defNext=jAddDays(tdp[0],tdp[1],tdp[2],7);
  var defNextStr=defNext[0]+'/'+(defNext[1]<10?'0'+defNext[1]:defNext[1])+'/'+(defNext[2]<10?'0'+defNext[2]:defNext[2]);
  var _resultOpts=['موفق — قرارداد','پیشنهاد ارسال شد','نیاز به پیگیری','عدم علاقه','قابل دسترس نبود','دیگر'];
  var body='<div style="padding:6px 0">'
    +'<div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary)">مرکز: <b>'+esc(cname)+'</b></div>'
    +'<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">نتیجه</label>'
    +'<select id="_mdk_result" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);margin-bottom:8px">'
    +_resultOpts.map(function(o){return'<option value="'+o+'">'+o+'</option>';}).join('')
    +'</select>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px">'
    +'<div><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">💰 مبلغ تخمینی (میلیون تومان)</label>'
    +'<input id="_mdk_amount" type="number" min="0" step="0.1" placeholder="مثلاً: 12.5" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)"></div>'
    +'<div><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">🚧 مانع اصلی</label>'
    +'<select id="_mdk_obstacle" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'
    +'<option value="">— ندارد —</option>'
    +'<option>عدم بودجه / کمبود نقدینگی</option>'
    +'<option>رقیب قیمت پایین‌تر</option>'
    +'<option>نیاز به تأیید مدیر بالاتر</option>'
    +'<option>عدم علاقه به محصول</option>'
    +'<option>زمان‌بندی نامناسب</option>'
    +'<option>عدم آشنایی با محصول</option>'
    +'<option>دیگر</option>'
    +'</select></div>'
    +'</div>'
    +'<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">یادداشت / جزئیات</label>'
    +'<textarea id="_mdk_note" rows="2" placeholder="توضیحات..." style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;resize:vertical;background:var(--bg-input);color:var(--text-primary);direction:rtl;margin-bottom:8px"></textarea>'
    +'<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">اقدام بعدی</label>'
    +'<input id="_mdk_nextaction" type="text" placeholder="مثلاً: ارسال کاتالوگ، تماس با مدیر..." style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);margin-bottom:8px">'
    +'<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">تاریخ پیگیری بعدی</label>'
    +'<input id="_mdk_nextdate" type="text" value="'+defNextStr+'" readonly class="fd-inp" style="cursor:pointer;width:100%;box-sizing:border-box" '
    +'onclick="openJDP(this,function(v){document.getElementById(\'_mdk_nextdate\').value=v;})">'
    +'</div>';
  var footer='<button class="btn-primary" style="background:#16a34a;border-color:#16a34a" onclick="_wpFinishDone(\''+eKey+'\',true)">✅ ثبت + پیگیری بعدی</button>'
    +'<button class="btn-secondary" onclick="_wpFinishDone(\''+eKey+'\',false)">بدون پیگیری</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'wpDoneModal\')">انصراف</button>';
  openModal('wpDoneModal','✅ انجام شد',body,footer);
}
function jAddDays(jy,jm,jd,days){
  var g=j2g(jy,jm,jd);var ts=new Date(g[0],g[1]-1,g[2]);
  ts.setDate(ts.getDate()+days);
  return g2j(ts.getFullYear(),ts.getMonth()+1,ts.getDate());
}
function _wpFinishDone(eKey,setNext){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  we.done=true;we.doneDate=todayStr();
  we.doneResult=(document.getElementById('_mdk_result')||{}).value||'';
  we.doneNote=(document.getElementById('_mdk_note')||{}).value||'';
  we.doneNextAction=(document.getElementById('_mdk_nextaction')||{}).value||'';
  var _doneAmt=parseFloat((document.getElementById('_mdk_amount')||{}).value||'');
  if(_doneAmt>0)we.doneAmount=_doneAmt;
  var _doneObs=(document.getElementById('_mdk_obstacle')||{}).value||'';
  if(_doneObs)we.doneObstacle=_doneObs;
  var rtype=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');
  var rid=we.rid||(we.recKey?we.recKey.split('_').slice(1).join('_'):'');
  var cname=we.centerName||getRecLabel(rtype+'_'+rid)||'';
  var actionType=we.actionType||'call';
  // auto-mirror done note into DB.notes so manager can see it
  if(we.doneNote&&rtype&&rid){
    if(!DB.notes)DB.notes={};
    var _dnKey=rtype+'_'+rid;
    if(!DB.notes[_dnKey])DB.notes[_dnKey]=[];
    var _dnPfx=actionType==='visit'?'🤝 نتیجه ملاقات: ':'📞 نتیجه تماس: ';
    DB.notes[_dnKey].push({text:_dnPfx+we.doneNote,at:new Date().toISOString(),by:currentUser||''});
  }
  var _foundWeekLabel='';
  if(setNext){
    var nextDate=(document.getElementById('_mdk_nextdate')||{}).value||'';
    if(nextDate&&rtype&&rid){
      setE(rtype,rid,'followupDate',nextDate);
      // find the week that contains nextDate and auto-schedule
      var ndp=nextDate.split('/').map(Number);
      if(ndp.length===3&&ndp[0]){
        var ndMs=jMs(ndp[0],ndp[1],ndp[2]);
        var foundWeek=null;
        [ndp[0]-1,ndp[0],ndp[0]+1].forEach(function(yr){
          if(foundWeek)return;
          getYearWeeks(yr).forEach(function(wk){
            if(foundWeek)return;
            var wsMs=jMs(wk.wsArr[0],wk.wsArr[1],wk.wsArr[2]);
            var weMs=jMs(wk.weArr[0],wk.weArr[1],wk.weArr[2]);
            if(ndMs>=wsMs&&ndMs<=weMs)foundWeek=wk;
          });
        });
        if(foundWeek){
          var newKey=wpEntryKey(foundWeek.id,rtype,rid);
          DB.weekEntries[newKey]={scheduledDate:nextDate,done:false,doneDate:null,rtype:rtype,rid:rid,recKey:rtype+'_'+rid,centerName:cname,actionType:actionType,addedBy:currentUser};
          // navigate week plan to destination week so entry is visible
          _wpYear=foundWeek.jYear;
          var _sel=document.getElementById('wpSel');
          if(_sel){wpBuildSelect();_sel.value=foundWeek.id;}
          _foundWeekLabel=foundWeek.label;
        }
      }
    }
  }
  closeModal('wpDoneModal');
  saveDBSync();renderWeekPlan();renderDashboard();
  if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
  showToast(_foundWeekLabel?'✅ انجام شد — پیگیری در '+_foundWeekLabel:'✅ انجام شد!',3000);
  if(currentTab==='kpi')setTimeout(renderKPIPanel,300);
}
var _wpDragging = null;

function wpDragStart(event, eKey) {
  _wpDragging = eKey;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', eKey);
  setTimeout(function() {
    var el = document.querySelector('.wp-item[data-ekey="' + eKey + '"]');
    if (el) el.classList.add('dragging');
  }, 0);
}

function wpDragEnd(event) {
  document.querySelectorAll('.wp-item.dragging').forEach(function(el) { el.classList.remove('dragging'); });
  document.querySelectorAll('.wp-day-body.wp-drop-over').forEach(function(el) { el.classList.remove('wp-drop-over'); });
  _wpDragging = null;
}

function wpDrop(event, targetDate) {
  event.preventDefault();
  document.querySelectorAll('.wp-day-body.wp-drop-over').forEach(function(el) { el.classList.remove('wp-drop-over'); });
  var eKey = _wpDragging || event.dataTransfer.getData('text/plain');
  if (!eKey || !DB.weekEntries[eKey]) return;
  if (DB.weekEntries[eKey].scheduledDate === targetDate) return;
  DB.weekEntries[eKey].scheduledDate = targetDate;
  saveDB();
  renderWeekPlan();
  showToast('📅 تاریخ به ' + targetDate + ' تغییر کرد', 2000);
}

function wpRemoveEntry(eKey){
  delete DB.weekEntries[eKey];saveDB();renderWeekPlan();
}
// حذف همه ورودی‌های یک مرکز در یک هفته خاص (برای رفع مشکل duplicate)
function wpRemoveAllInWeek(weekId,recKey){
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(k.split(':::')[0]!==weekId)return;
    var we=DB.weekEntries[k];
    var rk=we.recKey||(we.rtype+'_'+we.rid);
    var parsed=wpParseEntryKey(k);
    var keyRk=parsed.rtype+'_'+parsed.rid;
    if(rk===recKey||keyRk===recKey)delete DB.weekEntries[k];
  });
  saveDBSync();renderWeekPlan();
  if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
}

function wpMoveEntry(eKey,currentWeekId){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  var name=we.centerName||we._name||(we.recKey?getRecLabel(we.recKey):'?');
  var weeks=wpGetWeeks();
  var futureWeeks=weeks.filter(function(w){return w.id!==currentWeekId&&!w.isPast;}).slice(0,10);
  var pastWeeks=weeks.filter(function(w){return w.id!==currentWeekId&&w.isPast;}).slice(-4);
  var shown=pastWeeks.concat(futureWeeks);
  var body='<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">'+esc(name)+' را به کدام هفته منتقل کنید؟</div>'
    +'<div style="display:flex;flex-direction:column;gap:4px;max-height:55vh;overflow-y:auto">'
    +shown.map(function(wt){
      return '<button onclick="wpDoMoveEntry(\''+eKey+'\',\''+wt.id+'\')" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);cursor:pointer;font-family:inherit">'
        +'<span style="font-weight:600;color:var(--text-primary)">'+esc(wt.label)+'</span>'
        +'<span style="font-size:11px;background:#0ea5e920;color:#0ea5e9;border:1px solid #0ea5e944;padding:2px 8px;border-radius:10px">انتقال</span>'
        +'</button>';
    }).join('')
    +'</div>';
  openModal('wpMoveModal','انتقال به هفته دیگر',body,'<button class="btn-secondary" onclick="closeModal(\'wpMoveModal\')">انصراف</button>');
}

function wpDoMoveEntry(eKey,targetWeekId){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  var parsed=wpParseEntryKey(eKey);
  var newKey=wpEntryKey(targetWeekId,parsed.rtype||we.rtype||'',parsed.rid||we.rid||'');
  if(newKey===eKey){showToast('مرکز از قبل در این هفته است');closeModal('wpMoveModal');return;}
  if(DB.weekEntries[newKey]){showToast('مرکز از قبل در هفته مقصد است');closeModal('wpMoveModal');return;}
  DB.weekEntries[newKey]=Object.assign({},we,{scheduledDate:null,done:false,doneDate:null});
  delete DB.weekEntries[eKey];
  closeModal('wpMoveModal');
  renderWeekPlan();
  showToast('مرکز به هفته جدید منتقل شد',2500);
}

function clearScheduleDate(eKey){
  if(!DB.weekEntries[eKey])return;
  DB.weekEntries[eKey].scheduledDate=null;
  saveDB();closeModal('schModal');renderWeekPlan();
  showToast('تاریخ حذف شد');
}

function wpSetScheduleFromKey(eKey){
  if(!eKey||!DB.weekEntries[eKey]){showToast('⚠ کلید یافت نشد: '+eKey);return;}
  var we = DB.weekEntries[eKey];
  var name = we.recKey ? getRecLabel(we.recKey) : (we.rtype && we.rid ? getRecLabel(we.rtype+'_'+we.rid) : '?');
  var curType = we.actionType || 'call';
  var curDate = we.scheduledDate || '';
  
  var body = '<div class="m-2col" style="margin-bottom:15px">'
    + '<div><label style="color:#0369a1;font-weight:bold;margin-bottom:5px;display:block">نوع برنامه:</label>'
    + '<select id="schActType" style="width:100%;padding:8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px">'
    + '<option value="call"'+(curType==='call'?' selected':'')+'>📞 تماس تلفنی</option>'
    + '<option value="visit"'+(curType==='visit'?' selected':'')+'>🤝 ویزیت حضوری</option>'
    + '</select></div>'
    + '<div><label style="color:#0369a1;font-weight:bold;margin-bottom:5px;display:block">تاریخ پیگیری:</label>'
    + '<input id="schDate" type="text" value="'+curDate+'" readonly placeholder="کلیک برای انتخاب..." style="width:100%;padding:8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;cursor:pointer;background:var(--bg-raised)" onclick="openJDP(this,function(v){document.getElementById(\'schDate\').value=v;})">'
    + '</div></div>';
    
  var foot = '<button class="btn-secondary" onclick="closeModal(\'schModal\')">انصراف</button>'
    + '<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #fcd34d;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="clearScheduleDate(\''+eKey+'\')">📅 حذف تاریخ</button>'
    + '<button style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="if(confirm(\'این مرکز از برنامه هفته حذف شود؟\')){wpRemoveEntry(\''+eKey+'\');closeModal(\'schModal\');}">🗑 حذف از هفته</button>'
    + '<button class="btn-primary" onclick="saveScheduleFromModal(\''+eKey+'\')">💾 ثبت برنامه</button>';
    
  openModal('schModal', '📅 تعیین برنامه برای: ' + esc(name), body, foot);
}

function saveScheduleFromModal(eKey) {
  var dateVal = document.getElementById('schDate').value;
  var actVal = document.getElementById('schActType').value;
  if(!dateVal){showToast('⚠ لطفاً تاریخ را مشخص کنید');return;}

  // بررسی اینکه تاریخ داخل هفته انتخاب‌شده است
  var weekId=eKey.split(':::')[0];
  var wk=wpGetWeeks().find(function(w){return w.id===weekId;});
  if(wk){
    // محدوده هفته
    var ws=wk.wsArr;
    var weekDates=[];
    for(var i=0;i<7;i++){
      var d=jAdd(ws[0],ws[1],ws[2],i);
      weekDates.push(d[0]+'/'+p2(d[1])+'/'+p2(d[2]));
    }
    if(weekDates.indexOf(dateVal)<0){
      // date outside current week — auto-move entry to the correct week
      var ndp2=dateVal.split('/').map(Number);
      var ndMs2=jMs(ndp2[0],ndp2[1],ndp2[2]);
      var destWeek=null;
      [ndp2[0]-1,ndp2[0],ndp2[0]+1].forEach(function(yr){
        if(destWeek)return;
        getYearWeeks(yr).forEach(function(wk2){
          if(destWeek)return;
          var wsMs2=jMs(wk2.wsArr[0],wk2.wsArr[1],wk2.wsArr[2]);
          var weMs2=jMs(wk2.weArr[0],wk2.weArr[1],wk2.weArr[2]);
          if(ndMs2>=wsMs2&&ndMs2<=weMs2)destWeek=wk2;
        });
      });
      var _we2=DB.weekEntries[eKey];
      if(destWeek&&_we2){
        var newKey2=wpEntryKey(destWeek.id,_we2.rtype,_we2.rid);
        if(newKey2!==eKey){
          DB.weekEntries[newKey2]=Object.assign({},_we2,{scheduledDate:dateVal,actionType:actVal,done:false,doneDate:null});
          delete DB.weekEntries[eKey];
        } else {
          DB.weekEntries[eKey].scheduledDate=dateVal;
          DB.weekEntries[eKey].actionType=actVal;
        }
        if(_we2.rtype&&_we2.rid)setE(_we2.rtype,_we2.rid,'followupDate',dateVal);
        _wpYear=destWeek.jYear;
        var _sel2=document.getElementById('wpSel');
        if(_sel2){wpBuildSelect();_sel2.value=destWeek.id;}
      }
      saveDB();closeModal('schModal');renderWeekPlan();
      showToast('↪ انتقال به '+(destWeek?destWeek.label:dateVal), 2500);
      return;
    }
  }

  DB.weekEntries[eKey].scheduledDate = dateVal;
  DB.weekEntries[eKey].actionType = actVal;
  var we = DB.weekEntries[eKey];
  var rtype = we.rtype; var rid = we.rid;
  if(rtype && rid){setE(rtype, rid, 'followupDate', dateVal);}
  saveDB();closeModal('schModal');renderWeekPlan();
  showToast('📅 برنامه تنظیم شد', 2500);
}
function openAssignWeekForCenter(rtype,id,name){
  var wks=wpGetWeeks();
  var shown=[];var seen={};
  wks.filter(function(w){return w.isCurrent||!w.isPast;}).slice(0,8)
    .concat(wks.filter(function(w){return w.isPast;}).slice(-3))
    .forEach(function(w){if(!seen[w.id]){seen[w.id]=true;shown.push(w);}});
  shown.sort(function(a,b){return a.num-b.num;});

  // پیدا کردن هفته‌هایی که این مرکز در آن‌ها هست
  // currentWeekKeys: weekId → [key1, key2, ...] — آرایه تا همه duplicate‌ها را نگه داریم
  var recKey=rtype+'_'+id;
  var currentWeekKeys={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done)return;
    var rk=we.recKey||(we.rtype+'_'+we.rid);
    if(rk===recKey){var wid=k.split(':::')[0];if(!currentWeekKeys[wid])currentWeekKeys[wid]=[];currentWeekKeys[wid].push(k);}
  });
  var inWeekIds=Object.keys(currentWeekKeys);
  var currentWeekLabel='';
  if(inWeekIds.length){
    var cw=wks.find(function(w){return w.id===inWeekIds[0];});
    currentWeekLabel=cw?cw.label:inWeekIds[0];
  }

  var body='<div style="margin-bottom:10px;display:flex;gap:10px;align-items:center;background:var(--brand-bg);padding:8px;border-radius:6px;border:1px solid #bae6fd;">'
    +'<label style="font-size:11px;font-weight:bold;color:#0369a1;">نوع برنامه:</label>'
    +'<select id="wpActType" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:4px;font-size:11px;flex:1;">'
    +'<option value="call">📞 تماس تلفنی</option>'
    +'<option value="visit">🤝 ویزیت حضوری</option>'
    +'</select></div>'
    +(inWeekIds.length
      ?'<div style="font-size:11px;background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:5px;padding:7px 10px;margin-bottom:10px">📌 این مرکز در حال حاضر در <strong>'+esc(currentWeekLabel)+'</strong> برنامه‌ریزی شده. برای انتقال روی هفته مقصد کلیک کنید.</div>'
      :'<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">مرکز «'+esc(name)+'» را به کدام هفته اضافه کنید:</div>'
    )
    +'<div style="display:flex;flex-direction:column;gap:5px;max-height:55vh;overflow-y:auto">'
    +shown.map(function(wt){
      var isInThisWeek=!!(currentWeekKeys[wt.id]&&currentWeekKeys[wt.id].length);
      var rowBg=isInThisWeek?'#dbeafe':wt.isCurrent?'#fffbeb':'var(--bg-raised)';
      var rowBorder=isInThisWeek?'#93c5fd':wt.isCurrent?'#fcd34d':'var(--border)';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:'+rowBg+';border-radius:6px;border:1px solid '+rowBorder+'">'
        +'<div>'
          +'<div style="font-weight:600;font-size:12px">'+esc(wt.label)+'</div>'
          +(wt.isCurrent?'<span style="font-size:10px;color:#0ea5e9">◀ این هفته</span>':'')
          +(isInThisWeek?'<span style="font-size:10px;color:#1e40af;font-weight:700"> · در برنامه</span>':'')
        +'</div>'
        +(isInThisWeek
          ?'<button class="btn-danger" style="padding:3px 10px;font-size:11px" onclick="wpRemoveAllInWeek(\''+wt.id+'\',\''+recKey+'\');closeModal(\'awc_'+id+'\');openAssignWeekForCenter(\''+rtype+'\',\''+id+'\',\''+esc(name)+'\')">✕ حذف</button>'
          :'<button class="btn-primary" style="padding:3px 10px;font-size:11px;background:'+(inWeekIds.length?'#8b5cf6':'#0ea5e9')+';" onclick="var act=document.getElementById(\'wpActType\').value;addToWeekAuto(\''+wt.id+'\',\''+rtype+'\',\''+id+'\',\''+esc(name)+'\',act)">'
            +(inWeekIds.length?'↪ انتقال':'+ افزودن')
          +'</button>'
        )
        +'</div>';
    }).join('')+'</div>';

  openModal('awc_'+id,'📋 برنامه هفته — «'+esc(name)+'»',body,'<button class="btn-secondary" onclick="closeModal(\'awc_'+id+'\')">بستن</button>');
}

function addToWeekAuto(weekId,rtype,id,name,actionType){
  var eKey=wpEntryKey(weekId,rtype,id);
  var _rk=rtype+'_'+id;
  wpRemoveFromOtherWeeks(_rk, weekId);
  if(!DB.weekEntries[eKey]||DB.weekEntries[eKey].done)DB.weekEntries[eKey]={scheduledDate:null,done:false,doneDate:null,rtype:rtype,rid:id,recKey:rtype+'_'+id,centerName:getRecLabel(rtype+'_'+id),actionType:actionType||'call',addedBy:currentUser};
  saveDB();
  var sel=document.getElementById('wpSel');
  if(sel){
    var parts=weekId.split('/');if(parts[0])_wpYear=parseInt(parts[0]);
    wpBuildSelect();sel.value=weekId;
  }
  showToast('مرکز "'+name+'" به هفته اضافه شد ✅');
  closeModal('awc_'+id);
  renderWeekPlan();
  if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
}
function wpOpenAssignAll(){
  var sel=document.getElementById('wpSel');
  var weekId=sel&&sel.value?sel.value:null;
  if(!weekId){showToast('ابتدا یک هفته انتخاب کنید');return;}
  var wk=wpGetWeeks().find(function(w){return w.id===weekId;});
  var existingKeys={};
  Object.keys(DB.weekEntries||{}).filter(function(k){return k.startsWith(weekId+':::');}).forEach(function(k){
    var p=wpParseEntryKey(k);existingKeys[p.rtype+'_'+p.rid]=true;
  });
  var allRecs=[];
  getAllProvinces().forEach(function(p){
    var tp=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      allRecs.push({rtype:tp,id:c.id,name:c.name,provName:p.name,isIn:!!existingKeys[tp+'_'+c.id]});
    });
  });
  var body = '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;background:var(--brand-bg);padding:8px;border-radius:6px;border:1px solid #bae6fd;">'
    + '<label style="font-size:11px;font-weight:bold;color:#0369a1;">نوع برنامه (برای موارد انتخابی):</label>'
    + '<select id="wpAssignActType" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:4px;font-size:11px;flex:1;">'
    + '<option value="call">📞 تماس تلفنی</option>'
    + '<option value="visit">🤝 ویزیت حضوری</option>'
    + '</select></div>'
    + '<div style="margin-bottom:8px;display:flex;gap:6px;align-items:center"><input id="wpAQ" type="text" placeholder="جستجو..." style="flex:1" oninput="filterWpAssign()"><span style="font-size:11px;color:var(--text-muted)">'+allRecs.filter(function(r){return r.isIn;}).length+' انتخاب</span></div>'
    + '<div id="wpAList" style="max-height:50vh;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">'+allRecs.map(function(rec){
      return '<label style="display:flex;gap:6px;padding:6px 8px;background:'+(rec.isIn?'#dbeafe':'#f8fafc')+';border-radius:5px;cursor:pointer;font-size:11px;align-items:center;border:1px solid '+(rec.isIn?'#93c5fd':'#e2e8f0')+'" data-name="'+fNorm(rec.name)+'">'
        + '<input type="checkbox" data-rtype="'+rec.rtype+'" data-rid="'+rec.id+'"'+(rec.isIn?' checked':'')+'>'
        + '<span><div style="font-weight:600">'+esc(rec.name)+'</div><div style="font-size:9px;color:var(--text-muted)">'+esc(rec.provName)+'</div></span></label>';
    }).join('')
    + '</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'wpAssign\')">انصراف</button><button class="btn-primary" onclick="saveWpAssign(\''+ weekId +'\')">ذخیره</button>';
  openModal('wpAssign','📌 مراکز هفته «'+(wk?esc(wk.label):'')+'»',body,foot,{xl:true});
}

function saveWpAssign(weekId){
  var actType = document.getElementById('wpAssignActType').value || 'call';
  Object.keys(DB.weekEntries||{}).filter(function(k){return k.startsWith(weekId+':::');}).forEach(function(k){delete DB.weekEntries[k];});
  document.querySelectorAll('#wpAList input[type=checkbox]').forEach(function(cb){
    if(!cb.checked)return;
    var rtype=cb.getAttribute('data-rtype');var rid=cb.getAttribute('data-rid');
    var eKey=wpEntryKey(weekId,rtype,rid);
    var _rk=rtype+'_'+rid;
    wpRemoveFromOtherWeeks(_rk, weekId);
    DB.weekEntries[eKey]={scheduledDate:null,done:false,doneDate:null,rtype:rtype,rid:rid,recKey:rtype+'_'+rid,centerName:getRecLabel(rtype+'_'+rid),actionType:actType,addedBy:currentUser};
  });
  saveDB();
  var selWp=document.getElementById('wpSel');
  if(selWp&&weekId){var ptsWp=weekId.split('/');if(ptsWp[0])_wpYear=parseInt(ptsWp[0]);wpBuildSelect();selWp.value=weekId;}
  closeModal('wpAssign');renderWeekPlan();showToast('ذخیره شد ✅');
}

// ════════════════════════ NOTIFICATIONS ════════════════════
function _initNotif(){if(!DB.notifications)DB.notifications=[];}

// ── Browser Push Notifications ──────────────────────────────────────────────
var _pushGranted = false;

function _initBrowserNotif(){
  if(!('Notification' in window))return;
  if(Notification.permission==='granted'){_pushGranted=true;return;}
  if(Notification.permission==='denied')return;
  // Ask on first meaningful interaction (call from init after small delay)
  setTimeout(function(){
    Notification.requestPermission().then(function(p){
      _pushGranted=(p==='granted');
      if(_pushGranted)_firePushNotif('Flow CRM','اعلان‌های مرورگر فعال شد ✅');
    });
  },3000);
}

function _firePushNotif(title,body,tag){
  if(!_pushGranted||!('Notification' in window))return;
  try{
    var n=new Notification(title,{
      body:body,
      tag:tag||'flow-crm',
      icon:'/favicon.ico',
      dir:'rtl',
      lang:'fa'
    });
    setTimeout(function(){n.close();},8000);
    return n;
  }catch(e){}
}

function _sendOverduePushNotifs(){
  if(!_pushGranted)return;
  var items=getFollowups();
  var mine=_isExpert()?items.filter(function(i){return i.owner===currentUser;}):items;
  var overdue=mine.filter(function(i){return i.overdue;});
  if(!overdue.length)return;
  // Group message
  var msg=overdue.length+' مرکز معوق پیگیری دارند';
  if(overdue.length<=3){
    msg=overdue.map(function(i){return i.name;}).join('، ')+' — پیگیری نشده';
  }
  _firePushNotif('⚠ پیگیری‌های معوق',msg,'overdue-reminder');
}

// Periodic check: fire push if tab becomes visible after being hidden
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&_pushGranted){
    setTimeout(_sendOverduePushNotifs,2000);
  }
});

function sendNotif(toUser,message,centerKey,centerKeys){
  _initNotif();
  var n={id:Date.now()+'_'+Math.random().toString(36).slice(2),to:toUser,from:currentUser,at:new Date().toISOString(),message:message,centerKey:centerKey||'',centerKeys:centerKeys||null,read:false};
  DB.notifications.push(n);
  if(DB.notifications.length>300)DB.notifications=DB.notifications.slice(-300);
  saveDB();
  updateNotifBadge();
  showToast('\u{1F4E9} اعلان برای '+(USERS[toUser]||toUser)+' ارسال شد',2000);
}

function updateNotifBadge(){
  _initNotif();
  var unread=DB.notifications.filter(function(n){return n.to===currentUser&&!n.read;}).length;
  var badge=document.getElementById('notifBadge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'flex':'none';}
}

var _notifPanelOpen=false;
var _notifViewAll=false;
function setNotifView(all){
  _notifViewAll=!!all;
  var p=document.getElementById('notifPanel');
  if(p){p.remove();_notifPanelOpen=false;}
  toggleNotifPanel();
}
function toggleNotifPanel(){
  var existing=document.getElementById('notifPanel');
  if(existing){existing.remove();_notifPanelOpen=false;return;}
  _notifPanelOpen=true;
  _initNotif();
  var viewAll=_notifViewAll&&_isManager();
  var myNotifs=(viewAll
    ?DB.notifications.slice()
    :DB.notifications.filter(function(n){return n.to===currentUser;})
  ).slice().reverse().slice(0,100);
  var panel=document.createElement('div');
  panel.id='notifPanel';panel.className='notif-panel';
  var unreadIds=viewAll?[]:myNotifs.filter(function(n){return !n.read;}).map(function(n){return n.id;});
  var _tglBtn='';
  if(_isManager()){
    _tglBtn='<span style="display:inline-flex;gap:2px;background:var(--bg-raised);border-radius:6px;padding:2px;border:1px solid var(--border)">'
      +'<button onclick="setNotifView(false)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:'+(viewAll?'transparent':'var(--brand,#6366f1)')+';color:'+(viewAll?'var(--text-secondary)':'#fff')+'">من</button>'
      +'<button onclick="setNotifView(true)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:'+(viewAll?'var(--brand,#6366f1)':'transparent')+';color:'+(viewAll?'#fff':'var(--text-secondary)')+'">همه</button>'
      +'</span>';
  }
  var head='<div class="notif-panel-head"><span>🔔 '+(viewAll?'همه اعلان‌ها':'اعلان‌های من')+'</span>'
    +'<span style="display:inline-flex;gap:6px;align-items:center">'
    +_tglBtn
    +(unreadIds.length?'<button onclick="markAllNotifsRead()" style="font-size:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">همه خوانده شد</button>':'')
    +'</span>'
    +'</div>';
  var body='';
  if(!myNotifs.length){
    body='<div class="notif-empty">اعلانی وجود ندارد</div>';
  } else {
    body=myNotifs.map(function(n){
      var timeAgo=_timeAgo(n.at);
      var nid=n.id;
      var hasCk=n.centerKey&&n.centerKey.indexOf('_')>0;
      var hasMultiCk=n.centerKeys&&n.centerKeys.length>1;
      var ckParts=hasCk?n.centerKey.split('_'):[];
      var ckRtype=ckParts[0]||'';var ckRid=ckParts.slice(1).join('_');
      var cName=hasCk?_clGetName(n.centerKey):'';
      return '<div class="notif-item'+(n.read?'':' unread')+(n.ack?' notif-acked':'')+'" data-nid="'+nid+'">'
        +'<div class="notif-item-msg">'+esc(n.message)+'</div>'
        +((hasCk||hasMultiCk)?'<div class="notif-item-center">📍 <span class="notif-center-link" onclick="goToNotifCenter(\''+nid+'\')">'+( hasMultiCk?(n.centerKeys.length+' مرکز'):esc(cName))+'</span></div>':'')
        +'<div class="notif-item-actions">'
        +((hasCk||hasMultiCk)?'<button class="notif-act-btn" onclick="goToNotifCenter(\''+nid+'\')">🔍 '+(hasMultiCk?'مشاهده مراکز':'مشاهده مرکز')+'</button>':'')
        +(viewAll
          ?(n.ack?'<span class="notif-ack-badge">✓ تأیید شده</span>':'')
          :(n.ack
            ?'<span class="notif-ack-badge">✓ تأیید شده</span>'
            :'<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\''+nid+'\')">✓ انجام دادم</button>'))
        +'</div>'
        +'<div class="notif-item-time">'+(viewAll?'به: <b>'+esc(USERS[n.to]||n.to)+'</b> · ':'')+'از: '+(USERS[n.from]||n.from)+' · '+timeAgo+(viewAll&&!n.read?' · <span style="color:#f59e0b">خوانده نشده</span>':'')+'</div>'
        +'</div>';
    }).join('');
  }
  panel.innerHTML=head+'<div class="notif-body-scroll">'+body+'</div>';
  document.body.appendChild(panel);
  setTimeout(function(){
    if(viewAll)return; // در نمای «همه»، اعلان‌های دیگران خوانده نمی‌شود
    unreadIds.forEach(function(id){
      var nx=DB.notifications.find(function(x){return x.id===id;});
      if(nx)nx.read=true;
    });
    saveDB();updateNotifBadge();
    var p=document.getElementById('notifPanel');
    if(p)p.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});
  },2000);
  setTimeout(function(){
    document.addEventListener('click',function _nClose(ev){
      var p=document.getElementById('notifPanel');
      var bell=document.getElementById('notifBell');
      if(p&&!p.contains(ev.target)&&ev.target!==bell&&!bell.contains(ev.target)){p.remove();_notifPanelOpen=false;}
      document.removeEventListener('click',_nClose);
    });
  },100);
}

function goToNotifCenter(nid){
  _initNotif();
  var n=DB.notifications.find(function(x){return x.id===nid;});
  if(!n||(!(n.centerKey&&n.centerKey.indexOf('_')>0)&&!(n.centerKeys&&n.centerKeys.length)))return;
  markNotifRead(nid);
  var p=document.getElementById('notifPanel');if(p)p.remove();_notifPanelOpen=false;
  var keys=n.centerKeys&&n.centerKeys.length?n.centerKeys:[n.centerKey];
  if(keys.length===1){
    var parts=keys[0].split('_');var rtype=parts[0];var rid=parts.slice(1).join('_');
    if(currentTab!=='provinces'&&currentTab!=='weekplan')switchTab('provinces');
    setTimeout(function(){openCenterModal(rtype,rid);},150);
    return;
  }
  // multiple centers: show list modal
  var listHtml='<div style="display:flex;flex-direction:column;gap:6px;padding:4px 0">';
  keys.forEach(function(ck){
    var cname=_clGetName(ck);
    var cparts=ck.split('_');var crt=cparts[0];var crid=cparts.slice(1).join('_');
    listHtml+='<button onclick="closeModal(\'notifCkList\');if(currentTab!==\'provinces\'&&currentTab!==\'weekplan\')switchTab(\'provinces\');setTimeout(function(){openCenterModal(\''+crt+'\',\''+crid+'\');},150)" style="text-align:right;padding:8px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer">'+esc(cname)+'</button>';
  });
  listHtml+='</div>';
  openModal('notifCkList','📍 مراکز مرتبط با این اعلان',listHtml,'<button class="btn-secondary" onclick="closeModal(\'notifCkList\')">بستن</button>');
}

function ackNotif(nid){
  _initNotif();
  var n=DB.notifications.find(function(x){return x.id===nid;});
  if(!n||n.ack)return;
  n.read=true;n.ack=true;n.ackAt=new Date().toISOString();
  if(n.from&&n.from!==currentUser){
    var cName=n.centerKey?_clGetName(n.centerKey):'';
    var msg=(USERS[currentUser]||currentUser)+' تأیید کرد: '+(cName?'"'+cName+'" ':'')+'انجام شد ✓';
    sendNotif(n.from,msg,n.centerKey||'');
  }
  saveDB();updateNotifBadge();
  var p=document.getElementById('notifPanel');
  if(p){
    var el=p.querySelector('[data-nid="'+nid+'"]');
    if(el){
      el.classList.remove('unread');el.classList.add('notif-acked');
      var btn=el.querySelector('.notif-ack-btn');
      if(btn)btn.outerHTML='<span class="notif-ack-badge">✓ تأیید شده</span>';
    }
  }
  showToast('✅ تأیید ثبت و به مدیر اطلاع داده شد',2000);
}

function markNotifRead(nid){
  _initNotif();
  var nx=DB.notifications.find(function(x){return x.id===nid;});
  if(nx){nx.read=true;saveDB();updateNotifBadge();}
}
function markAllNotifsRead(){
  _initNotif();
  DB.notifications.forEach(function(n){if(n.to===currentUser)n.read=true;});
  saveDB();updateNotifBadge();
  var p=document.getElementById('notifPanel');
  if(p){var btn=p.querySelector('.notif-panel-head button');if(btn)btn.remove();p.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});}
}
function _timeAgo(isoStr){
  var diff=Math.floor((Date.now()-new Date(isoStr).getTime())/1000);
  if(diff<60)return'لحظاتی پیش';
  if(diff<3600)return Math.floor(diff/60)+' دقیقه پیش';
  if(diff<86400)return Math.floor(diff/3600)+' ساعت پیش';
  return Math.floor(diff/86400)+' روز پیش';
}


/* ═══ public/js/activity.js ═══ */
// ════════════════════════ DAILY ACTIVITY MONITOR ════════════════════
function openDailyMonitor(){
  if(!_isManager()){showToast('⚠ این بخش فقط برای مدیران است');return;}
  _buildPCCache();
  var today=todayStr();
  var todayEntries=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.rtype==='mtr')return;
    if(we.scheduledDate!==today)return;
    var rtype=we.rtype||'center',rid=we.rid||'';
    var e=getE(rtype,rid);
    var owner=_wpGetOwner(we);
    var name=we.centerName||getRecLabel(rtype+'_'+rid)||'?';
    var acts=_getTodayActivities(rtype,rid,today);
    var isDone=we.done||acts.length>0;
    todayEntries.push({key:k,rtype:rtype,rid:rid,name:name,owner:owner,actType:we.actionType||'call',status:e.status||'بدون تماس',activities:acts,done:isDone});
  });

  // Collect overdue entries (past date, no activity)
  var overdueByOwner={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done||we.rtype==='mtr')return;
    if(!we.scheduledDate||we.scheduledDate>=today)return;
    var owner=_wpGetOwner(we);
    if(!owner)return;
    var acts=_getActivitiesOnDate(we.rtype||'center',we.rid||'',we.scheduledDate);
    if(acts.length>0)return;
    if(!overdueByOwner[owner])overdueByOwner[owner]=[];
    overdueByOwner[owner].push({name:we.centerName||getRecLabel((we.rtype||'center')+'_'+(we.rid||'')),date:we.scheduledDate});
  });

  var byOwner={};
  todayEntries.forEach(function(en){
    var o=en.owner||'__none__';
    if(!byOwner[o])byOwner[o]=[];
    byOwner[o].push(en);
  });

  var totalScheduled=todayEntries.length;
  var totalDone=todayEntries.filter(function(en){return en.done;}).length;
  var totalNotDone=totalScheduled-totalDone;
  var pct=totalScheduled>0?Math.round((totalDone/totalScheduled)*100):0;

  var body='<div style="background:var(--bg-raised);border-radius:10px;padding:14px;margin-bottom:16px">'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:10px">📊 خلاصه امروز — '+today+'</div>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">'+totalScheduled+'</div><div style="font-size:11px;color:#166534">برنامه‌ریزی امروز</div></div>'
    +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">'+totalDone+'</div><div style="font-size:11px;color:#166534">انجام شده ✔</div></div>'
    +'<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#dc2626">'+totalNotDone+'</div><div style="font-size:11px;color:#991b1b">انجام نشده ✖</div></div>'
    +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#1d4ed8">'+pct+'%</div><div style="font-size:11px;color:#1e40af">درصد انجام</div></div>'
    +'</div>'
    +'<div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden">'
    +'<div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:'+pct+'%;transition:width .4s"></div>'
    +'</div>'
    +'</div>';

  if(totalScheduled>0){
    // Per-expert breakdown table
    body+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:16px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">👥 عملکرد کارشناسان</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:8px 10px;text-align:right">کارشناس</th>'
      +'<th style="padding:8px 10px;text-align:center">برنامه امروز</th>'
      +'<th style="padding:8px 10px;text-align:center;color:#16a34a">انجام شده</th>'
      +'<th style="padding:8px 10px;text-align:center;color:#dc2626">انجام نشده</th>'
      +'<th style="padding:8px 10px;text-align:center;color:#f59e0b">سررسید گذشته</th>'
      +'<th style="padding:8px 10px;text-align:center">اقدام</th>'
      +'</tr></thead><tbody>';
    Object.keys(byOwner).sort().forEach(function(ow,idx){
      var entries=byOwner[ow];
      var owName=ow==='__none__'?'بدون مسئول':(USERS[ow]||ow);
      var owDone=entries.filter(function(en){return en.done;}).length;
      var owNotDone=entries.length-owDone;
      var owOverdue=(overdueByOwner[ow]||[]).length;
      var owColor=(window.umGetColor?umGetColor(ow):'#94a3b8');
      var bg=idx%2===0?'var(--bg-card)':'var(--bg-raised)';
      body+='<tr style="background:'+bg+';border-bottom:1px solid #f1f5f9">'
        +'<td style="padding:8px 10px;font-weight:600"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+owColor+'"></span>'+esc(owName)+'</span></td>'
        +'<td style="padding:8px 10px;text-align:center">'
      +'<button onclick="event.stopPropagation();openExpertReport(\''+ow+'\')" style="font-size:10px;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-family:inherit">📊 گزارش</button>'
      +'</td>'
      +'<td style="text-align:center;padding:8px">'+entries.length+'</td>'
        +'<td style="text-align:center;padding:8px"><span style="background:#dcfce7;color:#166534;border-radius:10px;padding:2px 8px;font-weight:700">'+owDone+'</span></td>'
        +'<td style="text-align:center;padding:8px"><span style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:2px 8px;font-weight:700">'+owNotDone+'</span></td>'
        +'<td style="text-align:center;padding:8px"><span style="background:#fef3c7;color:#92400e;border-radius:10px;padding:2px 8px;font-weight:700">'+owOverdue+'</span></td>'
        +'<td style="text-align:center;padding:8px">'
        +(ow!=='__none__'&&owNotDone>0?'<button onclick="sendReminderToExpert(\''+ow+'\')" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:10px;font-family:inherit">📩 یادآوری</button>':'<span style="color:var(--text-muted);font-size:11px">✔ کامل</span>')
        +'</td>'
        +'</tr>';
    });
    body+='</tbody></table></div></div>';

    // Collapsible per-expert detail sections
    body+='<div style="font-weight:700;font-size:13px;margin-bottom:8px">📍 جزئیات مراکز</div>';
    Object.keys(byOwner).sort().forEach(function(ow){
      var entries=byOwner[ow];
      var owName=ow==='__none__'?'بدون مسئول':(USERS[ow]||ow);
      var owColor=(window.umGetColor?umGetColor(ow):'#94a3b8');
      var sectionId='dm_sec_'+ow.replace(/[^a-z0-9]/gi,'_');
      body+='<div style="background:var(--bg-card);border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.05);margin-bottom:8px;overflow:hidden">'
        +'<div onclick="var el=document.getElementById(\''+sectionId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" '
        +'style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">'
        +'<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+owColor+'"></span>'
        +'<span style="font-weight:700;font-size:13px">'+esc(owName)+'</span>'
        +'<span style="font-size:11px;color:var(--text-muted);margin-right:auto">'+entries.length+' مرکز — کلیک برای باز/بسته</span>'
        +'</div>'
        +'<div id="'+sectionId+'" style="display:none;padding:8px">';
      entries.forEach(function(en){
        var icon=en.done?'✅':'🔴';
        var actTypeLabel=en.actType==='visit'?'🤝 ویزیت':'📞 تماس';
        body+='<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--border);font-size:12px">'
          +'<span style="font-size:16px">'+icon+'</span>'
          +'<span style="flex:1">'+esc(en.name)+'</span>'
          +'<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:8px;border:1px solid #7dd3fc">'+actTypeLabel+'</span>'
          +'<span style="font-size:10px;color:var(--text-muted)">'+esc(en.status)+'</span>'
          +'</div>';
      });
      body+='</div></div>';
    });
  } else {
    body+='<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">📋</div><div>هیچ مرکزی برای امروز برنامه‌ریزی نشده</div></div>';
  }

  var foot='<button class="btn-secondary" onclick="closeModal(\'dmModal\')">بستن</button>'
    +'<button class="btn-secondary" onclick="sendReminderToAll()" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">📩 یادآوری به همه</button>'
    +'<button class="btn-primary" onclick="openDailyMonitor()">🔄 بروزرسانی</button>';
  openModal('dmModal','📊 گزارش فعالیت روزانه — '+today,body,foot,{xl:true});
}

function sendReminderToAll(){
  var today=todayStr();
  _buildPCCache();
  var experts={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done||we.scheduledDate!==today||we.rtype==='mtr')return;
    var rtype=we.rtype||'center',rid=we.rid||'';
    var owner=_wpGetOwner(we);
    if(!owner)return;
    var acts=_getTodayActivities(rtype,rid,today);
    if(acts.length>0)return;
    if(!experts[owner])experts[owner]=[];
    experts[owner].push(we.centerName||getRecLabel(rtype+'_'+rid)||'?');
  });
  var cnt=0;
  Object.keys(experts).forEach(function(exp){
    var names=experts[exp];
    if(!names.length)return;
    cnt++;
    var msg='📋 برنامه امروز: '+names.length+' مرکز برای بازدید دارید:\n• '
      +names.slice(0,5).join('\n• ')
      +(names.length>5?'\nو '+(names.length-5)+' مورد دیگر':'')
      +'\nوارد برنامه هفته شوید.';
    sendNotif(exp,msg,'');
  });
  if(cnt>0)showToast('🔔 یادآوری برای '+cnt+' کارشناس ارسال شد',3000);
  else showToast('✅ همه کارشناسان گزارش داده‌اند');
}

function _getTodayActivities(rtype,rid,today){
  var rkey=rtype+'_'+rid;
  var log=DB.changeLog||[];
  return log.filter(function(l){
    if(l.rkey!==rkey)return false;
    if(!l.at)return false;
    var d=l.at.slice(0,10);
    var parts=d.split('-').map(Number);
    if(parts.length!==3)return false;
    var jd=g2j(parts[0],parts[1],parts[2]);
    var jdStr=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
    return jdStr===today;
  });
}

function _fieldLabel(field){
  var map={status:'وضعیت',lead:'سرنخ',potential:'فرصت',followupDate:'تاریخ پیگیری',owner:'مسئول',tags:'برچسب',notes:'یادداشت',contacts:'تماس'};
  return map[field]||field;
}

function sendReminderToExpert(expertUser){
  var today=todayStr();
  var noActEntries=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done||we.scheduledDate!==today||we.rtype==='mtr')return;
    var rtype=we.rtype||'center',rid=we.rid||'';
    var e=getE(rtype,rid);
    var owner=e.owner||'';
    if(!owner){
      if(rtype==='center'){var c=CENTERS.find(function(x){return x.id===rid;});if(c&&c.owner)owner=c.owner;}
      else{_buildPCCache();var _pId=rid.split('||')[0];var _arr=_PC_CACHE[_pId]||[];var _c=_arr.find(function(x){return x.id===rid;});if(_c&&_c.owner)owner=_c.owner;}
    }
    if(owner!==expertUser)return;
    var acts=_getTodayActivities(rtype,rid,today);
    if(acts.length===0)noActEntries.push(we.centerName||getRecLabel(rtype+'_'+rid)||'?');
  });
  if(!noActEntries.length){showToast('✅ این کارشناس برای همه مراکز گزارش داده است');return;}
  var msg='لطفاً برای مراکز زیر که امروز برنامه دارید گزارش وارد کنید: '+noActEntries.slice(0,5).join('، ')+(noActEntries.length>5?' و '+(noActEntries.length-5)+' مرکز دیگر':'');
  sendNotif(expertUser,msg,'');
}


// ════════════════════════ CHANGE LOG PAGE ════════════════════
var _clFilters = {date:'today', owner:'', search:'', field:''};
var _clAutoRefreshTimer = null;

function renderChangelog(){
  var el = document.getElementById('changelogPanel');
  if(!el) return;
  if(!_isManager()){
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">این بخش فقط برای مدیران است</div>';
    return;
  }
  var today = todayStr();
  var log = (DB.changeLog||[]).slice().reverse(); // newest first

  // اعمال فیلترها
  var filtered = log.filter(function(l){
    if(!l.at || !l.rkey) return false;
    // فیلتر تاریخ
    var dp = l.at.slice(0,10).split('-').map(Number);
    if(dp.length !== 3) return false;
    var jd = g2j(dp[0],dp[1],dp[2]);
    var jdStr = jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
    if(_clFilters.date === 'today' && jdStr !== today) return false;
    if(_clFilters.date === 'week'){
      var jdMs = jMs(jd[0],jd[1],jd[2]);
      var todayParts = today.split('/').map(Number);
      var weekStart = jMs(todayParts[0],todayParts[1],todayParts[2]) - 6*86400*1000;
      if(jdMs < weekStart) return false;
    }
    if(_clFilters.date === 'month'){
      var todayP = today.split('/').map(Number);
      if(jd[0] !== todayP[0] || jd[1] !== todayP[1]) return false;
    }
    // فیلتر کارشناس
    if(_clFilters.owner && l.by !== _clFilters.owner) return false;
    // فیلتر فیلد
    if(_clFilters.field && l.field !== _clFilters.field) return false;
    // فیلتر جستجو مرکز
    if(_clFilters.search){
      var cName = _clGetName(l.rkey);
      if(fNorm(cName).indexOf(fNorm(_clFilters.search)) < 0) return false;
    }
    return true;
  });

  // آمار
  var uniqueCenters = {};
  var uniqueExperts = {};
  filtered.forEach(function(l){ uniqueCenters[l.rkey]=true; if(l.by)uniqueExperts[l.by]=true; });
  var cCount = Object.keys(uniqueCenters).length;
  var eCount = Object.keys(uniqueExperts).length;

  // ساخت HTML
  var html = '<div class="cl-wrap">'
    + '<div class="cl-head">'
    + '<strong style="font-size:14px;white-space:nowrap">🗃 لاگ تغییرات</strong>'
    + '<div class="cl-filters">'
    + '<select class="cl-filter" onchange="_clFilters.date=this.value;renderChangelog()">'
    + '<option value="today"'+(  _clFilters.date==='today'?' selected':'')+'>امروز</option>'
    + '<option value="week"'+(_clFilters.date==='week'?' selected':'')+'>۷ روز اخیر</option>'
    + '<option value="month"'+(_clFilters.date==='month'?' selected':'')+'>این ماه</option>'
    + '<option value="all"'+(_clFilters.date==='all'?' selected':'')+'>همه</option>'
    + '</select>'
    + '<select class="cl-filter" onchange="_clFilters.owner=this.value;renderChangelog()">'
    + '<option value="">همه کارشناسان</option>'
    + Object.keys(USERS).filter(function(u){return u!=='guest';}).map(function(u){
        return '<option value="'+u+'"'+(_clFilters.owner===u?' selected':'')+'>'+esc(USERS[u])+'</option>';
      }).join('')
    + '</select>'
    + '<select class="cl-filter" onchange="_clFilters.field=this.value;renderChangelog()">'
    + '<option value="">همه فیلدها</option>'
    + ['status','lead','potential','followupDate','owner','contacts'].map(function(f){
        return '<option value="'+f+'"'+(_clFilters.field===f?' selected':'')+'>'+_fieldLabel(f)+'</option>';
      }).join('')
    + '</select>'
    + '<input type="text" class="cl-filter" placeholder="جستجو مرکز..." value="'+esc(_clFilters.search||'')+'" oninput="_clFilters.search=this.value;renderChangelog()" style="min-width:130px">'
    + '</div>'
    + '<button onclick="renderChangelog()" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit" title="بروزرسانی">🔄</button>'
    + '</div>'
    // stats bar
    + '<div class="cl-stats">'
    + '<div class="cl-stat"><div class="cl-stat-n">'+filtered.length+'</div><div class="cl-stat-l">تغییر</div></div>'
    + '<div class="cl-stat"><div class="cl-stat-n">'+cCount+'</div><div class="cl-stat-l">مرکز</div></div>'
    + '<div class="cl-stat"><div class="cl-stat-n">'+eCount+'</div><div class="cl-stat-l">کارشناس</div></div>'
    + '</div>';

  if(!filtered.length){
    html += '<div class="cl-empty"><div style="font-size:32px;margin-bottom:10px">📋</div>تغییری در این بازه ثبت نشده</div>';
  } else {
    html += '<div style="overflow-x:auto"><table class="cl-table"><thead><tr>'
      + '<th>زمان</th><th>مرکز</th><th>کارشناس</th><th>فیلد</th><th>مقدار جدید</th>'
      + '</tr></thead><tbody>'
      + filtered.slice(0,300).map(function(l){
          var cName = _clGetName(l.rkey);
          var dp = l.at.slice(0,10).split('-').map(Number);
          var jd = g2j(dp[0],dp[1],dp[2]);
          var jdStr = jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
          var timeStr = l.at.slice(11,16);
          var rparts = l.rkey.split('_');
          var rtype = rparts[0]; var rid = rparts.slice(1).join('_');
          var fieldBadge = _clFieldBadge(l.field);
          var valDisplay = _clValDisplay(l.field, l.val);
          return '<tr><td style="white-space:nowrap;color:var(--text-muted);font-size:11px">'+jdStr+'<br><span style="font-size:10px">'+timeStr+'</span></td>'
            + '<td><span class="cl-center-link" onclick="openCenterModal(\''+rtype+'\',\''+rid+'\')">'+esc(cName)+'</span></td>'
            + '<td style="font-size:11px">'+esc(USERS[l.by]||l.by||'—')+'</td>'
            + '<td>'+fieldBadge+'</td>'
            + '<td class="cl-val" title="'+esc(String(l.val||''))+'">'+valDisplay+'</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
    if(filtered.length > 300){
      html += '<div style="padding:10px 16px;text-align:center;font-size:12px;color:var(--text-muted)">نمایش ۳۰۰ مورد از '+filtered.length+' — فیلتر را محدودتر کنید</div>';
    }
  }
  html += '</div>';
  el.innerHTML = html;

  // auto-refresh every 30s
  clearTimeout(_clAutoRefreshTimer);
  if(currentTab === 'changelog'){
    _clAutoRefreshTimer = setTimeout(function(){if(currentTab==='changelog')renderChangelog();}, 30000);
  }
}


/* ═══ public/js/tasks.js ═══ */
// ════════════════════════ TASK MANAGEMENT ════════════════════════
// ════════════════════════ TASK MANAGEMENT (Monday-style) ════════════════════════
var _taskFilter='all'; // all | mine | overdue
var _taskView='kanban'; // kanban | list
var _taskSearch=''; // keyword filter
var _TK_STATUSES=[
  {id:'todo',label:'انجام نشده',color:'#64748b'},
  {id:'doing',label:'در حال انجام',color:'#6366f1'},
  {id:'waiting',label:'در انتظار',color:'#f59e0b'},
  {id:'done',label:'انجام شد',color:'#22c55e'}
];

function _getTkStatuses(){
  if(!DB.settings)DB.settings={};
  var custom=DB.settings.taskColumns&&DB.settings.taskColumns[currentUser];
  if(custom&&custom.length)return custom;
  return _TK_STATUSES;
}

function openTkColumnsModal(){
  if(!DB.settings)DB.settings={};
  if(!DB.settings.taskColumns)DB.settings.taskColumns={};
  var cols=JSON.parse(JSON.stringify(DB.settings.taskColumns[currentUser]||_TK_STATUSES));
  var inpS='width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';
  var renderRows=function(){
    return window._tkColsPending.map(function(c,i){
      return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
        +'<input type="color" value="'+(c.color||'#64748b')+'" onchange="_tkColsEdit('+i+',\'color\',this.value)" style="width:32px;height:28px;border:none;background:none;cursor:pointer;padding:0">'
        +'<input type="text" value="'+esc(c.label||'')+'" onchange="_tkColsEdit('+i+',\'label\',this.value)" placeholder="عنوان ستون..." style="'+inpS+';flex:1">'
        +'<input type="number" min="1" max="99" value="'+(c.wip||'')+'" oninput="_tkColsEdit('+i+',\'wip\',this.value?parseInt(this.value):null)" placeholder="WIP" title="حداکثر کارت" style="width:52px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:11px;font-family:inherit;text-align:center">'
        +(i>0&&i<window._tkColsPending.length-1?'<button onclick="_tkColsRemove('+i+')" style="padding:4px 8px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;font-size:11px">حذف</button>':'<span style="width:54px"></span>')
        +'</div>';
    }).join('');
  };
  window._tkColsPending = cols;
  window._tkColsEdit=function(i,field,val){window._tkColsPending[i][field]=val;document.getElementById('tkColsRows').innerHTML=renderRows();};
  window._tkColsRemove=function(i){window._tkColsPending.splice(i,1);document.getElementById('tkColsRows').innerHTML=renderRows();};
  window._tkColsAdd=function(){
    window._tkColsPending.splice(window._tkColsPending.length-1,0,{id:'custom_'+Date.now(),label:'ستون جدید',color:'#8b5cf6'});
    document.getElementById('tkColsRows').innerHTML=renderRows();
  };
  var body='<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">ستون اول و آخر ثابت هستند. ستون‌های میانی قابل حذف هستند.</div>'
    +'<div id="tkColsRows">'+renderRows()+'</div>'
    +'<button onclick="_tkColsAdd()" style="margin-top:8px;padding:5px 14px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">+ افزودن ستون</button>';
  var footer='<button class="btn-primary" onclick="'
    +'if(!DB.settings.taskColumns)DB.settings.taskColumns={};'
    +'DB.settings.taskColumns[currentUser]=JSON.parse(JSON.stringify(window._tkColsPending));'
    +"saveDB();closeModal('tkColsMgr');showToast('ستون\u200cها ذخیره شد \u2705');renderTasksPanel();"
    +'">ذخیره</button>'
    +'<button onclick="if(confirm(\'\u0628ازگشت به پیشفرض?\')){'+'delete DB.settings.taskColumns[currentUser];saveDB();closeModal(\'tkColsMgr\');showToast(\'\u0628ازگشت شد\');renderTasksPanel();}" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit">بازگشت پیشفرض</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'tkColsMgr\')">بستن</button>';
  openModal('tkColsMgr','⚙️ مدیریت ستون‌های وظایف',body,footer,{lg:false});
}

function _ensureTasks(){
  if(!DB.tasks)DB.tasks=[];
  // migrate: add status + subtasks to old tasks
  DB.tasks.forEach(function(t){
    if(!t.status)t.status=t.done?'done':'todo';
    if(!t.subtasks)t.subtasks=[];
    if(!t.activity)t.activity=[];
    if(!t.recurring)t.recurring='none';
  });
  // auto-regenerate recurring tasks that are done and have no pending next instance
  var _today=todayStr();
  var _toAdd=[];
  DB.tasks.filter(function(t){return t.recurring&&t.recurring!=='none'&&!t.recurringParentId&&t.done;}).forEach(function(t){
    var hasNext=DB.tasks.some(function(x){return x.recurringParentId===String(t.id)&&!x.done;});
    if(hasNext)return;
    var dp=(t.dueDate||_today).split('/').map(Number);
    var g=j2g(dp[0],dp[1],dp[2]);
    var days=t.recurring==='weekly'?7:30;
    var nd=new Date(g[0],g[1]-1,g[2]+days);
    var nj=g2j(nd.getFullYear(),nd.getMonth()+1,nd.getDate());
    var newDate=nj[0]+'/'+p2(nj[1])+'/'+p2(nj[2]);
    if(newDate<=_today)return;
    _toAdd.push({id:Date.now()+'_r'+Math.random().toString(36).slice(2,5),title:t.title,owner:t.owner,
      dueDate:newDate,priority:t.priority||2,status:'todo',done:false,doneAt:'',
      note:t.note||'',subtasks:[],activity:[{type:'created',text:'وظیفه تکرارشونده ایجاد شد',by:'system',at:new Date().toISOString()}],
      recurring:t.recurring,recurringParentId:String(t.id),centerKey:t.centerKey||'',createdBy:'system',createdAt:new Date().toISOString()});
  });
  if(_toAdd.length){_toAdd.forEach(function(t){DB.tasks.push(t);});saveDB();}
}

function _tkCountSubs(subs){
  var total=0,done=0;
  (subs||[]).forEach(function(s){
    if(s.subtasks&&s.subtasks.length){
      var r=_tkCountSubs(s.subtasks);
      total+=r.total;done+=r.done;
    } else {
      total++;if(s.done)done++;
    }
  });
  return {total:total,done:done};
}

function _tkFindTask(tid){
  _ensureTasks();
  return DB.tasks.find(function(x){return String(x.id)===String(tid);});
}

function _tkFindSub(subs,sid){
  for(var i=0;i<(subs||[]).length;i++){
    if(String(subs[i].id)===String(sid))return subs[i];
    var f=_tkFindSub(subs[i].subtasks,sid);
    if(f)return f;
  }
  return null;
}

function _tkFilteredTasks(){
  _ensureTasks();
  var today=todayStr();
  var tasks=DB.tasks.filter(function(t){
    if(_taskFilter==='mine')return t.owner===currentUser;
    if(_taskFilter==='overdue')return t.status!=='done'&&t.dueDate&&t.dueDate<today;
    return true;
  });
  if(_taskSearch&&_taskSearch.trim()){
    var _q=fNorm(_taskSearch.trim());
    tasks=tasks.filter(function(t){
      return fNorm(t.title||'').indexOf(_q)>=0||fNorm(t.note||'').indexOf(_q)>=0;
    });
  }
  return tasks;
}

function renderTasksPanel(){
  var el=document.getElementById('tasksPanel');if(!el)return;
  _ensureTasks();
  var tasks=_tkFilteredTasks();

  var html='<div class="task-wrap">';
  // toolbar
  html+='<div class="task-filters">'
    +'<span style="display:inline-flex;gap:2px;background:var(--bg-raised);border-radius:8px;padding:3px;border:1px solid var(--border)">'
    +'<button onclick="_taskView=\'kanban\';renderTasksPanel()" style="font-size:11px;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-family:inherit;background:'+(_taskView==='kanban'?'var(--brand,#6366f1)':'transparent')+';color:'+(_taskView==='kanban'?'#fff':'var(--text-secondary)')+'">▦ کانبان</button>'
    +'<button onclick="_taskView=\'list\';renderTasksPanel()" style="font-size:11px;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-family:inherit;background:'+(_taskView==='list'?'var(--brand,#6366f1)':'transparent')+';color:'+(_taskView==='list'?'#fff':'var(--text-secondary)')+'">☰ لیست</button>'
    +'</span>'
    +'<input type="text" id="tkSearch" value="'+esc(_taskSearch)+'" oninput="_taskSearch=this.value;renderTasksPanel()"'
    +' placeholder="🔍 جستجو..." style="padding:5px 10px;border:1px solid var(--border);border-radius:16px;font-size:11px;background:var(--bg-raised);color:var(--text-primary);font-family:inherit;width:140px">'
    +[['all','همه'],['mine','وظایف من'],['overdue','سررسید گذشته']].map(function(f){
      return'<button class="task-filter-btn'+(_taskFilter===f[0]?' active':'')+'" onclick="_taskFilter=\''+f[0]+'\';renderTasksPanel()">'+f[1]+'</button>';
    }).join('')
    +'<button class="btn-primary" style="margin-right:auto;font-size:12px;padding:6px 16px" onclick="openTaskModal()">+ وظیفه جدید</button>'
    +'<button onclick="openTkColumnsModal()" style="font-size:11px;padding:5px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-family:inherit;color:var(--text-secondary)">⚙️ ستون‌ها</button>'
    +'</div>';

  if(_taskView==='kanban'){
    html+='<div class="tk-board">';
    _getTkStatuses().forEach(function(st){
      var colTasks=tasks.filter(function(t){return (t.status||'todo')===st.id;});
      colTasks.sort(function(a,b){var pa=a.priority||2,pb=b.priority||2;if(pa!==pb)return pa-pb;return (a.dueDate||'9999')<(b.dueDate||'9999')?-1:1;});
      html+='<div class="tk-col" data-status="'+st.id+'" ondragover="event.preventDefault();this.classList.add(\'tk-drop-over\')" ondragleave="this.classList.remove(\'tk-drop-over\')" ondrop="tkDrop(event,\''+st.id+'\')">'
        +'<div class="tk-col-head" style="border-top:3px solid '+(st.wip&&colTasks.length>st.wip?'#dc2626':st.color)+'" draggable="true"'
        +' ondragstart="tkColDragStart(event,\''+st.id+'\')"'
        +' ondragover="event.preventDefault();this.closest(\'.tk-col\').classList.add(\'tk-drop-over\')"'
        +' ondragleave="this.closest(\'.tk-col\').classList.remove(\'tk-drop-over\')"'
        +' ondrop="tkColDrop(event,\''+st.id+'\')" title="بکش برای تغییر ترتیب ستون">'
        +'<span style="display:flex;align-items:center;gap:5px;color:'+st.color+'">'+'⠿'+'<span>'+st.label+'</span></span>'
        +'<span class="tk-col-cnt" style="'+(st.wip&&colTasks.length>st.wip?'background:#fee2e2;color:#dc2626;border-color:#fca5a5':'')+'">'+(st.wip?(colTasks.length+'/'+st.wip):colTasks.length)+'</span>'
        +'</div>'
        +'<div class="tk-col-body">'
        +(colTasks.length?colTasks.map(function(t){return _tkRenderCard(t,st);}).join(''):'<div class="tk-col-empty">—</div>')
        +'</div></div>';
    });
    html+='</div>';
  } else {
    // list view
    var sorted=tasks.slice().sort(function(a,b){
      var sa=_getTkStatuses().findIndex(function(s){return s.id===(a.status||'todo');});
      var sb=_getTkStatuses().findIndex(function(s){return s.id===(b.status||'todo');});
      if(sa!==sb)return sa-sb;
      var pa=a.priority||2,pb=b.priority||2;if(pa!==pb)return pa-pb;
      return (a.dueDate||'9999')<(b.dueDate||'9999')?-1:1;
    });
    if(!sorted.length){
      var _emptyMsg='هیچ وظیفه‌ای یافت نشد';
      if(_taskFilter==='mine')_emptyMsg='هیچ وظیفه‌ای برای شما یافت نشد';
      else if(_taskFilter==='overdue')_emptyMsg='هیچ وظیفه معوقی وجود ندارد 🎉';
      if(_taskSearch)_emptyMsg+=' — جستجو: «'+_taskSearch+'»';
      html+='<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">'+ _emptyMsg +'</div>';
    } else {
      sorted.forEach(function(t){
        var st=_getTkStatuses().find(function(s){return s.id===(t.status||'todo');})||_getTkStatuses()[0];
        html+=_tkRenderCard(t,st,true);
      });
    }
  }
  html+='</div>';
  el.innerHTML=html;
}

function _tkRenderCard(t,st,isList){
  var today=todayStr();
  var overdue=t.status!=='done'&&t.dueDate&&t.dueDate<today;
  var owner=USERS[t.owner]||t.owner||'';
  var priLabel=['','بالا','معمولی','پایین'][t.priority||2]||'معمولی';
  var priCls=['','task-pri-1','task-pri-2','task-pri-3'][t.priority||2]||'task-pri-2';
  var subC=_tkCountSubs(t.subtasks);
  var subBadge=subC.total?'<span class="tk-sub-badge'+(subC.done===subC.total?' all-done':'')+'">'+subC.done+'/'+subC.total+' ✓</span>':'';
  var recurBadge=(t.recurring&&t.recurring!=='none')?'<span style="font-size:9px;background:#f0fdf4;color:#16a34a;border:1px solid #86efac;border-radius:6px;padding:1px 5px">🔁 '+(t.recurring==='weekly'?'هفتگی':'ماهانه')+'</span>':'';
  return '<div class="tk-card'+(t.status==='done'?' tk-done':'')+(isList?' tk-card-list':'')+'" draggable="true" '
    +'ondragstart="tkDragStart(event,\''+t.id+'\')" ondragend="tkDragEnd(event)" '
    +'onclick="openTaskModal(\''+t.id+'\')">'
    +'<div style="display:flex;align-items:flex-start;gap:7px">'
    +'<div onclick="event.stopPropagation();tkQuickToggle(\''+t.id+'\')" class="tk-qc'+(t.status==='done'?' tk-qc-done':'')+'" title="'+(t.status==='done'?'بازگشت به انجام‌نشده':'انجام شد')+'"></div>'
    +'<div class="tk-card-title" style="flex:1">'+esc(t.title||'—')+'</div>'
    +'</div>'
    +'<div class="tk-card-meta">'
    +'<span class="task-pri '+priCls+'">'+priLabel+'</span>'
    +(owner?'<span class="tk-owner"><span class="tk-owner-dot" style="background:'+(window.umGetColor?umGetColor(t.owner):'#94a3b8')+'"></span>'+esc(owner)+'</span>':'')
    +(t.dueDate?'<span style="color:'+(overdue?'#ef4444':'var(--text-muted)')+';font-size:10px">📅 '+t.dueDate+'</span>':'')
    +subBadge
    +recurBadge
    +(t.centerKey?'<span class="tk-center-chip" onclick="event.stopPropagation();openCenterModal(\''+t.centerKey.split('_')[0]+'\',\''+t.centerKey.split('_').slice(1).join('_')+'\')">🏥 '+esc(_getTaskCenterName(t.centerKey).substring(0,20))+'</span>':'')
    +'</div>'
    +'</div>';
}

var _tkDragging=null;
function tkDragStart(ev,tid){
  _tkDragging=tid;
  ev.dataTransfer.effectAllowed='move';
  ev.dataTransfer.setData('text/plain',tid);
}
function tkDragEnd(ev){
  _tkDragging=null;
  document.querySelectorAll('.tk-col.tk-drop-over').forEach(function(el){el.classList.remove('tk-drop-over');});
}
function tkDrop(ev,statusId){
  ev.preventDefault();
  document.querySelectorAll('.tk-col.tk-drop-over').forEach(function(el){el.classList.remove('tk-drop-over');});
  var tid=_tkDragging||ev.dataTransfer.getData('text/plain');
  var t=_tkFindTask(tid);
  if(!t)return;
  t.status=statusId;
  t.done=(statusId==='done');
  t.doneAt=t.done?todayStr():'';
  saveDB();
  renderTasksPanel();
}

var _tkColDragging=null;
function tkColDragStart(ev,colId){
  _tkColDragging=colId;
  ev.dataTransfer.effectAllowed='move';
  ev.stopPropagation();
}
function tkColDrop(ev,targetColId){
  ev.preventDefault();ev.stopPropagation();
  document.querySelectorAll('.tk-col.tk-drop-over').forEach(function(el){el.classList.remove('tk-drop-over');});
  if(!_tkColDragging||_tkColDragging===targetColId){_tkColDragging=null;return;}
  var cols=_getTkStatuses().slice();
  var si=cols.findIndex(function(c){return c.id===_tkColDragging;});
  var ti=cols.findIndex(function(c){return c.id===targetColId;});
  if(si<0||ti<0){_tkColDragging=null;return;}
  var moved=cols.splice(si,1)[0];
  cols.splice(ti,0,moved);
  if(!DB.settings)DB.settings={};
  if(!DB.settings.taskColumns)DB.settings.taskColumns={};
  DB.settings.taskColumns[currentUser]=cols;
  saveDB();_tkColDragging=null;renderTasksPanel();
  showToast('↕ ترتیب ستون‌ها ذخیره شد',1500);
}

function tkQuickToggle(tid){
  var t=_tkFindTask(tid);if(!t)return;
  var statuses=_getTkStatuses();
  var doneCol=statuses.find(function(s){return s.id==='done';})||statuses[statuses.length-1];
  if(t.status===doneCol.id){
    t.status=statuses[0].id;t.done=false;t.doneAt='';
    if(!t.activity)t.activity=[];
    t.activity.push({type:'status',text:'بازگشت به «'+statuses[0].label+'»',by:currentUser,at:new Date().toISOString()});
  } else {
    var prev=t.status;
    t.status=doneCol.id;t.done=true;t.doneAt=todayStr();
    if(!t.activity)t.activity=[];
    var prevLabel=(statuses.find(function(s){return s.id===prev;})||{label:prev}).label;
    t.activity.push({type:'status',text:'«'+prevLabel+'» → انجام شد ✓',by:currentUser,at:new Date().toISOString()});
  }
  saveDB();
  renderTasksPanel();
}

// ── Task detail / create modal ──────────────────────────────
function openTaskModal(tid, prefill){
  _ensureTasks();
  var isNew=!tid;
  var t=isNew?{id:'',title:(prefill&&prefill.title)||'',owner:(prefill&&prefill.owner)||currentUser,dueDate:(prefill&&prefill.dueDate)||'',priority:(prefill&&prefill.priority)||2,status:'todo',centerKey:(prefill&&prefill.centerKey)||'',note:'',subtasks:[]}:_tkFindTask(tid);
  if(!t){showToast('وظیفه یافت نشد');return;}
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var mid='taskDetail';
  var inpS='width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';

  var body='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div style="grid-column:1/-1"><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">عنوان</label>'
    +'<input id="tkd_title" type="text" value="'+esc(t.title)+'" placeholder="عنوان وظیفه..." style="'+inpS+'"></div>'
    +'<div><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">وضعیت</label>'
    +'<select id="tkd_status" style="'+inpS+'">'
    +_getTkStatuses().map(function(s){return'<option value="'+s.id+'"'+((t.status||'todo')===s.id?' selected':'')+'>'+s.label+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">اولویت</label>'
    +'<select id="tkd_pri" style="'+inpS+'">'
    +[[1,'بالا'],[2,'معمولی'],[3,'پایین']].map(function(p){return'<option value="'+p[0]+'"'+((t.priority||2)===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">مسئول</label>'
    +'<select id="tkd_owner" style="'+inpS+'"><option value="">—</option>'
    +members.filter(function(m){return m.id!=='guest';}).map(function(m){return'<option value="'+m.id+'"'+(t.owner===m.id?' selected':'')+'>'+esc(m.name)+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">سررسید</label>'
    +'<input id="tkd_due" type="text" value="'+esc(t.dueDate||'')+'" readonly class="fd-inp" style="cursor:pointer;'+inpS+'" onclick="openJDP(this,function(v){document.getElementById(\'tkd_due\').value=v;})"></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">یادداشت</label>'
    +'<textarea id="tkd_note" rows="2" style="'+inpS+';resize:vertical">'+esc(t.note||'')+'</textarea></div>'
    +'<div><label style="font-size:11px;display:block;margin-bottom:3px;font-weight:600">تکرار 🔁</label>'
    +'<select id="tkd_recurring" style="'+inpS+'">'
    +[['none','بدون تکرار'],['weekly','هفتگی'],['monthly','ماهانه']].map(function(r){return'<option value="'+r[0]+'"'+((t.recurring||'none')===r[0]?' selected':'')+'>'+r[1]+'</option>';}).join('')
    +'</select></div>'
    +'<input type="hidden" id="tkd_centerKey" value="'+esc(t.centerKey||'')+'">'
    +'</div>';

  // subtask tree (only for existing tasks)
  if(!isNew){
    body+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<span style="font-size:12px;font-weight:700">زیروظیفه‌ها</span>'
      +'<button onclick="tkAddSub(\''+t.id+'\',\'\')" style="font-size:11px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit">+ زیروظیفه</button>'
      +'</div>'
      +'<div id="tkSubTree">'+_tkRenderSubTree(t.id,t.subtasks,0)+'</div>'
      +'</div>';
    // activity & comments
    var _acts=(t.activity||[]).slice().reverse();
    body+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">'
      +'<div style="font-size:12px;font-weight:700;margin-bottom:8px">💬 فعالیت</div>'
      +'<div style="display:flex;gap:6px;margin-bottom:8px">'
      +'<input type="text" id="tkCommentInp" placeholder="کامنت اضافه کن..." style="flex:1;padding:5px 9px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
      +'<button onclick="tkAddComment(\''+t.id+'\')" style="padding:5px 14px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit">ثبت</button>'
      +'</div>'
      +'<div id="tkActivityLog" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">';
    if(!_acts.length){
      body+='<div style="font-size:11px;color:var(--text-muted);padding:6px 0">فعالیتی ثبت نشده</div>';
    } else {
      _acts.forEach(function(a){
        var ts='';
        if(a.at){var dp=a.at.slice(0,10).split('-').map(Number);var jd=g2j(dp[0],dp[1],dp[2]);ts=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);}
        var ico=a.type==='comment'?'💬':a.type==='created'?'✨':'🔄';
        var byName=USERS[a.by]||a.by||'';
        body+='<div style="display:flex;gap:7px;align-items:flex-start;padding:5px 7px;background:var(--bg-raised);border-radius:6px;font-size:11px">'
          +'<span style="flex-shrink:0">'+ico+'</span>'
          +'<span style="flex:1;color:var(--text-primary)">'+esc(a.text||'')+'</span>'
          +'<span style="color:var(--text-muted);font-size:10px;white-space:nowrap">'+esc(byName)+' '+ts+'</span>'
          +'</div>';
      });
    }
    body+='</div></div>';
  }

  var footer=(isNew
    ?'<button class="btn-primary" onclick="tkSaveTask(\'\')">+ ایجاد وظیفه</button>'
    :'<button class="btn-primary" onclick="tkSaveTask(\''+t.id+'\')">💾 ذخیره</button>'
      +'<button style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="tkDeleteTask(\''+t.id+'\')">🗑 حذف</button>')
    +'<button class="btn-secondary" onclick="closeModal(\''+mid+'\')">بستن</button>';

  openModal(mid,(isNew?'➕ وظیفه جدید':'📌 '+esc(t.title||'وظیفه')),body,footer,{lg:true});
}

function _tkRenderSubTree(tid,subs,depth){
  if(!subs||!subs.length)return depth===0?'<div style="font-size:11px;color:var(--text-muted);padding:6px 0">زیروظیفه‌ای ندارد</div>':'';
  return subs.map(function(s){
    var kids=_tkRenderSubTree(tid,s.subtasks,depth+1);
    return '<div class="tk-sub-node" style="margin-right:'+(depth*18)+'px">'
      +'<div class="tk-sub-row">'
      +'<input type="checkbox" '+(s.done?'checked':'')+' onchange="tkToggleSub(\''+tid+'\',\''+s.id+'\')" style="cursor:pointer;accent-color:var(--brand,#6366f1)">'
      +'<span class="tk-sub-title'+(s.done?' tk-sub-done':'')+'" data-sid="'+s.id+'" onclick="tkEditSubTitle(\''+tid+'\',\''+s.id+'\')" title="کلیک برای ویرایش">'+esc(s.title||'—')+'</span>'
      +(depth<2?'<button onclick="tkAddSub(\''+tid+'\',\''+s.id+'\')" title="افزودن زیروظیفه" class="tk-sub-btn">+</button>':'')
      +'<button onclick="tkDelSub(\''+tid+'\',\''+s.id+'\')" title="حذف" class="tk-sub-btn tk-sub-del">✕</button>'
      +'</div>'
      +kids
      +'</div>';
  }).join('');
}

function tkSaveTask(tid){
  _ensureTasks();
  var title=(document.getElementById('tkd_title')||{}).value||'';
  if(!title.trim()){showToast('عنوان وظیفه را وارد کنید');return;}
  var status=(document.getElementById('tkd_status')||{}).value||'todo';
  var t;
  if(!tid){
    t={id:Date.now()+'_'+Math.random().toString(36).slice(2,6),subtasks:[],createdBy:currentUser,createdAt:new Date().toISOString()};
    DB.tasks.push(t);
  } else {
    t=_tkFindTask(tid);
    if(!t)return;
  }
  var _prevStatus=t.status||'todo';
  t.title=title.trim();
  t.owner=(document.getElementById('tkd_owner')||{}).value||'';
  t.dueDate=(document.getElementById('tkd_due')||{}).value||'';
  t.priority=parseInt((document.getElementById('tkd_pri')||{}).value)||2;
  t.status=status;
  t.done=(status==='done');
  t.doneAt=t.done?(t.doneAt||todayStr()):'';
  t.note=(document.getElementById('tkd_note')||{}).value||'';
  t.recurring=(document.getElementById('tkd_recurring')||{}).value||'none';
  if(!tid) t.centerKey=(document.getElementById('tkd_centerKey')||{}).value||'';
  if(!t.activity)t.activity=[];
  if(tid&&_prevStatus!==status){
    var _statuses=_getTkStatuses();
    var _fromL=(_statuses.find(function(s){return s.id===_prevStatus;})||{label:_prevStatus}).label;
    var _toL=(_statuses.find(function(s){return s.id===status;})||{label:status}).label;
    t.activity.push({type:'status',text:'«'+_fromL+'» → «'+_toL+'»',by:currentUser,at:new Date().toISOString()});
  } else if(!tid){
    t.activity.push({type:'created',text:'وظیفه ایجاد شد',by:currentUser,at:new Date().toISOString()});
  }
  // notify new owner
  if(t.owner&&t.owner!==currentUser&&typeof sendNotif==='function'&&t._notifiedOwner!==t.owner){
    sendNotif(t.owner,'وظیفه «'+t.title+'» به شما واگذار شد',t.centerKey||'');
    t._notifiedOwner=t.owner;
  }
  saveDB();
  closeModal('taskDetail');
  showToast(tid?'💾 ذخیره شد':'✅ وظیفه ایجاد شد');
  renderTasksPanel();
}

function tkDeleteTask(tid){
  _ensureTasks();
  DB.tasks=DB.tasks.filter(function(x){return String(x.id)!==String(tid);});
  saveDB();
  closeModal('taskDetail');
  showToast('🗑 وظیفه حذف شد');
  renderTasksPanel();
}

function tkAddComment(tid){
  var t=_tkFindTask(tid);if(!t)return;
  var inp=document.getElementById('tkCommentInp');if(!inp)return;
  var text=(inp.value||'').trim();
  if(!text){showToast('متن کامنت را وارد کنید');return;}
  if(!t.activity)t.activity=[];
  t.activity.push({type:'comment',text:text,by:currentUser,at:new Date().toISOString()});
  inp.value='';
  saveDB();
  // re-render activity log in place
  var log=document.getElementById('tkActivityLog');
  if(log){
    var entry=document.createElement('div');
    entry.style.cssText='display:flex;gap:7px;align-items:flex-start;padding:5px 7px;background:var(--bg-raised);border-radius:6px;font-size:11px';
    var dp=new Date().toISOString().slice(0,10).split('-').map(Number);
    var jd=g2j(dp[0],dp[1],dp[2]);
    var ts=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
    entry.innerHTML='<span style="flex-shrink:0">💬</span><span style="flex:1;color:var(--text-primary)">'+esc(text)+'</span>'
      +'<span style="color:var(--text-muted);font-size:10px">'+esc(USERS[currentUser]||currentUser)+' '+ts+'</span>';
    log.insertBefore(entry,log.firstChild);
  }
  showToast('💬 کامنت ثبت شد',1500);
}

function tkAddSub(tid,parentSid){
  var t=_tkFindTask(tid);if(!t)return;
  var formId='tkAddSubForm';
  var existing=document.getElementById(formId);
  if(existing){existing.remove();return;}
  var tree=document.getElementById('tkSubTree');
  if(!tree)return;
  var inpId='tkAddSubInp_'+Date.now();
  var div=document.createElement('div');
  div.id=formId;
  div.style.cssText='display:flex;gap:5px;padding:6px 0;animation:fadeIn .15s';
  div.innerHTML='<input id="'+inpId+'" type="text" placeholder="عنوان زیروظیفه..." '
    +'style="flex:1;padding:5px 8px;border:1px solid var(--brand,#6366f1);border-radius:5px;font-size:11px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<button onclick="tkSubmitNewSub(\''+tid+'\',\''+parentSid+'\',\''+inpId+'\');" '
    +'style="padding:4px 12px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">افزودن</button>'
    +'<button onclick="document.getElementById(\''+formId+'\').remove()" '
    +'style="padding:4px 10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:11px">انصراف</button>';
  tree.appendChild(div);
  var inp=document.getElementById(inpId);
  if(inp){
    inp.focus();
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter')tkSubmitNewSub(tid,parentSid,inpId);
      if(e.key==='Escape'){var f=document.getElementById(formId);if(f)f.remove();}
    });
  }
}

function tkSubmitNewSub(tid,parentSid,inpId){
  var inp=document.getElementById(inpId);if(!inp)return;
  var title=inp.value.trim();
  if(!title){inp.focus();return;}
  var t=_tkFindTask(tid);if(!t)return;
  var node={id:Date.now()+'_'+Math.random().toString(36).slice(2,5),title:title,done:false,subtasks:[]};
  if(parentSid){
    var parent=_tkFindSub(t.subtasks,parentSid);
    if(!parent)return;
    if(!parent.subtasks)parent.subtasks=[];
    parent.subtasks.push(node);
  } else {
    t.subtasks.push(node);
  }
  saveDB();
  var form=document.getElementById('tkAddSubForm');if(form)form.remove();
  var tree=document.getElementById('tkSubTree');
  if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);
}

function tkToggleSub(tid,sid){
  var t=_tkFindTask(tid);if(!t)return;
  var s=_tkFindSub(t.subtasks,sid);if(!s)return;
  s.done=!s.done;
  saveDB();
  var tree=document.getElementById('tkSubTree');
  if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);
}

function tkEditSubTitle(tid,sid){
  var t=_tkFindTask(tid);if(!t)return;
  var s=_tkFindSub(t.subtasks,sid);if(!s)return;
  var spans=document.querySelectorAll('.tk-sub-title[data-sid]');
  var targetSpan=null;
  for(var i=0;i<spans.length;i++){if(spans[i].getAttribute('data-sid')===String(sid)){targetSpan=spans[i];break;}}
  if(!targetSpan){
    var nv=prompt('ویرایش عنوان:',s.title||'');
    if(nv===null)return;
    s.title=nv.trim()||s.title;
    saveDB();
    var tree=document.getElementById('tkSubTree');if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);
    return;
  }
  var inp=document.createElement('input');
  inp.type='text';inp.value=s.title||'';
  inp.style.cssText='padding:3px 7px;border:1px solid var(--brand,#6366f1);border-radius:4px;font-size:11px;font-family:inherit;width:150px;background:var(--bg-input);color:var(--text-primary)';
  var saved=false;
  var save=function(){
    if(saved)return;saved=true;
    s.title=inp.value.trim()||s.title;saveDB();
    var tree=document.getElementById('tkSubTree');if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);
  };
  inp.addEventListener('blur',save);
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){inp.blur();}
    if(e.key==='Escape'){saved=true;var tree=document.getElementById('tkSubTree');if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);}
  });
  targetSpan.replaceWith(inp);
  inp.select();
}

function _tkDelSubFrom(subs,sid){
  for(var i=0;i<(subs||[]).length;i++){
    if(String(subs[i].id)===String(sid)){subs.splice(i,1);return true;}
    if(_tkDelSubFrom(subs[i].subtasks,sid))return true;
  }
  return false;
}

function tkDelSub(tid,sid){
  var t=_tkFindTask(tid);if(!t)return;
  _tkDelSubFrom(t.subtasks,sid);
  saveDB();
  var tree=document.getElementById('tkSubTree');
  if(tree)tree.innerHTML=_tkRenderSubTree(tid,t.subtasks,0);
}

// backward compat aliases (center timeline etc.)
function _addTask(){openTaskModal();}
function _toggleTask(tid){
  var t=_tkFindTask(tid);if(!t)return;
  t.status=(t.status==='done')?'todo':'done';
  t.done=(t.status==='done');
  t.doneAt=t.done?todayStr():'';
  saveDB();renderTasksPanel();
}
function _deleteTask(tid){tkDeleteTask(tid);}

function _getTaskCenterName(centerKey){
  if(!centerKey)return '';
  var parts=centerKey.split('_');
  if(parts.length<2)return centerKey;
  var c=getCenterById(parts[0],parts.slice(1).join('_'));
  if(c){var e=getE(parts[0],parts.slice(1).join('_'));return e.nameOverride||c.name||centerKey;}
  return centerKey;
}



function _clGetName(rkey){
  if(!rkey) return '?';
  var parts = rkey.split('_'); var tp = parts[0]; var id = parts.slice(1).join('_');
  var ov = (DB.edits[rkey]||{}).nameOverride;
  if(ov) return ov;
  if(tp === 'center'){
    var c = CENTERS.find(function(x){return x.id===id;}); if(c) return c.name;
    var ex = (DB.extra||[]).find(function(x){return x.id===id;}); if(ex) return ex.name;
  } else if(tp === 'pc'){
    _buildPCCache();
    var provId = id.split('||')[0];
    var arr = _PC_CACHE[provId]||[];
    var pc = arr.find(function(x){return x.id===id;}); if(pc) return pc.name;
  }
  return id;
}

function _clFieldBadge(field){
  var map = {
    status:   {label:'وضعیت',   bg:'#dbeafe',color:'#1e40af'},
    lead:     {label:'سرنخ',    bg:'#fef3c7',color:'#92400e'},
    potential:{label:'فرصت',    bg:'#f3e8ff',color:'#6b21a8'},
    followupDate:{label:'پیگیری',bg:'#dcfce7',color:'#166534'},
    owner:    {label:'مسئول',   bg:'#e0f2fe',color:'#0369a1'},
    contacts: {label:'تماس',    bg:'#fce7f3',color:'#9d174d'},
    notes:    {label:'یادداشت', bg:'#fff7ed',color:'#c2410c'},
    tags:     {label:'برچسب',   bg:'#f0fdf4',color:'#15803d'}
  };
  var m = map[field] || {label:field, bg:'var(--bg-raised)', color:'var(--text-secondary)'};
  return '<span class="cl-field-badge" style="background:'+m.bg+';color:'+m.color+'">'+m.label+'</span>';
}

function _clValDisplay(field, val){
  if(val === null || val === undefined || val === '') return '<span style="color:var(--text-muted);font-style:italic">خالی</span>';
  var s = String(val);
  if(field === 'contacts'){
    try{ var arr = JSON.parse(s); return esc(arr.length+' مخاطب'); }catch(e){}
  }
  if(s.length > 40) s = s.slice(0,40)+'…';
  return esc(s);
}

// ════════════════════════ AUTO REMINDER TIMER ═════════════════════
var _autoReminderChecked = false;

function _setupAutoReminder(){
  // یادآوری صبحگاهی (ساعت ۹): برنامه امروز برای هر کارشناس
  setInterval(function(){
    if(!_isManager()) return;
    var now = new Date();
    if(now.getHours() < 9) return;
    var today = todayStr();
    if((DB._lastMorningReminder||'') === today) return;
    DB._lastMorningReminder = today;
    saveDB();
    _runMorningBriefing(today);
  }, 60000);

  // یادآوری بعدازظهر (ساعت ۱۵): مراکز امروز بدون گزارش
  setInterval(function(){
    if(!_isManager()) return;
    var now = new Date();
    if(now.getHours() < 15) return;
    var today = todayStr();
    if((DB._lastAfternoonReminder||'') === today) return;
    DB._lastAfternoonReminder = today;
    saveDB();
    _runTodayReminders(today);
  }, 60000);

  // یادآوری startup برای مراکز بدون تاریخ + سررسیدگذشته: یک بار در روز
  setTimeout(function(){
    if(!_isManager()) return;
    var today = todayStr();
    if((DB._lastStartupReminder||'') === today) return;
    DB._lastStartupReminder = today;
    saveDB();
    _runOverdueAndUndatedReminders(today);
  }, 8000);
}

// بریفینگ صبحگاهی: برنامه امروز هر کارشناس
function _runMorningBriefing(today){
  var byExpert = {};
  _buildPCCache();
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we = DB.weekEntries[k];
    if(we.done || we.scheduledDate !== today || we.rtype === 'mtr') return;
    var owner = _wpGetOwner(we);
    if(!owner) return;
    if(!byExpert[owner]) byExpert[owner] = [];
    byExpert[owner].push(we.centerName||getRecLabel((we.rtype||'center')+'_'+(we.rid||'')));
  });
  var cnt = 0;
  Object.keys(byExpert).forEach(function(exp){
    var items = byExpert[exp]; if(!items.length) return; cnt++;
    var msg = '🌅 برنامه امروز شما: '+items.length+' مرکز برای بازدید:\n• '
      + items.slice(0,5).join('\n• ')
      + (items.length>5?'\nو '+(items.length-5)+' مورد دیگر':'')
      + '\nروز خوبی داشته باشید! 💪';
    sendNotif(exp, msg, '');
  });
  if(cnt>0) showToast('🌅 بریفینگ صبحگاهی برای '+cnt+' کارشناس ارسال شد', 3000);
}

// ── یادآوری ساعت ۳: مراکز امروز بدون گزارش ──
function _runTodayReminders(today){
  var byExpert = {};
  _buildPCCache();
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we = DB.weekEntries[k];
    if(we.done || we.scheduledDate !== today || we.rtype === 'mtr') return;
    var owner = _wpGetOwner(we);
    if(!owner) return;
    var acts = _getTodayActivities(we.rtype||'center', we.rid||'', today);
    if(acts.length > 0) return;
    if(!byExpert[owner]) byExpert[owner] = [];
    byExpert[owner].push({name: we.centerName||getRecLabel((we.rtype||'center')+'_'+(we.rid||'')), key: (we.rtype||'center')+'_'+(we.rid||'')});
  });
  var cnt = 0;
  Object.keys(byExpert).forEach(function(exp){
    var items = byExpert[exp]; if(!items.length) return; cnt++;
    var msg = '📋 برنامه امروز: '+items.length+' مرکز برای بازدید دارید:\n• '
      + items.slice(0,5).map(function(x){return x.name;}).join('\n• ')
      + (items.length>5?'\nو '+(items.length-5)+' مورد دیگر':'')
      + '\nوارد برنامه هفته شوید.';
    sendNotif(exp, msg, items[0].key, items.map(function(x){return x.key;}));
  });
  if(cnt>0) showToast('🔔 یادآوری ساعت ۱۵ برای '+cnt+' کارشناس ارسال شد', 3000);
}

// ── یادآوری روزانه: مراکز بدون تاریخ + سررسیدگذشته ──
function _runOverdueAndUndatedReminders(today){
  setTimeout(_sendOverduePushNotifs,1000);
  var byExpert = {};
  _buildPCCache();
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we = DB.weekEntries[k];
    if(we.done || we.rtype === 'mtr') return;
    var owner = _wpGetOwner(we);
    if(!owner) return;
    if(!byExpert[owner]) byExpert[owner] = {noDate:[], overdue:[]};
    var name = we.centerName||getRecLabel((we.rtype||'center')+'_'+(we.rid||''))||'?';
    var ck = (we.rtype||'center')+'_'+(we.rid||'');
    if(!we.scheduledDate){
      byExpert[owner].noDate.push({name:name, key:ck});
    } else if(we.scheduledDate < today){
      var actOnDay = _getActivitiesOnDate(we.rtype||'center', we.rid||'', we.scheduledDate);
      if(actOnDay.length === 0){
        byExpert[owner].overdue.push({name:name, key:ck, date:we.scheduledDate});
      }
    }
  });
  var cnt = 0;
  Object.keys(byExpert).forEach(function(exp){
    var d = byExpert[exp];
    if(d.overdue.length){
      var msg = '⚠️ '+d.overdue.length+' مرکز سررسید گذشته بدون گزارش:\n• '
        + d.overdue.slice(0,5).map(function(x){return x.name+' (تاریخ: '+x.date+')';}).join('\n• ')
        + (d.overdue.length>5?'\nو '+(d.overdue.length-5)+' مورد دیگر':'')
        + '\nلطفاً گزارش ثبت کنید.';
      sendNotif(exp, msg, d.overdue[0].key, d.overdue.map(function(x){return x.key;}));
      cnt++;
    }
    if(d.noDate.length){
      var msg2 = '📅 '+d.noDate.length+' مرکز بدون تاریخ پیگیری:\n• '
        + d.noDate.slice(0,5).map(function(x){return x.name;}).join('\n• ')
        + (d.noDate.length>5?'\nو '+(d.noDate.length-5)+' مورد دیگر':'')
        + '\nبرای هر مرکز تاریخ تنظیم کنید.';
      sendNotif(exp, msg2, d.noDate[0].key, d.noDate.map(function(x){return x.key;}));
      if(!d.overdue.length) cnt++;
    }
  });
  if(cnt>0) showToast('🔔 یادآوری مراکز معوق برای '+cnt+' کارشناس ارسال شد', 3000);
}

// تبدیل پیگیری به وظیفه
function convertFollowupToTask(rtype, rid){
  var e = getE(rtype, rid);
  var name = typeof _getCenterName==='function' ? _getCenterName(rtype, rid) : (rtype+'_'+rid);
  var fd = e.followupDate || '';
  openTaskModal(null, {
    title: 'پیگیری: ' + name,
    owner: e.owner || currentUser,
    dueDate: fd,
    priority: 1,
    centerKey: rtype + '_' + rid
  });
}

// کمکی: پیدا کردن مسئول یک weekEntry
function _wpGetOwner(we){
  var rtype = we.rtype||'center', rid = we.rid||'';
  var e = getE(rtype, rid);
  if(e.owner) return e.owner;
  if(rtype==='center'){var c=CENTERS.find(function(x){return x.id===rid;});if(c&&c.owner)return c.owner;}
  else{var _pId=(rid+'').split('||')[0];var _arr=_PC_CACHE[_pId]||[];var _c=_arr.find(function(x){return x.id===rid;});if(_c&&_c.owner)return _c.owner;}
  var ex=(DB.extra||[]).find(function(x){return x.id===rid;});
  if(ex&&ex.owner) return ex.owner;
  return we.addedBy||'';
}

// کمکی: فعالیت‌های یک مرکز در یک تاریخ جلالی مشخص
function _getActivitiesOnDate(rtype, rid, jDateStr){
  var rkey = rtype+'_'+rid;
  return (DB.changeLog||[]).filter(function(l){
    if(l.rkey !== rkey || !l.at) return false;
    var dp = l.at.slice(0,10).split('-').map(Number);
    if(dp.length!==3) return false;
    var jd = g2j(dp[0],dp[1],dp[2]);
    return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]) === jDateStr;
  });
}


/* ═══ public/js/calendar.js ═══ */
// ════════════════════════ CALENDAR ════════════════════
function initEvents(){if(!DB.events)DB.events=[];if(DB.events.length){var _ids=DB.events.map(function(e){return typeof e.id==='number'&&!isNaN(e.id)?e.id:0;});_nextEvId=Math.max.apply(null,_ids)+1;}}
function collectCalItems(){
  var items=[];
  (DB.events||[]).forEach(function(ev){
    if(!ev.startMs)return;var j=msToJ(ev.startMs).split('/').map(Number);
    var d=new Date(ev.startMs);var hm=p2(d.getHours())+':'+p2(d.getMinutes());
    items.push({type:'event',jDate:msToJ(ev.startMs),jy:j[0],jm:j[1],jd:j[2],time:ev.allDay?null:hm,title:ev.title,color:ev.color||'#0ea5e9',evId:ev.id,sk:ev.startMs});
  });
  // followups
  getAllProvinces().forEach(function(p){
    var tp=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(tp,c.id);var fd=e.followupDate||'';if(!fd)return;
      var st=e.status||'بدون تماس';if(st==='قرارداد بسته شد'||st==='غیرفعال')return;
      if(_isExpert()){var _fow=e.owner||c.owner||'';if(_fow&&_fow!==currentUser)return;}
      var pts=fd.split('/').map(Number);if(pts.length!==3)return;
      var _owName=USERS[e.owner||c.owner||'']||'';
      var _chipTitle=c.name+(_owName&&!_isExpert()?' ('+_owName+')':'');
      items.push({type:'followup',jDate:fd,jy:pts[0],jm:pts[1],jd:pts[2],time:null,title:_chipTitle,color:'#f59e0b',rtype:tp,rid:c.id,sk:jMs(pts[0],pts[1],pts[2])});
    });
  });
  // week entries
  Object.values(DB.weekEntries||{}).forEach(function(we){
    if(!we||typeof we!=='object')return;
    if(!we.scheduledDate)return;var pts=we.scheduledDate.split('/').map(Number);if(pts.length!==3)return;
    items.push({type:'week',jDate:we.scheduledDate,jy:pts[0],jm:pts[1],jd:pts[2],time:null,
      title:'📋 '+getRecLabel(we.recKey)+(we.done?' ✓':''),color:we.done?'#22c55e':'#8b5cf6',sk:jMs(pts[0],pts[1],pts[2])});
  });
  return items;
}

function renderCalendar(){
  try{
  if(!_calDate){var t=todayJ();_calDate=[t[0],t[1],t[2]];}
  var items=collectCalItems();
  var title=_calView==='month'?J_MONTHS[_calDate[1]-1]+' '+_calDate[0]:_calView==='week'?'هفته '+_calDate.join('/'):' ۳۰ روز از '+_calDate.join('/');
  var sp=document.getElementById('calTitle');if(sp)sp.textContent=title;
  ['month','week','list'].forEach(function(v){var b=document.getElementById('calVb_'+v);if(b)b.classList.toggle('active',_calView===v);});
  var body=document.getElementById('calBody');if(!body)return;
  if(_calView==='month')body.innerHTML=renderCalMonth(items);
  else if(_calView==='week')body.innerHTML=renderCalWeek(items);
  else body.innerHTML=renderCalList(items);
  }catch(e){
    console.error('[calendar]',e);
    var body=document.getElementById('calBody');
    if(body)body.innerHTML='<div style="text-align:center;padding:60px;color:#ef4444"><div style="font-size:28px">⚠</div><div style="font-size:13px;margin-top:8px">خطا در نمایش تقویم: '+esc(e.message)+'</div></div>';
  }
}

function calChip(it){
  var hnd='';
  if(it.type==='event')hnd='onclick="event.stopPropagation();openEvModal('+it.evId+')"';
  else if(it.type==='followup')hnd='onclick="event.stopPropagation();openCenterModal(\''+it.rtype+'\',\''+it.rid+'\')"';
  var icon=it.type==='event'?'🗓':it.type==='followup'?'📅':'📋';
  return'<div class="cal-chip" style="background:'+_safeColor(it.color)+'" '+hnd+'>'
    +'<span style="flex-shrink:0;font-size:9px">'+icon+'</span>'
    +(it.time?'<span class="cal-chip-time">'+it.time+'</span>':'')
    +'<span class="cal-chip-text">'+esc(it.title)+'</span></div>';
}

function renderCalMonth(items){
  var jy=_calDate[0],jm=_calDate[1];var total=jDays(jy,jm);var firstDow=jDow(jy,jm,1);
  var today=todayStr();
  var byDay={};items.forEach(function(it){if(it.jy!==jy||it.jm!==jm)return;if(!byDay[it.jd])byDay[it.jd]=[];byDay[it.jd].push(it);});
  var html='<div class="cal-month-grid"><div class="cal-row cal-head-row">'+J_DAYS.map(function(n){return'<div class="cal-day-head">'+n+'</div>';}).join('')+'</div>';
  var day=1;
  var weeks=Math.ceil((firstDow+total)/7);
  // prev month days for empty cells
  var prevM=jm>1?jm-1:12;var prevY=jm>1?jy:jy-1;var prevTotal=jDays(prevY,prevM);
  for(var w=0;w<weeks;w++){
    html+='<div class="cal-row">';
    for(var dow=0;dow<7;dow++){
      var cell=w*7+dow;
      if(cell<firstDow){
        var pd=prevTotal-(firstDow-1-dow+(w===0?0:0));
        // simpler: prev month day
        var prevD=prevTotal-firstDow+cell+1;
        html+='<div class="cal-day empty other-month"><div class="cal-day-num">'+prevD+'</div></div>';
      }else if(day>total){
        var nd=day-total;
        html+='<div class="cal-day empty other-month"><div class="cal-day-num">'+nd+'</div></div>';
        day++;
      }else{
        var jd=day;var dStr=jy+'/'+p2(jm)+'/'+p2(jd);var isToday=dStr===today;
        var dayItems=(byDay[jd]||[]).slice().sort(function(a,b){return(a.sk||0)-(b.sk||0);});
        html+='<div class="cal-day'+(isToday?' cal-today':'')+'" onclick="calDayClick(\''+dStr+'\')">'          +'<div class="cal-day-num">'+jd+'</div>'          +'<div class="cal-day-events">'          +(function(){var _lim=window.innerWidth<640?2:4;return dayItems.slice(0,_lim).map(calChip).join('')          +(_lim<dayItems.length?'<div class="cal-more" onclick="event.stopPropagation();calShowDay(\''+dStr+'\')">+'+(dayItems.length-_lim)+' بیشتر ▾</div>':'');})()          +'</div></div>';
        day++;
      }
    }
    html+='</div>';
  }
  html+='</div>';return html;
}

function renderCalWeek(items){
  var jy=_calDate[0],jm=_calDate[1],jd=_calDate[2];
  var dow=jDow(jy,jm,jd);var today=todayStr();
  var weekDays=[];
  for(var i=0;i<7;i++){var d=jAdd(jy,jm,jd,i-dow);weekDays.push({jArr:d,str:d[0]+'/'+p2(d[1])+'/'+p2(d[2]),dow:i});}
  var byKey={};items.forEach(function(it){if(!byKey[it.jDate])byKey[it.jDate]=[];byKey[it.jDate].push(it);});
  return'<div class="cal-week-grid">'+weekDays.map(function(wd){
    var isToday=wd.str===today;var dayItems=(byKey[wd.str]||[]).sort(function(a,b){return(a.sk||0)-(b.sk||0);});
    return'<div class="cal-wk-day'+(isToday?' today':'')+'">'
      +'<div class="cal-wk-head">'+J_DAYS[wd.dow]+'<br>'+wd.str.split('/').slice(1).join('/')+'</div>'
      +'<div class="cal-wk-body" ondblclick="openEvModalDate(\''+wd.str+'\')">'
      +(dayItems.length?dayItems.map(calChip).join(''):'<div class="cal-wk-empty">—</div>')
      +'</div></div>';
  }).join('')+'</div>';
}

function renderCalList(items){
  var today=todayStr();var tParts=today.split('/').map(Number);var tMs=jMs(tParts[0],tParts[1],tParts[2]);
  var cutoff=tMs+60*86400000;
  var future=items.filter(function(it){return it.sk&&it.sk>=tMs-86400000&&it.sk<=cutoff;}).sort(function(a,b){return a.sk-b.sk;});
  if(!future.length)return'<div style="text-align:center;padding:60px;color:#94a3b8"><div style="font-size:36px">📭</div><div style="margin-top:8px">رویدادی در ۶۰ روز آینده نیست</div></div>';
  var byDate={};future.forEach(function(it){if(!byDate[it.jDate])byDate[it.jDate]=[];byDate[it.jDate].push(it);});
  return'<div class="cal-list">'+Object.keys(byDate).sort().map(function(dk){
    var isToday=dk===today;
    return'<div class="cal-list-day">'
      +'<div class="cal-list-dh" style="display:flex;align-items:center;gap:6px">'
      +(isToday?'<span style="background:#dc2626;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">امروز</span>':'')
      +'<span>'+dk+'</span>'
      +'<span style="font-size:10px;color:var(--text-muted);margin-right:auto">'+byDate[dk].length+' مورد</span>'
      +'</div>'
      +byDate[dk].map(function(it){
        var icon=it.type==='event'?'🗓':it.type==='followup'?'📅':'📋';
        var typeName=it.type==='event'?'رویداد':it.type==='followup'?'پیگیری':'برنامه هفته';
        var hnd='';
        if(it.type==='event')hnd='onclick="openEvModal('+it.evId+')"';
        else if(it.type==='followup')hnd='onclick="openCenterModal(\''+it.rtype+'\',\''+it.rid+'\')"';
        return'<div class="cal-list-item" style="border-right-color:'+_safeColor(it.color)+'" '+(hnd||'')+' >'
          +'<span style="font-size:18px;flex-shrink:0">'+icon+'</span>'
          +'<div style="flex:1;overflow:hidden">'
            +'<div style="font-weight:600;font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.title)+'</div>'
            +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">'+typeName+(it.time?' · '+it.time:'')+'</div>'
          +'</div>'
          +(it.type==='event'?'<button class="cal-list-btn" onclick="event.stopPropagation();openEvModal('+it.evId+')">ویرایش</button><button class="cal-list-btn" style="background:#fee2e2;color:#991b1b" onclick="event.stopPropagation();deleteEv('+it.evId+')">حذف</button>':'')
        +'</div>';
      }).join('')+'</div>';
  }).join('')+'</div>';
}

function calSetTypeFilter(t){_calTypeFilter=t;renderCalendar();}

function calDayClick(dStr){
  var allItems=collectCalItems().filter(function(it){return it.jDate===dStr;});
  if(allItems.length)calShowDay(dStr);else openEvModalDate(dStr);
}

function calShowDay(dStr){
  var allItems=collectCalItems().filter(function(it){return it.jDate===dStr;});
  allItems.sort(function(a,b){return(a.sk||0)-(b.sk||0);});
  var body='<div style="display:flex;flex-direction:column;gap:5px;max-height:65vh;overflow-y:auto;padding:2px">'
    +allItems.map(function(it){
      var icon=it.type==='event'?'🗓':it.type==='followup'?'📅':'📋';
      var typeName=it.type==='event'?'رویداد':it.type==='followup'?'پیگیری':'برنامه هفته';
      var hnd='';
      if(it.type==='event')hnd='onclick="closeModal(\'calDayModal\');openEvModal('+it.evId+')"';
      else if(it.type==='followup')hnd='onclick="closeModal(\'calDayModal\');openCenterModal(\''+it.rtype+'\',\''+it.rid+'\')"';
      return'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-right:3px solid '+_safeColor(it.color)+';background:var(--bg-raised);border-radius:6px;'+(hnd?'cursor:pointer':'')+'" '+(hnd||'')+'>'
        +'<span style="font-size:20px;flex-shrink:0">'+icon+'</span>'
        +'<div style="flex:1;overflow:hidden">'
          +'<div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.title)+'</div>'
          +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">'+typeName+(it.time?' · '+it.time:'')+'</div>'
        +'</div>'
        +(hnd?'<span style="font-size:13px;color:var(--brand)">←</span>':'')
      +'</div>';
    }).join('')+'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'calDayModal\')">بستن</button>'
    +'<button class="btn-primary" onclick="closeModal(\'calDayModal\');openEvModalDate(\''+dStr+'\')">➕ رویداد جدید</button>';
  openModal('calDayModal','📅 '+dStr+' <span style="font-size:11px;font-weight:400;color:var(--text-muted)">— '+allItems.length+' مورد</span>',body,foot);
}

function calNav(delta){
  if(!_calDate){var t=todayJ();_calDate=t.slice();}
  if(_calView==='month'){_calDate[1]+=delta;if(_calDate[1]<1){_calDate[1]=12;_calDate[0]--;}if(_calDate[1]>12){_calDate[1]=1;_calDate[0]++;}  _calDate[2]=1;}
  else if(_calView==='week'){var d=jAdd(_calDate[0],_calDate[1],_calDate[2],delta*7);_calDate=d;}
  else{var d2=jAdd(_calDate[0],_calDate[1],_calDate[2],delta*30);_calDate=d2;}
  renderCalendar();
}
function calGoToday(){_calDate=todayJ().slice();renderCalendar();}
function calSetView(v){_calView=v;renderCalendar();}

function openEvModal(evId){
  var ev=(evId!==null&&evId!==undefined)?(DB.events||[]).find(function(e){return e.id===evId;})||null:null;
  var today2=todayStr();var dateVal=ev?msToJ(ev.startMs):today2;
  var timeVal='';
  if(ev&&!ev.allDay){var d=new Date(ev.startMs);timeVal=p2(d.getHours())+':'+p2(d.getMinutes());}
  var body='<label>عنوان *</label><input id="evT" type="text" value="'+esc(ev?ev.title:'')+'" placeholder="عنوان رویداد...">'
    +'<label>توضیحات</label><textarea id="evD" rows="2">'+esc(ev?ev.desc||'':'')+'</textarea>'
    +'<div class="m-2col">'
    +'<div><label>تاریخ</label><input id="evDate" type="text" value="'+dateVal+'" readonly style="cursor:pointer" onclick="openJDP(this,function(v){document.getElementById(\'evDate\').value=v;})"></div>'
    +'<div><label>زمان (خالی=تمام روز)</label><input id="evTime" type="time" value="'+timeVal+'"></div>'
    +'</div>'
    +'<div><label>رنگ</label><input id="evColor" type="color" value="'+(ev?ev.color||'#0ea5e9':'#0ea5e9')+'"></div>';
  var foot=(ev?'<button class="btn-danger" onclick="deleteEv('+ev.id+')">🗑 حذف</button>':'')
    +'<button class="btn-secondary" onclick="closeModal(\'evModal\')">انصراف</button>'
    +'<button class="btn-primary" onclick="saveEv('+(ev?ev.id:'null')+')">'+(ev?'ذخیره':'ایجاد')+'</button>';
  openModal('evModal',(ev?'✏️':'➕')+' رویداد',body,foot);
  setTimeout(function(){var el=document.getElementById('evT');if(el)el.focus();},50);
}

function openEvModalDate(dateStr){
  openEvModal(null);
  setTimeout(function(){var el=document.getElementById('evDate');if(el)el.value=dateStr;},60);
}

function saveEv(evId){
  var title=(document.getElementById('evT')||{}).value;if(!title||!title.trim()){showToast('عنوان الزامی است');return;}
  var dateVal=(document.getElementById('evDate')||{}).value;if(!dateVal){showToast('تاریخ الزامی است');return;}
  var pts=dateVal.split('/').map(Number);var g=j2g(pts[0],pts[1],pts[2]);
  var tv=(document.getElementById('evTime')||{}).value;
  var allDay=!tv;var startMs;
  if(allDay)startMs=new Date(g[0],g[1]-1,g[2]).getTime();
  else{var tp=tv.split(':').map(Number);startMs=new Date(g[0],g[1]-1,g[2],tp[0]||0,tp[1]||0).getTime();}
  var color=(document.getElementById('evColor')||{}).value||'#0ea5e9';
  var desc=(document.getElementById('evD')||{}).value||'';
  if(evId&&evId!=='null'){var ev=(DB.events||[]).find(function(e){return e.id===evId;});if(ev){ev.title=title.trim();ev.desc=desc;ev.startMs=startMs;ev.allDay=allDay;ev.color=color;}}
  else DB.events.push({id:_nextEvId++,title:title.trim(),desc:desc,startMs:startMs,allDay:allDay,color:color,owner:currentUser});
  saveDB();closeModal('evModal');renderCalendar();showToast('رویداد ذخیره شد ✅');
}

function deleteEv(id){
  if(!confirm('حذف این رویداد؟'))return;
  DB.events=(DB.events||[]).filter(function(e){return e.id!==id;});
  saveDB();closeModal('evModal');renderCalendar();
}


/* ═══ public/js/checklist.js ═══ */

// ── چک‌لیست: آیتم‌های قابل محاسبه اتوماتیک ──────────────────────
function _ckAutoComputed(){
  var today=todayStr();
  var todayTs=jMs.apply(null,todayStr().split('/').map(Number));
  // tomorrow
  var tmr=jAdd.apply(null,today.split('/').map(Number).concat([1]));
  var tmrStr=tmr[0]+'/'+p2(tmr[1])+'/'+p2(tmr[2]);
  // week bounds (Saturday to Friday)
  var wb=currentWeekBounds?currentWeekBounds():{startTs:todayTs-6*86400000,endTs:todayTs+86400000};

  // #2: تماس با حداقل ۵ مرکز — از callLog امروز
  var todayCalls=(DB.callLog||[]).filter(function(l){return l.userId===currentUser&&l.date===today;});
  var callCount=todayCalls.reduce(function(s,l){return s+(l.count||1);},0);
  // اگر callLog خالی است، از changeLog بشمار
  if(callCount===0){
    callCount=(DB.changeLog||[]).filter(function(c){
      return c.by===currentUser&&c.at&&c.at.startsWith&&c.at.length>8
        &&msToJ(new Date(c.at).getTime())===today;
    }).map(function(c){return c.rkey;}).filter(function(r,i,a){return a.indexOf(r)===i;}).length;
  }

  // #3: ثبت نتیجه هر تماس — callLog امروز >= 1
  var hasCallNote=todayCalls.length>0||(DB.notes?Object.keys(DB.notes).some(function(k){
    var ns=DB.notes[k]||[];
    return ns.some(function(n){
      var d=n.date||(n.at?msToJ(new Date(n.at).getTime()):'');
      return d===today&&(n.user===currentUser||n.by===currentUser);
    });
  }):false);

  // #6: تعیین تاریخ پیگیری بعدی — changeLog امروز با field=followupDate
  var setFuToday=(DB.changeLog||[]).some(function(c){
    return c.by===currentUser&&c.field==='followupDate'&&c.at
      &&msToJ(new Date(c.at).getTime())===today;
  });

  // #8: ثبت گزارش بازدید — weekEntries با done=true و doneDate=today
  var visitToday=Object.values(DB.weekEntries||{}).some(function(we){
    return we.actionType==='visit'&&we.done&&we.doneDate===today
      &&(we.addedBy===currentUser||_getOwnerForRecKey(we.recKey||'')=== currentUser);
  });

  // #10: تهیه لیست بازدید فردا — weekEntries scheduledDate=tomorrow برای user
  var planTmr=Object.values(DB.weekEntries||{}).some(function(we){
    return !we.done&&(we.scheduledDate===tmrStr)
      &&(we.addedBy===currentUser||_getOwnerForRecKey(we.recKey||'')=== currentUser);
  });

  // #13: بررسی آمار فروش هفته — salesLog این هفته >= 1
  var weekSales=(DB.salesLog||[]).filter(function(l){
    var ts=l.date?jMs.apply(null,l.date.split('/').map(Number)):0;
    return l.userId===currentUser&&ts>=wb.startTs&&ts<=wb.endTs;
  });
  var hasSales=weekSales.length>0||
    (DB.changeLog||[]).some(function(c){
      return c.by===currentUser&&c.field==='status'&&c.val==='قرارداد بسته شد'
        &&c.at&&new Date(c.at).getTime()>=wb.startTs&&new Date(c.at).getTime()<=wb.endTs;
    });

  return{
    2:{done:callCount>=5,count:callCount,label:callCount+' تماس امروز',threshold:5},
    3:{done:hasCallNote,count:todayCalls.length,label:hasCallNote?'نتیجه ثبت شده':'ثبت نشده'},
    6:{done:setFuToday,label:setFuToday?'پیگیری تنظیم شد':'تنظیم نشده'},
    8:{done:visitToday,label:visitToday?'ویزیت ثبت شد':'ویزیت امروز ندارید'},
    10:{done:planTmr,label:planTmr?'برنامه فردا دارید':'برنامه‌ریزی نشده'},
    13:{done:hasSales,count:weekSales.length,label:weekSales.length+' فروش این هفته'}
  };
}

// ════════════════════════ CHECKLIST ══════════════════
function renderChecklist(){
  if(!_ckDate)_ckDate=todayStr();
  var el=document.getElementById('ckDate');if(el)el.textContent=_ckDate;
  var key=_ckDate+'_'+currentUser;
  if(!DB.checklist[key])DB.checklist[key]={items:[],note:''};
  var saved=DB.checklist[key];
  var doneIds=(saved.items||[]).filter(function(i){return i.done;}).map(function(i){return i.id;});
  var _ckAutoSc=_ckAutoComputed();
  var totalDone=getCKItems().filter(function(it){return doneIds.indexOf(it.id)!==-1||(_ckAutoSc[it.id]&&_ckAutoSc[it.id].done);}).length;
  var sc=document.getElementById('ckSc');if(sc)sc.textContent=totalDone;
  var ckList=document.getElementById('ckList');if(!ckList)return;
  var _ckAuto=_ckAutoComputed();
  ckList.innerHTML=getCKItems().map(function(item){
    var done=doneIds.indexOf(item.id)!==-1;
    var auto=_ckAuto[item.id];
    var autoDone=auto&&auto.done;
    var isEffDone=done||autoDone;
    var autoBadge=auto?'<span style="font-size:10px;background:'+(autoDone?'#dcfce7':'#f1f5f9')+';color:'+(autoDone?'#15803d':'#64748b')+';border-radius:10px;padding:1px 7px;margin-right:6px;font-weight:600">🤖 '+esc(auto.label)+'</span>':'';
    return'<div class="ck-item'+(isEffDone?' done':'')+(item.mgr?' mgr':'')+'" onclick="toggleCk('+item.id+')" title="'+(auto?'اتوماتیک از داده سیستم محاسبه می‌شود':'')+'">'
      +'<input type="checkbox" class="ck-cb"'+(isEffDone?' checked':'')+'> <span>'+item.t+'</span>'
      +autoBadge+'</div>';
  }).join('')
  +'<textarea class="ck-note" placeholder="یادداشت روز..." onchange="saveCkNote(this.value)">'+esc(saved.note||'')+'</textarea>';
}
function toggleCk(id){
  var key=_ckDate+'_'+currentUser;if(!DB.checklist[key])DB.checklist[key]={items:[],note:''};
  var items=DB.checklist[key].items||[];var idx=items.findIndex(function(i){return i.id===id;});
  if(idx===-1)items.push({id:id,done:true});else items[idx].done=!items[idx].done;
  DB.checklist[key].items=items;saveDB();renderChecklist();
}
function saveCkNote(v){var key=_ckDate+'_'+currentUser;if(!DB.checklist[key])DB.checklist[key]={items:[],note:''};DB.checklist[key].note=v;saveDB();}
function ckNav(delta){var p=_ckDate.split('/').map(Number);var d=jAdd(p[0],p[1],p[2],delta);_ckDate=d[0]+'/'+p2(d[1])+'/'+p2(d[2]);renderChecklist();}
function ckToday(){_ckDate=todayStr();renderChecklist();}


/* ═══ public/js/activity-log.js ═══ */
// ════════════════════════ ACTIVITY ═══════════════════
function renderActivity(){
  var el=document.getElementById('actPanel');if(!el)return;
  var entries=[];
  var today=todayStr();
  try{
    // ۱. تغییرات وضعیت (edits)
    Object.keys(DB.edits||{}).forEach(function(k){
      var e=DB.edits[k];
      if(!e||!e._ts)return;
      // name را ساده پیدا کن
      var pts=k.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
      var name=id;
      if(tp==='center'){
        var c=CENTERS.find(function(x){return x.id===id;});
        if(c)name=c.name;
        else{var ex=(DB.extra||[]).find(function(x){return x.id===id;});if(ex)name=ex.name;}
      }else if(tp==='pc'){
        // جستجو در extra
        var ex2=(DB.extra||[]).find(function(x){return x.id===id;});
        if(ex2){name=ex2.name;}else{
          // جستجو در PC_RAW
          var found=false;
          getAllProvinces().some(function(p){
            if(p.id==='tehran')return false;
            var pn=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
            var raw=PC_RAW[pn]||[];
            // id = provId||rowNum
            var idParts=id.split('||');
            if(idParts[0]===p.id){
              var rn=parseInt(idParts[1]);
              var row=raw.find(function(r){return r[0]===rn;});
              if(row){name=row[1].replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');found=true;return true;}
            }
            return false;
          });
        }
      }else if(tp==='province'){
        var pv=getAllProvinces().find(function(p){return p.id===id;});
        if(pv)name=pv.name;
      }
      entries.push({ts:e._ts,name:name,desc:e.status||'تغییر وضعیت',icon:'📝',user:''});
    });
    // ۲. یادداشت‌ها
    Object.keys(DB.notes||{}).forEach(function(k){
      (DB.notes[k]||[]).forEach(function(n){
        if(!n||(!n.ts&&!n.at))return;
        var _nts=n.ts||(n.at?new Date(n.at).getTime():0);
        var pts=k.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
        var name=id;
        if(tp==='center'){var c=CENTERS.find(function(x){return x.id===id;});if(c)name=c.name;}
        else if(tp==='pc'){var ex=(DB.extra||[]).find(function(x){return x.id===id;});if(ex)name=ex.name;}
        entries.push({ts:_nts,name:name,desc:(n.text||'').slice(0,60),icon:'💬',user:n.by||n.user||''});
      });
    });
    // ۳. هفته‌های انجام‌شده
    Object.values(DB.weekEntries||{}).forEach(function(we){
      if(!we||!we.done||!we.doneDate)return;
      var pts=we.doneDate.split('/').map(Number);
      if(pts.length!==3)return;
      var ts=jMs(pts[0],pts[1],pts[2]);if(!ts)return;
      var name=we.recKey?we.recKey:'';
      if(we.rtype==='center'&&we.rid){var c=CENTERS.find(function(x){return x.id===we.rid;});if(c)name=c.name;}
      else if(we.recKey){name=we.recKey;}
      var actType=we.actionType||'call';
      entries.push({ts:ts,name:name,desc:(actType==='visit'?'🚗 ویزیت انجام شد':'📞 تماس انجام شد')+' ✓',icon:'✅',user:we.doneUser||''});
    });
    // ۴. تماس‌های روزانه (callLog)
    (DB.callLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'📞 '+l.count+' تماس'+(l.note?' — '+l.note:''),icon:'📞',user:l.userId||''});
    });
    // ۵. ویزیت‌های دستی (visitLog)
    (DB.visitLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'🚗 '+(l.count>1?l.count+' بازدید':'بازدید')+(l.note?' — '+l.note:''),icon:'🚗',user:l.userId||''});
    });
  }catch(err){
    el.innerHTML='<div style="padding:20px;color:#dc2626">⚠ خطا در نمایش فعالیت‌ها: '+esc(err.message)+'</div>';
    return;
  }
  entries.sort(function(a,b){return b.ts-a.ts;});
  if(!entries.length){
    el.innerHTML='<div style="text-align:center;padding:60px;color:#94a3b8">'
      +'<div style="font-size:48px;margin-bottom:14px">📭</div>'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:8px">هنوز فعالیتی ثبت نشده</div>'
      +'<div style="font-size:12px">وضعیت مراکز را تغییر دهید تا اینجا نمایش داده شود</div></div>';
    return;
  }
  var byDate={};
    var ACT_PAGE_SIZE=50;
  var totalPages=Math.ceil(entries.length/ACT_PAGE_SIZE)||1;
  if(_actPage>=totalPages)_actPage=totalPages-1;
  var pageEntries=entries.slice(_actPage*ACT_PAGE_SIZE,(_actPage+1)*ACT_PAGE_SIZE);
  var byDate={};
  pageEntries.forEach(function(ev){
    var d=msToJ(ev.ts)||today;
    if(!byDate[d])byDate[d]=[];
    byDate[d].push(ev);
  });
  var out='<div style="padding:12px 14px;max-width:900px">';
  if(totalPages>1){
    var p1=_actPage*ACT_PAGE_SIZE+1;
    var p2e=Math.min((_actPage+1)*ACT_PAGE_SIZE,entries.length);
    out+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px;color:var(--text-muted)"><span>نمایش '+p1+' – '+p2e+' از '+entries.length+' فعالیت</span>'
      +'<div style="display:flex;gap:4px;margin-right:auto">'
      +'<button onclick="_actPage=Math.max(0,_actPage-1);renderActivity()" style="padding:3px 10px;border:1px solid var(--border);border-radius:5px;background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:11px"'+(_actPage===0?' disabled':'')+('>◀ قبلی</button>')
      +'<span style="padding:3px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px">صفحه '+(_actPage+1)+' / '+totalPages+'</span>'
      +'<button onclick="_actPage=Math.min('+(totalPages-1)+',_actPage+1);renderActivity()" style="padding:3px 10px;border:1px solid var(--border);border-radius:5px;background:var(--bg-raised);cursor:pointer;font-family:inherit;font-size:11px"'+(_actPage>=totalPages-1?' disabled':'')+'>بعدی ▶</button>'
      +'</div></div>';
  }
  Object.keys(byDate).sort().reverse().forEach(function(d){
    out+='<div class="act-day-head">'+(d===today?'📅 امروز — '+d:d)+'</div>';
    byDate[d].forEach(function(ev){
      var dt=new Date(ev.ts);
      var hm=p2(dt.getHours())+':'+p2(dt.getMinutes());
      out+='<div class="act-item">'
        +'<span class="act-time">'+hm+'</span>'
        +'<span style="font-size:15px;flex-shrink:0">'+ev.icon+'</span>'
        +'<span class="act-name">'+esc(ev.name||'?')+'</span>'
        +'<span class="act-desc">'+esc(ev.desc||'')+'</span>'
        +(ev.user?'<span class="act-user">'+esc(ev.user)+'</span>':'')
        +'</div>';
    });
  });
  out+='</div>';
  el.innerHTML=out;
}
// ════════════════════════ GLOBAL SEARCH (Ctrl+K) ══════════════
var _gSearchSel=0;
function openGSearch(){
  document.getElementById('gSearchOverlay').classList.add('open');
  setTimeout(function(){var el=document.getElementById('gSearchInput');if(el){el.value='';el.focus();}gSearchQuery('');},50);
}
function closeGSearch(){document.getElementById('gSearchOverlay').classList.remove('open');}
function gSearchQuery(q){
  q=(q||'').trim();
  var res=[];
  if(q.length>=1){
    var qn=fNorm(q);
    _buildPCCache();
    (CENTERS||[]).forEach(function(c){
      if(res.length>=12)return;
      var name=c.name||'';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE('center',c.id)||{};
        var cid=c.id;
        res.push({icon:'🏥',title:esc(name),sub:esc(e.status||'بدون تماس'),action:function(){closeGSearch();openCenterModal('center',cid);}});
      }
    });
    Object.keys(_PC_CACHE||{}).forEach(function(pv){if(res.length>=12)return;(_PC_CACHE[pv]||[]).forEach(function(c){
      if(res.length>=12)return;
      var name=c.name||c.center_name||'';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE('pc',c.id)||{};var cid=c.id;
        res.push({icon:'🏢',title:esc(name),sub:esc(e.status||c.province_name||''),action:function(){closeGSearch();openCenterModal('pc',cid);}});
      }
    });});
    // DB.extra (manually added centers)
    var _mainCIds=new Set((CENTERS||[]).map(function(c){return String(c.id);}));
    (DB.extra||[]).forEach(function(c){
      if(res.length>=12)return;
      var ertype=c.province_id==='tehran'?'center':'pc';
      if(ertype==='center'&&_mainCIds.has(String(c.id)))return;
      var name=c.name||c.center_name||'';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE(ertype,c.id)||{};var cid=c.id;var crt=ertype;
        res.push({icon:'➕',title:esc(name),sub:esc(e.status||c.province_name||'مرکز اضافه‌شده'),action:function(){closeGSearch();openCenterModal(crt,cid);}});
      }
    });
    (DB.events||[]).forEach(function(ev){
      if(!ev||!ev.title)return;
      if(fNorm(ev.title).indexOf(qn)!==-1){
        res.push({icon:'🗓',title:esc(ev.title),sub:esc(ev.date||''),action:function(){closeGSearch();switchTab('calendar');}});
      }
    });
    (PROVINCES||[]).forEach(function(p){
      var pn=p.name||p.n||'';
      if(fNorm(pn).indexOf(qn)!==-1){
        var pid=p.id;
        res.push({icon:'🗺',title:esc(pn),sub:'استان',action:function(){closeGSearch();switchTab('provinces');openProvince(pid);}});
      }
    });
  }
  _gSearchSel=0;
  var el=document.getElementById('gSearchResults');
  if(!el)return;
  if(!res.length){el.innerHTML='<div class="gs-empty">'+(q?'نتیجه‌ای یافت نشد':'برای جستجو تایپ کنید…')+'</div>';el._results=[];return;}
  el.innerHTML=res.map(function(r,i){
    return'<div class="gs-item'+(i===0?' gs-sel':'')+'" data-idx="'+i+'" onmouseenter="gSearchHover('+i+')" onclick="gSearchExec('+i+')">'
      +'<span class="gs-icon">'+r.icon+'</span>'
      +'<div class="gs-main"><div class="gs-title">'+r.title+'</div>'+(r.sub?'<div class="gs-sub">'+r.sub+'</div>':'')+'</div>'
      +'</div>';
  }).join('');
  el._results=res;
}
function gSearchHover(i){_gSearchSel=i;var items=document.querySelectorAll('.gs-item');items.forEach(function(el,j){el.classList.toggle('gs-sel',j===i);});}
function gSearchExec(i){var el=document.getElementById('gSearchResults');if(!el||!el._results)return;var r=el._results[i];if(r&&r.action)r.action();}
function gSearchKey(e){
  var el=document.getElementById('gSearchResults');
  var items=el?el.querySelectorAll('.gs-item'):[];
  if(e.key==='ArrowDown'){e.preventDefault();_gSearchSel=Math.min(_gSearchSel+1,items.length-1);gSearchHover(_gSearchSel);}
  else if(e.key==='ArrowUp'){e.preventDefault();_gSearchSel=Math.max(_gSearchSel-1,0);gSearchHover(_gSearchSel);}
  else if(e.key==='Enter'){e.preventDefault();gSearchExec(_gSearchSel);}
  else if(e.key==='Escape'){closeGSearch();}
}

// ════════════════════════ QUICK SEARCH ═══════════════
function openQS(){
  var o=document.getElementById('qsOverlay');
  if(o){o.style.display='flex';setTimeout(function(){var i=document.getElementById('qsInput');if(i){i.focus();i.select();}},60);}
}
function closeQS(){
  var o=document.getElementById('qsOverlay');
  if(o)o.style.display='none';
  var i=document.getElementById('qsInput');if(i)i.value='';
  var r=document.getElementById('qsResults');if(r)r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">برای جستجو تایپ کنید (Ctrl+K برای باز کردن)</div>';
}
function qsSearch(q){
  var r=document.getElementById('qsResults');
  if(!r)return;
  if(!q||q.length<2){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">حداقل ۲ حرف وارد کنید</div>';return;}
  var qn=fNorm(q);
  var results=[];
  // مراکز تهران
  (CENTERS||[]).forEach(function(c){
    if(fNorm(c.name||'').indexOf(qn)>=0){
      var e=getE('center',c.id);
      results.push({type:'مرکز تهران',icon:'🏥',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
    }
  });
  // مراکز استانی از cache
  _buildPCCache();
  Object.keys(_PC_CACHE||{}).forEach(function(provId){
    (_PC_CACHE[provId]||[]).forEach(function(c){
      if(fNorm(c.name||'').indexOf(qn)>=0){
        var e=getE('pc',c.id);
        results.push({type:'مرکز استانی',icon:'🏢',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
      }
    });
  });
  // مراکز اضافه‌شده (DB.extra)
  var _qsMainIds=new Set((CENTERS||[]).map(function(c){return String(c.id);}));
  (DB.extra||[]).forEach(function(c){
    var ertype=c.province_id==='tehran'?'center':'pc';
    if(ertype==='center'&&_qsMainIds.has(String(c.id)))return;
    if(fNorm(c.name||'').indexOf(qn)>=0){
      var e=getE(ertype,c.id);
      results.push({type:'مرکز اضافه‌شده',icon:'➕',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
    }
  });
  // برنامه هفته
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    var nm=we.centerName||we.mtrCustomer||'';
    if(nm&&fNorm(nm).indexOf(qn)>=0){
      results.push({type:'برنامه هفته',icon:'📅',name:nm,sub:we.scheduledDate||'بدون تاریخ',action:"switchTab('weekplan');closeQS()"});
    }
  });
  // یادداشت‌ها
  Object.keys(DB.notes||{}).forEach(function(k){
    (DB.notes[k]||[]).forEach(function(n){
      if(!n||!n.text)return;
      if(fNorm(n.text).indexOf(qn)>=0){
        results.push({type:'یادداشت',icon:'📝',name:n.text.substring(0,70)+(n.text.length>70?'…':''),sub:k,action:"closeQS()"});
      }
    });
  });
  if(!results.length){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">نتیجه‌ای یافت نشد</div>';return;}
  r.innerHTML=results.slice(0,20).map(function(item){
    return '<div onclick="'+item.action+'" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;cursor:pointer;transition:.15s" onmouseover="this.style.background=\'var(--bg-raised)\'" onmouseout="this.style.background=\'\'">'
      +'<span style="font-size:18px">'+item.icon+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(item.name)+'</div>'
      +'<div style="font-size:10px;color:var(--text-muted)">'+esc(item.type)+(item.sub?' — '+esc(item.sub):'')+'</div>'
      +'</div></div>';
  }).join('')+(results.length>20?'<div style="text-align:center;padding:8px;font-size:11px;color:var(--text-muted)">... و '+(results.length-20)+' نتیجه دیگر</div>':'');
}


/* ═══ public/js/backup.js ═══ */
// ════════════════════════ EXPORT / BACKUP ════════════
function exportCSV(){
  if(!_currentProvId){showToast('ابتدا یک استان را باز کنید');return;}
  var rtype=getProvType(_currentProvId);var data=getFiltered();
  var rows=[['ردیف','نام','پتانسیل','نوع','سرنخ','مسئول','وضعیت','پیگیری']];
  data.forEach(function(r){var e=getE(rtype,r.id);rows.push([r.row,r.name,e.potential||r.potential,e.type||r.type||'',e.lead||r.lead||'',USERS[e.owner||r.owner||'']||'',e.status||'بدون تماس',e.followupDate||'']);});
  var csv=rows.map(function(r){return r.map(function(c){return'"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='atena_'+todayStr().replace(/\//g,'-')+'.csv';a.click();
}

// ═══════════════════════════════════════════════════════════════
// ════════════════════════ MERGE BACKUP ═════════════════════════
// ═══════════════════════════════════════════════════════════════

var _mergeImportedDB = null;
var _mergeFilename = '';




function _statBox(label, value, color){
  return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:7px 9px;border-right:3px solid '+color+'">'
    +'<div style="font-size:10px;color:var(--text-muted)">'+label+'</div>'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-top:2px">'+value+'</div>'
    +'</div>';
}





function doPrint(){window.print();}
function doPDF(){showToast('در پنجره چاپ، Destination→Save as PDF انتخاب کنید');setTimeout(doPrint,500);}


// ════════════════════════ IMPORT EXCEL ════════════════════
var _importData = null;
var _importCols = [];

// ═══════════════════════════════════════════════════════════
// ════════════════════════ DB MANAGER ═══════════════════════
function openDBManager(){
  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0);
  var statusHtml=totalCenters>0
    ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:7px;padding:10px 14px;margin-bottom:14px;display:flex;gap:12px;align-items:center">'
      +'<span style="font-size:20px">✅</span>'
      +'<div><div style="font-weight:700;color:#166534;font-size:13px">دیتابیس فعال</div>'
      +'<div style="font-size:11px;color:#166534">'+totalCenters.toLocaleString('fa-IR')+' مرکز در '+Object.keys(PC_RAW).length+' استان (+ تهران)</div></div>'
      +'<button onclick="confirmClearMasterDB()" style="margin-right:auto;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">🗑 پاک کردن دیتابیس</button>'
      +'</div>'
    : '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:7px;padding:10px 14px;margin-bottom:14px">'
      +'<span style="font-weight:700;color:#92400e">⚠ دیتابیس خالی است</span>'
      +'<div style="font-size:11px;color:#92400e;margin-top:3px">برای استفاده از نرم‌افزار، ابتدا فایل اکسل مراکز را وارد کنید.</div></div>';

  var body=statusHtml
    +'<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:10px 14px;margin-bottom:14px;font-size:12px">'
    +'<strong style="color:#0369a1">📋 فرمت اکسل مورد نیاز:</strong><br>'
    +'ستون‌های الزامی: <code style="background:#dbeafe;padding:1px 5px;border-radius:3px">نام مرکز</code> <code style="background:#dbeafe;padding:1px 5px;border-radius:3px">استان</code><br>'
    +'ستون‌های اختیاری: <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">نوع</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">پتانسیل</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">سرنخ</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">مسئول</code><br>'
    +'<small style="color:var(--text-muted)">تهران هم باید در ستون استان نوشته شود. هر بار که ایمپورت می‌کنید، کل دیتابیس مراکز جایگزین می‌شود.</small>'
    +'<br><a href="#" onclick="downloadDBTemplate();return false" style="color:#0ea5e9;text-decoration:underline;font-size:11px">📥 دانلود قالب نمونه اکسل</a></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">انتخاب فایل اکسل / CSV</label>'
    +'<input type="file" id="dbFile" accept=".xlsx,.xls,.csv" style="width:100%;padding:8px;border:2px dashed #0ea5e9;border-radius:7px;font-size:12px;cursor:pointer;background:var(--brand-bg)" onchange="handleDBFile(event)"></div>'
    +'<div id="dbPreviewArea" style="margin-top:10px"></div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'dbManagerModal\')">بستن</button>'
    +'<button class="btn-primary" id="dbDoBtn" style="display:none" onclick="doDBImport()">💾 جایگزین کردن دیتابیس مراکز</button>';
  openModal('dbManagerModal','📦 مدیریت دیتابیس مراکز',body,foot,{lg:true});
}

function downloadDBTemplate(){
  var rows=[
    ['نام مرکز','استان','نوع','پتانسیل','سرنخ','مسئول'],
    ['بیمارستان میلاد','تهران','بیمارستان تامین اجتماعی','1','مشتری','Reyhane.kashisaz'],
    ['بیمارستان نمازی شیراز','فارس','بیمارستان','3','سرنخ','Sarah.hosseini'],
    ['کلینیک تصویربرداری کوثر قزوین','قزوین','مرکز تصویربرداری','2','لید','Mohammad.seyedsalehi'],
    ['مرکز اورولوژی بوعلی سینا مشهد','خراسان رضوی','مرکز','3','سرنخ','Rambod.ghasemi'],
  ];
  var csv=rows.map(function(r){return r.map(function(c){return'"'+c+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_centers_template.csv';a.click();
  showToast('قالب نمونه دانلود شد ✅');
}

var _dbImportData=null;
var _dbRawRows=null;
var _dbHeaders=null;

// ── Step 1: پارس فایل ──────────────────────────────────────────
function handleDBFile(ev){
  var file=ev.target.files[0];if(!file)return;
  var area=document.getElementById('dbPreviewArea');
  if(!area)return;
  area.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ در حال پردازش فایل...</div>';
  var btn=document.getElementById('dbDoBtn');if(btn)btn.style.display='none';

  function onRows(rows){
    if(!rows||rows.length<2){
      area.innerHTML='<div style="color:#dc2626;padding:10px">❌ فایل خالی است یا فرمت نادرست دارد</div>';return;
    }
    _dbHeaders=rows[0].map(function(h){return(h||'').toString().trim();});
    _dbRawRows=rows.slice(1).filter(function(r){return r.some(function(c){return c&&c.toString().trim();});});
    showColumnMapping(_dbHeaders,_dbRawRows);
  }

  function readCsv(){
    var reader=new FileReader();
    reader.onload=function(e){
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
      var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
      var rows=lines.map(function(l){
        var cells=[];var inQ=false;var cur='';
        for(var i=0;i<l.length;i++){var ch=l[i];
          if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cells.push(cur.trim());cur='';}else cur+=ch;}
        cells.push(cur.trim());
        return cells.map(function(c){return c.replace(/^"|"$/g,'').trim();});
      });
      onRows(rows);
    };
    reader.readAsText(file,'UTF-8');
  }

  function readXlsx(){
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
        onRows(rows);
      }catch(err){area.innerHTML='<div style="color:#dc2626;padding:10px">❌ خطا: '+esc(err.message)+'</div>';}
    };
    reader.readAsArrayBuffer(file);
  }

  if(file.name.toLowerCase().endsWith('.csv')){readCsv();return;}
  if(typeof XLSX==='undefined'){
    var script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=readXlsx;
    script.onerror=function(){area.innerHTML='<div style="color:#dc2626;padding:10px">⚠ SheetJS بارگذاری نشد. از CSV استفاده کنید.</div>';};
    document.head.appendChild(script);
  }else{readXlsx();}
}

// ── Step 2: نمایش Column Mapping UI ──────────────────────────────
var _COL_FIELDS=[
  {key:'name',   label:'نام مرکز',  req:true,  hint:'ستون اصلی — الزامی'},
  {key:'province',label:'استان',    req:true,  hint:'نام استان فارسی — الزامی'},
  {key:'type',   label:'نوع مرکز', req:false, hint:'مثلاً: بیمارستان، کلینیک'},
  {key:'potential',label:'پتانسیل',req:false, hint:'عدد ۱ تا ۴'},
  {key:'lead',   label:'نوع لید',  req:false, hint:'سرنخ، لید، مشتری'},
  {key:'owner',  label:'مسئول',    req:false, hint:'نام کاربری مسئول'},
  {key:'tags',   label:'برچسب‌ها', req:false, hint:'با کاما جدا شوند: اورولوژی,VIP'},
  {key:'address',label:'آدرس',     req:false, hint:'آدرس مرکز'},
  {key:'phone',  label:'تلفن',     req:false, hint:'شماره تماس (با کاما برای چندین شماره)'},
];
var _COL_SYNONYMS={
  name:['نام مرکز','نام','name','hospital','مرکز','center','عنوان'],
  province:['استان','province','prov','شهر','region','شهرستان'],
  type:['نوع','نوع مرکز','type','category','دسته'],
  potential:['پتانسیل','potential','pot','اولویت','priority'],
  lead:['سرنخ','lead','نوع مشتری','وضعیت','status'],
  owner:['مسئول','owner','کارشناس','assigned','نماینده'],
  tags:['برچسب','tags','tag','label','دسته‌بندی','کلمه کلیدی'],
  address:['آدرس','address','addr','نشانی'],
  phone:['تلفن','phone','tel','موبایل','شماره','تماس','mobile'],
};

function _autoDetectCols(headers){
  var map={};
  headers.forEach(function(h,i){
    var hn=fNorm(h);
    Object.keys(_COL_SYNONYMS).forEach(function(k){
      if(map[k]!=null)return;
      if(_COL_SYNONYMS[k].some(function(s){
        var sn=fNorm(s);
        return sn===hn||hn.indexOf(sn)>=0||sn.indexOf(hn)>=0;
      }))map[k]=i;
    });
  });
  return map;
}

function showColumnMapping(headers,dataRows){
  var area=document.getElementById('dbPreviewArea');
  if(!area)return;
  var detected=_autoDetectCols(headers);
  var sampleRows=dataRows.slice(0,3);

  var selStyle='width:100%;padding:5px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;box-sizing:border-box';
  var optionsHtml='<option value="">— انتخاب نکن —</option>'
    +headers.map(function(h,i){return'<option value="'+i+'">'+esc(h)+'</option>';}).join('');

  var html='<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px">🗂 تطابق ستون‌ها</div>'
    +'<div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">'
    +'فایل شما <strong>'+headers.length+'</strong> ستون دارد. برای هر فیلد، ستون معادل را انتخاب کنید.'
    +'<br>ستون‌های سبز به صورت خودکار شناسایی شدند. در صورت نیاز اصلاح کنید.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  _COL_FIELDS.forEach(function(f){
    var detected_i=detected[f.key];
    var hasDet=detected_i!=null;
    html+='<div style="background:'+(hasDet?'#f0fdf4':'#fff')+';border:1px solid '+(hasDet?'#86efac':'#e2e8f0')+';border-radius:6px;padding:8px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:4px">'
      +(f.req?'<span style="color:#ef4444">*</span> ':'')+f.label
      +(hasDet?'<span style="background:#bbf7d0;color:#166534;font-size:9px;padding:1px 5px;border-radius:8px;margin-right:4px">⚡ شناسایی شد</span>':'')
      +'</div>'
      +'<select id="colmap_'+f.key+'" style="'+selStyle+'">'
      +'<option value="">— انتخاب نکن —</option>'
      +headers.map(function(h,i){
        return'<option value="'+i+'"'+(detected_i===i?' selected':'')+'>'+esc(h)+'</option>';
      }).join('')
      +'</select>'
      +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">'+f.hint+'</div>'
      +'</div>';
  });

  html+='</div></div>';

  // نمونه داده
  html+='<div style="font-size:11px;font-weight:600;color:var(--text-primary);margin-bottom:5px">نمونه ۳ ردیف اول:</div>'
    +'<div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;max-height:120px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:10px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +headers.map(function(h){return'<th style="padding:4px 7px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--border)">'+esc(h)+'</th>';}).join('')
    +'</tr></thead><tbody>'
    +sampleRows.map(function(row){
      return'<tr>'+headers.map(function(_,i){
        return'<td style="padding:3px 7px;border-bottom:1px solid #f1f5f9;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+esc((row[i]||'').toString())+'</td>';
      }).join('')+'</tr>';
    }).join('')
    +'</tbody></table></div>';

  html+='<button onclick="_applyColMapping()" style="margin-top:10px;background:#0ea5e9;color:var(--text-primary);border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600">✅ تأیید نگاشت و پیش‌نمایش</button>';

  area.innerHTML=html;
}

// ── Step 3: اعمال نگاشت و پیش‌نمایش ──────────────────────────────
function _applyColMapping(){
  var colMap={};
  _COL_FIELDS.forEach(function(f){
    var sel=document.getElementById('colmap_'+f.key);
    if(sel&&sel.value!=='')colMap[f.key]=parseInt(sel.value);
  });
  if(colMap.name==null||colMap.province==null){
    showToast('⚠ ستون «نام مرکز» و «استان» الزامی هستند');return;
  }

  var processed=_dbRawRows.map(function(row,idx){
    var name=(row[colMap.name]||'').toString().trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    var provRaw=(row[colMap.province]||'').toString().trim();
    var provId=provRaw?resolveProvince(provRaw):null;
    var potential=colMap.potential!=null?parseInt(row[colMap.potential])||2:2;
    if(potential<1||potential>4)potential=2;
    var type=colMap.type!=null?(row[colMap.type]||'').toString().trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'):'';
    var lead=colMap.lead!=null?(row[colMap.lead]||'').toString().trim().replace(/[ي]/g,'ی')||'سرنخ':'سرنخ';
    var owner=colMap.owner!=null?(row[colMap.owner]||'').toString().trim():'';
    var tagsRaw=colMap.tags!=null?(row[colMap.tags]||'').toString().trim():'';
    var address=colMap.address!=null?(row[colMap.address]||'').toString().trim():'';
    var phoneRaw=colMap.phone!=null?(row[colMap.phone]||'').toString().trim():'';
    var phones=phoneRaw?phoneRaw.split(/[,،\/\n]/).map(function(p){return p.trim();}).filter(Boolean):[];
    return{name:name,provId:provId,provRaw:provRaw,potential:potential,type:type,lead:lead,owner:owner,tagsRaw:tagsRaw,address:address,phones:phones,row:idx+1};
  });

  var valid=processed.filter(function(r){return r.name&&r.provId;});
  var noName=processed.filter(function(r){return !r.name;}).length;
  var noProv=processed.filter(function(r){return r.name&&!r.provId;}).length;
  var unknownProvs=[];
  processed.forEach(function(r){if(r.name&&r.provRaw&&!r.provId&&unknownProvs.indexOf(r.provRaw)<0)unknownProvs.push(r.provRaw);});

  var byProv={};valid.forEach(function(r){if(!byProv[r.provId])byProv[r.provId]=0;byProv[r.provId]++;});
  var provBreakdown=Object.keys(byProv).map(function(pid){
    var pv=getAllProvinces().find(function(p){return p.id===pid;});
    return(pv?pv.name:pid)+': '+byProv[pid];
  }).join('  ·  ');

  var area=document.getElementById('dbPreviewArea');
  var html='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html+='<span style="background:#bbf7d0;color:#166534;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">✅ '+valid.length+' مرکز معتبر</span>';
  if(noProv)html+='<span style="background:#fef3c7;color:#854d0e;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">⚠ '+noProv+' استان ناشناخته</span>';
  if(noName)html+='<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">'+noName+' بدون نام</span>';
  html+='<button onclick="showColumnMapping(_dbHeaders,_dbRawRows)" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border-input);border-radius:9px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit">← اصلاح نگاشت</button>';
  html+='</div>';

  if(unknownProvs.length){
    html+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:5px;padding:8px;font-size:11px;margin-bottom:8px">'
      +'<strong>⚠ استان‌های شناسایی‌نشده:</strong> '+unknownProvs.slice(0,10).map(esc).join('، ')+(unknownProvs.length>10?'...':'')+'</div>';
  }

  if(Object.keys(byProv).length){
    html+='<div style="font-size:11px;color:var(--text-secondary);background:var(--bg-raised);border-radius:5px;padding:8px;margin-bottom:10px;line-height:1.8">'
      +'<strong>توزیع استانی:</strong><br>'+provBreakdown+'</div>';
  }

  html+='<div style="overflow-x:auto;max-height:200px;border:1px solid var(--border);border-radius:5px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:5px 8px;text-align:right">استان</th>'
    +'<th style="padding:5px 8px;text-align:right">نام مرکز</th>'
    +'<th style="padding:5px 8px;text-align:right">نوع</th>'
    +'<th style="padding:5px 8px;text-align:right">پتانسیل</th>'
    +'<th style="padding:5px 8px;text-align:right">لید</th>'
    +'</tr></thead><tbody>';
  valid.slice(0,15).forEach(function(r){
    var pv=getAllProvinces().find(function(p){return p.id===r.provId;});
    html+='<tr style="border-bottom:1px solid #f1f5f9">'
      +'<td style="padding:4px 8px;color:#0369a1;font-weight:600">'+(pv?pv.name:r.provId)+'</td>'
      +'<td style="padding:4px 8px">'+esc(r.name)+'</td>'
      +'<td style="padding:4px 8px;color:var(--text-muted)">'+esc(r.type)+'</td>'
      +'<td style="padding:4px 8px;text-align:center">'+r.potential+'</td>'
      +'<td style="padding:4px 8px">'+esc(r.lead)+'</td>'
      +'</tr>';
  });
  if(valid.length>15)html+='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:6px;font-size:10px">... و '+(valid.length-15)+' مرکز دیگر</td></tr>';
  html+='</tbody></table></div>';

  if(valid.length>0){
    html+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px;margin-top:10px;font-size:12px">'
      +'<strong style="color:#92400e">⚠ توجه:</strong> <span style="color:#92400e">با جایگزین کردن دیتابیس، لیست مراکز فعلی پاک می‌شود. داده‌های CRM حفظ می‌شوند.</span></div>';
  }

  area.innerHTML=html;
  _dbImportData=valid;
  var btn=document.getElementById('dbDoBtn');
  if(btn&&valid.length>0){btn.style.display='';btn.textContent='💾 جایگزین کردن '+valid.length+' مرکز در دیتابیس';}
}

function doDBImport(){
  if(!_dbImportData||!_dbImportData.length){showToast('داده‌ای برای ایمپورت وجود ندارد');return;}
  var btn=document.getElementById('dbDoBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ در حال ذخیره...';}

  var rowCounters={};
  var centers=_dbImportData.map(function(r){
    if(!rowCounters[r.provId])rowCounters[r.provId]=0;
    rowCounters[r.provId]++;
    var id=r.provId==='tehran'?'c_'+rowCounters[r.provId]:r.provId+'||'+rowCounters[r.provId];
    return{id:id,row:rowCounters[r.provId],name:r.name,province_id:r.provId,
      type:r.type,potential:r.potential,lead:r.lead,owner:r.owner,
      _sourceIdx:_dbImportData.indexOf(r)};
  });

  saveMasterCenters(centers).then(function(ok){
    if(!ok){showToast('❌ خطا در ذخیره‌سازی.');if(btn){btn.disabled=false;btn.textContent='💾 جایگزین کردن دیتابیس';}return;}

    // اعمال آدرس، تلفن، برچسب از ایمپورت به DB
    _applyImportMeta(centers,_dbImportData);

    return loadMasterCenters().then(function(){
    _PC_CACHE=null; // refresh after CENTERS loaded

      _typeFilterBuilt=false;clearPCCache();_ALL_PROVS=null;
      rebuildFilters();buildTypeFilter();
      closeModal('dbManagerModal');
      renderDashboard();renderBanner();renderTable();checkEmptyDB();
      showToast('✅ دیتابیس مراکز با '+centers.length+' مرکز آپدیت شد',4000);
    });
  }).catch(function(err){
    showToast('❌ خطا در آپدیت دیتابیس: '+(err&&err.message?err.message:''));
    if(btn){btn.disabled=false;btn.textContent='💾 جایگزین کردن دیتابیس';}
  });
}

function _applyImportMeta(centers,sourceData){
  // اعمال آدرس، تلفن، برچسب برای هر مرکز ایمپورت‌شده
  centers.forEach(function(c){
    var src=sourceData[c._sourceIdx];if(!src)return;
    var rtype=c.province_id==='tehran'?'center':'pc';
    var k=recK(rtype,c.id);

    // آدرس
    if(src.address){
      if(!DB.edits[k])DB.edits[k]={};
      DB.edits[k].address=src.address;
    }
    // تلفن
    if(src.phones&&src.phones.length){
      if(!DB.edits[k])DB.edits[k]={};
      DB.edits[k].phones=src.phones;
    }
    // برچسب‌ها
    if(src.tagsRaw){
      var tagNames=src.tagsRaw.split(/[,،]/).map(function(t){return t.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');}).filter(Boolean);
      var tagIds=tagNames.map(function(tn){
        var existing=(DB.tags||[]).find(function(t){return t.name===tn;});
        if(existing)return existing.id;
        // برچسب جدید بسازیم
        if(!DB.tags)DB.tags=[];
        var colors=['#0ea5e9','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#ec4899'];
        var newTag={id:'tag_'+Date.now()+'_'+Math.random().toString(36).slice(2),name:tn,color:colors[DB.tags.length%colors.length]};
        DB.tags.push(newTag);
        return newTag.id;
      });
      if(!DB.rTags)DB.rTags={};
      DB.rTags[k]=tagIds;
    }
  });
  saveDB();
}

function confirmClearMasterDB(){
  if(!confirm('⚠ آیا مطمئنید؟ کل دیتابیس مراکز پاک می‌شود.\nداده‌های CRM (وضعیت، یادداشت‌ها) حفظ می‌شوند.'))return;
  saveMasterCenters([]).then(function(){
    CENTERS.length=0;Object.keys(PC_RAW).forEach(function(k){delete PC_RAW[k];});
    clearPCCache();_ALL_PROVS=null;_typeFilterBuilt=false;
    closeModal('dbManagerModal');
    renderDashboard();checkEmptyDB();
    showToast('دیتابیس مراکز پاک شد');
  });
}


function openImport(){
  var body='<div class="imp-info-box"><strong>راهنمای فرمت:</strong><br>'
    +'ستون‌های پیشنهادی: <span style="color:#0369a1">نام مرکز</span> (الزامی) • <span style="color:#0369a1">استان</span> (اگر ندارید، از انتخاب زیر استفاده کنید) • پتانسیل • نوع • سرنخ • مسئول<br>'
    +'<a href="#" onclick="downloadImportTemplate();return false" style="color:#0ea5e9;text-decoration:underline">📥 دانلود قالب نمونه</a></div>'
    +'<div class="m-2col" style="margin-bottom:10px">'
    +'<div><label>استان پیش‌فرض (اگر ستون استان در فایل نیست)</label>'
    +'<select id="impProv" style="width:100%;padding:7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px">'
    +'<option value="">— از ستون استان در فایل استفاده شود —</option>'
    +getAllProvinces().map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('')
    +'</select></div>'
    +'<div><label>فایل اکسل / CSV</label>'
    +'<input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="width:100%;padding:6px;border:1px dashed #cbd5e1;border-radius:5px;font-size:12px" onchange="handleImportFile(event)"></div>'
    +'</div>'
    +'<div id="impPreviewArea"></div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'importModal\')">بستن</button>'
    +'<button class="btn-primary" id="impDoBtn" style="display:none" onclick="doImport()">✅ وارد کردن</button>';
  openModal('importModal','📥 ایمپورت مراکز از اکسل',body,foot,{lg:true});
}

function downloadImportTemplate(){
  var rows=[
    ['نام مرکز','استان','پتانسیل','نوع','سرنخ','مسئول'],
    ['بیمارستان نمونه تهران','تهران','1','بیمارستان','مشتری','Sarah.hosseini'],
    ['کلینیک نمونه اصفهان','اصفهان','2','کلینیک','لید','Reyhane.kashisaz'],
    ['مرکز تصویربرداری شیراز','فارس','3','مرکز تصویربرداری','سرنخ',''],
  ];
  var csv=rows.map(function(r){return r.map(function(c){return'"'+c+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_import_template.csv';a.click();
  showToast('قالب نمونه دانلود شد');
}

function handleImportFile(ev){
  var file=ev.target.files[0];if(!file)return;
  var area=document.getElementById('impPreviewArea');
  area.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">در حال پردازش...</div>';
  if(file.name.toLowerCase().endsWith('.csv')){
    var reader=new FileReader();
    reader.onload=function(e){
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
      var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
      var rows=lines.map(function(l){
        var cells=[];var inQ=false;var cur='';
        for(var i=0;i<l.length;i++){var ch=l[i];
          if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cells.push(cur.trim());cur='';}
          else cur+=ch;}
        cells.push(cur.trim());
        return cells.map(function(c){return c.replace(/^"|"$/g,'').trim();});
      });
      processImportRows(rows);
    };
    reader.readAsText(file,'UTF-8');return;
  }
  if(typeof XLSX==='undefined'){
    var script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=function(){readXLSX(file);};
    script.onerror=function(){area.innerHTML='<div style="color:#dc2626;padding:10px">⚠ SheetJS بارگذاری نشد. از فرمت CSV استفاده کنید.</div>';};
    document.head.appendChild(script);
  }else{readXLSX(file);}
}

function readXLSX(file){
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      processImportRows(rows);
    }catch(err){
      document.getElementById('impPreviewArea').innerHTML='<div style="color:#dc2626;padding:10px">❌ خطا: '+esc(err.message)+'</div>';
    }
  };
  reader.readAsArrayBuffer(file);
}

// نگاشت نام استان به ID (fuzzy)
function resolveProvince(name){
  if(!name||!name.trim())return null;
  var n=name.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
  var provs=getAllProvinces();
  // exact match
  var ex=provs.find(function(p){return p.name===n;});if(ex)return ex.id;
  // partial match
  var pm=provs.find(function(p){return p.name.indexOf(n)>=0||n.indexOf(p.name)>=0;});if(pm)return pm.id;
  // fuzzy match
  var fm=provs.find(function(p){return fNorm(p.name).indexOf(fNorm(n))>=0||fNorm(n).indexOf(fNorm(p.name))>=0;});
  return fm?fm.id:null;
}

function processImportRows(rows){
  if(!rows||rows.length<2){
    document.getElementById('impPreviewArea').innerHTML='<div style="color:#dc2626;padding:10px">فایل خالی است یا فرمت نادرست دارد</div>';
    return;
  }
  var headers=rows[0].map(function(h){return(h||'').toString().trim();});
  _importData=rows.slice(1).filter(function(r){return r.some(function(c){return c&&c.toString().trim();});});
  _importCols=headers;

  // auto-detect column mapping
  var autoMap={};
  var maps={
    name:['نام مرکز','نام','name','center','مرکز','hospital','بیمارستان'],
    province:['استان','province','prov','شهرستان','city','شهر'],
    potential:['پتانسیل','potential','pot','اولویت'],
    type:['نوع','type','نوع مرکز'],
    lead:['سرنخ','lead','نوع مشتری','مشتری'],
    owner:['مسئول','owner','کارشناس','نام کارشناس']
  };
  headers.forEach(function(h,i){
    var hl=fNorm(h);
    Object.keys(maps).forEach(function(k){
      if(autoMap[k]===undefined&&maps[k].some(function(kw){return fNorm(kw)===hl||hl.indexOf(fNorm(kw))>=0||fNorm(kw).indexOf(hl)>=0;}))
        autoMap[k]=i;
    });
  });

  // پیش‌پردازش برای resolve استان هر ردیف
  var defaultProvId=document.getElementById('impProv').value;
  var provColIdx=autoMap.province!=null?autoMap.province:-1;

  var processed=_importData.map(function(row){
    var name=(row[autoMap.name!=null?autoMap.name:0]||'').toString().trim();
    var provRaw=provColIdx>=0?(row[provColIdx]||'').toString().trim():'';
    var provId=null;
    if(provRaw){provId=resolveProvince(provRaw);}
    if(!provId&&defaultProvId){provId=defaultProvId;}
    var provName=provId?(getAllProvinces().find(function(p){return p.id===provId;})||{}).name||'؟':'؟';
    return{name:name,provId:provId,provName:provName,provRaw:provRaw,row:row};
  });

  var validCount=processed.filter(function(r){return r.name&&r.provId;}).length;
  var noProvCount=processed.filter(function(r){return r.name&&!r.provId;}).length;
  var emptyCount=processed.filter(function(r){return !r.name;}).length;
  var unknownProvs=[...new Set(processed.filter(function(r){return r.provRaw&&!r.provId;}).map(function(r){return r.provRaw;}))];

  var preview='<div style="margin-top:10px">';
  preview+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  preview+='<span class="imp-badge imp-ok">✅ '+validCount+' مرکز آماده ایمپورت</span>';
  if(noProvCount)preview+='<span class="imp-badge imp-warn">⚠ '+noProvCount+' بدون استان</span>';
  if(emptyCount)preview+='<span class="imp-badge" style="background:#fee2e2;color:#991b1b">'+emptyCount+' بدون نام (رد می‌شوند)</span>';
  preview+='</div>';

  if(unknownProvs.length){
    preview+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:5px;padding:8px;font-size:11px;margin-bottom:8px">';
    preview+='<strong>⚠ استان‌های شناسایی‌نشده:</strong> '+unknownProvs.map(esc).join('، ')+'<br>';
    preview+='<small>این مراکز ایمپورت نمی‌شوند مگر استان پیش‌فرض انتخاب کنید.</small></div>';
  }

  // نگاشت ستون‌ها
  preview+='<details style="margin-bottom:8px"><summary style="font-size:12px;font-weight:600;cursor:pointer;color:#0369a1">⚙ تنظیم ستون‌ها ('+headers.length+' ستون شناسایی شد)</summary>';
  preview+='<div class="imp-col-map" style="margin-top:8px">';
  var fields=[
    {k:'name',l:'نام مرکز *'},
    {k:'province',l:'استان'},
    {k:'potential',l:'پتانسیل'},
    {k:'type',l:'نوع'},
    {k:'lead',l:'سرنخ'},
    {k:'owner',l:'مسئول'}
  ];
  fields.forEach(function(f){
    preview+='<select id="impMap_'+f.k+'" onchange="reProcessImport()" style="font-size:11px">'
      +'<option value="-1">— نادیده —</option>'
      +headers.map(function(h,i){return'<option value="'+i+'"'+(autoMap[f.k]===i?' selected':'')+'>'+esc(h)+'</option>';}).join('')
      +'</select><label style="font-size:11px;color:var(--text-secondary);padding:5px 0;align-self:center">'+f.l+'</label>';
  });
  preview+='</div></details>';

  // پیش‌نمایش جدول
  preview+='<div class="imp-preview"><table><thead><tr>'
    +'<th style="background:#dbeafe;color:#1e40af">استان تشخیص‌داده‌شده</th>'
    +headers.map(function(h){return'<th>'+esc(h)+'</th>';}).join('')
    +'</tr></thead><tbody>';
  processed.slice(0,10).forEach(function(p){
    var ok=p.provId&&p.name;
    preview+='<tr style="'+(ok?'':'opacity:.5')+'">'
      +'<td style="font-weight:600;color:'+(p.provId?'#16a34a':'#dc2626')+';background:'+(p.provId?'#f0fdf4':'#fef2f2')+'">'+esc(p.provId?p.provName:'شناسایی‌نشده')+'</td>'
      +headers.map(function(_,i){return'<td>'+esc((p.row[i]||'').toString())+'</td>';}).join('')
      +'</tr>';
  });
  if(processed.length>10){preview+='<tr><td colspan="'+(headers.length+1)+'" style="text-align:center;color:var(--text-muted);font-size:10px">... و '+(processed.length-10)+' ردیف دیگر</td></tr>';}
  preview+='</tbody></table></div>';
  preview+='<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer">'
    +'<input type="checkbox" id="impReplaceHard"> جایگزین مراکز پیش‌فرض برای استان‌های ایمپورت‌شده</label>';
  preview+='</div>';

  document.getElementById('impPreviewArea').innerHTML=preview;
  // ذخیره processed برای doImport
  window._impProcessed=processed;
  var btn=document.getElementById('impDoBtn');
  if(btn){btn.style.display=validCount>0?'':'none';btn.textContent='✅ وارد کردن '+validCount+' مرکز';}
}

function reProcessImport(){
  // بازخوانی با نگاشت ستون‌های جدید
  if(!_importData)return;
  var getMap=function(k){var el=document.getElementById('impMap_'+k);return el?parseInt(el.value):-1;};
  var newAutoMap={name:getMap('name'),province:getMap('province'),potential:getMap('potential'),type:getMap('type'),lead:getMap('lead'),owner:getMap('owner')};
  var defaultProvId=document.getElementById('impProv').value;
  var processed=_importData.map(function(row){
    var name=(newAutoMap.name>=0?(row[newAutoMap.name]||''):'').toString().trim();
    var provRaw=newAutoMap.province>=0?(row[newAutoMap.province]||'').toString().trim():'';
    var provId=provRaw?resolveProvince(provRaw):null;
    if(!provId&&defaultProvId)provId=defaultProvId;
    var provName=provId?(getAllProvinces().find(function(p){return p.id===provId;})||{}).name||'؟':'؟';
    return{name:name,provId:provId,provName:provName,row:row,_map:newAutoMap};
  });
  window._impProcessed=processed;
  var validCount=processed.filter(function(r){return r.name&&r.provId;}).length;
  var btn=document.getElementById('impDoBtn');
  if(btn){btn.style.display=validCount>0?'':'none';btn.textContent='✅ وارد کردن '+validCount+' مرکز';}
  // آپدیت badge
  var badges=document.querySelector('.imp-preview');
  if(badges)return; // table already exists; just update button
}

function doImport(){
  var processed=window._impProcessed;
  if(!processed||!processed.length){showToast('فایل انتخاب نشده');return;}
  var getMap=function(k){var el=document.getElementById('impMap_'+k);return el?parseInt(el.value):-1;};
  var potCol=getMap('potential'),typeCol=getMap('type'),leadCol=getMap('lead'),ownerCol=getMap('owner');
  var replaceHard=document.getElementById('impReplaceHard');
  if(!DB.extra)DB.extra=[];if(!DB.hiddenProvs)DB.hiddenProvs={};
  var imported=0;var skipped=0;var byProv={};
  processed.forEach(function(p){
    if(!p.name||!p.provId)return;
    var existing=getProvCenters(p.provId);
    var dup=existing.find(function(c){return fNorm(c.name)===fNorm(p.name);});if(dup){skipped++;return;}
    if(!byProv[p.provId])byProv[p.provId]={maxRow:Math.max(0,...existing.map(function(c){return c.row||0;}))};
    byProv[p.provId].maxRow++;
    var rtype=getProvType(p.provId);
    var id=rtype+'_imp_'+Date.now()+'_'+byProv[p.provId].maxRow;
    var pot=potCol>=0?parseInt((p.row[potCol]||'3').toString())||3:3;if(pot<1||pot>4)pot=3;
    var type=typeCol>=0?(p.row[typeCol]||'').toString().trim()||'سایر':'سایر';
    var lead=leadCol>=0?(p.row[leadCol]||'').toString().trim()||'سرنخ':'سرنخ';
    var owner=ownerCol>=0?(p.row[ownerCol]||'').toString().trim():'';
    DB.extra.push({id:id,row:byProv[p.provId].maxRow,name:p.name,potential:pot,type:type,lead:lead,province_id:p.provId,owner:owner||currentUser});
    if(owner){var ek=rtype+'_'+id;if(!DB.edits[ek])DB.edits[ek]={};DB.edits[ek].owner=owner;}
    imported++;
  });
  if(replaceHard&&replaceHard.checked){
    Object.keys(byProv).forEach(function(pid){DB.hiddenProvs[pid]=true;});
  }
  saveDB();closeModal('importModal');
  var provNames=[...new Set(processed.filter(function(p){return p.provId;}).map(function(p){return p.provName;}))];
  showToast(imported+' مرکز در '+provNames.length+' استان ایمپورت شد'+(skipped?' ('+skipped+' تکراری رد شد)':'')+' ✅',4000);
  if(_currentProvId&&byProv[_currentProvId])renderProvTable();
  renderDashboard();
}

// ═══════════════════════════════════════════════════════════


// ════════════════════════ ALL CENTERS VIEW ══════════════════
function setProvView(mode){
  _provView=mode;
  ['grid','list','kanban'].forEach(function(m){
    var b=document.getElementById('viewProvBtn');var bl=document.getElementById('viewAllListBtn');var bk=document.getElementById('viewAllKbBtn');
    if(b)b.classList.toggle('active',mode==='grid');
    if(bl)bl.classList.toggle('active',mode==='list');
    if(bk)bk.classList.toggle('active',mode==='kanban');
  });
  if(mode==='grid')renderProvList();
  else renderAllCenters(mode);
}

function renderAllCenters(viewMode){
  var pg=document.getElementById('provGrid');if(pg)pg.style.display='none';
  var tbl=document.getElementById('mainTable');
  var kb=document.getElementById('kanbanView');
  var cv=document.getElementById('cardView');
  // filter controls
  ['srch','fPot','fStatus','fLead','fOwner','fType','fTag'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
  rebuildFilters();
  // collect all centers
  var q=(document.getElementById('srch')||{}).value||'';
  var fp=(document.getElementById('fPot')||{}).value||'';
  var fs=(document.getElementById('fStatus')||{}).value||'';
  var fl=(document.getElementById('fLead')||{}).value||'';
  var fo=(document.getElementById('fOwner')||{}).value||'';
  var ftp=document.getElementById('fType')?document.getElementById('fType').value:'';
  var _ftgEl=document.getElementById('fTag');var ftg=_ftgEl&&_ftgEl.value?parseInt(_ftgEl.value):0;
  var effectiveOwner=fo||_globalOwnerFilter||(_isExpert()?currentUser:'');
  var allRows=[];
  getAllProvinces().forEach(function(p){
    var tp=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(tp,c.id);
      if(q&&!fMatch(q,c.name))return;
      if(fp&&String(e.potential!==undefined?e.potential:c.potential)!==fp)return;
      var st=e.status||'بدون تماس';if(fs&&st!==fs)return;
      var lead=(e.lead||c.lead||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim();if(fl&&lead!==fl)return;
      var owner=e.owner||c.owner||'';if(effectiveOwner&&owner!==effectiveOwner)return;
      if(ftp){var ctype=e.type||c.type||'';if(ctype.indexOf(ftp)<0)return;}
      if(ftg){var tgs=rTags(tp,c.id);if(tgs.indexOf(ftg)===-1)return;}
      allRows.push({r:c,rtype:tp,prov:p.name});
    });
  });
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+allRows.length+' مرکز از همه استان‌ها';

  if(viewMode==='kanban'){
    if(tbl)tbl.style.display='none';if(cv)cv.style.display='none';
    if(kb)kb.style.display='';
    var groups={};STATUS_LIST.forEach(function(s){groups[s]=[];});
    allRows.forEach(function(item){var st=getE(item.rtype,item.r.id).status||'بدون تماس';(groups[st]=groups[st]||[]).push(item);});
    kb.innerHTML='<div class="kanban-board">'+STATUS_LIST.map(function(st,idx){
      var rows=groups[st]||[];
      return'<div class="kanban-col"><div class="kanban-col-head '+H_CLS[idx]+'">'+st+' <span class="kanban-cnt">'+rows.length+'</span></div>'
        +'<div class="kanban-col-body">'+rows.map(function(item){
          var e=getE(item.rtype,item.r.id);var fd=e.followupDate||'';
          return'<div class="kanban-card" data-rt="'+item.rtype+'" data-rid="'+item.r.id+'" onclick="openCenterModal(this.dataset.rt,this.dataset.rid)">'
            +'<div class="kanban-card-name">'+esc(item.r.name)+'</div>'
            +'<div class="kanban-card-meta">'
            +'<span style="font-size:9px;color:#94a3b8">'+esc(item.prov)+'</span>'
            +'<span class="pot-badge pot-'+(e.potential||item.r.potential)+'">'+(e.potential||item.r.potential)+'</span>'
            +(fd?'<span class="kc-date">'+fd+'</span>':'')
            +'</div></div>';
        }).join('')+'</div></div>';
    }).join('')+'</div>';
    return;
  }
  // list view
  if(kb)kb.style.display='none';if(cv)cv.style.display='none';
  if(tbl)tbl.style.display='';
  var today=todayStr();
  var head=document.getElementById('tableHead');
  var body=document.getElementById('tableBody');
  head.innerHTML='<tr><th>#</th><th>مرکز</th><th>استان</th><th>پتانسیل</th><th>نوع</th><th>سرنخ</th><th>مسئول</th><th>وضعیت</th><th>پیگیری</th><th>یادداشت</th></tr>';
  // DOM-based row building (no string escaping issues)
  body.innerHTML='';
  if(!allRows.length){
    var emptyR=document.createElement('tr');emptyR.innerHTML='<td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">نتیجه‌ای یافت نشد</td>';
    body.appendChild(emptyR);
  }else{allRows.forEach(function(item,idx){
    var r=item.r;var rtype=item.rtype;var e=getE(rtype,r.id);
    var st=e.status||'بدون تماس';var sc=stCls(st);
    var lead=e.lead||r.lead||'سرنخ';var lc=lCls(lead);
    var pot=e.potential!==undefined?e.potential:r.potential;
    var fd=e.followupDate||'';var today2=todayStr();
    var fdCls='fd-inp'+(fd&&fd<today2?' ov':fd&&fd===today2?' today':'');
    var notes=DB.notes[recK(rtype,r.id)]||[];
    var ov=isOverdue(rtype,r.id);var stall=isStalled(rtype,r.id);
    var tr=document.createElement('tr');
    tr.setAttribute('data-rowid',r.id);
    if(stall)tr.style.background='#fef2f2';else if(ov)tr.style.background='#fffbeb';
    // cells
    var cells=[
      '<td>'+(idx+1)+'</td>',
      '<td>'+(stall?'<span class="risk-badge">🔴</span>':ov?'<span class="risk-badge">🟠</span>':'')
        +'<button class="ctr-link">'+esc(r.name)+'</button>'+renderTagCell(rtype,r.id)+'</td>',
      '<td style="font-size:10px;color:var(--text-muted)">'+esc(item.prov)+'</td>',
      '<td><span class="pot-badge pot-'+pot+'">'+pot+'</span></td>',
      '<td><span style="font-size:11px">'+esc(e.type||r.type||'')+'</span></td>',
      '<td><span class="'+lc+'" style="padding:2px 6px;border-radius:4px;font-size:11px">'+lead+'</span></td>',
      '<td style="font-size:11px">'+esc(USERS[e.owner||r.owner||'']||e.owner||r.owner||'—')+'</td>',
      '<td><select class="st-sel '+sc+'">'+STATUS_LIST.map(function(s,i){return'<option class="'+STATUS_CLS[i]+'"'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select></td>',
      '<td><input type="text" class="'+fdCls+'" value="'+fd+'" readonly style="cursor:pointer;width:98px"></td>',
      '<td><button class="note-btn'+(notes.length?' has':'')+'">📝'+(notes.length?' '+notes.length:'')+'</button></td>'
    ];
    tr.innerHTML=cells.join('');
    // event listeners via DOM
    var nameBtn=tr.querySelector('.ctr-link');
    if(nameBtn)(function(rt,rid){nameBtn.addEventListener('click',function(){openCenterModal(rt,rid);});})(rtype,r.id);
    var stSel=tr.querySelector('.st-sel');
    if(stSel)(function(rt,rid){stSel.addEventListener('change',function(){onStatus(rt,rid,stSel);});})(rtype,r.id);
    var fdInp=tr.querySelector('.fd-inp');
    if(fdInp)(function(rt,rid,inp){inp.addEventListener('click',function(){openJDP(inp,function(v){setE(rt,rid,'followupDate',v);inp.value=v;renderBanner();});});})(rtype,r.id,fdInp);
    var noteBtn=tr.querySelector('.note-btn');
    if(noteBtn)(function(rt,rid,nm){noteBtn.addEventListener('click',function(){openNotes(rt,rid,nm);});})(rtype,r.id,r.name);
    body.appendChild(tr);
  });}
  //empty marker'<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">نتیجه‌ای یافت نشد</td></tr>';
}
// ═══════════════════════════════════════════════════════════
// ════════════════════════ CLEAR ALL DATA ════════════════════
function clearAllData(){
  openModal('clearModal','🗑 پاک‌سازی داده‌ها',
    '<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:7px;padding:12px;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:8px">⚠ این عملیات برگشت‌پذیر نیست!</div>'
    +'<div style="font-size:12px;color:#991b1b">موارد زیر پاک می‌شوند:<br>'
    +'• وضعیت، سرنخ، پتانسیل، مسئول همه مراکز<br>'
    +'• یادداشت‌ها<br>'
    +'• مراکز اضافه‌شده دستی<br>'
    +'• برنامه‌های هفته<br>'
    +'• رویدادها و چک‌لیست‌ها<br>'
    +'• تنظیمات پنهان/نمایش داده‌های پیش‌فرض</div>'
    +'<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid #fca5a5">برچسب‌ها و هفته‌های تعریف‌شده حفظ می‌شوند</div>'
    +'</div>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearEdits" checked> وضعیت‌ها، سرنخ، مسئول، پتانسیل</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearNotes" checked> یادداشت‌ها</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearExtra" checked> مراکز اضافه‌شده دستی / ایمپورت‌شده</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearWeeks" checked> برنامه‌های هفته (مراکز در هفته‌ها)</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">'
    +'<input type="checkbox" id="clearEvents" checked> رویدادها و چک‌لیست‌ها</label>',
    '<button class="btn-secondary" onclick="closeModal(\'clearModal\')">انصراف</button>'
    +'<button class="btn-danger" onclick="doCleanAll()">🗑 پاک کردن</button>'
  );
}
function doCleanAll(){
  var cleared=[];
  if(document.getElementById('clearEdits').checked){DB.edits={};cleared.push('وضعیت‌ها');}
  if(document.getElementById('clearNotes').checked){DB.notes={};cleared.push('یادداشت‌ها');}
  if(document.getElementById('clearExtra').checked){DB.extra=[];DB.hiddenProvs={};cleared.push('مراکز اضافه‌شده');}
  if(document.getElementById('clearWeeks').checked){DB.weekEntries={};cleared.push('برنامه‌های هفته');}
  if(document.getElementById('clearEvents').checked){DB.events=[];DB.checklist={};cleared.push('رویدادها');}
  saveDB();
  closeModal('clearModal');
  _globalOwnerFilter='';_bannerFilterUser='';
  renderDashboard();renderBanner();renderTable();
  showToast('پاک‌سازی انجام شد: '+cleared.join('، ')+' ✅',4000);
}
// ═══════════════════════════════════════════════════════════

/* ═══ public/js/manager.js ═══ */
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

  var body='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">'
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
    +'<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #7dd3fc;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="var n=wpDeduplicateEntries();if(n>0){saveDBSync();renderWeekPlan();showToast(\'✅ \'+n+\' ورودی تکراری هفته حذف شد\',3000);}else{showToast(\'✅ هیچ تکراری یافت نشد\');}">📋 حذف تکراری‌های هفته</button>'
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
  // ── Onboarding tutorial section
  var _obIsDisabled = DB.settings&&DB.settings.onboardingDisabled&&DB.settings.onboardingDisabled[currentUser];
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:3px">🎓 آموزش راهنما</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">نمایش راهنمای ۷ روزه برای کاربران تازه</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +(_obIsDisabled
      ? '<span style="font-size:11px;color:var(--text-muted);background:var(--bg-raised);border-radius:4px;padding:3px 8px">غیرفعال</span>'
        +'<button onclick="_reEnableOnboarding();closeModal(\'settingsModal\')" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">فعال‌سازی مجدد</button>'
      : '<span style="font-size:11px;color:#16a34a;background:#dcfce7;border-radius:4px;padding:3px 8px">فعال</span>'
        +'<button onclick="_dismissOnboarding(true);closeModal(\'settingsModal\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">غیرفعال‌کردن</button>')
    +'</div>'
    +'</div></div>';
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
  // compute stats per member
  var stats={};
  members.forEach(function(m){
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

  members.filter(function(m){return m.id!=='guest';}).forEach(function(m,i){
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
      html+='<div style="border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:11px">'
        +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+clr+'"></span>'
        +'<span style="font-weight:600">'+esc(we.centerName||'')+'</span>'
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
    var funnelSts=STATUS_LIST.slice(0,-1); // exclude غیرفعال from funnel
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

  // Refresh button
  html+='<div style="text-align:center;margin-top:10px">'
    +'<button onclick="renderManagerPanel()" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-family:inherit">🔄 بروزرسانی</button>'
    +'</div></div>';

  el.innerHTML=html;
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
      var recentLog=(DB.changeLog||[]).filter(function(l){return l.rkey===rkey;}).slice(-10);
      var doneEntries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
        .filter(function(we){var r2=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');var i2=we.rid||(we.recKey?we.recKey.split('_')[1]:'');return r2===rt&&i2===c.id&&we.done&&(we.doneNote||we.doneResult||we.doneObstacle||we.doneAmount);})
        .sort(function(a,b){return (b.doneDate||'')<(a.doneDate||'')?-1:1;}).slice(0,5);
      centers.push({rtype:rt,id:c.id,name:e.nameOverride||c.name||'?',status:e.status||'بدون تماس',followupDate:fd,isOverdue:isOverdue,potential:e.potential||c.potential||4,noteArr:noteArr,recentLog:recentLog,rkey:rkey,doneEntries:doneEntries});
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
  var body='<div style="font-size:12px">';
  body+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  Object.keys(grouped).forEach(function(st){
    body+='<span style="padding:3px 10px;border-radius:20px;font-size:11px;background:'+(stColors[st]||'#e2e8f0')+'22;color:'+(stColors[st]||'#555')+';border:1px solid '+(stColors[st]||'#e2e8f0')+'44">'+esc(st)+': '+grouped[st]+'</span>';
  });
  body+='</div>';
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
        c.recentLog.slice(0,-1).reverse().slice(0,8).forEach(function(l){
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
  openModal('mgrDrilldown','🔍 جزئیات: '+esc(m.name)+' (مجموعه '+centers.length+' مرکز)',body,'<button class="btn-secondary" onclick="closeModal(\'mgrDrilldown\')">بستن</button>',{lg:true});
}

function overdueSnooze(rtype,id,days,listMemberId){
  var e=getE(rtype,id);
  var fd=e.followupDate||todayStr();
  var parts=fd.split('/').map(Number);
  var gDate=j2g(parts[0],parts[1],parts[2]);
  var d=new Date(gDate[0],gDate[1]-1,gDate[2]+days);
  var nj=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  var newDate=nj[0]+'/'+p2(nj[1])+'/'+p2(nj[2]);
  setE(rtype,id,'followupDate',newDate);
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
    renderBanner();
    showToast('📅 تاریخ جدید: '+v,2000);
    closeModal('overdueList');
    setTimeout(function(){openOverdueList(listMemberId||undefined);},150);
  });
}
function openOverdueList(memberId){
  _buildPCCache();
  var today=todayStr();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var items=[];
  getAllProvinces().forEach(function(p){
    var rt=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(rt,c.id);
      var owner=e.owner||c.owner||'';
      if(memberId&&owner!==memberId)return;
      var fd=e.followupDate||'';
      if(!fd||fd>=today||e.status==='قرارداد بسته شد'||e.status==='غیرفعال')return;
      var mObj=allMem.find(function(x){return x.id===owner;});
      var _fdp2=fd.split('/').map(Number);var _fdg2=j2g(_fdp2[0],_fdp2[1],_fdp2[2]);var daysAgo=Math.round((new Date()-new Date(_fdg2[0],_fdg2[1]-1,_fdg2[2]))/86400000);
      items.push({rtype:rt,id:c.id,name:e.nameOverride||c.name||'?',followupDate:fd,
        status:e.status||'بدون تماس',ownerName:mObj?mObj.name:(owner||'بدون مسئول'),
        potential:e.potential||c.potential||4,daysAgo:daysAgo});
    });
  });
  items.sort(function(a,b){return a.followupDate<b.followupDate?-1:1;});

  var _mid=memberId||'';
  var renderRow=function(c){
    return '<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--border);border-radius:6px;margin-bottom:4px;background:var(--bg-card)">'
      +'<span style="color:#dc2626;font-size:11px;min-width:60px;font-weight:700">'+c.followupDate+'</span>'
      +'<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:9px;min-width:44px;text-align:center">'+c.daysAgo+' روز</span>'
      +'<span style="flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name)+'</span>'
      +'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+esc(c.ownerName)+'</span>'
      +'<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',3,\''+_mid+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۳ روز">+۳</button>'
      +'<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',7,\''+_mid+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۷ روز">+۷</button>'
      +'<button onclick="overduePickDate(\''+c.rtype+'\',\''+c.id+'\',\''+_mid+'\')" style="padding:3px 7px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تاریخ جدید">📅</button>'
      +'<button onclick="closeModal(\'overdueList\');setTimeout(function(){openCenterModal(\''+c.rtype+'\',\''+c.id+'\');},100)" style="padding:3px 9px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">پیگیری</button>'
      +'</div>';
  };
  var buckets=[
    {label:'🔴 این هفته',sub:'۱–۷ روز',min:1,max:7,clr:'#dc2626',items:[]},
    {label:'🟠 این ماه',sub:'۸–۳۰ روز',min:8,max:30,clr:'#ea580c',items:[]},
    {label:'⚫ قدیمی',sub:'بیش از ۳۰ روز',min:31,max:999999,clr:'#64748b',items:[]}
  ];
  items.forEach(function(c){
    for(var bi=0;bi<buckets.length;bi++){
      if(c.daysAgo>=buckets[bi].min&&c.daysAgo<=buckets[bi].max){buckets[bi].items.push(c);break;}
    }
  });
  var body='<div style="font-size:12px">'
    +'<div style="color:var(--text-muted);margin-bottom:10px">مراکزی که تاریخ پیگیری آن‌ها گذشته و هنوز پیگیری نشده است</div>'
    +'<div style="max-height:60vh;overflow-y:auto">';
  if(!items.length){
    body+='<div style="text-align:center;padding:30px;color:#16a34a;font-weight:700">🎉 هیچ پیگیری معوقی وجود ندارد!</div>';
  } else {
    buckets.forEach(function(bk){
      if(!bk.items.length)return;
      body+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0 4px;border-bottom:2px solid var(--border);margin-bottom:8px">'
        +'<span style="font-size:12px;font-weight:700;color:'+bk.clr+'">'+bk.label+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted)">'+bk.sub+'</span>'
        +'<span style="font-size:11px;background:'+bk.clr+'22;color:'+bk.clr+';border-radius:9px;padding:1px 8px;font-weight:700">'+bk.items.length+' مرکز</span>'
        +'</div>';
      bk.items.forEach(function(c){body+=renderRow(c);});
    });
  }
  body+='</div></div>';
  openModal('overdueList','🔴 پیگیری‌های معوق ('+items.length+')',body,'<button class="btn-secondary" onclick="closeModal(\'overdueList\')">بستن</button>',{lg:true});
}
// ════════════════════════ EXPERT REPORT ════════════════════
function openExpertReport(memberId){
  _buildPCCache();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var m=allMem.find(function(x){return x.id===memberId;});
  if(!m)return;
  var mon=currentJMonth();
  // Compute default date range: first and last day of current month
  var monParts=mon.split('/');
  var fromDefault=monParts[0]+'/'+monParts[1]+'/01';
  var lastDay=jMonthDays(parseInt(monParts[0]),parseInt(monParts[1]));
  var toDefault=monParts[0]+'/'+monParts[1]+'/'+p2(lastDay);
  function buildReport(fromDate,toDate){
    var entries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
      .filter(function(we){
        var own=_wpGetOwner(we)||'';
        return own===memberId&&we.done&&we.doneDate&&we.doneDate>=fromDate&&we.doneDate<=toDate;
      })
      .sort(function(a,b){return (a.doneDate||'')<(b.doneDate||'')?-1:1;});
    var totalAmount=entries.reduce(function(s,e){return s+(e.doneAmount||0);},0);
    var calls=entries.filter(function(e){return (e.actionType||'call')==='call';}).length;
    var visits=entries.filter(function(e){return e.actionType==='visit';}).length;
    var body='<div style="font-size:12px">';
    body+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
    body+='<label style="font-size:11px">از: <input type="text" id="rptFrom" value="'+fromDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<label style="font-size:11px">تا: <input type="text" id="rptTo" value="'+toDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<button onclick="var f=document.getElementById(\'rptFrom\').value,t=document.getElementById(\'rptTo\').value;document.getElementById(\'rptBody\').innerHTML=buildExpertReportHtml(\''+memberId+'\',f,t)" style="padding:4px 12px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">🔍 فیلتر</button>';
    body+='</div>';
    body+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">';
    body+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#1d4ed8">'+calls+'</div><div style="font-size:11px;color:#1d4ed8">تماس</div></div>';
    body+='<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#16a34a">'+visits+'</div><div style="font-size:11px;color:#16a34a">ملاقات</div></div>';
    body+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#92400e">'+(totalAmount?totalAmount+'M':'—')+'</div><div style="font-size:11px;color:#92400e">مبلغ (M)</div></div>';
    body+='</div>';
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
  buildReport(fromDefault,toDefault);
}
function _sendReportNotif(memberId,memberName){
  var body='<div style="font-size:12px">'
    +'<label style="display:block;margin-bottom:6px;font-weight:600">متن پیام به '+esc(memberName)+':</label>'
    +'<textarea id="rptNotifMsg" rows="4" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;background:var(--bg-input);color:var(--text-primary)" placeholder="مثال: عملکرد این هفته خوب بود، لطفاً گزارش مراکز P1 را تکمیل کنید..."></textarea>'
    +'</div>';
  openModal('rptNotifCompose','📨 ارسال اعلان به '+esc(memberName),body,
    '<button class="btn-secondary" onclick="closeModal(\'rptNotifCompose\')">لغو</button>'
    +'<button class="btn-primary" onclick="(function(){var msg=document.getElementById(\'rptNotifMsg\').value.trim();if(!msg){showToast(\'⚠ متن پیام خالی است\');return;}sendNotif(\''+memberId+'\',msg,\'\');closeModal(\'rptNotifCompose\');})()">ارسال 📨</button>'
  );
  setTimeout(function(){var t=document.getElementById('rptNotifMsg');if(t)t.focus();},100);
}
function buildExpertReportHtml(memberId,fromDate,toDate){
  var entries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
    .filter(function(we){
      var own=_wpGetOwner(we)||'';
      return own===memberId&&we.done&&we.doneDate&&we.doneDate>=fromDate&&we.doneDate<=toDate;
    })
    .sort(function(a,b){return (a.doneDate||'')<(b.doneDate||'')?-1:1;});
  if(!entries.length)return '<div style="text-align:center;padding:20px;color:var(--text-muted)">فعالیتی در این بازه ثبت نشده</div>';
  var html='<div style="max-height:50vh;overflow-y:auto">';
  html+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ</th><th style="padding:6px 8px;text-align:right">مرکز</th><th style="padding:6px 8px">نوع</th><th style="padding:6px 8px;text-align:right">نتیجه</th><th style="padding:6px 8px;text-align:right">یادداشت</th><th style="padding:6px 8px;text-align:right">مانع</th><th style="padding:6px 8px">مبلغ</th></tr></thead><tbody>';
  entries.forEach(function(we,i){
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    var typeLabel=(we.actionType==='visit')?'🤝 ملاقات':'📞 تماس';
    html+='<tr style="background:'+bg+';border-bottom:1px solid var(--border)">';
    html+='<td style="padding:5px 8px;white-space:nowrap">'+esc(we.doneDate||'')+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.centerName||'')+'</td>';
    html+='<td style="padding:5px 8px;text-align:center">'+typeLabel+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.doneResult||'—')+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.doneNote||'—')+'</td>';
    html+='<td style="padding:5px 8px;color:#dc2626">'+esc(we.doneObstacle||'—')+'</td>';
    html+='<td style="padding:5px 8px;text-align:center;color:#16a34a">'+((we.doneAmount)?we.doneAmount+'M':'—')+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
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
  }catch(e){
    showLoginOverlay();return;
  }
  await loadDB();
  initSettings();initTags();initWeekTags();initEvents();_initNotif();
  _initBrowserNotif();
  setTimeout(_sendWeeklyDigest,3000);
  buildUSERS();updateNotifBadge();
  setTimeout(_setupAutoReminder,5000);
  loadMasterCenters().then(function(){
    _typeFilterBuilt=false;
    cleanupOrphanedEntries(false);
    var _dedup=wpDeduplicateEntries();if(_dedup>0){saveDBSync();console.info('[wp] dedup removed',_dedup,'duplicate week entries');}
    rebuildFilters();buildTypeFilter();
    try{
      var _st=localStorage.getItem('_st');
      var _spid=localStorage.getItem('_spid');
      var _svm=localStorage.getItem('_svm');
      if(_svm&&['list','card','pipeline'].indexOf(_svm)>=0)_viewMode=_svm;
      if(_st&&['home','provinces','weekplan','calendar','checklist','activity','kpi','manager','mtr','pricing'].indexOf(_st)>=0)currentTab=_st;
      if(_spid)_currentProvId=_spid;
    }catch(e){}
    // Default new sessions to home tab
    if(!_st) currentTab='home';
    // On mobile, always start at home
    if(window.innerWidth<768) currentTab='home';
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


/* ═══ public/js/onboarding.js ═══ */
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
  _sse = new EventSource('/api/events/stream');
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
    var merged = Object.assign({}, DB, d);
    merged.weekEntries = Object.assign({}, DB.weekEntries, d.weekEntries || {});
    merged.edits = Object.assign({}, DB.edits, d.edits || {});
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

/* ═══ public/js/kpi.js ═══ */
// ═══════════════════════════ KPI MODULE ════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ── تاریخچه ماهانه KPI ───────────────────────────────────────
function saveKPISnapshot(userId, month){
  ensureKPIDB();
  if(!DB.kpiHistory)DB.kpiHistory=[];
  month=month||currentJMonth();
  var data=calcKPIs(userId,month);
  var snap={userId:userId,month:month,overall:data.overall,savedAt:new Date().toISOString(),
    scores:{}};
  data.kpis.forEach(function(k){snap.scores[k.id]=Math.round(k.score);});
  // remove old entry for same user+month and replace
  DB.kpiHistory=DB.kpiHistory.filter(function(s){return !(s.userId===userId&&s.month===month);});
  DB.kpiHistory.push(snap);
  // keep max 24 months × N users
  DB.kpiHistory=DB.kpiHistory.slice(-100);
  saveDB();
  return snap;
}
function getKPIHistory(userId,nMonths){
  var months=prevJMonths(nMonths||6);
  return months.map(function(m){
    var snap=(DB.kpiHistory||[]).find(function(s){return s.userId===userId&&s.month===m;});
    return{month:m,label:jMonthLabel(m),overall:snap?snap.overall:null,scores:snap?snap.scores:{}};
  }).reverse();
}
function renderKPIHistoryChart(userId){
  var hist=getKPIHistory(userId,6);
  var maxScore=100;
  var bars=hist.map(function(h){
    var hasData=h.overall!==null;
    var val=hasData?h.overall:0;
    var col=val>=80?'#22c55e':val>=50?'#f59e0b':'#ef4444';
    var heightPct=Math.max(hasData?(val/maxScore*100):0,3);
    return'<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;min-width:0">'
      +'<div style="font-size:11px;font-weight:700;color:'+(hasData?col:'var(--text-muted)')+';">'+(hasData?val+'':'—')+'</div>'
      +'<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
        +'<div style="width:100%;border-radius:5px 5px 0 0;transition:height .4s;background:'+(hasData?col:'var(--border)')+';height:'+heightPct+'%;min-height:4px;position:relative;cursor:'+(hasData?'pointer':'default')+'" '
        +(hasData?'onclick="saveKPISnapshot(\''+userId+'\',\''+h.month+'\')" title="ذخیره مجدد '+h.label+'"':'')+'></div>'
      +'</div>'
      +'<div style="font-size:10px;color:var(--text-muted);text-align:center;white-space:nowrap;overflow:hidden;max-width:100%">'+h.label+'</div>'
    +'</div>';
  }).join('');
  return'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary)">📈 روند ۶ ماهه</div>'
    +'<button onclick="saveKPISnapshot(\''+userId+'\',\''+currentJMonth()+'\');renderKPIPanel()" style="font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">📸 ثبت ماه جاری</button>'
    +'</div>'
    +'<div style="height:100px;display:flex;gap:6px;align-items:flex-end">'+bars+'</div>'
    +(hist.some(function(h){return h.overall!==null;})?''
      :'<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0">برای ذخیره ماه جاری روی «📸 ثبت ماه جاری» کلیک کنید</div>')
  +'</div>';
}


function ensureKPIDB(){
  if(!DB.kpiTargets)DB.kpiTargets={};
  if(!DB.callLog)DB.callLog=[];
  if(!DB.visitLog)DB.visitLog=[];
  if(!DB.salesLog)DB.salesLog=[];
  if(!DB.missionLog)DB.missionLog=[];
  if(!DB.managerTasks)DB.managerTasks={};
}

// ── تاریخ شمسی ──────────────────────────────────────────────────
function currentJMonth(){var t=todayJ();return t[0]+'/'+p2(t[1]);}
function jMonthBounds(key){
  var pts=key.split('/');var jy=parseInt(pts[0]);var jm=parseInt(pts[1]);
  var lastDay=jm<=6?31:jm<=11?30:29;
  var g1=j2g(jy,jm,1);var g2=j2g(jy,jm,lastDay);
  return{
    startTs:new Date(g1[0],g1[1]-1,g1[2],0,0,0).getTime(),
    endTs:new Date(g2[0],g2[1]-1,g2[2],23,59,59).getTime()
  };
}
function jMonthLabel(key){
  var pts=key.split('/');
  return J_MONTHS[parseInt(pts[1])-1]+' '+pts[0];
}
function prevJMonths(n){
  var t=todayJ();var jy=t[0];var jm=t[1];
  var res=[];
  for(var i=0;i<n;i++){
    res.push(jy+'/'+p2(jm));
    jm--;if(jm<1){jm=12;jy--;}
  }
  return res;
}
function workingDaysInJMonth(key){
  var m=parseInt(key.split('/')[1]);
  return m<=6?26:m<=11?25:24;
}
function dateStrToTs(d){ // "1404/01/15" → timestamp
  var pts=d.split('/');return jMs(parseInt(pts[0]),parseInt(pts[1]),parseInt(pts[2]));
}
function currentWeekBounds(){
  var d=new Date();
  var dow=(d.getDay()+1)%7; // 0=sat(شنبه)..6=fri(جمعه)
  var sat=new Date(d);sat.setDate(d.getDate()-dow);sat.setHours(0,0,0,0);
  var fri=new Date(sat);fri.setDate(sat.getDate()+6);fri.setHours(23,59,59,999);
  return{startTs:sat.getTime(),endTs:fri.getTime()};
}

// ── اهداف ────────────────────────────────────────────────────────
function getKPITarget(userId,month){
  ensureKPIDB();
  var k=userId+':'+month;
  return Object.assign({callsPerDay:10,visitsPerWeek:5,salesCount:5,salesAmount:0,cashPct:50},DB.kpiTargets[k]||{});
}
function saveKPITarget(userId,month,targets){
  ensureKPIDB();
  DB.kpiTargets[userId+':'+month]=targets;saveDB();
}

// ── داده‌های ماه ──────────────────────────────────────────────────
function getCallsMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  return DB.callLog.filter(function(l){var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;});
}

function getSalesMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  return DB.salesLog.filter(function(l){var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;});
}
function getMissionMonth(userId,month){
  ensureKPIDB();
  return DB.missionLog.find(function(l){return l.userId===userId&&l.month===month;});
}
function getAutoConversions(userId,month){
  var b=jMonthBounds(month);var n=0;
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    if(e.status!=='قرارداد بسته شد')return;
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    var ts=e._statusChangedTs||e._lastActivity||e._ts||0;
    if(ts>=b.startTs&&ts<=b.endTs)n++;
  });
  return n;
}
function getRetentionData(userId){
  var total=0,cust=0;
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    if(!e.status||e.status==='غیرفعال')return;
    total++;if(e.lead==='مشتری')cust++;
  });
  return{cust:cust,total:total,pct:total>0?Math.round(cust/total*100):0};
}
function _getOwnerForRecKey(recKey){
  if(!recKey)return'';
  var e=DB.edits[recKey]||{};
  if(e.owner)return e.owner;
  var pts=recKey.split('_');var rtype=pts[0];var rid=pts.slice(1).join('_');
  if(rtype==='center'){
    var c=CENTERS.find(function(x){return x.id===rid;});
    if(c&&c.owner)return c.owner;
  } else if(rtype==='pc'){
    _buildPCCache();
    var provId=rid.split('||')[0];
    var arr=_PC_CACHE[provId]||[];
    var c2=arr.find(function(x){return x.id===rid;});
    if(c2&&c2.owner)return c2.owner;
  }
  var ex=(DB.extra||[]).find(function(x){return x.id===rid;});
  if(ex&&ex.owner)return ex.owner;
  return '';
}
function getVisitsMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  var autoV=Object.values(DB.weekEntries||{}).filter(function(we){
    if(we.actionType!=='visit'||!we.done||!we.doneDate)return false;
    var ts=dateStrToTs(we.doneDate);if(ts<b.startTs||ts>b.endTs)return false;
    return _getOwnerForRecKey(we.recKey||'')=== userId;
  });
  var manV=(DB.visitLog||[]).filter(function(l){
    var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;
  });
  var manTotal=manV.reduce(function(s,l){return s+(l.count||1);},0);
  return{auto:autoV,manual:manV,total:autoV.length+manTotal,manTotal:manTotal};
}
function getWeekVisits(userId){
  ensureKPIDB();var wb=currentWeekBounds();
  var autoV=Object.values(DB.weekEntries||{}).filter(function(we){
    if(we.actionType!=='visit'||!we.done||!we.doneDate)return false;
    var ts=dateStrToTs(we.doneDate);if(ts<wb.startTs||ts>wb.endTs)return false;
    return _getOwnerForRecKey(we.recKey||'')=== userId;
  }).length;
  var manV=(DB.visitLog||[]).filter(function(l){
    var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=wb.startTs&&ts<=wb.endTs;
  }).length;
  return autoV+manV;
}

// ── محاسبه KPI ───────────────────────────────────────────────────
function calcKPIs(userId,month){
  ensureKPIDB();
  var b=jMonthBounds(month);
  // read weights from DB or use defaults
  var _defW={conversion:20,retention:20,visits:15,calls:15,sales:15,mission:5,cash:10};
  var _w=Object.assign({},_defW,(DB.kpiTargets&&DB.kpiTargets.weights)||{});
  var t=getKPITarget(userId,month);
  var calls=getCallsMonth(userId,month);
  var visits=getVisitsMonth(userId,month);
  var sales=getSalesMonth(userId,month);
  var mission=getMissionMonth(userId,month);
  var autoCnv=getAutoConversions(userId,month);
  var retention=getRetentionData(userId);
  var weekV=getWeekVisits(userId);
  var wd=workingDaysInJMonth(month);

  // auto-count touchpoints from DB.edits
  var touchedCenters={};
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    var ts=e._lastActivity||e._ts||0;
    if(ts>=b.startTs&&ts<=b.endTs)touchedCenters[key]=true;
  });
  var autoCalls=Object.keys(touchedCenters).length;
  // use autoCalls if no manual call log entries for this user+month
  var callsAutoMode=(calls.length===0&&autoCalls>0);

  var totalCalls=callsAutoMode?autoCalls:calls.reduce(function(s,l){return s+(l.count||0);},0);
  var avgCalls=wd>0?totalCalls/wd:0;
  var totalVisits=visits.total;
  var avgVisits=totalVisits/4.3;
  var visitsTip='این ماه: '+totalVisits+' ویزیت ('+visits.auto.length+' از برنامه هفته'+(visits.manual.length?' + '+visits.manual.length+' دستی':'')+')  •  این هفته: '+weekV;
  var totalSalesCnt=sales.length+autoCnv;
  var totalSalesAmt=sales.reduce(function(s,l){return s+(l.amount||0);},0);
  var cashCnt=sales.filter(function(l){return l.isCash;}).length;
  var cashPct=sales.length>0?cashCnt/sales.length*100:0;

  function sc(actual,target){return target>0?Math.min(actual/target,1)*100:0;}

  var s1=sc(totalSalesCnt,t.salesCount);
  var s2=Math.min(retention.pct/90*100,100); // هدف ۹۰٪ retention
  var s3=sc(avgVisits,t.visitsPerWeek);
  var s4=sc(avgCalls,t.callsPerDay);
  var s5=t.salesAmount>0?sc(totalSalesAmt,t.salesAmount):sc(totalSalesCnt,t.salesCount);
  var s6=mission&&mission.done?100:0;
  var s7=sales.length>0?sc(cashPct,t.cashPct):0;

  var kpis=[
    {id:'conversion',name:'نرخ تبدیل لید',icon:'🔄',weight:_w.conversion,score:s1,
     actual:totalSalesCnt,target:t.salesCount,unit:'قرارداد',
     tip:'قراردادهای بسته‌شده در این ماه',auto:true},
    {id:'retention',name:'نرخ حفظ مشتری',icon:'🤝',weight:_w.retention,score:s2,
     actual:retention.pct,target:90,unit:'درصد',
     tip:retention.cust+' مشتری فعال از '+retention.total+' مرکز با ویرایش',auto:true},
    {id:'visits',name:'ویزیت حضوری هفتگی',icon:'🚗',weight:_w.visits,score:s3,
     actual:Math.round(avgVisits*10)/10,target:t.visitsPerWeek,unit:'ویزیت/هفته',
     tip:visitsTip,auto:true},
    {id:'calls',name:'تماس روزانه',icon:'📞',weight:_w.calls,score:s4,
     actual:Math.round(avgCalls*10)/10,target:t.callsPerDay,unit:'تماس/روز',
     tip:'مجموع '+totalCalls+' تماس در '+wd+' روز کاری'+(callsAutoMode?' (برآورد از CRM)':''),auto:callsAutoMode},
    {id:'sales',name:'تارگت فروش',icon:'💰',weight:_w.sales,score:s5,
     actual:t.salesAmount>0?totalSalesAmt:totalSalesCnt,
     target:t.salesAmount>0?t.salesAmount:t.salesCount,
     unit:t.salesAmount>0?'ریال':'قرارداد',
     tip:'فروش ثبت‌شده + قراردادهای CRM',auto:false},
    {id:'mission',name:'ماموریت ماهانه',icon:'✈️',weight:_w.mission,score:s6,
     actual:s6?1:0,target:1,unit:'',binary:true,
     tip:mission?('وضعیت: '+(mission.done?'انجام شد':'برنامه‌ریزی')+(mission.note?' — '+mission.note:'')):'ثبت نشده',auto:false},
    {id:'cash',name:'فروش نقدی',icon:'💵',weight:_w.cash,score:s7,
     actual:Math.round(cashPct),target:t.cashPct,unit:'درصد',
     tip:cashCnt+' فروش نقدی از '+sales.length+' فروش ثبت‌شده',auto:false},
  ];

  var overall=kpis.reduce(function(s,k){return s+k.score*(k.weight/100);},0);

  // dayElapsed and dayTotal for forecast
  var todayTs=new Date().getTime();
  var dayTotal=wd;
  var dayElapsed=0;
  if(todayTs>=b.startTs&&todayTs<=b.endTs){
    // count working days elapsed
    var curD=new Date(b.startTs);
    var now=new Date();
    while(curD<=now&&curD<=new Date(b.endTs)){
      var dow=curD.getDay(); // 0=Sun,5=Fri,6=Sat in JS (Iran: Fri+Sat off)
      if(dow!==5&&dow!==6)dayElapsed++;
      curD.setDate(curD.getDate()+1);
    }
  }else if(todayTs>b.endTs){
    dayElapsed=dayTotal;
  }

  // forecast: project end-of-month values
  var forecast={};
  if(dayElapsed>0){
    kpis.forEach(function(k){
      forecast[k.id]=Math.min((k.score/dayElapsed)*dayTotal,150);
    });
    forecast.overall=Math.min((overall/dayElapsed)*dayTotal,150);
  }

  return{kpis:kpis,overall:Math.round(overall),userId:userId,month:month,targets:t,
    dayElapsed:dayElapsed,dayTotal:dayTotal,forecast:forecast,callsAutoMode:callsAutoMode,autoCalls:autoCalls};
}

// ── رندر پنل ─────────────────────────────────────────────────────
var _kpiUser=null;
var _kpiMonth=null;
var _trendOpen=true;
var _teamOpen=true;
var _recsOpen=true;
var _discOpen=false;
var _discoveredCenters=null;


// ── مدیریت اهداف تیم ─────────────────────────────────────────
function updateWeightTotal(){
  var keys=['conversion','retention','visits','calls','sales','mission','cash'];
  var sum=0;
  keys.forEach(function(k){
    var el=document.getElementById('kw_'+k);
    if(el)sum+=parseInt(el.value||0);
  });
  var tot=document.getElementById('kw_total');
  if(tot){tot.textContent=sum;tot.style.color=sum===100?'#16a34a':'#dc2626';}
}

function openTeamKPITargets(){
  var month=_kpiMonth||currentJMonth();
  var userKeys=Object.keys(USERS).filter(function(u){return u!=='guest';});
  
  var rows=userKeys.map(function(u){
    var t=getKPITarget(u,month);
    return '<tr>'
      +'<td style="padding:7px 10px;font-weight:600;color:var(--text-primary)">'+esc(USERS[u])+'</td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_calls_'+u+'" value="'+t.callsPerDay+'" min="1" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_visits_'+u+'" value="'+t.visitsPerWeek+'" min="1" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_sales_'+u+'" value="'+t.salesCount+'" min="0" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_cash_'+u+'" value="'+t.cashPct+'" min="0" max="100" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'</tr>';
  }).join('');

  var body='<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">'
    +'📅 ماه: <strong style="color:var(--text-primary)">'+jMonthLabel(month)+'</strong>'
    +' — اهداف برای هر کارشناس به صورت جداگانه ذخیره می‌شود.</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px 10px;text-align:right;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">کارشناس</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">📞 تماس/روز</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">🚗 ویزیت/هفته</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">🔄 قرارداد</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">💵 نقدی٪</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';

  // weights section (manager only)
  if(_isManager()){
    var defW={conversion:20,retention:20,visits:15,calls:15,sales:15,mission:5,cash:10};
    var curW=Object.assign({},defW,(DB.kpiTargets&&DB.kpiTargets.weights)||{});
    var wLabels={conversion:'🔄 نرخ تبدیل',retention:'🤝 حفظ مشتری',visits:'🚗 ویزیت',calls:'📞 تماس',sales:'💰 فروش',mission:'✈️ ماموریت',cash:'💵 نقدی'};
    var wRows=Object.keys(wLabels).map(function(k){
      return '<tr><td style="padding:6px 10px;font-size:12px">'+wLabels[k]+'</td>'        +'<td style="padding:6px 10px;text-align:center"><input type="number" id="kw_'+k+'" value="'+curW[k]+'" min="0" max="100" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center" oninput="updateWeightTotal()"></td>'        +'</tr>';
    }).join('');
    var wSum=Object.values(curW).reduce(function(s,v){return s+v;},0);
    body+='<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">'      +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">⚖️ وزن شاخص‌ها <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(جمع: <strong id="kw_total">'+wSum+'</strong>)</span></div>'      +'<table style="width:100%;border-collapse:collapse;font-size:12px">'      +'<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border)">شاخص</th>'      +'<th style="padding:6px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border)">وزن (%)</th></tr></thead>'      +'<tbody>'+wRows+'</tbody></table></div>';
  }

  var foot='<button class="btn-secondary" onclick="closeModal(\'teamKpiModal\')">لغو</button>'    +'<button class="btn-primary" onclick="saveTeamKPITargets(_kpiMonth)">💾 ذخیره اهداف تیم</button>';

  openModal('teamKpiModal','🎯 اهداف تیم — '+jMonthLabel(month),body,foot,{lg:true});
}

function saveTeamKPITargets(month){
  month=month||_kpiMonth||currentJMonth();
  var userKeys=Object.keys(USERS).filter(function(u){return u!=='guest';});
  var saved=0;
  userKeys.forEach(function(u){
    var calls=parseInt((document.getElementById('tkt_calls_'+u)||{}).value||15);
    var visits=parseInt((document.getElementById('tkt_visits_'+u)||{}).value||4);
    var sales=parseInt((document.getElementById('tkt_sales_'+u)||{}).value||2);
    var cash=parseInt((document.getElementById('tkt_cash_'+u)||{}).value||60);
    if(!DB.kpiTargets)DB.kpiTargets={};
    var existing=DB.kpiTargets[u+':'+month]||{};
    DB.kpiTargets[u+':'+month]=Object.assign({},existing,{callsPerDay:calls,visitsPerWeek:visits,salesCount:sales,cashPct:cash});
    // salesAmount preserved from existing via Object.assign
    saved++;
  });
  // save weights if present
  var wKeys=['conversion','retention','visits','calls','sales','mission','cash'];
  var hasWeightInputs=wKeys.some(function(k){return !!document.getElementById('kw_'+k);});
  if(hasWeightInputs){
    var weights={};
    wKeys.forEach(function(k){
      var el=document.getElementById('kw_'+k);
      weights[k]=el?Math.max(0,parseInt(el.value||0)):0;
    });
    DB.kpiTargets.weights=weights;
  }
  saveDB();
  closeModal('teamKpiModal');
  showToast('✅ اهداف '+saved+' کارشناس ذخیره شد',2500);
  if(typeof renderKPIPanel==='function')renderKPIPanel();
}

function _kpiUserChange(v){
  _kpiUser=v;
  var d=document.getElementById('kpiRepDot');
  if(d&&window.umGetColor)d.style.background=umGetColor(v);
  renderKPIPanel();
}

function getProvKPITarget(provId) {
  var pt = (DB.kpiTargets && DB.kpiTargets.provinces) || {};
  return Object.assign({ contracts: 0, visits: 0 }, pt[provId] || {});
}

function saveProvKPITarget(provId, targets) {
  if (!DB.kpiTargets) DB.kpiTargets = {};
  if (!DB.kpiTargets.provinces) DB.kpiTargets.provinces = {};
  DB.kpiTargets.provinces[provId] = targets;
  saveDB();
}

function openProvTargetsModal() {
  _buildPCCache();
  var provinces = getAllProvinces();
  var body = '<div style="max-height:60vh;overflow-y:auto">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--bg-raised)">'
    + '<th style="padding:6px 8px;text-align:right">استان</th>'
    + '<th style="padding:6px 8px;text-align:center">هدف قرارداد</th>'
    + '<th style="padding:6px 8px;text-align:center">هدف ویزیت</th>'
    + '<th style="padding:6px 8px;text-align:center">واقعی قرارداد</th>'
    + '<th style="padding:6px 8px;text-align:center">پیشرفت</th>'
    + '</tr></thead><tbody>'
    + provinces.map(function(p) {
      var t = getProvKPITarget(p.id);
      var actualContracts = 0;
      var rtype = p.id === 'tehran' ? 'center' : 'pc';
      var arr = p.id === 'tehran' ? CENTERS : (_PC_CACHE[p.id] || []);
      arr.forEach(function(c) {
        var e = getE(rtype, c.id);
        if (e.status === 'قرارداد بسته شد') actualContracts++;
      });
      var pct = t.contracts > 0 ? Math.min(100, Math.round(actualContracts / t.contracts * 100)) : 0;
      var barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3b82f6';
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:6px 8px;font-weight:600">' + esc(p.name) + '</td>'
        + '<td style="padding:6px 8px;text-align:center"><input type="number" min="0" value="' + t.contracts + '" style="width:60px;padding:3px;border:1px solid var(--border-input);border-radius:4px;text-align:center;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)" onchange="saveProvKPITarget(' + JSON.stringify(p.id) + ',Object.assign(getProvKPITarget(' + JSON.stringify(p.id) + '),{contracts:parseInt(this.value)||0}))"></td>'
        + '<td style="padding:6px 8px;text-align:center"><input type="number" min="0" value="' + t.visits + '" style="width:60px;padding:3px;border:1px solid var(--border-input);border-radius:4px;text-align:center;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)" onchange="saveProvKPITarget(' + JSON.stringify(p.id) + ',Object.assign(getProvKPITarget(' + JSON.stringify(p.id) + '),{visits:parseInt(this.value)||0}))"></td>'
        + '<td style="padding:6px 8px;text-align:center;font-weight:700;color:' + (actualContracts > 0 ? '#22c55e' : 'var(--text-muted)') + '">' + actualContracts + '</td>'
        + '<td style="padding:6px 8px"><div style="background:var(--bg-page);border-radius:10px;height:8px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:10px;transition:.3s"></div></div><div style="text-align:center;font-size:10px;margin-top:2px;color:var(--text-muted)">' + pct + '%</div></td>'
        + '</tr>';
    }).join('')
    + '</tbody></table></div>';
  openModal('provTargetsModal', '🎯 اهداف استانی', body, '<button class="btn-secondary" onclick="closeModal(\'provTargetsModal\')">بستن</button>');
}

function exportKPIReport() {
  // builds a printable HTML string with KPI data for current user+month
  // opens in a new window with print dialog
  var data = calcKPIs(_kpiUser, _kpiMonth);
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>گزارش KPI</title>' +
    '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;direction:rtl;background:#fff;color:#1e293b}' +
    'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:10px 14px;text-align:right}' +
    'th{background:#f1f5f9;font-weight:700}.score-big{font-size:48px;font-weight:900;text-align:center;padding:20px}' +
    '.green{color:#16a34a}.red{color:#dc2626}.orange{color:#f59e0b}h1{font-size:20px;border-bottom:2px solid #e2e8f0;padding-bottom:10px}' +
    '</style></head><body>';
  html += '<h1>📊 گزارش عملکرد KPI — ' + (USERS[_kpiUser]||_kpiUser) + ' — ' + jMonthLabel(_kpiMonth) + '</h1>';
  var ov = data.overall;
  var oc = ov>=80?'green':ov>=50?'orange':'red';
  html += '<div class="score-big ' + oc + '">' + Math.round(ov) + ' / 100</div>';
  html += '<table><tr><th>شاخص</th><th>امتیاز</th><th>واقعی</th><th>هدف</th><th>وزن</th></tr>';
  data.kpis.forEach(function(k) {
    var sc = Math.round(k.score);
    var sc_cls = sc>=80?'green':sc>=50?'orange':'red';
    html += '<tr><td>' + k.icon + ' ' + k.name + '</td><td class="' + sc_cls + '"><b>' + sc + '</b></td><td>' + (k.actualStr||k.actual) + '</td><td>' + (k.targetStr||k.target) + '</td><td>' + k.weight + '%</td></tr>';
  });
  html += '</table></body></html>';
  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},400);}
}

function exportKPIReport() {
  // builds a printable HTML string with KPI data for current user+month
  // opens in a new window with print dialog
  var data = calcKPIs(_kpiUser, _kpiMonth);
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>گزارش KPI</title>' +
    '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;direction:rtl;background:#fff;color:#1e293b}' +
    'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:10px 14px;text-align:right}' +
    'th{background:#f1f5f9;font-weight:700}.score-big{font-size:48px;font-weight:900;text-align:center;padding:20px}' +
    '.green{color:#16a34a}.red{color:#dc2626}.orange{color:#f59e0b}h1{font-size:20px;border-bottom:2px solid #e2e8f0;padding-bottom:10px}' +
    '</style></head><body>';
  html += '<h1>📊 گزارش عملکرد KPI — ' + (USERS[_kpiUser]||_kpiUser) + ' — ' + jMonthLabel(_kpiMonth) + '</h1>';
  var ov = data.overall;
  var oc = ov>=80?'green':ov>=50?'orange':'red';
  html += '<div class="score-big ' + oc + '">' + Math.round(ov) + ' / 100</div>';
  html += '<table><tr><th>شاخص</th><th>امتیاز</th><th>واقعی</th><th>هدف</th><th>وزن</th></tr>';
  data.kpis.forEach(function(k) {
    var sc = Math.round(k.score);
    var sc_cls = sc>=80?'green':sc>=50?'orange':'red';
    html += '<tr><td>' + k.icon + ' ' + k.name + '</td><td class="' + sc_cls + '"><b>' + sc + '</b></td><td>' + (k.actualStr||k.actual) + '</td><td>' + (k.targetStr||k.target) + '</td><td>' + k.weight + '%</td></tr>';
  });
  html += '</table></body></html>';
  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},400);}
}


// ── Center discovery (online biopsy potential) ─────────────────────────
function _loadDiscoveredCenters(force) {
  if(_discoveredCenters !== null && !force) {
    _renderDiscoverySection();
    return;
  }
  fetch('/api/discovery')
    .then(function(r){ return r.json(); })
    .then(function(data){
      _discoveredCenters = Array.isArray(data) ? data : [];
      _renderDiscoverySection();
    })
    .catch(function(){ _discoveredCenters = []; _renderDiscoverySection(); });
}

function _renderDiscoverySection() {
  var el = document.getElementById('discoverySection');
  if(el) el.innerHTML = _buildDiscoveryHtml(_discoveredCenters || []);
}

var _recentCenters=[];
var _discFilter='new';
function _buildDiscoveryHtml(centers) {
  var filtered = _discFilter === 'all'
    ? centers
    : centers.filter(function(c){ return c.status === _discFilter; });
  var cntAll  = centers.length;
  var cntNew  = centers.filter(function(c){ return c.status==='new'; }).length;
  var cntImp  = centers.filter(function(c){ return c.status==='imported'; }).length;
  var cntIgn  = centers.filter(function(c){ return c.status==='ignored'; }).length;

  var _btn = function(label, val, cnt) {
    var active = _discFilter === val;
    return '<button onclick="_discFilter=\'' + val + '\';_renderDiscoverySection()" '
      + 'style="font-size:11px;padding:3px 10px;border-radius:14px;cursor:pointer;border:1px solid '
      + (active ? 'var(--brand,#6366f1);background:var(--brand,#6366f1);color:#fff' : 'var(--border);background:var(--bg-raised);color:var(--text-secondary)')
      + '">' + label + (cnt ? ' <b>' + cnt + '</b>' : '') + '</button>';
  };

  var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    + _btn('همه', 'all', cntAll)
    + _btn('جدید 🆕', 'new', cntNew)
    + _btn('وارد شده ✅', 'imported', cntImp)
    + _btn('نادیده 🚫', 'ignored', cntIgn)
    + '</div>';

  if(!filtered.length) {
    return html + '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">'
      + 'هیچ مرکزی در این دسته یافت نشد</div>';
  }

  filtered.forEach(function(c) {
    var sc = parseInt(c.score) || 0;
    var scColor = sc >= 10 ? '#dc2626' : sc >= 7 ? '#ea580c' : '#ca8a04';
    var stBg = c.status==='imported' ? '#f0fdf4' : c.status==='ignored' ? '#f8fafc' : '#faf5ff';
    var stBorder = c.status==='imported' ? '#86efac' : c.status==='ignored' ? '#e2e8f0' : '#d8b4fe';

    // Doctors
    var docHtml = '';
    if(c.doctors && c.doctors.length) {
      docHtml = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">'
        + (c.doctors||[]).map(function(d){
            var lbl = esc(d.label || d.specialty || '');
            var nm  = esc(d.name || '');
            return '<span style="font-size:10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:2px 8px">'
              + '👨‍⚕️ ' + lbl + (nm ? ': ' + nm : '') + '</span>';
          }).join('')
        + '</div>';
    }

    // Reasons
    var reasonHtml = '';
    if(c.reasons && c.reasons.length) {
      reasonHtml = '<div style="margin-top:5px;font-size:10px;color:#7c3aed">'
        + '💡 ' + (c.reasons||[]).map(function(r){ return esc(r); }).join(' &nbsp;•&nbsp; ')
        + '</div>';
    }

    // Address
    var addrHtml = '';
    if(c.address) {
      addrHtml = '<div style="margin-top:4px;font-size:10px;color:var(--text-muted)">📍 ' + esc(c.address) + '</div>';
    }

    // Source URLs
    var urlHtml = '';
    if(c.source_urls && c.source_urls.length) {
      urlHtml = '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">'
        + (c.source_urls||[]).slice(0,4).map(function(u,i){
            var domain = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
            return '<a href="' + esc(u) + '" target="_blank" style="font-size:10px;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:2px 7px;text-decoration:none">🔗 ' + esc(domain) + '</a>';
          }).join('')
        + '</div>';
    }

    // Date
    var dateStr = '';
    if(c.last_scraped) {
      try {
        var d = new Date(c.last_scraped);
        var jd = g2j(d.getFullYear(), d.getMonth()+1, d.getDate());
        dateStr = jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
      } catch(_) {}
    }

    // Biopsy mentions
    var biopHtml = c.biopsy_mentions > 0
      ? '<span style="font-size:10px;background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;border-radius:10px;padding:2px 7px">💬 ' + c.biopsy_mentions + ' نظر بیوپسی</span>'
      : '';

    // Status badge
    var stBadge = c.status === 'imported'
      ? '<span style="font-size:9px;background:#dcfce7;color:#166534;border-radius:8px;padding:1px 6px;font-weight:700">✅ وارد شده</span>'
      : c.status === 'ignored'
      ? '<span style="font-size:9px;background:#f1f5f9;color:#64748b;border-radius:8px;padding:1px 6px;font-weight:700">🚫 نادیده</span>'
      : '';

    // Action buttons
    var actBtns = '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
    if(c.status !== 'imported') {
      actBtns += '<button onclick="_discImport(\'' + c.id + '\')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">➕ وارد کن</button>';
    }
    if(c.status !== 'ignored') {
      actBtns += '<button onclick="_discIgnore(\'' + c.id + '\')" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">🚫 نادیده</button>';
    }
    if(c.status !== 'new') {
      actBtns += '<button onclick="fetch(\'/api/discovery/\'+\'' + c.id + '\',{method:\'PATCH\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({status:\'new\'})}).then(function(){_discoveredCenters=null;_loadDiscoveredCenters();})" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">↩ برگردان</button>';
    }
    actBtns += '</div>';

    html += '<div style="background:' + stBg + ';border-radius:8px;border:1px solid ' + stBorder + ';padding:10px 14px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700;color:var(--text-primary)">' + esc(c.name)
      + (c.city ? ' <span style="font-weight:400;color:var(--text-muted);font-size:11px">— ' + esc(c.city) + '</span>' : '')
      + ' ' + stBadge + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
      + '<span style="background:' + scColor + ';color:#fff;border-radius:10px;padding:2px 10px;font-size:12px;font-weight:700">امتیاز ' + sc + '</span>'
      + (biopHtml ? biopHtml : '')
      + (dateStr ? '<span style="font-size:9px;color:var(--text-muted)">' + dateStr + '</span>' : '')
      + '</div>'
      + '</div>'
      + docHtml
      + reasonHtml
      + addrHtml
      + urlHtml
      + actBtns
      + '</div>';
  });

  return html;
}


function _discImport(cid) {
  var c = (_discoveredCenters||[]).find(function(x){ return x.id===cid; });
  if(!c) return;
  if(!DB.extra) DB.extra = [];
  var newId = 'disc_' + cid;
  if(!DB.extra.find(function(x){ return x.id===newId; })) {
    DB.extra.push({
      id: newId,
      name: c.name,
      province: c.city || '',
      type: 'خصوصی',
      potential: 2,
      biopsyScore: c.score,
      biopsyDoctors: (c.doctors||[]).map(function(d){ return d.label+': '+d.name; }).join(', '),
    });
    saveDB();
  }
  fetch('/api/discovery/' + cid, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'imported'})});
  _discoveredCenters = (_discoveredCenters||[]).map(function(x){ return x.id===cid ? Object.assign({},x,{status:'imported'}) : x; });
  _renderDiscoverySection();
  showToast('✅ اضافه شد: ' + c.name, 2500);
}

function _discIgnore(cid) {
  fetch('/api/discovery/' + cid, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ignored'})});
  _discoveredCenters = (_discoveredCenters||[]).map(function(x){ return x.id===cid ? Object.assign({},x,{status:'ignored'}) : x; });
  _renderDiscoverySection();
}

function _discAiScan() {
  var city = (document.getElementById('discCityFilter')||{}).value || '';
  var btn = document.querySelector('[onclick="_discAiScan()"]');
  if(btn) { btn.disabled=true; btn.textContent='⏳ در حال جستجو...'; }
  fetch('/api/discovery/ai-scan', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({city: city})
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error) { showToast('❌ ' + data.error, 4000); return; }
    showToast('✅ ' + data.saved + ' مرکز از هوش مصنوعی دریافت شد', 3000);
    _discoveredCenters = null;
    _loadDiscoveredCenters();
  })
  .catch(function(e){ showToast('❌ خطا: ' + e.message, 3000); })
  .finally(function(){
    var b = document.querySelector('[onclick="_discAiScan()"]');
    if(b) { b.disabled=false; b.innerHTML='&#129302; جستجوی هوشمند از همه منابع'; }
  });
}


function calcCenterRecommendations() {
  var today = todayStr();
  var nowMs = nowTs();
  var recs = [];
  var allCenters = [];
  if(typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c){ allCenters.push({rtype:'center', id:c.id, name:c.name, prov:'تهران'}); });
  }
  if(typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(pid){
      (_PC_CACHE[pid]||[]).forEach(function(c){ allCenters.push({rtype:'pc', id:c.id, name:c.name, prov:c.province||pid}); });
    });
  }
  if(DB.extra && DB.extra.length) {
    DB.extra.forEach(function(c){ allCenters.push({rtype:'pc', id:c.id, name:c.name, prov:c.province||''}); });
  }
  allCenters.forEach(function(c) {
    var k = c.rtype + '_' + c.id;
    var e = (DB.edits||{})[k] || {};
    var pot = parseInt(e.potential!==undefined&&e.potential!==''?e.potential:(c.potential||4))||4;
    if(pot > 2) return; // فقط مراکز P1 و P2 پیشنهاد می‌شوند (۱=بیشترین ارزش)
    var status = e.status || STATUS_LIST[0];
    var lead = e.lead || '';
    var lastAct = e._lastActivity || e._ts || 0;
    var daysSince = lastAct ? Math.floor((nowMs - lastAct) / 86400000) : 999;
    var followup = e.followupDate || '';
    var owner = e.owner || '';
    var score = 0;
    var reasons = [];
    var action = '';
    var urgency = 'low';
    if(daysSince > 14) {
      score += (3 - pot) * 15; // P1 امتیاز بیشتر از P2
      reasons.push('پتانسیل ' + pot + '⭐ — ' + daysSince + ' روز بدون تماس');
      action = action || 'تماس برای پیگیری';
    }
    if((lead === 'لید' || lead === 'فرصت') && daysSince > 7) {
      score += 25;
      reasons.push(lead + ' — ' + daysSince + ' روز بدون پیشرفت');
      action = action || 'پیشنهاد قیمت ارسال کنید';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(status === 'پیشنهاد ارسال شد' && daysSince > 5) {
      score += 30;
      reasons.push('پیشنهاد ارسال شده — ' + daysSince + ' روز بدون پاسخ');
      action = 'پیگیری پیشنهاد';
      urgency = 'high';
    }
    if(lead === 'مشتری' && daysSince > 30) {
      score += 20;
      reasons.push('مشتری فعال — ' + daysSince + ' روز بدون ارتباط');
      action = action || 'تماس حفظ ارتباط';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(followup && followup < today) {
      score += 40;
      reasons.push('پیگیری معوق: ' + followup);
      action = 'پیگیری فوری';
      urgency = 'critical';
    }
    if(status === 'تماس اولیه' && daysSince > 10) {
      score += 15;
      reasons.push('تماس اولیه — نیاز به تعمیق');
      action = action || 'برنامه‌ریزی ملاقات';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(status === STATUS_LIST[0]) {
      score += (3 - pot) * 12;
      reasons.push('مرکز با پتانسیل بالا — هنوز تماسی نشده');
      action = action || 'شروع ارتباط';
    }
    if(score > 0 && reasons.length > 0) {
      recs.push({
        name: c.name,
        prov: c.prov,
        owner: owner,
        score: score,
        reasons: reasons,
        action: action,
        urgency: urgency,
        pot: pot,
        lead: lead,
        status: status,
        daysSince: daysSince === 999 ? null : daysSince,
        rtype: c.rtype,
        id: c.id
      });
    }
  });
  recs.sort(function(a,b){ if(a.pot!==b.pot)return a.pot-b.pot; return b.score-a.score; }); // P1 اول، سپس امتیاز
  return recs.slice(0, 15);
}

// ─── Mission Detail Modal ──────────────────────────────────────────────────
var _msCurrent = null; // {userId, month, ms, tab}

function openMissionDetail(userId, month) {
  userId = userId || (typeof _kpiUser !== 'undefined' ? _kpiUser : '') || currentUser;
  month = month || (typeof _kpiMonth !== 'undefined' ? _kpiMonth : '') || currentJMonth();
  ensureKPIDB();
  var existing = getMissionMonth(userId, month);
  var ms = existing
    ? JSON.parse(JSON.stringify(existing))
    : {id: Date.now(), userId: userId, month: month, done: false, note: '', city: '', startDate: '', endDate: '', centers: [], expenses: []};
  if (!ms.centers) ms.centers = [];
  if (!ms.expenses) ms.expenses = [];
  _msCurrent = {userId: userId, month: month, ms: ms, tab: 'info'};
  _msRenderModal();
}

function _msRenderModal() {
  if (!_msCurrent) return;
  var m = _msCurrent;
  var hasSaved = !!getMissionMonth(m.userId, m.month);
  var body = _msBuildTabs() + _msGetTabContent();
  var foot = '<button class="btn-primary" onclick="_msSave(true)" style="background:#7c3aed;border-color:#7c3aed">'
    + (m.ms.done ? '✅ بروزرسانی (انجام شد)' : '✅ انجام شد') + '</button>'
    + ' <button class="btn-secondary" onclick="_msSave(false)">⏳ برنامه‌ریزی</button>'
    + (hasSaved ? ' <button class="btn-secondary" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5" onclick="_msDelete()">حذف</button>' : '')
    + ' <button class="btn-secondary" onclick="closeModal(\'missionDetailModal\')">بستن</button>';
  openModal('missionDetailModal', '✈️ ماموریت — ' + jMonthLabel(m.month) + ' — ' + (USERS[m.userId] || m.userId), body, foot, {lg: true});
}

function _msBuildTabs() {
  var tabs = [
    {id: 'info', label: '📋 اطلاعات'},
    {id: 'centers', label: '🏥 مراکز (' + (_msCurrent.ms.centers.length) + ')'},
    {id: 'expenses', label: '💰 هزینه‌ها (' + (_msCurrent.ms.expenses.length) + ')'},
    {id: 'report', label: '📊 گزارش'}
  ];
  return '<div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:2px solid var(--border);padding-bottom:0">'
    + tabs.map(function(t) {
        var active = _msCurrent.tab === t.id;
        return '<button onclick="_msSwitchTab(\'' + t.id + '\')" style="border:none;background:' + (active ? '#7c3aed' : 'transparent')
          + ';color:' + (active ? '#fff' : 'var(--text-secondary)') + ';padding:7px 13px;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600;transition:background 0.15s">'
          + t.label + '</button>';
      }).join('')
    + '</div>';
}

function _msSwitchTab(tab) {
  if (!_msCurrent) return;
  _msCollectFormData();
  _msCurrent.tab = tab;
  var modal = document.getElementById('missionDetailModal');
  if (!modal) return;
  var body = modal.querySelector('.m-body');
  if (!body) return;
  body.innerHTML = _msBuildTabs() + _msGetTabContent();
}

function _msGetTabContent() {
  var t = _msCurrent.tab;
  if (t === 'info') return _msBuildInfoTab();
  if (t === 'centers') return _msBuildCentersTab();
  if (t === 'expenses') return _msBuildExpensesTab();
  if (t === 'report') return _msBuildReportTab();
  return '';
}

function _msBuildInfoTab() {
  var ms = _msCurrent.ms;
  var inp = 'width:100%;padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box';
  var lbl = 'font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px';
  var months = prevJMonths(6);
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><label style="' + lbl + '">ماه ماموریت</label>'
    + '<select id="ms_month" style="' + inp + '">'
    + months.map(function(m) {
        return '<option value="' + m + '"' + (ms.month === m ? ' selected' : '') + '>' + jMonthLabel(m) + '</option>';
      }).join('')
    + '</select></div>'
    + '<div><label style="' + lbl + '">شهر / مقصد</label>'
    + '<input id="ms_city" style="' + inp + '" placeholder="تهران، شیراز..." value="' + esc(ms.city || '') + '"></div>'
    + '<div><label style="' + lbl + '">تاریخ شروع</label>'
    + '<input id="ms_startDate" style="' + inp + '" placeholder="YYYY/MM/DD" value="' + esc(ms.startDate || '') + '" onfocus="openJDP(this,function(v){this.value=v})"></div>'
    + '<div><label style="' + lbl + '">تاریخ پایان</label>'
    + '<input id="ms_endDate" style="' + inp + '" placeholder="YYYY/MM/DD" value="' + esc(ms.endDate || '') + '" onfocus="openJDP(this,function(v){this.value=v})"></div>'
    + '</div>'
    + '<div style="margin-bottom:14px"><label style="' + lbl + '">توضیحات / هدف ماموریت</label>'
    + '<textarea id="ms_note" style="' + inp + ';height:70px;resize:vertical" placeholder="هدف سفر، نتیجه کلی...">' + esc(ms.note || '') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;align-items:center;padding:10px;background:var(--bg-raised);border-radius:8px">'
    + '<span style="font-size:12px;font-weight:600;color:var(--text-secondary)">وضعیت:</span>'
    + '<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:' + (ms.done ? '#d1fae5' : '#fef3c7') + ';color:' + (ms.done ? '#065f46' : '#92400e') + '">'
    + (ms.done ? '✅ انجام شد' : '⏳ برنامه‌ریزی') + '</span>'
    + '<span style="font-size:11px;color:var(--text-muted)">(از دکمه‌های پایین تغییر دهید)</span>'
    + '</div>';
}

function _msBuildCentersTab() {
  var ms = _msCurrent.ms;
  var inp = 'padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit';
  var html = '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">'
    + '<input id="ms_ctr_q" style="' + inp + ';flex:1" placeholder="🔍 جستجوی مرکز..." oninput="_msCtrSearch(this.value)">'
    + '</div>'
    + '<div id="ms_ctr_results" style="margin-bottom:14px;max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;display:none"></div>';
  if (ms.centers.length) {
    html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">مراکز این ماموریت (' + ms.centers.length + '):</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px">';
    ms.centers.forEach(function(c, i) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-raised);border-radius:6px;border:1px solid var(--border)">'
        + '<span style="flex:1;font-size:12px;font-weight:600">' + esc(c.name) + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted)">' + esc(c.date || '') + '</span>'
        + '<button onclick="_msRemCenter(' + i + ')" style="border:none;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px">حذف</button>'
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;background:var(--bg-raised);border-radius:8px">هنوز مرکزی اضافه نشده. از جستجو بالا مرکز اضافه کنید.</div>';
  }
  return html;
}

function _msCtrSearch(q) {
  var el = document.getElementById('ms_ctr_results');
  if (!el) return;
  if (!q || q.length < 2) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var norm = fNorm(q);
  var results = [];
  var today = todayStr();
  // search Tehran centers
  if (typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c) {
      if (fNorm(c.name).indexOf(norm) >= 0) results.push({rtype: 'center', id: c.id, name: c.name, date: today});
    });
  }
  // search PC centers
  if (typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(pid) {
      (_PC_CACHE[pid] || []).forEach(function(c) {
        if (fNorm(c.name).indexOf(norm) >= 0) results.push({rtype: 'pc', id: c.id, name: c.name, date: today});
      });
    });
  }
  results = results.slice(0, 12);
  if (!results.length) { el.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">نتیجه‌ای یافت نشد</div>'; el.style.display = 'block'; return; }
  el.innerHTML = results.map(function(r) {
    var _qEsc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var nm = esc(r.name).replace(new RegExp('(' + _qEsc + ')', 'i'), '<strong>$1</strong>');
    return '<div onclick="_msAddCenter(\'' + r.rtype + '\',\'' + r.id + '\',\'' + esc(r.name).replace(/'/g, "\\'") + '\')" '
      + 'style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)" '
      + 'onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">'
      + nm + '</div>';
  }).join('');
  el.style.display = 'block';
}

function _msAddCenter(rtype, id, name) {
  if (!_msCurrent) return;
  var ms = _msCurrent.ms;
  var already = ms.centers.some(function(c) { return c.rtype === rtype && c.id === id; });
  if (already) { showToast('این مرکز قبلاً اضافه شده'); return; }
  ms.centers.push({rtype: rtype, id: id, name: name, date: todayStr()});
  _msCurrent.tab = 'centers';
  var modal = document.getElementById('missionDetailModal');
  if (modal) {
    var body = modal.querySelector('.m-body');
    if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent();
  }
}

function _msRemCenter(idx) {
  if (!_msCurrent) return;
  _msCurrent.ms.centers.splice(idx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) {
    var body = modal.querySelector('.m-body');
    if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent();
  }
}

function _msBuildExpensesTab() {
  var ms = _msCurrent.ms;
  var cats = ['ایاب و ذهاب', 'اقامت', 'غذا', 'نمایندگی', 'سایر'];
  var inp  = 'padding:6px 8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;width:100%;box-sizing:border-box;text-align:left;direction:ltr';
  var lbl  = 'font-size:10px;font-weight:600;display:block;margin-bottom:3px';

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<span style="font-size:13px;font-weight:700;color:var(--text-primary)">ردیف‌های هزینه</span>'
    + '<button onclick="_msAddExpense()" style="border:none;background:#7c3aed;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:700">+ افزودن ردیف</button>'
    + '</div>'
    // legend
    + '<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
    + '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#5b21b6"><span style="width:10px;height:10px;border-radius:50%;background:#7c3aed;display:inline-block"></span>از تنخواه</span>'
    + '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#065f46"><span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block"></span>پرداخت شرکت</span>'
    + '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#b45309"><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block"></span>از جیب کارشناس</span>'
    + '</div>';

  if (!ms.expenses.length) {
    html += '<div style="text-align:center;padding:28px;color:var(--text-muted);font-size:12px;background:var(--bg-raised);border-radius:8px">هنوز هزینه‌ای ثبت نشده. با دکمه «+ افزودن ردیف» شروع کنید.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:10px">';
    ms.expenses.forEach(function(ex, i) {
      var rowTotal = (parseFloat(ex.tankhah)||0) + (parseFloat(ex.company)||0) + (parseFloat(ex.self)||0);
      // backward compat: if old record with only amount, show it in tankhah
      if (!rowTotal && ex.amount) rowTotal = parseFloat(ex.amount)||0;
      html += '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
        // ── row header ──
        + '<div style="display:grid;grid-template-columns:1fr 120px 140px auto;gap:6px;padding:8px 10px;background:var(--bg-card);border-bottom:1px solid var(--border);align-items:end">'
        + '<div><label style="' + lbl + 'color:var(--text-secondary)">عنوان هزینه</label>'
        + '<input style="' + inp.replace('direction:ltr','direction:rtl') + ';font-size:12px" value="' + esc(ex.title||'') + '" placeholder="شرح هزینه..." oninput="_msExpField(' + i + ',\'title\',this.value)"></div>'
        + '<div><label style="' + lbl + 'color:var(--text-secondary)">دسته‌بندی</label>'
        + '<select style="' + inp.replace('direction:ltr','direction:rtl') + '" onchange="_msExpField(' + i + ',\'cat\',this.value)">'
        + cats.map(function(c){return '<option'+(ex.cat===c?' selected':'')+'>'+c+'</option>';}).join('')
        + '</select></div>'
        + '<div><label style="' + lbl + 'color:var(--text-secondary)">تاریخ</label>'
        + '<input style="' + inp + '" value="' + esc(ex.date||'') + '" placeholder="YYYY/MM/DD" oninput="_msExpField(' + i + ',\'date\',this.value)"></div>'
        + '<div style="display:flex;align-items:flex-end">'
        + '<button onclick="_msDelExpense(' + i + ')" style="border:none;background:#fee2e2;color:#dc2626;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;white-space:nowrap">🗑 حذف</button>'
        + '</div>'
        + '</div>'
        // ── 3 payment columns ──
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">'
        // tankhah
        + '<div style="padding:10px;border-left:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:#7c3aed;display:inline-block"></span>'
        + '<span style="font-size:11px;font-weight:700;color:#5b21b6">از تنخواه</span></div>'
        + '<input type="number" min="0" style="' + inp + ';background:#faf5ff;border-color:#c4b5fd" value="' + (ex.tankhah||0) + '" oninput="_msExpField(' + i + ',\'tankhah\',this.value)" placeholder="0">'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">مبلغ تنخواه مصرف‌شده</div>'
        + '</div>'
        // company
        + '<div style="padding:10px;border-left:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span>'
        + '<span style="font-size:11px;font-weight:700;color:#065f46">پرداخت شرکت</span></div>'
        + '<input type="number" min="0" style="' + inp + ';background:#f0fdf4;border-color:#86efac" value="' + (ex.company||0) + '" oninput="_msExpField(' + i + ',\'company\',this.value)" placeholder="0">'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">پرداخت مستقیم شرکت</div>'
        + '</div>'
        // self
        + '<div style="padding:10px">'
        + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block"></span>'
        + '<span style="font-size:11px;font-weight:700;color:#b45309">از جیب کارشناس</span></div>'
        + '<input type="number" min="0" style="' + inp + ';background:#fffbeb;border-color:#fcd34d" value="' + (ex.self||0) + '" oninput="_msExpField(' + i + ',\'self\',this.value)" placeholder="0">'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">پرداخت شخصی (قابل تسویه)</div>'
        + '</div>'
        + '</div>'
        // ── row footer: total + note + files ──
        + '<div style="padding:8px 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<span style="font-size:12px;font-weight:700;color:var(--text-primary)">جمع ردیف: '
        + '<span style="color:#7c3aed">' + new Intl.NumberFormat('fa-IR').format(rowTotal) + ' ریال</span></span>'
        + '<div style="flex:1;min-width:140px"><input style="' + inp.replace('direction:ltr','direction:rtl') + ';font-size:11px" value="' + esc(ex.note||'') + '" placeholder="توضیح اختیاری..." oninput="_msExpField(' + i + ',\'note\',this.value)"></div>';
      if (ex.files && ex.files.length) {
        ex.files.forEach(function(f,fi){
          html += '<span style="display:inline-flex;align-items:center;gap:4px;background:#e0e7ff;padding:2px 8px;border-radius:12px;font-size:11px">'
            + '📎 ' + esc(f.name)
            + '<button onclick="_msDelExpFile('+i+','+fi+')" style="border:none;background:transparent;color:#dc2626;cursor:pointer;font-size:10px;padding:0 2px">×</button>'
            + '</span>';
        });
      }
      html += '<label style="cursor:pointer;background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px;white-space:nowrap">'
        + '📎 پیوست<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" onchange="_msUploadFile('+i+',this)"></label>'
        + '</div></div>';
    });
    html += '</div>';

    // ── grand summary ──
    var totTankhah = ms.expenses.reduce(function(s,e){return s+(parseFloat(e.tankhah)||0);},0);
    var totCompany = ms.expenses.reduce(function(s,e){return s+(parseFloat(e.company)||0);},0);
    var totSelf    = ms.expenses.reduce(function(s,e){return s+(parseFloat(e.self)||0);},0);
    // backward compat: old records with only amount
    ms.expenses.forEach(function(e){
      if (!e.tankhah && !e.company && !e.self && e.amount) totTankhah += parseFloat(e.amount)||0;
    });
    var grandTotal = totTankhah + totCompany + totSelf;
    var fmt = function(n){ return new Intl.NumberFormat('fa-IR').format(n); };

    html += '<div style="margin-top:14px;border-radius:10px;overflow:hidden;border:2px solid #7c3aed">'
      + '<div style="background:#7c3aed;color:#fff;padding:8px 14px;font-size:12px;font-weight:700">📊 خلاصه مالی ماموریت</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--bg-card)">'
      + '<div style="padding:12px;border-left:1px solid var(--border);text-align:center">'
      + '<div style="font-size:10px;color:#5b21b6;font-weight:600;margin-bottom:4px">💜 از تنخواه</div>'
      + '<div style="font-size:15px;font-weight:700;color:#5b21b6">' + fmt(totTankhah) + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted)">ریال</div></div>'
      + '<div style="padding:12px;border-left:1px solid var(--border);text-align:center">'
      + '<div style="font-size:10px;color:#065f46;font-weight:600;margin-bottom:4px">💚 پرداخت شرکت</div>'
      + '<div style="font-size:15px;font-weight:700;color:#065f46">' + fmt(totCompany) + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted)">ریال</div></div>'
      + '<div style="padding:12px;text-align:center">'
      + '<div style="font-size:10px;color:#b45309;font-weight:600;margin-bottom:4px">🟡 از جیب کارشناس</div>'
      + '<div style="font-size:15px;font-weight:700;color:#b45309">' + fmt(totSelf) + '</div>'
      + '<div style="font-size:10px;color:var(--text-muted)">ریال (قابل تسویه)</div></div>'
      + '</div>'
      + '<div style="background:#f5f3ff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd6fe">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text-secondary)">جمع کل هزینه‌های ماموریت</span>'
      + '<span style="font-size:16px;font-weight:700;color:#4c1d95">' + fmt(grandTotal) + ' <span style="font-size:12px;font-weight:500">ریال</span></span>'
      + '</div></div>';
  }
  return html;
}

function _msAddExpense() {
  if (!_msCurrent) return;
  _msCollectFormData();
  _msCurrent.ms.expenses.push({id: Date.now(), title: '', tankhah: 0, company: 0, self: 0, cat: 'سایر', date: todayStr(), note: '', files: []});
  _msCurrent.tab = 'expenses';
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msDelExpense(idx) {
  if (!_msCurrent) return;
  _msCurrent.ms.expenses.splice(idx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msExpField(idx, field, val) {
  if (!_msCurrent || !_msCurrent.ms.expenses[idx]) return;
  var numFields = ['tankhah','company','self','amount'];
  _msCurrent.ms.expenses[idx][field] = numFields.indexOf(field) >= 0 ? parseFloat(val)||0 : val;
}
function _msUploadFile(expIdx, input) {
  if (!input.files || !input.files.length || !_msCurrent) return;
  var file = input.files[0];
  if (file.size > 10 * 1024 * 1024) { showToast('حداکثر حجم فایل ۱۰ مگابایت است'); return; }
  _msCollectFormData();
  var ms = _msCurrent.ms;
  var missionId = ms.userId + '_' + ms.month.replace('/', '-');
  var expId = ms.expenses[expIdx] ? String(ms.expenses[expIdx].id) : String(expIdx);
  var fd = new FormData();
  fd.append('file', file);
  fd.append('missionId', missionId);
  fd.append('expenseId', expId);
  fetch('/api/missions/files', {method: 'POST', body: fd, credentials: 'include'})
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.id) { showToast('خطا در آپلود فایل'); return; }
      if (!ms.expenses[expIdx].files) ms.expenses[expIdx].files = [];
      ms.expenses[expIdx].files.push({fileId: data.id, name: file.name});
      var modal = document.getElementById('missionDetailModal');
      if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
      showToast('✅ فایل آپلود شد');
    })
    .catch(function() { showToast('خطا در آپلود فایل'); });
}

function _msDelExpFile(expIdx, fileIdx) {
  if (!_msCurrent) return;
  var ex = _msCurrent.ms.expenses[expIdx];
  if (!ex || !ex.files) return;
  var f = ex.files[fileIdx];
  if (f && f.fileId) {
    fetch('/api/missions/files/' + f.fileId, {method: 'DELETE', credentials: 'include'}).catch(function(){});
  }
  ex.files.splice(fileIdx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msBuildReportTab() {
  var ms = _msCurrent.ms;
  var ctrs = ms.centers || [];
  var exps = ms.expenses || [];
  var _expAmt = function(e){ return (parseFloat(e.tankhah)||0)+(parseFloat(e.company)||0)+(parseFloat(e.self)||0) || (parseFloat(e.amount)||0); };
  var total = exps.reduce(function(s, e) { return s + _expAmt(e); }, 0);
  var totTankhah = exps.reduce(function(s,e){return s+(parseFloat(e.tankhah)||0);},0);
  var totCompany = exps.reduce(function(s,e){return s+(parseFloat(e.company)||0);},0);
  var totSelf    = exps.reduce(function(s,e){return s+(parseFloat(e.self)||0);},0);
  var bycat = {};
  exps.forEach(function(e) {
    bycat[e.cat || 'سایر'] = (bycat[e.cat || 'سایر'] || 0) + _expAmt(e);
  });
  // effectiveness: build active-rkey set once, then O(1) per center
  var mBounds = jMonthBounds(ms.month);
  var _activeRkeys = {};
  (DB.changeLog || []).forEach(function(ch) {
    var ts = new Date(ch.at).getTime();
    if (ts >= mBounds.startTs && ts <= mBounds.endTs) _activeRkeys[ch.rkey] = true;
  });
  var effectiveCtr = 0;
  ctrs.forEach(function(c) { if (_activeRkeys[c.rtype + '_' + c.id]) effectiveCtr++; });
  var costPerCenter = ctrs.length ? Math.round(total / ctrs.length) : 0;
  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
    + _msStatCard('🏥 مراکز ویزیت', ctrs.length, '')
    + _msStatCard('✅ با فعالیت', effectiveCtr, '')
    + _msStatCard('💰 هزینه کل', new Intl.NumberFormat('fa-IR').format(total), 'ریال')
    + _msStatCard('💜 از تنخواه', new Intl.NumberFormat('fa-IR').format(totTankhah), 'ریال')
    + _msStatCard('💚 پرداخت شرکت', new Intl.NumberFormat('fa-IR').format(totCompany), 'ریال')
    + _msStatCard('🟡 از جیب کارشناس', new Intl.NumberFormat('fa-IR').format(totSelf), 'ریال')
    + '</div>';
  if (Object.keys(bycat).length) {
    html += '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">تفکیک هزینه بر اساس دسته:</div>';
    Object.keys(bycat).forEach(function(cat) {
      var pct = total > 0 ? Math.round(bycat[cat] / total * 100) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        + '<span style="font-size:11px;min-width:80px;color:var(--text-secondary)">' + esc(cat) + '</span>'
        + '<div style="flex:1;background:var(--border);border-radius:4px;height:8px"><div style="width:' + pct + '%;background:#7c3aed;height:100%;border-radius:4px"></div></div>'
        + '<span style="font-size:11px;min-width:40px;text-align:left;color:var(--text-primary)">' + pct + '%</span>'
        + '<span style="font-size:11px;color:var(--text-muted)">' + new Intl.NumberFormat('fa-IR').format(bycat[cat]) + '</span>'
        + '</div>';
    });
    html += '</div>';
  }
  if (ctrs.length) {
    html += '<div><div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">مراکز ویزیت‌شده:</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
      + ctrs.map(function(c) {
          var act = !!_activeRkeys[c.rtype + '_' + c.id];
          return '<span style="padding:3px 10px;border-radius:12px;font-size:11px;background:' + (act ? '#d1fae5' : '#f0f0f0') + ';color:' + (act ? '#065f46' : 'var(--text-secondary)') + '">' + esc(c.name) + (act ? ' ✅' : '') + '</span>';
        }).join('')
      + '</div></div>';
  }
  return html;
}

function _msStatCard(label, value, unit) {
  return '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">'
    + '<div style="font-size:20px;font-weight:700;color:#7c3aed">' + value + (unit ? '<span style="font-size:11px;color:var(--text-muted);margin-right:2px">' + unit + '</span>' : '') + '</div>'
    + '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">' + label + '</div>'
    + '</div>';
}

function _msCollectFormData() {
  if (!_msCurrent) return;
  var ms = _msCurrent.ms;
  var f = function(id) { var el = document.getElementById(id); return el ? el.value : null; };
  if (f('ms_month')) ms.month = f('ms_month');
  if (f('ms_city') !== null) ms.city = f('ms_city');
  if (f('ms_startDate') !== null) ms.startDate = f('ms_startDate');
  if (f('ms_endDate') !== null) ms.endDate = f('ms_endDate');
  if (f('ms_note') !== null) ms.note = f('ms_note');
  // expense fields sync live via oninput → _msExpField; nothing to collect here
}

function _msSave(done) {
  if (!_msCurrent) return;
  _msCollectFormData();
  var ms = _msCurrent.ms;
  ms.done = done;
  ensureKPIDB();
  DB.missionLog = DB.missionLog.filter(function(l) { return !(l.userId === ms.userId && l.month === ms.month); });
  DB.missionLog.push(ms);
  saveDB();
  showToast(done ? '✅ ماموریت انجام‌شده ثبت شد' : '⏳ ماموریت برنامه‌ریزی شد');
  closeModal('missionDetailModal');
  if (typeof renderKPIPanel === 'function') renderKPIPanel();
}

function _msDelete() {
  if (!_msCurrent) return;
  _msCollectFormData();
  var ms = _msCurrent.ms;
  ensureKPIDB();
  DB.missionLog = DB.missionLog.filter(function(l) { return !(l.userId === ms.userId && l.month === ms.month); });
  saveDB();
  showToast('ماموریت حذف شد');
  closeModal('missionDetailModal');
  if (typeof renderKPIPanel === 'function') renderKPIPanel();
}


/* ═══ public/js/manager-tasks.js ═══ */
// ════════════════════════ MANAGER TASKS ════════════════════════
var _mgrTasksOpen = true;

function mgrOpenAssign(recKey, rtype, id, name){
  if(!_isManager()){showToast('فقط مدیران می‌توانند وظیفه ارجاع دهند');return;}
  ensureKPIDB();
  var existing=DB.managerTasks[recKey]||{};
  var members=(typeof umGetActive==='function'?umGetActive():[]).filter(function(m){return m.id!==currentUser;});
  var expertOpts=members.map(function(m){
    return '<option value="'+m.id+'"'+(existing.assignedTo===m.id?' selected':'')+'>'+esc(m.name)+'</option>';
  }).join('');
  var sn=name.replace(/\\/g,'\\\\').replace(/'/g,'&#39;');
  var body='<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div><label style="font-size:12px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:4px">👤 کارشناس مسئول</label>'
    +'<select id="mgrAssignTo" style="width:100%;padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:12px">'
    +expertOpts+'</select></div>'
    +'<div><label style="font-size:12px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:4px">📝 یادداشت برای کارشناس (اختیاری)</label>'
    +'<textarea id="mgrAssignNote" rows="3" style="width:100%;padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:12px;resize:vertical;box-sizing:border-box">'+esc(existing.note||'')+'</textarea></div>'
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'mgrAssignModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="mgrSaveTask(\''+recKey+'\',\''+rtype+'\',\''+id+'\',\''+sn+'\')">📌 ارجاع پیگیری</button>';
  openModal('mgrAssignModal','📌 ارجاع وظیفه پیگیری — '+esc(name),body,foot);
}

function mgrSaveTask(recKey, rtype, id, name){
  ensureKPIDB();
  var assignedTo=((document.getElementById('mgrAssignTo')||{}).value||'').trim();
  var note=((document.getElementById('mgrAssignNote')||{}).value||'').trim();
  if(!assignedTo){showToast('کارشناس را انتخاب کنید');return;}
  var existing=DB.managerTasks[recKey]||{};
  DB.managerTasks[recKey]={
    rtype:rtype,id:id,name:name,
    assignedTo:assignedTo,note:note,
    assignedAt:todayStr(),
    done:false,
    doneAt:''
  };
  saveDB();
  closeModal('mgrAssignModal');
  showToast('✅ وظیفه پیگیری به '+( USERS[assignedTo]||assignedTo)+' ارجاع داده شد',2500);
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderUserDashboard();
}

function mgrRemoveTask(recKey){
  ensureKPIDB();
  delete DB.managerTasks[recKey];
  saveDB();
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderUserDashboard();
}

function mgrDoneTask(recKey){
  ensureKPIDB();
  if(DB.managerTasks[recKey]){
    DB.managerTasks[recKey].done=true;
    DB.managerTasks[recKey].doneAt=todayStr();
  }
  saveDB();
  showToast('✅ وظیفه انجام شد');
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderDashboard();
  else renderUserDashboard();
}

function _renderManagerTasksWidget(){
  ensureKPIDB();
  var tasks=DB.managerTasks||{};
  var allKeys=Object.keys(tasks);
  var activeTasks=allKeys.filter(function(k){return !tasks[k].done;});
  var doneTasks=allKeys.filter(function(k){return tasks[k].done;});

  var html='<div style="background:var(--bg-card);border-radius:12px;border:1px solid #fde68a;padding:14px 16px;margin-bottom:14px">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<div>'
    +'<span style="font-size:13px;font-weight:700;color:var(--text-primary)">📌 وظایف پیگیری ویژه</span>'
    +(activeTasks.length?'<span style="background:#dc2626;color:#fff;font-size:10px;border-radius:10px;padding:1px 7px;margin-right:6px">'+activeTasks.length+'</span>':'')
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">مراکزی که برای کارشناسان جهت پیگیری ویژه ارجاع داده‌اید</div>'
    +'</div>'
    +'<button onclick="_mgrTasksOpen=!_mgrTasksOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'+(_mgrTasksOpen?'▲ جمع':'▼ باز')+'</button>'
    +'</div>';

  if(_mgrTasksOpen){
    if(!activeTasks.length&&!doneTasks.length){
      html+='<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">هیچ وظیفه‌ای ارجاع داده نشده. از دکمه 📌 روی مراکز پیشنهادی استفاده کنید.</div>';
    } else {
      // group active by assignedTo
      var byExpert={};
      activeTasks.forEach(function(k){
        var t=tasks[k];
        if(!byExpert[t.assignedTo])byExpert[t.assignedTo]=[];
        byExpert[t.assignedTo].push({recKey:k,task:t});
      });
      var experts=Object.keys(byExpert);
      if(experts.length){
        html+='<div style="display:flex;flex-direction:column;gap:8px">';
        experts.forEach(function(uid){
          var uname=USERS[uid]||uid;
          var ucol=typeof umGetColor==='function'?umGetColor(uid):'#0ea5e9';
          html+='<div style="background:var(--bg-raised);border-radius:8px;padding:8px 10px;border-right:3px solid '+ucol+'">'
            +'<div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:6px">👤 '+esc(uname)
            +'<span style="background:'+ucol+'22;color:'+ucol+';font-size:10px;border-radius:8px;padding:1px 7px;margin-right:4px">'+byExpert[uid].length+' وظیفه</span>'
            +'</div>'
            +'<div style="display:flex;flex-direction:column;gap:4px">';
          byExpert[uid].forEach(function(item){
            var t=item.task;
            var sn=t.name.replace(/\\/g,'\\\\').replace(/'/g,'&#39;');
            html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 7px;background:var(--bg-card);border-radius:5px;font-size:11px;border:1px solid var(--border)">'
              +'<span onclick="openCenterModal(\''+t.rtype+'\',\''+t.id+'\')" style="flex:1;cursor:pointer;font-weight:600;color:var(--text-primary)">'+esc(t.name)+'</span>'
              +(t.note?'<span style="font-size:10px;color:var(--text-muted);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(t.note)+'">📝 '+esc(t.note)+'</span>':'')
              +'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+t.assignedAt+'</span>'
              +'<button onclick="mgrOpenAssign(\''+item.recKey+'\',\''+t.rtype+'\',\''+t.id+'\',\''+sn+'\')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer;font-family:inherit;flex-shrink:0">✏ ویرایش</button>'
              +'<button onclick="mgrRemoveTask(\''+item.recKey+'\')" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer;font-family:inherit;flex-shrink:0">✕ حذف</button>'
              +'</div>';
          });
          html+='</div></div>';
        });
        html+='</div>';
      }
      if(doneTasks.length){
        html+='<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px">'
          +'<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">✅ انجام‌شده اخیر ('+doneTasks.length+')</div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:4px">';
        doneTasks.slice(0,5).forEach(function(k){
          var t=tasks[k];
          html+='<div style="display:flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;font-size:10px">'
            +'<span style="text-decoration:line-through;color:var(--text-muted)">'+esc(t.name)+'</span>'
            +'<button onclick="mgrRemoveTask(\''+k+'\')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:10px;padding:0">✕</button>'
            +'</div>';
        });
        html+='</div></div>';
      }
    }
  }
  html+='</div>';
  return html;
}

function renderKPIPanel(){
  ensureKPIDB();
  if(!_kpiUser||!USERS[_kpiUser])_kpiUser=USERS[currentUser]?currentUser:Object.keys(USERS)[0];
  if(!_kpiMonth)_kpiMonth=currentJMonth();
  var data;
  try{data=calcKPIs(_kpiUser,_kpiMonth);}catch(err){
    var el=document.getElementById('kpiPanel');
    if(el)el.innerHTML='<div style="color:#dc2626;padding:20px;background:#fef2f2;border-radius:8px;margin:20px;font-size:12px"><strong>خطا در محاسبه KPI:</strong><br>'+esc(err.message)+'</div>';
    console.error('KPI error:',err);return;
  }

  var userOpts=Object.keys(USERS).map(function(u){
    var _uc=window.umGetColor?umGetColor(u):'#0ea5e9';
    return'<option value="'+u+'"'+(_kpiUser===u?' selected':'')+' data-color="'+_uc+'">'+USERS[u]+'</option>';
  }).join('');
  var monthOpts=prevJMonths(12).map(function(m){
    return'<option value="'+m+'"'+(_kpiMonth===m?' selected':'')+'>'+jMonthLabel(m)+'</option>';
  }).join('');

  var ov=data.overall;
  var oc=ov>=80?'#22c55e':ov>=50?'#f59e0b':'#ef4444';
  var og=ov>=90?'A':ov>=80?'B+':ov>=70?'B':ov>=60?'C':ov>=50?'D':'F';

  var html='';

  // ── smart alert banner
  var lowKPIs=data.kpis.filter(function(k){return k.score<50;});
  if(lowKPIs.length>0){
    var hasRed=lowKPIs.some(function(k){return k.score<30;});
    var alertBg=hasRed?'#fef2f2':'#fff7ed';
    var alertBorder=hasRed?'#fca5a5':'#fed7aa';
    var alertColor=hasRed?'#991b1b':'#92400e';
    var alertNames=lowKPIs.map(function(k){return k.icon+' '+k.name;}).join('، ');
    html+='<div style="background:'+alertBg+';border:1px solid '+alertBorder+';border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:'+alertColor+';font-weight:600">'      +'⚠️ هشدار: '+lowKPIs.length+' شاخص زیر ۵۰ هستند: <span style="font-weight:400">'+alertNames+'</span>'      +'</div>';
  }

  // ── header
  html+='<div class="kpi-header-row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">'    +'<h2 style="margin:0;font-size:18px;color:var(--text-primary)">📊 عملکرد KPI</h2>'    +'<select onchange="_kpiUserChange(this.value)" style="padding:5px 10px;border:1px solid var(--border-input);border-radius:5px;background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:12px">'+userOpts+'</select>'    +'<select onchange="_kpiMonth=this.value;renderKPIPanel()" style="padding:5px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+monthOpts+'</select>'    +'<div style="margin-right:auto;display:flex;gap:8px">'    +'<button style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600" onclick="openTeamKPITargets()">🎯 تنظیم اهداف تیم</button>'    +(_isManager()?'<button style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600;margin-right:6px" onclick="openProvTargetsModal()">🗺 اهداف استانی</button>':'')    +'<button class="btn-primary" onclick="openKPILog(_kpiUser)" style="font-size:11px;padding:5px 12px">📝 ثبت فعالیت</button>'    +'<button style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600" onclick="exportKPIReport()">📥 دانلود گزارش</button>'    +'</div></div>';

  // ── امتیاز کلی
  var dashPercent=Math.min(ov,100);
  html+='<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:14px;padding:18px 22px;margin-bottom:16px;display:flex;gap:20px;align-items:center;flex-wrap:wrap">'
    +'<div style="text-align:center;min-width:90px">'
    +'<div style="font-size:42px;font-weight:900;color:'+oc+';line-height:1">'+ov+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.6);margin:2px 0">امتیاز کلی</div>'
    +'<div style="background:'+oc+';color:var(--text-primary);border-radius:20px;padding:3px 12px;font-size:15px;font-weight:900;margin-top:4px;display:inline-block">'+og+'</div>'
    +'</div>'
    +'<div style="flex:1;min-width:200px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">'+USERS[_kpiUser]+' — '+jMonthLabel(_kpiMonth)+'</div>'
    +'<div style="background:rgba(255,255,255,.15);border-radius:8px;height:10px;overflow:hidden">'
    +'<div style="background:'+oc+';height:10px;border-radius:8px;width:'+dashPercent+'%;transition:width .6s ease"></div></div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:rgba(255,255,255,.5)">'
    +'<span>ضعیف (F)</span><span>متوسط (C)</span><span>خوب (B)</span><span>عالی (A)</span>'
    +'</div>'
    +'</div>'
    // mini bars
    +'<div style="display:flex;flex-direction:column;gap:5px;min-width:180px">'
    +data.kpis.map(function(k){
      var bc=k.score>=80?'#22c55e':k.score>=50?'#f59e0b':'#ef4444';
      return'<div style="display:flex;gap:6px;align-items:center">'
        +'<span style="font-size:11px;width:22px">'+k.icon+'</span>'
        +'<div style="flex:1;background:rgba(255,255,255,.1);border-radius:4px;height:5px">'
        +'<div style="background:'+bc+';height:5px;border-radius:4px;width:'+Math.round(k.score)+'%"></div></div>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.7);min-width:25px;text-align:left">'+Math.round(k.score)+'</span>'
        +'</div>';
    }).join('')
    +'</div>'
    // forecast row
    +(data.dayElapsed>0&&_kpiMonth===currentJMonth()?'<div style="width:100%;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.15);font-size:11px;color:rgba(255,255,255,.7);display:flex;gap:16px;flex-wrap:wrap">'      +'<span>📈 پیش‌بینی پایان ماه: <strong style="color:#fbbf24">'+Math.round(data.forecast.overall||0)+'</strong> / 100</span>'      +'<span>⏱ '+data.dayElapsed+' روز کاری گذشته از '+data.dayTotal+'</span>'      +'</div>':'')    +'</div>';

  // ── KPI Cards
  // find best and worst KPI indices
  var bestIdx=0,worstIdx=0;
  data.kpis.forEach(function(k,i){
    if(k.score>data.kpis[bestIdx].score)bestIdx=i;
    if(k.score<data.kpis[worstIdx].score)worstIdx=i;
  });
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;margin-bottom:14px">';
  data.kpis.forEach(function(k,ki){
    var sc=Math.round(k.score);
    var bc=sc>=80?'#22c55e':sc>=50?'#f59e0b':'#ef4444';
    var bg=sc>=80?'#f0fdf4':sc>=50?'#fffbeb':'#fef2f2';
    var bd=sc>=80?'#86efac':sc>=50?'#fcd34d':'#fca5a5';
    var cardBorder=ki===bestIdx?'2px solid #16a34a':ki===worstIdx?'2px solid #dc2626':'1px solid '+bd;
    var badge=ki===bestIdx?'<span style="font-size:9px;background:#dcfce7;color:#15803d;border-radius:10px;padding:2px 7px;font-weight:700;margin-right:4px">⭐ بهترین</span>':ki===worstIdx?'<span style="font-size:9px;background:#fee2e2;color:#dc2626;border-radius:10px;padding:2px 7px;font-weight:700;margin-right:4px">⚠️ ضعیف‌ترین</span>':'';
    html+='<div style="background:'+bg+';border:'+cardBorder+';border-radius:10px;padding:13px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
      +'<div style="flex:1">'
      +'<div style="font-size:13px;font-weight:700;color:var(--text-primary)">'+k.icon+' '+k.name+' '+badge+'</div>'
      +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">'+esc(k.tip)+'</div>'
      +'</div>'
      +'<div style="text-align:center;background:rgba(255,255,255,.8);border-radius:8px;padding:5px 9px;margin-right:8px">'
      +'<div style="font-size:20px;font-weight:900;color:'+bc+'">'+sc+'</div>'
      +'<div style="font-size:9px;color:#94a3b8">w:'+k.weight+'%</div>'
      +'</div></div>'
      +'<div style="background:rgba(0,0,0,.08);border-radius:4px;height:6px;margin-bottom:8px;overflow:hidden">'
      +'<div style="background:'+bc+';height:6px;border-radius:4px;width:'+Math.min(sc,100)+'%;transition:width .5s ease"></div></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary)">'
      +(k.binary
        ?'<span style="font-weight:700;color:'+(k.actual?'#166534':'#991b1b')+'">'+(k.actual?'✅ انجام شد':'⏳ انجام نشده')+'</span><span></span>'
        :'<span>واقعی: <strong style="color:var(--text-primary)">'+k.actual+'</strong> <span style="color:#94a3b8">'+k.unit+'</span></span>'
        +'<span>هدف: <strong>'+k.target+'</strong> <span style="color:#94a3b8">'+k.unit+'</span></span>'
      )
      +'</div>'
      +(k.auto?'<div style="font-size:9px;color:#0ea5e9;margin-top:5px">⚡ محاسبه خودکار از CRM</div>':'')
      +'</div>';
  });
  html+='</div>';

  // ── 6-month trend chart
  if(_isManager() || _kpiUser === currentUser) {
    html += '<div class="kpi-trend-wrap">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--text-primary)">&#128200; روند ۶ ماهه</span>'
      + '<button onclick="_trendOpen=!_trendOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'
      + (_trendOpen ? '▲ جمع' : '▼ باز') + '</button></div>';
    if(_trendOpen) {
      var trendMonths = prevJMonths(6).reverse();
      var trendData = trendMonths.map(function(m) {
        try { var d = calcKPIs(_kpiUser, m); return {month: m, score: Math.round(d.overall||0)}; }
        catch(e) { return {month: m, score: 0}; }
      });
      var maxScore = Math.max.apply(null, trendData.map(function(t){return t.score;})) || 1;
      html += '<div class="kpi-trend-bars">';
      trendData.forEach(function(t) {
        var barH = Math.max(Math.round((t.score / 100) * 100), 3);
        var bc = t.score >= 80 ? '#22c55e' : t.score >= 50 ? '#f59e0b' : '#ef4444';
        var parts = t.month.split('/');
        var mLabel = jMonthLabel(t.month).split(' ')[0];
        html += '<div class="kpi-trend-col">'
          + '<div class="kpi-trend-score">' + t.score + '</div>'
          + '<div class="kpi-trend-bar" style="height:' + barH + 'px;background:' + bc + '"></div>'
          + '<div class="kpi-trend-label">' + mLabel + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
  }

  // ── team comparison (manager only)
  if(_isManager()) {
    html += '<div class="kpi-cmp-wrap">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--text-primary)">&#128101; مقایسه تیم — ' + jMonthLabel(_kpiMonth) + '</span>'
      + '<button onclick="_teamOpen=!_teamOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'
      + (_teamOpen ? '▲ جمع' : '▼ باز') + '</button></div>';
    if(_teamOpen) {
      var teamData = [];
      Object.keys(USERS).forEach(function(u) {
        try {
          var d = calcKPIs(u, _kpiMonth);
          var ov2 = Math.round(d.overall||0);
          var gr = ov2>=90?'A':ov2>=80?'B+':ov2>=70?'B':ov2>=60?'C':ov2>=50?'D':'F';
          var bestKPI = d.kpis[0], worstKPI = d.kpis[0];
          d.kpis.forEach(function(k){ if(k.score>bestKPI.score)bestKPI=k; if(k.score<worstKPI.score)worstKPI=k; });
          teamData.push({uid:u, name:USERS[u], score:ov2, grade:gr, best:bestKPI, worst:worstKPI});
        } catch(e) {}
      });
      teamData.sort(function(a,b){return b.score-a.score;});
      teamData.forEach(function(m, idx) {
        var rankEmoji = idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':'• '+(idx+1);
        var sc2 = m.score;
        var bc2 = sc2>=80?'#22c55e':sc2>=50?'#f59e0b':'#ef4444';
        html += '<div class="kpi-cmp-row">'
          + '<div class="kpi-cmp-rank">' + rankEmoji + '</div>'
          + '<div class="kpi-cmp-name">' + esc(m.name) + '</div>'
          + '<div class="kpi-cmp-score" style="color:' + bc2 + '">' + sc2 + '</div>'
          + '<div style="font-size:12px;background:#f1f5f9;border-radius:4px;padding:2px 7px;font-weight:700;color:#475569">' + m.grade + '</div>'
          + '<div class="kpi-cmp-bar-wrap"><div class="kpi-cmp-bar" style="width:' + sc2 + '%;background:' + bc2 + '"></div></div>'
          + '<span style="font-size:10px;background:#dcfce7;color:#15803d;border-radius:4px;padding:2px 6px" title="بهترین">'
          + m.best.icon + ' ' + m.best.name + '</span>'
          + '<span style="font-size:10px;background:#fee2e2;color:#dc2626;border-radius:4px;padding:2px 6px" title="ضعیف‌ترین">'
          + m.worst.icon + ' ' + m.worst.name + '</span>'
          + '</div>';
      });
    }
    html += '</div>';
  }

  // ── smart center recommendations (manager only)
  if(_isManager()) {
    var recs = [];
    try { recs = calcCenterRecommendations(); } catch(e) { recs = []; }
    html += '<div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border);padding:14px 16px;margin-bottom:14px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      + '<div>'
      + '<span style="font-size:13px;font-weight:700;color:var(--text-primary)">&#128161; پیشنهاد مراکز برای تماس</span>'
      + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">بر اساس پتانسیل، وضعیت، لید و آخرین تماس</div>'
      + '</div>'
      + '<button onclick="_recsOpen=!_recsOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'
      + (_recsOpen ? '▲ جمع' : '▼ باز') + '</button></div>';
    if(_recsOpen) {
      if(recs.length === 0) {
        html += '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">هیچ توصیه‌ای یافت نشد</div>';
      } else {
        recs.forEach(function(r) {
          var urgBadge = r.urgency==='critical'
            ? '<span style="background:#fef2f2;color:#dc2626;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">🔴 فوری</span>'
            : r.urgency==='high'
            ? '<span style="background:#fff7ed;color:#ea580c;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">🟠 مهم</span>'
            : r.urgency==='medium'
            ? '<span style="background:#fefce8;color:#ca8a04;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">🟡 معمول</span>'
            : '<span style="background:#f1f5f9;color:#64748b;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">⚪ کم‌اولویت</span>';
          var potStars = '';
          for(var ps=0;ps<r.pot;ps++) potStars+='⭐';
          var ownerName = r.owner ? (USERS[r.owner]||r.owner) : '—';
          html += '<div class="rec-card rec-' + r.urgency + '">'
            + '<div class="rec-body">'
            + '<div class="rec-name">' + urgBadge + ' ' + esc(r.name) + ' — <span style="font-weight:400;color:var(--text-muted)">' + esc(r.prov) + '</span></div>'
            + '<div class="rec-reason">' + r.reasons.map(function(rs){return esc(rs);}).join(' • ') + '</div>'
            + '<div class="rec-action">&#128161; اقدام پیشنهادی: ' + esc(r.action) + '</div>'
            + '<div class="rec-meta">'
            + '👤 ' + esc(ownerName) + '  |  ' + potStars
            + '  \xa0|\xa0 <button onclick="(function(){var wks=DB.weekEntries?Object.keys(DB.weekEntries):[];if(!wks.length){showToast(\'ابتدا یک هفته بسازید\',2000);return;}var wId=wks[wks.length-1];addToWeekAuto(wId,\''
            + r.rtype + '\',\''
            + r.id + '\',\''
            + r.name.replace(/'/g, "&#39;")
            + '\',\'visit\');})()" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;font-size:10px;padding:2px 8px;cursor:pointer;font-family:inherit">📅 برنامه‌ریزی</button>'
            + '</div></div></div>';
        });
      }
    }
    html += '</div>';
  }


  // ── discovered centers from web (manager + super admin)
  if(_isManager()||_isSuperAdmin()) {
    var discNew = (_discoveredCenters||[]).filter(function(c){ return c.status==='new'; }).length;
    html += '<div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border);padding:14px 16px;margin-top:12px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<div>'
      + '<span style="font-size:13px;font-weight:700;color:var(--text-primary)">&#127758; مراکز کشف‌شده از وب</span>'
      + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">رادیولوژیست / اینترونشنال / اورولوژیست — nobat.ir &amp; doctorto.ir</div>'
      + '</div>';
    html += '<div style="display:flex;gap:6px;align-items:center">';
    if(discNew > 0) {
      html += '<span style="background:#7c3aed;color:#fff;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">' + discNew + ' مرکز جدید</span>';
    }
    html += '<button onclick="if(!_discOpen){_loadDiscoveredCenters();}  _discOpen=!_discOpen;renderKPIPanel();" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'
      + (_discOpen ? '&#9650; جمع' : '&#9660; باز') + '</button>';
    html += '</div></div>';
    if(_discOpen) {
      html += '<div id="discoverySection">';
      if(_discoveredCenters === null) {
        html += '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px">در حال بارگذاری...</div>';
      } else {
        html += _buildDiscoveryHtml(_discoveredCenters);
      }
      html += '</div>';
      html += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">'
        + '<button onclick="_discAiScan()" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:6px;font-size:12px;padding:5px 14px;cursor:pointer;font-weight:600">&#129302; جستجوی هوشمند از همه منابع</button>'
        + '<input id="discCityFilter" placeholder="شهر (اختیاری)" style="border:1px solid var(--border-input);border-radius:5px;padding:4px 8px;font-size:12px;width:120px;font-family:inherit">'
        + '<button onclick="_loadDiscoveredCenters(true)" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer">&#128257; بازخوانی</button>'
        + '</div>';
    }
    html += '</div>';
  }

  // ── log history
  html+=_renderKPIHistory(_kpiUser,_kpiMonth);

  var el=document.getElementById('kpiPanel');
  if(el)el.innerHTML=html;
}

function _renderKPIHistory(userId,month){
  ensureKPIDB();
  var b=jMonthBounds(month);
  var entries=[];

  getCallsMonth(userId,month).forEach(function(l){
    entries.push({ts:dateStrToTs(l.date),date:l.date,icon:'📞',
      text:'تماس: '+l.count+' تماس'+(l.note?' — '+esc(l.note):''),
      del:function(){DB.callLog=DB.callLog.filter(function(x){return x.id!==l.id;});saveDB();renderKPIPanel();}});
  });
  var visitsData=getVisitsMonth(userId,month);
  // ویزیت‌های خودکار از برنامه هفته
  visitsData.auto.forEach(function(we){
    var name=we.recKey?getRecLabel(we.recKey):'';
    entries.push({ts:dateStrToTs(we.doneDate),date:we.doneDate,icon:'🚗',
      text:'ویزیت (برنامه هفته): '+esc(name),del:null});
  });
  // ویزیت‌های دستی
  visitsData.manual.forEach(function(l){
    entries.push({ts:dateStrToTs(l.date),date:l.date,icon:'🚗',
      text:'ویزیت (دستی): '+(l.centerName?esc(l.centerName):'حضوری')+(l.note?' — '+esc(l.note):''),
      del:function(){DB.visitLog=DB.visitLog.filter(function(x){return x.id!==l.id;});saveDB();renderKPIPanel();}});
  });
  getSalesMonth(userId,month).forEach(function(l){
    entries.push({ts:dateStrToTs(l.date),date:l.date,icon:l.isCash?'💵':'💳',
      text:'فروش: '+(l.centerName?esc(l.centerName):'')+(l.amount?' — '+Number(l.amount).toLocaleString('fa-IR')+' ریال':'')+(l.isCash?' (نقدی)':' (اعتباری)'),
      del:function(){DB.salesLog=DB.salesLog.filter(function(x){return x.id!==l.id;});saveDB();renderKPIPanel();}});
  });
  var ms=getMissionMonth(userId,month);
  if(ms)entries.push({ts:b.startTs,date:month,icon:'✈️',
    text:'ماموریت: '+(ms.done?'✅ انجام شد':'⏳ برنامه‌ریزی')+(ms.note?' — '+esc(ms.note):''),del:null});

  // قراردادهای خودکار از CRM
  Object.values(DB.edits||{}).forEach(function(e){
    if((e.owner||'')===userId&&e.status==='قرارداد بسته شد'&&e._ts&&e._ts>=b.startTs&&e._ts<=b.endTs){
      var jd=msToJ(e._ts);
      entries.push({ts:e._ts,date:jd,icon:'🔄',text:'CRM: قرارداد بسته شد (خودکار)',del:null});
    }
  });

  entries.sort(function(a,b_){return b_.ts-a.ts;});
  if(!entries.length)return'<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;background:var(--bg-raised);border-radius:10px;border:1px solid var(--border)">هیچ فعالیتی در '+jMonthLabel(month)+' ثبت نشده</div>';

  var html='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px">📋 سوابق فعالیت — '+jMonthLabel(month)+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:5px">';
  entries.slice(0,20).forEach(function(e,i){
    var delBtn=e.del?'<button onclick="_kpiDelEntry('+i+')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:11px;padding:2px 6px;margin-right:auto">✕</button>':'';
    html+='<div style="display:flex;gap:8px;align-items:center;font-size:11px;background:var(--bg-card);border-radius:6px;padding:6px 10px;border:1px solid #f1f5f9">'
      +'<span style="font-size:14px">'+e.icon+'</span>'
      +'<span style="color:var(--text-muted);min-width:58px;font-size:10px">'+e.date+'</span>'
      +'<span style="color:var(--text-primary);flex:1">'+e.text+'</span>'
      +delBtn+'</div>';
  });
  html+='</div></div>';
  return html;
}

// حذف آیتم از لاگ
function _kpiDelEntry(i){
  var userId=_kpiUser;var month=_kpiMonth;
  var entries=[];
  getCallsMonth(userId,month).forEach(function(l){entries.push({id:l.id,type:'call'});});
  getVisitsMonth(userId,month).manual.forEach(function(l){entries.push({id:l.id,type:'visit'});});
  getSalesMonth(userId,month).forEach(function(l){entries.push({id:l.id,type:'sale'});});
  var e=entries[i];if(!e)return;
  if(e.type==='call')DB.callLog=DB.callLog.filter(function(x){return x.id!==e.id;});
  else if(e.type==='visit')DB.visitLog=DB.visitLog.filter(function(x){return x.id!==e.id;});
  else if(e.type==='sale')DB.salesLog=DB.salesLog.filter(function(x){return x.id!==e.id;});
  saveDB();renderKPIPanel();
}

// ── Modal ثبت فعالیت ──────────────────────────────────────────────
function openKPILog(userId){
  userId=userId||_kpiUser||currentUser;
  var today=todayStr();
  var ms=getMissionMonth(userId,_kpiMonth||currentJMonth());
  var mStatus=ms?(ms.done?'done':'planned'):'';

  var sectionStyle='background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px';
  var labelStyle='font-size:11px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:4px';
  var inputStyle='width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;box-sizing:border-box';
  var btnBase='border:none;padding:7px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600';

  var body=''
    // تماس
    +'<div style="'+sectionStyle+'">'
    +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:10px">📞 ثبت تماس روزانه</div>'
    +'<div style="display:grid;grid-template-columns:130px 100px 1fr;gap:8px">'
    +'<div><label style="'+labelStyle+'">تاریخ</label><input id="lc_date" value="'+today+'" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">تعداد تماس</label><input id="lc_count" type="number" value="10" min="0" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">یادداشت</label><input id="lc_note" placeholder="اختیاری" style="'+inputStyle+'"></div>'
    +'</div><button onclick="_saveCallLog(\''+userId+'\')" style="'+btnBase+';background:#0ea5e9;color:var(--text-primary);margin-top:8px">ثبت تماس</button></div>'
    // ویزیت
    +'<div style="'+sectionStyle+'">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:700;color:#166534">🚗 ثبت ویزیت حضوری</div>'
    +'<div style="display:flex;gap:4px">'
    +'<button id="lv_mode_count" onclick="_setVisitMode(\'count\')" style="'+btnBase+';background:#166534;color:#fff;font-size:11px;padding:4px 10px">تعداد کل</button>'
    +'<button id="lv_mode_center" onclick="_setVisitMode(\'center\')" style="'+btnBase+';background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);font-size:11px;padding:4px 10px">مرکز خاص</button>'
    +'</div></div>'
    +'<div id="lv_count_row" style="display:grid;grid-template-columns:130px 120px 1fr;gap:8px">'
    +'<div><label style="'+labelStyle+'">تاریخ</label><input id="lv_date" value="'+today+'" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">تعداد ویزیت</label><input id="lv_count" type="number" value="1" min="1" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">یادداشت</label><input id="lv_note" placeholder="اختیاری" style="'+inputStyle+'"></div>'
    +'</div>'
    +'<div id="lv_center_row" style="display:none;grid-template-columns:130px 1fr 1fr;gap:8px">'
    +'<div><label style="'+labelStyle+'">تاریخ</label><input id="lv_date2" value="'+today+'" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">نام مرکز</label><input id="lv_center" placeholder="نام مرکز بازدیدشده" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">یادداشت</label><input id="lv_note2" placeholder="اختیاری" style="'+inputStyle+'"></div>'
    +'</div>'
    +'<button onclick="_saveVisitLog(\''+userId+'\')" style="'+btnBase+';background:#22c55e;color:#fff;margin-top:8px">ثبت ویزیت</button></div>'
    // فروش
    +'<div style="'+sectionStyle+'">'
    +'<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:10px">💰 ثبت فروش</div>'
    +'<div style="display:grid;grid-template-columns:130px 1fr 120px 120px;gap:8px">'
    +'<div><label style="'+labelStyle+'">تاریخ</label><input id="ls_date" value="'+today+'" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">نام مشتری / مرکز</label><input id="ls_center" placeholder="نام" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">مبلغ (ریال)</label><input id="ls_amount" type="number" value="0" min="0" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">نوع پرداخت</label><select id="ls_cash" style="'+inputStyle+'"><option value="1">💵 نقدی</option><option value="0">💳 اعتباری</option></select></div>'
    +'</div><button onclick="_saveSaleLog(\''+userId+'\')" style="'+btnBase+';background:#f59e0b;color:var(--text-primary);margin-top:8px">ثبت فروش</button></div>'
    // ماموریت
    +'<div style="'+sectionStyle+'">'
    +'<div style="font-size:12px;font-weight:700;color:#6b21a8;margin-bottom:10px">✈️ ماموریت ماهانه</div>'
    +'<div style="display:grid;grid-template-columns:150px 1fr;gap:8px;margin-bottom:8px">'
    +'<div><label style="'+labelStyle+'">ماه</label><select id="lm_month" style="'+inputStyle+'">'
    +prevJMonths(3).map(function(m){return'<option value="'+m+'"'+(_kpiMonth===m?' selected':'')+'>'+jMonthLabel(m)+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="'+labelStyle+'">یادداشت / شهر ماموریت</label><input id="lm_note" placeholder="تهران، شیراز..." style="'+inputStyle+'" value="'+(ms&&ms.note?esc(ms.note):'')+'"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="_saveMissionLog(\''+userId+'\',true)" style="'+btnBase+';background:#8b5cf6;color:var(--text-primary)">✅ انجام شد</button>'
    +'<button onclick="_saveMissionLog(\''+userId+'\',false)" style="'+btnBase+';background:#e2e8f0;color:var(--text-primary)">⏳ برنامه‌ریزی</button>'
    +(ms?'<button onclick="_delMissionLog(\''+userId+'\')" style="'+btnBase+';background:#fee2e2;color:#dc2626">حذف</button>':'')
    +'</div></div>';

  openModal('kpiLogModal','📝 ثبت فعالیت KPI — '+USERS[userId],body,'<button class="btn-secondary" onclick="closeModal(\'kpiLogModal\')">بستن</button>',{lg:true});
}

function _saveCallLog(userId){
  var date=document.getElementById('lc_date').value.trim();
  var count=parseInt((document.getElementById('lc_count')||{}).value)||0;
  var note=(document.getElementById('lc_note').value||'').trim();
  if(!date||count<1){showToast('تاریخ و تعداد تماس را وارد کنید');return;}
  ensureKPIDB();
  DB.callLog.push({id:Date.now(),date:date,userId:userId,count:count,note:note});
  saveDB();showToast('✅ '+count+' تماس ثبت شد');closeModal('kpiLogModal');renderKPIPanel();
}

function _setVisitMode(mode){
  var countRow=document.getElementById('lv_count_row');
  var centerRow=document.getElementById('lv_center_row');
  var btnCount=document.getElementById('lv_mode_count');
  var btnCenter=document.getElementById('lv_mode_center');
  if(!countRow||!centerRow)return;
  if(mode==='count'){
    countRow.style.display='grid';centerRow.style.display='none';
    if(btnCount){btnCount.style.background='#166534';btnCount.style.color='#fff';}
    if(btnCenter){btnCenter.style.background='var(--bg-raised)';btnCenter.style.color='var(--text-secondary)';}
  } else {
    countRow.style.display='none';centerRow.style.display='grid';
    if(btnCenter){btnCenter.style.background='#166534';btnCenter.style.color='#fff';}
    if(btnCount){btnCount.style.background='var(--bg-raised)';btnCount.style.color='var(--text-secondary)';}
  }
}

function _saveVisitLog(userId){
  ensureKPIDB();
  var centerRow=document.getElementById('lv_center_row');
  var isCenterMode=centerRow&&centerRow.style.display!=='none';
  if(isCenterMode){
    // مرکز خاص
    var date=(((document.getElementById('lv_date2')||document.getElementById('lv_date'))||{}).value||'').trim();
    var center=(document.getElementById('lv_center').value||'').trim();
    var note=(document.getElementById('lv_note2')||document.getElementById('lv_note')).value.trim();
    if(!date){showToast('تاریخ را وارد کنید');return;}
    DB.visitLog.push({id:Date.now(),date:date,userId:userId,centerName:center,note:note,count:1});
  } else {
    // تعداد کل
    var date=(document.getElementById('lv_date')||{}).value.trim();
    var countVal=parseInt((document.getElementById('lv_count')||{}).value)||1;
    var note=(document.getElementById('lv_note')||{}).value.trim();
    if(!date){showToast('تاریخ را وارد کنید');return;}
    if(countVal<1){showToast('تعداد باید حداقل ۱ باشد');return;}
    DB.visitLog.push({id:Date.now(),date:date,userId:userId,centerName:'',note:note,count:countVal});
  }
  saveDB();showToast('✅ ویزیت ثبت شد');closeModal('kpiLogModal');renderKPIPanel();
}
function _saveSaleLog(userId){
  var date=((document.getElementById('ls_date')||{}).value||'').trim();
  var center=(document.getElementById('ls_center').value||'').trim();
  var amount=parseFloat(document.getElementById('ls_amount').value)||0;
  var isCash=document.getElementById('ls_cash').value==='1';
  if(!date){showToast('تاریخ را وارد کنید');return;}
  ensureKPIDB();
  DB.salesLog.push({id:Date.now(),date:date,userId:userId,centerName:center,amount:amount,isCash:isCash});
  saveDB();showToast('✅ فروش ثبت شد — '+(isCash?'نقدی':'اعتباری'));closeModal('kpiLogModal');renderKPIPanel();
}
function _saveMissionLog(userId,done){
  var month=document.getElementById('lm_month').value;
  var note=(document.getElementById('lm_note').value||'').trim();
  ensureKPIDB();
  DB.missionLog=DB.missionLog.filter(function(l){return!(l.userId===userId&&l.month===month);});
  DB.missionLog.push({id:Date.now(),userId:userId,month:month,done:done,note:note});
  saveDB();showToast(done?'✅ ماموریت انجام‌شده ثبت شد':'⏳ ماموریت برنامه‌ریزی شد');closeModal('kpiLogModal');renderKPIPanel();
}
function _delMissionLog(userId){
  var month=document.getElementById('lm_month').value;
  ensureKPIDB();
  DB.missionLog=DB.missionLog.filter(function(l){return!(l.userId===userId&&l.month===month);});
  saveDB();showToast('ماموریت حذف شد');closeModal('kpiLogModal');renderKPIPanel();
}

// ── Modal تنظیم هدف ───────────────────────────────────────────────
function openKPITargets(userId,month){
  userId=userId||_kpiUser||currentUser;
  month=month||_kpiMonth||currentJMonth();
  var t=getKPITarget(userId,month);
  var inputStyle='width:100%;padding:7px 8px;border:1.5px solid var(--border-input);border-radius:5px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--bg-input);color:var(--text-primary)';
  var labelStyle='font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px';

  var body='<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:8px 12px;margin-bottom:14px;font-size:12px">'
    +'کارشناس: <strong>'+USERS[userId]+'</strong>  •  ماه: <strong>'+jMonthLabel(month)+'</strong></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div><label style="'+labelStyle+'">📞 هدف تماس روزانه</label><input id="kt_calls" type="number" value="'+t.callsPerDay+'" min="1" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">🚗 هدف ویزیت هفتگی</label><input id="kt_visits" type="number" value="'+t.visitsPerWeek+'" min="1" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">🔄 هدف تعداد قراردادها</label><input id="kt_sales" type="number" value="'+t.salesCount+'" min="0" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">💰 هدف رقمی فروش (ریال)</label><input id="kt_amount" type="number" value="'+t.salesAmount+'" min="0" placeholder="صفر = از تعداد استفاده شود" style="'+inputStyle+'"></div>'
    +'<div><label style="'+labelStyle+'">💵 هدف درصد نقدی</label><input id="kt_cash" type="number" value="'+t.cashPct+'" min="0" max="100" style="'+inputStyle+'"></div>'
    +'</div>'
    +'<div style="background:var(--bg-raised);border:1px solid #fcd34d;border-radius:6px;padding:8px;margin-top:12px;font-size:11px;color:#92400e">'
    +'<strong>نکته:</strong> اگر هدف رقمی فروش (ریال) صفر باشد، KPI فروش بر اساس تعداد قرارداد محاسبه می‌شود.</div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'kpiTargetsModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="_doSaveKPITargets(\''+userId+'\',\''+month+'\')">💾 ذخیره اهداف</button>';
  openModal('kpiTargetsModal','🎯 تنظیم اهداف — '+USERS[userId],body,foot);
}
function _doSaveKPITargets(userId,month){
  var t={
    callsPerDay:parseInt((document.getElementById('kt_calls')||{}).value)||10,
    visitsPerWeek:parseInt((document.getElementById('kt_visits')||{}).value)||5,
    salesCount:parseInt((document.getElementById('kt_sales')||{}).value)||5,
    salesAmount:parseFloat((document.getElementById('kt_amount')||{}).value)||0,
    cashPct:parseInt((document.getElementById('kt_cash')||{}).value)||50
  };
  saveKPITarget(userId,month,t);
  showToast('✅ اهداف KPI ذخیره شد');
  closeModal('kpiTargetsModal');
  renderKPIPanel();
}

document.addEventListener('DOMContentLoaded',function(){applyStoredTheme();init().catch(function(){showLoginOverlay();});});

// ════════════════════════ CENTER DISTRIBUTION WIZARD ══════════════
function openDistributionWizard(){
  if(!_isManager()){showToast('فقط مدیران دسترسی دارند');return;}
  var members=umGetActive();
  var expertsHTML=members.map(function(m){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-raised);border-radius:6px;margin-bottom:6px">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:'+m.color+'"></div>'
      +'<span style="flex:1;font-size:12px">'+esc(m.name)+'</span>'
      +'<input type="number" id="distPct_'+m.id+'" min="0" max="100" value="'
      +Math.round(100/members.length)+'" style="width:60px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;text-align:center">'
      +'<span style="font-size:11px;color:var(--text-muted)">٪</span>'
      +'</div>';
  }).join('');
  var body='<div id="distWizardBody">'
    +'<div style="background:#dbeafe;border-radius:7px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#1e40af">'
    +'💡 درصد هر کارشناس از کل مراکز را مشخص کنید. مجموع باید ۱۰۰ باشد.</div>'
    +'<div id="distExpertsList">'+expertsHTML+'</div>'
    +'<div style="text-align:left;margin-top:8px;font-size:11px;color:var(--text-muted)">مجموع: <span id="distPctTotal">'+members.reduce(function(s){return s+Math.round(100/members.length);},0)+'</span>٪</div>'
    +'<hr style="margin:14px 0;border-color:var(--border)">'
    +'<div style="font-size:12px;font-weight:700;margin-bottom:8px">شرایط قفل استان‌ها:</div>'
    +'<label style="display:flex;gap:8px;align-items:center;font-size:12px;cursor:pointer;margin-bottom:6px">'
    +'<input type="checkbox" id="distLockContracts" checked> استان‌هایی که کارشناس در آن قرارداد دارد قفل بماند</label>'
    +'<label style="display:flex;gap:8px;align-items:center;font-size:12px;cursor:pointer">'
    +'<input type="checkbox" id="distFreeNoResult"> استان‌های با فعالیت ولی بدون نتیجه آزاد شود</label>'
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'distModal\')">انصراف</button>'
    +'<button class="btn-primary" onclick="computeDistributionProposal()">محاسبه پیشنهاد ◀</button>';
  openModal('distModal','🔀 ویزارد تقسیم مراکز — مرحله ۱',body,foot,{lg:true});
  setTimeout(function(){
    members.forEach(function(m){
      var inp=document.getElementById('distPct_'+m.id);
      if(inp)inp.addEventListener('input',updateDistTotal);
    });
  },50);
}

function updateDistTotal(){
  var members=umGetActive();
  var total=members.reduce(function(s,m){
    var v=parseFloat((document.getElementById('distPct_'+m.id)||{}).value)||0;
    return s+v;
  },0);
  var el=document.getElementById('distPctTotal');
  if(el){
    el.textContent=Math.round(total);
    el.style.color=Math.abs(total-100)<2?'#16a34a':'#dc2626';
  }
}

async function computeDistributionProposal(){
  var members=umGetActive();
  var experts=members.map(function(m){
    return{id:m.id,name:m.name,pct:parseFloat((document.getElementById('distPct_'+m.id)||{}).value)||0};
  });
  var total=experts.reduce(function(s,e){return s+e.pct;},0);
  if(Math.abs(total-100)>5){showToast('⚠ مجموع درصدها باید ۱۰۰ باشد (فعلاً '+Math.round(total)+')');return;}
  var lockContracts=(document.getElementById('distLockContracts')||{}).checked!==false;
  var freeNoResult=!!(document.getElementById('distFreeNoResult')||{}).checked;
  var rules={experts:experts,lockContracts:lockContracts,freeNoResult:freeNoResult};
  showToast('در حال محاسبه...',1500);
  try{
    var r=await fetch('/api/distribution/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:rules})});
    if(!r.ok){var e=await r.json();showToast('⚠ '+(e.error||'خطا'));return;}
    var proposal=await r.json();
    closeModal('distModal');
    showDistributionPreview(proposal);
  }catch(err){
    showToast('⚠ خطا در اتصال: '+err.message);
  }
}

function showDistributionPreview(proposal){
  var assignments=proposal.assignments||[];
  var changed=assignments.filter(function(a){return a.fromUser!==a.toUser;});
  var locked=assignments.filter(function(a){return a.isLocked;});
  var free=changed.filter(function(a){return !a.isLocked;});
  var summaryHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div style="background:#dcfce7;color:#166534;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700">✅ بدون تغییر: '+(assignments.length-changed.length)+'</div>'
    +'<div style="background:#dbeafe;color:#1e40af;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700">🔀 تغییر: '+free.length+'</div>'
    +'<div style="background:#fef3c7;color:#854d0e;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700">🔒 قفل: '+locked.length+'</div>'
    +'</div>';
  var rows=changed.map(function(a){
    var lockIcon=a.isLocked?'🔒':'🔀';
    var fromName=USERS[a.fromUser]||a.fromUser||'—';
    var toName=USERS[a.toUser]||a.toUser||'—';
    return '<tr'+(a.isLocked?' style="opacity:.6"':'')+'>'
      +'<td style="padding:6px 8px;font-size:11px">'+lockIcon+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;font-weight:600">'+esc(a.centerName||a.recKey)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px">'+esc(a.provName||'')+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:#dc2626">'+esc(fromName)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px">→</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:#16a34a;font-weight:600">'+esc(toName)+'</td>'
      +'</tr>';
  }).join('');
  var body=summaryHTML
    +(changed.length===0
      ?'<div style="text-align:center;padding:30px;color:var(--text-muted)">هیچ تغییری پیشنهاد نشده است</div>'
      :'<div style="overflow-x:auto;max-height:55vh;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead><tr style="background:var(--bg-raised)"><th style="padding:7px 8px;text-align:right;font-size:11px"></th><th style="padding:7px 8px;text-align:right;font-size:11px">مرکز</th><th style="padding:7px 8px;text-align:right;font-size:11px">استان</th><th style="padding:7px 8px;text-align:right;font-size:11px">از</th><th></th><th style="padding:7px 8px;text-align:right;font-size:11px">به</th></tr></thead>'
        +'<tbody>'+rows+'</tbody></table></div>')
    +(locked.length?'<div style="margin-top:10px;font-size:11px;color:var(--text-muted)">🔒 موارد قفل: استان‌هایی که کارشناس فعلی قرارداد دارد و نباید تغییر کند.</div>':'');
  var foot='<button class="btn-secondary" onclick="closeModal(\'distPreviewModal\')">انصراف</button>'
    +(changed.length>0
      ?'<button class="btn-primary" style="background:#22c55e" onclick="applyDistributionProposal('+proposal.id+')">✅ تأیید و اعمال ('+changed.length+' تغییر)</button>'
      :'');
  openModal('distPreviewModal','🔀 پیش‌نمایش توزیع مراکز',body,foot,{xl:true});
}

async function applyDistributionProposal(proposalId){
  var r=await fetch('/api/distribution/proposals/'+proposalId+'/approve',{method:'PUT'});
  if(!r.ok){var e=await r.json();showToast('⚠ '+(e.error||'خطا'));return;}
  var d=await r.json();
  await loadDB();
  closeModal('distPreviewModal');
  showToast('✅ '+d.changed+' مرکز تغییر کرد',3000);
  if(currentTab==='provinces')renderTable();
}


/* ══ BLOCK 3: Province Filters / Utility ══ */
function wpNav(delta){
  var sel=document.getElementById('wpSel');if(!sel||!sel.value)return;
  var opts=Array.from(sel.options);
  var idx=opts.findIndex(function(o){return o.value===sel.value;});
  var ni=Math.max(0,Math.min(opts.length-1,idx+delta));
  sel.value=opts[ni].value;
  renderWeekPlan();
}


// ══════════════════════════════════════════════════════════════
// UNIFIED BACKUP SYSTEM v1  (CRM + مطالبات در یک فایل)
// ══════════════════════════════════════════════════════════════

// ── Export ───────────────────────────────────────────────────
function unifiedExport(){
  var repName = (document.getElementById('ubRepName')||{}).value||USER.name||'';
  idbGet('centersDB').then(function(centersData){
    var payload = {
      ver: 5,
      app: 'atena_unified',
      date: todayStr(),
      exportedAt: new Date().toISOString(),
      user: repName || (typeof currentUser!=='undefined'?currentUser:''),
      // CRM data
      db: DB,
      centersDB: centersData||null,
      // مطالبات data
      mtrMeta: JSON.parse(JSON.stringify(META)),
      mtrUser: {name:USER.name,role:USER.role||'rep'},
      // داده‌های اکسل (ردیف‌های مطالبات)
      mtrData: loadData(),
      // تاریخ هدف برآورد وصول
      fcTarget: FC_TARGET||'',
      // لاگ ادغام
      mergeLog: JSON.parse(JSON.stringify(MERGE_LOG||[]))
    };
    var blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var uname = (repName||currentUser||'backup').replace(/[^a-zA-Z\u0600-\u06FF0-9]/g,'_');
    a.download = 'atena_backup_'+uname+'_'+todayStr().replace(/\//g,'-')+'.json';
    a.click(); URL.revokeObjectURL(a.href);
    showToast('💾 بک‌آپ کامل (CRM + مطالبات + داده اکسل) دانلود شد',3000);
    try{localStorage.setItem('alb_'+(USER.name||currentUser||''),todayStr());}catch(e){}
    closeModal('unifiedBackupModal');
  });
}

// ── Restore ───────────────────────────────────────────────────
function unifiedRestore(ev){
  var file = ev.target.files[0]; if(!file) return;
  ev.target.value='';
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var data = JSON.parse(e.target.result);
      if(!data.db && !data.meta){ alert('فایل بک‌آپ معتبر نیست'); return; }
      var cCount = data.centersDB&&data.centersDB.centers?data.centersDB.centers.length:0;
      var msg = 'بازیابی بک‌آپ «'+(data.date||'نامشخص')+'»?\nتمام داده‌های فعلی جایگزین می‌شوند.';
      if(cCount) msg += '\n'+cCount+' مرکز بازیابی می‌شود.';
      if(data.mtrMeta) msg += '\nداده‌های مطالبات هم بازیابی می‌شود.'+(data.mtrData&&data.mtrData.rows?' ('+data.mtrData.rows.length+' ردیف اکسل)':'');
      if(!confirm(msg)) return;
      // ── 1. CRM DB ──────────────────────────────────────────────
      if(data.db){ Object.assign(DB,data.db); saveDB(); }
      // ── 2. Centers: convert flat array → {CENTERS, PC_RAW} ────
      var p = Promise.resolve();
      if(data.centersDB&&data.centersDB.centers){
        var flatCenters = data.centersDB.centers;
        var newCENTERS = [];
        var newPC_RAW  = {};
        var _provIdToName={};
        PROVINCES.forEach(function(p){_provIdToName[p.id]=p.name;});
        flatCenters.forEach(function(c){
          var sid = String(c.id||'');
          if(sid.indexOf('||')<0){
            // Tehran center (id like c_1, c_42)
            newCENTERS.push(c);
          } else {
            // Province center — key by province NAME for _buildPCCache compatibility
            var provId = c.province_id || sid.split('||')[0];
            var provName = _provIdToName[provId] || provId;
            if(!newPC_RAW[provName]) newPC_RAW[provName]=[];
            newPC_RAW[provName].push([c.row||0, c.name||'', c.potential||1, c.type||'', c.lead||'سرنخ']);
          }
        });
        // Save to IndexedDB (offline fallback)
        p = saveMasterCenters(flatCenters);
        // Save to server (primary source) — update in-memory immediately too
        p = p.then(function(){
          CENTERS = newCENTERS;
          Object.keys(PC_RAW).forEach(function(k){delete PC_RAW[k];});
          Object.keys(newPC_RAW).forEach(function(k){PC_RAW[k]=newPC_RAW[k];});
          clearPCCache(); _ALL_PROVS=null;
          return fetch('/api/data/centers/master',{
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({CENTERS:newCENTERS,PC_RAW:newPC_RAW})
          }).then(function(r){
            if(!r.ok) console.warn('[restore] server centers update failed:',r.status);
            return true;
          }).catch(function(e){ console.warn('[restore] server centers error:',e.message); return true; });
        });
      }
      // ── 3. MTR ─────────────────────────────────────────────────
      if(data.mtrMeta){ META=data.mtrMeta; saveMeta(); }
      if(data.mtrUser&&data.mtrUser.name){ USER=data.mtrUser; saveUser(); }
      if(data.mtrData&&data.mtrData.rows&&data.mtrData.rows.length){
        DATA=data.mtrData.rows;
        saveData(DATA);
      }
      if(data.fcTarget){ FC_TARGET=data.fcTarget; }
      if(data.mergeLog&&Array.isArray(data.mergeLog)){ MERGE_LOG=data.mergeLog; saveMergeLog(); }
      // ── 4. Re-init UI ───────────────────────────────────────────
      p.then(function(){
        clearPCCache(); _ALL_PROVS=null; _typeFilterBuilt=false;
        initSettings(); initTags(); initWeekTags(); initEvents();
        rebuildFilters(); buildTypeFilter(); renderTable(); switchTab('provinces');
        if(DATA&&DATA.length){
          var _tb2=document.getElementById('mtr-tabsBar');if(_tb2)_tb2.style.display='flex';
          var _pb=document.getElementById('mtr-printBtn');if(_pb)_pb.style.display='block';
          var _sb=document.getElementById('mtr-searchBar');if(_sb)_sb.style.display='block';
          if(typeof matchCentersToData==='function')setTimeout(matchCentersToData,200);
          if(typeof render==='function')setTimeout(render,300);
        }
        showToast('✅ بک‌آپ بازیابی شد · '+cCount+' مرکز'+(DATA&&DATA.length?' · '+DATA.length+' ردیف مطالبات':''),4000);
        closeModal('unifiedBackupModal');
      });
    }catch(err){ alert('خطا در بازیابی: '+err.message); }
  };
  reader.readAsText(file);
}

// ── Merge ─────────────────────────────────────────────────────
var _ubMergeQueue = [];   // [{filename, data}]
var _ubMergeResults = []; // [{filename, stats, applied}]

function unifiedHandleMergeFiles(ev){
  var files = Array.from(ev.target.files); ev.target.value='';
  if(!files.length) return;
  _ubMergeQueue=[]; _ubMergeResults=[];
  var pend=files.length;
  files.forEach(function(f){
    var r=new FileReader();
    r.onload=function(e){
      try{
        var data=JSON.parse(e.target.result);
        _ubMergeQueue.push({filename:f.name, data:data});
      }catch(x){ _ubMergeQueue.push({filename:f.name,data:null,err:x.message}); }
      if(--pend===0) ubShowMergePreview();
    };
    r.readAsText(f);
  });
}

function ubCalcMergeStats(data){
  var stats={crmEdits:0,crmNotes:0,crmCalls:0,crmVisits:0,crmSales:0,crmWeek:0,
             mtrNotes:0,mtrStatus:0,mtrForecast:0,total:0,user:data.user||data.by||'—'};
  // CRM stats
  var idb = data.db||{};
  Object.keys(idb.edits||{}).forEach(function(k){
    if(!DB.edits[k]||JSON.stringify(DB.edits[k])!==JSON.stringify(idb.edits[k]))stats.crmEdits++;
  });
  (idb.notes||[]).forEach(function(n){
    if(!(DB.notes||[]).some(function(x){return x.id===n.id&&x.text===n.text;}))stats.crmNotes++;
  });
  stats.crmCalls=(idb.callLog||[]).filter(function(x){
    return !(DB.callLog||[]).some(function(y){return y.id===x.id;});}).length;
  stats.crmVisits=(idb.visitLog||[]).filter(function(x){
    return !(DB.visitLog||[]).some(function(y){return y.id===x.id;});}).length;
  stats.crmSales=(idb.salesLog||[]).filter(function(x){
    return !(DB.salesLog||[]).some(function(y){return y.id===x.id;});}).length;
  Object.keys(idb.weekEntries||{}).forEach(function(k){
    var ie=idb.weekEntries[k],le=DB.weekEntries&&DB.weekEntries[k];
    if(!le||(ie.length&&!ie.every(function(x){return(le||[]).some(function(y){return y.id===x.id;});})))stats.crmWeek++;
  });
  // MTR stats
  var bm = data.mtrMeta||data.meta||{};
  Object.keys(bm).forEach(function(inv){
    var be=bm[inv], me=META[inv]||{};
    (be.notes||[]).forEach(function(n){
      if(!(me.notes||[]).some(function(x){return x.d===n.d&&x.t===n.t;}))stats.mtrNotes++;
    });
    if(be.status&&!me.status) stats.mtrStatus++;
    if(be.forecast&&(!me.forecast||j2d(be.forecast.at||'')>j2d(me.forecast&&me.forecast.at||''))) stats.mtrForecast++;
  });
  stats.total = stats.crmEdits+stats.crmNotes+stats.crmCalls+stats.crmVisits+
                stats.crmSales+stats.crmWeek+stats.mtrNotes+stats.mtrStatus+stats.mtrForecast;
  return stats;
}

function ubApplyMerge(data){
  // CRM merge
  var idb = data.db||{};
  Object.keys(idb.edits||{}).forEach(function(k){ if(!DB.edits[k])DB.edits[k]={}; Object.assign(DB.edits[k],idb.edits[k]); });
  (idb.notes||[]).forEach(function(n){ if(n&&n.id){ if(!DB.notes)DB.notes=[]; if(!DB.notes.some(function(x){return x.id===n.id&&x.text===n.text;}))DB.notes.push(n); }});
  ['callLog','visitLog','salesLog','missionLog'].forEach(function(log){
    if(!DB[log])DB[log]=[];
    (idb[log]||[]).forEach(function(x){ if(x&&x.id&&!DB[log].some(function(y){return y.id===x.id;}))DB[log].push(x); });
  });
  Object.keys(idb.weekEntries||{}).forEach(function(k){
    if(!DB.weekEntries)DB.weekEntries={};
    if(!DB.weekEntries[k])DB.weekEntries[k]=[];
    (idb.weekEntries[k]||[]).forEach(function(x){
      if(x&&x.id&&!DB.weekEntries[k].some(function(y){return y.id===x.id;}))DB.weekEntries[k].push(x);
    });
  });
  saveDB();
  // MTR merge
  var bm = data.mtrMeta||data.meta||{};
  Object.keys(bm).forEach(function(inv){
    var be=bm[inv], me=gm(inv);
    (be.notes||[]).forEach(function(n){
      if(!(me.notes=me.notes||[]).some(function(x){return x.d===n.d&&x.t===n.t;}))me.notes.push(n);
    });
    if(be.forecast&&(!me.forecast||j2d(be.forecast.at||'')>=j2d(me.forecast&&me.forecast.at||'')))me.forecast=be.forecast;
    if(be.status&&!me.status)me.status=be.status;
    if(be.nextFU&&(!me.nextFU||j2d(be.nextFU)<j2d(me.nextFU||'9999/99/99')))me.nextFU=be.nextFU;
  });
  saveMeta();
  // Log merge
  var who=data.user||data.by||'';
  if(who){
    var exists=MERGE_LOG.findIndex(function(x){return x.name===who;});
    var entry={name:who,at:data.date||todayStr(),cnt:Object.keys(bm).length};
    if(exists>=0)MERGE_LOG[exists]=entry; else MERGE_LOG.push(entry);
    saveMergeLog();
  }
}

function ubShowMergePreview(){
  var area=document.getElementById('ubMergeArea'); if(!area)return;
  var html='';
  _ubMergeQueue.forEach(function(item,idx){
    if(item.err||!item.data){
      html+='<div style="background:var(--bg-raised);border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px">❌ <strong>'+esc(item.filename)+'</strong>: '+(item.err||'فایل نامعتبر')+'</div>';
      return;
    }
    var s=ubCalcMergeStats(item.data);
    var rowStyle='display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f1f5f9';
    html+='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div><span style="font-size:12px;font-weight:700">'+esc(item.filename)+'</span>'
      +(s.user?'<span style="margin-right:6px;font-size:11px;color:var(--text-muted);background:#e0f2fe;padding:1px 7px;border-radius:10px">👤 '+esc(s.user)+'</span>':'')
      +'</div>'
      +(s.total>0?'<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px">'+s.total+' تغییر</span>'
                :'<span style="background:var(--bg-raised);color:var(--text-muted);font-size:11px;padding:2px 9px;border-radius:10px">بدون تغییر جدید</span>')
      +'</div>';
    if(s.total>0){
      html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">';
      if(s.crmEdits)html+='<div style="'+rowStyle+'"><span>✏️ ویرایش CRM</span><strong>'+s.crmEdits+'</strong></div>';
      if(s.crmNotes)html+='<div style="'+rowStyle+'"><span>📝 یادداشت CRM</span><strong>'+s.crmNotes+'</strong></div>';
      if(s.crmCalls)html+='<div style="'+rowStyle+'"><span>📞 تماس روزانه</span><strong>'+s.crmCalls+'</strong></div>';
      if(s.crmVisits)html+='<div style="'+rowStyle+'"><span>🚗 ویزیت</span><strong>'+s.crmVisits+'</strong></div>';
      if(s.crmSales)html+='<div style="'+rowStyle+'"><span>💰 فروش</span><strong>'+s.crmSales+'</strong></div>';
      if(s.crmWeek)html+='<div style="'+rowStyle+'"><span>📅 برنامه هفته</span><strong>'+s.crmWeek+'</strong></div>';
      if(s.mtrNotes)html+='<div style="'+rowStyle+'"><span>🗒 یادداشت مطالبات</span><strong>'+s.mtrNotes+'</strong></div>';
      if(s.mtrStatus)html+='<div style="'+rowStyle+'"><span>🔖 وضعیت مطالبات</span><strong>'+s.mtrStatus+'</strong></div>';
      if(s.mtrForecast)html+='<div style="'+rowStyle+'"><span>📅 برآورد مطالبات</span><strong>'+s.mtrForecast+'</strong></div>';
      html+='</div>';
    }
    html+='</div>';
  });
  area.innerHTML=html||'<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px">هنوز فایلی انتخاب نشده</div>';
  // show apply button
  var total=_ubMergeQueue.filter(function(x){return !x.err&&x.data;})
    .reduce(function(s,x){return s+ubCalcMergeStats(x.data).total;},0);
  var applyBtn=document.getElementById('ubApplyBtn');
  if(applyBtn){ applyBtn.style.display=total>0?'':'none'; applyBtn.textContent='🔀 اعمال ادغام ('+total+' تغییر)'; }
}

function ubApplyAll(){
  var valid=_ubMergeQueue.filter(function(x){return !x.err&&x.data;});
  if(!valid.length)return;
  valid.forEach(function(item){ ubApplyMerge(item.data); });
  // Refresh UI
  clearPCCache(); _ALL_PROVS=null; _typeFilterBuilt=false;
  rebuildFilters(); buildTypeFilter();
  if(typeof currentTab!=='undefined'&&currentTab==='provinces')renderTable();
  if(DATA.length){updateReminder();render();}
  showToast('✅ '+valid.length+' بک‌آپ با موفقیت ادغام شد',3000);
  closeModal('unifiedBackupModal');
}

// ── Main modal ────────────────────────────────────────────────
function openUnifiedBackup(){
  var lastBK='';
  try{lastBK=localStorage.getItem('alb_'+(USER.name||currentUser||''))||'';}catch(e){}
  var repName=USER.name||'';

  // ── Tab: بک‌آپ ──
  var tabExport='<div id="ubTab_export" class="ub-tab-panel">'
    +'<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;margin-bottom:14px;font-size:12px">'
    +'<strong style="color:#0369a1">📌 بک‌آپ واحد چیست؟</strong><br>'
    +'یک فایل JSON که هم داده‌های CRM (وضعیت مراکز، تماس‌ها، ویزیت، فروش) و هم یادداشت و برآورد مطالبات را ذخیره می‌کند.'
    +'</div>'
    +'<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:5px">نام شما (برای مطالبات)</label>'
    +'<input id="ubRepName" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:6px;font-family:inherit;font-size:12px;direction:rtl" value="'+esc(repName)+'" placeholder="مثال: کاشی‌ساز"></div>'
    +(lastBK?'<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">آخرین بک‌آپ: '+esc(lastBK)+'</div>':'')
    +'<button onclick="unifiedExport()" style="width:100%;background:linear-gradient(135deg,#1e3a5f,#0ea5e9);color:var(--text-primary);border:none;border-radius:7px;padding:11px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">⬇️ دانلود بک‌آپ کامل (CRM + مطالبات)</button>'
    +'<button onclick="downloadServerBackup()" style="width:100%;background:linear-gradient(135deg,#166534,#16a34a);color:#fff;border:none;border-radius:7px;padding:10px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;margin-top:8px">☁️ بکاپ سرور (همه کاربران)</button>'
    +'</div>';

  // ── Tab: بازیابی ──
  var tabRestore='<div id="ubTab_restore" class="ub-tab-panel" style="display:none">'
    +'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:11px 14px;margin-bottom:14px;font-size:12px">'
    +'<strong style="color:#c2410c">⚠️ بازیابی کامل</strong><br>'
    +'تمام داده‌های فعلی (CRM + مطالبات) با فایل بک‌آپ جایگزین می‌شود. این عملیات غیرقابل بازگشت است.'
    +'</div>'
    +'<label style="display:block;padding:20px;border:2px dashed #f59e0b;border-radius:8px;text-align:center;cursor:pointer;background:#fffbeb" onclick="document.getElementById(\'restoreInp\').click()">'
    +'<div style="font-size:28px;margin-bottom:6px">📂</div>'
    +'<div style="font-size:13px;font-weight:700;color:#92400e">فایل بک‌آپ را انتخاب کنید</div>'
    +'<div style="font-size:11px;color:#a16207;margin-top:3px">فرمت JSON · پشتیبانی از بک‌آپ v3 و v4</div>'
    +'</label>'
    +'</div>';


  var body='<div>'
    // Tab buttons
    +'<div style="display:flex;gap:4px;margin-bottom:14px;background:var(--bg-raised);border-radius:8px;padding:3px">'
    +'<button class="ub-tablink active" id="ubLink_export" onclick="ubSwitchTab(\'export\')" style="flex:1;padding:7px;border:none;border-radius:6px;background:#1e3a5f;color:var(--text-primary);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">💾 بک‌آپ</button>'
    +'<button class="ub-tablink" id="ubLink_restore" onclick="ubSwitchTab(\'restore\')" style="flex:1;padding:7px;border:none;border-radius:6px;background:transparent;color:var(--text-secondary);font-family:inherit;font-size:12px;cursor:pointer">📂 بازیابی</button>'
    +'</div>'
    +tabExport+tabRestore
    +'</div>';

  openModal('unifiedBackupModal','💾 مدیریت بک‌آپ', body,
    '<button class="btn-secondary" onclick="closeModal(\'unifiedBackupModal\')">بستن</button>',
    {lg:true});
}

function ubSwitchTab(tab){
  ['export','restore'].forEach(function(t){
    var panel=document.getElementById('ubTab_'+t);
    var link=document.getElementById('ubLink_'+t);
    if(panel)panel.style.display=t===tab?'':'none';
    if(link){
      link.style.background=t===tab?'#1e3a5f':'transparent';
      link.style.color=t===tab?'#fff':'#475569';
      link.style.fontWeight=t===tab?'700':'400';
    }
  });
}

// Keyboard shortcut
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='b'&&!e.target.matches('input,textarea')){
    e.preventDefault(); openUnifiedBackup();
  }
});
// ══ END UNIFIED BACKUP ══════════════════════════════════════



/* ═══ public/js/mtr.js ═══ */
// ══════════════════════════════════════════════════════════════
// مطالبات ↔ مراکز — اتصال فاکتورهای باز به صفحه مرکز
// ══════════════════════════════════════════════════════════════

var MTR_BY_CENTER = {};   // centerId → [invoice rows]
var MTR_UNMATCHED = [];   // customers not found

function _normName(s){
  return String(s||'')
    .replace(/[ي]/g,'ی').replace(/[ك]/g,'ک')
    .replace(/[‌\u200c]/g,' ')
    .replace(/\s+/g,' ').trim();
}


// ── اعلان خودکار پیگیری مطالبات ──────────────────────────────
function mtrCheckFollowupNotifs(){
  if(typeof sendNotif!=='function'||typeof DB==='undefined')return;
  var today=TODAY_STR||todayStr();
  DATA.forEach(function(r){
    var m=gm(r.inv);
    if(!m.nextFU||m.nextFU!==today)return;
    // find the userId for this follower
    var member=mtrFindMember(r.follower);
    var toId=member?member.id:null;
    // also notify manager
    var mgId=(typeof umGetMembers==='function'?umGetMembers():DB.settings&&DB.settings.members||[]).find(function(x){return x.role==='مدیر'&&x.active;});
    var msg='💰 پیگیری مطالبات: '+esc(r.customer)+' — '+Math.round(r.rem/1000000).toFixed(1)+'M — '+r.od+' روز تأخیر';
    if(toId&&toId!==currentUser)sendNotif(toId,msg,'');
    if(mgId&&mgId.id!==toId&&mgId.id!==currentUser)sendNotif(mgId.id,msg,'');
    m._notifSent=today; // prevent duplicate on same day
  });
}

function matchCentersToData(){
  MTR_BY_CENTER = {};
  MTR_UNMATCHED = [];
  if(!DATA||!DATA.length) return;

  // Build flat centers list from cache (sync)
  _buildPCCache();
  var allCenters = [];
  getAllProvinces().forEach(function(p){
    getProvCenters(p.id).forEach(function(ctr){
      allCenters.push({id: ctr.id, name: _normName(ctr.name)});
    });
  });
  // Add extras
  (DB.extra||[]).forEach(function(ctr){
    allCenters.push({id: ctr.id, name: _normName(ctr.name)});
  });

  // Match each invoice customer to a center
  DATA.forEach(function(row){
    var cust = _normName(row.customer);
    if(!cust || cust === '—') return;

    var match = null;
    // Pass 1: exact
    match = allCenters.find(function(ctr){ return ctr.name === cust; });
    // Pass 2: center name contains customer name
    if(!match) match = allCenters.find(function(ctr){ return ctr.name.indexOf(cust) !== -1; });
    // Pass 3: customer name contains center name (min 5 chars)
    if(!match) match = allCenters.find(function(ctr){ return ctr.name.length >= 5 && cust.indexOf(ctr.name) !== -1; });
    // Pass 4: word-level — 2+ shared tokens (min 3 chars)
    if(!match){
      var custWords = cust.split(' ').filter(function(w){ return w.length >= 3; });
      match = allCenters.find(function(ctr){
        var hits = 0;
        custWords.forEach(function(w){ if(ctr.name.indexOf(w) !== -1) hits++; });
        return hits >= 2;
      });
    }

    if(match){
      if(!MTR_BY_CENTER[match.id]) MTR_BY_CENTER[match.id] = [];
      MTR_BY_CENTER[match.id].push(row);
    } else {
      MTR_UNMATCHED.push(row.customer);
    }
  });

  var total = DATA.length;
  var matched = total - MTR_UNMATCHED.length;
  console.log('[مطالبات↔مراکز] ' + matched + '/' + total + ' فاکتور match شد. (' + Object.keys(MTR_BY_CENTER).length + ' مرکز)');
}

function mtrCenterSection(centerId){
  var rows = MTR_BY_CENTER[centerId];
  if(!rows || !rows.length) return '';
  var total = rows.reduce(function(s,r){ return s+r.rem; }, 0);
  var overdue = rows.filter(function(r){ return r.od > 0; });
  var urgent  = rows.filter(function(r){ return r.od > 45; });
  var urgColor = urgent.length ? '#dc2626' : overdue.length ? '#d97706' : '#0ea5e9';

  var h = '<div style="margin-top:14px;border-top:1.5px solid #e2e8f0;padding-top:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<div style="font-size:12px;font-weight:700;color:'+urgColor+'">💰 مطالبات باز</div>'
    + '<div style="font-size:11px;background:'+urgColor+';color:var(--text-primary);border-radius:12px;padding:2px 9px;font-weight:700">'
    +  rows.length+' فاکتور · '+fM(total)+'</div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:4px">';

  rows.sort(function(a,b){ return b.od - a.od; }).forEach(function(r){
    var c2 = r.od > 45 ? '#dc2626' : r.od > 20 ? '#d97706' : r.od > 0 ? '#2563eb' : '#64748b';
    var bg = r.od > 45 ? '#fef2f2' : r.od > 20 ? '#fffbeb' : '#f8fafc';
    h += '<div style="background:'+bg+';border:1px solid var(--border);border-right:3px solid '+c2+';border-radius:5px;padding:5px 9px;font-size:11px;display:flex;gap:8px;align-items:center">'
      + '<span style="color:var(--text-muted);min-width:50px">ف'+esc(r.inv)+'</span>'
      + '<span style="font-weight:700;color:'+c2+';flex:1">'+fF(r.rem)+'</span>'
      + '<span style="color:var(--text-muted)">سررسید: '+esc(r.due||'—')+'</span>'
      + '<span style="background:'+c2+';color:var(--text-primary);border-radius:10px;padding:1px 7px;font-weight:700">'
      +  (r.od > 0 ? r.od+' روز' : 'جدید')+'</span>'
      + '<span style="color:var(--text-muted);font-size:10px">'+esc(r.follower)+'</span>'
      + '</div>';
  });

  h += '</div></div>';
  return h;
}

// ════════════════════════════════════════════

// ─── مطالبات Inline Calendar Modal ────────────────────────────
var _MDM = {inv:'', type:'', y:0, m:0, sy:0, sm:0, sd:0}; // modal date picker state

function openMtrDateModal(inv, type){
  _MDM.inv = inv;
  _MDM.type = type;
  var meta = gm(inv);
  var cur = type==='fu' ? (meta.nextFU||TODAY_STR) : (meta.forecast ? meta.forecast.date : FC_TARGET);
  var parts = (cur||TODAY_STR).split('/').map(Number);
  _MDM.y  = parts[0]||1405;
  _MDM.m  = parts[1]||1;
  _MDM.sy = parts[0]||0;
  _MDM.sm = parts[1]||0;
  _MDM.sd = parts[2]||0;
  var curPct = meta.forecast ? meta.forecast.pct : 90;
  var title = type==='fu' ? '📅 تاریخ پیگیری' : '📅 تاریخ برآورد دریافت';

  var pctRow = type==='forecast'
    ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">'
      +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">درصد احتمال دریافت</div>'
      +'<div style="display:flex;gap:8px">'
      + [100,90,50].map(function(p){
          return '<button class="mdrPctBtn" data-p="'+p+'" onclick="mdrPickPct(this)"'
            +' style="flex:1;padding:9px;border:1.5px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;background:'+(curPct===p?'#0ea5e9':'var(--bg-raised)')+';color:'+(curPct===p?'#fff':'var(--text-secondary)')+'">'+p+'٪</button>';
        }).join('')
      +'</div><input type="hidden" id="mdrPct" value="'+curPct+'"></div>'
    : '';

  var body = '<div id="mdrCal" style="direction:rtl"></div>' + pctRow;
  var foot = '<button class="btn-secondary" onclick="closeModal(\'mdrModal\')">لغو</button>'
           + '<button class="btn-primary" onclick="saveMtrDate()">💾 ثبت</button>';

  openModal('mdrModal', title, body, foot);
  setTimeout(function(){ _renderMdrCal(); }, 60);
}

function _renderMdrCal(){
  var el = document.getElementById('mdrCal');
  if(!el) return;
  var y=_MDM.y, m=_MDM.m;
  var td = TODAY_STR.split('/').map(Number);
  var fdow = jFDOW(y,m), dim = jDIM(y,m);
  var cells = '';
  for(var e=0;e<fdow;e++) cells += '<div style="aspect-ratio:1"></div>';
  for(var d=1;d<=dim;d++){
    var isToday = (y===td[0] && m===td[1] && d===td[2]);
    var isSel   = (y===_MDM.sy && m===_MDM.sm && d===_MDM.sd);
    var bg  = isSel  ? '#0ea5e9' : isToday ? 'var(--brand-bg)' : 'transparent';
    var col = isSel  ? '#fff'    : isToday ? '#0ea5e9'         : 'var(--text-secondary)';
    var brd = isSel  ? '#0ea5e9' : isToday ? '#0ea5e9'         : 'transparent';
    var fw  = (isSel || isToday) ? '700' : '400';
    cells += '<button onclick="_mdrDay('+d+')" style="aspect-ratio:1;width:100%;background:'+bg
      +';border:1.5px solid '+brd+';border-radius:7px;color:'+col+';font-family:inherit;font-size:13px;font-weight:'+fw
      +';cursor:pointer;display:flex;align-items:center;justify-content:center">'+d+'</button>';
  }

  var selLabel = _MDM.sd
    ? JM[_MDM.sm-1]+' '+_MDM.sy+' — روز '+_MDM.sd
    : 'تاریخی انتخاب نشده';

  el.innerHTML =
    // Header nav
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    +'<button onclick="_mdrNav(-1)" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:16px;color:var(--text-primary)">‹</button>'
    +'<span style="font-size:15px;font-weight:700;color:var(--text-primary)">'+JM[m-1]+' '+y+'</span>'
    +'<button onclick="_mdrNav(1)" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:16px;color:var(--text-primary)">›</button>'
    +'</div>'
    // Day-of-week headers
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">'
    +['ش','ی','د','س','چ','پ','ج'].map(function(d){
      return '<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:3px 0">'+d+'</div>';
    }).join('')+'</div>'
    // Day cells
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">'+cells+'</div>'
    // Selected date label
    +'<div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:7px;font-size:12px;text-align:center;color:'
    +(_MDM.sd?'var(--brand)':'var(--text-muted)')+';font-weight:'+(_MDM.sd?'700':'400')+'">'+selLabel+'</div>'
    // Today shortcut
    +'<div style="margin-top:8px;text-align:center">'
    +'<button onclick="_mdrToday()" style="background:transparent;border:1px solid var(--border);border-radius:5px;padding:4px 14px;font-size:11px;cursor:pointer;color:var(--text-secondary);font-family:inherit">📅 امروز</button>'
    +'</div>';
}

function _mdrNav(dir){
  _MDM.m += dir;
  if(_MDM.m > 12){ _MDM.m=1; _MDM.y++; }
  if(_MDM.m < 1){ _MDM.m=12; _MDM.y--; }
  _renderMdrCal();
}

function _mdrDay(d){
  _MDM.sy = _MDM.y;
  _MDM.sm = _MDM.m;
  _MDM.sd = d;
  _renderMdrCal();
}

function _mdrToday(){
  var td = TODAY_STR.split('/').map(Number);
  _MDM.y=td[0]; _MDM.m=td[1]; _MDM.sy=td[0]; _MDM.sm=td[1]; _MDM.sd=td[2];
  _renderMdrCal();
}

function mdrPickPct(btn){
  document.querySelectorAll('.mdrPctBtn').forEach(function(b){
    b.style.background='var(--bg-raised)'; b.style.color='var(--text-secondary)';
  });
  btn.style.background='#0ea5e9'; btn.style.color='#fff';
  var pctEl=document.getElementById('mdrPct');
  if(pctEl) pctEl.value=btn.dataset.p;
}

function saveMtrDate(){
  if(!_MDM.sy || !_MDM.sm || !_MDM.sd){
    toast('⚠ لطفاً یک روز انتخاب کنید'); return;
  }
  var d = _MDM.sy+'/'+p2(_MDM.sm)+'/'+p2(_MDM.sd);
  if(_MDM.type==='fu'){
    setNextFU(_MDM.inv, d);
  } else {
    var pct = parseInt((document.getElementById('mdrPct')||{}).value||90);
    setForecast(_MDM.inv, d, pct);
  }
  closeModal('mdrModal');
  render();
  updateReminder();
  toast('✅ ثبت شد');
}


// ── FC_TARGET date modal ──────────────────────────────────────
var _FCTM = {y:0, m:0, sy:0, sm:0, sd:0};

function openFCTargetModal(){
  var parts = (FC_TARGET||TODAY_STR).split('/').map(Number);
  _FCTM.y=parts[0]||1405; _FCTM.m=parts[1]||1;
  _FCTM.sy=parts[0]||0; _FCTM.sm=parts[1]||0; _FCTM.sd=parts[2]||0;
  var body = '<div id="fctmCal" style="direction:rtl"></div>';
  var foot = '<button class="btn-secondary" onclick="closeModal(\'fctmModal\')">لغو</button>'
           + '<button class="btn-primary" onclick="saveFCTarget()">✅ تأیید</button>';
  openModal('fctmModal','📅 تاریخ هدف برآورد',body,foot);
  setTimeout(_renderFCTMCal,60);
}

function _renderFCTMCal(){
  var el=document.getElementById('fctmCal'); if(!el)return;
  var y=_FCTM.y, m=_FCTM.m;
  var td=TODAY_STR.split('/').map(Number);
  var fdow=jFDOW(y,m), dim=jDIM(y,m);
  var cells='';
  for(var e=0;e<fdow;e++) cells+='<div style="aspect-ratio:1"></div>';
  for(var d=1;d<=dim;d++){
    var isToday=(y===td[0]&&m===td[1]&&d===td[2]);
    var isSel=(y===_FCTM.sy&&m===_FCTM.sm&&d===_FCTM.sd);
    var bg=isSel?'#0ea5e9':isToday?'var(--brand-bg)':'transparent';
    var col=isSel?'#fff':isToday?'#0ea5e9':'var(--text-secondary)';
    var brd=isSel?'#0ea5e9':isToday?'#0ea5e9':'transparent';
    var fw=(isSel||isToday)?'700':'400';
    cells+='<button onclick="_fctmDay('+d+')" style="aspect-ratio:1;width:100%;background:'+bg
      +';border:1.5px solid '+brd+';border-radius:7px;color:'+col+';font-family:inherit;font-size:13px;font-weight:'+fw
      +';cursor:pointer;display:flex;align-items:center;justify-content:center">'+d+'</button>';
  }
  var selLabel=_FCTM.sd ? (JM[_FCTM.sm-1]+' '+_FCTM.sy+' — روز '+_FCTM.sd) : 'تاریخی انتخاب نشده';
  el.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    +'<button onclick="_fctmNav(-1)" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:16px;color:var(--text-primary)">‹</button>'
    +'<span style="font-size:15px;font-weight:700;color:var(--text-primary)">'+JM[m-1]+' '+y+'</span>'
    +'<button onclick="_fctmNav(1)" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:16px;color:var(--text-primary)">›</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">'
    +['ش','ی','د','س','چ','پ','ج'].map(function(d){return'<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:3px 0">'+d+'</div>';}).join('')+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">'+cells+'</div>'
    +'<div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:7px;font-size:12px;text-align:center;color:'
    +(_FCTM.sd?'var(--brand)':'var(--text-muted)')+';font-weight:'+(_FCTM.sd?'700':'400')+'">'+selLabel+'</div>'
    +'<div style="margin-top:8px;text-align:center">'
    +'<button onclick="_fctmToday()" style="background:transparent;border:1px solid var(--border);border-radius:5px;padding:4px 14px;font-size:11px;cursor:pointer;color:var(--text-secondary);font-family:inherit">📅 امروز</button>'
    +'</div>';
}
function _fctmNav(dir){_FCTM.m+=dir;if(_FCTM.m>12){_FCTM.m=1;_FCTM.y++;}if(_FCTM.m<1){_FCTM.m=12;_FCTM.y--;}  _renderFCTMCal();}
function _fctmDay(d){_FCTM.sy=_FCTM.y;_FCTM.sm=_FCTM.m;_FCTM.sd=d;_renderFCTMCal();}
function _fctmToday(){var td=TODAY_STR.split('/').map(Number);_FCTM.y=td[0];_FCTM.m=td[1];_FCTM.sy=td[0];_FCTM.sm=td[1];_FCTM.sd=td[2];_renderFCTMCal();}
function saveFCTarget(){
  if(!_FCTM.sy||!_FCTM.sm||!_FCTM.sd){toast('⚠ لطفاً یک روز انتخاب کنید');return;}
  FC_TARGET=_FCTM.sy+'/'+p2(_FCTM.sm)+'/'+p2(_FCTM.sd);
  closeModal('fctmModal');
  render();
  toast('✅ تاریخ هدف ثبت شد');
}


// ── مقایسه آپلود جدید با قبلی ─────────────────────────────────
function showUploadComparison(newRows, rawAB){
  var oldTotal=DATA.reduce(function(s,r){return s+r.rem;},0);
  var newTotal=newRows.reduce(function(s,r){return s+r.rem;},0);
  var diff=newTotal-oldTotal;
  var diffColor=diff<0?'#16a34a':diff>0?'#dc2626':'#64748b';
  var diffIcon=diff<0?'▼':'▲';

  // مراکز وصول‌شده (در قدیم بودند، در جدید نیستند)
  var oldInvs=DATA.map(function(r){return r.inv;});
  var newInvs=newRows.map(function(r){return r.inv;});
  var collected=DATA.filter(function(r){return newInvs.indexOf(r.inv)===-1;});
  var added=newRows.filter(function(r){return oldInvs.indexOf(r.inv)===-1;});
  var collectedSum=collected.reduce(function(s,r){return s+r.rem;},0);

  var body=
    // کارت مقایسه
    '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:16px">'
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:12px;text-align:center">'
      +'<div style="font-size:10.5px;color:var(--text-muted);margin-bottom:4px">آپلود قبلی</div>'
      +'<div style="font-size:15px;font-weight:800;color:var(--text-primary)">'+fM(oldTotal)+'</div>'
      +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+DATA.length+' فاکتور</div>'
    +'</div>'
    +'<div style="font-size:22px;color:'+diffColor+'">→</div>'
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:12px;text-align:center">'
      +'<div style="font-size:10.5px;color:var(--text-muted);margin-bottom:4px">آپلود جدید</div>'
      +'<div style="font-size:15px;font-weight:800;color:var(--text-primary)">'+fM(newTotal)+'</div>'
      +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+newRows.length+' فاکتور</div>'
    +'</div>'
    +'</div>'
    // خلاصه تغییرات
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:12px">'
      +'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
        +'<span style="color:var(--text-muted)">تغییر کل مطالبات:</span>'
        +'<span style="font-weight:700;color:'+diffColor+'">'+(diff<0?'':'+')+(diff/1000000).toFixed(1)+'M '+diffIcon+'</span>'
      +'</div>'
      +(collected.length?'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
        +'<span style="color:var(--text-muted)">وصول شده ('+collected.length+' فاکتور):</span>'
        +'<span style="font-weight:700;color:#16a34a">'+fM(collectedSum)+' ✅</span>'
      +'</div>':'')
      +(added.length?'<div style="display:flex;justify-content:space-between">'
        +'<span style="color:var(--text-muted)">فاکتورهای جدید:</span>'
        +'<span style="font-weight:700;color:#d97706">'+added.length+' مورد 🆕</span>'
      +'</div>':'')
    +'</div>'
    +(collected.length?'<div style="font-size:11.5px;font-weight:700;color:#16a34a;margin-bottom:6px">✅ وصول شده:</div>'
      +'<div style="max-height:100px;overflow-y:auto;margin-bottom:12px">'
      +collected.slice(0,5).map(function(r){
        return '<div style="font-size:11px;color:var(--text-secondary);padding:2px 0;border-bottom:1px solid var(--border)">'
          +esc(r.customer)+' — '+fM(r.rem)+'</div>';
      }).join('')
      +(collected.length>5?'<div style="font-size:10px;color:var(--text-muted);padding-top:3px">و '+(collected.length-5)+' مورد دیگر...</div>':'')
      +'</div>':'')
    +'<div style="font-size:11px;color:var(--text-muted)">⚠ بعد از تأیید، دیتای قدیمی با دیتای جدید جایگزین می‌شود. یادداشت‌ها و متادیتا حفظ می‌شوند.</div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'uploadCmpModal\');mtrCancelUpload()">لغو</button>'
    +'<button class="btn-primary" onclick="closeModal(\'uploadCmpModal\');mtrConfirmUpload()">✅ جایگزین کن</button>';

  window._pendingUploadAB = rawAB;
  window._pendingUploadRows = newRows;
  openModal('uploadCmpModal','🔄 مقایسه با آپلود قبلی',body,foot);
}

function mtrCancelUpload(){
  window._pendingUploadAB=null;
  window._pendingUploadRows=null;
  var _main=document.getElementById('mtr-main');
  if(_main&&DATA.length)render();
}

function mtrConfirmUpload(){
  if(window._pendingUploadAB){
    processAB(window._pendingUploadAB);
    window._pendingUploadAB=null;
    window._pendingUploadRows=null;
  }
}

// مطالبات v7 — embedded in CRM
// ════════════════════════════════════════════

// ═══════════ STATE ═══════════
var DATA=[],META={},USER={name:'',role:'rep'};
var TAB='priority',FILTER='همه',MTR_SEARCH='',AI_TXT='',AI_LOADING=false;
var TODAY_STR='',TODAY_DAYS=0,FC_TARGET='';
var _raw=null,_exp={};
var SNAP=null;      // {at, map:{inv:{rem,od,follower,customer,due}}}
// ── DATA persistence ──────────────────────────────────────────
function saveData(rows){
  var at=TODAY_STR;
  try{localStorage.setItem('am_data',JSON.stringify({at:at,rows:rows}));}catch(e){}
  // sync to server (non-blocking)
  fetch('/api/data/mtr',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:rows,at:at})}).catch(function(){});
}
function loadData(){
  try{var s=localStorage.getItem('am_data');return s?JSON.parse(s):null;}catch(e){return null;}
}
var COMP_DATA=[];   // rows from comparison file
var COMP_AT='';     // date label of comparison file
var MERGE_LOG=[];   // [{name,at,cnt}] — merge history per rep

// ═══════════ STORAGE ═══════════
function saveMeta(){
  try{localStorage.setItem('am4',JSON.stringify(META));}catch(e){}
  // sync to server (non-blocking)
  fetch('/api/data/kv/mtr-meta',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(META)}).catch(function(){});
}
function loadMeta(){
  try{var s=localStorage.getItem('am4');if(s){META=JSON.parse(s);return;}}catch(e){}
  // fallback: try server
  fetch('/api/data/kv/mtr-meta').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(d&&typeof d==='object'){META=d;try{localStorage.setItem('am4',JSON.stringify(META));}catch(e){}}
  }).catch(function(){});
}
function saveUser(){try{localStorage.setItem('au2',JSON.stringify(USER));}catch(e){}}
function loadUser(){try{var s=localStorage.getItem('au2');if(s)USER=JSON.parse(s);}catch(e){}}
function saveMergeLog(){try{localStorage.setItem('aml',JSON.stringify(MERGE_LOG));}catch(e){}}
function loadMergeLog(){try{var s=localStorage.getItem('aml');if(s)MERGE_LOG=JSON.parse(s);}catch(e){}}
function saveSnap(rows){
  var map={};
  rows.forEach(function(r){map[r.inv]={rem:r.rem,od:r.od,follower:r.follower,customer:r.customer,due:r.due};});
  var snap={at:TODAY_STR,map:map};
  try{localStorage.setItem('asnap',JSON.stringify(snap));}catch(e){}
  return snap;
}
function loadSnap(){try{var s=localStorage.getItem('asnap');return s?JSON.parse(s):null;}catch(e){return null;}}
function gm(inv){if(!META[inv])META[inv]={status:'',notes:[],nextFU:'',forecast:null};return META[inv];}
function setStatus(inv,s){gm(inv).status=s;saveMeta();}
function setNextFU(inv,d){
  gm(inv).nextFU=d;
  saveMeta();
  // اضافه کردن خودکار به برنامه هفته
  if(d && typeof wpEntryKey==='function' && typeof DB!=='undefined'){
    var row=DATA.find(function(r){return r.inv===inv;});
    if(row){
      var parts=d.split('/').map(Number);
      if(parts.length===3){
        var ws=wkStart(parts[0],parts[1],parts[2]);
        var weekId=ws[0]+'/'+p2(ws[1])+'/'+p2(ws[2]);
        var eKey=weekId+':::mtr:::'+inv;
        var remFmt=row.rem?Math.round(row.rem).toLocaleString('fa')+' ت':'';
        var label='📄 '+row.customer+' — '+remFmt;
        if(!DB.weekEntries[eKey]){
          DB.weekEntries[eKey]={
            scheduledDate:d, done:false, doneDate:null,
            rtype:'mtr', rid:inv, recKey:'mtr_'+inv,
            centerName:label, actionType:'call',
            addedBy:currentUser,
            mtrAmount:row.rem, mtrCustomer:row.customer,
            mtrInv:inv
          };
          saveDB();
          showToast('📄 پیگیری مطالبات به برنامه هفته اضافه شد',2500);
        } else {
          // به‌روزرسانی اگر تاریخ تغییر کرده
          DB.weekEntries[eKey].scheduledDate=d;
          DB.weekEntries[eKey].centerName=label;
          DB.weekEntries[eKey].mtrAmount=row.rem;
          saveDB();
        }
      }
    }
  }
}
function mtrAddNote(inv,txt){if(!txt.trim())return;gm(inv).notes.push({d:TODAY_STR,t:txt.trim(),by:USER.name||'—'});saveMeta();}
function setForecast(inv,date,pct){gm(inv).forecast={date:date,pct:pct,by:USER.name||'—',at:TODAY_STR};saveMeta();}

// ═══════════ DATE UTILS ═══════════
var NW=[[2020,2,20,1399],[2021,2,20,1400],[2022,2,21,1401],[2023,2,21,1402],
        [2024,2,20,1403],[2025,2,20,1404],[2026,2,20,1405],[2027,2,21,1406],
        [2028,2,20,1407],[2029,2,20,1408],[2030,2,20,1409]];
var JM=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
var LY={1399:1,1403:1,1408:1};
function getNW(gy){for(var i=NW.length-1;i>=0;i--)if(NW[i][0]===gy)return NW[i];return null;}
function calcTodayJ(){
  var n=new Date();n.setHours(12,0,0,0);
  var gy=n.getFullYear(),nw=getNW(gy),nd,jy;
  if(!nw)return'1405/03/02';
  nd=new Date(gy,nw[1],nw[2]);nd.setHours(12,0,0,0);jy=nw[3];
  if(n<nd){var p=getNW(gy-1);if(!p)return'1405/03/02';nd=new Date(gy-1,p[1],p[2]);nd.setHours(12,0,0,0);jy=p[3];}
  var doy=Math.round((n-nd)/86400000),md=[31,31,31,31,31,31,30,30,30,30,30,LY[jy]?30:29],jm=0,rem=doy;
  while(jm<11&&rem>=md[jm]){rem-=md[jm];jm++;}
  return jy+'/'+p2(jm+1)+'/'+p2(rem+1);
}
function j2d(s){
  if(!s)return 0;
  var n=String(s).trim().replace(/[۰-۹]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-1728);}).replace(/-/g,'/');
  var p=n.split('/');if(p.length!==3)return 0;
  var y=+p[0],m=+p[1],d=+p[2];
  if(!y||!m||!d||y<1300||y>1500)return 0;
  var md=0;for(var i=1;i<m;i++)md+=i<=6?31:i<=11?30:29;
  return(y-1400)*365+Math.floor((y-1400)/4)+md+d;
}
function setToday(s){TODAY_STR=s;TODAY_DAYS=j2d(s);var _tb=document.getElementById('mtr-todayBtn');if(_tb)_tb.textContent=s;}
function p2(n){return n<10?'0'+n:String(n);}
function j2Date(jy,jm,jd){
  for(var i=0;i<NW.length;i++){
    if(NW[i][3]===jy){
      var nd=new Date(NW[i][0],NW[i][1],NW[i][2]),md=[31,31,31,31,31,31,30,30,30,30,30,29],days=0;
      for(var m=1;m<jm;m++)days+=md[m-1];
      days+=jd-1;nd.setDate(nd.getDate()+days);return nd;
    }
  }
  return new Date(jy+621,2,21);
}
function jFDOW(jy,jm){return(j2Date(jy,jm,1).getDay()+1)%7;}
function jDIM(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return LY[jy]?30:29;}
function addDJ(jStr,days){
  var d=j2d(jStr)+days,y=1400+Math.floor((d-1)/365),rem=d-(y-1400)*365-Math.floor((y-1400)/4)-1;
  if(rem<0){y--;rem=d-(y-1400)*365-Math.floor((y-1400)/4)-1;}
  var md=[31,31,31,31,31,31,30,30,30,30,30,29],m=0;
  while(m<11&&rem>=md[m]){rem-=md[m];m++;}
  return y+'/'+p2(m+1)+'/'+p2(rem+1);
}

// ═══════════ DATE PICKER ═══════════
var DP={vy:0,vm:0,sy:0,sm:0,sd:0,cb:null};
function pickDate(cur,cb){
  DP.cb=cb;
  var t=TODAY_STR.split('/').map(Number),p=(cur||TODAY_STR).split('/').map(Number);
  DP.vy=p[0]||t[0];DP.vm=p[1]||t[1];DP.sy=p[0]||0;DP.sm=p[1]||0;DP.sd=p[2]||0;
  _rdp();
}
function _rdp(){
  var el=document.getElementById('mtr-dpOv');
  if(!el){el=document.createElement('div');el.id='mtr-dpOv';el.className='dp-ov';document.body.appendChild(el);}
  var y=DP.vy,m=DP.vm,td=TODAY_STR.split('/').map(Number),fdow=jFDOW(y,m),dim=jDIM(y,m);
  var cells='';
  for(var e=0;e<fdow;e++)cells+='<div class="dp-d"></div>';
  for(var d=1;d<=dim;d++){
    var it=(y===td[0]&&m===td[1]&&d===td[2]),is=(y===DP.sy&&m===DP.sm&&d===DP.sd);
    cells+='<button class="dp-d'+(is?' s':it?' t':'')+'" onclick="dpSel('+d+')">'+d+'</button>';
  }
  el.innerHTML='<div class="dp-pnl">'
    +'<div class="dp-hdr"><button class="dp-nav" onclick="dpNav(-1)">‹</button>'
    +'<span style="font-size:14px;font-weight:700;color:var(--text-primary)">'+JM[m-1]+' '+y+'</span>'
    +'<button class="dp-nav" onclick="dpNav(1)">›</button></div>'
    +'<div class="dp-grid" style="margin-bottom:5px"><div class="dp-dh">ش</div><div class="dp-dh">ی</div><div class="dp-dh">د</div><div class="dp-dh">س</div><div class="dp-dh">چ</div><div class="dp-dh">پ</div><div class="dp-dh">ج</div></div>'
    +'<div class="dp-grid">'+cells+'</div>'
    +'<div class="dp-foot">'
    +'<button class="dp-fb" style="background:#334155;color:var(--text-muted)" onclick="dpToday()">امروز</button>'
    +'<button class="dp-fb" style="background:#334155;color:var(--text-muted)" onclick="dpClear()">پاک</button>'
    +'<button class="dp-fb" style="background:#0ea5e9;color:#fff;font-weight:700" onclick="dpClose()">بستن</button>'
    +'</div></div>';
}
function dpNav(d){DP.vm+=d;if(DP.vm<1){DP.vm=12;DP.vy--;}if(DP.vm>12){DP.vm=1;DP.vy++;}_rdp();}
function dpSel(d){DP.sy=DP.vy;DP.sm=DP.vm;DP.sd=d;var s=DP.sy+'/'+p2(DP.sm)+'/'+p2(d);if(DP.cb)DP.cb(s);dpClose();}
function dpToday(){var t=TODAY_STR.split('/').map(Number);DP.vy=t[0];DP.vm=t[1];dpSel(t[2]);}
function dpClear(){if(DP.cb)DP.cb('');dpClose();}
function dpClose(){var el=document.getElementById('mtr-dpOv');if(el)el.remove();}

function mtrSparkline(){
  var pts=DB.mtrTrend||[];
  if(pts.length<2)return'';
  var W=260,H=48,pad=4;
  var vals=pts.map(function(p){return p.total;});
  var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
  var range=mx-mn||1;
  var coords=vals.map(function(v,i){
    var x=pad+(W-pad*2)*i/(vals.length-1);
    var y=H-pad-(H-pad*2)*(v-mn)/range;
    return x+','+y;
  }).join(' ');
  var lastPtStr=coords.split(' ').pop();var lx=lastPtStr.split(',')[0],ly=lastPtStr.split(',')[1];
  var trend=vals[vals.length-1]>=vals[vals.length-2]?'🔴':'🟢';
  return'<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">'+trend+' روند مطالبات ('+pts.length+' نقطه)</div>'
    +'<svg width="'+W+'" height="'+H+'" style="overflow:visible;display:block">'
    +'<polyline points="'+coords+'" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linejoin="round"/>'
    +'<circle cx="'+lx+'" cy="'+ly+'" r="3" fill="#0ea5e9"/>'
    +'</svg>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:4px">آخرین: '+fM(vals[vals.length-1])+'</div>'
    +'</div>';
}

// ═══════════ AMOUNT / URGENCY ═══════════
function fM(r){if(!r&&r!==0)return'—';if(!r)return'—';return Math.round(r).toLocaleString();}
function fF(r){return r?Math.round(r).toLocaleString():'—';}
function urg(d){
  if(d>90)return{l:'بحرانی +۹۰',c:'#dc2626',bg:'#fef2f2',bc:'#dc262633',cls:'c4',lv:4};
  if(d>60)return{l:'تخلف ۶۰ روز',c:'#ea580c',bg:'#fff7ed',bc:'#ea580c33',cls:'c3',lv:3};
  if(d>30)return{l:'اورژانسی',c:'#d97706',bg:'#fffbeb',bc:'#d9770633',cls:'c2',lv:2};
  if(d>0) return{l:'پیگیری',c:'#2563eb',bg:'#eff6ff',bc:'#2563eb33',cls:'c1',lv:1};
  return      {l:'جاری',c:'#16a34a',bg:'#f0fdf4',bc:'#16a34a33',cls:'c0',lv:0};
}
function actTxt(d){
  if(d>90)return'⛔ توقف فروش + اقدام حقوقی';
  if(d>60)return'🚨 تماس فوری مدیر + ضرب‌الاجل ۴۸ ساعته';
  if(d>30)return'📞 تماس کارشناس + ثبت میزیتو';
  if(d>0) return'💬 یادآوری + پیش‌فاکتور';
  return'✓ زیر نظر';
}
var STM={'':{l:'بدون وضعیت',c:'#64748b'},contacted:{l:'تماس گرفته',c:'#2563eb'},
  meeting:{l:'جلسه',c:'#7c3aed'},promised:{l:'قول داده',c:'#16a34a'},
  partial:{l:'پرداخت جزئی',c:'#d97706'},dispute:{l:'در اختلاف',c:'#dc2626'}};

// ═══════════ PARSING ═══════════
var COLS={follower:['پیگیری کننده','پیگیری‌کننده','کارشناس','نماینده','ویزیتور'],inv:['شماره فاکتور','فاکتور','invoice'],
  invDate:['تاریخ فاکتور','تاریخ صدور','تاریخ'],customer:['نام','نام مشتری','مشتری'],province:['استان','شهر'],
  paid:['مقدار واریزی','واریزی','پرداختی'],remaining:['مانده','مانده بدهی','باقیمانده','مانده حساب'],due:['تاریخ سررسید','سررسید','تاریخ پرداخت']};
function gc(hs,ks){for(var k=0;k<ks.length;k++){var t=ks[k].trim();for(var h=0;h<hs.length;h++)if(hs[h].trim()===t)return hs[h].trim();}return null;}
function pDate(v){
  if(!v)return'';
  var s=String(v).trim().replace(/[۰-۹]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-1728);}).replace(/-/g,'/');
  return/^14\d{2}\/\d{1,2}\/\d{1,2}$/.test(s)?s:'';
}
function buildRows(arr){
  if(!arr||!arr.length)return{rows:[],hs:[]};
  var hs=Object.keys(arr[0]),cols={};
  for(var k in COLS)cols[k]=gc(hs,COLS[k]);
  var rows=[];
  arr.forEach(function(o){
    var g=function(k){var c=cols[k];return c?o[c]:undefined;};
    var rem=parseFloat(String(g('remaining')||'0').replace(/,/g,''));
    if(isNaN(rem)||rem<=100)return;
    var due=pDate(g('due')),od=due?TODAY_DAYS-j2d(due):0,u=urg(od);
    rows.push({follower:String(g('follower')||'—').trim(),inv:String(g('inv')||'—').trim(),
      invDate:pDate(g('invDate'))||String(g('invDate')||'').trim(),
      customer:String(g('customer')||'—').trim(),province:String(g('province')||'—').trim(),
      rem:rem,due:due,od:od,urg:u,act:actTxt(od)});
  });
  rows.sort(function(a,b){return b.urg.lv!==a.urg.lv?b.urg.lv-a.urg.lv:b.rem-a.rem;});
  return{rows:rows,hs:hs};
}
function parseTSV(txt){
  var lines=txt.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
  var dl=lines.filter(function(l){return l.indexOf('\t')>-1&&l.indexOf('##')!==0;});
  if(dl.length<2)return{rows:[],err:'فرمت TSV یافت نشد'};
  var hd=dl[0].split('\t').map(function(h){return h.trim();}),arr=[];
  for(var i=1;i<dl.length;i++){var c=dl[i].split('\t'),o={};hd.forEach(function(h,j){o[h]=c[j]||'';});arr.push(o);}
  var r=buildRows(arr);
  return r.rows.length?{rows:r.rows,err:null}:{rows:[],err:'ردیف معتبر یافت نشد · '+r.hs.join(' | ')};
}
function parseXLSX(ab){
  if(typeof XLSX==='undefined')return{rows:[],err:'کتابخانه XLSX بارگذاری نشده — دوباره تلاش کنید'};
  var wb=XLSX.read(ab,{type:'array',raw:true}),ws=wb.Sheets[wb.SheetNames[0]];
  var arr=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
  if(!arr.length)return{rows:[],err:'شیت خالی'};
  var r=buildRows(arr);
  return r.rows.length?{rows:r.rows,err:null}:{rows:[],err:'ردیف معتبر یافت نشد · '+r.hs.slice(0,6).join(' | ')};
}
function handleFI(inp){
  var f=inp.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(e){
    inp.value='';
    _raw=e.target.result;
    // Parse first to preview
    var b=new Uint8Array(e.target.result,0,4),isPK=(b[0]===0x50&&b[1]===0x4B),r;
    try{r=isPK?parseXLSX(e.target.result):parseTSV(new TextDecoder('utf-8').decode(e.target.result));}
    catch(ex){r={rows:[],err:ex.message};}
    if(r.err||!r.rows.length){processAB(e.target.result);return;}
    // If existing data → show comparison first
    if(DATA.length>0){
      if(DATA.length)saveSnap(DATA);
      showUploadComparison(r.rows, e.target.result);
    } else {
      processAB(e.target.result);
    }
  };
  var _main=document.getElementById('mtr-main');
  if(_main)_main.innerHTML='<div class="loader">⏳ در حال پردازش...</div>';
  rd.readAsArrayBuffer(f);
}
function handleCompFI(inp){
  var f=inp.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(e){
    var ab=e.target.result,b=new Uint8Array(ab,0,4),isPK=(b[0]===0x50&&b[1]===0x4B),r;
    try{r=isPK?parseXLSX(ab):parseTSV(new TextDecoder('utf-8').decode(ab));}
    catch(ex){r={rows:[],err:'خطا در پردازش فایل: '+ex.message};}
    if(r.rows.length){COMP_DATA=r.rows;COMP_AT=r.rows[0]?'فایل مرجع':'';render();toast('✅ فایل مقایسه لود شد ('+r.rows.length+' ردیف)');}
    else toast('⚠️ '+(r.err||'خطا در لود فایل مقایسه'));
    inp.value='';
  };
  rd.readAsArrayBuffer(f);
}
function processAB(ab){
  var b=new Uint8Array(ab,0,4),isPK=(b[0]===0x50&&b[1]===0x4B),r;
  if(isPK&&typeof XLSX==='undefined'){
    // lazy-load XLSX then retry
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=function(){processAB(ab);};
    document.head.appendChild(s);
    return;
  }
  try{r=isPK?parseXLSX(ab):parseTSV(new TextDecoder('utf-8').decode(ab));}
  catch(ex){r={rows:[],err:'خطا در پردازش فایل: '+ex.message};}
  if(r.err||!r.rows.length){
    document.getElementById('mtr-main').innerHTML='<div class="upzone" onclick="document.getElementById(\'mtr-fi\').click()"><div style="font-size:38px;margin-bottom:9px">⚠️</div><div style="font-size:14px;font-weight:700;color:var(--text-primary)">فایل جدید انتخاب کنید</div></div><div class="err-box"><div style="font-size:12px;color:#fca5a5">'+( r.err||'دیتایی یافت نشد')+'</div></div>';
    return;
  }
  DATA=r.rows;AI_TXT='';FILTER='همه';MTR_SEARCH='';TAB='priority';_exp={};
  FC_TARGET=addDJ(TODAY_STR,60);
  var _tb2=document.getElementById('mtr-tabsBar');if(_tb2)_tb2.style.display='flex';
  var _pb=document.getElementById('mtr-printBtn');if(_pb)_pb.style.display='block';
  var _sb=document.getElementById('mtr-searchBar');if(_sb)_sb.style.display='block';
  // Load prev snap if not already set
  if(!SNAP)SNAP=loadSnap();
  saveData(DATA); // persist across page reload
  // record trend point for sparkline
  (function(){
    DB.mtrTrend=DB.mtrTrend||[];
    var tTotal=DATA.reduce(function(s,r){return s+(r.rem||0);},0);
    var tDate=todayStr();
    var last=DB.mtrTrend[DB.mtrTrend.length-1];
    if(!last||last.d!==tDate){
      DB.mtrTrend.push({d:tDate,total:tTotal,count:DATA.length});
      if(DB.mtrTrend.length>12)DB.mtrTrend=DB.mtrTrend.slice(-12);
      saveDB();
    }
  })();
  updateReminder();render();mtrCheckFollowupNotifs();
  // auto-map followers then open modal only for remaining unknowns
  setTimeout(function(){
    var autoSaved=mtrAutoMapFollowers();
    var unmapped=mtrGetUnmappedFollowers();
    if(autoSaved&&!unmapped.length){
      showToast('✅ '+autoSaved+' کارشناس به‌صورت خودکار شناسایی شد',3000);
    } else if(unmapped.length){
      if(autoSaved)showToast('✅ '+autoSaved+' کارشناس خودکار شناخته شد — '+unmapped.length+' مورد نیاز به تطبیق دارد',3000);
      setTimeout(function(){showMtrFollowerMapping();},autoSaved?1200:0);
    }
  },500);
  // اتصال به مراکز
  if(typeof matchCentersToData==='function')matchCentersToData();
}
function rebuildAndRender(){if(_raw)processAB(_raw);}

// ═══════════ BACKUP ═══════════

// ═══════════ COMPARISON ═══════════
function computeDelta(prevMap,prevAt,currRows){
  var currMap={};
  currRows.forEach(function(r){currMap[r.inv]=r;});
  var settled=[],collected=[],newInv=[],worsened=[],unchanged=0;
  Object.keys(prevMap).forEach(function(inv){
    var p=prevMap[inv],c=currMap[inv];
    if(!c){settled.push(p);}
    else{
      var diff=p.rem-c.rem;
      if(diff>100)collected.push({prev:p,curr:c,got:diff});
      else if(c.od>p.od+14)worsened.push({prev:p,curr:c,diff:c.od-p.od});
      else unchanged++;
    }
  });
  currRows.forEach(function(r){if(!prevMap[r.inv])newInv.push(r);});
  collected.sort(function(a,b){return b.got-a.got;});
  worsened.sort(function(a,b){return b.diff-a.diff;});
  return{settled:settled,collected:collected,newInv:newInv,worsened:worsened,unchanged:unchanged,prevAt:prevAt};
}

// ═══════════ CUSTOMER MODAL ═══════════
function showCustomer(name){
  var invs=DATA.filter(function(r){return r.customer===name;});
  if(!invs.length)return;
  var total=invs.reduce(function(s,r){return s+r.rem;},0);
  var el=document.createElement('div');
  el.style.cssText='position:fixed;inset:0;background:#000000bb;z-index:8000;display:flex;align-items:flex-end;justify-content:center';
  var body='<div style="background:var(--bg-card);color:var(--text-primary);border-radius:16px 16px 0 0;padding:15px;width:100%;max-width:560px;max-height:82vh;overflow-y:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
    +'<div><div style="font-size:15px;font-weight:800;color:var(--text-primary)">🏥 '+name+'</div>'
    +'<div style="font-size:12px;color:#38bdf8;margin-top:2px">کل بدهی: '+fM(total)+' · '+invs.length+' فاکتور</div></div>'
    +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;color:var(--text-muted);padding:6px 11px;cursor:pointer;font-size:12px">بستن</button>'
    +'</div>';
  invs.forEach(function(r){
    var m=gm(r.inv);
    var lastNote=m.notes&&m.notes.length?m.notes[m.notes.length-1]:null;
    var sc=m.status?STM[m.status]:null;
    var dC=r.od>60?'#dc2626':r.od>30?'#ea580c':r.od>0?'#d97706':'#16a34a';
    body+='<div style="background:var(--bg-raised);border-radius:9px;border:1px solid var(--border);padding:10px 12px;margin-bottom:7px">'
      +'<div style="display:flex;justify-content:space-between;margin-bottom:5px">'
      +'<span style="font-size:11px;color:var(--text-muted)">#'+r.inv+' · '+r.invDate+'</span>'
      +'<span class="badge" style="background:'+r.urg.bg+';color:'+r.urg.c+';border:1px solid '+r.urg.bc+'">'+r.urg.l+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div><div style="font-size:13px;font-weight:700">'+fF(r.rem)+' ریال</div>'
      +'<div style="font-size:11px;color:'+dC+';margin-top:2px">'+(r.od>0?'+'+r.od+' روز تأخیر':'جاری')+' · سررسید: '+r.due+'</div>'
      +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">پیگیر: '+esc(r.follower)+'</div></div>'
      +(sc?'<span style="background:'+sc.c+'22;color:'+sc.c+';padding:3px 9px;border-radius:12px;font-size:10.5px;align-self:flex-start">'+sc.l+'</span>':'')
      +'</div>'
      +(lastNote?'<div style="font-size:11px;color:var(--text-muted);margin-top:6px;border-top:1px solid #334155;padding-top:5px">📝 '+esc(lastNote.t)+' <span style="color:var(--text-muted)">('+esc(lastNote.d)+')</span></div>':'')
      +(m.forecast?'<div style="font-size:11px;color:#16a34a;margin-top:4px">📅 برآورد '+m.forecast.pct+'٪ — '+m.forecast.date+' — '+fM(r.rem*m.forecast.pct/100)+'</div>':'')
      +'</div>';
  });
  body+='</div>';
  el.innerHTML=body;
  document.body.appendChild(el);
  el.addEventListener('click',function(e){if(e.target===el)el.remove();});
}

// ═══════════ PRINT ═══════════
function printView(){
  var rows=filt();
  var _pm=document.getElementById('mtr-printMeta');if(_pm)_pm.textContent='تاریخ: '+TODAY_STR+' · '+FILTER+' · '+rows.length+' فاکتور · کل: '+fM(rows.reduce(function(s,r){return s+r.rem;},0));
  window.print();
}

// ═══════════ REMINDER ═══════════
function updateReminder(){
  var bar=document.getElementById('mtr-remBar');
  if(!bar)return;
  var fu=DATA.filter(function(r){return gm(r.inv).nextFU===TODAY_STR;});
  var c60=DATA.filter(function(r){return r.od>55&&r.od<=60;});
  var msgs=[];
  if(fu.length)msgs.push('📞 '+fu.length+' پیگیری امروز');
  if(c60.length)msgs.push('⚠️ '+c60.length+' نزدیک سقف ۶۰ روز');
  if(msgs.length){bar.textContent=msgs.join(' · ');bar.style.display='block';}
  else bar.style.display='none';
}

// ═══════════ TABS ═══════════
function mtrSwitchTab(t){TAB=t;document.getElementById('mtr-tabsBar').querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('on');});document.getElementById('mtr-t-'+t).classList.add('on');render();}
function setFilter(f){FILTER=f;render();}
function filt(){
  var rows=FILTER==='همه'?DATA:DATA.filter(function(r){return r.follower===FILTER;});
  if(!MTR_SEARCH.trim())return rows;
  var q=MTR_SEARCH.trim().toLowerCase();
  return rows.filter(function(r){
    return (r.customer||'').toLowerCase().indexOf(q)!==-1
        || (r.inv||'').toLowerCase().indexOf(q)!==-1
        || (r.province||'').toLowerCase().indexOf(q)!==-1
        || (r.follower||'').toLowerCase().indexOf(q)!==-1
        || String(r.rem).indexOf(q)!==-1;
  });
}
function folls(){var s=new Set(DATA.map(function(r){return r.follower;}));return['همه'].concat(Array.from(s));}
function tot(rows){return rows.reduce(function(s,r){return s+r.rem;},0);}


// ── خروجی اکسل مطالبات ──────────────────────────────────────
function mtrExportExcel(){
  if(typeof XLSX==='undefined'){
    showToast('⏳ در حال بارگذاری SheetJS...', 2000);
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=function(){mtrExportExcel();};
    document.head.appendChild(s);return;
  }
  var rows=filt();
  var wsData=[['ردیف','شماره فاکتور','مشتری','استان','پیگیر','مانده (ریال)','سررسید','تأخیر (روز)','اورژانس','وضعیت پیگیری','تاریخ پیگیری بعدی','یادداشت']];
  rows.forEach(function(r,i){
    var m=gm(r.inv);
    var lastNote=m.notes&&m.notes.length?m.notes[m.notes.length-1].t:'';
    wsData.push([i+1,r.inv,r.customer,r.province||'',r.follower,r.rem,r.due||'',r.od,r.urg.l,m.status||'',m.nextFU||'',lastNote]);
  });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,'مطالبات',ws);
  var fname='مطالبات_'+TODAY_STR+'.xlsx';
  XLSX.writeFile(wb,fname);
  showToast('✅ اکسل دانلود شد',2000);
}

// ── متن پیام آماده ────────────────────────────────────────────
function mtrCopyMsg(inv){
  var r=DATA.find(function(x){return x.inv===inv;});
  if(!r)return;
  var m=gm(inv);
  var remM=(r.rem/1000000).toFixed(1);
  var msg='با سلام،\n'
    +'بدینوسیله به استحضار می‌رساند که فاکتور شماره '+r.inv
    +' به مبلغ '+remM+' میلیون ریال به تاریخ سررسید '+r.due
    +' در حساب شرکت موجود نمی‌باشد.\n'
    +'خواهشمند است نسبت به تسویه حساب اقدام فرمایید.\n'
    +'با تشکر';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(msg).then(function(){showToast('✅ متن کپی شد',2000);});
  } else {
    var ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('✅ متن کپی شد',2000);
  }
}

// ── ثبت پرداخت جزئی ─────────────────────────────────────────
function mtrRecordPartial(inv){
  var r=DATA.find(function(x){return x.inv===inv;});
  if(!r)return;
  var body='<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px">فاکتور '+inv+' — '+esc(r.customer)+'</div>'
    +'<div style="background:var(--bg-raised);border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:12px">'
    +'<span style="color:var(--text-muted)">مانده فعلی: </span><strong style="color:#dc2626">'+fF(r.rem)+' ریال</strong></div>'
    +'<label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">مبلغ پرداخت‌شده (ریال)</label>'
    +'<input type="number" id="partialAmt" min="1" max="'+r.rem+'" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--border-input);border-radius:7px;font-size:14px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" placeholder="مثال: 5000000">'
    +'<label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin:10px 0 6px">یادداشت (اختیاری)</label>'
    +'<input type="text" id="partialNote" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1.5px solid var(--border-input);border-radius:7px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" placeholder="توضیحات پرداخت...">';
  var foot='<button class="btn-secondary" onclick="closeModal(\'partialModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="_submitPartial(\''+inv+'\')" >💳 ثبت پرداخت</button>';
  openModal('partialModal','💳 ثبت پرداخت جزئی',body,foot);
  setTimeout(function(){var el=document.getElementById('partialAmt');if(el)el.focus();},100);
}

function _submitPartial(inv){
  var amtEl=document.getElementById('partialAmt');var noteEl=document.getElementById('partialNote');
  var amt=parseFloat((amtEl||{}).value||0);var note=(noteEl||{}).value||'';
  if(!amt||amt<=0){showToast('⚠ مبلغ معتبر وارد کنید');return;}
  var r=DATA.find(function(x){return x.inv===inv;});if(!r)return;
  if(amt>r.rem){showToast('⚠ مبلغ از مانده بیشتر است');return;}
  var m=gm(inv);
  if(!m.payments)m.payments=[];
  m.payments.push({d:TODAY_STR,amt:amt,by:USER.name||currentUser,note:note.trim()});
  r.rem=Math.max(0,r.rem-amt);
  mtrAddNote(inv,'💳 پرداخت جزئی: '+fF(amt)+' ریال'+(note?' — '+note:''));
  saveMeta();
  if(r.rem===0){var odx=DATA.indexOf(r);if(odx>=0)DATA.splice(odx,1);}
  closeModal('partialModal');render();updateReminder();
  showToast('✅ پرداخت '+fF(amt)+' ریال ثبت شد',3000);
}

function render(){
  var rows=filt(),total=tot(rows);
  var ov60=rows.filter(function(r){return r.od>60;});
  var ovAny=rows.filter(function(r){return r.od>0;});
  var avgD=ovAny.length?Math.round(ovAny.reduce(function(s,r){return s+r.od;},0)/ovAny.length):0;
  // aging buckets
  var ag0=rows.filter(function(r){return r.od<=0;});
  var ag30=rows.filter(function(r){return r.od>0&&r.od<=30;});
  var ag60=rows.filter(function(r){return r.od>30&&r.od<=60;});
  var ag90=rows.filter(function(r){return r.od>60&&r.od<=90;});
  var ag90p=rows.filter(function(r){return r.od>90;});
  var html=mtrSparkline()
    +'<div class="kpi-g">'
    +'<div class="kpi"><div class="kpi-l">کل مطالبات</div><div class="kpi-v">'+fM(total)+'</div><div class="kpi-ss">ریال · '+rows.length+' فاکتور</div></div>'
    +'<div class="kpi" style="border-color:#16a34a"><div class="kpi-l">✅ جاری (سررسید نرسیده)</div><div class="kpi-v" style="color:#16a34a">'+ag0.length+'</div><div class="kpi-ss">'+fM(tot(ag0))+'</div></div>'
    +'<div class="kpi" style="border-color:#2563eb"><div class="kpi-l">📞 ۱-۳۰ روز تأخیر</div><div class="kpi-v" style="color:#2563eb">'+ag30.length+'</div><div class="kpi-ss">'+fM(tot(ag30))+'</div></div>'
    +'<div class="kpi" style="border-color:#d97706"><div class="kpi-l">⚠️ ۳۰-۶۰ روز</div><div class="kpi-v" style="color:#d97706">'+ag60.length+'</div><div class="kpi-ss">'+fM(tot(ag60))+'</div></div>'
    +'<div class="kpi" style="border-color:#ea580c"><div class="kpi-l">🚨 ۶۰-۹۰ روز</div><div class="kpi-v" style="color:#ea580c">'+ag90.length+'</div><div class="kpi-ss">'+fM(tot(ag90))+'</div></div>'
    +'<div class="kpi" style="border-color:#dc2626"><div class="kpi-l">⛔ ۹۰+ روز (بحرانی)</div><div class="kpi-v" style="color:#dc2626">'+ag90p.length+'</div><div class="kpi-ss">'+fM(tot(ag90p))+'</div></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px">'
    +'<button onclick="mtrExportExcel()" style="font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;padding:5px 12px;cursor:pointer;font-weight:600">📊 خروجی Excel</button>'
    +'<div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;margin-right:4px">میانگین تأخیر: <strong style="margin-right:4px;color:'+(avgD>45?'#ea580c':avgD>20?'#d97706':'#16a34a')+'">'+avgD+' روز</strong></div>'
    +'</div>';
  html+='<div class="filters" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
  +folls().map(function(f){return'<button class="fchip'+(FILTER===f?' on':'')+'" onclick="setFilter(\''+f.replace(/'/g,"\\'")+'\')">'+esc(f)+'</button>';}).join('')
  +'<div style="margin-right:auto;display:flex;gap:5px;flex-shrink:0">'+'<button onclick="showMtrPrioritySend()" style="background:#0ea5e9;color:white;border:none;border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">📨 ارسال اولویت‌دار</button>'+(mtrGetUnmappedFollowers().length?'<button onclick="showMtrFollowerMapping()" style="background:#f59e0b;color:white;border:none;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap" title="کارشناسان ناشناس وجود دارد">🔗 تطبیق کارشناسان ⚠</button>':'<button onclick="showMtrFollowerMapping()" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">🔗 تطبیق کارشناسان</button>')+'<button onclick="showMtrFollowUpSend()" style="background:#16a34a20;color:#16a34a;border:1px solid #16a34a44;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">📅 لیست پیگیری</button>'+'</div>'
  +'</div>';
  if(TAB==='priority')html+=rPriority(rows);
  else if(TAB==='aging')html+=rAging(rows,total);
  else if(TAB==='byrep')html+=rByRep(total);
  else if(TAB==='forecast')html+=rForecast(rows);
  else if(TAB==='compare')html+=rCompare(rows);
  else html+=rAI(rows);
  var _main=document.getElementById('mtr-main');if(_main)_main.innerHTML=html;
  // update overdue badge on mtr tab
  var _ovCount=(typeof DATA!=='undefined'?DATA:[]).filter(function(r){return r&&r.od>0;}).length;
  var _badge=document.getElementById('mtrBadge');
  if(_badge){_badge.textContent=_ovCount>0?String(_ovCount):'';_badge.style.display=_ovCount>0?'inline':'none';}
}

// ═══════════ PRIORITY TAB ═══════════
function tog(inv){_exp[inv]=!_exp[inv];render();}
function mtrGetFollower(custKey){
  var ov=(DB.mtrFollower||{})[custKey];
  if(ov){var m=umGetMembers().find(function(x){return x.id===ov;});return m?m.name:ov;}
  return null;
}
function mtrFindMember(followerName){
  if(!followerName)return null;
  var members=umGetMembers();
  var norm=fNorm(followerName);
  // 0) saved mapping
  var mappedId=(DB.mtrFollowerMap||{})[norm]||(DB.mtrFollowerMap||{})[followerName];
  if(mappedId){var mf=members.find(function(m){return m.id===mappedId;});if(mf)return mf;}
  // 1) exact name or id
  var fm=members.find(function(m){return m.id===followerName||m.name===followerName;});
  if(fm)return fm;
  // 2) normalized exact
  fm=members.find(function(m){return fNorm(m.name)===norm;});
  if(fm)return fm;
  // 3) USERS reverse lookup
  var foundId=null;
  Object.keys(USERS||{}).forEach(function(uid){if(fNorm(USERS[uid])===norm)foundId=uid;});
  if(foundId){fm=members.find(function(m){return m.id===foundId;});if(fm)return fm;}
  // 4) partial word match — all words of Excel name appear in member name or vice versa
  var normWords=norm.split(/\s+/).filter(Boolean);
  var candidates=members.filter(function(m){
    var mn=fNorm(m.name);
    var mnWords=mn.split(/\s+/).filter(Boolean);
    // every word in Excel name is contained in member name
    var allIn=normWords.every(function(w){return mnWords.some(function(mw){return mw===w||mw.indexOf(w)===0||w.indexOf(mw)===0;});});
    if(allIn)return true;
    // or member name is fully contained in Excel name (e.g. Excel has extra title)
    return mnWords.every(function(mw){return normWords.some(function(w){return w===mw||w.indexOf(mw)===0||mw.indexOf(w)===0;});});
  });
  if(candidates.length===1)return candidates[0];
  // 5) last-name only match (unique last word)
  var exLast=normWords[normWords.length-1];
  if(exLast&&exLast.length>2){
    var lastMatches=members.filter(function(m){
      var mw=fNorm(m.name).split(/\s+/);
      return mw.indexOf(exLast)>=0;
    });
    if(lastMatches.length===1)return lastMatches[0];
  }
  return null;
}
// Auto-match all followers and save confident ones; returns count saved
function mtrAutoMapFollowers(){
  if(!DATA||!DATA.length)return 0;
  if(!DB.mtrFollowerMap)DB.mtrFollowerMap={};
  var unique={};
  DATA.forEach(function(r){if(r.follower&&r.follower!=='—')unique[r.follower]=true;});
  var saved=0;
  Object.keys(unique).forEach(function(f){
    var norm=fNorm(f);
    // skip if already mapped
    if(DB.mtrFollowerMap[norm]||DB.mtrFollowerMap[f])return;
    var m=mtrFindMember(f);
    if(m){
      DB.mtrFollowerMap[norm]=m.id;
      DB.mtrFollowerMap[f]=m.id;
      saved++;
    }
  });
  if(saved)saveDB();
  return saved;
}
function mtrGetUnmappedFollowers(){
  if(!DATA||!DATA.length)return[];
  var unique={};
  DATA.forEach(function(r){if(r.follower&&r.follower!=='—')unique[r.follower]=true;});
  return Object.keys(unique).filter(function(f){return!mtrFindMember(f);});
}
function showMtrFollowerMapping(){
  if(!DATA||!DATA.length){showToast('ابتدا فایل مطالبات را آپلود کنید');return;}
  var members=umGetActive();
  var unique={};
  DATA.forEach(function(r){if(r.follower&&r.follower!=='—')unique[r.follower]=true;});
  var followers=Object.keys(unique);
  if(!followers.length){showToast('کارشناسی در فایل یافت نشد');return;}

  var autoCount=0,unknownCount=0;
  var rows=followers.map(function(f){
    var cur=mtrFindMember(f);
    var isSaved=!!(((DB.mtrFollowerMap||{})[fNorm(f)])||((DB.mtrFollowerMap||{})[f]));
    var opts=members.map(function(m){
      return '<option value="'+m.id+'"'+(cur&&cur.id===m.id?' selected':'')+'>'+esc(m.name)+'</option>';
    }).join('');
    opts='<option value="">— انتخاب نشده —</option>'+opts;
    var badge;
    if(cur&&isSaved){autoCount++;badge='<span style="font-size:10px;background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:10px;padding:2px 8px;white-space:nowrap">✓ خودکار</span>';}
    else if(cur){autoCount++;badge='<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:10px;padding:2px 8px;white-space:nowrap">✓ شناخته شد</span>';}
    else{unknownCount++;badge='<span style="font-size:10px;background:#fef9c3;color:#92400e;border:1px solid #fcd34d;border-radius:10px;padding:2px 8px;white-space:nowrap">⚠ ناشناس</span>';}
    var rowBg=cur?'':'background:#fffbeb;';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);'+rowBg+'">'
      +'<span style="flex:1;font-size:12px;font-weight:600;color:var(--text-primary)">'+esc(f)+'</span>'
      +badge
      +'<select id="fmap_'+btoa(unescape(encodeURIComponent(f))).replace(/[^a-z0-9]/gi,'').substring(0,20)+'" data-fn="'+esc(f)+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:var(--text-primary);min-width:150px">'
        +opts
      +'</select>'
    +'</div>';
  }).join('');

  var summaryBg=unknownCount?'background:#fef9c3;border-color:#fcd34d':'background:#f0fdf4;border-color:#86efac';
  var body='<div style="font-size:11px;'+summaryBg+';border:1px solid;border-radius:7px;padding:9px 12px;margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap">'
    +(autoCount?'<span style="color:#15803d">✅ '+autoCount+' شناخته شده</span>':'')
    +(unknownCount?'<span style="color:#92400e">⚠ '+unknownCount+' نیاز به تطبیق دستی</span>':'')
    +'<span style="color:var(--text-muted);margin-right:auto;font-size:10px">این نگاشت یک‌بار ذخیره می‌شود</span>'
    +'</div>'
    +'<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">'+rows+'</div>';

  var foot='<button onclick="mtrSaveFollowerMapping()" style="background:#0ea5e9;color:white;border:none;border-radius:6px;padding:7px 18px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">💾 ذخیره نگاشت</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'mtrMapModal\')" style="margin-right:8px">انصراف</button>';
  openModal('mtrMapModal','🔗 تطبیق کارشناسان اکسل با سیستم',body,foot,{lg:true});
}
function mtrSaveFollowerMapping(){
  var selects=document.querySelectorAll('#mtrMapModal select[data-fn]');
  if(!DB.mtrFollowerMap)DB.mtrFollowerMap={};
  selects.forEach(function(sel){
    var fn=sel.getAttribute('data-fn');
    var val=sel.value;
    if(fn&&val){
      DB.mtrFollowerMap[fNorm(fn)]=val;
      DB.mtrFollowerMap[fn]=val;  // also store raw
    }
  });
  saveDB();
  closeModal('mtrMapModal');
  render();
  showToast('✅ نگاشت کارشناسان ذخیره شد',2500);
}
function mtrSetFollower(custKey,userId){
  if(!DB.mtrFollower)DB.mtrFollower={};
  if(userId)DB.mtrFollower[custKey]=userId;
  else delete DB.mtrFollower[custKey];
  saveDB();
}
function mtrEditFollower(custKey){
  var members=umGetActive();
  var cur=(DB.mtrFollower||{})[custKey]||'';
  var opts=members.map(function(m){
    return '<button onclick="mtrSetFollower(\''+custKey.replace(/'/g,"\\'")+'\''+',\''+m.id+'\');closeModal(\'mtrFolModal\');render()" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:7px;background:'+(cur===m.id?umGetColor(m.id)+'20':'var(--card)')+';cursor:pointer;font-family:inherit;font-size:12px;text-align:right;color:var(--text-primary)">'
      +'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+umGetColor(m.id)+';margin-left:6px"></span>'
      +esc(m.name)+(cur===m.id?' ✓':'')+'</button>';
  }).join('');
  opts+='<button onclick="mtrSetFollower(\''+custKey.replace(/'/g,"\\'")+'\''+',\'\');closeModal(\'mtrFolModal\');render()" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:7px;background:var(--card);cursor:pointer;font-family:inherit;font-size:12px;text-align:right;color:var(--text-muted);margin-top:4px">↩ بازگشت به پیش‌فرض (از فایل)</button>';
  openModal('mtrFolModal','👤 تغییر مسئول پیگیری','<div style="display:flex;flex-direction:column;gap:5px;max-height:50vh;overflow-y:auto">'+opts+'</div>','<button class="btn-secondary" onclick="closeModal(\'mtrFolModal\')">انصراف</button>');
}
function mtrBuildMsg(g, type){
  var isShort=(type==='sms');
  var lines=[];
  if(!isShort){
    lines.push('📋 گزارش مطالبات آتنا زیست درمان');
    lines.push('📅 تاریخ: '+TODAY_STR);
    lines.push('─────────────────────');
  }
  lines.push((isShort?'':'🏥 ')+g.customer);
  if(!isShort) lines.push('📍 '+g.province);
  lines.push('💰 جمع مانده: '+fM(g.totalRem)+' ریال');
  if(g.worstOd>0) lines.push('⏰ بدترین تأخیر: '+g.worstOd+' روز');
  if(!isShort && g.invoices.length>1){
    lines.push('─────────────────────');
    lines.push('📄 فاکتورها:');
    g.invoices.forEach(function(r){
      var m=gm(r.inv);
      lines.push('  #'+r.inv+' · '+fM(r.rem)+(r.od>0?' · +'+r.od+' روز':'')+(m.forecast?' · برآورد: '+m.forecast.pct+'٪':''));
    });
  }
  if(!isShort){
    lines.push('─────────────────────');
    lines.push('لطفاً پیگیری فرمایید 🙏');
  }
  return lines.join('\n');
}
function mtrSendSMS(custKey, phone){
  var apiKey=(DB.settings&&DB.settings.farazApiKey)||'';
  var sender=(DB.settings&&DB.settings.farazSender)||'';
  if(!apiKey||!sender){showMtrSmsSettings();showToast('⚠ ابتدا کلید API فراز را تنظیم کنید',3000);return;}
  var groups=_mtrBuildGroups(filt());
  var g=groups.find(function(x){return x.customer===custKey;});
  if(!g)return;
  var msg=mtrBuildMsg(g,'sms');
  var to=phone.replace(/\D/g,'');
  if(to.startsWith('0'))to='98'+to.slice(1);
  fetch('https://ippanel.com/api/select',{method:'POST',headers:{'Content-Type':'application/json','apikey':apiKey},body:JSON.stringify({op:'send',uname:sender,pass:'',from:sender,to:[to],msg:msg})})
    .then(function(r){return r.json();})
    .then(function(d){showToast(d&&d.status==='OK'?'✅ اس‌ام‌اس ارسال شد':'⚠ خطا: '+(d&&d.message||'ارسال ناموفق'),3000);})
    .catch(function(){showToast('⚠ خطا در ارتباط با سرور فراز',3000);});
}
function mtrSendSMSToUser(userId){
  var m=umGetMembers().find(function(x){return x.id===userId;});
  if(!m||!m.phone){showToast('⚠ شماره موبایل این کارشناس ثبت نشده');return;}
  var phone=m.phone.replace(/\D/g,'').replace(/^0/,'98');
  var rows=filt().filter(function(r){
    var fo=mtrGetFollower(r.customer)||r.follower;
    return fo===m.name||fo===m.id;
  });
  if(!rows.length){showToast('هیچ مطالبه‌ای برای '+m.name+' یافت نشد');return;}
  var groups=_mtrBuildGroups(rows);
  var msg='📋 گزارش روزانه مطالبات\n📅 '+TODAY_STR+'\n👤 '+m.name+'\n─────────────────────\n'
    +groups.map(function(g){return'🏥 '+g.customer+'\n💰 '+fM(g.totalRem)+(g.worstOd>0?' · ⏰+'+g.worstOd+'روز':'');}).join('\n')+'\n─────────────────────\n💰 جمع: '+fM(groups.reduce(function(s,g){return s+g.totalRem;},0));
  var apiKey=(DB.settings&&DB.settings.farazApiKey)||'';
  var sender=(DB.settings&&DB.settings.farazSender)||'';
  if(!apiKey||!sender){
    // No API — show WhatsApp/Telegram links
    var wa='https://wa.me/'+phone+'?text='+encodeURIComponent(msg);
    var tg='https://t.me/+'+phone+'?text='+encodeURIComponent(msg);
    var body='<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">کلید API فراز تنظیم نشده. از طریق:</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px">'
      +'<a href="'+wa+'" target="_blank" style="display:block;padding:10px;background:#25d36620;border:1px solid #25d36644;border-radius:8px;color:#25d366;text-decoration:none;font-weight:700">💬 ارسال در واتساپ</a>'
      +'<a href="'+tg+'" target="_blank" style="display:block;padding:10px;background:#2481cc20;border:1px solid #2481cc44;border-radius:8px;color:#2481cc;text-decoration:none;font-weight:700">📱 ارسال در تلگرام</a>'
      +'<textarea style="width:100%;height:120px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:11px;direction:rtl;font-family:inherit;resize:none" readonly>'+esc(msg)+'</textarea>'
      +'</div>';
    openModal('mtrMsgModal','📨 ارسال گزارش — '+esc(m.name),body,'<button class="btn-secondary" onclick="closeModal(\'mtrMsgModal\')">بستن</button>',{lg:true});
    return;
  }
  fetch('https://ippanel.com/api/select',{method:'POST',headers:{'Content-Type':'application/json','apikey':apiKey},body:JSON.stringify({op:'send',uname:sender,pass:'',from:sender,to:[phone],msg:msg})})
    .then(function(r){return r.json();})
    .then(function(d){showToast(d&&d.status==='OK'?'✅ گزارش ارسال شد برای '+m.name:'⚠ '+(d&&d.message||'خطا'),3000);})
    .catch(function(){showToast('⚠ خطا در ارتباط با فراز',3000);});
}
function _mtrBuildGroups(rows){
  var customers={};
  rows.forEach(function(r){
    var ck=r.customer;
    if(!customers[ck])customers[ck]={customer:ck,province:r.province,invoices:[],totalRem:0,worstOd:-9999,worstUrg:{lv:0,cls:'',bg:'',c:'',bc:'',l:''}};
    var g=customers[ck];
    g.invoices.push(r);g.totalRem+=r.rem;
    if(r.od>g.worstOd){g.worstOd=r.od;g.worstUrg=r.urg;}
  });
  return Object.values(customers).sort(function(a,b){return b.worstUrg.lv-a.worstUrg.lv||b.totalRem-a.totalRem;});
}
function showMtrSmsSettings(){
  var ak=(DB.settings&&DB.settings.farazApiKey)||'';
  var sn=(DB.settings&&DB.settings.farazSender)||'';
  var body='<div style="display:flex;flex-direction:column;gap:10px">'
    +'<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">کلید API فراز SMS</div>'
    +'<input id="farazApiKeyInp" value="'+esc(ak)+'" placeholder="API Key" dir="ltr" style="width:100%;background:var(--bg-input);border:1px solid var(--border-input);border-radius:6px;padding:7px 10px;font-size:12px;font-family:monospace;color:var(--text-primary)"></div>'
    +'<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">شماره فرستنده</div>'
    +'<input id="farazSenderInp" value="'+esc(sn)+'" placeholder="+98XXXXXXXXXX" dir="ltr" style="width:100%;background:var(--bg-input);border:1px solid var(--border-input);border-radius:6px;padding:7px 10px;font-size:12px;font-family:monospace;color:var(--text-primary)"></div>'
    +'<div style="font-size:10px;color:var(--text-muted);background:var(--bg-raised);border-radius:6px;padding:8px">API از پنل فراز SMS → تنظیمات → API دریافت کنید</div>'
    +'</div>';
  var foot='<button onclick="var ak=document.getElementById(\'farazApiKeyInp\').value.trim();var sn=document.getElementById(\'farazSenderInp\').value.trim();if(!DB.settings)DB.settings={};DB.settings.farazApiKey=ak;DB.settings.farazSender=sn;saveDB();closeModal(\'mtrSmsSettModal\');showToast(\'✅ تنظیمات SMS ذخیره شد\')" style="background:#0ea5e9;color:white;border:none;border-radius:6px;padding:7px 18px;cursor:pointer;font-size:12px;font-family:inherit">💾 ذخیره</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'mtrSmsSettModal\')" style="margin-right:8px">انصراف</button>';
  openModal('mtrSmsSettModal','⚙ تنظیمات SMS فراز',body,foot);
}
// ── Single center send panel ──────────────────────────────────
// ── Follow-up date based send list ────────────────────────────
function showMtrFollowUpSend(){
  if(!DATA||!DATA.length){showToast('ابتدا فایل مطالبات را آپلود کنید');return;}

  // Collect invoices with nextFU set, group by customer
  var custMap={};
  DATA.forEach(function(r){
    var m=gm(r.inv);
    if(!m.nextFU)return;
    var ck=r.customer;
    if(!custMap[ck])custMap[ck]={customer:ck,province:r.province,invoices:[],follower:mtrGetFollower(r.customer)||r.follower||'—',totalRem:0,earliestFU:'',fus:[]};
    custMap[ck].invoices.push(r);
    custMap[ck].totalRem+=r.rem;
    custMap[ck].fus.push(m.nextFU);
  });

  if(!Object.keys(custMap).length){
    openModal('mtrFUSendModal','📅 لیست پیگیری',
      '<div style="text-align:center;padding:30px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">📭</div><div style="font-weight:600">هیچ تاریخ پیگیری ثبت نشده</div><div style="font-size:11px;margin-top:6px">برای ثبت تاریخ پیگیری، در تب اولویت روی هر فاکتور کلیک کنید</div></div>',
      '<button class="btn-secondary" onclick="closeModal(\'mtrFUSendModal\')">بستن</button>');
    return;
  }

  // Compute earliestFU per customer
  var today=TODAY_STR;var todayD=j2d(today);
  Object.values(custMap).forEach(function(g){
    g.fus.sort();
    g.earliestFU=g.fus[0];
    g.fuDiff=j2d(g.earliestFU)-todayD; // negative=past, 0=today, positive=future
  });

  // Sort: overdue first → today → tomorrow → future
  var groups=Object.values(custMap).sort(function(a,b){
    return j2d(a.earliestFU)-j2d(b.earliestFU);
  });

  // Build sections
  var sections={overdue:[],today:[],tomorrow:[],soon:[],future:[]};
  groups.forEach(function(g){
    var d=g.fuDiff;
    if(d<0)sections.overdue.push(g);
    else if(d===0)sections.today.push(g);
    else if(d===1)sections.tomorrow.push(g);
    else if(d<=7)sections.soon.push(g);
    else sections.future.push(g);
  });

  var _gIdx=0;
  function renderSection(label,color,icon,items,autoCheck){
    if(!items.length)return'';
    var rows=items.map(function(g){
      var idx=_gIdx++;
      var fm=mtrFindMember(g.follower);
      var hasPhone=!!(fm&&fm.phone);
      var dLabel=g.fuDiff===0?'امروز':g.fuDiff===1?'فردا':(g.fuDiff<0?Math.abs(g.fuDiff)+' روز گذشته':g.fuDiff+' روز دیگر');
      var dColor=g.fuDiff<0?'#dc2626':g.fuDiff===0?'#16a34a':g.fuDiff===1?'#0ea5e9':'var(--text-muted)';
      return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer">'
        +'<input type="checkbox" class="fusl-cb" value="'+idx+'" '+(autoCheck?'checked':'')+' style="width:15px;height:15px;cursor:pointer;flex-shrink:0">'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(g.customer)+'</div>'
          +'<div style="font-size:10px;color:var(--text-muted);margin-top:1px">'+esc(g.province)+' · '+g.invoices.length+' فاکتور · '+fM(g.totalRem)+'</div>'
        +'</div>'
        +'<div style="text-align:left;flex-shrink:0;font-size:10px">'
          +'<div style="font-weight:700;color:'+dColor+'">'+dLabel+'</div>'
          +'<div style="color:var(--text-muted);margin-top:1px">'+esc(g.follower)+(hasPhone?' 📞':'<span style="color:#f59e0b"> ⚠</span>')+'</div>'
        +'</div>'
      +'</label>';
    }).join('');
    return '<div style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:'+color+'18;border-radius:6px;margin-bottom:4px">'
        +'<span style="font-size:13px">'+icon+'</span>'
        +'<span style="font-size:11px;font-weight:700;color:'+color+'">'+label+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted);margin-right:4px">'+items.length+' مرکز</span>'
      +'</div>'
      +'<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">'+rows+'</div>'
    +'</div>';
  }

  // Store groups for retrieval
  window._mtrFUGroups=groups;

  var body='<div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">'
    +'<span style="font-size:11px;color:var(--text-muted);align-self:center">انتخاب سریع:</span>'
    +'<button onclick="document.querySelectorAll(\'.fusl-cb\').forEach(function(c){c.checked=true})" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">همه</button>'
    +'<button onclick="document.querySelectorAll(\'.fusl-cb\').forEach(function(c){c.checked=false})" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">هیچ‌کدام</button>'
    +'<button onclick="fuslSelectRange(-99,0)" style="background:#dc262620;color:#dc2626;border:1px solid #dc262644;border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">⚠ معوق</button>'
    +'<button onclick="fuslSelectRange(0,0)" style="background:#16a34a20;color:#16a34a;border:1px solid #16a34a44;border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">📅 امروز</button>'
    +'<button onclick="fuslSelectRange(-99,1)" style="background:#0ea5e920;color:#0ea5e9;border:1px solid #0ea5e944;border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">امروز + معوق</button>'
    +'</div>'
    +'<div id="fuslList" style="max-height:48vh;overflow-y:auto">'
      +renderSection('معوق — پیگیری نشده','#dc2626','⚠',sections.overdue,true)
      +renderSection('امروز — '+today,'#16a34a','📅 ',sections.today,true)
      +renderSection('فردا','#0ea5e9','🔜',sections.tomorrow,false)
      +renderSection('این هفته','#7c3aed','📆',sections.soon,false)
      +renderSection('آینده','#94a3b8','🗓',sections.future,false)
    +'</div>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:6px;padding:6px 8px;background:var(--bg-raised);border-radius:5px">برای هر کارشناس یک پیام ترکیبی با لیست مراکزش ارسال می‌شود</div>'
  +'</div>';

  var foot='<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="fuslSend(\'wa\')" style="flex:1;min-width:70px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#25d36620;color:#25d366;border:1.5px solid #25d36655;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">💬 واتساپ</button>'
    +'<button onclick="fuslSend(\'tg\')" style="flex:1;min-width:70px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#2481cc20;color:#2481cc;border:1.5px solid #2481cc55;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📱 تلگرام</button>'
    +'<button onclick="fuslSend(\'sms\')" style="flex:1;min-width:70px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#0ea5e920;color:#0ea5e9;border:1.5px solid #0ea5e955;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📨 اس‌ام‌اس</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'mtrFUSendModal\')" style="flex:0 0 auto">بستن</button>'
  +'</div>';

  openModal('mtrFUSendModal','📅 لیست پیگیری و ارسال گزارش',body,foot,{lg:true});
}

function fuslSelectRange(minDiff,maxDiff){
  var gs=window._mtrFUGroups||[];
  document.querySelectorAll('.fusl-cb').forEach(function(cb,i){
    var g=gs[parseInt(cb.value)];
    cb.checked=g&&g.fuDiff>=minDiff&&g.fuDiff<=maxDiff;
  });
}

function fuslSend(app){
  var cbs=document.querySelectorAll('#fuslList .fusl-cb:checked');
  if(!cbs.length){showToast('⚠ هیچ مرکزی انتخاب نشده');return;}
  var gs=window._mtrFUGroups||[];
  var selected=[];
  cbs.forEach(function(cb){var g=gs[parseInt(cb.value)];if(g)selected.push(g);});
  var byFollower=_mtrGroupByFollower(selected);
  closeModal('mtrFUSendModal');
  mtrShowSendQueue(byFollower,app,'followup');
}

function mtrShowCenterSend(custKey){
  var groups=_mtrBuildGroups(filt());
  var g=groups.find(function(x){return x.customer===custKey;});
  if(!g){showToast('مرکز یافت نشد');return;}
  var follower=mtrGetFollower(g.customer)||g.invoices[0].follower||'—';
  var members=umGetMembers();
  var fm=mtrFindMember(follower);
  var phone=(fm&&fm.phone)?fm.phone.replace(/\D/g,'').replace(/^0/,'98'):'';
  var waMsg=mtrBuildMsg(g,'whatsapp');
  var tgMsg=mtrBuildMsg(g,'telegram');
  var smsMsg=mtrBuildMsg(g,'sms');
  var dC=g.worstOd>60?'#dc2626':g.worstOd>30?'#ea580c':g.worstOd>0?'#d97706':'#16a34a';

  var body='<div style="background:var(--bg-raised);border-radius:8px;padding:10px 14px;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:800;color:var(--text-primary);margin-bottom:4px">'+esc(g.customer)+'</div>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text-muted)">'
    +'<span>📍 '+esc(g.province)+'</span>'
    +'<span style="color:'+dC+'">⏰ '+(g.worstOd>0?'+'+g.worstOd+' روز':'به‌روز')+'</span>'
    +'<span>💰 '+fM(g.totalRem)+' ریال</span>'
    +'<span>👤 '+esc(follower)+(phone?' · 📞 '+esc(fm.phone):'<span style="color:#f59e0b"> · بدون شماره</span>')+'</span>'
    +'</div></div>'
    // app buttons
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
  if(phone){
    body+='<a href="https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg)+'" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;background:#25d36618;border:1.5px solid #25d36655;border-radius:10px;color:#25d366;text-decoration:none;font-weight:700;font-size:12px">💬<span>واتساپ</span></a>'
      +'<a href="https://t.me/+'+phone+'?text='+encodeURIComponent(tgMsg)+'" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;background:#2481cc18;border:1.5px solid #2481cc55;border-radius:10px;color:#2481cc;text-decoration:none;font-weight:700;font-size:12px">📱<span>تلگرام</span></a>'
      +'<button onclick="mtrSendSMSRaw(\''+phone+'\',\''+g.customer.replace(/'/g,"\\'")+'\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;background:#0ea5e918;border:1.5px solid #0ea5e955;border-radius:10px;color:#0ea5e9;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;width:100%">📨<span>اس‌ام‌اس</span></button>';
  } else {
    body+='<div style="grid-column:1/-1;text-align:center;padding:10px;font-size:11px;color:#f59e0b;background:#fef3c720;border:1px solid #fcd34d44;border-radius:8px">⚠ برای ارسال مستقیم، شماره موبایل <strong>'+esc(follower)+'</strong> را در تنظیمات کاربران ثبت کنید</div>';
  }
  body+='</div>'
    // message preview
    +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">پیش‌نمایش پیام (واتساپ/تلگرام):</div>'
    +'<textarea id="mtrSendPreview" style="width:100%;height:140px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:11px;direction:rtl;font-family:inherit;resize:vertical;box-sizing:border-box">'+esc(waMsg)+'</textarea>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:4px">می‌توانید متن را ویرایش کنید</div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'mtrSendCenterModal\')">بستن</button>';
  openModal('mtrSendCenterModal','📨 ارسال گزارش مطالبات',body,foot,{lg:true});
}

function mtrSendSMSRaw(phone, custOrMsg){
  var apiKey=(DB.settings&&DB.settings.farazApiKey)||'';
  var sender=(DB.settings&&DB.settings.farazSender)||'';
  // custOrMsg can be customer name (find message) or direct message string
  var msg=custOrMsg;
  if(custOrMsg.length<50){
    var groups=_mtrBuildGroups(filt());
    var g=groups.find(function(x){return x.customer===custOrMsg;});
    if(g)msg=mtrBuildMsg(g,'sms');
  }
  if(!apiKey||!sender){showToast('⚠ کلید API فراز تنظیم نشده — از ⚙ SMS تنظیم کنید',3000);showMtrSmsSettings();return;}
  fetch('https://ippanel.com/api/select',{method:'POST',headers:{'Content-Type':'application/json','apikey':apiKey},body:JSON.stringify({op:'send',uname:sender,pass:'',from:sender,to:[phone],msg:msg})})
    .then(function(r){return r.json();})
    .then(function(d){showToast(d&&d.status==='OK'?'✅ اس‌ام‌اس ارسال شد':'⚠ '+(d&&d.message||'خطا'),3000);})
    .catch(function(){showToast('⚠ خطا در ارتباط با فراز',3000);});
}

// ── Priority bulk send panel ───────────────────────────────────
function showMtrPrioritySend(){
  var groups=_mtrBuildGroups(filt());
  if(!groups.length){showToast('داده‌ای برای ارسال وجود ندارد');return;}
  // sort by worst overdue then total
  groups.sort(function(a,b){return b.worstOd-a.worstOd||b.totalRem-a.totalRem;});
  var members=umGetMembers();

  var items=groups.map(function(g,i){
    var follower=mtrGetFollower(g.customer)||g.invoices[0].follower||'—';
    var fm=mtrFindMember(follower);
    var hasPhone=!!(fm&&fm.phone);
    var dC=g.worstOd>60?'#dc2626':g.worstOd>30?'#ea580c':g.worstOd>0?'#d97706':'#16a34a';
    var autoCheck=g.worstUrg.lv>=3; // بحرانی و بدتر
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;'+(autoCheck?'background:#fef2f220;':'')+'">'
      +'<input type="checkbox" class="msp-cb" value="'+i+'" '+(autoCheck?'checked':'')+' style="width:16px;height:16px;cursor:pointer;flex-shrink:0">'
      +'<span class="badge" style="background:'+g.worstUrg.bg+';color:'+g.worstUrg.c+';border:1px solid '+g.worstUrg.bc+';font-size:9px;padding:1px 5px;flex-shrink:0">'+g.worstUrg.l+'</span>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(g.customer)+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted)">'+esc(g.province)+' · <span style="color:'+dC+'">+'+g.worstOd+' روز</span> · '+fM(g.totalRem)+'</div>'
      +'</div>'
      +'<div style="text-align:left;flex-shrink:0;font-size:10px;color:var(--text-muted)">'+esc(follower)+(hasPhone?' 📞':'<span style="color:#f59e0b"> ⚠</span>')+'</div>'
    +'</label>';
  }).join('');

  var body='<div>'
    // quick selectors
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">'
    +'<span style="font-size:11px;color:var(--text-muted);align-self:center">انتخاب سریع:</span>'
    +'<button onclick="document.querySelectorAll(\'.msp-cb\').forEach(function(c){c.checked=true})" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">همه</button>'
    +'<button onclick="document.querySelectorAll(\'.msp-cb\').forEach(function(c){c.checked=false})" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">هیچ‌کدام</button>'
    +'<button onclick="mtrSelectByUrgency(3)" style="background:#dc262620;color:#dc2626;border:1px solid #dc262644;border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">🔴 بحرانی</button>'
    +'<button onclick="mtrSelectByUrgency(2)" style="background:#ea580c20;color:#ea580c;border:1px solid #ea580c44;border-radius:5px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:inherit">🟠 معوق</button>'
    +'</div>'
    // list
    +'<div id="mspList" style="max-height:45vh;overflow-y:auto;border:1px solid var(--border);border-radius:8px">'+items+'</div>'
    // send instructions
    +'<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding:8px;background:var(--bg-raised);border-radius:6px">💡 پس از انتخاب مراکز، اپلیکیشن مورد نظر برای ارسال را بزنید. برای هر کارشناس یک پیام ترکیبی ساخته می‌شود.</div>'
    +'</div>';

  var foot='<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="mtrSendSelected(\'wa\')" style="flex:1;min-width:80px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#25d36620;color:#25d366;border:1.5px solid #25d36655;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">💬 واتساپ</button>'
    +'<button onclick="mtrSendSelected(\'tg\')" style="flex:1;min-width:80px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#2481cc20;color:#2481cc;border:1.5px solid #2481cc55;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📱 تلگرام</button>'
    +'<button onclick="mtrSendSelected(\'sms\')" style="flex:1;min-width:80px;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;background:#0ea5e920;color:#0ea5e9;border:1.5px solid #0ea5e955;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📨 اس‌ام‌اس</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'mtrPriorityModal\')" style="flex:0 0 auto">بستن</button>'
    +'</div>';

  openModal('mtrPriorityModal','📨 ارسال گزارش اولویت‌دار',body,foot,{lg:true});
}

function mtrSelectByUrgency(minLv){
  var groups=_mtrBuildGroups(filt());
  groups.sort(function(a,b){return b.worstOd-a.worstOd||b.totalRem-a.totalRem;});
  document.querySelectorAll('.msp-cb').forEach(function(cb,i){
    cb.checked = (groups[i]&&groups[i].worstUrg.lv>=minLv);
  });
}

function mtrSendSelected(app){
  var cbs=document.querySelectorAll('#mspList .msp-cb:checked');
  if(!cbs.length){showToast('⚠ هیچ مرکزی انتخاب نشده');return;}
  var groups=_mtrBuildGroups(filt());
  groups.sort(function(a,b){return b.worstOd-a.worstOd||b.totalRem-a.totalRem;});
  var selected=[];
  cbs.forEach(function(cb){selected.push(groups[parseInt(cb.value)]);});
  var byFollower=_mtrGroupByFollower(selected);
  closeModal('mtrPriorityModal');
  mtrShowSendQueue(byFollower,app,'priority');
}

function _mtrGroupByFollower(selectedGroups){
  var byFollower={};
  selectedGroups.forEach(function(g){
    if(!g)return;
    var follower=mtrGetFollower(g.customer)||g.invoices[0].follower||'—';
    if(!byFollower[follower])byFollower[follower]={name:follower,groups:[]};
    byFollower[follower].groups.push(g);
  });
  return byFollower;
}

function mtrShowSendQueue(byFollower,app,sourceCtx){
  var members=Object.values(byFollower);
  if(!members.length){showToast('⚠ هیچ کارشناسی انتخاب نشده');return;}

  var appLabel=app==='wa'?'واتساپ 💬':app==='tg'?'تلگرام 📱':'اس‌ام‌اس 📨';
  var appColor=app==='wa'?'#25d366':app==='tg'?'#2481cc':'#0ea5e9';
  var appBg=app==='wa'?'#25d36618':app==='tg'?'#2481cc18':'#0ea5e918';
  var appBorder=app==='wa'?'#25d36644':app==='tg'?'#2481cc44':'#0ea5e944';

  // Build message per follower
  var queue=members.map(function(f){
    var fm=mtrFindMember(f.name);
    var phone=(fm&&fm.phone)?fm.phone.replace(/\D/g,'').replace(/^0/,'98'):'';
    var totalAmt=f.groups.reduce(function(s,g){return s+g.totalRem;},0);

    // Build full message
    var msg='📋 ';
    msg+=sourceCtx==='followup'?'یادآوری پیگیری مطالبات':'گزارش مطالبات آتنا زیست درمان';
    msg+='\n📅 '+TODAY_STR+'\n👤 '+f.name+'\n═══════════════════\n';
    f.groups.forEach(function(g,i){
      if(sourceCtx==='followup'){
        var dLabel=g.fuDiff===0?'امروز 🎯':g.fuDiff<0?Math.abs(g.fuDiff)+' روز گذشته ⚠':g.fuDiff+' روز دیگر';
        msg+=(i+1)+'. 🏥 '+g.customer+'\n'
          +'   📅 پیگیری: '+g.earliestFU+' ('+dLabel+')\n'
          +'   💰 مانده: '+fM(g.totalRem)+' ریال\n';
      } else {
        var dT=g.worstOd>0?'⏰ +'+g.worstOd+' روز':'✅ به‌روز';
        msg+=(i+1)+'. 🏥 '+g.customer+'\n'
          +'   💰 '+fM(g.totalRem)+' ریال · '+dT+'\n';
      }
      if(g.invoices.length>1){
        g.invoices.forEach(function(r){
          var m=gm(r.inv);
          msg+='   └ #'+r.inv+' · '+fM(r.rem)+(r.od>0?' · +'+r.od+' روز':'')+(m.forecast&&sourceCtx!=='followup'?' · برآورد '+m.forecast.pct+'٪':'')+'\n';
        });
      }
    });
    msg+='═══════════════════\n💰 جمع: '+fM(totalAmt)+' ریال\n\nلطفاً پیگیری فرمایید 🙏';

    return {name:f.name,phone:phone,fm:fm,msg:msg,totalAmt:totalAmt,centerCount:f.groups.length};
  });

  // Render queue rows
  var rows=queue.map(function(q,i){
    var hasPhone=!!q.phone;
    var waHref=hasPhone?'https://wa.me/'+q.phone+'?text='+encodeURIComponent(q.msg):'';
    var tgHref=hasPhone?'https://t.me/+'+q.phone+'?text='+encodeURIComponent(q.msg):'';

    var actionBtn='';
    if(app==='sms'){
      actionBtn=hasPhone
        ?'<button onclick="mtrSendSMSRaw(\''+q.phone+'\',\''+q.name.replace(/'/g,"\\'")+'\');this.style.opacity=0.4;this.textContent=\'✓ ارسال شد\'" '
          +'style="padding:8px 16px;background:'+appBg+';color:'+appColor+';border:1.5px solid '+appBorder+';border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">📨 ارسال SMS</button>'
        :'<span style="font-size:11px;color:#f59e0b;padding:8px">⚠ بدون شماره</span>';
    } else {
      var href=app==='wa'?waHref:tgHref;
      actionBtn=hasPhone
        ?'<a href="'+href+'" target="_blank" onclick="this.parentElement.parentElement.style.opacity=0.5;setTimeout(function(){},300)" '
          +'style="padding:8px 16px;background:'+appBg+';color:'+appColor+';border:1.5px solid '+appBorder+';border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap;display:inline-block">'+appLabel+'</a>'
        :'<span style="font-size:11px;color:#f59e0b;padding:8px">⚠ شماره ثبت نشده</span>';
    }

    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);'+(i===queue.length-1?'border-bottom:none;':'')+'">'
      +'<div style="width:28px;height:28px;border-radius:50%;background:'+appColor+'22;color:'+appColor+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0">'+(i+1)+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13px;font-weight:700;color:var(--text-primary)">'+esc(q.name)+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted);margin-top:1px">'+q.centerCount+' مرکز · '+fM(q.totalAmt)+(q.phone?' · 📞 '+(q.fm&&q.fm.phone?q.fm.phone:''):'')+'</div>'
      +'</div>'
      +actionBtn
    +'</div>';
  }).join('');

  var noPhoneCnt=queue.filter(function(q){return!q.phone;}).length;

  var body='<div>'
    +(noPhoneCnt?'<div style="background:#fef3c720;border:1px solid #fcd34d44;border-radius:7px;padding:8px 12px;margin-bottom:10px;font-size:11px;color:#92400e">⚠ '+noPhoneCnt+' کارشناس شماره ندارند — <button onclick="openUserMgmt()" style="background:none;border:none;color:#0ea5e9;cursor:pointer;font-family:inherit;font-size:11px;text-decoration:underline">ثبت شماره در تنظیمات</button></div>':'')
    +(app!=='sms'?'<div style="background:'+appBg+';border:1px solid '+appBorder+';border-radius:7px;padding:8px 12px;margin-bottom:10px;font-size:11px;color:'+appColor+'">💡 روی دکمه هر کارشناس کلیک کنید تا '+appLabel+' باز شود. هر کلیک یک پنجره جداگانه باز می‌کند.</div>':'')
    +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">'+rows+'</div>'
  +'</div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'mtrSendQueueModal\')">بستن</button>';
  openModal('mtrSendQueueModal','📨 صف ارسال — '+appLabel+' ('+queue.length+' نفر)',body,foot,{lg:true});
}

function rPriority(rows){
  if(!rows.length)return'<div class="loader">هیچ فاکتوری یافت نشد</div>';
  var groups=_mtrBuildGroups(rows);
  return groups.map(function(g,gi){
    var expKey='_g_'+gi;
    var expanded=_exp[expKey];
    var follower=mtrGetFollower(g.customer)||g.invoices[0].follower||'—';
    var members=umGetMembers();
    var followerM=members.find(function(m){return m.name===follower||m.id===follower;});
    var phone=(followerM&&followerM.phone)||'';
    var wa09=phone.replace(/\D/g,'').replace(/^0/,'98');
    var dC=g.worstOd>60?'#dc2626':g.worstOd>30?'#ea580c':g.worstOd>0?'#d97706':'#16a34a';
    var odTxt=g.worstOd>0?'+'+g.worstOd+' روز':g.worstOd===0?'امروز':Math.abs(g.worstOd)+' روز مانده';
    var fcCount=g.invoices.filter(function(r){return gm(r.inv).forecast&&gm(r.inv).forecast.date;}).length;
    var custKey=g.customer;
    var h='<div class="icard '+g.worstUrg.cls+'">'
    // ── header ────────────────────────────────────────────────
    h+='<div class="icard-top" onclick="tog(\''+expKey+'\')">'
      // top row: badge + invoice count
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<span class="badge" style="background:'+g.worstUrg.bg+';color:'+g.worstUrg.c+';border:1px solid '+g.worstUrg.bc+';font-size:10.5px">'+g.worstUrg.l+'</span>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<span style="font-size:11px;color:var(--text-muted);background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:2px 9px">'+g.invoices.length+' فاکتور</span>'
      +'<span style="font-size:13px;color:var(--text-muted);user-select:none">'+(expanded?'▲':'▼')+'</span>'
      +'</div></div>'
      // customer name
      +'<div style="font-size:16px;font-weight:900;color:var(--text-primary);margin-bottom:3px;line-height:1.2">'+esc(g.customer)+'</div>'
      +'<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:5px">📍 '+esc(g.province)+'</div>'
      // meta grid — 2 cols
      +'<div class="cmeta">'
      +'<div class="mi">'
      +'<div class="ml">💰 جمع مانده</div>'
      +'<div class="mv" style="color:'+(g.totalRem>20e9?'#dc2626':g.totalRem>5e9?'#ea580c':'#22c55e')+'">'+fF(g.totalRem)+'</div></div>'
      +'<div class="mi">'
      +'<div class="ml">⏱ بدترین تأخیر</div>'
      +'<div class="mv" style="color:'+dC+'">'+odTxt+'</div></div>'
      +'<div class="mi" style="cursor:pointer" onclick="event.stopPropagation();mtrEditFollower(\''+custKey.replace(/'/g,"\\'")+'\')">'
      +'<div class="ml">👤 مسئول پیگیری</div>'
      +'<div class="mv" style="font-size:12px;color:#38bdf8">'+esc(follower)+' ✎</div></div>'
      +'<div class="mi">'
      +'<div class="ml">📅 برآورد وصول</div>'
      +'<div class="mv" style="font-size:12px;color:#16a34a">'+(fcCount?fcCount+' فاکتور':'—')+'</div></div>'
      +'</div>'
      // action buttons
    h+='<div style="display:flex;gap:7px;margin-top:12px">'
      +'<button onclick="event.stopPropagation();mtrShowCenterSend(\''+custKey.replace(/'/g,"\\'")+'\')" style="flex:1;background:linear-gradient(135deg,#0ea5e920,#6366f115);color:#0ea5e9;border:1px solid #0ea5e944;border-radius:8px;padding:7px 10px;font-size:11.5px;cursor:pointer;font-family:inherit;font-weight:700;transition:background .15s">📨 ارسال گزارش</button>'
      +'<button onclick="event.stopPropagation();mtrEditFollower(\''+custKey.replace(/'/g,"\\'")+'\')" style="flex:0 0 auto;background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;padding:7px 12px;font-size:11.5px;cursor:pointer;font-family:inherit;font-weight:600;transition:all .15s">👤</button>'
      +'</div>';
    // ── invoice tree ──────────────────────────────────────────
    if(expanded){
      g.invoices.forEach(function(r,ii){
        var m=gm(r.inv);
        var invKey='_i_'+gi+'_'+ii;
        var invExp=_exp[invKey];
        var iDC=r.od>60?'#dc2626':r.od>30?'#ea580c':r.od>0?'#d97706':'#16a34a';
        var iDT=r.od>0?'+'+r.od+' روز':r.od===0?'امروز':Math.abs(r.od)+' روز مانده';
        h+='<div style="border-top:1px solid var(--border);background:var(--bg-raised);transition:background .15s">'
          +'<div style="display:flex;align-items:center;gap:7px;padding:10px 14px;cursor:pointer" onclick="event.stopPropagation();tog(\''+invKey+'\')">'
          +'<span style="font-size:9px;color:var(--text-muted);flex-shrink:0">└─</span>'
          +'<span class="badge" style="background:'+r.urg.bg+';color:'+r.urg.c+';border:1px solid '+r.urg.bc+';font-size:9px;padding:1px 6px">'+r.urg.l+'</span>'
          +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);flex-shrink:0">#'+r.inv+'</span>'
          +'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+r.invDate+'</span>'
          +'<span style="flex:1"></span>'
          +(m.forecast?'<span style="font-size:9px;background:#16a34a20;color:#16a34a;border:1px solid #16a34a44;border-radius:8px;padding:1px 6px">📅 '+m.forecast.pct+'٪ '+m.forecast.date+'</span>':'')
          +(m.status?'<span style="font-size:9px;background:'+(STM[m.status]||{c:'#94a3b8'}).c+'22;color:'+(STM[m.status]||{c:'#94a3b8'}).c+';border:1px solid '+(STM[m.status]||{c:'#94a3b8'}).c+'44;border-radius:8px;padding:1px 6px">'+(STM[m.status]||{l:m.status}).l+'</span>':'')
          +'<span style="font-size:12px;font-weight:700;color:'+(r.rem>5e9?'#ea580c':'var(--text-primary)')+'">'+fM(r.rem)+'</span>'
          +'<span style="font-size:10px;color:'+iDC+'">'+iDT+'</span>'
          +'<span style="font-size:10px;color:var(--text-muted)">'+(invExp?'▲':'▼')+'</span>'
          +'</div>';
        if(invExp)h+='<div style="padding:0 12px 10px 12px">'+rExp(r,m)+'</div>';
        h+='</div>';
      });
    }
    h+='</div>';
    return h;
  }).join('');
}
function rExp(r,m){
  var inv=r.inv;
  var h='<div class="icard-exp">';
  h+='<div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:700">وضعیت پیگیری</div>'
    +'<div class="status-row">';
  Object.keys(STM).forEach(function(k){
    var sc=STM[k],on=m.status===k;
    h+='<button class="sbtn'+(on?' on':'')+'" style="'+(on?'background:'+sc.c+'22;border-color:'+sc.c+';color:'+sc.c:'')+';" onclick="setStatus(\''+inv+'\',\''+k+'\');render()">'+sc.l+'</button>';
  });
  h+='</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap">'
    +'<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">🔔 یادآوری:</span>'
    +'<button class="date-btn" data-inv=\''+inv+'\' data-dtype=\'fu\' onclick="event.stopPropagation();openMtrDateModal(this.dataset.inv,this.dataset.dtype)">'+(m.nextFU||'📅 پیگیری')+'</button>'
    +'<button onclick="event.stopPropagation();mtrCopyMsg(\''+inv+'\')" style="font-size:11px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:4px 9px;cursor:pointer;color:var(--text-secondary);font-family:inherit" title="کپی متن پیام">📋 متن پیام</button>'
    +'<button onclick="event.stopPropagation();mtrRecordPartial(\''+inv+'\')" style="font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;padding:4px 9px;cursor:pointer;font-family:inherit;font-weight:600" title="ثبت پرداخت جزئی">💳 پرداخت</button>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:700">یادداشت‌ها</div>';
  if(m.notes&&m.notes.length)(m.notes||[]).slice(-3).forEach(function(n){h+='<div class="note-item">'+esc(n.t)+'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">'+esc(n.d)+' · '+esc(n.by)+'</div></div>';});
  h+='<div class="note-row"><textarea class="note-ta" rows="2" placeholder="یادداشت جدید..." id="ni-'+inv+'"></textarea>'
    +'<button class="save-btn" onclick="var t=document.getElementById(\'ni-'+inv+'\');mtrAddNote(\''+inv+'\',t.value);t.value=\'\';render();toast(\'✅ ذخیره شد\')">ثبت</button></div>'
    +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:700">📅 برآورد وصول</div>'
    +'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">'
    +'<button class="date-btn" id="fb-'+inv+'" data-inv=\''+inv+'\' data-dtype=\'forecast\' onclick="event.stopPropagation();openMtrDateModal(this.dataset.inv,this.dataset.dtype)">'+(m.forecast?m.forecast.date:'📅 برآورد')+'</button>'
    +'<div class="pct-btns" id="fbp-'+inv+'">';
  [100,90,50].forEach(function(p){
    h+='<button class="pbtn'+(m.forecast&&m.forecast.pct===p?' on':'')+'" data-p="'+p+'" onclick="var d=document.getElementById(\'fb-'+inv+'\').textContent;var fd=(!d||d.indexOf(\'/\')<0)?FC_TARGET:d;setForecast(\''+inv+'\',fd,'+p+');render();toast(\'✅\')">'+p+'٪</button>';
  });
  h+='</div></div></div>';
  return h;
}

// ═══════════ AGING TAB ═══════════
function rAging(rows,total){
  var bkts=[{l:'جاری',c:'#16a34a',f:function(r){return r.od<=0;}},
    {l:'۱–۳۰ روز',c:'#2563eb',f:function(r){return r.od>0&&r.od<=30;}},
    {l:'۳۱–۶۰ روز',c:'#d97706',f:function(r){return r.od>30&&r.od<=60;}},
    {l:'۶۱–۹۰ روز',c:'#ea580c',f:function(r){return r.od>60&&r.od<=90;}},
    {l:'+۹۰ روز',c:'#dc2626',f:function(r){return r.od>90;}}
  ].map(function(b){var rs=rows.filter(b.f);return{l:b.l,c:b.c,cnt:rs.length,amt:tot(rs)};});
  var h='<div class="sec-t">بر اساس تاریخ سررسید · امروز: '+TODAY_STR+'</div>';
  h+=bkts.map(function(b){var p=total?b.amt/total*100:0;
    return'<div class="ag-row"><div class="ag-lrow"><span style="color:'+b.c+';font-weight:700">'+b.l+'</span><span style="font-weight:700">'+fM(b.amt)+'</span></div>'
    +'<div class="ag-bg"><div class="ag-fill" style="width:'+p.toFixed(1)+'%;background:'+b.c+'"></div></div>'
    +'<div class="ag-det"><span>'+b.cnt+' فاکتور</span><span>'+p.toFixed(1)+'%</span></div></div>';
  }).join('');
  var ov60=rows.filter(function(r){return r.od>60;});
  if(ov60.length)h+='<div class="alert-r">⚠️ <strong>'+ov60.length+' فاکتور</strong> ('+fM(tot(ov60))+') از سقف ۶۰ روز عبور کرده‌اند.</div>';
  return h;
}

// ═══════════ BYREP TAB ═══════════
function rByRep(gTot){
  var byR={};
  DATA.forEach(function(r){if(!byR[r.follower])byR[r.follower]={amt:0,rows:[]};byR[r.follower].amt+=r.rem;byR[r.follower].rows.push(r);});
  // Compute collection delta per rep (if snap available)
  var snapMap=SNAP?SNAP.map:null;
  var repColl={};
  if(snapMap){
    Object.keys(snapMap).forEach(function(inv){
      var p=snapMap[inv],c=byR[p.follower];
      if(!c)return;
      var currRow=DATA.find(function(r){return r.inv===inv;});
      var diff=currRow?p.rem-currRow.rem:p.rem;
      if(diff>100)repColl[p.follower]=(repColl[p.follower]||0)+diff;
    });
  }
  var arr=Object.entries(byR).sort(function(a,b){return b[1].amt-a[1].amt;});
  var h='<div class="sec-t">مطالبات بر اساس کارشناس پیگیر</div>';
  if(snapMap)h+='<div style="font-size:10.5px;color:var(--text-muted);margin-bottom:10px;background:var(--bg-card);border-radius:8px;padding:8px 11px;border:1px solid var(--border)">📊 مقایسه با نسخه '+SNAP.at+'</div>';
  h+=arr.map(function(e){
    var n=e[0],v=e[1];
    var c60=v.rows.filter(function(r){return r.od>60;}).length;
    var fc=v.rows.filter(function(r){return gm(r.inv).forecast;}).length;
    var pct=gTot?v.amt/gTot*100:0;
    var coll=repColl[n]||0;
    return'<div class="rep-card" style="cursor:pointer;active:opacity:.7" onclick="setFilter(\''+n.replace(/'/g,"\\'")+'\');mtrSwitchTab(\'priority\')"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-weight:700;font-size:13px">'+esc(n)+'</span><div style="display:flex;align-items:center;gap:7px"><span style="font-weight:800;color:#38bdf8;font-size:12.5px">'+fM(v.amt)+'</span><span style="font-size:10px;color:var(--text-muted);background:#334155;padding:2px 7px;border-radius:10px">نمایش ↗</span></div></div>'
    +(coll>0?'<div style="font-size:11px;color:#16a34a;margin-bottom:4px">✅ وصول این دوره: '+fM(coll)+'</div>':'')
    +'<div class="rep-bg"><div class="rep-fill" style="width:'+pct.toFixed(1)+'%;background:'+(c60?'#dc2626':'#0ea5e9')+'"></div></div>'
    +'<div style="display:flex;gap:9px;font-size:11px;color:var(--text-muted);flex-wrap:wrap"><span>'+v.rows.length+' فاکتور</span><span>'+pct.toFixed(1)+'%</span>'+(fc?'<span style="color:#16a34a">📅 '+fc+' برآوردشده</span>':'')+(c60?'<span style="color:#dc2626;font-weight:700">⚠️ '+c60+' تخلف</span>':'')+'</div></div>';
  }).join('');
  return h;
}

// ═══════════ FORECAST TAB ═══════════
function rForecast(rows){
  var tgt=j2d(FC_TARGET);
  var maxR=tot(rows);

  // ── categorize per invoice ───────────────────────────────────
  var fcRows=[]; // {r, m, pct, expected, follower}
  rows.forEach(function(r){
    var m=gm(r.inv);
    if(!m.forecast||!m.forecast.date||!j2d(m.forecast.date)||j2d(m.forecast.date)>tgt)return;
    var follower=mtrGetFollower(r.customer)||r.follower||'—';
    fcRows.push({r:r,m:m,pct:m.forecast.pct,expected:r.rem*(m.forecast.pct/100),follower:follower});
  });

  var s100=fcRows.filter(function(x){return x.pct===100;}).reduce(function(s,x){return s+x.expected;},0);
  var s90=fcRows.filter(function(x){return x.pct===90;}).reduce(function(s,x){return s+x.expected;},0);
  var s50=fcRows.filter(function(x){return x.pct===50;}).reduce(function(s,x){return s+x.expected;},0);
  var stot=s100+s90+s50;

  // ── KPI header ───────────────────────────────────────────────
  var h='<div class="fc-box">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary)">📅 برآورد وصول تا تاریخ:</div>'
    +'<button class="date-btn" style="font-size:13px;font-weight:700;flex:1;text-align:center;border-color:#0ea5e9;color:#0ea5e9" onclick="openFCTargetModal()">'+FC_TARGET+' ✎</button>'
    +'<button onclick="showMtrSmsSettings()" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:10px;cursor:pointer;font-family:inherit">⚙ SMS</button>'
    +'</div>'
    +'<div class="fc-kpis">'
    +'<div class="fc-kpi"><div class="fc-kpi-l">💚 اطمینان کامل</div><div class="fc-kpi-v" style="color:#16a34a">'+fM(s100)+'</div><div style="font-size:9px;color:var(--text-muted)">'+fcRows.filter(function(x){return x.pct===100;}).length+' فاکتور</div></div>'
    +'<div class="fc-kpi"><div class="fc-kpi-l">🔵 ۹۰٪ محتمل</div><div class="fc-kpi-v" style="color:#2563eb">'+fM(s90)+'</div><div style="font-size:9px;color:var(--text-muted)">'+fcRows.filter(function(x){return x.pct===90;}).length+' فاکتور</div></div>'
    +'<div class="fc-kpi"><div class="fc-kpi-l">🟡 ۵۰٪ احتمال</div><div class="fc-kpi-v" style="color:#d97706">'+fM(s50)+'</div><div style="font-size:9px;color:var(--text-muted)">'+fcRows.filter(function(x){return x.pct===50;}).length+' فاکتور</div></div>'
    +'<div class="fc-kpi" style="background:#0ea5e920;border-color:#0ea5e944"><div class="fc-kpi-l">✅ جمع انتظاری</div><div class="fc-kpi-v" style="color:#0ea5e9">'+fM(stot)+'</div><div style="font-size:9px;color:var(--text-muted)">'+(maxR>0?Math.round(stot/maxR*100)+'٪ از کل مطالبات':'')+'</div></div>'
    +'</div>';
  // progress bar
  if(maxR>0){var p=Math.min(stot/maxR*100,100);h+='<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px"><span>پیشرفت وصول</span><span>'+p.toFixed(1)+'٪</span></div><div style="background:#334155;border-radius:5px;height:8px;overflow:hidden"><div style="width:'+p.toFixed(1)+'%;background:linear-gradient(90deg,#16a34a,#0ea5e9);height:100%;border-radius:5px"></div></div></div>';}
  h+='</div>';

  if(!fcRows.length){
    h+='<div style="text-align:center;padding:30px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">📋</div><div>هیچ برآوردی برای این تاریخ ثبت نشده</div><div style="font-size:11px;margin-top:6px">برای ثبت برآورد، در تب اولویت روی هر فاکتور کلیک کنید</div></div>';
    return h;
  }

  // ── per-follower summary ──────────────────────────────────────
  var byFollower={};
  fcRows.forEach(function(x){
    var f=x.follower;
    if(!byFollower[f])byFollower[f]={name:f,rows:[],total:0,expected:0};
    byFollower[f].rows.push(x);
    byFollower[f].total+=x.r.rem;
    byFollower[f].expected+=x.expected;
  });
  var followerList=Object.values(byFollower).sort(function(a,b){return b.expected-a.expected;});

  h+='<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin:12px 0 8px">👤 خلاصه بر اساس کارشناس</div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">';
  followerList.forEach(function(f){
    var members=umGetMembers();
    var fm=mtrFindMember(f.name);
    var color=fm?umGetColor(fm.id):'#0ea5e9';
    var phone=fm&&fm.phone?fm.phone.replace(/\D/g,'').replace(/^0/,'98'):'';
    var pctOfMax=maxR>0?f.expected/maxR*100:0;
    h+='<div style="flex:1;min-width:200px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;overflow:hidden">'
      +'<div style="background:'+color+'18;border-bottom:2px solid '+color+';padding:8px 12px">'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
      +'<span style="width:10px;height:10px;border-radius:50%;background:'+color+';display:inline-block;flex-shrink:0"></span>'
      +'<span style="font-weight:700;font-size:12px;color:var(--text-primary)">'+esc(f.name)+'</span>'
      +'<span style="margin-right:auto;font-size:10px;color:var(--text-muted)">'+f.rows.length+' فاکتور</span>'
      +'</div>'
      +'<div style="font-size:18px;font-weight:800;color:'+color+'">'+fM(f.expected)+'<span style="font-size:10px;font-weight:400;color:var(--text-muted)"> ریال انتظاری</span></div>'
      +'<div style="margin-top:5px"><div style="background:#334155;border-radius:3px;height:5px"><div style="width:'+Math.min(pctOfMax,100).toFixed(1)+'%;background:'+color+';height:100%;border-radius:3px;min-width:2px"></div></div></div>'
      +'</div>'
      +'<div style="padding:6px 10px;display:flex;gap:5px">'
      +(phone?'<a href="https://wa.me/'+phone+'" target="_blank" style="flex:1;text-align:center;background:#25d36620;color:#25d366;border:1px solid #25d36644;border-radius:5px;padding:3px;font-size:10px;text-decoration:none">💬 WA</a><a href="https://t.me/+'+phone+'" target="_blank" style="flex:1;text-align:center;background:#2481cc20;color:#2481cc;border:1px solid #2481cc44;border-radius:5px;padding:3px;font-size:10px;text-decoration:none">📱 TG</a><button onclick="mtrSendSMSToUser(\''+(fm?fm.id:'')+'\''+')" style="flex:1;background:#0ea5e920;color:#0ea5e9;border:1px solid #0ea5e944;border-radius:5px;padding:3px;font-size:10px;cursor:pointer;font-family:inherit">📨 SMS</button>':'<span style="font-size:10px;color:var(--text-muted)">شماره ثبت نشده</span>')
      +'</div>'
    +'</div>';
  });
  h+='</div>';

  // ── per-date breakdown ────────────────────────────────────────
  fcRows.sort(function(a,b){return j2d(a.m.forecast.date)-j2d(b.m.forecast.date);});
  var byDate={};
  fcRows.forEach(function(x){var d=x.m.forecast.date;if(!byDate[d])byDate[d]=[];byDate[d].push(x);});

  h+='<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin:12px 0 8px">📅 تفکیک بر اساس تاریخ</div>';
  Object.keys(byDate).sort().forEach(function(dt){
    var items=byDate[dt];
    var dayExp=items.reduce(function(s,x){return s+x.expected;},0);
    var dayPct=maxR>0?dayExp/maxR*100:0;
    h+='<div style="margin-bottom:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'
      +'<div style="background:var(--bg-raised);padding:8px 12px;display:flex;justify-content:space-between;align-items:center">'
      +'<div>'
      +'<span style="font-size:12px;font-weight:700;color:#0ea5e9">📅 '+dt+'</span>'
      +'<span style="font-size:10px;color:var(--text-muted);margin-right:8px">'+items.length+' فاکتور</span>'
      +'</div>'
      +'<span style="font-size:12px;font-weight:700;color:var(--text-primary)">'+fM(dayExp)+' انتظاری</span>'
      +'</div>'
      +'<div style="padding:2px 0">';
    items.forEach(function(x){
      var pColor=x.pct===100?'#16a34a':x.pct===90?'#2563eb':'#d97706';
      h+='<div style="display:flex;align-items:center;gap:6px;padding:7px 12px;border-top:1px solid var(--border)">'
        +'<span style="font-size:10px;background:'+pColor+'20;color:'+pColor+';border:1px solid '+pColor+'44;border-radius:8px;padding:1px 7px;flex-shrink:0">'+x.pct+'٪</span>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.r.customer)+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted)">#'+x.r.inv+' · '+esc(x.follower)+'</div>'
        +'</div>'
        +'<div style="text-align:left;flex-shrink:0">'
        +'<div style="font-size:12px;font-weight:700;color:var(--text-primary)">'+fM(x.expected)+'</div>'
        +'<div style="font-size:9px;color:var(--text-muted)">از '+fM(x.r.rem)+'</div>'
        +'</div>'
        +'</div>';
    });
    h+='</div></div>';
  });

  // ── unforecasted warning ──────────────────────────────────────
  var unfc=rows.filter(function(r){var m=gm(r.inv);return!m.forecast||!m.forecast.date||j2d(m.forecast.date)>tgt;});
  if(unfc.length){
    h+='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-top:8px">'
      +'<div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px">⚠ '+unfc.length+' فاکتور بدون برآورد تا این تاریخ</div>'
      +'<div style="font-size:10px;color:#991b1b">'+fM(tot(unfc))+' ریال در لیست انتظار</div>'
      +'</div>';
  }
  return h;
}
function rCompare(currRows){
  var h='<div class="fc-box" style="margin-bottom:11px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:11px">🔄 مقایسه دو گزارش</div>'
    // Two explicit upload zones
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:11px">'
    // Old file
    +'<div style="background:var(--bg-raised);border:2px dashed '+(COMP_DATA.length?'#16a34a':'#475569')+';border-radius:10px;padding:13px;text-align:center;cursor:pointer" onclick="document.getElementById(\'mtr-compFI\').click()">'
    +(COMP_DATA.length
      ?'<div style="font-size:11px;color:#16a34a;font-weight:700;margin-bottom:3px">✅ فایل قدیمی</div><div style="font-size:11px;color:var(--text-muted)">'+COMP_DATA.length+' فاکتور</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">برای تغییر کلیک کنید</div>'
      :'<div style="font-size:26px;margin-bottom:5px">📂</div><div style="font-size:11px;color:var(--text-muted);line-height:1.7">فایل قدیمی<br>(هفته/ماه قبل)<br>آپلود کنید</div>'
    )+'</div>'
    // New file (current)
    +'<div style="background:#0f172a;border:2px solid #0ea5e9;border-radius:10px;padding:13px;text-align:center">'
    +'<div style="font-size:11px;color:#0ea5e9;font-weight:700;margin-bottom:3px">📊 فایل جدید</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">'+currRows.length+' فاکتور</div>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:4px">فایل جاری</div>'
    +'</div>'
    +'</div>';

  if(!COMP_DATA.length){
    h+='<div style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:12px;border-top:1px solid #334155;margin-top:4px">👆 فایل قدیمی را آپلود کنید تا مقایسه نمایش داده شود</div>'
      +'</div>';
    return h;
  }

  h+='</div>'; // fc-box

  // Build prevMap ONLY from COMP_DATA (explicit upload)
  var prevMap={};
  COMP_DATA.forEach(function(r){
    prevMap[r.inv]={rem:r.rem,od:r.od,follower:r.follower,customer:r.customer,due:r.due,inv:r.inv};
  });
  var delta=computeDelta(prevMap,'فایل قدیمی',currRows);
  var collAmt=delta.collected.reduce(function(s,x){return s+x.got;},0);
  var collAmtSettled=delta.settled.reduce(function(s,x){return s+x.rem;},0);
  var totalColl=collAmt+collAmtSettled;
  // Summary KPIs
  h+='<div class="comp-kpis">'
    +'<div class="comp-kpi" style="background:#0a1f0a;border-color:#16a34a44"><div class="kpi-l" style="color:var(--text-muted)">وصول شده</div><div class="kpi-v" style="color:#16a34a">'+fM(totalColl)+'</div><div class="kpi-ss">'+delta.collected.length+' جزئی + '+delta.settled.length+' کامل</div></div>'
    +'<div class="comp-kpi" style="background:#0a0f1f;border-color:#2563eb44"><div class="kpi-l" style="color:var(--text-muted)">فاکتور جدید</div><div class="kpi-v" style="color:#2563eb">'+delta.newInv.length+'</div><div class="kpi-ss">'+fM(tot(delta.newInv))+'</div></div>'
    +'<div class="comp-kpi" style="background:'+(delta.worsened.length?'#1c0a0a':'#1a1a1a')+';border-color:'+(delta.worsened.length?'#dc262644':'#334155')+'"><div class="kpi-l" style="color:var(--text-muted)">بدتر شده</div><div class="kpi-v" style="color:'+(delta.worsened.length?'#dc2626':'#64748b')+'">'+delta.worsened.length+'</div><div class="kpi-ss">فاکتور</div></div>'
    +'<div class="comp-kpi" style="background:#1a1a1a;border-color:var(--border)"><div class="kpi-l" style="color:var(--text-muted)">تسویه کامل</div><div class="kpi-v" style="color:#16a34a">'+delta.settled.length+'</div><div class="kpi-ss">'+fM(collAmtSettled)+'</div></div>'
    +'</div>';
  // Collected (partial)
  if(delta.collected.length){
    h+='<div class="sec-t" style="margin-top:4px">💚 وصول جزئی ('+delta.collected.length+')</div>';
    delta.collected.forEach(function(x){
      h+='<div class="comp-row" style="background:#0a1f0a;border-color:#16a34a44">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
        +'<span style="font-size:12px;font-weight:700">'+esc(x.prev.customer)+'</span>'
        +'<span style="font-size:12px;font-weight:800;color:#16a34a">+'+fM(x.got)+'</span></div>'
        +'<div style="font-size:10.5px;color:var(--text-muted)">#'+x.prev.inv+' · '+esc(x.prev.follower)+' · مانده: '+fF(x.curr.rem)+' (قبلاً '+fF(x.prev.rem)+')</div>'
        +'</div>';
    });
  }
  // Settled
  if(delta.settled.length){
    h+='<div class="sec-t" style="margin-top:10px">✅ تسویه کامل ('+delta.settled.length+')</div>';
    delta.settled.forEach(function(x){
      h+='<div class="comp-row" style="background:#0a1f0a;border-color:#16a34a44;opacity:.8">'
        +'<div style="display:flex;justify-content:space-between">'
        +'<span style="font-size:12px;font-weight:700;text-decoration:line-through;color:var(--text-muted)">'+esc(x.customer)+'</span>'
        +'<span style="font-size:12px;color:#16a34a;font-weight:700">'+fM(x.rem)+'</span></div>'
        +'<div style="font-size:10.5px;color:var(--text-muted)">#'+x.inv+' · '+esc(x.follower)+'</div>'
        +'</div>';
    });
  }
  // New
  if(delta.newInv.length){
    h+='<div class="sec-t" style="margin-top:10px">🆕 فاکتور جدید ('+delta.newInv.length+')</div>';
    delta.newInv.forEach(function(r){
      h+='<div class="comp-row" style="background:#0a0f1f;border-color:#2563eb44">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
        +'<span style="font-size:12px;font-weight:700">'+esc(r.customer)+'</span>'
        +'<span style="font-size:12px;color:#2563eb;font-weight:700">'+fF(r.rem)+' ت</span></div>'
        +'<div style="font-size:10.5px;color:var(--text-muted)">#'+r.inv+' · '+esc(r.province)+' · '+esc(r.follower)+' · سررسید: '+r.due+'</div>'
        +'</div>';
    });
  }
  // Worsened
  if(delta.worsened.length){
    h+='<div class="sec-t" style="margin-top:10px">🔴 بدتر شده — تأخیر افزایش یافته ('+delta.worsened.length+')</div>';
    delta.worsened.forEach(function(x){
      h+='<div class="comp-row" style="background:#1c0a0a;border-color:#dc262644">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
        +'<span style="font-size:12px;font-weight:700">'+esc(x.prev.customer)+'</span>'
        +'<span style="font-size:11px;color:#dc2626;font-weight:700">+'+x.diff+' روز تأخیر</span></div>'
        +'<div style="font-size:10.5px;color:var(--text-muted)">#'+x.prev.inv+' · '+esc(x.prev.follower)+' · الان: '+x.curr.od+' روز (قبلاً '+x.prev.od+')</div>'
        +'</div>';
    });
  }
  return h;
}

// ═══════════ AI TAB ═══════════
function rAI(rows){
  var ov=rows.filter(function(r){return r.od>0;});
  var h='<div style="background:var(--bg-card);border-radius:10px;border:1px solid var(--border);padding:13px;margin-bottom:11px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:9px">📋 گزارش هفتگی</div>'
    +'<div id="mtr-wRep" class="report-box">'+buildWeeklyReport(rows)+'</div>'
    +'<button onclick="copyReport()" style="width:100%;background:#334155;color:var(--text-muted);border:none;border-radius:7px;padding:8px;font-family:inherit;font-size:12px;cursor:pointer;margin-top:7px">📋 کپی برای سارا</button>'
    +'</div>'
    +'<button class="ai-btn"'+(AI_LOADING?' disabled':'')+' onclick="runAI()">'+(AI_LOADING?'⏳ در حال تحلیل...':'🤖 توصیه‌های هوشمند برای موارد بحرانی')+'</button>';
  if(AI_TXT)h+='<div class="ai-res">'+esc(AI_TXT)+'</div>';
  return h;
}
function buildWeeklyReport(rows){
  var ov60=rows.filter(function(r){return r.od>60;});
  var od31=rows.filter(function(r){return r.od>30&&r.od<=60;});
  var top3=rows.filter(function(r){return r.od>0;}).slice(0,3);
  var fcRows=DATA.filter(function(r){var m=gm(r.inv);return m.forecast&&m.forecast.pct>=90;});
  var fcAmt=fcRows.reduce(function(s,r){return s+r.rem*(gm(r.inv).forecast.pct/100);},0);
  var lines=['📋 گزارش مطالبات — آتنا زیست درمان','تاریخ: '+TODAY_STR,'━━━━━━━━━━━━━━━━━━━━━━',
    'کل مطالبات: '+fM(tot(rows))+' ('+rows.length+' فاکتور)',
    'تخلف ۶۰ روز: '+ov60.length+' فاکتور — '+fM(tot(ov60)),
    'معوق ۳۱–۶۰: '+od31.length+' فاکتور — '+fM(tot(od31))];
  if(fcAmt>0)lines.push('برآورد وصول (۹۰-۱۰۰٪): '+fM(fcAmt));
  // Compare with snap if available
  if(SNAP&&SNAP.map){
    var collAmt=0;
    Object.keys(SNAP.map).forEach(function(inv){
      var p=SNAP.map[inv],c=DATA.find(function(r){return r.inv===inv;});
      var diff=c?p.rem-c.rem:p.rem;
      if(diff>100)collAmt+=diff;
    });
    if(collAmt>0)lines.push('وصول از '+SNAP.at+': '+fM(collAmt));
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━');
  if(top3.length){lines.push('اولویت‌های فوری:');top3.forEach(function(r,i){lines.push((i+1)+'. '+esc(r.customer)+' — '+fF(r.rem)+' ت — '+r.od+' روز');});}
  return lines.join('\n');
}
function copyReport(){
  var _wr=document.getElementById('mtr-wRep');if(!_wr)return;var txt=_wr.textContent;
  navigator.clipboard.writeText(txt).then(function(){toast('✅ گزارش کپی شد');}).catch(function(){
    var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('✅ کپی شد');
  });
}
async function runAI(){
  AI_LOADING=true;AI_TXT='';render();
  var rows=filt().filter(function(r){return r.od>0;}).slice(0,12);
  var cases=rows.map(function(r){return'• ف'+r.inv+' | '+r.customer+' | '+r.province+' | '+fF(r.rem)+' ت | سررسید:'+r.due+' | '+r.od+' روز | پیگیر:'+r.follower;}).join('\n');
  try{
    var res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:900,
        messages:[{role:'user',content:'مشاور وصول مطالبات تجهیزات پزشکی. سقف ۶۰ روز (بالاتر ممنوع). همکار فقط با چک ضمانت.\n\n'+cases+'\n\nاقدام مشخص (یک جمله) برای هر مورد. فرمت: [ف{شماره}] → اقدام. بحرانی‌ها اول.'}]})});
    var j=await res.json();if(res.status===503){AI_TXT=j.error||'سرویس هوش مصنوعی در دسترس نیست';}else{AI_TXT=j.content&&j.content[0]?j.content[0].text:'خطا.';}
  }catch(e){AI_TXT='خطا: '+e.message;}
  AI_LOADING=false;render();
}

// ═══════════ TOAST ═══════════
function toast(msg){var t=document.getElementById('mtr-toast');if(!t)return;t.textContent=msg;t.style.opacity='1';setTimeout(function(){t.style.opacity='0';},2500);}

// ═══════════ INIT ═══════════
var _mtrInited=false;
function mtrLazyInit(){
  if(_mtrInited)return;
  _mtrInited=true;
  loadUser();loadMeta();loadMergeLog();
  setToday(calcTodayJ());
  if(USER.name)FILTER=USER.name;
  // Restore persisted data
  var saved=loadData();
  if(saved&&saved.rows&&saved.rows.length){
    DATA=saved.rows;
    if(!SNAP)SNAP=loadSnap();
    var _tb2=document.getElementById('mtr-tabsBar');if(_tb2)_tb2.style.display='flex';
    var _pb=document.getElementById('mtr-printBtn');if(_pb)_pb.style.display='block';
    var _sb=document.getElementById('mtr-searchBar');if(_sb)_sb.style.display='block';
    updateReminder();render();
    if(typeof matchCentersToData==='function')setTimeout(matchCentersToData,200);
    toast('📂 دیتای قبلی بارگذاری شد ('+DATA.length+' فاکتور · '+saved.at+')');
  } else {
    // Try loading from server if localStorage is empty
    fetch('/api/data/mtr').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(d&&d.data&&d.data.length){
        DATA=d.data;
        if(!SNAP)SNAP=loadSnap();
        var _tb2=document.getElementById('mtr-tabsBar');if(_tb2)_tb2.style.display='flex';
        var _pb=document.getElementById('mtr-printBtn');if(_pb)_pb.style.display='block';
        var _sb=document.getElementById('mtr-searchBar');if(_sb)_sb.style.display='block';
        updateReminder();render();
        if(typeof matchCentersToData==='function')setTimeout(matchCentersToData,200);
        toast('📂 دیتای مطالبات از سرور بارگذاری شد');
      }
    }).catch(function(){});
  }
}


// ════════ IMPROVEMENT 1: Bulk Selection ════════
function toggleCenterSelect(cb,id){
  var rtype=cb.getAttribute('data-rtype');
  var key=rtype+'_'+id;
  if(cb.checked)_selectedCenters.add(key);
  else _selectedCenters.delete(key);
  var row=cb.closest('tr');
  if(row)row.classList.toggle('bulk-selected',cb.checked);
  _updateCenterBulkBar();
}
function toggleSelectAll(cb){
  document.querySelectorAll('.row-cb').forEach(function(c){
    c.checked=cb.checked;
    var rtype2=c.getAttribute('data-rtype');
    var rid=c.getAttribute('data-rid');
    var key=rtype2+'_'+rid;
    if(cb.checked)_selectedCenters.add(key);
    else _selectedCenters.delete(key);
    var row=c.closest('tr');
    if(row)row.classList.toggle('bulk-selected',cb.checked);
  });
  _updateCenterBulkBar();
}
function _updateCenterBulkBar(){
  var bar=document.getElementById('centersBulkBar');
  var cnt=document.getElementById('centersBulkCount');
  if(!bar)return;
  if(_selectedCenters.size>0){
    bar.classList.add('active');
    if(cnt)cnt.textContent=_selectedCenters.size+' مرکز انتخاب شده';
  }else{
    bar.classList.remove('active');
    var allCb=document.getElementById('selectAllCb');
    if(allCb)allCb.checked=false;
  }
}
function clearCenterSelection(){
  _selectedCenters.clear();
  document.querySelectorAll('.row-cb').forEach(function(c){c.checked=false;});
  document.querySelectorAll('tr.bulk-selected').forEach(function(r){r.classList.remove('bulk-selected');});
  var allCb=document.getElementById('selectAllCb');
  if(allCb)allCb.checked=false;
  _updateCenterBulkBar();
}
function bulkAddToWeekPlan(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  var sel=document.getElementById('wpSel');
  var weekId=sel?sel.value:null;
  if(!weekId){var ws=wpGetWeeks();if(ws.length){var nw=ws.find(function(w){return !w.isPast;});weekId=nw?nw.id:ws[ws.length-1].id;}}
  if(!weekId){showToast('⚠ هیچ هفته‌ای یافت نشد');return;}
  var added=0;
  keys.forEach(function(key){
    var parts=key.split('_');var rtype=parts[0];var rid=parts.slice(1).join('_');
    var eKey=wpEntryKey(weekId,rtype,rid);
    wpRemoveFromOtherWeeks(key, weekId);
    if(!DB.weekEntries[eKey]){
      DB.weekEntries[eKey]={scheduledDate:null,done:false,doneDate:null,rtype:rtype,rid:rid,recKey:key,addedBy:currentUser,actionType:'call'};
      added++;
    }
  });
  saveDB();clearCenterSelection();
  showToast('📋 '+added+' مرکز به برنامه هفته اضافه شد',2500);
}
function bulkChangeOwner(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  var body='<div style="font-size:12px;margin-bottom:10px;color:var(--text-muted)">'+keys.length+' مرکز انتخابی</div>'
    +'<select id="bulkOwnerSel" style="width:100%;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:13px">'
    +'<option value="">— بدون مسئول —</option>'
    +Object.keys(USERS).map(function(u){return'<option value="'+u+'">'+USERS[u]+'</option>';}).join('')
    +'</select>';
  openModal('bulkOwnerModal','👤 تغییر مسئول',body,
    '<button class="btn-secondary" onclick="closeModal(\'bulkOwnerModal\')">انصراف</button>'
    +'<button class="btn-primary" onclick="_doBulkOwner()">✅ تأیید</button>');
}
function _doBulkOwner(){
  var val=(document.getElementById('bulkOwnerSel')||{}).value||'';
  var keys=Array.from(_selectedCenters);
  keys.forEach(function(key){
    var parts=key.split('_');var rtype=parts[0];var rid=parts.slice(1).join('_');
    setE(rtype,rid,'owner',val);
  });
  closeModal('bulkOwnerModal');clearCenterSelection();renderTable();
  showToast('✅ مسئول '+keys.length+' مرکز تغییر کرد',2000);
}
function bulkChangeStatus(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  var body='<div style="font-size:12px;margin-bottom:10px;color:var(--text-muted)">'+keys.length+' مرکز انتخابی</div>'
    +'<select id="bulkStatusSel" style="width:100%;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:13px">'
    +STATUS_LIST.map(function(s){return'<option>'+s+'</option>';}).join('')
    +'</select>';
  openModal('bulkStatusModal','🔄 تغییر وضعیت',body,
    '<button class="btn-secondary" onclick="closeModal(\'bulkStatusModal\')">انصراف</button>'
    +'<button class="btn-primary" onclick="_doBulkStatus()">✅ تأیید</button>');
}

function bulkSetFollowup(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  var tmp=document.createElement('input');tmp.type='text';tmp.style.position='absolute';tmp.style.opacity='0';document.body.appendChild(tmp);
  openJDP(tmp,function(v){
    document.body.removeChild(tmp);
    if(!v)return;
    keys.forEach(function(k){
      var parts=k.split('_');var rtype=parts[0];var id=parts.slice(1).join('_');
      setE(rtype,id,'followupDate',v);
    });
    saveDB();
    clearCenterSelection();
    renderTable();
    showToast('✓ تاریخ پیگیری برای '+keys.length+' مرکز تنظیم شد');
  });
}

function _doBulkStatus(){
  var val=(document.getElementById('bulkStatusSel')||{}).value||STATUS_LIST[0];
  var keys=Array.from(_selectedCenters);
  keys.forEach(function(key){
    var parts=key.split('_');var rtype=parts[0];var rid=parts.slice(1).join('_');
    setE(rtype,rid,'status',val);
  });
  closeModal('bulkStatusModal');clearCenterSelection();renderTable();
  showToast('✅ وضعیت '+keys.length+' مرکز تغییر کرد',2000);
}
function bulkExport(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  if(typeof XLSX==='undefined'){showToast('⚠ کتابخانه Excel بارگذاری نشده');return;}
  var rtype=getProvType(_currentProvId);
  var rows=[['نام مرکز','پتانسیل','نوع','مسئول','وضعیت','تاریخ پیگیری']];
  keys.forEach(function(key){
    var parts=key.split('_');var rt=parts[0];var rid=parts.slice(1).join('_');
    var centers=getProvCenters(_currentProvId);
    var r=centers.find(function(x){return x.id===rid;});
    if(!r)return;
    var e=getE(rt,rid);
    rows.push([r.name,e.potential||r.potential||'',e.type||r.type||'',USERS[e.owner||r.owner||'']||'',e.status||'بدون تماس',e.followupDate||'']);
  });
  var ws=XLSX.utils.aoa_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'مراکز');
  XLSX.writeFile(wb,'centers_selected_'+todayStr().replace(/\//g,'-')+'.xlsx');
}

// ════════ IMPROVEMENT 2: addDaysToJalali ════════
function addDaysToJalali(dateStr,days){
  if(!dateStr)return '';
  var parts=dateStr.split('/').map(Number);
  if(parts.length!==3)return dateStr;
  var d=jAdd(parts[0],parts[1],parts[2],days);
  return d[0]+'/'+p2(d[1])+'/'+p2(d[2]);
}

// ════════ IMPROVEMENT 3: Quick filters ════════
function applyQuickFilter(f){
  _quickFilter=(_quickFilter===f)?'':f;
  document.querySelectorAll('.qf-btn').forEach(function(b){b.classList.remove('active');});
  if(_quickFilter){var btn=document.getElementById('qf_'+_quickFilter);if(btn)btn.classList.add('active');}
  renderTable();
}

// ════════ IMPROVEMENT 4: Filter presets ════════
function saveFilterPreset(){
  var name=prompt('نام پریست را وارد کنید:');
  if(!name||!name.trim())return;
  var _existingPresets=(DB.settings&&DB.settings.filterPresets)||{};
  if(_existingPresets[name.trim()]){
    if(!confirm('پریست «'+name.trim()+'» از قبل وجود دارد. جایگزین شود؟'))return;
  }
  var preset={
    q:(document.getElementById('srch')||{}).value||'',
    pot:(document.getElementById('fPot')||{}).value||'',
    status:(document.getElementById('fStatus')||{}).value||'',
    lead:(document.getElementById('fLead')||{}).value||'',
    owner:(document.getElementById('fOwner')||{}).value||'',
    type:(document.getElementById('fType')||{}).value||'',
    qf:_quickFilter
  };
  if(!DB.settings)DB.settings={};
  if(!DB.settings.filterPresets)DB.settings.filterPresets={};
  DB.settings.filterPresets[name.trim()]=preset;
  saveDB();buildPresetSelector();
  showToast('💾 پریست «'+name.trim()+'» ذخیره شد',2000);
}
function loadFilterPreset(name){
  if(!name)return;
  var presets=(DB.settings&&DB.settings.filterPresets)||{};
  var p=presets[name];
  if(!p)return;
  var set=function(id,v){var el=document.getElementById(id);if(el)el.value=v||'';};
  set('srch',p.q);set('fPot',p.pot);set('fStatus',p.status);
  set('fLead',p.lead);set('fOwner',p.owner);set('fType',p.type);
  _quickFilter=p.qf||'';
  document.querySelectorAll('.qf-btn').forEach(function(b){b.classList.remove('active');});
  if(_quickFilter){var btn=document.getElementById('qf_'+_quickFilter);if(btn)btn.classList.add('active');}
  var sel=document.getElementById('filterPresetSel');if(sel)sel.value='';
  renderTable();
}
function buildPresetSelector(){
  var sel=document.getElementById('filterPresetSel');
  if(!sel)return;
  var presets=(DB.settings&&DB.settings.filterPresets)||{};
  var names=Object.keys(presets);
  sel.innerHTML='<option value="">📁 پریست‌ها</option>'
    +names.map(function(n){return'<option value="'+esc(n)+'">'+esc(n)+'</option>';}).join('');
  sel.style.display=names.length?'':'none';
}

// ════════ IMPROVEMENT 5: Stats bar ════════
function _renderCenterStatsBar(data,rtype){
  var bar=document.getElementById('centerStatsBar');
  if(!bar)return;
  var counts={};
  STATUS_LIST.forEach(function(s){counts[s]=0;});
  var overdueCnt=0,stalledCnt=0;
  data.forEach(function(r){
    var e=getE(rtype,r.id);
    var st=e.status||'بدون تماس';
    counts[st]=(counts[st]||0)+1;
    if(isOverdue(rtype,r.id))overdueCnt++;
    if(isStalled(rtype,r.id))stalledCnt++;
  });
  var ST_COLORS2=['#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#22c55e','#ef4444'];
  var ST_ICONS2=['⬜','📞','🤝','📋','✅','🚫'];
  bar.style.display='flex';
  bar.innerHTML='<span style="font-weight:700;color:var(--text-primary)">جمع: '+data.length+'</span>'
    +STATUS_LIST.map(function(s,i){
      if(!counts[s])return '';
      return'<span style="background:'+ST_COLORS2[i]+'20;color:'+ST_COLORS2[i]+';border:1px solid '+ST_COLORS2[i]+'44;border-radius:10px;padding:2px 8px">'+ST_ICONS2[i]+' '+s+': '+counts[s]+'</span>';
    }).join('')
    +(overdueCnt?'<span style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:10px;padding:2px 8px;font-weight:700">🔴 سررسیده: '+overdueCnt+'</span>':'')
    +(stalledCnt?'<span style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;border-radius:10px;padding:2px 8px">⏸ بی‌فعالیت: '+stalledCnt+'</span>':'');
}

// ════════ IMPROVEMENT 7: Sort ════════
function setCenterSort(field){
  if(_sortField===field)_sortDir*=-1;
  else{_sortField=field;_sortDir=1;}
  // sync sort select
  var sel=document.getElementById('sortSel');if(sel){
    var v=_sortField?(_sortField+(_sortDir===-1?'_desc':'_asc')):'';sel.value=v;
  }
  renderTable();
}
function setCenterSortFromSel(val){
  if(!val){_sortField='';_sortDir=1;}
  else{
    var last=val.lastIndexOf('_');
    _sortField=val.substring(0,last);
    _sortDir=val.substring(last+1)==='desc'?-1:1;
  }
  renderTable();
}

// ════════ IMPROVEMENT 9: Pin centers ════════
function isPinned(rtype,id){
  var pins=(DB.settings&&DB.settings.pinnedCenters)||[];
  return pins.indexOf(recK(rtype,id))>=0;
}
function togglePin(rtype,id){
  if(!DB.settings)DB.settings={};
  if(!DB.settings.pinnedCenters)DB.settings.pinnedCenters=[];
  var key=recK(rtype,id);
  var idx=DB.settings.pinnedCenters.indexOf(key);
  if(idx>=0)DB.settings.pinnedCenters.splice(idx,1);
  else DB.settings.pinnedCenters.push(key);
  saveDB();renderTable();
}

// ════════ IMPROVEMENT 10: Province Excel export ════════
function exportCurrentXlsx(){
  if(!_currentProvId){showToast('ابتدا یک استان را باز کنید');return;}
  if(typeof XLSX==='undefined'){showToast('⚠ SheetJS بارگذاری نشده');return;}
  var rtype=getProvType(_currentProvId);
  var data=getFiltered();
  var rows=[['ردیف','نام مرکز','پتانسیل','نوع','سرنخ','مسئول','وضعیت','پیگیری بعدی','تلفن']];
  data.forEach(function(r){
    var e=getE(rtype,r.id);
    rows.push([r.row,r.name,e.potential||r.potential||'',e.type||r.type||'',e.lead||r.lead||'',USERS[e.owner||r.owner||'']||'',e.status||'بدون تماس',e.followupDate||'',(e.phones&&e.phones[0])||'']);
  });
  var ws=XLSX.utils.aoa_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'مراکز');
  XLSX.writeFile(wb,'centers_'+(_currentProvId||'all')+'_'+todayStr().replace(/\//g,'-')+'.xlsx');
  showToast('✅ Excel دانلود شد ('+data.length+' مرکز)',2500);
}

// ════════ IMPROVEMENT 11: Duplicate detection ════════
function _centerNameSimilar(a,b){
  var na=fNorm(a),nb=fNorm(b);
  if(na===nb)return true;
  if(na.length>4&&nb.indexOf(na)>=0)return true;
  if(nb.length>4&&na.indexOf(nb)>=0)return true;
  return false;
}

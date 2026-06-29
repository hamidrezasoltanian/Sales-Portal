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
        if(invExp)h+='<div style="padding:0 12px 10px 12px" onclick="event.stopPropagation()">'+rExp(r,m)+'</div>';
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
    +'<button type="button" class="save-btn" onclick="var t=document.getElementById(\'ni-'+inv+'\');mtrAddNote(\''+inv+'\',t.value);t.value=\'\';render();toast(\'✅ ذخیره شد\')">ثبت</button></div>'
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
function quickSetFd(rtype,rid,days){
  var t=todayStr();var parts=t.split('/').map(Number);
  var jy=parts[0],jm=parts[1],jd=parts[2];
  var mdays=[31,31,31,31,31,31,30,30,30,30,30,29];
  jd+=days;
  while(jd>(mdays[jm-1]||30)){jd-=(mdays[jm-1]||30);jm++;if(jm>12){jm=1;jy++;}}
  var nd=jy+'/'+p2(jm)+'/'+p2(jd);
  setE(rtype,rid,'followupDate',nd);
  renderBanner();renderProvTable();
  showToast('📅 فالوآپ: '+nd,1800);
}
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
function bulkDeleteCenters(){
  var keys=Array.from(_selectedCenters);
  if(!keys.length)return;
  var extraCount=keys.filter(function(k){return k.indexOf('_new_')>=0;}).length;
  var baseCount=keys.length-extraCount;
  var body='<div style="text-align:center;padding:10px 0">'
    +'<div style="font-size:36px;margin-bottom:12px">🗑</div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px">حذف گروهی مراکز</div>'
    +'<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">'+keys.length+' مرکز انتخاب شده</div>'
    +(baseCount?'<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:7px;padding:10px;font-size:12px;color:#991b1b;text-align:right;margin-bottom:8px">'+baseCount+' مرکز از دیتابیس اصلی حذف می‌شود. این عمل قابل بازگشت نیست.</div>':'')
    +(extraCount?'<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:7px;padding:10px;font-size:12px;color:#92400e;text-align:right">'+extraCount+' مرکز دستی (extra) حذف می‌شود.</div>':'')
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'bulkDelModal\')">لغو</button>'
    +'<button style="background:#dc2626;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600" onclick="_doBulkDelete()">🗑 حذف '+keys.length+' مرکز</button>';
  openModal('bulkDelModal','حذف گروهی',body,foot);
}

function _doBulkDelete(){
  var keys=Array.from(_selectedCenters);
  closeModal('bulkDelModal');
  var deleted=0;
  keys.forEach(function(key){
    var parts=key.split('_');var rtype=parts[0];var id=parts.slice(1).join('_');
    var isExtra=(id.indexOf('_new_')>=0);
    _cleanCenterData(rtype,id);
    if(isExtra){
      DB.extra=(DB.extra||[]).filter(function(c){return c.id!==id;});
    }else if(rtype==='center'){
      for(var _ci=CENTERS.length-1;_ci>=0;_ci--){
        var _cc=CENTERS[_ci];var _cid='c_'+(_cc.row||_cc.id||'');
        if(_cid===id||String(_cc.id)===String(id)){CENTERS.splice(_ci,1);break;}
      }
    }else{
      var _provId=id.split('||')[0];var _row=Number(id.split('||')[1]);
      PROVINCES.forEach(function(p){
        if(p.id===_provId){
          var _pname=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
          if(PC_RAW[_pname]){PC_RAW[_pname]=PC_RAW[_pname].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
          if(PC_RAW[p.id]){PC_RAW[p.id]=PC_RAW[p.id].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
        }
      });
    }
    deleted++;
  });
  saveDB();
  clearPCCache();_ALL_PROVS=null;_typeFilterBuilt=false;
  var _newCENTERS=CENTERS.slice();
  var _newPC_RAW={};Object.keys(PC_RAW).forEach(function(k){_newPC_RAW[k]=PC_RAW[k];});
  fetch('/api/data/centers/master',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({CENTERS:_newCENTERS,PC_RAW:_newPC_RAW})
  }).then(function(r){
    if(!r.ok)console.error('[bulk delete] server save failed:',r.status);
    clearCenterSelection();rebuildFilters();renderTable();
    showToast('✅ '+deleted+' مرکز حذف شد');
  }).catch(function(e){
    console.error('[bulk delete]',e.message);
    clearCenterSelection();rebuildFilters();renderTable();
    showToast('✅ '+deleted+' مرکز حذف شد');
  });
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

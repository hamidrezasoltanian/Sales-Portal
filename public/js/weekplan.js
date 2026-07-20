/* ═══ public/js/weekplan.js ═══ */
// ════════════════════════ NOTES ════════════════════════
function _wpSaveNotes(type,id){
  /* notes saved via POST /api/centers/:key/notes */
}
function _wpSaveWeek(keys){
  /* week entries saved via /api/week-entries — no blob dual-write */
  if(DB._weDeletedKeys&&DB._weDeletedKeys.length)DB._weDeletedKeys=[];
}

/** نوع پیش‌فرض هنگام افزودن مرکز به هفته (از سلکتور نوار ابزار یا call) */
function _wpDefaultActionType(){
  var el = document.getElementById('wpDefaultActType');
  if (el && el.value) return el.value;
  return 'call';
}


function addNote(type,id,text,inp){
  if(!text||!text.trim())return;
  var k=recK(type,id);if(!DB.notes[k])DB.notes[k]=[];
  var noteObj={text:text.trim(),date:todayStr(),user:USERS[currentUser]||currentUser,ts:nowTs()};
  if(typeof postCenterNote==='function'){
    postCenterNote(k,text.trim(),{date:todayStr()}).then(function(d){
      if(d&&d.notes)DB.notes[k]=d.notes;
      if(inp){inp.value='';showToast('یادداشت ذخیره شد ✅',1500);}
    }).catch(function(){showToast('خطا در ذخیره یادداشت');});
    return;
  }
  DB.notes[k].push(noteObj);
  _wpSaveNotes(type,id);if(inp){inp.value='';showToast('یادداشت ذخیره شد ✅',1500);}
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
      +'<div class="note-meta"><span>'+esc(n.by||n.user||'')+'</span><span>'+(n.date||msToJ(n.at)||'')+'</span>'
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
  if(typeof deleteCenterNoteApi==='function'){
    deleteCenterNoteApi(k,idx).then(function(d){
      if(d&&d.notes)DB.notes[k]=d.notes;else DB.notes[k].splice(idx,1);
      var nl=document.getElementById('nlist_'+id);if(nl)nl.innerHTML=renderNotesList(type,id);
    }).catch(function(){showToast('خطا در حذف یادداشت');});
    return;
  }
  DB.notes[k].splice(idx,1);_wpSaveNotes(type,id);
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
  if(!recKey)return'?';
  var pts=recKey.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
  var cached=_CNC&&_CNC[recKey];
  if(cached && typeof _looksLikeCenterCode==='function' && _looksLikeCenterCode(cached, id)){
    try{delete _CNC[recKey];}catch(e){}
    cached=null;
  }
  if(cached)return cached;
  if(tp==='mtr'){
    var mrow=typeof DATA!=='undefined'?DATA.find(function(r){return r.inv===id;}):null;
    if(mrow){var lbl='📄 '+mrow.customer+' ('+id+')';_saveCNC(recKey,lbl);return lbl;}
    return '📄 مطالبات: '+id;
  }
  if(tp==='center'){
    var _no=(DB.edits[recKey]||{}).nameOverride;
    if(_no && !(typeof _looksLikeCenterCode==='function' && _looksLikeCenterCode(_no, id))){_saveCNC(recKey,_no);return _no;}
    var c=(CENTERS||[]).find(function(x){return String(x.id)===String(id);});
    if(c&&c.name){_saveCNC(recKey,c.name);return c.name;}
    var ex=(DB.extra||[]).find(function(x){return String(x.id)===String(id);});
    if(ex&&ex.name){_saveCNC(recKey,ex.name);return ex.name;}
    // Fallback: search across all provinces cache
    if(_PC_CACHE){
      for(var _pv in _PC_CACHE){
        var _found=(_PC_CACHE[_pv]||[]).find(function(x){return String(x.id)===String(id);});
        if(_found&&_found.name){_saveCNC(recKey,_found.name);return _found.name;}
      }
    }
    var _w1=typeof _lookupCenterNameFromWeek==='function'?_lookupCenterNameFromWeek(tp,id):'';
    if(_w1){_saveCNC(recKey,_w1);return _w1;}
    return id;
  }
  if(tp==='pc'){
    var _no2=(DB.edits[recKey]||{}).nameOverride;
    if(_no2 && !(typeof _looksLikeCenterCode==='function' && _looksLikeCenterCode(_no2, id))){_saveCNC(recKey,_no2);return _no2;}
    _buildPCCache();
    var provId=id.split('||')[0];
    var arr=_PC_CACHE[provId]||[];
    var found=arr.find(function(x){return String(x.id)===String(id);});
    if(found&&found.name){_saveCNC(recKey,found.name);return found.name;}
    var ex2=(DB.extra||[]).find(function(x){return String(x.id)===String(id);});
    if(ex2&&ex2.name){_saveCNC(recKey,ex2.name);return ex2.name;}
    // full fallback search
    if(_PC_CACHE){for(var _pv2 in _PC_CACHE){var _f2=(_PC_CACHE[_pv2]||[]).find(function(x){return String(x.id)===String(id);});if(_f2&&_f2.name){_saveCNC(recKey,_f2.name);return _f2.name;}}}
    var _w2=typeof _lookupCenterNameFromWeek==='function'?_lookupCenterNameFromWeek(tp,id):'';
    if(_w2){_saveCNC(recKey,_w2);return _w2;}
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

/** Resolve center display name from recKey — always available (tasks.js is lazy). */
function _clGetName(rkey){
  if(!rkey)return '?';
  if(typeof getRecLabel==='function'){
    var n=getRecLabel(rkey);
    if(n&&n!=='?')return n;
  }
  if(typeof _getCenterNameFromKey==='function'){
    var n2=_getCenterNameFromKey(rkey);
    if(n2)return n2;
  }
  var parts=String(rkey).split('_');
  var tp=parts[0];
  var id=parts.slice(1).join('_');
  if(typeof _getCenterName==='function'){
    var n3=_getCenterName(tp,id);
    if(n3&&n3!==id)return n3;
  }
  return id||rkey;
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
function wpParseEntryKey(k){
  if(!k) return {weekId:'',rtype:'',rid:''};
  var i1=k.indexOf(':::');
  if(i1<0) return {weekId:k,rtype:'',rid:''};
  var weekId=k.slice(0,i1);
  var rest=k.slice(i1+3);
  var i2=rest.indexOf(':::');
  if(i2>=0) return {weekId:weekId,rtype:rest.slice(0,i2),rid:rest.slice(i2+3)};
  var we=(typeof DB!=='undefined'&&DB.weekEntries)?DB.weekEntries[k]:null;
  if(we&&we.rtype&&we.rid!=null&&we.rid!=='') return {weekId:weekId,rtype:we.rtype,rid:String(we.rid)};
  var us=rest.indexOf('_');
  if(us>0) return {weekId:weekId,rtype:rest.slice(0,us),rid:rest.slice(us+1)};
  return {weekId:weekId,rtype:rest,rid:''};
}

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
  var members=typeof umGetMembers==='function'?umGetMembers():(_DEFAULT_MEMBERS||[]);
  var me=members.find(function(m){return m.id===currentUser;});
  if(me&&crmIsManagerRole(me.role))return true;
  if(window._authUserRole&&crmIsManagerRole(window._authUserRole))return true;
  return false;
}
function _isSuperAdmin(){
  var members=typeof umGetMembers==='function'?umGetMembers():(_DEFAULT_MEMBERS||[]);
  var me=members.find(function(m){return m.id===currentUser;});
  if(me&&crmIsSuperAdminRole(me.role))return true;
  if(window._authUserRole&&crmIsSuperAdminRole(window._authUserRole))return true;
  return false;
}
function _isExpert(){return !_isManager();}

// ── Permission engine (additive — empty permissions = fallback to role defaults) ──────────
var _ROLE_DEFAULTS = CRM_ROLE_DEFAULTS;

function _getPermLevel(module){
  if(_isManager()&&typeof crmManagerBypassAllowed==='function'&&crmManagerBypassAllowed(module))return 'edit';
  var perms=window._myPermissions||{};
  var modules=perms.modules||{};
  var level=modules[module];
  if(level!==undefined){
    return typeof crmNormalizePermLevel==='function'?crmNormalizePermLevel(level):'none';
  }
  var r=window._authUserRole||'کارشناس فروش';
  var def=_ROLE_DEFAULTS[r]||_ROLE_DEFAULTS['کارشناس فروش'];
  if(def&&def.modules&&def.modules[module]!==undefined){
    return typeof crmNormalizePermLevel==='function'?crmNormalizePermLevel(def.modules[module]):'none';
  }
  return 'none';
}
function _hasAccess(module){
  var lvl=_getPermLevel(module);
  return lvl==='edit'||lvl==='view'||lvl==='approve'||lvl==='manage';
}
function _canEdit(module){
  return _getPermLevel(module)==='edit';
}
function _canManage(module){
  var lvl=_getPermLevel(module);
  return lvl==='manage'||lvl==='edit';
}
function _canApprove(module){
  var lvl=_getPermLevel(module);
  return lvl==='approve'||lvl==='edit';
}
function _getAllowedProvinces(allProvs){
  if(_isManager())return allProvs;
  var perms=window._myPermissions||{};
  if(!perms.provinces||!perms.provinces.length)return allProvs;
  return allProvs.filter(function(p){return perms.provinces.indexOf(p.id)>=0;});
}

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
    var type=e.rtype==='mtr'?'مطالبات':(typeof wpActLabel==='function'?wpActLabel(e.actionType||'call'):(e.actionType==='visit'?'ویزیت':'تماس'));
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
  var _wbActives=typeof umGetActive==='function'?umGetActive():[];
  _wbActives.forEach(function(m){
    if(m.id==='guest')return;
    var opt=document.createElement('option');
    opt.value=m.id;opt.textContent=m.name;sel.appendChild(opt);
  });
  var filterRow=sel.closest?sel.closest('.wp-filter-row'):null;
  if(!_isManager()){
    sel.value=currentUser;
    if(filterRow)filterRow.style.display='none';
  } else {
    if(filterRow)filterRow.style.display='';
    if(_wpFclFilters.owner&&USERS[_wpFclFilters.owner])sel.value=_wpFclFilters.owner;
  }
  if(typeof wpBuildDefaultActType==='function')wpBuildDefaultActType();
}

function wpBuildDefaultActType(){
  var sel=document.getElementById('wpDefaultActType');
  if(!sel)return;
  var prev=sel.value||'call';
  var labels=(typeof ACTION_TYPE_LABELS!=='undefined'&&ACTION_TYPE_LABELS)||(window.ACTION_TYPE_LABELS)||{call:'📞 تماس',visit:'🤝 ملاقات'};
  var keys=Object.keys(labels);
  if(!keys.length)keys=['call'];
  sel.innerHTML=keys.map(function(k){
    return '<option value="'+k+'"'+(k===prev?' selected':'')+'>'+esc(labels[k]||k)+'</option>';
  }).join('');
  if(labels[prev])sel.value=prev;
  else sel.value=keys[0];
}

function _wpMergeApiRows(weekId, rows){
  if(!weekId||!rows||!Array.isArray(rows))return;
  if(!DB.weekEntries)DB.weekEntries={};
  Object.keys(DB.weekEntries).forEach(function(k){
    if(k.startsWith(weekId+':::'))delete DB.weekEntries[k];
  });
  rows.forEach(function(row){
    if(!row.rtype||row.rid===undefined)return;
    // Keep server weekId when present; for stale week_id rows still store under their key
    // so transfer/repair can find sqlId. Display also matches by scheduledDate (see render).
    var rowWeek=row.weekId||weekId;
    var k=rowWeek+':::'+row.rtype+':::'+row.rid;
    DB.weekEntries[k]={
      id:row.id,sqlId:row.id,weekId:rowWeek,recKey:row.recKey,rtype:row.rtype,rid:row.rid,
      scheduledDate:row.scheduledDate,actionType:row.actionType,done:row.done,doneDate:row.doneDate,
      addedBy:row.addedBy,centerName:row.centerName,weekTagId:row.weekTagId,
      doneNote:row.doneNote,doneResult:row.doneResult
    };
  });
}
function _wpLoadWeekFromApi(cb){
  var sel=document.getElementById('wpSel');
  var weekId=sel&&sel.value;
  if(!weekId){if(typeof cb==='function')cb();return;}
  var wk=(typeof wpGetWeeks==='function'?wpGetWeeks():[]).find(function(w){return w.id===weekId;});
  var weekEnd=wk?wk.weStr:weekId;
  var owner=(document.getElementById('wpOwnerFilter')||{}).value||'';
  var url='/api/week-entries?week_id='+encodeURIComponent(weekId)
    +'&week_end='+encodeURIComponent(weekEnd);
  // owner = مسئول مرکز (سرور دیگر added_by را اشتباهی فیلتر نمی‌کند)
  if(owner)url+='&owner='+encodeURIComponent(owner);
  fetch(url).then(function(r){return r.ok?r.json():null;}).then(function(rows){
    _wpMergeApiRows(weekId,rows);
    // Auto-repair: entries scheduled in this week but stored under another week_id
    if(typeof wpTransferWeekEntry==='function'&&rows&&rows.length){
      rows.forEach(function(row){
        if(!row||!row.id||!row.weekId||row.weekId===weekId)return;
        if(!row.scheduledDate||row.scheduledDate<weekId||row.scheduledDate>weekEnd)return;
        var oldKey=row.weekId+':::'+row.rtype+':::'+row.rid;
        if(DB.weekEntries[oldKey]&&DB.weekEntries[oldKey].sqlId){
          wpTransferWeekEntry(oldKey,weekId,{scheduledDate:row.scheduledDate,clearSchedule:false}).catch(function(){});
        }
      });
    }
    if(typeof cb==='function')cb();
  }).catch(function(){if(typeof cb==='function')cb();});
}

function _wpCaptureScroll(){
  var days=[];
  document.querySelectorAll('#wpDays .wp-day-body').forEach(function(el,i){
    days.push({i:i,top:el.scrollTop});
  });
  var fclScroll=0;
  var fcl=document.querySelector('#wpFullCenterList .wp-fcl-body')
    ||document.querySelector('#wpFullCenterList .table-wrap')
    ||document.querySelector('#wpFullCenterList');
  if(fcl)fclScroll=fcl.scrollTop||0;
  return{
    winY:window.scrollY||document.documentElement.scrollTop||0,
    days:days,
    fcl:fclScroll
  };
}
function _wpRestoreScroll(s){
  if(!s)return;
  function restore(){
    window.scrollTo(0,s.winY);
    var bodies=document.querySelectorAll('#wpDays .wp-day-body');
    (s.days||[]).forEach(function(d){
      if(bodies[d.i])bodies[d.i].scrollTop=d.top;
    });
    var fcl=document.querySelector('#wpFullCenterList .wp-fcl-body')
      ||document.querySelector('#wpFullCenterList .table-wrap')
      ||document.querySelector('#wpFullCenterList');
    if(fcl&&s.fcl!=null)fcl.scrollTop=s.fcl;
  }
  // Restore once after DOM replacement and once after card heights settle.
  requestAnimationFrame(function(){restore();requestAnimationFrame(restore);});
}
function _wpWithScroll(fn){
  var s=_wpCaptureScroll();
  try{fn();}finally{_wpRestoreScroll(s);}
}

function renderWeekPlan(opts){
  opts=opts||{};
  var soft=!!opts.soft;
  _buildPCCache();
  if(!soft){
    wpBuildSelect();
    wpBuildOwnerFilter();
  }
  if(soft){
    _wpWithScroll(function(){ _renderWeekPlanBody({keepSelection:true}); });
    return;
  }
  // سخت: از API بگیر، یک‌بار رندر کن؛ reconcile در پس‌زمینه و فقط در صورت تغییر دوباره (با حفظ اسکرول)
  _wpLoadWeekFromApi(function(){
    _wpWithScroll(function(){ _renderWeekPlanBody({keepSelection:true}); });
    try{
      if(typeof wpReconcileFollowupDates==='function'&&typeof _canEdit==='function'&&_canEdit('weekplan')&&!window._wpReconcileOnce){
        window._wpReconcileOnce=true;
        var p=wpReconcileFollowupDates({allowCreate:true,allowMove:true});
        if(p&&typeof p.then==='function'){
          p.then(function(n){
            if(n>0){
              console.info('[wp] reconciled',n,'followup→week entries');
              _wpWithScroll(function(){ _renderWeekPlanBody({keepSelection:true}); });
            }
          }).catch(function(){});
        }
        setTimeout(function(){ window._wpReconcileOnce=false; },60000);
      }
    }catch(eRec){}
  });
}
function _renderWeekPlanBody(opts){
  opts=opts||{};
  var keepSelection=!!opts.keepSelection;
  if(!keepSelection&&typeof _wpSelected!=='undefined'){
    _wpSelected.clear();
    var _bar=document.getElementById('wpBulkBar');
    if(_bar)_bar.classList.remove('active');
  }
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
  var daySet={};days.forEach(function(d){daySet[d.str]=true;});

  // راهنمای کوتاه یک‌بار (قابل بستن)
  try {
    var tipId = 'wpHowTip';
    var tipEl = document.getElementById(tipId);
    if (!tipEl && daysEl.parentNode && !localStorage.getItem('wp_how_dismissed')) {
      tipEl = document.createElement('div');
      tipEl.id = tipId;
      tipEl.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;margin:0 0 10px;font-size:12px;color:#1e40af;line-height:1.7;display:flex;gap:10px;align-items:flex-start';
      tipEl.innerHTML = '<div style="flex:1">' +
        (_isManager()
          ? '<b>اینجا اجرای برنامه است.</b> تخصیص مراکز و هدف عددی را از تب «تخصیص برنامه» بگذارید. کارشناس کارت‌ها را Done می‌کند تا پیشرفت ثبت شود.'
          : '<b>برنامه هفته شما:</b> کارت‌های هر روز را انجام دهید و Done بزنید. فقط Done شمرده می‌شود. کارهای معوق را در تب «خانه» هم می‌بینید.') +
        '</div><button type="button" onclick="localStorage.setItem(\'wp_how_dismissed\',\'1\');this.parentNode.remove()" style="border:none;background:transparent;cursor:pointer;color:#64748b;font-size:16px;padding:0 4px" title="بستن">✕</button>';
      daysEl.parentNode.insertBefore(tipEl, daysEl);
    }
  } catch (eTip) {}

  var getCenterOwner = function(rtype, rid) { return _wpGetOwner({rtype:rtype, rid:rid}); };

  // جمع‌آوری مراکز این هفته: هم با کلید weekId و هم با scheduledDate داخل بازه هفته
  // (اگر week_id در SQL کهنه باشد، کارت از روز ناپدید نشود)
  var allEntries = [];
  var seenRec={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we0=DB.weekEntries[k];
    if(!we0)return;
    var inByKey=k.startsWith(weekId+':::');
    var inByDate=!!(we0.scheduledDate&&daySet[we0.scheduledDate]);
    if(!inByKey && !inByDate) return;
    var we = Object.assign({_key:k}, we0);
    var rtype = we.rtype; var rid = we.rid;
    var _rk=we.recKey||(rtype&&rid!=null?rtype+'_'+rid:'');
    if(_rk&&seenRec[_rk])return;
    if(_rk)seenRec[_rk]=true;
    var owner = '';
    if(rtype && rid){
      owner = getCenterOwner(rtype, rid) || we.addedBy || '';
      // نمایش بر اساس مسئول مرکز (نه اضافه‌کننده)
      if(!_isManager() && owner && owner !== currentUser) return;
    }
    we._owner = owner;
    we._ownerName = owner ? (USERS[owner] || owner) : 'بدون مسئول';
    _loadCNC();
    we._name = (typeof resolveWeekEntryDisplayName==='function'
      ? resolveWeekEntryDisplayName(we)
      : (we.centerName || (_CNC&&_CNC[_rk]) || getRecLabel(_rk) || '?'));
    if(wpOwnerF){
      var effOwner=owner||'';
      if(effOwner && effOwner !== wpOwnerF) return;
      if(!effOwner) return;
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
      + '<div class="wp-day-head" onclick="wpOpenTodayPlanModal(\''+d.str+'\')" style="cursor:pointer" title="مشاهده برنامه روزانه با جزئیات">'+d.name+'<br><small>'+d.str.split('/').slice(1).join('/')+'</small>'
      + (items.length?'<span class="wp-cnt">'+items.length+'</span>':'')+'</div>'
      + '<div class="wp-day-body" ondragover="event.preventDefault();this.classList.add(\'wp-drop-over\')" ondragleave="this.classList.remove(\'wp-drop-over\')" ondrop="wpDrop(event,\''+d.str+'\')">'
      + (items.length ? items.map(function(e){return renderWpItem(e,weekId);}).join('') : '<div class="wp-empty">—</div>')
      + '</div>'
      + '<button class="wp-add-btn" data-wid="'+weekId+'" data-dstr="'+d.str+'" onclick="wpPickForDay(this.getAttribute(\'data-wid\'),this.getAttribute(\'data-dstr\'))">+ انتقال</button>'
      + '</div>';
  }).join('');

  if(keepSelection&&typeof _wpSelected!=='undefined'&&_wpSelected.size&&typeof _wpUpdateBulkBar==='function'){
    _wpUpdateBulkBar();
  }

  // نوار پیشرفت — به‌روزرسانی درجا تا پرش لایه‌آوت کمتر شود
  var progParent = daysEl.parentNode;
  var oldProg = progParent ? progParent.querySelector('.wp-progress') : null;
  if(total > 0 && progParent){
    var progHtml = '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-raised);border-top:1px solid var(--border)">'
      + '<span style="font-size:12px;color:var(--text-secondary)">پیشرفت هفته:</span>'
      + '<div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">'
      + '<div style="height:100%;background:#22c55e;width:'+Math.round(done/total*100)+'%;transition:width .3s"></div></div>'
      + '<span style="font-size:11px;font-weight:700;color:#16a34a">'+done+' / '+total+'</span>'
      + (!_isManager() ? '<span style="font-size:10px;color:var(--text-muted)">— مراکز شما</span>' : '')
      + '</div>';
    if(oldProg){
      oldProg.innerHTML = progHtml;
    } else {
      var pEl = document.createElement('div'); pEl.className = 'wp-progress';
      pEl.innerHTML = progHtml;
      // بعد از شبکه روزها، قبل از صف انتظار
      if(daysEl.nextSibling) progParent.insertBefore(pEl, daysEl.nextSibling);
      else progParent.appendChild(pEl);
    }
  } else if(oldProg){
    oldProg.remove();
  }
  renderWpFullCenterList();
}
// ════════════════════════ WP FULL CENTER LIST ════════════════════
var _wpFclOpen = true;
var _wpFclFilters = {q:'', owner:'', prov:'', lead:''};

function renderWpFullCenterList() {
  var el = document.getElementById('wpFullCenterList');
  if (!el) return;

  var sel = document.getElementById('wpSel');
  var weekId = sel && sel.value ? sel.value : null;

  var getCO = function(rtype, rid) { return _wpGetOwner({rtype:rtype, rid:rid}); };
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
        name: (typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rk)||'?')),
        owner:owner, ownerName:owner?(USERS[owner]||owner):'—',
        provId:prov.id, provName:prov.name,
        actionType:we.actionType||'call'
      });
    });
  }

  // ── Section 2: all province centers NOT in this week ─────────────────
  _buildPCCache();
  var allCenters = [];
  _getAllowedProvinces(getAllProvinces()).forEach(function(p){
    var tp = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var rk = c.rtype+'_'+c.id;
      if (inWeekMap[rk]) return;
      var e = getE(c.rtype, c.id);
      var owner = e.owner||c.owner||'';
      if(!_isManager()&&owner&&owner!==currentUser)return;
      allCenters.push({
        id:c.id, rtype:c.rtype, recKey:rk,
        name:c.name||'',
        provId:p.id, provName:p.name||'',
        owner:owner, ownerName:owner?(USERS[owner]||owner):'—',
        status:e.status||'بدون تماس',
        lead:e.lead||c.lead||'سرنخ',
        followupDate:e.followupDate||''
      });
    });
  });

  // ── Apply unified filters ─────────────────────────────────────────────
  var q = fNorm(_wpFclFilters.q||'');
  var ownerF = _wpFclFilters.owner||'';
  var provF = _wpFclFilters.prov||'';
  var leadF = _wpFclFilters.lead||'';

  var filtU = unschedEntries.filter(function(c){
    if (ownerF && c.owner!==ownerF) return false;
    if (provF && c.provId!==provF) return false;
    if (leadF && c.lead!==leadF) return false;
    if (q && fNorm(c.name).indexOf(q)<0 && fNorm(c.ownerName).indexOf(q)<0 && fNorm(c.provName).indexOf(q)<0) return false;
    return true;
  });
  var filtC = allCenters.filter(function(c){
    if (ownerF && c.owner!==ownerF) return false;
    if (provF && c.provId!==provF) return false;
    if (leadF && c.lead!==leadF) return false;
    if (q && fNorm(c.name).indexOf(q)<0 && fNorm(c.ownerName).indexOf(q)<0 && fNorm(c.provName).indexOf(q)<0) return false;
    return true;
  });

  // ── Build filter controls ─────────────────────────────────────────────
  var members = typeof umGetActive==='function' ? umGetActive() : [];
  var ownerOpts = '<option value="">همه کارشناسان</option>'
    + members.map(function(m){return '<option value="'+m.id+'"'+(ownerF===m.id?' selected':'')+'>'+esc(m.name)+'</option>';}).join('');
  var provOpts = '<option value="">همه استان‌ها</option>'
    + getAllProvinces().map(function(p){return '<option value="'+p.id+'"'+(provF===p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');
  var leadOpts = '<option value="">همه سرنخ‌ها</option>'
    + (typeof LEAD_LIST!=='undefined'?LEAD_LIST:['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف']).map(function(l){return '<option value="'+esc(l)+'"'+(leadF===l?' selected':'')+'>'+esc(l)+'</option>';}).join('');

  var todaySt = todayStr();

  // ── Row renderers ─────────────────────────────────────────────────────
  var rowUnscheduled = function(c, n) {
    var oc = typeof umGetColor==='function' ? umGetColor(c.owner) : '#94a3b8';
    var ekAttr = esc(c._key);
    var ri = String(c.rid).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var aIcon = (typeof wpActLabel==='function'?wpActLabel(c.actionType||'call'):(c.actionType==='visit'?'🤝 ویزیت':'📞 تماس'));
    var _aHex = (typeof wpActBg==='function'?wpActBg(c.actionType||'call'):'#0ea5e9');
    var aBg = _aHex;
    var aCol = '#fff';
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
        +'<button class="wp-fcl-act-btn wp-fcl-act-sched" data-ekey="'+ekAttr+'" onclick="wpSetScheduleFromKey(this.getAttribute(\'data-ekey\'))">📅 تعیین روز</button> '
        +'<button class="wp-fcl-act-btn" style="background:#fef3c7;color:#92400e;border-color:#fcd34d" data-ekey="'+ekAttr+'" onclick="wpMoveEntry(this.getAttribute(\'data-ekey\'),\''+weekId+'\')">↪ هفته دیگر</button> '
        +'<button class="wp-fcl-act-btn wp-fcl-act-remove" data-ekey="'+ekAttr+'" onclick="wpRemoveEntry(this.getAttribute(\'data-ekey\'))">✕</button>'
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
    +'<select onchange="_wpFclFilters.lead=this.value;renderWpFullCenterList()">'+leadOpts+'</select>'
    +'<button onclick="_wpFclFilters={q:\'\',owner:\'\',prov:\'\',lead:\'\'};renderWpFullCenterList()" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-raised);cursor:pointer;font-size:11px;color:var(--text-muted)">✕ پاک</button>'
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
  _getAllowedProvinces(getAllProvinces()).forEach(function(p){
    var tp = getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var rk = c.rtype+'_'+c.id;
      if(inWeekMap[rk]) return;
      var e = getE(c.rtype,c.id); var owner = e.owner||c.owner||'';
      if(!_isManager() && owner && owner!==currentUser) return;
      centers.push({id:c.id,rtype:c.rtype,name:c.name||'',provName:p.name||'',owner:owner,ownerName:owner?(USERS[owner]||owner):'—'});
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
// مرکز را از تمام هفته‌های دیگر حذف می‌کند (SQL + حافظه) — پیاده‌سازی در core.js

function wpDeduplicateEntries(){
  var byCenter={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we||typeof we!=='object'||we.done)return;
    var rk=we.recKey||(we.rtype&&we.rid?we.rtype+'_'+we.rid:'');
    if(!rk)return;
    if(!byCenter[rk])byCenter[rk]=[];
    byCenter[rk].push(k);
  });
  var removed=0;
  var toRemove=[];
  Object.keys(byCenter).forEach(function(rk){
    var keys=byCenter[rk];
    if(keys.length<=1)return;
    var keep=keys[keys.length-1];
    var followWeek=null;
    if(DB.edits&&DB.edits[rk]&&DB.edits[rk].followupDate&&typeof getWeekId==='function'){
      followWeek=getWeekId(DB.edits[rk].followupDate);
    }
    if(followWeek){
      var sample=DB.weekEntries[keys[0]];
      if(sample){
        var fk=wpEntryKey(followWeek,sample.rtype,sample.rid);
        if(keys.indexOf(fk)>=0)keep=fk;
      }
    }
    keys.forEach(function(k){
      if(DB.weekEntries[k]&&DB.weekEntries[k].sqlId)keep=k;
    });
    keys.forEach(function(k){
      if(k!==keep){toRemove.push(k);removed++;}
    });
    if(keys.length>1&&typeof wpRemoveFromOtherWeeks==='function'){
      var keepWeek=keep.split(':::')[0];
      wpRemoveFromOtherWeeks(rk,keepWeek);
    }
  });
  if(toRemove.length&&typeof wpBulkDeleteEntries==='function'){
    wpBulkDeleteEntries(toRemove);
  } else {
    toRemove.forEach(function(k){_weRemove(k);});
  }
  return removed;
}

var _wpSseRefreshTimer=null;
function _wpOnWeekEntryChanged(data){
  if(currentTab!=='weekplan'||window._sessionExpired)return;
  // debounce — چند رویداد پشت‌سرهم یک رفرش نرم ایجاد کنند
  clearTimeout(_wpSseRefreshTimer);
  _wpSseRefreshTimer=setTimeout(function(){
    if(typeof _wpLoadWeekFromApi!=='function')return;
    _wpLoadWeekFromApi(function(){
      _wpWithScroll(function(){
        if(typeof _renderWeekPlanBody==='function')_renderWeekPlanBody({keepSelection:true});
      });
    });
  },350);
}
window._wpOnWeekEntryChanged=_wpOnWeekEntryChanged;

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
  (wpRemoveFromOtherWeeks||function(){return Promise.resolve();})(_rk, weekId).then(function(){
    DB.weekEntries[eKey]={
      scheduledDate:dayStr, done:false, doneDate:null,
      rtype:c.rtype, rid:c.id, recKey:c.rtype+'_'+c.id,
      centerName:c.name||getRecLabel(c.rtype+'_'+c.id),
      actionType:_wpDefaultActionType(), addedBy:currentUser
    };
    return saveWeekEntryApi(eKey, DB.weekEntries[eKey]);
  }).then(function(){
    _wpSaveWeek([eKey]);
    closeModal('wpPickModal');
    renderWeekPlan();
    showToast(_wasInOther ? 'مرکز از هفته قبلی منتقل شد 🔄' : 'مرکز به هفته اضافه شد ✅', 2000);
  }).catch(function(){showToast('خطا در افزودن به هفته',2500);});
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
  if (DB.weekEntries[eKey] && !DB.weekEntries[eKey].done) { showToast('این مرکز قبلاً در این هفته است'); return; }
  var _rk = rtype+'_'+rid;
  var _wasInOther = Object.keys(DB.weekEntries||{}).some(function(k){
    if(k.startsWith(weekId+':::')) return false;
    var we=DB.weekEntries[k]; return (we.recKey||we.rtype+'_'+we.rid)===_rk;
  });
  wpRemoveFromOtherWeeks(_rk, weekId).then(function(){
    DB.weekEntries[eKey] = {
      scheduledDate: null, done: false, doneDate: null,
      rtype: rtype, rid: rid, recKey: rtype + '_' + rid,
      centerName: getRecLabel(rtype + '_' + rid),
      actionType: _wpDefaultActionType(), addedBy: currentUser
    };
    return saveWeekEntryApi(eKey, DB.weekEntries[eKey]);
  }).then(function(){
    _wpSaveWeek([eKey]);
    renderWeekPlan();
    showToast(_wasInOther ? 'مرکز از هفته قبلی منتقل شد 🔄' : 'مرکز به هفته اضافه شد ✅', 2000);
  }).catch(function(){showToast('خطا در افزودن به هفته',2500);});
}

function toggleWpActionType(eKey) {
  if (!DB.weekEntries[eKey]) return;
  var keys = (typeof wpActKeys === 'function' ? wpActKeys() : ['call', 'visit']);
  if (!keys.length) keys = ['call', 'visit'];
  var cur = DB.weekEntries[eKey].actionType || 'call';
  var idx = keys.indexOf(cur);
  var next = keys[(idx < 0 ? 0 : idx + 1) % keys.length];
  DB.weekEntries[eKey].actionType = next;
  var saveP = (typeof saveWeekEntryApi === 'function')
    ? saveWeekEntryApi(eKey, DB.weekEntries[eKey])
    : Promise.resolve();
  saveP.then(function () {
    if (typeof renderWeekPlan === 'function') renderWeekPlan({ soft: true });
    else if (typeof _debouncedRenderWeekPlan === 'function') _debouncedRenderWeekPlan();
  }).catch(function () {
    if (typeof showToast === 'function') showToast('⚠ ذخیره نوع پیگیری ناموفق', 2500);
  });
}

function renderWpItem(entry,weekId){
  var k=entry._key||'';var parsed=wpParseEntryKey(k);
  var rtype=entry.rtype||parsed.rtype||'';var rid=entry.rid||parsed.rid||'';
  if((!rtype||!rid)&&entry.recKey){var _rp=entry.recKey.indexOf('_');if(_rp>0){rtype=entry.recKey.slice(0,_rp);rid=entry.recKey.slice(_rp+1);}}
  if(!rtype)rtype='center';if(!rid)rid='?';
  var recKey=entry.recKey||(rtype+'_'+rid);
  var name=(typeof resolveWeekEntryDisplayName==='function'
    ? resolveWeekEntryDisplayName(entry)
    : (entry.centerName||entry._name||getRecLabel(recKey)));
  var done=entry.done;
  // نمایش ویژه پیگیری مطالبات
  if(rtype==='mtr'){
    var amtStr=entry.mtrAmount?Math.round(entry.mtrAmount).toLocaleString('fa')+' ت':'';
    return '<div class="wp-item'+(done?' done':'')+'" data-ekey="'+esc(k)+'" draggable="true" ondragstart="event.stopPropagation();wpDragStart(event,this.getAttribute(\'data-ekey\'))" ondragend="wpDragEnd(event)" style="border-right-color:#dc2626;background:'+(done?'var(--bg-raised)':'#fef2f2')+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      +'<div class="wp-item-name" style="color:#991b1b">📄 '+esc(entry.mtrCustomer||rid)+'</div>'
      +(amtStr?'<span style="font-size:9px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:10px;font-weight:700;white-space:nowrap">'+amtStr+'</span>':'')
      +'</div>'
      +'<div class="wp-item-meta" style="color:#dc2626">مطالبات — ف'+esc(rid)+(done?' ✓':'')+'</div>'
      +'<div class="wp-item-actions">'
      +(done?'':'<button type="button" class="wp-btn done-btn" data-ekey="'+esc(k)+'" onclick="wpMarkDoneKey(this.getAttribute(\'data-ekey\'))">✓ وصول شد</button>')
      +'<button type="button" class="wp-btn" style="border-color:#dc2626;color:#991b1b" data-ekey="'+esc(k)+'" onclick="wpRemoveEntry(this.getAttribute(\'data-ekey\'))">✕</button>'
      +'</div></div>';
  }
  
  var actType = entry.actionType || 'call';
  var actIcon = (typeof wpActLabel==='function'?wpActLabel(actType):(actType==='visit'?'🤝 ویزیت':'📞 تماس'));
  var actBg = (typeof wpActBg==='function'?wpActBg(actType):(actType==='visit'?'#8b5cf6':'#0ea5e9'));
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

  return '<div class="wp-item'+(done?' done':'')+(!done&&isSel2?' wp-selected':'')+'" data-ekey="'+esc(k)+'" draggable="true" ondragstart="event.stopPropagation();wpDragStart(event,this.getAttribute(\'data-ekey\'))" ondragend="wpDragEnd(event)">'
    + '<input type="checkbox" class="wp-item-cb" '+(isSel2?'checked':'')+' onclick="event.stopPropagation();wpToggleSelect(this.closest(\'.wp-item\').getAttribute(\'data-ekey\'))" title="انتخاب">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-left:18px;">'
    + '<div class="wp-item-name" data-open-center="1" data-rtype="'+esc(rtype)+'" data-rid="'+esc(String(rid))+'" style="cursor:pointer;text-decoration:underline dotted;color:var(--brand);display:flex;align-items:center;gap:4px">'+_todayDot+esc(name)+'</div>'
    + '<span style="font-size:9px; cursor:pointer; background:'+actBg+'; color:var(--text-primary); padding:2px 5px; border-radius:4px; white-space:nowrap;" data-ekey="'+esc(k)+'" onclick="toggleWpActionType(this.getAttribute(\'data-ekey\'))" title="تغییر نوع پیگیری با یک کلیک">'+actIcon+'</span>'
    + '</div>'
    + (function(){var _ce=getE(rtype,rid);var _st=_ce.status||'بدون تماس';var _owId=_wpGetOwner(entry);var _ow=USERS[_owId]||_owId||'';var _fd=_ce.followupDate||'';var _owHtml=_ow?'<span style="display:inline-block;background:#dbeafe;color:#1e40af;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin-right:4px">👤 '+esc(_ow)+'</span>':'';return '<div class="wp-item-meta" style="margin-top:3px">'+_owHtml+'<span style="font-size:9px;color:var(--text-muted)">'+_st+( (_fd)?' 📅 '+_fd:'')+' '+(done?'✓ '+entry.doneDate:'')+'</span></div>';})()
    + '<div class="wp-item-actions">'
    + (done?'' : '<button type="button" class="wp-btn done-btn" data-ekey="'+esc(k)+'" onclick="wpMarkDoneKey(this.getAttribute(\'data-ekey\'))">✓ انجام شد</button>')
    + '<button type="button" class="wp-btn move-btn" data-ekey="'+esc(k)+'" onclick="wpSetScheduleFromKey(this.getAttribute(\'data-ekey\'))">📅 تنظیم</button>'
    + '<button type="button" class="wp-btn" style="border-color:#0ea5e9;color:#0369a1" data-ekey="'+esc(k)+'" data-weekid="'+esc(weekId)+'" onclick="wpMoveEntry(this.getAttribute(\'data-ekey\'),this.getAttribute(\'data-weekid\'))">↪ هفته دیگر</button>'
    + '<button type="button" class="wp-btn" style="border-color:#dc2626;color:#991b1b" data-ekey="'+esc(k)+'" onclick="wpRemoveEntry(this.getAttribute(\'data-ekey\'))">✕</button>'
    + '</div></div>';
}
var _wpSelected = new Set();

function wpToggleSelect(eKey){
  if(_wpSelected.has(eKey)) _wpSelected.delete(eKey);
  else _wpSelected.add(eKey);
  _wpUpdateBulkBar();
  var el = null;
  try {
    if (window.CSS && typeof CSS.escape === 'function') {
      el = document.querySelector('.wp-item[data-ekey="'+CSS.escape(eKey)+'"]');
    }
  } catch (e) {}
  if (!el) {
    el = Array.prototype.find.call(document.querySelectorAll('.wp-item[data-ekey]'), function (node) {
      return node.getAttribute('data-ekey') === eKey;
    });
  }
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

async function _wpPersistDoneEntry(eKey,we){
  var payload={
    done:true,
    doneDate:we.doneDate||todayStr(),
    doneResult:we.doneResult||'bulk_done',
    doneNote:we.doneNote||'ثبت گروهی',
    doneAmount:we.doneAmount||null,
    scheduledDate:we.scheduledDate||null,
    actionType:we.actionType||'call'
  };
  if(we.sqlId){
    var putRes=await fetch('/api/week-entries/'+encodeURIComponent(we.sqlId),{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    if(!putRes.ok)throw new Error('HTTP '+putRes.status);
    return;
  }
  var parsed=wpParseEntryKey(eKey);
  var newId='we_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  var createRes=await fetch('/api/week-entries',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(Object.assign(payload,{
      id:newId,weekId:parsed.weekId||eKey.split(':::')[0],
      recKey:we.recKey||((we.rtype||parsed.rtype)+'_'+(we.rid||parsed.rid)),
      rtype:we.rtype||parsed.rtype,rid:we.rid||parsed.rid,
      addedBy:we.addedBy||currentUser,centerName:we.centerName||''
    }))
  });
  if(!createRes.ok)throw new Error('HTTP '+createRes.status);
  var created=await createRes.json();
  if(created&&created.id){
    we.sqlId=created.id;
    var doneRes=await fetch('/api/week-entries/'+encodeURIComponent(created.id),{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    if(!doneRes.ok)throw new Error('HTTP '+doneRes.status);
  }
}

async function wpBulkDone(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  var previous={};
  keys.forEach(function(k){
    if(DB.weekEntries[k]){
      previous[k]={done:DB.weekEntries[k].done,doneDate:DB.weekEntries[k].doneDate,doneResult:DB.weekEntries[k].doneResult,doneNote:DB.weekEntries[k].doneNote};
      DB.weekEntries[k].done=true;
      DB.weekEntries[k].doneDate=todayStr();
      DB.weekEntries[k].doneResult='bulk_done';
      DB.weekEntries[k].doneNote='ثبت گروهی';
    }
  });
  try{
    await Promise.all(keys.map(function(k){return _wpPersistDoneEntry(k,DB.weekEntries[k]);}));
    keys.forEach(function(k){
      var we=DB.weekEntries[k];if(!we)return;
      var actionType=we.actionType||'call';
      var rkey=we.recKey||((we.rtype||'center')+'_'+(we.rid||''));
      var cl={at:new Date().toISOString(),by:currentUser||'',rkey:rkey,field:actionType,val:'bulk_done'};
      fetch('/api/changelog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cl)}).catch(function(){});
    });
    wpClearSelection();_debouncedRenderWeekPlan();
    showToast('✅ '+keys.length+' مورد در SQL به عنوان انجام‌شده ثبت شد',3000);
  }catch(err){
    keys.forEach(function(k){if(DB.weekEntries[k]&&previous[k])Object.assign(DB.weekEntries[k],previous[k]);});
    _debouncedRenderWeekPlan();
    showToast('⚠ ثبت گروهی ناموفق بود؛ تغییری اعمال نشد',3500);
  }
}

function wpBulkRemove(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  if(!confirm(keys.length+' مورد از برنامه هفته حذف شود؟')) return;
  (typeof wpBulkDeleteEntries==='function'?wpBulkDeleteEntries(keys):Promise.resolve(keys.length)).then(function(){
    _wpSaveWeek([]); wpClearSelection(); _debouncedRenderWeekPlan();
    showToast('🗑 '+keys.length+' مورد حذف شد',2000);
  });
}

function wpBulkMoveDay(){
  var keys = Array.from(_wpSelected);
  if(!keys.length) return;
  var sel = document.getElementById('wpSel');
  var weekId = sel ? sel.value : null;
  var wk = weekId ? wpGetWeeks().find(function(w){ return w.id === weekId; }) : null;
  if(!wk){ showToast('⚠ ابتدا هفته را انتخاب کنید'); return; }
  var today = todayStr();
  var days = [];
  for(var i = 0; i < 7; i++){
    var d = jAdd(wk.wsArr[0], wk.wsArr[1], wk.wsArr[2], i);
    var str = d[0] + '/' + p2(d[1]) + '/' + p2(d[2]);
    days.push({ str: str, name: (typeof J_DAYS !== 'undefined' ? J_DAYS[i] : ''), isToday: str === today });
  }
  var body = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">'+keys.length+' مورد انتخابی را به کدام روز منتقل کنید؟</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
    +days.map(function(day){
      return '<button type="button" onclick="wpDoBulkMoveDay(\''+day.str+'\')" style="padding:12px 10px;border:1px solid '+(day.isToday?'#0ea5e9':'var(--border)')+';border-radius:8px;background:'+(day.isToday?'#eff6ff':'var(--card)')+';cursor:pointer;font-family:inherit;text-align:center">'
        +'<div style="font-weight:700;color:var(--text-primary)">'+esc(day.name||'')+'</div>'
        +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px;direction:ltr">'+esc(day.str)+'</div>'
        +'</button>';
    }).join('')
    +'</div>';
  openModal('wpBulkDayModal','📅 جابجایی روز — '+keys.length+' مورد',body,'<button class="btn-secondary" onclick="closeModal(\'wpBulkDayModal\')">انصراف</button>');
}

function wpDoBulkMoveDay(targetDate){
  var keys = Array.from(_wpSelected);
  if(!keys.length || !targetDate) return;
  var n = 0;
  var puts = [];
  keys.forEach(function(eKey){
    var we = DB.weekEntries[eKey];
    if(!we || we.done) return;
    if(we.scheduledDate === targetDate) return;
    we.scheduledDate = targetDate;
    if(we.rtype && we.rid) setE(we.rtype, we.rid, 'followupDate', targetDate);
    n++;
    if(we.sqlId){
      puts.push(fetch('/api/week-entries/'+encodeURIComponent(we.sqlId),{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({scheduledDate:targetDate})
      }).catch(function(){}));
    } else if(typeof saveWeekEntryApi === 'function'){
      puts.push(saveWeekEntryApi(eKey, we));
    }
  });
  Promise.all(puts).then(function(){
    if(typeof _wpSaveWeek === 'function') _wpSaveWeek(keys);
    wpClearSelection();
    closeModal('wpBulkDayModal');
    renderWeekPlan();
    showToast(n ? ('📅 '+n+' مورد به '+targetDate+' منتقل شد') : 'تغییری لازم نبود', 2500);
  });
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
  openModal('wpBulkMoveModal','📦 تعیین هفته — '+keys.length+' مورد',body,'<button class="btn-secondary" onclick="closeModal(\'wpBulkMoveModal\')">انصراف</button>');
}

function wpDoBulkMove(targetWeekId){
  var keys = Array.from(_wpSelected);
  if(!keys.length)return;
  Promise.all(keys.map(function(eKey){
    return typeof wpTransferWeekEntry==='function'
      ? wpTransferWeekEntry(eKey, targetWeekId, { clearSchedule: true })
      : Promise.resolve(null);
  })).then(function(){
    _wpSaveWeek(keys); wpClearSelection(); closeModal('wpBulkMoveModal'); renderWeekPlan();
    showToast('↪ '+keys.length+' مورد منتقل شد',2500);
  }).catch(function(e){showToast('❌ '+(e.message||'انتقال ناموفق'),3000);});
}

function wpMarkDoneKey(eKey){
  if(!eKey)return;
  if(typeof openCenterInteraction==='function'){
    if(!DB.weekEntries[eKey]){
      showToast('⚠ این کارت در حافظه نیست — صفحه را رفرش کنید');
      return;
    }
    var we=DB.weekEntries[eKey];
    var rtype=we.rtype||(we.recKey?we.recKey.split('_')[0]:'center');
    var rid=we.rid||(we.recKey?we.recKey.split('_').slice(1).join('_'):'');
    var cname=we.centerName||'';
    if(!cname&&rtype&&rid){var c=getCenterById(rtype,rid);if(c)cname=c.name||c.hosp_name||'';}
    openCenterInteraction({
      rtype:rtype,rid:rid,centerName:cname,weekEntryKey:eKey,
      actionType:we.actionType||'call',pfNo:we.pfNo,pfId:we.pfId
    });
    return;
  }
  showToast('⚠ ماژول ثبت نتیجه لود نشده');
}
window.wpMarkDoneKey = wpMarkDoneKey;
function _mdkSelectOutcome(lbl,val){if(typeof _ciSelectOutcome==='function')_ciSelectOutcome(lbl,val);}
function _mdkLostSelect(btn,reason){if(typeof _ciLostSelect==='function')_ciLostSelect(btn,reason);}
function _mdkCheckSubmit(){if(typeof _ciCheckSubmit==='function')_ciCheckSubmit();}
function jAddDays(jy,jm,jd,days){
  var g=j2g(jy,jm,jd);var ts=new Date(g[0],g[1]-1,g[2],12);
  ts.setDate(ts.getDate()+days);
  return g2j(ts.getFullYear(),ts.getMonth()+1,ts.getDate());
}
function _wpFinishDone(eKey){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  var rtype=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');
  var rid=we.rid||(we.recKey?we.recKey.split('_').slice(1).join('_'):'');
  var cname=(typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||''));
  var actionType=we.actionType||'call';
  var outcomeEl=document.querySelector('[name="ci_outcome"]:checked')||document.querySelector('[name="_mdk_outcome"]:checked');
  var outcome=outcomeEl?outcomeEl.value:'followup';
  var note=(document.getElementById('ci_note')||document.getElementById('_mdk_note')||{}).value||'';
  var nextDate=(document.getElementById('ci_nextdate')||document.getElementById('_mdk_nextdate')||{}).value||'';
  var amount=parseFloat((document.getElementById('ci_amount')||document.getElementById('_mdk_amount')||{}).value||'')||0;
  var lostReason=(document.getElementById('ci_lost_reason')||document.getElementById('_mdk_lost_reason')||{}).value||'';
  var centerKey=typeof recK==='function'?recK(rtype,rid):(rtype+'_'+rid);

  function _wpFinishDoneAfterProjections(skipCenterPatch, opts){
    opts=opts||{};
    var interactionSaved=!!opts.interactionSaved;
    we.done=true;we.doneDate=todayStr();we.doneResult=outcome;we.doneNote=note;
    if(amount>0)we.doneAmount=amount;

    var _foundWeekLabel='';
    if(outcome==='won'){
      if(rtype&&rid&&!skipCenterPatch){setE(rtype,rid,'status','قرارداد بسته شد');}
    } else if(outcome==='inactive'){
      if(rtype&&rid&&!skipCenterPatch){
        var _ik=recK(rtype,rid);if(!DB.edits[_ik])DB.edits[_ik]={};DB.edits[_ik].lostReason=lostReason||'—';
        setE(rtype,rid,'status','غیرفعال');
      }
    } else {
      if(nextDate&&rtype&&rid){
        if(!skipCenterPatch)setE(rtype,rid,'followupDate',nextDate);
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
            if(newKey===eKey){
              DB.weekEntries[eKey].scheduledDate=nextDate;
              DB.weekEntries[eKey].done=false;
              DB.weekEntries[eKey].doneDate=null;
              DB.weekEntries[eKey].doneResult=null;
              DB.weekEntries[eKey].doneNote=null;
            } else {
              DB.weekEntries[newKey]={scheduledDate:nextDate,done:false,doneDate:null,rtype:rtype,rid:rid,recKey:rtype+'_'+rid,centerName:cname,actionType:actionType,addedBy:currentUser};
              wpRemoveFromOtherWeeks(rtype+'_'+rid, foundWeek.id).then(function(){
                return saveWeekEntryApi(newKey, DB.weekEntries[newKey]);
              }).catch(function(){});
            }
            _wpYear=foundWeek.jYear;
            var _sel=document.getElementById('wpSel');
            if(_sel){wpBuildSelect();_sel.value=foundWeek.id;}
            _foundWeekLabel=foundWeek.label;
          }
        }
      }
    }

    if(we.pfId&&typeof window._pfOnOutcomeDone==='function'){
      window._pfOnOutcomeDone(we.pfId,{outcome:outcome,note:note,nextDate:nextDate,lostReason:lostReason,amount:amount,pfNo:we.pfNo||''});
    }
    closeModal('centerInteractionModal');
    closeModal('wpDoneModal');
    // Interaction API already persists notes + week-entry done state on the server.
    // Only sync week plan locally when needed (fallback path or followup reschedule).
    if(typeof saveWeekEntryApi==='function'){
      var needsWeekSync=!interactionSaved||(outcome==='followup'&&!!nextDate);
      if(needsWeekSync){
        saveWeekEntryApi(eKey,we).then(function(saved){
          if(!saved&&!interactionSaved&&typeof showToast==='function'){
            showToast('⚠ گزارش انجام ذخیره نشد؛ دوباره تلاش کنید',3500);
          }
        }).catch(function(){});
      }
    }
    _debouncedRenderWeekPlan();renderDashboard();
    if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
    var msg=outcome==='won'?'🎉 قرارداد ثبت شد! — '+cname
      :outcome==='inactive'?'❌ غیرفعال شد — '+cname
      :_foundWeekLabel?'✅ ثبت شد — پیگیری در '+_foundWeekLabel:'✅ ثبت شد!';
    showToast(msg,3000);
    if(currentTab==='kpi')setTimeout(renderKPIPanel,300);
  }

  if(typeof postCenterInteraction==='function'&&rtype&&rid){
    function submitInteraction(){
      return postCenterInteraction(centerKey,{
        mode:'done',
        actionType:actionType,
        outcome:outcome,
        note:note,
        followupDate:nextDate||null,
        weekEntryId:we.sqlId||null,
        centerName:cname,
        lostReason:lostReason,
        amount:amount,
        pfNo:we.pfNo||'',
        occurredDate:todayStr(),
        idempotencyKey:typeof _ciNewIdempotencyKey==='function'?_ciNewIdempotencyKey():('done_'+eKey+'_'+Date.now()),
      });
    }
    // A completed report must have a persisted week-entry anchor. This covers
    // cards created locally just before the user clicks «انجام شد».
    var readyForReport=we.sqlId?Promise.resolve(we.sqlId):
      (typeof saveWeekEntryApi==='function'?saveWeekEntryApi(eKey,we):Promise.resolve(null));
    readyForReport.then(function(saved){
      if(saved&&saved.id)we.sqlId=saved.id;
      if(!we.sqlId)throw new Error('کارت برنامه هفته همگام‌سازی نشد');
      return submitInteraction();
    }).then(function(res){
      if(typeof _ciApplyInteractionResult==='function')_ciApplyInteractionResult(centerKey,rtype,rid,res);
      _wpFinishDoneAfterProjections(true,{interactionSaved:true});
      if(typeof window.markNotifsForCenterRead==='function'){
        window.markNotifsForCenterRead(centerKey);
      }
    }).catch(function(err){
      var errMsg=(err&&err.error)||(err&&err.message)||'خطا در ثبت نتیجه';
      showToast('⚠ '+errMsg,3500);
    });
    return;
  }

  // ── Fallback: client-only projections (بدون interactions API) ──
  we.done=true;we.doneDate=todayStr();we.doneResult=outcome;we.doneNote=note;
  if(amount>0)we.doneAmount=amount;
  ensureKPIDB();
  var logEntry={id:Date.now(),date:todayStr(),userId:currentUser||'',centerName:cname,centerKey:centerKey,note:note,count:1,outcome:outcome};
  if(actionType==='visit'){DB.visitLog.push(logEntry);}
  else if(actionType==='call'){DB.callLog.push(logEntry);}
  if(typeof _postActivityLog==='function'&&(actionType==='visit'||actionType==='call')){_postActivityLog(actionType, logEntry);}
  DB.changeLog=DB.changeLog||[];
  var _clEntry={at:new Date().toISOString(),by:currentUser||'',rkey:centerKey,field:actionType,val:outcome+(note?' — '+note:'')};
  DB.changeLog.push(_clEntry);
  if(DB.changeLog.length>500)DB.changeLog=DB.changeLog.slice(-500);
  fetch('/api/changelog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(_clEntry)}).catch(function(){});
  if(rtype&&rid){
    if(!DB.notes)DB.notes={};
    if(!DB.notes[centerKey])DB.notes[centerKey]=[];
    var pfx=(typeof wpActLabel==='function'?wpActLabel(actionType): (actionType==='visit'?'🤝 مراجعه':'📞 تماس'))+' انجام شد: ';
    if(we.pfNo)pfx='📄 PF '+we.pfNo+' — '+pfx;
    var outcomeText = outcome==='won'?'قرارداد / فروش بسته شد'+(amount>0?' (مبلغ: '+amount+' میلیون تومان)':'')
      :outcome==='inactive'?'غیرفعال / رد شد'+(lostReason?' (دلیل: '+lostReason+')':'')
      :'نیاز به پیگیری دارد'+(nextDate?' (تاریخ پیگیری بعدی: '+nextDate+')':'');
    var fullNoteText=pfx+outcomeText+(note?'\nتوضیح: '+note:'');
    DB.notes[centerKey].push({text:fullNoteText,date:todayStr(),user:USERS[currentUser]||currentUser,ts:Date.now()});
    postCenterNote(centerKey, fullNoteText, { user: USERS[currentUser]||currentUser });
  }
  if(outcome==='won'&&amount>0){
    ensureKPIDB();
    var saleEntry={id:Date.now()+1,date:todayStr(),userId:currentUser||'',centerName:cname,centerKey:centerKey,amount:amount,isCash:false};
    DB.salesLog.push(saleEntry);
    if(typeof _postActivityLog==='function')_postActivityLog('sales',saleEntry);
  }
  _wpFinishDoneAfterProjections();
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
  var _we = DB.weekEntries[eKey];
  if (_we.rtype && _we.rid) {
    setE(_we.rtype, _we.rid, 'followupDate', targetDate);
  }
  _wpSaveWeek([eKey]);
  (function(){var _we=DB.weekEntries[eKey];if(_we&&_we.sqlId){fetch('/api/week-entries/'+encodeURIComponent(_we.sqlId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduledDate:targetDate})}).catch(function(){});}})();
  renderWeekPlan();
  showToast('📅 تاریخ به ' + targetDate + ' تغییر کرد', 2000);
}

function wpRemoveEntry(eKey){
  var _wre=DB.weekEntries[eKey];if(_wre&&_wre.sqlId){fetch('/api/week-entries/'+encodeURIComponent(_wre.sqlId),{method:'DELETE'}).catch(function(){});}
  _weRemove(eKey);_wpSaveWeek([]);_debouncedRenderWeekPlan();
}
// حذف همه ورودی‌های یک مرکز در یک هفته خاص (برای رفع مشکل duplicate)
function wpRemoveAllInWeek(weekId,recKey){
  var keys=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    if(k.split(':::')[0]!==weekId)return;
    var we=DB.weekEntries[k];
    var rk=we.recKey||(we.rtype+'_'+we.rid);
    var parsed=wpParseEntryKey(k);
    var keyRk=parsed.rtype+'_'+parsed.rid;
    if(rk===recKey||keyRk===recKey)keys.push(k);
  });
  (typeof wpBulkDeleteEntries==='function'?wpBulkDeleteEntries(keys):Promise.resolve(0)).then(function(){
    _debouncedRenderWeekPlan();
    if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
  });
}

function wpMoveEntry(eKey,currentWeekId){
  var we=DB.weekEntries[eKey];
  if(!we)return;
  var recKey=we.recKey||(we.rtype+'_'+we.rid);
  function _open(){
    var freshKey=(DB.weekEntries[eKey]&&!DB.weekEntries[eKey].done)?eKey:null;
    if(!freshKey){
      Object.keys(DB.weekEntries||{}).forEach(function(k){
        if(currentWeekId&&!k.startsWith(currentWeekId+':::'))return;
        var w2=DB.weekEntries[k];
        if(!w2||w2.done)return;
        if(typeof wpMatchRecKey==='function'?!wpMatchRecKey(w2,recKey):(w2.recKey||(w2.rtype+'_'+w2.rid))!==recKey)return;
        freshKey=k;
      });
    }
    if(!freshKey)return;
    _wpMoveEntryRender(freshKey,currentWeekId);
  }
  if(typeof wpSyncCenterWeekEntriesFromApi==='function'){
    wpSyncCenterWeekEntriesFromApi(recKey).then(_open).catch(_open);
  }else{
    _open();
  }
}

function _wpMoveEntryRender(eKey,currentWeekId){
  if(!DB.weekEntries[eKey])return;
  var we=DB.weekEntries[eKey];
  var name=(typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||we._name||(we.recKey?getRecLabel(we.recKey):'?')));
  var recKey=we.recKey||(we.rtype+'_'+we.rid);
  var entryWeekId=eKey.split(':::')[0]||currentWeekId;
  var weeks=wpGetWeeks();
  var entryWeek=weeks.find(function(w){return w.id===entryWeekId;});
  var entryWeekLabel=entryWeek?entryWeek.label:entryWeekId;

  var activeWeekLabels=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var w2=DB.weekEntries[k];
    if(!w2||w2.done)return;
    if(typeof wpMatchRecKey==='function'?!wpMatchRecKey(w2,recKey):(w2.recKey||(w2.rtype+'_'+w2.rid))!==recKey)return;
    var wid=k.split(':::')[0];
    var wk=weeks.find(function(w){return w.id===wid;});
    var lbl=wk?wk.label:wid;
    if(activeWeekLabels.indexOf(lbl)<0)activeWeekLabels.push(lbl);
  });
  if(!activeWeekLabels.length&&entryWeekLabel)activeWeekLabels.push(entryWeekLabel);

  var futureWeeks=weeks.filter(function(w){return w.id!==entryWeekId&&!w.isPast;}).slice(0,10);
  var pastWeeks=weeks.filter(function(w){return w.id!==entryWeekId&&w.isPast;}).slice(-4);
  var shown=pastWeeks.concat(futureWeeks);

  var currentRow=activeWeekLabels.length
    ?'<div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:1px solid #93c5fd;border-radius:8px;background:#dbeafe;margin-bottom:8px">'
      +'<div><div style="font-weight:700;font-size:12px;color:#1e3a8a">'+esc(activeWeekLabels.join('، '))+'</div>'
      +'<div style="font-size:10px;color:#1d4ed8;margin-top:2px">📍 هفته فعلی — در برنامه</div></div>'
      +'<span style="font-size:10px;background:#1e40af;color:#fff;padding:3px 10px;border-radius:10px;font-weight:600">فعلی</span>'
    +'</div>'
    :'';

  var body=(activeWeekLabels.length
      ?'<div style="font-size:11px;background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:5px;padding:7px 10px;margin-bottom:10px">📌 <strong>'+esc(name)+'</strong> الان در <strong>'+esc(activeWeekLabels.join('، '))+'</strong> است. هفته مقصد را انتخاب کنید:</div>'
      :'<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">'+esc(name)+' را به کدام هفته منتقل کنید؟</div>'
    )
    +currentRow
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
  if(typeof wpTransferWeekEntry!=='function'){showToast('انتقال در دسترس نیست');return;}
  wpTransferWeekEntry(eKey, targetWeekId, { clearSchedule: true }).then(function(newKey){
    closeModal('wpMoveModal');
    _wpSaveWeek([newKey||eKey]); renderWeekPlan();
    showToast('مرکز به هفته جدید منتقل شد',2500);
  }).catch(function(e){
    showToast('❌ '+(e.message||'انتقال ناموفق'),3000);
  });
}

function clearScheduleDate(eKey){
  if(!DB.weekEntries[eKey])return;
  DB.weekEntries[eKey].scheduledDate=null;
  (function(){var _wec=DB.weekEntries[eKey];if(_wec&&_wec.sqlId){fetch('/api/week-entries/'+encodeURIComponent(_wec.sqlId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduledDate:null})}).catch(function(){});}})();
  _wpSaveWeek([eKey]);closeModal('schModal');_debouncedRenderWeekPlan();
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
    + (typeof wpActOptionsHtml==='function'?wpActOptionsHtml(curType):('<option value="call"'+(curType==='call'?' selected':'')+'>📞 تماس تلفنی</option><option value="visit"'+(curType==='visit'?' selected':'')+'>🤝 ویزیت حضوری</option>'))
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
          if(typeof wpTransferWeekEntry==='function'){
            wpTransferWeekEntry(eKey, destWeek.id, { scheduledDate: dateVal, actionType: actVal, clearSchedule: false }).then(function(nk){
              if(_we2.rtype&&_we2.rid)setE(_we2.rtype,_we2.rid,'followupDate',dateVal);
              _wpYear=destWeek.jYear;
              var _sel2=document.getElementById('wpSel');
              if(_sel2){wpBuildSelect();_sel2.value=destWeek.id;}
              _wpSaveWeek([nk||newKey2]);closeModal('schModal');_debouncedRenderWeekPlan();
              showToast('↪ انتقال به '+destWeek.label, 2500);
            }).catch(function(err){showToast('❌ '+(err.message||'انتقال ناموفق'),3000);});
            return;
          }
          DB.weekEntries[newKey2]=Object.assign({},_we2,{scheduledDate:dateVal,actionType:actVal,done:false,doneDate:null});
          _weRemove(eKey);
        } else {
          DB.weekEntries[eKey].scheduledDate=dateVal;
          DB.weekEntries[eKey].actionType=actVal;
          DB.weekEntries[eKey].done=false;
          DB.weekEntries[eKey].doneDate=null;
          DB.weekEntries[eKey].doneResult=null;
          DB.weekEntries[eKey].doneNote=null;
        }
        if(_we2.rtype&&_we2.rid)setE(_we2.rtype,_we2.rid,'followupDate',dateVal);
        _wpYear=destWeek.jYear;
        var _sel2=document.getElementById('wpSel');
        if(_sel2){wpBuildSelect();_sel2.value=destWeek.id;}
      }
      (function(){var _wen=DB.weekEntries[newKey2]||DB.weekEntries[eKey];if(_wen&&_wen.sqlId){fetch('/api/week-entries/'+encodeURIComponent(_wen.sqlId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({weekId:destWeek.id,scheduledDate:dateVal,actionType:actVal})}).catch(function(){});}})();
      _wpSaveWeek([newKey2||eKey]);closeModal('schModal');_debouncedRenderWeekPlan();
      showToast('↪ انتقال به '+(destWeek?destWeek.label:dateVal), 2500);
      return;
    }
  }

  DB.weekEntries[eKey].scheduledDate = dateVal;
  DB.weekEntries[eKey].actionType = actVal;
  DB.weekEntries[eKey].done = false;
  DB.weekEntries[eKey].doneDate = null;
  DB.weekEntries[eKey].doneResult = null;
  DB.weekEntries[eKey].doneNote = null;
  var we = DB.weekEntries[eKey];
  var rtype = we.rtype; var rid = we.rid;
  if(rtype && rid){setE(rtype, rid, 'followupDate', dateVal);}
  var finish = function(){
    closeModal('schModal');
    if (typeof renderWeekPlan === 'function') renderWeekPlan({ soft: true });
    else if (typeof _debouncedRenderWeekPlan === 'function') _debouncedRenderWeekPlan();
    showToast('📅 برنامه تنظیم شد', 2500);
  };
  if (typeof saveWeekEntryApi === 'function') {
    saveWeekEntryApi(eKey, DB.weekEntries[eKey]).then(finish).catch(function(){
      showToast('⚠ ذخیره برنامه ناموفق', 2500);
      finish();
    });
  } else {
    finish();
  }
}
function openAssignWeekForCenter(rtype,id,name){
  var recKey=rtype+'_'+id;
  var render=function(apiRows){
    _renderAssignWeekModal(rtype,id,name,recKey,apiRows||[]);
  };
  if(typeof wpSyncCenterWeekEntriesFromApi==='function'){
    wpSyncCenterWeekEntriesFromApi(recKey).then(render).catch(function(){
      render(_wpLocalCenterWeekRows(recKey));
    });
  } else {
    render(_wpLocalCenterWeekRows(recKey));
  }
}

function _wpLocalCenterWeekRows(recKey){
  var rows=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we||we.done||!wpMatchRecKey(we,recKey))return;
    var parsed=wpParseEntryKey(k);
    rows.push({
      weekId:parsed.weekId||k.split(':::')[0],
      rtype:we.rtype||parsed.rtype,
      rid:we.rid||parsed.rid,
      recKey:we.recKey||recKey,
      done:false,
      scheduledDate:we.scheduledDate,
      actionType:we.actionType,
      id:we.sqlId||we.id,
    });
  });
  return rows;
}

function _renderAssignWeekModal(rtype,id,name,recKey,apiRows){
  apiRows=apiRows||[];
  var wks=wpGetWeeks();
  var activeWeeksMap = {};
  Object.keys(DB.weekEntries || {}).forEach(function(k) {
    var we = DB.weekEntries[k];
    if (we && !we.done) {
      activeWeeksMap[k.split(':::')[0]] = true;
    }
  });
  var shown=[];var seen={};
  var pastWks = wks.filter(function(w){return w.isPast;});
  var recentPastWks = pastWks.slice(-3);

  var currentWeekKeys={};
  apiRows.forEach(function(row){
    if(row.done)return;
    var wid=row.weekId;
    if(!wid)return;
    var k=wid+':::'+row.rtype+':::'+row.rid;
    if(!currentWeekKeys[wid])currentWeekKeys[wid]=[];
    currentWeekKeys[wid].push(k);
    if(typeof wpRowToMem==='function'){
      var mapped=wpRowToMem(row);
      DB.weekEntries[mapped.key]=mapped.entry;
    }
  });
  if(!apiRows.length){
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      var we=DB.weekEntries[k];
      if(we.done)return;
      if(!wpMatchRecKey(we,recKey))return;
      var wid=k.split(':::')[0];
      if(!currentWeekKeys[wid])currentWeekKeys[wid]=[];
      currentWeekKeys[wid].push(k);
    });
  }

  Object.keys(currentWeekKeys).forEach(function(wid){activeWeeksMap[wid]=true;});

  wks.filter(function(w){return w.isCurrent||!w.isPast;}).slice(0,8)
    .concat(pastWks.filter(function(w){return activeWeeksMap[w.id] || recentPastWks.some(function(r){return r.id===w.id;});}))
    .forEach(function(w){if(!seen[w.id]){seen[w.id]=true;shown.push(w);}});
  Object.keys(currentWeekKeys).forEach(function(wid){
    if(seen[wid])return;
    seen[wid]=true;
    var w=wks.find(function(x){return x.id===wid;});
    shown.push(w||{id:wid,num:9999,label:'هفته '+wid,isCurrent:false,isPast:false});
  });
  shown.sort(function(a,b){return (a.num||0)-(b.num||0);});

  var inWeekIds=Object.keys(currentWeekKeys);
  var currentWeekLabel='';
  if(inWeekIds.length){
    currentWeekLabel=inWeekIds.map(function(wid){
      var cw=wks.find(function(w){return w.id===wid;});
      return cw?cw.label:wid;
    }).join('، ');
  }

  var body='<div style="margin-bottom:10px;display:flex;gap:10px;align-items:center;background:var(--brand-bg);padding:8px;border-radius:6px;border:1px solid #bae6fd;">'
    +'<label style="font-size:11px;font-weight:bold;color:#0369a1;">نوع برنامه:</label>'
    +'<select id="wpActType" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:4px;font-size:11px;flex:1;">'
    +(typeof wpActOptionsHtml==='function'?wpActOptionsHtml('call'):('<option value="call">📞 تماس تلفنی</option><option value="visit">🤝 ویزیت حضوری</option>'))
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
          ?'<button class="btn-danger" style="padding:3px 10px;font-size:11px" data-wp-rm-week="'+esc(wt.id)+'" data-wp-rec="'+esc(recKey)+'">✕ حذف</button>'
          :'<button class="btn-primary" style="padding:3px 10px;font-size:11px;background:'+(inWeekIds.length?'#8b5cf6':'#0ea5e9')+';" data-wp-add-week="'+esc(wt.id)+'" data-wp-rtype="'+esc(rtype)+'" data-wp-rid="'+esc(id)+'" data-wp-name="'+esc(name)+'">'
            +(inWeekIds.length?'↪ انتقال':'+ افزودن')
          +'</button>'
        )
        +'</div>';
    }).join('')+'</div>';

  openModal('awc_'+id,'📋 برنامه هفته — «'+esc(name)+'»',body,'<button class="btn-secondary" onclick="closeModal(\'awc_'+id+'\')">بستن</button>');
  setTimeout(function(){
    var modal=document.getElementById('mo_awc_'+id);
    if(!modal)return;
    modal.querySelectorAll('[data-wp-add-week]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var actEl=document.getElementById('wpActType');
        var act=actEl?actEl.value:'call';
        addToWeekAuto(btn.getAttribute('data-wp-add-week'), btn.getAttribute('data-wp-rtype'), btn.getAttribute('data-wp-rid'), btn.getAttribute('data-wp-name'), act);
      });
    });
    modal.querySelectorAll('[data-wp-rm-week]').forEach(function(btn){
      btn.addEventListener('click',function(){
        wpRemoveAllInWeek(btn.getAttribute('data-wp-rm-week'), btn.getAttribute('data-wp-rec'));
        closeModal('awc_'+id);
        openAssignWeekForCenter(rtype,id,name);
      });
    });
  },0);
}

function addToWeekAuto(weekId,rtype,id,name,actionType){
  var eKey=wpEntryKey(weekId,rtype,id);
  var _rk=rtype+'_'+id;
  var srcKey=typeof wpFindActiveEntryKey==='function'?wpFindActiveEntryKey(_rk,weekId):null;
  var movePromise=srcKey
    ? wpTransferWeekEntry(srcKey,weekId,{clearSchedule:true,actionType:actionType||'call'})
    : wpRemoveFromOtherWeeks(_rk,weekId).then(function(){
        var existing=DB.weekEntries[eKey];
        if(existing&&!existing.done){
          existing.actionType=actionType||existing.actionType||'call';
          return saveWeekEntryApi(eKey,existing).then(function(){
            showToast('✅ برنامه هفته به‌روز شد');
            return eKey;
          });
        }
        DB.weekEntries[eKey]={
          scheduledDate:null,done:false,doneDate:null,rtype:rtype,rid:id,recKey:_rk,
          centerName:getRecLabel(_rk),actionType:actionType||'call',addedBy:currentUser
        };
        return saveWeekEntryApi(eKey,DB.weekEntries[eKey]).then(function(){
          showToast('مرکز "'+name+'" به هفته اضافه شد ✅');
          return eKey;
        });
      });
  movePromise.then(function(finalKey){
    if(srcKey) showToast('مرکز "'+name+'" به هفته منتقل شد 🔄');
    var sel=document.getElementById('wpSel');
    if(sel){
      var parts=weekId.split('/');if(parts[0])_wpYear=parseInt(parts[0]);
      wpBuildSelect();sel.value=weekId;
    }
    closeModal('awc_'+id);
    renderWeekPlan();
    if(currentTab==='provinces'&&_currentProvId)setTimeout(renderTable,100);
  }).catch(function(e){showToast('❌ '+(e.message||'خطا در ثبت هفته'),3000);});
}
window.addToWeekAuto=addToWeekAuto;
window.openAssignWeekForCenter=openAssignWeekForCenter;
function wpOpenAssignAll(){
  var sel=document.getElementById('wpSel');
  var weekId=sel&&sel.value?sel.value:null;
  if(!weekId){showToast('ابتدا یک هفته انتخاب کنید');return;}
  var wk=wpGetWeeks().find(function(w){return w.id===weekId;});
  
  var wks=wpGetWeeks();
  var allAssigned={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(!we||we.done)return;
    var parsed=wpParseEntryKey(k);
    var wObj=wks.find(function(w){return w.id===parsed.weekId;});
    allAssigned[parsed.rtype+'_'+parsed.rid]=wObj||{id:parsed.weekId,label:parsed.weekId};
  });

  var allRecs=[];
  getAllProvinces().forEach(function(p){
    var tp=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var rk=tp+'_'+c.id;
      var assignedWk=allAssigned[rk];
      var status='no_week';
      var weekLabel='';
      var weekVal='';
      if(assignedWk){
        if(assignedWk.id===weekId){
          status='current_week';
        } else {
          status='other_week';
          weekLabel=assignedWk.label;
          weekVal=assignedWk.id;
        }
      }
      allRecs.push({rtype:tp,id:c.id,name:c.name,provName:p.name,status:status,weekLabel:weekLabel,weekId:weekVal});
    });
  });

  var currentWeekList = allRecs.filter(function(r){ return r.status === 'current_week'; });
  var otherWeekList = allRecs.filter(function(r){ return r.status === 'other_week'; });
  var noWeekList = allRecs.filter(function(r){ return r.status === 'no_week'; });

  var htmlCurrent = currentWeekList.map(function(rec){
    return '<label style="display:flex;gap:6px;padding:6px 8px;background:#dbeafe;border-radius:5px;cursor:pointer;font-size:11px;align-items:center;border:1px solid #93c5fd" data-name="'+fNorm(rec.name)+'">'
      + '<input type="checkbox" data-rtype="'+rec.rtype+'" data-rid="'+rec.id+'" checked>'
      + '<span><div style="font-weight:600">'+esc(rec.name)+'</div><div style="font-size:9px;color:var(--text-muted)">'+esc(rec.provName)+'</div></span></label>';
  }).join('');

  var htmlOther = otherWeekList.map(function(rec){
    return '<label style="display:flex;gap:6px;padding:6px 8px;background:#fef9c3;border-radius:5px;cursor:pointer;font-size:11px;align-items:center;border:1px solid #fde047" data-name="'+fNorm(rec.name)+'">'
      + '<input type="checkbox" data-rtype="'+rec.rtype+'" data-rid="'+rec.id+'">'
      + '<span><div style="font-weight:600">'+esc(rec.name)+' <span style="color:#ca8a04;font-size:9px;background:#fef08a;padding:1px 4px;border-radius:3px">📅 '+esc(rec.weekLabel)+'</span></div><div style="font-size:9px;color:var(--text-muted)">'+esc(rec.provName)+'</div></span></label>';
  }).join('');

  var htmlNo = noWeekList.map(function(rec){
    return '<label style="display:flex;gap:6px;padding:6px 8px;background:#f8fafc;border-radius:5px;cursor:pointer;font-size:11px;align-items:center;border:1px solid #e2e8f0" data-name="'+fNorm(rec.name)+'">'
      + '<input type="checkbox" data-rtype="'+rec.rtype+'" data-rid="'+rec.id+'">'
      + '<span><div style="font-weight:600">'+esc(rec.name)+'</div><div style="font-size:9px;color:var(--text-muted)">'+esc(rec.provName)+'</div></span></label>';
  }).join('');

  var body = '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;background:var(--brand-bg);padding:8px;border-radius:6px;border:1px solid #bae6fd;">'
    + '<label style="font-size:11px;font-weight:bold;color:#0369a1;">نوع برنامه (برای موارد انتخابی):</label>'
    + '<select id="wpAssignActType" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:4px;font-size:11px;flex:1;">'
    + (typeof wpActOptionsHtml==='function'?wpActOptionsHtml('call'):('<option value="call">📞 تماس تلفنی</option><option value="visit">🤝 ویزیت حضوری</option>'))
    + '</select></div>'
    + '<div style="margin-bottom:8px;display:flex;gap:6px;align-items:center"><input id="wpAQ" type="text" placeholder="جستجو..." style="flex:1" oninput="filterWpAssign()"><span style="font-size:11px;color:var(--text-muted)">'+currentWeekList.length+' مورد انتخاب شده</span></div>'
    + '<div id="wpAList" style="max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px">'
      + (currentWeekList.length > 0 ? '<div><div style="font-weight:bold;font-size:11px;color:#1e40af;margin-bottom:4px">📌 مراکز همین هفته ('+currentWeekList.length+')</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">' + htmlCurrent + '</div></div>' : '')
      + (otherWeekList.length > 0 ? '<div><div style="font-weight:bold;font-size:11px;color:#854d0e;margin-bottom:4px">🔄 مراکز برنامه‌ریزی شده در هفته‌های دیگر ('+otherWeekList.length+')</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">' + htmlOther + '</div></div>' : '')
      + (noWeekList.length > 0 ? '<div><div style="font-weight:bold;font-size:11px;color:#475569;margin-bottom:4px">⬜ سایر مراکز بدون برنامه ('+noWeekList.length+')</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">' + htmlNo + '</div></div>' : '')
    + '</div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'wpAssign\')">انصراف</button>'
    + '<button class="btn-primary" style="background:#8b5cf6;" onclick="wpOpenAssignBulkMove()">🔄 انتقال گروهی به هفته دیگر</button>'
    + '<button class="btn-primary" onclick="saveWpAssign(\' '+ weekId +' \')">💾 ذخیره در این هفته</button>';
  openModal('wpAssign','📌 تخصیص مراکز هفته — '+(wk?esc(wk.label):''),body,foot,{xl:true});
}

function filterWpAssign(){
  var q=fNorm(document.getElementById('wpAQ').value||'');
  document.querySelectorAll('#wpAList > div').forEach(function(sectionDiv){
    var visibleCount=0;
    sectionDiv.querySelectorAll('label').forEach(function(lbl){
      var name=lbl.getAttribute('data-name')||'';
      var match=name.indexOf(q)>=0;
      lbl.style.display=match?'':'none';
      if(match) visibleCount++;
    });
    sectionDiv.style.display=visibleCount>0?'':'none';
  });
}

function wpOpenAssignBulkMove() {
  var checkedCount = document.querySelectorAll('#wpAList input[type=checkbox]:checked').length;
  if(checkedCount === 0){
    showToast('ابتدا مراکزی را انتخاب کنید');
    return;
  }
  var wks = wpGetWeeks();
  var activeWeeksMap = {};
  Object.keys(DB.weekEntries || {}).forEach(function(k) {
    var we = DB.weekEntries[k];
    if (we && !we.done) {
      activeWeeksMap[k.split(':::')[0]] = true;
    }
  });
  var shown = []; var seen = {};
  var pastWks = wks.filter(function(w){return w.isPast;});
  var recentPastWks = pastWks.slice(-3);
  wks.filter(function(w){return w.isCurrent||!w.isPast;}).slice(0,8)
    .concat(pastWks.filter(function(w){return activeWeeksMap[w.id] || recentPastWks.some(function(r){return r.id===w.id;});}))
    .forEach(function(w){if(!seen[w.id]){seen[w.id]=true;shown.push(w);}});
  shown.sort(function(a,b){return a.num-b.num;});

  var body = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">انتقال گروهی ' + checkedCount + ' مرکز انتخابی به کدام هفته انجام شود؟</div>'
    + '<div style="display:flex;flex-direction:column;gap:5px;max-height:55vh;overflow-y:auto">'
    + shown.map(function(wt){
      return '<button class="btn-primary" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text-primary);cursor:pointer;font-family:inherit" onclick="bulkMoveSelectedToWeek(\'' + wt.id + '\')">'
        + '<span style="font-weight:600">' + esc(wt.label) + '</span>'
        + '<span style="font-size:11px;background:#8b5cf620;color:#8b5cf6;border:1px solid #8b5cf644;padding:2px 8px;border-radius:10px">انتقال ↪</span>'
        + '</button>';
    }).join('') + '</div>';

  openModal('wpAssignBulkMoveModal', '🔄 انتخاب هفته مقصد', body, '<button class="btn-secondary" onclick="closeModal(\'wpAssignBulkMoveModal\')">انصراف</button>');
}

function bulkMoveSelectedToWeek(targetWeekId) {
  var actType = document.getElementById('wpAssignActType').value || 'call';
  var checkedItems = [];
  document.querySelectorAll('#wpAList input[type=checkbox]').forEach(function(cb){
    if(cb.checked){
      checkedItems.push({
        rtype: cb.getAttribute('data-rtype'),
        rid: cb.getAttribute('data-rid')
      });
    }
  });
  if(checkedItems.length === 0){
    showToast('ابتدا مراکزی را انتخاب کنید');
    return;
  }
  
  Promise.all(checkedItems.map(function(item){
    var eKey=wpEntryKey(targetWeekId, item.rtype, item.rid);
    var _rk=item.rtype+'_'+item.rid;
    var srcKey=typeof wpFindActiveEntryKey==='function'?wpFindActiveEntryKey(_rk,targetWeekId):null;
    if(srcKey){
      return wpTransferWeekEntry(srcKey,targetWeekId,{clearSchedule:true,actionType:actType});
    }
    return wpRemoveFromOtherWeeks(_rk, targetWeekId).then(function(){
      if(DB.weekEntries[eKey] && DB.weekEntries[eKey].done && !DB.weekEntries[eKey].sqlId) return null;
      if(DB.weekEntries[eKey] && DB.weekEntries[eKey].done && DB.weekEntries[eKey].sqlId){
        return wpTransferWeekEntry(eKey, targetWeekId, { clearSchedule: true, actionType: actType });
      }
      DB.weekEntries[eKey]={
        scheduledDate:null,done:false,doneDate:null,rtype:item.rtype,rid:item.rid,
        recKey:_rk,centerName:getRecLabel(_rk),actionType:actType,addedBy:currentUser
      };
      return saveWeekEntryApi(eKey, DB.weekEntries[eKey]);
    });
  })).then(function(){
    _wpSaveWeek(checkedItems.map(function(item){return wpEntryKey(targetWeekId,item.rtype,item.rid);}));
    closeModal('wpAssign');
    closeModal('wpAssignBulkMoveModal');
    var selWp=document.getElementById('wpSel');
    if(selWp && targetWeekId){
      var ptsWp=targetWeekId.split('/');
      if(ptsWp[0]) _wpYear=parseInt(ptsWp[0]);
      wpBuildSelect();
      selWp.value=targetWeekId;
    }
    renderWeekPlan();
    showToast('🔄 ' + checkedItems.length + ' مرکز منتقل شدند', 3000);
  }).catch(function(e){showToast('❌ '+(e.message||'انتقال ناموفق'),3000);});
}

function saveWpAssign(weekId){
  var actType = document.getElementById('wpAssignActType').value || 'call';
  var removeKeys=Object.keys(DB.weekEntries||{}).filter(function(k){
    var we=DB.weekEntries[k];
    return k.startsWith(weekId+':::') && we && !we.done;
  });
  var checked=[];
  document.querySelectorAll('#wpAList input[type=checkbox]').forEach(function(cb){
    if(!cb.checked)return;
    checked.push({rtype:cb.getAttribute('data-rtype'),rid:cb.getAttribute('data-rid')});
  });
  var keepKeys=checked.map(function(item){return wpEntryKey(weekId,item.rtype,item.rid);});
  var deleteKeys=removeKeys.filter(function(k){return keepKeys.indexOf(k)<0;});

  (typeof wpBulkDeleteEntries==='function'?wpBulkDeleteEntries(deleteKeys):Promise.resolve())
    .then(function(){
      return Promise.all(checked.map(function(item){
        var eKey=wpEntryKey(weekId,item.rtype,item.rid);
        var _rk=item.rtype+'_'+item.rid;
        return wpRemoveFromOtherWeeks(_rk, weekId).then(function(){
          if(DB.weekEntries[eKey] && DB.weekEntries[eKey].done) return null;
          DB.weekEntries[eKey]={
            scheduledDate:null,done:false,doneDate:null,rtype:item.rtype,rid:item.rid,
            recKey:_rk,centerName:getRecLabel(_rk),actionType:actType,addedBy:currentUser
          };
          return saveWeekEntryApi(eKey, DB.weekEntries[eKey]);
        });
      }));
    }).then(function(){
      _wpSaveWeek(keepKeys);
      var selWp=document.getElementById('wpSel');
      if(selWp&&weekId){var ptsWp=weekId.split('/');if(ptsWp[0])_wpYear=parseInt(ptsWp[0]);wpBuildSelect();selWp.value=weekId;}
      closeModal('wpAssign');renderWeekPlan();showToast('ذخیره شد ✅');
    }).catch(function(){showToast('خطا در ذخیره تخصیص هفته',3000);});
}

// ════════════════════════ NOTIFICATIONS ════════════════════
// ════════════════════════ NOTIFICATIONS (API-backed) ════════════════════
var _notifCache = [];
var _notifLoaded = false;
var _pushGranted = false;

function _initNotif() {
  if (!DB.notifications) DB.notifications = [];
  if (!_notifLoaded && currentUser) _refreshNotifs();
}

function _refreshNotifs() {
  if (!currentUser) return;
  fetch('/api/notifications?to=' + encodeURIComponent(currentUser))
    .then(function(r) { return r.ok ? r.json() : _notifCache; })
    .then(function(arr) { _notifCache = arr; _notifLoaded = true;
      if (typeof window._notifVueLoad === 'function') window._notifVueLoad(); updateNotifBadge(); })
    .catch(function() {});
}

// ── Browser Push Notifications ──────────────────────────────────────────────
function _initWebPush() {
  if (!('serviceWorker' in navigator) || !window.PushManager) return;
  navigator.serviceWorker.register('/sw.js').catch(function() {});
  fetch('/api/notifications/push-vapid')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d || !d.publicKey) return;
      return navigator.serviceWorker.ready.then(function(reg) {
        return reg.pushManager.getSubscription().then(function(sub) {
          if (sub) return sub;
          var key = d.publicKey.replace(/-/g, '+').replace(/_/g, '/');
          var raw = atob(key);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr });
        }).then(function(sub) {
          if (!sub) return;
          return fetch('/api/notifications/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
        });
      });
    })
    .catch(function() {});
}

function _initBrowserNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { _pushGranted = true; if (typeof _initWebPush === 'function') _initWebPush(); return; }
  if (Notification.permission === 'denied') return;
  setTimeout(function() {
    Notification.requestPermission().then(function(p) {
      _pushGranted = (p === 'granted');
      if (_pushGranted) {
        _firePushNotif('Flow CRM', 'اعلان‌های مرورگر فعال شد ✅');
        if (typeof _initWebPush === 'function') _initWebPush();
      }
    });
  }, 3000);
}

function _firePushNotif(title, body, tag) {
  if (!_pushGranted || !('Notification' in window)) return;
  try {
    var n = new Notification(title, { body: body, tag: tag || 'flow-crm', icon: '/favicon.ico', dir: 'rtl', lang: 'fa' });
    setTimeout(function() { n.close(); }, 8000);
    return n;
  } catch(e) {}
}

function _sendOverduePushNotifs() {
  if (!_pushGranted) return;
  var items = getFollowups();
  var mine = _isExpert() ? items.filter(function(i) { return i.owner === currentUser; }) : items;
  var overdue = mine.filter(function(i) { return i.overdue; });
  if (!overdue.length) return;
  var msg = overdue.length + ' مرکز معوق پیگیری دارند';
  if (overdue.length <= 3) { msg = overdue.map(function(i) { return i.name; }).join('، ') + ' — پیگیری نشده'; }
  _firePushNotif('⚠ پیگیری‌های معوق', msg, 'overdue-reminder');
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && _pushGranted) {
    setTimeout(_sendOverduePushNotifs, 2000);
  }
});

// Polling fallback ONLY when SSE is down (avoids duplicate load on healthy streams)
setInterval(function() {
  if (!currentUser) return;
  var sseDown = (typeof _sse === 'undefined' || !_sse || _sse.readyState !== 1);
  if (sseDown) _refreshNotifs();
}, 60000);

// Server-side atomic dedup is authoritative; this is a soft UI hint only
function _hasRecentNotif(toUser, notifType) {
  var cutoff = Date.now() - 86400000;
  return (_notifCache||[]).some(function(n) {
    return n.to === toUser && !n.read && n.type === notifType
      && n.at && new Date(n.at).getTime() >= cutoff;
  });
}

function _sendPendingNotifs() {
  fetch('/api/notifications/send-pending', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d) return;
      showToast(d.sent > 0 ? ('📤 ' + d.sent + ' اعلان ارسال شد') : 'هیچ اعلان pending وجود ندارد', 3000);
      if (d.sent > 0) { _refreshNotifs(); toggleNotifPanel(); setTimeout(toggleNotifPanel, 50); }
    }).catch(function() { showToast('❌ خطا در ارسال', 2000); });
}

var _NOTIF_SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
var _ROUTINE_NOTIF_TYPES = { morning_brief: 1, followup: 1, digest: 1 };

function sendNotif(toUser, message, centerKey, centerKeys, type, meta) {
  var _np = (DB && DB.settings && DB.settings.notifPrefs) || {};
  if (_np.enabled === false) return;
  var _ntType = type || 'general';
  if (_np.types && _np.types[_ntType] === false) return;

  var id = Date.now() + '_' + Math.random().toString(36).slice(2);
  var forceBell = !_ROUTINE_NOTIF_TYPES[_ntType] || !!(meta && meta.forceBell);
  var payload = {
    id: id, to: toUser, msg: message, centerKey: centerKey || null,
    type: _ntType, meta: meta || null,
    autoSend: _np.autoSend !== false,
    forceBell: forceBell,
    severity: (meta && meta.severity) || undefined,
    bucket: (meta && meta.bucket) || undefined,
    actionUrl: (meta && meta.actionUrl) || undefined
  };
  if (centerKeys && centerKeys.length) payload.centerKeys = centerKeys;
  fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    return r.ok ? r.json() : null;
  }).then(function(notif) {
    if (!notif || notif.skipped) return;
    _notifCache.unshift({
      id: notif.id, to: notif.to, msg: notif.msg,
      centerKey: notif.centerKey || centerKey || '',
      centerKeys: centerKeys || null,
      at: notif.at || new Date().toISOString(),
      read: false, from: currentUser,
      type: notif.type || _ntType,
      severity: notif.severity || 'medium',
      meta: notif.meta || meta || null,
      actionUrl: notif.actionUrl || null
    });
    updateNotifBadge();
  }).catch(function() {
    console.warn('[sendNotif] API failed for', toUser);
  });
  if (forceBell) showToast('\U0001f4e9 اعلان برای ' + (USERS[toUser] || toUser) + ' ارسال شد', 2000);
}

function updateNotifBadge() {
  var unread = _notifCache.filter(function(n) { return n.to === currentUser && !n.read; }).length;
  var badge = document.getElementById('notifBadge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
}

var _notifPanelOpen = false;
var _notifViewAll = false;
function setNotifView(all) {
  _notifViewAll = !!all;
  var p = document.getElementById('notifPanel');
  if (p) { p.remove(); _notifPanelOpen = false; }
  toggleNotifPanel();
}

function _notifSeverityLabel(s) {
  if (s === 'critical') return 'بحرانی';
  if (s === 'high') return 'مهم';
  if (s === 'low') return 'کم';
  return 'عادی';
}

function _renderNotifPanel(arr) {
  var viewAll = _notifViewAll && _isManager();
  var myNotifs = (viewAll ? arr.slice() : arr.filter(function(n) { return n.to === currentUser; }))
    .sort(function(a, b) {
      var sa = _NOTIF_SEVERITY_RANK[a.severity] || 2;
      var sb = _NOTIF_SEVERITY_RANK[b.severity] || 2;
      if (sa !== sb) return sb - sa;
      return new Date(b.at) - new Date(a.at);
    })
    .slice(0, 100);
  var panel = document.createElement('div');
  panel.id = 'notifPanel'; panel.className = 'notif-panel';
  var unreadIds = viewAll ? [] : myNotifs.filter(function(n) { return !n.read; }).map(function(n) { return n.id; });
  var _tglBtn = '';
  if (_isManager()) {
    _tglBtn = '<span style="display:inline-flex;gap:2px;background:var(--bg-raised);border-radius:6px;padding:2px;border:1px solid var(--border)">'
      + '<button onclick="setNotifView(false)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:' + (viewAll ? 'transparent' : 'var(--brand,#6366f1)') + ';color:' + (viewAll ? 'var(--text-secondary)' : '#fff') + '">من</button>'
      + '<button onclick="setNotifView(true)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:' + (viewAll ? 'var(--brand,#6366f1)' : 'transparent') + ';color:' + (viewAll ? '#fff' : 'var(--text-secondary)') + '">همه</button>'
      + '</span>';
  }
  var head = '<div class="notif-panel-head"><span>\U0001f514 اخبار جدید</span>'
    + '<span style="display:inline-flex;gap:6px;align-items:center">'
    + _tglBtn
    + (unreadIds.length ? '<button onclick="markAllNotifsRead()" style="font-size:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">همه خوانده شد</button>' : '')
    + (_isManager() && (DB.settings&&DB.settings.notifPrefs&&DB.settings.notifPrefs.autoSend===false)
       ? '<button onclick="_sendPendingNotifs()" style="font-size:10px;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;padding:2px 8px;cursor:pointer">📤 ارسال دستی</button>'
       : '')
    + '</span>'
    + '</div>'
    + '<div class="notif-panel-hint">کارهای زمان‌بندی‌شده در «خانه / کارتابل» هستند — اینجا فقط رویدادهای جدید.</div>';
  var body = '';
  if (!myNotifs.length) {
    body = '<div class="notif-empty">خبر جدیدی نیست<br><span style="font-size:11px;color:var(--text-muted)">کارهای امروز را از تب خانه ببینید</span></div>';
  } else {
    body = myNotifs.map(function(n) {
      var timeAgo = _timeAgo(n.at);
      var nid = n.id;
      var nmsg = n.msg || n.message || '';
      var nfrom = n.from || '';
      var sev = n.severity || 'medium';
      var hasCk = n.centerKey && n.centerKey.indexOf('_') > 0;
      var hasMultiCk = n.centerKeys && n.centerKeys.length > 1;
      var cName = hasCk ? _clGetName(n.centerKey) : '';
      var isDigest = (n.type === 'digest' || n.type === 'morning_brief' || n.type === 'followup');
      return '<div class="notif-item sev-' + sev + (n.read ? '' : ' unread') + (n.ack ? ' notif-acked' : '') + '" data-nid="' + nid + '">'
        + '<div class="notif-sev-row"><span class="notif-sev-badge sev-' + sev + '">' + _notifSeverityLabel(sev) + '</span></div>'
        + '<div class="notif-item-msg">' + esc(nmsg) + '</div>'
        + ((hasCk || hasMultiCk) ? '<div class="notif-item-center">\U0001f4cd <span class="notif-center-link" onclick="goToNotifCenter(\'' + nid + '\')">' + (hasMultiCk ? (n.centerKeys.length + ' مرکز') : esc(cName)) + '</span></div>' : '')
        + '<div class="notif-item-actions">'
        + (isDigest || hasMultiCk
          ? '<button class="notif-act-btn notif-primary" onclick="goToNotifCenter(\'' + nid + '\')">📥 باز کردن کارتابل</button>'
          : (hasCk ? '<button class="notif-act-btn" onclick="goToNotifCenter(\'' + nid + '\')">\U0001f50d مشاهده مرکز</button>' : ''))
        + (viewAll
          ? (n.ack ? '<span class="notif-ack-badge">✓ تأیید شده</span>' : '')
          : (n.ack ? '<span class="notif-ack-badge">✓ تأیید شده</span>' : (function(){
              var ntype = n.type || 'general';
              if (ntype === 'followup' || ntype === 'digest' || ntype === 'morning_brief') {
                return '';
              } else if (ntype === 'manager_request') {
                return (n.centerKey && n.centerKey.indexOf('_') > 0
                  ? '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'call\')">📞 ثبت تماس</button>'
                    + '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'brief\')">📋 خلاصه</button>'
                  : '<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\'' + nid + '\')">✓ انجام دادم</button>');
              } else if (ntype === 'task') {
                return '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'task\')">📋 باز کردن تکلیف</button>';
              } else if (ntype === 'owner_change') {
                return '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'center\')">🔍 مشاهده مرکز</button>';
              } else if (ntype === 'ack') {
                return '';
              } else {
                return '<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\'' + nid + '\')">✓ انجام دادم</button>';
              }
            })()))
        + '</div>'
        + '<div class="notif-item-time">' + (viewAll ? 'به: <b>' + esc(USERS[n.to] || n.to) + '</b> · ' : '') + (nfrom ? ('از: ' + (USERS[nfrom] || nfrom) + ' · ') : '') + timeAgo + (viewAll && !n.read ? ' · <span style="color:#f59e0b">خوانده نشده</span>' : '') + '</div>'
        + '</div>';
    }).join('');
  }
  panel.innerHTML = head + '<div class="notif-body-scroll">' + body + '</div>';
  document.body.appendChild(panel);
  // Do NOT auto-mark-all-read — that caused alert blindness. User marks via actions / read-all.
  setTimeout(function() {
    document.addEventListener('click', function _nClose(ev) {
      var p = document.getElementById('notifPanel');
      var bell = document.getElementById('notifBell');
      if (p && !p.contains(ev.target) && ev.target !== bell && !(bell && bell.contains(ev.target))) { p.remove(); _notifPanelOpen = false; }
      document.removeEventListener('click', _nClose);
    });
  }, 100);
}

function toggleNotifPanel() {
  var existing = document.getElementById('notifPanel');
  if (existing) { existing.remove(); _notifPanelOpen = false; return; }
  _notifPanelOpen = true;
  var url = '/api/notifications' + (_notifViewAll && _isManager() ? '' : '?to=' + encodeURIComponent(currentUser));
  fetch(url)
    .then(function(r) { return r.ok ? r.json() : _notifCache; })
    .then(function(arr) { _notifCache = arr; updateNotifBadge(); _renderNotifPanel(arr); })
    .catch(function() { _renderNotifPanel(_notifCache); });
}

/** Open home cartable with filter, or single center modal */
function goToNotifCenter(nid) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n) return;
  markNotifRead(nid);
  var p = document.getElementById('notifPanel'); if (p) p.remove(); _notifPanelOpen = false;

  var meta = n.meta || {};
  var filter = meta.filter || '';
  if (!filter && (n.type === 'digest' || n.type === 'morning_brief' || n.type === 'followup')) {
    filter = 'overdue';
  }
  var keys = (n.centerKeys && n.centerKeys.length) ? n.centerKeys
    : (n.centerKey && n.centerKey.indexOf('_') > 0 ? [n.centerKey] : []);

  // Multi-center or digest → cartable
  if (filter || keys.length > 1 || n.type === 'digest' || n.type === 'morning_brief' || n.type === 'followup') {
    if (typeof switchTab === 'function') switchTab('home');
    setTimeout(function() {
      if (typeof window._cbSetFilter === 'function') {
        window._cbSetFilter(filter || 'overdue');
      } else if (typeof renderHomeCartable === 'function') {
        renderHomeCartable();
      }
    }, 250);
    return;
  }

  if (keys.length === 1) {
    var parts = keys[0].split('_');
    var rtype = parts[0];
    var rid = parts.slice(1).join('_');
    setTimeout(function() { openCenterModal(rtype, rid, keys[0]); }, 100);
    return;
  }

  if (n.type === 'task' && meta.taskId && typeof openTaskModal === 'function') {
    setTimeout(function() { openTaskModal(meta.taskId); }, 100);
  }
}

/** Mark related unread notifs as read when cartable work is done for a center */
function markNotifsForCenterRead(centerKey) {
  if (!centerKey || !currentUser) return;
  (_notifCache || []).forEach(function(n) {
    if (n.to !== currentUser || n.read) return;
    var hit = n.centerKey === centerKey
      || (n.centerKeys && n.centerKeys.indexOf(centerKey) >= 0);
    if (hit) markNotifRead(n.id);
  });
}
window.markNotifsForCenterRead = markNotifsForCenterRead;

function ackNotif(nid) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n || n.ack) return;
  n.read = true; n.ack = true; n.ackAt = new Date().toISOString();
  fetch('/api/notifications/' + encodeURIComponent(nid) + '/read', { method: 'PUT' }).catch(function() {});
  if (n.from && n.from !== currentUser) {
    var nmsg = n.msg || n.message || '';
    var cName = n.centerKey ? _clGetName(n.centerKey) : '';
    var replyMsg = (USERS[currentUser] || currentUser) + ' تأیید کرد: ' + (cName ? '"' + cName + '" ' : '') + 'انجام شد ✓';
    sendNotif(n.from, replyMsg, n.centerKey || '', [], 'ack', null);
  }
  updateNotifBadge();
  var p = document.getElementById('notifPanel');
  if (p) {
    var el = p.querySelector('[data-nid="' + nid + '"]');
    if (el) {
      el.classList.remove('unread'); el.classList.add('notif-acked');
      var btn = el.querySelector('.notif-ack-btn');
      if (btn) btn.outerHTML = '<span class="notif-ack-badge">✓ تأیید شده</span>';
    }
  }
  showToast('✅ تأیید ثبت و به مدیر اطلاع داده شد', 2000);
}

function markNotifRead(nid) {
  var nx = _notifCache.find(function(x) { return x.id === nid; });
  if (nx && !nx.read) {
    nx.read = true;
    updateNotifBadge();
    fetch('/api/notifications/' + encodeURIComponent(nid) + '/read', { method: 'PUT' }).catch(function() {});
  }
}

function markAllNotifsRead() {
  _notifCache.forEach(function(n) { if (n.to === currentUser) n.read = true; });
  updateNotifBadge();
  fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: currentUser })
  }).catch(function() {});
  var p = document.getElementById('notifPanel');
  if (p) {
    var btn = p.querySelector('.notif-panel-head button');
    if (btn) btn.remove();
    p.querySelectorAll('.notif-item.unread').forEach(function(el) { el.classList.remove('unread'); });
  }
}

function _timeAgo(isoStr) {
  var diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'لحظاتی پیش';
  if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  return Math.floor(diff / 86400) + ' روز پیش';
}

var _npickData = null;
function _npickSelect(i) {
  if (!_npickData || i >= _npickData.keys.length) return;
  closeModal('_npick');
  var ck = _npickData.keys[i];
  var cp = ck.split('_'); var crt = cp[0]; var crid = cp.slice(1).join('_');
  var cn = _clGetName(ck) || ck;
  var act = _npickData.action;
  setTimeout(function() {
    if (act === 'call') quickCallLog(crt, crid, cn);
    else if (act === 'brief') openPreCallBrief(crt, crid);
    else openCenterModal(crt, crid);
  }, 80);
}
function _notifAction(nid, action) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n) return;
  markNotifRead(nid);
  var p = document.getElementById('notifPanel'); if (p) { p.remove(); _notifPanelOpen = false; }
  var multiKeys = n.centerKeys && n.centerKeys.length > 1 ? n.centerKeys : null;
  if (multiKeys && (action === 'call' || action === 'brief' || action === 'center')) {
    _npickData = { keys: multiKeys, action: action };
    var _title = action === 'call' ? '\U0001f4de کدام مرکز را تماس می‌گیرید؟'
               : action === 'brief' ? '\U0001f4cb خلاصه کدام مرکز؟'
               : '\U0001f50d کدام مرکز؟';
    var _html = '<div style="display:flex;flex-direction:column;gap:5px;max-height:360px;overflow-y:auto;padding:2px 0">';
    multiKeys.forEach(function(ck, i) {
      var cn = _clGetName(ck) || ck;
      _html += '<button onclick="_npickSelect(' + i + ')" style="text-align:right;padding:8px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer">' + esc(cn) + '</button>';
    });
    _html += '</div>';
    openModal('_npick', _title, _html, '<button class="btn-secondary" onclick="closeModal(\'_npick\')">لغو</button>');
    return;
  }
  var ck = n.centerKey || '';
  var parts = ck.indexOf('_') > 0 ? ck.split('_') : [];
  var rtype = parts[0] || 'center';
  var rid = parts.slice(1).join('_');
  var centerName = ck ? (_clGetName(ck) || ck) : '';
  if (action === 'call') {
    if (rid) setTimeout(function() { quickCallLog(rtype, rid, centerName); }, 100);
    else showToast('مرکز مشخص نیست');
  } else if (action === 'brief') {
    if (rid) setTimeout(function() { openPreCallBrief(rtype, rid); }, 100);
    else showToast('مرکز مشخص نیست');
  } else if (action === 'task') {
    var tid = n.meta && n.meta.taskId;
    if (tid) setTimeout(function() { openTaskModal(tid); }, 100);
    else { switchTab('tasks'); }
  } else if (action === 'weekplan') {
    switchTab('weekplan');
  } else if (action === 'center') {
    if (rid) setTimeout(function() { openCenterModal(rtype, rid); }, 100);
  }
}

var _dmReportDate = null; // روز انتخاب‌شده در مودال گزارش (جلالی)
var _DM_DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function _dmWeekDays(anchorDate) {
  var today = todayStr();
  var base = anchorDate || today;
  var weekId = (typeof getWeekId === 'function' ? getWeekId(base) : null) || base;
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = typeof addDaysToJalali === 'function' ? addDaysToJalali(weekId, i) : weekId;
    days.push({ date: d, name: _DM_DAY_NAMES[i], isToday: d === today });
  }
  return { weekId: weekId, days: days, today: today };
}

function _dmNoteDate(n) {
  if (!n) return '';
  if (n.date && String(n.date).indexOf('/') > 0) return String(n.date);
  if (n.at) {
    if (typeof msToJ === 'function') {
      var ms = typeof n.at === 'number' ? n.at : Date.parse(n.at);
      if (!isNaN(ms)) return msToJ(ms);
    }
  }
  return '';
}

function _getNotesOnDate(rtype, rid, jDateStr) {
  var rkey = rtype + '_' + rid;
  return (DB.notes && DB.notes[rkey] || []).filter(function (n) {
    return _dmNoteDate(n) === jDateStr;
  });
}

/** کار واقعی ثبت‌شده در همان روز: changeLog + یادداشت */
function _getWorkSignalsOnDate(rtype, rid, jDateStr) {
  var acts = typeof _getActivitiesOnDate === 'function' ? _getActivitiesOnDate(rtype, rid, jDateStr) : [];
  var notes = _getNotesOnDate(rtype, rid, jDateStr);
  return { acts: acts, notes: notes, count: acts.length + notes.length };
}

/**
 * آیا این برنامه در روز reportDay «انجام‌شده» محسوب می‌شود؟
 * اولویت: doneDate همان روز → فعالیت/یادداشت همان روز → (قدیمی) done بدون doneDate فقط اگر برنامه همان روز باشد
 */
function _wpDoneOnReportDay(we, rtype, rid, reportDay) {
  if (!we) return false;
  if (we.doneDate && we.doneDate === reportDay) return true;
  var sig = _getWorkSignalsOnDate(rtype, rid, reportDay);
  if (sig.count > 0) return true;
  if (we.done && !we.doneDate && we.scheduledDate === reportDay) return true;
  return false;
}

function _dmJalaliDayBounds(jDateStr) {
  var p = String(jDateStr || '').split('/').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) {
    var n = new Date();
    return { from: new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString(), to: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).toISOString() };
  }
  var g = j2g(p[0], p[1], p[2]);
  var from = new Date(g[0], g[1] - 1, g[2], 0, 0, 0, 0);
  var to = new Date(g[0], g[1] - 1, g[2] + 1, 0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function _dmBuildWeekMap(apiRows) {
  var map = {};
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    map[k] = DB.weekEntries[k];
  });
  (apiRows || []).forEach(function (row) {
    if (!row) return;
    var rtype = row.rtype || 'center';
    var rid = row.rid != null ? String(row.rid) : '';
    var weekId = row.weekId || '';
    var key = (typeof wpEntryKey === 'function')
      ? wpEntryKey(weekId, rtype, rid)
      : (weekId + ':::' + rtype + ':::' + rid);
    map[key] = {
      rtype: rtype,
      rid: rid,
      recKey: row.recKey || (rtype + '_' + rid),
      scheduledDate: row.scheduledDate || null,
      actionType: row.actionType || 'call',
      done: !!row.done,
      doneDate: row.doneDate || null,
      addedBy: row.addedBy || '',
      centerName: row.centerName || '',
      doneResult: row.doneResult || null,
      doneNote: row.doneNote || null,
      sqlId: row.id || null
    };
  });
  return map;
}

function openDailyMonitor(dayStr) {
  if (!_isManager()) { showToast('⚠ این بخش فقط برای مدیران است'); return; }
  _buildPCCache();
  var today = todayStr();
  var reportDay = dayStr || _dmReportDate || today;
  _dmReportDate = reportDay;
  var weekMeta = _dmWeekDays(reportDay);
  var weekEnd = (weekMeta.days && weekMeta.days[6]) ? weekMeta.days[6].date : reportDay;
  if (window._dmLoadingDay === reportDay) return;
  window._dmLoadingDay = reportDay;

  var bounds = _dmJalaliDayBounds(reportDay);
  var weUrl = '/api/week-entries?week_id=' + encodeURIComponent(weekMeta.weekId)
    + '&week_end=' + encodeURIComponent(weekEnd);
  var clUrl = '/api/changelog?from=' + encodeURIComponent(bounds.from)
    + '&to=' + encodeURIComponent(bounds.to) + '&limit=2000';

  Promise.all([
    fetch(weUrl).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch(clUrl).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ]).then(function (pair) {
    window._dmLoadingDay = null;
    _dmShowReport(reportDay, pair[0] || [], pair[1] || []);
  }).catch(function () {
    window._dmLoadingDay = null;
    _dmShowReport(reportDay, [], []);
  });
}

function _dmShowReport(reportDay, apiWeekRows, dayChangeLog) {
  var today = todayStr();
  var weekMeta = _dmWeekDays(reportDay);
  var isToday = reportDay === today;
  var isPast = reportDay < today;
  var isFuture = reportDay > today;
  var weekMap = _dmBuildWeekMap(apiWeekRows);

  // changeLog همان روز را موقتاً ادغام کن (LIMIT 500 در loadDB کافی نیست)
  var _prevCL = DB.changeLog;
  if (dayChangeLog && dayChangeLog.length) {
    var seenCl = {};
    var mergedCl = [];
    dayChangeLog.concat(DB.changeLog || []).forEach(function (l) {
      if (!l) return;
      var k = (l.id != null ? l.id : '') + '|' + (l.at || '') + '|' + (l.rkey || '') + '|' + (l.field || '');
      if (seenCl[k]) return;
      seenCl[k] = true;
      mergedCl.push({
        at: l.at instanceof Date ? l.at.toISOString() : l.at,
        by: l.by,
        rkey: l.rkey,
        field: l.field,
        val: l.val,
        id: l.id
      });
    });
    DB.changeLog = mergedCl;
  }

  var dayEntries = [];
  var seen = {};

  function _pushEntry(opts) {
    var ck = opts.rtype + '_' + opts.rid;
    if (seen[ck]) return;
    seen[ck] = true;
    var sig = _getWorkSignalsOnDate(opts.rtype, opts.rid, reportDay);
    var doneOnDay = opts.doneOnDay != null ? opts.doneOnDay : (sig.count > 0 || !!opts.doneFlag);
    dayEntries.push({
      key: opts.key,
      rtype: opts.rtype,
      rid: opts.rid,
      name: opts.name,
      owner: opts.owner,
      actType: opts.actType || 'call',
      status: opts.status || 'بدون تماس',
      activities: sig.acts,
      notes: sig.notes,
      workCount: sig.count,
      done: doneOnDay,
      source: opts.source || 'scheduled',
      scheduledDate: opts.scheduledDate || null,
      doneDate: opts.doneDate || null,
      doneResult: opts.doneResult || null,
      doneNote: opts.doneNote || null
    });
  }

  // ۱) برنامه‌های زمان‌بندی‌شده برای همین روز
  Object.keys(weekMap).forEach(function (k) {
    var we = weekMap[k];
    if (!we || we.rtype === 'mtr') return;
    if (we.scheduledDate !== reportDay) return;
    var rtype = we.rtype || 'center', rid = we.rid || '';
    var e = getE(rtype, rid);
    _pushEntry({
      key: k,
      rtype: rtype,
      rid: rid,
      name: (typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||'?')),
      owner: _wpGetOwner(we),
      actType: we.actionType || 'call',
      status: e.status || 'بدون تماس',
      doneOnDay: _wpDoneOnReportDay(we, rtype, rid, reportDay),
      source: 'scheduled',
      scheduledDate: we.scheduledDate,
      doneDate: we.doneDate || null,
      doneResult: we.doneResult || null,
      doneNote: we.doneNote || null
    });
  });

  // ۲) کارهایی که در همین روز انجام شده‌اند ولی برنامهٔ روز دیگری بوده‌اند
  Object.keys(weekMap).forEach(function (k) {
    var we = weekMap[k];
    if (!we || we.rtype === 'mtr') return;
    if (we.doneDate !== reportDay) return;
    if (we.scheduledDate === reportDay) return; // already in (1)
    var rtype = we.rtype || 'center', rid = we.rid || '';
    var e = getE(rtype, rid);
    _pushEntry({
      key: k,
      rtype: rtype,
      rid: rid,
      name: (typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||'?')),
      owner: _wpGetOwner(we),
      actType: we.actionType || 'call',
      status: e.status || 'بدون تماس',
      doneOnDay: true,
      source: 'done_today',
      scheduledDate: we.scheduledDate || null,
      doneDate: we.doneDate,
      doneResult: we.doneResult || null,
      doneNote: we.doneNote || null
    });
  });

  // ۳) پیگیری‌های سررسید همین روز (بدون کارت هفته)
  if (typeof getAllProvinces === 'function' && typeof getProvCenters === 'function') {
    getAllProvinces().forEach(function (p) {
      getProvCenters(p.id).forEach(function (c) {
        var e = getE(c.rtype, c.id);
        if (!e || e.followupDate !== reportDay) return;
        var owner = e.owner || c.owner || '';
        if (!owner) return;
        var ck = c.rtype + '_' + c.id;
        if (seen[ck]) return;
        var sig = _getWorkSignalsOnDate(c.rtype, c.id, reportDay);
        _pushEntry({
          key: 'followup_' + ck,
          rtype: c.rtype,
          rid: c.id,
          name: e.nameOverride || c.name || '?',
          owner: owner,
          actType: 'followup',
          status: e.status || 'بدون تماس',
          doneOnDay: sig.count > 0 || e.status === 'قرارداد بسته شد' || e.status === 'غیرفعال',
          source: 'followup',
          scheduledDate: reportDay
        });
      });
    });
  }

  // ۴) هر مرکزی که همان روز روی آن کار ثبت شده (changeLog / یادداشت)
  //    حتی اگر برنامه هفته برای روز دیگری باشد یا کارت done از کلاینت لود نشده باشد
  (function _dmCollectActivityCenters() {
    var touched = {}; // rkey -> {rtype,rid,acts,notes,byHint}
    function _touch(rkey, rtype, rid) {
      if (!rkey || rtype === 'mtr') return null;
      if (rtype !== 'center' && rtype !== 'pc') return null;
      if (!touched[rkey]) touched[rkey] = { rtype: rtype, rid: rid, acts: [], notes: [], byHint: '' };
      return touched[rkey];
    }
    (DB.changeLog || []).forEach(function (l) {
      if (!l || !l.rkey || !l.at) return;
      var dp = String(l.at).slice(0, 10).split('-').map(Number);
      if (dp.length !== 3 || isNaN(dp[0])) return;
      var jd = g2j(dp[0], dp[1], dp[2]);
      var jdStr = jd[0] + '/' + p2(jd[1]) + '/' + p2(jd[2]);
      if (jdStr !== reportDay) return;
      var pts = String(l.rkey).split('_');
      if (pts.length < 2) return;
      var t = _touch(l.rkey, pts[0], pts.slice(1).join('_'));
      if (!t) return;
      t.acts.push(l);
      if (!t.byHint && l.by) t.byHint = l.by;
    });
    Object.keys(DB.notes || {}).forEach(function (rkey) {
      var pts = String(rkey).split('_');
      if (pts.length < 2) return;
      var rtype = pts[0], rid = pts.slice(1).join('_');
      (DB.notes[rkey] || []).forEach(function (n) {
        if (_dmNoteDate(n) !== reportDay) return;
        var t = _touch(rkey, rtype, rid);
        if (!t) return;
        t.notes.push(n);
        if (!t.byHint && (n.by || n.user)) t.byHint = n.by || n.user;
      });
    });
    // weekEntries که برای این روز کار دارند ولی scheduledDate فرق دارد / در حافظه نیستند به‌عنوان scheduled
    Object.keys(weekMap).forEach(function (k) {
      var we = weekMap[k];
      if (!we || we.rtype === 'mtr') return;
      var rtype = we.rtype || 'center', rid = we.rid || '';
      var rkey = we.recKey || (rtype + '_' + rid);
      if (seen[rkey]) return;
      if (we.doneDate === reportDay) {
        _touch(rkey, rtype, rid);
        return;
      }
      var sig = _getWorkSignalsOnDate(rtype, rid, reportDay);
      if (sig.count > 0) _touch(rkey, rtype, rid);
    });

    Object.keys(touched).forEach(function (rkey) {
      if (seen[rkey]) return;
      var t = touched[rkey];
      var e = getE(t.rtype, t.rid);
      var owner = '';
      if (typeof getCenterOwner === 'function') owner = getCenterOwner(t.rtype, t.rid) || '';
      if (!owner && e) owner = e.owner || '';
      if (!owner && t.byHint) {
        // اگر byHint نام نمایشی است، به id کاربر نگاشت کن
        var hint = String(t.byHint);
        if (typeof USERS !== 'undefined' && USERS[hint]) owner = hint;
        else if (typeof umGetActive === 'function') {
          var mem = umGetActive().find(function (m) {
            return m.id === hint || m.name === hint || (USERS[m.id] === hint);
          });
          if (mem) owner = mem.id;
          else owner = hint;
        } else owner = hint;
      }
      var name = (typeof resolveCenterDisplayName === 'function'
        ? resolveCenterDisplayName(t.rtype, t.rid)
        : null)
        || (e && e.nameOverride)
        || (typeof getRecLabel === 'function' ? getRecLabel(rkey) : '')
        || rkey;
      // اگر week entry با نام بهتر داریم
      Object.keys(weekMap).some(function (wk) {
        var we = weekMap[wk];
        if (!we) return false;
        var rk = we.recKey || (we.rtype + '_' + we.rid);
        if (rk === rkey && we.centerName) { name = we.centerName; return true; }
        return false;
      });
      _pushEntry({
        key: 'act_' + rkey,
        rtype: t.rtype,
        rid: t.rid,
        name: name,
        owner: owner || '__none__',
        actType: 'call',
        status: (e && e.status) || 'بدون تماس',
        doneOnDay: true,
        source: 'activity',
        scheduledDate: (e && e.followupDate) || null,
        doneDate: reportDay,
        doneNote: null
      });
      // سیگنال‌ها را از cache لمس‌شده روی entry بریز (تا جدول تغییرات کامل باشد)
      var en = dayEntries[dayEntries.length - 1];
      if (en && t.acts.length) en.activities = t.acts;
      if (en && t.notes.length) en.notes = t.notes;
      if (en) en.workCount = (en.activities || []).length + (en.notes || []).length;
    });
  })();

  // معوق نسبت به روز گزارش: برنامه قبل از این روز که هنوز انجام نشده
  var overdueByOwner = {};
  Object.keys(weekMap).forEach(function (k) {
    var we = weekMap[k];
    if (!we || we.done || we.rtype === 'mtr') return;
    if (!we.scheduledDate || we.scheduledDate >= reportDay) return;
    var owner = _wpGetOwner(we);
    if (!owner) return;
    var rtype = we.rtype || 'center', rid = we.rid || '';
    // اگر در روز سررسید کار ثبت شده، معوق حساب نکن
    if (_wpDoneOnReportDay(we, rtype, rid, we.scheduledDate)) return;
    if (!overdueByOwner[owner]) overdueByOwner[owner] = [];
    overdueByOwner[owner].push({
      name: (typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||'?')),
      date: we.scheduledDate
    });
  });

  var byOwner = {};
  dayEntries.forEach(function (en) {
    var o = en.owner || '__none__';
    if (!byOwner[o]) byOwner[o] = [];
    byOwner[o].push(en);
  });
  (typeof umGetActive === 'function' ? umGetActive() : []).forEach(function (m) {
    if (m.id === 'guest') return;
    if (m.role === 'مدیر' || m.role === 'سوپر ادمین') return;
    if (!byOwner[m.id]) byOwner[m.id] = [];
  });

  var scheduledOnly = dayEntries.filter(function (en) { return en.source === 'scheduled' || en.source === 'followup'; });
  var totalScheduled = scheduledOnly.length;
  var totalDone = scheduledOnly.filter(function (en) { return en.done; }).length;
  var totalNotDone = totalScheduled - totalDone;
  var workExtra = dayEntries.filter(function (en) { return en.source === 'done_today' || en.source === 'activity'; }).length;
  var pct = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

  // تب‌های روز هفته
  var tabsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding:8px;background:var(--bg-raised);border-radius:10px;border:1px solid var(--border)">'
    + weekMeta.days.map(function (d) {
      var active = d.date === reportDay;
      var bg = active ? '#4f46e5' : (d.isToday ? '#eef2ff' : '#fff');
      var fg = active ? '#fff' : (d.isToday ? '#4338ca' : '#334155');
      var border = active ? '#4338ca' : (d.isToday ? '#a5b4fc' : '#e2e8f0');
      return '<button type="button" onclick="openDailyMonitor(\'' + d.date + '\')" style="'
        + 'padding:7px 10px;border-radius:8px;border:1px solid ' + border + ';background:' + bg + ';color:' + fg + ';'
        + 'cursor:pointer;font-family:inherit;font-size:11px;font-weight:' + (active ? '700' : '600') + ';min-width:72px">'
        + '<div>' + d.name + (d.isToday ? ' · امروز' : '') + '</div>'
        + '<div style="font-size:10px;opacity:.85;margin-top:2px">' + d.date.slice(5) + '</div>'
        + '</button>';
    }).join('')
    + '</div>';

  var dayLabel = isToday ? 'امروز' : (isPast ? 'روز گذشته' : 'روز آینده');
  var body = tabsHtml
    + '<div style="background:var(--bg-raised);border-radius:10px;padding:14px;margin-bottom:16px">'
    + '<div style="font-weight:700;font-size:13px;margin-bottom:10px">📊 خلاصه ' + dayLabel + ' — ' + reportDay + '</div>'
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">' + totalScheduled + '</div><div style="font-size:11px;color:#166534">برنامه این روز</div></div>'
    + '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">' + totalDone + '</div><div style="font-size:11px;color:#166534">انجام‌شده در همین روز ✔</div></div>'
    + '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#dc2626">' + totalNotDone + '</div><div style="font-size:11px;color:#991b1b">' + (isPast ? 'انجام‌نشده در آن روز' : 'انجام‌نشده') + ' ✖</div></div>'
    + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#1d4ed8">' + pct + '%</div><div style="font-size:11px;color:#1e40af">درصد انجام</div></div>'
    + (workExtra ? '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#6d28d9">' + workExtra + '</div><div style="font-size:11px;color:#5b21b6">کار خارج از برنامهٔ روز</div></div>' : '')
    + '</div>'
    + '<div style="font-size:11px;color:#64748b;margin-bottom:8px">معیار انجام: تکمیل برنامه، تغییر فیلد، یا یادداشت پروفایل در <strong>همین روز</strong>. مراکزی که فقط امروز رویشان کار شده (حتی بدون برنامه امروز) هم در جدول می‌آیند.</div>'
    + '<div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden">'
    + '<div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:' + pct + '%;transition:width .4s"></div>'
    + '</div></div>';

  if (Object.keys(byOwner).length > 0) {
    body += '<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:16px">'
      + '<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">👥 عملکرد کارشناسان</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--bg-raised)">'
      + '<th style="padding:8px 10px;text-align:right">کارشناس</th>'
      + '<th style="padding:8px 10px;text-align:center">گزارش</th>'
      + '<th style="padding:8px 10px;text-align:center">برنامه روز</th>'
      + '<th style="padding:8px 10px;text-align:center;color:#16a34a">انجام‌شده</th>'
      + '<th style="padding:8px 10px;text-align:center;color:#dc2626">انجام‌نشده</th>'
      + '<th style="padding:8px 10px;text-align:center;color:#f59e0b">سررسید گذشته</th>'
      + '<th style="padding:8px 10px;text-align:center">اقدام</th>'
      + '</tr></thead><tbody>';

    var _dmOwnerList = Object.keys(byOwner).filter(function (ow) { return ow !== '__none__'; }).sort(function (a, b) {
      var aHas = byOwner[a].length > 0 ? 1 : 0, bHas = byOwner[b].length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return (USERS[a] || a).localeCompare(USERS[b] || b, 'fa');
    });
    if (byOwner['__none__'] && byOwner['__none__'].length > 0) _dmOwnerList.push('__none__');

    _dmOwnerList.forEach(function (ow, idx) {
      var entries = byOwner[ow];
      var sched = entries.filter(function (en) { return en.source !== 'done_today'; });
      var owName = ow === '__none__' ? 'بدون مسئول' : (USERS[ow] || ow);
      var owDone = sched.filter(function (en) { return en.done; }).length;
      var owNotDone = sched.length - owDone;
      var owOverdue = (overdueByOwner[ow] || []).length;
      var owColor = (window.umGetColor ? umGetColor(ow) : '#94a3b8');
      var bg = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)';
      var noSchedule = sched.length === 0 && !owOverdue;
      body += '<tr style="background:' + bg + ';border-bottom:1px solid #f1f5f9;' + (noSchedule ? 'opacity:.65' : '') + '">'
        + '<td style="padding:8px 10px;font-weight:600"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + owColor + '"></span>' + esc(owName) + '</span></td>'
        + '<td style="padding:8px 10px;text-align:center">'
        + '<button onclick="event.stopPropagation();openExpertReport(\'' + ow + '\')" style="font-size:10px;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-family:inherit">📊 گزارش</button>'
        + '</td>'
        + '<td style="text-align:center;padding:8px">' + (noSchedule ? '<span style="color:var(--text-muted);font-size:11px">💤 بدون برنامه</span>' : sched.length) + '</td>'
        + '<td style="text-align:center;padding:8px"><span style="background:#dcfce7;color:#166534;border-radius:10px;padding:2px 8px;font-weight:700">' + owDone + '</span></td>'
        + '<td style="text-align:center;padding:8px"><span style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:2px 8px;font-weight:700">' + owNotDone + '</span></td>'
        + '<td style="text-align:center;padding:8px"><span style="background:#fef3c7;color:#92400e;border-radius:10px;padding:2px 8px;font-weight:700">' + owOverdue + '</span></td>'
        + '<td style="text-align:center;padding:8px">'
        + (ow !== '__none__' && owNotDone > 0 && isToday
          ? '<button onclick="sendReminderToExpert(\'' + ow + '\')" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:10px;font-family:inherit">📩 یادآوری</button>'
          : '<span style="color:var(--text-muted);font-size:11px">' + (noSchedule ? '—' : (owNotDone === 0 ? '✔ کامل' : '—')) + '</span>')
        + '</td></tr>';
    });
    body += '</tbody></table></div></div>';

    // فیلتر + لیست فشرده مراکز (گروه‌بندی کارشناس)
    window._dmCache = {
      reportDay: reportDay,
      dayEntries: dayEntries,
      isToday: isToday,
      isPast: isPast
    };
    if (!window._dmUi) window._dmUi = { search: '', status: 'all', owner: '' };

    body += '<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      + '<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<span>📋 مراکز روز — نمای فشرده</span>'
      + '<span style="font-weight:500;font-size:11px;color:#64748b;margin-right:auto">خلاصه پیش‌فرض؛ جزئیات با کلیک</span>'
      + '</div>'
      + _dmFilterBarHtml()
      + '<div id="dmCentersList">' + _dmRenderCentersListHtml() + '</div>'
      + '</div>';

    // معوق‌ها (جمع‌بندی کوتاه)
    var overdueFlat = [];
    Object.keys(overdueByOwner).forEach(function (ow) {
      (overdueByOwner[ow] || []).forEach(function (x) {
        overdueFlat.push({ owner: ow, name: x.name, date: x.date });
      });
    });
    if (overdueFlat.length) {
      body += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:8px">'
        + '<div style="font-weight:700;font-size:12px;color:#92400e;margin-bottom:6px">⚠ سررسید گذشته هنوز باز (' + overdueFlat.length + ')</div>'
        + '<div style="font-size:11px;color:#78350f;line-height:1.7">'
        + overdueFlat.slice(0, 20).map(function (x) {
          return esc(x.name) + ' <span style="color:#a16207">(' + x.date + ' · ' + esc(USERS[x.owner] || x.owner) + ')</span>';
        }).join('، ')
        + (overdueFlat.length > 20 ? ' …' : '')
        + '</div></div>';
    }
  } else {
    body += '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">📋</div><div>هیچ کارشناس فعالی یافت نشد</div></div>';
  }

  var foot = '<button class="btn-secondary" onclick="closeModal(\'dmModal\')">بستن</button>'
    + (isToday ? '<button class="btn-secondary" onclick="sendReminderToAll()" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">📩 یادآوری به همه</button>' : '')
    + '<button class="btn-primary" onclick="openDailyMonitor(\'' + reportDay + '\')">🔄 بروزرسانی</button>';
  openModal('dmModal', '📊 گزارش فعالیت روزانه — ' + reportDay, body, foot, { xl: true });
  DB.changeLog = _prevCL;
}


function sendReminderToAll() {
  var today = todayStr();
  _buildPCCache();
  var experts = {};
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    var we = DB.weekEntries[k];
    if (!we || we.rtype === 'mtr') return;
    if (we.scheduledDate !== today) return;
    var rtype = we.rtype || 'center', rid = we.rid || '';
    if (_wpDoneOnReportDay(we, rtype, rid, today)) return;
    var owner = _wpGetOwner(we);
    if (!owner) return;
    if (!experts[owner]) experts[owner] = [];
    experts[owner].push((typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||'?')));
  });
  var cnt = 0;
  Object.keys(experts).forEach(function (exp) {
    var names = experts[exp];
    if (!names.length) return;
    cnt++;
    var msg = '📋 برنامه امروز: ' + names.length + ' مرکز برای بازدید دارید:\n• '
      + names.slice(0, 5).join('\n• ')
      + (names.length > 5 ? '\nو ' + (names.length - 5) + ' مورد دیگر' : '')
      + '\nوارد برنامه هفته شوید.';
    sendNotif(exp, msg, '', [], 'followup', { forceBell: true, filter: 'today', actionUrl: '/?tab=home&filter=today', bucket: 'manual_today:' + today + ':' + exp });
  });
  if (cnt > 0) showToast('🔔 یادآوری برای ' + cnt + ' کارشناس ارسال شد', 3000);
  else showToast('✅ همه کارشناسان گزارش داده‌اند');
}

function _getActivitiesOnDate(rtype, rid, jDateStr) {
  var rkey = rtype + '_' + rid;
  return (DB.changeLog || []).filter(function (l) {
    if (l.rkey !== rkey || !l.at) return false;
    var dp = l.at.slice(0, 10).split('-').map(Number);
    if (dp.length !== 3) return false;
    var jd = g2j(dp[0], dp[1], dp[2]);
    return jd[0] + '/' + p2(jd[1]) + '/' + p2(jd[2]) === jDateStr;
  });
}

function _getTodayActivities(rtype, rid, today) {
  return _getActivitiesOnDate(rtype, rid, today);
}

function _fieldLabel(field) {
  var map = {
    status: 'وضعیت', lead: 'سرنخ', potential: 'فرصت', followupDate: 'تاریخ پیگیری',
    owner: 'مسئول', tags: 'برچسب', notes: 'یادداشت', contacts: 'تماس',
    competitor: 'رقیب', address: 'آدرس', nameOverride: 'نام', type: 'نوع',
    oppValue: 'ارزش فرصت', oppGrade: 'درجه فرصت', oppProbability: 'احتمال',
    closeReason: 'دلیل بستن', customerStatus: 'وضعیت مشتری',
    week_done: 'تکمیل برنامه هفته', doneResult: 'نتیجه اقدام', doneNote: 'یادداشت انجام'
  };
  return map[field] || field;
}

function _dmIsoTime(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return p2(d.getHours()) + ':' + p2(d.getMinutes());
  } catch (e) { return ''; }
}

/** لیست تغییرات یک مرکز در یک روز — بدون تکرار فیلد (فقط آخرین مقدار) */
function _dmBuildChangeList(en, reportDay) {
  var fieldLatest = {}; // field -> item
  var fieldOrder = [];
  var acts = (en.activities || []).slice().sort(function (a, b) {
    return String(b.at || '').localeCompare(String(a.at || ''));
  });
  acts.forEach(function (l) {
    var field = l.field || 'other';
    if (fieldLatest[field]) return; // already have newer
    fieldLatest[field] = {
      kind: 'field',
      field: field,
      label: _fieldLabel(field),
      val: l.val == null || l.val === '' ? '—' : String(l.val),
      by: USERS[l.by] || l.by || '—',
      time: _dmIsoTime(l.at),
      at: l.at || ''
    };
    fieldOrder.push(field);
  });
  var items = fieldOrder.map(function (f) { return fieldLatest[f]; });

  var notes = [];
  (en.notes || []).forEach(function (n) {
    var txt = String(n.text || n.note || '').trim();
    if (!txt) return;
    notes.push({
      kind: 'note',
      label: 'یادداشت پروفایل',
      val: txt,
      by: n.by || n.user || '—',
      time: ''
    });
  });
  // یک یادداشت کافی است در خلاصه؛ بقیه در جزئیات — همه را نگه دار ولی کوتاه نمایش بده
  items = items.concat(notes);

  if (en.doneDate === reportDay) {
    var resMap = { won: 'قرارداد بسته شد', inactive: 'غیرفعال', followup: 'نیاز به پیگیری', bulk_done: 'تیک گروهی' };
    items.push({
      kind: 'done',
      label: 'تکمیل برنامه هفته',
      val: resMap[en.doneResult] || en.doneResult || 'انجام شد',
      by: '—',
      time: ''
    });
    if (en.doneNote) {
      items.push({
        kind: 'done_note',
        label: 'یادداشت انجام',
        val: String(en.doneNote),
        by: '—',
        time: ''
      });
    }
  }
  return items;
}

function _dmTruncate(text, maxLen) {
  var s = String(text || '');
  if (s.length <= maxLen) return { short: s, full: s, truncated: false };
  return { short: s.slice(0, maxLen).trim() + '…', full: s, truncated: true };
}

function _dmChangeSummaryChips(items) {
  if (!items || !items.length) {
    return '<span style="color:#94a3b8;font-size:11px">بدون تغییر</span>';
  }
  var chips = [];
  var noteCount = 0;
  items.forEach(function (it) {
    if (it.kind === 'note' || it.kind === 'done_note') { noteCount++; return; }
    if (it.kind === 'done') {
      chips.push('<span style="background:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">✓ ' + esc(it.val) + '</span>');
      return;
    }
    if (it.field === 'status' || it.label === 'وضعیت') {
      chips.push('<span style="background:#f1f5f9;color:#334155;border-radius:4px;padding:1px 6px;font-size:10px">وضعیت: ' + esc(it.val) + '</span>');
    } else if (it.field === 'followupDate' || it.label === 'تاریخ پیگیری') {
      chips.push('<span style="background:#eff6ff;color:#1d4ed8;border-radius:4px;padding:1px 6px;font-size:10px">پیگیری: ' + esc(it.val) + '</span>');
    } else if (it.field === 'owner' || it.label === 'مسئول') {
      chips.push('<span style="background:#faf5ff;color:#6b21a8;border-radius:4px;padding:1px 6px;font-size:10px">مسئول: ' + esc(USERS[it.val] || it.val) + '</span>');
    }
  });
  if (noteCount) {
    chips.push('<span style="background:#fffbeb;color:#b45309;border-radius:4px;padding:1px 6px;font-size:10px">📝 ' + noteCount + ' یادداشت</span>');
  }
  if (!chips.length) {
    chips.push('<span style="background:#f8fafc;color:#64748b;border-radius:4px;padding:1px 6px;font-size:10px">' + items.length + ' مورد</span>');
  }
  return '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">' + chips.join('') + '</div>';
}

function _dmRenderChangesCell(items, rowId) {
  if (!items || !items.length) {
    return '<span style="color:#94a3b8;font-size:11px">هیچ تغییری ثبت نشده</span>';
  }
  var detId = 'dmDet_' + rowId;
  var detailRows = items.map(function (it, i) {
    var kindBg = it.kind === 'note' || it.kind === 'done_note' ? '#fffbeb'
      : (it.kind === 'done' ? '#f0fdf4'
        : (it.label === 'تاریخ پیگیری' ? '#eff6ff' : '#f8fafc'));
    var kindFg = it.kind === 'note' || it.kind === 'done_note' ? '#b45309'
      : (it.kind === 'done' ? '#15803d'
        : (it.label === 'تاریخ پیگیری' ? '#1d4ed8' : '#334155'));
    var shown = _dmTruncate(it.val, 100);
    var valCell = '<span>' + esc(shown.short) + '</span>';
    if (shown.truncated) {
      var fid = detId + '_n' + i;
      valCell = '<span id="' + fid + '_s">' + esc(shown.short) + '</span>'
        + '<span id="' + fid + '_f" style="display:none">' + esc(shown.full) + '</span>'
        + ' <button type="button" onclick="_dmToggleNote(\'' + fid + '\',this)" style="border:none;background:none;color:#2563eb;cursor:pointer;font-size:10px;padding:0;font-family:inherit">بیشتر</button>';
    }
    return '<tr style="background:' + (i % 2 ? '#fafafa' : 'transparent') + '">'
      + '<td style="padding:3px 6px;white-space:nowrap;vertical-align:top">'
      + '<span style="display:inline-block;background:' + kindBg + ';color:' + kindFg + ';border-radius:4px;padding:1px 6px;font-weight:700;font-size:10px">'
      + esc(it.label) + '</span></td>'
      + '<td style="padding:3px 6px;vertical-align:top;word-break:break-word">' + valCell + '</td>'
      + '<td style="padding:3px 6px;white-space:nowrap;color:#64748b;vertical-align:top;font-size:10px">'
      + esc(it.by) + (it.time ? ' · ' + it.time : '') + '</td>'
      + '</tr>';
  });

  var btnLabel = '▾ جزئیات (' + items.length + ')';
  return _dmChangeSummaryChips(items)
    + ' <button type="button" data-label="' + esc(btnLabel) + '" onclick="_dmToggleDetail(\'' + detId + '\',this)" style="margin-top:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">' + btnLabel + '</button>'
    + '<div id="' + detId + '" style="display:none;margin-top:6px">'
    + '<table style="width:100%;border-collapse:collapse;font-size:11px">' + detailRows.join('') + '</table>'
    + '</div>';
}

function _dmToggleDetail(id, btn) {
  var el = document.getElementById(id);
  if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (btn) {
    var label = btn.getAttribute('data-label') || '▾ جزئیات';
    btn.textContent = open ? '▴ بستن جزئیات' : label;
  }
}

function _dmToggleNote(fid, btn) {
  var s = document.getElementById(fid + '_s');
  var f = document.getElementById(fid + '_f');
  if (!s || !f) return;
  var showFull = f.style.display === 'none';
  f.style.display = showFull ? 'inline' : 'none';
  s.style.display = showFull ? 'none' : 'inline';
  if (btn) btn.textContent = showFull ? 'کمتر' : 'بیشتر';
}

function _dmFilterBarHtml() {
  var ui = window._dmUi || { search: '', status: 'all', owner: '' };
  var owners = {};
  ((window._dmCache && window._dmCache.dayEntries) || []).forEach(function (en) {
    var o = en.owner || '__none__';
    owners[o] = true;
  });
  var ownerOpts = '<option value="">همه کارشناسان</option>'
    + Object.keys(owners).sort(function (a, b) {
      return (USERS[a] || a).localeCompare(USERS[b] || b, 'fa');
    }).map(function (o) {
      var label = o === '__none__' ? 'بدون مسئول' : (USERS[o] || o);
      return '<option value="' + esc(o) + '"' + (ui.owner === o ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  function chip(val, label) {
    var on = ui.status === val;
    return '<button type="button" onclick="_dmSetFilter(\'status\',\'' + val + '\')" style="padding:4px 10px;border-radius:999px;border:1px solid ' + (on ? '#4f46e5' : '#e2e8f0') + ';background:' + (on ? '#4f46e5' : '#fff') + ';color:' + (on ? '#fff' : '#334155') + ';cursor:pointer;font-size:11px;font-family:inherit;font-weight:' + (on ? '700' : '500') + '">' + label + '</button>';
  }
  return '<div id="dmFilterBar" style="padding:8px 12px;background:var(--bg-raised);border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    + '<input type="text" value="' + esc(ui.search || '') + '" placeholder="🔍 جستجوی مرکز…" oninput="_dmSetFilter(\'search\',this.value)" style="padding:5px 10px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:11px;min-width:160px">'
    + chip('all', 'همه')
    + chip('done', '✅ انجام‌شده')
    + chip('notdone', '✖ انجام‌نشده')
    + chip('note', '📝 دارای یادداشت')
    + '<select onchange="_dmSetFilter(\'owner\',this.value)" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:11px">' + ownerOpts + '</select>'
    + '</div>';
}

function _dmSetFilter(key, val) {
  if (!window._dmUi) window._dmUi = { search: '', status: 'all', owner: '' };
  window._dmUi[key] = val;
  if (key !== 'search') {
    var bar = document.getElementById('dmFilterBar');
    if (bar) {
      var tmp = document.createElement('div');
      tmp.innerHTML = _dmFilterBarHtml();
      bar.replaceWith(tmp.firstChild);
    }
  }
  var wrap = document.getElementById('dmCentersList');
  if (wrap) wrap.innerHTML = _dmRenderCentersListHtml();
}

function _dmFilteredEntries() {
  var cache = window._dmCache;
  if (!cache || !cache.dayEntries) return [];
  var ui = window._dmUi || { search: '', status: 'all', owner: '' };
  var q = fNorm(ui.search || '');
  return cache.dayEntries.filter(function (en) {
    if (ui.owner && (en.owner || '__none__') !== ui.owner) return false;
    if (ui.status === 'done' && !en.done) return false;
    if (ui.status === 'notdone' && en.done) return false;
    if (ui.status === 'note') {
      var ch = _dmBuildChangeList(en, cache.reportDay);
      var hasNote = ch.some(function (it) { return it.kind === 'note' || it.kind === 'done_note'; });
      if (!hasNote) return false;
    }
    if (q) {
      var ow = en.owner === '__none__' ? '' : (USERS[en.owner] || en.owner || '');
      if (fNorm(en.name || '').indexOf(q) < 0 && fNorm(ow).indexOf(q) < 0) return false;
    }
    return true;
  });
}

function _dmRenderCentersListHtml() {
  var cache = window._dmCache;
  if (!cache) return '<div style="padding:20px;color:#94a3b8;text-align:center">داده‌ای نیست</div>';
  var reportDay = cache.reportDay;
  var rows = _dmFilteredEntries().slice().sort(function (a, b) {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    var an = (USERS[a.owner] || a.owner || '');
    var bn = (USERS[b.owner] || b.owner || '');
    if (an !== bn) return an.localeCompare(bn, 'fa');
    return (a.name || '').localeCompare(b.name || '', 'fa');
  });
  if (!rows.length) {
    return '<div style="padding:28px;text-align:center;color:#94a3b8">موردی با این فیلتر نیست</div>';
  }

  var byOwner = {};
  rows.forEach(function (en) {
    var o = en.owner || '__none__';
    if (!byOwner[o]) byOwner[o] = [];
    byOwner[o].push(en);
  });
  var ownerOrder = Object.keys(byOwner).sort(function (a, b) {
    var aNot = byOwner[a].filter(function (e) { return !e.done; }).length;
    var bNot = byOwner[b].filter(function (e) { return !e.done; }).length;
    if (aNot !== bNot) return bNot - aNot;
    return (USERS[a] || a).localeCompare(USERS[b] || b, 'fa');
  });

  var html = '';
  var globalIdx = 0;
  ownerOrder.forEach(function (ow) {
    var list = byOwner[ow];
    var owName = ow === '__none__' ? 'بدون مسئول' : (USERS[ow] || ow);
    var doneN = list.filter(function (e) { return e.done; }).length;
    var pct = list.length ? Math.round(100 * doneN / list.length) : 0;
    var owColor = (window.umGetColor ? umGetColor(ow) : '#94a3b8');
    html += '<div style="border-bottom:1px solid #e2e8f0">'
      + '<div style="padding:8px 12px;background:#f8fafc;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<span style="width:10px;height:10px;border-radius:50%;background:' + owColor + ';flex-shrink:0"></span>'
      + '<span style="font-weight:700;font-size:12px">' + esc(owName) + '</span>'
      + '<span style="font-size:11px;color:#64748b">' + doneN + '/' + list.length + ' انجام‌شده</span>'
      + '<div style="flex:1;min-width:80px;max-width:140px;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:#22c55e"></div></div>'
      + '</div>';

    list.forEach(function (en) {
      globalIdx++;
      var actTypeLabel = typeof wpActLabel === 'function' ? wpActLabel(en.actType || 'call') : (en.actType === 'visit' ? '🤝 ملاقات' : '📞 تماس');
      var changes = _dmBuildChangeList(en, reportDay);
      var statusHtml = en.done
        ? '<span style="background:#dcfce7;color:#166534;border-radius:999px;padding:2px 8px;font-weight:700;font-size:10px">✅</span>'
        : '<span style="background:#fee2e2;color:#991b1b;border-radius:999px;padding:2px 8px;font-weight:700;font-size:10px">✖</span>';
      var ridSafe = String(en.rid).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var rowId = 'r' + globalIdx;
      var bg = en.done ? '#fff' : '#fffafa';
      html += '<div style="padding:8px 12px;border-top:1px solid #f1f5f9;background:' + bg + ';display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start">'
        + '<div style="color:#94a3b8;font-size:11px;padding-top:2px">' + globalIdx + '</div>'
        + '<div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">'
        + '<a href="#" onclick="closeModal(\'dmModal\');openCenterModal(\'' + en.rtype + '\',\'' + ridSafe + '\');return false;" style="color:#1d4ed8;text-decoration:none;font-weight:700;font-size:12px">' + esc(en.name) + '</a>'
        + statusHtml
        + '<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:6px">' + actTypeLabel + '</span>'
        + '<span style="font-size:10px;color:#94a3b8">' + esc(en.status || '') + '</span>'
        + '</div>'
        + '<div style="margin-top:4px">' + _dmRenderChangesCell(changes, rowId) + '</div>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  });
  return html;
}

function sendReminderToExpert(expertUser) {
  var today = todayStr();
  var noActEntries = [];
  Object.keys(DB.weekEntries || {}).forEach(function (k) {
    var we = DB.weekEntries[k];
    if (!we || we.rtype === 'mtr') return;
    if (we.scheduledDate !== today) return;
    var rtype = we.rtype || 'center', rid = we.rid || '';
    var owner = typeof getCenterOwner === 'function' ? getCenterOwner(rtype, rid) : _wpGetOwner(we);
    if (owner !== expertUser) return;
    if (_wpDoneOnReportDay(we, rtype, rid, today)) return;
    noActEntries.push((typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rtype+'_'+rid)||'?')));
  });
  if (!noActEntries.length) { showToast('✅ این کارشناس برای همه مراکز گزارش داده است'); return; }
  var msg = 'لطفاً برای مراکز زیر که امروز برنامه دارید گزارش وارد کنید: ' + noActEntries.slice(0, 5).join('، ') + (noActEntries.length > 5 ? ' و ' + (noActEntries.length - 5) + ' مرکز دیگر' : '');
  sendNotif(expertUser, msg, '', [], 'followup', { forceBell: true, filter: 'today', bucket: 'manual_expert:' + today + ':' + expertUser });
}


// ════════════════════════ CHANGE LOG PAGE ════════════════════
var _clFilters = {date:'today', owner:'', search:'', field:'', from:'', to:''};
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
    if(_clFilters.date === 'custom'){
      if(_clFilters.from && jdStr < _clFilters.from) return false;
      if(_clFilters.to && jdStr > _clFilters.to) return false;
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
    + '<select class="cl-filter" onchange="_clFilters.date=this.value;if(this.value!==\'custom\'){_clFilters.from=\'\';_clFilters.to=\'\';} renderChangelog()">'
    + '<option value="today"'+(  _clFilters.date==='today'?' selected':'')+'>امروز</option>'
    + '<option value="week"'+(_clFilters.date==='week'?' selected':'')+'>۷ روز اخیر</option>'
    + '<option value="month"'+(_clFilters.date==='month'?' selected':'')+'>این ماه</option>'
    + '<option value="all"'+(_clFilters.date==='all'?' selected':'')+'>همه</option>'
    + '<option value="custom"'+(_clFilters.date==='custom'?' selected':'')+'>بازه دلخواه</option>'
    + '</select>'
    + (_clFilters.date==='custom'?'<input type="text" class="cl-filter fd-inp" id="clFrom" value="'+esc(_clFilters.from||'')+'" placeholder="از تاریخ" readonly style="cursor:pointer;min-width:90px"><input type="text" class="cl-filter fd-inp" id="clTo" value="'+esc(_clFilters.to||'')+'" placeholder="تا تاریخ" readonly style="cursor:pointer;min-width:90px">':'')
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

  // Wire up custom date pickers
  if(_clFilters.date==='custom'){
    setTimeout(function(){
      var fi=document.getElementById('clFrom');
      var ti=document.getElementById('clTo');
      if(fi)openJDP(fi,function(v){_clFilters.from=v;fi.value=v;renderChangelog();});
      if(ti)openJDP(ti,function(v){_clFilters.to=v;ti.value=v;renderChangelog();});
    },50);
  }

  // auto-refresh every 30s
  clearTimeout(_clAutoRefreshTimer);
  if(currentTab === 'changelog'){
    _clAutoRefreshTimer = setTimeout(function(){if(currentTab==='changelog')renderChangelog();}, 30000);
  }
}

function wpOpenTodayPlanModal(dateStr) {
  var today = dateStr || todayStr();
  var todayJd = today;

  _buildPCCache();
  var todayEntries = [];

  if (typeof window._wpTodayModalOwnerF === 'undefined') {
    window._wpTodayModalOwnerF = '';
  }

  Object.keys(DB.weekEntries || {}).forEach(function(k) {
    var we = DB.weekEntries[k];
    if (we.rtype === 'mtr') return;
    if (we.scheduledDate !== today) return;

    var rtype = we.rtype || 'center', rid = we.rid || '';
    var e = getE(rtype, rid);
    var owner = _wpGetOwner(we);

    if (!_isManager() && owner && owner !== currentUser) return;

    if (_isManager() && window._wpTodayModalOwnerF && owner !== window._wpTodayModalOwnerF) return;

    var rk = we.recKey || (rtype + '_' + rid);
    var name = (typeof resolveWeekEntryDisplayName==='function'?resolveWeekEntryDisplayName(we):(we.centerName||getRecLabel(rk)||'?'));
    
    var notesList = DB.notes[rk] || [];
    var lastNote = notesList[0] ? notesList[0].text : '—';

    todayEntries.push({
      key: k,
      rtype: rtype,
      rid: rid,
      recKey: rk,
      name: name,
      owner: owner,
      ownerName: owner ? (USERS[owner] || owner) : 'بدون مسئول',
      actType: we.actionType || 'call',
      status: e.status || 'بدون تماس',
      lastNote: lastNote,
      done: we.done,
      doneResult: we.doneResult
    });
  });

  var filterHtml = '';
  if (_isManager()) {
    var activeUsers = typeof umGetActive === 'function' ? umGetActive() : [];
    var options = '<option value="">همه کارشناسان</option>' + activeUsers.filter(function(u){ return u.id !== 'guest'; }).map(function(u) {
      return '<option value="' + esc(u.id) + '"' + (window._wpTodayModalOwnerF === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
    filterHtml = '<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px; background: var(--bg-raised); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border)">'
      + '<span style="font-size: 11px; font-weight: 700; color: var(--text-secondary)">👤 کارشناس مسئول:</span>'
      + '<select onchange="window._wpTodayModalOwnerF=this.value; wpOpenTodayPlanModal(\'' + today + '\')" style="padding: 4px 8px; border: 1px solid var(--border-input); border-radius: 5px; font-size: 12px; background: var(--bg-input); color: var(--text-primary)">'
      + options
      + '</select>'
      + '</div>';
  }

  var listHtml = '';
  if (todayEntries.length === 0) {
    listHtml = '<div style="text-align:center;padding:40px;color:var(--text-muted)">برنامه‌ای برای این روز ثبت نشده است.</div>';
  } else {
    var rows = todayEntries.map(function(en) {
      var actBadge = en.actType === 'visit' 
        ? '<span style="background:#fef3c7;color:#d97706;border:1px solid #fde68a;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">🤝 ملاقات</span>'
        : '<span style="background:#e0f2fe;color:#0284c7;border:1px solid #bae6fd;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">📞 تماس</span>';
      
      var doneHtml = '';
      if (en.done) {
        var resText = en.doneResult === 'won' ? 'قرارداد بسته شد' : en.doneResult === 'inactive' ? 'غیرفعال' : 'نیاز به پیگیری';
        var resBg = en.doneResult === 'won' ? '#dcfce7' : en.doneResult === 'inactive' ? '#fee2e2' : '#f0f9ff';
        var resFg = en.doneResult === 'won' ? '#15803d' : en.doneResult === 'inactive' ? '#b91c1c' : '#0369a1';
        doneHtml = '<span style="background:' + resBg + ';color:' + resFg + ';padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600">✓ انجام شد (' + resText + ')</span>';
      } else {
        doneHtml = '<button type="button" data-ekey="'+esc(en.key)+'" onclick="closeModal(\'todayPlanModal\'); wpMarkDoneKey(this.getAttribute(\'data-ekey\'))" style="background:#22c55e;color:#fff;border:none;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:600">✓ ثبت نتیجه</button>';
      }

      var removeBtn = '<button onclick="wpRemoveTodayPlanItem(\'' + en.key + '\', \'' + today + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;font-family:inherit" title="حذف از امروز">❌ حذف</button>';

      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:10px 8px"><a href="#" onclick="closeModal(\'todayPlanModal\'); openCenterModal(\'' + en.rtype + '\',\'' + en.rid + '\'); return false;" style="color:#0ea5e9;text-decoration:none;font-weight:600">' + esc(en.name) + '</a></td>'
        + '<td style="padding:10px 8px;text-align:center">' + actBadge + '</td>'
        + '<td style="padding:10px 8px;text-align:center;font-size:11px">' + esc(en.ownerName) + '</td>'
        + '<td style="padding:10px 8px;text-align:center;font-size:11px">' + esc(en.status) + '</td>'
        + '<td style="padding:10px 8px;font-size:11px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(en.lastNote) + '">' + esc(en.lastNote) + '</td>'
        + '<td style="padding:10px 8px;text-align:center;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:8px">' + doneHtml + removeBtn + '</td>'
        + '</tr>';
    }).join('');

    listHtml = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      + '<thead><tr style="background:var(--bg-raised);border-bottom:1.5px solid var(--border)">'
      + '<th style="padding:8px;text-align:right">نام مرکز</th>'
      + '<th style="padding:8px;text-align:center">نوع اقدام</th>'
      + '<th style="padding:8px;text-align:center">مسئول</th>'
      + '<th style="padding:8px;text-align:center">وضعیت</th>'
      + '<th style="padding:8px;text-align:right">آخرین یادداشت</th>'
      + '<th style="padding:8px;text-align:center">عملیات</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  var body = '<div style="direction:rtl;text-align:right">'
    + filterHtml
    + listHtml
    + '</div>';

  var foot = '<button class="btn-secondary" onclick="closeModal(\'todayPlanModal\')">بستن</button>';
  openModal('todayPlanModal', '📅 جزئیات برنامه روز: ' + today, body, foot, { lg: true });
}

function wpRemoveTodayPlanItem(eKey, dateStr) {
  if (!confirm('آیا مطمئن هستید که این مرکز از برنامه امروز حذف شود؟')) return;
  
  if (DB.weekEntries[eKey]) {
    DB.weekEntries[eKey].scheduledDate = null;
    
    var _we = DB.weekEntries[eKey];
    if (_we.sqlId) {
      fetch('/api/week-entries/' + encodeURIComponent(_we.sqlId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: _we.done, doneDate: _we.doneDate || null, scheduledDate: null })
      }).catch(function() {});
    }
    
    _wpSaveWeek([eKey]);
    showToast('❌ از برنامه امروز حذف شد');
    wpOpenTodayPlanModal(dateStr);
    renderWeekPlan();
  }
}

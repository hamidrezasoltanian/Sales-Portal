'use strict';
// week-plan.js — Week planning module (copied from app.js)
// Functions: initWeekTags, getYearWeeks, wpCurrentWeekId, wpParseEntryKey, wpBuildSelect,
//   wpYearNav, renderWeekPlan, renderWpFullCenterList, wpPickForDay, wpFclToggle,
//   wpFclAddToWeek, wpMarkDoneKey, wpDragStart, wpDrop, wpBulkDone, wpBulkMove, etc.

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
  var body = '<div style="margin-bottom:10px">'
    +'<input id="wpPickSearch" type="text" placeholder="🔍 جستجو مرکز / استان..." '
    +'style="width:100%;padding:8px 10px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box" '
    +'oninput="renderList()">'
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
  var rid=we.rid||(we.recKey?we.recKey.split('_')[1]:'');
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
  var g=j2g(jy,jm,jd);var ts=new Date(g[0],g[1]-1,g[2],12);
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
  var rid=we.rid||(we.recKey?we.recKey.split('_')[1]:'');
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
  var _we = DB.weekEntries[eKey];
  if (_we.rtype && _we.rid) {
    setE(_we.rtype, _we.rid, 'followupDate', targetDate);
  }
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
  Object.keys(DB.weekEntries).filter(function(k){return k.startsWith(weekId+':::');}).forEach(function(k){delete DB.weekEntries[k];});
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


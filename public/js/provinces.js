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


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


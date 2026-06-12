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


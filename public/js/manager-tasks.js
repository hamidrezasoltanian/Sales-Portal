/* ═══ public/js/manager-tasks.js ═══ */
// ════════════════════════ MANAGER TASKS (SQL-backed via Tasks API) ════════════════════════
var _mgrTasksOpen = true;

function _isMgrFollowupTask(t){
  return !!(t&&(t.activity||[]).some(function(a){return a.type==='mgr_followup';}));
}

function _mgrFindTaskByCenter(recKey, includeDone){
  if(typeof _ensureTasks==='function') _ensureTasks();
  return (DB.tasks||[]).find(function(t){
    if(t.centerKey!==recKey)return false;
    if(!_isMgrFollowupTask(t))return false;
    if(!includeDone&&(t.done||t.status==='done'))return false;
    return true;
  })||null;
}

function _mgrGetTasks(includeDone){
  if(typeof _ensureTasks==='function') _ensureTasks();
  return (DB.tasks||[]).filter(function(t){
    if(!_isMgrFollowupTask(t))return false;
    if(!includeDone&&(t.done||t.status==='done'))return false;
    return true;
  });
}

function _migrateManagerTasksBlob(){
  if(!DB.managerTasks||!Object.keys(DB.managerTasks).length)return;
  if(typeof _ensureTasks==='function') _ensureTasks();
  Object.keys(DB.managerTasks).forEach(function(recKey){
    var mt=DB.managerTasks[recKey];
    if(!mt||_mgrFindTaskByCenter(recKey,true))return;
    var parts=recKey.split('_');
    var rtype=parts[0], id=parts.slice(1).join('_');
    var task={
      id:'mgr_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
      title:'پیگیری ویژه: '+(mt.name||recKey),
      owner:mt.assignedTo||'',
      dueDate:mt.assignedAt||todayStr(),
      priority:1,
      status:mt.done?'done':'todo',
      done:!!mt.done,
      doneAt:mt.doneAt||'',
      centerKey:recKey,
      note:mt.note||'',
      subtasks:[],
      activity:[
        {type:'mgr_followup',text:'ارجاع پیگیری ویژه',by:currentUser,at:new Date().toISOString()},
        {type:'created',text:'مهاجرت از managerTasks',by:'system',at:new Date().toISOString()}
      ],
      createdBy:currentUser,
      createdAt:new Date().toISOString(),
      recurring:'none'
    };
    DB.tasks.push(task);
    fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task)}).catch(function(){});
  });
  delete DB.managerTasks;
}

function mgrOpenAssign(recKey, rtype, id, name){
  if(!_isManager()){showToast('فقط مدیران می‌توانند وظیفه ارجاع دهند');return;}
  _migrateManagerTasksBlob();
  ensureKPIDB();
  var existing=_mgrFindTaskByCenter(recKey)||{};
  var members=(typeof umGetActive==='function'?umGetActive():[]).filter(function(m){return m.id!==currentUser;});
  var expertOpts=members.map(function(m){
    return '<option value="'+m.id+'"'+(existing.owner===m.id?' selected':'')+'>'+esc(m.name)+'</option>';
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
  if(typeof _ensureTasks==='function') _ensureTasks();
  var existing=_mgrFindTaskByCenter(recKey);
  var title='پیگیری ویژه: '+name;
  var payload;
  if(existing){
    var prevOwner=existing.owner||'';
    existing.owner=assignedTo;
    existing.note=note;
    existing.title=title;
    existing.priority=1;
    if(!existing.activity)existing.activity=[];
    existing.activity.push({type:'mgr_followup',text:'ارجاع مجدد به '+(USERS[assignedTo]||assignedTo),by:currentUser,at:new Date().toISOString()});
    payload=existing;
    if(assignedTo!==prevOwner&&assignedTo!==currentUser&&typeof sendNotif==='function'){
      sendNotif(assignedTo,'📌 '+title+(note?' — '+note:''),recKey,[],'task',{taskId:existing.id,taskTitle:title});
    }
    fetch('/api/tasks/'+encodeURIComponent(String(existing.id)),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      owner:existing.owner,dueDate:existing.dueDate||null,priority:existing.priority,status:existing.status||'todo',
      centerKey:recKey,note:existing.note,title:existing.title,activity:existing.activity
    })}).then(function(r){return r.ok?r.json():null;}).then(function(saved){
      if(saved){var idx=DB.tasks.findIndex(function(x){return String(x.id)===String(saved.id);});if(idx>=0)DB.tasks[idx]=saved;}
    }).catch(function(){showToast('⚠ خطا در ذخیره وظیفه',2500);});
  } else {
    var task={
      id:Date.now()+'_'+Math.random().toString(36).slice(2,6),
      title:title,owner:assignedTo,dueDate:todayStr(),priority:1,status:'todo',done:false,doneAt:'',
      centerKey:recKey,note:note,subtasks:[],
      activity:[{type:'mgr_followup',text:'ارجاع پیگیری ویژه',by:currentUser,at:new Date().toISOString()},{type:'created',text:'وظیفه ایجاد شد',by:currentUser,at:new Date().toISOString()}],
      createdBy:currentUser,createdAt:new Date().toISOString(),recurring:'none'
    };
    DB.tasks.push(task);
    if(assignedTo!==currentUser&&typeof sendNotif==='function'){
      sendNotif(assignedTo,'📌 '+title+(note?' — '+note:''),recKey,[],'task',{taskId:task.id,taskTitle:title});
    }
    fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task)})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(saved){if(saved){var idx=DB.tasks.findIndex(function(x){return String(x.id)===String(saved.id);});if(idx>=0)DB.tasks[idx]=saved;else DB.tasks.push(saved);}})
      .catch(function(){showToast('⚠ خطا در ایجاد وظیفه',2500);});
  }
  closeModal('mgrAssignModal');
  showToast('✅ وظیفه پیگیری به '+(USERS[assignedTo]||assignedTo)+' ارجاع داده شد',2500);
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderUserDashboard();
}

function mgrRemoveTask(recKey){
  var t=_mgrFindTaskByCenter(recKey,true);
  if(t){
    DB.tasks=DB.tasks.filter(function(x){return String(x.id)!==String(t.id);});
    fetch('/api/tasks/'+encodeURIComponent(String(t.id)),{method:'DELETE'}).catch(function(){});
  }
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderUserDashboard();
}

function mgrDoneTask(recKey){
  var t=_mgrFindTaskByCenter(recKey);
  if(t){
    t.done=true;t.status='done';t.doneAt=todayStr();
    if(!t.activity)t.activity=[];
    t.activity.push({type:'status',text:'انجام شد ✓',by:currentUser,at:new Date().toISOString()});
    fetch('/api/tasks/'+encodeURIComponent(String(t.id)),{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:'done',done:true,doneAt:t.doneAt,activity:t.activity})}).catch(function(){});
  }
  showToast('✅ وظیفه انجام شد');
  if(currentTab==='kpi')renderKPIPanel();
  if(currentTab==='provinces')renderDashboard();
  else renderUserDashboard();
}

function _renderManagerTasksWidget(){
  _migrateManagerTasksBlob();
  var tasks=_mgrGetTasks(true);
  var activeTasks=tasks.filter(function(t){return !t.done&&t.status!=='done';});
  var doneTasks=tasks.filter(function(t){return t.done||t.status==='done';});

  var html='<div style="background:var(--bg-card);border-radius:12px;border:1px solid #fde68a;padding:14px 16px;margin-bottom:14px">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<div>'
    +'<span style="font-size:13px;font-weight:700;color:var(--text-primary)">📌 وظایف پیگیری ویژه</span>'
    +(activeTasks.length?'<span style="background:#dc2626;color:#fff;font-size:10px;border-radius:10px;padding:1px 7px;margin-right:6px">'+activeTasks.length+'</span>':'')
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">مراکزی که برای کارشناسان جهت پیگیری ویژه ارجاع داده‌اید (در تب وظایف هم دیده می‌شوند)</div>'
    +'</div>'
    +'<button onclick="_mgrTasksOpen=!_mgrTasksOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'+(_mgrTasksOpen?'▲ جمع':'▼ باز')+'</button>'
    +'</div>';

  if(_mgrTasksOpen){
    if(!activeTasks.length&&!doneTasks.length){
      html+='<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">هیچ وظیفه‌ای ارجاع داده نشده. از دکمه 📌 روی مراکز پیشنهادی استفاده کنید.</div>';
    } else {
      var byExpert={};
      activeTasks.forEach(function(t){
        var uid=t.owner||'';
        if(!byExpert[uid])byExpert[uid]=[];
        byExpert[uid].push(t);
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
          byExpert[uid].forEach(function(t){
            var parts=(t.centerKey||'').split('_');
            var rt=parts[0]||'center', rid=parts.slice(1).join('_')||'';
            var sn=(t.title||'').replace(/^پیگیری ویژه:\s*/,'').replace(/\\/g,'\\\\').replace(/'/g,'&#39;');
            html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 7px;background:var(--bg-card);border-radius:5px;font-size:11px;border:1px solid var(--border)">'
              +'<span onclick="openCenterModal(\''+rt+'\',\''+rid+'\')" style="flex:1;cursor:pointer;font-weight:600;color:var(--text-primary)">'+esc(sn)+'</span>'
              +(t.note?'<span style="font-size:10px;color:var(--text-muted);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(t.note)+'">📝 '+esc(t.note)+'</span>':'')
              +'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+(t.dueDate||'')+'</span>'
              +'<button onclick="mgrOpenAssign(\''+t.centerKey+'\',\''+rt+'\',\''+rid+'\',\''+sn+'\')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer;font-family:inherit;flex-shrink:0">✏ ویرایش</button>'
              +'<button onclick="mgrRemoveTask(\''+t.centerKey+'\')" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer;font-family:inherit;flex-shrink:0">✕ حذف</button>'
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
        doneTasks.slice(0,5).forEach(function(t){
          html+='<div style="display:flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;font-size:10px">'
            +'<span style="text-decoration:line-through;color:var(--text-muted)">'+esc((t.title||'').replace(/^پیگیری ویژه:\s*/,''))+'</span>'
            +'<button onclick="mgrRemoveTask(\''+t.centerKey+'\')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:10px;padding:0">✕</button>'
            +'</div>';
        });
        html+='</div></div>';
      }
    }
  }
  html+='</div>';
  return html;
}

// راهنمای موقتِ قابل‌مشاهده برای مدیر: منبع هر امتیاز KPI در سرور چیست.
function kpiSourceComment(k, data){
  if(k.id==='conversion'){
    return data.conversionSource==='paid_invoices'
      ? 'فاکتور پرداخت‌شدهٔ همان ماه؛ مسئول فروش از commission_owner و در نبود آن created_by است. تغییر وضعیت مرکز به‌تنهایی شمارش نمی‌شود.'
      : 'گزارش فروش sales_log همان ماه؛ تغییر وضعیت مرکز یا پیش‌فاکتور به‌تنهایی شمارش نمی‌شود.';
  }
  if(k.id==='sales'){
    return data.conversionSource==='paid_invoices'
      ? 'مبلغ/تعداد از فاکتورهای paid همان ماه است؛ فروش ثبت‌شده در sales_log هم‌زمان جمع نمی‌شود تا دوباره‌شماری نشود.'
      : 'مبلغ/تعداد از sales_log همان ماه است؛ برای اثرگذاری باید فروش در «ثبت فعالیت» ثبت شود.';
  }
  if(k.id==='calls'){
    return 'فقط تماس‌های انجام‌شده و ثبت‌شده در همان ماه حساب می‌شوند؛ کارت برنامه یا پیگیری آینده تا انجام شدن امتیاز ندارد.';
  }
  if(k.id==='visits'){
    return 'فقط ویزیت‌های انجام‌شده و ثبت‌شده در همان ماه حساب می‌شوند؛ ملاقات برنامه‌ریزی‌شده تا انجام شدن امتیاز ندارد.';
  }
  if(k.id==='retention'){
    return 'مرکزهای دارای لید «مشتری» که در سه ماهِ منتهی به ماه انتخاب‌شده حداقل یک فاکتور صادرشده دارند ÷ همهٔ مراکز مشتریِ کارشناس. مالک فعلی مرکز مبنای انتساب است.';
  }
  if(k.id==='mission'){
    return 'فقط رکورد mission_log همین ماه با وضعیت «انجام شد» امتیاز می‌گیرد؛ متن گزارش برای امتیازدهی جزئی استفاده نمی‌شود.';
  }
  if(k.id==='cash'){
    return data.conversionSource==='paid_invoices'
      ? 'در حالت منبع «فاکتور پرداخت‌شده» نوع نقدی هنوز ثبت/محاسبه نمی‌شود و امتیاز این شاخص صفر است.'
      : 'درصد فروش‌های is_cash در sales_log همان ماه است؛ نوع نقدی را هنگام ثبت فروش دقیق انتخاب کنید.';
  }
  return 'منبع محاسبه در سرور CRM است.';
}

// گزارش قابل‌استنادِ همان ماه: برای تشخیص «بدون گزارش» در ماه‌های گذشته.
// وضعیت فعلی مراکز عمداً در این تشخیص وارد نمی‌شود؛ تاریخچهٔ آن اسنپ‌شات ندارد.
function kpiMonthReportEvidence(userId, month, data){
  var calls=(data.callBreakdown&&Number(data.callBreakdown.total))||getCallsMonth(userId,month).reduce(function(sum,l){return sum+(Number(l.count)||1);},0);
  var visits=(data.visitBreakdown&&Number(data.visitBreakdown.total))||getVisitsMonth(userId,month).total||0;
  var sales=getSalesMonth(userId,month).length;
  var conversion=(data.kpis||[]).filter(function(k){return k.id==='conversion';})[0]||{};
  var mission=(data.kpis||[]).filter(function(k){return k.id==='mission';})[0]||{};
  // فاکتور paid ممکن است خارج از sales_log باشد؛ actual نرخ تبدیل آن را پوشش می‌دهد.
  var contracts=Math.max(sales,Number(conversion.actual)||0);
  var missions=Number(mission.actual)||0;
  return {
    calls:calls, visits:visits, sales:contracts, missions:missions,
    hasData:calls>0||visits>0||contracts>0||missions>0
  };
}

// نسخهٔ بدون وابستگی به DB محلی؛ برای نمودار و مقایسهٔ تیم استفاده می‌شود.
function kpiDataHasReportEvidence(data){
  var items=(data&&data.kpis)||[];
  function actual(id){var k=items.filter(function(x){return x.id===id;})[0];return Number(k&&k.actual)||0;}
  return actual('conversion')>0 || actual('visits')>0
    || (!data.callsAutoMode && actual('calls')>0) || actual('mission')>0;
}

// بخش شفاف‌سازی ثبت‌های دستی: منبع جدیدی ایجاد نمی‌کند و همان لاگ‌های رسمی را نشان می‌دهد.
function kpiManualInputsHtml(data, evidence){
  var kpis=(data&&data.kpis)||[];
  function get(id){return kpis.filter(function(k){return k.id===id;})[0]||{};}
  var conversion=get('conversion'), cash=get('cash'), mission=get('mission');
  var salesIsManual=data.conversionSource!=='paid_invoices';
  var cards=[
    {icon:'📞',title:'تماس',value:evidence.calls+' ثبت‌شده',text:(data.callBreakdown?'ثبت دستی: '+data.callBreakdown.manualTotal+' · کارت تکمیل‌شدهٔ قدیمی: '+(data.callBreakdown.legacyCompletedTotal||0):'تعداد تماس و یادداشت را کارشناس وارد می‌کند.')},
    {icon:'🚗',title:'ویزیت',value:evidence.visits+' ثبت‌شده',text:(data.visitBreakdown?'ثبت دستی: '+data.visitBreakdown.manualTotal+' · کارت تکمیل‌شدهٔ قدیمی: '+(data.visitBreakdown.legacyCompletedTotal||0):'تعداد یا نام مرکزِ ویزیت‌شده باید ثبت شود.')},
    {icon:'✈️',title:'ماموریت',value:mission.actual?'انجام شد':'ثبت نشده',text:'وضعیت انجام و توضیح مأموریت دستی است.'}
  ];
  if(salesIsManual)cards.push({icon:'💰',title:'فروش',value:evidence.sales+' ثبت‌شده',text:'تا وقتی فاکتور paid ندارید، مبلغ/نوع فروش را دستی ثبت کنید.'});
  if(salesIsManual)cards.push({icon:'💵',title:'نوع تسویه',value:(cash.actual||0)+'٪ نقدی',text:'هنگام ثبت هر فروش، نقدی یا اعتباری را دقیق انتخاب کنید.'});
  else cards.push({icon:'💵',title:'نوع تسویه',value:'ثبت نشده در فاکتور',text:'فاکتور paid منبع فروش است، اما نوع نقدی هنوز در KPI قابل محاسبه نیست.'});
  var html='<div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:11px 13px;margin-bottom:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    +'<div style="font-size:12px;font-weight:700;color:#5b21b6">✍️ ثبت‌های دستی / تکمیلی KPI</div>'
    +'<button onclick="openKPILog(_kpiUser)" style="background:#7c3aed;color:#fff;border:none;border-radius:5px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit">ثبت / اصلاح فعالیت دستی</button>'
    +'</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:6px">';
  cards.forEach(function(c){
    html+='<div style="background:rgba(255,255,255,.7);border:1px solid #ede9fe;border-radius:7px;padding:7px 8px">'
      +'<div style="font-size:11px;font-weight:700;color:#4c1d95">'+c.icon+' '+c.title+' <span style="font-weight:400;color:#6b7280">— '+c.value+'</span></div>'
      +'<div style="font-size:10px;line-height:1.55;color:#6b7280;margin-top:3px">'+c.text+'</div></div>';
  });
  html+='</div><div style="font-size:10px;color:#6b7280;margin-top:8px">اهداف عددی و وزن شاخص‌ها نیز دستی تعیین می‌شوند؛ محاسبهٔ نهایی فقط با داده‌های ثبت‌شده انجام می‌شود.</div></div>';
  return html;
}

var _kpiTraceOpen = false;
// ردیابی فقط‌خواندنی: همان ردیف‌هایی که محاسبهٔ سمت سرور از آن‌ها استفاده کرده است.
function kpiTraceHtml(trace){
  if(!trace)return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:14px;font-size:12px;color:var(--text-muted)">⏳ در حال دریافت ردیابی منابع KPI…</div>';
  function list(title, icon, rows, render){
    rows=rows||[];
    var out='<div style="min-width:220px;flex:1;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:8px 9px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:6px">'+icon+' '+title+' <span style="font-weight:400;color:var(--text-muted)">('+rows.length+' ردیف)</span></div>';
    if(!rows.length)return out+'<div style="font-size:10px;color:var(--text-muted)">رکورد مؤثری در این ماه نیست.</div></div>';
    rows.slice(0,8).forEach(function(r){out+='<div style="font-size:10px;line-height:1.55;border-top:1px solid var(--border);padding:4px 0;color:var(--text-secondary)">'+render(r)+'</div>';});
    if(rows.length>8)out+='<div style="font-size:10px;color:var(--text-muted);padding-top:4px">… و '+(rows.length-8)+' ردیف دیگر</div>';
    return out+'</div>';
  }
  function activity(r){
    var center=r.center_name||'';
    var note=r.note||'';
    return '<b>'+esc(r.date||'')+'</b> — '+esc(String(r.count||1))+' مورد'
      +(center?' · '+esc(center):'')+(note?'<br><span style="color:var(--text-muted)">'+esc(note)+'</span>':'');
  }
  function legacy(r){return '<b>'+esc(r.done_date||r.scheduled_date||r.week_id||'')+'</b> — '+esc(r.center_name||r.rec_key||'کارت قدیمی')+' <span style="color:var(--text-muted)">(تکمیل‌شده، بدون تعامل متصل)</span>';}
  function sale(r){return '<b>'+esc(r.jalali_date||'')+'</b> — '+esc(r.invoice_no||r.center_name||'فروش ثبت‌شده')+' · '+Number(r.total||0).toLocaleString('fa-IR')+' ریال';}
  var allLegacy=(trace.legacyCalls||[]).concat(trace.legacyVisits||[]);
  var source=trace.salesSource==='paid_invoices'?'فاکتورهای پرداخت‌شده':'گزارش فروش ثبت‌شده';
  var ret=trace.retention||{};
  var mission=trace.mission;
  var html='<div style="background:var(--bg-card);border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px">'
    +'<div><span style="font-size:13px;font-weight:700;color:var(--text-primary)">🔎 ردیابی منابع محاسبهٔ KPI</span>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">فقط رکوردهای مؤثر در '+esc(trace.month||'')+'؛ کارت‌های برنامه‌ریزی‌شده و انجام‌نشده اینجا نیستند.</div>'
    +(trace.finalized?'<div style="font-size:10px;color:#92400e;margin-top:3px">🔒 این ماه نهایی شده است؛ امتیاز رسمی از اسنپ‌شات ماهانه است و این فهرست، ردیف‌های خام قابل‌ردیابی را نشان می‌دهد.</div>':'')+'</div>'
    +'<button onclick="_kpiTraceOpen=!_kpiTraceOpen;renderKPIPanel()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted)">'+(_kpiTraceOpen?'▲ جمع':'▼ باز')+'</button></div>';
  if(_kpiTraceOpen){
    html+='<div style="display:flex;gap:7px;flex-wrap:wrap">'
      +list('تماس‌های محاسبه‌شده','📞',trace.calls,activity)
      +list('ویزیت‌های محاسبه‌شده','🚗',trace.visits,activity)
      +list('فروش — '+source,'💰',trace.sales,sale)
      +list('کارت‌های تاریخیِ سازگار','🗂️',allLegacy,legacy)
      +'</div>';
    html+='<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--text-secondary)">'
      +'<span>🤝 حفظ مشتری: '+Number(ret.retained||0)+' مرکز خریدکرده از '+Number(ret.total||0)+' مرکز مشتری در سه ماه اخیر</span>'
      +'<span>✈️ مأموریت: '+(mission?(mission.done?'انجام شده':'ثبت شده ولی انجام نشده'):'رکوردی ندارد')+(mission&&mission.note?' — '+esc(mission.note):'')+'</span>'
      +'</div>';
  }
  return html+'</div>';
}

function renderKPIPanel(){
  ensureKPIDB();
  if(!_kpiUser||!USERS[_kpiUser])_kpiUser=USERS[currentUser]?currentUser:Object.keys(USERS)[0];
  if(!_kpiMonth)_kpiMonth=currentJMonth();
  var el=document.getElementById('kpiPanel');
  if(el)el.innerHTML='<div style="padding:24px;text-align:center;color:#64748b;font-size:13px">⏳ در حال محاسبه KPI از سرور…</div>';
  var _renderBody=function(data){

  // KPI فروش برای کارشناس فروش و سوپروایزر فعال قابل مشاهده است.
  // نقش‌های غیرعملیاتی (انبار، مهمان و …) عمداً در فهرست نیستند.
  var _kpiEligibleRoles=['کارشناس فروش','سوپروایزر'];
  var _salesMembers=(_DEFAULT_MEMBERS||[]).filter(function(m){
    return _kpiEligibleRoles.indexOf(m.role)!==-1&&m.active!==false;
  });
  if(!_salesMembers.length)_salesMembers=Object.keys(USERS).map(function(u){return{id:u,name:USERS[u]};});
  if(!_kpiUser||!_salesMembers.find(function(m){return m.id===_kpiUser;}))_kpiUser=(_salesMembers[0]||{}).id||_kpiUser;
  var userOpts=_salesMembers.map(function(m){
    var _uc=window.umGetColor?umGetColor(m.id):'#0ea5e9';
    return'<option value="'+m.id+'"'+(_kpiUser===m.id?' selected':'')+' data-color="'+_uc+'">'+esc(m.name||m.id)+'</option>';
  }).join('');
  var monthOpts=prevJMonths(12).map(function(m){
    return'<option value="'+m+'"'+(_kpiMonth===m?' selected':'')+'>'+jMonthLabel(m)+'</option>';
  }).join('');

  var reportEvidence;
  try { reportEvidence=kpiMonthReportEvidence(_kpiUser,_kpiMonth,data); }
  catch(_e) { reportEvidence={calls:0,visits:0,sales:0,missions:0,hasData:true}; }
  var isPastKpiMonth=_kpiMonth<currentJMonth();
  var noReportMonth=isPastKpiMonth&&!data._finalized&&!reportEvidence.hasData;
  // ماه بدون گزارش را فقط در لایهٔ نمایش صفر می‌کنیم؛ هیچ اسنپ‌شات یا لاگ تغییر نمی‌کند.
  if(noReportMonth){
    data=Object.assign({},data,{
      overall:0,
      kpis:(data.kpis||[]).map(function(k){
        return Object.assign({},k,{actual:0,score:0,tip:'دادهٔ قابل‌استناد برای این ماه ثبت نشده'});
      })
    });
  }
  var ov=data.overall;
  var oc=ov>=80?'#22c55e':ov>=50?'#f59e0b':'#ef4444';
  var og=ov>=90?'A':ov>=80?'B+':ov>=70?'B':ov>=60?'C':ov>=50?'D':'F';

  var html='';
  if(noReportMonth){
    html+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#713f12">'
      +'<b>ℹ️ دادهٔ قابل‌استناد ثبت نشده:</b> برای این کارشناس در ماه انتخاب‌شده تماس، ویزیت، فروش/فاکتور صادرشده یا مأموریت ثبت نشده است؛ KPI نمایشی صفر است و وضعیت فعلی مراکز در آن دخالت داده نشده.</div>';
  }

  // ── خلاصهٔ خام گزارش‌های همان ماه (برای کنترل عادلانهٔ منبع امتیاز)
  if(isPastKpiMonth){
    html+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:#1e3a8a">'
      +'<b>🔎 گزارش‌های قابل‌استناد همین ماه:</b> '+reportEvidence.calls+' تماس، '+reportEvidence.visits+' ویزیت، '+reportEvidence.sales+' فروش/فاکتور، '+reportEvidence.missions+' مأموریت. '
      +'<span style="color:#475569">این اعداد از لاگ ماه انتخاب‌شده‌اند؛ نه از وضعیت امروزِ مراکز.</span></div>';
  }

  // ── ثبت‌های دستی لازم (در همهٔ ماه‌ها، با مقدار فعلی همان ماه)
  html+=kpiManualInputsHtml(data,reportEvidence);

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

  // ── هفته‌به‌هفته + هشدار ۰ فعالیت
  (function(){
    var now=new Date();
    var todayJ=todayStr();
    var thisWeekStart=toJalali(new Date(now.getTime()-6*24*60*60*1000));
    var lastWeekStart=toJalali(new Date(now.getTime()-13*24*60*60*1000));
    var lastWeekEnd=toJalali(new Date(now.getTime()-7*24*60*60*1000));
    // لاگ API با userId/date/count می‌آید؛ دادهٔ قدیمی ممکن است by/at داشته باشد.
    // جمع count (نه تعداد ردیف) با منطق واقعی KPI هم‌راستا است.
    function activityCountInRange(log,user,s,e){
      return (log||[]).reduce(function(total,l){
        var by=l.userId||l.by||l.user||'';
        var jd=String(l.date||'').replace(/-/g,'/');
        if(!jd&&l.at)jd=toJalali(new Date(l.at)).replace(/-/g,'/');
        return (!user||by===user)&&jd>=s&&jd<=e ? total+(Number(l.count)||1) : total;
      },0);
    }
    var thisW={calls:activityCountInRange(DB.callLog,_kpiUser,thisWeekStart,todayJ),visits:activityCountInRange(DB.visitLog,_kpiUser,thisWeekStart,todayJ)};
    var lastW={calls:activityCountInRange(DB.callLog,_kpiUser,lastWeekStart,lastWeekEnd),visits:activityCountInRange(DB.visitLog,_kpiUser,lastWeekStart,lastWeekEnd)};
    var totalThis=thisW.calls+thisW.visits;
    var totalLast=lastW.calls+lastW.visits;
    var diff=totalThis-totalLast;
    var arrow=diff>0?'↑':'↓';var arrowClr=diff>0?'#16a34a':'#dc2626';
    if(diff===0)arrow='→';if(diff===0)arrowClr='#6366f1';
    html+='<div style="display:flex;gap:12px;align-items:center;background:var(--bg-raised);border-radius:10px;padding:10px 16px;margin-bottom:14px;flex-wrap:wrap">'
      +'<span style="font-size:12px;font-weight:700;color:var(--text-secondary)">📊 هفته‌به‌هفته</span>'
      +'<span style="font-size:12px">📞 '+thisW.calls+(lastW.calls?' <span style="color:'+arrowClr+';font-weight:700">'+arrow+(Math.abs(thisW.calls-lastW.calls)||'')+'</span>':'')+' تماس</span>'
      +'<span style="font-size:12px">🚗 '+thisW.visits+(lastW.visits?' <span style="color:'+arrowClr+';font-weight:700">'+arrow+(Math.abs(thisW.visits-lastW.visits)||'')+'</span>':'')+' بازدید</span>'
      +'<span style="font-size:11px;color:var(--text-muted)">هفته گذشته: '+totalLast+' فعالیت</span>'
      +'</div>';
    // ─ هشدار ۰ فعالیت
    if(totalThis===0&&_isManager()){
      var zeroExperts=Object.keys(USERS).filter(function(u){
        return activityCountInRange((DB.callLog||[]).concat(DB.visitLog||[]),u,thisWeekStart,todayJ)===0;
      });
      if(zeroExperts.length){
        html+='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#991b1b">'
          +'⚠️ <b>'+zeroExperts.length+' کارشناس</b> این هفته هیچ فعالیتی ثبت نکرده‌اند: '
          +zeroExperts.map(function(u){return USERS[u]||u;}).join('، ')
          +'</div>';
      }
    }
  })();

  // ── پیش‌فاکتور MoM / YoY (مدیر)
  if (_isManager()) {
    html += '<div id="kpiPfTrend" style="margin-bottom:14px"></div>';
  }

  // ── header
  html+='<div class="kpi-header-row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">'    +'<h2 style="margin:0;font-size:18px;color:var(--text-primary)">📊 عملکرد KPI</h2>'    +'<select onchange="_kpiUserChange(this.value)" style="padding:5px 10px;border:1px solid var(--border-input);border-radius:5px;background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:12px">'+userOpts+'</select>'    +'<select onchange="_kpiMonth=this.value;renderKPIPanel()" style="padding:5px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+monthOpts+'</select>'    +'<div style="margin-right:auto;display:flex;gap:8px">'    +'<button style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600" onclick="openKPITargets(_kpiUser,_kpiMonth)">💰 ثبت تارگت ماهانه فروش</button>'    +(_isManager()?'<button style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600;margin-right:6px" onclick="openProvTargetsModal()">🗺 اهداف استانی</button>':'')    +'<button class="btn-primary" onclick="openKPILog(_kpiUser)" style="font-size:11px;padding:5px 12px">📝 ثبت فعالیت</button>'    +'<button style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;font-size:11px;padding:5px 12px;cursor:pointer;font-weight:600" onclick="exportKPIReport()">📥 دانلود گزارش</button>'    +'</div></div>';

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

  // ── قیف فروش در KPI
  (function(){
    var FSTAGES=['لید','سرنخ','فرصت','مشتری'];
    var FCOLORS={'لید':'#f59e0b','سرنخ':'#0ea5e9','فرصت':'#8b5cf6','مشتری':'#22c55e'};
    var fCnts={};FSTAGES.forEach(function(s){fCnts[s]=0;});
    _buildPCCache();
    getAllProvinces().forEach(function(p){
      var rt=getProvType(p.id);
      getProvCenters(p.id).forEach(function(c){
        var e=getE(rt,c.id);
        if((e.owner||c.owner||'')!==_kpiUser)return;
        var lead=e.lead||c.lead||'سرنخ';
        if(fCnts[lead]!==undefined)fCnts[lead]++;
      });
    });
    var fTotal=Object.values(fCnts).reduce(function(a,b){return a+b;},0)||1;
    html+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">';
    // Funnel
    html+='<div style="flex:1;min-width:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 14px">';
    html+='<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:7px">📊 قیف فروش</div>';
    html+='<div style="display:flex;gap:2px;align-items:stretch">';
    FSTAGES.forEach(function(s,idx){
      var cnt=fCnts[s]||0;var pct=Math.round(cnt/fTotal*100);var clr=FCOLORS[s];
      html+='<div style="flex:1;text-align:center;padding:6px 3px;border:1px solid '+clr+'33;border-radius:5px;background:'+clr+'0d">';
      html+='<div style="font-size:16px;font-weight:700;color:'+clr+'">'+cnt+'</div>';
      html+='<div style="font-size:10px;font-weight:600;color:'+clr+'">'+esc(s)+'</div>';
      html+='<div style="font-size:10px;color:var(--text-muted)">'+pct+'٪</div>';
      html+='</div>';
      if(idx<FSTAGES.length-1)html+='<div style="display:flex;align-items:center;color:var(--text-muted);font-size:13px;padding:0 1px">›</div>';
    });
    html+='</div></div>';
    // Lead timing
    html+=renderLeadTimingHtml(_kpiUser);
    html+='</div>';
  })();

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
      +'<div style="font-size:9px;line-height:1.55;color:#475569;background:rgba(255,255,255,.58);border-radius:5px;padding:5px 6px;margin-top:7px">🔎 <b>منبع موقت:</b> '+esc(kpiSourceComment(k,data))+'</div>'
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
        try {
          var d = calcKPIs(_kpiUser, m);
          var hasData=!(m<currentJMonth()&&!kpiDataHasReportEvidence(d));
          return {month: m, score: hasData?Math.round(d.overall||0):null, hasData:hasData};
        } catch(e) { return {month: m, score: null, hasData:false}; }
      });
      var maxScore = Math.max.apply(null, trendData.filter(function(t){return t.hasData;}).map(function(t){return t.score;})) || 1;
      html += '<div class="kpi-trend-bars">';
      trendData.forEach(function(t) {
        var barH=t.hasData?Math.max(Math.round((t.score / 100) * 100), 3):3;
        var bc=!t.hasData?'#cbd5e1':t.score >= 80 ? '#22c55e' : t.score >= 50 ? '#f59e0b' : '#ef4444';
        var parts = t.month.split('/');
        var mLabel = jMonthLabel(t.month).split(' ')[0];
        html += '<div class="kpi-trend-col">'
          + '<div class="kpi-trend-score">' + (t.hasData?t.score:'—') + '</div>'
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
          // در ماه گذشته، افراد بدون گزارش قابل‌استناد رتبه و عدد نمی‌گیرند.
          if(_kpiMonth<currentJMonth()&&!kpiDataHasReportEvidence(d))return;
          var ov2 = Math.round(d.overall||0);
          var gr = ov2>=90?'A':ov2>=80?'B+':ov2>=70?'B':ov2>=60?'C':ov2>=50?'D':'F';
          var bestKPI = d.kpis[0], worstKPI = d.kpis[0];
          d.kpis.forEach(function(k){ if(k.score>bestKPI.score)bestKPI=k; if(k.score<worstKPI.score)worstKPI=k; });
          teamData.push({uid:u, name:USERS[u], score:ov2, grade:gr, best:bestKPI, worst:worstKPI});
        } catch(e) {}
      });
      teamData.sort(function(a,b){return b.score-a.score;});
      if(!teamData.length)html+='<div style="font-size:12px;color:var(--text-muted);padding:8px">برای این ماه، گزارش قابل‌استناد تیمی ثبت نشده است.</div>';
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

  // ── auditable KPI trace (replaces center recommendations)
  html += kpiTraceHtml(window._kpiTraceData);

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
  if(_isManager()) html+=_renderManagerTasksWidget();
  html+=_renderKPIHistory(_kpiUser,_kpiMonth);

  var el=document.getElementById('kpiPanel');
  if(el)el.innerHTML=html;

  if (_isManager()) {
    var month = _kpiMonth || (typeof currentJMonth === 'function' ? currentJMonth() : '');
    fetch('/api/proforma/stats?month=' + encodeURIComponent(month)).then(function(r) { return r.json(); }).then(function(st) {
      var box = document.getElementById('kpiPfTrend');
      if (!box || !st.ok) return;
      var mom = st.mom, yoy = st.yoy;
      var cards = '';
      if (mom) {
        var mp = mom.pct != null ? (mom.pct >= 0 ? '+' : '') + mom.pct + '٪' : '—';
        var mc = mom.pct != null && mom.pct >= 0 ? '#15803d' : '#dc2626';
        cards += '<div style="flex:1;min-width:140px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center">'
          + '<div style="font-size:11px;color:#64748b;margin-bottom:4px">📄 پیش‌فاکتور — MoM</div>'
          + '<div style="font-size:18px;font-weight:800;color:#1e293b">' + (mom.approvedValue || 0).toLocaleString('fa-IR') + ' <span style="font-size:11px">﷼</span></div>'
          + '<div style="font-size:12px;color:' + mc + ';font-weight:700;margin-top:4px">' + mp + ' نسبت به ماه قبل</div></div>';
      }
      if (yoy) {
        var yp = yoy.pct != null ? (yoy.pct >= 0 ? '+' : '') + yoy.pct + '٪' : '—';
        var yc = yoy.pct != null && yoy.pct >= 0 ? '#15803d' : '#dc2626';
        cards += '<div style="flex:1;min-width:140px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center">'
          + '<div style="font-size:11px;color:#64748b;margin-bottom:4px">📄 پیش‌فاکتور — YoY</div>'
          + '<div style="font-size:18px;font-weight:800;color:#1e293b">' + (mom ? (mom.approvedValue || 0).toLocaleString('fa-IR') : '—') + '</div>'
          + '<div style="font-size:12px;color:' + yc + ';font-weight:700;margin-top:4px">' + yp + ' نسبت به سال قبل</div></div>';
      }
      if (cards) {
        box.innerHTML = '<div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:10px">📈 روند پیش‌فاکتور (ارزش تأیید‌شده) — ' + (typeof jMonthLabel === 'function' ? jMonthLabel(month) : month) + '</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div></div>';
      }
    }).catch(function() {});
  }
  };
  // Preload server KPIs and their read-only source trace, then render.
  window._kpiTraceData=null;
  var tracePromise=fetch('/api/kpi-data/trace?user='+encodeURIComponent(_kpiUser)+'&month='+encodeURIComponent(_kpiMonth))
    .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
  var preload = [fetchKPIs(_kpiUser, _kpiMonth)];
  prevJMonths(6).forEach(function (m) {
    preload.push(fetchKPIs(_kpiUser, m).catch(function () { return null; }));
  });
  if (_isManager()) {
    Object.keys(USERS).forEach(function (u) {
      if (u === 'guest') return;
      preload.push(fetchKPIs(u, _kpiMonth).catch(function () { return null; }));
    });
  }
  function _afterLoad() {
    var data;
    try {
      data = calcKPIs(_kpiUser, _kpiMonth);
    } catch (err) {
      var el2 = document.getElementById('kpiPanel');
      if (el2) el2.innerHTML = '<div style="color:#dc2626;padding:20px;background:#fef2f2;border-radius:8px;margin:20px;font-size:12px"><strong>خطا در محاسبه KPI:</strong><br>' + esc(err.message) + '</div>';
      console.error('KPI error:', err);
      return;
    }
    _renderBody(data);
  }
  var start = typeof loadKpiActualsFromApi === 'function'
    ? loadKpiActualsFromApi(_kpiUser, _kpiMonth)
    : Promise.resolve();
  start
    .then(function () { return Promise.all([Promise.all(preload), tracePromise]); })
    .then(function(pair) { window._kpiTraceData=pair[1]; _afterLoad(); })
    .catch(function (err) {
      var el3 = document.getElementById('kpiPanel');
      if (el3) el3.innerHTML = '<div style="color:#dc2626;padding:20px">خطا: ' + esc((err && err.message) || err) + '</div>';
    });
}

function _renderKPIHistory(userId,month){
  ensureKPIDB();
  var b=jMonthBounds(month);
  var entries=[];

  getCallsMonth(userId,month).forEach(function(l){
    entries.push({ts:dateStrToTs(l.date),date:l.date,icon:'📞',
      text:'تماس: '+l.count+' تماس'+(l.note?' — '+esc(l.note):''),
      del:{type:'call',id:l.id}});
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
      del:{type:'visit',id:l.id}});
  });
  getSalesMonth(userId,month).forEach(function(l){
    entries.push({ts:dateStrToTs(l.date),date:l.date,icon:l.isCash?'💵':'💳',
      text:'فروش: '+(l.centerName?esc(l.centerName):'')+(l.amount?' — '+Number(l.amount).toLocaleString('fa-IR')+' ریال':'')+(l.isCash?' (نقدی)':' (اعتباری)'),
      del:{type:'sales',id:l.id}});
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
    var delBtn=e.del?'<button onclick="_kpiDeleteActivity(\''+e.del.type+'\','+Number(e.del.id)+')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:11px;padding:2px 6px;margin-right:auto">✕</button>':'';
    html+='<div style="display:flex;gap:8px;align-items:center;font-size:11px;background:var(--bg-card);border-radius:6px;padding:6px 10px;border:1px solid #f1f5f9">'
      +'<span style="font-size:14px">'+e.icon+'</span>'
      +'<span style="color:var(--text-muted);min-width:58px;font-size:10px">'+e.date+'</span>'
      +'<span style="color:var(--text-primary);flex:1">'+e.text+'</span>'
      +delBtn+'</div>';
  });
  html+='</div></div>';
  return html;
}

// حذف فقط بعد از تأیید سرور؛ شناسهٔ صریح جلوی حذفِ ردیف اشتباه پس از مرتب‌سازی را می‌گیرد.
function _kpiDeleteActivity(type,id){
  var userId=_kpiUser,month=_kpiMonth;
  deleteActivityLog(type,id).then(function(ok){
    if(!ok){showToast('❌ حذف در سرور انجام نشد',3000);return;}
    ensureKPIDB();
    var list=type==='call'?DB.callLog:type==='visit'?DB.visitLog:DB.salesLog;
    if(list)list.splice(0,list.length,...list.filter(function(x){return Number(x.id)!==Number(id);}));
    if(typeof invalidateKpiCache==='function')invalidateKpiCache(userId,month);
    showToast('✅ ثبت حذف شد');renderKPIPanel();
  }).catch(function(){showToast('❌ حذف در سرور انجام نشد',3000);});
}

// ── Modal ثبت فعالیت ──────────────────────────────────────────────
function openKPILog(userId){
  userId=userId||_kpiUser||currentUser;
  var selectedMonth=_kpiMonth||currentJMonth();
  var today=todayStr();
  if(today.slice(0,7)!==selectedMonth) today=selectedMonth+'/01';
  var ms=getMissionMonth(userId,selectedMonth);
  var mStatus=ms?(ms.done?'done':'planned'):'';
  var salesKpiSource='';
  try { salesKpiSource=(calcKPIs(userId,selectedMonth)||{}).conversionSource||''; } catch(_e) {}

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
    +(salesKpiSource==='paid_invoices'?'<div style="font-size:10px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:5px 7px;margin-bottom:7px">این فروش ذخیره می‌شود؛ اما KPI فروش این ماه از فاکتورهای پرداخت‌شده محاسبه می‌شود و فروش دستی به آن اضافه نمی‌گردد.</div>':'')
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

function _kpiNewLogId(){
  // More collision-resistant than Date.now() while remaining inside JS safe integer range.
  return Date.now()*1000+Math.floor(Math.random()*1000);
}
function _kpiRefreshAfterPersist(userId, month){
  if(typeof invalidateKpiCache==='function')invalidateKpiCache(userId,month);
  if(typeof loadKpiActualsFromApi==='function'){
    loadKpiActualsFromApi(userId,month).then(function(){
      if(_kpiUser===userId&&_kpiMonth===month)renderKPIPanel();
    });
  } else if(_kpiUser===userId&&_kpiMonth===month)renderKPIPanel();
}
function _kpiPersistActivity(type, entry, userId, successText){
  var month=(entry.date||'').slice(0,7);
  return postActivityLog(type,entry).then(function(result){
    // Update only after the database accepted the record; no optimistic ghost rows.
    var saved=(result&&result.entry)||entry;
    ensureKPIDB();
    var list=type==='call'?DB.callLog:type==='visit'?DB.visitLog:DB.salesLog;
    list.push(saved);
    showToast(successText);closeModal('kpiLogModal');
    _kpiRefreshAfterPersist(userId,month);
    return saved;
  }).catch(function(err){
    showToast('❌ ذخیره نشد: '+((err&&err.error)||(err&&err.message)||'خطای سرور'),3500);
    return null;
  });
}
function _saveCallLog(userId){
  var date=(((document.getElementById('lc_date')||{}).value)||'').trim();
  var count=parseInt(((document.getElementById('lc_count')||{}).value)||'',10);
  var note=(((document.getElementById('lc_note')||{}).value)||'').trim();
  if(!date||!Number.isInteger(count)||count<1){showToast('تاریخ و تعداد تماس معتبر را وارد کنید');return;}
  _kpiPersistActivity('call',{id:_kpiNewLogId(),date:date,userId:userId,count:count,note:note},userId,'✅ '+count+' تماس ذخیره شد');
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
  var centerRow=document.getElementById('lv_center_row');
  var isCenterMode=centerRow&&centerRow.style.display!=='none';
  var entry;
  if(isCenterMode){
    var date=(((document.getElementById('lv_date2')||document.getElementById('lv_date'))||{}).value||'').trim();
    var center=(((document.getElementById('lv_center')||{}).value)||'').trim();
    var note=(((document.getElementById('lv_note2')||document.getElementById('lv_note'))||{}).value||'').trim();
    if(!date){showToast('تاریخ را وارد کنید');return;}
    if(!center){showToast('نام مرکز را وارد کنید یا حالت «تعداد کل» را انتخاب کنید');return;}
    entry={id:_kpiNewLogId(),date:date,userId:userId,centerName:center,note:note,count:1};
  } else {
    var date=(((document.getElementById('lv_date')||{}).value)||'').trim();
    var countVal=parseInt(((document.getElementById('lv_count')||{}).value)||'',10);
    var note=(((document.getElementById('lv_note')||{}).value)||'').trim();
    if(!date||!Number.isInteger(countVal)||countVal<1){showToast('تاریخ و تعداد ویزیت معتبر را وارد کنید');return;}
    entry={id:_kpiNewLogId(),date:date,userId:userId,centerName:'',note:note,count:countVal};
  }
  _kpiPersistActivity('visit',entry,userId,'✅ ویزیت ذخیره شد');
}
function _saveSaleLog(userId){
  var date=(((document.getElementById('ls_date')||{}).value)||'').trim();
  var center=(((document.getElementById('ls_center')||{}).value)||'').trim();
  var amount=parseFloat(((document.getElementById('ls_amount')||{}).value)||'');
  var isCash=((document.getElementById('ls_cash')||{}).value)==='1';
  if(!date||!Number.isFinite(amount)||amount<0){showToast('تاریخ و مبلغ معتبر را وارد کنید');return;}
  _kpiPersistActivity('sales',{id:_kpiNewLogId(),date:date,userId:userId,centerName:center,amount:amount,isCash:isCash},userId,'✅ فروش ذخیره شد — '+(isCash?'نقدی':'اعتباری'));
}
function _saveMissionLog(userId,done){
  var month=(((document.getElementById('lm_month')||{}).value)||'').trim();
  var note=(((document.getElementById('lm_note')||{}).value)||'').trim();
  if(!month){showToast('ماه مأموریت را انتخاب کنید');return;}
  var entry={id:_kpiNewLogId(),userId:userId,month:month,done:done,note:note};
  postMissionLog(entry).then(function(result){
    ensureKPIDB();
    DB.missionLog=DB.missionLog.filter(function(l){return !(l.userId===userId&&l.month===month);});
    DB.missionLog.push((result&&result.entry)||entry);
    if(typeof invalidateKpiCache==='function')invalidateKpiCache(userId,month);
    showToast(done?'✅ مأموریت انجام‌شده ذخیره شد':'⏳ مأموریت برنامه‌ریزی ذخیره شد');closeModal('kpiLogModal');
    if(_kpiUser===userId&&_kpiMonth===month)renderKPIPanel();
  }).catch(function(err){showToast('❌ ذخیره مأموریت انجام نشد: '+((err&&err.error)||(err&&err.message)||'خطای سرور'),3500);});
}
function _delMissionLog(userId){
  var month=(((document.getElementById('lm_month')||{}).value)||'').trim();
  if(!month)return;
  deleteMissionLog(userId,month).then(function(){
    ensureKPIDB();DB.missionLog=DB.missionLog.filter(function(l){return !(l.userId===userId&&l.month===month);});
    if(typeof invalidateKpiCache==='function')invalidateKpiCache(userId,month);
    showToast('✅ مأموریت حذف شد');closeModal('kpiLogModal');if(_kpiUser===userId&&_kpiMonth===month)renderKPIPanel();
  }).catch(function(err){showToast('❌ حذف مأموریت انجام نشد: '+((err&&err.error)||(err&&err.message)||'خطای سرور'),3500);});
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

// init bootstrap lives in manager.js (always loaded)

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
      if(data.db){ Object.assign(DB,data.db); if(typeof saveDBFull==='function')saveDBFull(); }
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
  var patchEdits={};
  Object.keys(idb.edits||{}).forEach(function(k){
    if(!DB.edits[k])DB.edits[k]={};
    Object.assign(DB.edits[k],idb.edits[k]);
    patchEdits[k]=DB.edits[k];
  });
  if(Object.keys(patchEdits).length&&typeof savePatchDB==='function')savePatchDB({edits:patchEdits});
  ['call','visit','sales'].forEach(function(t){
    var logKey=t==='call'?'callLog':t==='visit'?'visitLog':'salesLog';
    var apiType=t;
    if(!DB[logKey])DB[logKey]=[];
    (idb[logKey]||[]).forEach(function(x){
      if(!x||!x.id||DB[logKey].some(function(y){return y.id===x.id;}))return;
      DB[logKey].push(x);
      if(typeof postActivityLog==='function')postActivityLog(apiType,x).catch(function(){});
    });
  });
  if(idb.missionLog&&idb.missionLog.length&&typeof postMissionLog==='function'){
    idb.missionLog.forEach(function(x){
      if(x&&x.userId&&x.month)postMissionLog(x).catch(function(){});
    });
  }
  Object.keys(idb.weekEntries||{}).forEach(function(k){
    var we=idb.weekEntries[k];
    if(!we) return;
    if(!DB.weekEntries)DB.weekEntries={};
    if(!DB.weekEntries[k])DB.weekEntries[k]=we;
    if(typeof saveWeekEntryApi==='function')saveWeekEntryApi(k,we).catch(function(){});
  });
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
  if(typeof openDataHub==='function'){ openDataHub(); return; }
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

// Keyboard shortcut — delegated to data-hub.js if loaded
document.addEventListener('keydown',function(e){
  if(!e||typeof e.key!=='string')return;
  var tgt=e.target;
  var inInput=tgt&&typeof tgt.matches==='function'&&tgt.matches('input,textarea');
  if((e.ctrlKey||e.metaKey)&&e.key==='b'&&!inInput){
    if(typeof openDataHub==='function'){ e.preventDefault(); openDataHub(); return; }
    e.preventDefault(); if(typeof openUnifiedBackup==='function')openUnifiedBackup();
  }
});
// ══ END UNIFIED BACKUP ══════════════════════════════════════



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


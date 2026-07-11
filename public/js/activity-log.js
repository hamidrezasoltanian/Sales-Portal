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
      var actLbl=(typeof wpActLabel==='function'?wpActLabel(actType):(actType==='visit'?'🚗 ویزیت انجام شد':'📞 تماس انجام شد'));
      entries.push({ts:ts,name:name,desc:actLbl+' ✓'+(we.doneResult?' — '+we.doneResult:''),icon:'✅',user:we.doneUser||''});
    });
    // ۴. تماس‌های روزانه (callLog)
    (DB.callLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'📞 '+l.count+' تماس'+(l.note?' — '+l.note:''),icon:'📞',user:l.userId||'',_logId:l.id,_logType:'call'});
    });
    // ۵. ویزیت‌های دستی (visitLog)
    (DB.visitLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'🚗 '+(l.count>1?l.count+' بازدید':'بازدید')+(l.note?' — '+l.note:''),icon:'🚗',user:l.userId||'',_logId:l.id,_logType:'visit'});
    });
    // ۶. SQL activity-log (refresh at most once per minute)
    if(!window._actSqlLoading&&(!window._actSqlFetchedAt||Date.now()-window._actSqlFetchedAt>60000)){
      window._actSqlLoading=true;
      fetch('/api/activity-log?limit=200',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(data){
        window._actSqlFetchedAt=Date.now();
        if(data&&data.entries)window._actSqlCache=data.entries;
        if(typeof renderActivity==='function'&&currentTab==='activity')renderActivity();
      }).catch(function(){}).then(function(){window._actSqlLoading=false;});
    }
    (window._actSqlCache||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      var icon=l._type==='visit'?'🚗':(l._type==='sales'?'💰':'📞');
      var desc=l._type==='sales'
        ?('💰 فروش '+(l.amount||0).toLocaleString('fa-IR')+(l.centerName?' — '+l.centerName:''))
        :(icon+' '+(l.count||1)+' '+(l._type==='visit'?'بازدید':'تماس')+(l.note?' — '+l.note:''));
      entries.push({ts:ts,name:l.centerName||'',desc:desc,icon:icon,user:l.userId||'',_sql:true,_logId:l.id,_logType:l._type});
    });
  }catch(err){
    el.innerHTML='<div style="padding:20px;color:#dc2626">⚠ خطا در نمایش فعالیت‌ها: '+esc(err.message)+'</div>';
    return;
  }
  var seenLogs={};
  entries=entries.filter(function(ev){
    if(ev._logId==null||!ev._logType)return true;
    var key=ev._logType+':'+ev._logId;
    if(seenLogs[key])return false;
    seenLogs[key]=true;return true;
  });
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

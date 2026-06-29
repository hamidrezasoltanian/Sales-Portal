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
      var owner=_getOwnerForRecKey(rk)||we.addedBy||'';
      if(!owner||!expData[owner])return;
      expData[owner].wpPlanned++;
      if(we.done)expData[owner].wpDone++;
    });
  }

  // overdue + auto-contract conversions in single pass
  _getEditsKeys().forEach(function(k){
    var e=DB.edits[k];var ow=e.owner||'';var st=e.status||'';
    if(ow&&expData[ow]){
      if(st!=='قرارداد بسته شد'&&st!=='غیرفعال'){
        var fd=e.followupDate||'';if(fd&&fd<today)expData[ow].overdue++;
      }
      if(st==='قرارداد بسته شد'){
        var ts=e._statusChangedTs||0;if(ts&&ts>=mb.startTs&&ts<=mb.endTs)expData[ow].contracts++;
      }
    }
  });
  // contracts this month from salesLog
  (DB.salesLog||[]).forEach(function(l){
    if(!l.date||!l.userId||!expData[l.userId])return;
    if(l.date.slice(0,7)===month)expData[l.userId].contracts++;
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
  var totalActive=0;
  EXPERTS.forEach(function(uid){
    ownerStats[uid]={uid:uid,name:USERS[uid],contracts:0,meetings:0,overdue:0,total:0,overdueItems:[]};
  });
  var atRisk=[];
  var _cutoffTs=Date.now()-21*24*3600*1000;
  var _cutoffStr=msToJ(_cutoffTs);
  var validK=_getAllValidRecKeys?_getAllValidRecKeys():new Set();

  _getEditsKeys().forEach(function(k){
    var e=DB.edits[k];var st=e.status||'بدون تماس';
    if(st!=='غیرفعال')totalActive++;
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
    // atRisk in same pass
    if(validK.size&&!validK.has(k))return;
    if(st!=='قرارداد بسته شد'&&st!=='غیرفعال'){
      var pot=parseInt(e.potential||1);if(pot<=2){
        var fd2=e.followupDate||'';
        if(!fd2||fd2<_cutoffStr){
          var pts=k.split('_');var tp=pts[0];var id=pts.slice(1).join('_');
          atRisk.push({recKey:k,rtype:tp,id:id,name:getRecLabel(k),pot:pot,fd:fd2,owner:ow||''});
        }
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
  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0)+(DB.extra||[]).length;
  var _pipelineActive=0;
  STATUS_LIST.forEach(function(st){if(st!=='بدون تماس'&&st!=='غیرفعال'&&st!=='قرارداد بسته شد')_pipelineActive+=statusCounts[st]||0;});
  var _convBase=contracted+_pipelineActive;var _convRate=_convBase>0?Math.round(contracted/_convBase*100):0;

  // مراکز در خطر: computed in first pass above
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
  var R1='<div class="dash-kpi-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">';
  R1+=_dashKpiCard(totalCenters,'کل مراکز','🏥','#0ea5e9','در '+getAllProvinces().length+' استان');
  R1+=_dashKpiCard(totalActive,'مراکز فعال','📞','#f59e0b','از کل مراکز');
  R1+=_dashKpiCard(overdueTotal,'پیگیری معوق','🔴','#ef4444',EXPERTS.filter(function(u){return ownerStats[u].overdue>0;}).length+' کارشناس');
  R1+=_dashKpiCard(contracted,'قرارداد بسته','✅','#22c55e',_convRate+'٪ نرخ تبدیل');
  R1+='</div>';

  // ── ردیف ۲: معوقات per expert + مراکز در خطر ──
  var R2='<div class="dash-kpi-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';

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
  var R3='<div class="dash-kpi-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

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
      var owner=_getOwnerForRecKey(rk)||we.addedBy||'';
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
  html+='<div class="dash-kpi-row" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
  html+=_dashKpiCard(callsWeek,'تماس این هفته','📞','#0ea5e9','هدف: '+callTarget,callPct);
  html+=_dashKpiCard(visitsWeek,'ویزیت این هفته','🚗','#8b5cf6','هدف: '+visitTarget,visitPct);
  html+=_dashKpiCard(contractsMonth,'قرارداد این ماه','✅','#22c55e','هدف: '+contractTarget,contractPct);
  html+='</div>';

  // برنامه امروز + pipeline
  html+='<div class="dash-kpi-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

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
    +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🎯 نوع فعالیت</label>'
    +'<select id="qcl_type" style="width:100%;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px">'
    +'<option value="call">📞 تماس</option>'
    +'<option value="visit">🤝 ملاقات</option>'
    +'<option value="price_send">📄 ارسال قیمت</option>'
    +'<option value="sample_send">🧪 ارسال نمونه</option>'
    +'<option value="committee">🏛 پیگیری کمیته</option>'
    +'<option value="meeting">👥 جلسه</option>'
    +'<option value="followup">🔄 پیگیری</option>'
    +'</select></div>'
    +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📊 نتیجه</label>'
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
  var actType=((document.getElementById('qcl_type')||{}).value||'call');
  if(!result&&!note){showToast('نتیجه یا یادداشت را وارد کنید');return;}
  var actLabel=(ACTION_TYPE_LABELS&&ACTION_TYPE_LABELS[actType])||'📞 تماس';
  var txt=(result?'['+actLabel+'] نتیجه: '+result+(note?'\n'+note:''):'['+actLabel+'] '+note);
  if(txt){
    if(!DB.notes)DB.notes={};
    if(!DB.notes[rtype+'_'+rid])DB.notes[rtype+'_'+rid]=[];
    DB.notes[rtype+'_'+rid].unshift({text:txt,by:currentUser,at:new Date().toISOString(),tags:[]});
  }
  if(fd)setE(rtype,rid,'followupDate',fd);
  saveDB();closeModal(modalId);showToast('✓ تماس ثبت شد');
  if(typeof renderExpertDashboard==='function')renderExpertDashboard();
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
    _collectCenters(_PC_CACHE[pv]||[],'pc');
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
        var _fdp=item.fd.split('/').map(Number);var diff=Math.round((Date.now()-jMs(_fdp[0],_fdp[1],_fdp[2]))/86400000);
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
          var daysOver=fd&&fd<today?(function(){var _p=fd.split('/').map(Number);return Math.floor((Date.now()-jMs(_p[0],_p[1],_p[2]))/86400000);}()):0;
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


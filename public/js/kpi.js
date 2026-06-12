// ═══════════════════════════ KPI MODULE ════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ── تاریخچه ماهانه KPI ───────────────────────────────────────
function saveKPISnapshot(userId, month){
  ensureKPIDB();
  if(!DB.kpiHistory)DB.kpiHistory=[];
  month=month||currentJMonth();
  var data=calcKPIs(userId,month);
  var snap={userId:userId,month:month,overall:data.overall,savedAt:new Date().toISOString(),
    scores:{}};
  data.kpis.forEach(function(k){snap.scores[k.id]=Math.round(k.score);});
  // remove old entry for same user+month and replace
  DB.kpiHistory=DB.kpiHistory.filter(function(s){return !(s.userId===userId&&s.month===month);});
  DB.kpiHistory.push(snap);
  // keep max 24 months × N users
  DB.kpiHistory=DB.kpiHistory.slice(-100);
  saveDB();
  return snap;
}
function getKPIHistory(userId,nMonths){
  var months=prevJMonths(nMonths||6);
  return months.map(function(m){
    var snap=(DB.kpiHistory||[]).find(function(s){return s.userId===userId&&s.month===m;});
    return{month:m,label:jMonthLabel(m),overall:snap?snap.overall:null,scores:snap?snap.scores:{}};
  }).reverse();
}
function renderKPIHistoryChart(userId){
  var hist=getKPIHistory(userId,6);
  var maxScore=100;
  var bars=hist.map(function(h){
    var hasData=h.overall!==null;
    var val=hasData?h.overall:0;
    var col=val>=80?'#22c55e':val>=50?'#f59e0b':'#ef4444';
    var heightPct=Math.max(hasData?(val/maxScore*100):0,3);
    return'<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;min-width:0">'
      +'<div style="font-size:11px;font-weight:700;color:'+(hasData?col:'var(--text-muted)')+';">'+(hasData?val+'':'—')+'</div>'
      +'<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
        +'<div style="width:100%;border-radius:5px 5px 0 0;transition:height .4s;background:'+(hasData?col:'var(--border)')+';height:'+heightPct+'%;min-height:4px;position:relative;cursor:'+(hasData?'pointer':'default')+'" '
        +(hasData?'onclick="saveKPISnapshot(\''+userId+'\',\''+h.month+'\')" title="ذخیره مجدد '+h.label+'"':'')+'></div>'
      +'</div>'
      +'<div style="font-size:10px;color:var(--text-muted);text-align:center;white-space:nowrap;overflow:hidden;max-width:100%">'+h.label+'</div>'
    +'</div>';
  }).join('');
  return'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary)">📈 روند ۶ ماهه</div>'
    +'<button onclick="saveKPISnapshot(\''+userId+'\',\''+currentJMonth()+'\');renderKPIPanel()" style="font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">📸 ثبت ماه جاری</button>'
    +'</div>'
    +'<div style="height:100px;display:flex;gap:6px;align-items:flex-end">'+bars+'</div>'
    +(hist.some(function(h){return h.overall!==null;})?''
      :'<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0">برای ذخیره ماه جاری روی «📸 ثبت ماه جاری» کلیک کنید</div>')
  +'</div>';
}


function ensureKPIDB(){
  if(!DB.kpiTargets)DB.kpiTargets={};
  if(!DB.callLog)DB.callLog=[];
  if(!DB.visitLog)DB.visitLog=[];
  if(!DB.salesLog)DB.salesLog=[];
  if(!DB.missionLog)DB.missionLog=[];
  if(!DB.managerTasks)DB.managerTasks={};
}

// ── تاریخ شمسی ──────────────────────────────────────────────────
function currentJMonth(){var t=todayJ();return t[0]+'/'+p2(t[1]);}
function jMonthBounds(key){
  var pts=key.split('/');var jy=parseInt(pts[0]);var jm=parseInt(pts[1]);
  var lastDay=jm<=6?31:jm<=11?30:29;
  var g1=j2g(jy,jm,1);var g2=j2g(jy,jm,lastDay);
  return{
    startTs:new Date(g1[0],g1[1]-1,g1[2],0,0,0).getTime(),
    endTs:new Date(g2[0],g2[1]-1,g2[2],23,59,59).getTime()
  };
}
function jMonthLabel(key){
  var pts=key.split('/');
  return J_MONTHS[parseInt(pts[1])-1]+' '+pts[0];
}
function prevJMonths(n){
  var t=todayJ();var jy=t[0];var jm=t[1];
  var res=[];
  for(var i=0;i<n;i++){
    res.push(jy+'/'+p2(jm));
    jm--;if(jm<1){jm=12;jy--;}
  }
  return res;
}
function workingDaysInJMonth(key){
  var m=parseInt(key.split('/')[1]);
  return m<=6?26:m<=11?25:24;
}
function dateStrToTs(d){ // "1404/01/15" → timestamp
  var pts=d.split('/');return jMs(parseInt(pts[0]),parseInt(pts[1]),parseInt(pts[2]));
}
function currentWeekBounds(){
  var d=new Date();
  var dow=(d.getDay()+1)%7; // 0=sat(شنبه)..6=fri(جمعه)
  var sat=new Date(d);sat.setDate(d.getDate()-dow);sat.setHours(0,0,0,0);
  var fri=new Date(sat);fri.setDate(sat.getDate()+6);fri.setHours(23,59,59,999);
  return{startTs:sat.getTime(),endTs:fri.getTime()};
}

// ── اهداف ────────────────────────────────────────────────────────
function getKPITarget(userId,month){
  ensureKPIDB();
  var k=userId+':'+month;
  return Object.assign({callsPerDay:10,visitsPerWeek:5,salesCount:5,salesAmount:0,cashPct:50},DB.kpiTargets[k]||{});
}
function saveKPITarget(userId,month,targets){
  ensureKPIDB();
  DB.kpiTargets[userId+':'+month]=targets;saveDB();
}

// ── داده‌های ماه ──────────────────────────────────────────────────
function getCallsMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  return DB.callLog.filter(function(l){var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;});
}

function getSalesMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  return DB.salesLog.filter(function(l){var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;});
}
function getMissionMonth(userId,month){
  ensureKPIDB();
  return DB.missionLog.find(function(l){return l.userId===userId&&l.month===month;});
}
function getAutoConversions(userId,month){
  var b=jMonthBounds(month);var n=0;
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    if(e.status!=='قرارداد بسته شد')return;
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    var ts=e._statusChangedTs||e._lastActivity||e._ts||0;
    if(ts>=b.startTs&&ts<=b.endTs)n++;
  });
  return n;
}
function getRetentionData(userId){
  var total=0,cust=0;
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    if(!e.status||e.status==='غیرفعال')return;
    total++;if(e.lead==='مشتری')cust++;
  });
  return{cust:cust,total:total,pct:total>0?Math.round(cust/total*100):0};
}
function _getOwnerForRecKey(recKey){
  if(!recKey)return'';
  var e=DB.edits[recKey]||{};
  if(e.owner)return e.owner;
  var pts=recKey.split('_');var rtype=pts[0];var rid=pts.slice(1).join('_');
  if(rtype==='center'){
    var c=CENTERS.find(function(x){return x.id===rid;});
    if(c&&c.owner)return c.owner;
  } else if(rtype==='pc'){
    _buildPCCache();
    var provId=rid.split('||')[0];
    var arr=_PC_CACHE[provId]||[];
    var c2=arr.find(function(x){return x.id===rid;});
    if(c2&&c2.owner)return c2.owner;
  }
  var ex=(DB.extra||[]).find(function(x){return x.id===rid;});
  if(ex&&ex.owner)return ex.owner;
  return '';
}
function getVisitsMonth(userId,month){
  ensureKPIDB();var b=jMonthBounds(month);
  var autoV=Object.values(DB.weekEntries||{}).filter(function(we){
    if(we.actionType!=='visit'||!we.done||!we.doneDate)return false;
    var ts=dateStrToTs(we.doneDate);if(ts<b.startTs||ts>b.endTs)return false;
    return _getOwnerForRecKey(we.recKey||'')=== userId;
  });
  var manV=(DB.visitLog||[]).filter(function(l){
    var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=b.startTs&&ts<=b.endTs;
  });
  var manTotal=manV.reduce(function(s,l){return s+(l.count||1);},0);
  return{auto:autoV,manual:manV,total:autoV.length+manTotal,manTotal:manTotal};
}
function getWeekVisits(userId){
  ensureKPIDB();var wb=currentWeekBounds();
  var autoV=Object.values(DB.weekEntries||{}).filter(function(we){
    if(we.actionType!=='visit'||!we.done||!we.doneDate)return false;
    var ts=dateStrToTs(we.doneDate);if(ts<wb.startTs||ts>wb.endTs)return false;
    return _getOwnerForRecKey(we.recKey||'')=== userId;
  }).length;
  var manV=(DB.visitLog||[]).filter(function(l){
    var ts=dateStrToTs(l.date);return l.userId===userId&&ts>=wb.startTs&&ts<=wb.endTs;
  }).length;
  return autoV+manV;
}

// ── محاسبه KPI ───────────────────────────────────────────────────
function calcKPIs(userId,month){
  ensureKPIDB();
  var b=jMonthBounds(month);
  // read weights from DB or use defaults
  var _defW={conversion:20,retention:20,visits:15,calls:15,sales:15,mission:5,cash:10};
  var _w=Object.assign({},_defW,(DB.kpiTargets&&DB.kpiTargets.weights)||{});
  var t=getKPITarget(userId,month);
  var calls=getCallsMonth(userId,month);
  var visits=getVisitsMonth(userId,month);
  var sales=getSalesMonth(userId,month);
  var mission=getMissionMonth(userId,month);
  var autoCnv=getAutoConversions(userId,month);
  var retention=getRetentionData(userId);
  var weekV=getWeekVisits(userId);
  var wd=workingDaysInJMonth(month);

  // auto-count touchpoints from DB.edits
  var touchedCenters={};
  Object.keys(DB.edits||{}).forEach(function(key){
    var e=DB.edits[key];
    var owner=e.owner||_getOwnerForRecKey(key)||'';
    if(owner!==userId)return;
    var ts=e._lastActivity||e._ts||0;
    if(ts>=b.startTs&&ts<=b.endTs)touchedCenters[key]=true;
  });
  var autoCalls=Object.keys(touchedCenters).length;
  // use autoCalls if no manual call log entries for this user+month
  var callsAutoMode=(calls.length===0&&autoCalls>0);

  var totalCalls=callsAutoMode?autoCalls:calls.reduce(function(s,l){return s+(l.count||0);},0);
  var avgCalls=wd>0?totalCalls/wd:0;
  var totalVisits=visits.total;
  var avgVisits=totalVisits/4.3;
  var visitsTip='این ماه: '+totalVisits+' ویزیت ('+visits.auto.length+' از برنامه هفته'+(visits.manual.length?' + '+visits.manual.length+' دستی':'')+')  •  این هفته: '+weekV;
  var totalSalesCnt=sales.length+autoCnv;
  var totalSalesAmt=sales.reduce(function(s,l){return s+(l.amount||0);},0);
  var cashCnt=sales.filter(function(l){return l.isCash;}).length;
  var cashPct=sales.length>0?cashCnt/sales.length*100:0;

  function sc(actual,target){return target>0?Math.min(actual/target,1)*100:0;}

  var s1=sc(totalSalesCnt,t.salesCount);
  var s2=Math.min(retention.pct/90*100,100); // هدف ۹۰٪ retention
  var s3=sc(avgVisits,t.visitsPerWeek);
  var s4=sc(avgCalls,t.callsPerDay);
  var s5=t.salesAmount>0?sc(totalSalesAmt,t.salesAmount):sc(totalSalesCnt,t.salesCount);
  var s6=mission&&mission.done?100:0;
  var s7=sales.length>0?sc(cashPct,t.cashPct):0;

  var kpis=[
    {id:'conversion',name:'نرخ تبدیل لید',icon:'🔄',weight:_w.conversion,score:s1,
     actual:totalSalesCnt,target:t.salesCount,unit:'قرارداد',
     tip:'قراردادهای بسته‌شده در این ماه',auto:true},
    {id:'retention',name:'نرخ حفظ مشتری',icon:'🤝',weight:_w.retention,score:s2,
     actual:retention.pct,target:90,unit:'درصد',
     tip:retention.cust+' مشتری فعال از '+retention.total+' مرکز با ویرایش',auto:true},
    {id:'visits',name:'ویزیت حضوری هفتگی',icon:'🚗',weight:_w.visits,score:s3,
     actual:Math.round(avgVisits*10)/10,target:t.visitsPerWeek,unit:'ویزیت/هفته',
     tip:visitsTip,auto:true},
    {id:'calls',name:'تماس روزانه',icon:'📞',weight:_w.calls,score:s4,
     actual:Math.round(avgCalls*10)/10,target:t.callsPerDay,unit:'تماس/روز',
     tip:'مجموع '+totalCalls+' تماس در '+wd+' روز کاری'+(callsAutoMode?' (برآورد از CRM)':''),auto:callsAutoMode},
    {id:'sales',name:'تارگت فروش',icon:'💰',weight:_w.sales,score:s5,
     actual:t.salesAmount>0?totalSalesAmt:totalSalesCnt,
     target:t.salesAmount>0?t.salesAmount:t.salesCount,
     unit:t.salesAmount>0?'ریال':'قرارداد',
     tip:'فروش ثبت‌شده + قراردادهای CRM',auto:false},
    {id:'mission',name:'ماموریت ماهانه',icon:'✈️',weight:_w.mission,score:s6,
     actual:s6?1:0,target:1,unit:'',binary:true,
     tip:mission?('وضعیت: '+(mission.done?'انجام شد':'برنامه‌ریزی')+(mission.note?' — '+mission.note:'')):'ثبت نشده',auto:false},
    {id:'cash',name:'فروش نقدی',icon:'💵',weight:_w.cash,score:s7,
     actual:Math.round(cashPct),target:t.cashPct,unit:'درصد',
     tip:cashCnt+' فروش نقدی از '+sales.length+' فروش ثبت‌شده',auto:false},
  ];

  var overall=kpis.reduce(function(s,k){return s+k.score*(k.weight/100);},0);

  // dayElapsed and dayTotal for forecast
  var todayTs=new Date().getTime();
  var dayTotal=wd;
  var dayElapsed=0;
  if(todayTs>=b.startTs&&todayTs<=b.endTs){
    // count working days elapsed
    var curD=new Date(b.startTs);
    var now=new Date();
    while(curD<=now&&curD<=new Date(b.endTs)){
      var dow=curD.getDay(); // 0=Sun,5=Fri,6=Sat in JS (Iran: Fri+Sat off)
      if(dow!==5&&dow!==6)dayElapsed++;
      curD.setDate(curD.getDate()+1);
    }
  }else if(todayTs>b.endTs){
    dayElapsed=dayTotal;
  }

  // forecast: project end-of-month values
  var forecast={};
  if(dayElapsed>0){
    kpis.forEach(function(k){
      forecast[k.id]=Math.min((k.score/dayElapsed)*dayTotal,150);
    });
    forecast.overall=Math.min((overall/dayElapsed)*dayTotal,150);
  }

  return{kpis:kpis,overall:Math.round(overall),userId:userId,month:month,targets:t,
    dayElapsed:dayElapsed,dayTotal:dayTotal,forecast:forecast,callsAutoMode:callsAutoMode,autoCalls:autoCalls};
}

// ── رندر پنل ─────────────────────────────────────────────────────
var _kpiUser=null;
var _kpiMonth=null;
var _trendOpen=true;
var _teamOpen=true;
var _recsOpen=true;
var _discOpen=false;
var _discoveredCenters=null;


// ── مدیریت اهداف تیم ─────────────────────────────────────────
function updateWeightTotal(){
  var keys=['conversion','retention','visits','calls','sales','mission','cash'];
  var sum=0;
  keys.forEach(function(k){
    var el=document.getElementById('kw_'+k);
    if(el)sum+=parseInt(el.value||0);
  });
  var tot=document.getElementById('kw_total');
  if(tot){tot.textContent=sum;tot.style.color=sum===100?'#16a34a':'#dc2626';}
}

function openTeamKPITargets(){
  var month=_kpiMonth||currentJMonth();
  var userKeys=Object.keys(USERS).filter(function(u){return u!=='guest';});
  
  var rows=userKeys.map(function(u){
    var t=getKPITarget(u,month);
    return '<tr>'
      +'<td style="padding:7px 10px;font-weight:600;color:var(--text-primary)">'+esc(USERS[u])+'</td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_calls_'+u+'" value="'+t.callsPerDay+'" min="1" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_visits_'+u+'" value="'+t.visitsPerWeek+'" min="1" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_sales_'+u+'" value="'+t.salesCount+'" min="0" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'<td style="padding:7px 10px;text-align:center"><input type="number" id="tkt_cash_'+u+'" value="'+t.cashPct+'" min="0" max="100" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center"></td>'
      +'</tr>';
  }).join('');

  var body='<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">'
    +'📅 ماه: <strong style="color:var(--text-primary)">'+jMonthLabel(month)+'</strong>'
    +' — اهداف برای هر کارشناس به صورت جداگانه ذخیره می‌شود.</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px 10px;text-align:right;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">کارشناس</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">📞 تماس/روز</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">🚗 ویزیت/هفته</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">🔄 قرارداد</th>'
    +'<th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1.5px solid var(--border)">💵 نقدی٪</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';

  // weights section (manager only)
  if(_isManager()){
    var defW={conversion:20,retention:20,visits:15,calls:15,sales:15,mission:5,cash:10};
    var curW=Object.assign({},defW,(DB.kpiTargets&&DB.kpiTargets.weights)||{});
    var wLabels={conversion:'🔄 نرخ تبدیل',retention:'🤝 حفظ مشتری',visits:'🚗 ویزیت',calls:'📞 تماس',sales:'💰 فروش',mission:'✈️ ماموریت',cash:'💵 نقدی'};
    var wRows=Object.keys(wLabels).map(function(k){
      return '<tr><td style="padding:6px 10px;font-size:12px">'+wLabels[k]+'</td>'        +'<td style="padding:6px 10px;text-align:center"><input type="number" id="kw_'+k+'" value="'+curW[k]+'" min="0" max="100" style="width:55px;padding:4px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);text-align:center" oninput="updateWeightTotal()"></td>'        +'</tr>';
    }).join('');
    var wSum=Object.values(curW).reduce(function(s,v){return s+v;},0);
    body+='<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">'      +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">⚖️ وزن شاخص‌ها <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(جمع: <strong id="kw_total">'+wSum+'</strong>)</span></div>'      +'<table style="width:100%;border-collapse:collapse;font-size:12px">'      +'<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border)">شاخص</th>'      +'<th style="padding:6px 10px;text-align:center;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border)">وزن (%)</th></tr></thead>'      +'<tbody>'+wRows+'</tbody></table></div>';
  }

  var foot='<button class="btn-secondary" onclick="closeModal(\'teamKpiModal\')">لغو</button>'    +'<button class="btn-primary" onclick="saveTeamKPITargets(_kpiMonth)">💾 ذخیره اهداف تیم</button>';

  openModal('teamKpiModal','🎯 اهداف تیم — '+jMonthLabel(month),body,foot,{lg:true});
}

function saveTeamKPITargets(month){
  month=month||_kpiMonth||currentJMonth();
  var userKeys=Object.keys(USERS).filter(function(u){return u!=='guest';});
  var saved=0;
  userKeys.forEach(function(u){
    var calls=parseInt((document.getElementById('tkt_calls_'+u)||{}).value||15);
    var visits=parseInt((document.getElementById('tkt_visits_'+u)||{}).value||4);
    var sales=parseInt((document.getElementById('tkt_sales_'+u)||{}).value||2);
    var cash=parseInt((document.getElementById('tkt_cash_'+u)||{}).value||60);
    if(!DB.kpiTargets)DB.kpiTargets={};
    var existing=DB.kpiTargets[u+':'+month]||{};
    DB.kpiTargets[u+':'+month]=Object.assign({},existing,{callsPerDay:calls,visitsPerWeek:visits,salesCount:sales,cashPct:cash});
    // salesAmount preserved from existing via Object.assign
    saved++;
  });
  // save weights if present
  var wKeys=['conversion','retention','visits','calls','sales','mission','cash'];
  var hasWeightInputs=wKeys.some(function(k){return !!document.getElementById('kw_'+k);});
  if(hasWeightInputs){
    var weights={};
    wKeys.forEach(function(k){
      var el=document.getElementById('kw_'+k);
      weights[k]=el?Math.max(0,parseInt(el.value||0)):0;
    });
    DB.kpiTargets.weights=weights;
  }
  saveDB();
  closeModal('teamKpiModal');
  showToast('✅ اهداف '+saved+' کارشناس ذخیره شد',2500);
  if(typeof renderKPIPanel==='function')renderKPIPanel();
}

function _kpiUserChange(v){
  _kpiUser=v;
  var d=document.getElementById('kpiRepDot');
  if(d&&window.umGetColor)d.style.background=umGetColor(v);
  renderKPIPanel();
}

function getProvKPITarget(provId) {
  var pt = (DB.kpiTargets && DB.kpiTargets.provinces) || {};
  return Object.assign({ contracts: 0, visits: 0 }, pt[provId] || {});
}

function saveProvKPITarget(provId, targets) {
  if (!DB.kpiTargets) DB.kpiTargets = {};
  if (!DB.kpiTargets.provinces) DB.kpiTargets.provinces = {};
  DB.kpiTargets.provinces[provId] = targets;
  saveDB();
}

function openProvTargetsModal() {
  _buildPCCache();
  var provinces = getAllProvinces();
  var body = '<div style="max-height:60vh;overflow-y:auto">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--bg-raised)">'
    + '<th style="padding:6px 8px;text-align:right">استان</th>'
    + '<th style="padding:6px 8px;text-align:center">هدف قرارداد</th>'
    + '<th style="padding:6px 8px;text-align:center">هدف ویزیت</th>'
    + '<th style="padding:6px 8px;text-align:center">واقعی قرارداد</th>'
    + '<th style="padding:6px 8px;text-align:center">پیشرفت</th>'
    + '</tr></thead><tbody>'
    + provinces.map(function(p) {
      var t = getProvKPITarget(p.id);
      var actualContracts = 0;
      var rtype = p.id === 'tehran' ? 'center' : 'pc';
      var arr = p.id === 'tehran' ? CENTERS : (_PC_CACHE[p.id] || []);
      arr.forEach(function(c) {
        var e = getE(rtype, c.id);
        if (e.status === 'قرارداد بسته شد') actualContracts++;
      });
      var pct = t.contracts > 0 ? Math.min(100, Math.round(actualContracts / t.contracts * 100)) : 0;
      var barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3b82f6';
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:6px 8px;font-weight:600">' + esc(p.name) + '</td>'
        + '<td style="padding:6px 8px;text-align:center"><input type="number" min="0" value="' + t.contracts + '" style="width:60px;padding:3px;border:1px solid var(--border-input);border-radius:4px;text-align:center;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)" onchange="saveProvKPITarget(' + JSON.stringify(p.id) + ',Object.assign(getProvKPITarget(' + JSON.stringify(p.id) + '),{contracts:parseInt(this.value)||0}))"></td>'
        + '<td style="padding:6px 8px;text-align:center"><input type="number" min="0" value="' + t.visits + '" style="width:60px;padding:3px;border:1px solid var(--border-input);border-radius:4px;text-align:center;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)" onchange="saveProvKPITarget(' + JSON.stringify(p.id) + ',Object.assign(getProvKPITarget(' + JSON.stringify(p.id) + '),{visits:parseInt(this.value)||0}))"></td>'
        + '<td style="padding:6px 8px;text-align:center;font-weight:700;color:' + (actualContracts > 0 ? '#22c55e' : 'var(--text-muted)') + '">' + actualContracts + '</td>'
        + '<td style="padding:6px 8px"><div style="background:var(--bg-page);border-radius:10px;height:8px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:10px;transition:.3s"></div></div><div style="text-align:center;font-size:10px;margin-top:2px;color:var(--text-muted)">' + pct + '%</div></td>'
        + '</tr>';
    }).join('')
    + '</tbody></table></div>';
  openModal('provTargetsModal', '🎯 اهداف استانی', body, '<button class="btn-secondary" onclick="closeModal(\'provTargetsModal\')">بستن</button>');
}

function exportKPIReport() {
  // builds a printable HTML string with KPI data for current user+month
  // opens in a new window with print dialog
  var data = calcKPIs(_kpiUser, _kpiMonth);
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>گزارش KPI</title>' +
    '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;direction:rtl;background:#fff;color:#1e293b}' +
    'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:10px 14px;text-align:right}' +
    'th{background:#f1f5f9;font-weight:700}.score-big{font-size:48px;font-weight:900;text-align:center;padding:20px}' +
    '.green{color:#16a34a}.red{color:#dc2626}.orange{color:#f59e0b}h1{font-size:20px;border-bottom:2px solid #e2e8f0;padding-bottom:10px}' +
    '</style></head><body>';
  html += '<h1>📊 گزارش عملکرد KPI — ' + (USERS[_kpiUser]||_kpiUser) + ' — ' + jMonthLabel(_kpiMonth) + '</h1>';
  var ov = data.overall;
  var oc = ov>=80?'green':ov>=50?'orange':'red';
  html += '<div class="score-big ' + oc + '">' + Math.round(ov) + ' / 100</div>';
  html += '<table><tr><th>شاخص</th><th>امتیاز</th><th>واقعی</th><th>هدف</th><th>وزن</th></tr>';
  data.kpis.forEach(function(k) {
    var sc = Math.round(k.score);
    var sc_cls = sc>=80?'green':sc>=50?'orange':'red';
    html += '<tr><td>' + k.icon + ' ' + k.name + '</td><td class="' + sc_cls + '"><b>' + sc + '</b></td><td>' + (k.actualStr||k.actual) + '</td><td>' + (k.targetStr||k.target) + '</td><td>' + k.weight + '%</td></tr>';
  });
  html += '</table></body></html>';
  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},400);}
}

function exportKPIReport() {
  // builds a printable HTML string with KPI data for current user+month
  // opens in a new window with print dialog
  var data = calcKPIs(_kpiUser, _kpiMonth);
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>گزارش KPI</title>' +
    '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;direction:rtl;background:#fff;color:#1e293b}' +
    'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:10px 14px;text-align:right}' +
    'th{background:#f1f5f9;font-weight:700}.score-big{font-size:48px;font-weight:900;text-align:center;padding:20px}' +
    '.green{color:#16a34a}.red{color:#dc2626}.orange{color:#f59e0b}h1{font-size:20px;border-bottom:2px solid #e2e8f0;padding-bottom:10px}' +
    '</style></head><body>';
  html += '<h1>📊 گزارش عملکرد KPI — ' + (USERS[_kpiUser]||_kpiUser) + ' — ' + jMonthLabel(_kpiMonth) + '</h1>';
  var ov = data.overall;
  var oc = ov>=80?'green':ov>=50?'orange':'red';
  html += '<div class="score-big ' + oc + '">' + Math.round(ov) + ' / 100</div>';
  html += '<table><tr><th>شاخص</th><th>امتیاز</th><th>واقعی</th><th>هدف</th><th>وزن</th></tr>';
  data.kpis.forEach(function(k) {
    var sc = Math.round(k.score);
    var sc_cls = sc>=80?'green':sc>=50?'orange':'red';
    html += '<tr><td>' + k.icon + ' ' + k.name + '</td><td class="' + sc_cls + '"><b>' + sc + '</b></td><td>' + (k.actualStr||k.actual) + '</td><td>' + (k.targetStr||k.target) + '</td><td>' + k.weight + '%</td></tr>';
  });
  html += '</table></body></html>';
  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},400);}
}


// ── Center discovery (online biopsy potential) ─────────────────────────
function _loadDiscoveredCenters(force) {
  if(_discoveredCenters !== null && !force) {
    _renderDiscoverySection();
    return;
  }
  fetch('/api/discovery')
    .then(function(r){ return r.json(); })
    .then(function(data){
      _discoveredCenters = Array.isArray(data) ? data : [];
      _renderDiscoverySection();
    })
    .catch(function(){ _discoveredCenters = []; _renderDiscoverySection(); });
}

function _renderDiscoverySection() {
  var el = document.getElementById('discoverySection');
  if(el) el.innerHTML = _buildDiscoveryHtml(_discoveredCenters || []);
}

var _recentCenters=[];
var _discFilter='new';
function _buildDiscoveryHtml(centers) {
  var filtered = _discFilter === 'all'
    ? centers
    : centers.filter(function(c){ return c.status === _discFilter; });
  var cntAll  = centers.length;
  var cntNew  = centers.filter(function(c){ return c.status==='new'; }).length;
  var cntImp  = centers.filter(function(c){ return c.status==='imported'; }).length;
  var cntIgn  = centers.filter(function(c){ return c.status==='ignored'; }).length;

  var _btn = function(label, val, cnt) {
    var active = _discFilter === val;
    return '<button onclick="_discFilter=\'' + val + '\';_renderDiscoverySection()" '
      + 'style="font-size:11px;padding:3px 10px;border-radius:14px;cursor:pointer;border:1px solid '
      + (active ? 'var(--brand,#6366f1);background:var(--brand,#6366f1);color:#fff' : 'var(--border);background:var(--bg-raised);color:var(--text-secondary)')
      + '">' + label + (cnt ? ' <b>' + cnt + '</b>' : '') + '</button>';
  };

  var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    + _btn('همه', 'all', cntAll)
    + _btn('جدید 🆕', 'new', cntNew)
    + _btn('وارد شده ✅', 'imported', cntImp)
    + _btn('نادیده 🚫', 'ignored', cntIgn)
    + '</div>';

  if(!filtered.length) {
    return html + '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">'
      + 'هیچ مرکزی در این دسته یافت نشد</div>';
  }

  filtered.forEach(function(c) {
    var sc = parseInt(c.score) || 0;
    var scColor = sc >= 10 ? '#dc2626' : sc >= 7 ? '#ea580c' : '#ca8a04';
    var stBg = c.status==='imported' ? '#f0fdf4' : c.status==='ignored' ? '#f8fafc' : '#faf5ff';
    var stBorder = c.status==='imported' ? '#86efac' : c.status==='ignored' ? '#e2e8f0' : '#d8b4fe';

    // Doctors
    var docHtml = '';
    if(c.doctors && c.doctors.length) {
      docHtml = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">'
        + (c.doctors||[]).map(function(d){
            var lbl = esc(d.label || d.specialty || '');
            var nm  = esc(d.name || '');
            return '<span style="font-size:10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:2px 8px">'
              + '👨‍⚕️ ' + lbl + (nm ? ': ' + nm : '') + '</span>';
          }).join('')
        + '</div>';
    }

    // Reasons
    var reasonHtml = '';
    if(c.reasons && c.reasons.length) {
      reasonHtml = '<div style="margin-top:5px;font-size:10px;color:#7c3aed">'
        + '💡 ' + (c.reasons||[]).map(function(r){ return esc(r); }).join(' &nbsp;•&nbsp; ')
        + '</div>';
    }

    // Address
    var addrHtml = '';
    if(c.address) {
      addrHtml = '<div style="margin-top:4px;font-size:10px;color:var(--text-muted)">📍 ' + esc(c.address) + '</div>';
    }

    // Source URLs
    var urlHtml = '';
    if(c.source_urls && c.source_urls.length) {
      urlHtml = '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">'
        + (c.source_urls||[]).slice(0,4).map(function(u,i){
            var domain = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
            return '<a href="' + esc(u) + '" target="_blank" style="font-size:10px;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:2px 7px;text-decoration:none">🔗 ' + esc(domain) + '</a>';
          }).join('')
        + '</div>';
    }

    // Date
    var dateStr = '';
    if(c.last_scraped) {
      try {
        var d = new Date(c.last_scraped);
        var jd = g2j(d.getFullYear(), d.getMonth()+1, d.getDate());
        dateStr = jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
      } catch(_) {}
    }

    // Biopsy mentions
    var biopHtml = c.biopsy_mentions > 0
      ? '<span style="font-size:10px;background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;border-radius:10px;padding:2px 7px">💬 ' + c.biopsy_mentions + ' نظر بیوپسی</span>'
      : '';

    // Status badge
    var stBadge = c.status === 'imported'
      ? '<span style="font-size:9px;background:#dcfce7;color:#166534;border-radius:8px;padding:1px 6px;font-weight:700">✅ وارد شده</span>'
      : c.status === 'ignored'
      ? '<span style="font-size:9px;background:#f1f5f9;color:#64748b;border-radius:8px;padding:1px 6px;font-weight:700">🚫 نادیده</span>'
      : '';

    // Action buttons
    var actBtns = '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
    if(c.status !== 'imported') {
      actBtns += '<button onclick="_discImport(\'' + c.id + '\')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">➕ وارد کن</button>';
    }
    if(c.status !== 'ignored') {
      actBtns += '<button onclick="_discIgnore(\'' + c.id + '\')" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">🚫 نادیده</button>';
    }
    if(c.status !== 'new') {
      actBtns += '<button onclick="fetch(\'/api/discovery/\'+\'' + c.id + '\',{method:\'PATCH\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({status:\'new\'})}).then(function(){_discoveredCenters=null;_loadDiscoveredCenters();})" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit">↩ برگردان</button>';
    }
    actBtns += '</div>';

    html += '<div style="background:' + stBg + ';border-radius:8px;border:1px solid ' + stBorder + ';padding:10px 14px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700;color:var(--text-primary)">' + esc(c.name)
      + (c.city ? ' <span style="font-weight:400;color:var(--text-muted);font-size:11px">— ' + esc(c.city) + '</span>' : '')
      + ' ' + stBadge + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
      + '<span style="background:' + scColor + ';color:#fff;border-radius:10px;padding:2px 10px;font-size:12px;font-weight:700">امتیاز ' + sc + '</span>'
      + (biopHtml ? biopHtml : '')
      + (dateStr ? '<span style="font-size:9px;color:var(--text-muted)">' + dateStr + '</span>' : '')
      + '</div>'
      + '</div>'
      + docHtml
      + reasonHtml
      + addrHtml
      + urlHtml
      + actBtns
      + '</div>';
  });

  return html;
}


function _discImport(cid) {
  var c = (_discoveredCenters||[]).find(function(x){ return x.id===cid; });
  if(!c) return;
  if(!DB.extra) DB.extra = [];
  var newId = 'disc_' + cid;
  if(!DB.extra.find(function(x){ return x.id===newId; })) {
    DB.extra.push({
      id: newId,
      name: c.name,
      province: c.city || '',
      type: 'خصوصی',
      potential: 2,
      biopsyScore: c.score,
      biopsyDoctors: (c.doctors||[]).map(function(d){ return d.label+': '+d.name; }).join(', '),
    });
    saveDB();
  }
  fetch('/api/discovery/' + cid, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'imported'})});
  _discoveredCenters = (_discoveredCenters||[]).map(function(x){ return x.id===cid ? Object.assign({},x,{status:'imported'}) : x; });
  _renderDiscoverySection();
  showToast('✅ اضافه شد: ' + c.name, 2500);
}

function _discIgnore(cid) {
  fetch('/api/discovery/' + cid, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ignored'})});
  _discoveredCenters = (_discoveredCenters||[]).map(function(x){ return x.id===cid ? Object.assign({},x,{status:'ignored'}) : x; });
  _renderDiscoverySection();
}

function _discAiScan() {
  var city = (document.getElementById('discCityFilter')||{}).value || '';
  var btn = document.querySelector('[onclick="_discAiScan()"]');
  if(btn) { btn.disabled=true; btn.textContent='⏳ در حال جستجو...'; }
  fetch('/api/discovery/ai-scan', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({city: city})
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error) { showToast('❌ ' + data.error, 4000); return; }
    showToast('✅ ' + data.saved + ' مرکز از هوش مصنوعی دریافت شد', 3000);
    _discoveredCenters = null;
    _loadDiscoveredCenters();
  })
  .catch(function(e){ showToast('❌ خطا: ' + e.message, 3000); })
  .finally(function(){
    var b = document.querySelector('[onclick="_discAiScan()"]');
    if(b) { b.disabled=false; b.innerHTML='&#129302; جستجوی هوشمند از همه منابع'; }
  });
}


function calcCenterRecommendations() {
  var today = todayStr();
  var nowMs = nowTs();
  var recs = [];
  var allCenters = [];
  if(typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c){ allCenters.push({rtype:'center', id:c.id, name:c.name, prov:'تهران'}); });
  }
  if(typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(pid){
      (_PC_CACHE[pid]||[]).forEach(function(c){ allCenters.push({rtype:'pc', id:c.id, name:c.name, prov:c.province||pid}); });
    });
  }
  if(DB.extra && DB.extra.length) {
    DB.extra.forEach(function(c){ allCenters.push({rtype:'pc', id:c.id, name:c.name, prov:c.province||''}); });
  }
  allCenters.forEach(function(c) {
    var k = c.rtype + '_' + c.id;
    var e = (DB.edits||{})[k] || {};
    var pot = parseInt(e.potential!==undefined&&e.potential!==''?e.potential:(c.potential||4))||4;
    if(pot > 2) return; // فقط مراکز P1 و P2 پیشنهاد می‌شوند (۱=بیشترین ارزش)
    var status = e.status || STATUS_LIST[0];
    var lead = e.lead || '';
    var lastAct = e._lastActivity || e._ts || 0;
    var daysSince = lastAct ? Math.floor((nowMs - lastAct) / 86400000) : 999;
    var followup = e.followupDate || '';
    var owner = e.owner || '';
    var score = 0;
    var reasons = [];
    var action = '';
    var urgency = 'low';
    if(daysSince > 14) {
      score += (3 - pot) * 15; // P1 امتیاز بیشتر از P2
      reasons.push('پتانسیل ' + pot + '⭐ — ' + daysSince + ' روز بدون تماس');
      action = action || 'تماس برای پیگیری';
    }
    if((lead === 'لید' || lead === 'فرصت') && daysSince > 7) {
      score += 25;
      reasons.push(lead + ' — ' + daysSince + ' روز بدون پیشرفت');
      action = action || 'پیشنهاد قیمت ارسال کنید';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(status === 'پیشنهاد ارسال شد' && daysSince > 5) {
      score += 30;
      reasons.push('پیشنهاد ارسال شده — ' + daysSince + ' روز بدون پاسخ');
      action = 'پیگیری پیشنهاد';
      urgency = 'high';
    }
    if(lead === 'مشتری' && daysSince > 30) {
      score += 20;
      reasons.push('مشتری فعال — ' + daysSince + ' روز بدون ارتباط');
      action = action || 'تماس حفظ ارتباط';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(followup && followup < today) {
      score += 40;
      reasons.push('پیگیری معوق: ' + followup);
      action = 'پیگیری فوری';
      urgency = 'critical';
    }
    if(status === 'تماس اولیه' && daysSince > 10) {
      score += 15;
      reasons.push('تماس اولیه — نیاز به تعمیق');
      action = action || 'برنامه‌ریزی ملاقات';
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    if(status === STATUS_LIST[0]) {
      score += (3 - pot) * 12;
      reasons.push('مرکز با پتانسیل بالا — هنوز تماسی نشده');
      action = action || 'شروع ارتباط';
    }
    if(score > 0 && reasons.length > 0) {
      recs.push({
        name: c.name,
        prov: c.prov,
        owner: owner,
        score: score,
        reasons: reasons,
        action: action,
        urgency: urgency,
        pot: pot,
        lead: lead,
        status: status,
        daysSince: daysSince === 999 ? null : daysSince,
        rtype: c.rtype,
        id: c.id
      });
    }
  });
  recs.sort(function(a,b){ if(a.pot!==b.pot)return a.pot-b.pot; return b.score-a.score; }); // P1 اول، سپس امتیاز
  return recs.slice(0, 15);
}

// ─── Mission Detail Modal ──────────────────────────────────────────────────
var _msCurrent = null; // {userId, month, ms, tab}

function openMissionDetail(userId, month) {
  userId = userId || (typeof _kpiUser !== 'undefined' ? _kpiUser : '') || currentUser;
  month = month || (typeof _kpiMonth !== 'undefined' ? _kpiMonth : '') || currentJMonth();
  ensureKPIDB();
  var existing = getMissionMonth(userId, month);
  var ms = existing
    ? JSON.parse(JSON.stringify(existing))
    : {id: Date.now(), userId: userId, month: month, done: false, note: '', city: '', startDate: '', endDate: '', centers: [], expenses: []};
  if (!ms.centers) ms.centers = [];
  if (!ms.expenses) ms.expenses = [];
  _msCurrent = {userId: userId, month: month, ms: ms, tab: 'info'};
  _msRenderModal();
}

function _msRenderModal() {
  if (!_msCurrent) return;
  var m = _msCurrent;
  var hasSaved = !!getMissionMonth(m.userId, m.month);
  var body = _msBuildTabs() + _msGetTabContent();
  var foot = '<button class="btn-primary" onclick="_msSave(true)" style="background:#7c3aed;border-color:#7c3aed">'
    + (m.ms.done ? '✅ بروزرسانی (انجام شد)' : '✅ انجام شد') + '</button>'
    + ' <button class="btn-secondary" onclick="_msSave(false)">⏳ برنامه‌ریزی</button>'
    + (hasSaved ? ' <button class="btn-secondary" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5" onclick="_msDelete()">حذف</button>' : '')
    + ' <button class="btn-secondary" onclick="closeModal(\'missionDetailModal\')">بستن</button>';
  openModal('missionDetailModal', '✈️ ماموریت — ' + jMonthLabel(m.month) + ' — ' + (USERS[m.userId] || m.userId), body, foot, {lg: true});
}

function _msBuildTabs() {
  var tabs = [
    {id: 'info', label: '📋 اطلاعات'},
    {id: 'centers', label: '🏥 مراکز (' + (_msCurrent.ms.centers.length) + ')'},
    {id: 'expenses', label: '💰 هزینه‌ها (' + (_msCurrent.ms.expenses.length) + ')'},
    {id: 'report', label: '📊 گزارش'}
  ];
  return '<div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:2px solid var(--border);padding-bottom:0">'
    + tabs.map(function(t) {
        var active = _msCurrent.tab === t.id;
        return '<button onclick="_msSwitchTab(\'' + t.id + '\')" style="border:none;background:' + (active ? '#7c3aed' : 'transparent')
          + ';color:' + (active ? '#fff' : 'var(--text-secondary)') + ';padding:7px 13px;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600;transition:background 0.15s">'
          + t.label + '</button>';
      }).join('')
    + '</div>';
}

function _msSwitchTab(tab) {
  if (!_msCurrent) return;
  _msCollectFormData();
  _msCurrent.tab = tab;
  var modal = document.getElementById('missionDetailModal');
  if (!modal) return;
  var body = modal.querySelector('.m-body');
  if (!body) return;
  body.innerHTML = _msBuildTabs() + _msGetTabContent();
}

function _msGetTabContent() {
  var t = _msCurrent.tab;
  if (t === 'info') return _msBuildInfoTab();
  if (t === 'centers') return _msBuildCentersTab();
  if (t === 'expenses') return _msBuildExpensesTab();
  if (t === 'report') return _msBuildReportTab();
  return '';
}

function _msBuildInfoTab() {
  var ms = _msCurrent.ms;
  var inp = 'width:100%;padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box';
  var lbl = 'font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px';
  var months = prevJMonths(6);
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><label style="' + lbl + '">ماه ماموریت</label>'
    + '<select id="ms_month" style="' + inp + '">'
    + months.map(function(m) {
        return '<option value="' + m + '"' + (ms.month === m ? ' selected' : '') + '>' + jMonthLabel(m) + '</option>';
      }).join('')
    + '</select></div>'
    + '<div><label style="' + lbl + '">شهر / مقصد</label>'
    + '<input id="ms_city" style="' + inp + '" placeholder="تهران، شیراز..." value="' + esc(ms.city || '') + '"></div>'
    + '<div><label style="' + lbl + '">تاریخ شروع</label>'
    + '<input id="ms_startDate" style="' + inp + '" placeholder="YYYY/MM/DD" value="' + esc(ms.startDate || '') + '" onfocus="openJDP(this,function(v){this.value=v})"></div>'
    + '<div><label style="' + lbl + '">تاریخ پایان</label>'
    + '<input id="ms_endDate" style="' + inp + '" placeholder="YYYY/MM/DD" value="' + esc(ms.endDate || '') + '" onfocus="openJDP(this,function(v){this.value=v})"></div>'
    + '</div>'
    + '<div style="margin-bottom:14px"><label style="' + lbl + '">توضیحات / هدف ماموریت</label>'
    + '<textarea id="ms_note" style="' + inp + ';height:70px;resize:vertical" placeholder="هدف سفر، نتیجه کلی...">' + esc(ms.note || '') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;align-items:center;padding:10px;background:var(--bg-raised);border-radius:8px">'
    + '<span style="font-size:12px;font-weight:600;color:var(--text-secondary)">وضعیت:</span>'
    + '<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:' + (ms.done ? '#d1fae5' : '#fef3c7') + ';color:' + (ms.done ? '#065f46' : '#92400e') + '">'
    + (ms.done ? '✅ انجام شد' : '⏳ برنامه‌ریزی') + '</span>'
    + '<span style="font-size:11px;color:var(--text-muted)">(از دکمه‌های پایین تغییر دهید)</span>'
    + '</div>';
}

function _msBuildCentersTab() {
  var ms = _msCurrent.ms;
  var inp = 'padding:7px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit';
  var html = '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">'
    + '<input id="ms_ctr_q" style="' + inp + ';flex:1" placeholder="🔍 جستجوی مرکز..." oninput="_msCtrSearch(this.value)">'
    + '</div>'
    + '<div id="ms_ctr_results" style="margin-bottom:14px;max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;display:none"></div>';
  if (ms.centers.length) {
    html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">مراکز این ماموریت (' + ms.centers.length + '):</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px">';
    ms.centers.forEach(function(c, i) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-raised);border-radius:6px;border:1px solid var(--border)">'
        + '<span style="flex:1;font-size:12px;font-weight:600">' + esc(c.name) + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted)">' + esc(c.date || '') + '</span>'
        + '<button onclick="_msRemCenter(' + i + ')" style="border:none;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px">حذف</button>'
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;background:var(--bg-raised);border-radius:8px">هنوز مرکزی اضافه نشده. از جستجو بالا مرکز اضافه کنید.</div>';
  }
  return html;
}

function _msCtrSearch(q) {
  var el = document.getElementById('ms_ctr_results');
  if (!el) return;
  if (!q || q.length < 2) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var norm = fNorm(q);
  var results = [];
  var today = todayStr();
  // search Tehran centers
  if (typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c) {
      if (fNorm(c.name).indexOf(norm) >= 0) results.push({rtype: 'center', id: c.id, name: c.name, date: today});
    });
  }
  // search PC centers
  if (typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(pid) {
      (_PC_CACHE[pid] || []).forEach(function(c) {
        if (fNorm(c.name).indexOf(norm) >= 0) results.push({rtype: 'pc', id: c.id, name: c.name, date: today});
      });
    });
  }
  results = results.slice(0, 12);
  if (!results.length) { el.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">نتیجه‌ای یافت نشد</div>'; el.style.display = 'block'; return; }
  el.innerHTML = results.map(function(r) {
    var nm = esc(r.name).replace(new RegExp('(' + esc(q) + ')', 'i'), '<strong>$1</strong>');
    return '<div onclick="_msAddCenter(\'' + r.rtype + '\',\'' + r.id + '\',\'' + esc(r.name).replace(/'/g, "\\'") + '\')" '
      + 'style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)" '
      + 'onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">'
      + nm + '</div>';
  }).join('');
  el.style.display = 'block';
}

function _msAddCenter(rtype, id, name) {
  if (!_msCurrent) return;
  var ms = _msCurrent.ms;
  var already = ms.centers.some(function(c) { return c.rtype === rtype && c.id === id; });
  if (already) { showToast('این مرکز قبلاً اضافه شده'); return; }
  ms.centers.push({rtype: rtype, id: id, name: name, date: todayStr()});
  _msCurrent.tab = 'centers';
  var modal = document.getElementById('missionDetailModal');
  if (modal) {
    var body = modal.querySelector('.m-body');
    if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent();
  }
}

function _msRemCenter(idx) {
  if (!_msCurrent) return;
  _msCurrent.ms.centers.splice(idx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) {
    var body = modal.querySelector('.m-body');
    if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent();
  }
}

function _msBuildExpensesTab() {
  var ms = _msCurrent.ms;
  var cats = ['ایاب و ذهاب', 'اقامت', 'غذا', 'نمایندگی', 'سایر'];
  var inp = 'padding:6px 8px;border:1px solid var(--border-input);border-radius:5px;font-size:11px;font-family:inherit;width:100%;box-sizing:border-box';
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<span style="font-size:12px;font-weight:700;color:var(--text-primary)">ردیف‌های هزینه</span>'
    + '<button onclick="_msAddExpense()" style="border:none;background:#7c3aed;color:#fff;padding:5px 12px;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600">+ افزودن ردیف</button>'
    + '</div>';
  if (!ms.expenses.length) {
    html += '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;background:var(--bg-raised);border-radius:8px">هنوز هزینه‌ای ثبت نشده.</div>';
  } else {
    var total = ms.expenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    ms.expenses.forEach(function(ex, i) {
      html += '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 120px auto;gap:6px;margin-bottom:6px;align-items:end">'
        + '<div><label style="font-size:10px;color:var(--text-muted)">عنوان</label><input style="' + inp + '" value="' + esc(ex.title || '') + '" oninput="_msExpField(' + i + ',\'title\',this.value)"></div>'
        + '<div><label style="font-size:10px;color:var(--text-muted)">مبلغ (ریال)</label><input type="number" style="' + inp + '" value="' + (ex.amount || 0) + '" oninput="_msExpField(' + i + ',\'amount\',this.value)"></div>'
        + '<div><label style="font-size:10px;color:var(--text-muted)">دسته</label><select style="' + inp + '" onchange="_msExpField(' + i + ',\'cat\',this.value)">'
        + cats.map(function(c) { return '<option' + (ex.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('')
        + '</select></div>'
        + '<div style="display:flex;align-items:flex-end"><button onclick="_msDelExpense(' + i + ')" style="border:none;background:#fee2e2;color:#dc2626;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:11px">حذف</button></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">'
        + '<div><label style="font-size:10px;color:var(--text-muted)">تاریخ</label><input style="' + inp + '" value="' + esc(ex.date || '') + '" placeholder="YYYY/MM/DD" oninput="_msExpField(' + i + ',\'date\',this.value)"></div>'
        + '<div><label style="font-size:10px;color:var(--text-muted)">توضیح</label><input style="' + inp + '" value="' + esc(ex.note || '') + '" oninput="_msExpField(' + i + ',\'note\',this.value)"></div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      if (ex.files && ex.files.length) {
        ex.files.forEach(function(f, fi) {
          html += '<span style="display:inline-flex;align-items:center;gap:4px;background:#e0e7ff;padding:2px 8px;border-radius:12px;font-size:11px">'
            + '📎 ' + esc(f.name)
            + '<button onclick="_msDelExpFile(' + i + ',' + fi + ')" style="border:none;background:transparent;color:#dc2626;cursor:pointer;font-size:10px;padding:0 2px">×</button>'
            + '</span>';
        });
      }
      html += '<label style="cursor:pointer;background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px">'
        + '📎 پیوست فایل<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" onchange="_msUploadFile(' + i + ',this)">'
        + '</label>'
        + '</div></div>';
    });
    html += '</div>'
      + '<div style="margin-top:12px;padding:10px;background:#f0fdf4;border-radius:6px;display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text-secondary)">جمع کل هزینه‌ها:</span>'
      + '<span style="font-size:14px;font-weight:700;color:#065f46">' + new Intl.NumberFormat('fa-IR').format(total) + ' ریال</span>'
      + '</div>';
  }
  return html;
}

function _msAddExpense() {
  if (!_msCurrent) return;
  _msCollectFormData();
  _msCurrent.ms.expenses.push({id: Date.now(), title: '', amount: 0, cat: 'سایر', date: todayStr(), note: '', files: []});
  _msCurrent.tab = 'expenses';
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msDelExpense(idx) {
  if (!_msCurrent) return;
  _msCurrent.ms.expenses.splice(idx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msExpField(idx, field, val) {
  if (!_msCurrent || !_msCurrent.ms.expenses[idx]) return;
  _msCurrent.ms.expenses[idx][field] = field === 'amount' ? parseFloat(val) || 0 : val;
}

function _msUploadFile(expIdx, input) {
  if (!input.files || !input.files.length || !_msCurrent) return;
  var file = input.files[0];
  if (file.size > 10 * 1024 * 1024) { showToast('حداکثر حجم فایل ۱۰ مگابایت است'); return; }
  _msCollectFormData();
  var ms = _msCurrent.ms;
  var missionId = ms.userId + '_' + ms.month.replace('/', '-');
  var expId = ms.expenses[expIdx] ? String(ms.expenses[expIdx].id) : String(expIdx);
  var fd = new FormData();
  fd.append('file', file);
  fd.append('missionId', missionId);
  fd.append('expenseId', expId);
  fetch('/api/missions/files', {method: 'POST', body: fd, credentials: 'include'})
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.id) { showToast('خطا در آپلود فایل'); return; }
      if (!ms.expenses[expIdx].files) ms.expenses[expIdx].files = [];
      ms.expenses[expIdx].files.push({fileId: data.id, name: file.name});
      var modal = document.getElementById('missionDetailModal');
      if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
      showToast('✅ فایل آپلود شد');
    })
    .catch(function() { showToast('خطا در آپلود فایل'); });
}

function _msDelExpFile(expIdx, fileIdx) {
  if (!_msCurrent) return;
  var ex = _msCurrent.ms.expenses[expIdx];
  if (!ex || !ex.files) return;
  var f = ex.files[fileIdx];
  if (f && f.fileId) {
    fetch('/api/missions/files/' + f.fileId, {method: 'DELETE', credentials: 'include'}).catch(function(){});
  }
  ex.files.splice(fileIdx, 1);
  var modal = document.getElementById('missionDetailModal');
  if (modal) { var body = modal.querySelector('.m-body'); if (body) body.innerHTML = _msBuildTabs() + _msGetTabContent(); }
}

function _msBuildReportTab() {
  var ms = _msCurrent.ms;
  var ctrs = ms.centers || [];
  var exps = ms.expenses || [];
  var total = exps.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
  var bycat = {};
  exps.forEach(function(e) {
    bycat[e.cat || 'سایر'] = (bycat[e.cat || 'سایر'] || 0) + (parseFloat(e.amount) || 0);
  });
  // effectiveness: centers that changed status or got new notes in the month
  var mBounds = jMonthBounds(ms.month);
  var effectiveCtr = 0;
  ctrs.forEach(function(c) {
    var hasActivity = (DB.changeLog || []).some(function(ch) {
      var ts = new Date(ch.at).getTime();
      return ch.rkey === c.rtype + '_' + c.id && ts >= mBounds.startTs && ts <= mBounds.endTs;
    });
    if (hasActivity) effectiveCtr++;
  });
  var costPerCenter = ctrs.length ? Math.round(total / ctrs.length) : 0;
  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
    + _msStatCard('🏥 مراکز ویزیت', ctrs.length, '')
    + _msStatCard('✅ مراکز با فعالیت', effectiveCtr, '')
    + _msStatCard('💰 هزینه کل', new Intl.NumberFormat('fa-IR').format(total), 'ریال')
    + _msStatCard('💳 هزینه/مرکز', new Intl.NumberFormat('fa-IR').format(costPerCenter), 'ریال')
    + _msStatCard('📎 فایل‌های پیوست', exps.reduce(function(s,e){return s+(e.files?e.files.length:0);},0), '')
    + _msStatCard('📅 مدت', (ms.startDate && ms.endDate ? (ms.endDate > ms.startDate ? '— روز' : '۱ روز') : '—'), '')
    + '</div>';
  if (Object.keys(bycat).length) {
    html += '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">تفکیک هزینه بر اساس دسته:</div>';
    Object.keys(bycat).forEach(function(cat) {
      var pct = total > 0 ? Math.round(bycat[cat] / total * 100) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        + '<span style="font-size:11px;min-width:80px;color:var(--text-secondary)">' + esc(cat) + '</span>'
        + '<div style="flex:1;background:var(--border);border-radius:4px;height:8px"><div style="width:' + pct + '%;background:#7c3aed;height:100%;border-radius:4px"></div></div>'
        + '<span style="font-size:11px;min-width:40px;text-align:left;color:var(--text-primary)">' + pct + '%</span>'
        + '<span style="font-size:11px;color:var(--text-muted)">' + new Intl.NumberFormat('fa-IR').format(bycat[cat]) + '</span>'
        + '</div>';
    });
    html += '</div>';
  }
  if (ctrs.length) {
    html += '<div><div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">مراکز ویزیت‌شده:</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
      + ctrs.map(function(c) {
          var act = (DB.changeLog || []).some(function(ch) {
            var ts = new Date(ch.at).getTime();
            return ch.rkey === c.rtype + '_' + c.id && ts >= mBounds.startTs && ts <= mBounds.endTs;
          });
          return '<span style="padding:3px 10px;border-radius:12px;font-size:11px;background:' + (act ? '#d1fae5' : '#f0f0f0') + ';color:' + (act ? '#065f46' : 'var(--text-secondary)') + '">' + esc(c.name) + (act ? ' ✅' : '') + '</span>';
        }).join('')
      + '</div></div>';
  }
  return html;
}

function _msStatCard(label, value, unit) {
  return '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">'
    + '<div style="font-size:20px;font-weight:700;color:#7c3aed">' + value + (unit ? '<span style="font-size:11px;color:var(--text-muted);margin-right:2px">' + unit + '</span>' : '') + '</div>'
    + '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">' + label + '</div>'
    + '</div>';
}

function _msCollectFormData() {
  if (!_msCurrent) return;
  var ms = _msCurrent.ms;
  var f = function(id) { var el = document.getElementById(id); return el ? el.value : null; };
  if (f('ms_month')) ms.month = f('ms_month');
  if (f('ms_city') !== null) ms.city = f('ms_city');
  if (f('ms_startDate') !== null) ms.startDate = f('ms_startDate');
  if (f('ms_endDate') !== null) ms.endDate = f('ms_endDate');
  if (f('ms_note') !== null) ms.note = f('ms_note');
  // collect expense fields live if on expenses tab
  if (_msCurrent.tab === 'expenses') {
    (ms.expenses || []).forEach(function(ex, i) {
      ['title','amount','cat','date','note'].forEach(function(field) {
        // fields are bound via oninput so already current
      });
    });
  }
}

function _msSave(done) {
  if (!_msCurrent) return;
  _msCollectFormData();
  var ms = _msCurrent.ms;
  ms.done = done;
  ensureKPIDB();
  DB.missionLog = DB.missionLog.filter(function(l) { return !(l.userId === ms.userId && l.month === ms.month); });
  DB.missionLog.push(ms);
  saveDB();
  showToast(done ? '✅ ماموریت انجام‌شده ثبت شد' : '⏳ ماموریت برنامه‌ریزی شد');
  closeModal('missionDetailModal');
  if (typeof renderKPIPanel === 'function') renderKPIPanel();
}

function _msDelete() {
  if (!_msCurrent) return;
  var m = _msCurrent;
  ensureKPIDB();
  DB.missionLog = DB.missionLog.filter(function(l) { return !(l.userId === m.userId && l.month === m.month); });
  saveDB();
  showToast('ماموریت حذف شد');
  closeModal('missionDetailModal');
  if (typeof renderKPIPanel === 'function') renderKPIPanel();
}


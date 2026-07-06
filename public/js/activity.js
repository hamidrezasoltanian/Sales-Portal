var _dmFilters = {search: '', status: 'all'};

function openDailyMonitor(){
  if(!_isManager()){showToast('⚠ این بخش فقط برای مدیران است');return;}
  _dmFilters.search = '';
  _dmFilters.status = 'all';
  
  var today = todayStr();
  var body = '<div style="font-size:12px">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;background:var(--bg-raised);padding:8px;border-radius:8px;border:1px solid var(--border)">'
    + '<input type="text" id="dmSearch" placeholder="🔍 جستجو کارشناس یا مرکز..." oninput="_dmFilters.search=this.value;filterDailyMonitor()" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px;min-width:160px">'
    + '<select id="dmStatus" onchange="_dmFilters.status=this.value;filterDailyMonitor()" style="padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px">'
    + '<option value="all">🎯 همه وضعیت‌ها</option>'
    + '<option value="done">✅ انجام شده</option>'
    + '<option value="notdone">❌ انجام نشده</option>'
    + '</select>'
    + '</div>'
    + '<div id="dmModalBody"></div>'
    + '</div>';

  var foot = '<button class="btn-secondary" onclick="closeModal(\'dmModal\')">بستن</button>'
    + '<button class="btn-secondary" onclick="sendReminderToAll()" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">📩 یادآوری به همه</button>'
    + '<button class="btn-primary" onclick="openDailyMonitor()">🔄 بروزرسانی</button>';
    
  openModal('dmModal', '📊 گزارش فعالیت روزانه — ' + today, body, foot, {xl:true});
  filterDailyMonitor();
}

function filterDailyMonitor(){
  _buildPCCache();
  var today = todayStr();
  var todayEntries = [];
  var seenKeys = new Set();

  // 1. Collect week entries scheduled for today
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we = DB.weekEntries[k];
    if(we.rtype==='mtr') return;
    if(we.scheduledDate!==today) return;
    var rtype = we.rtype||'center', rid = we.rid||'';
    var key = rtype+'_'+rid;
    seenKeys.add(key);
    var e = getE(rtype,rid);
    var owner = _wpGetOwner(we);
    var name = we.centerName||getRecLabel(rtype+'_'+rid)||'?';
    var acts = _getTodayActivities(rtype,rid,today);
    var isDone = we.done||acts.length>0;
    todayEntries.push({key:k,rtype:rtype,rid:rid,name:name,owner:owner,actType:we.actionType||'call',status:e.status||'بدون تماس',activities:acts,done:isDone});
  });

  // 2. Collect centers where followupDate === today (not already seen)
  getAllProvinces().forEach(function(p) {
    getProvCenters(p.id).forEach(function(c) {
      var e = getE(c.rtype,c.id);
      var owner = e.owner||c.owner||'';
      if(!owner) return;
      if(e.followupDate===today) {
        var key = c.rtype+'_'+c.id;
        if(!seenKeys.has(key)) {
          seenKeys.add(key);
          var acts = _getTodayActivities(c.rtype,c.id,today);
          var isDone = acts.length>0||(e.status==='قرارداد بسته شد'||e.status==='غیرفعال');
          todayEntries.push({
            key: 'followup_'+key,
            rtype: c.rtype,
            rid: c.id,
            name: e.nameOverride||c.name||'?',
            owner: owner,
            actType: 'call',
            status: e.status||'بدون تماس',
            activities: acts,
            done: isDone
          });
        }
      }
    });
  });

  var searchQ = fNorm(_dmFilters.search || '');
  var statusFilter = _dmFilters.status;

  var filteredEntries = todayEntries.filter(function(en) {
    var expertName = en.owner === '__none__' ? 'بدون مسئول' : (USERS[en.owner] || en.owner || '');
    if (searchQ) {
      var match = fNorm(en.name).indexOf(searchQ) >= 0 || fNorm(expertName).indexOf(searchQ) >= 0;
      if (!match) return false;
    }
    if (statusFilter === 'done' && !en.done) return false;
    if (statusFilter === 'notdone' && en.done) return false;
    return true;
  });

  var totalScheduled = todayEntries.length;
  var totalDone = todayEntries.filter(function(en){return en.done;}).length;
  var totalNotDone = totalScheduled - totalDone;
  var pct = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

  var html = '<div style="background:var(--bg-raised);border-radius:10px;padding:14px;margin-bottom:16px">'
    + '<div style="font-weight:700;font-size:13px;margin-bottom:10px">📊 خلاصه امروز — ' + today + '</div>'
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">' + totalScheduled + '</div><div style="font-size:11px;color:#166534">برنامه‌ریزی امروز</div></div>'
    + '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">' + totalDone + '</div><div style="font-size:11px;color:#166534">انجام شده ✔</div></div>'
    + '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#dc2626">' + totalNotDone + '</div><div style="font-size:11px;color:#991b1b">انجام نشده ✖</div></div>'
    + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 16px;text-align:center"><div style="font-size:20px;font-weight:800;color:#1d4ed8">' + pct + '%</div><div style="font-size:11px;color:#1e40af">درصد انجام</div></div>'
    + '</div>'
    + '<div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden">'
    + '<div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:' + pct + '%;transition:width .4s"></div>'
    + '</div>'
    + '</div>';

  var byOwner = {};
  todayEntries.forEach(function(en){
    var o = en.owner || '__none__';
    if(!byOwner[o]) byOwner[o] = [];
    byOwner[o].push(en);
  });

  var overdueByOwner = {};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we = DB.weekEntries[k];
    if(we.done || we.rtype === 'mtr') return;
    if(!we.scheduledDate || we.scheduledDate >= today) return;
    var owner = _wpGetOwner(we);
    if(!owner) return;
    var acts = _getActivitiesOnDate(we.rtype||'center', we.rid||'', we.scheduledDate);
    if(acts.length > 0) return;
    if(!overdueByOwner[owner]) overdueByOwner[owner] = [];
    overdueByOwner[owner].push({name: we.centerName||getRecLabel((we.rtype||'center')+'_'+(we.rid||'')), date: we.scheduledDate});
  });

  var allMem = (DB.settings && DB.settings.members) || _DEFAULT_MEMBERS;
  var activeExperts = allMem.filter(function(m){return m.role !== 'manager';});

  html += '<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:16px">'
    + '<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">👥 عملکرد کارشناسان</div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--bg-raised)">'
    + '<th style="padding:8px 10px;text-align:right">کارشناس</th>'
    + '<th style="padding:8px 10px;text-align:center">گزارش</th>'
    + '<th style="padding:8px 10px;text-align:center">برنامه امروز</th>'
    + '<th style="padding:8px 10px;text-align:center;color:#16a34a">انجام شده</th>'
    + '<th style="padding:8px 10px;text-align:center;color:#dc2626">انجام نشده</th>'
    + '<th style="padding:8px 10px;text-align:center;color:#f59e0b">سررسید گذشته</th>'
    + '<th style="padding:8px 10px;text-align:center">اقدام</th>'
    + '</tr></thead><tbody>';

  activeExperts.forEach(function(m, idx) {
    var ow = m.id;
    var entries = byOwner[ow] || [];
    var owName = m.name;
    var owDone = entries.filter(function(en){return en.done;}).length;
    var owNotDone = entries.length - owDone;
    var owOverdue = (overdueByOwner[ow] || []).length;
    var owColor = (window.umGetColor ? umGetColor(ow) : '#94a3b8');
    var bg = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)';
    
    html += '<tr style="background:' + bg + ';border-bottom:1px solid #f1f5f9">'
      + '<td style="padding:8px 10px;font-weight:600"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + owColor + '"></span>' + esc(owName) + '</span></td>'
      + '<td style="padding:8px 10px;text-align:center">'
      + '<button onclick="event.stopPropagation();openExpertReport(\'' + ow + '\')" style="font-size:10px;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-family:inherit">📊 گزارش</button>'
      + '</td>'
      + '<td style="text-align:center;padding:8px">' + (entries.length > 0 ? entries.length : '<span style="color:var(--text-muted)">بدون برنامه</span>') + '</td>'
      + '<td style="text-align:center;padding:8px"><span style="background:#dcfce7;color:#166534;border-radius:10px;padding:2px 8px;font-weight:700">' + owDone + '</span></td>'
      + '<td style="text-align:center;padding:8px"><span style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:2px 8px;font-weight:700">' + owNotDone + '</span></td>'
      + '<td style="text-align:center;padding:8px"><span style="background:#fef3c7;color:#92400e;border-radius:10px;padding:2px 8px;font-weight:700">' + owOverdue + '</span></td>'
      + '<td style="text-align:center;padding:8px">'
      + (owNotDone > 0 ? '<button onclick="sendReminderToExpert(\'' + ow + '\')" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:10px;font-family:inherit">📩 یادآوری</button>' : '<span style="color:var(--text-muted);font-size:11px">✔ کامل</span>')
      + '</td>'
      + '</tr>';
  });
  html += '</tbody></table></div></div>';

  html += '<div style="font-weight:700;font-size:13px;margin-bottom:8px">📍 جزئیات مراکز</div>';
  
  var filteredByOwner = {};
  filteredEntries.forEach(function(en){
    var o = en.owner || '__none__';
    if(!filteredByOwner[o]) filteredByOwner[o] = [];
    filteredByOwner[o].push(en);
  });

  var displayedDetails = 0;
  Object.keys(filteredByOwner).sort().forEach(function(ow){
    var entries = filteredByOwner[ow];
    if(!entries.length) return;
    displayedDetails++;
    
    var mObj = allMem.find(function(x){return x.id === ow;});
    var owName = mObj ? mObj.name : (ow === '__none__' ? 'بدون مسئول' : ow);
    var owColor = (window.umGetColor ? umGetColor(ow) : '#94a3b8');
    var sectionId = 'dm_sec_' + ow.replace(/[^a-z0-9]/gi, '_');
    
    html += '<div style="background:var(--bg-card);border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.05);margin-bottom:8px;overflow:hidden">'
      + '<div onclick="var el=document.getElementById(\'' + sectionId + '\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" '
      + 'style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">'
      + '<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + owColor + '"></span>'
      + '<span style="font-weight:700;font-size:13px">' + esc(owName) + '</span>'
      + '<span style="font-size:11px;color:var(--text-muted);margin-right:auto">' + entries.length + ' مرکز — کلیک برای باز/بسته</span>'
      + '</div>'
      + '<div id="' + sectionId + '" style="display:block;padding:8px">';
    
    entries.forEach(function(en){
      var icon = en.done ? '✅' : '🔴';
      var actTypeLabel = en.actType === 'visit' ? '🤝 ویزیت' : '📞 تماس';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--border);font-size:12px">'
        + '<span style="font-size:16px">' + icon + '</span>'
        + '<span style="flex:1"><a href="#" onclick="closeModal(\'dmModal\');openCenterModal(\''+en.rtype+'\',\''+en.rid+'\');return false;" style="color:#2563eb;text-decoration:none;font-weight:600">' + esc(en.name) + '</a></span>'
        + '<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:8px;border:1px solid #7dd3fc">' + actTypeLabel + '</span>'
        + '<span style="font-size:10px;color:var(--text-muted)">' + esc(en.status) + '</span>'
        + '</div>';
    });
    html += '</div></div>';
  });

  if (displayedDetails === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-muted)">🔍 موردی یافت نشد.</div>';
  }

  var container = document.getElementById('dmModalBody');
  if(container) container.innerHTML = html;
}

function sendReminderToAll(){
  var today=todayStr();
  _buildPCCache();
  var experts={};
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done||we.scheduledDate!==today||we.rtype==='mtr')return;
    var rtype=we.rtype||'center',rid=we.rid||'';
    var owner=_wpGetOwner(we);
    if(!owner)return;
    var acts=_getTodayActivities(rtype,rid,today);
    if(acts.length>0)return;
    if(!experts[owner])experts[owner]=[];
    experts[owner].push(we.centerName||getRecLabel(rtype+'_'+rid)||'?');
  });
  var cnt=0;
  Object.keys(experts).forEach(function(exp){
    var names=experts[exp];
    if(!names.length)return;
    cnt++;
    var msg='📋 برنامه امروز: '+names.length+' مرکز برای بازدید دارید:\n• '
      +names.slice(0,5).join('\n• ')
      +(names.length>5?'\nو '+(names.length-5)+' مورد دیگر':'')
      +'\nوارد برنامه هفته شوید.';
    sendNotif(exp,msg,'');
  });
  if(cnt>0)showToast('🔔 یادآوری برای '+cnt+' کارشناس ارسال شد',3000);
  else showToast('✅ همه کارشناسان گزارش داده‌اند');
}

function _getTodayActivities(rtype,rid,today){
  var rkey=rtype+'_'+rid;
  var log=DB.changeLog||[];
  return log.filter(function(l){
    if(l.rkey!==rkey)return false;
    if(!l.at)return false;
    var d=l.at.slice(0,10);
    var parts=d.split('-').map(Number);
    if(parts.length!==3)return false;
    var jd=g2j(parts[0],parts[1],parts[2]);
    var jdStr=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
    return jdStr===today;
  });
}

function _fieldLabel(field){
  var map={status:'وضعیت',lead:'سرنخ',potential:'فرصت',followupDate:'تاریخ پیگیری',owner:'مسئول',tags:'برچسب',notes:'یادداشت',contacts:'تماس'};
  return map[field]||field;
}

function sendReminderToExpert(expertUser){
  var today=todayStr();
  var noActEntries=[];
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.done||we.scheduledDate!==today||we.rtype==='mtr')return;
    var rtype=we.rtype||'center',rid=we.rid||'';
    var e=getE(rtype,rid);
    var owner=e.owner||'';
    if(!owner){
      if(rtype==='center'){var c=CENTERS.find(function(x){return x.id===rid;});if(c&&c.owner)owner=c.owner;}
      else{_buildPCCache();var _pId=rid.split('||')[0];var _arr=_PC_CACHE[_pId]||[];var _c=_arr.find(function(x){return x.id===rid;});if(_c&&_c.owner)owner=_c.owner;}
    }
    if(owner!==expertUser)return;
    var acts=_getTodayActivities(rtype,rid,today);
    if(acts.length===0)noActEntries.push(we.centerName||getRecLabel(rtype+'_'+rid)||'?');
  });
  if(!noActEntries.length){showToast('✅ این کارشناس برای همه مراکز گزارش داده است');return;}
  var msg='لطفاً برای مراکز زیر که امروز برنامه دارید گزارش وارد کنید: '+noActEntries.slice(0,5).join('، ')+(noActEntries.length>5?' و '+(noActEntries.length-5)+' مرکز دیگر':'');
  sendNotif(expertUser,msg,'');
}




// ════════════════════════ CHANGE LOG PAGE ════════════════════
var _clFilters = {date:'today', owner:'', search:'', field:''};
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
    + '<select class="cl-filter" onchange="_clFilters.date=this.value;renderChangelog()">'
    + '<option value="today"'+(  _clFilters.date==='today'?' selected':'')+'>امروز</option>'
    + '<option value="week"'+(_clFilters.date==='week'?' selected':'')+'>۷ روز اخیر</option>'
    + '<option value="month"'+(_clFilters.date==='month'?' selected':'')+'>این ماه</option>'
    + '<option value="all"'+(_clFilters.date==='all'?' selected':'')+'>همه</option>'
    + '</select>'
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

  // auto-refresh every 30s
  clearTimeout(_clAutoRefreshTimer);
  if(currentTab === 'changelog'){
    _clAutoRefreshTimer = setTimeout(function(){if(currentTab==='changelog')renderChangelog();}, 30000);
  }
}


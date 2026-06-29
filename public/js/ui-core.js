/* ═══ public/js/ui-core.js ═══ */
// ════════════════════════ UI FLASH / TOAST ════════════
function flashRow(id){
  var r=document.querySelector('[data-rowid="'+id+'"]');
  if(r){r.classList.remove('row-flash-ok');void r.offsetWidth;r.classList.add('row-flash-ok');}
}
var _toastTimer=null;
function showToast(msg,dur){
  var t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){t.classList.remove('show');},dur||2500);
}

// ════════════════════════ USER ═════════════════════════
function onUserChange(u){
  currentUser=u;DB._lastUser=u;saveDB();
  var _dot=document.getElementById('uSelDot');
  if(_dot&&typeof umGetColor!=='undefined')_dot.style.background=umGetColor(u);
  // تغییر کاربر = تغییر هویت، نه فیلتر — داده‌ها محو نمی‌شوند
  // برای فیلتر از fOwner در نوار فیلتر استفاده کنید
  renderDashboard();renderBanner();
  if(currentTab==='provinces'||currentTab==='province_view')renderTable();
  else if(currentTab==='checklist')renderChecklist();
  updateNotifBadge();
}

// ════════════════════════ TAB SWITCH ══════════════════
function switchTab(tab){
  if(tab!=='provinces')_currentProvId=null;
  currentTab=tab;
  try{localStorage.setItem('_st',tab);}catch(e){}
  _navPush(tab, null);
  ['home','provinces','weekplan','calendar','checklist','activity','changelog','tasks','manager','kpi','mtr','pricing','proforma','reports','hcp'].forEach(function(t){
    var b=document.getElementById('tab_'+t);if(b)b.classList.toggle('active',t===tab);
  });
  document.getElementById('dash').style.display=(tab==='provinces')?'':'none';
  var _hp=document.getElementById('homePanel');if(_hp)_hp.style.display=(tab==='home')?'':'none';
  if(tab==='home'&&typeof renderExpertDashboard==='function')renderExpertDashboard();
  var _udp=document.getElementById('userDashPanel');if(_udp)_udp.style.display=(tab==='provinces')?'':'none';
  document.getElementById('banner').style.display='none';
  document.getElementById('filtersBar').style.display=(tab==='provinces')?'flex':'none';
  document.getElementById('tableArea').style.display=(tab==='provinces')?'':'none';
  document.getElementById('wpPanel').style.display=(tab==='weekplan')?'':'none';
  var _clp=document.getElementById('changelogPanel');if(_clp)_clp.style.display=(tab==='changelog')?'':'none';
  var _tp=document.getElementById('tasksPanel');if(_tp)_tp.style.display=(tab==='tasks')?'':'none';
  document.getElementById('calPanel').style.display=(tab==='calendar')?'':'none';
  document.getElementById('ckPanel').style.display=(tab==='checklist')?'':'none';
  document.getElementById('actPanel').style.display=(tab==='activity')?'':'none';
  var mp=document.getElementById('managerPanel');if(mp)mp.style.display=(tab==='manager')?'':'none';
  var kp=document.getElementById('kpiPanel');if(kp)kp.style.display=(tab==='kpi')?'':'none';
  var mtrp=document.getElementById('mtrPanel');if(mtrp)mtrp.style.display=(tab==='mtr')?'':'none';
  var pricingP=document.getElementById('pricingPanel');if(pricingP)pricingP.style.display=(tab==='pricing')?'':'none';
  var pfPanel=document.getElementById('proformaPanel');if(pfPanel)pfPanel.style.display=(tab==='proforma')?'':'none';
  if(tab==='mtr'&&typeof mtrLazyInit==='function')mtrLazyInit();
  if(tab==='pricing'&&typeof pricingLazyInit==='function')pricingLazyInit();
  if(tab==='proforma'){if(window._pfVueRefresh)window._pfVueRefresh();else if(typeof renderProformaPanel==='function')renderProformaPanel();}
  var hcpP=document.getElementById('hcpPanel');if(hcpP)hcpP.style.display=(tab==='hcp')?'':'none';
  if(tab==='hcp'&&typeof renderHCPPanel==='function')renderHCPPanel();
  var spPanel=document.getElementById('supportPanel');if(spPanel)spPanel.style.display=(tab==='support')?'':'none';
  var hrPanel=document.getElementById('hrPanel');if(hrPanel)hrPanel.style.display=(tab==='hr')?'':'none';
  if(tab==='support'&&typeof renderSupportPanel==='function')renderSupportPanel();
  if(tab==='hr'&&typeof renderHRPanel==='function')renderHRPanel();
  var tradeKPIPanel=document.getElementById('tradeKPIPanel');if(tradeKPIPanel)tradeKPIPanel.style.display=(tab==='trade-kpi')?'':'none';
  if(tab==='trade-kpi'&&typeof renderTradeKPIPanel==='function')renderTradeKPIPanel();
  var reportsPanel=document.getElementById('reportsPanel');if(reportsPanel)reportsPanel.style.display=(tab==='reports')?'':'none';
  if(tab==='reports'&&typeof renderReportsPanel==='function')renderReportsPanel();
  var _wpp=document.getElementById('weekPlannerPanel');if(_wpp)_wpp.style.display=(tab==='week-planner')?'':'none';
  if(tab==='week-planner'&&typeof renderWeekPlannerPanel==='function')renderWeekPlannerPanel();
  var _fmp=document.getElementById('faradisMatchPanel');if(_fmp)_fmp.style.display=(tab==='faradis-match')?'':'none';
  if(tab==='faradis-match'&&typeof renderFaradisMatchPanel==='function')renderFaradisMatchPanel();
  // update mobile nav
  (function(){document.querySelectorAll('.mob-tab').forEach(function(btn){var fn=btn.getAttribute('onclick')||'';var m=fn.match(/switchTab\('([^']+)'\)/);if(m)btn.classList.toggle('active',m[1]===tab);});})();
  function _safeRender(fn, tabName) {
    try { fn(); } catch(err) {
      console.error('[switchTab] خطا در رندر تب '+tabName+':', err);
      var panel = document.getElementById(tabName+'Panel') || document.getElementById('dash');
      if(panel) panel.innerHTML = '<div style="padding:32px;text-align:center;color:#ef4444;font-size:14px">⚠ خطا در بارگذاری این بخش — لطفاً صفحه را رفرش کنید<br><small style="color:#94a3b8;font-size:11px">' + esc(err.message||String(err)) + '</small></div>';
    }
  }
  if(tab==='provinces'){
    _safeRender(function(){renderDashboard();renderBanner();},'provinces');
    if(!_currentProvId){
      var toShow=['srch','fOwner','lblOw','fType','fTag','lblTg','provSortSel'];
      toShow.forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
      if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
      var pg=document.getElementById('allCentersToggle');if(pg)pg.style.display='';
    } else {
      // restore province view UI if navigated back or refreshed with _currentProvId set
      var _act=document.getElementById('allCentersToggle');if(_act)_act.style.display='none';
      var _pb=document.getElementById('provBackBtn');if(_pb)_pb.style.display='';
      var _ab=document.getElementById('addCenterBtn');if(_ab)_ab.style.display='';
      var _hd=document.getElementById('provViewHead');
      if(_hd&&!_hd.textContent){var _pv=getAllProvinces().find(function(p){return p.id===_currentProvId;});_hd.textContent='🏥 مراکز '+(_pv?_pv.name:_currentProvId);}
      ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','fType','lblTp','viewSw','csvBtn','printBtn','xlsBtn','savePresetBtn','sortSel'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
      if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
      var _qf=document.getElementById('quickFilters');if(_qf)_qf.style.display='flex';
    }
    _safeRender(renderTable,'provinces');
  }
  else if(tab==='weekplan'){var _dmb=document.getElementById('wpDailyMonBtn');if(_dmb)_dmb.style.display=_isManager()?'':'none';_safeRender(renderWeekPlan,'weekplan');}
  else if(tab==='calendar')_safeRender(renderCalendar,'cal');
  else if(tab==='checklist')_safeRender(renderChecklist,'ck');
  else if(tab==='activity'){_actPage=0;_safeRender(renderActivity,'act');}
  else if(tab==='changelog')_safeRender(renderChangelog,'changelog');
  else if(tab==='tasks')_safeRender(renderTasksPanel,'tasks');
  else if(tab==='manager')_safeRender(renderManagerPanel,'manager');
  else if(tab==='kpi')_safeRender(renderKPIPanel,'kpi');
  else if(tab==='home')_safeRender(renderHome,'home');
  var _clBtn=document.getElementById('tab_changelog');if(_clBtn)_clBtn.style.display=_isManager()?'':'none';
  var _tBtn=document.getElementById('tab_tasks');if(_tBtn)_tBtn.style.display='';
  // Show tab tutorial for new users
  setTimeout(function(){_showTabTutorial(tab);},400);
}

// ════════════════════════ PROVINCE VIEW ═══════════════
function openProvince(provId){
  _currentProvId=provId;
  try{localStorage.setItem('_spid',provId);}catch(e){}
  _navPush('provinces', provId);
  currentTab='provinces';
  var prov=getAllProvinces().find(function(p){return p.id===provId;});
  var provName=prov?prov.name:provId;
  var hd=document.getElementById('provViewHead');
  if(hd)hd.textContent='🏥 مراکز '+provName;
  var act=document.getElementById('allCentersToggle');if(act)act.style.display='none';
  document.getElementById('dash').style.display='none';
  document.getElementById('banner').style.display='none';
  var _udp=document.getElementById('userDashPanel');if(_udp)_udp.style.display='none';
  window.scrollTo(0,0);
  document.getElementById('filtersBar').style.display='flex';
  document.getElementById('tableArea').style.display='';
  // مطمئن شو table-wrap مخفی نیست
  var tw=document.querySelector('.table-wrap');if(tw)tw.style.display='';
  var emsg=document.getElementById('emptyDBMsg');if(emsg)emsg.style.display='none';
  var pb=document.getElementById('provBackBtn');if(pb)pb.style.display='';
  var ab=document.getElementById('addCenterBtn');if(ab)ab.style.display='';
  // نمایش filter controls
  ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','fType','lblTp','viewSw','csvBtn','printBtn','xlsBtn','savePresetBtn','sortSel'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='';
  });
  if(_isExpert()){['fOwner','lblOw'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
  var qf=document.getElementById('quickFilters');if(qf)qf.style.display='flex';
  ['srch','fPot','fStatus','fLead','fOwner','fTag'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  // On tablet: collapse filter section by default, show toggle button
  var _ftb=document.getElementById('filterToggleBtn');var _fcol=document.getElementById('filterCollapsible');
  if(window.innerWidth<=900){if(_ftb)_ftb.style.display='block';if(_fcol){_fcol.style.display='none';if(_ftb)_ftb.textContent='🔽 فیلترها';}}
  else{if(_ftb)_ftb.style.display='none';if(_fcol)_fcol.style.display='contents';}
  rebuildFilters();
  renderProvTable();
}

function toggleFiltersCollapse(){
  var col=document.getElementById('filterCollapsible');
  var btn=document.getElementById('filterToggleBtn');
  if(!col)return;
  var hidden=col.style.display==='none';
  col.style.display=hidden?'contents':'none';
  if(btn)btn.textContent=hidden?'🔼 فیلترها':'🔽 فیلترها';
}
function backToProvinces(){
  _currentProvId=null;
  try{localStorage.removeItem('_spid');}catch(e){}
  currentTab='provinces';
  var pb=document.getElementById('provBackBtn');if(pb)pb.style.display='none';
  var ab=document.getElementById('addCenterBtn');if(ab)ab.style.display='none';
  var hd=document.getElementById('provViewHead');if(hd)hd.textContent='';
  ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','viewSw','csvBtn','printBtn','hardToggleBtn','xlsBtn','savePresetBtn','filterPresetSel','sortSel','provSortSel'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  var qf=document.getElementById('quickFilters');if(qf)qf.style.display='none';
  var sb=document.getElementById('centerStatsBar');if(sb)sb.style.display='none';
  _quickFilter='';_globalOwnerFilter='';_selectedCenters=new Set();
  var bar=document.getElementById('centersBulkBar');if(bar)bar.classList.remove('active');
  // reset view
  _viewMode='list';
  // allCentersToggle را نمایش بده
  var act=document.getElementById('allCentersToggle');if(act)act.style.display='';
  switchTab('provinces');
}


// ════════════════════════ BROWSER HISTORY NAVIGATION ══════════════
var _navReady = false;   // set true after init completes
var _poppingState = false; // suppress pushState during popstate handling

function _navPush(tab, provId) {
  if (!_navReady || _poppingState) return;
  try {
    history.pushState({v:1, tab:tab, provId:provId||null}, '',
      window.location.pathname + window.location.search);
  } catch(e) {}
}

// دکمه بازگشت برنامه — اگر تاریخچه مرورگر وجود دارد از آن استفاده می‌کند
function appBack() {
  if (_navReady && window.history.length > 1) {
    history.back();
  } else {
    backToProvinces();
  }
}

window.addEventListener('popstate', function(e) {
  if (!_navReady) return;
  var state = e.state;
  _poppingState = true;
  try {
    if (!state || !state.v) {
      // بدون state — برگشت به لیست استان‌ها
      if (_currentProvId) backToProvinces();
      else switchTab('provinces');
    } else if (state.provId) {
      // بازگشت به نمای استان
      openProvince(state.provId);
    } else {
      // بازگشت به تب
      if (state.tab === 'provinces' && _currentProvId) backToProvinces();
      else switchTab(state.tab || 'provinces');
    }
  } catch(e2) { console.error('[nav] popstate error:', e2); }
  _poppingState = false;
});


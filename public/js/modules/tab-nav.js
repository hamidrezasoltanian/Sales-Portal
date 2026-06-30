'use strict';
// tab-nav.js — Tab navigation and province view routing (copied from app.js)
// Functions: onUserChange, switchTab, openProvince, backToProvinces, _navPush, appBack

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
  ['home','provinces','weekplan','calendar','checklist','activity','changelog','tasks','manager','kpi','mtr','pricing','proforma','letters'].forEach(function(t){
    var b=document.getElementById('tab_'+t);if(b)b.classList.toggle('active',t===tab);
  });
  document.getElementById('dash').style.display=(tab==='provinces')?'':'none';
  var _hp=document.getElementById('homePanel');if(_hp)_hp.style.display=(tab==='home')?'':'none';
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
  var lettersP=document.getElementById('lettersPanel');if(lettersP)lettersP.style.display=(tab==='letters')?'':'none';
  if(tab==='mtr'&&typeof mtrLazyInit==='function')mtrLazyInit();
  if(tab==='pricing'&&typeof pricingLazyInit==='function')pricingLazyInit();
  if(tab==='proforma'){if(window._pfVueRefresh)window._pfVueRefresh();else if(typeof renderProformaPanel==='function')renderProformaPanel();}
  if(tab==='letters'&&typeof window._lettersVueLoad==='function')window._lettersVueLoad();
  // update mobile nav
  (function(){var tabs=['home','provinces','weekplan','calendar','checklist','activity','mtr'];document.querySelectorAll('.mob-tab').forEach(function(btn,i){btn.classList.toggle('active',tabs[i]===tab);});})();
  if(tab==='provinces'){
    renderDashboard();renderBanner();
    if(!_currentProvId){
      var toShow=['srch','fOwner','lblOw','fType','fTag','lblTg'];
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
    renderTable();
  }
  else if(tab==='weekplan'){var _dmb=document.getElementById('wpDailyMonBtn');if(_dmb)_dmb.style.display=_isManager()?'':'none';renderWeekPlan();}
  else if(tab==='calendar')renderCalendar();
  else if(tab==='checklist')renderChecklist();
  else if(tab==='activity'){_actPage=0;renderActivity();}
  else if(tab==='changelog')renderChangelog();
  else if(tab==='tasks')renderTasksPanel();
  else if(tab==='manager')renderManagerPanel();
  else if(tab==='kpi')renderKPIPanel();
  else if(tab==='home')renderHome();
  var _clBtn=document.getElementById('tab_changelog');if(_clBtn)_clBtn.style.display=_isManager()?'':'none';
  var _tBtn=document.getElementById('tab_tasks');if(_tBtn)_tBtn.style.display='';
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
  rebuildFilters();
  renderProvTable();
}

function backToProvinces(){
  _currentProvId=null;
  try{localStorage.removeItem('_spid');}catch(e){}
  currentTab='provinces';
  var pb=document.getElementById('provBackBtn');if(pb)pb.style.display='none';
  var ab=document.getElementById('addCenterBtn');if(ab)ab.style.display='none';
  var hd=document.getElementById('provViewHead');if(hd)hd.textContent='';
  ['srch','fPot','lblPot','fStatus','lblSt','fLead','lblLd','fOwner','lblOw','fTag','lblTg','viewSw','csvBtn','printBtn','hardToggleBtn','xlsBtn','savePresetBtn','filterPresetSel','sortSel'].forEach(function(id){
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


'use strict';
// notifications.js — In-app notification system (copied from app.js)
// Functions: _initNotif, _initBrowserNotif, sendNotif, toggleNotifPanel,
//   markNotifRead, markAllNotifsRead, _timeAgo

// ════════════════════════ NOTIFICATIONS ════════════════════
function _initNotif(){if(!DB.notifications)DB.notifications=[];}

// ── Browser Push Notifications ──────────────────────────────────────────────
var _pushGranted = false;

function _initBrowserNotif(){
  if(!('Notification' in window))return;
  if(Notification.permission==='granted'){_pushGranted=true;return;}
  if(Notification.permission==='denied')return;
  // Ask on first meaningful interaction (call from init after small delay)
  setTimeout(function(){
    Notification.requestPermission().then(function(p){
      _pushGranted=(p==='granted');
      if(_pushGranted)_firePushNotif('Flow CRM','اعلان‌های مرورگر فعال شد ✅');
    });
  },3000);
}

function _firePushNotif(title,body,tag){
  if(!_pushGranted||!('Notification' in window))return;
  try{
    var n=new Notification(title,{
      body:body,
      tag:tag||'flow-crm',
      icon:'/favicon.ico',
      dir:'rtl',
      lang:'fa'
    });
    setTimeout(function(){n.close();},8000);
    return n;
  }catch(e){}
}

function _sendOverduePushNotifs(){
  if(!_pushGranted)return;
  var items=getFollowups();
  var mine=_isExpert()?items.filter(function(i){return i.owner===currentUser;}):items;
  var overdue=mine.filter(function(i){return i.overdue;});
  if(!overdue.length)return;
  // Group message
  var msg=overdue.length+' مرکز معوق پیگیری دارند';
  if(overdue.length<=3){
    msg=overdue.map(function(i){return i.name;}).join('، ')+' — پیگیری نشده';
  }
  _firePushNotif('⚠ پیگیری‌های معوق',msg,'overdue-reminder');
}

// Periodic check: fire push if tab becomes visible after being hidden
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&_pushGranted){
    setTimeout(_sendOverduePushNotifs,2000);
  }
});

function sendNotif(toUser,message,centerKey,centerKeys){
  _initNotif();
  var n={id:Date.now()+'_'+Math.random().toString(36).slice(2),to:toUser,from:currentUser,at:new Date().toISOString(),message:message,centerKey:centerKey||'',centerKeys:centerKeys||null,read:false};
  DB.notifications.push(n);
  if(DB.notifications.length>300)DB.notifications=DB.notifications.slice(-300);
  saveDB();
  updateNotifBadge();
  showToast('\u{1F4E9} اعلان برای '+(USERS[toUser]||toUser)+' ارسال شد',2000);
}

function updateNotifBadge(){
  _initNotif();
  var unread=DB.notifications.filter(function(n){return n.to===currentUser&&!n.read;}).length;
  var badge=document.getElementById('notifBadge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'flex':'none';}
}

var _notifPanelOpen=false;
var _notifViewAll=false;
function setNotifView(all){
  _notifViewAll=!!all;
  var p=document.getElementById('notifPanel');
  if(p){p.remove();_notifPanelOpen=false;}
  toggleNotifPanel();
}
function toggleNotifPanel(){
  var existing=document.getElementById('notifPanel');
  if(existing){existing.remove();_notifPanelOpen=false;return;}
  _notifPanelOpen=true;
  _initNotif();
  var viewAll=_notifViewAll&&_isManager();
  var myNotifs=(viewAll
    ?DB.notifications.slice()
    :DB.notifications.filter(function(n){return n.to===currentUser;})
  ).slice().reverse().slice(0,100);
  var panel=document.createElement('div');
  panel.id='notifPanel';panel.className='notif-panel';
  var unreadIds=viewAll?[]:myNotifs.filter(function(n){return !n.read;}).map(function(n){return n.id;});
  var _tglBtn='';
  if(_isManager()){
    _tglBtn='<span style="display:inline-flex;gap:2px;background:var(--bg-raised);border-radius:6px;padding:2px;border:1px solid var(--border)">'
      +'<button onclick="setNotifView(false)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:'+(viewAll?'transparent':'var(--brand,#6366f1)')+';color:'+(viewAll?'var(--text-secondary)':'#fff')+'">من</button>'
      +'<button onclick="setNotifView(true)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:'+(viewAll?'var(--brand,#6366f1)':'transparent')+';color:'+(viewAll?'#fff':'var(--text-secondary)')+'">همه</button>'
      +'</span>';
  }
  var head='<div class="notif-panel-head"><span>🔔 '+(viewAll?'همه اعلان‌ها':'اعلان‌های من')+'</span>'
    +'<span style="display:inline-flex;gap:6px;align-items:center">'
    +_tglBtn
    +(unreadIds.length?'<button onclick="markAllNotifsRead()" style="font-size:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">همه خوانده شد</button>':'')
    +'</span>'
    +'</div>';
  var body='';
  if(!myNotifs.length){
    body='<div class="notif-empty">اعلانی وجود ندارد</div>';
  } else {
    body=myNotifs.map(function(n){
      var timeAgo=_timeAgo(n.at);
      var nid=n.id;
      var hasCk=n.centerKey&&n.centerKey.indexOf('_')>0;
      var hasMultiCk=n.centerKeys&&n.centerKeys.length>1;
      var ckParts=hasCk?n.centerKey.split('_'):[];
      var ckRtype=ckParts[0]||'';var ckRid=ckParts.slice(1).join('_');
      var cName=hasCk?_clGetName(n.centerKey):'';
      return '<div class="notif-item'+(n.read?'':' unread')+(n.ack?' notif-acked':'')+'" data-nid="'+nid+'">'
        +'<div class="notif-item-msg">'+esc(n.message)+'</div>'
        +((hasCk||hasMultiCk)?'<div class="notif-item-center">📍 <span class="notif-center-link" onclick="goToNotifCenter(\''+nid+'\')">'+( hasMultiCk?(n.centerKeys.length+' مرکز'):esc(cName))+'</span></div>':'')
        +'<div class="notif-item-actions">'
        +((hasCk||hasMultiCk)?'<button class="notif-act-btn" onclick="goToNotifCenter(\''+nid+'\')">🔍 '+(hasMultiCk?'مشاهده مراکز':'مشاهده مرکز')+'</button>':'')
        +(viewAll
          ?(n.ack?'<span class="notif-ack-badge">✓ تأیید شده</span>':'')
          :(n.ack
            ?'<span class="notif-ack-badge">✓ تأیید شده</span>'
            :'<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\''+nid+'\')">✓ انجام دادم</button>'))
        +'</div>'
        +'<div class="notif-item-time">'+(viewAll?'به: <b>'+esc(USERS[n.to]||n.to)+'</b> · ':'')+'از: '+(USERS[n.from]||n.from)+' · '+timeAgo+(viewAll&&!n.read?' · <span style="color:#f59e0b">خوانده نشده</span>':'')+'</div>'
        +'</div>';
    }).join('');
  }
  panel.innerHTML=head+'<div class="notif-body-scroll">'+body+'</div>';
  document.body.appendChild(panel);
  setTimeout(function(){
    if(viewAll)return; // در نمای «همه»، اعلان‌های دیگران خوانده نمی‌شود
    unreadIds.forEach(function(id){
      var nx=DB.notifications.find(function(x){return x.id===id;});
      if(nx)nx.read=true;
    });
    saveDB();updateNotifBadge();
    var p=document.getElementById('notifPanel');
    if(p)p.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});
  },2000);
  setTimeout(function(){
    document.addEventListener('click',function _nClose(ev){
      var p=document.getElementById('notifPanel');
      var bell=document.getElementById('notifBell');
      if(p&&!p.contains(ev.target)&&ev.target!==bell&&!bell.contains(ev.target)){p.remove();_notifPanelOpen=false;}
      document.removeEventListener('click',_nClose);
    });
  },100);
}

function goToNotifCenter(nid){
  _initNotif();
  var n=DB.notifications.find(function(x){return x.id===nid;});
  if(!n||(!(n.centerKey&&n.centerKey.indexOf('_')>0)&&!(n.centerKeys&&n.centerKeys.length)))return;
  markNotifRead(nid);
  var p=document.getElementById('notifPanel');if(p)p.remove();_notifPanelOpen=false;
  var keys=n.centerKeys&&n.centerKeys.length?n.centerKeys:[n.centerKey];
  if(keys.length===1){
    var parts=keys[0].split('_');var rtype=parts[0];var rid=parts.slice(1).join('_');
    setTimeout(function(){openCenterModal(rtype,rid);},100);
    return;
  }
  // multiple centers: show list modal
  var listHtml='<div style="display:flex;flex-direction:column;gap:6px;padding:4px 0">';
  keys.forEach(function(ck){
    var cname=_clGetName(ck);
    var cparts=ck.split('_');var crt=cparts[0];var crid=cparts.slice(1).join('_');
    listHtml+='<button onclick="closeModal(\'notifCkList\');if(currentTab!==\'provinces\'&&currentTab!==\'weekplan\')switchTab(\'provinces\');setTimeout(function(){openCenterModal(\''+crt+'\',\''+crid+'\');},150)" style="text-align:right;padding:8px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer">'+esc(cname)+'</button>';
  });
  listHtml+='</div>';
  openModal('notifCkList','📍 مراکز مرتبط با این اعلان',listHtml,'<button class="btn-secondary" onclick="closeModal(\'notifCkList\')">بستن</button>');
}

function ackNotif(nid){
  _initNotif();
  var n=DB.notifications.find(function(x){return x.id===nid;});
  if(!n||n.ack)return;
  n.read=true;n.ack=true;n.ackAt=new Date().toISOString();
  if(n.from&&n.from!==currentUser){
    var cName=n.centerKey?_clGetName(n.centerKey):'';
    var msg=(USERS[currentUser]||currentUser)+' تأیید کرد: '+(cName?'"'+cName+'" ':'')+'انجام شد ✓';
    sendNotif(n.from,msg,n.centerKey||'');
  }
  saveDB();updateNotifBadge();
  var p=document.getElementById('notifPanel');
  if(p){
    var el=p.querySelector('[data-nid="'+nid+'"]');
    if(el){
      el.classList.remove('unread');el.classList.add('notif-acked');
      var btn=el.querySelector('.notif-ack-btn');
      if(btn)btn.outerHTML='<span class="notif-ack-badge">✓ تأیید شده</span>';
    }
  }
  showToast('✅ تأیید ثبت و به مدیر اطلاع داده شد',2000);
}

function markNotifRead(nid){
  _initNotif();
  var nx=DB.notifications.find(function(x){return x.id===nid;});
  if(nx){nx.read=true;saveDBSync();updateNotifBadge();}
}
function markAllNotifsRead(){
  _initNotif();
  DB.notifications.forEach(function(n){if(n.to===currentUser)n.read=true;});
  saveDBSync();updateNotifBadge();
  var p=document.getElementById('notifPanel');
  if(p){var btn=p.querySelector('.notif-panel-head button');if(btn)btn.remove();p.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});}
}
function _timeAgo(isoStr){
  var diff=Math.floor((Date.now()-new Date(isoStr).getTime())/1000);
  if(diff<60)return'لحظاتی پیش';
  if(diff<3600)return Math.floor(diff/60)+' دقیقه پیش';
  if(diff<86400)return Math.floor(diff/3600)+' ساعت پیش';
  return Math.floor(diff/86400)+' روز پیش';
}


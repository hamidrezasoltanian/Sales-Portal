/* ═══ public/js/center-modal.js ═══ */
// ════════════════════════ JDP ══════════════════════════
var _jdpOutsideHandler=null;
function openJDP(inp,cb){
  closeJDP();
  _jdpCb=cb;_jdpInp=inp;
  var today=todayJ();
  var cur=inp&&inp.value?inp.value.split('/').map(Number):today;
  _jdpDate=[cur[0]||today[0],cur[1]||today[1],1];
  var wrapTop=window.innerHeight/2-180;
  var wrapRight=window.innerWidth/2-115;
  if(inp&&inp.getBoundingClientRect){
    try{
      var rect=inp.getBoundingClientRect();
      if(rect.width>0||rect.height>0){
        wrapTop=Math.min(rect.bottom+4,window.innerHeight-290);
        wrapRight=Math.max(window.innerWidth-rect.right,10);
      }
    }catch(e){}
  }
  var wrap=document.createElement('div');wrap.id='jdpWrap';wrap.className='jdp-wrap';
  wrap.style.top=Math.max(10,wrapTop)+'px';wrap.style.right=Math.max(10,wrapRight)+'px';
  wrap.addEventListener('click',function(e){e.stopPropagation();});
  wrap.innerHTML=buildJDP();
  document.body.appendChild(wrap);
  // named handler برای بتوانیم آن را explicit حذف کنیم
  _jdpOutsideHandler=function(e){
    var w=document.getElementById('jdpWrap');
    if(w&&!w.contains(e.target)&&e.target!==inp)closeJDP();
  };
  setTimeout(function(){document.addEventListener('click',_jdpOutsideHandler);},150);
}
function buildJDP(){
  if(!_jdpDate)return'';
  var jy=_jdpDate[0],jm=_jdpDate[1];
  var total=jDays(jy,jm);var firstDow=jDow(jy,jm,1);
  var today=todayJ();var todayStr2=today[0]+'/'+p2(today[1])+'/'+p2(today[2]);
  var selStr=(_jdpInp&&_jdpInp.value)||'';
  var html='<div class="jdp-head">'
    +'<button onclick="jdpNav(-1)">◀</button>'
    +'<span>'+J_MONTHS[jm-1]+' '+jy+'</span>'
    +'<button onclick="jdpNav(1)">▶</button></div>'
    +'<div class="jdp-grid">'
    +['ش','ی','د','س','چ','پ','ج'].map(function(d){return'<div class="jdp-dow">'+d+'</div>';}).join('');
  // روزهای ماه قبل
  if(firstDow>0){
    var prevM=jm>1?jm-1:12;var prevY=jm>1?jy:jy-1;var prevTotal=jDays(prevY,prevM);
    for(var i=firstDow-1;i>=0;i--){
      var d2=prevTotal-i;
      html+='<div class="jdp-day other" onclick="jdpSelectOther('+prevY+','+prevM+','+d2+')">'+d2+'</div>';
    }
  }
  // روزهای ماه جاری
  for(var d=1;d<=total;d++){
    var dStr=jy+'/'+p2(jm)+'/'+p2(d);
    var cls='jdp-day'+(dStr===todayStr2?' today':'')+(dStr===selStr?' selected':'');
    html+='<div class="'+cls+'" onclick="jdpSel(\''+dStr+'\',event)">'+d+'</div>';
  }
  // روزهای ماه بعد
  var filled=firstDow+total;var remaining=(7-filled%7)%7;
  if(remaining>0){
    var nextM=jm<12?jm+1:1;var nextY=jm<12?jy:jy+1;
    for(var nd=1;nd<=remaining;nd++){
      html+='<div class="jdp-day other" onclick="jdpSelectOther('+nextY+','+nextM+','+nd+')">'+nd+'</div>';
    }
  }
  html+='</div>';return html;
}
function jdpNav(delta){
  if(!_jdpDate)return;
  _jdpDate[1]+=delta;
  if(_jdpDate[1]<1){_jdpDate[1]=12;_jdpDate[0]--;}
  if(_jdpDate[1]>12){_jdpDate[1]=1;_jdpDate[0]++;}
  var w=document.getElementById('jdpWrap');if(w)w.innerHTML=buildJDP();
}
function jdpSel(dateStr,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  var cb=_jdpCb;var inpEl=_jdpInp;
  closeJDP(); // اول ببند تا listener پاک شود
  if(inpEl)inpEl.value=dateStr;
  if(cb)cb(dateStr);
}
function jdpSelectOther(jy,jm,jd){
  _jdpDate=[jy,jm,1];
  var dateStr=jy+'/'+p2(jm)+'/'+p2(jd);
  jdpSel(dateStr);
}
function closeJDP(){
  var w=document.getElementById('jdpWrap');if(w)w.remove();
  if(_jdpOutsideHandler){document.removeEventListener('click',_jdpOutsideHandler);_jdpOutsideHandler=null;}
  _jdpCb=null;_jdpInp=null;
}

// ════════════════════════ MODAL (DOM-based) ════════════
function openModal(id,titleHTML,bodyHTML,footHTML,opts){
  closeModal(id);
  var overlay=document.createElement('div');
  overlay.className='m-overlay';overlay.id='mo_'+id;
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal(id);});
  var box=document.createElement('div');
  box.className='m-box'+(opts&&opts.lg?' lg':'')+(opts&&opts.xl?' xl':'');
  box.addEventListener('click',function(e){if(typeof closeTagMenu==='function')closeTagMenu();e.stopPropagation();});
  var head=document.createElement('div');head.className='m-head';
  head.innerHTML='<span>'+titleHTML+'</span><button class="m-close" onclick="closeModal(\''+id+'\')">✕</button>';
  var body=document.createElement('div');body.className='m-body';body.innerHTML=bodyHTML;
  var foot=document.createElement('div');foot.className='m-foot';foot.innerHTML=footHTML;
  box.appendChild(head);box.appendChild(body);box.appendChild(foot);
  overlay.appendChild(box);document.body.appendChild(overlay);
  return{overlay,box,body,foot};
}
function closeModal(id){
  var m=document.getElementById('mo_'+id);
  if(m)m.remove();
  // also close JDP if open
  closeJDP();
}
function closeAllModals(){
  document.querySelectorAll('.m-overlay').forEach(function(m){m.remove();});
  closeJDP();closeTagMenu();
}

// ════════════════════════ CENTER MODAL ══════════════

function showContactPopup(ev, rtype, id) {
  var e = getE(rtype, id);
  var popup = document.getElementById('centerContactPopup');
  if(!popup) return;
  var nameEl = document.getElementById('ccp-name');
  var bodyEl = document.getElementById('ccp-body');
  var contacts = _getContacts(rtype, id);
  if(nameEl)nameEl.textContent = (contacts.length===1&&contacts[0].name)?contacts[0].name:(contacts.length>0?contacts.length+' مخاطب':'اطلاعات تماس');
  var html = '';
  contacts.forEach(function(c, ci) {
    if(c.name||c.title||(c.phones&&c.phones.length)){
      if(contacts.length>1) html += '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-top:'+(ci>0?'8':'0')+'px;margin-bottom:3px">'+(c.name||'مخاطب '+(ci+1))+(c.title?' — '+c.title:'')+'</div>';
      else if(c.name||c.title) html += '<div class="contact-popup-row" style="font-weight:600;font-size:12px">'+(c.name||'')+(c.title?' ('+c.title+')':'')+'</div>';
      (c.phones||[]).forEach(function(p){
        if(p) html += '<div class="contact-popup-row"><a href="'+_phoneHref(p)+'" title="'+_phoneTitle()+'" onclick="event.stopPropagation()" style="color:#0369a1;text-decoration:none;direction:ltr;display:block">📞 '+esc(p)+'</a></div>';
      });
    }
  });
  if (e.address) html += '<div class="contact-popup-row" style="margin-top:5px;color:var(--text-secondary)">📍 '+esc(e.address)+'</div>';
  if(bodyEl)bodyEl.innerHTML = html || '<span style="color:var(--text-muted);font-size:11px">اطلاعاتی ثبت نشده</span>';
  var rect = ev.target.getBoundingClientRect();
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right - 10) + 'px';
  popup.style.left = 'auto';
  popup.classList.add('show');
  ev.stopPropagation();
}
function hideContactPopup() {
  var popup = document.getElementById('centerContactPopup');
  if (popup) popup.classList.remove('show');
}


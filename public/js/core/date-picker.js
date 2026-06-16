'use strict';
// ── Jalali date picker ────────────────────────────────────────────────────────
// Extracted from app.js.
// Depends on: todayJ(), p2(), jDays(), jDow(), J_MONTHS (from jalali.js)
// State vars _jdpCb, _jdpInp, _jdpDate declared in app.js (must load first)

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


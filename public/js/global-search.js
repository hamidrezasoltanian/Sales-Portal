/* Global search (Ctrl+K) + quick search — loaded eagerly for header buttons */
var _gSearchSel=0;
function openGSearch(){
  document.getElementById('gSearchOverlay').classList.add('open');
  setTimeout(function(){var el=document.getElementById('gSearchInput');if(el){el.value='';el.focus();}gSearchQuery('');},50);
}
function closeGSearch(){document.getElementById('gSearchOverlay').classList.remove('open');}
function gSearchQuery(q){
  q=(q||'').trim();
  var res=[];
  if(q.length>=1){
    var qn=fNorm(q);
    _buildPCCache();
    (CENTERS||[]).forEach(function(c){
      if(res.length>=12)return;
      var name=_getCenterName('center', c.id) || c.name || '';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE('center',c.id)||{};
        var cid=c.id;
        res.push({icon:'🏥',title:esc(name),sub:esc(e.status||'بدون تماس'),action:function(){closeGSearch();openCenterModal('center',cid);}});
      }
    });
    var _gsAllowedProvs=(window._myPermissions&&window._myPermissions.provinces&&window._myPermissions.provinces.length)?window._myPermissions.provinces:null;
    Object.keys(_PC_CACHE||{}).forEach(function(pv){if(pv==='tehran')return;if(res.length>=12)return;if(_gsAllowedProvs&&_gsAllowedProvs.indexOf(pv)<0)return;(_PC_CACHE[pv]||[]).forEach(function(c){
      if(res.length>=12)return;
      var name=_getCenterName('pc', c.id) || c.name || c.center_name || '';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE('pc',c.id)||{};var cid=c.id;
        res.push({icon:'🏢',title:esc(name),sub:esc(e.status||c.province_name||''),action:function(){closeGSearch();openCenterModal('pc',cid);}});
      }
    });});
    // DB.extra (manually added centers)
    var _mainCIds=new Set((CENTERS||[]).map(function(c){return String(c.id);}));
    (DB.extra||[]).forEach(function(c){
      if(res.length>=12)return;
      var ertype=c.province_id==='tehran'?'center':'pc';
      if(ertype==='center'&&_mainCIds.has(String(c.id)))return;
      var name=_getCenterName(ertype, c.id) || c.name || c.center_name || '';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE(ertype,c.id)||{};var cid=c.id;var crt=ertype;
        res.push({icon:'➕',title:esc(name),sub:esc(e.status||c.province_name||'مرکز اضافه‌شده'),action:function(){closeGSearch();openCenterModal(crt,cid);}});
      }
    });
    (DB.events||[]).forEach(function(ev){
      if(!ev||!ev.title)return;
      if(fNorm(ev.title).indexOf(qn)!==-1){
        res.push({icon:'🗓',title:esc(ev.title),sub:esc(ev.date||''),action:function(){closeGSearch();switchTab('calendar');}});
      }
    });
    (PROVINCES||[]).forEach(function(p){
      var pn=p.name||p.n||'';
      if(fNorm(pn).indexOf(qn)!==-1){
        var pid=p.id;
        res.push({icon:'🗺',title:esc(pn),sub:'استان',action:function(){closeGSearch();switchTab('provinces');openProvince(pid);}});
      }
    });
  }
  _gSearchSel=0;
  var el=document.getElementById('gSearchResults');
  if(!el)return;
  if(!res.length){el.innerHTML='<div class="gs-empty">'+(q?'نتیجه‌ای یافت نشد':'برای جستجو تایپ کنید…')+'</div>';el._results=[];return;}
  el.innerHTML=res.map(function(r,i){
    return'<div class="gs-item'+(i===0?' gs-sel':'')+'" data-idx="'+i+'" onmouseenter="gSearchHover('+i+')" onclick="gSearchExec('+i+')">'
      +'<span class="gs-icon">'+r.icon+'</span>'
      +'<div class="gs-main"><div class="gs-title">'+r.title+'</div>'+(r.sub?'<div class="gs-sub">'+r.sub+'</div>':'')+'</div>'
      +'</div>';
  }).join('');
  el._results=res;
}
function gSearchHover(i){_gSearchSel=i;var items=document.querySelectorAll('.gs-item');items.forEach(function(el,j){el.classList.toggle('gs-sel',j===i);});}
function gSearchExec(i){var el=document.getElementById('gSearchResults');if(!el||!el._results)return;var r=el._results[i];if(r&&r.action)r.action();}
function gSearchKey(e){
  var el=document.getElementById('gSearchResults');
  var items=el?el.querySelectorAll('.gs-item'):[];
  if(e.key==='ArrowDown'){e.preventDefault();_gSearchSel=Math.min(_gSearchSel+1,items.length-1);gSearchHover(_gSearchSel);}
  else if(e.key==='ArrowUp'){e.preventDefault();_gSearchSel=Math.max(_gSearchSel-1,0);gSearchHover(_gSearchSel);}
  else if(e.key==='Enter'){e.preventDefault();gSearchExec(_gSearchSel);}
  else if(e.key==='Escape'){closeGSearch();}
}

// ════════════════════════ QUICK SEARCH ═══════════════
function openQS(){
  var o=document.getElementById('qsOverlay');
  if(o){o.style.display='flex';setTimeout(function(){var i=document.getElementById('qsInput');if(i){i.focus();i.select();}},60);}
}
function closeQS(){
  var o=document.getElementById('qsOverlay');
  if(o)o.style.display='none';
  var i=document.getElementById('qsInput');if(i)i.value='';
  var r=document.getElementById('qsResults');if(r)r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">برای جستجو تایپ کنید (Ctrl+K برای باز کردن)</div>';
}
function qsSearch(q){
  var r=document.getElementById('qsResults');
  if(!r)return;
  if(!q||q.length<2){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">حداقل ۲ حرف وارد کنید</div>';return;}
  var qn=fNorm(q);
  var results=[];
  // مراکز تهران
  (CENTERS||[]).forEach(function(c){
    if(fNorm(c.name||'').indexOf(qn)>=0){
      var e=getE('center',c.id);
      var _qsCid=String(c.id).replace(/\'/g,"\\'");var _qsCrt='center';
      results.push({type:'مرکز تهران',icon:'🏥',name:c.name,sub:e.status||'بدون تماس',action:"openCenterModal('"+_qsCrt+"','"+_qsCid+"');closeQS()"});
    }
  });
  // مراکز استانی از cache
  _buildPCCache();
  Object.keys(_PC_CACHE||{}).forEach(function(provId){
    if(provId==='tehran')return;
    (_PC_CACHE[provId]||[]).forEach(function(c){
      if(fNorm(c.name||'').indexOf(qn)>=0){
        var e=getE('pc',c.id);
        var _qsPcid=String(c.id).replace(/\'/g,"\\'");
        results.push({type:'مرکز استانی',icon:'🏢',name:c.name,sub:e.status||'بدون تماس',action:"openCenterModal('pc','"+_qsPcid+"');closeQS()"});
      }
    });
  });
  // مراکز اضافه‌شده (DB.extra)
  var _qsMainIds=new Set((CENTERS||[]).map(function(c){return String(c.id);}));
  (DB.extra||[]).forEach(function(c){
    var ertype=c.province_id==='tehran'?'center':'pc';
    if(ertype==='center'&&_qsMainIds.has(String(c.id)))return;
    if(fNorm(c.name||'').indexOf(qn)>=0){
      var e=getE(ertype,c.id);
      var _qsExid=String(c.id).replace(/\'/g,"\\'");var _qsExrt=ertype;
      results.push({type:'مرکز اضافه‌شده',icon:'➕',name:c.name,sub:e.status||'بدون تماس',action:"openCenterModal('"+_qsExrt+"','"+_qsExid+"');closeQS()"});
    }
  });
  // برنامه هفته
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    var nm=we.centerName||we.mtrCustomer||'';
    if(nm&&fNorm(nm).indexOf(qn)>=0){
      results.push({type:'برنامه هفته',icon:'📅',name:nm,sub:we.scheduledDate||'بدون تاریخ',action:"switchTab('weekplan');closeQS()"});
    }
  });
  // یادداشت‌ها
  Object.keys(DB.notes||{}).forEach(function(k){
    (DB.notes[k]||[]).forEach(function(n){
      if(!n||!n.text)return;
      if(fNorm(n.text).indexOf(qn)>=0){
        results.push({type:'یادداشت',icon:'📝',name:n.text.substring(0,70)+(n.text.length>70?'…':''),sub:k,action:"closeQS()"});
      }
    });
  });
  if(!results.length){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">نتیجه‌ای یافت نشد</div>';return;}
  r.innerHTML=results.slice(0,20).map(function(item){
    return '<div onclick="'+item.action+'" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;cursor:pointer;transition:.15s" onmouseover="this.style.background=\'var(--bg-raised)\'" onmouseout="this.style.background=\'\'">'
      +'<span style="font-size:18px">'+item.icon+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(item.name)+'</div>'
      +'<div style="font-size:10px;color:var(--text-muted)">'+esc(item.type)+(item.sub?' — '+esc(item.sub):'')+'</div>'
      +'</div></div>';
  }).join('')+(results.length>20?'<div style="text-align:center;padding:8px;font-size:11px;color:var(--text-muted)">... و '+(results.length-20)+' نتیجه دیگر</div>':'');
}


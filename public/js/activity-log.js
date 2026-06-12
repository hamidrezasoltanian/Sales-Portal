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
      entries.push({ts:ts,name:name,desc:(actType==='visit'?'🚗 ویزیت انجام شد':'📞 تماس انجام شد')+' ✓',icon:'✅',user:we.doneUser||''});
    });
    // ۴. تماس‌های روزانه (callLog)
    (DB.callLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'📞 '+l.count+' تماس'+(l.note?' — '+l.note:''),icon:'📞',user:l.userId||''});
    });
    // ۵. ویزیت‌های دستی (visitLog)
    (DB.visitLog||[]).forEach(function(l){
      if(!l.date)return;
      var ts=dateStrToTs(l.date);if(!ts)return;
      entries.push({ts:ts,name:l.centerName||'',desc:'🚗 '+(l.count>1?l.count+' بازدید':'بازدید')+(l.note?' — '+l.note:''),icon:'🚗',user:l.userId||''});
    });
  }catch(err){
    el.innerHTML='<div style="padding:20px;color:#dc2626">⚠ خطا در نمایش فعالیت‌ها: '+esc(err.message)+'</div>';
    return;
  }
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
// ════════════════════════ GLOBAL SEARCH (Ctrl+K) ══════════════
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
      var name=c.name||'';
      if(fNorm(name).indexOf(qn)!==-1){
        var e=getE('center',c.id)||{};
        var cid=c.id;
        res.push({icon:'🏥',title:esc(name),sub:esc(e.status||'بدون تماس'),action:function(){closeGSearch();openCenterModal('center',cid);}});
      }
    });
    Object.keys(_PC_CACHE||{}).forEach(function(pv){if(res.length>=12)return;(_PC_CACHE[pv]||[]).forEach(function(c){
      if(res.length>=12)return;
      var name=c.name||c.center_name||'';
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
      var name=c.name||c.center_name||'';
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
      results.push({type:'مرکز تهران',icon:'🏥',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
    }
  });
  // مراکز استانی از cache
  _buildPCCache();
  Object.keys(_PC_CACHE||{}).forEach(function(provId){
    (_PC_CACHE[provId]||[]).forEach(function(c){
      if(fNorm(c.name||'').indexOf(qn)>=0){
        var e=getE('pc',c.id);
        results.push({type:'مرکز استانی',icon:'🏢',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
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
      results.push({type:'مرکز اضافه‌شده',icon:'➕',name:c.name,sub:e.status||'بدون تماس',action:"switchTab('provinces');closeQS()"});
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


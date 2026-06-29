/* ═══ public/js/data.js ═══ */
// ════════════════════════ DATA HELPERS ════════════════
// تهران + ۳۰ استان دیگر — cached
var _ALL_PROVS=null;
function getAllProvinces(){
  if(!_ALL_PROVS)_ALL_PROVS=[{id:'tehran',row:0,name:'تهران',potential:1,biopsyPct:19.8,owner:null}].concat(PROVINCES);
  return _ALL_PROVS;
}
function getProvType(provId){return provId==='tehran'?'center':'pc';}
// Cache: PC_RAW یک بار normalize می‌شود — null = نیاز به rebuild دارد
var _PC_CACHE=null;
function _buildPCCache(){
  if(_PC_CACHE!==null&&Object.keys(_PC_CACHE).length>0)return;
  _PC_CACHE={};
  PROVINCES.forEach(function(p){
    var pname=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    var rawByName=PC_RAW[pname]||[];var rawById=PC_RAW[p.id]||[];var raw=rawByName.concat(rawById.filter(function(r){var rname=(r&&(r.name||r[1]))||'';return!rawByName.some(function(s){return((s&&(s.name||s[1]))||'')==rname;});}));
    (function(){
    var _seenIds={};
    _PC_CACHE[p.id]=raw.map(function(r){
      var obj;
      if(Array.isArray(r)){
        obj={id:p.id+'||'+r[0],row:r[0],name:(r[1]||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'),potential:r[2],type:r[3]||'',lead:r[4]||'سرنخ',province_id:p.id,owner:p.owner};
      } else {
        var rid=r.row||r[0]||0;
        obj={id:r.id||(p.id+'||'+rid),row:rid,name:(r.name||r[1]||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'),potential:r.potential||r[2]||1,type:r.type||r[3]||'',lead:r.lead||r[4]||'سرنخ',province_id:p.id,owner:r.owner||p.owner,_mizito:r._mizito||false};
      }
      // Deduplicate: if id already used, suffix with _m (mizito import collision)
      if(_seenIds[obj.id]){
        var suffix=obj._mizito?'_m':('_d'+obj.row);
        obj.id=obj.id+suffix;
      }
      _seenIds[obj.id]=true;
      return obj;
    });
    })()
  });
  _PC_CACHE['tehran']=CENTERS; 

  // ── Populate CNC cache ──────────────────────────────
  _loadCNC();var _chg=false;
  Object.keys(_PC_CACHE).forEach(function(pv){
    (_PC_CACHE[pv]||[]).forEach(function(ct){
      if(!ct||!ct.id||!ct.name)return;
      var rk=(pv==='tehran'?'center_':'pc_')+ct.id;
      if(!_CNC[rk]){_CNC[rk]=ct.name;_chg=true;}
    });
  });
  if(_chg)try{localStorage.setItem('_cnc',JSON.stringify(_CNC));}catch(e){}
}function getProvCenters(provId){
  _buildPCCache();
  var overrides=DB.provOverrides||{};
  var hasOverrides=Object.keys(overrides).length>0;
  var useHardcoded=!(DB.hiddenProvs&&DB.hiddenProvs[provId]);
  var base=useHardcoded?(_PC_CACHE[provId]||[]).filter(function(c){
    if(!hasOverrides)return true;
    var rt=(provId==='tehran'?'center':'pc')+'_'+c.id;
    return !overrides[rt]||overrides[rt]===provId;
  }):[];
  var extras=(DB.extra||[]).filter(function(c){
    if(hasOverrides){var ek='extra_'+c.id;if(overrides[ek]&&overrides[ek]!==provId)return false;if(overrides[ek]===provId)return true;}
    return c.province_id===provId;
  });
  // Centers from other provinces moved here via override
  var movedIn=[];
  if(hasOverrides){
    Object.keys(overrides).forEach(function(rk){
      if(overrides[rk]!==provId)return;
      var parts=rk.split('_');var rt=parts[0];var cid=parts.slice(1).join('_');
      if(rt==='center'){
        var found=(window.CENTERS||[]).find(function(x){return String(x.id)===cid;});
        if(found&&provId!=='tehran')movedIn.push(Object.assign({},found,{province_id:provId,rtype:'center'}));
      } else if(rt==='pc'){
        Object.keys(_PC_CACHE).forEach(function(pid){
          if(pid===provId)return;
          var fc=(_PC_CACHE[pid]||[]).find(function(x){return x.id===cid;});
          if(fc)movedIn.push(Object.assign({},fc,{province_id:provId}));
        });
      }
    });
  }
  if(!extras.length&&!movedIn.length)return base;
  // If an extra center shares the same ID as a base center, extra wins (user override)
  var extraIds=new Set(extras.map(function(c){return String(c.id);}));
  var filteredBase=base.filter(function(c){return!extraIds.has(String(c.id));});
  return filteredBase.concat(extras).concat(movedIn);
}
function clearPCCache(){_PC_CACHE=null;}
function isStalled(type,id){
  var e=getE(type,id);var st=e.status||'بدون تماس';
  if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  var last=e._lastActivity||e._ts||0;if(!last)return false;
  return(nowTs()-last)>(30*24*3600*1000);
}
function isOverdue(type,id){
  var e=getE(type,id);var fd=e.followupDate||'';
  var st=e.status||'بدون تماس';if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  return fd&&fd<todayStr();
}


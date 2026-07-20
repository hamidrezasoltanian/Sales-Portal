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
var _pcCacheSrcLen=-1;
function _pcMasterLen(){
  return (CENTERS.length||0)+Object.values(PC_RAW).reduce(function(s,a){return s+(Array.isArray(a)?a.length:0);},0);
}
function _buildPCCache(){
  var srcLen=_pcMasterLen();
  if(_PC_CACHE!==null&&_pcCacheSrcLen===srcLen)return;
  _pcCacheSrcLen=srcLen;
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
  var defaultType = provId === 'tehran' ? 'center' : 'pc';
  base = base.map(function(c){return Object.assign({}, c, {rtype: defaultType});});

  var extras=(DB.extra||[]).filter(function(c){
    if(hasOverrides){
      var originalRtype = c.province_id==='tehran'?'center':'pc';
      var rkey = originalRtype + '_' + c.id;
      var ek = 'extra_' + c.id;
      var ov = overrides[rkey] || overrides[ek];
      if(ov && ov !== provId) return false;
      if(ov === provId) return true;
    }
    return c.province_id===provId;
  });
  extras = extras.map(function(c){return Object.assign({}, c, {rtype: defaultType});});

  // Centers from other provinces moved here via override
  var movedIn=[];
  if(hasOverrides){
    var destProv=getAllProvinces().find(function(p){return p.id===provId;});
    var destOwner=destProv?destProv.owner:null;
    Object.keys(overrides).forEach(function(rk){
      if(overrides[rk]!==provId)return;
      var parts=rk.split('_');var rt=parts[0];var cid=parts.slice(1).join('_');
      // Search in DB.extra first
      var extraFound = (DB.extra||[]).find(function(x){return String(x.id)===cid;});
      if(extraFound){
        movedIn.push(Object.assign({},extraFound,{province_id:provId,rtype:defaultType,owner:destOwner}));
      } else if(rt==='center'){
        var found=(window.CENTERS||[]).find(function(x){return String(x.id)===cid;});
        if(found&&provId!=='tehran')movedIn.push(Object.assign({},found,{province_id:provId,rtype:'center',owner:destOwner}));
      } else if(rt==='pc' || rt==='extra'){
        Object.keys(_PC_CACHE).forEach(function(pid){
          if(pid===provId)return;
          var fc=(_PC_CACHE[pid]||[]).find(function(x){return x.id===cid;});
          if(fc)movedIn.push(Object.assign({},fc,{province_id:provId,rtype:'pc',owner:destOwner}));
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

/** Province edit key: center_tehran for Tehran, pc_{id} for others */
function getProvinceEditKey(provId) {
  if (!provId) return '';
  return getProvType(provId) + '_' + provId;
}

/** Province id for a center row */
function getCenterProvinceId(rtype, rid) {
  if (!rtype || rid == null || rid === '') return '';
  if (rtype === 'center' && String(rid) !== 'tehran') return 'tehran';
  if (rtype === 'pc') return String(rid).split('||')[0] || '';
  return '';
}

/** Province default owner: DB.edits override, then PROVINCES hardcoded fallback. */
function _getProvinceOwner(provId) {
  if (!provId) return '';
  var pe = getE(getProvType(provId), provId);
  if (pe && pe.owner) return pe.owner;
  if (provId === 'tehran') return '';
  var prov = (typeof PROVINCES !== 'undefined' ? PROVINCES : []).find(function(p) { return p.id === provId; });
  return (prov && prov.owner) || '';
}

/**
 * Canonical center owner resolution (keep all copies in sync with this).
 * Chain: edits.owner → province owner → static center → extra.owner
 */
function getCenterOwner(rtype, rid) {
  if (!rtype || rid == null || rid === '') return '';
  var e = getE(rtype, rid);
  if (e && e.owner) return e.owner;

  var provId = getCenterProvinceId(rtype, rid);
  if (provId) {
    var po = _getProvinceOwner(provId);
    if (po) return po;
  }

  if (rtype === 'center') {
    if (typeof CENTERS !== 'undefined') {
      var tc = CENTERS.find(function(x) { return String(x.id) === String(rid); });
      if (tc && tc.owner) return tc.owner;
    }
  } else if (rtype === 'pc') {
    if (typeof _buildPCCache === 'function') { try { _buildPCCache(); } catch (_) {} }
    if (typeof _PC_CACHE !== 'undefined' && provId) {
      var arr = _PC_CACHE[provId] || [];
      var pc = arr.find(function(x) { return String(x.id) === String(rid); });
      if (pc && pc.owner) return pc.owner;
    }
  }

  if (typeof DB !== 'undefined' && DB.extra) {
    var ex = DB.extra.find(function(x) { return String(x.id) === String(rid); });
    if (ex && ex.owner) return ex.owner;
  }
  return '';
}

/** Resolve owner from centerKey e.g. center_42 or pc_p3||5 */
function getCenterOwnerFromKey(centerKey) {
  if (!centerKey) return '';
  var us = centerKey.indexOf('_');
  if (us < 0) return '';
  return getCenterOwner(centerKey.slice(0, us), centerKey.slice(us + 1));
}

/** Resolve center name from centerKey e.g. center_42 or pc_p3||5 */
function getCenterNameFromKey(centerKey) {
  if (typeof getRecLabel === 'function') {
    var lbl = getRecLabel(centerKey);
    if (lbl && lbl !== '?') return lbl;
  }
  if (!centerKey) return '';
  var pts = centerKey.split('_');
  var tp = pts[0];
  var id = pts.slice(1).join('_');
  
  var e = (DB.edits && DB.edits[centerKey]) || {};
  if (e.nameOverride) return e.nameOverride;
  
  if (tp === 'center') {
    var c = CENTERS.find(function(x) { return String(x.id) === String(id); });
    if (c) return c.name;
  }
  
  var ex = (DB.extra || []).find(function(x) { return String(x.id) === String(id); });
  if (ex) return ex.name;
  
  if (typeof _buildPCCache === 'function') _buildPCCache();
  if (window._PC_CACHE) {
    for (var pv in window._PC_CACHE) {
      var found = window._PC_CACHE[pv].find(function(x) { return String(x.id) === String(id); });
      if (found) return found.name;
    }
  }
  return id;
}

/** Week-entry owner: canonical getCenterOwner + addedBy fallback */
function _wpGetOwner(we) {
  if (!we) return '';
  var rtype = we.rtype || 'center';
  var rid = we.rid != null ? we.rid : '';
  var owner = typeof getCenterOwner === 'function' ? getCenterOwner(rtype, rid) : '';
  return owner || we.addedBy || '';
}

/** Owner from edit/week recKey like "center_c_12" or "pc_tehran||3" */
function _getOwnerForRecKey(recKey) {
  if (!recKey) return '';
  var pts = String(recKey).split('_');
  var rtype = pts[0];
  var rid = pts.slice(1).join('_');
  return _wpGetOwner({ rtype: rtype, rid: rid });
}

function clearPCCache(){_PC_CACHE=null;_pcCacheSrcLen=-1;}
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


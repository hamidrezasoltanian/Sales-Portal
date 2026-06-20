'use strict';
// user-mgmt.js — User management functions (copied from app.js)
// Functions: openUserMgmt, umGetMembers, umGetActive, umGetColor, umCountCenters,
//   umSaveUser, umAddUser, _umDoAddUser, umToggleActive, umConfirmDeactivate,
//   umResetPassword, umPickColor, _umProvinces, umProvOwnerChanged, umQuickAssignProvinces,
//   showProvHistory, _umBulk, previewBulkReassign, executeBulkReassign,
//   buildUSERS, _buildUSERSUI

// ════════════════════════ SETTINGS ════════════════════════════════════

// ── جابجایی گروهی مراکز ──────────────────────────────────────
function openUserMgmt(){
  if(!_isManager()){showToast('⚠ فقط مدیران دسترسی دارند');return;}
  _UM_TAB='users';
  var foot='<button class="btn-secondary" onclick="closeModal(\'userMgmtModal\')">بستن</button>';
  openModal('userMgmtModal','👥 مدیریت کاربران','<div id="umWrap">'+_umBody()+'</div>',foot,{lg:true});
}
function openBulkReassign(){_UM_TAB='bulk';openUserMgmt();}
function umTab(t){_UM_TAB=t;var w=document.getElementById('umWrap');if(w)w.innerHTML=_umBody();}
function _umTabs(){
  var tabs=[['users','👤 کاربران'],['provinces','🗺 استان‌ها'],['bulk','🔀 جابجایی']];
  return '<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">'
    +tabs.map(function(t){
      var on=_UM_TAB===t[0];
      return '<button onclick="umTab(\''+t[0]+'\')" style="padding:8px 18px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:'+(on?700:400)+';color:'+(on?'var(--brand)':'var(--text-muted)')+';border-bottom:2.5px solid '+(on?'var(--brand)':'transparent')+';margin-bottom:-2px;transition:all .15s">'+t[1]+'</button>';
    }).join('')+'</div>';
}
function _umBody(){
  return _umTabs()+(_UM_TAB==='users'?_umUsers():_UM_TAB==='provinces'?_umProvinces():_umBulk());
}
function _umUsers(){
  var members=umGetMembers().filter(function(m){return m.id!=='guest';});
  var rows=members.map(function(m,i){
    var active=m.active!==false;
    var centers=umCountCenters(m.id);
    var color=m.color||_UM_COLORS[i%_UM_COLORS.length];
    var statusBg=active?'#dcfce7':'var(--bg-raised)';
    var statusTxt=active?'#15803d':'var(--text-muted)';
    var rowOp=active?1:.55;
    var roles=['مدیر','کارشناس فروش','سوپر ادمین','بازرگانی','مالی','IT','مهمان'];
    return '<tr style="opacity:'+rowOp+';border-bottom:1px solid var(--border)">'
      +'<td style="padding:9px 8px;width:28px"><div id="umdot_'+m.id+'" style="width:16px;height:16px;border-radius:50%;background:'+color+';cursor:pointer;border:2px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.15)" onclick="umPickColor(\''+m.id+'\',this)" title="تغییر رنگ"></div></td>'
      +'<td style="padding:9px 6px"><input id="um_name_'+m.id+'" value="'+esc(m.name)+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 9px;font-size:12.5px;font-family:inherit;color:var(--text-primary);width:130px"></td>'
      +(_isSuperAdmin()
        ? '<td style="padding:9px 6px"><input id="um_id_'+m.id+'" value="'+esc(m.id)+'" dir="ltr" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 8px;font-size:11px;font-family:monospace;color:var(--text-primary);width:130px" placeholder="نام کاربری"></td>'
        : '<td style="padding:9px 6px"><span dir="ltr" style="font-size:12px;font-family:monospace;color:var(--text-muted);padding:4px 8px;background:var(--bg-raised);border-radius:4px">'+esc(m.id)+'</span></td>')
      +'<td style="padding:9px 6px"><select id="um_role_'+m.id+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 7px;font-size:12px;font-family:inherit;color:var(--text-primary)">'
        +roles.map(function(r){return'<option'+(m.role===r?' selected':'')+'>'+r+'</option>';}).join('')
      +'</select></td>'
      +'<td style="padding:9px 6px"><input id="um_phone_'+m.id+'" value="'+esc(m.phone||'')+'" placeholder="09XXXXXXXXX" dir="ltr" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 8px;font-size:11px;font-family:monospace;color:var(--text-primary);width:115px"></td>'
      +'<td style="padding:9px 6px"><input id="um_dept_'+m.id+'" value="'+esc(m.department||'')+'" placeholder="دپارتمان" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 8px;font-size:11px;font-family:inherit;color:var(--text-primary);width:90px"></td>'
      +'<td style="padding:9px 6px"><select id="um_mgr_'+m.id+'" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:5px 7px;font-size:11px;font-family:inherit;color:var(--text-primary)"><option value="">— بدون مدیر —</option>'+umGetActive().map(function(u){return'<option value="'+esc(u.id)+'"'+(m.direct_manager===u.id?' selected':'')+'>'+esc(u.name)+'</option>';}).join('')+'</select></td>'
      +'<td style="padding:9px 8px;text-align:center"><span style="font-size:11px;color:var(--text-muted)">🏥'+centers+'</span></td>'
      +'<td style="padding:9px 8px;text-align:center">'
        +'<span onclick="umToggleActive(\''+m.id+'\')" style="font-size:11px;background:'+statusBg+';color:'+statusTxt+';border-radius:20px;padding:3px 11px;cursor:pointer;font-weight:600;border:1px solid '+(active?'#86efac':'var(--border)')+'">'+( active?'● فعال':'○ غیرفعال')+'</span>'
      +'</td>'
      +'<td style="padding:9px 6px;white-space:nowrap">'
        +'<button onclick="umSaveUser(\''+m.id+'\')" title="ذخیره تغییرات" style="background:var(--brand-bg);color:var(--brand);border:1px solid var(--brand);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">💾 ذخیره</button> '
        +'<button onclick="umOpenPermissions(\''+m.id+'\')" title="تنظیم دسترسی" style="background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">🔐</button> '
        +'<button onclick="umResetPassword(\''+m.id+'\')" title="تغییر رمز" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">🔑</button>'
        +(centers>0?' <button onclick="umReassignAll(\''+m.id+'\')" title="جابجایی مراکز" style="background:#fef9c3;color:#854d0e;border:1px solid #fcd34d;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">🔀</button>':'')
      +'</td>'
    +'</tr>';
  }).join('');
  return '<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">'
    +'💡 غیرفعال‌کردن کاربر داده‌هایش را حذف نمی‌کند. برای جانشینی از 🔀 استفاده کنید.</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600"></th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">نام</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">کد ورود</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">نقش</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">موبایل</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">دپارتمان</th>'
    +'<th style="padding:8px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">مدیر مستقیم</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600">مراکز</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600">وضعیت</th>'
    +'<th style="padding:8px;font-size:11px;color:var(--text-muted);font-weight:600">عملیات</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="umAddUser()" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit">+ افزودن کاربر</button>'
    +'</div>';
}
function _countCentersOf(userId){
  var n=0;
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    getProvCenters(p.id).forEach(function(ctr){
      var e=getE(rtype,ctr.id);
      if((e.owner||ctr.owner||'')==userId)n++;
    });
  });
  return n;
}

function previewBulkReassign(){
  var from=(document.getElementById('brFrom')||{}).value;
  var to=(document.getElementById('brTo')||{}).value;
  var prev=document.getElementById('brPreview');
  if(!prev)return;
  if(from===to){prev.innerHTML='<span style="color:#dc2626">⚠ مبدأ و مقصد یکسان هستند</span>';return;}
  var n=_countCentersOf(from);
  var fromName=USERS[from]||from, toName=USERS[to]||to;
  prev.innerHTML=n
    ?'<strong style="color:var(--text-primary)">'+n+' مرکز</strong> از <strong>'+esc(fromName)+'</strong> به <strong>'+esc(toName)+'</strong> منتقل می‌شود.'
    :'<span style="color:#d97706">هیچ مرکزی با مسئولیت مستقیم '+esc(fromName)+' یافت نشد.</span>';
}

function executeBulkReassign(){
  var from=(document.getElementById('brFrom')||{}).value;
  var to=(document.getElementById('brTo')||{}).value;
  if(!from||!to){showToast('⚠ هر دو کارشناس را انتخاب کنید');return;}
  if(from===to){showToast('⚠ مبدأ و مقصد یکسان است');return;}
  var count=0;
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    getProvCenters(p.id).forEach(function(ctr){
      var e=getE(rtype,ctr.id);
      if((e.owner||ctr.owner||'')==from){
        setE(rtype,ctr.id,'owner',to);
        count++;
      }
    });
  });
  if(count){
    showToast('✅ '+count+' مرکز به '+esc(USERS[to]||to)+' منتقل شد',3000);
    closeModal('bulkReassignModal');
    if(currentTab==='provinces'||currentTab==='centers')renderTable();
  } else {
    showToast('⚠ مرکزی با مسئولیت مستقیم '+esc(USERS[from]||from)+' یافت نشد');
  }
}


// ══════════════════════════════════════════════════════════════
// مدیریت کاربران — نسخه ۲
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// USER MANAGEMENT SYSTEM v2
// ══════════════════════════════════════════════════════════════

var _UM_TAB = 'users';
var _UM_COLORS = ['#0ea5e9','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];

// ── Helpers ───────────────────────────────────────────────────
function umGetMembers(){
  // Always prefer server data when loaded
  if(_DEFAULT_MEMBERS&&_DEFAULT_MEMBERS.length>0)return _DEFAULT_MEMBERS;
  return (DB.settings&&DB.settings.members)||[];
}
function umGetActive(){ return umGetMembers().filter(function(m){return m.active!==false&&m.id!=='guest';}); }
function umGetColor(userId){
  var m=umGetMembers().find(function(x){return x.id===userId;});
  if(m&&m.color)return m.color;
  var idx=umGetMembers().findIndex(function(x){return x.id===userId;});
  return _UM_COLORS[Math.max(0,idx)%_UM_COLORS.length];
}
function umCountCenters(userId){
  var n=0;
  if(typeof CENTERS!=='undefined')CENTERS.forEach(function(c){var e=getE('center',c.id);if((e.owner||c.owner||'')===userId)n++;});
  if(typeof _PC_CACHE!=='undefined'&&_PC_CACHE){Object.values(_PC_CACHE).forEach(function(arr){(arr||[]).forEach(function(c){var e=getE('pc',c.id);if((e.owner||c.owner||'')===userId)n++;});});}
  return n;
}

function umSaveUser(userId){
  var nameEl=document.getElementById('um_name_'+userId);
  var roleEl=document.getElementById('um_role_'+userId);
  var phoneEl=document.getElementById('um_phone_'+userId);
  var idEl=document.getElementById('um_id_'+userId);
  var dot=document.getElementById('umdot_'+userId);
  if(!nameEl)return;
  var newName=nameEl.value.trim();
  var newRole=roleEl?roleEl.value:'کارشناس فروش';
  var newPhone=phoneEl?phoneEl.value.trim():'';
  var newColor=dot?dot.style.background:'';
  var newId=idEl?idEl.value.trim():'';
  if(!newName){showToast('⚠ نام اجباری است');return;}
  if(newId&&newId!==userId&&!/^[a-zA-Z0-9._-]+$/.test(newId)){showToast('⚠ نام کاربری فقط حروف انگلیسی، اعداد و نقطه/خط تیره');return;}
  if(newId&&newId!==userId&&USERS[newId]){showToast('⚠ این نام کاربری قبلاً وجود دارد');return;}
  var deptEl=document.getElementById('um_dept_'+userId);
  var mgrEl=document.getElementById('um_mgr_'+userId);
  var payload={display_name:newName,role:newRole,phone:newPhone};
  if(newColor)payload.color=newColor;
  if(newId&&newId!==userId)payload.new_username=newId;
  if(deptEl)payload.department=deptEl.value.trim();
  if(mgrEl)payload.direct_manager=mgrEl.value;
  fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(d){
      if(payload.new_username){
        var nu=payload.new_username;
        Object.keys(DB.edits).forEach(function(k){if(DB.edits[k].owner===userId)DB.edits[k].owner=nu;});
        getAllProvinces().forEach(function(p){var e=getE(getProvType(p.id),p.id);if(e.owner===userId)setE(getProvType(p.id),p.id,'owner',nu);});
        saveDB();
      }
      showToast('✅ «'+newName+'» ذخیره شد');buildUSERS();setTimeout(function(){umTab('users');},300);
    })
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umAddUser(){
  var roles=['کارشناس فروش','مدیر','سوپر ادمین','بازرگانی','مالی','مهمان'];
  var body='<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام نمایشی *</label>'
    +'<input id="nu_name" class="ed-inp" style="width:100%;box-sizing:border-box" placeholder="نام کامل کارشناس"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام کاربری * (انگلیسی)</label>'
    +'<input id="nu_id" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box" placeholder="مثال: ali.ahmadi"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نقش</label>'
    +'<select id="nu_role" class="ed-inp" style="width:100%;box-sizing:border-box">'+roles.map(function(r){return'<option>'+r+'</option>';}).join('')+'</select></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">موبایل</label>'
    +'<input id="nu_phone" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box" placeholder="09xxxxxxxxx"></div>'
    +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px 12px;font-size:11px;color:#15803d">'
    +'🔑 رمز اولیه: نام‌کاربری + «123» (مثلاً ali.ahmadi123)</div>'
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'addUserModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="_umDoAddUser()">✅ ایجاد کاربر</button>';
  openModal('addUserModal','+ افزودن کاربر جدید',body,foot);
  setTimeout(function(){var el=document.getElementById('nu_name');if(el)el.focus();},80);
}

function _umDoAddUser(){
  var name=(document.getElementById('nu_name')||{}).value||'';
  var id=(document.getElementById('nu_id')||{}).value||'';
  var role=(document.getElementById('nu_role')||{}).value||'کارشناس فروش';
  var phone=(document.getElementById('nu_phone')||{}).value||'';
  name=name.trim();id=id.trim().replace(/\s/g,'');
  if(!name||!id){showToast('⚠ نام و نام‌کاربری اجباری‌اند');return;}
  if(!/^[a-zA-Z0-9._\-]+$/.test(id)){showToast('⚠ نام‌کاربری: فقط حروف لاتین، عدد، نقطه، خط‌تیره');return;}
  fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:id,display_name:name,role:role,phone:phone})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){
      closeModal('addUserModal');
      showToast('✅ کاربر «'+name+'» ایجاد شد · رمز: '+id+'123',4000);
      buildUSERS();
    })
    .catch(function(e){showToast('❌ '+e.message);});
}

function umToggleActive(userId){
  var m=umGetMembers().find(function(m){return m.id===userId;});
  if(!m)return;
  if(m.active!==false){
    umConfirmDeactivate(userId,m.name,umCountCenters(userId));
  } else {
    fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:true})})
      .then(function(r){if(!r.ok)throw new Error(r.status);})
      .then(function(){showToast('✅ «'+m.name+'» فعال شد');buildUSERS();setTimeout(function(){umTab('users');},300);})
      .catch(function(e){showToast('❌ خطا: '+e.message);});
  }
}

function umConfirmDeactivate(userId,userName,centerCount){
  var activeOthers=umGetActive().filter(function(m){return m.id!==userId;});
  var toOpts=activeOthers.map(function(m){return'<option value="'+m.id+'">'+esc(m.name)+'</option>';}).join('');
  var body='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:7px;padding:10px 14px;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px">🔒 غیرفعال‌کردن «'+esc(userName)+'»</div>'
    +(centerCount>0?'<div style="font-size:12px;color:#7f1d1d">این کاربر مسئول <strong>'+centerCount+' مرکز</strong> است.</div>':'<div style="font-size:12px;color:#7f1d1d">این کاربر مراکز مستقیمی ندارد.</div>')
    +'</div>'
    +(centerCount>0&&activeOthers.length>0?'<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">انتقال مراکز به (اختیاری):</label>'
    +'<select id="deact_to" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"><option value="">— بدون انتقال —</option>'+toOpts+'</select></div>':'')
    +'<div style="font-size:12px;color:var(--text-muted)">داده‌های کاربر حفظ می‌شود.</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'deactModal\')">لغو</button>'
    +'<button style="background:#dc2626;color:#fff;border:none;border-radius:5px;padding:7px 18px;cursor:pointer;font-size:12px;font-family:inherit" onclick="_umDoDeactivate(\''+userId+'\')">🔒 غیرفعال کن</button>';
  openModal('deactModal','غیرفعال‌کردن کاربر',body,foot);
}

function _umDoDeactivate(userId){
  var toEl=document.getElementById('deact_to');
  var toId=toEl?toEl.value:'';
  if(toId)_umReassignCenters(userId,toId);
  fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false})})
    .then(function(r){if(!r.ok)throw new Error(r.status);})
    .then(function(){
      closeModal('deactModal');
      var m=umGetMembers().find(function(m){return m.id===userId;});
      showToast('🔒 «'+(m?m.name:userId)+'» غیرفعال شد');
      buildUSERS();setTimeout(function(){umTab('users');},300);
    })
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umPickColor(userId,el){
  var input=document.createElement('input');
  input.type='color';
  input.value=el.style.background.startsWith('#')?el.style.background:'#0ea5e9';
  input.style.cssText='opacity:0;position:absolute;width:1px;height:1px';
  document.body.appendChild(input);
  input.addEventListener('change',function(){
    el.style.background=input.value;
    fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({color:input.value})})
      .then(function(){buildUSERS();}).catch(function(){});
    input.remove();
  });
  input.click();
}

function umResetPassword(userId){
  var m=umGetMembers().find(function(m){return m.id===userId;});
  if(!m)return;
  var body='<div style="margin-bottom:12px">'
    +'<label style="font-size:12px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:5px">رمز جدید برای «'+esc(m.name)+'»</label>'
    +'<input id="newpw_inp" type="password" placeholder="حداقل ۶ کاراکتر" style="width:100%;padding:9px 12px;border:1.5px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);">'
    +'</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">⚠ رمز جدید از این به بعد برای ورود استفاده می‌شود.</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'pwModal\')">لغو</button>'
    +'<button class="btn-primary" onclick="umSavePassword(\''+userId+'\')">💾 ذخیره رمز</button>';
  openModal('pwModal','🔑 تغییر رمز',body,foot);
  setTimeout(function(){var el=document.getElementById('newpw_inp');if(el)el.focus();},80);
}

function umSavePassword(userId){
  var inp=document.getElementById('newpw_inp');
  if(!inp)return;
  var pw=inp.value.trim();
  if(pw.length<6){showToast('⚠ رمز باید حداقل ۶ کاراکتر باشد');return;}
  fetch('/api/users/'+encodeURIComponent(userId)+'/set-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){closeModal('pwModal');showToast('✅ رمز «'+userId+'» تغییر کرد');})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function umReassignAll(fromId){
  _UM_TAB='bulk';
  var w=document.getElementById('umWrap');
  if(w){w.innerHTML=_umBody();}
  setTimeout(function(){
    var sel=document.getElementById('bulkFrom');
    if(sel)sel.value=fromId;
  },50);
}

// ── Tab 2: Provinces ──────────────────────────────────────────
function _umProvinces(){
  var provs=getAllProvinces();
  var activeMembers=umGetActive();
  var potColors=['','#16a34a','#0ea5e9','#f59e0b','#dc2626'];

  function getOwner(p){var e=getE(getProvType(p.id),p.id);return e.owner||p.owner||'';}

  // expert cards
  var expertCards=activeMembers.map(function(m){
    var myProvs=provs.filter(function(p){return getOwner(p)===m.id;})
      .sort(function(a,b){return a.potential-b.potential||b.biopsyPct-a.biopsyPct;});
    var totalBiopsy=myProvs.reduce(function(s,p){return s+(p.biopsyPct||0);},0);
    var cTotal=myProvs.reduce(function(s,p){return s+getProvCenters(p.id).length;},0);
    var potCounts={1:0,2:0,3:0,4:0};
    myProvs.forEach(function(p){potCounts[p.potential]++;});
    var color=umGetColor(m.id);
    var provRows=myProvs.map(function(p){
      var pc=potColors[p.potential]||'#94a3b8';
      return '<div style="display:flex;align-items:center;padding:5px 10px;border-bottom:1px solid var(--border)">'
        +'<span style="flex:1;font-size:11px;color:var(--text-primary)">'+esc(p.name)+'</span>'
        +'<span style="font-size:9px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:3px;padding:1px 5px;margin-left:6px">P'+p.potential+'</span>'
        +'<span style="font-size:11px;font-weight:700;color:var(--text-secondary);min-width:44px;text-align:left">'+p.biopsyPct+'٪</span>'
        +'</div>';
    }).join('');
    var potBadges=[1,2,3,4].filter(function(lvl){return potCounts[lvl]>0;})
      .map(function(lvl){var pc=potColors[lvl];return'<span style="font-size:10px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:4px;padding:2px 6px">P'+lvl+': '+potCounts[lvl]+'</span>';}).join('');
    return '<div style="flex:1;min-width:210px;background:var(--card);border:1.5px solid var(--border);border-radius:12px;overflow:hidden">'
      +'<div style="background:'+color+'18;border-bottom:2px solid '+color+';padding:10px 12px">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'
          +'<span style="width:11px;height:11px;border-radius:50%;background:'+color+';display:inline-block;flex-shrink:0"></span>'
          +'<span style="font-weight:700;font-size:13px;color:var(--text-primary)">'+esc(m.name)+'</span>'
        +'</div>'
        +'<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">'
          +'<span style="font-size:20px;font-weight:800;color:'+color+'">'+totalBiopsy.toFixed(1)+'<span style="font-size:11px;font-weight:500;color:var(--text-muted)">٪ سهم بازار</span></span>'
        +'</div>'
        +'<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">'
          +'<span style="font-size:11px;color:var(--text-muted)">'+myProvs.length+' استان · '+cTotal+' مرکز</span>'
        +'</div>'
        +(potBadges?'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">'+potBadges+'</div>':'')
      +'</div>'
      +'<div style="max-height:200px;overflow-y:auto">'
        +(provRows||'<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center">استانی تخصیص داده نشده</div>')
      +'</div>'
    +'</div>';
  }).join('');

  // unassigned
  var unassigned=provs.filter(function(p){return!getOwner(p);});

  // assignment table
  var rows=provs.map(function(p){
    var owner=getOwner(p);
    var color=owner?umGetColor(owner):'var(--border)';
    var cCount=getProvCenters(p.id).length;
    var pc=potColors[p.potential]||'#94a3b8';
    return '<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:6px 10px;font-weight:600;color:var(--text-primary)">'
        +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+color+';margin-left:6px;vertical-align:middle" id="pdot_'+p.id+'"></span>'
        +esc(p.name)
        +'<span style="font-size:10px;color:var(--text-muted);margin-right:4px"> · '+cCount+'</span>'
        +'<span style="font-size:9px;background:'+pc+'20;color:'+pc+';border:1px solid '+pc+'44;border-radius:3px;padding:1px 4px;margin-right:2px">P'+p.potential+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted)">'+p.biopsyPct+'٪</span>'
      +'</td>'
      +'<td style="padding:6px 8px">'
        +'<select id="pown_'+p.id+'" onchange="umProvOwnerChanged(\''+p.id+'\')" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:5px;padding:4px 8px;font-size:11px;font-family:inherit;color:var(--text-primary);width:150px">'
          +activeMembers.map(function(m){return'<option value="'+m.id+'"'+(owner===m.id?' selected':'')+'>'+esc(m.name)+'</option>';}).join('')
          +'<option value=""'+(owner?'':' selected')+'>بدون مسئول</option>'
        +'</select>'
      +'</td>'
    +'</tr>';
  }).join('');

  return '<div id="provExpertCards" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">'+expertCards+'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div style="font-size:12px;color:var(--text-muted)">'+provs.length+' استان'+(unassigned.length?' · <span style="color:#f59e0b;font-weight:600">'+unassigned.length+' بدون مسئول</span>':'')+' — تغییر فوری ذخیره می‌شود</div>'
      +'<div style="display:flex;gap:6px">'+'<button onclick="umQuickAssignProvinces()" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">⚡ تقسیم مساوی</button>'+'<button onclick="showProvHistory()" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:5px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">📋 تاریخچه تغییرات</button>'+'</div>'
    +'</div>'
    +'<div style="max-height:350px;overflow-y:auto;border:1px solid var(--border);border-radius:7px">'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead style="position:sticky;top:0;background:var(--bg-raised)"><tr>'
          +'<th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-muted);border-bottom:1.5px solid var(--border)">استان</th>'
          +'<th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-muted);border-bottom:1.5px solid var(--border)">مسئول</th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function umProvOwnerChanged(provId){
  var sel=document.getElementById('pown_'+provId);if(!sel)return;
  var newOwner=sel.value;
  // log history before changing
  var prevE=getE(getProvType(provId),provId);
  var prevOwner=prevE.owner||'';
  var prov=getAllProvinces().find(function(p){return p.id===provId;});
  var prevFallback=prov?prov.owner||'':'';
  var fromOwner=prevOwner||prevFallback;
  if(fromOwner!==newOwner){
    var members=umGetMembers();
    var fromName=fromOwner?(members.find(function(m){return m.id===fromOwner;})||{name:fromOwner}).name:'بدون مسئول';
    var toName=newOwner?(members.find(function(m){return m.id===newOwner;})||{name:newOwner}).name:'بدون مسئول';
    if(!DB.provHistory)DB.provHistory=[];
    DB.provHistory.push({provId:provId,provName:prov?prov.name:provId,from:fromOwner,fromName:fromName,to:newOwner,toName:toName,at:todayStr(),ts:Date.now()});
    saveDB();
  }
  setE(getProvType(provId),provId,'owner',newOwner);
  var dot=document.getElementById('pdot_'+provId);
  if(dot)dot.style.background=newOwner?umGetColor(newOwner):'var(--border)';
  try{renderProvList&&renderProvList();}catch(e){}
  // refresh expert cards
  var cardsEl=document.getElementById('provExpertCards');
  if(cardsEl){
    var tmp=document.createElement('div');tmp.innerHTML=_umProvinces();
    var newCards=tmp.querySelector('#provExpertCards');
    if(newCards)cardsEl.innerHTML=newCards.innerHTML;
  }
}

function umQuickAssignProvinces(){
  var active=umGetActive();if(!active.length)return;
  var provs=getAllProvinces();
  provs.forEach(function(p,i){
    var owner=active[i%active.length].id;
    setE(getProvType(p.id),p.id,'owner',owner);
    var sel=document.getElementById('pown_'+p.id);
    if(sel)sel.value=owner;
    var dot=document.getElementById('pdot_'+p.id);
    if(dot)dot.style.background=umGetColor(owner);
  });
  showToast('✅ '+provs.length+' استان بین '+active.length+' کارشناس تقسیم شد',2500);
  // Refresh summary
  setTimeout(function(){var w=document.getElementById('umWrap');if(w)w.innerHTML=_umBody();},300);
}

// ── Province History ──────────────────────────────────────────
function showProvHistory(){
  var hist=(DB.provHistory||[]).slice().reverse();
  if(!hist.length){
    openModal('provHistModal','📋 تاریخچه تغییرات مسئولین استان','<div style="padding:30px;text-align:center;color:var(--text-muted)">هنوز هیچ تغییری ثبت نشده است</div>','<button class="btn-secondary" onclick="closeModal(\'provHistModal\')">بستن</button>',{lg:true});
    return;
  }
  // Group by date
  var grouped={};
  hist.forEach(function(h){
    var d=h.at||'نامشخص';
    if(!grouped[d])grouped[d]=[];
    grouped[d].push(h);
  });
  var html='<div style="max-height:65vh;overflow-y:auto">';
  Object.keys(grouped).sort().reverse().forEach(function(date){
    html+='<div style="margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">📅 '+date+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px">';
    grouped[date].forEach(function(h){
      html+='<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px">'
        +'<span style="font-weight:700;font-size:12px;color:var(--text-primary);flex:1">'+esc(h.provName||h.provId)+'</span>'
        +'<span style="font-size:11px;color:var(--text-muted)">'+esc(h.fromName||'بدون مسئول')+'</span>'
        +'<span style="font-size:13px;color:#0ea5e9">→</span>'
        +'<span style="font-size:11px;font-weight:600;color:var(--text-primary)">'+esc(h.toName||'بدون مسئول')+'</span>'
      +'</div>';
    });
    html+='</div></div>';
  });
  html+='</div>';
  var foot='<button onclick="if(confirm(\'پاک کردن کل تاریخچه؟\')){DB.provHistory=[];saveDB();closeModal(\'provHistModal\');showToast(\'تاریخچه پاک شد\')}" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:5px 14px;cursor:pointer;font-size:11px;font-family:inherit">🗑 پاک کردن</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'provHistModal\')" style="margin-right:8px">بستن</button>';
  openModal('provHistModal','📋 تاریخچه تغییرات مسئولین استان',html,foot,{lg:true});
}

// ── Tab 3: Bulk Reassign ──────────────────────────────────────
function _umBulk(){
  var allMembers=umGetMembers().filter(function(m){return m.id!=='guest';});
  var active=umGetActive();
  var fromOpts=allMembers.map(function(m){
    var n=umCountCenters(m.id);
    var dot='● ';
    return '<option value="'+m.id+'">'+(m.active===false?'[غیرفعال] ':'')+esc(m.name)+' — '+n+' مرکز</option>';
  }).join('');
  var toOpts=active.map(function(m){
    return '<option value="'+m.id+'">'+esc(m.name)+'</option>';
  }).join('');

  return '<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:9px 14px;margin-bottom:16px;font-size:12px;color:var(--text-secondary)">'
    +'📌 تمام مراکز کارشناس مبدأ (مسئولیت مستقیم) به مقصد منتقل می‌شود. بک‌آپ پیش از اجرا توصیه می‌شود.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
    +'<div><label style="font-size:12px;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px">👤 مبدأ (از)</label>'
    +'<select id="brFrom" onchange="previewBulkReassign()" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12.5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+fromOpts+'</select></div>'
    +'<div><label style="font-size:12px;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px">👤 مقصد (به)</label>'
    +'<select id="brTo" onchange="previewBulkReassign()" style="width:100%;padding:8px;border:1.5px solid var(--border-input);border-radius:6px;font-size:12.5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'+toOpts+'</select></div>'
    +'</div>'
    +'<div id="brPreview" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:10px 14px;font-size:12px;color:var(--text-secondary);min-height:40px;margin-bottom:14px">برای پیش‌نمایش، از/به را انتخاب کنید.</div>'
    +'<button onclick="executeBulkReassign()" style="background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:9px 24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%">✅ انجام جابجایی</button>';
}



function umOpenPermissions(userId){
  var m=umGetMembers().find(function(m){return m.id===userId;});
  if(!m){showToast('⚠ کاربر یافت نشد');return;}
  var perms=m.permissions||{};
  var modPerms=perms.modules||{};
  var allowedProvs=perms.provinces||[];
  var modules=[
    ['provinces','استان‌ها/مراکز'],['weekplan','برنامه هفته'],['tasks','وظایف'],
    ['calendar','تقویم'],['kpi','KPI مدیر'],['manager','بررسی مدیر'],
    ['mtr','مطالبات'],['pricing','قیمت‌گذاری'],['proforma','پیش‌فاکتور'],
    ['support','پشتیبانی'],['hr','منابع انسانی'],['trade-kpi','بازرگانی'],
    ['changelog','لاگ تغییرات']
  ];
  var provs=typeof getAllProvinces==='function'?getAllProvinces():[];
  var modRows=modules.map(function(mod){
    var key=mod[0],label=mod[1];
    var cur=modPerms[key]||'edit';
    var lvlColors={none:'#dc2626',view:'#d97706',edit:'#16a34a'};
    return '<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:8px 10px;font-size:12px;color:var(--text-primary)">'+label+'</td>'
      +['none','view','edit'].map(function(lvl){
        var checked=cur===lvl?' checked':'';
        return '<td style="padding:8px;text-align:center">'
          +'<input type="radio" name="perm_'+key+'" value="'+lvl+'"'+checked+' style="cursor:pointer;accent-color:'+lvlColors[lvl]+';width:14px;height:14px">'
          +'</td>';
      }).join('')
      +'</tr>';
  }).join('');
  var provBoxes=provs.map(function(p){
    var checked=allowedProvs.length===0||allowedProvs.indexOf(p.id)>=0?' checked':'';
    return '<label style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:11px">'
      +'<input type="checkbox" name="prov_perm" value="'+esc(p.id)+'"'+checked+' style="cursor:pointer">'+esc(p.name)+'</label>';
  }).join('');
  var body='<div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:7px;padding:8px 14px;margin-bottom:14px;font-size:12px;color:#5b21b6">'
    +'🔐 دسترسی برای: <strong>'+esc(m.name)+'</strong> — خالی بودن permissions = دسترسی کامل</div>'
    +'<div style="overflow-x:auto;margin-bottom:16px"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text-muted)">ماژول</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:#dc2626">ندارد</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:#d97706">فقط دیدن</th>'
    +'<th style="padding:8px;text-align:center;font-size:11px;color:#16a34a">ویرایش کامل</th>'
    +'</tr></thead><tbody>'+modRows+'</tbody></table></div>'
    +'<div style="margin-bottom:8px">'
    +'<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px">استان‌های مجاز '
    +'<span style="font-weight:400;color:var(--text-muted)">(همه انتخاب = دسترسی به همه استان‌ها)</span></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;max-height:160px;overflow-y:auto;padding:8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px" id="permProvBox">'
    +(provs.length?provBoxes:'<span style="font-size:11px;color:var(--text-muted)">استانی بارگذاری نشده</span>')
    +'</div></div>'
    +'<div style="display:flex;gap:8px;margin-top:6px">'
    +'<button onclick="umPermSelectAll(true)" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">✅ همه استان‌ها</button>'
    +'<button onclick="umPermSelectAll(false)" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">✗ هیچ‌کدام</button>'
    +'</div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'permModal\')">لغو</button>'
    +'<button onclick="umSavePermissions(\''+userId+'\')" style="background:#7c3aed;color:#fff;border:none;border-radius:5px;padding:7px 18px;cursor:pointer;font-size:12px;font-family:inherit">💾 ذخیره دسترسی</button>';
  openModal('permModal','🔐 مدیریت دسترسی: '+esc(m.name),body,foot,{lg:true});
}

function umPermSelectAll(select){
  var el=document.getElementById('permProvBox');
  if(!el)return;
  el.querySelectorAll('input[type=checkbox]').forEach(function(cb){cb.checked=select;});
}

function umSavePermissions(userId){
  var modules=['provinces','weekplan','tasks','calendar','kpi','manager','mtr','pricing','proforma','support','hr','trade-kpi','changelog'];
  var modPerms={};
  modules.forEach(function(mod){
    var radios=document.querySelectorAll('input[name="perm_'+mod+'"]');
    radios.forEach(function(r){if(r.checked)modPerms[mod]=r.value;});
  });
  var checkedProvs=[];
  var allProvs=typeof getAllProvinces==='function'?getAllProvinces():[];
  var el=document.getElementById('permProvBox');
  if(el)el.querySelectorAll('input[type=checkbox]').forEach(function(cb){if(cb.checked)checkedProvs.push(cb.value);});
  var provList=checkedProvs.length===allProvs.length?[]:checkedProvs;
  var permissions={modules:modPerms,provinces:provList};
  fetch('/api/users/'+encodeURIComponent(userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({permissions:permissions})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){closeModal('permModal');showToast('✅ دسترسی‌های «'+userId+'» ذخیره شد');buildUSERS();})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function buildUSERS(){
  // Fetch from server API and populate USERS map + _DEFAULT_MEMBERS
  fetch('/api/users')
    .then(function(r){return r.json();})
    .then(function(list){
      USERS={};
      _DEFAULT_MEMBERS=list.map(function(m){
        USERS[m.username]=m.display_name;
        return{id:m.username,name:m.display_name,role:m.role,color:m.color,phone:m.phone||'',active:m.active,department:m.department||'',direct_manager:m.direct_manager||'',permissions:m.permissions||{}};
      });
      // Also sync to DB.settings.members so legacy code works
      if(DB.settings)DB.settings.members=_DEFAULT_MEMBERS;
      _buildUSERSUI();
      if(typeof buildOwnerFilter==='function')buildOwnerFilter();
    })
    .catch(function(){
      // Fallback to DB.settings.members if server unavailable
      USERS={};
      var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
      members.forEach(function(m){if(m.id&&m.name&&m.active!==false)USERS[m.id]=m.name;});
      _buildUSERSUI();
    });
}
function _buildUSERSUI(){
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var activeMembers=members.filter(function(m){return m.active!==false;});
  var sel=document.getElementById('uSel');
  if(sel){
    var cur=DB._lastUser||currentUser;
    sel.innerHTML=activeMembers.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+(m.role?' — '+m.role:'')+'</option>';}).join('');
    if(USERS[cur])sel.value=cur;
    else if(activeMembers.length)sel.value=activeMembers[0].id;
    currentUser=sel.value;
    var dot=document.getElementById('uSelDot');
    if(dot)dot.style.background=umGetColor(currentUser);
  }
  // Update currentUserDisplay (server-auth mode)
  var cuDisp=document.getElementById('currentUserDisplay');
  if(cuDisp)cuDisp.textContent=USERS[currentUser]||currentUser;
  // filterOwner dropdown
  var fown=document.getElementById('filterOwner');
  if(fown){
    var prevVal=fown.value;
    fown.innerHTML='<option value="">همه مسئولان</option>'
      +activeMembers.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';}).join('');
    if(prevVal)fown.value=prevVal;
  }
  if(!USERS[currentUser]&&activeMembers.length)currentUser=activeMembers[0].id;
  if(typeof _kpiUser!=='undefined'&&_kpiUser&&!USERS[_kpiUser])
    _kpiUser=Object.keys(USERS)[0]||null;
  var h1=document.getElementById('companyNameH1');
  var cn=(DB.settings&&DB.settings.companyName)||'پورتال فروش';
  if(h1)h1.textContent=cn;
}

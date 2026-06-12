// ════════════════════════ INIT ════════════════════════
var _typeFilterBuilt=false;
function buildTypeFilter(){
  if(_typeFilterBuilt)return;_typeFilterBuilt=true;
  var types=new Set();
  CENTERS.forEach(function(c){if(c.type)types.add(c.type.trim());});
  Object.values(PC_RAW).forEach(function(arr){arr.forEach(function(r){if(r[3])types.add(r[3].replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim());});});
  (DB.extra||[]).forEach(function(c){if(c.type)types.add(c.type.trim());});
  var ft=document.getElementById('fType');
  if(ft){
    var prev=ft.value;
    ft.innerHTML='<option value="">همه انواع</option>';
    Array.from(types).sort().forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;ft.appendChild(o);});
    if(prev)ft.value=prev;
  }
}
// ════════════════════════ SETTINGS MODAL ═════════════════════════════
function openSettings(){
  var s=DB.settings||{};
  var members=s.members||_DEFAULT_MEMBERS;
  var companyName=s.companyName||'آتنا زیست درمان';
  var companyInfo=s.companyInfo||'';
  var sipDomain=s.sipDomain||'';
  var anthropicKey=s.anthropicKey||'';
  var ckItems=s.ckItems||CK_ITEMS_DEFAULT;

  var membersHtml=members.map(function(m,i){
    return'<tr id="mrow_'+i+'">'
      +'<td><input class="ed-inp" style="width:110px" value="'+esc(m.id)+'" id="mid_'+i+'" placeholder="کد کاربری (انگلیسی)"></td>'
      +'<td><input class="ed-inp" style="width:110px" value="'+esc(m.name)+'" id="mname_'+i+'" placeholder="نام و نام خانوادگی"></td>'
      +'<td><input class="ed-inp" style="width:90px" value="'+esc(m.role||'')+'" id="mrole_'+i+'" placeholder="سمت"></td>'
      +'<td><button onclick="removeMemberRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px">✕</button></td>'
      +'</tr>';
  }).join('');

  var ckHtml=ckItems.map(function(item,i){
    return'<div id="ckrow_'+i+'" style="display:flex;gap:6px;align-items:center;margin-bottom:5px">'
      +'<input class="ed-inp" style="flex:1" value="'+esc(item.t)+'" id="ckt_'+i+'" placeholder="متن وظیفه">'
      +'<label style="font-size:11px;display:flex;gap:3px;align-items:center"><input type="checkbox" id="ckmgr_'+i+'"'+(item.mgr?' checked':'')+'>مدیر</label>'
      +'<button onclick="removeCKRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">✕</button>'
      +'</div>';
  }).join('');

  var body='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نام شرکت</label>'
    +'<input id="stgCompanyName" class="ed-inp" style="width:100%" value="'+esc(companyName)+'" placeholder="نام شرکت"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">توضیحات/اطلاعات شرکت</label>'
    +'<input id="stgCompanyInfo" class="ed-inp" style="width:100%" value="'+esc(companyInfo)+'" placeholder="توضیحات اختیاری"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">📞 آدرس سرور SIP (VoIP)</label>'
    +'<input id="stgSipDomain" class="ed-inp" style="width:100%" value="'+esc(sipDomain)+'" placeholder="مثلاً: pbx.company.com">'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">برای تماس با Linphone — خالی = tel:</div>'
    +'</div>'
    +'</div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">🤖 کلید API کلود (Anthropic)</label>'
    +'<input id="stgAnthropicKey" class="ed-inp" style="width:100%" type="password" value="'+esc(anthropicKey)+'" placeholder="sk-ant-api03-...">'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">برای جستجوی هوشمند مراکز (KPI ← مراکز کشف‌شده)</div>'
    +'</div>'
    +'<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:3px">👥 مدیریت کاربران</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">کارشناسان، نقش‌ها، رنگ‌ها، مالکیت استان‌ها و جابجایی مراکز</div>'
    +'</div>'
    +'<button onclick="closeModal(\'settingsModal\');openUserMgmt()" style="background:var(--brand);color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600">باز کردن ←</button>'
    +'</div>'
    +'<div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<label style="font-size:12px;font-weight:700">✅ وظایف چک‌لیست روزانه</label>'
    +'<button onclick="addCKRow()" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:11px">+ وظیفه جدید</button>'
    +'</div>'
    +'<div id="ckItemsList" style="max-height:220px;overflow-y:auto;padding:4px 0">'+ckHtml+'</div>'
    +'</div>'
    // ── برچسب‌های مراکز
    +'<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +'<label style="font-size:12px;font-weight:700">🏷 برچسب‌های مراکز</label>'
    +'<button onclick="addTagRow()" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:11px">+ برچسب جدید</button>'
    +'</div>'
    +'<div id="tagsSettingsList" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;min-height:32px">'
    +(DB.tags||[]).map(function(t,i){
      return'<div style="display:flex;align-items:center;gap:4px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:4px 6px">'
        +'<input type="color" value="'+t.color+'" id="tagcolor_'+t.id+'" style="width:24px;height:24px;border:none;cursor:pointer;background:none" title="رنگ">'
        +'<input type="text" value="'+esc(t.name)+'" id="tagname_'+t.id+'" style="border:none;background:none;font-size:12px;width:90px;outline:1px solid transparent" onfocus="this.style.outline=\'1px solid #0ea5e9\'" onblur="this.style.outline=\'1px solid transparent\'">'
        +'<button onclick="deleteTagFromSettings(\''+t.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;padding:1px 5px;font-size:11px">✕</button>'
        +'</div>';
    }).join('')
    +'</div></div>';

  // بخش ویرایش لیست‌های سیستمی — فقط مدیر
  if(_isManager()){
    body+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      +'<label style="font-size:12px;font-weight:700">⚙ ویرایش لیست‌های سیستمی</label>'
      +'<span style="font-size:10px;color:var(--text-muted);background:var(--bg-raised);border-radius:4px;padding:2px 7px">فقط مدیر</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:7px 10px;margin-bottom:10px">'
      +'⚠ هر آیتم در یک خط — تغییر وضعیت‌ها بر داده‌های ثبت‌شده تأثیر می‌گذارد.</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">📊 وضعیت‌ها</label>'
      +'<textarea id="stgStatusList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+STATUS_LIST.join('\n')+'</textarea></div>'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🎯 سرنخ‌ها</label>'
      +'<textarea id="stgLeadList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+LEAD_LIST.join('\n')+'</textarea></div>'
      +'<div><label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">🏥 نوع مراکز</label>'
      +'<textarea id="stgTypeList" style="width:100%;height:130px;padding:6px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:11px;direction:rtl;font-family:inherit;resize:none;background:var(--bg-input);color:var(--text-primary);box-sizing:border-box">'+TYPE_LIST.join('\n')+'</textarea></div>'
      +'</div></div>';
  }
  var foot='<button class="btn-secondary" onclick="closeModal(\'settingsModal\')">انصراف</button>'
    +'<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #fcd34d;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="cleanupOrphanedEntries(true);renderDashboard()">🧹 پاک‌سازی ورودی‌های منسوخ</button>'
    +'<button style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid #7dd3fc;border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit" onclick="var n=wpDeduplicateEntries();if(n>0){saveDBSync();renderWeekPlan();showToast(\'✅ \'+n+\' ورودی تکراری هفته حذف شد\',3000);}else{showToast(\'✅ هیچ تکراری یافت نشد\');}">📋 حذف تکراری‌های هفته</button>'
    +'<button class="btn-primary" onclick="saveSettings()">💾 ذخیره تنظیمات</button>';
  // Backup/Restore JSON section
  body += '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">💾 پشتیبان‌گیری داده‌ها</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="exportDBJson()" class="btn-secondary" style="font-size:12px">📥 دانلود پشتیبان JSON</button>'
    +'<label class="btn-secondary" style="font-size:12px;cursor:pointer">📤 بازیابی از فایل<input type="file" accept=".json" onchange="importDBJson(this)" style="display:none"></label>'
    +'</div>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:6px">پشتیبان شامل همه مراکز، یادداشت‌ها، تنظیمات و مطالبات می‌شود</div>'
    +'</div>';
  // Data management section
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="font-size:12px;font-weight:700;margin-bottom:10px">📂 مدیریت داده‌ها</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">'
    +'<button onclick="closeModal(\'settingsModal\');openUnifiedBackup()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">💾</span><span style=\"font-weight:600\">بک‌آپ / ریستور</span><span style=\"color:var(--text-muted);font-size:10px\">خروجی و بازیابی داده</span></button>'
    +'<button onclick="closeModal(\'settingsModal\');openDBManager()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📦</span><span style=\"font-weight:600\">دیتابیس مراکز</span><span style=\"color:var(--text-muted);font-size:10px\">مدیریت لیست اصلی</span></button>'
    +'<button onclick="closeModal(\'settingsModal\');document.getElementById(\'importCentersInp\').click()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📥</span><span style=\"font-weight:600\">ورود از اکسل</span><span style=\"color:var(--text-muted);font-size:10px\">افزودن مراکز جدید</span></button>'
    +'<button onclick="exportCentersExcel();closeModal(\'settingsModal\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;font-size:11px;font-family:inherit;color:var(--text-primary)"><span style=\"font-size:18px\">📊</span><span style=\"font-weight:600\">خروجی اکسل</span><span style=\"color:var(--text-muted);font-size:10px\">دانلود همه مراکز</span></button>'
    +'<button onclick="if(confirm(\'پاکسازی همه داده‌ها؟\'))clearAllData()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid #fca5a5;border-radius:8px;background:#fee2e220;cursor:pointer;font-size:11px;font-family:inherit;color:#dc2626"><span style=\"font-size:18px\">🗑</span><span style=\"font-weight:600\">پاکسازی داده‌ها</span><span style=\"font-size:10px\">حذف کامل اطلاعات</span></button>'
    +(_isManager()?'<button onclick="closeModal(\'settingsModal\');openDistributionWizard()" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:1px solid #c4b5fd;border-radius:8px;background:#f5f3ff;cursor:pointer;font-size:11px;font-family:inherit;color:#5b21b6"><span style=\"font-size:18px\">🔀</span><span style=\"font-weight:600\">تقسیم مراکز</span><span style=\"color:var(--text-muted);font-size:10px\">توزیع بین کارشناسان</span></button>':'')
    +'</div></div>';
  // ── Onboarding tutorial section
  var _obIsDisabled = DB.settings&&DB.settings.onboardingDisabled&&DB.settings.onboardingDisabled[currentUser];
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:3px">🎓 آموزش راهنما</div>'
    +'<div style="font-size:11px;color:var(--text-muted)">نمایش راهنمای ۷ روزه برای کاربران تازه</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +(_obIsDisabled
      ? '<span style="font-size:11px;color:var(--text-muted);background:var(--bg-raised);border-radius:4px;padding:3px 8px">غیرفعال</span>'
        +'<button onclick="_reEnableOnboarding();closeModal(\'settingsModal\')" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">فعال‌سازی مجدد</button>'
      : '<span style="font-size:11px;color:#16a34a;background:#dcfce7;border-radius:4px;padding:3px 8px">فعال</span>'
        +'<button onclick="_dismissOnboarding(true);closeModal(\'settingsModal\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit">غیرفعال‌کردن</button>')
    +'</div>'
    +'</div></div>';
  openModal('settingsModal','⚙ تنظیمات نرم‌افزار',body,foot,{lg:true});
}

function addMemberRow(){
  var tbody=document.getElementById('membersTable');if(!tbody)return;
  var i=tbody.rows.length;
  var tr=document.createElement('tr');tr.id='mrow_'+i;
  tr.innerHTML='<td><input class="ed-inp" style="width:110px" id="mid_'+i+'" placeholder="کد کاربری"></td>'
    +'<td><input class="ed-inp" style="width:110px" id="mname_'+i+'" placeholder="نام"></td>'
    +'<td><input class="ed-inp" style="width:90px" id="mrole_'+i+'" placeholder="سمت"></td>'
    +'<td><button onclick="removeMemberRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px">✕</button></td>';
  tbody.appendChild(tr);
}
function removeMemberRow(i){var r=document.getElementById('mrow_'+i);if(r)r.remove();}

function addCKRow(){
  var list=document.getElementById('ckItemsList');if(!list)return;
  var i=list.children.length;
  var div=document.createElement('div');div.id='ckrow_'+i;
  div.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:5px';
  div.innerHTML='<input class="ed-inp" style="flex:1" id="ckt_'+i+'" placeholder="متن وظیفه">'
    +'<label style="font-size:11px;display:flex;gap:3px;align-items:center"><input type="checkbox" id="ckmgr_'+i+'">مدیر</label>'
    +'<button onclick="removeCKRow('+i+')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">✕</button>';
  list.appendChild(div);
}
function removeCKRow(i){var r=document.getElementById('ckrow_'+i);if(r)r.remove();}

function saveSettings(){
  var companyName=(document.getElementById('stgCompanyName').value||'').trim()||'شرکت';
  var companyInfo=(document.getElementById('stgCompanyInfo').value||'').trim();
  // Members managed via openUserMgmt — preserve existing
  var members = umGetMembers();
  // collect ck items
  var ckList=document.getElementById('ckItemsList');
  var ckItems=[];
  if(ckList){Array.from(ckList.children).forEach(function(div,i){
    var t=(document.getElementById('ckt_'+i)||{}).value;
    var mgr=(document.getElementById('ckmgr_'+i)||{}).checked;
    if(t&&t.trim())ckItems.push({id:i+1,t:t.trim(),mgr:mgr||undefined});
  });}
  if(!ckItems.length)ckItems=null;
  if(!DB.settings)DB.settings={};
  DB.settings.companyName=companyName;
  DB.settings.companyInfo=companyInfo;
  var _sipDomRaw=(document.getElementById('stgSipDomain')||{}).value||'';
  DB.settings.sipDomain=_sipDomRaw.trim().replace(/^\/+|\/+$/g,'');
  var _anthKey=(document.getElementById('stgAnthropicKey')||{}).value||'';
  if(_anthKey.trim())DB.settings.anthropicKey=_anthKey.trim();
  DB.settings.members=members;
  DB.settings.ckItems=ckItems;
  // ذخیره برچسب‌های ویرایش‌شده
  if(!DB.tags)DB.tags=[];
  DB.tags.forEach(function(t){
    var nameEl=document.getElementById('tagname_'+t.id);
    var colorEl=document.getElementById('tagcolor_'+t.id);
    if(nameEl&&nameEl.value.trim())t.name=nameEl.value.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    if(colorEl)t.color=colorEl.value;
  });
  // ذخیره لیست‌های سفارشی
  if(_isManager()){
    var _staTa=document.getElementById('stgStatusList');
    if(_staTa){var _sl=_staTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_sl.length>=2){DB.settings.statusList=_sl;STATUS_LIST=_sl;}}
    var _ldTa=document.getElementById('stgLeadList');
    if(_ldTa){var _ll=_ldTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_ll.length>=2){DB.settings.leadList=_ll;LEAD_LIST=_ll;}}
    var _tpTa=document.getElementById('stgTypeList');
    if(_tpTa){var _tl=_tpTa.value.split('\n').map(function(l){return l.trim();}).filter(Boolean);if(_tl.length>=1){DB.settings.typeList=_tl;TYPE_LIST=_tl;}}
  }
  saveDB();
  buildUSERS();
  closeModal('settingsModal');
  rebuildFilters();
  if(currentTab==='checklist')renderChecklist();
  showToast('✅ تنظیمات ذخیره شد',2500);
}

function addTagRow(){
  if(!DB.tags)DB.tags=[];
  var colors=['#0ea5e9','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#ec4899','#84cc16'];
  var newTag={id:'tag_'+Date.now(),name:'برچسب جدید',color:colors[DB.tags.length%colors.length]};
  DB.tags.push(newTag);saveDB();
  var list=document.getElementById('tagsSettingsList');
  if(!list)return;
  var div=document.createElement('div');
  div.style.cssText='display:flex;align-items:center;gap:4px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:4px 6px';
  div.innerHTML='<input type="color" value="'+newTag.color+'" id="tagcolor_'+newTag.id+'" style="width:24px;height:24px;border:none;cursor:pointer;background:none">'
    +'<input type="text" value="'+newTag.name+'" id="tagname_'+newTag.id+'" style="border:none;background:none;font-size:12px;width:90px;outline:1px solid #0ea5e9" autofocus>'
    +'<button onclick="deleteTagFromSettings(\''+newTag.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;padding:1px 5px;font-size:11px">✕</button>';
  list.appendChild(div);
  setTimeout(function(){div.querySelector('input[type=text]').focus();},50);
}

function deleteTagFromSettings(tagId){
  if(!confirm('این برچسب از همه مراکز حذف می‌شود. ادامه می‌دهید؟'))return;
  DB.tags=(DB.tags||[]).filter(function(t){return t.id!==tagId;});
  Object.keys(DB.rTags||{}).forEach(function(k){
    DB.rTags[k]=(DB.rTags[k]||[]).filter(function(id){return id!==tagId;});
  });
  saveDB();
  var el=document.getElementById('tagcolor_'+tagId);
  if(el&&el.closest('div'))el.closest('div').remove();
}

// ════════════════════════ MANAGER KPI PANEL ══════════════════════
function renderManagerPanel(){
  var el=document.getElementById('managerPanel');if(!el)return;
  var today=todayStr();
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  // compute stats per member
  var stats={};
  members.forEach(function(m){
    stats[m.id]={name:m.name,role:m.role||'',contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
  });
  // scan all edits
  _buildPCCache();
  var allProvs=getAllProvinces();
  allProvs.forEach(function(p){
    var rtype=getProvType(p.id);
    var centers=getProvCenters(p.id);
    centers.forEach(function(c){
      var e=getE(rtype,c.id);
      var owner=e.owner||c.owner||'';
      if(!stats[owner])return;
      stats[owner].totalAssigned++;
      var st=e.status||'بدون تماس';
      if(st==='قرارداد بسته شد')stats[owner].contracted++;
      else if(st==='ملاقات انجام شد')stats[owner].meetings++;
      else if(st==='پیشنهاد ارسال شد')stats[owner].proposals++;
      else if(st==='تماس اولیه')stats[owner].firstContact++;
      var fd=e.followupDate||'';
      if(fd&&fd<today&&st!=='قرارداد بسته شد'&&st!=='غیرفعال')stats[owner].overdue++;
      if(fd&&fd===today)stats[owner].followupToday++;
      if(isStalled(rtype,c.id))stats[owner].stalled++;
    });
  });
  // totals
  var total={contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
  Object.values(stats).forEach(function(s){Object.keys(total).forEach(function(k){total[k]+=s[k]||0;});});

  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0)+(DB.extra||[]).length;

  var html='<div style="padding:14px">';
  // quick-action bar for manager
  html+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">'
    +'<button onclick="openDailyMonitor()" style="flex:1;min-width:200px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📋 گزارش فعالیت امروز</button>'
    +'<button onclick="openOverdueList()" style="flex:1;min-width:160px;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🔴 پیگیری‌های معوق</button>'
    +'</div>';
  // summary cards
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px">';
  [
    {n:totalCenters,l:'کل مراکز',c:'#0ea5e9'},
    {n:total.totalAssigned,l:'مراکز تخصیص‌یافته',c:'#8b5cf6'},
    {n:total.contracted,l:'قرارداد بسته شد ✓',c:'#22c55e'},
    {n:total.meetings,l:'ملاقات انجام شد',c:'#f59e0b'},
    {n:total.proposals,l:'پیشنهاد ارسال',c:'#0284c7'},
    {n:total.overdue,l:'پیگیری معوق 🔴',c:'#dc2626',click:'openOverdueList()'},
    {n:total.followupToday,l:'پیگیری امروز 📅',c:'#f59e0b'},
    {n:total.stalled,l:'راکد +۳۰روز 🟠',c:'#ea580c'},
  ].forEach(function(k){
    html+='<div class="kpi-card" style="border-right-color:'+k.c+(k.click?';cursor:pointer':'')+'"'+(k.click?' onclick="'+k.click+'"':'')+'>'
      +'<div class="kpi-num" style="font-size:28px">'+k.n+'</div>'
      +'<div class="kpi-label">'+k.l+'</div></div>';
  });
  html+='</div>';

  // per-member table
  html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden">'
    +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📋 عملکرد کارشناسان</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:8px 10px;text-align:right">کارشناس</th>'
    +'<th style="padding:8px 10px;text-align:center">مراکز</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#22c55e">قرارداد ✓</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#f59e0b">ملاقات</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#0284c7">پیشنهاد</th>'
    +'<th style="padding:8px 10px;text-align:center;color:var(--text-muted)">تماس اولیه</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#dc2626">معوق 🔴</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#f59e0b">امروز 📅</th>'
    +'<th style="padding:8px 10px;text-align:center;color:#ea580c">راکد</th>'
    +'<th style="padding:8px 10px;text-align:center">نرخ تبدیل</th>'
    +'</tr></thead><tbody>';

  members.filter(function(m){return m.id!=='guest';}).forEach(function(m,i){
    var s=stats[m.id]||{contracted:0,meetings:0,proposals:0,firstContact:0,overdue:0,followupToday:0,totalAssigned:0,stalled:0};
    var conv=s.totalAssigned>0?Math.round((s.contracted/s.totalAssigned)*100):0;
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    html+='<tr style="background:'+bg+';border-bottom:1px solid #f1f5f9">'
      +'<td style="padding:8px 10px;font-weight:600;cursor:pointer" onclick="openManagerDrilldown(\''+m.id+'\')" title="کلیک برای جزئیات"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+(window.umGetColor?umGetColor(m.id):'#94a3b8')+'"></span>'+esc(m.name)+'</span><br><span style="font-size:10px;color:var(--text-muted);font-weight:400">'+esc(m.role)+'</span></td>'
      +'<td style="text-align:center;padding:8px">'+s.totalAssigned+'</td>'
      +'<td style="text-align:center;padding:8px;font-weight:700;color:#16a34a">'+s.contracted+'</td>'
      +'<td style="text-align:center;padding:8px;color:#854d0e">'+s.meetings+'</td>'
      +'<td style="text-align:center;padding:8px;color:#0369a1">'+s.proposals+'</td>'
      +'<td style="text-align:center;padding:8px;color:var(--text-secondary)">'+s.firstContact+'</td>'
      +'<td style="text-align:center;padding:8px;color:#dc2626;font-weight:600;cursor:pointer" onclick="openOverdueList(\''+m.id+'\')">'+s.overdue+(s.overdue>0?' 🔴':'')+'</td>'
      +'<td style="text-align:center;padding:8px;color:#854d0e">'+s.followupToday+'</td>'
      +'<td style="text-align:center;padding:8px;color:#ea580c">'+s.stalled+'</td>'
      +'<td style="text-align:center;padding:8px">'
        +'<div style="background:#e2e8f0;border-radius:9px;height:8px;width:70px;display:inline-block;overflow:hidden">'
        +'<div style="background:#22c55e;height:100%;width:'+Math.min(100,conv)+'%"></div></div>'
        +'<span style="font-size:11px;margin-right:4px">'+conv+'%</span>'
      +'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div></div>';

  // ── Pipeline Matrix (potential x status) ──────────────────
  (function(){
    var potLevels=[1,2,3,4];
    var potLabels={'1':'پتانسیل ۱ (بالا)','2':'پتانسیل ۲','3':'پتانسیل ۳','4':'پتانسیل ۴ (پایین)'};
    var potColors={'1':'#16a34a','2':'#0284c7','3':'#f59e0b','4':'#94a3b8'};
    var matrix={};
    potLevels.forEach(function(p){matrix[p]={};STATUS_LIST.forEach(function(s){matrix[p][s]=[];});});
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var pot=String(e.potential!==undefined?e.potential:(c.potential||4));
        var st=e.status||'بدون تماس';
        if(matrix[pot]&&matrix[pot][st]!==undefined){
          matrix[pot][st].push({rtype:rt,id:c.id,name:e.nameOverride||c.name});
        }
      });
    });
    var stColors={'بدون تماس':'#94a3b8','تماس اولیه':'#0ea5e9','ملاقات انجام شد':'#f59e0b','پیشنهاد ارسال شد':'#0284c7','قرارداد بسته شد':'#22c55e','غیرفعال':'#dc2626'};
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:18px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 ماتریس پایپ‌لاین — پتانسیل × وضعیت</div>'
      +'<div style="overflow-x:auto;padding:12px"><table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:6px 10px;text-align:right;white-space:nowrap">پتانسیل</th>';
    STATUS_LIST.forEach(function(s){
      html+='<th style="padding:6px 8px;text-align:center;border-right:1px solid var(--border);white-space:nowrap;color:'+(stColors[s]||'#555')+'">'
        +esc(s)+'</th>';
    });
    html+='<th style="padding:6px 8px;text-align:center;font-weight:700">جمع</th>'
      +'</tr></thead><tbody>';
    potLevels.forEach(function(p){
      var rowTotal=0;
      STATUS_LIST.forEach(function(s){rowTotal+=(matrix[p][s]||[]).length;});
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:6px 10px;font-weight:700;color:'+(potColors[p]||'#555')+'">'+potLabels[p]+'</td>';
      STATUS_LIST.forEach(function(s){
        var cells=matrix[p][s]||[];
        var cnt=cells.length;
        var tooltip=cells.slice(0,5).map(function(c){return c.name;}).join('، ')+(cells.length>5?'…':'');
        html+='<td style="text-align:center;padding:6px 8px;border-right:1px solid var(--border)">'
          +(cnt>0?'<span title="'+esc(tooltip)+'" style="display:inline-block;min-width:24px;padding:2px 6px;border-radius:10px;background:'+(stColors[s]||'#e2e8f0')+'22;color:'+(stColors[s]||'#555')+';font-weight:700;cursor:default">'+cnt+'</span>':'<span style="color:var(--text-muted)">—</span>')
          +'</td>';
      });
      html+='<td style="text-align:center;padding:6px 8px;font-weight:700">'+rowTotal+'</td>'
        +'</tr>';
    });
    // totals row
    html+='<tr style="background:var(--bg-raised);font-weight:700"><td style="padding:6px 10px">جمع کل</td>';
    var grandTotal=0;
    STATUS_LIST.forEach(function(s){
      var colTotal=potLevels.reduce(function(sum,p){return sum+(matrix[p][s]||[]).length;},0);
      grandTotal+=colTotal;
      html+='<td style="text-align:center;padding:6px 8px;border-right:1px solid var(--border)">'+colTotal+'</td>';
    });
    html+='<td style="text-align:center;padding:6px 8px">'+grandTotal+'</td></tr>';
    html+='</tbody></table></div></div>';
  })();
  // ── 📊 خلاصه امروز Widget ──
  (function(){
    var todayW = todayStr();
    var todayActs = (DB.changeLog||[]).filter(function(l){
      if(!l.at) return false;
      var dp = l.at.slice(0,10).split('-').map(Number);
      if(dp.length!==3) return false;
      var jd = g2j(dp[0],dp[1],dp[2]);
      return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]) === todayW;
    });
    var totalActsToday = todayActs.length;
    var scheduledToday = 0, doneToday = 0, overdueTotal = 0;
    var byExpertProgress = {};
    _buildPCCache();
    Object.keys(DB.weekEntries||{}).forEach(function(k){
      var we = DB.weekEntries[k];
      if(we.rtype === 'mtr') return;
      var owner = _wpGetOwner(we)||'__none__';
      if(we.scheduledDate === todayW){
        scheduledToday++;
        if(!byExpertProgress[owner]) byExpertProgress[owner]={sched:0,done:0,name:USERS[owner]||owner};
        byExpertProgress[owner].sched++;
        var acts = _getTodayActivities(we.rtype||'center', we.rid||'', todayW);
        if(we.done || acts.length>0){
          doneToday++;
          byExpertProgress[owner].done++;
        }
      } else if(we.scheduledDate && we.scheduledDate < todayW && !we.done){
        var actOnDay = _getActivitiesOnDate(we.rtype||'center', we.rid||'', we.scheduledDate);
        if(actOnDay.length===0) overdueTotal++;
      }
    });
    var pctToday = scheduledToday>0 ? Math.round((doneToday/scheduledToday)*100) : 0;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:18px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 خلاصه امروز — '+todayW+'</div>'
      +'<div style="padding:14px">'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px">'
      +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16a34a">'+totalActsToday+'</div><div style="font-size:11px;color:#166534">فعالیت ثبت‌شده امروز</div></div>'
      +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#1d4ed8">'+scheduledToday+'</div><div style="font-size:11px;color:#1e40af">پیگیری امروز</div></div>'
      +'<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#dc2626">'+overdueTotal+'</div><div style="font-size:11px;color:#991b1b">سررسید گذشته 🔴</div></div>'
      +'<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16a34a">'+pctToday+'%</div><div style="font-size:11px;color:#166534">درصد انجام</div></div>'
      +'</div>';
    if(Object.keys(byExpertProgress).length){
      html+='<div style="font-size:12px;font-weight:700;margin-bottom:8px">📊 پیشرفت کارشناسان</div>';
      Object.keys(byExpertProgress).sort().forEach(function(exp){
        var ep=byExpertProgress[exp];
        var epPct=ep.sched>0?Math.round((ep.done/ep.sched)*100):0;
        var epColor=(window.umGetColor?umGetColor(exp):'#94a3b8');
        html+='<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;font-size:12px">'
          +'<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+epColor+'"></span>'
          +'<span style="min-width:100px">'+esc(ep.name)+'</span>'
          +'<div style="flex:1;background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden">'
          +'<div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:'+Math.min(100,epPct)+'%;transition:width .4s"></div>'
          +'</div>'
          +'<span style="font-size:11px;color:var(--text-muted);min-width:60px">'+ep.done+'/'+ep.sched+' ('+epPct+'%)</span>'
          +'</div>';
      });
    }
    html+='<div style="text-align:center;margin-top:10px">'
      +'<button onclick="openDailyMonitor()" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:6px 18px;cursor:pointer;font-size:12px;font-family:inherit">📊 گزارش کامل</button>'
      +'</div>'
      +'</div></div>';
  })();

  // ── عملکرد ماه جاری vs هدف ──────────────────────────────────────────────────
  (function(){
    var mon=currentJMonth();
    var activeMembers=members.filter(function(m){return m.active!==false&&m.role!=='مهمان'&&m.role!=='سوپر ادمین';});
    if(!activeMembers.length)return;
    html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px">';
    html+='<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">';
    html+='<span>📊 عملکرد ماه جاری vs هدف</span>';
    html+='<span style="font-size:10px;font-weight:400;color:var(--text-muted)">'+mon+'</span>';
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
    activeMembers.forEach(function(m){
      var uid=m.id;
      try{
        var t=getKPITarget(uid,mon);
        var calls=getCallsMonth(uid,mon);
        var visits=getVisitsMonth(uid,mon);
        var sales=getSalesMonth(uid,mon);
        var totalCalls=calls.reduce(function(s,l){return s+(l.count||0);},0);
        var totalVisits=visits.total||0;
        var totalSales=sales.length;
        var totalAmt=sales.reduce(function(s,l){return s+(l.amount||0);},0);
        // monthly target from daily/weekly targets
        var b=jMonthBounds(mon);var wd=workingDaysInJMonth(mon);
        var tCalls=Math.round((t.callsPerDay||10)*wd);
        var tVisits=Math.round((t.visitsPerWeek||5)*4.3);
        var tSales=t.salesCount||5;
        function pct(a,t2){return t2>0?Math.min(100,Math.round(a/t2*100)):0;}
        function bar(a,t2,col){
          var p=pct(a,t2);
          var c=p>=100?'#16a34a':p>=60?'#f59e0b':'#dc2626';
          return '<div style="flex:1;background:#e2e8f0;border-radius:6px;height:6px;overflow:hidden"><div style="height:100%;width:'+p+'%;background:'+c+';transition:width .4s"></div></div>';
        }
        var clr=typeof umGetColor==='function'?umGetColor(uid):'#6366f1';
        html+='<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">';
        html+='<div style="font-weight:700;font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px">';
        html+='<span style="width:9px;height:9px;border-radius:50%;background:'+clr+';flex-shrink:0"></span>';
        html+=esc(m.name)+'</div>';
        // calls row
        html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="font-size:10px;color:var(--text-muted);width:40px">تماس</span>';
        html+=bar(totalCalls,tCalls);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalCalls+'/'+tCalls+'</span></div>';
        // visits row
        html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="font-size:10px;color:var(--text-muted);width:40px">ویزیت</span>';
        html+=bar(totalVisits,tVisits);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalVisits+'/'+tVisits+'</span></div>';
        // sales row
        html+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--text-muted);width:40px">فروش</span>';
        html+=bar(totalSales,tSales);
        html+='<span style="font-size:10px;font-weight:600;min-width:50px;text-align:left">'+totalSales+'/'+tSales+'</span></div>';
        if(totalAmt>0){
          html+='<div style="margin-top:6px;font-size:10px;color:#16a34a;font-weight:700">💰 '+fM(totalAmt*1000000)+'</div>';
        }
        html+='</div>';
      }catch(e){}
    });
    html+='</div></div>';
  })();

  // ── نتایج تماس‌های اخیر ──────────────────────────────────────────────────
  (function(){
    var recentDone=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
      .filter(function(we){return we.done&&(we.doneNote||we.doneResult||we.doneObstacle||we.doneAmount);})
      .sort(function(a,b){return (b.doneDate||'')<(a.doneDate||'')?-1:1;}).slice(0,25);
    if(!recentDone.length)return;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-top:14px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📝 نتایج تماس‌های اخیر</div>'
      +'<div style="padding:10px;max-height:320px;overflow-y:auto">';
    recentDone.forEach(function(we){
      var own=_wpGetOwner(we)||'';
      var ownName=USERS[own]||own;
      var clr=typeof umGetColor==='function'?umGetColor(own):'#6366f1';
      html+='<div style="border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:11px">'
        +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+clr+'"></span>'
        +'<span style="font-weight:600">'+esc(we.centerName||'')+'</span>'
        +'<span style="color:var(--text-muted);font-size:10px">'+esc(ownName)+'</span>'
        +'<span style="margin-right:auto;color:var(--text-muted);font-size:10px">'+esc(we.doneDate||'')+'</span>'
        +'</div>';
      if(we.doneResult)html+='<div><span style="color:#0369a1;font-weight:600">نتیجه: </span>'+esc(we.doneResult)+'</div>';
      if(we.doneNote)html+='<div><span style="color:#7c3aed;font-weight:600">یادداشت: </span>'+esc(we.doneNote)+'</div>';
      if(we.doneObstacle)html+='<div><span style="color:#dc2626;font-weight:600">مانع: </span>'+esc(we.doneObstacle)+'</div>';
      if(we.doneAmount)html+='<div><span style="color:#16a34a;font-weight:600">مبلغ: </span>'+(typeof fM==='function'?fM(we.doneAmount*1000000):we.doneAmount)+'</div>';
      html+='</div>';
    });
    html+='</div></div>';
  })();

  // ── قیف فروش ─────────────────────────────────────────────────────────
  (function(){
    _buildPCCache();
    var stCounts={};
    STATUS_LIST.forEach(function(s){stCounts[s]=0;});
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var st=e.status||'بدون تماس';
        if(stCounts[st]!==undefined)stCounts[st]++;
      });
    });
    var funnelSts=STATUS_LIST.slice(0,-1); // exclude غیرفعال from funnel
    var maxVal=Math.max.apply(null,funnelSts.map(function(s){return stCounts[s]||0;}));
    if(maxVal===0)return;
    var fColors=['#94a3b8','#0ea5e9','#f59e0b','#0284c7','#22c55e'];
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📉 قیف فروش</div>'
      +'<div style="padding:14px;display:flex;flex-direction:column;gap:8px">';
    funnelSts.forEach(function(st,i){
      var cnt=stCounts[st]||0;
      var pct=maxVal>0?Math.round((cnt/maxVal)*100):0;
      var prevCnt=i>0?(stCounts[funnelSts[i-1]]||0):cnt;
      var convPct=prevCnt>0?Math.round((cnt/prevCnt)*100):100;
      var clr=fColors[i]||'#94a3b8';
      html+='<div>'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
        +'<span style="font-size:11px;min-width:140px;font-weight:600">'+esc(st)+'</span>'
        +'<span style="font-size:12px;font-weight:700;color:'+clr+';min-width:30px">'+cnt+'</span>'
        +(i>0?'<span style="font-size:10px;color:var(--text-muted)">تبدیل از قبلی: '+convPct+'%</span>':'')
        +'</div>'
        +'<div style="background:var(--bg-raised);border-radius:6px;height:10px;overflow:hidden">'
        +'<div style="background:'+clr+';height:100%;width:'+pct+'%;border-radius:6px;transition:width .4s"></div>'
        +'</div></div>';
    });
    html+='<div style="margin-top:4px;font-size:10px;color:var(--text-muted)">مراکز غیرفعال: '+(stCounts['غیرفعال']||0)+'</div>';
    html+='</div></div>';
  })();

  // ── گزارش رقبا ────────────────────────────────────────────────────────
  (function(){
    _buildPCCache();
    var compMap={};
    allProvs.forEach(function(pr){
      var rt=getProvType(pr.id);
      getProvCenters(pr.id).forEach(function(c){
        var e=getE(rt,c.id);
        var comp=(e.competitor||'').trim();
        if(!comp)return;
        if(!compMap[comp])compMap[comp]={count:0,names:[]};
        compMap[comp].count++;
        if(compMap[comp].names.length<3)compMap[comp].names.push(e.nameOverride||c.name||'');
      });
    });
    var comps=Object.keys(compMap).sort(function(a,b){return compMap[b].count-compMap[a].count;}).slice(0,8);
    if(!comps.length)return;
    var maxComp=compMap[comps[0]].count;
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">🤖 رقبای اصلی</div>'
      +'<div style="padding:12px;display:flex;flex-direction:column;gap:6px">';
    comps.forEach(function(comp,i){
      var info=compMap[comp];
      var pct=maxComp>0?Math.round((info.count/maxComp)*100):0;
      var clr=['#dc2626','#ea580c','#f59e0b','#84cc16','#22c55e','#0ea5e9','#8b5cf6','#ec4899'][i]||'#94a3b8';
      html+='<div>'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">'
        +'<span style="font-size:11px;font-weight:700;flex:1">'+esc(comp)+'</span>'
        +'<span style="font-size:11px;color:'+clr+';font-weight:700">'+info.count+' مرکز</span>'
        +'</div>'
        +'<div style="background:var(--bg-raised);border-radius:4px;height:6px;overflow:hidden">'
        +'<div style="background:'+clr+';height:100%;width:'+pct+'%;border-radius:4px"></div>'
        +'</div>'
        +(info.names.length?'<div style="font-size:10px;color:var(--text-muted);margin-top:2px">مثال: '+esc(info.names.join('، '))+'</div>':'')
        +'</div>';
    });
    html+='</div></div>';
  })();

  // ── سرعت Pipeline ────────────────────────────────────────────────────
  (function(){
    var expVel={};
    var stOrder={};
    STATUS_LIST.forEach(function(s,i){stOrder[s]=i;});
    (DB.changeLog||[]).filter(function(l){return l.field==='status'&&l.at&&l.by;}).forEach(function(l){
      if(!expVel[l.by])expVel[l.by]={transitions:[],lastAt:null,lastSt:null};
      var ev=expVel[l.by];
      if(ev.lastAt&&ev.lastSt){
        var days=Math.round((new Date(l.at)-new Date(ev.lastAt))/(86400000));
        if(days>=0&&days<=90)ev.transitions.push(days);
      }
      ev.lastAt=l.at;ev.lastSt=l.val;
    });
    var rows=Object.keys(expVel).filter(function(uid){return expVel[uid].transitions.length>=2;});
    if(!rows.length)return;
    rows.sort(function(a,b){
      var avgA=expVel[a].transitions.reduce(function(s,v){return s+v;},0)/expVel[a].transitions.length;
      var avgB=expVel[b].transitions.reduce(function(s,v){return s+v;},0)/expVel[b].transitions.length;
      return avgA-avgB;
    });
    html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">⚡ سرعت پیشروی در Pipeline</div>'
      +'<div style="padding:12px"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<thead><tr style="background:var(--bg-raised)">'
      +'<th style="padding:6px 10px;text-align:right">کارشناس</th>'
      +'<th style="padding:6px 8px;text-align:center">میانگین روز بین تغییر وضعیت</th>'
      +'<th style="padding:6px 8px;text-align:center">تعداد تغییر</th>'
      +'<th style="padding:6px 8px;text-align:center">ارزیابی</th>'
      +'</tr></thead><tbody>';
    rows.forEach(function(uid){
      var ev=expVel[uid];
      var avg=Math.round(ev.transitions.reduce(function(s,v){return s+v;},0)/ev.transitions.length);
      var name=USERS[uid]||uid;
      var clr=avg<=7?'#16a34a':avg<=21?'#f59e0b':'#dc2626';
      var label=avg<=7?'🟢 سریع':avg<=21?'🟡 معمولی':'🔴 کُند';
      var expClr=typeof umGetColor==='function'?umGetColor(uid):'#94a3b8';
      html+='<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:7px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+expClr+';margin-left:6px"></span>'+esc(name)+'</td>'
        +'<td style="text-align:center;padding:7px 8px;font-weight:700;color:'+clr+'">'+avg+' روز</td>'
        +'<td style="text-align:center;padding:7px 8px;color:var(--text-muted)">'+ev.transitions.length+'</td>'
        +'<td style="text-align:center;padding:7px 8px">'+label+'</td>'
        +'</tr>';
    });
    html+='</tbody></table></div></div>';
  })();

  // ── تحلیل win/loss ──
  (function(){
    var reasons={};
    var totalLost=0,totalWon=0;
    Object.values(DB.edits||{}).forEach(function(e){
      if(!e)return;
      if(e.status==='قرارداد بسته شد')totalWon++;
      if(e.status==='غیرفعال'){
        totalLost++;
        var r=e.lostReason||'نامشخص';
        reasons[r]=(reasons[r]||0)+1;
      }
    });
    var sortedR=Object.keys(reasons).sort(function(a,b){return reasons[b]-reasons[a];});
    if(totalLost>0||totalWon>0){
      var winRate=totalLost+totalWon>0?Math.round(100*totalWon/(totalWon+totalLost)):0;
      html+='<div style="background:var(--bg-card);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px">'
        +'<div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">📊 تحلیل برد / باخت</div>'
        +'<div style="padding:12px">'
        +'<div style="display:flex;gap:16px;margin-bottom:10px">'
        +'<div style="flex:1;text-align:center;background:#f0fdf4;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#16a34a">'+totalWon+'</div>'
        +'<div style="font-size:11px;color:#15803d">✅ قرارداد بسته</div>'
        +'</div>'
        +'<div style="flex:1;text-align:center;background:#fef2f2;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#dc2626">'+totalLost+'</div>'
        +'<div style="font-size:11px;color:#b91c1c">❌ از دست رفته</div>'
        +'</div>'
        +'<div style="flex:1;text-align:center;background:#eff6ff;border-radius:8px;padding:10px">'
        +'<div style="font-size:22px;font-weight:700;color:#2563eb">'+winRate+'%</div>'
        +'<div style="font-size:11px;color:#1d4ed8">نرخ برد</div>'
        +'</div>'
        +'</div>';
      if(sortedR.length){
        html+='<div style="font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-muted)">دلایل از دست دادن مشتری:</div>';
        sortedR.slice(0,6).forEach(function(r){
          var cnt=reasons[r];
          var pct=Math.round(100*cnt/totalLost);
          html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
            +'<div style="flex:0 0 120px;font-size:11px;color:var(--text-primary)">'+esc(r)+'</div>'
            +'<div style="flex:1;background:var(--bg-raised);border-radius:4px;height:14px;overflow:hidden">'
            +'<div style="width:'+pct+'%;background:#dc2626;height:100%;border-radius:4px"></div>'
            +'</div>'
            +'<div style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+cnt+' ('+pct+'%)</div>'
            +'</div>';
        });
      }
      html+='</div></div>';
    }
  })();

  // ── خلاصه هفتگی (فقط شنبه نمایش داده می‌شود) ──
  (function(){
    var tj=todayStr().split('/');
    var dow=typeof jDow==='function'?jDow(parseInt(tj[0]),parseInt(tj[1]),parseInt(tj[2])):null;
    if(dow!==0)return; // فقط شنبه
    var today=todayStr();
    var weekAgo=addDaysToJalali(today,-7);
    var calls=0,visits=0,sales=0,newContracts=0,newLeads=0;
    Object.values(DB.edits||{}).forEach(function(e){
      if(!e)return;
      if(e.status==='قرارداد بسته شد'&&e._ts){
        var d=new Date(e._ts);
        var g=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
        var ds=p2(g[0])+'/'+p2(g[1])+'/'+p2(g[2]);
        if(ds>=weekAgo)newContracts++;
      }
    });
    (DB.changeLog||[]).forEach(function(log){
      if(!log||!log.at)return;
      var d=new Date(log.at);
      var g=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      var ds=p2(g[0])+'/'+p2(g[1])+'/'+p2(g[2]);
      if(ds<weekAgo)return;
      if(log.field==='status'&&log.val==='قرارداد بسته شد')newContracts++;
      if(log.field==='status')newLeads++;
    });
    (DB.callLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)calls++;});
    (DB.visitLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)visits++;});
    (DB.salesLog||[]).forEach(function(l){if(l&&l.date&&l.date>=weekAgo)sales++;});
    html+='<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;box-shadow:0 2px 8px rgba(99,102,241,.3);overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:10px 14px;font-weight:700;font-size:13px;color:#fff;border-bottom:1px solid rgba(255,255,255,.2)">📋 خلاصه هفته گذشته</div>'
      +'<div style="padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+calls+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">📞 تماس</div>'
      +'</div>'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+visits+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">🚶 ویزیت</div>'
      +'</div>'
      +'<div style="text-align:center;background:rgba(255,255,255,.15);border-radius:8px;padding:10px">'
      +'<div style="font-size:22px;font-weight:700;color:#fff">'+newContracts+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.8)">🏆 قرارداد جدید</div>'
      +'</div>'
      +'</div></div>';
  })();

  // Refresh button
  html+='<div style="text-align:center;margin-top:10px">'
    +'<button onclick="renderManagerPanel()" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-family:inherit">🔄 بروزرسانی</button>'
    +'</div></div>';

  el.innerHTML=html;
}

// ════════════════════════ MANAGER DRILLDOWN ════════════════════
function openManagerDrilldown(memberId){
  _buildPCCache();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var m=allMem.find(function(x){return x.id===memberId;});
  if(!m)return;
  var today=todayStr();
  var centers=[];
  getAllProvinces().forEach(function(p){
    var rt=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(rt,c.id);
      if((e.owner||c.owner||'')!==memberId)return;
      var rkey=rt+'_'+c.id;
      var fd=e.followupDate||'';
      var isOverdue=fd&&fd<today&&e.status!=='قرارداد بسته شد'&&e.status!=='غیرفعال';
      var noteArr=(DB.notes&&DB.notes[rkey])||[];
      var recentLog=(DB.changeLog||[]).filter(function(l){return l.rkey===rkey;}).slice(-10);
      var doneEntries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
        .filter(function(we){var r2=we.rtype||(we.recKey?we.recKey.split('_')[0]:'');var i2=we.rid||(we.recKey?we.recKey.split('_')[1]:'');return r2===rt&&i2===c.id&&we.done&&(we.doneNote||we.doneResult||we.doneObstacle||we.doneAmount);})
        .sort(function(a,b){return (b.doneDate||'')<(a.doneDate||'')?-1:1;}).slice(0,5);
      centers.push({rtype:rt,id:c.id,name:e.nameOverride||c.name||'?',status:e.status||'بدون تماس',followupDate:fd,isOverdue:isOverdue,potential:e.potential||c.potential||4,noteArr:noteArr,recentLog:recentLog,rkey:rkey,doneEntries:doneEntries});
    });
  });
  centers.sort(function(a,b){
    if(a.isOverdue&&!b.isOverdue)return -1;
    if(!a.isOverdue&&b.isOverdue)return 1;
    if(a.followupDate&&b.followupDate)return a.followupDate<b.followupDate?-1:1;
    if(a.followupDate)return -1;
    if(b.followupDate)return 1;
    return 0;
  });
  var stColors={'بدون تماس':'#94a3b8','تماس اولیه':'#0ea5e9','ملاقات انجام شد':'#f59e0b','پیشنهاد ارسال شد':'#0284c7','قرارداد بسته شد':'#22c55e','غیرفعال':'#dc2626'};
  var grouped={};
  centers.forEach(function(c){grouped[c.status]=(grouped[c.status]||0)+1;});
  var body='<div style="font-size:12px">';
  body+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  Object.keys(grouped).forEach(function(st){
    body+='<span style="padding:3px 10px;border-radius:20px;font-size:11px;background:'+(stColors[st]||'#e2e8f0')+'22;color:'+(stColors[st]||'#555')+';border:1px solid '+(stColors[st]||'#e2e8f0')+'44">'+esc(st)+': '+grouped[st]+'</span>';
  });
  body+='</div>';
  if(!centers.length){
    body+='<div style="text-align:center;padding:30px;color:var(--text-muted)">مرکزی تخصیص داده نشده</div>';
  } else {
    body+='<div style="max-height:60vh;overflow-y:auto;padding-bottom:4px">';
    centers.forEach(function(c,i){
      var fdStyle=c.isOverdue?'color:#dc2626;font-weight:700':'color:var(--text-secondary)';
      var stColor=stColors[c.status]||'#94a3b8';
      var lastAct=c.recentLog.length?c.recentLog[c.recentLog.length-1]:null;
      var fmtDate=function(isoAt){if(!isoAt)return'';var dp=isoAt.slice(0,10).split('-').map(Number);if(dp.length!==3)return'';var jd=g2j(dp[0],dp[1],dp[2]);return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);};
      body+='<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">'
        +'<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:var(--bg-card);flex-wrap:wrap" '
        +'onclick="var d=document.getElementById(\'mdr_'+i+'\');if(d){d.style.display=d.style.display===\'none\'?\'block\':\'none\';}">'
        +'<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+stColor+'"></span>'
        +'<span style="font-weight:600;flex:1;min-width:80px">'+esc(c.name)+'</span>'
        +'<span style="font-size:10px;padding:2px 7px;border-radius:9px;background:'+stColor+'22;color:'+stColor+'">'+esc(c.status)+'</span>'
        +(c.followupDate?'<span style="font-size:11px;'+fdStyle+'">'+c.followupDate+(c.isOverdue?' 🔴':'')+'</span>':'')
        +'<span style="font-size:10px;color:var(--text-muted)">P'+c.potential+'</span>'
        +'<button onclick="event.stopPropagation();closeModal(\'mgrDrilldown\');setTimeout(function(){openCenterModal(\''+c.rtype+'\',\''+c.id+'\');},100)" style="padding:2px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:10px;font-family:inherit">باز کردن</button>'
        +'</div>'
        +'<div id="mdr_'+i+'" style="display:none;padding:10px 12px;border-top:1px solid var(--border);background:var(--bg-raised)">';
      if(c.noteArr&&c.noteArr.length){
        var _allNotes=c.noteArr.slice().reverse();
        body+='<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:4px">📝 یادداشت‌ها ('+c.noteArr.length+'):</div><div style="max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">';
        _allNotes.forEach(function(n){
          var nt=typeof n==='string'?n:(n.text||n.body||'');
          if(!nt)return;
          var nd=n&&n.date?n.date:(n&&n.at?fmtDate(n.at):'');var nb=n&&(n.by||n.user)?(USERS[n.by||n.user]||(n.by||n.user)):'';
          body+='<div style="font-size:11px;background:var(--bg-input);border-radius:5px;padding:5px 8px">'
            +(nd||nb?'<span style="font-size:10px;color:var(--text-muted)">'+esc(nd)+(nd&&nb?' · ':'')+esc(nb)+'</span><br>':'')
            +esc(nt)+'</div>';
        });
        body+='</div></div>';
      }
      if(lastAct){
        body+='<div style="font-size:11px"><span style="font-weight:700;color:#7c3aed">آخرین تغییر:</span> '+esc(lastAct.field||'')+' → '+esc(String(lastAct.val||''))+'<span style="color:var(--text-muted);margin-right:6px">('+fmtDate(lastAct.at)+' - '+esc(lastAct.by||'')+')</span></div>';
      }
      if(c.recentLog.length>1){
        body+='<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">';
        c.recentLog.slice(0,-1).reverse().slice(0,8).forEach(function(l){
          body+='<div style="font-size:10px;color:var(--text-muted);padding:1px 0">'+fmtDate(l.at)+' — '+esc(l.field||'')+': '+esc(String(l.val||''))+'</div>';
        });
        body+='</div>';
      }
      if(!(c.noteArr&&c.noteArr.length)&&!lastAct){
        body+='<div style="font-size:11px;color:var(--text-muted)">فعالیتی ثبت نشده</div>';
      }
      if(c.doneEntries&&c.doneEntries.length){
        body+='<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px"><div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:3px">📝 نتایج ثبت‌شده:</div>';
        c.doneEntries.forEach(function(de){
          body+='<div style="font-size:10px;color:var(--text-secondary);padding:2px 0">';
          body+='<span style="color:var(--text-muted)">'+esc(de.doneDate||'')+'</span> ';
          if(de.doneResult)body+='<span style="color:#0369a1">'+esc(de.doneResult)+'</span> ';
          if(de.doneObstacle)body+='<span style="color:#dc2626">[مانع: '+esc(de.doneObstacle)+']</span> ';
          if(de.doneAmount)body+='<span style="color:#16a34a">['+de.doneAmount+'M]</span>';
          body+='</div>';
        });
        body+='</div>';
      }
      body+='</div></div>';
    });
    body+='</div>';
  }
  body+='</div>';
  openModal('mgrDrilldown','🔍 جزئیات: '+esc(m.name)+' (مجموعه '+centers.length+' مرکز)',body,'<button class="btn-secondary" onclick="closeModal(\'mgrDrilldown\')">بستن</button>',{lg:true});
}

function overdueSnooze(rtype,id,days,listMemberId){
  var e=getE(rtype,id);
  var fd=e.followupDate||todayStr();
  var parts=fd.split('/').map(Number);
  var gDate=j2g(parts[0],parts[1],parts[2]);
  var d=new Date(gDate[0],gDate[1]-1,gDate[2]+days);
  var nj=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  var newDate=nj[0]+'/'+p2(nj[1])+'/'+p2(nj[2]);
  setE(rtype,id,'followupDate',newDate);
  renderBanner();
  showToast('⏰ تعویق تا '+newDate,2000);
  closeModal('overdueList');
  setTimeout(function(){openOverdueList(listMemberId||undefined);},150);
}

function overduePickDate(rtype,id,listMemberId){
  var inp=document.createElement('input');
  inp.type='text';inp.style.cssText='position:fixed;opacity:0;pointer-events:none;top:50%;left:50%;';
  document.body.appendChild(inp);
  openJDP(inp,function(v){
    inp.remove();
    if(!v)return;
    setE(rtype,id,'followupDate',v);
    renderBanner();
    showToast('📅 تاریخ جدید: '+v,2000);
    closeModal('overdueList');
    setTimeout(function(){openOverdueList(listMemberId||undefined);},150);
  });
}
function openOverdueList(memberId){
  _buildPCCache();
  var today=todayStr();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var items=[];
  getAllProvinces().forEach(function(p){
    var rt=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(rt,c.id);
      var owner=e.owner||c.owner||'';
      if(memberId&&owner!==memberId)return;
      var fd=e.followupDate||'';
      if(!fd||fd>=today||e.status==='قرارداد بسته شد'||e.status==='غیرفعال')return;
      var mObj=allMem.find(function(x){return x.id===owner;});
      var _fdp2=fd.split('/').map(Number);var _fdg2=j2g(_fdp2[0],_fdp2[1],_fdp2[2]);var daysAgo=Math.round((new Date()-new Date(_fdg2[0],_fdg2[1]-1,_fdg2[2]))/86400000);
      items.push({rtype:rt,id:c.id,name:e.nameOverride||c.name||'?',followupDate:fd,
        status:e.status||'بدون تماس',ownerName:mObj?mObj.name:(owner||'بدون مسئول'),
        potential:e.potential||c.potential||4,daysAgo:daysAgo});
    });
  });
  items.sort(function(a,b){return a.followupDate<b.followupDate?-1:1;});

  var _mid=memberId||'';
  var renderRow=function(c){
    return '<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--border);border-radius:6px;margin-bottom:4px;background:var(--bg-card)">'
      +'<span style="color:#dc2626;font-size:11px;min-width:60px;font-weight:700">'+c.followupDate+'</span>'
      +'<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:9px;min-width:44px;text-align:center">'+c.daysAgo+' روز</span>'
      +'<span style="flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name)+'</span>'
      +'<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">'+esc(c.ownerName)+'</span>'
      +'<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',3,\''+_mid+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۳ روز">+۳</button>'
      +'<button onclick="overdueSnooze(\''+c.rtype+'\',\''+c.id+'\',7,\''+_mid+'\')" style="padding:3px 7px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تعویق ۷ روز">+۷</button>'
      +'<button onclick="overduePickDate(\''+c.rtype+'\',\''+c.id+'\',\''+_mid+'\')" style="padding:3px 7px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit" title="تاریخ جدید">📅</button>'
      +'<button onclick="closeModal(\'overdueList\');setTimeout(function(){openCenterModal(\''+c.rtype+'\',\''+c.id+'\');},100)" style="padding:3px 9px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">پیگیری</button>'
      +'</div>';
  };
  var buckets=[
    {label:'🔴 این هفته',sub:'۱–۷ روز',min:1,max:7,clr:'#dc2626',items:[]},
    {label:'🟠 این ماه',sub:'۸–۳۰ روز',min:8,max:30,clr:'#ea580c',items:[]},
    {label:'⚫ قدیمی',sub:'بیش از ۳۰ روز',min:31,max:999999,clr:'#64748b',items:[]}
  ];
  items.forEach(function(c){
    for(var bi=0;bi<buckets.length;bi++){
      if(c.daysAgo>=buckets[bi].min&&c.daysAgo<=buckets[bi].max){buckets[bi].items.push(c);break;}
    }
  });
  var body='<div style="font-size:12px">'
    +'<div style="color:var(--text-muted);margin-bottom:10px">مراکزی که تاریخ پیگیری آن‌ها گذشته و هنوز پیگیری نشده است</div>'
    +'<div style="max-height:60vh;overflow-y:auto">';
  if(!items.length){
    body+='<div style="text-align:center;padding:30px;color:#16a34a;font-weight:700">🎉 هیچ پیگیری معوقی وجود ندارد!</div>';
  } else {
    buckets.forEach(function(bk){
      if(!bk.items.length)return;
      body+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0 4px;border-bottom:2px solid var(--border);margin-bottom:8px">'
        +'<span style="font-size:12px;font-weight:700;color:'+bk.clr+'">'+bk.label+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted)">'+bk.sub+'</span>'
        +'<span style="font-size:11px;background:'+bk.clr+'22;color:'+bk.clr+';border-radius:9px;padding:1px 8px;font-weight:700">'+bk.items.length+' مرکز</span>'
        +'</div>';
      bk.items.forEach(function(c){body+=renderRow(c);});
    });
  }
  body+='</div></div>';
  openModal('overdueList','🔴 پیگیری‌های معوق ('+items.length+')',body,'<button class="btn-secondary" onclick="closeModal(\'overdueList\')">بستن</button>',{lg:true});
}
// ════════════════════════ EXPERT REPORT ════════════════════
function openExpertReport(memberId){
  _buildPCCache();
  var allMem=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var m=allMem.find(function(x){return x.id===memberId;});
  if(!m)return;
  var mon=currentJMonth();
  // Compute default date range: first and last day of current month
  var monParts=mon.split('/');
  var fromDefault=monParts[0]+'/'+monParts[1]+'/01';
  var lastDay=jMonthDays(parseInt(monParts[0]),parseInt(monParts[1]));
  var toDefault=monParts[0]+'/'+monParts[1]+'/'+p2(lastDay);
  function buildReport(fromDate,toDate){
    var entries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
      .filter(function(we){
        var own=_wpGetOwner(we)||'';
        return own===memberId&&we.done&&we.doneDate&&we.doneDate>=fromDate&&we.doneDate<=toDate;
      })
      .sort(function(a,b){return (a.doneDate||'')<(b.doneDate||'')?-1:1;});
    var totalAmount=entries.reduce(function(s,e){return s+(e.doneAmount||0);},0);
    var calls=entries.filter(function(e){return (e.actionType||'call')==='call';}).length;
    var visits=entries.filter(function(e){return e.actionType==='visit';}).length;
    var body='<div style="font-size:12px">';
    body+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
    body+='<label style="font-size:11px">از: <input type="text" id="rptFrom" value="'+fromDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<label style="font-size:11px">تا: <input type="text" id="rptTo" value="'+toDate+'" readonly class="fd-inp" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></label>';
    body+='<button onclick="var f=document.getElementById(\'rptFrom\').value,t=document.getElementById(\'rptTo\').value;document.getElementById(\'rptBody\').innerHTML=buildExpertReportHtml(\''+memberId+'\',f,t)" style="padding:4px 12px;background:var(--brand,#6366f1);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">🔍 فیلتر</button>';
    body+='</div>';
    body+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">';
    body+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#1d4ed8">'+calls+'</div><div style="font-size:11px;color:#1d4ed8">تماس</div></div>';
    body+='<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#16a34a">'+visits+'</div><div style="font-size:11px;color:#16a34a">ملاقات</div></div>';
    body+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#92400e">'+(totalAmount?totalAmount+'M':'—')+'</div><div style="font-size:11px;color:#92400e">مبلغ (M)</div></div>';
    body+='</div>';
    body+='<div id="rptBody">'+buildExpertReportHtml(memberId,fromDate,toDate)+'</div>';
    body+='</div>';
    var notifFoot='<button class="btn-secondary" onclick="closeModal(\'expertReport\')">بستن</button>';
    if(typeof _isManager==='function'&&_isManager()){
      notifFoot='<button style="background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="_sendReportNotif(\''+memberId+'\',\''+esc(m.name)+'\')">📨 ارسال اعلان</button>'+notifFoot;
    }
    openModal('expertReport','📊 گزارش '+esc(m.name)+' — '+fromDate+' تا '+toDate,body,notifFoot,{lg:true});
    // init date pickers after modal is open
    setTimeout(function(){
      var fi=document.getElementById('rptFrom');if(fi)openJDP(fi,function(v){fi.value=v;});
      var ti=document.getElementById('rptTo');if(ti)openJDP(ti,function(v){ti.value=v;});
    },100);
  }
  buildReport(fromDefault,toDefault);
}
function _sendReportNotif(memberId,memberName){
  var body='<div style="font-size:12px">'
    +'<label style="display:block;margin-bottom:6px;font-weight:600">متن پیام به '+esc(memberName)+':</label>'
    +'<textarea id="rptNotifMsg" rows="4" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;background:var(--bg-input);color:var(--text-primary)" placeholder="مثال: عملکرد این هفته خوب بود، لطفاً گزارش مراکز P1 را تکمیل کنید..."></textarea>'
    +'</div>';
  openModal('rptNotifCompose','📨 ارسال اعلان به '+esc(memberName),body,
    '<button class="btn-secondary" onclick="closeModal(\'rptNotifCompose\')">لغو</button>'
    +'<button class="btn-primary" onclick="(function(){var msg=document.getElementById(\'rptNotifMsg\').value.trim();if(!msg){showToast(\'⚠ متن پیام خالی است\');return;}sendNotif(\''+memberId+'\',msg,\'\');closeModal(\'rptNotifCompose\');})()">ارسال 📨</button>'
  );
  setTimeout(function(){var t=document.getElementById('rptNotifMsg');if(t)t.focus();},100);
}
function buildExpertReportHtml(memberId,fromDate,toDate){
  var entries=Object.keys(DB.weekEntries||{}).map(function(k){return DB.weekEntries[k];})
    .filter(function(we){
      var own=_wpGetOwner(we)||'';
      return own===memberId&&we.done&&we.doneDate&&we.doneDate>=fromDate&&we.doneDate<=toDate;
    })
    .sort(function(a,b){return (a.doneDate||'')<(b.doneDate||'')?-1:1;});
  if(!entries.length)return '<div style="text-align:center;padding:20px;color:var(--text-muted)">فعالیتی در این بازه ثبت نشده</div>';
  var html='<div style="max-height:50vh;overflow-y:auto">';
  html+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr style="background:var(--bg-raised)"><th style="padding:6px 8px;text-align:right">تاریخ</th><th style="padding:6px 8px;text-align:right">مرکز</th><th style="padding:6px 8px">نوع</th><th style="padding:6px 8px;text-align:right">نتیجه</th><th style="padding:6px 8px;text-align:right">یادداشت</th><th style="padding:6px 8px;text-align:right">مانع</th><th style="padding:6px 8px">مبلغ</th></tr></thead><tbody>';
  entries.forEach(function(we,i){
    var bg=i%2===0?'var(--bg-card)':'var(--bg-raised)';
    var typeLabel=(we.actionType==='visit')?'🤝 ملاقات':'📞 تماس';
    html+='<tr style="background:'+bg+';border-bottom:1px solid var(--border)">';
    html+='<td style="padding:5px 8px;white-space:nowrap">'+esc(we.doneDate||'')+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.centerName||'')+'</td>';
    html+='<td style="padding:5px 8px;text-align:center">'+typeLabel+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.doneResult||'—')+'</td>';
    html+='<td style="padding:5px 8px">'+esc(we.doneNote||'—')+'</td>';
    html+='<td style="padding:5px 8px;color:#dc2626">'+esc(we.doneObstacle||'—')+'</td>';
    html+='<td style="padding:5px 8px;text-align:center;color:#16a34a">'+((we.doneAmount)?we.doneAmount+'M':'—')+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  return html;
}

// ════════════════════════ EXCEL EXPORT (مراکز) ════════════════════

function importCentersFromExcel(event) {
  if (typeof XLSX === 'undefined') { showToast('⚠ کتابخانه Excel بارگذاری نشده'); return; }
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'binary' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) { showToast('⚠ فایل خالی است'); return; }
      
      var headers = rows[0].map(function(h) { return String(h).trim(); });
      var nameIdx = headers.findIndex(function(h) { return /نام|name/i.test(h); });
      var provIdx = headers.findIndex(function(h) { return /استان|province/i.test(h); });
      var typeIdx = headers.findIndex(function(h) { return /نوع|type/i.test(h); });
      var ownerIdx = headers.findIndex(function(h) { return /مسئول|owner|کارشناس/i.test(h); });
      var potIdx = headers.findIndex(function(h) { return /پتانسیل|potential/i.test(h); });
      
      if (nameIdx < 0) { showToast('⚠ ستون «نام» یافت نشد'); return; }
      
      var preview = rows.slice(1, 6).filter(function(r) { return r[nameIdx]; });
      
      var body = '<div style="font-size:12px;margin-bottom:12px;color:var(--text-muted)">شناسایی‌شده: '
        + (rows.length - 1) + ' ردیف — پیش‌نمایش ۵ ردیف اول:</div>'
        + '<div style="background:var(--bg-raised);border-radius:6px;padding:8px;margin-bottom:12px;font-size:11px;overflow-x:auto">'
        + '<table style="width:100%;border-collapse:collapse">'
        + '<tr style="border-bottom:1px solid var(--border)">'
        + ['نام','استان','نوع','مسئول','پتانسیل'].map(function(h){return '<th style="padding:4px 8px;text-align:right;color:var(--text-muted)">'+h+'</th>';}).join('')
        + '</tr>'
        + preview.map(function(r) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + ['نام','استان','نوع','مسئول','پتانسیل'].map(function(h, i) {
              var idx2 = [nameIdx, provIdx, typeIdx, ownerIdx, potIdx][i];
              return '<td style="padding:4px 8px">' + esc(idx2 >= 0 ? String(r[idx2]) : '—') + '</td>';
            }).join('')
            + '</tr>';
        }).join('')
        + '</table></div>'
        + '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px;font-size:11px;margin-bottom:10px">'
        + '⚠ مراکز وارد شده به عنوان «مراکز اضافه» (DB.extra) ذخیره می‌شوند.'
        + '</div>'
        + '<div style="font-size:12px">استان پیش‌فرض برای مراکز بدون استان: <select id="importProvDef" style="padding:4px;border:1px solid var(--border-input);border-radius:4px;font-family:inherit;font-size:11px">'
        + getAllProvinces().map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('')
        + '</select></div>';
      
      var rowsJson = JSON.stringify(rows);
      var foot = '<button class="btn-secondary" onclick="closeModal(\'importCentersModal\')">انصراف</button>'
        + '<button class="btn-primary" onclick="doImportCenters(JSON.parse(this.dataset.rows),'+nameIdx+','+provIdx+','+typeIdx+','+ownerIdx+','+potIdx+')" data-rows=\''+rowsJson.replace(/'/g,"&#39;")+'\'">✅ وارد کردن '+(rows.length-1)+' مرکز</button>';
      
      openModal('importCentersModal', '📥 وارد کردن مراکز از Excel', body, foot);
    } catch(err) {
      showToast('⚠ خطا در خواندن فایل: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function doImportCenters(rows, nameIdx, provIdx, typeIdx, ownerIdx, potIdx) {
  if (!DB.extra) DB.extra = [];
  var dataRows = rows.slice(1).filter(function(r) { return r[nameIdx]; });
  var defProv = (document.getElementById('importProvDef') || {}).value || 'tehran';
  var added = 0;
  
  dataRows.forEach(function(r) {
    var name = String(r[nameIdx]).trim();
    if (!name) return;
    var provRaw = provIdx >= 0 ? String(r[provIdx]).trim() : '';
    var province_id = defProv;
    if (provRaw) {
      var pFound = getAllProvinces().find(function(p) { return fNorm(p.name).indexOf(fNorm(provRaw)) >= 0; });
      if (pFound) province_id = pFound.id;
    }
    var id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    var entry = {
      id: id,
      name: name,
      province_id: province_id,
      type: typeIdx >= 0 ? String(r[typeIdx]).trim() : '',
      potential: potIdx >= 0 ? (parseInt(r[potIdx]) || 1) : 1,
      owner: '',
      source: 'excel_import'
    };
    if (ownerIdx >= 0 && r[ownerIdx]) {
      var ownerRaw = fNorm(String(r[ownerIdx]));
      var matchedOwner = Object.keys(USERS).find(function(uid) { return fNorm(USERS[uid]).indexOf(ownerRaw) >= 0; });
      if (matchedOwner) entry.owner = matchedOwner;
    }
    DB.extra.push(entry);
    added++;
  });
  
  saveDB();
  closeModal('importCentersModal');
  renderTable();
  showToast('✅ ' + added + ' مرکز وارد شد', 3000);
}

function exportCentersExcel(){
  _buildPCCache();
  var rows=[['استان','نام مرکز','نوع','پتانسیل','سرنخ','مسئول','وضعیت','پیگیری بعدی']];
  getAllProvinces().forEach(function(p){
    var rtype=getProvType(p.id);
    var centers=getProvCenters(p.id);
    centers.forEach(function(c){
      var e=getE(rtype,c.id);
      rows.push([
        p.name,
        c.name,
        e.type||c.type||'',
        e.potential||c.potential||'',
        e.lead||c.lead||'',
        USERS[e.owner||c.owner||'']||e.owner||c.owner||'',
        e.status||'بدون تماس',
        e.followupDate||''
      ]);
    });
  });
  var csv=rows.map(function(r){return r.map(function(c){return'"'+(c||'').toString().replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_centers_'+todayStr().replace(/\//g,'-')+'.csv';a.click();
  showToast('خروجی اکسل مراکز دانلود شد ✅',2500);
}


// ══ Theme Toggle ══

function toggleTopMenu(){
  var d=document.getElementById('topMenuDropdown');
  if(d)d.classList.toggle('open');
  document.addEventListener('click',function closeMenu(e){
    if(!e.target.closest('#topMenuDropdown')&&!e.target.closest('#menuToggle')){
      d&&d.classList.remove('open');
      document.removeEventListener('click',closeMenu);
    }
  });
}

function toggleTheme(){
  var html=document.documentElement;
  var isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',isDark?'light':'dark');
  try{localStorage.setItem('atena_theme',isDark?'light':'dark');}catch(e){}
  var btn=document.getElementById('themeTglBtn');
  if(btn)btn.textContent=isDark?'🌙 دارک':'☀️ لایت';
}
function applyStoredTheme(){
  var t='light';try{t=localStorage.getItem('atena_theme')||'light';}catch(e){}
  document.documentElement.setAttribute('data-theme',t);
  var btn=document.getElementById('themeTglBtn');
  if(btn)btn.textContent=t==='dark'?'☀️ لایت':'🌙 دارک';
}

function _sendWeeklyDigest(){
  if(!_isManager())return;
  var lastSent=DB.settings&&DB.settings.lastWeeklyDigest||'';
  var today=todayStr();
  if(lastSent){
    var lp=lastSent.split('/').map(Number),tp=today.split('/').map(Number);
    var daysDiff=Math.round((jMs(tp[0],tp[1],tp[2])-jMs(lp[0],lp[1],lp[2]))/86400000);
    if(daysDiff<7)return;
  }
  var members=(DB.settings&&DB.settings.members)||_DEFAULT_MEMBERS;
  var mon=currentJMonth();
  var lines=[];
  members.filter(function(m){return m.active!==false&&m.role!=='مهمان'&&m.role!=='سوپر ادمین'&&m.role!=='مدیر';}).forEach(function(m){
    try{
      var calls=getCallsMonth(m.id,mon).reduce(function(s,l){return s+(l.count||0);},0);
      var visits=(getVisitsMonth(m.id,mon).total||0);
      lines.push(m.name+': '+calls+' تماس، '+visits+' ملاقات');
    }catch(e){}
  });
  if(!lines.length)return;
  var msg='📊 خلاصه هفتگی '+mon+':\n'+lines.join(' | ');
  sendNotif(currentUser,msg,'');
  if(!DB.settings)DB.settings={};
  DB.settings.lastWeeklyDigest=today;
  saveDB();
}

async function init(){
  applyStoredTheme(); // early so no flash
  try{
    // Check auth first
    var authR=await fetch('/api/auth/me');
    if(authR.status===401){showLoginOverlay();return;}
    var authData=await authR.json();
    currentUser=authData.username||currentUser;
  }catch(e){
    showLoginOverlay();return;
  }
  await loadDB();
  initSettings();initTags();initWeekTags();initEvents();_initNotif();
  _initBrowserNotif();
  setTimeout(_sendWeeklyDigest,3000);
  buildUSERS();updateNotifBadge();
  setTimeout(_setupAutoReminder,5000);
  loadMasterCenters().then(function(){
    _typeFilterBuilt=false;
    cleanupOrphanedEntries(false);
    var _dedup=wpDeduplicateEntries();if(_dedup>0){saveDBSync();console.info('[wp] dedup removed',_dedup,'duplicate week entries');}
    rebuildFilters();buildTypeFilter();
    try{
      var _st=localStorage.getItem('_st');
      var _spid=localStorage.getItem('_spid');
      var _svm=localStorage.getItem('_svm');
      if(_svm&&['list','card','pipeline'].indexOf(_svm)>=0)_viewMode=_svm;
      if(_st&&['home','provinces','weekplan','calendar','checklist','activity','kpi','manager','mtr','pricing'].indexOf(_st)>=0)currentTab=_st;
      if(_spid)_currentProvId=_spid;
    }catch(e){}
    // Default new sessions to home tab
    if(!_st) currentTab='home';
    // On mobile, always start at home
    if(window.innerWidth<768) currentTab='home';
    switchTab(currentTab);
    _initOnboarding();
    var _clbtn=document.getElementById('tab_changelog');if(_clbtn)_clbtn.style.display=_isManager()?'':'none';
    var _tbtn=document.getElementById('tab_tasks');if(_tbtn)_tbtn.style.display='';
    // بعد از اتمام init، history navigation فعال می‌شود
    _navReady=true;
    try{history.replaceState({v:1,tab:currentTab,provId:_currentProvId||null},'',window.location.pathname+window.location.search);}catch(e){}
    checkEmptyDB();
    // Build cache + populate CNC now that PC_RAW is ready
    _PC_CACHE=null;_buildPCCache();
    if(currentTab==='weekplan') setTimeout(renderWeekPlan,100);
  }).catch(function(){
    rebuildFilters();buildTypeFilter();switchTab(currentTab);
    _initOnboarding();
    checkEmptyDB();
    if(currentTab==='weekplan') setTimeout(renderWeekPlan,100);
  });
  // ── بررسی پیگیری‌های سررسیده ──
  setTimeout(function(){
    try{
      var today=todayStr();
      var dueCnt=0;
      Object.keys(DB.edits||{}).forEach(function(k){
        var e=DB.edits[k];
        if(e&&e.followupDate&&e.followupDate<today&&e.followupDate!=='')dueCnt++;
      });
      if(dueCnt>0){
        showToast('⚠ '+dueCnt+' مرکز با پیگیری سررسیده دارید',5000);
        var tb=document.getElementById('tab_weekplan');
        if(tb&&tb.innerHTML.indexOf('badge-due')<0){
          tb.innerHTML='📋 برنامه هفته <span class="badge-due" style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;vertical-align:middle">'+dueCnt+'</span>';
        }
      }
    }catch(e2){}
  },1500);
  // ── هشدار مراکز خاموش (P1/P2 با ۳۰+ روز بی‌فعالیت) ──
  setTimeout(function(){
    try{
      _buildPCCache();
      var silentCenters=[];
      var nowMs=Date.now();
      var thirtyDaysMs=30*24*60*60*1000;
      function _checkSilent(arr,rtype){
        arr.forEach(function(r){
          var e=getE(rtype,r.id);
          var st=e.status||'بدون تماس';
          if(st==='غیرفعال'||st==='قرارداد بسته شد')return;
          var pot=parseInt(e.potential!==undefined?e.potential:r.potential||4);
          if(pot>2)return;
          var owner=e.owner||r.owner||'';
          if(!_isManager()&&owner!==currentUser)return;
          var lastTs=e._lastActivity||e._ts||0;
          if(!lastTs||(nowMs-lastTs)>=thirtyDaysMs){
            silentCenters.push({name:r.name,owner:owner,pot:pot});
          }
        });
      }
      getAllProvinces().forEach(function(p){
        var rt=getProvType(p.id);
        _checkSilent(getProvCenters(p.id),rt);
      });
      if(silentCenters.length>0){
        showToast('🔇 '+silentCenters.length+' مرکز P1/P2 بیش از ۳۰ روز است که فعالیتی ندارند',6000);
      }
    }catch(e3){}
  },3000);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeAllModals();closeQS();}
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGSearch();}
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){var ae=document.activeElement;var isInput=ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA');if(!isInput){e.preventDefault();undoEdit();}}
    if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){var ae2=document.activeElement;var isInput2=ae2&&(ae2.tagName==='INPUT'||ae2.tagName==='TEXTAREA');if(!isInput2){e.preventDefault();redoEdit();}}
  });
  initSSE();
}


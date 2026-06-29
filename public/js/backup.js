/* ═══ public/js/backup.js ═══ */
// ════════════════════════ EXPORT / BACKUP ════════════
function exportCSV(){
  if(!_currentProvId){showToast('ابتدا یک استان را باز کنید');return;}
  var rtype=getProvType(_currentProvId);var data=getFiltered();
  var rows=[['ردیف','نام','پتانسیل','نوع','سرنخ','مسئول','وضعیت','پیگیری']];
  data.forEach(function(r){var e=getE(rtype,r.id);rows.push([r.row,r.name,e.potential||r.potential,e.type||r.type||'',e.lead||r.lead||'',USERS[e.owner||r.owner||'']||'',e.status||'بدون تماس',e.followupDate||'']);});
  var csv=rows.map(function(r){return r.map(function(c){return'"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='atena_'+todayStr().replace(/\//g,'-')+'.csv';a.click();
}

// ═══════════════════════════════════════════════════════════════
// ════════════════════════ MERGE BACKUP ═════════════════════════
// ═══════════════════════════════════════════════════════════════

var _mergeImportedDB = null;
var _mergeFilename = '';




function _statBox(label, value, color){
  return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:7px 9px;border-right:3px solid '+color+'">'
    +'<div style="font-size:10px;color:var(--text-muted)">'+label+'</div>'
    +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-top:2px">'+value+'</div>'
    +'</div>';
}





function doPrint(){window.print();}
function doPDF(){showToast('در پنجره چاپ، Destination→Save as PDF انتخاب کنید');setTimeout(doPrint,500);}


// ════════════════════════ IMPORT EXCEL ════════════════════
var _importData = null;
var _importCols = [];

// ═══════════════════════════════════════════════════════════
// ════════════════════════ DB MANAGER ═══════════════════════
function openDBManager(){
  var totalCenters=CENTERS.length+Object.values(PC_RAW).reduce(function(s,a){return s+a.length;},0);
  var statusHtml=totalCenters>0
    ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:7px;padding:10px 14px;margin-bottom:14px;display:flex;gap:12px;align-items:center">'
      +'<span style="font-size:20px">✅</span>'
      +'<div><div style="font-weight:700;color:#166534;font-size:13px">دیتابیس فعال</div>'
      +'<div style="font-size:11px;color:#166534">'+totalCenters.toLocaleString('fa-IR')+' مرکز در '+Object.keys(PC_RAW).length+' استان (+ تهران)</div></div>'
      +'<button onclick="confirmClearMasterDB()" style="margin-right:auto;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit">🗑 پاک کردن دیتابیس</button>'
      +'</div>'
    : '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:7px;padding:10px 14px;margin-bottom:14px">'
      +'<span style="font-weight:700;color:#92400e">⚠ دیتابیس خالی است</span>'
      +'<div style="font-size:11px;color:#92400e;margin-top:3px">برای استفاده از نرم‌افزار، ابتدا فایل اکسل مراکز را وارد کنید.</div></div>';

  var body=statusHtml
    +'<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:7px;padding:10px 14px;margin-bottom:14px;font-size:12px">'
    +'<strong style="color:#0369a1">📋 فرمت اکسل مورد نیاز:</strong><br>'
    +'ستون‌های الزامی: <code style="background:#dbeafe;padding:1px 5px;border-radius:3px">نام مرکز</code> <code style="background:#dbeafe;padding:1px 5px;border-radius:3px">استان</code><br>'
    +'ستون‌های اختیاری: <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">نوع</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">پتانسیل</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">سرنخ</code> <code style="background:#e2e8f0;padding:1px 5px;border-radius:3px">مسئول</code><br>'
    +'<small style="color:var(--text-muted)">تهران هم باید در ستون استان نوشته شود. هر بار که ایمپورت می‌کنید، کل دیتابیس مراکز جایگزین می‌شود.</small>'
    +'<br><a href="#" onclick="downloadDBTemplate();return false" style="color:#0ea5e9;text-decoration:underline;font-size:11px">📥 دانلود قالب نمونه اکسل</a></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">انتخاب فایل اکسل / CSV</label>'
    +'<input type="file" id="dbFile" accept=".xlsx,.xls,.csv" style="width:100%;padding:8px;border:2px dashed #0ea5e9;border-radius:7px;font-size:12px;cursor:pointer;background:var(--brand-bg)" onchange="handleDBFile(event)"></div>'
    +'<div id="dbPreviewArea" style="margin-top:10px"></div>';

  var foot='<button class="btn-secondary" onclick="closeModal(\'dbManagerModal\')">بستن</button>'
    +'<button class="btn-primary" id="dbDoBtn" style="display:none" onclick="doDBImport()">💾 جایگزین کردن دیتابیس مراکز</button>';
  openModal('dbManagerModal','📦 مدیریت دیتابیس مراکز',body,foot,{lg:true});
}

function downloadDBTemplate(){
  var rows=[
    ['نام مرکز','استان','نوع','پتانسیل','سرنخ','مسئول'],
    ['بیمارستان میلاد','تهران','بیمارستان تامین اجتماعی','1','مشتری','Reyhane.kashisaz'],
    ['بیمارستان نمازی شیراز','فارس','بیمارستان','3','سرنخ','Sarah.hosseini'],
    ['کلینیک تصویربرداری کوثر قزوین','قزوین','مرکز تصویربرداری','2','لید','Mohammad.seyedsalehi'],
    ['مرکز اورولوژی بوعلی سینا مشهد','خراسان رضوی','مرکز','3','سرنخ','Rambod.ghasemi'],
  ];
  var csv=rows.map(function(r){return r.map(function(c){return'"'+c+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_centers_template.csv';a.click();
  showToast('قالب نمونه دانلود شد ✅');
}

var _dbImportData=null;
var _dbRawRows=null;
var _dbHeaders=null;

// ── Step 1: پارس فایل ──────────────────────────────────────────
function handleDBFile(ev){
  var file=ev.target.files[0];if(!file)return;
  var area=document.getElementById('dbPreviewArea');
  if(!area)return;
  area.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ در حال پردازش فایل...</div>';
  var btn=document.getElementById('dbDoBtn');if(btn)btn.style.display='none';

  function onRows(rows){
    if(!rows||rows.length<2){
      area.innerHTML='<div style="color:#dc2626;padding:10px">❌ فایل خالی است یا فرمت نادرست دارد</div>';return;
    }
    _dbHeaders=rows[0].map(function(h){return(h||'').toString().trim();});
    _dbRawRows=rows.slice(1).filter(function(r){return r.some(function(c){return c&&c.toString().trim();});});
    showColumnMapping(_dbHeaders,_dbRawRows);
  }

  function readCsv(){
    var reader=new FileReader();
    reader.onload=function(e){
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
      var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
      var rows=lines.map(function(l){
        var cells=[];var inQ=false;var cur='';
        for(var i=0;i<l.length;i++){var ch=l[i];
          if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cells.push(cur.trim());cur='';}else cur+=ch;}
        cells.push(cur.trim());
        return cells.map(function(c){return c.replace(/^"|"$/g,'').trim();});
      });
      onRows(rows);
    };
    reader.readAsText(file,'UTF-8');
  }

  function readXlsx(){
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
        onRows(rows);
      }catch(err){area.innerHTML='<div style="color:#dc2626;padding:10px">❌ خطا: '+esc(err.message)+'</div>';}
    };
    reader.readAsArrayBuffer(file);
  }

  if(file.name.toLowerCase().endsWith('.csv')){readCsv();return;}
  if(typeof XLSX==='undefined'){
    var script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=readXlsx;
    script.onerror=function(){area.innerHTML='<div style="color:#dc2626;padding:10px">⚠ SheetJS بارگذاری نشد. از CSV استفاده کنید.</div>';};
    document.head.appendChild(script);
  }else{readXlsx();}
}

// ── Step 2: نمایش Column Mapping UI ──────────────────────────────
var _COL_FIELDS=[
  {key:'name',   label:'نام مرکز',  req:true,  hint:'ستون اصلی — الزامی'},
  {key:'province',label:'استان',    req:true,  hint:'نام استان فارسی — الزامی'},
  {key:'type',   label:'نوع مرکز', req:false, hint:'مثلاً: بیمارستان، کلینیک'},
  {key:'potential',label:'پتانسیل',req:false, hint:'عدد ۱ تا ۴'},
  {key:'lead',   label:'نوع لید',  req:false, hint:'سرنخ، لید، مشتری'},
  {key:'owner',  label:'مسئول',    req:false, hint:'نام کاربری مسئول'},
  {key:'tags',   label:'برچسب‌ها', req:false, hint:'با کاما جدا شوند: اورولوژی,VIP'},
  {key:'address',label:'آدرس',     req:false, hint:'آدرس مرکز'},
  {key:'phone',  label:'تلفن',     req:false, hint:'شماره تماس (با کاما برای چندین شماره)'},
];
var _COL_SYNONYMS={
  name:['نام مرکز','نام','name','hospital','مرکز','center','عنوان'],
  province:['استان','province','prov','شهر','region','شهرستان'],
  type:['نوع','نوع مرکز','type','category','دسته'],
  potential:['پتانسیل','potential','pot','اولویت','priority'],
  lead:['سرنخ','lead','نوع مشتری','وضعیت','status'],
  owner:['مسئول','owner','کارشناس','assigned','نماینده'],
  tags:['برچسب','tags','tag','label','دسته‌بندی','کلمه کلیدی'],
  address:['آدرس','address','addr','نشانی'],
  phone:['تلفن','phone','tel','موبایل','شماره','تماس','mobile'],
};

function _autoDetectCols(headers){
  var map={};
  headers.forEach(function(h,i){
    var hn=fNorm(h);
    Object.keys(_COL_SYNONYMS).forEach(function(k){
      if(map[k]!=null)return;
      if(_COL_SYNONYMS[k].some(function(s){
        var sn=fNorm(s);
        return sn===hn||hn.indexOf(sn)>=0||sn.indexOf(hn)>=0;
      }))map[k]=i;
    });
  });
  return map;
}

function showColumnMapping(headers,dataRows){
  var area=document.getElementById('dbPreviewArea');
  if(!area)return;
  var detected=_autoDetectCols(headers);
  var sampleRows=dataRows.slice(0,3);

  var selStyle='width:100%;padding:5px 6px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;box-sizing:border-box';
  var optionsHtml='<option value="">— انتخاب نکن —</option>'
    +headers.map(function(h,i){return'<option value="'+i+'">'+esc(h)+'</option>';}).join('');

  var html='<div style="background:var(--brand-bg);border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px">🗂 تطابق ستون‌ها</div>'
    +'<div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">'
    +'فایل شما <strong>'+headers.length+'</strong> ستون دارد. برای هر فیلد، ستون معادل را انتخاب کنید.'
    +'<br>ستون‌های سبز به صورت خودکار شناسایی شدند. در صورت نیاز اصلاح کنید.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  _COL_FIELDS.forEach(function(f){
    var detected_i=detected[f.key];
    var hasDet=detected_i!=null;
    html+='<div style="background:'+(hasDet?'#f0fdf4':'#fff')+';border:1px solid '+(hasDet?'#86efac':'#e2e8f0')+';border-radius:6px;padding:8px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:4px">'
      +(f.req?'<span style="color:#ef4444">*</span> ':'')+f.label
      +(hasDet?'<span style="background:#bbf7d0;color:#166534;font-size:9px;padding:1px 5px;border-radius:8px;margin-right:4px">⚡ شناسایی شد</span>':'')
      +'</div>'
      +'<select id="colmap_'+f.key+'" style="'+selStyle+'">'
      +'<option value="">— انتخاب نکن —</option>'
      +headers.map(function(h,i){
        return'<option value="'+i+'"'+(detected_i===i?' selected':'')+'>'+esc(h)+'</option>';
      }).join('')
      +'</select>'
      +'<div style="font-size:10px;color:var(--text-muted);margin-top:3px">'+f.hint+'</div>'
      +'</div>';
  });

  html+='</div></div>';

  // نمونه داده
  html+='<div style="font-size:11px;font-weight:600;color:var(--text-primary);margin-bottom:5px">نمونه ۳ ردیف اول:</div>'
    +'<div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;max-height:120px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:10px">'
    +'<thead><tr style="background:var(--bg-raised)">'
    +headers.map(function(h){return'<th style="padding:4px 7px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--border)">'+esc(h)+'</th>';}).join('')
    +'</tr></thead><tbody>'
    +sampleRows.map(function(row){
      return'<tr>'+headers.map(function(_,i){
        return'<td style="padding:3px 7px;border-bottom:1px solid #f1f5f9;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+esc((row[i]||'').toString())+'</td>';
      }).join('')+'</tr>';
    }).join('')
    +'</tbody></table></div>';

  html+='<button onclick="_applyColMapping()" style="margin-top:10px;background:#0ea5e9;color:var(--text-primary);border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600">✅ تأیید نگاشت و پیش‌نمایش</button>';

  area.innerHTML=html;
}

// ── Step 3: اعمال نگاشت و پیش‌نمایش ──────────────────────────────
function _applyColMapping(){
  var colMap={};
  _COL_FIELDS.forEach(function(f){
    var sel=document.getElementById('colmap_'+f.key);
    if(sel&&sel.value!=='')colMap[f.key]=parseInt(sel.value);
  });
  if(colMap.name==null||colMap.province==null){
    showToast('⚠ ستون «نام مرکز» و «استان» الزامی هستند');return;
  }

  var processed=_dbRawRows.map(function(row,idx){
    var name=(row[colMap.name]||'').toString().trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
    var provRaw=(row[colMap.province]||'').toString().trim();
    var provId=provRaw?resolveProvince(provRaw):null;
    var potential=colMap.potential!=null?parseInt(row[colMap.potential])||2:2;
    if(potential<1||potential>4)potential=2;
    var type=colMap.type!=null?(row[colMap.type]||'').toString().trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک'):'';
    var lead=colMap.lead!=null?(row[colMap.lead]||'').toString().trim().replace(/[ي]/g,'ی')||'سرنخ':'سرنخ';
    var owner=colMap.owner!=null?(row[colMap.owner]||'').toString().trim():'';
    var tagsRaw=colMap.tags!=null?(row[colMap.tags]||'').toString().trim():'';
    var address=colMap.address!=null?(row[colMap.address]||'').toString().trim():'';
    var phoneRaw=colMap.phone!=null?(row[colMap.phone]||'').toString().trim():'';
    var phones=phoneRaw?phoneRaw.split(/[,،\/\n]/).map(function(p){return p.trim();}).filter(Boolean):[];
    return{name:name,provId:provId,provRaw:provRaw,potential:potential,type:type,lead:lead,owner:owner,tagsRaw:tagsRaw,address:address,phones:phones,row:idx+1};
  });

  var valid=processed.filter(function(r){return r.name&&r.provId;});
  var noName=processed.filter(function(r){return !r.name;}).length;
  var noProv=processed.filter(function(r){return r.name&&!r.provId;}).length;
  var unknownProvs=[];
  processed.forEach(function(r){if(r.name&&r.provRaw&&!r.provId&&unknownProvs.indexOf(r.provRaw)<0)unknownProvs.push(r.provRaw);});

  var byProv={};valid.forEach(function(r){if(!byProv[r.provId])byProv[r.provId]=0;byProv[r.provId]++;});
  var provBreakdown=Object.keys(byProv).map(function(pid){
    var pv=getAllProvinces().find(function(p){return p.id===pid;});
    return(pv?pv.name:pid)+': '+byProv[pid];
  }).join('  ·  ');

  var area=document.getElementById('dbPreviewArea');
  var html='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html+='<span style="background:#bbf7d0;color:#166534;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">✅ '+valid.length+' مرکز معتبر</span>';
  if(noProv)html+='<span style="background:#fef3c7;color:#854d0e;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">⚠ '+noProv+' استان ناشناخته</span>';
  if(noName)html+='<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:9px;font-size:12px;font-weight:700">'+noName+' بدون نام</span>';
  html+='<button onclick="showColumnMapping(_dbHeaders,_dbRawRows)" style="background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border-input);border-radius:9px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit">← اصلاح نگاشت</button>';
  html+='</div>';

  if(unknownProvs.length){
    html+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:5px;padding:8px;font-size:11px;margin-bottom:8px">'
      +'<strong>⚠ استان‌های شناسایی‌نشده:</strong> '+unknownProvs.slice(0,10).map(esc).join('، ')+(unknownProvs.length>10?'...':'')+'</div>';
  }

  if(Object.keys(byProv).length){
    html+='<div style="font-size:11px;color:var(--text-secondary);background:var(--bg-raised);border-radius:5px;padding:8px;margin-bottom:10px;line-height:1.8">'
      +'<strong>توزیع استانی:</strong><br>'+provBreakdown+'</div>';
  }

  html+='<div style="overflow-x:auto;max-height:200px;border:1px solid var(--border);border-radius:5px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--bg-raised)">'
    +'<th style="padding:5px 8px;text-align:right">استان</th>'
    +'<th style="padding:5px 8px;text-align:right">نام مرکز</th>'
    +'<th style="padding:5px 8px;text-align:right">نوع</th>'
    +'<th style="padding:5px 8px;text-align:right">پتانسیل</th>'
    +'<th style="padding:5px 8px;text-align:right">لید</th>'
    +'</tr></thead><tbody>';
  valid.slice(0,15).forEach(function(r){
    var pv=getAllProvinces().find(function(p){return p.id===r.provId;});
    html+='<tr style="border-bottom:1px solid #f1f5f9">'
      +'<td style="padding:4px 8px;color:#0369a1;font-weight:600">'+(pv?pv.name:r.provId)+'</td>'
      +'<td style="padding:4px 8px">'+esc(r.name)+'</td>'
      +'<td style="padding:4px 8px;color:var(--text-muted)">'+esc(r.type)+'</td>'
      +'<td style="padding:4px 8px;text-align:center">'+r.potential+'</td>'
      +'<td style="padding:4px 8px">'+esc(r.lead)+'</td>'
      +'</tr>';
  });
  if(valid.length>15)html+='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:6px;font-size:10px">... و '+(valid.length-15)+' مرکز دیگر</td></tr>';
  html+='</tbody></table></div>';

  if(valid.length>0){
    html+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px;margin-top:10px;font-size:12px">'
      +'<strong style="color:#92400e">⚠ توجه:</strong> <span style="color:#92400e">با جایگزین کردن دیتابیس، لیست مراکز فعلی پاک می‌شود. داده‌های CRM حفظ می‌شوند.</span></div>';
  }

  area.innerHTML=html;
  _dbImportData=valid;
  var btn=document.getElementById('dbDoBtn');
  if(btn&&valid.length>0){btn.style.display='';btn.textContent='💾 جایگزین کردن '+valid.length+' مرکز در دیتابیس';}
}

function doDBImport(){
  if(!_dbImportData||!_dbImportData.length){showToast('داده‌ای برای ایمپورت وجود ندارد');return;}
  var btn=document.getElementById('dbDoBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ در حال ذخیره...';}

  var rowCounters={};
  var centers=_dbImportData.map(function(r){
    if(!rowCounters[r.provId])rowCounters[r.provId]=0;
    rowCounters[r.provId]++;
    var id=r.provId==='tehran'?'c_'+rowCounters[r.provId]:r.provId+'||'+rowCounters[r.provId];
    return{id:id,row:rowCounters[r.provId],name:r.name,province_id:r.provId,
      type:r.type,potential:r.potential,lead:r.lead,owner:r.owner,
      _sourceIdx:_dbImportData.indexOf(r)};
  });

  saveMasterCenters(centers).then(function(ok){
    if(!ok){showToast('❌ خطا در ذخیره‌سازی.');if(btn){btn.disabled=false;btn.textContent='💾 جایگزین کردن دیتابیس';}return;}

    // اعمال آدرس، تلفن، برچسب از ایمپورت به DB
    _applyImportMeta(centers,_dbImportData);

    return loadMasterCenters().then(function(){
    _PC_CACHE=null; // refresh after CENTERS loaded

      _typeFilterBuilt=false;clearPCCache();_ALL_PROVS=null;
      rebuildFilters();buildTypeFilter();
      closeModal('dbManagerModal');
      renderDashboard();renderBanner();renderTable();checkEmptyDB();
      showToast('✅ دیتابیس مراکز با '+centers.length+' مرکز آپدیت شد',4000);
    });
  }).catch(function(err){
    showToast('❌ خطا در آپدیت دیتابیس: '+(err&&err.message?err.message:''));
    if(btn){btn.disabled=false;btn.textContent='💾 جایگزین کردن دیتابیس';}
  });
}

function _applyImportMeta(centers,sourceData){
  // اعمال آدرس، تلفن، برچسب برای هر مرکز ایمپورت‌شده
  centers.forEach(function(c){
    var src=sourceData[c._sourceIdx];if(!src)return;
    var rtype=c.province_id==='tehran'?'center':'pc';
    var k=recK(rtype,c.id);

    // آدرس
    if(src.address){
      if(!DB.edits[k])DB.edits[k]={};
      DB.edits[k].address=src.address;
    }
    // تلفن
    if(src.phones&&src.phones.length){
      if(!DB.edits[k])DB.edits[k]={};
      DB.edits[k].phones=src.phones;
    }
    // برچسب‌ها
    if(src.tagsRaw){
      var tagNames=src.tagsRaw.split(/[,،]/).map(function(t){return t.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');}).filter(Boolean);
      var tagIds=tagNames.map(function(tn){
        var existing=(DB.tags||[]).find(function(t){return t.name===tn;});
        if(existing)return existing.id;
        // برچسب جدید بسازیم
        if(!DB.tags)DB.tags=[];
        var colors=['#0ea5e9','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#ec4899'];
        var newTag={id:'tag_'+Date.now()+'_'+Math.random().toString(36).slice(2),name:tn,color:colors[DB.tags.length%colors.length]};
        DB.tags.push(newTag);
        return newTag.id;
      });
      if(!DB.rTags)DB.rTags={};
      DB.rTags[k]=tagIds;
    }
  });
  saveDB();
}

function confirmClearMasterDB(){
  if(!confirm('⚠ آیا مطمئنید؟ کل دیتابیس مراکز پاک می‌شود.\nداده‌های CRM (وضعیت، یادداشت‌ها) حفظ می‌شوند.'))return;
  saveMasterCenters([]).then(function(){
    CENTERS.length=0;Object.keys(PC_RAW).forEach(function(k){delete PC_RAW[k];});
    clearPCCache();_ALL_PROVS=null;_typeFilterBuilt=false;
    closeModal('dbManagerModal');
    renderDashboard();checkEmptyDB();
    showToast('دیتابیس مراکز پاک شد');
  });
}


function openImport(){
  var body='<div class="imp-info-box"><strong>راهنمای فرمت:</strong><br>'
    +'ستون‌های پیشنهادی: <span style="color:#0369a1">نام مرکز</span> (الزامی) • <span style="color:#0369a1">استان</span> (اگر ندارید، از انتخاب زیر استفاده کنید) • پتانسیل • نوع • سرنخ • مسئول<br>'
    +'<a href="#" onclick="downloadImportTemplate();return false" style="color:#0ea5e9;text-decoration:underline">📥 دانلود قالب نمونه</a></div>'
    +'<div class="m-2col" style="margin-bottom:10px">'
    +'<div><label>استان پیش‌فرض (اگر ستون استان در فایل نیست)</label>'
    +'<select id="impProv" style="width:100%;padding:7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px">'
    +'<option value="">— از ستون استان در فایل استفاده شود —</option>'
    +getAllProvinces().map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('')
    +'</select></div>'
    +'<div><label>فایل اکسل / CSV</label>'
    +'<input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="width:100%;padding:6px;border:1px dashed #cbd5e1;border-radius:5px;font-size:12px" onchange="handleImportFile(event)"></div>'
    +'</div>'
    +'<div id="impPreviewArea"></div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'importModal\')">بستن</button>'
    +'<button class="btn-primary" id="impDoBtn" style="display:none" onclick="doImport()">✅ وارد کردن</button>';
  openModal('importModal','📥 ایمپورت مراکز از اکسل',body,foot,{lg:true});
}

function downloadImportTemplate(){
  var rows=[
    ['نام مرکز','استان','پتانسیل','نوع','سرنخ','مسئول'],
    ['بیمارستان نمونه تهران','تهران','1','بیمارستان','مشتری','Sarah.hosseini'],
    ['کلینیک نمونه اصفهان','اصفهان','2','کلینیک','لید','Reyhane.kashisaz'],
    ['مرکز تصویربرداری شیراز','فارس','3','مرکز تصویربرداری','سرنخ',''],
  ];
  var csv=rows.map(function(r){return r.map(function(c){return'"'+c+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='atena_import_template.csv';a.click();
  showToast('قالب نمونه دانلود شد');
}

function handleImportFile(ev){
  var file=ev.target.files[0];if(!file)return;
  var area=document.getElementById('impPreviewArea');
  area.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">در حال پردازش...</div>';
  if(file.name.toLowerCase().endsWith('.csv')){
    var reader=new FileReader();
    reader.onload=function(e){
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
      var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
      var rows=lines.map(function(l){
        var cells=[];var inQ=false;var cur='';
        for(var i=0;i<l.length;i++){var ch=l[i];
          if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cells.push(cur.trim());cur='';}
          else cur+=ch;}
        cells.push(cur.trim());
        return cells.map(function(c){return c.replace(/^"|"$/g,'').trim();});
      });
      processImportRows(rows);
    };
    reader.readAsText(file,'UTF-8');return;
  }
  if(typeof XLSX==='undefined'){
    var script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=function(){readXLSX(file);};
    script.onerror=function(){area.innerHTML='<div style="color:#dc2626;padding:10px">⚠ SheetJS بارگذاری نشد. از فرمت CSV استفاده کنید.</div>';};
    document.head.appendChild(script);
  }else{readXLSX(file);}
}

function readXLSX(file){
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      processImportRows(rows);
    }catch(err){
      document.getElementById('impPreviewArea').innerHTML='<div style="color:#dc2626;padding:10px">❌ خطا: '+esc(err.message)+'</div>';
    }
  };
  reader.readAsArrayBuffer(file);
}

// نگاشت نام استان به ID (fuzzy)
function resolveProvince(name){
  if(!name||!name.trim())return null;
  var n=name.trim().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
  var provs=getAllProvinces();
  // exact match
  var ex=provs.find(function(p){return p.name===n;});if(ex)return ex.id;
  // partial match
  var pm=provs.find(function(p){return p.name.indexOf(n)>=0||n.indexOf(p.name)>=0;});if(pm)return pm.id;
  // fuzzy match
  var fm=provs.find(function(p){return fNorm(p.name).indexOf(fNorm(n))>=0||fNorm(n).indexOf(fNorm(p.name))>=0;});
  return fm?fm.id:null;
}

function processImportRows(rows){
  if(!rows||rows.length<2){
    document.getElementById('impPreviewArea').innerHTML='<div style="color:#dc2626;padding:10px">فایل خالی است یا فرمت نادرست دارد</div>';
    return;
  }
  var headers=rows[0].map(function(h){return(h||'').toString().trim();});
  _importData=rows.slice(1).filter(function(r){return r.some(function(c){return c&&c.toString().trim();});});
  _importCols=headers;

  // auto-detect column mapping
  var autoMap={};
  var maps={
    name:['نام مرکز','نام','name','center','مرکز','hospital','بیمارستان'],
    province:['استان','province','prov','شهرستان','city','شهر'],
    potential:['پتانسیل','potential','pot','اولویت'],
    type:['نوع','type','نوع مرکز'],
    lead:['سرنخ','lead','نوع مشتری','مشتری'],
    owner:['مسئول','owner','کارشناس','نام کارشناس']
  };
  headers.forEach(function(h,i){
    var hl=fNorm(h);
    Object.keys(maps).forEach(function(k){
      if(autoMap[k]===undefined&&maps[k].some(function(kw){return fNorm(kw)===hl||hl.indexOf(fNorm(kw))>=0||fNorm(kw).indexOf(hl)>=0;}))
        autoMap[k]=i;
    });
  });

  // پیش‌پردازش برای resolve استان هر ردیف
  var defaultProvId=document.getElementById('impProv').value;
  var provColIdx=autoMap.province!=null?autoMap.province:-1;

  var processed=_importData.map(function(row){
    var name=(row[autoMap.name!=null?autoMap.name:0]||'').toString().trim();
    var provRaw=provColIdx>=0?(row[provColIdx]||'').toString().trim():'';
    var provId=null;
    if(provRaw){provId=resolveProvince(provRaw);}
    if(!provId&&defaultProvId){provId=defaultProvId;}
    var provName=provId?(getAllProvinces().find(function(p){return p.id===provId;})||{}).name||'؟':'؟';
    return{name:name,provId:provId,provName:provName,provRaw:provRaw,row:row};
  });

  var validCount=processed.filter(function(r){return r.name&&r.provId;}).length;
  var noProvCount=processed.filter(function(r){return r.name&&!r.provId;}).length;
  var emptyCount=processed.filter(function(r){return !r.name;}).length;
  var unknownProvs=[...new Set(processed.filter(function(r){return r.provRaw&&!r.provId;}).map(function(r){return r.provRaw;}))];

  var preview='<div style="margin-top:10px">';
  preview+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  preview+='<span class="imp-badge imp-ok">✅ '+validCount+' مرکز آماده ایمپورت</span>';
  if(noProvCount)preview+='<span class="imp-badge imp-warn">⚠ '+noProvCount+' بدون استان</span>';
  if(emptyCount)preview+='<span class="imp-badge" style="background:#fee2e2;color:#991b1b">'+emptyCount+' بدون نام (رد می‌شوند)</span>';
  preview+='</div>';

  if(unknownProvs.length){
    preview+='<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:5px;padding:8px;font-size:11px;margin-bottom:8px">';
    preview+='<strong>⚠ استان‌های شناسایی‌نشده:</strong> '+unknownProvs.map(esc).join('، ')+'<br>';
    preview+='<small>این مراکز ایمپورت نمی‌شوند مگر استان پیش‌فرض انتخاب کنید.</small></div>';
  }

  // نگاشت ستون‌ها
  preview+='<details style="margin-bottom:8px"><summary style="font-size:12px;font-weight:600;cursor:pointer;color:#0369a1">⚙ تنظیم ستون‌ها ('+headers.length+' ستون شناسایی شد)</summary>';
  preview+='<div class="imp-col-map" style="margin-top:8px">';
  var fields=[
    {k:'name',l:'نام مرکز *'},
    {k:'province',l:'استان'},
    {k:'potential',l:'پتانسیل'},
    {k:'type',l:'نوع'},
    {k:'lead',l:'سرنخ'},
    {k:'owner',l:'مسئول'}
  ];
  fields.forEach(function(f){
    preview+='<select id="impMap_'+f.k+'" onchange="reProcessImport()" style="font-size:11px">'
      +'<option value="-1">— نادیده —</option>'
      +headers.map(function(h,i){return'<option value="'+i+'"'+(autoMap[f.k]===i?' selected':'')+'>'+esc(h)+'</option>';}).join('')
      +'</select><label style="font-size:11px;color:var(--text-secondary);padding:5px 0;align-self:center">'+f.l+'</label>';
  });
  preview+='</div></details>';

  // پیش‌نمایش جدول
  preview+='<div class="imp-preview"><table><thead><tr>'
    +'<th style="background:#dbeafe;color:#1e40af">استان تشخیص‌داده‌شده</th>'
    +headers.map(function(h){return'<th>'+esc(h)+'</th>';}).join('')
    +'</tr></thead><tbody>';
  processed.slice(0,10).forEach(function(p){
    var ok=p.provId&&p.name;
    preview+='<tr style="'+(ok?'':'opacity:.5')+'">'
      +'<td style="font-weight:600;color:'+(p.provId?'#16a34a':'#dc2626')+';background:'+(p.provId?'#f0fdf4':'#fef2f2')+'">'+esc(p.provId?p.provName:'شناسایی‌نشده')+'</td>'
      +headers.map(function(_,i){return'<td>'+esc((p.row[i]||'').toString())+'</td>';}).join('')
      +'</tr>';
  });
  if(processed.length>10){preview+='<tr><td colspan="'+(headers.length+1)+'" style="text-align:center;color:var(--text-muted);font-size:10px">... و '+(processed.length-10)+' ردیف دیگر</td></tr>';}
  preview+='</tbody></table></div>';
  preview+='<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer">'
    +'<input type="checkbox" id="impReplaceHard"> جایگزین مراکز پیش‌فرض برای استان‌های ایمپورت‌شده</label>';
  preview+='</div>';

  document.getElementById('impPreviewArea').innerHTML=preview;
  // ذخیره processed برای doImport
  window._impProcessed=processed;
  var btn=document.getElementById('impDoBtn');
  if(btn){btn.style.display=validCount>0?'':'none';btn.textContent='✅ وارد کردن '+validCount+' مرکز';}
}

function reProcessImport(){
  // بازخوانی با نگاشت ستون‌های جدید
  if(!_importData)return;
  var getMap=function(k){var el=document.getElementById('impMap_'+k);return el?parseInt(el.value):-1;};
  var newAutoMap={name:getMap('name'),province:getMap('province'),potential:getMap('potential'),type:getMap('type'),lead:getMap('lead'),owner:getMap('owner')};
  var defaultProvId=document.getElementById('impProv').value;
  var processed=_importData.map(function(row){
    var name=(newAutoMap.name>=0?(row[newAutoMap.name]||''):'').toString().trim();
    var provRaw=newAutoMap.province>=0?(row[newAutoMap.province]||'').toString().trim():'';
    var provId=provRaw?resolveProvince(provRaw):null;
    if(!provId&&defaultProvId)provId=defaultProvId;
    var provName=provId?(getAllProvinces().find(function(p){return p.id===provId;})||{}).name||'؟':'؟';
    return{name:name,provId:provId,provName:provName,row:row,_map:newAutoMap};
  });
  window._impProcessed=processed;
  var validCount=processed.filter(function(r){return r.name&&r.provId;}).length;
  var btn=document.getElementById('impDoBtn');
  if(btn){btn.style.display=validCount>0?'':'none';btn.textContent='✅ وارد کردن '+validCount+' مرکز';}
  // آپدیت badge
  var badges=document.querySelector('.imp-preview');
  if(badges)return; // table already exists; just update button
}

function doImport(){
  var processed=window._impProcessed;
  if(!processed||!processed.length){showToast('فایل انتخاب نشده');return;}
  var getMap=function(k){var el=document.getElementById('impMap_'+k);return el?parseInt(el.value):-1;};
  var potCol=getMap('potential'),typeCol=getMap('type'),leadCol=getMap('lead'),ownerCol=getMap('owner');
  var replaceHard=document.getElementById('impReplaceHard');
  if(!DB.extra)DB.extra=[];if(!DB.hiddenProvs)DB.hiddenProvs={};
  var imported=0;var skipped=0;var byProv={};
  processed.forEach(function(p){
    if(!p.name||!p.provId)return;
    var existing=getProvCenters(p.provId);
    var dup=existing.find(function(c){return fNorm(c.name)===fNorm(p.name);});if(dup){skipped++;return;}
    if(!byProv[p.provId])byProv[p.provId]={maxRow:Math.max(0,...existing.map(function(c){return c.row||0;}))};
    byProv[p.provId].maxRow++;
    var rtype=getProvType(p.provId);
    var id=rtype+'_imp_'+Date.now()+'_'+byProv[p.provId].maxRow;
    var pot=potCol>=0?parseInt((p.row[potCol]||'3').toString())||3:3;if(pot<1||pot>4)pot=3;
    var type=typeCol>=0?(p.row[typeCol]||'').toString().trim()||'سایر':'سایر';
    var lead=leadCol>=0?(p.row[leadCol]||'').toString().trim()||'سرنخ':'سرنخ';
    var owner=ownerCol>=0?(p.row[ownerCol]||'').toString().trim():'';
    DB.extra.push({id:id,row:byProv[p.provId].maxRow,name:p.name,potential:pot,type:type,lead:lead,province_id:p.provId,owner:owner||currentUser});
    if(owner){var ek=rtype+'_'+id;if(!DB.edits[ek])DB.edits[ek]={};DB.edits[ek].owner=owner;}
    imported++;
  });
  if(replaceHard&&replaceHard.checked){
    Object.keys(byProv).forEach(function(pid){DB.hiddenProvs[pid]=true;});
  }
  saveDB();closeModal('importModal');
  var provNames=[...new Set(processed.filter(function(p){return p.provId;}).map(function(p){return p.provName;}))];
  showToast(imported+' مرکز در '+provNames.length+' استان ایمپورت شد'+(skipped?' ('+skipped+' تکراری رد شد)':'')+' ✅',4000);
  if(_currentProvId&&byProv[_currentProvId])renderProvTable();
  renderDashboard();
}

// ═══════════════════════════════════════════════════════════


// ════════════════════════ ALL CENTERS VIEW ══════════════════
function setProvView(mode){
  _provView=mode;
  ['grid','list','kanban'].forEach(function(m){
    var b=document.getElementById('viewProvBtn');var bl=document.getElementById('viewAllListBtn');var bk=document.getElementById('viewAllKbBtn');
    if(b)b.classList.toggle('active',mode==='grid');
    if(bl)bl.classList.toggle('active',mode==='list');
    if(bk)bk.classList.toggle('active',mode==='kanban');
  });
  if(mode==='grid')renderProvList();
  else renderAllCenters(mode);
}

function renderAllCenters(viewMode){
  var pg=document.getElementById('provGrid');if(pg)pg.style.display='none';
  var tbl=document.getElementById('mainTable');
  var kb=document.getElementById('kanbanView');
  var cv=document.getElementById('cardView');
  // filter controls
  ['srch','fPot','fStatus','fLead','fOwner','fType','fTag'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='';});
  rebuildFilters();
  // collect all centers
  var q=(document.getElementById('srch')||{}).value||'';
  var fp=(document.getElementById('fPot')||{}).value||'';
  var fs=(document.getElementById('fStatus')||{}).value||'';
  var fl=(document.getElementById('fLead')||{}).value||'';
  var fo=(document.getElementById('fOwner')||{}).value||'';
  var ftp=document.getElementById('fType')?document.getElementById('fType').value:'';
  var _ftgEl=document.getElementById('fTag');var ftg=_ftgEl&&_ftgEl.value?parseInt(_ftgEl.value):0;
  var effectiveOwner=fo||_globalOwnerFilter||(_isExpert()?currentUser:'');
  var allRows=[];
  _getAllowedProvinces(getAllProvinces()).forEach(function(p){
    var tp=getProvType(p.id);
    getProvCenters(p.id).forEach(function(c){
      var e=getE(tp,c.id);
      if(q&&!fMatch(q,c.name))return;
      if(fp&&String(e.potential!==undefined?e.potential:c.potential)!==fp)return;
      var st=e.status||'بدون تماس';if(fs&&st!==fs)return;
      var lead=(e.lead||c.lead||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim();if(fl&&lead!==fl)return;
      var owner=e.owner||c.owner||'';if(effectiveOwner&&owner!==effectiveOwner)return;
      if(ftp){var ctype=e.type||c.type||'';if(ctype.indexOf(ftp)<0)return;}
      if(ftg){var tgs=rTags(tp,c.id);if(tgs.indexOf(ftg)===-1)return;}
      allRows.push({r:c,rtype:tp,prov:p.name});
    });
  });
  var _rc=document.getElementById('rowCount');if(_rc)_rc.textContent='نمایش '+allRows.length+' مرکز از همه استان‌ها';

  if(viewMode==='kanban'){
    if(tbl)tbl.style.display='none';if(cv)cv.style.display='none';
    if(kb)kb.style.display='';
    var groups={};STATUS_LIST.forEach(function(s){groups[s]=[];});
    allRows.forEach(function(item){var st=getE(item.rtype,item.r.id).status||'بدون تماس';(groups[st]=groups[st]||[]).push(item);});
    kb.innerHTML='<div class="kanban-board">'+STATUS_LIST.map(function(st,idx){
      var rows=groups[st]||[];
      return'<div class="kanban-col"><div class="kanban-col-head '+H_CLS[idx]+'">'+st+' <span class="kanban-cnt">'+rows.length+'</span></div>'
        +'<div class="kanban-col-body">'+rows.map(function(item){
          var e=getE(item.rtype,item.r.id);var fd=e.followupDate||'';
          return'<div class="kanban-card" data-rt="'+item.rtype+'" data-rid="'+item.r.id+'" onclick="openCenterModal(this.dataset.rt,this.dataset.rid)">'
            +'<div class="kanban-card-name">'+esc(item.r.name)+'</div>'
            +'<div class="kanban-card-meta">'
            +'<span style="font-size:9px;color:#94a3b8">'+esc(item.prov)+'</span>'
            +'<span class="pot-badge pot-'+(e.potential||item.r.potential)+'">'+(e.potential||item.r.potential)+'</span>'
            +(fd?'<span class="kc-date">'+fd+'</span>':'')
            +'</div></div>';
        }).join('')+'</div></div>';
    }).join('')+'</div>';
    return;
  }
  // list view
  if(kb)kb.style.display='none';if(cv)cv.style.display='none';
  if(tbl)tbl.style.display='';
  var today=todayStr();
  var head=document.getElementById('tableHead');
  var body=document.getElementById('tableBody');
  head.innerHTML='<tr><th>#</th><th>مرکز</th><th>استان</th><th>پتانسیل</th><th>نوع</th><th>سرنخ</th><th>مسئول</th><th>وضعیت</th><th>پیگیری</th><th>یادداشت</th></tr>';
  // DOM-based row building (no string escaping issues)
  body.innerHTML='';
  if(!allRows.length){
    var emptyR=document.createElement('tr');emptyR.innerHTML='<td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">نتیجه‌ای یافت نشد</td>';
    body.appendChild(emptyR);
  }else{allRows.forEach(function(item,idx){
    var r=item.r;var rtype=item.rtype;var e=getE(rtype,r.id);
    var st=e.status||'بدون تماس';var sc=stCls(st);
    var lead=e.lead||r.lead||'سرنخ';var lc=lCls(lead);
    var pot=e.potential!==undefined?e.potential:r.potential;
    var fd=e.followupDate||'';var today2=todayStr();
    var fdCls='fd-inp'+(fd&&fd<today2?' ov':fd&&fd===today2?' today':'');
    var notes=DB.notes[recK(rtype,r.id)]||[];
    var ov=isOverdue(rtype,r.id);var stall=isStalled(rtype,r.id);
    var tr=document.createElement('tr');
    tr.setAttribute('data-rowid',r.id);
    if(stall)tr.style.background='#fef2f2';else if(ov)tr.style.background='#fffbeb';
    // cells
    var cells=[
      '<td>'+(idx+1)+'</td>',
      '<td>'+(stall?'<span class="risk-badge">🔴</span>':ov?'<span class="risk-badge">🟠</span>':'')
        +'<button class="ctr-link">'+esc(r.name)+'</button>'+renderTagCell(rtype,r.id)+'</td>',
      '<td style="font-size:10px;color:var(--text-muted)">'+esc(item.prov)+'</td>',
      '<td><span class="pot-badge pot-'+pot+'">'+pot+'</span></td>',
      '<td><span style="font-size:11px">'+esc(e.type||r.type||'')+'</span></td>',
      '<td><span class="'+lc+'" style="padding:2px 6px;border-radius:4px;font-size:11px">'+lead+'</span></td>',
      '<td style="font-size:11px">'+esc(USERS[e.owner||r.owner||'']||e.owner||r.owner||'—')+'</td>',
      '<td><select class="st-sel '+sc+'">'+STATUS_LIST.map(function(s,i){return'<option class="'+STATUS_CLS[i]+'"'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select></td>',
      '<td><input type="text" class="'+fdCls+'" value="'+fd+'" readonly style="cursor:pointer;width:98px"></td>',
      '<td><button class="note-btn'+(notes.length?' has':'')+'">📝'+(notes.length?' '+notes.length:'')+'</button></td>'
    ];
    tr.innerHTML=cells.join('');
    // event listeners via DOM
    var nameBtn=tr.querySelector('.ctr-link');
    if(nameBtn)(function(rt,rid){nameBtn.addEventListener('click',function(){openCenterModal(rt,rid);});})(rtype,r.id);
    var stSel=tr.querySelector('.st-sel');
    if(stSel)(function(rt,rid){stSel.addEventListener('change',function(){onStatus(rt,rid,stSel);});})(rtype,r.id);
    var fdInp=tr.querySelector('.fd-inp');
    if(fdInp)(function(rt,rid,inp){inp.addEventListener('click',function(){openJDP(inp,function(v){setE(rt,rid,'followupDate',v);inp.value=v;renderBanner();});});})(rtype,r.id,fdInp);
    var noteBtn=tr.querySelector('.note-btn');
    if(noteBtn)(function(rt,rid,nm){noteBtn.addEventListener('click',function(){openNotes(rt,rid,nm);});})(rtype,r.id,r.name);
    body.appendChild(tr);
  });}
  //empty marker'<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">نتیجه‌ای یافت نشد</td></tr>';
}
// ═══════════════════════════════════════════════════════════
// ════════════════════════ CLEAR ALL DATA ════════════════════
function clearAllData(){
  openModal('clearModal','🗑 پاک‌سازی داده‌ها',
    '<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:7px;padding:12px;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:8px">⚠ این عملیات برگشت‌پذیر نیست!</div>'
    +'<div style="font-size:12px;color:#991b1b">موارد زیر پاک می‌شوند:<br>'
    +'• وضعیت، سرنخ، پتانسیل، مسئول همه مراکز<br>'
    +'• یادداشت‌ها<br>'
    +'• مراکز اضافه‌شده دستی<br>'
    +'• برنامه‌های هفته<br>'
    +'• رویدادها و چک‌لیست‌ها<br>'
    +'• تنظیمات پنهان/نمایش داده‌های پیش‌فرض</div>'
    +'<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid #fca5a5">برچسب‌ها و هفته‌های تعریف‌شده حفظ می‌شوند</div>'
    +'</div>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearEdits" checked> وضعیت‌ها، سرنخ، مسئول، پتانسیل</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearNotes" checked> یادداشت‌ها</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearExtra" checked> مراکز اضافه‌شده دستی / ایمپورت‌شده</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px">'
    +'<input type="checkbox" id="clearWeeks" checked> برنامه‌های هفته (مراکز در هفته‌ها)</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">'
    +'<input type="checkbox" id="clearEvents" checked> رویدادها و چک‌لیست‌ها</label>',
    '<button class="btn-secondary" onclick="closeModal(\'clearModal\')">انصراف</button>'
    +'<button class="btn-danger" onclick="doCleanAll()">🗑 پاک کردن</button>'
  );
}
function doCleanAll(){
  var cleared=[];
  if(document.getElementById('clearEdits').checked){DB.edits={};cleared.push('وضعیت‌ها');}
  if(document.getElementById('clearNotes').checked){DB.notes={};cleared.push('یادداشت‌ها');}
  if(document.getElementById('clearExtra').checked){DB.extra=[];DB.hiddenProvs={};cleared.push('مراکز اضافه‌شده');}
  if(document.getElementById('clearWeeks').checked){DB.weekEntries={};cleared.push('برنامه‌های هفته');}
  if(document.getElementById('clearEvents').checked){DB.events=[];DB.checklist={};cleared.push('رویدادها');}
  saveDB();
  closeModal('clearModal');
  _globalOwnerFilter='';_bannerFilterUser='';
  renderDashboard();renderBanner();renderTable();
  showToast('پاک‌سازی انجام شد: '+cleared.join('، ')+' ✅',4000);
}
// ═══════════════════════════════════════════════════════════

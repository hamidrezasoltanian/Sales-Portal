'use strict';
// payroll.js — Payroll report UI (super-admin only)
// Functions: openPayrollPanel, renderPayrollPanel, _payrollCalc, _payrollFinalize,
//            openPayrollSettings, savePayrollSettings, _payrollFmt

var _payrollMonth = '';  // 'YYYY/MM' Jalali

function _payrollFmt(n){
  if(n==null||n===undefined)return '—';
  return Math.round(n).toLocaleString('fa-IR');
}

function openPayrollPanel(){
  if(typeof _isSuperAdmin==='function'&&!_isSuperAdmin()){showToast('⚠ فقط سوپر ادمین دسترسی دارد');return;}
  if(!_payrollMonth){
    var t=todayStr().split('/');
    _payrollMonth=t[0]+'/'+t[1];
  }
  var m=openModal('payrollModal','💰 گزارش حقوق و پورسانت','<div id="payrollWrap">'+_payrollLoading()+'</div>','',{lg:true});
  if(m&&m.foot){
    var settingsBtn=document.createElement('button');
    settingsBtn.type='button';
    settingsBtn.textContent='⚙️ تنظیمات پورسانت';
    settingsBtn.style.cssText='background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:5px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:inherit';
    settingsBtn.addEventListener('click',function(){openPayrollSettings();});
    m.foot.appendChild(settingsBtn);
    var closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.className='btn-secondary';
    closeBtn.style.marginRight='8px';
    closeBtn.textContent='بستن';
    closeBtn.addEventListener('click',function(){closeModal('payrollModal');});
    m.foot.appendChild(closeBtn);
  }
  renderPayrollPanel();
}

function _payrollLoading(){
  return '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ در حال بارگذاری...</div>';
}

function renderPayrollPanel(){
  var wrap=document.getElementById('payrollWrap');
  if(!wrap)return;

  var monthInput='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#166534;line-height:1.6">'
    +'💡 <strong>ثبت حقوق:</strong> از تب <strong>منابع انسانی → کارمندان → ویرایش</strong> بخش «حقوق و قرارداد» را پر کنید '
    +'(داخل لیست بیمه / خارج لیست بیمه). این صفحه فقط برای محاسبه و گزارش ماهانه است.'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
    +'<label style="font-size:13px;font-weight:600;color:var(--text-primary)">ماه:</label>'
    +'<input id="payrollMonthInp" type="text" value="'+esc(_payrollMonth)+'" placeholder="1403/01" dir="ltr" '
    +'style="width:110px;padding:7px 10px;border:1.5px solid var(--border-input);border-radius:6px;font-size:13px;font-family:monospace;background:var(--bg-input);color:var(--text-primary)">'
    +'<button onclick="_payrollCalc()" style="background:var(--brand);color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit">📊 محاسبه</button>'
    +'<button onclick="_payrollDraft()" style="background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:12px;font-family:inherit">📝 پیش‌نویس</button>'
    +'</div>';

  wrap.innerHTML=monthInput+'<div id="payrollTable">'+_payrollLoading()+'</div>';
  _payrollCalc();
}

function _payrollCalc(){
  var inp=document.getElementById('payrollMonthInp');
  if(inp)_payrollMonth=(inp.value||'').trim();
  if(!/^\d{4}\/\d{2}$/.test(_payrollMonth)){showToast('⚠ ماه را به فرمت ۱۴۰۳/۰۱ وارد کنید');return;}
  var tbl=document.getElementById('payrollTable');
  if(tbl)tbl.innerHTML=_payrollLoading();
  fetch('/api/payroll/calculate/'+encodeURIComponent(_payrollMonth))
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(data){
      if(tbl)tbl.innerHTML=_payrollRenderTable(data);
    })
    .catch(function(e){if(tbl)tbl.innerHTML='<div style="color:#dc2626;padding:12px">❌ خطا: '+esc(e.message)+'</div>';});
}

function _payrollRenderTable(data){
  if(!data||!data.rows||!data.rows.length){
    return '<div style="padding:30px;text-align:center;color:var(--text-muted)">داده‌ای برای این ماه یافت نشد.</div>';
  }
  var settings=data.settings||{};
  var settingsSummary='<div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:7px;padding:8px 14px;margin-bottom:12px;font-size:11px;color:#5b21b6">'
    +'نرخ پایه: <strong>'+settings.base_pct+'٪</strong> · '
    +'آستانه پلکان: <strong>'+_payrollFmt(settings.tier_threshold)+' ریال</strong> · '
    +'هر پله: <strong>'+_payrollFmt(settings.tier_step_amount)+' ریال → +'+settings.tier_step_pct+'٪</strong> · '
    +'آستانه KPI: <strong>'+settings.kpi_threshold+'</strong> → ضریب پله: <strong>'+settings.kpi_multiplier+'x</strong>'
    +'</div>';

  var statusLabels={draft:'پیش‌نویس',manager_review:'بررسی مدیر',financial_approval:'تأیید مالی',locked:'قفل',published:'منتشر'};
  var cols=['نام','وضعیت','پایه','پاداش','فروش تسویه','کارکرد','تارگت','پورسانت','ناخالص','بیمه','مالیات','خالص'];
  var thead='<thead><tr style="background:var(--bg-raised)">'
    +cols.map(function(c){return'<th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--text-muted);white-space:nowrap">'+c+'</th>';}).join('')
    +'<th style="padding:9px 10px;text-align:center;font-size:11px;color:var(--text-muted)">عملیات</th>'
    +'</tr></thead>';

  var rows=data.rows.map(function(r){
    var kpiLabel=r.kpi_score!=null?('<span style="font-size:10px;color:#0ea5e9;margin-right:4px">KPI:'+r.kpi_score+(r.kpi_gate_passed?'✓':'')+'</span>'):'';
    var typeLabel=r.employee_type==='trade'?'<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;margin-right:4px">بازرگانی</span>':'';
    var leaveHint=(r.leave_days>0)?('<span style="font-size:10px;color:#b45309;margin-right:4px">مرخصی:'+r.leave_days+'</span>'):'';
    var targetHint=(r.sales_target_adjusted!=null&&r.sales_target_raw!=null&&r.sales_target_adjusted!==r.sales_target_raw)
      ?('<span style="font-size:10px;color:#0369a1" title="تارگت خام: '+_payrollFmt(r.sales_target_raw)+'">تارگت:'+_payrollFmt(r.sales_target_adjusted)+'</span>'):'—';
    var stLabel=statusLabels[r.status]||(r.finalized?'قفل':'پیش‌نویس');
    var stColor=r.status==='locked'||r.status==='published'?'#15803d':(r.status==='draft'?'#6b7280':'#0ea5e9');
    var salesHint=r.sales_source==='paid_invoices'?'<span style="font-size:9px;color:#15803d">تسویه</span>':'';
    return '<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text-primary)">'+esc(r.display_name||r.employee)+typeLabel+kpiLabel+'</td>'
      +'<td style="padding:8px 10px;font-size:11px"><span style="background:'+stColor+'20;color:'+stColor+';padding:2px 8px;border-radius:10px">'+stLabel+'</span></td>'
      +'<td style="padding:8px 10px;font-size:12px;color:var(--text-secondary);font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.prorated_base!=null?r.prorated_base:r.base_salary)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:#0ea5e9;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.kpi_bonus)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:var(--text-primary);font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.sales_total)+salesHint+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:#b45309;text-align:center">'+(r.working_days!=null?r.working_days:(r.leave_days||0))+'</td>'
      +'<td style="padding:8px 10px;font-size:11px;color:#0369a1;font-family:monospace;direction:ltr;text-align:left">'+targetHint+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:#15803d;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.commission_amount)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.gross_pay!=null?r.gross_pay:r.total_pay)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:#dc2626;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.insurance)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;color:#dc2626;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.tax)+'</td>'
      +'<td style="padding:8px 10px;font-size:13px;font-weight:800;color:var(--brand);font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(r.net_pay!=null?r.net_pay:r.total_pay)+'</td>'
      +'<td style="padding:8px 10px;text-align:center">'
        +(r.finalized
          ?'<span style="font-size:11px;background:#dcfce7;color:#15803d;border-radius:4px;padding:3px 8px">✅ نهایی</span>'
          :'<button onclick="_payrollFinalize(\''+esc(r.employee)+'\',\''+_payrollMonth+'\')" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:11px;font-family:inherit">🔒 نهایی</button>'
        )
      +'</td>'
      +'</tr>';
  }).join('');

  // Totals row
  var totals=data.rows.reduce(function(acc,r){
    acc.base+=r.base_salary||0;acc.kpi+=r.kpi_bonus||0;acc.sales+=r.sales_total||0;
    acc.commission+=r.commission_amount||0;
    acc.gross+=(r.gross_pay!=null?r.gross_pay:r.total_pay)||0;
    acc.insurance+=r.insurance||0;acc.tax+=r.tax||0;
    acc.net+=(r.net_pay!=null?r.net_pay:r.total_pay)||0;
    return acc;
  },{base:0,kpi:0,sales:0,commission:0,gross:0,insurance:0,tax:0,net:0});
  var tfoot='<tfoot><tr style="background:var(--bg-raised);font-weight:700">'
    +'<td style="padding:9px 10px;font-size:12px;color:var(--text-primary)">جمع کل</td>'
    +'<td></td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.base)+'</td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.kpi)+'</td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.sales)+'</td>'
    +'<td></td><td></td>'
    +'<td></td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.commission)+'</td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.gross)+'</td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.insurance)+'</td>'
    +'<td style="padding:9px 10px;font-size:12px;font-family:monospace;direction:ltr;text-align:left">'+_payrollFmt(totals.tax)+'</td>'
    +'<td style="padding:9px 10px;font-size:14px;font-family:monospace;direction:ltr;text-align:left;color:var(--brand)">'+_payrollFmt(totals.net)+'</td>'
    +'<td></td>'
    +'</tr></tfoot>';

  return settingsSummary
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    +thead+'<tbody>'+rows+'</tbody>'+tfoot+'</table></div>'
    +'<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="_payrollFinalizeAll()" style="background:#15803d;color:#fff;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:12px;font-family:inherit">🔒 نهایی کردن همه</button>'
    +'</div>';
}

function _payrollDraft(){
  if(!/^\d{4}\/\d{2}$/.test(_payrollMonth)){showToast('⚠ ماه را به فرمت ۱۴۰۳/۰۱ وارد کنید');return;}
  if(!confirm('ایجاد پیش‌نویس حقوق ماه '+_payrollMonth+' برای همه کارمندان؟'))return;
  fetch('/api/payroll/draft/'+encodeURIComponent(_payrollMonth),{method:'POST',headers:{'Content-Type':'application/json'}})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(d){showToast('📝 پیش‌نویس '+d.count+' نفر ذخیره شد');_payrollCalc();})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function _payrollFinalize(employee, month){
  if(!confirm('نهایی‌کردن حقوق «'+employee+'» برای ماه '+month+'؟\nپس از نهایی شدن تغییر داده نمی‌شود.'))return;
  fetch('/api/payroll/finalize/'+encodeURIComponent(employee)+'/'+encodeURIComponent(month),{method:'POST',headers:{'Content-Type':'application/json'}})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){showToast('✅ نهایی شد');_payrollCalc();})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function _payrollFinalizeAll(){
  if(!confirm('نهایی کردن حقوق همه کارمندان برای ماه '+_payrollMonth+'؟\nپس از نهایی شدن تغییر داده نمی‌شود.'))return;
  fetch('/api/payroll/finalize-all/'+encodeURIComponent(_payrollMonth),{method:'POST',headers:{'Content-Type':'application/json'}})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(d){showToast('✅ '+d.count+' نفر نهایی شد');_payrollCalc();})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

function openPayrollSettings(){
  fetch('/api/payroll/settings')
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||('خطای '+r.status));return d;});})
    .then(function(s){
      var body='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">نرخ پایه (٪)</label>'
        +'<input id="ps_base" type="number" step="0.1" min="0" max="100" value="'+esc(String(s.base_pct!=null?s.base_pct:1))+'" class="ed-inp" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">آستانه شروع پلکان (ریال)</label>'
        +'<input id="ps_threshold" type="number" step="100000000" value="'+esc(String(s.tier_threshold!=null?s.tier_threshold:2000000000))+'" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">مقدار هر پله (ریال)</label>'
        +'<input id="ps_step_amt" type="number" step="100000000" value="'+esc(String(s.tier_step_amount!=null?s.tier_step_amount:500000000))+'" class="ed-inp" dir="ltr" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">افزایش هر پله (٪)</label>'
        +'<input id="ps_step_pct" type="number" step="0.05" min="0" value="'+esc(String(s.tier_step_pct!=null?s.tier_step_pct:0.1))+'" class="ed-inp" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">آستانه KPI (از ۱۰۰)</label>'
        +'<input id="ps_kpi_thr" type="number" step="1" min="0" max="100" value="'+esc(String(s.kpi_threshold!=null?s.kpi_threshold:80))+'" class="ed-inp" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">ضریب پله برای KPI بالا (x)</label>'
        +'<input id="ps_kpi_mul" type="number" step="0.5" min="1" value="'+esc(String(s.kpi_multiplier!=null?s.kpi_multiplier:2))+'" class="ed-inp" style="width:100%;box-sizing:border-box"></div>'
        +'</div>'
        +'<div style="margin-top:12px;background:#fef9c3;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e">'
        +'مثال: فروش ۳.۵ میلیارد → نرخ = ۱٪ + ۳ پله × ۰.۱٪ = ۱.۳٪ پورسانت</div>';
      var m=openModal('payrollSettingsModal','⚙️ تنظیمات پورسانت',body,'',{lg:true});
      if(m&&m.foot){
        var cancelBtn=document.createElement('button');
        cancelBtn.type='button';
        cancelBtn.className='btn-secondary';
        cancelBtn.textContent='لغو';
        cancelBtn.addEventListener('click',function(){closeModal('payrollSettingsModal');});
        m.foot.appendChild(cancelBtn);
        var saveBtn=document.createElement('button');
        saveBtn.type='button';
        saveBtn.className='btn-primary';
        saveBtn.textContent='💾 ذخیره تنظیمات';
        saveBtn.addEventListener('click',function(){savePayrollSettings();});
        m.foot.appendChild(saveBtn);
      }
    })
    .catch(function(e){showToast('❌ '+(e.message||e));});
}

function savePayrollSettings(){
  var get=function(id){var el=document.getElementById(id);return el?parseFloat(el.value):null;};
  var payload={
    base_pct:get('ps_base'),
    tier_threshold:get('ps_threshold'),
    tier_step_amount:get('ps_step_amt'),
    tier_step_pct:get('ps_step_pct'),
    kpi_threshold:get('ps_kpi_thr'),
    kpi_multiplier:get('ps_kpi_mul')
  };
  for(var k in payload){if(payload[k]===null||isNaN(payload[k])){showToast('⚠ همه فیلدها را پر کنید');return;}}
  fetch('/api/payroll/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||r.status);return d;});})
    .then(function(){closeModal('payrollSettingsModal');showToast('✅ تنظیمات ذخیره شد');_payrollCalc();})
    .catch(function(e){showToast('❌ خطا: '+e.message);});
}

window.openPayrollPanel=openPayrollPanel;
window.openPayrollSettings=openPayrollSettings;
window.savePayrollSettings=savePayrollSettings;

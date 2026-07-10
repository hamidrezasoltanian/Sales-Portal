/* ═══ public/js/pricing.js ═══ */
// ══════════════════════ PRICING MODULE ══════════════════════════════════════
var _plInited=false;
var _plPayMode='d30',_plViewMode='both',_plActiveMethod='rate',_plPending=null;
var _plMgmtOk=false;

var PL_DEFAULT_PRODUCTS=[
 {id:1,name:'سوزن تمام اتوماتیک برند Geotek',commType:'geotek_full',
  channels:{hospital:56870000,faradis:56900000,daramazon:62040000,tamin:70210000,modd:64700000,noor:70210000,barakat:63189000,bahman:59864000,salajeghe:60890000,doctor:54060000},
  repPrices:{base:56900000,tiers:[[55200000,56900000,53500000],[53500000,56900000,51800000],[51800000,53500000,50100000],[50100000,51800000,48400000]]}},
 {id:2,name:'سوزن نیمه اتوماتیک برند Geotek + کواکسیال',commType:'geotek_semi',
  channels:{hospital:38296000,faradis:38300000,daramazon:41777000,tamin:47279000,modd:43600000,noor:47279000,barakat:42552000,bahman:40312000,salajeghe:40990000,doctor:36390000},
  repPrices:{base:38300000,tiers:[[37200000,38300000,36100000],[36100000,38300000,34900000],[34900000,36100000,33800000],[33800000,34900000,32600000]]}},
 {id:3,name:'سوزن گان برند Geotek',commType:'geotek_gun',
  channels:{hospital:23574000,faradis:23600000,daramazon:25717000,tamin:29104000,modd:26800000,noor:29104000,barakat:26194000,bahman:24815000,salajeghe:25260000,doctor:22420000},
  repPrices:{base:23600000,tiers:[[22900000,23600000,22200000],[22200000,23600000,21500000],[21500000,22200000,20800000],[20800000,21500000,20100000]]}},
 {id:4,name:'سوزن شیبا برند Geotek',commType:'geotek_shiba',
  channels:{hospital:17743000,faradis:17800000,daramazon:19356000,tamin:21905000,modd:20200000,noor:21905000,barakat:19715000,bahman:18677000,salajeghe:19050000,doctor:16910000},
  repPrices:{base:17800000,tiers:[[17300000,17800000,16800000],[16800000,17800000,16200000],[16200000,16800000,15700000],[15700000,16200000,15200000]]}},
 {id:5,name:'سوزن مغز استخوان برند Geotek',commType:'geotek_bone',
  channels:{hospital:35085000,faradis:35100000,daramazon:38275000,tamin:43315000,modd:39900000,noor:43315000,barakat:38984000,bahman:36932000,salajeghe:37560000,doctor:33350000},
  repPrices:{base:35100000,tiers:[[34100000,35100000,33000000],[33000000,35100000,32000000],[32000000,33000000,30900000],[30900000,32000000,29900000]]}},
 {id:6,name:'سوزن تمام اتوماتیک برند Geotek مدل Pro',commType:'geotek_full',
  channels:{hospital:77971000,faradis:78000000,daramazon:85059000,tamin:96260000,modd:88700000,noor:96260000,barakat:86635000,bahman:82075000,salajeghe:83460000,doctor:74100000},
  repPrices:{base:78000000,tiers:[[75700000,78000000,73400000],[73400000,78000000,71000000],[71000000,73400000,68700000],[68700000,71000000,66300000]]}},
 {id:7,name:'سوزن تمام اتوماتیک برند Curaway',commType:'curaway',
  channels:{hospital:51000000,faradis:51000000,daramazon:null,tamin:62963000,modd:66667000,noor:null,barakat:56667000,bahman:null,salajeghe:null,doctor:48450000},
  repPrices:{base:51000000,tiers:[[49500000,51000000,48000000],[48000000,51000000,46500000],[46500000,48000000,44900000],[44900000,46500000,43400000]]}},
 {id:8,name:'سوزن نیمه اتوماتیک برند Curaway',commType:'curaway',
  channels:{hospital:31100000,faradis:31100000,daramazon:null,tamin:38396000,modd:40654000,noor:null,barakat:34556000,bahman:null,salajeghe:null,doctor:29550000},
  repPrices:{base:31100000,tiers:[[30200000,31100000,29300000],[29300000,31100000,28400000],[28400000,29300000,27400000],[27400000,28400000,26500000]]}},
 {id:9,name:'سوزن کواکسیال برند Curaway',commType:'curaway',
  channels:{hospital:8510000,faradis:8510000,daramazon:null,tamin:10507000,modd:11125000,noor:null,barakat:9456000,bahman:null,salajeghe:null,doctor:8090000},
  repPrices:{base:8510000,tiers:[[8300000,8510000,8000000],[8000000,8510000,7800000],[7800000,8000000,7500000],[7500000,7800000,7300000]]}},
 {id:10,name:'کاتتر آرتر لاین Intra 4fr×18g×11cm',commType:'intra',
  channels:{hospital:50500000,faradis:50500000,daramazon:null,tamin:62346000,modd:66014000,noor:null,barakat:56112000,bahman:null,salajeghe:null,doctor:47980000},
  repPrices:{base:50500000,tiers:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]]}},
 {id:11,name:'کاتتر آرتر لاین Intra 3fr×20g×8cm',commType:'intra',
  channels:{hospital:50500000,faradis:50500000,daramazon:null,tamin:62346000,modd:66014000,noor:null,barakat:56112000,bahman:null,salajeghe:null,doctor:47980000},
  repPrices:{base:50500000,tiers:[[49000000,50500000,47500000],[47500000,50500000,46000000],[46000000,47500000,44500000],[44500000,46000000,43000000]]}},
 {id:12,name:'کاتتر آرتر لاین Intra 2fr×22g×6cm',commType:'intra',
  channels:{hospital:56400000,faradis:56400000,daramazon:null,tamin:69630000,modd:73726000,noor:null,barakat:62667000,bahman:null,salajeghe:null,doctor:53580000},
  repPrices:{base:56400000,tiers:[[54800000,56400000,53100000],[53100000,56400000,51400000],[51400000,53100000,49700000],[49700000,51400000,48000000]]}},
 {id:13,name:'رابط یورین بگ آتنا',commType:'intra',
  channels:{hospital:4450000,faradis:4450000,daramazon:null,tamin:5494000,modd:5817000,noor:null,barakat:4945000,bahman:null,salajeghe:null,doctor:4230000},
  repPrices:{base:4450000,tiers:[[4400000,4450000,4200000],[4200000,4450000,4100000],[4100000,4200000,4000000],[4000000,4100000,3800000]]}},
 {id:14,name:'ست نفروستومی PCN با مکانیزم قفل (سینگل نخدار)',commType:'neph_single',
  channels:{hospital:128900000,faradis:131400000,daramazon:null,tamin:162223000,modd:171765000,noor:162223000,barakat:146000000,bahman:null,salajeghe:null,doctor:124830000},
  repPrices:{base:131400000,tiers:[[127600000,131400000,123600000],[123400000,127100000,119600000],[119400000,123000000,115700000],[115300000,118700000,111700000]]}},
 {id:15,name:'ست نفروستومی PIGTAIL سینگل (Direct Puncture)',commType:'neph_single',
  channels:{hospital:117200000,faradis:119800000,daramazon:null,tamin:147902000,modd:156602000,noor:147902000,barakat:133112000,bahman:null,salajeghe:null,doctor:113810000},
  repPrices:{base:119800000,tiers:[[116100000,119800000,112700000],[112600000,116000000,109100000],[108900000,112100000,105500000],[105200000,108300000,101900000]]}},
 {id:16,name:'ست نفروستومی PIGTAIL با مکانیزم قفل (فول)',commType:'neph_full',
  channels:{hospital:234400000,faradis:236900000,daramazon:null,tamin:292470000,modd:309674000,noor:292470000,barakat:263223000,bahman:null,salajeghe:null,doctor:225060000},
  repPrices:{base:236900000,tiers:[[229800000,236900000,222700000],[222400000,229200000,215600000],[215200000,221900000,208500000],[207900000,214300000,201400000]]}}
];
var PL_DEFAULT_COMM={
  geotek_full:{p10:7021000,p7:4914700,p5:3510500,p4:null,p3:null,p2:null,mohakem:3600000,ghanbari:2000000,salajeghe_c:null},
  geotek_semi:{p10:4727900,p7:3309530,p5:2363950,p4:null,p3:null,p2:null,mohakem:2500000,ghanbari:1500000,salajeghe_c:null},
  geotek_gun: {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  geotek_shiba:{p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  geotek_bone:{p10:4331500,p7:3032050,p5:2165750,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  curaway:    {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  intra:      {p10:null,p7:null,p5:null,p4:null,p3:null,p2:null,mohakem:null,ghanbari:null,salajeghe_c:null},
  neph_single:{p10:16222300,p7:11355610,p5:8111150,p4:null,p3:null,p2:null,mohakem:7200000,ghanbari:null,salajeghe_c:null},
  neph_full:  {p10:29247000,p7:20472900,p5:14623500,p4:null,p3:null,p2:null,mohakem:10800000,ghanbari:null,salajeghe_c:null}
};
var PL_DEFAULT_SETT={
  tiers:[{label:'تا ۲۰ عدد',max:20},{label:'۲۱-۵۰ عدد',max:50},{label:'۵۱-۱۰۰ عدد',max:100},{label:'بیش از ۱۰۰',max:999999}],
  commLabels:{p10:'۱۰٪',p7:'۷٪',p5:'۵٪',p4:'۴٪',p3:'۳٪',p2:'۲٪',mohakem:'محکم‌کار',ghanbari:'قنبری',salajeghe_c:'سلاجقه'},
  commNames:{geotek_full:'تمام ژئوتک',geotek_semi:'نیمه ژئوتک',geotek_gun:'گان ژئوتک',geotek_shiba:'شیبا ژئوتک',geotek_bone:'مغز استخوان',curaway:'Curaway',intra:'Intra / آتنا',neph_single:'نفروستومی سینگل',neph_full:'نفروستومی فول'},
  centers:{hospital:'بیمارستان',faradis:'فرادیس',daramazon:'درمازون',tamin:'تامین / نور / هاشمی',modd:'مدد',noor:'نور / هاشمی',barakat:'برکت / فیاض / آتیه / غیاثی',bahman:'بهمن',salajeghe:'سلاجقه',doctor:'پزشک / مرکز درمانی'},
  payLabels:{d30:'۳۰ روزه',d60:'۶۰ روزه',cash:'نقدی'}
};
var PL_CENTER_ICONS={hospital:'🏥',faradis:'🏪',daramazon:'🛒',tamin:'🏛',modd:'🏦',noor:'💙',barakat:'🌟',bahman:'🏢',salajeghe:'🏢',doctor:'👨‍⚕️'};
var PL_PAY_IDX={d30:0,d60:1,cash:2};

var _plP,_plCOMM,_plSETT,_plCOMMLabels,_plCOMMNames,_plCENTERS,_plPAYLBL,_plTIERS;
var _plRepQty=[],_plExpQty=[];

function plLoadData(){
  _plSETT=(DB.pricingSettings&&DB.pricingSettings.tiers)?DB.pricingSettings:JSON.parse(JSON.stringify(PL_DEFAULT_SETT));
  _plP=(DB.pricingProducts&&DB.pricingProducts.length)?DB.pricingProducts.map(function(p){return JSON.parse(JSON.stringify(p));}):PL_DEFAULT_PRODUCTS.map(function(p){return JSON.parse(JSON.stringify(p));});
  _plCOMM=(DB.pricingComm&&Object.keys(DB.pricingComm).length)?DB.pricingComm:JSON.parse(JSON.stringify(PL_DEFAULT_COMM));
  plApplySett();
  _plRepQty=_plP.map(function(){return 0;});
  _plExpQty=_plP.map(function(){return 0;});
}
function plApplySett(){
  var s=_plSETT;
  _plCOMMLabels=Object.assign({},s.commLabels);
  _plCOMMNames=Object.assign({},s.commNames);
  _plCENTERS=Object.assign({},s.centers);
  _plPAYLBL=Object.assign({},s.payLabels);
  _plTIERS=s.tiers.map(function(t,i){return{label:t.label,max:t.max,cls:['','t2','t3','t4'][i]||'t4'};});
}
function plSaveAll(){
  DB.pricingProducts=_plP;
  DB.pricingComm=_plCOMM;
  DB.pricingSettings=_plSETT;
  saveDB();
}
function plFmt(n){return n>0?n.toLocaleString():'—';}
function plPct(b,p){var d=(b-p)/b*100;return d>0.01?d.toFixed(1)+'%':null;}
function plToFa(n){return String(n).replace(/\d/g,function(d){return'۰۱۲۳۴۵۶۷۸۹'[d];});}
function plRound(n){return Math.round(n/1000)*1000;}
function plTierOf(q){for(var i=0;i<_plTIERS.length-1;i++)if(q<=_plTIERS[i].max)return i;return _plTIERS.length-1;}
function plMarginPct(buy,sell){return sell>0?((sell-buy)/sell*100).toFixed(1)+'%':'—';}
function plMarginCls(buy,sell){var m=(sell-buy)/sell*100;return m>=35?'pl-mhi':m>=25?'pl-mmid':'pl-mlo';}
function plReAnim(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}

function pricingLazyInit(){
  if(_plInited)return;
  _plInited=true;
  plLoadData();
  _plP.forEach(function(p){if(p.buyPrice==null)p.buyPrice=0;});
  plInitMgmtAccess();
  plRenderRep();
  document.getElementById('pl-upd-date').textContent='آخرین آپدیت: '+new Date().toLocaleDateString('fa-IR');
}

function plSwitchTab(t){
  ['rep','expert','mgmt'].forEach(function(k){
    var p=document.getElementById('pl-'+k);if(p)p.style.display=(k===t)?'':'none';
    var b=document.getElementById('pl-t-'+k);if(b)b.classList.toggle('on',k===t);
  });
  if(t==='expert')plRenderExpert();
  if(t==='mgmt'){
    if(_plMgmtOk){plRenderOverview();plRenderBuyInputs();plRenderSett();}
  }
}
function plCheckPw(){
  var inp=document.getElementById('pl-pw-inp');
  if(!inp)return;
  fetch('/api/pricing/mgmt/verify',{
    method:'POST',credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:inp.value})
  }).then(function(r){return r.json().then(function(j){return {ok:r.ok,body:j};});})
  .then(function(res){
    if(res.ok){
      _plMgmtOk=true;
      document.getElementById('pl-mgmt-lock').style.display='none';
      document.getElementById('pl-mgmt-panel').style.display='';
      document.getElementById('pl-pw-err').style.display='none';
      inp.value='';
      plLoadCostsFromServer().then(function(){
        plRenderOverview();plRenderBuyInputs();plRenderSett();
        var exp=document.getElementById('pl-expert');
        if(exp&&exp.style.display!=='none')plRenderExpert();
      });
    } else {
      document.getElementById('pl-pw-err').style.display='block';
      inp.value='';inp.focus();
    }
  }).catch(function(){showToast('⚠ خطا در ارتباط با سرور');});
}
function plLoadCostsFromServer(){
  return fetch('/api/pricing/costs',{credentials:'include'})
    .then(function(r){if(!r.ok)return null;return r.json();})
    .then(function(costs){
      if(!costs||!_plP)return;
      _plP.forEach(function(p){
        var c=costs[String(p.id)];
        p.buyPrice=(c!=null)?Number(c):0;
      });
    }).catch(function(){});
}
function plInitMgmtAccess(){
  fetch('/api/pricing/mgmt/status',{credentials:'include'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(st){
      if(st&&st.unlocked){
        _plMgmtOk=true;
        var lock=document.getElementById('pl-mgmt-lock');
        var panel=document.getElementById('pl-mgmt-panel');
        if(lock)lock.style.display='none';
        if(panel)panel.style.display='';
        plLoadCostsFromServer();
      }
    }).catch(function(){});
}
function plLockMgmt(){
  _plMgmtOk=false;
  document.getElementById('pl-mgmt-lock').style.display='';
  document.getElementById('pl-mgmt-panel').style.display='none';
  var inp=document.getElementById('pl-pw-inp');if(inp)inp.value='';
  plSwitchTab('rep');
  var exp=document.getElementById('pl-expert');
  if(exp&&exp.style.display!=='none')plRenderExpert();
}

function plSwitchMtab(t){
  ['overview','update','comm','sett'].forEach(function(k){
    var p=document.getElementById('pl-m-'+k);if(p)p.style.display=(k===t)?'':'none';
    var b=document.getElementById('pl-mt-'+k);if(b)b.classList.toggle('on',k===t);
  });
  if(t==='overview')plRenderOverview();
  if(t==='comm')plRenderCommEdit();
  if(t==='sett')plRenderSett();
}

// ── REP VIEW ──────────────────────────────────────────────────────────────────
function plRenderRep(){
  _plRefreshBadges();
  var pi=PL_PAY_IDX[_plPayMode],showU=_plViewMode!=='total',showT=_plViewMode!=='unit';
  var thU=document.getElementById('pl-th-unit'),thT=document.getElementById('pl-th-total');
  if(thU)thU.style.display=showU?'':'none';
  if(thT)thT.style.display=showT?'':'none';
  var tbody=document.getElementById('pl-rep-tbody');
  if(!tbody)return;
  tbody.innerHTML=_plP.map(function(prod,i){
    var q=_plRepQty[i]||0,ti=plTierOf(q),t=_plTIERS[ti];
    var up=prod.repPrices.tiers[ti][pi],tp=q>0?up*q:0,dc=plPct(prod.repPrices.base,up);
    var _catFiles=(_plCatBadge&&_plCatBadge[i])||0;
    return '<tr data-tier="'+ti+'">'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname" style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
      +esc(prod.name)
      +'<button onclick="openProductCatalogModal('+i+')" title="فایل\u2019های کاتالوگ" style="flex-shrink:0;padding:2px 7px;border-radius:5px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:10px;font-family:inherit;white-space:nowrap">'
      +'<span data-plbadge="'+i+'" style="background:#ede9fe;color:#6d28d9;border-radius:9px;padding:1px 4px;font-size:9px;font-weight:700;margin-left:2px;display:'+(_plCatBadge[i]?'inline':'none')+'">'+((_plCatBadge&&_plCatBadge[i])?_plCatBadge[i]:'')+'</span>'
      +'📎</button></td>'
      +'<td class="tc"><input class="pl-qty" type="number" min="0" value="'+(q||'')+'" placeholder="0" oninput="plSetRepQty('+i+',this.value)"></td>'
      +'<td><span class="pl-tbadge">'+esc(t.label)+'</span></td>'
      +'<td class="tr pl-price-u" '+(showU?'':'style="display:none"')+'>'+plFmt(up)+'</td>'
      +'<td class="tr pl-price-t" '+(showT?'':'style="display:none"')+'>'+( tp>0?plFmt(tp):'—')+'</td>'
      +'<td class="tc">'+(dc?'<span class="pl-disc-badge pl-disc-appear">−'+dc+'</span>':'<span style="color:var(--text-muted)">—</span>')+'</td>'
      +'</tr>';
  }).join('');
  plRenderRepSummary(false);
}
function plRenderRepSummary(anim){
  var pi=PL_PAY_IDX[_plPayMode],items=0,tq=0,tv=0;
  _plP.forEach(function(p,i){if(_plRepQty[i]>0){items++;tq+=_plRepQty[i];tv+=p.repPrices.tiers[plTierOf(_plRepQty[i])][pi]*_plRepQty[i];}});
  var sT=document.getElementById('pl-s-total');if(!sT)return;
  var prev=sT.textContent;
  document.getElementById('pl-s-items').textContent=plToFa(items);
  document.getElementById('pl-s-qty').textContent=plToFa(tq);
  sT.textContent=tv>0?plFmt(tv):'—';
  document.getElementById('pl-s-pay').textContent=_plPAYLBL[_plPayMode];
  document.getElementById('pl-rep-chip').textContent=items>0?(plToFa(items)+' قلم — جمع: '+plFmt(tv)+' ریال'):'تعداد سفارش را وارد کنید';
  if(anim&&sT.textContent!==prev)plReAnim(sT,'pl-sum-pulse');
}
function plSetRepQty(i,v){
  var nq=Math.max(0,parseInt(v)||0);_plRepQty[i]=nq;
  var pi=PL_PAY_IDX[_plPayMode],ti=plTierOf(nq),t=_plTIERS[ti];
  var up=_plP[i].repPrices.tiers[ti][pi],tp=nq>0?up*nq:0;
  var dc=plPct(_plP[i].repPrices.base,up);
  var rows=document.getElementById('pl-rep-tbody');if(!rows)return;
  var row=rows.rows[i];if(!row)return;
  row.dataset.tier=ti;
  row.cells[3].innerHTML='<span class="pl-tbadge">'+esc(t.label)+'</span>';
  row.cells[4].textContent=plFmt(up);row.cells[5].textContent=tp>0?plFmt(tp):'—';
  row.cells[6].innerHTML=dc?'<span class="pl-disc-badge pl-disc-appear">−'+dc+'</span>':'<span style="color:var(--text-muted)">—</span>';
  plReAnim(row,'pl-row-glow');plRenderRepSummary(true);
}
function plSetPay(m){
  _plPayMode=m;
  var btns=document.getElementById('pl-pay-btns');
  if(btns)Array.from(btns.children).forEach(function(b,i){b.classList.toggle('on',['d30','d60','cash'][i]===m);});
  plRenderRep();
}
function plSetView(m){
  _plViewMode=m;
  var btns=document.getElementById('pl-view-btns');
  if(btns)Array.from(btns.children).forEach(function(b,i){b.classList.toggle('on',['unit','both','total'][i]===m);});
  plRenderRep();
}
function plClearAll(){_plRepQty=_plP.map(function(){return 0;});plRenderRep();}

// ── PRODUCT CATALOG (FILE ATTACHMENTS PER PRODUCT) ────────────────────────────
var _plCatBadge = {}; // {displayIdx: count}

function _plRefreshBadges(){
  _plCatBadge={};
  if(!_plP||!_plP.length)return;
  _plP.forEach(function(prod,i){
    if(!prod||!prod.id)return;
    fetch('/api/files/list/'+prod.id,{credentials:'include'})
      .then(function(r){return r.ok?r.json():{files:[]};})
      .then(function(d){
        var n=(d.files||[]).length;
        _plCatBadge[i]=n;
        var b=document.querySelector('[data-plbadge="'+i+'"]');
        if(b){b.textContent=n>0?n:'';b.style.display=n>0?'inline':'none';}
      }).catch(function(){});
  });
}

function _plFmtSize(bytes){
  if(!bytes)return'';
  return bytes>1048576?(bytes/1048576).toFixed(1)+' MB':(bytes/1024).toFixed(0)+' KB';
}

function _plFileIcon(mime){
  if(!mime)return'📄';
  if(mime.startsWith('image/'))return'🖼';
  if(mime==='application/pdf')return'📕';
  if(mime.includes('word')||mime.includes('document'))return'📝';
  if(mime.includes('excel')||mime.includes('spreadsheet'))return'📊';
  return'📄';
}

function _plBuildFileRow(f, prodId, isPreview){
  var icon=_plFileIcon(f.mime_type);
  var sz=_plFmtSize(f.file_size);
  var url='/api/files/'+f.id;
  var previewHtml='';
  if(isPreview){
    if(f.mime_type&&f.mime_type.startsWith('image/')){
      previewHtml='<div style="margin:8px 0;text-align:center"><img src="'+url+'" style="max-width:100%;max-height:180px;border-radius:6px;border:1px solid var(--border)" onerror="this.style.display=\'none\'"></div>';
    } else if(f.mime_type==='application/pdf'){
      previewHtml='<div style="margin:8px 0"><iframe src="'+url+'" style="width:100%;height:220px;border:1px solid var(--border);border-radius:6px"></iframe></div>';
    }
  }
  return '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--bg-card);overflow:hidden">'
    +(previewHtml?previewHtml:'')
    +'<div style="display:flex;align-items:center;gap:8px;padding:8px 10px">'
    +'<span style="font-size:18px;flex-shrink:0">'+icon+'</span>'
    +'<div style="flex:1;overflow:hidden;min-width:0">'
    +'<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" dir="ltr">'+esc(f.filename)+'</div>'
    +(sz?'<div style="font-size:10px;color:var(--text-muted)">'+sz+'</div>':'')
    +'</div>'
    +'<a href="'+url+'" target="_blank" style="padding:3px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;cursor:pointer;font-size:10px;text-decoration:none;white-space:nowrap">👁 مشاهده</a>'
    +'<a href="'+url+'?dl=1" download="'+esc(f.filename)+'" style="padding:3px 8px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:5px;cursor:pointer;font-size:10px;text-decoration:none">⬇</a>'
    +'<button onclick="plCatShr('+f.id+',\''+esc(f.filename)+'\')" style="padding:3px 8px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">📤</button>'
    +'<button onclick="plCatDel('+f.id+','+prodId+')" style="padding:3px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;font-size:10px;font-family:inherit">✕</button>'
    +'</div></div>';
}

function openProductCatalogModal(prodIdx){
  var prod=_plP[prodIdx];if(!prod||!prod.id){showToast('محصول یافت نشد');return;}
  var prodId=prod.id;
  var body='<div style="font-size:12px">'
    +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">فایل‌های کاتالوگ: <strong>'+esc(prod.name)+'</strong></div>'
    +'<div id="plCatList" style="min-height:40px"><div style="text-align:center;padding:20px;color:var(--text-muted)">در حال بارگذاری...</div></div>'
    +'<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
    +'<label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px;border:2px dashed var(--border);border-radius:8px;cursor:pointer;background:var(--bg-raised)">'
    +'<span style="font-size:26px">☁️</span>'
    +'<span style="font-weight:700;color:var(--text-primary);font-size:12px">افزودن فایل جدید</span>'
    +'<span style="font-size:10px;color:var(--text-muted)">PDF، تصویر، Word و سایر فرمت‌ها — حداکثر ۲۰ مگابایت</span>'
    +'<input id="plCatUpInp" type="file" multiple style="display:none" onchange="plCatUpload('+prodIdx+','+prodId+',this)">'
    +'</label></div></div>';
  openModal('plCatModal','📎 فایل‌های کاتالوگ — '+esc(prod.name),body,'<button class="btn-secondary" onclick="closeModal(\'plCatModal\')">بستن</button>',{lg:true});
  _plCatLoadList(prodIdx, prodId);
}

function _plCatLoadList(prodIdx, prodId){
  fetch('/api/files/list/'+prodId,{credentials:'include'})
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(d){
      var el=document.getElementById('plCatList');
      if(!el)return;
      var files=d.files||[];
      if(!files.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">هیچ فایلی پیوست نشده<br><span style="font-size:10px">PDF، تصویر و سایر فرمت‌ها پشتیبانی می‌شوند</span></div>';return;}
      el.innerHTML=files.map(function(f){return _plBuildFileRow(f,prodId,true);}).join('');
    })
    .catch(function(e){
      var el=document.getElementById('plCatList');
      if(el)el.innerHTML='<div style="color:#dc2626;padding:10px;font-size:11px">خطا در بارگذاری فایل‌ها</div>';
    });
}

function plCatUpload(prodIdx, prodId, input){
  var files=Array.from(input.files||[]);
  if(!files.length)return;
  var fd=new FormData();
  files.forEach(function(f){fd.append('files',f);});
  var el=document.getElementById('plCatList');
  if(el){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">در حال آپلود...</div>';}
  fetch('/api/files/upload/'+prodId,{method:'POST',body:fd,credentials:'include'})
    .then(function(r){return r.ok?r.json():r.json().then(function(d){return Promise.reject(d.error||'خطا');});})
    .then(function(d){
      showToast('✅ '+( d.files?d.files.length:0)+' فایل آپلود شد');
      _plCatLoadList(prodIdx,prodId);
      _plCatBadge[prodIdx]=((_plCatBadge[prodIdx]||0))+(d.files?d.files.length:0);
      var b=document.querySelector('[data-plbadge="'+prodIdx+'"]');
      if(b){b.textContent=_plCatBadge[prodIdx];b.style.display='inline';}
    })
    .catch(function(e){showToast('⚠ آپلود ناموفق: '+e);_plCatLoadList(prodIdx,prodId);});
  input.value='';
}

function plCatShr(fileId, filename){
  var url=window.location.origin+'/api/files/'+fileId;
  if(navigator.share){
    navigator.share({title:filename,url:url}).catch(function(){});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(function(){showToast('📋 لینک کپی شد');});
  } else {
    window.open(url,'_blank');
  }
}

function plCatDel(fileId, prodId){
  var pw=prompt('🔒 برای حذف، رمز مدیریتی را وارد کنید:');
  if(pw===null)return;
  fetch('/api/pricing/mgmt/verify-delete',{
    method:'POST',credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:pw})
  }).then(function(r){return r.json().then(function(j){return {ok:r.ok,body:j};});})
  .then(function(res){
    if(!res.ok){showToast('⛔ '+(res.body.error||'رمز اشتباه است'));return;}
    return fetch('/api/files/'+fileId,{method:'DELETE',credentials:'include'})
      .then(function(r){return r.ok?r.json():Promise.reject('خطا');})
      .then(function(){
        showToast('🗑 فایل حذف شد');
        var prodIdx=_plP.findIndex(function(p){return p&&p.id===prodId;});
        if(_plCatBadge[prodIdx]>0)_plCatBadge[prodIdx]--;
        var b=document.querySelector('[data-plbadge="'+prodIdx+'"]');
        if(b){
          var n=_plCatBadge[prodIdx]||0;
          b.textContent=n>0?n:'';b.style.display=n>0?'inline':'none';
        }
        _plCatLoadList(prodIdx, prodId);
      });
  })
  .catch(function(){showToast('⚠ خطا در حذف فایل');});
}

// ── EXPERT VIEW ───────────────────────────────────────────────────────────────
function plRenderExpert(){
  var cs=document.getElementById('pl-center-sel');if(!cs)return;
  var cv=cs.value;
  cs.innerHTML=Object.keys(_plCENTERS).map(function(k){return'<option value="'+k+'">'+(PL_CENTER_ICONS[k]||'')+' '+esc(_plCENTERS[k])+'</option>';}).join('');
  if(cv&&_plCENTERS[cv])cs.value=cv;
  var ts=document.getElementById('pl-comm-type-sel');if(ts){
    var tv=ts.value;
    ts.innerHTML=Object.keys(_plCOMMLabels).map(function(k){return'<option value="'+k+'">'+esc(_plCOMMLabels[k])+'</option>';}).join('');
    if(tv&&_plCOMMLabels[tv])ts.value=tv;
  }
  var center=cs.value||Object.keys(_plCENTERS)[0];
  var useComm=(document.getElementById('pl-comm-toggle')||{}).checked;
  var commKey=(document.getElementById('pl-comm-type-sel')||{}).value||Object.keys(_plCOMMLabels)[0];
  var lbl=document.getElementById('pl-comm-toggle-lbl');if(lbl)lbl.textContent=useComm?'بله':'خیر';
  var grp=document.getElementById('pl-comm-type-grp');if(grp)grp.style.display=useComm?'':'none';
  var thComm=document.getElementById('pl-th-comm');if(thComm)thComm.style.display=useComm?'':'none';
  var showMargin=_plMgmtOk;
  var thMarg=document.getElementById('pl-th-margin');if(thMarg)thMarg.style.display=showMargin?'':'none';
  var eMarginW=document.getElementById('pl-e-margin-wrap');if(eMarginW)eMarginW.style.display=showMargin?'':'none';
  var ePctW=document.getElementById('pl-e-pct-wrap');if(ePctW)ePctW.style.display=showMargin?'':'none';
  var chip=document.getElementById('pl-expert-chip');if(chip)chip.textContent=_plCENTERS[center]||center;
  var title=document.getElementById('pl-expert-title');if(title)title.textContent='قیمت‌های پیشنهادی — '+(_plCENTERS[center]||center);
  var totSell=0,totComm=0,totBuy=0;
  var tbody=document.getElementById('pl-expert-tbody');if(!tbody)return;
  tbody.innerHTML=_plP.map(function(prod,i){
    var price=prod.channels[center];
    var comm=useComm&&_plCOMM[prod.commType]?(_plCOMM[prod.commType][commKey]||0):0;
    var q=_plExpQty[i]||0;
    var totalSell=q>0&&price?price*q:0;
    var totalComm=q>0?comm*q:0;
    var netMargin=price?(price-prod.buyPrice-comm):0;
    var marginP=price?((netMargin/price)*100).toFixed(1)+'%':'—';
    var mCls=price&&netMargin>0?plMarginCls(prod.buyPrice+comm,price):'pl-mlo';
    if(q>0&&price){totSell+=price*q;totComm+=comm*q;totBuy+=prod.buyPrice*q;}
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname" style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
      +esc(prod.name)
      +'<button onclick="openProductCatalogModal('+i+')" title="فایل\u2019های کاتالوگ" style="flex-shrink:0;padding:2px 7px;border-radius:5px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:10px;font-family:inherit;white-space:nowrap">'
      +'<span data-plbadge="'+i+'" style="background:#ede9fe;color:#6d28d9;border-radius:9px;padding:1px 4px;font-size:9px;font-weight:700;margin-left:2px;display:'+(_plCatBadge[i]?'inline':'none')+'">'+((_plCatBadge&&_plCatBadge[i])?_plCatBadge[i]:'')+'</span>'
      +'📎</button></td>'
      +'<td class="tc"><input class="pl-qty" type="number" min="0" value="'+(q||'')+'" placeholder="0" oninput="plSetExpQty('+i+',this.value)"></td>'
      +'<td class="tr" style="font-weight:700;color:var(--text-primary)">'+(price?plFmt(price):'<span style="color:var(--text-muted)">موجود نیست</span>')+'</td>'
      +(useComm?'<td class="tr">'+(comm>0?'<span class="pl-comm-badge pl-comm-green">'+plFmt(comm)+'</span>':'<span class="pl-comm-badge pl-comm-na">—</span>')+'</td>':'')
      +(showMargin?'<td class="tc"><span class="pl-margin-chip '+mCls+'">'+(price?marginP:'—')+'</span></td>':'')
      +'<td class="tr pl-price-t">'+(totalSell>0?plFmt(totalSell):'—')+'</td>'
      +'</tr>';
  }).join('');
  var eSell=document.getElementById('pl-e-sell');if(eSell)eSell.textContent=totSell>0?plFmt(totSell):'—';
  var eComm=document.getElementById('pl-e-comm');if(eComm)eComm.textContent=totComm>0?plFmt(totComm):'—';
  var netC=totSell-totBuy-totComm;
  var eMarg=document.getElementById('pl-e-margin');if(eMarg)eMarg.textContent=netC>0?plFmt(netC):'—';
  var ePct=document.getElementById('pl-e-pct');if(ePct)ePct.textContent=totSell>0?(netC/totSell*100).toFixed(1)+'٪':'—';
}
function plSetExpQty(i,v){_plExpQty[i]=Math.max(0,parseInt(v)||0);plRenderExpert();}

// ── MANAGEMENT ────────────────────────────────────────────────────────────────
function _plCellEdit(i,field,isNum){
  var id='plcell-'+i+'-'+field;
  var sz=isNum===false?'wide':'';
  return '<td id="'+id+'" class="pl-cell-edit tc" onclick="plEditCell('+i+',\''+field+'\','+(!isNum)+')">'+
    (field==='buyPrice'?'<span style="color:#f59e0b;font-weight:700">'+plFmt(_plP[i].buyPrice)+'</span>':
     field==='name'?'<span class="pl-pname" style="font-size:12px">'+esc(_plP[i].name)+'</span>':
     (_plP[i].channels[field]?plFmt(_plP[i].channels[field]):'<span style="color:var(--text-muted)">—</span>'))+'</td>';
}
function plRenderOverview(){
  var tbody=document.getElementById('pl-overview-tbody');if(!tbody)return;
  var CHANS=['hospital','faradis','daramazon','tamin','modd','noor','barakat','bahman','salajeghe','doctor'];
  tbody.innerHTML=_plP.map(function(p,i){
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +_plCellEdit(i,'name',false)
      +_plCellEdit(i,'buyPrice',true)
      +_plCellEdit(i,'hospital',true)
      +'<td class="tc"><span class="pl-margin-chip '+plMarginCls(p.buyPrice,p.channels.hospital)+'">'+plMarginPct(p.buyPrice,p.channels.hospital)+'</span></td>'
      +_plCellEdit(i,'faradis',true)
      +_plCellEdit(i,'daramazon',true)
      +_plCellEdit(i,'tamin',true)
      +_plCellEdit(i,'modd',true)
      +_plCellEdit(i,'noor',true)
      +_plCellEdit(i,'barakat',true)
      +_plCellEdit(i,'bahman',true)
      +_plCellEdit(i,'salajeghe',true)
      +_plCellEdit(i,'doctor',true)
      +'</tr>';
  }).join('');
}
function plEditCell(prodIdx,field,isText){
  var id='plcell-'+prodIdx+'-'+field;
  var td=document.getElementById(id);if(!td)return;
  var cur=field==='name'?_plP[prodIdx].name:(field==='buyPrice'?_plP[prodIdx].buyPrice:(_plP[prodIdx].channels[field]||''));
  var inp='<input class="pl-cell-inp'+(isText?' wide':'')+'" type="'+(isText?'text':'number')+'" value="'+esc(String(cur))+'" min="0" '
    +'onblur="plSaveCell('+prodIdx+',\''+field+'\',this.value)" '
    +'onkeydown="if(event.key===\'Enter\')this.blur();if(event.key===\'Escape\'){event.preventDefault();plRenderOverview();}">';
  td.innerHTML=inp;
  var el=td.querySelector('input');if(el){el.focus();el.select();}
}
function plSaveCell(prodIdx,field,val){
  var p=_plP[prodIdx];
  if(field==='name'){
    var nm=val.trim();if(!nm)return plRenderOverview();
    p.name=nm;
  } else {
    var n=Math.round(parseFloat(val));
    if(isNaN(n)||n<0)return plRenderOverview();
    if(field==='buyPrice')p.buyPrice=n;
    else p.channels[field]=(n||null);
  }
  plSaveAll();plRenderOverview();plRenderRep();
  showToast('✅ ذخیره شد',1200);
}
function plRenderBuyInputs(){
  var grid=document.getElementById('pl-buy-grid');if(!grid)return;
  grid.innerHTML=_plP.map(function(p,i){
    return '<div class="pl-inp-row">'
      +'<span class="pl-inp-lbl">'+(p.name.length>28?p.name.substring(0,28)+'…':p.name)+'</span>'
      +'<input class="pl-num-inp" type="number" id="pl-buy-inp-'+i+'" placeholder="'+p.buyPrice.toLocaleString()+'" min="0">'
      +'</div>';
  }).join('');
}
function plSelMethod(m){
  _plActiveMethod=m;
  ['rate','buy','pct'].forEach(function(k){
    var mc=document.getElementById('pl-mc-'+k);if(mc)mc.classList.toggle('sel',k===m);
    var md=document.getElementById('pl-method-'+k);if(md)md.style.display=k===m?'block':'none';
  });
  var prev=document.getElementById('pl-preview-section');if(prev)prev.style.display='none';
  _plPending=null;
}
function plPreviewUpdate(method){
  var updates=[];
  if(method==='rate'){
    var pctVal=parseFloat((document.getElementById('pl-rate-pct')||{}).value);
    if(isNaN(pctVal)){showToast('⚠ درصد تغییر را وارد کنید');return;}
    var ratio=1+pctVal/100;
    updates=_plP.map(function(p,i){
      var nc={};Object.keys(p.channels).forEach(function(k){nc[k]=p.channels[k]?plRound(p.channels[k]*ratio):null;});
      return{idx:i,newBuy:plRound(p.buyPrice*ratio),ratio:ratio,newChannels:nc,newBase:plRound(p.repPrices.base*ratio)};
    });
  }else if(method==='buy'){
    updates=_plP.map(function(p,i){
      var el=document.getElementById('pl-buy-inp-'+i);
      var nv=el?parseFloat(el.value):NaN;
      if(!nv||isNaN(nv)){var nc2={};Object.keys(p.channels).forEach(function(k){nc2[k]=p.channels[k];});return{idx:i,newBuy:p.buyPrice,ratio:1,newChannels:nc2,newBase:p.repPrices.base,skip:true};}
      var ratio2=nv/p.buyPrice;
      var nc3={};Object.keys(p.channels).forEach(function(k){nc3[k]=p.channels[k]?plRound(p.channels[k]*ratio2):null;});
      return{idx:i,newBuy:nv,ratio:ratio2,newChannels:nc3,newBase:plRound(p.repPrices.base*ratio2)};
    });
  }else{
    var pv2=parseFloat((document.getElementById('pl-sell-pct')||{}).value);
    if(isNaN(pv2)){showToast('⚠ درصد افزایش را وارد کنید');return;}
    var ratio3=1+pv2/100;
    updates=_plP.map(function(p,i){
      var nc4={};Object.keys(p.channels).forEach(function(k){nc4[k]=p.channels[k]?plRound(p.channels[k]*ratio3):null;});
      return{idx:i,newBuy:p.buyPrice,ratio:ratio3,newChannels:nc4,newBase:plRound(p.repPrices.base*ratio3)};
    });
  }
  _plPending=updates;
  var prev2=document.getElementById('pl-preview-section');if(!prev2)return;
  document.getElementById('pl-preview-tbody').innerHTML=updates.map(function(u,i){
    var p=_plP[i];var diff=((u.ratio-1)*100).toFixed(1);
    var diffHtml=u.ratio>=1?'<span class="pl-diff-pos">+'+diff+'٪</span>':'<span class="pl-diff-neg">'+diff+'٪</span>';
    return '<tr>'
      +'<td class="pl-rnum">'+plToFa(i+1)+'</td>'
      +'<td class="pl-pname">'+esc(p.name)+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.buyPrice)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#f59e0b">'+(u.skip?'—':plFmt(u.newBuy))+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.channels.faradis)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#16a34a">'+plFmt(u.newChannels.faradis)+'</td>'
      +'<td class="tr" style="color:var(--text-muted)">'+plFmt(p.channels.hospital)+'</td>'
      +'<td class="tr" style="font-weight:700;color:#16a34a">'+plFmt(u.newChannels.hospital)+'</td>'
      +'<td class="tc">'+(u.skip?'—':diffHtml)+'</td>'
      +'</tr>';
  }).join('');
  prev2.style.display='block';
  prev2.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function plApplyUpdate(){
  if(!_plPending)return;
  _plPending.forEach(function(u,i){
    if(u.skip)return;
    var p=_plP[i];p.buyPrice=u.newBuy;
    Object.assign(p.channels,u.newChannels);
    var tiers=p.repPrices.tiers;p.repPrices.base=u.newBase;
    p.repPrices.tiers=tiers.map(function(tier){return tier.map(function(v){return plRound(v*u.ratio);});});
  });
  plSaveAll();plRenderRep();plRenderOverview();
  var prev=document.getElementById('pl-preview-section');if(prev)prev.style.display='none';
  _plPending=null;
  document.getElementById('pl-upd-date').textContent='آخرین آپدیت: '+new Date().toLocaleDateString('fa-IR');
  showToast('✅ قیمت‌ها با موفقیت بروزرسانی شد',3000);
}
function plCancelPreview(){var p=document.getElementById('pl-preview-section');if(p)p.style.display='none';_plPending=null;}

// ── COMMISSIONS (SQL commission_rules) ────────────────────────────────────────
var _plCommListId=null,_plCommProducts=[];

function plRenderCommEdit(){
  var grid=document.getElementById('pl-comm-edit-grid');if(!grid)return;
  grid.innerHTML='<div style="padding:12px;color:var(--text-muted)">در حال بارگذاری قوانین پورسانت...</div>';
  fetch('/api/pricing/commission-rules?buyer_type=hospital',{credentials:'include'})
    .then(function(r){return r.ok?r.json():Promise.reject(new Error('load failed'));})
    .then(function(data){
      _plCommListId=data.list_id||null;
      _plCommProducts=data.products||[];
      if(!_plCommListId){
        grid.innerHTML='<div class="pl-info-box">ابتدا از تب «بروزرسانی» یک لیست قیمت import کنید تا قوانین پورسانت قابل ویرایش شوند.</div>';
        return;
      }
      grid.innerHTML='<div class="pl-tbl-wrap"><table class="pl-tbl"><thead><tr>'
        +'<th>محصول</th><th class="tc">سطح ۱ (ریال)</th><th class="tc">سطح ۲ (ریال)</th><th class="tc">سطح ۳ (ریال)</th>'
        +'</tr></thead><tbody>'
        +_plCommProducts.map(function(p){
          return '<tr><td class="pl-pname">'+esc(p.product_name)+'</td>'
            +[1,2,3].map(function(lvl){
              var v=p['level'+lvl];
              return '<td class="tc"><input class="pl-cei-inp" type="number" min="0" id="plcr-'+p.product_id+'-'+lvl+'" value="'+(v!=null&&v!==''?v:'')+'" placeholder="—" style="width:110px"></td>';
            }).join('')
            +'</tr>';
        }).join('')
        +'</tbody></table></div>'
        +'<div style="font-size:10px;color:var(--text-muted);margin-top:8px">لیست قیمت فعال بیمارستان (#'+_plCommListId+') — مقادیر در دیتابیس ذخیره می\u200cشوند.</div>';
    })
    .catch(function(){
      grid.innerHTML='<div style="color:#dc2626;padding:12px">خطا در بارگذاری قوانین پورسانت</div>';
    });
}
function plSaveComm(){
  if(!_plCommListId){showToast('لیست قیمت فعال یافت نشد');return;}
  var rules=[];
  _plCommProducts.forEach(function(p){
    [1,2,3].forEach(function(lvl){
      var el=document.getElementById('plcr-'+p.product_id+'-'+lvl);
      if(!el)return;
      var raw=el.value.trim();
      if(raw==='')return;
      var v=parseInt(raw,10);
      if(isNaN(v)||v<0)return;
      rules.push({product_id:p.product_id,level:lvl,amount:v});
    });
  });
  fetch('/api/pricing/commission-rules',{
    method:'PUT',credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({list_id:_plCommListId,rules:rules})
  }).then(function(r){return r.json().then(function(j){return {ok:r.ok,body:j};});})
    .then(function(res){
      var s=document.getElementById('pl-comm-status');
      if(!res.ok){
        if(s){s.textContent='❌ '+(res.body.error||'خطا در ذخیره');s.className='pl-status err';}
        showToast('خطا در ذخیره پورسانت');
        return;
      }
      if(s){s.textContent='✅ پورسانت\u200cها در دیتابیس ذخیره شدند';s.className='pl-status ok';setTimeout(function(){s.className='pl-status';},3000);}
      showToast('💾 قوانین پورسانت ذخیره شد');
      plRenderCommEdit();
    })
    .catch(function(){
      showToast('خطا در ذخیره پورسانت');
    });
}
function plResetComm(){
  if(!_plCommListId){showToast('لیست قیمت فعال یافت نشد');return;}
  if(!confirm('همه مقادیر پورسانت این لیست قیمت پاک شود؟'))return;
  fetch('/api/pricing/commission-rules',{
    method:'PUT',credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({list_id:_plCommListId,rules:[]})
  }).then(function(r){return r.ok?r.json():Promise.reject();})
    .then(function(){showToast('پورسانت\u200cها پاک شد');plRenderCommEdit();})
    .catch(function(){showToast('خطا در پاک\u200cسازی');});
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function _plSettObj(pfx){
  if(pfx==='plsp')return _plSETT.payLabels;
  if(pfx==='plsc')return _plSETT.centers;
  if(pfx==='plscl')return _plSETT.commLabels;
  if(pfx==='plscn')return _plSETT.commNames;
  return {};
}
function _plFlushObjSection(pfx){
  var obj=_plSettObj(pfx);var keys=Object.keys(obj);
  var newObj={};
  keys.forEach(function(k,i){
    var kEl=document.getElementById(pfx+'-key-'+i);
    var vEl=document.getElementById(pfx+'-val-'+i);
    var nk=kEl?kEl.value.trim():k;
    var nv=vEl?vEl.value.trim():obj[k];
    if(nk&&nv)newObj[nk]=nv;
  });
  keys.forEach(function(k){delete obj[k];});
  Object.assign(obj,newObj);
}
function _plFlushTiers(){
  _plSETT.tiers=_plSETT.tiers.map(function(t,i){
    var lbl=(document.getElementById('plst-lbl-'+i)||{}).value||t.label;
    var maxEl=document.getElementById('plst-max-'+i);
    var max=maxEl?(parseFloat(maxEl.value)||t.max):t.max;
    return{label:lbl.trim()||t.label,max:max};
  });
}
function _plObjSectionHTML(pfx,data,placeholder){
  var keys=Object.keys(data);
  var rows=keys.map(function(k,i){
    return '<div class="pl-sett-row">'
      +'<input class="pl-sett-inp" id="'+pfx+'-key-'+i+'" value="'+esc(k)+'" placeholder="کد" style="width:100px;flex:none;direction:ltr;font-size:11px">'
      +'<input class="pl-sett-inp" id="'+pfx+'-val-'+i+'" value="'+esc(data[k])+'" placeholder="'+esc(placeholder)+'">'
      +(keys.length>1?'<button onclick="plRemoveSettKey(\''+pfx+'\','+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;line-height:1;padding:0 3px;flex-shrink:0" title="حذف">✕</button>':'')
      +'</div>';
  }).join('');
  return rows
    +'<div style="display:flex;gap:5px;margin-top:4px">'
    +'<input id="'+pfx+'-new-key" type="text" placeholder="کد جدید..." style="width:100px;flex:none;direction:ltr;font-size:11px;padding:5px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<input id="'+pfx+'-new-val" type="text" placeholder="'+esc(placeholder)+'..." style="flex:1;font-size:12px;padding:5px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<button onclick="plAddSettKey(\''+pfx+'\')" style="padding:5px 14px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:12px;font-family:inherit;cursor:pointer;font-weight:700;flex-shrink:0">+ اضافه</button>'
    +'</div>';
}
function plAddSettKey(pfx){
  _plFlushObjSection(pfx);
  var kEl=document.getElementById(pfx+'-new-key');
  var vEl=document.getElementById(pfx+'-new-val');
  if(!kEl||!vEl)return;
  var k=kEl.value.trim();var v=vEl.value.trim();
  if(!k||!v){showToast('کد و نام نمایشی را وارد کنید');return;}
  var obj=_plSettObj(pfx);
  if(obj.hasOwnProperty(k)){showToast('این کد قبلاً وجود دارد');return;}
  obj[k]=v;kEl.value='';vEl.value='';
  plRenderSett();
}
function plRemoveSettKey(pfx,i){
  _plFlushObjSection(pfx);
  var obj=_plSettObj(pfx);var keys=Object.keys(obj);
  if(keys.length<=1){showToast('حداقل یک ردیف باید باقی بماند');return;}
  delete obj[keys[i]];
  plRenderSett();
}
function plAddTier(){
  _plFlushTiers();
  var n=_plSETT.tiers.length;
  var prevMax=n>1?_plSETT.tiers[n-2].max:100;
  _plSETT.tiers.splice(n-1,0,{label:'سطح جدید',max:prevMax+100});
  plRenderSett();
}
function plRemoveTier(i){
  _plFlushTiers();
  if(_plSETT.tiers.length<=1){showToast('حداقل یک سطح باید باقی بماند');return;}
  _plSETT.tiers.splice(i,1);
  plRenderSett();
}
function plRenderSett(){
  var tg=document.getElementById('pl-sett-tiers');
  if(tg){
    var tiersHtml=_plSETT.tiers.map(function(t,i){
      var isLast=i===_plSETT.tiers.length-1;
      return '<div class="pl-sett-row">'
        +'<input class="pl-sett-inp" id="plst-lbl-'+i+'" value="'+esc(t.label)+'" placeholder="نام سطح" style="flex:2">'
        +(isLast?'<span class="pl-sett-lbl" style="font-size:10px">بدون سقف</span>'
          :'<span class="pl-sett-lbl">حداکثر:</span><input class="pl-sett-inp num" id="plst-max-'+i+'" type="number" value="'+t.max+'" min="1">')
        +(i>0?'<button onclick="plRemoveTier('+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;line-height:1;padding:0 3px;flex-shrink:0" title="حذف">✕</button>':'<span style="width:22px;flex-shrink:0"></span>')
        +'</div>';
    }).join('');
    tg.innerHTML=tiersHtml
      +'<button onclick="plAddTier()" style="margin-top:4px;padding:5px 14px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:12px;font-family:inherit;cursor:pointer;font-weight:700">+ افزودن سطح</button>';
  }
  var pg=document.getElementById('pl-sett-pay');
  if(pg)pg.innerHTML=_plObjSectionHTML('plsp',_plSETT.payLabels,'نام نمایشی');
  var cg=document.getElementById('pl-sett-centers');
  if(cg)cg.innerHTML=_plObjSectionHTML('plsc',_plSETT.centers,'نام مرکز');
  var clg=document.getElementById('pl-sett-commlabels');
  if(clg)clg.innerHTML=_plObjSectionHTML('plscl',_plSETT.commLabels,'برچسب پورسانت');
  var cng=document.getElementById('pl-sett-commnames');
  if(cng)cng.innerHTML=_plObjSectionHTML('plscn',_plSETT.commNames,'نام دسته');
}
function plSaveSett(){
  _plFlushTiers();
  ['plsp','plsc','plscl','plscn'].forEach(_plFlushObjSection);
  plApplySett();plSaveAll();plRenderRep();plRenderSett();
  var s=document.getElementById('pl-sett-status');
  if(s){s.textContent='✅ تنظیمات با موفقیت ذخیره شد';s.className='pl-status ok';setTimeout(function(){s.className='pl-status';},3000);}
}
function plResetSett(){
  if(!confirm('آیا از بازگشت همه تنظیمات به حالت پیش‌فرض مطمئن هستید؟'))return;
  _plSETT=JSON.parse(JSON.stringify(PL_DEFAULT_SETT));
  plApplySett();plSaveAll();plRenderSett();plRenderRep();
}
// ════════════════ END PRICING MODULE ════════════════════════════

document.addEventListener('click', function(ev) {
  var popup = document.getElementById('centerContactPopup');
  if (popup && popup.classList.contains('show') && !popup.contains(ev.target)) hideContactPopup();
});
function _openTaskModalLazy(tid, prefill) {
  if (typeof openTaskModal === 'function') { openTaskModal(tid, prefill); return; }
  if (typeof ensureTabScripts !== 'function') { showToast('ماژول وظایف در دسترس نیست'); return; }
  ensureTabScripts('tasks').then(function() {
    if (typeof openTaskModal === 'function') openTaskModal(tid, prefill);
    else showToast('خطا در بارگذاری وظایف');
  }).catch(function() { showToast('خطا در بارگذاری وظایف'); });
}

function convertFollowupToTask(rtype, rid) {
  var e = getE(rtype, rid);
  var name = typeof _getCenterName === 'function' ? _getCenterName(rtype, rid) : (rtype + '_' + rid);
  _openTaskModalLazy(null, {
    title: 'پیگیری: ' + name,
    owner: e.owner || currentUser,
    dueDate: e.followupDate || '',
    priority: 1,
    centerKey: rtype + '_' + rid
  });
}

function _openSupportTicketLazy(id) {
  if (typeof window._spOpenTicket === 'function') { window._spOpenTicket(id); return; }
  if (typeof ensureTabScripts !== 'function') return;
  ensureTabScripts('support').then(function() {
    if (window._spOpenTicket) window._spOpenTicket(id);
  });
}

function _openSupportNewForCenterLazy(centerKey, centerName) {
  if (typeof window._spOpenNewForCenter === 'function') { window._spOpenNewForCenter(centerKey, centerName); return; }
  if (typeof ensureTabScripts !== 'function') { showToast('ماژول پشتیبانی در دسترس نیست'); return; }
  ensureTabScripts('support').then(function() {
    if (window._spOpenNewForCenter) window._spOpenNewForCenter(centerKey, centerName);
    else showToast('خطا در بارگذاری پشتیبانی');
  }).catch(function() { showToast('خطا در بارگذاری پشتیبانی'); });
}

function _loadCenterWorkItems(rtype, id) {
  var ck = rtype + '_' + id;
  var el = document.getElementById('cmWorkInner_' + id);
  if (!el) return;
  if (typeof _ensureTasks === 'function') _ensureTasks();
  var openTasks = (DB.tasks || []).filter(function(t) {
    return t.centerKey === ck && t.status !== 'done' && !t.done;
  });
  fetch('/api/support?center_key=' + encodeURIComponent(ck) + '&limit=20')
    .then(function(r) { return r.ok ? r.json() : { tickets: [] }; })
    .catch(function() { return { tickets: [] }; })
    .then(function(d) {
      var tickets = (d.tickets || []).filter(function(t) {
        return t.status !== 'resolved' && t.status !== 'closed';
      });
      var html = '';
      if (!openTasks.length && !tickets.length) {
        html = '<div style="color:var(--text-muted);padding:6px 0">وظیفه یا تیکت بازی نیست</div>';
      } else {
        if (openTasks.length) {
          html += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:#6d28d9;margin-bottom:4px">وظایف (' + openTasks.length + ')</div>';
          openTasks.forEach(function(t) {
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:var(--bg-card);border-radius:5px;margin-bottom:3px;border:1px solid #e9d5ff">'
              + '<span style="flex:1;cursor:pointer" onclick="_openTaskModalLazy(\'' + esc(String(t.id)) + '\')">' + esc(t.title || '—') + '</span>'
              + '<span style="font-size:10px;color:var(--text-muted)">' + esc((typeof USERS !== 'undefined' ? USERS[t.owner] : '') || t.owner || '') + '</span>'
              + (t.dueDate ? '<span style="font-size:10px;color:var(--text-muted)">' + t.dueDate + '</span>' : '')
              + '</div>';
          });
          html += '</div>';
        }
        if (tickets.length) {
          html += '<div><div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:4px">تیکت‌ها (' + tickets.length + ')</div>';
          tickets.forEach(function(t) {
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:var(--bg-card);border-radius:5px;margin-bottom:3px;border:1px solid #bae6fd;cursor:pointer" onclick="_openSupportTicketLazy(\'' + esc(t.id) + '\')">'
              + '<span style="flex:1">' + esc(t.title) + '</span>'
              + '<span style="font-size:10px;color:var(--text-muted)">' + esc(t.assigned_to || '') + '</span>'
              + '</div>';
          });
          html += '</div>';
        }
      }
      el.innerHTML = html;
    });
}

function openCenterAudit(centerKey, centerName) {
  fetch('/api/support?center_key='+encodeURIComponent(centerKey)+'&limit=50')
    .then(function(r){return r.ok?r.json():{tickets:[]};})
    .catch(function(){return {tickets:[]};})
    .then(function(d){_renderCenterAuditModal(centerKey, centerName, d.tickets||[]);});
}

function _renderCenterAuditModal(centerKey, centerName, supportTickets) {
  var _ckParts=centerKey.split('_');var rtype=_ckParts[0], rid=_ckParts.slice(1).join('_');
  var events=[];
  // changeLog
  (DB.changeLog||[]).filter(function(h){return h.rkey===centerKey;}).forEach(function(h){
    var d=new Date(h.at);
    var fmap={status:'وضعیت',owner:'مسئول',lead:'سرنخ',potential:'پتانسیل',followupDate:'تاریخ پیگیری',nameOverride:'نام',address:'آدرس','type':'نوع'};
    events.push({ts:d.getTime(),type:'change',icon:'✏️',color:'#8b5cf6',
      title:(fmap[h.field]||h.field)+' تغییر کرد',
      detail:'مقدار: '+String(h.val||'—').substring(0,40),
      by:h.by,at:d,dateStr:''});
  });
  // notes
  (DB.notes[rtype+'_'+rid]||[]).forEach(function(n){
    var dp=n.date?n.date.split('/').map(Number):(n.at?(function(){var _nd=new Date(n.at);return g2j(_nd.getFullYear(),_nd.getMonth()+1,_nd.getDate());}()):null);
    var g=dp?j2g(dp[0],dp[1],dp[2]):[2000,1,1];
    var ts=dp?new Date(g[0],g[1]-1,g[2],12).getTime():0;
    events.push({ts:ts,type:'note',icon:'📝',color:'#0ea5e9',
      title:'یادداشت',detail:String(n.text||'').substring(0,60),by:n.by||n.user,at:null,dateStr:n.date||(n.at?msToJ(n.at):'')||''});
  });
  // weekEntries done
  Object.values(DB.weekEntries||{}).filter(function(we){return we.recKey===centerKey&&we.done;}).forEach(function(we){
    var dp=we.doneDate?we.doneDate.split('/').map(Number):null;
    var ts=dp?jMs(dp[0],dp[1],dp[2]):0;
    var icon=we.actionType==='visit'?'🤝':'📞';
    events.push({ts:ts,type:'done',icon:icon,color:'#22c55e',
      title:(we.actionType==='visit'?'ویزیت انجام شد':'تماس انجام شد'),
      detail:(we.doneResult?'نتیجه: '+we.doneResult+' ':'')+(we.doneNote||''),
      by:we.addedBy||'',at:null,dateStr:we.doneDate||''});
  });
  // tasks
  (DB.tasks||[]).filter(function(t){return t.centerKey===centerKey;}).forEach(function(t){
    var dp=t.dueDate?t.dueDate.split('/').map(Number):null;
    var ts=dp?jMs(dp[0],dp[1],dp[2]):0;
    events.push({ts:ts,type:'task',icon:t.done?'✅':'📌',color:t.done?'#22c55e':'#f59e0b',
      title:(t.done?'وظیفه انجام شد':'وظیفه')+': '+String(t.title||'').substring(0,30),
      detail:t.note||'',by:t.owner||'',at:null,dateStr:t.dueDate||''});
  });
  // support tickets
  (supportTickets||[]).forEach(function(tk){
    var ts=tk.created_at?new Date(tk.created_at).getTime():0;
    var stLabel={open:'باز',in_progress:'در جریان',waiting:'انتظار',resolved:'حل‌شده',closed:'بسته'}[tk.status]||tk.status;
    events.push({ts:ts,type:'support',icon:'🎧',color:tk.status==='resolved'||tk.status==='closed'?'#22c55e':'#3b82f6',
      title:'تیکت: '+String(tk.title||'').substring(0,40),
      detail:stLabel+(tk.description?' — '+String(tk.description).substring(0,40):''),
      by:tk.assigned_to||tk.reporter||'',at:tk.created_at?new Date(tk.created_at):null,dateStr:'',ticketId:tk.id});
  });

  events.sort(function(a,b){return b.ts-a.ts;});

    var body='<div style="max-height:70vh;overflow-y:auto;padding:8px 4px">';
  if(!events.length){
    body+='<div style="text-align:center;padding:30px;color:var(--text-muted)">هیچ رویدادی ثبت نشده</div>';
  } else {
    body+='<div style="position:relative;padding-right:32px">'
      +'<div style="position:absolute;right:14px;top:8px;bottom:8px;width:2px;background:var(--border)"></div>';
    events.forEach(function(ev){
      var dateStr=ev.dateStr||(ev.at?(function(){var d=ev.at,jd=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);}()):'');
      var timeStr=ev.at?(' '+p2(ev.at.getHours())+':'+p2(ev.at.getMinutes())):'';
      var byName=(typeof USERS!=='undefined'?USERS[ev.by]:null)||ev.by||'';
      body+='<div style="position:relative;margin-bottom:12px">'
        +'<div style="position:absolute;right:-26px;top:8px;width:16px;height:16px;border-radius:50%;background:'+ev.color+';border:2px solid var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:9px">'+ev.icon+'</div>'
        +'<div style="background:var(--bg-raised);border-radius:8px;padding:9px 12px;border:1px solid var(--border)">'
        +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
        +'<span style="font-weight:700;font-size:12px;color:'+ev.color+'">'+esc(ev.title)+'</span>'
        +'<span style="font-size:10px;color:var(--text-muted);margin-right:auto">'+esc(dateStr+timeStr)+'</span>'
        +'</div>'
        +(ev.detail?'<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:3px">'+esc(ev.detail)+'</div>':'')
        +(byName?'<div style="font-size:10px;color:var(--text-muted)">👤 '+esc(byName)+'</div>':'')
        +(ev.ticketId?'<button onclick="_openSupportTicketLazy(\''+esc(ev.ticketId)+'\')" style="margin-top:4px;font-size:10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;padding:2px 8px;cursor:pointer;font-family:inherit">مشاهده تیکت</button>':'')
        +'</div></div>';
    });
    body+='</div>';
  }
  body+='</div>';
  openModal('auditModal','📅 تاریخچه — '+esc(centerName),body,'<button class="btn-secondary" onclick="closeModal(\'auditModal\')">\u0628\u0633\u062a\u0646</button>',{lg:true});
}

function _updateExtraCenterProv(id,newProvId){
  var idx=(DB.extra||[]).findIndex(function(x){return x.id===id;});
  if(idx<0)return;
  DB.extra[idx].province_id=newProvId;
  clearPCCache();_ALL_PROVS=null;
  saveDB();showToast('✅ استان به‌روز شد');
}

function _getCompetitorList(){
  var comps={};
  Object.values(DB.edits||{}).forEach(function(e){
    if(e&&e.competitor&&e.competitor.trim()){
      e.competitor.trim().split(/[,،/]+/).forEach(function(c){
        c=c.trim();
        if(c.length>1)comps[c]=(comps[c]||0)+1;
      });
    }
  });
  return Object.keys(comps).sort(function(a,b){return comps[b]-comps[a];});
}

// ── Playbook gap: lead-change & status-change helpers ──────────
var ACTION_TYPE_LABELS={'call':'📞 تماس','visit':'🤝 ملاقات','price_send':'📄 ارسال قیمت','sample_send':'🧪 ارسال نمونه','committee':'🏛 کمیته','meeting':'👥 جلسه','followup':'🔄 پیگیری'};
// Max days without activity per lead stage (Playbook §7)
var _STAGE_MAX_DAYS={'لید':7,'سرنخ':7,'فرصت_A':3,'فرصت_B':7,'فرصت_C':14,'فرصت':7,'مشتری':30,'مشتری_dormant':30};
function _getStageMaxDays(lead,oppGrade,customerStatus){
  if(lead==='فرصت')return _STAGE_MAX_DAYS['فرصت_'+(oppGrade||'B')]||7;
  if(lead==='مشتری')return 30;
  return _STAGE_MAX_DAYS[lead]||14;
}
function _getLastActivityDate(rtype,rid){
  var rkey=rtype+'_'+rid;
  var cls=(DB.changeLog||[]).filter(function(ch){return ch.rkey===rkey;});
  if(!cls.length)return null;
  var latest=cls.reduce(function(a,b){return a.at>b.at?a:b;});
  return latest.at;
}
function _onLeadChange(id,newLead,rtype,rid){
  var opp=document.getElementById('cmOppSection_'+id);
  var cust=document.getElementById('cmCustSection_'+id);
  if(opp)opp.style.display=newLead==='فرصت'?'':'none';
  if(cust)cust.style.display=newLead==='مشتری'?'':'none';
  // Stage validation: warn about missing fields
  if(rtype&&rid){
    var e=getE(rtype,rid);
    var missing=[];
    if(newLead==='سرنخ'||newLead==='فرصت'){
      if(!e.contacts||!e.contacts.length)missing.push('اطلاعات تماس');
    }
    if(newLead==='فرصت'){
      if(!e.competitor)missing.push('رقیب اصلی');
      if(!e.oppGrade)missing.push('درجه فرصت (A/B/C)');
    }
    if(newLead==='مشتری'){
      if(!e.lastPurchaseDate)missing.push('تاریخ آخرین خرید');
    }
    if(missing.length){
      var warn=document.getElementById('cmStageWarn_'+id);
      if(warn){warn.textContent='⚠️ فیلدهای تکمیل‌نشده: '+missing.join(' / ');warn.style.display='';}
    } else {
      var warn=document.getElementById('cmStageWarn_'+id);
      if(warn)warn.style.display='none';
    }
  }
  if(rtype&&rid)setE(rtype,rid,'lead',newLead);
}
function _onStatusChange(rtype,rid,newStatus){
  var needReason=['غیرفعال','عدم نیاز فاکتور کنسل شد'];
  setE(rtype,rid,'status',newStatus);
  if(needReason.indexOf(newStatus)>=0){
    var existing=getE(rtype,rid).closeReason||'';
    if(existing)return;
    var reasons=['قیمت','بودجه','رقیب','عدم نیاز','تصمیم پزشک','تصمیم بیمارستان','زمان خرید','سایر'];
    var sel='<select id="_crSel" style="width:100%;padding:7px 8px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;margin-top:4px"><option value="">انتخاب دلیل...</option>'+reasons.map(function(r){return'<option>'+r+'</option>';}).join('')+'</select>';
    var body='<div style="font-size:12px"><p style="margin:0 0 8px;color:var(--text-secondary)">دلیل بسته/غیرفعال شدن مرکز را انتخاب کنید:</p>'+sel+'<input id="_crOther" type="text" placeholder="توضیح بیشتر (اختیاری)..." style="width:100%;box-sizing:border-box;margin-top:6px;padding:6px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px"></div>';
    var _rt=rtype,_ri=rid;
    openModal('closeReasonModal','❗ دلیل بستن / غیرفعال کردن',body,
      '<button class="btn-secondary" onclick="closeModal(\'closeReasonModal\')">بعداً ثبت می‌کنم</button>'
      +'<button class="btn-primary" onclick="(function(){var s=(document.getElementById(\'_crSel\')||{}).value;var o=(document.getElementById(\'_crOther\')||{}).value||\'\';if(!s){showToast(\'دلیل را انتخاب کنید\');return;}setE(_rt,_ri,\'closeReason\',s+(o?\' — \'+o:\'\'));closeModal(\'closeReasonModal\');showToast(\'✓ دلیل ثبت شد\');})()">ثبت دلیل</button>'
    );
  }
}
function _computeCustomerStatus(rtype,rid){
  var e=getE(rtype,rid);
  var lpd=e.lastPurchaseDate||'';
  if(!lpd)return'';
  var today=todayStr();
  var dp=lpd.split('/');var tp=today.split('/');
  try{
    var lpdMs=jMs(parseInt(dp[0]),parseInt(dp[1]),parseInt(dp[2]));
    var todMs=jMs(parseInt(tp[0]),parseInt(tp[1]),parseInt(tp[2]));
    var days=Math.floor((todMs-lpdMs)/86400000);
    if(days>90)return'dormant';
    if(days>0)return'active';
    return'active_new';
  }catch(_){return'';}
}
function openCloseReasonModal(rtype,rid){_onStatusChange(rtype,rid,getE(rtype,rid).status);}
function _cmSetLastPurch(rtype,rid,id,v){
  var el=document.getElementById('cmLastPurch_'+id);
  if(el)el.value=v;
  setE(rtype,rid,'lastPurchaseDate',v);
  var cs=_computeCustomerStatus(rtype,rid);
  if(cs)setE(rtype,rid,'customerStatus',cs);
}
function openCenterModal(rtype,id){
  // Track recent centers
  var _rcKey=rtype+'_'+id;
  _recentCenters=_recentCenters.filter(function(x){return x.key!==_rcKey;});
  _recentCenters.unshift({key:_rcKey,rtype:rtype,id:id,name:_getCenterName(rtype,id),ts:Date.now()});
  if(_recentCenters.length>8)_recentCenters=_recentCenters.slice(0,8);
  var prov=null;
  // For PC centers: ID encodes the province (format: 'provId||n') — extract first
  if(rtype==='pc'&&typeof id==='string'&&id.indexOf('||')>=0){
    prov=id.split('||')[0];
  }
  if(!prov){
    // Search PC cache FIRST (before DB.extra) to avoid ID collisions with extra centers
    if(rtype==='pc'){
      _buildPCCache();
      Object.keys(_PC_CACHE||{}).some(function(pid){
        if(pid==='tehran')return false;
        var found=(_PC_CACHE[pid]||[]).find(function(x){return String(x.id)===String(id);});
        if(found){prov=pid;return true;}
        return false;
      });
    }
    if(!prov){
      // Fall back to full province search (includes DB.extra)
      getAllProvinces().some(function(p){
        var pt=getProvType(p.id);
        if(pt===rtype||(rtype==='center'&&p.id==='tehran')){
          var c=getProvCenters(p.id).find(function(x){return String(x.id)===String(id);});
          if(c){prov=p.id;return true;}
        }
        return false;
      });
    }
  }
  if(!prov){
    prov=_currentProvId||'tehran';
  }
  // DB.extra wins over PC cache when IDs collide — check it first
  var r=(DB.extra||[]).find(function(x){
    var xrt=x.province_id==='tehran'?'center':'pc';
    return xrt===rtype&&String(x.id)===String(id);
  })||null;
  if(!r){
    var centers=getProvCenters(prov||'tehran');
    r=centers.find(function(x){return String(x.id)===String(id);});
    if(!r&&prov){
      getAllProvinces().some(function(p){
        if(p.id===prov)return false;
        var c=getProvCenters(p.id).find(function(x){return String(x.id)===String(id);});
        if(c){r=c;prov=p.id;return true;}
        return false;
      });
    }
    if(!r){r=(DB.extra||[]).find(function(x){return String(x.id)===String(id);})||null;}
  }
  if(!r){showToast('مرکز یافت نشد');return;}
  var e=getE(rtype,r.id);
  var st=e.status||'بدون تماس';var lead=e.lead||r.lead||'سرنخ';
  var pot=e.potential!==undefined?e.potential:r.potential;
  var fd=e.followupDate||'';var today=todayStr();
  var notes=DB.notes[recK(rtype,r.id)]||[];
  var tgs=rTags(rtype,r.id);
  var wkEntries=Object.values(DB.weekEntries||{}).filter(function(we){return we.recKey===rtype+'_'+id;});
  var displayName=e.nameOverride||r.name;
  var isExtra=!!(DB.extra&&DB.extra.find(function(x){return x.id===r.id;}));
  var provObj=getAllProvinces().find(function(p){return p.id===(prov||'tehran');});
  var provName=provObj?provObj.name:'تهران';
  var inpStyle='width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';

  var body='<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">نام مرکز</label>'
    +'<input type="text" value="'+esc(displayName)+'" style="'+inpStyle+'" '
    +'onchange="setE(\''+rtype+'\',\''+r.id+'\',\'nameOverride\',this.value.trim());var _m=document.getElementById(\'mo_cm_'+id+'\');var _th=_m?_m.querySelector(\'.m-head span\'):null;if(_th)_th.textContent=\'🏥 \'+(this.value.trim()||\''+esc(displayName)+'\');if(typeof renderTable===\'function\')renderTable();" placeholder="نام مرکز..."></div>'
    +(isExtra
      ?'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">استان</label>'
        +'<select style="'+inpStyle+'" onchange="_updateExtraCenterProv(\''+r.id+'\',this.value)">'
        +getAllProvinces().map(function(p){return'<option value="'+p.id+'"'+(p.id===(prov||'tehran')?' selected':'')+'>'+p.name+'</option>';}).join('')
        +'</select></div>'
      :'<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px">استان</label>'
        +'<div style="'+inpStyle+';background:var(--bg-page);color:var(--text-muted)">'+esc(provName)+'</div></div>'
    )
    +'</div></div>'
    +'<div class="m-2col">'
    +'<div><label>پتانسیل</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'potential\',parseInt(this.value))">'
    +[1,2,3,4].map(function(v){return'<option value="'+v+'"'+(pot==v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div>'
    +'<div><label>مسئول</label>'
    +'<span class="owner-dot" data-uid="'+encodeURIComponent(e.owner||r.owner||'')+'"></span>'
    +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'owner\',this.value);var _d=this.previousElementSibling;if(_d)_d.style.background=window.umGetColor?umGetColor(this.value):\'#e2e8f0\'">'
    +'<option value="">—</option>'
    +(function(){var _act=typeof umGetActive==='function'?umGetActive():[];return _act.map(function(m){return'<option value="'+m.id+'"'+((e.owner||r.owner||'')==m.id?' selected':'')+'>'+m.name+'</option>';}).join('');})()+'</select></div>'
    +(function(){var _typeOpts=[''].concat(TYPE_LIST);var _curType=e.type||r.type||'';return'<div><label>نوع مرکز</label><select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'type\',this.value)">'+_typeOpts.map(function(t){return'<option value="'+t+'"'+(_curType===t?' selected':'')+'>'+(t||'-- نوع --')+'</option>';}).join('')+'</select></div>';})()
    +'</div><div class="m-2col">'
    +'<div><label>وضعیت</label><select class="ed-sel" onchange="_onStatusChange(\''+rtype+'\',\''+r.id+'\',this.value)">'
    +STATUS_LIST.map(function(s){return'<option'+(s===st?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'
    +'<div><label>سرنخ</label><select class="ed-sel" onchange="_onLeadChange(\''+id+'\',this.value,\''+rtype+'\',\''+r.id+'\')">'
    +LEAD_LIST.map(function(l){return'<option'+(l===lead?' selected':'')+'>'+l+'</option>';}).join('')+'</select></div>'
    +'</div>'
    // Stage validation warning
    +'<div id="cmStageWarn_'+id+'" style="display:none;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;margin-top:4px;font-size:10px;color:#92400e"></div>'
    // ── بخش فرصت (فقط وقتی lead=فرصت) ──
    +'<div id="cmOppSection_'+id+'" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:8px 12px;margin-top:6px;'+(lead==='فرصت'?'':'display:none')+'">'
    +'<div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px">🎯 جزئیات فرصت</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">احتمال موفقیت</label>'
    +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'oppProbability\',this.value)">'
    +'<option value="">—</option>'
    +'<option value="low"'+(e.oppProbability==='low'?' selected':'')+'>کم</option>'
    +'<option value="medium"'+(e.oppProbability==='medium'?' selected':'')+'>متوسط</option>'
    +'<option value="high"'+(e.oppProbability==='high'?' selected':'')+'>زیاد ✅</option>'
    +'</select></div>'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">درجه فرصت</label>'
    +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'oppGrade\',this.value)">'
    +'<option value="">—</option>'
    +'<option value="A"'+(e.oppGrade==='A'?' selected':'')+'>🔥 A (داغ)</option>'
    +'<option value="B"'+(e.oppGrade==='B'?' selected':'')+'>☀️ B (گرم)</option>'
    +'<option value="C"'+(e.oppGrade==='C'?' selected':'')+'>❄️ C (سرد)</option>'
    +'</select></div>'
    +'</div>'
    +'<label style="font-size:10px;display:block;margin-bottom:3px">💰 ارزش فرصت (میلیون ریال)</label>'
    +'<input type="number" min="0" step="1" value="'+(e.oppValue||'')+'" placeholder="مثلاً: 150" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'oppValue\',parseFloat(this.value)||0)" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'</div>'
    // ── بخش مشتری (فقط وقتی lead=مشتری) ──
    +'<div id="cmCustSection_'+id+'" style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-top:6px;'+(lead==='مشتری'?'':'display:none')+'">'
    +'<div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">🏆 اطلاعات مشتری</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">وضعیت مشتری</label>'
    +'<select class="ed-sel" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'customerStatus\',this.value)">'
    +'<option value="">خودکار</option>'
    +'<option value="new"'+(e.customerStatus==='new'?' selected':'')+'>🆕 جدید</option>'
    +'<option value="active_new"'+(e.customerStatus==='active_new'?' selected':'')+'>✨ فعال - جدید</option>'
    +'<option value="active"'+(e.customerStatus==='active'?' selected':'')+'>✅ فعال</option>'
    +'<option value="dormant"'+(e.customerStatus==='dormant'?' selected':'')+'>😴 خوابیده (+90 روز)</option>'
    +'<option value="lost"'+(e.customerStatus==='lost'?' selected':'')+'>❌ از دست رفته</option>'
    +'</select></div>'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">📅 آخرین خرید</label>'
    +'<input type="text" id="cmLastPurch_'+id+'" value="'+(e.lastPurchaseDate||'')+'" readonly class="fd-inp" style="cursor:pointer;width:100%;box-sizing:border-box" placeholder="انتخاب تاریخ" onclick="openJDP(this,function(v){_cmSetLastPurch(\''+rtype+'\',\''+r.id+'\',\''+id+'\',v);})">'
    +'</div></div>'
    +(function(){var _cs=_computeCustomerStatus(rtype,r.id);return _cs==='dormant'?'<div style="font-size:10px;background:#fef9c3;border:1px solid #fde047;border-radius:5px;padding:4px 8px;color:#92400e">⚠️ مشتری خوابیده — بیش از ۹۰ روز از آخرین خرید گذشته</div>':'';})()+''
    +'</div>'
    +'<label>تاریخ پیگیری بعدی</label>'
    +'<div style="display:flex;gap:5px;align-items:center">'
    +'<input id="mfd_'+id+'" type="text" value="'+fd+'" readonly class="fd-inp'+(fd&&fd<today?' ov':'')+'" style="cursor:pointer;flex:1" '
    +'onclick="openJDP(this,function(v){var _in=document.getElementById(\'mfd_'+id+'\');if(_in){_in.value=v;_in.className=\'fd-inp\'+(v&&v<todayStr()?\'ov\':\'\');}setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',v);var _lbl=document.getElementById(\'mfd_wk_'+id+'\');if(_lbl){_lbl.textContent=v?\' (\'+getWeekLabelForDate(v)+\')\':\'\';}renderBanner();if(currentTab===\'provinces\'&&_currentProvId)renderTable();if(currentTab===\'weekplan\')setTimeout(renderWeekPlan,80);})">'
    +(fd?'<button onclick="setE(\''+rtype+'\',\''+r.id+'\',\'followupDate\',\'\');document.getElementById(\'mfd_'+id+'\').value=\'\';document.getElementById(\'mfd_'+id+'\').className=\'fd-inp\';var _lbl=document.getElementById(\'mfd_wk_'+id+'\');if(_lbl){_lbl.textContent=\'\';}renderBanner();if(currentTab===\'provinces\'&&_currentProvId)renderTable();if(currentTab===\'weekplan\')setTimeout(renderWeekPlan,80);" title="حذف تاریخ" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:11px;white-space:nowrap">✕ حذف</button>':'')
    +'<button onclick="convertFollowupToTask(\''+esc(rtype)+'\',\''+esc(r.id)+'\')" title="تبدیل به وظیفه" style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:11px;white-space:nowrap">📌 وظیفه</button>'
    +'</div>'
    +'<div id="mfd_wk_'+id+'" style="font-size:11px;color:var(--text-muted);margin-top:2px;font-weight:700">'+(fd?' ('+getWeekLabelForDate(fd)+')':'')+'</div>'
    +'<label>برچسب‌ها</label>'
    +'<div id="tagArea_'+id+'" style="display:flex;flex-wrap:wrap;gap:4px;padding:7px;background:var(--bg-raised);border-radius:6px;min-height:30px;border:1px solid var(--border)">'
    +tgs.map(function(tid){var t=tagById(tid);return t?'<span class="tag-badge" style="background:'+_safeColor(t.color)+';display:inline-flex;align-items:center;gap:3px">'+esc(t.name)+'<button onclick="removeCenterTag(event,\''+rtype+'\',\''+r.id+'\',\''+tid+'\')" style="background:rgba(0,0,0,.2);border:none;color:var(--text-primary);width:14px;height:14px;border-radius:50%;cursor:pointer;font-size:9px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">✕</button></span>':'';}).join('')
    +'<button class="tag-add-btn" style="width:24px;height:24px;line-height:22px;font-size:14px" onclick="openTagMenu(event,\''+rtype+'\',\''+r.id+'\')">+</button>'
    +'</div>'
        // ── بخش اطلاعات تماس ──
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:10px 12px;margin-top:6px;border:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">'
    +'<span>📞 اطلاعات تماس</span>'
    +'<button onclick="if(typeof _hcpOpenLinkModal===\'function\')_hcpOpenLinkModal(\''+rtype+'\',\''+r.id+'\',\''+id+'\');else addContact(\''+rtype+'\',\''+r.id+'\',\''+id+'\')" style="padding:3px 10px;border-radius:6px;border:none;background:#0ea5e9;color:#fff;font-size:11px;font-family:inherit;cursor:pointer;font-weight:700">+ افزودن مخاطب</button>'
    +'</div>'
    +'<div id="contactsArea_'+id+'">⏳ در حال بارگذاری پزشکان متصل...</div>'
    // آدرس
    +'<label style="font-size:10px;margin-top:8px;display:block">آدرس</label>'
    +'<textarea id="maddr_'+id+'" placeholder="آدرس کامل مرکز..." rows="2" style="width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;resize:vertical;background:var(--bg-input);color:var(--text-primary);direction:rtl" '
    +'onchange="setE(\''+rtype+'\',\''+r.id+'\',\'address\',this.value)">'+esc(e.address||'')+'</textarea>'
    +'<button onclick="var _v=document.getElementById(\'maddr_\'+\''+id+'\').value.trim();if(_v)window.open(\'https://www.google.com/maps/search/?api=1&query=\'+encodeURIComponent(_v),\'_blank\');else showToast(\'آدرس را وارد کنید\')" style="background:#f0f9ff;color:#0369a1;border:1px solid #7dd3fc;border-radius:5px;padding:3px 10px;font-size:11px;font-family:inherit;cursor:pointer;margin-top:4px">🗺 نقشه</button>'
    +'</div>'
    +'<div style="background:var(--bg-raised);border-radius:8px;padding:8px 12px;margin-top:6px;border:1px solid var(--border)">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end">'
    +'<div><label style="font-size:10px;display:block;margin-bottom:3px">🤖 رقیب اصلی</label>'
    +'<input type="text" list="compDatalist_'+r.id+'" value="'+esc(e.competitor||'')+'" placeholder="نام رقیب / برند..." onchange="setE(\''+rtype+'\',\''+r.id+'\',\'competitor\',this.value)" style="width:100%;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:11px;background:var(--bg-input);color:var(--text-primary)"><datalist id="compDatalist_'+r.id+'">'+_getCompetitorList().map(function(c){return'<option value="'+esc(c)+'">';}).join('')+'</datalist></div>'
    +'<div id="cmCommission_'+r.id+'" style="font-size:10px;color:var(--text-muted);padding:4px 0"></div>'
    +'</div>'
    // ── جزئیات رقیب ──
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">'
    +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">💪 مزیت رقیب</label>'
    +'<input type="text" value="'+(e.competitorAdvantage||'')+'" placeholder="مثلاً: قیمت پایین‌تر" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'competitorAdvantage\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"></div>'
    +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">🎯 دلیل خرید از رقیب</label>'
    +'<input type="text" value="'+(e.buyReasonFromCompetitor||'')+'" placeholder="مثلاً: رابطه قدیمی" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'buyReasonFromCompetitor\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"></div>'
    +'</div></div>'
    +(function(){
      if(e.lead!=='سرنخ'&&e.lead!=='فرصت')return '';
      var pm=e.purchaseMethod||'';
      var pt=e.paymentTerms||'';
      return '<div style="background:var(--bg-raised);border-radius:8px;padding:8px 12px;margin-top:6px;border:1px solid var(--border)">'
        +'<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px">📋 اطلاعات Prospect</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
        +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">📦 میزان مصرف تقریبی</label>'
        +'<input type="text" value="'+(e.approxConsumption||'')+'" placeholder="مثلاً: ۵۰ عدد/ماه" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'approxConsumption\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"></div>'
        +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">🛒 نحوه خرید</label>'
        +'<select onchange="setE(\''+rtype+'\',\''+r.id+'\',\'purchaseMethod\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
        +['','مستقیم','توزیع‌کننده','بیمارستانی','مناقصه'].map(function(v){return'<option'+(v===pm?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div>'
        +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">💳 شرایط پرداخت</label>'
        +'<select onchange="setE(\''+rtype+'\',\''+r.id+'\',\'paymentTerms\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
        +['','نقدی','۳۰ روزه','۶۰ روزه','۹۰ روزه','اعتباری'].map(function(v){return'<option'+(v===pt?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div>'
        +'<div><label style="font-size:9px;color:var(--text-muted);display:block;margin-bottom:2px">📅 زمان تقریبی سفارش</label>'
        +'<input type="text" value="'+(e.approxOrderTime||'')+'" placeholder="مثلاً: اسفند ۱۴۰۳" onchange="setE(\''+rtype+'\',\''+r.id+'\',\'approxOrderTime\',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border-input);border-radius:4px;font-size:10px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)"></div>'
        +'</div></div>';
    })()
    +'<div id="cmPricingInfo_'+r.id+'" style="background:var(--bg-raised);border-radius:8px;padding:8px 12px;margin-top:6px;border:1px solid var(--border);font-size:11px"><span style="color:var(--text-muted)">در حال بارگذاری قیمت‌گذاری...</span></div>'
   // برنامه هفته
    +(wkEntries.length?'<label>برنامه هفته</label><div style="background:var(--bg-raised);border-radius:5px;padding:7px;font-size:11px">'
    +wkEntries.map(function(we){
      var wt=DB.weekTags.find(function(w){return w.id===we.weekTagId;});
      var actType = we.actionType || 'call';
      var actIcon = actType === 'visit' ? '🤝 ویزیت' : '📞 تماس';
      return'<div style="display:flex;gap:7px;align-items:center;padding:2px 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-weight:600">'+(wt?esc(wt.name):'هفته')+'</span>'
        +'<span>→ '+(we.scheduledDate||'بدون تاریخ')+'</span>'
        +'<span style="font-size:9px;background:#e2e8f0;color:var(--text-primary);padding:2px 5px;border-radius:4px">'+actIcon+'</span>'
        +(we.done?'<span style="color:#16a34a;font-weight:bold">✓ '+we.doneDate+'</span>':'')
        +'</div>';}).join('')+'</div>':'')
    // ── یادداشت / گزارش ──
    +(function(){
      var allTags=DB.tags||[];
      var tagChips=allTags.length
        ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px" id="mnoteTagRow_'+id+'">'
          +allTags.map(function(t){
            return '<span onclick="_noteToggleTag(\''+id+'\',\''+t.id+'\')" data-tagid="'+t.id+'" '
              +'style="cursor:pointer;padding:2px 8px;border-radius:9px;font-size:10px;font-weight:600;border:1.5px solid var(--border);color:var(--text-secondary);background:var(--bg-raised);transition:all .15s" '
              +'class="note-tag-chip">'+esc(t.name)+'</span>';
          }).join('')
          +'</div>'
        :'';
      return '<div style="margin-top:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
        +'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">'
        +'<span>📝 یادداشت / گزارش</span>'
        +'<span style="font-size:9px;font-weight:400;color:var(--text-muted)">Enter = ثبت &nbsp; Shift+Enter = خط جدید</span>'
        +'</div>'
        +'<textarea id="mnote_'+id+'" rows="4" placeholder="گزارش تماس، نتیجه ویزیت، توضیحات..." style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--border-input);border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;line-height:1.6" onkeydown="_noteKeydown(event,\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')"></textarea>'
        +tagChips
        +'<div style="display:flex;justify-content:flex-end;margin-top:8px">'
        +'<button class="btn-primary" onclick="addNoteFromModal(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">✓ ثبت</button>'
        +'</div>'
        +'<div id="mNotesList_'+id+'" style="margin-top:10px">'
        +_renderNotesList(notes)
        +'</div></div>';
    })();

  var _ckWork=recK(rtype,r.id);
  var _snWork=displayName.replace(/'/g,'&#39;');
  body+='<div id="cmWorkSec_'+id+'" style="margin-top:10px;padding:10px 12px;background:#f5f3ff;border-radius:8px;border:1px solid #ddd6fe">'
    +'<div style="font-size:11px;font-weight:700;color:#6d28d9;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
    +'<span>📌 وظایف و تیکت‌های باز</span>'
    +'<span style="display:flex;gap:4px">'
    +'<button type="button" onclick="_openTaskModalLazy(null,{centerKey:\''+_ckWork+'\',title:\'وظیفه: '+esc(displayName)+'\'})" style="font-size:10px;padding:3px 10px;background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;border-radius:5px;cursor:pointer;font-family:inherit">+ وظیفه</button>'
    +'<button type="button" onclick="_openSupportNewForCenterLazy(\''+_ckWork+'\',\''+_snWork+'\')" style="font-size:10px;padding:3px 10px;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:5px;cursor:pointer;font-family:inherit">+ تیکت</button>'
    +'</span></div>'
    +'<div id="cmWorkInner_'+id+'" style="font-size:11px;color:#94a3b8">در حال بارگذاری…</div>'
    +'</div>';

  // ── change history section ──
  var rkey=rtype+'_'+r.id;
  var hist=(DB.changeLog||[]).filter(function(h){return h.rkey===rkey;}).slice(-5).reverse();
  var fNames={status:'وضعیت',followupDate:'تاریخ پیگیری',contactName:'مخاطب',owner:'کارشناس',notes:'یادداشت',lead:'سرنخ',potential:'پتانسیل'};
  body+='<div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:8px;border:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">📋 تغییرات اخیر</div>'
    +(hist.length?hist.map(function(h){
      var d=new Date(h.at);var jd=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      var ds=jd[0]+'/'+p2(jd[1])+'/'+p2(jd[2]);
      return'<div style="font-size:10.5px;color:var(--text-muted);padding:3px 0;border-bottom:1px solid var(--border)">'
        +'<span style="color:var(--text-secondary)">'+esc(fNames[h.field]||h.field)+'</span>'
        +' ← '+esc(String(h.val||'—').substring(0,30))
        +' <span style="opacity:.6;margin-right:4px">'+esc(h.by||'')+' · '+ds+'</span></div>';
    }).join(''):'<div style="font-size:11px;color:var(--text-muted)">هنوز تغییری ثبت نشده</div>')
    +'</div>';

  var canDelete = (id.indexOf('_new_') >= 0) || _canEdit('provinces');
  var foot=(canDelete ? '<button style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="closeModal(\'cm_'+id+'\');confirmDeleteCenter(\''+rtype+'\',\''+id+'\',\''+esc(displayName)+'\')">🗑 حذف</button>' : '')
    +'<button style="background:#faf5ff;color:#7c3aed;border:1px solid #d8b4fe;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openPreCallBrief(\''+rtype+'\',' +'\''+r.id+'\')">🎯 خلاصه</button>'
    +'<button style="background:#f0f9ff;color:#0369a1;border:1px solid #7dd3fc;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openCenterAudit(\''+recK(rtype,r.id)+'\',\''+esc(displayName)+'\')">📋 تاریخچه</button>'
    +(_canEdit('provinces') ? '<button style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openMergeCenterModal(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">🔀 ادغام</button>' : '')
    +(_isManager()?'<button style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" onclick="openChangeProvinceModal(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">🗺 تغییر استان</button>':'')
    +'<button style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit" id="pfBtn_'+id+'">📄 پیشفاکتورها</button>'
    +'<button class="btn-secondary" onclick="closeModal(\'cm_'+id+'\')">بستن</button>'
    +'<button class="btn-primary" onclick="openAssignWeekForCenter(\''+rtype+'\',\''+r.id+'\',\''+esc(displayName)+'\')">📋 اضافه به هفته</button>';
  // ── مطالبات section ──
  if(typeof mtrCenterSection==='function'){
    if(typeof DATA!=='undefined'&&DATA.length&&!Object.keys(MTR_BY_CENTER).length)matchCentersToData();
    var mtrHtml=mtrCenterSection(r.id);
    if(mtrHtml) body+=mtrHtml;
  }
  openModal('cm_'+id,'🏥 '+esc(displayName),body,foot,{lg:true});
  // Wire up proforma button (DOM, no onclick string)
  (function(_ck4,_mid4,_nm4){
    setTimeout(function(){
      var _pfBtn=document.getElementById('pfBtn_'+_mid4);
      if(_pfBtn){
        _pfBtn.addEventListener('click',function(){
          if(typeof pfOpenForCenter==='function')pfOpenForCenter(_ck4,_nm4);
          if(typeof closeModal==='function')closeModal('cm_'+_mid4);
        });
      }
      // Append mini proforma list section
      var _modal4=document.getElementById('cm_'+_mid4); if(!_modal4)return;
      var _bd4=_modal4.querySelector('.modal-body')||_modal4;
      if(document.getElementById('cmPfSec_'+_mid4))return;
      var _sec=document.createElement('div');
      _sec.id='cmPfSec_'+_mid4;
      _sec.style.cssText='margin-top:14px;padding:12px 14px;background:#f5f3ff;border-radius:10px;border:1px solid #ddd6fe';
      var _hdr=document.createElement('div');
      _hdr.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
      var _ttl=document.createElement('span');
      _ttl.style.cssText='font-weight:700;font-size:12px;color:#6d28d9';
      _ttl.textContent='📄 پیشفاکتورهای این مرکز';
      var _lnk=document.createElement('button');
      _lnk.textContent='مشاهده همه ←';
      _lnk.style.cssText='font-size:11px;color:#6d28d9;background:none;border:none;cursor:pointer;text-decoration:underline';
      _lnk.addEventListener('click',function(){
        if(typeof pfOpenForCenter==='function')pfOpenForCenter(_ck4,_nm4);
        if(typeof closeModal==='function')closeModal('cm_'+_mid4);
      });
      _hdr.appendChild(_ttl); _hdr.appendChild(_lnk);
      var _body=document.createElement('div');
      _body.id='cmPfInner_'+_mid4;
      _body.style.cssText='font-size:12px;color:#94a3b8';
      _body.textContent='در حال بارگذاری…';
      _sec.appendChild(_hdr); _sec.appendChild(_body); _bd4.appendChild(_sec);
      fetch('/api/proforma?center='+encodeURIComponent(_ck4)).then(function(r2){return r2.ok?r2.json():[];}).then(function(lst){
        var _ei=document.getElementById('cmPfInner_'+_mid4); if(!_ei)return;
        if(!lst||!lst.length){_ei.innerHTML='<span style="color:#94a3b8">پیشفاکتوری ثبت نشده</span>';return;}
        var sc={draft:'#6366f1',sent:'#0284c7',approved:'#15803d',rejected:'#dc2626',cancelled:'#9ca3af'};
        var sl={draft:'پیش‌نویس',sent:'ارسال',approved:'تأیید',rejected:'رد',cancelled:'لغو'};
        _ei.innerHTML=lst.slice(0,5).map(function(pf){
          return '<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #ede9fe">'+
            '<span style="font-family:monospace;font-size:11px;color:#0284c7;flex-shrink:0">'+(pf.no||'')+'</span>'+
            '<span style="font-size:10px;color:#94a3b8;flex-shrink:0">'+(pf.jalaliDate||'')+'</span>'+
            '<span style="font-size:10px;color:'+(sc[pf.status]||'#6b7280')+';font-weight:700">'+(sl[pf.status]||pf.status)+'</span>'+
            '<span style="font-size:11px;font-weight:700;margin-right:auto">'+Number(pf.total||0).toLocaleString('fa-IR')+' ریال</span></div>';
        }).join('')+(lst.length>5?'<div style="text-align:center;color:#94a3b8;font-size:10px;margin-top:4px">+ '+(lst.length-5)+' مورد دیگر</div>':'');
      }).catch(function(){});
    },150);
  })(recK(rtype,r.id), id, displayName);
  setTimeout(function(){_loadCenterWorkItems(rtype, id);},30);
  if(typeof _hcpLoadCenterAffiliations==='function'){setTimeout(function(){_hcpLoadCenterAffiliations(rtype,r.id,id);},20);}
  if(window.umGetColor){setTimeout(function(){document.querySelectorAll('.owner-dot[data-uid]').forEach(function(d){var u=decodeURIComponent(d.dataset.uid);if(u)d.style.background=umGetColor(u);});},0);}
  // ── قیمت‌گذاری ──
  (function(_rid,_centerKey,_rname){
    fetch('/api/pricing/center/'+encodeURIComponent(_centerKey))
      .then(function(res){return res.json();})
      .then(function(cfg){
        var el=document.getElementById('cmPricingInfo_'+_rid);
        if(!el)return;
        var BUYER_FA={'public_hospital':'بیمارستان دولتی','private_hospital':'بیمارستان خصوصی','clinic':'کلینیک','lab':'آزمایشگاه','pharmacy':'داروخانه','other':'سایر'};
        if(!cfg){el.innerHTML='<span style="color:var(--text-muted);font-size:10px">اطلاعات قیمت‌گذاری یافت نشد</span>';return;}
        var parts=[];
        if(cfg.buyer_type)parts.push('🏷 نوع خریدار: <b>'+(BUYER_FA[cfg.buyer_type]||cfg.buyer_type)+'</b>');
        if(cfg.commission_level)parts.push('💼 سطح پورسانت: <b>'+cfg.commission_level+'</b>');
        if(parseFloat(cfg.discount_ceiling_pct)>0)parts.push('⬇ سقف تخفیف: <b>'+cfg.discount_ceiling_pct+'%</b>');
        if(cfg.payment_terms)parts.push('📅 شرایط پرداخت: <b>'+cfg.payment_terms+'</b>');
        el.innerHTML=parts.length?'<div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:5px">💰 قیمت‌گذاری</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+parts.map(function(p){return'<span style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;padding:2px 7px;color:var(--text-primary)">'+p+'</span>';}).join('')+'</div>':'<span style="color:var(--text-muted);font-size:10px">قیمت‌گذاری تنظیم نشده</span>';
  var elCom=document.getElementById('cmCommission_'+_rid);
  if(elCom){
    var _curLvl=cfg&&cfg.commission_level?String(cfg.commission_level):'';
    var _ckEsc=esc(_centerKey);
    elCom.innerHTML='<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><label style="font-size:10px;color:var(--text-muted);flex-shrink:0">💼 پورسانت:</label><select onchange="fetch(\'/api/pricing/center/\'+encodeURIComponent(\''+_ckEsc+'\'),{method:\'PUT\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({commission_level:this.value||null})}).then(function(){showToast(\'💼 سطح پورسانت ذخیره شد\');}).catch(function(){showToast(\'خطا در ذخیره پورسانت\');})" style="font-size:10px;padding:2px 5px;border:1px solid var(--border-input);border-radius:4px;background:var(--bg-input);font-family:inherit;color:var(--text-primary)"><option value="">---</option><option value="1"'+(_curLvl==='1'?' selected':'')+'>سطح ۱</option><option value="2"'+(_curLvl==='2'?' selected':'')+'>سطح ۲</option><option value="3"'+(_curLvl==='3'?' selected':'')+'>سطح ۳</option></select>'+(function(){var _owId=e.owner||r.owner||'';var _owM=_DEFAULT_MEMBERS&&_DEFAULT_MEMBERS.find(function(mm){return mm.id===_owId;});return(_owM&&_owM.commissionPct)?'<span style="font-size:10px;color:#7c3aed;background:#f5f3ff;border:1px solid #e9d5ff;border-radius:4px;padding:1px 6px">👤 نرخ کارشناس: '+_owM.commissionPct+'٪</span>':'';})()+'</div><div id="cmCommPreview_'+_rid+'" style="font-size:10px;color:var(--text-muted)"></div></div>';
    if(_curLvl){
      fetch('/api/pricing/center/'+encodeURIComponent(_centerKey)+'/commissions').then(function(r){return r.ok?r.json():[];}).then(function(rows){
        var pv=document.getElementById('cmCommPreview_'+_rid);if(!pv)return;
        if(!rows||!rows.length){pv.textContent='قوانین پورسانت برای این سطح ثبت نشده';return;}
        pv.innerHTML=rows.slice(0,5).map(function(row){
          return '<span style="display:inline-block;margin:2px 4px 0 0;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:1px 6px">'+esc(row.product_name||('#'+row.product_id))+': <b>'+Number(row.amount||0).toLocaleString('fa-IR')+'</b> ریال</span>';
        }).join('')+(rows.length>5?'<span style="color:var(--text-muted)"> +'+ (rows.length-5)+' محصول</span>':'');
      }).catch(function(){});
    }
  }
      }).catch(function(){var el=document.getElementById('cmPricingInfo_'+_rid);if(el)el.style.display='none';});
  })(id, recK(rtype,r.id), displayName);
}

function _mrgSearch(){
  var q=document.getElementById('_mrgQ');
  var list=document.getElementById('_mrgList');
  if(!q||!list)return;
  var v=(q.value||'').trim();
  var all=window._mrgAll||[];
  var res=v?all.filter(function(c){return fNorm(c.name).indexOf(fNorm(v))>=0;}).slice(0,30):[];
  if(!res.length){
    list.innerHTML='<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted)">'+(v?'نتیجه‌ای یافت نشد':'نام مرکز هدف را تایپ کنید')+'</div>';
    return;
  }
  var srcType=window._mrgSrcType||'';
  var srcId=window._mrgSrcId||'';
  var srcName=window._mrgSrcName||'';
  list.innerHTML=res.map(function(c){
    return '<div style="padding:7px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px"'
      +' onmouseenter="this.style.background=\'var(--bg-hover)\'"'
      +' onmouseleave="this.style.background=\'\'"'
      +' onclick="doMergeCenter(\''+srcType+'\',\''+srcId+'\',\''+srcName+'\',\''+c.rtype+'\',\''+c.id+'\',\''+esc(c.name)+'\')">'
      +esc(c.name)+'<span style="font-size:10px;color:var(--text-muted);margin-right:6px">'+c.id+'</span></div>';
  }).join('');
}
function openMergeCenterModal(rtype,id,name){
  closeAllModals();
  var allCenters=[];
  (window.CENTERS||[]).forEach(function(c){if(c.id!==id)allCenters.push({rtype:'center',id:c.id,name:c.name||c.id});});
  var provs=typeof getAllProvinces==='function'?getAllProvinces():[];
  provs.forEach(function(p){
    var arr=typeof getProvCenters==='function'?getProvCenters(p.id):[];
    arr.forEach(function(c){
      if(c.id!==id)allCenters.push({rtype:c.rtype,id:c.id,name:c.name||c.id});
    });
  });
  window._mrgAll=allCenters;
  window._mrgSrcType=rtype;
  window._mrgSrcId=id;
  window._mrgSrcName=esc(name);
  var body='<div style="margin-bottom:10px;font-size:13px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:8px 12px">'
    +'<strong>'+esc(name)+'</strong> حذف می‌شود — مخاطبین و یادداشت‌ها به مرکز هدف منتقل می‌شود.</div>'
    +'<input id="_mrgQ" type="text" placeholder="جستجوی مرکز هدف..." oninput="_mrgSearch()" '
    +'style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-input);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);margin-bottom:6px">'
    +'<div id="_mrgList" style="border:1px solid var(--border);border-radius:6px;max-height:300px;overflow-y:auto">'
    +'<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted)">نام مرکز هدف را تایپ کنید</div></div>';
  openModal('_mrgModal','🔀 ادغام مرکز',body,'<button class="btn-secondary" onclick="closeModal(\'_mrgModal\')">لغو</button>',{lg:false});
  setTimeout(function(){var q=document.getElementById('_mrgQ');if(q)q.focus();},100);
}
function doMergeCenter(srcType,srcId,srcName,tgtType,tgtId,tgtName){
  if(!confirm('ادغام «'+srcName+'» به داخل «'+tgtName+'»?\nاین مرکز حذف خواهد شد.'))return;
  closeModal('_mrgModal');
  showToast('در حال ادغام...');
  fetch('/api/data/centers/merge',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sourceType:srcType,sourceId:srcId,targetType:tgtType,targetId:tgtId})
  }).then(function(r){return r.json();})
  .then(function(d){
    if(d.ok){showToast('\u2705 ادغام انجام شد');loadDB().then(function(){switchTab(currentTab);});}
    else showToast('\u274C خطا: '+(d.error||'نامشخص'));
  })
  .catch(function(){showToast('\u274C خطای ارتباط');});
}

function openChangeProvinceModal(rtype,id,name){
  if(!_isManager()){showToast('⚠ فقط مدیران دسترسی دارند');return;}
  _buildPCCache();
  var DB_provOverrides=DB.provOverrides||{};
  var rkey=rtype+'_'+id;
  var currentPO=DB_provOverrides[rkey]||'';
  var provList=getAllProvinces();
  var provOpts=provList.map(function(p){return '<option value="'+p.id+'"'+(currentPO===p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');
  var body='<div style="font-size:12px">'
    +'<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin-bottom:12px">⚠ تغییر استان در دیتابیس دشما ذخیره می‌شود.</div>'
    +'<label style="display:block;margin-bottom:8px">استان جدید برای <strong>'+esc(name)+'</strong>:</label>'
    +'<select id="_cprovSel" style="width:100%;padding:8px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)">'
    +'<option value="">— بدون تغییر (پیش‌فرض) —</option>'
    +provOpts
    +'</select></div>';
  openModal('_cprovModal','🗺 تغییر استان',body,'<button class="btn-secondary" onclick="closeModal(\'_cprovModal\')">لغو</button><button class="btn-primary" onclick="_doChangeProvince(\''+rtype+'\',\''+id+'\')">\u0630\u062e\u06cc\u0631\u0647 \u2705</button>',{lg:false});
}
function _doChangeProvince(rtype,id){
  var sel=document.getElementById('_cprovSel');
  if(!sel)return;
  var newProv=sel.value;
  DB.provOverrides=DB.provOverrides||{};
  var rkey=rtype+'_'+id;
  if(newProv)DB.provOverrides[rkey]=newProv;
  else delete DB.provOverrides[rkey];
  clearPCCache();
  saveDB();
  closeModal('_cprovModal');
  closeModal('cm_' + id);
  showToast('\u2705 \u0627\u0633\u062a\u0627\u0646 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f');
  setTimeout(function(){renderDashboard();if(currentTab==='provinces')renderTable();},300);
}

function confirmDeleteCenter(rtype,id,name){
  closeAllModals();
  var isExtra=(id.indexOf('_new_')>=0);
  var body='<div style="text-align:center;padding:10px 0">'
    +'<div style="font-size:36px;margin-bottom:12px">🗑</div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px">حذف مرکز</div>'
    +'<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">«<strong>'+esc(name)+'</strong>»</div>'
    +'<div style="background:'+(isExtra?'#fef3c7':'#fef2f2')+';border:1px solid '+(isExtra?'#fcd34d':'#fca5a5')+';border-radius:7px;padding:10px;font-size:12px;color:'+(isExtra?'#92400e':'#991b1b')+';text-align:right">'
    +(isExtra
      ?'این مرکز به صورت دستی اضافه شده. حذف می‌شود.<br>داده‌های CRM (وضعیت، یادداشت) باقی می‌مانند.'
      :'این مرکز از دیتابیس اصلی حذف می‌شود.<br>داده‌های CRM (وضعیت، یادداشت) باقی می‌مانند.')
    +'</div></div>';
  var foot='<button class="btn-secondary" onclick="closeModal(\'delCenterModal\')">لغو</button>'
    +'<button style="background:#dc2626;color:var(--text-primary);border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600" '
    +'onclick="_doDeleteCenter(\''+rtype+'\',\''+id+'\')">🗑 حذف کن</button>';
  openModal('delCenterModal','حذف مرکز',body,foot);
}

function _doDeleteCenter(rtype,id){
  var isExtra=(id.indexOf('_new_')>=0);
  // پاک‌سازی داده‌های وابسته
  _cleanCenterData(rtype,id);
  if(isExtra){
    DB.extra=(DB.extra||[]).filter(function(c){return c.id!==id;});
    saveDB();closeModal('delCenterModal');
    clearPCCache();_ALL_PROVS=null;renderTable();
    showToast('✅ مرکز حذف شد');return;
  }
  // حذف از حافظه (CENTERS یا PC_RAW) و ذخیره روی سرور
  if(rtype==='center'){
    for(var _ci=CENTERS.length-1;_ci>=0;_ci--){
      var _cc=CENTERS[_ci];
      var _cid='c_'+(_cc.row||_cc.id||'');
      if(_cid===id||String(_cc.id)===String(id)){CENTERS.splice(_ci,1);break;}
    }
  }else{
    var _provId=id.split('||')[0];
    var _row=Number(id.split('||')[1]);
    PROVINCES.forEach(function(p){
      if(p.id===_provId){
        var _pname=p.name.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک');
        if(PC_RAW[_pname]){PC_RAW[_pname]=PC_RAW[_pname].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
        if(PC_RAW[p.id]){PC_RAW[p.id]=PC_RAW[p.id].filter(function(r){return(Array.isArray(r)?r[0]:r.row)!==_row;});}
      }
    });
  }
  clearPCCache();_ALL_PROVS=null;_typeFilterBuilt=false;
  var _newCENTERS=CENTERS.slice();
  var _newPC_RAW={};Object.keys(PC_RAW).forEach(function(k){_newPC_RAW[k]=PC_RAW[k];});
  fetch('/api/data/centers/master',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({CENTERS:_newCENTERS,PC_RAW:_newPC_RAW})
  }).then(function(r){
    if(!r.ok)console.error('[delete center] server save failed:',r.status);
    rebuildFilters();renderTable();
    closeModal('delCenterModal');
    showToast('✅ مرکز از دیتابیس حذف شد');
  }).catch(function(e){
    console.error('[delete center]',e.message);
    rebuildFilters();renderTable();
    closeModal('delCenterModal');
    showToast('✅ مرکز حذف شد');
  });
}

// پاک‌سازی weekEntries و followupDate مرکز حذف‌شده
function _cleanCenterData(rtype,id){
  var recKey=rtype+'_'+id;
  // حذف از weekEntries
  Object.keys(DB.weekEntries||{}).forEach(function(k){
    var we=DB.weekEntries[k];
    if(we.recKey===recKey||(we.rtype===rtype&&we.rid===id))
      _weRemove(k);
  });
  // حذف followupDate از DB.edits (بقیه CRM حفظ می‌شه)
  if(DB.edits[recKey])delete DB.edits[recKey].followupDate;
  saveDB();
}

// Note pending tags: {modalId: [tagId,...]}
var _notePendingTags = {};
// ── VoIP / SIP helper ────────────────────────────────────────────────────────
function _sipDomain(){ return (DB.settings&&DB.settings.sipDomain)||''; }
function _phoneHref(num){
  if(!num)return'tel:';
  var clean=String(num).replace(/\s/g,'');
  var sip=_sipDomain();
  if(sip) return 'sip:'+clean+'@'+sip;
  return 'tel:'+clean;
}
function _phoneTitle(){ return _sipDomain()?'تماس VoIP (Linphone)':'تماس تلفنی'; }


function _noteToggleTag(modalId, tagId){
  if(!_notePendingTags[modalId])_notePendingTags[modalId]=[];
  var arr=_notePendingTags[modalId];
  var idx=arr.indexOf(tagId);
  if(idx>=0){arr.splice(idx,1);}else{arr.push(tagId);}
  // Update chip styles
  var row=document.getElementById('mnoteTagRow_'+modalId);
  if(!row)return;
  row.querySelectorAll('.note-tag-chip').forEach(function(chip){
    var tid=chip.dataset.tagid;
    var sel=arr.indexOf(tid)>=0;
    var t=(DB.tags||[]).find(function(x){return String(x.id)===String(tid);});
    var col=t?(t.color||'#6366f1'):'#6366f1';
    chip.style.background=sel?col:'var(--bg-raised)';
    chip.style.color=sel?'#fff':'var(--text-secondary)';
    chip.style.borderColor=sel?col:'var(--border)';
  });
}

function _noteKeydown(ev,type,id,name){
  if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();addNoteFromModal(type,id,name);}
}

function _renderNotesList(notes){
  if(!notes||!notes.length) return '<div style="text-align:center;padding:10px;font-size:11px;color:var(--text-muted)">هنوز یادداشتی ثبت نشده</div>';
  return notes.slice().reverse().map(function(n,i){
    var lines=esc(n.text||'').replace(/\n/g,'<br>');
    var isFirst=i===0;
    var tagBadges='';
    if(n.noteTags&&n.noteTags.length){
      tagBadges='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">'
        +n.noteTags.map(function(tid){
          var t=(DB.tags||[]).find(function(x){return x.id===tid;});
          if(!t)return'';
          var col=t.color||'#6366f1';
          return'<span style="background:'+col+'22;color:'+col+';border:1px solid '+col+'55;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700">'+esc(t.name)+'</span>';
        }).join('')
        +'</div>';
    }
    return '<div class="note-item" style="'+(isFirst?'border-right:3px solid #6366f1;':'')+'padding-right:8px;margin-bottom:8px">'
      +'<div style="font-size:12px;line-height:1.6;color:var(--text-primary)">'+lines+'</div>'
      +tagBadges
      +'<div class="note-meta" style="margin-top:3px"><span style="font-weight:600">'+esc(n.by||n.user||'')+'</span>'
      +'<span style="margin-right:6px">'+esc(n.date||(n.at?msToJ(n.at):'')||'')+'</span></div></div>';
  }).join('');
}

function addNoteFromModal(type,id,name){
  var inp=document.getElementById('mnote_'+id);
  if(!inp||!inp.value.trim())return;
  var tags=(_notePendingTags[id]||[]).slice();
  var k=recK(type,id);
  if(typeof postCenterNote==='function'){
    postCenterNote(k, inp.value.trim(), { date: todayStr(), noteTags: tags.length ? tags : undefined }).then(function(d){
      if(d&&d.notes)DB.notes[k]=d.notes;
      inp.value='';inp.style.height='auto';
      _notePendingTags[id]=[];
      var row=document.getElementById('mnoteTagRow_'+id);
      if(row)row.querySelectorAll('.note-tag-chip').forEach(function(c){c.style.background='var(--bg-raised)';c.style.color='var(--text-secondary)';c.style.borderColor='var(--border)';});
      var nl=document.getElementById('mNotesList_'+id);
      if(nl)nl.innerHTML=_renderNotesList(DB.notes[k]||[]);
      showToast('یادداشت ذخیره شد ✅',1500);
    }).catch(function(){showToast('خطا در ذخیره یادداشت');});
    return;
  }
  addNote(type,id,inp.value.trim(),null);
  if(tags.length){var arr=DB.notes[k];if(arr&&arr.length)arr[arr.length-1].noteTags=tags;}
  // clear
  inp.value='';inp.style.height='auto';
  _notePendingTags[id]=[];
  var row=document.getElementById('mnoteTagRow_'+id);
  if(row)row.querySelectorAll('.note-tag-chip').forEach(function(c){c.style.background='var(--bg-raised)';c.style.color='var(--text-secondary)';c.style.borderColor='var(--border)';});
  var nl=document.getElementById('mNotesList_'+id);
  if(nl) nl.innerHTML=_renderNotesList(DB.notes[k]||[]);
  var auditNl=document.getElementById('auNotes_'+k);
  if(auditNl) auditNl.innerHTML=_renderNotesList(DB.notes[k]||[]);
}

// ── برچسب مرکز ─────────────────────────────────────────────────
function removeCenterTag(ev,rtype,id,tagId){
  ev.stopPropagation();
  var k=recK(rtype,id);
  DB.rTags[k]=(DB.rTags[k]||[]).filter(function(t){return t!==tagId;});
  saveDB();
  // refresh tag area in modal
  var area=document.getElementById('tagArea_'+id);
  if(area){
    var tgs=rTags(rtype,id);
    area.innerHTML=tgs.map(function(tid){var t=tagById(tid);return t?'<span class="tag-badge" style="background:'+_safeColor(t.color)+';display:inline-flex;align-items:center;gap:3px">'+esc(t.name)+'<button onclick="removeCenterTag(event,\''+rtype+'\',\''+id+'\',\''+tid+'\')" style="background:rgba(0,0,0,.2);border:none;color:var(--text-primary);width:14px;height:14px;border-radius:50%;cursor:pointer;font-size:9px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">✕</button></span>':'';}).join('')
      +'<button class="tag-add-btn" style="width:24px;height:24px;line-height:22px;font-size:14px" onclick="openTagMenu(event,\''+rtype+'\',\''+id+'\')">+</button>';
  }
}

// ── Multi-contact helpers ─────────────────────────────────────────────────
function _getContacts(rtype,id){
  var e=getE(rtype,id);
  if(e.contacts&&e.contacts.length)return e.contacts.map(function(c){return{name:c.name||'',title:c.title||'',phones:(c.phones||[]).slice()};});
  if(e.contactName||e.contactTitle||(e.phones&&e.phones.length))
    return [{name:e.contactName||'',title:e.contactTitle||'',phones:(e.phones||[]).slice()}];
  return [];
}
function _saveContacts(rtype,id,contacts){
  setE(rtype,id,'contacts',contacts.slice());
}
function _refreshContactsArea(rtype,id,domId){
  var area=document.getElementById('contactsArea_'+(domId||id));
  if(area)area.innerHTML=_buildContactsHTML(rtype,id,domId||id);
}
function _waNum(ph){
  var n=(ph||'').replace(/[^0-9]/g,'');
  if(n.startsWith('0'))n='98'+n.slice(1);
  if(!n.startsWith('98'))n='98'+n;
  return n;
}
function _copyPhone(ph){
  if(!ph)return;
  if(navigator.clipboard){navigator.clipboard.writeText(ph).then(function(){showToast('📋 کپی شد: '+ph,1500);});}
  else{var ta=document.createElement('textarea');ta.value=ph;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('📋 کپی شد: '+ph,1500);}
}
function _buildContactsHTML(rtype,rid,domId){
  var contacts=_getContacts(rtype,rid);
  if(!contacts.length)return '<div style="color:var(--text-muted);font-size:11px;padding:4px 0;text-align:center">هنوز مخاطبی اضافه نشده</div>';
  var inp='width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-size:12px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)';
  return contacts.map(function(c,ci){
    var phonesHtml=(c.phones||[]).map(function(ph,pi){
      return'<div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">'
        +'<a href="'+_phoneHref(ph)+'" style="font-size:13px;text-decoration:none;flex-shrink:0" title="'+_phoneTitle()+'" onclick="event.stopPropagation()">📞</a>'
        +'<input type="text" value="'+esc(ph)+'" style="flex:1;direction:ltr;font-size:12px;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" '
        +'onchange="updateContactPhone(\''+rtype+'\',\''+rid+'\','+ci+','+pi+',this.value)">'
        +'<button onclick="removeContactPhone(\''+rtype+'\',\''+rid+'\','+ci+','+pi+',\''+domId+'\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;cursor:pointer;padding:3px 7px;font-size:11px;flex-shrink:0">✕</button>'
        +(ph?'<a href="https://wa.me/'+_waNum(ph)+'" target="_blank" title="واتساپ" style="font-size:14px;text-decoration:none;flex-shrink:0">💬</a>':'')
        +'<button onclick="_copyPhone(\''+esc(ph)+'\')" title="کپی شماره" style="background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:11px;padding:2px 5px">📋</button>'
        +'</div>';
    }).join('');
    return'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:6px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<span style="font-size:11px;font-weight:700;color:var(--text-secondary)">مخاطب '+(ci+1)+'</span>'
      +'<button onclick="removeContact(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:11px;padding:0 2px" title="حذف مخاطب">🗑 حذف</button>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">'
      +'<div><label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px">نام</label>'
      +'<input type="text" value="'+esc(c.name)+'" placeholder="نام مخاطب..." style="'+inp+'" '
      +'onchange="updateContactField(\''+rtype+'\',\''+rid+'\','+ci+',\'name\',this.value)"></div>'
      +'<div><label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px">سمت</label>'
      +'<input type="text" value="'+esc(c.title)+'" placeholder="مثلاً: مدیر خرید..." style="'+inp+'" '
      +'onchange="updateContactField(\''+rtype+'\',\''+rid+'\','+ci+',\'title\',this.value)"></div>'
      +'</div>'
      +'<label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px">شماره‌های تماس</label>'
      +phonesHtml
      +'<div style="display:flex;gap:5px;margin-top:3px">'
      +'<input id="newPhone_'+domId+'_'+ci+'" type="text" placeholder="شماره جدید..." style="flex:1;direction:ltr;font-size:12px;padding:4px 7px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;background:var(--bg-input);color:var(--text-primary)" '
      +'onkeydown="if(event.key===\'Enter\')addContactPhone(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')">'  
      +'<button onclick="addContactPhone(\''+rtype+'\',\''+rid+'\','+ci+',\''+domId+'\')" style="background:#0ea5e9;color:#fff;border:none;border-radius:5px;cursor:pointer;padding:4px 10px;font-size:11px;font-family:inherit;flex-shrink:0">+</button>'
      +'</div>'
      +'</div>';
  }).join('');
}
function addContact(rtype,id,domId){
  var contacts=_getContacts(rtype,id);
  contacts.push({name:'',title:'',phones:[]});
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function removeContact(rtype,id,ci,domId){
  var contacts=_getContacts(rtype,id);
  contacts.splice(ci,1);
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function updateContactField(rtype,id,ci,field,val){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci][field]=val;
  _saveContacts(rtype,id,contacts);
}
function addContactPhone(rtype,id,ci,domId){
  var inp=document.getElementById('newPhone_'+(domId||id)+'_'+ci);
  if(!inp)return;
  var ph=inp.value.trim();if(!ph)return;
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  if((contacts[ci].phones||[]).indexOf(ph)>=0){showToast('این شماره قبلاً ثبت شده');return;}
  contacts[ci].phones.push(ph);
  _saveContacts(rtype,id,contacts);
  inp.value='';
  _refreshContactsArea(rtype,id,domId||id);
}
function removeContactPhone(rtype,id,ci,pi,domId){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci].phones.splice(pi,1);
  _saveContacts(rtype,id,contacts);
  _refreshContactsArea(rtype,id,domId||id);
}
function updateContactPhone(rtype,id,ci,pi,val){
  var contacts=_getContacts(rtype,id);
  if(!contacts[ci])return;
  contacts[ci].phones[pi]=val;
  _saveContacts(rtype,id,contacts);
}


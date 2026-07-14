/* center-deals.js — multi-opportunity deals per center */
function _dealCenterKey(rtype, rid) { return rtype + '_' + rid; }

function _dealLoadSection(rtype, rid, domId) {
  var ck = _dealCenterKey(rtype, rid);
  var el = document.getElementById('cmDeals_' + domId);
  if (!el) return;
  fetch('/api/center-deals?center_key=' + encodeURIComponent(ck))
    .then(function (r) { return r.ok ? r.json() : { deals: [] }; })
    .then(function (d) { _dealRenderList(el, ck, d.deals || [], rtype, rid, domId); })
    .catch(function () { el.innerHTML = '<span style="color:#ef4444;font-size:11px">خطا در بارگذاری فرصت‌ها</span>'; });
}

function _dealRenderList(el, ck, deals, rtype, rid, domId) {
  var probFa = { low: 'کم', medium: 'متوسط', high: 'زیاد' };
  var rows = deals.map(function (d) {
    return '<div style="border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px;background:var(--bg-input)">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">'
      + '<div style="flex:1"><input value="' + esc(d.title || '') + '" onchange="_dealUpdate(\'' + d.id + '\',\'title\',this.value)" style="width:100%;font-weight:700;font-size:12px;border:none;background:transparent;color:var(--text-primary)">'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;font-size:10px">'
      + '<select onchange="_dealUpdate(\'' + d.id + '\',\'stage\',this.value)" style="font-size:10px;padding:2px 4px;border-radius:4px">'
      + ['فرصت', 'سرنخ', 'لید', 'مشتری'].map(function (s) { return '<option' + (d.stage === s ? ' selected' : '') + '>' + s + '</option>'; }).join('')
      + '</select>'
      + '<select onchange="_dealUpdate(\'' + d.id + '\',\'grade\',this.value)" style="font-size:10px;padding:2px 4px;border-radius:4px">'
      + ['A', 'B', 'C'].map(function (g) { return '<option' + (d.grade === g ? ' selected' : '') + '>' + g + '</option>'; }).join('')
      + '</select>'
      + '<input type="number" value="' + (d.valueMillion || 0) + '" min="0" step="0.1" title="ارزش (M)" onchange="_dealUpdate(\'' + d.id + '\',\'valueMillion\',parseFloat(this.value)||0)" style="width:60px;font-size:10px;padding:2px 4px;border:1px solid var(--border-input);border-radius:4px"> M'
      + '<select title="احتمال موفقیت" onchange="_dealUpdate(\'' + d.id + '\',\'probability\',this.value)" style="font-size:10px;padding:2px 4px;border-radius:4px">'
      + ['low','medium','high'].map(function(p){return '<option value="'+p+'"'+(d.probability===p?' selected':'')+'>'+probFa[p]+'</option>';}).join('')
      + '</select>'
      + '<input type="text" readonly value="' + esc(d.expectedClose || '') + '" placeholder="تاریخ بستن" title="تاریخ مورد انتظار" onclick="var i=this;openJDP(i,function(v){i.value=v;_dealUpdate(\''+d.id+'\',\'expectedClose\',v);})" style="width:82px;font-size:10px;padding:2px 4px;border:1px solid var(--border-input);border-radius:4px;cursor:pointer">'
      + '<select title="وضعیت فرصت" onchange="_dealUpdate(\'' + d.id + '\',\'status\',this.value)" style="font-size:10px;padding:2px 4px;border-radius:4px">'
      + [['open','باز'],['won','موفق'],['lost','از دست رفته']].map(function(s){return '<option value="'+s[0]+'"'+(d.status===s[0]?' selected':'')+'>'+s[1]+'</option>';}).join('')
      + '</select>'
      + '</div></div>'
      + '<button onclick="_dealDelete(\'' + d.id + '\',\'' + ck + '\',\'' + domId + '\',\'' + rtype + '\',\'' + rid + '\')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">✕</button>'
      + '</div></div>';
  }).join('');
  el.innerHTML = (rows || '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">فرصت ثبت‌شده‌ای نیست</div>')
    + '<button onclick="_dealAdd(\'' + ck + '\',\'' + domId + '\',\'' + rtype + '\',\'' + rid + '\')" style="margin-top:6px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit">+ فرصت جدید</button>';
}

function _dealAdd(ck, domId, rtype, rid) {
  fetch('/api/center-deals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ centerKey: ck, title: 'فرصت جدید', owner: currentUser })
  }).then(function () { _dealLoadSection(rtype, rid, domId); showToast('✅ فرصت اضافه شد', 2000); })
    .catch(function () { showToast('⚠ خطا در ایجاد فرصت'); });
}

function _dealUpdate(id, field, val) {
  var body = {}; body[field] = val;
  fetch('/api/center-deals/' + encodeURIComponent(id), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).catch(function () { showToast('⚠ خطا در ذخیره'); });
}

function _dealDelete(id, ck, domId, rtype, rid) {
  if (!confirm('این فرصت به سطل زباله منتقل شود؟')) return;
  fetch('/api/center-deals/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function () { _dealLoadSection(rtype, rid, domId); showToast('🗑 به سطل زباله منتقل شد', 2000); });
}

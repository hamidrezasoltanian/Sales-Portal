// ════════════════════════════════════════════════════════════
// PROFORMA MODULE — پیشفاکتور
// Workflow: draft → sent → approved/rejected → (reopen → draft)
// ════════════════════════════════════════════════════════════
'use strict';

// ── State ─────────────────────────────────────────────────────────────────
var _pfList = [];
var _pfFilter = 'all';   // all | draft | sent | approved | rejected | cancelled
var _pfPage   = 0;
var _pfEditId = null;    // currently open modal id (null = new)
var _pfItems  = [];      // rows in open modal
var _pfWmsProds = [];    // WMS product list (fetched once per session)

// ── Status labels & colors ───────────────────────────────────────────────
var PF_STATUS = {
  draft:     { label: 'پیش‌نویس',   cls: 'bgr' },
  sent:      { label: 'ارسال شده',  cls: 'bb'  },
  approved:  { label: 'تأیید شده', cls: 'bg'  },
  rejected:  { label: 'رد شده',    cls: 'br'  },
  cancelled: { label: 'لغو شده',   cls: 'by'  },
};

function pfStatusBadge(s) {
  var st = PF_STATUS[s] || { label: s, cls: 'bgr' };
  return '<span class="status-badge status-' + s + '">' + st.label + '</span>';
}

// ── Load from API ────────────────────────────────────────────────────────
async function pfLoad() {
  try {
    var r = await fetch('/api/proforma');
    if (r.ok) _pfList = await r.json();
    else _pfList = [];
  } catch (e) {
    _pfList = [];
  }
}

// ── Render tab panel ─────────────────────────────────────────────────────
async function renderProformaPanel() {
  var el = document.getElementById('proformaPanel');
  if (!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">در حال بارگذاری…</div>';
  await pfLoad();
  _renderPfPanel(el);
}

function _renderPfPanel(el) {
  var filtered = _pfFilter === 'all' ? _pfList : _pfList.filter(function(p){ return p.status === _pfFilter; });
  var isManager = _isManager();
  var PER_PAGE  = 25;
  var pageItems = filtered.slice(0, (_pfPage + 1) * PER_PAGE);
  var hasMore   = filtered.length > pageItems.length;

  var filterBtns = ['all','draft','sent','approved','rejected','cancelled'].map(function(s) {
    var lbl = s === 'all' ? 'همه' : (PF_STATUS[s] || { label: s }).label;
    var cnt = s === 'all' ? _pfList.length : _pfList.filter(function(p){ return p.status === s; }).length;
    return '<button onclick="_pfSetFilter(\'' + s + '\')" style="padding:5px 12px;border-radius:20px;border:1px solid ' +
      (_pfFilter === s ? 'var(--brand)' : '#e2e8f0') + ';background:' +
      (_pfFilter === s ? 'var(--brand)' : 'white') + ';color:' +
      (_pfFilter === s ? 'white' : '#64748b') + ';font-size:12px;font-family:inherit;cursor:pointer">' +
      lbl + (cnt ? ' (' + cnt + ')' : '') + '</button>';
  }).join('');

  var rows = pageItems.length ? pageItems.map(function(pf) {
    var st = PF_STATUS[pf.status] || { label: pf.status, cls: 'bgr' };
    var actions = _pfActions(pf);
    return '<tr>' +
      '<td style="font-family:monospace;font-size:12px;color:#0284c7">' + esc(pf.no) + '</td>' +
      '<td>' + esc(pf.jalaliDate || '') + '</td>' +
      '<td>' + esc(pf.centerName || '—') + '</td>' +
      '<td>' + (pf.items ? pf.items.length : 0) + ' ردیف</td>' +
      '<td style="font-family:monospace">' + fmtNum(pf.total) + ' ﷼</td>' +
      '<td><span class="status-badge" style="background:' + _badgeBg(pf.status) + ';color:' + _badgeFg(pf.status) + ';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">' + st.label + '</span></td>' +
      '<td>' + esc(_pfCreatorName(pf.createdBy)) + '</td>' +
      '<td style="white-space:nowrap">' + actions + '</td>' +
      '</tr>';
  }).join('') : '<tr><td colspan="8" style="text-align:center;padding:32px;color:#94a3b8">پیشفاکتوری یافت نشد</td></tr>';

  el.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + filterBtns + '</div>' +
      '<button onclick="pfOpenNew()" style="padding:8px 16px;background:var(--brand);color:white;border:none;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:600">+ پیشفاکتور جدید</button>' +
      (isManager ? '<button onclick="pfOpenTemplateEditor()" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;margin-right:8px" title="ویرایش قالب چاپ">🎨 قالب چاپ</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;background:white;border:1px solid #e2e8f0;border-radius:10px">' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">شماره</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">تاریخ</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">مرکز / مشتری</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">کالاها</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">مبلغ کل</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">وضعیت</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">صادرکننده</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">عملیات</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    (hasMore ? '<div style="text-align:center;margin-top:12px"><button onclick="_pfLoadMore()" style="padding:8px 24px;border:1px solid var(--brand);background:white;color:var(--brand);border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer">⬇ بارگذاری بیشتر (' + (filtered.length - pageItems.length) + ' مورد دیگر)</button></div>' : '');
}

function _badgeBg(s) {
  return { draft:'#f1f5f9', sent:'#eff6ff', approved:'#dcfce7', rejected:'#fee2e2', cancelled:'#fff7ed' }[s] || '#f1f5f9';
}
function _badgeFg(s) {
  return { draft:'#475569', sent:'#1d4ed8', approved:'#15803d', rejected:'#b91c1c', cancelled:'#c2410c' }[s] || '#475569';
}
function _pfCreatorName(uid) {
  if (!uid) return '';
  var m = (DB.settings && DB.settings.members || []).find(function(x){ return x.id === uid; });
  return m ? m.name : uid;
}

// ── Filter setter ─────────────────────────────────────────────────────────
function _pfLoadMore() {
  _pfPage++;
  var el = document.getElementById('proformaPanel');
  if (el) _renderPfPanel(el);
}

function _pfSetFilter(f) {
  _pfFilter = f;
  _pfPage = 0;
  var el = document.getElementById('proformaPanel');
  if (el) _renderPfPanel(el);
}

// ── Action buttons per row ────────────────────────────────────────────────
function _pfActions(pf) {
  var btns = [];
  var isManager = _isManager();

  // View / Edit
  btns.push('<button onclick="pfOpenEdit(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer" title="مشاهده / ویرایش">✏️</button>');

  // Print
  btns.push('<button onclick="pfPrint(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer" title="چاپ">🖨️</button>');

  // Send (expert, draft only)
  if (pf.status === 'draft' && pf.createdBy === currentUser) {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'send\')" style="padding:3px 8px;font-size:11px;border:1px solid #3b82f6;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer">ارسال</button>');
  }

  // Approve / Reject (manager, sent only)
  if (isManager && pf.status === 'sent') {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'approve\')" style="padding:3px 8px;font-size:11px;border:1px solid #16a34a;border-radius:5px;background:#f0fdf4;color:#15803d;cursor:pointer">تأیید</button>');
    btns.push('<button onclick="pfReject(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #dc2626;border-radius:5px;background:#fef2f2;color:#b91c1c;cursor:pointer">رد</button>');
  }

  // Issue Invoice (manager, approved only)
  if (isManager && pf.status === 'approved') {
    btns.push('<button onclick="pfIssueInvoice(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #7c3aed;border-radius:5px;background:#f5f3ff;color:#6d28d9;cursor:pointer" title="صدور فاکتور رسمی">🧾 فاکتور</button>');
  }

  // Reopen (manager or owner, rejected/cancelled)
  if (['rejected','cancelled'].includes(pf.status) && (isManager || pf.createdBy === currentUser)) {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'reopen\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer">بازگشایی</button>');
  }

  // Delete (draft or cancelled only)
  if (['draft','cancelled'].includes(pf.status) && (isManager || pf.createdBy === currentUser)) {
    btns.push('<button onclick="pfDelete(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #fecaca;border-radius:5px;background:#fef2f2;color:#b91c1c;cursor:pointer" title="حذف">🗑️</button>');
  }

  return '<span class="row-acts">' + btns.join(' ') + '</span>';
}

async function pfIssueInvoice(pfId) {
  var pf = _pfList.find(function(p){ return p.id === pfId; });
  if (!pf) return;
  try {
    var r = await fetch('/api/invoices/from-proforma/' + pfId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jalali_date: pf.jalaliDate, tax_pct: 9 })
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    if (data.already) {
      showToast('ℹ️ فاکتور این پیش‌فاکتور قبلاً صادر شده: ' + data.invoice.invoice_no);
    } else {
      showToast('✅ فاکتور ' + data.invoice_no + ' صادر شد');
    }
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

async function pfDelete(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  if (!confirm('پیشفاکتور ' + pf.no + ' حذف شود؟')) return;
  try {
    var r = await fetch('/api/proforma/' + id, { method: 'DELETE' });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    showToast('🗑️ پیشفاکتور حذف شد');
    await pfLoad();
    var el = document.getElementById('proformaPanel');
    if (el) _renderPfPanel(el);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

// ── Workflow action call ──────────────────────────────────────────────────
async function pfAction(id, action, note) {
  try {
    var body = { action: action };
    if (note) body.note = note;
    var r = await fetch('/api/proforma/' + id + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    await pfLoad();
    var el = document.getElementById('proformaPanel');
    if (el) _renderPfPanel(el);
    var labels = { send:'ارسال شد', approve:'تأیید شد', reject:'رد شد', cancel:'لغو شد', reopen:'بازگشایی شد' };
    showToast('✅ پیشفاکتور ' + (labels[action] || action));
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

function pfReject(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  var pfNo = pf ? pf.no : id;
  openModal('pfRejectModal', '❌ رد پیشفاکتور ' + pfNo,
    '<div style="margin-bottom:12px;font-size:13px;color:#475569">دلیل رد را بنویسید (اختیاری):</div>' +
    '<textarea id="pfRejectNote" rows="3" class="form-input" placeholder="توضیحات رد..." style="resize:vertical"></textarea>',
    '<button onclick="closeModal(\'pfRejectModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>' +
    '<button onclick="_pfDoReject(\'' + id + '\')" style="padding:8px 18px;background:#dc2626;color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">❌ رد پیشفاکتور</button>'
  );
}

async function _pfDoReject(id) {
  var noteEl = document.getElementById('pfRejectNote');
  var note   = noteEl ? noteEl.value.trim() : '';
  closeModal('pfRejectModal');
  await pfAction(id, 'reject', note);
}

// ── Fetch WMS products once (for item autocomplete) ──────────────────────
async function _pfLoadWmsProds() {
  if (_pfWmsProds.length) return;
  try {
    var r = await fetch('/api/wms/inventory');
    if (r.ok) {
      var data = await r.json();
      _pfWmsProds = data || [];
    }
  } catch(e) {}
}

// ── Open new proforma modal ───────────────────────────────────────────────
async function pfOpenNew() {
  _pfEditId = null;
  _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, lineTotal:0 }];
  await _pfLoadWmsProds();
  _pfShowModal(null);
}

async function pfOpenEdit(id) {
  try {
    var pf = _pfList.find(function(p){ return p.id === id; });
    if (!pf) return;
    _pfEditId = id;
    _pfItems  = (pf.items || []).map(function(i){ return Object.assign({}, i); });
    if (!_pfItems.length) _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, lineTotal:0 }];
    await _pfLoadWmsProds();
    _pfShowModal(pf);
  } catch(e) {
    alert("Error in pfOpenEdit: " + e.message + "\\n" + e.stack);
  }
}

function _pfShowModal(pf) { try {
  var readOnly = pf && pf.status !== 'draft';
  var modal = document.getElementById('pfModal');
  if (!modal) {
    var div = document.createElement('div');
    div.innerHTML = _pfModalHTML();
    while (div.firstChild) {
      document.body.appendChild(div.firstChild);
    }
    modal = document.getElementById('pfModal');
  }
  if (!modal) return;

  var itemRows = _pfItems.map(function(item, i) {
    return _pfItemRow(i, item, readOnly);
  }).join('');

  var centerVal = pf ? (pf.centerName || '') : '';
  var centerKey = pf ? (pf.centerKey  || '') : '';
  var dateVal   = pf ? (pf.jalaliDate || todayStr()) : todayStr();
  var taxVal    = pf ? (pf.taxPct !== undefined ? pf.taxPct : 9) : 9;
  var discVal   = pf ? (pf.discountPct || 0) : 0;
  var noteVal   = pf ? (pf.note || '') : '';
  var validVal  = pf ? (pf.validDays || 30) : 30;

  document.getElementById('pfModalBody').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">مرکز / مشتری</label>' +
        '<input id="pfCenterName" class="form-input" value="' + esc(centerVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="نام مرکز یا مشتری" oninput="pfSearchCenter(this.value)" autocomplete="off">' +
        '<div id="pfCenterDrop" style="position:absolute;z-index:200;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);display:none;max-height:180px;overflow-y:auto;min-width:260px"></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">تاریخ صدور (شمسی)</label>' +
        '<input id="pfDate" class="form-input" value="' + esc(dateVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="۱۴۰۴/۰۳/۲۵">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">مدت اعتبار (روز)</label>' +
        '<input id="pfValid" type="number" class="form-input" value="' + validVal + '" ' + (readOnly?'disabled':'') + ' min="1" max="365">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">مالیات ٪</label>' +
        '<input id="pfTax" type="number" class="form-input" value="' + taxVal + '" ' + (readOnly?'disabled':'') + ' min="0" max="100" onchange="pfRecalc()">' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">' +
      '<strong style="font-size:13px">ردیف‌های کالا</strong>' +
      (readOnly ? '' : '<button onclick="pfAddRow()" style="padding:4px 10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">+ افزودن ردیف</button>') +
    '</div>' +
    '<div id="pfItemsWrap" style="margin-bottom:16px">' + itemRows + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">تخفیف ٪</label>' +
        '<input id="pfDisc" type="number" class="form-input" value="' + discVal + '" ' + (readOnly?'disabled':'') + ' min="0" max="100" onchange="pfRecalc()">' +
      '</div>' +
      '<div id="pfTotalsBox" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px"></div>' +
    '</div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">توضیحات</label>' +
      '<textarea id="pfNote" rows="2" class="form-input" ' + (readOnly?'disabled':'') + ' style="resize:vertical">' + esc(noteVal) + '</textarea>' +
    '</div>' +
    (pf && pf.managerNote ? '<div style="margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:12px"><strong>نظر مدیر:</strong> ' + esc(pf.managerNote) + '</div>' : '');

  document.getElementById('pfModalFooter').innerHTML =
    (readOnly ? '<button onclick="pfPrint(\'' + (pf.id) + '\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">🖨️ چاپ</button>' : '') +
    '<button onclick="document.getElementById(\'pfModal\').style.display=\'none\'" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">بستن</button>' +
    (!readOnly ? '<button onclick="pfSave()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره</button>' : '');

  modal.style.display = 'flex';
  pfRecalc();
} catch(e) { alert('Error in _pfShowModal: ' + e.message); } }

function _pfItemRow(i, item, readOnly) {
  return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0" id="pfRow_' + i + '">' +
    '<div><label style="font-size:10px;color:#64748b;display:block">کالا</label>' +
      (readOnly
        ? '<span style="font-size:13px">' + esc(item.name || '') + '</span>'
        : '<input class="form-input pf-item-name" data-idx="' + i + '" style="font-size:13px" value="' + esc(item.name||'') + '" placeholder="نام کالا" autocomplete="off" oninput="_pfRowChange(' + i + ',\'name\',this.value); pfSearchProduct(' + i + ', this.value)">' +
          '<div id="pfProdDrop_' + i + '" style="position:absolute;z-index:200;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);display:none;max-height:180px;overflow-y:auto"></div>') +
    '</div>' +
    '<div><label style="font-size:10px;color:#64748b;display:block">تعداد</label>' +
      (readOnly
        ? '<span style="font-size:13px">' + fmtNum(item.qty) + '</span>'
        : '<input type="number" class="form-input pf-item-qty" data-idx="' + i + '" value="' + item.qty + '" min="1" oninput="_pfRowChange(' + i + ',\'qty\',this.value)">') +
    '</div>' +
    '<div><label style="font-size:10px;color:#64748b;display:block">قیمت واحد (ریال)</label>' +
      (readOnly
        ? '<span style="font-size:13px;font-family:monospace">' + fmtNum(item.unitPrice) + '</span>'
        : '<input type="number" class="form-input pf-item-price" data-idx="' + i + '" value="' + item.unitPrice + '" min="0" oninput="_pfRowChange(' + i + ',\'unitPrice\',this.value)">') +
    '</div>' +
    (readOnly ? '<span></span>' :
      '<button onclick="pfRemoveRow(' + i + ')" style="padding:4px 8px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:5px;cursor:pointer;font-size:14px;margin-top:16px">✕</button>') +
    '</div>';
}

function _pfProdOptions(selId) {
  var products = [];
  try {
    var wmsData = null;
    // items from WMS inventory would come here in future
  } catch(e) {}
  return '';
}

function _pfRowAutofill(i, val) {
  var match = _pfWmsProds.find(function(p){ return (p.full_name || p.name) === val; });
  if (!match) return;
  if (!_pfItems[i]) return;
  _pfItems[i].unit = match.unit || 'عدد';
  var unitEl = document.querySelector('.pf-item-qty[data-idx="' + i + '"]');
  if (unitEl) unitEl.placeholder = match.unit || 'عدد';
}

function _pfRowChange(i, field, val) {
  if (!_pfItems[i]) return;
  if (field === 'qty' || field === 'unitPrice') _pfItems[i][field] = Number(val) || 0;
  else _pfItems[i][field] = val;
  _pfItems[i].lineTotal = (_pfItems[i].qty || 0) * (_pfItems[i].unitPrice || 0);
  pfRecalc();
}

function pfAddRow() {
  _pfItems.push({ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, lineTotal:0 });
  var wrap = document.getElementById('pfItemsWrap');
  if (wrap) {
    var div = document.createElement('div');
    div.innerHTML = _pfItemRow(_pfItems.length - 1, _pfItems[_pfItems.length - 1], false);
    wrap.appendChild(div.firstChild);
  }
  pfRecalc();
}

function pfRemoveRow(i) {
  if (_pfItems.length <= 1) { showToast('حداقل یک ردیف لازم است'); return; }
  _pfItems.splice(i, 1);
  var wrap = document.getElementById('pfItemsWrap');
  if (wrap) {
    wrap.innerHTML = _pfItems.map(function(item, idx){ return _pfItemRow(idx, item, false); }).join('');
  }
  pfRecalc();
}

function pfRecalc() {
  var taxPct  = Number(document.getElementById('pfTax')  ? document.getElementById('pfTax').value  : 9)  || 0;
  var discPct = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0)  || 0;
  var subtotal = _pfItems.reduce(function(s, i){ return s + (i.lineTotal || 0); }, 0);
  var discAmt  = Math.round(subtotal * discPct / 100);
  var taxAmt   = Math.round((subtotal - discAmt) * taxPct / 100);
  var total    = subtotal - discAmt + taxAmt;
  var box = document.getElementById('pfTotalsBox');
  if (box) {
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>جمع ناخالص</span><span style="font-family:monospace">' + fmtNum(subtotal) + ' ﷼</span></div>' +
      (discPct ? '<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#c2410c"><span>تخفیف ' + discPct + '٪</span><span style="font-family:monospace">−' + fmtNum(discAmt) + ' ﷼</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#475569"><span>مالیات ' + taxPct + '٪</span><span style="font-family:monospace">+' + fmtNum(taxAmt) + ' ﷼</span></div>' +
      '<div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;font-weight:700;font-size:14px"><span>جمع کل</span><span style="font-family:monospace;color:#1d4ed8">' + fmtNum(total) + ' ﷼</span></div>';
  }
}

// ── Center search dropdown ────────────────────────────────────────────────
function pfSearchCenter(q) {
  var drop = document.getElementById('pfCenterDrop');
  if (!drop) return;
  if (!q || q.length < 2) { drop.style.display = 'none'; return; }
  var qn = fNorm(q);
  var results = [];

  function addResult(key, name) {
    if (results.some(function(item) { return item.key === key; })) return;
    results.push({ key: key, name: name });
  }

  // Extra centers (manually added)
  if (typeof DB !== 'undefined' && DB.extra) {
    DB.extra.forEach(function(c) {
      var rtype = (c.province_id === 'tehran') ? 'center' : 'pc';
      var name = _getCenterName(rtype, c.id) || c.name;
      if (fNorm(name).indexOf(qn) !== -1) {
        addResult(rtype + '_' + c.id, name);
      }
    });
  }

  // Tehran centers
  if (typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c) {
      var name = _getCenterName('center', c.id) || c.name;
      if (fNorm(name).indexOf(qn) !== -1) {
        addResult('center_' + c.id, name);
      }
    });
  }

  // Province centers
  if (typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(provId) {
      (_PC_CACHE[provId] || []).forEach(function(c) {
        var name = _getCenterName('pc', c.id) || c.name;
        if (fNorm(name).indexOf(qn) !== -1) {
          addResult('pc_' + c.id, name);
        }
      });
    });
  }

  results = results.slice(0, 15);

  if (!results.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = results.map(function(r) {
    return '<div onclick="pfSelectCenter(\'' + esc(r.key) + '\',\'' + esc(r.name) + '\')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">' + esc(r.name) + '</div>';
  }).join('');
  var inp = document.getElementById('pfCenterName');
  if (inp) {
    var rect = inp.getBoundingClientRect();
    drop.style.top    = (rect.bottom + window.scrollY) + 'px';
    drop.style.right  = (window.innerWidth - rect.right) + 'px';
    drop.style.position = 'fixed';
  }
  drop.style.display = 'block';
}

function pfSelectCenter(key, name) {
  var inp = document.getElementById('pfCenterName');
  var drop = document.getElementById('pfCenterDrop');
  if (inp)  { inp.value = name; inp.dataset.key = key; }
  if (drop) drop.style.display = 'none';
}

// ── Save ──────────────────────────────────────────────────────────────────
async function pfSave() {
  var centerInp = document.getElementById('pfCenterName');
  var centerName = centerInp ? centerInp.value.trim() : '';
  var centerKey  = centerInp ? (centerInp.dataset.key || '') : '';
  var date  = document.getElementById('pfDate')  ? document.getElementById('pfDate').value.trim()  : todayStr();
  var taxPct  = Number(document.getElementById('pfTax')  ? document.getElementById('pfTax').value  : 9);
  var discPct = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0);
  var note    = document.getElementById('pfNote')  ? document.getElementById('pfNote').value.trim()  : '';
  var valid   = Number(document.getElementById('pfValid') ? document.getElementById('pfValid').value : 30);

  // Sync any un-fired input values from DOM before saving
  _pfItems.forEach(function(item, i) {
    var nameEl  = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
    var qtyEl   = document.querySelector('.pf-item-qty[data-idx="' + i + '"]');
    var priceEl = document.querySelector('.pf-item-price[data-idx="' + i + '"]');
    if (nameEl)  item.name      = nameEl.value.trim();
    if (qtyEl)   item.qty       = Number(qtyEl.value)   || 0;
    if (priceEl) item.unitPrice = Number(priceEl.value) || 0;
    item.lineTotal = item.qty * item.unitPrice;
  });

  var items = _pfItems.filter(function(i){ return i.name && i.qty > 0; });
  if (!items.length) { showToast('❌ حداقل یک ردیف کالا با نام وارد کنید'); return; }

  var body = {
    centerKey: centerKey, centerName: centerName,
    items: items, note: note,
    taxPct: taxPct, discountPct: discPct,
    jalaliDate: date, validDays: valid,
  };

  try {
    var url = _pfEditId ? '/api/proforma/' + _pfEditId : '/api/proforma';
    var method = _pfEditId ? 'PUT' : 'POST';
    var r = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    document.getElementById('pfModal').style.display = 'none';
    showToast('✅ پیشفاکتور ' + (_pfEditId ? 'ویرایش' : 'ایجاد') + ' شد — شماره: ' + data.no);
    await pfLoad();
    var el = document.getElementById('proformaPanel');
    if (el) _renderPfPanel(el);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

// ── Print ─────────────────────────────────────────────────────────────────
function pfPrint(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  var zone = document.getElementById('pfPrintZone');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'pfPrintZone';
    zone.style.display = 'none';
    document.body.appendChild(zone);
  }
  zone.innerHTML = _pfPrintHTML(pf);
  window.print();
}


function _pfPrintHTML(pf) {
  var subtotal = pf.subtotal || 0;
  var discAmt  = pf.discAmt  || 0;
  var taxAmt   = pf.taxAmt   || 0;
  var total    = pf.total    || 0;
  
  var template = (typeof DB !== 'undefined' && DB.settings && DB.settings.pfPrintTemplate) 
                 ? DB.settings.pfPrintTemplate : _pfDefaultTemplate();

  var itemRows = (pf.items || []).map(function(item, i) {
    return '<tr>' +
      '<td style="border:1px solid #000;text-align:center;padding:5px">' + (i+1) + '</td>' +
      '<td style="border:1px solid #000;text-align:center;padding:5px">' + esc(item.prodId || '') + '</td>' +
      '<td style="border:1px solid #000;text-align:right;padding:5px">' + esc(item.name || '') + '</td>' +
      '<td style="border:1px solid #000;text-align:center;padding:5px">' + fmtNum(item.qty) + '</td>' +
      '<td style="border:1px solid #000;text-align:center;padding:5px">' + esc(item.unit || 'عدد') + '</td>' +
      '<td style="border:1px solid #000;text-align:center;font-family:monospace;padding:5px">' + fmtNum(item.unitPrice) + '</td>' +
      '<td style="border:1px solid #000;text-align:center;font-family:monospace;padding:5px">' + fmtNum(item.lineTotal) + '</td>' +
      '</tr>';
  }).join('');

  var seller = (typeof DB !== 'undefined' && DB.settings && DB.settings.sellerInfo) || {
    name: 'آتنا زیست درمان', natId: '۱۰۱۰۴۲۳۴۵۶۷', regId: '۱۲۳۴۵۶', ecoCode: '۴۱۱۱۲۳۴۵۶۷۸۹',
    address: 'تهران، خیابان ولیعصر، نرسیده به پارک وی، کوچه ...', postal: '۱۹۶۶۶۴۵۳۲۱', phone: '۰۲۱-۸۸۸۸۸۸۸۸'
  };

  var html = template
    .replace(/\{\{seller\.name\}\}/g, esc(seller.name))
    .replace(/\{\{seller\.natId\}\}/g, esc(seller.natId))
    .replace(/\{\{seller\.regId\}\}/g, esc(seller.regId))
    .replace(/\{\{seller\.ecoCode\}\}/g, esc(seller.ecoCode))
    .replace(/\{\{seller\.address\}\}/g, esc(seller.address))
    .replace(/\{\{seller\.postal\}\}/g, esc(seller.postal))
    .replace(/\{\{seller\.phone\}\}/g, esc(seller.phone))
    .replace(/\{\{pf\.no\}\}/g, esc(pf.no))
    .replace(/\{\{pf\.jalaliDate\}\}/g, esc(pf.jalaliDate||''))
    .replace(/\{\{pf\.centerName\}\}/g, esc(pf.centerName||'—'))
    .replace(/\{\{pf\.creatorName\}\}/g, esc(_pfCreatorName(pf.createdBy)))
    .replace(/\{\{items_html\}\}/g, itemRows)
    .replace(/\{\{subtotal\}\}/g, fmtNum(subtotal))
    .replace(/\{\{discAmt\}\}/g, fmtNum(discAmt))
    .replace(/\{\{taxPct\}\}/g, pf.taxPct||9)
    .replace(/\{\{taxAmt\}\}/g, fmtNum(taxAmt))
    .replace(/\{\{total\}\}/g, fmtNum(total))
    .replace(/\{\{totalWords\}\}/g, _numToWords(total));

  return html;
}

function _pfDefaultTemplate() {
  return `<div class="pf-print" style="font-family:Vazirmatn,sans-serif;direction:rtl;color:#000;padding:20px;width:100%;max-width:900px;margin:0 auto">
  <div style="text-align:center;font-weight:bold;font-size:18px;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px">
    صورتحساب فروش کالا و خدمات
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:15px;font-size:13px">
    <div><strong>شماره:</strong> <span style="font-family:monospace">{{pf.no}}</span></div>
    <div><strong>تاریخ:</strong> {{pf.jalaliDate}}</div>
  </div>
  <div style="border:1px solid #000;border-radius:4px;margin-bottom:15px;font-size:12px">
    <div style="background:#f0f0f0;padding:5px;border-bottom:1px solid #000;font-weight:bold">مشخصات فروشنده</div>
    <div style="padding:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div><strong>فروشنده:</strong> {{seller.name}}</div>
      <div><strong>شماره اقتصادی:</strong> {{seller.ecoCode}}</div>
      <div><strong>شناسه ملی:</strong> {{seller.natId}}</div>
      <div><strong>شماره ثبت:</strong> {{seller.regId}}</div>
      <div style="grid-column:1/-1"><strong>آدرس:</strong> {{seller.address}} &nbsp;&nbsp; <strong>کد پستی:</strong> {{seller.postal}} &nbsp;&nbsp; <strong>تلفن:</strong> {{seller.phone}}</div>
    </div>
  </div>
  <div style="border:1px solid #000;border-radius:4px;margin-bottom:15px;font-size:12px">
    <div style="background:#f0f0f0;padding:5px;border-bottom:1px solid #000;font-weight:bold">مشخصات خریدار</div>
    <div style="padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><strong>نام شخص حقیقی/حقوقی:</strong> {{pf.centerName}}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:12px;border:1px solid #000;text-align:center">
    <thead style="background:#f0f0f0">
      <tr>
        <th style="border:1px solid #000;padding:5px">ردیف</th>
        <th style="border:1px solid #000;padding:5px">کد کالا</th>
        <th style="border:1px solid #000;padding:5px">شرح کالا / خدمات</th>
        <th style="border:1px solid #000;padding:5px">تعداد</th>
        <th style="border:1px solid #000;padding:5px">واحد</th>
        <th style="border:1px solid #000;padding:5px">مبلغ واحد (ریال)</th>
        <th style="border:1px solid #000;padding:5px">مبلغ کل (ریال)</th>
      </tr>
    </thead>
    <tbody>
      {{items_html}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align:left;padding:5px;border:1px solid #000;font-weight:bold">جمع کل قبل از تخفیف:</td>
        <td style="border:1px solid #000;padding:5px;font-family:monospace">{{subtotal}}</td>
      </tr>
      <tr>
        <td colspan="6" style="text-align:left;padding:5px;border:1px solid #000;font-weight:bold">تخفیف:</td>
        <td style="border:1px solid #000;padding:5px;font-family:monospace">{{discAmt}}</td>
      </tr>
      <tr>
        <td colspan="6" style="text-align:left;padding:5px;border:1px solid #000;font-weight:bold">مالیات و عوارض ارزش افزوده ({{taxPct}}٪):</td>
        <td style="border:1px solid #000;padding:5px;font-family:monospace">{{taxAmt}}</td>
      </tr>
      <tr style="background:#f0f0f0">
        <td colspan="6" style="text-align:left;padding:5px;border:1px solid #000;font-weight:bold">جمع کل فاکتور (ریال):</td>
        <td style="border:1px solid #000;padding:5px;font-weight:bold;font-family:monospace">{{total}}</td>
      </tr>
    </tfoot>
  </table>
  <div style="font-size:12px;margin-bottom:20px;border:1px solid #000;padding:10px;border-radius:4px">
    <strong>مبلغ کل به حروف:</strong> {{totalWords}} ریال
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:40px;font-size:13px;font-weight:bold">
    <div style="text-align:center">مهر و امضای فروشنده</div>
    <div style="text-align:center">مهر و امضای خریدار</div>
  </div>
</div>`;
}

function pfOpenTemplateEditor() {
  if (!_isManager()) { showToast('⚠ دسترسی فقط برای مدیر امکان‌پذیر است'); return; }
  var tpl = (typeof DB !== 'undefined' && DB.settings && DB.settings.pfPrintTemplate) || _pfDefaultTemplate();
  var html = '<div style="margin-bottom:12px;font-size:12px;color:#475569">شما می‌توانید کد HTML قالب چاپ را مستقیماً ویرایش کنید. از متغیرهای <code style="direction:ltr;display:inline-block">\{\{...\}\}</code> استفاده کنید.</div>' +
    '<div style="font-size:11px;color:#0284c7;margin-bottom:8px;background:#f0f9ff;padding:8px;border-radius:6px;border:1px solid #bae6fd">' +
    '<strong>متغیرهای قابل استفاده:</strong><br>' +
    '\{\{seller.name\}\}, \{\{seller.ecoCode\}\}, \{\{seller.natId\}\}, \{\{seller.regId\}\}, \{\{seller.address\}\}, \{\{seller.postal\}\}, \{\{seller.phone\}\}<br>' +
    '\{\{pf.no\}\}, \{\{pf.jalaliDate\}\}, \{\{pf.centerName\}\}, \{\{pf.creatorName\}\}<br>' +
    '\{\{items_html\}\}, \{\{subtotal\}\}, \{\{discAmt\}\}, \{\{taxPct\}\}, \{\{taxAmt\}\}, \{\{total\}\}, \{\{totalWords\}\}' +
    '</div>' +
    '<textarea id="pfTemplateCode" style="width:100%;height:400px;font-family:monospace;font-size:12px;direction:ltr;text-align:left;padding:10px;border:1px solid #cbd5e1;border-radius:6px;resize:vertical">' + esc(tpl) + '</textarea>';
  
  openModal('pfTemplateModal', '✏️ ویرایش قالب چاپ پیش‌فاکتور (HTML)', html,
    '<button onclick="pfResetTemplate()" style="padding:8px 16px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">بازگشت به پیش‌فرض</button>' +
    '<button onclick="document.getElementById(\'pfTemplateModal\').style.display=\'none\'" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="pfSaveTemplate()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره قالب</button>',
    {lg:true}
  );
}

function pfSaveTemplate() {
  var code = document.getElementById('pfTemplateCode').value;
  if (!DB.settings) DB.settings = {};
  DB.settings.pfPrintTemplate = code;
  saveDB();
  document.getElementById('pfTemplateModal').style.display = 'none';
  showToast('✅ قالب چاپ ذخیره شد');
}

function pfResetTemplate() {
  if(confirm('آیا مطمئن هستید که می‌خواهید قالب به حالت پیش‌فرض (فاکتور رسمی دارایی) بازگردد؟')) {
    document.getElementById('pfTemplateCode').value = _pfDefaultTemplate();
  }
}

// ── Modal & Print zone HTML ───────────────────────────────────────────────
function _pfModalHTML() {
  return '<div id="pfModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;backdrop-filter:blur(2px)" onclick="if(event.target===this)this.style.display=\'none\'">' +
    '<div style="background:white;border-radius:14px;width:720px;max-width:95vw;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">' +
      '<div style="padding:18px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;z-index:1">' +
        '<span style="font-size:15px;font-weight:800">📄 پیشفاکتور</span>' +
        '<button onclick="document.getElementById(\'pfModal\').style.display=\'none\'" style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8;padding:2px 6px;border-radius:4px">✕</button>' +
      '</div>' +
      '<div id="pfModalBody" style="padding:20px"></div>' +
      '<div id="pfModalFooter" style="padding:14px 20px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;background:#f8fafc;border-radius:0 0 14px 14px"></div>' +
    '</div>' +
  '</div>';
}

function _pfPrintZone() {
  return '<div id="pfPrintZone" style="display:none"></div>';
}

// ── Number formatter (uses Persian digits) ────────────────────────────────
function fmtNum(n) {
  return Number(n || 0).toLocaleString('fa-IR');
}

// ── Number to Persian words ───────────────────────────────────────────────
function _numToWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'صفر';
  var ones  = ['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
  var tens  = ['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
  var hund  = ['','یکصد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'];
  var scale = ['','هزار','میلیون','میلیارد'];
  function chunk(num) {
    var parts = [];
    if (num >= 100) { parts.push(hund[Math.floor(num/100)]); num %= 100; }
    if (num >= 20)  { parts.push(tens[Math.floor(num/10)]); num %= 10; }
    if (num > 0)    parts.push(ones[num]);
    return parts.join(' و ');
  }
  var negative = n < 0;
  n = Math.abs(n);
  var segments = [];
  var scaleIdx = 0;
  while (n > 0) {
    var seg = n % 1000;
    if (seg) segments.unshift(chunk(seg) + (scale[scaleIdx] ? ' ' + scale[scaleIdx] : ''));
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return (negative ? 'منفی ' : '') + segments.join(' و ');
}

// ── Vue bridge callbacks ──────────────────────────────────────────────────
// Called by ProformaPanel.vue emits via window._pfXxx?.()
window._pfNew     = function()    { pfOpenNew(); };
window._pfView    = function(pf)  { pfOpenEdit(pf.id); };
window._pfSend    = function(pf)  { pfAction(pf.id, 'send'); };
window._pfApprove = function(pf)  { pfAction(pf.id, 'approve'); };
window._pfReject  = function(pf)  { pfReject(pf.id); };

// Print CSS (injected once) ───────────────────────────────────────────────
(function() {
  if (document.getElementById('pfPrintStyle')) return;
  var s = document.createElement('style');
  s.id = 'pfPrintStyle';
  s.textContent =
    '@media print{' +
      'body>*:not(#pfPrintZone){display:none!important}' +
      '#pfPrintZone{display:block!important}' +
    '}' +
    '.form-input{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-family:inherit;font-size:13px;outline:none;width:100%}' +
    '.form-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}' +
    '.form-input:disabled{background:#f8fafc;color:#94a3b8}';
  document.head.appendChild(s);
}());


// ── Product search dropdown ────────────────────────────────────────────────
function pfSearchProduct(i, q) {
  var drop = document.getElementById('pfProdDrop_' + i);
  if (!drop) return;
  if (!q || q.length < 2) { drop.style.display = 'none'; return; }
  var qn = fNorm(q);
  var results = _pfWmsProds.filter(function(p) {
    return fNorm(p.full_name || p.name).indexOf(qn) !== -1;
  }).slice(0, 15);

  if (!results.length) { drop.style.display = 'none'; return; }
  
  drop.innerHTML = results.map(function(r) {
    var n = esc(r.full_name || r.name);
    var u = esc(r.unit || 'عدد');
    return '<div onclick="pfSelectProduct(' + i + ', \'' + n + '\', \'' + u + '\')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">' + n + ' <span style="color:#94a3b8;font-size:11px">(' + u + ')</span></div>';
  }).join('');
  
  var inp = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
  if (inp) {
    var rect = inp.getBoundingClientRect();
    drop.style.top = (rect.bottom + window.scrollY) + 'px';
    drop.style.left = rect.left + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.position = 'fixed';
  }
  drop.style.display = 'block';
}

function pfSelectProduct(i, name, unit) {
  var drop = document.getElementById('pfProdDrop_' + i);
  if (drop) drop.style.display = 'none';
  var inp = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
  if (inp) {
    inp.value = name;
    _pfRowChange(i, 'name', name);
    _pfRowAutofill(i, name);
  }
}

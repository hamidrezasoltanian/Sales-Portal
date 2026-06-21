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
    (hasMore ? '<div style="text-align:center;margin-top:12px"><button onclick="_pfLoadMore()" style="padding:8px 24px;border:1px solid var(--brand);background:white;color:var(--brand);border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer">⬇ بارگذاری بیشتر (' + (filtered.length - pageItems.length) + ' مورد دیگر)</button></div>' : '') +
    _pfModalHTML() +
    _pfPrintZone();
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
    '<button onclick="document.getElementById(\'pfRejectModal\').style.display=\'none\'" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>' +
    '<button onclick="_pfDoReject(\'' + id + '\')" style="padding:8px 18px;background:#dc2626;color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">❌ رد پیشفاکتور</button>'
  );
}

async function _pfDoReject(id) {
  var noteEl = document.getElementById('pfRejectNote');
  var note   = noteEl ? noteEl.value.trim() : '';
  var modal  = document.getElementById('pfRejectModal');
  if (modal) modal.style.display = 'none';
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
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  _pfEditId = id;
  _pfItems  = (pf.items || []).map(function(i){ return Object.assign({}, i); });
  if (!_pfItems.length) _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, lineTotal:0 }];
  await _pfLoadWmsProds();
  _pfShowModal(pf);
}

function _pfShowModal(pf) {
  var readOnly = pf && pf.status !== 'draft';
  var modal = document.getElementById('pfModal');
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
}

function _pfItemRow(i, item, readOnly) {
  var wmsOpts = _pfWmsProds.length
    ? '<datalist id="pfWmsList_' + i + '">' +
        _pfWmsProds.map(function(p){ return '<option value="' + esc(p.full_name || p.name) + '" data-unit="' + esc(p.unit||'عدد') + '">'; }).join('') +
      '</datalist>'
    : '';
  var listAttr = _pfWmsProds.length ? ' list="pfWmsList_' + i + '"' : '';
  return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0" id="pfRow_' + i + '">' +
    wmsOpts +
    '<div><label style="font-size:10px;color:#64748b;display:block">کالا</label>' +
      (readOnly
        ? '<span style="font-size:13px">' + esc(item.name || '') + '</span>'
        : '<input class="form-input pf-item-name" data-idx="' + i + '"' + listAttr + ' style="font-size:13px" value="' + esc(item.name||'') + '" placeholder="نام کالا" oninput="_pfRowChange(' + i + ',\'name\',this.value);_pfRowAutofill(' + i + ',this.value)">') +
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

  // Tehran centers
  if (typeof CENTERS !== 'undefined') {
    CENTERS.forEach(function(c) {
      if (results.length < 6 && fNorm(c.name).includes(qn)) {
        results.push({ key: 'center_' + c.id, name: c.name });
      }
    });
  }
  // Province centers
  if (typeof _PC_CACHE !== 'undefined') {
    Object.keys(_PC_CACHE).forEach(function(provId) {
      (_PC_CACHE[provId] || []).forEach(function(c) {
        if (results.length < 10 && fNorm(c.name).includes(qn)) {
          results.push({ key: 'pc_' + c.id, name: c.name });
        }
      });
    });
  }

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
  if (!zone) return;
  zone.innerHTML = _pfPrintHTML(pf);
  window.print();
}

function _pfPrintHTML(pf) {
  var subtotal = pf.subtotal || 0;
  var discAmt  = pf.discAmt  || 0;
  var taxAmt   = pf.taxAmt   || 0;
  var total    = pf.total    || 0;
  var itemRows = (pf.items || []).map(function(item, i) {
    return '<tr>' +
      '<td style="text-align:center">' + (i+1) + '</td>' +
      '<td>' + esc(item.name || '') + '</td>' +
      '<td style="text-align:center">' + esc(item.unit || 'عدد') + '</td>' +
      '<td style="text-align:center">' + fmtNum(item.qty) + '</td>' +
      '<td style="text-align:left;font-family:monospace">' + fmtNum(item.unitPrice) + '</td>' +
      '<td style="text-align:left;font-family:monospace">' + fmtNum(item.lineTotal) + '</td>' +
      '</tr>';
  }).join('');

  return '<div class="pf-print" style="font-family:Vazirmatn,sans-serif;direction:rtl;color:#000;padding:24px;max-width:800px;margin:0 auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f1f35;padding-bottom:12px;margin-bottom:16px">' +
      '<div>' +
        '<div style="font-size:20px;font-weight:800;color:#0f1f35">آتنا زیست درمان</div>' +
        '<div style="font-size:11px;color:#555;margin-top:3px">توزیع‌کننده تجهیزات پزشکی</div>' +
      '</div>' +
      '<div style="border:2px solid #0f1f35;border-radius:6px;padding:10px 16px;text-align:center">' +
        '<div style="font-size:11px;color:#555">شماره پیشفاکتور</div>' +
        '<div style="font-size:18px;font-weight:800;font-family:monospace">' + esc(pf.no) + '</div>' +
        '<div style="font-size:11px;color:#555;margin-top:3px">تاریخ: ' + esc(pf.jalaliDate||'') + '</div>' +
      '</div>' +
    '</div>' +
    '<div style="background:#eff6ff;border:2px solid #2563eb;border-radius:6px;padding:10px 16px;text-align:center;margin-bottom:16px">' +
      '<span style="font-size:17px;font-weight:800;color:#1d4ed8">پیش‌فاکتور فروش</span>' +
      (pf.validDays ? '<span style="font-size:12px;color:#1d4ed8;margin-right:16px">اعتبار: ' + pf.validDays + ' روز</span>' : '') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:16px;font-size:12px">' +
      '<div style="display:flex;gap:6px"><span style="font-weight:700;color:#475569;min-width:80px">مشتری:</span><span>' + esc(pf.centerName||'—') + '</span></div>' +
      '<div style="display:flex;gap:6px"><span style="font-weight:700;color:#475569;min-width:80px">صادرکننده:</span><span>' + esc(_pfCreatorName(pf.createdBy)) + '</span></div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px">' +
      '<thead><tr style="background:#1a2744;color:#fff">' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:center;width:40px">ردیف</th>' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:right">شرح کالا</th>' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:center;width:60px">واحد</th>' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:center;width:60px">تعداد</th>' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:center;width:120px">قیمت واحد (ریال)</th>' +
        '<th style="padding:8px;border:1px solid #1a2744;text-align:center;width:120px">مبلغ کل (ریال)</th>' +
      '</tr></thead>' +
      '<tbody>' + itemRows + '</tbody>' +
      '<tfoot>' +
        (pf.discountPct ? '<tr style="background:#fff7ed"><td colspan="5" style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;text-align:right">تخفیف ' + pf.discountPct + '٪</td><td style="padding:6px 8px;border:1px solid #cbd5e1;font-family:monospace;text-align:left">−' + fmtNum(discAmt) + '</td></tr>' : '') +
        '<tr style="background:#f0f4f8"><td colspan="5" style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;text-align:right">مالیات ' + (pf.taxPct||9) + '٪</td><td style="padding:6px 8px;border:1px solid #cbd5e1;font-family:monospace;text-align:left">+' + fmtNum(taxAmt) + '</td></tr>' +
        '<tr style="background:#f0f4f8"><td colspan="5" style="padding:8px;border:2px solid #1a2744;font-weight:800;text-align:right;font-size:13px">جمع کل (ریال)</td><td style="padding:8px;border:2px solid #1a2744;font-family:monospace;font-weight:800;font-size:13px;text-align:left">' + fmtNum(total) + '</td></tr>' +
      '</tfoot>' +
    '</table>' +
    '<div style="border:1px solid #1a2744;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;background:#f0f4ff">' +
      '<strong>مبلغ به حروف:</strong> ' + _numToWords(total) + ' ریال' +
    '</div>' +
    (pf.note ? '<div style="border:1px dashed #cbd5e1;border-radius:6px;padding:10px;margin-bottom:16px;font-size:12px"><strong>توضیحات:</strong> ' + esc(pf.note) + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:32px">' +
      '<div style="text-align:center"><div style="font-size:12px;font-weight:800;margin-bottom:4px">مهر و امضای فروشنده</div><div style="height:50px"></div><div style="border-top:1px solid #000;padding-top:6px;font-size:10px;color:#666">آتنا زیست درمان</div></div>' +
      '<div style="text-align:center"><div style="font-size:12px;font-weight:800;margin-bottom:4px">مهر و امضای خریدار</div><div style="height:50px"></div><div style="border-top:1px solid #000;padding-top:6px;font-size:10px;color:#666">' + esc(pf.centerName||'') + '</div></div>' +
      '<div style="text-align:center"><div style="font-size:12px;font-weight:800;margin-bottom:4px">تأیید مدیر فروش</div><div style="height:50px"></div><div style="border-top:1px solid #000;padding-top:6px;font-size:10px;color:#666"></div></div>' +
    '</div>' +
    '<div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">' +
      '<span>این پیشفاکتور توسط سیستم Flow CRM آتنا زیست درمان صادر شده است</span>' +
      '<span>' + esc(pf.no) + '</span>' +
    '</div>' +
  '</div>';
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

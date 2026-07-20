// ════════════════════════════════════════════════════════════════════════════
// PROFORMA PHASE 2 — discount gate UI, margin, sort/filter, revision, caps
// ════════════════════════════════════════════════════════════════════════════
'use strict';

var PF_DISCOUNT_CAPS_DEFAULT = {
  'کارشناس فروش': 10, 'بازرگانی': 15, 'مالی': 50, 'مدیر': 100, 'سوپر ادمین': 100,
};

function _pfGetDiscountCaps() {
  if (typeof DB !== 'undefined' && DB.settings && DB.settings.pfDiscountCaps) {
    return Object.assign({}, PF_DISCOUNT_CAPS_DEFAULT, DB.settings.pfDiscountCaps);
  }
  return Object.assign({}, PF_DISCOUNT_CAPS_DEFAULT);
}

function _pfMyDiscCap() {
  var role = 'کارشناس فروش';
  if (typeof umGetMembers === 'function') {
    var m = umGetMembers().find(function(x) { return x.id === currentUser; });
    if (m) role = m.role || role;
  }
  return _pfGetDiscountCaps()[role] != null ? _pfGetDiscountCaps()[role] : 10;
}

function _pfCanSeeMargin() {
  if (typeof _pfIsManager === 'function' && _pfIsManager()) return true;
  var role = '';
  if (typeof umGetMembers === 'function') {
    var m = umGetMembers().find(function(x) { return x.id === currentUser; });
    role = m ? m.role : '';
  }
  return role === 'مالی' || role === 'سوپر ادمین';
}

function _pfCanApproveDiscount() {
  return _pfCanSeeMargin();
}

function _pfItemMarginPct(item, globalDiscPct) {
  var cost = Number(item.unitCost) || 0;
  var price = Number(item.unitPrice) || 0;
  if (!cost || !price) return null;
  var afterLineDisc = price * (1 - (Number(item.discPct) || 0) / 100);
  var gDisc = globalDiscPct != null
    ? Number(globalDiscPct) || 0
    : Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0) || 0;
  var afterDisc = afterLineDisc * (1 - gDisc / 100);
  if (!afterDisc) return null;
  return Math.round((afterDisc - cost) / afterDisc * 1000) / 10;
}

function _pfMaxDisc(pf) {
  var h = Number(pf.discountPct) || 0;
  (pf.items || []).forEach(function(it) {
    var d = Number(it.discPct) || 0;
    if (d > h) h = d;
  });
  return h;
}

// ── Multi-sort + AND/OR (extends analytics) ────────────────────────────────
var _pfFilterLogic = 'AND';
var _pfSortStack = [{ field: 'date', dir: 'desc' }];

function _pfToggleFilterLogic() {
  _pfFilterLogic = _pfFilterLogic === 'AND' ? 'OR' : 'AND';
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfAddSortField(field) {
  var existing = _pfSortStack.find(function(s) { return s.field === field; });
  if (existing) existing.dir = existing.dir === 'asc' ? 'desc' : 'asc';
  else _pfSortStack.push({ field: field, dir: 'desc' });
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfApplySort(list) {
  var stack = _pfSortStack.length ? _pfSortStack : [{ field: 'date', dir: 'desc' }];
  return list.slice().sort(function(a, b) {
    for (var i = 0; i < stack.length; i++) {
      var s = stack[i];
      var av, bv;
      if (s.field === 'amount') { av = _pfPfAmount(a); bv = _pfPfAmount(b); }
      else if (s.field === 'center') { av = a.centerName || ''; bv = b.centerName || ''; }
      else if (s.field === 'status') { av = a.status || ''; bv = b.status || ''; }
      else { av = a.jalaliDate || ''; bv = b.jalaliDate || ''; }
      if (av < bv) return s.dir === 'asc' ? -1 : 1;
      if (av > bv) return s.dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function _pfApplyOrSearch(list) {
  if (_pfFilterLogic !== 'OR') return list;
  var q = (_pfSearch || '').trim();
  if (!q && !_pfOwnerF && !_pfCatF && !_pfProdF && !_pfChannelF) return list;
  var groups = [];
  if (q) groups.push(function(pf) {
    var qn = fNorm(q);
    return fNorm(pf.centerName || '').indexOf(qn) !== -1 || fNorm(pf.no || '').indexOf(qn) !== -1;
  });
  if (_pfOwnerF) groups.push(function(pf) {
    return _pfResolveOwnerId(_pfGetResponsibleId(pf)) === _pfResolveOwnerId(_pfOwnerF);
  });
  if (_pfCatF) groups.push(function(pf) {
    return (pf.items || []).some(function(it) { return _pfItemCategory(it) === _pfCatF; });
  });
  if (_pfProdF) groups.push(function(pf) {
    return (pf.items || []).some(function(it) {
      return String(it.prodId || '') === _pfProdF || String(it.catalogCode || '') === _pfProdF;
    });
  });
  if (_pfChannelF) groups.push(function(pf) { return (pf.channel || 'direct') === _pfChannelF; });
  if (!groups.length) return list;
  return list.filter(function(pf) {
    return groups.some(function(fn) { return fn(pf); });
  });
}

function _pfBuildSortBar() {
  var fields = [
    { id: 'date', label: 'تاریخ' },
    { id: 'amount', label: 'مبلغ' },
    { id: 'center', label: 'مرکز' },
    { id: 'status', label: 'وضعیت' },
  ];
  return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:11px">' +
    '<span style="color:#64748b;font-weight:600">مرتب‌سازی:</span>' +
    fields.map(function(f) {
      var active = _pfSortStack.find(function(s) { return s.field === f.id; });
      return '<button onclick="_pfAddSortField(\'' + f.id + '\')" style="padding:3px 8px;border-radius:6px;border:1px solid ' +
        (active ? 'var(--brand)' : '#e2e8f0') + ';background:' + (active ? '#eef2ff' : 'white') + ';font-family:inherit;cursor:pointer">' +
        f.label + (active ? (active.dir === 'asc' ? ' ↑' : ' ↓') : '') + '</button>';
    }).join('') +
    '<span style="margin-right:8px;color:#cbd5e1">|</span>' +
    '<button onclick="_pfToggleFilterLogic()" style="padding:3px 10px;border-radius:6px;border:1px solid #fcd34d;background:#fef3c7;font-family:inherit;cursor:pointer;font-weight:600" title="منطق ترکیب فیلترها">' +
      'منطق: ' + _pfFilterLogic + '</button>' +
    '<span style="color:#94a3b8;margin-right:6px">سقف تخفیف شما: ' + _pfMyDiscCap() + '٪</span>' +
  '</div>';
}

async function pfCreateRevision(pfId) {
  if (!confirm('نسخه جدید (اصلاحیه) از این پیش‌فاکتور ساخته شود؟')) return;
  try {
    var r = await fetch('/api/proforma/' + pfId + '/revise', { method: 'POST' });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    showToast('✅ نسخه جدید ' + data.no + ' ساخته شد');
    await pfLoad();
    var el = _pfRoot();
    if (el) _renderPfPanel(el);
    if (typeof pfOpenEdit === 'function') pfOpenEdit(data.id);
  } catch (e) { showToast('❌ ' + e.message); }
}

async function pfApproveDiscount(pfId) {
  if (typeof pfAction === 'function') await pfAction(pfId, 'approve_disc', 'تأیید تخفیف');
}

async function pfRejectDiscount(pfId) {
  var note = prompt('دلیل رد تخفیف (اختیاری):') || '';
  if (typeof pfAction === 'function') await pfAction(pfId, 'reject_disc', note);
}

function _pfPhase2Wrap() {
  if (typeof PF_STATUS !== 'undefined' && !PF_STATUS.pending_disc) {
    PF_STATUS.pending_disc = { label: 'انتظار تأیید تخفیف', short: 'تخفیف', cls: 'bo' };
  }

  if (typeof _pfGetFilteredList === 'function' && !_pfGetFilteredList._phase2) {
    var orig = _pfGetFilteredList;
    _pfGetFilteredList = function() {
      var byStatus = _pfFilter === 'all' ? _pfList : _pfList.filter(function(p) { return p.status === _pfFilter; });
      var list = _pfFilterLogic === 'OR' ? _pfApplyOrSearch(byStatus) : _pfApplySearch(byStatus);
      if (_pfFilterLogic === 'OR' && typeof _pfApplyAdvancedFilters === 'function') list = _pfApplyAdvancedFilters(list);
      return _pfApplySort(list);
    };
    _pfGetFilteredList._phase2 = true;
  }

  if (typeof _pfActions === 'function' && !_pfActions._phase2) {
    var origActs = _pfActions;
    _pfActions = function(pf) {
      var html = origActs(pf);
      var extra = [];
      if (pf.status === 'pending_disc' && _pfCanApproveDiscount()) {
        extra.push('<button onclick="pfApproveDiscount(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #16a34a;border-radius:5px;background:#f0fdf4;color:#15803d;cursor:pointer;font-weight:600">✅ تأیید تخفیف</button>');
        extra.push('<button onclick="pfRejectDiscount(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #dc2626;border-radius:5px;background:#fef2f2;color:#b91c1c;cursor:pointer">❌ رد تخفیف</button>');
      }
      if (pf.parentProformaId) {
        extra.push('<span style="font-size:10px;color:#64748b" title="نسخه از PF قبلی">↳ rev</span>');
      }
      if (['approved','rejected','expired','cancelled','sent','negotiating'].includes(pf.status)) {
        extra.push('<button onclick="pfCreateRevision(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #bae6fd;border-radius:5px;background:#f0f9ff;color:#0284c7;cursor:pointer" title="نسخه جدید">🔄 نسخه</button>');
      }
      if (!extra.length) return html;
      return html.replace('</span>', ' ' + extra.join(' ') + '</span>');
    };
    _pfActions._phase2 = true;
  }

  if (typeof _renderPfPanel === 'function' && !_renderPfPanel._phase2Sort) {
    var origRender = _renderPfPanel;
    _renderPfPanel = function(el) {
      origRender(el);
      if (!el) return;
      var sb = document.getElementById('pfSortBar');
      if (!sb) {
        var searchBar = document.getElementById('pfSearchBar');
        if (searchBar) searchBar.insertAdjacentHTML('beforebegin', '<div id="pfSortBar">' + _pfBuildSortBar() + '</div>');
      } else {
        sb.innerHTML = _pfBuildSortBar();
      }
      if (!['all','pending_disc'].includes(_pfFilter)) { /* ok */ }
    };
    _renderPfPanel._phase2Sort = true;
  }

  // Extend pfAddProductRow for unitCost
  if (typeof pfAddProductRow === 'function' && !pfAddProductRow._costWrapped) {
    var origAdd = pfAddProductRow;
    pfAddProductRow = function(prodId, name, unit, salePrice, catalogCode, unitCost) {
      var resolved = Number(unitCost) || 0;
      if (!resolved && typeof _pfResolveUnitCost === 'function') resolved = _pfResolveUnitCost(prodId);
      origAdd(prodId, name, unit, salePrice, catalogCode, resolved);
    };
    pfAddProductRow._costWrapped = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _pfPhase2Wrap);
} else {
  setTimeout(_pfPhase2Wrap, 150);
}

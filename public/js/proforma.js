// ════════════════════════════════════════════════════════════════════════════
// PROFORMA MODULE — پیشفاکتور
// Workflow: draft → sent → negotiating → approved/rejected/expired → invoiced
// ════════════════════════════════════════════════════════════════════════════
'use strict';

// ── State ─────────────────────────────────────────────────────────────────
var _pfList = [];
var _pfFilter = 'all';   // all | draft | sent | approved | rejected | cancelled
var _pfPage   = 0;
var _pfEditId = null;    // currently open modal id (null = new)
var _pfItems  = [];      // rows in open modal
var _pfWmsProds = [];    // WMS product list (fetched once per session)
var _pfWmsProdTs = 0;   // timestamp of last fetch (ms)
var _pfWarehouses = []; // WMS warehouses for dispatch target
var _pfProdViewMode = 'tree'; // 'tree' | 'list'
var _pfProdSearch = '';
var _pfActiveCat = null; // expanded category in tree view
var _pfSearch    = '';   // live search query
var _pfOwnerF    = '';   // owner/creator filter
var _pfCatF      = '';   // category filter
var _pfProdF     = '';   // product filter
var _pfExpanded  = {};   // expanded row IDs in list {pfId: true}
var _pfCenterMap = [];  // center lookup for proforma list clicks
var _pfOpenPf = null;   // proforma object currently open in modal
var _pfPendingNewCenter = null; // { centerKey, centerName } from center profile
var _pfStats = null;    // cached stats from /api/proforma/stats

function _pfRoot() {
  return document.getElementById('pfVanillaRoot');
}

// ── Status labels & colors ───────────────────────────────────────────────
var PF_STATUS = {
  draft:       { label: 'پیش‌نویس',    cls: 'bgr' },
  sent:        { label: 'ارسال شده',   cls: 'bb'  },
  negotiating: { label: 'در مذاکره',   cls: 'bo'  },
  pending_disc: { label: 'انتظار تأیید تخفیف', cls: 'bo' },
  approved:    { label: 'تأیید شده',  cls: 'bg'  },
  rejected:    { label: 'رد شده',     cls: 'br'  },
  cancelled:   { label: 'لغو شده',    cls: 'by'  },
  invoiced:    { label: 'فاکتور شده', cls: 'bc'  },
  expired:     { label: 'منقضی شده',  cls: 'bk'  },
};

function pfStatusBadge(s) {
  var st = PF_STATUS[s] || { label: s, cls: 'bgr' };
  return '<span class="status-badge status-' + s + '">' + st.label + '</span>';
}

function _pfIsManager() {
  return typeof _isManager === 'function' && _isManager();
}

function _pfCanUploadAttachments(pf) {
  var pfId = (pf && pf.id) || _pfEditId;
  if (!pfId) return false;
  var status = pf ? pf.status : 'draft';
  var isOwner = pf && pf.createdBy === currentUser;
  if (status === 'draft' || status === 'sent') return isOwner || _pfIsManager();
  if (status === 'approved') return _pfIsManager();
  return false;
}

function _pfCanDeleteFile(pf, file) {
  if (!pf) return true;
  if (pf.status === 'draft') return (file.uploaded_by === currentUser) || _pfIsManager();
  return _pfIsManager();
}

async function _pfLoadWarehouses() {
  if (_pfWarehouses.length) return;
  try {
    var r = await fetch('/api/wms/warehouses');
    if (r.ok) {
      var list = await r.json();
      _pfWarehouses = (list || []).filter(function(w) { return w.active !== false; });
    }
  } catch (e) { /* ignore */ }
}

async function pfWarehouseChange(sel) {
  if (!_pfEditId) return;
  var whId = sel.value || '';
  try {
    var r = await fetch('/api/proforma/' + _pfEditId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wmsWarehouseId: whId }),
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا در ذخیره انبار')); return; }
    showToast('✅ انبار خروج ذخیره شد');
  } catch (e) {
    showToast('❌ ' + e.message);
  }
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

async function _pfLoadStats() {
  try {
    var r = await fetch('/api/proforma/stats');
    if (r.ok) _pfStats = await r.json();
    else _pfStats = null;
  } catch (e) {
    _pfStats = null;
  }
}

function _pfStatsBarHtml() {
  if (!_pfStats || !_pfStats.ok) return '';
  var t = _pfStats.totals || {};
  var bySt = {};
  (_pfStats.byStatus || []).forEach(function(s) { bySt[s.status] = s; });
  var approved = (bySt.approved && bySt.approved.count) || t.approved || 0;
  var draft = (bySt.draft && bySt.draft.count) || 0;
  var sent = (bySt.sent && bySt.sent.count) || 0;
  var invoiced = (bySt.invoiced && bySt.invoiced.count) || 0;
  var approvedVal = Number(t.approved_value || 0);
  var cycle = t.avg_cycle_days != null ? Number(t.avg_cycle_days) : null;
  return '<div data-pf-stats="1" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:12px 14px;background:linear-gradient(135deg,#f5f3ff,#eff6ff);border:1px solid #ddd6fe;border-radius:10px">' +
    '<div style="width:100%;font-size:11px;font-weight:700;color:#6d28d9;margin-bottom:2px">📊 آمار پیشفاکتور (SQL)</div>' +
    '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#6366f1">' + (t.total || _pfList.length) + '</div><div style="font-size:10px;color:#64748b">کل</div></div>' +
    '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#15803d">' + approved + '</div><div style="font-size:10px;color:#64748b">تأیید/فاکتور</div></div>' +
    '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#0284c7">' + sent + '</div><div style="font-size:10px;color:#64748b">ارسال‌شده</div></div>' +
    '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#94a3b8">' + draft + '</div><div style="font-size:10px;color:#64748b">پیش‌نویس</div></div>' +
    '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#7c3aed">' + invoiced + '</div><div style="font-size:10px;color:#64748b">فاکتور شده</div></div>' +
    '<div style="flex:1;min-width:120px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:14px;font-weight:800;color:#0f766e">' + approvedVal.toLocaleString('fa-IR') + '</div><div style="font-size:10px;color:#64748b">ارزش تأیید (ریال)</div></div>' +
    (cycle != null ? '<div style="flex:1;min-width:90px;text-align:center;background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0"><div style="font-size:18px;font-weight:800;color:#c2410c">' + cycle + '</div><div style="font-size:10px;color:#64748b">میانگین چرخه (روز)</div></div>' : '') +
    '</div>';
}

// ── Render tab panel ─────────────────────────────────────────────────────
async function renderProformaPanel() {
  var el = _pfRoot();
  if (!el) return;
  try {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">در حال بارگذاری…</div>';
    await pfLoad();
    await _pfLoadStats();
    await _pfLoadWmsProds();
    if (typeof buildUSERS === 'function') buildUSERS();
    _pfEnsureCenterCache();
    _renderPfPanel(el);
    _pfHandleDeepLink();
    if (_pfPendingNewCenter || window.__pfPendingNewCenter) {
      _pfConsumePendingNewCenter().catch(function(e) {
        console.error('[proforma] pending new center:', e);
        if (typeof showToast === 'function') showToast('خطا در باز کردن فرم پیشفاکتور');
      });
    }
  } catch(e) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626">خطا: ' + (e && e.message ? e.message : String(e)) + '</div>';
    console.error('[proforma] renderProformaPanel error:', e);
  }
}


function _pfEnsureCenterCache() {
  if (typeof _buildPCCache === 'function') { try { _buildPCCache(); } catch (_) {} }
}

function _pfGetResponsibleId(pf) {
  if (!pf) return '';
  _pfEnsureCenterCache();
  var centerOwner = _pfResolveOwnerId(_pfGetCenterOwnerId(pf.centerKey) || '');
  var created = _pfResolveOwnerId(pf.createdBy || '');
  var salesRaw = pf.salesOwner != null ? String(pf.salesOwner).trim() : '';
  var sales = salesRaw ? _pfResolveOwnerId(salesRaw) : '';
  // مسئول فروش صریح (فقط اگر با ثبت‌کننده متفاوت باشد — نه مقدار پیش‌فرض خودکار)
  if (sales && sales !== created) return sales;
  if (centerOwner) return centerOwner;
  if (sales) return sales;
  return created;
}

function _pfGetResponsibleName(pf) {
  var id = _pfGetResponsibleId(pf);
  return id ? _pfCreatorName(id) : 'نامشخص';
}

function _pfGetFilteredList() {
  var byStatus = _pfFilter === 'all' ? _pfList : _pfList.filter(function(p) { return p.status === _pfFilter; });
  return _pfApplySearch(byStatus);
}

function _pfApplySearch(list) {
  var q = (_pfSearch || '').trim();
  var owner = _pfOwnerF || '';
  var catF = _pfCatF || '';
  var prodF = _pfProdF || '';
  if (!q && !owner && !catF && !prodF) return list;
  var qn = q ? fNorm(q) : '';
  var wantOwner = owner ? _pfResolveOwnerId(owner) : '';
  return list.filter(function(pf) {
    if (wantOwner) {
      if (_pfResolveOwnerId(_pfGetResponsibleId(pf)) !== wantOwner) return false;
    }
    if (catF) {
      var hasCat = (pf.items || []).some(function(it) { return _pfItemCategory(it) === catF; });
      if (!hasCat) return false;
    }
    if (prodF) {
      var hasProd = (pf.items || []).some(function(it) {
        return String(it.prodId || '') === prodF ||
          String(it.catalogCode || '') === prodF ||
          String(it.name || '') === prodF;
      });
      if (!hasProd) return false;
    }
    if (!qn) return true;
    if (fNorm(pf.centerName || '').indexOf(qn) !== -1) return true;
    if (fNorm(pf.no || '').indexOf(qn) !== -1) return true;
    if (fNorm(_pfGetResponsibleName(pf) || '').indexOf(qn) !== -1) return true;
    if (fNorm(_pfCreatorName(pf.createdBy) || '').indexOf(qn) !== -1) return true;
    if ((pf.items || []).some(function(it) {
      return fNorm(it.name || '').indexOf(qn) !== -1 ||
             fNorm(it.catalogCode || '').indexOf(qn) !== -1 ||
             fNorm(_pfItemCategory(it) || '').indexOf(qn) !== -1;
    })) return true;
    return false;
  });
}

function _pfOnSearchInput(val) {
  _pfSearch = val;
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfOnOwnerFilter(val) {
  _pfOwnerF = val;
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfOnCatFilter(val) {
  _pfCatF = val;
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfOnProdFilter(val) {
  _pfProdF = val;
  _pfPage = 0;
  _pfRefreshListDom();
}

function _pfGetExpertMembers() {
  var map = {};
  function add(id, name) {
    if (!id || id === 'guest') return;
    if (!map[id]) map[id] = name || (typeof _pfCreatorName === 'function' ? _pfCreatorName(id) : id);
  }
  if (typeof umGetActive === 'function') {
    umGetActive().forEach(function(m) { add(m.id, m.name); });
  } else if (typeof DB !== 'undefined' && DB.settings && DB.settings.members) {
    DB.settings.members.filter(function(m) { return m.active !== false; }).forEach(function(m) { add(m.id, m.name); });
  }
  (_pfList || []).forEach(function(pf) {
    var oid = _pfGetResponsibleId(pf);
    if (oid) add(oid, _pfGetResponsibleName(pf));
  });
  if (typeof USERS !== 'undefined') {
    Object.keys(USERS).forEach(function(k) {
      if (k !== 'guest' && !map[k]) add(k, USERS[k]);
    });
  }
  return Object.keys(map).map(function(id) { return { id: id, name: map[id] }; })
    .sort(function(a, b) { return String(a.name).localeCompare(String(b.name), 'fa'); });
}

function _pfCategoryOptions() {
  var cats = {};
  (_pfWmsProds || []).forEach(function(p) {
    var cat = p.category || 'سایر';
    cats[cat] = true;
  });
  (_pfList || []).forEach(function(pf) {
    (pf.items || []).forEach(function(it) { cats[_pfItemCategory(it)] = true; });
  });
  return Object.keys(cats).sort(function(a, b) { return a.localeCompare(b, 'fa'); });
}

function _pfProductOptions() {
  var seen = {};
  var out = [];
  function addProd(key, label) {
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push({ id: key, label: label || key });
  }
  (_pfWmsProds || []).forEach(function(p) {
    var key = String(p.catalog_code || p.catalogCode || p.id || '');
    if (!key) return;
    addProd(key, (p.full_name || p.name || key) + (p.catalog_code ? ' · ' + p.catalog_code : ''));
  });
  (_pfList || []).forEach(function(pf) {
    (pf.items || []).forEach(function(it) {
      var key = String(it.catalogCode || it.prodId || it.name || '');
      if (key) addProd(key, (it.name || key) + (it.catalogCode ? ' · ' + it.catalogCode : ''));
    });
  });
  return out.sort(function(a, b) { return a.label.localeCompare(b.label, 'fa'); });
}

function _pfClearFilters() {
  _pfSearch = '';
  _pfOwnerF = '';
  _pfCatF = '';
  _pfProdF = '';
  _pfPage = 0;
  var si = document.getElementById('pfSearchInp');
  var so = document.getElementById('pfOwnerSel');
  var sc = document.getElementById('pfCatSel');
  var sp = document.getElementById('pfProdSel');
  if (si) si.value = '';
  if (so) so.value = '';
  if (sc) sc.value = '';
  if (sp) sp.value = '';
  _pfRefreshListDom();
}

function _pfSyncFiltersFromDom() {
  var si = document.getElementById('pfSearchInp');
  var so = document.getElementById('pfOwnerSel');
  var sc = document.getElementById('pfCatSel');
  var sp = document.getElementById('pfProdSel');
  if (si) _pfSearch = si.value;
  if (so) _pfOwnerF = so.value;
  if (sc) _pfCatF = sc.value;
  if (sp) _pfProdF = sp.value;
}

function _pfToggleExpand(id) {
  _pfExpanded[id] = !_pfExpanded[id];
  _pfRefreshListDom();
}

function _pfBuildRowsHtml(pageItems) {
  return pageItems.map(function(pf) {
    var st = PF_STATUS[pf.status] || { label: pf.status, cls: 'bgr' };
    var actions = _pfActions(pf);
    var isExpanded = !!_pfExpanded[pf.id];
    var commBadge = pf.hasCommission ? '<span style="display:inline-block;margin-right:4px;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">💸 پورسانت ' + (pf.commissionAmt ? fmtNum(pf.commissionAmt) + ' ﷼' : '') + '</span>' : '';
    var verBadge = pf.versions && pf.versions.length ? '<span style="background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;border-radius:10px;padding:1px 6px;font-size:10px" title="' + pf.versions.length + ' نسخه قبلی">' + pf.versions.length + 'v</span>' : '';
    var respName = _pfGetResponsibleName(pf);
    var expDate = pf.expiryDate || (typeof _pfComputeExpiry === 'function' ? _pfComputeExpiry(pf) : '');
    var expHint = (expDate && ['sent','negotiating','draft'].includes(pf.status))
      ? '<div style="font-size:10px;color:#b45309;margin-top:2px" title="تاریخ انقضا">⏳ ' + esc(expDate) + '</div>' : '';
    var lossHint = (pf.status === 'rejected' && pf.lossReason)
      ? '<div style="font-size:10px;color:#b91c1c;margin-top:2px">' + esc((typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS[pf.lossReason] : pf.lossReason) || '') + '</div>' : '';
    var mainRow = '<tr style="border-bottom:' + (isExpanded?'none':'1px solid #f1f5f9') + ';transition:background .15s" ' +
      'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">' +
      '<td style="padding:10px 12px">' +
        '<button onclick="_pfToggleExpand(\'' + pf.id + '\')" style="background:none;border:none;cursor:pointer;color:#64748b;font-size:13px;margin-left:4px;padding:0 4px" title="' + (isExpanded?'بستن':'نمایش کالاها') + '">' + (isExpanded?'▼':'▶') + '</button>' +
        '<span style="font-family:monospace;font-size:12px;color:#0284c7;font-weight:700">' + esc(pf.no) + '</span>' +
        (verBadge ? ' ' + verBadge : '') +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:#475569">' + esc(pf.jalaliDate || '') + expHint + '</td>' +
      '<td style="padding:10px 12px">' +
        (pf.centerKey
          ? '<div onclick="pfCenterClick(' + (_pfCenterMap.push({key:pf.centerKey,name:pf.centerName||''}) - 1) + ')" style="font-weight:600;font-size:13px;color:#0284c7;cursor:pointer;text-decoration:underline;text-underline-offset:2px">' + esc(pf.centerName || '\u2014') + '</div>'
          : '<div style="font-weight:600;font-size:13px">' + esc(pf.centerName || '\u2014') + '</div>') +
        commBadge +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:#64748b">' + ((pf.items||[]).length) + ' ردیف</td>' +
      '<td style="padding:10px 12px;font-family:monospace;font-size:13px;color:#1e293b;font-weight:600">' + fmtNum(pf.total) + ' ﷼</td>' +
      '<td style="padding:10px 12px"><span class="status-badge" style="background:' + _badgeBg(pf.status) + ';color:' + _badgeFg(pf.status) + ';padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">' + st.label + '</span>' + lossHint + '</td>' +
      '<td style="padding:10px 12px;font-size:12px" title="' + esc(_pfCreatorName(pf.createdBy)) + '">' + esc(respName) + '</td>' +
      '<td style="padding:10px 12px;white-space:nowrap">' + actions + '</td>' +
      '</tr>';

    var expandRow = '';
    if (isExpanded) {
      var itemsHtml = (pf.items || []).length
        ? '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
            '<thead><tr style="background:#f0f9ff">' +
              '<th style="padding:5px 10px;text-align:right;color:#0369a1;font-weight:600">کد کاتالوگ</th>' +
              '<th style="padding:5px 10px;text-align:right;color:#0369a1;font-weight:600">نام کالا</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">دسته</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">تعداد</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">واحد</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">قیمت واحد</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">تخفیف</th>' +
              '<th style="padding:5px 10px;text-align:center;color:#0369a1;font-weight:600">جمع ردیف</th>' +
            '</tr></thead>' +
            '<tbody>' +
            (pf.items || []).map(function(it, idx) {
              var disc = it.discPct ? it.discPct + '٪' : '—';
              return '<tr style="border-top:1px solid #e0f2fe' + (idx%2===1?';background:#f8fbff':'') + '">' +
                '<td style="padding:5px 10px;font-family:monospace;color:#0284c7">' + esc(it.catalogCode || it.prodId || '—') + '</td>' +
                '<td style="padding:5px 10px;font-weight:600">' + esc(it.name || '') + '</td>' +
                '<td style="padding:5px 10px;text-align:center;font-size:11px;color:#64748b">' + esc(_pfItemCategory(it)) + '</td>' +
                '<td style="padding:5px 10px;text-align:center">' + fmtNum(it.qty) + '</td>' +
                '<td style="padding:5px 10px;text-align:center;color:#64748b">' + esc(it.unit||'عدد') + '</td>' +
                '<td style="padding:5px 10px;text-align:center;font-family:monospace">' + fmtNum(it.unitPrice) + '</td>' +
                '<td style="padding:5px 10px;text-align:center;color:#c2410c">' + disc + '</td>' +
                '<td style="padding:5px 10px;text-align:center;font-family:monospace;font-weight:700;color:#15803d">' + fmtNum(_pfItemAmount(it, pf)) + '</td>' +
              '</tr>';
            }).join('') +
            '</tbody></table>'
        : '<div style="padding:12px;color:#94a3b8;text-align:center">ردیفی ثبت نشده</div>';

      expandRow = '<tr><td colspan="8" style="padding:0 0 8px 32px;background:#f8fbff;border-bottom:1px solid #e2e8f0">' +
        '<div style="border:1px solid #bae6fd;border-radius:8px;overflow:hidden;margin:4px 12px 4px 0">' +
          itemsHtml +
        '</div>' +
        (pf.commissionAmt||pf.commissionNote ? '<div style="padding:6px 12px;font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;margin:4px 12px 0 0">' +
          '💸 <strong>پورسانت:</strong> ' + (pf.commissionAmt?fmtNum(pf.commissionAmt)+' ﷼ ':'') + esc(pf.commissionNote||'') +
        '</div>' : '') +
      '</td></tr>';
    }
    return mainRow + expandRow;
  }).join('');
}

function _pfRefreshListDom() {
  var tbody = document.getElementById('pfListTbody');
  var countEl = document.getElementById('pfListCount');
  var moreWrap = document.getElementById('pfListMoreWrap');
  var clearBtn = document.getElementById('pfClearFiltersBtn');
  if (!tbody) {
    var el = _pfRoot();
    if (el) _renderPfPanel(el);
    return;
  }
  var filtered = _pfGetFilteredList();
  var PER_PAGE = 25;
  var pageItems = filtered.slice(0, (_pfPage + 1) * PER_PAGE);
  var hasMore = filtered.length > pageItems.length;
  _pfCenterMap = [];
  tbody.innerHTML = pageItems.length ? _pfBuildRowsHtml(pageItems) : '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">پیشفاکتوری یافت نشد</td></tr>';
  if (countEl) countEl.textContent = filtered.length + ' پیش\u200cفاکتور';
  if (clearBtn) clearBtn.style.display = (_pfSearch || _pfOwnerF || _pfCatF || _pfProdF || _pfDateFrom || _pfDateTo || _pfChannelF || _pfQuickF) ? '' : 'none';
  if (moreWrap) {
    moreWrap.innerHTML = hasMore
      ? '<button onclick="_pfLoadMore()" style="padding:8px 24px;border:1px solid var(--brand);background:white;color:var(--brand);border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer">\u2b07 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0628\u06cc\u0634\u062a\u0631 (' + (filtered.length - pageItems.length) + ' \u0645\u0648\u0631\u062f \u062f\u06cc\u06af\u0631)</button>'
      : '';
  }
}

function _renderPfPanel(el) {
  _pfSyncFiltersFromDom();
  _pfEnsureCenterCache();
  var filtered = _pfGetFilteredList();
  var isManager = _isManager();
  var PER_PAGE = 25;
  var pageItems = filtered.slice(0, (_pfPage + 1) * PER_PAGE);
  var hasMore = filtered.length > pageItems.length;

  var members = _pfGetExpertMembers();
  var catOpts = '<option value="">همه دسته‌ها</option>' +
    _pfCategoryOptions().map(function(cat) {
      return '<option value="' + esc(cat) + '"' + (_pfCatF === cat ? ' selected' : '') + '>' + esc(cat) + '</option>';
    }).join('');
  var prodOpts = '<option value="">همه کالاها</option>' +
    _pfProductOptions().map(function(p) {
      return '<option value="' + esc(p.id) + '"' + (_pfProdF === p.id ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    }).join('');

  var filterBtns = ['all','draft','pending_disc','sent','negotiating','approved','rejected','cancelled','invoiced','expired'].map(function(s) {
    var lbl = s === 'all' ? 'همه' : (s === 'invoiced' ? 'فاکتور شده' : (s === 'pending_disc' ? 'تأیید تخفیف' : (PF_STATUS[s] || { label: s }).label));
    var cnt = s === 'all' ? _pfList.length : _pfList.filter(function(p){ return p.status === s; }).length;
    return '<button onclick="_pfSetFilter(\'' + s + '\')" style="padding:5px 12px;border-radius:20px;border:1px solid ' +
      (_pfFilter === s ? 'var(--brand)' : '#e2e8f0') + ';background:' +
      (_pfFilter === s ? 'var(--brand)' : 'white') + ';color:' +
      (_pfFilter === s ? 'white' : '#64748b') + ';font-size:12px;font-family:inherit;cursor:pointer">' +
      lbl + (cnt ? ' <span style="background:rgba(0,0,0,.12);border-radius:10px;padding:0 6px;font-size:10px">' + cnt + '</span>' : '') + '</button>';
  }).join('');

  var ownerOpts = '<option value="">همه کارشناسان</option>' +
    members.map(function(m) {
      return '<option value="' + esc(m.id) + '"' + (_pfOwnerF === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }).join('');

  var searchBar =
    '<div id="pfSearchBar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px">' +
      '<input id="pfSearchInp" type="text" placeholder="🔍 جستجو: مرکز، کالا، دسته، مسئول..." value="' + esc(_pfSearch) + '" ' +
        'oninput="_pfOnSearchInput(this.value)" ' +
        'style="flex:1;min-width:180px;padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:13px;outline:none" autocomplete="off">' +
      '<select id="pfOwnerSel" onchange="_pfOnOwnerFilter(this.value)" title="کارشناس" ' +
        'style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:12px;min-width:130px;max-width:160px">' +
        ownerOpts +
      '</select>' +
      '<select id="pfCatSel" onchange="_pfOnCatFilter(this.value)" title="دسته کالا" ' +
        'style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:12px;min-width:120px;max-width:150px">' +
        catOpts +
      '</select>' +
      '<select id="pfProdSel" onchange="_pfOnProdFilter(this.value)" title="کالای خاص" ' +
        'style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:12px;min-width:140px;max-width:220px">' +
        prodOpts +
      '</select>' +
      '<button id="pfClearFiltersBtn" onclick="typeof _pfClearAllFilters===\'function\'?_pfClearAllFilters():_pfClearFilters()" style="padding:6px 12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;' + ((_pfSearch||_pfOwnerF||_pfCatF||_pfProdF)?'':'display:none') + '">✕ پاک</button>' +
      '<span id="pfListCount" style="font-size:12px;color:#94a3b8;white-space:nowrap">' + filtered.length + ' \u067eیش‌\u0641ا\u06a9\u062a\u0648\u0631</span>' +
    '</div>';

  _pfCenterMap = [];
  var rows = pageItems.length ? _pfBuildRowsHtml(pageItems) : '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">پیشفاکتوری یافت نشد</td></tr>';

  el.innerHTML = _pfStatsBarHtml() + _pfBuildPendingQueueHtml() +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + filterBtns + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        '<button onclick="pfOpenNew()" style="padding:8px 16px;background:var(--brand);color:white;border:none;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:600">+ \u067e\u06cc\u0634\u0641\u0627\u06a9\u062a\u0648\u0631 \u062c\u062f\u06cc\u062f</button>' +
(isManager ? '<button onclick="pfManageTemplates()" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer" title="\u0645\u062f\u06cc\u0631\u06cc\u062a \u0642\u0627\u0644\u0628\u200c\u0647\u0627\u06cc \u0686\u0627\u067e">\ud83c\udfa8 \u0642\u0627\u0644\u0628\u200c\u0647\u0627\u06cc \u0686\u0627\u067e</button>' +
                     '<button onclick="pfOpenSellerEditor()" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer" title="\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0645\u0634\u062e\u0635\u0627\u062a \u0641\u0631\u0648\u0634\u0646\u062f\u0647">\ud83c\udfe2 \u0641\u0631\u0648\u0634\u0646\u062f\u0647</button>' : '') +
      '</div>' +
    '</div>' +
    searchBar +
    '<div style="overflow-x:auto;background:white;border:1px solid #e2e8f0;border-radius:10px">' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0634\u0645\u0627\u0631\u0647</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u062a\u0627\u0631\u06cc\u062e</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0645\u0631\u06a9\u0632 / \u0645\u0634\u062a\u0631\u06cc</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u06a9\u0627\u0644\u0627\u0647\u0627</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0645\u0628\u0644\u063a \u06a9\u0644</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0648\u0636\u0639\u06cc\u062a</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0645\u0633\u0626\u0648\u0644</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0639\u0645\u0644\u06cc\u0627\u062a</th>' +
        '</tr></thead>' +
        '<tbody id="pfListTbody">' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div id="pfListMoreWrap" style="text-align:center;margin-top:12px">' +
      (hasMore ? '<button onclick="_pfLoadMore()" style="padding:8px 24px;border:1px solid var(--brand);background:white;color:var(--brand);border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer">\u2b07 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0628\u06cc\u0634\u062a\u0631 (' + (filtered.length - pageItems.length) + ' \u0645\u0648\u0631\u062f \u062f\u06cc\u06af\u0631)</button>' : '') +
    '</div>';
}

function _badgeBg(s) {
  return { draft:'#f1f5f9', sent:'#eff6ff', negotiating:'#fef3c7', pending_disc:'#ffedd5', approved:'#dcfce7', rejected:'#fee2e2', cancelled:'#fff7ed', invoiced:'#e0f2fe', expired:'#fce7f3' }[s] || '#f1f5f9';
}
function _badgeFg(s) {
  return { draft:'#475569', sent:'#1d4ed8', negotiating:'#b45309', pending_disc:'#c2410c', approved:'#15803d', rejected:'#b91c1c', cancelled:'#c2410c', invoiced:'#0369a1', expired:'#be185d' }[s] || '#475569';
}
function _pfResolveOwnerId(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  var members = (typeof umGetActive === 'function' ? umGetActive() : ((DB.settings && DB.settings.members) || []));
  var byId = members.find(function(m) { return m.id === s; });
  if (byId) return byId.id;
  var sn = typeof fNorm === 'function' ? fNorm(s) : s;
  var byName = members.find(function(m) { return m.name === s || (typeof fNorm === 'function' && fNorm(m.name) === sn); });
  if (byName) return byName.id;
  if (typeof USERS !== 'undefined' && USERS[s]) return s;
  if (typeof USERS !== 'undefined') {
    for (var k in USERS) { if (USERS[k] === s) return k; }
  }
  return s;
}

function _pfCreatorName(uid) {
  if (!uid) return '';
  var id = _pfResolveOwnerId(uid);
  var memList = typeof umGetActive === 'function' ? umGetActive() : ((DB.settings && DB.settings.members) || []);
  var m = memList.find(function(x) { return x.id === id; });
  if (m) return m.name;
  if (typeof USERS !== 'undefined' && USERS[id]) return USERS[id];
  if (String(uid) !== String(id)) return uid;
  return id;
}

// ── Helper: canonical center owner (delegates to data.js getCenterOwnerFromKey) ─
function _pfGetCenterOwnerId(centerKey) {
  if (!centerKey) return null;
  var owner = typeof getCenterOwnerFromKey === 'function' ? getCenterOwnerFromKey(centerKey) : '';
  return owner || null;
}

function _pfGetCenterOwner(centerKey) {
  if (!centerKey) return '—';
  var ownerId = _pfGetCenterOwnerId(centerKey);
  return ownerId ? _pfCreatorName(ownerId) : 'نامشخص';
}

function _pfBuildPendingQueueHtml() {
  if (typeof _isManager !== 'function' || !_isManager()) return '';
  var pending = _pfList.filter(function(p) { return p.status === 'sent' || p.status === 'negotiating'; });
  var discPending = _pfList.filter(function(p) { return p.status === 'pending_disc'; });
  if (!pending.length && !discPending.length) return '';
  var cards = pending.map(function(pf) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:white;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:6px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:180px">' +
        '<div style="font-weight:700;font-size:13px;color:#1e40af">' + esc(pf.no) + ' — ' + esc(pf.centerName || '—') + '</div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:2px">ثبت‌کننده: ' + esc(_pfCreatorName(pf.createdBy)) +
          ' · مسئول: ' + esc(_pfGetCenterOwner(pf.centerKey)) +
          ' · <strong>' + fmtNum(pf.total) + ' ﷼</strong></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button onclick="pfOpenEdit(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-family:inherit">👁️ مشاهده</button>' +
        '<button onclick="pfAction(\'' + pf.id + '\',\'approve\')" style="padding:4px 10px;font-size:11px;border:1px solid #16a34a;border-radius:6px;background:#f0fdf4;color:#15803d;cursor:pointer;font-family:inherit;font-weight:600">✅ تأیید</button>' +
        '<button onclick="pfReject(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #dc2626;border-radius:6px;background:#fef2f2;color:#b91c1c;cursor:pointer;font-family:inherit">❌ رد</button>' +
      '</div></div>';
  }).join('');
  var discCards = discPending.map(function(pf) {
    var maxD = typeof _pfMaxDisc === 'function' ? _pfMaxDisc(pf) : (pf.discountPct || 0);
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:white;border:1px solid #fed7aa;border-radius:8px;margin-bottom:6px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:180px">' +
        '<div style="font-weight:700;font-size:13px;color:#c2410c">⚠️ ' + esc(pf.no) + ' — تخفیف ' + maxD + '٪</div>' +
        '<div style="font-size:11px;color:#64748b">' + esc(pf.centerName || '') + ' · ' + fmtNum(pf.total) + ' ﷼</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button onclick="pfApproveDiscount(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #16a34a;border-radius:6px;background:#f0fdf4;color:#15803d;cursor:pointer;font-weight:600">✅ تأیید تخفیف</button>' +
        '<button onclick="pfRejectDiscount(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #dc2626;border-radius:6px;background:#fef2f2;color:#b91c1c;cursor:pointer">❌ رد</button>' +
      '</div></div>';
  }).join('');
  return '<div style="margin-bottom:14px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:12px;padding:14px 16px">' +
    (pending.length ? '<div style="font-weight:700;font-size:14px;color:#1d4ed8;margin-bottom:10px">📋 در انتظار تأیید مدیر ' +
      '<span style="background:#1d4ed8;color:white;border-radius:10px;padding:2px 8px;font-size:11px;margin-right:6px">' + pending.length + '</span></div>' + cards : '') +
    (discPending.length ? '<div style="font-weight:700;font-size:14px;color:#c2410c;margin:10px 0">⚠️ انتظار تأیید تخفیف ' +
      '<span style="background:#c2410c;color:white;border-radius:10px;padding:2px 8px;font-size:11px;margin-right:6px">' + discPending.length + '</span></div>' + discCards : '') +
    '</div>';
}

// ── Filter setter ─────────────────────────────────────────────────────────
function _pfLoadMore() {
  _pfPage++;
  _pfRefreshListDom();
}

function _pfSetFilter(f) {
  _pfFilter = f;
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

// ── Action buttons per row ────────────────────────────────────────────────
function _pfActions(pf) {
  var btns = [];
  var isManager = _isManager();
  var isSuperAdmin = (typeof currentUser !== 'undefined') &&
    (function(){
      var u = (typeof USERS !== 'undefined' && USERS) ? USERS[currentUser] : null;
      if (!u) return false;
      var members = (typeof DB !== 'undefined' && DB.settings && DB.settings.members) ? DB.settings.members : [];
      var m = members.find(function(mb){ return mb.id === currentUser; });
      return m && m.role === 'سوپر ادمین';
    })();

  // View / Edit — label changes based on status and permission
  var canEdit = (pf.status === 'draft' && (isManager || pf.createdBy === currentUser)) || isSuperAdmin;
  var btnLbl  = canEdit ? '✏️ ویرایش' : '👁️ مشاهده';
  var btnTitle = canEdit ? 'ویرایش پیش‌فاکتور' : 'مشاهده پیش‌فاکتور';
  btns.push('<button onclick="pfOpenEdit(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;font-weight:600;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-family:inherit" title="' + btnTitle + '">' + btnLbl + '</button>');

  // Print
  btns.push('<button onclick="pfPrint(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer" title="چاپ">🖨️</button>');

  // Version history (if any versions exist)
  if (pf.versions && pf.versions.length) {
    btns.push('<button onclick="pfShowVersions(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #bae6fd;border-radius:5px;background:#f0f9ff;color:#0284c7;cursor:pointer" title="' + pf.versions.length + ' نسخه قبلی">🕐</button>');
  }

  // Follow-up scheduling (if center attached)
  if (pf.centerKey) {
    btns.push('<button onclick="pfAddToToday(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #86efac;border-radius:5px;background:#dcfce7;color:#166534;cursor:pointer;font-weight:600" title="افزودن به برنامه امروز">➕ امروز</button>');
    if (['sent', 'negotiating', 'approved', 'pending_disc', 'invoiced'].includes(pf.status)) {
      btns.push('<button onclick="pfOpenOutcomeModal(\'' + pf.id + '\',\'followup\')" style="padding:3px 8px;font-size:11px;border:1px solid #38bdf8;border-radius:5px;background:#f0f9ff;color:#0369a1;cursor:pointer;font-weight:600" title="ثبت نتیجه پیگیری — تاریخ بعدی">🔄 پیگیری</button>');
      btns.push('<button onclick="pfOpenOutcomeModal(\'' + pf.id + '\',\'inactive\')" style="padding:3px 8px;font-size:11px;border:1px solid #fca5a5;border-radius:5px;background:#fef2f2;color:#991b1b;cursor:pointer" title="رد مشتری / غیرفعال با دلیل">❌ رد</button>');
    }
    btns.push('<button onclick="pfScheduleFollowup(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #bbf7d0;border-radius:5px;background:#f0fdf4;color:#15803d;cursor:pointer" title="افزودن به برنامه هفته (تاریخ دلخواه)">📅</button>');
  }
  btns.push('<button onclick="pfCreateTask(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #c4b5fd;border-radius:5px;background:#f5f3ff;color:#6d28d9;cursor:pointer" title="ساخت وظیفه">📌</button>');
  btns.push('<button onclick="pfOpenTimeline(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer" title="تایم‌لاین">🕐</button>');

  // Send (expert, draft only)
  if (pf.status === 'draft' && pf.createdBy === currentUser) {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'send\')" style="padding:3px 8px;font-size:11px;border:1px solid #3b82f6;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer">ارسال</button>');
  }

  // Negotiate (manager/owner, sent)
  if ((isManager || pf.createdBy === currentUser) && pf.status === 'sent') {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'negotiate\')" style="padding:3px 8px;font-size:11px;border:1px solid #fcd34d;border-radius:5px;background:#fef3c7;color:#b45309;cursor:pointer">مذاکره</button>');
  }

  // Approve / Reject (manager, sent or negotiating)
  if (isManager && (pf.status === 'sent' || pf.status === 'negotiating')) {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'approve\')" style="padding:3px 8px;font-size:11px;border:1px solid #16a34a;border-radius:5px;background:#f0fdf4;color:#15803d;cursor:pointer">تأیید</button>');
    btns.push('<button onclick="pfReject(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #dc2626;border-radius:5px;background:#fef2f2;color:#b91c1c;cursor:pointer" title="رد workflow توسط مدیر">رد مدیر</button>');
  }

  // WMS dispatch (approved / invoiced)
  if (['approved','invoiced'].includes(pf.status)) {
    btns.push('<button onclick="pfIssueDispatch(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #a78bfa;border-radius:5px;background:#f5f3ff;color:#6d28d9;cursor:pointer;font-weight:600" title="صدور حواله انبار با کالاهای پیشفاکتور">📦 صدور حواله</button>');
  }

  // Issue Invoice (manager, approved only)
  if (isManager && pf.status === 'approved') {
    btns.push('<button onclick="pfIssueInvoice(\'' + pf.id + '\')" style="padding:3px 8px;font-size:11px;border:1px solid #7c3aed;border-radius:5px;background:#f5f3ff;color:#6d28d9;cursor:pointer" title="صدور فاکتور رسمی">🧾 فاکتور</button>');
  }

  // Reopen (manager or owner, rejected/cancelled/expired)
  if (['rejected','cancelled','expired'].includes(pf.status) && (isManager || pf.createdBy === currentUser)) {
    btns.push('<button onclick="pfAction(\'' + pf.id + '\',\'reopen\')" style="padding:3px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;background:white;cursor:pointer">بازگشایی</button>');
  }

  // Delete: super admin → any status | others → draft/cancelled only
  if (isSuperAdmin || (['draft','cancelled'].includes(pf.status) && (isManager || pf.createdBy === currentUser))) {
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
    await pfLoad();
    var el = _pfRoot();
    if (el) _renderPfPanel(el);
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
    var el = document.getElementById('pfVanillaRoot');
    if (el) _renderPfPanel(el);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

// ── Workflow action call ──────────────────────────────────────────────────
async function pfAction(id, action, note, extra) {
  try {
    var body = { action: action };
    if (note) body.note = note;
    if (extra && typeof extra === 'object') Object.assign(body, extra);
    var r = await fetch('/api/proforma/' + id + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    await pfLoad();
    var el = document.getElementById('pfVanillaRoot');
    if (el) _renderPfPanel(el);
    var labels = { send:'ارسال شد', approve:'تأیید شد', reject:'رد شد', cancel:'لغو شد', reopen:'بازگشایی شد', negotiate:'در مذاکره', expire:'منقضی شد', approve_disc:'تخفیف تأیید شد — ارسال', reject_disc:'تخفیف رد شد' };
    var msg = '✅ پیشفاکتور ' + (labels[action] || action);
    if (action === 'approve') {
      msg += ' — برای صدور حواله دکمه «📦 صدور حواله» را بزنید';
    }
    showToast(msg);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

function pfReject(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  var pfNo = pf ? pf.no : id;
  var reasonOpts = Object.keys(typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS : { price_high:'قیمت بالا', competitor:'رقیب', need_change:'تغییر نیاز', no_response:'عدم پاسخ', other:'سایر' }).map(function(k) {
    var lbl = (typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS[k] : k);
    return '<option value="' + k + '">' + lbl + '</option>';
  }).join('');
  openModal('pfRejectModal', '❌ رد پیشفاکتور ' + pfNo,
    '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">دلیل رد *</label>' +
    '<select id="pfLossReason" class="form-input" style="width:100%">' + reasonOpts + '</select></div>' +
    '<div id="pfLossCompWrap" style="margin-bottom:10px;display:none"><label style="font-size:12px;color:#475569;display:block;margin-bottom:4px">نام رقیب</label>' +
    '<input id="pfLossCompetitor" class="form-input" placeholder="نام رقیب"></div>' +
    '<div style="margin-bottom:8px;font-size:12px;color:#64748b">توضیح تکمیلی:</div>' +
    '<textarea id="pfRejectNote" rows="2" class="form-input" placeholder="توضیحات..." style="resize:vertical"></textarea>',
    '<button onclick="closeModal(\'pfRejectModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>' +
    '<button onclick="_pfDoReject(\'' + id + '\')" style="padding:8px 18px;background:#dc2626;color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">❌ رد پیشفاکتور</button>'
  );
  setTimeout(function() {
    var sel = document.getElementById('pfLossReason');
    var wrap = document.getElementById('pfLossCompWrap');
    if (sel && wrap) sel.onchange = function() { wrap.style.display = sel.value === 'competitor' ? '' : 'none'; };
  }, 50);
}

async function _pfDoReject(id) {
  var reasonEl = document.getElementById('pfLossReason');
  var compEl = document.getElementById('pfLossCompetitor');
  var noteEl = document.getElementById('pfRejectNote');
  var lossReason = reasonEl ? reasonEl.value : '';
  if (!lossReason) { showToast('❌ دلیل رد را انتخاب کنید'); return; }
  var note = noteEl ? noteEl.value.trim() : '';
  var lossCompetitor = compEl ? compEl.value.trim() : '';
  closeModal('pfRejectModal');
  if (typeof pfAction === 'function' && pfAction._pfWrapped) {
    await pfAction(id, 'reject', note, { lossReason: lossReason, lossCompetitor: lossCompetitor });
  } else {
    try {
      var r = await fetch('/api/proforma/' + id + '/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', note: note, lossReason: lossReason, lossCompetitor: lossCompetitor }),
      });
      var data = await r.json();
      if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
      await pfLoad();
      var el = _pfRoot();
      if (el) _renderPfPanel(el);
      showToast('✅ پیشفاکتور رد شد');
    } catch (e) { showToast('❌ ' + e.message); }
  }
}

function _pfFmtTimelineAt(iso) {
  if (!iso) return '';
  if (typeof msToJ === 'function') {
    try {
      var d = new Date(iso);
      if (!isNaN(d.getTime())) return msToJ(d.getTime());
    } catch (_) {}
  }
  return String(iso).slice(0, 16).replace('T', ' ');
}

function pfOpenTimeline(pfId) {
  if (!pfId) { showToast('شناسه نامعتبر'); return; }
  showToast('در حال بارگذاری تایم‌لاین…', 800);
  fetch('/api/proforma/' + encodeURIComponent(pfId) + '/timeline', { credentials: 'include' })
    .then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    })
    .then(function(data) {
      if (!data || data.ok === false) {
        showToast('❌ ' + ((data && data.error) || 'خطا در دریافت تایم‌لاین'));
        return;
      }
      var items = data.timeline || [];
      if (!items.length && data.events && data.events.length) {
        items = data.events.map(function(e) {
          return { at: e.at, label: e.type, actor: e.actor, note: e.note || '' };
        });
      }
      var body;
      if (!items.length) {
        body = '<div style="color:#94a3b8;padding:32px;text-align:center;font-size:13px">هنوز رویدادی ثبت نشده — پس از ارسال، تأیید یا پیگیری اینجا نمایش داده می‌شود.</div>';
      } else {
        body = '<div style="max-height:420px;overflow-y:auto;padding:4px 0">' +
          items.map(function(it, idx) {
            var who = it.actor ? (_pfCreatorName(it.actor) || it.actor) : '';
            var border = idx < items.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : '';
            return '<div style="padding:10px 4px;' + border + 'display:flex;gap:12px;align-items:flex-start">' +
              '<div style="width:8px;height:8px;border-radius:50%;background:var(--brand,#6366f1);margin-top:6px;flex-shrink:0"></div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:12px;font-weight:700;color:#1e293b">' + esc(it.label || it.type || 'رویداد') + '</div>' +
                (it.note ? '<div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.5">' + esc(it.note) + '</div>' : '') +
                '<div style="font-size:10px;color:#94a3b8;margin-top:4px">' +
                  esc(_pfFmtTimelineAt(it.at)) + (who ? ' · ' + esc(who) : '') +
                '</div>' +
              '</div></div>';
          }).join('') +
          '</div>';
      }
      if (typeof openModal !== 'function') {
        alert('تایم‌لاین ' + (data.no || pfId) + ' — ' + items.length + ' رویداد');
        return;
      }
      openModal('pfTimelineModal', '🕐 تایم‌لاین ' + esc(data.no || ''), body,
        '<button type="button" class="btn-secondary" id="pfTimelineCloseBtn">بستن</button>',
        { lg: true, rawFoot: true }
      );
      var closeBtn = document.getElementById('pfTimelineCloseBtn');
      if (closeBtn) closeBtn.onclick = function() { closeModal('pfTimelineModal'); };
    })
    .catch(function(e) {
      console.error('[pfOpenTimeline]', e);
      showToast('❌ ' + (e.message || 'خطا در تایم‌لاین'));
    });
}
window.pfOpenTimeline = pfOpenTimeline;

// ── Fetch WMS products (refresh every 5 min or on-demand) ───────────────────
async function _pfLoadWmsProds(force) {
  var now = Date.now();
  var stale = (now - _pfWmsProdTs) > 5 * 60 * 1000; // 5 minutes
  if (!force && _pfWmsProds.length && !stale) return;
  try {
    var r = await fetch('/api/wms/products');
    if (r.ok) {
      var data = await r.json();
      _pfWmsProds = data || [];
      _pfWmsProdTs = Date.now();
    }
  } catch(e) {}
}

function _pfWmsProdById(prodId) {
  if (!prodId) return null;
  return (_pfWmsProds || []).find(function(x) { return String(x.id) === String(prodId); }) || null;
}

function _pfResolveUnitCost(prodId) {
  var p = _pfWmsProdById(prodId);
  if (!p) return 0;
  return Number(p.lastPurchasePrice || p.last_purchase_price || p.avgPurchasePrice || p.avg_purchase_price || 0) || 0;
}

function _pfSyncItemWmsCost(item) {
  if (!item || !item.prodId) return;
  var cost = _pfResolveUnitCost(item.prodId);
  if (cost) item.unitCost = cost;
}

function _pfSyncAllWmsCosts() {
  (_pfItems || []).forEach(_pfSyncItemWmsCost);
}

// Force-refresh products (called after WMS import or from refresh button)
function pfRefreshProds() {
  _pfWmsProds = [];
  _pfWmsProdTs = 0;
  _pfLoadWmsProds(true).then(function() {
    var modal = document.getElementById('pfProdModal');
    if (modal && modal.style.display !== 'none') {
      var body = document.getElementById('pfProdModalBody');
      if (body) body.innerHTML = _pfBuildProductListHtml();
    }
    if (typeof showToast === 'function') showToast('✅ لیست کالاها به‌روزشد');
  });
}

// ── Open new proforma modal ───────────────────────────────────────────────
async function pfOpenNew() {
  _pfEditId = null;
  _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, discPct:0, discAmt:0, lineTotal:0 }];
  _pfProdViewMode = 'tree';
  _pfProdSearch = '';
  _pfActiveCat = null;
  await _pfLoadWmsProds();
  _pfSyncAllWmsCosts();
  _pfShowModal(null);
}

async function pfOpenEdit(id) {
  try {
    var pf = _pfList.find(function(p){ return p.id === id; });
    if (!pf) return;
    _pfEditId = id;
    _pfItems  = (pf.items || []).map(function(i){ return Object.assign({ discPct:0, discAmt:0 }, i); });
    if (!_pfItems.length) _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, discPct:0, discAmt:0, lineTotal:0 }];
    _pfProdViewMode = 'tree';
    _pfProdSearch = '';
    _pfActiveCat = null;
    await _pfLoadWmsProds();
    _pfSyncAllWmsCosts();
    _pfShowModal(pf);
  } catch(e) {
    showToast('❌ خطا در باز کردن پیشفاکتور: ' + e.message);
  }
}

// ── Build product picker panel (tree + search) ────────────────────────────
function _pfBuildProductPicker(readOnly) {
  if (readOnly) return '';

  var searchHtml =
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">' +
      '<input id="pfProdSearchInp" class="form-input" placeholder="🔍 جستجوی کالا..." value="' + esc(_pfProdSearch) + '" ' +
        'oninput="_pfProdSearchChange(this.value)" style="flex:1;font-size:13px">' +
      '<button id="pfProdViewToggleBtn" onclick="_pfToggleProdView()" title="تغییر نمای کالا" ' +
        'style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:14px;white-space:nowrap">' +
        (_pfProdViewMode === 'tree' ? '📋 لیست' : '🌳 درختی') +
      '</button>' +
    '</div>';

  var prodHtml = '<div id="pfProdListContainer">' + _pfBuildProductListHtml() + '</div>';

  return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">' +
    '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">📦 انتخاب کالا از انبار</div>' +
    searchHtml +
    prodHtml +
  '</div>';
}

function _pfBuildProductListHtml() {
  // Group products by category
  var categories = {};
  _pfWmsProds.forEach(function(p) {
    var cat = p.category || 'سایر';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });
  var catList = Object.keys(categories).sort();

  var prodHtml;
  if (_pfProdSearch.length >= 1) {
    // Search results
    var qn = _pfProdSearch.toLowerCase();
    var results = _pfWmsProds.filter(function(p) {
      return (p.full_name || p.name || '').toLowerCase().indexOf(qn) !== -1 ||
             (p.catalog_code || '').toLowerCase().indexOf(qn) !== -1 ||
             (p.category || '').toLowerCase().indexOf(qn) !== -1;
    });
    if (!results.length) {
      prodHtml = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">کالایی یافت نشد</div>';
    } else {
      prodHtml = '<div style="max-height:220px;overflow-y:auto">' +
        results.map(function(p) {
          return _pfProdListItem(p);
        }).join('') +
      '</div>';
    }
  } else if (_pfProdViewMode === 'list') {
    // Flat list view
    prodHtml = '<div style="max-height:220px;overflow-y:auto">' +
      _pfWmsProds.map(function(p) {
        return _pfProdListItem(p);
      }).join('') +
    '</div>';
  } else {
    // Tree view by category
    prodHtml = '<div style="max-height:220px;overflow-y:auto">' +
      catList.map(function(cat) {
        var items = categories[cat];
        var isOpen = _pfActiveCat === cat;
        return '<div>' +
          '<div onclick="_pfToggleCat(\'' + esc(cat) + '\')" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#f1f5f9;border-radius:6px;margin-bottom:2px;cursor:pointer;font-weight:600;font-size:12px;color:#374151;user-select:none">' +
            '<span style="font-size:12px;transition:transform 0.2s;display:inline-block;transform:rotate(' + (isOpen ? '90deg' : '0deg') + ')">' + (isOpen ? '▶' : '▶') + '</span>' +
            '<span>📁 ' + esc(cat) + '</span>' +
            '<span style="margin-right:auto;background:#6366f1;color:white;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">' + items.length + '</span>' +
          '</div>' +
          (isOpen ?
            '<div style="padding-right:16px;margin-bottom:4px">' +
              items.map(function(p) { return _pfProdListItem(p); }).join('') +
            '</div>'
          : '') +
        '</div>';
      }).join('') +
    '</div>';
  }
  return prodHtml;
}

function _pfProdListItem(p) {
  var name  = esc(p.full_name || p.name);
  var unit  = esc(p.unit || '\u0639\u062f\u062f');
  var cat   = esc(p.category || '');
  var code  = esc(p.catalog_code || '');
  var price = Number(p.salePrice || p.sale_price || 0);
  var cost = Number(p.lastPurchasePrice || p.last_purchase_price || p.avgPurchasePrice || p.avg_purchase_price || 0);
  var priceHtml = price > 0
    ? '<span style="color:#15803d;font-size:11px;font-weight:700;white-space:nowrap;background:#f0fdf4;padding:1px 6px;border-radius:8px">' + price.toLocaleString('fa-IR') + ' \u0631\u06cc\u0627\u0644</span>'
    : '<span style="color:#94a3b8;font-size:10px;white-space:nowrap" title="\u0642\u06cc\u0645\u062a \u0641\u0631\u0648\u0634 \u062f\u0631 \u0627\u0646\u0628\u0627\u0631 \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647">&mdash; \u0642\u06cc\u0645\u062a \u0646\u062f\u0627\u0631\u062f</span>';
  return '<div onclick="pfAddProductRow(\'' + esc(p.id) + '\', \'' + name + '\', \'' + unit + '\', ' + price + ', \'' + code + '\', ' + cost + ')" ' +
    'style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:5px;cursor:pointer;font-size:12px;border-bottom:1px solid #f1f5f9;transition:background 0.15s;gap:8px" ' +
    'onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'transparent\'">' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>' +
      (code || cat ? '<div style="color:#94a3b8;font-size:10px;margin-top:1px">' + (code ? '<span style="color:#0284c7;font-family:monospace">' + code + '</span>' : '') + (cat && code ? ' &middot; ' : '') + (cat || '') + '</div>' : '') +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">' +
      priceHtml +
      '<span style="color:#6366f1;font-size:10px">(' + unit + ')</span>' +
    '</div>' +
  '</div>';
}

function _pfToggleProdView() {
  _pfProdViewMode = _pfProdViewMode === 'tree' ? 'list' : 'tree';
  _pfActiveCat = null;
  var btn = document.getElementById('pfProdViewToggleBtn');
  if (btn) {
    btn.innerHTML = _pfProdViewMode === 'tree' ? '📋 لیست' : '🌳 درختی';
  }
  _refreshProductPicker();
}

function _pfProdSearchChange(q) {
  _pfProdSearch = q;
  _refreshProductPicker();
}

function _pfToggleCat(cat) {
  _pfActiveCat = _pfActiveCat === cat ? null : cat;
  _refreshProductPicker();
}

function _refreshProductPicker() {
  var container = document.getElementById('pfProdListContainer');
  if (!container) return;
  container.innerHTML = _pfBuildProductListHtml();
}

function pfAddProductRow(prodId, name, unit, salePrice, catalogCode, unitCost) {
  // Check if this product already has a row, if so just pick first empty row
  var emptyIdx = _pfItems.findIndex(function(it) { return !it.name; });
  var idx;
  if (emptyIdx !== -1) {
    idx = emptyIdx;
    _pfItems[idx].prodId      = prodId;
    _pfItems[idx].catalogCode = catalogCode || '';
    _pfItems[idx].category    = _pfItemCategory({ prodId: prodId, catalogCode: catalogCode });
    _pfItems[idx].name        = name;
    _pfItems[idx].unit        = unit;
    _pfItems[idx].unitPrice   = salePrice || 0;
    _pfItems[idx].unitCost    = Number(unitCost) || 0;
    _pfItems[idx].lineTotal = (_pfItems[idx].qty || 1) * (salePrice || 0);
  } else {
    idx = _pfItems.length;
    _pfItems.push({ prodId: prodId, catalogCode: catalogCode || '', category: _pfItemCategory({ prodId: prodId, catalogCode: catalogCode }), name: name, unit: unit, qty: 1, unitPrice: salePrice || 0, unitCost: Number(unitCost) || 0, discPct: 0, discAmt: 0, lineTotal: salePrice || 0 });
  }
  // Re-render items table
  var wrap = document.getElementById('pfItemsWrap');
  if (wrap) {
    wrap.innerHTML = _pfItems.map(function(item, i){ return _pfItemRow(i, item, false); }).join('');
  }
  pfRecalc();
  showToast('✅ ' + name + ' افزوده شد');
}

// ── Helper: append quick note from dropdown ───────────────────────────────
window.pfAppendNote = function(selectEl, targetId, isDynamic) {
  var val = selectEl.value;
  if (!val) return;
  var ta = document.getElementById(targetId);
  if (!ta) return;

  // محاسبه خودکار متن اعتبار بر اساس روز درج شده در فرم
  if (isDynamic && val === 'validity') {
    var days = document.getElementById('pfValid') ? document.getElementById('pfValid').value : 30;
    val = 'اعتبار این پیش‌فاکتور به مدت ' + days + ' روز کاری می‌باشد.';
  }

  var current = ta.value.trim();
  // اگر متنی از قبل بود، متن جدید را در خط بعدی اضافه کن
  ta.value = current ? current + '\n' + val : val;
  selectEl.selectedIndex = 0; // برگرداندن کشویی به حالت اول
};

// ── Note template management functions ─────────────────────────────────────
function _pfGetNoteTemplates() {
  if (typeof DB !== 'undefined' && DB.settings && DB.settings.pfNoteTemplates) {
    return DB.settings.pfNoteTemplates;
  }
  return {
    pmt: ['تسویه نقدی پیش از ارسال بار', '۵۰٪ پیش‌پرداخت، ۵۰٪ زمان تحویل', 'چک صیادی یک ماهه'],
    acc: ['واریز به حساب بانک ملت شرکت آتنا زیست درمان، شماره شبا: IR0000000000000000000000', 'واریز به حساب بانک تجارت، شماره کارت: 0000-0000-0000-0000'],
    int: ['نیاز به تایید مدیریت برای درصد تخفیف دارد', 'مشتری بدحساب است، کارکرد فقط به صورت نقدی', 'پیگیری این پیشفاکتور در هفته آینده انجام شود']
  };
}

window.pfManageNoteTexts = function() {
  if (typeof _isManager === 'function' && !_isManager()) { 
      showToast('⚠️ فقط مدیران امکان ویرایش لیست متون پیش‌فرض را دارند.'); return; 
  }
  var tpls = _pfGetNoteTemplates();
  var html = '<div style="font-size:12px;color:#475569;margin-bottom:12px">هر متن را در یک خط جداگانه بنویسید. برای حذف، خط مربوطه را پاک کنید.</div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#0284c7;display:block;margin-bottom:4px">📝 لیست شرایط پرداخت</label>' +
    '<textarea id="mgTplPmt" rows="4" class="form-input" style="resize:vertical;margin-bottom:12px">' + esc(tpls.pmt.join('\n')) + '</textarea></div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#0284c7;display:block;margin-bottom:4px">💳 لیست معرفی حساب‌ها</label>' +
    '<textarea id="mgTplAcc" rows="4" class="form-input" style="resize:vertical;margin-bottom:12px">' + esc(tpls.acc.join('\n')) + '</textarea></div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#0284c7;display:block;margin-bottom:4px">🔒 لیست یادداشت‌های داخلی</label>' +
    '<textarea id="mgTplInt" rows="4" class="form-input" style="resize:vertical;margin-bottom:12px">' + esc(tpls.int.join('\n')) + '</textarea></div>';

  openModal('pfNoteTplModal', '⚙️ ویرایش متون پیش‌فرض', html,
    '<button onclick="closeModal(\'pfNoteTplModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="_pfSaveNoteTexts()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره تغییرات</button>',
    {lg: false}
  );
};

window._pfSaveNoteTexts = function() {
  if (!DB.settings) DB.settings = {};
  var pmt = document.getElementById('mgTplPmt').value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
  var acc = document.getElementById('mgTplAcc').value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
  var int = document.getElementById('mgTplInt').value.split('\n').map(function(s){return s.trim();}).filter(Boolean);

  DB.settings.pfNoteTemplates = { pmt: pmt, acc: acc, int: int };
  patchCrmSetting('pfNoteTemplates', DB.settings.pfNoteTemplates);

  closeModal('pfNoteTplModal');
  showToast('✅ لیست متون با موفقیت ذخیره شد (برای دیدن تغییرات در کشویی‌ها، فرم پیش‌فاکتور را ببندید و دوباره باز کنید)');
};

window.pfUpdateExpiryPreview = function() {
  var el = document.getElementById('pfExpiryDisplay');
  if (!el) return;
  var dateEl = document.getElementById('pfDate');
  var validEl = document.getElementById('pfValid');
  var date = dateEl ? dateEl.value.trim() : '';
  var valid = validEl ? Number(validEl.value) : 0;
  var exp = '';
  if (date && valid > 0 && typeof _pfComputeExpiry === 'function') {
    exp = _pfComputeExpiry({ jalaliDate: date, validDays: valid });
  }
  el.textContent = exp || '—';
};

window.pfManageFieldOptions = function() {
  if (typeof _isManager === 'function' && !_isManager()) {
    showToast('⚠️ فقط مدیران امکان ویرایش گزینه‌های کشویی را دارند.');
    return;
  }
  var channels = typeof _pfGetChannelMap === 'function' ? _pfGetChannelMap() : (typeof PF_CHANNELS !== 'undefined' ? PF_CHANNELS : {});
  var payments = typeof _pfGetPaymentTermsMap === 'function' ? _pfGetPaymentTermsMap() : (typeof PF_PAYMENT_TERMS !== 'undefined' ? PF_PAYMENT_TERMS : {});
  var html = '<div style="font-size:12px;color:#475569;margin-bottom:12px;line-height:1.6">هر گزینه در یک خط: <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">کلید|عنوان</code> — مثال: <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">direct|تماس مستقیم</code><br>برای حذف یک گزینه، خط مربوطه را پاک کنید.</div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#6d28d9;display:block;margin-bottom:4px">📥 کانال‌های ورودی</label>' +
    '<textarea id="mgPfChannels" rows="5" class="form-input" style="resize:vertical;margin-bottom:12px;font-family:monospace;font-size:11px">' + esc(typeof _pfMapToLines === 'function' ? _pfMapToLines(channels) : '') + '</textarea></div>' +
    '<div><label style="font-size:11px;font-weight:700;color:#6d28d9;display:block;margin-bottom:4px">💳 شرایط پرداخت</label>' +
    '<textarea id="mgPfPayments" rows="5" class="form-input" style="resize:vertical;margin-bottom:8px;font-family:monospace;font-size:11px">' + esc(typeof _pfMapToLines === 'function' ? _pfMapToLines(payments) : '') + '</textarea></div>' +
    '<div style="font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px">مسئول فروش و پشتیبان فنی از لیست کاربران فعال سیستم می‌آیند — برای حذف در فرم، گزینه «—» را انتخاب کنید.</div>';

  openModal('pfFieldOptsModal', '⚙️ ویرایش گزینه‌های کشویی', html,
    '<button onclick="closeModal(\'pfFieldOptsModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="_pfResetFieldOptions()" style="padding:8px 14px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">↩ پیش‌فرض</button>' +
    '<button onclick="_pfSaveFieldOptions()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره</button>',
    { lg: false }
  );
};

window._pfSaveFieldOptions = function() {
  if (!DB.settings) DB.settings = {};
  var chText = document.getElementById('mgPfChannels') ? document.getElementById('mgPfChannels').value : '';
  var payText = document.getElementById('mgPfPayments') ? document.getElementById('mgPfPayments').value : '';
  var chFallback = typeof PF_CHANNELS !== 'undefined' ? PF_CHANNELS : {};
  var payFallback = typeof PF_PAYMENT_TERMS !== 'undefined' ? PF_PAYMENT_TERMS : {};
  DB.settings.pfChannels = typeof _pfLinesToMap === 'function' ? _pfLinesToMap(chText, chFallback) : chFallback;
  DB.settings.pfPaymentTerms = typeof _pfLinesToMap === 'function' ? _pfLinesToMap(payText, payFallback) : payFallback;
  patchCrmSetting('pfChannels', DB.settings.pfChannels);
  patchCrmSetting('pfPaymentTerms', DB.settings.pfPaymentTerms);
  closeModal('pfFieldOptsModal');
  showToast('✅ گزینه‌ها ذخیره شد — فرم را ببندید و دوباره باز کنید');
};

window._pfResetFieldOptions = function() {
  if (!confirm('بازگشت کانال‌ها و شرایط پرداخت به پیش‌فرض؟')) return;
  if (!DB.settings) DB.settings = {};
  delete DB.settings.pfChannels;
  delete DB.settings.pfPaymentTerms;
  patchCrmSetting('pfChannels', null);
  patchCrmSetting('pfPaymentTerms', null);
  closeModal('pfFieldOptsModal');
  showToast('↩ به پیش‌فرض بازگشت');
};

// ── Show modal ────────────────────────────────────────────────────────────
async function _pfShowModal(pf) { try {
  _pfOpenPf = pf || null;
  var readOnly = pf && pf.status !== 'draft';
  if (pf && pf.id) { await _pfLoadFiles(pf.id); } else { _pfFiles = []; }
  await _pfLoadWarehouses();
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
  var taxVal    = pf ? (pf.taxPct !== undefined ? pf.taxPct : 0) : 0;
  var discVal   = pf ? (pf.discountPct || 0) : 0;
  var noteVal   = pf ? (pf.note || '') : '';
  var validVal  = pf ? (pf.validDays || 3) : 3;
  var channelMap = typeof _pfGetChannelMap === 'function' ? _pfGetChannelMap() : (typeof PF_CHANNELS !== 'undefined' ? PF_CHANNELS : { direct: 'تماس مستقیم' });
  var paymentMap = typeof _pfGetPaymentTermsMap === 'function' ? _pfGetPaymentTermsMap() : (typeof PF_PAYMENT_TERMS !== 'undefined' ? PF_PAYMENT_TERMS : { cash: 'نقد' });
  var channelVal = pf && pf.channel ? pf.channel : '';
  var salesVal = pf && pf.salesOwner ? pf.salesOwner : '';
  var supportVal = pf && pf.supportOwner ? pf.supportOwner : '';
  var expiryPreview = '';
  if (pf && pf.expiryDate) expiryPreview = pf.expiryDate;
  else if (typeof _pfComputeExpiry === 'function') expiryPreview = _pfComputeExpiry({ jalaliDate: dateVal, validDays: validVal }) || '';
  var is10      = taxVal === 10;

  // New buyer fields & managerNote
  var buyerNatIdVal   = pf ? (pf.buyerNatId || '') : '';
  var buyerEcoCodeVal = pf ? (pf.buyerEcoCode || '') : '';
  var buyerRegIdVal   = pf ? (pf.buyerRegId || '') : '';
  var buyerAddressVal = pf ? (pf.buyerAddress || '') : '';
  var buyerPhoneVal   = pf ? (pf.buyerPhone || '') : '';
  var buyerPostalVal  = pf ? (pf.buyerPostal || '') : '';
  var managerNoteVal  = pf ? (pf.managerNote || '') : '';

  // ── Dynamic dropdown lists from DB.settings ──
  var tpls = _pfGetNoteTemplates();

  function buildOpts(arr, defaultLabel) {
     return '<option value="">+ ' + defaultLabel + '...</option>' +
            arr.map(function(txt) { 
                var shortTxt = txt.length > 35 ? txt.substring(0,35) + '...' : txt;
                return '<option value="' + esc(txt) + '">' + esc(shortTxt) + '</option>'; 
            }).join('');
  }

  var pmtOpts = buildOpts(tpls.pmt, 'شرایط پرداخت');
  var accOpts = buildOpts(tpls.acc, 'معرفی حساب');
  var intOpts = buildOpts(tpls.int, 'یادداشت داخلی');
  var valOpts = '<option value="">+ اعتبار پیش‌فاکتور...</option><option value="validity">درج خودکار اعتبار (بر اساس روز فرم)</option>';

  var pubTools = '<div style="display:flex;gap:6px;margin-bottom:6px">' +
    '<select onchange="pfAppendNote(this, \'pfNote\')" style="flex:1;font-size:11px;padding:4px;border-radius:4px;border:1px solid #cbd5e1;max-width:30%" '+(readOnly?'disabled':'')+'>' + pmtOpts + '</select>' +
    '<select onchange="pfAppendNote(this, \'pfNote\')" style="flex:1;font-size:11px;padding:4px;border-radius:4px;border:1px solid #cbd5e1;max-width:30%" '+(readOnly?'disabled':'')+'>' + accOpts + '</select>' +
    '<select onchange="pfAppendNote(this, \'pfNote\', true)" style="flex:1;font-size:11px;padding:4px;border-radius:4px;border:1px solid #cbd5e1;max-width:30%" '+(readOnly?'disabled':'')+'>' + valOpts + '</select>' +
    (!readOnly ? '<button onclick="pfManageNoteTexts()" title="مدیریت متون دیفالت" style="padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer">⚙️</button>' : '') +
    '</div>';

  var intTools = '<div style="display:flex;gap:6px;margin-bottom:6px">' +
    '<select onchange="pfAppendNote(this, \'pfManagerNote\')" style="flex:1;font-size:11px;padding:4px;border-radius:4px;border:1px solid #cbd5e1" '+(readOnly?'disabled':'')+'>' + intOpts + '</select>' +
    (!readOnly ? '<button onclick="pfManageNoteTexts()" title="مدیریت متون دیفالت" style="padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer">⚙️</button>' : '') +
    '</div>';

  var productPicker = _pfBuildProductPicker(readOnly);

  var whVal = pf ? (pf.wmsWarehouseId || '') : '';
  var canEditWh = !pf || pf.status === 'draft' || pf.status === 'sent';
  var whOpts = '<option value="">پیش‌فرض (اولین انبار فعال)</option>' +
    _pfWarehouses.map(function(w) {
      return '<option value="' + esc(w.id) + '"' + (w.id === whVal ? ' selected' : '') + '>' + esc(w.name) + '</option>';
    }).join('');
  var whLabel = whVal ? ((_pfWarehouses.find(function(w) { return w.id === whVal; }) || {}).name || whVal) : 'پیش‌فرض';
  var whBlock = '<div style="margin-bottom:12px;padding:10px 12px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px">' +
    '<label style="font-size:11px;font-weight:700;color:#6d28d9;display:block;margin-bottom:4px">📦 انبار خروج (حواله)</label>' +
    (canEditWh
      ? '<select id="pfWarehouse" class="form-input" onchange="pfWarehouseChange(this)" style="max-width:360px">' + whOpts + '</select>'
      : '<div style="font-size:13px;color:#374151">' + esc(whLabel) + '</div>') +
    '<div style="font-size:10px;color:#7c3aed;margin-top:4px">پس از تأیید، حواله خروج (FEFO) در این انبار صادر می‌شود</div></div>';

  document.getElementById('pfModalBody').innerHTML =
    // ── Header row: customer + date + validity
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">مرکز / مشتری</label>' +
        '<input id="pfCenterName" class="form-input" value="' + esc(centerVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="نام مرکز یا مشتری" oninput="pfSearchCenter(this.value)" autocomplete="off">' +
        '<div id="pfCenterDrop" style="position:fixed;z-index:9999;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);display:none;max-height:180px;overflow-y:auto;min-width:260px"></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">تاریخ صدور (شمسی)</label>' +
        '<input id="pfDate" class="form-input" value="' + esc(dateVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="۱۴۰۴/۰۳/۲۵" oninput="pfUpdateExpiryPreview()">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">اعتبار (روز)</label>' +
        '<input id="pfValid" type="number" class="form-input" value="' + validVal + '" ' + (readOnly?'disabled':'') + ' min="1" max="365" oninput="pfUpdateExpiryPreview()">' +
      '</div>' +
    '</div>' +
    (!readOnly && _pfIsManager() ? '<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" onclick="pfManageFieldOptions()" style="padding:3px 10px;font-size:10px;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;border-radius:6px;cursor:pointer;font-family:inherit">⚙️ ویرایش گزینه‌های کشویی</button></div>' : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px">' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">کانال ورودی</label>' +
        '<select id="pfChannel" class="form-input" ' + (readOnly?'disabled':'') + '>' +
          '<option value="">—</option>' +
          Object.keys(channelMap).map(function(k) {
            var lbl = channelMap[k] || k;
            var sel = channelVal === k ? ' selected' : '';
            return '<option value="' + k + '"' + sel + '>' + lbl + '</option>';
          }).join('') +
        '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">شرایط پرداخت</label>' +
        '<select id="pfPaymentTerms" class="form-input" ' + (readOnly?'disabled':'') + '>' +
          '<option value="">—</option>' +
          Object.keys(paymentMap).map(function(k) {
            var lbl = paymentMap[k] || k;
            return '<option value="' + k + '"' + ((pf && pf.paymentTerms === k) ? ' selected' : '') + '>' + lbl + '</option>';
          }).join('') +
        '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">مسئول فروش</label>' +
        '<select id="pfSalesOwner" class="form-input" ' + (readOnly?'disabled':'') + '>' +
          '<option value="">—</option>' +
          _pfGetExpertMembers().map(function(m) {
            return '<option value="' + esc(m.id) + '"' + (m.id === salesVal ? ' selected' : '') + '>' + esc(m.name) + '</option>';
          }).join('') +
        '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">پشتیبان فنی</label>' +
        '<select id="pfSupportOwner" class="form-input" ' + (readOnly?'disabled':'') + '><option value="">—</option>' +
          _pfGetExpertMembers().map(function(m) {
            return '<option value="' + esc(m.id) + '"' + (m.id === supportVal ? ' selected' : '') + '>' + esc(m.name) + '</option>';
          }).join('') +
        '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px" title="آخرین روز اعتبار پیش‌فاکتور — از تاریخ صدور + اعتبار (روز) محاسبه می‌شود">تاریخ انقضا</label>' +
        '<div id="pfExpiryDisplay" style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;color:#64748b;min-height:20px">' +
          esc(expiryPreview || '—') + '</div>' +
        '<div style="font-size:9px;color:#94a3b8;margin-top:3px;line-height:1.4">آخرین روز اعتبار پیش‌فاکتور؛ پس از آن به‌صورت خودکار «منقضی» می‌شود</div></div>' +
    '</div>' +
    whBlock +
    // ── Buyer Details (مشخصات کامل خریدار)
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">' +
      '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">📋 مشخصات کامل خریدار (خریدار فاکتور رسمی)</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
        '<div><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">شناسه ملی / کد ملی</label>' +
          '<input id="pfBuyerNatId" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerNatIdVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="شناسه ملی">' +
        '</div>' +
        '<div><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">شماره اقتصادی</label>' +
          '<input id="pfBuyerEcoCode" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerEcoCodeVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="کد اقتصادی">' +
        '</div>' +
        '<div><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">شماره ثبت</label>' +
          '<input id="pfBuyerRegId" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerRegIdVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="شماره ثبت">' +
        '</div>' +
        '<div><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">تلفن خریدار</label>' +
          '<input id="pfBuyerPhone" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerPhoneVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="تلفن">' +
        '</div>' +
        '<div><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">کد پستی خریدار</label>' +
          '<input id="pfBuyerPostal" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerPostalVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="کد پستی">' +
        '</div>' +
        '<div style="grid-column: 1 / -1"><label style="font-size:10px;color:#64748b;display:block;margin-bottom:2px">آدرس کامل خریدار</label>' +
          '<input id="pfBuyerAddress" class="form-input" style="font-size:12px;padding:4px 8px" value="' + esc(buyerAddressVal) + '" ' + (readOnly?'disabled':'') + ' placeholder="آدرس">' +
        '</div>' +
      '</div>' +
    '</div>' +
    // ── Tax row
    '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">' +
      '<span style="font-size:12px;font-weight:700;color:#166534">مالیات ارزش افزوده:</span>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:' + (readOnly?'default':'pointer') + ';font-size:13px;color:#374151">' +
        '<input type="radio" name="pfTaxOpt" id="pfTax0" value="0" ' + (!is10?'checked':'') + ' ' + (readOnly?'disabled':'') + ' onchange="pfSetTax(0)">' +
        '<span>بدون مالیات (۰٪)</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:' + (readOnly?'default':'pointer') + ';font-size:13px;color:#374151">' +
        '<input type="radio" name="pfTaxOpt" id="pfTax10" value="10" ' + (is10?'checked':'') + ' ' + (readOnly?'disabled':'') + ' onchange="pfSetTax(10)">' +
        '<span>مالیات ۱۰٪</span>' +
      '</label>' +
      '<input type="hidden" id="pfTax" value="' + taxVal + '">' +
    '</div>' +
    // ── Product picker
    '<div id="pfProductPickerWrap">' + productPicker + '</div>' +
    // ── Items header
    '<div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">' +
      '<strong style="font-size:13px">ردیف‌های کالا</strong>' +
      (readOnly ? '' : '<button onclick="pfAddRow()" style="padding:4px 10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">+ ردیف خالی</button>') +
    '</div>' +
    // ── Items table
    '<div style="overflow-x:auto;margin-bottom:14px">' +
      '<table style="width:100%;border-collapse:collapse;min-width:700px">' +
        '<thead>' +
          '<tr style="background:#f8fafc;font-size:11px;font-weight:700;color:#64748b">' +
            '<th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e2e8f0;min-width:200px">کالا</th>' +
            '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:80px">تعداد</th>' +
            '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:120px">قیمت واحد (ریال)</th>' +
            '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:110px">تخفیف ردیف</th>' +
            '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:110px">جمع ردیف (ریال)</th>' +
            (typeof _pfCanSeeMargin === 'function' && _pfCanSeeMargin() ? '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:110px" title="قیمت خرید از آخرین ورود انبار و درصد حاشیه">قیمت خرید / حاشیه</th>' : '') +
            (readOnly ? '' : '<th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;width:40px"></th>') +
          '</tr>' +
        '</thead>' +
        '<tbody id="pfItemsWrap">' + itemRows + '</tbody>' +
      '</table>' +
    '</div>' +
    // ── Totals & discount
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
      '<div>' +
        '<label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">تخفیف کلی ٪</label>' +
        '<input id="pfDisc" type="number" class="form-input" value="' + discVal + '" ' + (readOnly?'disabled':'') + ' min="0" max="100" step="0.01" oninput="pfRecalc()" style="text-align:center">' +
      '</div>' +
      '<div id="pfTotalsBox" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px"></div>' +
    '</div>' +
    // ── Two Notes (Tohid & internal)
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div>' +
        '<label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">📝 توضیحات پیش‌فاکتور (در چاپ می‌آید)</label>' +
        pubTools +
        '<textarea id="pfNote" rows="3" class="form-input" ' + (readOnly?'disabled':'') + ' style="resize:vertical">' + esc(noteVal) + '</textarea>' +
      '</div>' +
      '<div>' +
        '<label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">🔒 یادداشت داخلی / مذاکرات مدیریت (عدم چاپ)</label>' +
        intTools +
        '<textarea id="pfManagerNote" rows="3" class="form-input" ' + (readOnly?'disabled':'') + ' style="resize:vertical">' + esc(managerNoteVal) + '</textarea>' +
      '</div>' +
    '</div>' +
    // ── Commission section
    '<div style="margin-top:12px;border:1px solid #fde68a;border-radius:8px;padding:12px;background:#fffbeb">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (((pf&&pf.hasCommission)||!readOnly)?'10px':'0') + '">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:700;color:#b45309">' +
          '<input type="checkbox" id="pfHasCommission" ' + ((pf&&pf.hasCommission)?'checked':'') + ' ' + (readOnly?'disabled':'') + ' onchange="pfToggleCommission()">' +
          '💸 پورسانت خارج سازمانی' +
        '</label>' +
      '</div>' +
      '<div id="pfCommissionSection" style="display:' + ((pf&&pf.hasCommission)?'grid':'none') + ';grid-template-columns:1fr 2fr;gap:10px">' +
        '<div><label style="font-size:11px;font-weight:600;color:#92400e;display:block;margin-bottom:3px">مبلغ پورسانت (﷼)</label>' +
          '<input type="number" id="pfCommissionAmt" class="form-input" value="' + ((pf&&pf.commissionAmt)||0) + '" min="0" ' + (readOnly?'disabled':'') + ' placeholder="مبلغ پورسانت">' +
        '</div>' +
        '<div><label style="font-size:11px;font-weight:600;color:#92400e;display:block;margin-bottom:3px">توضیحات پورسانت</label>' +
          '<input type="text" id="pfCommissionNote" class="form-input" value="' + esc((pf&&pf.commissionNote)||'') + '" ' + (readOnly?'disabled':'') + ' placeholder="نام دریافت‌کننده، درصد، شرایط...">' +
        '</div>' +
      '</div>' +
    '</div>' +
    _pfRenderAttachmentsHtml(pf) +
    (pf && pf.actionNote ? '<div style="margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:12px"><strong>نظر مدیر:</strong> ' + esc(pf.actionNote) + '</div>' : '');

  document.getElementById('pfModalFooter').innerHTML =
    (pf && ['approved','invoiced'].includes(pf.status) ? '<button onclick="pfIssueDispatch(\'' + pf.id + '\')" style="padding:8px 12px;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">📦 صدور حواله</button>' : '') +
    (readOnly ? '<button onclick="pfPrint(\'' + (pf.id) + '\')" style="padding:8px 16px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">🖨️ چاپ پیش‌فاکتور</button>' : '') +
    (pf && pf.versions && pf.versions.length ? '<button onclick="pfShowVersions(\'' + pf.id + '\')" style="padding:8px 12px;background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">🕐 تاریخچه (' + pf.versions.length + ')</button>' : '') +
    '<button onclick="var _el=document.getElementById(\'pfModal\');if(_el)_el.style.display=\'none\';" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">بستن</button>' +
    (!readOnly ? '<button onclick="pfSave()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره</button>' : '');


  modal.style.display = 'flex';
  var _cInp = document.getElementById('pfCenterName');
  if (_cInp && centerKey) _cInp.dataset.key = centerKey;
  if (centerKey && !readOnly && (!pf || !pf.id)) {
    setTimeout(function() {
      if (typeof pfSelectCenter === 'function') pfSelectCenter(centerKey, centerVal);
    }, 60);
  }
  pfRecalc();
  if (typeof pfUpdateExpiryPreview === 'function') pfUpdateExpiryPreview();
} catch(e) { alert('Error in _pfShowModal: ' + e.message); } }

// ── Item row (table row) ──────────────────────────────────────────────────
function pfToggleCommission() {
  var cb  = document.getElementById('pfHasCommission');
  var sec = document.getElementById('pfCommissionSection');
  if (sec) sec.style.display = (cb && cb.checked) ? 'grid' : 'none';
}

function _pfItemRow(i, item, readOnly) {
  var lineAfterDisc = _pfItemLineTotal(item);
  var showMargin = typeof _pfCanSeeMargin === 'function' && _pfCanSeeMargin();
  var gDisc = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0) || 0;
  var wmsCost = item.prodId ? _pfResolveUnitCost(item.prodId) : (Number(item.unitCost) || 0);
  if (item.prodId && wmsCost) item.unitCost = wmsCost;
  var marginPct = showMargin && typeof _pfItemMarginPct === 'function' ? _pfItemMarginPct(item, gDisc) : null;
  var marginCell = showMargin
    ? '<td style="padding:6px 8px;text-align:center;font-size:11px">' +
        (readOnly
          ? (marginPct != null ? '<span style="color:' + (marginPct >= 15 ? '#15803d' : '#dc2626') + ';font-weight:700">' + marginPct + '٪</span>' : '—')
          : '<div style="display:flex;flex-direction:column;gap:3px;align-items:center">' +
              '<span class="pf-item-cost-display" data-idx="' + i + '" style="font-family:monospace;font-size:11px;color:#475569" title="آخرین قیمت خرید از ورود انبار">' + (wmsCost ? fmtNum(wmsCost) : '<span style="color:#94a3b8">—</span>') + '</span>' +
              '<input type="hidden" class="pf-item-cost" data-idx="' + i + '" value="' + (wmsCost || 0) + '">' +
              '<span class="pf-margin-pct" data-idx="' + i + '" id="pfMargin_' + i + '">' + _pfMarginLabel(marginPct) + '</span>' +
            '</div>') +
      '</td>'
    : '';
  return '<tr id="pfRow_' + i + '" style="border-bottom:1px solid #f1f5f9">' +
    '<td style="padding:6px 8px">' +
      (readOnly
        ? '<div style="font-size:13px;font-weight:600">' + esc(item.name || '') + '</div>' +
          (item.catalogCode ? '<div style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px">' + esc(item.catalogCode) + '</div>' : '')
        : '<div style="position:relative">' +
            '<input class="form-input pf-item-name" data-idx="' + i + '" style="font-size:13px" value="' + esc(item.name||'') + '" placeholder="نام کالا" autocomplete="off" oninput="_pfRowChange(' + i + ',\'name\',this.value); pfSearchProduct(' + i + ', this.value)">' +
            (item.catalogCode ? '<div class="pf-item-cat-display" data-idx="' + i + '" style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px;padding:1px 4px">' + esc(item.catalogCode) + '</div>' : '<div class="pf-item-cat-display" data-idx="' + i + '" style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px;padding:1px 4px"></div>') +
            '<div id="pfProdDrop_' + i + '" style="position:fixed;z-index:9999;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);display:none;max-height:180px;overflow-y:auto"></div>' +
          '</div>') +
    '</td>' +
    '<td style="padding:6px 8px;text-align:center">' +
      (readOnly
        ? '<span style="font-size:13px">' + fmtNum(item.qty) + '</span>'
        : '<input type="number" class="form-input pf-item-qty" data-idx="' + i + '" value="' + item.qty + '" min="1" oninput="_pfRowChange(' + i + ',\'qty\',this.value)" style="text-align:center">') +
    '</td>' +
    '<td style="padding:6px 8px;text-align:center">' +
      (readOnly
        ? '<span style="font-size:13px;font-family:monospace">' + fmtNum(item.unitPrice) + '</span>'
        : '<input type="number" class="form-input pf-item-price" data-idx="' + i + '" value="' + item.unitPrice + '" min="0" oninput="_pfRowChange(' + i + ',\'unitPrice\',this.value)" style="text-align:center">') +
    '</td>' +
    '<td style="padding:6px 8px;text-align:center">' +
      (readOnly
        ? '<span style="font-size:13px">' + (item.discPct ? item.discPct + '٪' : '—') + '</span>'
        : '<div style="display:flex;gap:3px;align-items:center">' +
            '<input type="number" class="form-input pf-item-disc" data-idx="' + i + '" value="' + (item.discPct || 0) + '" min="0" max="100" step="0.01" oninput="_pfRowChange(' + i + ',\'discPct\',this.value)" style="text-align:center;width:52px" placeholder="٪" title="تخفیف ردیف ٪">' +
            '<span style="font-size:10px;color:#94a3b8">٪</span>' +
          '</div>') +
    '</td>' +
    '<td style="padding:6px 8px;text-align:center;font-family:monospace;font-size:13px;color:#1e293b">' +
      fmtNum(lineAfterDisc) +
    '</td>' +
    marginCell +
    (readOnly ? '' :
      '<td style="padding:6px 8px;text-align:center">' +
        '<button onclick="pfRemoveRow(' + i + ')" style="padding:2px 7px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:5px;cursor:pointer;font-size:14px">✕</button>' +
      '</td>') +
  '</tr>';
}

function _pfItemLineTotal(item) {
  var raw   = (item.qty || 0) * (item.unitPrice || 0);
  var disc  = Math.round(raw * (Number(item.discPct) || 0) / 100);
  return raw - disc;
}

function _pfParseNum(val) {
  if (val === '' || val == null) return 0;
  var s = String(val).replace(/[۰-۹]/g, function(d) {
    return '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)];
  }).replace(/,/g, '').trim();
  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

function _pfMarginLabel(pct) {
  if (pct == null) return '<span style="color:#94a3b8;font-size:10px">—</span>';
  var color = pct >= 15 ? '#15803d' : '#dc2626';
  return '<span style="color:' + color + ';font-weight:700;font-size:11px">' + pct + '٪</span>';
}

function _pfUpdateMarginCells() {
  if (typeof _pfCanSeeMargin !== 'function' || !_pfCanSeeMargin()) return;
  var gDisc = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0) || 0;
  document.querySelectorAll('.pf-margin-pct').forEach(function(el) {
    var idx = Number(el.getAttribute('data-idx'));
    var item = _pfItems[idx];
    if (!item) return;
    var pct = typeof _pfItemMarginPct === 'function' ? _pfItemMarginPct(item, gDisc) : null;
    el.innerHTML = _pfMarginLabel(pct);
  });
}

function _pfRowChange(i, field, val) {
  if (!_pfItems[i]) return;
  if (['qty','unitPrice','discPct','unitCost'].indexOf(field) !== -1) _pfItems[i][field] = _pfParseNum(val);
  else _pfItems[i][field] = val;
  _pfItems[i].lineTotal = _pfItemLineTotal(_pfItems[i]);
  // Update the lineTotal cell in DOM only
  var row = document.getElementById('pfRow_' + i);
  if (row) {
    var cells = row.querySelectorAll('td');
    var ltCell = cells[4]; // lineTotal column
    if (ltCell) ltCell.innerHTML = fmtNum(_pfItems[i].lineTotal);
  }
  _pfUpdateMarginCells();
  pfRecalc();
}

function pfAddRow() {
  _pfItems.push({ prodId:'', catalogCode:'', name:'', unit:'عدد', qty:1, unitPrice:0, discPct:0, discAmt:0, lineTotal:0 });
  var wrap = document.getElementById('pfItemsWrap');
  if (wrap) {
    var tr = document.createElement('tr');
    tr.outerHTML = ''; // placeholder
    var div = document.createElement('tbody');
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

function pfSetTax(pct) {
  var el = document.getElementById('pfTax');
  if (el) el.value = pct;
  pfRecalc();
}

function pfRecalc() {
  var taxPct  = Number(document.getElementById('pfTax')  ? document.getElementById('pfTax').value  : 0)  || 0;
  var discPct = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0)  || 0;
  var subtotal = _pfItems.reduce(function(s, item) {
    return s + _pfItemLineTotal(item);
  }, 0);
  var discAmt  = Math.round(subtotal * discPct / 100);
  var taxAmt   = Math.round((subtotal - discAmt) * taxPct / 100);
  var total    = subtotal - discAmt + taxAmt;
  var box = document.getElementById('pfTotalsBox');
  if (box) {
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>جمع ناخالص</span><span style="font-family:monospace">' + fmtNum(subtotal) + ' ﷼</span></div>' +
      (discPct ? '<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#c2410c"><span>تخفیف کلی ' + discPct + '٪</span><span style="font-family:monospace">−' + fmtNum(discAmt) + ' ﷼</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#475569"><span>مالیات ' + taxPct + '٪</span><span style="font-family:monospace">+' + fmtNum(taxAmt) + ' ﷼</span></div>' +
      '<div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;font-weight:700;font-size:14px"><span>جمع کل</span><span style="font-family:monospace;color:#1d4ed8">' + fmtNum(total) + ' ﷼</span></div>';
  }
  _pfUpdateMarginCells();
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
    drop.style.top    = (rect.bottom) + 'px';
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

  // Smart Auto-fill: find last proforma for this center to pre-populate details
  var lastPf = _pfList.find(function(p) { return p.centerKey === key; });
  if (lastPf) {
    if (document.getElementById('pfBuyerNatId'))   document.getElementById('pfBuyerNatId').value = lastPf.buyerNatId || '';
    if (document.getElementById('pfBuyerEcoCode'))  document.getElementById('pfBuyerEcoCode').value = lastPf.buyerEcoCode || '';
    if (document.getElementById('pfBuyerRegId'))   document.getElementById('pfBuyerRegId').value = lastPf.buyerRegId || '';
    if (document.getElementById('pfBuyerAddress')) document.getElementById('pfBuyerAddress').value = lastPf.buyerAddress || '';
    if (document.getElementById('pfBuyerPhone'))   document.getElementById('pfBuyerPhone').value = lastPf.buyerPhone || '';
    if (document.getElementById('pfBuyerPostal'))  document.getElementById('pfBuyerPostal').value = lastPf.buyerPostal || '';
  } else {
    // Fallback: load from DB.edits center details if available
    var ce = (typeof DB !== 'undefined' && DB.edits && DB.edits[key]) || {};
    if (document.getElementById('pfBuyerNatId'))   document.getElementById('pfBuyerNatId').value = '';
    if (document.getElementById('pfBuyerEcoCode'))  document.getElementById('pfBuyerEcoCode').value = ce.tax_code || '';
    if (document.getElementById('pfBuyerRegId'))   document.getElementById('pfBuyerRegId').value = '';
    if (document.getElementById('pfBuyerAddress')) document.getElementById('pfBuyerAddress').value = ce.address || '';
    if (document.getElementById('pfBuyerPhone'))   document.getElementById('pfBuyerPhone').value = (ce.phones && ce.phones.join(', ')) || '';
    if (document.getElementById('pfBuyerPostal'))  document.getElementById('pfBuyerPostal').value = '';
  }
  var ownerId = typeof getCenterOwnerFromKey === 'function' ? getCenterOwnerFromKey(key) : '';
  if (ownerId) {
    var sel = document.getElementById('pfSalesOwner');
    var resolved = _pfResolveOwnerId(ownerId);
    if (sel && resolved) sel.value = resolved;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────
async function pfSave() {
  var centerInp = document.getElementById('pfCenterName');
  var centerName = centerInp ? centerInp.value.trim() : '';
  var centerKey  = centerInp ? (centerInp.dataset.key || '') : '';
  var date  = document.getElementById('pfDate')  ? document.getElementById('pfDate').value.trim()  : todayStr();
  var taxPct  = Number(document.getElementById('pfTax')  ? document.getElementById('pfTax').value  : 0);
  var discPct = Number(document.getElementById('pfDisc') ? document.getElementById('pfDisc').value : 0);
  var note    = document.getElementById('pfNote')  ? document.getElementById('pfNote').value.trim()  : '';
  var valid   = Number(document.getElementById('pfValid') ? document.getElementById('pfValid').value : 3);

  // New fields
  var managerNote  = document.getElementById('pfManagerNote') ? (document.getElementById('pfManagerNote').value || '').trim() : '';
  var buyerNatId   = document.getElementById('pfBuyerNatId')   ? document.getElementById('pfBuyerNatId').value.trim()   : '';
  var buyerEcoCode = document.getElementById('pfBuyerEcoCode') ? document.getElementById('pfBuyerEcoCode').value.trim() : '';
  var buyerRegId   = document.getElementById('pfBuyerRegId')   ? document.getElementById('pfBuyerRegId').value.trim()   : '';
  var buyerAddress = document.getElementById('pfBuyerAddress') ? document.getElementById('pfBuyerAddress').value.trim() : '';
  var buyerPhone   = document.getElementById('pfBuyerPhone')   ? document.getElementById('pfBuyerPhone').value.trim()   : '';
  var buyerPostal  = document.getElementById('pfBuyerPostal')  ? document.getElementById('pfBuyerPostal').value.trim()  : '';

  // Ensure empty strings for all fields
  if (note === null || note === undefined) note = '';
  if (managerNote === null || managerNote === undefined) managerNote = '';

  // Sync any un-fired input values from DOM before saving
  _pfSyncAllWmsCosts();
  _pfItems.forEach(function(item, i) {
    var nameEl  = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
    var qtyEl   = document.querySelector('.pf-item-qty[data-idx="' + i + '"]');
    var priceEl = document.querySelector('.pf-item-price[data-idx="' + i + '"]');
    var discEl  = document.querySelector('.pf-item-disc[data-idx="' + i + '"]');
    var costEl  = document.querySelector('.pf-item-cost[data-idx="' + i + '"]');
    if (nameEl)  item.name        = nameEl.value.trim();
    // catalogCode is stored in _pfItems directly when product is selected from WMS
    if (qtyEl)   item.qty         = _pfParseNum(qtyEl.value);
    if (priceEl) item.unitPrice   = _pfParseNum(priceEl.value);
    if (discEl)  item.discPct     = _pfParseNum(discEl.value);
    if (costEl)  item.unitCost    = _pfParseNum(costEl.value);
    item.lineTotal = _pfItemLineTotal(item);
  });

  var items = _pfItems.filter(function(i){ return i.name && i.qty > 0; });
  if (!items.length) { showToast('❌ حداقل یک ردیف کالا با نام وارد کنید'); return; }

  var hasCommission  = !!(document.getElementById('pfHasCommission') && document.getElementById('pfHasCommission').checked);
  var commissionAmt  = Number(document.getElementById('pfCommissionAmt')  ? document.getElementById('pfCommissionAmt').value  : 0) || 0;
  var commissionNote = document.getElementById('pfCommissionNote') ? document.getElementById('pfCommissionNote').value.trim() : '';
  var wmsWarehouseId = document.getElementById('pfWarehouse') ? document.getElementById('pfWarehouse').value : '';
  var channel = document.getElementById('pfChannel') ? document.getElementById('pfChannel').value : 'direct';
  var paymentTerms = document.getElementById('pfPaymentTerms') ? document.getElementById('pfPaymentTerms').value : '';
  var salesOwner = document.getElementById('pfSalesOwner') ? document.getElementById('pfSalesOwner').value : '';
  var supportOwner = document.getElementById('pfSupportOwner') ? document.getElementById('pfSupportOwner').value : '';

  var body = {
    centerKey: centerKey, centerName: centerName,
    items: items, note: note, managerNote: managerNote,
    taxPct: taxPct, discountPct: discPct,
    jalaliDate: date, validDays: valid,
    buyerNatId: buyerNatId, buyerEcoCode: buyerEcoCode, buyerRegId: buyerRegId,
    buyerAddress: buyerAddress, buyerPhone: buyerPhone, buyerPostal: buyerPostal,
    hasCommission: hasCommission, commissionAmt: commissionAmt, commissionNote: commissionNote,
    wmsWarehouseId: wmsWarehouseId,
    channel: channel, paymentTerms: paymentTerms,
    salesOwner: salesOwner, supportOwner: supportOwner,
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
    var _pfM=document.getElementById('pfModal'); if(_pfM) _pfM.style.display='none';
    _pfEditId = data.id;
    var _tcId = window.__pfPendingTradeCaseId;
    if (_tcId && data.id) {
      window.__pfPendingTradeCaseId = null;
      fetch('/api/trade-cases/' + encodeURIComponent(_tcId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ proformaId: data.id, centerKey: centerKey || undefined }),
      }).then(function() {
        if (typeof showToast === 'function') showToast('🔗 پیش‌فاکتور به پرونده بازرگانی وصل شد');
      }).catch(function() {});
    }
    showToast('✅ پیشفاکتور ' + (method === 'PUT' ? 'ویرایش' : 'ایجاد') + ' شد — شماره: ' + data.no);
    await pfLoad();
    var el = document.getElementById('pfVanillaRoot');
    if (el) _renderPfPanel(el);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

// ── Print ─────────────────────────────────────────────────────────────────
// ── Template management helpers ──────────────────────────────────────────
function _pfGetTemplates() {
  var saved = (typeof DB !== 'undefined' && DB.settings && DB.settings.pfPrintTemplates);
  if (saved && saved.length) return saved;
  // Default two built-in templates
  return [
    { id: 'official', name: 'رسمی — با مشخصات فروشنده', includeSeller: true,  isDefault: true,  html: null },
    { id: 'blank',    name: 'بی‌نام — بدون فروشنده',      includeSeller: false, isDefault: false, html: null },
  ];
}
function _pfSaveTemplates(tpls) {
  if (!DB.settings) DB.settings = {};
  DB.settings.pfPrintTemplates = tpls;
  patchCrmSetting('pfPrintTemplates', tpls);
}
function _pfDefaultTplForPrint() {
  return _pfGetTemplates().find(function(t){ return t.isDefault; }) || _pfGetTemplates()[0];
}

function pfPrint(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  var tpls = _pfGetTemplates();

  var cardsHtml = tpls.map(function(t, idx) {
    var isDefault = t.isDefault;
    return '<button onclick="pfDoPrint(\'' + id + '\',\'' + t.id + '\')" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 18px;border:' +
      (isDefault ? '2px solid var(--brand)' : '1px solid #cbd5e1') +
      ';border-radius:10px;background:' + (isDefault ? '#eff6ff' : '#f8fafc') + ';cursor:pointer;text-align:right;width:100%;font-family:inherit;gap:4px">' +
      '<div style="display:flex;align-items:center;gap:8px;width:100%">' +
        '<span style="font-size:18px">' + (t.includeSeller ? '📜' : '📄') + '</span>' +
        '<span style="font-weight:700;font-size:13px;color:#1e293b;flex:1">' + esc(t.name) + '</span>' +
        (isDefault ? '<span style="background:var(--brand);color:white;font-size:10px;padding:1px 8px;border-radius:10px">پیش‌فرض</span>' : '') +
      '</div>' +
      '<span style="font-size:11px;color:#64748b">' + (t.includeSeller ? 'همراه با مشخصات فروشنده' : 'بدون اطلاعات فروشنده') + (t.html ? ' · قالب سفارشی' : ' · قالب پیش‌فرض') + '</span>' +
    '</button>';
  }).join('');

  var html = '<div style="display:flex;flex-direction:column;gap:10px;padding:8px 0">' + cardsHtml + '</div>';

  openModal('pfPrintSelectModal', '🖨️ انتخاب قالب چاپ پیش‌فاکتور', html,
    '<button onclick="var _el=document.getElementById(\'pfPrintSelectModal\');if(_el)_el.style.display=\'none\';" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>',
    {lg:false}
  );
}

function pfDoPrint(id, templateId) {
  var modal = document.getElementById('pfPrintSelectModal');
  if (modal) modal.style.display = 'none';

  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;

  var tpls = _pfGetTemplates();
  var tpl = (templateId ? tpls.find(function(t){ return t.id === templateId; }) : null) || _pfDefaultTplForPrint();

  var html = _pfPrintHTML(pf, tpl.includeSeller, tpl.html || null);
  if (/^\s*<!DOCTYPE/i.test(html) || /^\s*<html/i.test(html)) {
    var iframe = document.getElementById('pfPrintFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pfPrintFrame';
      iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0';
      document.body.appendChild(iframe);
    }
    var pdoc = iframe.contentWindow.document;
    pdoc.open();
    pdoc.write(html);
    pdoc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    return;
  }
  var zone = document.getElementById('pfPrintZone');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'pfPrintZone';
    zone.style.display = 'none';
    document.body.appendChild(zone);
  }
  zone.innerHTML = html;
  window.print();
}

function _pfPrintHTML(pf, includeSeller, customHtml) {
  var subtotal = pf.subtotal || 0;
  var discAmt  = pf.discAmt  || 0;
  var taxAmt   = pf.taxAmt   || 0;
  var total    = pf.total    || 0;
  
  var template = customHtml || (typeof DB !== 'undefined' && DB.settings && DB.settings.pfPrintTemplate) 
                 ? (customHtml || DB.settings.pfPrintTemplate) : _pfDefaultTemplate();

  var itemRows = (pf.items || []).map(function(item, i) {
    var discVal = Number(item.discPct || 0);
    return '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td style="font-family:monospace">' + esc(item.catalogCode || item.prodId || '') + '</td>' +
      '<td class="desc-col">' + esc(item.name || '') + '</td>' +
      '<td>' + fmtNum(item.qty) + '</td>' +
      '<td>' + esc(item.unit || 'عدد') + '</td>' +
      '<td class="currency-col">' + fmtNum(item.unitPrice) + '</td>' +
      '<td>' + (discVal ? discVal + '٪' : '—') + '</td>' +
      '<td class="currency-col">' + fmtNum(item.lineTotal) + '</td>' +
      '</tr>';
  }).join('');

  var sellerSection = '';
  var sellerHeader = '';

  if (includeSeller) {
    var seller = (typeof DB !== 'undefined' && DB.settings && DB.settings.sellerInfo) || {
      name: 'آتنا زیست درمان', natId: '۱۰۱۰۴۲۳۴۵۶۷', regId: '۱۲۳۴۵۶', ecoCode: '۴۱۱۱۲۳۴۵۶۷۸۹',
      address: 'تهران، خیابان ولیعصر، نرسیده به پارک وی، کوچه ...', postal: '۱۹۶۶۶۴۵۳۲۱', phone: '۰۲۱-۸۸۸۸۸۸۸۸'
    };

    sellerHeader =
      '<div style="text-align:center;font-weight:800;font-size:16px;color:#1e3a8a;padding-bottom:8px;border-bottom:2px solid #2563eb;margin-bottom:4px">' +
        esc(seller.name || 'آتنا زیست درمان') +
      '</div>';

    sellerSection =
      '<div class="buyer-section" style="margin-bottom:15px">' +
        '<div class="buyer-header">مشخصات فروشنده</div>' +
        '<div class="buyer-body">' +
          '<div><strong>نام:</strong> ' + esc(seller.name) + '</div>' +
          '<div><strong>شناسه ملی:</strong> ' + esc(seller.natId) + '</div>' +
          '<div><strong>شماره اقتصادی:</strong> ' + esc(seller.ecoCode) + '</div>' +
          '<div><strong>شماره ثبت:</strong> ' + esc(seller.regId) + '</div>' +
          '<div><strong>تلفن:</strong> <span style="direction:ltr;display:inline-block">' + esc(seller.phone) + '</span></div>' +
          '<div><strong>کد پستی:</strong> ' + esc(seller.postal) + '</div>' +
          '<div style="grid-column:1/-1"><strong>آدرس:</strong> ' + esc(seller.address) + '</div>' +
        '</div>' +
      '</div>';
  } else {
    // Blank header margin for pre-printed letterheads
    sellerHeader = '<div style="height:120px"></div>';
  }

  var noteHtml = '';
  if (pf.note && pf.note.trim()) {
    noteHtml = '<strong>توضیحات:</strong> ' + esc(pf.note);
  }

  var verifyUrl = (typeof location !== 'undefined' ? location.origin : '') + '/?pf=' + (pf.id || pf.no || '');

  var html = template
    .replace(/\{\{seller_header\}\}/g, sellerHeader)
    .replace(/\{\{seller_section\}\}/g, sellerSection)
    .replace(/\{\{pf\.no\}\}/g, esc(pf.no))
    .replace(/\{\{pf\.jalaliDate\}\}/g, esc(pf.jalaliDate||''))
    .replace(/\{\{pf\.centerName\}\}/g, esc(pf.centerName||'—'))
    .replace(/\{\{pf\.buyerNatId\}\}/g, esc(pf.buyerNatId||'—'))
    .replace(/\{\{pf\.buyerEcoCode\}\}/g, esc(pf.buyerEcoCode||'—'))
    .replace(/\{\{pf\.buyerRegId\}\}/g, esc(pf.buyerRegId||'—'))
    .replace(/\{\{pf\.buyerPhone\}\}/g, esc(pf.buyerPhone||'—'))
    .replace(/\{\{pf\.buyerPostal\}\}/g, esc(pf.buyerPostal||'—'))
    .replace(/\{\{pf\.buyerAddress\}\}/g, esc(pf.buyerAddress||'—'))
    .replace(/\{\{pf\.creatorName\}\}/g, esc(_pfCreatorName(pf.createdBy)))
    .replace(/\{\{pf\.verifyUrl\}\}/g, encodeURIComponent(verifyUrl))
    .replace(/\{\{items_html\}\}/g, itemRows)
    .replace(/\{\{subtotal\}\}/g, fmtNum(subtotal))
    .replace(/\{\{discAmt\}\}/g, fmtNum(discAmt))
    .replace(/\{\{taxPct\}\}/g, pf.taxPct||0)
    .replace(/\{\{taxAmt\}\}/g, fmtNum(taxAmt))
    .replace(/\{\{total\}\}/g, fmtNum(total))
    .replace(/\{\{totalWords\}\}/g, _numToWords(total))
    .replace(/\{\{pf\.note\}\}/g, noteHtml);

  return html;
}

function _pfDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پیش‌فاکتور {{pf.no}}</title>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 10px;
            background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
            -webkit-font-smoothing: antialiased;
        }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(37, 99, 235, 0.04);
            font-weight: 900;
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            user-select: none;
        }
        .pf-container {
            position: relative;
            font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
            direction: rtl;
            color: #334155;
            background: #ffffff;
            padding: 20px;
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05), 0 4px 10px rgba(0, 0, 0, 0.03);
            border-radius: 12px;
            border-top: 6px solid #2563eb;
            box-sizing: border-box;
            z-index: 1;
            display: flex;
            flex-direction: column;
        }
        .main-title {
            text-align: center;
            font-size: 18px;
            font-weight: 800;
            color: #1e3a8a;
            margin-bottom: 10px;
            position: relative;
            z-index: 2;
        }
        .invoice-meta {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            position: relative;
            z-index: 2;
        }
        .invoice-meta .meta-info {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 13px;
        }
        .qr-placeholder {
            width: 65px;
            height: 65px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            padding: 3px;
            overflow: hidden;
        }
        .qr-placeholder img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .buyer-section {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 11px;
            overflow: hidden;
            position: relative;
            z-index: 2;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .buyer-header {
            background: #eff6ff;
            color: #1e3a8a;
            padding: 6px 15px;
            border-bottom: 1px solid #bfdbfe;
            font-weight: bold;
            font-size: 13px;
        }
        .buyer-body {
            padding: 10px 15px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
            color: #475569;
        }
        .buyer-body strong {
            color: #1e293b;
        }
        .table-responsive {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin-bottom: 15px;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            position: relative;
            z-index: 2;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            min-width: 600px;
            text-align: center;
        }
        th {
            background-color: #e2e8f0;
            color: #0f172a;
            font-weight: 800;
            padding: 6px 4px;
            border: 1px solid #cbd5e1;
        }
        td {
            border: 1px solid #e2e8f0;
            padding: 6px 4px;
            color: #334155;
            line-height: 1.3;
        }
        td.desc-col {
            text-align: right;
        }
        tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }
        tbody tr:hover {
            background-color: #f1f5f9;
        }
        .currency-col {
            text-align: left;
            font-family: monospace;
            font-size: 12px;
            direction: ltr;
        }
        tfoot td {
            color: #475569;
        }
        tfoot tr.total-row td {
            background-color: #ecfdf5;
            color: #065f46;
            border-top: 2px solid #10b981;
            font-weight: bold;
            font-size: 13px;
        }
        .note-section {
            margin-bottom: 10px;
            font-size: 11px;
            line-height: 1.5;
            color: #475569;
            position: relative;
            z-index: 2;
            padding-right: 10px;
            border-right: 3px solid #cbd5e1;
        }
        .words-amount {
            font-size: 12px;
            margin-bottom: 15px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            color: #92400e;
            padding: 10px 15px;
            border-radius: 6px;
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
        }
        .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: auto;
            padding-top: 20px;
            font-size: 12px;
            font-weight: bold;
            position: relative;
            z-index: 2;
            color: #475569;
        }
        .signature-box {
            text-align: center;
            padding: 15px 10px 5px 10px;
            border-top: 1px dashed #cbd5e1;
        }
        @media print {
            @page {
                size: A4;
                margin: 5mm;
            }
            body {
                background: transparent;
                padding: 0;
            }
            .pf-container {
                box-shadow: none !important;
                border: none !important;
                max-width: 100% !important;
                padding: 0 !important;
                border-top: 6px solid #2563eb !important;
                min-height: 287mm;
                display: flex;
                flex-direction: column;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .table-responsive {
                border: 1px solid #cbd5e1;
                overflow-x: visible;
                box-shadow: none;
            }
            table {
                min-width: auto;
            }
            tr, .no-page-break {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>

<div class="pf-container pf-print">

  <div class="watermark">پیش‌فاکتور</div>

  <div class="main-title">پیش‌فاکتور فروش</div>

  <div style="margin-bottom: 15px; position: relative; z-index: 2;">
    {{seller_header}}
  </div>

  <div class="invoice-meta">
    <div class="meta-info">
        <div><strong style="color: #1e293b;">شماره پیش‌فاکتور:</strong> <span style="font-family: monospace; font-size: 16px; color: #2563eb;">{{pf.no}}</span></div>
        <div><strong style="color: #1e293b;">تاریخ:</strong> {{pf.jalaliDate}}</div>
    </div>
    <div class="qr-placeholder">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={{pf.verifyUrl}}" alt="QR Code پیش‌فاکتور {{pf.no}}">
    </div>
  </div>

  <div style="margin-bottom: 25px; position: relative; z-index: 2;">
    {{seller_section}}
  </div>

  <div class="buyer-section">
    <div class="buyer-header">
      مشخصات خریدار
    </div>
    <div class="buyer-body">
      <div><strong>نام خریدار:</strong> {{pf.centerName}}</div>
      <div><strong>شناسه/کد ملی:</strong> {{pf.buyerNatId}}</div>
      <div><strong>شماره اقتصادی:</strong> {{pf.buyerEcoCode}}</div>
      <div><strong>شماره ثبت:</strong> {{pf.buyerRegId}}</div>
      <div><strong>تلفن:</strong> <span style="direction: ltr; display: inline-block;">{{pf.buyerPhone}}</span></div>
      <div><strong>کد پستی:</strong> {{pf.buyerPostal}}</div>
      <div style="grid-column: 1 / -1;"><strong>آدرس:</strong> {{pf.buyerAddress}}</div>
    </div>
  </div>

  <div class="table-responsive">
    <table>
      <thead>
        <tr>
          <th>ردیف</th>
          <th>کد کالا</th>
          <th style="width: 30%;">شرح کالا / خدمات</th>
          <th>تعداد</th>
          <th>واحد</th>
          <th>مبلغ واحد (ریال)</th>
          <th>تخفیف</th>
          <th>مبلغ کل (ریال)</th>
        </tr>
      </thead>
      <tbody>
        {{items_html}}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-align: right; padding: 10px 12px; font-weight: bold;">جمع کل قبل از تخفیف کلی:</td>
          <td class="currency-col">{{subtotal}}</td>
        </tr>
        <tr>
          <td colspan="7" style="text-align: right; padding: 10px 12px; font-weight: bold;">تخفیف کلی:</td>
          <td class="currency-col">{{discAmt}}</td>
        </tr>
        <tr>
          <td colspan="7" style="text-align: right; padding: 10px 12px; font-weight: bold;">مالیات و عوارض ارزش افزوده ({{taxPct}}٪):</td>
          <td class="currency-col">{{taxAmt}}</td>
        </tr>
        <tr class="total-row">
          <td colspan="7" style="text-align: right; padding: 12px; font-size: 14px;">جمع کل فاکتور (ریال):</td>
          <td class="currency-col" style="font-size: 16px;">{{total}}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="note-section">
    {{pf.note}}
  </div>

  <div class="words-amount no-page-break">
    <strong style="margin-left: 8px;">مبلغ کل به حروف:</strong> {{totalWords}} ریال
  </div>

  <div class="signatures no-page-break">
    <div class="signature-box">
      مهر و امضای فروشنده
    </div>
    <div class="signature-box">
      مهر و امضای خریدار
    </div>
  </div>

</div>

</body>
</html>`;
}

// ── pfManageTemplates — multi-template management ──────────────────────────
var _pfMgTpls = null; // working copy during edit

function pfManageTemplates() {
  if (!_isManager()) { showToast('⚠ دسترسی فقط برای مدیر امکان‌پذیر است'); return; }
  _pfMgTpls = JSON.parse(JSON.stringify(_pfGetTemplates())); // deep copy
  _pfRenderManageTemplates();
}

function _pfRenderManageTemplates() {
  var tpls = _pfMgTpls;
  var vars = '<div style=\"font-size:11px;color:#0284c7;background:#f0f9ff;padding:8px 12px;border-radius:6px;border:1px solid #bae6fd;margin-bottom:12px;line-height:1.8\">' +
    '<strong>متغیرهای قابل استفاده در HTML:</strong><br>' +
    '{{seller.name}}, {{seller.ecoCode}}, {{seller.natId}}, {{seller.regId}}, {{seller.address}}, {{seller.postal}}, {{seller.phone}}<br>' +
    '{{pf.no}}, {{pf.jalaliDate}}, {{pf.centerName}}, {{pf.creatorName}}, {{pf.verifyUrl}}<br>' +
    '{{items_html}}, {{subtotal}}, {{discAmt}}, {{taxPct}}, {{taxAmt}}, {{total}}, {{totalWords}}, {{seller_header}}, {{seller_section}}' +
    '</div>';

  var listHtml = tpls.map(function(t, idx) {
    return '<div style=\"border:' + (t.isDefault?'2px solid var(--brand)':'1px solid #e2e8f0') + ';border-radius:10px;padding:12px 16px;margin-bottom:10px;background:' + (t.isDefault?'#eff6ff':'#f8fafc') + '\">' +
      '<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:8px\">' +
        '<input type=\"text\" value=\"' + esc(t.name) + '\" placeholder=\"نام قالب\" ' +
          'oninput=\"_pfMgTpls[' + idx + '].name=this.value\" ' +
          'style=\"flex:1;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-family:inherit;font-size:13px\">' +
        '<label style=\"display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;white-space:nowrap\">' +
          '<input type=\"checkbox\" ' + (t.includeSeller?'checked':'') + ' onchange=\"_pfMgTpls[' + idx + '].includeSeller=this.checked\"> مشخصات فروشنده' +
        '</label>' +
        '<label style=\"display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;white-space:nowrap\">' +
          '<input type=\"radio\" name=\"pfDefaultTpl\" ' + (t.isDefault?'checked':'') + ' onchange=\"_pfMgTpls.forEach(function(x,i){x.isDefault=(i===' + idx + ')})\"> پیش‌فرض' +
        '</label>' +
        '<button onclick=\"_pfMgEditHtml(' + idx + ')\" style=\"padding:4px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;cursor:pointer;background:white\">✏️ HTML</button>' +
        (tpls.length > 1 ? '<button onclick=\"_pfMgTpls.splice(' + idx + ',1);_pfRenderManageTemplates()\" style=\"padding:4px 8px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:6px;font-size:12px;cursor:pointer\">🗑</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  var html = vars + listHtml +
    '<button onclick=\"_pfMgAddTpl()\" style=\"width:100%;padding:10px;border:2px dashed #cbd5e1;border-radius:10px;background:transparent;color:#64748b;font-family:inherit;font-size:13px;cursor:pointer;margin-top:4px\">+ افزودن قالب جدید</button>';

  openModal('pfTplMgModal', '🎨 مدیریت قالب‌های چاپ', html,
    '<button onclick="_pfCloseMgModal()" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="_pfMgSave()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره همه</button>',
    {lg:true}
  );
}
function _pfCloseMgModal() { var m=document.getElementById('pfTplMgModal'); if(m) m.style.display='none'; }

function _pfMgAddTpl() {
  _pfMgTpls.push({ id: 'tpl_' + Date.now(), name: 'قالب جدید', includeSeller: true, isDefault: false, html: null });
  _pfRenderManageTemplates();
}

function _pfMgEditHtml(idx) {
  var t = _pfMgTpls[idx];
  var currentHtml = t.html || _pfDefaultTemplate();
  var body = '<textarea id=\"pfTplHtmlArea\" style=\"width:100%;height:450px;font-family:monospace;font-size:12px;direction:ltr;text-align:left;padding:10px;border:1px solid #cbd5e1;border-radius:6px;resize:vertical\">' + esc(currentHtml) + '</textarea>';
  openModal('pfTplHtmlModal', '✏️ ویرایش HTML — ' + esc(t.name), body,
    '<button onclick="_pfResetTplHtml()" style="padding:8px 12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;margin-left:8px">🔄 پیش‌فرض</button>' +
    '<button onclick="_pfCloseTplHtmlModal()" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="_pfApplyTplHtml(' + idx + ')" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 اعمال</button>',
    {lg:true}
  );
}
function _pfCloseTplHtmlModal() { var m=document.getElementById('pfTplHtmlModal'); if(m) m.style.display='none'; }
function _pfResetTplHtml() { if(confirm('بازگشت به قالب پیش‌فرض؟')){ var a=document.getElementById('pfTplHtmlArea'); if(a) a.value=_pfDefaultTemplate(); } }
function _pfApplyTplHtml(idx) {
  var a=document.getElementById('pfTplHtmlArea');
  if(a && _pfMgTpls) _pfMgTpls[idx].html=a.value;
  _pfCloseTplHtmlModal();
  showToast('✅ HTML ذخیره موقت شد');
}

function _pfMgSave() {
  _pfSaveTemplates(_pfMgTpls);
  var _mgModal = document.getElementById('pfTplMgModal');
  if (_mgModal) _mgModal.style.display = 'none';
  showToast('✅ قالب‌های چاپ ذخیره شدند');
}

// Keep old pfOpenTemplateEditor as alias for backward compat
function pfOpenTemplateEditor() { pfManageTemplates(); }
function pfSaveTemplate() { _pfMgSave(); }
function pfResetTemplate() {
  var a = document.getElementById('pfTplHtmlArea');
  if (a && confirm('بازگشت به قالب پیش‌فرض؟')) a.value = _pfDefaultTemplate();
}

// ── Open new proforma for a center (from center profile) ───────────────────
async function _pfOpenNewForCenterForm(centerKey, centerName) {
  _pfEditId = null;
  _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, discPct:0, discAmt:0, lineTotal:0 }];
  _pfProdViewMode = 'tree';
  _pfProdSearch = '';
  _pfActiveCat = null;
  await _pfLoadWmsProds();
  if (typeof buildUSERS === 'function') buildUSERS();
  _pfEnsureCenterCache();
  _pfShowModal({ centerKey: centerKey || '', centerName: centerName || '', status: 'draft' });
}

function _pfTakePendingNewCenter() {
  var p = _pfPendingNewCenter || window.__pfPendingNewCenter || null;
  _pfPendingNewCenter = null;
  window.__pfPendingNewCenter = null;
  return p;
}

async function _pfConsumePendingNewCenter() {
  var p = _pfTakePendingNewCenter();
  if (!p) return;
  await _pfOpenNewForCenterForm(p.centerKey, p.centerName);
}

async function pfOpenNewForCenter(centerKey, centerName) {
  _pfPendingNewCenter = { centerKey: centerKey || '', centerName: centerName || '' };
  window.__pfPendingNewCenter = _pfPendingNewCenter;
  if (typeof ensureTabScripts === 'function') {
    await ensureTabScripts('proforma');
  }
  if (typeof switchTab === 'function') {
    switchTab('proforma');
  } else {
    await _pfConsumePendingNewCenter();
  }
}
window.pfOpenNewForCenter = pfOpenNewForCenter;

// ── Open proformas list filtered for a center ─────────────────────────────
async function pfOpenForCenter(centerKey, centerName) {
  // Switch to proforma tab
  if (typeof switchTab === 'function') switchTab('proforma');
  // Pre-filter to this center
  _pfSearch = centerName || centerKey;
  _pfFilter = 'all';
  _pfPage   = 0;
  // Render
  var el = document.getElementById('pfVanillaRoot');
  if (el) {
    try {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">در حال بارگذاری…</div>';
      await pfLoad();
      _renderPfPanel(el);
    } catch(e) { console.error('[proforma] pfOpenForCenter:', e); }
  }
}


// ── Product / category aggregation report ────────────────────────────────
function _pfItemCategory(it) {
  if (it && it.category) return it.category;
  var pid = it && it.prodId;
  var code = it && it.catalogCode;
  var p = (_pfWmsProds || []).find(function(x) {
    return (pid && String(x.id) === String(pid)) || (code && String(x.catalog_code || x.catalogCode || '') === String(code));
  });
  return p ? (p.category || 'سایر') : 'سایر';
}

function _pfItemAmount(it, pf) {
  var qty = Number(it && it.qty) || 0;
  var amt = Number(it && it.lineTotal);
  if (!amt || isNaN(amt)) amt = qty * (Number(it && it.unitPrice) || 0);
  if (!amt && pf && pf.total && (pf.items || []).length === 1) amt = Number(pf.total) || 0;
  return amt || 0;
}

function _pfPfAmount(pf) {
  var t = Number(pf && pf.total);
  if (t > 0) return t;
  return (pf.items || []).reduce(function(s, it) { return s + _pfItemAmount(it, pf); }, 0);
}

function _pfStatusLabel(st) {
  return (PF_STATUS[st] || { label: st }).label;
}

function _pfFilteredListForReport() {
  return _pfGetFilteredList();
}

function _pfBuildAggReport(list, mode) {
  var agg = {};
  list.forEach(function(pf) {
    var pfId = pf.id || pf.no || '';
    var pfAmt = _pfPfAmount(pf);
    var expert = _pfGetResponsibleName(pf);
    var expertId = _pfGetResponsibleId(pf);
    var items = pf.items || [];
    if (!items.length) {
      var k = mode === 'category' ? 'بدون ردیف' : '—';
      if (!agg[k]) agg[k] = { label: k, sub: '', qty: 0, amount: 0, pfSet: {}, products: {}, entries: [], centers: {} };
      agg[k].amount += pfAmt;
      if (pfId) agg[k].pfSet[pfId] = true;
      agg[k].entries.push({ pfId: pfId, pfNo: pf.no, centerName: pf.centerName, expert: expert, status: pf.status, date: pf.jalaliDate, total: pfAmt, items: [] });
      return;
    }
    items.forEach(function(it) {
      var qty = Number(it.qty) || 0;
      var amt = _pfItemAmount(it, pf);
      var cat = _pfItemCategory(it);
      var key, label, sub;
      if (mode === 'category') {
        key = cat; label = cat; sub = '';
      } else if (mode === 'expert') {
        key = expertId || expert || 'نامشخص';
        label = expert || 'نامشخص'; sub = '';
      } else {
        key = String(it.catalogCode || it.prodId || it.name || '—');
        label = it.name || key;
        sub = it.catalogCode || it.prodId || '';
      }
      if (!agg[key]) agg[key] = { label: label, sub: sub, qty: 0, amount: 0, pfSet: {}, products: {}, entries: [], centers: {} };
      var row = agg[key];
      row.qty += qty;
      row.amount += amt;
      if (pfId) row.pfSet[pfId] = true;
      var pk = String(it.catalogCode || it.prodId || it.name || '—');
      if (!row.products[pk]) row.products[pk] = { name: it.name || pk, code: it.catalogCode || it.prodId || '', qty: 0, amount: 0 };
      row.products[pk].qty += qty;
      row.products[pk].amount += amt;
      var ck = pf.centerKey || pf.centerName || pfId;
      if (!row.centers[ck]) row.centers[ck] = { name: pf.centerName || '—', expert: expert, count: 0, amount: 0, statuses: {} };
      row.centers[ck].count += 1;
      row.centers[ck].amount += amt;
      row.centers[ck].statuses[pf.status] = (row.centers[ck].statuses[pf.status] || 0) + 1;
      row.entries.push({
        pfId: pfId, pfNo: pf.no, centerName: pf.centerName, centerKey: pf.centerKey,
        expert: expert, status: pf.status, date: pf.jalaliDate, total: pfAmt,
        itemName: it.name, itemQty: qty, itemAmt: amt, category: cat
      });
    });
  });
  return Object.keys(agg).map(function(k) {
    var row = agg[k];
    row.pfCount = Object.keys(row.pfSet).length;
    row.centerCount = Object.keys(row.centers).length;
    row.productList = Object.keys(row.products).map(function(p) { return row.products[p]; }).sort(function(a, b) { return b.amount - a.amount; });
    row.centerList = Object.keys(row.centers).map(function(x) { return row.centers[x]; }).sort(function(a, b) { return b.amount - a.amount; });
    delete row.pfSet;
    delete row.products;
    delete row.centers;
    return row;
  }).sort(function(a, b) { return b.amount - a.amount; });
}

function _pfBuildPlanningRows(list) {
  var rows = [];
  list.forEach(function(pf) {
    var expert = _pfGetResponsibleName(pf);
    var stLbl = _pfStatusLabel(pf.status);
    var items = pf.items || [];
    if (!items.length) {
      rows.push({ expert: expert, pfNo: pf.no, pfId: pf.id, centerName: pf.centerName || '—', category: '—', product: '—', qty: 0, amount: _pfPfAmount(pf), status: stLbl, date: pf.jalaliDate || '', rawStatus: pf.status });
      return;
    }
    items.forEach(function(it) {
      rows.push({
        expert: expert, pfNo: pf.no, pfId: pf.id, centerName: pf.centerName || '—',
        category: _pfItemCategory(it), product: it.name || '—',
        qty: Number(it.qty) || 0, amount: _pfItemAmount(it, pf),
        status: stLbl, date: pf.jalaliDate || '', rawStatus: pf.status
      });
    });
  });
  rows.sort(function(a, b) {
    if (a.expert !== b.expert) return a.expert.localeCompare(b.expert, 'fa');
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (a.centerName || '').localeCompare(b.centerName || '', 'fa');
  });
  return rows;
}

// ── Navigate to center from proforma panel ───────────────────────────────
function pfCenterClick(idx) {
  var entry = _pfCenterMap[idx] || {};
  var centerKey = entry.key || '';
  var centerName = entry.name || '';
  if (!centerKey) return;
  var parts = centerKey.split('_');
  var rtype = parts[0];
  var rid   = parts.slice(1).join('_');

  // Switch to provinces tab
  if (typeof switchTab === 'function') switchTab('provinces');

  setTimeout(function() {
    if (rtype === 'center' || rtype === 'c') {
      // Tehran center — find its province and open it
      if (typeof openCenterModal === 'function') {
        openCenterModal(rtype, rid);
      }
    } else if (rtype === 'pc') {
      // Province center — extract province id
      var provId = rid.split('||')[0];
      if (typeof openProvince === 'function') openProvince(provId);
    }
  }, 300);
}

// ── Version history modal ────────────────────────────────────────────────
function _pfVerField(label, val) {
  if (val === undefined || val === null || val === '') return '';
  return '<div class="pf-ver-field"><span class="pf-ver-lbl">' + esc(label) + '</span><span class="pf-ver-val">' + esc(String(val)) + '</span></div>';
}
function _pfRenderVerItems(items) {
  if (!items || !items.length) return '<div class="pf-ver-empty">بدون ردیف کالا</div>';
  var rows = items.map(function(it) {
    var disc = it.discPct ? ' (تخفیف ' + it.discPct + '٪)' : '';
    return '<tr>'
      + '<td>' + esc(it.name || '—') + '</td>'
      + '<td><code>' + esc(it.catalogCode || it.prodId || '—') + '</code></td>'
      + '<td style="text-align:center">' + (it.qty || 0) + '</td>'
      + '<td style="text-align:left;direction:ltr">' + fmtNum(it.unitPrice || 0) + '</td>'
      + '<td style="text-align:left;direction:ltr;font-weight:700">' + fmtNum(it.lineTotal || (it.qty * it.unitPrice) || 0) + disc + '</td>'
      + '</tr>';
  }).join('');
  return '<div class="pf-ver-items-wrap"><table class="pf-ver-items"><thead><tr><th>کالا</th><th>کد</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
async function pfShowVersions(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  var versions = pf.versions || [];
  if (!versions.length) { showToast('هیچ نسخه قبلی‌ای ثبت نشده است'); return; }
  var revs = versions.slice().reverse();
  var html = '<div class="pf-versions-scroll">' +
    revs.map(function(v, i) {
      var items = v.items || [];
      var dateStr = '';
      try { var d = new Date(v.at); dateStr = d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      var buyerBlock = (v.buyerNatId || v.buyerEcoCode || v.buyerAddress || v.buyerPhone)
        ? '<div class="pf-ver-section"><div class="pf-ver-section-title">خریدار</div><div class="pf-ver-grid">'
          + _pfVerField('شناسه ملی', v.buyerNatId)
          + _pfVerField('کد اقتصادی', v.buyerEcoCode)
          + _pfVerField('شماره ثبت', v.buyerRegId)
          + _pfVerField('تلفن', v.buyerPhone)
          + _pfVerField('کد پستی', v.buyerPostal)
          + _pfVerField('آدرس', v.buyerAddress)
          + '</div></div>' : '';
      var commBlock = v.hasCommission
        ? '<div class="pf-ver-section"><div class="pf-ver-section-title">کمیسیون</div><div class="pf-ver-grid">'
          + _pfVerField('مبلغ', fmtNum(v.commissionAmt) + ' ﷼')
          + _pfVerField('یادداشت', v.commissionNote)
          + '</div></div>' : '';
      return '<div class="pf-ver-card' + (i === 0 ? ' pf-ver-latest' : '') + '">'
        + '<div class="pf-ver-head">'
          + '<span class="pf-ver-num">نسخه ' + (revs.length - i) + (i === 0 ? ' <span class="pf-ver-badge">آخرین</span>' : '') + '</span>'
          + '<span class="pf-ver-meta">' + dateStr + ' · ' + esc(v.by || '') + '</span>'
        + '</div>'
        + '<div class="pf-ver-total">جمع کل: ' + fmtNum(v.total) + ' ﷼</div>'
        + '<div class="pf-ver-summary">ناخالص ' + fmtNum(v.subtotal) + ' · تخفیف ' + (v.discountPct || 0) + '٪ (' + fmtNum(v.discAmt) + ') · مالیات ' + (v.taxPct || 0) + '٪ (' + fmtNum(v.taxAmt) + ')</div>'
        + '<div class="pf-ver-grid pf-ver-meta-row">'
          + _pfVerField('تاریخ پیشفاکتور', v.jalaliDate)
          + _pfVerField('اعتبار (روز)', v.validDays)
          + _pfVerField('مرکز', v.centerName || v.centerKey)
          + _pfVerField('وضعیت', v.status)
        + '</div>'
        + '<div class="pf-ver-section"><div class="pf-ver-section-title">ردیف‌های کالا (' + items.length + ')</div>' + _pfRenderVerItems(items) + '</div>'
        + buyerBlock
        + commBlock
        + (v.note ? '<div class="pf-ver-note">📝 ' + esc(v.note) + '</div>' : '')
        + (v.managerNote ? '<div class="pf-ver-note pf-ver-mgr">👤 مدیر: ' + esc(v.managerNote) + '</div>' : '')
        + (['draft', 'sent', 'approved'].indexOf(pf.status) >= 0
          ? '<div style="margin-top:10px;text-align:left"><button type="button" class="pf-ver-restore-btn" onclick="pfRestoreVersion(\'' + esc(id) + '\',' + (versions.length - 1 - i) + ')">↩ بازگردانی این نسخه</button></div>'
          : '')
      + '</div>';
    }).join('') + '</div>';

  openModal('pfVersionsModal', '🕐 تاریخچه نسخه‌ها — ' + esc(pf.no), html,
    '<button onclick="var _el=document.getElementById(\'pfVersionsModal\');if(_el)_el.style.display=\'none\';" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">بستن</button>',
    {lg:true}
  );
}

function pfRestoreVersion(pfId, versionIndex) {
  if (!confirm('آیا از بازگردانی این نسخه مطمئن هستید؟ وضعیت فعلی قبل از بازگردانی ذخیره می‌شود.')) return;
  fetch('/api/proforma/' + encodeURIComponent(pfId) + '/restore', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionIndex: versionIndex })
  }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) { showToast(res.body.error || 'خطا در بازگردانی'); return; }
      var idx = _pfList.findIndex(function (p) { return p.id === pfId; });
      if (idx >= 0) _pfList[idx] = res.body;
      showToast('✅ نسخه بازگردانی شد');
      var _el = document.getElementById('pfVersionsModal');
      if (_el) _el.style.display = 'none';
      if (typeof pfOpenEdit === 'function') pfOpenEdit(pfId);
      else if (typeof renderProformaList === 'function') renderProformaList();
    })
    .catch(function () { showToast('خطا در بازگردانی نسخه'); });
}

// ── Schedule follow-up in week plan ──────────────────────────────────────
function pfScheduleFollowup(pfId) {
  var pf = _pfList.find(function(p){ return p.id === pfId; });
  if (!pf || !pf.centerKey) return;
  var parts = pf.centerKey.split('_');
  var rtype = parts[0]; // 'center' or 'pc'
  var rid   = parts.slice(1).join('_');
  var cname = pf.centerName || pf.centerKey;

  // Use the convertFollowupToTask pattern but for week entries
  var today = todayStr ? todayStr() : '';
  var html =
    '<div style="margin-bottom:12px;font-size:13px;color:#475569">پیگیری پیشفاکتور <strong>' + esc(pf.no) + '</strong> برای <strong>' + esc(cname) + '</strong> ثبت می‌شود:</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">تاریخ</label>' +
        '<input type="text" id="pfWpDate" value="' + today + '" placeholder="YYYY/MM/DD" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:13px" onclick="openJDP(this,function(v){document.getElementById(\'pfWpDate\').value=v})"></div>' +
      '<div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">نوع اقدام</label>' +
        '<div style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#f8fafc;color:#0369a1">📞 تماس (پیگیری پیشفاکتور)</div>' +
        '<input type="hidden" id="pfWpType" value="call"></div>' +
    '</div>';

  html += '<input type="hidden" id="pfWpPfNo" value="' + esc(pf.no || '') + '">';
  openModal('pfWpModal', '📅 ثبت پیگیری در برنامه هفته', html,
    '<button onclick="var _el=document.getElementById(\'pfWpModal\');if(_el)_el.style.display=\'none\';" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="_pfDoSchedule(\'' + rtype + '\',\'' + esc(rid) + '\',\'' + esc(cname) + '\')" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">📅 ثبت</button>',
    {lg:false}
  );
}

function _pfAddToWeekPlan(rtype, rid, cname, scheduledDate, actionType, pfNo, pfId) {
  if (!scheduledDate) { showToast('تاریخ نامعتبر'); return false; }
  var act = (pfId || pfNo) ? 'call' : (actionType || 'call');
  var weekId = typeof getWeekId === 'function' ? getWeekId(scheduledDate) : null;
  if (!weekId) { showToast('هفته‌ی برای این تاریخ یافت نشد'); return false; }
  var recKey = rtype + '_' + rid;
  var entryKey = typeof wpEntryKey === 'function' ? wpEntryKey(weekId, rtype, rid) : (weekId + ':::' + rtype + ':::' + rid);
  if (typeof wpRemoveFromOtherWeeks === 'function') wpRemoveFromOtherWeeks(recKey, weekId);
  if (!DB.weekEntries) DB.weekEntries = {};
  var notePrefix = pfNo ? ('PF ' + pfNo + ' — ') : '';
  DB.weekEntries[entryKey] = {
    rtype: rtype, rid: rid, recKey: recKey,
    scheduledDate: scheduledDate, actionType: act,
    done: false, doneDate: null,
    addedBy: _pfGetResponsibleId({ centerKey: rtype + '_' + rid, createdBy: currentUser }) || currentUser,
    centerName: cname,
    pfNote: notePrefix + 'پیگیری پیش‌فاکتور',
    pfNo: pfNo || '',
    pfId: pfId || ''
  };
  if (typeof saveWeekEntryApi === 'function') saveWeekEntryApi(entryKey, DB.weekEntries[entryKey]);
  if (typeof _wpSaveWeek === 'function') _wpSaveWeek([entryKey]);
  else if (typeof saveDB === 'function') saveDB();
  if (typeof setE === 'function') setE(rtype, rid, 'followupDate', scheduledDate);
  return entryKey;
}

function pfEnsureWeekEntryForPf(pf) {
  if (!pf || !pf.centerKey) return null;
  var parts = pf.centerKey.split('_');
  var rtype = parts[0];
  var rid = parts.slice(1).join('_');
  var recKey = rtype + '_' + rid;
  var foundKey = null;
  if (DB.weekEntries) {
    Object.keys(DB.weekEntries).forEach(function(k) {
      if (foundKey) return;
      var we = DB.weekEntries[k];
      if (!we || we.done) return;
      var rk = we.recKey || ((we.rtype || '') + '_' + (we.rid || ''));
      if (rk === recKey) foundKey = k;
    });
  }
  if (foundKey) {
    var we0 = DB.weekEntries[foundKey];
    we0.pfId = pf.id;
    we0.pfNo = pf.no || '';
    we0.actionType = 'call';
    if (!we0.pfNote) we0.pfNote = 'PF ' + (pf.no || '') + ' — پیگیری پیش‌فاکتور';
    if (typeof saveWeekEntryApi === 'function') saveWeekEntryApi(foundKey, we0);
    return foundKey;
  }
  var today = typeof todayStr === 'function' ? todayStr() : '';
  return _pfAddToWeekPlan(rtype, rid, pf.centerName || pf.centerKey, today, 'call', pf.no, pf.id);
}

function pfOpenOutcomeModal(pfId, presetOutcome) {
  var pf = _pfList.find(function(p) { return p.id === pfId; });
  if (!pf || !pf.centerKey) { showToast('مرکز مشخص نیست'); return; }
  if (typeof wpMarkDoneKey !== 'function') { showToast('ماژول برنامه هفته بارگذاری نشده'); return; }
  var eKey = pfEnsureWeekEntryForPf(pf);
  if (!eKey) { showToast('خطا در آماده‌سازی برنامه'); return; }
  window._wpDonePreset = presetOutcome || null;
  wpMarkDoneKey(eKey);
}

function _pfMapLostReason(reason) {
  var map = {
    'رقیب برد': 'competitor',
    'قیمت بالا': 'price_high',
    'نیاز نداشتن': 'need_change',
    'زمان‌بندی نامناسب': 'other',
    'عدم دسترسی به تصمیم‌گیر': 'no_response',
    'سایر': 'other'
  };
  return map[reason] || 'other';
}

function _pfOnOutcomeDone(pfId, data) {
  if (!pfId || !data) return;
  var typeMap = { followup: 'followup', inactive: 'outcome_inactive', won: 'outcome_won' };
  var ftype = typeMap[data.outcome] || 'followup';
  var noteParts = [];
  if (data.pfNo) noteParts.push('PF ' + data.pfNo);
  if (data.outcome === 'followup' && data.nextDate) noteParts.push('پیگیری بعدی: ' + data.nextDate);
  if (data.outcome === 'inactive' && data.lostReason) noteParts.push('دلیل: ' + data.lostReason);
  if (data.outcome === 'won' && data.amount > 0) noteParts.push('مبلغ: ' + data.amount + ' میلیون');
  if (data.note) noteParts.push(data.note);
  fetch('/api/proforma/' + encodeURIComponent(pfId) + '/followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      type: ftype,
      note: noteParts.join(' — '),
      outcome: data.outcome,
      nextDate: data.nextDate || '',
      lostReason: data.lostReason || '',
      lostReasonKey: _pfMapLostReason(data.lostReason || ''),
      amount: data.amount || 0
    })
  }).then(function() {
    if (typeof pfLoad === 'function') {
      return pfLoad().then(function() {
        var el = _pfRoot();
        if (el) _renderPfPanel(el);
      });
    }
  }).catch(function() {});
}
window._pfOnOutcomeDone = _pfOnOutcomeDone;
window.pfOpenOutcomeModal = pfOpenOutcomeModal;

function pfAddToToday(pfId) {
  var pf = _pfList.find(function(p) { return p.id === pfId; });
  if (!pf || !pf.centerKey) { showToast('مرکز مشخص نیست'); return; }
  var parts = pf.centerKey.split('_');
  var rtype = parts[0];
  var rid = parts.slice(1).join('_');
  var today = typeof todayStr === 'function' ? todayStr() : '';
  if (_pfAddToWeekPlan(rtype, rid, pf.centerName || pf.centerKey, today, 'call', pf.no, pf.id)) {
    showToast('✅ به برنامه امروز اضافه شد — ' + (pf.centerName || ''));
  }
}

function _pfDoSchedule(rtype, rid, cname) {
  var dateEl = document.getElementById('pfWpDate');
  var typeEl = document.getElementById('pfWpType');
  if (!dateEl || !dateEl.value) { showToast('تاریخ را وارد کنید'); return; }
  var scheduledDate = dateEl.value;
  var actionType = 'call';
  var pfNoEl = document.getElementById('pfWpPfNo');
  var pfNo = pfNoEl ? pfNoEl.value : '';
  var pfId = '';
  var pfObj = _pfList.find(function(p) { return p.no === pfNo; });
  if (pfObj) pfId = pfObj.id;
  if (_pfAddToWeekPlan(rtype, rid, cname, scheduledDate, actionType, pfNo, pfId)) {
    var _pfWM = document.getElementById('pfWpModal');
    if (_pfWM) _pfWM.style.display = 'none';
    showToast('✅ پیگیری در برنامه هفته ثبت شد — ' + scheduledDate);
  }
}

// ── Modal HTML ───────────────────────────────────────────────────────────
function _pfModalHTML() {
  return '<div id="pfModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:flex-start;justify-content:center;backdrop-filter:blur(3px);padding:16px;overflow-y:auto" onclick="if(event.target===this)this.style.display=\'none\'">' +
    '<div style="background:white;border-radius:16px;width:min(98vw,1200px);min-height:80vh;box-shadow:0 24px 64px rgba(0,0,0,.25);display:flex;flex-direction:column">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;z-index:1;border-radius:16px 16px 0 0">' +
        '<span style="font-size:16px;font-weight:800">📄 پیشفاکتور</span>' +
        '<button onclick="var _el=document.getElementById(\'pfModal\');if(_el)_el.style.display=\'none\';" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;padding:2px 8px;border-radius:6px;line-height:1">✕</button>' +
      '</div>' +
      '<div id="pfModalBody" style="padding:24px;flex:1;overflow-y:auto"></div>' +
      '<div id="pfModalFooter" style="padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;background:#f8fafc;border-radius:0 0 16px 16px;position:sticky;bottom:0"></div>' +
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

// ── Attachments (images / files) ───────────────────────────────────────────
var _pfFiles = [];

function _pfFormatFileSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

async function _pfLoadFiles(pfId) {
  _pfFiles = [];
  if (!pfId) return;
  try {
    var r = await fetch('/api/proforma/' + pfId + '/files/list');
    if (r.ok) { var data = await r.json(); _pfFiles = data.files || []; }
  } catch (e) {}
}

function _pfRenderAttachmentsHtml(pf) {
  var canUpload = _pfCanUploadAttachments(pf);
  var list = _pfFiles.length
    ? _pfFiles.map(function(f) {
        var isImg = (f.mime_type || '').indexOf('image/') === 0;
        var viewBtn = '<button type="button" onclick="pfViewAttachment(' + f.id + ')" style="padding:3px 8px;font-size:11px;border:1px solid #bfdbfe;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer;font-family:inherit">' + (isImg ? '🖼️' : '📄') + ' مشاهده</button>';
        var delBtn = _pfCanDeleteFile(pf, f)
          ? ' <button type="button" onclick="pfDeleteAttachment(' + f.id + ')" style="padding:3px 8px;font-size:11px;border:1px solid #fecaca;border-radius:5px;background:#fef2f2;color:#b91c1c;cursor:pointer;font-family:inherit">حذف</button>'
          : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:white;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px">' +
          '<div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.filename) + '</div>' +
          '<div style="font-size:10px;color:#94a3b8">' + _pfFormatFileSize(f.file_size) + ' · ' + esc(f.uploaded_by || '') + '</div></div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0">' + viewBtn + delBtn + '</div></div>';
      }).join('')
    : '<div style="font-size:12px;color:#94a3b8;padding:8px 0">پیوستی ثبت نشده</div>';
  var pfId = (pf && pf.id) || _pfEditId;
  var uploadBox = canUpload
    ? '<label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;cursor:pointer;font-size:12px;color:#475569;margin-top:8px">📎 افزودن تصویر / فایل<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" onchange="pfUploadAttachment(this)"></label>'
    : (!pfId ? '<div style="font-size:11px;color:#f59e0b;margin-top:6px">💡 ابتدا پیشفاکتور را ذخیره کنید، سپس پیوست اضافه کنید.</div>' : '');
  return '<div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc">' +
    '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">📎 پیوست‌ها (تصویر / فایل)</div>' +
    '<div id="pfAttachmentsList">' + list + '</div>' + uploadBox + '</div>';
}

function _pfRefreshAttachmentsUi() {
  var wrap = document.getElementById('pfAttachmentsList');
  if (!wrap || !wrap.parentElement) return;
  var html = _pfRenderAttachmentsHtml(_pfOpenPf);
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var nl = tmp.querySelector('#pfAttachmentsList');
  var lb = tmp.querySelector('label');
  if (nl) wrap.innerHTML = nl.innerHTML;
  var oldLb = wrap.parentElement.querySelector('label');
  if (lb) {
    if (oldLb) oldLb.replaceWith(lb);
    else wrap.parentElement.appendChild(lb);
  } else if (oldLb) {
    oldLb.remove();
  }
}

function pfViewAttachment(fileId) { window.open('/api/proforma/files/' + fileId, '_blank'); }

async function pfUploadAttachment(input) {
  if (!_pfEditId) { showToast('❌ ابتدا پیشفاکتور را ذخیره کنید'); return; }
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) { showToast('❌ حداکثر حجم ۱۵ مگابایت'); return; }
  var fd = new FormData();
  fd.append('file', file);
  try {
    var r = await fetch('/api/proforma/' + _pfEditId + '/files', { method: 'POST', body: fd });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    showToast('✅ فایل پیوست شد');
    await _pfLoadFiles(_pfEditId);
    _pfRefreshAttachmentsUi();
  } catch (e) { showToast('❌ خطا: ' + e.message); }
  input.value = '';
}

async function pfDeleteAttachment(fileId) {
  if (!confirm('این پیوست حذف شود؟')) return;
  try {
    var r = await fetch('/api/proforma/files/' + fileId, { method: 'DELETE' });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    showToast('🗑️ پیوست حذف شد');
    await _pfLoadFiles(_pfEditId);
    _pfRefreshAttachmentsUi();
  } catch (e) { showToast('❌ ' + e.message); }
}

function pfIssueDispatch(pfId) {
  var pf = _pfList.find(function(p) { return p.id === pfId; });
  if (!pf) { showToast('پیشفاکتور یافت نشد'); return; }
  if (!['approved', 'invoiced'].includes(pf.status)) {
    showToast('فقط پیشفاکتور تأییدشده قابل صدور حواله است');
    return;
  }
  window.open('/wms?pf=' + encodeURIComponent(pfId) + '#exit', '_blank');
}
window.pfIssueDispatch = pfIssueDispatch;
window.pfShowDispatch = pfIssueDispatch;

// ── Vue bridge callbacks ──────────────────────────────────────────────────
// Called by ProformaPanel.vue — pf is the full object from Vue's API fetch.
// We merge it into _pfList so pfOpenEdit/pfAction can find it by ID.
function _vMerge(pf) {
  if (!pf || !pf.id) return;
  var idx = _pfList.findIndex(function(p) { return p.id === pf.id; });
  if (idx === -1) { _pfList.push(pf); } else { _pfList[idx] = pf; }
}
window._pfNew     = function()    { pfOpenNew(); };
window._pfView    = function(pf)  { _vMerge(pf); pfOpenEdit(pf.id); };
window._pfSend    = function(pf)  { _vMerge(pf); pfAction(pf.id, 'send'); };
window._pfApprove = function(pf)  { _vMerge(pf); pfAction(pf.id, 'approve'); };
window._pfReject  = function(pf)  { _vMerge(pf); pfReject(pf.id); };

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


// ── Product search dropdown (inline autocomplete) ────────────────────────
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
    var u = esc(r.unit || '\u0639\u062f\u062f');
    var pid = esc(r.id || '');
    var price = Number(r.salePrice || r.sale_price || 0);
    var cc = esc(r.catalog_code || r.catalogCode || '');
    return '<div onclick="pfSelectProduct(' + i + ', \'' + pid + '\', \'' + n + '\', \'' + u + '\', ' + price + ', \'' + cc + '\')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'"><div>' + n + ' <span style="color:#94a3b8;font-size:11px">(' + u + ')</span>' +
      (cc ? '<span style="color:#0284c7;font-size:10px;margin-right:6px">' + cc + '</span>' : '') + '</div>' +
      (price ? '<span style="color:#6366f1;font-size:11px">' + price.toLocaleString('fa-IR') + ' \u0631\u06cc\u0627\u0644</span>' : '') +
    '</div>';
  }).join('');
  
  var inp = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
  if (inp) {
    var rect = inp.getBoundingClientRect();
    drop.style.top = (rect.bottom) + 'px';
    drop.style.left = rect.left + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.position = 'fixed';
  }
  drop.style.display = 'block';
}

function pfSelectProduct(i, prodId, name, unit, price, catalogCode) {
  var drop = document.getElementById('pfProdDrop_' + i);
  if (drop) drop.style.display = 'none';
  var inp = document.querySelector('.pf-item-name[data-idx="' + i + '"]');
  if (inp) {
    inp.value = name;
    _pfItems[i].prodId      = prodId || '';
    _pfItems[i].name        = name;
    _pfItems[i].unit        = unit;
    _pfItems[i].unitPrice   = price || 0;
    _pfItems[i].catalogCode = catalogCode || '';
    _pfItems[i].category    = _pfItemCategory(_pfItems[i]);
    _pfItems[i].unitCost    = _pfResolveUnitCost(prodId);
    _pfItems[i].lineTotal   = _pfItemLineTotal(_pfItems[i]);
  }
  // Also update price cell
  var priceInp = document.querySelector('.pf-item-price[data-idx="' + i + '"]');
  if (priceInp && price) priceInp.value = price;
  var costDisplay = document.querySelector('.pf-item-cost-display[data-idx="' + i + '"]');
  var costHidden = document.querySelector('.pf-item-cost[data-idx="' + i + '"]');
  var cost = _pfResolveUnitCost(prodId);
  if (costDisplay) costDisplay.innerHTML = cost ? fmtNum(cost) : '<span style="color:#94a3b8">—</span>';
  if (costHidden) costHidden.value = cost || 0;
  // Show catalogCode as a small badge next to name input (read-only hint)
  var catDisplay = document.querySelector('.pf-item-cat-display[data-idx="' + i + '"]');
  if (catDisplay) catDisplay.textContent = catalogCode || '';
  _pfUpdateMarginCells();
  pfRecalc();
}

// ── Seller Info Editor (مشخصات فروشنده) ──────────────────────────────────
function pfOpenSellerEditor() {
  if (!_isManager()) { showToast('⚠ دسترسی فقط برای مدیر امکان‌پذیر است'); return; }
  var seller = (typeof DB !== 'undefined' && DB.settings && DB.settings.sellerInfo) || {
    name: 'آتنا زیست درمان', natId: '۱۰۱۰۴۲۳۴۵۶۷', regId: '۱۲۳۴۵۶', ecoCode: '۴۱۱۱۲۳۴۵۶۷۸۹',
    address: 'تهران، خیابان ولیعصر، نرسیده به پارک وی، کوچه ...', postal: '۱۹۶۶۶۴۵۳۲۱', phone: '۰۲۱-۸۸۸۸۸۸۸۸'
  };

  var html = 
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">نام شرکت (فروشنده)</label>' +
        '<input id="mSellerName" class="form-input" value="' + esc(seller.name) + '">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">شناسه ملی</label>' +
        '<input id="mSellerNatId" class="form-input" value="' + esc(seller.natId) + '">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">شماره ثبت</label>' +
        '<input id="mSellerRegId" class="form-input" value="' + esc(seller.regId) + '">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">کد اقتصادی</label>' +
        '<input id="mSellerEcoCode" class="form-input" value="' + esc(seller.ecoCode) + '">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">تلفن تماس</label>' +
        '<input id="mSellerPhone" class="form-input" value="' + esc(seller.phone) + '">' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">کد پستی</label>' +
        '<input id="mSellerPostal" class="form-input" value="' + esc(seller.postal) + '">' +
      '</div>' +
      '<div style="grid-column: 1 / -1"><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px">آدرس کامل</label>' +
        '<textarea id="mSellerAddress" class="form-input" style="height:60px;resize:vertical">' + esc(seller.address) + '</textarea>' +
      '</div>' +
    '</div>';

  openModal('pfSellerModal', '🏢 ویرایش مشخصات فروشنده', html,
    '<button onclick="closeModal(\'pfSellerModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:8px">انصراف</button>' +
    '<button onclick="pfSaveSellerInfo()" style="padding:8px 18px;background:var(--brand);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">💾 ذخیره مشخصات</button>',
    {lg:false}
  );

}

function pfSaveSellerInfo() {
  if (!DB.settings) DB.settings = {};
  DB.settings.sellerInfo = {
    name:    (document.getElementById('mSellerName')    || {}).value || '',
    natId:   (document.getElementById('mSellerNatId')   || {}).value || '',
    regId:   (document.getElementById('mSellerRegId')   || {}).value || '',
    ecoCode: (document.getElementById('mSellerEcoCode') || {}).value || '',
    phone:   (document.getElementById('mSellerPhone')   || {}).value || '',
    postal:  (document.getElementById('mSellerPostal')  || {}).value || '',
    address: (document.getElementById('mSellerAddress') || {}).value || ''
  };
  patchCrmSetting('sellerInfo', DB.settings.sellerInfo);
  if (typeof closeModal === 'function') closeModal('pfSellerModal');
  if (typeof showToast === 'function') showToast('✅ مشخصات فروشنده ذخیره شد');
}

function _pfHandleDeepLink() {
  var m = /[?&]pf=([^&]+)/.exec(window.location.search || '');
  if (!m) return;
  var pfId = decodeURIComponent(m[1]);
  var pf = _pfList.find(function(p) { return p.id === pfId; });
  if (!pf) return;
  setTimeout(function() { pfOpenEdit(pfId); }, 200);
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

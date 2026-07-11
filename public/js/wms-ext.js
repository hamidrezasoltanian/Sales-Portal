/* WMS extensions — fiscal year, server reports, recalls/audit/delivery persistence */
(function () {
  var _fiscalYears = [];

  function fmtJ(d) { return d || '—'; }

  async function wmsFetch(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var r = await fetch(url, opts);
    if (!r.ok) {
      var err = await r.json().catch(function () { return {}; });
      throw new Error(err.error || ('HTTP ' + r.status));
    }
    return r.json();
  }

  async function loadFiscalYears() {
    try {
      _fiscalYears = await wmsFetch('/api/wms/fiscal-years');
      window.WMS_FISCAL_YEARS = _fiscalYears;
    } catch (e) {
      console.warn('[wms-ext] fiscal years:', e.message);
      _fiscalYears = [];
    }
  }

  function activeFy() {
    return _fiscalYears.find(function (f) { return f.isActive; }) || _fiscalYears[0] || null;
  }

  function fyOptions(selId) {
    var fy = activeFy();
    return _fiscalYears.map(function (f) {
      return '<option value="' + f.id + '"' + (fy && fy.id === f.id ? ' selected' : '') + '>' +
        f.title + ' (' + f.startJalali + ' — ' + f.endJalali + ')' +
        (f.isClosed ? ' [بسته]' : '') + '</option>';
    }).join('');
  }

  // ── Patch loadS ─────────────────────────────────────────────────────────
  var _origLoadS = window.loadS;
  window.loadS = async function () {
    await _origLoadS();
    try {
      var recalls = await wmsFetch('/api/wms/recalls');
      S.recalls = recalls || [];
      var audit = await wmsFetch('/api/wms/audit-log?limit=500');
      if (audit && audit.length) S.auditLog = audit;
      await loadFiscalYears();
      var txnRes = await fetch('/api/wms/transactions?limit=5000&status=approved');
      if (txnRes.ok) {
        var txnData = await txnRes.json();
        if (Array.isArray(txnData) && txnData.length) S.transactions = txnData;
      }
      S.transactions.forEach(function (t) {
        if (t.deliveryStatus && !t.delivStatus) t.delivStatus = t.deliveryStatus;
        if (t.deliveryDate && !t.delivDate) t.delivDate = t.deliveryDate;
        if (t.deliveryPhone && !t.delivPhone) t.delivPhone = t.deliveryPhone;
        if (t.trackingNo && !t.trackingNo) t.trackingNo = t.trackingNo;
      });
    } catch (e) { console.warn('[wms-ext] loadS extras:', e.message); }
    updateBadges();
  };

  // ── Audit log → SQL ─────────────────────────────────────────────────────
  var _origLogAudit = window.logAudit;
  window.logAudit = function (action, entity, entityId, detail) {
    if (_origLogAudit) _origLogAudit(action, entity, entityId, detail);
    wmsFetch('/api/wms/audit-log', {
      method: 'POST',
      body: JSON.stringify({
        action: action, entity: entity, entityId: entityId || '', detail: detail || '',
        userName: (typeof usr === 'function' && currentUserId) ? usr(currentUserId).name : '',
      }),
    }).catch(function () {});
  };

  // ── Delivery persistence ──────────────────────────────────────────────────
  var _origSaveDelivery = window.saveDelivery;
  window.saveDelivery = async function () {
    var txnId = document.getElementById('mDelivTxnId').value;
    var t = S.transactions.find(function (x) { return x.id === txnId; });
    if (!t) return;
    t.courier = document.getElementById('mDelivCourier').value;
    t.trackingNo = document.getElementById('mDelivTracking').value.trim();
    t.delivDate = document.getElementById('mDelivDate').value;
    t.delivStatus = document.getElementById('mDelivStatus').value;
    t.delivPhone = document.getElementById('mDelivPhone').value.trim();
    t.deliveryStatus = t.delivStatus;
    t.deliveryDate = t.delivDate;
    t.deliveryPhone = t.delivPhone;
    t.smsStatus = 'sent';
    t.smsSentAt = new Date().toISOString();
    try {
      await wmsFetch('/api/wms/transactions/' + encodeURIComponent(txnId) + '/delivery', {
        method: 'PATCH',
        body: JSON.stringify({
          courier: t.courier, trackingNo: t.trackingNo, delivStatus: t.delivStatus,
          delivDate: t.delivDate, delivPhone: t.delivPhone, smsStatus: t.smsStatus, smsSentAt: t.smsSentAt,
        }),
      });
      logAudit('delivery_updated', 'transaction', txnId, 'ارسال ' + t.txnNo);
      closeModal('mDeliv');
      renderDelivery();
      toast('اطلاعات ارسال ذخیره شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── Recall persistence ────────────────────────────────────────────────────
  var _origSaveRecall = window.saveRecall;
  window.saveRecall = async function () {
    var pid = document.getElementById('mRecallProd').value;
    var reason = document.getElementById('mRecallReason').value.trim();
    var sev = document.getElementById('mRecallSev').value;
    var checkedLots = [].slice.call(document.querySelectorAll('#mRecallLots input:checked')).map(function (el) { return el.value; });
    if (!pid || !reason || !checkedLots.length) { toast('کالا، Lot ها و دلیل الزامی است', 'e'); return; }
    try {
      var r = await wmsFetch('/api/wms/recalls', {
        method: 'POST',
        body: JSON.stringify({
          productId: pid, affectedLots: checkedLots, reason: reason, severity: sev,
          issuedBy: currentUserId, status: 'active',
        }),
      });
      S.recalls = S.recalls || [];
      S.recalls.unshift(r);
      logAudit('recall_created', 'recall', r.id, 'Recall ' + r.recallNo);
      closeModal('mRecall');
      renderRecall();
      updateBadges();
      toast('Recall ' + r.recallNo + ' ثبت شد', 'w');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.resolveRecall = async function (id) {
    if (!confirm('آیا این Recall بسته شود؟')) return;
    try {
      await wmsFetch('/api/wms/recalls/' + encodeURIComponent(id) + '/resolve', { method: 'PUT', body: '{}' });
      var r = S.recalls.find(function (x) { return x.id === id; });
      if (r) r.status = 'resolved';
      renderRecall();
      updateBadges();
      toast('Recall بسته شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── Fiscal year page ────────────────────────────────────────────────────
  window.renderFiscalYear = function () {
    var con = document.getElementById('fiscalYearContent');
    if (!con) return;
    var fy = activeFy();
    con.innerHTML = '<div class="kpi-row" style="margin-bottom:16px">' +
      '<div class="stat blue"><div class="stat-ic">📅</div><div class="stat-v">' + (_fiscalYears.length) + '</div><div class="stat-l">سال مالی تعریف‌شده</div></div>' +
      '<div class="stat green"><div class="stat-ic">✅</div><div class="stat-v">' + (fy ? fy.title : '—') + '</div><div class="stat-l">سال فعال</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>📅 سال‌های مالی</span>' +
      '<button class="btn btn-primary btn-sm" onclick="openNewFyModal()">+ سال جدید</button></div>' +
      '<div class="tw"><table><thead><tr><th>عنوان</th><th>شروع</th><th>پایان</th><th>فعال</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' +
      _fiscalYears.map(function (f) {
        return '<tr><td><strong>' + f.title + '</strong></td><td>' + f.startJalali + '</td><td>' + f.endJalali + '</td>' +
          '<td>' + (f.isActive ? '<span class="badge bg">فعال</span>' : '<button class="btn btn-ghost btn-xs" onclick="activateFy(' + f.id + ')">فعال‌سازی</button>') + '</td>' +
          '<td>' + (f.isClosed ? '<span class="badge bgr">بسته</span>' : '<span class="badge bb">باز</span>') + '</td>' +
          '<td>' + (!f.isClosed ? '<button class="btn btn-ghost btn-xs" onclick="closeFy(' + f.id + ')">🔒 بستن سال</button>' : '—') + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  };

  window.activateFy = async function (id) {
    try {
      await wmsFetch('/api/wms/fiscal-years/' + id + '/activate', { method: 'PUT', body: '{}' });
      await loadFiscalYears();
      renderFiscalYear();
      toast('سال مالی فعال شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.closeFy = async function (id) {
    if (!confirm('بستن سال مالی؟ موجودی ابتدای سال بعد snapshot می‌شود.')) return;
    try {
      await wmsFetch('/api/wms/fiscal-years/' + id + '/close', { method: 'POST', body: '{}' });
      await loadFiscalYears();
      renderFiscalYear();
      toast('سال مالی بسته شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.openNewFyModal = function () {
    var jy = prompt('سال شمسی (مثلاً 1405):', String((activeFy() && activeFy().jalaliYear + 1) || 1405));
    if (!jy) return;
    wmsFetch('/api/wms/fiscal-years', {
      method: 'POST',
      body: JSON.stringify({ jalaliYear: parseInt(jy, 10), isActive: false }),
    }).then(function () { return loadFiscalYears(); })
      .then(function () { renderFiscalYear(); toast('سال مالی ایجاد شد'); })
      .catch(function (e) { toast('خطا: ' + e.message, 'e'); });
  };

  // ── Report tabs: daily + ledger ─────────────────────────────────────────
  var _origSwitchRptTab = window.switchRptTab;
  window.switchRptTab = function (tab, el) {
    if (tab === 'daily' || tab === 'ledger' || tab === 'fy') {
      window.rptTab = tab;
      document.querySelectorAll('#rptTabs .tab').forEach(function (t) { t.classList.remove('act'); });
      if (el) el.classList.add('act');
      renderRptFiltersExt();
      renderRptExt();
      return;
    }
    return _origSwitchRptTab(tab, el);
  };

  window.renderRptFiltersExt = function () {
    if (window.rptTab !== 'daily' && window.rptTab !== 'ledger') return;
    var el = document.getElementById('rptFilters');
    if (!el) return;
    var wOpts = S.warehouses.map(function (w) { return '<option value="' + w.id + '">' + w.name + '</option>'; }).join('');
    var pOpts = S.products.map(function (p) { return '<option value="' + p.id + '">' + (p.fullName || p.name) + '</option>'; }).join('');
    var fyOpts = fyOptions();
    el.innerHTML = '<div class="card" style="padding:12px"><div class="form-grid">' +
      '<div class="fg"><label class="fl">سال مالی</label><select class="fs" id="rfFy" onchange="renderRptExt()">' + fyOpts + '</select></div>' +
      '<div class="fg"><label class="fl">انبار</label><select class="fs" id="rfWh2" onchange="renderRptExt()"><option value="">همه</option>' + wOpts + '</select></div>' +
      '<div class="fg"><label class="fl">کالا</label><select class="fs" id="rfProd2" onchange="renderRptExt()"><option value="">همه</option>' + pOpts + '</select></div>' +
      (window.rptTab === 'ledger' ? '' : '') +
      '<div class="fg"><label class="fl">&nbsp;</label><button class="btn btn-primary btn-sm" onclick="renderRptExt()">🔄 بارگذاری</button>' +
      '<button class="btn btn-success btn-sm" onclick="exportDailyRpt()" style="margin-right:6px">📊 Excel</button></div>' +
      '</div></div>';
  };

  window.renderRptExt = async function () {
    var con = document.getElementById('rptContent');
    if (!con) return;
    var fyId = (document.getElementById('rfFy') || {}).value;
    var wh = (document.getElementById('rfWh2') || {}).value || '';
    var prod = (document.getElementById('rfProd2') || {}).value || '';
    con.innerHTML = '<div class="card"><div style="padding:24px;text-align:center;color:var(--text3)">⏳ در حال بارگذاری گزارش...</div></div>';
    try {
      if (window.rptTab === 'daily') {
        var q = '?fiscal_year_id=' + encodeURIComponent(fyId);
        if (wh) q += '&warehouse_id=' + encodeURIComponent(wh);
        if (prod) q += '&product_id=' + encodeURIComponent(prod);
        var data = await wmsFetch('/api/wms/reports/daily-movement' + q);
        var rep = data.report;
        window._lastDailyReport = rep;
        var rows = rep.rows.map(function (row) {
          return '<tr><td>' + row.dateJalali + '</td><td style="font-size:11px;color:var(--text3)">' + row.date + '</td>' +
            '<td style="text-align:center;color:var(--success);font-weight:700">' + (row.qtyIn || '—') + '</td>' +
            '<td style="text-align:center;color:var(--danger);font-weight:700">' + (row.qtyOut || '—') + '</td>' +
            '<td style="text-align:center">' + row.qtyNet + '</td>' +
            '<td style="text-align:center;font-weight:700">' + row.closingBalance + '</td>' +
            '<td style="text-align:center;font-size:11px">' + row.txnCount + '</td></tr>';
        }).join('');
        con.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
          '<span class="badge bg">مانده ابتدا: ' + rep.openingQty + '</span>' +
          '<span class="badge bb">مانده پایان: ' + rep.closingQty + '</span>' +
          '<span class="badge bt">' + rep.days + ' روز</span></div>' +
          '<div class="card"><div class="card-title">📅 گزارش ورود/خروج روزانه — ' + rep.from + ' تا ' + rep.to + '</div>' +
          '<div class="tw"><table><thead><tr><th>تاریخ شمسی</th><th>میلادی</th><th>ورود</th><th>خروج</th><th>خالص</th><th>مانده</th><th>تراکنش</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>';
      } else if (window.rptTab === 'ledger') {
        var q2 = '?fiscal_year_id=' + encodeURIComponent(fyId);
        if (wh) q2 += '&warehouse_id=' + encodeURIComponent(wh);
        if (prod) q2 += '&product_id=' + encodeURIComponent(prod);
        var data2 = await wmsFetch('/api/wms/reports/ledger' + q2 + '&limit=2000');
        var rep2 = data2.report;
        window._lastLedgerReport = rep2;
        var rows2 = rep2.entries.map(function (e) {
          return '<tr><td>' + e.dateJalali + '</td><td><code>' + e.txnNo + '</code></td>' +
            '<td>' + (e.type === 'entry' ? '<span class="badge bg">ورود</span>' : '<span class="badge br">خروج</span>') + '</td>' +
            '<td style="font-size:12px">' + (e.productName || '') + '</td><td><code style="font-size:10px">' + (e.lotNo || '') + '</code></td>' +
            '<td style="font-size:12px">' + (e.warehouseName || '') + '</td>' +
            '<td style="text-align:center;color:var(--success)">' + (e.qtyIn || '') + '</td>' +
            '<td style="text-align:center;color:var(--danger)">' + (e.qtyOut || '') + '</td>' +
            '<td style="text-align:center;font-weight:800">' + e.closingBalance + '</td></tr>';
        }).join('');
        con.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:12px">' +
          '<span class="badge bg">مانده ابتدا: ' + rep2.openingQty + '</span>' +
          '<span class="badge bb">مانده پایان: ' + rep2.closingQty + '</span></div>' +
          '<div class="card"><div class="card-title">📒 کاردکس / دفتر گردش</div>' +
          '<div class="tw"><table><thead><tr><th>تاریخ</th><th>سند</th><th>نوع</th><th>کالا</th><th>Lot</th><th>انبار</th><th>ورود</th><th>خروج</th><th>مانده</th></tr></thead>' +
          '<tbody>' + rows2 + '</tbody></table></div></div>';
      }
    } catch (e) {
      con.innerHTML = '<div class="card"><div class="empty"><p>خطا: ' + e.message + '</p></div></div>';
    }
  };

  window.exportDailyRpt = function () {
    var rep = window._lastDailyReport || window._lastLedgerReport;
    if (!rep) { toast('ابتدا گزارش را بارگذاری کنید', 'e'); return; }
    if (rep.rows) {
      var rows = [['تاریخ شمسی', 'میلادی', 'ورود', 'خروج', 'خالص', 'مانده', 'تراکنش']];
      rep.rows.forEach(function (r) { rows.push([r.dateJalali, r.date, r.qtyIn, r.qtyOut, r.qtyNet, r.closingBalance, r.txnCount]); });
      exportCSV(rows, 'daily_movement.csv');
    } else if (rep.entries) {
      var rows2 = [['تاریخ', 'سند', 'نوع', 'کالا', 'Lot', 'انبار', 'ورود', 'خروج', 'مانده']];
      rep.entries.forEach(function (e) {
        rows2.push([e.dateJalali, e.txnNo, e.type, e.productName, e.lotNo, e.warehouseName, e.qtyIn, e.qtyOut, e.closingBalance]);
      });
      exportCSV(rows2, 'ledger.csv');
    }
  };

  // ── Atomic warehouse transfer ─────────────────────────────────────────────
  window.openTransferModal = function (prefill) {
    prefill = prefill || {};
    var wOpts = S.warehouses.map(function (w) {
      return '<option value="' + w.id + '"' + (prefill.fromWarehouseId === w.id ? ' selected' : '') + '>' + w.name + '</option>';
    }).join('');
    var lots = S.lots.filter(function (l) { return l.qty > 0; });
    if (prefill.fromWarehouseId) lots = lots.filter(function (l) { return l.warehouseId === prefill.fromWarehouseId; });
    if (prefill.lotId) lots = lots.filter(function (l) { return l.id === prefill.lotId; });
    var lOpts = lots.map(function (l) {
      var p = S.products.find(function (x) { return x.id === l.productId; });
      return '<option value="' + l.id + '" data-pid="' + l.productId + '" data-wh="' + l.warehouseId + '" data-qty="' + l.qty + '"' +
        (prefill.lotId === l.id ? ' selected' : '') + '>' +
        (p ? (p.fullName || p.name) : l.productId) + ' — Lot ' + l.lotNo + ' (' + l.qty + ')</option>';
    }).join('');
    var body = '<div class="form-grid">' +
      '<div class="fg"><label class="fl">Lot *</label><select class="fs" id="trfLot" onchange="onTrfLotChange()">' + lOpts + '</select></div>' +
      '<div class="fg"><label class="fl">انبار مبدأ</label><select class="fs" id="trfFrom" disabled>' + wOpts + '</select></div>' +
      '<div class="fg"><label class="fl">انبار مقصد *</label><select class="fs" id="trfTo">' + wOpts + '</select></div>' +
      '<div class="fg"><label class="fl">تعداد *</label><input class="fi" type="number" id="trfQty" min="1" value="' + (prefill.qty || 1) + '"/></div>' +
      '<div class="fg full"><label class="fl">یادداشت</label><input class="fi" id="trfNote" placeholder="اختیاری"/></div></div>';
    openModal('mTransfer', '🔁 انتقال بین انبار', body,
      '<button class="btn btn-ghost" onclick="closeModal(\'mTransfer\')">انصراف</button>' +
      '<button class="btn btn-primary" onclick="saveTransfer()">ثبت انتقال</button>');
    onTrfLotChange();
  };

  window.onTrfLotChange = function () {
    var sel = document.getElementById('trfLot');
    if (!sel || !sel.selectedOptions.length) return;
    var opt = sel.selectedOptions[0];
    var from = document.getElementById('trfFrom');
    if (from) from.value = opt.getAttribute('data-wh') || '';
    var qty = document.getElementById('trfQty');
    if (qty && !qty.value) qty.value = opt.getAttribute('data-qty') || '1';
  };

  window.saveTransfer = async function () {
    var sel = document.getElementById('trfLot');
    if (!sel || !sel.selectedOptions.length) { toast('Lot را انتخاب کنید', 'e'); return; }
    var opt = sel.selectedOptions[0];
    var productId = opt.getAttribute('data-pid');
    var lotId = sel.value;
    var fromWarehouseId = opt.getAttribute('data-wh');
    var toWarehouseId = document.getElementById('trfTo').value;
    var qty = parseInt(document.getElementById('trfQty').value, 10);
    var note = (document.getElementById('trfNote').value || '').trim();
    if (!toWarehouseId) { toast('انبار مقصد را انتخاب کنید', 'e'); return; }
    if (fromWarehouseId === toWarehouseId) { toast('مبدأ و مقصد نمی‌توانند یکسان باشند', 'e'); return; }
    if (!qty || qty <= 0) { toast('تعداد نامعتبر', 'e'); return; }
    try {
      var res = await wmsFetch('/api/wms/transfers', {
        method: 'POST',
        body: JSON.stringify({ productId: productId, lotId: lotId, fromWarehouseId: fromWarehouseId, toWarehouseId: toWarehouseId, qty: qty, note: note }),
      });
      logAudit('transfer', 'transaction', res.transferPairId, res.exitNo + ' → ' + res.entryNo);
      closeModal('mTransfer');
      await loadS();
      renderInv();
      toast('انتقال ثبت شد: ' + res.exitNo + ' / ' + res.entryNo, 's');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  var _origRenderInv = window.renderInv;
  window.renderInv = function () {
    _origRenderInv();
    var pa = document.querySelector('#p-inv .pa');
    if (pa && !document.getElementById('btnWmsTransfer')) {
      var btn = document.createElement('button');
      btn.id = 'btnWmsTransfer';
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = '🔁 انتقال بین انبار';
      btn.onclick = function () { openTransferModal({}); };
      pa.insertBefore(btn, pa.firstChild);
    }
  };

  // ── IMED persistence ──────────────────────────────────────────────────────
  async function patchTxnImed(txnId, imedRefNo) {
    await wmsFetch('/api/wms/transactions/' + encodeURIComponent(txnId) + '/imed', {
      method: 'PATCH',
      body: JSON.stringify({ imedStatus: 'registered', imedRefNo: imedRefNo || '', imedDate: new Date().toISOString() }),
    });
    var t = S.transactions.find(function (x) { return x.id === txnId; });
    if (t) { t.imedStatus = 'registered'; t.imedRefNo = imedRefNo || ''; t.imedDate = new Date().toISOString(); }
  }

  async function bulkImed(opts) {
    var res = await wmsFetch('/api/wms/transactions/bulk-imed', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    (res.ids || []).forEach(function (id) {
      var t = S.transactions.find(function (x) { return x.id === id; });
      if (t) { t.imedStatus = 'registered'; t.imedRefNo = opts.imedRefNo || ''; t.imedDate = new Date().toISOString(); }
    });
    return res;
  }

  window.markImed = async function (txnId) {
    var ref = window.prompt('شماره ثبت IMED (اختیاری):');
    if (ref === null) return;
    try {
      await patchTxnImed(txnId, ref);
      logAudit('imed_registered', 'transaction', txnId, ref || '—');
      if (typeof renderCurrentRptTab === 'function') renderCurrentRptTab();
      updateBadges();
      toast('در IMED ثبت شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.markInvImed = async function (refNo) {
    var ref = window.prompt('شماره ثبت IMED (برای کل فاکتور):');
    if (ref === null) return;
    try {
      await bulkImed({ refNo: refNo, imedRefNo: ref || refNo });
      logAudit('imed_registered', 'invoice', refNo, ref || refNo);
      if (typeof renderCurrentRptTab === 'function') renderCurrentRptTab();
      updateBadges();
      toast('فاکتور در IMED ثبت شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.markAllImed = async function () {
    if (!window.confirm('همه تراکنش‌های تأیید‌شده را در IMED ثبت‌شده علامت بزنیم؟')) return;
    var ref = window.prompt('شماره ثبت دسته‌ای (اختیاری):') || ('BATCH-' + new Date().toISOString().split('T')[0]);
    try {
      var res = await bulkImed({ allApproved: true, imedRefNo: ref });
      logAudit('imed_bulk', 'transaction', 'batch', ref + ' (' + res.count + ' ردیف)');
      if (typeof renderCurrentRptTab === 'function') renderCurrentRptTab();
      if (typeof renderIMEDPage === 'function') renderIMEDPage();
      updateBadges();
      toast(res.count + ' تراکنش ثبت IMED شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.markImedDirect = async function (txnId) {
    var t = S.transactions.find(function (x) { return x.id === txnId; });
    if (!t) return;
    var msg = 'شماره ثبت IMED را وارد کنید:';
    if (t.refNo) {
      var siblings = S.transactions.filter(function (x) { return x.refNo === t.refNo && x.imedStatus !== 'registered'; });
      if (siblings.length > 1) msg = 'این فاکتور ' + siblings.length + ' ردیف ثبت‌نشده دارد. شماره ثبت IMED (برای همه):';
    }
    var ref = window.prompt(msg);
    if (ref === null) return;
    try {
      if (t.refNo) {
        await bulkImed({ refNo: t.refNo, imedRefNo: ref || '' });
      } else {
        await patchTxnImed(txnId, ref);
      }
      logAudit('imed_registered', 'transaction', txnId, ref || '—');
      if (typeof renderIMEDPage === 'function') renderIMEDPage();
      updateBadges();
      toast('ثبت IMED انجام شد' + (t.refNo ? ' (کل فاکتور)' : ''));
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── TTAC + purchase price → SQL lots ──────────────────────────────────────
  window.saveTTAC = async function (lotId, ttacNo) {
    if (!ttacNo || !ttacNo.trim()) return;
    try {
      await wmsFetch('/api/wms/lots/' + encodeURIComponent(lotId), {
        method: 'PUT',
        body: JSON.stringify({ ttacNo: ttacNo.trim() }),
      });
      var l = S.lots.find(function (x) { return x.id === lotId; });
      if (l) l.ttacNo = ttacNo.trim();
      renderTTAC();
      toast('TTAC ذخیره شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  window.applyPurchasePrice = async function () {
    var pid = document.getElementById('ppProd').value;
    var method = document.getElementById('ppMethod').value;
    var lotNo = document.getElementById('ppLot').value.trim();
    var price = 0;
    if (method === 'rial') price = parseInt(document.getElementById('ppPrice').value, 10) || 0;
    else {
      var u = parseFloat(document.getElementById('ppUsd').value) || 0;
      var r = parseFloat(document.getElementById('ppRate').value) || 0;
      price = Math.round(u * r);
    }
    if (!price) { toast('قیمت را وارد کنید', 'e'); return; }
    var targets = S.lots.filter(function (l) {
      return (pid === 'all' || l.productId === pid) && (!lotNo || l.lotNo === lotNo);
    });
    if (!targets.length) { toast('Lot یافت نشد', 'e'); return; }
    try {
      for (var i = 0; i < targets.length; i++) {
        var lot = targets[i];
        await wmsFetch('/api/wms/lots/' + encodeURIComponent(lot.id), {
          method: 'PUT',
          body: JSON.stringify({ purchasePrice: price }),
        });
        lot.purchasePrice = price;
        S.priceHistory.push({
          product: lot.productId, lot: lot.lotNo, price: price, qty: lot.qty,
          date: new Date().toISOString(), method: method === 'usd' ? 'دلاری' : 'ریالی',
        });
      }
      await saveS();
      renderPrPurchase();
      toast('قیمت خرید ' + targets.length + ' Lot بروز شد');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── Stock count → SQL lots + adjustment txn ───────────────────────────────
  window.submitCount = async function (scId) {
    var sc = S.stockCounts.find(function (x) { return x.id === scId; });
    if (!sc) return;
    if (!window.confirm('ثبت نهایی انبارگردانی؟ مغایرت‌ها به صورت سند تعدیل ثبت می‌شوند.')) return;
    try {
      var res = await wmsFetch('/api/wms/stock-counts/complete', {
        method: 'POST',
        body: JSON.stringify({
          items: sc.items.map(function (item) {
            return { lotId: item.lotId, countedQty: item.countedQty, systemQty: item.systemQty, note: item.note || '' };
          }),
          note: 'انبارگردانی SC-' + sc.id,
        }),
      });
      sc.items.forEach(function (item) {
        var l = S.lots.find(function (x) { return x.id === item.lotId; });
        if (l) l.qty = item.countedQty;
      });
      sc.status = 'completed';
      sc.adjustments = res.adjustments || [];
      await saveS();
      var lotRes = await fetch('/api/wms/lots');
      if (lotRes.ok) S.lots = await lotRes.json();
      logAudit('stock_count', 'warehouse', sc.warehouseId, 'SC-' + sc.id + ' — ' + (res.adjustments || []).length + ' تعدیل');
      closeModal('mCount');
      renderCount();
      updateBadges();
      toast('انبارگردانی ثبت شد' + ((res.adjustments || []).length ? ' (' + res.adjustments.length + ' تعدیل)' : ''));
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── markDelivered → SQL ───────────────────────────────────────────────────
  window.markDelivered = async function (txnId) {
    var t = S.transactions.find(function (x) { return x.id === txnId; });
    if (!t) return;
    try {
      await wmsFetch('/api/wms/transactions/' + encodeURIComponent(txnId) + '/delivery', {
        method: 'PATCH',
        body: JSON.stringify({ delivStatus: 'delivered', deliveryStatus: 'delivered' }),
      });
      t.delivStatus = 'delivered';
      t.deliveryStatus = 'delivered';
      logAudit('delivery_delivered', 'transaction', txnId, t.txnNo);
      renderDelivery();
      toast('تحویل تأیید شد ✓');
    } catch (e) { toast('خطا: ' + e.message, 'e'); }
  };

  // ── Reconcile + Faradis prefill ───────────────────────────────────────────
  window._reconcileData = null;

  window.loadReconcileData = async function (whId) {
    whId = whId || 'all';
    try {
      window._reconcileData = await wmsFetch('/api/wms/reconcile/data?warehouse_id=' + encodeURIComponent(whId));
      return window._reconcileData;
    } catch (e) {
      console.warn('[wms-ext] reconcile:', e.message);
      window._reconcileData = null;
      return null;
    }
  };

  var _origRenderReconcilePage = window.renderReconcilePage;
  window.renderReconcilePage = async function () {
    var data = await loadReconcileData('all');
    var con = document.getElementById('reconcileContent');
    if (!con) return;
    var recs = S.reconciliations || [];
    var physTotal = data ? data.wmsTotal : S.lots.reduce(function (s, l) { return s + l.qty; }, 0);
    var faradisLbl = data && data.faradisAvailable ? fmt(data.faradisTotal) : '—';
    var imedLbl = data ? fmt(data.imedPendingTotal) + ' معوق' : '—';
    var syncNote = data && data.faradisSyncedAt
      ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">آخرین sync فرادیس: ' + fmtDate(data.faradisSyncedAt) + '</div>' : '';
    con.innerHTML =
      '<div class="kpi-row" style="margin-bottom:16px">' +
      '<div class="stat blue"><div class="stat-ic">📦</div><div class="stat-v">' + fmt(physTotal) + '</div><div class="stat-l">موجودی WMS</div></div>' +
      '<div class="stat orange"><div class="stat-ic">💻</div><div class="stat-v">' + faradisLbl + '</div><div class="stat-l">فرادیس (cache)' + syncNote + '</div></div>' +
      '<div class="stat green"><div class="stat-ic">🏛️</div><div class="stat-v">' + imedLbl + '</div><div class="stat-l">IMED ثبت‌نشده</div></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:16px;padding:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn btn-primary btn-sm" onclick="startReconcile()">➕ تطبیق جدید</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="renderReconcilePage()">🔄 بروزرسانی فرادیس</button>' +
      '</div>' +
      '<div class="card"><div class="card-title">📋 سابقه تطبیق‌ها</div>' +
      (recs.length ? '<div class="tw"><table><thead><tr><th>تاریخ</th><th>انبار</th><th>توسط</th><th>مغایرت فرادیس</th><th>مغایرت IMED</th><th>وضعیت</th></tr></thead><tbody>' +
        recs.map(function (r) {
          return '<tr><td>' + fmtDate(r.date) + '</td><td>' + wh(r.warehouseId || 'all').name + '</td><td>' + usr(r.conductedBy).name + '</td>' +
            '<td>' + (r.faradisDiff !== undefined ? '<span class="' + (r.faradisDiff === 0 ? 'badge bg' : 'badge br') + '">' + (r.faradisDiff === 0 ? 'تطابق' : r.faradisDiff) + '</span>' : '—') + '</td>' +
            '<td>' + (r.imedDiff !== undefined ? '<span class="' + (r.imedDiff === 0 ? 'badge bg' : 'badge br') + '">' + (r.imedDiff === 0 ? 'تطابق' : r.imedDiff) + '</span>' : '—') + '</td>' +
            '<td>' + sbadge(r.status) + '</td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty" style="padding:24px"><p>تطبیقی ثبت نشده</p></div>') +
      '</div>';
  };

  window.startReconcile = async function () {
    var whs = S.warehouses.filter(function (w) { return w.active; });
    var data = await loadReconcileData('all');
    var faradisByProduct = {};
    if (data && data.products) {
      data.products.forEach(function (p) { faradisByProduct[p.productId] = p; });
    }
    var rows = S.products.filter(function (p) { return p.active; }).map(function (p) {
      var rd = faradisByProduct[p.id];
      var sysQty = rd ? rd.wmsQty : S.lots.filter(function (l) { return l.productId === p.id; }).reduce(function (s, l) { return s + l.qty; }, 0);
      var fDefault = rd && rd.faradisQty != null ? rd.faradisQty : sysQty;
      var iDefault = rd ? rd.imedRegisteredQty : sysQty;
      return '<tr>' +
        '<td><strong>' + (p.fullName || p.name) + '</strong><br><code style="font-size:10px">' + (p.catalogCode || '') + '</code></td>' +
        '<td style="text-align:center;font-weight:700">' + fmt(sysQty) + '</td>' +
        '<td><input class="fi" type="number" id="rec_f_' + p.id + '" value="' + fDefault + '" placeholder="' + sysQty + '" style="text-align:center"/></td>' +
        '<td><input class="fi" type="number" id="rec_i_' + p.id + '" value="' + iDefault + '" placeholder="' + sysQty + '" style="text-align:center"/></td>' +
        '<td id="rec_diff_' + p.id + '" style="font-size:12px;color:var(--text3)">' +
        (rd && rd.faradisMatched ? (rd.faradisDiff === 0 ? '✓ فرادیس' : 'Δ ' + rd.faradisDiff) : '—') + '</td></tr>';
    }).join('');
    document.getElementById('mReconcileBody').innerHTML =
      '<div class="form-grid" style="margin-bottom:14px">' +
      '<div class="fg"><label class="fl">انبار</label><select class="fs" id="recWh" onchange="onRecWhChange()"><option value="all">همه انبارها</option>' +
      whs.map(function (w) { return '<option value="' + w.id + '">' + w.name + '</option>'; }).join('') + '</select></div>' +
      (data && data.faradisAvailable ? '<div class="fg"><label class="fl">&nbsp;</label><span class="badge bb">فرادیس از cache بارگذاری شد</span></div>' : '') +
      '</div><div class="tw"><table><thead><tr><th>کالا</th><th style="text-align:center">WMS</th><th style="text-align:center">فرادیس</th><th style="text-align:center">IMED</th><th>وضعیت</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('mReconcileFoot').innerHTML =
      '<button class="btn btn-primary" onclick="saveReconcile()">✅ ثبت تطبیق</button>' +
      '<button class="btn btn-ghost" onclick="closeModal(\'mReconcile\')">انصراف</button>';
    openModal('mReconcile');
  };

  window.onRecWhChange = async function () {
    var whId = document.getElementById('recWh').value;
    var data = await loadReconcileData(whId);
    if (!data) return;
    var map = {};
    data.products.forEach(function (p) { map[p.productId] = p; });
    S.products.filter(function (p) { return p.active; }).forEach(function (p) {
      var rd = map[p.id];
      var sysQty = rd ? rd.wmsQty : 0;
      var fEl = document.getElementById('rec_f_' + p.id);
      var iEl = document.getElementById('rec_i_' + p.id);
      if (fEl) fEl.value = rd && rd.faradisQty != null ? rd.faradisQty : sysQty;
      if (iEl) iEl.value = rd ? rd.imedRegisteredQty : sysQty;
    });
  };

  console.log('[wms-ext] fiscal year + reports + transfers + persistence loaded');
})();

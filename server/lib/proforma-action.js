'use strict';

const { query } = require('../db');
const { createDispatchFromProforma } = require('./wms-dispatch');
const { appendProformaEvent, appendAuditLog, computeExpiryDate } = require('./proforma-helpers');
const {
  loadDiscountCaps, exceedsDiscountCap, canApproveDiscount, maxDiscountPct, getDiscountCap,
} = require('./pf-discount');
const { isManagerRole } = require('./roles');

const TRANSITIONS = {
  draft:             ['send', 'cancel'],
  pending_disc:      ['approve_disc', 'reject_disc', 'cancel'],
  awaiting_customer: ['customer_confirm', 'customer_revise', 'customer_reject', 'cancel', 'expire'],
  sent:              ['negotiate', 'approve', 'reject', 'cancel', 'expire'],
  negotiating:       ['approve', 'reject', 'cancel', 'expire'],
  approved:          ['cancel', 'reject'],
  rejected:          ['reopen'],
  cancelled:         ['reopen'],
  expired:           ['reopen'],
  invoiced:          [],
};

/** همه وضعیت‌های ورک‌فلو — سوپر ادمین می‌تواند به هر کدام (غیر از وضعیت فعلی) برود */
const ALL_STATUSES = [
  'draft', 'pending_disc', 'awaiting_customer', 'sent', 'negotiating',
  'approved', 'invoiced', 'rejected', 'cancelled', 'expired',
];

/** ترتیب مسیر اصلی برای نمایش (هم‌تراز نوار ۵ مرحله‌ای UI) */
const FLOW_ORDER = [
  'draft', 'awaiting_customer', 'sent', 'approved', 'invoiced',
];

const SIDE_STATUSES = ['pending_disc', 'negotiating', 'rejected', 'cancelled', 'expired'];

/** @deprecated kept for callers — همه وضعیت‌ها به‌جز فعلی مجازند */
const ROLLBACK_TARGETS = ALL_STATUSES.reduce(function (acc, from) {
  acc[from] = ALL_STATUSES.filter(function (s) { return s !== from; });
  return acc;
}, {});

const STATUS_LABELS = {
  draft: 'پیش‌نویس',
  pending_disc: 'انتظار تأیید تخفیف',
  awaiting_customer: 'در انتظار تایید مشتری',
  sent: 'انتظار تأیید مدیر',
  negotiating: 'در مذاکره',
  approved: 'تأیید شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
  expired: 'منقضی شده',
  invoiced: 'فاکتور شده',
};

const LOSS_REASON_LABELS = {
  price_high: 'قیمت بالا', competitor: 'رقیب', need_change: 'تغییر نیاز مشتری',
  no_response: 'عدم پاسخ مشتری', other: 'سایر',
};

/** Surface a final customer loss in the linked center profile and its audit trail. */
async function mirrorFinalLossToCenter(pf, user, lossReason, note) {
  if (!pf.center_key) return;
  const label = LOSS_REASON_LABELS[lossReason] || lossReason;
  const detail = { proformaId: pf.id, proformaNo: pf.no, reason: lossReason, note: note || '', at: new Date().toISOString() };
  await query(
    `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (center_key) DO UPDATE
       SET data = center_edits.data || EXCLUDED.data, updated_at = NOW(), updated_by = $3`,
    [pf.center_key, JSON.stringify({ status: 'غیرفعال', lostReason: label, proformaOutcome: detail, _ts: Date.now() }), user.username]
  );
  await query(
    `INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, 'proformaLoss', $3)`,
    [user.username, pf.center_key, JSON.stringify(detail)]
  ).catch(function () {});
}

function isSuperAdminRole(role) {
  return role === 'سوپر ادمین';
}

function rowToObj(r) {
  return {
    id: r.id,
    no: r.no,
    jalaliDate: r.jalali_date,
    validDays: r.valid_days,
    centerKey: r.center_key,
    centerName: r.center_name,
    items: r.items,
    subtotal: Number(r.subtotal),
    discountPct: Number(r.discount_pct),
    discAmt: Number(r.disc_amt),
    taxPct: Number(r.tax_pct),
    taxAmt: Number(r.tax_amt),
    total: Number(r.total),
    note: r.note,
    status: r.status,
    createdBy: r.created_by,
    managerNote: r.manager_note,
    wmsWarehouseId: r.wms_warehouse_id || '',
    expiryDate: r.expiry_date || computeExpiryDate(r.jalali_date, r.valid_days) || '',
  };
}

function canViewProforma(user, row) {
  if (isManagerRole(user.role)) return true;
  return row.created_by === user.username;
}

async function pushProformaTelegram(action, updated, user, note) {
  try {
    const settingsRow = await query("SELECT value FROM app_settings WHERE key = 'telegramNotify'");
    const notifyEnabled = !settingsRow.rows.length || settingsRow.rows[0].value !== false;
    if (!notifyEnabled) return;
    const bot = require('../bot/telegram');
    if (action === 'send' && updated.status === 'awaiting_customer') {
      const msg = '📄 پیشفاکتور ' + updated.no + ' ارسال شد — در انتظار تایید مشتری\n💰 مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼\n👤 مشتری: ' + (updated.centerName || '—');
      bot.notifyAll(msg).catch(function () {});
    } else if (action === 'customer_confirm' && updated.status === 'sent') {
      const msg = '📄 پیشفاکتور ' + updated.no + ' توسط مشتری تأیید شد — در انتظار تأیید مدیر برای حواله/فاکتور\n💰 مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼\n👤 ' + user.username;
      bot.notifyManagers(msg).catch(function () {});
    } else if (action === 'send' && updated.status === 'pending_disc') {
      const msg = '⚠️ پیشفاکتور ' + updated.no + ' — تخفیف ' + maxDiscountPct(updated) + '٪ نیاز به تأیید مدیر/مالی دارد\n👤 ' + user.username;
      bot.notifyManagers(msg).catch(function () {});
      if (bot.notifyFinance) bot.notifyFinance(msg).catch(function () {});
    } else if (action === 'approve' || action === 'reject') {
      const label = action === 'approve' ? '✅ تأیید شد' : '❌ رد شد';
      const msg = '📄 پیشفاکتور ' + updated.no + ' ' + label + ' توسط ' + user.username + (note ? '\n📝 ' + note : '');
      bot.notifyAll(msg).catch(function () {});
    }
  } catch (e) { /* optional */ }
}

/**
 * @param {string} pfId
 * @param {string} action
 * @param {{ username: string, role: string }} user
 * @param {{ note?: string, lossReason?: string, lossCompetitor?: string, skipTelegram?: boolean, toStatus?: string }} opts
 */
async function executeProformaAction(pfId, action, user, opts) {
  opts = opts || {};
  const note = opts.note || '';
  const lossReason = opts.lossReason || '';
  const lossCompetitor = opts.lossCompetitor || '';

  const existing = await query('SELECT * FROM proformas WHERE id = $1', [pfId]);
  if (!existing.rows.length) {
    return { ok: false, status: 404, error: 'پیشفاکتور یافت نشد' };
  }
  const pf = existing.rows[0];

  if (!canViewProforma(user, pf)) {
    return { ok: false, status: 403, error: 'دسترسی ندارید' };
  }

  if (action === 'rollback') {
    return executeProformaRollback(pf, user, opts);
  }

  const allowed = TRANSITIONS[pf.status] || [];
  if (!allowed.includes(action)) {
    return {
      ok: false,
      status: 400,
      error: "عملیات '" + action + "' در وضعیت '" + pf.status + "' مجاز نیست",
    };
  }

  const isManager = isManagerRole(user.role);
  const isSuperAdmin = isSuperAdminRole(user.role);
  const isOwner = pf.created_by === user.username;
  const canAct = isSuperAdmin || isManager || isOwner;

  if (!isSuperAdmin) {
    if (action === 'send' && !isOwner && !isManager) {
      return { ok: false, status: 403, error: 'فقط سازنده می‌تواند ارسال کند' };
    }
    if (action === 'customer_confirm' && !isOwner && !isManager) {
      return { ok: false, status: 403, error: 'فقط کارشناس مسئول می‌تواند تایید مشتری را ثبت کند' };
    }
    if ((action === 'customer_revise' || action === 'customer_reject') && !isOwner && !isManager) {
      return { ok: false, status: 403, error: 'فقط کارشناس مسئول یا مدیر می‌تواند پاسخ مشتری را ثبت کند' };
    }
    if ((action === 'cancel' || action === 'reopen') && !canAct) {
      return { ok: false, status: 403, error: 'دسترسی ندارید' };
    }
  }

  let updateSQL = '';
  let params = [];
  const caps = await loadDiscountCaps();
  const pfObj = rowToObj(pf);

  if (action === 'send') {
    const overCap = exceedsDiscountCap(pfObj, user.role, caps);
    if (overCap) {
      updateSQL = "SET status='pending_disc', updated_at=NOW(), manager_note=$2 WHERE id=$1";
      params = [pfId, 'تخفیف ' + maxDiscountPct(pfObj) + '٪ — سقف مجاز ' + getDiscountCap(user.role, caps) + '٪'];
    } else {
      updateSQL = "SET status='awaiting_customer', sent_at=NOW(), updated_at=NOW() WHERE id=$1";
      params = [pfId];
    }
  } else if (action === 'approve_disc') {
    if (!isSuperAdmin && !canApproveDiscount(user)) return { ok: false, status: 403, error: 'فقط مدیر یا مالی' };
    updateSQL = "SET status='awaiting_customer', sent_at=NOW(), updated_at=NOW(), manager_note=COALESCE(NULLIF($2,''), manager_note) WHERE id=$1";
    params = [pfId, note || 'تأیید تخفیف'];
  } else if (action === 'reject_disc') {
    if (!isSuperAdmin && !canApproveDiscount(user)) return { ok: false, status: 403, error: 'فقط مدیر یا مالی' };
    updateSQL = "SET status='draft', updated_at=NOW(), manager_note=$2 WHERE id=$1";
    params = [pfId, note || 'رد تخفیف — بازگشت به پیش‌نویس'];
  } else if (action === 'customer_confirm') {
    updateSQL = "SET status='sent', updated_at=NOW(), manager_note=COALESCE(NULLIF($2,''), manager_note) WHERE id=$1";
    params = [pfId, note || 'تایید مشتری ثبت شد — ارسال به مدیر'];
  } else if (action === 'customer_revise') {
    if (!note.trim()) return { ok: false, status: 400, error: 'شرح اصلاح درخواستی مشتری الزامی است' };
    updateSQL = "SET status='draft', manager_note=$2, updated_at=NOW() WHERE id=$1";
    params = [pfId, 'نیاز به اصلاح از طرف مشتری — ' + note];
  } else if (action === 'customer_reject') {
    if (!lossReason) return { ok: false, status: 400, error: 'علت عدم خرید الزامی است' };
    updateSQL = "SET status='rejected', responded_at=NOW(), responded_by=$2, manager_note=$3, loss_reason=$4, loss_competitor=$5, updated_at=NOW() WHERE id=$1";
    params = [pfId, user.username, note || 'عدم خرید نهایی توسط مشتری', lossReason, lossCompetitor];
  } else if (action === 'negotiate') {
    if (!isSuperAdmin && !isManager && !isOwner) return { ok: false, status: 403, error: 'دسترسی ندارید' };
    updateSQL = "SET status='negotiating', updated_at=NOW(), manager_note=COALESCE(NULLIF($2,''), manager_note) WHERE id=$1";
    params = [pfId, note];
  } else if (action === 'approve') {
    if (!isSuperAdmin && !isManager) return { ok: false, status: 403, error: 'فقط مدیر می‌تواند تأیید کند' };
    updateSQL = "SET status='approved', responded_at=NOW(), responded_by=$2, manager_note=$3, updated_at=NOW() WHERE id=$1";
    params = [pfId, user.username, note];
  } else if (action === 'reject') {
    if (!isSuperAdmin && !isManager) return { ok: false, status: 403, error: 'فقط مدیر می‌تواند رد کند' };
    if (!lossReason) return { ok: false, status: 400, error: 'دلیل رد الزامی است' };
    updateSQL = "SET status='rejected', responded_at=NOW(), responded_by=$2, manager_note=$3, loss_reason=$4, loss_competitor=$5, updated_at=NOW() WHERE id=$1";
    params = [pfId, user.username, note, lossReason, lossCompetitor];
  } else if (action === 'expire') {
    if (!isManager) return { ok: false, status: 403, error: 'فقط مدیر' };
    updateSQL = "SET status='expired', updated_at=NOW() WHERE id=$1";
    params = [pfId];
  } else if (action === 'cancel') {
    updateSQL = "SET status='cancelled', updated_at=NOW() WHERE id=$1";
    params = [pfId];
  } else if (action === 'reopen') {
    updateSQL = "SET status='draft', responded_at=NULL, responded_by=NULL, manager_note='', loss_reason=NULL, loss_competitor=NULL, updated_at=NOW() WHERE id=$1";
    params = [pfId];
  } else {
    return { ok: false, status: 400, error: 'عملیات نامعتبر' };
  }

  const r = await query('UPDATE proformas ' + updateSQL + ' RETURNING *', params);
  if (!r.rows.length) {
    return { ok: false, status: 400, error: 'به‌روزرسانی انجام نشد' };
  }

  const updated = rowToObj(r.rows[0]);
  await appendAuditLog(pfId, {
    action, by: user.username,
    from: pf.status, to: updated.status, note,
    lossReason, lossCompetitor,
  });
  await appendProformaEvent(pfId, 'status_' + action, user.username, note, {
    from: pf.status, to: updated.status, lossReason,
  });

  if (action === 'customer_reject') {
    await mirrorFinalLossToCenter(pf, user, lossReason, note);
  }

  let dispatch = null;
  if (action === 'approve') {
    try {
      dispatch = await createDispatchFromProforma({
        id: updated.id,
        no: updated.no,
        centerName: updated.centerName,
        items: updated.items,
        wmsWarehouseId: updated.wmsWarehouseId,
      }, user.username);
    } catch (e) {
      console.error('[proforma-action dispatch]', e.message);
    }
    await appendProformaEvent(pfId, 'warehouse_queued', user.username, 'ارجاع به انبار برای حواله خروج', { dispatchIds: dispatch && dispatch.transactionIds || [] });
    await appendProformaEvent(pfId, 'finance_queued', user.username, 'ارجاع به مالی برای صدور فاکتور', {});
  }

  if (!opts.skipTelegram) {
    await pushProformaTelegram(action, updated, user, note);
  }

  return { ok: true, status: 200, proforma: updated, dispatch, fromStatus: pf.status };
}

/**
 * سوپر ادمین: تنظیم وضعیت به هر مرحله ورک‌فلو (عقب یا جلو)
 */
async function executeProformaRollback(pf, user, opts) {
  opts = opts || {};
  if (!isSuperAdminRole(user.role)) {
    return { ok: false, status: 403, error: 'فقط سوپر ادمین می‌تواند وضعیت را تغییر دهد' };
  }

  const toStatus = String(opts.toStatus || '').trim();
  const note = String(opts.note || '').trim();

  if (!ALL_STATUSES.includes(toStatus)) {
    return {
      ok: false,
      status: 400,
      error: 'وضعیت مقصد نامعتبر است',
      allowedTargets: ALL_STATUSES.filter(function (s) { return s !== pf.status; }),
    };
  }
  if (toStatus === pf.status) {
    return { ok: false, status: 400, error: 'وضعیت مقصد با وضعیت فعلی یکی است' };
  }
  if (!note) {
    return { ok: false, status: 400, error: 'یادداشت دلیل تغییر وضعیت الزامی است' };
  }

  let cancelledInvoices = 0;
  if (pf.status === 'invoiced' && toStatus !== 'invoiced') {
    try {
      const inv = await query(
        `UPDATE invoices SET status = 'cancelled'
         WHERE proforma_id = $1 AND status IN ('issued', 'partial')
         RETURNING id`,
        [pf.id]
      );
      cancelledInvoices = inv.rows.length;
    } catch (e) {
      console.error('[proforma-rollback invoices]', e.message);
    }
  }

  const clearResponse = ['draft', 'pending_disc', 'awaiting_customer', 'sent', 'negotiating'].includes(toStatus);
  const auditNote = '↩ تغییر وضعیت به ' + (STATUS_LABELS[toStatus] || toStatus) +
    (cancelledInvoices ? ' (لغو ' + cancelledInvoices + ' فاکتور)' : '') +
    ' — ' + note;

  let updateSQL;
  let params;
  if (clearResponse) {
    updateSQL = `SET status = $2, responded_at = NULL, responded_by = NULL,
      manager_note = $3, loss_reason = NULL, loss_competitor = NULL, updated_at = NOW()
      WHERE id = $1`;
    params = [pf.id, toStatus, auditNote];
  } else if (toStatus === 'approved' || toStatus === 'invoiced') {
    updateSQL = `SET status = $2, responded_at = COALESCE(responded_at, NOW()),
      responded_by = COALESCE(responded_by, $4), manager_note = $3, updated_at = NOW()
      WHERE id = $1`;
    params = [pf.id, toStatus, auditNote, user.username];
  } else {
    updateSQL = `SET status = $2, manager_note = $3, updated_at = NOW() WHERE id = $1`;
    params = [pf.id, toStatus, auditNote];
  }

  const r = await query('UPDATE proformas ' + updateSQL + ' RETURNING *', params);
  if (!r.rows.length) {
    return { ok: false, status: 400, error: 'به‌روزرسانی انجام نشد' };
  }

  const updated = rowToObj(r.rows[0]);
  await appendAuditLog(pf.id, {
    action: 'rollback',
    by: user.username,
    from: pf.status,
    to: updated.status,
    note: auditNote,
  });
  await appendProformaEvent(pf.id, 'status_rollback', user.username, auditNote, {
    from: pf.status,
    to: updated.status,
    cancelledInvoices,
  });

  return {
    ok: true,
    status: 200,
    proforma: updated,
    fromStatus: pf.status,
    cancelledInvoices,
  };
}

module.exports = {
  executeProformaAction,
  TRANSITIONS,
  ROLLBACK_TARGETS,
  ALL_STATUSES,
  FLOW_ORDER,
  SIDE_STATUSES,
  STATUS_LABELS,
};

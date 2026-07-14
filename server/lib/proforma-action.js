'use strict';

const { query } = require('../db');
const { createDispatchFromProforma } = require('./wms-dispatch');
const { appendProformaEvent, appendAuditLog, computeExpiryDate } = require('./proforma-helpers');
const {
  loadDiscountCaps, exceedsDiscountCap, canApproveDiscount, maxDiscountPct, getDiscountCap,
} = require('./pf-discount');
const { isManagerRole } = require('./roles');

const TRANSITIONS = {
  draft:         ['send', 'cancel'],
  pending_disc:  ['approve_disc', 'reject_disc', 'cancel'],
  sent:          ['negotiate', 'approve', 'reject', 'cancel', 'expire'],
  negotiating:   ['approve', 'reject', 'cancel', 'expire'],
  approved:      ['cancel', 'reject'],
  rejected:      ['reopen'],
  cancelled:     ['reopen'],
  expired:       ['reopen'],
  invoiced:      [],
};

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
    if (action === 'send' && updated.status === 'sent') {
      const msg = '📄 پیشفاکتور ' + updated.no + ' از ' + user.username +
        ' در انتظار تأیید است.\n💰 مبلغ: ' + Number(updated.total).toLocaleString('fa-IR') + ' ﷼\n👤 مشتری: ' + (updated.centerName || '—');
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
 * @param {{ note?: string, lossReason?: string, lossCompetitor?: string, skipTelegram?: boolean }} opts
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

  const allowed = TRANSITIONS[pf.status] || [];
  if (!allowed.includes(action)) {
    return {
      ok: false,
      status: 400,
      error: "عملیات '" + action + "' در وضعیت '" + pf.status + "' مجاز نیست",
    };
  }

  const isManager = isManagerRole(user.role);
  const isOwner = pf.created_by === user.username;

  if (action === 'send' && !isOwner && !isManager) {
    return { ok: false, status: 403, error: 'فقط سازنده می‌تواند ارسال کند' };
  }
  if ((action === 'cancel' || action === 'reopen') && !isOwner && !isManager) {
    return { ok: false, status: 403, error: 'دسترسی ندارید' };
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
      updateSQL = "SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1";
      params = [pfId];
    }
  } else if (action === 'approve_disc') {
    if (!canApproveDiscount(user)) return { ok: false, status: 403, error: 'فقط مدیر یا مالی' };
    updateSQL = "SET status='sent', sent_at=NOW(), updated_at=NOW(), manager_note=COALESCE(NULLIF($2,''), manager_note) WHERE id=$1";
    params = [pfId, note || 'تأیید تخفیف'];
  } else if (action === 'reject_disc') {
    if (!canApproveDiscount(user)) return { ok: false, status: 403, error: 'فقط مدیر یا مالی' };
    updateSQL = "SET status='draft', updated_at=NOW(), manager_note=$2 WHERE id=$1";
    params = [pfId, note || 'رد تخفیف — بازگشت به پیش‌نویس'];
  } else if (action === 'negotiate') {
    if (!isManager && !isOwner) return { ok: false, status: 403, error: 'دسترسی ندارید' };
    updateSQL = "SET status='negotiating', updated_at=NOW(), manager_note=COALESCE(NULLIF($2,''), manager_note) WHERE id=$1";
    params = [pfId, note];
  } else if (action === 'approve') {
    if (!isManager) return { ok: false, status: 403, error: 'فقط مدیر می‌تواند تأیید کند' };
    updateSQL = "SET status='approved', responded_at=NOW(), responded_by=$2, manager_note=$3, updated_at=NOW() WHERE id=$1";
    params = [pfId, user.username, note];
  } else if (action === 'reject') {
    if (!isManager) return { ok: false, status: 403, error: 'فقط مدیر می‌تواند رد کند' };
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
  }

  if (!opts.skipTelegram) {
    await pushProformaTelegram(action, updated, user, note);
  }

  return { ok: true, status: 200, proforma: updated, dispatch, fromStatus: pf.status };
}

module.exports = { executeProformaAction, TRANSITIONS };

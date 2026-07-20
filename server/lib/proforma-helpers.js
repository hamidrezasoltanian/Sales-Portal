'use strict';

const { query } = require('../db');
const { addJalaliDays, todayJalaliStr, compareJalali } = require('./jalali-mini');

const PF_STATUSES = ['draft', 'sent', 'negotiating', 'approved', 'rejected', 'cancelled', 'invoiced', 'expired'];

const LOSS_REASONS = {
  price_high: 'قیمت بالا',
  competitor: 'رقیب',
  need_change: 'تغییر نیاز مشتری',
  no_response: 'عدم پاسخ مشتری',
  other: 'سایر',
};

const PF_LOSS_TO_CENTER = {
  price_high: 'قیمت بالا',
  competitor: 'رقیب برد',
  need_change: 'نیاز نداشتن',
  no_response: 'عدم دسترسی به تصمیم‌گیر',
  other: 'سایر',
};

const PF_ACTION_LABELS = {
  send: 'ارسال',
  approve: 'تأیید',
  reject: 'رد',
  cancel: 'لغو',
  reopen: 'بازگشایی',
  negotiate: 'مذاکره',
  expire: 'انقضا',
  approve_disc: 'تأیید تخفیف',
  reject_disc: 'رد تخفیف',
  customer_confirm: 'تأیید مشتری',
  customer_revise: 'نیاز به اصلاح',
  customer_decline: 'عدم خرید',
};

const PF_EVENT_LABELS = {
  created: 'ایجاد پیش‌فاکتور',
  sent: 'ارسال به مشتری',
  responded: 'پاسخ مدیر',
  followup: 'پیگیری',
  outcome_inactive: 'رد مشتری / غیرفعال',
  outcome_won: 'فروش / قرارداد',
  loss: 'دلیل رد',
  revision: 'نسخه جدید',
  version_save: 'ذخیره نسخه',
  expired: 'انقضای خودکار',
  revision_created: 'ایجاد نسخه جدید',
  revision_from: 'نسخه از پیش‌فاکتور قبلی',
  dispatch_created: 'صدور حواله انبار',
};

function parseAuditLog(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function _timelinePush(items, seen, at, type, label, actor, note, meta) {
  if (!at) return;
  const iso = at instanceof Date ? at.toISOString() : String(at);
  const key = iso + '|' + type + '|' + (note || '');
  if (seen.has(key)) return;
  seen.add(key);
  items.push({
    at: iso,
    type: type || '',
    label: label || type || '',
    actor: actor || '',
    note: note || '',
    meta: meta || {},
  });
}

function buildProformaTimeline(row, dbEvents) {
  const items = [];
  const seen = new Set();

  _timelinePush(items, seen, row.created_at, 'created', PF_EVENT_LABELS.created, row.created_by,
    'شماره ' + (row.no || ''));

  if (row.parent_proforma_id) {
    _timelinePush(items, seen, row.created_at, 'revision', PF_EVENT_LABELS.revision, row.created_by,
      'از ' + row.parent_proforma_id);
  }

  const versions = parseAuditLog(row.versions);
  if (Array.isArray(versions) && versions.length && versions[0] && typeof versions[0] === 'object' && ('at' in versions[0] || 'total' in versions[0])) {
    versions.forEach(function (v, i) {
      _timelinePush(items, seen, v.at, 'version_save', PF_EVENT_LABELS.version_save + ' ' + (i + 1),
        v.by, v.total != null ? 'جمع: ' + v.total : '');
    });
  }

  if (row.sent_at) {
    _timelinePush(items, seen, row.sent_at, 'sent', PF_EVENT_LABELS.sent, row.created_by, '');
  }

  if (row.responded_at) {
    const lbl = row.status === 'approved' ? 'تأیید مدیر'
      : row.status === 'rejected' ? 'رد شد'
        : row.status === 'expired' ? 'منقضی شد'
          : PF_EVENT_LABELS.responded;
    _timelinePush(items, seen, row.responded_at, 'responded', lbl, row.responded_by, row.manager_note || '');
  }

  if (row.loss_reason) {
    _timelinePush(items, seen, row.responded_at || row.updated_at, 'loss', PF_EVENT_LABELS.loss,
      row.responded_by, LOSS_REASONS[row.loss_reason] || row.loss_reason);
  }

  if (row.last_followup_at) {
    _timelinePush(items, seen, row.last_followup_at, 'followup', PF_EVENT_LABELS.followup, '', '');
  }

  parseAuditLog(row.audit_log).forEach(function (a) {
    const action = a.action || 'change';
    const lbl = PF_ACTION_LABELS[action] || action;
    let note = a.note || '';
    if (a.from && a.to && a.from !== a.to) note = (note ? note + ' — ' : '') + a.from + ' → ' + a.to;
    _timelinePush(items, seen, a.at, 'audit_' + action, lbl, a.by, note, { from: a.from, to: a.to });
  });

  (dbEvents || []).forEach(function (e) {
    const et = e.event_type || e.type || '';
    const lbl = PF_EVENT_LABELS[et] || PF_ACTION_LABELS[et.replace(/^status_/, '')] || et;
    _timelinePush(items, seen, e.event_at || e.at, et, lbl, e.actor, e.note || '', e.meta || {});
  });

  items.sort(function (a, b) {
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });
  return items;
}

function computeExpiryDate(jalaliDate, validDays) {
  if (!jalaliDate || !validDays) return '';
  return addJalaliDays(jalaliDate, Number(validDays) || 0);
}

async function appendProformaEvent(proformaId, eventType, actor, note, meta) {
  await query(
    `INSERT INTO proforma_events (proforma_id, event_type, actor, note, meta) VALUES ($1,$2,$3,$4,$5)`,
    [proformaId, eventType, actor || '', note || '', JSON.stringify(meta || {})]
  ).catch(function (e) {
    console.error('[proforma event]', e.message);
  });
}

async function appendAuditLog(proformaId, entry) {
  const row = await query('SELECT audit_log FROM proformas WHERE id = $1', [proformaId]);
  if (!row.rows.length) return;
  const log = parseAuditLog(row.rows[0].audit_log);
  log.push(Object.assign({ at: new Date().toISOString() }, entry));
  await query('UPDATE proformas SET audit_log = $1::jsonb WHERE id = $2', [JSON.stringify(log), proformaId]);
}

async function runAutoExpire() {
  const today = todayJalaliStr();
  const r = await query(
    `SELECT id, no, expiry_date, sales_owner, created_by, center_name
     FROM proformas
     WHERE status IN ('sent','negotiating','awaiting_customer')
       AND expiry_date IS NOT NULL AND expiry_date != ''
       AND expiry_date < $1`,
    [today]
  );
  for (const pf of r.rows) {
    await query(
      `UPDATE proformas SET status = 'expired', updated_at = NOW() WHERE id = $1`,
      [pf.id]
    );
    await appendAuditLog(pf.id, { action: 'expire', by: 'system', from: pf.status || 'sent', to: 'expired' });
    await appendProformaEvent(pf.id, 'expired', 'system', 'انقضای خودکار — بدون پاسخ تا تاریخ اعتبار', { expiryDate: pf.expiry_date });
  }
  return r.rows.length;
}

function enrichRow(r) {
  const expiry = r.expiry_date || computeExpiryDate(r.jalali_date, r.valid_days);
  const today = todayJalaliStr();
  const daysToExpiry = expiry ? Math.round((compareJalali(expiry, today) >= 0 ? 1 : -1)) : null;
  return {
    expiryDate: expiry,
    isNearExpiry: expiry && compareJalali(expiry, today) >= 0 && compareJalali(expiry, addJalaliDays(today, 3)) <= 0,
    isExpiredByDate: expiry && compareJalali(expiry, today) < 0,
  };
}

module.exports = {
  PF_STATUSES,
  LOSS_REASONS,
  PF_LOSS_TO_CENTER,
  PF_ACTION_LABELS,
  PF_EVENT_LABELS,
  parseAuditLog,
  buildProformaTimeline,
  computeExpiryDate,
  appendProformaEvent,
  appendAuditLog,
  runAutoExpire,
  enrichRow,
  todayJalaliStr,
  compareJalali,
  addJalaliDays,
};

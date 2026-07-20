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
  draft:       { label: 'پیش‌نویس',    short: 'پیش‌نویس', cls: 'bgr' },
  awaiting_customer: { label: 'در انتظار تایید مشتری', short: 'تایید مشتری', cls: 'bo' },
  sent:        { label: 'انتظار تأیید مدیر', short: 'تأیید مدیر', cls: 'bb'  },
  negotiating: { label: 'در مذاکره',   short: 'مذاکره', cls: 'bo'  },
  pending_disc: { label: 'انتظار تأیید تخفیف', short: 'تخفیف', cls: 'bo' },
  approved:    { label: 'تأیید شده',  short: 'تأیید', cls: 'bg'  },
  rejected:    { label: 'رد شده',     short: 'رد', cls: 'br'  },
  cancelled:   { label: 'لغو شده',    short: 'لغو', cls: 'by'  },
  invoiced:    { label: 'فاکتور شده', short: 'فاکتور', cls: 'bc'  },
  expired:     { label: 'منقضی شده',  short: 'منقضی', cls: 'bk'  },
};

/** مسیر اصلی پیشفاکتور → فاکتور (برای نمایش به کاربر و مدیر) */
var PF_FLOW_STAGES = [
  { key: 'draft',              label: 'پیش‌نویس',     hint: 'ثبت و ویرایش توسط کارشناس', icon: '📝' },
  { key: 'awaiting_customer',  label: 'تایید مشتری',  hint: 'در کارتابل کارشناس تا تایید مشتری', icon: '👤' },
  { key: 'sent',               label: 'تأیید مدیر',   hint: 'تأیید صدور حواله و فاکتور', icon: '🧑‍💼' },
  { key: 'approved',           label: 'تأیید شده',    hint: 'آماده حواله / صدور فاکتور', icon: '✅' },
  { key: 'invoiced',           label: 'فاکتور',       hint: 'فاکتور صادر شده', icon: '🧾' },
];

var PF_FLOW_SIDE = [
  { key: 'pending_disc', label: 'تأیید تخفیف', hint: 'قبل از ارسال — نیاز به تأیید مدیر/مالی' },
  { key: 'negotiating',  label: 'مذاکره',      hint: 'بین تأیید مشتری و تأیید نهایی مدیر' },
  { key: 'rejected',     label: 'رد',          hint: 'مسیر کناری — بازگشایی به پیش‌نویس' },
  { key: 'cancelled',    label: 'لغو',         hint: 'مسیر کناری — بازگشایی به پیش‌نویس' },
  { key: 'expired',      label: 'منقضی',       hint: 'پایان اعتبار — بازگشایی به پیش‌نویس' },
];

/** همه وضعیت‌های ورک‌فلو — سوپر ادمین می‌تواند به هر کدام برود */
var PF_ALL_STATUSES = [
  'draft', 'pending_disc', 'awaiting_customer', 'sent', 'negotiating',
  'approved', 'invoiced', 'rejected', 'cancelled', 'expired',
];

/** مسیر اصلی (هم‌تراز PF_FLOW_STAGES — نوار وضعیت لیست) */
var PF_FLOW_PICK_MAIN = PF_FLOW_STAGES.map(function(s) { return s.key; });
/** مسیرهای فرعی / کناری (تخفیف، مذاکره، رد، لغو، منقضی) */
var PF_FLOW_PICK_SIDE = PF_FLOW_SIDE.map(function(s) { return s.key; });

function _pfRollbackTargets(fromStatus) {
  return PF_ALL_STATUSES.filter(function(s) { return s !== fromStatus; });
}

/** سازگاری با کد قبلی */
var PF_ROLLBACK_TARGETS = PF_ALL_STATUSES.reduce(function(acc, from) {
  acc[from] = _pfRollbackTargets(from);
  return acc;
}, {});

function pfStatusBadge(s) {
  return _pfStatusChipHtml(s, null, { plain: true });
}

function _pfIsManager() {
  return typeof _isManager === 'function' && _isManager();
}

function _pfCanIssueInvoice() {
  return _pfIsManager() || window._authUserRole === 'مالی';
}

function _pfIsSuperAdmin() {
  if (typeof _isSuperAdmin === 'function' && _isSuperAdmin()) return true;
  if (typeof crmIsSuperAdminRole === 'function' && typeof crmResolveCurrentRole === 'function') {
    return crmIsSuperAdminRole(crmResolveCurrentRole());
  }
  try {
    var members = (typeof DB !== 'undefined' && DB.settings && DB.settings.members) ? DB.settings.members : [];
    var m = members.find(function(mb){ return mb.id === currentUser; });
    return !!(m && m.role === 'سوپر ادمین');
  } catch (e) { return false; }
}

function _pfStatusShort(s) {
  var st = PF_STATUS[s];
  return (st && (st.short || st.label)) || s;
}

function _pfStatusLabel(s) {
  return (PF_STATUS[s] || { label: s }).label;
}

/** راهنمای مرحله برای کاربر: الان کجاست + قدم بعدی + مسئول */
function _pfStageGuide(status, pf) {
  var isMgr = _pfIsManager();
  var isOwner = !!(pf && (pf.createdBy === currentUser || isMgr));
  var guides = {
    draft: {
      step: '۱ از ۵',
      now: 'پیش‌نویس — هنوز به مشتری نرسیده',
      next: isOwner ? 'بعد از تکمیل کالاها: دکمه «ارسال به مشتری» را بزنید' : 'منتظر اقدام کارشناس مسئول',
      who: 'کارشناس',
    },
    pending_disc: {
      step: '۱ از ۵',
      now: 'منتظر تأیید تخفیف (مدیر/مالی)',
      next: isMgr ? 'تخفیف را تأیید یا رد کنید' : 'منتظر تأیید مدیر یا مالی',
      who: 'مدیر / مالی',
    },
    awaiting_customer: {
      step: '۲ از ۵',
      now: 'نزد مشتری — ارسال شده، منتظر جواب',
      next: isOwner ? 'تأیید مشتری → مدیر | عدم تأیید → اصلاح یا عدم خرید' : 'منتظر کارشناس',
      who: 'کارشناس',
    },
    sent: {
      step: '۳ از ۵',
      now: 'مشتری تأیید کرد — منتظر تأیید مدیر',
      next: isMgr ? 'تأیید → حواله انبار + فاکتور مالی' : 'منتظر مدیر',
      who: 'مدیر',
    },
    negotiating: {
      step: '۳ از ۵',
      now: 'در مذاکره با مشتری / مدیر',
      next: isMgr ? 'پس از جمع‌بندی: تأیید یا رد کنید' : 'منتظر نتیجه مذاکره',
      who: 'مدیر / کارشناس',
    },
    approved: {
      step: '۴ از ۵',
      now: 'مدیر تأیید کرد — آماده عملیات',
      next: isMgr ? 'انبار: حواله | مالی: صدور فاکتور' : 'منتظر انبار / مالی',
      who: 'انبار / مالی',
    },
    invoiced: {
      step: '۵ از ۵',
      now: 'فاکتور صادر شده — مسیر تمام',
      next: 'در صورت نیاز حواله را بررسی کنید',
      who: '—',
    },
    rejected: {
      step: 'توقف',
      now: 'رد شده',
      next: isOwner || isMgr ? 'در صورت نیاز «بازگشایی» کنید تا دوباره پیش‌نویس شود' : '—',
      who: '—',
    },
    cancelled: {
      step: 'توقف',
      now: 'لغو شده',
      next: isOwner || isMgr ? 'در صورت نیاز «بازگشایی» کنید' : '—',
      who: '—',
    },
    expired: {
      step: 'توقف',
      now: 'منقضی شده (اعتبار تمام شده)',
      next: isOwner || isMgr ? 'بازگشایی و ارسال مجدد در صورت نیاز' : '—',
      who: '—',
    },
  };
  return guides[status] || {
    step: '—',
    now: _pfStatusLabel(status),
    next: '—',
    who: '—',
  };
}

/** مرحله قبلی/بعدی در مسیر اصلی */
function _pfFlowPrevStatus(status) {
  var map = {
    pending_disc: 'draft',
    awaiting_customer: 'draft',
    sent: 'awaiting_customer',
    negotiating: 'sent',
    approved: 'sent',
    invoiced: 'approved',
  };
  return map[status] || null;
}

function _pfFlowNextStatus(status) {
  var map = {
    draft: 'awaiting_customer',
    pending_disc: 'awaiting_customer',
    awaiting_customer: 'sent',
    sent: 'approved',
    negotiating: 'approved',
    approved: 'invoiced',
  };
  return map[status] || null;
}

function _pfCanApproveDisc() {
  if (typeof _pfCanApproveDiscount === 'function') return _pfCanApproveDiscount();
  return _pfIsManager();
}

function _pfStageNavRoleHint(pf, prev, next) {
  if (next && next.allowed) return next.role || 'شما';
  if (prev && prev.allowed) return prev.role || 'شما';
  if (_pfIsSuperAdmin()) return 'سوپر ادمین — اقدام';
  if (_pfIsManager()) return 'مدیر — منتظر اقدام';
  if (pf && pf.createdBy === currentUser) return 'کارشناس';
  return 'فقط مشاهده';
}

/** مرحله بعد — allowed فقط وقتی کاربر مجاز است */
function _pfNextStageAction(pf) {
  if (!pf || !pf.status) return { allowed: false, label: 'مرحله بعد', targetLabel: '—', disabledReason: '—' };
  var isMgr = _pfIsManager();
  var isCreator = pf.createdBy === currentUser;
  var isOwner = isCreator || isMgr;
  var isSA = _pfIsSuperAdmin();
  var st = pf.status;
  var target = _pfFlowNextStatus(st);
  var saRole = 'سوپر ادمین';
  var saCls = 'purple';

  if (st === 'draft') {
    if (!isCreator && !isSA) {
      return { allowed: false, label: 'ارسال', targetLabel: 'تایید مشتری', disabledReason: 'فقط کارشناس ثبت\u200cکننده', role: 'کارشناس' };
    }
    return {
      allowed: true, action: 'send', label: 'ارسال به مشتری', targetLabel: 'تایید مشتری',
      cls: isSA && !isCreator ? saCls : 'ok', role: isSA && !isCreator ? saRole : 'کارشناس', icon: '📤',
    };
  }
  if (st === 'pending_disc') {
    if (!_pfCanApproveDisc() && !isSA) {
      return { allowed: false, label: 'تأیید تخفیف', targetLabel: 'تایید مشتری', disabledReason: 'منتظر مدیر / مالی', role: 'مدیر / مالی' };
    }
    return {
      allowed: true, action: 'approve_disc', label: 'تأیید تخفیف', targetLabel: 'تایید مشتری',
      cls: isSA && !_pfCanApproveDisc() ? saCls : 'ok', role: isSA ? saRole : 'مدیر / مالی', icon: '✅',
    };
  }
  if (st === 'awaiting_customer') {
    if (!isOwner && !isSA) {
      return { allowed: false, label: 'تأیید مشتری', targetLabel: 'تأیید مدیر', disabledReason: 'منتظر کارشناس مسئول', role: 'کارشناس' };
    }
    return {
      allowed: true, action: 'customer_confirm', label: 'مشتری تأیید کرد', targetLabel: 'تأیید مدیر',
      cls: isSA && !isOwner ? saCls : 'warn', role: isSA && !isOwner ? saRole : 'کارشناس', icon: '👍',
    };
  }
  if (st === 'sent' || st === 'negotiating') {
    if (!isMgr && !isSA) {
      return { allowed: false, label: 'تأیید مدیر', targetLabel: 'تأیید شده', disabledReason: 'منتظر مدیر', role: 'مدیر' };
    }
    return {
      allowed: true, action: 'approve', label: 'تأیید مدیر', targetLabel: 'تأیید شده',
      cls: isSA && !isMgr ? saCls : 'ok', role: isSA && !isMgr ? saRole : 'مدیر', icon: '✅',
    };
  }
  if (st === 'approved') {
    if (!isMgr && !isSA) {
      return { allowed: false, label: 'صدور فاکتور', targetLabel: 'فاکتور', disabledReason: 'منتظر مدیر / انبار', role: 'مدیر' };
    }
    return {
      allowed: true, action: 'invoice', label: 'صدور فاکتور', targetLabel: 'فاکتور',
      cls: isSA && !isMgr ? saCls : 'ok', role: isSA && !isMgr ? saRole : 'مدیر', icon: '🧾',
    };
  }
  if (st === 'invoiced') {
    return { allowed: false, label: 'مرحله بعد', targetLabel: 'پایان', disabledReason: 'مسیر تمام شده', done: true };
  }
  if (['rejected', 'cancelled', 'expired'].indexOf(st) >= 0) {
    if (!isOwner && !isSA) {
      return { allowed: false, label: 'بازگشایی', targetLabel: 'پیش\u200cنوی\u0633', disabledReason: 'منتظر کارشناس / مدیر', role: 'کارشناس' };
    }
    return {
      allowed: true, action: 'reopen', label: 'بازگشایی', targetLabel: 'پیش\u200cنوی\u0633',
      cls: isSA && !isOwner ? saCls : 'warn', role: isSA && !isOwner ? saRole : 'کارشناس / مدیر', icon: '🔓',
    };
  }
  if (isSA && target) {
    return {
      allowed: true, rollback: true, toStatus: target,
      label: 'رفتن به مرحله بعد', targetLabel: _pfStatusLabel(target), cls: saCls, role: saRole, icon: '←',
    };
  }
  return {
    allowed: false,
    label: 'مرحله بعد',
    targetLabel: target ? _pfStatusLabel(target) : '—',
    disabledReason: 'اقدامی برای شما تعریف نشده',
  };
}

/** مرحله قبل */
function _pfPrevStageAction(pf) {
  if (!pf || !pf.status) return { allowed: false, label: 'مرحله قبل', targetLabel: '—', disabledReason: '—' };
  var st = pf.status;
  var isMgr = _pfIsManager();
  var isCreator = pf.createdBy === currentUser;
  var isOwner = isCreator || isMgr;
  var isSA = _pfIsSuperAdmin();
  var prevTarget = _pfFlowPrevStatus(st);
  var saRole = 'سوپر ادمین';
  var saCls = 'purple';

  if (st === 'pending_disc' && (_pfCanApproveDisc() || isSA)) {
    return {
      allowed: true, action: 'reject_disc', label: 'رد تخفیف', targetLabel: 'پیش\u200cنوی\u0633',
      cls: isSA && !_pfCanApproveDisc() ? saCls : 'danger', role: isSA ? saRole : 'مدیر / مالی', icon: '⛔',
    };
  }
  if (st === 'awaiting_customer' && (isOwner || isSA)) {
    return {
      allowed: true, action: 'customer_outcome', label: 'عدم تأیید مشتری', targetLabel: 'اصلاح / عدم خرید',
      cls: isSA && !isOwner ? saCls : 'danger', role: isSA && !isOwner ? saRole : 'کارشناس', icon: '👎',
    };
  }
  if ((st === 'sent' || st === 'negotiating') && (isMgr || isSA)) {
    return {
      allowed: true, action: 'reject', label: 'رد مدیر', targetLabel: 'رد شده',
      cls: isSA && !isMgr ? saCls : 'danger', role: isSA && !isMgr ? saRole : 'مدیر', icon: '⛔',
    };
  }
  if (st === 'approved' && (isMgr || isSA)) {
    return {
      allowed: true, action: 'reject', label: 'رد / برگشت', targetLabel: 'رد شده',
      cls: isSA && !isMgr ? saCls : 'danger', role: isSA && !isMgr ? saRole : 'مدیر', icon: '⛔',
    };
  }
  if (isSA && prevTarget) {
    return {
      allowed: true, rollback: true, toStatus: prevTarget,
      label: 'برگشت به مرحله قبل', targetLabel: _pfStatusLabel(prevTarget), cls: saCls, role: saRole, icon: '→',
    };
  }

  return {
    allowed: false,
    label: 'مرحله قبل',
    targetLabel: prevTarget ? _pfStatusLabel(prevTarget) : '—',
    disabledReason: prevTarget
      ? ('برگشت به «' + _pfStatusLabel(prevTarget) + '» برای شما مجاز نیست')
      : 'مرحله قبلی وجود ندارد',
  };
}

function _pfStageNavBtnHtml(dir, act, pfId) {
  if (!act) return '';
  var isPrev = dir === 'prev';
  if (!act.allowed) return '';

  var arrow = isPrev ? '»' : '«';
  var cls = 'pf-nav-btn ' + dir + (' ' + (act.cls || ''));
  var target = act.targetLabel || '—';
  var mainLbl = isPrev ? 'مرحله قبل' : 'مرحله بعد';
  var subLbl = act.label || target;
  var title = mainLbl + ': ' + subLbl + ' → «' + target + '»';

  var ico = act.icon && act.icon.length <= 2 ? act.icon : arrow;
  return '<button type="button" class="' + cls + '" onclick="pfStageNavGo(\'' + pfId + '\',\'' + dir + '\')" title="' + esc(title) + '">' +
    '<span class="pf-nav-text">' +
      '<span class="pf-nav-main">' + esc(mainLbl) + '</span>' +
      '<span class="pf-nav-target">' + esc(subLbl) + '</span>' +
    '</span>' +
    '<span class="pf-nav-arrow" aria-hidden="true">' + ico + '</span></button>';
}

function _pfStageNavHtml(pf) {
  var prev = _pfPrevStageAction(pf);
  var next = _pfNextStageAction(pf);
  var nextHtml = _pfStageNavBtnHtml('next', next, pf.id);
  var prevHtml = _pfStageNavBtnHtml('prev', prev, pf.id);
  if (!nextHtml && !prevHtml) return '';
  return '<div class="pf-stage-nav">' +
    '<div class="pf-stage-nav-btns">' + nextHtml + prevHtml + '</div></div>';
}

function _pfNextStepBtnHtml(act, opts) {
  if (!act || !act.allowed) return '';
  opts = opts || {};
  var compact = !!opts.compact;
  var btnCls = 'pf-next-step-btn' + (act.cls ? ' ' + act.cls : '') + (compact ? ' compact' : '');
  return '<button type="button" class="' + btnCls + '" onclick="pfStageNavGo(\'' + (act.pfId || '') + '\',\'next\')" ' +
    'title="برای رفتن به «' + esc(act.targetLabel) + '»">' +
    (compact ? '' : '<span class="pf-next-step-go">بزنید</span>') +
    '<span class="pf-next-step-ico">' + (act.icon || '←') + '</span>' +
    '<span class="pf-next-step-lbl">' + esc(act.label) + '</span>' +
    '</button>';
}

function _pfNextStepBlockHtml(pf, opts) {
  opts = opts || {};
  var act = _pfNextStageAction(pf);
  act.pfId = pf.id;
  if (!act) return '';
  var compact = !!opts.compact;
  var cls = 'pf-next-step' + (compact ? ' compact' : '') + (opts.inBanner ? ' in-banner' : '');

  if (act.done) {
    return '<div class="' + cls + ' done"><div class="pf-next-step-done">✅ مسیر تمام</div></div>';
  }
  if (!act.allowed) {
    return '<div class="' + cls + ' wait">' +
      '<div class="pf-next-step-hdr">مرحله بعد: <strong>' + esc(act.targetLabel) + '</strong></div>' +
      '<div class="pf-next-step-wait">⏳ ' + esc(act.disabledReason || act.role || 'منتظر') + '</div></div>';
  }

  var hdr = '<div class="pf-next-step-hdr">مرحله بعد ← <strong>' + esc(act.targetLabel) + '</strong></div>';
  return '<div class="' + cls + '">' + hdr + _pfNextStepBtnHtml(act, opts) + '</div>';
}

async function pfQuickRollbackTo(pfId, toStatus) {
  if (!_pfIsSuperAdmin()) { showToast('❌ فقط سوپر ادمین'); return; }
  var lbl = _pfStatusLabel(toStatus);
  var note = prompt('دلیل تغییر وضعیت به «' + lbl + '» (الزامی):');
  if (!note || !String(note).trim()) { showToast('❌ یادداشت الزامی است'); return; }
  await pfAction(pfId, 'rollback', String(note).trim(), { toStatus: toStatus });
}

function pfStageNavGo(pfId, dir) {
  var pf = (_pfList || []).find(function(p) { return p.id === pfId; });
  if (!pf) return;
  var act = dir === 'prev' ? _pfPrevStageAction(pf) : _pfNextStageAction(pf);
  if (!act || !act.allowed) {
    if (act && act.disabledReason) showToast('ℹ️ ' + act.disabledReason);
    return;
  }
  if (act.confirm && !confirm(act.confirm)) return;
  if (act.rollback && act.toStatus) {
    pfQuickRollbackTo(pfId, act.toStatus);
    return;
  }
  if (act.action === 'customer_outcome') { pfCustomerOutcome(pfId); return; }
  if (act.action === 'reject') { pfReject(pfId); return; }
  if (act.action === 'invoice') { pfIssueInvoice(pfId); return; }
  if (act.action === 'dispatch') { pfIssueDispatch(pfId); return; }
  if (act.action) { pfAction(pfId, act.action); return; }
}

function _pfStatusCellHtml(pf) {
  return _pfUnifiedStatusBarHtml(pf);
}

function _pfUnifiedStatusBarHtml(pf) {
  if (!pf) return '';
  var status = pf.status || 'draft';
  var sid = String(pf.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var openFn = "pfOpenFlowModal('" + String(status).replace(/'/g, "\\'") + "'" + (sid ? ",'" + sid + "'" : '') + ")";
  var terminal = ['rejected', 'cancelled', 'expired'].indexOf(status) >= 0;

  if (terminal) {
    var bg = _badgeBg(status);
    var fg = _badgeFg(status);
    return '<div class="pf-unified-bar terminal" onclick="' + openFn + '" role="button" tabindex="0" title="مشاهده مسیر">' +
      '<div class="pf-ub-full" style="background:' + bg + ';color:' + fg + '">' +
        '<span class="pf-ub-cur-label">' + esc(_pfStatusLabel(status)) + '</span>' +
      '</div>' +
      _pfNextStepInlineHtml(pf) +
    '</div>';
  }

  var idx = _pfFlowIndex(status);
  var track = PF_FLOW_STAGES.map(function(s, i) {
    var cls = 'pf-ub-seg';
    if (idx < 0) cls += ' idle';
    else if (i < idx) cls += ' done';
    else if (i === idx) cls += ' current';
    else cls += ' todo';

    var isCur = cls.indexOf('current') >= 0;
    var style = '';
    if (isCur) {
      style = ' style="background:' + _badgeBg(status) + ';color:' + _badgeFg(status) + '"';
    }
    var inner = isCur
      ? '<span class="pf-ub-cur-label">' + esc(_pfStatusLabel(status)) + '</span>'
      : '<span class="pf-ub-seg-lbl">' + esc(s.label) + '</span>';
    return '<div class="' + cls + '"' + style + ' title="' + esc(s.hint) + '">' + inner + '</div>';
  }).join('');

  return '<div class="pf-unified-bar" onclick="' + openFn + '" role="button" tabindex="0" title="مشاهده مسیر مراحل">' +
    '<div class="pf-ub-track">' + track + '</div>' +
    _pfNextStepInlineHtml(pf) +
  '</div>';
}

function _pfNextStepInlineHtml(pf) {
  var next = _pfNextStageAction(pf);
  if (!next) return '';
  if (next.done) {
    return '<span class="pf-ub-done">✅ مسیر تمام</span>';
  }
  if (!next.allowed) {
    return '<span class="pf-ub-wait" title="' + esc(next.disabledReason || '') + '">⏳ ' + esc(next.role || next.disabledReason || 'منتظر') + '</span>';
  }
  return '';
}

function _pfStageBannerHtml(pf) {
  if (!pf || !pf.status) return '';
  var g = _pfStageGuide(pf.status, pf);
  return '<div class="pf-stage-banner">' +
    '<div class="pf-stage-banner-top">' +
      '<span class="pf-stage-banner-step">مرحله ' + esc(g.step) + '</span>' +
      '<span class="pf-stage-banner-now">' + esc(g.now) + '</span>' +
    '</div>' +
    _pfUnifiedStatusBarHtml(pf) +
  '</div>';
}

/** ایندکس مرحله اصلی برای استپر */
function _pfFlowIndex(status) {
  if (status === 'draft' || status === 'pending_disc') return 0;
  if (status === 'awaiting_customer') return 1;
  if (status === 'sent' || status === 'negotiating') return 2;
  if (status === 'approved') return 3;
  if (status === 'invoiced') return 4;
  return -1;
}

function _pfStatusChipHtml(status, pfId, opts) {
  opts = opts || {};
  var st = PF_STATUS[status] || { label: status, short: status };
  var label = opts.full ? st.label : (st.short || st.label);
  var bg = _badgeBg(status);
  var fg = _badgeFg(status);
  if (opts.plain) {
    return '<span class="pf-status-chip plain" style="background:' + bg + ';color:' + fg + '">' + esc(label) + '</span>';
  }
  var sid = pfId ? String(pfId).replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  var onclick = "pfOpenFlowModal('" + String(status).replace(/'/g, "\\'") + "'" + (sid ? ",'" + sid + "'" : '') + ")";
  return '<button type="button" class="pf-status-chip" onclick="' + onclick + '" title="مشاهده مسیر مراحل" style="background:' + bg + ';color:' + fg + '">' +
    '<span class="pf-status-chip-txt">' + esc(label) + '</span><span class="pf-status-chip-ico" aria-hidden="true">◎</span></button>';
}

function _pfFlowLegendHtml() {
  return '<div class="pf-flow-legend compact">' +
    '<button type="button" class="pf-flow-guide-btn" onclick="pfOpenFlowModal(\'draft\')">' +
      '<span class="pf-flow-guide-ico">🗺</span>' +
      '<span><strong>مسیر پیشفاکتور → فاکتور</strong>' +
      '<span class="pf-flow-guide-sub">پیش‌نویس ← ارسال برای مشتری ← تأیید مدیر ← انبار و مالی</span></span>' +
    '</button></div>';
}

function _pfFlowStepperHtml(status, opts) {
  opts = opts || {};
  var compact = !!opts.compact;
  var clickable = opts.clickable !== false;
  var idx = _pfFlowIndex(status);
  var terminal = ['rejected', 'cancelled', 'expired'].includes(status);
  var extra = '';
  if (status === 'pending_disc') extra = 'انتظار تأیید تخفیف';
  else if (status === 'negotiating') extra = 'در مذاکره';
  else if (terminal) extra = _pfStatusLabel(status);

  var stepsHtml = PF_FLOW_STAGES.map(function(s, i) {
    var cls = 'pf-flow-step';
    if (idx < 0 || terminal) cls += ' idle';
    else if (i < idx) cls += ' done';
    else if (i === idx) cls += ' current';
    else cls += ' todo';
    return '<div class="' + cls + '" title="' + s.hint + '">' +
      '<span class="pf-flow-dot">' + (i < idx && idx >= 0 ? '✓' : (i + 1)) + '</span>' +
      (compact ? '' : '<span class="pf-flow-lbl">' + s.label + '</span>') +
      '</div>' +
      (i < PF_FLOW_STAGES.length - 1 ? '<div class="pf-flow-line' + (i < idx ? ' done' : '') + '"></div>' : '');
  }).join('');

  var wrapCls = 'pf-flow-stepper' + (compact ? ' compact' : '') + (terminal ? ' terminal' : '') + (clickable ? ' clickable' : '');
  var openAttr = clickable ? ' role="button" tabindex="0" onclick="pfOpenFlowModal(\'' + String(status).replace(/'/g, "\\'") + '\')"' : '';
  return '<div class="' + wrapCls + '"' + openAttr + '>' +
    stepsHtml +
    (extra ? '<span class="pf-flow-extra">' + extra + '</span>' : '') +
    '</div>';
}

/** مودال گرافیکی مسیر وضعیت */
function pfOpenFlowModal(status, pfId) {
  var pf = null;
  if (pfId && Array.isArray(_pfList)) {
    pf = _pfList.find(function(p) { return p.id === pfId; }) || null;
  }
  var cur = status || (pf && pf.status) || 'draft';
  var idx = _pfFlowIndex(cur);
  var terminal = ['rejected', 'cancelled', 'expired'].includes(cur);
  var title = 'مسیر پیشفاکتور → فاکتور' + (pf && pf.no ? ' — ' + pf.no : '');

  var stagesHtml = PF_FLOW_STAGES.map(function(s, i) {
    var state = 'todo';
    if (terminal) state = 'idle';
    else if (idx >= 0 && i < idx) state = 'done';
    else if (idx >= 0 && i === idx) state = 'current';
    else if (cur === s.key) state = 'current';
    return '<div class="pf-flow-modal-stage ' + state + '">' +
      '<div class="pf-flow-modal-num">' + (state === 'done' ? '✓' : (s.icon || (i + 1))) + '</div>' +
      '<div class="pf-flow-modal-body">' +
        '<div class="pf-flow-modal-title">' + s.label +
          (state === 'current' ? ' <span class="pf-flow-now">الان اینجا</span>' : '') +
        '</div>' +
        '<div class="pf-flow-modal-hint">' + s.hint + '</div>' +
      '</div>' +
      (i < PF_FLOW_STAGES.length - 1 ? '<div class="pf-flow-modal-connector' + (state === 'done' ? ' done' : '') + '"></div>' : '') +
    '</div>';
  }).join('');

  var sideHtml = PF_FLOW_SIDE.map(function(s) {
    var on = cur === s.key;
    return '<div class="pf-flow-side-chip' + (on ? ' on' : '') + '">' +
      '<strong>' + s.label + '</strong><span>' + s.hint + '</span></div>';
  }).join('');

  var meta = '';
  if (pf) {
    meta = '<div class="pf-flow-modal-meta">' +
      '<div><span>وضعیت فعلی</span><strong style="color:' + _badgeFg(cur) + '">' + esc(_pfStatusLabel(cur)) + '</strong></div>' +
      '<div><span>مرکز</span><strong>' + esc(pf.centerName || '—') + '</strong></div>' +
      '<div><span>مبلغ</span><strong>' + (typeof fmtNum === 'function' ? fmtNum(pf.total) : pf.total) + ' ﷼</strong></div>' +
      '</div>';
  } else {
    meta = '<div class="pf-flow-modal-meta single"><div><span>وضعیت انتخاب‌شده</span><strong style="color:' + _badgeFg(cur) + '">' + esc(_pfStatusLabel(cur)) + '</strong></div></div>';
  }

  var body = '<div class="pf-flow-modal">' +
    meta +
    '<div class="pf-flow-modal-track">' + stagesHtml + '</div>' +
    '<div class="pf-flow-modal-sides"><div class="pf-flow-modal-sides-title">مسیرهای فرعی / کناری</div>' + sideHtml + '</div>' +
    '</div>';

  if (typeof openModal === 'function') {
    openModal('pfFlowModal', title, body,
      '<button onclick="closeModal(\'pfFlowModal\')" style="padding:8px 18px;background:var(--brand);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">بستن</button>',
      { lg: true }
    );
  }
}

/** نمودار قیف/مسیر برای گزارش‌ها — counts: { status: n } و اختیاری values */
function _pfFlowReportHtml(counts, values) {
  counts = counts || {};
  values = values || {};
  var stages = PF_FLOW_STAGES.map(function(s) {
    var n = Number(counts[s.key] || 0);
    if (s.key === 'draft') n += Number(counts.pending_disc || 0);
    if (s.key === 'sent') n += Number(counts.negotiating || 0);
    return { key: s.key, label: s.label, icon: s.icon, count: n, value: Number(values[s.key] || 0) };
  });
  var max = Math.max.apply(null, stages.map(function(s) { return s.count; }).concat([1]));
  return '<div class="pf-flow-report">' +
    '<div class="pf-flow-report-title">مسیر پیشفاکتور → فاکتور</div>' +
    '<div class="pf-flow-report-track">' +
    stages.map(function(s, i) {
      var pct = Math.max(12, Math.round((s.count / max) * 100));
      return '<div class="pf-flow-report-stage">' +
        '<div class="pf-flow-report-bar" style="height:' + pct + '%"></div>' +
        '<div class="pf-flow-report-count">' + s.count + '</div>' +
        '<div class="pf-flow-report-lbl">' + (s.icon ? s.icon + ' ' : '') + s.label + '</div>' +
        '</div>' +
        (i < stages.length - 1 ? '<div class="pf-flow-report-arrow">←</div>' : '');
    }).join('') +
    '</div></div>';
}

function _pfCanUploadAttachments(pf) {
  var pfId = (pf && pf.id) || _pfEditId;
  if (!pfId) return false;
  var status = pf ? pf.status : 'draft';
  var isOwner = pf && pf.createdBy === currentUser;
  if (status === 'draft' || status === 'sent' || status === 'awaiting_customer') return isOwner || _pfIsManager();
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
  try {
    await _pfLoadWmsProds();
    (_pfList || []).forEach(function(pf) {
      (pf.items || []).forEach(_pfHydrateItemCatalog);
    });
  } catch (_) {}
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
  // تب پیش‌فاکتور: همیشه مسئول فعلی مرکز (اگر عوض شد همان جدید نشان داده شود)
  var centerOwner = _pfResolveOwnerId(_pfGetCenterOwnerId(pf.centerKey) || '');
  if (centerOwner) return centerOwner;
  var salesRaw = pf.salesOwner != null ? String(pf.salesOwner).trim() : '';
  var sales = salesRaw ? _pfResolveOwnerId(salesRaw) : '';
  if (sales) return sales;
  return _pfResolveOwnerId(pf.createdBy || '');
}

function _pfGetInvoiceOwnerId(pf) {
  if (!pf) return '';
  return _pfResolveOwnerId(pf.invoiceCommissionOwner || '');
}

function _pfGetInvoiceOwnerName(pf) {
  if (!pf) return '';
  if (pf.invoiceCommissionOwnerName) return pf.invoiceCommissionOwnerName;
  var id = _pfGetInvoiceOwnerId(pf);
  return id ? _pfCreatorName(id) : '';
}

function _pfOwnerCellHtml(pf) {
  var centerName = _pfGetResponsibleName(pf);
  if (pf.status === 'invoiced' && (pf.invoiceCommissionOwner || pf.invoiceNo)) {
    var invName = _pfGetInvoiceOwnerName(pf) || '—';
    return '<div style="line-height:1.35">'
      + '<div title="مالک فاکتور در لحظه صدور (فریز شده)">'
      + '<span style="font-size:9px;color:#0369a1;font-weight:700">مالک فاکتور</span><br>'
      + '<strong style="font-size:12px;color:#0f172a">' + esc(invName) + '</strong>'
      + (pf.invoiceNo ? '<div style="font-size:9px;color:#94a3b8;font-family:monospace;margin-top:1px">' + esc(pf.invoiceNo) + '</div>' : '')
      + '</div>'
      + '<div style="margin-top:5px;padding-top:4px;border-top:1px dashed #e2e8f0" title="مسئول فعلی مرکز">'
      + '<span style="font-size:9px;color:#64748b">مسئول مرکز</span><br>'
      + '<span style="font-size:11px;color:#475569">' + esc(centerName || '—') + '</span>'
      + '</div></div>';
  }
  return '<span title="مسئول فعلی مرکز">' + esc(centerName || 'نامشخص') + '</span>';
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
          String(_pfDisplayCatalogCode(it) || '') === prodF ||
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
             fNorm(_pfDisplayCatalogCode(it) || '').indexOf(qn) !== -1 ||
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
    var key = _pfWmsCatalogCode(p) || String(p.id || '');
    if (!key || _pfIsWmsInternalId(key)) {
      key = _pfWmsCatalogCode(p);
      if (!key) return;
    }
    addProd(key, (p.full_name || p.name || key) + (_pfWmsCatalogCode(p) ? ' · ' + _pfWmsCatalogCode(p) : ''));
  });
  (_pfList || []).forEach(function(pf) {
    (pf.items || []).forEach(function(it) {
      var key = _pfDisplayCatalogCode(it) || String(it.name || '');
      if (key) addProd(key, (it.name || key) + (_pfDisplayCatalogCode(it) ? ' · ' + _pfDisplayCatalogCode(it) : ''));
    });
  });
  return out.sort(function(a, b) { return a.label.localeCompare(b.label, 'fa'); });
}

function _pfClearFilters() {
  _pfSearch = '';
  _pfOwnerF = '';
  _pfCatF = '';
  _pfProdF = '';
  _pfFilter = 'all';
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
  else _pfRefreshListDom();
}

function _pfSyncFiltersFromDom() {
  var si = document.getElementById('pfSearchInp');
  var so = document.getElementById('pfOwnerSel');
  var sc = document.getElementById('pfCatSel');
  var sp = document.getElementById('pfProdSel');
  var ss = document.getElementById('pfStatusSel');
  if (si) _pfSearch = si.value;
  if (so) _pfOwnerF = so.value;
  if (sc) _pfCatF = sc.value;
  if (sp) _pfProdF = sp.value;
  if (ss && ss.value) _pfFilter = ss.value;
}

function _pfToggleExpand(id) {
  _pfExpanded[id] = !_pfExpanded[id];
  _pfRefreshListDom();
}

function _pfBuildRowsHtml(pageItems) {
  return pageItems.map(function(pf) {
    var actions = _pfActions(pf);
    var isExpanded = !!_pfExpanded[pf.id];
    var commBadge = pf.hasCommission ? '<span style="display:inline-block;margin-right:4px;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">💸 پورسانت ' + (pf.commissionAmt ? fmtNum(pf.commissionAmt) + ' ﷼' : '') + '</span>' : '';
    var verBadge = pf.versions && pf.versions.length ? '<span style="background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;border-radius:10px;padding:1px 6px;font-size:10px" title="' + pf.versions.length + ' نسخه قبلی">' + pf.versions.length + 'v</span>' : '';
    var respName = _pfGetResponsibleName(pf);
    var expDate = pf.expiryDate || (typeof _pfComputeExpiry === 'function' ? _pfComputeExpiry(pf) : '');
    var expHint = (expDate && ['sent','negotiating','draft','awaiting_customer'].includes(pf.status))
      ? '<div style="font-size:10px;color:#b45309;margin-top:2px" title="تاریخ انقضا">⏳ ' + esc(expDate) + '</div>' : '';
    var lossHint = (pf.status === 'rejected' && pf.lossReason)
      ? '<div style="font-size:10px;color:#b91c1c;margin-top:2px" title="' + esc(pf.rejectSource || '') + '">' +
        esc((typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS[pf.lossReason] : pf.lossReason) || '') +
        (pf.rejectSource === 'customer_lost' ? ' · عدم خرید مشتری' : (pf.rejectSource === 'manager' ? ' · رد مدیر' : '')) +
        '</div>' : '';
    var mainRow = '<tr style="border-bottom:none;transition:background .15s" ' +
      'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">' +
      '<td class="pf-col-no" style="padding:10px 12px">' +
        '<button onclick="_pfToggleExpand(\'' + pf.id + '\')" style="background:none;border:none;cursor:pointer;color:#64748b;font-size:13px;margin-left:4px;padding:0 4px" title="' + (isExpanded?'بستن':'نمایش کالاها') + '">' + (isExpanded?'▼':'▶') + '</button>' +
        '<span style="font-family:monospace;font-size:12px;color:#0284c7;font-weight:700">' + esc(pf.no) + '</span>' +
        (verBadge ? ' ' + verBadge : '') +
      '</td>' +
      '<td class="pf-col-date" style="padding:10px 12px;font-size:12px;color:#475569">' + esc(pf.jalaliDate || '') + expHint + '</td>' +
      '<td class="pf-center-cell" style="padding:10px 12px">' +
        (pf.centerKey
          ? '<div class="pf-center-name link" title="' + esc(pf.centerName || '') + '" onclick="pfCenterClick(' + (_pfCenterMap.push({key:pf.centerKey,name:pf.centerName||''}) - 1) + ')">' + esc(pf.centerName || '\u2014') + '</div>'
          : '<div class="pf-center-name" title="' + esc(pf.centerName || '') + '">' + esc(pf.centerName || '\u2014') + '</div>') +
        commBadge +
      '</td>' +
      '<td class="pf-col-items" style="padding:10px 12px;font-size:12px;color:#64748b">' + ((pf.items||[]).length) + ' ردیف</td>' +
      '<td class="pf-col-amt" style="padding:10px 12px;font-family:monospace;font-size:13px;color:#1e293b;font-weight:600">' + fmtNum(pf.total) + ' ﷼</td>' +
      '<td class="pf-col-owner" style="padding:10px 12px;font-size:12px" title="' + esc(respName) + '">' + _pfOwnerCellHtml(pf) + '</td>' +
      '<td class="pf-col-acts" style="padding:8px 10px">' + actions + '</td>' +
      '</tr>' +
      '<tr class="pf-status-bar-row"><td colspan="7" class="pf-status-bar-cell">' +
        _pfUnifiedStatusBarHtml(pf) + lossHint +
      '</td></tr>';

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
                '<td style="padding:5px 10px;font-family:monospace;color:#0284c7">' + esc(_pfDisplayCatalogCode(it) || '—') + '</td>' +
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

      expandRow = '<tr><td colspan="7" style="padding:0 0 8px 32px;background:#f8fbff;border-bottom:1px solid #e2e8f0">' +
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
  tbody.innerHTML = pageItems.length ? _pfBuildRowsHtml(pageItems) : '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">پیشفاکتوری یافت نشد</td></tr>';
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

  var ownerOpts = '<option value="">همه کارشناسان</option>' +
    members.map(function(m) {
      return '<option value="' + esc(m.id) + '"' + (_pfOwnerF === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }).join('');

  var statusOpts = '<option value="all"' + (_pfFilter === 'all' ? ' selected' : '') + '>همه وضعیت‌ها</option>' +
    ['draft','awaiting_customer','pending_disc','sent','negotiating','approved','rejected','cancelled','invoiced','expired'].map(function(s) {
      var cnt = _pfList.filter(function(p){ return p.status === s; }).length;
      return '<option value="' + s + '"' + (_pfFilter === s ? ' selected' : '') + '>' +
        esc(_pfStatusShort(s)) + (cnt ? ' (' + cnt + ')' : '') + '</option>';
    }).join('');

  var searchBar =
    '<div id="pfSearchBar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px">' +
      '<input id="pfSearchInp" type="text" placeholder="🔍 جستجو: مرکز، کالا، دسته، مسئول..." value="' + esc(_pfSearch) + '" ' +
        'oninput="_pfOnSearchInput(this.value)" ' +
        'style="flex:1;min-width:180px;padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:13px;outline:none" autocomplete="off">' +
      '<select id="pfStatusSel" onchange="_pfOnStatusFilter(this.value)" title="وضعیت" ' +
        'style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:12px;min-width:140px;max-width:180px;font-weight:600">' +
        statusOpts +
      '</select>' +
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
      '<button id="pfClearFiltersBtn" onclick="typeof _pfClearAllFilters===\'function\'?_pfClearAllFilters():_pfClearFilters()" style="padding:6px 12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;' + ((_pfSearch||_pfOwnerF||_pfCatF||_pfProdF||(_pfFilter&&_pfFilter!=='all'))?'':'display:none') + '">✕ پاک</button>' +
      '<span id="pfListCount" style="font-size:12px;color:#94a3b8;white-space:nowrap">' + filtered.length + ' \u067eیش‌\u0641ا\u06a9\u062a\u0648\u0631</span>' +
    '</div>';

  _pfCenterMap = [];
  var rows = pageItems.length ? _pfBuildRowsHtml(pageItems) : '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">پیشفاکتوری یافت نشد</td></tr>';

  el.innerHTML = _pfStatsBarHtml() + _pfFlowLegendHtml() + _pfBuildPendingQueueHtml() +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        '<button onclick="pfOpenNew()" style="padding:8px 16px;background:var(--brand);color:white;border:none;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:600">+ \u067e\u06cc\u0634\u0641\u0627\u06a9\u062a\u0648\u0631 \u062c\u062f\u06cc\u062f</button>' +
(isManager ? '<button onclick="pfManageTemplates()" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer" title="\u0645\u062f\u06cc\u0631\u06cc\u062a \u0642\u0627\u0644\u0628\u200c\u0647\u0627\u06cc \u0686\u0627\u067e">\ud83c\udfa8 \u0642\u0627\u0644\u0628\u200c\u0647\u0627\u06cc \u0686\u0627\u067e</button>' +
                     '<button onclick="pfOpenSellerEditor()" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer" title="\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0645\u0634\u062e\u0635\u0627\u062a \u0641\u0631\u0648\u0634\u0646\u062f\u0647">\ud83c\udfe2 \u0641\u0631\u0648\u0634\u0646\u062f\u0647</button>' : '') +
      '</div>' +
    '</div>' +
    searchBar +
    '<div class="pf-list-wrap">' +
      '<table class="pf-list-table" style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th class="pf-col-no" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0634\u0645\u0627\u0631\u0647</th>' +
          '<th class="pf-col-date" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u062a\u0627\u0631\u06cc\u062e</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0645\u0631\u06a9\u0632 / \u0645\u0634\u062a\u0631\u06cc</th>' +
          '<th class="pf-col-items" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u06a9\u0627\u0644\u0627\u0647\u0627</th>' +
          '<th class="pf-col-amt" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">\u0645\u0628\u0644\u063a \u06a9\u0644</th>' +
          '<th class="pf-col-owner" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">مسئول / مالک فاکتور</th>' +
          '<th class="pf-col-acts" style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0;min-width:240px">مراحل / عملیات</th>' +
        '</tr></thead>' +
        '<tbody id="pfListTbody">' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div id="pfListMoreWrap" class="pf-list-more">' +
      (hasMore ? '<button onclick="_pfLoadMore()" style="padding:8px 24px;border:1px solid var(--brand);background:white;color:var(--brand);border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer">\u2b07 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0628\u06cc\u0634\u062a\u0631 (' + (filtered.length - pageItems.length) + ' \u0645\u0648\u0631\u062f \u062f\u06cc\u06af\u0631)</button>' : '') +
    '</div>';

  /* wrap into full-height layout */
  el.innerHTML = '<div class="pf-panel-layout">' + el.innerHTML + '</div>';
}

function _badgeBg(s) {
  return { draft:'#f1f5f9', awaiting_customer:'#fef9c3', sent:'#eff6ff', negotiating:'#fef3c7', pending_disc:'#ffedd5', approved:'#dcfce7', rejected:'#fee2e2', cancelled:'#fff7ed', invoiced:'#e0f2fe', expired:'#fce7f3' }[s] || '#f1f5f9';
}
function _badgeFg(s) {
  return { draft:'#475569', awaiting_customer:'#a16207', sent:'#1d4ed8', negotiating:'#b45309', pending_disc:'#c2410c', approved:'#15803d', rejected:'#b91c1c', cancelled:'#c2410c', invoiced:'#0369a1', expired:'#be185d' }[s] || '#475569';
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

var _pfQueueExpanded = {}; // sectionKey → true = show all

function _pfExpandQueue(sectionKey) {
  _pfQueueExpanded[sectionKey] = true;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}
function _pfCollapseQueue(sectionKey) {
  _pfQueueExpanded[sectionKey] = false;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}
window._pfExpandQueue = _pfExpandQueue;
window._pfCollapseQueue = _pfCollapseQueue;

/** کارت‌های صف اقدام: پیش‌فرض ۵ مورد + اسکرول؛ «نمایش همه» برای بقیه */
function _pfQueueCardsBlock(sectionKey, cardsArr, opts) {
  opts = opts || {};
  var limit = opts.limit || 5;
  var maxH = opts.maxH || 280;
  if (!cardsArr || !cardsArr.length) return '';
  var total = cardsArr.length;
  var expanded = !!_pfQueueExpanded[sectionKey];
  var shown = expanded ? cardsArr : cardsArr.slice(0, limit);
  var moreBtn = '';
  if (total > limit) {
    moreBtn = expanded
      ? '<button type="button" onclick="_pfCollapseQueue(\'' + sectionKey + '\')" style="width:100%;margin-top:6px;padding:6px;border:1px dashed #94a3b8;border-radius:8px;background:transparent;color:#64748b;font-size:11px;font-family:inherit;cursor:pointer">▴ جمع کردن</button>'
      : '<button type="button" onclick="_pfExpandQueue(\'' + sectionKey + '\')" style="width:100%;margin-top:6px;padding:6px;border:1px dashed #64748b;border-radius:8px;background:rgba(255,255,255,.6);color:#334155;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600">▾ نمایش همه (' + total + ') — +' + (total - limit) + ' مورد</button>';
  }
  var scrollStyle = expanded
    ? 'max-height:' + Math.max(maxH, 360) + 'px;overflow-y:auto;padding-left:2px'
    : (total > limit ? '' : (total > 3 ? 'max-height:' + maxH + 'px;overflow-y:auto;padding-left:2px' : ''));
  return '<div style="' + scrollStyle + '">' + shown.join('') + '</div>' + moreBtn;
}

function _pfQueueCardShell(border, titleHtml, metaHtml, actionsHtml) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:white;border:1px solid ' + border + ';border-radius:8px;margin-bottom:6px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:180px">' +
      '<div style="font-weight:700;font-size:13px;color:#0f172a">' + titleHtml + '</div>' +
      '<div style="font-size:11px;color:#64748b;margin-top:2px">' + metaHtml + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' + actionsHtml + '</div></div>';
}

function _pfBuildPendingQueueHtml() {
  var isManager = typeof _isManager === 'function' && _isManager();
  // فقط مراحل اقدام عملیاتی: تأیید مدیر / حواله / صدور فاکتور — نه تایید مشتری و نه تخفیف
  var mgrPending = isManager
    ? _pfList.filter(function(p) { return p.status === 'sent' || p.status === 'negotiating'; })
    : [];
  var opsPending = _pfList.filter(function(p) {
    if (p.status !== 'approved') return false;
    return isManager || p.createdBy === currentUser;
  });
  if (!mgrPending.length && !opsPending.length) return '';

  var mgrCards = mgrPending.map(function(pf) {
    return _pfQueueCardShell(
      '#bfdbfe',
      '<span style="color:#1e40af">' + esc(pf.no) + ' — ' + esc(pf.centerName || '—') + '</span>',
      'ثبت‌کننده: ' + esc(_pfCreatorName(pf.createdBy)) +
        ' · مسئول: ' + esc(_pfGetCenterOwner(pf.centerKey)) +
        ' · <strong>' + fmtNum(pf.total) + ' ﷼</strong>' +
        (pf.status === 'negotiating' ? ' · <span style="color:#b45309">مذاکره</span>' : ''),
      '<button onclick="pfOpenEdit(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-family:inherit">👁️ مشاهده</button>' +
      '<button onclick="pfAction(\'' + pf.id + '\',\'approve\')" style="padding:4px 10px;font-size:11px;border:1px solid #16a34a;border-radius:6px;background:#f0fdf4;color:#15803d;cursor:pointer;font-family:inherit;font-weight:600">✅ تأیید</button>' +
      '<button onclick="pfReject(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #dc2626;border-radius:6px;background:#fef2f2;color:#b91c1c;cursor:pointer;font-family:inherit">❌ رد</button>'
    );
  });

  var opsCards = opsPending.map(function(pf) {
    var acts =
      '<button onclick="pfOpenEdit(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-family:inherit">👁️ مشاهده</button>' +
      '<button onclick="pfIssueDispatch(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #7c3aed;border-radius:6px;background:#f5f3ff;color:#6d28d9;cursor:pointer;font-family:inherit;font-weight:600">📦 صدور حواله</button>' +
      (isManager
        ? '<button onclick="pfIssueInvoice(\'' + pf.id + '\')" style="padding:4px 10px;font-size:11px;border:1px solid #0891b2;border-radius:6px;background:#ecfeff;color:#0e7490;cursor:pointer;font-family:inherit;font-weight:600">🧾 صدور فاکتور</button>'
        : '');
    return _pfQueueCardShell(
      '#c4b5fd',
      '<span style="color:#5b21b6">' + esc(pf.no) + ' — ' + esc(pf.centerName || '—') + '</span>',
      'ثبت‌کننده: ' + esc(_pfCreatorName(pf.createdBy)) +
        ' · <strong>' + fmtNum(pf.total) + ' ﷼</strong> · تأیید شده — آماده حواله / فاکتور',
      acts
    );
  });

  var sections = '';
  if (mgrPending.length) {
    sections += '<div style="margin-bottom:12px">' +
      '<div style="font-weight:700;font-size:13px;color:#1d4ed8;margin-bottom:8px">🧑‍💼 تأیید مدیر ' +
      '<span style="background:#1d4ed8;color:white;border-radius:10px;padding:2px 8px;font-size:11px;margin-right:6px">' + mgrPending.length + '</span></div>' +
      _pfQueueCardsBlock('mgr', mgrCards) + '</div>';
  }
  if (opsPending.length) {
    sections += '<div style="margin-bottom:4px">' +
      '<div style="font-weight:700;font-size:13px;color:#6d28d9;margin-bottom:8px">📦 حواله و 🧾 صدور فاکتور ' +
      '<span style="background:#6d28d9;color:white;border-radius:10px;padding:2px 8px;font-size:11px;margin-right:6px">' + opsPending.length + '</span></div>' +
      _pfQueueCardsBlock('ops', opsCards) + '</div>';
  }

  var totalN = mgrPending.length + opsPending.length;
  return '<div style="margin-bottom:14px;background:linear-gradient(135deg,#f8fafc,#eff6ff);border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px">' +
    '<div style="font-weight:700;font-size:14px;color:#1e3a8a;margin-bottom:12px">⚡ صف اقدام عملیاتی ' +
    '<span style="background:#1e3a8a;color:white;border-radius:10px;padding:2px 8px;font-size:11px;margin-right:6px">' + totalN + '</span>' +
    '<span style="font-weight:500;font-size:11px;color:#64748b;margin-right:8px">تأیید مدیر · حواله · فاکتور</span></div>' +
    sections +
    '</div>';
}

// ── Filter setter ─────────────────────────────────────────────────────────
function _pfLoadMore() {
  _pfPage++;
  _pfRefreshListDom();
}

function _pfSetFilter(f) {
  _pfFilter = f || 'all';
  _pfPage = 0;
  var el = _pfRoot();
  if (el) _renderPfPanel(el);
}

function _pfOnStatusFilter(v) {
  _pfSetFilter(v || 'all');
}

// ── Action buttons per row (labeled primary CTA + compact secondary) ───────
function _pfActBtn(onclick, icon, title, cls, opts) {
  opts = opts || {};
  var label = opts.label || '';
  var classes = 'pf-act-btn' + (cls ? ' ' + cls : '') + (label ? ' labeled' : '');
  return '<button type="button" class="' + classes +
    '" onclick="' + onclick + '" title="' + esc(title || label) + '">' +
    (icon ? '<span class="pf-act-ico" aria-hidden="true">' + icon + '</span>' : '') +
    (label ? '<span class="pf-act-txt">' + esc(label) + '</span>' : '') +
    '</button>';
}

function _pfActMenuItem(onclick, icon, label) {
  return '<button type="button" class="pf-acts-menu-item" onclick="pfCloseActsMenu();' + onclick + '">' +
    '<span>' + icon + '</span><span>' + label + '</span></button>';
}

function pfCloseActsMenu() {
  var m = document.getElementById('pfActsFloatMenu');
  if (m) m.remove();
  document.querySelectorAll('.pf-acts-more-btn.is-open').forEach(function(b) {
    b.classList.remove('is-open');
  });
  if (window._pfActsMenuCloser) {
    document.removeEventListener('click', window._pfActsMenuCloser, true);
    document.removeEventListener('keydown', window._pfActsMenuEsc, true);
    window.removeEventListener('scroll', window._pfActsMenuScroll, true);
    window.removeEventListener('resize', window._pfActsMenuScroll, true);
    window._pfActsMenuCloser = null;
  }
}

function pfOpenActsMenu(ev, pfId) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var btn = ev && ev.currentTarget ? ev.currentTarget : null;
  var existing = document.getElementById('pfActsFloatMenu');
  if (existing && btn && btn.classList.contains('is-open')) {
    pfCloseActsMenu();
    return;
  }
  pfCloseActsMenu();

  var pf = (_pfList || []).find(function(p) { return p.id === pfId; });
  if (!pf || !btn) return;

  var more = _pfCollectMoreActions(pf);
  if (!more.length) return;

  var menu = document.createElement('div');
  menu.id = 'pfActsFloatMenu';
  menu.className = 'pf-acts-float-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = more.join('');
  document.body.appendChild(menu);
  btn.classList.add('is-open');

  var r = btn.getBoundingClientRect();
  var mw = menu.offsetWidth || 180;
  var mh = menu.offsetHeight || 120;
  var left = r.left;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (left < 8) left = 8;
  var top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = r.top - mh - 6;
  if (top < 8) top = 8;
  menu.style.left = Math.round(left) + 'px';
  menu.style.top = Math.round(top) + 'px';

  window._pfActsMenuCloser = function(e) {
    if (!e.target.closest || (!e.target.closest('#pfActsFloatMenu') && !e.target.closest('.pf-acts-more-btn'))) {
      pfCloseActsMenu();
    }
  };
  window._pfActsMenuEsc = function(e) {
    if (e.key === 'Escape') pfCloseActsMenu();
  };
  window._pfActsMenuScroll = function() { pfCloseActsMenu(); };
  setTimeout(function() {
    document.addEventListener('click', window._pfActsMenuCloser, true);
    document.addEventListener('keydown', window._pfActsMenuEsc, true);
    window.addEventListener('scroll', window._pfActsMenuScroll, true);
    window.addEventListener('resize', window._pfActsMenuScroll, true);
  }, 0);
}

function _pfCollectMoreActions(pf) {
  var more = [];
  var isManager = _isManager();
  var isSuperAdmin = _pfIsSuperAdmin();

  if (pf.centerKey) {
    more.push(_pfActMenuItem('pfScheduleFollowup(\'' + pf.id + '\')', '📅', 'برنامه هفته'));
  }
  more.push(_pfActMenuItem('pfCreateTask(\'' + pf.id + '\')', '📌', 'ساخت وظیفه'));
  more.push(_pfActMenuItem('pfOpenTimeline(\'' + pf.id + '\')', '🕐', 'تایم‌لاین'));
  if (pf.versions && pf.versions.length) {
    more.push(_pfActMenuItem('pfShowVersions(\'' + pf.id + '\')', '📚', 'نسخه‌ها (' + pf.versions.length + ')'));
  }
  if ((isManager || pf.createdBy === currentUser) && pf.status === 'sent') {
    more.push(_pfActMenuItem('pfAction(\'' + pf.id + '\',\'negotiate\')', '💬', 'مذاکره'));
  }
  if (['approved','invoiced'].includes(pf.status)) {
    more.push(_pfActMenuItem('pfIssueDispatch(\'' + pf.id + '\')', '📦', 'صدور حواله'));
  }
  if (isManager && pf.status === 'approved') {
    more.push(_pfActMenuItem('pfIssueInvoice(\'' + pf.id + '\')', '🧾', 'صدور فاکتور'));
  }
  if (['rejected','cancelled','expired'].includes(pf.status) && (isManager || pf.createdBy === currentUser)) {
    more.push(_pfActMenuItem('pfAction(\'' + pf.id + '\',\'reopen\')', '🔓', 'بازگشایی'));
  }
  if (isSuperAdmin) {
    more.push(_pfActMenuItem('pfOpenRollback(\'' + pf.id + '\')', '↩', 'تغییر وضعیت (همه مراحل)'));
  }
  if (isSuperAdmin || (['draft','cancelled'].includes(pf.status) && (isManager || pf.createdBy === currentUser))) {
    more.push(_pfActMenuItem('pfDelete(\'' + pf.id + '\')', '🗑️', 'حذف'));
  }
  return more;
}

function _pfActions(pf) {
  var primary = [];
  var isManager = _isManager();
  var isSuperAdmin = _pfIsSuperAdmin();

  var canEdit = (pf.status === 'draft' && (isManager || pf.createdBy === currentUser)) || isSuperAdmin;
  primary.push(_pfActBtn(
    'pfOpenEdit(\'' + pf.id + '\')',
    canEdit ? '✏️' : '👁️',
    canEdit ? 'ویرایش پیش‌فاکتور' : 'مشاهده پیش‌فاکتور',
    'info'
  ));
  primary.push(_pfActBtn('pfPrint(\'' + pf.id + '\')', '🖨️', 'چاپ'));

  if (pf.centerKey) {
    primary.push(_pfActBtn('pfAddToToday(\'' + pf.id + '\')', '➕', 'افزودن به برنامه امروز', 'ok'));
    if (['sent', 'negotiating', 'approved', 'pending_disc', 'invoiced', 'awaiting_customer'].includes(pf.status)) {
      primary.push(_pfActBtn('pfOpenOutcomeModal(\'' + pf.id + '\',\'followup\')', '🔄', 'ثبت پیگیری', 'info'));
    }
  }

  if (['approved', 'invoiced'].includes(pf.status)) {
    primary.push(_pfActBtn('pfOpenFulfillment(\'' + pf.id + '\')', '📦', 'عملیات انبار و مالی', 'info'));
  }

  var more = _pfCollectMoreActions(pf);
  var tools = '<span class="row-acts pf-acts">' + primary.join('');
  if (more.length) {
    tools += '<button type="button" class="pf-act-btn pf-acts-more-btn" title="سایر عملیات" ' +
      'onclick="pfOpenActsMenu(event,\'' + pf.id + '\')">⋯</button>';
  }
  tools += '</span>';
  return '<div class="pf-acts-col">' +
    _pfStageNavHtml(pf) +
    '<div class="pf-acts-tools">' + tools + '</div>' +
  '</div>';
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

async function pfOpenFulfillment(pfId) {
  var pf = _pfList.find(function(p){ return p.id === pfId; });
  if (!pf) return;
  try {
    var r = await fetch('/api/proforma/' + encodeURIComponent(pfId) + '/fulfillment', { credentials: 'same-origin' });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا در دریافت عملیات')); return; }
    var dispatches = (data.warehouse && data.warehouse.dispatches) || [];
    var wh = dispatches.length
      ? dispatches.map(function(d){ return '<li>' + esc(d.txn_no || d.id) + ' — <strong>' + esc(d.status === 'pending' ? 'در انتظار تأیید انبار' : d.status || '') + '</strong></li>'; }).join('')
      : '<li>هنوز حواله‌ای ایجاد نشده است.</li>';
    var inv = data.finance && data.finance.invoice;
    var finance = inv
      ? '<strong style="color:#15803d">فاکتور ' + esc(inv.invoice_no || inv.id) + ' صادر شده است.</strong>'
      : '<span style="color:#b45309">در انتظار صدور فاکتور توسط واحد مالی</span>';
    var issue = (!inv && pf.status === 'approved' && _pfCanIssueInvoice())
      ? '<button onclick="closeModal(\'pfFulfillmentModal\');pfIssueInvoice(\'' + pfId + '\')" style="margin-top:10px;padding:7px 12px;background:#15803d;color:#fff;border:0;border-radius:7px;font-family:inherit;cursor:pointer">صدور فاکتور</button>' : '';
    openModal('pfFulfillmentModal', 'عملیات پس از تأیید مدیر — ' + esc(pf.no || ''),
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<section style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:12px"><strong>📦 کارتابل انبار</strong><p style="font-size:12px;color:#475569">حواله‌های خروج منتظر تأیید انبار:</p><ul style="font-size:12px;padding-right:18px;line-height:1.9">' + wh + '</ul></section>' +
      '<section style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:12px"><strong>🧾 کارتابل مالی</strong><p style="font-size:12px;margin-top:10px">' + finance + '</p>' + issue + '</section></div>',
      '<button onclick="closeModal(\'pfFulfillmentModal\')" style="padding:8px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;font-family:inherit;cursor:pointer">بستن</button>', { lg: true });
  } catch (e) { showToast('❌ ' + e.message); }
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
    var labels = {
      send: 'ارسال شد — الان مرحله «منتظر تایید مشتری» است',
      approve: 'تأیید مدیر ثبت شد — می‌توانید حواله/فاکتور صادر کنید',
      reject: 'رد شد',
      cancel: 'لغو شد',
      reopen: 'بازگشایی شد — دوباره پیش‌نویس است',
      negotiate: 'رفت به مذاکره',
      expire: 'منقضی شد',
      approve_disc: 'تخفیف تأیید شد — منتظر تایید مشتری',
      reject_disc: 'تخفیف رد شد — برگشت به پیش‌نویس',
      rollback: 'وضعیت دستی تغییر کرد',
      customer_confirm: 'تایید مشتری ثبت شد — الان منتظر تأیید مدیر است',
      customer_revise: 'برگشت به پیش‌نویس — نیاز به اصلاح',
      customer_decline: 'عدم خرید ثبت شد — علت در مرکز ذخیره شد',
    };
    var msg = '✅ پیشفاکتور ' + (labels[action] || action);
    if (action === 'approve') {
      msg += ' — برای صدور حواله دکمه «📦 صدور حواله» را بزنید';
    }
    showToast(msg);
  } catch(e) {
    showToast('❌ خطا: ' + e.message);
  }
}

function pfOpenRollback(id) {
  if (!_pfIsSuperAdmin()) { showToast('❌ فقط سوپر ادمین'); return; }
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  var cur = pf.status;
  var curLabel = _pfStatusLabel(cur);

  function stageCard(fs, i, total) {
    var k = fs.key;
    var isCur = k === cur;
    var lbl = fs.label || _pfStatusLabel(k);
    var short = _pfStatusShort(k);
    var hint = fs.hint || '';
    var cls = 'pf-rb-stage' + (isCur ? ' current' : ' pickable');
    var onclick = isCur ? '' : ' onclick="_pfPickRollbackStage(\'' + k + '\')"';
    var badge = isCur ? '<span class="pf-rb-now">فعلی</span>' : '';
    var num = fs.icon && fs.icon.length <= 2 ? fs.icon : String(i + 1);
    return '<button type="button" class="' + cls + '"' + onclick + ' data-st="' + k + '"' + (isCur ? ' disabled' : '') + '>' +
      '<span class="pf-rb-num" style="background:' + _badgeBg(k) + ';color:' + _badgeFg(k) + '">' + num + '</span>' +
      '<span class="pf-rb-txt"><strong>' + esc(short) + '</strong>' +
      '<span class="pf-rb-full">' + esc(lbl) + '</span>' +
      (hint ? '<span class="pf-rb-hint">' + esc(hint) + '</span>' : '') +
      '</span>' + badge + '</button>' +
      (i < total - 1 ? '<div class="pf-rb-arrow" aria-hidden="true">←</div>' : '');
  }

  var mainHtml = PF_FLOW_STAGES.map(function(fs, i) {
    return stageCard(fs, i, PF_FLOW_STAGES.length);
  }).join('');

  var sideHtml = PF_FLOW_SIDE.map(function(fs) {
    var k = fs.key;
    var isCur = k === cur;
    return '<button type="button" class="pf-rb-side' + (isCur ? ' current' : '') + '"' +
      (isCur ? ' disabled' : ' onclick="_pfPickRollbackStage(\'' + k + '\')"') +
      ' data-st="' + k + '" style="border-color:' + _badgeBg(k) + '">' +
      '<strong style="color:' + _badgeFg(k) + '">' + esc(fs.label || _pfStatusShort(k)) + '</strong>' +
      '<span>' + esc(fs.hint || _pfStatusLabel(k)) + '</span></button>';
  }).join('');

  var sideNote = '';
  if (cur === 'pending_disc' || cur === 'negotiating') {
    sideNote = '<div class="pf-rb-side-active">وضعیت فعلی در مسیر فرعی است — می‌توانید به مسیر اصلی یا هر مرحله دیگر بروید.</div>';
  }

  var warn = '';
  if (cur === 'invoiced') {
    warn = '<div class="pf-rb-warn danger">خروج از «فاکتور شده» → فاکتورهای صادرشدهٔ مرتبط لغو می‌شوند.</div>';
  } else if (cur === 'approved') {
    warn = '<div class="pf-rb-warn">تغییر بعد از تأیید مدیر در تایم‌لاین ثبت می‌شود.</div>';
  }

  openModal('pfRollbackModal', '↩ تغییر وضعیت ورک‌فلو — ' + (pf.no || id),
    '<div class="pf-rb-modal">' +
      '<div class="pf-rb-meta">وضعیت فعلی: <strong style="color:' + _badgeFg(cur) + '">' + esc(curLabel) + '</strong>' +
        ' · مسیر اصلی همان ۵ مرحله نوار وضعیت لیست — مسیرهای فرعی در بخش پایین</div>' +
      warn + sideNote +
      '<div class="pf-rb-section-title">مسیر اصلی: پیش‌فاکتور → فاکتور</div>' +
      '<div class="pf-rb-track pf-rb-track-main">' + mainHtml + '</div>' +
      '<div class="pf-rb-section-title">مسیرهای فرعی / کناری</div>' +
      '<div class="pf-rb-sides">' + sideHtml + '</div>' +
      '<input type="hidden" id="pfRollbackTo" value="">' +
      '<div class="pf-rb-selected" id="pfRollbackSelected">مرحلهٔ مقصد را از بالا انتخاب کنید</div>' +
      '<div style="margin-top:10px"><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">دلیل تغییر وضعیت *</label>' +
      '<textarea id="pfRollbackNote" rows="3" class="form-input" placeholder="دلیل برگرداندن / جلو بردن وضعیت..." style="resize:vertical;width:100%"></textarea></div>' +
    '</div>',
    '<button onclick="closeModal(\'pfRollbackModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>' +
    '<button onclick="_pfDoRollback(\'' + id + '\')" style="padding:8px 18px;background:#7c3aed;color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">↩ تأیید تغییر وضعیت</button>',
    { lg: true }
  );
}

function _pfPickRollbackStage(st) {
  var inp = document.getElementById('pfRollbackTo');
  if (inp) inp.value = st;
  document.querySelectorAll('.pf-rb-stage.pickable, .pf-rb-side').forEach(function(el) {
    el.classList.toggle('picked', el.getAttribute('data-st') === st);
  });
  var sel = document.getElementById('pfRollbackSelected');
  if (sel) {
    sel.innerHTML = 'مقصد انتخاب‌شده: <strong style="color:' + _badgeFg(st) + '">' + esc(_pfStatusLabel(st)) + '</strong>';
    sel.classList.add('ready');
  }
}

async function _pfDoRollback(id) {
  var toEl = document.getElementById('pfRollbackTo');
  var noteEl = document.getElementById('pfRollbackNote');
  var toStatus = toEl ? toEl.value : '';
  var note = noteEl ? noteEl.value.trim() : '';
  if (!toStatus) { showToast('❌ یک مرحله از مسیر ورک‌فلو انتخاب کنید'); return; }
  if (!note) { showToast('❌ دلیل تغییر وضعیت الزامی است'); return; }
  closeModal('pfRollbackModal');
  try {
    var r = await fetch('/api/proforma/' + id + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rollback', toStatus: toStatus, note: note }),
    });
    var data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'خطا')); return; }
    await pfLoad();
    var el = document.getElementById('pfVanillaRoot') || (typeof _pfRoot === 'function' ? _pfRoot() : null);
    if (el) _renderPfPanel(el);
    var toLabel = _pfStatusLabel(toStatus);
    showToast('✅ وضعیت به «' + toLabel + '» تغییر کرد');
  } catch (e) {
    showToast('❌ ' + e.message);
  }
}

function _pfLossReasonOptsHtml() {
  var src = typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS : {
    price_high: 'قیمت بالا', competitor: 'رقیب', need_change: 'تغییر نیاز مشتری',
    no_response: 'عدم پاسخ مشتری', other: 'سایر',
  };
  return Object.keys(src).map(function(k) {
    return '<option value="' + k + '">' + esc(src[k]) + '</option>';
  }).join('');
}

function pfCustomerOutcome(id) {
  var pf = _pfList.find(function(p) { return p.id === id; });
  var pfNo = pf ? pf.no : id;
  openModal('pfCustOutcomeModal', '👎 عدم تأیید مشتری — ' + pfNo,
    '<p style="font-size:12px;color:#64748b;margin:0 0 12px;line-height:1.6">مشتری پیش‌فاکتور را تأیید نکرد. یکی از دو حالت را انتخاب کنید:</p>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button type="button" class="pf-outcome-pick revise" onclick="pfCustomerRevise(\'' + id + '\')">' +
        '<strong>📝 نیاز به اصلاح</strong><span>برگشت به پیش‌نویس — ویرایش و ارسال مجدد</span></button>' +
      '<button type="button" class="pf-outcome-pick lost" onclick="pfCustomerDeclineForm(\'' + id + '\')">' +
        '<strong>🚫 عدم خرید (رد نهایی)</strong><span>ثبت علت باخت در مرکز — مثل پیگیری غیرفعال</span></button>' +
    '</div>',
    '<button onclick="closeModal(\'pfCustOutcomeModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>'
  );
}

function pfCustomerRevise(id) {
  closeModal('pfCustOutcomeModal');
  var note = prompt('توضیح اصلاح مورد نیاز (اختیاری):');
  if (note === null) return;
  pfAction(id, 'customer_revise', String(note).trim());
}

function pfCustomerDeclineForm(id) {
  closeModal('pfCustOutcomeModal');
  var pf = _pfList.find(function(p) { return p.id === id; });
  var pfNo = pf ? pf.no : id;
  openModal('pfCustDeclineModal', '🚫 عدم خرید — ' + pfNo,
    '<div style="margin-bottom:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#991b1b;line-height:1.5">' +
      'این مورد <strong>رد نهایی</strong> است — علت در پروفایل مرکز و گزارش‌ها ذخیره می‌شود.</div>' +
    '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px">علت عدم خرید *</label>' +
    '<select id="pfCustLossReason" class="form-input" style="width:100%">' + _pfLossReasonOptsHtml() + '</select></div>' +
    '<div id="pfCustLossCompWrap" style="margin-bottom:10px;display:none"><label style="font-size:12px;color:#475569;display:block;margin-bottom:4px">نام رقیب</label>' +
    '<input id="pfCustLossCompetitor" class="form-input" placeholder="نام رقیب"></div>' +
    '<textarea id="pfCustDeclineNote" rows="2" class="form-input" placeholder="توضیح تکمیلی..." style="resize:vertical"></textarea>',
    '<button onclick="closeModal(\'pfCustDeclineModal\')" style="padding:8px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">انصراف</button>' +
    '<button onclick="_pfDoCustomerDecline(\'' + id + '\')" style="padding:8px 18px;background:#dc2626;color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">ثبت عدم خرید</button>'
  );
  setTimeout(function() {
    var sel = document.getElementById('pfCustLossReason');
    var wrap = document.getElementById('pfCustLossCompWrap');
    if (sel && wrap) sel.onchange = function() { wrap.style.display = sel.value === 'competitor' ? '' : 'none'; };
  }, 50);
}

async function _pfDoCustomerDecline(id) {
  var reasonEl = document.getElementById('pfCustLossReason');
  var compEl = document.getElementById('pfCustLossCompetitor');
  var noteEl = document.getElementById('pfCustDeclineNote');
  var lossReason = reasonEl ? reasonEl.value : '';
  if (!lossReason) { showToast('❌ علت عدم خرید را انتخاب کنید'); return; }
  var note = noteEl ? noteEl.value.trim() : '';
  var lossCompetitor = compEl ? compEl.value.trim() : '';
  closeModal('pfCustDeclineModal');
  await pfAction(id, 'customer_decline', note, { lossReason: lossReason, lossCompetitor: lossCompetitor });
}

function pfReject(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  var pfNo = pf ? pf.no : id;
  var reasonOpts = Object.keys(typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS : { price_high:'قیمت بالا', competitor:'رقیب', need_change:'تغییر نیاز', no_response:'عدم پاسخ', other:'سایر' }).map(function(k) {
    var lbl = (typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS[k] : k);
    return '<option value="' + k + '">' + lbl + '</option>';
  }).join('');
  openModal('pfRejectModal', '❌ رد مدیر — ' + pfNo,
    '<div style="margin-bottom:10px;padding:8px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:11px;color:#991b1b">رد نهایی مدیر — علت در مرکز و گزارش‌ها ثبت می‌شود.</div>' +
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

function pfOpenCustomerDecision(id) {
  var pf = _pfList.find(function(p){ return p.id === id; });
  if (!pf) return;
  var reasonOpts = Object.keys(typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS : { price_high:'قیمت بالا', competitor:'رقیب', need_change:'تغییر نیاز مشتری', no_response:'عدم پاسخ', other:'سایر' }).map(function(k) {
    var labels = typeof PF_LOSS_REASONS !== 'undefined' ? PF_LOSS_REASONS : {};
    return '<option value="' + k + '">' + esc(labels[k] || k) + '</option>';
  }).join('');
  openModal('pfCustomerDecisionModal', 'پاسخ مشتری — ' + esc(pf.no || ''),
    '<p style="margin-top:0;font-size:12px;color:#475569">پاسخ مشتری را دقیق ثبت کنید تا مسیر بعدی و گزارش‌ها درست بماند.</p>' +
    '<label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">پاسخ مشتری</label><select id="pfCustomerDecisionType" class="form-input" onchange="_pfCustomerDecisionChanged()"><option value="revise">نیاز به اصلاح دارد — بازگشت به پیش‌نویس</option><option value="lost">عدم خرید نهایی</option></select>' +
    '<div id="pfCustomerLossFields" style="display:none;margin-top:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">علت عدم خرید *</label><select id="pfCustomerLossReason" class="form-input">' + reasonOpts + '</select><input id="pfCustomerLossCompetitor" class="form-input" placeholder="نام رقیب (در صورت وجود)" style="margin-top:8px"></div>' +
    '<div style="margin-top:10px"><label id="pfCustomerDecisionNoteLabel" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">شرح اصلاح درخواستی *</label><textarea id="pfCustomerDecisionNote" rows="3" class="form-input" style="width:100%;resize:vertical"></textarea></div>',
    '<button onclick="closeModal(\'pfCustomerDecisionModal\')" style="padding:8px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;font-family:inherit;cursor:pointer">انصراف</button><button onclick="pfSubmitCustomerDecision(\'' + id + '\')" style="padding:8px 16px;background:#dc2626;color:#fff;border:0;border-radius:8px;font-family:inherit;cursor:pointer">ثبت پاسخ مشتری</button>');
}

function _pfCustomerDecisionChanged() {
  var lost = document.getElementById('pfCustomerDecisionType').value === 'lost';
  document.getElementById('pfCustomerLossFields').style.display = lost ? '' : 'none';
  document.getElementById('pfCustomerDecisionNoteLabel').textContent = lost ? 'توضیح تکمیلی' : 'شرح اصلاح درخواستی *';
}

async function pfSubmitCustomerDecision(id) {
  var lost = document.getElementById('pfCustomerDecisionType').value === 'lost';
  var note = document.getElementById('pfCustomerDecisionNote').value.trim();
  if (!lost && !note) { showToast('❌ شرح اصلاح درخواستی مشتری را وارد کنید'); return; }
  var extra = {};
  if (lost) { extra.lossReason = document.getElementById('pfCustomerLossReason').value; extra.lossCompetitor = document.getElementById('pfCustomerLossCompetitor').value.trim(); }
  closeModal('pfCustomerDecisionModal');
  await pfAction(id, lost ? 'customer_reject' : 'customer_revise', note, extra);
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

/** کد کاتالوگ واقعی کالا — نه id داخلی wms_* */
function _pfWmsCatalogCode(p) {
  if (!p) return '';
  return String(p.catalogCode || p.catalog_code || '').trim();
}

function _pfIsWmsInternalId(s) {
  return /^wms_/i.test(String(s || '').trim());
}

function _pfDisplayCatalogCode(it) {
  if (!it) return '';
  var code = String(it.catalogCode || it.catalog_code || '').trim();
  if (code && !_pfIsWmsInternalId(code)) return code;
  var fromWms = _pfWmsCatalogCode(_pfWmsProdById(it.prodId));
  if (fromWms) return fromWms;
  // هرگز id داخلی انبار را به‌عنوان کد کاتالوگ نشان نده
  if (code && _pfIsWmsInternalId(code)) return '';
  return '';
}

function _pfHydrateItemCatalog(it) {
  if (!it) return it;
  var code = _pfDisplayCatalogCode(it);
  if (code) it.catalogCode = code;
  return it;
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

function _pfWmsProdById(prodId) {
  if (!prodId) return null;
  return (_pfWmsProds || []).find(function(x) { return String(x.id) === String(prodId); }) || null;
}

/** کد کاتالوگ واقعی کالا — نه id داخلی wms_* */
function _pfWmsCatalogCode(p) {
  if (!p) return '';
  return String(p.catalogCode || p.catalog_code || '').trim();
}

function _pfIsWmsInternalId(s) {
  return /^wms_/i.test(String(s || '').trim());
}

function _pfDisplayCatalogCode(it) {
  if (!it) return '';
  var code = String(it.catalogCode || it.catalog_code || '').trim();
  if (code && !_pfIsWmsInternalId(code)) return code;
  var fromWms = _pfWmsCatalogCode(_pfWmsProdById(it.prodId));
  if (fromWms) return fromWms;
  // هرگز id داخلی انبار را به‌عنوان کد کاتالوگ نشان نده
  if (code && _pfIsWmsInternalId(code)) return '';
  return '';
}

function _pfHydrateItemCatalog(it) {
  if (!it) return it;
  var code = _pfDisplayCatalogCode(it);
  if (code) it.catalogCode = code;
  return it;
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
    _pfItems  = (pf.items || []).map(function(i){ return _pfHydrateItemCatalog(Object.assign({ discPct:0, discAmt:0 }, i)); });
    if (!_pfItems.length) _pfItems = [{ prodId:'', name:'', unit:'عدد', qty:1, unitPrice:0, discPct:0, discAmt:0, lineTotal:0 }];
    _pfProdViewMode = 'tree';
    _pfProdSearch = '';
    _pfActiveCat = null;
    await _pfLoadWmsProds();
    _pfItems.forEach(_pfHydrateItemCatalog);
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
      var code = _pfWmsCatalogCode(p).toLowerCase();
      return (p.full_name || p.name || '').toLowerCase().indexOf(qn) !== -1 ||
             (code && code.indexOf(qn) !== -1) ||
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
  var codeRaw = _pfWmsCatalogCode(p);
  var code  = esc(codeRaw);
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
  var canEditWh = !pf || pf.status === 'draft' || pf.status === 'sent' || pf.status === 'awaiting_customer';
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
    (pf && pf.status ? _pfStageBannerHtml(pf) : '') +
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

  var foot = '';
  if (pf && pf.id) {
    foot += '<div class="pf-footer-nav">' + _pfStageNavHtml(pf) + '</div>';
    if (_pfIsSuperAdmin()) {
      foot += '<button onclick="pfOpenRollback(\'' + pf.id + '\')" class="pf-footer-cta purple">↩ تغییر وضعیت</button>';
    }
  }
  foot += (readOnly ? '<button onclick="pfPrint(\'' + (pf && pf.id) + '\')" class="pf-footer-cta info">🖨️ چاپ</button>' : '');
  if (pf && pf.versions && pf.versions.length) {
    foot += '<button onclick="pfShowVersions(\'' + pf.id + '\')" class="pf-footer-cta">🕐 تاریخچه (' + pf.versions.length + ')</button>';
  }
  foot += '<button onclick="var _el=document.getElementById(\'pfModal\');if(_el)_el.style.display=\'none\';" class="pf-footer-cta muted">بستن</button>';
  if (!readOnly) {
    foot += '<button onclick="pfSave()" class="pf-footer-cta primary">💾 ذخیره</button>';
  }
  document.getElementById('pfModalFooter').innerHTML = foot;

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
          (_pfDisplayCatalogCode(item) ? '<div style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px">' + esc(_pfDisplayCatalogCode(item)) + '</div>' : '')
        : '<div style="position:relative">' +
            '<input class="form-input pf-item-name" data-idx="' + i + '" style="font-size:13px" value="' + esc(item.name||'') + '" placeholder="نام کالا" autocomplete="off" oninput="_pfRowChange(' + i + ',\'name\',this.value); pfSearchProduct(' + i + ', this.value)">' +
            (_pfDisplayCatalogCode(item) ? '<div class="pf-item-cat-display" data-idx="' + i + '" style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px;padding:1px 4px">' + esc(_pfDisplayCatalogCode(item)) + '</div>' : '<div class="pf-item-cat-display" data-idx="' + i + '" style="font-family:monospace;font-size:10px;color:#0284c7;margin-top:2px;padding:1px 4px"></div>') +
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
      '<td style="font-family:monospace">' + esc(_pfDisplayCatalogCode(item) || '') + '</td>' +
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
        key = _pfDisplayCatalogCode(it) || String(it.name || '—');
        label = it.name || key;
        sub = _pfDisplayCatalogCode(it) || '';
      }
      if (!agg[key]) agg[key] = { label: label, sub: sub, qty: 0, amount: 0, pfSet: {}, products: {}, entries: [], centers: {} };
      var row = agg[key];
      row.qty += qty;
      row.amount += amt;
      if (pfId) row.pfSet[pfId] = true;
      var pk = _pfDisplayCatalogCode(it) || String(it.name || '—');
      if (!row.products[pk]) row.products[pk] = { name: it.name || pk, code: _pfDisplayCatalogCode(it) || '', qty: 0, amount: 0 };
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

// ── Navigate to center profile from proforma panel ───────────────────────
function pfCenterClick(idx) {
  var entry = _pfCenterMap[idx] || {};
  var centerKey = entry.key || '';
  if (!centerKey) return;

  var rtype = 'center';
  var rid = centerKey;
  var parts = String(centerKey).split('_');
  if (parts[0] === 'pc' || parts[0] === 'center' || parts[0] === 'c') {
    rtype = parts[0] === 'c' ? 'center' : parts[0];
    rid = parts.slice(1).join('_');
  }

  if (typeof openCenterModal === 'function') {
    openCenterModal(rtype, rid, centerKey);
    return;
  }
  // اگر مودال هنوز لود نشده، به استان‌ها برو و بعد پروفایل را باز کن
  if (typeof switchTab === 'function') switchTab('provinces');
  setTimeout(function () {
    if (typeof openCenterModal === 'function') openCenterModal(rtype, rid, centerKey);
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
      + '<td><code>' + esc(_pfDisplayCatalogCode(it) || '—') + '</code></td>'
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

// cache-bust marker for lazy-load verification
window.__PF_UI_REV='20260724f';

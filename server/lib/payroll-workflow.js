'use strict';

const { WORKFLOW } = require('./payroll-engine');
const { isManagerRole } = require('./roles');

/** Who may perform each transition (segregation of duties). */
const TRANSITION_ROLES = {
  [`${WORKFLOW.DRAFT}->${WORKFLOW.MANAGER_REVIEW}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.MANAGER_REVIEW}->${WORKFLOW.FINANCIAL}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.MANAGER_REVIEW}->${WORKFLOW.DRAFT}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.FINANCIAL}->${WORKFLOW.LOCKED}`]: ['مالی', 'سوپر ادمین'],
  [`${WORKFLOW.FINANCIAL}->${WORKFLOW.MANAGER_REVIEW}`]: ['مالی', 'مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.LOCKED}->${WORKFLOW.PUBLISHED}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.LOCKED}->${WORKFLOW.DRAFT}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.PUBLISHED}->${WORKFLOW.DRAFT}`]: ['مدیر', 'سوپر ادمین'],
  [`${WORKFLOW.FINANCIAL}->${WORKFLOW.DRAFT}`]: ['مدیر', 'سوپر ادمین'],
};

function transitionKey(from, to) {
  return `${from}->${to}`;
}

function canUserTransition(user, from, to) {
  if (!user || !from || !to) return false;
  const role = user.role || '';
  const key = transitionKey(from, to);
  const allowed = TRANSITION_ROLES[key];
  if (!allowed) return false;
  return allowed.includes(role);
}

/** Super-admin may force-lock only from draft (emergency); logged as override. */
function canForceLock(user) {
  return user && user.role === 'سوپر ادمین';
}

function nextActionsFor(user, currentStatus) {
  const role = user && user.role;
  if (!role) return [];
  const out = [];
  const from = currentStatus || WORKFLOW.DRAFT;
  Object.keys(TRANSITION_ROLES).forEach(function (key) {
    const parts = key.split('->');
    if (parts[0] !== from) return;
    const to = parts[1];
    if (TRANSITION_ROLES[key].includes(role)) {
      out.push({ to, label: STATUS_LABELS[to] || to });
    }
  });
  return out;
}

const STATUS_LABELS = {
  draft: 'پیش‌نویس',
  manager_review: 'بررسی مدیر',
  financial_approval: 'تأیید مالی',
  locked: 'قفل',
  published: 'منتشر',
};

function assertTransition(user, from, to, options) {
  options = options || {};
  if (canUserTransition(user, from, to)) return { ok: true };
  if (options.force && to === WORKFLOW.LOCKED && from === WORKFLOW.DRAFT && canForceLock(user)) {
    return { ok: true, override: true };
  }
  if (to === WORKFLOW.LOCKED && from !== WORKFLOW.FINANCIAL && !options.force) {
    return {
      error: 'قفل حقوق فقط پس از تأیید مالی مجاز است. مسیر: پیش‌نویس → بررسی مدیر → تأیید مالی → قفل',
      status: 403,
    };
  }
  return {
    error: `انتقال از «${STATUS_LABELS[from] || from}» به «${STATUS_LABELS[to] || to}» برای نقش «${user.role}» مجاز نیست`,
    status: 403,
  };
}

function canManagerEditPayroll(user) {
  return user && (isManagerRole(user.role) || user.role === 'سوپر ادمین');
}

module.exports = {
  TRANSITION_ROLES,
  STATUS_LABELS,
  canUserTransition,
  canForceLock,
  canManagerEditPayroll,
  nextActionsFor,
  assertTransition,
  isPayrollViewer: function (user) {
    if (!user) return false;
    if (isManagerRole(user.role) || user.role === 'مالی') return true;
    return false;
  },
};

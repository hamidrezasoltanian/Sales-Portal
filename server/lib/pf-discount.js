'use strict';

const { query } = require('../db');
const { isManagerRole } = require('./roles');

const DEFAULT_DISCOUNT_CAPS = {
  'کارشناس فروش': 10,
  'بازرگانی': 15,
  'مالی': 50,
  'مدیر': 100,
  'سوپر ادمین': 100,
  'IT': 0,
  'مهمان': 0,
};

async function loadDiscountCaps() {
  try {
    const r = await query("SELECT value FROM app_settings WHERE key = 'pfDiscountCaps'");
    if (r.rows.length && r.rows[0].value && typeof r.rows[0].value === 'object') {
      return Object.assign({}, DEFAULT_DISCOUNT_CAPS, r.rows[0].value);
    }
  } catch (_) {}
  return Object.assign({}, DEFAULT_DISCOUNT_CAPS);
}

function getDiscountCap(role, caps) {
  const c = caps || DEFAULT_DISCOUNT_CAPS;
  return Number(c[role] != null ? c[role] : c['کارشناس فروش']) || 0;
}

function maxDiscountPct(pf) {
  const items = pf.items || [];
  let itemMax = 0;
  items.forEach(function (it) {
    const d = Number(it.discPct) || 0;
    if (d > itemMax) itemMax = d;
  });
  const header = Number(pf.discountPct != null ? pf.discountPct : pf.discount_pct) || 0;
  return Math.max(itemMax, header);
}

function exceedsDiscountCap(pf, role, caps) {
  if (isManagerRole(role) || role === 'مالی') return false;
  const cap = getDiscountCap(role, caps);
  return maxDiscountPct(pf) > cap;
}

function canApproveDiscount(user) {
  return isManagerRole(user.role) || user.role === 'مالی';
}

module.exports = {
  DEFAULT_DISCOUNT_CAPS,
  loadDiscountCaps,
  getDiscountCap,
  maxDiscountPct,
  exceedsDiscountCap,
  canApproveDiscount,
};

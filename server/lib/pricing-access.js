'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../auth');

const COOKIE_NAME = 'pricing_mgmt';
const TOKEN_TTL = '8h';

function getPricingPasswordHash() {
  return process.env.PRICING_ACCESS_PASSWORD_HASH || '';
}

function isPricingMgmtConfigured() {
  return Boolean(getPricingPasswordHash() || process.env.PRICING_ACCESS_PASSWORD);
}

async function verifyPricingPassword(password) {
  const hash = getPricingPasswordHash();
  if (hash) {
    return bcrypt.compare(password, hash);
  }
  const plain = process.env.PRICING_ACCESS_PASSWORD;
  if (plain) {
    return password === plain;
  }
  return false;
}

function issuePricingMgmtToken(username) {
  return jwt.sign(
    { purpose: 'pricing_mgmt', username },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function verifyPricingMgmtToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'pricing_mgmt') return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

function getPricingMgmtFromRequest(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return verifyPricingMgmtToken(req.cookies[COOKIE_NAME]);
  }
  const hdr = req.headers['x-pricing-mgmt'];
  if (hdr) return verifyPricingMgmtToken(hdr);
  return null;
}

function hasPricingMgmtAccess(req) {
  const role = req.user && req.user.role;
  if (role === 'مدیر' || role === 'سوپر ادمین' || role === 'مالی') return true;
  return Boolean(getPricingMgmtFromRequest(req));
}

function pricingMgmtCookieOptions() {
  const opts = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/api/pricing',
  };
  if (process.env.NODE_ENV === 'production') {
    opts.secure = true;
  }
  return opts;
}

/** Hash helper for ops: node -e "require('./server/lib/pricing-access').hashPassword('secret').then(console.log)" */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

module.exports = {
  COOKIE_NAME,
  isPricingMgmtConfigured,
  verifyPricingPassword,
  issuePricingMgmtToken,
  verifyPricingMgmtToken,
  getPricingMgmtFromRequest,
  hasPricingMgmtAccess,
  pricingMgmtCookieOptions,
  hashPassword,
};

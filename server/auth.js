'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';

// In-memory cache for active status (5-minute TTL)
const _activeCache = new Map(); // username -> {active, ts}
const CACHE_TTL = 5 * 60 * 1000;

async function requireAuth(req, res, next) {
  let token = null;

  // Try cookie first
  if (req.cookies && req.cookies.atena_token) {
    token = req.cookies.atena_token;
  }

  // Try Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'احراز هویت الزامی است' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده' });
  }

  // Check active status with cache
  try {
    const cached = _activeCache.get(decoded.username);
    let active;
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      active = cached.active;
    } else {
      const userResult = await query('SELECT active FROM app_users WHERE username = $1', [decoded.username]);
      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'حساب کاربری غیرفعال است' });
      }
      active = userResult.rows[0].active;
      _activeCache.set(decoded.username, { active, ts: Date.now() });
    }
    if (!active) {
      return res.status(401).json({ error: 'حساب کاربری غیرفعال است' });
    }
  } catch (e) {
    // If DB check fails, allow through to avoid blocking all requests on DB error
    console.error('[requireAuth] DB check error:', e.message);
  }

  req.user = { username: decoded.username, role: decoded.role, name: decoded.name };
  next();
}

function requireManager(req, res, next) {
  requireAuth(req, res, function () {
    if (req.user.role !== 'مدیر' && req.user.role !== 'سوپر ادمین') {
      return res.status(403).json({ error: 'دسترسی فقط برای مدیران' });
    }
    next();
  });
}

module.exports = { requireAuth, requireManager, JWT_SECRET };

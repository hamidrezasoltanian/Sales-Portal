'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { requireAuth, JWT_SECRET } = require('../auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ── In-memory rate limiter for login (no external dependency) ──────────────
// Tracks failed attempts per IP. Resets on successful login.
const _loginAttempts = new Map(); // ip -> { count, firstAt, blockedUntil }
const RATE_LIMIT_MAX = 10;         // max failed attempts
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_BLOCK  = 15 * 60 * 1000; // block for 15 minutes

function _getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function _checkRateLimit(ip) {
  const now = Date.now();
  const entry = _loginAttempts.get(ip);
  if (!entry) return { blocked: false };
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remaining = Math.ceil((entry.blockedUntil - now) / 60000);
    return { blocked: true, remaining };
  }
  // Reset window if expired
  if (now - entry.firstAt > RATE_LIMIT_WINDOW) {
    _loginAttempts.delete(ip);
    return { blocked: false };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    entry.blockedUntil = now + RATE_LIMIT_BLOCK;
    return { blocked: true, remaining: Math.ceil(RATE_LIMIT_BLOCK / 60000) };
  }
  return { blocked: false };
}

function _recordFailedAttempt(ip) {
  const now = Date.now();
  const entry = _loginAttempts.get(ip) || { count: 0, firstAt: now };
  entry.count++;
  _loginAttempts.set(ip, entry);
}

function _clearAttempts(ip) {
  _loginAttempts.delete(ip);
}

// Clean up old entries every 30 minutes
setInterval(function () {
  const now = Date.now();
  for (const [ip, entry] of _loginAttempts.entries()) {
    if (now - entry.firstAt > RATE_LIMIT_WINDOW * 2) _loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const ip = _getIp(req);
  const rl = _checkRateLimit(ip);
  if (rl.blocked) {
    return res.status(429).json({ error: `تعداد تلاش‌های ناموفق بیش از حد مجاز. لطفاً ${rl.remaining} دقیقه صبر کنید.` });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  }

  try {
    const result = await query(
      'SELECT username, display_name, role, color, password_hash, active FROM app_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      _recordFailedAttempt(ip);
      return res.status(401).json({ error: 'اطلاعات ورود نادرست است' });
    }

    const user = result.rows[0];

    if (!user.active) {
      return res.status(401).json({ error: 'حساب کاربری غیرفعال است' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'رمز عبور تنظیم نشده است' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      _recordFailedAttempt(ip);
      return res.status(401).json({ error: 'اطلاعات ورود نادرست است' });
    }

    // Success — clear failed attempts
    _clearAttempts(ip);

    const token = jwt.sign(
      { username: user.username, role: user.role, name: user.display_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('atena_token', token, COOKIE_OPTIONS);
    return res.json({
      ok: true,
      user: {
        username: user.username,
        role: user.role,
        name: user.display_name,
        color: user.color,
      },
    });
  } catch (e) {
    console.error('[auth/login]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT username, display_name, role, color, phone, department, direct_manager, permissions FROM app_users WHERE username = $1 AND active = true',
      [req.user.username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'کاربر یافت نشد' });
    }
    const u = result.rows[0];
    return res.json({
      username: u.username,
      name: u.display_name,
      role: u.role,
      color: u.color,
      phone: u.phone,
      department: u.department || '',
      direct_manager: u.direct_manager || '',
      permissions: u.permissions || {},
    });
  } catch (e) {
    console.error('[auth/me]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('atena_token');
  return res.json({ ok: true });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'رمز قدیم و جدید الزامی است' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'رمز جدید باید حداقل ۶ کاراکتر باشد' });
  }

  try {
    const result = await query(
      'SELECT password_hash FROM app_users WHERE username = $1',
      [req.user.username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }
    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash || '');
    if (!valid) {
      return res.status(401).json({ error: 'رمز قدیم نادرست است' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE app_users SET password_hash = $1 WHERE username = $2', [hash, req.user.username]);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[auth/change-password]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

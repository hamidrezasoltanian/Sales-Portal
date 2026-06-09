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

// POST /api/auth/login
router.post('/login', async (req, res) => {
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
      return res.status(401).json({ error: 'اطلاعات ورود نادرست است' });
    }

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
      'SELECT username, display_name, role, color, phone FROM app_users WHERE username = $1 AND active = true',
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
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' });
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

'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();

// GET /api/users — all active users (no password_hash)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT username, display_name, role, color, phone, active FROM app_users ORDER BY created_at'
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('[users GET /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/users — create new user
router.post('/', requireManager, async (req, res) => {
  const { username, display_name, role, color, phone } = req.body || {};
  if (!username || !display_name) {
    return res.status(400).json({ error: 'نام کاربری و نام نمایشی الزامی است' });
  }

  try {
    // Check if already exists
    const existing = await query('SELECT username FROM app_users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'نام کاربری قبلاً وجود دارد' });
    }

    // Set temp password = username + '123'
    const tempPassword = username + '123';
    const hash = await bcrypt.hash(tempPassword, 10);

    await query(
      `INSERT INTO app_users (username, display_name, role, color, phone, active, password_hash)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [
        username,
        display_name,
        role || 'کارشناس فروش',
        color || '#0ea5e9',
        phone || '',
        hash,
      ]
    );

    return res.status(201).json({
      ok: true,
      username,
      display_name,
      role: role || 'کارشناس فروش',
      color: color || '#0ea5e9',
      phone: phone || '',
      active: true,
    });
  } catch (e) {
    console.error('[users POST /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/users/:username — update user (manager or self)
router.put('/:username', requireAuth, async (req, res) => {
  const { username } = req.params;

  const isAdmin = req.user.role === 'مدیر' || req.user.role === 'سوپر ادمین';
  if (!isAdmin && req.user.username !== username) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const { display_name, role, color, phone, active, new_username } = req.body || {};

  try {
    const existing = await query('SELECT username FROM app_users WHERE username = $1', [username]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    // Non-managers cannot change role or active status
    const updates = [];
    const params = [];
    let idx = 1;

    if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); params.push(display_name); }
    if (color !== undefined) { updates.push(`color = $${idx++}`); params.push(color); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone); }

    // Only managers/superadmin can change role/active
    if (isAdmin) {
      if (role !== undefined) { updates.push(`role = $${idx++}`); params.push(role); }
      if (active !== undefined) { updates.push(`active = $${idx++}`); params.push(active); }
    }

    // Only superadmin can rename username
    let renamedUsername = null;
    if (req.user.role === 'سوپر ادمین' && new_username && new_username !== username) {
      if (!/^[a-zA-Z0-9._-]+$/.test(new_username)) {
        return res.status(400).json({ error: 'نام کاربری فقط حروف انگلیسی، اعداد و نقطه/خط تیره مجاز است' });
      }
      const dup = await query('SELECT username FROM app_users WHERE username = $1', [new_username]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: 'این نام کاربری قبلاً استفاده شده' });
      }
      updates.push(`username = $${idx++}`);
      params.push(new_username);
      renamedUsername = new_username;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'هیچ فیلدی برای آپدیت وجود ندارد' });
    }

    params.push(username);
    await query(`UPDATE app_users SET ${updates.join(', ')} WHERE username = $${idx}`, params);

    return res.json({ ok: true, ...(renamedUsername ? { new_username: renamedUsername } : {}) });
  } catch (e) {
    console.error('[users PUT /:username]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/users/:username — soft delete
router.delete('/:username', requireManager, async (req, res) => {
  const { username } = req.params;

  try {
    const result = await query('UPDATE app_users SET active = false WHERE username = $1', [username]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[users DELETE /:username]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/users/:username/set-password — manager sets password
router.post('/:username/set-password', requireManager, async (req, res) => {
  const { username } = req.params;
  const { password } = req.body || {};

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'رمز باید حداقل ۴ کاراکتر باشد' });
  }

  try {
    const existing = await query('SELECT username FROM app_users WHERE username = $1', [username]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE app_users SET password_hash = $1 WHERE username = $2', [hash, username]);

    return res.json({ ok: true });
  } catch (e) {
    console.error('[users POST /:username/set-password]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

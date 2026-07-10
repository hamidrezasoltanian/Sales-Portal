'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { requireAuth, requireManager, invalidateAuthCache } = require('../auth');
const { isManagerRole, isValidRole, normalizeRole } = require('../lib/roles');

const router = express.Router();

function mapUserRow(row, isAdmin) {
  const base = {
    username: row.username,
    display_name: row.display_name,
    role: normalizeRole(row.role),
    color: row.color,
    phone: row.phone || '',
    active: row.active,
  };
  if (!isAdmin) return base;
  return Object.assign(base, {
    department: row.department || '',
    direct_manager: row.direct_manager || '',
    permissions: row.permissions || {},
    commission_pct: row.commission_pct,
    salary_amount: row.salary_amount,
  });
}

// GET /api/users — managers: full list; others: public fields only (no salary/permissions)
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = isManagerRole(req.user.role);
    const result = await query(
      'SELECT username, display_name, role, color, phone, active, department, direct_manager, permissions, commission_pct, salary_amount FROM app_users ORDER BY created_at'
    );
    return res.json(result.rows.map(function (row) { return mapUserRow(row, isAdmin); }));
  } catch (e) {
    console.error('[users GET /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/users — create new user
router.post('/', requireManager, async (req, res) => {
  const { username, display_name, role, color, phone, department } = req.body || {};
  if (!username || !display_name) {
    return res.status(400).json({ error: 'نام کاربری و نام نمایشی الزامی است' });
  }
  if (role && !isValidRole(role)) {
    return res.status(400).json({ error: 'نقش نامعتبر است' });
  }
  const normalizedRole = normalizeRole(role || 'کارشناس فروش');

  try {
    const existing = await query('SELECT username FROM app_users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'نام کاربری قبلاً وجود دارد' });
    }

    const tempPassword = crypto.randomBytes(5).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);

    await query(
      `INSERT INTO app_users (username, display_name, role, color, phone, department, active, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
      [
        username,
        display_name,
        normalizedRole,
        color || '#0ea5e9',
        phone || '',
        department || '',
        hash,
      ]
    );

    return res.status(201).json({
      ok: true,
      username,
      display_name,
      role: normalizedRole,
      color: color || '#0ea5e9',
      phone: phone || '',
      department: department || '',
      active: true,
      tempPassword,
    });
  } catch (e) {
    console.error('[users POST /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/users/:username — update user (manager or self)
router.put('/:username', requireAuth, async (req, res) => {
  const { username } = req.params;

  const isAdmin = isManagerRole(req.user.role);
  if (!isAdmin && req.user.username !== username) {
    return res.status(403).json({ error: 'دسترسی مجاز نیست' });
  }

  const { display_name, role, color, phone, active, new_username, department, direct_manager, permissions, commission_pct, salary_amount } = req.body || {};

  if (role !== undefined && !isValidRole(role)) {
    return res.status(400).json({ error: 'نقش نامعتبر است' });
  }

  try {
    const existing = await query('SELECT username, role FROM app_users WHERE username = $1', [username]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }
    const prevRole = existing.rows[0].role;

    const updates = [];
    const params = [];
    let idx = 1;
    let roleChanged = false;

    if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); params.push(display_name); }
    if (color !== undefined) { updates.push(`color = $${idx++}`); params.push(color); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone); }

    if (isAdmin) {
      if (role !== undefined) {
        const normalizedRole = normalizeRole(role);
        updates.push(`role = $${idx++}`);
        params.push(normalizedRole);
        roleChanged = normalizeRole(prevRole) !== normalizedRole;
      }
      if (active !== undefined) { updates.push(`active = $${idx++}`); params.push(active); }
      if (department !== undefined) { updates.push(`department = $${idx++}`); params.push(department); }
      if (direct_manager !== undefined) { updates.push(`direct_manager = $${idx++}`); params.push(direct_manager); }
      if (permissions !== undefined) { updates.push(`permissions = $${idx++}`); params.push(JSON.stringify(permissions)); }
      if (commission_pct !== undefined) { updates.push(`commission_pct = $${idx++}`); params.push(commission_pct); }
    }

    if (isAdmin && salary_amount !== undefined) {
      updates.push(`salary_amount = $${idx++}`);
      params.push(salary_amount);
    }

    let renamedUsername = null;
    if (isAdmin && new_username && new_username !== username) {
      if (!/^[a-zA-Z0-9._-]+$/.test(new_username)) {
        return res.status(400).json({ error: 'نام کاربری فقط حروف انگلیسی، اعداد و نقطه/خط تیره مجاز است' });
      }
      const dup = await query('SELECT username FROM app_users WHERE username = $1', [new_username]);
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'این نام کاربری قبلاً استفاده شده' });
      }
      updates.push(`username = $${idx++}`);
      params.push(new_username);
      renamedUsername = new_username;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'هیچ فیلدی برای آپدیت وجود ندارد' });
    }

    if (roleChanged) {
      updates.push('token_version = COALESCE(token_version, 0) + 1');
    }

    params.push(username);
    await query(`UPDATE app_users SET ${updates.join(', ')} WHERE username = $${idx}`, params);

    invalidateAuthCache(username);
    if (renamedUsername) invalidateAuthCache(renamedUsername);

    return res.json({
      ok: true,
      ...(renamedUsername ? { new_username: renamedUsername } : {}),
      ...(roleChanged ? { role_changed: true, must_relogin: true } : {}),
    });
  } catch (e) {
    console.error('[users PUT /:username]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/users/:username — soft delete
router.delete('/:username', requireManager, async (req, res) => {
  const { username } = req.params;

  try {
    const result = await query(
      'UPDATE app_users SET active = false, token_version = COALESCE(token_version, 0) + 1 WHERE username = $1',
      [username]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }
    invalidateAuthCache(username);
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
    await query(
      'UPDATE app_users SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1 WHERE username = $2',
      [hash, username]
    );
    invalidateAuthCache(username);

    return res.json({ ok: true });
  } catch (e) {
    console.error('[users POST /:username/set-password]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

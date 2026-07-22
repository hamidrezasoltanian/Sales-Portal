'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { requireAuth, requireManager, invalidateAuthCache } = require('../auth');
const { isManagerRole, isValidRole, normalizeRole } = require('../lib/roles');
const { serializeUser } = require('../lib/user-serializer');
const { validatePermissions } = require('../lib/permissions-schema');
const { detectDirectManagerCycle } = require('../lib/direct-manager');
const { validateManagerScope, defaultManagerScopeForRole } = require('../lib/manager-scope');
const { logAccessChange } = require('../lib/access-audit');
const { mirrorUserProfileToEmployee } = require('../lib/user-employee-sync');

const router = express.Router();

async function syncUserProfileToHr(username) {
  try {
    await mirrorUserProfileToEmployee(username);
  } catch (e) {
    console.warn('[users] HR mirror profile→employees:', e.message);
  }
}

// GET /api/users — field-level serializer; sensitive columns only for authorized requesters
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT username, display_name, role, color, phone, active, department, direct_manager, share_with_manager, permissions, commission_pct, salary_amount, manager_scope FROM app_users ORDER BY created_at'
    );
    return res.json(result.rows.map(function (row) {
      return serializeUser(row, req.user);
    }));
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
      `INSERT INTO app_users (username, display_name, role, color, phone, department, active, password_hash, manager_scope)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [
        username,
        display_name,
        normalizedRole,
        color || '#0ea5e9',
        phone || '',
        department || '',
        hash,
        JSON.stringify(defaultManagerScopeForRole(normalizedRole)),
      ]
    );

    await syncUserProfileToHr(username);

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

  const { display_name, role, color, phone, active, new_username, department, direct_manager, share_with_manager, permissions, commission_pct, salary_amount, manager_scope } = req.body || {};

  if (role !== undefined && !isValidRole(role)) {
    return res.status(400).json({ error: 'نقش نامعتبر است' });
  }

  if (permissions !== undefined && isAdmin) {
    const pv = validatePermissions(permissions);
    if (!pv.ok) return res.status(400).json({ error: pv.error });
  }

  if (direct_manager !== undefined && isAdmin) {
    const cycleErr = await detectDirectManagerCycle(username, direct_manager, query);
    if (cycleErr) return res.status(400).json({ error: cycleErr });
  }

  if (manager_scope !== undefined && isAdmin) {
    const roleForScope = role !== undefined ? normalizeRole(role) : undefined;
    const existingRole = (await query('SELECT role FROM app_users WHERE username = $1', [username])).rows[0];
    const sv = validateManagerScope(manager_scope, roleForScope || (existingRole && existingRole.role));
    if (!sv.ok) return res.status(400).json({ error: sv.error });
  }

  try {
    const existing = await query(
      'SELECT username, role, permissions, direct_manager, share_with_manager, manager_scope FROM app_users WHERE username = $1',
      [username]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }
    const prev = existing.rows[0];
    const prevRole = prev.role;

    const updates = [];
    const params = [];
    let idx = 1;
    let roleChanged = false;
    const auditJobs = [];

    if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); params.push(display_name); }
    if (color !== undefined) { updates.push(`color = $${idx++}`); params.push(color); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone); }

    if (isAdmin) {
      if (role !== undefined) {
        const normalizedRole = normalizeRole(role);
        updates.push(`role = $${idx++}`);
        params.push(normalizedRole);
        roleChanged = normalizeRole(prevRole) !== normalizedRole;
        if (roleChanged) {
          auditJobs.push({ field: 'role', oldValue: prevRole, newValue: normalizedRole });
          // When promoting/demoting, set a safe default scope if client didn't send one
          if (manager_scope === undefined) {
            const def = defaultManagerScopeForRole(normalizedRole);
            updates.push(`manager_scope = $${idx++}`);
            params.push(JSON.stringify(def));
            auditJobs.push({ field: 'manager_scope', oldValue: prev.manager_scope, newValue: def, note: 'auto on role change' });
          }
        }
      }
      if (active !== undefined) { updates.push(`active = $${idx++}`); params.push(active); }
      if (department !== undefined) { updates.push(`department = $${idx++}`); params.push(department); }
      if (direct_manager !== undefined) {
        updates.push(`direct_manager = $${idx++}`);
        params.push(direct_manager || '');
        auditJobs.push({ field: 'direct_manager', oldValue: prev.direct_manager || '', newValue: direct_manager || '' });
      }
      if (share_with_manager !== undefined) {
        updates.push(`share_with_manager = $${idx++}`);
        params.push(!!share_with_manager);
        auditJobs.push({ field: 'share_with_manager', oldValue: !!prev.share_with_manager, newValue: !!share_with_manager });
      }
      if (permissions !== undefined) {
        const pv = validatePermissions(permissions);
        updates.push(`permissions = $${idx++}`);
        params.push(JSON.stringify(pv.value));
        auditJobs.push({ field: 'permissions', oldValue: prev.permissions || {}, newValue: pv.value });
      }
      if (manager_scope !== undefined) {
        const roleForScope = role !== undefined ? normalizeRole(role) : normalizeRole(prevRole);
        const sv = validateManagerScope(manager_scope, roleForScope);
        updates.push(`manager_scope = $${idx++}`);
        params.push(JSON.stringify(sv.value));
        auditJobs.push({ field: 'manager_scope', oldValue: prev.manager_scope, newValue: sv.value });
      }
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
      const cycleErr = await detectDirectManagerCycle(new_username, direct_manager !== undefined ? direct_manager : prev.direct_manager, query);
      if (cycleErr) return res.status(400).json({ error: cycleErr });
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

    const finalUsername = renamedUsername || username;
    invalidateAuthCache(username);
    if (renamedUsername) {
      invalidateAuthCache(renamedUsername);
      try {
        await query('UPDATE employees SET username = $2 WHERE username = $1', [username, renamedUsername]);
      } catch (e) {
        console.warn('[users] rename employees.username:', e.message);
      }
    }

    try {
      await query(
        `UPDATE center_edits SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{owner}', to_jsonb($2::text), true), updated_at = NOW(), updated_by = $2 WHERE data->>'owner' = $1`,
        [username, renamedUsername]
      );
    } catch (e) {
      console.error('[users] rename center ownership:', e.message);
    }

    // Always mirror SoT profile into employees after any user update
    await syncUserProfileToHr(finalUsername);

    for (const job of auditJobs) {
      await logAccessChange({
        actor: req.user.username,
        targetUser: finalUsername,
        field: job.field,
        oldValue: job.oldValue,
        newValue: job.newValue,
        note: job.note || null,
      });
    }

    return res.json({
      ok: true,
      ...(renamedUsername ? { new_username: renamedUsername } : {}),
      ...(roleChanged ? { role_changed: true, must_relogin: true } : {}),
    });
  } catch (e) {
    console.error('[users PUT /:username]', e.message);
    if (e.message && e.message.indexOf('چرخه') >= 0) {
      return res.status(400).json({ error: e.message });
    }
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
    // Revoke any linked Telegram session immediately.
    await query("DELETE FROM bot_sessions WHERE data->>'username' = $1", [username]).catch((e) => {
      console.warn('[users] revoke Telegram session:', e.message);
    });
    try {
      await query('UPDATE employees SET active = false WHERE username = $1', [username]);
    } catch (e) {
      console.warn('[users] deactivate employees:', e.message);
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

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'رمز باید حداقل ۸ کاراکتر باشد' });
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
    // Revoke any linked Telegram session immediately.
    await query("DELETE FROM bot_sessions WHERE data->>'username' = $1", [username]).catch((e) => {
      console.warn('[users] revoke Telegram session:', e.message);
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[users POST /:username/set-password]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

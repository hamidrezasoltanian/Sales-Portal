'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch(e) {}

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// GET /api/data/db
router.get('/db', async (req, res) => {
  try {
    const result = await query("SELECT value FROM app_data WHERE key = 'main'");
    if (result.rows.length === 0) {
      return res.json({});
    }
    return res.json(result.rows[0].value);
  } catch (e) {
    console.error('[data/db GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/data/db
router.put('/db', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'داده نامعتبر' });
  }

  try {
    // If body has _mtr key, store separately
    let mainData = body;
    if (body._mtr) {
      const mtrData = body._mtr;
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('mtr', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(mtrData), req.user.username]
      );
      // Remove _mtr from main data
      mainData = Object.assign({}, body);
      delete mainData._mtr;
    }

    // Merge weekEntries and edits to prevent data loss on concurrent saves
    const storedResult = await query("SELECT value FROM app_data WHERE key = 'main'");
    const current = storedResult.rows.length ? storedResult.rows[0].value : {};
    const merged = Object.assign({}, current, mainData);
    if (current.weekEntries && mainData.weekEntries) {
      merged.weekEntries = Object.assign({}, current.weekEntries, mainData.weekEntries);
    }
    if (current.edits && mainData.edits) {
      merged.edits = Object.assign({}, current.edits, mainData.edits);
    }

    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('main', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify(merged), req.user.username]
    );

    try { if (_broadcast) _broadcast('db-updated', { by: req.user.username, at: Date.now() }, req.user.username); } catch(e) {}
    return res.json({ ok: true });
  } catch (e) {
    console.error('[data/db PUT]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/data/mtr
router.get('/mtr', async (req, res) => {
  try {
    const result = await query("SELECT value FROM app_data WHERE key = 'mtr'");
    if (result.rows.length === 0) {
      return res.json({});
    }
    return res.json(result.rows[0].value);
  } catch (e) {
    console.error('[data/mtr GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/data/mtr
router.put('/mtr', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'داده نامعتبر' });
  }

  try {
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('mtr', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify(body), req.user.username]
    );
    try { if (_broadcast) _broadcast('mtr-updated', { by: req.user.username, at: Date.now() }, req.user.username); } catch(e) {}
    return res.json({ ok: true });
  } catch (e) {
    console.error('[data/mtr PUT]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/data/centers/master
router.get('/centers/master', async (req, res) => {
  try {
    const result = await query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')");
    const out = { CENTERS: [], PC_RAW: {} };
    result.rows.forEach(function (row) {
      if (row.key === 'CENTERS') out.CENTERS = row.data;
      else if (row.key === 'PC_RAW') out.PC_RAW = row.data;
    });
    return res.json(out);
  } catch (e) {
    console.error('[data/centers/master GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/data/centers/master
router.put('/centers/master', requireManager, async (req, res) => {
  const { CENTERS, PC_RAW } = req.body || {};
  if (!CENTERS || !PC_RAW) {
    return res.status(400).json({ error: 'CENTERS و PC_RAW الزامی است' });
  }

  try {
    await query(
      `INSERT INTO centers_master (key, data, updated_at)
       VALUES ('CENTERS', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(CENTERS)]
    );
    await query(
      `INSERT INTO centers_master (key, data, updated_at)
       VALUES ('PC_RAW', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(PC_RAW)]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('[data/centers/master PUT]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/data/backup
router.get('/backup', async (req, res) => {
  try {
    const [mainR, mtrR, usersR, centersR] = await Promise.all([
      query("SELECT value FROM app_data WHERE key = 'main'"),
      query("SELECT value FROM app_data WHERE key = 'mtr'"),
      query('SELECT username, display_name, role, color, phone, active FROM app_users ORDER BY username'),
      query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    ]);

    const centers = { CENTERS: [], PC_RAW: {} };
    centersR.rows.forEach(function (row) {
      if (row.key === 'CENTERS') centers.CENTERS = row.data;
      else if (row.key === 'PC_RAW') centers.PC_RAW = row.data;
    });

    return res.json({
      db: mainR.rows.length ? mainR.rows[0].value : {},
      mtr: mtrR.rows.length ? mtrR.rows[0].value : {},
      users: usersR.rows,
      centers: centers,
      exportedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[data/backup]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/data/restore
router.post('/restore', requireManager, async (req, res) => {
  const { db, mtr, users, centers } = req.body || {};

  try {
    if (db && typeof db === 'object') {
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('main', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(db), req.user.username]
      );
    }

    if (mtr && typeof mtr === 'object') {
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('mtr', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(mtr), req.user.username]
      );
    }

    if (users && Array.isArray(users)) {
      for (const u of users) {
        if (!u.username) continue;
        await query(
          `INSERT INTO app_users (username, display_name, role, color, phone, active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE
           SET display_name = $2, role = $3, color = $4, phone = $5, active = $6`,
          [u.username, u.display_name || u.username, u.role || 'کارشناس فروش', u.color || '#0ea5e9', u.phone || '', u.active !== false]
        );
      }
    }

    if (centers && centers.CENTERS) {
      await query(
        `INSERT INTO centers_master (key, data, updated_at)
         VALUES ('CENTERS', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(centers.CENTERS)]
      );
    }
    if (centers && centers.PC_RAW) {
      await query(
        `INSERT INTO centers_master (key, data, updated_at)
         VALUES ('PC_RAW', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(centers.PC_RAW)]
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[data/restore]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/data/kv/:key  — generic key-value read (for MTR meta etc.)
router.get('/kv/:key', async (req, res) => {
  const key = req.params.key.replace(/[^a-z0-9_-]/gi, '_');
  try {
    const result = await query('SELECT value FROM app_data WHERE key = $1', [key]);
    return res.json(result.rows.length ? result.rows[0].value : null);
  } catch (e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/data/kv/:key  — generic key-value write
router.put('/kv/:key', async (req, res) => {
  const key = req.params.key.replace(/[^a-z0-9_-]/gi, '_');
  const body = req.body;
  if (body === undefined || body === null) return res.status(400).json({ error: 'داده الزامی' });
  try {
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      [key, JSON.stringify(body), req.user.username]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

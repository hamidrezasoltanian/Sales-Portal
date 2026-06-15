'use strict';

const express = require('express');
const { query, pool } = require('../db');
const { requireAuth, requireManager } = require('../auth');
let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch(e) {}

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// GET /api/data/db — single REPEATABLE READ snapshot so blob ts and weekEntries are consistent
router.get('/db', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const [mainResult, weResult] = await Promise.all([
      client.query("SELECT value, updated_at FROM app_data WHERE key = 'main'"),
      client.query("SELECT key, value FROM week_entries"),
    ]);
    await client.query('COMMIT');

    if (mainResult.rows.length === 0) {
      return res.json({ weekEntries: {}, _serverTs: null });
    }
    const data = mainResult.rows[0].value;
    const _serverTs = mainResult.rows[0].updated_at ? mainResult.rows[0].updated_at.toISOString() : null;

    const weekEntries = {};
    weResult.rows.forEach(r => { weekEntries[r.key] = r.value; });

    let safe = data;
    if (data && data.settings && data.settings.anthropicKey) {
      safe = Object.assign({}, data, {
        settings: Object.assign({}, data.settings, { anthropicKey: '***' }),
      });
    }
    return res.json(Object.assign({}, safe, { weekEntries, _serverTs }));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[data/db GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  } finally {
    client.release();
  }
});

// PUT /api/data/db
router.put('/db', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'داده نامعتبر' });
  }

  // Use a transaction + FOR UPDATE to make conflict check atomic (fixes TOCTOU race)
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const _clientTs = body._clientTs || null;

    // Lock the current row for the conflict check and weekEntries guard
    const cur = await client.query("SELECT value, updated_at FROM app_data WHERE key = 'main' FOR UPDATE");
    const existingRow = cur.rows[0] || null;

    if (_clientTs && existingRow && existingRow.updated_at) {
      // Timestamp conflict check: reject if server has newer data
      const serverTs = existingRow.updated_at.toISOString();
      if (serverTs !== _clientTs) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'تغییرات توسط کاربر دیگری ذخیره شده — صفحه بارگذاری می‌شود' });
      }
    }

    // Strip client-only meta fields before storing
    let mainData = Object.assign({}, body);
    delete mainData._clientTs;
    delete mainData._serverTs;

    // Extract weekEntries and deletions — processed OUTSIDE the blob transaction
    // so the FOR UPDATE lock on app_data is not held during N round-trips
    const incomingWE = mainData.weekEntries || {};
    delete mainData.weekEntries;
    const deletedKeys = (Array.isArray(mainData._weDeletedKeys) ? mainData._weDeletedKeys : [])
      .filter(k => !incomingWE[k]);
    delete mainData._weDeletedKeys;

    // Batch delete then batch upsert weekEntries (outside the blob transaction)
    if (deletedKeys.length > 0) {
      await query('DELETE FROM week_entries WHERE key = ANY($1::text[])', [deletedKeys]);
    }
    if (Object.keys(incomingWE).length > 0) {
      // Use jsonb_each to expand the whole object in one query — avoids unnest
      // with text[] of JSON strings which requires complex quoting
      await query(
        `INSERT INTO week_entries (key, value, updated_at, updated_by)
         SELECT e.key, e.value, NOW(), $2
         FROM jsonb_each($1::jsonb) AS e(key, value)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(incomingWE), req.user.username]
      );
    }

    // If body has _mtr key, store separately
    if (mainData._mtr) {
      const mtrData = mainData._mtr;
      await client.query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('mtr', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(mtrData), req.user.username]
      );
      delete mainData._mtr;
    }

    // Save current version to history only if blob actually changed (keeps 30 days)
    await client.query('SAVEPOINT history_ops');
    try {
      await client.query(
        `INSERT INTO app_data_history (key, value, saved_by)
         SELECT 'main', value, $1 FROM app_data
         WHERE key = 'main' AND value IS DISTINCT FROM $2::jsonb`,
        [req.user.username, JSON.stringify(mainData)]
      );
      await client.query(
        `DELETE FROM app_data_history WHERE key = 'main' AND saved_at < NOW() - INTERVAL '30 days'`
      );
      await client.query('RELEASE SAVEPOINT history_ops');
    } catch (histErr) {
      await client.query('ROLLBACK TO SAVEPOINT history_ops');
      console.warn('[data/db PUT history]', histErr.message);
    }

    // Only change updated_at if blob content changed — weekEntries-only saves
    // must not bump the timestamp, otherwise other clients get stale _clientTs → 409
    const upserted = await client.query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('main', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = CASE WHEN app_data.value = EXCLUDED.value THEN app_data.updated_at ELSE NOW() END,
         updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [JSON.stringify(mainData), req.user.username]
    );

    await client.query('COMMIT');

    const _serverTs = upserted.rows[0].updated_at.toISOString();
    const _cid = req.headers['x-cid'] || '';
    try { if (_broadcast) _broadcast('db-updated', { by: req.user.username, at: Date.now() }, _cid); } catch(e) {}
    return res.json({ ok: true, _serverTs });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(function() {});
    console.error('[data/db PUT]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/data/history — list last 30 save snapshots (manager only)
router.get('/history', requireManager, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, saved_at, saved_by FROM app_data_history WHERE key = 'main' ORDER BY saved_at DESC LIMIT 30`
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('[data/history GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/data/history/:id/restore — restore a snapshot (manager only)
router.post('/history/:id/restore', requireManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    const hist = await query('SELECT value FROM app_data_history WHERE id = $1 AND key = $2', [id, 'main']);
    if (!hist.rows.length) return res.status(404).json({ error: 'نسخه یافت نشد' });
    const snapVal = hist.rows[0].value;

    // If snapshot has weekEntries (old format), restore them to the dedicated table
    if (snapVal && snapVal.weekEntries) {
      const we = snapVal.weekEntries;
      for (const [k, v] of Object.entries(we)) {
        await query(
          `INSERT INTO week_entries (key, value, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [k, JSON.stringify(v), req.user.username]
        );
      }
      const cleanSnap = Object.assign({}, snapVal);
      delete cleanSnap.weekEntries;
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by) VALUES ('main', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(cleanSnap), req.user.username]
      );
    } else {
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by) VALUES ('main', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(snapVal), req.user.username]
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[data/history restore]', e.message);
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
    const _mtrCid = req.headers['x-cid'] || '';
    try { if (_broadcast) _broadcast('mtr-updated', { by: req.user.username, at: Date.now() }, _mtrCid); } catch(e) {}
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

// GET /api/data/backup — manager only (contains full DB including sensitive config)
router.get('/backup', requireManager, async (req, res) => {
  try {
    const [mainR, mtrR, usersR, centersR, weR] = await Promise.all([
      query("SELECT value FROM app_data WHERE key = 'main'"),
      query("SELECT value FROM app_data WHERE key = 'mtr'"),
      query('SELECT username, display_name, role, color, phone, active FROM app_users ORDER BY username'),
      query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
      query("SELECT key, value FROM week_entries"),
    ]);

    const centers = { CENTERS: [], PC_RAW: {} };
    centersR.rows.forEach(function (row) {
      if (row.key === 'CENTERS') centers.CENTERS = row.data;
      else if (row.key === 'PC_RAW') centers.PC_RAW = row.data;
    });

    const weekEntries = {};
    weR.rows.forEach(r => { weekEntries[r.key] = r.value; });

    return res.json({
      db: mainR.rows.length ? mainR.rows[0].value : {},
      mtr: mtrR.rows.length ? mtrR.rows[0].value : {},
      users: usersR.rows,
      centers: centers,
      weekEntries: weekEntries,
      exportedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[data/backup]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/data/restore
router.post('/restore', requireManager, async (req, res) => {
  const { db, mtr, users, centers, weekEntries } = req.body || {};

  try {
    // Restore weekEntries to dedicated table
    if (weekEntries && typeof weekEntries === 'object') {
      for (const [k, v] of Object.entries(weekEntries)) {
        await query(
          `INSERT INTO week_entries (key, value, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [k, JSON.stringify(v), req.user.username]
        );
      }
    }

    if (db && typeof db === 'object') {
      // Strip weekEntries from blob if present (old backup format)
      const cleanDb = Object.assign({}, db);
      delete cleanDb.weekEntries;
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('main', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(cleanDb), req.user.username]
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

// POST /api/centers/merge  — merge source center into target
router.post('/centers/merge', requireManager, async (req, res) => {
  const { sourceType, sourceId, targetType, targetId } = req.body || {};
  if (!sourceId || !targetId) return res.status(400).json({ error: 'sourceId و targetId الزامی است' });
  if (sourceId === targetId) return res.status(400).json({ error: 'منبع و هدف یکی است' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load CENTERS and PC_RAW
    const cmRes = await client.query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS','PC_RAW')");
    const cmData = {};
    for (const r of cmRes.rows) cmData[r.key] = r.data;
    const CENTERS = cmData['CENTERS'] || [];
    const PC_RAW  = cmData['PC_RAW']  || {};

    // Load main DB (edits, rTags, notes)
    const dbRes = await client.query("SELECT value FROM app_data WHERE key='main'");
    const DB = (dbRes.rows[0]?.value) || {};
    const edits    = DB.edits    || {};
    const rTags    = DB.rTags    || {};
    const noteMap  = DB.notes    || {};

    // Build edit keys
    const srcKey = sourceType === 'center' ? `center_${sourceId}` : `pc_${sourceId}`;
    const tgtKey = targetType === 'center' ? `center_${targetId}` : `pc_${targetId}`;

    // Merge edit data
    function mergeEditData(target, source) {
      if (!source || !Object.keys(source).length) return target || {};
      if (!target || !Object.keys(target).length) return { ...source };
      const tc = target.contacts || [];
      const seenNames = new Set(tc.map(c => c.name || ''));
      for (const ct of (source.contacts || [])) {
        if (!seenNames.has(ct.name || '')) {
          tc.push(ct); seenNames.add(ct.name || '');
        } else {
          const exc = tc.find(x => (x.name || '') === (ct.name || ''));
          if (exc) {
            const ep = new Set(exc.phones || []);
            for (const ph of (ct.phones || [])) {
              if (ph && !ep.has(ph)) { (exc.phones = exc.phones || []).push(ph); ep.add(ph); }
            }
          }
        }
      }
      target.contacts = tc;
      for (const f of ['address','status','lead','potential','type']) {
        if (!target[f] && source[f]) target[f] = source[f];
      }
      return target;
    }

    // Merge edits
    if (edits[srcKey]) {
      edits[tgtKey] = mergeEditData(edits[tgtKey] || {}, edits[srcKey]);
      delete edits[srcKey];
    }
    // Merge rTags
    if (rTags[srcKey]) {
      const existing = rTags[tgtKey] || [];
      for (const t of rTags[srcKey]) { if (!existing.includes(t)) existing.push(t); }
      rTags[tgtKey] = existing;
      delete rTags[srcKey];
    }
    // Merge notes
    if (noteMap[srcKey]) {
      noteMap[tgtKey] = [...(noteMap[tgtKey] || []), ...noteMap[srcKey]];
      delete noteMap[srcKey];
    }

    // Remove source from CENTERS (for Tehran centers)
    let centersChanged = false;
    const PROVINCE_MAP = {
      'فارس':'p1','اصفهان':'p2','سیستان و بلوچستان':'p3','مازندران':'p4',
      'آذربایجان شرقی':'p5','لرستان':'p6','بوشهر':'p7','گلستان':'p8',
      'خراسان جنوبی':'p9','چهارمحال و بختیاری':'p10','اردبیل':'p11',
      'خراسان رضوی':'p12','یزد':'p13','قم':'p14','زنجان':'p15','مرکزی':'p16',
      'گیلان':'p17','خراسان شمالی':'p18','ایلام':'p19','خوزستان':'p20',
      'کرمانشاه':'p21','آذربایجان غربی':'p22','کرمان':'p23','البرز':'p24',
      'همدان':'p25','قزوین':'p26','کردستان':'p27','هرمزگان':'p28',
      'کهگیلویه و بویراحمد':'p29','سمنان':'p30',
    };
    const PROV_ID_TO_NAME = Object.fromEntries(Object.entries(PROVINCE_MAP).map(([k,v])=>[v,k]));

    if (sourceType === 'center') {
      const before = CENTERS.length;
      const newCenters = CENTERS.filter(c => c.id !== sourceId);
      if (newCenters.length < before) {
        CENTERS.splice(0, CENTERS.length, ...newCenters);
        centersChanged = true;
      }
    } else {
      // Province center: remove from PC_RAW
      const provId = sourceId.split('||')[0]; // e.g. "p1"
      const rowNum = parseInt(sourceId.split('||')[1]);
      const pname  = PROV_ID_TO_NAME[provId];
      const arr    = pname ? (PC_RAW[pname] || []) : [];
      if (arr.length) {
        const newArr = arr.filter((r, i) => {
          const rrow = typeof r === 'object' ? (r.row ?? r.n ?? i) : r[0];
          return rrow !== rowNum;
        });
        if (newArr.length < arr.length) {
          // Re-index rows
          newArr.forEach((r, i) => { if (r && typeof r === 'object') r.row = i; });
          PC_RAW[pname] = newArr;
          centersChanged = true;
        }
      }
    }

    DB.edits = edits; DB.rTags = rTags; DB.notes = noteMap;

    // Save CENTERS
    await client.query(
      `INSERT INTO centers_master (key, data, updated_at) VALUES ('CENTERS', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(CENTERS)]
    );
    // Save PC_RAW
    await client.query(
      `INSERT INTO centers_master (key, data, updated_at) VALUES ('PC_RAW', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(PC_RAW)]
    );
    // Save main DB
    await client.query(
      `INSERT INTO app_data (key, value, updated_at, updated_by) VALUES ('main', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify(DB), req.user.username]
    );

    await client.query('COMMIT');
    if (_broadcast) _broadcast({ type: 'merge', sourceId, targetId });
    return res.json({ ok: true, sourceId, targetId });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('merge error', e);
    return res.status(500).json({ error: 'خطای سرور هنگام ادغام' });
  } finally {
    client.release();
  }
});

module.exports = router;

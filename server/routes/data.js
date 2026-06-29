'use strict';

const express = require('express');
const { query, pool } = require('../db');
const { requireAuth, requireManager } = require('../auth');
let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch(e) {}

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// Helper: load full DB from normalized SQL tables
async function loadDBFromSQL(client) {
  const c = client || pool;
  const [editsR, notesR, tagsR, settingsR, eventsR, checklistR, userKpiR, provKpiR, extraR,
         salesR, callR, visitR, missionR, provHistR, kpiHistR, weR, metaR, clR, hcpR] = await Promise.all([
    c.query('SELECT center_key, data FROM center_edits'),
    c.query('SELECT center_key, notes FROM center_notes'),
    c.query('SELECT center_key, tags FROM center_tags'),
    c.query('SELECT key, value FROM app_settings'),
    c.query('SELECT id, title, description as desc, start_ms as "startMs", all_day as "allDay", color, owner FROM app_events'),
    c.query('SELECT date, username, items, note FROM daily_checklists'),
    c.query('SELECT username, month, calls_per_day as "callsPerDay", visits_per_week as "visitsPerWeek", sales_count as "salesCount", sales_amount as "salesAmount", cash_pct as "cashPct" FROM kpi_user_targets'),
    c.query('SELECT province_id, calls, visits, sales, extra FROM kpi_province_targets'),
    c.query('SELECT id, row_num as row, name, potential, type, lead, province_id, owner FROM center_extras'),
    c.query('SELECT id, date, username as "userId", center_name as "centerName", center_key as "centerKey", amount, is_cash as "isCash" FROM sales_log'),
    c.query('SELECT id, date, username as "userId", count, note FROM call_log'),
    c.query('SELECT id, date, username as "userId", count, note FROM visit_log'),
    c.query('SELECT id, username as "userId", month, done, note FROM mission_log'),
    c.query('SELECT province_id as "provId", province_name as "provName", from_owner as "from", from_name as "fromName", to_owner as "to", to_name as "toName", action_date as "at", action_ts as "ts" FROM province_history ORDER BY id'),
    c.query('SELECT username as "userId", month, data FROM kpi_history'),
    c.query('SELECT key, value FROM week_entries').catch(() => ({ rows: [] })),
    c.query("SELECT updated_at FROM app_data WHERE key = '_db_meta'"),
    c.query('SELECT at, "by", rkey, field, val FROM change_log ORDER BY at DESC LIMIT 500').catch(() => ({ rows: [] })),
    c.query('SELECT a.center_key, h.name, h.specialty, a.role as title, h.phones FROM hcp_affiliations a JOIN healthcare_professionals h ON a.hcp_id = h.id').catch(() => ({ rows: [] }))
  ]);

  const edits = {};
  editsR.rows.forEach(function(r) { edits[r.center_key] = r.data || {}; edits[r.center_key].contacts = []; });
  
  if (hcpR && hcpR.rows) {
    hcpR.rows.forEach(function(r) {
      if (!edits[r.center_key]) edits[r.center_key] = { contacts: [] };
      if (!edits[r.center_key].contacts) edits[r.center_key].contacts = [];
      edits[r.center_key].contacts.push({
        name: r.name,
        title: r.title,
        phones: r.phones || [],
        specialty: r.specialty
      });
    });
  }

  const notes = {};
  notesR.rows.forEach(function(r) { notes[r.center_key] = r.notes; });

  const rTags = {};
  tagsR.rows.forEach(function(r) { rTags[r.center_key] = r.tags; });

  const kpiTargets = {};
  const settings = {};
  settingsR.rows.forEach(function(r) {
    if (r.key === 'kpi_weights') {
      kpiTargets.weights = r.value;
    } else {
      settings[r.key] = r.value;
    }
  });
  if (settings.anthropicKey) settings.anthropicKey = '***';

  const checklist = {};
  checklistR.rows.forEach(function(r) {
    checklist[r.date + '_' + r.username] = { items: r.items, note: r.note };
  });

  const provinces = {};
  provKpiR.rows.forEach(function(r) {
    provinces[r.province_id] = { calls: r.calls, visits: r.visits, sales: r.sales, extra: r.extra };
  });
  kpiTargets.provinces = provinces;

  userKpiR.rows.forEach(function(r) {
    kpiTargets[r.username + ':' + r.month] = {
      callsPerDay: r.callsPerDay,
      visitsPerWeek: r.visitsPerWeek,
      salesCount: r.salesCount,
      salesAmount: Number(r.salesAmount),
      cashPct: r.cashPct
    };
  });

  const weekEntries = {};
  weR.rows.forEach(function(r) { weekEntries[r.key] = r.value; });

  const _serverTs = metaR.rows.length && metaR.rows[0].updated_at
    ? metaR.rows[0].updated_at.toISOString() : null;

  return {
    edits,
    notes,
    rTags,
    settings,
    events: eventsR.rows,
    checklist,
    kpiTargets,
    extra: extraR.rows,
    salesLog: salesR.rows.map(function(r) { return { ...r, amount: Number(r.amount) }; }),
    callLog: callR.rows,
    visitLog: visitR.rows,
    missionLog: missionR.rows,
    provHistory: provHistR.rows.map(function(r) { return { ...r, ts: Number(r.ts) }; }),
    kpiHistory: kpiHistR.rows.map(function(r) { return r.data; }),
    weekEntries,
    changeLog: clR.rows.map(function(r) {
      return { at: r.at instanceof Date ? r.at.toISOString() : r.at, by: r.by, rkey: r.rkey, field: r.field, val: r.val };
    }).reverse(),
    _serverTs,
  };
}

// GET /api/data/db — load from normalized SQL tables
router.get('/db', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const db = await loadDBFromSQL(client);
    await client.query('COMMIT');
    return res.json(db);
  } catch (e) {
    await client.query('ROLLBACK').catch(function() {});
    console.error('[data/db GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  } finally {
    client.release();
  }
});

// PUT /api/data/db — split payload into normalized SQL tables
router.put('/db', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'داده نامعتبر' });
  }
  const KNOWN_KEYS = ['edits','notes','tags','rTags','weekEntries','tasks','notifications',
                      'changeLog','settings','events','checklist','kpiTargets','salesLog',
                      'callLog','visitLog','extra','_clientTs','_serverTs','_weDeletedKeys','_mtr',
                      'missionLog','provHistory','kpiHistory'];
  const hasKnown = Object.keys(body).some(k => KNOWN_KEYS.includes(k));
  if (!hasKnown && Object.keys(body).length > 0) {
    return res.status(400).json({ error: 'ساختار داده نامعتبر' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const _clientTs = body._clientTs || null;

    // Conflict detection via _db_meta row (replaces 'main' updated_at)
    const metaRow = await client.query(
      "SELECT updated_at FROM app_data WHERE key = '_db_meta' FOR UPDATE"
    );
    if (_clientTs && metaRow.rows.length && metaRow.rows[0].updated_at) {
      const serverTs = metaRow.rows[0].updated_at.toISOString();
      if (serverTs !== _clientTs) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'تغییرات توسط کاربر دیگری ذخیره شده' });
      }
    }

    const user = req.user.username;
    const { edits, notes, rTags, tags, settings, events, checklist, kpiTargets,
            extra, salesLog, callLog, visitLog, missionLog, provHistory, kpiHistory,
            weekEntries, _weDeletedKeys, _mtr } = body;

    // ── center_edits ──────────────────────────────────────────────────────────
    if (edits && typeof edits === 'object' && Object.keys(edits).length > 0) {
      await client.query(
        `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)
         ON CONFLICT (center_key) DO UPDATE
           SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(edits), user]
      );
    }

    // ── center_notes ──────────────────────────────────────────────────────────
    if (notes && typeof notes === 'object' && Object.keys(notes).length > 0) {
      await client.query(
        `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)
         ON CONFLICT (center_key) DO UPDATE
           SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(notes), user]
      );
    }

    // ── center_tags ───────────────────────────────────────────────────────────
    const tagsData = rTags || tags;
    if (tagsData && typeof tagsData === 'object' && Object.keys(tagsData).length > 0) {
      await client.query(
        `INSERT INTO center_tags (center_key, tags, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)
         ON CONFLICT (center_key) DO UPDATE
           SET tags = EXCLUDED.tags, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(tagsData), user]
      );
    }

    // ── app_settings ──────────────────────────────────────────────────────────
    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        if (key === 'anthropicKey' && value === '***') continue;
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [key, JSON.stringify(value), user]
        );
      }
    }

    // ── structured SQL tables saving ─────────────────────────────────────────
    // 1. events
    if (events !== undefined && Array.isArray(events)) {
      await client.query('DELETE FROM app_events');
      for (const ev of events) {
        if (!ev || ev.id === undefined) continue;
        await client.query(
          `INSERT INTO app_events (id, title, description, start_ms, all_day, color, owner, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [ev.id, ev.title || '', ev.desc || '', ev.startMs || 0, !!ev.allDay, ev.color || null, ev.owner || null, user]
        );
      }
    }

    // 2. checklist
    if (checklist !== undefined && typeof checklist === 'object' && checklist !== null) {
      await client.query('DELETE FROM daily_checklists');
      for (const [key, value] of Object.entries(checklist)) {
        if (!value) continue;
        const parts = key.split('_');
        if (parts.length >= 2) {
          const date = parts[0];
          const username = parts.slice(1).join('_');
          const items = value.items || [];
          const note = value.note || '';
          await client.query(
            `INSERT INTO daily_checklists (date, username, items, note, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, NOW(), $5)`,
            [date, username, JSON.stringify(items), note, user]
          );
        }
      }
    }

    // 3. extra
    if (extra !== undefined && Array.isArray(extra)) {
      await client.query('DELETE FROM center_extras');
      for (const c of extra) {
        if (!c || !c.id) continue;
        await client.query(
          `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
          [c.id, c.row || 0, c.name || '', c.potential || 1, c.type || null, c.lead || 'سرنخ', c.province_id || '', c.owner || null, user]
        );
      }
    }

    // 4. kpiTargets
    if (kpiTargets !== undefined && typeof kpiTargets === 'object' && kpiTargets !== null) {
      // 1. Weights
      if (kpiTargets.weights) {
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at, updated_by)
           VALUES ('kpi_weights', $1, NOW(), $2)
           ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW(), updated_by=$2`,
          [JSON.stringify(kpiTargets.weights), user]
        );
      }
      // 2. Provinces
      await client.query('DELETE FROM kpi_province_targets');
      if (kpiTargets.provinces && typeof kpiTargets.provinces === 'object') {
        for (const [provId, targets] of Object.entries(kpiTargets.provinces)) {
          if (!targets) continue;
          await client.query(
            `INSERT INTO kpi_province_targets (province_id, calls, visits, sales, extra, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [provId, targets.calls || 0, targets.visits || 0, targets.sales || 0, targets.extra || 0, user]
          );
        }
      }
      // 3. User targets
      await client.query('DELETE FROM kpi_user_targets');
      for (const [key, value] of Object.entries(kpiTargets)) {
        if (key === 'weights' || key === 'provinces' || !value) continue;
        if (key.includes(':')) {
          const [username, month] = key.split(':');
          await client.query(
            `INSERT INTO kpi_user_targets (username, month, calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
            [username, month, value.callsPerDay || 10, value.visitsPerWeek || 5, value.salesCount || 5, value.salesAmount || 0, value.cashPct || 50, user]
          );
        }
      }
    }

    // 5. callLog
    if (callLog !== undefined && Array.isArray(callLog)) {
      await client.query('DELETE FROM call_log');
      for (const l of callLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO call_log (id, date, username, count, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
        );
      }
    }

    // 6. visitLog
    if (visitLog !== undefined && Array.isArray(visitLog)) {
      await client.query('DELETE FROM visit_log');
      for (const l of visitLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO visit_log (id, date, username, count, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
        );
      }
    }

    // 7. salesLog
    if (salesLog !== undefined && Array.isArray(salesLog)) {
      await client.query('DELETE FROM sales_log');
      for (const l of salesLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [l.id, l.date || '', l.userId || '', l.centerName || '', l.centerKey || null, l.amount || 0, !!l.isCash, user]
        );
      }
    }

    // 8. missionLog
    if (missionLog !== undefined && Array.isArray(missionLog)) {
      await client.query('DELETE FROM mission_log');
      for (const l of missionLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO mission_log (id, username, month, done, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.userId || '', l.month || '', !!l.done, l.note || null, user]
        );
      }
    }

    // 9. provHistory
    if (provHistory !== undefined && Array.isArray(provHistory)) {
      await client.query('DELETE FROM province_history');
      for (const h of provHistory) {
        if (!h) continue;
        await client.query(
          `INSERT INTO province_history (province_id, province_name, from_owner, from_name, to_owner, to_name, action_date, action_ts, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [h.provId, h.provName || '', h.from || null, h.fromName || null, h.to || null, h.toName || null, h.at || '', h.ts || 0]
        );
      }
    }

    // 10. kpiHistory
    if (kpiHistory !== undefined && Array.isArray(kpiHistory)) {
      await client.query('DELETE FROM kpi_history');
      for (const s of kpiHistory) {
        if (!s || !s.userId || !s.month) continue;
        await client.query(
          `INSERT INTO kpi_history (username, month, data, updated_at)
           VALUES ($1, $2, $3, NOW())`,
          [s.userId, s.month, JSON.stringify(s)]
        );
      }
    }

    // ── week_entries ──────────────────────────────────────────────────────────
    const incomingWE = weekEntries || {};
    const deletedKeys = (Array.isArray(_weDeletedKeys) ? _weDeletedKeys : [])
      .filter(function(k) { return !incomingWE[k]; });
    if (deletedKeys.length > 0) {
      await client.query('DELETE FROM week_entries WHERE key = ANY($1::text[])', [deletedKeys])
        .catch(function(e) { console.warn('[week_entries DELETE]', e.message); });
    }
    if (Object.keys(incomingWE).length > 0) {
      await client.query(
        `INSERT INTO week_entries (key, value, updated_at, updated_by)
         SELECT e.key, e.value, NOW(), $2 FROM jsonb_each($1::jsonb) AS e(key, value)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(incomingWE), user]
      ).catch(function(e) { console.error('[week_entries upsert FAILED]', e.message); throw e; });
    }

    // ── _mtr ──────────────────────────────────────────────────────────────────
    if (_mtr) {
      await client.query(
        `INSERT INTO app_data (key, value, updated_at, updated_by)
         VALUES ('mtr', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(_mtr), user]
      );
    }

    // ── update _db_meta timestamp (used for conflict detection) ───────────────
    const upserted = await client.query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('_db_meta', '{}', NOW(), $1)
       ON CONFLICT (key) DO UPDATE SET value = '{}', updated_at = NOW(), updated_by = $1
       RETURNING updated_at`,
      [user]
    );

    // Save current version to history (keeps 30 days)
    // Use SAVEPOINT so history saving failure doesn't block the actual save
    await client.query('SAVEPOINT history_ops');
    try {
      const dbSnap = {
        edits, notes, rTags, tags, settings, events, checklist, kpiTargets,
        extra, salesLog, callLog, visitLog, weekEntries: incomingWE
      };
      await client.query(
        `INSERT INTO app_data_history (key, value, saved_by)
         VALUES ('main', $1, $2)`,
        [JSON.stringify(dbSnap), user]
      );
      await client.query(
        `DELETE FROM app_data_history WHERE key = 'main' AND saved_at < NOW() - INTERVAL '30 days'`
      );
      await client.query('RELEASE SAVEPOINT history_ops');
    } catch (histErr) {
      console.warn('[history_ops FAILED]', histErr.message);
      await client.query('ROLLBACK TO SAVEPOINT history_ops').catch(()=>{});
    }

    await client.query('COMMIT');

    const _serverTs = upserted.rows[0].updated_at.toISOString();
    const _cid = req.headers['x-cid'] || '';
    try { if (_broadcast) _broadcast('db-updated', { by: user, at: Date.now() }, _cid); } catch(e) {}
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
  let client;
  try {
    const hist = await query('SELECT value FROM app_data_history WHERE id = $1 AND key = $2', [id, 'main']);
    if (!hist.rows.length) return res.status(404).json({ error: 'نسخه یافت نشد' });
    const snap = hist.rows[0].value || {};
    const user = req.user.username;

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. center_edits
    const edits = snap.edits || {};
    await client.query('DELETE FROM center_edits');
    if (Object.keys(edits).length > 0) {
      await client.query(
        `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
        [JSON.stringify(edits), user]
      );
    }

    // 2. center_notes
    const notes = snap.notes || {};
    await client.query('DELETE FROM center_notes');
    if (Object.keys(notes).length > 0) {
      await client.query(
        `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
        [JSON.stringify(notes), user]
      );
    }

    // 3. center_tags
    const rTags = snap.rTags || snap.tags || {};
    await client.query('DELETE FROM center_tags');
    if (Object.keys(rTags).length > 0) {
      await client.query(
        `INSERT INTO center_tags (center_key, tags, updated_at, updated_by)
         SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
        [JSON.stringify(rTags), user]
      );
    }

    // 4. app_settings
    const settings = snap.settings || {};
    await client.query('DELETE FROM app_settings');
    if (Object.keys(settings).length > 0) {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)`,
          [key, JSON.stringify(value), user]
        );
      }
    }

    // 5. Structured SQL tables restore from snapshot
    // 1. events
    if (snap.events !== undefined && Array.isArray(snap.events)) {
      await client.query('DELETE FROM app_events');
      for (const ev of snap.events) {
        if (!ev || ev.id === undefined) continue;
        await client.query(
          `INSERT INTO app_events (id, title, description, start_ms, all_day, color, owner, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [ev.id, ev.title || '', ev.desc || '', ev.startMs || 0, !!ev.allDay, ev.color || null, ev.owner || null, user]
        );
      }
    }

    // 2. checklist
    if (snap.checklist !== undefined && typeof snap.checklist === 'object' && snap.checklist !== null) {
      await client.query('DELETE FROM daily_checklists');
      for (const [key, value] of Object.entries(snap.checklist)) {
        if (!value) continue;
        const parts = key.split('_');
        if (parts.length >= 2) {
          const date = parts[0];
          const username = parts.slice(1).join('_');
          const items = value.items || [];
          const note = value.note || '';
          await client.query(
            `INSERT INTO daily_checklists (date, username, items, note, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, NOW(), $5)`,
            [date, username, JSON.stringify(items), note, user]
          );
        }
      }
    }

    // 3. extra
    if (snap.extra !== undefined && Array.isArray(snap.extra)) {
      await client.query('DELETE FROM center_extras');
      for (const c of snap.extra) {
        if (!c || !c.id) continue;
        await client.query(
          `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
          [c.id, c.row || 0, c.name || '', c.potential || 1, c.type || null, c.lead || 'سرنخ', c.province_id || '', c.owner || null, user]
        );
      }
    }

    // 4. kpiTargets
    if (snap.kpiTargets !== undefined && typeof snap.kpiTargets === 'object' && snap.kpiTargets !== null) {
      if (snap.kpiTargets.weights) {
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at, updated_by)
           VALUES ('kpi_weights', $1, NOW(), $2)
           ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW(), updated_by=$2`,
          [JSON.stringify(snap.kpiTargets.weights), user]
        );
      }
      await client.query('DELETE FROM kpi_province_targets');
      if (snap.kpiTargets.provinces && typeof snap.kpiTargets.provinces === 'object') {
        for (const [provId, targets] of Object.entries(snap.kpiTargets.provinces)) {
          if (!targets) continue;
          await client.query(
            `INSERT INTO kpi_province_targets (province_id, calls, visits, sales, extra, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [provId, targets.calls || 0, targets.visits || 0, targets.sales || 0, targets.extra || 0, user]
          );
        }
      }
      await client.query('DELETE FROM kpi_user_targets');
      for (const [key, value] of Object.entries(snap.kpiTargets)) {
        if (key === 'weights' || key === 'provinces' || !value) continue;
        if (key.includes(':')) {
          const [username, month] = key.split(':');
          await client.query(
            `INSERT INTO kpi_user_targets (username, month, calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
            [username, month, value.callsPerDay || 10, value.visitsPerWeek || 5, value.salesCount || 5, value.salesAmount || 0, value.cashPct || 50, user]
          );
        }
      }
    }

    // 5. callLog
    if (snap.callLog !== undefined && Array.isArray(snap.callLog)) {
      await client.query('DELETE FROM call_log');
      for (const l of snap.callLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO call_log (id, date, username, count, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
        );
      }
    }

    // 6. visitLog
    if (snap.visitLog !== undefined && Array.isArray(snap.visitLog)) {
      await client.query('DELETE FROM visit_log');
      for (const l of snap.visitLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO visit_log (id, date, username, count, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
        );
      }
    }

    // 7. salesLog
    if (snap.salesLog !== undefined && Array.isArray(snap.salesLog)) {
      await client.query('DELETE FROM sales_log');
      for (const l of snap.salesLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [l.id, l.date || '', l.userId || '', l.centerName || '', l.centerKey || null, l.amount || 0, !!l.isCash, user]
        );
      }
    }

    // 8. missionLog
    if (snap.missionLog !== undefined && Array.isArray(snap.missionLog)) {
      await client.query('DELETE FROM mission_log');
      for (const l of snap.missionLog) {
        if (!l || !l.id) continue;
        await client.query(
          `INSERT INTO mission_log (id, username, month, done, note, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [l.id, l.userId || '', l.month || '', !!l.done, l.note || null, user]
        );
      }
    }

    // 9. provHistory
    if (snap.provHistory !== undefined && Array.isArray(snap.provHistory)) {
      await client.query('DELETE FROM province_history');
      for (const h of snap.provHistory) {
        if (!h) continue;
        await client.query(
          `INSERT INTO province_history (province_id, province_name, from_owner, from_name, to_owner, to_name, action_date, action_ts, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [h.provId, h.provName || '', h.from || null, h.fromName || null, h.to || null, h.toName || null, h.at || '', h.ts || 0]
        );
      }
    }

    // 10. kpiHistory
    if (snap.kpiHistory !== undefined && Array.isArray(snap.kpiHistory)) {
      await client.query('DELETE FROM kpi_history');
      for (const s of snap.kpiHistory) {
        if (!s || !s.userId || !s.month) continue;
        await client.query(
          `INSERT INTO kpi_history (username, month, data, updated_at)
           VALUES ($1, $2, $3, NOW())`,
          [s.userId, s.month, JSON.stringify(s)]
        );
      }
    }

    // 6. week_entries
    const weSource = snap.weekEntries || {};
    await client.query('DELETE FROM week_entries');
    if (Object.keys(weSource).length > 0) {
      await client.query(
        `INSERT INTO week_entries (key, value, updated_at, updated_by)
         SELECT e.key, e.value, NOW(), $2 FROM jsonb_each($1::jsonb) AS e(key, value)`,
        [JSON.stringify(weSource), user]
      );
    }

    // 7. update _db_meta to new timestamp
    const upserted = await client.query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('_db_meta', '{}', NOW(), $1)
       ON CONFLICT (key) DO UPDATE SET value = '{}', updated_at = NOW(), updated_by = $1
       RETURNING updated_at`,
      [user]
    );

    await client.query('COMMIT');
    console.log(`[data/history restore] id=${id} by=${user}`);
    return res.json({ ok: true });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(function() {});
    console.error('[data/history restore]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  } finally {
    if (client) client.release();
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

// GET /api/data/backup — manager only
router.get('/backup', requireManager, async (req, res) => {
  try {
    const [db, mtrR, usersR, centersR] = await Promise.all([
      loadDBFromSQL(),
      query("SELECT value FROM app_data WHERE key = 'mtr'"),
      query('SELECT username, display_name, role, color, phone, active FROM app_users ORDER BY username'),
      query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    ]);

    const centers = { CENTERS: [], PC_RAW: {} };
    centersR.rows.forEach(function(row) {
      if (row.key === 'CENTERS') centers.CENTERS = row.data;
      else if (row.key === 'PC_RAW') centers.PC_RAW = row.data;
    });

    return res.json({
      db: db,
      mtr: mtrR.rows.length ? mtrR.rows[0].value : {},
      users: usersR.rows,
      centers: centers,
      weekEntries: db.weekEntries || {},
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
  const user = req.user.username;

  try {
    // Restore normalized tables from backup snapshot
    if (db && typeof db === 'object') {
      if (db.edits && typeof db.edits === 'object' && Object.keys(db.edits).length) {
        await query('DELETE FROM center_edits');
        await query(
          `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
           SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
          [JSON.stringify(db.edits), user]
        );
      }
      if (db.notes && typeof db.notes === 'object' && Object.keys(db.notes).length) {
        await query('DELETE FROM center_notes');
        await query(
          `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
           SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
          [JSON.stringify(db.notes), user]
        );
      }
      const tagsData = db.rTags || db.tags;
      if (tagsData && typeof tagsData === 'object' && Object.keys(tagsData).length) {
        await query('DELETE FROM center_tags');
        await query(
          `INSERT INTO center_tags (center_key, tags, updated_at, updated_by)
           SELECT key, value, NOW(), $2 FROM jsonb_each($1::jsonb)`,
          [JSON.stringify(tagsData), user]
        );
      }
      if (db.settings && typeof db.settings === 'object') {
        for (const [key, value] of Object.entries(db.settings)) {
          await query(
            `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
            [key, JSON.stringify(value), user]
          );
        }
      }
      // 1. events
      if (db.events !== undefined && Array.isArray(db.events)) {
        await query('DELETE FROM app_events');
        for (const ev of db.events) {
          if (!ev || ev.id === undefined) continue;
          await query(
            `INSERT INTO app_events (id, title, description, start_ms, all_day, color, owner, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
            [ev.id, ev.title || '', ev.desc || '', ev.startMs || 0, !!ev.allDay, ev.color || null, ev.owner || null, user]
          );
        }
      }

      // 2. checklist
      if (db.checklist !== undefined && typeof db.checklist === 'object' && db.checklist !== null) {
        await query('DELETE FROM daily_checklists');
        for (const [key, value] of Object.entries(db.checklist)) {
          if (!value) continue;
          const parts = key.split('_');
          if (parts.length >= 2) {
            const date = parts[0];
            const username = parts.slice(1).join('_');
            const items = value.items || [];
            const note = value.note || '';
            await query(
              `INSERT INTO daily_checklists (date, username, items, note, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, NOW(), $5)`,
              [date, username, JSON.stringify(items), note, user]
            );
          }
        }
      }

      // 3. extra
      if (db.extra !== undefined && Array.isArray(db.extra)) {
        await query('DELETE FROM center_extras');
        for (const c of db.extra) {
          if (!c || !c.id) continue;
          await query(
            `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
            [c.id, c.row || 0, c.name || '', c.potential || 1, c.type || null, c.lead || 'سرنخ', c.province_id || '', c.owner || null, user]
          );
        }
      }

      // 4. kpiTargets
      if (db.kpiTargets !== undefined && typeof db.kpiTargets === 'object' && db.kpiTargets !== null) {
        if (db.kpiTargets.weights) {
          await query(
            `INSERT INTO app_settings (key, value, updated_at, updated_by)
             VALUES ('kpi_weights', $1, NOW(), $2)
             ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW(), updated_by=$2`,
            [JSON.stringify(db.kpiTargets.weights), user]
          );
        }
        await query('DELETE FROM kpi_province_targets');
        if (db.kpiTargets.provinces && typeof db.kpiTargets.provinces === 'object') {
          for (const [provId, targets] of Object.entries(db.kpiTargets.provinces)) {
            if (!targets) continue;
            await query(
              `INSERT INTO kpi_province_targets (province_id, calls, visits, sales, extra, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
              [provId, targets.calls || 0, targets.visits || 0, targets.sales || 0, targets.extra || 0, user]
            );
          }
        }
        await query('DELETE FROM kpi_user_targets');
        for (const [key, value] of Object.entries(db.kpiTargets)) {
          if (key === 'weights' || key === 'provinces' || !value) continue;
          if (key.includes(':')) {
            const [username, month] = key.split(':');
            await query(
              `INSERT INTO kpi_user_targets (username, month, calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
              [username, month, value.callsPerDay || 10, value.visitsPerWeek || 5, value.salesCount || 5, value.salesAmount || 0, value.cashPct || 50, user]
            );
          }
        }
      }

      // 5. callLog
      if (db.callLog !== undefined && Array.isArray(db.callLog)) {
        await query('DELETE FROM call_log');
        for (const l of db.callLog) {
          if (!l || !l.id) continue;
          await query(
            `INSERT INTO call_log (id, date, username, count, note, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
          );
        }
      }

      // 6. visitLog
      if (db.visitLog !== undefined && Array.isArray(db.visitLog)) {
        await query('DELETE FROM visit_log');
        for (const l of db.visitLog) {
          if (!l || !l.id) continue;
          await query(
            `INSERT INTO visit_log (id, date, username, count, note, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [l.id, l.date || '', l.userId || '', l.count || 0, l.note || null, user]
          );
        }
      }

      // 7. salesLog
      if (db.salesLog !== undefined && Array.isArray(db.salesLog)) {
        await query('DELETE FROM sales_log');
        for (const l of db.salesLog) {
          if (!l || !l.id) continue;
          await query(
            `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
            [l.id, l.date || '', l.userId || '', l.centerName || '', l.centerKey || null, l.amount || 0, !!l.isCash, user]
          );
        }
      }

      // 8. missionLog
      if (db.missionLog !== undefined && Array.isArray(db.missionLog)) {
        await query('DELETE FROM mission_log');
        for (const l of db.missionLog) {
          if (!l || !l.id) continue;
          await query(
            `INSERT INTO mission_log (id, username, month, done, note, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [l.id, l.userId || '', l.month || '', !!l.done, l.note || null, user]
          );
        }
      }

      // 9. provHistory
      if (db.provHistory !== undefined && Array.isArray(db.provHistory)) {
        await query('DELETE FROM province_history');
        for (const h of db.provHistory) {
          if (!h) continue;
          await query(
            `INSERT INTO province_history (province_id, province_name, from_owner, from_name, to_owner, to_name, action_date, action_ts, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [h.provId, h.provName || '', h.from || null, h.fromName || null, h.to || null, h.toName || null, h.at || '', h.ts || 0]
          );
        }
      }

      // 10. kpiHistory
      if (db.kpiHistory !== undefined && Array.isArray(db.kpiHistory)) {
        await query('DELETE FROM kpi_history');
        for (const s of db.kpiHistory) {
          if (!s || !s.userId || !s.month) continue;
          await query(
            `INSERT INTO kpi_history (username, month, data, updated_at)
             VALUES ($1, $2, $3, NOW())`,
            [s.userId, s.month, JSON.stringify(s)]
          );
        }
      }
    }

    const weSource = (db && db.weekEntries) || weekEntries;
    if (weSource && typeof weSource === 'object' && Object.keys(weSource).length) {
      await query('DELETE FROM week_entries');
      await query(
        `INSERT INTO week_entries (key, value, updated_at, updated_by)
         SELECT e.key, e.value, NOW(), $2 FROM jsonb_each($1::jsonb) AS e(key, value)`,
        [JSON.stringify(weSource), user]
      );
    }

    if (mtr && typeof mtr === 'object') {
      await query(
        `INSERT INTO app_data (key, value, updated_at, updated_by) VALUES ('mtr', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(mtr), user]
      );
    }

    if (users && Array.isArray(users)) {
      for (const u of users) {
        if (!u.username) continue;
        await query(
          `INSERT INTO app_users (username, display_name, role, color, phone, active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE
           SET display_name=$2, role=$3, color=$4, phone=$5, active=$6`,
          [u.username, u.display_name || u.username, u.role || 'کارشناس فروش',
           u.color || '#0ea5e9', u.phone || '', u.active !== false]
        );
      }
    }

    if (centers && centers.CENTERS) {
      await query(
        `INSERT INTO centers_master (key, data, updated_at) VALUES ('CENTERS', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(centers.CENTERS)]
      );
    }
    if (centers && centers.PC_RAW) {
      await query(
        `INSERT INTO centers_master (key, data, updated_at) VALUES ('PC_RAW', $1, NOW())
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

// GET /api/data/debug/center?id=p13||97 — manager only, diagnose center data collisions
router.get('/debug/center', requireManager, async (req, res) => {
  const centerId = req.query.id;
  if (!centerId) return res.status(400).json({ error: 'id param required' });
  try {
    const [extraR, editsR, cmR] = await Promise.all([
      query("SELECT value FROM app_data WHERE key = 'extra'"),
      query('SELECT data FROM center_edits WHERE center_key = $1', [`pc_${centerId}`]),
      query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS','PC_RAW')"),
    ]);
    const extra = (extraR.rows.length ? extraR.rows[0].value : []).filter(x => String(x.id) === String(centerId));
    const editsKey = editsR.rows.length ? editsR.rows[0].data : null;
    const cmData = {};
    for (const r of cmR.rows) cmData[r.key] = r.data;
    const pcRawMatches = [];
    const PC_RAW = cmData['PC_RAW'] || {};
    for (const [provName, entries] of Object.entries(PC_RAW)) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((r, idx) => {
        const rid = Array.isArray(r) ? r[0] : (r.row ?? r.n ?? idx);
        const rname = Array.isArray(r) ? (r[1]||'') : (r.name||r[1]||'');
        if (String(rid) === String(centerId).split('||')[1]) {
          pcRawMatches.push({ provName, idx, rid, name: rname, raw: r });
        }
      });
    }
    return res.json({ centerId, extra, pcRawMatches, editsKey });
  } catch (e) {
    return res.status(500).json({ error: e.message });
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

    // Load center data from normalized tables
    const [editsRes, tagsRes, notesRes] = await Promise.all([
      client.query('SELECT center_key, data FROM center_edits WHERE center_key = ANY($1::text[])',
        [[srcKey, tgtKey]]),
      client.query('SELECT center_key, tags FROM center_tags WHERE center_key = ANY($1::text[])',
        [[srcKey, tgtKey]]),
      client.query('SELECT center_key, notes FROM center_notes WHERE center_key = ANY($1::text[])',
        [[srcKey, tgtKey]]),
    ]);
    const edits   = {};
    const rTags   = {};
    const noteMap = {};
    editsRes.rows.forEach(r  => { edits[r.center_key]   = r.data;  });
    tagsRes.rows.forEach(r   => { rTags[r.center_key]   = r.tags;  });
    notesRes.rows.forEach(r  => { noteMap[r.center_key] = r.notes; });

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
      if (!sourceId.includes('||')) {
        return res.status(400).json({ error: 'Invalid province center ID format' });
      }
      const provId = sourceId.split('||')[0]; // e.g. "p1"
      const rowNum = parseInt(sourceId.split('||')[1], 10);
      if (isNaN(rowNum)) return res.status(400).json({ error: 'Invalid row number in center ID' });
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

    // Save merged center data back to normalized tables
    if (edits[tgtKey] !== undefined) {
      await client.query(
        `INSERT INTO center_edits (center_key, data, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (center_key) DO UPDATE SET data=$2, updated_at=NOW(), updated_by=$3`,
        [tgtKey, JSON.stringify(edits[tgtKey] || {}), req.user.username]
      );
    }
    if (edits[srcKey] === undefined) {
      await client.query('DELETE FROM center_edits WHERE center_key = $1', [srcKey]);
    }
    if (rTags[tgtKey] !== undefined) {
      await client.query(
        `INSERT INTO center_tags (center_key, tags, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (center_key) DO UPDATE SET tags=$2, updated_at=NOW(), updated_by=$3`,
        [tgtKey, JSON.stringify(rTags[tgtKey] || []), req.user.username]
      );
    }
    await client.query('DELETE FROM center_tags WHERE center_key = $1', [srcKey]);
    if (noteMap[tgtKey] !== undefined) {
      await client.query(
        `INSERT INTO center_notes (center_key, notes, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (center_key) DO UPDATE SET notes=$2, updated_at=NOW(), updated_by=$3`,
        [tgtKey, JSON.stringify(noteMap[tgtKey] || []), req.user.username]
      );
    }
    await client.query('DELETE FROM center_notes WHERE center_key = $1', [srcKey]);

    // Migrate week_entries: rename keys that reference the source center
    // week_entries key format: "{weekId}:::{rtype}_{rid}" or "{weekId}:::{recKey}"
    const weRows = await client.query(
      `SELECT key, value FROM week_entries WHERE key LIKE $1`,
      [`%${sourceId}%`]
    );
    for (const row of weRows.rows) {
      const newKey = row.key.replace(sourceId, targetId);
      if (newKey !== row.key) {
        // Merge into target key if it exists, otherwise rename
        const newVal = Object.assign({}, row.value, {
          rid: targetId,
          recKey: (row.value.recKey || '').replace(sourceId, targetId),
          centerName: row.value.centerName, // keep original name until next save
        });
        await client.query(
          `INSERT INTO week_entries (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
          [newKey, JSON.stringify(newVal), req.user.username]
        );
        await client.query(`DELETE FROM week_entries WHERE key = $1`, [row.key]);
      }
    }

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

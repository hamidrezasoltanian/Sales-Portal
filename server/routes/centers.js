'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const {
  buildOwnerMaps,
  resolveCenterOwner,
  isManagerRole,
  getUserProvinceAllowlist,
  applyProvinceRestriction,
} = require('../lib/center-ownership');
const { softDeleteCenterNote, filterActiveNotes, activeNoteIndexToRaw } = require('../lib/soft-delete');

const router = express.Router();
router.use(requireAuth);

let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch (e) {}

function notifyCenterChange(req, data) {
  try {
    if (_broadcast) {
      _broadcast('center-changed', Object.assign({ at: Date.now(), by: req.user.username }, data || {}), req.headers['x-cid'] || '');
    }
  } catch (e) {}
}

const AUDIT_FIELDS = ['status', 'owner', 'lead', 'potential', 'followupDate', 'contactName', 'contactTitle', 'phones', 'address'];

async function loadOwnerCtx() {
  const [masterR, extraR, editsR] = await Promise.all([
    query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    query('SELECT id, row_num as row, province_id, owner FROM center_extras'),
    query('SELECT center_key, data FROM center_edits'),
  ]);
  const centersMaster = {};
  masterR.rows.forEach(function (r) { centersMaster[r.key] = r.data; });
  const edits = {};
  editsR.rows.forEach(function (r) { edits[r.center_key] = r.data || {}; });
  return { ownerMaps: buildOwnerMaps(centersMaster, extraR.rows), edits };
}

async function assertCenterAccess(req, centerKey) {
  if (isManagerRole(req.user.role)) return true;
  const ctx = await loadOwnerCtx();
  const provAllow = getUserProvinceAllowlist(req.user);
  if (provAllow && !applyProvinceRestriction(new Set([centerKey]), provAllow).has(centerKey)) {
    return false;
  }
  const owner = resolveCenterOwner(centerKey, ctx.edits, ctx.ownerMaps);
  if (owner === null) return true;
  return owner === req.user.username;
}

router.get('/:key', async function (req, res) {
  try {
    const centerKey = decodeURIComponent(req.params.key);
    if (!(await assertCenterAccess(req, centerKey))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const result = await query('SELECT data, updated_at FROM center_edits WHERE center_key = $1', [centerKey]);
    if (!result.rows.length) {
      return res.json({ centerKey, data: {}, updatedAt: null });
    }
    res.json({
      centerKey,
      data: result.rows[0].data || {},
      updatedAt: result.rows[0].updated_at,
    });
  } catch (e) {
    console.error('[centers GET /:key]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.patch('/:key', async function (req, res) {
  try {
    const centerKey = decodeURIComponent(req.params.key);
    if (!(await assertCenterAccess(req, centerKey))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const { field, val, centerName, oldValue } = req.body || {};
    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'field الزامی است' });
    }

    const _ts = Date.now();
    const patch = { [field]: val, _ts };
    if (field === 'status' || field === 'lead' || field === 'potential') patch._lastActivity = _ts;
    if (field === 'status') patch._statusChangedTs = _ts;

    const result = await query(
      `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (center_key) DO UPDATE
         SET data = center_edits.data || EXCLUDED.data,
             updated_at = NOW(),
             updated_by = $3
       RETURNING data, updated_at`,
      [centerKey, JSON.stringify(patch), req.user.username]
    );

    const valStr = val !== undefined && val !== null ? JSON.stringify(val) : null;
    await query(
      'INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, $3, $4)',
      [req.user.username, centerKey, field, valStr]
    );

    if (AUDIT_FIELDS.indexOf(field) >= 0 && String(oldValue ?? '') !== String(val ?? '')) {
      await query(
        `INSERT INTO center_audit (center_key, center_name, field, old_value, new_value, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [centerKey, centerName || '', field, String(oldValue ?? ''), String(val ?? ''), req.user.username]
      ).catch(function () {});
    }

    notifyCenterChange(req, { centerKey, field });
    res.json({
      ok: true,
      centerKey,
      _ts,
      data: result.rows[0].data,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (e) {
    console.error('[centers PATCH /:key]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.post('/:key/notes', async function (req, res) {
  try {
    const centerKey = decodeURIComponent(req.params.key);
    if (!(await assertCenterAccess(req, centerKey))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const text = ((req.body && req.body.text) || '').trim();
    if (!text) return res.status(400).json({ error: 'متن یادداشت الزامی است' });

    const note = {
      text,
      date: (req.body && req.body.date) || null,
      user: req.user.name || req.user.username,
      by: req.user.username,
      ts: new Date().toISOString(),
    };
    if (req.body && req.body.noteTags) note.noteTags = req.body.noteTags;

    const existing = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
    let notes = existing.rows.length ? (existing.rows[0].notes || []) : [];
    if (!Array.isArray(notes)) notes = [];
    notes.push(note);

    await query(
      `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (center_key) DO UPDATE
         SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [centerKey, JSON.stringify(notes), req.user.username]
    );

    notifyCenterChange(req, { centerKey, field: 'notes' });
    res.json({ ok: true, centerKey, notes: filterActiveNotes(notes) });
  } catch (e) {
    console.error('[centers POST /:key/notes]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

router.delete('/:key/notes/:index', async function (req, res) {
  try {
    const centerKey = decodeURIComponent(req.params.key);
    if (!(await assertCenterAccess(req, centerKey))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'index نامعتبر' });

    const existing = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
    if (!existing.rows.length) return res.status(404).json({ error: 'یادداشتی یافت نشد' });

    let notes = existing.rows[0].notes || [];
    if (!Array.isArray(notes)) notes = [];
    const rawIdx = activeNoteIndexToRaw(notes, idx);
    if (rawIdx < 0) return res.status(404).json({ error: 'یادداشت یافت نشد' });
    if (notes[rawIdx] && notes[rawIdx]._deletedAt) return res.status(404).json({ error: 'یادداشت قبلاً حذف شده' });

    const trashRow = await softDeleteCenterNote(centerKey, rawIdx, notes[rawIdx], req.user.username);
    const refreshed = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
    const activeNotes = filterActiveNotes(refreshed.rows.length ? refreshed.rows[0].notes : []);

    notifyCenterChange(req, { centerKey, field: 'notes' });
    res.json({ ok: true, centerKey, trashId: trashRow.id, notes: activeNotes });
  } catch (e) {
    console.error('[centers DELETE /:key/notes/:index]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

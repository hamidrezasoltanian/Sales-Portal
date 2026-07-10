'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

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

// ── GET /api/centers/:key ────────────────────────────────────────────────────
router.get('/:key', requireAuth, async function (req, res) {
  try {
    const result = await query('SELECT data, updated_at FROM center_edits WHERE center_key = $1', [req.params.key]);
    if (!result.rows.length) {
      return res.json({ centerKey: req.params.key, data: {}, updatedAt: null });
    }
    res.json({
      centerKey: req.params.key,
      data: result.rows[0].data || {},
      updatedAt: result.rows[0].updated_at,
    });
  } catch (e) {
    console.error('[centers GET /:key]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PATCH /api/centers/:key ──────────────────────────────────────────────────
// Body: { field, val, centerName?, oldValue? } — single-field update (setE)
router.patch('/:key', requireAuth, async function (req, res) {
  try {
    const centerKey = req.params.key;
    const { field, val, centerName, oldValue } = req.body || {};
    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'field الزامی است' });
    }

    const _ts = Date.now();
    const patch = { [field]: val, _ts: _ts };
    if (field === 'status' || field === 'lead' || field === 'potential') {
      patch._lastActivity = _ts;
    }
    if (field === 'status') {
      patch._statusChangedTs = _ts;
    }

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
      `INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, $3, $4)`,
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

module.exports = router;

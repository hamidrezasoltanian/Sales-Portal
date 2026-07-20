'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const { requireCenterAccess } = require('../lib/center-access');

const router = express.Router();

// ── Helper: map DB row → camelCase object ──────────────────────────────────
function rowToObj(r) {
  return {
    id:    r.id,
    at:    r.at,
    by:    r.by,
    rkey:  r.rkey,
    field: r.field,
    val:   r.val,
  };
}

// ── GET /api/changelog ─────────────────────────────────────────────────────
// Query params: ?rkey=, ?by=, ?from=ISO, ?to=ISO, ?limit=50 (max 2000)
router.get('/', requireAuth, requireManager, async function (req, res) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.rkey) {
      params.push(req.query.rkey);
      conditions.push(`rkey = $${params.length}`);
    }
    if (req.query.by) {
      params.push(req.query.by);
      conditions.push(`"by" = $${params.length}`);
    }
    if (req.query.from) {
      const from = new Date(String(req.query.from));
      if (!isNaN(from.getTime())) {
        params.push(from);
        conditions.push(`at >= $${params.length}`);
      }
    }
    if (req.query.to) {
      const to = new Date(String(req.query.to));
      if (!isNaN(to.getTime())) {
        params.push(to);
        conditions.push(`at < $${params.length}`);
      }
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 2000);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT * FROM change_log ${where} ORDER BY at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    res.json(result.rows.map(rowToObj));
  } catch (e) {
    console.error('[changelog GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/changelog ────────────────────────────────────────────────────
router.post('/', requireAuth, requireCenterAccess(function(req){ return req.body && req.body.rkey; }), async function (req, res) {
  try {
    const { at, rkey, field, val } = req.body;
    if (!at || !rkey || !field) {
      return res.status(400).json({ error: 'فیلدهای at، rkey و field الزامی هستند' });
    }
    const result = await query(
      `INSERT INTO change_log (at, by, rkey, field, val)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [new Date(at), req.user.username, rkey, field, val !== undefined ? JSON.stringify(val) : null]
    );
    res.status(201).json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[changelog POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/changelog/cleanup ─────────────────────────────────────────
// Manager-only: delete entries older than 90 days
router.delete('/cleanup', requireManager, async function (req, res) {
  try {
    const result = await query(
      `DELETE FROM change_log WHERE at < NOW() - INTERVAL '90 days' RETURNING id`
    );
    res.json({ deleted: result.rows.length });
  } catch (e) {
    console.error('[changelog DELETE /cleanup]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

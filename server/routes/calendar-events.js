'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const _UPSERT = `INSERT INTO app_events (id, title, description, start_ms, all_day, color, owner, updated_at, updated_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_ms = EXCLUDED.start_ms,
    all_day = EXCLUDED.all_day,
    color = EXCLUDED.color,
    owner = EXCLUDED.owner,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by
  RETURNING id, title, description as desc, start_ms as "startMs", all_day as "allDay", color, owner`;

function rowToEv(r) {
  return {
    id: r.id,
    title: r.title,
    desc: r.desc || '',
    startMs: Number(r.startMs) || 0,
    allDay: !!r.allDay,
    color: r.color,
    owner: r.owner,
  };
}

// POST /api/calendar-events — upsert one event
router.post('/', requireAuth, async function (req, res) {
  try {
    const ev = req.body || {};
    if (ev.id === undefined || ev.id === null) {
      return res.status(400).json({ error: 'id الزامی است' });
    }
    const result = await query(_UPSERT, [
      ev.id,
      ev.title || '',
      ev.desc || '',
      ev.startMs || 0,
      !!ev.allDay,
      ev.color || null,
      ev.owner || req.user.username,
      req.user.username,
    ]);
    res.json({ ok: true, event: rowToEv(result.rows[0]) });
  } catch (e) {
    console.error('[calendar-events POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// DELETE /api/calendar-events/:id
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const result = await query('DELETE FROM app_events WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true, deleted: id });
  } catch (e) {
    console.error('[calendar-events DELETE]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

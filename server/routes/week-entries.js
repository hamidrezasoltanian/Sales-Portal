'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// ── Helper: map DB row → camelCase object ──────────────────────────────────
function rowToObj(r) {
  return {
    id:            r.id,
    weekId:        r.week_id,
    recKey:        r.rec_key,
    rtype:         r.rtype,
    rid:           r.rid,
    scheduledDate: r.scheduled_date,
    actionType:    r.action_type,
    done:          r.done,
    doneDate:      r.done_date,
    addedBy:       r.added_by,
    centerName:    r.center_name,
    weekTagId:     r.week_tag_id,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

// ── GET /api/week-entries ──────────────────────────────────────────────────
// Query params: ?week_id=, ?owner= (filters added_by), ?done=false|true
router.get('/', requireAuth, async function (req, res) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.week_id) {
      params.push(req.query.week_id);
      conditions.push(`week_id = $${params.length}`);
    }
    if (req.query.owner) {
      params.push(req.query.owner);
      conditions.push(`added_by = $${params.length}`);
    }
    if (req.query.done !== undefined) {
      params.push(req.query.done === 'true');
      conditions.push(`done = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(
      `SELECT * FROM week_entries ${where} ORDER BY scheduled_date ASC, created_at ASC`,
      params
    );
    res.json(result.rows.map(rowToObj));
  } catch (e) {
    console.error('[week-entries GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries ─────────────────────────────────────────────────
router.post('/', requireAuth, async function (req, res) {
  try {
    const { id, weekId, recKey, rtype, rid, scheduledDate, actionType, addedBy, centerName, weekTagId } = req.body;
    if (!id || !weekId || !recKey || !rtype || !rid) {
      return res.status(400).json({ error: 'فیلدهای id، weekId، recKey، rtype و rid الزامی هستند' });
    }
    const dbKey = `${weekId}:::${recKey}`;
    const dbValue = {
      id,
      weekId,
      recKey,
      rtype,
      rid,
      scheduledDate: scheduledDate || null,
      actionType: actionType || 'call',
      addedBy: addedBy || req.user.username,
      centerName: centerName || null,
      weekTagId: weekTagId || null,
      done: false,
      doneDate: null
    };
    const result = await query(
      `INSERT INTO week_entries (key, value, id, week_id, rec_key, rtype, rid, scheduled_date, action_type, added_by, center_name, week_tag_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        dbKey,
        JSON.stringify(dbValue),
        id,
        weekId,
        recKey,
        rtype,
        rid,
        scheduledDate || null,
        actionType || 'call',
        addedBy || req.user.username,
        centerName || null,
        weekTagId || null,
      ]
    );
    res.status(201).json(rowToObj(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'ورودی برنامه هفته با این شناسه قبلاً ثبت شده' });
    }
    console.error('[week-entries POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PUT /api/week-entries/:id ──────────────────────────────────────────────
router.put('/:id', requireAuth, async function (req, res) {
  try {
    const { scheduledDate, done, doneDate, actionType, weekTagId, centerName } = req.body;
    const rowRes = await query('SELECT key, value FROM week_entries WHERE id = $1', [req.params.id]);
    if (!rowRes.rows.length) {
      return res.status(404).json({ error: 'ورودی برنامه هفته یافت نشد' });
    }
    const currentVal = rowRes.rows[0].value || {};
    const updatedVal = {
      ...currentVal,
      ...(scheduledDate !== undefined ? { scheduledDate } : {}),
      ...(done !== undefined ? { done } : {}),
      ...(doneDate !== undefined ? { doneDate } : {}),
      ...(actionType !== undefined ? { actionType } : {}),
      ...(weekTagId !== undefined ? { weekTagId } : {}),
      ...(centerName !== undefined ? { centerName } : {}),
    };
    const result = await query(
      `UPDATE week_entries
       SET scheduled_date = CASE WHEN $9::boolean THEN $1 ELSE scheduled_date END,
           done           = CASE WHEN $10::boolean THEN $2 ELSE done END,
           done_date      = CASE WHEN $11::boolean THEN $3 ELSE done_date END,
           action_type    = CASE WHEN $12::boolean THEN $4 ELSE action_type END,
           week_tag_id    = CASE WHEN $13::boolean THEN $5 ELSE week_tag_id END,
           center_name    = CASE WHEN $14::boolean THEN $6 ELSE center_name END,
           value          = $7,
           updated_at     = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        scheduledDate !== undefined ? scheduledDate : null,
        done !== undefined ? done : null,
        doneDate !== undefined ? doneDate : null,
        actionType || null,
        weekTagId !== undefined ? weekTagId : null,
        centerName !== undefined ? centerName : null,
        JSON.stringify(updatedVal),
        req.params.id,
        scheduledDate !== undefined,
        done !== undefined,
        doneDate !== undefined,
        actionType !== undefined,
        weekTagId !== undefined,
        centerName !== undefined,
      ]
    );
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[week-entries PUT /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/week-entries/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const result = await query('DELETE FROM week_entries WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ورودی برنامه هفته یافت نشد' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[week-entries DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/bulk-delete ────────────────────────────────────
router.post('/bulk-delete', requireAuth, async function (req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'آرایه شناسه‌ها الزامی است' });
    }
    const placeholders = ids.map(function (_, i) { return '$' + (i + 1); }).join(',');
    const result = await query(
      `DELETE FROM week_entries WHERE id IN (${placeholders}) RETURNING id`,
      ids
    );
    res.json({ deleted: result.rows.length });
  } catch (e) {
    console.error('[week-entries POST /bulk-delete]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/bulk-move ──────────────────────────────────────
// Move multiple entries to a new week_id (and update scheduled_date if provided)
router.post('/bulk-move', requireAuth, async function (req, res) {
  try {
    const { ids, weekId, scheduledDate } = req.body;
    if (!Array.isArray(ids) || !ids.length || !weekId) {
      return res.status(400).json({ error: 'آرایه شناسه‌ها و weekId الزامی است' });
    }
    const hasScheduledDate = scheduledDate !== undefined;
    const placeholders = ids.map(function (_, i) { return '$' + (i + 4); }).join(',');
    const result = await query(
      `UPDATE week_entries
       SET week_id        = $1,
           scheduled_date = CASE WHEN $2::boolean THEN $3 ELSE scheduled_date END,
           updated_at     = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [weekId, hasScheduledDate, scheduledDate !== undefined ? scheduledDate : null, ...ids]
    );
    res.json(result.rows.map(rowToObj));
  } catch (e) {
    console.error('[week-entries POST /bulk-move]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

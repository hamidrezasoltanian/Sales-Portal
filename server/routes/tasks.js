'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();

// ── Helper: map DB row → camelCase object ──────────────────────────────────
function rowToObj(r) {
  return {
    id:        r.id,
    title:     r.title,
    owner:     r.owner,
    dueDate:   r.due_date,
    priority:  r.priority,
    status:    r.status,
    centerKey: r.center_key,
    note:      r.note,
    subtasks:  r.subtasks,
    done:      r.done,
    doneAt:    r.done_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    recurring: r.recurring || 'none',
    activity:  r.activity || [],
  };
}

// ── GET /api/tasks ─────────────────────────────────────────────────────────
// Query params: ?owner=, ?status=, ?overdue=true
router.get('/', requireAuth, async function (req, res) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.owner) {
      params.push(req.query.owner);
      conditions.push(`owner = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (req.query.overdue === 'true') {
      conditions.push(`due_date IS NOT NULL AND due_date < TO_CHAR(NOW(), 'YYYY/MM/DD') AND done = false`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows.map(rowToObj));
  } catch (e) {
    console.error('[tasks GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/tasks ────────────────────────────────────────────────────────
router.post('/', requireAuth, async function (req, res) {
  try {
    const { id, title, owner, dueDate, priority, status, centerKey, note, subtasks, createdBy, recurring, activity } = req.body;
    if (!id || !title) {
      return res.status(400).json({ error: 'شناسه و عنوان وظیفه الزامی است' });
    }
    const result = await query(
      `INSERT INTO tasks (id, title, owner, due_date, priority, status, center_key, note, subtasks, created_by, recurring, activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, owner=EXCLUDED.owner, due_date=EXCLUDED.due_date,
         priority=EXCLUDED.priority, status=EXCLUDED.status, center_key=EXCLUDED.center_key,
         note=EXCLUDED.note, subtasks=EXCLUDED.subtasks, done=EXCLUDED.done,
         recurring=EXCLUDED.recurring, activity=EXCLUDED.activity, updated_at=NOW()
       RETURNING *`,
      [
        id,
        title,
        owner || null,
        dueDate || null,
        priority || 2,
        status || 'todo',
        centerKey || null,
        note || '',
        JSON.stringify(subtasks || []),
        createdBy || req.user.username,
        recurring || 'none',
        JSON.stringify(activity || []),
      ]
    );
    res.status(201).json(rowToObj(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'وظیفه با این شناسه قبلاً ثبت شده' });
    }
    console.error('[tasks POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, async function (req, res) {
  try {
    const result = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'وظیفه یافت نشد' });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[tasks GET /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PUT /api/tasks/:id ─────────────────────────────────────────────────────
router.put('/:id', requireAuth, async function (req, res) {
  try {
    const { title, status, owner, dueDate, note, subtasks, done, centerKey, priority, recurring, activity } = req.body;
    const result = await query(
      `UPDATE tasks
       SET title      = COALESCE($1, title),
           status     = COALESCE($2, status),
           owner      = COALESCE($3, owner),
           due_date   = COALESCE($4, due_date),
           note       = COALESCE($5, note),
           subtasks   = COALESCE($6, subtasks),
           done       = COALESCE($7, done),
           center_key = COALESCE($8, center_key),
           priority   = COALESCE($9, priority),
           recurring  = COALESCE($10, recurring),
           activity   = COALESCE($11, activity),
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        title || null,
        status || null,
        owner !== undefined ? owner : null,
        dueDate !== undefined ? dueDate : null,
        note !== undefined ? note : null,
        subtasks !== undefined ? JSON.stringify(subtasks) : null,
        done !== undefined ? done : null,
        centerKey !== undefined ? centerKey : null,
        priority !== undefined ? priority : null,
        recurring !== undefined ? recurring : null,
        activity !== undefined ? JSON.stringify(activity) : null,
        req.params.id,
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'وظیفه یافت نشد' });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[tasks PUT /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'وظیفه یافت نشد' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[tasks DELETE /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/tasks/:id/comment ───────────────────────────────────────────
router.post('/:id/comment', requireAuth, async function (req, res) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'متن کامنت الزامی است' });
    }
    const entry = { type: 'comment', text: text.trim(), by: req.user.username, at: new Date().toISOString() };
    const result = await query(
      `UPDATE tasks SET activity = activity || $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify([entry]), req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'وظیفه یافت نشد' });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[tasks POST /:id/comment]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/tasks/:id/done ───────────────────────────────────────────────
router.post('/:id/done', requireAuth, async function (req, res) {
  try {
    const result = await query(
      `UPDATE tasks SET done = true, done_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'وظیفه یافت نشد' });
    }
    res.json(rowToObj(result.rows[0]));
  } catch (e) {
    console.error('[tasks POST /:id/done]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

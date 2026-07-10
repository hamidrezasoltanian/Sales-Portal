'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireManager);

// GET /api/manager-followups — all tasks as { recKey: task }
router.get('/', async function (req, res) {
  try {
    const r = await query('SELECT rec_key, data FROM manager_tasks ORDER BY updated_at DESC');
    const tasks = {};
    r.rows.forEach(function (row) {
      tasks[row.rec_key] = row.data || {};
    });
    res.json(tasks);
  } catch (e) {
    console.error('[manager-followups GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/manager-followups/:recKey — upsert one assignment
router.put('/:recKey', async function (req, res) {
  try {
    const recKey = req.params.recKey;
    const data = req.body || {};
    if (!recKey) return res.status(400).json({ error: 'recKey الزامی است' });
    await query(
      `INSERT INTO manager_tasks (rec_key, data, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (rec_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [recKey, JSON.stringify(data), req.user.username]
    );
    res.json({ ok: true, recKey, task: data });
  } catch (e) {
    console.error('[manager-followups PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/manager-followups/:recKey
router.delete('/:recKey', async function (req, res) {
  try {
    const result = await query('DELETE FROM manager_tasks WHERE rec_key = $1 RETURNING rec_key', [req.params.recKey]);
    if (!result.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true, deleted: req.params.recKey });
  } catch (e) {
    console.error('[manager-followups DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

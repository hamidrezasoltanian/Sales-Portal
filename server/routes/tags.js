'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
const TAG_DEF_KEY = 'tagDefinitions';

async function loadTagDefinitions() {
  const r = await query('SELECT value FROM app_settings WHERE key = $1', [TAG_DEF_KEY]);
  if (!r.rows.length) return [];
  const v = r.rows[0].value;
  return Array.isArray(v) ? v : [];
}

// GET /api/tags — global tag definitions
router.get('/', requireAuth, async function (req, res) {
  try {
    res.json(await loadTagDefinitions());
  } catch (e) {
    console.error('[tags GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/tags — replace global tag list (manager)
router.put('/', requireManager, async function (req, res) {
  try {
    const tags = Array.isArray(req.body) ? req.body : (req.body && req.body.tags);
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'آرایه tags الزامی است' });
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      [TAG_DEF_KEY, JSON.stringify(tags), req.user.username]
    );
    res.json({ ok: true, tags });
  } catch (e) {
    console.error('[tags PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PATCH /api/tags/centers/:key — set tag ids for one center
router.patch('/centers/:key', requireAuth, async function (req, res) {
  try {
    const centerKey = req.params.key;
    const tagIds = (req.body && req.body.tagIds) || [];
    if (!Array.isArray(tagIds)) return res.status(400).json({ error: 'tagIds باید آرایه باشد' });
    await query(
      `INSERT INTO center_tags (center_key, tags, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (center_key) DO UPDATE SET tags = EXCLUDED.tags, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [centerKey, JSON.stringify(tagIds), req.user.username]
    );
    res.json({ ok: true, centerKey, tagIds });
  } catch (e) {
    console.error('[tags PATCH centers]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

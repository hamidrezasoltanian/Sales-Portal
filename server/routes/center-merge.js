'use strict';

const express = require('express');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');
const { isManagerRole } = require('../lib/center-ownership');
const {
  buildMergeSuggestions,
  getSuggestionsForCenter,
  dismissSuggestion,
  deferSuggestion,
  executeSuggestionMerge,
  addOrphanAsSeparateCenter,
  renameAndDismiss,
} = require('../lib/center-merge-suggestions');

const router = express.Router();
router.use(requireAuth);

// POST /api/center-merge/build — rebuild suggestion index (manager)
router.post('/build', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const dryRun = !!(req.body && req.body.dryRun);
    const minScore = req.body && req.body.minScore != null ? parseInt(req.body.minScore, 10) : 70;
    const result = await buildMergeSuggestions({ dryRun, minScore: isNaN(minScore) ? 70 : minScore });
    return res.json(result);
  } catch (e) {
    console.error('[center-merge/build]', e.message);
    return res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// GET /api/center-merge/for/:centerKey — pending suggestions for open center modal
router.get('/for/:centerKey(*)', async function (req, res) {
  try {
    const centerKey = decodeURIComponent(req.params.centerKey || '');
    if (!centerKey) return res.status(400).json({ error: 'centerKey الزامی است' });
    const list = await getSuggestionsForCenter(centerKey, { includeDeferred: false });
    return res.json({ suggestions: list });
  } catch (e) {
    console.error('[center-merge/for]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/center-merge/:id/dismiss
router.post('/:id/dismiss', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const row = await dismissSuggestion(id, req.user.username, (req.body && req.body.reason) || '');
    return res.json({ ok: true, suggestion: row });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /api/center-merge/:id/defer
router.post('/:id/defer', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const days = req.body && req.body.days != null ? parseInt(req.body.days, 10) : 30;
    const row = await deferSuggestion(id, req.user.username, isNaN(days) ? 30 : days);
    return res.json({ ok: true, suggestion: row });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /api/center-merge/:id/merge
router.post('/:id/merge', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const fieldPrefs = (req.body && req.body.fieldPrefs) || {};
    const result = await executeSuggestionMerge(id, req.user.username, { fieldPrefs });
    try {
      const { broadcast } = require('./events');
      if (broadcast) broadcast('center-changed', { merge: true, sourceKey: result.sourceKey, targetKey: result.targetKey }, req.headers['x-cid'] || '');
    } catch (_) {}
    return res.json(result);
  } catch (e) {
    console.error('[center-merge/merge]', e.message);
    return res.status(400).json({ error: e.message || 'خطا در ادغام' });
  }
});

// POST /api/center-merge/:id/separate — orphan is a distinct center → add to master list
router.post('/:id/separate', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const name = req.body && req.body.name;
    const result = await addOrphanAsSeparateCenter(id, req.user.username, name);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /api/center-merge/:id/rename-dismiss — different entity, optionally rename current center
router.post('/:id/rename-dismiss', requirePermission('provinces', 'edit'), async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const newName = req.body && req.body.newName;
    const row = await renameAndDismiss(id, req.user.username, newName);
    return res.json({ ok: true, suggestion: row });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// GET /api/center-merge/stats — manager dashboard snippet
router.get('/stats', async function (req, res) {
  if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'دسترسی ندارید' });
  try {
    const { query } = require('../db');
    const r = await query(`
      SELECT status, COUNT(*)::int c FROM center_merge_suggestions GROUP BY status
    `);
    const counts = {};
    r.rows.forEach(function (row) { counts[row.status] = row.c; });
    return res.json({ counts });
  } catch (e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { requireAuth } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const inboxIndex = require('../lib/inbox-index');

const router = express.Router();

// GET /api/inbox/matrix — manager heatmap
router.get('/matrix', requireAuth, async function (req, res) {
  try {
    const data = await inboxIndex.queryInboxMatrix(req.user);
    if (data.error) return res.status(data.status || 400).json({ error: data.error });
    res.json(data);
  } catch (e) {
    console.error('[inbox matrix]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/inbox/tree-team — manager multi-expert center tree
router.get('/tree-team', requireAuth, async function (req, res) {
  try {
    const data = await inboxIndex.queryInboxTreeTeam(req.user);
    if (data.error) return res.status(data.status || 400).json({ error: data.error });
    res.json(data);
  } catch (e) {
    console.error('[inbox tree-team]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/inbox?scope=mine|team&owner=&filter=&search=&types=&limit=&offset=
router.get('/', requireAuth, async function (req, res) {
  try {
    const isMgr = isManagerRole(req.user.role);
    let scope = 'mine';
    if (req.query.scope === 'all' && isMgr) scope = 'all';
    else if (req.query.scope === 'team' && isMgr) scope = 'team';
    const filter = ['all', 'overdue', 'today', 'approval', 'week'].includes(req.query.filter)
      ? req.query.filter
      : 'all';
    const types = req.query.types
      ? String(req.query.types).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : null;

    const data = await inboxIndex.queryInbox(req.user, {
      scope,
      owner: req.query.owner,
      filter,
      search: req.query.search,
      types,
      limit: req.query.limit,
      offset: req.query.offset,
      weekAhead: req.query.weekAhead,
      calendarRange: req.query.calendar === '1' || req.query.calendar === 'true',
    });

    if (data.error) return res.status(data.status || 400).json({ error: data.error });
    res.json(data);
  } catch (e) {
    console.error('[inbox GET]', e.message);
    res.status(500).json({ error: 'خطای سرور', partial: true });
  }
});

// GET /api/inbox/count
router.get('/count', requireAuth, async function (req, res) {
  try {
    const data = await inboxIndex.queryInboxCount(req.user);
    if (data.error) return res.status(data.status || 400).json({ error: data.error });
    res.json(data);
  } catch (e) {
    console.error('[inbox count]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/inbox/subordinates — authorized experts for team view
router.get('/subordinates', requireAuth, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) {
      return res.json({ subordinates: [] });
    }
    const list = await inboxIndex.listAuthorizedSubordinates(req.user.username, req.user.role);
    res.json({ subordinates: list });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/inbox/actions/complete
router.post('/actions/complete', requireAuth, async function (req, res) {
  try {
    const itemId = req.body && req.body.itemId;
    if (!itemId) return res.status(400).json({ error: 'itemId الزامی است' });
    const result = await inboxIndex.actionComplete(req.user, itemId);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('[inbox complete]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/inbox/actions/snooze  { itemId, days }
router.post('/actions/snooze', requireAuth, async function (req, res) {
  try {
    const itemId = req.body && req.body.itemId;
    const days = req.body && req.body.days;
    if (!itemId) return res.status(400).json({ error: 'itemId الزامی است' });
    const result = await inboxIndex.actionSnooze(req.user, itemId, days);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('[inbox snooze]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/inbox/panic  { fromOwner, toOwner }
router.post('/panic', requireAuth, async function (req, res) {
  try {
    const result = await inboxIndex.actionPanic(req.user, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('[inbox panic]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/inbox/rebuild — manager only, manual reindex
router.post('/rebuild', requireAuth, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    await inboxIndex.rebuildAll();
    res.json({ ok: true });
  } catch (e) {
    console.error('[inbox rebuild]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

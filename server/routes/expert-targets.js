'use strict';

const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const et = require('../lib/expert-targets');

const router = express.Router();

// ── GET /api/expert-targets ────────────────────────────────────────────────
router.get('/', requireAuth, async function (req, res) {
  try {
    const isMgr = isManagerRole(req.user.role);
    const expertId = isMgr ? (req.query.expert || req.query.expertId || null) : req.user.username;
    const list = await et.listTargets({
      expertId: expertId || undefined,
      status: req.query.status || undefined,
      periodType: req.query.periodType || undefined,
      periodKey: req.query.periodKey || undefined,
      rootsOnly: req.query.rootsOnly === '1' || req.query.rootsOnly === 'true',
      includeAll: req.query.includeAll === '1',
    });
    res.json(list);
  } catch (e) {
    console.error('[expert-targets GET]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/expert-targets/board ──────────────────────────────────────────
router.get('/board', requireAuth, requireManager, async function (req, res) {
  try {
    const board = await et.boardProgress(req.query.status || 'active');
    res.json({ items: board });
  } catch (e) {
    console.error('[expert-targets GET /board]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/expert-targets/:id/progress ───────────────────────────────────
router.get('/:id/progress', requireAuth, async function (req, res) {
  try {
    const target = await et.getById(req.params.id);
    if (!target) return res.status(404).json({ error: 'هدف یافت نشد' });
    if (!isManagerRole(req.user.role) && target.expertId !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    if (target.periodType === 'month') {
      const all = await et.listTargets({ expertId: target.expertId, includeAll: true });
      const kids = all.filter(function (c) { return c.parentId === target.id; });
      const childProgress = [];
      let doneTotal = 0, donePriority = 0, committedTotal = 0;
      for (const k of kids) {
        const p = await et.computeProgress(k);
        childProgress.push(p);
        doneTotal += p.doneTotal;
        donePriority += p.donePriority;
        committedTotal += p.committedTotal;
      }
      const progressPct = target.targetCount > 0 ? doneTotal / target.targetCount : 0;
      return res.json({
        target: target,
        progress: {
          targetId: target.id,
          expertId: target.expertId,
          periodType: 'month',
          periodKey: target.periodKey,
          targetCount: target.targetCount,
          minPriorityCount: target.minPriorityCount,
          doneTotal: doneTotal,
          donePriority: donePriority,
          committedTotal: committedTotal,
          freeSlots: Math.max(0, target.targetCount - committedTotal),
          remainingTotal: Math.max(0, target.targetCount - doneTotal),
          remainingPriority: Math.max(0, (target.minPriorityCount || 0) - donePriority),
          progressPct: Math.round(progressPct * 1000) / 1000,
          priorityOk: donePriority >= (target.minPriorityCount || 0),
          quotaMet: doneTotal >= target.targetCount && donePriority >= (target.minPriorityCount || 0),
          color: (doneTotal >= target.targetCount && donePriority >= (target.minPriorityCount || 0))
            ? 'green' : (progressPct < 0.35 ? 'red' : 'yellow'),
          children: childProgress,
        },
      });
    }
    const progress = await et.computeProgress(target);
    res.json({ target: target, progress: progress });
  } catch (e) {
    console.error('[expert-targets GET progress]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/expert-targets/:id/audit ──────────────────────────────────────
router.get('/:id/audit', requireAuth, requireManager, async function (req, res) {
  try {
    const { query } = require('../db');
    const r = await query(
      `SELECT * FROM expert_target_audit WHERE target_id = $1 ORDER BY at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(r.rows.map(function (row) {
      return {
        id: row.id,
        targetId: row.target_id,
        at: row.at,
        by: row.by_user,
        action: row.action,
        before: row.before_val,
        after: row.after_val,
      };
    }));
  } catch (e) {
    console.error('[expert-targets GET audit]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── GET /api/expert-targets/:id ────────────────────────────────────────────
router.get('/:id', requireAuth, async function (req, res) {
  try {
    const target = await et.getById(req.params.id);
    if (!target) return res.status(404).json({ error: 'هدف یافت نشد' });
    if (!isManagerRole(req.user.role) && target.expertId !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    res.json(target);
  } catch (e) {
    console.error('[expert-targets GET :id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/expert-targets ───────────────────────────────────────────────
router.post('/', requireAuth, requireManager, async function (req, res) {
  try {
    const created = await et.createTarget(req.body || {}, req.user.username);
    res.status(201).json(created);
  } catch (e) {
    console.error('[expert-targets POST]', e.message);
    res.status(e.status || 500).json({ error: e.message || 'خطای داخلی سرور' });
  }
});

// ── PATCH /api/expert-targets/:id ──────────────────────────────────────────
router.patch('/:id', requireAuth, requireManager, async function (req, res) {
  try {
    const updated = await et.updateTarget(req.params.id, req.body || {}, req.user.username);
    res.json(updated);
  } catch (e) {
    console.error('[expert-targets PATCH]', e.message);
    res.status(e.status || 500).json({ error: e.message || 'خطای داخلی سرور' });
  }
});

// ── POST /api/expert-targets/:id/lock|cancel|close ─────────────────────────
router.post('/:id/:action', requireAuth, requireManager, async function (req, res) {
  try {
    const action = req.params.action;
    const map = { lock: 'locked', unlock: 'active', cancel: 'cancelled', close: 'closed', activate: 'active' };
    if (!map[action]) return res.status(400).json({ error: 'action نامعتبر' });
    const updated = await et.updateTarget(req.params.id, { status: map[action] }, req.user.username);
    res.json(updated);
  } catch (e) {
    console.error('[expert-targets POST action]', e.message);
    res.status(e.status || 500).json({ error: e.message || 'خطای داخلی سرور' });
  }
});

module.exports = router;

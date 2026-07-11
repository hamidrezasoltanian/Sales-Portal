'use strict';
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const { requireCenterAccess, userCanAccessCenter } = require('../lib/center-access');

const router = express.Router();
router.use(requireAuth);

// POST /api/audit — log a change
router.post('/', requireCenterAccess(function(req){ return req.body && req.body.centerKey; }), async (req, res) => {
  const { centerKey, centerName, field, oldValue, newValue } = req.body || {};
  if (!centerKey || !field) return res.status(400).json({ error: 'centerKey و field الزامی است' });
  try {
    await query(
      `INSERT INTO center_audit (center_key, center_name, field, old_value, new_value, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [centerKey, centerName || '', field, String(oldValue ?? ''), String(newValue ?? ''), req.user.username]
    );
    return res.json({ ok: true });
  } catch(e) {
    console.error('[audit POST]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/audit?key=center_123&limit=20 — managers see all; experts only owned centers
router.get('/', async (req, res) => {
  const { key, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 200);
  const isMgr = isManagerRole(req.user.role);

  try {
    if (!key && !isMgr) {
      return res.status(403).json({ error: 'فقط مدیر می‌تواند کل لاگ را ببیند' });
    }

    if (key && !isMgr) {
      if (!(await userCanAccessCenter(req.user, key))) {
        return res.status(403).json({ error: 'دسترسی به این مرکز مجاز نیست' });
      }
    }

    let result;
    if (key) {
      result = await query(
        'SELECT * FROM center_audit WHERE center_key = $1 ORDER BY changed_at DESC LIMIT $2',
        [key, lim]
      );
    } else {
      result = await query(
        'SELECT * FROM center_audit ORDER BY changed_at DESC LIMIT $1',
        [lim]
      );
    }
    return res.json(result.rows);
  } catch(e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

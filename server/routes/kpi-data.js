'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/kpi-data/user-target — upsert one user/month target
router.post('/user-target', async function (req, res) {
  try {
    const { username, month, callsPerDay, visitsPerWeek, salesCount, salesAmount, cashPct } = req.body || {};
    if (!username || !month) return res.status(400).json({ error: 'username و month الزامی هستند' });
    await query(
      `INSERT INTO kpi_user_targets (username, month, calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       ON CONFLICT (username, month) DO UPDATE SET
         calls_per_day = EXCLUDED.calls_per_day,
         visits_per_week = EXCLUDED.visits_per_week,
         sales_count = EXCLUDED.sales_count,
         sales_amount = EXCLUDED.sales_amount,
         cash_pct = EXCLUDED.cash_pct,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        username, month,
        callsPerDay || 10, visitsPerWeek || 5, salesCount || 5,
        salesAmount || 0, cashPct || 50,
        req.user.username,
      ]
    );
    res.json({ ok: true, username, month });
  } catch (e) {
    console.error('[kpi-data user-target]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// POST /api/kpi-data/history — upsert KPI snapshot
router.post('/history', async function (req, res) {
  try {
    const snap = req.body || {};
    if (!snap.userId || !snap.month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    await query(
      `INSERT INTO kpi_history (username, month, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (username, month) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [snap.userId, snap.month, JSON.stringify(snap)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[kpi-data history]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// POST /api/kpi-data/province-target — upsert one province target (manager)
router.post('/province-target', requireManager, async function (req, res) {
  try {
    const { provinceId, calls, visits, sales, extra } = req.body || {};
    if (!provinceId) return res.status(400).json({ error: 'provinceId الزامی است' });
    await query(
      `INSERT INTO kpi_province_targets (province_id, calls, visits, sales, extra, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (province_id) DO UPDATE SET
         calls = EXCLUDED.calls, visits = EXCLUDED.visits, sales = EXCLUDED.sales,
         extra = EXCLUDED.extra, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [provinceId, calls || 0, visits || 0, sales || 0, extra || 0, req.user.username]
    );
    res.json({ ok: true, provinceId });
  } catch (e) {
    console.error('[kpi-data province-target]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

// GET /api/kpi-data/targets?month=1404/04
router.get('/targets', async function (req, res) {
  try {
    const month = req.query.month;
    let sql = 'SELECT * FROM kpi_user_targets';
    const params = [];
    const conditions = [];
    if (month) { params.push(month); conditions.push('month = $' + params.length); }
    if (!isManagerRole(req.user.role)) { params.push(req.user.username); conditions.push('username = $' + params.length); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY month DESC, username';
    const r = await query(sql, params);
    const map = {};
    r.rows.forEach(function (row) {
      if (!map[row.username]) map[row.username] = {};
      map[row.username][row.month] = {
        callsPerDay: row.calls_per_day,
        visitsPerWeek: row.visits_per_week,
        salesCount: row.sales_count,
        salesAmount: Number(row.sales_amount) || 0,
        cashPct: row.cash_pct,
      };
    });
    res.json({ ok: true, targets: map, rows: r.rows });
  } catch (e) {
    console.error('[kpi-data GET targets]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi-data/history?user=&month=
router.get('/history', async function (req, res) {
  try {
    const user = req.query.user || req.query.username;
    const month = req.query.month;
    let sql = 'SELECT username, month, data, updated_at FROM kpi_history WHERE 1=1';
    const params = [];
    if (user && isManagerRole(req.user.role)) { params.push(user); sql += ' AND username = $' + params.length; }
    if (!isManagerRole(req.user.role)) { params.push(req.user.username); sql += ' AND username = $' + params.length; }
    if (month) { params.push(month); sql += ' AND month = $' + params.length; }
    sql += ' ORDER BY month DESC LIMIT 500';
    const r = await query(sql, params);
    const list = r.rows.map(function (row) {
      const d = row.data || {};
      return { userId: row.username, month: row.month, snap: d, updatedAt: row.updated_at };
    });
    res.json({ ok: true, history: list });
  } catch (e) {
    console.error('[kpi-data GET history]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi-data/province-targets
router.get('/province-targets', async function (req, res) {
  try {
    const r = await query('SELECT * FROM kpi_province_targets ORDER BY province_id');
    const map = {};
    r.rows.forEach(function (row) {
      map[row.province_id] = {
        calls: row.calls, visits: row.visits, sales: row.sales, extra: row.extra,
      };
    });
    res.json({ ok: true, targets: map });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/kpi-data/user-target
router.post('/user-target', requireManager, async function (req, res) {
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

// POST /api/kpi-data/history
router.post('/history', async function (req, res) {
  try {
    const snap = req.body || {};
    if (!snap.userId || !snap.month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    if (!isManagerRole(req.user.role) && snap.userId !== req.user.username) {
      return res.status(403).json({ error: 'ثبت KPI برای کاربر دیگر مجاز نیست' });
    }
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

// POST /api/kpi-data/province-target
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

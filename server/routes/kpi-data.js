'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const { p2 } = require('../lib/jalali-mini');
const salesKpi = require('../lib/sales-kpi');

const router = express.Router();
router.use(requireAuth);

function jMonthBounds(month) {
  const pts = String(month || '').split('/');
  const jy = parseInt(pts[0], 10);
  const jm = parseInt(pts[1], 10);
  if (!jy || !jm) return null;
  const lastDay = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
  return {
    start: jy + '/' + p2(jm) + '/01',
    end: jy + '/' + p2(jm) + '/' + p2(lastDay),
  };
}

function resolveUsername(req) {
  if (isManagerRole(req.user.role)) {
    return req.query.user || req.query.username || req.body?.userId || req.body?.username || req.user.username;
  }
  return req.user.username;
}

// GET /api/kpi-data/calc?user=&month= — live server calc (display SoT)
router.get('/calc', async function (req, res) {
  try {
    const month = req.query.month || salesKpi.currentJMonth();
    const username = resolveUsername(req);
    const data = await salesKpi.calcKPIs(username, month);
    // Prefer finalized row for past months if present
    const fin = await salesKpi.getFinalizedRow(username, month);
    if (fin && fin.finalized) {
      return res.json({
        ok: true,
        finalized: true,
        data: fin.data && typeof fin.data === 'object' ? fin.data : data,
        overall: fin.overall,
        scores: fin.scores,
        conversionSource: fin.conversion_source,
      });
    }
    res.json({ ok: true, finalized: false, data: data });
  } catch (e) {
    console.error('[kpi-data GET calc]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi-data/monthly?user=&month=
router.get('/monthly', async function (req, res) {
  try {
    const month = req.query.month;
    let sql = 'SELECT * FROM sales_kpi_monthly WHERE 1=1';
    const params = [];
    if (!isManagerRole(req.user.role)) {
      params.push(req.user.username);
      sql += ' AND username = $' + params.length;
    } else if (req.query.user || req.query.username) {
      params.push(req.query.user || req.query.username);
      sql += ' AND username = $' + params.length;
    }
    if (month) {
      params.push(month);
      sql += ' AND month = $' + params.length;
    }
    sql += ' ORDER BY month DESC LIMIT 200';
    const r = await query(sql, params);
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/kpi-data/finalize — manager or self; cron uses internal lib
router.post('/finalize', async function (req, res) {
  try {
    const month = (req.body && req.body.month) || salesKpi.prevJMonth(salesKpi.currentJMonth());
    const force = !!(req.body && req.body.force);
    if (req.body && req.body.all && isManagerRole(req.user.role)) {
      const out = await salesKpi.finalizeAllActiveExperts(month, { by: req.user.username, force: force });
      return res.json({ ok: true, ...out });
    }
    const username = isManagerRole(req.user.role)
      ? ((req.body && (req.body.username || req.body.userId)) || req.user.username)
      : req.user.username;
    const data = await salesKpi.finalizeMonth(username, month, { by: req.user.username, force: force });
    res.json({ ok: true, data: data });
  } catch (e) {
    console.error('[kpi-data finalize]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi-data/weights
router.get('/weights', async function (req, res) {
  try {
    const month = req.query.month || salesKpi.currentJMonth();
    const info = await salesKpi.getActiveWeights(month);
    const hist = await query(
      `SELECT id, weights, effective_from, created_at, created_by
       FROM kpi_weight_versions ORDER BY effective_from DESC, id DESC LIMIT 24`
    );
    res.json({ ok: true, active: info, versions: hist.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/kpi-data/weights — new effective-dated version
router.post('/weights', requireManager, async function (req, res) {
  try {
    const { weights, effectiveFrom } = req.body || {};
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'weights الزامی است' });
    }
    const sum = ['conversion', 'retention', 'visits', 'calls', 'sales', 'mission', 'cash']
      .reduce(function (s, k) { return s + (parseInt(weights[k], 10) || 0); }, 0);
    if (sum !== 100) {
      return res.status(400).json({ error: 'جمع وزن‌ها باید ۱۰۰ باشد (الان ' + sum + ')' });
    }
    const row = await salesKpi.upsertWeightVersion(weights, effectiveFrom, req.user.username);
    res.json({ ok: true, id: row.id });
  } catch (e) {
    console.error('[kpi-data weights]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET/POST region retention targets
router.get('/regions', requireManager, async function (req, res) {
  try {
    const r = await query('SELECT * FROM kpi_region_targets ORDER BY region_key');
    res.json({ ok: true, regions: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/regions', requireManager, async function (req, res) {
  try {
    const { regionKey, label, retentionTarget } = req.body || {};
    if (!regionKey) return res.status(400).json({ error: 'regionKey الزامی است' });
    const prev = await query('SELECT * FROM kpi_region_targets WHERE region_key = $1', [regionKey]);
    await query(
      `INSERT INTO kpi_region_targets (region_key, label, retention_target, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (region_key) DO UPDATE SET
         label = EXCLUDED.label,
         retention_target = EXCLUDED.retention_target,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [regionKey, label || regionKey, retentionTarget != null ? retentionTarget : 90, req.user.username]
    );
    await salesKpi.logKpiConfigAudit(
      req.user.username,
      'region_retention',
      prev.rows[0] || null,
      { regionKey, label, retentionTarget },
      null
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/audit', requireManager, async function (req, res) {
  try {
    const r = await query(
      `SELECT * FROM kpi_config_audit ORDER BY at DESC LIMIT 200`
    );
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi-data/actuals?user=&month=1404/04
router.get('/actuals', async function (req, res) {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: 'month الزامی است' });
    const bounds = jMonthBounds(month);
    if (!bounds) return res.status(400).json({ error: 'month نامعتبر' });

    const username = isManagerRole(req.user.role)
      ? (req.query.user || req.query.username || req.user.username)
      : req.user.username;

    const [callsR, visitsR, salesR] = await Promise.all([
      query(
        `SELECT id, date, username, count, note FROM call_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query(
        `SELECT id, date, username, count, note FROM visit_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query(
        `SELECT id, date, username, center_name, center_key, amount, is_cash FROM sales_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, id DESC`,
        [username, bounds.start, bounds.end]
      ),
    ]);

    const calls = callsR.rows.map(function (r) {
      return { id: Number(r.id), date: r.date, userId: r.username, count: r.count || 1, note: r.note || '' };
    });
    const visits = visitsR.rows.map(function (r) {
      return { id: Number(r.id), date: r.date, userId: r.username, count: r.count || 1, note: r.note || '' };
    });
    const sales = salesR.rows.map(function (r) {
      return {
        id: Number(r.id), date: r.date, userId: r.username,
        centerName: r.center_name || '', centerKey: r.center_key || null,
        amount: Number(r.amount) || 0, isCash: !!r.is_cash,
      };
    });

    const totalCalls = calls.reduce(function (s, l) { return s + (l.count || 1); }, 0);
    const totalVisits = visits.reduce(function (s, l) { return s + (l.count || 1); }, 0);

    res.json({
      ok: true,
      username,
      month,
      bounds,
      calls,
      visits,
      sales,
      totals: { calls: totalCalls, visits: totalVisits, salesCount: sales.length },
    });
  } catch (e) {
    console.error('[kpi-data GET actuals]', e.message);
    res.status(500).json({ error: e.message });
  }
});


// GET /api/kpi-data/trace?user=&month= — read-only, auditable source rows for KPI.
router.get('/trace', async function (req, res) {
  try {
    const month = req.query.month || salesKpi.currentJMonth();
    const bounds = jMonthBounds(month);
    if (!bounds) return res.status(400).json({ error: 'month نامعتبر' });
    const username = resolveUsername(req);
    const actionVisit = "('visit', 'meeting', 'committee')";
    const [callsR, visitsR, legacyCallsR, legacyVisitsR, missionR, retentionR, paidInvoicesR] = await Promise.all([
      query(
        `SELECT l.id, l.date, l.count, l.note,
                COALESCE(ci.center_key, '') AS center_key,
                COALESCE(ci.payload->>'centerName', '') AS center_name
         FROM call_log l
         LEFT JOIN LATERAL (
           SELECT center_key, payload FROM center_interactions ci
           WHERE ci.username = l.username AND ci.projections->>'callLogId' = l.id::text
           ORDER BY ci.created_at DESC LIMIT 1
         ) ci ON TRUE
         WHERE l.username = $1 AND l.date >= $2 AND l.date <= $3
         ORDER BY l.date DESC, l.id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query(
        `SELECT l.id, l.date, l.count, l.note,
                COALESCE(ci.center_key, '') AS center_key,
                COALESCE(ci.payload->>'centerName', '') AS center_name
         FROM visit_log l
         LEFT JOIN LATERAL (
           SELECT center_key, payload FROM center_interactions ci
           WHERE ci.username = l.username AND ci.projections->>'visitLogId' = l.id::text
           ORDER BY ci.created_at DESC LIMIT 1
         ) ci ON TRUE
         WHERE l.username = $1 AND l.date >= $2 AND l.date <= $3
         ORDER BY l.date DESC, l.id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query(
        `SELECT we.id, we.done_date, we.scheduled_date, we.week_id, we.center_name, we.rec_key, we.action_type
         FROM week_entries we
         WHERE we.added_by = $1 AND we.done = TRUE
           AND COALESCE(we.action_type, 'call') NOT IN ${actionVisit}
           AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) >= $2
           AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) <= $3
           AND NOT EXISTS (SELECT 1 FROM center_interactions ci WHERE ci.week_entry_id = we.id AND ci.mode = 'done')
         ORDER BY we.done_date DESC, we.id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query(
        `SELECT we.id, we.done_date, we.scheduled_date, we.week_id, we.center_name, we.rec_key, we.action_type
         FROM week_entries we
         WHERE we.added_by = $1 AND we.done = TRUE
           AND we.action_type IN ${actionVisit}
           AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) >= $2
           AND COALESCE(NULLIF(we.done_date, ''), NULLIF(we.scheduled_date, ''), NULLIF(we.week_id, '')) <= $3
           AND NOT EXISTS (SELECT 1 FROM center_interactions ci WHERE ci.week_entry_id = we.id AND ci.mode = 'done')
         ORDER BY we.done_date DESC, we.id DESC`,
        [username, bounds.start, bounds.end]
      ),
      query('SELECT done, note FROM mission_log WHERE username = $1 AND month = $2 LIMIT 1', [username, month]),
      query(
        `WITH customer_centers AS (
           SELECT center_key FROM center_edits
           WHERE COALESCE(data->>'owner','') = $1 AND COALESCE(data->>'lead','') = 'مشتری'
         ), purchases AS (
           SELECT DISTINCT center_key FROM invoices
           WHERE status IN ('issued','paid') AND COALESCE(center_key,'') <> ''
             AND jalali_date >= $2 AND jalali_date <= $3
         )
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM purchases p WHERE p.center_key=c.center_key))::int AS retained
         FROM customer_centers c`,
        [username, salesKpi.prevJMonth(salesKpi.prevJMonth(month)) + '/01', bounds.end]
      ),
      query(
        `SELECT id, invoice_no, jalali_date, center_key, center_name, total
         FROM invoices WHERE status = 'paid' AND jalali_date LIKE $2
           AND COALESCE(NULLIF(TRIM(commission_owner), ''), created_by) = $1
         ORDER BY jalali_date DESC, id DESC`,
        [username, month + '%']
      ),
    ]);
    const sales = paidInvoicesR.rows.length ? paidInvoicesR.rows : (await query(
      `SELECT id, date AS jalali_date, center_key, center_name, amount AS total, is_cash
       FROM sales_log WHERE username = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC, id DESC`,
      [username, bounds.start, bounds.end]
    )).rows;
    function legacyEffective(rows, manualRows) {
      const manualByDate = {};
      manualRows.forEach(function (r) { manualByDate[r.date] = (manualByDate[r.date] || 0) + (parseInt(r.count, 10) || 1); });
      return rows.filter(function (r) {
        const date = r.done_date || r.scheduled_date || r.week_id || '';
        if (date && manualByDate[date] > 0) { manualByDate[date] -= 1; return false; }
        return true;
      });
    }
    const calc = await salesKpi.calcKPIs(username, month);
    const finalized = await salesKpi.getFinalizedRow(username, month);
    res.json({
      ok: true, username, month, bounds, calc, finalized: !!(finalized && finalized.finalized),
      calls: callsR.rows, visits: visitsR.rows,
      legacyCalls: legacyEffective(legacyCallsR.rows, callsR.rows),
      legacyVisits: legacyEffective(legacyVisitsR.rows, visitsR.rows),
      salesSource: paidInvoicesR.rows.length ? 'paid_invoices' : 'sales_log', sales,
      mission: missionR.rows[0] || null,
      retention: Object.assign({ total: 0, retained: 0, windowStart: salesKpi.prevJMonth(salesKpi.prevJMonth(month)) + '/01', windowEnd: bounds.end }, retentionR.rows[0] || {}),
    });
  } catch (e) {
    console.error('[kpi-data GET trace]', e.message);
    res.status(500).json({ error: e.message });
  }
});

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
        retentionTarget: row.retention_target != null ? row.retention_target : 90,
        regionKey: row.region_key || null,
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
    const {
      username, month, callsPerDay, visitsPerWeek, salesCount, salesAmount, cashPct,
      retentionTarget, regionKey,
    } = req.body || {};
    if (!username || !month) return res.status(400).json({ error: 'username و month الزامی هستند' });

    const prev = await query(
      'SELECT * FROM kpi_user_targets WHERE username = $1 AND month = $2',
      [username, month]
    );

    await query(
      `INSERT INTO kpi_user_targets (
         username, month, calls_per_day, visits_per_week, sales_count, sales_amount, cash_pct,
         retention_target, region_key, updated_at, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
       ON CONFLICT (username, month) DO UPDATE SET
         calls_per_day = EXCLUDED.calls_per_day,
         visits_per_week = EXCLUDED.visits_per_week,
         sales_count = EXCLUDED.sales_count,
         sales_amount = EXCLUDED.sales_amount,
         cash_pct = EXCLUDED.cash_pct,
         retention_target = EXCLUDED.retention_target,
         region_key = EXCLUDED.region_key,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        username, month,
        callsPerDay != null ? callsPerDay : 10,
        visitsPerWeek != null ? visitsPerWeek : 5,
        salesCount != null ? salesCount : 5,
        salesAmount != null ? salesAmount : 0, cashPct != null ? cashPct : 50,
        retentionTarget != null ? retentionTarget : 90,
        regionKey || null,
        req.user.username,
      ]
    );

    await salesKpi.logKpiConfigAudit(
      req.user.username,
      'user_target',
      prev.rows[0] || null,
      { username, month, callsPerDay, visitsPerWeek, salesCount, salesAmount, cashPct, retentionTarget, regionKey },
      null
    );

    res.json({ ok: true, username, month });
  } catch (e) {
    console.error('[kpi-data user-target]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// POST /api/kpi-data/history — override snapshot (prefer /finalize)
router.post('/history', async function (req, res) {
  try {
    const snap = req.body || {};
    if (!snap.userId || !snap.month) return res.status(400).json({ error: 'userId و month الزامی هستند' });
    if (!isManagerRole(req.user.role) && snap.userId !== req.user.username) {
      return res.status(403).json({ error: 'ثبت KPI برای کاربر دیگر مجاز نیست' });
    }
    // Prefer server finalize so overall is not client-supplied
    const data = await salesKpi.finalizeMonth(snap.userId, snap.month, {
      by: req.user.username,
      force: true,
    });
    res.json({ ok: true, overall: data.overall, server: true });
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

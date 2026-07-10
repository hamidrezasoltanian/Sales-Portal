'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireManager);

function mapWeekEntry(r) {
  const v = r.value || {};
  return {
    id: r.id,
    weekId: r.week_id,
    rtype: r.rtype,
    rid: r.rid,
    centerName: r.center_name,
    scheduledDate: r.scheduled_date,
    actionType: r.action_type,
    done: r.done,
    doneDate: r.done_date,
    doneResult: v.doneResult || null,
    doneNote: v.doneNote || null,
    doneObstacle: v.doneObstacle || null,
    doneAmount: v.doneAmount || null,
    addedBy: r.added_by,
    centerKey: (r.rtype && r.rid) ? r.rtype + '_' + r.rid : null,
  };
}

// GET /api/manager-reports/expert/:username?from=&to=
router.get('/expert/:username', async function (req, res) {
  try {
    const username = req.params.username;
    const from = req.query.from || '1400/01/01';
    const to = req.query.to || '1410/12/29';

    const [weR, actR, salesR, pfR] = await Promise.all([
      query(
        `SELECT id, week_id, rtype, rid, center_name, scheduled_date, action_type,
                done, done_date, value, added_by
         FROM week_entries
         WHERE added_by = $1 AND scheduled_date >= $2 AND scheduled_date <= $3
         ORDER BY scheduled_date DESC`,
        [username, from, to]
      ),
      query(
        `SELECT date, username, count, note, 'call' AS kind FROM call_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         UNION ALL
         SELECT date, username, count, note, 'visit' AS kind FROM visit_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC LIMIT 300`,
        [username, from, to]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT id, date, center_name, center_key, amount, is_cash FROM sales_log
         WHERE username = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
        [username, from, to]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT id, no, status, total, center_name, jalali_date FROM proformas
         WHERE created_by = $1 AND jalali_date >= $2 AND jalali_date <= $3
         ORDER BY created_at DESC LIMIT 100`,
        [username, from, to]
      ).catch(function () { return { rows: [] }; }),
    ]);

    const weekEntries = weR.rows.map(mapWeekEntry);
    const planned = weekEntries.length;
    const done = weekEntries.filter(function (w) { return w.done; }).length;

    res.json({
      ok: true,
      username,
      from,
      to,
      summary: {
        planned,
        done,
        notDone: planned - done,
        donePct: planned ? Math.round(done / planned * 100) : 0,
        salesCount: salesR.rows.length,
        salesTotal: salesR.rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0),
        proformaCount: pfR.rows.length,
        proformaApproved: pfR.rows.filter(function (p) { return p.status === 'approved' || p.status === 'invoiced'; }).length,
      },
      weekEntries,
      activity: actR.rows,
      sales: salesR.rows,
      proformas: pfR.rows.map(function (p) {
        return { id: p.id, no: p.no, status: p.status, total: Number(p.total), centerName: p.center_name, jalaliDate: p.jalali_date };
      }),
    });
  } catch (e) {
    console.error('[manager-reports expert]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/expert/:username/done-logs?from=&to=&page=1&limit=50
router.get('/expert/:username/done-logs', async function (req, res) {
  try {
    const username = req.params.username;
    const from = req.query.from || '1400/01/01';
    const to = req.query.to || '1410/12/29';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const countR = await query(
      `SELECT COUNT(*)::int AS cnt FROM week_entries
       WHERE added_by = $1 AND scheduled_date >= $2 AND scheduled_date <= $3 AND done = TRUE`,
      [username, from, to]
    );
    const total = countR.rows[0]?.cnt || 0;

    const r = await query(
      `SELECT id, week_id, rtype, rid, center_name, scheduled_date, action_type,
              done, done_date, value, added_by
       FROM week_entries
       WHERE added_by = $1 AND scheduled_date >= $2 AND scheduled_date <= $3 AND done = TRUE
       ORDER BY done_date DESC NULLS LAST, scheduled_date DESC
       LIMIT $4 OFFSET $5`,
      [username, from, to, limit, offset]
    );

    res.json({
      ok: true,
      username,
      from,
      to,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      entries: r.rows.map(mapWeekEntry),
    });
  } catch (e) {
    console.error('[manager-reports done-logs]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/daily?date=1404/04/19
router.get('/daily', async function (req, res) {
  try {
    const date = req.query.date || req.query.jalali_date;
    if (!date) return res.status(400).json({ error: 'date الزامی است (Jalali YYYY/MM/DD)' });

    const [weR, callR, visitR] = await Promise.all([
      query(
        `SELECT added_by, COUNT(*)::int AS planned,
                COUNT(*) FILTER (WHERE done)::int AS done_cnt
         FROM week_entries WHERE scheduled_date = $1
         GROUP BY added_by ORDER BY planned DESC`,
        [date]
      ),
      query(
        `SELECT username, SUM(count)::int AS calls FROM call_log WHERE date = $1 GROUP BY username`,
        [date]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT username, SUM(count)::int AS visits FROM visit_log WHERE date = $1 GROUP BY username`,
        [date]
      ).catch(function () { return { rows: [] }; }),
    ]);

    const byUser = {};
    weR.rows.forEach(function (r) {
      byUser[r.added_by] = { planned: r.planned, done: r.done_cnt, calls: 0, visits: 0 };
    });
    callR.rows.forEach(function (r) {
      if (!byUser[r.username]) byUser[r.username] = { planned: 0, done: 0, calls: 0, visits: 0 };
      byUser[r.username].calls = r.calls;
    });
    visitR.rows.forEach(function (r) {
      if (!byUser[r.username]) byUser[r.username] = { planned: 0, done: 0, calls: 0, visits: 0 };
      byUser[r.username].visits = r.visits;
    });

    res.json({ ok: true, date, experts: byUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/team-summary?from=&to=
router.get('/team-summary', async function (req, res) {
  try {
    const from = req.query.from || '1400/01/01';
    const to = req.query.to || '1410/12/29';

    const [weR, salesR, pfR] = await Promise.all([
      query(
        `SELECT added_by,
                COUNT(*)::int AS planned,
                COUNT(*) FILTER (WHERE done)::int AS done_cnt
         FROM week_entries
         WHERE scheduled_date >= $1 AND scheduled_date <= $2
         GROUP BY added_by`,
        [from, to]
      ),
      query(
        `SELECT username, COUNT(*)::int AS cnt, COALESCE(SUM(amount),0) AS total
         FROM sales_log WHERE date >= $1 AND date <= $2 GROUP BY username`,
        [from, to]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT created_by, COUNT(*)::int AS cnt,
                COUNT(*) FILTER (WHERE status IN ('approved','invoiced'))::int AS approved
         FROM proformas WHERE jalali_date >= $1 AND jalali_date <= $2 GROUP BY created_by`,
        [from, to]
      ).catch(function () { return { rows: [] }; }),
    ]);

    const experts = {};
    weR.rows.forEach(function (r) {
      experts[r.added_by] = { planned: r.planned, done: r.done_cnt, salesCount: 0, salesTotal: 0, proformas: 0, proformaApproved: 0 };
    });
    salesR.rows.forEach(function (r) {
      if (!experts[r.username]) experts[r.username] = { planned: 0, done: 0, salesCount: 0, salesTotal: 0, proformas: 0, proformaApproved: 0 };
      experts[r.username].salesCount = r.cnt;
      experts[r.username].salesTotal = Number(r.total);
    });
    pfR.rows.forEach(function (r) {
      if (!experts[r.created_by]) experts[r.created_by] = { planned: 0, done: 0, salesCount: 0, salesTotal: 0, proformas: 0, proformaApproved: 0 };
      experts[r.created_by].proformas = r.cnt;
      experts[r.created_by].proformaApproved = r.approved;
    });

    res.json({ ok: true, from, to, experts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/win-loss?from=&to=
router.get('/win-loss', async function (req, res) {
  try {
    const r = await query(
      `SELECT COALESCE(NULLIF(data->>'closeReason',''), data->>'lostReason', 'نامشخص') AS reason,
              data->>'lead' AS lead, COUNT(*)::int AS cnt
       FROM center_edits
       WHERE data->>'status' IN ('غیرفعال', 'بسته', 'قرارداد بسته شد', 'عدم نیاز فاکتور کنسل شد')
       GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 50`
    );
    const won = await query(
      `SELECT COUNT(*)::int AS cnt, COALESCE(SUM((data->>'oppValue')::numeric),0) AS total_value
       FROM center_edits WHERE data->>'status' = 'قرارداد بسته شد' OR data->>'lead' = 'مشتری'`
    );
    res.json({
      ok: true,
      lostBreakdown: r.rows,
      wonCenters: won.rows[0] || { cnt: 0, total_value: 0 },
    });
  } catch (e) {
    console.error('[manager-reports win-loss]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/weekly-snapshots?limit=12
router.get('/weekly-snapshots', async function (req, res) {
  try {
    const limit = Math.min(52, parseInt(req.query.limit, 10) || 12);
    const r = await query(
      'SELECT week_key, snapshot, created_at FROM manager_weekly_snapshots ORDER BY week_key DESC LIMIT $1',
      [limit]
    ).catch(function () { return { rows: [] }; });
    res.json({ ok: true, snapshots: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/manager-reports/weekly-snapshot — save current week summary (manager/cron)
router.post('/weekly-snapshot', async function (req, res) {
  try {
    const weekKey = req.body.weekKey || req.body.week_key;
    if (!weekKey) return res.status(400).json({ error: 'weekKey الزامی است' });
    const snapshot = req.body.snapshot || req.body.data || {};
    await query(
      `INSERT INTO manager_weekly_snapshots (week_key, snapshot, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (week_key) DO UPDATE SET snapshot = EXCLUDED.snapshot, created_at = NOW(), created_by = EXCLUDED.created_by`,
      [weekKey, JSON.stringify(snapshot), req.user.username]
    );
    res.json({ ok: true, weekKey });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireManager);

// GET /api/manager-reports/expert/:username?from=1405/01/01&to=1405/01/31
router.get('/expert/:username', async function (req, res) {
  try {
    const username = req.params.username;
    const from = req.query.from || '1400/01/01';
    const to = req.query.to || '1410/12/29';

    const [weR, actR, notesR, dealsR, salesR] = await Promise.all([
      query(
        `SELECT id, week_id, rtype, rid, center_name, scheduled_date, action_type,
                done, done_date, value, added_by
         FROM week_entries
         WHERE added_by = $1 AND scheduled_date >= $2 AND scheduled_date <= $3
         ORDER BY scheduled_date DESC`,
        [username, from, to]
      ),
      query(
        `SELECT id, date, username, count, note, 'call' AS kind FROM call_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         UNION ALL
         SELECT id, date, username, count, note, 'visit' AS kind FROM visit_log
         WHERE username = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC LIMIT 200`,
        [username, from, to]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT center_key, notes FROM center_notes WHERE notes::text ILIKE $1 LIMIT 100`,
        ['%' + username + '%']
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT * FROM center_deals WHERE owner = $1 AND status = 'open' ORDER BY updated_at DESC LIMIT 50`,
        [username]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT id, date, center_name, center_key, amount, is_cash FROM sales_log
         WHERE username = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
        [username, from, to]
      ).catch(function () { return { rows: [] }; }),
    ]);

    const weekEntries = weR.rows.map(function (r) {
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
        doneAmount: v.doneAmount || null,
        addedBy: r.added_by,
      };
    });

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
        openDeals: dealsR.rows.length,
      },
      weekEntries,
      activity: actR.rows,
      openDeals: dealsR.rows.map(function (d) {
        return {
          id: d.id, centerKey: d.center_key, title: d.title, stage: d.stage,
          valueMillion: Number(d.value_million), grade: d.grade, expectedClose: d.expected_close,
        };
      }),
      sales: salesR.rows,
    });
  } catch (e) {
    console.error('[manager-reports expert]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager-reports/win-loss — aggregate close reasons
router.get('/win-loss', async function (req, res) {
  try {
    const r = await query(
      `SELECT data->>'closeReason' AS reason, data->>'lostReason' AS lost_reason,
              data->>'lead' AS lead, COUNT(*)::int AS cnt
       FROM center_edits
       WHERE data->>'status' IN ('غیرفعال', 'بسته', 'قرارداد بسته شد', 'عدم نیاز فاکتور کنسل شد')
       GROUP BY 1, 2, 3 ORDER BY cnt DESC LIMIT 50`
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

module.exports = router;

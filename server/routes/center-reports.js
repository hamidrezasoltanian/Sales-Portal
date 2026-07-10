'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/center-reports/:centerKey/timeline?from=&to=
router.get('/:centerKey/timeline', async function (req, res) {
  try {
    const ck = decodeURIComponent(req.params.centerKey);
    const from = req.query.from || '1400/01/01';
    const to = req.query.to || '1410/12/29';
    const events = [];

    const [notesR, clR, weR, pfR, salesR] = await Promise.all([
      query('SELECT notes, updated_at FROM center_notes WHERE center_key = $1', [ck]).catch(function () { return { rows: [] }; }),
      query(
        `SELECT at, "by", field, val, rkey FROM change_log
         WHERE rkey = $1 ORDER BY at DESC LIMIT 200`,
        [ck]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT scheduled_date, done, done_date, value, action_type, added_by, center_name
         FROM week_entries
         WHERE (rec_key = $1 OR rtype || '_' || rid = $1)
           AND scheduled_date >= $2 AND scheduled_date <= $3
         ORDER BY scheduled_date DESC LIMIT 100`,
        [ck, from, to]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT id, no, status, total, jalali_date, created_by FROM proformas
         WHERE center_key = $1 ORDER BY created_at DESC LIMIT 50`,
        [ck]
      ).catch(function () { return { rows: [] }; }),
      query(
        `SELECT date, amount, username, is_cash FROM sales_log
         WHERE center_key = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
        [ck, from, to]
      ).catch(function () { return { rows: [] }; }),
    ]);

    if (notesR.rows.length && notesR.rows[0].notes) {
      const notes = notesR.rows[0].notes;
      (Array.isArray(notes) ? notes : []).forEach(function (n, i) {
        events.push({
          type: 'note',
          at: n.at || n.date || '',
          by: n.by || n.user || '',
          text: n.text || '',
          sortKey: n.at || n.date || '',
        });
      });
    }

    clR.rows.forEach(function (cl) {
      events.push({
        type: 'change',
        at: cl.at,
        by: cl.by,
        field: cl.field,
        val: cl.val,
        sortKey: cl.at,
      });
    });

    weR.rows.forEach(function (we) {
      var v = we.value || {};
      events.push({
        type: 'week_entry',
        at: we.done_date || we.scheduled_date,
        by: we.added_by,
        scheduledDate: we.scheduled_date,
        done: we.done,
        actionType: we.action_type,
        doneResult: v.doneResult,
        doneNote: v.doneNote,
        doneAmount: v.doneAmount,
        sortKey: we.scheduled_date,
      });
    });

    pfR.rows.forEach(function (p) {
      events.push({
        type: 'proforma',
        at: p.jalali_date,
        by: p.created_by,
        no: p.no,
        status: p.status,
        total: Number(p.total),
        sortKey: p.jalali_date,
      });
    });

    salesR.rows.forEach(function (s) {
      events.push({
        type: 'sale',
        at: s.date,
        by: s.username,
        amount: Number(s.amount),
        isCash: s.is_cash,
        sortKey: s.date,
      });
    });

    events.sort(function (a, b) {
      return String(b.sortKey || '').localeCompare(String(a.sortKey || ''));
    });

    res.json({ ok: true, centerKey: ck, from, to, events });
  } catch (e) {
    console.error('[center-reports timeline]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

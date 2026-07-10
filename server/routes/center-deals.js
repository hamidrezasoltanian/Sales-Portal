'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function rowToDeal(r) {
  return {
    id: r.id,
    centerKey: r.center_key,
    title: r.title,
    stage: r.stage,
    valueMillion: Number(r.value_million) || 0,
    probability: r.probability,
    grade: r.grade,
    expectedClose: r.expected_close,
    owner: r.owner,
    status: r.status,
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/center-deals?center_key=...
router.get('/', async function (req, res) {
  try {
    const ck = req.query.center_key;
    if (!ck) return res.status(400).json({ error: 'center_key الزامی است' });
    const r = await query(
      'SELECT * FROM center_deals WHERE center_key = $1 ORDER BY updated_at DESC',
      [String(ck)]
    );
    res.json({ deals: r.rows.map(rowToDeal) });
  } catch (e) {
    console.error('[center-deals GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/center-deals
router.post('/', async function (req, res) {
  try {
    const b = req.body || {};
    if (!b.centerKey) return res.status(400).json({ error: 'centerKey الزامی است' });
    const id = b.id || ('deal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const r = await query(
      `INSERT INTO center_deals (id, center_key, title, stage, value_million, probability, grade,
         expected_close, owner, status, notes, updated_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)
       RETURNING *`,
      [
        id, b.centerKey, b.title || 'فرصت جدید', b.stage || 'فرصت',
        b.valueMillion || 0, b.probability || 'medium', b.grade || 'B',
        b.expectedClose || '', b.owner || req.user.username, b.status || 'open',
        b.notes || '', req.user.username,
      ]
    );
    res.status(201).json(rowToDeal(r.rows[0]));
  } catch (e) {
    console.error('[center-deals POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/center-deals/:id
router.put('/:id', async function (req, res) {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE center_deals SET
         title = COALESCE($2, title),
         stage = COALESCE($3, stage),
         value_million = COALESCE($4, value_million),
         probability = COALESCE($5, probability),
         grade = COALESCE($6, grade),
         expected_close = COALESCE($7, expected_close),
         owner = COALESCE($8, owner),
         status = COALESCE($9, status),
         notes = COALESCE($10, notes),
         updated_at = NOW(),
         updated_by = $11
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.title, b.stage, b.valueMillion, b.probability, b.grade,
        b.expectedClose, b.owner, b.status, b.notes, req.user.username,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json(rowToDeal(r.rows[0]));
  } catch (e) {
    console.error('[center-deals PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/center-deals/:id
router.delete('/:id', async function (req, res) {
  try {
    const r = await query('DELETE FROM center_deals WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[center-deals DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

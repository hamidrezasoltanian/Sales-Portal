'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { softDeleteCenter } = require('../lib/soft-delete');

const router = express.Router();

function rowToExtra(r) {
  return {
    id: r.id,
    row: r.row,
    name: r.name,
    potential: r.potential,
    type: r.type,
    lead: r.lead,
    province_id: r.province_id,
    owner: r.owner,
  };
}

// POST /api/center-extras — upsert one extra center
router.post('/', requireAuth, async function (req, res) {
  try {
    const c = req.body || {};
    if (!c.id) return res.status(400).json({ error: 'id الزامی است' });
    const result = await query(
      `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
       ON CONFLICT (id) DO UPDATE SET
         row_num = EXCLUDED.row_num, name = EXCLUDED.name, potential = EXCLUDED.potential,
         type = EXCLUDED.type, lead = EXCLUDED.lead, province_id = EXCLUDED.province_id,
         owner = EXCLUDED.owner, updated_at = NOW(), updated_by = EXCLUDED.updated_by
       RETURNING id, row_num as row, name, potential, type, lead, province_id, owner`,
      [
        c.id, c.row || 0, c.name || '', c.potential || 1,
        c.type || null, c.lead || 'سرنخ', c.province_id || '', c.owner || null,
        req.user.username,
      ]
    );
    res.json({ ok: true, center: rowToExtra(result.rows[0]) });
  } catch (e) {
    console.error('[center-extras POST]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// DELETE /api/center-extras/:id — soft delete (سطل زباله)
router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const id = req.params.id;
    const existing = await query(
      'SELECT id, row_num, name, potential, type, lead, province_id, owner FROM center_extras WHERE id = $1',
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    const row = existing.rows[0];
    const rtype = 'pc';
    const centerKey = rtype + '_' + id;
    const trashRow = await softDeleteCenter({
      centerKey: centerKey,
      rtype: rtype,
      id: id,
      name: row.name,
      provinceId: row.province_id,
      isExtra: true,
      extraId: id,
      centerRecord: rowToExtra(row),
    }, req.user.username);
    res.json({ ok: true, deleted: id, trashId: trashRow.id, message: 'به سطل زباله منتقل شد' });
  } catch (e) {
    console.error('[center-extras DELETE]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

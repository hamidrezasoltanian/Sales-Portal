'use strict';
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();
router.use(requireAuth);

// PUT /api/contacts/:centerKey — upsert contact info for a center
router.put('/:centerKey', async (req, res) => {
  const centerKey = decodeURIComponent(req.params.centerKey);
  const { centerName, contactName, contactTitle, phones, address } = req.body || {};
  try {
    await query(
      `INSERT INTO center_contacts (center_key, center_name, contact_name, contact_title, phones, address, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (center_key) DO UPDATE SET
         center_name   = EXCLUDED.center_name,
         contact_name  = EXCLUDED.contact_name,
         contact_title = EXCLUDED.contact_title,
         phones        = EXCLUDED.phones,
         address       = EXCLUDED.address,
         updated_by    = EXCLUDED.updated_by,
         updated_at    = NOW()`,
      [centerKey, centerName || '', contactName || '', contactTitle || '',
       phones && phones.length ? phones : null, address || '', req.user.username]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('[contacts PUT]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/contacts/:centerKey — get contact info for one center
router.get('/:centerKey', async (req, res) => {
  const centerKey = decodeURIComponent(req.params.centerKey);
  try {
    const r = await query('SELECT * FROM center_contacts WHERE center_key = $1', [centerKey]);
    return res.json(r.rows[0] || null);
  } catch (e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/contacts?q=... — search contacts by name/phone
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const r = await query(
      `SELECT * FROM center_contacts
       WHERE contact_name ILIKE $1 OR address ILIKE $1 OR $1 = ANY(phones)
       ORDER BY updated_at DESC LIMIT 30`,
      ['%' + q + '%']
    );
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

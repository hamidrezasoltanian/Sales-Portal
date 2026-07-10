'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/hcps/kol-centers — center keys with KOL affiliation (for list badges)
router.get('/kol-centers', async function (req, res) {
  try {
    const r = await query(
      `SELECT DISTINCT center_key FROM hcp_affiliations
       WHERE influence_level ILIKE '%KOL%' OR influence_level ILIKE '%کلیدی%'`
    );
    res.json({ keys: r.rows.map(function (row) { return row.center_key; }) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── HCP ENDPOINTS ──────────────────────────────────────────────────────────

// GET /api/hcps - list/search HCPs
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const specialty = (req.query.specialty || '').trim();
    
    let sql = `
      SELECT h.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'center_key', a.center_key,
                   'role', a.role,
                   'influence_level', a.influence_level,
                   'center_name', a.center_name,
                   'province_name', a.province_name
                 )
               ) FILTER (WHERE a.center_key IS NOT NULL), '[]'
             ) as affiliations
      FROM healthcare_professionals h
      LEFT JOIN hcp_affiliations a ON h.id = a.hcp_id
    `;
    const params = [];
    const conditions = ['h.deleted_at IS NULL'];

    if (q) {
      params.push('%' + q + '%');
      conditions.push(`(h.name ILIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(h.phones) p WHERE p ILIKE $${params.length}))`);
    }

    if (specialty) {
      params.push('%' + specialty + '%');
      conditions.push(`h.specialty ILIKE $${params.length}`);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY h.id ORDER BY h.name ASC LIMIT 500';

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (e) {
    console.error('[HCP GET /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/hcps - create an HCP
router.post('/', async (req, res) => {
  try {
    const { name, specialty, rank, medicalCouncilNo, phones, email, notes } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'نام و نام خانوادگی الزامی است' });
    }

    const id = 'hcp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const phonesArr = Array.isArray(phones) ? phones.filter(Boolean) : [];

    const result = await query(
      `INSERT INTO healthcare_professionals (id, name, specialty, rank, medical_council_no, phones, email, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        name.trim(),
        specialty ? specialty.trim() : null,
        rank ? rank.trim() : null,
        medicalCouncilNo ? medicalCouncilNo.trim() : null,
        phonesArr,
        email ? email.trim() : null,
        notes ? notes.trim() : null,
        req.user.username,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('[HCP POST /]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/hcps/:id - get an HCP by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM healthcare_professionals WHERE id = $1', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'یافت نشد' });
    }
    return res.json(result.rows[0]);
  } catch (e) {
    console.error('[HCP GET /:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/hcps/:id - update an HCP
router.put('/:id', async (req, res) => {
  try {
    const { name, specialty, rank, medicalCouncilNo, phones, email, notes } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'نام و نام خانوادگی الزامی است' });
    }

    const phonesArr = Array.isArray(phones) ? phones.filter(Boolean) : [];

    const result = await query(
      `UPDATE healthcare_professionals
       SET name = $1,
           specialty = $2,
           rank = $3,
           medical_council_no = $4,
           phones = $5,
           email = $6,
           notes = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name.trim(),
        specialty ? specialty.trim() : null,
        rank ? rank.trim() : null,
        medicalCouncilNo ? medicalCouncilNo.trim() : null,
        phonesArr,
        email ? email.trim() : null,
        notes ? notes.trim() : null,
        req.params.id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'پزشک/کارشناس یافت نشد' });
    }

    return res.json(result.rows[0]);
  } catch (e) {
    console.error('[HCP PUT /:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/hcps/:id - delete an HCP
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM healthcare_professionals WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'پزشک/کارشناس یافت نشد' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[HCP DELETE /:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── AFFILIATION ENDPOINTS ──────────────────────────────────────────────────

// GET /api/hcps/:id/affiliations - get centers linked to this HCP
router.get('/:id/affiliations', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, p.name as hcp_name, p.specialty as hcp_specialty, p.rank as hcp_rank
       FROM hcp_affiliations a
       JOIN healthcare_professionals p ON a.hcp_id = p.id
       WHERE a.hcp_id = $1
       ORDER BY a.updated_at DESC`,
      [req.params.id]
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('[HCP GET /:id/affiliations]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/centers/:centerKey/affiliations - get HCPs linked to this center
router.get('/centers/:centerKey/affiliations', async (req, res) => {
  try {
    const centerKey = decodeURIComponent(req.params.centerKey);
    const result = await query(
      `SELECT a.*, p.name as hcp_name, p.specialty as hcp_specialty, p.rank as hcp_rank, p.phones as hcp_phones, p.medical_council_no as hcp_mc_no
       FROM hcp_affiliations a
       JOIN healthcare_professionals p ON a.hcp_id = p.id
       WHERE a.center_key = $1
       ORDER BY a.id ASC`,
      [centerKey]
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('[HCP GET /centers/:centerKey/affiliations]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/affiliations - link HCP to center
router.post('/affiliations', async (req, res) => {
  try {
    const { centerKey, hcpId, role, influenceLevel, workingHours, notes, centerName, provinceName } = req.body || {};
    if (!centerKey || !hcpId) {
      return res.status(400).json({ error: 'فیلدهای centerKey و hcpId الزامی هستند' });
    }

    const result = await query(
      `INSERT INTO hcp_affiliations (center_key, hcp_id, role, influence_level, working_hours, notes, center_name, province_name, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (center_key, hcp_id) DO UPDATE SET
         role = EXCLUDED.role,
         influence_level = EXCLUDED.influence_level,
         working_hours = EXCLUDED.working_hours,
         notes = EXCLUDED.notes,
         center_name = COALESCE(EXCLUDED.center_name, hcp_affiliations.center_name),
         province_name = COALESCE(EXCLUDED.province_name, hcp_affiliations.province_name),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [
        centerKey,
        hcpId,
        role ? role.trim() : null,
        influenceLevel ? influenceLevel.trim() : 'Decision Maker',
        workingHours ? workingHours.trim() : null,
        notes ? notes.trim() : null,
        centerName ? centerName.trim() : null,
        provinceName ? provinceName.trim() : null,
        req.user.username,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('[HCP POST /affiliations]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/affiliations/:id - update affiliation details
router.put('/affiliations/:id', async (req, res) => {
  try {
    const { role, influenceLevel, workingHours, notes } = req.body || {};
    const result = await query(
      `UPDATE hcp_affiliations
       SET role = $1,
           influence_level = $2,
           working_hours = $3,
           notes = $4,
           updated_by = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        role ? role.trim() : null,
        influenceLevel ? influenceLevel.trim() : 'Decision Maker',
        workingHours ? workingHours.trim() : null,
        notes ? notes.trim() : null,
        req.user.username,
        req.params.id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'ارتباط یافت نشد' });
    }

    return res.json(result.rows[0]);
  } catch (e) {
    console.error('[HCP PUT /affiliations/:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/affiliations/:id - delete affiliation
router.delete('/affiliations/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM hcp_affiliations WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ارتباط یافت نشد' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[HCP DELETE /affiliations/:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// DELETE /api/hcps/:id - Soft delete an HCP
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE healthcare_professionals SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`, [id]);
    return res.json({ success: true });
  } catch (e) {
    console.error('[HCP DELETE /:id]', e.message);
    return res.status(500).json({ error: 'خطای سرور در حذف مخاطب' });
  }
});

// PUT /api/hcps/:id/active - Toggle active status
router.put('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await query(`UPDATE healthcare_professionals SET is_active = $1 WHERE id = $2`, [is_active, id]);
    return res.json({ success: true, is_active });
  } catch (e) {
    console.error('[HCP PUT /:id/active]', e.message);
    return res.status(500).json({ error: 'خطای سرور در تغییر وضعیت مخاطب' });
  }
});

// DELETE /api/hcps/centers/:centerKey/affiliations/:hcpId - Remove affiliation
router.delete('/centers/:centerKey/affiliations/:hcpId', async (req, res) => {
  try {
    const { centerKey, hcpId } = req.params;
    await query(`DELETE FROM hcp_affiliations WHERE center_key = $1 AND hcp_id = $2`, [centerKey, hcpId]);
    return res.json({ success: true });
  } catch (e) {
    console.error('[HCP DELETE affiliation]', e.message);
    return res.status(500).json({ error: 'خطای سرور در حذف ارتباط مخاطب' });
  }
});

module.exports = router;

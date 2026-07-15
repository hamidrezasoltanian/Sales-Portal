'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);
router.use(function (req, res, next) {
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('trade-kpi', level)(req, res, next);
});

function isManager(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

function uid(prefix) {
  return (prefix || 'tpt') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function normalizeField(f) {
  if (!f || typeof f !== 'object') return null;
  return {
    id: f.id || uid('fld'),
    name: f.name || f.id || 'field',
    label: f.label || f.name || 'فیلد',
    type: f.type || f.field_type || f.fieldType || 'text',
    required: !!(f.required || f.is_required || f.isRequired),
    width: f.width === 'full' ? 'full' : 'half',
    options: Array.isArray(f.options) ? f.options : [],
  };
}

function normalizeStep(s, idx) {
  if (!s || typeof s !== 'object') return null;
  const fields = (s.fields || []).map(normalizeField).filter(Boolean);
  return {
    id: s.id || uid('step'),
    title: s.title || s.name || ('مرحله ' + (idx + 1)),
    order: s.order != null ? s.order : (s.step_order != null ? s.step_order : idx),
    fields: fields,
  };
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map(normalizeStep).filter(Boolean).sort(function (a, b) {
    return (a.order || 0) - (b.order || 0);
  });
}

function rowToTemplate(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    category: r.category || '',
    steps: r.steps || [],
    isActive: r.is_active !== false,
    version: r.version || 1,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/trade-templates
router.get('/', async function (req, res) {
  try {
    const activeOnly = req.query.active !== 'false';
    const sql = activeOnly
      ? 'SELECT * FROM trade_process_templates WHERE is_active = TRUE ORDER BY name ASC'
      : 'SELECT * FROM trade_process_templates ORDER BY name ASC';
    const { rows } = await query(sql);
    res.json({ templates: rows.map(rowToTemplate) });
  } catch (e) {
    console.error('[trade-templates GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trade-templates/:id
router.get('/:id', async function (req, res) {
  try {
    const { rows } = await query('SELECT * FROM trade_process_templates WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'قالب یافت نشد' });
    res.json(rowToTemplate(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/trade-templates
router.post('/', async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { name, description, category, steps } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'نام الزامی است' });
    const id = uid('tpt');
    const normSteps = normalizeSteps(steps || []);
    await query(
      `INSERT INTO trade_process_templates (id, name, description, category, steps, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, String(name).trim(), description || '', category || '', JSON.stringify(normSteps), req.user.username]
    );
    const { rows } = await query('SELECT * FROM trade_process_templates WHERE id=$1', [id]);
    res.status(201).json(rowToTemplate(rows[0]));
  } catch (e) {
    console.error('[trade-templates POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/trade-templates/:id
router.put('/:id', async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { name, description, category, steps, isActive } = req.body || {};
    const { rows: existing } = await query('SELECT * FROM trade_process_templates WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'قالب یافت نشد' });

    const normSteps = steps != null ? normalizeSteps(steps) : existing[0].steps;
    const nextVersion = (parseInt(existing[0].version, 10) || 1) + (steps != null ? 1 : 0);

    await query(
      `UPDATE trade_process_templates SET
         name=COALESCE($2, name),
         description=COALESCE($3, description),
         category=COALESCE($4, category),
         steps=COALESCE($5, steps),
         is_active=COALESCE($6, is_active),
         version=$7,
         updated_at=NOW()
       WHERE id=$1`,
      [
        req.params.id,
        name != null ? String(name).trim() : null,
        description != null ? description : null,
        category != null ? category : null,
        steps != null ? JSON.stringify(normSteps) : null,
        isActive != null ? !!isActive : null,
        nextVersion,
      ]
    );
    const { rows } = await query('SELECT * FROM trade_process_templates WHERE id=$1', [req.params.id]);
    res.json(rowToTemplate(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/trade-templates/:id — soft deactivate
router.delete('/:id', async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { rowCount } = await query(
      'UPDATE trade_process_templates SET is_active=FALSE, updated_at=NOW() WHERE id=$1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'قالب یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

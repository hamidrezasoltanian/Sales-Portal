'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');
const { syncKpiFromCaseStep, syncAllCompletedSteps } = require('../lib/trade-case-kpi');

const router = express.Router();
router.use(requireAuth);
router.use(function (req, res, next) {
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('trade-kpi', level)(req, res, next);
});

let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch (e) {}

function isManager(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

function uid(prefix) {
  return (prefix || 'tc') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function currentJalaliMonth() {
  try {
    const { dateToJalali } = require('../lib/wms-jalali');
    const j = dateToJalali(new Date());
    if (j) return j.slice(0, 7); // YYYY/MM
  } catch (e) { /* ignore */ }
  return '';
}

function parseStepsData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function rowToCase(r) {
  return {
    id: r.id,
    caseNumber: r.case_number,
    title: r.title,
    templateId: r.template_id,
    templateVersion: r.template_version,
    assignedTo: r.assigned_to,
    stepsData: parseStepsData(r.steps_data),
    isFinalized: !!r.is_finalized,
    finalizedAt: r.finalized_at,
    jalaliMonth: r.jalali_month,
    proformaId: r.proforma_id,
    centerKey: r.center_key,
    priority: r.priority || 'normal',
    notes: r.notes || '',
    status: r.status || 'active',
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function canAccessCase(user, assignedTo) {
  if (isManager(user.role)) return true;
  return user.username === assignedTo;
}

async function logActivity(caseId, userId, action, details) {
  try {
    await query(
      'INSERT INTO trade_case_activities (id, case_id, user_id, action, details) VALUES ($1,$2,$3,$4,$5)',
      [uid('tca'), caseId, userId || null, action, details || '']
    );
  } catch (e) {
    console.warn('[trade-cases activity]', e.message);
  }
}

function emitCaseEvent(type, payload, cid) {
  if (_broadcast) _broadcast(type, payload, cid || '');
}

async function nextCaseNumber() {
  const year = new Date().getFullYear();
  const prefix = 'TC-' + year + '-';
  const { rows } = await query(
    "SELECT case_number FROM trade_cases WHERE case_number LIKE $1 ORDER BY case_number DESC LIMIT 1",
    [prefix + '%']
  );
  let n = 1;
  if (rows.length && rows[0].case_number) {
    const parts = String(rows[0].case_number).split('-');
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) n = last + 1;
  }
  return prefix + String(n).padStart(4, '0');
}

// GET /api/trade-cases
router.get('/', async function (req, res) {
  try {
    const user = req.user;
    const month = req.query.month || '';
    const assigned = req.query.assigned_to || '';
    const status = req.query.status || 'active';
    const templateId = req.query.template_id || '';

    let sql = 'SELECT * FROM trade_cases WHERE 1=1';
    const params = [];
    let i = 1;

    if (!isManager(user.role)) {
      sql += ' AND assigned_to=$' + i;
      params.push(user.username);
      i++;
    } else if (assigned) {
      sql += ' AND assigned_to=$' + i;
      params.push(assigned);
      i++;
    }
    if (month) {
      sql += ' AND jalali_month=$' + i;
      params.push(month);
      i++;
    }
    if (status && status !== 'all') {
      sql += ' AND status=$' + i;
      params.push(status);
      i++;
    }
    if (templateId) {
      sql += ' AND template_id=$' + i;
      params.push(templateId);
      i++;
    }

    sql += ' ORDER BY updated_at DESC LIMIT 500';
    const { rows } = await query(sql, params);
    res.json({ cases: rows.map(rowToCase) });
  } catch (e) {
    console.error('[trade-cases GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trade-cases/:id/full — case + template (must be before /:id if conflicting — use explicit path)
router.get('/:id/full', async function (req, res) {
  try {
    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'پرونده یافت نشد' });
    if (!canAccessCase(req.user, rows[0].assigned_to)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    const c = rowToCase(rows[0]);
    let template = null;
    if (c.templateId) {
      const tr = await query('SELECT * FROM trade_process_templates WHERE id=$1', [c.templateId]);
      if (tr.rows.length) {
        template = {
          id: tr.rows[0].id,
          name: tr.rows[0].name,
          description: tr.rows[0].description || '',
          steps: tr.rows[0].steps || [],
        };
      }
    }
    const actR = await query(
      'SELECT id, user_id, action, details, at FROM trade_case_activities WHERE case_id=$1 ORDER BY at DESC LIMIT 30',
      [req.params.id]
    );
    res.json({
      case: c,
      template: template,
      activities: actR.rows.map(function (a) {
        return {
          id: a.id,
          userId: a.user_id,
          action: a.action,
          details: a.details,
          at: a.at,
        };
      }),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trade-cases/:id
router.get('/:id', async function (req, res) {
  try {
    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'پرونده یافت نشد' });
    if (!canAccessCase(req.user, rows[0].assigned_to)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    res.json(rowToCase(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/trade-cases
router.post('/', async function (req, res) {
  try {
    const body = req.body || {};
    const title = body.title && String(body.title).trim();
    const templateId = body.templateId || body.template_id;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });
    if (!templateId) return res.status(400).json({ error: 'قالب فرآیند الزامی است' });

    const { rows: tplRows } = await query(
      'SELECT id, version FROM trade_process_templates WHERE id=$1 AND is_active=TRUE',
      [templateId]
    );
    if (!tplRows.length) return res.status(400).json({ error: 'قالب فعال یافت نشد' });

    const assignedTo = body.assignedTo || body.assigned_to
      || (isManager(req.user.role) ? null : req.user.username);
    if (!assignedTo) return res.status(400).json({ error: 'کارشناس مسئول الزامی است' });
    if (!isManager(req.user.role) && assignedTo !== req.user.username) {
      return res.status(403).json({ error: 'فقط پرونده خودتان' });
    }

    const id = uid('tc');
    const caseNumber = await nextCaseNumber();
    const jalaliMonth = body.jalaliMonth || body.jalali_month || currentJalaliMonth();

    await query(
      `INSERT INTO trade_cases (
         id, case_number, title, template_id, template_version, assigned_to,
         steps_data, jalali_month, proforma_id, center_key, priority, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id, caseNumber, title, templateId, tplRows[0].version || 1, assignedTo,
        JSON.stringify(body.stepsData || body.steps_data || {}),
        jalaliMonth,
        body.proformaId || body.proforma_id || null,
        body.centerKey || body.center_key || null,
        body.priority || 'normal',
        body.notes || '',
        req.user.username,
      ]
    );

    await logActivity(id, req.user.username, 'create', 'پرونده ایجاد شد: ' + title);
    emitCaseEvent('trade-case-changed', { id: id, action: 'create' }, req.headers['x-cid']);

    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [id]);
    res.status(201).json(rowToCase(rows[0]));
  } catch (e) {
    console.error('[trade-cases POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/trade-cases/:id
router.put('/:id', async function (req, res) {
  try {
    const { rows: existing } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'پرونده یافت نشد' });
    const row = existing[0];
    if (!canAccessCase(req.user, row.assigned_to)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (row.is_finalized) return res.status(400).json({ error: 'پرونده نهایی شده' });

    const body = req.body || {};
    await query(
      `UPDATE trade_cases SET
         title=COALESCE($2, title),
         assigned_to=COALESCE($3, assigned_to),
         steps_data=COALESCE($4, steps_data),
         jalali_month=COALESCE($5, jalali_month),
         proforma_id=COALESCE($6, proforma_id),
         center_key=COALESCE($7, center_key),
         priority=COALESCE($8, priority),
         notes=COALESCE($9, notes),
         updated_at=NOW()
       WHERE id=$1`,
      [
        req.params.id,
        body.title != null ? String(body.title).trim() : null,
        body.assignedTo || body.assigned_to || null,
        body.stepsData != null || body.steps_data != null
          ? JSON.stringify(body.stepsData || body.steps_data) : null,
        body.jalaliMonth || body.jalali_month || null,
        body.proformaId != null ? body.proformaId : (body.proforma_id != null ? body.proforma_id : null),
        body.centerKey != null ? body.centerKey : (body.center_key != null ? body.center_key : null),
        body.priority || null,
        body.notes != null ? body.notes : null,
      ]
    );

    await logActivity(req.params.id, req.user.username, 'update', 'ویرایش پرونده');
    emitCaseEvent('trade-case-changed', { id: req.params.id, action: 'update' }, req.headers['x-cid']);

    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    res.json(rowToCase(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/trade-cases/:id/steps
router.post('/:id/steps', async function (req, res) {
  try {
    const { stepId, data, completed_at, completedAt } = req.body || {};
    if (!stepId) return res.status(400).json({ error: 'stepId الزامی است' });

    const { rows: existing } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'پرونده یافت نشد' });
    const row = existing[0];
    if (!canAccessCase(req.user, row.assigned_to)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (row.is_finalized) return res.status(400).json({ error: 'پرونده نهایی شده' });

    const stepsData = parseStepsData(row.steps_data);
    const stepPayload = {
      data: data || {},
      completed_at: completed_at || completedAt || null,
    };
    stepsData[stepId] = stepPayload;

    await query(
      'UPDATE trade_cases SET steps_data=$2, updated_at=NOW() WHERE id=$1',
      [req.params.id, JSON.stringify(stepsData)]
    );

    let kpiSync = null;
    if (stepPayload.completed_at && row.template_id) {
      const tr = await query('SELECT * FROM trade_process_templates WHERE id=$1', [row.template_id]);
      if (tr.rows.length) {
        kpiSync = await syncKpiFromCaseStep(row, tr.rows[0], stepId, stepPayload);
      }
    }

    await logActivity(req.params.id, req.user.username, 'step', 'مرحله: ' + stepId);
    emitCaseEvent('trade-case-changed', { id: req.params.id, action: 'step', stepId: stepId }, req.headers['x-cid']);

    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    res.json(Object.assign(rowToCase(rows[0]), { kpiSync: kpiSync }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/trade-cases/:id/finalize
router.post('/:id/finalize', async function (req, res) {
  try {
    const { rows: existing } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'پرونده یافت نشد' });
    const row = existing[0];
    if (!canAccessCase(req.user, row.assigned_to)) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }
    if (row.is_finalized) return res.status(400).json({ error: 'قبلاً نهایی شده' });

    await query(
      'UPDATE trade_cases SET is_finalized=TRUE, finalized_at=NOW(), status=$2, updated_at=NOW() WHERE id=$1',
      [req.params.id, 'finalized']
    );

    let kpiSynced = 0;
    if (row.template_id) {
      const tr = await query('SELECT * FROM trade_process_templates WHERE id=$1', [row.template_id]);
      if (tr.rows.length) {
        const results = await syncAllCompletedSteps(row, tr.rows[0]);
        kpiSynced = results.filter(function (r) { return r && r.synced; }).length;
      }
    }

    await logActivity(req.params.id, req.user.username, 'finalize', 'نهایی‌سازی پرونده');
    emitCaseEvent('trade-case-changed', { id: req.params.id, action: 'finalize' }, req.headers['x-cid']);

    const { rows } = await query('SELECT * FROM trade_cases WHERE id=$1', [req.params.id]);
    res.json(Object.assign(rowToCase(rows[0]), { kpiSynced: kpiSynced }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/trade-cases/:id — archive
router.delete('/:id', async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const { rowCount } = await query(
      "UPDATE trade_cases SET status='archived', updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'پرونده یافت نشد' });
    emitCaseEvent('trade-case-changed', { id: req.params.id, action: 'archive' }, req.headers['x-cid']);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

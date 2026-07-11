'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

function rowToDefinition(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    stages: r.stages || [],
    transitions: r.transitions || [],
    fields: r.fields || [],
    active: r.active !== false,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToInstance(r) {
  return {
    id: r.id,
    definitionId: r.definition_id,
    title: r.title,
    currentStage: r.current_stage,
    owner: r.owner,
    centerKey: r.center_key,
    centerName: r.center_name,
    priority: r.priority,
    dueDate: r.due_date,
    data: r.data || {},
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}

function isManager(user) {
  const role = user && user.role;
  return role === 'مدیر' || role === 'سوپر ادمین';
}

function stageIds(def) {
  return (def.stages || []).map(function (s) { return s.id; });
}

function canTransition(def, fromStage, toStage) {
  if (!fromStage || !toStage || fromStage === toStage) return false;
  const ids = stageIds(def);
  if (ids.indexOf(toStage) < 0) return false;
  const tr = def.transitions || [];
  if (!tr.length) return ids.indexOf(fromStage) >= 0;
  return tr.some(function (t) {
    return t.from === fromStage && t.to === toStage;
  });
}

function finalStageIds(def) {
  return (def.stages || []).filter(function (s) { return s.isFinal; }).map(function (s) { return s.id; });
}

// ── Definitions ─────────────────────────────────────────────────────────────

router.get('/definitions', requirePermission('workflows', 'view'), async function (req, res) {
  try {
    const r = await query(
      'SELECT * FROM workflow_definitions WHERE active = TRUE ORDER BY name ASC'
    );
    res.json({ definitions: r.rows.map(rowToDefinition) });
  } catch (e) {
    console.error('[workflows definitions GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/definitions/:id', requirePermission('workflows', 'view'), async function (req, res) {
  try {
    const r = await query('SELECT * FROM workflow_definitions WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'فرآیند یافت نشد' });
    res.json(rowToDefinition(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/definitions', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    if (!isManager(req.user)) return res.status(403).json({ error: 'فقط مدیر می‌تواند فرآیند تعریف کند' });
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'نام فرآیند الزامی است' });
    const stages = Array.isArray(b.stages) && b.stages.length ? b.stages : [
      { id: 'start', label: 'شروع', color: '#64748b', order: 0 },
      { id: 'doing', label: 'در حال انجام', color: '#6366f1', order: 1 },
      { id: 'done', label: 'پایان', color: '#22c55e', order: 2, isFinal: true },
    ];
    const id = b.id || ('wf_' + Date.now().toString(36));
    const r = await query(
      `INSERT INTO workflow_definitions (id, name, description, stages, transitions, fields, active, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,NOW()) RETURNING *`,
      [
        id,
        String(b.name).trim(),
        b.description || '',
        JSON.stringify(stages),
        JSON.stringify(b.transitions || []),
        JSON.stringify(b.fields || []),
        req.user.username,
      ]
    );
    res.status(201).json(rowToDefinition(r.rows[0]));
  } catch (e) {
    console.error('[workflows definitions POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/definitions/:id', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    if (!isManager(req.user)) return res.status(403).json({ error: 'فقط مدیر می‌تواند فرآیند ویرایش کند' });
    const b = req.body || {};
    const r = await query(
      `UPDATE workflow_definitions SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         stages = COALESCE($4, stages),
         transitions = COALESCE($5, transitions),
         fields = COALESCE($6, fields),
         active = COALESCE($7, active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.name ? String(b.name).trim() : null,
        b.description !== undefined ? b.description : null,
        b.stages ? JSON.stringify(b.stages) : null,
        b.transitions ? JSON.stringify(b.transitions) : null,
        b.fields ? JSON.stringify(b.fields) : null,
        b.active !== undefined ? !!b.active : null,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'فرآیند یافت نشد' });
    res.json(rowToDefinition(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/definitions/:id', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    if (!isManager(req.user)) return res.status(403).json({ error: 'فقط مدیر' });
    const r = await query(
      'UPDATE workflow_definitions SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'فرآیند یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Instances ───────────────────────────────────────────────────────────────

router.get('/instances', requirePermission('workflows', 'view'), async function (req, res) {
  try {
    const defId = req.query.definitionId || req.query.definition_id;
    const owner = req.query.owner;
    const centerKey = req.query.centerKey || req.query.center_key;
    const status = req.query.status || 'active';
    let sql = 'SELECT * FROM workflow_instances WHERE 1=1';
    const params = [];
    if (defId) { params.push(defId); sql += ' AND definition_id = $' + params.length; }
    if (owner) { params.push(owner); sql += ' AND owner = $' + params.length; }
    if (centerKey) { params.push(centerKey); sql += ' AND center_key = $' + params.length; }
    if (status) { params.push(status); sql += ' AND status = $' + params.length; }
    if (!isManager(req.user) && !owner) {
      params.push(req.user.username);
      sql += ' AND owner = $' + params.length;
    }
    sql += ' ORDER BY updated_at DESC LIMIT 500';
    const r = await query(sql, params);
    res.json({ instances: r.rows.map(rowToInstance) });
  } catch (e) {
    console.error('[workflows instances GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/instances/:id', requirePermission('workflows', 'view'), async function (req, res) {
  try {
    const r = await query('SELECT * FROM workflow_instances WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'مورد یافت نشد' });
    const inst = rowToInstance(r.rows[0]);
    if (!isManager(req.user) && inst.owner !== req.user.username && inst.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
    const hist = await query(
      'SELECT * FROM workflow_transitions WHERE instance_id = $1 ORDER BY at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({ instance: inst, history: hist.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/instances', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    const b = req.body || {};
    if (!b.definitionId) return res.status(400).json({ error: 'definitionId الزامی است' });
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'عنوان الزامی است' });

    const defR = await query('SELECT * FROM workflow_definitions WHERE id = $1 AND active = TRUE', [b.definitionId]);
    if (!defR.rows.length) return res.status(404).json({ error: 'فرآیند یافت نشد' });
    const def = rowToDefinition(defR.rows[0]);
    const stages = (def.stages || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    const firstStage = b.currentStage || (stages[0] && stages[0].id) || 'start';
    const id = b.id || ('wfi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));

    const r = await query(
      `INSERT INTO workflow_instances
         (id, definition_id, title, current_stage, owner, center_key, center_name, priority, due_date, data, status, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,NOW()) RETURNING *`,
      [
        id,
        b.definitionId,
        String(b.title).trim(),
        firstStage,
        b.owner || req.user.username,
        b.centerKey || '',
        b.centerName || '',
        b.priority || 2,
        b.dueDate || '',
        JSON.stringify(b.data || {}),
        req.user.username,
      ]
    );

    await query(
      `INSERT INTO workflow_transitions (instance_id, from_stage, to_stage, action, note, by_user, meta)
       VALUES ($1,NULL,$2,'create',$3,$4,$5)`,
      [id, firstStage, b.note || 'ایجاد مورد', req.user.username, JSON.stringify({ definitionId: b.definitionId })]
    );

    res.status(201).json(rowToInstance(r.rows[0]));
  } catch (e) {
    console.error('[workflows instances POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.patch('/instances/:id', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    const cur = await query('SELECT * FROM workflow_instances WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'مورد یافت نشد' });
    const inst = cur.rows[0];
    if (!isManager(req.user) && inst.owner !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
    const b = req.body || {};
    const r = await query(
      `UPDATE workflow_instances SET
         title = COALESCE($2, title),
         owner = COALESCE($3, owner),
         center_key = COALESCE($4, center_key),
         center_name = COALESCE($5, center_name),
         priority = COALESCE($6, priority),
         due_date = COALESCE($7, due_date),
         data = COALESCE($8, data),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.title ? String(b.title).trim() : null,
        b.owner || null,
        b.centerKey !== undefined ? b.centerKey : null,
        b.centerName !== undefined ? b.centerName : null,
        b.priority !== undefined ? b.priority : null,
        b.dueDate !== undefined ? b.dueDate : null,
        b.data ? JSON.stringify(b.data) : null,
      ]
    );
    res.json(rowToInstance(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/instances/:id/action', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    const b = req.body || {};
    const toStage = b.toStage || b.to_stage;
    if (!toStage) return res.status(400).json({ error: 'toStage الزامی است' });

    const cur = await query('SELECT * FROM workflow_instances WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'مورد یافت نشد' });
    const inst = cur.rows[0];
    if (inst.status !== 'active') return res.status(400).json({ error: 'این مورد بسته شده است' });
    if (!isManager(req.user) && inst.owner !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }

    const defR = await query('SELECT * FROM workflow_definitions WHERE id = $1', [inst.definition_id]);
    if (!defR.rows.length) return res.status(404).json({ error: 'فرآیند یافت نشد' });
    const def = rowToDefinition(defR.rows[0]);

    if (!canTransition(def, inst.current_stage, toStage)) {
      return res.status(400).json({ error: 'انتقال از «' + inst.current_stage + '» به «' + toStage + '» مجاز نیست' });
    }

    const finals = finalStageIds(def);
    const isFinal = finals.indexOf(toStage) >= 0 || b.complete === true;
    const newStatus = isFinal ? 'completed' : 'active';

    const r = await query(
      `UPDATE workflow_instances SET
         current_stage = $2,
         status = $3,
         updated_at = NOW(),
         completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $1 RETURNING *`,
      [req.params.id, toStage, newStatus]
    );

    await query(
      `INSERT INTO workflow_transitions (instance_id, from_stage, to_stage, action, note, by_user)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, inst.current_stage, toStage, b.action || 'advance', b.note || '', req.user.username]
    );

    res.json(rowToInstance(r.rows[0]));
  } catch (e) {
    console.error('[workflows action]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/instances/:id/cancel', requirePermission('workflows', 'edit'), async function (req, res) {
  try {
    const cur = await query('SELECT * FROM workflow_instances WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'مورد یافت نشد' });
    const inst = cur.rows[0];
    if (!isManager(req.user) && inst.owner !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    }
    const b = req.body || {};
    const r = await query(
      `UPDATE workflow_instances SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await query(
      `INSERT INTO workflow_transitions (instance_id, from_stage, to_stage, action, note, by_user)
       VALUES ($1,$2,$2,'cancel',$3,$4)`,
      [req.params.id, inst.current_stage, b.note || 'لغو شد', req.user.username]
    );
    res.json(rowToInstance(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

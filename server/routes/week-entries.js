'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');
const { isManagerRole } = require('../lib/roles');
const { loadCenterAccessContext, canAccessCenter } = require('../lib/center-access');
const { resolveCenterOwner } = require('../lib/center-ownership');

const router = express.Router();

let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch (e) {}

function notifyWeekChange(req, data) {
  try {
    if (_broadcast) {
      _broadcast('week-entry-changed', Object.assign({ at: Date.now(), by: req.user.username }, data || {}), req.headers['x-cid'] || '');
    }
  } catch (e) {}
}

async function resolveEntryIds(ids, keys) {
  const idList = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
  if (Array.isArray(keys) && keys.length) {
    const kr = await query('SELECT id FROM week_entries WHERE key = ANY($1::text[])', [keys]);
    kr.rows.forEach(function (r) {
      if (idList.indexOf(String(r.id)) < 0) idList.push(String(r.id));
    });
  }
  return idList;
}

async function assertEntryIdsAllowed(req, idList) {
  if (isManagerRole(req.user.role)) return idList;
  const rows = await query(
    'SELECT id, rec_key, added_by FROM week_entries WHERE id = ANY($1::text[])',
    [idList]
  );
  const context = await loadCenterAccessContext();
  const allowed = rows.rows.filter(function (row) {
    return row.added_by === req.user.username || canAccessCenter(req.user, row.rec_key, context);
  }).map(function (row) { return String(row.id); });
  if (allowed.length !== idList.length) {
    const err = new Error('دسترسی به بعضی برنامه‌ها مجاز نیست');
    err.status = 403;
    throw err;
  }
  return allowed;
}

/** یک مرکز فقط در یک هفته فعال — بقیه ردیف‌های همان rec_key حذف می‌شوند */
async function purgeOtherActiveForRecKey(recKey, keepId) {
  if (!recKey || !keepId) return 0;
  const r = await query(
    `DELETE FROM week_entries
     WHERE rec_key = $1 AND done = false AND id <> $2
     RETURNING id`,
    [recKey, String(keepId)]
  );
  return r.rows.length;
}

// ── Helper: map DB row → camelCase object ──────────────────────────────────
function rowToObj(r) {
  const v = (r.value && typeof r.value === 'object') ? r.value : {};
  return {
    id:            r.id,
    weekId:        r.week_id,
    recKey:        r.rec_key,
    rtype:         r.rtype,
    rid:           r.rid,
    scheduledDate: r.scheduled_date,
    scheduledTime: r.scheduled_time || null,
    actionType:    r.action_type,
    done:          r.done,
    doneDate:      r.done_date,
    addedBy:       r.added_by,
    centerName:    r.center_name,
    weekTagId:     r.week_tag_id,
    assignmentSource: r.assignment_source || (v.assignmentSource) || 'manual',
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
    doneResult:    v.doneResult || null,
    doneNote:      v.doneNote || null,
    doneAmount:    v.doneAmount != null ? v.doneAmount : null,
  };
}

// ── GET /api/week-entries ──────────────────────────────────────────────────
// Query params:
//   ?week_id=   week start (Jalali)
//   ?week_end=  week end — also include rows whose scheduled_date falls in [week_id, week_end]
//               even if week_id column is stale (prevents "vanishing" day cards)
//   ?owner=     center owner (NOT added_by)
//   ?added_by=  creator username
//   ?done=false|true
router.get('/', requireAuth, async function (req, res) {
  try {
    const conditions = [];
    const params = [];
    const weekId = req.query.week_id || null;
    const weekEnd = req.query.week_end || null;

    if (weekId && weekEnd) {
      params.push(weekId, weekEnd);
      conditions.push(
        `(week_id = $1 OR (scheduled_date IS NOT NULL AND scheduled_date <> '' AND scheduled_date >= $1 AND scheduled_date <= $2))`
      );
    } else if (weekId) {
      params.push(weekId);
      conditions.push(`week_id = $${params.length}`);
    }
    if (req.query.added_by) {
      params.push(req.query.added_by);
      conditions.push(`added_by = $${params.length}`);
    }
    if (req.query.done !== undefined) {
      params.push(req.query.done === 'true');
      conditions.push(`done = $${params.length}`);
    }
    if (req.query.rec_key) {
      params.push(req.query.rec_key);
      conditions.push(`rec_key = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(
      `SELECT * FROM week_entries ${where} ORDER BY scheduled_date ASC, created_at ASC`,
      params
    );
    let rows = result.rows;
    const context = (!isManagerRole(req.user.role) || req.query.owner)
      ? await loadCenterAccessContext()
      : null;

    if (!isManagerRole(req.user.role)) {
      rows = rows.filter(function (row) {
        return row.added_by === req.user.username || canAccessCenter(req.user, row.rec_key, context);
      });
    }

    // owner = مسئول مرکز (نه added_by) — باگ قبلی باعث می‌شد مراکز تخصیص‌داده‌شده مدیر برای کارشناس ناپدید شوند
    if (req.query.owner) {
      const want = String(req.query.owner);
      const edits = context ? context.edits : (await loadCenterAccessContext()).edits;
      const ownerMaps = context ? context.ownerMaps : (await loadCenterAccessContext()).ownerMaps;
      rows = rows.filter(function (row) {
        const owner = resolveCenterOwner(row.rec_key, edits, ownerMaps);
        if (owner) return owner === want;
        return row.added_by === want;
      });
    }

    res.json(rows.map(rowToObj));
  } catch (e) {
    console.error('[week-entries GET /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries ─────────────────────────────────────────────────
router.post('/', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { id, weekId, recKey, rtype, rid, scheduledDate, scheduledTime, actionType, addedBy, centerName, weekTagId, assignmentSource } = req.body;
    if (!id || !weekId || !recKey || !rtype || !rid) {
      return res.status(400).json({ error: 'فیلدهای id، weekId، recKey، rtype و rid الزامی هستند' });
    }
    const cleanRecKey = (recKey && recKey !== rtype && recKey.includes('_')) ? recKey : `${rtype}_${rid}`;
    const isMgr = isManagerRole(req.user.role);
    if (!isMgr) {
      const context = await loadCenterAccessContext();
      if (!canAccessCenter(req.user, cleanRecKey, context)) {
        return res.status(403).json({ error: 'دسترسی به این مرکز مجاز نیست' });
      }
    }

    // Precedence: manager from تخصیص → manager_fixed; expert self-fill → expert_self
    let source = assignmentSource || null;
    if (!source) {
      source = isMgr ? 'manager_fixed' : 'expert_self';
    }
    if (!isMgr && source === 'manager_fixed') source = 'expert_self';

    const ownerForQuota = addedBy || req.user.username;
    if (source === 'expert_self') {
      try {
        const et = require('../lib/expert-targets');
        const guard = await et.assertExpertSelfAllowed(ownerForQuota, weekId, scheduledDate || null);
        if (!guard.ok) {
          return res.status(403).json({ error: guard.error, progress: guard.progress });
        }
      } catch (ge) {
        console.warn('[week-entries] quota guard:', ge.message);
      }
    }

    const dbKey = `${weekId}:::${rtype}:::${rid}`;
    const dbValue = {
      id,
      weekId,
      recKey: cleanRecKey,
      rtype,
      rid,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      actionType: actionType || 'call',
      addedBy: ownerForQuota,
      centerName: centerName || null,
      weekTagId: weekTagId || null,
      assignmentSource: source,
      done: false,
      doneDate: null
    };
    // Ensure columns exist (idempotent alter is in migration; fallback if missing)
    const result = await query(
      `INSERT INTO week_entries (key, value, id, week_id, rec_key, rtype, rid, scheduled_date, action_type, added_by, center_name, week_tag_id, assignment_source, scheduled_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (key) DO UPDATE SET
         value          = week_entries.value || jsonb_build_object(
                            'scheduledDate', EXCLUDED.scheduled_date,
                            'actionType',    EXCLUDED.action_type,
                            'centerName',    COALESCE(EXCLUDED.center_name, week_entries.center_name),
                            'assignmentSource', EXCLUDED.assignment_source
                          ),
         scheduled_date = EXCLUDED.scheduled_date,
         action_type    = EXCLUDED.action_type,
         center_name    = COALESCE(EXCLUDED.center_name, week_entries.center_name),
         assignment_source = COALESCE(EXCLUDED.assignment_source, week_entries.assignment_source),
         scheduled_time = COALESCE(EXCLUDED.scheduled_time, week_entries.scheduled_time),
         updated_at     = now()
       RETURNING *`,
      [
        dbKey,
        JSON.stringify(dbValue),
        id,
        weekId,
        cleanRecKey,
        rtype,
        rid,
        scheduledDate || null,
        actionType || 'call',
        ownerForQuota,
        centerName || null,
        weekTagId || null,
        source,
        scheduledTime || null,
      ]
    );
    const saved = result.rows[0];
    const purged = await purgeOtherActiveForRecKey(cleanRecKey, saved.id);
    notifyWeekChange(req, { action: 'create', id: saved.id, weekId, purged, assignmentSource: source });
    res.status(201).json(rowToObj(saved));
    try { require('../lib/inbox-hooks').onWeekChange(saved.id); } catch (_) {}
  } catch (e) {
    console.error('[week-entries POST /]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── PUT /api/week-entries/:id ──────────────────────────────────────────────
router.put('/:id', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { weekId, scheduledDate, done, doneDate, actionType, weekTagId, centerName,
            doneResult, doneNote, doneAmount } = req.body;
    const rowRes = await query('SELECT key, value, rec_key, added_by FROM week_entries WHERE id = $1', [req.params.id]);
    if (!rowRes.rows.length) {
      return res.status(404).json({ error: 'ورودی برنامه هفته یافت نشد' });
    }
    if (!isManagerRole(req.user.role) && rowRes.rows[0].added_by !== req.user.username) {
      const context = await loadCenterAccessContext();
      if (!canAccessCenter(req.user, rowRes.rows[0].rec_key, context)) {
        return res.status(403).json({ error: 'دسترسی به این برنامه مجاز نیست' });
      }
    }
    const currentVal = rowRes.rows[0].value || {};
    const updatedVal = {
      ...currentVal,
      ...(weekId !== undefined ? { weekId } : {}),
      ...(scheduledDate !== undefined ? { scheduledDate } : {}),
      ...(done !== undefined ? { done } : {}),
      ...(doneDate !== undefined ? { doneDate } : {}),
      ...(actionType !== undefined ? { actionType } : {}),
      ...(weekTagId !== undefined ? { weekTagId } : {}),
      ...(centerName !== undefined ? { centerName } : {}),
      ...(doneResult !== undefined ? { doneResult } : {}),
      ...(doneNote !== undefined ? { doneNote } : {}),
      ...(doneAmount !== undefined ? { doneAmount } : {}),
    };
    const result = await query(
      `UPDATE week_entries
       SET week_id        = CASE WHEN $15::boolean THEN $1 ELSE week_id END,
           key            = CASE WHEN $15::boolean THEN $1 || ':::' || rtype || ':::' || rid ELSE key END,
           scheduled_date = CASE WHEN $9::boolean THEN $2 ELSE scheduled_date END,
           done           = CASE WHEN $10::boolean THEN $3 ELSE done END,
           done_date      = CASE WHEN $11::boolean THEN $4 ELSE done_date END,
           action_type    = CASE WHEN $12::boolean THEN $5 ELSE action_type END,
           week_tag_id    = CASE WHEN $13::boolean THEN $6 ELSE week_tag_id END,
           center_name    = CASE WHEN $14::boolean THEN $7 ELSE center_name END,
           value          = $8,
           updated_at     = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        weekId !== undefined ? weekId : null,
        scheduledDate !== undefined ? scheduledDate : null,
        done !== undefined ? done : null,
        doneDate !== undefined ? doneDate : null,
        actionType || null,
        weekTagId !== undefined ? weekTagId : null,
        centerName !== undefined ? centerName : null,
        JSON.stringify(updatedVal),
        scheduledDate !== undefined,
        done !== undefined,
        doneDate !== undefined,
        actionType !== undefined,
        weekTagId !== undefined,
        centerName !== undefined,
        weekId !== undefined,
        req.params.id,
      ]
    );
    const saved = result.rows[0];
    if (weekId !== undefined) {
      await purgeOtherActiveForRecKey(saved.rec_key, saved.id);
    }
    notifyWeekChange(req, { action: 'update', id: req.params.id, weekId: saved.week_id });
    res.json(rowToObj(saved));
    try { require('../lib/inbox-hooks').onWeekChange(req.params.id); } catch (_) {}
  } catch (e) {
    console.error('[week-entries PUT /:id]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// ── DELETE /api/week-entries/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    await assertEntryIdsAllowed(req, [String(req.params.id)]);
    const result = await query('DELETE FROM week_entries WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ورودی برنامه هفته یافت نشد' });
    }
    notifyWeekChange(req, { action: 'delete', id: req.params.id });
    res.json({ ok: true });
    try { require('../lib/inbox-hooks').onWeekDelete(req.params.id); } catch (_) {}
  } catch (e) {
    console.error('[week-entries DELETE /:id]', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/bulk-update ───────────────────────────────────────
router.post('/bulk-update', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { ids, keys, done, doneDate, weekId, scheduledDate, actionType } = req.body || {};
    const idList = await resolveEntryIds(ids, keys);
    if (!idList.length) {
      return res.status(400).json({ error: 'شناسه یا کلید ورودی الزامی است' });
    }
    await assertEntryIdsAllowed(req, idList);
    const hasDone = done !== undefined;
    const hasDoneDate = doneDate !== undefined;
    const hasWeekId = weekId !== undefined;
    const hasScheduledDate = scheduledDate !== undefined;
    const hasActionType = actionType !== undefined;
    const idStart = 11;
    const placeholders = idList.map(function (_, i) { return '$' + (idStart + i); }).join(',');
    const result = await query(
      `UPDATE week_entries
       SET done           = CASE WHEN $1::boolean THEN $2 ELSE done END,
           done_date      = CASE WHEN $3::boolean THEN $4 ELSE done_date END,
           week_id        = CASE WHEN $5::boolean THEN $6 ELSE week_id END,
           scheduled_date = CASE WHEN $7::boolean THEN $8 ELSE scheduled_date END,
           action_type    = CASE WHEN $9::boolean THEN $10 ELSE action_type END,
           updated_at     = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [
        hasDone, hasDone ? !!done : null,
        hasDoneDate, hasDoneDate ? doneDate : null,
        hasWeekId, hasWeekId ? weekId : null,
        hasScheduledDate, hasScheduledDate ? scheduledDate : null,
        hasActionType, hasActionType ? actionType : null,
        ...idList,
      ]
    );
    notifyWeekChange(req, { action: 'bulk-update', count: result.rows.length, weekId: weekId || null });
    res.json({ updated: result.rows.length, rows: result.rows.map(rowToObj) });
  } catch (e) {
    console.error('[week-entries POST /bulk-update]', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/bulk-delete ────────────────────────────────────
router.post('/bulk-delete', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { ids, keys } = req.body || {};
    const idList = await resolveEntryIds(ids, keys);
    if (!idList.length) {
      return res.status(400).json({ error: 'شناسه یا کلید ورودی الزامی است' });
    }
    await assertEntryIdsAllowed(req, idList);
    const placeholders = idList.map(function (_, i) { return '$' + (i + 1); }).join(',');
    const result = await query(
      `DELETE FROM week_entries WHERE id IN (${placeholders}) RETURNING id`,
      idList
    );
    notifyWeekChange(req, { action: 'bulk-delete', count: result.rows.length });
    res.json({ deleted: result.rows.length });
  } catch (e) {
    console.error('[week-entries POST /bulk-delete]', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/bulk-move ──────────────────────────────────────
router.post('/bulk-move', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { ids, keys, weekId, scheduledDate } = req.body || {};
    const idList = await resolveEntryIds(ids, keys);
    if (!idList.length || !weekId) {
      return res.status(400).json({ error: 'شناسه/کلید و weekId الزامی است' });
    }
    await assertEntryIdsAllowed(req, idList);
    const hasScheduledDate = scheduledDate !== undefined;
    const placeholders = idList.map(function (_, i) { return '$' + (i + 4); }).join(',');
    const result = await query(
      `UPDATE week_entries
       SET week_id        = $1,
           key            = $1 || ':::' || rtype || ':::' || rid,
           value          = jsonb_set(COALESCE(value, '{}'::jsonb), '{weekId}', to_jsonb($1::text), true),
           scheduled_date = CASE WHEN $2::boolean THEN $3 ELSE scheduled_date END,
           updated_at     = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [weekId, hasScheduledDate, scheduledDate !== undefined ? scheduledDate : null, ...idList]
    );
    for (let i = 0; i < result.rows.length; i++) {
      await purgeOtherActiveForRecKey(result.rows[i].rec_key, result.rows[i].id);
    }
    notifyWeekChange(req, { action: 'bulk-move', count: result.rows.length, weekId });
    res.json(result.rows.map(rowToObj));
  } catch (e) {
    console.error('[week-entries POST /bulk-move]', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'خطای داخلی سرور' });
  }
});

// ── POST /api/week-entries/purge-center ───────────────────────────────────
// حذف همه برنامه‌های فعال یک مرکز به جز هفته/ردیف نگه‌داشته‌شده
router.post('/purge-center', requireAuth, requirePermission('weekplan', 'edit'), async function (req, res) {
  try {
    const { recKey, keepWeekId, keepId } = req.body || {};
    if (!recKey) return res.status(400).json({ error: 'recKey الزامی است' });

    if (!isManagerRole(req.user.role)) {
      const context = await loadCenterAccessContext();
      if (!canAccessCenter(req.user, recKey, context)) {
        return res.status(403).json({ error: 'دسترسی به این مرکز مجاز نیست' });
      }
    }

    let sql = 'DELETE FROM week_entries WHERE rec_key = $1 AND done = false';
    const params = [recKey];
    if (keepId) {
      params.push(String(keepId));
      sql += ' AND id <> $' + params.length;
    } else if (keepWeekId) {
      params.push(keepWeekId);
      sql += ' AND week_id <> $' + params.length;
    }
    const result = await query(sql + ' RETURNING id', params);
    notifyWeekChange(req, { action: 'purge', recKey, count: result.rows.length });
    res.json({ deleted: result.rows.length });
  } catch (e) {
    console.error('[week-entries POST /purge-center]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

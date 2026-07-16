'use strict';

/**
 * Expert Targets (Quota) — progress is read-time COUNT on week_entries.
 * Never stores fake week_entry rows for quotas.
 */

const { query } = require('../db');
const { todayJalaliStr, p2, g2j, j2g, jAdd } = require('./jalali-mini');

function makeId() {
  return 'et_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function rowToObj(r) {
  if (!r) return null;
  return {
    id: r.id,
    expertId: r.expert_id,
    periodType: r.period_type,
    periodKey: r.period_key,
    weekIds: Array.isArray(r.week_ids) ? r.week_ids : (r.week_ids || []),
    parentId: r.parent_id || null,
    targetCount: r.target_count,
    minPriorityCount: r.min_priority_count || 0,
    filters: r.filters || {},
    countMode: r.count_mode || 'done',
    dailyWipCap: r.daily_wip_cap,
    status: r.status,
    note: r.note || '',
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by || null,
  };
}

async function writeAudit(targetId, byUser, action, beforeVal, afterVal) {
  await query(
    `INSERT INTO expert_target_audit (target_id, by_user, action, before_val, after_val)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      targetId,
      byUser,
      action,
      beforeVal ? JSON.stringify(beforeVal) : null,
      afterVal ? JSON.stringify(afterVal) : null,
    ]
  ).catch(function (e) {
    console.warn('[expert-targets] audit:', e.message);
  });
}

/** Jalali weekday: 0=Sat … 6=Fri (matches client jDow) */
function jDow(jy, jm, jd) {
  const g = j2g(jy, jm, jd);
  const d = new Date(g[0], g[1] - 1, g[2]);
  return (d.getDay() + 1) % 7; // JS Sun=0 → Sat=0
}

/** Weeks overlapping a Jalali month — weekId = Saturday start YYYY/MM/DD */
function weeksOverlappingMonth(jy, jm) {
  const weeks = [];
  // Start from first Saturday on/before 1st of month
  let cur = jAdd(jy, jm, 1, -jDow(jy, jm, 1));
  cur = [cur[0], cur[1], cur[2]];
  for (let i = 0; i < 8; i++) {
    const end = jAdd(cur[0], cur[1], cur[2], 6);
    const endA = [end[0], end[1], end[2]];
    // intersects month?
    const startIn = cur[0] === jy && cur[1] === jm;
    const endIn = endA[0] === jy && endA[1] === jm;
    const spans = (cur[0] < jy || (cur[0] === jy && cur[1] < jm)) &&
      (endA[0] > jy || (endA[0] === jy && endA[1] > jm));
    if (startIn || endIn || spans) {
      const id = cur[0] + '/' + p2(cur[1]) + '/' + p2(cur[2]);
      weeks.push(id);
    }
    if (cur[0] > jy || (cur[0] === jy && cur[1] > jm && endA[1] > jm)) break;
    const next = jAdd(cur[0], cur[1], cur[2], 7);
    cur = [next[0], next[1], next[2]];
  }
  return weeks;
}

function parseMonthKey(periodKey) {
  const p = String(periodKey || '').split('/');
  if (p.length < 2) return null;
  return { jy: parseInt(p[0], 10), jm: parseInt(p[1], 10) };
}

function isPriorityCenter(edit, filters, today) {
  const pool = (filters && filters.poolPriority) || {};
  const potMax = pool.potentialMax != null ? Number(pool.potentialMax) : 2;
  const wantOverdue = pool.overdue !== false;
  const pot = parseInt(edit.potential, 10);
  const fd = edit.followupDate || '';
  const overdue = wantOverdue && fd && fd < today;
  const hot = !isNaN(pot) && pot > 0 && pot <= potMax;
  return !!(overdue || hot);
}

function matchesFilters(edit, entry, filters, today) {
  const f = filters || {};
  const status = edit.status || '';
  const excludeStatuses = f.excludeStatuses || ['غیرفعال', 'قرارداد بسته شد', 'عدم نیاز فاکتور کنسل شد'];
  if (excludeStatuses.indexOf(status) >= 0) return false;

  if (f.actionTypes && f.actionTypes.length) {
    if (f.actionTypes.indexOf(entry.action_type || 'call') < 0) return false;
  }
  if (f.provIds && f.provIds.length) {
    const prov = edit.provId || (entry.rid && String(entry.rid).split('||')[0]) || '';
    // center keys: center_c_x or pc_p14||n — best-effort
    let inferred = edit.provinceId || edit.prov || '';
    if (!inferred && entry.rtype === 'pc' && entry.rid) {
      inferred = String(entry.rid).split('||')[0];
    }
    if (!inferred && entry.rtype === 'center') inferred = 'tehran';
    if (f.provIds.indexOf(inferred) < 0) return false;
  }
  if (f.potentialMax != null) {
    const pot = parseInt(edit.potential, 10) || 4;
    if (pot > Number(f.potentialMax)) return false;
  }
  if (f.leadIn && f.leadIn.length) {
    const lead = edit.lead || '';
    if (f.leadIn.indexOf(lead) < 0) return false;
  }
  if (f.includeOverdue === true) {
    const fd = edit.followupDate || '';
    if (!(fd && fd < today)) {
      // includeOverdue as hard filter only when set with requireOverdue
      if (f.requireOverdue) return false;
    }
  }
  // Hard gates reserved — centers flagged regulatory stay out of free pool
  const gateKinds = f.excludeGateKinds || [];
  if (gateKinds.length) {
    const gk = edit.gateKind || edit.regulatoryGate || '';
    if (gk && gateKinds.indexOf(gk) >= 0) return false;
    if (edit.regulatoryHold === true) return false;
  }
  return true;
}

async function loadEditsForKeys(recKeys) {
  if (!recKeys.length) return {};
  const r = await query(
    `SELECT center_key, data FROM center_edits WHERE center_key = ANY($1::text[])`,
    [recKeys]
  );
  const map = {};
  r.rows.forEach(function (row) {
    map[row.center_key] = row.data || {};
    // also alias without type prefix variants
    const k = row.center_key;
    if (k.indexOf('center_') === 0) map[k.slice(7)] = row.data;
    if (k.indexOf('pc_') === 0) map[k] = row.data;
  });
  return map;
}

function resolveEdit(edits, recKey, rtype, rid) {
  if (edits[recKey]) return edits[recKey];
  const alt = (rtype || '') + '_' + (rid || '');
  if (edits[alt]) return edits[alt];
  if (rtype === 'center' && edits['center_' + rid]) return edits['center_' + rid];
  if (edits[rid]) return edits[rid];
  return {};
}

/**
 * Compute progress for one target (read-time).
 */
async function computeProgress(target) {
  const today = todayJalaliStr();
  const weekIds = target.weekIds && target.weekIds.length
    ? target.weekIds
    : (target.periodType === 'week' ? [target.periodKey] : []);

  if (!weekIds.length) {
    return emptyProgress(target);
  }

  const entriesR = await query(
    `SELECT id, week_id, rec_key, rtype, rid, scheduled_date, action_type,
            added_by, done, done_date, center_name,
            COALESCE(assignment_source, 'manual') AS assignment_source
     FROM week_entries
     WHERE week_id = ANY($1::text[])
       AND added_by = $2`,
    [weekIds, target.expertId]
  );

  const recKeys = [];
  entriesR.rows.forEach(function (e) {
    if (e.rec_key) recKeys.push(e.rec_key);
  });
  const edits = await loadEditsForKeys(recKeys);

  let committedOpen = 0;
  let committedDone = 0;
  let doneTotal = 0;
  let donePriority = 0;
  let scheduledOpen = 0;
  const doneList = [];
  const remainingHint = [];

  entriesR.rows.forEach(function (e) {
    const edit = resolveEdit(edits, e.rec_key, e.rtype, e.rid);
    if (!matchesFilters(edit, e, target.filters, today)) return;

    const src = e.assignment_source || 'manual';
    const isFixed = src === 'manager_fixed';
    const priority = isPriorityCenter(edit, target.filters, today);

    if (e.done) {
      doneTotal++;
      if (priority) donePriority++;
      if (isFixed) committedDone++;
      doneList.push({
        id: e.id,
        recKey: e.rec_key,
        centerName: e.center_name,
        doneDate: e.done_date,
        priority: priority,
        source: src,
      });
    } else {
      scheduledOpen++;
      if (isFixed) committedOpen++;
      remainingHint.push({
        id: e.id,
        recKey: e.rec_key,
        centerName: e.center_name,
        scheduledDate: e.scheduled_date,
        priority: priority,
        source: src,
      });
    }
  });

  const targetCount = target.targetCount;
  const minPriority = target.minPriorityCount || 0;
  const committedTotal = committedOpen + committedDone;
  const freeSlots = Math.max(0, targetCount - committedTotal);
  const remainingTotal = Math.max(0, targetCount - doneTotal);
  const remainingPriority = Math.max(0, minPriority - donePriority);
  const progressPct = targetCount > 0 ? doneTotal / targetCount : 0;
  const priorityOk = donePriority >= minPriority;
  const quotaMet = doneTotal >= targetCount && priorityOk;

  let color = 'yellow';
  if (quotaMet) color = 'green';
  else if (remainingPriority > 0 && progressPct < 0.5) color = 'red';
  else if (progressPct < 0.35) color = 'red';
  else if (progressPct >= 0.5) color = 'yellow';

  return {
    targetId: target.id,
    expertId: target.expertId,
    periodType: target.periodType,
    periodKey: target.periodKey,
    weekIds: weekIds,
    targetCount: targetCount,
    minPriorityCount: minPriority,
    doneTotal: doneTotal,
    donePriority: donePriority,
    committedOpen: committedOpen,
    committedDone: committedDone,
    committedTotal: committedTotal,
    freeSlots: freeSlots,
    scheduledOpen: scheduledOpen,
    remainingTotal: remainingTotal,
    remainingPriority: remainingPriority,
    progressPct: Math.round(progressPct * 1000) / 1000,
    priorityOk: priorityOk,
    quotaMet: quotaMet,
    color: color,
    dailyWipCap: target.dailyWipCap,
    doneList: doneList.slice(0, 50),
    openList: remainingHint.slice(0, 50),
  };
}

function emptyProgress(target) {
  return {
    targetId: target.id,
    expertId: target.expertId,
    periodType: target.periodType,
    periodKey: target.periodKey,
    weekIds: target.weekIds || [],
    targetCount: target.targetCount,
    minPriorityCount: target.minPriorityCount || 0,
    doneTotal: 0,
    donePriority: 0,
    committedOpen: 0,
    committedDone: 0,
    committedTotal: 0,
    freeSlots: target.targetCount,
    scheduledOpen: 0,
    remainingTotal: target.targetCount,
    remainingPriority: target.minPriorityCount || 0,
    progressPct: 0,
    priorityOk: (target.minPriorityCount || 0) === 0,
    quotaMet: false,
    color: 'red',
    dailyWipCap: target.dailyWipCap,
    doneList: [],
    openList: [],
  };
}

async function getActiveWeekTarget(expertId, weekId) {
  const r = await query(
    `SELECT * FROM expert_targets
     WHERE expert_id = $1 AND status = 'active' AND period_type = 'week'
       AND (period_key = $2 OR week_ids @> $3::jsonb)
     ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
     LIMIT 1`,
    [expertId, weekId, JSON.stringify([weekId])]
  );
  return r.rows[0] ? rowToObj(r.rows[0]) : null;
}

async function countScheduledOnDay(expertId, jalaliDate) {
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM week_entries
     WHERE added_by = $1 AND scheduled_date = $2 AND done = FALSE`,
    [expertId, jalaliDate]
  );
  return r.rows[0] ? r.rows[0].c : 0;
}

/**
 * Guard for expert_self creates. Returns { ok, error?, progress? }.
 */
async function assertExpertSelfAllowed(expertId, weekId, scheduledDate) {
  const target = await getActiveWeekTarget(expertId, weekId);
  if (!target) return { ok: true, progress: null }; // no quota → unrestricted

  const progress = await computeProgress(target);
  if (progress.freeSlots <= 0) {
    return {
      ok: false,
      error: 'سقف هدف هفتگی پر است (تعهد ثابت مدیر + هدف). فضای آزاد: ۰',
      progress: progress,
    };
  }
  if (scheduledDate && target.dailyWipCap != null) {
    const n = await countScheduledOnDay(expertId, scheduledDate);
    if (n >= target.dailyWipCap) {
      return {
        ok: false,
        error: 'سقف WIP روزانه (' + target.dailyWipCap + ') برای ' + scheduledDate + ' پر است',
        progress: progress,
      };
    }
  }
  return { ok: true, progress: progress };
}

async function createTarget(body, byUser) {
  const expertId = body.expertId;
  const periodType = body.periodType || 'week';
  const periodKey = body.periodKey;
  if (!expertId || !periodKey) {
    const err = new Error('expertId و periodKey الزامی است');
    err.status = 400;
    throw err;
  }
  const targetCount = parseInt(body.targetCount, 10);
  if (!targetCount || targetCount < 1) {
    const err = new Error('targetCount باید عدد مثبت باشد');
    err.status = 400;
    throw err;
  }
  const minPriority = Math.max(0, parseInt(body.minPriorityCount, 10) || 0);
  if (minPriority > targetCount) {
    const err = new Error('minPriorityCount نمی‌تواند از targetCount بیشتر باشد');
    err.status = 400;
    throw err;
  }

  const filters = body.filters || {};
  if (!filters.poolPriority) {
    filters.poolPriority = { overdue: true, potentialMax: 2 };
  }
  const dailyWipCap = body.dailyWipCap != null ? parseInt(body.dailyWipCap, 10) : 5;
  const status = body.status === 'draft' ? 'draft' : 'active';
  const note = body.note || '';

  if (periodType === 'month') {
    return createMonthWithChildren({
      expertId, periodKey, targetCount, minPriority, filters, dailyWipCap, status, note, byUser,
    });
  }

  const weekIds = body.weekIds && body.weekIds.length ? body.weekIds : [periodKey];
  const id = makeId();
  const result = await query(
    `INSERT INTO expert_targets
       (id, expert_id, period_type, period_key, week_ids, parent_id,
        target_count, min_priority_count, filters, daily_wip_cap, status, note, created_by, updated_by)
     VALUES ($1,$2,'week',$3,$4::jsonb,NULL,$5,$6,$7::jsonb,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      id, expertId, periodKey, JSON.stringify(weekIds),
      targetCount, minPriority, JSON.stringify(filters),
      dailyWipCap, status, note, byUser,
    ]
  );
  const obj = rowToObj(result.rows[0]);
  await writeAudit(id, byUser, 'create', null, obj);
  return obj;
}

async function createMonthWithChildren(opts) {
  const parsed = parseMonthKey(opts.periodKey);
  if (!parsed) {
    const err = new Error('periodKey ماه نامعتبر — فرمت: YYYY/MM');
    err.status = 400;
    throw err;
  }
  const weekIds = weeksOverlappingMonth(parsed.jy, parsed.jm);
  if (!weekIds.length) {
    const err = new Error('هفته‌ای برای این ماه یافت نشد');
    err.status = 400;
    throw err;
  }
  const n = weekIds.length;
  const base = Math.floor(opts.targetCount / n);
  const rem = opts.targetCount % n;
  const pBase = Math.floor(opts.minPriority / n);
  const pRem = opts.minPriority % n;

  const parentId = makeId();
  const parentR = await query(
    `INSERT INTO expert_targets
       (id, expert_id, period_type, period_key, week_ids, parent_id,
        target_count, min_priority_count, filters, daily_wip_cap, status, note, created_by, updated_by)
     VALUES ($1,$2,'month',$3,$4::jsonb,NULL,$5,$6,$7::jsonb,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      parentId, opts.expertId, opts.periodKey, JSON.stringify(weekIds),
      opts.targetCount, opts.minPriority, JSON.stringify(opts.filters),
      opts.dailyWipCap, opts.status, opts.note, opts.byUser,
    ]
  );
  const parent = rowToObj(parentR.rows[0]);
  await writeAudit(parentId, opts.byUser, 'create', null, parent);

  const children = [];
  for (let i = 0; i < n; i++) {
    const tc = base + (i < rem ? 1 : 0);
    const mp = pBase + (i < pRem ? 1 : 0);
    if (tc < 1) continue;
    const cid = makeId();
    const cr = await query(
      `INSERT INTO expert_targets
         (id, expert_id, period_type, period_key, week_ids, parent_id,
          target_count, min_priority_count, filters, daily_wip_cap, status, note, created_by, updated_by)
       VALUES ($1,$2,'week',$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$12)
       RETURNING *`,
      [
        cid, opts.expertId, weekIds[i], JSON.stringify([weekIds[i]]), parentId,
        tc, mp, JSON.stringify(opts.filters),
        opts.dailyWipCap, opts.status,
        'زیرهدف ماه ' + opts.periodKey, opts.byUser,
      ]
    );
    const child = rowToObj(cr.rows[0]);
    await writeAudit(cid, opts.byUser, 'split_month', null, child);
    children.push(child);
  }

  return { parent: parent, children: children };
}

async function listTargets(opts) {
  const conditions = [];
  const params = [];
  if (opts.expertId) {
    params.push(opts.expertId);
    conditions.push(`expert_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  } else if (!opts.includeAll) {
    conditions.push(`status IN ('active','draft','locked')`);
  }
  if (opts.periodType) {
    params.push(opts.periodType);
    conditions.push(`period_type = $${params.length}`);
  }
  if (opts.periodKey) {
    params.push(opts.periodKey);
    conditions.push(`period_key = $${params.length}`);
  }
  if (opts.rootsOnly) {
    conditions.push(`parent_id IS NULL`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const r = await query(
    `SELECT * FROM expert_targets ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return r.rows.map(rowToObj);
}

async function getById(id) {
  const r = await query('SELECT * FROM expert_targets WHERE id = $1', [id]);
  return r.rows[0] ? rowToObj(r.rows[0]) : null;
}

async function updateTarget(id, patch, byUser) {
  const cur = await getById(id);
  if (!cur) {
    const err = new Error('هدف یافت نشد');
    err.status = 404;
    throw err;
  }
  const next = {
    targetCount: patch.targetCount != null ? parseInt(patch.targetCount, 10) : cur.targetCount,
    minPriorityCount: patch.minPriorityCount != null ? parseInt(patch.minPriorityCount, 10) : cur.minPriorityCount,
    filters: patch.filters != null ? patch.filters : cur.filters,
    dailyWipCap: patch.dailyWipCap !== undefined ? patch.dailyWipCap : cur.dailyWipCap,
    status: patch.status || cur.status,
    note: patch.note !== undefined ? patch.note : cur.note,
    weekIds: patch.weekIds || cur.weekIds,
  };
  const r = await query(
    `UPDATE expert_targets SET
       target_count = $2, min_priority_count = $3, filters = $4::jsonb,
       daily_wip_cap = $5, status = $6, note = $7, week_ids = $8::jsonb,
       updated_at = NOW(), updated_by = $9
     WHERE id = $1 RETURNING *`,
    [
      id, next.targetCount, next.minPriorityCount, JSON.stringify(next.filters),
      next.dailyWipCap, next.status, next.note, JSON.stringify(next.weekIds), byUser,
    ]
  );
  const obj = rowToObj(r.rows[0]);
  await writeAudit(id, byUser, patch.status && patch.status !== cur.status ? patch.status : 'update', cur, obj);
  return obj;
}

async function boardProgress(status) {
  const targets = await listTargets({ status: status || 'active', rootsOnly: true, periodType: null });
  // Prefer week roots + month roots; for month also aggregate children
  const out = [];
  for (const t of targets) {
    if (t.periodType === 'month') {
      const children = await listTargets({
        expertId: t.expertId,
        includeAll: true,
      });
      const kids = children.filter(function (c) { return c.parentId === t.id && c.status === 'active'; });
      let doneTotal = 0, donePriority = 0, committedTotal = 0;
      const childProgress = [];
      for (const k of kids) {
        const p = await computeProgress(k);
        childProgress.push(p);
        doneTotal += p.doneTotal;
        donePriority += p.donePriority;
        committedTotal += p.committedTotal;
      }
      const progressPct = t.targetCount > 0 ? doneTotal / t.targetCount : 0;
      const priorityOk = donePriority >= (t.minPriorityCount || 0);
      out.push({
        target: t,
        progress: {
          targetId: t.id,
          expertId: t.expertId,
          periodType: 'month',
          periodKey: t.periodKey,
          weekIds: t.weekIds,
          targetCount: t.targetCount,
          minPriorityCount: t.minPriorityCount,
          doneTotal: doneTotal,
          donePriority: donePriority,
          committedTotal: committedTotal,
          freeSlots: Math.max(0, t.targetCount - committedTotal),
          remainingTotal: Math.max(0, t.targetCount - doneTotal),
          remainingPriority: Math.max(0, (t.minPriorityCount || 0) - donePriority),
          progressPct: Math.round(progressPct * 1000) / 1000,
          priorityOk: priorityOk,
          quotaMet: doneTotal >= t.targetCount && priorityOk,
          color: (doneTotal >= t.targetCount && priorityOk) ? 'green' : (progressPct < 0.35 ? 'red' : 'yellow'),
          children: childProgress,
        },
      });
    } else {
      out.push({ target: t, progress: await computeProgress(t) });
    }
  }
  return out;
}

module.exports = {
  rowToObj,
  makeId,
  writeAudit,
  weeksOverlappingMonth,
  createTarget,
  createMonthWithChildren,
  listTargets,
  getById,
  updateTarget,
  computeProgress,
  getActiveWeekTarget,
  assertExpertSelfAllowed,
  countScheduledOnDay,
  boardProgress,
};

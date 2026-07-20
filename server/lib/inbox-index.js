'use strict';

const { query } = require('../db');
const { isManagerRole, ROLE_DEFAULTS } = require('./roles');
const hrLeave = require('./hr-leave');
const {
  resolveCenterDisplayName,
  enrichInboxItems,
  titleCenterName,
  fallbackLabel,
} = require('./center-names');
const {
  todayJalaliStr, compareJalali, parseJalali, formatJalali, j2g, addJalaliDays,
} = require('./jalali-mini');
const { buildOwnerMaps, resolveCenterOwner } = require('./center-ownership');

const MANAGER_POOL = '@manager';
const CLOSED_STATUSES = ['غیرفعال', 'قرارداد بسته شد', 'عدم نیاز فاکتور کنسل شد', 'lost', 'inactive'];
const TYPE_LABELS = {
  task: 'وظیفه', week: 'برنامه هفته', followup: 'پیگیری مرکز', proforma: 'پیش‌فاکتور',
  notification: 'اعلان', support: 'تیکت پشتیبانی', workflow: 'گردش‌کار', hr_leave: 'مرخصی',
  payroll_var: 'حقوق و دستمزد',
  trade_task: 'وظیفه بازرگانی', letter: 'نامه دبیرخانه', mtr: 'مطالبات',
};
const ACT_LABELS = { call: 'تماس', visit: 'مراجعه', email: 'ایمیل', other: 'سایر' };
const SNOOZE_MAX = 2;

function jalaliDaysDiff(fromStr, toStr) {
  const f = parseJalali(fromStr);
  const t = parseJalali(toStr);
  if (!f || !t) return 0;
  const g1 = j2g(f[0], f[1], f[2]);
  const g2 = j2g(t[0], t[1], t[2]);
  const d1 = new Date(g1[0], g1[1] - 1, g1[2]);
  const d2 = new Date(g2[0], g2[1] - 1, g2[2]);
  return Math.round((d2 - d1) / 86400000);
}

function computeUrgency(dueAt, today) {
  if (!dueAt) return { urgency: 'pending', overdueDays: 0 };
  if (compareJalali(dueAt, today) < 0) {
    return { urgency: 'overdue', overdueDays: Math.max(1, jalaliDaysDiff(dueAt, today)) };
  }
  if (dueAt === today) return { urgency: 'today', overdueDays: 0 };
  return { urgency: 'pending', overdueDays: 0 };
}

function computeSeverity(row, today) {
  const u = computeUrgency(row.due_at, today);
  let score = 0;
  if (u.urgency === 'overdue') score = 100 + u.overdueDays * 12;
  else if (u.urgency === 'today') score = 80;
  else score = 20;

  const pr = Number(row.priority) || 2;
  const pw = pr <= 1 ? 2.5 : pr >= 3 ? 1 : 1.5;
  score *= pw;

  const val = Number(row.monetary_value) || 0;
  if (val > 0 && (row.source_type === 'proforma' || row.source_type === 'mtr')) {
    score += Math.log10(Math.max(val, 1)) * 8;
  }
  if (row.action === 'proforma_approve' || row.action === 'letter_sign') score += 30;
  if (row.snooze_count >= SNOOZE_MAX) score += 25;

  return { ...u, severityScore: Math.round(score * 100) / 100 };
}

function rowToApiItem(row, today) {
  const s = computeSeverity(row, today);
  const dueRaw = row.due_at || null;
  const dueParsed = dueRaw ? parseJalali(dueRaw) : null;
  const dueAt = dueParsed ? formatJalali(dueParsed) : dueRaw;
  return {
    id: row.id,
    type: row.source_type,
    typeLabel: TYPE_LABELS[row.source_type] || row.source_type,
    title: row.title,
    subtitle: row.subtitle || '',
    dueAt,
    priority: row.priority != null ? row.priority : 2,
    urgency: s.urgency,
    overdueDays: s.overdueDays,
    severityScore: s.severityScore,
    monetaryValue: Number(row.monetary_value) || 0,
    owner: row.owner,
    centerKey: row.center_key || null,
    action: row.action,
    meta: row.meta || {},
    snoozeCount: row.snooze_count || 0,
    snoozedUntil: row.snoozed_until || null,
    canSnooze: (row.snooze_count || 0) < SNOOZE_MAX && row.action !== 'notification',
    canQuickComplete: ['task', 'week', 'notification', 'trade_task'].includes(row.action),
    automationEligible: !!row.automation_eligible,
    deploymentMode: row.deployment_mode || 'human-in-loop',
  };
}

async function upsertInboxItem(item) {
  if (!item.owner) return;
  await query(
    `INSERT INTO inbox_items (
      id, source_type, source_id, owner, visibility, title, subtitle, due_at, priority,
      monetary_value, center_key, action, meta, automation_eligible, deployment_mode, active, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,NOW())
    ON CONFLICT (id) DO UPDATE SET
      owner=EXCLUDED.owner, visibility=EXCLUDED.visibility, title=EXCLUDED.title,
      subtitle=EXCLUDED.subtitle, due_at=EXCLUDED.due_at, priority=EXCLUDED.priority,
      monetary_value=EXCLUDED.monetary_value, center_key=EXCLUDED.center_key, action=EXCLUDED.action,
      meta=EXCLUDED.meta, automation_eligible=EXCLUDED.automation_eligible,
      deployment_mode=EXCLUDED.deployment_mode, active=TRUE, updated_at=NOW()`,
    [
      item.id, item.sourceType, item.sourceId, item.owner, item.visibility || 'owner',
      item.title, item.subtitle || '', item.dueAt || null, item.priority != null ? item.priority : 2,
      item.monetaryValue || 0, item.centerKey || null, item.action,
      JSON.stringify(item.meta || {}), !!item.automationEligible, item.deploymentMode || 'human-in-loop',
    ]
  );
}

async function deactivateInboxItem(id) {
  await query('UPDATE inbox_items SET active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
}

async function deactivateBySource(sourceType, sourceId) {
  await query(
    'UPDATE inbox_items SET active = FALSE, updated_at = NOW() WHERE source_type = $1 AND source_id = $2',
    [sourceType, String(sourceId)]
  );
}

// ── Authorization ───────────────────────────────────────────────────────────

async function canManagerViewSubordinate(managerUsername, managerRole, targetUsername) {
  if (!targetUsername || targetUsername === managerUsername) return true;
  if (managerRole === 'سوپر ادمین') return true;
  if (!isManagerRole(managerRole)) return false;
  const r = await query(
    'SELECT direct_manager FROM app_users WHERE username = $1 AND active = TRUE',
    [targetUsername]
  );
  if (!r.rows.length) return false;
  return r.rows[0].direct_manager === managerUsername;
}

async function listAuthorizedSubordinates(managerUsername, managerRole) {
  if (managerRole === 'سوپر ادمین') {
    const r = await query(
      `SELECT username FROM app_users WHERE active = TRUE AND username != $1 AND role NOT IN ('مهمان', 'guest')`,
      [managerUsername]
    );
    return r.rows.map(function (x) { return x.username; });
  }
  if (!isManagerRole(managerRole)) return [];
  const r = await query(
    'SELECT username FROM app_users WHERE active = TRUE AND direct_manager = $1',
    [managerUsername]
  );
  return r.rows.map(function (x) { return x.username; });
}

async function resolveTargetUser(user, scope, ownerParam) {
  const isMgr = isManagerRole(user.role);
  if (scope === 'all' && isMgr) {
    return { targetUser: null, scope: 'all', isMgr };
  }
  const effectiveScope = scope === 'team' && isMgr ? 'team' : 'mine';
  let targetUser = user.username;
  if (effectiveScope === 'team') {
    if (!ownerParam) return { error: 'کارشناس انتخاب نشده', status: 400 };
    const ok = await canManagerViewSubordinate(user.username, user.role, ownerParam);
    if (!ok) return { error: 'دسترسی به کارتابل این کاربر مجاز نیست', status: 403 };
    targetUser = String(ownerParam);
  }
  return { targetUser, scope: effectiveScope, isMgr };
}

function inboxLimitCap(scope, rawLimit) {
  const n = Math.max(parseInt(rawLimit, 10) || 50, 1);
  if (scope === 'all') return Math.min(n, 2000);
  return Math.min(n, 500);
}

function filterInboxSearch(items, search) {
  if (!search) return items;
  const q = String(search).trim().toLowerCase();
  if (!q) return items;
  return items.filter(function (item) {
    return (item.title || '').toLowerCase().includes(q)
      || (item.subtitle || '').toLowerCase().includes(q)
      || (item.centerKey || '').toLowerCase().includes(q)
      || (item.owner || '').toLowerCase().includes(q);
  });
}

async function buildInboxResponse(items, opts, today, meta) {
  const filter = opts.filter || 'all';
  const limit = inboxLimitCap(meta.scope, opts.limit);
  const offset = Math.max(parseInt(opts.offset, 10) || 0, 0);
  const weekAhead = Math.min(Math.max(parseInt(opts.weekAhead, 10) || 0, 0), 14);
  const calendarRange = !!opts.calendarRange;

  items = items.filter(function (item) { return matchesFilter(item, filter, today); });
  items = filterInboxSearch(items, opts.search);

  items.sort(function (a, b) {
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return compareJalali(a.dueAt, b.dueAt);
    return (a.title || '').localeCompare(b.title || '', 'fa');
  });

  const total = items.length;
  let page = items.slice(offset, offset + limit);
  const pageIds = new Set(page.map(function (i) { return i.id; }));

  function tryAddExtra(item) {
    if (pageIds.has(item.id)) return;
    page.push(item);
    pageIds.add(item.id);
  }

  if (weekAhead > 0 && offset === 0) {
    items.forEach(function (item) {
      if (pageIds.has(item.id)) return;
      if (!matchesFilter(item, filter, today)) return;
      if (!item.dueAt || item.urgency === 'overdue' || item.urgency === 'today') return;
      if (compareJalali(item.dueAt, today) <= 0) return;
      if (jalaliDaysDiff(today, item.dueAt) <= weekAhead) tryAddExtra(item);
    });
  }

  if (calendarRange && offset === 0) {
    const rangeEnd = addJalaliDays(today, 14);
    const rangeStart = addJalaliDays(today, -90);
    items.forEach(function (item) {
      if (pageIds.has(item.id)) return;
      if (!matchesFilter(item, filter, today)) return;
      if (item.type === 'notification') return;
      if (!item.dueAt) return;
      if (compareJalali(item.dueAt, rangeEnd) > 0) return;
      if (compareJalali(item.dueAt, rangeStart) < 0) return;
      tryAddExtra(item);
    });
  }

  const enrichedPage = await enrichInboxItems(page);
  const warnings = await queryInboxWarnings(meta.isMgr);

  const counts = {
    all: total,
    overdue: items.filter(function (i) { return i.urgency === 'overdue'; }).length,
    today: items.filter(function (i) { return i.urgency === 'today'; }).length,
    approval: items.filter(function (i) {
      return i.action === 'proforma_approve' || i.action === 'hr_leave' || i.action === 'letter_sign';
    }).length,
  };

  return {
    items: enrichedPage,
    counts,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    today,
    targetUser: meta.targetUser,
    scope: meta.scope,
    filter,
    isManager: meta.isMgr,
    partial: false,
    warnings,
  };
}

async function queryInboxCombined(user, opts, today) {
  const subs = await listAuthorizedSubordinates(user.username, user.role);
  const owners = [user.username];
  subs.forEach(function (u) { if (owners.indexOf(u) < 0) owners.push(u); });

  const types = opts.types && opts.types.length ? opts.types : null;
  const params = [owners, today];
  let where = `active = TRUE AND (snoozed_until IS NULL OR snoozed_until = '' OR snoozed_until <= $2)
    AND ((owner = ANY($1) AND visibility = 'owner')
    OR (visibility = 'manager' AND owner = '${MANAGER_POOL}'))`;

  if (types && types.length) {
    params.push(types);
    where += ` AND source_type = ANY($${params.length})`;
  }

  const r = await query(`SELECT * FROM inbox_items WHERE ${where} ORDER BY updated_at DESC`, params);
  const items = r.rows.map(function (row) { return rowToApiItem(row, today); });
  return buildInboxResponse(items, opts, today, {
    targetUser: null,
    scope: 'all',
    isMgr: true,
  });
}

// ── Sync helpers ────────────────────────────────────────────────────────────

async function loadMemberMaps() {
  const r = await query("SELECT value FROM app_settings WHERE key = 'members'");
  const members = (r.rows[0] && r.rows[0].value) || [];
  const idToName = {};
  const nameToId = {};
  if (Array.isArray(members)) {
    members.forEach(function (m) {
      if (m && m.id) {
        idToName[m.id] = m.name || m.id;
        if (m.name) nameToId[m.name] = m.id;
      }
    });
  }
  return { idToName, nameToId };
}

function mtrRowMatchesUser(row, targetUser, idToName, nameToId) {
  const follower = String(row.follower || '').trim();
  if (!follower || follower === '—') return false;
  if (follower === targetUser) return true;
  const display = idToName[targetUser];
  if (display && follower === display) return true;
  if (nameToId[follower] === targetUser) return true;
  return false;
}

async function syncTask(taskId) {
  const r = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!r.rows.length || r.rows[0].done) {
    await deactivateBySource('task', taskId);
    return;
  }
  const row = r.rows[0];
  if (!row.owner) {
    await deactivateBySource('task', taskId);
    return;
  }
  const today = todayJalaliStr();
  const u = computeUrgency(row.due_date, today);
  const overdue = u.urgency === 'overdue';
  await upsertInboxItem({
    id: 'task:' + row.id,
    sourceType: 'task',
    sourceId: row.id,
    owner: row.owner,
    title: row.title,
    subtitle: row.due_date ? ('موعد: ' + row.due_date) : 'بدون موعد',
    dueAt: row.due_date,
    priority: overdue ? 1 : (Number(row.priority) >= 3 ? 1 : 2),
    centerKey: row.center_key,
    action: 'task',
    meta: { taskId: row.id },
    automationEligible: false,
    deploymentMode: 'human-in-loop',
  });
}

async function syncWeekEntry(entryId) {
  const r = await query('SELECT * FROM week_entries WHERE id = $1', [entryId]);
  if (!r.rows.length) {
    await deactivateBySource('week', entryId);
    return;
  }
  const row = r.rows[0];
  if (!row.added_by) {
    await deactivateBySource('week', entryId);
    return;
  }
  const today = todayJalaliStr();
  if (row.done || !row.scheduled_date || compareJalali(row.scheduled_date, today) > 0) {
    await deactivateBySource('week', entryId);
    return;
  }
  const u = computeUrgency(row.scheduled_date, today);
  const overdue = u.urgency === 'overdue';
  await upsertInboxItem({
    id: 'week:' + row.id,
    sourceType: 'week',
    sourceId: row.id,
    owner: row.added_by,
    title: (row.center_name || 'مرکز') + ' — ' + (ACT_LABELS[row.action_type] || row.action_type || 'تماس'),
    subtitle: (overdue ? 'معوق: ' : 'امروز: ') + row.scheduled_date,
    dueAt: row.scheduled_date,
    priority: overdue ? 1 : 2,
    centerKey: row.rec_key || null,
    action: 'week',
    meta: { weekId: row.id, rtype: row.rtype, rid: row.rid, recKey: row.rec_key },
  });
}

async function syncPayrollVariable(varId) {
  const r = await query('SELECT * FROM payroll_monthly_variables WHERE id = $1', [varId]);
  if (!r.rows.length || r.rows[0].status !== 'pending') {
    await deactivateInboxItem('payroll_var:' + varId);
    return;
  }
  const v = r.rows[0];
  const typeLabels = { advance: 'مساعده', bonus: 'پاداش', penalty: 'جریمه', overtime: 'اضافه‌کار' };
  await upsertInboxItem({
    id: 'payroll_var:' + v.id,
    sourceType: 'payroll_var',
    sourceId: v.id,
    owner: MANAGER_POOL,
    visibility: 'manager',
    title: 'تأیید ' + (typeLabels[v.var_type] || v.var_type) + ' — ' + v.employee,
    subtitle: (v.title || '') + ' · ' + Number(v.amount).toLocaleString('fa-IR') + ' ریال',
    dueAt: v.month,
    action: 'payroll_var',
    meta: { variableId: v.id, employee: v.employee, month: v.month },
    deploymentMode: 'reviewer',
  });
}

async function syncLeave(leaveId) {
  const r = await query('SELECT * FROM leave_requests WHERE id = $1', [leaveId]);
  if (!r.rows.length || r.rows[0].status !== 'pending') {
    await deactivateInboxItem('hr_leave:' + leaveId);
    return;
  }
  const lr = r.rows[0];
  const approver = await hrLeave.resolveApprover(lr.employee, lr.from_date);
  if (!approver) return;
  await upsertInboxItem({
    id: 'hr_leave:' + lr.id,
    sourceType: 'hr_leave',
    sourceId: lr.id,
    owner: approver,
    visibility: 'manager',
    title: 'تأیید مرخصی — ' + lr.employee,
    subtitle: lr.from_date + ' تا ' + lr.to_date + ' (' + (lr.working_days_calc || lr.days) + ' روز)',
    dueAt: lr.from_date,
    action: 'hr_leave',
    meta: { leaveId: lr.id },
    deploymentMode: 'reviewer',
  });
}

/**
 * Notifications are events (bell), not work items (cartable).
 * Keep this as a deactivate-only hook so read/delete clears any legacy rows.
 */
async function syncNotification(notifId) {
  await deactivateBySource('notification', notifId);
}

async function syncProforma(pfId) {
  const r = await query(
    'SELECT id, no, center_name, status, jalali_date, total, created_by, discount_pct FROM proformas WHERE id = $1',
    [pfId]
  );
  if (!r.rows.length) {
    await deactivateBySource('proforma', pfId);
    await deactivateInboxItem('proforma_approve:' + pfId);
    return;
  }
  const row = r.rows[0];
  const total = Number(row.total) || 0;
  if (row.status === 'draft' || row.status === 'rejected' || row.status === 'awaiting_customer') {
    const sub =
      row.status === 'rejected' ? 'رد شده' :
      row.status === 'awaiting_customer' ? 'در انتظار تایید مشتری' :
      'پیش‌نویس';
    await upsertInboxItem({
      id: 'proforma:' + row.id,
      sourceType: 'proforma',
      sourceId: row.id,
      owner: row.created_by,
      title: 'پیش‌فاکتور ' + (row.no || row.id),
      subtitle: (row.center_name || '') + ' · ' + sub,
      dueAt: row.jalali_date,
      monetaryValue: total,
      action: 'proforma',
      priority: row.status === 'awaiting_customer' ? 2 : 3,
      meta: { pfId: row.id, status: row.status },
    });
    await deactivateInboxItem('proforma_approve:' + row.id);
  } else if (['sent', 'negotiating', 'pending_disc'].includes(row.status)) {
    const stLabel = row.status === 'pending_disc' ? 'تأیید تخفیف' : 'تأیید پیش‌فاکتور';
    await upsertInboxItem({
      id: 'proforma_approve:' + row.id,
      sourceType: 'proforma',
      sourceId: row.id,
      owner: MANAGER_POOL,
      visibility: 'manager',
      title: stLabel + ' — ' + (row.no || ''),
      subtitle: (row.center_name || '') + ' · ' + (row.created_by || '') + (row.discount_pct ? ' · تخفیف ' + row.discount_pct + '٪' : ''),
      dueAt: row.jalali_date,
      priority: row.status === 'pending_disc' ? 1 : 2,
      monetaryValue: total,
      action: 'proforma_approve',
      meta: { pfId: row.id, status: row.status, createdBy: row.created_by },
      automationEligible: row.status !== 'pending_disc',
      deploymentMode: row.status === 'pending_disc' ? 'reviewer' : 'human-in-loop',
    });
    await deactivateInboxItem('proforma:' + row.id);
  } else {
    await deactivateBySource('proforma', pfId);
    await deactivateInboxItem('proforma_approve:' + pfId);
  }
}

async function loadOwnerMapsForSync() {
  const [masterR, extraR, editsR] = await Promise.all([
    query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    query('SELECT id, row_num as row, province_id, owner FROM center_extras'),
    query('SELECT center_key, data FROM center_edits'),
  ]);
  const centersMaster = {};
  masterR.rows.forEach(function (r) { centersMaster[r.key] = r.data; });
  const edits = {};
  editsR.rows.forEach(function (r) { edits[r.center_key] = r.data || {}; });
  return { ownerMaps: buildOwnerMaps(centersMaster, extraR.rows), edits };
}

async function syncFollowupCenter(centerKey) {
  if (!centerKey) return { active: false };
  const id = 'followup:' + centerKey;
  const today = todayJalaliStr();
  const r = await query(
    `SELECT center_key, data AS edit_data, data->>'owner' AS owner, data->>'followupDate' AS followup_date,
            COALESCE(data->>'status', '') AS status
     FROM center_edits WHERE center_key = $1`,
    [centerKey]
  );
  if (!r.rows.length) {
    await deactivateInboxItem(id);
    return { active: false, reason: 'no_edit', centerKey };
  }
  const row = r.rows[0];
  const fdRaw = row.followup_date;
  const parsedFd = parseJalali(fdRaw);
  const fd = parsedFd ? formatJalali(parsedFd) : fdRaw;
  const status = row.status || '';
  if (!fd) {
    await deactivateInboxItem(id);
    return { active: false, reason: 'no_followup', centerKey };
  }
  if (CLOSED_STATUSES.indexOf(status) >= 0) {
    await deactivateInboxItem(id);
    return { active: false, reason: 'closed_status', centerKey };
  }

  let owner = row.owner;
  if (!owner) {
    const ctx = await loadOwnerMapsForSync();
    owner = resolveCenterOwner(centerKey, ctx.edits, ctx.ownerMaps);
  }
  if (!owner) {
    await deactivateInboxItem(id);
    return { active: false, reason: 'no_owner', centerKey };
  }

  const u = computeUrgency(fd, today);
  const subPrefix = u.urgency === 'overdue' ? 'معوق: ' : (u.urgency === 'today' ? 'امروز: ' : 'پیگیری: ');
  const cname = await resolveCenterDisplayName(centerKey);
  await upsertInboxItem({
    id,
    sourceType: 'followup',
    sourceId: centerKey,
    owner,
    title: cname + ' — پیگیری',
    subtitle: subPrefix + fd + (status ? ' · ' + status : ''),
    dueAt: fd,
    priority: u.urgency === 'overdue' ? 1 : (u.urgency === 'today' ? 2 : 3),
    centerKey,
    action: 'followup',
    meta: { centerKey },
  });
  return { active: true, urgency: u.urgency, dueAt: fd, centerKey, owner };
}

async function rebuildAll() {
  const today = todayJalaliStr();
  console.log('[inbox-index] full rebuild started');
  const activeIds = new Set();

  const tasks = await query('SELECT id FROM tasks WHERE done = false AND owner IS NOT NULL AND owner != \'\'');
  for (const row of tasks.rows) {
    await syncTask(row.id);
    activeIds.add('task:' + row.id);
  }

  const weeks = await query(
    `SELECT id FROM week_entries WHERE done = false AND scheduled_date IS NOT NULL AND scheduled_date != '' AND scheduled_date <= $1`,
    [today]
  );
  for (const row of weeks.rows) {
    await syncWeekEntry(row.id);
    activeIds.add('week:' + row.id);
  }

  const fuRes = await query(
    `SELECT center_key FROM center_edits
     WHERE (data->>'followupDate') IS NOT NULL AND (data->>'followupDate') != ''
       AND COALESCE(data->>'status', '') NOT IN ('غیرفعال','قرارداد بسته شد','عدم نیاز فاکتور کنسل شد','lost','inactive')`
  );
  for (const r of fuRes.rows) {
    const key = r.center_key || '';
    if (!key) continue;
    await syncFollowupCenter(key);
    activeIds.add('followup:' + key);
  }

  // Notifications no longer mirror into inbox_items (bell ≠ cartable).
  // Deactivate any legacy notification:* rows so they leave the cartable.
  await query(
    `UPDATE inbox_items SET active = FALSE, updated_at = NOW()
     WHERE source_type = 'notification' AND active = TRUE`
  ).catch(function () {});

  const pfs = await query(`SELECT id FROM proformas WHERE status IN ('draft','rejected','awaiting_customer','sent','negotiating','pending_disc')`);
  for (const row of pfs.rows) {
    await syncProforma(row.id);
    activeIds.add('proforma:' + row.id);
    activeIds.add('proforma_approve:' + row.id);
  }

  const leaves = await query(`SELECT id FROM leave_requests WHERE status = 'pending'`);
  for (const row of leaves.rows) {
    await syncLeave(row.id);
    activeIds.add('hr_leave:' + row.id);
  }

  const tickets = await query(
    `SELECT id FROM support_tickets WHERE status IN ('open', 'in_progress', 'waiting')`
  );
  for (const row of tickets.rows) {
    const sp = (await query('SELECT * FROM support_tickets WHERE id = $1', [row.id])).rows[0];
    const owner = sp.assigned_to || sp.reporter;
    if (!owner) continue;
    const id = 'support:' + sp.id;
    activeIds.add(id);
    const slaOver = sp.sla_deadline && sp.sla_deadline < new Date().toISOString().slice(0, 10);
    await upsertInboxItem({
      id, sourceType: 'support', sourceId: sp.id, owner,
      title: sp.title,
      subtitle: (sp.center_name || '') + ' · ' + sp.status + (slaOver ? ' · SLA گذشته' : ''),
      priority: slaOver || Number(sp.priority) >= 3 ? 1 : 2,
      dueAt: sp.sla_deadline || null,
      action: 'support',
      meta: { ticketId: sp.id },
    });
  }

  try {
    const wfs = await query(`SELECT id FROM workflow_instances WHERE status = 'active'`);
    for (const row of wfs.rows) {
      const wf = (await query('SELECT * FROM workflow_instances WHERE id = $1', [row.id])).rows[0];
      if (!wf.owner) continue;
      const id = 'workflow:' + wf.id;
      activeIds.add(id);
      const u = computeUrgency(wf.due_date, today);
      await upsertInboxItem({
        id, sourceType: 'workflow', sourceId: wf.id, owner: wf.owner,
        title: wf.title,
        subtitle: 'مرحله: ' + (wf.current_stage || '—') + (wf.due_date ? ' · ' + wf.due_date : ''),
        dueAt: wf.due_date,
        priority: u.urgency === 'overdue' ? 1 : 2,
        centerKey: wf.center_key,
        action: 'workflow',
        meta: { wfId: wf.id },
      });
    }
  } catch (e) { /* optional table */ }

  try {
    const tts = await query(`SELECT id FROM trade_tasks WHERE status NOT IN ('done', 'cancelled')`);
    for (const row of tts.rows) {
      const tt = (await query('SELECT * FROM trade_tasks WHERE id = $1', [row.id])).rows[0];
      if (!tt.assigned_to) continue;
      const id = 'trade_task:' + tt.id;
      activeIds.add(id);
      const u = computeUrgency(tt.deadline, today);
      await upsertInboxItem({
        id, sourceType: 'trade_task', sourceId: tt.id, owner: tt.assigned_to,
        title: tt.title,
        subtitle: (tt.center_name || '') + (tt.deadline ? ' · ' + tt.deadline : ''),
        dueAt: tt.deadline,
        priority: u.urgency === 'overdue' ? 1 : 2,
        action: 'trade_task',
        meta: { taskId: tt.id },
      });
    }
  } catch (e) { /* optional */ }

  try {
    const maps = await loadMemberMaps();
    const mtrR = await query("SELECT value FROM app_data WHERE key = 'mtr'");
    const mtrVal = mtrR.rows[0] && mtrR.rows[0].value;
    const rows = (mtrVal && Array.isArray(mtrVal.data)) ? mtrVal.data : [];
    const users = await query('SELECT username FROM app_users WHERE active = TRUE');
    for (const u of users.rows) {
      const matched = rows.filter(function (row) {
        return row && Number(row.od) > 0 && mtrRowMatchesUser(row, u.username, maps.idToName, maps.nameToId);
      }).sort(function (a, b) { return Number(b.od) - Number(a.od); }).slice(0, 15);
      for (const row of matched) {
        const id = 'mtr:' + u.username + ':' + (row.inv || row.customer);
        activeIds.add(id);
        await upsertInboxItem({
          id, sourceType: 'mtr', sourceId: String(row.inv || row.customer), owner: u.username,
          title: 'مطالبه #' + (row.inv || '—') + ' — ' + (row.customer || '').slice(0, 30),
          subtitle: '+' + row.od + ' روز تأخیر · مانده: ' + Number(row.rem || 0).toLocaleString('fa-IR'),
          dueAt: row.due || null,
          priority: Number(row.od) > 60 ? 1 : 2,
          monetaryValue: Number(row.rem) || 0,
          action: 'mtr',
          meta: { inv: row.inv, customer: row.customer },
        });
      }
    }
  } catch (e) {
    console.error('[inbox-index] mtr rebuild', e.message);
  }

  if (activeIds.size) {
    await query('UPDATE inbox_items SET active = FALSE WHERE NOT (id = ANY($1::text[]))', [Array.from(activeIds)]);
  } else {
    await query('UPDATE inbox_items SET active = FALSE');
  }
  console.log('[inbox-index] full rebuild done, active items:', activeIds.size);
}

// ── Query from index ────────────────────────────────────────────────────────

function matchesFilter(item, filter, today) {
  if (filter === 'all') return true;
  if (filter === 'overdue') return item.urgency === 'overdue';
  if (filter === 'today') return item.urgency === 'today';
  if (filter === 'approval') {
    return item.action === 'proforma_approve' || item.action === 'hr_leave' || item.action === 'letter_sign';
  }
  if (filter === 'week') return isThisWeekItem(item, today);
  return true;
}

async function queryInboxWarnings(isMgr) {
  const warnings = [];
  if (!isMgr) return warnings;
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS c FROM center_edits ce
       WHERE (ce.data->>'followupDate') IS NOT NULL AND (ce.data->>'followupDate') != ''
         AND COALESCE(ce.data->>'status', '') NOT IN ('غیرفعال','قرارداد بسته شد','عدم نیاز فاکتور کنسل شد','lost','inactive')
         AND NOT EXISTS (
           SELECT 1 FROM inbox_items ii
           WHERE ii.id = 'followup:' || ce.center_key AND ii.active = TRUE
         )`
    );
    const n = r.rows[0] && r.rows[0].c ? r.rows[0].c : 0;
    if (n > 0) {
      warnings.push({
        code: 'followup_not_in_inbox',
        count: n,
        message: n + ' مرکز تاریخ پیگیری دارند ولی در کارتابل نیستند (معمولاً بدون کارشناس مسئول). از پروفایل مرکز، «مسئول» را تعیین کنید.',
      });
    }
  } catch (e) {
    console.error('[inbox-index] queryInboxWarnings', e.message);
  }
  return warnings;
}

async function queryInbox(user, opts) {
  const today = opts.today || todayJalaliStr();
  if (opts.scope === 'all' && isManagerRole(user.role)) {
    return queryInboxCombined(user, opts, today);
  }

  const resolved = await resolveTargetUser(user, opts.scope, opts.owner);
  if (resolved.error) return { error: resolved.error, status: resolved.status };

  const { targetUser, scope, isMgr } = resolved;
  const includeMgr = isMgr && scope === 'mine';
  const types = opts.types && opts.types.length ? opts.types : null;

  const params = [targetUser, today];
  let where = `active = TRUE AND (snoozed_until IS NULL OR snoozed_until = '' OR snoozed_until <= $2)
    AND ((owner = $1 AND visibility = 'owner')`;
  if (includeMgr) {
    where += ` OR (visibility = 'manager' AND owner = '${MANAGER_POOL}')`;
  }
  where += ')';

  if (types && types.length) {
    params.push(types);
    where += ` AND source_type = ANY($${params.length})`;
  }

  const r = await query(`SELECT * FROM inbox_items WHERE ${where} ORDER BY updated_at DESC`, params);
  const items = r.rows.map(function (row) { return rowToApiItem(row, today); });
  return buildInboxResponse(items, opts, today, { targetUser, scope, isMgr });
}

async function queryInboxCount(user) {
  const data = await queryInbox(user, { scope: 'mine', filter: 'all', limit: 10000, offset: 0 });
  if (data.error) return data;
  return {
    count: data.counts.all,
    overdue: data.counts.overdue,
    today: data.counts.today,
    approval: data.counts.approval,
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function loadInboxItemForUser(user, itemId) {
  const r = await query('SELECT * FROM inbox_items WHERE id = $1 AND active = TRUE', [itemId]);
  if (!r.rows.length) return { error: 'آیتم یافت نشد', status: 404 };
  const row = r.rows[0];
  const isMgr = isManagerRole(user.role);
  if (row.visibility === 'manager') {
    if (!isMgr) return { error: 'دسترسی مجاز نیست', status: 403 };
  } else if (row.owner !== user.username) {
    if (!isMgr) return { error: 'دسترسی مجاز نیست', status: 403 };
    const ok = await canManagerViewSubordinate(user.username, user.role, row.owner);
    if (!ok) return { error: 'دسترسی مجاز نیست', status: 403 };
  }
  return { row };
}

async function actionComplete(user, itemId) {
  const loaded = await loadInboxItemForUser(user, itemId);
  if (loaded.error) return loaded;
  const row = loaded.row;
  const meta = row.meta || {};

  if (row.action === 'task') {
    await query(`UPDATE tasks SET done = TRUE, done_at = NOW(), status = 'done', updated_at = NOW() WHERE id = $1`, [meta.taskId || row.source_id]);
    await deactivateInboxItem(row.id);
  } else if (row.action === 'week') {
    await query(`UPDATE week_entries SET done = TRUE, done_date = $2 WHERE id = $1`, [meta.weekId || row.source_id, todayJalaliStr()]);
    await deactivateInboxItem(row.id);
  } else if (row.action === 'notification') {
    await query('UPDATE notifications SET read = TRUE WHERE id = $1', [meta.notifId || row.source_id]);
    await deactivateInboxItem(row.id);
  } else if (row.action === 'trade_task') {
    await query(`UPDATE trade_tasks SET status = 'done', updated_at = NOW() WHERE id = $1`, [meta.taskId || row.source_id]);
    await deactivateInboxItem(row.id);
  } else {
    return { error: 'تکمیل سریع برای این نوع پشتیبانی نمی‌شود', status: 400 };
  }
  return { ok: true };
}

async function actionSnooze(user, itemId, days) {
  const loaded = await loadInboxItemForUser(user, itemId);
  if (loaded.error) return loaded;
  const row = loaded.row;
  if ((row.snooze_count || 0) >= SNOOZE_MAX) {
    return { error: 'سقف به‌تعویق انداختن (۲ بار) پر شده — با مدیر هماهنگ کنید', status: 400 };
  }
  const d = Math.min(Math.max(parseInt(days, 10) || 1, 1), 7);
  const until = addJalaliDays(todayJalaliStr(), d);
  await query(
    `UPDATE inbox_items SET snoozed_until = $2, snooze_count = COALESCE(snooze_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
    [row.id, until]
  );
  return { ok: true, snoozedUntil: until, snoozeCount: (row.snooze_count || 0) + 1 };
}

async function actionPanic(user, body) {
  if (!isManagerRole(user.role)) return { error: 'فقط مدیر', status: 403 };
  const fromOwner = body.fromOwner;
  const toOwner = body.toOwner;
  if (!fromOwner || !toOwner || fromOwner === toOwner) {
    return { error: 'مبدأ و مقصد الزامی است', status: 400 };
  }
  const okFrom = await canManagerViewSubordinate(user.username, user.role, fromOwner);
  const okTo = await canManagerViewSubordinate(user.username, user.role, toOwner);
  if (!okFrom || !okTo) return { error: 'فقط بین زیرمجموعه‌های مجاز خودتان', status: 403 };

  const taskR = await query(
    `UPDATE tasks SET owner = $1, updated_at = NOW() WHERE owner = $2 AND done = FALSE RETURNING id`,
    [toOwner, fromOwner]
  );
  const weekR = await query(
    `UPDATE week_entries SET added_by = $1, updated_at = NOW() WHERE added_by = $2 AND done = FALSE RETURNING id`,
    [toOwner, fromOwner]
  );
  for (const t of taskR.rows) await syncTask(t.id);
  for (const w of weekR.rows) await syncWeekEntry(w.id);
  await query(
    `UPDATE inbox_items SET owner = $1, updated_at = NOW() WHERE owner = $2 AND visibility = 'owner' AND active = TRUE`,
    [toOwner, fromOwner]
  );

  return {
    ok: true,
    reassigned: { tasks: taskR.rows.length, weeks: weekR.rows.length },
  };
}

function isApprovalItem(item) {
  return item.action === 'proforma_approve' || item.action === 'hr_leave' || item.action === 'letter_sign';
}

function isThisWeekItem(item, today) {
  if (!item.dueAt || item.urgency === 'overdue' || item.urgency === 'today') return false;
  if (compareJalali(item.dueAt, today) <= 0) return false;
  return jalaliDaysDiff(today, item.dueAt) <= 7;
}

function summarizeInboxItems(items, today) {
  return {
    total: items.length,
    overdue: items.filter(function (i) { return i.urgency === 'overdue'; }).length,
    today: items.filter(function (i) { return i.urgency === 'today'; }).length,
    approval: items.filter(isApprovalItem).length,
    week: items.filter(function (i) { return isThisWeekItem(i, today); }).length,
  };
}

function centerNameFromKey(key, fallbackTitle) {
  if (!key || key === '_none') {
    const fromTitle = titleCenterName(fallbackTitle);
    if (fromTitle) return fromTitle;
    return 'سایر / بدون مرکز';
  }
  const fromTitle = titleCenterName(fallbackTitle);
  if (fromTitle) return fromTitle;
  return fallbackLabel(key);
}

async function groupItemsByCenterAsync(items) {
  const enriched = await enrichInboxItems(items || []);
  const map = {};
  enriched.forEach(function (item) {
    const key = item.centerKey || '_none';
    if (!map[key]) {
      map[key] = {
        centerKey: key === '_none' ? null : key,
        centerName: item.centerName || centerNameFromKey(key, item.title),
        items: [],
        maxSeverity: 0,
        overdueCount: 0,
      };
    }
    map[key].items.push(item);
    if (item.severityScore > map[key].maxSeverity) map[key].maxSeverity = item.severityScore;
    if (item.urgency === 'overdue') map[key].overdueCount += 1;
  });
  return Object.values(map).sort(function (a, b) {
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    return b.maxSeverity - a.maxSeverity;
  });
}

function groupItemsByCenter(items) {
  const map = {};
  items.forEach(function (item) {
    const key = item.centerKey || '_none';
    if (!map[key]) {
      map[key] = {
        centerKey: key === '_none' ? null : key,
        centerName: centerNameFromKey(key, item.title),
        items: [],
        maxSeverity: 0,
        overdueCount: 0,
      };
    }
    if (item.centerName && map[key].centerName === centerNameFromKey(key, item.title)) {
      map[key].centerName = item.centerName;
    }
    map[key].items.push(item);
    if (item.severityScore > map[key].maxSeverity) map[key].maxSeverity = item.severityScore;
    if (item.urgency === 'overdue') map[key].overdueCount += 1;
  });
  return Object.values(map).sort(function (a, b) {
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    return b.maxSeverity - a.maxSeverity;
  });
}

async function queryInboxMatrix(user) {
  if (!isManagerRole(user.role)) return { error: 'فقط مدیر', status: 403 };
  const today = todayJalaliStr();
  const subs = await listAuthorizedSubordinates(user.username, user.role);
  const rows = [];

  const mineData = await queryInbox(user, {
    scope: 'mine', filter: 'all', limit: 5000, offset: 0, today,
  });
  if (mineData.error) return mineData;
  rows.push(Object.assign({
    username: user.username,
    displayName: user.display_name || user.username,
    isSelf: true,
  }, summarizeInboxItems(mineData.items || [], today)));

  for (const username of subs) {
    const data = await queryInbox(user, {
      scope: 'team', owner: username, filter: 'all', limit: 5000, offset: 0, today,
    });
    if (data.error) continue;
    rows.push(Object.assign({
      username,
      displayName: username,
      isSelf: false,
    }, summarizeInboxItems(data.items || [], today)));
  }

  rows.sort(function (a, b) {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    return b.total - a.total;
  });

  return { rows, today, columns: ['overdue', 'today', 'approval', 'week'] };
}

async function queryInboxTreeTeam(user) {
  if (!isManagerRole(user.role)) return { error: 'فقط مدیر', status: 403 };
  const today = todayJalaliStr();
  const subs = await listAuthorizedSubordinates(user.username, user.role);
  const experts = [];
  const users = [user.username].concat(subs.filter(function (u) { return u !== user.username; }));

  for (const username of users) {
    const data = await queryInbox(user, {
      scope: username === user.username ? 'mine' : 'team',
      owner: username === user.username ? undefined : username,
      filter: 'all', limit: 5000, offset: 0, today,
    });
    if (data.error) continue;
    experts.push({
      username,
      displayName: username,
      centers: await groupItemsByCenterAsync(data.items || []),
      stats: summarizeInboxItems(data.items || [], today),
      isSelf: username === user.username,
    });
  }

  experts.sort(function (a, b) {
    return (b.stats.overdue || 0) - (a.stats.overdue || 0);
  });

  return { experts, today };
}

module.exports = {
  MANAGER_POOL,
  SNOOZE_MAX,
  TYPE_LABELS,
  rebuildAll,
  syncTask,
  syncWeekEntry,
  syncLeave,
  syncPayrollVariable,
  syncNotification,
  syncProforma,
  syncFollowupCenter,
  deactivateInboxItem,
  deactivateBySource,
  queryInbox,
  queryInboxCount,
  canManagerViewSubordinate,
  listAuthorizedSubordinates,
  actionComplete,
  actionSnooze,
  actionPanic,
  computeSeverity,
  rowToApiItem,
  queryInboxMatrix,
  queryInboxTreeTeam,
  groupItemsByCenter,
  isApprovalItem,
  isThisWeekItem,
};

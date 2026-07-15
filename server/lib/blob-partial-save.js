'use strict';

/**
 * Non-destructive upserts for slim PUT/PATCH — one entity per row, no table wipes.
 */

async function upsertEvents(client, events, user) {
  if (!events || !Array.isArray(events)) return;
  for (const ev of events) {
    if (!ev || ev.id === undefined) continue;
    await client.query(
      `INSERT INTO app_events (id, title, description, start_ms, all_day, color, owner, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         start_ms = EXCLUDED.start_ms, all_day = EXCLUDED.all_day,
         color = EXCLUDED.color, owner = EXCLUDED.owner,
         updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [ev.id, ev.title || '', ev.desc || ev.description || '', ev.startMs || 0, !!ev.allDay, ev.color || null, ev.owner || null, user]
    );
  }
}

async function upsertCallLog(client, callLog, user) {
  if (!callLog || !Array.isArray(callLog)) return;
  for (const l of callLog) {
    if (!l || l.id === undefined) continue;
    await client.query(
      `INSERT INTO call_log (id, date, username, count, note, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, username = EXCLUDED.username, count = EXCLUDED.count,
         note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [l.id, l.date || '', l.userId || l.username || user, l.count || 0, l.note || null, user]
    );
  }
}

async function upsertVisitLog(client, visitLog, user) {
  if (!visitLog || !Array.isArray(visitLog)) return;
  for (const l of visitLog) {
    if (!l || l.id === undefined) continue;
    const note = l.centerName
      ? (l.note ? l.centerName + ' — ' + l.note : l.centerName)
      : (l.note || null);
    await client.query(
      `INSERT INTO visit_log (id, date, username, count, note, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, username = EXCLUDED.username, count = EXCLUDED.count,
         note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [l.id, l.date || '', l.userId || l.username || user, l.count || 1, note, user]
    );
  }
}

async function upsertSalesLog(client, salesLog, user) {
  if (!salesLog || !Array.isArray(salesLog)) return;
  for (const l of salesLog) {
    if (!l || l.id === undefined) continue;
    await client.query(
      `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, username = EXCLUDED.username, center_name = EXCLUDED.center_name,
         center_key = EXCLUDED.center_key, amount = EXCLUDED.amount, is_cash = EXCLUDED.is_cash,
         updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [
        l.id, l.date || '', l.userId || l.username || user,
        l.centerName || '', l.centerKey || null,
        l.amount || 0, !!l.isCash, user,
      ]
    );
  }
}

async function upsertMissionLog(client, missionLog, user) {
  if (!missionLog || !Array.isArray(missionLog)) return;
  for (const m of missionLog) {
    if (!m || !m.userId || !m.month) continue;
    await client.query('DELETE FROM mission_log WHERE username = $1 AND month = $2', [m.userId, m.month]);
    await client.query(
      `INSERT INTO mission_log (id, username, month, done, note, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [m.id || Date.now(), m.userId, m.month, !!m.done, m.note || null, user]
    );
  }
}

async function upsertKpiHistory(client, kpiHistory, user) {
  if (!kpiHistory || !Array.isArray(kpiHistory)) return;
  for (const s of kpiHistory) {
    if (!s || !s.userId || !s.month) continue;
    await client.query(
      `INSERT INTO kpi_history (username, month, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (username, month) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [s.userId, s.month, JSON.stringify(s)]
    );
  }
}

async function upsertCenterExtras(client, extra, user) {
  if (!extra || !Array.isArray(extra)) return;
  for (const c of extra) {
    if (!c || !c.id) continue;
    await client.query(
      `INSERT INTO center_extras (id, row_num, name, potential, type, lead, province_id, owner, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
       ON CONFLICT (id) DO UPDATE SET
         row_num = EXCLUDED.row_num, name = EXCLUDED.name, potential = EXCLUDED.potential,
         type = EXCLUDED.type, lead = EXCLUDED.lead, province_id = EXCLUDED.province_id,
         owner = EXCLUDED.owner, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [c.id, c.row || 0, c.name || '', c.potential || 1, c.type || null, c.lead || 'سرنخ', c.province_id || c.province || '', c.owner || null, user]
    );
  }
}

async function applySlimCollectionUpserts(client, body, user) {
  const {
    events, callLog, visitLog, salesLog, missionLog, kpiHistory, extra,
  } = body || {};
  await upsertEvents(client, events, user);
  await upsertCallLog(client, callLog, user);
  await upsertVisitLog(client, visitLog, user);
  await upsertSalesLog(client, salesLog, user);
  await upsertMissionLog(client, missionLog, user);
  await upsertKpiHistory(client, kpiHistory, user);
  await upsertCenterExtras(client, extra, user);
}

module.exports = {
  upsertEvents,
  upsertCallLog,
  upsertVisitLog,
  upsertSalesLog,
  upsertMissionLog,
  upsertKpiHistory,
  upsertCenterExtras,
  applySlimCollectionUpserts,
};

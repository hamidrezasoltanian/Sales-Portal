'use strict';

const { parseJalali, formatJalali } = require('./jalali-mini');

const crypto = require('crypto');
const { todayJalaliStr, p2 } = require('./jalali-mini');

const VISIT_ACTIONS = new Set(['visit', 'meeting', 'committee']);

const ACTION_LABELS = {
  call: '📞 تماس',
  visit: '🤝 ملاقات',
  price_send: '📄 ارسال قیمت',
  sample_send: '🧪 ارسال نمونه',
  committee: '🏛 پیگیری کمیته',
  meeting: '👥 جلسه',
  followup: '🔄 پیگیری',
};

function newInteractionId() {
  return crypto.randomUUID();
}

function logTypeForAction(actionType) {
  return VISIT_ACTIONS.has(actionType) ? 'visit' : 'call';
}

function actLabel(actionType) {
  return ACTION_LABELS[actionType] || ACTION_LABELS.call;
}

async function findByIdempotency(client, key) {
  const r = await client.query(
    'SELECT * FROM center_interactions WHERE idempotency_key = $1',
    [key]
  );
  return r.rows[0] || null;
}

async function appendCenterNote(client, centerKey, note, username) {
  const existing = await client.query(
    'SELECT notes FROM center_notes WHERE center_key = $1',
    [centerKey]
  );
  let notes = existing.rows.length ? (existing.rows[0].notes || []) : [];
  if (!Array.isArray(notes)) notes = [];
  notes.push(note);
  await client.query(
    `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (center_key) DO UPDATE
       SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = $3`,
    [centerKey, JSON.stringify(notes), username]
  );
  return notes.length - 1;
}

async function patchCenterEdit(client, centerKey, field, val, username) {
  const _ts = Date.now();
  let patchVal = val;
  if (field === 'followupDate' && patchVal) {
    const j = parseJalali(patchVal);
    if (j) patchVal = formatJalali(j);
  }
  const patch = { [field]: patchVal, _ts };
  if (field === 'status' || field === 'lead' || field === 'potential') patch._lastActivity = _ts;
  if (field === 'status') patch._statusChangedTs = _ts;

  await client.query(
    `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (center_key) DO UPDATE
       SET data = center_edits.data || EXCLUDED.data,
           updated_at = NOW(),
           updated_by = $3`,
    [centerKey, JSON.stringify(patch), username]
  );

  const valStr = patchVal !== undefined && patchVal !== null ? JSON.stringify(patchVal) : null;
  await client.query(
    'INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, $3, $4)',
    [username, centerKey, field, valStr]
  );
  return _ts;
}

async function insertActivityLog(client, logType, entry, username) {
  const table = logType === 'visit' ? 'visit_log' : logType === 'sales' ? 'sales_log' : 'call_log';
  if (table === 'sales_log') {
    await client.query(
      `INSERT INTO sales_log (id, date, username, center_name, center_key, amount, is_cash, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, username = EXCLUDED.username, center_name = EXCLUDED.center_name,
         center_key = EXCLUDED.center_key, amount = EXCLUDED.amount, is_cash = EXCLUDED.is_cash,
         updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [
        entry.id, entry.date, entry.userId || username, entry.centerName || '',
        entry.centerKey || null, entry.amount || 0, !!entry.isCash, username,
      ]
    );
    return;
  }
  const note = logType === 'visit' && entry.centerName
    ? (entry.note ? entry.centerName + ' — ' + entry.note : entry.centerName)
    : (entry.note || null);
  await client.query(
    `INSERT INTO ${table} (id, date, username, count, note, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (id) DO UPDATE SET
       date = EXCLUDED.date, username = EXCLUDED.username, count = EXCLUDED.count,
       note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [entry.id, entry.date, entry.userId || username, entry.count || 1, note, username]
  );
}

async function updateWeekEntryDone(client, weekEntryId, fields) {
  const rowRes = await client.query(
    'SELECT key, value, rec_key FROM week_entries WHERE id = $1',
    [weekEntryId]
  );
  if (!rowRes.rows.length) {
    const err = new Error('ورودی برنامه هفته یافت نشد');
    err.status = 404;
    throw err;
  }
  const currentVal = rowRes.rows[0].value || {};
  const updatedVal = Object.assign({}, currentVal, {
    doneResult: fields.doneResult != null ? fields.doneResult : currentVal.doneResult,
    doneNote: fields.doneNote != null ? fields.doneNote : currentVal.doneNote,
    doneAmount: fields.doneAmount != null ? fields.doneAmount : currentVal.doneAmount,
  });
  await client.query(
    `UPDATE week_entries
     SET done = $1, done_date = $2, value = $3::jsonb, updated_at = NOW()
     WHERE id = $4`,
    [!!fields.done, fields.doneDate || null, JSON.stringify(updatedVal), weekEntryId]
  );
  return rowRes.rows[0];
}

function buildQuickNoteText(actionType, resultText, note) {
  const label = actLabel(actionType);
  if (resultText) return '[' + label + '] نتیجه: ' + resultText + (note ? '\n' + note : '');
  return '[' + label + '] ' + (note || '');
}

function buildDoneNoteText(actionType, outcome, note, amount, lostReason, nextDate, pfNo) {
  const pfx = (pfNo ? '📄 PF ' + pfNo + ' — ' : '')
    + actLabel(actionType) + ' انجام شد: ';
  let outcomeText = '';
  if (outcome === 'won') {
    outcomeText = 'قرارداد / فروش بسته شد' + (amount > 0 ? ' (مبلغ: ' + amount + ' میلیون تومان)' : '');
  } else if (outcome === 'inactive') {
    outcomeText = 'غیرفعال / رد شد' + (lostReason ? ' (دلیل: ' + lostReason + ')' : '');
  } else {
    outcomeText = 'نیاز به پیگیری دارد' + (nextDate ? ' (تاریخ پیگیری بعدی: ' + nextDate + ')' : '');
  }
  return pfx + outcomeText + (note ? '\nتوضیح: ' + note : '');
}

function rowToResponse(row) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    centerKey: row.center_key,
    username: row.username,
    occurredDate: row.occurred_date,
    actionType: row.action_type,
    mode: row.mode,
    outcome: row.outcome,
    resultText: row.result_text,
    note: row.note,
    followupDate: row.followup_date,
    weekEntryId: row.week_entry_id,
    correctsInteractionId: row.corrects_interaction_id,
    payload: row.payload || {},
    projections: row.projections || {},
    createdAt: row.created_at,
  };
}

/**
 * Create interaction inside an open transaction client.
 * Caller must BEGIN/COMMIT.
 */
async function createInteraction(client, opts) {
  const {
    centerKey,
    username,
    displayName,
    idempotencyKey,
    body,
  } = opts;

  const existing = await findByIdempotency(client, idempotencyKey);
  if (existing) {
    return { replay: true, interaction: rowToResponse(existing) };
  }

  const mode = body.mode || 'quick';
  const actionType = body.actionType || 'call';
  const occurredDate = body.occurredDate || todayJalaliStr();
  const interactionId = newInteractionId();
  const projections = {};
  const logId = body.logId || Date.now();

  let noteText = '';
  let outcome = body.outcome || null;
  const resultText = (body.result || body.resultText || '').trim();
  const note = (body.note || '').trim();
  const followupDate = body.followupDate || null;
  const weekEntryId = body.weekEntryId || null;
  const correctsInteractionId = body.correctsInteractionId || null;
  const centerName = body.centerName || '';
  const lostReason = body.lostReason || '';
  const amount = parseFloat(body.amount) || 0;
  const pfNo = body.pfNo || '';

  if (mode === 'quick') {
    noteText = buildQuickNoteText(actionType, resultText, note);
  } else if (mode === 'done') {
    noteText = buildDoneNoteText(actionType, outcome, note, amount, lostReason, followupDate, pfNo);
  } else if (mode === 'correction' || mode === 'void') {
    noteText = note || ('اصلاح تعامل ' + (correctsInteractionId || ''));
  } else {
    noteText = note || resultText;
  }

  const noteObj = {
    text: noteText,
    date: occurredDate,
    user: displayName || username,
    by: username,
    ts: new Date().toISOString(),
    interactionId,
  };
  const noteIndex = await appendCenterNote(client, centerKey, noteObj, username);
  projections.noteIndex = noteIndex;
  projections.noteText = noteText;

  const logType = logTypeForAction(actionType);
  const logEntry = {
    id: logId,
    date: occurredDate,
    userId: username,
    centerName,
    centerKey,
    note: note || resultText,
    count: 1,
    outcome,
  };
  await insertActivityLog(client, logType, logEntry, username);
  projections[logType + 'LogId'] = logId;

  if (followupDate) {
    await patchCenterEdit(client, centerKey, 'followupDate', followupDate, username);
    projections.followupDate = followupDate;
  }

  if (mode === 'done' && weekEntryId) {
    await updateWeekEntryDone(client, weekEntryId, {
      done: true,
      doneDate: occurredDate,
      doneResult: outcome,
      doneNote: note,
      doneAmount: amount > 0 ? amount : null,
    });
    projections.weekEntryId = weekEntryId;

    await client.query(
      'INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, $3, $4)',
      [username, centerKey, actionType, JSON.stringify(outcome + (note ? ' — ' + note : ''))]
    );

    if (outcome === 'won') {
      await patchCenterEdit(client, centerKey, 'status', 'قرارداد بسته شد', username);
      if (amount > 0) {
        const saleId = logId + 1;
        await insertActivityLog(client, 'sales', {
          id: saleId,
          date: occurredDate,
          userId: username,
          centerName,
          centerKey,
          amount,
          isCash: false,
        }, username);
        projections.salesLogId = saleId;
      }
    } else if (outcome === 'inactive') {
      if (lostReason) {
        const cur = await client.query('SELECT data FROM center_edits WHERE center_key = $1', [centerKey]);
        const data = cur.rows.length ? (cur.rows[0].data || {}) : {};
        data.lostReason = lostReason;
        await client.query(
          `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
           VALUES ($1, $2::jsonb, NOW(), $3)
           ON CONFLICT (center_key) DO UPDATE SET data = center_edits.data || EXCLUDED.data, updated_at = NOW(), updated_by = $3`,
          [centerKey, JSON.stringify({ lostReason, _ts: Date.now() }), username]
        );
      }
      await patchCenterEdit(client, centerKey, 'status', 'غیرفعال', username);
    }
  }

  const payload = Object.assign({}, body, { centerName, logId });

  const ins = await client.query(
    `INSERT INTO center_interactions (
       id, idempotency_key, center_key, username, occurred_date,
       action_type, mode, outcome, result_text, note, followup_date,
       week_entry_id, corrects_interaction_id, payload, projections
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)
     RETURNING *`,
    [
      interactionId,
      idempotencyKey,
      centerKey,
      username,
      occurredDate,
      actionType,
      mode,
      outcome,
      resultText || null,
      note || null,
      followupDate,
      weekEntryId,
      correctsInteractionId,
      JSON.stringify(payload),
      JSON.stringify(projections),
    ]
  );

  return { replay: false, interaction: rowToResponse(ins.rows[0]) };
}

module.exports = {
  createInteraction,
  rowToResponse,
  findByIdempotency,
  logTypeForAction,
  ACTION_LABELS,
};

'use strict';

const { query } = require('../db');

const ENTITY_LABELS = {
  center: 'مرکز',
  task: 'وظیفه',
  hcp: 'پزشک/مخاطب',
  center_note: 'یادداشت مرکز',
  center_deal: 'فرصت فروش',
  center_file: 'فایل مرکز',
  hcp_affiliation: 'ارتباط پزشک-مرکز',
};

const SENSITIVE_TYPES = new Set(['center_file', 'center_note', 'center', 'hcp']);

function entityLabel(type) {
  return ENTITY_LABELS[type] || type;
}

async function logDeletionEvent(deletedBy, entityType, entityId, centerKey, title) {
  try {
    const rkey = centerKey || entityType + ':' + entityId;
    await query(
      `INSERT INTO change_log (at, by, rkey, field, val)
       VALUES (NOW(), $1, $2, '_deleted', $3::jsonb)`,
      [
        deletedBy || 'system',
        rkey,
        JSON.stringify({ entityType, entityId, title: title || '' }),
      ]
    );
  } catch (_) {}
}

async function logRestoreEvent(restoredBy, entityType, entityId, centerKey, title) {
  try {
    const rkey = centerKey || entityType + ':' + entityId;
    await query(
      `INSERT INTO change_log (at, by, rkey, field, val)
       VALUES (NOW(), $1, $2, '_restored', $3::jsonb)`,
      [
        restoredBy || 'system',
        rkey,
        JSON.stringify({ entityType, entityId, title: title || '' }),
      ]
    );
  } catch (_) {}
}

/**
 * Record a deletion in deleted_entities (audit + trash listing).
 */
async function recordDeletion(opts) {
  const {
    entityType,
    entityId,
    centerKey = null,
    title = '',
    payload = {},
    deletedBy = null,
    deleteReason = null,
  } = opts || {};
  if (!entityType || entityId == null || entityId === '') {
    throw new Error('entityType و entityId الزامی است');
  }
  const r = await query(
    `INSERT INTO deleted_entities
       (entity_type, entity_id, center_key, title, payload, deleted_by, delete_reason)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [
      entityType,
      String(entityId),
      centerKey ? String(centerKey) : null,
      title ? String(title).slice(0, 500) : null,
      JSON.stringify(payload || {}),
      deletedBy,
      deleteReason,
    ]
  );
  await logDeletionEvent(deletedBy, entityType, entityId, centerKey, title);
  return r.rows[0];
}

async function softDeleteTask(taskRow, deletedBy) {
  await query(
    `UPDATE tasks SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [taskRow.id, deletedBy]
  );
  return recordDeletion({
    entityType: 'task',
    entityId: taskRow.id,
    centerKey: taskRow.center_key,
    title: taskRow.title,
    payload: { row: taskRow },
    deletedBy,
  });
}

async function softDeleteHcp(hcpRow, deletedBy) {
  await query(
    `UPDATE healthcare_professionals
     SET deleted_at = NOW(), is_active = FALSE, updated_by = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [hcpRow.id, deletedBy]
  );
  const affR = await query('SELECT * FROM hcp_affiliations WHERE hcp_id = $1', [hcpRow.id]);
  return recordDeletion({
    entityType: 'hcp',
    entityId: hcpRow.id,
    title: hcpRow.name,
    payload: { row: hcpRow, affiliations: affR.rows },
    deletedBy,
  });
}

async function softDeleteDeal(dealRow, deletedBy) {
  await query(
    `UPDATE center_deals SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [dealRow.id, deletedBy]
  );
  return recordDeletion({
    entityType: 'center_deal',
    entityId: dealRow.id,
    centerKey: dealRow.center_key,
    title: dealRow.title,
    payload: { row: dealRow },
    deletedBy,
  });
}

async function softDeleteCenterFile(fileRow, deletedBy) {
  await query(
    `UPDATE center_files SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [fileRow.id, deletedBy]
  );
  const meta = Object.assign({}, fileRow);
  delete meta.data;
  return recordDeletion({
    entityType: 'center_file',
    entityId: String(fileRow.id),
    centerKey: fileRow.center_key,
    title: fileRow.filename,
    payload: { row: meta },
    deletedBy,
  });
}

async function softDeleteCenterNote(centerKey, noteIndex, noteObj, deletedBy) {
  const tomb = Object.assign({}, noteObj, {
    _deletedAt: new Date().toISOString(),
    _deletedBy: deletedBy,
    _deletedIndex: noteIndex,
  });
  const existing = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
  let notes = existing.rows.length ? (existing.rows[0].notes || []) : [];
  if (!Array.isArray(notes)) notes = [];
  if (noteIndex < 0 || noteIndex >= notes.length) throw new Error('یادداشت یافت نشد');
  notes[noteIndex] = tomb;
  await query(
    `INSERT INTO center_notes (center_key, notes, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (center_key) DO UPDATE
       SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [centerKey, JSON.stringify(notes), deletedBy]
  );
  const title = (noteObj.text || noteObj.note || noteObj.body || '').toString().slice(0, 80);
  return recordDeletion({
    entityType: 'center_note',
    entityId: centerKey + '::' + noteIndex,
    centerKey,
    title: title || 'یادداشت',
    payload: { centerKey, noteIndex, note: tomb },
    deletedBy,
  });
}

function filterActiveNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.filter(function (n) { return n && !n._deletedAt; });
}

/** Client sends index among active notes; map to raw array index (includes tombstones). */
function activeNoteIndexToRaw(notes, activeIndex) {
  if (!Array.isArray(notes) || activeIndex < 0 || isNaN(activeIndex)) return -1;
  var active = -1;
  for (var i = 0; i < notes.length; i++) {
    if (!notes[i] || notes[i]._deletedAt) continue;
    active++;
    if (active === activeIndex) return i;
  }
  return -1;
}

function notesWithTombstones(notes) {
  if (!Array.isArray(notes)) return [];
  return notes;
}

async function softDeleteCenter(payload, deletedBy) {
  const {
    centerKey,
    rtype,
    id,
    name,
    provinceId,
    isExtra,
    extraId,
    centerRecord,
    masterBefore,
  } = payload;

  const editsR = await query('SELECT data FROM center_edits WHERE center_key = $1', [centerKey]).catch(function () { return { rows: [] }; });
  const notesR = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]).catch(function () { return { rows: [] }; });
  const dealsR = await query('SELECT COUNT(*)::int AS c FROM center_deals WHERE center_key = $1 AND deleted_at IS NULL', [centerKey]).catch(function () { return { rows: [{ c: 0 }] }; });
  const filesR = await query('SELECT COUNT(*)::int AS c FROM center_files WHERE center_key = $1 AND deleted_at IS NULL', [centerKey]).catch(function () { return { rows: [{ c: 0 }] }; });

  const snap = {
    centerKey,
    rtype,
    id,
    name,
    provinceId: provinceId || null,
    isExtra: !!isExtra,
    extraId: extraId || null,
    centerRecord: centerRecord || null,
    masterBefore: masterBefore || null,
    edits: editsR.rows[0] ? editsR.rows[0].data : null,
    notes: notesR.rows[0] ? notesR.rows[0].notes : null,
    dealsCount: dealsR.rows[0] ? dealsR.rows[0].c : 0,
    filesCount: filesR.rows[0] ? filesR.rows[0].c : 0,
  };

  if (isExtra && extraId) {
    await query('DELETE FROM center_extras WHERE id = $1', [extraId]);
  }
  // master list update is done by caller (data.js) after softDeleteCenter returns

  if (editsR.rows.length) {
    const data = Object.assign({}, editsR.rows[0].data || {}, { _deletedAt: new Date().toISOString(), _deletedBy: deletedBy });
    await query(
      `UPDATE center_edits SET data = $2::jsonb, updated_at = NOW(), updated_by = $3 WHERE center_key = $1`,
      [centerKey, JSON.stringify(data), deletedBy]
    );
  }

  return recordDeletion({
    entityType: 'center',
    entityId: centerKey,
    centerKey,
    title: name || centerKey,
    payload: snap,
    deletedBy,
  });
}

async function listTrash(opts) {
  const entityType = opts && opts.entityType;
  const limit = Math.min(Math.max(parseInt(opts && opts.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(opts && opts.offset, 10) || 0, 0);
  const params = [];
  let sql = `SELECT id, entity_type, entity_id, center_key, title, deleted_at, deleted_by, delete_reason
             FROM deleted_entities
             WHERE restored_at IS NULL AND purged_at IS NULL`;
  if (entityType) {
    params.push(entityType);
    sql += ` AND entity_type = $${params.length}`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY deleted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const r = await query(sql, params);
  return r.rows.map(function (row) {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      centerKey: row.center_key,
      title: row.title,
      label: entityLabel(row.entity_type),
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
      deleteReason: row.delete_reason,
      sensitive: SENSITIVE_TYPES.has(row.entity_type),
    };
  });
}

async function getTrashItem(id) {
  const r = await query(
    `SELECT * FROM deleted_entities WHERE id = $1 AND restored_at IS NULL AND purged_at IS NULL`,
    [id]
  );
  return r.rows[0] || null;
}

async function restoreTrashItem(trashId, restoredBy) {
  const row = await query('SELECT * FROM deleted_entities WHERE id = $1', [trashId]);
  if (!row.rows.length) throw new Error('رکورد سطل زباله یافت نشد');
  const item = row.rows[0];
  if (item.restored_at) throw new Error('قبلاً بازیابی شده');
  if (item.purged_at) throw new Error('برای همیشه حذف شده');

  const payload = item.payload || {};
  const type = item.entity_type;

  if (type === 'task') {
    const tid = item.entity_id;
    await query(
      `UPDATE tasks SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1`,
      [tid]
    );
  } else if (type === 'hcp') {
    await query(
      `UPDATE healthcare_professionals SET deleted_at = NULL, is_active = TRUE, updated_at = NOW() WHERE id = $1`,
      [item.entity_id]
    );
  } else if (type === 'center_deal') {
    await query(
      `UPDATE center_deals SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1`,
      [item.entity_id]
    );
  } else if (type === 'center_file') {
    await query(
      `UPDATE center_files SET deleted_at = NULL, deleted_by = NULL WHERE id = $1`,
      [parseInt(item.entity_id, 10)]
    );
  } else if (type === 'center_note') {
    const centerKey = payload.centerKey;
    let noteIndex = payload.noteIndex;
    const existing = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
    if (!existing.rows.length) throw new Error('یادداشت‌های مرکز یافت نشد');
    let notes = existing.rows[0].notes || [];
    if (!Array.isArray(notes)) notes = [];
    if (noteIndex < 0 || noteIndex >= notes.length) throw new Error('یادداشت یافت نشد');
    const n = Object.assign({}, notes[noteIndex]);
    delete n._deletedAt;
    delete n._deletedBy;
    delete n._deletedIndex;
    notes[noteIndex] = n;
    await query(
      `UPDATE center_notes SET notes = $2::jsonb, updated_at = NOW(), updated_by = $3 WHERE center_key = $1`,
      [centerKey, JSON.stringify(notes), restoredBy]
    );
  } else if (type === 'center') {
    const snap = payload;
    if (snap.masterBefore) {
      await query(
        `INSERT INTO centers_master (key, data, updated_at) VALUES ('CENTERS', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(snap.masterBefore.CENTERS)]
      );
      await query(
        `INSERT INTO centers_master (key, data, updated_at) VALUES ('PC_RAW', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(snap.masterBefore.PC_RAW)]
      );
    }
    if (snap.isExtra && snap.centerRecord) {
      const c = snap.centerRecord;
      await query(
        `INSERT INTO center_extras (id, row_num, province_id, name, owner, data, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (id) DO NOTHING`,
        [snap.extraId || c.id, c.row || 0, snap.provinceId, c.name || snap.name, c.owner || null, JSON.stringify(c)]
      ).catch(function () {});
    }
    const editsR = await query('SELECT data FROM center_edits WHERE center_key = $1', [snap.centerKey]);
    if (editsR.rows.length) {
      const data = Object.assign({}, editsR.rows[0].data || {});
      delete data._deletedAt;
      delete data._deletedBy;
      await query(
        `UPDATE center_edits SET data = $2::jsonb, updated_at = NOW(), updated_by = $3 WHERE center_key = $1`,
        [snap.centerKey, JSON.stringify(data), restoredBy]
      );
    }
  } else {
    throw new Error('نوع موجودیت پشتیبانی نمی‌شود: ' + type);
  }

  await query(
    `UPDATE deleted_entities SET restored_at = NOW(), restored_by = $2 WHERE id = $1`,
    [trashId, restoredBy]
  );
  await logRestoreEvent(restoredBy, type, item.entity_id, item.center_key, item.title);
  return { ok: true, entityType: type, entityId: item.entity_id };
}

async function purgeTrashItem(trashId, purgedBy) {
  const row = await query('SELECT * FROM deleted_entities WHERE id = $1', [trashId]);
  if (!row.rows.length) throw new Error('رکورد یافت نشد');
  const item = row.rows[0];
  if (item.restored_at) throw new Error('رکورد بازیابی شده — حذف دائمی مجاز نیست');
  if (item.purged_at) throw new Error('قبلاً حذف دائمی شده');

  const type = item.entity_type;
  if (type === 'task') {
    await query('DELETE FROM tasks WHERE id = $1', [item.entity_id]);
  } else if (type === 'hcp') {
    await query('DELETE FROM healthcare_professionals WHERE id = $1', [item.entity_id]);
  } else if (type === 'center_deal') {
    await query('DELETE FROM center_deals WHERE id = $1', [item.entity_id]);
  } else if (type === 'center_file') {
    await query('DELETE FROM center_files WHERE id = $1', [parseInt(item.entity_id, 10)]);
  } else if (type === 'center_note') {
    const payload = item.payload || {};
    const centerKey = payload.centerKey;
    const noteIndex = payload.noteIndex;
    const existing = await query('SELECT notes FROM center_notes WHERE center_key = $1', [centerKey]);
    if (existing.rows.length) {
      let notes = existing.rows[0].notes || [];
      if (Array.isArray(notes) && noteIndex >= 0 && noteIndex < notes.length) {
        notes.splice(noteIndex, 1);
        await query('UPDATE center_notes SET notes = $2::jsonb WHERE center_key = $1', [centerKey, JSON.stringify(notes)]);
      }
    }
  }
  // center: master already removed; purge only marks audit row

  await query(
    `UPDATE deleted_entities SET purged_at = NOW(), purged_by = $2 WHERE id = $1`,
    [trashId, purgedBy]
  );
  return { ok: true };
}

module.exports = {
  ENTITY_LABELS,
  SENSITIVE_TYPES,
  entityLabel,
  recordDeletion,
  softDeleteTask,
  softDeleteHcp,
  softDeleteDeal,
  softDeleteCenterFile,
  softDeleteCenterNote,
  softDeleteCenter,
  filterActiveNotes,
  activeNoteIndexToRaw,
  notesWithTombstones,
  listTrash,
  getTrashItem,
  restoreTrashItem,
  purgeTrashItem,
};

'use strict';

const { query, pool } = require('../db');

const PROVINCE_MAP = {
  فارس: 'p1', اصفهان: 'p2', 'سیستان و بلوچستان': 'p3', مازندران: 'p4',
  'آذربایجان شرقی': 'p5', لرستان: 'p6', بوشهر: 'p7', گلستان: 'p8',
  'خراسان جنوبی': 'p9', 'چهارمحال و بختیاری': 'p10', اردبیل: 'p11',
  'خراسان رضوی': 'p12', یزد: 'p13', قم: 'p14', زنجان: 'p15', مرکزی: 'p16',
  گیلان: 'p17', 'خراسان شمالی': 'p18', ایلام: 'p19', خوزستان: 'p20',
  کرمانشاه: 'p21', 'آذربایجان غربی': 'p22', کرمان: 'p23', البرز: 'p24',
  همدان: 'p25', قزوین: 'p26', کردستان: 'p27', هرمزگان: 'p28',
  'کهگیلویه و بویراحمد': 'p29', سمنان: 'p30',
};
const PROV_ID_TO_NAME = Object.fromEntries(Object.entries(PROVINCE_MAP).map(([k, v]) => [v, k]));

const PROVINCES = Object.entries(PROVINCE_MAP).map(([name, id]) => ({ id, name }));

function normPersian(s) {
  return String(s || '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .trim();
}

function normalizeName(name) {
  return normPersian(name)
    .replace(/[\u200c\s.\-()]/g, '')
    .replace(/بیمارستان/g, '')
    .replace(/کلینیک/g, '')
    .replace(/دکتر/g, '')
    .replace(/مرکز/g, '')
    .replace(/درمانگاه/g, '')
    .toLowerCase();
}

function nameSimilarity(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (Math.min(left.length, right.length) < 5) return 0;
  if (left.includes(right) || right.includes(left)) return 85;
  return 0;
}

function addressSimilarity(a, b) {
  const left = normalizeName(a).slice(0, 40);
  const right = normalizeName(b).slice(0, 40);
  if (!left || !right || left.length < 8) return 0;
  if (left === right) return 90;
  if (left.includes(right) || right.includes(left)) return 75;
  return 0;
}

function getProvIdFromCenterKey(centerKey) {
  if (!centerKey || typeof centerKey !== 'string') return null;
  if (centerKey === 'center_tehran') return 'tehran';
  if (centerKey.startsWith('center_')) return 'tehran';
  if (centerKey.startsWith('pc_')) {
    const rest = centerKey.slice(3);
    const sep = rest.indexOf('||');
    if (sep > 0) {
      const pid = rest.slice(0, sep);
      if (/^p\d+$/.test(pid)) return pid;
    }
  }
  return null;
}

/** Detect province id from address text (Mizito often keys «تجهیزات پزشکی مرکزی» under p16). */
function detectProvinceFromAddress(address) {
  if (!address) return null;
  const addr = normPersian(address);
  for (const [name, id] of Object.entries(PROVINCE_MAP)) {
    const n = normPersian(name);
    if (addr.includes('استان ' + n) || addr.includes('استان' + n)) return id;
  }
  for (const [name, id] of Object.entries(PROVINCE_MAP)) {
    const n = normPersian(name);
    if (addr.includes('ایران ' + n) || addr.includes('ایران' + n)) return id;
  }
  return null;
}

function resolveOrphanProvince(orphan) {
  const keyProv = getProvIdFromCenterKey(orphan.center_key);
  const addrProv = detectProvinceFromAddress(orphan.data && orphan.data.address);
  const provinceMismatch = !!(keyProv && addrProv && keyProv !== addrProv && keyProv !== 'tehran');
  const searchProv = provinceMismatch ? addrProv : keyProv;
  return { keyProv, addrProv, provinceMismatch, searchProv };
}

function parseCenterKey(centerKey) {
  if (!centerKey) return null;
  if (centerKey.startsWith('center_')) return { type: 'center', id: centerKey.slice(7), centerKey };
  if (centerKey.startsWith('pc_')) return { type: 'pc', id: centerKey.slice(3), centerKey };
  return null;
}

function extractDisplayNameFromEdit(data, centerKey) {
  data = data || {};
  if (data.nameOverride) return normPersian(data.nameOverride);
  if (data.name) return normPersian(data.name);
  if (data.address) {
    const addr = normPersian(data.address);
    const bizTail = addr.match(/(تجهیزات\s*پزشکی\s*مرکزی[^،,\n]*)/);
    if (bizTail && bizTail[1].length > 8) return normPersian(bizTail[1]);
    const first = String(data.address).split(/[\n,،]/)[0].trim();
    if (first.length > 3) return normPersian(first);
  }
  const parsed = parseCenterKey(centerKey);
  return parsed ? parsed.id : centerKey;
}

function snapshotEdit(data) {
  data = data || {};
  return {
    status: data.status || '',
    owner: data.owner || '',
    lead: data.lead || '',
    potential: data.potential,
    followupDate: data.followupDate || '',
    address: (data.address || '').slice(0, 300),
    type: data.type || '',
    contactCount: Array.isArray(data.contacts) ? data.contacts.length : 0,
    _mizitoRow: data._mizitoRow || null,
  };
}

function buildMasterCatalog(centersMaster) {
  const CENTERS = centersMaster.CENTERS || [];
  const PC_RAW = centersMaster.PC_RAW || {};
  const keys = new Set(['center_tehran']);
  const masterList = [];

  CENTERS.forEach(function (c) {
    if (!c || !c.id) return;
    const key = 'center_' + c.id;
    keys.add(key);
    masterList.push({
      key,
      name: normPersian(c.name),
      provId: 'tehran',
      row: c.row,
    });
  });

  PROVINCES.forEach(function (p) {
    keys.add('pc_' + p.id);
    const pname = normPersian(p.name);
    const rawByName = PC_RAW[pname] || PC_RAW[p.name] || [];
    const rawById = PC_RAW[p.id] || [];
    const seenNames = {};
    rawByName.forEach(function (r) {
      const row = Array.isArray(r) ? r[0] : (r.row != null ? r.row : r[0]);
      const name = Array.isArray(r) ? r[1] : (r.name || r[1] || '');
      seenNames[normPersian(name)] = true;
      const id = (r && r.id) || (p.id + '||' + row);
      const key = 'pc_' + id;
      keys.add(key);
      masterList.push({ key, name: normPersian(name), provId: p.id, row });
    });
    rawById.forEach(function (r) {
      const name = Array.isArray(r) ? r[1] : (r.name || r[1] || '');
      if (seenNames[normPersian(name)]) return;
      const row = Array.isArray(r) ? r[0] : (r.row != null ? r.row : r[0]);
      const id = (r && r.id) || (p.id + '||' + row);
      const key = 'pc_' + id;
      keys.add(key);
      masterList.push({ key, name: normPersian(name), provId: p.id, row });
    });
  });

  return { keys, masterList };
}

async function loadCatalog(client) {
  const c = client || pool;
  const [masterR, editsR] = await Promise.all([
    c.query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')"),
    c.query('SELECT center_key, data FROM center_edits'),
  ]);
  const centersMaster = {};
  masterR.rows.forEach(function (r) { centersMaster[r.key] = r.data; });
  const { keys, masterList } = buildMasterCatalog(centersMaster);
  const orphanEdits = [];
  editsR.rows.forEach(function (r) {
    const k = r.center_key;
    if (keys.has(k)) return;
    if (!k.startsWith('center_') && !k.startsWith('pc_')) return;
    if (/^pc_p\d+$/.test(k)) return;
    const data = r.data || {};
    if (data._mergedInto || data._archived) return;
    orphanEdits.push({ center_key: k, data });
  });
  return { centersMaster, keys, masterList, orphanEdits };
}

function scoreOrphanToMaster(orphan, master, ctx) {
  ctx = ctx || {};
  const orphanName = extractDisplayNameFromEdit(orphan.data, orphan.center_key);
  let score = nameSimilarity(orphanName, master.name);
  if (score < 70) {
    score = Math.max(score, addressSimilarity(orphan.data.address, master.name));
  }
  const oProv = ctx.keyProv != null ? ctx.keyProv : getProvIdFromCenterKey(orphan.center_key);
  const addrProv = ctx.addrProv != null ? ctx.addrProv : detectProvinceFromAddress(orphan.data && orphan.data.address);
  if (ctx.provinceMismatch && addrProv && master.provId === addrProv) {
    score = Math.min(100, score + 5);
  } else if (oProv && master.provId && oProv !== master.provId && oProv !== 'tehran' && master.provId !== 'tehran') {
    score = Math.max(0, score - 15);
  }
  return score;
}

async function buildMergeSuggestions(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const minScore = opts.minScore != null ? opts.minScore : 70;
  const client = opts.client || pool;

  const { masterList, orphanEdits } = await loadCatalog(client);
  const suggestions = [];
  const usedSources = new Set();

  const mastersByProv = {};
  masterList.forEach(function (m) {
    const pid = m.provId || '_';
    if (!mastersByProv[pid]) mastersByProv[pid] = [];
    mastersByProv[pid].push(m);
  });

  orphanEdits.forEach(function (orphan) {
    if (usedSources.has(orphan.center_key)) return;
    const provCtx = resolveOrphanProvince(orphan);
    const searchProv = provCtx.searchProv || provCtx.keyProv || '_';
    const searchProvs = [];
    if (provCtx.provinceMismatch && provCtx.addrProv) searchProvs.push(provCtx.addrProv);
    if (provCtx.keyProv && searchProvs.indexOf(provCtx.keyProv) < 0) searchProvs.push(provCtx.keyProv);
    if (!searchProvs.length) searchProvs.push(searchProv);

    let best = null;
    let bestScore = 0;
    let reason = 'name_fuzzy';
    for (let p = 0; p < searchProvs.length; p++) {
      const candidates = mastersByProv[searchProvs[p]] || [];
      for (let i = 0; i < candidates.length; i++) {
        const m = candidates[i];
        const score = scoreOrphanToMaster(orphan, m, provCtx);
        if (score > bestScore) {
          bestScore = score;
          best = m;
          reason = score >= 95 ? 'name_exact' : (score >= 85 ? 'name_fuzzy' : 'address_fuzzy');
        }
      }
    }
    if (!best || bestScore < minScore) return;
    if (provCtx.provinceMismatch && provCtx.addrProv && best.provId === provCtx.addrProv) {
      reason = 'province_mismatch';
    }
    usedSources.add(orphan.center_key);
    suggestions.push({
      source_key: orphan.center_key,
      target_key: best.key,
      source_display_name: extractDisplayNameFromEdit(orphan.data, orphan.center_key),
      target_display_name: best.name,
      match_score: bestScore,
      match_reason: reason,
      source_snapshot: snapshotEdit(orphan.data),
    });
  });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  if (!dryRun) {
    for (const s of suggestions) {
      const existing = await client.query(
        `SELECT id, status FROM center_merge_suggestions
         WHERE source_key = $1 AND target_key = $2
         ORDER BY id DESC LIMIT 1`,
        [s.source_key, s.target_key]
      );
      if (existing.rows.length) {
        const row = existing.rows[0];
        if (row.status === 'merged' || row.status === 'dismissed') {
          skipped++;
          continue;
        }
        await client.query(
          `UPDATE center_merge_suggestions
           SET match_score = $2, match_reason = $3, source_snapshot = $4::jsonb,
               source_display_name = $5, target_display_name = $6,
               status = CASE WHEN status = 'deferred' AND deferred_until < NOW() THEN 'pending' ELSE status END,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id, s.match_score, s.match_reason, JSON.stringify(s.source_snapshot),
            s.source_display_name, s.target_display_name]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO center_merge_suggestions
             (source_key, target_key, source_display_name, target_display_name,
              match_score, match_reason, source_snapshot, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'pending')`,
          [s.source_key, s.target_key, s.source_display_name, s.target_display_name,
            s.match_score, s.match_reason, JSON.stringify(s.source_snapshot)]
        );
        inserted++;
      }
    }
  }

  return {
    dryRun,
    orphanCount: orphanEdits.length,
    suggestionCount: suggestions.length,
    inserted,
    updated,
    skipped,
    suggestions: dryRun ? suggestions.slice(0, 100) : undefined,
  };
}

function rowToSuggestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceKey: row.source_key,
    targetKey: row.target_key,
    sourceName: row.source_display_name,
    targetName: row.target_display_name,
    matchScore: row.match_score,
    matchReason: row.match_reason,
    snapshot: row.source_snapshot || {},
    status: row.status,
    deferredUntil: row.deferred_until,
    createdAt: row.created_at,
  };
}

async function getSuggestionsForCenter(centerKey, opts) {
  opts = opts || {};
  const includeDeferred = !!opts.includeDeferred;
  const statusClause = includeDeferred
    ? `status IN ('pending', 'deferred') AND (deferred_until IS NULL OR deferred_until <= NOW())`
    : `status = 'pending'`;

  const r = await query(
    `SELECT * FROM center_merge_suggestions
     WHERE target_key = $1 AND ${statusClause}
     ORDER BY match_score DESC, id DESC
     LIMIT 20`,
    [centerKey]
  );

  const asSource = await query(
    `SELECT * FROM center_merge_suggestions
     WHERE source_key = $1 AND ${statusClause}
     ORDER BY match_score DESC LIMIT 5`,
    [centerKey]
  );

  const seen = new Set();
  const out = [];
  r.rows.concat(asSource.rows).forEach(function (row) {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    out.push(rowToSuggestion(row));
  });
  return out;
}

async function dismissSuggestion(id, username, reason) {
  const r = await query(
    `UPDATE center_merge_suggestions
     SET status = 'dismissed', dismissed_by = $2, dismissed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'deferred')
     RETURNING *`,
    [id, username]
  );
  if (!r.rows.length) throw new Error('پیشنهاد یافت نشد یا قبلاً بسته شده');
  if (reason) {
    await query(
      `INSERT INTO change_log (at, by, rkey, field, val)
       VALUES (NOW(), $1, $2, '_merge_dismissed', $3::jsonb)`,
      [username, r.rows[0].target_key, JSON.stringify({ suggestionId: id, reason: reason || '' })]
    ).catch(function () {});
  }
  return rowToSuggestion(r.rows[0]);
}

async function deferSuggestion(id, username, days) {
  days = days || 30;
  const r = await query(
    `UPDATE center_merge_suggestions
     SET status = 'deferred', deferred_until = NOW() + ($2 || ' days')::interval,
         dismissed_by = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, String(days), username]
  );
  if (!r.rows.length) throw new Error('پیشنهاد یافت نشد');
  return rowToSuggestion(r.rows[0]);
}

function mergeEditObjects(target, source, fieldPrefs) {
  fieldPrefs = fieldPrefs || {};
  target = Object.assign({}, target || {});
  source = source || {};
  const fields = ['status', 'owner', 'lead', 'potential', 'type', 'address', 'followupDate',
    'competitor', 'competitors', 'nameOverride', 'oppValue', 'oppGrade', 'oppProbability'];

  fields.forEach(function (f) {
    const pref = fieldPrefs[f] || 'prefer_target';
    const tv = target[f];
    const sv = source[f];
    if (pref === 'source') {
      if (sv != null && sv !== '') target[f] = sv;
    } else if (pref === 'target') {
      if (tv != null && tv !== '') target[f] = tv;
      else if (sv != null && sv !== '') target[f] = sv;
    } else {
      if ((tv == null || tv === '') && sv != null && sv !== '') target[f] = sv;
    }
  });

  const tc = Array.isArray(target.contacts) ? target.contacts.slice() : [];
  const seenNames = new Set(tc.map(function (c) { return (c && c.name) || ''; }));
  (source.contacts || []).forEach(function (ct) {
    if (!ct) return;
    const cName = ct.name || '';
    if (!seenNames.has(cName)) {
      tc.push(ct);
      seenNames.add(cName);
    } else {
      const exc = tc.find(function (x) { return x && (x.name || '') === cName; });
      if (exc) {
        const ep = new Set(exc.phones || []);
        (ct.phones || []).forEach(function (ph) {
          if (ph && !ep.has(ph)) {
            exc.phones = exc.phones || [];
            exc.phones.push(ph);
            ep.add(ph);
          }
        });
      }
    }
  });
  target.contacts = tc;
  return target;
}

async function rekeyCenterReferences(client, sourceKey, targetKey, username) {
  const src = parseCenterKey(sourceKey);
  const tgt = parseCenterKey(targetKey);
  if (!src || !tgt) return;

  await client.query(
    `UPDATE change_log SET rkey = $2 WHERE rkey = $1`,
    [sourceKey, targetKey]
  ).catch(function () {});

  await client.query(
    `UPDATE center_interactions SET center_key = $2 WHERE center_key = $1`,
    [sourceKey, targetKey]
  ).catch(function () {});

  await client.query(
    `UPDATE center_contacts SET center_key = $2, updated_at = NOW(), updated_by = $3 WHERE center_key = $1`,
    [sourceKey, targetKey, username]
  ).catch(function () {});

  await client.query(
    `UPDATE center_deals SET center_key = $2, updated_at = NOW() WHERE center_key = $1`,
    [sourceKey, targetKey]
  ).catch(function () {});

  await client.query(
    `UPDATE tasks SET center_key = $2, updated_at = NOW() WHERE center_key = $1 AND deleted_at IS NULL`,
    [sourceKey, targetKey]
  ).catch(function () {});

  if (src.id && tgt.id) {
    const srcRec = src.type + '_' + src.id;
    const weRows = await client.query(
      `SELECT key, value, rec_key, rtype, rid FROM week_entries
       WHERE rec_key = $1 OR rec_key = $2 OR rid = $3 OR key LIKE $4`,
      [sourceKey, srcRec, src.id, '%' + srcRec + '%']
    );
    for (const row of weRows.rows) {
      let newKey = row.key;
      if (src.id !== tgt.id) {
        newKey = row.key.split(src.id).join(tgt.id);
      }
      const newRec = (row.rec_key || '').replace(sourceKey, targetKey)
        .replace(src.type + '_' + src.id, tgt.type + '_' + tgt.id);
      const newVal = Object.assign({}, row.value || {}, {
        rid: tgt.id,
        rtype: tgt.type,
        recKey: newRec || (tgt.type + '_' + tgt.id),
      });
      const dup = await client.query('SELECT key FROM week_entries WHERE key = $1', [newKey]);
      if (dup.rows.length && dup.rows[0].key !== row.key) {
        await client.query('DELETE FROM week_entries WHERE key = $1', [row.key]);
      } else {
        await client.query(
          `UPDATE week_entries SET key = $1, value = $2::jsonb, rec_key = $3, rtype = $4, rid = $5,
             updated_at = NOW(), updated_by = $6 WHERE key = $7`,
          [newKey, JSON.stringify(newVal), newVal.recKey, tgt.type, tgt.id, username, row.key]
        );
      }
    }
  }
}

async function mergeNotesAndTags(client, sourceKey, targetKey, username) {
  const [srcNotes, tgtNotes, srcTags, tgtTags] = await Promise.all([
    client.query('SELECT notes FROM center_notes WHERE center_key = $1', [sourceKey]),
    client.query('SELECT notes FROM center_notes WHERE center_key = $1', [targetKey]),
    client.query('SELECT tags FROM center_tags WHERE center_key = $1', [sourceKey]),
    client.query('SELECT tags FROM center_tags WHERE center_key = $1', [targetKey]),
  ]);
  const sn = srcNotes.rows[0] ? (srcNotes.rows[0].notes || []) : [];
  const tn = tgtNotes.rows[0] ? (tgtNotes.rows[0].notes || []) : [];
  if (sn.length) {
    const merged = tn.concat(sn);
    await client.query(
      `INSERT INTO center_notes (center_key, notes, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET notes = $2, updated_at = NOW(), updated_by = $3`,
      [targetKey, JSON.stringify(merged), username]
    );
  }
  const st = srcTags.rows[0] ? (srcTags.rows[0].tags || []) : [];
  const tt = tgtTags.rows[0] ? (tgtTags.rows[0].tags || []) : [];
  if (st.length) {
    const mergedTags = tt.slice();
    st.forEach(function (t) { if (!mergedTags.includes(t)) mergedTags.push(t); });
    await client.query(
      `INSERT INTO center_tags (center_key, tags, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET tags = $2, updated_at = NOW(), updated_by = $3`,
      [targetKey, JSON.stringify(mergedTags), username]
    );
  }
}

async function executeSuggestionMerge(suggestionId, username, opts) {
  opts = opts || {};
  const fieldPrefs = opts.fieldPrefs || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sugR = await client.query(
      `SELECT * FROM center_merge_suggestions WHERE id = $1 FOR UPDATE`,
      [suggestionId]
    );
    if (!sugR.rows.length) throw new Error('پیشنهاد یافت نشد');
    const sug = sugR.rows[0];
    if (sug.status === 'merged') throw new Error('قبلاً ادغام شده');
    if (sug.status === 'dismissed') throw new Error('پیشنهاد رد شده');

    const sourceKey = sug.source_key;
    const targetKey = sug.target_key;

    const [srcEditR, tgtEditR] = await Promise.all([
      client.query('SELECT data FROM center_edits WHERE center_key = $1', [sourceKey]),
      client.query('SELECT data FROM center_edits WHERE center_key = $1', [targetKey]),
    ]);
    const srcData = srcEditR.rows[0] ? (srcEditR.rows[0].data || {}) : {};
    const tgtData = tgtEditR.rows[0] ? (tgtEditR.rows[0].data || {}) : {};
    const merged = mergeEditObjects(tgtData, srcData, fieldPrefs);
    merged._mergeHistory = (merged._mergeHistory || []).concat([{
      from: sourceKey,
      at: new Date().toISOString(),
      by: username,
    }]);

    await client.query(
      `INSERT INTO center_edits (center_key, data, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET data = $2, updated_at = NOW(), updated_by = $3`,
      [targetKey, JSON.stringify(merged), username]
    );

    const archived = Object.assign({}, srcData, {
      _mergedInto: targetKey,
      _archived: true,
      _archivedAt: new Date().toISOString(),
      _archivedBy: username,
    });
    await client.query(
      `INSERT INTO center_edits (center_key, data, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET data = $2, updated_at = NOW(), updated_by = $3`,
      [sourceKey, JSON.stringify(archived), username]
    );

    await mergeNotesAndTags(client, sourceKey, targetKey, username);
    await rekeyCenterReferences(client, sourceKey, targetKey, username);

    await client.query(
      `INSERT INTO change_log (at, by, rkey, field, val)
       VALUES (NOW(), $1, $2, '_merged_from', $3::jsonb)`,
      [username, targetKey, JSON.stringify({ sourceKey, suggestionId })]
    ).catch(function () {});

    await client.query(
      `UPDATE center_merge_suggestions
       SET status = 'merged', merged_at = NOW(), merged_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [suggestionId, username]
    );

    await client.query(
      `UPDATE center_merge_suggestions
       SET status = 'dismissed', dismissed_at = NOW(), dismissed_by = $2, updated_at = NOW()
       WHERE source_key = $1 AND id <> $3 AND status IN ('pending', 'deferred')`,
      [sourceKey, username, suggestionId]
    );

    await client.query('COMMIT');
    return { ok: true, sourceKey, targetKey, suggestionId };
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    throw e;
  } finally {
    client.release();
  }
}

async function addOrphanAsSeparateCenter(suggestionId, username, nameOverride) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sugR = await client.query('SELECT * FROM center_merge_suggestions WHERE id = $1 FOR UPDATE', [suggestionId]);
    if (!sugR.rows.length) throw new Error('پیشنهاد یافت نشد');
    const sug = sugR.rows[0];
    const sourceKey = sug.source_key;
    const keyProv = getProvIdFromCenterKey(sourceKey);
    if (!keyProv || keyProv === 'tehran') throw new Error('فقط مراکز استانی پشتیبانی می‌شود');

    const editR = await client.query('SELECT data FROM center_edits WHERE center_key = $1', [sourceKey]);
    const editData = editR.rows[0] ? (editR.rows[0].data || {}) : {};
    const addrProv = detectProvinceFromAddress(editData.address);
    const provId = (addrProv && addrProv !== keyProv) ? addrProv : keyProv;
    const displayName = normPersian(nameOverride || sug.source_display_name || extractDisplayNameFromEdit(editData, sourceKey));
    if (!displayName || displayName.length < 2) throw new Error('نام مرکز الزامی است');

    const masterR = await client.query("SELECT data FROM centers_master WHERE key = 'PC_RAW'");
    const PC_RAW = masterR.rows[0] ? (masterR.rows[0].data || {}) : {};
    const pname = PROV_ID_TO_NAME[provId];
    if (!pname) throw new Error('استان نامعتبر');

    const arr = PC_RAW[pname] || [];
    let maxRow = 0;
    arr.forEach(function (r) {
      const row = Array.isArray(r) ? r[0] : (r.row != null ? r.row : 0);
      if (row > maxRow) maxRow = row;
    });
    const newRow = maxRow + 1;
    arr.push([newRow, displayName, editData.potential || 2, editData.type || '', editData.lead || 'سرنخ']);
    PC_RAW[pname] = arr;

    const newKey = 'pc_' + provId + '||' + newRow;
    const newEdit = Object.assign({}, editData, {
      nameOverride: displayName,
      _separatedFrom: sourceKey,
      _separatedAt: new Date().toISOString(),
    });
    delete newEdit._archived;
    delete newEdit._mergedInto;

    await client.query(
      `INSERT INTO center_edits (center_key, data, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET data = $2, updated_at = NOW(), updated_by = $3`,
      [newKey, JSON.stringify(newEdit), username]
    );

    if (newKey !== sourceKey) {
      await mergeNotesAndTags(client, sourceKey, newKey, username);
      await rekeyCenterReferences(client, sourceKey, newKey, username);
      const archived = Object.assign({}, editData, { _archived: true, _replacedBy: newKey });
      await client.query(
        `UPDATE center_edits SET data = $2::jsonb, updated_at = NOW(), updated_by = $3 WHERE center_key = $1`,
        [sourceKey, JSON.stringify(archived), username]
      );
    }

    await client.query(
      `INSERT INTO centers_master (key, data, updated_at) VALUES ('PC_RAW', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(PC_RAW)]
    );

    await client.query(
      `UPDATE center_merge_suggestions SET status = 'dismissed', dismissed_by = $2,
         dismissed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [suggestionId, username]
    );

    await client.query('COMMIT');
    return { ok: true, newKey, name: displayName, provId };
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    throw e;
  } finally {
    client.release();
  }
}

async function renameAndDismiss(suggestionId, username, newName) {
  const sugR = await query('SELECT * FROM center_merge_suggestions WHERE id = $1', [suggestionId]);
  if (!sugR.rows.length) throw new Error('پیشنهاد یافت نشد');
  const sug = sugR.rows[0];
  const name = normPersian(newName);
  if (name) {
    const editR = await query('SELECT data FROM center_edits WHERE center_key = $1', [sug.target_key]);
    const data = editR.rows[0] ? (editR.rows[0].data || {}) : {};
    data.nameOverride = name;
    await query(
      `INSERT INTO center_edits (center_key, data, updated_at, updated_by) VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (center_key) DO UPDATE SET data = $2, updated_at = NOW(), updated_by = $3`,
      [sug.target_key, JSON.stringify(data), username]
    );
  }
  return dismissSuggestion(suggestionId, username, 'different_entity');
}

module.exports = {
  PROVINCE_MAP,
  PROV_ID_TO_NAME,
  buildMergeSuggestions,
  getSuggestionsForCenter,
  dismissSuggestion,
  deferSuggestion,
  executeSuggestionMerge,
  addOrphanAsSeparateCenter,
  renameAndDismiss,
  normalizeName,
  nameSimilarity,
  loadCatalog,
  parseCenterKey,
  snapshotEdit,
  getProvIdFromCenterKey,
  detectProvinceFromAddress,
  resolveOrphanProvince,
};

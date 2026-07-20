#!/usr/bin/env node
'use strict';
/** Audit: master list vs center_edits vs soft-deleted — find missing display causes */
const fs = require('fs');
const path = require('path');
const { pool } = require('../server/db');

const core = fs.readFileSync(path.join(__dirname, '../public/js/core.js'), 'utf8');
const m = core.match(/var PROVINCES = (\[[\s\S]*?\]);/);
const PROVINCES = eval(m[1]);

function norm(s) { return (s || '').replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک'); }

function buildMasterKeys(CENTERS, PC_RAW) {
  const keys = new Set();
  const byKey = {};
  CENTERS.forEach((c) => {
    if (c && c.id) {
      const k = 'center_' + c.id;
      keys.add(k);
      byKey[k] = { name: c.name, prov: 'tehran' };
    }
  });
  PROVINCES.forEach((p) => {
    const pname = norm(p.name);
    const rawByName = PC_RAW[pname] || [];
    const rawById = PC_RAW[p.id] || [];
    const raw = rawByName.concat(rawById.filter((r) => {
      const rname = (r && (r.name || r[1])) || '';
      return !rawByName.some((s) => ((s && (s.name || s[1])) || '') === rname);
    }));
    const seen = {};
    raw.forEach((r) => {
      let obj;
      if (Array.isArray(r)) {
        obj = { id: p.id + '||' + r[0], name: r[1] || '' };
      } else {
        const rid = r.row || r[0] || 0;
        obj = { id: r.id || (p.id + '||' + rid), name: r.name || r[1] || '', _mizito: r._mizito };
      }
      if (seen[obj.id]) {
        const suffix = obj._mizito ? '_m' : ('_d' + (Array.isArray(r) ? r[0] : (r.row || r[0] || 0)));
        obj.id = obj.id + suffix;
      }
      seen[obj.id] = true;
      const k = 'pc_' + obj.id;
      keys.add(k);
      byKey[k] = { name: obj.name, prov: p.id };
    });
  });
  return { keys, byKey };
}

async function main() {
  const cm = await pool.query("SELECT data FROM centers_master WHERE key='CENTERS'");
  const pc = await pool.query("SELECT data FROM centers_master WHERE key='PC_RAW'");
  const CENTERS = cm.rows[0].data || [];
  const PC_RAW = pc.rows[0].data || {};
  const { keys, byKey } = buildMasterKeys(CENTERS, PC_RAW);

  console.log('═══ Master centers ═══');
  console.log('Tehran CENTERS:', CENTERS.length);
  console.log('PC_RAW rows:', Object.values(PC_RAW).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0));
  console.log('Unique master keys:', keys.size);

  const editsR = await pool.query('SELECT center_key, data FROM center_edits');
  let inMaster = 0;
  let orphan = 0;
  const orphanGroups = {};
  const orphanMizito = [];
  editsR.rows.forEach((r) => {
    const k = r.center_key;
    if (/^pc_p\d+$/.test(k) || k === 'center_tehran') { inMaster++; return; }
    if (keys.has(k)) inMaster++;
    else if (k.startsWith('center_') || k.startsWith('pc_')) {
      orphan++;
      const pref = k.startsWith('center_') ? 'center_*' : k.replace(/\|\|.*/, '||*');
      orphanGroups[pref] = (orphanGroups[pref] || 0) + 1;
      const d = r.data || {};
      if (d._mizitoRow && orphanMizito.length < 15) {
        orphanMizito.push({ k, name: d.nameOverride || d._mizitoName || '', status: d.status });
      }
    }
  });

  console.log('\n═══ center_edits vs master ═══');
  console.log('Total edits:', editsR.rows.length);
  console.log('In master:', inMaster);
  console.log('Orphan (no master row):', orphan);
  console.log('Orphan groups (top):', Object.entries(orphanGroups).sort((a, b) => b[1] - a[1]).slice(0, 10));

  const miz = await pool.query("SELECT COUNT(*) c FROM center_edits WHERE data->>'_mizitoRow' IS NOT NULL");
  const mizOrphan = await pool.query(`
    SELECT COUNT(*) c FROM center_edits ce
    WHERE data->>'_mizitoRow' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM (SELECT unnest($1::text[]) k) m WHERE m.k = ce.center_key
      )`, [Array.from(keys)]);
  console.log('Mizito-tagged edits:', miz.rows[0].c);
  console.log('Mizito orphans (not in master):', mizOrphan.rows[0].c);

  console.log('\nSample Mizito orphans:');
  orphanMizito.forEach((o) => console.log(' ', o.k, '|', o.name.slice(0, 40), '|', o.status));

  const del = await pool.query(`
    SELECT center_key, title, deleted_at, deleted_by, delete_reason
    FROM deleted_entities
    WHERE entity_type='center' AND restored_at IS NULL AND purged_at IS NULL
    ORDER BY deleted_at DESC`);
  console.log('\n═══ Soft-deleted centers (removed from master) ═══');
  console.log('Count:', del.rowCount);
  del.rows.slice(0, 15).forEach((r) => {
    console.log(' ', r.center_key || '-', '|', (r.title || '').slice(0, 45), '|', r.deleted_by, (r.deleted_at || '').toISOString?.().slice(0, 10));
  });

  // Tehran mz_t vs c_ duplicates
  const mzInMaster = CENTERS.filter((c) => String(c.id).startsWith('mz_t_')).length;
  const cInMaster = CENTERS.filter((c) => String(c.id).startsWith('c_')).length;
  console.log('\n═══ Tehran ID types in master ═══');
  console.log('mz_t_:', mzInMaster, 'c_:', cInMaster, 'other:', CENTERS.length - mzInMaster - cInMaster);

  const cOrphans = editsR.rows.filter((r) => r.center_key.startsWith('center_c_') && !keys.has(r.center_key));
  console.log('center_c_ edit orphans (merged away?):', cOrphans.length);

  // Settings that hide centers
  const settings = await pool.query("SELECT key, data FROM app_settings WHERE key IN ('provOverrides','hiddenProvs')");
  console.log('\n═══ Visibility settings ═══');
  settings.rows.forEach((r) => console.log(r.key + ':', JSON.stringify(r.data)));

  // Expert edit load simulation: centers in master but edit owner empty + province owner set
  const provOwners = await pool.query(`
    SELECT center_key, data->>'owner' owner FROM center_edits
    WHERE center_key ~ '^(center_tehran|pc_p[0-9]+)$' AND data->>'owner' IS NOT NULL AND data->>'owner' <> ''`);
  console.log('\nProvince-level owners in center_edits:', provOwners.rowCount);
  provOwners.rows.forEach((r) => console.log(' ', r.center_key, '→', r.owner));

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

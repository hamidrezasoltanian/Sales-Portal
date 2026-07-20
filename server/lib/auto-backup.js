'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');

const TZ = 'Asia/Tehran';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const SCHEDULE = [
  { hour: 11, minute: 0, label: '11:00' },
  { hour: 13, minute: 0, label: '13:00' },
  { hour: 18, minute: 0, label: '18:00' },
];

const _lastSlotKey = new Map();
let _timer = null;

function getBackupDir() {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  const home = process.env.HOME || '/tmp';
  return path.join(home, 'db_backups');
}

function getTehranParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date || new Date());
  const map = {};
  parts.forEach(function (p) { if (p.type !== 'literal') map[p.type] = p.value; });
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    dateKey: map.year + '-' + map.month + '-' + map.day,
  };
}

function currentSlot() {
  const t = getTehranParts();
  return SCHEDULE.find(function (s) {
    return s.hour === t.hour && t.minute === s.minute;
  }) || null;
}

function runBackupScript(mode, triggeredBy) {
  return new Promise(function (resolve, reject) {
    const script = path.join(__dirname, '../../scripts/backup_db.sh');
    if (!fs.existsSync(script)) {
      return reject(new Error('backup script not found'));
    }
    execFile('bash', [script, mode], {
      env: Object.assign({}, process.env, { BACKUP_DIR: getBackupDir() }),
      timeout: 10 * 60 * 1000,
    }, function (err, stdout, stderr) {
      if (err) {
        console.error('[auto-backup]', err.message, stderr || '');
        return reject(err);
      }
      const out = (stdout || '').trim();
      const fileMatch = out.match(/scheduled_[^\s]+\.sql\.gz|full_[^\s]+\.sql\.gz/);
      const filePath = fileMatch ? path.join(getBackupDir(), path.basename(fileMatch[0])) : null;
      let sizeBytes = 0;
      if (filePath && fs.existsSync(filePath)) {
        sizeBytes = fs.statSync(filePath).size;
      }
      query(
        `INSERT INTO scheduled_backups (backup_type, file_path, file_size, created_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [mode, filePath, sizeBytes, triggeredBy || 'system', out.split('\n').pop() || '']
      ).catch(function (e) { console.warn('[auto-backup] log insert failed:', e.message); });
      console.log('[auto-backup]', out.split('\n').join(' | '));
      resolve({ filePath, sizeBytes, stdout: out });
    });
  });
}

async function tick() {
  if (process.env.AUTO_BACKUP_ENABLED === 'false') return;
  const slot = currentSlot();
  if (!slot) return;
  const t = getTehranParts();
  const slotKey = t.dateKey + '_' + slot.label;
  if (_lastSlotKey.get(slotKey)) return;
  _lastSlotKey.set(slotKey, true);
  try {
    await runBackupScript('scheduled', 'auto-scheduler');
  } catch (e) {
    console.error('[auto-backup] scheduled run failed:', e.message);
    _lastSlotKey.delete(slotKey);
  }
}

function startAutoBackupScheduler() {
  if (process.env.AUTO_BACKUP_SCHEDULER !== 'true') {
    console.log('[auto-backup] scheduler disabled — backups run via cron (scripts/setup-backup-cron.sh). On-demand: POST /api/backups/run');
    return;
  }
  if (process.env.AUTO_BACKUP_ENABLED === 'false') {
    console.log('[auto-backup] disabled (AUTO_BACKUP_ENABLED=false)');
    return;
  }
  if (_timer) return;
  _timer = setInterval(tick, 60 * 1000);
  console.log('[auto-backup] scheduler started — 3× daily at 11:00, 13:00, 18:00 (' + TZ + '), retention ' + RETENTION_DAYS + ' days');
  tick();
}

function listBackupFiles() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter(function (n) {
    return /^scheduled_.*\.sql\.gz$/.test(n) || /^full_.*\.sql\.gz$/.test(n) || /^appdata_.*\.sql\.gz$/.test(n);
  });
  return names.map(function (name) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    return {
      name,
      path: fp,
      size: st.size,
      sizeHuman: formatBytes(st.size),
      createdAt: st.mtime.toISOString(),
      type: name.startsWith('scheduled_') ? 'scheduled' : name.startsWith('full_') ? 'full' : 'appdata',
    };
  }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function getStatus() {
  const files = listBackupFiles();
  const latest = files[0] || null;
  const t = getTehranParts();
  const nextSlots = SCHEDULE.map(function (s) {
    const passed = t.hour > s.hour || (t.hour === s.hour && t.minute >= s.minute);
    return { time: s.label, passedToday: passed };
  });
  let dbLog = [];
  try {
    const r = await query(
      'SELECT id, backup_type, file_path, file_size, created_at, created_by FROM scheduled_backups ORDER BY created_at DESC LIMIT 20'
    );
    dbLog = r.rows.map(function (row) {
      return {
        id: row.id,
        type: row.backup_type,
        file: row.file_path ? path.basename(row.file_path) : null,
        size: row.file_size,
        sizeHuman: formatBytes(Number(row.file_size) || 0),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        by: row.created_by,
      };
    });
  } catch (e) { /* table may not exist yet */ }

  return {
    enabled: process.env.AUTO_BACKUP_SCHEDULER === 'true' && process.env.AUTO_BACKUP_ENABLED !== 'false',
    cronPrimary: process.env.AUTO_BACKUP_SCHEDULER !== 'true',
    timezone: TZ,
    schedule: SCHEDULE.map(function (s) { return s.label; }),
    retentionDays: RETENTION_DAYS,
    backupDir: getBackupDir(),
    tehranNow: t.dateKey + ' ' + String(t.hour).padStart(2, '0') + ':' + String(t.minute).padStart(2, '0'),
    nextSlots,
    latestFile: latest,
    fileCount: files.length,
    files: files.slice(0, 60),
    log: dbLog,
  };
}

function resolveDownloadPath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const base = path.basename(filename);
  if (!/^(scheduled_|full_|appdata_)[\w.-]+\.sql\.gz$/.test(base)) return null;
  const fp = path.join(getBackupDir(), base);
  if (!fs.existsSync(fp)) return null;
  return fp;
}

module.exports = {
  startAutoBackupScheduler,
  runBackupScript,
  getStatus,
  listBackupFiles,
  resolveDownloadPath,
  getBackupDir,
  SCHEDULE,
  RETENTION_DAYS,
};

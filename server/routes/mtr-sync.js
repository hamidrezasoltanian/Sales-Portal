'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireManager);

let faradis = null;
try { faradis = require('../integrations/faradis'); } catch (e) {}

function urgLevel(od) {
  if (od > 90) return { l: 'بحرانی +۹۰', c: '#dc2626', bg: '#fef2f2', bc: '#dc262633', cls: 'c4', lv: 4 };
  if (od > 60) return { l: 'تخلف ۶۰ روز', c: '#ea580c', bg: '#fff7ed', bc: '#ea580c33', cls: 'c3', lv: 3 };
  if (od > 30) return { l: 'اورژانسی', c: '#d97706', bg: '#fffbeb', bc: '#d9770633', cls: 'c2', lv: 2 };
  if (od > 0) return { l: 'پیگیری', c: '#2563eb', bg: '#eff6ff', bc: '#2563eb33', cls: 'c1', lv: 1 };
  return { l: 'جاری', c: '#16a34a', bg: '#f0fdf4', bc: '#16a34a33', cls: 'c0', lv: 0 };
}

function actTxt(od) {
  if (od > 90) return '⛔ توقف فروش + اقدام حقوقی';
  if (od > 60) return '🚨 تماس فوری مدیر + ضرب‌الاجل ۴۸ ساعته';
  if (od > 30) return '📞 تماس کارشناس + ثبت میزیتو';
  if (od > 0) return '💬 یادآوری + پیش‌فاکتور';
  return '✓ زیر نظر';
}

/** Map Faradis receivables cache → MTR DATA row shape (matchCentersToData compatible). */
function normalizeReceivablesRows(cacheRows) {
  return (cacheRows || [])
    .filter(function (r) { return Number(r.balance) > 100; })
    .map(function (r) {
      const od = 0;
      const u = urgLevel(od);
      return {
        follower: '—',
        inv: 'C-' + String(r.company_num),
        invDate: '',
        customer: String(r.company_name || '—').trim() || '—',
        province: '—',
        rem: Number(r.balance),
        due: '',
        od: od,
        urg: u,
        act: actTxt(od),
        _source: 'faradis',
        company_num: r.company_num,
      };
    })
    .sort(function (a, b) { return b.rem - a.rem; });
}

async function refreshFaradisReceivables() {
  if (!faradis || !faradis.isConfigured()) {
    return { ok: false, error: 'Faradis not configured' };
  }
  const rows = await faradis.fetchReceivablesSummary();
  await query('DELETE FROM faradis_receivables_cache');
  for (const r of rows) {
    await query(
      `INSERT INTO faradis_receivables_cache
         (company_num, company_name, company_code, total_sales, total_returns, total_received, balance, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [r.company_num, r.company_name, r.company_code, r.total_sales, r.total_returns, r.total_received, r.balance]
    );
  }
  return { ok: true, count: rows.length };
}

async function loadReceivablesFromCache() {
  const r = await query(
    `SELECT company_num, company_name, company_code, balance, synced_at
     FROM faradis_receivables_cache
     WHERE balance > 100
     ORDER BY balance DESC`
  );
  return r.rows;
}

async function persistMtrPayload(rows, user) {
  const at = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const payload = { data: rows, at: at, syncedAt: new Date().toISOString(), source: 'faradis' };
  await query(
    `INSERT INTO app_data (key, value, updated_at, updated_by)
     VALUES ('mtr', $1, NOW(), $2)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
    [JSON.stringify(payload), user]
  );
  return payload;
}

// GET /api/mtr/sync/status
router.get('/status', async function (req, res) {
  try {
    const cache = await query('SELECT COUNT(*)::int AS cnt, MAX(synced_at) AS last_sync FROM faradis_receivables_cache');
    const mtr = await query("SELECT updated_at, updated_by FROM app_data WHERE key = 'mtr'");
    const settings = await query("SELECT value FROM app_settings WHERE key = 'mtrSyncEnabled'");
    res.json({
      faradisConfigured: !!(faradis && faradis.isConfigured()),
      receivablesCached: cache.rows[0].cnt,
      lastFaradisSync: cache.rows[0].last_sync,
      mtrUpdatedAt: mtr.rows[0] ? mtr.rows[0].updated_at : null,
      mtrSyncEnabled: settings.rows.length ? !!settings.rows[0].value : false,
    });
  } catch (e) {
    console.error('[mtr-sync/status]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/mtr/sync — pull from Faradis cache (optional refresh) → normalize → save MTR blob
router.post('/sync', async function (req, res) {
  try {
    const refresh = !!(req.body && req.body.refresh);
    if (refresh) {
      const rr = await refreshFaradisReceivables();
      if (!rr.ok) {
        return res.status(503).json({ error: rr.error || 'Faradis sync failed' });
      }
    }

    let cacheRows = await loadReceivablesFromCache();
    if (!cacheRows.length && faradis && faradis.isConfigured()) {
      const rr = await refreshFaradisReceivables();
      if (rr.ok) cacheRows = await loadReceivablesFromCache();
    }

    if (!cacheRows.length) {
      return res.json({
        ok: true,
        count: 0,
        rows: [],
        at: null,
        source: 'faradis',
        message: 'هیچ مطالبه‌ای در کش فرادیس یافت نشد — ابتدا sync-receivables را اجرا کنید',
      });
    }

    const rows = normalizeReceivablesRows(cacheRows);
    const saved = await persistMtrPayload(rows, req.user.username);

    let _broadcast = null;
    try { _broadcast = require('./events').broadcast; } catch (e) {}
    try {
      if (_broadcast) _broadcast('mtr-updated', { by: req.user.username, count: rows.length, at: Date.now() }, req.headers['x-cid'] || '');
    } catch (e) {}

    res.json({
      ok: true,
      count: rows.length,
      rows: rows,
      at: saved.at,
      source: 'faradis',
    });
  } catch (e) {
    console.error('[mtr-sync POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

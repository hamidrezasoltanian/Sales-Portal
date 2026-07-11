'use strict';

/**
 * GET /api/mtr-sync/sync — thin alias that delegates to production Faradis MTR sync.
 * Prefer POST /api/mtr/sync from the UI; this endpoint exists for legacy pollers.
 */
const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const { query } = require('../db');

const router = express.Router();
router.use(requireAuth);

router.get('/sync', requireManager, async function (req, res) {
  try {
    const settingsRow = await query("SELECT value FROM app_settings WHERE key = 'mtrSyncEnabled'");
    let enabled = process.env.MTR_SYNC_ENABLED === '1';
    if (settingsRow.rows.length) {
      const v = settingsRow.rows[0].value;
      enabled = typeof v === 'boolean' ? v : !!(v && (v.enabled !== false));
    }
    // Also check DB.settings via app_data if needed — UI stores mtrSyncEnabled in blob settings
    try {
      const blob = await query("SELECT value FROM app_data WHERE key = 'main'");
      if (blob.rows.length && blob.rows[0].value && blob.rows[0].value.settings) {
        if (blob.rows[0].value.settings.mtrSyncEnabled != null) {
          enabled = !!blob.rows[0].value.settings.mtrSyncEnabled;
        }
      }
    } catch (e) { /* ignore */ }

    if (!enabled) {
      return res.json({
        ok: true, enabled: false, rows: [], syncedAt: new Date().toISOString(), source: 'disabled',
      });
    }

    if (!process.env.FARADIS_SERVER || !process.env.FARADIS_PASSWORD) {
      return res.json({
        ok: true, enabled: true, rows: [], syncedAt: new Date().toISOString(),
        source: 'no_faradis_env', message: 'FARADIS_SERVER / FARADIS_PASSWORD تنظیم نشده',
      });
    }

    // Delegate to the same logic as POST /api/mtr/sync by calling Faradis caches
    const faradis = require('../integrations/faradis');
    let rows = [];
    let source = 'faradis';

    try {
      if (typeof faradis.fetchReceivablesSummary === 'function') {
        const summary = await faradis.fetchReceivablesSummary();
        rows = (summary || []).map(function (r) {
          return {
            companyNum: r.company_num || r.CompanyNum,
            companyName: r.company_name || r.CompanyName || '',
            companyCode: r.company_code || r.CompanyCode || '',
            balance: Number(r.balance || r.Balance || 0),
            totalSales: Number(r.total_sales || 0),
            totalReceived: Number(r.total_received || 0),
          };
        });
      }
    } catch (e) {
      console.error('[mtr-sync] faradis:', e.message);
      return res.status(502).json({ ok: false, error: e.message, source: 'faradis_error' });
    }

    res.json({
      ok: true, enabled: true, rows: rows, count: rows.length,
      syncedAt: new Date().toISOString(), source: source,
      hint: 'برای sync کامل و ذخیره در app_data از POST /api/mtr/sync استفاده کنید',
    });
  } catch (e) {
    console.error('[mtr-sync GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/status', requireManager, async function (req, res) {
  res.json({
    ok: true,
    preferredEndpoint: 'POST /api/mtr/sync',
    faradisConfigured: !!(process.env.FARADIS_SERVER && process.env.FARADIS_PASSWORD),
  });
});

module.exports = router;

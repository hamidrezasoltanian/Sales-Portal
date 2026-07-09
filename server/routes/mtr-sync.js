'use strict';

const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const { query } = require('../db');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/mtr/sync — pull receivables from accounting system.
 * When MTR_ACCOUNTING_DSN / Faradis env is configured, rows are normalized here.
 * Until then returns stub so the UI polling path can be tested safely.
 */
router.get('/sync', requireManager, async (req, res) => {
  try {
    const settingsRow = await query(
      "SELECT value FROM app_settings WHERE key = 'mtrSyncEnabled'"
    );
    const enabled = settingsRow.rows.length
      ? !!settingsRow.rows[0].value
      : process.env.MTR_SYNC_ENABLED === '1';

    if (!enabled) {
      return res.json({
        ok: true,
        enabled: false,
        rows: [],
        syncedAt: new Date().toISOString(),
        source: 'disabled',
      });
    }

    let rows = [];
    let source = 'stub';

    if (process.env.FARADIS_SERVER && process.env.FARADIS_PASSWORD) {
      try {
        const faradis = require('../integrations/faradis');
        if (typeof faradis.fetchOpenInvoices === 'function') {
          rows = await faradis.fetchOpenInvoices();
          source = 'faradis';
        }
      } catch (e) {
        console.warn('[mtr/sync] Faradis pull failed:', e.message);
      }
    }

    return res.json({
      ok: true,
      enabled: true,
      rows,
      count: rows.length,
      syncedAt: new Date().toISOString(),
      source,
    });
  } catch (e) {
    console.error('[mtr/sync]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { query } = require('../db');
const { todayJalaliStr, addJalaliDays } = require('../lib/proforma-helpers');
const { runNearExpiryTelegramReminders } = require('../lib/proforma-scheduler');
const { runAutoExpire } = require('../lib/proforma-helpers');

const router = express.Router();

function checkWebhookSecret(req, res) {
  const expected = process.env.N8N_WEBHOOK_SECRET || process.env.PROFORMA_WEBHOOK_SECRET || '';
  if (!expected) return true;
  const got = req.headers['x-webhook-secret'] || req.query.secret || '';
  if (got !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/** n8n / external automation → Telegram reminders for proforma expiry */
router.post('/proforma-reminders', async (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  try {
    const action = (req.body && req.body.action) || 'near_expiry';
    let result = {};
    if (action === 'expire' || action === 'all') {
      result.expired = await runAutoExpire();
    }
    if (action === 'near_expiry' || action === 'all') {
      result.nearExpiryReminders = await runNearExpiryTelegramReminders();
    }
    if (action === 'custom' && req.body.message && req.body.to) {
      const bot = require('../bot/telegram');
      if (req.body.to === 'managers') await bot.notifyManagers(req.body.message);
      else if (req.body.to === 'all') await bot.notifyAll(req.body.message);
      else await bot.notifyUser(req.body.to, req.body.message);
      result.sent = true;
    }
    if (action === 'list_near_expiry') {
      const today = todayJalaliStr();
      const in3 = addJalaliDays(today, 3);
      const r = await query(
        `SELECT id, no, center_name, expiry_date, status,
                COALESCE(NULLIF(sales_owner,''), created_by) AS owner
         FROM proformas
         WHERE status IN ('sent','negotiating')
           AND expiry_date >= $1 AND expiry_date <= $2
         ORDER BY expiry_date`,
        [today, in3]
      );
      result.items = r.rows;
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

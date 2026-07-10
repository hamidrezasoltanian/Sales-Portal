'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');

const router = express.Router();

// Keys stored in app_settings (users/members come from app_users SQL table)
const SETTINGS_KEYS = new Set([
  'companyName', 'companyInfo', 'sipDomain', 'anthropicKey', 'notifPrefs',
  'ckItems', 'statusList', 'leadList', 'typeList', 'onboardingDisabled',
  'firstUse', 'taskColumns', 'mtrSyncEnabled', 'telegramNotify', 'pricing_buy_costs',
]);

const MANAGER_ONLY_KEYS = new Set([
  'statusList', 'leadList', 'typeList', 'mtrSyncEnabled', 'anthropicKey',
]);

function maskSettings(row) {
  const out = {};
  Object.keys(row).forEach(function (key) {
    if (key === 'anthropicKey' && row[key]) out[key] = '***';
    else out[key] = row[key];
  });
  return out;
}

// GET /api/settings
router.get('/', requireAuth, async function (req, res) {
  try {
    const result = await query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(function (r) {
      if (!SETTINGS_KEYS.has(r.key)) return;
      settings[r.key] = r.value;
    });
    res.json(maskSettings(settings));
  } catch (e) {
    console.error('[settings GET]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

// PUT /api/settings — partial update of allowed keys
router.put('/', requireAuth, async function (req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'داده نامعتبر' });
  }

  const keys = Object.keys(body);
  if (!keys.length) return res.status(400).json({ error: 'هیچ تنظیمی ارسال نشده' });

  for (const key of keys) {
    if (!SETTINGS_KEYS.has(key)) {
      return res.status(400).json({ error: 'کلید غیرمجاز: ' + key });
    }
    if (MANAGER_ONLY_KEYS.has(key) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'فقط مدیر می‌تواند «' + key + '» را تغییر دهد' });
    }
  }

  try {
    const user = req.user.username;
    for (const key of keys) {
      if (key === 'anthropicKey' && body[key] === '***') continue;
      await query(
        `INSERT INTO app_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
        [key, JSON.stringify(body[key]), user]
      );
    }
    res.json({ ok: true, updated: keys });
  } catch (e) {
    console.error('[settings PUT]', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور' });
  }
});

module.exports = router;

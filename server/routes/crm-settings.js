'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const SENSITIVE_KEYS = new Set(['anthropicKey', 'farazApiKey']);

function maskSettings(obj) {
  const out = Object.assign({}, obj || {});
  if (out.anthropicKey) out.anthropicKey = '***';
  if (out.farazApiKey) out.farazApiKey = '***';
  return out;
}

// GET /api/crm-settings — all CRM settings (manager)
router.get('/', requireManager, async function (req, res) {
  try {
    const r = await query('SELECT key, value FROM app_settings ORDER BY key');
    const settings = {};
    r.rows.forEach(function (row) {
      settings[row.key] = row.value;
    });
    res.json(maskSettings(settings));
  } catch (e) {
    console.error('[crm-settings GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

const USER_PATCH_KEYS = new Set([
  'taskColumns', '_lastUser', 'firstUse', 'onboardingDisabled',
  'lastMorningReminder', 'lastAfternoonReminder', 'lastStartupReminder',
  'homeWidgets', 'pinnedCenters', 'filterPresets',
]);

function isManagerRole(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

// PATCH /api/crm-settings/:key — single setting upsert
router.patch('/:key', requireAuth, async function (req, res) {
  try {
    const key = req.params.key;
    if (!key || key.length > 64) {
      return res.status(400).json({ error: 'کلید نامعتبر' });
    }
    if (!USER_PATCH_KEYS.has(key) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const value = req.body && Object.prototype.hasOwnProperty.call(req.body, 'value')
      ? req.body.value
      : req.body;
    if (SENSITIVE_KEYS.has(key) && value === '***') {
      return res.json({ ok: true, skipped: true });
    }
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      [key, JSON.stringify(value), req.user.username]
    );
    res.json({ ok: true, key, value: SENSITIVE_KEYS.has(key) ? '***' : value });
  } catch (e) {
    console.error('[crm-settings PATCH]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

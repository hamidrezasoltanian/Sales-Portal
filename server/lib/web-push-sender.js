'use strict';

const webpush = require('web-push');
const { query } = require('../db');

let _configured = false;

function ensureVapid() {
  if (_configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@click-crm.local',
    pub,
    priv
  );
  _configured = true;
  return true;
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function saveSubscription(username, sub) {
  if (!sub || !sub.endpoint || !sub.keys) return false;
  await query(
    `INSERT INTO push_subscriptions (username, endpoint, keys, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET username = EXCLUDED.username, keys = EXCLUDED.keys, updated_at = NOW()`,
    [username, sub.endpoint, JSON.stringify(sub.keys)]
  );
  return true;
}

async function removeSubscription(username, endpoint) {
  if (endpoint) {
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND username = $2', [endpoint, username]);
  } else {
    await query('DELETE FROM push_subscriptions WHERE username = $1', [username]);
  }
}

async function sendToUser(username, payload) {
  if (!ensureVapid()) return { sent: 0, skipped: true };
  const r = await query('SELECT endpoint, keys FROM push_subscriptions WHERE username = $1', [username]);
  if (!r.rows.length) return { sent: 0 };
  let sent = 0;
  const body = JSON.stringify(payload);
  for (const row of r.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: row.keys },
        body
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(function () {});
      }
    }
  }
  return { sent };
}

module.exports = {
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendToUser,
  isConfigured: ensureVapid,
};

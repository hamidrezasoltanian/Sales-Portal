'use strict';

const { runAutoExpire, todayJalaliStr, compareJalali, addJalaliDays } = require('./proforma-helpers');
const { query } = require('../db');

let timer = null;
let running = false;

async function runNearExpiryTelegramReminders() {
  const today = todayJalaliStr();
  const in3 = addJalaliDays(today, 3);
  const r = await query(
    `SELECT id, no, center_name, expiry_date,
            COALESCE(NULLIF(sales_owner,''), created_by) AS owner
     FROM proformas
     WHERE status IN ('sent','negotiating')
       AND expiry_date IS NOT NULL AND expiry_date != ''
       AND expiry_date >= $1 AND expiry_date <= $2`,
    [today, in3]
  );
  if (!r.rows.length) return 0;
  let bot;
  try { bot = require('../bot/telegram'); } catch (_) { return 0; }
  for (const pf of r.rows) {
    const msg = '⏳ پیش‌فاکتور ' + pf.no + ' تا ' + pf.expiry_date + ' منقضی می‌شود\n👤 ' + (pf.center_name || '—');
    if (pf.owner && bot.notifyUser) await bot.notifyUser(pf.owner, msg).catch(function () {});
    if (bot.notifyManagers) await bot.notifyManagers(msg).catch(function () {});
  }
  return r.rows.length;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const expired = await runAutoExpire();
    const reminded = await runNearExpiryTelegramReminders();
    if (expired || reminded) {
      console.log('[proforma-scheduler] expired=' + expired + ' nearExpiryReminders=' + reminded);
    }
  } catch (e) {
    console.error('[proforma-scheduler]', e.message);
  } finally {
    running = false;
  }
}

function startProformaScheduler() {
  if (process.env.PROFORMA_AUTO_EXPIRE === '0') return;
  const minutes = Math.max(15, parseInt(process.env.PROFORMA_SCHEDULER_MINUTES, 10) || 60);
  if (timer) clearInterval(timer);
  timer = setInterval(tick, minutes * 60 * 1000);
  timer.unref();
  setTimeout(tick, 15000);
  console.log('[proforma-scheduler] every ' + minutes + ' min (expiry + telegram reminders)');
}

module.exports = { startProformaScheduler, tick, runNearExpiryTelegramReminders };

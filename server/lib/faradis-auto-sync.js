'use strict';

const faradis = require('../integrations/faradis');
const { query } = require('../db');
const { calcTodayJ } = require('./jalali-utils');

let timer = null;
let running = false;

async function syncInventory() {
  const rows = await faradis.fetchInventory();
  for (const r of rows) {
    await query(
      `INSERT INTO faradis_inventory_cache
         (store_num, store_name, stuff_num, stuff_name, stuff_code, count_all, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (store_num, stuff_num) DO UPDATE SET
         store_name=$2, stuff_name=$4, stuff_code=$5, count_all=$6, synced_at=NOW()`,
      [r.StoreNum, r.StoreName || '', r.StuffNum, r.StuffName || '', r.StuffCode || '', r.CountAll || 0]
    );
  }
  return rows.length;
}

async function runFaradisAutoSync() {
  if (running || !faradis.isConfigured()) return;
  running = true;
  try {
    const mtrRouter = require('../routes/mtr');
    const [cacheResult, inventoryCount] = await Promise.all([
      mtrRouter.syncFaradisCaches(),
      syncInventory(),
    ]);
    const rows = await mtrRouter.buildRowsFromCache();
    const payload = { data: rows, at: calcTodayJ(), source: 'faradis-auto' };
    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('mtr', $1, NOW(), 'faradis-auto-sync')
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(payload)]
    );
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ('mtrLastSyncAt', $1::jsonb, NOW(), 'faradis-auto-sync')
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(new Date().toISOString())]
    );
    console.log('[faradis-auto-sync] complete', {
      mtrRows: rows.length,
      inventoryRows: inventoryCount,
      caches: cacheResult,
    });
  } catch (e) {
    console.error('[faradis-auto-sync]', e.message);
  } finally {
    running = false;
  }
}

function startFaradisAutoSync() {
  if (process.env.FARADIS_AUTO_SYNC !== '1' || !faradis.isConfigured()) return;
  const minutes = Math.max(5, parseInt(process.env.FARADIS_SYNC_INTERVAL_MINUTES, 10) || 15);
  if (timer) clearInterval(timer);
  timer = setInterval(runFaradisAutoSync, minutes * 60 * 1000);
  timer.unref();
  setTimeout(runFaradisAutoSync, 5000);
  console.log('[faradis-auto-sync] scheduled every ' + minutes + ' minutes');
}

module.exports = { startFaradisAutoSync, runFaradisAutoSync };

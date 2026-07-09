'use strict';

const { pool } = require('../db');

function _genId() {
  return 'wms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function _nextTxnNo(client, type) {
  const prefix = type === 'exit' ? 'EXT' : 'ENT';
  const settingKey = type === 'exit' ? 'seq_exit' : 'seq_entry';
  await client.query(
    `INSERT INTO wms_settings (key, value, updated_at) VALUES ($1, '1000'::jsonb, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [settingKey]
  );
  const r = await client.query(
    `UPDATE wms_settings SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
     WHERE key = $1 RETURNING value::int AS seq`,
    [settingKey]
  );
  const seq = r.rows[0].seq;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function _resolveProductId(client, item) {
  if (item.prodId) {
    const r = await client.query('SELECT id FROM wms_products WHERE id = $1 AND active = true', [item.prodId]);
    if (r.rows.length) return r.rows[0].id;
  }
  if (item.catalogCode) {
    const r = await client.query(
      `SELECT id FROM wms_products WHERE catalog_code = $1 AND active = true LIMIT 1`,
      [item.catalogCode]
    );
    if (r.rows.length) return r.rows[0].id;
  }
  return null;
}

async function _defaultWarehouseId(client) {
  const r = await client.query(
    `SELECT id FROM wms_warehouses WHERE active = true ORDER BY created_at ASC LIMIT 1`
  );
  return r.rows[0]?.id || null;
}

/**
 * Create pending WMS exit transactions (حواله خروج) from an approved proforma.
 * Uses FEFO lot allocation — one transaction row per lot chunk (matches WMS approve flow).
 */
async function createDispatchFromProforma(proforma, byUser) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, txn_no, status FROM wms_transactions
       WHERE proforma_id = $1 AND status != 'cancelled' ORDER BY created_at`,
      [proforma.id]
    );
    if (existing.rows.length) {
      await client.query('COMMIT');
      return {
        already: true,
        transactionIds: existing.rows.map(function(r) { return r.id; }),
        transactions: existing.rows,
      };
    }

    const warehouseId = await _defaultWarehouseId(client);
    if (!warehouseId) {
      throw new Error('انبار فعالی در سیستم WMS تعریف نشده است');
    }

    const items = Array.isArray(proforma.items) ? proforma.items : [];
    const txnIds = [];
    const warnings = [];
    const centerLabel = proforma.centerName || proforma.center_name || '';

    for (const item of items) {
      const productId = await _resolveProductId(client, item);
      if (!productId) {
        if (item.name) warnings.push('کالای بدون شناسه انبار: ' + item.name);
        continue;
      }

      let rem = Math.round(Number(item.qty) || 0);
      if (rem <= 0) continue;

      const lotsRes = await client.query(
        `SELECT id, qty, purchase_price FROM wms_lots
         WHERE product_id = $1 AND warehouse_id = $2 AND qty > 0
         ORDER BY expiry ASC NULLS LAST, created_at ASC`,
        [productId, warehouseId]
      );

      let allocated = 0;
      for (const lot of lotsRes.rows) {
        if (rem <= 0) break;
        const lotQty = Number(lot.qty) || 0;
        if (lotQty <= 0) continue;
        const take = Math.min(rem, lotQty);
        const id = _genId();
        const txnNo = await _nextTxnNo(client, 'exit');
        const note = 'حواله از پیشفاکتور ' + (proforma.no || '') +
          (centerLabel ? ' — ' + centerLabel : '') +
          ' — ' + (item.name || '');

        await client.query(
          `INSERT INTO wms_transactions
             (id, txn_no, type, txn_type, product_id, lot_id, warehouse_id, qty,
              unit_price, sale_price, by_user, txn_date, status, note, ref_no, proforma_id)
           VALUES ($1,$2,'exit','sale',$3,$4,$5,$6,$7,$8,$9,NOW(),'pending',$10,$11,$12)`,
          [
            id, txnNo, productId, lot.id, warehouseId, take,
            Number(lot.purchase_price) || 0,
            Number(item.unitPrice) || 0,
            byUser || null,
            note,
            proforma.no || '',
            proforma.id,
          ]
        );
        txnIds.push(id);
        rem -= take;
        allocated += take;
      }

      if (rem > 0) {
        const id = _genId();
        const txnNo = await _nextTxnNo(client, 'exit');
        const note = 'کسری موجودی (' + rem + ' عدد) — پیشفاکتور ' + (proforma.no || '') +
          ' — ' + (item.name || '');
        await client.query(
          `INSERT INTO wms_transactions
             (id, txn_no, type, txn_type, product_id, lot_id, warehouse_id, qty,
              unit_price, sale_price, by_user, txn_date, status, note, ref_no, proforma_id)
           VALUES ($1,$2,'exit','sale',$3,NULL,$4,$5,$6,$7,$8,NOW(),'pending',$9,$10,$11)`,
          [
            id, txnNo, productId, warehouseId, rem,
            0, Number(item.unitPrice) || 0, byUser || null,
            note, proforma.no || '', proforma.id,
          ]
        );
        txnIds.push(id);
        warnings.push((item.name || productId) + ': کسری ' + rem + ' عدد (حواله بدون لات)');
      }
    }

    await client.query(
      `UPDATE proformas SET wms_dispatch_ids = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(txnIds), proforma.id]
    );

    await client.query('COMMIT');
    return { ok: true, transactionIds: txnIds, warnings: warnings };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getDispatchForProforma(proformaId) {
  const r = await pool.query(
    `SELECT t.id, t.txn_no, t.status, t.qty, t.product_id, t.lot_id, t.note, t.created_at,
            p.name AS product_name
     FROM wms_transactions t
     LEFT JOIN wms_products p ON p.id = t.product_id
     WHERE t.proforma_id = $1 AND t.status != 'cancelled'
     ORDER BY t.created_at ASC`,
    [proformaId]
  );
  return r.rows;
}

module.exports = { createDispatchFromProforma, getDispatchForProforma };

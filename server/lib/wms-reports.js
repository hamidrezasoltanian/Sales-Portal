'use strict';

const { query } = require('../db');
const { dateToJalali } = require('./wms-jalali');

function extraFilters(opts, idxStart) {
  const conditions = [];
  const params = [];
  let idx = idxStart || 3;
  if (opts.fiscalYearId) {
    conditions.push(`t.fiscal_year_id = $${idx++}`);
    params.push(parseInt(opts.fiscalYearId, 10));
  }
  if (opts.warehouseId) {
    conditions.push(`t.warehouse_id = $${idx++}`);
    params.push(opts.warehouseId);
  }
  if (opts.productId) {
    conditions.push(`t.product_id = $${idx++}`);
    params.push(opts.productId);
  }
  return { sql: conditions.length ? ' AND ' + conditions.join(' AND ') : '', params, nextIdx: idx };
}

async function getOpeningQty(params) {
  const fyId = parseInt(params.fiscalYearId, 10);
  if (!fyId) return 0;
  let sql = 'SELECT COALESCE(SUM(qty),0)::int AS qty FROM wms_opening_balances WHERE fiscal_year_id = $1';
  const p = [fyId];
  if (params.warehouseId) { sql += ' AND warehouse_id = $2'; p.push(params.warehouseId); }
  if (params.productId) {
    sql += params.warehouseId ? ' AND product_id = $3' : ' AND product_id = $2';
    p.push(params.productId);
  }
  const r = await query(sql, p);
  return Number(r.rows[0].qty) || 0;
}

async function dailyMovementReport(opts) {
  const fromStr = opts.from instanceof Date ? opts.from.toISOString().slice(0, 10) : String(opts.from).slice(0, 10);
  const toStr = opts.to instanceof Date ? opts.to.toISOString().slice(0, 10) : String(opts.to).slice(0, 10);
  const ext = extraFilters(opts, 3);

  const sql = `
    WITH days AS (
      SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS day
    ),
    mov AS (
      SELECT DATE(t.txn_date AT TIME ZONE 'Asia/Tehran') AS day,
             SUM(CASE WHEN t.type = 'entry' THEN t.qty ELSE 0 END)::int AS qty_in,
             SUM(CASE WHEN t.type = 'exit' THEN t.qty ELSE 0 END)::int AS qty_out,
             COUNT(*)::int AS txn_count
      FROM wms_transactions t
      WHERE t.status = 'approved'
        AND DATE(t.txn_date AT TIME ZONE 'Asia/Tehran') >= $1::date
        AND DATE(t.txn_date AT TIME ZONE 'Asia/Tehran') <= $2::date
        ${ext.sql}
      GROUP BY 1
    )
    SELECT d.day,
           COALESCE(m.qty_in, 0) AS qty_in,
           COALESCE(m.qty_out, 0) AS qty_out,
           COALESCE(m.txn_count, 0) AS txn_count
    FROM days d
    LEFT JOIN mov m ON m.day = d.day
    ORDER BY d.day ASC`;

  const r = await query(sql, [fromStr, toStr].concat(ext.params));

  let opening = opts.openingQty != null ? Number(opts.openingQty) : 0;
  if (opts.fiscalYearId && opts.openingQty == null) {
    opening = await getOpeningQty(opts);
  }

  let balance = opening;
  const rows = r.rows.map(function (row) {
    const day = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10);
    const qtyIn = Number(row.qty_in) || 0;
    const qtyOut = Number(row.qty_out) || 0;
    const openingBal = balance;
    balance = balance + qtyIn - qtyOut;
    return {
      date: day,
      dateJalali: dateToJalali(new Date(day + 'T12:00:00Z')),
      qtyIn,
      qtyOut,
      qtyNet: qtyIn - qtyOut,
      openingBalance: openingBal,
      closingBalance: balance,
      txnCount: Number(row.txn_count) || 0,
    };
  });

  return {
    from: fromStr,
    to: toStr,
    openingQty: opening,
    closingQty: balance,
    days: rows.length,
    rows,
  };
}

async function ledgerReport(opts) {
  const conditions = ["t.status = 'approved'"];
  const params = [];
  let idx = 1;

  if (opts.fiscalYearId) { conditions.push(`t.fiscal_year_id = $${idx++}`); params.push(parseInt(opts.fiscalYearId, 10)); }
  if (opts.warehouseId) { conditions.push(`t.warehouse_id = $${idx++}`); params.push(opts.warehouseId); }
  if (opts.productId) { conditions.push(`t.product_id = $${idx++}`); params.push(opts.productId); }
  if (opts.from) { conditions.push(`t.txn_date >= $${idx++}`); params.push(opts.from); }
  if (opts.to) { conditions.push(`t.txn_date <= $${idx++}`); params.push(opts.to); }

  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 500, 1), 5000);
  const offset = parseInt(opts.offset, 10) || 0;

  const r = await query(
    `SELECT t.id, t.txn_no, t.type, t.txn_type, t.product_id, t.lot_id, t.warehouse_id,
            t.qty, t.unit_price, t.sale_price, t.counterparty_id, t.txn_date, t.note, t.ref_no,
            p.name AS product_name, w.name AS warehouse_name, l.lot_no,
            cp.name AS counterparty_name
     FROM wms_transactions t
     LEFT JOIN wms_products p ON p.id = t.product_id
     LEFT JOIN wms_warehouses w ON w.id = t.warehouse_id
     LEFT JOIN wms_lots l ON l.id = t.lot_id
     LEFT JOIN wms_counterparties cp ON cp.id = t.counterparty_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.txn_date ASC, t.txn_no ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params.concat([limit, offset])
  );

  let opening = opts.openingQty != null ? Number(opts.openingQty) : 0;
  if (opts.fiscalYearId && opts.openingQty == null) {
    opening = await getOpeningQty(opts);
  }

  let balance = opening;
  const entries = r.rows.map(function (row) {
    const isIn = row.type === 'entry';
    const qty = Number(row.qty) || 0;
    const openingBal = balance;
    balance = isIn ? balance + qty : balance - qty;
    return {
      id: row.id,
      txnNo: row.txn_no,
      type: row.type,
      txnType: row.txn_type,
      productId: row.product_id,
      productName: row.product_name,
      lotId: row.lot_id,
      lotNo: row.lot_no,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      counterpartyName: row.counterparty_name,
      qty,
      qtyIn: isIn ? qty : 0,
      qtyOut: isIn ? 0 : qty,
      unitPrice: Number(row.unit_price) || 0,
      date: row.txn_date,
      dateJalali: dateToJalali(row.txn_date),
      openingBalance: openingBal,
      closingBalance: balance,
      note: row.note,
      refNo: row.ref_no,
    };
  });

  return { openingQty: opening, closingQty: balance, entries };
}

async function snapshotOpeningBalances(fiscalYearId, user) {
  const lots = await query(
    `SELECT product_id, warehouse_id, SUM(qty)::int AS qty,
            SUM(qty * COALESCE(purchase_price,0))::bigint AS value
     FROM wms_lots WHERE qty > 0
     GROUP BY product_id, warehouse_id`
  );
  await query('DELETE FROM wms_opening_balances WHERE fiscal_year_id = $1', [fiscalYearId]);
  for (const row of lots.rows) {
    await query(
      `INSERT INTO wms_opening_balances (fiscal_year_id, product_id, warehouse_id, qty, total_value, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fiscal_year_id, product_id, warehouse_id) DO UPDATE
         SET qty = EXCLUDED.qty, total_value = EXCLUDED.total_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [fiscalYearId, row.product_id, row.warehouse_id, row.qty, row.value, user]
    );
  }
  return lots.rows.length;
}

module.exports = {
  dailyMovementReport,
  ledgerReport,
  getOpeningQty,
  snapshotOpeningBalances,
};

'use strict';

const { query } = require('../db');

async function loadApprovedTransactions(productId, warehouseId) {
  const conditions = ["t.status = 'approved'"];
  const params = [];
  let idx = 1;
  if (productId) { conditions.push(`t.product_id = $${idx++}`); params.push(productId); }
  if (warehouseId && warehouseId !== 'all') { conditions.push(`t.warehouse_id = $${idx++}`); params.push(warehouseId); }

  const r = await query(
    `SELECT t.id, t.type, t.product_id, t.qty, t.txn_date,
            COALESCE(NULLIF(t.unit_price, 0), l.purchase_price, 0)::bigint AS unit_cost,
            p.name AS product_name, p.full_name, p.catalog_code, p.unit
     FROM wms_transactions t
     LEFT JOIN wms_lots l ON l.id = t.lot_id
     LEFT JOIN wms_products p ON p.id = t.product_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.txn_date ASC, t.txn_no ASC`,
    params
  );
  return r.rows;
}

async function loadLotTotals(productId, warehouseId) {
  const conditions = ['l.qty > 0'];
  const params = [];
  let idx = 1;
  if (productId) { conditions.push(`l.product_id = $${idx++}`); params.push(productId); }
  if (warehouseId && warehouseId !== 'all') { conditions.push(`l.warehouse_id = $${idx++}`); params.push(warehouseId); }

  const r = await query(
    `SELECT l.product_id, p.name AS product_name, p.full_name, p.catalog_code, p.unit,
            SUM(l.qty)::int AS lot_qty,
            SUM(l.qty * COALESCE(l.purchase_price, 0))::bigint AS lot_value
     FROM wms_lots l
     JOIN wms_products p ON p.id = l.product_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY l.product_id, p.name, p.full_name, p.catalog_code, p.unit`,
    params
  );
  return r.rows;
}

function consumeLayersFIFO(layers, qty) {
  let remaining = qty;
  while (remaining > 0 && layers.length) {
    const take = Math.min(remaining, layers[0].qty);
    layers[0].qty -= take;
    remaining -= take;
    if (layers[0].qty <= 0) layers.shift();
  }
}

function consumeLayersLIFO(layers, qty) {
  let remaining = qty;
  while (remaining > 0 && layers.length) {
    const last = layers[layers.length - 1];
    const take = Math.min(remaining, last.qty);
    last.qty -= take;
    remaining -= take;
    if (last.qty <= 0) layers.pop();
  }
}

function valueFromLayers(layers) {
  const qty = layers.reduce(function (s, l) { return s + l.qty; }, 0);
  const value = layers.reduce(function (s, l) { return s + l.qty * l.cost; }, 0);
  return { qty: qty, value: value, avgCost: qty > 0 ? value / qty : 0 };
}

function simulateFIFO(entries, exits) {
  const layers = entries.map(function (e) {
    return { qty: Number(e.qty) || 0, cost: Number(e.unit_cost) || 0 };
  });
  exits.forEach(function (e) { consumeLayersFIFO(layers, Number(e.qty) || 0); });
  return valueFromLayers(layers);
}

function simulateLIFO(entries, exits) {
  const layers = entries.map(function (e) {
    return { qty: Number(e.qty) || 0, cost: Number(e.unit_cost) || 0 };
  });
  exits.forEach(function (e) { consumeLayersLIFO(layers, Number(e.qty) || 0); });
  return valueFromLayers(layers);
}

function simulateWeighted(entries, exits) {
  const events = entries.concat(exits).sort(function (a, b) {
    return new Date(a.txn_date) - new Date(b.txn_date);
  });
  let totalQty = 0;
  let totalCost = 0;
  events.forEach(function (e) {
    const qty = Number(e.qty) || 0;
    const cost = Number(e.unit_cost) || 0;
    if (e.type === 'entry') {
      totalCost += qty * cost;
      totalQty += qty;
    } else {
      const avg = totalQty > 0 ? totalCost / totalQty : 0;
      totalCost -= qty * avg;
      totalQty -= qty;
    }
  });
  const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
  return { qty: totalQty, value: totalQty * avgCost, avgCost: avgCost };
}

async function computeValuation(opts) {
  const method = ['fifo', 'lifo', 'weighted'].includes(opts.method) ? opts.method : 'fifo';
  const productId = opts.productId || null;
  const warehouseId = opts.warehouseId || 'all';

  const txns = await loadApprovedTransactions(productId, warehouseId);
  const lotTotals = await loadLotTotals(productId, warehouseId);

  const byProduct = {};
  txns.forEach(function (r) {
    if (!byProduct[r.product_id]) {
      byProduct[r.product_id] = {
        productId: r.product_id,
        productName: r.full_name || r.product_name,
        catalogCode: r.catalog_code || '',
        unit: r.unit || 'عدد',
        entries: [],
        exits: [],
      };
    }
    if (r.type === 'entry') byProduct[r.product_id].entries.push(r);
    else if (r.type === 'exit') byProduct[r.product_id].exits.push(r);
  });

  lotTotals.forEach(function (row) {
    if (!byProduct[row.product_id]) {
      byProduct[row.product_id] = {
        productId: row.product_id,
        productName: row.full_name || row.product_name,
        catalogCode: row.catalog_code || '',
        unit: row.unit || 'عدد',
        entries: [],
        exits: [],
      };
    }
  });

  const products = [];
  let grandQty = 0;
  let grandValue = 0;

  Object.keys(byProduct).forEach(function (pid) {
    const p = byProduct[pid];
    const lotRow = lotTotals.find(function (r) { return r.product_id === pid; });
    const lotQty = lotRow ? Number(lotRow.lot_qty) : 0;
    const lotValue = lotRow ? Number(lotRow.lot_value) : 0;

    let result;
    if (p.entries.length === 0 && p.exits.length === 0) {
      result = { qty: lotQty, value: lotValue, avgCost: lotQty > 0 ? lotValue / lotQty : 0 };
    } else if (method === 'weighted') {
      result = simulateWeighted(p.entries, p.exits);
    } else if (method === 'lifo') {
      result = simulateLIFO(p.entries, p.exits);
    } else {
      result = simulateFIFO(p.entries, p.exits);
    }

    const qty = lotQty > 0 ? lotQty : result.qty;
    const totalValue = Math.round(result.value);
    products.push({
      productId: pid,
      productName: p.productName,
      catalogCode: p.catalogCode,
      unit: p.unit,
      qty: qty,
      simulatedQty: Math.round(result.qty),
      totalValue: totalValue,
      avgUnitCost: Math.round(result.avgCost),
      lotSpecificValue: lotValue,
      qtyVariance: lotQty - Math.round(result.qty),
    });
    grandQty += qty;
    grandValue += totalValue;
  });

  products.sort(function (a, b) { return (a.productName || '').localeCompare(b.productName || '', 'fa'); });

  return {
    method: method,
    methodLabel: method === 'fifo' ? 'FIFO (اولین ورود)' : method === 'lifo' ? 'LIFO (آخرین ورود)' : 'میانگین موزون',
    warehouseId: warehouseId,
    totalQty: grandQty,
    totalValue: Math.round(grandValue),
    productCount: products.length,
    products: products,
  };
}

module.exports = { computeValuation, simulateFIFO, simulateLIFO, simulateWeighted };

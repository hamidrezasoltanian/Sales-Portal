'use strict';

// Critical-path integration: approved proforma -> FEFO dispatch -> invoice
// -> proof of delivery -> receivable -> settlement. Run only against a
// disposable PG_DATABASE (atena_crm_test_*).
const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const { query, pool } = require('../server/db');

const TEST_PORT = Number(process.env.TEST_PORT || 3102);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';
const MANAGER = '_tfulfill_manager';
const MANAGER_ROLE = '\u0645\u062f\u06cc\u0631';
const PREFIX = '_tfulfill_' + Date.now().toString(36);
let serverProc;

function token(role, username) {
  return jwt.sign({ username: username || MANAGER, role: role || MANAGER_ROLE, name: 'Fulfillment Test Manager' }, JWT_SECRET, { expiresIn: '1h' });
}

function request(method, urlPath, body, auth) {
  return new Promise((resolve, reject) => {
    const raw = body == null ? '' : JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: TEST_PORT, path: urlPath, method,
      headers: {
        Authorization: 'Bearer ' + token(auth && auth.role, auth && auth.username),
        'Content-Type': 'application/json',
        ...(raw ? { 'Content-Length': Buffer.byteLength(raw) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await request('GET', '/api/health')).status === 200) return;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('fulfillment test server did not start');
}

async function seed() {
  const product = PREFIX + '_product';
  const warehouse = PREFIX + '_warehouse';
  const earlyLot = PREFIX + '_lot_early';
  const lateLot = PREFIX + '_lot_late';
  const proforma = PREFIX + '_pf';
  await query(`INSERT INTO app_users (username,display_name,role,color,active)
    VALUES ($1,'Fulfillment Test Manager',$2,'#6366f1',true)
    ON CONFLICT (username) DO UPDATE SET role=EXCLUDED.role,active=true`, [MANAGER, MANAGER_ROLE]);
  await query(`INSERT INTO app_users (username,display_name,role,color,active)
    VALUES ('_tfulfill_sales','Fulfillment Test Sales','کارشناس فروش','#10b981',true)
    ON CONFLICT (username) DO UPDATE SET role=EXCLUDED.role,active=true`);
  await query(`INSERT INTO app_users (username,display_name,role,color,active)
    VALUES ('_tfulfill_finance','Fulfillment Test Finance','مالی','#f59e0b',true)
    ON CONFLICT (username) DO UPDATE SET role=EXCLUDED.role,active=true`);
  await query(`INSERT INTO wms_products (id,name,sale_price) VALUES ($1,'Fulfillment Test Product',1000)`, [product]);
  await query(`INSERT INTO wms_warehouses (id,name) VALUES ($1,'Fulfillment Test Warehouse')`, [warehouse]);
  await query(`INSERT INTO wms_lots (id,product_id,warehouse_id,lot_no,qty,expiry,purchase_price)
    VALUES ($1,$2,$3,'EARLY',2,'2026-08-01',500),($4,$2,$3,'LATE',2,'2026-12-01',500)`,
    [earlyLot, product, warehouse, lateLot]);
  await query(`INSERT INTO proformas
    (id,no,jalali_date,center_key,center_name,items,subtotal,tax_pct,tax_amt,total,status,created_by)
    VALUES ($1,$2,'1405/05/01',$3,'Fulfillment Test Center',$4::jsonb,2000,9,180,2180,'approved',$5)`,
    [proforma, 'PF-' + PREFIX, PREFIX + '_center', JSON.stringify([{ prodId: product, name: 'Fulfillment Test Product', qty: 2, unitPrice: 1000 }]), MANAGER]);
  return { product, warehouse, earlyLot, lateLot, proforma };
}

async function main() {
  if (!/^atena_crm_test_[a-z0-9_]+$/i.test(process.env.PG_DATABASE || '')) {
    throw new Error('sales-order fulfillment test requires a disposable atena_crm_test_* database');
  }
  const data = await seed();
  serverProc = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(TEST_PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stderr.on('data', () => {});
  await waitForServer();

  const made = await request('POST', '/api/sales-orders/from-proforma/' + data.proforma, { warehouseId: data.warehouse });
  assert.strictEqual(made.status, 201, 'approved proforma creates a sales order');
  const orderId = made.body.order.id;
  const detail = await request('GET', '/api/sales-orders/' + orderId);
  assert.strictEqual(detail.status, 200, 'sales order is readable');
  const item = detail.body.items[0];

  const preview = await request('GET', '/api/sales-orders/' + orderId + '/dispatch-preview');
  assert.strictEqual(preview.status, 200, 'dispatch preview is available');
  assert.strictEqual(preview.body.lines[0].allocations[0].lotId, data.earlyLot, 'preview selects earliest expiry lot');

  const nonFefo = await request('POST', '/api/sales-orders/' + orderId + '/dispatch', {
    idempotencyKey: PREFIX + '_nonfefo',
    lines: [{ salesOrderItemId: item.id, allocations: [{ lotId: data.lateLot, qty: 2 }] }],
  });
  assert.strictEqual(nonFefo.status, 400, 'late lot is rejected without a documented FEFO override');

  const dispatchPayload = {
    idempotencyKey: PREFIX + '_dispatch',
    lines: [{ salesOrderItemId: item.id, allocations: [{ lotId: data.earlyLot, qty: 2 }] }],
  };
  const dispatched = await request('POST', '/api/sales-orders/' + orderId + '/dispatch', dispatchPayload);
  assert.strictEqual(dispatched.status, 201, 'FEFO dispatch reserves the selected lot');
  assert.strictEqual(dispatched.body.orderStatus, 'fully_dispatched', 'order becomes fully dispatched');
  const replay = await request('POST', '/api/sales-orders/' + orderId + '/dispatch', dispatchPayload);
  assert.strictEqual(replay.status, 200, 'dispatch retry is idempotent');
  assert.strictEqual(replay.body.already, true, 'dispatch retry reports prior reservation');

  const financeQueue = await request('GET', '/api/sales-orders/work/queue/finance');
  const financeWork = financeQueue.body.find((row) => row.source_id === orderId);
  assert(financeWork, 'dispatch opens finance work');
  const salesRole = { role: '\u06a9\u0627\u0631\u0634\u0646\u0627\u0633 \u0641\u0631\u0648\u0634', username: '_tfulfill_sales' };
  const invalidAssignment = await request('POST', '/api/sales-orders/work/' + encodeURIComponent(financeWork.id) + '/assign', { username: salesRole.username });
  assert.strictEqual(invalidAssignment.status, 400, 'manager cannot assign a queue to an unauthorized user');
  const financeAssignment = await request('POST', '/api/sales-orders/work/' + encodeURIComponent(financeWork.id) + '/assign', { username: '_tfulfill_finance' });
  assert.strictEqual(financeAssignment.status, 200, 'manager can assign finance work to an authorized finance user');

  const invoiced = await request('POST', '/api/invoices/from-dispatches', { salesOrderId: orderId, jalali_date: '1405/05/01' });
  assert.strictEqual(invoiced.status, 201, 'reserved dispatches create an invoice');
  assert.strictEqual(Number(invoiced.body.total), 2180, 'invoice includes the configured tax');

  const deniedDelivery = await request('POST', '/api/invoices/' + invoiced.body.id + '/delivery-receipt', { receiver_name: 'Denied' }, salesRole);
  assert.strictEqual(deniedDelivery.status, 403, 'only warehouse-authorized users can record delivery');
  const deniedPayment = await request('POST', '/api/invoices/' + invoiced.body.id + '/payment', { amount: 1, jalali_date: '1405/05/02' }, salesRole);
  assert.strictEqual(deniedPayment.status, 403, 'only finance/receivables-authorized users can register payment');
  const deniedFinanceQueue = await request('GET', '/api/sales-orders/work/queue/finance', null, salesRole);
  assert.strictEqual(deniedFinanceQueue.status, 403, 'sales users cannot read the finance queue');

  const delivered = await request('POST', '/api/invoices/' + invoiced.body.id + '/delivery-receipt', {
    receiver_name: 'Fulfillment Receiver', due_date: '1405/05/15', owner: MANAGER,
  });
  assert.strictEqual(delivered.status, 201, 'delivery receipt activates receivables');
  assert.strictEqual(delivered.body.receivableStatus, 'open', 'unpaid delivery opens a receivable');
  assert.strictEqual(Number(delivered.body.outstanding), 2180, 'receivable equals invoice total');

  const receivables = await request('GET', '/api/receivables?status=open');
  const receivable = receivables.body.find((row) => row.invoice_id === invoiced.body.id);
  assert(receivable, 'open receivable appears in the receivables queue');
  const payment = await request('POST', '/api/invoices/' + invoiced.body.id + '/payment', {
    amount: 2180, jalali_date: '1405/05/02', method: 'transfer', ref_no: PREFIX,
  });
  assert.strictEqual(payment.status, 201, 'payment is registered');
  assert.strictEqual(payment.body.status, 'paid', 'full payment closes the invoice');
  const settled = await query('SELECT status,outstanding_amount FROM receivables WHERE id=$1', [receivable.id]);
  assert.strictEqual(settled.rows[0].status, 'settled', 'full payment settles the receivable');
  assert.strictEqual(Number(settled.rows[0].outstanding_amount), 0, 'settled receivable has no balance');
  console.log('sales-order fulfillment: 16 assertions passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (serverProc) serverProc.kill('SIGTERM');
  await pool.end().catch(() => {});
});

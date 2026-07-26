'use strict';

const express = require('express');
const { pool, query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function isManager(role) { return ['مدیر', 'سوپر ادمین'].includes(role); }
function isFinance(role) { return isManager(role) || role === 'مالی'; }

async function nextNo(client, prefix, jalaliDate) {
  const year = String(jalaliDate || '').split('/')[0] || String(new Date().getFullYear());
  const r = await client.query(
    `SELECT MAX(CAST(SUBSTRING(order_no FROM '\\d+$') AS INTEGER)) AS seq
     FROM sales_orders WHERE order_no LIKE $1`, [`${prefix}-${year}-%`]
  );
  const seq = r.rows[0] && r.rows[0].seq != null ? Number(r.rows[0].seq) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

async function syncOrderStatus(client, orderId) {
  const r = await client.query(
    `SELECT oi.qty_ordered, oi.qty_reserved, oi.qty_invoiced,
            COALESCE(SUM(CASE WHEN t.status IN ('reserved','approved','delivered') THEN t.qty ELSE 0 END),0) AS txn_qty
       FROM sales_order_items oi
       LEFT JOIN wms_transactions t ON t.sales_order_id = oi.sales_order_id
          AND t.product_id IS NOT DISTINCT FROM oi.product_id
          AND t.status IN ('reserved','approved','delivered')
      WHERE oi.sales_order_id=$1
      GROUP BY oi.id`, [orderId]
  );
  let any = false, complete = r.rows.length > 0;
  r.rows.forEach(function (x) {
    const qty = Number(x.qty_reserved || x.txn_qty || 0);
    any = any || qty > 0;
    complete = complete && qty >= Number(x.qty_ordered);
  });
  const status = complete ? 'fully_dispatched' : any ? 'partial_dispatch' : 'awaiting_dispatch';
  await client.query(`UPDATE sales_orders SET status=$2, updated_at=NOW() WHERE id=$1 AND status NOT IN ('cancelled','closed')`, [orderId, status]);
  return status;
}

async function openWork(client, sourceType, sourceId, queue, title, meta) {
  const id = `${sourceType}:${sourceId}:${queue}`;
  await client.query(
    `INSERT INTO sales_work_items (id,source_type,source_id,queue,title,meta)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (id) DO UPDATE SET status='open', title=EXCLUDED.title, meta=EXCLUDED.meta, updated_at=NOW()`,
    [id, sourceType, sourceId, queue, title, JSON.stringify(meta || {})]
  );
}

async function closeWork(client, sourceType, sourceId, queue) {
  await client.query(`UPDATE sales_work_items SET status='done', updated_at=NOW() WHERE id=$1`, [`${sourceType}:${sourceId}:${queue}`]);
}

// Create exactly one active sales order from an approved proforma.
router.post('/from-proforma/:id', requirePermission('proforma', 'edit'), async function (req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pfR = await client.query('SELECT * FROM proformas WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!pfR.rows.length) return res.status(404).json({ error: 'پیش‌فاکتور یافت نشد' });
    const pf = pfR.rows[0];
    if (pf.status !== 'approved') return res.status(400).json({ error: 'فقط پیش‌فاکتور تأییدشده قابل تبدیل به سفارش است' });
    if (!isManager(req.user.role) && pf.created_by !== req.user.username) return res.status(403).json({ error: 'دسترسی ندارید' });
    const existing = await client.query(`SELECT * FROM sales_orders WHERE proforma_id=$1 AND status <> 'cancelled'`, [pf.id]);
    if (existing.rows.length) {
      await client.query('COMMIT');
      return res.json({ already: true, order: existing.rows[0] });
    }
    const id = uid('so');
    const no = await nextNo(client, 'SO', pf.jalali_date);
    const warehouseId = (req.body && req.body.warehouseId) || pf.wms_warehouse_id || null;
    const items = Array.isArray(pf.items) ? pf.items : [];
    if (!items.length) return res.status(400).json({ error: 'پیش‌فاکتور قلم کالا ندارد' });
    const r = await client.query(
      `INSERT INTO sales_orders (id,order_no,proforma_id,center_key,center_name,warehouse_id,payment_terms,sales_owner,created_by,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, no, pf.id, pf.center_key, pf.center_name, warehouseId, pf.payment_terms || '', pf.sales_owner || pf.created_by, req.user.username, pf.note || '']
    );
    for (const item of items) {
      const qty = Math.round(Number(item.qty) || 0);
      if (qty <= 0) continue;
      await client.query(
        `INSERT INTO sales_order_items (id,sales_order_id,product_id,item_name,qty_ordered,unit_price,line_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uid('soi'), id, item.prodId || null, item.name || 'کالا', qty, Number(item.unitPrice) || 0, item.note || '']
      );
    }
    await openWork(client, 'sales_order', id, 'warehouse', `صدور حواله برای سفارش ${no}`, { orderNo: no, centerName: pf.center_name || '' });
    await client.query('COMMIT');
    res.status(201).json({ order: r.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    console.error('[sales-orders from-proforma]', e.message);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.get('/', requirePermission('proforma', 'view'), async function (req, res) {
  try {
    const params = [], where = [];
    if (req.query.status) { params.push(req.query.status); where.push(`o.status=$${params.length}`); }
    if (!isManager(req.user.role)) { params.push(req.user.username); where.push(`o.sales_owner=$${params.length}`); }
    const r = await query(`SELECT o.*, COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
      FROM sales_orders o LEFT JOIN sales_order_items oi ON oi.sales_order_id=o.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requirePermission('proforma', 'view'), async function (req, res) {
  try {
    const order = await query(`SELECT * FROM sales_orders WHERE id=$1`, [req.params.id]);
    if (!order.rows.length) return res.status(404).json({ error: 'سفارش یافت نشد' });
    const o = order.rows[0];
    if (!isManager(req.user.role) && o.sales_owner !== req.user.username) return res.status(403).json({ error: 'دسترسی ندارید' });
    const [items, txns] = await Promise.all([
      query(`SELECT * FROM sales_order_items WHERE sales_order_id=$1 ORDER BY id`, [o.id]),
      query(`SELECT * FROM wms_transactions WHERE sales_order_id=$1 ORDER BY created_at`, [o.id]),
    ]);
    res.json({ order: o, items: items.rows, dispatches: txns.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Preview deliberately does not lock lots. Commit below always revalidates it.
router.get('/:id/dispatch-preview', requirePermission('wms', 'view'), async function (req, res) {
  try {
    const orderR = await query(`SELECT * FROM sales_orders WHERE id=$1`, [req.params.id]);
    if (!orderR.rows.length) return res.status(404).json({ error: 'سفارش یافت نشد' });
    const order = orderR.rows[0];
    if (!order.warehouse_id) return res.status(400).json({ error: 'انبار سفارش تعیین نشده است' });
    const itemR = await query(`SELECT * FROM sales_order_items WHERE sales_order_id=$1`, [order.id]);
    const lines = [];
    for (const item of itemR.rows) {
      const need = Number(item.qty_ordered) - Number(item.qty_reserved);
      const lots = item.product_id ? await query(
        `SELECT id,lot_no,qty,reserved_qty,expiry FROM wms_lots
         WHERE warehouse_id=$1 AND product_id=$2 AND qty > reserved_qty
         ORDER BY expiry ASC NULLS LAST, created_at ASC`, [order.warehouse_id, item.product_id]
      ) : { rows: [] };
      let remaining = Math.max(0, need);
      const allocations = lots.rows.map(function (lot) {
        const available = Number(lot.qty) - Number(lot.reserved_qty || 0);
        const qty = Math.min(available, remaining); remaining -= qty;
        return { lotId: lot.id, lotNo: lot.lot_no, expiry: lot.expiry, qty, available };
      }).filter(function (x) { return x.qty > 0; });
      lines.push({ salesOrderItemId: item.id, productId: item.product_id, name: item.item_name, requiredQty: need, allocations, shortage: remaining });
    }
    res.json({ orderId: order.id, warehouseId: order.warehouse_id, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reserve FEFO lots as a dispatch. It is idempotent and locks the exact lots.
router.post('/:id/dispatch', requirePermission('wms', 'edit'), async function (req, res) {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const key = String(body.idempotencyKey || '').trim();
    if (!key) return res.status(400).json({ error: 'idempotencyKey الزامی است' });
    if (!Array.isArray(body.lines) || !body.lines.length) return res.status(400).json({ error: 'اقلام حواله الزامی است' });
    await client.query('BEGIN');
    // Every lot row gets a derived key. A browser retry must return the first
    // reservation rather than create a second one.
    const old = await client.query(`SELECT * FROM wms_transactions WHERE idempotency_key LIKE $1 || ':%'`, [key]);
    if (old.rows.length) { await client.query('COMMIT'); return res.json({ already: true, dispatches: old.rows }); }
    const orderR = await client.query(`SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!orderR.rows.length) return res.status(404).json({ error: 'سفارش یافت نشد' });
    const order = orderR.rows[0];
    if (['cancelled','closed'].includes(order.status)) return res.status(400).json({ error: 'سفارش قابل حواله نیست' });
    if (!order.warehouse_id) return res.status(400).json({ error: 'انبار سفارش تعیین نشده است' });
    const created = [];
    for (const line of body.lines) {
      const itemR = await client.query(`SELECT * FROM sales_order_items WHERE id=$1 AND sales_order_id=$2 FOR UPDATE`, [line.salesOrderItemId, order.id]);
      if (!itemR.rows.length) throw new Error('ردیف سفارش نامعتبر است');
      const item = itemR.rows[0];
      const allocations = Array.isArray(line.allocations) ? line.allocations : [];
      const requested = allocations.reduce(function (s, x) { return s + Math.round(Number(x.qty) || 0); }, 0);
      if (requested <= 0 || requested + Number(item.qty_reserved) > Number(item.qty_ordered)) throw new Error('مقدار حواله از باقیمانده سفارش بیشتر است');
      for (const alloc of allocations) {
        const qty = Math.round(Number(alloc.qty) || 0);
        if (qty <= 0) continue;
        const lotR = await client.query(`SELECT * FROM wms_lots WHERE id=$1 AND warehouse_id=$2 AND product_id=$3 FOR UPDATE`, [alloc.lotId, order.warehouse_id, item.product_id]);
        if (!lotR.rows.length) throw new Error('لات انتخاب‌شده نامعتبر است');
        const lot = lotR.rows[0];
        const available = Number(lot.qty) - Number(lot.reserved_qty || 0);
        if (qty > available) { const err = new Error('موجودی لات تغییر کرده است'); err.code = 'STALE_ALLOCATION'; throw err; }
        // Enforce FEFO during the transaction, not only in the advisory
        // preview. A later lot needs an explicit, documented override.
        const earlierLotR = await client.query(
          `SELECT id FROM wms_lots
             WHERE warehouse_id=$1 AND product_id=$2 AND qty > reserved_qty
             ORDER BY expiry ASC NULLS LAST, created_at ASC
             LIMIT 1`,
          [order.warehouse_id, item.product_id]
        );
        const earlierLotId = earlierLotR.rows[0] && earlierLotR.rows[0].id;
        const override = !!alloc.fefoViolation;
        if (earlierLotId && earlierLotId !== lot.id && !override) {
          throw new Error('Non-FEFO lot selection requires an override reason');
        }
        const txnId = uid('wms');
        const txnNo = 'HV-' + Date.now().toString(36).toUpperCase() + '-' + String(created.length + 1).padStart(2, '0');
        if (override && !String(alloc.fefoReason || '').trim()) throw new Error('دلیل انتخاب غیر FEFO الزامی است');
        await client.query(`UPDATE wms_lots SET reserved_qty=reserved_qty+$1 WHERE id=$2`, [qty, lot.id]);
        const ins = await client.query(`INSERT INTO wms_transactions
          (id,txn_no,type,txn_type,product_id,lot_id,warehouse_id,qty,unit_price,sale_price,counterparty_id,by_user,txn_date,status,note,ref_no,proforma_id,sales_order_id,sales_order_item_id,idempotency_key)
          VALUES ($1,$2,'exit','sales_dispatch',$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'reserved',$11,$12,$13,$14,$15,$16) RETURNING *`,
          [txnId, txnNo, item.product_id, lot.id, order.warehouse_id, qty, Number(lot.purchase_price) || 0, Number(item.unit_price) || 0,
           order.center_key || null, req.user.username, alloc.note || '', order.order_no, order.proforma_id || null, order.id, item.id, key + ':' + item.id + ':' + lot.id]
        );
        created.push(ins.rows[0]);
      }
      await client.query(`UPDATE sales_order_items SET qty_reserved=qty_reserved+$1 WHERE id=$2`, [requested, item.id]);
    }
    const status = await syncOrderStatus(client, order.id);
    await closeWork(client, 'sales_order', order.id, 'warehouse');
    await openWork(client, 'sales_order', order.id, 'finance', `صدور فاکتور برای سفارش ${order.order_no}`, { orderNo: order.order_no, dispatchStatus: status });
    await client.query('COMMIT');
    res.status(201).json({ dispatches: created, orderStatus: status });
  } catch (e) {
    await client.query('ROLLBACK').catch(function () {});
    const status = e.code === 'STALE_ALLOCATION' ? 409 : 400;
    res.status(status).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/:id/cancel', requirePermission('proforma', 'edit'), async function (req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'سفارش یافت نشد' });
    const order = r.rows[0];
    if (!isManager(req.user.role) && order.sales_owner !== req.user.username) return res.status(403).json({ error: 'دسترسی ندارید' });
    const dispatches = await client.query(`SELECT * FROM wms_transactions WHERE sales_order_id=$1 AND status IN ('reserved','approved') FOR UPDATE`, [order.id]);
    for (const d of dispatches.rows) {
      if (d.status === 'approved') throw new Error('برای لغو سفارش ابتدا فاکتور/حواله نهایی باید اصلاح شود');
      await client.query(`UPDATE wms_lots SET reserved_qty=GREATEST(0,reserved_qty-$1) WHERE id=$2`, [Number(d.qty), d.lot_id]);
      await client.query(`UPDATE wms_transactions SET status='cancelled' WHERE id=$1`, [d.id]);
    }
    await client.query(`UPDATE sales_orders SET status='cancelled',cancelled_at=NOW(),cancelled_by=$2,cancel_reason=$3,updated_at=NOW() WHERE id=$1`, [order.id, req.user.username, String(req.body && req.body.reason || '')]);
    await closeWork(client, 'sales_order', order.id, 'warehouse'); await closeWork(client, 'sales_order', order.id, 'finance');
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(function () {}); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.get('/work/queue/:queue', requireAuth, async function (req, res) {
  try {
    const r = await query(`SELECT * FROM sales_work_items WHERE queue=$1 AND status='open' ORDER BY created_at`, [req.params.queue]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/work/:id/claim', requireAuth, async function (req, res) {
  try {
    const r = await query(`UPDATE sales_work_items SET claimed_by=$2,owner=$2,status='claimed',updated_at=NOW() WHERE id=$1 AND status IN ('open','claimed') RETURNING *`, [req.params.id, req.user.username]);
    if (!r.rows.length) return res.status(404).json({ error: 'کار یافت نشد یا بسته شده است' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

'use strict';

const express   = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// ── Row mappers (SQL → JS camelCase) ─────────────────────────────────────────
function rowToProduct(r) {
  return { id:r.id, name:r.name, fullName:r.full_name, brand:r.brand, size:r.size,
           catalogCode:r.catalog_code, ircCode:r.irc_code, unit:r.unit,
           category:r.category, reorderPoint:r.reorder_point, note:r.note, active:r.active };
}
function rowToWarehouse(r) {
  return { id:r.id, name:r.name, location:r.location, managerId:r.manager_id, note:r.note, active:r.active };
}
function rowToCounterparty(r) {
  return { id:r.id, name:r.name, type:r.type, phone:r.phone, address:r.address,
           taxCode:r.tax_code, email:r.email, note:r.note, active:r.active };
}
function rowToLot(r) {
  return { id:r.id, productId:r.product_id, warehouseId:r.warehouse_id, lotNo:r.lot_no,
           qty:Number(r.qty), expiry:r.expiry?r.expiry.toISOString().split('T')[0]:null,
           purchasePrice:Number(r.purchase_price), counterpartyId:r.counterparty_id,
           txnId:r.txn_id, date:r.lot_date, enteredBy:r.entered_by, approvedBy:r.approved_by,
           ttacNo:r.ttac_no, imedStatus:r.imed_status, imedRefNo:r.imed_ref_no };
}
function rowToTransaction(r) {
  return { id:r.id, txnNo:r.txn_no, type:r.type, txnType:r.txn_type,
           productId:r.product_id, lotId:r.lot_id, warehouseId:r.warehouse_id,
           qty:Number(r.qty), unitPrice:Number(r.unit_price), salePrice:Number(r.sale_price),
           counterpartyId:r.counterparty_id, fromWarehouseId:r.from_warehouse_id,
           toWarehouseId:r.to_warehouse_id, by:r.by_user,
           date:r.txn_date, status:r.status, note:r.note, refNo:r.ref_no,
           imedStatus:r.imed_status, imedRefNo:r.imed_ref_no, imedDate:r.imed_date,
           ttacNo:r.ttac_no };
}
function rowToPO(r) {
  return { id:r.id, poNo:r.po_no, supplierId:r.supplier_id, warehouseId:r.warehouse_id,
           requestedBy:r.requested_by, approvedBy:r.approved_by, approvedAt:r.approved_at,
           status:r.status, items:r.items, date:r.po_date, expectedDelivery:r.expected_delivery,
           note:r.note, imedStatus:r.imed_status };
}
function _recallRow(r) {
  return { id:r.id, lotId:r.lot_id, productId:r.product_id, severity:r.severity,
           status:r.status, description:r.description, affectedQty:r.affected_qty,
           action:r.action, resolvedAt:r.resolved_at, createdBy:r.created_by };
}
function _defaultPrintConfig() {
  return { companyName:'آتنا زیست درمان', companySub:'توزیع‌کننده تجهیزات پزشکی',
           entryTitle:'رسید ورود کالا', exitTitle:'حواله خروج کالا',
           showQR:true, showCompanyLogo:true, showBrand:true, showSize:true,
           showCatalogCode:true, showIRC:true, showLot:true, showExpiry:true,
           showUnitPrice:true, showTotal:true, showNote:true,
           showMetaRef:true, showMetaWh:true, showMetaRegistrar:true, showMetaPhone:true,
           showSig:true, sig1Name:'', sig1Role:'تأییدکننده', sig2Name:'', sig2Role:'مدیر',
           sig3Name:'', sig3Role:'انباردار', footer:'', fontSize:12 };
}
function _genId() {
  return 'wms_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
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

// ════════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE BLOB ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

router.get('/', requireAuth, async (req, res) => {
  try {
    const [products, warehouses, counterparties, lots, transactions, purchaseOrders, recalls] =
      await Promise.all([
        query('SELECT * FROM wms_products WHERE active = true ORDER BY name'),
        query('SELECT * FROM wms_warehouses WHERE active = true ORDER BY name'),
        query('SELECT * FROM wms_counterparties WHERE active = true ORDER BY name'),
        query('SELECT * FROM wms_lots ORDER BY created_at DESC LIMIT 2000'),
        query('SELECT * FROM wms_transactions ORDER BY txn_date DESC LIMIT 1000'),
        query('SELECT * FROM wms_purchase_orders ORDER BY created_at DESC LIMIT 500'),
        query('SELECT * FROM wms_recalls WHERE status != $1 ORDER BY created_at DESC LIMIT 200', ['resolved']),
      ]);

    const settingsRows = await query('SELECT key, value FROM wms_settings');
    const settings = {};
    settingsRows.rows.forEach(function(r){ settings[r.key] = r.value; });

    const S = {
      seq:           settings.seq           || { entry:1000, exit:2000, count:3000, po:1000, priceItem:100, recall:100 },
      printConfig:   settings.printConfig   || _defaultPrintConfig(),
      priceLists:    settings.priceLists    || [],
      priceItems:    settings.priceItems    || [],
      priceHistory:  settings.priceHistory  || [],
      stockCounts:   settings.stockCounts   || [],
      reconciliations: settings.reconciliations || [],
      auditLog:      [],
      users:         [],

      products: products.rows.map(rowToProduct),
      warehouses: warehouses.rows.map(rowToWarehouse),
      counterparties: counterparties.rows.map(rowToCounterparty),
      lots:         lots.rows.map(rowToLot),
      transactions: transactions.rows.map(rowToTransaction),
      purchaseOrders: purchaseOrders.rows.map(rowToPO),
      recalls:      recalls.rows.map(_recallRow),
    };

    res.json(S);
  } catch(e) {
    console.error('[wms GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const S = req.body;
    if (!S || typeof S !== 'object') {
      return res.status(400).json({ error: 'داده نامعتبر' });
    }

    const client = await require('../db').pool.connect();
    try {
      await client.query('BEGIN');

      for (const p of (S.products || [])) {
        await client.query(
          `INSERT INTO wms_products (id,name,full_name,brand,size,catalog_code,irc_code,unit,category,reorder_point,note,active,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
           ON CONFLICT (id) DO UPDATE SET
             name=$2,full_name=$3,brand=$4,size=$5,catalog_code=$6,irc_code=$7,
             unit=$8,category=$9,reorder_point=$10,note=$11,active=$12,updated_at=NOW()`,
          [p.id,p.name||'',p.fullName||'',p.brand||'',p.size||'',
           p.catalogCode||'',p.ircCode||'',p.unit||'عدد',p.category||'',
           p.reorderPoint||10,p.note||'',p.active!==false]
        );
      }
      for (const w of (S.warehouses || [])) {
        await client.query(
          `INSERT INTO wms_warehouses (id,name,location,manager_id,note,active)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET name=$2,location=$3,manager_id=$4,note=$5,active=$6`,
          [w.id,w.name||'',w.location||'',w.managerId||'',w.note||'',w.active!==false]
        );
      }
      for (const c of (S.counterparties || [])) {
        const t = ['supplier','customer','both'].includes(c.type) ? c.type : 'both';
        await client.query(
          `INSERT INTO wms_counterparties (id,name,type,phone,address,tax_code,email,note,active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET name=$2,type=$3,phone=$4,address=$5,tax_code=$6,email=$7,note=$8,active=$9`,
          [c.id,c.name||'',t,c.phone||'',c.address||'',c.taxCode||'',c.email||'',c.note||'',c.active!==false]
        );
      }
      for (const l of (S.lots || [])) {
        await client.query(
          `INSERT INTO wms_lots (id,product_id,warehouse_id,lot_no,qty,expiry,purchase_price,
             counterparty_id,txn_id,lot_date,entered_by,approved_by,ttac_no,imed_status,imed_ref_no)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE SET
             qty=$5,ttac_no=$13,imed_status=$14,imed_ref_no=$15`,
          [l.id,l.productId||null,l.warehouseId||null,l.lotNo||'',l.qty||0,
           l.expiry||null,l.purchasePrice||0,l.counterpartyId||null,l.txnId||null,
           l.date||null,l.enteredBy||null,l.approvedBy||null,
           l.ttacNo||'',l.imedStatus||'not_registered',l.imedRefNo||'']
        );
      }
      for (const t of (S.transactions || [])) {
        await client.query(
          `INSERT INTO wms_transactions
             (id,txn_no,type,txn_type,product_id,lot_id,warehouse_id,qty,unit_price,sale_price,
              counterparty_id,from_warehouse_id,to_warehouse_id,by_user,txn_date,status,note,
              ref_no,imed_status,imed_ref_no,imed_date,ttac_no)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
           ON CONFLICT (id) DO UPDATE SET status=$16,note=$17,imed_status=$19,imed_ref_no=$20,imed_date=$21,ttac_no=$22`,
          [t.id,t.txnNo||null,t.type||'entry',t.txnType||'',
           t.productId||null,t.lotId||null,t.warehouseId||null,
           t.qty||0,t.unitPrice||0,t.salePrice||0,t.counterpartyId||null,
           t.fromWarehouseId||null,t.toWarehouseId||null,t.by||null,
           t.date||new Date(),t.status||'pending',t.note||'',
           t.refNo||'',t.imedStatus||'not_registered',t.imedRefNo||'',t.imedDate||'',t.ttacNo||'']
        );
      }
      for (const po of (S.purchaseOrders || [])) {
        await client.query(
          `INSERT INTO wms_purchase_orders (id,po_no,supplier_id,warehouse_id,requested_by,
             approved_by,approved_at,status,items,po_date,expected_delivery,note,imed_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (id) DO UPDATE SET
             status=$8,items=$9,approved_by=$6,approved_at=$7,note=$12,imed_status=$13`,
          [po.id,po.poNo||null,po.supplierId||null,po.warehouseId||null,
           po.requestedBy||null,po.approvedBy||null,po.approvedAt||null,
           po.status||'draft',JSON.stringify(po.items||[]),
           po.date||null,po.expectedDelivery||null,po.note||'',
           po.imedStatus||'not_registered']
        );
      }
      const settingsKeys = ['printConfig','priceLists','priceItems','priceHistory','seq','stockCounts','reconciliations'];
      for (const k of settingsKeys) {
        if (S[k] !== undefined) {
          await client.query(
            `INSERT INTO wms_settings (key,value,updated_at) VALUES ($1,$2,NOW())
             ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
            [k, JSON.stringify(S[k])]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('[wms PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INVENTORY & SCAN (existing)
// ════════════════════════════════════════════════════════════════════════════

router.get('/inventory', requireAuth, async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        p.id, p.name, p.full_name, p.unit, p.reorder_point,
        COALESCE(SUM(l.qty), 0)::int AS total_qty,
        COUNT(l.id)::int AS lot_count,
        MIN(l.expiry) AS nearest_expiry
      FROM wms_products p
      LEFT JOIN wms_lots l ON l.product_id = p.id AND l.qty > 0
      WHERE p.active = true
      GROUP BY p.id, p.name, p.full_name, p.unit, p.reorder_point
      ORDER BY p.name
    `);
    res.json(rows.rows);
  } catch(e) {
    console.error('[wms/inventory]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/lots/scan/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code;
    const r = await query(
      `SELECT l.*, p.name AS product_name, p.full_name, p.unit,
              p.catalog_code, p.irc_code, w.name AS warehouse_name
       FROM wms_lots l
       JOIN wms_products p ON p.id = l.product_id
       LEFT JOIN wms_warehouses w ON w.id = l.warehouse_id
       WHERE l.lot_no = $1 OR l.id = $1
       LIMIT 1`,
      [code]
    );
    if (!r.rows.length) {
      const pr = await query(
        `SELECT p.*,
                COALESCE(SUM(l.qty),0)::int AS total_qty
         FROM wms_products p
         LEFT JOIN wms_lots l ON l.product_id = p.id
         WHERE p.catalog_code=$1 OR p.irc_code=$1 OR p.id=$1
         GROUP BY p.id LIMIT 1`,
        [code]
      );
      if (!pr.rows.length) return res.status(404).json({ error: 'کد یافت نشد' });
      return res.json({ type: 'product', data: pr.rows[0] });
    }
    return res.json({ type: 'lot', data: r.rows[0] });
  } catch(e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════════════════

router.get('/products', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM wms_products WHERE active = true ORDER BY name');
    res.json(r.rows.map(rowToProduct));
  } catch(e) {
    console.error('[wms/products GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/products', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'نام محصول الزامی است' });
    const id = _genId();
    const r = await query(
      `INSERT INTO wms_products (id,name,full_name,brand,size,catalog_code,irc_code,unit,category,reorder_point,note,active,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW()) RETURNING *`,
      [id, b.name, b.fullName||'', b.brand||'', b.size||'', b.catalogCode||'',
       b.ircCode||'', b.unit||'عدد', b.category||'', b.reorderPoint||10, b.note||'']
    );
    res.status(201).json(rowToProduct(r.rows[0]));
  } catch(e) {
    console.error('[wms/products POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/products/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const r = await query(
      `UPDATE wms_products SET
         name=COALESCE($2,name), full_name=COALESCE($3,full_name), brand=COALESCE($4,brand),
         size=COALESCE($5,size), catalog_code=COALESCE($6,catalog_code), irc_code=COALESCE($7,irc_code),
         unit=COALESCE($8,unit), category=COALESCE($9,category), reorder_point=COALESCE($10,reorder_point),
         note=COALESCE($11,note), updated_at=NOW()
       WHERE id=$1 AND active=true RETURNING *`,
      [req.params.id, b.name||null, b.fullName||null, b.brand||null, b.size||null,
       b.catalogCode||null, b.ircCode||null, b.unit||null, b.category||null,
       b.reorderPoint||null, b.note||null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'محصول یافت نشد' });
    res.json(rowToProduct(r.rows[0]));
  } catch(e) {
    console.error('[wms/products PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/products/:id', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE wms_products SET active=false, updated_at=NOW() WHERE id=$1 AND active=true RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'محصول یافت نشد' });
    res.json({ ok: true });
  } catch(e) {
    console.error('[wms/products DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// WAREHOUSES
// ════════════════════════════════════════════════════════════════════════════

router.get('/warehouses', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM wms_warehouses WHERE active = true ORDER BY name');
    res.json(r.rows.map(rowToWarehouse));
  } catch(e) {
    console.error('[wms/warehouses GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/warehouses', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'نام انبار الزامی است' });
    const id = _genId();
    const r = await query(
      `INSERT INTO wms_warehouses (id,name,location,manager_id,note,active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [id, b.name, b.location||'', b.managerId||'', b.note||'']
    );
    res.status(201).json(rowToWarehouse(r.rows[0]));
  } catch(e) {
    console.error('[wms/warehouses POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/warehouses/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const r = await query(
      `UPDATE wms_warehouses SET
         name=COALESCE($2,name), location=COALESCE($3,location),
         manager_id=COALESCE($4,manager_id), note=COALESCE($5,note)
       WHERE id=$1 AND active=true RETURNING *`,
      [req.params.id, b.name||null, b.location||null, b.managerId||null, b.note||null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'انبار یافت نشد' });
    res.json(rowToWarehouse(r.rows[0]));
  } catch(e) {
    console.error('[wms/warehouses PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/warehouses/:id', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE wms_warehouses SET active=false WHERE id=$1 AND active=true RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'انبار یافت نشد' });
    res.json({ ok: true });
  } catch(e) {
    console.error('[wms/warehouses DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// COUNTERPARTIES
// ════════════════════════════════════════════════════════════════════════════

router.get('/counterparties', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const params = [];
    let where = 'WHERE active = true';
    if (type && ['supplier','customer','both'].includes(type)) {
      where += ' AND type = $1';
      params.push(type);
    }
    const r = await query(`SELECT * FROM wms_counterparties ${where} ORDER BY name`, params);
    res.json(r.rows.map(rowToCounterparty));
  } catch(e) {
    console.error('[wms/counterparties GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/counterparties', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'نام الزامی است' });
    const t = ['supplier','customer','both'].includes(b.type) ? b.type : 'both';
    const id = _genId();
    const r = await query(
      `INSERT INTO wms_counterparties (id,name,type,phone,address,tax_code,email,note,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
      [id, b.name, t, b.phone||'', b.address||'', b.taxCode||'', b.email||'', b.note||'']
    );
    res.status(201).json(rowToCounterparty(r.rows[0]));
  } catch(e) {
    console.error('[wms/counterparties POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/counterparties/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const t = b.type && ['supplier','customer','both'].includes(b.type) ? b.type : null;
    const r = await query(
      `UPDATE wms_counterparties SET
         name=COALESCE($2,name), type=COALESCE($3,type), phone=COALESCE($4,phone),
         address=COALESCE($5,address), tax_code=COALESCE($6,tax_code),
         email=COALESCE($7,email), note=COALESCE($8,note)
       WHERE id=$1 AND active=true RETURNING *`,
      [req.params.id, b.name||null, t, b.phone||null, b.address||null,
       b.taxCode||null, b.email||null, b.note||null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'طرف حساب یافت نشد' });
    res.json(rowToCounterparty(r.rows[0]));
  } catch(e) {
    console.error('[wms/counterparties PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/counterparties/:id', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE wms_counterparties SET active=false WHERE id=$1 AND active=true RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'طرف حساب یافت نشد' });
    res.json({ ok: true });
  } catch(e) {
    console.error('[wms/counterparties DELETE]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// LOTS
// ════════════════════════════════════════════════════════════════════════════

router.get('/lots', requireAuth, async (req, res) => {
  try {
    const { product_id, warehouse_id, expiring_soon } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (product_id)   { conditions.push(`l.product_id = $${idx++}`);   params.push(product_id); }
    if (warehouse_id) { conditions.push(`l.warehouse_id = $${idx++}`); params.push(warehouse_id); }
    if (expiring_soon === 'true') {
      conditions.push(`l.expiry IS NOT NULL AND l.expiry <= NOW() + INTERVAL '90 days' AND l.qty > 0`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const r = await query(
      `SELECT l.*, p.name AS product_name, w.name AS warehouse_name
       FROM wms_lots l
       LEFT JOIN wms_products p ON p.id = l.product_id
       LEFT JOIN wms_warehouses w ON w.id = l.warehouse_id
       ${where}
       ORDER BY l.created_at DESC`,
      params
    );
    res.json(r.rows.map(rowToLot));
  } catch(e) {
    console.error('[wms/lots GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/lots', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.productId) return res.status(400).json({ error: 'product_id الزامی است' });
    if (b.qty == null || isNaN(Number(b.qty))) return res.status(400).json({ error: 'qty الزامی است' });
    const id = _genId();
    const r = await query(
      `INSERT INTO wms_lots (id,product_id,warehouse_id,lot_no,qty,expiry,purchase_price,
         counterparty_id,txn_id,lot_date,entered_by,approved_by,ttac_no,imed_status,imed_ref_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [id, b.productId, b.warehouseId||null, b.lotNo||'', Number(b.qty),
       b.expiry||null, b.purchasePrice||0, b.counterpartyId||null, b.txnId||null,
       b.date||null, b.enteredBy||null, b.approvedBy||null,
       b.ttacNo||'', b.imedStatus||'not_registered', b.imedRefNo||'']
    );
    res.status(201).json(rowToLot(r.rows[0]));
  } catch(e) {
    console.error('[wms/lots POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/lots/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const r = await query(
      `UPDATE wms_lots SET
         qty=COALESCE($2,qty), expiry=COALESCE($3,expiry),
         ttac_no=COALESCE($4,ttac_no), imed_status=COALESCE($5,imed_status),
         imed_ref_no=COALESCE($6,imed_ref_no), approved_by=COALESCE($7,approved_by),
         purchase_price=COALESCE($8,purchase_price), warehouse_id=COALESCE($9,warehouse_id)
       WHERE id=$1 RETURNING *`,
      [req.params.id,
       b.qty != null ? Number(b.qty) : null,
       b.expiry||null, b.ttacNo||null, b.imedStatus||null,
       b.imedRefNo||null, b.approvedBy||null,
       b.purchasePrice != null ? Number(b.purchasePrice) : null,
       b.warehouseId||null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'لات یافت نشد' });
    res.json(rowToLot(r.rows[0]));
  } catch(e) {
    console.error('[wms/lots PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════════════════════════════

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { type, product, from, to, status, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params     = [];
    let idx = 1;

    if (type)    { conditions.push(`t.type = $${idx++}`);       params.push(type); }
    if (product) { conditions.push(`t.product_id = $${idx++}`); params.push(product); }
    if (status)  { conditions.push(`t.status = $${idx++}`);     params.push(status); }
    if (from)    { conditions.push(`t.txn_date >= $${idx++}`);  params.push(from); }
    if (to)      { conditions.push(`t.txn_date <= $${idx++}`);  params.push(to + ' 23:59:59'); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Math.min(parseInt(limit)||50, 200));
    params.push(parseInt(offset)||0);

    const rows = await query(
      `SELECT t.*, p.name AS product_name, w.name AS warehouse_name, cp.name AS counterparty_name
       FROM wms_transactions t
       LEFT JOIN wms_products p ON p.id = t.product_id
       LEFT JOIN wms_warehouses w ON w.id = t.warehouse_id
       LEFT JOIN wms_counterparties cp ON cp.id = t.counterparty_id
       ${where}
       ORDER BY t.txn_date DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      params
    );
    res.json(rows.rows.map(rowToTransaction));
  } catch(e) {
    console.error('[wms/transactions GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/transactions', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.productId) return res.status(400).json({ error: 'product_id الزامی است' });
    if (!b.type || !['entry','exit','transfer'].includes(b.type)) {
      return res.status(400).json({ error: 'نوع تراکنش نامعتبر است (entry/exit/transfer)' });
    }
    if (b.qty == null || isNaN(Number(b.qty)) || Number(b.qty) <= 0) {
      return res.status(400).json({ error: 'qty باید عدد مثبت باشد' });
    }

    const client = await require('../db').pool.connect();
    try {
      await client.query('BEGIN');

      const id = _genId();
      const txnNo = await _nextTxnNo(client, b.type);
      const qty = Number(b.qty);

      const r = await client.query(
        `INSERT INTO wms_transactions
           (id,txn_no,type,txn_type,product_id,lot_id,warehouse_id,qty,unit_price,sale_price,
            counterparty_id,from_warehouse_id,to_warehouse_id,by_user,txn_date,status,note,
            ref_no,imed_status,imed_ref_no,imed_date,ttac_no)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *`,
        [id, txnNo, b.type, b.txnType||'',
         b.productId, b.lotId||null, b.warehouseId||null,
         qty, b.unitPrice||0, b.salePrice||0, b.counterpartyId||null,
         b.fromWarehouseId||null, b.toWarehouseId||null,
         b.by || req.user.username || null,
         b.date||new Date(), b.status||'pending', b.note||'',
         b.refNo||'', b.imedStatus||'not_registered', b.imedRefNo||'', b.imedDate||'', b.ttacNo||'']
      );

      // If approved immediately, update lot qty atomically
      if (b.status === 'approved' && b.lotId) {
        const delta = b.type === 'entry' ? qty : -qty;
        await client.query(
          `UPDATE wms_lots SET qty = qty + $1 WHERE id = $2`,
          [delta, b.lotId]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(rowToTransaction(r.rows[0]));
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('[wms/transactions POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/transactions/:id/approve', requireAuth, async (req, res) => {
  try {
    const client = await require('../db').pool.connect();
    try {
      await client.query('BEGIN');

      const txn = await client.query(
        `SELECT * FROM wms_transactions WHERE id=$1 AND status='pending'`,
        [req.params.id]
      );
      if (!txn.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'تراکنش یافت نشد یا قبلاً پردازش شده' });
      }
      const t = txn.rows[0];

      await client.query(
        `UPDATE wms_transactions SET status='approved' WHERE id=$1`,
        [req.params.id]
      );

      if (t.lot_id) {
        const delta = t.type === 'entry' ? Number(t.qty) : -Number(t.qty);
        await client.query(
          `UPDATE wms_lots SET qty = qty + $1 WHERE id = $2`,
          [delta, t.lot_id]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('[wms/transactions/approve]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/transactions/:id/cancel', requireAuth, async (req, res) => {
  try {
    const client = await require('../db').pool.connect();
    try {
      await client.query('BEGIN');

      const txn = await client.query(
        `SELECT * FROM wms_transactions WHERE id=$1 AND status != 'cancelled'`,
        [req.params.id]
      );
      if (!txn.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'تراکنش یافت نشد یا قبلاً لغو شده' });
      }
      const t = txn.rows[0];

      await client.query(
        `UPDATE wms_transactions SET status='cancelled' WHERE id=$1`,
        [req.params.id]
      );

      // If it was already approved, reverse the lot qty change
      if (t.status === 'approved' && t.lot_id) {
        const delta = t.type === 'entry' ? -Number(t.qty) : Number(t.qty);
        await client.query(
          `UPDATE wms_lots SET qty = qty + $1 WHERE id = $2`,
          [delta, t.lot_id]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('[wms/transactions/cancel]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ════════════════════════════════════════════════════════════════════════════

router.get('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && ['draft','pending','approved','rejected'].includes(status)) {
      where = 'WHERE status = $1';
      params.push(status);
    }
    const r = await query(
      `SELECT * FROM wms_purchase_orders ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(r.rows.map(rowToPO));
  } catch(e) {
    console.error('[wms/purchase-orders GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b.supplierId) return res.status(400).json({ error: 'supplier_id الزامی است' });
    const id = _genId();

    const year = new Date().getFullYear();
    const countR = await query(`SELECT COUNT(*)::int AS n FROM wms_purchase_orders WHERE po_no LIKE $1`, [`PO-${year}-%`]);
    const poNo = `PO-${year}-${String((countR.rows[0].n || 0) + 1).padStart(4, '0')}`;

    const r = await query(
      `INSERT INTO wms_purchase_orders (id,po_no,supplier_id,warehouse_id,requested_by,
         approved_by,approved_at,status,items,po_date,expected_delivery,note,imed_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, poNo, b.supplierId, b.warehouseId||null,
       b.requestedBy || req.user.username || null,
       null, null, 'draft', JSON.stringify(b.items||[]),
       b.date||new Date(), b.expectedDelivery||null, b.note||'', 'not_registered']
    );
    res.status(201).json(rowToPO(r.rows[0]));
  } catch(e) {
    console.error('[wms/purchase-orders POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/purchase-orders/:id', requireAuth, async (req, res) => {
  try {
    const r = await query(`SELECT * FROM wms_purchase_orders WHERE id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'سفارش خرید یافت نشد' });
    res.json(rowToPO(r.rows[0]));
  } catch(e) {
    console.error('[wms/purchase-orders/:id GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/purchase-orders/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const r = await query(
      `UPDATE wms_purchase_orders SET
         supplier_id=COALESCE($2,supplier_id), warehouse_id=COALESCE($3,warehouse_id),
         items=COALESCE($4,items), expected_delivery=COALESCE($5,expected_delivery),
         note=COALESCE($6,note), imed_status=COALESCE($7,imed_status)
       WHERE id=$1 AND status NOT IN ('approved','rejected') RETURNING *`,
      [req.params.id, b.supplierId||null, b.warehouseId||null,
       b.items ? JSON.stringify(b.items) : null,
       b.expectedDelivery||null, b.note||null, b.imedStatus||null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'سفارش خرید یافت نشد یا قابل ویرایش نیست' });
    res.json(rowToPO(r.rows[0]));
  } catch(e) {
    console.error('[wms/purchase-orders PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/purchase-orders/:id/approve', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE wms_purchase_orders SET
         status='approved', approved_by=$2, approved_at=NOW()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, req.user.username || null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'سفارش خرید یافت نشد یا قابل تأیید نیست' });
    res.json(rowToPO(r.rows[0]));
  } catch(e) {
    console.error('[wms/purchase-orders/approve]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/purchase-orders/:id/reject', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE wms_purchase_orders SET
         status='rejected', approved_by=$2, approved_at=NOW()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, req.user.username || null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'سفارش خرید یافت نشد یا قابل رد نیست' });
    res.json(rowToPO(r.rows[0]));
  } catch(e) {
    console.error('[wms/purchase-orders/reject]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT key, value FROM wms_settings ORDER BY key');
    const settings = {};
    r.rows.forEach(function(row){ settings[row.key] = row.value; });
    res.json(settings);
  } catch(e) {
    console.error('[wms/settings GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/settings/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const value = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'مقدار الزامی است' });
    }
    await query(
      `INSERT INTO wms_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, JSON.stringify(value)]
    );
    res.json({ ok: true, key, value });
  } catch(e) {
    console.error('[wms/settings PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

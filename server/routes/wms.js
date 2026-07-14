'use strict';

const express   = require('express');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const { isManagerRole } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  // /products and /inventory GET are needed by proforma for all users - skip WMS permission
  const isPublicReadPath = req.method === 'GET' && (
    req.path === '/products' ||
    req.path.startsWith('/products?') ||
    req.path === '/inventory' ||
    req.path.startsWith('/inventory?')
  );
  if (isPublicReadPath) return next();
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('wms', level)(req, res, next);
});

// ── Row mappers (SQL → JS camelCase) ─────────────────────────────────────────
function rowToProduct(r) {
  return { id:r.id, name:r.name, fullName:r.full_name, brand:r.brand, size:r.size,
           catalogCode:r.catalog_code, ircCode:r.irc_code, unit:r.unit,
           secondaryUnit:r.secondary_unit || '', conversionFactor:Number(r.conversion_factor || 1),
           category:r.category, reorderPoint:r.reorder_point,
           salePrice:Number(r.sale_price||0), note:r.note, active:r.active };
}
function rowToWarehouse(r) {
  return { id:r.id, name:r.name, location:r.location, managerId:r.manager_id, note:r.note, active:r.active };
}
function rowToCounterparty(r) {
  return { id:r.id, name:r.name, type:r.type, phone:r.phone, address:r.address,
           taxCode:r.tax_code, email:r.email, note:r.note, active:r.active };
}

async function loadAllCounterparties() {
  const cpRes = await query("SELECT * FROM wms_counterparties WHERE active = true");
  const suppliers = cpRes.rows.map(rowToCounterparty);

  const cmRes = await query("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')");
  let tehranCenters = [];
  let provinceCentersMap = {};
  cmRes.rows.forEach(r => {
    if (r.key === 'CENTERS') tehranCenters = r.data || [];
    else if (r.key === 'PC_RAW') provinceCentersMap = r.data || {};
  });

  const extraRes = await query("SELECT id, name, province_id, type, owner FROM center_extras");

  const counterparties = [...suppliers];
  const seenIds = new Set(counterparties.map(c => c.id));

  tehranCenters.forEach(c => {
    const id = `center_${c.id}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      counterparties.push({
        id,
        name: c.name,
        type: 'customer',
        phone: c.phone || '',
        address: c.address || '',
        taxCode: '',
        email: '',
        note: '',
        active: true
      });
    }
  });

  Object.keys(provinceCentersMap).forEach(provId => {
    const list = provinceCentersMap[provId] || [];
    list.forEach(c => {
      const id = `pc_${c.id}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        counterparties.push({
          id,
          name: c.name,
          type: 'customer',
          phone: c.phone || '',
          address: c.address || '',
          taxCode: '',
          email: '',
          note: '',
          active: true
        });
      }
    });
  });

  extraRes.rows.forEach(c => {
    const rtype = (c.province_id === 'tehran' || c.province_id === 'تهران') ? 'center' : 'pc';
    const id = `${rtype}_${c.id}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      counterparties.push({
        id,
        name: c.name,
        type: 'customer',
        phone: '',
        address: c.province_id || '',
        taxCode: '',
        email: '',
        note: `مالک: ${c.owner || ''}`,
        active: true
      });
    }
  });

  counterparties.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
  return counterparties;
}

function rowToLot(r) {
  return { id:r.id, productId:r.product_id, warehouseId:r.warehouse_id, lotNo:r.lot_no,
           qty:Number(r.qty), expiry:r.expiry?r.expiry.toISOString().split('T')[0]:null,
           purchasePrice:Number(r.purchase_price), counterpartyId:r.counterparty_id,
           txnId:r.txn_id, date:r.lot_date, enteredBy:r.entered_by, approvedBy:r.approved_by,
           ttacNo:r.ttac_no, imedStatus:r.imed_status, imedRefNo:r.imed_ref_no };
}
function rowToTransaction(r) {
  const base = { id:r.id, txnNo:r.txn_no, type:r.type, txnType:r.txn_type,
           productId:r.product_id, lotId:r.lot_id, warehouseId:r.warehouse_id,
           qty:Number(r.qty), unitPrice:Number(r.unit_price), salePrice:Number(r.sale_price),
           counterpartyId:r.counterparty_id, fromWarehouseId:r.from_warehouse_id,
           toWarehouseId:r.to_warehouse_id, by:r.by_user,
           date:r.txn_date, status:r.status, note:r.note, refNo:r.ref_no,
           imedStatus:r.imed_status, imedRefNo:r.imed_ref_no, imedDate:r.imed_date,
           ttacNo:r.ttac_no, proformaId:r.proforma_id || null,
           fiscalYearId:r.fiscal_year_id || null, transferPairId:r.transfer_pair_id || null,
           txnDateJalali:r.txn_date_jalali || null,
           courier:r.courier || '', trackingNo:r.tracking_no || '',
           delivStatus:r.delivery_status || 'pending', deliveryStatus:r.delivery_status || 'pending',
           delivDate:r.delivery_date || null, deliveryDate:r.delivery_date || null,
           delivPhone:r.delivery_phone || '', smsStatus:r.sms_status || '', smsSentAt:r.sms_sent_at || null };
  if (r.product_name != null) base.productName = r.product_name;
  if (r.product_full_name != null) base.productFullName = r.product_full_name;
  if (r.warehouse_name != null) base.warehouseName = r.warehouse_name;
  if (r.counterparty_name != null) base.counterpartyName = r.counterparty_name;
  if (r.proforma_no != null) base.proformaNo = r.proforma_no;
  if (r.paired_txn_no != null) base.pairedTxnNo = r.paired_txn_no;
  if (r.paired_type != null) base.pairedType = r.paired_type;
  return base;
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
async function _activeFyId(client) {
  const q = client ? client.query.bind(client) : query;
  const r = await q('SELECT id FROM wms_fiscal_years WHERE is_active = true LIMIT 1');
  return r.rows.length ? r.rows[0].id : null;
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
    const [products, warehouses, lots, transactions, purchaseOrders, recalls] =
      await Promise.all([
        query('SELECT * FROM wms_products WHERE active = true ORDER BY name'),
        query('SELECT * FROM wms_warehouses WHERE active = true ORDER BY name'),
        query('SELECT * FROM wms_lots WHERE qty > 0 ORDER BY created_at DESC LIMIT 2000'),
        query('SELECT * FROM wms_transactions ORDER BY txn_date DESC LIMIT 500'),
        query('SELECT * FROM wms_purchase_orders ORDER BY created_at DESC LIMIT 500'),
        query('SELECT * FROM wms_recalls WHERE status != $1 ORDER BY created_at DESC LIMIT 200', ['resolved']),
      ]);
    const counterparties = await loadAllCounterparties();

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
      counterparties: counterparties,
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
        // Skip CRM centers - they are read-only and come from centers_master/center_extras
        if (String(c.id).startsWith('center_') || String(c.id).startsWith('pc_')) continue;
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
        p.category, p.catalog_code, p.brand, p.size,
        COALESCE(SUM(l.qty), 0)::int AS total_qty,
        COUNT(l.id)::int AS lot_count,
        MIN(l.expiry) AS nearest_expiry,
        COALESCE(
          NULLIF(p.sale_price, 0),
          (
            SELECT t.sale_price FROM wms_transactions t
            WHERE t.product_id = p.id AND t.type = 'exit' AND t.sale_price > 0
            ORDER BY t.txn_date DESC LIMIT 1
          ),
          0
        ) AS sale_price
      FROM wms_products p
      LEFT JOIN wms_lots l ON l.product_id = p.id AND l.qty > 0
      WHERE p.active = true
      GROUP BY p.id, p.name, p.full_name, p.unit, p.reorder_point, p.category, p.catalog_code, p.brand, p.size, p.sale_price
      ORDER BY p.category NULLS LAST, p.name
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
    const r = await query(`
      SELECT p.*,
        COALESCE((
          SELECT ROUND(AVG(l.purchase_price))::bigint
          FROM wms_lots l
          WHERE l.product_id = p.id AND l.purchase_price > 0
        ), 0) AS avg_purchase_price,
        COALESCE((
          SELECT COALESCE(NULLIF(t.unit_price, 0), l.purchase_price, 0)::bigint
          FROM wms_transactions t
          LEFT JOIN wms_lots l ON l.id = t.lot_id
          WHERE t.product_id = p.id
            AND t.type = 'entry'
            AND t.status = 'approved'
            AND COALESCE(t.txn_type, '') NOT IN ('transfer_in')
            AND COALESCE(NULLIF(t.unit_price, 0), l.purchase_price, 0) > 0
          ORDER BY t.txn_date DESC NULLS LAST, t.created_at DESC NULLS LAST
          LIMIT 1
        ), (
          SELECT l.purchase_price::bigint
          FROM wms_lots l
          WHERE l.product_id = p.id AND l.purchase_price > 0
          ORDER BY COALESCE(l.lot_date, l.created_at) DESC NULLS LAST, l.created_at DESC
          LIMIT 1
        ), 0) AS last_purchase_price
      FROM wms_products p
      WHERE p.active = true
      ORDER BY p.name`);
    res.json(r.rows.map(function(row) {
      const p = rowToProduct(row);
      p.avgPurchasePrice = Number(row.avg_purchase_price || 0);
      p.lastPurchasePrice = Number(row.last_purchase_price || 0);
      return p;
    }));
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
      `INSERT INTO wms_products (id,name,full_name,brand,size,catalog_code,irc_code,unit,category,reorder_point,sale_price,note,secondary_unit,conversion_factor,active,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,NOW()) RETURNING *`,
      [id, b.name, b.fullName||'', b.brand||'', b.size||'', b.catalogCode||'',
       b.ircCode||'', b.unit||'عدد', b.category||'', b.reorderPoint||10, b.salePrice||0, b.note||'',
       b.secondaryUnit||null, Number(b.conversionFactor)||1]
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
         sale_price=COALESCE($11,sale_price), note=COALESCE($12,note),
         secondary_unit=COALESCE($13,secondary_unit), conversion_factor=COALESCE($14,conversion_factor), updated_at=NOW()
       WHERE id=$1 AND active=true RETURNING *`,
      [req.params.id, b.name||null, b.fullName||null, b.brand||null, b.size||null,
       b.catalogCode||null, b.ircCode||null, b.unit||null, b.category||null,
       b.reorderPoint||null, b.salePrice != null ? Number(b.salePrice) : null, b.note||null,
       b.secondaryUnit||null, b.conversionFactor != null ? Number(b.conversionFactor) : null]
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
    let list = await loadAllCounterparties();
    if (type && ['supplier','customer','both'].includes(type)) {
      list = list.filter(c => c.type === type || c.type === 'both');
    }
    res.json(list);
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
    const id = b.id || _genId();
    const r = await query(
      `INSERT INTO wms_lots (id,product_id,warehouse_id,lot_no,qty,expiry,purchase_price,
         counterparty_id,txn_id,lot_date,entered_by,approved_by,ttac_no,imed_status,imed_ref_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         qty=EXCLUDED.qty, expiry=EXCLUDED.expiry, purchase_price=EXCLUDED.purchase_price,
         warehouse_id=EXCLUDED.warehouse_id, approved_by=EXCLUDED.approved_by
       RETURNING *`,
      [id, b.productId, b.warehouseId||null, b.lotNo||'', Number(b.qty),
       b.expiry||null, b.purchasePrice||0, b.counterpartyId||null, b.txnId||null,
       b.date||null, b.enteredBy||null, b.approvedBy||null,
       b.ttacNo||'', b.imedStatus||'not_registered', b.imedRefNo||'']
    );
    res.status(201).json(rowToLot(r.rows[0]));
  } catch(e) {
    console.error('[wms/lots POST]', e.message);
    res.status(500).json({ error: e.message || 'خطای سرور' });
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
    if (req.query.warehouse) { conditions.push(`t.warehouse_id = $${idx++}`); params.push(req.query.warehouse); }
    if (status)  { conditions.push(`t.status = $${idx++}`);     params.push(status); }
    if (from)    { conditions.push(`t.txn_date >= $${idx++}`);  params.push(from); }
    if (to)      { conditions.push(`t.txn_date <= $${idx++}`);  params.push(to + ' 23:59:59'); }
    if (req.query.counterpartyId) {
      conditions.push(`t.counterparty_id = $${idx++}`);
      params.push(req.query.counterpartyId);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Math.min(parseInt(limit)||50, 5000));
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

router.get('/transactions/by-center/:centerKey', requireAuth, async (req, res) => {
  const centerKey = decodeURIComponent(req.params.centerKey || '').trim();
  if (!centerKey) return res.status(400).json({ error: 'کلید مرکز الزامی است' });
  try {
    const rows = await query(
      `SELECT t.*,
              p.name AS product_name,
              COALESCE(NULLIF(p.full_name, ''), p.name) AS product_full_name,
              w.name AS warehouse_name,
              pf.no AS proforma_no,
              tp.txn_no AS paired_txn_no,
              tp.type AS paired_type
       FROM wms_transactions t
       LEFT JOIN wms_products p ON p.id = t.product_id
       LEFT JOIN wms_warehouses w ON w.id = t.warehouse_id
       LEFT JOIN proformas pf ON pf.id = t.proforma_id
       LEFT JOIN wms_transactions tp
         ON tp.transfer_pair_id IS NOT NULL
        AND tp.transfer_pair_id != ''
        AND tp.transfer_pair_id = t.transfer_pair_id
        AND tp.id != t.id
       WHERE t.counterparty_id = $1
          OR t.proforma_id IN (SELECT id FROM proformas WHERE center_key = $1)
       ORDER BY t.txn_date DESC
       LIMIT 100`,
      [centerKey]
    );
    const allCps = await loadAllCounterparties();
    const cpMap = Object.fromEntries(allCps.map((c) => [c.id, c.name]));
    const transactions = rows.rows.map((r) => {
      const t = rowToTransaction(r);
      t.productName = r.product_full_name || r.product_name || '';
      t.centerName = cpMap[t.counterpartyId] || '';
      return t;
    });
    res.json({ centerKey, transactions });
  } catch (e) {
    console.error('[wms/transactions/by-center GET]', e.message);
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

      const id = b.id || _genId();
      const txnNo = b.txnNo || await _nextTxnNo(client, b.type);
      const qty = Number(b.qty);
      const fyId = b.fiscalYearId || await _activeFyId(client);
      let txnDateJalali = b.txnDateJalali || null;
      if (!txnDateJalali && b.date) {
        try { txnDateJalali = require('../lib/wms-jalali').dateToJalali(new Date(b.date)); } catch (e) {}
      }

      const r = await client.query(
        `INSERT INTO wms_transactions
           (id,txn_no,type,txn_type,product_id,lot_id,warehouse_id,qty,unit_price,sale_price,
            counterparty_id,from_warehouse_id,to_warehouse_id,by_user,txn_date,status,note,
            ref_no,imed_status,imed_ref_no,imed_date,ttac_no,proforma_id,fiscal_year_id,txn_date_jalali)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING *`,
        [id, txnNo, b.type, b.txnType||'',
         b.productId, b.lotId||null, b.warehouseId||null,
         qty, b.unitPrice||0, b.salePrice||0, b.counterpartyId||null,
         b.fromWarehouseId||null, b.toWarehouseId||null,
         b.by || req.user.username || null,
         b.date||new Date(), b.status||'pending', b.note||'',
         b.refNo||'', b.imedStatus||'not_registered', b.imedRefNo||'', b.imedDate||'', b.ttacNo||'',
         b.proformaId || null, fyId, txnDateJalali]
      );

      // lot qty is set on lot creation; only adjust on approve for pending txns
      if (b.status === 'approved' && b.lotId && b.type === 'exit') {
        const delta = -qty;
        await client.query(
          `UPDATE wms_lots SET qty = GREATEST(0, qty + $1) WHERE id = $2`,
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
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

router.put('/transactions/:id/approve', requireAuth, async (req, res) => {
  if (!isManagerRole(req.user.role)) {
    return res.status(403).json({ error: 'فقط مدیر می‌تواند تأیید کند' });
  }
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
        const lotR = await client.query('SELECT qty FROM wms_lots WHERE id=$1', [t.lot_id]);
        const lotQty = lotR.rows.length ? Number(lotR.rows[0].qty) : 0;
        if (t.type === 'entry') {
          // lot already created with qty on entry — only bump if still zero
          if (lotQty === 0) {
            await client.query(
              `UPDATE wms_lots SET qty = qty + $1 WHERE id = $2`,
              [Number(t.qty), t.lot_id]
            );
          }
        } else if (t.type === 'exit') {
          await client.query(
            `UPDATE wms_lots SET qty = GREATEST(0, qty - $1) WHERE id = $2`,
            [Number(t.qty), t.lot_id]
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
    console.error('[wms/transactions/approve]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/transactions/:id/cancel', requireAuth, async (req, res) => {
  if (!isManagerRole(req.user.role)) {
    return res.status(403).json({ error: 'فقط مدیر می‌تواند رد/لغو کند' });
  }
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

// ── WMS ↔ CRM pricing (SQL-backed, per product) ─────────────────────────────
const CRM_BUYER_TYPES = [
  { id: 'hospital', label: 'بیمارستان' },
  { id: 'colleague', label: 'همکار' },
  { id: 'doctor', label: 'پزشک' },
  { id: 'patient', label: 'بیمار' },
];
const CRM_PAY_TYPES = ['d30', 'd60', 'cash'];
const CRM_TIERS = [0, 1, 2, 3];
const TIER_LABELS = ['تا ۲۰', '۲۱-۵۰', '۵۱-۱۰۰', 'بیش از ۱۰۰'];
const PAY_LABELS = { d30: '۳۰ روزه', d60: '۶۰ روزه', cash: 'نقدی' };

async function resolveCrmProduct(wmsRow) {
  const code = (wmsRow.catalog_code || '').trim();
  const name = (wmsRow.name || '').trim();
  if (code) {
    const byCode = await query(
      `SELECT id, name, code, unit FROM products WHERE active=true AND code=$1 LIMIT 1`,
      [code]
    );
    if (byCode.rows.length) return byCode.rows[0];
  }
  if (name) {
    const byName = await query(
      `SELECT id, name, code, unit FROM products WHERE active=true AND name ILIKE $1 LIMIT 1`,
      [name]
    );
    if (byName.rows.length) return byName.rows[0];
  }
  return null;
}

async function getActivePriceList(buyerType, listId) {
  if (listId) {
    const r = await query('SELECT * FROM price_lists WHERE id=$1', [listId]);
    return r.rows[0] || null;
  }
  const r = await query(
    `SELECT * FROM price_lists WHERE buyer_type=$1 AND active=true ORDER BY version DESC LIMIT 1`,
    [buyerType || 'hospital']
  );
  return r.rows[0] || null;
}

async function getProductPricingMatrix(crmProductId, listId) {
  const items = await query(
    `SELECT qty_tier, pay_type, price, base_price FROM price_list_items
     WHERE price_list_id=$1 AND product_id=$2 ORDER BY qty_tier, pay_type`,
    [listId, crmProductId]
  );
  const matrix = {};
  CRM_TIERS.forEach((t) => {
    matrix[t] = {};
    CRM_PAY_TYPES.forEach((p) => { matrix[t][p] = null; });
  });
  items.rows.forEach((row) => {
    if (!matrix[row.qty_tier]) matrix[row.qty_tier] = {};
    matrix[row.qty_tier][row.pay_type] = Number(row.price);
  });
  const comm = await query(
    `SELECT level, amount FROM commission_rules WHERE price_list_id=$1 AND product_id=$2`,
    [listId, crmProductId]
  );
  const commissions = {};
  comm.rows.forEach((r) => { commissions[r.level] = Number(r.amount); });
  return { matrix, commissions };
}

router.get('/pricing/matrix', requireAuth, async (req, res) => {
  try {
    const buyerType = req.query.buyer_type || 'hospital';
    const list = await getActivePriceList(buyerType, req.query.list_id ? parseInt(req.query.list_id, 10) : null);
    if (!list) {
      return res.json({ buyer_type: buyerType, list: null, products: [], buyer_types: CRM_BUYER_TYPES });
    }
    const wmsRes = await query('SELECT * FROM wms_products WHERE active=true ORDER BY name');
    const products = [];
    for (const row of wmsRes.rows) {
      const wms = rowToProduct(row);
      const crm = await resolveCrmProduct(row);
      let pricing = null;
      if (crm) pricing = await getProductPricingMatrix(crm.id, list.id);
      products.push({
        wmsProduct: wms,
        crmProduct: crm ? { id: crm.id, name: crm.name, code: crm.code, unit: crm.unit } : null,
        pricing,
        linked: !!crm,
      });
    }
    res.json({
      buyer_type: buyerType,
      list: { id: list.id, name: list.name, version: list.version, buyer_type: list.buyer_type },
      products,
      buyer_types: CRM_BUYER_TYPES,
      tier_labels: TIER_LABELS,
      pay_labels: PAY_LABELS,
    });
  } catch (e) {
    console.error('[wms/pricing/matrix]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/pricing/compare', requireAuth, async (req, res) => {
  try {
    const payType = CRM_PAY_TYPES.includes(req.query.pay_type) ? req.query.pay_type : 'd30';
    const wmsRes = await query('SELECT * FROM wms_products WHERE active=true ORDER BY name');
    const columns = [];
    for (const bt of CRM_BUYER_TYPES) {
      const list = await getActivePriceList(bt.id, null);
      columns.push({
        buyer_type: bt.id,
        label: bt.label,
        list: list ? { id: list.id, name: list.name, version: list.version } : null,
      });
    }
    const products = [];
    for (const row of wmsRes.rows) {
      const wms = rowToProduct(row);
      const crm = await resolveCrmProduct(row);
      const prices = {};
      for (const bt of CRM_BUYER_TYPES) {
        const list = await getActivePriceList(bt.id, null);
        let val = null;
        if (crm && list) {
          const pricing = await getProductPricingMatrix(crm.id, list.id);
          if (pricing.matrix[0] && pricing.matrix[0][payType] != null) {
            val = pricing.matrix[0][payType];
          }
        }
        prices[bt.id] = val;
      }
      products.push({ wmsProduct: wms, crmProduct: crm, prices, linked: !!crm });
    }
    res.json({ pay_type: payType, buyer_types: CRM_BUYER_TYPES, columns, products });
  } catch (e) {
    console.error('[wms/pricing/compare]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/products/:id/pricing', requireAuth, async (req, res) => {
  try {
    const buyerType = req.query.buyer_type || 'hospital';
    const wmsRes = await query('SELECT * FROM wms_products WHERE id=$1', [req.params.id]);
    if (!wmsRes.rows.length) return res.status(404).json({ error: 'کالا یافت نشد' });
    const wms = rowToProduct(wmsRes.rows[0]);
    const crm = await resolveCrmProduct(wmsRes.rows[0]);
    const list = await getActivePriceList(buyerType, req.query.list_id ? parseInt(req.query.list_id, 10) : null);
    let pricing = null;
    if (crm && list) pricing = await getProductPricingMatrix(crm.id, list.id);
    res.json({
      wmsProduct: wms,
      crmProduct: crm ? { id: crm.id, name: crm.name, code: crm.code, unit: crm.unit } : null,
      list: list ? { id: list.id, name: list.name, version: list.version, buyer_type: list.buyer_type } : null,
      pricing,
      buyer_types: CRM_BUYER_TYPES,
      tier_labels: TIER_LABELS,
      pay_labels: PAY_LABELS,
    });
  } catch (e) {
    console.error('[wms/products/:id/pricing]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;

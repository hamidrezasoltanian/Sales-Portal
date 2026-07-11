'use strict';

const express = require('express');
const { query, pool } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');
const { fiscalYearBounds, currentJalaliYear, dateToJalali, jalaliToDate } = require('../lib/wms-jalali');
const { dailyMovementReport, ledgerReport, snapshotOpeningBalances } = require('../lib/wms-reports');

const router = express.Router();
router.use(requireAuth);

function wmsEdit(req, res, next) {
  return requirePermission('wms', 'edit')(req, res, next);
}
function wmsView(req, res, next) {
  return requirePermission('wms', 'view')(req, res, next);
}

async function getActiveFiscalYearId() {
  const r = await query('SELECT id FROM wms_fiscal_years WHERE is_active = true LIMIT 1');
  if (r.rows.length) return r.rows[0].id;
  const r2 = await query('SELECT id FROM wms_fiscal_years WHERE jalali_year = $1 LIMIT 1', [currentJalaliYear()]);
  return r2.rows.length ? r2.rows[0].id : null;
}

function rowFy(r) {
  return {
    id: r.id, title: r.title, jalaliYear: r.jalali_year,
    startDate: r.start_date, endDate: r.end_date,
    startJalali: r.start_jalali, endJalali: r.end_jalali,
    isActive: r.is_active, isClosed: r.is_closed,
    closedAt: r.closed_at, closedBy: r.closed_by, note: r.note,
  };
}

function rowRecall(r) {
  const lots = r.affected_lots || (r.lot_id ? [r.lot_id] : []);
  return {
    id: r.id,
    recallNo: r.recall_no || ('RCL-' + r.id),
    productId: r.product_id,
    affectedLots: Array.isArray(lots) ? lots : [],
    reason: r.reason || r.description || '',
    severity: r.severity || 'medium',
    status: r.status === 'open' ? 'active' : r.status,
    issuedBy: r.issued_by || r.created_by,
    issuedAt: r.issued_at || r.created_at,
    action: r.action,
    affectedQty: r.affected_qty,
  };
}

// ── Fiscal years ────────────────────────────────────────────────────────────

router.get('/fiscal-years', wmsView, async function (req, res) {
  try {
    const r = await query('SELECT * FROM wms_fiscal_years ORDER BY jalali_year DESC');
    res.json(r.rows.map(rowFy));
  } catch (e) {
    console.error('[wms/fiscal-years GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/fiscal-years', wmsEdit, async function (req, res) {
  try {
    const jy = parseInt(req.body.jalaliYear, 10);
    if (!jy) return res.status(400).json({ error: 'jalaliYear الزامی است' });
    const b = fiscalYearBounds(jy);
    const r = await query(
      `INSERT INTO wms_fiscal_years (title, jalali_year, start_date, end_date, start_jalali, end_jalali, is_active, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.body.title || ('سال مالی ' + jy), jy, b.start.toISOString().slice(0, 10), b.end.toISOString().slice(0, 10),
       b.startJalali, b.endJalali, !!req.body.isActive, req.body.note || '']
    );
    if (req.body.isActive) {
      await query('UPDATE wms_fiscal_years SET is_active = false WHERE id != $1', [r.rows[0].id]);
    }
    res.status(201).json(rowFy(r.rows[0]));
  } catch (e) {
    console.error('[wms/fiscal-years POST]', e.message);
    res.status(500).json({ error: e.message.includes('unique') ? 'این سال قبلاً ثبت شده' : 'خطای سرور' });
  }
});

router.put('/fiscal-years/:id/activate', wmsEdit, async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('UPDATE wms_fiscal_years SET is_active = false');
    await query('UPDATE wms_fiscal_years SET is_active = true WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/fiscal-years/:id/close', wmsEdit, async function (req, res) {
  const id = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fy = await client.query('SELECT * FROM wms_fiscal_years WHERE id = $1 FOR UPDATE', [id]);
    if (!fy.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'یافت نشد' }); }
    if (fy.rows[0].is_closed) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'سال مالی قبلاً بسته شده' }); }

    const nextYear = fy.rows[0].jalali_year + 1;
    const nb = fiscalYearBounds(nextYear);
    const nextR = await client.query(
      `INSERT INTO wms_fiscal_years (title, jalali_year, start_date, end_date, start_jalali, end_jalali, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (jalali_year) DO UPDATE SET is_active = true
       RETURNING id`,
      ['سال مالی ' + nextYear, nextYear, nb.start.toISOString().slice(0, 10), nb.end.toISOString().slice(0, 10), nb.startJalali, nb.endJalali]
    );
    const nextId = nextR.rows[0].id;

    await client.query(
      `UPDATE wms_fiscal_years SET is_closed = true, is_active = false, closed_at = NOW(), closed_by = $2 WHERE id = $1`,
      [id, req.user.username]
    );
    await client.query('UPDATE wms_fiscal_years SET is_active = false WHERE id != $1', [nextId]);
    await client.query('UPDATE wms_fiscal_years SET is_active = true WHERE id = $1', [nextId]);

    await client.query('COMMIT');
    await snapshotOpeningBalances(nextId, req.user.username);
    res.json({ ok: true, closedId: id, nextFiscalYearId: nextId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[wms/fiscal-years close]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  } finally {
    client.release();
  }
});

// ── Reports ─────────────────────────────────────────────────────────────────

router.get('/reports/daily-movement', wmsView, async function (req, res) {
  try {
    let from = req.query.from;
    let to = req.query.to;
    const fyId = req.query.fiscal_year_id || req.query.fiscalYearId;

    if (fyId && (!from || !to)) {
      const fy = await query('SELECT * FROM wms_fiscal_years WHERE id = $1', [parseInt(fyId, 10)]);
      if (fy.rows.length) {
        from = fy.rows[0].start_date;
        to = fy.rows[0].end_date;
      }
    }
    if (!from || !to) {
      const now = new Date();
      to = now.toISOString().slice(0, 10);
      const d = new Date(now); d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
    }

    const report = await dailyMovementReport({
      from, to,
      fiscalYearId: fyId,
      warehouseId: req.query.warehouse_id || req.query.warehouseId,
      productId: req.query.product_id || req.query.productId,
    });
    res.json({ ok: true, report });
  } catch (e) {
    console.error('[wms/reports/daily-movement]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/reports/ledger', wmsView, async function (req, res) {
  try {
    const report = await ledgerReport({
      fiscalYearId: req.query.fiscal_year_id || req.query.fiscalYearId,
      warehouseId: req.query.warehouse_id || req.query.warehouseId,
      productId: req.query.product_id || req.query.productId,
      from: req.query.from,
      to: req.query.to ? req.query.to + ' 23:59:59' : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ ok: true, report });
  } catch (e) {
    console.error('[wms/reports/ledger]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/reports/opening-balances', wmsView, async function (req, res) {
  try {
    const fyId = parseInt(req.query.fiscal_year_id || req.query.fiscalYearId, 10);
    if (!fyId) return res.status(400).json({ error: 'fiscal_year_id الزامی است' });
    const r = await query(
      `SELECT ob.*, p.name AS product_name, w.name AS warehouse_name
       FROM wms_opening_balances ob
       JOIN wms_products p ON p.id = ob.product_id
       JOIN wms_warehouses w ON w.id = ob.warehouse_id
       WHERE ob.fiscal_year_id = $1 ORDER BY p.name, w.name`,
      [fyId]
    );
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Recalls ─────────────────────────────────────────────────────────────────

router.get('/recalls', wmsView, async function (req, res) {
  try {
    const r = await query('SELECT * FROM wms_recalls ORDER BY created_at DESC LIMIT 500');
    res.json(r.rows.map(rowRecall));
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/recalls', wmsEdit, async function (req, res) {
  try {
    const b = req.body;
    if (!b.productId || !b.reason) return res.status(400).json({ error: 'productId و reason الزامی است' });
    const id = 'wms_rcl_' + Date.now().toString(36);
    const recallNo = b.recallNo || ('RCL-' + Date.now().toString().slice(-6));
    const r = await query(
      `INSERT INTO wms_recalls (id, lot_id, product_id, severity, status, description, affected_qty, action,
         recall_no, affected_lots, reason, issued_by, issued_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13) RETURNING *`,
      [id, (b.affectedLots && b.affectedLots[0]) || null, b.productId, b.severity || 'high',
       b.status || 'active', b.reason, b.affectedQty || 0, b.action || '',
       recallNo, JSON.stringify(b.affectedLots || []), b.reason,
       b.issuedBy || req.user.username, req.user.username]
    );
    res.status(201).json(rowRecall(r.rows[0]));
  } catch (e) {
    console.error('[wms/recalls POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/recalls/:id/resolve', wmsEdit, async function (req, res) {
  try {
    await query(
      `UPDATE wms_recalls SET status = 'resolved', resolved_at = NOW(), action = COALESCE($2, action) WHERE id = $1`,
      [req.params.id, req.body.action || 'resolved']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Audit log (SQL) ─────────────────────────────────────────────────────────

router.get('/audit-log', wmsView, async function (req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 2000);
    const r = await query(
      'SELECT * FROM wms_audit_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    res.json(r.rows.map(function (row) {
      return {
        id: row.id, ts: row.created_at, userId: row.user_id, userName: row.user_name,
        action: row.action, entity: row.entity, entityId: row.entity_id, detail: row.detail,
      };
    }));
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/audit-log', wmsEdit, async function (req, res) {
  try {
    const b = req.body || {};
    await query(
      `INSERT INTO wms_audit_log (user_id, user_name, action, entity, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.username, b.userName || req.user.display_name || req.user.username,
       b.action || '', b.entity || '', b.entityId || '', b.detail || '']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Delivery metadata ───────────────────────────────────────────────────────

router.patch('/transactions/:id/delivery', wmsEdit, async function (req, res) {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE wms_transactions SET
         courier = COALESCE($2, courier),
         tracking_no = COALESCE($3, tracking_no),
         delivery_status = COALESCE($4, delivery_status),
         delivery_date = COALESCE($5, delivery_date),
         delivery_phone = COALESCE($6, delivery_phone),
         sms_status = COALESCE($7, sms_status),
         sms_sent_at = COALESCE($8, sms_sent_at)
       WHERE id = $1 RETURNING *`,
      [req.params.id, b.courier || null, b.trackingNo || null, b.deliveryStatus || b.delivStatus || null,
       b.deliveryDate || b.delivDate || null, b.deliveryPhone || b.delivPhone || null,
       b.smsStatus || null, b.smsSentAt || null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ── Atomic warehouse transfer ───────────────────────────────────────────────

router.post('/transfers', wmsEdit, async function (req, res) {
  const b = req.body || {};
  if (!b.productId || !b.fromWarehouseId || !b.toWarehouseId || !b.lotId || !b.qty) {
    return res.status(400).json({ error: 'فیلدهای الزامی: productId, fromWarehouseId, toWarehouseId, lotId, qty' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pairId = 'trf_' + Date.now().toString(36);
    const qty = Number(b.qty);
    const fyId = b.fiscalYearId || await getActiveFiscalYearId();
    const user = req.user.username;
    const txnDate = b.date || new Date();

    const lotR = await client.query('SELECT * FROM wms_lots WHERE id = $1 FOR UPDATE', [b.lotId]);
    if (!lotR.rows.length || Number(lotR.rows[0].qty) < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'موجودی lot کافی نیست' });
    }

    async function nextNo(type) {
      const key = type === 'exit' ? 'seq_exit' : 'seq_entry';
      await client.query(`INSERT INTO wms_settings (key, value) VALUES ($1, '1000'::jsonb) ON CONFLICT DO NOTHING`, [key]);
      const sr = await client.query(
        `UPDATE wms_settings SET value = (value::int + 1)::text::jsonb WHERE key = $1 RETURNING value::int AS seq`, [key]
      );
      const prefix = type === 'exit' ? 'EXT' : 'ENT';
      return prefix + '-' + String(sr.rows[0].seq).padStart(4, '0');
    }

    const exitId = 'wms_' + Date.now() + '_o';
    const entryId = 'wms_' + Date.now() + '_i';
    const exitNo = await nextNo('exit');
    const entryNo = await nextNo('entry');
    const jDate = dateToJalali(txnDate);

    await client.query(
      `INSERT INTO wms_transactions (id, txn_no, type, txn_type, product_id, lot_id, warehouse_id, qty,
         from_warehouse_id, to_warehouse_id, by_user, txn_date, status, note, transfer_pair_id, fiscal_year_id, txn_date_jalali)
       VALUES ($1,$2,'exit','transfer_out',$3,$4,$5,$6,$5,$7,$8,$9,'approved',$10,$11,$12,$13)`,
      [exitId, exitNo, b.productId, b.lotId, b.fromWarehouseId, qty, b.fromWarehouseId, b.toWarehouseId,
       user, txnDate, b.note || 'انتقال بین انبار', pairId, fyId, jDate]
    );

    const destLotR = await client.query(
      `SELECT id FROM wms_lots WHERE product_id = $1 AND warehouse_id = $2 AND lot_no = $3 LIMIT 1`,
      [b.productId, b.toWarehouseId, lotR.rows[0].lot_no]
    );
    let destLotId = destLotR.rows.length ? destLotR.rows[0].id : ('wms_lot_' + Date.now());
    if (!destLotR.rows.length) {
      await client.query(
        `INSERT INTO wms_lots (id, product_id, warehouse_id, lot_no, qty, expiry, purchase_price, counterparty_id, txn_id, lot_date, entered_by)
         VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,NOW(),$9)`,
        [destLotId, b.productId, b.toWarehouseId, lotR.rows[0].lot_no, lotR.rows[0].expiry,
         lotR.rows[0].purchase_price, lotR.rows[0].counterparty_id, entryId, user]
      );
    }

    await client.query(
      `INSERT INTO wms_transactions (id, txn_no, type, txn_type, product_id, lot_id, warehouse_id, qty,
         from_warehouse_id, to_warehouse_id, by_user, txn_date, status, note, transfer_pair_id, fiscal_year_id, txn_date_jalali)
       VALUES ($1,$2,'entry','transfer_in',$3,$4,$5,$6,$7,$5,$8,$9,'approved',$10,$11,$12,$13)`,
      [entryId, entryNo, b.productId, destLotId, b.toWarehouseId, qty, b.fromWarehouseId, b.toWarehouseId,
       user, txnDate, b.note || 'انتقال بین انبار', pairId, fyId, jDate]
    );

    await client.query('UPDATE wms_lots SET qty = qty - $1 WHERE id = $2', [qty, b.lotId]);
    await client.query('UPDATE wms_lots SET qty = qty + $1 WHERE id = $2', [qty, destLotId]);

    await client.query('COMMIT');
    res.status(201).json({ ok: true, transferPairId: pairId, exitId, entryId, exitNo, entryNo });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[wms/transfers]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  } finally {
    client.release();
  }
});

module.exports = { router, getActiveFiscalYearId, dateToJalali };

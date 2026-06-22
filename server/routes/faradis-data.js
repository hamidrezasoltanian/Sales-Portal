'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const faradis = require('../integrations/faradis');

const router = express.Router();

function requireManager(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'مدیر' || role === 'سوپر ادمین') return next();
  return res.status(403).json({ error: 'فقط مدیر دسترسی دارد' });
}

// ── POST /api/faradis-data/sync-stuffs ───────────────────────────────────

router.post('/sync-stuffs', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
    const rows = await faradis.fetchStuffs();
    let count = 0;
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_stuffs_cache (stuff_num, stuff_code, stuff_name, unit_name, synced_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (stuff_num) DO UPDATE SET stuff_code=$2, stuff_name=$3, unit_name=$4, synced_at=NOW()`,
        [r.StuffNum, r.StuffCode || '', r.StuffName || '', r.UnitName || '']
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-data] sync-stuffs:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-factor-rows ──────────────────────────────

router.post('/sync-factor-rows', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
    const rows = await faradis.fetchFactorRows();
    let count = 0;
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_factor_rows_cache
           (factor_row_num, factor_num, stuff_num, stuff_name, count1, price, total_price, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (factor_row_num) DO UPDATE SET
           factor_num=$2, stuff_num=$3, stuff_name=$4, count1=$5, price=$6, total_price=$7, synced_at=NOW()`,
        [r.FactorRowNum, r.FactorNum, r.StuffNum || null, r.StuffName || '', r.Count1 || 0, r.Price || 0, r.TotalPrice || 0]
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-data] sync-factor-rows:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-inventory ────────────────────────────────

router.post('/sync-inventory', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
    const rows = await faradis.fetchInventory();
    let count = 0;
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_inventory_cache
           (store_num, store_name, stuff_num, stuff_name, stuff_code, count_all, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (store_num, stuff_num) DO UPDATE SET
           store_name=$2, stuff_name=$4, stuff_code=$5, count_all=$6, synced_at=NOW()`,
        [r.StoreNum, r.StoreName || '', r.StuffNum, r.StuffName || '', r.StuffCode || '', r.CountAll || 0]
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-data] sync-inventory:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-followers ────────────────────────────────

router.post('/sync-followers', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
    const rows = await faradis.fetchFollowers();
    let count = 0;
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_followers_cache (follower_num, follower_code, follower_name, synced_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (follower_num) DO UPDATE SET follower_code=$2, follower_name=$3, synced_at=NOW()`,
        [r.FollowerNum, r.FollowerCode || '', r.FollowerName || '']
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-data] sync-followers:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-all ──────────────────────────────────────

router.post('/sync-all', requireAuth, requireManager, async function(req, res) {
  if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
  const results = {};
  const steps = [
    { key: 'stuffs', fn: () => faradis.fetchStuffs(),
      insert: (r) => query(
        `INSERT INTO faradis_stuffs_cache (stuff_num, stuff_code, stuff_name, unit_name, synced_at)
         VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (stuff_num) DO UPDATE SET stuff_code=$2, stuff_name=$3, unit_name=$4, synced_at=NOW()`,
        [r.StuffNum, r.StuffCode||'', r.StuffName||'', r.UnitName||'']
      )
    },
    { key: 'followers', fn: () => faradis.fetchFollowers(),
      insert: (r) => query(
        `INSERT INTO faradis_followers_cache (follower_num, follower_code, follower_name, synced_at)
         VALUES ($1,$2,$3,NOW()) ON CONFLICT (follower_num) DO UPDATE SET follower_code=$2, follower_name=$3, synced_at=NOW()`,
        [r.FollowerNum, r.FollowerCode||'', r.FollowerName||'']
      )
    },
    { key: 'factor_rows', fn: () => faradis.fetchFactorRows(),
      insert: (r) => query(
        `INSERT INTO faradis_factor_rows_cache (factor_row_num, factor_num, stuff_num, stuff_name, count1, price, total_price, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (factor_row_num) DO UPDATE SET factor_num=$2, stuff_num=$3, stuff_name=$4, count1=$5, price=$6, total_price=$7, synced_at=NOW()`,
        [r.FactorRowNum, r.FactorNum, r.StuffNum||null, r.StuffName||'', r.Count1||0, r.Price||0, r.TotalPrice||0]
      )
    },
    { key: 'inventory', fn: () => faradis.fetchInventory(),
      insert: (r) => query(
        `INSERT INTO faradis_inventory_cache (store_num, store_name, stuff_num, stuff_name, stuff_code, count_all, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (store_num, stuff_num) DO UPDATE SET store_name=$2, stuff_name=$4, stuff_code=$5, count_all=$6, synced_at=NOW()`,
        [r.StoreNum, r.StoreName||'', r.StuffNum, r.StuffName||'', r.StuffCode||'', r.CountAll||0]
      )
    },
  ];
  for (const step of steps) {
    try {
      const rows = await step.fn();
      for (const r of rows) await step.insert(r);
      results[step.key] = { ok: true, count: rows.length };
    } catch (e) {
      results[step.key] = { ok: false, error: e.message };
      console.error('[faradis-data] sync-all', step.key, e.message);
    }
  }
  res.json(results);
});

// ── GET /api/faradis-data/center-products/:crm_key ───────────────────────

router.get('/center-products/:crm_key', requireAuth, requireManager, async function(req, res) {
  try {
    const link = await query(
      'SELECT faradis_company_num FROM center_faradis_link WHERE crm_center_key = $1',
      [req.params.crm_key]
    );
    if (!link.rows.length) return res.json({ linked: false, products: [] });
    const companyNum = link.rows[0].faradis_company_num;

    const rows = await query(`
      SELECT
        fr.stuff_num,
        fr.stuff_name,
        COUNT(DISTINCT fc.factor_num) AS invoice_count,
        SUM(fr.count1) AS total_qty,
        SUM(fr.total_price) AS total_amount,
        MAX(fc.jalali_date) AS last_purchase
      FROM faradis_factor_rows_cache fr
      INNER JOIN faradis_factors_cache fc ON fc.factor_num = fr.factor_num
      WHERE fc.company_num = $1
        AND fc.factor_type = 1
        AND fr.stuff_num IS NOT NULL
      GROUP BY fr.stuff_num, fr.stuff_name
      ORDER BY total_amount DESC
      LIMIT 50
    `, [companyNum]);

    res.json({ linked: true, company_num: companyNum, products: rows.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/inventory-compare ──────────────────────────────

router.get('/inventory-compare', requireAuth, requireManager, async function(req, res) {
  try {
    const faradisRows = await query(`
      SELECT stuff_num, stuff_name, stuff_code,
             SUM(count_all) AS faradis_total
      FROM faradis_inventory_cache
      GROUP BY stuff_num, stuff_name, stuff_code
      ORDER BY stuff_name
    `);

    const wmsRows = await query(`
      SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
             COALESCE(SUM(l.qty_remaining), 0) AS wms_total
      FROM wms_products p
      LEFT JOIN wms_lots l ON l.product_id = p.id AND l.qty_remaining > 0
      GROUP BY p.id, p.name, p.sku
    `);

    const wmsMap = {};
    wmsRows.rows.forEach(function(w) {
      const key = (w.product_sku || '').trim().toLowerCase();
      if (key) wmsMap[key] = w;
    });

    const comparison = faradisRows.rows.map(function(f) {
      const key = (f.stuff_code || '').trim().toLowerCase();
      const wms = wmsMap[key] || null;
      return {
        stuff_num: f.stuff_num,
        stuff_name: f.stuff_name,
        stuff_code: f.stuff_code,
        faradis_qty: parseFloat(f.faradis_total || 0),
        wms_qty: wms ? parseFloat(wms.wms_total || 0) : null,
        matched: !!wms,
        diff: wms ? parseFloat(f.faradis_total || 0) - parseFloat(wms.wms_total || 0) : null,
      };
    });

    res.json(comparison);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/team-sales ─────────────────────────────────────

router.get('/team-sales', requireAuth, requireManager, async function(req, res) {
  try {
    const months = req.query.months ? parseInt(req.query.months) : 6;
    const rows = await query(`
      SELECT
        mm.crm_username,
        fc.jalali_month,
        COUNT(DISTINCT fc.factor_num) AS invoice_count,
        SUM(fc.total_amount) AS total_amount,
        COUNT(DISTINCT fc.company_num) AS customer_count
      FROM faradis_factors_cache fc
      INNER JOIN faradis_marketer_map mm
        ON mm.marketer_num = fc.marketer_num
        OR mm.visitor_num = fc.visitor_num
      WHERE fc.factor_type = 1
        AND fc.jalali_month IS NOT NULL
      GROUP BY mm.crm_username, fc.jalali_month
      ORDER BY fc.jalali_month DESC, total_amount DESC
      LIMIT $1
    `, [months * 20]);
    res.json(rows.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/followers ──────────────────────────────────────

router.get('/followers', requireAuth, requireManager, async function(req, res) {
  try {
    const followers = await query('SELECT * FROM faradis_followers_cache ORDER BY follower_name');
    const maps = await query('SELECT * FROM faradis_marketer_map');
    const mapByMarketer = {};
    maps.rows.forEach(function(m) { if (m.marketer_num) mapByMarketer[String(m.marketer_num)] = m; });
    const result = followers.rows.map(function(f) {
      const mapped = mapByMarketer[String(f.follower_num)] || null;
      return {
        follower_num: f.follower_num,
        follower_code: f.follower_code,
        follower_name: f.follower_name,
        crm_username: mapped ? mapped.crm_username : null,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/follower-map ──────────────────────────────────

router.post('/follower-map', requireAuth, requireManager, async function(req, res) {
  try {
    const { follower_num, crm_username } = req.body || {};
    if (!follower_num) return res.status(400).json({ error: 'follower_num الزامی است' });
    if (!crm_username) {
      await query('DELETE FROM faradis_marketer_map WHERE marketer_num = $1', [String(follower_num)]);
      return res.json({ ok: true, deleted: true });
    }
    await query(
      `INSERT INTO faradis_marketer_map (marketer_num, visitor_num, crm_username, created_by, created_at)
       VALUES ($1, '', $2, $3, NOW())
       ON CONFLICT (marketer_num, visitor_num) DO UPDATE SET crm_username=$2`,
      [String(follower_num), crm_username, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/center-enrichment/:crm_key ─────────────────────

router.get('/center-enrichment/:crm_key', requireAuth, requireManager, async function(req, res) {
  try {
    const link = await query(
      'SELECT faradis_company_num, faradis_company_name FROM center_faradis_link WHERE crm_center_key = $1',
      [req.params.crm_key]
    );
    if (!link.rows.length) return res.json({ linked: false });
    const companyNum = link.rows[0].faradis_company_num;

    const customer = await query(
      'SELECT phone, mobile, address, state_name, city_name FROM faradis_customers_cache WHERE company_num = $1',
      [companyNum]
    );

    res.json({
      linked: true,
      company_num: companyNum,
      company_name: link.rows[0].faradis_company_name,
      phone: customer.rows[0] ? customer.rows[0].phone : '',
      mobile: customer.rows[0] ? customer.rows[0].mobile : '',
      address: customer.rows[0] ? customer.rows[0].address : '',
      city: customer.rows[0] ? customer.rows[0].city_name : '',
      state: customer.rows[0] ? customer.rows[0].state_name : '',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/users ───────────────────────────────────────────

router.get('/users', requireAuth, requireManager, async function(req, res) {
  try {
    const rows = await query('SELECT username, display_name AS name FROM app_users WHERE active = true ORDER BY display_name');
    res.json(rows.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

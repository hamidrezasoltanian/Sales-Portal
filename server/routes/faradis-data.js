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
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_stuffs_cache (stuff_num, stuff_code, stuff_name, unit_name, synced_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (stuff_num) DO UPDATE SET stuff_code=$2, stuff_name=$3, unit_name=$4, synced_at=NOW()`,
        [r.StuffNum, r.StuffCode || '', r.StuffName || '', r.UnitName || '']
      );
    }
    res.json({ ok: true, count: rows.length });
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
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_factor_rows_cache
           (factor_row_num, factor_num, stuff_num, stuff_name, count1, price, total_price, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (factor_row_num) DO UPDATE SET
           factor_num=$2, stuff_num=$3, stuff_name=$4, count1=$5, price=$6, total_price=$7, synced_at=NOW()`,
        [r.FactorRowNum, r.FactorNum, r.StuffNum || null, r.StuffName || '',
         r.Count1 || 0, r.Price || 0, r.TotalPrice || 0]
      );
    }
    res.json({ ok: true, count: rows.length });
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
    res.json({ ok: true, count: rows.length });
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
    for (const r of rows) {
      await query(
        `INSERT INTO faradis_followers_cache (follower_num, follower_code, follower_name, synced_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (follower_num) DO UPDATE SET follower_code=$2, follower_name=$3, synced_at=NOW()`,
        [r.FollowerNum, r.FollowerCode || '', r.FollowerName || '']
      );
    }
    res.json({ ok: true, count: rows.length });
  } catch (e) {
    console.error('[faradis-data] sync-followers:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-all ──────────────────────────────────────

router.post('/sync-all', requireAuth, requireManager, async function(req, res) {
  if (!faradis.isConfigured()) return res.status(503).json({ error: 'فرادیس متصل نیست' });
  const results = {};

  async function syncStep(key, fetchFn, insertFn) {
    try {
      const rows = await fetchFn();
      for (const r of rows) await insertFn(r);
      results[key] = { ok: true, count: rows.length };
    } catch (e) {
      results[key] = { ok: false, error: e.message };
      console.error('[faradis-data] sync-all', key, e.message);
    }
  }

  await syncStep('stuffs', () => faradis.fetchStuffs(), (r) => query(
    `INSERT INTO faradis_stuffs_cache (stuff_num, stuff_code, stuff_name, unit_name, synced_at)
     VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (stuff_num) DO UPDATE SET stuff_code=$2, stuff_name=$3, unit_name=$4, synced_at=NOW()`,
    [r.StuffNum, r.StuffCode||'', r.StuffName||'', r.UnitName||'']
  ));

  await syncStep('followers', () => faradis.fetchFollowers(), (r) => query(
    `INSERT INTO faradis_followers_cache (follower_num, follower_code, follower_name, synced_at)
     VALUES ($1,$2,$3,NOW()) ON CONFLICT (follower_num) DO UPDATE SET follower_code=$2, follower_name=$3, synced_at=NOW()`,
    [r.FollowerNum, r.FollowerCode||'', r.FollowerName||'']
  ));

  await syncStep('factor_rows', () => faradis.fetchFactorRows(), (r) => query(
    `INSERT INTO faradis_factor_rows_cache (factor_row_num, factor_num, stuff_num, stuff_name, count1, price, total_price, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (factor_row_num) DO UPDATE SET factor_num=$2, stuff_num=$3, stuff_name=$4, count1=$5, price=$6, total_price=$7, synced_at=NOW()`,
    [r.FactorRowNum, r.FactorNum, r.StuffNum||null, r.StuffName||'', r.Count1||0, r.Price||0, r.TotalPrice||0]
  ));

  await syncStep('inventory', () => faradis.fetchInventory(), (r) => query(
    `INSERT INTO faradis_inventory_cache (store_num, store_name, stuff_num, stuff_name, stuff_code, count_all, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (store_num, stuff_num) DO UPDATE SET store_name=$2, stuff_name=$4, stuff_code=$5, count_all=$6, synced_at=NOW()`,
    [r.StoreNum, r.StoreName||'', r.StuffNum, r.StuffName||'', r.StuffCode||'', r.CountAll||0]
  ));

  // Sync receivables summary
  try {
    const recvRows = await faradis.fetchReceivablesSummary();
    await query('DELETE FROM faradis_receivables_cache');
    for (const r of recvRows) {
      await query(`INSERT INTO faradis_receivables_cache
        (company_num,company_name,company_code,total_sales,total_returns,total_received,balance,synced_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [r.company_num,r.company_name,r.company_code,r.total_sales,r.total_returns,r.total_received,r.balance]);
    }
    results['receivables'] = { ok: true, count: recvRows.length };
  } catch(e) {
    results['receivables'] = { ok: false, error: e.message };
    console.error('[faradis-data] sync-all receivables', e.message);
  }

  // Sync returns
  try {
    const retRows = await faradis.fetchReturns();
    await query('DELETE FROM faradis_returns_cache');
    for (const r of retRows) {
      const d = r.FactorDate ? new Date(r.FactorDate) : null;
      await query(`INSERT INTO faradis_returns_cache (factor_num,factor_date,company_num,company_name,total_amount,synced_at)
        VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(factor_num) DO UPDATE SET factor_date=$2,total_amount=$5,synced_at=NOW()`,
        [r.FactorNum, d, r.CompanyNum, r.CompanyName, r.TotalAmount]);
    }
    results['returns'] = { ok: true, count: retRows.length };
  } catch(e) {
    results['returns'] = { ok: false, error: e.message };
    console.error('[faradis-data] sync-all returns', e.message);
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
      SELECT fr.stuff_num, fr.stuff_name,
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
      SELECT stuff_num, stuff_name, stuff_code, SUM(count_all) AS faradis_total
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
      const faradisQty = parseFloat(f.faradis_total || 0);
      const wmsQty = wms ? parseFloat(wms.wms_total || 0) : null;
      return {
        stuff_num: f.stuff_num,
        stuff_name: f.stuff_name,
        stuff_code: f.stuff_code,
        faradis_qty: faradisQty,
        wms_qty: wmsQty,
        matched: !!wms,
        diff: wms ? faradisQty - wmsQty : null,
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
    const rows = await query(`
      SELECT mm.crm_username, fc.jalali_month,
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
      LIMIT 200
    `);
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
    maps.rows.forEach(function(m) { if (m.marketer_num) mapByMarketer[m.marketer_num] = m; });
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
    const c = customer.rows[0] || {};
    res.json({
      linked: true,
      company_num: companyNum,
      company_name: link.rows[0].faradis_company_name,
      phone: c.phone || '',
      mobile: c.mobile || '',
      address: c.address || '',
      city: c.city_name || '',
      state: c.state_name || '',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-data/users ───────────────────────────────────────────

router.get('/users', requireAuth, requireManager, async function(req, res) {
  try {
    const rows = await query(
      "SELECT username, name FROM app_users WHERE active = true ORDER BY name"
    );
    res.json(rows.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-data/sync-receivables ───────────────────────────────

router.post('/sync-receivables', requireAuth, requireManager, async function(req, res) {
  if (!faradis.isConfigured()) return res.json({ ok: false, error: 'Faradis not configured' });
  try {
    const rows = await faradis.fetchReceivablesSummary();
    await query('DELETE FROM faradis_receivables_cache');
    for (const r of rows) {
      await query(`INSERT INTO faradis_receivables_cache
        (company_num,company_name,company_code,total_sales,total_returns,total_received,balance,synced_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [r.company_num,r.company_name,r.company_code,r.total_sales,r.total_returns,r.total_received,r.balance]);
    }
    res.json({ ok: true, count: rows.length });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── GET /api/faradis-data/receivables ─────────────────────────────────────

router.get('/receivables', requireAuth, requireManager, async function(req, res) {
  try {
    const r = await query(`
      SELECT rc.*,
             cfl.crm_center_key, cfl.crm_center_name
      FROM faradis_receivables_cache rc
      LEFT JOIN center_faradis_link cfl ON cfl.faradis_company_num = rc.company_num
      ORDER BY ABS(rc.balance) DESC
      LIMIT 500
    `);
    res.json({ ok: true, rows: r.rows });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── GET /api/faradis-data/receivables/:crm_key ────────────────────────────

router.get('/receivables/:crm_key', requireAuth, requireManager, async function(req, res) {
  try {
    const link = await query('SELECT faradis_company_num FROM center_faradis_link WHERE crm_center_key=$1', [req.params.crm_key]);
    if (!link.rows.length) return res.json({ ok: false, error: 'not_linked' });
    const companyNum = link.rows[0].faradis_company_num;
    const r = await query('SELECT * FROM faradis_receivables_cache WHERE company_num=$1', [companyNum]);
    res.json({ ok: true, data: r.rows[0] || null });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── POST /api/faradis-data/sync-returns ───────────────────────────────────

router.post('/sync-returns', requireAuth, requireManager, async function(req, res) {
  if (!faradis.isConfigured()) return res.json({ ok: false, error: 'Faradis not configured' });
  try {
    const rows = await faradis.fetchReturns();
    await query('DELETE FROM faradis_returns_cache');
    for (const r of rows) {
      const d = r.FactorDate ? new Date(r.FactorDate) : null;
      await query(`INSERT INTO faradis_returns_cache (factor_num,factor_date,company_num,company_name,total_amount,synced_at)
        VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(factor_num) DO UPDATE SET factor_date=$2,total_amount=$5,synced_at=NOW()`,
        [r.FactorNum, d, r.CompanyNum, r.CompanyName, r.TotalAmount]);
    }
    res.json({ ok: true, count: rows.length });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── GET /api/faradis-data/returns/:crm_key ────────────────────────────────

router.get('/returns/:crm_key', requireAuth, requireManager, async function(req, res) {
  try {
    const link = await query('SELECT faradis_company_num FROM center_faradis_link WHERE crm_center_key=$1', [req.params.crm_key]);
    if (!link.rows.length) return res.json({ ok: false, error: 'not_linked' });
    const r = await query('SELECT * FROM faradis_returns_cache WHERE company_num=$1 ORDER BY factor_date DESC LIMIT 50', [link.rows[0].faradis_company_num]);
    res.json({ ok: true, rows: r.rows });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── POST /api/faradis-data/sync-purchases ─────────────────────────────────

router.post('/sync-purchases', requireAuth, requireManager, async function(req, res) {
  if (!faradis.isConfigured()) return res.json({ ok: false, error: 'Faradis not configured' });
  try {
    const rows = await faradis.fetchPurchases();
    await query('DELETE FROM faradis_purchases_cache');
    for (const r of rows) {
      const d = r.FactorDate ? new Date(r.FactorDate) : null;
      await query(`INSERT INTO faradis_purchases_cache (factor_num,factor_date,company_num,company_name,total_amount,synced_at)
        VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(factor_num) DO UPDATE SET factor_date=$2,total_amount=$5,synced_at=NOW()`,
        [r.FactorNum, d, r.CompanyNum, r.CompanyName, r.TotalAmount]);
    }
    res.json({ ok: true, count: rows.length });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── GET /api/faradis-data/purchases-summary ───────────────────────────────

router.get('/purchases-summary', requireAuth, requireManager, async function(req, res) {
  try {
    const r = await query(`
      SELECT company_num, company_name, COUNT(*) AS count, SUM(total_amount) AS total
      FROM faradis_purchases_cache
      GROUP BY company_num, company_name
      ORDER BY total DESC LIMIT 100
    `);
    res.json({ ok: true, rows: r.rows });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

module.exports = router;

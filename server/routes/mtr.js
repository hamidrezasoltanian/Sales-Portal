'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');
const faradis = require('../integrations/faradis');
const { calcTodayJ, enrichMtrRow, gregToJalali } = require('../lib/jalali-utils');

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('mtr', 'view'));

function isManagerRole(role) {
  return role === 'مدیر' || role === 'سوپر ادمین';
}

function rowToMeta(row) {
  return {
    status: row.status || '',
    nextFU: row.next_fu || '',
    forecast: row.forecast || null,
    notes: row.notes || [],
    payments: row.payments || [],
  };
}

function metaToDb(inv, meta) {
  return {
    invoice_key: String(inv),
    status: meta.status || '',
    next_fu: meta.nextFU || '',
    forecast: meta.forecast ? JSON.stringify(meta.forecast) : null,
    notes: JSON.stringify(meta.notes || []),
    payments: JSON.stringify(meta.payments || []),
  };
}

async function upsertMetaInv(inv, meta, user) {
  const d = metaToDb(inv, meta);
  await query(
    `INSERT INTO mtr_invoice_meta (invoice_key, status, next_fu, forecast, notes, payments, updated_at, updated_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, NOW(), $7)
     ON CONFLICT (invoice_key) DO UPDATE SET
       status = EXCLUDED.status,
       next_fu = EXCLUDED.next_fu,
       forecast = EXCLUDED.forecast,
       notes = EXCLUDED.notes,
       payments = EXCLUDED.payments,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [d.invoice_key, d.status, d.next_fu, d.forecast, d.notes, d.payments, user]
  );
}

const MTR_SETTING_KEYS = new Set(['mtrFollowerMap', 'mtrFollower', 'mtrTrend']);

router.patch('/settings/:key', requirePermission('mtr', 'edit'), async function (req, res) {
  try {
    const key = req.params.key;
    if (!MTR_SETTING_KEYS.has(key)) return res.status(400).json({ error: 'کلید نامعتبر' });
    const value = req.body && Object.prototype.hasOwnProperty.call(req.body, 'value')
      ? req.body.value : req.body;
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value == null ? (key === 'mtrTrend' ? [] : {}) : value), req.user.username]
    );
    res.json({ ok: true, key });
  } catch (e) {
    console.error('[mtr/settings PATCH]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/mtr/meta — bulk load all invoice meta (MTR UI)
router.get('/meta', async function (req, res) {
  try {
    const r = await query(
      'SELECT invoice_key, status, next_fu, forecast, notes, payments FROM mtr_invoice_meta ORDER BY invoice_key'
    );
    const meta = {};
    r.rows.forEach(function (row) {
      meta[row.invoice_key] = rowToMeta(row);
    });
    res.json(meta);
  } catch (e) {
    console.error('[mtr/meta GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PATCH /api/mtr/meta/:inv — upsert single invoice meta
router.patch('/meta/:inv', requirePermission('mtr', 'edit'), async function (req, res) {
  try {
    const inv = String(req.params.inv || '').trim();
    if (!inv || inv.length > 128) return res.status(400).json({ error: 'شماره فاکتور نامعتبر' });
    const body = req.body || {};
    const meta = {
      status: body.status != null ? String(body.status) : '',
      nextFU: body.nextFU != null ? String(body.nextFU) : '',
      forecast: body.forecast || null,
      notes: Array.isArray(body.notes) ? body.notes : [],
      payments: Array.isArray(body.payments) ? body.payments : [],
    };
    await upsertMetaInv(inv, meta, req.user.username);
    res.json({ ok: true, inv, meta });
  } catch (e) {
    console.error('[mtr/meta PATCH]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/mtr/meta/bulk — bulk upsert (backup merge)
router.put('/meta/bulk', requirePermission('mtr', 'edit'), async function (req, res) {
  try {
    const bulk = req.body || {};
    if (!bulk || typeof bulk !== 'object' || Array.isArray(bulk)) {
      return res.status(400).json({ error: 'داده نامعتبر' });
    }
    const keys = Object.keys(bulk);
    let count = 0;
    for (const inv of keys) {
      const m = bulk[inv];
      if (!m || typeof m !== 'object') continue;
      await upsertMetaInv(inv, m, req.user.username);
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[mtr/meta bulk PUT]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/mtr/sync/status
router.get('/sync/status', async function (req, res) {
  try {
    const [syncAtR, recvR, factorsR] = await Promise.all([
      query("SELECT value FROM app_settings WHERE key = 'mtrLastSyncAt'"),
      query('SELECT COUNT(*)::int AS cnt, MAX(synced_at) AS last_sync FROM faradis_receivables_cache'),
      query('SELECT COUNT(*)::int AS cnt FROM faradis_factors_cache WHERE factor_type = 1'),
    ]);
    const mtrR = await query("SELECT value, updated_at FROM app_data WHERE key = 'mtr'");
    const mtrVal = mtrR.rows[0] && mtrR.rows[0].value;
    res.json({
      ok: true,
      faradisConfigured: faradis.isConfigured(),
      mtrSyncEnabled: false, // client reads from DB.settings
      lastSyncAt: syncAtR.rows[0] ? syncAtR.rows[0].value : null,
      receivablesCount: recvR.rows[0] ? recvR.rows[0].cnt : 0,
      receivablesLastSync: recvR.rows[0] && recvR.rows[0].last_sync,
      factorsCount: factorsR.rows[0] ? factorsR.rows[0].cnt : 0,
      mtrRowCount: mtrVal && mtrVal.data ? mtrVal.data.length : 0,
      mtrUpdatedAt: mtrR.rows[0] ? mtrR.rows[0].updated_at : null,
      source: mtrVal && mtrVal.source ? mtrVal.source : 'excel',
    });
  } catch (e) {
    console.error('[mtr/sync/status]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

async function syncFaradisCaches() {
  if (!faradis.isConfigured()) return { skipped: true, reason: 'not_configured' };
  const results = {};

  try {
    const recvRows = await faradis.fetchReceivablesSummary();
    await query('DELETE FROM faradis_receivables_cache');
    for (const r of recvRows) {
      await query(
        `INSERT INTO faradis_receivables_cache
          (company_num, company_name, company_code, total_sales, total_returns, total_received, balance, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [r.company_num, r.company_name, r.company_code, r.total_sales, r.total_returns, r.total_received, r.balance]
      );
    }
    results.receivables = { ok: true, count: recvRows.length };
  } catch (e) {
    results.receivables = { ok: false, error: e.message };
  }

  try {
    const factors = await faradis.fetchFactors();
    let count = 0;
    for (const f of factors) {
      const fd = f.FactorDate ? new Date(f.FactorDate) : null;
      let jalaliDate = '';
      let jalaliMonth = '';
      if (fd) {
        const j = gregToJalali(fd);
        jalaliDate = j[0] || '';
        jalaliMonth = j[1] || '';
      }
      await query(
        `INSERT INTO faradis_factors_cache
           (factor_num, factor_code, factor_date, jalali_date, jalali_month,
            factor_type, marketer_num, visitor_num, company_num, company_name, total_amount, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (factor_num) DO UPDATE SET
           factor_code=$2, factor_date=$3, jalali_date=$4, jalali_month=$5,
           factor_type=$6, marketer_num=$7, visitor_num=$8, company_num=$9,
           company_name=$10, total_amount=$11, synced_at=NOW()`,
        [
          f.FactorNum, f.FactorCode || '', fd, jalaliDate, jalaliMonth,
          f.FactorType || 1, f.MarketerNum || '', f.VisitorNum || '',
          f.CompanyNum, f.CompanyName || '', f.TotalAmount || 0,
        ]
      );
      count++;
    }
    results.factors = { ok: true, count };
  } catch (e) {
    results.factors = { ok: false, error: e.message };
  }

  try {
    const customers = await faradis.fetchCustomers();
    let count = 0;
    for (const c of customers) {
      await query(
        `INSERT INTO faradis_customers_cache
           (company_num, company_name, company_code, person_name, phone, phone2,
            mobile, mobile2, fax, email, national_code, state_name, city_name,
            address, type_name, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
         ON CONFLICT (company_num) DO UPDATE SET
           company_name=$2, company_code=$3, person_name=$4, phone=$5, phone2=$6,
           mobile=$7, mobile2=$8, fax=$9, email=$10, national_code=$11,
           state_name=$12, city_name=$13, address=$14, type_name=$15, synced_at=NOW()`,
        [
          c.CompanyNum, c.CompanyName || '', c.CompanyCode || '', c.PersonName || '',
          c.Phone1 || '', c.Phone2 || '', c.Mobile1 || '', c.Mobile2 || '',
          c.FaxNum || '', c.Email || '', c.NationalCode || '',
          c.StateName1 || '', c.CityName1 || '', c.Address1 || '', c.TypeName || '',
        ]
      );
      count++;
    }
    results.customers = { ok: true, count };
  } catch (e) {
    results.customers = { ok: false, error: e.message };
  }

  return results;
}

async function buildRowsFromCache() {
  const today = calcTodayJ();
  const [recvR, mapsR, membersR, followerMapR, customersR] = await Promise.all([
    query('SELECT * FROM faradis_receivables_cache WHERE balance > 100 ORDER BY balance DESC'),
    query('SELECT marketer_num, visitor_num, crm_username FROM faradis_marketer_map'),
    query("SELECT value FROM app_settings WHERE key = 'members'"),
    query("SELECT value FROM app_settings WHERE key = 'mtrFollowerMap'"),
    query('SELECT company_num, state_name, city_name FROM faradis_customers_cache'),
  ]);

  const members = (membersR.rows[0] && membersR.rows[0].value) || [];
  const memberNameById = {};
  if (Array.isArray(members)) {
    members.forEach(function (m) { if (m && m.id) memberNameById[m.id] = m.name || m.id; });
  }
  const mtrFollowerMap = (followerMapR.rows[0] && followerMapR.rows[0].value) || {};
  const provinceByCompany = {};
  customersR.rows.forEach(function (c) {
    provinceByCompany[c.company_num] = c.state_name || c.city_name || '—';
  });

  function resolveFollower(f) {
    const mm = mapsR.rows.find(function (m) {
      return (f.marketer_num && m.marketer_num === String(f.marketer_num))
        || (f.visitor_num && m.visitor_num === String(f.visitor_num));
    });
    if (mm && mm.crm_username) {
      return memberNameById[mm.crm_username] || mm.crm_username;
    }
    if (f.marketer_num && mtrFollowerMap[f.marketer_num]) {
      const uid = mtrFollowerMap[f.marketer_num];
      return memberNameById[uid] || uid;
    }
    return '—';
  }

  const rows = [];
  for (const company of recvR.rows) {
    const balance = Number(company.balance);
    if (balance <= 100) continue;

    const factorsR = await query(
      `SELECT factor_num, factor_code, jalali_date, marketer_num, visitor_num, company_name, total_amount
       FROM faradis_factors_cache
       WHERE company_num = $1 AND factor_type = 1 AND total_amount > 0
       ORDER BY factor_date DESC`,
      [company.company_num]
    );
    if (!factorsR.rows.length) {
      rows.push(enrichMtrRow({
        follower: '—',
        inv: 'C' + String(company.company_num),
        invDate: today,
        customer: company.company_name || '—',
        province: provinceByCompany[company.company_num] || '—',
        rem: balance,
        due: '',
      }, today));
      continue;
    }

    const totalSales = factorsR.rows.reduce(function (s, f) { return s + Number(f.total_amount); }, 0);
    if (totalSales <= 0) continue;

    factorsR.rows.forEach(function (f) {
      const rem = Math.round(Number(f.total_amount) * (balance / totalSales));
      if (rem <= 100) return;
      rows.push(enrichMtrRow({
        follower: resolveFollower(f),
        inv: String(f.factor_num),
        invDate: f.jalali_date || '',
        customer: f.company_name || company.company_name || '—',
        province: provinceByCompany[company.company_num] || '—',
        rem,
        due: '',
      }, today));
    });
  }

  rows.sort(function (a, b) {
    return b.urg.lv !== a.urg.lv ? b.urg.lv - a.urg.lv : b.rem - a.rem;
  });
  return rows;
}

// POST /api/mtr/sync — pull from Faradis cache → normalized DATA rows
router.post('/sync', async function (req, res) {
  if (!isManagerRole(req.user.role)) {
    return res.status(403).json({ error: 'فقط مدیر می‌تواند همگام‌سازی کند' });
  }
  try {
    const refresh = req.body && req.body.refresh !== false;
    let syncResults = {};
    if (refresh && faradis.isConfigured()) {
      syncResults = await syncFaradisCaches();
    }

    const rows = await buildRowsFromCache();
    const at = calcTodayJ();
    const payload = { data: rows, at, source: 'faradis' };

    await query(
      `INSERT INTO app_data (key, value, updated_at, updated_by)
       VALUES ('mtr', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify(payload), req.user.username]
    );
    await query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ('mtrLastSyncAt', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify({ at, count: rows.length, by: req.user.username }), req.user.username]
    );

    res.json({
      ok: true,
      data: rows,
      at,
      count: rows.length,
      source: 'faradis',
      faradisConfigured: faradis.isConfigured(),
      syncResults,
    });
  } catch (e) {
    console.error('[mtr/sync POST]', e.message);
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

router.syncFaradisCaches = syncFaradisCaches;
router.buildRowsFromCache = buildRowsFromCache;
module.exports = router;

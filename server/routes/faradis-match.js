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

// ── Name normalization helpers ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  'مرکز', 'آزمایشگاه', 'کلینیک', 'بیمارستان', 'دکتر', 'دکتری', 'پاتولوژی',
  'تشخیص', 'طبی', 'پزشکی', 'بهداشتی', 'درمانی', 'درمان', 'سلامت',
  'خانه', 'موسسه', 'مجتمع', 'واحد', 'شعبه', 'شرکت', 'دانشگاه',
  'و', 'در', 'از', 'به', 'با', 'که', 'این', 'آن',
]);

function normalizeName(name) {
  if (!name) return '';
  // Arabic → Persian
  let s = name
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ؤ/g, 'و');
  // Remove parentheses content and punctuation
  s = s.replace(/\(.*?\)/g, '').replace(/[()«»،,.\-_/\\]+/g, ' ').trim();
  s = s.toLowerCase();
  // Split into words, filter stop words and short tokens
  const words = s.split(/\s+/).filter(function(w) {
    return w.length > 1 && !STOP_WORDS.has(w);
  });
  return words.join(' ');
}

function tokenize(name) {
  const norm = normalizeName(name);
  if (!norm) return new Set();
  return new Set(norm.split(/\s+/).filter(function(w){ return w.length > 1; }));
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(function(t) { if (setB.has(t)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Boost if city/state appears in both
function cityBoost(crmName, companyStateName, companyCityName) {
  const loc = ((companyStateName || '') + ' ' + (companyCityName || '')).trim().toLowerCase();
  if (!loc) return 0;
  const crmLow = (crmName || '').toLowerCase();
  // tokenize city/state and check if any token appears in CRM name
  const locTokens = loc.split(/\s+/).filter(function(t){ return t.length > 1; });
  for (const t of locTokens) {
    if (crmLow.includes(t)) return 10;
  }
  return 0;
}

function computeConfidence(crmName, customer) {
  const tokA = tokenize(crmName);
  const tokB = tokenize(customer.company_name);
  const jaccard = jaccardSimilarity(tokA, tokB);
  let score = Math.round(jaccard * 100);
  // Small boost for geographic overlap
  score += cityBoost(crmName, customer.state_name, customer.city_name);
  return Math.min(100, score);
}

// ── Gregorian → Jalali (server-side) ─────────────────────────────────────

function gregToJalali(date) {
  if (!date) return ['', ''];
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return ['', ''];
  const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4)
    - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400)
    + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  const p2 = n => String(n).padStart(2, '0');
  const dateStr = jy + '/' + p2(jm) + '/' + p2(jd);
  const monthStr = jy + '/' + p2(jm);
  return [dateStr, monthStr];
}

// ── Helper: parse centers from DB ─────────────────────────────────────────

async function loadCRMCenters() {
  const centers = [];
  const seenKeys = new Set();

  function addCenter(key, name) {
    if (!key || !name || seenKeys.has(key)) return;
    seenKeys.add(key);
    centers.push({ key, name });
  }

  // 1. Primary: centers_master table (populated when admin uploads center list)
  try {
    const tehranRow = await query(`SELECT data FROM centers_master WHERE key = 'CENTERS'`);
    if (tehranRow.rows.length) {
      let data = tehranRow.rows[0].data;
      let arr = null;
      if (Array.isArray(data)) arr = data;
      else if (data && Array.isArray(data.list)) arr = data.list;
      else if (data && Array.isArray(data.data)) arr = data.data;
      else if (data && typeof data === 'object') arr = Object.values(data);
      if (arr) {
        for (const c of arr) {
          if (!c) continue;
          const id = c.id || c.key;
          const name = c.name || c.n || '';
          if (!id || !name) continue;
          const key = String(id).startsWith('c_') ? String(id) : 'c_' + String(id);
          addCenter(key, name);
        }
      }
    }
  } catch (e) {
    console.error('[faradis-match] error loading CENTERS:', e.message);
  }
  try {
    const pcRow = await query(`SELECT data FROM centers_master WHERE key = 'PC_RAW'`);
    if (pcRow.rows.length) {
      let data = pcRow.rows[0].data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [provId, provCenters] of Object.entries(data)) {
          if (!Array.isArray(provCenters)) continue;
          provCenters.forEach(function(c, idx) {
            if (!c) return;
            const name = c.name || c.n || '';
            if (!name) return;
            const rid = c.id != null ? String(c.id) : (provId + '||' + idx);
            const key = rid.includes('||') ? 'pc_' + rid : 'pc_' + provId + '||' + rid;
            addCenter(key, name);
          });
        }
      }
    }
  } catch (e) {
    console.error('[faradis-match] error loading PC_RAW:', e.message);
  }

  // 2. Fallback: crm_centers_cache (pushed from browser by frontend)
  if (centers.length === 0) {
    try {
      const cacheRows = await query('SELECT center_key, center_name FROM crm_centers_cache ORDER BY center_key');
      for (const r of cacheRows.rows) {
        addCenter(r.center_key, r.center_name);
      }
      if (centers.length > 0) {
        console.log('[faradis-match] loaded', centers.length, 'CRM centers from crm_centers_cache');
      }
    } catch (e) {
      console.error('[faradis-match] error loading crm_centers_cache:', e.message);
    }
  }

  // 3. Last resort: center_contacts table (has center_name when admin saved contacts)
  if (centers.length === 0) {
    try {
      const ccRows = await query(
        'SELECT center_key, center_name FROM center_contacts WHERE center_name IS NOT NULL AND center_name != \'\' ORDER BY center_key'
      );
      for (const r of ccRows.rows) {
        addCenter(r.center_key, r.center_name);
      }
      if (centers.length > 0) {
        console.log('[faradis-match] loaded', centers.length, 'CRM centers from center_contacts');
      }
    } catch (e) {
      console.error('[faradis-match] error loading center_contacts:', e.message);
    }
  }

  return centers;
}

// ── POST /api/faradis-match/sync-crm-centers ─────────────────────────────
// Called by frontend to push its in-memory center list to backend cache

router.post('/sync-crm-centers', requireAuth, requireManager, async function(req, res) {
  try {
    const { centers } = req.body || {};
    if (!Array.isArray(centers) || centers.length === 0) {
      return res.status(400).json({ error: 'centers آرایه‌ای از {key, name} الزامی است' });
    }
    let count = 0;
    for (const c of centers) {
      if (!c.key || !c.name) continue;
      await query(
        `INSERT INTO crm_centers_cache (center_key, center_name, synced_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (center_key) DO UPDATE SET center_name=$2, synced_at=NOW()`,
        [String(c.key), String(c.name).slice(0, 300)]
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-match] sync-crm-centers error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-match/sync-customers ────────────────────────────────

router.post('/sync-customers', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) {
      return res.status(503).json({ error: 'اتصال به فرادیس پیکربندی نشده است' });
    }
    const customers = await faradis.fetchCustomers();
    let count = 0;
    for (const c of customers) {
      await query(
        `INSERT INTO faradis_customers_cache
           (company_num, company_name, company_code, phone, mobile, state_name, city_name, address, type_name, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (company_num) DO UPDATE SET
           company_name=$2, company_code=$3, phone=$4, mobile=$5,
           state_name=$6, city_name=$7, address=$8, type_name=$9, synced_at=NOW()`,
        [
          c.CompanyNum, c.CompanyName || '', c.CompanyCode || '',
          c.Phone1 || '', c.Mobile1 || '',
          c.StateName1 || '', c.CityName1 || '',
          c.Address1 || '', c.TypeName || '',
        ]
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-match] sync-customers error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/status ────────────────────────────────────────

router.get('/status', requireAuth, requireManager, async function(req, res) {
  try {
    const cached = await query('SELECT COUNT(*) FROM faradis_customers_cache');
    const links = await query('SELECT COUNT(*) FROM center_faradis_link');
    const factors = await query('SELECT COUNT(*) FROM faradis_factors_cache');
    const centers = await loadCRMCenters();
    const linkedKeys = new Set();
    (await query('SELECT crm_center_key FROM center_faradis_link')).rows.forEach(function(r){
      linkedKeys.add(r.crm_center_key);
    });
    const pending = centers.filter(function(c){ return !linkedKeys.has(c.key); }).length;
    res.json({
      customers_cached: parseInt(cached.rows[0].count),
      total_links: parseInt(links.rows[0].count),
      pending_estimate: pending,
      factors_cached: parseInt(factors.rows[0].count),
    });
  } catch (e) {
    console.error('[faradis-match] status error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/suggestions ───────────────────────────────────

router.get('/suggestions', requireAuth, requireManager, async function(req, res) {
  try {
    const centerOffset = parseInt(req.query.center_offset) || 0;
    const batchSize = Math.min(parseInt(req.query.batch_size) || 100, 500);

    const centers = await loadCRMCenters();
    const linkedRows = await query('SELECT crm_center_key FROM center_faradis_link');
    const linkedKeys = new Set(linkedRows.rows.map(function(r){ return r.crm_center_key; }));
    const rejectedRows = await query('SELECT crm_center_key, faradis_company_num FROM center_faradis_rejected');
    const rejectedMap = {};
    rejectedRows.rows.forEach(function(r) {
      if (!rejectedMap[r.crm_center_key]) rejectedMap[r.crm_center_key] = new Set();
      rejectedMap[r.crm_center_key].add(String(r.faradis_company_num));
    });

    const custRows = await query(
      'SELECT company_num, company_name, company_code, phone, state_name, city_name FROM faradis_customers_cache ORDER BY company_num'
    );
    const customers = custRows.rows;

    if (customers.length === 0) {
      return res.json({ results: [], next_center_offset: 0, has_more: false, total_unlinked: 0 });
    }

    const unlinked = centers.filter(function(c){ return !linkedKeys.has(c.key); });
    const batch = unlinked.slice(centerOffset, centerOffset + batchSize);
    const nextCenterOffset = centerOffset + batchSize;
    const hasMore = nextCenterOffset < unlinked.length;

    const results = [];
    for (const center of batch) {
      const rejectedForCenter = rejectedMap[center.key] || new Set();
      const scored = customers
        .filter(function(c){ return !rejectedForCenter.has(String(c.company_num)); })
        .map(function(c) {
          return {
            company_num: c.company_num,
            company_name: c.company_name,
            company_code: c.company_code,
            phone: c.phone,
            state_name: c.state_name,
            city_name: c.city_name,
            confidence: computeConfidence(center.name, c),
          };
        })
        .sort(function(a, b){ return b.confidence - a.confidence; })
        .slice(0, 3);
      const best = scored[0];
      if (!best || best.confidence < 20) continue;
      results.push({ crm_key: center.key, crm_name: center.name, suggestions: scored });
    }

    results.sort(function(a, b){ return b.suggestions[0].confidence - a.suggestions[0].confidence; });
    res.json({ results, next_center_offset: nextCenterOffset, has_more: hasMore, total_unlinked: unlinked.length });
  } catch (e) {
    console.error('[faradis-match] suggestions error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-match/approve ──────────────────────────────────────

router.post('/approve', requireAuth, requireManager, async function(req, res) {
  try {
    const { crm_key, crm_name, company_num, company_name, matched_by, confidence } = req.body;
    if (!crm_key || !company_num) return res.status(400).json({ error: 'crm_key و company_num الزامی است' });
    await query(
      `INSERT INTO center_faradis_link
         (crm_center_key, crm_center_name, faradis_company_num, faradis_company_name,
          matched_by, confidence, confirmed_by, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (crm_center_key) DO UPDATE SET
         faradis_company_num=$3, faradis_company_name=$4,
         matched_by=$5, confidence=$6, confirmed_by=$7, confirmed_at=NOW()`,
      [
        crm_key, crm_name || '', company_num, company_name || '',
        matched_by || 'auto', confidence || 100,
        req.user.username,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[faradis-match] approve error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-match/reject ───────────────────────────────────────

router.post('/reject', requireAuth, requireManager, async function(req, res) {
  try {
    const { crm_key, company_num } = req.body;
    if (!crm_key || !company_num) return res.status(400).json({ error: 'crm_key و company_num الزامی است' });
    await query(
      `INSERT INTO center_faradis_rejected (crm_center_key, faradis_company_num, rejected_by, rejected_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT DO NOTHING`,
      [crm_key, company_num, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[faradis-match] reject error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/search ────────────────────────────────────────

router.get('/search', requireAuth, requireManager, async function(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    let rows;
    if (!q) {
      rows = await query(
        `SELECT company_num, company_name, company_code, phone, mobile, state_name, city_name, address, type_name
         FROM faradis_customers_cache
         ORDER BY company_name
         LIMIT $1`,
        [limit]
      );
    } else {
      rows = await query(
        `SELECT company_num, company_name, company_code, phone, mobile, state_name, city_name, address, type_name
         FROM faradis_customers_cache
         WHERE company_name ILIKE $1 OR phone ILIKE $1 OR mobile ILIKE $1 OR company_code ILIKE $1
         ORDER BY company_name
         LIMIT $2`,
        ['%' + q + '%', limit]
      );
    }
    res.json(rows.rows);
  } catch (e) {
    console.error('[faradis-match] search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/faradis-match/sync-factors ─────────────────────────────────

router.post('/sync-factors', requireAuth, requireManager, async function(req, res) {
  try {
    if (!faradis.isConfigured()) {
      return res.status(503).json({ error: 'اتصال به فرادیس پیکربندی نشده است' });
    }
    const factors = await faradis.fetchFactors();
    let count = 0;
    for (const f of factors) {
      const [jalaliDate, jalaliMonth] = gregToJalali(f.FactorDate);
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
          f.FactorNum, f.FactorCode || '', f.FactorDate || null, jalaliDate, jalaliMonth,
          f.FactorType || 1, f.MarketerNum || '', f.VisitorNum || '',
          f.CompanyNum, f.CompanyName || '', f.TotalAmount || 0,
        ]
      );
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[faradis-match] sync-factors error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/factors/:company_num ───────────────────────────
// Get all factors for a Faradis company (linked center's sales history)

router.get('/factors/:company_num', requireAuth, requireManager, async function(req, res) {
  try {
    const companyNum = parseInt(req.params.company_num);
    if (isNaN(companyNum)) return res.status(400).json({ error: 'company_num نامعتبر' });
    const rows = await query(
      `SELECT factor_num, factor_code, jalali_date, jalali_month, factor_type, total_amount
       FROM faradis_factors_cache
       WHERE company_num = $1
       ORDER BY factor_date DESC
       LIMIT 200`,
      [companyNum]
    );
    const summary = await query(
      `SELECT jalali_month,
              SUM(CASE WHEN factor_type=1 THEN total_amount ELSE 0 END) AS invoiced,
              SUM(CASE WHEN factor_type=2 THEN total_amount ELSE 0 END) AS quoted,
              COUNT(CASE WHEN factor_type=1 THEN 1 END) AS invoice_count,
              COUNT(CASE WHEN factor_type=2 THEN 1 END) AS quote_count
       FROM faradis_factors_cache
       WHERE company_num = $1
       GROUP BY jalali_month
       ORDER BY jalali_month DESC
       LIMIT 24`,
      [companyNum]
    );
    res.json({ factors: rows.rows, monthly: summary.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/links ─────────────────────────────────────────

router.get('/links', requireAuth, requireManager, async function(req, res) {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const rows = await query(
      `SELECT id, crm_center_key, crm_center_name, faradis_company_num, faradis_company_name,
              matched_by, confidence, confirmed_by, confirmed_at, notes
       FROM center_faradis_link
       ORDER BY confirmed_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const total = await query('SELECT COUNT(*) FROM center_faradis_link');
    res.json({ links: rows.rows, total: parseInt(total.rows[0].count) });
  } catch (e) {
    console.error('[faradis-match] links error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/faradis-match/links/:id ──────────────────────────────────

router.delete('/links/:id', requireAuth, requireManager, async function(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    await query('DELETE FROM center_faradis_link WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[faradis-match] delete link error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

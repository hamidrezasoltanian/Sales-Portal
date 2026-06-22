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

// ── Helper: parse centers from DB ─────────────────────────────────────────

async function loadCRMCenters() {
  const centers = [];
  try {
    // Tehran centers
    const tehranRow = await query(`SELECT data FROM centers_master WHERE key = 'CENTERS'`);
    if (tehranRow.rows.length) {
      let data = tehranRow.rows[0].data;
      // data might be array or { list:[], data:[] } or object of objects
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
          centers.push({ key, name });
        }
      }
    }
  } catch (e) {
    console.error('[faradis-match] error loading CENTERS:', e.message);
  }
  try {
    // Province centers
    const pcRow = await query(`SELECT data FROM centers_master WHERE key = 'PC_RAW'`);
    if (pcRow.rows.length) {
      let data = pcRow.rows[0].data;
      // PC_RAW is typically { "provId": [{...},...] }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [provId, provCenters] of Object.entries(data)) {
          if (!Array.isArray(provCenters)) continue;
          provCenters.forEach(function(c, idx) {
            if (!c) return;
            const name = c.name || c.n || '';
            if (!name) return;
            const rid = c.id != null ? String(c.id) : (provId + '||' + idx);
            const key = rid.includes('||') ? 'pc_' + rid : 'pc_' + provId + '||' + rid;
            centers.push({ key, name });
          });
        }
      }
    }
  } catch (e) {
    console.error('[faradis-match] error loading PC_RAW:', e.message);
  }
  return centers;
}

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
    });
  } catch (e) {
    console.error('[faradis-match] status error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/faradis-match/suggestions ───────────────────────────────────

router.get('/suggestions', requireAuth, requireManager, async function(req, res) {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const centers = await loadCRMCenters();

    // Get linked and rejected
    const linkedRows = await query('SELECT crm_center_key FROM center_faradis_link');
    const linkedKeys = new Set(linkedRows.rows.map(function(r){ return r.crm_center_key; }));

    const rejectedRows = await query('SELECT crm_center_key, faradis_company_num FROM center_faradis_rejected');
    const rejectedMap = {};
    rejectedRows.rows.forEach(function(r) {
      if (!rejectedMap[r.crm_center_key]) rejectedMap[r.crm_center_key] = new Set();
      rejectedMap[r.crm_center_key].add(String(r.faradis_company_num));
    });

    // Get all cached Faradis customers
    const custRows = await query(
      'SELECT company_num, company_name, company_code, phone, state_name, city_name FROM faradis_customers_cache ORDER BY company_num'
    );
    const customers = custRows.rows;

    if (customers.length === 0) {
      return res.json([]);
    }

    const results = [];
    const unlinked = centers.filter(function(c){ return !linkedKeys.has(c.key); });

    for (const center of unlinked) {
      const rejectedForCenter = rejectedMap[center.key] || new Set();

      // Score all customers
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

      results.push({
        crm_key: center.key,
        crm_name: center.name,
        suggestions: scored,
      });
    }

    // Sort by best confidence descending, then paginate
    results.sort(function(a, b){ return b.suggestions[0].confidence - a.suggestions[0].confidence; });
    const page = results.slice(offset, offset + limit);
    res.json(page);
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
    if (!q) return res.json([]);
    const rows = await query(
      `SELECT company_num, company_name, company_code, phone, mobile, state_name, city_name, address, type_name
       FROM faradis_customers_cache
       WHERE company_name ILIKE $1
       ORDER BY company_name
       LIMIT 10`,
      ['%' + q + '%']
    );
    res.json(rows.rows);
  } catch (e) {
    console.error('[faradis-match] search error:', e.message);
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

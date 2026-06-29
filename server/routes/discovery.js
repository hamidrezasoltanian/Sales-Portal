'use strict';
const express = require('express');
const https = require('https');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../auth');

async function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const r = await query("SELECT value FROM app_settings WHERE key = 'anthropicKey'");
    if (r.rows.length && r.rows[0].value) return r.rows[0].value;
  } catch (_) {}
  return null;
}

function callAnthropicWithSearch(apiKey, userPrompt) {
  const payload = JSON.stringify({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: userPrompt }],
  });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function parseCentersFromAI(aiResponse) {
  // Extract text from Claude's response content blocks
  const blocks = aiResponse.body?.content || [];
  let text = blocks
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Try to extract JSON array from the text
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                    text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (Array.isArray(arr)) return arr;
    } catch (_) {}
  }

  // Fallback: parse bullet-point style text
  const centers = [];
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    const nameMatch = line.match(/^[•\-*]\s*(.+?)\s*(?:—|-|:)\s*(.+)/);
    if (nameMatch) {
      if (current) centers.push(current);
      current = { name: nameMatch[1].trim(), city: nameMatch[2].trim(), doctors: [], reasons: [] };
    } else if (current && line.includes('رادیولوژی')) {
      current.doctors.push({ label: 'رادیولوژیست', name: '' });
      current.reasons.push('رادیولوژیست');
    } else if (current && line.includes('اورولوژی')) {
      current.doctors.push({ label: 'اورولوژیست', name: '' });
      current.reasons.push('اورولوژیست');
    }
  }
  if (current) centers.push(current);
  return centers;
}

function scoreFromDoctors(doctors) {
  let score = 0;
  for (const d of (doctors || [])) {
    const lbl = (d.label || d.specialty || '').toLowerCase();
    if (lbl.includes('مداخله') || lbl.includes('interventional')) score += 10;
    else if (lbl.includes('رادیولوژی') || lbl.includes('radiology')) score += 7;
    else if (lbl.includes('اورولوژی') || lbl.includes('urology')) score += 6;
  }
  return score;
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS discovered_centers (
      id TEXT PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      city VARCHAR(100) DEFAULT '',
      address TEXT DEFAULT '',
      doctors JSONB DEFAULT '[]',
      biopsy_mentions INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      reasons TEXT[] DEFAULT '{}',
      source_urls TEXT[] DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'new',
      last_scraped TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /api/discovery  — list new centers (or all with ?all=1)
router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const all = req.query.all === '1';
    const where = all ? '' : "WHERE status = 'new'";
    const r = await query(
      `SELECT * FROM discovered_centers ${where} ORDER BY score DESC LIMIT 300`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/discovery/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const r = await query(
      `SELECT status, COUNT(*)::int AS count FROM discovered_centers GROUP BY status`
    );
    const stats = {};
    r.rows.forEach(row => { stats[row.status] = row.count; });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/discovery/:id  — update status: new | imported | ignored
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const { status } = req.body;
    if (!['new', 'imported', 'ignored'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    await query('UPDATE discovered_centers SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/discovery/import-file  — bulk upsert from scraper JSON output
router.post('/import-file', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const centers = req.body.centers;
    if (!Array.isArray(centers)) return res.status(400).json({ error: 'centers array required' });
    let saved = 0;
    for (const c of centers) {
      await query(`
        INSERT INTO discovered_centers
          (id, name, city, address, doctors, biopsy_mentions, score, reasons, source_urls, status, last_scraped)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
          COALESCE((SELECT status FROM discovered_centers WHERE id=$1),'new'),
          NOW())
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, city=EXCLUDED.city, address=EXCLUDED.address,
          doctors=EXCLUDED.doctors, biopsy_mentions=EXCLUDED.biopsy_mentions,
          score=EXCLUDED.score, reasons=EXCLUDED.reasons,
          source_urls=EXCLUDED.source_urls, last_scraped=NOW()
      `, [
        c.id, c.name, c.city || '', c.address || '',
        JSON.stringify(c.doctors || []),
        c.biopsy_mentions || 0, c.score || 0,
        c.reasons || [], c.source_urls || [],
      ]);
      saved++;
    }
    res.json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/discovery/ai-scan — use Claude + web_search to find biopsy centers
// body: { query?: string, city?: string }
router.post('/ai-scan', requireAuth, async (req, res) => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'کلید API کلود تنظیم نشده. از ⚙ تنظیمات → کلید API کلود وارد کنید.',
      });
    }

    await ensureTable();

    const city = req.body.city || '';
    const extraQuery = req.body.query || '';

    const prompt = `
تو یک متخصص بازاریابی تجهیزات پزشکی ایرانی هستی.
وظیفه: پیدا کردن بیمارستان‌ها، کلینیک‌ها و مراکز پزشکی ایران که بیشترین مصرف **سوزن بیوپسی** دارند.

مراکز هدف:
- دارای **رادیولوژیست مداخله‌ای** (Interventional Radiology) — امتیاز ۱۰
- دارای **رادیولوژیست** که خدمات بیوپسی دارند — امتیاز ۷
- دارای **اورولوژیست** — امتیاز ۶
- ذکر کلمه «بیوپسی» در سایت یا نظرات بیماران — امتیاز ۳+

${city ? `تمرکز روی شهر: ${city}` : 'همه شهرهای ایران'}
${extraQuery ? `شرط اضافی: ${extraQuery}` : ''}

از **همه منابع آنلاین** جستجو کن:
nobat.ir، doctorto.ir، paziresh24.com، drapp.ir، irimc.org (سایت نظام پزشکی)،
سایت‌های خود بیمارستان‌ها، و هر منبع دیگری.

**خروجی را فقط به صورت JSON array بده، هیچ متن دیگری نباشد:**
\`\`\`json
[
  {
    "name": "نام مرکز",
    "city": "شهر",
    "address": "آدرس (اختیاری)",
    "doctors": [
      {"name": "نام پزشک", "specialty": "رادیولوژی مداخله‌ای", "label": "اینترونشنال رادیولوژیست"}
    ],
    "biopsy_mentioned": true,
    "score": 10,
    "reasons": ["اینترونشنال رادیولوژیست: دکتر X"],
    "source_url": "https://..."
  }
]
\`\`\`
حداکثر ۳۰ مرکز، مرتب‌شده از بیشترین امتیاز.
`.trim();

    const result = await callAnthropicWithSearch(apiKey, prompt);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.body?.error?.message || 'خطای API' });
    }

    const rawCenters = parseCentersFromAI(result);
    const centers = rawCenters.map(c => {
      const id = crypto.createHash('md5')
        .update(`${c.name}::${c.city}`)
        .digest('hex')
        .slice(0, 14);
      const score = c.score || scoreFromDoctors(c.doctors) + (c.biopsy_mentioned ? 3 : 0);
      return {
        id,
        name: c.name || '',
        city: c.city || '',
        address: c.address || '',
        doctors: c.doctors || [],
        biopsy_mentions: c.biopsy_mentioned ? 1 : 0,
        score,
        reasons: c.reasons || c.doctors?.map(d => `${d.label || d.specialty}: ${d.name}`) || [],
        source_urls: c.source_url ? [c.source_url] : [],
      };
    }).filter(c => c.name && c.score > 0);

    // Upsert to DB
    let saved = 0;
    for (const c of centers) {
      await query(`
        INSERT INTO discovered_centers
          (id, name, city, address, doctors, biopsy_mentions, score, reasons, source_urls, status, last_scraped)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
          COALESCE((SELECT status FROM discovered_centers WHERE id=$1),'new'),
          NOW())
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, city=EXCLUDED.city, doctors=EXCLUDED.doctors,
          score=EXCLUDED.score, reasons=EXCLUDED.reasons,
          source_urls=EXCLUDED.source_urls, last_scraped=NOW()
      `, [
        c.id, c.name, c.city, c.address,
        JSON.stringify(c.doctors), c.biopsy_mentions, c.score,
        c.reasons, c.source_urls,
      ]);
      saved++;
    }

    res.json({ ok: true, saved, centers });
  } catch (e) {
    console.error('[discovery/ai-scan]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

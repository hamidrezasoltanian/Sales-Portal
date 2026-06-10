'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../auth');

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

module.exports = router;

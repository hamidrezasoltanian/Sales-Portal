'use strict';

// Load .env manually (no dotenv dependency needed)
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(function(line) {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
} catch (e) {}

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { initSchema } = require('./db');

let helmet, compression;
try { helmet = require('helmet'); } catch(e) {}
try { compression = require('compression'); } catch(e) {}

const app = express();

// Security & perf middleware
if (helmet) app.use(helmet({ contentSecurityPolicy: false }));
if (compression) app.use(compression());

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// CORS — same origin (no cross-origin needed since frontend is served from same server)
app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Static — serve public/ directory
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  // Prevent stale JS/CSS after server updates — browser always revalidates
  app.use(function(req, res, next) {
    if (/\.(js|css|html)$/.test(req.path) || req.path === '/') res.setHeader('Cache-Control', 'no-cache');
    next();
  });
  app.use(express.static(publicDir));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/data', require('./routes/data'));
app.use('/api/users', require('./routes/users'));
app.use('/api/distribution', require('./routes/distribution'));
app.use('/api/ai', require('./routes/ai'));
const { router: eventsRouter } = require('./routes/events');
app.use('/api/events', eventsRouter);
app.use('/api/audit', require('./routes/audit'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/files', require('./routes/files'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/wms', require('./routes/wms'));
app.use('/api/proforma', require('./routes/proforma'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/week-entries', require('./routes/week-entries'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/changelog', require('./routes/changelog'));
app.use('/api/migrate', require('./routes/migrate'));
app.use('/api/support', require('./routes/support'));
app.use('/api/hr', require('./routes/hr'));
app.use('/api/trade-kpi', require('./routes/trade-kpi'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/faradis', require('./routes/faradis'));
const faradisMatch = require('./routes/faradis-match');
app.use('/api/faradis-match', faradisMatch);
const faradisData = require('./routes/faradis-data');
app.use('/api/faradis-data', faradisData);

// Health check — بدون auth، قابل دسترس از هر جا
app.get('/api/health', async function (req, res) {
  const start = Date.now();
  const result = {
    ok: true,
    time: new Date().toISOString(),
    uptime_sec: Math.floor(process.uptime()),
    checks: {}
  };

  // ── PostgreSQL ────────────────────────────────────────────────────────
  try {
    const { query } = require('./db');
    const r = await Promise.race([
      query('SELECT 1 AS ok'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
    ]);
    result.checks.postgres = { ok: true };
  } catch (e) {
    result.checks.postgres = { ok: false, error: e.message };
    result.ok = false;
  }

  // ── Faradis (اتصال به SQL Server) ────────────────────────────────────
  try {
    const faradis = require('./integrations/faradis');
    if (!faradis.isConfigured()) {
      result.checks.faradis = { ok: null, note: 'not configured' };
    } else {
      const r = await Promise.race([
        faradis.testConnection(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
      ]);
      result.checks.faradis = { ok: true, server_time: r && r.now };
    }
  } catch (e) {
    result.checks.faradis = { ok: false, error: e.message };
    // فرادیس down بودنش OK رو خراب نمی‌کنه (optional dependency)
  }

  // ── آخرین sync فرادیس ────────────────────────────────────────────────
  try {
    const { query } = require('./db');
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM faradis_customers_cache)  AS customers,
        (SELECT COUNT(*) FROM faradis_factors_cache)    AS factors,
        (SELECT COUNT(*) FROM faradis_receivables_cache) AS receivables,
        (SELECT MAX(synced_at) FROM faradis_factors_cache) AS last_sync
    `);
    result.checks.faradis_cache = r.rows[0];
  } catch (e) {
    result.checks.faradis_cache = { error: e.message };
  }

  result.elapsed_ms = Date.now() - start;
  res.status(result.ok ? 200 : 503).json(result);
});

// WMS page — serve wms.html (auth handled client-side via /api/auth/me check)
app.get('/wms', function (req, res) {
  const wmsPath = path.join(publicDir, 'wms.html');
  if (fs.existsSync(wmsPath)) {
    res.sendFile(wmsPath);
  } else {
    res.status(404).send('WMS not deployed yet');
  }
});

// Catch-all: serve public/index.html for non-API routes
app.get('*', function (req, res) {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found. Please place your HTML file at public/index.html');
  }
});

// Error handler
app.use(function (err, req, res, next) {
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

const PORT = parseInt(process.env.PORT || '3000');

async function start() {
  try {
    await initSchema();
    app.listen(PORT, function () {
      console.log('[Atena CRM] Server running on http://localhost:' + PORT);
    });
    // Start Telegram bot (non-blocking)
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const bot = require('./bot/telegram');
      bot.poll().catch(function(e){ console.error('[bot] fatal:', e.message); });
    }
  } catch (e) {
    console.error('[Atena CRM] Startup failed:', e.message);
    process.exit(1);
  }
}

start();

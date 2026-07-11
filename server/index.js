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
const { checkDevDatabaseGuard } = require('./lib/dev-guard');
const { checkProductionGuard } = require('./lib/prod-guard');
const { log, logRequest } = require('./lib/log');
const { JWT_SECRET, _DEFAULT_SECRET } = require('./auth');

let helmet, compression;
try { helmet = require('helmet'); } catch(e) {}
try { compression = require('compression'); } catch(e) {}

const app = express();

// Security & perf middleware
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'cdn.jsdelivr.net', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://api.anthropic.com'],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }));
}
if (compression) app.use(compression());

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(function (req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const start = Date.now();
  res.on('finish', function () {
    if (res.statusCode >= 500) {
      logRequest(req, Date.now() - start, new Error('HTTP ' + res.statusCode));
    }
  });
  next();
});

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(function(req, res, next) {
    if (/\.(js|css|html)$/.test(req.path) || req.path === '/') res.setHeader('Cache-Control', 'no-cache');
    next();
  });
  app.use(express.static(publicDir));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/data', require('./routes/data'));
app.use('/api/centers', require('./routes/centers'));
app.use('/api/mtr-sync', require('./routes/mtr-sync'));
app.use('/api/users', require('./routes/users'));
app.use('/api/distribution', require('./routes/distribution'));
app.use('/api/ai', require('./routes/ai'));
const { router: eventsRouter } = require('./routes/events');
app.use('/api/events', eventsRouter);
app.use('/api/audit', require('./routes/audit'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/hcps', require('./routes/hcps'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/files', require('./routes/files'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/wms', require('./routes/wms'));
app.use('/api/wms', require('./routes/wms-ext').router);
app.use('/api/proforma', require('./routes/proforma'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/week-entries', require('./routes/week-entries'));
app.use('/api/crm-settings', require('./routes/crm-settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/changelog', require('./routes/changelog'));
app.use('/api/activity-log', require('./routes/activity-log'));
app.use('/api/calendar-events', require('./routes/calendar-events'));
app.use('/api/checklist', require('./routes/checklist-api'));
app.use('/api/mission-log', require('./routes/mission-log'));
app.use('/api/kpi-data', require('./routes/kpi-data'));
app.use('/api/prov-history', require('./routes/prov-history'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/manager-followups', require('./routes/manager-followups'));
app.use('/api/center-extras', require('./routes/center-extras'));
app.use('/api/center-deals', require('./routes/center-deals'));
app.use('/api/center-files', require('./routes/center-files'));
app.use('/api/manager-reports', require('./routes/manager-reports'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/mtr', require('./routes/mtr'));
app.use('/api/migrate', require('./routes/migrate'));
app.use('/api/support', require('./routes/support'));
app.use('/api/hr', require('./routes/hr'));
app.use('/api/trade-kpi', require('./routes/trade-kpi'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/kpi-data', require('./routes/kpi-data'));
app.use('/api/manager-reports', require('./routes/manager-reports'));
app.use('/api/center-reports', require('./routes/center-reports'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/faradis', require('./routes/faradis'));
const faradisMatch = require('./routes/faradis-match');
app.use('/api/faradis-match', faradisMatch);
const faradisData = require('./routes/faradis-data');
app.use('/api/faradis-data', faradisData);
app.use('/api/letters', require('./routes/letters'));

app.get('/api/health', async function (req, res) {
  const start = Date.now();
  const result = {
    ok: true,
    time: new Date().toISOString(),
    uptime_sec: Math.floor(process.uptime()),
    checks: {}
  };

  try {
    const { query } = require('./db');
    await Promise.race([
      query('SELECT 1 AS ok'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
    ]);
    result.checks.postgres = { ok: true };
  } catch (e) {
    result.checks.postgres = { ok: false, error: e.message };
    result.ok = false;
  }

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
  }

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

app.get('/wms', function (req, res) {
  const wmsPath = path.join(publicDir, 'wms.html');
  if (fs.existsSync(wmsPath)) {
    res.sendFile(wmsPath);
  } else {
    res.status(404).send('WMS not deployed yet');
  }
});

app.get('*', function (req, res) {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found. Please place your HTML file at public/index.html');
  }
});

app.use(function (err, req, res, next) {
  log('error', {
    route: req.method + ' ' + (req.originalUrl || req.url),
    user: req.user && req.user.username ? req.user.username : null,
    err: err.message || String(err),
  });
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
    } catch (_) {}
  }
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

const PORT = parseInt(process.env.PORT || '3000');

async function start() {
  if (process.env.NODE_ENV === 'production' && JWT_SECRET === _DEFAULT_SECRET) {
    console.error('[FATAL] JWT_SECRET must be set in production. Refusing to start.');
    process.exit(1);
  }
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
      console.log('[Sentry] initialized');
    } catch (e) {
      console.warn('[Sentry] SENTRY_DSN set but @sentry/node not installed — skipping');
    }
  }
  try {
    checkDevDatabaseGuard();
    checkProductionGuard();
    await initSchema();
    const pgDb = process.env.PG_DATABASE || 'atena_crm';
    const port = parseInt(process.env.PORT || '3000', 10);
    if (port === 4000 && pgDb === 'atena_crm') {
      console.warn('[WARNING] Dev port 4000 connected to PRODUCTION database "' + pgDb + '"');
      console.warn('[WARNING] Use PG_DATABASE=atena_crm_dev — see .env.dev.example and scripts/setup_dev_db.sh');
    }
    app.listen(PORT, function () {
      console.log('[Atena CRM] Server running on http://localhost:' + PORT);
    });
    try {
      require('./lib/auto-backup').startAutoBackupScheduler();
    } catch (e) {
      console.warn('[auto-backup] scheduler not started:', e.message);
    }
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

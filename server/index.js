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

const app = express();

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

// Health check
app.get('/api/health', function (req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
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
  } catch (e) {
    console.error('[Atena CRM] Startup failed:', e.message);
    process.exit(1);
  }
}

start();

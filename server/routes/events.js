'use strict';
const express = require('express');
const { requireAuth } = require('../auth');
const router = express.Router();

const _clients = new Set();

router.get('/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client = { res, username: req.user.username, id: Date.now() };
  _clients.add(client);
  res.write(`data: ${JSON.stringify({ type: 'connected', username: req.user.username })}\n\n`);

  // Heartbeat every 25s to keep connection alive
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch(e) { clearInterval(hb); } }, 25000);

  req.on('close', () => { _clients.delete(client); clearInterval(hb); });
});

function broadcast(type, data, excludeUsername) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  _clients.forEach(c => {
    if (c.username !== excludeUsername) {
      try { c.res.write(msg); } catch(e) { _clients.delete(c); }
    }
  });
}

module.exports = { router, broadcast };

'use strict';
const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const router = express.Router();

const _clients = new Set();

function sseWrite(res, chunk) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(chunk);
    return true;
  } catch (_) {
    return false;
  }
}

router.get('/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (req.socket) {
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0);
    if (typeof req.socket.setNoDelay === 'function') req.socket.setNoDelay(true);
  }

  const client = { res, username: req.user.username, cid: req.query.cid || '', id: Date.now() };
  _clients.add(client);
  sseWrite(res, `data: ${JSON.stringify({ type: 'connected', username: req.user.username })}\n\n`);

  const hb = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(hb);
      _clients.delete(client);
      return;
    }
    if (!sseWrite(res, ': heartbeat\n\n')) {
      clearInterval(hb);
      _clients.delete(client);
    }
  }, 25000);

  const cleanup = () => {
    _clients.delete(client);
    clearInterval(hb);
    if (!res.writableEnded && !res.destroyed) {
      try { res.end(); } catch (_) {}
    }
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

function broadcast(type, data, excludeCid) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  _clients.forEach((c) => {
    if (excludeCid && c.cid === excludeCid) return;
    if (!sseWrite(c.res, msg)) _clients.delete(c);
  });
}

router.post('/reload', requireAuth, requireManager, (req, res) => {
  broadcast('app-reload', { at: Date.now() });
  return res.json({ ok: true });
});

module.exports = { router, broadcast };

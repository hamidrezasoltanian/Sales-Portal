'use strict';
const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const router = express.Router();

const _clients = new Set();

function sseWrite(res, chunk) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(chunk);
    if (typeof res.flush === 'function') res.flush();
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

  let cleaned = false;
  const cleanup = function () {
    if (cleaned) return;
    cleaned = true;
    clearInterval(hb);
    _clients.delete(client);
    // Do not res.end() here — client disconnect mid-chunk causes ERR_INCOMPLETE_CHUNKED_ENCODING
  };

  // Comment line helps proxies/browsers open the stream cleanly
  sseWrite(res, ': connected\n\n');
  sseWrite(res, 'data: ' + JSON.stringify({ type: 'connected', username: req.user.username }) + '\n\n');

  const hb = setInterval(function () {
    if (res.writableEnded || res.destroyed) {
      cleanup();
      return;
    }
    if (!sseWrite(res, 'data: ' + JSON.stringify({ type: 'heartbeat', at: Date.now() }) + '\n\n')) {
      cleanup();
    }
  }, 15000);

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

function broadcast(type, data, excludeCid) {
  const msg = 'data: ' + JSON.stringify(Object.assign({ type: type }, data)) + '\n\n';
  _clients.forEach(function (c) {
    if (excludeCid && c.cid === excludeCid) return;
    if (!sseWrite(c.res, msg)) _clients.delete(c);
  });
}

router.post('/reload', requireAuth, requireManager, (req, res) => {
  broadcast('app-reload', { at: Date.now() });
  return res.json({ ok: true });
});

module.exports = { router, broadcast };

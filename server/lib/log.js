'use strict';

/** Structured JSON log line for observability (grep-friendly). */
function log(level, fields) {
  const entry = Object.assign({
    ts: new Date().toISOString(),
    level,
  }, fields || {});
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function logRequest(req, ms, err) {
  const fields = {
    route: req.method + ' ' + (req.originalUrl || req.url),
    user: req.user && req.user.username ? req.user.username : null,
    ms: ms != null ? ms : undefined,
  };
  if (err) {
    fields.err = err.message || String(err);
    log('error', fields);
  } else {
    log('info', fields);
  }
}

module.exports = { log, logRequest };

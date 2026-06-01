'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-string';

function requireAuth(req, res, next) {
  let token = null;

  // Try cookie first
  if (req.cookies && req.cookies.atena_token) {
    token = req.cookies.atena_token;
  }

  // Try Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'احراز هویت الزامی است' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { username: decoded.username, role: decoded.role, name: decoded.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده' });
  }
}

function requireManager(req, res, next) {
  requireAuth(req, res, function () {
    if (req.user.role !== 'مدیر') {
      return res.status(403).json({ error: 'دسترسی فقط برای مدیران' });
    }
    next();
  });
}

module.exports = { requireAuth, requireManager, JWT_SECRET };

'use strict';

/**
 * Detect cycle if username's direct_manager chain eventually points back to username.
 * @returns {Promise<string|null>} error message or null if ok
 */
async function detectDirectManagerCycle(username, newManager, queryFn) {
  if (!newManager || typeof newManager !== 'string') return null;
  const mgr = newManager.trim();
  if (!mgr) return null;
  if (mgr === username) {
    return 'کاربر نمی‌تواند مدیر مستقیم خودش باشد';
  }

  const visited = new Set();
  let cur = mgr;
  while (cur) {
    if (cur === username) {
      return 'چرخه در زنجیره مدیر مستقیم — این انتساب مجاز نیست';
    }
    if (visited.has(cur)) {
      return 'چرخه در زنجیره مدیر مستقیم — این انتساب مجاز نیست';
    }
    visited.add(cur);
    const r = await queryFn('SELECT direct_manager FROM app_users WHERE username = $1', [cur]);
    if (!r.rows.length) break;
    const next = r.rows[0].direct_manager;
    cur = next && String(next).trim() ? String(next).trim() : null;
  }
  return null;
}

module.exports = { detectDirectManagerCycle };

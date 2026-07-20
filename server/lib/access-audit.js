'use strict';

const { query } = require('../db');

/**
 * Minimal audit trail for RBAC / org hierarchy changes.
 * Failures are logged but do not fail the primary write.
 */
async function logAccessChange(opts) {
  try {
    const target = opts.targetUser || opts.target_user || '';
    const field = opts.field || '';
    if (!target || !field) return;
    await query(
      `INSERT INTO access_audit (at, actor, target_user, field, old_value, new_value, note)
       VALUES (NOW(), $1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [
        opts.actor || '',
        target,
        field,
        JSON.stringify(opts.oldValue != null ? opts.oldValue : null),
        JSON.stringify(opts.newValue != null ? opts.newValue : null),
        opts.note || null,
      ]
    );
  } catch (e) {
    console.error('[access-audit]', e.message);
  }
}

module.exports = { logAccessChange };

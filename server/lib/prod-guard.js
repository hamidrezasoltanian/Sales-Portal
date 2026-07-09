'use strict';

const _DEFAULT_JWT = 'change-this-to-a-random-secret-string';

/**
 * Production startup checks — fail fast on insecure defaults.
 */
function checkProductionGuard() {
  if (process.env.NODE_ENV !== 'production') return;

  const errors = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === _DEFAULT_JWT) {
    errors.push('JWT_SECRET must be set to a strong random value in production');
  }

  if (!process.env.PRICING_ACCESS_PASSWORD_HASH && !process.env.PRICING_ACCESS_PASSWORD) {
    console.warn('[PROD GUARD] PRICING_ACCESS_PASSWORD_HASH not set — pricing margin panel will reject unlock');
  }

  if (!process.env.PG_PASSWORD) {
    errors.push('PG_PASSWORD is required in production');
  }

  if (errors.length) {
    console.error('[PROD GUARD] Refusing to start:');
    errors.forEach(function (e) { console.error('  - ' + e); });
    process.exit(1);
  }
}

module.exports = { checkProductionGuard };

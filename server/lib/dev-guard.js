'use strict';

/**
 * Warn when dev server points at production database name.
 */
const PROD_DB_NAMES = new Set(['atena_crm']);

function checkDevDatabaseGuard() {
  const db = process.env.PG_DATABASE || 'atena_crm';
  const env = process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';
  const force = process.env.ALLOW_PROD_DB_IN_DEV === '1';

  if (isDev && PROD_DB_NAMES.has(db) && !force) {
    console.warn('');
    console.warn('[DEV GUARD] ⚠  PG_DATABASE=' + db + ' looks like production.');
    console.warn('[DEV GUARD]    Create an isolated DB:  scripts/setup_dev_db.sh');
    console.warn('[DEV GUARD]    Then set PG_DATABASE=atena_crm_dev in .env');
    console.warn('[DEV GUARD]    Or set ALLOW_PROD_DB_IN_DEV=1 to suppress this warning.');
    console.warn('');
  }
}

module.exports = { checkDevDatabaseGuard };

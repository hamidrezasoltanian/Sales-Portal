'use strict';

// Drops a disposable test database after terminating its remaining connections.
const { query, pool } = require('../server/db');

const name = process.argv[2];
if (!/^atena_crm_test_[a-z0-9_]+$/i.test(name || '')) {
  console.error('Only atena_crm_test_* databases may be dropped.');
  process.exit(1);
}

(async function () {
  try {
    await query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '" + name + "' AND pid <> pg_backend_pid()");
    await query('DROP DATABASE IF EXISTS ' + name);
    console.log('dropped ' + name);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}());

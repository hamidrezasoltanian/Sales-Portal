'use strict';

// Creates a disposable database for integration tests. Run with
// PG_DATABASE=postgres; server/db loads the remaining connection settings.
const { query, pool } = require('../server/db');

const name = process.argv[2];
if (!/^[a-z0-9_]+$/i.test(name || '')) {
  console.error('A safe database name is required.');
  process.exit(1);
}

(async function () {
  try {
    const exists = await query("SELECT 1 FROM pg_database WHERE datname = '" + name + "'");
    if (exists.rows.length) throw new Error('Test database already exists: ' + name);
    await query('CREATE DATABASE ' + name);
    console.log(name);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}());

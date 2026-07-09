'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Lightweight SQL migration runner.
 * Applies numbered *.sql files in server/migrations/ once, tracked in schema_migrations.
 */
async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname);
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(function (f) {
      return /^\d+_.+\.sql$/.test(f);
    }).sort();
  } catch (e) {
    return;
  }

  for (const file of files) {
    const applied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file]
    );
    if (applied.rows.length) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log('[migrate] applied', file);
    } catch (e) {
      await client.query('ROLLBACK').catch(function () {});
      throw new Error('Migration ' + file + ' failed: ' + e.message);
    } finally {
      client.release();
    }
  }
}

module.exports = { runMigrations };

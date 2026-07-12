const { Client } = require('pg');

async function compare() {
  const dbs = ['atena_crm', 'click_crm_v2'];
  for (const dbName of dbs) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: dbName,
      user: 'postgres',
      password: 'cat C:/click-crm-app/.env' ? '62604193' : '' // PGPASSWORD
    });
    try {
      await client.connect();
      const res = await client.query('SELECT COUNT(*) FROM center_extras');
      console.log(`DB ${dbName}: center_extras count = ${res.rows[0].count}`);
      
      const sample = await client.query('SELECT id, name, province_id, owner FROM center_extras ORDER BY id DESC LIMIT 5');
      console.log(`DB ${dbName} latest 5 extras:`);
      console.table(sample.rows);
    } catch (err) {
      console.error(`DB ${dbName} error:`, err.message);
    } finally {
      await client.end();
    }
  }
}

compare();

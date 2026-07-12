const { Client } = require('pg');

async function check() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'click_crm_v2',
    user: 'postgres',
    password: '62604193'
  });
  try {
    await client.connect();
    
    // Check app_users table
    const usersRes = await client.query('SELECT username, role FROM app_users');
    console.log('--- app_users Table ---');
    console.table(usersRes.rows);
    
    // Check settings members in app_settings table
    const settingsRes = await client.query("SELECT value FROM app_settings WHERE key = 'members'");
    if (settingsRes.rows.length > 0) {
      console.log('--- settings members ---');
      const val = settingsRes.rows[0].value;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      console.log('settings members not found in app_settings');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();

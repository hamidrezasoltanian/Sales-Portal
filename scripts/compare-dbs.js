const { Client } = require('pg');

async function compare() {
  const c1 = new Client({ host: 'localhost', port: 5432, database: 'atena_crm', user: 'postgres', password: 'cat C:/click-crm-app/.env' ? '62604193' : '' });
  const c2 = new Client({ host: 'localhost', port: 5432, database: 'click_crm_v2', user: 'postgres', password: 'cat C:/click-crm-app/.env' ? '62604193' : '' });
  
  try {
    await c1.connect();
    await c2.connect();
    
    const r1 = await c1.query('SELECT id, name, province_id, owner FROM center_extras');
    const r2 = await c2.query('SELECT id, name, province_id, owner FROM center_extras');
    
    const m2 = new Map(r2.rows.map(x => [x.id, x]));
    
    console.log('Centers in atena_crm but NOT in click_crm_v2:');
    let count = 0;
    for (const row of r1.rows) {
      if (!m2.has(row.id)) {
        console.log(`  ID: ${row.id}, Name: ${row.name}, Province: ${row.province_id}, Owner: ${row.owner}`);
        count++;
      }
    }
    console.log(`Total missing: ${count}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await c1.end();
    await c2.end();
  }
}

compare();

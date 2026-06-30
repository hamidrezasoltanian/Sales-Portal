const { query } = require('../server/db');

(async () => {
  console.log('Inspecting PostgreSQL Database Tables:');
  const tablesRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  for (const row of tablesRes.rows) {
    const countRes = await query(`SELECT COUNT(*) FROM "${row.table_name}"`);
    console.log(`- ${row.table_name}: ${countRes.rows[0].count} rows`);
  }
})().catch(console.error);

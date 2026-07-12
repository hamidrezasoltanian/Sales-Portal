const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:62604193@localhost:5432/click_crm_v2'
});

async function main() {
  await client.connect();
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='center_contacts' AND table_schema='public'"
  );
  console.log('=== center_contacts columns ===');
  cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

  // Also check center_extras
  const hasExtras = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'center_extras')"
  );
  console.log('center_extras exists: ' + hasExtras.rows[0].exists);

  if (hasExtras.rows[0].exists) {
    const extCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='center_extras' AND table_schema='public'"
    );
    console.log('=== center_extras columns ===');
    extCols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  }

  await client.end();
}
main().catch(async e => {
  console.error(e.message);
  await client.end();
});

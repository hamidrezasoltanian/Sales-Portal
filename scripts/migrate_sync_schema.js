const { Client } = require('pg');
const fs = require('fs');
const { requirePgConfig } = require('./lib/pg-config');

(async () => {
  const schema = JSON.parse(fs.readFileSync('schema_info.json', 'utf8'));
  const pg = requirePgConfig();

  const client = new Client(pg);
  await client.connect();
  console.log('[Migration] Connected to database:', pg.database);

  for (const [tableName, tableData] of Object.entries(schema)) {
    console.log(`[Migration] Creating table ${tableName}...`);

    const colDefinitions = [];
    const pkColumns = [];

    if (tableData.constraints) {
      for (const constr of tableData.constraints) {
        if (constr.constraint_type === 'PRIMARY KEY') {
          pkColumns.push(constr.column_name);
        }
      }
    }

    for (const col of tableData.columns) {
      let typeStr = col.data_type;
      if (col.character_maximum_length) {
        typeStr += `(${col.character_maximum_length})`;
      }

      let defStr = `${col.column_name} ${typeStr}`;
      if (col.is_nullable === 'NO') {
        defStr += ' NOT NULL';
      }
      if (col.column_default !== null) {
        defStr += ` DEFAULT ${col.column_default}`;
      }
      colDefinitions.push(defStr);
    }

    if (pkColumns.length > 0) {
      colDefinitions.push(`PRIMARY KEY (${pkColumns.join(', ')})`);
    }

    const createTableSql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${colDefinitions.join(',\n  ')}\n);`;
    await client.query(createTableSql);
    console.log(`[Migration] Table ${tableName} created/verified successfully.`);
  }

  await client.end();
  console.log('[Migration] All tables successfully created and verified.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

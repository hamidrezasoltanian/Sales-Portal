#!/usr/bin/env node
'use strict';

const sql = require('mssql');
const { resolveSqlPort, cfg } = require('./lib/faradis-mssql');

(async () => {
  const port = await resolveSqlPort();
  const sqlConfig = {
    user: cfg.user,
    password: cfg.password,
    server: cfg.server,
    database: cfg.database,
    port: port || cfg.port || 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: cfg.instanceName,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  const pool = await sql.connect(sqlConfig);
  console.log('Connected to MSSQL Faradis database.');

  const query = `
    SELECT TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%Factor%' 
       OR TABLE_NAME LIKE '%Invoice%' 
       OR TABLE_NAME LIKE '%Pre%' 
       OR TABLE_NAME LIKE '%Sale%' 
       OR TABLE_NAME LIKE '%Faktor%' 
       OR TABLE_NAME LIKE '%Pish%'
    ORDER BY TABLE_TYPE, TABLE_NAME
  `;
  const result = await pool.request().query(query);
  console.log('Matching Tables/Views in Faradis:');
  console.log(result.recordset);

  const allQuery = `
    SELECT TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    ORDER BY TABLE_TYPE, TABLE_NAME
  `;
  const allResult = await pool.request().query(allQuery);
  console.log('\nAll Tables/Views count:', allResult.recordset.length);
  console.log('Sample of 100 tables/views:');
  console.log(allResult.recordset.slice(0, 100));

  await pool.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

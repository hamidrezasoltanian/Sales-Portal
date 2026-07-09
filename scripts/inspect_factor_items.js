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

  const columnsRes = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'FactorRow'
  `);
  console.log('FactorRow Columns:');
  console.log(columnsRes.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `[${c.CHARACTER_MAXIMUM_LENGTH}]` : ''})` ).join(', '));

  const sampleRes = await pool.request().query(`SELECT TOP 5 * FROM FactorRow`);
  console.log('\nFactorRow Sample Data:');
  console.log(sampleRes.recordset);

  await pool.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

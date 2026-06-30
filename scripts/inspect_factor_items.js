const sql = require('mssql');
const dgram = require('dgram');

const SQL_HOST = '192.168.4.4';
const SQL_INSTANCE = 'FARADISSOFT';
const SQL_USER = 'ma';
const SQL_PASS = 'adminS@2';
const SQL_DB = 'faradissoftatenazist';

function resolveSqlPort() {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from([0x02]);
    let resolved = false;

    client.on('message', (msg) => {
      const response = msg.toString('ascii');
      const parts = response.split(';');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].toLowerCase() === 'instancename' && parts[i+1] && parts[i+1].toLowerCase() === SQL_INSTANCE.toLowerCase()) {
          for (let j = i; j < parts.length; j++) {
            if (parts[j].toLowerCase() === 'tcp' && parts[j+1]) {
              const port = parseInt(parts[j+1], 10);
              resolved = true;
              client.close();
              resolve(port);
              return;
            }
          }
        }
      }
      client.close();
      resolve(null);
    });

    client.on('error', () => {
      client.close();
      resolve(null);
    });

    client.send(message, 0, message.length, 1434, SQL_HOST, (err) => {
      if (err) {
        client.close();
        resolve(null);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        client.close();
      }
    }, 2000);
  });
}

(async () => {
  const port = await resolveSqlPort();
  const sqlConfig = {
    user: SQL_USER,
    password: SQL_PASS,
    server: SQL_HOST,
    database: SQL_DB,
    port: port || 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: SQL_INSTANCE,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  const pool = await sql.connect(sqlConfig);
  console.log('Connected to MSSQL Faradis database.');

  // Columns of FactorRow table
  const columnsRes = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'FactorRow'
  `);
  console.log('FactorRow Columns:');
  console.log(columnsRes.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `[${c.CHARACTER_MAXIMUM_LENGTH}]` : ''})` ).join(', '));

  // Sample data of FactorRow
  const sampleRes = await pool.request().query(`
    SELECT TOP 5 * FROM FactorRow
  `);
  console.log('\nFactorRow Sample Data:');
  console.log(sampleRes.recordset);

  await pool.close();
})().catch(console.error);

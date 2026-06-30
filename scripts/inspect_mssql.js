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
        resolve(null);
      }
    }, 2000);
  });
}

(async () => {
  const port = await resolveSqlPort();
  console.log('Resolved port:', port);
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

  // List all tables and views containing words like 'Factor', 'Invoice', 'Pre', 'Sale', 'Faktor'
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

  // Let's also print ALL tables in Faradis just in case there are other names we didn't think of
  const allQuery = `
    SELECT TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    ORDER BY TABLE_TYPE, TABLE_NAME
  `;
  const allResult = await pool.request().query(allQuery);
  console.log('\nAll Tables/Views count:', allResult.recordset.length);
  // Log first 100 table names to see the naming style
  console.log('Sample of 100 tables/views:');
  console.log(allResult.recordset.slice(0, 100));

  await pool.close();
})().catch(console.error);

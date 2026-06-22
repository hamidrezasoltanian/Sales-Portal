'use strict';

let sql;
try { sql = require('mssql'); } catch(e) {}

const config = {
  server: process.env.FARADIS_SERVER || '192.168.4.4',
  port: parseInt(process.env.FARADIS_PORT || '50727'),
  database: process.env.FARADIS_DATABASE || 'faradissoftatenazist',
  user: process.env.FARADIS_USER || 'ma',
  password: process.env.FARADIS_PASSWORD || '',
  options: {
    instanceName: process.env.FARADIS_INSTANCE || 'FARADISSOFT',
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 10000,
    requestTimeout: 30000,
  },
  pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
};

let pool = null;
let poolConnected = false;
let lastConnectAttempt = 0;
const RECONNECT_INTERVAL = 60000; // retry every 60s if down

async function getPool() {
  if (!sql) throw new Error('mssql package not available');
  const now = Date.now();
  if (pool && poolConnected) return pool;
  if (now - lastConnectAttempt < RECONNECT_INTERVAL) throw new Error('Faradis DB unavailable (cooldown)');
  lastConnectAttempt = now;
  try {
    if (pool) { try { await pool.close(); } catch(e) {} }
    pool = await new sql.ConnectionPool(config).connect();
    poolConnected = true;
    pool.on('error', function(err) {
      console.error('[faradis] pool error:', err.message);
      poolConnected = false;
    });
    console.log('[faradis] connected to SQL Server');
    return pool;
  } catch(e) {
    poolConnected = false;
    throw new Error('Faradis connection failed: ' + e.message);
  }
}

// Fetch approved invoices for a given Jalali month range
// jalaliMonth: 'YYYY/MM' (e.g. '1403/01')
async function fetchSalesByMonth(jalaliMonth) {
  const p = await getPool();
  // Faradis stores Jalali date as integer YYYYMMDD
  const [jy, jm] = jalaliMonth.split('/').map(Number);
  const dateFrom = jy * 10000 + jm * 100 + 1;
  const dateTo = jy * 10000 + jm * 100 + 31;

  const r = await p.request()
    .input('dateFrom', sql.Int, dateFrom)
    .input('dateTo', sql.Int, dateTo)
    .query(`
      SELECT
        f.FactorID,
        f.FactorNum,
        f.FactorDate,
        f.MarketerNum,
        f.VisitorNum,
        f.CompanyID,
        COALESCE(vc.CompanyName, '') AS CompanyName,
        COALESCE(vc.CompanyCode, '') AS CompanyCode,
        COALESCE(SUM(fr.TotalPrice), 0) AS TotalAmount,
        COALESCE(SUM(fr.Qty * fr.UnitPrice), 0) AS SubTotal,
        COALESCE(f.Discount, 0) AS Discount,
        COALESCE(f.Tax, 0) AS Tax
      FROM Factor f
      LEFT JOIN FactorRow fr ON fr.FactorID = f.FactorID
      LEFT JOIN VCompany vc ON vc.CompanyID = f.CompanyID
      WHERE f.FactorType = 1
        AND f.FactorDate >= @dateFrom
        AND f.FactorDate <= @dateTo
        AND f.Deleted = 0
      GROUP BY f.FactorID, f.FactorNum, f.FactorDate, f.MarketerNum,
               f.VisitorNum, f.CompanyID, vc.CompanyName, vc.CompanyCode,
               f.Discount, f.Tax
      ORDER BY f.FactorDate DESC
    `);
  return r.recordset;
}

// Fetch sales summary per marketer for a month
async function fetchMarketerSummary(jalaliMonth) {
  const p = await getPool();
  const [jy, jm] = jalaliMonth.split('/').map(Number);
  const dateFrom = jy * 10000 + jm * 100 + 1;
  const dateTo = jy * 10000 + jm * 100 + 31;

  const r = await p.request()
    .input('dateFrom', sql.Int, dateFrom)
    .input('dateTo', sql.Int, dateTo)
    .query(`
      SELECT
        f.MarketerNum,
        f.VisitorNum,
        COUNT(DISTINCT f.FactorID) AS InvoiceCount,
        COALESCE(SUM(fr.TotalPrice), 0) AS TotalAmount,
        COUNT(DISTINCT f.CompanyID) AS CustomerCount
      FROM Factor f
      LEFT JOIN FactorRow fr ON fr.FactorID = f.FactorID
      WHERE f.FactorType = 1
        AND f.FactorDate >= @dateFrom
        AND f.FactorDate <= @dateTo
        AND f.Deleted = 0
      GROUP BY f.MarketerNum, f.VisitorNum
      ORDER BY TotalAmount DESC
    `);
  return r.recordset;
}

// Fetch sales for multiple months (for trend)
async function fetchSalesTrend(jalaliMonths) {
  const p = await getPool();
  if (!jalaliMonths || !jalaliMonths.length) return [];

  // Build date ranges
  const conditions = jalaliMonths.map(function(m) {
    const [jy, jm] = m.split('/').map(Number);
    return { month: m, from: jy * 10000 + jm * 100 + 1, to: jy * 10000 + jm * 100 + 31 };
  });

  const dateFrom = Math.min(...conditions.map(c => c.from));
  const dateTo = Math.max(...conditions.map(c => c.to));

  const r = await p.request()
    .input('dateFrom', sql.Int, dateFrom)
    .input('dateTo', sql.Int, dateTo)
    .query(`
      SELECT
        f.MarketerNum,
        f.VisitorNum,
        f.FactorDate,
        COALESCE(SUM(fr.TotalPrice), 0) AS TotalAmount
      FROM Factor f
      LEFT JOIN FactorRow fr ON fr.FactorID = f.FactorID
      WHERE f.FactorType = 1
        AND f.FactorDate >= @dateFrom
        AND f.FactorDate <= @dateTo
        AND f.Deleted = 0
      GROUP BY f.MarketerNum, f.VisitorNum, f.FactorDate
    `);

  // Group by month
  const byMonth = {};
  for (const row of r.recordset) {
    const d = String(row.FactorDate); // YYYYMMDD
    const jy = d.slice(0,4), jm = d.slice(4,6);
    const m = jy + '/' + jm;
    if (!byMonth[m]) byMonth[m] = {};
    const key = String(row.MarketerNum || '') + '_' + String(row.VisitorNum || '');
    byMonth[m][key] = (byMonth[m][key] || 0) + Number(row.TotalAmount);
  }
  return byMonth;
}

// Test connection
async function testConnection() {
  const p = await getPool();
  const r = await p.request().query('SELECT GETDATE() AS now, @@VERSION AS ver');
  return r.recordset[0];
}

// Check if mssql is available and env is configured
function isConfigured() {
  return !!(sql && process.env.FARADIS_SERVER && process.env.FARADIS_PASSWORD);
}

async function fetchCustomers() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT CompanyNum, CompanyName, CompanyCode,
           COALESCE(Phone1,'') AS Phone1, COALESCE(Mobile1,'') AS Mobile1,
           COALESCE(StateName1,'') AS StateName1, COALESCE(CityName1,'') AS CityName1,
           LEFT(COALESCE(Address1,''), 500) AS Address1, COALESCE(TypeName,'') AS TypeName
    FROM VCompany
    ORDER BY CompanyNum
  `);
  return r.recordset;
}

async function fetchFactors() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT
      f.FactorNum,
      COALESCE(f.FactorCode, '') AS FactorCode,
      f.FactorDate,
      f.FactorType,
      COALESCE(f.MarketerNum, '') AS MarketerNum,
      COALESCE(f.VisitorNum, '') AS VisitorNum,
      f.CompanyNum,
      COALESCE(vc.CompanyName, '') AS CompanyName,
      COALESCE(SUM(fr.TotalPrice), 0) AS TotalAmount
    FROM Factor f
    LEFT JOIN FactorRow fr ON fr.FactorNum = f.FactorNum
    LEFT JOIN VCompany vc ON vc.CompanyNum = f.CompanyNum
    WHERE COALESCE(f.IsDelete, 0) = 0
      AND f.FactorType IN (1, 2)
    GROUP BY f.FactorNum, f.FactorCode, f.FactorDate, f.FactorType,
             f.MarketerNum, f.VisitorNum, f.CompanyNum, vc.CompanyName
    ORDER BY f.FactorDate DESC
  `);
  return r.recordset;
}

async function fetchStuffs() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT StuffNum,
           COALESCE(StuffCode, '') AS StuffCode,
           COALESCE(StuffName, '') AS StuffName,
           COALESCE(Unit1Name, '') AS UnitName
    FROM Stuff
    WHERE COALESCE(IsDelete, 0) = 0
    ORDER BY StuffNum
  `);
  return r.recordset;
}

async function fetchFactorRows() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT fr.FactorRowNum,
           fr.FactorNum,
           fr.StuffNum,
           COALESCE(s.StuffName, '') AS StuffName,
           COALESCE(fr.Count1, 0) AS Count1,
           COALESCE(fr.Price, 0) AS Price,
           COALESCE(fr.TotalPrice, 0) AS TotalPrice
    FROM FactorRow fr
    INNER JOIN Factor f ON f.FactorNum = fr.FactorNum
    LEFT JOIN Stuff s ON s.StuffNum = fr.StuffNum
    WHERE COALESCE(f.IsDelete, 0) = 0
      AND f.FactorType IN (1, 2)
    ORDER BY fr.FactorNum DESC
  `);
  return r.recordset;
}

async function fetchInventory() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT ss.StoreNum,
           COALESCE(st.StoreName, '') AS StoreName,
           ss.StuffNum,
           COALESCE(s.StuffName, '') AS StuffName,
           COALESCE(s.StuffCode, '') AS StuffCode,
           COALESCE(ss.CountAll, 0) AS CountAll
    FROM StoreStuff ss
    LEFT JOIN Store st ON st.StoreNum = ss.StoreNum
    LEFT JOIN Stuff s ON s.StuffNum = ss.StuffNum
    WHERE COALESCE(ss.CountAll, 0) != 0
    ORDER BY ss.StuffNum
  `);
  return r.recordset;
}

async function fetchFollowers() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT FollowerNum,
           COALESCE(FollowerCode, '') AS FollowerCode,
           COALESCE(FollowerName, '') AS FollowerName
    FROM Follower
    WHERE COALESCE(IsDelete, 0) = 0
    ORDER BY FollowerNum
  `);
  return r.recordset;
}

module.exports = { getPool, fetchSalesByMonth, fetchMarketerSummary, fetchSalesTrend, testConnection, isConfigured, fetchCustomers, fetchFactors, fetchStuffs, fetchFactorRows, fetchInventory, fetchFollowers };

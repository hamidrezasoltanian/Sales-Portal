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
  // Try extended fields first — PersonName, Phone2, Mobile2, Email, Fax, NationalCode
  try {
    const r = await p.request().query(`
      SELECT CompanyNum, CompanyName, CompanyCode,
             COALESCE(PersonName,'') AS PersonName,
             COALESCE(Phone1,'') AS Phone1, COALESCE(Phone2,'') AS Phone2,
             COALESCE(Mobile1,'') AS Mobile1, COALESCE(Mobile2,'') AS Mobile2,
             COALESCE(FaxNum,'') AS FaxNum,
             COALESCE(Email,'') AS Email,
             COALESCE(NationalCode,'') AS NationalCode,
             COALESCE(StateName1,'') AS StateName1, COALESCE(CityName1,'') AS CityName1,
             LEFT(COALESCE(Address1,''), 500) AS Address1, COALESCE(TypeName,'') AS TypeName
      FROM VCompany ORDER BY CompanyNum
    `);
    return r.recordset;
  } catch(e) {
    // Fallback: basic fields only (older Faradis versions)
    const r = await p.request().query(`
      SELECT CompanyNum, CompanyName, CompanyCode,
             COALESCE(Phone1,'') AS Phone1, COALESCE(Mobile1,'') AS Mobile1,
             COALESCE(StateName1,'') AS StateName1, COALESCE(CityName1,'') AS CityName1,
             LEFT(COALESCE(Address1,''), 500) AS Address1, COALESCE(TypeName,'') AS TypeName
      FROM VCompany ORDER BY CompanyNum
    `);
    return r.recordset;
  }
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
  // Try various combinations: table name, delete column, unit column
  const attempts = [
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, COALESCE(UnitName,'') AS UnitName FROM Stuff WHERE COALESCE(IsDelete,0)=0 ORDER BY StuffNum`,
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, COALESCE(UnitName,'') AS UnitName FROM Stuff WHERE COALESCE(Deleted,0)=0 ORDER BY StuffNum`,
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, COALESCE(UnitName,'') AS UnitName FROM Stuff ORDER BY StuffNum`,
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, '' AS UnitName FROM Stuff WHERE COALESCE(IsDelete,0)=0 ORDER BY StuffNum`,
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, '' AS UnitName FROM Stuff ORDER BY StuffNum`,
    // Try VStuff view
    `SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, COALESCE(UnitName,'') AS UnitName FROM VStuff ORDER BY StuffNum`,
  ];
  let lastErr;
  for (const q of attempts) {
    try {
      const r = await p.request().query(q);
      console.log('[faradis] fetchStuffs succeeded with:', q.slice(0, 80));
      return r.recordset;
    } catch(e) { lastErr = e; }
  }
  // Dynamic discovery: find the unit column name in Stuff table
  try {
    const cols = await p.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Stuff' ORDER BY ORDINAL_POSITION`);
    const colNames = cols.recordset.map(function(c) { return c.COLUMN_NAME; });
    const unitCol = colNames.find(function(c) { return c.toLowerCase().includes('unit'); });
    const delCol = colNames.includes('IsDelete') ? ' WHERE COALESCE(IsDelete,0)=0' : '';
    const unitSel = unitCol ? `COALESCE(${unitCol},'')` : "''";
    const r = await p.request().query(`SELECT StuffNum, COALESCE(StuffCode,'') AS StuffCode, COALESCE(StuffName,'') AS StuffName, ${unitSel} AS UnitName FROM Stuff${delCol} ORDER BY StuffNum`);
    console.log('[faradis] fetchStuffs dynamic: unitCol=', unitCol || 'none');
    return r.recordset;
  } catch(e2) { lastErr = e2; }
  throw lastErr;
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
  const attempts = [
    // CarStuff — confirmed table name in this Faradis installation
    `SELECT cs.StoreNum, COALESCE(st.StoreName,'') AS StoreName, cs.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(cs.Count1,0) AS CountAll FROM CarStuff cs LEFT JOIN Store st ON st.StoreNum=cs.StoreNum LEFT JOIN Stuff s ON s.StuffNum=cs.StuffNum WHERE COALESCE(cs.Count1,0)!=0`,
    `SELECT cs.StoreNum, COALESCE(st.StoreName,'') AS StoreName, cs.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(cs.CountAll,0) AS CountAll FROM CarStuff cs LEFT JOIN Store st ON st.StoreNum=cs.StoreNum LEFT JOIN Stuff s ON s.StuffNum=cs.StuffNum WHERE COALESCE(cs.CountAll,0)!=0`,
    // StoreStuff variants
    `SELECT ss.StoreNum, COALESCE(st.StoreName,'') AS StoreName, ss.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(ss.CountAll,0) AS CountAll FROM StoreStuff ss LEFT JOIN Store st ON st.StoreNum=ss.StoreNum LEFT JOIN Stuff s ON s.StuffNum=ss.StuffNum WHERE COALESCE(ss.CountAll,0)!=0`,
    `SELECT ss.StoreNum, COALESCE(st.StoreName,'') AS StoreName, ss.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(ss.Count1,0) AS CountAll FROM StoreStuff ss LEFT JOIN Store st ON st.StoreNum=ss.StoreNum LEFT JOIN Stuff s ON s.StuffNum=ss.StuffNum WHERE COALESCE(ss.Count1,0)!=0`,
    `SELECT ss.StoreNum, COALESCE(st.StoreName,'') AS StoreName, ss.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(ss.Qty,0) AS CountAll FROM StoreStuff ss LEFT JOIN Store st ON st.StoreNum=ss.StoreNum LEFT JOIN Stuff s ON s.StuffNum=ss.StuffNum WHERE COALESCE(ss.Qty,0)!=0`,
    // WareHouseStuff variants
    `SELECT ws.WareHouseNum AS StoreNum, COALESCE(w.WareHouseName,'') AS StoreName, ws.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(ws.CountAll,0) AS CountAll FROM WareHouseStuff ws LEFT JOIN WareHouse w ON w.WareHouseNum=ws.WareHouseNum LEFT JOIN Stuff s ON s.StuffNum=ws.StuffNum WHERE COALESCE(ws.CountAll,0)!=0`,
    `SELECT ws.WareHouseNum AS StoreNum, COALESCE(w.WareHouseName,'') AS StoreName, ws.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(ws.Count1,0) AS CountAll FROM WareHouseStuff ws LEFT JOIN WareHouse w ON w.WareHouseNum=ws.WareHouseNum LEFT JOIN Stuff s ON s.StuffNum=ws.StuffNum WHERE COALESCE(ws.Count1,0)!=0`,
    // Anbar variants (انبار)
    `SELECT a.AnbarNum AS StoreNum, COALESCE(an.AnbarName,'') AS StoreName, a.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(a.CountAll,0) AS CountAll FROM AnbarStuff a LEFT JOIN Anbar an ON an.AnbarNum=a.AnbarNum LEFT JOIN Stuff s ON s.StuffNum=a.StuffNum WHERE COALESCE(a.CountAll,0)!=0`,
    `SELECT a.AnbarNum AS StoreNum, COALESCE(an.AnbarName,'') AS StoreName, a.StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(a.Count1,0) AS CountAll FROM AnbarStuff a LEFT JOIN Anbar an ON an.AnbarNum=a.AnbarNum LEFT JOIN Stuff s ON s.StuffNum=a.StuffNum WHERE COALESCE(a.Count1,0)!=0`,
    // AnbarKala / KalaAnbar variants
    `SELECT ak.AnbarNum AS StoreNum, COALESCE(an.AnbarName,'') AS StoreName, ak.KalaNum AS StuffNum, COALESCE(k.KalaName,'') AS StuffName, COALESCE(k.KalaCode,'') AS StuffCode, COALESCE(ak.Mojoodi,0) AS CountAll FROM AnbarKala ak LEFT JOIN Anbar an ON an.AnbarNum=ak.AnbarNum LEFT JOIN Kala k ON k.KalaNum=ak.KalaNum WHERE COALESCE(ak.Mojoodi,0)!=0`,
    `SELECT ak.AnbarNum AS StoreNum, COALESCE(an.AnbarName,'') AS StoreName, ak.KalaNum AS StuffNum, COALESCE(k.KalaName,'') AS StuffName, COALESCE(k.KalaCode,'') AS StuffCode, COALESCE(ak.CountAll,0) AS CountAll FROM AnbarKala ak LEFT JOIN Anbar an ON an.AnbarNum=ak.AnbarNum LEFT JOIN Kala k ON k.KalaNum=ak.KalaNum WHERE COALESCE(ak.CountAll,0)!=0`,
    // Views
    `SELECT 1 AS StoreNum, '' AS StoreName, StuffNum, COALESCE(StuffName,'') AS StuffName, COALESCE(StuffCode,'') AS StuffCode, COALESCE(CountAll,0) AS CountAll FROM VInventory WHERE COALESCE(CountAll,0)!=0`,
    `SELECT 1 AS StoreNum, '' AS StoreName, StuffNum, COALESCE(StuffName,'') AS StuffName, COALESCE(StuffCode,'') AS StuffCode, COALESCE(CountAll,0) AS CountAll FROM VStoreStuff WHERE COALESCE(CountAll,0)!=0`,
    `SELECT 1 AS StoreNum, '' AS StoreName, StuffNum, COALESCE(StuffName,'') AS StuffName, COALESCE(StuffCode,'') AS StuffCode, COALESCE(Count1,0) AS CountAll FROM VStoreStuff WHERE COALESCE(Count1,0)!=0`,
    `SELECT 1 AS StoreNum, '' AS StoreName, StuffNum, COALESCE(StuffName,'') AS StuffName, COALESCE(StuffCode,'') AS StuffCode, COALESCE(Mojoodi,0) AS CountAll FROM VAnbar WHERE COALESCE(Mojoodi,0)!=0`,
    `SELECT 1 AS StoreNum, '' AS StoreName, KalaNum AS StuffNum, COALESCE(KalaName,'') AS StuffName, COALESCE(KalaCode,'') AS StuffCode, COALESCE(Mojoodi,0) AS CountAll FROM VMojoodi WHERE COALESCE(Mojoodi,0)!=0`,
    `SELECT 1 AS StoreNum, '' AS StoreName, KalaNum AS StuffNum, COALESCE(KalaName,'') AS StuffName, COALESCE(KalaCode,'') AS StuffCode, COALESCE(CountAll,0) AS CountAll FROM VMojoodi WHERE COALESCE(CountAll,0)!=0`,
  ];
  let lastErr;
  for (const q of attempts) {
    try {
      const r = await p.request().query(q);
      console.log('[faradis] fetchInventory succeeded with:', q.slice(0, 80));
      return r.recordset;
    } catch(e) { lastErr = e; }
  }

  // Dynamic discovery: find tables that have StuffNum (or KalaNum) + a quantity column
  try {
    const discovery = await p.request().query(`
      SELECT DISTINCT t.TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES t
      JOIN INFORMATION_SCHEMA.COLUMNS c ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      WHERE t.TABLE_TYPE IN ('BASE TABLE','VIEW')
        AND (c.COLUMN_NAME = 'StuffNum' OR c.COLUMN_NAME = 'KalaNum')
        AND t.TABLE_NAME NOT IN ('Stuff','Kala','FactorRow','Factor','VCompany','StuffUnit')
      ORDER BY t.TABLE_NAME
    `);
    for (const row of discovery.recordset) {
      const tbl = row.TABLE_NAME;
      try {
        const cols = await p.request().query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION`
        );
        const colNames = cols.recordset.map(function(c) { return c.COLUMN_NAME; });
        const stuffCol = colNames.includes('StuffNum') ? 'StuffNum' : 'KalaNum';
        const qtyCol = ['CountAll','Count1','Qty','Mojoodi','RemainQty'].find(function(c) { return colNames.includes(c); });
        if (!qtyCol) continue;
        const numCol = ['StoreNum','AnbarNum','WareHouseNum'].find(function(c) { return colNames.includes(c); }) || '1';
        const selectNum = colNames.includes(numCol) ? `t.${numCol}` : '1';
        const r = await p.request().query(
          `SELECT ${selectNum} AS StoreNum, '' AS StoreName, t.${stuffCol} AS StuffNum, COALESCE(s.StuffName,'') AS StuffName, COALESCE(s.StuffCode,'') AS StuffCode, COALESCE(t.${qtyCol},0) AS CountAll FROM ${tbl} t LEFT JOIN Stuff s ON s.StuffNum=t.${stuffCol} WHERE COALESCE(t.${qtyCol},0)!=0`
        );
        console.log('[faradis] fetchInventory dynamic: found table', tbl, 'qtyCol', qtyCol);
        return r.recordset;
      } catch(e2) { /* try next */ }
    }
  } catch(discErr) {
    console.error('[faradis] fetchInventory discovery failed:', discErr.message);
  }

  console.error('[faradis] fetchInventory all attempts failed:', lastErr && lastErr.message);
  throw lastErr;
}

async function fetchFollowers() {
  const p = await getPool();
  const attempts = [
    // Car-prefix variants (confirmed naming convention in this Faradis installation)
    `SELECT MarketerNum AS FollowerNum, COALESCE(MarketerCode,'') AS FollowerCode, COALESCE(MarketerName,'') AS FollowerName FROM CarMarketer WHERE COALESCE(IsDelete,0)=0 ORDER BY MarketerNum`,
    `SELECT MarketerNum AS FollowerNum, COALESCE(MarketerCode,'') AS FollowerCode, COALESCE(MarketerName,'') AS FollowerName FROM CarMarketer ORDER BY MarketerNum`,
    `SELECT VisitorNum AS FollowerNum, COALESCE(VisitorCode,'') AS FollowerCode, COALESCE(VisitorName,'') AS FollowerName FROM CarVisitor WHERE COALESCE(IsDelete,0)=0 ORDER BY VisitorNum`,
    `SELECT VisitorNum AS FollowerNum, COALESCE(VisitorCode,'') AS FollowerCode, COALESCE(VisitorName,'') AS FollowerName FROM CarVisitor ORDER BY VisitorNum`,
    `SELECT FollowerNum, COALESCE(FollowerCode,'') AS FollowerCode, COALESCE(FollowerName,'') AS FollowerName FROM CarFollower WHERE COALESCE(IsDelete,0)=0 ORDER BY FollowerNum`,
    `SELECT FollowerNum, COALESCE(FollowerCode,'') AS FollowerCode, COALESCE(FollowerName,'') AS FollowerName FROM CarFollower ORDER BY FollowerNum`,
    `SELECT BazaryabNum AS FollowerNum, COALESCE(BazaryabCode,'') AS FollowerCode, COALESCE(BazaryabName,'') AS FollowerName FROM CarBazaryab WHERE COALESCE(IsDelete,0)=0 ORDER BY BazaryabNum`,
    `SELECT BazaryabNum AS FollowerNum, COALESCE(BazaryabCode,'') AS FollowerCode, COALESCE(BazaryabName,'') AS FollowerName FROM CarBazaryab ORDER BY BazaryabNum`,
    `SELECT PersonNum AS FollowerNum, COALESCE(PersonCode,'') AS FollowerCode, COALESCE(PersonName,'') AS FollowerName FROM CarPerson WHERE COALESCE(IsDelete,0)=0 ORDER BY PersonNum`,
    `SELECT PersonNum AS FollowerNum, COALESCE(PersonCode,'') AS FollowerCode, COALESCE(PersonName,'') AS FollowerName FROM CarPerson ORDER BY PersonNum`,
    // Follower table variants
    `SELECT FollowerNum, COALESCE(FollowerCode,'') AS FollowerCode, COALESCE(FollowerName,'') AS FollowerName FROM Follower WHERE COALESCE(IsDelete,0)=0 ORDER BY FollowerNum`,
    `SELECT FollowerNum, COALESCE(FollowerCode,'') AS FollowerCode, COALESCE(FollowerName,'') AS FollowerName FROM Follower ORDER BY FollowerNum`,
    // Marketer table variants
    `SELECT MarketerNum AS FollowerNum, COALESCE(MarketerCode,'') AS FollowerCode, COALESCE(MarketerName,'') AS FollowerName FROM Marketer WHERE COALESCE(IsDelete,0)=0 ORDER BY MarketerNum`,
    `SELECT MarketerNum AS FollowerNum, COALESCE(MarketerCode,'') AS FollowerCode, COALESCE(MarketerName,'') AS FollowerName FROM Marketer ORDER BY MarketerNum`,
    // Visitor table (ویزیتور)
    `SELECT VisitorNum AS FollowerNum, COALESCE(VisitorCode,'') AS FollowerCode, COALESCE(VisitorName,'') AS FollowerName FROM Visitor WHERE COALESCE(IsDelete,0)=0 ORDER BY VisitorNum`,
    `SELECT VisitorNum AS FollowerNum, COALESCE(VisitorCode,'') AS FollowerCode, COALESCE(VisitorName,'') AS FollowerName FROM Visitor ORDER BY VisitorNum`,
    // Bazaryab (بازاریاب)
    `SELECT BazaryabNum AS FollowerNum, COALESCE(BazaryabCode,'') AS FollowerCode, COALESCE(BazaryabName,'') AS FollowerName FROM Bazaryab WHERE COALESCE(IsDelete,0)=0 ORDER BY BazaryabNum`,
    `SELECT BazaryabNum AS FollowerNum, COALESCE(BazaryabCode,'') AS FollowerCode, COALESCE(BazaryabName,'') AS FollowerName FROM Bazaryab ORDER BY BazaryabNum`,
    // Person base table
    `SELECT PersonNum AS FollowerNum, COALESCE(PersonCode,'') AS FollowerCode, COALESCE(PersonName,'') AS FollowerName FROM Person WHERE COALESCE(IsDelete,0)=0 ORDER BY PersonNum`,
    `SELECT PersonNum AS FollowerNum, COALESCE(PersonCode,'') AS FollowerCode, COALESCE(PersonName,'') AS FollowerName FROM Person ORDER BY PersonNum`,
    // VFollower / VMarketer views
    `SELECT FollowerNum, COALESCE(FollowerCode,'') AS FollowerCode, COALESCE(FollowerName,'') AS FollowerName FROM VFollower ORDER BY FollowerNum`,
    `SELECT MarketerNum AS FollowerNum, COALESCE(MarketerCode,'') AS FollowerCode, COALESCE(MarketerName,'') AS FollowerName FROM VMarketer ORDER BY MarketerNum`,
    // Farsi-spelled common names
    `SELECT BazarYabNum AS FollowerNum, COALESCE(BazarYabCode,'') AS FollowerCode, COALESCE(BazarYabName,'') AS FollowerName FROM BazarYab ORDER BY BazarYabNum`,
    `SELECT AgentNum AS FollowerNum, COALESCE(AgentCode,'') AS FollowerCode, COALESCE(AgentName,'') AS FollowerName FROM Agent ORDER BY AgentNum`,
    `SELECT RepNum AS FollowerNum, COALESCE(RepCode,'') AS FollowerCode, COALESCE(RepName,'') AS FollowerName FROM Rep ORDER BY RepNum`,
    `SELECT SalesRepNum AS FollowerNum, COALESCE(SalesRepCode,'') AS FollowerCode, COALESCE(SalesRepName,'') AS FollowerName FROM SalesRep ORDER BY SalesRepNum`,
    `SELECT VNum AS FollowerNum, COALESCE(VCode,'') AS FollowerCode, COALESCE(VName,'') AS FollowerName FROM V ORDER BY VNum`,
  ];
  let lastErr;
  for (const q of attempts) {
    try {
      const r = await p.request().query(q);
      console.log('[faradis] fetchFollowers succeeded with:', q.slice(0, 80));
      return r.recordset;
    } catch(e) { lastErr = e; }
  }

  // Dynamic discovery: find tables that have a *Num and *Name column with marketer/follower semantics
  try {
    const discovery = await p.request().query(`
      SELECT DISTINCT t.TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES t
      JOIN INFORMATION_SCHEMA.COLUMNS c ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      WHERE t.TABLE_TYPE IN ('BASE TABLE','VIEW')
        AND (c.COLUMN_NAME LIKE '%FollowerNum%' OR c.COLUMN_NAME LIKE '%MarketerNum%'
          OR c.COLUMN_NAME LIKE '%VisitorNum%' OR c.COLUMN_NAME LIKE '%BazaryabNum%'
          OR c.COLUMN_NAME LIKE '%BazarYabNum%' OR c.COLUMN_NAME LIKE '%AgentNum%')
      ORDER BY t.TABLE_NAME
    `);
    for (const row of discovery.recordset) {
      const tbl = row.TABLE_NAME;
      try {
        const cols = await p.request().query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION`
        );
        const colNames = cols.recordset.map(function(c) { return c.COLUMN_NAME; });
        const numSuffixes = ['FollowerNum','MarketerNum','VisitorNum','BazaryabNum','BazarYabNum','AgentNum','PersonNum','RepNum','SalesRepNum'];
        const numCol = numSuffixes.find(function(s) { return colNames.includes(s); });
        if (!numCol) continue;
        const prefix = numCol.replace('Num','');
        const codeCol = colNames.includes(prefix + 'Code') ? prefix + 'Code' : null;
        const nameCol = colNames.includes(prefix + 'Name') ? prefix + 'Name' : null;
        if (!nameCol) continue;
        const selectCode = codeCol ? `COALESCE(${codeCol},'')` : "''";
        const r = await p.request().query(
          `SELECT ${numCol} AS FollowerNum, ${selectCode} AS FollowerCode, COALESCE(${nameCol},'') AS FollowerName FROM ${tbl} ORDER BY ${numCol}`
        );
        console.log('[faradis] fetchFollowers dynamic: found table', tbl, 'numCol', numCol);
        return r.recordset;
      } catch(e2) { /* try next discovered table */ }
    }
  } catch(discErr) {
    console.error('[faradis] fetchFollowers discovery failed:', discErr.message);
  }

  // Last resort: return distinct MarketerNum + VisitorNum from Factor table (no names)
  try {
    const r = await p.request().query(`
      SELECT DISTINCT COALESCE(MarketerNum,'') AS FollowerNum,
             '' AS FollowerCode,
             COALESCE(CAST(MarketerNum AS VARCHAR),'') AS FollowerName
      FROM Factor WHERE MarketerNum IS NOT NULL AND MarketerNum != ''
      ORDER BY FollowerNum
    `);
    console.log('[faradis] fetchFollowers fallback: using MarketerNum from Factor');
    return r.recordset;
  } catch(e) {}

  throw lastErr;
}

// برگشت از فروش (Sales Returns — FactorType=2)
async function fetchReturns(companyNum) {
  const p = await getPool();
  let q = `SELECT f.FactorNum, f.FactorDate, f.CompanyNum,
    COALESCE(vc.CompanyName,'') AS CompanyName,
    COALESCE(SUM(fr.TotalPrice),0) AS TotalAmount
    FROM Factor f
    LEFT JOIN FactorRow fr ON fr.FactorNum = f.FactorNum
    LEFT JOIN VCompany vc ON vc.CompanyNum = f.CompanyNum
    WHERE COALESCE(f.IsDelete,0)=0 AND f.FactorType=2`;
  const req = p.request();
  if (companyNum) { q += ' AND f.CompanyNum=@cn'; req.input('cn', sql.BigInt, companyNum); }
  q += ' GROUP BY f.FactorNum, f.FactorDate, f.CompanyNum, vc.CompanyName ORDER BY f.FactorDate DESC';
  const r = await req.query(q);
  return r.recordset;
}

// خریدها (Purchases — FactorType=3)
async function fetchPurchases(companyNum) {
  const p = await getPool();
  let q = `SELECT f.FactorNum, f.FactorDate, f.CompanyNum,
    COALESCE(vc.CompanyName,'') AS CompanyName,
    COALESCE(SUM(fr.TotalPrice),0) AS TotalAmount
    FROM Factor f
    LEFT JOIN FactorRow fr ON fr.FactorNum = f.FactorNum
    LEFT JOIN VCompany vc ON vc.CompanyNum = f.CompanyNum
    WHERE COALESCE(f.IsDelete,0)=0 AND f.FactorType=3`;
  const req = p.request();
  if (companyNum) { q += ' AND f.CompanyNum=@cn'; req.input('cn', sql.BigInt, companyNum); }
  q += ' GROUP BY f.FactorNum, f.FactorDate, f.CompanyNum, vc.CompanyName ORDER BY f.FactorDate DESC';
  const r = await req.query(q);
  return r.recordset;
}

// مطالبات — per customer balance: sales - returns - payments_received
async function fetchReceivablesSummary() {
  const p = await getPool();
  // Find payment receipts — try many possible table/column names
  let receiveMap = {};
  const receiveAttempts = [
    // Car-prefix variants (confirmed naming convention in this Faradis installation)
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarReceive WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarReceive GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarDariyaft WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarDariyaft GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarPayment WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CarCashIn WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    // Receive table with Amount
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Receive WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Receive GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(TotalAmount),0) AS TotalReceived FROM Receive WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    // Dariyaft (دریافت)
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Dariyaft WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Dariyaft GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(TotalAmount),0) AS TotalReceived FROM Dariyaft WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    // Receipt table
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Receipt WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Receipt GROUP BY CompanyNum`,
    // Payment
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Payment WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM Payment GROUP BY CompanyNum`,
    // VReceive view
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM VReceive GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM VDariyaft GROUP BY CompanyNum`,
    // CashIn / CashReceipt
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CashIn WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM CashReceipt WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    // Hesab (حساب)
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM HesabDariyaft WHERE COALESCE(IsDelete,0)=0 GROUP BY CompanyNum`,
    `SELECT CompanyNum, COALESCE(SUM(Amount),0) AS TotalReceived FROM HesabDariyaft GROUP BY CompanyNum`,
  ];
  let receiveFound = false;
  for (const rq of receiveAttempts) {
    try {
      const rv = await p.request().query(rq);
      rv.recordset.forEach(function(r) { receiveMap[r.CompanyNum] = Number(r.TotalReceived); });
      console.log('[faradis] fetchReceivablesSummary: payment query succeeded:', rq.slice(0, 60));
      receiveFound = true;
      break;
    } catch(e) { /* try next */ }
  }
  if (!receiveFound) {
    // Dynamic discovery: find any table with CompanyNum + Amount that looks like a payment table
    try {
      const disc = await p.request().query(`
        SELECT DISTINCT t.TABLE_NAME FROM INFORMATION_SCHEMA.TABLES t
        JOIN INFORMATION_SCHEMA.COLUMNS c1 ON c1.TABLE_NAME=t.TABLE_NAME AND c1.COLUMN_NAME='CompanyNum'
        JOIN INFORMATION_SCHEMA.COLUMNS c2 ON c2.TABLE_NAME=t.TABLE_NAME AND (c2.COLUMN_NAME='Amount' OR c2.COLUMN_NAME='TotalAmount')
        WHERE t.TABLE_TYPE IN ('BASE TABLE','VIEW')
          AND (t.TABLE_NAME LIKE '%eceiv%' OR t.TABLE_NAME LIKE '%ariy%' OR t.TABLE_NAME LIKE '%ayment%'
            OR t.TABLE_NAME LIKE '%ashin%' OR t.TABLE_NAME LIKE '%esab%')
        ORDER BY t.TABLE_NAME
      `);
      for (const trow of disc.recordset) {
        const tbl = trow.TABLE_NAME;
        try {
          const cols = await p.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tbl}'`);
          const colNames = cols.recordset.map(function(c) { return c.COLUMN_NAME; });
          const amtCol = colNames.includes('Amount') ? 'Amount' : 'TotalAmount';
          const delCol = colNames.includes('IsDelete') ? ' WHERE COALESCE(IsDelete,0)=0' : '';
          const rv = await p.request().query(`SELECT CompanyNum, COALESCE(SUM(${amtCol}),0) AS TotalReceived FROM ${tbl}${delCol} GROUP BY CompanyNum`);
          rv.recordset.forEach(function(r) { receiveMap[r.CompanyNum] = Number(r.TotalReceived); });
          console.log('[faradis] fetchReceivablesSummary dynamic: payment table', tbl);
          break;
        } catch(e2) {}
      }
    } catch(discErr) {
      console.error('[faradis] payment table discovery failed:', discErr.message);
    }
  }

  // Sales and returns per company
  const r = await p.request().query(`
    SELECT f.CompanyNum,
      COALESCE(vc.CompanyName,'') AS CompanyName,
      COALESCE(vc.CompanyCode,'') AS CompanyCode,
      SUM(CASE WHEN f.FactorType=1 THEN COALESCE(fr.TotalPrice,0) ELSE 0 END) AS TotalSales,
      SUM(CASE WHEN f.FactorType=2 THEN COALESCE(fr.TotalPrice,0) ELSE 0 END) AS TotalReturns
    FROM Factor f
    LEFT JOIN FactorRow fr ON fr.FactorNum = f.FactorNum
    LEFT JOIN VCompany vc ON vc.CompanyNum = f.CompanyNum
    WHERE COALESCE(f.IsDelete,0)=0 AND f.FactorType IN (1,2)
    GROUP BY f.CompanyNum, vc.CompanyName, vc.CompanyCode
  `);

  return r.recordset.map(row => {
    const received = receiveMap[row.CompanyNum] || 0;
    const balance = Number(row.TotalSales) - Number(row.TotalReturns) - received;
    return {
      company_num: row.CompanyNum,
      company_name: row.CompanyName,
      company_code: row.CompanyCode,
      total_sales: Number(row.TotalSales),
      total_returns: Number(row.TotalReturns),
      total_received: received,
      balance: balance,
    };
  }).filter(r => r.balance !== 0); // only non-zero balances
}

// Raw SQL query — for schema exploration and ad-hoc queries
async function rawQuery(sql) {
  const p = await getPool();
  const r = await p.request().query(sql);
  return r.recordset;
}

module.exports = {
  getPool, fetchSalesByMonth, fetchMarketerSummary, fetchSalesTrend,
  testConnection, isConfigured, fetchCustomers, fetchFactors,
  fetchStuffs, fetchFactorRows, fetchInventory, fetchFollowers,
  fetchReturns, fetchPurchases, fetchReceivablesSummary, rawQuery,
};

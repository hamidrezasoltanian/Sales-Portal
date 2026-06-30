'use strict';

const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const crypto = require('crypto');
const sql = require('mssql');
const { query } = require('./db');

const SQL_HOST = '192.168.4.4';
const SQL_INSTANCE = 'FARADISSOFT';
const SQL_USER = 'ma';
const SQL_PASS = 'adminS@2';
const SQL_DB = 'faradissoftatenazist';

const HASH_FILE = path.join(__dirname, '..', 'sync_hashes.json');
const INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

let localHashes = {};

// Load hashes from disk
function loadHashes() {
  try {
    if (fs.existsSync(HASH_FILE)) {
      localHashes = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8')) || {};
    }
  } catch (e) {
    console.log('[Sync] Hash file not found or corrupted, starting fresh.');
  }
}

// Save hashes to disk
function saveHashes() {
  try {
    fs.writeFileSync(HASH_FILE, JSON.stringify(localHashes, null, 2), 'utf8');
  } catch (e) {
    console.error('[Sync] Error saving hashes:', e.message);
  }
}

// Generate unique hash for a row object
function getRowHash(row) {
  // Normalize row keys and values to ensure consistent hash representation
  const normalized = {};
  Object.keys(row).sort().forEach(k => {
    let val = row[k];
    if (val instanceof Date) {
      val = val.toISOString();
    } else if (typeof val === 'string') {
      val = val.trim();
    }
    normalized[k] = val;
  });
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

// Resolve Dynamic TCP Port using SQL Server Browser (UDP 1434)
function resolveSqlPort() {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from([0x02]); // CLNT_UCAST_INST request
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
    }, 5000);
  });
}

// Generic sync helper
async function syncTable({ mssqlPool, type, mssqlQuery, pkColumns, pgUpsertQuery, pgUpsertParamsMapper, pgDeleteQuery, customPostUpsert }) {
  console.log(`[Sync] Syncing ${type}...`);
  
  // 1. Fetch from SQL Server
  const result = await mssqlPool.request().query(mssqlQuery);
  const rows = result.recordset || [];
  console.log(`[Sync] Read ${rows.length} records from SQL Server.`);

  const currentDbKeys = new Set();
  let inserted = 0;
  let updated = 0;

  // 2. Perform insertion / updates
  for (const row of rows) {
    // Check if row has valid primary keys
    const pkDict = {};
    let hasKeys = true;
    for (const col of pkColumns) {
      const val = row[col];
      if (val === undefined || val === null) {
        hasKeys = false;
        break;
      }
      pkDict[col] = typeof val === 'string' ? val.trim() : val;
    }
    if (!hasKeys) continue;

    const pkJson = JSON.stringify(pkDict);
    const uniqueId = `${type}:::${pkJson}`;
    currentDbKeys.add(uniqueId);

    const rowHash = getRowHash(row);
    const existingHash = localHashes[uniqueId];

    // If new or modified, update database and local registry
    if (!existingHash || existingHash !== rowHash) {
      const pgParams = pgUpsertParamsMapper(row);
      await query(pgUpsertQuery, pgParams);

      if (customPostUpsert) {
        await customPostUpsert(row);
      }

      if (!existingHash) inserted++;
      else updated++;

      localHashes[uniqueId] = rowHash;
    }
  }

  // 3. Garbage collect deleted rows
  let deleted = 0;
  const localKeysForType = Object.keys(localHashes).filter(k => k.startsWith(`${type}:::`));
  for (const localKey of localKeysForType) {
    if (!currentDbKeys.has(localKey)) {
      const pkJson = localKey.substring(type.length + 3);
      const pkDict = JSON.parse(pkJson);
      
      const pgDeleteParams = pkColumns.map(col => pkDict[col]);
      await query(pgDeleteQuery, pgDeleteParams);
      
      delete localHashes[localKey];
      deleted++;
    }
  }

  console.log(`[Sync] Completed ${type}: ${inserted} inserted, ${updated} updated, ${deleted} deleted.`);
}

async function runSyncCycle() {
  console.log(`\n[Sync] [${new Date().toLocaleTimeString()}] Starting database sync...`);
  
  // Resolve port
  let sqlPort = await resolveSqlPort();
  if (!sqlPort) {
    console.log('[Sync] SQL Server Browser did not respond. Falling back to port 50727.');
    sqlPort = 50727;
  } else {
    console.log(`[Sync] Resolved dynamic port: ${sqlPort}`);
  }

  const sqlConfig = {
    user: SQL_USER,
    password: SQL_PASS,
    server: SQL_HOST,
    database: SQL_DB,
    port: sqlPort,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    connectionTimeout: 15000,
    requestTimeout: 45000
  };

  let mssqlPool;
  try {
    mssqlPool = await sql.connect(sqlConfig);
    console.log('[Sync] Connected to SQL Server.');

    loadHashes();

    // 1. Stuffs
    await syncTable({
      mssqlPool,
      type: 'stuffs',
      mssqlQuery: `SELECT StuffNum, ParentNum, StuffName, StuffCode, TechnicalCode, IranCode, Barcode, Price, Active, SaveDate, EditDate, DeleteDate, IsDelete FROM Stuff`,
      pkColumns: ['StuffNum'],
      pgUpsertQuery: `
        INSERT INTO sync_stuffs (stuff_num, parent_num, stuff_name, stuff_code, technical_code, iran_code, barcode, price, active, is_delete, save_date, edit_date, delete_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (stuff_num) DO UPDATE SET
          parent_num=EXCLUDED.parent_num, stuff_name=EXCLUDED.stuff_name, stuff_code=EXCLUDED.stuff_code,
          technical_code=EXCLUDED.technical_code, iran_code=EXCLUDED.iran_code, barcode=EXCLUDED.barcode,
          price=EXCLUDED.price, active=EXCLUDED.active, is_delete=EXCLUDED.is_delete,
          save_date=EXCLUDED.save_date, edit_date=EXCLUDED.edit_date, delete_date=EXCLUDED.delete_date
      `,
      pgUpsertParamsMapper: (r) => [
        r.StuffNum, r.ParentNum || null, 
        r.StuffName ? String(r.StuffName).trim() : '', 
        r.StuffCode ? String(r.StuffCode).trim() : '', 
        r.TechnicalCode ? String(r.TechnicalCode).trim() : '', 
        r.IranCode ? String(r.IranCode).trim() : '', 
        r.Barcode ? String(r.Barcode).trim() : '',
        Math.round(parseFloat(r.Price || 0)), !!r.Active, !!r.IsDelete, r.SaveDate || null, r.EditDate || null, r.DeleteDate || null
      ],
      pgDeleteQuery: `DELETE FROM sync_stuffs WHERE stuff_num = $1`
    });

    // 2. Stores
    await syncTable({
      mssqlPool,
      type: 'stores',
      mssqlQuery: `SELECT StoreNum, StoreCode, StoreName, Status, SaveDate, IsDelete FROM Store`,
      pkColumns: ['StoreNum'],
      pgUpsertQuery: `
        INSERT INTO sync_stores (store_num, store_code, store_name, status, is_delete, save_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (store_num) DO UPDATE SET
          store_code=EXCLUDED.store_code, store_name=EXCLUDED.store_name,
          status=EXCLUDED.status, is_delete=EXCLUDED.is_delete, save_date=EXCLUDED.save_date
      `,
      pgUpsertParamsMapper: (r) => [
        r.StoreNum, 
        r.StoreCode ? String(r.StoreCode).trim() : '', 
        r.StoreName ? String(r.StoreName).trim() : '', 
        r.Status || 1, !!r.IsDelete, r.SaveDate || null
      ],
      pgDeleteQuery: `DELETE FROM sync_stores WHERE store_num = $1`
    });

    // 3. Store Stuffs
    await syncTable({
      mssqlPool,
      type: 'store_stuffs',
      mssqlQuery: `SELECT StoreStuffNum, StoreNum, StuffNum, AvailableCount, ReservedCount, IsDelete FROM StoreStuff`,
      pkColumns: ['StoreStuffNum'],
      pgUpsertQuery: `
        INSERT INTO sync_store_stuffs (store_stuff_num, store_num, stuff_num, available_count, reserved_count, is_delete)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (store_stuff_num) DO UPDATE SET
          available_count=EXCLUDED.available_count, reserved_count=EXCLUDED.reserved_count, is_delete=EXCLUDED.is_delete
      `,
      pgUpsertParamsMapper: (r) => [
        r.StoreStuffNum, r.StoreNum, r.StuffNum, 
        Math.round(parseFloat(r.AvailableCount || 0)), Math.round(parseFloat(r.ReservedCount || 0)), !!r.IsDelete
      ],
      pgDeleteQuery: `DELETE FROM sync_store_stuffs WHERE store_stuff_num = $1`
    });

    // 4. Stuff Price List
    await syncTable({
      mssqlPool,
      type: 'stuff_price_list',
      mssqlQuery: `
        SELECT 
          [id], 
          [نام شخص] AS person_name, 
          [نوع شخص] AS person_type, 
          [نوع] AS type, 
          [نام کالا] AS stuff_name, 
          [کد کالا] AS stuff_code, 
          [کدفنی] AS technical_code, 
          [قیمت کالا] AS price, 
          [موجودي کل] AS total_inventory, 
          [imed] AS price_imed, 
          [فرادیس] AS price_faradis, 
          [درمازون] AS price_dermazon, 
          [انبار مرکزی(واحد اصلی)] AS central_store, 
          [انبار مجازی(واحد اصلی)] AS virtual_store, 
          [انبار ضایعات(واحد اصلی)] AS scrap_store, 
          [انبار صبحیه(واحد اصلی)] AS sobhiyeh_store, 
          [انبار معتمدفر(واحد اصلی)] AS motamedfar_store 
        FROM StuffPriceList1
      `,
      pkColumns: ['id'],
      pgUpsertQuery: `
        INSERT INTO sync_stuff_price_list (id, person_name, person_type, type, stuff_name, stuff_code, technical_code, price, total_inventory, price_imed, price_faradis, price_dermazon, central_store, virtual_store, scrap_store, sobhiyeh_store, motamedfar_store)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          person_name=EXCLUDED.person_name, person_type=EXCLUDED.person_type, type=EXCLUDED.type, stuff_name=EXCLUDED.stuff_name,
          stuff_code=EXCLUDED.stuff_code, technical_code=EXCLUDED.technical_code, price=EXCLUDED.price, total_inventory=EXCLUDED.total_inventory,
          price_imed=EXCLUDED.price_imed, price_faradis=EXCLUDED.price_faradis, price_dermazon=EXCLUDED.price_dermazon,
          central_store=EXCLUDED.central_store, virtual_store=EXCLUDED.virtual_store, scrap_store=EXCLUDED.scrap_store,
          sobhiyeh_store=EXCLUDED.sobhiyeh_store, motamedfar_store=EXCLUDED.motamedfar_store
      `,
      pgUpsertParamsMapper: (r) => [
        r.id, 
        r.person_name ? String(r.person_name).trim() : '', 
        r.person_type ? String(r.person_type).trim() : '', 
        r.type ? String(r.type).trim() : '', 
        r.stuff_name ? String(r.stuff_name).trim() : '', 
        r.stuff_code ? String(r.stuff_code).trim() : '', 
        r.technical_code ? String(r.technical_code).trim() : '',
        Math.round(parseFloat(r.price || 0)), Math.round(parseFloat(r.total_inventory || 0)), 
        Math.round(parseFloat(r.price_imed || 0)), Math.round(parseFloat(r.price_faradis || 0)), Math.round(parseFloat(r.price_dermazon || 0)),
        Math.round(parseFloat(r.central_store || 0)), Math.round(parseFloat(r.virtual_store || 0)), Math.round(parseFloat(r.scrap_store || 0)), 
        Math.round(parseFloat(r.sobhiyeh_store || 0)), Math.round(parseFloat(r.motamedfar_store || 0))
      ],
      pgDeleteQuery: `DELETE FROM sync_stuff_price_list WHERE id = $1`
    });

    // 5. Customers
    await syncTable({
      mssqlPool,
      type: 'customers',
      mssqlQuery: `SELECT CompanyNum, CompanyName, CompanyCode, Saver, Phone1, Mobile1, StateName1, CityName1, Address1, PostCode1, TypeName FROM VCompany`,
      pkColumns: ['CompanyNum'],
      pgUpsertQuery: `
        INSERT INTO sync_customers (company_num, company_name, company_code, manager_name, phone, mobile, state, city, address, postal_code, type_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (company_num) DO UPDATE SET
          company_name=EXCLUDED.company_name, company_code=EXCLUDED.company_code, manager_name=EXCLUDED.manager_name,
          phone=EXCLUDED.phone, mobile=EXCLUDED.mobile, state=EXCLUDED.state, city=EXCLUDED.city,
          address=EXCLUDED.address, postal_code=EXCLUDED.postal_code, type_name=EXCLUDED.type_name
      `,
      pgUpsertParamsMapper: (r) => [
        r.CompanyNum, 
        r.CompanyName ? String(r.CompanyName).trim() : 'بدون نام', 
        r.CompanyCode ? String(r.CompanyCode).trim() : null, 
        r.Saver ? String(r.Saver).trim() : null,
        r.Phone1 ? String(r.Phone1).trim() : null, 
        r.Mobile1 ? String(r.Mobile1).trim() : null, 
        r.StateName1 ? String(r.StateName1).trim() : null, 
        r.CityName1 ? String(r.CityName1).trim() : null, 
        r.Address1 ? String(r.Address1).trim() : null, 
        r.PostCode1 ? String(r.PostCode1).trim() : null, 
        r.TypeName ? String(r.TypeName).trim() : null
      ],
      pgDeleteQuery: `DELETE FROM sync_customers WHERE company_num = $1`
    });

    // 6. Phones
    await syncTable({
      mssqlPool,
      type: 'phones',
      mssqlQuery: `SELECT Phone, Description, Type, RowNum, IsDefault, IsSms FROM Phone WHERE IsDelete = 0 AND (TblName = 'VCompany' OR TblName = 'Company')`,
      pkColumns: ['RowNum', 'Phone'],
      pgUpsertQuery: `
        INSERT INTO sync_customer_phones (company_num, phone_number, description, phone_type, is_default, is_sms)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (company_num, phone_number) DO UPDATE SET
          description=EXCLUDED.description, phone_type=EXCLUDED.phone_type,
          is_default=EXCLUDED.is_default, is_sms=EXCLUDED.is_sms
      `,
      pgUpsertParamsMapper: (r) => [
        r.RowNum, 
        r.Phone ? String(r.Phone).trim() : '', 
        r.Description ? String(r.Description).trim() : '', 
        r.Type !== undefined && r.Type !== null ? String(r.Type).trim() : '0', 
        !!r.IsDefault, !!r.IsSms
      ],
      customPostUpsert: async (r) => {
        if (!!r.IsDefault && r.Phone) {
          const cleanPhone = String(r.Phone).trim();
          const field = cleanPhone.startsWith('09') ? 'mobile' : 'phone';
          await query(`UPDATE sync_customers SET ${field} = $1 WHERE company_num = $2`, [cleanPhone, r.RowNum]);
        }
      },
      pgDeleteQuery: `DELETE FROM sync_customer_phones WHERE company_num = $1 AND phone_number = $2`
    });

    // 7. Addresses
    await syncTable({
      mssqlPool,
      type: 'addresses',
      mssqlQuery: `SELECT CompanyNum, CountryName, StateName, CityName, RegionName, Address, PostCode, IsDefault FROM CompanyRegion WHERE IsDelete = 0`,
      pkColumns: ['CompanyNum', 'Address'],
      pgUpsertQuery: `
        INSERT INTO sync_customer_addresses (company_num, country, state, city, region, address_text, postal_code, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (company_num, address_text) DO UPDATE SET
          country=EXCLUDED.country, state=EXCLUDED.state, city=EXCLUDED.city,
          region=EXCLUDED.region, postal_code=EXCLUDED.postal_code, is_default=EXCLUDED.is_default
      `,
      pgUpsertParamsMapper: (r) => [
        r.CompanyNum, 
        r.CountryName ? String(r.CountryName).trim() : '', 
        r.StateName ? String(r.StateName).trim() : '', 
        r.CityName ? String(r.CityName).trim() : '', 
        r.RegionName ? String(r.RegionName).trim() : '', 
        r.Address ? String(r.Address).trim() : '', 
        r.PostCode ? String(r.PostCode).trim() : '', 
        !!r.IsDefault
      ],
      customPostUpsert: async (r) => {
        if (!!r.IsDefault && r.Address) {
          await query(`
            UPDATE sync_customers
            SET state = $1, city = $2, address = $3, postal_code = $4
            WHERE company_num = $5
          `, [
            r.StateName ? String(r.StateName).trim() : '', 
            r.CityName ? String(r.CityName).trim() : '', 
            r.Address ? String(r.Address).trim() : '', 
            r.PostCode ? String(r.PostCode).trim() : '', 
            r.CompanyNum
          ]);
        }
      },
      pgDeleteQuery: `DELETE FROM sync_customer_addresses WHERE company_num = $1 AND address_text = $2`
    });

    // 8. Followers
    await syncTable({
      mssqlPool,
      type: 'followers',
      mssqlQuery: `SELECT cu.CompanyNum, cu.UserName, u.Name AS FullName FROM CompanyUsers cu INNER JOIN Users u ON cu.UserName = u.UserName`,
      pkColumns: ['CompanyNum', 'UserName'],
      pgUpsertQuery: `
        INSERT INTO sync_customer_followers (company_num, username, full_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (company_num, username) DO UPDATE SET full_name=EXCLUDED.full_name
      `,
      pgUpsertParamsMapper: (r) => [
        r.CompanyNum, 
        r.UserName ? String(r.UserName).trim() : '', 
        r.FullName ? String(r.FullName).trim() : ''
      ],
      pgDeleteQuery: `DELETE FROM sync_customer_followers WHERE company_num = $1 AND username = $2`
    });

    // 9. Factors (Invoices & Proformas)

    await syncTable({
      mssqlPool,
      type: 'factors',
      mssqlQuery: `
        SELECT 
          FactorNum, ParentFactorNum, FactorCode, FactorName, FactorDate, 
          IsConfirm, StatusNum, CancelNum, Description, CompanyNum, 
          FactorType, Price, IsDelete, SaveDate, Editdate, ExpireDate, 
          DeliveryDate, DeliveryAddress, DeliveryPhone, DeliveryPostalCode, 
          SumPaid, SumPaidWithoutCheque, MarketerNum, VisitorNum 
        FROM Factor
      `,
      pkColumns: ['FactorNum'],
      pgUpsertQuery: `
        INSERT INTO sync_factors (
          factor_num, parent_factor_num, factor_code, factor_name, factor_date, 
          is_confirm, status_num, cancel_num, description, company_num, 
          factor_type, price, is_delete, save_date, edit_date, expire_date, 
          delivery_date, delivery_address, delivery_phone, delivery_postal_code, 
          sum_paid, sum_paid_without_cheque, marketer_num, visitor_num
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 
          $21, $22, $23, $24
        ) ON CONFLICT (factor_num) DO UPDATE SET
          parent_factor_num=EXCLUDED.parent_factor_num,
          factor_code=EXCLUDED.factor_code,
          factor_name=EXCLUDED.factor_name,
          factor_date=EXCLUDED.factor_date,
          is_confirm=EXCLUDED.is_confirm,
          status_num=EXCLUDED.status_num,
          cancel_num=EXCLUDED.cancel_num,
          description=EXCLUDED.description,
          company_num=EXCLUDED.company_num,
          factor_type=EXCLUDED.factor_type,
          price=EXCLUDED.price,
          is_delete=EXCLUDED.is_delete,
          save_date=EXCLUDED.save_date,
          edit_date=EXCLUDED.edit_date,
          expire_date=EXCLUDED.expire_date,
          delivery_date=EXCLUDED.delivery_date,
          delivery_address=EXCLUDED.delivery_address,
          delivery_phone=EXCLUDED.delivery_phone,
          delivery_postal_code=EXCLUDED.delivery_postal_code,
          sum_paid=EXCLUDED.sum_paid,
          sum_paid_without_cheque=EXCLUDED.sum_paid_without_cheque,
          marketer_num=EXCLUDED.marketer_num,
          visitor_num=EXCLUDED.visitor_num
      `,
      pgUpsertParamsMapper: (r) => [
        r.FactorNum,
        r.ParentFactorNum || null,
        r.FactorCode ? String(r.FactorCode).trim() : null,
        r.FactorName ? String(r.FactorName).trim() : null,
        r.FactorDate || null,
        !!r.IsConfirm,
        r.StatusNum !== undefined && r.StatusNum !== null ? parseInt(r.StatusNum, 10) : null,
        r.CancelNum !== undefined && r.CancelNum !== null ? parseInt(r.CancelNum, 10) : null,
        r.Description ? String(r.Description).trim() : null,
        r.CompanyNum !== undefined && r.CompanyNum !== null && !isNaN(parseInt(r.CompanyNum, 10)) ? parseInt(r.CompanyNum, 10) : null,
        r.FactorType !== undefined && r.FactorType !== null ? parseInt(r.FactorType, 10) : null,
        r.Price !== undefined && r.Price !== null ? Math.round(parseFloat(r.Price)) : 0,
        !!r.IsDelete,
        r.SaveDate || null,
        r.Editdate || null,
        r.ExpireDate || null,
        r.DeliveryDate || null,
        r.DeliveryAddress ? String(r.DeliveryAddress).trim() : null,
        r.DeliveryPhone ? String(r.DeliveryPhone).trim() : null,
        r.DeliveryPostalCode ? String(r.DeliveryPostalCode).trim() : null,
        r.SumPaid !== undefined && r.SumPaid !== null ? Math.round(parseFloat(r.SumPaid)) : 0,
        r.SumPaidWithoutCheque !== undefined && r.SumPaidWithoutCheque !== null ? Math.round(parseFloat(r.SumPaidWithoutCheque)) : 0,
        r.MarketerNum ? String(r.MarketerNum).trim() : null,
        r.VisitorNum ? String(r.VisitorNum).trim() : null
      ],
      pgDeleteQuery: `DELETE FROM sync_factors WHERE factor_num = $1`
    });

    // 10. Factor Rows (Invoice Details)
    await syncTable({
      mssqlPool,
      type: 'factor_rows',
      mssqlQuery: `
        SELECT 
          FactorRowNum, FactorNum, StoreStuffNum, StuffNum, Price, 
          Count1, Count2, Description, TotalPrice, IsDelete, 
          SaveDate, EditDate 
        FROM FactorRow
      `,
      pkColumns: ['FactorRowNum'],
      pgUpsertQuery: `
        INSERT INTO sync_factor_rows (
          factor_row_num, factor_num, store_stuff_num, stuff_num, price, 
          count1, count2, description, total_price, is_delete, 
          save_date, edit_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) ON CONFLICT (factor_row_num) DO UPDATE SET
          factor_num=EXCLUDED.factor_num,
          store_stuff_num=EXCLUDED.store_stuff_num,
          stuff_num=EXCLUDED.stuff_num,
          price=EXCLUDED.price,
          count1=EXCLUDED.count1,
          count2=EXCLUDED.count2,
          description=EXCLUDED.description,
          total_price=EXCLUDED.total_price,
          is_delete=EXCLUDED.is_delete,
          save_date=EXCLUDED.save_date,
          edit_date=EXCLUDED.edit_date
      `,
      pgUpsertParamsMapper: (r) => [
        r.FactorRowNum,
        r.FactorNum,
        r.StoreStuffNum !== undefined && r.StoreStuffNum !== null ? parseInt(r.StoreStuffNum, 10) : null,
        r.StuffNum !== undefined && r.StuffNum !== null ? parseInt(r.StuffNum, 10) : null,
        r.Price !== undefined && r.Price !== null ? Math.round(parseFloat(r.Price)) : 0,
        r.Count1 !== undefined && r.Count1 !== null ? parseFloat(r.Count1) : 0,
        r.Count2 !== undefined && r.Count2 !== null ? parseFloat(r.Count2) : 0,
        r.Description ? String(r.Description).trim() : null,
        r.TotalPrice !== undefined && r.TotalPrice !== null ? Math.round(parseFloat(r.TotalPrice)) : 0,
        !!r.IsDelete,
        r.SaveDate || null,
        r.EditDate || null
      ],
      pgDeleteQuery: `DELETE FROM sync_factor_rows WHERE factor_row_num = $1`
    });


    saveHashes();
    console.log(`[Sync] Cycle finished successfully.`);

  } catch (err) {
    console.error('[Sync] Fatal error during sync cycle:', err.message);
  } finally {
    if (mssqlPool) {
      try {
        await mssqlPool.close();
      } catch (e) {}
    }
  }
}

// Start continuous looping
loadHashes();
runSyncCycle();
setInterval(runSyncCycle, INTERVAL_MS);
console.log(`[Sync] Atena Sync Service started. Sync interval: every ${INTERVAL_MS / 1000} seconds.`);

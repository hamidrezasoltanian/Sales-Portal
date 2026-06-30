'use strict';

const express = require('express');
const { query } = require('../db');
const router = express.Router();

const API_SECRET = "YourStrongSecretKey2026";

// میدلور بررسی کلید API
router.use((req, res, next) => {
  const sentKey = req.headers['x-api-key'] || req.body.api_key || req.query.api_key;
  if (sentKey !== API_SECRET) {
    return res.status(403).json({ status: 'error', message: 'Invalid API Key' });
  }
  next();
});

// پذیرش داده‌ها
router.post('/receiver', async (req, res) => {
  const type = req.query.type || 'customers';
  const action = req.query.action || 'sync';
  const data = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ status: 'error', message: 'No valid data received' });
  }

  try {
    let count = 0;

    if (action === 'sync') {
      if (type === 'stuffs') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_stuffs (stuff_num, parent_num, stuff_name, stuff_code, technical_code, iran_code, barcode, price, active, is_delete, save_date, edit_date, delete_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (stuff_num) DO UPDATE SET
              parent_num=EXCLUDED.parent_num, stuff_name=EXCLUDED.stuff_name, stuff_code=EXCLUDED.stuff_code,
              technical_code=EXCLUDED.technical_code, iran_code=EXCLUDED.iran_code, barcode=EXCLUDED.barcode,
              price=EXCLUDED.price, active=EXCLUDED.active, is_delete=EXCLUDED.is_delete,
              save_date=EXCLUDED.save_date, edit_date=EXCLUDED.edit_date, delete_date=EXCLUDED.delete_date
          `, [
            r.StuffNum, r.ParentNum || null, r.StuffName || '', r.StuffCode || '', r.TechnicalCode || '', r.IranCode || '', r.Barcode || '',
            r.Price || 0, !!r.Active, !!r.IsDelete, r.SaveDate || null, r.EditDate || null, r.DeleteDate || null
          ]);
          count++;
        }
      }
      else if (type === 'stores') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_stores (store_num, store_code, store_name, status, is_delete, save_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (store_num) DO UPDATE SET
              store_code=EXCLUDED.store_code, store_name=EXCLUDED.store_name,
              status=EXCLUDED.status, is_delete=EXCLUDED.is_delete, save_date=EXCLUDED.save_date
          `, [r.StoreNum, r.StoreCode || '', r.StoreName || '', r.Status || 1, !!r.IsDelete, r.SaveDate || null]);
          count++;
        }
      }
      else if (type === 'store_stuffs') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_store_stuffs (store_stuff_num, store_num, stuff_num, available_count, reserved_count, is_delete)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (store_stuff_num) DO UPDATE SET
              available_count=EXCLUDED.available_count, reserved_count=EXCLUDED.reserved_count, is_delete=EXCLUDED.is_delete
          `, [r.StoreStuffNum, r.StoreNum, r.StuffNum, r.AvailableCount || 0, r.ReservedCount || 0, !!r.IsDelete]);
          count++;
        }
      }
      else if (type === 'stuff_price_list') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_stuff_price_list (id, person_name, person_type, type, stuff_name, stuff_code, technical_code, price, total_inventory, price_imed, price_faradis, price_dermazon, central_store, virtual_store, scrap_store, sobhiyeh_store, motamedfar_store)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              person_name=EXCLUDED.person_name, person_type=EXCLUDED.person_type, type=EXCLUDED.type, stuff_name=EXCLUDED.stuff_name,
              stuff_code=EXCLUDED.stuff_code, technical_code=EXCLUDED.technical_code, price=EXCLUDED.price, total_inventory=EXCLUDED.total_inventory,
              price_imed=EXCLUDED.price_imed, price_faradis=EXCLUDED.price_faradis, price_dermazon=EXCLUDED.price_dermazon,
              central_store=EXCLUDED.central_store, virtual_store=EXCLUDED.virtual_store, scrap_store=EXCLUDED.scrap_store,
              sobhiyeh_store=EXCLUDED.sobhiyeh_store, motamedfar_store=EXCLUDED.motamedfar_store
          `, [
            r.id, r.person_name || '', r.person_type || '', r.type || '', r.stuff_name || '', r.stuff_code || '', r.technical_code || '',
            r.price || 0, r.total_inventory || 0, r.price_imed || 0, r.price_faradis || 0, r.price_dermazon || 0,
            r.central_store || 0, r.virtual_store || 0, r.scrap_store || 0, r.sobhiyeh_store || 0, r.motamedfar_store || 0
          ]);
          count++;
        }
      }
      else if (type === 'customers') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_customers (company_num, company_name, company_code, manager_name, phone, mobile, state, city, address, postal_code, type_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (company_num) DO UPDATE SET
              company_name=EXCLUDED.company_name, company_code=EXCLUDED.company_code, manager_name=EXCLUDED.manager_name,
              phone=EXCLUDED.phone, mobile=EXCLUDED.mobile, state=EXCLUDED.state, city=EXCLUDED.city,
              address=EXCLUDED.address, postal_code=EXCLUDED.postal_code, type_name=EXCLUDED.type_name
          `, [
            r.CompanyNum, r.CompanyName || 'بدون نام', r.CompanyCode || null, r.Saver ? r.Saver.trim() : null,
            r.Phone1 || null, r.Mobile1 || null, r.StateName1 || null, r.CityName1 || null, r.Address1 || null, r.PostCode1 || null, r.TypeName || null
          ]);
          count++;
        }
      }
      else if (type === 'phones') {
        for (const r of data) {
          if (!r.RowNum || !r.Phone) continue;
          await query(`
            INSERT INTO sync_customer_phones (company_num, phone_number, description, phone_type, is_default, is_sms)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (company_num, phone_number) DO UPDATE SET
              description=EXCLUDED.description, phone_type=EXCLUDED.phone_type,
              is_default=EXCLUDED.is_default, is_sms=EXCLUDED.is_sms
          `, [r.RowNum, r.Phone.trim(), r.Description || '', r.Type || '0', !!r.IsDefault, !!r.IsSms]);
          
          if (!!r.IsDefault) {
            const field = r.Phone.trim().startsWith('09') ? 'mobile' : 'phone';
            await query(`UPDATE sync_customers SET ${field} = $1 WHERE company_num = $2`, [r.Phone.trim(), r.RowNum]);
          }
          count++;
        }
      }
      else if (type === 'addresses') {
        for (const r of data) {
          if (!r.CompanyNum || !r.Address) continue;
          await query(`
            INSERT INTO sync_customer_addresses (company_num, country, state, city, region, address_text, postal_code, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (company_num, address_text) DO UPDATE SET
              country=EXCLUDED.country, state=EXCLUDED.state, city=EXCLUDED.city,
              region=EXCLUDED.region, postal_code=EXCLUDED.postal_code, is_default=EXCLUDED.is_default
          `, [r.CompanyNum, r.CountryName || '', r.StateName || '', r.CityName || '', r.RegionName || '', r.Address.trim(), r.PostCode || '', !!r.IsDefault]);
          
          if (!!r.IsDefault) {
            await query(`
              UPDATE sync_customers
              SET state = $1, city = $2, address = $3, postal_code = $4
              WHERE company_num = $5
            `, [r.StateName || '', r.CityName || '', r.Address.trim(), r.PostCode || '', r.CompanyNum]);
          }
          count++;
        }
      }
      else if (type === 'followers') {
        for (const r of data) {
          if (!r.CompanyNum || !r.UserName) continue;
          await query(`
            INSERT INTO sync_customer_followers (company_num, username, full_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (company_num, username) DO UPDATE SET full_name=EXCLUDED.full_name
          `, [r.CompanyNum, r.UserName.trim(), r.FullName || '']);
          count++;
        }
      }
      else if (type === 'factors') {
        for (const r of data) {
          await query(`
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
              parent_factor_num=EXCLUDED.parent_factor_num, factor_code=EXCLUDED.factor_code,
              factor_name=EXCLUDED.factor_name, factor_date=EXCLUDED.factor_date,
              is_confirm=EXCLUDED.is_confirm, status_num=EXCLUDED.status_num,
              cancel_num=EXCLUDED.cancel_num, description=EXCLUDED.description,
              company_num=EXCLUDED.company_num, factor_type=EXCLUDED.factor_type,
              price=EXCLUDED.price, is_delete=EXCLUDED.is_delete,
              save_date=EXCLUDED.save_date, edit_date=EXCLUDED.edit_date,
              expire_date=EXCLUDED.expire_date, delivery_date=EXCLUDED.delivery_date,
              delivery_address=EXCLUDED.delivery_address, delivery_phone=EXCLUDED.delivery_phone,
              delivery_postal_code=EXCLUDED.delivery_postal_code, sum_paid=EXCLUDED.sum_paid,
              sum_paid_without_cheque=EXCLUDED.sum_paid_without_cheque, marketer_num=EXCLUDED.marketer_num,
              visitor_num=EXCLUDED.visitor_num
          `, [
            r.FactorNum, r.ParentFactorNum || null, r.FactorCode || null, r.FactorName || null, r.FactorDate || null,
            !!r.IsConfirm, r.StatusNum || null, r.CancelNum || null, r.Description || null, r.CompanyNum || null,
            r.FactorType || null, r.Price || 0, !!r.IsDelete, r.SaveDate || null, r.Editdate || null, r.ExpireDate || null,
            r.DeliveryDate || null, r.DeliveryAddress || null, r.DeliveryPhone || null, r.DeliveryPostalCode || null,
            r.SumPaid || 0, r.SumPaidWithoutCheque || 0, r.MarketerNum || null, r.VisitorNum || null
          ]);
          count++;
        }
      }
      else if (type === 'factor_rows') {
        for (const r of data) {
          await query(`
            INSERT INTO sync_factor_rows (
              factor_row_num, factor_num, store_stuff_num, stuff_num, price, 
              count1, count2, description, total_price, is_delete, 
              save_date, edit_date
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            ) ON CONFLICT (factor_row_num) DO UPDATE SET
              factor_num=EXCLUDED.factor_num, store_stuff_num=EXCLUDED.store_stuff_num,
              stuff_num=EXCLUDED.stuff_num, price=EXCLUDED.price,
              count1=EXCLUDED.count1, count2=EXCLUDED.count2,
              description=EXCLUDED.description, total_price=EXCLUDED.total_price,
              is_delete=EXCLUDED.is_delete, save_date=EXCLUDED.save_date,
              edit_date=EXCLUDED.edit_date
          `, [
            r.FactorRowNum, r.FactorNum, r.StoreStuffNum || null, r.StuffNum || null, r.Price || 0,
            r.Count1 || 0, r.Count2 || 0, r.Description || null, r.TotalPrice || 0, !!r.IsDelete,
            r.SaveDate || null, r.EditDate || null
          ]);
          count++;
        }
      }
    }
    else if (action === 'delete') {
      if (type === 'followers') {
        for (const r of data) {
          if (r.CompanyNum && r.UserName) {
            await query('DELETE FROM sync_customer_followers WHERE company_num = $1 AND username = $2', [r.CompanyNum, r.UserName]);
            count++;
          }
        }
      }
      else if (type === 'phones') {
        for (const r of data) {
          if (r.RowNum && r.Phone) {
            await query('DELETE FROM sync_customer_phones WHERE company_num = $1 AND phone_number = $2', [r.RowNum, r.Phone]);
            count++;
          }
        }
      }
      else if (type === 'addresses') {
        for (const r of data) {
          if (r.CompanyNum && r.Address) {
            await query('DELETE FROM sync_customer_addresses WHERE company_num = $1 AND address_text = $2', [r.CompanyNum, r.Address]);
            count++;
          }
        }
      }
      else {
        let pkCol = 'company_num', tbl = 'sync_customers';
        if (type === 'stuffs') { pkCol = 'stuff_num'; tbl = 'sync_stuffs'; }
        else if (type === 'stores') { pkCol = 'store_num'; tbl = 'sync_stores'; }
        else if (type === 'store_stuffs') { pkCol = 'store_stuff_num'; tbl = 'sync_store_stuffs'; }
        else if (type === 'stuff_price_list') { pkCol = 'id'; tbl = 'sync_stuff_price_list'; }
        else if (type === 'factors') { pkCol = 'factor_num'; tbl = 'sync_factors'; }
        else if (type === 'factor_rows') { pkCol = 'factor_row_num'; tbl = 'sync_factor_rows'; }

        for (const r of data) {
          const key = Object.values(r)[0];
          if (key) {
            await query(`DELETE FROM ${tbl} WHERE ${pkCol} = $1`, [key]);
            count++;
          }
        }
      }
    }
    else if (action === 'garbage_collect') {
      if (!['followers', 'phones', 'addresses'].includes(type)) {
        let pkCol = 'company_num', tbl = 'sync_customers';
        if (type === 'stuffs') { pkCol = 'stuff_num'; tbl = 'sync_stuffs'; }
        else if (type === 'stores') { pkCol = 'store_num'; tbl = 'sync_stores'; }
        else if (type === 'store_stuffs') { pkCol = 'store_stuff_num'; tbl = 'sync_store_stuffs'; }
        else if (type === 'stuff_price_list') { pkCol = 'id'; tbl = 'sync_stuff_price_list'; }
        else if (type === 'factors') { pkCol = 'factor_num'; tbl = 'sync_factors'; }
        else if (type === 'factor_rows') { pkCol = 'factor_row_num'; tbl = 'sync_factor_rows'; }

        const validKeys = data.map(r => Object.values(r)[0]).filter(Boolean);
        if (validKeys.length > 0) {
          // دریافت کلیدهای موجود در دیتابیس فعلی
          const dbRows = await query(`SELECT ${pkCol} FROM ${tbl}`);
          const deleteKeys = dbRows.rows
            .map(row => row[pkCol])
            .filter(key => !validKeys.includes(key));
          
          if (deleteKeys.length > 0) {
            for (const key of deleteKeys) {
              await query(`DELETE FROM ${tbl} WHERE ${pkCol} = $1`, [key]);
              count++;
            }
          }
        }
      }
    }

    res.json({ status: 'success', message: `Processed ${count} records for type: ${type} (Action: ${action})` });
  } catch (e) {
    console.error('[sync_receiver error]', e.message);
    res.status(500).json({ status: 'error', message: 'DB Error: ' + e.message });
  }
});

module.exports = router;

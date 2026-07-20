'use strict';

const { query } = require('../db');

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function numOr(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

async function getActiveContract(employee) {
  if (!employee) return null;
  const r = await query(
    `SELECT * FROM employee_contracts
     WHERE employee = $1 AND active = TRUE
     ORDER BY created_at DESC LIMIT 1`,
    [employee]
  );
  return r.rows[0] || null;
}

async function upsertEmployeeContract(employee, data, createdBy) {
  if (!employee) throw new Error('کارمند الزامی است');

  const prev = await getActiveContract(employee);
  const uPrev = await query(
    'SELECT salary_amount, commission_pct FROM app_users WHERE username = $1',
    [employee]
  ).catch(function () { return { rows: [] }; });
  const appPrev = uPrev.rows[0] || {};

  const insurable = numOr(
    data.salary_insurable,
    prev ? parseFloat(prev.salary_insurable) || 0 : parseFloat(appPrev.salary_amount) || 0
  );
  const nonInsurable = numOr(
    data.salary_non_insurable,
    prev ? parseFloat(prev.salary_non_insurable) || 0 : 0
  );
  const baseSalary = insurable + nonInsurable;
  const commissionPct = numOr(
    data.commission_pct,
    prev ? parseFloat(prev.commission_pct) || 0 : parseFloat(appPrev.commission_pct) || 0
  );
  const salesTarget = numOr(
    data.sales_target,
    prev ? parseFloat(prev.sales_target) || 0 : 0
  );

  await query('UPDATE employee_contracts SET active = FALSE WHERE employee = $1', [employee]);

  const id = uid('ec_');
  const r = await query(
    `INSERT INTO employee_contracts (
      id, employee, base_salary, salary_insurable, salary_non_insurable,
      housing_allowance, grocery_allowance, child_allowance,
      commission_pct, sales_target, start_date, end_date, notes, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id, employee, baseSalary, insurable, nonInsurable,
      numOr(data.housing_allowance, prev ? parseFloat(prev.housing_allowance) || 0 : 0),
      numOr(data.grocery_allowance, prev ? parseFloat(prev.grocery_allowance) || 0 : 0),
      numOr(data.child_allowance, prev ? parseFloat(prev.child_allowance) || 0 : 0),
      commissionPct,
      salesTarget,
      data.start_date != null && data.start_date !== ''
        ? data.start_date
        : (prev ? prev.start_date : null),
      data.end_date != null && data.end_date !== ''
        ? data.end_date
        : (prev ? prev.end_date : null),
      data.contract_notes || data.notes || (prev ? prev.notes : null),
      createdBy || null,
    ]
  );

  // Keep app_users in sync — Faradis/reports read commission_pct from here
  await query(
    `UPDATE app_users SET
       commission_pct = $2,
       salary_amount = CASE WHEN $3 > 0 THEN $3 ELSE salary_amount END
     WHERE username = $1`,
    [employee, commissionPct, insurable]
  ).catch(function () {});

  return r.rows[0];
}

module.exports = { getActiveContract, upsertEmployeeContract };

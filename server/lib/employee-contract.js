'use strict';

const { query } = require('../db');

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
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
  const insurable = parseFloat(data.salary_insurable) || 0;
  const nonInsurable = parseFloat(data.salary_non_insurable) || 0;
  const baseSalary = insurable + nonInsurable;

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
      parseFloat(data.housing_allowance) || 0,
      parseFloat(data.grocery_allowance) || 0,
      parseFloat(data.child_allowance) || 0,
      parseFloat(data.commission_pct) || 0,
      parseFloat(data.sales_target) || 0,
      data.start_date || null,
      data.end_date || null,
      data.contract_notes || data.notes || null,
      createdBy || null,
    ]
  );

  if (insurable > 0 || nonInsurable > 0) {
    await query(
      'UPDATE app_users SET salary_amount = $2 WHERE username = $1',
      [employee, insurable]
    ).catch(function () {});
  }
  if (data.commission_pct != null && data.commission_pct !== '') {
    await query(
      'UPDATE app_users SET commission_pct = $2 WHERE username = $1',
      [employee, parseFloat(data.commission_pct) || 0]
    ).catch(function () {});
  }

  return r.rows[0];
}

module.exports = { getActiveContract, upsertEmployeeContract };

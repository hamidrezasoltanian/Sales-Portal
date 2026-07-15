'use strict';

const { query } = require('../db');

const FALLBACK_BRACKETS = [
  { upTo: 240000000, rate: 0 },
  { upTo: 600000000, rate: 0.10 },
  { upTo: 1200000000, rate: 0.15 },
  { upTo: Infinity, rate: 0.20 },
];

async function loadDeductionSettings() {
  const r = await query("SELECT * FROM hr_settings WHERE id = 'default'");
  const s = r.rows[0] || {};
  return {
    insuranceEmployeePct: Number(s.insurance_employee_pct) || 7,
    insuranceEmployerPct: Number(s.insurance_employer_pct) || 23,
    taxExemptAmount: Number(s.tax_exempt_amount) || 0,
  };
}

async function loadTaxBrackets(jalaliYear) {
  const year = String(jalaliYear || '').slice(0, 4);
  try {
    const r = await query(
      `SELECT up_to_amount, rate_pct FROM tax_brackets
       WHERE tax_year = $1 ORDER BY bracket_order ASC`,
      [year]
    );
    if (r.rows.length) {
      return r.rows.map(function (row, i, arr) {
        const upTo = parseFloat(row.up_to_amount);
        return {
          upTo: i === arr.length - 1 ? Infinity : upTo,
          rate: parseFloat(row.rate_pct) / 100,
        };
      });
    }
  } catch (_) {}
  return FALLBACK_BRACKETS;
}

function calcProgressiveTaxWithBrackets(taxable, brackets) {
  const t = Math.max(0, taxable);
  if (t <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    const cap = b.upTo === Infinity ? t : Math.min(t, b.upTo);
    const slice = cap - prev;
    if (slice > 0) tax += slice * b.rate;
    prev = b.upTo;
    if (t <= b.upTo) break;
  }
  return Math.round(tax);
}

function calcProgressiveTax(taxable) {
  return calcProgressiveTaxWithBrackets(taxable, FALLBACK_BRACKETS);
}

function calcLegalDeductions(grossPay, settings) {
  const gross = Math.max(0, Number(grossPay) || 0);
  const insPct = (settings && settings.insuranceEmployeePct) || 7;
  const exempt = (settings && settings.taxExemptAmount) || 0;
  const insurance = Math.round(gross * insPct / 100);
  const taxable = Math.max(0, gross - insurance - exempt);
  const tax = calcProgressiveTax(taxable);
  const totalDeductions = insurance + tax;
  const netPay = Math.max(0, gross - totalDeductions);
  return {
    gross_pay: gross,
    insurance,
    tax,
    total_deductions: totalDeductions,
    net_pay: netPay,
  };
}

function adjustTargetForLeave(baseTarget, workingDaysInMonth, leaveDays) {
  const base = Number(baseTarget) || 0;
  const wd = Number(workingDaysInMonth) || 26;
  const ld = Number(leaveDays) || 0;
  if (base <= 0 || ld <= 0 || wd <= 0) return base;
  const factor = Math.max(0, (wd - ld) / wd);
  return Math.round(base * factor);
}

module.exports = {
  loadDeductionSettings,
  loadTaxBrackets,
  calcLegalDeductions,
  calcProgressiveTax,
  calcProgressiveTaxWithBrackets,
  adjustTargetForLeave,
  FALLBACK_BRACKETS,
};

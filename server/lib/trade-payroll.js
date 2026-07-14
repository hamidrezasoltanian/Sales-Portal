'use strict';

const { query } = require('../db');

const TRADE_ROLES = ['بازرگانی', 'کارشناس بازرگانی'];

function isTradeEmployee(user) {
  if (!user) return false;
  return TRADE_ROLES.includes(user.role) || user.department === 'بازرگانی';
}

function calcTradeHygieneBonus(baseSalary, finalScore, kpiThreshold) {
  const base = parseFloat(baseSalary) || 0;
  const score = parseFloat(finalScore) || 0;
  const threshold = parseFloat(kpiThreshold) || 80;
  if (!base || score < threshold) return 0;
  const span = Math.max(1, 100 - threshold);
  const factor = 0.05 + ((Math.min(score, 100) - threshold) / span) * 0.15;
  return Math.round(base * factor);
}

async function getCommissionSettings() {
  const r = await query(`SELECT * FROM commission_settings WHERE id='default'`);
  return r.rows[0] || { kpi_threshold: 80, kpi_multiplier: 2.0 };
}

async function getMilestoneBonusForMonth(employee, month) {
  const r = await query(
    `SELECT COALESCE(SUM(bonus_amount), 0) AS total
     FROM trade_milestones
     WHERE employee = $1
       AND status IN ('approved', 'paid')
       AND (
         jalali_month = $2
         OR (jalali_month IS NULL AND achieved_at LIKE $3)
       )`,
    [employee, month, month + '%']
  );
  return parseFloat(r.rows[0] && r.rows[0].total) || 0;
}

async function getTradeKpiPayrollRow(employee, month) {
  const r = await query(
    `SELECT COALESCE(final_score, avg_score) AS kpi_score,
            gate_passed, hygiene_bonus, finalized, dimensions, month
     FROM trade_kpi_monthly
     WHERE employee = $1 AND month = $2 AND finalized = true
     LIMIT 1`,
    [employee, month]
  );
  return r.rows[0] || null;
}

async function getWmsInventorySnapshot() {
  const r = await query(`
    SELECT COUNT(DISTINCT p.id)::int AS sku_count,
           COALESCE(SUM(l.qty), 0)::int AS total_qty
    FROM wms_products p
    LEFT JOIN wms_lots l ON l.product_id = p.id AND l.qty > 0
    WHERE p.active = true
  `);
  return r.rows[0] || { sku_count: 0, total_qty: 0 };
}

module.exports = {
  isTradeEmployee,
  calcTradeHygieneBonus,
  getCommissionSettings,
  getMilestoneBonusForMonth,
  getTradeKpiPayrollRow,
  getWmsInventorySnapshot,
  TRADE_ROLES,
};

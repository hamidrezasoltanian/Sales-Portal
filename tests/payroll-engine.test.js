'use strict';

const {
  prorateAmount,
  calcLegalDeductionsOnInsurable,
  calcCommission,
  WORKFLOW,
} = require('../server/lib/payroll-engine');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

console.log('💰 Payroll engine unit tests');

assert(prorateAmount(26000000, 26, 26) === 26000000, 'full month prorate');
assert(prorateAmount(26000000, 13, 26) === 13000000, 'half month prorate');

const ded = calcLegalDeductionsOnInsurable(20000000, 25000000, { insuranceEmployeePct: 7, taxExemptAmount: 0 });
assert(ded.insurance === 1400000, 'insurance on insurable base only');
assert(ded.net_pay < 25000000, 'net less than gross');

const comm = calcCommission(3000000000, { base_pct: 1, tier_threshold: 2000000000, tier_step_amount: 500000000, tier_step_pct: 0.1, kpi_multiplier: 2 }, true, 1);
assert(comm.amount > 0, 'commission calculated');

assert(WORKFLOW.LOCKED === 'locked', 'workflow locked status');

console.log('\n────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);

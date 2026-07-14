'use strict';

const {
  calcProgressiveTax,
  calcLegalDeductions,
  adjustTargetForLeave,
} = require('../server/lib/payroll-deductions');
const { iterJalaliDays } = require('../server/lib/hr-leave');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

console.log('📅 HR leave / payroll unit tests');

assert(adjustTargetForLeave(100, 26, 0) === 100, 'no leave → target unchanged');
assert(adjustTargetForLeave(100, 26, 13) === 50, 'half month leave → half target');
assert(adjustTargetForLeave(100, 26, 26) === 0, 'full month leave → zero target');

const ded = calcLegalDeductions(100000000, { insuranceEmployeePct: 7, taxExemptAmount: 0 });
assert(ded.insurance === 7000000, 'insurance 7%');
assert(ded.net_pay < ded.gross_pay, 'net less than gross');
assert(calcProgressiveTax(0) === 0, 'zero tax on zero taxable');

const days = iterJalaliDays('1404/04/01', '1404/04/03');
assert(days.length === 3, 'iterJalaliDays spans 3 calendar days');

console.log('\n────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);

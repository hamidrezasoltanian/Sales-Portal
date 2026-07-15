'use strict';

const { validatePermissions } = require('../server/lib/permissions-schema');
const { resolvePermLevel, levelSatisfies, managerBypassAllowed } = require('../server/lib/perm-resolve');
const { serializeUser, canSeeSensitiveUserFields } = require('../server/lib/user-serializer');
const { detectDirectManagerCycle } = require('../server/lib/direct-manager');
const { filterDbForUser, buildOwnerMaps } = require('../server/lib/center-ownership');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg); passed++; }
  else { console.log('  ❌ ' + msg); failed++; }
}

console.log('\n=== permissions schema ===');
const bad = validatePermissions({ modules: { payroll: 'superuser' } });
assert(!bad.ok, 'rejects invalid permission level');

const typo = validatePermissions({ modules: { payrol: 'edit' } });
assert(!typo.ok, 'rejects unknown module key');

const ok = validatePermissions({ modules: { payroll: 'manage' }, provinces: ['tehran'] });
assert(ok.ok && ok.value.modules.payroll === 'manage', 'accepts valid permissions');

console.log('\n=== segregated payroll (manager) ===');
const manager = { role: 'مدیر', username: 'm', permissions: {} };
assert(!managerBypassAllowed('payroll'), 'payroll is segregated');
assert(resolvePermLevel(manager, 'payroll') === 'manage', 'manager payroll is manage not edit');
assert(levelSatisfies(resolvePermLevel(manager, 'payroll'), 'view'), 'manager can view payroll');
assert(!levelSatisfies(resolvePermLevel(manager, 'payroll'), 'approve'), 'manager cannot approve lock');
assert(levelSatisfies(resolvePermLevel(manager, 'payroll'), 'manage'), 'manager can manage workflow');
assert(managerBypassAllowed('weekplan'), 'weekplan not segregated');

const finance = { role: 'مالی', username: 'f', permissions: {} };
assert(levelSatisfies(resolvePermLevel(finance, 'payroll'), 'approve'), 'finance can approve');
assert(!levelSatisfies(resolvePermLevel(finance, 'payroll'), 'manage'), 'finance cannot manage draft');

const superAdmin = { role: 'سوپر ادمین', username: 's', permissions: {} };
assert(levelSatisfies(resolvePermLevel(superAdmin, 'payroll'), 'approve'), 'super-admin can approve via edit');

console.log('\n=== user serializer ===');
const row = { username: 'u1', display_name: 'U', role: 'کارشناس فروش', color: '#fff', phone: '', active: true, salary_amount: 100, commission_pct: 2, permissions: {} };
const expertView = serializeUser(row, { role: 'کارشناس فروش', username: 'u2', permissions: { modules: { hr: 'view' } } });
assert(expertView.salary_amount === undefined, 'hr:view requester does not see salary');

const mgrView = serializeUser(row, { role: 'مدیر', username: 'm' });
assert(mgrView.salary_amount === 100, 'manager sees salary');

const finView = serializeUser(row, { role: 'مالی', username: 'f', permissions: {} });
assert(finView.salary_amount === 100, 'finance sees salary for payroll');

console.log('\n=== direct_manager cycle ===');
(async function () {
  const q = async function (sql, params) {
    const graph = {
      A: { direct_manager: 'B' },
      B: { direct_manager: 'A' },
      C: { direct_manager: '' },
    };
    const u = params[0];
    return { rows: graph[u] ? [{ direct_manager: graph[u].direct_manager }] : [] };
  };
  const err = await detectDirectManagerCycle('C', 'A', q);
  assert(err && err.indexOf('چرخه') >= 0, 'detects A<->B cycle when assigning C->A');

  console.log('\n=== blob allowlist default-deny ===');
  const db = {
    edits: { center_1: { owner: 'expert' } },
    notes: { center_1: [] },
    mtrFollower: { secret: true },
    kpiHistory: [{ x: 1 }],
    settings: { anthropicKey: 'sk-test', members: [{ id: 'expert', name: 'E', role: 'کارشناس فروش', active: true, color: '#0ea5e9' }] },
  };
  const maps = buildOwnerMaps({ CENTERS: [{ id: 1, owner: 'expert' }] }, []);
  const filtered = filterDbForUser(db, { username: 'expert', role: 'کارشناس فروش', permissions: {} }, maps);
  assert(filtered.mtrFollower === undefined, 'mtrFollower stripped by allowlist');
  assert(filtered.kpiHistory === undefined, 'kpiHistory stripped by allowlist');
  assert(filtered.edits && filtered.edits.center_1, 'edits kept');
  assert(!filtered.settings.anthropicKey, 'anthropicKey stripped from settings');

  console.log('\n=== guest role ===');
  const guest = { role: 'مهمان', username: 'guest', permissions: {} };
  assert(resolvePermLevel(guest, 'weekplan') === 'none', 'guest has no weekplan');
  assert(resolvePermLevel(guest, 'provinces') === 'none', 'guest has no provinces');

  console.log('\n--- permissions-rbac: ' + passed + ' passed, ' + failed + ' failed ---\n');
  process.exit(failed > 0 ? 1 : 0);
})();

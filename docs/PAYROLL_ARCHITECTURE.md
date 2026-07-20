# Payroll & HR — Architecture & Rules

Single source of truth for payroll logic. Updated after compliance fixes (Jul 2026).

## Workflow (segregation of duties)

| State | Who can advance |
|-------|-----------------|
| `draft` → `manager_review` | مدیر، سوپر ادمین |
| `manager_review` → `financial_approval` | مدیر، سوپر ادمین |
| `financial_approval` → `locked` | **مالی**، سوپر ادمین |
| `locked` → `published` | مدیر، سوپر ادمین |

**Direct `draft` → `locked` is blocked** (except logged super-admin `force` override in API).

Permissions module: `payroll` — مالی has `approve` (view + financial lock).

## Sales attribution (deterministic)

```
Rule: paid_invoices_only
Attribution: invoices.commission_owner (frozen at proforma→invoice conversion)
  Fallback for legacy rows: invoices.created_by
Snapshot source at issue: center owner NOW → sales_owner → created_by
No proforma fallback — uninvoiced/partial sales do not count until invoice.status = 'paid'
Later center-owner changes do NOT move past invoices
```

Prevents double-count when a proforma was counted as `invoiced` and later appears as `paid` invoice.

## Commission base rate priority

1. `employee_contracts.commission_pct` if > 0
2. Else `commission_settings.base_pct` (global)

Tier thresholds/steps always from `commission_settings`.

## Two commission systems (not unified yet)

| System | Model | Used in payslip |
|--------|--------|-----------------|
| **Payroll tier** | % of paid invoice total, ladder | `commission_amount` |
| **Pricing** | Fixed `commission_amt` per proforma line | Display only |

Reconciliation: `GET /api/payroll/reconciliation/:month` — compare gap per employee.

## KPI sources

| Employee type | KPI table | Tier multiplier |
|---------------|-----------|-----------------|
| بازرگانی | `trade_kpi_monthly` (finalized) | N/A (no sales commission) |
| فروش | `sales_kpi_monthly` (finalized) | Applied when `overall >= kpi_threshold` |

**Do not** read `trade_kpi_monthly` for sales employees.

### Hard gate (sales → payroll)

Connecting payroll to sales KPI requires (all ✅ as of Jul 2026):

1. ✅ `calcKPIs` runs on the server (client display-only)
2. ✅ Conversion dual-source resolved (paid invoices → else sales_log)
3. ✅ Month finalized into `sales_kpi_monthly` (cron + manual override)

Full analysis: [`KPI_ARCHITECTURE.md`](./KPI_ARCHITECTURE.md).

## Deductions

- Employee insurance: `hr_settings.insurance_employee_pct` (default 7%) on insurable base
- Employer insurance: `hr_settings.insurance_employer_pct` (default 23%) — for لیست بیمه export
- Tax: `tax_brackets` per `tax_year` (Jalali year); fallback hardcoded if DB empty

## Net pay edge case

If advances + penalties > gross − deductions:

- `net_pay` clamped to 0
- `net_debt_carry` = absolute shortfall (stored in calc result; persist in `payroll_records.net_debt_carry` on next upsert extension)

## Audit trail

`calc_snapshot.inputs` includes invoice lines, leave days, variables, contract id — not only stage totals.

## Disciplinary → penalty link

`payroll_monthly_variables.disciplinary_action_id` FK → `disciplinary_actions.id` for audit.

## Edit after approval (مدیر / سوپر ادمین)

From `manager_review`, `financial_approval`, `locked`, or `published`:

- **✏️ ویرایش** → `POST /api/payroll/workflow/...` with `status: draft` (reopens; clears lock/publish)
- **🔄 محاسبه مجدد** → `POST /api/payroll/recalc/...` (reopen + force recalc + save)

مالی cannot edit after approval. All reopen/recalc actions logged in `payroll_workflow_log`.


- Off-cycle correction / reversal after `published` → `payroll_corrections` (apply next month)
- Attendance → working_days when `attendance_logs` exist
- Auto penalty from disciplinary_actions (step≥3 / bonus_cut → pending variable)
- Document file upload (`POST /api/hr/documents/upload` + download)
- Unified pricing + payroll commission — reconciliation UI shows gap; models remain separate by design until product unifies rates

## Priority roadmap (risk-based)

1. ✅ Workflow roles + مالی approve
2. ✅ Deterministic sales source (paid invoices / commission_owner)
3. ✅ Reconciliation API + UI
4. ✅ tax_brackets + employer insurance
5. ✅ disciplinary FK
6. ✅ **P0 (gate):** server-side `calcKPIs` + conversion SoT — see `KPI_ARCHITECTURE.md`
7. ✅ **P1:** cron `sales_kpi_monthly` finalize + effective-dated weights + audit
8. ✅ Variables UI, published employee payslip (`/my/:month`), corrections, attendance, doc upload, TG KPI
9. Optional: unify pricing commission_amt into payroll ladder (product decision)

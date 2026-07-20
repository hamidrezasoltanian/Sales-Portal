# Sales KPI & Daily Checklist — Architecture & Roadmap

Canonical rules after design review (Jul 2026).  
**Do not connect sales KPI multipliers to payroll until P0 items below are done.**

---

## Layer separation (intentional)

| Layer | Purpose | Feeds payroll? |
|-------|---------|----------------|
| Daily checklist | Habit / coaching | **Never** |
| Sales KPI (`calcKPIs`) | Monthly performance score | Only via finalized `sales_kpi_monthly` **after** server-side calc |
| Trade KPI (`trade_kpi_monthly`) | بازرگانی only | Trade path only — **never** for sales employees |

Checklist auto-items (6 of N) read CRM facts (`callLog`, notes, followup, week plan, sales) so self-report gaming is limited. Manual ticks remain coaching, not money.

---

## Current sales KPI model (`public/js/kpi.js` → must move server-side)

Seven weighted indicators (defaults):

| ID | Metric | Default weight | Cap |
|----|--------|----------------|-----|
| conversion | Closed deals count | 20% | 100% |
| retention | Customer share of owned centers | 20% (target fixed 90%) | 100% |
| visits | Visits / week | 15% | 100% |
| calls | Calls / working day | 15% | 100% |
| sales | Amount or count vs target | 15% | 100% |
| mission | Monthly mission done | 5% | binary 0/100 |
| cash | % cash sales | 10% | 100% |

```
scoreᵢ = min(actualᵢ / targetᵢ, 1) × 100
overall = Σ scoreᵢ × weightᵢ / 100
```

Mid-month forecast scales by working days elapsed (display only until history is cron-frozen).

### Known risks (tracked)

| Risk | Severity | Mitigation status |
|------|----------|-------------------|
| Client-side `calcKPIs` → Telegram/UI/payroll can diverge; DevTools spoof | **P0** | ✅ Server SoT (`server/lib/sales-kpi.js`); client display-only via `fetchKPIs` |
| Conversion double-count: `sales_log` vs center «قرارداد بسته شد» | **P0** | ✅ Paid invoices first, else `sales_log` only — never + center status |
| Manual monthly snapshot gaps | P1 | ✅ Cron 01:15 Tehran finalizes prev month → `sales_kpi_monthly` |
| Weight/target overwrite mid-month rewrites history | P1 | ✅ `kpi_weight_versions` effective-dated; targets audited |
| Cap at 100% — accidental or intentional? | P2 | ✅ Intentional (`SCORE_CAP=100`, `ALLOW_OVERPERFORMANCE_BONUS=false`) |
| Retention target 90% global | P2 | ✅ Per-user `retention_target` + `kpi_region_targets` |
| No audit on weight/target changes | P3 | ✅ `kpi_config_audit` |

## Hard gate before payroll

```
✅ Required sequence (DONE):
  1. Server calcKPIs (single SoT API)           → GET /api/kpi-data/calc
  2. Resolve conversion dual-source            → paid_invoices | sales_log
  3. Cron monthly finalize → sales_kpi_monthly → sales-kpi-scheduler
  4. Effective-dated weights/targets           → kpi_weight_versions + audit
  5. Payroll multiplier reads sales_kpi_monthly → payroll-engine.js
```

UI displays server results only; payroll never uses client math.

---

## Priority roadmap (risk-based)

| Pri | Action | Why |
|-----|--------|-----|
| **P0** | Move `calcKPIs` to server; client display-only | Prerequisite for payroll; one number for tab / Telegram / digest |
| **P0** | Fix conversion dual-source (sales_log vs center status) | Prevent score inflation / overpay |
| **P1** | Effective-dated weights & targets | Comparable 6-month trends |
| **P1** | Cron auto-snapshot / finalize month | No gap if manager forgets button |
| **P2** | Explicit decision: keep 100% cap vs limited overperformance bonus | Before money; not after |
| **P2** | Retention target per segment/region | Avoid structural demoralization |
| **P3** | Audit log weight/target changes (who/when) | Regulatory / IMED-style trail |

### Corrected dependency order (not parallel)

```
فاکتور paid (attribution SoT)
    → server calcKPIs + conversion SoT
    → sales_kpi_monthly (cron finalize)
    → payroll multiplier
```

Legacy mistaken order treated server calc as optional end item — **rejected**.

---

## Checklist storage (unchanged intent)

- Table: `daily_checklists` `(date, username)`
- API: `POST /api/checklist`
- Does not feed `sales_kpi_monthly` or payroll

---

## Related docs

- Payroll gate: [`PAYROLL_ARCHITECTURE.md`](./PAYROLL_ARCHITECTURE.md)
- Data tables: [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) §۴.۳
- Digests / Telegram: [`TELEGRAM_NOTIF_ANALYSIS_PLAN.md`](./TELEGRAM_NOTIF_ANALYSIS_PLAN.md) §۴.۳

# Center Interactions — معماری canonical + projection

## خلاصه

هر تعامل کارشناس با مرکز (تماس سریع، ثبت نتیجه برنامه هفته، اصلاح) از **یک endpoint** ثبت می‌شود:

```
POST /api/centers/:centerKey/interactions
Header: X-Idempotency-Key (اجباری)
```

سرور در **یک transaction PostgreSQL** fan-out می‌کند و رکورد **append-only** در `center_interactions` می‌نویسد.

## Source of Truth

| لایه | جدول/API | نقش | خواننده |
|------|----------|-----|---------|
| **Canonical** | `center_interactions` | حقیقت تعامل — audit، dispute، timeline مدیر | `GET .../interactions`, timeline merge |
| **Projection KPI** | `call_log`, `visit_log`, `sales_log` | شمارش تماس/ویزیت/فروش | `GET /api/kpi-data/actuals`, تب KPI |
| **Projection UI** | `center_notes` | متن یادداشت در مدال مرکز | `GET /api/centers/:key`, provinces |
| **Projection هفته** | `week_entries` | وضعیت done برنامه | week plan |
| **Projection pipeline** | `center_edits` | followupDate, status, … | overdue، pipeline |

**قانون:** اگر KPI با timeline اختلاف داشت، با `center_interactions` reconcile کنید — نه برعکس.

## Idempotency (اجباری)

- `X-Idempotency-Key` یا `body.idempotencyKey` — **الزامی**
- Retry شبکه / دوبار کلیک → همان پاسخ 200، بدون duplicate
- جدا از transaction: transaction = atomicity داخل request؛ idempotency = dedup بین requestها

## Append-only + Correction

- رکورد interaction **هرگز UPDATE نمی‌شود**
- اصلاح: `POST` جدید با `correctsInteractionId` اشاره به رکورد قبلی
- void منطقی: `interactionType: 'void'` + `correctsInteractionId`

## Schema

```sql
center_interactions (
  id TEXT PRIMARY KEY,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  center_key TEXT NOT NULL,
  username TEXT NOT NULL,
  occurred_date TEXT NOT NULL,        -- Jalali YYYY/MM/DD
  action_type TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'quick', -- quick | done | correction | void
  outcome TEXT,
  result_text TEXT,
  note TEXT,
  followup_date TEXT,
  week_entry_id TEXT,
  corrects_interaction_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  projections JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

## Fan-out (یک BEGIN/COMMIT)

پیش‌شرط: همه جداول روی **یک PostgreSQL** (`atena_crm`, `pool` در `server/db.js`).

1. `INSERT center_interactions`
2. `center_notes` ← یادداشت با `interactionId`
3. `call_log` یا `visit_log` (بر اساس action_type)
4. `week_entries` UPDATE (فقط mode=done + weekEntryId)
5. `center_edits` PATCH (followupDate, status, lostReason)
6. `sales_log` (outcome=won + amount)
7. `change_log`

خطا در هر مرحله → `ROLLBACK` کامل.

## Action → KPI projection

| action_type | projection log |
|-------------|----------------|
| visit, meeting, committee | `visit_log` |
| سایر (call, followup, price_send, …) | `call_log` |

## Phase 0 (پیش‌نیاز — انجام شده)

1. KPI actuals از `GET /api/kpi-data/actuals` (سرور)
2. `getVisitsMonth` / `getCallsMonth` فقط از projection logs (نه week_entries)
3. `loadDB` → `reloadActivityLogsFromApi`
4. ثبت سریع → activity-log + interactions API

## ترتیب اجرا

1. **Phase 0** — باگ‌های blocking KPI
2. **Phase 1** — interactions backend + UI واحد
3. بعداً — deprecate مسیرهای موازی client-only

## تست acceptance

- Idempotency: دو POST با یک key → یک ردیف
- Rollback: خطای عمدی → هیچ projection نیمه‌کاره
- KPI: ثبت سریع → `actuals.calls` +1 همان ماه
- Timeline legacy merge: یادداشت قدیمی + interaction جدید بدون duplicate

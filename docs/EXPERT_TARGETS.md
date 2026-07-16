# Expert Targets (Quota)

## اصل

| | `week_entries` | `expert_targets` |
|--|----------------|------------------|
| سؤال | این مرکز کِی؟ | این کارشناس چقدر؟ |
| نقش | واحد اجرا | قید ناظر (observer) |
| رابطه | — | فقط در **محاسبه progress** (read-time COUNT) |

Quota هرگز به‌صورت ردیف جعلی داخل `week_entries` ذخیره نمی‌شود.

## جداول

- `expert_targets` — هدف هفته/ماه + `min_priority_count` + `filters` + `daily_wip_cap`
- `expert_target_audit` — تاریخچه
- `week_entries.assignment_source` — `manager_fixed` | `expert_self` | `suggest` | `manual`
- `week_entries.scheduled_time` — اختیاری

## Progress (فقط done)

```
free_slots = target_count − committed(manager_fixed)
done_total = COUNT(done ∧ filters)
quota_met  = done_total ≥ target AND done_priority ≥ min_priority_count
```

ماه → زیرهدف‌های هفتگی خودکار (`parent_id`).

## API

```
GET/POST  /api/expert-targets
GET       /api/expert-targets/board
GET       /api/expert-targets/:id/progress
GET       /api/expert-targets/:id/audit
PATCH     /api/expert-targets/:id
POST      /api/expert-targets/:id/{lock|unlock|cancel|close|activate}
```

`POST /api/week-entries` با `assignmentSource=expert_self` سقف `free_slots` و WIP روزانه را enforce می‌کند. تخصیص مدیر از تب تخصیص → `manager_fixed`.

## UI

تب **تخصیص برنامه** → زیرتب «اهداف (Quota)»: سازنده هدف + نوار پیشرفت کارشناسان.

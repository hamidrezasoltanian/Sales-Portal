# Security & Access Map — Click CRM

> **آخرین به‌روزرسانی:** ۱۴۰۴/۰۴/۲۵  
> منبع: `server/lib/center-ownership.js`, `server/lib/center-access.js`, `server/auth.js`, route middleware

---

## نقش‌ها

| نقش | شناسه | دسترسی کلی |
|-----|--------|------------|
| مدیر | `مدیر` | همه مراکز، همه تب‌ها، گزارش‌های مدیر |
| سوپر ادمین | `سوپر ادمین` | مثل مدیر + bypass برخی محدودیت‌های proforma |
| کارشناس فروش | `کارشناس فروش` | فقط مراکز مالکیت‌شده + فیلتر استان |
| مهمان | `guest` | محدود (طبق تنظیمات members) |
| نقش‌های سفارشی | `DB.settings.members[].role` | از `permissions` در members |

---

## Center ownership (RBAC هسته CRM)

```
مالک مرکز = edits.owner → static owner (CENTERS/PC_RAW) → extra.owner → weekEntry.addedBy
```

| عمل | کارشناس | مدیر |
|-----|---------|------|
| `GET /api/data/db` | allowlist + فیلتر مرکز/استان | کامل |
| `PUT /api/data/db` | allowlist PUT (بدون settings/tags/extra سراسری) | کامل |
| `PATCH /api/centers/:key` | فقط مرکز خودش | همه |
| `POST /api/centers/:key/notes` | مرکز خودش | همه |
| week-entries | فقط entries مالک / addedBy | همه |
| tasks | owner یا centerKey مجاز | همه |

**فیلتر استان:** اگر کاربر `provinces[]` در members داشته باشد، فقط مراکز آن استان‌ها.

**Conflict per-center:** `PATCH /api/centers/:key` با `expectedTs` (مقدار `_ts` قبلی) → 409 اگر مرکز توسط دیگری تغییر کرده.

---

## Entity APIs — حداقل احراز هویت

| API | Auth | محدودیت اضافی |
|-----|------|----------------|
| `/api/week-entries` | ✅ | مالکیت مرکز / addedBy |
| `/api/tasks` | ✅ | owner / centerKey |
| `/api/centers/:key` | ✅ | center access |
| `/api/calendar-events` | ✅ | — |
| `/api/checklist` | ✅ | username خود یا مدیر |
| `/api/activity-log` | ✅ | username خود (مدیر: همه) |
| `/api/kpi-data/*` | ✅ | مدیر برای targets سراسری |
| `/api/notifications` | ✅ | `to` = خود یا مدیر |
| `/api/proforma` | ✅ | canView/canEdit per row |
| `/api/changelog` | ✅ | POST همه؛ GET مدیر |
| `/api/crm-settings/:key` | ✅ | USER_PATCH_KEYS یا مدیر |
| `/api/pricing/mgmt/*` | ✅ + password | margin settings |
| `/api/mtr`, `/api/mtr/sync` | ✅ | مدیر برای sync |
| `/api/data/db` PUT | ✅ | RBAC strip برای کارشناس |
| `/api/data/mtr` PUT | ✅ | module permission MTR |
| `/api/backup`, `/api/restore` | ✅ | مدیر |
| `/api/users` | ✅ | مدیر |
| `/api/payroll/*` | ✅ | HR + مالی + مدیر (per route) |
| `/api/wms/*` | ✅ | authenticated |

---

## SSE events (per-entity)

| Event | Trigger | Client handler |
|-------|---------|----------------|
| `db-updated` | slim/full PUT blob | `_sseReloadDB` |
| `week-entry-changed` | week-entries mutations | `_wpOnWeekEntryChanged` |
| `calendar-changed` | calendar-events POST/DELETE | `reloadEventsFromApi` |
| `checklist-changed` | checklist POST | `reloadChecklistEntryFromApi` |
| `activity-log-changed` | activity-log POST/DELETE | `reloadActivityLogsFromApi` |
| `center-changed` | centers PATCH/notes | `reloadCenterEditFromApi` |
| `notif_new` | notifications POST | `_refreshNotifs` |
| `letter-changed` | letters workflow | `_lettersOnSSE` |

---

## Secrets & sensitive settings

| Key | Storage | نمایش |
|-----|---------|-------|
| `anthropicKey` | `app_settings` | masked `***` در GET |
| `farazApiKey` | `app_settings` | masked |
| `PRICING_ACCESS_PASSWORD` | env hash | server-side verify |
| `JWT_SECRET` | env | — |
| Session | cookie + `token_version` | invalidate on password change |

---

## اصول توسعه

1. **هر endpoint جدید:** `requireAuth` + ownership check برای داده مرکز-محور
2. **هر mutation:** SSE هدفمند (نه فقط `db-updated`)
3. **هر entity:** یک API — بدون dual-write با `saveDB()`
4. **Import/restore:** فقط `saveDBFull()` / Data Hub

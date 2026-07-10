# برنامه اصلاح Click CRM — جلوگیری از «پریدن» داده + Safety Net

> **تاریخ:** ۱۴۰۴/۰۴/۱۹  
> **مخاطب:** تیم dev (~۵–۲۰ کاربر CRM)  
> **هدف:** رفع ریشه‌ای گزارش «تغییر اعمال کردم ولی پرید» + ایمن‌سازی deploy و dev

---

## ۱. تشخیص مشکل (Root Cause)

### علامت
کاربر تغییر می‌دهد → UI درست نشان می‌دهد → بعد (refresh، SSE، یا session دیگر) تغییر نیست.

### علت ریشه‌ای
```
تغییر → DB.weekEntries (حافظه) → (شاید /api/week-entries) → همیشه saveDB() → PUT کل /api/data/db
```

| # | علت | فایل / محل |
|---|-----|------------|
| R1 | هر save = **کل CRM** در یک PUT | `public/js/core.js` → `_saveDBNow()` |
| R2 | **Dual-write**: API درست save می‌کند، saveDB 600ms بعد overwrite | `weekplan.js` + `data.js` |
| R3 | PUT مسیر saveDB: `SET value = EXCLUDED.value` (replace کامل) vs POST API: merge | `server/routes/data.js` L426–431 |
| R4 | **bulk done/remove** فقط `saveDB()` — بدون API | `weekplan.js` → `wpBulkDone`, `wpBulkRemove` |
| R5 | merge ضعیف weekEntries: `Object.assign({}, se, le)` بدون `_ts` | `core.js` → `mergeDatabaseDiff` |
| R6 | conflict 409 روی **کل DB** — نه per-entity | `data.js` + `core.js` |

### چرا محکم‌کاری قبلی کافی نبود
409، SSE، merge، backup محلی — روی **symptom** کار کردند. dual-write (API + saveDB) خودش مسیر save دوم با قوانین متفاوت ساخت.

### اصل راه‌حل
```
✅ یک entity → یک API → یک row SQL | SSE هدفمند | بدون saveDB برای همان entity
```

---

## ۲. اصول اجرا

1. **هر PR کوچک** — یک فاز یا زیرفاز؛ deploy بعد از هر مرحله
2. **test قبل merge** — CI اجباری از فاز ۱ به بعد
3. **UI برنامه هفته دست نخورَد** — فقط مسیر save عوض شود
4. **`#wpOwnerFilter` + `_wpGetOwner`** — بدون تغییر رفتار
5. **`app.bundle.js`** — فقط via Python script + `node --check`
6. **fallback موقت** — ۲ هفته transition؛ بعد حذف

---

## ۳. نقشه فازها

```
فاز ۱ Safety Net ──→ فاز ۲ Week Plan (فوری) ──→ فاز ۲ب Centers ──→ فاز ۲ج Tasks/Notif
        │                      │                         │
        └──────────────────────┴─────────────────────────┴──→ فاز ۳ Observability
                                                              └──→ فاز ۴ Hardening (اختیاری)
                                                                   └──→ فاز ۵ Tech Debt
```

---

## ۴. فاز ۱ — Safety Net (اولویت: فوری)

**هدف:** قبل از refactor، regression و incident dev/prod جلوگیری شود.

### ۱.۱ CI — GitHub Actions

- [ ] ایجاد `.github/workflows/ci.yml`
- [ ] Step: `npm ci`
- [ ] Step: `node --check public/js/app.bundle.js`
- [ ] Step: `node --check public/js/app.js` (اگر module source edit شود)
- [ ] Step: `npm test` (نیاز DB test — env `PG_DATABASE=atena_crm_test` یا skip با flag)
- [ ] block merge اگر fail

**فایل جدید:** `.github/workflows/ci.yml`

### ۱.۲ اسکریپت deploy

- [ ] `scripts/deploy.sh`: pre-backup → git pull → npm ci → test → `pm2 reload`
- [ ] log به `~/db_backups/deploy.log`
- [ ] exit non-zero اگر test fail

**فایل جدید:** `scripts/deploy.sh`

### ۱.۳ dev DB جدا

- [ ] `.env.dev.example` با `PG_DATABASE=atena_crm_dev`
- [ ] `scripts/setup_dev_db.sh`: `createdb` + `pg_dump | psql` one-shot
- [ ] warning در `server/index.js` startup اگر `PORT=4000` و `PG_DATABASE=atena_crm` (prod name)

**فایل‌ها:** `.env.dev.example`, `scripts/setup_dev_db.sh`

### ۱.۴ پاکسازی log

- [ ] حذف `[DEBUG CONFLICT]` از `server/routes/data.js` L185

### ۱.۵ Uptime monitoring

- [ ] مستند: ping `GET /api/health` هر ۵ دقیقه (UptimeRobot / similar)
- [ ] alert اگر `checks.postgres.ok === false`

**فایل:** بخشی از `docs/IMPROVEMENT_PLAN.md` § deploy runbook

### معیار پذیرش فاز ۱
- [ ] هر PR به main بدون CI سبز merge نشود
- [ ] deploy با یک دستور
- [ ] dev server به prod DB وصل نشود

---

## ۵. فاز ۲الف — برنامه هفته (اولویت: بالاترین — رفع «پریدن»)

**هدف:** `week_entries` = تنها source of truth؛ حذف saveDB از week plan.

### ۲α.۱ باگ فوری — bulk operations

| تابع | الان | باید |
|------|------|------|
| `wpBulkDone()` | فقط `saveDB()` | `POST /api/week-entries/bulk-update` |
| `wpBulkRemove()` | فقط `saveDB()` + `_weRemove` | `POST /api/week-entries/bulk-delete` |
| `wpDoBulkMove()` | `saveDB()` | bulk-update `weekId` + `scheduledDate` |

- [ ] backend: `POST /api/week-entries/bulk-update` `{ ids, done?, doneDate?, weekId?, scheduledDate?, actionType? }`
- [ ] backend: اطمینان از `bulk-delete` موجود — wire به frontend
- [ ] frontend: `wpBulkDone` → API
- [ ] frontend: `wpBulkRemove` → API
- [ ] frontend: `wpDoBulkMove` → API
- [ ] sync `app.bundle.js` از `weekplan.js`

**فایل‌ها:** `server/routes/week-entries.js`, `public/js/weekplan.js`, `public/js/app.bundle.js`

### ۲α.۲ حذف saveDB از عملیات تکی

| عمل | تابع(ها) | API |
|-----|----------|-----|
| drag-drop روز | `wpDrop` | `PUT /api/week-entries/:id` |
| mark done + modal | done flow | `PUT` با `{ done, doneDate, ... }` |
| حذف کارت | remove handlers | `DELETE /api/week-entries/:id` |
| assign / +امروز | `quickAddToToday`, assign | `POST /api/week-entries` |
| تغییر actionType | toggle | `PUT` |
| schedule modal | sch modal save | `PUT` |

- [ ] هر handler: **حذف** `saveDB()` / `saveDBSync()` بعد از API موفق
- [ ] optimistic UI: update `DB.weekEntries` local **بعد از** `response.ok`
- [ ] اگر API fail → toast خطا + revert local
- [ ] `sqlId` همیشه بعد از POST ذخیره شود

**فایل:** `public/js/weekplan.js` (~۲۰ محل `saveDB` — grep `saveDB` in weekplan.js)

### ۲α.۳ جلوگیری از overwrite از مسیر saveDB

- [ ] `PUT /api/data/db`: اگر `weekEntries` در body **نیست** → week_entries دست نزن
- [ ] یا: deprecate ارسال `weekEntries` از `_saveDBNow()` — حذف از payload
- [ ] `_weDeletedKeys` دیگر لازم نیست برای week plan (حذف تدریجی)

**فайل:** `public/js/core.js`, `server/routes/data.js`

### ۲α.۴ SSE هدفمند

- [ ] backend: بعد از هر mutation در `week-entries.js` → `broadcast('week-entry-changed', { action, id, weekId, by })`
- [ ] frontend: handler در `initSSE` — **نه** reload کل DB
- [ ] debounce 300ms → `GET /api/week-entries?week_id=current` یا patch local cache
- [ ] `renderWeekPlan()` + toast «X تغییر داد»

**فایل‌ها:** `server/routes/week-entries.js`, `server/routes/events.js`, `public/js/core.js`

### ۲α.۵ بارگذاری week plan (اختیاری فاز ۲ — می‌تواند ۲β باشد)

- [ ] `renderWeekPlan()`: optional `fetch('/api/week-entries?week_id=' + weekId)` on tab open
- [ ] merge into `DB.weekEntries` for current week only
- [ ] `#wpOwnerFilter` → query param `?owner=` (server-side filter)

### ۲α.۶ تست‌ها

- [ ] test: POST week-entry → PUT /db **بدون** weekEntries در body → entry سر جایش
- [ ] test: دو PUT concurrent روی entries مختلف → هر دو survive
- [ ] test: bulk-update done → GET confirms
- [ ] test: API save → simulate saveDB بدون weekEntries → no overwrite
- [ ] manual: دو کاربر، دو مرورگر، drag هم‌زمان

**فایل:** `tests/behavioral.test.js` + `tests/week-entries.test.js` (جدید)

### معیار پذیرش فاز ۲α
- [ ] هیچ `saveDB()` در `weekplan.js` برای week entry mutations
- [ ] bulk done/remove از تب دیگر visible
- [ ] ۰ گزارش «پرید» برای week plan در ۱ هفته monitor

---

## ۶. فاز ۲ب — مراکز (setE / edits)

**هدف:** تغییر فیلد مرکز دیگر کل DB را save نکند.

### ۲β.۱ API

- [ ] `PATCH /api/centers/:key` — body: `{ field, val }`
- [ ] server: upsert `center_edits` با `data || jsonb_build_object(field, val)`
- [ ] append `change_log`
- [ ] return `{ ok, _ts }` per center

**فایل جدید/ویرایش:** `server/routes/centers.js` یا extend `contacts.js` / `data.js`

### ۲β.۲ Frontend

- [ ] `setE(type, id, field, val)` → PATCH به‌جای `saveDB()`
- [ ] debounce 300ms per center_key (نه کل DB)
- [ ] fallback saveDB فقط برای fields هنوز migrate نشده
- [ ] SSE: `center-changed` → merge همان center در `DB.edits`

**فایل:** `public/js/settings.js` / `app.bundle.js` (`setE`)

### ۲β.۳ حذف edits از payload saveDB (تدریجی)

- [ ] `_saveDBNow()`: omit `edits` when PATCH active
- [ ] `PUT /api/data/db`: skip `center_edits` if key absent

### معیار پذیرش
- [ ] edit مرکز + drag week plan هم‌زمان → بدون 409 کل DB
- [ ] changeLog همچنان record شود

---

## ۷. فاز ۲ج — tasks و notifications (حذف dual-write)

**وضعیت:** ✅ انجام شد — saveDB حذف از handlers وظایف؛ tasks/notifications از payload حذف.

- [x] audit: grep `saveDB` after `fetch('/api/tasks`
- [x] audit: grep `saveDB` after `fetch('/api/notifications`
- [x] حذف tasks/notifications از `_saveDBNow()` payload
- [x] `PUT /api/data/db`: skip tables if keys absent (tasks/notif omitted from client payload)
- [x] load: tasks از `GET /api/tasks` at tab open (already partial)

**فایل‌ها:** `public/js/app.bundle.js` (tasks panel), `modules/notifications.js`, `core.js`

---

## ۸. فاز ۲δ — events و checklist (الگوی DELETE ALL)

**ریسک:** دو user → یکی wipe می‌کند.

- [x] `events`: UPSERT per `id` به‌جای `DELETE FROM app_events` + insert all
- [x] `checklist`: UPSERT per `(date, username)` به‌جای delete all
- [x] test concurrent checklist save (test 12)

**فایل:** `server/routes/data.js` L254–280 approx

---

## ۹. فاز ۳ — Observability

- [x] structured log helper: `{ ts, route, user, ms, err }` — `server/lib/log.js`
- [x] health dashboard script: PG + last backup age + disk — `scripts/health-check.sh`
- [x] runbook: «کاربر گفت پرید» — `docs/runbook-data-loss.md`
- [ ] Sentry (server `SENTRY_DSN` env) — hook in `server/index.js` if `@sentry/node` installed
- [ ] Sentry browser (optional, sample rate 0.1)

**فایل‌ها:** `server/index.js`, `docs/runbook-data-loss.md`

---

## ۱۰. فاز ۴ — Hardening (وقتی CRM public/VPN باز)

- [x] `express-rate-limit` on `/api/auth/login` — in-memory 10/15min (موجود)
- [x] rate limit `/api/ai` (20/hour per user)
- [x] `requireAuth`: fail-closed on DB error (`AUTH_FAIL_OPEN=true` برای fail-open)
- [x] startup: exit if `JWT_SECRET === default` && `NODE_ENV=production`
- [ ] CSP gradual (start report-only)

**مرجع اضافی:** `DB_SECURITY_TODO.md`

---

## ۱۱. فاز ۵ — Tech Debt (بلندمدت)

- [ ] Vue migration یک tab (week plan یا tasks)
- [ ] build step اجباری برای bundle (Vite) — حذف edit دستی bundle
- [ ] حذف کامل `PUT /api/data/db` وقتی همه entities PATCH/API شدند
- [ ] MTR sync live (`/api/mtr/sync`) — roadmap موجود در CLAUDE.md

---

## ۱۲. ترتیب اجرا (Execution Order)

| مرحله | فاز | تخمین invasiveness | blocker |
|-------|-----|-------------------|---------|
| 1 | ۱.۱ CI | کم | — |
| 2 | ۱.۴ debug log | کم | — |
| 3 | ۲α.۱ bulk fix | متنمایان‌ترین fix «پریدن»** | ۱.۱ |
| 4 | ۲α.۲ حذف saveDB weekplan | متوسط | ۲α.۱ |
| 5 | ۲α.۳ omit weekEntries from saveDB | متوسط | ۲α.۲ |
| 6 | ۲α.۴ SSE week-entry | کم | ۲α.۲ |
| 7 | ۲α.۶ tests | کم | ۲α.۳ |
| 8 | ۱.۲ deploy script | کم | ۱.۱ |
| 9 | ۱.۳ dev DB | کم | — |
| 10 | ۲β setE PATCH | متوسط | ۲α stable |
| 11 | ۲ج tasks/notif | کم | ۲β |
| 12 | ۲δ events/checklist | متوسط | — |
| 13 | ۳ observability | کم | — |
| 14 | ۴ hardening | کم | prod exposure |

---

## ۱۳. چک‌لیست فایل‌های کلیدی

```
server/
  routes/data.js          ← conflict, week_entries PUT, events upsert
  routes/week-entries.js  ← bulk-update, broadcast SSE
  routes/events.js        ← broadcast helper
  index.js                ← Sentry, prod guards

public/js/
  core.js                 ← _saveDBNow payload, SSE, mergeDatabaseDiff
  weekplan.js             ← حذف saveDB (اصلی)
  app.bundle.js           ← sync from modules (Python only!)
  settings.js             ← setE → PATCH

tests/
  behavioral.test.js      ← extend
  week-entries.test.js    ← new

.github/workflows/ci.yml  ← new
scripts/deploy.sh         ← new
scripts/setup_dev_db.sh   ← new
```

---

## ۱۴. سناریوهای تست دستی (QA)

| # | سناریو | انتظار |
|---|--------|--------|
| Q1 | User A drag، User B done — هم‌زمان | هر دو save |
| Q2 | bulk done ۱۰ کارت → refresh User B | همه done |
| Q3 | bulk remove → لیست پایین week plan | حذف visible |
| Q4 | User A edit مرکز، User B drag همان مرکز | بدون 409 global |
| Q5 | cut network mid-save | toast خطا، revert UI |
| Q6 | دو tab same user drag | cid logic — no false 409 |
| Q7 | Telegram bot approve proforma + user در CRM | بدون wipe week plan |

---

## ۱۵. Rollback

- هر فاز = یک PR جدا
- قبل deploy: `scripts/backup_db.sh appdata`
- restore: `gunzip -c appdata_*.sql.gz | psql atena_crm` (table app_data) + `week_entries` from full backup
- feature flag (optional): `DB.settings.saveWeekEntriesViaBlob=true` برای rollback فاز ۲α

---

## ۱۶. KPI موفقیت

| متریک | baseline | هدف |
|-------|----------|-----|
| گزارش «پرید» / هفته | ? | → 0 |
| PUT /api/data/db body size | ~MB | → <100KB (بدون edits/weekEntries) |
| 409 conflict rate | ? | → نزدیک 0 برای week plan |
| CI pass rate | N/A | 100% on main |
| MTTR debug | ساعات | <15min با Sentry |

---

## ۱۷. کارهایی که عمداً انجام **نمی**‌دهیم

- ❌ rewrite کل frontend
- ❌ microservices / Kubernetes
- ❌ Redis (فعلاً)
- ❌ load balancer (زیر ۲۰ user)
- ❌ حذف یک‌شبه `PUT /api/data/db` (تا همه entities migrate شوند)

---

## ۱۸. لاگ پیشرفت

| تاریخ | مرحله | PR | وضعیت |
|-------|-------|-----|--------|
| 1404/04/19 | ۱.۱ CI | #13 | ✅ |
| 1404/04/19 | ۱.۴ debug log | #13 | ✅ |
| 1404/04/19 | ۱.۲ deploy.sh + .env.dev.example | #13 | ✅ |
| 1404/04/19 | ۲α.۱ bulk fix | #13 | ✅ |
| 1404/04/19 | ۲α.۲ weekplan saveDB حذف | #13 | ✅ |
| 1404/04/19 | ۲α.۳ omit weekEntries از saveDB | #13 | ✅ |
| 1404/04/19 | ۲α.۴ SSE week-entry-changed | #13 | ✅ |
| 1404/04/19 | ۲α.۶ tests 9-10 | #13 | ✅ |
| 1404/04/19 | ۲β PATCH centers / setE | #13 | ✅ |
| 1404/04/19 | ۲γ tasks/notif dual-write | #13 | ✅ |
| 1404/04/19 | ۲δ events/checklist UPSERT | #13 | ✅ |
| 1404/04/19 | ۳ observability + runbook | #13 | ✅ |
| 1404/04/19 | ۴ hardening (AI rate, auth) | #13 | ✅ |

---

*این سند مرجع اجرا است. بعد از هر PR merged، چک‌لیست §۱۸ و CLAUDE.md Feature Inventory به‌روز شود.*

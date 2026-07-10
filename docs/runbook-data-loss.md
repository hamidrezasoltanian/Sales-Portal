# Runbook: «کاربر گفت داده پرید»

> **هدف:** تشخیص سریع (<۱۵ دقیقه) و بازیابی داده از بین رفته در Click CRM

---

## ۱. جمع‌آوری اطلاعات از کاربر

- **چه tab/بخش؟** (برنامه هفته، مرکز، وظیفه، …)
- **چه زمانی؟** (تقریباً ساعت + تاریخ جلالی)
- **refresh کرد؟** یا tab دیگر باز بود؟
- **username** کاربر و آیا manager همزمان کار می‌کرد؟

---

## ۲. بررسی سریع سرور

```bash
# وضعیت PM2
pm2 status sales-portal
pm2 logs sales-portal --lines 100

# health check
curl -s http://localhost:3000/api/health | jq .

# اسکریپت health (PG + backup + disk)
./scripts/health-check.sh
```

---

## ۳. بررسی entity در PostgreSQL

### برنامه هفته (week_entries)

```sql
SELECT id, week_id, center_key, scheduled_date, done, updated_at, updated_by
FROM week_entries
WHERE center_key LIKE '%CENTER_ID%'
ORDER BY updated_at DESC
LIMIT 20;
```

### مراکز (center_edits)

```sql
SELECT center_key, data->>'status' AS status, data->>'followupDate' AS followup,
       updated_at, updated_by
FROM center_edits
WHERE center_key = 'center_XXX';
```

### وظایف (tasks)

```sql
SELECT id, title, status, done, updated_at, updated_by
FROM tasks
WHERE id = 'TASK_ID';
```

### تاریخچه snapshot (app_data_history)

```sql
SELECT id, saved_at, saved_by, pg_size_pretty(octet_length(value::text)) AS size
FROM app_data_history
ORDER BY saved_at DESC
LIMIT 10;
```

---

## ۴. علل رایج (بعد از فاز ۲)

| علامت | علت محتمل | بررسی |
|--------|-----------|--------|
| week plan پرید | dual-write قدیمی (قبل از merge) | `week_entries` row vs `app_data` blob |
| مرکز revert شد | saveDB بعد از PATCH | `center_edits.updated_at` vs changeLog |
| وظیفه ناپدید | saveDB tasks در payload | `tasks` table مستقل |
| 409 conflict | دو tab/user همزمان | لاگ `[AtenaCRM] تداخل` در browser console |

---

## ۵. بازیابی

### از backup app_data (هر ۱۰ دقیقه)

```bash
ls -lt ~/db_backups/appdata_*.sql.gz | head -5
gunzip -c ~/db_backups/appdata_TIMESTAMP.sql.gz | psql -U postgres atena_crm
```

### فقط week_entries از snapshot

```bash
python3 scripts/restore_weekentries.py
```

### از app_data_history در DB

```sql
-- مشاهده snapshot
SELECT saved_at, saved_by FROM app_data_history ORDER BY saved_at DESC LIMIT 5;
```

---

## ۶. Structured logs

خطوط JSON در `pm2 logs`:

```json
{"ts":"...","level":"error","route":"PUT /api/data/db","user":"Sarah.hosseini","ms":42,"err":"..."}
```

---

## ۷. Sentry (اختیاری)

اگر `SENTRY_DSN` در `.env` تنظیم شده:
- خطاهای 500 در dashboard Sentry
- فیلتر: `route` شامل `/api/data/db`

---

## ۸. بعد از بازیابی

1. از کاربر بخواهید hard refresh (Ctrl+Shift+R)
2. تأیید در tab دوم (SSE sync)
3. اگر تکرار شد → issue در GitHub با timestamp + username

---

*آخرین به‌روزرسانی: فاز ۳ برنامه اصلاح — PR #13*

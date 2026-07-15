# ادغام EZ Dashboard → Click CRM (تب بازرگانی)

## وضعیت: ✅ تکمیل شده

ادغام تک‌سروری روی `click-crm` (پورت ۳۰۰۰) و دیتابیس `atena_crm`.

| لایه | جدول/API | نقش |
|------|----------|-----|
| عملیاتی | `trade_process_templates`, `trade_cases`, `trade_case_activities` | پرونده‌ها و مراحل |
| KPI | `trade_*` + `trade-case-kpi.js` | نمره؛ تکمیل/نهایی مرحله → همگام‌سازی |
| گزارش | `/api/trade-reports` | خلاصه ماهانه |
| SSE | `trade-case-changed` | به‌روزرسانی زنده لیست پرونده |

## تب‌های UI

- **پرونده‌ها** — فیلتر فعال/نهایی/همه، ایجاد، مودال مراحل، تاریخچه فعالیت
- **فرآیندها** (مدیر) — طراحی بصری مراحل و فیلدها (بدون JSON)
- **گزارش بازرگانی** — کارت‌های خلاصه + تفکیک فرآیند
- سایر تب‌های KPI بدون تغییر

## لینک پیش‌فاکتور

- از پرونده → «پیش‌فاکتور» → ایجاد PF
- پس از ذخیره PF، `proforma_id` خودکار روی پرونده ثبت می‌شود
- دکمه «مشاهده پیش‌فاکتور» در مودال پرونده

## API

```
GET/POST  /api/trade-templates
GET/POST  /api/trade-cases
PUT       /api/trade-cases/:id
POST      /api/trade-cases/:id/steps
POST      /api/trade-cases/:id/finalize
GET       /api/trade-cases/:id/full   (+ activities)
GET       /api/trade-reports/summary
GET       /api/trade-reports/cases-by-template
```

## KPI از مراحل

| کلیدواژه در عنوان مرحله | جدول |
|--------------------------|------|
| ترخیص / گمرک | `trade_clearances` |
| تامین / سورس | `trade_suppliers_new` |
| مالی / هزینه | `trade_finance_items` |
| گزارش / روزانه | `trade_daily_reports` |

نهایی‌سازی پرونده → همگام‌سازی مجدد همه مراحل تکمیل‌شده.

## مهاجرت EZ

```bash
node scripts/migrate-ez-to-crm.js --dry-run
node scripts/migrate-ez-to-crm.js --apply
```

## خاموش کردن EZ (دستی)

```bash
bash scripts/decommission-ez-dashboard.sh
```

## فایل‌های کلیدی

- `public/js/trade-kpi.js`
- `public/js/trade-cases-ui.js`
- `server/routes/trade-cases.js`
- `server/lib/trade-case-kpi.js`

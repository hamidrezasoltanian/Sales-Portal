# طرح ارتقای گزارشات، KPI، مدیر، مراکز و پیشفاکتور

> تاریخ: ۱۴۰۴/۰۴/۱۹ — وضعیت: **✅ پیاده‌سازی شده**

## مشکل مشترک

سه منبع داده موازی: **SQL**، **blob مرورگر (`DB.*`)**، **محاسبه client-side**.  
هدف: **SQL به‌عنوان منبع حقیقت** + UI از API.

---

## ۱. گزارشات تحلیلی (`reports.js` + `/api/reports`)

### وضعیت فعلی
| تب | منبع | وضعیت |
|---|---|---|
| فروش / قیف | SQL `proformas` | ✅ |
| حقوق / فاکتور / پشتیبانی / فرادیس | SQL | ✅ |
| فعالیت / رقبا / پوشش / ماموریت | blob `DB.*` | ⚠️ |

### باگ
تب فعالیت: `changeLog.at` ISO گریگوری است ولی مثل شمسی گروه‌بندی می‌شود.

### ارتقا
- [x] `GET /api/reports/activity-summary?months=6`
- [x] `GET /api/reports/coverage`
- [x] `GET /api/reports/competitor`
- [x] `GET /api/reports/pipeline-value`
- [x] اصلاح payroll-history (فیلتر ماه)
- [x] `_rActivity` از API
- [x] دکمه خروجی Excel (`exportTableToXlsx`)

---

## ۲. KPI (`kpi.js` + `/api/kpi-data`)

### ارتقا
- [x] `GET /api/kpi-data/targets?month=`
- [x] `GET /api/kpi-data/history?user=`
- [x] `GET /api/kpi-data/province-targets`
- [x] بارگذاری در `loadDB()` → `DB.kpiTargets` / `DB.kpiHistory`

---

## ۳. گزارشات مدیر (`manager.js` + `/api/manager-reports`)

### ارتقا
- [x] `GET /api/manager-reports/expert/:username` — week entries SQL + activity + sales
- [x] `GET /api/manager-reports/expert/:id/done-logs?from=&to=&page=`
- [x] `GET /api/manager-reports/daily?date=`
- [x] `GET /api/manager-reports/team-summary?from=&to=`
- [x] `GET /api/manager-reports/win-loss?from=&to=`
- [x] Expert report: منبع SQL، تب activity/sales
- [x] کارت win/loss در پنل مدیر
- [x] `manager_weekly_snapshots` + snapshot شنبه

---

## ۴. گزارشات مراکز

### ارتقا
- [x] `GET /api/center-reports/:key/timeline?from=&to=`
- [x] گسترش `openCenterAudit` — proforma + sales از API
- [x] دکمه «📊 گزارش مرکز» در مودال مرکز

---

## ۵. پیشفاکتور

### ارتقا
- [x] `UPDATE proformas SET status='invoiced'` پس از صدور فاکتور
- [x] `ALTER` constraint وضعیت + `invoiced`
- [x] `GET /api/proforma/stats`
- [x] ویجت آمار بالای لیست پیشفاکتور
- [x] ویجت پیشفاکتور در مودال مرکز

---

## اولویت پیاده‌سازی

| # | کار | PR |
|---|-----|-----|
| 1 | proforma invoiced + stats | این PR |
| 2 | KPI GET + loadDB | این PR |
| 3 | manager-reports + expert SQL | این PR |
| 4 | reports activity SQL + export | این PR |
| 5 | center timeline | این PR |
| 6 | weekly snapshot | این PR |

---

## Deploy

```bash
git pull && pm2 restart sales-portal
```

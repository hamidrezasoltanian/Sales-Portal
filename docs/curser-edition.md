# Cursor Edition — برنچ یکپارچه توسعه

> **`cursor/curser-edition-bd8e`** — از این به بعد همه توسعه‌ها روی این برنچ انجام می‌شود.  
> **`main`** — خط پایدار prod؛ دست نزنید تا تست و تأیید کامل شود.

## محتوای merge شده

| منبع | محتوا |
|------|--------|
| `complete-no-mtr-b0bd` | معماری entity API، slim blob، UI، proforma، WMS، pricing، RBAC |
| `workflow-module-bd8e` | persistence، MTR SQL، CRM gaps (deals/files)، workflows |
| `reports-upgrade-bd8e` | گزارشات SQL، KPI load، center timeline، proforma stats |

## Deploy (بعد از تأیید)

```bash
git fetch origin
git checkout cursor/curser-edition-bd8e
git pull origin cursor/curser-edition-bd8e
pm2 restart sales-portal
```

## تست

```bash
node tests/behavioral.test.js
node tests/persistence.test.js
```

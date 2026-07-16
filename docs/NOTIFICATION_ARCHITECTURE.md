# Notification Architecture (Click CRM)

## Separation of concerns

| Channel | Answers | Source of truth |
|---------|---------|-----------------|
| **خانه / کارتابل** (`inbox_items`) | «امروز چه کار کنم؟» | `week_entries`, `center_edits.followupDate`, `tasks`, proforma, HR, … |
| **زنگ 🔔** (`notifications`) | «چه اتفاق جدیدی افتاده؟» | Event engine — task assign, owner change, manager request, ack, … |
| **تلگرام** | بیرون از اپ | Same engine; digests default to Telegram |

Routine work (overdue / today / undated) must **not** spam the bell. It lives only in the cartable. The server sends **one combined digest** per day (Telegram; optional bell if user opts in).

## Server modules

| File | Role |
|------|------|
| `server/lib/notification-engine.js` | `emitNotification()` — severity, per-user prefs, atomic dedup, channels |
| `server/lib/notification-scheduler.js` | Cron Asia/Tehran: 08:00 morning digest, 15:00 afternoon, Sat 09:00 manager weekly |
| `server/routes/notifications.js` | REST + `/my-prefs`; uses engine on POST |
| `server/migrations/010_notification_engine.sql` | `severity`, `bucket`, `notification_fired`, `user_notification_settings` |

## Dedup

Table `notification_fired (user_id, bucket)` with TTL — atomic `INSERT … ON CONFLICT DO NOTHING`.

## Client rules

- `_setupAutoReminder` no longer fires bulk `sendNotif` (server owns digests).
- Polling every 60s only when SSE is down.
- Digest / multi-center click → `switchTab('home')` + `_cbSetFilter(...)`.
- Completing cartable work / logging an interaction → `markNotifsForCenterRead(centerKey)`.
- Bell UI sorts by severity; hint text clarifies cartable vs news.

## Disable scheduler

`NOTIF_SCHEDULER=0` in env.

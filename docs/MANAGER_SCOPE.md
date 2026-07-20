# دسترسی مراکز و اشتراک با مدیر

## مدل ساده (فعلی)

| نقش / وضعیت | رفتار |
|-------------|--------|
| **سوپر ادمین** | همه مراکز و داده‌ها |
| **مدیر با `manager_scope.global`** (پیش‌فرض) | همه مراکز |
| **مدیر با محدوده استانی** | فقط استان‌های انتخاب‌شده **به‌علاوه** مراکزی که کارشناسان با تیک اشتراک به او داده‌اند |
| **کارشناس / سایر** | مراکز خودش |
| **اشتراک با مدیر** | اگر روی پروفایل کارشناس `share_with_manager = true` و `direct_manager` پر باشد، همان دسترسی‌های مراکز آن کارشناس برای مدیر مستقیم هم باز است |

## فیلدها

- `app_users.direct_manager` — مدیر مستقیم (منبع حقیقت سلسله‌مراتب)
- `app_users.share_with_manager` — تیک «دسترسی‌ام به مدیر مستقیم هم داده شود»
- `app_users.manager_scope` — فقط برای محدود کردن مدیر سراسری به استان‌ها (اختیاری)

```json
{ "type": "global" }
{ "type": "provinces", "ids": ["tehran", "isfahan"] }
```

محدودهٔ قدیمی `{ "type": "team" }` از UI حذف شده؛ ACL آن را مثل «غیرسراسری» می‌خواند و فقط مالکیت + تیک اشتراک را اعمال می‌کند.

## UI

Settings → کاربران:

1. ستون **مدیر مستقیم**
2. ستون **اشتراک با مدیر** (چک‌باکس) → `share_with_manager`
3. 🛡 دسترسی‌ها → محدودهٔ استانی مدیر (بدون گزینه «فقط تیم»)

## SoT مدیر مستقیم

- منبع حقیقت: `app_users.direct_manager`
- Sync: users PUT → `employees.manager`؛ HR employee PUT → `app_users.direct_manager`

## مرکز بدون owner

پیش‌فرض: `CENTER_OWNERLESS_POLICY=allow`

```bash
CENTER_OWNERLESS_POLICY=deny
```

## Audit

`access_audit` برای `permissions` / `direct_manager` / `share_with_manager` / `manager_scope` / `role`.

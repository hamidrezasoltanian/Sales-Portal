-- 015_letter_indicator_yearly.sql
-- شمارنده اندیکاتور نامه بر اساس سال شمسی + شماره شروع قابل تنظیم

ALTER TABLE letter_indicators ADD COLUMN IF NOT EXISTS jalali_year INT;
ALTER TABLE letter_indicators ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ردیف‌های قدیمی: سال را خالی نگه می‌داریم تا اولین صدور سال جاری آن‌ها را claim کند

CREATE UNIQUE INDEX IF NOT EXISTS uq_letter_indicators_year_dept_type
  ON letter_indicators (jalali_year, department_prefix, letter_type)
  WHERE jalali_year IS NOT NULL;

INSERT INTO letter_settings (key, value, updated_at, updated_by)
VALUES ('indicator_start_number', '1', NOW(), 'system')
ON CONFLICT (key) DO NOTHING;

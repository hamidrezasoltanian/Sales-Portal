-- Cleanup bad week_entries created when toJalali bot function was broken
-- All entries with scheduledDate starting with '3004/' are invalid
-- Run: psql -U postgres atena_crm -f scripts/cleanup_bad_week_entries.sql

BEGIN;

-- Preview what will be deleted
SELECT key, value->>'scheduledDate' AS date, value->>'centerName' AS center, value->>'addedBy' AS added_by
FROM week_entries
WHERE value->>'scheduledDate' LIKE '3004/%';

-- Delete the bad entries
DELETE FROM week_entries WHERE value->>'scheduledDate' LIKE '3004/%';

COMMIT;

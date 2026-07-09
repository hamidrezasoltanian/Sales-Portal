-- Token invalidation on logout (H-2)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

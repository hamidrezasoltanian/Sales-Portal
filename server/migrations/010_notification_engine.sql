-- Notification engine: severity, atomic dedup, per-user prefs
-- Idempotent — safe to re-run

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_notif_severity ON notifications(severity);
CREATE INDEX IF NOT EXISTS idx_notif_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notif_bucket ON notifications(bucket);

CREATE TABLE IF NOT EXISTS notification_fired (
  user_id  TEXT NOT NULL,
  bucket   TEXT NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_notif_fired_at ON notification_fired(fired_at DESC);

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id          TEXT PRIMARY KEY,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  bell             BOOLEAN NOT NULL DEFAULT TRUE,
  telegram         BOOLEAN NOT NULL DEFAULT TRUE,
  digest_telegram  BOOLEAN NOT NULL DEFAULT TRUE,
  digest_bell      BOOLEAN NOT NULL DEFAULT FALSE,
  min_severity     TEXT NOT NULL DEFAULT 'low',
  types            JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deactivate legacy notification:* inbox copies (cartable ≠ work items only)
UPDATE inbox_items
SET active = FALSE, updated_at = NOW()
WHERE source_type = 'notification' AND active = TRUE;

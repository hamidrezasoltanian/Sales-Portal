-- Unified cartable index (event-driven materialized inbox)

CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  source_type VARCHAR(30) NOT NULL,
  source_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'owner',
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  due_at VARCHAR(12),
  priority INTEGER DEFAULT 2,
  monetary_value NUMERIC(18,2) DEFAULT 0,
  center_key TEXT,
  action VARCHAR(40) NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  snoozed_until VARCHAR(12),
  snooze_count INTEGER DEFAULT 0,
  automation_eligible BOOLEAN DEFAULT FALSE,
  deployment_mode VARCHAR(20) DEFAULT 'human-in-loop',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_owner_active ON inbox_items(owner, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inbox_visibility ON inbox_items(visibility, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inbox_source ON inbox_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inbox_due ON inbox_items(due_at) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inbox_updated ON inbox_items(updated_at DESC);

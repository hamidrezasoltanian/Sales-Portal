-- Expert targets (quota) — independent from week_entries
-- Progress is computed at read-time by JOIN/COUNT on week_entries

ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE week_entries ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(5);

CREATE INDEX IF NOT EXISTS idx_we_assignment_source ON week_entries(assignment_source);
CREATE INDEX IF NOT EXISTS idx_we_done_week ON week_entries(week_id, added_by, done);

CREATE TABLE IF NOT EXISTS expert_targets (
  id                 TEXT PRIMARY KEY,
  expert_id          TEXT NOT NULL,
  period_type        TEXT NOT NULL CHECK (period_type IN ('week', 'month')),
  period_key         TEXT NOT NULL,
  week_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_id          TEXT REFERENCES expert_targets(id) ON DELETE CASCADE,
  target_count       INT NOT NULL CHECK (target_count > 0),
  min_priority_count INT NOT NULL DEFAULT 0 CHECK (min_priority_count >= 0),
  filters            JSONB NOT NULL DEFAULT '{}'::jsonb,
  count_mode         TEXT NOT NULL DEFAULT 'done' CHECK (count_mode = 'done'),
  daily_wip_cap      INT DEFAULT 5,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('draft', 'active', 'locked', 'cancelled', 'closed')),
  note               TEXT,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS expert_targets_one_active
  ON expert_targets (expert_id, period_type, period_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_et_expert ON expert_targets(expert_id);
CREATE INDEX IF NOT EXISTS idx_et_period ON expert_targets(period_key);
CREATE INDEX IF NOT EXISTS idx_et_parent ON expert_targets(parent_id);
CREATE INDEX IF NOT EXISTS idx_et_status ON expert_targets(status);

CREATE TABLE IF NOT EXISTS expert_target_audit (
  id         BIGSERIAL PRIMARY KEY,
  target_id  TEXT NOT NULL REFERENCES expert_targets(id) ON DELETE CASCADE,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  by_user    TEXT NOT NULL,
  action     TEXT NOT NULL,
  before_val JSONB,
  after_val  JSONB
);

CREATE INDEX IF NOT EXISTS idx_eta_target ON expert_target_audit(target_id, at DESC);

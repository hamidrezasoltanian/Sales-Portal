-- Sales KPI SoT tables (also created in db.js initSchema)
CREATE TABLE IF NOT EXISTS sales_kpi_monthly (
  username            TEXT NOT NULL,
  month               TEXT NOT NULL,
  overall             INT NOT NULL DEFAULT 0,
  scores              JSONB NOT NULL DEFAULT '{}'::jsonb,
  targets             JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights_version_id  INT,
  conversion_source   TEXT,
  finalized           BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  finalized_by        TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (username, month)
);

CREATE TABLE IF NOT EXISTS kpi_weight_versions (
  id             SERIAL PRIMARY KEY,
  weights        JSONB NOT NULL,
  effective_from TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     TEXT
);

CREATE TABLE IF NOT EXISTS kpi_region_targets (
  region_key        TEXT PRIMARY KEY,
  label             TEXT,
  retention_target  INT NOT NULL DEFAULT 90,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        TEXT
);

CREATE TABLE IF NOT EXISTS kpi_config_audit (
  id         BIGSERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor      TEXT NOT NULL,
  field      TEXT NOT NULL,
  old_value  JSONB,
  new_value  JSONB,
  note       TEXT
);

ALTER TABLE kpi_user_targets ADD COLUMN IF NOT EXISTS retention_target INT;
ALTER TABLE kpi_user_targets ADD COLUMN IF NOT EXISTS region_key TEXT;

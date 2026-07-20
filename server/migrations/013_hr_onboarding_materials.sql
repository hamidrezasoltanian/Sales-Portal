-- 013_hr_onboarding_materials.sql
-- جزوه، فایل و ویدیوهای آموزشی انبوردینگ

CREATE TABLE IF NOT EXISTS hr_onboarding_materials (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('booklet', 'file', 'video')),
  title TEXT NOT NULL,
  description TEXT,
  phase_id TEXT REFERENCES hr_onboarding_phases(id) ON DELETE SET NULL,
  external_url TEXT,
  filename TEXT,
  mime_type TEXT,
  file_size INT,
  data BYTEA,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_ob_mat_kind ON hr_onboarding_materials(kind) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_ob_mat_phase ON hr_onboarding_materials(phase_id);

-- 012_hr_onboarding.sql
-- Employee onboarding checklist template + per-employee progress

CREATE TABLE IF NOT EXISTS hr_onboarding_phases (
  id TEXT PRIMARY KEY,
  phase_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  timeline TEXT,
  owner_label TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL REFERENCES hr_onboarding_phases(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  category TEXT,
  task_name TEXT NOT NULL,
  assigned_to TEXT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_hr_ob_tasks_phase ON hr_onboarding_tasks(phase_id);

CREATE TABLE IF NOT EXISTS hr_onboarding_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  employee_username TEXT NOT NULL,
  employee_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mentor_username TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_ob_assign_user ON hr_onboarding_assignments(employee_username);
CREATE INDEX IF NOT EXISTS idx_hr_ob_assign_status ON hr_onboarding_assignments(status);

CREATE TABLE IF NOT EXISTS hr_onboarding_checks (
  assignment_id TEXT NOT NULL REFERENCES hr_onboarding_assignments(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES hr_onboarding_tasks(id) ON DELETE CASCADE,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  done_by TEXT,
  note TEXT,
  PRIMARY KEY (assignment_id, task_id)
);

CREATE TABLE IF NOT EXISTS hr_onboarding_kb (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

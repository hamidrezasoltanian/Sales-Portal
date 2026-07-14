-- HR phase: contract, leave integrity, delegation, compliance stubs

ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date VARCHAR(12);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offboard_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_national_id
  ON employees (national_id) WHERE national_id IS NOT NULL AND national_id != '';

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(10);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS medical_doc_note TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS working_days_calc DECIMAL(5,2);

ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS carry_over DECIMAL(5,2) DEFAULT 0;
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS jalali_year VARCHAR(4);

CREATE TABLE IF NOT EXISTS public_holidays (
  id TEXT PRIMARY KEY,
  jalali_date VARCHAR(12) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_delegations (
  id TEXT PRIMARY KEY,
  approver TEXT NOT NULL,
  delegate_username TEXT NOT NULL,
  from_date VARCHAR(12) NOT NULL,
  to_date VARCHAR(12) NOT NULL,
  reason TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deleg_approver ON approval_delegations(approver, active);

CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  expires_at VARCHAR(12),
  file_path TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_docs ON employee_documents(employee);

CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  action_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT,
  issued_by TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_disc_emp ON disciplinary_actions(employee, active);

CREATE TABLE IF NOT EXISTS hr_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  annual_working_days INT DEFAULT 26,
  carry_over_max DECIMAL(5,2) DEFAULT 9,
  friday_off BOOLEAN DEFAULT TRUE,
  insurance_employee_pct DECIMAL(5,2) DEFAULT 7,
  tax_exempt_amount DECIMAL(15,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO hr_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS attendance_logs (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  jalali_date VARCHAR(12) NOT NULL,
  check_in TIME,
  check_out TIME,
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee, jalali_date)
);

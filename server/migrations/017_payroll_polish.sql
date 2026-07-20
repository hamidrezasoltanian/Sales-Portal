-- Off-cycle payroll corrections + HR document binary storage
CREATE TABLE IF NOT EXISTS payroll_corrections (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  original_month TEXT NOT NULL,
  apply_month TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pay_corr_apply ON payroll_corrections(apply_month, employee, status);

ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size INT;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_data BYTEA;

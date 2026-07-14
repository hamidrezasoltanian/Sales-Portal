-- Payroll engine: contracts, frozen records, monthly variables, workflow

CREATE TABLE IF NOT EXISTS employee_contracts (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  base_salary DECIMAL(15,2) DEFAULT 0,
  housing_allowance DECIMAL(15,2) DEFAULT 0,
  grocery_allowance DECIMAL(15,2) DEFAULT 0,
  child_allowance DECIMAL(15,2) DEFAULT 0,
  commission_pct DECIMAL(5,2) DEFAULT 0,
  sales_target DECIMAL(15,2) DEFAULT 0,
  start_date VARCHAR(12),
  end_date VARCHAR(12),
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_contracts ON employee_contracts(employee, active);

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'draft';
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS month_working_days DECIMAL(5,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS working_days DECIMAL(5,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS unpaid_leave_days DECIMAL(5,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS annual_leave_days DECIMAL(5,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS prorated_base DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS housing_allowance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS grocery_allowance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS child_allowance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_pay DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS bonus_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS penalty_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS advance_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS gross_pay DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS insurance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS tax DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS net_pay DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS sales_target_raw DECIMAL(15,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS sales_target_adjusted DECIMAL(15,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leave_days DECIMAL(5,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS calc_snapshot JSONB;

CREATE TABLE IF NOT EXISTS payroll_monthly_variables (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  month TEXT NOT NULL,
  var_type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  title TEXT,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_vars ON payroll_monthly_variables(employee, month, status);

CREATE TABLE IF NOT EXISTS payroll_workflow_log (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  month TEXT NOT NULL,
  from_status VARCHAR(24),
  to_status VARCHAR(24) NOT NULL,
  actor TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

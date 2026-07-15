-- Payroll compliance: versioned tax brackets, employer insurance, audit FKs

ALTER TABLE hr_settings ADD COLUMN IF NOT EXISTS insurance_employer_pct DECIMAL(5,2) DEFAULT 23;

CREATE TABLE IF NOT EXISTS tax_brackets (
  id SERIAL PRIMARY KEY,
  tax_year VARCHAR(4) NOT NULL,
  bracket_order INT NOT NULL,
  up_to_amount DECIMAL(18,2) NOT NULL,
  rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  effective_from VARCHAR(7),
  notes TEXT,
  UNIQUE(tax_year, bracket_order)
);

INSERT INTO tax_brackets (tax_year, bracket_order, up_to_amount, rate_pct, notes)
SELECT '1404', 1, 240000000, 0, 'معاف'
WHERE NOT EXISTS (SELECT 1 FROM tax_brackets WHERE tax_year = '1404' AND bracket_order = 1);
INSERT INTO tax_brackets (tax_year, bracket_order, up_to_amount, rate_pct, notes)
SELECT '1404', 2, 600000000, 10, 'پله ۱'
WHERE NOT EXISTS (SELECT 1 FROM tax_brackets WHERE tax_year = '1404' AND bracket_order = 2);
INSERT INTO tax_brackets (tax_year, bracket_order, up_to_amount, rate_pct, notes)
SELECT '1404', 3, 1200000000, 15, 'پله ۲'
WHERE NOT EXISTS (SELECT 1 FROM tax_brackets WHERE tax_year = '1404' AND bracket_order = 3);
INSERT INTO tax_brackets (tax_year, bracket_order, up_to_amount, rate_pct, notes)
SELECT '1404', 4, 999999999999999, 20, 'پله ۳'
WHERE NOT EXISTS (SELECT 1 FROM tax_brackets WHERE tax_year = '1404' AND bracket_order = 4);

ALTER TABLE payroll_monthly_variables ADD COLUMN IF NOT EXISTS disciplinary_action_id TEXT;
ALTER TABLE payroll_monthly_variables
  ADD CONSTRAINT fk_payroll_var_disciplinary
  FOREIGN KEY (disciplinary_action_id) REFERENCES disciplinary_actions(id)
  ON DELETE SET NULL;

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS insurance_employer DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS net_debt_carry DECIMAL(15,2) DEFAULT 0;

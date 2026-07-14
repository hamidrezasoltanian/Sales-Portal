-- Split salary: insurable (داخل لیست بیمه) vs non-insurable (خارج لیست)

ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS salary_insurable DECIMAL(15,2) DEFAULT 0;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS salary_non_insurable DECIMAL(15,2) DEFAULT 0;

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS salary_insurable DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS salary_non_insurable DECIMAL(15,2) DEFAULT 0;

UPDATE employee_contracts
SET salary_insurable = base_salary
WHERE (salary_insurable IS NULL OR salary_insurable = 0) AND base_salary > 0;

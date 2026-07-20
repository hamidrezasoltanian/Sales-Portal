-- 014_disciplinary_ladder.sql
-- ماده ۵ — نظام پلکانی برخورد

ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS step INT;
ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS offense_level TEXT;
ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS score_deduction NUMERIC(8,2) DEFAULT 0;
ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS bonus_cut BOOLEAN DEFAULT FALSE;
ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS legal_ref TEXT DEFAULT 'ماده ۵';
ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE disciplinary_actions SET step = CASE
  WHEN action_type IN ('verbal','verbal_warning') OR severity = 'info' THEN 1
  WHEN action_type IN ('written','written_warning') OR title ILIKE '%تذکر کتبی%' THEN 2
  WHEN action_type IN ('reprimand','written_reprimand') OR title ILIKE '%توبیخ%' THEN 3
  WHEN action_type IN ('final','final_warning') OR title ILIKE '%اخطار نهایی%' THEN 4
  WHEN action_type IN ('termination','dismiss') OR title ILIKE '%خاتم%' THEN 5
  ELSE COALESCE(step, 1)
END
WHERE step IS NULL;

CREATE INDEX IF NOT EXISTS idx_disc_step ON disciplinary_actions(employee, step) WHERE active = TRUE;

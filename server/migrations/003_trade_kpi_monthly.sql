-- Trade KPI v2: 7-dimension finalize (final_score + dimensions + targets)
ALTER TABLE trade_kpi_monthly ADD COLUMN IF NOT EXISTS final_score DECIMAL(5,2);
ALTER TABLE trade_kpi_monthly ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE trade_kpi_monthly ADD COLUMN IF NOT EXISTS targets JSONB;

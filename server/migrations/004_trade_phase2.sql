-- Phase 2: trade milestones month + warehouse WMS sync metadata
ALTER TABLE trade_milestones ADD COLUMN IF NOT EXISTS jalali_month TEXT;
ALTER TABLE trade_warehouse_rec ADD COLUMN IF NOT EXISTS wms_sku_count INT DEFAULT 0;
ALTER TABLE trade_warehouse_rec ADD COLUMN IF NOT EXISTS wms_total_qty INT DEFAULT 0;
ALTER TABLE trade_warehouse_rec ADD COLUMN IF NOT EXISTS wms_synced_at TIMESTAMPTZ;

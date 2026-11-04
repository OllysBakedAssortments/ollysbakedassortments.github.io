-- Phase 02B: planning-to-physical-inventory reference ONLY. No physical stock changes.
-- Run in production oba-orders after a D1 backup/bookmark.
CREATE TABLE IF NOT EXISTS commerce_weekly_inventory_links (
  planning_drop_id TEXT PRIMARY KEY REFERENCES commerce_weekly_drops(drop_id) ON DELETE CASCADE,
  inventory_drop_id TEXT NOT NULL UNIQUE REFERENCES inventory_drops(drop_id),
  created_by_crew_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

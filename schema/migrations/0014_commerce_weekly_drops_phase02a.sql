-- Phase 02A: production-safe weekly menu planning. No change to existing inventory, checkout, orders.
-- Apply once to oba-orders after taking a D1 backup/bookmark.
CREATE TABLE IF NOT EXISTS commerce_weekly_drops (
  drop_id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','archived')),
  sales_start_at TEXT,
  sales_end_at TEXT,
  pickup_start_date TEXT,
  pickup_end_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by_crew_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commerce_weekly_drop_products (
  drop_id TEXT NOT NULL REFERENCES commerce_weekly_drops(drop_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES commerce_products(product_id),
  online_enabled INTEGER NOT NULL DEFAULT 0 CHECK(online_enabled IN (0,1)),
  bertha_enabled INTEGER NOT NULL DEFAULT 0 CHECK(bertha_enabled IN (0,1)),
  events_enabled INTEGER NOT NULL DEFAULT 0 CHECK(events_enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(drop_id,product_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_weekly_drops_status ON commerce_weekly_drops(status,created_at);
CREATE INDEX IF NOT EXISTS idx_commerce_weekly_drop_products_product ON commerce_weekly_drop_products(product_id);

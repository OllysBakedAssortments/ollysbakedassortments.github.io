-- Phase 03D.2A - OBA production D1 migration
-- Run in oba-orders (production) BEFORE deploying worker.js.
-- Also run separately in oba-orders-staging if deploying this Worker to staging.
-- This records the price/composition of a pack hold; it does not approve charges.
CREATE TABLE IF NOT EXISTS giraffe_pack_reservation_details (
  reservation_id TEXT PRIMARY KEY NOT NULL,
  planning_drop_id TEXT NOT NULL,
  pack_size TEXT NOT NULL CHECK (pack_size IN ('lil','tall','feast')),
  pack_total_cents INTEGER NOT NULL CHECK (pack_total_cents >= 0),
  individual_total_cents INTEGER NOT NULL CHECK (individual_total_cents >= 0),
  selection_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_giraffe_pack_reservation_details_planning
  ON giraffe_pack_reservation_details(planning_drop_id);

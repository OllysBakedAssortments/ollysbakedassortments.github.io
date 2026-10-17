-- STAGING ONLY: execute in oba-orders-staging, never oba-orders.
-- Product identity, classification and individual pricing; no mutation of inventory/orders.
CREATE TABLE IF NOT EXISTS commerce_products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'unclassified' CHECK(classification IN ('unclassified','regular','specialty')),
  unit_price_cents INTEGER CHECK(unit_price_cents IS NULL OR unit_price_cents BETWEEN 0 AND 10000),
  unit_price_approved INTEGER NOT NULL DEFAULT 0 CHECK(unit_price_approved IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (unit_price_approved=0 OR (unit_price_cents IS NOT NULL AND classification != 'unclassified'))
);
INSERT OR IGNORE INTO commerce_products (product_id,name) VALUES
 ('salted-caramel-bliss','Salted Caramel Bliss'),
 ('brown-butter-bliss','Brown Butter Bliss'),
 ('biscoff-lava-crunch','Biscoff Lava Crunch'),
 ('campfire-crunch','Campfire Crunch'),
 ('peanut-campfire-crunch','Peanut Campfire Crunch'),
 ('plain-jane','Plain Jane');

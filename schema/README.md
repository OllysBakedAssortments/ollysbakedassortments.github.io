# Phase 03D.1B — Database

No D1 schema changes or SQL migrations. Existing tables used read-only: commerce_weekly_drops, commerce_weekly_inventory_links, commerce_weekly_drop_products, commerce_products, inventory_drops, inventory_items, inventory_allocations, inventory_locations, cart_reservations, cart_reservation_items.

The new combined-cart route is read-only. No inventory ledger mutations, holds, payments, or order rows are created.

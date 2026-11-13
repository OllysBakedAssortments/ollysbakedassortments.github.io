# Phase 03A — Giraffe Pack Studio

No SQL migration required. This phase reads existing `commerce_products`, `commerce_weekly_drops`, `commerce_weekly_drop_products`, `commerce_weekly_inventory_links`, `inventory_items`, `inventory_allocations`, `inventory_locations`, and active cart reservations. No D1 writes are added.

Deploy the merged production Worker first, then `crew/products.html`. This is a Crew-only preview; it does not approve prices, publish products, reserve cookies, or change checkout.

# OBA Phase 02B — Weekly Menu ⇄ Physical Inventory Link

## Current baseline
Phase 02A is already deployed and a production weekly menu called **November Test Drop** has been saved with three selected flavors. This package builds directly on the **Phase 02A** Worker and Products page, not the earlier stale GitHub ZIP snapshot.

## Changed files only
- `oba-checkout/worker.js` — two Crew-authenticated endpoints for linking and reading existing inventory.
- `crew/products.html` — Inventory connection section inside Weekly Drops.
- `schema/migrations/0015_commerce_weekly_inventory_link_phase02b.sql` — one mapping table.

## What it does
- Allow a saved, non-archived weekly menu to be linked to exactly one existing `inventory_drops` record. An inventory drop cannot be linked to two weekly menus.
- Read existing `inventory_items`, `inventory_allocations`, `inventory_locations`, and live (non-expired) `cart_reservations` and `cart_reservation_items`, reporting results for the selected flavors.
- Show stock quantities separated into physical, sold, reserved, and locations.
- Link/unlink requires BOTH `products.manage` and `inventory.manage` permission. Reading requires `inventory.view`.
- Linking uses server-side Origin checks and the existing Crew cookie/session validation.
- Stock must be created, adjusted, and transferred in the **existing Inventory interface**. No new stock write endpoint is introduced.

## Not yet implemented
- The weekly menu does not create inventory items automatically or allocate stock.
- The link does not activate customer ordering, storefront sync, pricing, Giraffe Packs, or change reservation behavior.
- `Ready` remains planning-only.
- Online `available` (allocation minus holds) is not used by customer checkout from this page.

## Deployment
1. **Production D1 backup/bookmark** for `oba-orders`.
2. In **production** `oba-orders` D1 Console run `schema/migrations/0015_commerce_weekly_inventory_link_phase02b.sql`. This creates only the `commerce_weekly_inventory_links` table and does not edit existing tables. D1 foreign-key enforcement is retained.
3. Compare active `oba-checkout` Worker with `oba-checkout/worker.js` in the ZIP before replacing. Preserve any changes made since Phase 02A deployed and the currently active deployment as rollback. Deploy the reconciled Worker with the existing `OBA_DB` → `oba-orders` binding and other secrets/routes unchanged.
4. Upload `crew/products.html` to GitHub (the normal website repository). No other Crew pages need edits.
5. Sign into the Crew account, open `Crew → Products → Weekly Drops`, select `November Test Drop`. In **Inventory connection**, choose an existing physical drop if one exists. Click **Save inventory link** and **Refresh stock snapshot**.
6. If there is no existing production inventory drop, leave unlinked until Crew creates the physical drop through the existing Inventory flow. Do not seed synthetic inventory in production.

## Quick verification
- The weekly menu still has three selected flavors and remains Draft.
- Inventory connection shows options from `inventory_drops`; it does not show `inventory_drops` if that table is absent (backend error will say inventory unavailable).
- A linked physical drop shows stock rows only for the selected flavors. Products not yet stocked say `No stock record`.
- Refresh and link/unlink do not change any values in `inventory_items`, `inventory_allocations`, or `cart_reservations`.
- Test unauthenticated GET and POST => 401. Crew without correct permission => 403.

## SQL to verify the new mapping
```sql
SELECT planning_drop_id, inventory_drop_id, created_at
FROM commerce_weekly_inventory_links;
```

## Why this scope
In OBA's existing architecture a weekly menu (`commerce_weekly_drops`) decides which flavors/channels are planned; `inventory_drops` and allocation/reservation records are the authoritative physical stock. Direct stock mutations will be integrated through already-protected Inventory services in the next increment, not duplicated here.

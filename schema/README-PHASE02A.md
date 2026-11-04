# OBA Phase 02A — Weekly Drop Manager (Planning Only)

Updated files only:

- `schema/migrations/0014_commerce_weekly_drops_phase02a.sql` — 2 NEW tables and 2 indexes, no existing table modifications.
- `oba-checkout/worker.js` — adds authenticated Crew GET `/crew/weekly-drops` and POST `/crew/weekly-drops/save`.
- `crew/products.html` — replaces Weekly Drops placeholder with usable editor and listings.

## IMPORTANT: Limits

This is a weekly **planning** feature, not live storefront publishing. Drop statuses are `draft`, `ready` (ready for later integration), `archived`. Selecting a flavor or a channel does **not** allocate inventory, approve checkout pricing, publish products, configure pickups, or affect orders. The existing `inventory_drops` and related reservations are untouched.

## Deploy — production

1. Preserve currently active production Worker version as a rollback point; compare it with the ZIP's `oba-checkout/worker.js` before replacing the live Worker. **Do not overwrite a newer live checkout implementation.**
2. Back up or bookmark **`oba-orders`** (not staging). In D1 Console execute the SQL from the migration file (each complete statement, or all four in a batch).
3. Deploy the updated `oba-checkout/worker.js` to `oba-checkout` only after verifying the live Worker baseline and the `OBA_DB` binding continues to point to `oba-orders`.
4. Deploy `crew/products.html` to GitHub at the same path.
5. Sign in as a Crew user with `products.manage`; open Products > Weekly Drops. Create a test draft with a single flavor, save, refresh; check it persists; archive the test draft.
6. Verify existing Crew Products catalog, existing inventory and live ordering continue working. If the Worker deployment causes an issue, roll back to the prior active Worker version.

## Security/validation

Existing Crew session and RBAC functions are used. Writes require `products.manage` and an allowlisted Origin. Product selections must exist in the active cookie catalog. Saves use D1 batch operations to replace the draft flavor assignment set, with foreign keys. No new public or customer ordering endpoints.

## Design follow-up

Phase 02B should link a selected weekly menu to existing inventory_drops and allocation tables. Do not use `reference_availability` as current inventory; do not treat `ready` as published to customers. Add concurrency handling before multiple staff edit the same drop simultaneously.

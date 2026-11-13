# OBA Phase 03B — Atomic Giraffe Pack Reservation Acceptance (Staging Only)

## Scope
- Three **full-sized** packs only: Lil (3/$10), Tall (6/$18), Feast (13/$40). Bag 'o' Chips is excluded.
- +$1 per Specialty cookie according to `commerce_products.classification`. **Prices are provisional** until catalog pricing approvals are reconciled.
- New staging-only endpoint `/__giraffe-pack-reservation` supports `action=hold` or `action=release` for authenticated Crew users holding `products.manage`.
- New staging browser acceptance page: `/__giraffe-pack-test`.
- Uses the SAME `cart_reservations` and `cart_reservation_items` plus existing D1 Online-allocation triggers as individual cookie carts. Atomic `OBA_DB.batch` ensures no partial mixed-pack hold.
- Test holds expire in 2 minutes, can be released by exact reservation+cart IDs, and cannot bind to Square from this route.
- No customer-facing builder, production Worker, inventory allocation change, payment/checkout integration, or new SQL migration.

## Install
1. Open Cloudflare Workers > **`oba-checkout-staging`**, NOT production.
2. Preserve the active staging version; compare it with `oba-checkout/staging/worker.js` in this ZIP and reconcile changes before deploying. Do not replace an unrelated newer Worker wholesale.
3. Keep staging Worker bound to `oba-orders-staging` only.
4. Open `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__patch1b` to authenticate as a synthetic staging Crew Owner.
5. Open `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__giraffe-pack-test` and attempt a Lil pack hold.

## Test behavior
- The page defaults to 3 Plain Jane cookies against `stage-00c-test`. If staging Online stock is below three, HTTP 409 is a correct guarded rejection. **Do not manufacture real production stock to make a test pass.**
- To test a successful hold, use synthetic staging inventory with enough Online stock and a classified staging catalog product, then release the hold from the page.
- For multi-flavor tests, POST a JSON body from the staging domain to the same endpoint, e.g. `{ "action":"hold", "inventoryDropId":"STAGING_DROP_ID", "size":"lil", "items":[{"productId":"plain-jane","quantity":1},{"productId":"brown-butter-bliss","quantity":2}] }`. All products must have inventory items in the chosen staging drop.
- Backend returns `provisionalTotalCents` but cannot authorize checkout. A successful staging hold is not a purchase.

## No SQL
No migration is needed. See `schema/README.md`.

## Next release gate
Before enabling real Giraffe Pack reservations, reconcile full-sized catalog pricing approvals and weekly-menu eligibility, integrate the exact pack composition into authoritative checkout snapshots and Square totals, and run multi-cart contention, expiry, release, renewal, and paid-order reconciliation tests. Simply deploying this stage-only endpoint does not authorize production pack sales.

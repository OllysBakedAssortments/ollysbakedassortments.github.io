# OBA 00C — STAGING-ONLY engineering candidate

**Do not deploy to production or migrate production D1.** This is a targeted first implementation increment, **not** a certified payment or stock-accounting release.

## Included changed files

- `oba-checkout/worker.js` — production-source variant, NOT for production deployment yet
- `oba-checkout/staging/worker.js` — staging-source variant; preserves its independent differences
- `schema/migrations/0009_online_allocation_reservation_guard.sql` — additive online stock reservation triggers
- `tests/test_online_reservations.py`, `tests/test_checkout_conversion.py` — local SQLite smoke tests

## Changes

1. Public `/inventory` availability reports active **online allocation less unexpired active holds**.
2. Reservation availability preflight uses online allocation rather than total unsold stock.
3. SQLite triggers atomically block reservation INSERT/UPDATE over online allocation.
4. Both payment conversion paths decrement online allocation, insert an online `sale` movement, increase global sold count, then convert the active reservation in one D1 batch. The sale movement uses SQLite `changes()` to abort if the preceding allocation decrement matched no row. These statements are designed to roll back as a unit on D1 batch failure.
5. Location `quantity_sold` is **not incremented** in 00C: the existing schema has `CHECK(quantity_sold <= quantity_allocated)` and changing its meaning safely requires a separate table migration and a fully reconciled reporting contract. Location sales should instead be interpreted from `inventory_movements` until the later migration.

## Checks performed locally

- `node --check` on each Worker source
- SQLite reservation trigger create/update/exhaustion/release smoke tests
- SQLite one-sale / duplicate-conversion rollback smoke test

## Unresolved release blockers

- **Transfers and waste/adjustment paths** must be audited and prevented from moving stock already covered by active online reservations. This package does not fully fix these routes.
- Full Workers / real D1 batch runtime / webhook concurrency / Square sandbox recovery acceptance tests have **not** run.
- Public API still exposes global `total` and `sold` alongside online-scoped `available`; frontend consumer semantics must be verified.
- `inventory_allocations.quantity_sold` historical values/meaning require a follow-up migration, not arbitrary updates.
- Persistent orders/fulfillment records, Giraffe Pack contracts, and product catalog are separate future milestones.
- There are still no end-to-end tests for paid reservation edge cases, refund flows, or Crew dashboard compatibility.
- Cloudflare production Worker / staging Worker may have changed since ZIP export. Compare deployed hashes before deploying.

## Safe procedure (when ready)

1. Export production D1 schema and data backup; clone/import to isolated staging D1 and verify contents.
2. Apply `0009_online_allocation_reservation_guard.sql` to **staging D1 only**, after verifying prior migration history and D1 compatibility.
3. Deploy only the changed `oba-checkout/staging/worker.js` to a staging Worker binding that points exclusively to staging D1 and Square Sandbox.
4. Run scripted reservation concurrency and payment idempotency tests; verify full D1 `batch` rollback behavior.
5. Fix outstanding stock movement paths and add reliable automated end-to-end acceptance tests.
6. Prepare production migration rehearsal and explicit rollback/restore plan before any production release.

**No deployment or D1 write has been performed by this package's author.**

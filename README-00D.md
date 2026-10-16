# OBA Package 00D — Staging candidate: Crew online-hold movement guard

**Not production-ready.** This package contains only a new D1 trigger and a local SQLite test. No Worker files are changed or redeployed.

## What it enforces

The existing `/inventory/transfer` and `/inventory/adjust` Worker handlers use D1 `batch()` operations: first reducing source `inventory_allocations.quantity_allocated`, then inserting a corresponding `inventory_movements` record. This trigger checks the **remaining** online allocation immediately before that Crew movement is inserted. If it is below the sum of unexpired active reservations for the flavor, the trigger aborts the batch with `online_inventory_reserved` and rolls back the decrement. It recognizes `reference_type='crew_inventory_transfer'` and `reference_type='crew_inventory_adjustment'` and leaves Square `reference_type='square_order'` alone.

**This does not enforce reductions directly made without a matching Crew movement** (e.g., direct SQL updates, atypical Worker routes), and it does not yet cover disabling/archiving online allocations/locations, checkout/webhook concurrency, or end-to-end Square payment reliability. The Worker currently returns a generic HTTP 409 for these failed Crew batches, not a customer-facing specialized message. Those cases require a follow-up implementation and tests.

## Prerequisites

1. Confirm Cloudflare **D1 > `oba-orders-staging`** at the top of the page. Never use `oba-orders` for this candidate.
2. Verify both 0009 triggers are present: `oba_reservation_online_guard_insert` and `oba_reservation_online_guard_update`.
3. Make a staging recovery bookmark with D1 Time Travel.
4. Confirm staging `/inventory` still shows the expected isolated test drop. Avoid touching real customer data.

## Deployment (browser-only)

In **D1 > oba-orders-staging > Console**, paste the **entire one `CREATE TRIGGER ... END;`** statement from `schema/migrations/0010_crew_online_hold_movement_guard.sql` and Execute. Do not paste the README or execute on production.

Verify:

```sql
SELECT name, sql FROM sqlite_master
WHERE type='trigger' AND name='oba_crew_online_hold_movement_guard';
```

It should return exactly one trigger. If the Console says `No SQL statements detected`, stop and report the result. Do not infer it was applied.

## Test locally (optional; browser-only users can skip)

`python3 tests/test_00d_sqlite.py`

Local tests cover trigger behavior and SQLite transaction rollback, not deployed Cloudflare D1 or Worker APIs.

## After installing

We can run a controlled, staging-only test using a new active two-cookie reservation and then a Crew-style `batch()` stock transfer (not an unguarded direct D1 update). Since the staging Worker currently allows public GET `/inventory` but retains Patch 1B restrictions on most other routes, we will need a narrowly controlled test harness or staging Crew endpoint before asserting a full Worker integration pass.

## Rollback (staging only)

```sql
DROP TRIGGER IF EXISTS oba_crew_online_hold_movement_guard;
```

Don't run rollback unless instructed. Keeping this isolated lets us test it independently of the rest of the 00C safeguards.

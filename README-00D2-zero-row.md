# OBA 00D.2 — Zero-row allocation guard (staging only)

## Scope
Only `oba-checkout/staging/worker.js` is changed. Baseline: the merged 00D.2 staging Worker (includes GET /inventory exemption).

## Changes
- `/inventory/transfer`: immediately after conditional source allocation UPDATE, records the transfer using `CASE WHEN changes() = 1 THEN inventory_item_id ELSE NULL END` *before* destination credit. A zero-row source deduction must abort the D1 batch via `inventory_movements.inventory_item_id` NOT NULL constraint.
- `/inventory/adjust`: for waste and negative corrections, records the movement immediately after conditional allocation UPDATE, before master inventory UPDATE, with the same changes() guard. Positive corrections continue to record movement after their normal updates.
- Retains the patched staging route gate and existing Square code.

## Important preflight
In staging D1 Console, verify `inventory_movements.inventory_item_id` is NOT NULL:
`PRAGMA table_info(inventory_movements);`
If `notnull` for `inventory_item_id` is not 1, STOP: this guard is not appropriate for the deployed schema.

## Deployment
1. Keep native production checkout closed; do not deploy to production.
2. Backup/Time Travel bookmark staging D1.
3. Replace `oba-checkout-staging` code with `oba-checkout/staging/worker.js`, then deploy.
4. Verify GET https://oba-checkout-staging.ollysbakedassortments.workers.dev/inventory still returns expected JSON.
5. The Patch 1B staging route gate still blocks Crew transfer/adjust API routes. Do not interpret the GET smoke test as full integration coverage. Next work package should expose protected Crew routes for authenticated staging integration tests and verify affected-row semantics against D1.

## Local validation
- `node --check` passed.
- SQLite mini-transaction tests passed for successful/failed transfer and waste cases.
- The local tests are illustrative: not exact staging D1/Worker integration tests, and do not prove original schema is identical.

## Risks / follow-up
- Confirm original schema constraints and the full D1 batch atomic rollback behavior on staging.
- Test transfer/adjust endpoint with real authenticated Crew session and simultaneous holds.
- Affected-row safeguards for *other* write paths, including positive adjustment and Square conversion, should be audited separately.
- No schema migration included in this update.

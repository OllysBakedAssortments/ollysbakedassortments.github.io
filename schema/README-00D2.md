# OBA 00D.2 — Crew allocation integrity (STAGING ONLY)

## Important
Do NOT apply this package to production `oba-orders` or replace the production Worker. This staging candidate updates only `oba-checkout-staging`, and replaces the defective 00D movement trigger that was manually installed in `oba-orders-staging`.

## Reason
The staging Crew transfer and negative-adjustment handlers reduce `inventory_allocations.quantity_allocated` before recording the movement. The previously corrected 00D trigger subtracted `NEW.quantity` again, blocking some valid transfers. This migration checks the post-update allocation. The Worker additionally makes each Crew deduction conditional on the current *unreserved* online stock (inside the SQL UPDATE).

## Browser-only staging deployment
1. Create a staging D1 Time Travel recovery bookmark.
2. Open `schema/migrations/0011_crew_online_hold_guard_post_update.sql`. In D1 `oba-orders-staging` Console, execute the `DROP TRIGGER` statement separately, followed by the **entire** `CREATE TRIGGER` statement. Do not run in production.
3. Open Cloudflare Workers & Pages > `oba-checkout-staging` > Edit code. Paste the contents of `oba-checkout/staging/worker.js`; deploy staging only.
4. Verify the trigger: `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name='oba_crew_online_hold_movement_guard';`
5. Staging acceptance tests: (a) with 5 online and 2 held, transfer 3 via Crew API succeeds; (b) next transfer 1 fails; (c) after release another transfer 1 succeeds; (d) negative adjustment rejects held quantity; (e) failed batch leaves allocation and movement unchanged.

## Tested locally
`node --check oba-checkout/staging/worker.js` passed.
`python tests/test_00d2_sqlite.py` passed (SQLite behavioral regression). These tests do NOT exercise Cloudflare D1 Worker batches or Square payments.

## Known outstanding blockers
- These Crew guards cover the two affected Worker paths, NOT arbitrary direct writes to `inventory_allocations`, all status/activation changes, or other stock-changing routes.
- A conditional SQL UPDATE can affect zero rows when stock is concurrently committed. Test the full D1 batch for this case: its later statements must not create an incorrect movement; add definitive affected-row enforcement before release.
- Paid Square order and webhook conversion, reservation lifecycle, concurrent carts, and production price/order reconciliation still require staging integration testing.
- `0010` in the older delivered ZIP is **superseded** by this replacement trigger; update the repository's migration history accordingly. Do not rerun the obsolete 0010 after this migration.
- Staging routes may be disabled by the Patch 1B allowlist. Enable tested Crew routes deliberately, not wholesale.

## Package contents
- `oba-checkout/staging/worker.js`: targeted source change based on last uploaded repository.
- `schema/migrations/0011_crew_online_hold_guard_post_update.sql`: staging replacement trigger.
- `tests/test_00d2_sqlite.py`: local regression tests.
- This README.

# OBA 00C — staging inventory route access

Changed file: `oba-checkout/staging/worker.js` ONLY.

Deploy this file to the `oba-checkout-staging` Worker in Cloudflare. Do NOT deploy it to the production `oba-checkout` Worker. Existing production code and both D1 databases are unchanged by this ZIP.

What changed: The Patch 1B staging gate permits only `GET /inventory` in addition to its existing allowed routes. POST/PUT/DELETE `/inventory` remain blocked; all other restricted routes remain blocked.

Caveat: `GET /inventory` runs a DB UPDATE that marks expired reservation statuses before returning inventory, per the pre-existing implementation. This affects staging D1 records (never production through the verified staging binding).

Verification:
1. Confirm `oba-checkout-staging` binding `OBA_DB` points to `oba-orders-staging`.
2. Deploy ONLY the modified staging Worker.
3. Visit `https://oba-checkout-staging.ollysbakedassortments.workers.dev/inventory`. Expect JSON with `ok:true`, `drop.dropId:"stage-00c-test"`, and `items` containing Plain Jane with `available:2` (assuming test data unchanged).
4. Visit staging Worker root `/` and verify the Patch 1B disabled response still appears.
5. Do not enable live checkout. Separate tests of Crew stock movement, payment conversion, and reservation API are still needed.

Source ZIP supplied by user this turn; syntax checked with `node --check`.

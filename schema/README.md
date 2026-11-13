# Phase 03B — staging reservation route gate fix

**Target:** Cloudflare Worker `oba-checkout-staging` only. Its existing D1 binding must remain `oba-orders-staging`.

**SQL migration:** None. Do not run SQL in production or staging for this fix.

**Change:** The existing Patch 1B allowed-paths set now includes only `/__giraffe-pack-reservation` in addition to its earlier entries. This permits requests to reach the already-implemented Phase 03B handler. All other Patch 1B blocked routes remain blocked. The Phase 03B handler still requires the staging hostname, same-origin POST, an authenticated Crew session, and `products.manage` permission.

**Verification:** Sign in at `/__patch1b`, visit `/__giraffe-pack-test`, and use the built-in 3 Plain Jane hold test against `stage-00c-test`. A 409 inventory conflict is expected if the staging Online allocation remains below 3. For 409, verify no active reservation items were left by this failed attempt before continuing to successful-hold tests.

**Rollback:** Restore the prior version of `oba-checkout-staging`. No schema rollback is required.

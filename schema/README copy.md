# Phase 03D.4B — Square location agreement safeguard

Source: user's November 13, 2026 GitHub ZIP.

Changes:
- `oba-checkout/worker.js`: `/storefront/payment-readiness` optionally accepts the public `locationId` query parameter. It now returns `locationMatches` and refuses readiness (`ready:false`, `reason:square_location_mismatch`) if the requested Square location differs from the Worker `SQUARE_LOCATION_ID` binding.
- `order.html`: uses the browser's actual `SQUARE_LOCATION_ID` in the readiness check, and requires `locationMatches === true` before card tokenization.

## Deployment
1. Compare/merge `oba-checkout/worker.js` with the *actual live* Cloudflare Worker (do not overwrite newer live edits); deploy the Worker first, preserving all bindings.
2. Open `/storefront/payment-readiness?locationId=LAAH6E0FFSPV7`. Expect `ready:true` AND `locationMatches:true` if Cloudflare's `SQUARE_LOCATION_ID` matches the storefront value.
3. Open `/storefront/payment-readiness?locationId=NOT_A_REAL_LOCATION`. Expect `ready:false`, `reason:square_location_mismatch`.
4. Replace `order.html` in GitHub, and test that the Square Sandbox card fields still initialize.
5. Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled pending sandbox end-to-end payment and reconciliation testing.

This is **not** a proof that the access token works with Square or that a payment succeeds. To validate token connectivity, use the existing `/square-test` route and check that it returns the expected Square location. Avoid sharing Square credentials. A `ready:true` response without `locationId` keeps backward-compatible behavior.

No SQL migrations. The remaining payment code still targets Square Sandbox. No transaction was executed by this package.

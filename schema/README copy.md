# OBA Cookies — Phase 03D.3 Pre-activation audit & messaging fix

Source: latest uploaded ollysbakedassortments.github.io-main.zip (November 13, 2026).

## Files to update (GitHub only)
- js/cart.js
- js/giraffe-pack-builder.js

## Change
Corrected stale, customer-visible text claiming Giraffe Packs are permanently not purchasable, despite the feature-gated reservation and checkout integration. Copy now accurately distinguishes draft/quote vs live inventory hold and directs customers through the existing checkout authorization gate. No payment, inventory, API, schema, or feature flag logic changed.

## Verified static code path
1. Builder quotes via `/storefront/giraffe-packs/quote` and stores a preview.
2. Shared cart preflight uses `/storefront/giraffe-packs/cart-plan`.
3. Continue to Checkout checks `/storefront/giraffe-packs/checkout-status` and calls `/storefront/giraffe-packs/cart-hold`.
4. The Worker writes `giraffe_pack_reservation_details` together with cart reservation records via `OBA_DB.batch`.
5. Checkout checks held pack snapshot, validates combined inventory and uses one pack Square line with server-priced amount.
6. `ENABLE_GIRAFFE_PACK_CHECKOUT` gate remains OFF unless explicitly set to string `true`.

## Activation blockers / testing requirements
- **Both** `order.html` and the Worker use Square SANDBOX: `sandbox.web.squarecdn.com`, sandbox application ID, `connect.squareupsandbox.com/v2/orders` and `/v2/payments`. Setting the feature flag alone is NOT production payment activation.
- Verify the Worker version running at Cloudflare matches this repository and has D1 bindings plus the verified `giraffe_pack_reservation_details` table and reservation guard triggers.
- Approve/publish current week's flavor catalog, set weekly drop ready and ensure matching physical inventory drop is active with Online allocations.
- Exercise sandbox end-to-end with: pack-only Lil, mixed pack + individual cookies, specialty surcharge, shortage, concurrent holds, expiry, failed Square payment, duplicate retry, and completed payment vs inventory settlement.
- Separately configure and test production Square application ID, location ID, token, SDK host, API host and webhook/reconciliation strategy before ever accepting real payment. Do not simply replace Sandbox domains without configuration review.
- Feature flag OFF until all checks are confirmed.

## Validation
`node --check js/cart.js` and `node --check js/giraffe-pack-builder.js` succeeded. No live payment or browser test was performed. No SQL or Worker deployment required for these text-only changes.

# Phase 03D.2C — Pack checkout activation boundary and reservation bridge

Source: latest uploaded GitHub repository ZIP, Nov 13 2026.

## Changed files
- oba-checkout/worker.js — GET /storefront/giraffe-packs/checkout-status exposes only an enablement boolean; POST /storefront/giraffe-packs/cart-hold refuses new holds unless ENABLE_GIRAFFE_PACK_CHECKOUT=true.
- js/cart.js — exposes packCheckoutReady() and reservePendingPack() on OBA_CART. The method checks enablement, releases an old ordinary-cookie hold, creates the combined atomic hold, updates client reservation state, attempts to restore legacy hold on errors, and rejects changed-cart responses.

## Deployment and limits
Deploy Worker first, after comparing to current live Worker; then deploy js/cart.js via GitHub. Keep ENABLE_GIRAFFE_PACK_CHECKOUT unset/false. This package does **not** wire the new reservation bridge into order.html payment UI: no pack payment can occur via current frontend. A subsequent coordinated frontend change must render authoritative combined totals, invoke reservePendingPack() and protect the hold, avoid ordinary-cart resync, and only then activate the Worker flag after end-to-end testing. Do not switch the flag on based only on this package.

No D1 schema migration. The already-created giraffe_pack_reservation_details table remains required. Ordinary-cookie checkout unchanged.

## Validation
node --check worker.js and cart.js performed successfully. No Cloudflare or Square integration testing performed.

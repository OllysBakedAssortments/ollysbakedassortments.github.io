# Phase 03D.2D — Customer Giraffe Pack checkout controls

## Changed files
- `order.html` — bridge the existing Continue to Checkout control to `OBA_CART.reservePendingPack()`, display held pack pricing in the order summary, verify pack checkout enablement and active reservation before Square tokenization, and handle pack-only batches.
- `js/cart.js` — allow checkout-protection requests for pack-only batches when an existing pack reservation is active (server remains authoritative).
- `schema/README.md` — schema status.

## Deployment
Upload `order.html` and `js/cart.js` at the repository root paths shown above. Do NOT replace the Worker or run SQL for this patch.

## Important safeguards / outstanding requirements
- `ENABLE_GIRAFFE_PACK_CHECKOUT` must remain disabled until controlled end-to-end checkout tests pass. With the flag disabled, packs remain unpurchasable by design; individual-cookie checkout is intended to remain unchanged.
- This is code integration only. No browser end-to-end test, Cloudflare deployment verification, or Square payment verification was performed.
- The current `order.html` uses Square **sandbox** Web Payments credentials, so production Square environment alignment and live checkout readiness require separate review before the feature is enabled.
- The server remains authoritative for pack total and the selected flavors. No client-provided pack amount is sent in the checkout payload.
- Reservations do not persist as trusted client state across refreshes; customer must obtain a new hold.
- If a pack is removed after a hold, the existing expiration and reservation lifecycle still govern cleanup. Further lifecycle and concurrency verification is required before activation.

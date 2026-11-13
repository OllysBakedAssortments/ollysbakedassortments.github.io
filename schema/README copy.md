# OBA Phase 03D.1B — Combined Batch Server Preflight

Source: the latest uploaded `ollysbakedassortments.github.io-main.zip` in this conversation.

## Replace / merge
- `oba-checkout/worker.js` — adds POST `/storefront/giraffe-packs/cart-plan`.
- `js/cart.js` — adds a **Check full batch price & stock** control beneath a pending Giraffe Pack preview.

## Scope
- Validates one Giraffe Pack against saved weekly menu, eligible published/approved cookie flavors, active linked inventory drop.
- Rejects physical drop mismatch with the legacy checkout's current active physical drop.
- Merges individual-cookie quantities with pack quantities for a single available-stock calculation, avoiding double-counting flavors.
- Excludes the current cart's existing cookie hold from active third-party holds when a valid cart ID is supplied.
- Computes subtotal on Worker only; does not trust local prices, reserve new pack stock, create a payment, or authorize checkout.
- Existing `/cart-reservation`, `/checkout`, Square hooks, and normal individual-cookie payment behavior are unchanged.

## Deployment sequence
1. Keep a copy of the active production Worker. Merge rather than overwrite if Cloudflare contains more recent changes than uploaded GitHub ZIP.
2. Deploy the `worker.js` change to Cloudflare `oba-checkout` with existing bindings.
3. Deploy `js/cart.js` in GitHub.
4. Open ordering page with a pending pack; click **Check full batch price & stock**. A ready/approved/active weekly menu is required. If absent, expect a safe error.
5. Confirm individual-cookie checkout and reservation still work unchanged.

## Limitations
This is a *preflight* step, not Phase 03D.2 paid integration. The actual checkout contract must add grouped pack lines, atomic reservation writes, server-authored Square line items, and payment reconciliation before enabling purchases. Do not remove existing pending-pack checkout guard.

JavaScript parse checks: `node --check oba-checkout/worker.js` and `node --check js/cart.js` passed locally. No production deployments or live API calls were performed.

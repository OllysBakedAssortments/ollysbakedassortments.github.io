# Phase 03D.0 — Giraffe Pack saved drafts (customer site)

Source: the latest user-uploaded `ollysbakedassortments.github.io-main.zip` (Nov 13, 2026).

Replace the 3 included files in the corresponding GitHub repository paths.

- `order.html`: Adds Save Pack Draft, saved-draft summary and Remove Saved Draft controls.
- `js/giraffe-pack-builder.js`: Only enables saving after a successful server quote with `available: true`; restores valid selections when the same weekly drop is still offered; handles invalid/stale drafts fail-closed; never puts a draft into the shared cart.
- `css/giraffe-pack-builder.css`: Styling for saved draft summary.

No changes to Worker, D1, individual-cookie cart, or Square checkout. No schema migration.

## Validation (locally)
`node --check js/giraffe-pack-builder.js` passes.
The new frontend depends on deployed production `/storefront/giraffe-packs/menu` and `/storefront/giraffe-packs/quote` routes from Phase 03C.1. No live API verification performed.

## Checkout boundary
This is NOT a purchasable pack. Saved selections use `localStorage` (key `oba-giraffe-pack-draft-v1`), and do not establish stock holds, prices, or fulfillment commitments. Price and inventory must be revalidated when a future real checkout integration is built.

## Next substantial backend phase
Update `/cart-reservation` and `/checkout` as one coordinated change to accept explicit pack-group composition, calculate pack prices server-side, reserve ingredients atomically alongside individual cookies, and use the same verified server total when creating Square orders. Current endpoints accept flat individual items and cannot safely charge pack prices.

# OBA Cookies — Phase 03D.1A: Shared Batch Pack Preview

Source: user-uploaded `ollysbakedassortments.github.io-main.zip` (November 13, 2026).

## Changed files
- `js/cart.js` — adds a separately persisted pending Giraffe Pack preview to the shared cart drawer, with remove control; preserves existing cookie cart items and reservation payloads.
- `js/giraffe-pack-builder.js` — adds an Add to Batch Preview action after a valid pack quote.
- `order.html` — adds the button and a checkout guard against silently ignoring the pending pack.
- `css/giraffe-pack-builder.css` — styles the pending pack preview.

## Important
This is **not paid pack checkout**. Pack preview is intentionally excluded from subtotal, existing cookie reservation payloads and Square API requests. A pending preview blocks the individual-cookie checkout button until it is removed, so customers are not accidentally charged for a partial order. The pack still needs production Worker atomic reservations, server-authoritative pricing, order line model, payment capture mapping and fulfillment data before paid checkout may be enabled. Do not characterize this feature as ready for customers to purchase packs.

## Install
Replace only the four changed website files in GitHub. No SQL migration, Worker deployment, or staging-test change. Existing CSS is loaded in `order.html`; the pack preview styling currently applies on that page.

## Checks
`node --check js/cart.js` and `node --check js/giraffe-pack-builder.js` passed. Not live-deployed or browser-tested.

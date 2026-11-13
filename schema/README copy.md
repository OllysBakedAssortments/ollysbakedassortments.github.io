# OBA Phase 03C.2 — Customer-facing Giraffe Pack Builder (quote-only)

## Install sequence
1. Back up the currently deployed `oba-checkout` Worker code in Cloudflare. **Merge** `oba-checkout/worker.js` with the current deployment; do not overwrite newer Cloudflare-only changes.
2. Deploy the merged `oba-checkout/worker.js` to the **production** Worker `oba-checkout`, retaining current D1 binding, secrets, routes, and environment settings.
3. Open `https://api.ollysbakedassortments.com/storefront/giraffe-packs/menu` and confirm JSON `ok: true`. An empty `products` list is expected until a ready menu has approved published flavors.
4. Upload `order.html`, `js/giraffe-pack-builder.js`, and `css/giraffe-pack-builder.css` to the same paths in the GitHub Pages repository. Ensure all three land in the same deploy.
5. Load the public `order.html`, inspect the builder, and confirm individual-cookie ordering and current Square checkout still work.

## What changed
- Production Worker: GET `/storefront/giraffe-packs/menu` now auto-discovers the newest ready weekly menu linked to an active inventory drop when no `planningDropId` is provided. Only explicitly Online-enabled, published, approved, active full-size cookies are shown. An empty ready menu produces a safe empty result.
- `order.html`: replaced the old outbound “Build A Pack” CTA with the in-page builder. Existing cart/checkout sections are unchanged.
- New CSS/JS: pack size, flavors, increment/decrement, specialty pricing estimate, read-only server quote, empty/unavailable states, and mobile layout.

## IMPORTANT: checkout intentionally NOT activated
This phase performs **read-only quote previews**. The builder does not call `OBA_CART.add`, create a reservation, change inventory, create a Square payment, or offer a fake checkout action. A later phase must implement server-authoritative mixed-flavor holds and pack line items in both cart reservation and checkout, preserving the existing individual-cookie path.

## Readiness requirements
A weekly planning menu must be `ready`, linked to an `active` physical inventory drop, and have Online-enabled full-size products with `published=1`, `unit_price_approved=1`, `status='active'`, `product_kind='cookie'`, and `classification` regular/specialty. No D1 mutations or SQL migrations occur in this package.

## Test checklist
- Menu endpoint returns 200 JSON with `ok:true`; no menu => empty state
- Order page shows no broken errors when no menu is approved
- With approved menu: three pack sizes (3/$10, 6/$18, 13/$40)
- Minus cannot go below zero, plus cannot exceed capacity, changing size clears selection
- Specialty estimate adds $1 per specialty cookie
- Quote button enabled only when exactly the pack capacity is selected
- Quote uses Worker API; unavailable stock shown as unavailable, not added to checkout
- Existing single-cookie cart, countdown, fulfillment, payment flow unaffected

## Files
`oba-checkout/worker.js`, `order.html`, `js/giraffe-pack-builder.js`, `css/giraffe-pack-builder.css`, `schema/README.md`, `README.md`.

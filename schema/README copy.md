# Phase 03C — Production Worker read-only Giraffe Pack quote

**Target:** `oba-checkout` production Worker source file, *not* `oba-checkout-staging`.

Source baseline: `/oba-checkout/worker.js` from the latest provided GitHub repository ZIP. The single addition is a `POST /storefront/giraffe-packs/quote` route just before the existing Crew Giraffe Pack preview route. All other Worker code is unchanged relative to this baseline; however, compare against the currently deployed Worker before deployment, because any Cloudflare dashboard edits since the repository snapshot may be missing from that snapshot.

## Contract
POST JSON from `https://ollysbakedassortments.com`:

```json
{"planningDropId":"wd-UUID","size":"lil","items":[{"productId":"plain-jane","quantity":2},{"productId":"campfire-crunch","quantity":1}]}
```

Supported sizes: `lil` = 3/$10, `tall` = 6/$18, `feast` = 13/$40. Specialty surcharge +$1 per selected Specialty cookie. Bag 'o' Chips intentionally excluded.

Read-only, no holds or payments. Fails closed unless weekly menu `ready`, linked inventory drop exists, every flavor is Online-enabled, published, active, a cookie, correctly classified and **unit price approved**. Snapshot availability is *not* a guarantee of future availability, nor checkout authorization.

## Important limitations
- Does not modify existing customer cart, existing checkout routes, Square handling, or reservation logic.
- Does not automatically publish weekly menus or approve prices.
- Requires existing production D1 tables already used by the Crew Products page. No migration.
- For a fully customer-usable flow, further work must securely connect quote -> atomic cart hold -> checkout finalization with idempotent reconciliation and original cart/checkout compatibility.
- This is a **source package**, not deployed or live-tested. Do not deploy over more recent production Worker edits without reconciling them. Backup/rollback available in Cloudflare deployments.

## Quick acceptance checks after deployment
1. Existing `GET /crew/products` still works with Crew authentication.
2. From storefront origin, invalid pack selection returns HTTP 400; draft/nonlinked menu returns 409.
3. A qualifying published, approved and ready menu returns read-only quote with proper $1 Specialty surcharge.
4. No reservation, movement, order or payment is inserted by the quote route.

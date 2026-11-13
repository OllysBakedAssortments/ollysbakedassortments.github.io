# Phase 03C.1 — Production Worker Pack Quote Fix + Read-only Menu

## Files to change
- `oba-checkout/worker.js` only.

## Changes
- Repairs Online stock calculation in `POST /storefront/giraffe-packs/quote` by joining `inventory_locations` and selecting `location_type='online'`. The former code incorrectly matched numeric `location_id` against the string `'online'` and subtracted the legacy `inventory_allocations.quantity_sold` field.
- Only ready weekly drops with an **active** linked physical inventory drop can be quoted.
- Adds `GET /storefront/giraffe-packs/menu?planningDropId=wd-<UUID>` to expose only published, price-approved, online-enabled, active full-sized cookies for a ready, active inventory drop.
- Returns pack sizes Lil (3/$10), Tall (6/$18), Feast (13/$40), $1 Specialty surcharge. Bag o' Chips excluded.
- No reservation, payment, checkout, inventory change, or database migration.

## Production deployment
1. In Cloudflare, save the currently active `oba-checkout` Worker as rollback baseline.
2. Confirm the repository Worker still matches the active Worker; merge these two route changes if live code is newer. Do not replace newer checkout logic.
3. Deploy the changed Worker to `oba-checkout`; preserve all bindings.
4. Validate `GET /storefront/giraffe-packs/menu?planningDropId=<id>` for a ready+active menu. Draft menus must return 409.
5. For an eligible menu, POST a full pack composition to `/storefront/giraffe-packs/quote` with `{ "planningDropId": "wd-...", "size": "lil", "items": [{"productId":"...","quantity":3}] }` from the website origin. The request is read-only.

## Note
Production catalog currently has 0 published products and 0 price approvals in last confirmed state, so storefront menu will be empty and quote will reject them until approval. Do not auto-approve or publish them. This change does **not** make the customer builder orderable. Checkout reservation and order composition still require a later integration.

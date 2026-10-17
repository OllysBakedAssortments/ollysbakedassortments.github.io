# OBA 00D.2 — Staging Crew inventory route verification

## Contents
- oba-checkout/staging/worker.js (complete staging Worker with all existing inventory, zero-row, and /inventory changes preserved)

## Change
The Patch 1B staging path gate additionally allows /inventory/transfer and /inventory/adjust; these handlers are POST-only, require the staging Origin, a valid Crew session, and inventory.transfer / inventory.adjust permission respectively. Payment, checkout, and other protected routes remain blocked.

## Browser-only deployment
1. Confirm Cloudflare Worker is oba-checkout-staging and D1 OBA_DB points to oba-orders-staging.
2. In Cloudflare > Workers > oba-checkout-staging > Edit code, replace code with the included worker.js and deploy. Never deploy this file to oba-checkout production. No D1 migration is needed.
3. Confirm GET https://oba-checkout-staging.ollysbakedassortments.workers.dev/inventory returns ok:true.
4. Opening transfer/adjust via browser GET must return 405 (not 404), confirming their route is available but not freely callable.
5. POST integration requires authentication using the staging same-origin and an authorized Crew session. Do not test destructive requests without prepared staging test data and a Time Travel bookmark.

## Outstanding safety work
- Validate Crew transfer/adjust through actual authenticated staging requests and confirm atomic rollback when conditional source deduction changes zero rows.
- Confirm simultaneous reservations / payment conversion and webhook behavior separately.
- Staging test database contains fabricated inventory only; production is not approved.

# Phase 01G — Native Crew Catalog integration

Created from the most recently uploaded GitHub ZIP. Updated files only.

## Contents
- `oba-checkout/staging/worker.js` — matching Crew-authorized endpoints for preproduction validation.
- `oba-checkout/worker.js` — production endpoints (DO NOT DEPLOY UNTIL production D1 has been migrated and backed up).
- `crew/products.html` — uses existing Crew API and session. No staging popup.

## Safety and deployment
1. Deploy the staging Worker to **oba-checkout-staging** bound exclusively to **oba-orders-staging**. No SQL required in staging, since its 27-product schema already exists.
2. Verify: unauthenticated GET `/crew/products` returns 401; a signed-in synthetic Owner on staging can GET it; test unauthorized POST (403) and authorized metadata save (200) with read-back. Be mindful staging sessions are separate from production. Test staging from its own origin, not by forwarding production cookies.
3. Back up production D1 **oba-orders** and inspect its `PRAGMA table_info(commerce_products);`. Stage/apply the tested catalog migration and product import to production; do not blindly run `ALTER TABLE` if any column already exists. Production catalog data is not yet verified.
4. Deploy `oba-checkout/worker.js` only after migration, binding check, auth checks, and a code diff against the currently deployed production Worker. This package is based on the uploaded ZIP, not a live deployed-worker export.
5. Deploy `crew/products.html` to the GitHub site only after production endpoints work, then check Crew sign-in, read, authorized save, refresh, and unauthorized write rejection.

**No production changes are made by downloading this package.** No changes to checkout, order, payment, reservation, or inventory logic were intended. Existing Crew permissions `products.view` and `products.manage` are reused. Metadata updates do not change checkout pricing or stock.

## Important
The staging D1 data in prior screenshots is real for staging only. Do not assume production has the same 27 records. This package does not include a blindly executable production migration because existing production schema must be inspected first.

# Phase 01B — STAGING ONLY

## Order of deployment (Cloudflare dashboard, no terminal)
1. Cloudflare D1 > **oba-orders-staging** > Console: paste and execute `schema/migrations/0012_staging_commerce_products_phase01b.sql` in individual statements if needed. NEVER run in production `oba-orders`.
2. Workers & Pages > **oba-checkout-staging** > Edit code: replace Worker with `oba-checkout/staging/worker.js` from this package; deploy.
3. On staging origin, sign in through `/__patch1b`, then visit `/__catalog-admin`.
4. Classify each cookie Regular/Specialty; set and approve its individual unit price only after verifying business rules.
5. Verify `/catalog` gives `schemaVersion:2`, pack upcharge `100`, `checkoutIntegrationEnabled:false`.

## Scope
- All six existing product identities seeded as **unclassified**; prices NULL and unapproved deliberately.
- Lil $10, Tall $18, Feast $40; Specialty **+$1 per selected cookie**, approved based on business confirmation. Pack total formula: basePriceCents + specialtyQuantity * 100. Enforce pack size and constituent stock in later checkout implementation.
- Owner-only writes via `/crew/catalog/product` with strict same-origin check and existing Crew session.
- No edits to production Worker, GitHub storefront, `order.html`, Adventure pages or D1 production.
- Existing checkout STILL uses `COOKIE_CATALOG` legacy pricing; this package does not authorize payments or imply production readiness.
- Staging snapshot chooses most recent active drop; multiple concurrent drops will need explicit selection before storefront integration.
- Review manual prices and choose classification per product; never infer Specialty from name/legacy price.

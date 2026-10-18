# OBA Phase 01C — Master Product Catalog (STAGING ONLY)

## Files
- `schema/migrations/0013_staging_full_product_catalog_phase01c.sql`: 16 additive ALTERs, 27 product records, two indexes and a count query.
- `oba-checkout/staging/worker.js`: staging-only merged full Worker with read-only expanded catalog and Owner-only metadata editor.

## Deployment sequence
1. Confirm this is `oba-orders-staging`, **not production**. Back up staging database.
2. Run the SQL statements in order in Cloudflare D1 Console. D1 supports only one statement at a time in the console. **Run once only**: ALTER TABLE ADD COLUMN isn't idempotent. Skip an ALTER only if that named column already exists.
3. Verify count query returns **27**, assuming no other products were added manually.
4. Deploy `oba-checkout/staging/worker.js` to `oba-checkout-staging` only, replacing the entire staging script.
5. Open `/__products-admin`; sign in via `/__patch1b` if needed. `/catalog` now includes expanded fields.

## Design choices
- Import keeps the original ID, editorial types, all descriptions, reference price, image path, priority, date, and reference availability.
- Spreadsheet's historical Available/Unavailable is stored only in `reference_availability`; product `status` remains active, `published=0`, and drop inventory stays untouched.
- Existing six product classifications/prices and approvals are NOT overwritten. New products receive a **provisional** classification and reference price but `unit_price_approved=0`. All existing prices must be verified before checkout integration.
- `Safari Snacks` is imported as product_kind `treat`, not eligible for cookie pack composition.
- Ingredients/allergens remain empty if omitted in the source. Do not auto-generate.
- No new customer checkout, live storefront, payment, or inventory integrations are activated.
- Original staging catalog pricing editor remains at `/__catalog-admin`; new metadata editor is `/__products-admin`.

## Next
Connect weekly-drop product selection and pack composition to published eligible cookie products only. Implement actual server-side price authority, stock reservation and Square payment flow in separate staging phases.

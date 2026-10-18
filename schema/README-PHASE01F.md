# Phase 01F — Products native metadata editor (STAGING)

## Files changed
- `crew/products.html` — native metadata editing panel, staging Owner connection, searchable catalog retained.
- `oba-checkout/staging/worker.js` — adds only GET `/__crew-catalog-bridge` secure opener bridge; existing Owner-authenticated POST `/crew/catalog/metadata` remains the only metadata write endpoint.

## Deploy (stage first)
1. Back up Cloudflare `oba-checkout-staging`. Deploy the supplied Worker to **staging Worker only** (D1 binding `oba-orders-staging`). No SQL.
2. Apply the supplied `crew/products.html` to a **preview/staging deployment** first; confirm site authentication and no regression in catalog browsing. Then merge this frontend change as planned. Do not deploy the Worker to production.
3. Sign in on the Crew website, open Products → Catalog, select Brown Butter Bliss → Edit selected metadata.
4. Click **Connect staging Owner** (browser opens a staging Worker popup). If not authenticated, click the staging sign-in link in that popup, then return to popup and click **Verify Owner session**.
5. In website tab, change Featured Priority from 6 to 7, Save, confirm response and refreshed data; restore 6 and save. Keep popup open while editing.

## Security boundaries
- The Crew website never receives the staging session cookie; the bridge popup sends same-origin credentialed requests to the staging Worker.
- Cross-window messages use fixed website/Worker origin allowlists and `window.opener`/`event.source` checks with per-tab random nonce.
- The Worker continues enforcing existing Owner role and staging Origin on every write. Browser-side confirmation required for each save.
- Bridge supports **metadata only** (including staging publication flag). Classification, checkout approval, unit prices, inventory, payments, weekly drops, pack configuration NOT editable through the bridge.
- Staging GET `/catalog` still includes drafts and is accessible from two whitelisted website origins. Do not put private data in public catalog content.

## Not yet delivered
- Unified authentication for production; no authorization change to production Crew backend.
- Product creation, images uploads, automated storefront publication/sync, Weekly Drops, pack builder, checkout wiring.

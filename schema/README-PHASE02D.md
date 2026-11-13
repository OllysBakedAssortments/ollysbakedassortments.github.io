# OBA Phase 02D — Weekly Drop Stock Preparation & Allocation

## Contents (updated files only)
- `oba-checkout/worker.js`: adds Owner/Crew-gated `POST /crew/weekly-drops/inventory/prepare`, plus `inventoryItemId` to the stock snapshot. This new endpoint only initializes missing zero-quantity inventory items for a linked **draft** inventory drop. It changes no quantities, sales, reservations, or checkout routes.
- `crew/products.html`: adds **Prepare selected flavors (zero stock)**, plus per-flavor **+ Baked** and **Transfer** actions. These call the **existing** protected `/inventory/baked` and `/inventory/transfer` routes and use the existing inventory ledger and online reservation safeguards.

## Production deployment
1. Confirm Cloudflare `oba-checkout` active deployment code matches the ZIP source baseline, or merge these changes into the actual live Worker. Save a rollback version. Do NOT blindly overwrite a newer live Worker.
2. Confirm Worker D1 binding remains `oba-orders`. No SQL migration is required by this phase.
3. Deploy reconciled Worker to `oba-checkout` and replace `crew/products.html` in the GitHub Pages repository.
4. Sign in with a Crew role that has `products.manage`, `inventory.manage`, `inventory.add_baked`, and `inventory.transfer`. Open Products → Weekly Drops → the saved November Test Drop.
5. The linked `November Test Drop (draft)` inventory exists. Click **Prepare selected flavors (zero stock)**. A snapshot refresh should show zero-stock inventory records with `+ Baked` and `Transfer` controls.
6. Only after baking real cookies, enter the correct count and choose an appropriate **Kitchen** location, then **+ Baked**. Use **Transfer** to move allocated physical cookies to Online, Bertha, or Events. The existing routes reject invalid/overdrawn operations.

## Critical constraints
- Phase 02D preparation never invents quantities or activates customer checkout. Actual **+ Baked** and **Transfer** operations DO change real physical inventory and must reflect real actions. The November Test Drop shown in the screenshots is a test menu: don't enter fake physical cookies on production.
- Only select an existing linked **draft** inventory drop; preparation rejects archived menus and non-draft inventory drops.
- The preparation endpoint inspects the deployed D1 `inventory_items` table and **fails closed** if required columns do not match expectations; it does not perform schema migrations.
- Drops may be independently changed in Crew Inventory; refresh the stock snapshot before adjusting more stock.
- No Giraffe Pack purchasing, sales activation, or live storefront integration is enabled here.

## Local validation
- `node --check` Worker and inline HTML JS passed.
- SQLite idempotency smoke test: three inventory records created once with zero stock and remained unchanged on repeat.
- Browser, auth permission denials and concurrency tests still require deployment validation, particularly before actual stock operations.

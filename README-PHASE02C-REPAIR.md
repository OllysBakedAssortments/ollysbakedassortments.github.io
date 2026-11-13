# Phase 02C repair — audited against uploaded repository ZIP

Changed files only:
- `oba-checkout/worker.js` — adds authenticated `POST /crew/weekly-drops/inventory/create-draft`
- `crew/products.html` — adds `+ Create draft inventory drop` action to Weekly Drops

Database: NO new migration. Uses `inventory_drops` and `commerce_weekly_inventory_links` from existing implementation. The handler checks the live `inventory_drops` table columns and fails closed if extra required columns are present.

Safety: Requires Crew session, `products.manage` and `inventory.manage`, same-origin allowlist, and saved non-archived weekly menu. Uses one D1 transactional `batch` to insert an EMPTY `draft` physical inventory drop and its unique planning link. Existing stock, active drops, allocations, holds, checkout, and orders are not modified.

Deploy: Backup active production Worker version and compare it with ZIP's `oba-checkout/worker.js` before applying, because production Worker also processes live orders. Deploy Worker first; only then replace `crew/products.html` on GitHub. No SQL.

Validate: Select saved November Test Drop, click Create draft inventory drop and confirm; it should link a new draft. Do not link the active September inventory drop. Test in browser; no live deployment performed by author.

Caution: This package is based on the uploaded GitHub ZIP, not a verified byte-for-byte snapshot of the currently active production Worker. If Cloudflare has newer edits, merge the route rather than replacing the whole Worker. JS syntax checks passed locally; D1 integration is not yet browser-verified.

# OBA Cookies — Phase 03D.4N (settlement evidence)

## Purpose
Corrects false positive inventory shortfall in the read-only Crew reconciliation report after an order has already converted. A successful sale reduces Online allocation, so comparing the sold quantity to *remaining* stock is incorrect. The new check uses `inventory_movements` with `movement_type='sale'`, `reference_type='square_order'`, and the authoritative `square_order_id` to verify sold quantities.

## Changed files
- `oba-checkout/worker.js` — update `GET /crew/checkout-reconciliation` to verify sold movement quantities and checkout status.
- `crew/orders.html` — show per-cookie settlement evidence and status consistency in Exceptions.
- `schema/README.md` — migration note.

## Deploy
1. Preserve the current live Worker for rollback and merge this `worker.js` with any newer live edits. Deploy the Worker first.
2. Upload `crew/orders.html` to GitHub.
3. Log in to Crew > Orders > Exceptions. Load the $4 completed attempt `368786e8-66ad-4ed0-accf-086efeafb0b8` and the older $23 exception `09a1fbef-de8d-4ab1-8fa0-d9f0f6c9d910`.
4. The $4 order should show **one matched Plain Jane sale movement** if the Worker logged it, a consistent checkout status, and no review required. The $23 case should remain unresolved and require review. If the movement doesn't exist, leave the case flagged; inspect why.

## Safety
- Read-only report and UI only. No stock mutations, no payments, no Square calls, no SQL migration.
- Leave `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.
- A matching sale movement and converted status establish strong evidence, but fully proving no historic duplicate payment still requires payment idempotency checks.

## Validation
- `node --check` passed on Worker and Crew inline JavaScript.
- Local SQLite settlement report checks covered converted success, stale checkout status, paid-but-unconverted failure, and duplicated sale-movement detection.
- No remote deployment or live browser test has been performed.

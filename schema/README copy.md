# Phase 03D.4I — Paid checkout exception journal

## Changes
- `oba-checkout/worker.js`: adds authenticated `/crew/checkout-recovery-journal` GET/POST.
- `crew/orders.html`: makes Orders → Exceptions a working investigation and manual audit-note UI using the existing 03D.4H read-only report.

## Dependencies
- Phase 03D.4H `/crew/checkout-reconciliation` already deployed.
- Existing `crew_security_events` table and Crew authentication/permissions.
- NO SQL migration.

## Deployment
1. Preserve the existing deployed Worker version, compare/merge newer edits, deploy updated Worker first with existing bindings unchanged.
2. Update `crew/orders.html` on GitHub.
3. Sign in to Crew and open `crew/orders.html` → Exceptions; enter the Checkout Attempt ID from the Sandbox test (`09a1fbef-de8d-4ab1-8fa0-d9f0f6c9d910`).
4. Test read access; use a non-financial 'Investigation in progress' note. Confirm it persists on refresh.
5. Confirm an unauthenticated POST is rejected and users without `inventory.adjust` cannot submit notes.

## Safety boundary
- This is an auditable manual exception journal, NOT automatic inventory reconciliation.
- `GET` requires `inventory.view`; `POST` requires `inventory.adjust`, active Crew session, allowed origin, and valid note/action/request UUID.
- POST only INSERT OR IGNORE into existing `crew_security_events` with idempotency key; no Square calls and no changes to checkout_attempts, cart_reservations, inventory or Square payments.
- 'Refund verified externally' or 'Fulfillment verified externally' are **human attestations only**, not refund/fulfillment operations. They do not change payment/checkout/reservation statuses.
- Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.

## Recovery of existing $23 Sandbox exception
This code **does not** automatically fix the existing `payment COMPLETED / reservation expired / inventory not converted` order. Review and document the cause; any corrective stock movement must be separately authorized and ledger-safe, and any refund must be completed in Square then verified. The next phase can add a guarded reconciliation operation after financial outcome is decided.

## Checks
- `node --check oba-checkout/worker.js`
- browser script syntax checked independently.
- No live Cloudflare/Square testing performed by this package build.

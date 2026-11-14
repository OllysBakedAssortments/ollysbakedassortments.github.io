# OBA Cookies — Phase 03D.4J: Verified External Case Resolution

## Scope
Adds Owner-only case closure for already-paid, unreconciled checkouts. It does not call Square, refund, change checkout status, change reservation status, deduct or invent inventory, or solve stock settlement. Keep ENABLE_GIRAFFE_PACK_CHECKOUT disabled.

## Files to upload
- `oba-checkout/worker.js` — main production Worker, preserve any newer currently deployed changes when merging.
- `crew/orders.html` — Crew Orders Exceptions tab.
- `schema/README.md` — notes, not a migration.

Deploy Worker first, then the web page. No SQL migration.

## API
- `GET /crew/checkout-resolution?checkoutAttemptId=<UUID>` — read-only; requires `inventory.view`.
- `POST /crew/checkout-resolution` — requires Crew session, allowed website Origin, `inventory.adjust`, Owner role. JSON:
  - `checkoutAttemptId` UUID
  - `action`: `refund_verified_externally`, `fulfillment_verified_externally`, `sandbox_test_closed`
  - `externalReference`: 4–180 characters, independently verified
  - `evidence`: 20–1500 characters
  - `confirmation`: literal `CLOSE WITHOUT INVENTORY CHANGES`
- `sandbox_test_closed` is allowed only if Worker `SQUARE_ENVIRONMENT` is Sandbox.
- One immutable resolution per checkout attempt is enforced by `crew_security_events.event_id` uniqueness. Audited crew identity and timestamp.
- Duplicate attempts to close return 409. Other attempts cannot change an existing closure.

## Verification
1. Logged-out GET returns 401.
2. Authenticated GET for existing Sandbox checkout `09a1fbef-de8d-4ab1-8fa0-d9f0f6c9d910` returns `resolved:false` (until closed).
3. Only Owner can submit a verified Sandbox closure. Enter the actual Square payment ID as reference; never claim a refund or physical fulfillment that did not happen.
4. GET reports closure with `inventoryConverted:false`; checkout/payment/stock stay untouched.
5. Repeat POST must return 409; reload should show same resolution.
6. Existing review journal remains independent of final resolution.

## Operational limitation
This is external-resolution recordkeeping ONLY. It is not a paid-inventory conversion path. The previously paid $23 Sandbox transaction remains without sold stock in D1; closing the Sandbox test can document that outcome but cannot fix quantities. The separate inventory-settlement path requires verified stock and conditional/idempotent conversion and has NOT been enabled here.

## Checks performed
`node --check` on Worker and extracted inline Crew scripts; ZIP integrity. No live endpoint, browser or Square transaction checks were performed.

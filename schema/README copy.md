# Phase 03D.4H — Paid checkout reconciliation report

Only code change: `oba-checkout/worker.js` adds `GET /crew/checkout-reconciliation`.

This endpoint requires an authenticated Crew session with `inventory.view`; it does not mutate D1 or contact Square. It accepts **exactly one** of `checkoutAttemptId` or `squareOrderId` as a query parameter, and returns stored checkout status, associated reservation status, per-flavor online availability, shortfalls and matching Square webhook processing results.

Examples (after deployment, with an authenticated Crew session):
`https://api.ollysbakedassortments.com/crew/checkout-reconciliation?checkoutAttemptId=09a1fbef-de8d-4ab1-8fa0-d9f0f6c9d910`

The existing $23 Sandbox payment remains paid but unreconciled. This report is not a recovery action and does not establish stock available at the moment the payment was made. Inventory may have changed since then. Never run a second charge to repair it.

## Deployment
1. Compare this `worker.js` against Cloudflare's currently deployed `oba-checkout` code. Preserve any newer live edits.
2. Deploy to the existing Worker with the same bindings. Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.
3. Sign in with a Crew account that has `inventory.view` and request the endpoint. An unauthenticated request must yield HTTP 401.
4. Confirm the known checkout shows `paymentCompleted: true`, `inventoryConverted: false`, and `reviewRequired: true` (assuming the D1 state has not subsequently changed).

No SQL migrations. No frontend files. No automatic retry or settlement of old payment. Future recovery must be tied to the existing Square payment ID and perform an idempotent, audited adjustment or refund workflow only after staff verifies the actual inventory state.

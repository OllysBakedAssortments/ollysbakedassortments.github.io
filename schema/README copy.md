# Phase 03D.4O — Pack acceptance readiness (read-only)

Adds `GET /crew/giraffe-packs/acceptance-readiness` to the main Worker. Requires an authenticated Crew session with `inventory.view`. No D1 migration, stock changes, Square operations, payment attempts, or checkout activation.

## Deploy

Compare `oba-checkout/worker.js` against the **current deployed Worker** before merging. The uploaded repository may lag deployed edits; do not overwrite them. Deploy merged Worker only.

## Test

From an authorized Crew browser session, request:
`https://api.ollysbakedassortments.com/crew/giraffe-packs/acceptance-readiness`

An unauthenticated request should return 401. Authenticated Crew requests receive all weekly drop candidates, per-flavor stock, classification/publication blockers, and the active individual-cookie checkout drop. A draft weekly drop, unapproved flavor, or insufficient Online stock correctly fails the readiness conditions.

**This does not permit Giraffe Pack payment.** Leave `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled on production. Do not turn it on to run a publicly accessible Sandbox payment. Test true payment path only in a separate isolated Sandbox-bound deployment after the drop and pricing blockers are resolved.

No SQL migration. Existing $23 paid-but-unreconciled Sandbox case remains separate.

# OBA Phase 03D.4G — Payment versus inventory settlement tracking

## Changes
- Square `COMPLETED` is now recorded as `payment_completed_inventory_pending` until the matching inventory reservation is verified `converted`.
- On verified conversion (direct checkout or webhook), `checkout_status` is set to `completed`.
- Known webhook reconciliation failures and direct-conversion failures set `checkout_status = inventory_reconciliation_failed` while preserving the `payment_status = COMPLETED` record. This is crucial: do **not** initiate a second payment.
- Retry responses for already-paid attempts include inventoryReconciled/inventoryReviewRequired; checkout success response includes these flags as well.

## Deployment
1. Back up the currently deployed Worker. Diff/merge newer deployed edits; do not replace live code blindly.
2. Confirm production D1 `oba-orders` already has Online INSERT and UPDATE reservation guards (verified in conversation).
3. Deploy ONLY `oba-checkout/worker.js`; retain existing D1, Square secrets and feature flags.
4. Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.
5. Verify a **new** insufficient Online inventory hold is rejected before attempting payment. Then verify a controlled eligible Sandbox purchase transitions checkout_attempts from payment pending to completed and converts the reservation.
6. Review existing paid-but-unreconciled order independently. This patch deliberately does not alter historical orders or manufacture inventory.

## Caveat
This is a payment state visibility / reconciliation integrity fix, not a repair for the historical $23 paid Sandbox order. The transaction remains a manual reconciliation case until stock movements and Square order state can be verified together. The existing live checkout and payment flow should be tested before expanding usage.

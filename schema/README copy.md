# Phase 03D.4M — Checkout status synchronization fix

## Root cause and fix

The Square `payment.updated` webhook wrote `payment_completed_inventory_pending` unconditionally for COMPLETED payments, even if the matching inventory reservation had already been converted. Concurrent or later webhook executions could therefore downgrade `checkout_attempts.checkout_status` from `completed` to pending.

The Worker patch changes only that webhook `UPDATE checkout_attempts` statement:
- It never downgrades a `completed` checkout.
- It reports `completed` for a completed Square payment when its matching reservation is already `converted`.
- It preserves `inventory_reconciliation_failed` unless conversion is now verified.
- It preserves `COMPLETED` payment status on later webhook messages.
- It does not charge Square, convert reservations, or change inventory.

## Deployment

1. Back up the currently deployed Worker version for rollback.
2. Compare `oba-checkout/worker.js` with the live Cloudflare `oba-checkout` Worker and merge newer live edits; do not blindly overwrite them.
3. Deploy the merged Worker to the production environment while keeping `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.
4. Review the checkout record of the November 19 $4 Sandbox payment before and after any separate one-time administrative status repair.

No schema migration is needed.

## One-time $4 Sandbox checkout status repair (optional; do NOT run as a migration)

This conditional statement only updates the already-paid checkout to completed if its exact linked reservation is *already converted*. It does not touch Square or inventory. Run **only after** confirming the ID is correct, the existing sold counters, and the transaction's record in D1. The SQL is also provided directly in chat, as requested.

```sql
UPDATE checkout_attempts
SET checkout_status = 'completed', updated_at = CURRENT_TIMESTAMP
WHERE checkout_attempt_id = '368786e8-66ad-4ed0-accf-086efeafb0b8'
  AND payment_status = 'COMPLETED'
  AND checkout_status = 'payment_completed_inventory_pending'
  AND EXISTS (
    SELECT 1 FROM cart_reservations r
    WHERE r.checkout_attempt_id = checkout_attempts.checkout_attempt_id
      AND r.square_order_id = checkout_attempts.square_order_id
      AND r.status = 'converted'
  );
```

Then check the same checkout and reservation via SELECT. Never apply this to the $23 Sandbox exception, whose reservation expired and inventory reconciliation failed.

## Validation

`node --check` passed. Five isolated SQLite transition tests passed: converted→completed; completed stays completed; active remains pending; failed remains failed; later noncompleted notification does not downgrade a completed payment. These are local checks, **not** live Cloudflare or Square tests.

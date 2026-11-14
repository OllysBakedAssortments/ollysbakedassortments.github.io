No SQL migration is needed for Phase 03D.4G. The confirmed production triggers are unchanged.

Read-only review for paid but unsettled attempts:

SELECT checkout_attempt_id, square_order_id, square_payment_id, payment_status, checkout_status, updated_at
FROM checkout_attempts
WHERE payment_status = 'COMPLETED'
ORDER BY updated_at DESC LIMIT 25;

Do not alter `checkout_attempts`, `cart_reservations`, or `inventory_allocations` manually to resolve the historical payment.

# Phase 03D.4K — Settlement eligibility (read-only)

Updated files: `oba-checkout/worker.js`, `crew/orders.html`.

This is a controlled **preflight**, not automatic settlement. It prevents unsafe restoration of an expired paid reservation and checks payment, existing case closure, Online allocations, competing active holds, physical stock and original drop membership.

Deploy the Worker first, then the Crew Orders page. Preserve any newer deployed changes. Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled. No D1 migration is needed. There are **no recovery writes** in this release.

Crew endpoint: `GET /crew/checkout-settlement-preflight?checkoutAttemptId=<UUID>` (authenticated; `inventory.view`).

Expected for the November $23 Sandbox case: `paymentConfirmed=true`, `reservationStatus=expired`, `stockSufficient=false`, `automaticRecoveryEnabled=false`, `settlementExecuted=false`, and blockers.

**Next engineering gate:** inspect actual production trigger definitions that govern allocation underflow and paid reservation status conversion, and build/validate an explicitly authorized, idempotent transaction routine before allowing any settlement write. Never charge Square twice or force expired reservations back to active.

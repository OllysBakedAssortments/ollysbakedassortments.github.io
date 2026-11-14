# Phase 03D.4E — Production Online-stock payment safety gate

Source: user-uploaded repository ZIP from November 13, 2026. **Not deployed.**

## Findings (grounded in user-provided production D1 evidence)

- Square Sandbox payment COMPLETED for $23, checkout attempt completed.
- Reservation `93954866-f639-4c42-b829-8e7556fd27dd` remained active.
- Square webhook reconciliation failed twice; no corresponding sale movements.
- The three reserved flavors required Online stock of 2 Plain Jane, 2 Peanut Campfire Crunch, 1 Campfire Crunch, but Online allocation showed 1, 0, 0.
- Repository's `schema/migrations/0009_online_allocation_reservation_guard.sql` explicitly says **staging-only**. Verify whether equivalent triggers exist in production; do not assume they do.

## Code change

1. New individual-cookie reservations perform an explicit Online-stock and active-hold availability check before attempting their atomic D1 insert batch. This is defense-in-depth only, NOT race-proof without database triggers.
2. Just before any Square payment request, checkout verifies exact reservation ingredients, remaining Online stock and total live active holds for those flavors. Shortages return HTTP 409; database read errors return HTTP 503. In both cases no `/v2/payments` request is made.
3. Existing webhook conversion and Square payment code unchanged, Giraffe Pack flag remains off. Existing paid order is NOT silently modified.

## IMPORTANT limits and next steps

- Before production deployment, compare with currently deployed worker.js to avoid overwriting newer changes. Maintain a rollback version.
- **Do not reprocess existing paid order through an arbitrary SQL UPDATE or replay webhooks** until stock discrepancy and accounting are resolved. Its original payment is still successful.
- The patch does not fix concurrent reservation races, because the underlying production database Online-stock insertion/update guards are unverified. The guard migration supplied in earlier source was staging-only. Inspect production trigger names using:
  SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%reservation%';
- A real safe release requires production D1 reservation triggers (after staging validation), webhook reconciliation and idempotency acceptance tests, and a staff-alert/recovery procedure for paid-unreconciled orders.
- No SQL migration included: do not apply staging-only migrations to production without reconciliation and validation.
- Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled.
- No Square transaction was executed during this code change. JavaScript syntax check passed; no live D1 or payment end-to-end test performed.

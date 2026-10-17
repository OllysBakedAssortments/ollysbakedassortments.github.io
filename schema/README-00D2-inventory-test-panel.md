# OBA Phase 00D.2 — Staging Inventory Test Panel

Staging Worker only. No migration. No production Worker or D1 changes.

## Deploy (browser only)
1. Backup the current staging Worker source in Cloudflare.
2. Replace the code of `oba-checkout-staging` with `oba-checkout/staging/worker.js` and deploy.
3. Do not deploy to `oba-checkout` production.
4. Open `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__patch1b` and sign into the existing synthetic Crew account (do not share passwords or session cookies).
5. Visit `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__inventory-test` in the *same browser/session*.
6. Click Refresh. Confirm the test item is `stage-00c-test` Plain Jane, with expected allocations and active holds.
7. Use **manual** transfer and adjustment buttons only when intending to modify staging stock. Confirm the warning. The response area captures before/request/API response/after.

## New routes
- GET `/__inventory-test`: testing interface, CSP nonce, no external scripts.
- GET `/__inventory-test/state`: needs Crew session and at least one inventory permission; retrieves only the synthetic Plain Jane item, location allocations, active holds, and the last 12 movements. No customer records.

The existing POST `/inventory/transfer` and `/inventory/adjust` continue to require Crew session and their respective permissions, and the staging same-origin check remains active.

## Suggested tests (staging only)
1. With both online cookies reserved, attempt online -> kitchen quantity 1. Expect error; before/after allocations & movement count unchanged.
2. With no active holds and 2 cookies online, online -> kitchen quantity 1 should succeed (if no other constraints).
3. With active holds 2 and online allocated 2, try waste quantity 1. Expect rejection with no stock/movement changes.
4. Check conditional-update zero-row rollback with an overdraw quantity where appropriate; no destination credit or false movement.
5. Verify session logout causes snapshot to return 401. Re-login for further tests.

**Important limitations:** This panel does not generate reservations or simulate checkout, and the existing test hold may have expired. Use existing staging reservation test procedures to establish valid holds. A displayed response or individual manual run is not a complete concurrency test. No production rollout is authorized. This package is based on the newest repository ZIP provided in this conversation.

## Local validation
- Node `--check` passed for merged staging Worker.
- Isolated panel and route insertion checked; live D1 behavior and authentication still need browser verification.

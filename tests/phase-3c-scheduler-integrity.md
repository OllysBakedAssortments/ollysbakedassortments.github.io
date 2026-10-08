# Phase 3C scheduler integrity verification

## Deploy
Replace `oba-checkout/worker.js` in GitHub and paste its contents into the Cloudflare `oba-checkout` Worker editor, then deploy. The existing five-minute Cron trigger remains unchanged. No SQL migration is required.

## Verification (not yet executed)
1. Confirm a future Upcoming adventure stays Upcoming before its Los Angeles local event date.
2. After local midnight on its scheduled date, wait for Cron and confirm Event Day, one status-history row, one canonical audit row.
3. Within one hour before start, confirm Live, one additional status-history row and canonical audit row.
4. Repeat the scheduled invocation / wait another cycle: no duplicate transition or history.
5. Verify a simulated write failure rolls back lifecycle, status history, and audit together (test database only).
6. Confirm unrelated Crew, checkout, inventory, and reviews flows remain functional.

Do not mark these tests passed until observed in the deployed environment.

# Phase 3C — Cron and manual lifecycle controls

## Deployment

Replace the three files in this patch. No SQL migration. Deploy the Worker before enabling Cron. Configure Cloudflare Worker Cron Trigger `*/5 * * * *` (UTC; event-local date comparisons happen in the Worker).

## Verification (pending — do not mark passed from syntax checks)

1. Confirm Worker deployed with `scheduled(event, env, ctx)` and D1 binding `OBA_DB`.
2. On a nonpublic test Adventure, confirm Upcoming before the event date does not advance.
3. Confirm Upcoming advances to Event Day on/after event-local midnight; Live starts no earlier than T−1 hour. Note a five-minute Cron may execute up to five minutes after a boundary.
4. Trigger Cron twice and check one status-history and one canonical-audit entry per actual transition.
5. Confirm postponed, rescheduled, cancelled, recap pending, past and ended-early records are skipped.
6. With a Live test Adventure, choose Recap Pending to end normally; verify history and audit. On a separate Live test record, choose Ended Early with an operational reason and confirm.
7. Verify an exception without a reason is rejected by both UI and Worker.
8. Confirm QR check-in is NOT implicitly activated by Live; QR controls belong to Phase 4.
9. Verify Worker logs report failed record processing.

## Known integrity limitation

The current scheduled transition writes the Adventure status, status history and canonical audit in separate D1 operations. A mid-sequence database error could leave a partially audited transition. Do not call the scheduler fully integrity-verified until the writes are made atomic and concurrency/retry tests pass.

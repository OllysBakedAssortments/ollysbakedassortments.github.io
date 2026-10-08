# Phase 4B-SYNC Foundation — Controlled Test Patch

## Files
- REPLACE oba-checkout/worker.js
- REPLACE crew/adventures.js
- NEW tests/phase-4b-sync-foundation.md

No D1 SQL migration is needed.

## Implemented
- Setup saves submit only changed fields, with original values.
- Server uses atomic conditional UPDATE on original field values AND lifecycle status. Stale same-field changes return HTTP 409; unrelated fields can be saved concurrently.
- Existing records using outdated full-record save payloads return HTTP 428 (fail closed).
- Open Adventure Form polls detail every 15 seconds, refreshes clean setup fields, status, overview and history while retaining edited setup fields.
- Conflicted setup drafts remain in the form and cannot be saved until manually reconciled. Copy draft before reopening; a dedicated compare/resolve UI is not implemented.

## Not implemented in this patch
- Admin/Manager override or protected decisions (requires explicit scoped permission policy and audit).
- Draft recovery across page reloads.
- Field-level conflict resolution UI.
- Recap/update draft-safe polling or compare-and-swap.
- QR credential continuity, automatic rotation, or station synchronization.

## Test
1. Open same draft/upcoming Adventure in two different Crew accounts.
2. Crew A edits description without saving; Crew B changes location and saves. Wait 15–20 seconds. A's location should refresh; A's description should remain.
3. Crew A saves description; Crew B location must remain.
4. Both edit title; B saves first. A should see warning, retain draft, and be prevented from overwriting B.
5. Lifecycle transition by B while A's form open; A should see updated lifecycle after polling. A's stale setup save must not undo lifecycle.
6. Check D1 audit events and Crew permissions.
7. Test new Adventure creation, recap, update, and relationships for regressions.

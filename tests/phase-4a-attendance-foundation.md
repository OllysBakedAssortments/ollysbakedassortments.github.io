# Phase 4A — Attendance foundation test gate

Deploy migration 0005 before Worker code. No public check-in issuance or consumption is enabled in this patch.

1. Verify migration tables and indexes exist in D1; run migration once.
2. Authenticated Longneck: GET /longneck/passport returns only that account's verified canonical attendance; no raw credentials.
3. Authenticated Longneck: GET /longneck/adventures uses canonical verified attendance, not legacy check-ins.
4. Unauthenticated requests to both routes return 401.
5. Authorized Crew: GET /crew/adventures/attendance?id=<adventure_id> lists attendance and count.
6. Unauthenticated Crew returns 401; Crew lacking adventures.view is denied; test record-scoped deny.
7. D1 uniqueness: duplicate (adventure_id,longneck_id) and credential_id insert must fail.
8. Regression: Adventure manager, Longneck session, checkout, Reviews, inventory, lifecycle Cron.

NOTE: Legacy longneck_event_checkins are intentionally not backfilled: historical event_id values must be reconciled to canonical adventure_id before claiming verified Passport attendance. Existing legacy records remain untouched. Phase 4B will implement token issuance, validation, consumption and atomic check-in. Phase 5 will process reward_status.

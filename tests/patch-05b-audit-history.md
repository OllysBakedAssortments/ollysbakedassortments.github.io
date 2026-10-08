# Patch 05B — Audit History

Deploy the three replacement files. No D1 migration.

Manual checks:
1. Open Adventure → Operations → History; confirm audit entries show changed fields and before → after values, including summaries, dates, and lifecycle when recorded in snapshots.
2. Confirm Crew names resolve from existing `crew_users.first_name` and `last_name` (when populated); absent names fall back to Crew member ID.
3. Expand Technical details; original audit payload remains available.
4. Enter invalid schedule, attempt save, switch to History: schedule warning disappears but unsaved edits remain.
5. Return to Setup: unsaved edits remain; invalid dates still fail validation on save.
6. Verify no private credential fields appear in rendered field changes.
7. Check D1 query and endpoint authorization on deployed Worker; no deployment or runtime verification was performed by this patch.

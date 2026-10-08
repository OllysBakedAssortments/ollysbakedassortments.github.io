# Phase 4A Patch 05 validation checklist

- Confirm Adventure / Operations groups show all nine tabs without horizontal overflow.
- Confirm Setup has Details, Schedule, Location and a single Save action.
- Verify editing any field shows Unsaved changes; changing tabs retains values.
- Verify Close and Escape warn before discarding changes.
- Verify failed save retains entered values; successful save refreshes record and clears warning.
- Verify start/end chronology and server-side validation.
- Verify History shows lifecycle transitions and audit entries, with raw details expandable.
- Verify view-only Crew cannot save, and server permissions remain authoritative.
- Verify Adventure Hub direct record navigation and deep links with ?id=...&tab=history.
- Verify Updates, Recap, Relationships and Lifecycle save flows.
- Regression: Crew shell, Longneck accounts, inventory, reviews, cart and Square checkout.

Code syntax checks do not substitute for live browser/API testing.

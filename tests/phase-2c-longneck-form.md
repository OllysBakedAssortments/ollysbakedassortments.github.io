# Phase 2C — Canonical Longneck Form validation

Do not deploy the Phase 2C Worker before migration `0003_longneck_canonical_form.sql` is applied.

## Required validation
- Owner can load canonical Longneck Form.
- Closing the form keeps it closed.
- Identity correction requires current Crew password + reason; email correction clears verification.
- Duplicate email/username rejected.
- Account status change requires current Crew password + reason.
- Crew cannot create a new marketing opt-in; Crew can record an opt-out with reason.
- Most Wanted preferences save with Crew provenance.
- Flavor Fave add/remove requires reason and writes history.
- Membership change requires reason and writes previous/new state to canonical history.
- Chip correction remains append-only and writes canonical history.
- Internal notes are attributable and visible only to authorized Crew.
- Record History is visible and immutable.
- Scoped record/section/action allow and deny rules override broader defaults.
- Expired/revoked scoped grants fail closed.
- Existing Reviews, Inventory, Crew Access, Longneck auth/My OBA, checkout and Square smoke tests remain green.

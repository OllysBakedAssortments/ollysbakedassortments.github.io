# Phase 2A — Longneck authorization regression checks

## Required outcomes

- Unauthenticated requests to Crew Longneck routes return 401.
- Crew without `longnecks.view` cannot list or open Longnecks.
- Crew with only `longnecks.view` can see public identity/status only.
- `longnecks.view` alone does not return email, real name, marketing preferences, verification state, last-login data, Chip balance/ledger, or membership.
- `longnecks.view` alone cannot POST Chip adjustments or membership changes.
- `longnecks.view_private` enables private account fields but does not imply reward or membership mutation.
- `rewards.view` enables Chip balance/ledger visibility but does not imply adjustment authority.
- `rewards.adjust` is required for manual Chip adjustment.
- `longnecks.membership_manage` is required for membership mutation.
- Chip adjustments require a non-empty reason and produce a Crew security event.
- Membership changes produce a Crew security event containing previous and next membership state.
- Owner retains all registered capabilities.
- Existing Longneck self-service, My OBA, Reviews, Inventory, cart/reservation/checkout and Square routes remain unaffected.

## Adversarial checks

- Submit Chip POST while UI control is hidden: server returns 403.
- Submit membership POST while UI control is hidden: server returns 403.
- Change a Longneck ID in a permitted GET request: unauthorized private sections remain omitted.
- Search by an email/name while lacking private-data access: private fields are not used as search dimensions.

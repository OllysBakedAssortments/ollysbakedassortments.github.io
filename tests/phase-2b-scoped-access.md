# Phase 2B — Scoped Crew authorization / audit verification

Do not deploy the Phase 2B Worker until migration `0002_crew_scoped_access_and_audit.sql` has been applied to the target D1 database.

## Migration checks
- `crew_access_assignments` exists with indexes.
- `crew_grant_authorities` exists with index.
- `crew_access_requests` exists with index.
- `canonical_audit_events` exists with object/actor indexes.
- Record migration `0002_crew_scoped_access_and_audit` in `schema_migrations` only after successful application.

## Authorization matrix
For one non-owner test Crew account and a harmless permission:
- role denied + no override => DENY
- role allowed + no override => ALLOW
- personal deny overrides role allow => DENY
- personal allow overrides role deny => ALLOW
- manager-scoped deny overrides broader allow in that manager => DENY
- record-scoped allow overrides broader manager deny for that record => ALLOW
- section-scoped deny overrides record allow in that section => DENY
- action-scoped allow overrides section deny for that exact action => ALLOW
- expired assignment => ignored
- revoked assignment => ignored
- equal-specificity allow + deny => DENY
- foreign record context => scoped assignment does not match
- owner => ALLOW (subject to separate platform-integrity rules)

## Grant safety
- Manager cannot grant a permission they do not hold.
- Manager cannot grant outside explicit grant authority.
- Expired/revoked grant authority cannot be used.
- Crew member cannot modify their own access.
- Owner can administer non-owner access.
- Every grant/revoke/request resolution creates an immutable canonical audit event.

## Regression
Re-run `tests/baseline-regression.md` and `tests/phase-2a-authorization.md` after deployment.

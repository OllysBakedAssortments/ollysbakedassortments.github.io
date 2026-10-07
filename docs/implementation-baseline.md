# OBA Implementation Baseline

This document freezes the pre-Adventure-expansion repository baseline used by the Event OOO implementation roadmap.

## Baseline rules

- Preserve working Crew and Longneck authentication/session behavior.
- Preserve Reviews Manager behavior and review workflow semantics.
- Preserve Inventory behavior.
- Preserve cart, reservation, checkout, Square payment/webhook behavior.
- Preserve existing Longneck Chips balances and check-in/Adventure history.
- Do not introduce a parallel Longneck identity, Chips ledger, Moments store, Inventory system, or Reviews system.
- New schema changes must be versioned under `schema/migrations/` before production application.
- `oba-checkout/worker.js` remains the deployed entrypoint while domain logic is extracted incrementally.

## Baseline smoke-test matrix

| Area | Baseline expectation |
| --- | --- |
| Crew auth | Login/session validation, inactivity handling, logout and protected-page redirects continue to work. |
| Crew Access | Existing role/default and personal override behavior remains functional until superseded by scoped authorization. |
| Longneck auth | Register, login, session, logout, reset, verification, profile and deactivate flows remain functional. |
| My OBA | Existing account shell and current data panels render without regression. |
| Reviews | Existing workflow, permissions, audit history and public published-review behavior remain functional. |
| Inventory | Existing locations, items, drops, allocations, movements and adjustment workflows remain functional. |
| Cart/reservation | Reservation creation/update/release behavior and inventory protection remain functional. |
| Checkout | Existing checkout validation and order creation remain functional. |
| Square | Payment and webhook processing remain functional and replay-safe at the existing baseline. |
| Chips | Existing ledger rows and computed balances remain unchanged by migration work. |
| Check-ins | Existing historical Longneck Adventure/check-in records remain retrievable until migrated to canonical attendance. |

## Acceptance rule

Every implementation phase must rerun the relevant baseline checks. A phase is not accepted if it breaks an existing business-critical flow unless the same phase deliberately replaces that flow and includes migration plus regression coverage.

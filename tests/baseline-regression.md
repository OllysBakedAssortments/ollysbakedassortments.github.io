# Baseline Regression Checklist

Use this checklist before and after each dependency phase.

## Crew
- [ ] Valid Crew session loads protected Crew pages.
- [ ] Invalid/expired Crew session is rejected.
- [ ] Crew logout invalidates the current session.
- [ ] Reviews Manager loads for an authorized Crew member.
- [ ] Review actions still enforce their existing granular capabilities.
- [ ] Inventory page loads and existing inventory actions work for authorized Crew.

## Longneck
- [ ] Registration succeeds with valid data and creates the expected account/session behavior.
- [ ] Login/logout/session endpoints behave as expected.
- [ ] Email verification/reset flows remain functional.
- [ ] My OBA loads current account data.
- [ ] Existing favorites, membership, Chips and Adventure-history reads remain functional.

## Commerce
- [ ] Cart reservation can be created and updated.
- [ ] Reservation release/expiration behavior remains intact.
- [ ] Checkout rejects invalid/stale reservation state.
- [ ] Successful checkout creates the expected order state.
- [ ] Square webhook replay handling remains intact.

## Data integrity
- [ ] Existing Chip balance equals the pre-change ledger sum.
- [ ] Existing historical check-ins remain represented.
- [ ] No migration silently deletes or rewrites Reviews, Inventory, Longnecks, orders, Chips or check-ins.

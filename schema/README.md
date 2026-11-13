# Phase 02E — Inventory controls UI polish

## SQL migration
None. Do not execute any SQL in production or staging for this phase.

## Target database
No database changes. Current Crew Products page continues using the production `oba-checkout` API and existing inventory tables.

## Deployment order
1. Confirm the current repository version of `crew/products.html` still matches the Phase 02D baseline. Merge newer edits if necessary.
2. Replace `crew/products.html` with this version in GitHub and publish the site.
3. Refresh Crew > Products > Weekly Drops > November Test Drop.
4. Verify baked receiving location defaults to Kitchen when Kitchen exists, and transfer defaults to two different locations when available.
5. Verify identical From and To locations disable the Transfer button.

## Safety and verification
- No Worker code changes, schema changes or inventory updates are included in this ZIP.
- Do not record fictitious stock quantities on production to test this UI.
- Existing `/inventory/baked` and `/inventory/transfer` API authorization and server protections remain unchanged.
- On a drop with only one location, Transfer is disabled until distinct locations exist.

## Rollback
Restore the previous committed `crew/products.html`. No database rollback is needed.

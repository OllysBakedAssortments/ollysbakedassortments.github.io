# OBA Phase 01A — Staging catalog read contract

Deploy only `oba-checkout/staging/worker.js` to `oba-checkout-staging`. No D1 migration. Do not deploy to production.

Visit `https://oba-checkout-staging.ollysbakedassortments.workers.dev/catalog` and verify JSON `ok:true`, `environment:staging`, one active drop, and current D1 stock.

This is a non-destructive first step toward catalog normalization; it does not modify the public ordering page, inventory, checkout, or prices. Legacy cookie prices and displayed pack prices are labeled unapproved; Specialty classification and upcharges remain to be confirmed.

Next build: central server-side product/pricing authority and Crew edit operations, then the pack builder.

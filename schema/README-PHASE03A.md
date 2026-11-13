# OBA Phase 03A — Crew Giraffe Pack Studio

Files: `oba-checkout/worker.js`, `crew/products.html`, `schema/README.md`.

**Deployment:** Preserve and compare the currently active `oba-checkout` Worker; merge newer live changes into the packaged file rather than replacing them blindly. Keep production D1 binding and environment variables unchanged. Deploy Worker first, then upload `crew/products.html` to GitHub Pages.

**Use:** Crew → Products → Giraffe Packs. Choose saved weekly menu, pack size, and exact flavor quantities; calculate the server preview. Any pack with insufficient Online inventory is flagged. Classifications and price approvals are flagged. The price uses the stored classification and $1/selected Specialty item, with bases $10/$18/$40. Pricing is provisional and checkout remains unchanged.

**Security:** Crew session and `products.view` permission, POST Origin gate, validation; no database writes.

**Caution:** Source production catalog classifications were imported from reference labels and are not all reviewed/approved. Do not use preview prices for live checkout until corrected.

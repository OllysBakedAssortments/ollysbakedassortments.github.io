# OBA Cookies — Phase 03D.2B: Feature-gated Giraffe Pack Square checkout

## Source
Based on the user-supplied latest `ollysbakedassortments.github.io-main.zip` from this conversation. Contains only a modified production Worker and docs.

## Changes
- Reads immutable Giraffe Pack selection and price snapshot associated with the active cart reservation from production D1.
- Fails closed for pack requests unless Worker env variable `ENABLE_GIRAFFE_PACK_CHECKOUT` equals the literal string `true`. The default/unset behavior keeps packs unpurchasable.
- Verifies saved pack size, quantity and individual-item snapshot; verifies exact flavor totals against the held inventory rows.
- Charges one Giraffe Pack Square order line at the stored server-authoritative pack price and individual-cookie lines separately.
- Includes pack total in checkout subtotal, retry fingerprint, and cookie-count-based delivery minimum.
- Preserves ordinary-cookie checkout path. Uses existing Square checkout, payment reconciliation, and reservation conversion; no new payment provider.

## Deployment — do not turn payment on yet
1. Ensure production `oba-orders` has the `giraffe_pack_reservation_details` table and planning index (confirmed in conversation). No migration is included here.
2. Compare this Worker with the current Cloudflare `oba-checkout` deployment and merge any newer production edits. Preserve all secrets and bindings.
3. Deploy with `ENABLE_GIRAFFE_PACK_CHECKOUT` **unset**. Verify existing individual-cookie checkout behavior and inspect Worker error logs.
4. Separately validate pack transactions in an isolated safe environment with Square Sandbox, including: pack-only checkout; mixed pack+individual checkout; specialty surcharges; failed-payment retries; expired holds; duplicate checkout attempt; mismatched snapshot/reservation; inventory conversion; delivery fee and minimum; and Square total reconciliation.
5. Only after acceptance testing, enable `ENABLE_GIRAFFE_PACK_CHECKOUT=true` in the production Worker and connect the customer frontend's pack hold/checkout lifecycle. Current frontend may still have a pending-pack checkout guard.

## Important limitations
This is a backend integration **not live enablement**. Pack payment stays blocked by default; the storefront must still be updated to request a pack hold and call /checkout with the held individual items. All live deployment and end-to-end payment test steps remain pending. No user payment data was processed in local validation. The existing Square endpoint and environment are unchanged.

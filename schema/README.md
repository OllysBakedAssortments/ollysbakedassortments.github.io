# OBA Phase 00E.1 — Staging Reservation Test Panel

This is an **updated-file-only** package. Replace ONLY `oba-checkout-staging` Worker through Cloudflare browser's Edit Code. DO NOT replace production Worker or change D1 database bindings. Existing `oba-orders-staging` binding must be retained.

Open `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__reservation-test`.

Safety: only `/cart-reservation`, `/cart-reservation/renew`, `/cart-reservation/release` are added to the Patch 1B allowed routes. Existing `/inventory`, Crew endpoints and test page remain. `/checkout`, `/square-webhook` and email remain disabled. The test page uses generated UUIDs and the existing Plain Jane product id.

1. Verify the inventory JSON first. In current staging Online stock is 1 and a prior test reservation may still hold it. **Do not confuse a rejected Cart A due to old holds with a successful contention test**. Release or expire prior synthetic test holds separately using the established staging-only procedures before the contention test. No automated removal of prior reservations is performed.
2. When at least 1 online cookie is available, set A to available count and B to 1, press Run competing-cart test. A should succeed; B should reject (normally 409). Confirm available stock is zero. There are no automatic retries.
3. Press Release A, then press Reserve / update Cart B again. B should succeed if the stock remains available.
4. Test Renew A/B separately on currently active holds. Expired holds must never be revived.
5. The panel can only prove the serial contention scenario; simultaneous overlapping requests, expiry races, and multi-flavor Giraffe Packs still need dedicated tests before production.

Keep the production storefront and Worker unchanged. This update does not turn on Square or notifications. No D1 migration.

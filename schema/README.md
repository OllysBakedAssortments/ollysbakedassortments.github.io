# OBA Phase 03B — Shared Full-Sized Pack Reservation Acceptance

**SQL migration required:** No.

**Target database for this test:** `oba-orders-staging` only, bound as `OBA_DB` to `oba-checkout-staging`.

This phase reuses `inventory_drops`, `inventory_items`, `inventory_locations`, `inventory_allocations`, `cart_reservations`, and `cart_reservation_items`. It does not create a second pack-stock pool.

**Prerequisites:** Existing reservation triggers `oba_reservation_online_guard_insert` / `oba_reservation_online_guard_update` and Crew authentication. Ensure any staged catalog test product has a `regular` or `specialty` classification. The test inventory drop must be active and have sufficient Online allocation for a successful hold. No production records, credentials, or inventory are to be copied to staging.

**Validation:** Use the staging-only `/__giraffe-pack-test` browser page after deploying the supplied staging Worker. Verify a request exceeding Online allocation receives HTTP 409 and creates no hold. For a positive test with legitimate synthetic staging allocations, verify a two-minute hold, availability reduction in the ordinary reservation system, and release restoring availability.

**Rollback:** Revert the staging Worker deployment; no schema changes or product data alterations are introduced by deployment. Test holds expire automatically; release active test holds with the browser interface before rolling back when possible.

**Production migration:** None. Do not deploy this testing Worker to `oba-checkout` production.

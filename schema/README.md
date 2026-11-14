# Database notes

No SQL migration in this package. The source repository includes a **staging-only** Online allocation reservation guard migration in `schema/migrations/0009_online_allocation_reservation_guard.sql`; this release does not apply it to production. Verify production D1 trigger inventory and test atomically guarded reservations before enabling further checkout flows.

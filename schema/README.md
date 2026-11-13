# Phase 03D.2A database changes

Requires ONE additive D1 migration before worker deployment: `phase-03d2a-pack-reservations.sql`.

`giraffe_pack_reservation_details` stores the server-calculated pack/individual totals and the exact selection JSON under the existing `cart_reservations.reservation_id`. Inventory itself stays in `cart_reservation_items` and is controlled by the existing D1 overreservation triggers. Do not populate the table manually or edit inventory counts directly.

**Deployment order matters:** Running the new Worker before the migration will cause pre-existing flat-cookie checkout to fail closed when checking pack metadata. Run the SQL first. Existing reservations do not require backfill.

No existing columns, trigger definitions, stock records, or Square objects are changed. Pack holds are NOT authorized for checkout in this phase.

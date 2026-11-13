# Phase 03B.2 — staging acceptance

No D1 migration is required. This package changes only the staging Worker acceptance test interface and adds a read-only stock inspection action to its existing staging-only `POST /__giraffe-pack-reservation` route.

**Database target:** `oba-orders-staging` only. Do not apply changes to `oba-orders`.

Staging must already contain `inventory_drops`, `inventory_items`, `inventory_locations`, `inventory_allocations`, `cart_reservations`, `cart_reservation_items`, `commerce_products` and the pre-existing Online allocation reservation triggers.

Optional read-only verification:

```sql
SELECT r.reservation_id,r.status,r.expires_at,i.product_id,ri.quantity
FROM cart_reservations r
JOIN cart_reservation_items ri ON ri.reservation_id=r.reservation_id
JOIN inventory_items i ON i.inventory_item_id=ri.inventory_item_id
WHERE r.drop_id='stage-00c-test'
ORDER BY r.created_at DESC;
```

No staging stock is created by this release. Use only synthetic staging inventory for successful hold tests; never inflate stock in production. The runner will show 409 until the tested drop has sufficient Online stock for the selected composition.

Rollback: restore the preceding `oba-checkout-staging` Worker version in Cloudflare Deployments. No D1 rollback required.

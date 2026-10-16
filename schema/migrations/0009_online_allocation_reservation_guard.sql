-- Package 00C: Online allocation is the sellable stock for website carts.
-- Apply in STAGING first. This is additive: existing global inventory triggers remain.
-- Intended inventory contract: quantity_allocated = remaining unsold units at location.
-- quantity_sold on inventory_allocations is legacy and NOT incremented by 00C;
-- location-level sale history is recorded in inventory_movements.

CREATE TRIGGER IF NOT EXISTS oba_reservation_online_guard_insert
BEFORE INSERT ON cart_reservation_items
FOR EACH ROW
WHEN
  (SELECT COUNT(*) FROM inventory_allocations a
    JOIN inventory_locations l ON l.location_id=a.location_id
    WHERE a.inventory_item_id=NEW.inventory_item_id AND a.status='active'
      AND l.location_type='online' AND l.status='active') != 1
  OR NEW.quantity > (
    SELECT COALESCE(SUM(a.quantity_allocated),0) - COALESCE((
      SELECT SUM(ri.quantity) FROM cart_reservation_items ri
      JOIN cart_reservations r ON r.reservation_id=ri.reservation_id
      WHERE ri.inventory_item_id=NEW.inventory_item_id AND r.status='active'
        AND julianday(r.expires_at)>julianday('now')
    ),0)
    FROM inventory_allocations a JOIN inventory_locations l ON l.location_id=a.location_id
    WHERE a.inventory_item_id=NEW.inventory_item_id AND a.status='active'
      AND l.location_type='online' AND l.status='active'
  )
BEGIN SELECT RAISE(ABORT,'insufficient_online_inventory'); END;

CREATE TRIGGER IF NOT EXISTS oba_reservation_online_guard_update
BEFORE UPDATE OF inventory_item_id, quantity ON cart_reservation_items
FOR EACH ROW
WHEN
  (SELECT COUNT(*) FROM inventory_allocations a
    JOIN inventory_locations l ON l.location_id=a.location_id
    WHERE a.inventory_item_id=NEW.inventory_item_id AND a.status='active'
      AND l.location_type='online' AND l.status='active') != 1
  OR NEW.quantity > (
    SELECT COALESCE(SUM(a.quantity_allocated),0) - COALESCE((
      SELECT SUM(ri.quantity) FROM cart_reservation_items ri
      JOIN cart_reservations r ON r.reservation_id=ri.reservation_id
      WHERE ri.inventory_item_id=NEW.inventory_item_id
        AND ri.reservation_item_id!=OLD.reservation_item_id
        AND r.status='active' AND julianday(r.expires_at)>julianday('now')
    ),0)
    FROM inventory_allocations a JOIN inventory_locations l ON l.location_id=a.location_id
    WHERE a.inventory_item_id=NEW.inventory_item_id AND a.status='active'
      AND l.location_type='online' AND l.status='active'
  )
BEGIN SELECT RAISE(ABORT,'insufficient_online_inventory'); END;

-- Prevent a Crew transfer/adjustment from taking stock already held online.
-- This blocks unreserved stock reductions, but allows a paid checkout to consume
-- its own reserved units ONLY when a matching active, paid Square reservation exists.
-- The Worker also has to protect stock movement paths and handle 409 errors.

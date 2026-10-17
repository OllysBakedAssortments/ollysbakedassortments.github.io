-- STAGING ONLY. Replaces the 00D manually-installed pre-deduction trigger.
-- Existing Crew Worker D1 batches deduct allocation BEFORE recording movement.
-- Check the final allocation (not final allocation minus NEW.quantity).
-- No production application until full transaction/Square testing.
DROP TRIGGER IF EXISTS oba_crew_online_hold_movement_guard;
CREATE TRIGGER oba_crew_online_hold_movement_guard
BEFORE INSERT ON inventory_movements
FOR EACH ROW
WHEN NEW.reference_type IN ('crew_inventory_transfer','crew_inventory_adjustment')
 AND NEW.from_location_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM inventory_locations l
             WHERE l.location_id=NEW.from_location_id AND l.location_type='online')
 AND COALESCE((SELECT a.quantity_allocated FROM inventory_allocations a
               WHERE a.inventory_item_id=NEW.inventory_item_id
                 AND a.location_id=NEW.from_location_id AND a.status='active'),0)
     < COALESCE((SELECT SUM(ri.quantity) FROM cart_reservation_items ri
                 JOIN cart_reservations r ON r.reservation_id=ri.reservation_id
                 WHERE ri.inventory_item_id=NEW.inventory_item_id
                   AND r.status='active'
                   AND julianday(r.expires_at)>julianday('now')),0)
BEGIN SELECT RAISE(ABORT,'online_inventory_reserved'); END;

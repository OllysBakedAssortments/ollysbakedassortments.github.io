-- 00D staging candidate: Crew inventory movement guard.
-- Apply ONLY to oba-orders-staging, after 0009. Do not apply to production.
-- The current Worker batches the allocation deduction and movement creation.
-- The trigger executes after the allocation reduction, but before the batch commits.
-- It rejects a Crew reduction that leaves fewer online cookies than live holds.
-- Paid checkout uses movement_type='sale', reference_type='square_order' and is not blocked.
CREATE TRIGGER IF NOT EXISTS oba_crew_online_hold_movement_guard
BEFORE INSERT ON inventory_movements
FOR EACH ROW
WHEN NEW.reference_type IN ('crew_inventory_transfer','crew_inventory_adjustment')
 AND NEW.from_location_id IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM inventory_locations l
   WHERE l.location_id=NEW.from_location_id AND l.location_type='online'
 )
 AND (
   COALESCE((
     SELECT a.quantity_allocated FROM inventory_allocations a
     WHERE a.inventory_item_id=NEW.inventory_item_id
       AND a.location_id=NEW.from_location_id AND a.status='active'
   ),0) < COALESCE((
     SELECT SUM(ri.quantity)
     FROM cart_reservation_items ri
     JOIN cart_reservations r ON r.reservation_id=ri.reservation_id
     WHERE ri.inventory_item_id=NEW.inventory_item_id
       AND r.status='active' AND julianday(r.expires_at)>julianday('now')
   ),0)
 )
BEGIN SELECT RAISE(ABORT,'online_inventory_reserved'); END;

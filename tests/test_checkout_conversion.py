"""SQLite atomic sale simulation for the Worker 00C statements, including retry guard."""
import sqlite3

def test():
 c=sqlite3.connect(':memory:')
 c.executescript('''
 CREATE TABLE inventory_locations(location_id TEXT PRIMARY KEY,location_type TEXT,status TEXT);
 CREATE TABLE inventory_allocations(inventory_item_id INTEGER, location_id TEXT,quantity_allocated INTEGER, status TEXT,updated_at TEXT);
 CREATE TABLE inventory_items(inventory_item_id INTEGER PRIMARY KEY,quantity_sold INTEGER DEFAULT 0);
 CREATE TABLE cart_reservations(reservation_id TEXT PRIMARY KEY,status TEXT,square_order_id TEXT);
 CREATE TABLE inventory_movements(inventory_item_id INTEGER NOT NULL,movement_type TEXT NOT NULL,from_location_id TEXT NOT NULL,quantity INTEGER,reason TEXT,reference_type TEXT,reference_id TEXT,created_by TEXT);
 INSERT INTO inventory_locations VALUES('online','online','active');
 INSERT INTO inventory_items VALUES(1,0);
 INSERT INTO inventory_allocations(inventory_item_id,location_id,quantity_allocated,status) VALUES(1,'online',2,'active');
 INSERT INTO cart_reservations VALUES('r','active','sq123');
 ''')
 def convert():
  try:
   c.execute('BEGIN')
   c.execute("""UPDATE inventory_allocations SET quantity_allocated = quantity_allocated - ?, updated_at=CURRENT_TIMESTAMP
    WHERE inventory_item_id=? AND status='active' AND location_id=(SELECT location_id FROM inventory_locations WHERE location_type='online' AND status='active' ORDER BY location_id LIMIT 1)
    AND quantity_allocated >= ? AND EXISTS (SELECT 1 FROM cart_reservations WHERE reservation_id=? AND status='active' AND square_order_id=?)""",(2,1,2,'r','sq123'))
   c.execute("""INSERT INTO inventory_movements(inventory_item_id,movement_type,from_location_id,quantity,reason,reference_type,reference_id,created_by)
    VALUES (CASE WHEN changes()=1 THEN ? ELSE NULL END,'sale',(SELECT location_id FROM inventory_locations WHERE location_type='online' AND status='active' ORDER BY location_id LIMIT 1),?,'Square completed payment','square_order',?,'checkout')""",(1,2,'sq123'))
   c.execute('UPDATE inventory_items SET quantity_sold=quantity_sold+2 WHERE inventory_item_id=1')
   c.execute("UPDATE cart_reservations SET status='converted' WHERE reservation_id='r' AND status='active'")
   c.commit();return True
  except sqlite3.IntegrityError:
   c.rollback();return False
 assert convert()
 assert not convert()
 assert c.execute('SELECT quantity_allocated FROM inventory_allocations').fetchone()[0]==0
 assert c.execute('SELECT quantity_sold FROM inventory_items').fetchone()[0]==2
 assert c.execute('SELECT COUNT(*) FROM inventory_movements').fetchone()[0]==1
 print('PASS: sale conversion, sale movement, retry rollback')
if __name__=='__main__':test()

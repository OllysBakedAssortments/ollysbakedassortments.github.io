"""SQLite smoke tests for 00C additive reservation guards (no Cloudflare credentials required)."""
import sqlite3
from pathlib import Path

MIGRATION=Path(__file__).resolve().parents[1]/'schema/migrations/0009_online_allocation_reservation_guard.sql'

def db():
 c=sqlite3.connect(':memory:')
 c.executescript('''
 CREATE TABLE inventory_locations(location_id TEXT PRIMARY KEY,location_type TEXT,status TEXT);
 CREATE TABLE inventory_items(inventory_item_id INTEGER PRIMARY KEY);
 CREATE TABLE inventory_allocations(inventory_item_id INTEGER,location_id TEXT,status TEXT,quantity_allocated INTEGER);
 CREATE TABLE cart_reservations(reservation_id TEXT PRIMARY KEY,status TEXT,expires_at TEXT);
 CREATE TABLE cart_reservation_items(reservation_item_id INTEGER PRIMARY KEY, reservation_id TEXT,inventory_item_id INTEGER,quantity INTEGER);
 INSERT INTO inventory_items VALUES (1);
 INSERT INTO inventory_locations VALUES ('online','online','active'),('bertha','bertha','active');
 INSERT INTO inventory_allocations VALUES (1,'online','active',2),(1,'bertha','active',50);
 INSERT INTO cart_reservations VALUES ('a','active','2099-01-01T00:00:00Z'),('b','active','2099-01-01T00:00:00Z');
 ''')
 c.executescript(MIGRATION.read_text())
 return c

def reject(fn):
 try: fn()
 except sqlite3.IntegrityError as e:
  assert 'insufficient_online_inventory' in str(e), e
 else: raise AssertionError('Expected inventory enforcement')

def test():
 c=db()
 c.execute("INSERT INTO cart_reservation_items(reservation_id,inventory_item_id,quantity) VALUES ('a',1,2)")
 reject(lambda:c.execute("INSERT INTO cart_reservation_items(reservation_id,inventory_item_id,quantity) VALUES ('b',1,1)"))
 c.execute("UPDATE cart_reservation_items SET quantity=1 WHERE reservation_id='a'")
 c.execute("INSERT INTO cart_reservation_items(reservation_id,inventory_item_id,quantity) VALUES ('b',1,1)")
 reject(lambda:c.execute("UPDATE cart_reservation_items SET quantity=2 WHERE reservation_id='b'"))
 c.execute("UPDATE cart_reservations SET status='released' WHERE reservation_id='a'")
 c.execute("UPDATE cart_reservation_items SET quantity=2 WHERE reservation_id='b'")
 c.execute("UPDATE inventory_allocations SET quantity_allocated=0 WHERE location_id='online'")
 reject(lambda:c.execute("INSERT INTO cart_reservation_items(reservation_id,inventory_item_id,quantity) VALUES ('a',1,1)"))
 print('PASS: location isolation, create, update, release, no-online-stock cases')
if __name__=='__main__':test()

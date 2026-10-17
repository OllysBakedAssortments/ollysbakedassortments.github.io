"""Local regression of 00D.2 post-update movement guard and Worker WHERE clause."""
import sqlite3
from pathlib import Path

migration = Path(__file__).resolve().parents[1] / 'schema/migrations/0011_crew_online_hold_guard_post_update.sql'
con = sqlite3.connect(':memory:')
con.executescript('''
CREATE TABLE inventory_locations(location_id TEXT PRIMARY KEY,location_type TEXT);
CREATE TABLE inventory_items(inventory_item_id INTEGER PRIMARY KEY,quantity_total INTEGER,quantity_sold INTEGER,updated_at TEXT);
CREATE TABLE inventory_allocations(inventory_item_id INTEGER,location_id TEXT,quantity_allocated INTEGER,status TEXT, updated_at TEXT,PRIMARY KEY(inventory_item_id,location_id));
CREATE TABLE cart_reservations(reservation_id TEXT PRIMARY KEY,status TEXT,expires_at TEXT);
CREATE TABLE cart_reservation_items(reservation_id TEXT,inventory_item_id INTEGER,quantity INTEGER);
CREATE TABLE inventory_movements(inventory_item_id INTEGER,from_location_id TEXT,reference_type TEXT,quantity INTEGER);
INSERT INTO inventory_locations VALUES ('online','online'),('kitchen','kitchen');
INSERT INTO inventory_items VALUES (1,20,0,NULL);
INSERT INTO inventory_allocations VALUES (1,'online',5,'active',NULL),(1,'kitchen',15,'active',NULL);
INSERT INTO cart_reservations VALUES ('cart','active',datetime('now','+2 hours'));
INSERT INTO cart_reservation_items VALUES ('cart',1,2);
''')
con.executescript(migration.read_text())
update='''UPDATE inventory_allocations SET quantity_allocated=quantity_allocated-? WHERE inventory_item_id=? AND location_id=? AND status='active' AND quantity_allocated>=? AND (NOT EXISTS(SELECT 1 FROM inventory_locations l WHERE l.location_id=inventory_allocations.location_id AND l.location_type='online') OR quantity_allocated-?>=COALESCE((SELECT SUM(ri.quantity) FROM cart_reservation_items ri JOIN cart_reservations r ON r.reservation_id=ri.reservation_id WHERE ri.inventory_item_id=inventory_allocations.inventory_item_id AND r.status='active' AND julianday(r.expires_at)>julianday('now')),0))'''

def balance(loc): return con.execute('SELECT quantity_allocated FROM inventory_allocations WHERE inventory_item_id=1 AND location_id=?',(loc,)).fetchone()[0]
def move(loc,n,kind='crew_inventory_transfer'):
    con.execute('SAVEPOINT test')
    try:
        change=con.execute(update,(n,1,loc,n,n)).rowcount
        if change!=1: raise sqlite3.IntegrityError('protected allocation deduction did not affect one row')
        con.execute('INSERT INTO inventory_movements VALUES(1,?,?,?)',(loc,kind,n))
        con.execute('RELEASE test')
        return True
    except sqlite3.IntegrityError:
        con.execute('ROLLBACK TO test');con.execute('RELEASE test');return False
assert move('online',3) and balance('online')==2
assert not move('online',1) and balance('online')==2
assert move('kitchen',1) and balance('kitchen')==14
con.execute("UPDATE cart_reservations SET status='released' WHERE reservation_id='cart'")
assert move('online',1) and balance('online')==1
# Re-enable hold; trigger must refuse a movement if an old caller bypasses guarded UPDATE.
con.execute("UPDATE cart_reservations SET status='active' WHERE reservation_id='cart'")
try:
    con.execute("INSERT INTO inventory_movements VALUES (1,'online','crew_inventory_transfer',1)")
    raise AssertionError('unguarded movement should reject underfunded hold')
except sqlite3.IntegrityError as e:
    assert 'online_inventory_reserved' in str(e)
# Paid-sale movements are not blocked by the crew-specific trigger.
con.execute("INSERT INTO inventory_movements VALUES (1,'online','square_order',1)")
print('PASS: valid online transfer, overdraw denial, kitchen, released holds, movement guard, sale exemption')

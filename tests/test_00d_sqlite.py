"""Standalone Python stdlib SQLite tests for the 00D staging Crew movement guard.
Run: python3 tests/test_00d_sqlite.py from package root.
This validates trigger behavior, NOT Worker/D1 deployment or concurrency.
"""
import sqlite3
from pathlib import Path

SQL = (Path(__file__).resolve().parents[1] / 'schema/migrations/0010_crew_online_hold_movement_guard.sql').read_text()


def setup():
    db = sqlite3.connect(':memory:')
    db.executescript('''
    CREATE TABLE inventory_locations(location_id TEXT PRIMARY KEY,location_type TEXT);
    CREATE TABLE inventory_allocations(inventory_item_id INTEGER,location_id TEXT,quantity_allocated INTEGER,status TEXT);
    CREATE TABLE cart_reservations(reservation_id TEXT PRIMARY KEY,status TEXT,expires_at TEXT);
    CREATE TABLE cart_reservation_items(reservation_id TEXT,inventory_item_id INTEGER,quantity INTEGER);
    CREATE TABLE inventory_movements(inventory_item_id INTEGER,movement_type TEXT,from_location_id TEXT,reference_type TEXT,quantity INTEGER);
    INSERT INTO inventory_locations VALUES ('online','online'),('kitchen','kitchen');
    INSERT INTO inventory_allocations VALUES (1,'online',2,'active');
    INSERT INTO inventory_allocations VALUES (1,'kitchen',8,'active');
    INSERT INTO cart_reservations VALUES ('hold','active',datetime('now','+20 minutes'));
    INSERT INTO cart_reservation_items VALUES ('hold',1,2);
    ''')
    db.executescript(SQL)
    return db


def crew_movement(db, origin, reference, amount):
    db.execute('UPDATE inventory_allocations SET quantity_allocated=quantity_allocated-? WHERE inventory_item_id=1 AND location_id=?',(amount,origin))
    db.execute('INSERT INTO inventory_movements VALUES (1,?, ?, ?, ?)',('transfer' if reference=='crew_inventory_transfer' else 'waste',origin,reference,amount))


def must_block():
    db=setup()
    try:
        with db:
            crew_movement(db,'online','crew_inventory_transfer',1)
    except sqlite3.IntegrityError as exc:
        assert 'online_inventory_reserved' in str(exc)
    else: raise AssertionError('Expected blocked online transfer')
    assert db.execute("SELECT quantity_allocated FROM inventory_allocations WHERE location_id='online'").fetchone()[0]==2
    db.close()


def checks():
    must_block()
    for action in ['crew_inventory_transfer','crew_inventory_adjustment']:
        db=setup()
        try:
            with db: crew_movement(db,'online',action,1)
        except sqlite3.IntegrityError as exc:
            assert 'online_inventory_reserved' in str(exc)
        else: raise AssertionError(f'{action} should fail')
        db.close()
    db=setup()
    with db: crew_movement(db,'kitchen','crew_inventory_transfer',1)
    db.close()
    db=setup()
    db.execute("UPDATE cart_reservations SET status='released' WHERE reservation_id='hold'")
    with db: crew_movement(db,'online','crew_inventory_transfer',1)
    db.close()
    db=setup()
    db.execute("UPDATE cart_reservations SET expires_at=datetime('now','-5 minutes') WHERE reservation_id='hold'")
    with db: crew_movement(db,'online','crew_inventory_adjustment',1)
    db.close()
    db=setup()
    with db:
        db.execute("UPDATE inventory_allocations SET quantity_allocated=0 WHERE location_id='online'")
        db.execute("INSERT INTO inventory_movements VALUES (1,'sale','online','square_order',2)")
    db.close()
    print('PASS: Crew online transfer and waste blocked; rollback verified; kitchen, release, expiry, payment paths allowed')

if __name__=='__main__': checks()

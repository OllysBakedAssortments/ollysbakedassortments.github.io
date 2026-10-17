import sqlite3

def trial(stock, qty, held, kind):
    db=sqlite3.connect(':memory:')
    db.executescript('''CREATE TABLE allocations(location TEXT PRIMARY KEY, qty INTEGER NOT NULL CHECK(qty>=0));
    CREATE TABLE movements(inventory_item_id INTEGER NOT NULL, kind TEXT NOT NULL, quantity INTEGER NOT NULL);
    INSERT INTO allocations VALUES('online',0); INSERT INTO allocations VALUES('kitchen',0);''')
    db.execute('UPDATE allocations SET qty=? WHERE location=\'online\'',(stock,))
    db.commit()
    failed=False
    try:
        with db:
            db.execute('UPDATE allocations SET qty=qty-? WHERE location=\'online\' AND qty>=? AND qty-?>=?',(qty,qty,qty,held))
            db.execute('INSERT INTO movements VALUES (CASE WHEN changes()=1 THEN 7 ELSE NULL END, ?, ?)',(kind,qty))
            if kind == 'transfer': db.execute('UPDATE allocations SET qty=qty+? WHERE location=\'kitchen\'',(qty,))
    except sqlite3.IntegrityError:
        failed=True
    actual=db.execute('SELECT location,qty FROM allocations ORDER BY location').fetchall()
    moves=db.execute('SELECT * FROM movements').fetchall()
    return failed,actual,moves

assert trial(2,1,2,'transfer')==(True,[('kitchen',0),('online',2)],[])
assert trial(5,3,2,'transfer')==(False,[('kitchen',3),('online',2)],[(7,'transfer',3)])
assert trial(5,4,2,'transfer')[0]
assert trial(5,3,2,'waste')==(False,[('kitchen',0),('online',2)],[(7,'waste',3)])
assert trial(2,1,0,'transfer')[0] is False
print('5 local transaction cases passed')

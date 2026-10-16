CREATE TABLE IF NOT EXISTS adventure_crew_assignments (
 assignment_id TEXT PRIMARY KEY, adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id), crew_user_id INTEGER NOT NULL REFERENCES crew_users(crew_user_id), assignment_type TEXT NOT NULL CHECK(assignment_type IN ('setup','inventory','chips','media','community','relationships','checkin','recap','updates','lifecycle','adventure_lead','operations_lead')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','expired','revoked')), starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, granted_by_crew_user_id INTEGER NOT NULL REFERENCES crew_users(crew_user_id), revoked_by_crew_user_id INTEGER REFERENCES crew_users(crew_user_id), revoked_at TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_adventure_active_assignment ON adventure_crew_assignments(adventure_id,crew_user_id,assignment_type) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_adventure_assignment_user ON adventure_crew_assignments(crew_user_id,adventure_id,status);
CREATE TABLE IF NOT EXISTS adventure_assignment_events (event_id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES adventure_crew_assignments(assignment_id),adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),actor_crew_user_id INTEGER NOT NULL REFERENCES crew_users(crew_user_id),event_type TEXT NOT NULL,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS uq_adventure_assignment_one_revoke ON adventure_assignment_events(assignment_id) WHERE event_type='revoked';
CREATE INDEX IF NOT EXISTS idx_adventure_assignment_events ON adventure_assignment_events(adventure_id,created_at);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.assignments.manage_operators',1);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.assignments.manage_leads',1);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.inventory.manage',1);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.chips.manage',1);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.media.manage',1);
INSERT OR IGNORE INTO crew_role_permissions(role,permission_key,allowed) VALUES('manager','adventures.community.manage',1);

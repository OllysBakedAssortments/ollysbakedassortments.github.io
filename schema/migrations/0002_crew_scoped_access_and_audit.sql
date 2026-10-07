-- Phase 2: scoped Crew authorization, grant authority, access requests, and canonical audit.
-- Apply only after 0001_schema_migrations.sql.

CREATE TABLE IF NOT EXISTS crew_access_assignments (
  assignment_id TEXT PRIMARY KEY,
  crew_user_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  manager_key TEXT,
  record_type TEXT,
  record_id TEXT,
  section_key TEXT,
  action_key TEXT,
  effect TEXT NOT NULL CHECK (effect IN ('allow','deny')),
  reason TEXT NOT NULL,
  granted_by_crew_user_id INTEGER NOT NULL,
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by_crew_user_id INTEGER,
  revoke_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crew_access_target_permission
  ON crew_access_assignments (crew_user_id, permission_key, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_crew_access_record
  ON crew_access_assignments (record_type, record_id, section_key, action_key);

CREATE TABLE IF NOT EXISTS crew_grant_authorities (
  authority_id TEXT PRIMARY KEY,
  crew_user_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  manager_key TEXT,
  may_grant_allow INTEGER NOT NULL DEFAULT 0 CHECK (may_grant_allow IN (0,1)),
  may_grant_deny INTEGER NOT NULL DEFAULT 1 CHECK (may_grant_deny IN (0,1)),
  reason TEXT NOT NULL,
  granted_by_crew_user_id INTEGER NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by_crew_user_id INTEGER,
  revoke_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crew_grant_authority_actor
  ON crew_grant_authorities (crew_user_id, permission_key, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS crew_access_requests (
  request_id TEXT PRIMARY KEY,
  crew_user_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  manager_key TEXT,
  record_type TEXT,
  record_id TEXT,
  section_key TEXT,
  action_key TEXT,
  requested_effect TEXT NOT NULL DEFAULT 'allow' CHECK (requested_effect IN ('allow','deny')),
  reason TEXT NOT NULL,
  requested_until TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','cancelled','expired')),
  resolved_by_crew_user_id INTEGER,
  resolution_reason TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crew_access_requests_status
  ON crew_access_requests (status, crew_user_id, created_at);

CREATE TABLE IF NOT EXISTS canonical_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('crew','longneck','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  previous_state_json TEXT,
  new_state_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canonical_audit_object
  ON canonical_audit_events (object_type, object_id, created_at);
CREATE INDEX IF NOT EXISTS idx_canonical_audit_actor
  ON canonical_audit_events (actor_type, actor_id, created_at);

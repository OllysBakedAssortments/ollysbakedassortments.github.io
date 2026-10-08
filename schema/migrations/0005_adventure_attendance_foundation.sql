CREATE TABLE IF NOT EXISTS adventure_attendance (
  attendance_id TEXT PRIMARY KEY,
  adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id),
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method TEXT NOT NULL CHECK (method IN ('rotating_qr','assisted_credential')),
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','revoked')),
  credential_id TEXT,
  verified_by_crew_user_id INTEGER,
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending','processed','not_eligible')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (adventure_id,longneck_id),
  UNIQUE (credential_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_attendance_longneck ON adventure_attendance (longneck_id,checked_in_at);
CREATE INDEX IF NOT EXISTS idx_adventure_attendance_adventure ON adventure_attendance (adventure_id,checked_in_at);
CREATE TABLE IF NOT EXISTS adventure_checkin_credentials (
  credential_id TEXT PRIMARY KEY,
  adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  credential_hash TEXT NOT NULL UNIQUE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('rotating_qr','assisted_credential')),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_longneck_id TEXT,
  revoked_at TEXT,
  created_by_crew_user_id INTEGER,
  CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS idx_adventure_checkin_credentials_active ON adventure_checkin_credentials (adventure_id,credential_type,expires_at);
CREATE TABLE IF NOT EXISTS adventure_checkin_controls (
  adventure_id TEXT PRIMARY KEY REFERENCES adventures(adventure_id),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
  extended_until TEXT,
  ended_at TEXT,
  updated_by_crew_user_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

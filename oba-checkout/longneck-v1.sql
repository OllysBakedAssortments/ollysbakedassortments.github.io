-- OBA Longneck Accounts V1 — Cloudflare D1 migration
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS longnecks (
  longneck_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deactivated')),
  avatar_key TEXT NOT NULL DEFAULT 'olly', email_verified_at TEXT, adult_confirmed_at TEXT NOT NULL,
  marketing_email INTEGER NOT NULL DEFAULT 0, marketing_sms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS longneck_sessions (
  session_id TEXT PRIMARY KEY, longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_longneck_sessions_user ON longneck_sessions(longneck_id);
CREATE TABLE IF NOT EXISTS longneck_email_tokens (
  token_id TEXT PRIMARY KEY, longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE TABLE IF NOT EXISTS longneck_chip_ledger (
  transaction_id TEXT PRIMARY KEY, longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, description TEXT NOT NULL, source_id TEXT, created_by_crew_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_longneck_chips_user ON longneck_chip_ledger(longneck_id,created_at DESC);
CREATE TABLE IF NOT EXISTS longneck_faves (
  longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), cookie_id TEXT NOT NULL, cookie_slug TEXT NOT NULL, cookie_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(longneck_id,cookie_id)
);
CREATE TABLE IF NOT EXISTS longneck_event_checkins (
  longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), event_id TEXT NOT NULL, event_name TEXT NOT NULL,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(longneck_id,event_id)
);
CREATE TABLE IF NOT EXISTS longneck_moments (
  moment_id TEXT PRIMARY KEY, longneck_id TEXT NOT NULL REFERENCES longnecks(longneck_id), event_id TEXT, caption TEXT, image_url TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, moderated_at TEXT, moderated_by_crew_user_id INTEGER
);

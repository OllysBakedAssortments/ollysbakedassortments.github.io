CREATE TABLE IF NOT EXISTS adventures (
  adventure_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('farmers_market','oba_popup','collaboration','special_event')),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','upcoming','event_day','live','recap_pending','past','postponed','rescheduled','cancelled','ended_early')),
  summary TEXT,
  description TEXT,
  location_name TEXT,
  location_address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  public_at TEXT,
  actual_started_at TEXT,
  actual_ended_at TEXT,
  recap_status TEXT NOT NULL DEFAULT 'pending' CHECK (recap_status IN ('pending','draft','ready','published')),
  recap_title TEXT,
  recap_body TEXT,
  recap_published_at TEXT,
  crowd_report TEXT CHECK (crowd_report IS NULL OR crowd_report IN ('quiet_cozy','steady_snacking','longnecks_everywhere','cookie_chaos')),
  created_by_crew_user_id INTEGER NOT NULL,
  updated_by_crew_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(slug)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_adventures_schedule ON adventures (starts_at, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_adventures_lifecycle ON adventures (lifecycle_status, starts_at);

CREATE TABLE IF NOT EXISTS adventure_status_history (
  status_event_id TEXT PRIMARY KEY,
  adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('crew','system')),
  actor_id TEXT,
  reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_adventure_status_history ON adventure_status_history (adventure_id, created_at);

CREATE TABLE IF NOT EXISTS adventure_updates (
  update_id TEXT PRIMARY KEY,
  adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','withdrawn')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  published_at TEXT,
  created_by_crew_user_id INTEGER NOT NULL,
  updated_by_crew_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_adventure_updates ON adventure_updates (adventure_id, status, published_at);

CREATE TABLE IF NOT EXISTS adventure_relationships (
  adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  related_adventure_id TEXT NOT NULL REFERENCES adventures(adventure_id),
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('series','follow_up','rescheduled_from','related')),
  created_by_crew_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (adventure_id, related_adventure_id, relationship_type),
  CHECK (adventure_id <> related_adventure_id)
);
CREATE INDEX IF NOT EXISTS idx_adventure_relationships_related ON adventure_relationships (related_adventure_id);

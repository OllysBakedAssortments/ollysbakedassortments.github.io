CREATE TABLE IF NOT EXISTS longneck_notification_preferences (
  longneck_id TEXT PRIMARY KEY,
  notification_style TEXT NOT NULL DEFAULT '1-star' CHECK (notification_style IN ('1-star','3-star','5-star')),
  weekly_drops INTEGER NOT NULL DEFAULT 1 CHECK (weekly_drops IN (0,1)),
  new_flavors INTEGER NOT NULL DEFAULT 1 CHECK (new_flavors IN (0,1)),
  cookie_watch INTEGER NOT NULL DEFAULT 0 CHECK (cookie_watch IN (0,1)),
  bertha_open INTEGER NOT NULL DEFAULT 0 CHECK (bertha_open IN (0,1)),
  markets_events INTEGER NOT NULL DEFAULT 0 CHECK (markets_events IN (0,1)),
  bulletin_email INTEGER NOT NULL DEFAULT 0 CHECK (bulletin_email IN (0,1)),
  updated_by_type TEXT NOT NULL DEFAULT 'longneck' CHECK (updated_by_type IN ('longneck','crew','system')),
  updated_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS longneck_crew_notes (
  note_id TEXT PRIMARY KEY,
  longneck_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_by_crew_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_longneck_crew_notes_longneck
ON longneck_crew_notes (longneck_id, created_at);

-- OBA migration foundation.
-- This table records repository-managed schema migrations.
-- Deployment tooling must insert a row only after the corresponding migration succeeds.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT,
  description TEXT
);

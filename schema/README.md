# OBA Database Schema Management

The current application predates a repository-backed migration system. From this point forward, every production database schema change must be represented by an ordered SQL migration in `schema/migrations/`.

The existing production schema is authoritative for legacy tables until it is explicitly baselined. Do not recreate or drop existing tables merely because their original CREATE statements are absent from this repository.

## Migration policy

1. Migrations are append-only after deployment.
2. Never edit an already-applied migration; add a new corrective migration.
3. Prefer additive changes before destructive changes.
4. Preserve existing IDs and historical rows when canonicalizing legacy systems.
5. Backfills must be deterministic and restart-safe where practical.
6. New uniqueness/integrity constraints must account for existing data before enforcement.
7. Sensitive state transitions and reward/attendance integrity belong in server-side services in addition to database constraints.
8. Production migration execution must be documented against the actual D1 binding/deployment configuration; this repository currently does not contain that deployment configuration.

## Naming

Use ordered names such as:

`0001_schema_migrations.sql`
`0002_scoped_crew_access.sql`
`0003_adventures.sql`

The exact numbering may change only before the first migration is applied.

## Phase 2 deployment boundary

`0002_crew_scoped_access_and_audit.sql` introduces the tables required by the scoped Crew authorization evaluator. The Phase 2B Worker must not be deployed before this migration is successfully applied to the target D1 database. Apply migrations in numeric order and record each successful version in `schema_migrations`.

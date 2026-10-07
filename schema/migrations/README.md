# Migration Execution Notes

`0001_schema_migrations.sql` establishes migration bookkeeping only. It intentionally does not alter any existing business table.

Before applying later migrations:

- confirm the production D1 database binding and deployment command;
- capture a production schema snapshot;
- compare that snapshot with the tables/columns referenced by the Worker;
- record the pre-migration row counts/balance invariants for business-critical tables;
- test each migration against a disposable copy first.

Do not infer missing legacy CREATE statements and apply them to production without comparing against the live schema.

- `0003_longneck_canonical_form.sql` — canonical Longneck Form support tables for Most Wanted preferences and internal Crew notes.

# Phase 3A — Canonical Adventure schema

## Scope
Schema only. This patch does **not** implement Worker APIs, UI, QR check-in, attendance, rewards, or automated lifecycle transitions.

## Install
1. In Cloudflare D1 database `oba-orders`, execute `schema/migrations/0004_canonical_adventures.sql` once.
2. Verify `adventures`, `adventure_status_history`, `adventure_updates`, `adventure_relationships` exist.
3. Record version 0004 in `schema_migrations` using the existing migration tracking convention after success.

## Verification (deferred until deployment)
- Reject invalid event types and lifecycle states.
- Reject events with ends_at <= starts_at.
- Reject duplicate slugs.
- Verify indexed list queries and status history foreign keys.
- Verify that schema migration does not change checkout, Reviews, Crew, or existing Longneck data.

## Architectural boundary
Adventure is canonical and has a permanent ID and slug. Operational updates are separate from Bulletin editorial issues. Bertha's home-base cart hours are not modeled as Adventures. Attendance, check-in, public discussion, media and rewards belong to later phases.

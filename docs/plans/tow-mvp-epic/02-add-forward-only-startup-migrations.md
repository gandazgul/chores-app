---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Replace duplicated `CREATE TABLE IF NOT EXISTS` bootstrap logic with statically registered TypeScript migrations. Make fresh and existing SQLite databases converge through the same chain before the server accepts requests."
affectedPaths:
  - "src/utils/db.*"
  - "src/**/migrations/**"
  - "scripts/setup_db.*"
  - "tests/**"
  - "deno.json"
  - "Containerfile"
  - "docs/adr/0006-forward-only-sql-migrations-applied-at-startup.md"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:51.263Z"
updatedAt: "2026-08-10T16:07:51.263Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 2
dependencies:
  - "01-convert-source-and-tests-to-typescript"
---

# Add Forward-Only Startup Migrations

## Context

The current schema bootstrap lives in both `src/utils/db.js` and
`scripts/setup_db.js`. `CREATE TABLE IF NOT EXISTS` cannot update an existing
SQLite database. ADR 0006 requires numbered, forward-only, hand-written SQL
migrations applied at startup.

## Objective

Add a migration mechanism that is included in the production bundle, records
applied versions, and runs before the app accepts requests. Remove duplicated
DDL from database bootstrap and setup scripts.

## Approach

Create statically registered TypeScript migration modules with hand-written SQL.
Add a `schema_migrations` ledger. Make the database startup path apply pending
migrations and fail fast on migration failure. Keep `scripts/setup_db.*` for
seed data only. Add lifecycle checks that prove a fresh database and an existing
database converge.

## Files to Modify

- `src/utils/db.*` — remove table bootstrap DDL and call migration application
  during database initialization.
- New migration registry and migration modules under `src/` — own numbered
  forward-only SQL migrations.
- `scripts/setup_db.*` — remove DDL and keep seed behavior only.
- `tests/**` — add migration and lifecycle coverage.
- `deno.json` — add or adjust lifecycle test tasks if needed.
- `Containerfile` — support production lifecycle verification if needed.
- `docs/adr/0006-forward-only-sql-migrations-applied-at-startup.md` — keep
  implementation aligned with the ADR.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/utils/db.*` — reuse the single database construction path.
- `node:sqlite` prepared-statement and `db.exec` style — use hand-written SQL,
  no query builder.
- `DB_ENV=test` — keep test database isolation.
- Existing DDL in `db.*` and `scripts/setup_db.*` — use as the baseline schema
  for migration 0001.

## Implementation Steps

- [ ] A statically imported migration registry lists numbered forward-only
      TypeScript migration modules.
- [ ] Migration 0001 creates the current baseline schema for a fresh database.
- [ ] The `schema_migrations` table records each applied migration version and
      prevents reapplication.
- [ ] The server applies all pending migrations before it accepts requests.
- [ ] A failed migration stops startup and does not mark that migration as
      applied.
- [ ] `src/utils/db.*` contains no `CREATE TABLE` statements for application
      tables.
- [ ] `scripts/setup_db.*` contains no DDL and only seeds data through the
      normal schema.
- [ ] A fresh database and an upgraded fixture database reach the same schema
      through migrations alone.
- [ ] Production lifecycle verification proves migrations run before readiness
      in the built container or production start path.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:production-lifecycle` or the project task added by
  this child for production lifecycle checks.
- Automated: direct migration tests cover fresh database, already-current
  database, and failed migration behavior.
- Expected result: a fresh SQLite file has `schema_migrations` and the baseline
  schema after startup.
- Expected result: an existing pre-migration database is upgraded without using
  `CREATE TABLE IF NOT EXISTS` bootstrap code.

## Edge Cases & Considerations

- Startup migration failure is a hard failure. Recovery is restore from backup
  plus fix-forward.
- The migration registry must be static so Astro includes migration code in the
  production bundle.
- Keep the single-writer assumption explicit. Do not design for multi-replica
  concurrent migration.

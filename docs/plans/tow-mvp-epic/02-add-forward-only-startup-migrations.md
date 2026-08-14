---
planId: "ca02a7de-3f3a-45a8-8d3f-e6777891e0fe"
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
objectiveCheckWaivers:
  []
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
createdAt: "2026-08-10T12:07:51-04:00"
updatedAt: "2026-08-14T04:40:02.457Z"
status: "verified"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 2
dependencies:
  - "01-convert-source-and-tests-to-typescript"
implementedAt: "2026-08-12T18:09:35.834Z"
verifiedAt: "2026-08-14T04:40:02.457Z"
userVerifiedAt: null
executionReport: "- Implemented static startup migrations: `src/db/migrations/index.ts` imports `0001_baseline.ts`, applies pending migrations transactionally, and enforces strict ledger version/name history.\n- Moved application-table DDL out of `src/utils/db.ts` and `scripts/setup_db.js`; `db.ts` now enables foreign keys and applies migrations before export, and setup now seeds only.\n- Added direct migration coverage for fresh, legacy, idempotent, rollback, validation failure, partial-schema, unknown-version, name-mismatch, and malformed-registry behavior.\n- Added production lifecycle coverage and `deno task test:production-lifecycle`; it builds the actual container and verifies fresh, legacy, and lock-gated readiness cases.\n- Updated ADR 0006 with the strict migration-history policy.\n- Verification passed: `deno task ci` (18 Deno tests; +9 direct migration tests, no tests removed) and `deno task test:production-lifecycle` (1 Docker/Podman lifecycle test)."
humanReviewMode: "ask"
humanReviewDecision: "skipped"
validationCheckpoint: null
executionMode: "worktree"
deliveryEvidence:
  version: 1
  mode: "worktree_merge"
  executionCommit: "9526c620d200554dd47670d2e3056d315a0cb8b7"
  targetBranch: "main"
  targetHeadBeforeMerge: "03e0eed7dc8ced0d9609ac1649a7602658327679"
validationCiAttempts: 0
validationSemanticRounds: 2
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

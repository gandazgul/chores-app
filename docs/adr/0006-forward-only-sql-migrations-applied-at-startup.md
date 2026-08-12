# ADR 0006: Forward-only SQL migrations applied at startup

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

The schema is created with `CREATE TABLE IF NOT EXISTS` in `src/utils/db.js` at
module load, and duplicated in `scripts/setup_db.js`. `IF NOT EXISTS` skips the
whole statement when the table exists, so a column added later never appears in
an existing database file. Every planned schema change in the MVP — the
assignee, per-user notification tokens, the resolution log's `due_at` and
resolution type — strands every existing database until a migration mechanism
exists. This is recorded as the main limitation of
[ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md).

The application is self-hosted: one container, one SQLite file, one writer.
There is no separate deployment pipeline that could run migrations out of band.

## Decision

Adopt numbered, forward-only, hand-written SQL migrations, applied automatically
when the server process starts, before it accepts requests.

- Migrations live as numbered TypeScript modules whose bodies are hand-written
  SQL (for example `migrations/0001_baseline.ts`). A static registry imports
  them in order. This makes the Astro production bundle include every migration;
  the runtime container does not need loose SQL files or filesystem discovery. A
  `schema_migrations` ledger table records applied versions. On startup the
  runner applies every pending migration in order, each inside its own
  transaction.
- Migration `0001` is the baseline: the current schema as it exists today. Fresh
  databases and existing databases converge to the same schema through the same
  chain. The `CREATE TABLE IF NOT EXISTS` bootstrap leaves `src/utils/db.ts`,
  and the duplicated DDL leaves `scripts/setup_db.js`; the migration chain
  becomes the single source of schema truth. The seed task keeps only its seed
  data.
- Migration history is strict. Startup rejects a ledger version that the running
  binary does not know, and rejects a recorded version/name pair that no longer
  matches the static registry. A current database with application tables but no
  ledger is accepted only after migration `0001` validates the required columns,
  primary keys, and foreign keys without losing rows. Partial or incompatible
  pre-ledger schemas stop startup instead of being marked current.
- Migration modules execute hand-written SQL through the same `node:sqlite`
  handle as the rest of the application. No migration framework and no query
  builder, per ADR 0003. The production-container verification must prove that
  both a fresh mounted database and an existing mounted database migrate before
  the server begins to accept requests.
- There are no down migrations. A bad migration is fixed by a new forward
  migration. The database file is the precious artifact: it must live on a
  persistent volume, and taking a file copy before deploying a schema change is
  the rollback strategy.

## Alternatives considered

- **A migration library or tool.** Rejected. It adds a dependency and an
  ownership burden for what is, here, an ordered list of SQL statements and a
  ledger table — and it cuts against ADR 0003's no-query-builder direction.
- **An explicit `deno task db:migrate` run at deploy time.** Rejected. The
  deployment is a plain container start on Kubernetes with no job hook; a
  forgotten manual migration means a broken deploy. Startup application makes
  the running code and the schema it expects inseparable, which is safe
  precisely because there is exactly one writer.
- **Up/down migrations.** Rejected. Down migrations are rarely tested and rarely
  safe against data written after the up migration. Forward-only plus a file
  backup is simpler and honest about what rollback means for SQLite.

## Consequences

**Good**

- Every schema change ships with the code that needs it; an existing database
  converges on first start after deploy.
- One source of schema truth. The `db.js` / `setup_db.js` duplication, and the
  drift it invited, ends.
- Startup application crashes early and loudly when a migration fails, before
  requests are served against a half-migrated schema.

**Bad or limiting**

- A failed migration prevents the server from starting. With no down migrations,
  recovery is restore-from-backup plus a fix-forward release.
- Startup application is only safe with a single replica. If the deployment ever
  scales beyond one writer, migration leadership must be revisited — but SQLite
  already confines the application to one writer, so this adds no new
  constraint.
- Migration files accumulate and are never edited after merge; each one is an
  immutable historical record.

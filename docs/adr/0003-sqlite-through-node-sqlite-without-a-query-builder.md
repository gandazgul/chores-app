# ADR 0003: SQLite through `node:sqlite` without a query builder

- **Status:** Accepted
- **Date:** 2026-08-10
- **Supersedes:** the earlier use of Knex.js as query builder and migration tool

## Context

The application stores users, chores, and completion logs. The data set is small: one household, tens of chores. The
whole application runs in one container, so a database server is unnecessary complexity.

The first design used Knex.js with a `knexfile.js` and migration files under
`data/migrations`. Knex needs a native SQLite3 driver, which is awkward under Deno. Deno now ships a built-in SQLite
module, `node:sqlite`, that needs no native dependency.

## Decision

Use the Deno built-in `node:sqlite` module directly. Remove Knex.js and the migration tool.

- `src/utils/db.js` opens one `DatabaseSync` connection at module load and exports it as the default export.
- The module chooses the file from the `DB_ENV` environment variable:
  `chores.test.db` for `test`, `chores.db` for `production`, and `chores.dev.db`
  otherwise.
- The module runs `PRAGMA foreign_keys = ON;` and then
  `CREATE TABLE IF NOT EXISTS` for `users`, `chores`, and `completion_logs`. Schema creation happens on first import,
  not in a separate migration step.
- Callers write SQL by hand with `db.prepare(...)` and bind values as parameters. Astro pages and API routes import the
  connection directly.
- `scripts/setup_db.js` (`deno task db:setup`) repeats the same schema and seeds development data.

## Consequences

**Good**

- No native dependency, no build step, and no database server. The container needs only the Deno binary and a writable
  volume.
- Queries are visible SQL. There is no query-builder layer to learn or debug.
- `DatabaseSync` is synchronous, so Astro pages can read chores in the frontmatter without `await`.

**Bad or limiting**

- **There is no migration history.** `CREATE TABLE IF NOT EXISTS` creates a missing table but never changes an existing
  one. A new column or a changed constraint will not reach a database that already exists. A migration mechanism is
  needed before the schema changes again.
- The schema lives in two places, `src/utils/db.js` and `scripts/setup_db.js`. The two copies can drift apart.
- Importing `db.js` opens a file handle and writes schema as a side effect. A test or a script cannot import the module
  without touching a database file.
- The connection is a module singleton, so the application is bound to one process on one machine. Horizontal scaling
  requires a different persistence decision.
- Rows are untyped objects. See
  [ADR 0002](0002-typescript-instead-of-javascript-with-jsdoc.md).
  
## Notes on the current schema

The `chores` table declares columns that no code writes yet: `priority`,
`remind_until_done`, and `notification_sent_at`. They are reserved for planned features. Treat them as unused until a
feature sets them.

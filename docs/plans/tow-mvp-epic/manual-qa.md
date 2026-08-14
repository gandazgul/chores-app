# Manual QA for tow-mvp-epic

This checklist is advisory. It does not change RunWield verification status.

<!-- runwield:manual-qa:start child="tow-mvp-epic/02-add-forward-only-startup-migrations" -->

## Add Forward-Only Startup Migrations

Manual verification steps for
tow-mvp-epic/02-add-forward-only-startup-migrations

- [ ] Start the app with an empty SQLite database file. Confirm the server
      reaches ready state and logs show migration execution, not table bootstrap
      creation.
- [ ] Open the new database and verify these objects exist: `schema_migrations`,
      all baseline application tables, and one row for the baseline migration
      version in `schema_migrations`.
- [ ] Start the app with a legacy database that has old schema only. Confirm
      startup succeeds, migrations run, and the schema matches a fresh install
      result.
- [ ] Open the legacy database before and after startup and verify the migration
      ledger changed only after startup, with the expected next migration rows
      appended.
- [ ] Run `scripts/setup_db` against the same database and verify it only writes
      seed data; confirm it does not create new tables when run on an already
      migrated database.

<!-- runwield:manual-qa:end child="tow-mvp-epic/02-add-forward-only-startup-migrations" -->

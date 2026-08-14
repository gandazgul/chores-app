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

<!-- runwield:manual-qa:start child="tow-mvp-epic/03-make-occurrence-resolution-transactional-and-reversible" -->

## Make Occurrence Resolution Transactional and Reversible

Manual verification steps for
tow-mvp-epic/03-make-occurrence-resolution-transactional-and-reversible

- [ ] Create a recurring chore, open it, and complete it. Then run the same
      complete request again. Confirm that only one successor occurrence is
      created and one completion log exists for that action.
- [ ] Call `GET /api/chores` and verify only rows with `status: "open"` are
      returned for active occurrences; completed rows are not active in this
      list.
- [ ] Un-complete the completed recurring occurrence that has no successor
      changes. Confirm the response is success, the direct successor is removed,
      and only one open occurrence remains in the chain.
- [ ] Edit or mark the direct successor as done, then request un-complete on the
      prior occurrence. Confirm the API returns HTTP 409 and that no rows change
      (status, logs, and successor links stay as they were).
- [ ] Run a read-only DB query for each recurrence chain (for example by
      `recurrence_parent_id`) and verify there is never more than one row with
      `status = 'open'` after completion and un-completion actions.
- [ ] For a completed non-recurring chore, toggle complete then un-complete
      twice and confirm each call is idempotent and no duplicate successor or
      log rows are created.

<!-- runwield:manual-qa:end child="tow-mvp-epic/03-make-occurrence-resolution-transactional-and-reversible" -->

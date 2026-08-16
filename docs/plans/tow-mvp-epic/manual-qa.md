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

<!-- runwield:manual-qa:start child="tow-mvp-epic/04-rename-the-product-to-tow" -->

## Rename the Product to Tow

Manual verification steps for tow-mvp-epic/04-rename-the-product-to-tow

- [ ] Open home page `http://127.0.0.1:8080` with auth off. Confirm the browser
      title, shared header, page heading, subtitle, footer text, and logo alt
      text all use `Tow`, and the heading line is `Tow` with subtitle
      `STEADY HOUSEHOLD MANAGEMENT`.
- [ ] Open the home page in desktop and mobile view. Check that the Tow mark is
      centered, not stretched or clipped, and does not create horizontal or
      nested scroll bars.
- [ ] Open `http://127.0.0.1:8080/login` with auth on. Confirm the screen shows
      `Tow` title and logo text, and the existing Google sign-in control still
      works as before.
- [ ] Open browser developer tools and inspect `/manifest.json`. Confirm `name`
      is `Tow`, `short_name` is `Tow`, `theme_color` is `#005f6a`, and 192x192
      and 512x512 manifest icon entries point to valid icon files.
- [ ] In the same browser, open each linked icon URL (favicon, touch icon,
      manifest icons) and confirm each one loads, has the correct media type,
      and shows the new circular Tow mark that is readable at small sizes.
- [ ] Manually check `README.md` and `docs/domain-language.md` to ensure current
      product naming says `Tow` and old labels like `Chores App` are removed
      from user-facing descriptions and glossary.

<!-- runwield:manual-qa:end child="tow-mvp-epic/04-rename-the-product-to-tow" -->

<!-- runwield:manual-qa:start child="tow-mvp-epic/05-provision-household-users-behind-an-allowlist" -->

## Provision Household Users Behind an Allowlist

Manual verification steps for
tow-mvp-epic/05-provision-household-users-behind-an-allowlist

- [ ] Start the app with `ALLOWED_EMAILS` set to a known allowlist. Sign in with
      a Google account in that list. Confirm login succeeds and a `users` record
      is created with `id`, `email`, and `name` before session use.
- [ ] Try to sign in with a Google account that is not in `ALLOWED_EMAILS`.
      Confirm the page returns `401`, no new `users` row is written, and no
      session cookie is set.
- [ ] With a previously allowed user, add that user’s email to a value with
      mixed case and spaces (for example `ALLOW@house.com, another@x.com`), then
      sign in using matching email in different case and spacing. Confirm
      allowlist matching still allows login.
- [ ] Keep a valid session, then remove that email from `ALLOWED_EMAILS` and
      open a protected page. Confirm middleware rejects the session and clears
      the session cookie, then sends the unauthenticated flow.
- [ ] Set `ENABLE_AUTH=false`. Open the app and confirm mock user is available
      with normal access without Google sign-in or `ALLOWED_EMAILS` checks.
- [ ] In the database, check that `users.name` is present in the `users` table
      schema and unchanged existing rows still load without errors after
      upgrade.

<!-- runwield:manual-qa:end child="tow-mvp-epic/05-provision-household-users-behind-an-allowlist" -->

<!-- runwield:manual-qa:start child="tow-mvp-epic/06-restore-csrf-protection-for-browser-mutations" -->

## Restore CSRF Protection for Browser Mutations

Manual verification steps for
tow-mvp-epic/06-restore-csrf-protection-for-browser-mutations

- [ ] Start the app and open it in a browser. Run one normal create, update, and
      delete flow and confirm each action still succeeds.
- [ ] Open browser dev tools and send a mutation request (POST/PUT/PATCH/DELETE)
      with no `Origin` header. Confirm the request is rejected.
- [ ] Send the same request with an incorrect `Origin` host. Confirm the request
      is rejected.
- [ ] Send the same request with the exact same-site `Origin` value. Confirm the
      request is accepted and the record changes.
- [ ] Run a browser mutation in `ENABLE_AUTH=false` mode using the mock-user
      path. Confirm login and mutation still work without Google signin.
- [ ] If a reverse proxy is in place, test the same mutation flows through the
      proxy URL and confirm only the proxy origin is accepted and other origins
      are rejected.

<!-- runwield:manual-qa:end child="tow-mvp-epic/06-restore-csrf-protection-for-browser-mutations" -->

<!-- runwield:manual-qa:start child="tow-mvp-epic/07-add-household-assignment-model-and-apis" -->

## Add Household Assignment Model and APIs

Manual verification steps for
tow-mvp-epic/07-add-household-assignment-model-and-apis

- [ ] Log in as two members of one household and open the chore list in each
      session. Confirm both users can see the same open household chores.
- [ ] Create a new chore without an assignee, with Pool, and with another
      member. Check that the default assignee is the creator, the Pool choice
      works, and a specific-member choice sets that member.
- [ ] Open a chore in Pool and run the claim action as a signed-in member. Check
      that the chore assignee becomes that member.
- [ ] Run assign, reassign, and release actions on chores as a signed-in member.
      Check assignee changes match the action and unassigned time updates when
      released.
- [ ] Open a chore as a non-creator and edit, delete, complete, claim, assign,
      and release it. Confirm actions succeed without owner-only 403 blocks.
- [ ] Call `GET /api/members` while signed in and check only `id`, `name`, and
      `picture` are returned. Call without auth and confirm access is denied.
      Open `docs/domain-language.md` and verify Assignee, Pool, Claim, Member,
      and Reassign are defined.

<!-- runwield:manual-qa:end child="tow-mvp-epic/07-add-household-assignment-model-and-apis" -->

<!-- runwield:manual-qa:start child="tow-mvp-epic/08-ship-create-edit-delete-and-assignment-ui" -->

## Ship Create Edit Delete and Assignment UI

Manual verification steps for
tow-mvp-epic/08-ship-create-edit-delete-and-assignment-ui

- [ ] Open the chore page in a browser at `http://127.0.0.1:8080` and check that
      the modal can open in both create and edit modes.
- [ ] Create a new one-off chore with a direct due date and time set for one
      hour from now; check the chore appears with the correct due time shown in
      the list.
- [ ] Edit the chore in the browser and change at least one field (for example
      title or due time); check the updated values show on the page after save.
- [ ] Use assignment actions: set the chore to Pool, claim it, release it back
      to Pool, and assign it to another member; check the assignee state updates
      correctly after each action.
- [ ] Toggle done for the chore and verify the state change is still visible and
      correct.
- [ ] Delete the chore and confirm it is removed from the list after the
      confirmation or safe delete step.

<!-- runwield:manual-qa:end child="tow-mvp-epic/08-ship-create-edit-delete-and-assignment-ui" -->

<!-- runwield:manual-qa:start child="tow-mvp-epic/09-add-whats-next-board-and-pool-views" -->

## Add Whats Next Board and Pool Views

Manual verification steps for
tow-mvp-epic/09-add-whats-next-board-and-pool-views

- [ ] Open the app and confirm that the default view is What's Next.
- [ ] Confirm that What's Next shows assigned open chores for the signed-in
      member, grouped by the correct household due-date bucket.
- [ ] Switch to Board and confirm that the searchable full household chore list
      is visible.
- [ ] Use Board search and confirm that matching active and completed chores
      appear.
- [ ] Switch to Pool and confirm that only unassigned open chores appear.
- [ ] Claim a Pool chore and confirm that it leaves Pool and appears in the
      assigned chore views.

<!-- runwield:manual-qa:end child="tow-mvp-epic/09-add-whats-next-board-and-pool-views" -->

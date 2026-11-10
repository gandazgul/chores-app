# Tow MVP Completeness Report

_Date: 2026-08-26_

## Summary

The Tow MVP is complete enough to use as an MVP. It has the key product
foundations from `docs/product-brief.md`: household Members, assignment, the
Pool, What's Next, direct due dates and times, Push Notification settings, the
Nag scheduler, Skip, Pool age pressure, migrations, and CSRF protection.

The main remaining risk is operational confidence, not product shape. Before
day-to-day use, verify production startup, scheduler recovery, and real Gotify
delivery in the target deployment environment.

## Sources Reviewed

- `docs/product-brief.md`
- `docs/roadmap.md`
- `docs/plans/tow-mvp-epic.md`
- `docs/plans/tow-mvp-epic/*.md`
- `docs/adr/0007-nag-cadence-escalation-and-quiet-hours.md`

## Browser Smoke Test

Test URL: `http://127.0.0.1:8092/`

Environment used:

```sh
ENABLE_AUTH=false GOTIFY_URL= POOL_BLAST_LEAD_HOURS=0 HOUSEHOLD_TZ=America/New_York deno task dev --host 127.0.0.1 --port 8092
```

Verified with `agent-browser`:

- Tow branding loaded.
- What's Next, Board, and Pool were reachable.
- A chore could be created.
- Title and due date could be edited.
- A chore could be released to Pool.
- A Pool chore could be claimed.
- The reminder toggle persisted.
- Skip worked with the 30-second Undo period.
- After Undo expired, the skipped chore left the active view.
- Notification settings could save and clear a token.
- The saved token was not shown in the page text or input value.
- Mobile viewport had no horizontal overflow.

Screenshots:

- `test-results/tow-mvp-home-initial.png`
- `test-results/tow-mvp-pool-after-release.png`
- `test-results/tow-mvp-mobile-home.png`

## Automated Checks

### Passed

```sh
deno task ci
```

Result: passed. The run reported 124 tests passed and 0 failed.

Individual retry checks also passed:

```sh
E2E_PORT=8096 deno run -A npm:playwright test tests/e2e/chore-management.spec.ts --project=chromium
E2E_PORT=8097 deno run -A npm:playwright test tests/e2e/gotify-settings.spec.ts --project=chromium
```

### Did Not Pass Cleanly

```sh
E2E_PORT=8093 deno task test:e2e
```

Result: 16 passed, 1 failed. The failed spec passed when run by itself.

```sh
E2E_PORT=8095 deno task test:e2e
```

Result: 15 passed, 2 failed. The failed specs passed when run by themselves.

This suggests E2E parallel-run flakiness or isolation problems rather than a
clear product behavior failure.

```sh
deno task test:production-lifecycle
```

Result: timed out after 300 seconds while still running.

This is the largest confidence gap because the MVP depends on production
startup, startup migrations, and scheduler recovery.

## Gaps Found

1. **Production lifecycle verification did not complete.** The
   `deno task test:production-lifecycle` command timed out. This leaves a
   confidence gap for production startup, migration behavior, and scheduler
   recovery.

2. **The full E2E suite is flaky under parallel execution.** Full-suite runs
   failed, but the failing specs passed when run individually. Fixing the test
   isolation would make release checks more trustworthy.

3. **Live Gotify delivery was not verified.** Settings and secret handling were
   tested. A real phone notification was not tested because no live Gotify
   endpoint and token were available.

4. **Real two-Google-account allowlist flow was not manually verified.**
   Automated tests cover allowlist behavior. The browser smoke test used
   `ENABLE_AUTH=false`.

5. **Skipped history appears under a Done section after Undo expires.** This
   matches current tests, but the product language treats Skip as different from
   Done. A future UI copy improvement could rename history sections to
   `Resolved` or split Done and Skipped history.

## Opinion

Tow is not missing key MVP product foundations. It is complete enough to start
using as an MVP.

Before relying on it as the household system of record, first prove these
operational items in the real deployment:

- production server starts with the mounted SQLite file;
- migrations run before readiness;
- only one scheduler loop starts;
- pending delivery rows recover after restart;
- a real Gotify token receives a `TOW: <title>` notification;
- the second household account can sign in through the allowlist.

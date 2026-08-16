---
planId: "2106dd1c-e649-4dd4-8633-e6e4101226a3"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Replace the single chore list as the default experience with What's Next, Board, and Pool views. Move Fuse search to the Board and use household timezone bucketing for the landing view."
affectedPaths:
  - "src/pages/index.astro"
  - "src/components/**"
  - "src/utils/**"
  - ".env.example"
  - "tests/e2e/**"
objectiveCheckWaivers:
  []
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T12:07:52-04:00"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 9
dependencies:
  - "08-ship-create-edit-delete-and-assignment-ui"
implementedAt: "2026-08-16T02:53:01.509Z"
userVerifiedAt: null
executionReport: "- Implemented What’s Next, Board, and Pool views over one Solid state source; Board owns Fuse search, Pool shows unassigned rows, and each view has assignment-matched Done disclosure. Review feedback applied: new UI pieces are one component per file, and tabs use mild `rounded-t-sm` top corners with square bottoms.\n- Added `src/utils/householdTime.ts` for UTC default, IANA timezone validation, household date keys, due-date display, and deterministic What’s Next bucket selection.\n- Updated SSR and `GET /api/chores` to return open plus completed rows; production startup validates `HOUSEHOLD_TZ`; `.env.example` documents UTC default and invalid-value rejection.\n- Preserved mutations across derived views: create/edit/delete, Done/reopen, Claim/Assign/Release/Reassign, recurring successor reconciliation, and non-destructive recurring reopen conflicts.\n- Tests changed: added 8 unit tests in `householdTime.test.ts` and 1 Playwright three-view journey; updated existing API/e2e specs to cover completed rows/reopen and to enter Board for full-list expectations; no tests deleted or replaced.\n- Verification passed: `deno test -A src/utils/householdTime.test.ts`; `DB_ENV=test deno test -A src/pages/api/chores/chores.test.ts`; `deno task ci` (64 tests passed; Astro check reports existing login hint only); `E2E_PORT=8094 deno task test:e2e` (13 passed).\n- Headed browser verified on worktree server `http://127.0.0.1:8091/`: desktop and iPhone 14 snapshots saved to `artifacts/tow-child-09-desktop.png` and `artifacts/tow-child-09-mobile.png`; What’s Next default, Board/Pool tabs visible, no clipping, ArrowRight tab selection works, modal Escape returns focus to New Chore, console only Vite debug logs, no failed fetch/XHR captured.\n- Headed data journey verified: oldest overdue bucket wins, then today, then nearest future after completion/reload; Pool chore can be claimed/released, Board search finds it, completed rows remain checked until reload, Done search exposes completed matches, and reopen returns the row to active placement.\n- Configuration verified: no `HOUSEHOLD_TZ` server used UTC labels; `HOUSEHOLD_TZ=America/Los_Angeles` changed display for stored `2030-03-04T02:30:00.000Z` from `Mar 4, 2030, 2:30 AM` UTC to `Mar 3, 2030, 6:30 PM`; `HOUSEHOLD_TZ=Not/AZone deno run -A --env scripts/start_production.ts` exited 1 with a clear HOUSEHOLD_TZ error.\n- Note: port 8080 was occupied by `/Users/gandazgul/Documents/web/chores-app`, so browser verification used worktree-owned ports 8091/8095 and E2E used `E2E_PORT` while keeping default 8080 behavior unchanged."
executionMode: "worktree"
executionBaselineTree: "7f4247e1c7fff3a60e522d3d3efe56a57f365f49"
worktreeId: "589a9025"
worktreePath: "/Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-09-add-whats-next-board-and-pool-vi-589a9025"
worktreeBranch: "worktree/tow-mvp-epic-09-add-whats-next-board-and-pool-vi-589a9025"
worktreeBaseBranch: "main"
worktreeStatus: "completed"
validationCiAttempts: 0
validationObjectiveCheckAttempts: 0
validationSemanticRounds: 1
status: "validated_reviewer"
validationCheckpoint: null
updatedAt: "2026-08-16T04:35:10.209Z"
humanReviewMode: "ask"
humanReviewDecision: "skipped"
---

# Add Whats Next Board and Pool Views

## Context

The MVP default route is not a single private chore list. It is a household
experience with three views: What's Next as the default landing view, Board as
the full searchable household list, and Pool as the unassigned inbox.

## Objective

Ship the three browser views over the household data. Show the signed-in
member's assigned open chores due today in the household timezone, or the
nearest upcoming due date when nothing is due today. Keep client-side Fuse
search on the Board.

## Approach

Keep the SSR shell plus props-as-channel pattern. Add server-side queries that
prepare the data for each view, using `HOUSEHOLD_TZ` with a UTC default.
Restructure the island set to switch between views without inventing a new
data-fetch model unless Planner finds that the existing pattern is insufficient.

## Files to Modify

- `src/pages/index.astro` — query household chores and members for the three
  views and pass props to islands.
- `src/components/**` — add What's Next, Board, Pool, and view navigation
  components or restructure existing list components.
- `src/utils/**` — add household timezone bucketing helpers if useful.
- `.env.example` — document `HOUSEHOLD_TZ` if not already correct.
- `tests/e2e/**` — cover default landing, board search, and pool reachability.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `ChoreList` and `ChoreItem` display patterns — reuse list rendering where
  practical.
- `Fuse` client-side search — keep it client-side and move it to Board.
- Astro frontmatter database query pattern — continue server-prepared props.
- Existing due date display code — extend it with household timezone rules.

## Implementation Steps

- [ ] The default route opens on What's Next for the signed-in member.
- [ ] What's Next shows the signed-in member's assigned open chores due today
      using `HOUSEHOLD_TZ` bucketing.
- [ ] When no assigned open chore is due today, What's Next shows the nearest
      upcoming due-date bucket.
- [ ] Board is reachable as a deliberate second view and shows all household
      chores visible to a signed-in member.
- [ ] Fuse search exists on Board and no longer drives the default What's Next
      view.
- [ ] Pool is reachable as a deliberate second view and shows unassigned open
      chores.
- [ ] `HOUSEHOLD_TZ` defaults to UTC when not configured and uses an IANA
      timezone when configured.
- [ ] View language frames Pool as ambient pressure and does not push or shame
      members.
- [ ] Existing create, edit, delete, done, and assignment controls remain usable
      from the relevant views.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:e2e` with specs for What's Next today bucket,
  nearest-due fallback, Board search, and Pool reachability.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, confirm the default view is What's Next, switch to
  Board and search, then switch to Pool and claim an item.
- Expected result: household timezone changes only bucketing and display, not
  UTC storage.

## Edge Cases & Considerations

- Per-user timezones are out of scope. Use one household timezone.
- Do not use Pool age for nag timing here. Pool nudge arrives in P3.
- Pairing is recommended because this changes the main product flow and visual
  hierarchy.

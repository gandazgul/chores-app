---
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
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:52.088Z"
updatedAt: "2026-08-10T16:07:52.088Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 9
dependencies:
    - "08-ship-create-edit-delete-and-assignment-ui"
---

# Add Whats Next Board and Pool Views

## Context

The MVP default route is not a single private chore list. It is a household experience with three views: What's Next as the default landing view, Board as the full searchable household list, and Pool as the unassigned inbox.

## Objective

Ship the three browser views over the household data. Show the signed-in member's assigned open chores due today in the household timezone, or the nearest upcoming due date when nothing is due today. Keep client-side Fuse search on the Board.

## Approach

Keep the SSR shell plus props-as-channel pattern. Add server-side queries that prepare the data for each view, using `HOUSEHOLD_TZ` with a UTC default. Restructure the island set to switch between views without inventing a new data-fetch model unless Planner finds that the existing pattern is insufficient.

## Files to Modify

- `src/pages/index.astro` — query household chores and members for the three views and pass props to islands.
- `src/components/**` — add What's Next, Board, Pool, and view navigation components or restructure existing list components.
- `src/utils/**` — add household timezone bucketing helpers if useful.
- `.env.example` — document `HOUSEHOLD_TZ` if not already correct.
- `tests/e2e/**` — cover default landing, board search, and pool reachability.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `ChoreList` and `ChoreItem` display patterns — reuse list rendering where practical.
- `Fuse` client-side search — keep it client-side and move it to Board.
- Astro frontmatter database query pattern — continue server-prepared props.
- Existing due date display code — extend it with household timezone rules.

## Implementation Steps

- [ ] The default route opens on What's Next for the signed-in member.
- [ ] What's Next shows the signed-in member's assigned open chores due today using `HOUSEHOLD_TZ` bucketing.
- [ ] When no assigned open chore is due today, What's Next shows the nearest upcoming due-date bucket.
- [ ] Board is reachable as a deliberate second view and shows all household chores visible to a signed-in member.
- [ ] Fuse search exists on Board and no longer drives the default What's Next view.
- [ ] Pool is reachable as a deliberate second view and shows unassigned open chores.
- [ ] `HOUSEHOLD_TZ` defaults to UTC when not configured and uses an IANA timezone when configured.
- [ ] View language frames Pool as ambient pressure and does not push or shame members.
- [ ] Existing create, edit, delete, done, and assignment controls remain usable from the relevant views.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:e2e` with specs for What's Next today bucket, nearest-due fallback, Board search, and Pool reachability.
- Manual headed browser check: run `deno task dev`, open `http://127.0.0.1:8080`, confirm the default view is What's Next, switch to Board and search, then switch to Pool and claim an item.
- Expected result: household timezone changes only bucketing and display, not UTC storage.

## Edge Cases & Considerations

- Per-user timezones are out of scope. Use one household timezone.
- Do not use Pool age for nag timing here. Pool nudge arrives in P3.
- Pairing is recommended because this changes the main product flow and visual hierarchy.
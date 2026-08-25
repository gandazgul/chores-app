---
planId: "d30431b6-4fc8-4736-b15f-6ce71893a889"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add Skip as a first-class occurrence resolution, stop Nags transactionally, and offer a server-enforced 30-second Undo before skipped history moves to Done."
affectedPaths:
  - "src/db/migrations/**"
  - "src/domain/occurrenceResolution.ts"
  - "src/domain/occurrenceResolution.test.ts"
  - "src/pages/api/chores/**"
  - "src/pages/index.astro"
  - "src/components/**"
  - "src/scheduler/assignedNagScheduler.test.ts"
  - "src/types.ts"
  - "tests/e2e/**"
  - "tests/production_lifecycle.ts"
  - "docs/domain-language.md"
objectiveChecks:
  - id: "OC1"
    command: "deno eval 'import{DatabaseSync as D}from\"node:sqlite\";import{applyMigrations as m}from\"./src/db/migrations/index.ts\";import{updateOccurrence as u}from\"./src/domain/occurrenceResolution.ts\";const d=new D(\":memory:\");m(d);d.prepare(\"INSERT INTO users(id,email)VALUES(?,?)\").run(\"u\",\"x@x\");d.prepare(\"INSERT INTO chores(id,user_id,title,recurrence)VALUES(?,?,?,?)\").run(\"c\",\"u\",\"C\",JSON.stringify({rrule:\"FREQ=DAILY\"}));const t=(s:number)=>new Date(Date.UTC(2030,0,1,0,0,s));u(d,\"c\",{resolution:\"skipped\"}as any,{now:t(0)});const k=(d.prepare(\"SELECT id FROM chores WHERE recurrence_parent_id=?\").get(\"c\")as any)?.id;if(k)d.prepare(\"DELETE FROM chores WHERE id=?\").run(k);const r=u(d,\"c\",{resolution:\"open\"}as any,{now:t(10)}),x=d.prepare(\"SELECT status,(SELECT count(*)FROM completion_logs WHERE chore_id=chores.id)n FROM chores WHERE id=?\").get(\"c\")as any;if(r.kind!==\"conflict\"||x.status!==\"skipped\"||x.n!==1)throw 0'"
    rationale: "This fails until recurring Undo detects a missing generated Next Occurrence and preserves the skipped occurrence and its log without mutation."
  - id: "OC2"
    command: "deno eval 'import{DatabaseSync as D}from\"node:sqlite\";import{applyMigrations as m}from\"./src/db/migrations/index.ts\";import{updateOccurrence as u}from\"./src/domain/occurrenceResolution.ts\";const d=new D(\":memory:\");m(d);d.prepare(\"INSERT INTO users(id,email)VALUES(?,?)\").run(\"u\",\"u@x\");d.prepare(\"INSERT INTO chores(id,user_id,title)VALUES(?,?,?)\").run(\"c\",\"u\",\"C\");const t=(s:number)=>new Date(Date.UTC(2030,0,1,0,0,s));u(d,\"c\",{resolution:\"skipped\"}as any,{now:t(0)});const a=u(d,\"c\",{resolution:\"open\"}as any,{now:t(30)});u(d,\"c\",{resolution:\"skipped\"}as any,{now:t(40)});const b=u(d,\"c\",{resolution:\"open\"}as any,{now:t(71)}),x=d.prepare(\"SELECT status FROM chores WHERE id=?\").get(\"c\")as any;if(a.kind!==\"updated\"||b.kind!==\"conflict\"||x.status!==\"skipped\")throw 0'"
    rationale: "This fails until server time permits Undo at the inclusive 30-second boundary and rejects it after the deadline without reopening the Chore."
  - id: "OC3"
    command: "grep -q 'Skip remains active and survives refresh' tests/e2e/three-view-journey.spec.ts && CI=1 E2E_PORT=18187 deno task test:e2e --grep 'Skip remains active and survives refresh'"
    rationale: "This browser scenario can pass only after the visible Skip and Undo flow remains in the active list and is reconstructed across a real page refresh."
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:52.630Z"
updatedAt: "2026-08-25T02:28:46.576Z"
status: "validated"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 13
dependencies:
  - "12-send-assigned-nag-deliveries-from-the-scheduler"
implementedAt: "2026-08-24T14:12:37.405Z"
validatedAt: "2026-08-25T02:28:46.576Z"
userVerifiedAt: null
executionReport: "- Implemented Skip/Undo: migration v7 adds `completion_logs.resolution`; domain/API support `resolution: \"skipped\" | \"open\"`, reject ambiguous commands, write server `resolved_at`, enforce 30-second inclusive Undo, and protect recurring successor conflicts.\n- Implemented Nag stop and recurrence behavior: Skip clears Nag eligibility, supersedes pending assigned-Nag slots transactionally, records skipped logs, and creates exactly one recurring successor; Undo restores a fresh Nag anchor when valid.\n- Implemented UI behavior: visible secondary Skip, Skipped status, accessible Undo countdown, refresh-safe active-row retention, expiry movement into Done disclosure, and no completion checkmark/Undo in skipped history across What's Next, Board, and Pool.\n- Updated docs: `docs/domain-language.md` now defines Skip as a neutral resolution and updates Completion Log/Recurrence language.\n- Tests changed: +6 Deno tests and +3 Playwright tests; no tests removed. Existing tests were extended for completed log resolution, skipped GET metadata, skipped scheduler exclusion, and production migration v7 readiness.\n- Verification passed: `deno task ci` (108 Deno tests passed; Astro check reports 0 errors/0 warnings/1 existing hint in `src/pages/login.astro`), `CI=1 E2E_PORT=18193 deno task test:e2e` (17 passed), `deno task test:production-lifecycle` (1 passed), and all three Objective Checks passed.\n- Headed browser: worktree dev server ran at `http://127.0.0.1:18080` with `ENABLE_AUTH=false` because `:8080` belonged to another checkout; checked What's Next, Board, and Pool Skip flows, refresh recovery, Undo, keyboard-accessible button names, and 30-second expiry into Done history.\n- Browser evidence: `artifacts/tow13-headed-active-skip.png`, `artifacts/tow13-headed-board-skip.png`, `artifacts/tow13-headed-pool-skip.png`, `artifacts/tow13-headed-pool-expired-done-open.png`; clean fresh headed session had URL `http://127.0.0.1:18080/`, title `Tow`, no captured failed fetch/XHR requests, and only Vite debug console messages.\n- No unresolved blockers."
humanReviewMode: "ask"
humanReviewDecision: "skipped"
validationCheckpoint: null
executionMode: "worktree"
deliveryEvidence:
  version: 1
  mode: "worktree_merge"
  executionCommit: "0bf9a48cca96ed636083194794708208e62f525f"
  targetBranch: "main"
  targetHeadBeforeMerge: "0981b80e3c047e1f7d69e034be233275ea26b42a"
validationCiAttempts: 0
validationObjectiveCheckAttempts: 0
validationSemanticRounds: 0
---

# Add Skip Resolution and Nag Stop Behavior

## Context

A Member must not falsely mark a Chore Done only to stop its Nags. The
occurrence schema already reserves `status = 'skipped'`, and the current
completion flow already owns status change, Completion Log insertion, Next
Occurrence creation, and pending Delivery Slot supersession in one
`BEGIN IMMEDIATE` transaction. Skip is not yet an accepted API transition,
`completion_logs` cannot distinguish a completion from a skip, and the browser
has no Skip or Undo control.

## Objective

Let a Member resolve an open Chore occurrence with one neutral **Skip** action.
The transaction records a skipped resolution, stops Nags, and creates the Next
Occurrence for a Recurring Chore. Keep the skipped row in its current active
list for a server-enforced, refresh-safe 30-second Undo window; after that
window it moves to the existing Done disclosure with a visible **Skipped**
status.

## Approach

Extend `updateOccurrence` rather than add a second resolution path. Keep the
legacy `done` boolean contract for completion and un-completion, and add an
explicit `resolution: 'skipped' | 'open'` command for Skip and Undo Skip. Reject
a request that supplies both fields. The server writes the resolution timestamp
from its transaction clock and returns it as nullable `resolved_at` projection
data; the browser must not decide whether a late Undo is valid.

```text
PUT /api/chores/:id  { resolution: "skipped" }
  updateOccurrence (BEGIN IMMEDIATE)
    supersede pending assigned-Nag Delivery Slots
    status = skipped; done = 0; nag_eligible_since = null
    create one recurring successor, when recurrence exists
    insert Completion Log(resolution = skipped, due_at, completed_at = now)
  COMMIT

PUT /api/chores/:id  { resolution: "open" }
  require now <= completed_at + 30 seconds
  require a recurring successor to still exist, be open, revision 0, and unadvanced
  delete log and successor; reopen occurrence with a fresh Nag eligibility anchor
```

One-off Undo does not require a successor because none is created. Repeated Skip
is idempotent. A recurring Undo conflicts if its generated successor is missing,
resolved, edited, or has a child. At the exact 30-second boundary Undo is still
allowed; after it, the API returns `409` without changing data.

The scheduler's production queries already require `status = 'open'`. Preserve
that rule and prove it with regression tests. Skip also calls
`supersedePendingAssignedNagSlots` inside the occurrence transaction. A send
that has already entered the external notification call cannot be recalled; this
is consistent with ADR 0007's at-least-once delivery contract.

The browser shows a visible secondary **Skip** button beside the Done control,
with no confirmation. After Skip, the row stays in the same active view and
shows **Skipped** plus **Undo (N seconds)**. A small clock signal expires the
projection at the server deadline and then moves the row into the existing Done
disclosure. Initial page data, mutation responses, and `GET /api/chores` include
skipped history and `resolved_at` from the joined Completion Log, so refresh
during the window restores the same row and Undo state. The set-aside
alternative was moving the row into Done immediately; that hides the short Undo
opportunity behind a collapsed control.

## Files to Modify

- `src/db/migrations/0007_completion_log_resolution.ts` — add and validate
  `completion_logs.resolution`, with existing rows backfilled to `completed`.
- `src/db/migrations/index.ts` and `src/db/migrations/index.test.ts` — register
  migration 7 and prove fresh, legacy-upgrade, production-upgrade, and repeated
  startup convergence.
- `src/domain/occurrenceResolution.ts` — own Skip, timed Undo, successor safety,
  explicit server timestamps, Completion Log resolution, and transactional Nag
  supersession.
- `src/domain/occurrenceResolution.test.ts` — cover resolution state
  transitions, recurrence, rollback, idempotency, the inclusive deadline, and
  every successor conflict.
- `src/pages/api/chores/[id].ts` and `src/pages/api/chores/chores.test.ts` —
  accept the resolution command, reject ambiguous input, return stable errors,
  and expose server resolution metadata.
- `src/pages/api/chores/index.ts` and `src/pages/index.astro` — return open,
  completed, and skipped rows with their resolution timestamps for history and
  refresh recovery.
- `src/types.ts` — type Completion Log resolution, update commands, and the
  resolution timestamp projection without making projection data authoritative.
- `src/components/ChoreManager.tsx`, `src/components/ChoreItem.tsx`,
  `src/components/ChoreList.tsx`, `src/components/DoneDisclosure.tsx`, and the
  three view components — implement the Skip/Undo state, active-window
  retention, expiry movement, Skipped presentation, and prop contracts.
- `src/scheduler/assignedNagScheduler.test.ts` — prove skipped occurrences
  create and send no later assigned Nags and pending rows become superseded.
- `tests/e2e/three-view-journey.spec.ts` and `tests/e2e/recurrence.spec.ts` —
  prove the visible Skip flow, refresh-safe Undo, expiry movement, and recurring
  Next Occurrence behavior.
- `tests/production_lifecycle.ts` — expect and validate migration 7 in a built
  production startup.
- `docs/domain-language.md` — define Skip and update Recurrence and Completion
  Log language to match both resolution types.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `updateOccurrence`, `insertSuccessor`, and the existing reopen guard in
  `src/domain/occurrenceResolution.ts` — generalize the authoritative
  transaction instead of duplicating recurrence logic.
- `calculateNextOccurrence` — keep one calculation path for completion and Skip.
- `supersedePendingAssignedNagSlots` and scheduler open-status eligibility — use
  the current outbox stop mechanism and source-of-truth filter.
- `localCompletedIds` and `DoneDisclosure` — reuse the current resolved-row
  projection pattern, but make recent Skip retention durable from server data
  rather than memory-only.
- Existing migration validation and lifecycle tests — extend their ledger and
  schema assertions for migration 7.

## Implementation Steps

- [ ] Migration 7 gives every `completion_logs` row a non-null `resolution` in
      `completed | skipped`; pre-migration logs become `completed`, invalid
      values fail schema validation, and all migration convergence tests expect
      version 7.
- [ ] `updateOccurrence` accepts one unambiguous state command: legacy `done`,
      or `resolution: 'skipped' | 'open'`; the API rejects unknown resolution
      values and requests that contain both command forms.
- [ ] Skip changes an open occurrence to `status = 'skipped'`, keeps `done = 0`,
      clears `nag_eligible_since`, writes `resolution = 'skipped'`, `due_at`,
      and an explicit server `completed_at`, and supersedes pending assigned-Nag
      rows in the same `BEGIN IMMEDIATE` transaction.
- [ ] Completion writes `resolution = 'completed'` with the same explicit server
      timestamp, while all existing completion and un-completion behavior
      remains protected.
- [ ] A recurring Skip creates exactly one open Next Occurrence in the same
      transaction; repeated Skip creates no duplicate log or successor and the
      recurrence chain never has more than one open occurrence.
- [ ] Undo Skip succeeds through `completed_at + 30 seconds` inclusive. It
      deletes the skipped log and, for recurrence, its untouched direct
      successor; it reopens the occurrence with a fresh Nag anchor and preserves
      all-or-nothing rollback.
- [ ] One-off Undo requires no successor. Recurring Undo returns `409` and
      changes no rows after expiry or when the successor is missing, resolved,
      edited, or has advanced to a child.
- [ ] Initial page, mutation, and chore-list responses include skipped history
      and nullable `resolved_at`, projected from `completion_logs.completed_at`.
      `status` remains the authority; `resolved_at` is used only to display and
      recover the Undo window.
- [ ] An open row has a visible secondary **Skip** control with no confirmation.
      A newly or recently skipped row remains in its current active view,
      displays **Skipped** and an accessible **Undo** control with remaining
      seconds, and moves to the existing Done disclosure when the server
      deadline expires.
- [ ] Refresh during the Undo window restores the row in the active view and
      does not extend its deadline. After expiry, skipped rows remain available
      in the Done disclosure with a visible **Skipped** label and no completion
      checkmark or Undo control.
- [ ] Scheduler tests prove skipped occurrences are excluded from slot creation
      and send-time eligibility, pending assigned-Nag rows are superseded, and a
      recurring successor can independently become Nag-eligible.
- [ ] `docs/domain-language.md` defines **Skip** as a neutral occurrence
      resolution, updates **Completion Log** to cover completed and skipped
      resolutions, and states that Recurrence advances after either completion
      or Skip.

## Approval Confirmation

This Plan does not supersede a completed Work Record.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:production-lifecycle` proves the built server
  applies and validates migration 7 before readiness.
- Automated: targeted domain and API tests cover one-off and recurring Skip,
  explicit timestamps, `resolution`, `due_at`, idempotency, forced rollback,
  ambiguous input, exact-boundary Undo, expired Undo, refresh metadata, and all
  recurring successor conflicts.
- Automated: scheduler tests prove no slot is created or sent for a skipped
  occurrence, an existing pending slot becomes superseded, and a later recurring
  successor has independent eligibility. Preserve the unavoidable behavior that
  a Gotify send already in progress can complete.
- Automated browser: add the named Playwright scenario
  `Skip remains active and
  survives refresh` so a Member presses visible
  **Skip**, sees **Skipped** and Undo in the active row, refreshes without
  resetting the deadline, and undoes successfully. Add deterministic timer
  coverage (Playwright clock or an explicit longer per-test timeout) for
  movement under Done after expiry, and cover a recurring Skip creating one open
  Next Occurrence.
- Headed browser: run `deno task dev`, open `http://127.0.0.1:8080`, and repeat
  the one-off flow in What's Next, Board, and Pool. Check keyboard focus,
  accessible names, countdown readability, the 30-second movement, and the
  persistent **Skipped** label in each Done disclosure.
- Existing completion protection: Done/un-done stays idempotent and reversible,
  completion logs say `completed`, recurrence still creates one successor, and
  current active/Done search behavior remains. No existing behavior is expected
  to stop except treating `completion_logs` as completion-only data.
- Expected result: `chores.status`, not the countdown or `done`, decides whether
  an occurrence is resolved; the glossary describes only the landed behavior.

## Edge Cases & Considerations

- Use the server transaction clock for `completed_at` and deadline checks.
  Client clock skew can change the displayed countdown but cannot permit a late
  Undo.
- Treat the deadline as inclusive (`now <= resolved_at + 30s`). The UI can lose
  a race at the boundary and must handle `409` by reconciling with the server.
- Keep `completion_logs` as the table name. Its `completed_at` column becomes
  the historical resolution time; do not add a second competing timestamp
  authority.
- A recurring successor deleted during the Undo window is a conflict. This is
  stricter than current un-completion, which tolerates a missing successor, and
  protects the Member's later delete intent.
- SQLite serializes Skip against slot creation, and send-time eligibility blocks
  a send when Skip commits first. A send already inside the external port cannot
  be recalled under the accepted at-least-once contract.
- Keep skipped history searchable and partitioned by the same assignee/Pool
  rules as completed history. Do not add scorekeeping, comparison, blame
  language, or Snooze behavior.
- Pair execution is recommended because the visible row transition, countdown,
  and neutral status treatment benefit from live browser review.

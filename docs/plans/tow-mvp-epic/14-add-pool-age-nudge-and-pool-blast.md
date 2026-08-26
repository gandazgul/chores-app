---
planId: "07dd73f6-7a42-4be6-b69f-e7f8cb912aba"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Show Pool age from `unassigned_since` and add the configured one-slot pool blast through the delivery outbox. Keep Pool pressure ambient in-app and isolate delivery failures per recipient."
affectedPaths:
  - "src/components/PoolView.tsx"
  - "src/components/ChoreList.tsx"
  - "src/components/ChoreItem.tsx"
  - "src/utils/poolAge.ts"
  - "src/utils/poolAge.test.ts"
  - "src/scheduler/**"
  - ".env.example"
  - "docs/adr/0007-nag-cadence-escalation-and-quiet-hours.md"
  - "docs/domain-language.md"
  - "docs/system-patterns.md"
  - "tests/e2e/three-view-journey.spec.ts"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T12:07:52-04:00"
updatedAt: "2026-08-26T18:05:24.496Z"
status: "validated_reviewer"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 14
dependencies:
  - "13-add-skip-resolution-and-nag-stop-behavior"
implementedAt: "2026-08-26T01:30:38.308Z"
userVerifiedAt: null
executionReport: "- Implemented Pool age UI: open Pool rows show `In Pool for less than a day` / `1 day` / `N days` from `unassigned_since`; age is omitted from What's Next, Board, completed Pool rows, and locally retained resolved rows.\n- Implemented Pool Blast in the existing scheduler/outbox: opt-in `POOL_BLAST_LEAD_HOURS`, per-Member `pool_blast` slots, quiet-hours `deliver_after`, stale pending supersession, unattempted-slot replacement, attempted lifetime blocking, shared fair delivery batch, and per-recipient result isolation.\n- Fixed row identity exposed by the new e2e flow: `ChoreList` now uses Solid `<For>` so Claim/Release/Done actions keep current Chore ids after list movement.\n- Updated `.env.example`, ADR 0007, `docs/domain-language.md`, and `docs/system-patterns.md` to state Pool Age, optional Pool Blast, disabled-by-default config, and at-least-once delivery behavior.\n- Test coverage changed: added `src/utils/poolAge.test.ts` with 5 tests; added 5 Pool Blast policy tests; added 5 scheduler Pool Blast/fairness tests; updated 1 Playwright journey test; removed 0 tests. Deno unit count is now 123; Playwright count is 17.\n- Verification passed: `deno fmt --check`; `deno test -A src/utils/poolAge.test.ts src/scheduler/nagPolicy.test.ts src/scheduler/assignedNagScheduler.test.ts`; `deno task ci` (123 passed; Astro reports the existing `src/pages/login.astro` unused-function hint); `deno task test:production-lifecycle`; `E2E_PORT=18083 deno task test:e2e -- tests/e2e/three-view-journey.spec.ts` (3 passed); `CI=1 E2E_PORT=18085 deno task test:e2e` (17 passed with one Gotify-settings retry); `CI=1 E2E_PORT=18086 deno task test:e2e -- tests/e2e/gotify-settings.spec.ts` (1 passed); isolated Pool Blast config check passed.\n- Dev server/browser: plan port 8080 was occupied by another Deno dev server, so final worktree server ran at `http://127.0.0.1:18080/` with `DB_ENV=test ENABLE_AUTH=false ENABLE_NOTIFICATIONS=false deno run -A --env npm:astro dev --host 127.0.0.1 --port 18080`.\n- Headed browser verified at desktop 1440x1000 and mobile 390x844: created a Chore, released it to Pool, saw neutral age label, claimed it, released it again, and confirmed Pool age returned as `In Pool for less than a day`; screenshots `artifacts/tow-child-14-final-desktop-pool-age.png`, `artifacts/tow-child-14-final-desktop-done-no-age.png`, `artifacts/tow-child-14-final-mobile-pool.png`.\n- Browser diagnostics: final URL `http://127.0.0.1:18080/`, title `Tow`, console only Vite debug connect logs, no agent-browser errors, no captured 400-599 XHR/fetch requests.\n- Unresolved blockers: none."
humanReviewMode: "ask"
humanReviewDecision: "skipped"
validationCheckpoint: null
executionMode: "worktree"
executionBaselineTree: "a30bf61d46dd24bf0ed199b8ad343ddab6c95a9f"
worktreeId: "21aca12c"
worktreePath: "/Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-14-add-pool-age-nudge-and-pool-blas-21aca12c"
worktreeBranch: "worktree/tow-mvp-epic-14-add-pool-age-nudge-and-pool-blas-21aca12c"
worktreeBaseBranch: "main"
worktreeStatus: "completed"
validationCiAttempts: 0
validationSemanticRounds: 1
---

# Add Pool Age Nudge and Pool Blast

## Context

The Pool's health signal is age, not Due Date. Age comes from
`unassigned_since`, which resets whenever a Chore enters the Pool. The Pool UI
currently identifies unassigned Chores but does not show how long they have
waited. The notification outbox already reserves the `pool_blast` kind, but the
scheduler creates and sends only assigned Nags.

The Pool stays ambient by default. A deployment can explicitly enable one
Due-Date-based Pool Blast for every Member. The accepted ADR currently says both
that the lead time defaults to 24 hours and that an unset value disables the
blast; this Plan resolves that contradiction with the user-confirmed opt-in
rule.

## Objective

Show a neutral elapsed age on each open Pool Chore and deliver the optional,
one-slot Pool Blast through the existing notification scheduler and outbox. Keep
Pool Push Notifications disabled unless an operator configures a positive lead
time, and isolate each Member's delivery result.

## Approach

Use `unassigned_since` as the only Pool-age source. Format elapsed whole days as
`In Pool for less than a day`, `In Pool for 1 day`, or `In Pool for N days`.
Pass a Pool-only display flag through the existing list components so Board,
What's Next, and the completed Pool disclosure do not show an active Pool age.
The existing `nowMs` signal keeps the label current without a second timer.

Add a pure Pool Blast policy helper beside the assigned-Nag policy, then extend
the existing scheduler tick rather than starting another loop:

```text
existing scheduler tick
  create assigned-Nag Delivery Slots
  create one Pool Blast Delivery Slot per eligible Chore and Member
  supersede stale pending Pool Blast rows, including future deferrals
  read a fair bounded batch across both notification kinds
  recheck eligibility and current policy slot
  send each row independently through NotificationPort
```

`POOL_BLAST_LEAD_HOURS` is disabled when unset or `0`. A positive whole number
sets the lead time; invalid or negative values fail startup clearly. For a
configured lead `H`, the one policy slot is `due_date - H hours`, truncated to
the existing UTC-second slot format. Creation requires
`unassigned_since < slot_key <= now`. Quiet Hours can shift `deliver_after`, but
do not change `slot_key`, and forward coalescing does not apply to this one-slot
policy.

Reuse the existing `(chore_id, recipient_id, kind, slot_key)` uniqueness and
per-row delivery result handling. At send time, a Pool Blast remains valid only
when the Chore is open, in the Pool, has reminders enabled and a Due Date, its
`unassigned_since` precedes the slot, and the row's slot still equals the slot
calculated from the current Due Date and configuration. The slot-creation phase
also supersedes every stale pending Pool Blast on each tick, including a row
whose Quiet-Hours-shifted `deliver_after` is still in the future.

Enforce the user-confirmed lifetime limit in addition to slot-key uniqueness. A
stale Pool Blast with `attempt_count = 0` can be superseded and replaced after a
Due Date or lead-time change. After any send attempt increments `attempt_count`,
that Chore and Member cannot receive a new logical Pool Blast; a retry remains
on the same row. If an attempted row later becomes stale, it is superseded
without replacement. This permits correction before delivery but prevents
repeated Pool push intent across Due Date edits, configuration changes, or Pool
re-entry.

Select due rows fairly within the existing bound: order eligible pending rows by
oldest `updated_at`, then `deliver_after`, `slot_key`, and `id`. Every selected
result refreshes `updated_at`; a `disabled` observation does so without
incrementing `attempt_count` or setting `last_attempt_at`. Retryable and
disabled rows therefore rotate behind older unattempted work instead of
occupying every future batch.

The set-aside option was an implicit 24-hour default. It would enable
household-wide push after an upgrade without an operator choosing it, contrary
to the ambient-by-default product rule.

## Files to Modify

- `src/components/PoolView.tsx` — request the age label only for open Pool
  Chores; keep the completed disclosure unchanged.
- `src/components/ChoreList.tsx` and `src/components/ChoreItem.tsx` — carry the
  Pool-only display flag and render the neutral age metadata.
- `src/utils/poolAge.ts` and `src/utils/poolAge.test.ts` — own and prove the
  elapsed-day formatter, including missing, invalid, and future anchors.
- `src/scheduler/nagPolicy.ts` and `src/scheduler/nagPolicy.test.ts` — resolve
  Pool Blast configuration and calculate its one slot with Quiet Hours.
- `src/scheduler/assignedNagScheduler.ts` and
  `src/scheduler/assignedNagScheduler.test.ts` — integrate Pool Blast slot
  creation, current-policy eligibility checks, shared due-row delivery, and
  per-recipient result isolation into the existing tick.
- `src/scheduler/runtime.ts` — read validated Pool Blast configuration and pass
  it to the existing scheduler instance.
- `.env.example` — document disabled-by-default `POOL_BLAST_LEAD_HOURS` and its
  positive-whole-number contract.
- `docs/adr/0007-nag-cadence-escalation-and-quiet-hours.md` — replace the
  contradictory 24-hour/unset wording with the confirmed opt-in rule.
- `docs/domain-language.md` — define Pool Age and Pool Blast now that both are
  implemented; preserve the ambient-by-default relationship.
- `docs/system-patterns.md` — move Pool Blast out of deferred behavior and
  document its path through the shared scheduler and outbox.
- `tests/e2e/three-view-journey.spec.ts` — prove the age label is visible only
  on the active Pool view and resets after a Release round trip.

No schema migration or `src/pages/index.astro` change is expected:
`unassigned_since` already reaches the island, and migration 0006 already allows
`pool_blast` with the required uniqueness and statuses.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/domain/choreAssignment.ts` and `src/domain/occurrenceResolution.ts` —
  preserve their authoritative `unassigned_since` reset/clear transitions; do
  not create a second age fact.
- `src/components/ChoreManager.tsx` — reuse its one-second `nowMs` signal.
- `src/scheduler/nagPolicy.ts` — reuse UTC-second normalization and Quiet Hours
  shifting, but not assigned-Nag forward coalescing.
- `src/scheduler/assignedNagScheduler.ts` — reuse its transaction, bounded
  batch, result recording, redacted logs, and exception-per-row behavior; change
  due-row ordering only as needed to prevent one repeatedly pending row from
  starving rows outside the batch.
- `src/db/migrations/0006_notification_deliveries.ts` — rely on the existing
  `pool_blast` kind, statuses, and logical uniqueness; add no duplicate schema.
- `src/notifications/notificationPort.ts` — keep all external sends behind the
  existing `NotificationPort`.

## Implementation Steps

- [ ] Each open Chore in `PoolView` shows exactly one label derived from
      `unassigned_since`: `In Pool for less than a day`, `In Pool for 1 day`, or
      `In Pool for N days`; Due Date and creation time are never fallback age
      sources.
- [ ] The Pool-age formatter floors complete 24-hour periods, returns no label
      for a null or invalid anchor, and treats a future anchor as less than one
      day instead of showing a negative age.
- [ ] Pool age is absent from What's Next, Board, the completed Pool disclosure,
      and locally retained completed or skipped rows in the active Pool list;
      `ChoreItem` requires `status === "open"` as well as the Pool-only display
      flag. Claim or Assign removes the Chore from active Pool display, and
      Release returns it with a new `unassigned_since` anchor.
- [ ] `resolvePoolBlastLeadHours` returns disabled for unset, blank, or `0`,
      accepts positive whole hours, and rejects negative, fractional, or
      nonnumeric input with a configuration error before scheduler startup.
- [ ] With Pool Blast disabled, the scheduler creates no `pool_blast` rows,
      supersedes any pending Pool Blast rows created under an earlier
      configuration, and leaves assigned-Nag creation and delivery unchanged.
- [ ] With lead `H`, an open unassigned Chore with a Due Date,
      `remind_until_done = 1`, and `unassigned_since < due_date - H <= now`
      creates one `pool_blast` Delivery Slot for every row in `users`.
- [ ] Each Pool Blast uses the Due-Date-derived UTC-second `slot_key` and a
      Quiet-Hours-shifted `deliver_after`; it does not use assigned-Nag forward
      coalescing and cannot be recreated for the same Chore, Member, and slot
      after restart or Pool re-entry.
- [ ] A Chore that enters the Pool on or after its blast slot creates no row.
      Chores without a Due Date, with reminders disabled, assigned, or resolved
      also create no Pool Blast rows.
- [ ] On every slot-creation phase and again before send, the scheduler
      supersedes a pending Pool Blast whose Chore is no longer eligible or whose
      row no longer matches the slot calculated from the current Due Date and
      lead configuration, even when `deliver_after` is still in the future.
- [ ] A stale Pool Blast with `attempt_count = 0` can be replaced by the current
      slot. Any existing Pool Blast with `attempt_count > 0` blocks new logical
      slots for that Chore and Member; retries use the same row, and an
      attempted row that becomes stale is superseded without replacement.
- [ ] Due assigned-Nag and Pool Blast rows share one fair bounded batch and one
      scheduler owner while retaining kind-specific eligibility and slot
      creation rules. Selection orders by oldest `updated_at`, then
      `deliver_after`, `slot_key`, and `id`; every selected result refreshes
      `updated_at`. Repeated retryable or disabled results therefore cannot
      permanently starve unattempted due rows outside the batch, while disabled
      observations leave `attempt_count` and `last_attempt_at` unchanged.
- [ ] Every due Pool Blast row is sent independently through `NotificationPort`:
      sent, terminal-undeliverable, disabled, and retryable results retain the
      existing outbox semantics, and one Member's result or thrown send does not
      prevent later rows from being attempted.
- [ ] `docs/domain-language.md`, ADR 0007, `.env.example`, and
      `docs/system-patterns.md` agree that Pool Age is ambient, Pool Blast is
      optional, unset/`0` disables it, and a positive whole number enables one
      Due-Date-based slot per Chore and Member.

## Approval Confirmation

No Work Records are proposed for supersession. This Plan extends the completed
assignment, Pool-view, notification-port, and assigned-Nag work rather than
materially replacing their outcomes.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno test -A src/utils/poolAge.test.ts` proves all three label
  forms and fails if age is calculated from anything other than the supplied
  Pool-entry anchor.
- Automated:
  `deno test -A src/scheduler/nagPolicy.test.ts
  src/scheduler/assignedNagScheduler.test.ts`
  proves configuration validation, one-slot calculation, Quiet Hours, disabled
  behavior, all eligibility gates, one row per Member, restart/Pool-re-entry
  idempotency, immediate stale-slot supersession, unattempted-slot replacement,
  attempted lifetime blocking, and no forward coalescing.
- Automated: scheduler tests interleave assigned-Nag and Pool Blast rows in one
  batch, then use a batch smaller than the due-row count with retryable,
  disabled, successful, and thrown-send results across multiple ticks. They fail
  unless every due recipient eventually gets an attempt, each Delivery Slot
  reaches its own correct state, and disabled rows keep `attempt_count = 0`.
- Automated: existing assignment, occurrence-resolution, and chore API tests
  continue to protect these implemented transitions: Pool creation and Release
  set a fresh `unassigned_since`; Claim and Assign clear it; unrelated edits
  preserve it. No existing assignment transition is expected to stop.
- Automated: `deno task test:e2e -- tests/e2e/three-view-journey.spec.ts` proves
  the open active Pool label is present, not leaked into other views or a
  locally retained resolved row, and returns as `less than a day` after Release.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, and open Pool. Confirm the age label is subdued
  metadata rather than an alert or blame cue. Claim a Chore, Release it, and
  confirm its label returns as `In Pool for less than a day`. Check desktop and
  narrow mobile layouts for wrapping and control overlap.
- Manual configuration check with an isolated test database and no real Gotify
  credentials: unset `POOL_BLAST_LEAD_HOURS` and confirm no Pool Blast rows; set
  it to a positive whole number, seed an eligible Chore and two Members, run one
  scheduler tick, and inspect one `pool_blast` row per Member with the expected
  `slot_key` and `deliver_after`.
- Expected result: Pool age supplies continuous in-app pressure. Pool Blast is
  absent by default and, when explicitly enabled, produces no repeated ladder.

## Edge Cases & Considerations

- Pairing is recommended because the Pool-age metadata must remain readable on
  mobile without becoming warning-colored or blame-oriented.
- Pool Age is elapsed time since the latest Pool entry, not calendar-day age,
  creation age, or Due Date age.
- `unassigned_since = slot_key` is not eligible because the Chore did not enter
  the Pool before the policy slot.
- A Due Date or lead-time edit can replace a stale unattempted slot. Once any
  attempt occurs, the lifetime limit blocks replacement; sent and terminal rows
  stay historical and are never rewritten.
- Enabling Pool Blast after a Chore's slot passed can create the slot on the
  next tick only when that Chore was already in the Pool before the slot. This
  is restart/configuration recovery; late Pool entry remains suppressed.
- A Member without a Gotify Application Token gets an independent terminal
  `undeliverable` row. It does not suppress configured recipients.
- The existing at-least-once caveat applies: a crash after Gotify accepts a
  message but before SQLite records `sent` can cause one external duplicate.
- The scheduler remains single-process and single-replica; this Plan adds no
  distributed lease or second timer.

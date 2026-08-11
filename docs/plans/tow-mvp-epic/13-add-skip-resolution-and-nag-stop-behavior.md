---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add skip as a first-class occurrence resolution that uses the transactional recurrence model, records `resolution = skipped`, and stops future nags. Add Skip to the glossary with the implementation."
affectedPaths:
  - "src/**/migrations/**"
  - "src/pages/api/chores/[id].*"
  - "src/components/**"
  - "src/scheduler/**"
  - "tests/**"
  - "docs/domain-language.md"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:52.630Z"
updatedAt: "2026-08-10T16:07:52.630Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 13
dependencies:
  - "12-send-assigned-nag-deliveries-from-the-scheduler"
---

# Add Skip Resolution and Nag Stop Behavior

## Context

A reminder that can only be silenced by falsely marking a chore done is broken.
P3 adds skip as a first-class resolution. P0 already reserved `status = skipped`
and made resolution transactional.

## Objective

Let members skip an open occurrence. A skip sets status to `skipped`, records a
skipped resolution in the log, spawns the next recurring occurrence in the same
transaction, and stops nags for that occurrence.

## Approach

Extend the resolution transaction to accept skip as a separate resolution. Add
`completion_logs.resolution` through migration while keeping the table name. Add
UI controls that present skip neutrally. Update scheduler queries so only
`status = open` is active. Add Skip to the glossary when the behavior lands.

## Files to Modify

- `src/**/migrations/**` — add `completion_logs.resolution` with completed
  backfill.
- `src/pages/api/chores/[id].*` — add skip mutation path using the existing
  resolution transaction.
- `src/components/**` — add skip control and status presentation in item or
  modal UI.
- `src/scheduler/**` — ensure skipped occurrences stop nag creation and pending
  unsent slots are handled correctly.
- `tests/**` — cover skip transaction, recurrence spawn, log resolution, and
  scheduler stop behavior.
- `docs/domain-language.md` — add Skip in the same change as the implemented
  behavior.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Resolution transaction from
  `03-make-occurrence-resolution-transactional-and-reversible` — extend it
  instead of duplicating logic.
- `calculateNextOccurrence` — reuse for recurring skip successor creation.
- Chore item optimistic action pattern — reuse for skip if it gives a clear
  rollback path.
- Scheduler open-status queries — keep `status = open` as the active filter.

## Implementation Steps

- [ ] A migration adds `completion_logs.resolution` with allowed values
      `completed` and `skipped`, and existing logs are backfilled as
      `completed`.
- [ ] Skip sets `chores.status = 'skipped'` for the occurrence.
- [ ] A recurring skipped occurrence spawns the next occurrence in the same
      transaction and preserves the one-open-occurrence invariant.
- [ ] The log row records `resolution = 'skipped'` and the `due_at` it closed
      when a due date exists.
- [ ] Repeated skip requests are idempotent and do not create duplicate
      successors or logs.
- [ ] No list, landing, or scheduler query treats skipped occurrences as open.
- [ ] Skipping stops new nag slots and cancels or prevents unsent slots for that
      occurrence according to the scheduler model.
- [ ] Browser UI lets a member skip an open chore with neutral, non-shaming
      language.
- [ ] `docs/domain-language.md` defines Skip and does not describe it as failure
      or blame.

## Verification Plan

- Automated: `deno task ci`.
- Automated: API and database tests cover non-recurring skip, recurring skip,
  idempotency, `resolution`, `due_at`, and active-query exclusion.
- Automated: scheduler tests prove skipped occurrences create no later nag
  deliveries.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, create or find an open chore, skip it, and confirm it
  leaves active views without being marked completed.
- Expected result: Skip is diagnostic data, not a false completion.
- Expected result: the glossary describes implemented skip behavior.

## Edge Cases & Considerations

- Pairing is recommended because skip wording and placement affect product tone.
- Do not add scorekeeping or per-person comparison based on skipped chores.
- Keep the table name `completion_logs`; only add the resolution field.

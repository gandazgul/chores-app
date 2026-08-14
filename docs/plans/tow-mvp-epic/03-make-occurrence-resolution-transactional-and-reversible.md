---
classification: "PLANNED_CHANGE"
workKind: "BUG_FIX"
complexity: "MEDIUM"
summary: "Make completion and un-completion one safe SQLite transaction. Add explicit occurrence status, due-date logging, successor links, and revision checks so recurrence chains can be reversed without data loss."
affectedPaths:
  - "src/pages/api/chores/[id].*"
  - "src/utils/scheduleUtils.*"
  - "src/**/migrations/**"
  - "src/utils/db.*"
  - "tests/**"
  - "docs/adr/0005-recurring-chores-spawn-a-new-row-on-completion.md"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:51.400Z"
updatedAt: "2026-08-10T16:07:51.400Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 3
dependencies:
  - "02-add-forward-only-startup-migrations"
planId: "c3f82a42-2189-47ad-9fc7-a8d0ffe54116"
---

# Make Occurrence Resolution Transactional and Reversible

## Context

The current completion flow spawns a successor, writes a log, and updates the
row as separate statements. Un-completing loses recurrence state and cannot
safely remove a spawned successor. The Epic amends ADR 0005 and makes
`chores.status` the occurrence authority.

## Objective

Make complete and un-complete idempotent, transactional, and safe for recurring
chores. Record the due date closed by each completion and protect the invariant
that a recurrence chain has at most one open occurrence.

## Approach

Add schema changes through migrations, then update the chore mutation path to
use one explicit transaction for resolution. Use `status` as the source of truth
while keeping compatibility with old `done` data only as needed during
migration. Link successors to the occurrence that spawned them and use
`revision` to decide whether un-complete can delete a successor.

## Files to Modify

- `src/**/migrations/**` — add `chores.status`, `completion_logs.due_at`,
  `chores.recurrence_parent_id`, and `chores.revision` with safe backfills.
- `src/pages/api/chores/[id].*` — make completion and un-completion
  transactional and idempotent.
- `src/pages/api/chores/index.*` and list queries — use `status` instead of
  `done` as occurrence authority.
- `src/utils/scheduleUtils.*` — reuse recurrence calculation and keep behavior
  compatible.
- `tests/**` — add transaction, idempotency, conflict, and recurrence-chain
  tests.
- `docs/adr/0005-recurring-chores-spawn-a-new-row-on-completion.md` — record the
  amended recurrence and reversal semantics.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/utils/scheduleUtils.*` — reuse `calculateNextOccurrence` for successor
  creation.
- `node:sqlite` synchronous transaction style — use `BEGIN`, `COMMIT`, and
  `ROLLBACK` around the mutation.
- Existing `PUT /api/chores/[id]` optimistic UI contract — preserve the response
  shape needed by the current island until a later UI child changes it.

## Implementation Steps

- [ ] Migrations add `chores.status` with allowed values `open`, `completed`,
      and reserved `skipped`; P0 behavior uses `open` and `completed`.
- [ ] Migrations add `completion_logs.due_at`, `chores.recurrence_parent_id`,
      and `chores.revision` with correct backfills for existing rows.
- [ ] Server list, recurrence, and resolution queries use `chores.status` as the
      source of truth for active versus resolved occurrences.
- [ ] Completing an open occurrence updates status, writes a completion log with
      `due_at` when a due date exists, spawns one successor for a recurring
      chore, links it with `recurrence_parent_id`, and commits all changes in
      one transaction.
- [ ] A forced failure during completion leaves no partial successor, log, or
      status change.
- [ ] Repeated complete requests are idempotent and do not create duplicate
      successors or duplicate logs.
- [ ] Un-completing an untouched recurring occurrence restores the recurrence
      rule, deletes the direct successor, deletes the completion log, and leaves
      exactly one open occurrence.
- [ ] Un-completing returns a conflict and changes no rows when the direct
      successor is edited, resolved, or has advanced later work.
- [ ] `docs/adr/0005-recurring-chores-spawn-a-new-row-on-completion.md`
      describes the implemented transaction and conflict behavior.

## Verification Plan

- Automated: `deno task ci`.
- Automated: targeted API and database tests for completion, un-completion,
  idempotency, transaction rollback, conflict response, and `due_at` logging.
- Automated: a query-level test proves there is never more than one open
  occurrence for one recurrence chain after supported operations.
- Expected result: `done` is not the authority for active occurrences.
- Expected result: the old lossy un-complete behavior stops existing.

## Edge Cases & Considerations

- Do not implement skip here beyond reserving the status value. Skip arrives in
  P3.
- If a successor was touched, protect user data and reject reversal with
  conflict.
- Keep current flat delete capability unchanged until the household work changes
  permissions.

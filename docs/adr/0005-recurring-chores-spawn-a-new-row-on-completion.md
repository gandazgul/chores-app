# ADR 0005: A recurring chore spawns a new chore row when it is completed

- **Status:** Accepted, amended by Tow MVP child 03
- **Date:** 2026-08-10
- **Amended:** 2026-08-14

## Context

A chore can repeat. "Take out the trash every Monday" must appear again after
the user marks it done. The recurrence rule is an RRULE string, parsed by the
`rrule` library.

The previous Express application used `dayspan` for recurrence. `rrule` replaced
it during the migration to Astro, because RFC 5545 rules are a standard, they
serialize to one string, and the library is maintained. The stored shape is a
rule string, not a `dayspan` schedule object.

There are two usual ways to model this:

1. **One row per rule.** One chore row keeps the rule and moves its own Due Date
   forward on completion. History lives only in the Completion Log.
2. **One row per occurrence.** Completing an occurrence creates the next
   occurrence as a new row.

The application must show what is due now, and it must keep a record of what was
done and when. It must also be safe to reverse a completion if the next
occurrence was not changed.

## Decision

Use one row per occurrence. Store the rule as JSON in `chores.recurrence`, in
the shape `{"rrule": "FREQ=WEEKLY"}`.

`chores.status` owns the occurrence state. Valid values are `open`, `completed`,
and reserved `skipped`. The old `chores.done` field stays as a synchronized
compatibility projection for the current API response and UI toggle. Server code
must not use `done` to decide if an occurrence is active.

When `PUT /api/chores/:id` receives `done: true` for an `open` occurrence:

1. Start `BEGIN IMMEDIATE`.
2. Reread the Chore row.
3. Apply any metadata edits from the same request.
4. Set `status = 'completed'`, set `done = 1`, and increment the parent
   `revision` once.
5. Insert one Completion Log for that Chore. `completion_logs.due_at` stores the
   occurrence Due Date that this completion closed.
6. If the final recurrence has an `rrule`, call
   `calculateNextOccurrence(rrule, new Date())`. The rule stays anchored at the
   completion time. If a next date exists, insert one linked successor row with
   `status = 'open'`, `done = 0`, `revision = 0`, and
   `recurrence_parent_id = completed_chore.id`.
7. Commit.

The completed occurrence keeps its recurrence JSON as a history snapshot. The
successor copies the same recurrence JSON, title, description, owner, and other
current recurrence fields. Only `status = 'open'` makes the recurrence active.

Repeating `done: true` for an already completed occurrence is a state no-op. It
must not create another successor or another Completion Log. If the same request
contains a real metadata edit, only that edit changes the row and increments its
revision.

When `PUT /api/chores/:id` receives `done: false` for a `completed` occurrence:

1. Start `BEGIN IMMEDIATE`.
2. Reread the Chore row.
3. If a direct successor exists, allow reversal only when the successor is
   `open`, has `revision = 0`, and has no child. Delete that untouched
   successor.
4. If the direct successor is resolved, edited, or advanced, return HTTP 409 and
   roll back the full request. No metadata edit, status change, revision change,
   successor change, or log change is kept.
5. If the direct successor is absent, allow reversal. The parent retained its
   recurrence rule, so reopening it restarts the chain safely.
6. Delete the Completion Log for the occurrence.
7. Set `status = 'open'`, set `done = 0`, preserve the Due Date, increment the
   parent `revision` once, and commit.

The database enforces the main invariants:

- one direct successor per occurrence through a unique non-null
  `recurrence_parent_id` index;
- one Completion Log per occurrence through a unique `completion_logs.chore_id`
  index;
- non-negative `revision` values;
- a self-reference from `chores.recurrence_parent_id` to `chores.id` with
  `ON DELETE SET NULL`; and
- status values limited to `open`, `completed`, and `skipped`.

The migration is greenfield. It backfills `status` from `done` and
`completion_logs.due_at` from the linked Chore Due Date where possible. It does
not infer old recurrence links or add legacy reversal markers.

`POST /api/chores` uses the same helper without a start date, so a new recurring
chore gets its first Due Date from the moment of creation.

## Consequences

**Good**

- Completion and un-completion are atomic. A failure leaves no partial
  successor, no partial Completion Log, and no partial state change.
- Each completed occurrence keeps its own Due Date, title, description, and
  recurrence snapshot as they were at that time. Later edits to an open
  occurrence do not rewrite history.
- The next occurrence exists as a real row, so it can be edited, deleted, or
  completed on its own.
- Safe reversal is possible while the direct successor is untouched.
- Repeated completion requests are idempotent.
- The Chore list can select `status = 'open'` rows and does not need to infer
  active state from recurrence or `done`.

**Bad or limiting**

- The Chore table grows without limit. Every completion adds a row, and resolved
  rows are kept as history until an archive feature exists.
- Only one future occurrence exists at a time. A calendar or an agenda view
  cannot look further ahead without recomputing the rule.
- An edit to the rule reaches only the one open occurrence. There is no series
  identity, so there is no way to say "change all future occurrences" as a
  single action.
- If a successor was edited, resolved, or advanced, reversal returns a conflict.
  This protects user data but can require a manual cleanup flow later.
- `calculateNextOccurrence` anchors the rule at the completion date rather than
  the scheduled Due Date. A chore completed late moves the future schedule
  later.

## Related

- Occurrence rows are ordinary chores. See
  [ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md) for the
  SQLite decision.
- Startup migrations are forward-only. See
  [ADR 0006](0006-forward-only-sql-migrations-applied-at-startup.md).

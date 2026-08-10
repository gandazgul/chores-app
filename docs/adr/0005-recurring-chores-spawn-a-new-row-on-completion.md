# ADR 0005: A recurring chore spawns a new chore row when it is completed

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

A chore can repeat. "Take out the trash every Monday" must appear again after
the user marks it done. The recurrence rule is an RRULE string, parsed by the
`rrule` library.

The previous Express application used `dayspan` for recurrence. `rrule` replaced
it during the migration to Astro, because RFC 5545 rules are a standard, they
serialize to one string, and the library is maintained. The stored shape is
therefore a rule string, not a `dayspan` schedule object.

There are two usual ways to model this:

1. **One row per rule.** One chore row keeps the rule and moves its own due date
   forward on completion. History lives only in the completion log.
2. **One row per occurrence.** Completing an occurrence creates the next
   occurrence as a new row.

The application must show what is due now, and it must keep a record of what was
done and when.

## Decision

Use one row per occurrence. Store the rule as JSON in `chores.recurrence`, in
the shape `{"rrule": "FREQ=WEEKLY"}`.

When `PUT /api/chores/:id` receives `done: true`:

1. Read the chore's recurrence. If it has an `rrule`, call
   `calculateNextOccurrence(rrule, new Date())`, which anchors the rule at the
   current date and returns the first occurrence strictly after it.
2. If a next date exists, insert a **new** chore row. It copies the title, the
   description, the `user_id`, and the same recurrence JSON, with the new due
   date and `done = 0`.
3. Set `recurrence = NULL` on the chore that was just completed, and keep its
   original due date. The completed row becomes a permanent record of one
   occurrence.
4. Insert a row into `completion_logs` with the completed chore's id.

`POST /api/chores` uses the same helper without a start date, so a new recurring
chore gets its first due date from the moment of creation.

## Consequences

**Good**

- The list query stays trivial.
  `SELECT * FROM chores WHERE user_id = ? ORDER BY due_date` returns exactly
  what to show. No occurrence is expanded at read time.
- Each completed occurrence keeps its own due date, title, and description as
  they were at that time. Later edits to the rule do not rewrite history.
- The next occurrence exists as a real row, so it can be edited, deleted, or
  completed on its own.

**Bad or limiting**

- The chore list grows without limit. Every completion adds a row, and completed
  rows are never archived or removed. The list query returns completed rows too,
  so the user interface will fill with finished chores over time.
- Only one future occurrence exists at a time. A calendar or an agenda view
  cannot look further ahead without recomputing the rule.
- An edit to the rule reaches only the one open occurrence. There is no series
  identity, so there is no way to say "change all future occurrences" as a
  single action.
- The completion is not atomic. The insert of the new chore, the insert of the
  completion log, and the update of the completed chore are three separate
  statements with no transaction. A failure between them leaves the data
  inconsistent, for example a duplicate open occurrence.
- Marking a completed chore as not done does not undo the spawn. The new
  occurrence stays, and the recurrence rule that was cleared from the original
  row is not restored. The chore stops recurring.
- `calculateNextOccurrence` anchors the rule at the completion date rather than
  the scheduled due date. A chore completed late moves the whole future schedule
  later.

## Related

- Occurrence rows are ordinary chores. See
  [ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md) for the
  schema and the absence of a migration path.

# ADR 0007: Nag cadence, escalation, and quiet hours

- **Status:** Accepted
- **Date:** 2026-08-16

## Context

Tow exists because a quiet list does not help when a chore has fallen out of a
person's attention. The product needs persistent reminders, but persistence must
have a clear policy. Children 12, 13, and 14 of the Tow MVP epic will implement
scheduler delivery, skip behavior, and Pool blast behavior. They must all use
the same cadence, the same slot identity, and the same stop rules.

This ADR records the policy decision only. It does not claim that a scheduler,
outbox migration, Gotify adapter, quiet-hours environment wiring, or Pool blast
implementation exists today. Those changes make this policy true later.

A nag is a window with two anchors:

- **X** is when nagging can start.
- **Y** is when the chore is fully late.

For the MVP's precise due dates, `X = Y = chores.due_date`. The ladder is
written relative to `Y`, not as a special rule that is inseparable from a
precise due date. When P4 adds fuzzy due windows, `X` moves to the window start
and `Y` moves to the window end. The post-deadline ladder stays the same.

```text
                  X = Y = due date
                        │
── no nag ──────────────┤  L0        L1        L2       L3, L4, L5 …
                        │ (due)     +1h       +4h       09:00 & 18:00 local
                        └──────────────────────────────────────────────────▶
                                   overdue, until done or skipped
```

This keeps the MVP small and does not block fuzzy windows later.

## Decision

### Assigned nag ladder

Assigned nag slots use household-local time. The timezone authority is
`HOUSEHOLD_TZ`, resolved by `src/utils/householdTime.ts`. That module defaults
an unset household timezone to UTC and validates IANA timezone names through
`Intl`.

The ladder is:

| Slot  | Instant                                                                  |
| ----- | ------------------------------------------------------------------------ |
| `L0`  | `Y`                                                                      |
| `L1`  | `Y + 1 hour`                                                             |
| `L2`  | `Y + 4 hours`                                                            |
| `L3+` | every household-local `09:00` and `18:00` strictly after `L2`, unbounded |

The ladder does not terminate by age. It stops only when the occurrence is
resolved, the chore leaves assignment, or `remind_until_done` becomes `0`.
Resolved means completed or skipped. This is intentional: persistent reminders
continue until the chore is done or skipped.

An assigned nag is eligible only when all of these are true:

- `status = 'open'`;
- `assignee_id IS NOT NULL`;
- `remind_until_done = 1`; and
- `due_date IS NOT NULL`.

The recipient is the assignee only. The creator receives no assigned nag unless
the creator is also the assignee. An assigned chore with no due date never nags,
because it has no `X` or `Y` anchor.

Turning `remind_until_done` to `0` cancels unsent assigned-nag slots and creates
no new assigned-nag slots for that chore. Turning it back to `1` resumes from
the next eligible ladder point. It does not replay slots that were suppressed
while the toggle was off.

The notification text stays neutral and uses the existing format from
`docs/system-design.md`: `TOW: <title>`. The chore is the subject. This ADR adds
no roles, scorekeeping, per-person comparison, or Pool push behavior beyond the
single configured Pool blast below.

### Quiet hours

Quiet hours are controlled by these environment variables when the scheduler
reads them:

- `QUIET_HOURS_START`, default `21:00`;
- `QUIET_HOURS_END`, default `08:00`.

Both values are household-local `HH:MM` values in `HOUSEHOLD_TZ`. If either
variable is unset, quiet hours are disabled. Per-Member timezones and per-Member
quiet hours are out of scope for the MVP.

A slot whose ladder instant falls inside the quiet-hours window is deferred, not
dropped. Its delivery time becomes the next quiet-hours end. For example, with
the default window, a slot whose ladder instant is 22:00 is eligible for
delivery at 08:00 the next morning unless coalescing supersedes it.

The outbox stores the ladder truth and the delivery time separately. The
`slot_key` remains the ladder instant. The `deliver_after` value is the
quiet-hours-shifted instant when the row may be sent.

Two coalescing rules prevent a morning burst:

- **Backward coalescing.** When several pending slots for the same chore and
  recipient have the same release time, only the greatest pending `slot_key` is
  sent. The older rows become `superseded`.
- **Forward coalescing.** If the next ladder point after a deferred slot falls
  within 60 minutes after the deferred slot's release time, the deferred slot
  becomes `superseded`, and the later ladder point carries the message instead.

With the default quiet window, a chore due at 22:00 has `L0` at 22:00, `L1` at
23:00, and `L2` at 02:00. All three defer to 08:00. Backward coalescing keeps
only `L2`. The next ladder point is 09:00. Because 09:00 is within 60 minutes
after the 08:00 release, forward coalescing supersedes the deferred `L2`. The
chore sends one message at 09:00, not one at 08:00 and another at 09:00.

Because the steady-state `L3+` slots are 09:00 and 18:00, only `L0` through `L2`
can land in the default 21:00-08:00 quiet window. In the default configuration,
quiet-hours logic is therefore first-day-only. If a household configures quiet
hours to overlap 09:00 or 18:00, the same coalescing rules apply, but the
effective cadence can become lower than twice daily.

### Slot identity and outbox contract

The delivery outbox needs these columns and states so that scheduler ticks and
restarts are idempotent:

- `kind` identifies the policy family. This ADR defines `assigned_nag` and
  `pool_blast`.
- `slot_key` is the ladder point's own instant, serialized as UTC ISO-8601 to
  the second.
- Uniqueness is `(chore_id, recipient_id, kind, slot_key)`. This key, not an
  in-memory timer, prevents duplicate logical slots across restarts.
- `deliver_after` is a separate column that stores the quiet-hours-shifted
  delivery instant.
- Status is one of `pending`, `sent`, `superseded`, or `undeliverable`.

A recipient with no `users.gotify_token` at send time makes the delivery row
terminal `undeliverable`. The sender does not retry that row. Token lookup still
happens at send time, so a Member who adds a token later can receive the next
slot.

Delivery is at-least-once, not exactly-once. If Gotify accepts a message and the
process crashes before SQLite commits the `sent` transition, a later tick can
send that external message again. That duplicate is acceptable and must be
understood by tests and operators.

The scheduler ticks every 60 seconds. A row is sent on the first tick where
`deliver_after <= now`, so timing assertions must tolerate up to one tick of
lateness.

### No backfill for assigned nags

A chore that becomes nag-eligible while already overdue must not fire a burst of
old messages. Child 12 must add `chores.nag_eligible_since`, a mirror of
`chores.unassigned_since` for assigned nag eligibility.

Set `chores.nag_eligible_since` to the current instant whenever a chore enters
assigned-nag eligibility:

- it is assigned;
- it is reassigned;
- it is claimed from the Pool;
- `remind_until_done` changes from `0` to `1`; or
- a completed or skipped occurrence becomes `open` again.

Slot creation then uses one window rule:

```text
for each eligible chore C, recipient R:
  window_start = max(C.nag_eligible_since,
                     greatest slot_key already recorded for (C, R, 'assigned_nag'))
  for each ladder point P where window_start < P <= now:
      insert (C, R, 'assigned_nag', slot_key = P,
              deliver_after = quietShift(P), status = 'pending')
```

This rule produces the intended cases without extra product judgment:

- A normal chore assigned before it is due has `nag_eligible_since < L0`, so
  `L0` fires on time.
- A chore due at 10:00 creates day-one ladder points at 10:00, 11:00, 14:00, and
  18:00, subject to the 60-second tick.
- A chore assigned three days overdue at 14:00 has `nag_eligible_since = now`.
  The backfill window is empty, so it sends one message at the next ladder
  point, 18:00, not a burst of old slots.
- A `remind_until_done` toggle from off back to on resets `nag_eligible_since`.
  Suppressed slots are unreachable, so delivery resumes without replay.
- Reassignment resets the anchor, so the new assignee inherits the ladder's
  current position and not the old assignee's delivery history.

### Pool blast

The Pool remains ambient in-app pressure by default. The only Pool push behavior
in the MVP is one optional due-date blast.

The Pool blast kind is `pool_blast`. It has one ladder point:

```text
due_date - POOL_BLAST_LEAD_HOURS
```

`POOL_BLAST_LEAD_HOURS` defaults to `24`. A value of `0` or an unset value
disables the blast. The scheduler and `.env.example` must add this environment
variable when the code reads it, not before.

Pool blast eligibility is:

- `status = 'open'`;
- `assignee_id IS NULL`;
- `due_date IS NOT NULL`; and
- `remind_until_done = 1`.

Recipients are every Member. A Pool item with no due date never blasts.
`remind_until_done = 0` suppresses the Pool blast as well as assigned nags.

The no-backfill anchor for Pool blast is the existing `chores.unassigned_since`.
If an item enters the Pool after its lead point has passed, it never creates
that blast. Because `slot_key` derives from `due_date` alone, an item that
leaves and re-enters the Pool cannot blast twice for the same due date and
recipient. The uniqueness key enforces the Epic rule: at most one blast per item
and recipient. Forward coalescing does not apply to this one-point ladder. If
quiet hours defer a Pool blast, the blast is delivered at the quiet-hours end
unless the item stops being eligible first.

### Handoffs

Child 12 must carry two schema requirements that were not listed in its first
outbox sketch: `notification_deliveries.deliver_after` and
`chores.nag_eligible_since`. Child 12 also lands the glossary terms Nag,
Delivery Slot, and Quiet Hours in `docs/domain-language.md`, because that is the
change that makes those terms true in behavior. Child 14 reads the Pool blast
policy from this ADR and does not choose its own lead time or repeat rule.

## Alternatives considered

- **Once-daily steady state.** The recommended option was `L0`, `L1`, `L2`, then
  one household-local 09:00 reminder per day. It was rejected in the design
  round in favor of the twice-daily 09:00 and 18:00 steady state.
- **Every four hours forever.** Rejected. It is simple, but it is more likely to
  create nag fatigue and does not fit the relief principle.
- **Drop quiet-hours slots.** Rejected. Dropping slots loses the persistent
  reminder contract at the exact time when a chore may already be late.
- **No quiet hours.** Rejected for the default policy. A 03:00 push for a chore
  is more likely to teach the user to disable notifications than to create
  relief.
- **Leave Pool blast timing to child 14.** Rejected. The point of this ADR is to
  stop later implementation children from inventing policy.

## Consequences

**Good**

- Scheduler work can be implemented as eligibility tests with no further product
  decision about cadence, quiet hours, retry terminal states, or Pool blast
  timing.
- The two-anchor model keeps P4 fuzzy windows open. Fuzzy windows move `X` and
  `Y`; they do not redesign the overdue ladder.
- `slot_key` and `deliver_after` separate logical slot identity from operational
  delivery timing, which makes quiet-hours deferral safe and restart-safe.
- `nag_eligible_since` gives no-backfill behavior one rule instead of special
  cases for late assignment, reassignment, and toggle resume.
- The Pool blast remains one configured push, while Pool age remains the main
  ambient signal.

**Bad or limiting**

- Twice-daily steady-state reminders raise a nag-fatigue risk against the
  product brief's principle that relief is the goal. The once-daily alternative
  is one policy constant away, so real-use signal can move the cadence without a
  redesign.
- The MVP uses one instance-wide `HOUSEHOLD_TZ` and one instance-wide quiet
  window. A second Member may ask for per-person quiet hours or per-person
  timezones, but that is out of scope.
- Quiet hours are configurable enough to overlap 09:00 or 18:00. In that case,
  coalescing keeps behavior sane, but the effective reminder cadence can drop.
- At-least-once delivery can create a rare duplicate external Gotify message
  after a crash between send acceptance and SQLite commit.

## Related

- Product principles and persistent-reminder scope:
  [Product Brief](../product-brief.md#how-should-persistent-reminders-behave).
- Notification message format and Tow branding:
  [System Design](../system-design.md).
- Recurrence and occurrence status semantics:
  [ADR 0005](0005-recurring-chores-spawn-a-new-row-on-completion.md).
- Forward-only migrations that will add outbox columns:
  [ADR 0006](0006-forward-only-sql-migrations-applied-at-startup.md).

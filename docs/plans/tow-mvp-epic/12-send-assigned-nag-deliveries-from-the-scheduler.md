---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add the notification delivery outbox and an in-process scheduler loop that creates and sends assigned nag slots. Prove production startup initializes exactly one scheduler after migrations and before readiness."
affectedPaths:
  - "src/**/migrations/**"
  - "src/notifications/**"
  - "src/scheduler/**"
  - "src/server/**"
  - "src/pages/api/chores/**"
  - "src/components/**"
  - "tests/**"
  - "deno.json"
  - "Containerfile"
  - ".env.example"
  - "docs/**"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:52.492Z"
updatedAt: "2026-08-10T16:07:52.492Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 12
dependencies:
  - "11-add-gotify-tokens-and-notification-port"
---

# Send Assigned Nag Deliveries from the Scheduler

## Context

The MVP becomes real when the first nag fires. The Epic requires an in-process
scheduler, a per-recipient delivery outbox, default-on `remind_until_done`, and
at-least-once delivery semantics.

## Objective

Create assigned-chore nag delivery slots and send pending slots through the
notification port. Make scheduler startup safe in the production server
lifecycle and resilient across restarts.

## Approach

Add `notification_deliveries` and activate `remind_until_done` through
migrations. Implement a bounded `tick` operation that first creates eligible
slots idempotently from the ADR policy, then sends pending rows through the
notification port. Start exactly one scheduler loop after migrations and before
readiness in production. Guard hot-module reload and cancel on shutdown.

## Files to Modify

- `src/**/migrations/**` — add `notification_deliveries`, backfill/default
  `remind_until_done`, and remove or stop using `chores.notification_sent_at`.
- `src/notifications/**` — use the notification port for actual sends.
- `src/scheduler/**` or equivalent module — own scheduler lifecycle and bounded
  `tick`.
- Production server startup hook files under `src/` — initialize the scheduler
  after migrations.
- `src/pages/api/chores/**` and `src/components/**` — expose and persist the
  per-chore `remind_until_done` toggle.
- `tests/**` — cover slot creation, send attempts, retries, restart recovery,
  and lifecycle.
- `deno.json` and `Containerfile` — support production lifecycle tests if
  needed.
- `.env.example` and deployment docs — document scheduler, `GOTIFY_URL`,
  single-replica assumption, and persistent volume need.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Notification port from `11-add-gotify-tokens-and-notification-port` — all
  external sends go through it.
- Nag policy ADR from `10-record-the-nag-policy-adr` — use its slots as
  scheduler authority.
- Migration system — add outbox and column changes through normal migrations.
- `ENABLE_AUTH=false` and `DB_ENV=test` — use no-op sender and isolated test
  database for scheduler tests.

## Implementation Steps

- [ ] A migration creates `notification_deliveries` with occurrence, recipient,
      kind, policy slot, attempt timestamps, sent timestamp, and a uniqueness
      constraint for logical slots.
- [ ] A migration removes `chores.notification_sent_at` or makes it no longer
      part of notification authority, per the Epic decision.
- [ ] Assigned open chores default `remind_until_done` to true, and the chore
      editor can turn it off or on.
- [ ] Turning `remind_until_done` off cancels unsent assigned-nag slots and
      prevents later assigned-nag slot creation for that chore.
- [ ] Turning `remind_until_done` back on resumes from the next eligible policy
      slot and does not replay suppressed slots.
- [ ] Scheduler `tick` creates eligible assigned-nag delivery slots idempotently
      for open assigned chores.
- [ ] Scheduler `tick` sends pending slots through the notification port and
      marks successful rows sent.
- [ ] Failed sends are isolated per delivery, logged without secrets, and remain
      retryable without blocking requests or other recipients.
- [ ] Restart recovers pending rows without creating duplicate logical slots.
- [ ] Production startup initializes exactly one scheduler after migrations and
      before readiness.
- [ ] Development hot reload does not create a second loop, and shutdown cancels
      the timer.
- [ ] Delivery guarantee is documented as at-least-once, with a rare possible
      external duplicate after send success and before SQLite records success.

## Verification Plan

- Automated: `deno task ci`.
- Automated: scheduler tests for slot creation, no duplicate logical slots, send
  success, send failure, retry, token rotation at send time, and
  `remind_until_done` on/off behavior.
- Automated: `deno task test:production-lifecycle` proves the built production
  server applies migrations, initializes one scheduler, and recovers pending
  delivery rows after restart.
- Expected result: an assigned, open, past-due chore with
  `remind_until_done = true` creates one delivery row for each eligible policy
  slot and produces `TOW: <title>` through the configured sender.
- Expected result: with no `GOTIFY_URL`, the full test suite passes and
  notification attempts are logged or no-oped.

## Edge Cases & Considerations

- The scheduler assumes one process and one SQLite writer. Do not design this
  child for multi-replica deployment.
- Exactly-once external delivery is not promised.
- Do not send Pool nudges here. Pool nudge is a separate child.

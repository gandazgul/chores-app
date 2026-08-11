---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Show Pool age from `unassigned_since` and add the configured one-slot pool blast through the delivery outbox. Keep Pool pressure ambient in-app and isolate delivery failures per recipient."
affectedPaths:
    - "src/components/**"
    - "src/pages/index.astro"
    - "src/scheduler/**"
    - "src/**/migrations/**"
    - ".env.example"
    - "docs/**"
    - "tests/**"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:52.698Z"
updatedAt: "2026-08-10T16:07:52.698Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 14
dependencies:
    - "13-add-skip-resolution-and-nag-stop-behavior"
---

# Add Pool Age Nudge and Pool Blast

## Context

The Pool's health signal is age, not due date. Age comes from `unassigned_since`, which resets whenever a chore enters the Pool. The Epic permits at most one server-configured due-date blast policy slot per Pool item and recipient.

## Objective

Show Pool age in the browser and add the pool blast delivery slot through the existing notification outbox. Keep Pool pressure ambient in the app and avoid repeated push behavior.

## Approach

Use `unassigned_since` as the only source for Pool age. Extend scheduler eligibility for pool blast slots while keeping assigned nags separate. Reuse `notification_deliveries` uniqueness per item, recipient, kind, and policy slot. Add configuration documentation for the server-controlled blast.

## Files to Modify

- `src/components/**` — show Pool age with neutral language in the Pool view.
- `src/pages/index.astro` — pass Pool age data or raw `unassigned_since` to the view.
- `src/scheduler/**` — add pool blast slot creation and delivery behavior.
- `src/**/migrations/**` — add any missing delivery kind constraints or indexes needed for pool blasts.
- `.env.example` — document pool-blast configuration.
- `docs/**` — document operational behavior and the ambient-versus-push boundary if needed.
- `tests/**` — cover age reset, Pool view display, and per-recipient pool blast slots.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Assignment model from `07-add-household-assignment-model-and-apis` — use `assignee_id IS NULL` and `unassigned_since`.
- Pool view from `09-add-whats-next-board-and-pool-views` — add age display without changing view ownership.
- Notification outbox and scheduler from `12-send-assigned-nag-deliveries-from-the-scheduler` — reuse per-recipient slot and retry behavior.
- Notification port from `11-add-gotify-tokens-and-notification-port` — send only through the existing port.

## Implementation Steps

- [ ] Pool view displays each Pool chore's age from `unassigned_since` with neutral language.
- [ ] Creating a Pool chore sets `unassigned_since` to the entry time.
- [ ] Releasing or reassigning a chore into Pool resets `unassigned_since`.
- [ ] Claiming or assigning a chore out of Pool stops Pool age accumulation for active Pool display.
- [ ] Scheduler creates at most one pool blast delivery slot per Pool item, recipient, and configured policy slot.
- [ ] Pool blast delivery uses the same outbox retry, sent timestamp, redaction, and per-recipient isolation as assigned nags.
- [ ] One member's pool blast failure does not suppress another member's delivery.
- [ ] No repeated Pool push behavior exists beyond the configured one-slot blast.
- [ ] Configuration and docs make clear that Pool pressure is ambient in-app by default.

## Verification Plan

- Automated: `deno task ci`.
- Automated: tests prove `unassigned_since` resets on Pool entry and does not reset on unrelated edits.
- Automated: scheduler tests prove one pool blast slot per item, recipient, and configured blast, with no duplicate logical slot across restarts.
- Automated: tests prove per-recipient failure isolation.
- Manual headed browser check: run `deno task dev`, open `http://127.0.0.1:8080`, create a Pool item, confirm age appears, assign it, release it back to Pool, and confirm age resets.
- Expected result: Pool nudge does not behave like assigned nagging.

## Edge Cases & Considerations

- Pairing is recommended because Pool-age wording must avoid blame.
- Pool age is not due-date age. Do not use due date as fallback age.
- The same at-least-once external delivery caveat applies to pool blasts.
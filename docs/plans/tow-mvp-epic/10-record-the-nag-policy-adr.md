---
classification: "PLANNED_CHANGE"
workKind: "DOCUMENTATION"
complexity: "MEDIUM"
summary: "Run the P3 nag-timing design round and record the cadence, escalation, and any quiet-hours decisions in an ADR before scheduler implementation depends on them."
affectedPaths:
  - "docs/adr/**"
  - "docs/product-brief.md"
  - "docs/roadmap.md"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:52.157Z"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 10
dependencies:
  - "09-add-whats-next-board-and-pool-views"
planId: "c05fe6ab-21e3-4ea4-89e2-2368a78bbac2"
collaborationRecommendation: "autonomous"
updatedAt: "2026-08-16T14:30:48.728Z"
status: "ready_for_work"
userVerifiedAt: null
---

# Record the Nag Policy ADR

## Context

The Epic fixes the notification subsystem shape but deliberately leaves nag
cadence and escalation policy to a P3 design round. The timing must not block
later fuzzy due windows. The required shape is
`start nagging on X, escalate toward Y`.

## Objective

Create an ADR that records the MVP nag timing policy, escalation behavior, and
any quiet-hours decision before the scheduler encodes it.

## Approach

Use the product brief constraints and current roadmap as inputs. Make the
decision small enough for the MVP and explicit enough for scheduler tests. Do
not implement scheduler code in this child.

## Files to Modify

- `docs/adr/**` — add the nag policy ADR.
- `docs/product-brief.md` — update only if the decision clarifies MVP product
  language without changing scope.
- `docs/roadmap.md` — update only if needed to point to the ADR as the policy
  source.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Existing ADR format in `docs/adr/` — follow the same document style.
- `docs/product-brief.md` — reuse settled principles: right to interrupt is
  earned by assignment, neutral framing, Pool is ambient.
- Epic P4 constraint — express timing so fuzzy due windows can layer on later.

## Implementation Steps

- [ ] A new ADR records the assigned-chore nag cadence for the MVP.
- [ ] The ADR records escalation slots in the shape
      `start nagging on X, escalate toward Y`.
- [ ] The ADR records whether quiet hours exist in the MVP and how they affect
      delivery slots.
- [ ] The ADR records how `remind_until_done` suppresses future slots and how
      turning it back on resumes.
- [ ] The ADR records that delivery is at-least-once, not exactly-once, because
      of the Gotify send and SQLite commit crash window.
- [ ] The ADR does not introduce roles, scorekeeping, per-person comparison, or
      Pool push behavior beyond the one configured blast allowed by the Epic.

## Verification Plan

- Automated: documentation formatting or link checks if the repository has them;
  otherwise `deno task ci` for the normal gate.
- Manual: read the ADR and confirm an Engineer can turn each policy slot into
  scheduler eligibility tests.
- Expected result: no scheduler implementation has to invent cadence,
  escalation, or quiet-hours rules.

## Edge Cases & Considerations

- This child is documentation and design capture only.
- Keep policy reversible. The MVP needs a real nag, not a complete future-proof
  notification product.
- Do not make claims about production Gotify operations that are not implemented
  yet.

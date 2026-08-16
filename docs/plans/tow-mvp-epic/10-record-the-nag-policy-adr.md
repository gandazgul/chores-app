---
planId: "c05fe6ab-21e3-4ea4-89e2-2368a78bbac2"
classification: "PLANNED_CHANGE"
workKind: "DOCUMENTATION"
complexity: "MEDIUM"
summary: "Run the P3 nag-timing design round and record the cadence, escalation, and any quiet-hours decisions in an ADR before scheduler implementation depends on them."
affectedPaths:
  - "docs/adr/**"
  - "docs/product-brief.md"
  - "docs/roadmap.md"
objectiveCheckWaivers:
  []
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
createdAt: "2026-08-10T16:07:52.157Z"
updatedAt: "2026-08-16T22:37:54.489Z"
status: "verified"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 10
dependencies:
  - "09-add-whats-next-board-and-pool-views"
implementedAt: "2026-08-16T14:34:10.904Z"
verifiedAt: "2026-08-16T22:37:54.489Z"
userVerifiedAt: null
executionReport: "- Created `docs/adr/0007-nag-cadence-escalation-and-quiet-hours.md` as Accepted ADR 0007 with the two-anchor model, assigned-nag ladder, quiet-hours deferral/coalescing, outbox slot identity, no-backfill, Pool blast, at-least-once, and tick policy.\n- Updated `docs/roadmap.md` and `docs/product-brief.md` to point to ADR 0007 as the nag and Pool blast policy source; did not change `docs/domain-language.md`.\n- Scope held to docs: changed/untracked files are under `docs/`; no `src/`, `tests/`, `scripts/`, or `.env.example` files were changed, and no tests were added, edited, or removed.\n- Manual verification completed against child plans 12 and 14: eligibility, uniqueness, token/undeliverable, retry/at-least-once, toggle/no-backfill, and Pool blast rules have ADR coverage; worked cases produce 10:00/11:00/14:00/18:00, one 09:00 message for 22:00 due, and one 18:00 message for three-days-overdue assignment at 14:00.\n- Verification passed: `deno fmt --check docs/`, `deno task ci`, objective checks OC1-OC7, and docs-only changed/untracked file check."
humanReviewMode: "ask"
humanReviewDecision: "approved"
humanReviewedAt: "2026-08-16T22:37:47.386Z"
validationCheckpoint: null
executionMode: "worktree"
deliveryEvidence:
  version: 1
  mode: "worktree_merge"
  executionCommit: "d2e1ff857000543d94de09b67c4587215b0b3b05"
  targetBranch: "main"
  targetHeadBeforeMerge: "f363d1ef6b7fa956c5ccf60d7e111c91b9a4b1ce"
validationCiAttempts: 0
validationObjectiveCheckAttempts: 0
validationSemanticRounds: 1
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

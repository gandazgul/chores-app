---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add creator versus assignee fields, unassigned pool state, flat household permissions, and first-class claim, assign, release, and reassign mutations. Add the member read endpoint and domain language for household terms."
affectedPaths:
  - "src/**/migrations/**"
  - "src/pages/api/chores/**"
  - "src/pages/api/members/**"
  - "src/pages/index.astro"
  - "src/utils/**"
  - "tests/**"
  - "docs/domain-language.md"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:51.880Z"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 7
dependencies:
  - "05-provision-household-users-behind-an-allowlist"
  - "06-restore-csrf-protection-for-browser-mutations"
planId: "9423fd18-e4b9-4c41-988a-b750e9a2eb02"
collaborationRecommendation: "autonomous"
updatedAt: "2026-08-15T15:27:54.130Z"
status: "ready_for_work"
userVerifiedAt: null
---

# Add Household Assignment Model and APIs

## Context

The product model changes from one user's private chore list to one household
with flat permissions. Assignment has two paths: direct assign or self-claim
from the pool. The current code still filters lists by `user_id` and returns 403
when another user edits or deletes a chore.

## Objective

Add the household assignment data model and API behavior. Drop owner-scoped
visibility and ownership checks. Make claim, assign, release, and reassign
first-class transitions. Add household terms to the glossary when the model
exists.

## Approach

Add `chores.assignee_id` and `chores.unassigned_since` through migrations. Keep
`user_id` as creator. Default new chores to the creator as assignee, while API
input can choose the pool or a member. Add a members read endpoint for signed-in
members. Use status `open` for active assignment queries.

## Files to Modify

- `src/**/migrations/**` — add `chores.assignee_id` and
  `chores.unassigned_since` with safe backfills.
- `src/pages/api/chores/index.*` — return household chores to signed-in members
  and default new chores to the creator unless Pool or another member is
  specified.
- `src/pages/api/chores/[id].*` or dedicated action routes — add claim, assign,
  release, and reassign transitions.
- `src/pages/api/members/**` — add signed-in member list endpoint with id, name,
  and picture/configured public data only.
- `src/pages/index.astro` — remove owner-scoped list query if still present.
- `src/utils/**` — add shared assignment validation helpers if useful.
- `tests/**` — cover household visibility, flat permissions, assignment
  transitions, and member endpoint access.
- `docs/domain-language.md` — add Assignee, Pool, Claim, and Member in the same
  change as the implemented model.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Existing chore API route structure — extend the chore resource instead of
  inventing unrelated patterns.
- Current content negotiation in `POST /api/chores` — keep form and JSON
  behavior.
- Migration system — all schema changes go through migrations.
- CSRF protection from `06-restore-csrf-protection-for-browser-mutations` —
  apply the established mutation boundary.

## Implementation Steps

- [ ] A migration adds nullable `chores.assignee_id` referencing `users(id)` and
      `chores.unassigned_since`.
- [ ] Existing open chores are backfilled so they remain useful after the
      migration.
- [ ] `chores.user_id` is creator identity only and is not used for visibility
      or ownership authorization.
- [ ] `GET /api/chores` and page list queries return every household chore to
      any signed-in member.
- [ ] Owner-only 403 checks no longer block signed-in members from edit, delete,
      complete, or assignment transitions.
- [ ] New chores default to the creator as assignee unless the request
      explicitly chooses Pool or another member.
- [ ] Claim moves a Pool chore to the signed-in member.
- [ ] Assign and reassign move a chore to a specified member.
- [ ] Release moves an assigned chore to Pool and resets `unassigned_since`.
- [ ] The members endpoint returns only safe member fields and is available only
      to signed-in members.
- [ ] `docs/domain-language.md` defines Assignee, Pool, Claim, and Member and
      avoids aliases that conflict with the product brief.

## Verification Plan

- Automated: `deno task ci`.
- Automated: API tests prove two signed-in members can see the same household
  chores.
- Automated: API tests prove a non-creator can edit, delete, complete, assign,
  claim, and release a chore.
- Automated: API tests prove Pool, claim, assign, release, and reassign
  transitions follow the Epic state machine.
- Automated: member endpoint tests prove unauthenticated access is rejected and
  token/secret fields are not returned.
- Expected result: `WHERE user_id = ?` appears in no list query and `403`
  appears in no owner-only permission path.
- Expected result: the glossary describes the model that is now implemented.

## Edge Cases & Considerations

- Flat permissions are intentional. Do not add roles or owner-only rights.
- The Pool is an inbox. Do not add push behavior here.
- `unassigned_since` must reset when a chore enters Pool after assignment, not
  only at creation.

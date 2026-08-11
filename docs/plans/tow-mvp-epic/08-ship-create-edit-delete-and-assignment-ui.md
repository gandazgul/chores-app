---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Rewrite the chore modal and item controls so members can create, edit, delete, assign, claim, and release chores in the browser. Add due date and time input, with Pool and member choices."
affectedPaths:
  - "src/components/**"
  - "src/pages/index.astro"
  - "src/pages/api/chores/**"
  - "tests/e2e/**"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:51.947Z"
updatedAt: "2026-08-10T16:07:51.947Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 8
dependencies:
  - "07-add-household-assignment-model-and-apis"
---

# Ship Create Edit Delete and Assignment UI

## Context

The current modal only creates chores, and the item UI only toggles done. The
household model needs browser controls for editing, deleting, direct assignment,
Pool, claim, and release. The create/edit surface must accept direct due date
and time, including one-off chores due soon.

## Objective

Make the household assignment and chore-management APIs usable from the browser.
Keep the existing Astro SSR plus Solid island pattern and use the established
mutation channel for each interaction.

## Approach

Restructure the modal into a create and edit surface. Add member and Pool
choices, due date and time controls, delete, and assignment controls. Reuse the
optimistic update plus rollback pattern for fast item actions where it fits. Use
native forms or JSON fetch consistently with existing route contracts and CSRF
rules.

## Files to Modify

- `src/components/ChoreModal.*` — support create and edit with title,
  description, recurrence, due date/time, assignee or Pool, save, and delete.
- `src/components/ChoreItem.*` — add edit entry points, delete control if placed
  on the item, and claim/release/assign controls.
- `src/components/ChoreList.*` or new child components — pass members and
  assignment state to items and modal.
- `src/pages/index.astro` — provide chores and members as props to islands.
- `src/pages/api/chores/**` — adjust response shapes only if the UI needs it and
  tests protect it.
- `tests/e2e/**` — cover headed browser flows for create, edit, delete, direct
  due time, and assignment actions.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `ChoreModal` native form pattern — reuse where 302 reload remains the best
  channel.
- `ChoreItem` optimistic `fetch` with rollback — reuse for claim, release, and
  done-style actions.
- Existing UnoCSS classes and layout style — keep the UI consistent.
- Members endpoint from `07-add-household-assignment-model-and-apis` — feed
  assignment picker data.

## Implementation Steps

- [ ] The modal supports both create and edit for an existing chore.
- [ ] The create/edit surface accepts title, description, recurrence, direct due
      date and time, and assignment choice.
- [ ] New chores default to the creator as assignee in the browser, with
      explicit Pool and member options.
- [ ] A one-off chore due in an hour can be created from the browser and is
      stored with the correct UTC ISO due date.
- [ ] A member can edit a chore's fields from the browser.
- [ ] A member can delete a chore from the browser with a clear confirmation or
      safe affordance.
- [ ] A member can claim a Pool chore, release an assigned chore to Pool, and
      assign or reassign a chore to a member from the browser.
- [ ] Browser mutations include the CSRF or same-origin evidence required by the
      restored protection boundary.
- [ ] Existing done toggle behavior still works after the UI changes.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:e2e`.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, create a one-off chore due in one hour, edit it,
  assign it to Pool, claim it, release it, reassign it, mark it done, and delete
  it.
- Expected result: each browser action updates the page state correctly or
  reloads through the expected channel.
- Expected result: mutation requests without required CSRF or origin evidence
  fail.

## Edge Cases & Considerations

- Frontend pairing is recommended because control placement and modal behavior
  need visual judgment.
- Do not add roles or owner-only restrictions in the UI.
- Avoid a third mutation channel. Use native forms or JSON fetch with the
  established route patterns.

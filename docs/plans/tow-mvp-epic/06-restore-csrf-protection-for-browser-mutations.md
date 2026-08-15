---
classification: "PLANNED_CHANGE"
workKind: "MAINTENANCE"
complexity: "MEDIUM"
summary: "Remove the system-wide `security.checkOrigin: false` trust policy or replace it with an equivalent token boundary. Make browser mutation requests fail without same-origin or valid CSRF evidence before shared household and token mutations ship."
affectedPaths:
  - "astro.config.*"
  - "src/pages/api/**"
  - "src/components/**"
  - "src/layouts/**"
  - "tests/**"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:51.813Z"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 6
dependencies:
  - "01-convert-source-and-tests-to-typescript"
planId: "8c5679ba-f476-4241-8adc-1cfdb465c87f"
collaborationRecommendation: "autonomous"
updatedAt: "2026-08-15T15:03:47.357Z"
status: "ready_for_work"
userVerifiedAt: null
---

# Restore CSRF Protection for Browser Mutations

## Context

The current Astro config sets `security.checkOrigin: false`. The Epic allows
that only for the verified current native-form path. P1 adds shared household
mutations and later P3 stores notification tokens, so the browser mutation
boundary must be restored first.

## Objective

Make browser mutation requests require valid same-origin evidence or an
equivalent CSRF token. Remove `security.checkOrigin: false` as the system-wide
trust policy.

## Approach

Prefer Astro's built-in origin checking if it fits the app's form and fetch
flows. If built-in checking does not cover all browser mutation routes, add a
request token pattern for forms and fetch mutations. Keep Playwright and API
tests able to authenticate in the existing mock-user mode.

## Files to Modify

- `astro.config.*` — restore Astro origin checking or remove the unsafe
  override.
- `src/pages/api/**` — enforce CSRF or origin requirements for browser mutation
  routes as needed.
- `src/components/**` — include CSRF evidence in fetch and form mutations if a
  token approach is used.
- `src/layouts/**` or page frontmatter — expose CSRF tokens to islands if
  needed.
- `tests/**` — add rejection tests for missing and invalid CSRF or origin
  evidence and success tests for valid browser mutations.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Astro built-in `security.checkOrigin` behavior — prefer it if it satisfies the
  need.
- Current content negotiation in `POST /api/chores` — preserve native form and
  JSON API flows.
- Current Playwright mock-user path — keep e2e tests independent of Google.

## Implementation Steps

- [ ] `security.checkOrigin: false` is no longer the system-wide policy in
      `astro.config.*`.
- [ ] Browser-originated create, update, and delete mutations fail without valid
      same-origin or CSRF-token evidence.
- [ ] Valid native form submissions and valid JSON fetch mutations still work.
- [ ] API tests and Playwright tests have a supported way to send valid mutation
      evidence under `ENABLE_AUTH=false`.
- [ ] The protection model is documented in code comments or test names clearly
      enough for later assignment and Gotify-token mutations to reuse.

## Verification Plan

- Automated: `deno task ci`.
- Automated: mutation tests prove missing or invalid origin/token evidence is
  rejected.
- Automated: mutation tests prove valid form and JSON requests still succeed.
- Automated: `deno task test:e2e` confirms the main browser create/update/delete
  path still works.
- Expected result: P1 and P3 can add shared and secret-bearing mutations without
  relying on the unsafe config.

## Edge Cases & Considerations

- Do not break non-browser internal test helpers without providing a clear
  supported path.
- If using tokens, do not expose tokens to third-party origins or logs.
- Keep the implementation small. This child is the boundary, not the assignment
  UI rewrite.

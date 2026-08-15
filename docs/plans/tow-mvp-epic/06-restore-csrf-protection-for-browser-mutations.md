---
planId: "8c5679ba-f476-4241-8adc-1cfdb465c87f"
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
objectiveCheckWaivers:
  []
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
createdAt: "2026-08-10T16:07:51.813Z"
updatedAt: "2026-08-15T15:15:20.651Z"
status: "verified"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 6
dependencies:
  - "01-convert-source-and-tests-to-typescript"
implementedAt: "2026-08-15T15:11:34.842Z"
verifiedAt: "2026-08-15T15:15:20.651Z"
userVerifiedAt: null
executionReport: "- Implemented strict same-origin mutation boundary: removed `security.checkOrigin: false`, added middleware that rejects `POST`/`PUT`/`PATCH`/`DELETE` unless `Origin` exactly matches scheme, host, and port before auth or mock-user setup.\n- Added/updated tests: +3 Deno middleware tests and +5 Playwright CSRF tests; no tests removed. Core journey test was rewritten to keep the same create/complete coverage through the browser native form and JSON toggle. Recurrence tests kept their behavior and now send same-origin evidence. Branding test kept its asset-size behavior and now waits for page load.\n- Updated docs in ADR 0001, `docs/system-patterns.md`, and `docs/tech-context.md` to describe the layered Astro + Tow origin boundary, test-client Origin requirement, and reverse-proxy origin constraint.\n- Verification passed: `deno task ci` (38 Deno tests passed; Astro check reported the existing login-page hint only), `deno task test:e2e --grep \"CSRF boundary\"` (5 passed), `deno task test:e2e` (11 passed), and the objective curl probe passed.\n- Manual production reverse-proxy smoke check was not run because no deployed production URL/proxy access was available in this session; local real-server checks covered the same origin fail-closed behavior."
humanReviewMode: "ask"
humanReviewDecision: "skipped"
validationCheckpoint: null
executionMode: "worktree"
deliveryEvidence:
  version: 1
  mode: "worktree_merge"
  executionCommit: "6771a0f2425f3369261b3b8b7c71c87d0c1b5666"
  targetBranch: "main"
  targetHeadBeforeMerge: "df8f05cae15210296f218724976f2a2d796dc74d"
validationCiAttempts: 0
validationSemanticRounds: 0
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

---
planId: "df8d02bc-aed3-4327-aa06-90166f7f8372"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Rename browser-visible product surfaces and documentation from Chores App to Tow. Update manifest, icons, layout copy, README, and domain language in the same change."
affectedPaths:
  - "public/manifest.json"
  - "public/"
  - "docs/icon.png"
  - "docs/icon1.png"
  - "docs/icon_transparent.png"
  - "src/layouts/Layout.astro"
  - "src/pages/login.astro"
  - "src/pages/index.astro"
  - "README.md"
  - "docs/domain-language.md"
  - "tests/e2e/branding.spec.ts"
  - "uno.config.js"
objectiveCheckWaivers:
  []
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:51.536Z"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 4
dependencies:
  - "01-convert-source-and-tests-to-typescript"
implementedAt: "2026-08-14T17:56:43.650Z"
userVerifiedAt: null
executionReport: "- Implemented Tow rename across UI, manifest, public icons, README, and glossary; public PNG/ICO assets were generated from `docs/icon_transparent.png` with transparent square containment.\n- Applied Pair feedback: one full-width light-primary header on the home page, icon + Tow + `STEADY HOUSEHOLD MANAGEMENT` at left, `New Chore` at far right, no second header, no nested list scrollbar, and reduced button radius.\n- Added `tests/e2e/branding.spec.ts` with 3 new Playwright tests; removed no tests. Updated one `tests/e2e/core-journey.spec.ts` assertion to protect current recurrence behavior: a completed recurring chore keeps its RRULE.\n- Verification passed: `deno task ci` (26 Deno tests passed; Astro check reported 0 errors, 0 warnings, 1 existing inline-handler hint) and `deno task test:e2e` (5 Playwright tests passed).\n- Headed browser checks passed at `http://127.0.0.1:8080/`: desktop 1280x900 and narrow 520x844 showed single Tow header, full-width body, no horizontal scroll, no nested scroll containers, and no browser errors; evidence: `artifacts/tow-home-desktop-final.png`, `artifacts/tow-home-final-clean-current.png`, `artifacts/tow-modal-final-current.png`.\n- Auth-enabled headed login check passed at `http://127.0.0.1:8080/login`: title `Tow`, heading `Tow`, logo alt `Tow logo`, Google sign-in still present; evidence: `artifacts/tow-login-auth-enabled.png`.\n- PWA metadata checked in browser: `/manifest.json` returns `name: Tow`, `short_name: Tow`, `theme_color: #005f6a`, and 192x192/512x512 Tow icon entries.\n- No unresolved product blockers. Note: e2e required seeding the ignored dev database mock user row after prior migration state caused a foreign-key failure during verification setup."
executionMode: "worktree"
executionBaselineTree: "d3404aae2a2183bbb87385547a8f0ee497d2f461"
worktreeId: "75cb168c"
worktreePath: "/Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-04-rename-the-product-to-tow-75cb168c"
worktreeBranch: "worktree/tow-mvp-epic-04-rename-the-product-to-tow-75cb168c"
worktreeBaseBranch: "main"
worktreeStatus: "completed"
validationCiAttempts: 0
validationCheckpoint: null
validationSemanticRounds: 1
status: "validated_reviewer"
updatedAt: "2026-08-14T23:23:54.701Z"
humanReviewMode: "ask"
humanReviewDecision: "skipped"
---

# Rename the Product to Tow

## Context

The Epic resolves the product name as Tow. The current app and glossary still
use Chores App. The rename is browser-visible and includes PWA metadata and icon
assets.

## Objective

Make Tow the implemented product name in the app, manifest, icons, README, and
domain language. Keep theme color in sync with existing design settings.

## Approach

Update copy and metadata in one focused change. Use the user-approved
`docs/icon_transparent.png` as the source of truth for every public icon. Put
the 637x648 source on a centered 648x648 transparent canvas before resizing so
no output stretches or clips the circular mark. Use the already available pinned
`npm:sharp@0.34.5` image pipeline with `fit: "contain"` and a fully transparent
background, so generation and pixel-level verification are reproducible. Close
the Product name open question only when the app itself says Tow.

The visible change is:

```text
Before: Chores App / Chores / My Chores
After:  Tow
        STEADY HOUSEHOLD MANAGEMENT
```

Keep `#005f6a` as the primary and browser theme color. The set-aside option was
the detailed `docs/icon.png` wordmark; it is less legible at favicon size and
does not match the approved circular mark in `docs/system-design.md`.

## Files to Modify

- `public/manifest.json` — update `name`, `short_name`, and keep `theme_color`
  aligned with design tokens.
- `public/icon.png`, `public/android-chrome-192x192.png`,
  `public/android-chrome-512x512.png`, `public/apple-touch-icon.png`,
  `public/favicon-16x16.png`, `public/favicon-32x32.png`, and
  `public/favicon.ico` — replace the old chore-calendar artwork with outputs
  derived from the approved transparent Tow mark. `public/icon.png` is 648x648;
  the other PNG dimensions stay encoded in their filenames/link declarations;
  the ICO keeps at least its 16x16 and 32x32 entries.
- `docs/icon_transparent.png` — retain the user-provided approved source art in
  version control. Preserve the user's current `docs/icon.png` modification and
  `docs/icon1.png` removal; do not overwrite or recreate either file.
- `src/layouts/Layout.astro` — update the document title, logo alternative text,
  shared header name, and footer product copy; keep the manifest and icon links.
- `src/pages/login.astro` — update the logo alternative text and sign-in heading
  to Tow.
- `src/pages/index.astro` — replace the old page heading and task-oriented
  subtitle with `Tow` and `STEADY HOUSEHOLD MANAGEMENT`.
- `README.md` — use Tow in the title, introduction, and contribution copy;
  describe household chores without renaming repository, package, or container
  identifiers.
- `docs/domain-language.md` — rename the glossary for Tow, define Tow as the
  implemented product name, and remove the Product name open question in the
  same change.
- `tests/e2e/branding.spec.ts` — protect the document title, visible home-page
  brand copy, manifest names/colors/icon entries, and public icon responses.
- `uno.config.js` — remains the design-token source used to verify that manifest
  and page metadata keep the primary `#005f6a`; change it only if consistency
  requires it.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Existing layout and page structure — update copy without changing navigation
  behavior.
- Existing UnoCSS theme values — keep manifest color aligned.
- `docs/icon_transparent.png` — use the approved transparent Tow mark as the
  only generation source; do not independently crop each output.
- `tests/e2e/core-journey.spec.ts` and `playwright.config.ts` — follow the
  existing Playwright server and assertion patterns for the branding regression
  test.

## Implementation Steps

- [ ] `src/layouts/Layout.astro`, `src/pages/login.astro`, and
      `src/pages/index.astro` contain no browser-visible `Chores App`, `Chores`
      brand label, or old logo alternative text; they render Tow instead.
- [ ] The default page heading is `Tow` and its adjacent subtitle is exactly
      `STEADY HOUSEHOLD MANAGEMENT`; chore-domain labels remain plain and are
      not changed to nautical metaphors.
- [ ] `public/manifest.json` has `name` and `short_name` equal to `Tow`, keeps
      `theme_color` equal to the UnoCSS primary color `#005f6a`, and continues
      to declare the 192x192 and 512x512 PNG icons.
- [ ] Every referenced public logo, favicon, touch icon, and manifest icon is
      derived from `docs/icon_transparent.png` through one Sharp `contain`
      pipeline, has its declared pixel size (`public/icon.png` is 648x648),
      preserves the mark's aspect ratio on a transparent square canvas, and is
      recognizable in the header and at 16x16 favicon size.
- [ ] `README.md` describes the household chore product as Tow while the
      `chores-app` repository path, Deno package name, and container examples
      remain compatible.
- [ ] `docs/domain-language.md` defines **Tow** as the implemented product name,
      uses Tow in its title and scope, removes the Product name open question,
      and keeps **Chore**, **Done**, and other domain terms unchanged.
- [ ] `tests/e2e/branding.spec.ts` fails against the pre-rename UI and protects
      the Tow document title, home heading/subtitle, manifest values, and HTTP
      availability and media types of all linked icon assets.
- [ ] Auth, chore, recurrence, persistence, API, and navigation behavior are
      unchanged.

## Approval Confirmation

No completed Work Record is materially replaced by this Plan, so `supersedes` is
intentionally omitted.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:e2e tests/e2e/branding.spec.ts` for the focused
  branding regression, then `deno task test:e2e` for the full browser suite.
- Automated asset assertions in the branding test: request `/manifest.json` and
  every linked icon, assert successful image responses and declared manifest
  values, and read each PNG's intrinsic dimensions in the page where practical.
- Headed home-page check: start `ENABLE_AUTH=false deno task dev`, open
  `http://127.0.0.1:8080`, and confirm the tab title, shared header, page
  heading/subtitle, footer, and logo alternative text use Tow. Check desktop and
  a mobile viewport; the mark must not stretch, clip, or become illegible.
- Headed login check: start without a session under `ENABLE_AUTH=true`, open
  `http://127.0.0.1:8080/login`, and confirm the Tow heading and logo while the
  existing Google sign-in control and failure behavior remain unchanged.
- Manual Progressive Web App (PWA) check: inspect the manifest in browser
  developer tools and, where browser support permits, install or preview the
  app. Confirm the installed name is Tow and the 192x192/512x512 artwork is the
  approved circular mark.
- Expected result: product surfaces and the glossary agree that Tow is the
  implemented name. Existing chore-management browser tests still protect the
  behavior that must remain. No product behavior is expected to stop existing.

## Edge Cases & Considerations

- The user's current `docs/icon.png`, `docs/icon1.png`, and
  `docs/icon_transparent.png` working-tree changes are authoritative inputs.
  Preserve them; generation work only replaces assets under `public/`.
- Center the non-square transparent source on a 648x648 transparent canvas
  before resize. Do not stretch it to square or crop the tug/towed object. Use
  `npm:sharp@0.34.5`, which is already available in this Deno dependency graph;
  do not add a separate image library or commit a generation script for this
  one-time asset conversion.
- Do not rename technical identifiers such as the `chores-app` package,
  repository directory/URL, image tag, database names, or deployment resources.
- “Chores App” can remain in historical documents that explicitly identify the
  former working title. It must not remain in current UI, README branding, or
  implemented glossary language.
- Keep neutral product language. Do not add scorekeeping, verdict language, or
  nautical aliases for established domain terms.
- Pairing is recommended because favicon legibility and installed-app rendering
  need live visual judgment.

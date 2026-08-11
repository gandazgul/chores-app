---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Rename browser-visible product surfaces and documentation from Chores App to Tow. Update manifest, icons, layout copy, README, and domain language in the same change."
affectedPaths:
  - "public/manifest.json"
  - "public/"
  - "docs/icon.png"
  - "docs/icon1.png"
  - "src/layouts/Layout.astro"
  - "src/pages/login.astro"
  - "src/pages/index.astro"
  - "README.md"
  - "docs/domain-language.md"
  - "uno.config.*"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:51.536Z"
updatedAt: "2026-08-10T16:07:51.536Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 4
dependencies:
  - "01-convert-source-and-tests-to-typescript"
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

Update copy and metadata in one focused change. Regenerate or replace public
icon sizes from the candidate source art in `docs/icon.png` or `docs/icon1.png`.
Close the Product name open question only when the app itself says Tow.

## Files to Modify

- `public/manifest.json` — update `name`, `short_name`, and keep `theme_color`
  aligned with design tokens.
- `public/` icon files — regenerate or replace favicon and touch-icon assets
  from the chosen source art.
- `docs/icon.png` and `docs/icon1.png` — use as candidate source art; modify
  only if the chosen source needs documentation changes.
- `src/layouts/Layout.astro` — update document title and shared product copy.
- `src/pages/login.astro` — update sign-in copy to Tow.
- `src/pages/index.astro` — update header to Tow and subtitle to
  `STEADY HOUSEHOLD MANAGEMENT`.
- `README.md` — update product name and description.
- `docs/domain-language.md` — close the Product name open question in the same
  change.
- `uno.config.*` — check theme color source of truth if needed.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- Existing layout and page structure — update copy without changing navigation
  behavior.
- Existing UnoCSS theme values — keep manifest color aligned.
- Existing icon candidate files in `docs/` — use them as source art.

## Implementation Steps

- [ ] Browser-visible app shell, login page, and default page use the product
      name Tow.
- [ ] The default page header says `Tow` and the subtitle says
      `STEADY HOUSEHOLD MANAGEMENT`.
- [ ] `public/manifest.json` has Tow `name` and `short_name`, and its theme
      color matches the app theme.
- [ ] Public favicon and touch-icon assets show the chosen Tow icon source at
      the required sizes.
- [ ] `README.md` describes the project as Tow.
- [ ] `docs/domain-language.md` no longer has the Product name open question and
      defines the implemented name Tow.
- [ ] The rename does not change auth, chores, recurrence, or data behavior.

## Verification Plan

- Automated: `deno task ci`.
- Automated: `deno task test:e2e`.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, and confirm the app header, subtitle, document title,
  and login page use Tow.
- Manual PWA check: inspect the manifest and installed-app metadata in the
  browser and confirm the Tow name and icon are used.
- Expected result: the glossary describes implemented behavior and does not keep
  the old product-name uncertainty.

## Edge Cases & Considerations

- Do not rename technical identifiers such as package names unless they are
  user-facing or required by metadata.
- Keep neutral product language. Do not add scorekeeping or verdict language.
- Pairing is recommended because icon choice and visual polish benefit from live
  judgment.

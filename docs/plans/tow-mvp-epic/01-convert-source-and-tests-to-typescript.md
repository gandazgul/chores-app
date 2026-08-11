---
classification: "PLANNED_CHANGE"
workKind: "REFACTOR"
complexity: "MEDIUM"
summary: "Convert application source, islands, routes, utilities, and tests from JavaScript to TypeScript. Reconcile the existing TypeScript twins against the running JavaScript behavior and make `deno task ci` the typed baseline."
affectedPaths:
  - "src/**/*.js"
  - "src/**/*.jsx"
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "tests/**/*.js"
  - "tests/**/*.ts"
  - "playwright.config.js"
  - "playwright.config.ts"
  - "scripts/setup_db.js"
  - "deno.json"
  - "deno.lock"
  - "tsconfig.json"
  - "docs/adr/0002-typescript-instead-of-javascript-with-jsdoc.md"
  - "docs/system-patterns.md"
  - "docs/tech-context.md"
  - "docs/roadmap.md"
objectiveChecks:
  - id: "OC1"
    command: "deno eval 'const r=[\"src/types.ts\",\"src/middleware.ts\",\"src/components/ChoreItem.tsx\",\"src/components/ChoreList.tsx\",\"src/components/ChoreModal.tsx\",\"src/pages/api/auth/login.ts\",\"src/pages/api/auth/logout.ts\",\"src/pages/api/chores/index.ts\",\"src/pages/api/chores/[id].ts\",\"src/utils/auth.ts\",\"src/utils/db.ts\",\"src/utils/scheduleUtils.ts\",\"src/utils/auth.test.ts\",\"src/utils/scheduleUtils.test.ts\",\"src/pages/api/chores/chores.test.ts\",\"tests/e2e/core-journey.spec.ts\",\"tests/e2e/recurrence.spec.ts\",\"playwright.config.ts\"];for(const p of r)try{if(!(await Deno.stat(p)).isFile)throw 0}catch{Deno.exit(1)}async function w(p){for await(const e of Deno.readDir(p)){const q=p+\"/\"+e.name;if(e.isDirectory)await w(q);else if(/\\.(js|jsx|disabled|bak|orig)$/.test(e.name))Deno.exit(1)}}await w(\"src\");await w(\"tests\");for await(const e of Deno.readDir(\".\"))if(e.name.startsWith(\"playwright.config.\")&&e.name!==\"playwright.config.ts\")Deno.exit(1)'"
    rationale: "This fails until every required canonical TypeScript file exists and JavaScript, backup, or duplicate Playwright implementations are absent."
  - id: "OC2"
    command: "test -f src/types.ts && deno eval 'const t=await Deno.readTextFile(\"src/types.ts\");for(const n of [\"UserPayload\",\"Recurrence\",\"ChoreRow\",\"CompletionLogRow\"])if(![\"export type \"+n,\"export interface \"+n].some(x=>t.includes(x)))Deno.exit(1);for(const p of [\"src/pages/api/chores/index.ts\",\"src/pages/api/chores/[id].ts\",\"src/pages/index.astro\",\"src/components/ChoreItem.tsx\",\"src/components/ChoreList.tsx\"])if(!(await Deno.readTextFile(p)).includes(\"types.ts\"))Deno.exit(1);async function w(p){for await(const e of Deno.readDir(p)){const q=p+\"/\"+e.name;if(e.isDirectory)await w(q);else if(/\\.(ts|tsx|astro)$/.test(e.name)&&/\\bas any\\b|@ts-nocheck|no-explicit-any/.test(await Deno.readTextFile(q)))Deno.exit(1)}}await w(\"src\")'"
    rationale: "This fails until the shared boundary types exist, key data consumers use them, and known source data is not hidden behind broad type escapes."
  - id: "OC3"
    command: "test -f src/types.ts && deno lint src tests playwright.config.ts && deno fmt --check src tests playwright.config.ts && deno check && deno run -A --env npm:astro check"
    rationale: "This invokes the real Deno and Astro tools directly, so renamed placeholders or substituted no-op tasks cannot satisfy typed source, TSX, and Astro frontmatter checking."
  - id: "OC4"
    command: "test -f src/types.ts && deno test -A && deno run -A --env npm:astro build && deno run -A npm:playwright test --config=playwright.config.ts"
    rationale: "This requires the converted unit and integration tests, production build, and canonical TypeScript Playwright journeys to execute against the converted application."
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
createdAt: "2026-08-10T12:07:51-04:00"
updatedAt: "2026-08-10T22:29:34.571Z"
status: "ready_for_work"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 1
dependencies:
  []
userVerifiedAt: null
planId: "4e3176d4-f377-45c5-b19e-7e222b6bd189"
---

# Convert Source and Tests to TypeScript

## Context

The Epic schedules ADR 0002 now. The app still runs from JavaScript and JSX
files, while TypeScript twins of the chore routes, recurrence utility, tests,
and Playwright config have drifted. Astro runs the JavaScript route files. The
JavaScript files and their current tests are the behavior source of truth. The
dead TypeScript twins contain useful type drafts, but some twins replace the
one-row-per-occurrence recurrence model with obsolete row recycling.

`deno check` does not type-check Astro frontmatter. The repository has a strict
`tsconfig.json`, but no installed tool reads it. `astro check` currently asks to
install `@astrojs/check` and `typescript` instead of checking the app. The
conversion is not complete until the normal continuous integration (CI) task
checks `.astro` frontmatter as well as TypeScript modules.

## Objective

Convert application source, Solid islands, tests, and the duplicate Playwright
config to one canonical TypeScript implementation without changing product
behavior. Define shared row, recurrence, application programming interface
(API), and session types. Make `deno task ci` check TypeScript, TSX, and Astro
frontmatter without `checkJs` or unbounded `any` casts for known application
data.

## Approach

Reconcile each twin before removing its JavaScript file. Preserve the running
JavaScript behavior, especially recurring Chore spawning, form-versus-JSON
content negotiation, ownership responses, and invalid-RRULE logging. Use the
twins only for useful TypeScript signatures and test context typing.

Add a single shared type module under `src/`. It owns `UserPayload`, the stored
`ChoreRow` and `CompletionLogRow` shapes, parsed recurrence, and the Chore shape
passed through API responses and Solid props. Keep SQLite representation facts
explicit: nullable columns stay nullable, and SQLite booleans are `0 | 1` at the
row boundary. Confine row assertions to prepared-statement results. Request
bodies remain untrusted and are narrowed before use; a TypeScript cast must not
replace runtime validation.

Convert islands to TSX and type their props, callbacks, and DOM events. Keep the
Astro server-side rendering (SSR) plus props-as-channel design. Keep `deno.json`
on `jsx: "react-jsx"` with `jsxImportSource: "solid-js"` for Deno. Keep the
Astro-compatible `tsconfig.json` JSX mode for `astro check`; the two configs can
use different JSX emit modes because they have different consumers, but both
must select Solid. Add versioned `@astrojs/check` and `typescript` imports, add
a non-interactive Astro check task, and include it in `deno task ci`.

## Files to Modify

- `src/types.ts` (new) — own `UserPayload`, `Recurrence`, `ChoreRow`,
  `CompletionLogRow`, and the parsed Chore boundary shape.
- `src/middleware.js` and `src/pages/api/auth/*.js` — become `.ts`; preserve
  mock-user bypass, redirect rules, Google token verification, cookie settings,
  and logout behavior.
- `src/utils/auth.js`, `src/utils/db.js`, and their tests — become `.ts`; use
  shared session and row types without changing database bootstrap or session
  semantics.
- `src/pages/api/chores/index.{js,ts}` — become one `index.ts` that preserves
  authenticated listing and both form and JSON create paths.
- `src/pages/api/chores/[id].{js,ts}` — become one `[id].ts` that preserves
  authorization, update/delete responses, completion logs, and recurring Chore
  successor spawning from the JavaScript implementation.
- `src/pages/api/chores/chores.test.{js,ts}` — become one typed test suite whose
  recurrence expectations match ADR 0005, not the obsolete TypeScript twin.
- `src/utils/scheduleUtils.{js,ts}` and `src/utils/scheduleUtils.test.{js,ts}` —
  become one typed utility and test suite; preserve strict-next-occurrence
  calculation, null fallback, and error logging for invalid RRULE input.
- `src/components/ChoreItem.jsx`, `ChoreList.jsx`, and `ChoreModal.jsx` — become
  `.tsx` with shared Chore props and typed Solid event handlers; remove per-file
  JSX pragmas.
- `src/pages/index.astro` — import canonical `.ts` and `.tsx` modules, use the
  shared Chore type for the server query projection, and keep the current SSR
  data flow.
- `src/env.d.ts` — type `Astro.locals.user` from the shared session type.
- `tests/e2e/core-journey.spec.{js,ts}` and `recurrence.spec.js` — become
  canonical `.ts` specs that preserve create, list, done, and successor-spawn
  assertions.
- `playwright.config.{js,ts}` — keep only the identical TypeScript config.
- `scripts/setup_db.js` — update only the `src/utils/db.ts` import; script
  conversion and DDL removal belong to the next migration child.
- `deno.json` and `deno.lock` — add versioned `@astrojs/check` and `typescript`
  imports, add an Astro check task to `ci`, update `db:setup` imports as needed,
  and remove `checkJs` after source conversion.
- `tsconfig.json` — remain strict and Astro-compatible, include generated Astro
  types and source, and select Solid as the JSX import source.
- `docs/adr/0002-typescript-instead-of-javascript-with-jsdoc.md` — remove the
  “not yet implemented” state and record the landed toolchain and resolved twins
  without rewriting the historical rationale.
- `docs/system-patterns.md`, `docs/tech-context.md`, and `docs/roadmap.md` —
  make current-state language, file names, test commands, and duplicate-file
  notes match the TypeScript implementation.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/utils/auth.js` — retain Google identity-token verification and the
  self-issued session JSON Web Token (JWT) behavior.
- `src/utils/scheduleUtils.ts` — reuse its useful parameter and result types,
  while retaining the JavaScript test's invalid-rule logging assertion.
- JavaScript `POST /api/chores` — retain content negotiation: forms redirect and
  JSON callers receive JSON status responses.
- JavaScript `PUT /api/chores/[id]` plus ADR 0005 — retain the
  one-row-per-occurrence recurrence model; do not reuse the TypeScript twin's
  row-recycling branch.
- JavaScript API and Playwright tests — retain behavioral assertions. Reuse
  `APIContext` and Playwright TypeScript typing from the twins after correcting
  their obsolete recurrence expectations.
- Existing `Astro.locals.user` declaration in `src/env.d.ts` — keep the
  augmentation seam and point it at the canonical `UserPayload` owner.

## Implementation Steps

- [ ] Every application module and test under `src/` and `tests/` has one
      canonical `.ts` or `.tsx` implementation; no `.js` or `.jsx` file remains
      there, and `playwright.config.js` no longer duplicates
      `playwright.config.ts`.
- [ ] `src/types.ts` is the source of truth for `UserPayload`, `Recurrence`,
      `ChoreRow`, `CompletionLogRow`, and the parsed Chore boundary shape.
      Routes, `index.astro`, and Solid props use these types instead of separate
      aliases or `any`.
- [ ] SQLite query boundaries preserve stored representation: nullable fields
      remain nullable, `done` is `0 | 1` in `ChoreRow`, and recurrence parsing
      produces the existing object-or-fallback response without silently
      changing malformed stored values.
- [ ] `src/env.d.ts` gives `Astro.locals.user` the canonical
      `UserPayload | null` type. Middleware, routes, and pages access it without
      `locals as any` or `no-explicit-any` suppressions.
- [ ] `ChoreItem.tsx`, `ChoreList.tsx`, and `ChoreModal.tsx` compile with typed
      props, callbacks, and DOM events and retain the existing SSR
      props-as-channel, search, optimistic rollback, and native-form behavior.
- [ ] `src/pages/api/chores/index.ts` accepts the same JSON and form inputs as
      the JavaScript route. Missing titles, invalid RRULEs, successful form
      creates, and form-side internal errors retain their current redirects;
      JSON requests retain their status and body behavior.
- [ ] `src/pages/api/chores/[id].ts` retains current 401, 400, 403, 404, update,
      and delete behavior. Completing a recurring Chore marks the current row
      done, clears its recurrence, keeps its due date, writes a Completion Log,
      and spawns one new open row with the next due date.
- [ ] The canonical TypeScript unit, integration, and Playwright tests protect
      current auth, mock-user, Chore CRUD, content-negotiation, recurrence, and
      successor-spawn behavior. The obsolete row-recycling assertions stop
      existing; no protected test is deleted because it does not compile.
- [ ] `deno.json` keeps Deno's Solid automatic JSX runtime, removes `checkJs`,
      and makes `deno task ci` run a non-interactive `astro check` backed by
      versioned `@astrojs/check` and `typescript` imports. `tsconfig.json`
      remains the strict Astro-check configuration with Solid as its JSX import
      source.
- [ ] `scripts/setup_db.js` still seeds through the canonical database module
      after its import changes to `db.ts`; its DDL and JavaScript file remain
      for child 02.
- [ ] ADR 0002 and current architecture, technology, roadmap, and testing docs
      describe the implemented TypeScript baseline and canonical paths. They do
      not claim that dead twins or `checkJs` still exist.

## Verification Plan

- Automated: `deno task ci`. It must run lint, format check, Deno type check,
  Astro frontmatter check, and all canonical Deno tests.
- Automated: `deno task build` to verify Astro SSR and Solid island production
  compilation.
- Automated: `deno task test:e2e` to verify create, list, complete, recurring
  successor spawn, browser toggle, and cleanup through the real dev server.
- Automated:
  `test -z "$(find src tests -type f \\( -name '*.js' -o -name
  '*.jsx' \\) -print -quit)" && test ! -e playwright.config.js`.
- Automated: parse `deno.json` and verify `compilerOptions.checkJs` is absent
  and the `ci` task invokes `astro check` non-interactively.
- Expected: Google session signing and verification, the mock-user bypass,
  middleware redirect rules, owner-scoped API responses, JSON and native-form
  Chore creation, optimistic rollback, client-side Fuse search, recurrence
  calculation, Completion Log creation, and one-row-per-occurrence spawning
  remain protected.
- Expected to stop existing: JavaScript application/test files, duplicate
  Playwright config, per-file Solid JSX pragmas, dead twin behavior, JSDoc-only
  application types, and `checkJs`.

## Edge Cases & Considerations

- The repository currently has unrelated, uncommitted documentation and
  `.env.example` changes. Baseline `deno task ci` reports formatting failures in
  those files. Do not overwrite or re-scope those changes; verify this child
  after the owning work formats or lands them.
- Preserve behavior. This child must not change recurrence semantics, ownership
  rules, authentication, schema, or API compatibility. Schema migrations and
  transactional completion belong to later children.
- Reconcile each twin before deletion. In particular, do not adopt the dead
  `[id].ts`, `chores.test.ts`, or `core-journey.spec.ts` recurrence assertions;
  they conflict with ADR 0005 and the running route.
- Keep `astro.config.js`, `uno.config.js`, and `scripts/setup_db.js` as
  JavaScript. They are configuration or an excluded seed script, not application
  source. Convert only the duplicate Playwright config because a canonical
  TypeScript twin already exists.
- Static types do not validate untrusted JSON, form entries, JWT claims, or
  SQLite rows at runtime. Preserve current checks and error modes; keep any
  necessary row assertion narrow and next to the prepared statement.
- SQLite can return numeric booleans, and recurrence can be null, stored JSON,
  or malformed historical text. Type these states instead of normalizing data as
  an accidental refactor.
- Deno and Astro use separate configuration consumers. Compatible JSX settings
  do not require identical emit modes: Deno can use `react-jsx`, while Astro
  checking can preserve JSX. Both must use Solid as the import source.

# ADR 0002: TypeScript instead of JavaScript with JSDoc types

- **Status:** Accepted and implemented
- **Date:** 2026-08-10
- **Reverses:** the earlier position, recorded below, that all application
  source stays in `.js` and `.jsx` with types in JSDoc comments.

## Context

The project has always wanted static types. The first approach avoided a build
step for source files: author plain JavaScript, write types in JSDoc comments,
and let Deno check them with the `checkJs` compiler option. Deno runs `.ts`
directly, so "no build step" was never the real constraint it appeared to be —
the Astro build already produces `dist/` for production, and the development
server transforms files on the fly.

Three things made the JSDoc approach cost more than it saved:

1. **JSDoc is verbose for the same type.** Generic types, function overloads,
   and imported types (`@typedef {import('...').Type}`) need more text and give
   less. Casts need the `/** @type {X} */ (value)` form.
2. **Database rows have no types.** `node:sqlite` returns untyped records, so
   the chore row was effectively `any` everywhere it travelled — through the
   Astro page, both application programming interface (API) routes, and the
   props of every island. The type checker gave no help on column names or value
   types. This was the largest single gap, and it is the one the shared row and
   boundary types close. See
   [ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md).
3. **The repository never fully committed to it.** TypeScript copies of several
   files were tracked alongside their JavaScript versions, and the two had
   diverged. The codebase was already partly TypeScript, in the worst way:
   duplicated rather than converted.

## Decision

Author all application source in TypeScript: `.ts` for modules and API routes,
`.tsx` for SolidJS components. Convert the existing JavaScript files rather than
keeping both forms.

- Keep `jsx: "react-jsx"` and `jsxImportSource: "solid-js"` in `deno.json`. The
  per-file `/** @jsxImportSource solid-js */` pragma is no longer needed because
  the compiler option covers `.tsx`.
- Remove `checkJs` after the source conversion.
- Define the shared domain types — the chore row, the completion log row, the
  parsed recurrence, and the session user payload — in `src/types.ts`, and use
  them at database, API, Astro, and island boundaries.
- Type the `Astro.locals.user` slot in `src/env.d.ts` so the page and middleware
  stop casting.
- Keep `deno check` in the `ci` task and add `astro check` so `.astro`
  frontmatter is checked by the normal local gate.

A `tsconfig.json` already existed and extends `astro/tsconfigs/strict`. It is an
Astro scaffold artifact from the same commit as `deno.json`. Deno's CLI and
language server use `deno.json`; the Astro language server and `astro check`
read `tsconfig.json`. The two files deliberately have different JSX emit modes:
Deno uses `react-jsx`, while Astro checking preserves JSX. Both select Solid as
the JSX import source.

## Consequences

**Good**

- One way to express a type, and the concise one. Generics and unions stop being
  a chore to write.
- Shared row and boundary types replace the implicit `any` that flowed from
  SQLite through the API routes into island props. A renamed or dropped column
  becomes a type error instead of `undefined` at runtime.
- The duplicate `.ts` / `.js` file pairs resolved by conversion instead of by
  deletion of one side.
- Editor support is uniform across editors.
- `deno task ci` now checks TypeScript modules, TSX islands, Astro frontmatter,
  formatting, lint, and tests.

**Bad or limiting**

- What is on disk is no longer exactly what runs. Stack traces and debugging go
  through a transform. Deno maps this well, but it is a real change.
- `.astro` frontmatter is a separate type-checking path from `deno check`; the
  CI task must keep invoking `astro check`.
- Third-party types must exist or be written. `node:sqlite` is typed by Deno,
  but the row shapes it returns are still the project's responsibility to
  declare and to keep true.

## Migration outcome

The conversion preserved the JavaScript behavior and reconciled the dead twins
that had drifted:

- `src/pages/api/chores/index.ts` keeps the form and JSON create paths in one
  route. Forms redirect on success and validation errors; JSON callers receive
  JSON status responses.
- `src/pages/api/chores/[id].ts` keeps the ADR 0005 recurrence behavior:
  completing a recurring chore marks the current row done, clears its
  recurrence, writes a completion log, and spawns a new open row for the next
  occurrence. The obsolete row-recycling branch from the dead TypeScript twin
  was not kept.
- `src/utils/scheduleUtils.ts` keeps strict next-occurrence calculation and logs
  invalid RRULE input before returning `null`.
- `src/pages/api/chores/chores.test.ts`, `src/utils/scheduleUtils.test.ts`, and
  the Playwright specs now test the TypeScript implementation and the preserved
  behavior.
- `playwright.config.ts` is the only Playwright config.

## Superseded position

For the record, the reversed decision was: author all source in `.js` and
`.jsx`, express types in JSDoc, and keep `.ts` only for `src/env.d.ts`. Its
stated benefits were that source files run without transpilation, that the type
check is a separate gate which does not stop the development server, and that
the dependency list stays smaller. The first two still hold; they were judged
worth less than typed database rows and concise type syntax.

# ADR 0002: TypeScript instead of JavaScript with JSDoc types

- **Status:** Accepted, not yet implemented
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
   the chore row is effectively `any` everywhere it travels — through the Astro
   page, both application programming interface (API) routes, and the props of
   every island. The type checker gives no help on column names or value types.
   This is the largest single gap, and it is the one a shared `Chore` interface
   closes. See
   [ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md).
3. **The repository never fully committed to it.** TypeScript copies of several
   files are still tracked alongside their JavaScript versions, and the two have
   diverged. The codebase is already partly TypeScript, in the worst way:
   duplicated rather than converted.

## Decision

Author all application source in TypeScript: `.ts` for modules and API routes,
`.tsx` for SolidJS components. Convert the existing JavaScript files rather than
keeping both forms.

- Keep `jsx: "react-jsx"` and `jsxImportSource: "solid-js"` in `deno.json`. The
  per-file `/** @jsxImportSource solid-js */` pragma is no longer needed once
  the compiler option covers `.tsx`.
- Remove `checkJs` when no `.js` source remains. Until then it stays on, so the
  conversion can proceed file by file without a flag day.
- Define the shared domain types — the chore row, the completion log row, and
  the session user payload — in one place, and use them at every boundary that
  reads a database row.
- Type the `Astro.locals.user` slot in `src/env.d.ts` so the page and middleware
  stop casting.
- `deno check` stays in the `ci` task and keeps the same meaning.

A `tsconfig.json` already exists and extends `astro/tsconfigs/strict`. It is an
Astro scaffold artifact from the same commit as `deno.json`, and nothing in the
current toolchain reads it: Deno's CLI and language server use `deno.json`, and
no Astro language tooling is installed. Keep it anyway. The Astro language
server and `astro check` are the only tools that type-check `.astro`
frontmatter, and they read only `tsconfig.json`. The conversion must wire up
that tooling and reconcile the two files — `tsconfig.json` sets
`jsx: "preserve"`, `deno.json` sets `jsx: "react-jsx"` — instead of assuming the
strict settings are already enforced or deleting the file as unused.

## Consequences

**Good**

- One way to express a type, and the concise one. Generics and unions stop being
  a chore to write.
- A single `Chore` type replaces the implicit `any` that flows from SQLite
  through the API routes into island props. A renamed or dropped column becomes
  a type error instead of `undefined` at runtime.
- The duplicate `.ts` / `.js` file pairs resolve by conversion instead of by
  deletion of one side.
- Editor support is uniform across editors.

**Bad or limiting**

- What is on disk is no longer exactly what runs. Stack traces and debugging go
  through a transform. Deno maps this well, but it is a real change.
- The conversion touches nearly every source file. During the conversion the
  repository holds both languages, and `checkJs` must stay on.
- `.astro` frontmatter is a separate type-checking path from `deno check`; the
  Astro page needs its own attention, not just a file rename.
- Third-party types must exist or be written. `node:sqlite` is typed by Deno,
  but the row shapes it returns are still the project's responsibility to
  declare and to keep true.

## Migration

The code is JavaScript with JSDoc today. This ADR records the target, not the
current state. The conversion is a planned change, not yet started. Until it
lands, the patterns in `systemPatterns.md` describe JavaScript source, and both
of the following remain true:

- The duplicate TypeScript files listed below are dead code, not the start of
  the conversion. They must be deleted or reconciled deliberately, because their
  content has diverged from the `.js` files that actually run.
- `checkJs` stays on, so mixed source keeps type checking during the transition.

### Duplicate files to resolve first

Astro resolves the `.js` route files, so these `.ts` copies never execute, but
`deno check` and `deno test` still process them and can fail the `ci` task for
code that does not run:

- `src/pages/api/chores/index.ts` and `src/pages/api/chores/[id].ts`
- `src/utils/scheduleUtils.ts`
- `src/pages/api/chores/chores.test.ts` and `src/utils/scheduleUtils.test.ts`
- `tests/e2e/core-journey.spec.ts`

Whichever version is correct must be chosen per file before the wider conversion
begins. Converting on top of an unresolved pair silently picks a winner.

## Superseded position

For the record, the reversed decision was: author all source in `.js` and
`.jsx`, express types in JSDoc, and keep `.ts` only for `src/env.d.ts`. Its
stated benefits were that source files run without transpilation, that the type
check is a separate gate which does not stop the development server, and that
the dependency list stays smaller. The first two still hold; they were judged
worth less than typed database rows and concise type syntax.

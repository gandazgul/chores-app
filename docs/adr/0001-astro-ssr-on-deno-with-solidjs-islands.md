# ADR 0001: Astro server-side rendering on Deno with SolidJS islands

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

The Chores App shows a list of chores that belongs to one signed-in user. Most
of the page is static markup. Only a small part of the page needs client-side
interaction: the search box, the done/not-done toggle, and the add-chore modal.

The application must run as a single container in Kubernetes. It reads a local
SQLite file, so the server process and the data file must stay on the same
machine. A static-only or edge-only deployment is not possible.

The team wanted one runtime for the server, the tests, the linter, the
formatter, and the type checker, to keep the tool count low.

## Decision

Build the application as an Astro application in server output mode
(`output: "server"`), and deploy it with the Deno adapter
(`@deno/astro-adapter`).

- Astro renders each page on the server. The page reads data directly from the
  database module. There is no separate data-fetching layer between the page and
  SQLite.
- Interactive parts are SolidJS components ("islands") that Astro mounts with
  the `client:load` directive. The rest of the page ships zero JavaScript.
- The server writes the API under the same Astro application, as route files in
  `src/pages/api/`. There is no separate API service.
- Deno is the runtime and the toolchain. `deno.json` holds the imports, the
  tasks, the formatter configuration, and the compiler options.
- UnoCSS supplies the styles as atomic classes at build time.

The `node:sqlite` module is marked external for both the Vite build and the SSR
bundle, because it is a Deno built-in and must not be bundled.

## Consequences

**Good**

- The page loads with the chore list already rendered. No loading state is
  necessary for the first view.
- Only three components ship JavaScript to the browser. The client bundle stays
  small.
- One process serves the pages, the API, and the static assets. The container is
  simple.
- One tool (`deno`) runs the tests, the lint, the format check, and the type
  check. The `ci` task chains them.

**Bad or limiting**

- The server holds state in the SQLite file on local disk. The application
  cannot scale to more than one replica without a change to the persistence
  decision. See
  [ADR 0003](0003-sqlite-through-node-sqlite-without-a-query-builder.md).
- Each island is an independent state boundary. Two islands cannot share
  reactive state directly. `ChoreModal` and `ChoreList` are separate islands, so
  a new chore is not visible in the list until the page reloads.
- Astro's Vite CJS evaluator needs a polyfill in `astro.config.js`
  (`globalThis.exports`, `globalThis.module`) to start under Deno. This is a
  workaround for a runtime mismatch and can break on an Astro or adapter
  upgrade.
- Astro's default origin check is on for unsafe form submissions. The app also
  checks every `POST`, `PUT`, `PATCH`, and `DELETE` in `src/middleware.ts` and
  requires the `Origin` header to match the request URL origin exactly. This
  covers JSON mutations that Astro's form check does not inspect. Direct test
  clients must send the same origin explicitly.

# Tech Context

This document records the tools, versions, configuration, and constraints that
the repository uses today. The reasons behind the durable choices are in the
architectural decision records in [`adr/`](adr/).

## Technologies Used

| Concern            | Choice                             | Notes                                                                                                                           |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Deno                               | No Node.js, no `package.json`, no `node_modules` checked in                                                                     |
| Web framework      | Astro 6, server output             | `output: "server"` with the Deno adapter                                                                                        |
| Interactive UI     | SolidJS 1                          | Islands only, mounted with `client:load`                                                                                        |
| Styling            | UnoCSS 66                          | `presetWind3`, `presetAttributify`, `presetIcons` — see [Styling](#styling)                                                     |
| Database           | SQLite through `node:sqlite`       | `DatabaseSync`, hand-written SQL, no query builder — [ADR 0003](adr/0003-sqlite-through-node-sqlite-without-a-query-builder.md) |
| Authentication     | Google Sign-In, then a session JWT | Verified with `jose` — [ADR 0004](adr/0004-google-sign-in-with-a-self-issued-session-jwt.md)                                    |
| Recurrence         | `rrule`                            | RFC 5545 recurrence rules                                                                                                       |
| Search             | `fuse.js`                          | Client side, in the browser only                                                                                                |
| End-to-end testing | Playwright                         | Chromium only                                                                                                                   |

## Language

Application source is authored in TypeScript: `.ts` for middleware, utilities,
and API routes, and `.tsx` for SolidJS islands. Shared row, recurrence, API, and
session boundary types live in `src/types.ts`. Deno type checks TypeScript and
TSX from `deno.json`; Astro frontmatter is checked through `astro check` and
`tsconfig.json`. `checkJs` is no longer enabled.

## Development Setup

Deno resolves every dependency from the `imports` map in `deno.json` against
`deno.lock`. There is no install step for application code.

| Task               | Command              | What it does                                                |
| ------------------ | -------------------- | ----------------------------------------------------------- |
| Development server | `deno task dev`      | Astro dev server on port 8080                               |
| Seed the database  | `deno task db:setup` | Creates the tables and seeds a mock user and sample chores  |
| Build              | `deno task build`    | Writes `dist/server/entry.mjs` and the client assets        |
| Run the build      | `deno task start`    | Serves `dist/server/entry.mjs`                              |
| Unit tests         | `deno task test`     | `deno test -A`                                              |
| Full local gate    | `deno task ci`       | Lint, format check, Deno check, Astro check, and Deno tests |
| End-to-end tests   | `deno task test:e2e` | Playwright; starts `deno task dev` itself                   |

`deno task ci` is the gate to run before pushing. Nothing in continuous
integration runs it — see [Continuous integration](#continuous-integration).

## Configuration

### `deno.json`

- `imports` — the dependency map. It replaces `package.json` entirely.
- `compilerOptions` — `jsx: "react-jsx"` and `jsxImportSource: "solid-js"`.
- `exclude` — `.astro`, `dist`, `.idea`, `scripts`, and several `old_*` paths
  are outside lint, format, and type check. Note that `scripts` is excluded, so
  `scripts/setup_db.js` is never type checked.
- `allowScripts` — `esbuild` and `fsevents` may run install scripts; `sharp` is
  denied, which is why the Astro image service is set to
  `passthroughImageService`.

### `astro.config.js`

- Server output on port 8080, host `0.0.0.0`, through `@deno/astro-adapter`. The
  port is set twice, once for the development server and once for the adapter.
- UnoCSS is registered as an Astro integration with `injectReset: true`.
- Astro's default `security.checkOrigin` setting is used. Unsafe native-form
  requests get Astro's origin check, and `src/middleware.ts` adds an exact
  same-origin check for all unsafe methods and all content types.
- `node:sqlite` is marked external for both the Rollup build and server-side
  rendering, so the bundler leaves the built-in module alone.
- A `globalThis.module` / `globalThis.exports` polyfill sits at the top of the
  file, above the imports, for Astro's Vite CommonJS evaluator under Deno. It
  must stay first.

### `tsconfig.json`

Extends `astro/tsconfigs/strict`, includes `.astro/types.d.ts` and everything
else, and sets `jsx: "preserve"` with `jsxImportSource: "solid-js"`. Deno's CLI
and language server use the `compilerOptions` in `deno.json`. The Astro language
server and `astro check` type-check `.astro` frontmatter through this file, and
`astro check` runs in `deno task ci`. `deno.json` says `jsx: "react-jsx"`; this
file says `jsx: "preserve"`. That difference is intentional because Deno and
Astro have different JSX consumers, but both use `jsxImportSource: "solid-js"`.

## Styling

UnoCSS is configured in `uno.config.js` with three presets:

- `presetWind3` — the Tailwind-like utility classes.
- `presetAttributify` — the same utilities usable as HTML attributes.
- `presetIcons` — the `mdi` collection, imported from
  `@iconify-json/mdi/icons.json` as a JSON module rather than resolved at run
  time.

The theme defines the palette used across the app:

| Token          | Value     | Use                     |
| -------------- | --------- | ----------------------- |
| `primary`      | `#005f6a` | Deep teal, brand colour |
| `accent`       | `#ffbf00` | Amber, highlights       |
| `primary-bg`   | `#ffffff` | Page background         |
| `primary-text` | `#1f2937` | Body text               |
| `muted-text`   | `#6b7280` | Secondary text          |

`public/manifest.json` repeats `#005f6a` as `theme_color` and `#ffffff` as
`background_color`. The two files must be changed together; nothing links them.

The design intent is mobile first and responsive.

### Environment variables

Read from `.env` in development through the `--env` flag on every task.

| Variable           | Read by                                      | Effect                                                                   |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| `ENABLE_AUTH`      | `src/middleware.ts`                          | The exact string `false` injects a mock user and skips verification      |
| `COOKIE_SECURE`    | `src/pages/api/auth/login.ts`                | The exact string `false` drops the `Secure` flag from the session cookie |
| `SESSION_SECRET`   | `src/utils/auth.ts`                          | HS256 signing key for the session JWT                                    |
| `GOOGLE_CLIENT_ID` | `src/utils/auth.ts`, `src/pages/login.astro` | Audience for credential verification, and the Sign-In button             |
| `DB_ENV`           | `src/utils/db.ts`                            | Selects the database file: `test`, `production`, or anything else        |

Both boolean flags compare against the exact string `false`, so a missing or
misspelled value selects the safe behavior.

`.env.example` also lists `GOOGLE_CLIENT_SECRET` and `PUBLIC_URL`. **No code
reads either one.** The Google Identity Services flow used here verifies an
identity token in the browser and never performs a server-side code exchange, so
the client secret is not needed. Remove both from the example file or start
using them.

## Database

- **Driver:** `node:sqlite` `DatabaseSync`, a Deno built-in. No third-party
  driver and no query builder. Queries are hand-written SQL through
  `db.prepare(...)` with bound parameters.
- **Connection:** one shared handle, created at module load in `src/utils/db.ts`
  and exported as the default. Every server module imports it.
- **Foreign keys:** enabled with `PRAGMA foreign_keys = ON` immediately after
  opening.
- **File:** chosen by `DB_ENV` — `./chores.test.db`, `./chores.db`, or
  `./chores.dev.db` for development and any unset value.
- **Migrations:** `src/utils/db.ts` applies the forward-only migration registry
  at import. The current ledger version is 6.

### Tables

- `users` — `id`, `email` (unique), profile fields, and an optional
  `gotify_token`.
- `chores` — assignment, recurrence, status, Due Date, `remind_until_done`, and
  `nag_eligible_since` fields.
- `completion_logs` — one completion record per completed Chore.
- `notification_deliveries` — durable Push Notification Delivery Slots keyed by
  Chore, recipient, kind, and policy slot.

## Authentication

- **Provider:** Google Sign-In through Google Identity Services.
- **Method:** the Google credential is verified once at login; the server then
  issues its own HS256 session JWT and sets it as an `httpOnly`, `sameSite=lax`
  cookie for 30 days. Astro middleware resolves it on every request.
- **Development bypass:** `ENABLE_AUTH=false` injects a fixed mock user into
  `Astro.locals` and skips all session verification. It does not skip the
  same-origin boundary for `POST`, `PUT`, `PATCH`, or `DELETE`.
- **Mutation boundary:** browser mutations are same-origin only. The server
  requires `Origin` to equal the request URL origin exactly, including scheme,
  host, and port. `GET`, `HEAD`, and `OPTIONS` do not need this header. Direct
  API test clients must send the Playwright `baseURL` origin on valid mutation
  requests.
- **Known gap:** no code path inserts a row into `users`. Because
  `chores.user_id` has a foreign key to `users(id)` and foreign keys are on, a
  real Google account that is not the seeded mock user cannot create a chore.
  Detail in
  [ADR 0004](adr/0004-google-sign-in-with-a-self-issued-session-jwt.md).

## Testing

- **Unit and integration:** the Deno test runner. `src/utils/auth.test.ts`,
  `src/utils/scheduleUtils.test.ts`, `src/pages/api/chores/chores.test.ts`.
- **End to end:** Playwright, configured in `playwright.config.ts`. Chromium
  only, base URL `http://127.0.0.1:8080`, and its `webServer` runs
  `deno task db:setup` before starting `deno task dev` with `ENABLE_AUTH=false`.
  In continuous integration it retries twice and runs a single worker. Specs
  live in `tests/e2e/`.
- There are no JavaScript test twins or duplicate Playwright configs left after
  the TypeScript conversion in
  [ADR 0002](adr/0002-typescript-instead-of-javascript-with-jsdoc.md).

## Deployment

- **Image:** `Containerfile`, a two-stage build on `denoland/deno:latest`. The
  builder caches dependencies from `deno.json` and `deno.lock`, then runs
  `deno task build`. The final stage copies `dist/`, `src/`, the production
  startup wrapper, `deno.json`, and `deno.lock`, runs as the non-root `deno`
  user, exposes 8080, and starts `deno task start`.
- **Target:** Kubernetes.
- **Scheduler:** production starts one in-process scheduler after migrations and
  before the built Astro server import. Development uses the same scheduler
  through an Astro integration. Set `ENABLE_NOTIFICATIONS=false` to stop the
  scheduler, Delivery Slot creation, and sends. Quiet Hours default to 21:00 to
  08:00 household-local time.
- **Persistence caveat:** the SQLite file is written to the working directory
  inside the container. It needs a mounted volume to survive a restart, stores
  pending Delivery Slots, and confines the application to one process and one
  SQLite writer. External Push Notification delivery is at least once.
- **Origin caveat:** a reverse proxy must preserve the public scheme, host, and
  port when it builds the request URL for Astro. If the browser sends
  `Origin: https://...` but Astro sees `http://...`, unsafe requests fail with
  HTTP 403.

## Continuous integration

`.github/workflows/docker-publish.yml` is the only workflow. On a push to `main`
or a `v*.*.*` tag it builds `Containerfile` and pushes the image to
`ghcr.io/gandazgul/chores-app`.

**It does not run `deno task ci`.** Lint, format, type check, and tests are not
enforced anywhere automatically, and neither are the end-to-end tests. An image
can be built and published from a commit that does not type check.

## Project origin

The current stack replaced an Express server with React components, built with
Vite and served by `vite-express`. The old source is still in the repository
under `old_app/` — `old_server.js`, `old_components/`, `fuzzySearchUtils.js`,
`scheduleUtils.js`, `utils.js`, and a `playwright/` directory. It does not run,
it is excluded from lint, format, and type check in `deno.json`, and it should
be deleted.

Two things carried over from that app and still shape the code:

- Recurrence used `dayspan`. It was replaced by `rrule` during the migration —
  see [ADR 0005](adr/0005-recurring-chores-spawn-a-new-row-on-completion.md).
- Fuzzy search lived in `fuzzySearchUtils.js`. In the current app the Fuse.js
  instance is built inline in `ChoreList.tsx`; no such utility module exists.

## Project Hosting

- **Platform:** GitHub
- **Repository:** https://github.com/gandazgul/chores-app.git
- **Registry:** GitHub Container Registry, `ghcr.io`

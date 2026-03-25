# Chores App Re-architecture Plan

This project is a web application built using AstroJS, UnoCSS, and Deno,
migrating from an Express backend with React components.

## Overall Architecture Decisions

1. **Rendering**: Astro native approach (mostly server-rendered). New chore page
   uses a modal that submits via POST and redirects back to the home page.
   Search and chore toggling (marking as done) will use SolidJS islands for
   interactivity and client-side fetching.
2. **API**: Astro API routes (`src/pages/api/*`).
3. **Styling**: Astro UnoCSS integration. We'll use `preset-wind3`
   (Tailwind-like), `preset-attributify`, and `preset-icons` for UI icons.
4. **Auth**: Google Sign-in implemented early. A fake user will be used for
   testing, controlled by `ENABLE_AUTH=false` (true by default).
5. **Database**: Deno-native SQLite (e.g. `sqlite3` driver built into or
   compatible with Deno), but sticking with Knex.js for migrations and query
   building.
6. **Recurrence**: Migrate from `dayspan` to `rrule` for simpler and more
   standard recurrence rule processing. We'll start simple with Daily/Weekly and
   expand from there.
7. **Gotify Notifications**: Design the database schema and architecture to
   support Gotify notifications, but implement the actual pushing in a later
   phase.
8. **Testing**: Deno's native test runner (`deno test`) for unit/integration
   tests, and Playwright for UI/UX testing.
9. **Project Management**: Use `deno` as the task runner and package manager.
   `package.json` will be converted to `deno.json`.
10. **Structure**: Keep the same directory, replacing configuration files
    in-place and migrating source code.

---

## Phase 1: Setup and Foundation (Deno + Astro)

**Goal**: Convert the project to a Deno-native Astro project with UnoCSS and
Knex.js.

- [x] Create `deno.json` to replace `package.json`, defining tasks (`dev`,
      `build`, `test`, `db:migrate`, `db:seed`, etc.) and imports.
- [x] Initialize Astro configuration (`astro.config.mjs`) with Deno adapter,
      SolidJS integration, and UnoCSS integration.
- [x] Configure `uno.config.ts` with `preset-wind3`, `preset-attributify`, and
      `preset-icons`.
- [x] Refactor `knexfile.js` and `src/utils/db.js` to work with Deno's SQLite
      driver and Knex.
- [x] Ensure database migrations (`data/migrations`) run successfully via
      `deno task db:migrate`.
- [x] Create a basic Astro layout (`src/layouts/Layout.astro`) that includes the
      PWA assets and basic UnoCSS styling.
- [x] Create a dummy home page (`src/pages/index.astro`) to verify the stack
      works.

**Phase 1 Verification Plan**:

- Run `deno task dev` and verify the home page loads with UnoCSS styles applied.
- Run `deno task db:migrate` and verify tables are created in a local SQLite
  file.

---

## Phase 2: Authentication

**Goal**: Implement Google Sign-in and the fake user fallback.

- [ ] Add Google API credentials to `.env`.
- [ ] Create an Astro middleware or a shared authentication utility to verify
      Google identity tokens.
- [ ] Implement a login page (`src/pages/login.astro`) with the Google Sign-In
      button.
- [ ] Implement the `MOCK_AUTH=true` bypass logic that injects a fake user
      session.
- [ ] Set up session cookies or JWTs to maintain the auth state across Astro
      page requests in SSR mode.
- [ ] Restrict `src/pages/index.astro` to logged-in users only.

**Phase 2 Verification Plan**:

- With `ENABLE_AUTH=false`, navigate to `/` and verify automatic login as the
  fake user.
- With `ENABLE_AUTH=true`, navigate to `/`, verify redirect to `/login`, sign in
  with a real Google account, and verify successful redirect back to `/`.

---

## Phase 3: Core API and Data Fetching

**Goal**: Port the Express API to Astro API routes and update the database
querying to handle `rrule` based recurrence strings instead of `dayspan`.

- [ ] Re-write `src/utils/scheduleUtils.js` to use `rrule` instead of `dayspan`.
- [ ] Create Astro API routes:
  - `src/pages/api/chores/index.ts` (GET all chores, POST new chore)
  - `src/pages/api/chores/[id].ts` (PUT update, DELETE)
- [ ] Ensure the DB schema handles the Gotify notification requirement (the
      `remind_until_done` boolean already exists).

**Phase 3 Verification Plan**:

- Use `curl` or Postman or write integration tests via `deno test` to hit the
  Astro API endpoints and verify CRUD operations work.

---

## Phase 4: UI/UX Implementation (SolidJS Islands)

**Goal**: Rebuild the UI using Astro pages and SolidJS components.

- [ ] Rebuild the Chore List on `src/pages/index.astro` as a server-rendered
      list by default.
- [ ] Implement a `<ChoreSearch client:load />` SolidJS component for
      client-side fuzzy searching (using `fuse.js`).
- [ ] Implement a `<ChoreItem client:visible />` SolidJS component to allow
      marking a chore as done interactively via `fetch`.
- [ ] Build the Add/Edit Chore Modal logic: It will be a form in a modal that
      visually appears as a modal but submits an HTML `<form method="POST">` to
      an Astro endpoint, which processes the POST and redirects back to `/`.

**Phase 4 Verification Plan**:

- Run Playwright tests (`deno task test:playwright`) to verify chores can be
  listed, added, edited, and toggled as done.
- Manually test the fuzzy search to ensure client-side filtering responds
  instantly.

---

## Phase 5: Final Polish and PWA

**Goal**: Ensure the app meets PWA requirements, styles are polished with
UnoCSS, and everything is tested.

- [ ] Add `manifest.json` and optionally a Service Worker if offline support is
      desired (or just basic PWA prompts).
- [ ] Refine the UnoCSS styling to look modern and adhere to the project brief.
- [ ] Validate Playwright E2E tests and Deno unit tests passing.
- [ ] Document deployment commands (Docker / K8s preparations).

**Phase 5 Verification Plan**:

- Run Lighthouse in Chrome DevTools to verify PWA installability.
- Run all test suites (`deno test` and Playwright).

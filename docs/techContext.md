# Tech Context

## Technologies Used

- AstroJS (Web Framework)
- SolidJS (Reactive UI)
- Deno (Runtime)
- UnoCSS (CSS framework)
- Knex.js (SQL query builder)
- SQLite3 (local database)
- Google Sign-In (Authentication implemented via Astro middleware and jose JWT)

## Development Setup

- **Seed the database:** `deno task db:setup`
- **Run tests (Unit/Integration):** `deno test -A`
- **Run E2E tests (Playwright):** `deno task test:e2e`
- **Type Checking (JS/JSX with JSDoc):** `deno check --check-js`

## Technical Constraints

- **Language:** Code is authored in standard JS/JSX (no TypeScript). Type checking is strictly enforced using Deno's native `--check-js` flag, backed by comprehensive JSDoc annotations.
- **E2E Testing:** Playwright is used for full-system E2E testing against the running Deno server, avoiding legacy Node.js/Jest dependencies.

## Dependencies

### Core Dependencies

- `astro`: ^6.0.8 (Web Framework)
- `solid-js`: ^1.9.12 (Reactive UI components)
- `unocss`: ^66.6.6 (Atomic CSS engine)
- `fuse.js`: ^7.1.0 (Fuzzy search library for client-side filtering)
- `rrule`: ^2.8.1 (Recurrence rule parsing and scheduling)
- `jose`: ^6.2.2 (JWT signing and verification)

### Development & Testing Dependencies

- `@playwright/test`: ^1.59.0 (E2E Testing framework)
- `@std/assert`: ^1.0.19 (Deno standard library assertions)

## Tool Usage Patterns

_(To be defined)_

## Project Hosting

- **Platform:** GitHub
- **Repository URL:** https://github.com/gandazgul/chores-app.git
- **Key Features:** Version control, issue tracking, collaboration, CI/CD
  (GitHub Actions configured for Docker publishing).

## Authentication

- **Provider:** Google Sign-In
- **Method:** Google Auth and JWT cookies
- **Implementation:**
  - An Astro middleware intercepts requests. It enforces authentication via a
    secure, HTTP-only cookie containing a signed JWT (using the `jose` library).
  - Missing or `true` `ENABLE_AUTH` defaults to enforcing authentication.
    Missing or `true` `COOKIE_SECURE` defaults to secure cookies.
  - A mock user can be used by setting `ENABLE_AUTH=false` in the `.env` file,
    which injects a dummy user payload into `Astro.locals`.

## Database

- **Query Builder:** Knex.js
- **Driver:** SQLite3
- **Configuration:** `knexfile.js`
- **Migrations:** Located in the `data/migrations` directory. The initial
  migration creates `users` and `chores` tables.
- **Schema:**
  - `users`: Stores user information (`id`, `email`).
  - `chores`: Stores chore details, linked to a user. Includes fields for title,
    description, priority, due date, and recurrence.

This document covers the technical landscape of the project, including tools,
technologies, and constraints.

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

- **Seed the database:** `yarn db:seed`
- **Run tests:** `NODE_OPTIONS='--experimental-vm-modules' jest`

## Technical Constraints

_(To be defined)_

## Dependencies

### Core Dependencies

- `classnames`: ^2.5.1 (Utility for conditionally joining classNames together)
- `fuse.js`: ^7.1.0 (Fuzzy search library)
- `jose`: ^5.9.6 (JWT signing and verification)
- `uuid`: ^13.0.0 (UUID generation)

### Development Dependencies

- `mockdate`: ^3.0.5
- `supertest`: ^7.1.4

## Tool Usage Patterns

_(To be defined)_

## Project Hosting

- **Platform:** GitHub
- **Repository URL:** https://github.com/gandazgul/chores-app.git
- **Key Features:** Version control, issue tracking, collaboration, CI/CD (GitHub Actions configured for Docker publishing).

## Authentication

- **Provider:** Google Sign-In
- **Method:** Google Auth and JWT cookies
- **Implementation:**
  - An Astro middleware intercepts requests. It enforces authentication via a secure, HTTP-only cookie containing a signed JWT (using the `jose` library).
  - Missing or `true` `ENABLE_AUTH` defaults to enforcing authentication. Missing or `true` `COOKIE_SECURE` defaults to secure cookies.
  - A mock user can be used by setting `ENABLE_AUTH=false` in the `.env` file, which injects a dummy user payload into `Astro.locals`.

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

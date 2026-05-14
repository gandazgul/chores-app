# Chores App - Context Overview

A household chore management web application built with AstroJS, SolidJS, and Deno. The app helps users organize, track, and be reminded about household chores. Key differentiator: persistent reminders until chores are marked as done. The stack is AstroJS (SSR) with SolidJS Islands for interactivity, SQLite for local data persistence, Google Sign-In for auth, and UnoCSS for styling. The app is containerized for deployment to Kubernetes.

## Language & Tech Stack

- **Runtime:** Deno
- **Web Framework:** Astro v6 (SSR with client islands)
- **UI Library:** SolidJS v1 (Islands architecture — `client:load` directives)
- **Styling:** UnoCSS v66 (preset-wind3 / preset-attributify / preset-icons with MDI)
- **Database:** SQLite via `node:sqlite` (Deno native)
- **Auth:** Google Sign-In via `jose` JWT library, HTTP-only cookie sessions
- **Recurrence:** `rrule` library (standard iCalendar recurrence rules)
- **Fuzzy Search:** `fuse.js`
- **E2E Testing:** Playwright
- **Unit/Integration Testing:** Deno native test runner (`@std/assert`)
- **Container:** Docker (Containerfile → Kubernetes)
- **CI/CD:** GitHub Actions (docker-publish.yml)

### Key Concepts

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Island** | A SolidJS component rendered client-side via Astro's `client:load` directive, embedded in an otherwise server-rendered page | "Component", "hydrated component" |
| **Chore** | A task entry in the database with title, description, priority, due_date, recurrence (rrule), and done status | "Task", "item" |
| **RRULE** | An iCalendar recurrence rule string (e.g. `"FREQ=DAILY"`, `"FREQ=WEEKLY;BYDAY=MO,WE,FR"`) parsed by the `rrule` npm package | "recurrence rule", "schedule string" |
| **Session** | A JWT stored in an HTTP-only cookie, verified via `jose` to authenticate subsequent requests | "auth token", "cookie" |
| **Gotify** | A push notification server (planned integration, not yet implemented) — DB schema has `remind_until_done` and `notification_sent_at` columns reserved for it | "notification service" |
| **MOCK_USER** | A hardcoded test user injected by middleware when `ENABLE_AUTH=false` | "fake user", "dev user" |
| **COMPLETION LOG** | A record in the `completion_logs` table created each time a chore is marked done | "history entry" |

## Key Files

| File | Role |
|------|------|
| `src/pages/index.astro` | Main page — server-renders chore list, passes data to SolidJS islands |
| `src/pages/login.astro` | Login page — Google Sign-In button, credential POST to API |
| `src/layouts/Layout.astro` | Root layout — UnoCSS reset, favicons, PWA meta tags, header/footer |
| `src/middleware.js` | Astro middleware — session auth, route protection, mock user bypass |
| `src/pages/api/chores/index.js` | API: GET all chores, POST new chore |
| `src/pages/api/chores/[id].js` | API: PUT update/complete chore, DELETE chore |
| `src/pages/api/auth/login.js` | API: POST — verify Google token, create session cookie |
| `src/pages/api/auth/logout.js` | API: GET — delete session cookie, redirect to login |
| `src/utils/db.js` | SQLite connection, schema creation (users, chores, completion_logs) |
| `src/utils/auth.js` | `verifyGoogleToken`, `createSession`, `getSession` — JWT via jose |
| `src/utils/scheduleUtils.js` | `calculateNextOccurrence(rrule, lastCompletedDate)` — recurrence math |
| `src/components/ChoreList.jsx` | SolidJS Island — renders chore list, fuzzy search via fuse.js |
| `src/components/ChoreItem.jsx` | SolidJS Island — single chore row with toggle, optimistic UI |
| `src/components/ChoreModal.jsx` | SolidJS Island — modal for adding new chore (title, description, rrule) |
| `src/env.d.ts` | Type declarations for `Astro.locals.user` |
| `deno.json` | Project config — imports map, tasks (dev/build/test/ci/db:setup) |
| `astro.config.js` | Astro config — Deno adapter, UnoCSS, SolidJS, Vite overrides |
| `uno.config.js` | UnoCSS config — Windi preset, attributify, MDI icons, theme colors |
| `Containerfile` | Dockerfile — multi-stage build for Deno |
| `.github/workflows/docker-publish.yml` | CI — build and push image to GHCR on push/main |
| `playwright.config.ts` | E2E config — launches dev server, runs tests in Chromium |
| `scripts/setup_db.js` | DB seed script — creates tables and sample chores |
| `docs/` | Documentation (productContext.md, techContext.md, systemPatterns.md, etc.) |
| `tests/e2e/core-journey.spec.js` | E2E test — create chore via API, mark done, delete |
| `tests/e2e/recurrence.spec.js` | E2E test — DAILY/WEEKLY/MONTHLY toggle cycle |

## Patterns & Conventions

### Coding Style
- **Language:** JavaScript/JSX — no TypeScript files. Type checking is enforced via `deno check --check-js` with comprehensive JSDoc `@typedef`, `@param`, `@type` annotations.
- **Import style:** Relative paths with explicit `.js` extensions (Deno convention). e.g. `"../../../utils/auth.js"`
- **Type casting:** `(locals as any).user as UserPayload | null` pattern in .ts files; JSDoc `/** @type {UserPayload | null} */` in .js files.
- **Console logging:** `console.error()` for server-side errors; errors are also returned in API JSON responses.
- **Naming:** camelCase for variables/functions, PascalCase for components, SCREAMING_CASE for env vars.

### API Design
- All API routes are in `src/pages/api/`.
- Astro API routes export named `GET`, `POST`, `PUT`, `DELETE` handlers.
- Authentication: Every endpoint checks `locals.user` — returns 401 if null.
- Authorization: Write/delete endpoints verify `existingChore.user_id !== user.id` — returns 403.
- Responses: JSON with `{ "error": "message" }` on failure; status codes follow REST conventions (200, 201, 204, 400, 401, 403, 404, 500).
- Form submissions redirect on success/error; JSON API calls return Response objects.

### Authentication Flow
1. User clicks Google Sign-In on `/login` → JS sends credential to `POST /api/auth/login`.
2. Server verifies Google JWT via `jose` `jwtVerify()` with Google's JWKS endpoint.
3. Server creates a signed session JWT (HS256, 30-day expiry) and sets it as an HTTP-only, secure cookie.
4. Middleware (`src/middleware.js`) runs on every request: reads session cookie → verifies → populates `Astro.locals.user`.
5. If `ENABLE_AUTH=false` in `.env`, middleware injects a `MOCK_USER` instead, bypassing Google auth entirely.
6. Public routes (`/login`, `/api/auth/login`, `/api/auth/logout`) are exempt from auth redirects.

### Recurrence / Schedule System
- Chores can have a `recurrence` column storing `{"rrule": "FREQ=DAILY"}` as JSON.
- On chore creation, `calculateNextOccurrence(rrule)` computes the first due date.
- On chore completion (`done=true`), if recurrence exists, a **new** chore is spawned with the next due date and the current one is finalized (`recurrence=null`, `done=1`).
- A `completion_logs` row is created for each completion.
- Uses the `rrule` package (`rrulestr`) for parsing and computing next dates.

### State Management (Client)
- SolidJS `createSignal` for local state (search query, modal open/close, toggle loading).
- SolidJS `createMemo` for computed state (filtered chore list via Fuse.js).
- `client:load` Astro directive hydrates islands client-side.
- Props are passed from server-rendered Astro template → SolidJS island (e.g. `initialChores={chores}`).
- Optimistic UI: toggle state updates immediately, then reverts on API failure.

### Database Schema
```
users:        id (PK), email (unique), created_at, updated_at
chores:       id (PK), user_id (FK→users), title, description, priority,
             done, due_date, remind_until_done, notification_sent_at,
             recurrence (JSON), created_at, updated_at
completion_logs: id (PK), chore_id (FK→chores ON DELETE CASCADE), completed_at
```
- SQLite via Deno's native `node:sqlite` module.
- Schema created in `src/utils/db.js` and `scripts/setup_db.js`.
- `remind_until_done` and `notification_sent_at` columns reserved for future Gotify integration.

### Testing
- **Unit/Integration:** `deno test -A` — runs `.test.js` and `.test.ts` files across `src/` (auth.test.js, scheduleUtils.test.ts, chores.test.ts).
- **E2E:** `deno task test:e2e` — Playwright runs against the live dev server on port 8080.
- CI task runs: `deno lint && deno fmt --check && deno check && deno test -A`.

### Deployment
- Built via `deno task build` → output in `dist/`.
- Docker image built from `Containerfile` (multi-stage: builder + production).
- Production CMD: `deno run -A --env dist/server/entry.mjs`.
- CI/CD via GitHub Actions pushes to `ghcr.io` on every push to `main`.
- Designed for deployment to Kubernetes.

### Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `ENABLE_AUTH` | Set to `"false"` to bypass Google auth (mock user) | `"true"` (enforced) |
| `COOKIE_SECURE` | Set to `"false"` for local dev without HTTPS | `"true"` (enforced) |
| `SESSION_SECRET` | Secret key for signing session JWTs | **required** |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | **required** (for auth) |
| `DB_ENV` | `"test"`, `"production"`, or `"development"` | `"development"` |
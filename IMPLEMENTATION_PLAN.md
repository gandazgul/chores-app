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

### Task 2.1: Configure Environment Variables for Authentication

**Description**: Set up the necessary environment variables to support Google
OAuth and the mock authentication toggle. **Outcome**: The application
environment is configured to securely hold Google API credentials and manage the
authentication mode, enabling subsequent auth features to function.

- [x] Add `GOOGLE_CLIENT_ID` to `.env.example` and `.env` (with a placeholder in
      `.env.example`).
- [x] Add `ENABLE_AUTH` (default `true`) to `.env.example` and `.env`.
- [x] Add `SESSION_SECRET` (for JWT/cookie signing) to `.env.example` and
      `.env`.
- **Dependencies**: None.
- **Acceptance Criteria**:
  - `.env` and `.env.example` contain the required variables.
  - The application can read these variables using Deno's `Deno.env`.

### Task 2.2: Implement Authentication Utility and JWT/Cookie Management

**Description**: Create core utilities for verifying Google identity tokens,
generating session JWTs, and setting/reading secure HTTP-only cookies.
**Outcome**: The system can securely verify user identities from Google and
establish persistent, secure sessions across page requests.

- [x] Install a lightweight JWT library compatible with Deno/Astro (e.g.,
      `jose`).
- [x] Create `src/utils/auth.ts` containing functions:
  - `verifyGoogleToken(token: string)`: Verifies the Google ID token.
  - `createSession(userPayload)`: Generates a signed JWT.
  - `getSession(request)`: Parses and verifies the JWT from cookies.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Utility functions are unit tested.
  - Token verification correctly rejects invalid tokens.
  - Session creation sets secure, HTTP-only cookies.

### Task 2.3: Create Astro Authentication Middleware

**Description**: Implement Astro middleware to intercept incoming requests,
check for valid sessions, and handle redirects for protected routes.
**Outcome**: Routes are automatically protected. Unauthenticated users trying to
access protected pages are seamlessly redirected to the login page, while
authenticated users proceed normally.

- [x] Create `src/middleware.ts`.
- [x] Implement logic to read the session cookie using `context.cookies`.
- [x] Verify the session using the utility from Task 2.2.
- [x] If on a protected route (e.g., `/`) and not authenticated, redirect to
      `/login`.
- [x] Attach user information to `context.locals` for use in Astro pages and API
      routes.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Unauthenticated access to `/` redirects to `/login`.
  - Authenticated access to `/` succeeds and user data is available in
    `Astro.locals`.

### Task 2.4: Implement Mock Authentication Bypass

**Description**: Build a bypass mechanism for local development and testing that
injects a fake user session when `ENABLE_AUTH=false`. **Outcome**: Developers
can work on the application without needing active internet access or
configuring real Google credentials, streamlining the development process.

- [x] Update `src/middleware.ts` to check the `ENABLE_AUTH` environment
      variable.
- [x] If `ENABLE_AUTH === 'false'`, bypass the token verification.
- [x] Inject a predefined mock user payload (e.g.,
      `{ id: 'mock-user-1', email: 'test@example.com', name: 'Test User' }`)
      into `context.locals`.
- **Dependencies**: Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - When `ENABLE_AUTH=false`, navigating to `/` does not redirect to `/login`,
    even without a real session cookie.
  - `Astro.locals` contains the mock user data.

### Task 2.5: Build the Login Page with Google Sign-In

**Description**: Create the user-facing login interface integrating the Google
Identity Services script and rendering the sign-in button. **Outcome**: Users
have a functional interface to authenticate themselves via Google, providing
entry into the application.

- [x] Create `src/pages/login.astro`.
- [x] Add the Google Identity Services script
      (`<script src="https://accounts.google.com/gsi/client" async defer></script>`).
- [x] Implement the Google Sign-In button UI using UnoCSS for styling.
- [x] Create a client-side script to handle the Google credential response and
      POST it to a new API endpoint.
- **Dependencies**: Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - The login page renders correctly with the Google button.
  - Clicking the button initiates the Google auth flow.

### Task 2.6: Implement Authentication API Endpoint

**Description**: Create an Astro API endpoint to receive the Google credential,
verify it, create a session, and set the session cookie. **Outcome**: The
backend successfully processes the authentication request from the client,
establishes a secure session, and signals the client to redirect to the main
application.

- [x] Create `src/pages/api/auth/login.ts`.
- [x] Handle POST requests containing the Google ID token.
- [x] Use `verifyGoogleToken` (Task 2.2) to validate the token.
- [x] If valid, use `createSession` (Task 2.2) to set the HTTP-only cookie.
- [x] Return a success response so the client-side script (Task 2.5) can
      redirect to `/`.
- [x] Create `src/pages/api/auth/logout.ts` to clear the session cookie.
- **Dependencies**: Task 2.2, Task 2.5
- **Acceptance Criteria**:
  - POSTing a valid token results in a `Set-Cookie` header and a 200 OK
    response.
  - POSTing an invalid token results in a 401 Unauthorized response.
  - Accessing the logout endpoint clears the cookie.

**Phase 2 Verification Plan**:

- [x] Run unit tests for `src/utils/auth.ts`.
- [x] With `ENABLE_AUTH=false`, navigate to `/` and verify access is granted and
      the mock user is active.
- [x] With `ENABLE_AUTH=true`:
  - [x] Navigate to `/` and verify redirect to `/login`.
  - [x] Perform Google Sign-In on `/login`.
  - [x] Verify successful redirect to `/` after authentication.
  - [x] Verify session cookie is set correctly as HTTP-only.
  - [x] Test logout functionality and verify redirect back to `/login`.

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

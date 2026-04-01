# Chores App Re-architecture Plan

This project is a web application built using AstroJS, UnoCSS, and Deno,
migrating from an Express backend with React components.

## Overall Architecture Decisions

1. **Rendering**: Astro native approach (mostly server-rendered). New chore page
   uses a modal that submits via POST and redirects back to the home page.
   Search and chore toggling (marking as done) will use SolidJS islands for
   interactivity and client-side fetching.
2. **API**: Astro API routes (`src/pages/api/*`).
3. **Styling**: Astro UnoCSS integration. We are successfully using
   `preset-wind3` (Tailwind-like), `preset-attributify`, and `preset-icons` for
   UI icons.
4. **Auth**: Google Sign-in and session management are fully implemented. A mock
   authentication bypass (`ENABLE_AUTH=false`) is in place for local development
   and testing.
5. **Database**: Deno-native SQLite with Knex.js for migrations and query
   building is set up and working.
6. **Recurrence**: Migrate from `dayspan` to `rrule` for simpler and more
   standard recurrence rule processing. We'll start simple with Daily/Weekly and
   expand from there.
7. **Gotify Notifications**: Design the database schema and architecture to
   support Gotify notifications, but implement the actual pushing in a later
   phase.
8. **Testing**: Deno's native test runner (`deno test`) for unit/integration
   tests, and Playwright for UI/UX testing.
9. **Project Management**: Deno is configured as the task runner and package
   manager via `deno.json`.
10. **Structure**: Kept the same directory, replacing configuration files
    in-place and migrating source code.

---

## Completed Phases

**Phase 1: Setup and Foundation (Deno + Astro)**

- Converted the project to a Deno-native Astro project.
- Configured `deno.json` for tasks and imports.
- Initialized Astro with SolidJS and UnoCSS integrations.
- Refactored database configuration (`knexfile.js`, `src/utils/db.js`) for
  Deno's SQLite driver and successfully ran migrations.
- Created basic Astro layouts and a dummy home page to verify the stack.

**Phase 2: Authentication**

- Configured environment variables for Google OAuth and mock authentication.
- Implemented core authentication utilities for JWT/cookie management using
  `jose`.
- Created Astro middleware for route protection and user session management.
- Built a mock authentication bypass for seamless local development.
- Developed the login page with Google Sign-In integration.
- Implemented Astro API endpoints for login and logout functionality with secure
  HTTP-only cookies.
- Verified all authentication flows, including mock user bypass and Google
  Sign-In.

**Phase 3: Core API and Data Fetching**

- Replaced deprecated `dayspan` with standard `rrule` for recurrence scheduling.
- Implemented `scheduleUtils.ts` with comprehensive unit testing (`deno test`).
- Created `GET /api/chores` endpoint for fetching authenticated user's chores.
- Created `POST /api/chores` endpoint for creating chores with recurrence
  parsing.
- Created `PUT /api/chores/:id` endpoint for updating details and marking chores
  as done (advancing `next_due_date` and logging completion).
- Created `DELETE /api/chores/:id` endpoint for deleting chores.
- Secured all API endpoints with authentication middleware and resource
  ownership checks.
- Verified database schema compatibility for future Gotify notification fields
  (`remind_until_done`, `notification_sent_at`).

**Phase 5: Final Polish, PWA, and Deployment**

- Implemented `manifest.json` and necessary PWA meta tags in layouts to make the
  app installable on mobile devices.
- Refined the application's appearance using UnoCSS, applying the primary color
  palette (`#005F6A`, `#FFBF00`) and ensuring responsive, mobile-first design.
- Created a `Containerfile` optimized for production and set up a GitHub Actions
  workflow (`docker-publish.yml`) for building and publishing the container
  image.
- Verified PWA installability via Lighthouse and container execution locally.

---

## Phase 3: Core API and Data Fetching

**Goal**: Port the Express API to Astro API routes and update the database
querying to handle `rrule` based recurrence strings instead of `dayspan`.

### Task 3.1: Migrate Recurrence Logic to `rrule`

**Description**: Replace the deprecated `dayspan` library with `rrule` in
`src/utils/scheduleUtils.js` for handling recurring chores. Update the logic to
parse, generate, and calculate next occurrences using the standard RFC 5545
iCalendar format. **Outcome**: The application will use a standard,
well-maintained library for recurrence, ensuring accurate and reliable
scheduling of daily and weekly chores.

- [ ] Install the `rrule` package (e.g., `deno add npm:rrule`).
- [ ] Refactor `src/utils/scheduleUtils.js` (rename to `.ts`) to implement
      `calculateNextOccurrence(rruleString, lastCompletedDate)`.
- [ ] Add unit tests for `scheduleUtils.ts` covering daily, weekly, and edge
      cases.
- **Dependencies**: None.
- **Acceptance Criteria**:
  - `scheduleUtils.ts` exports a robust function for calculating the next due
    date based on an RRULE string.
  - Unit tests pass via `deno test` for various RRULE scenarios (e.g.,
    `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO,WE,FR`).

### Task 3.2: Create GET and POST Chores API Endpoints

**Description**: Implement the `GET` (list all chores for the user) and `POST`
(create a new chore) handlers in an Astro API route. **Outcome**: The frontend
will be able to retrieve the user's chores and add new ones, establishing the
core data flow for the application.

- [ ] Create file `src/pages/api/chores/index.ts`.
- [ ] Implement `GET` handler: Fetch all chores for the authenticated user from
      the database.
- [ ] Implement `POST` handler: Validate incoming payload (name, description,
      rrule string), and insert a new chore into the database.
- [ ] Integrate authentication middleware to ensure only logged-in users can
      access or modify their chores.
- **Dependencies**: Phase 2 (Auth Middleware), Task 3.1 (`rrule` logic for
  initial due date).
- **Acceptance Criteria**:
  - `GET /api/chores` returns a JSON array of chores for the current user.
  - `POST /api/chores` successfully creates a database entry and returns the new
    chore object (201 Created).
  - Unauthenticated requests return a 401 Unauthorized status.

### Task 3.3: Create PUT and DELETE Chores API Endpoints

**Description**: Implement the `PUT` (update a chore or mark as done) and
`DELETE` (remove a chore) handlers for specific chore IDs. **Outcome**: Users
will be able to manage their existing chores, editing details or completing
them, which dynamically updates their schedule.

- [ ] Create file `src/pages/api/chores/[id].ts`.
- [ ] Implement `PUT` handler: Update chore details. If marking as "done", use
      `scheduleUtils.ts` to calculate the new `next_due_date` and create a
      completion log entry.
- [ ] Implement `DELETE` handler: Remove the chore and its associated completion
      logs from the database.
- [ ] Ensure the endpoints verify that the requested chore belongs to the
      authenticated user.
- **Dependencies**: Task 3.2.
- **Acceptance Criteria**:
  - `PUT /api/chores/:id` correctly updates fields. When marking as completed,
    the `next_due_date` is properly advanced based on the `rrule`.
  - `DELETE /api/chores/:id` successfully removes the chore (204 No Content).
  - Attempting to modify another user's chore returns a 403 Forbidden or 404 Not
    Found.

### Task 3.4: Finalize DB Schema for Notifications

**Description**: Review and verify the database schema to ensure it fully
supports the planned Gotify notification features, even though the actual
notification pushing is deferred. **Outcome**: The database foundation is solid,
preventing the need for complex migrations later when the notification system is
actively implemented.

- [ ] Inspect the current `chores` table schema in `data/migrations`.
- [ ] Ensure fields like `remind_until_done` (boolean) and a
      `notification_sent_at` timestamp (or similar state tracking) exist to
      support future worker processes.
- [ ] If necessary, create a new Knex migration to add these columns via
      `deno task db:make`.
- **Dependencies**: Phase 1 (Database Setup).
- **Acceptance Criteria**:
  - The database schema has the necessary columns to track notification
    preferences and state for recurring chores.

**Phase 3 Verification Plan**:

- [ ] Write integration tests via `deno test` to hit the Astro API endpoints and
      verify CRUD operations work.
- [ ] Verify that unauthenticated requests to the API endpoints are properly
      rejected.
- [ ] Verify that `rrule` based scheduling correctly advances dates when a chore
      is completed via the API.

---

## Phase 3.5: Testing Infrastructure (Playwright)

**Goal**: Initialize Playwright and establish a core End-to-End testing suite
before building out the frontend UI, ensuring all new UI components are
test-driven.

### Task 3.5.1: Initialize Playwright Environment

**Description**: Install Playwright and configure it to run against the local
Deno/Astro development server. **Outcome**: The project will have a robust
framework for simulating real user interactions, preventing UI regressions.

- [ ] Install Playwright (`npm init playwright@latest` or equivalent via Deno).
- [ ] Create `playwright.config.ts` configured for the Astro dev server (e.g.,
      `webServer` command: `deno task dev`, port: `4321`).
- [ ] Update `deno.json` with a `test:e2e` task to run Playwright.
- **Dependencies**: Phase 1, Phase 2.
- **Acceptance Criteria**:
  - `deno task test:e2e` successfully launches Playwright and can hit the local
    development server.

### Task 3.5.2: Write Core E2E Test Suite

**Description**: Write a foundational E2E test suite covering the primary user
journey: Logging in, creating a chore, and marking it as complete. **Outcome**:
Core functionality is automatically verified on every test run, giving
confidence for Phase 4 UI development.

- [ ] Create `tests/e2e/core-journey.spec.ts`.
- [ ] Write a test that bypasses actual Google Auth (using the mock bypass
      `ENABLE_AUTH=false`).
- [ ] Write a test that creates a new chore via the API (or initial UI if
      available) and verifies it exists.
- [ ] Write a test that marks a chore as completed and verifies the state
      change.
- **Dependencies**: Task 3.5.1, Phase 3.
- **Acceptance Criteria**:
  - The E2E test suite passes reliably.
  - Tests use Playwright best practices (locators, auto-waiting).

---

## Phase 4: UI/UX Implementation (SolidJS Islands)

**Goal**: Rebuild the UI using Astro pages and SolidJS components for an
interactive, performant user experience.

### Task 4.1: Implement Server-Rendered Chore List

**Description**: Fetch the user's chores on the server and render the main
dashboard layout in `src/pages/index.astro`. **Outcome**: Users will see a fast,
SEO-friendly initial load of their current chores immediately upon logging in,
forming the foundation of the dashboard.

- [ ] Update `src/pages/index.astro` to fetch chores for the authenticated user
      in the frontmatter (either directly from the DB or via an internal API
      call).
- [ ] Design and implement the main page layout using UnoCSS classes, including
      a header and a main content area.
- [ ] Render a static list of chores as a fallback or initial state before
      client-side hydration.
- **Dependencies**: Phase 2 (Authentication), Phase 3 (Core API / DB access).
- **Acceptance Criteria**:
  - Authenticated users see their chores listed on the home page upon load.
  - The page loads quickly with no client-side JavaScript required for the
    initial display.
  - The layout is responsive and matches the intended design system using
    UnoCSS.

### Task 4.2: Build Interactive Chore Item Component

**Description**: Create a SolidJS component (`<ChoreItem client:visible />`) to
represent individual chores, enabling users to mark them as done without a full
page reload. **Outcome**: Users can smoothly interact with their chores,
experiencing immediate visual feedback when completing tasks, enhancing the
application's perceived performance.

- [ ] Create `src/components/ChoreItem.tsx` as a SolidJS component.
- [ ] Implement a toggle button (checkbox/circle) to mark the chore as done.
- [ ] Write a `fetch` call to the `PUT /api/chores/[id]` endpoint when the
      toggle is clicked.
- [ ] Implement optimistic UI updates (visually mark as done immediately, revert
      on API error) or loading states during the API call.
- [ ] Integrate the component into the `index.astro` chore list.
- **Dependencies**: Task 4.1, Task 3.3 (PUT endpoint).
- **Acceptance Criteria**:
  - Clicking a chore's completion toggle successfully updates the database via
    the API.
  - The UI updates immediately or shows a clear loading indicator.
  - Errors during the update process are gracefully handled and communicated to
    the user.

### Task 4.3: Implement Client-Side Fuzzy Search

**Description**: Develop a SolidJS search bar component
(`<ChoreSearch client:load />`) that filters the displayed chores instantly as
the user types, using `fuse.js`. **Outcome**: Users can quickly find specific
chores within long lists, significantly improving navigability and user
efficiency.

- [ ] Install `fuse.js` (`deno add npm:fuse.js`).
- [ ] Create `src/components/ChoreSearch.tsx` as a SolidJS component containing
      an input field.
- [ ] Implement logic to initialize Fuse.js with the list of chores and the
      search query state.
- [ ] Plumb the search state so it can filter the rendered `<ChoreItem>`
      components (this may require lifting state or wrapping the chore list in a
      parent SolidJS component).
- **Dependencies**: Task 4.1, Task 4.2.
- **Acceptance Criteria**:
  - Typing in the search bar instantly filters the visible chores based on name
    or description.
  - The search handles typos gracefully (fuzzy matching).
  - Clearing the search restores the full list of chores.

### Task 4.4: Create Add/Edit Chore Modal

**Description**: Build a modal interface for creating and editing chores. The
modal will contain a standard HTML form that POSTs to an Astro endpoint for
processing. **Outcome**: Users have a focused, clean interface for data entry
without navigating away from their dashboard context, while relying on robust
server-side form processing.

- [ ] Create an Astro or SolidJS component for the modal layout
      (`src/components/ChoreModal.astro` or `.tsx`).
- [ ] Implement a `<form method="POST" action="/api/chores">` within the modal.
- [ ] Add form fields for chore name, description, and recurrence rules
      (frequency, days of week, etc.) styled with UnoCSS.
- [ ] Implement client-side validation to ensure required fields are filled
      before submission.
- [ ] Ensure the Astro endpoint (`/api/chores`) handles the POST request,
      creates/updates the chore, and returns a 302 Redirect back to `/`.
- [ ] Add state management to open/close the modal from the main dashboard.
- **Dependencies**: Task 4.1, Task 3.2 (POST endpoint).
- **Acceptance Criteria**:
  - A "New Chore" button opens the modal.
  - Submitting a valid form creates a new chore and refreshes the page to show
    it.
  - The modal can also be opened in "edit mode" populated with existing chore
    data.
  - Validation errors prevent submission and display helpful messages.

**Phase 4 Verification Plan**:

- [ ] Run Playwright tests (`deno task test:playwright`) to verify the full user
      flow: viewing the list, adding a chore, editing it, and toggling it as
      done.
- [ ] Manually test the fuzzy search to ensure client-side filtering responds
      instantly and accurately.
- [ ] Verify form submissions work with JavaScript disabled (if using Astro
      native forms) or gracefully degrade.

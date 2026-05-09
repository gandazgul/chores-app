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

**Phase 3.5: Testing Infrastructure (Playwright)**

- Installed Playwright and configured it to run against the local Deno/Astro development server on port `4321`.
- Updated `deno.json` with a `test:e2e` task to run Playwright tests.
- Wrote a foundational E2E test suite in `tests/e2e/core-journey.spec.js` covering the primary user journey: Logging in, creating a chore, and marking it as complete via the API.
- Verified that `deno task test:e2e` successfully launches Playwright and passes all tests reliably.

**Phase 4: UI/UX Implementation (SolidJS Islands)**

- Implemented Server-Rendered Chore List in `src/pages/index.astro`, fetching and displaying authenticated user's chores.
- Designed main page layout using UnoCSS classes, providing a responsive and modern look.
- Built Interactive `ChoreItem` SolidJS component (`src/components/ChoreItem.jsx`) with optimistic UI updates and toggle functionality.
- Implemented Client-Side Fuzzy Search using `fuse.js` in `ChoreList` component (`src/components/ChoreList.jsx`) for instant chore filtering.
- Created an Add/Edit Chore Modal component (`src/components/ChoreModal.jsx`) with form validation and POST request handling to `/api/chores`.
- Refactored frontend code to use JavaScript (JS/JSX) with JSDoc annotations over TypeScript, ensuring strict type-checking via `deno check --check-js`.
- Verified all UI interactions (adding, viewing, filtering, completing) manually and via integration with existing API endpoints.

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

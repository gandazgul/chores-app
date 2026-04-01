# Roadmap

- [x] User authentication via Google Sign-In.
- [ ] Gotify notifications for chores.
- [x] Displaying a list of chores.
- [x] Adding new chores.
- [x] Marking chores as done.
- [x] Deleting chores.
- [x] Displaying chore descriptions.
- [x] Data persistence using a local SQLite database.
- [x] Recurring chores functionality.
- [ ] Fuzzy search for chores.
- [ ] Advanced features for recurring chores
- [x] Error handling and validation.
- [x] Testing (unit, integration, e2e).
- [x] Deployment setup. Containerized with docker, CI/CD pipeline set up.
- [x] PWA installability (manifest and meta tags).
- [x] UI/UX polish with UnoCSS (design styling).

## Recently Completed (Phase 3: Core API)

- **Recurrence Logic:** Replaced `dayspan` with standard `rrule` for recurrence
  scheduling, fully tested via `scheduleUtils.ts`.
- **API Endpoints:** Implemented Astro API routes (`/api/chores`) for all CRUD
  operations:
  - `GET`: Fetch authenticated user's chores.
  - `POST`: Create chores and parse recurrence rules for initial due dates.
  - `PUT`: Update chore details and handle completion (auto-advancing the next
    due date based on `rrule`).
  - `DELETE`: Remove chores securely.
- **Database Readiness:** Verified that the SQLite schema includes necessary
  columns (`remind_until_done`, `notification_sent_at`) for future notification
  systems.
- **Security:** All API endpoints are secured by authentication middleware,
  ensuring users can only access and modify their own data.

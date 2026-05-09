# System Patterns

## System Architecture

- Full Stack Deno Application build with AstroJS
- Component-based architecture.
- Auth provided by Google Cloud
- A local SQLite database is used for data persistence, managed by Knex.js.
- Containerized deployment with CI/CD via GitHub Actions.
- PWA-enabled with a web app manifest for mobile installability.

## Key Technical Decisions

- **UI Framework:** Use of SolidJS for reactive UI development (specifically Islands like Chore List, Chore Item, Fuzzy Search, and Modal).
- **Language/Typing:** Strict use of JS/JSX with JSDoc annotations for type checking via Deno instead of TypeScript.
- **E2E Testing:** Adoption of Playwright to ensure UI/UX features function seamlessly against the local Deno dev server.
- `UnoCSS` for CSS framework.
- `rrule` for handling recurring schedules.
- Knex.js for database migrations and queries.
- SQLite for local database.
- Google Cloud for authentication via secure JWT cookies.
- Gotify for push notifications.
- Deno native environment variables (`Deno.env.get()`) instead of generic
  environment modes, using feature-specific flags (`ENABLE_AUTH`,
  `COOKIE_SECURE`).

## Design Patterns in Use

- **Component-Based Architecture (SolidJS):** The application is structured
  around interactive UI Islands like `ChoreList`, `ChoreItem`, and `ChoreModal`. Components encapsulate UI and logic.
- **Reactive State Management (SolidJS Islands):**
  - Astro renders the base page (`index.astro`), and passes initial data into SolidJS Islands (e.g. `ChoreList`, `ChoreModal`) using Astro client directives.
  - `createSignal` is used inside interactive components (like `ChoreList` and `ChoreModal`) to manage client-side state, such as fuzzy search filtering or modal visibility.
  - `createMemo` is used to compute derived states, like filtered chore lists based on search inputs via `fuse.js`.
- **Event Handling & Forms:** `ChoreModal` implements form validation and uses standard POST/PUT requests to interact with Astro API routes (`/api/chores`), redirecting upon completion instead of relying purely on complex client-side state fetching.
- **Modal Dialog:** The `ChoreModal.jsx` component implements a modal
  pattern, providing a focused UI for users to input details for new chores or edit existing ones.
- **Utility Modules / Separation of Concerns:**
  - `src/utils/scheduleUtils.js`: Encapsulates logic related to chore
    scheduling, date comparisons, due date calculations (including recurrence),
    and chore sorting. This promotes reusability and keeps `App.jsx` cleaner.
  - `src/utils/fuzzySearchUtils.js`: Contains functions for initializing and
    performing fuzzy searches on chores, separating search logic from main
    application flow.
  - `src/utils/db.js`: Encapsulates all database interactions using Knex.js.

- **Conditional Rendering:**
  - SolidJS `<Show>` components are used throughout (e.g., hiding chore descriptions if none exist, showing the fuzzy search results).
- **List Rendering (and Keys):** The `ChoreList.jsx` component iterates over an array of chores utilizing Solid's `<For>` loop which automatically manages keyed rendering and optimal DOM updates.

## Component Relationships

- **`src/pages/index.astro` (Astro Root):**
  - The main server-rendered page. Fetches user data and chores via the Astro API lifecycle.
  - Injects initial `chores` array as a prop to the `ChoreList` Solid Island.
  - **`ChoreList.jsx`:**
    - Handles client-side fuzzy search, mapping through chores, and rendering `ChoreItem`s.
  - **`ChoreItem.jsx`:**
    - Displays individual chore data and houses interactivity for completing/toggling chore status.
    - Sends background network requests to update statuses optimistically.
  - **`ChoreModal.jsx`:**
    - Controls adding/editing a chore via a modal UI. Handles form validation and submission.
- **Utility Modules:**
  - **`src/utils/scheduleUtils.js`:** Provides functions for:
    - Date comparisons (`isSameDateAdapterDay`).
    - Determining if a chore is due today (`isChoreForToday`).
    - Calculating effective due dates for recurring chores
      (`getEffectiveDueDate`).
    - Sorting chores (`choreSortFn`).
    - Formatting schedule information for display (`getScheduleDisplayString`,
      `getChoreDisplayDetails`).
  - **`src/utils/fuzzySearchUtils.js`:** Provides functions for:
    - Initializing the Fuse.js instance for fuzzy searching
      (`initializeFuzzySearch`).
    - Performing fuzzy searches on the chore list (`fuzzySearchChores`).

## Critical Implementation Paths

1. **User Authentication:**
   - Astro middleware intercepts all incoming requests.
   - It enforces authentication via a secure, HTTP-only cookie containing a
     signed JWT (using the `jose` library).
   - If the cookie is valid, the user is authenticated and the main application
     content is rendered.
   - Developers can bypass Google Auth locally by setting `ENABLE_AUTH=false` in
     their `.env` file. This injects a dummy user payload into `Astro.locals`.
   - Missing or `true` `ENABLE_AUTH` defaults to enforcing authentication.
   - Missing or `true` `COOKIE_SECURE` defaults to secure cookies.

2. **Adding a New Chore (via Modal):**
   - User clicks to add a chore.
   - The server-rendered page opens the `ChoreModal` component.
   - User fills in chore details (title, description, priority, due date, and/or recurrence settings).
   - Upon submission, the modal submits an HTTP POST request to `/api/chores`.
   - The Astro API handles the request and redirects back to the main page on success, refreshing the `chores` list from the database.

3. **Adding a New Chore (via Quick Add Input):**
   - User types a chore title into the quick-add input field in `ChoreList.jsx`.
   - On submission, an optimistic API call is made to create the chore.
   - The page is refreshed to retrieve the updated server state.

4. **Viewing, Searching, and Filtering Chores:**
   - **Initial Load:** Astro server fetches user chores and renders the base page.
   - **Search Initialization:** The `ChoreList` Island initializes `fuse.js` fuzzy search logic with the injected `chores` array.
   - **User Search Input:** Typing in the search input updates the client-side signal.
   - **Reactive Filtering:** The memoized filtered chore list recomputes and renders via a Solid `<For>` loop.

5. **Marking a Chore as Done/Not Done:**
   - User interacts with the toggle in a `ChoreItem` component.
   - The component updates its optimistic local state.
   - A background HTTP PUT request to `/api/chores/:id` is sent to update the DB.

6. **Deleting a Chore:**
   - User clicks the delete button within `ChoreItem` or `ChoreModal`.
   - An HTTP DELETE request is sent to `/api/chores/:id`.
   - Upon success, the window reloads or removes the item from the client-side array.

7. **Recurring Chore Evaluation and Display:**
   - Chores can be created with a `recurrence` property compatible with `rrule`.
   - `ChoreModal.jsx` provides UI elements to map these strings.
   - Utility functions in `src/utils/scheduleUtils.js` handle date calculations and rrule conversions.

This document outlines the architectural and technical design of the system. It
should reflect decisions made and patterns adopted during development.

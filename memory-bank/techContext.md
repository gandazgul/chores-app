# Tech Context

## Technologies Used

- SolidJS (UI Framework)
- Vite (Build tool)
- Less (CSS preprocessor)
- Knex.js (SQL query builder)
- SQLite3 (local database)
- Firebase (Authentication and Push Notifications)

## Development Setup

- **Run development server:** `pnpm dev`
- **Build for production:** `pnpm build`
- **Preview production build:** `pnpm preview`
- **Seed the database:** `pnpm db:seed`

## Technical Constraints

*(To be defined)*

## Dependencies

### Core Dependencies
- `@fortawesome/fontawesome-svg-core`: ^6.7.2
- `@fortawesome/free-solid-svg-icons`: ^6.7.2
- `@picocss/pico`: ^2.0.6 (CSS Framework)
- `classnames`: ^2.5.1 (Utility for conditionally joining classNames together)
- `dayspan`: ^1.1.0 (for handling recurring events)
- `firebase`: ^11.8.1 (Backend services including Authentication and Push Notifications)
- `fuse.js`: ^7.1.0 (Fuzzy search library)
- `knex`: ^3.1.0 (SQL query builder)
- `prop-types`: ^15.8.1 (Runtime type checking for React props and similar objects - likely used with SolidJS components)
- `solid-fontawesome`: ^0.2.1 (FontAwesome icons for SolidJS)
- `solid-js`: ^1.9.4 (Core SolidJS library)
- `sqlite3`: ^5.1.7 (SQLite database driver)
- `workbox-precaching`: ^7.3.0
- `workbox-routing`: ^7.3.0
- `workbox-strategies`: ^7.3.0
- `workbox-window`: ^7.3.0

### Development Dependencies
- `dotenv`: ^16.4.5
- `less`: ^4.2.2
- `vite`: ^6.1.0
- `vite-plugin-pwa`: ^1.0.0
- `vite-plugin-solid`: ^2.11.0

## Tool Usage Patterns

*(To be defined)*

## Project Hosting

- **Platform:** GitHub
- **Repository URL:** https://github.com/gandazgul/chores-app.git
- **Key Features:** Version control, issue tracking, collaboration, CI/CD (if configured).

## Authentication

- **Provider:** Firebase Authentication
- **Method:** Google Sign-In (Popup method)
- **Configuration:** `src/utils/firebaseConfig.js` initializes Firebase and the Auth instance.
- **UI Integration:**
    - `src/components/LoginPage.jsx`: A SolidJS component that handles the Google Sign-In process.
        - Displays a generic error message if authentication fails.
    - `src/App.jsx`: The main SolidJS application component that:
        - Listens for authentication state changes using `onAuthStateChanged` from Firebase.
        - Conditionally renders `LoginPage.jsx` or the main application content based on user authentication status.
        - Includes a logout button.

## Database

- **Query Builder:** Knex.js
- **Driver:** SQLite3
- **Configuration:** `knexfile.js`
- **Migrations:** Located in the `migrations` directory. The initial migration creates `users`, `chores`, and `user_fcm_tokens` tables.
- **Schema:**
    - `users`: Stores user information (`id`, `email`).
    - `chores`: Stores chore details, linked to a user. Includes fields for title, description, priority, due date, and recurrence.
    - `user_fcm_tokens`: Stores Firebase Cloud Messaging tokens for push notifications, linked to a user.

## Push Notifications

- **Provider:** Firebase Cloud Messaging (FCM)
- **Service Worker:** `src/sw.js` (powered by Workbox) handles background push notifications.
- **Client-side Logic:** `src/utils/pushNotifications.js` contains the logic for requesting permission and getting the FCM token.
- **Token Storage:** FCM tokens are stored in the `user_fcm_tokens` table in the database.

This document covers the technical landscape of the project, including tools, technologies, and constraints.

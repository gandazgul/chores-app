# Tech Context

## Technologies Used

- AstroJS (Web Framework)
- Deno (Runtime)
- UnoCSS (CSS framework)
- Knex.js (SQL query builder)
- SQLite3 (local database)
- Google Sign-In (Authentication — not yet implemented, using fake user)

## Development Setup

- **Seed the database:** `yarn db:seed`
- **Run tests:** `NODE_OPTIONS='--experimental-vm-modules' jest`

## Technical Constraints

*(To be defined)*

## Dependencies

### Core Dependencies
- `classnames`: ^2.5.1 (Utility for conditionally joining classNames together)
- `dayspan`: ^1.1.0 (for handling recurring events)
- `express`: ^5.2.1 (API server)
- `express-jsdoc-swagger`: ^1.8.0 (API documentation)
- `fuse.js`: ^7.1.0 (Fuzzy search library)
- `knex`: ^3.1.0 (SQL query builder)
- `sqlite3`: ^6.0.1 (SQLite database driver)
- `uuid`: ^13.0.0 (UUID generation)

### Development Dependencies
- `dotenv`: ^17.3.1
- `jest`: ^30.1.3
- `mockdate`: ^3.0.5
- `supertest`: ^7.1.4

## Tool Usage Patterns

*(To be defined)*

## Project Hosting

- **Platform:** GitHub
- **Repository URL:** https://github.com/gandazgul/chores-app.git
- **Key Features:** Version control, issue tracking, collaboration, CI/CD (if configured).

## Authentication

- **Provider:** Google Sign-In (not yet implemented — currently using a fake demo user)
- **Method:** Google Identity Services (planned)
- **UI Integration:**
    - `src/old_components/LoginPage.jsx`: Displays a fake login button that sets a hardcoded demo user.

## Database

- **Query Builder:** Knex.js
- **Driver:** SQLite3
- **Configuration:** `knexfile.js`
- **Migrations:** Located in the `data/migrations` directory. The initial migration creates `users` and `chores` tables.
- **Schema:**
    - `users`: Stores user information (`id`, `email`).
    - `chores`: Stores chore details, linked to a user. Includes fields for title, description, priority, due date, and recurrence.

This document covers the technical landscape of the project, including tools, technologies, and constraints.

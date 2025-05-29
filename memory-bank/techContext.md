# Tech Context

## Technologies Used

- SolidJS (UI Framework)
- Vite (Build tool)
- Less (CSS preprocessor)

## Development Setup

- **Run development server:** `pnpm dev`
- **Build for production:** `pnpm build`
- **Preview production build:** `pnpm preview`

## Technical Constraints

*(To be defined)*

## Dependencies

### Core Dependencies
- `@fortawesome/fontawesome-svg-core`: ^6.7.2
- `@fortawesome/free-solid-svg-icons`: ^6.7.2
- `@picocss/pico`: ^2.0.6 (CSS Framework)
- `@rschedule/core`: ^1.5.0 (Recurring schedule generation)
- `@rschedule/standard-date-adapter`: ^1.5.0
- `classnames`: ^2.5.1 (Utility for conditionally joining classNames together)
- `prop-types`: ^15.8.1 (Runtime type checking for React props and similar objects - likely used with SolidJS components)
- `solid-fontawesome`: ^0.2.1 (FontAwesome icons for SolidJS)
- `solid-js`: ^1.9.4 (Core SolidJS library)
- `firebase`: ^11.8.1 (Backend services including Authentication)

### Development Dependencies
- `less`: ^4.2.2
- `vite`: ^6.1.0
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

This document covers the technical landscape of the project, including tools, technologies, and constraints.

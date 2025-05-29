# Progress

## What Works

Based on the component structure and utility functions, the application likely supports:
- Displaying a list of chores (`Chores.jsx`, `Chore.jsx`).
- Adding new chores (via `AddChoreModal.jsx` and `Chores.jsx` handlers).
- Marking chores as done (inferred from `handleChoreDone` in `Chores.jsx`).
- Deleting chores (inferred from `handleDeleteChore` in `Chores.jsx`).
- Displaying chore descriptions (inferred from `toggleDescription` in `Chore.jsx`).
- Basic chore data management (due dates, sorting - via `utils.js`).
- Potential for recurring chores (due to `@rschedule/core` dependency and `getEffectiveDueDate` utility).

## What's Left to Build

- Detailed UI/UX for all features.
- Data persistence (currently chores are likely in-memory).
- Advanced features for recurring chores if not fully implemented.
- User authentication/accounts (if planned).
- Error handling and validation.
- Styling refinements beyond PicoCSS defaults.
- Testing (unit, integration, e2e).
- Deployment setup.

## Current Status

- Core components for chore management are in place.
- Basic CRUD (Create, Read, Update, Delete) operations for chores seem to be implemented at a functional level.
- The application is a SolidJS project built with Vite.

## Known Issues

*(To be defined)*

## Evolution of Project Decisions

*(To be defined)*

This document tracks the overall progress of the project, including completed work, pending chores, and any known issues.

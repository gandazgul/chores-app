# Progress

## What Works

Based on the component structure and utility functions, the application likely supports:
- Displaying a list of tasks (`Chores.jsx`, `Chore.jsx`).
- Adding new tasks (via `AddTaskModal.jsx` and `Chores.jsx` handlers).
- Marking tasks as done (inferred from `handleTaskDone` in `Chores.jsx`).
- Deleting tasks (inferred from `handleDeleteTask` in `Chores.jsx`).
- Displaying task descriptions (inferred from `toggleDescription` in `Chore.jsx`).
- Basic task data management (due dates, sorting - via `utils.js`).
- Potential for recurring tasks (due to `@rschedule/core` dependency and `getEffectiveDueDate` utility).

## What's Left to Build

- Detailed UI/UX for all features.
- Data persistence (currently tasks are likely in-memory).
- Advanced features for recurring tasks if not fully implemented.
- User authentication/accounts (if planned).
- Error handling and validation.
- Styling refinements beyond PicoCSS defaults.
- Testing (unit, integration, e2e).
- Deployment setup.

## Current Status

- Core components for task management are in place.
- Basic CRUD (Create, Read, Update, Delete) operations for tasks seem to be implemented at a functional level.
- The application is a SolidJS project built with Vite.

## Known Issues

*(To be defined)*

## Evolution of Project Decisions

*(To be defined)*

This document tracks the overall progress of the project, including completed work, pending tasks, and any known issues.

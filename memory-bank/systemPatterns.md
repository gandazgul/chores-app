# System Patterns

## System Architecture

- Frontend application built with SolidJS.
- Component-based architecture.
- The main application entry point is `App.jsx`.

## Key Technical Decisions

- Use of SolidJS for reactive UI development.
- Vite for the build process.
- Less for styling.
- `@picocss/pico` for base styling/CSS framework.
- `@rschedule/core` for handling recurring schedules (suggests potential for recurring tasks).

## Design Patterns in Use

*(To be defined)*

## Component Relationships

- `App.jsx` (likely root component)
    - `Chores.jsx`: Manages a list of chores/tasks.
        - Handles adding new tasks (likely using `AddTaskModal.jsx`).
        - Handles deleting tasks.
        - Handles marking tasks as done.
        - Displays individual tasks using `Chore.jsx`.
    - `Chore.jsx`: Represents a single chore/task item.
        - Displays task details.
        - Allows toggling description visibility.
    - `AddTaskModal.jsx`: A modal dialog for inputting and adding new tasks.
- `utils.js`: Contains helper functions for task management, such as:
    - Date comparisons (`isSameDateAdapterDay`)
    - Determining if a task is for today (`isTaskForToday`)
    - Calculating effective due dates (`getEffectiveDueDate`)
    - Sorting tasks (`taskSortFn`)

## Critical Implementation Paths

*(To be defined)*

This document outlines the architectural and technical design of the system. It should reflect decisions made and patterns adopted during development.

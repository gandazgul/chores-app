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

- **Component-Based Architecture (SolidJS):** The application is structured around components like `App` (root), `Chores`, `Chore`, `AddTaskModal`, and `AddTaskFloatButton`. Components encapsulate UI and logic.
- **Reactive State Management (SolidJS Signals):**
    - `createSignal` is used extensively in `App.jsx` to manage core application state such as `tasks`, `newTaskModalOpen` (visibility of the add task modal), `quickTaskTitle` (for search and quick add), and `fuse` (the fuzzy search instance).
    - `createMemo` is used for `displayedTasks` to efficiently compute the list of tasks to display based on the current `tasks` and `quickTaskTitle` (search term). This ensures that the task list only recomputes when its dependencies change.
    - `createEffect` is used to perform side effects in response to state changes, specifically to re-initialize the `fuse` fuzzy search instance whenever the `tasks` list is modified.
- **Props Drilling:** State and event handlers are passed down from parent components to child components. For example, `App.jsx` passes the `tasks` list, and handlers like `onTaskDone`, `onDeleteTask`, and `onAddNewTask` to the `Chores` and `AddTaskModal` components. Utility functions from `scheduleUtils.js` are also passed as props to `Chores`.
- **Event Handling:** User interactions trigger event handlers primarily defined in `App.jsx`. Examples include `handleTaskDone`, `handleDeleteTask`, `handleAddNewTask`, `handleQuickAddTask`, and `handleAddTaskClick`. Child components call these handlers via props.
- **Modal Dialog:** The `AddTaskModal.jsx` component implements a modal pattern, providing a focused UI for users to input details for new tasks. Its visibility is controlled by the `newTaskModalOpen` signal in `App.jsx`.
- **Utility Modules / Separation of Concerns:**
    - `src/utils/scheduleUtils.js`: Encapsulates logic related to task scheduling, date comparisons, due date calculations (including recurrence), and task sorting. This promotes reusability and keeps `App.jsx` cleaner.
    - `src/utils/fuzzySearchUtils.js`: Contains functions for initializing and performing fuzzy searches on tasks, separating search logic from main application flow.
- **Conditional Rendering:**
    - The `AddTaskModal` is conditionally rendered in `App.jsx` based on the boolean value of the `newTaskModalOpen` signal.
    - Individual `Chore` components likely use conditional rendering to show/hide task descriptions.
- **List Rendering (and Keys):** The `Chores.jsx` component iterates over the `tasks` (or `displayedTasks`) array to render a list of `Chore.jsx` components. In SolidJS (similar to React), unique keys would be necessary for efficient updates and rendering of list items.
- **Controlled Components:** The input field used for searching tasks and quick-adding new tasks in `App.jsx` is a controlled component. Its value is bound to the `quickTaskTitle` signal, and its `onInput` event updates this signal.
- **Initial Data & State Initialization:** `App.jsx` defines `initialTasks` to populate the application on load, demonstrating how state is initialized.

## Component Relationships

- **`App.jsx` (Root Component):**
    - Manages global application state (tasks, modal visibility, search term) using SolidJS signals (`tasks`, `newTaskModalOpen`, `quickTaskTitle`, `fuse`).
    - Defines core logic for task manipulation (add, complete, delete) and search.
    - Renders `Chores`, `AddTaskModal`, and `AddTaskFloatButton`.
    - Contains the quick add/search form.
    - **`Chores.jsx`:**
        - Receives the list of tasks to display (`displayedTasks()`) from `App.jsx`.
        - Receives event handlers (`onTaskDone`, `onDeleteTask`) and utility functions (`isTaskForToday`, `taskSortFn`) as props from `App.jsx`.
        - Maps over the tasks and renders an individual `Chore.jsx` for each.
    - **`Chore.jsx`:**
        - Receives a single task object and event handlers (`onTaskDone`, `onDeleteTask`) as props from `Chores.jsx`.
        - Displays task details (title, description, due date).
        - Handles user interactions for marking a task done or deleting it, and toggling description visibility.
    - **`AddTaskModal.jsx`:**
        - Receives `open` status and event handlers (`onClose`, `onAddNewTask`) as props from `App.jsx`.
        - Provides a form for detailed task input, including recurrence options.
        - Calls `onAddNewTask` (from `App.jsx`) with the new task data upon submission.
    - **`AddTaskFloatButton.jsx`:**
        - Receives an `onClick` handler (`handleAddTaskClick` from `App.jsx`) as a prop.
        - Triggers the opening of the `AddTaskModal`.
- **Utility Modules:**
    - **`src/utils/scheduleUtils.js`:** Provides functions for:
        - Date comparisons (`isSameDateAdapterDay`).
        - Determining if a task is due today (`isTaskForToday`).
        - Calculating effective due dates for recurring tasks (`getEffectiveDueDate`).
        - Sorting tasks (`taskSortFn`).
        - Formatting schedule information for display (`getScheduleDisplayString`, `getTaskDisplayDetails`).
    - **`src/utils/fuzzySearchUtils.js`:** Provides functions for:
        - Initializing the Fuse.js instance for fuzzy searching (`initializeFuzzySearch`).
        - Performing fuzzy searches on the task list (`fuzzySearchTasks`).

## Critical Implementation Paths

1.  **Adding a New Task (via Modal):**
    *   User clicks `AddTaskFloatButton`.
    *   `App.jsx`'s `handleAddTaskClick` sets `newTaskModalOpen` signal to `true`.
    *   `AddTaskModal` component becomes visible.
    *   User fills in task details (title, description, priority, due date, and/or recurrence settings).
    *   Upon submission, `AddTaskModal` calls `props.onAddNewTask` (which is `handleAddNewTask` in `App.jsx`).
    *   `handleAddNewTask` in `App.jsx`:
        *   Constructs a new task object. It correctly handles both simple `dueDate` (as a `Date` object) and complex `recurrence` (as an `rschedule` `Rule` object).
        *   Updates the `tasks` signal by appending the new task.
        *   Sets `newTaskModalOpen` to `false` to close the modal.
    *   The `displayedTasks` memo recomputes due to the change in `tasks`.
    *   `Chores` component re-renders to display the updated list including the new task.

2.  **Adding a New Task (via Quick Add Input):**
    *   User types a task title into the combined search/quick-add input field in `App.jsx`.
    *   User presses "Enter" or clicks the submit button associated with the input.
    *   `App.jsx`'s `handleQuickAddTask` function is invoked.
    *   It retrieves the `quickTaskTitle()`. If not empty:
        *   A new task object is created with the entered title and default values for description and priority.
        *   The `tasks` signal is updated by appending this new task.
        *   The `quickTaskTitle` signal is cleared.
    *   The `displayedTasks` memo recomputes.
    *   `Chores` component re-renders.

3.  **Viewing, Searching, and Filtering Tasks:**
    *   **Initial Load:** `App.jsx` initializes the `tasks` signal with `initialTasks`.
    *   **Search Initialization:** `createEffect` in `App.jsx` monitors the `tasks` signal. When `tasks` change, it re-initializes the `fuse` fuzzy search instance (`initializeFuzzySearch`) with the current tasks and specified keys (`title`, `description`).
    *   **User Search Input:** User types into the search/quick-add input. The `onInput` event updates the `quickTaskTitle` signal.
    *   **Reactive Filtering:** The `displayedTasks` memo in `App.jsx` reacts to changes in `quickTaskTitle` or `fuse`.
        *   If `quickTaskTitle` is empty or `fuse` is not ready, it returns all tasks from the `tasks()` signal.
        *   Otherwise, it calls `fuzzySearchTasks(fuse(), quickTaskTitle())` to get a filtered list.
    *   **Rendering:** The `Chores` component receives `displayedTasks()` as a prop and renders the list of `Chore` components. It may use utility functions like `taskSortFn` (passed as a prop) for sorting before rendering.

4.  **Marking a Task as Done/Not Done:**
    *   User interacts with a completion toggle (e.g., checkbox) within a specific `Chore` component.
    *   The `Chore` component calls `props.onTaskDone` (passed down from `App.jsx` via `Chores.jsx`), likely passing an event object.
    *   `App.jsx`'s `handleTaskDone` function:
        *   Identifies the target task (e.g., using `e.target.dataset.taskTitle`).
        *   Updates the `tasks` signal by mapping over the previous tasks and toggling the `done` status of the matched task.
    *   The UI (specifically the affected `Chore` component) re-renders to reflect the new completion status.

5.  **Deleting a Task:**
    *   User clicks a delete button within a specific `Chore` component.
    *   The `Chore` component calls `props.onDeleteTask` (passed down from `App.jsx` via `Chores.jsx`), passing the task object to be deleted.
    *   `App.jsx`'s `handleDeleteTask` function:
        *   Updates the `tasks` signal by filtering out the task whose title matches `taskToDelete.title`.
    *   The `Chores` component re-renders, removing the deleted task from the display.

6.  **Recurring Task Evaluation and Display:**
    *   Tasks can be created with a `recurrence` property, which is an object defining the recurrence rule (e.g., frequency, interval, specific days/dates, start date, count/until). This structure is compatible with `@rschedule/core`.
    *   `AddTaskModal.jsx` provides UI elements for users to define these recurrence rules, which are then transformed into `Rule` objects or stored appropriately.
    *   Utility functions in `src/utils/scheduleUtils.js` (e.g., `getEffectiveDueDate`, `isTaskForToday`, `getScheduleDisplayString`, `getTaskDisplayDetails`) are used to:
        *   Calculate the next or relevant occurrence of a recurring task.
        *   Determine if a recurring task is active or due for the current day.
        *   Generate human-readable strings describing the recurrence schedule for display in the UI.
    *   This logic is likely invoked within `Chores.jsx` or individual `Chore.jsx` components when rendering task details.

This document outlines the architectural and technical design of the system. It should reflect decisions made and patterns adopted during development.

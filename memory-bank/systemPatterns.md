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
- `@rschedule/core` for handling recurring schedules (suggests potential for recurring chores).

## Design Patterns in Use

- **Component-Based Architecture (SolidJS):** The application is structured around components like `App` (root), `Chores`, `Chore`, `AddChoreModal`, and `AddChoreFloatButton`. Components encapsulate UI and logic.
- **Reactive State Management (SolidJS Signals):**
    - `createSignal` is used extensively in `App.jsx` to manage core application state such as `chores`, `newChoreModalOpen` (visibility of the add chore modal), `quickChoreTitle` (for search and quick add), and `fuse` (the fuzzy search instance).
    - `createMemo` is used for `displayedChores` to efficiently compute the list of chores to display based on the current `chores` and `quickChoreTitle` (search term). This ensures that the chore list only recomputes when its dependencies change.
    - `createEffect` is used to perform side effects in response to state changes, specifically to re-initialize the `fuse` fuzzy search instance whenever the `chores` list is modified.
- **Props Drilling:** State and event handlers are passed down from parent components to child components. For example, `App.jsx` passes the `chores` list, and handlers like `onChoreDone`, `onDeleteChore`, and `onAddNewChore` to the `Chores` and `AddChoreModal` components. Utility functions from `scheduleUtils.js` are also passed as props to `Chores`.
- **Event Handling:** User interactions trigger event handlers primarily defined in `App.jsx`. Examples include `handleChoreDone`, `handleDeleteChore`, `handleAddNewChore`, `handleQuickAddChore`, and `handleAddChoreClick`. Child components call these handlers via props.
- **Modal Dialog:** The `AddChoreModal.jsx` component implements a modal pattern, providing a focused UI for users to input details for new chores. Its visibility is controlled by the `newChoreModalOpen` signal in `App.jsx`.
- **Utility Modules / Separation of Concerns:**
    - `src/utils/scheduleUtils.js`: Encapsulates logic related to chore scheduling, date comparisons, due date calculations (including recurrence), and chore sorting. This promotes reusability and keeps `App.jsx` cleaner.
    - `src/utils/fuzzySearchUtils.js`: Contains functions for initializing and performing fuzzy searches on chores, separating search logic from main application flow.
- **Conditional Rendering:**
    - The `AddChoreModal` is conditionally rendered in `App.jsx` based on the boolean value of the `newChoreModalOpen` signal.
    - Individual `Chore` components likely use conditional rendering to show/hide chore descriptions.
- **List Rendering (and Keys):** The `Chores.jsx` component iterates over the `chores` (or `displayedChores`) array to render a list of `Chore.jsx` components. In SolidJS (similar to React), unique keys would be necessary for efficient updates and rendering of list items.
- **Controlled Components:** The input field used for searching chores and quick-adding new chores in `App.jsx` is a controlled component. Its value is bound to the `quickChoreTitle` signal, and its `onInput` event updates this signal.
- **Initial Data & State Initialization:** `App.jsx` defines `initialChores` to populate the application on load, demonstrating how state is initialized.

## Component Relationships

- **`App.jsx` (Root Component):**
    - Manages global application state (chores, modal visibility, search term) using SolidJS signals (`chores`, `newChoreModalOpen`, `quickChoreTitle`, `fuse`).
    - Defines core logic for chore manipulation (add, complete, delete) and search.
    - Renders `Chores`, `AddChoreModal`, and `AddChoreFloatButton`.
    - Contains the quick add/search form.
    - **`Chores.jsx`:**
        - Receives the list of chores to display (`displayedChores()`) from `App.jsx`.
        - Receives event handlers (`onChoreDone`, `onDeleteChore`) and utility functions (`isChoreForToday`, `choreSortFn`) as props from `App.jsx`.
        - Maps over the chores and renders an individual `Chore.jsx` for each.
    - **`Chore.jsx`:**
        - Receives a single chore object and event handlers (`onChoreDone`, `onDeleteChore`) as props from `Chores.jsx`.
        - Displays chore details (title, description, due date).
        - Handles user interactions for marking a chore done or deleting it, and toggling description visibility.
    - **`AddChoreModal.jsx`:**
        - Receives `open` status and event handlers (`onClose`, `onAddNewChore`) as props from `App.jsx`.
        - Provides a form for detailed chore input, including recurrence options.
        - Calls `onAddNewChore` (from `App.jsx`) with the new chore data upon submission.
    - **`AddChoreFloatButton.jsx`:**
        - Receives an `onClick` handler (`handleAddChoreClick` from `App.jsx`) as a prop.
        - Triggers the opening of the `AddChoreModal`.
- **Utility Modules:**
    - **`src/utils/scheduleUtils.js`:** Provides functions for:
        - Date comparisons (`isSameDateAdapterDay`).
        - Determining if a chore is due today (`isChoreForToday`).
        - Calculating effective due dates for recurring chores (`getEffectiveDueDate`).
        - Sorting chores (`choreSortFn`).
        - Formatting schedule information for display (`getScheduleDisplayString`, `getChoreDisplayDetails`).
    - **`src/utils/fuzzySearchUtils.js`:** Provides functions for:
        - Initializing the Fuse.js instance for fuzzy searching (`initializeFuzzySearch`).
        - Performing fuzzy searches on the chore list (`fuzzySearchChores`).

## Critical Implementation Paths

1.  **Adding a New Chore (via Modal):**
    *   User clicks `AddChoreFloatButton`.
    *   `App.jsx`'s `handleAddChoreClick` sets `newChoreModalOpen` signal to `true`.
    *   `AddChoreModal` component becomes visible.
    *   User fills in chore details (title, description, priority, due date, and/or recurrence settings).
    *   Upon submission, `AddChoreModal` calls `props.onAddNewChore` (which is `handleAddNewChore` in `App.jsx`).
    *   `handleAddNewChore` in `App.jsx`:
        *   Constructs a new chore object. It correctly handles both simple `dueDate` (as a `Date` object) and complex `recurrence` (as an `rschedule` `Rule` object).
        *   Updates the `chores` signal by appending the new chore.
        *   Sets `newChoreModalOpen` to `false` to close the modal.
    *   The `displayedChores` memo recomputes due to the change in `chores`.
    *   `Chores` component re-renders to display the updated list including the new chore.

2.  **Adding a New Chore (via Quick Add Input):**
    *   User types a chore title into the combined search/quick-add input field in `App.jsx`.
    *   User presses "Enter" or clicks the submit button associated with the input.
    *   `App.jsx`'s `handleQuickAddChore` function is invoked.
    *   It retrieves the `quickChoreTitle()`. If not empty:
        *   A new chore object is created with the entered title and default values for description and priority.
        *   The `chores` signal is updated by appending this new chore.
        *   The `quickChoreTitle` signal is cleared.
    *   The `displayedChores` memo recomputes.
    *   `Chores` component re-renders.

3.  **Viewing, Searching, and Filtering Chores:**
    *   **Initial Load:** `App.jsx` initializes the `chores` signal with `initialChores`.
    *   **Search Initialization:** `createEffect` in `App.jsx` monitors the `chores` signal. When `chores` change, it re-initializes the `fuse` fuzzy search instance (`initializeFuzzySearch`) with the current chores and specified keys (`title`, `description`).
    *   **User Search Input:** User types into the search/quick-add input. The `onInput` event updates the `quickChoreTitle` signal.
    *   **Reactive Filtering:** The `displayedChores` memo in `App.jsx` reacts to changes in `quickChoreTitle` or `fuse`.
        *   If `quickChoreTitle` is empty or `fuse` is not ready, it returns all chores from the `chores()` signal.
        *   Otherwise, it calls `fuzzySearchChores(fuse(), quickChoreTitle())` to get a filtered list.
    *   **Rendering:** The `Chores` component receives `displayedChores()` as a prop and renders the list of `Chore` components. It may use utility functions like `choreSortFn` (passed as a prop) for sorting before rendering.

4.  **Marking a Chore as Done/Not Done:**
    *   User interacts with a completion toggle (e.g., checkbox) within a specific `Chore` component.
    *   The `Chore` component calls `props.onChoreDone` (passed down from `App.jsx` via `Chores.jsx`), likely passing an event object.
    *   `App.jsx`'s `handleChoreDone` function:
        *   Identifies the target chore (e.g., using `e.target.dataset.choreTitle`).
        *   Updates the `chores` signal by mapping over the previous chores and toggling the `done` status of the matched chore.
    *   The UI (specifically the affected `Chore` component) re-renders to reflect the new completion status.

5.  **Deleting a Chore:**
    *   User clicks a delete button within a specific `Chore` component.
    *   The `Chore` component calls `props.onDeleteChore` (passed down from `App.jsx` via `Chores.jsx`), passing the chore object to be deleted.
    *   `App.jsx`'s `handleDeleteChore` function:
        *   Updates the `chores` signal by filtering out the chore whose title matches `choreToDelete.title`.
    *   The `Chores` component re-renders, removing the deleted chore from the display.

6.  **Recurring Chore Evaluation and Display:**
    *   Chores can be created with a `recurrence` property, which is an object defining the recurrence rule (e.g., frequency, interval, specific days/dates, start date, count/until). This structure is compatible with `@rschedule/core`.
    *   `AddChoreModal.jsx` provides UI elements for users to define these recurrence rules, which are then transformed into `Rule` objects or stored appropriately.
    *   Utility functions in `src/utils/scheduleUtils.js` (e.g., `getEffectiveDueDate`, `isChoreForToday`, `getScheduleDisplayString`, `getChoreDisplayDetails`) are used to:
        *   Calculate the next or relevant occurrence of a recurring chore.
        *   Determine if a recurring chore is active or due for the current day.
        *   Generate human-readable strings describing the recurrence schedule for display in the UI.
    *   This logic is likely invoked within `Chores.jsx` or individual `Chore.jsx` components when rendering chore details.

This document outlines the architectural and technical design of the system. It should reflect decisions made and patterns adopted during development.

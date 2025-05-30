## Web Development & Architecture

**Pattern: Web Push Notification Architecture**
- **Client-side:**
    1. Request user permission for notifications.
    2. Subscribe to the push service, which generates a `PushSubscription` object containing the endpoint and keys.
- **Service Worker (`sw.js`):**
    1. Listen for the `push` event: Triggered when a push message is received. Handler should display a notification using `self.registration.showNotification()`.
    2. Listen for the `notificationclick` event: Triggered when a user clicks on a displayed notification. Handler can open a specific URL or focus an existing window.
- **Server-side:**
    1. Store the `PushSubscription` objects (endpoint, keys) securely for each user/device.
    2. Use VAPID (Voluntary Application Server Identification) keys (a public/private key pair) to authenticate the application server with the push service. The public VAPID key is sent to the client during the subscription process.
    3. Send push messages to the stored endpoints using a library that supports the Web Push Protocol, including VAPID headers.
- *Rationale:* This architecture enables sending timely updates and notifications to users even when they are not actively using the web application.

**Best Practice: Clear Communication of Implementation Limitations**
- When unable to implement a complete solution (e.g., due to missing backend capabilities or scope constraints), clearly communicate these limitations to the user.
- Provide guidance or steps for the user to implement the remaining parts themselves.
- *Rationale:* Manages expectations and empowers the user to complete the solution.

## Solid.js

**Pattern: Solid.js Context API for State Management**
- **1. Define Context:**
  ```javascript
  // Example: src/utils/UserContext.jsx
  import { createContext, useContext } from 'solid-js';
  export const UserContext = createContext();
  ```
- **2. Create Provider Component:**
  ```javascript
  // Example: src/utils/UserContext.jsx
  export function UserProvider(props) {
    // props.currentUser could be a signal passed down
    return (
      <UserContext.Provider value={props.currentUser}>
        {props.children}
      </UserContext.Provider>
    );
  }
  ```
  - The `value` provided can be a signal, store, or any JavaScript value.
- **3. Create Custom Hook for Consumption (Recommended):**
  ```javascript
  // Example: src/utils/UserContext.jsx
  export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
      // Optional: throw an error if used outside a provider
      // throw new Error("useUser must be used within a UserProvider");
    }
    return context;
  }
  ```
- **4. Usage in Components:**
  ```javascript
  // Example: src/components/SomeComponent.jsx
  import { useUser } from '../utils/UserContext'; // Adjust path

  function SomeComponent() {
    const currentUserSignal = useUser(); // Returns the signal/value from provider
    // If currentUserSignal is a signal:
    // const user = currentUserSignal();
    // return <div>Hello, {user()?.user_metadata?.name}</div>;

    // If currentUserSignal is a direct value:
    // return <div>Hello, {currentUserSignal?.user_metadata?.name}</div>;
  }
  ```
- **Accessing Signal Values:** If a signal is provided through context, remember to invoke it (e.g., `currentUserSignal()`) to get its current value.
- **Defensive Coding:** Use optional chaining (e.g., `currentUserSignal()?.user_metadata?.some_property`) when accessing nested properties from context values that might be null or undefined.
- *Rationale:* Provides a clean way to share global state or signals across components without prop drilling, improving maintainability.

## Git & Version Control

**Pattern: Standard Git Workflow (Commit & Push)**
1.  **Check Status:** `git status` - Review changes to be committed.
2.  **Stage Changes:** `git add .` (to stage all changes) or `git add <file1> <file2>` (to stage specific files).
3.  **Commit Changes:** `git commit -m "Descriptive commit message"`
    -   *Best Practice for Commit Messages:* Be descriptive. Detail the scope and purpose of changes. For feature additions (e.g., "feat: Add PWA capabilities"), mention key configurations or files involved if concise. For refactors, specify what was refactored (e.g., "refactor: Use Solid.js Context for currentUser").
4.  **Push Changes:** `git push <remote_name> <branch_name>` (e.g., `git push origin main`).
- *Rationale:* Ensures changes are tracked, versioned, and shared with collaborators or backed up remotely.

## Tool Usage & Best Practices

**Reminder: Adherence to Tool XML Schemas**
- Strictly follow the XML schema for each tool, especially for parameters requiring specific structures or wrapper tags.
- Example: For `plan_mode_respond`, ensure the response content is wrapped within `<response>` tags.
- *Rationale:* Prevents tool execution errors and ensures reliable operation.

**Best Practice: `replace_in_file` Usage**
- **Account for Auto-Formatters:** Be aware that auto-formatters might modify files after `write_to_file` or `replace_in_file` (e.g., adding/removing imports, changing formatting). This can affect the accuracy of `SEARCH` blocks in subsequent `replace_in_file` calls.
- **Re-read Modified Files:** Before using `replace_in_file` on a file that might have been recently modified (by you or an auto-formatter), re-read its content using `read_file`. Use this latest content to craft accurate `SEARCH` blocks.
- *Rationale:* Increases the reliability of `replace_in_file` operations by ensuring `SEARCH` blocks match the current file state.

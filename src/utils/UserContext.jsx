import { createContext, useContext } from 'solid-js';

// Create a context for the current user
export const UserContext = createContext();

// Provider component that will wrap the app or parts of it
export function UserProvider(props) {
  // The `currentUser` signal (or any state) will be passed as a prop to UserProvider
  // and then provided to the context.
  // This allows App.jsx to still manage the auth state and signal.
  return (
    <UserContext.Provider value={props.currentUser}>
      {props.children}
    </UserContext.Provider>
  );
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

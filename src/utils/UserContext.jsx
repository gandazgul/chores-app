import { createContext, useContext } from 'react';

// Create a context for the current user
export const UserContext = createContext();

// Provider component that will wrap the app or parts of it
export function UserProvider({ currentUser, children }) {
  // The `currentUser` state will be passed as a prop to UserProvider
  // and then provided to the context.
  // This allows App.jsx to still manage the auth state.
  return (
    <UserContext.Provider value={currentUser}>
      {children}
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

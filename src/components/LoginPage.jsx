import { useState, useEffect } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { app } from '../utils/firebaseConfig';

function LoginPage() {
  const [errorMessage, setErrorMessage] = useState(null);

  // Check if authentication should be skipped for testing
  useEffect(() => {
    if (import.meta.env.VITE_SKIP_AUTH === 'true') {
      console.log('Skipping authentication for testing...');
      // Create a mock user for testing
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null
      };

      // Simulate successful authentication by dispatching a custom event
      // that the UserContext can listen to
      window.dispatchEvent(new CustomEvent('mockAuth', {
        detail: { user: mockUser }
      }));
    }
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      // The signed-in user info.
      const user = result.user;
      console.log("Logged in user (Firebase):", user);
      // You can now update your app's state with the user info.
    } catch (error) {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessageText = error.message;
      // The email of the user's account used.
      const email = error.customData ? error.customData.email : 'N/A';
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Firebase Login Error:", { errorCode, errorMessage: errorMessageText, email, credential });
      setErrorMessage(`Login failed: ${errorMessageText}`);
    }
  };

  // Don't render login UI if authentication is being skipped
  if (import.meta.env.VITE_SKIP_AUTH === 'true') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h2>Authenticating for tests...</h2>
        <p>Bypassing login for testing mode</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h2>Login to Chores App</h2>
      <button onClick={handleGoogleLogin} className="button">
        Sign in with Google
      </button>
      {errorMessage && (
        <p style={{ color: 'red', marginTop: '1rem' }}>{errorMessage}</p>
      )}
    </div>
  );
}

export default LoginPage;

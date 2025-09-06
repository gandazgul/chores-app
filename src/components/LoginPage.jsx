import { createSignal } from 'solid-js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { app } from '../utils/firebaseConfig';

function LoginPage() {
  const [errorMessage, setErrorMessage] = createSignal(null);

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
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.customData ? error.customData.email : 'N/A';
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Firebase Login Error:", { errorCode, errorMessage, email, credential });
      setErrorMessage(`Login failed: ${errorMessage}`);
    }
  };

  return (
    <div style={{ display: 'flex', "flex-direction": 'column', "align-items": 'center', "justify-content": 'center', height: '100vh' }}>
      <h2>Login to Chores App</h2>
      <button onClick={handleGoogleLogin} class="button">
        Sign in with Google
      </button>
      {errorMessage() && (
        <p style={{ color: 'red', "margin-top": '1rem' }}>{errorMessage()}</p>
      )}
    </div>
  );
}

export default LoginPage;

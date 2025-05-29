import { createSignal } from 'solid-js';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from '../utils/firebaseConfig'; // Assuming firebaseConfig.js is in src/utils

function LoginPage() {
  const [errorMessage, setErrorMessage] = createSignal(null);

  const handleGoogleLogin = async () => {
    setErrorMessage(null); // Clear previous error on new attempt
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken; // Optional chaining for safety
      // The signed-in user info.
      const user = result.user;
      console.log("Logged in user:", user);
      // In SolidJS, navigation or UI updates would typically be handled by signals or router context
    } catch (error) {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.customData?.email;
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Login Error:", errorCode, errorMessage, email, credential);
      setErrorMessage("Login failed. Please try again.");
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

import { createSignal } from 'solid-js';
import { supabase } from '../utils/supabaseConfig'; // Import Supabase client

function LoginPage() {
  const [errorMessage, setErrorMessage] = createSignal(null);

  const handleGoogleLogin = async () => {
    setErrorMessage(null); // Clear previous error on new attempt
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Optional: redirectTo can be used to specify where the user should be redirected after login.
          // redirectTo: window.location.origin, 
        }
      });

      if (error) {
        console.error("Supabase Login Error:", error.message);
        setErrorMessage(`Login failed: ${error.message}. Please try again.`);
        return;
      }

      // signInWithOAuth redirects the user to Google and then back to your app.
      // The session is established on redirect. You might not get user data immediately here
      // unless you handle the redirect and session retrieval in App.jsx or a similar top-level component.
      // For now, we can log the data if available, but actual user state management will be in App.jsx.
      if (data && data.user) {
        console.log("Logged in user (Supabase):", data.user);
      } else if (data && data.url) {
        // If a URL is returned, it means Supabase is redirecting.
        // The browser will handle this redirect.
        console.log("Redirecting to Google for OAuth...");
      }

    } catch (error) {
      console.error("Unexpected Login Error:", error);
      setErrorMessage("An unexpected error occurred during login. Please try again.");
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

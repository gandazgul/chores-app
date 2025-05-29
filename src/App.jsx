import { createSignal, createEffect, onCleanup, Show, onMount } from 'solid-js';
import Chores from './components/Chores';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout'; // Import the new Layout component
import { supabase } from './utils/supabaseConfig'; // Import Supabase client
import { UserProvider } from './utils/UserContext'; // Import UserProvider
// Removed library import for fontawesome as it's not directly used here anymore

import '@picocss/pico';
import './App.less';

function App() {
    const [currentUser, setCurrentUser] = createSignal(null);
    const [loadingAuth, setLoadingAuth] = createSignal(true);

    onMount(async () => {
        setLoadingAuth(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error("Error getting initial session:", error.message);
        }
        setCurrentUser(session?.user ?? null);
        setLoadingAuth(false);

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth event:", event, "Session:", session);
            setCurrentUser(session?.user ?? null);
            // If the user signs in or out, loading should be false.
            // If it's an initial session check, it might already be handled by getSession.
            // However, if a token refresh happens or user is updated, we might want to reflect that.
            // For simplicity, we'll assume loadingAuth is primarily for the initial check.
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
                setLoadingAuth(false);
            }
        });

        onCleanup(() => {
            if (authListener && typeof authListener.unsubscribe === 'function') {
                authListener.unsubscribe();
            } else if (authListener && authListener.subscription && typeof authListener.subscription.unsubscribe === 'function') {
                // Handle potential older structure if needed, though current Supabase JS v2 uses { data: { subscription } }
                authListener.subscription.unsubscribe();
            }
        });
    });

    return (
        <div class="app">
            <Show when={!loadingAuth()} fallback={<p>Loading application...</p>}>
                {currentUser() ? (
                    <UserProvider currentUser={currentUser}>
                        <Layout> {/* Remove currentUser prop */}
                            <Chores /> {/* Remove currentUser prop */}
                        </Layout>
                    </UserProvider>
                ) : (
                    <LoginPage />
                )}
            </Show>
        </div>
    );
}

export default App;

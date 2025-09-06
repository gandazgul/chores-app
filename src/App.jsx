import { createSignal, createEffect, onCleanup, Show, onMount } from 'solid-js';
import Chores from './components/Chores';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout'; // Import the new Layout component
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from './utils/firebaseConfig';
import { UserProvider } from './utils/UserContext'; // Import UserProvider
// Removed library import for fontawesome as it's not directly used here anymore

import '@picocss/pico';
import './App.less';

function App() {
    const [currentUser, setCurrentUser] = createSignal(null);
    const [loadingAuth, setLoadingAuth] = createSignal(true);

    onMount(() => {
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });

        onCleanup(() => unsubscribe());
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

import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import Chores from './components/Chores';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout'; // Import the new Layout component
import { auth } from './utils/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
// Removed library import for fontawesome as it's not directly used here anymore

import '@picocss/pico';
import './App.less';

function App() {
    const [currentUser, setCurrentUser] = createSignal(null);
    // showProfileMenu logic is now in Layout.jsx
    // const [showProfileMenu, setShowProfileMenu] = createSignal(false); 
    const [loadingAuth, setLoadingAuth] = createSignal(true); 

    createEffect(() => {
        setLoadingAuth(true);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        onCleanup(() => unsubscribe());
    });

    // Profile menu click outside logic moved to Layout.jsx

    return (
        <div class="app">
            <Show when={!loadingAuth()} fallback={<p>Loading application...</p>}>
                {currentUser() ? (
                    <Layout currentUser={currentUser}> {/* Pass currentUser to Layout */}
                        <Chores />
                    </Layout>
                ) : (
                    <LoginPage />
                )}
            </Show>
        </div>
    );
}

export default App;

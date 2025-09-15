import { useState, useEffect } from 'react';
import Chores from './components/Chores';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from './utils/firebaseConfig';
import { UserProvider } from './utils/UserContext';

import '@picocss/pico';
import './App.less';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });

        // Listen for mock authentication events (for testing)
        const handleMockAuth = (event) => {
            console.log('Mock auth event received:', event.detail.user);
            setCurrentUser(event.detail.user);
            setLoadingAuth(false);
        };

        window.addEventListener('mockAuth', handleMockAuth);

        // If skip auth is enabled, immediately set loading to false and mock user
        if (import.meta.env.VITE_SKIP_AUTH === 'true') {
            setCurrentUser({ uid: 'test-user-123', email: 'test@example.com' });
            setLoadingAuth(false);
        }

        return () => {
            unsubscribe();
            window.removeEventListener('mockAuth', handleMockAuth);
        };
    }, []);

    if (loadingAuth) {
        return <p>Loading application...</p>;
    }

    return (
        <div className="app">
            {currentUser ? (
                <UserProvider currentUser={currentUser}>
                    <Layout>
                        <Chores />
                    </Layout>
                </UserProvider>
            ) : (
                <LoginPage />
            )}
        </div>
    );
}

export default App;

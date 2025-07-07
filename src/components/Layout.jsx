import { createSignal, createEffect, onCleanup, Show, useContext } from 'solid-js'; // Added useContext, though useUser hook is preferred
import { supabase } from '../utils/supabaseConfig'; // Import Supabase client
import { useUser } from '../utils/UserContext'; // Import useUser
import { getAuth, signInAnonymously } from 'firebase/auth';
import { requestNotificationPermissionAndToken, saveFCMTokenToSupabase } from '../utils/pushNotifications.js';
import './Layout.less'; // Import specific styles

function Layout(props) { // props might still contain children
    const currentUser = useUser(); // Get the currentUser signal from context
    const [showProfileMenu, setShowProfileMenu] = createSignal(false);

    const handleEnableNotifications = async () => {
        if (!currentUser()?.id) {
            alert("You must be logged in to enable notifications.");
            return;
        }
        try {
            // const auth = getAuth();
            // await signInAnonymously(auth);
            
            const token = await requestNotificationPermissionAndToken();
            if (token) {
                const result = await saveFCMTokenToSupabase(currentUser().id, token);
                if (result) {
                    alert('Notifications enabled successfully!');
                } else {
                    alert('Failed to save notification preferences. Please try again.');
                }
            } else {
                // User denied permission or an error occurred
                alert('Notification permission was not granted or an error occurred.');
            }
        } catch (error) {
            console.error("Error enabling notifications:", error);
            alert('An error occurred while enabling notifications.');
        }
        setShowProfileMenu(false); // Close menu
    };

    // Close profile menu if clicked outside
    createEffect(() => {
        if (showProfileMenu()) {
            const handleClickOutside = (event) => {
                if (!event.target.closest('.profile-menu-container') && !event.target.closest('.profile-picture')) {
                    setShowProfileMenu(false);
                }
            };
            document.addEventListener('click', handleClickOutside);
            onCleanup(() => document.removeEventListener('click', handleClickOutside));
        }
    });

    return (
        <>
            <header>
                <div class="header-content">
                    <h1>Chores</h1>
                    <Show when={currentUser()}>
                        <div class="profile-menu-container">
                            <img
                                src={currentUser()?.user_metadata?.avatar_url || currentUser()?.user_metadata?.picture || 'https://via.placeholder.com/40'}
                                alt="Profile"
                                class="profile-picture"
                                onClick={() => setShowProfileMenu(!showProfileMenu())}
                            />
                            <Show when={showProfileMenu()}>
                                <div class="profile-menu">
                                    <button onClick={handleEnableNotifications}>Enable Notifications</button>
                                    <button onClick={async () => {
                                        const { error } = await supabase.auth.signOut();
                                        if (error) {
                                            console.error("Error logging out:", error.message);
                                        }
                                        setShowProfileMenu(false); // Close menu on logout
                                    }}>Logout</button>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </header>
            <main class="content container-fluid">
                {props.children}
            </main>
            <footer>
                <p>© {new Date().getFullYear()} Chores App</p>
            </footer>
        </>
    );
}

export default Layout;

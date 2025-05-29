import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { supabase } from '../utils/supabaseConfig'; // Import Supabase client
import './Layout.less'; // Import specific styles

function Layout(props) {
    const [showProfileMenu, setShowProfileMenu] = createSignal(false);

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
                    <Show when={props.currentUser()}>
                        <div class="profile-menu-container">
                            <img
                                src={props.currentUser().user_metadata?.avatar_url || props.currentUser().user_metadata?.picture || 'https://via.placeholder.com/40'}
                                alt="Profile"
                                class="profile-picture"
                                onClick={() => setShowProfileMenu(!showProfileMenu())}
                            />
                            <Show when={showProfileMenu()}>
                                <div class="profile-menu">
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

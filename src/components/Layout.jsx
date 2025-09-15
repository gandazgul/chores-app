import { useState, useEffect, useRef } from 'react';
import { useUser } from '../utils/UserContext';
import { getAuth } from 'firebase/auth';
import { requestNotificationPermissionAndToken, saveFCMToken } from '../utils/pushNotifications.js';
import './Layout.less';

function Layout({ children }) {
    const currentUser = useUser();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);

    const handleEnableNotifications = async () => {
        if (!currentUser?.id) {
            alert("You must be logged in to enable notifications.");
            return;
        }
        try {
            const token = await requestNotificationPermissionAndToken();
            if (token) {
                const result = await saveFCMToken(currentUser.uid, token);
                if (result) {
                    alert('Notifications enabled successfully!');
                } else {
                    alert('Failed to save notification preferences. Please try again.');
                }
            } else {
                alert('Notification permission was not granted or an error occurred.');
            }
        } catch (error) {
            console.error("Error enabling notifications:", error);
            alert('An error occurred while enabling notifications.');
        }
        setShowProfileMenu(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target) && !event.target.closest('.profile-picture')) {
                setShowProfileMenu(false);
            }
        };

        if (showProfileMenu) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showProfileMenu]);

    return (
        <>
            <header>
                <div className="header-content">
                    <h1>Chores</h1>
                    {currentUser && (
                        <div className="profile-menu-container" ref={profileMenuRef}>
                            <img
                                src={currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture || 'https://picsum.photos/40'}
                                alt="Profile"
                                className="profile-picture"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                            />
                            {showProfileMenu && (
                                <div className="profile-menu">
                                    <button onClick={handleEnableNotifications}>Enable Notifications</button>
                                    <button onClick={async () => {
                                        const auth = getAuth();
                                        try {
                                            await auth.signOut();
                                        } catch (error) {
                                            console.error("Error logging out:", error.message);
                                        }
                                        setShowProfileMenu(false);
                                    }}>Logout</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>
            <main className="content container-fluid">
                {children}
            </main>
            <footer>
                <p>© {new Date().getFullYear()} Chores App</p>
            </footer>
        </>
    );
}

export default Layout;

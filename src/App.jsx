import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';
import Chores from './components/Chores';
import AddChoreModal from './components/AddChoreModal';
import AddChoreFloatButton from './components/AddChoreFloatButton';
import LoginPage from './components/LoginPage'; // Import LoginPage
import { auth } from './utils/firebaseConfig'; // Import auth from firebaseConfig
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { jsToday, todayStartAdapter, todayEndAdapter, isSameDateAdapterDay, isChoreForToday, getEffectiveDueDate, choreSortFn } from './utils/scheduleUtils.js'; // Import utils
import { initializeFuzzySearch, fuzzySearchChores } from './utils/fuzzySearchUtils.js';
import { StandardDateAdapter, Rule } from './rschedule.js'; // Rule is used in utils.js and now here
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

import '@picocss/pico';
import './App.less'; // Import App.less

library.add(faPaperPlane); // Add the paper plane icon to the library

// Initial chores data (lifted from Chores.jsx)
const initialChores = [
    {
        title: 'Take out the trash (Recurring Weekly)',
        description: 'Take out the trash, it stinks!',
        priority: 2,
        remindUntilDone: true,
        recurrence: {
            frequency: 'WEEKLY',
            start: new StandardDateAdapter(new Date(2024, 0, 1, 8, 0, 0)), 
            byDayOfWeek: ['TU'],
        }
    },
    {
        title: 'Feed the dogs (No Due Date)',
        description: 'They are hungry.',
        priority: 1,
    },
    {
        title: 'Call John - Due Today',
        description: 'Discuss project updates.',
        priority: 1,
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 14, 0, 0)
    },
    {
        title: 'Prepare presentation - Due Tomorrow',
        description: 'For the team meeting.',
        priority: 2,
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate() + 1, 10, 0, 0)
    },
    {
        title: 'Morning Standup (Recurring Daily)',
        description: 'Quick sync with the team.',
        priority: 3,
        recurrence: {
            frequency: 'DAILY',
            start: new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 9, 0, 0)), 
            count: 10,
        }
    },
    {
        title: 'Water plants - Done',
        description: 'They were thirsty.',
        priority: 4,
        done: true,
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate() -1, 12, 0, 0)
    },
    {
        title: 'Pay Bills (Recurring Monthly)',
        description: 'Monthly bills payment',
        priority: 1,
        recurrence: {
            frequency: 'MONTHLY',
            start: new StandardDateAdapter(new Date(2024, 0, 15, 10, 0, 0)), 
            byMonthDay: [15],
        }
    }
];

function App() {
    const [chores, setChores] = createSignal(initialChores);
    const [newChoreModalOpen, setNewChoreModalOpen] = createSignal(false);
    const [quickChoreTitle, setQuickChoreTitle] = createSignal('');
    const [fuse, setFuse] = createSignal(null);
    const [currentUser, setCurrentUser] = createSignal(null); // Signal for current user
    const [showProfileMenu, setShowProfileMenu] = createSignal(false); // New signal for profile menu visibility

    // Listen for auth state changes
    createEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        // Cleanup subscription on component unmount
        onCleanup(() => unsubscribe());
    });

    // Close profile menu if clicked outside
    createEffect(() => {
        if (showProfileMenu()) {
            const handleClickOutside = (event) => {
                if (!event.target.closest('.profile-menu-container')) {
                    setShowProfileMenu(false);
                }
            };
            document.addEventListener('click', handleClickOutside);
            onCleanup(() => document.removeEventListener('click', handleClickOutside));
        }
    });

    createEffect(() => {
        // Ensure chores() is accessed to trigger effect on change
        const currentChores = chores();
        setFuse(initializeFuzzySearch([...currentChores], ['title', 'description']));
    });

    const displayedChores = createMemo(() => {
        const searchTerm = quickChoreTitle();
        const currentFuse = fuse(); // Access fuse signal
        if (searchTerm.trim() === '' || !currentFuse) {
            return chores();
        }
        return fuzzySearchChores(currentFuse, searchTerm);
    });

    // Chore manipulation functions
    function handleChoreDone(e) {
        const choreTitle = e.target.dataset.choreTitle;
        setChores((prevChores) => prevChores.map((chore) => {
            if (chore.title === choreTitle) {
                return { ...chore, done: e.target.checked };
            }
            return chore;
        }));
    }

    function handleDeleteChore(choreToDelete) {
        setChores((currentChores) => currentChores.filter(chore => chore.title !== choreToDelete.title));
    }

    function handleAddNewChore(newChoreFromModal) {
        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
        };

        if (newChoreFromModal.schedule) {
            if (newChoreFromModal.schedule instanceof Rule) {
                choreToAdd.recurrence = newChoreFromModal.schedule;
            } else if (typeof newChoreFromModal.schedule === 'string' && newChoreFromModal.schedule.trim() !== '') {
                choreToAdd.dueDate = new Date(newChoreFromModal.schedule);
            }
        }
        
        setChores((prevChores) => [...prevChores, choreToAdd]);
        setNewChoreModalOpen(false); // Close modal after adding
    }

    // Modal control functions
    function handleAddChoreClick() {
        setNewChoreModalOpen(true);
    }

    function handleAddChoreClose() {
        setNewChoreModalOpen(false);
    }

    function handleQuickAddChore(e) {
        if (e) e.preventDefault(); // Prevent default form submission
        const title = quickChoreTitle().trim();
        if (title) {
            const newChore = {
                title: title,
                description: '', // Default empty description
                priority: 4,    // Default low priority
                done: false,
            };
            setChores((prevChores) => [...prevChores, newChore]);
            setQuickChoreTitle(''); // Clear the input field
        }
    }

console.log('Current user:', currentUser()); // Log current user for debugging

    return (
        <div class="app">
            {currentUser() ? (
                <>
                    <header>
                        <div class="header-content">
                            <h1>Chores</h1>
                            <div class="profile-menu-container">
                                <img
                                    src={currentUser().photoURL || 'https://via.placeholder.com/40'} // Placeholder image
                                    alt="Profile"
                                    class="profile-picture"
                                    onClick={() => setShowProfileMenu(!showProfileMenu())}
                                />
                                <Show when={showProfileMenu()}>
                                    <div class="profile-menu">
                                        <button onClick={() => auth.signOut()}>Logout</button>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </header>
                    <main class="content container-fluid">
                        <ul class="instructions">
                            <li>This is a list of chores split into ones that need to be done today and the rest.</li>
                            <li>If you see something that you can do, assign it to youself and get it done.</li>
                            <li>If you see something that has been done already, please mark it as done.</li>
                            <li>Reminders for chores will continuously be sent out until they are marked as done.</li>
                        </ul>
                        <form onSubmit={handleQuickAddChore} class="quick-add-form">
                            <input
                                class="input"
                                type="text"
                                placeholder="Search chores or add new and press Enter..."
                                value={quickChoreTitle()}
                                onInput={(e) => setQuickChoreTitle(e.target.value)}
                                aria-label="Search chores or add new chore title"
                            />
                            <button type="submit" class="outline submit" title="Add chore">
                                <FontAwesomeIcon icon={faPaperPlane} />
                            </button>
                        </form>
                        <Chores
                            chores={displayedChores()}
                            onChoreDone={handleChoreDone}
                            onDeleteChore={handleDeleteChore}
                            // Utility functions needed by Chores for filtering/sorting
                            isChoreForToday={isChoreForToday}
                            choreSortFn={choreSortFn}
                        />
                    </main>
                    <footer>
                        <p>© {new Date().getFullYear()} Chores</p>
                    </footer>
                    <AddChoreModal
                        open={newChoreModalOpen}
                        onClose={handleAddChoreClose}
                        onAddNewChore={handleAddNewChore}
                    />
                    <AddChoreFloatButton onClick={handleAddChoreClick} />
                </>
            ) : (
                <LoginPage />
            )}
        </div>
    )
}

export default App

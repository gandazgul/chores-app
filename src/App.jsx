import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';
import Chores from './components/Chores';
import AddChoreModal from './components/AddChoreModal';
import AddChoreFloatButton from './components/AddChoreFloatButton';
import LoginPage from './components/LoginPage';
import { auth, db } from './utils/firebaseConfig'; // Import db
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp, writeBatch } from 'firebase/firestore'; // Import Firestore functions
import { jsToday, isChoreForToday, getEffectiveDueDate, choreSortFn } from './utils/scheduleUtils.js';
import { initializeFuzzySearch, fuzzySearchChores } from './utils/fuzzySearchUtils.js';
import { StandardDateAdapter, Rule } from './rschedule.js';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

import '@picocss/pico';
import './App.less';

library.add(faPaperPlane);

function App() {
    const [chores, setChores] = createSignal([]);
    const [newChoreModalOpen, setNewChoreModalOpen] = createSignal(false);
    const [quickChoreTitle, setQuickChoreTitle] = createSignal('');
    const [fuse, setFuse] = createSignal(null);
    const [currentUser, setCurrentUser] = createSignal(null);
    const [showProfileMenu, setShowProfileMenu] = createSignal(false);
    const [loadingChores, setLoadingChores] = createSignal(true);

    const choresCollectionRef = collection(db, "chores");

    // Function to convert Firestore Timestamps to JS Dates and rSchedule Dates
    const convertChoreFromFirestore = (choreData) => {
        const chore = { ...choreData };
        if (chore.dueDate && chore.dueDate.toDate) {
            chore.dueDate = chore.dueDate.toDate();
        }
        if (chore.recurrence && chore.recurrence.start && chore.recurrence.start.toDate) {
            chore.recurrence.start = new StandardDateAdapter(chore.recurrence.start.toDate());
        }
        return chore;
    };

    // Function to convert JS Dates and rSchedule Dates to Firestore Timestamps
    const convertChoreToFirestore = (choreData) => {
        const chore = { ...choreData };
        if (chore.dueDate && chore.dueDate instanceof Date) {
            chore.dueDate = Timestamp.fromDate(chore.dueDate);
        }
        if (chore.recurrence && chore.recurrence.start && chore.recurrence.start instanceof StandardDateAdapter) {
            // rSchedule StandardDateAdapter stores date in _date property
            chore.recurrence.start = Timestamp.fromDate(chore.recurrence.start._date);
        }
        // Remove id if it exists, as Firestore generates it
        delete chore.id;
        return chore;
    };
    
    // Listen for auth state changes
    createEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                setLoadingChores(true);
                // Fetch chores for the logged-in user
                const q = query(choresCollectionRef, where("userId", "==", user.uid));
                try {
                    const querySnapshot = await getDocs(q);
                    const fetchedChores = querySnapshot.docs.map(doc => ({ ...convertChoreFromFirestore(doc.data()), id: doc.id }));
                    setChores(fetchedChores);
                } catch (error) {
                    console.error("Error fetching chores: ", error);
                } finally {
                    setLoadingChores(false);
                }
            } else {
                setChores([]); // Clear chores if user logs out
                setLoadingChores(false);
            }
        });
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
        const currentChores = chores();
        setFuse(initializeFuzzySearch([...currentChores], ['title', 'description']));
    });

    const displayedChores = createMemo(() => {
        const searchTerm = quickChoreTitle();
        const currentFuse = fuse();
        if (searchTerm.trim() === '' || !currentFuse) {
            return chores();
        }
        return fuzzySearchChores(currentFuse, searchTerm);
    });

    async function handleChoreDone(e) {
        const choreId = e.target.dataset.choreId; // Assuming chore.id is available
        const isDone = e.target.checked;
        try {
            const choreDocRef = doc(db, "chores", choreId);
            await updateDoc(choreDocRef, { done: isDone });
            setChores((prevChores) => prevChores.map((chore) => {
                if (chore.id === choreId) {
                    return { ...chore, done: isDone };
                }
                return chore;
            }));
        } catch (error) {
            console.error("Error updating chore: ", error);
        }
    }

    async function handleDeleteChore(choreToDelete) {
        try {
            const choreDocRef = doc(db, "chores", choreToDelete.id);
            await deleteDoc(choreDocRef);
            setChores((currentChores) => currentChores.filter(chore => chore.id !== choreToDelete.id));
        } catch (error) {
            console.error("Error deleting chore: ", error);
        }
    }

    async function handleAddNewChore(newChoreFromModal) {
        if (!currentUser()) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
            userId: currentUser().uid, // Add userId
        };

        if (newChoreFromModal.schedule) {
            if (newChoreFromModal.schedule instanceof Rule) {
                choreToAdd.recurrence = newChoreFromModal.schedule;
            } else if (typeof newChoreFromModal.schedule === 'string' && newChoreFromModal.schedule.trim() !== '') {
                choreToAdd.dueDate = new Date(newChoreFromModal.schedule);
            }
        }
        
        try {
            const docRef = await addDoc(choresCollectionRef, convertChoreToFirestore(choreToAdd));
            setChores((prevChores) => [...prevChores, { ...convertChoreFromFirestore(choreToAdd), id: docRef.id }]);
            setNewChoreModalOpen(false);
        } catch (error) {
            console.error("Error adding new chore: ", error);
        }
    }

    function handleAddChoreClick() {
        setNewChoreModalOpen(true);
    }

    function handleAddChoreClose() {
        setNewChoreModalOpen(false);
    }

    async function handleQuickAddChore(e) {
        if (e) e.preventDefault();
        if (!currentUser()) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const title = quickChoreTitle().trim();
        if (title) {
            const newChore = {
                title: title,
                description: '',
                priority: 4,
                done: false,
                userId: currentUser().uid, // Add userId
            };
            try {
                const docRef = await addDoc(choresCollectionRef, convertChoreToFirestore(newChore));
                setChores((prevChores) => [...prevChores, { ...convertChoreFromFirestore(newChore), id: docRef.id }]);
                setQuickChoreTitle('');
            } catch (error) {
                console.error("Error quick adding chore: ", error);
            }
        }
    }

    return (
        <div class="app">
            {currentUser() ? (
                <>
                    <header>
                        <div class="header-content">
                            <h1>Chores</h1>
                            <div class="profile-menu-container">
                                <img
                                    src={currentUser().photoURL || 'https://via.placeholder.com/40'}
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
                        <Show when={!loadingChores()} fallback={<p>Loading chores...</p>}>
                            <Chores
                                chores={displayedChores()}
                                onChoreDone={handleChoreDone}
                                onDeleteChore={handleDeleteChore}
                                isChoreForToday={isChoreForToday}
                                choreSortFn={choreSortFn}
                            />
                        </Show>
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

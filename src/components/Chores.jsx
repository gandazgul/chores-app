import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';
import ChoresList from './ChoresList'; // Renamed from Chores
import AddChoreModal from './AddChoreModal';
import AddChoreFloatButton from './AddChoreFloatButton';
import { db, auth } from '../utils/firebaseConfig'; // Adjusted path
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp, writeBatch } from 'firebase/firestore';
import { jsToday, isChoreForToday, getEffectiveDueDate, choreSortFn } from '../utils/scheduleUtils.js'; // Adjusted path
import { initializeFuzzySearch, fuzzySearchChores } from '../utils/fuzzySearchUtils.js'; // Adjusted path
import { StandardDateAdapter, Rule } from '../rschedule.js'; // Adjusted path
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

// Assuming App.less might contain styles relevant here, or a new Chores.less would be created.
// For now, let's assume App.less is global enough or specific styles will be moved.
import '../App.less'; // Adjusted path

library.add(faPaperPlane);

function Chores() {
    const [chores, setChores] = createSignal([]);
    const [newChoreModalOpen, setNewChoreModalOpen] = createSignal(false);
    const [quickChoreTitle, setQuickChoreTitle] = createSignal('');
    const [fuse, setFuse] = createSignal(null);
    const [loadingChores, setLoadingChores] = createSignal(true);
    // currentUser will be passed as a prop or accessed via a global store if needed.
    // For this refactor, assuming currentUser is available (e.g., passed as prop or from context)
    // Let's assume it's passed as a prop for now.
    // const [currentUser, setCurrentUser] = createSignal(auth.currentUser); // Simplified for component context

    // Props would include currentUser if passed from App.jsx
    // For now, directly using auth.currentUser for simplicity in this isolated component.
    // A more robust solution might involve a Solid store or context for auth state.
    const currentUser = () => auth.currentUser;


    const choresCollectionRef = collection(db, "chores");

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

    const convertChoreToFirestore = (choreData) => {
        const chore = { ...choreData };
        if (chore.dueDate && chore.dueDate instanceof Date) {
            chore.dueDate = Timestamp.fromDate(chore.dueDate);
        }
        if (chore.recurrence && chore.recurrence.start && chore.recurrence.start instanceof StandardDateAdapter) {
            chore.recurrence.start = Timestamp.fromDate(chore.recurrence.start._date);
        }
        delete chore.id;
        return chore;
    };

    createEffect(() => {
        const user = currentUser();
        if (user) {
            setLoadingChores(true);
            const q = query(choresCollectionRef, where("userId", "==", user.uid));
            const unsubscribe = getDocs(q) // This should be onSnapshot for real-time updates
                .then(querySnapshot => {
                    const fetchedChores = querySnapshot.docs.map(doc => ({ ...convertChoreFromFirestore(doc.data()), id: doc.id }));
                    setChores(fetchedChores);
                })
                .catch(error => {
                    console.error("Error fetching chores: ", error);
                })
                .finally(() => {
                    setLoadingChores(false);
                });
            // onCleanup for onSnapshot, not directly applicable for one-time getDocs
            // If using onSnapshot, it would return an unsubscribe function.
        } else {
            setChores([]);
            setLoadingChores(false);
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
        const choreId = e.target.dataset.choreId;
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
        const user = currentUser();
        if (!user) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
            userId: user.uid,
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
        const user = currentUser();
        if (!user) {
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
                userId: user.uid,
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
        <>
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
                <ChoresList
                    chores={displayedChores()}
                    onChoreDone={handleChoreDone}
                    onDeleteChore={handleDeleteChore}
                    isChoreForToday={isChoreForToday}
                    choreSortFn={choreSortFn}
                />
            </Show>
            {/* </main> */}
            <AddChoreModal
                open={newChoreModalOpen}
                onClose={handleAddChoreClose}
                onAddNewChore={handleAddNewChore}
            />
            <AddChoreFloatButton onClick={handleAddChoreClick} />
        </>
    );
}

export default Chores;

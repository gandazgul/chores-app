import { createSignal, createMemo, createEffect, onCleanup, Show, useContext } from 'solid-js'; // Added useContext, though useUser hook is preferred
import { useUser } from '../utils/UserContext';
import ChoresList from './ChoresList';
import AddChoreModal from './AddChoreModal';
import AddChoreFloatButton from './AddChoreFloatButton';
import db from '../utils/db';
import { today, isChoreForToday, getEffectiveDueDate, choreSortFn } from '../utils/scheduleUtils.js';
import { initializeFuzzySearch, fuzzySearchChores } from '../utils/fuzzySearchUtils.js';
// Removed rschedule import, dayspan is used within scheduleUtils.js
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

// For now, let's assume App.less is global enough or specific styles will be moved.
import './Chores.less'; // Import specific styles

library.add(faPaperPlane);

// currentUser will be accessed via context
function Chores() { // Removed props
    const currentUser = useUser(); // Get the currentUser signal from context
    const [chores, setChores] = createSignal([]);
    const [newChoreModalOpen, setNewChoreModalOpen] = createSignal(false);
    const [quickChoreTitle, setQuickChoreTitle] = createSignal('');
    const [fuse, setFuse] = createSignal(null);
    const [loadingChores, setLoadingChores] = createSignal(true);
    // currentUser will be passed as a prop or accessed via a global store if needed.
    // For this refactor, assuming currentUser is available (e.g., passed as prop or from context)
    // const currentUserSignal = () => auth.currentUser; // Comment can be removed or updated

    createEffect(async () => {
        const user = currentUser();
        if (user && user.uid) {
            setLoadingChores(true);
            try {
                const choresData = await db('chores').where('user_id', user.uid);
                setChores(choresData);
            } catch (e) {
                console.error("Exception fetching chores:", e);
                setChores([]);
            } finally {
                setLoadingChores(false);
            }
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
            await db('chores').where('id', choreId).update({ done: isDone });
            setChores((prevChores) => prevChores.map((chore) => {
                if (chore.id === choreId) {
                    return { ...chore, done: isDone };
                }
                return chore;
            }));
        } catch (err) {
            console.error("Exception updating chore:", err);
            e.target.checked = !isDone;
        }
    }

    async function handleDeleteChore(choreToDelete) {
        try {
            await db('chores').where('id', choreToDelete.id).del();
            setChores((currentChores) => currentChores.filter(chore => chore.id !== choreToDelete.id));
        } catch (err) {
            console.error("Exception deleting chore:", err);
        }
    }

    async function handleAddNewChore(newChoreFromModal) {
        const user = currentUser();
        if (!user || !user.uid) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
            user_id: user.uid,
            due_date: newChoreFromModal.schedule instanceof Date ? newChoreFromModal.schedule.toISOString() : null,
            recurrence: typeof newChoreFromModal.schedule === 'object' && newChoreFromModal.schedule !== null ? newChoreFromModal.schedule : null,
        };

        try {
            const [newChore] = await db('chores').insert(choreToAdd).returning('*');
            setChores((prevChores) => [...prevChores, newChore]);
            setNewChoreModalOpen(false);
        } catch (err) {
            console.error("Exception adding new chore:", err);
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
        if (!user || !user.uid) {
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
                user_id: user.uid,
            };
            try {
                const [addedChore] = await db('chores').insert(newChore).returning('*');
                setChores((prevChores) => [...prevChores, addedChore]);
                setQuickChoreTitle('');
            } catch (err) {
                console.error("Exception quick adding chore:", err);
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

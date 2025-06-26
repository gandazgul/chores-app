import { createSignal, createMemo, createEffect, onCleanup, Show, useContext } from 'solid-js'; // Added useContext, though useUser hook is preferred
import { useUser } from '../utils/UserContext'; // Import useUser
import ChoresList from './ChoresList'; // Renamed from Chores
import AddChoreModal from './AddChoreModal';
import AddChoreFloatButton from './AddChoreFloatButton';
import { supabase } from '../utils/supabaseConfig'; // Import Supabase client
import { jsToday, isChoreForToday, getEffectiveDueDate, choreSortFn } from '../utils/scheduleUtils.js'; // Adjusted path
import { initializeFuzzySearch, fuzzySearchChores } from '../utils/fuzzySearchUtils.js'; // Adjusted path
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

    // No longer need choresCollectionRef for Supabase in this way
    // const choresCollectionRef = collection(db, "chores"); 

    const convertChoreFromSupabase = (choreData) => {
        const chore = { ...choreData };
        if (chore.due_date) { // Supabase columns are typically snake_case
            chore.dueDate = new Date(chore.due_date);
            delete chore.due_date; // Clean up original snake_case field
        }
        if (chore.recurrence && typeof chore.recurrence.start === 'string') {
            // Convert recurrence.start from ISO string to JS Date object
            chore.recurrence.start = new Date(chore.recurrence.start);
        }
        // user_id is already in choreData from Supabase, no specific conversion needed here for it
        // created_at and updated_at are also available
        return chore;
    };

    const convertChoreToSupabase = (choreData) => {
        const chore = { ...choreData };
        if (chore.dueDate && chore.dueDate instanceof Date) {
            chore.due_date = chore.dueDate.toISOString(); // Convert to ISO string for Supabase
            delete chore.dueDate;
        }
        if (chore.recurrence && chore.recurrence.start && chore.recurrence.start instanceof Date) {
            // Ensure recurrence.start (which is a JS Date) is an ISO string for JSONB
            chore.recurrence.start = chore.recurrence.start.toISOString();
        }
        // Ensure user_id is present if it's coming from a different source name
        if (chore.userId && !chore.user_id) {
            chore.user_id = chore.userId;
            delete chore.userId;
        }
        // id is handled by Supabase, no need to delete it before insert
        // For updates, id is used in the .eq() clause
        return chore;
    };

    createEffect(async () => {
        const user = currentUser(); // Use context
        if (user && user.id) { // Supabase user object has `id`
            setLoadingChores(true);
            try {
                const { data, error } = await supabase
                    .from('chores')
                    .select('*')
                    .eq('user_id', user.id);

                if (error) {
                    console.error("Error fetching chores:", error.message);
                    setChores([]);
                } else {
                    const fetchedChores = data.map(chore => convertChoreFromSupabase(chore));
                    setChores(fetchedChores);
                }
            } catch (e) {
                console.error("Exception fetching chores:", e);
                setChores([]);
            } finally {
                setLoadingChores(false);
            }
        } else {
            setChores([]); // Clear chores if no user
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
            const { error } = await supabase
                .from('chores')
                .update({ done: isDone, updated_at: new Date().toISOString() })
                .eq('id', choreId);

            if (error) {
                console.error("Error updating chore:", error.message);
                // Optionally, revert UI change or show error to user
                e.target.checked = !isDone; // Revert checkbox state
            } else {
                setChores((prevChores) => prevChores.map((chore) => {
                    if (chore.id === choreId) {
                        return { ...chore, done: isDone };
                    }
                    return chore;
                }));
            }
        } catch (err) {
            console.error("Exception updating chore:", err);
            e.target.checked = !isDone; // Revert checkbox state on exception
        }
    }

    async function handleDeleteChore(choreToDelete) {
        try {
            const { error } = await supabase
                .from('chores')
                .delete()
                .eq('id', choreToDelete.id);

            if (error) {
                console.error("Error deleting chore:", error.message);
            } else {
                setChores((currentChores) => currentChores.filter(chore => chore.id !== choreToDelete.id));
            }
        } catch (err) {
            console.error("Exception deleting chore:", err);
        }
    }

    async function handleAddNewChore(newChoreFromModal) {
        const user = currentUser(); // Use context
        if (!user || !user.id) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
            user_id: user.id, // Use user.id for Supabase and snake_case
        };

        if (newChoreFromModal.schedule) {
            // AddChoreModal now sends a JS Date for dueDate, or a dayspan-compatible options object for recurrence
            if (newChoreFromModal.schedule instanceof Date) {
                choreToAdd.dueDate = newChoreFromModal.schedule;
            } else if (typeof newChoreFromModal.schedule === 'object' && newChoreFromModal.schedule !== null && newChoreFromModal.schedule.type !== undefined) {
                // It's a recurrence options object from dayspan
                choreToAdd.recurrence = newChoreFromModal.schedule; 
                // convertChoreToSupabase will handle converting recurrence.start (JS Date) to ISO string
            }
        }

        try {
            const preparedChore = convertChoreToSupabase(choreToAdd);
            const { data, error } = await supabase
                .from('chores')
                .insert([preparedChore])
                .select();

            if (error) {
                console.error("Error adding new chore:", error.message);
            } else if (data && data.length > 0) {
                setChores((prevChores) => [...prevChores, convertChoreFromSupabase(data[0])]);
                setNewChoreModalOpen(false);
            } else {
                console.error("Error adding new chore: No data returned after insert.");
            }
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
        const user = currentUser(); // Use context
        if (!user || !user.id) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const title = quickChoreTitle().trim();
        if (title) {
            const newChore = {
                title: title,
                description: '',
                priority: 4, // Default priority
                done: false,
                user_id: user.id, // Use user.id for Supabase and snake_case
            };
            try {
                const preparedChore = convertChoreToSupabase(newChore);
                const { data, error } = await supabase
                    .from('chores')
                    .insert([preparedChore])
                    .select();
                
                if (error) {
                    console.error("Error quick adding chore:", error.message);
                } else if (data && data.length > 0) {
                    setChores((prevChores) => [...prevChores, convertChoreFromSupabase(data[0])]);
                    setQuickChoreTitle('');
                } else {
                    console.error("Error quick adding chore: No data returned after insert.");
                }
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

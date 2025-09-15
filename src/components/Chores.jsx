import { useState, useMemo, useEffect } from 'react';
import { useUser } from '../utils/UserContext';
import ChoresList from './ChoresList';
import AddChoreModal from './AddChoreModal';
import EditChoreModal from './EditChoreModal';
import AddChoreFloatButton from './AddChoreFloatButton';
import { getChores, addChore, updateChore, deleteChore } from '../apiClient';
import { isChoreForToday, choreSortFn } from '../utils/scheduleUtils.js';
import { initializeFuzzySearch, fuzzySearchChores } from '../utils/fuzzySearchUtils.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

import './Chores.less';

library.add(faPaperPlane);

function Chores() {
    const currentUser = useUser();
    const [chores, setChores] = useState([]);
    const [newChoreModalOpen, setNewChoreModalOpen] = useState(false);
    const [editChoreModalOpen, setEditChoreModalOpen] = useState(false);
    const [choreToEdit, setChoreToEdit] = useState(null);
    const [quickChoreTitle, setQuickChoreTitle] = useState('');
    const [fuse, setFuse] = useState(null);
    const [loadingChores, setLoadingChores] = useState(true);

    useEffect(() => {
        if (currentUser && currentUser.uid) {
            setLoadingChores(true);
            getChores(currentUser.uid)
                .then(choresData => {
                    setChores(choresData);
                })
                .catch(e => {
                    console.error("Exception fetching chores:", e);
                    setChores([]);
                })
                .finally(() => {
                    setLoadingChores(false);
                });
        } else if (!currentUser) {
            setChores([]);
            setLoadingChores(false);
        }
    }, [currentUser]);


    useEffect(() => {
        setFuse(initializeFuzzySearch([...chores], ['title', 'description']));
    }, [chores]);

    const displayedChores = useMemo(() => {
        if (quickChoreTitle.trim() === '' || !fuse) {
            return chores;
        }
        return fuzzySearchChores(fuse, quickChoreTitle);
    }, [chores, quickChoreTitle, fuse]);

    async function handleChoreDone(choreToUpdate, isDone) {
        try {
            await updateChore(choreToUpdate.id, { done: isDone });
            setChores(prevChores => prevChores.map(chore =>
                chore.id === choreToUpdate.id ? { ...chore, done: isDone } : chore
            ));
        } catch (err) {
            console.error("Exception updating chore:", err);
        }
    }

    async function handleDeleteChore(choreToDelete) {
        try {
            await deleteChore(choreToDelete.id);
            setChores(currentChores => currentChores.filter(chore => chore.id !== choreToDelete.id));
        } catch (err) {
            console.error("Exception deleting chore:", err);
        }
    }

    async function handleAddNewChore(newChoreFromModal) {
        if (!currentUser || !currentUser.uid) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }

        console.log('handleAddNewChore called with:', newChoreFromModal);

        let recurrence = null;
        if (typeof newChoreFromModal.schedule === 'object' && newChoreFromModal.schedule !== null && !(newChoreFromModal.schedule instanceof Date)) {
            // Handle recurrence
            const scheduleStart = newChoreFromModal.schedule.start;
            console.log('Processing recurrence with start:', scheduleStart, 'typeof:', typeof scheduleStart);

            // Convert start to ISO string - handle both Date objects and Dayspan Day objects
            let startISO;
            if (scheduleStart instanceof Date) {
                startISO = scheduleStart.toISOString();
            } else if (scheduleStart && typeof scheduleStart.toDate === 'function') {
                // Dayspan Day object
                startISO = scheduleStart.toDate().toISOString();
            } else if (scheduleStart && scheduleStart.valueOf) {
                // Try to convert via valueOf and create Date
                startISO = new Date(scheduleStart.valueOf() * 24 * 60 * 60 * 1000).toISOString();
            } else {
                console.error('Unable to convert start to ISO string:', scheduleStart);
                startISO = new Date().toISOString(); // fallback
            }

            recurrence = { ...newChoreFromModal.schedule, start: startISO };
            console.log('Final recurrence object:', recurrence);
        }

        const choreToAdd = {
            title: newChoreFromModal.title,
            description: newChoreFromModal.description,
            priority: parseInt(newChoreFromModal.priority, 10),
            done: false,
            user_id: currentUser.uid,
            due_date: newChoreFromModal.schedule instanceof Date ? newChoreFromModal.schedule.toISOString() : null,
            recurrence: recurrence,
        };

        console.log('choreToAdd:', JSON.stringify(choreToAdd, null, 2));
        console.log('choreToAdd.recurrence:', choreToAdd.recurrence);

        try {
            const newChore = await addChore(choreToAdd);
            console.log('newChore from API:', newChore);
            console.log('newChore.recurrence exists?:', !!newChore.recurrence);
            console.log('newChore.recurrence value:', newChore.recurrence);
            console.log('newChore keys:', Object.keys(newChore));
            console.log('Full newChore JSON:', JSON.stringify(newChore, null, 2));

            setChores(prevChores => {
                const updated = [...prevChores, { ...newChore, done: !!newChore.done }];
                console.log('Updated chores array length:', updated.length);
                console.log('Last chore in array:', updated[updated.length - 1]);
                console.log('Last chore recurrence:', updated[updated.length - 1]?.recurrence);
                return updated;
            });
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
        if (!currentUser || !currentUser.uid) {
            console.error("User not logged in. Cannot add chore.");
            return;
        }
        const title = quickChoreTitle.trim();
        if (title) {
            const newChore = {
                title: title,
                description: '',
                priority: 4,
                done: false,
                user_id: currentUser.uid,
            };
            try {
                const addedChore = await addChore(newChore);
                setChores(prevChores => [...prevChores, { ...addedChore, done: !!addedChore.done }]);
                setQuickChoreTitle('');
            } catch (err) {
                console.error("Exception quick adding chore:", err);
            }
        }
    }

    function handleEditChore(chore) {
        setChoreToEdit(chore);
        setEditChoreModalOpen(true);
    }

    function handleEditChoreClose() {
        setEditChoreModalOpen(false);
        setChoreToEdit(null);
    }

    async function handleUpdateChore(choreId, updates) {
        try {
            const updatedChore = await updateChore(choreId, updates);
            setChores(prevChores => prevChores.map(chore =>
                chore.id === choreId ? { ...chore, ...updatedChore, done: !!updatedChore.done } : chore
            ));
            handleEditChoreClose();
        } catch (err) {
            console.error("Exception updating chore:", err);
        }
    }

    return (
        <>
            <ul className="instructions">
                <li>This is a list of chores split into ones that need to be done today and the rest.</li>
                <li>If you see something that you can do, assign it to youself and get it done.</li>
                <li>If you see something that has been done already, please mark it as done.</li>
                <li>Reminders for chores will continuously be sent out until they are marked as done.</li>
            </ul>
            <form onSubmit={handleQuickAddChore} className="quick-add-form">
                <input
                    className="input"
                    type="text"
                    placeholder="Search chores or add new and press Enter..."
                    value={quickChoreTitle}
                    onChange={(e) => setQuickChoreTitle(e.target.value)}
                    aria-label="Search chores or add new chore title"
                />
                <button type="submit" className="outline submit" title="Add chore">
                    <FontAwesomeIcon icon={faPaperPlane} />
                </button>
            </form>
            {loadingChores ? (
                <p>Loading chores...</p>
            ) : (
                <ChoresList
                    chores={displayedChores}
                    onChoreDone={handleChoreDone}
                    onDeleteChore={handleDeleteChore}
                    onEditChore={handleEditChore}
                    isChoreForToday={isChoreForToday}
                    choreSortFn={choreSortFn}
                />
            )}
            <AddChoreModal
                open={newChoreModalOpen}
                onClose={handleAddChoreClose}
                onAddNewChore={handleAddNewChore}
            />
            <EditChoreModal
                open={editChoreModalOpen}
                onClose={handleEditChoreClose}
                onUpdateChore={handleUpdateChore}
                chore={choreToEdit}
            />
            <AddChoreFloatButton onClick={handleAddChoreClick} />
        </>
    );
}

export default Chores;

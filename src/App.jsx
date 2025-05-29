import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';
import Chores from './components/Chores';
import AddTaskModal from './components/AddTaskModal';
import AddTaskFloatButton from './components/AddTaskFloatButton';
import LoginPage from './components/LoginPage'; // Import LoginPage
import { auth } from './utils/firebaseConfig'; // Import auth from firebaseConfig
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { jsToday, todayStartAdapter, todayEndAdapter, isSameDateAdapterDay, isTaskForToday, getEffectiveDueDate, taskSortFn } from './utils/scheduleUtils.js'; // Import utils
import { initializeFuzzySearch, fuzzySearchTasks } from './utils/fuzzySearchUtils.js';
import { StandardDateAdapter, Rule } from './rschedule.js'; // Rule is used in utils.js and now here
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

import '@picocss/pico';
import './App.less'; // Import App.less

library.add(faPaperPlane); // Add the paper plane icon to the library

// Initial tasks data (lifted from Chores.jsx)
const initialTasks = [
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
    const [tasks, setTasks] = createSignal(initialTasks);
    const [newTaskModalOpen, setNewTaskModalOpen] = createSignal(false);
    const [quickTaskTitle, setQuickTaskTitle] = createSignal('');
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
        // Ensure tasks() is accessed to trigger effect on change
        const currentTasks = tasks();
        setFuse(initializeFuzzySearch([...currentTasks], ['title', 'description']));
    });

    const displayedTasks = createMemo(() => {
        const searchTerm = quickTaskTitle();
        const currentFuse = fuse(); // Access fuse signal
        if (searchTerm.trim() === '' || !currentFuse) {
            return tasks();
        }
        return fuzzySearchTasks(currentFuse, searchTerm);
    });

    // Task manipulation functions
    function handleTaskDone(e) {
        const taskTitle = e.target.dataset.taskTitle;
        setTasks((prevTasks) => prevTasks.map((task) => {
            if (task.title === taskTitle) {
                return { ...task, done: e.target.checked };
            }
            return task;
        }));
    }

    function handleDeleteTask(taskToDelete) {
        setTasks((currentTasks) => currentTasks.filter(task => task.title !== taskToDelete.title));
    }

    function handleAddNewTask(newTaskFromModal) {
        const taskToAdd = {
            title: newTaskFromModal.title,
            description: newTaskFromModal.description,
            priority: parseInt(newTaskFromModal.priority, 10),
            done: false,
        };

        if (newTaskFromModal.schedule) {
            if (newTaskFromModal.schedule instanceof Rule) {
                taskToAdd.recurrence = newTaskFromModal.schedule;
            } else if (typeof newTaskFromModal.schedule === 'string' && newTaskFromModal.schedule.trim() !== '') {
                taskToAdd.dueDate = new Date(newTaskFromModal.schedule);
            }
        }
        
        setTasks((prevTasks) => [...prevTasks, taskToAdd]);
        setNewTaskModalOpen(false); // Close modal after adding
    }

    // Modal control functions
    function handleAddTaskClick() {
        setNewTaskModalOpen(true);
    }

    function handleAddTaskClose() {
        setNewTaskModalOpen(false);
    }

    function handleQuickAddTask(e) {
        if (e) e.preventDefault(); // Prevent default form submission
        const title = quickTaskTitle().trim();
        if (title) {
            const newTask = {
                title: title,
                description: '', // Default empty description
                priority: 4,    // Default low priority
                done: false,
            };
            setTasks((prevTasks) => [...prevTasks, newTask]);
            setQuickTaskTitle(''); // Clear the input field
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
                        <form onSubmit={handleQuickAddTask} class="quick-add-form">
                            <input
                                class="input"
                                type="text"
                                placeholder="Search tasks or add new and press Enter..."
                                value={quickTaskTitle()}
                                onInput={(e) => setQuickTaskTitle(e.target.value)}
                                aria-label="Search tasks or add new task title"
                            />
                            <button type="submit" class="outline submit" title="Add task">
                                <FontAwesomeIcon icon={faPaperPlane} />
                            </button>
                        </form>
                        <Chores
                            tasks={displayedTasks()}
                            onTaskDone={handleTaskDone}
                            onDeleteTask={handleDeleteTask}
                            // Utility functions needed by Chores for filtering/sorting
                            isTaskForToday={isTaskForToday}
                            taskSortFn={taskSortFn}
                        />
                    </main>
                    <footer>
                        <p>© {new Date().getFullYear()} Chores</p>
                    </footer>
                    <AddTaskModal
                        open={newTaskModalOpen}
                        onClose={handleAddTaskClose}
                        onAddNewTask={handleAddNewTask}
                    />
                    <AddTaskFloatButton onClick={handleAddTaskClick} />
                </>
            ) : (
                <LoginPage />
            )}
        </div>
    )
}

export default App

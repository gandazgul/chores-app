import { createSignal } from 'solid-js';
import Chores from './components/Chores';
import AddTaskModal from './components/AddTaskModal';
import AddTaskFloatButton from './components/AddTaskFloatButton';
import { jsToday, todayStartAdapter, todayEndAdapter, isSameDateAdapterDay, isTaskForToday, getEffectiveDueDate, taskSortFn } from './components/utils'; // Import utils
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

const instructions = `
    This is a list of chores that need to be done.
    If you see something that needs to be done, please do it.
    If you see something that has been done, please mark it as done.
    Reminders for chores will continuously be sent out until they are marked as done.
`;

function App() {
    const [tasks, setTasks] = createSignal(initialTasks);
    const [newTaskModalOpen, setNewTaskModalOpen] = createSignal(false);
    const [quickTaskTitle, setQuickTaskTitle] = createSignal('');

    // Task manipulation functions (lifted from Chores.jsx)
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

    return (
        <div class="app">
            <header>
                <h1>Chores</h1>
            </header>
            <main class="content container-fluid">
                <p class="instructions">{instructions}</p>
                <form onSubmit={handleQuickAddTask} class="quick-add-form">
                    <input
                        class="input"
                        type="text"
                        placeholder="Add a new task and press Enter..."
                        value={quickTaskTitle()}
                        onInput={(e) => setQuickTaskTitle(e.target.value)}
                        aria-label="New task title"
                    />
                    <button type="submit" class="outline submit" title="Add task">
                        <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                </form>
                <Chores 
                    tasks={tasks()}
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
        </div>
    )
}

export default App

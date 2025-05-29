import PropTypes from 'prop-types';
import { createSignal, createMemo, For } from "solid-js";
import AddTaskModal from './AddTaskModal';
import Chore from './Chore'; // Import the new Chore component
import { jsToday, todayStartAdapter, todayEndAdapter, isSameDateAdapterDay, isTaskForToday, getEffectiveDueDate, taskSortFn } from './utils'; // Import utils

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faChevronDown, faChevronRight, faRepeat, faPlus, faMinus, faTrash } from '@fortawesome/free-solid-svg-icons'; 
import { StandardDateAdapter } from '../rschedule.js'; // Rule is used in utils.js

import './Chores.less';

// Add icons to the library (ensure all needed icons are added, some might be in Chore.jsx)
// Icons used in Chores.jsx: faChevronDown, faChevronRight
// Icons used in Chore.jsx: faRepeat, faPlus, faMinus, faTrash
library.add(faChevronDown, faChevronRight, faRepeat, faPlus, faMinus, faTrash);

/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 * Using 'start' as the property for the rule's start date, per IRuleOptions.
 */

/**
 * @typedef {Object} ChoreTask
 * @property {string} title - The title of the chore.
 * @property {string} description - The description of the chore.
 * @property {number} priority - The priority of the chore (e.g., 1-5, 1 is highest).
 * @property {boolean} done - Whether the chore is done.
 * @property {Date} [dueDate] - Specific due date for non-recurring tasks (JS Date object).
 * @property {boolean} [remindUntilDone] - Whether to remind until the chore is done.
 * @property {string} [scheduleDisplay] - A calculated value to display the schedule in a friendly way.
 * @property {RScheduleRuleOptions} [recurrence] - Recurrence options.
 */


/** @type {ChoreTask[]} */
const [tasks, setTasks] = createSignal([
    {
        title: 'Take out the trash (Recurring Weekly)',
        description: 'Take out the trash, it stinks!',
        priority: 2,
        remindUntilDone: true,
        recurrence: { // Uses 'start' which is a StandardDateAdapter
            frequency: 'WEEKLY',
            start: new StandardDateAdapter(new Date(2024, 0, 1, 8, 0, 0)), 
            byDayOfWeek: ['TU'],
        },
        scheduleDisplay: 'Every Tuesday at 8am'
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
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 14, 0, 0), // JS Date
        scheduleDisplay: `Today at 2:00 PM`
    },
    {
        title: 'Prepare presentation - Due Tomorrow',
        description: 'For the team meeting.',
        priority: 2,
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate() + 1, 10, 0, 0), // JS Date
        scheduleDisplay: `Tomorrow at 10:00 AM`
    },
    {
        title: 'Morning Standup (Recurring Daily)',
        description: 'Quick sync with the team.',
        priority: 3,
        recurrence: {
            frequency: 'DAILY',
            start: new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 9, 0, 0)), 
            count: 10,
        },
        scheduleDisplay: 'Daily at 9am (next 10)'
    },
    {
        title: 'Water plants - Done',
        description: 'They were thirsty.',
        priority: 4,
        done: true,
        dueDate: new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate() -1, 12, 0, 0), // JS Date
        scheduleDisplay: 'Yesterday'
    },
    {
        title: 'Pay Bills (Recurring Monthly)',
        description: 'Monthly bills payment',
        priority: 1,
        recurrence: {
            frequency: 'MONTHLY',
            start: new StandardDateAdapter(new Date(2024, 0, 15, 10, 0, 0)), 
            byMonthDay: [15],
        },
        scheduleDisplay: 'Every 15th of the month'
    }
]);

function handleTaskDone(e) {
    const taskTitle = e.target.dataset.taskTitle;
    setTasks((prevTasks) => prevTasks.map((task) => {
        if (task.title === taskTitle) {
            return { ...task, done: e.target.checked };
        }
        return task;
    }));
}

function Chores(props) {
    PropTypes.checkPropTypes(Chores.propTypes, props, 'prop', 'Chores');

    const [newTaskModalOpen, setNewTaskModalOpen] = createSignal(false);
    const [showTodayTasks, setShowTodayTasks] = createSignal(true);
    const [showAllTasks, setShowAllTasks] = createSignal(false);

    function handleDeleteTask(taskToDelete) {
        setTasks((currentTasks) => currentTasks.filter(task => task.title !== taskToDelete.title));
    }

    function handleAddTaskClick() {
        setNewTaskModalOpen(true);
    }

    function handleAddTaskClose() {
        setNewTaskModalOpen(false);
    }

    function handleAddNewTask(newTask) {
        if (newTask.dueDate && !(newTask.dueDate instanceof Date)) {
            newTask.dueDate = new Date(newTask.dueDate); 
        }
        // Ensure StandardDateAdapter is used if recurrence.start is provided as a string/date
        if (newTask.recurrence && newTask.recurrence.start && !(newTask.recurrence.start instanceof StandardDateAdapter)) {
            newTask.recurrence.start = new StandardDateAdapter( new Date(newTask.recurrence.start) );
        }
        setTasks((prevTasks) => [...prevTasks, newTask]);
        setNewTaskModalOpen(false);
    }

    // isTaskForToday, getEffectiveDueDate, taskSortFn are now imported from utils.js
    // renderTaskItem is now the Chore component

    const todayTasksList = createMemo(() => {
        // isTaskForToday and taskSortFn are from utils.js
        return tasks().filter(isTaskForToday).sort(taskSortFn);
    });

    const allTasksList = createMemo(() => {
        // taskSortFn is from utils.js
        return [...tasks()].sort(taskSortFn);
    });

    return (
        <div>
            <AddTaskModal open={newTaskModalOpen} onClose={handleAddTaskClose} onAddNewTask={handleAddNewTask} />

            <div class="collapsible-section">
                <h2 onClick={() => setShowTodayTasks(!showTodayTasks())}>
                    <FontAwesomeIcon icon={showTodayTasks() ? faChevronDown : faChevronRight} />
                    &nbsp;Today's Tasks ({todayTasksList().length})
                </h2>
                {showTodayTasks() && (
                    <ul class="chores-list">
                        <For each={todayTasksList()}>
                            {(task) => <Chore task={task} onTaskDone={handleTaskDone} onDeleteTask={handleDeleteTask} />}
                        </For>
                    </ul>
                )}
            </div>

            <div class="collapsible-section">
                <h2 onClick={() => setShowAllTasks(!showAllTasks())}>
                    <FontAwesomeIcon icon={showAllTasks() ? faChevronDown : faChevronRight} />
                    &nbsp;All Tasks ({allTasksList().length})
                </h2>
                {showAllTasks() && (
                    <ul class="chores-list">
                        <For each={allTasksList()}>
                            {(task) => <Chore task={task} onTaskDone={handleTaskDone} onDeleteTask={handleDeleteTask} />}
                        </For>
                    </ul>
                )}
            </div>
            
            <button class="round" onClick={handleAddTaskClick}>+</button>
        </div>
    );
}

Chores.propTypes = {};

export default Chores;

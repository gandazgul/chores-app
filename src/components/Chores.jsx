import PropTypes from 'prop-types';
import { createSignal, createMemo, For } from "solid-js";
import cx from 'classnames';
import AddTaskModal from './AddTaskModal';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faRepeat, faPlus, faMinus, faTrash, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

import { Rule, StandardDateAdapter } from '../rschedule.js'; 

import './Chores.less';

// Add icons to the library
library.add(faRepeat, faPlus, faMinus, faTrash, faChevronDown, faChevronRight);

/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 * Using 'start' as the property for the rule's start date, per IRuleOptions.
 */

/**
 * @typedef {Object} Chore
 * @property {string} title - The title of the chore.
 * @property {string} description - The description of the chore.
 * @property {number} priority - The priority of the chore (e.g., 1-5, 1 is highest).
 * @property {boolean} done - Whether the chore is done.
 * @property {Date} [dueDate] - Specific due date for non-recurring tasks (JS Date object).
 * @property {boolean} [remindUntilDone] - Whether to remind until the chore is done.
 * @property {string} [scheduleDisplay] - A calculated value to display the schedule in a friendly way.
 * @property {RScheduleRuleOptions} [recurrence] - Recurrence options.
 */

const jsToday = new Date(); // Standard JavaScript Date object for 'today'
// Create StandardDateAdapter instances for the start and end of today for rSchedule operations
const todayStartAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate()));
const todayEndAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 23, 59, 59, 999));

// Helper function to compare if two StandardDateAdapter instances are on the same calendar day
function isSameDateAdapterDay(adapter1, adapter2) {
    if (!adapter1 || !adapter2 || !adapter1.date || !adapter2.date) return false;
    return adapter1.date.getFullYear() === adapter2.date.getFullYear() &&
           adapter1.date.getMonth() === adapter2.date.getMonth() &&
           adapter1.date.getDate() === adapter2.date.getDate();
}

/** @type {Chore[]} */
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
        recurrence: { // Uses 'start'
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
        recurrence: { // Uses 'start'
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
    const [showAllTasks, setShowAllTasks] = createSignal(true);

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
        if (newTask.recurrence && newTask.recurrence.start && !(newTask.recurrence.start instanceof StandardDateAdapter)) {
            newTask.recurrence.start = new StandardDateAdapter( new Date(newTask.recurrence.start) );
        }
        setTasks((prevTasks) => [...prevTasks, newTask]);
        setNewTaskModalOpen(false);
    }

    const isTaskForToday = (task) => {
        if (task.dueDate) { // task.dueDate is a JS Date
            const dueDateAdapter = new StandardDateAdapter(task.dueDate);
            return isSameDateAdapterDay(dueDateAdapter, todayStartAdapter);
        }
        if (task.recurrence && task.recurrence.start) { // task.recurrence.start is an adapter
            const rule = new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
            const occurrencesToday = rule.occurrences({
                start: todayStartAdapter, 
                end: todayEndAdapter,     
            }).next();
            return !occurrencesToday.done;
        }
        return !task.dueDate && !task.recurrence;
    };
    
    const getEffectiveDueDate = (task) => {
        if (task.dueDate) { // task.dueDate is a JS Date
            return new StandardDateAdapter(task.dueDate);
        }
        if (task.recurrence && task.recurrence.start) { // task.recurrence.start is an adapter
            const rule = new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
            const nextOccurrence = rule.occurrences({ start: todayStartAdapter }).next().value; 
            return nextOccurrence ? nextOccurrence : null; // nextOccurrence is already an adapter
        }
        return null;
    };

    const taskSortFn = (a, b) => {
        const aDueDateAdapter = getEffectiveDueDate(a); 
        const bDueDateAdapter = getEffectiveDueDate(b); 

        if (!aDueDateAdapter && bDueDateAdapter) return 1;
        if (aDueDateAdapter && !bDueDateAdapter) return -1;
        if (!aDueDateAdapter && !bDueDateAdapter) {
             return a.priority - b.priority;
        }

        // Compare using valueOf() which should return milliseconds for chronological comparison
        const сравнение = aDueDateAdapter.valueOf() - bDueDateAdapter.valueOf();
        if (сравнение !== 0) return сравнение;

        return a.priority - b.priority; // If dates are same, sort by priority
    };

    const todayTasksList = createMemo(() => {
        return tasks().filter(isTaskForToday).sort(taskSortFn);
    });

    const allTasksList = createMemo(() => {
        return [...tasks()].sort(taskSortFn);
    });

    const renderTaskItem = (task) => {
        const classNames = {
            chore: true,
            done: task.done,
            [`priority-${task.priority}`]: true,
        };
        const [isDescriptionOpen, setIsDescriptionOpen] = createSignal(false);
        function toggleDescription() {
            setIsDescriptionOpen(!isDescriptionOpen());
        }

        let displayDate = task.scheduleDisplay;
        if (!displayDate) {
            const effectiveDateAdapter = getEffectiveDueDate(task); 
            if (effectiveDateAdapter && effectiveDateAdapter.date) { // Check .date for safety
                const d = effectiveDateAdapter.date; // Get the underlying JS Date
                displayDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                    let hours = d.getHours();
                    const minutes = d.getMinutes().toString().padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12; 
                    displayDate += ` ${hours}:${minutes} ${ampm}`;
                }
            } else {
                displayDate = "No specific date";
            }
        }
      
        return (
            <li class={cx(classNames)}>
                <div class="chore-main-row">
                    <div class="chore-title-section">
                        <input type="checkbox"
                            data-task-title={task.title}
                            checked={task.done}
                            onChange={handleTaskDone}
                        />
                        <h3>{task.title}</h3>
                    </div>
                    <div class="chore-icons-section">
                        {task.recurrence && (
                            <span class="icon-recurrence" title={task.scheduleDisplay || 'Recurring'}>
                                <FontAwesomeIcon icon={faRepeat} />
                            </span>
                        )}
                        <button onClick={toggleDescription} class="icon icon-toggle-description" title={isDescriptionOpen() ? "Collapse description" : "Expand description"}>
                            <FontAwesomeIcon icon={isDescriptionOpen() ? faMinus : faPlus} />
                        </button>
                        <button onClick={() => handleDeleteTask(task)} class="icon icon-delete-task" title="Delete task">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>
                </div>
                {isDescriptionOpen() && (
                    <>
                        <p class="list-item-meta">{displayDate}</p>
                        <p class="chore-description">{task.description}</p>
                    </>
                )}
            </li>
        );
    };

    return (
        <div>
            <AddTaskModal open={newTaskModalOpen()} onClose={handleAddTaskClose} onAddNewTask={handleAddNewTask} />

            <div class="collapsible-section">
                <h2 onClick={() => setShowTodayTasks(!showTodayTasks())}>
                    <FontAwesomeIcon icon={showTodayTasks() ? faChevronDown : faChevronRight} />
                    &nbsp;Today's Tasks ({todayTasksList().length})
                </h2>
                {showTodayTasks() && (
                    <ul class="chores-list">
                        <For each={todayTasksList()}>
                            {(task) => renderTaskItem(task)}
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
                            {(task) => renderTaskItem(task)}
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

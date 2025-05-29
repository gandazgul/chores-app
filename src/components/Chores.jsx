import PropTypes from 'prop-types';
import { createSignal, createMemo, For } from "solid-js";
import Chore from './Chore'; // Import the Chore component
// Removed AddTaskModal, Rule, StandardDateAdapter, and specific utils if now passed as props or unused.
// Kept utils that might still be used by Chore or other internal logic if any.
// For example, getEffectiveDueDate might be used by Chore.jsx internally.
// We assume isTaskForToday and taskSortFn are passed as props.

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from 'solid-fontawesome';
// Icons used in Chores.jsx: faChevronDown, faChevronRight
// Icons used in Chore.jsx (faRepeat, faPlus, faMinus, faTrash) are added in Chore.jsx or App.jsx if global
// For simplicity, assuming Chore.jsx handles its own icons or they are globally registered.
// If faPlus was only for the old button, it can be removed here if not used elsewhere in Chores.
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons'; 

import './Chores.less';

// Add icons to the library that are used directly in this component
library.add(faChevronDown, faChevronRight);

// Typedefs for ChoreTask and RScheduleRuleOptions can be kept if Chore component expects them
// or if they are useful for prop type definitions.
/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 */
/**
 * @typedef {Object} ChoreTask
 * @property {string} title
 * @property {string} description
 * @property {number} priority
 * @property {boolean} done
 * @property {Date} [dueDate]
 * @property {boolean} [remindUntilDone]
 * @property {RScheduleRuleOptions} [recurrence]
 */

function Chores(props) {
    PropTypes.checkPropTypes(Chores.propTypes, props, 'prop', 'Chores');

    const [showTodayTasks, setShowTodayTasks] = createSignal(true);
    const [showAllTasks, setShowAllTasks] = createSignal(false);

    const todayTasksList = createMemo(() => {
        return props.tasks.filter(props.isTaskForToday).sort(props.taskSortFn);
    });

    const allTasksList = createMemo(() => {
        return [...props.tasks].sort(props.taskSortFn);
    });

    return (
        <div>
            {/* AddTaskModal and the old add button are removed */}
            <div class="collapsible-section">
                <h2 onClick={() => setShowTodayTasks(!showTodayTasks())}>
                    <FontAwesomeIcon icon={showTodayTasks() ? faChevronDown : faChevronRight} />
                    &nbsp;Today's Tasks ({todayTasksList().length})
                </h2>
                {showTodayTasks() && (
                    <ul class="chores-list">
                        <For each={todayTasksList()}>
                            {(task) => <Chore task={task} onTaskDone={props.onTaskDone} onDeleteTask={props.onDeleteTask} />}
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
                            {(task) => <Chore task={task} onTaskDone={props.onTaskDone} onDeleteTask={props.onDeleteTask} />}
                        </For>
                    </ul>
                )}
            </div>
        </div>
    );
}

Chores.propTypes = {
    tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
    onTaskDone: PropTypes.func.isRequired,
    onDeleteTask: PropTypes.func.isRequired,
    isTaskForToday: PropTypes.func.isRequired,
    taskSortFn: PropTypes.func.isRequired,
};

export default Chores;

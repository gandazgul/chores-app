import PropTypes from 'prop-types';
import { createSignal } from "solid-js";
import cx from 'classnames';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faRepeat, faPlus, faMinus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { getEffectiveDueDate, getScheduleDisplayString } from './utils'; // Import helpers

// Note: library.add for these icons is already in Chores.jsx or App.jsx, ensure it's loaded globally.
// If not, you might need to add:
// import { library } from '@fortawesome/fontawesome-svg-core';
// library.add(faRepeat, faPlus, faMinus, faTrash);


/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 */

/**
 * @typedef {Object} ChoreTask
 * @property {string} title - The title of the chore.
 * @property {string} description - The description of the chore.
 * @property {number} priority - The priority of the chore (e.g., 1-5, 1 is highest).
 * @property {boolean} done - Whether the chore is done.
 * @property {Date} [dueDate] - Specific due date for non-recurring tasks (JS Date object).
 * @property {boolean} [remindUntilDone] - Whether to remind until the chore is done.
 * @property {RScheduleRuleOptions} [recurrence] - Recurrence options.
 */

/**
 * Chore component to render a single task item.
 * @param {Object} props
 * @param {ChoreTask} props.task - The task object.
 * @param {Function} props.onTaskDone - Callback for when the task's done status changes.
 * @param {Function} props.onDeleteTask - Callback for deleting the task.
 */
function Chore(props) {
    PropTypes.checkPropTypes(Chore.propTypes, props, 'prop', 'Chore');

    const task = props.task;

    const classNames = {
        chore: true,
        done: task.done,
        [`priority-${task.priority}`]: true,
    };
    const [isDescriptionOpen, setIsDescriptionOpen] = createSignal(false);

    function toggleDescription() {
        setIsDescriptionOpen(!isDescriptionOpen());
    }

    let displayDate;
    let recurrenceTitle = 'Recurring';

    if (task.recurrence) {
        displayDate = getScheduleDisplayString(task.recurrence);
        recurrenceTitle = displayDate; // Use the full display string for the title
    } else if (task.dueDate) {
        const effectiveDateAdapter = getEffectiveDueDate(task); // This will be StandardDateAdapter(task.dueDate)
        if (effectiveDateAdapter && effectiveDateAdapter.date) {
            const d = effectiveDateAdapter.date;
            displayDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
            if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                let hours = d.getHours();
                const minutes = d.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM/PM
                displayDate += ` ${hours}:${minutes} ${ampm}`;
            }
        } else {
            displayDate = "No specific date"; // Should not happen if task.dueDate is valid
        }
    } else {
        displayDate = "No specific date";
    }

    return (
        <li class={cx(classNames)}>
            <div class="chore-main-row">
                <div class="chore-title-section">
                    <input type="checkbox"
                        data-task-title={task.title}
                        checked={task.done}
                        onChange={props.onTaskDone} // Use passed handler
                    />
                    <h3>{task.title}</h3>
                </div>
                <div class="chore-icons-section">
                    {task.recurrence && (
                        <span class="icon-recurrence" title={recurrenceTitle}>
                            <FontAwesomeIcon icon={faRepeat} />
                        </span>
                    )}
                    <button onClick={toggleDescription} class="icon icon-toggle-description" title={isDescriptionOpen() ? "Collapse description" : "Expand description"}>
                        <FontAwesomeIcon icon={isDescriptionOpen() ? faMinus : faPlus} />
                    </button>
                    <button onClick={() => props.onDeleteTask(task)} class="icon icon-delete-task" title="Delete task">
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
}

Chore.propTypes = {
    task: PropTypes.shape({
        title: PropTypes.string.isRequired,
        description: PropTypes.string,
        priority: PropTypes.number.isRequired,
        done: PropTypes.bool,
        dueDate: PropTypes.instanceOf(Date),
        remindUntilDone: PropTypes.bool,
        // scheduleDisplay: PropTypes.string, // Removed
        recurrence: PropTypes.object, // Simplified for brevity, consider more detailed shape
    }).isRequired,
    onTaskDone: PropTypes.func.isRequired,
    onDeleteTask: PropTypes.func.isRequired,
};

export default Chore;

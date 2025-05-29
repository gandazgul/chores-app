import PropTypes from 'prop-types';
import { createSignal } from "solid-js";
import cx from 'classnames';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faRepeat, faPlus, faMinus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { getEffectiveDueDate, getScheduleDisplayString } from '../utils/scheduleUtils.js'; // Import helpers
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faRepeat, faPlus, faMinus, faTrash);

/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 */

/**
 * @typedef {Object} ChoreItem
 * @property {string} title - The title of the chore.
 * @property {string} description - The description of the chore.
 * @property {number} priority - The priority of the chore (e.g., 1-5, 1 is highest).
 * @property {boolean} done - Whether the chore is done.
 * @property {Date} [dueDate] - Specific due date for non-recurring tasks (JS Date object).
 * @property {boolean} [remindUntilDone] - Whether to remind until the chore is done.
 * @property {RScheduleRuleOptions} [recurrence] - Recurrence options.
 */

/**
 * Chore component to render a single chore item.
 * @param {Object} props
 * @param {ChoreItem} props.chore - The chore object.
 * @param {Function} props.onChoreDone - Callback for when the chore's done status changes.
 * @param {Function} props.onDeleteChore - Callback for deleting the chore.
 */
function Chore(props) {
    PropTypes.checkPropTypes(Chore.propTypes, props, 'prop', 'Chore');

    const chore = props.chore;

    const classNames = {
        chore: true,
        done: chore.done,
        [`priority-${chore.priority}`]: true,
    };
    const [isDescriptionOpen, setIsDescriptionOpen] = createSignal(false);

    function toggleDescription() {
        setIsDescriptionOpen(!isDescriptionOpen());
    }

    let displayDate = "No specific date"; // Default value
    let recurrenceTitle = 'Recurring';

    if (chore.recurrence) {
        displayDate = getScheduleDisplayString(chore.recurrence);
        recurrenceTitle = displayDate; // Use the full display string for the title
    } else if (chore.dueDate) {
        const effectiveDateAdapter = getEffectiveDueDate(chore);
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
        }
    }

    return (
        <li class={cx(classNames)}>
            <div class="chore-main-row">
                <div class="chore-title-section">
                    <input type="checkbox"
                        data-chore-id={chore.id}
                        checked={chore.done}
                        onChange={props.onChoreDone}
                    />
                    <h3>{chore.title}</h3>
                    {chore.dueDate && !chore.recurrence && (
                        <span class="chore-due-date" title="Due Date">{displayDate}</span>
                    )}
                </div>
                <div class="chore-icons-section">
                    {chore.recurrence && (
                        <span class="icon-recurrence" title={recurrenceTitle}>
                            <FontAwesomeIcon icon={faRepeat} />
                        </span>
                    )}
                    <button onClick={toggleDescription} class="icon icon-toggle-description" title={isDescriptionOpen() ? "Collapse description" : "Expand description"}>
                        <FontAwesomeIcon icon={isDescriptionOpen() ? faMinus : faPlus} />
                    </button>
                    <button onClick={() => props.onDeleteChore(chore)} class="icon icon-delete-chore" title="Delete chore">
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </div>
            {isDescriptionOpen() && (
                <>
                    <p class="list-item-meta">{displayDate}</p>
                    <p class="chore-description">{chore.description}</p>
                </>
            )}
        </li>
    );
}

Chore.propTypes = {
    chore: PropTypes.shape({
        title: PropTypes.string.isRequired,
        description: PropTypes.string,
        priority: PropTypes.number.isRequired,
        done: PropTypes.bool,
        dueDate: PropTypes.instanceOf(Date),
        remindUntilDone: PropTypes.bool,
        // scheduleDisplay: PropTypes.string, // Removed
        recurrence: PropTypes.object, // Simplified for brevity, consider more detailed shape
    }).isRequired,
    onChoreDone: PropTypes.func.isRequired,
    onDeleteChore: PropTypes.func.isRequired,
};

export default Chore;

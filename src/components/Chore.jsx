import PropTypes from 'prop-types';
import { useState } from "react";
import cx from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat, faPlus, faMinus, faTrash, faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import { getEffectiveDueDate, getScheduleDisplayString, isOverdue } from '../utils/scheduleUtils.js';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faRepeat, faPlus, faMinus, faTrash, faPencilAlt);

function Chore(props) {
    PropTypes.checkPropTypes(Chore.propTypes, props, 'prop', 'Chore');

    const { chore, onChoreDone, onDeleteChore, onEditChore } = props;

    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

    const classNames = cx({
        chore: true,
        done: chore.done,
        overdue: isOverdue(chore),
        [`priority-${chore.priority}`]: true,
    });

    function toggleDescription() {
        setIsDescriptionOpen(!isDescriptionOpen);
    }

    let displayDate = "No specific date";
    let recurrenceTitle = 'Recurring';

    if (chore.recurrence) {
        displayDate = getScheduleDisplayString(chore.recurrence);
        recurrenceTitle = displayDate;
    } else if (chore.due_date) {
        const effectiveDateAdapter = getEffectiveDueDate(chore);
        if (effectiveDateAdapter && effectiveDateAdapter.date) {
            const d = effectiveDateAdapter.date;
            displayDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
            if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                let hours = d.getHours();
                const minutes = d.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                displayDate += ` ${hours}:${minutes} ${ampm}`;
            }
        }
    }

    return (
        <li className={classNames}>
            <div className="chore-main-row">
                <div className="chore-title-section">
                    <input type="checkbox"
                        data-chore-id={chore.id}
                        checked={chore.done}
                        onChange={(e) => onChoreDone(chore, e.target.checked)}
                    />
                    <h3 className={cx({ overdue: isOverdue(chore) })}>{chore.title}</h3>
                    {chore.due_date && !chore.recurrence && (
                        <span className="chore-due-date" title="Due Date">{displayDate}</span>
                    )}
                </div>
                <div className="chore-icons-section">
                    {chore.recurrence && (
                        <span className="icon-recurrence" title={recurrenceTitle}>
                            <FontAwesomeIcon icon={faRepeat} />
                        </span>
                    )}
                    <button onClick={toggleDescription} className="icon icon-toggle-description" title={isDescriptionOpen ? "Collapse description" : "Expand description"}>
                        <FontAwesomeIcon icon={isDescriptionOpen ? faMinus : faPlus} />
                    </button>
                    <button onClick={() => onEditChore(chore)} className="icon icon-edit-chore" title="Edit chore">
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </button>
                    <button onClick={() => onDeleteChore(chore)} className="icon icon-delete-chore" title="Delete chore">
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </div>
            {isDescriptionOpen && (
                <>
                    <p className="list-item-meta">{displayDate}</p>
                    <p className="chore-description">{chore.description}</p>
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
        due_date: PropTypes.string,
        remindUntilDone: PropTypes.bool,
        // scheduleDisplay: PropTypes.string, // Removed
        recurrence: PropTypes.object, // Simplified for brevity, consider more detailed shape
    }).isRequired,
    onChoreDone: PropTypes.func.isRequired,
    onDeleteChore: PropTypes.func.isRequired,
    onEditChore: PropTypes.func.isRequired,
};

export default Chore;

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

// Typedefs for ChoreItem and RScheduleRuleOptions can be kept if Chore component expects them
// or if they are useful for prop type definitions.
/**
 * @typedef {import('@rschedule/core').RuleOptions} RScheduleRuleOptions
 */
/**
 * @typedef {Object} ChoreItem
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

    const [showTodayChores, setShowTodayChores] = createSignal(true);
    const [showAllChores, setShowAllChores] = createSignal(false);

    const todayChoresList = createMemo(() => {
        return props.chores.filter(props.isChoreForToday).sort(props.choreSortFn);
    });

    const allChoresList = createMemo(() => {
        return [...props.chores].sort(props.choreSortFn);
    });

    return (
        <div>
            {/* AddChoreModal and the old add button are removed */}
            <div class="collapsible-section">
                <h2 onClick={() => setShowTodayChores(!showTodayChores())}>
                    <FontAwesomeIcon icon={showTodayChores() ? faChevronDown : faChevronRight} />
                    &nbsp;Today's Chores ({todayChoresList().length})
                </h2>
                {showTodayChores() && (
                    <ul class="chores-list">
                        <For each={todayChoresList()}>
                            {(chore) => <Chore chore={chore} onChoreDone={props.onChoreDone} onDeleteChore={props.onDeleteChore} />}
                        </For>
                    </ul>
                )}
            </div>

            <div class="collapsible-section">
                <h2 onClick={() => setShowAllChores(!showAllChores())}>
                    <FontAwesomeIcon icon={showAllChores() ? faChevronDown : faChevronRight} />
                    &nbsp;All Chores ({allChoresList().length})
                </h2>
                {showAllChores() && (
                    <ul class="chores-list">
                        <For each={allChoresList()}>
                            {(chore) => <Chore chore={chore} onChoreDone={props.onChoreDone} onDeleteChore={props.onDeleteChore} />}
                        </For>
                    </ul>
                )}
            </div>
        </div>
    );
}

Chores.propTypes = {
    chores: PropTypes.arrayOf(PropTypes.object).isRequired,
    onChoreDone: PropTypes.func.isRequired,
    onDeleteChore: PropTypes.func.isRequired,
    isChoreForToday: PropTypes.func.isRequired,
    choreSortFn: PropTypes.func.isRequired,
};

export default Chores;

import PropTypes from 'prop-types';
import { useState, useMemo } from "react";
import Chore from './Chore';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

import './ChoresList.less';

library.add(faChevronDown, faChevronRight);

function ChoresList(props) {
    PropTypes.checkPropTypes(ChoresList.propTypes, props, 'prop', 'ChoresList');

    const [showTodayChores, setShowTodayChores] = useState(true);
    const [showAllChores, setShowAllChores] = useState(false);

    const todayChoresList = useMemo(() => {
        console.log('ChoresList - filtering chores:', props.chores);
        console.log('ChoresList - isChoreForToday function:', props.isChoreForToday);
        const filtered = props.chores.filter(chore => {
            const isForToday = props.isChoreForToday(chore);
            console.log('ChoresList - chore:', chore.title, 'isForToday:', isForToday);
            return isForToday;
        });
        const sorted = filtered.sort(props.choreSortFn);
        console.log('ChoresList - final todayChoresList:', sorted);
        return sorted;
    }, [props.chores, props.isChoreForToday, props.choreSortFn]);

    const allChoresList = useMemo(() => {
        return [...props.chores].sort(props.choreSortFn);
    }, [props.chores, props.choreSortFn]);

    return (
        <div>
            <div className="collapsible-section">
                <h2 onClick={() => setShowTodayChores(!showTodayChores)}>
                    <FontAwesomeIcon icon={showTodayChores ? faChevronDown : faChevronRight} />
                    &nbsp;Today's Chores ({todayChoresList.length})
                </h2>
                {showTodayChores && (
                    <ul className="chores-list">
                        {todayChoresList.map(chore => (
                            <Chore key={chore.id} chore={chore} onChoreDone={props.onChoreDone} onDeleteChore={props.onDeleteChore} onEditChore={props.onEditChore} />
                        ))}
                    </ul>
                )}
            </div>

            <div className="collapsible-section">
                <h2 onClick={() => setShowAllChores(!showAllChores)}>
                    <FontAwesomeIcon icon={showAllChores ? faChevronDown : faChevronRight} />
                    &nbsp;All Chores ({allChoresList.length})
                </h2>
                {showAllChores && (
                    <ul className="chores-list">
                        {allChoresList.map(chore => (
                            <Chore key={chore.id} chore={chore} onChoreDone={props.onChoreDone} onDeleteChore={props.onDeleteChore} onEditChore={props.onEditChore} />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

ChoresList.propTypes = {
    chores: PropTypes.arrayOf(PropTypes.object).isRequired,
    onChoreDone: PropTypes.func.isRequired,
    onDeleteChore: PropTypes.func.isRequired,
    onEditChore: PropTypes.func.isRequired,
    isChoreForToday: PropTypes.func.isRequired,
    choreSortFn: PropTypes.func.isRequired,
};

export default ChoresList;

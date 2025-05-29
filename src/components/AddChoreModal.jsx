import PropTypes from "prop-types";
import { Rule, StandardDateAdapter } from "../rschedule.js";
import { Show, createSignal, onMount, onCleanup } from "solid-js"; // For conditional rendering and lifecycle
import './AddChoreModal.less'; // Import the Less file

function AddChoreModal(props) {
    PropTypes.checkPropTypes(AddChoreModal.propTypes, props, 'prop', 'AddChoreModal');
    const { open = () => false, onClose, onAddNewChore } = props;

    // Signals for conditional UI
    const [isRecurring, setIsRecurring] = createSignal(false);
    const [selectedFrequency, setSelectedFrequency] = createSignal("DAILY"); // Default if recurring

    let frequencySelectElement; 
    let isRecurringCheckboxElement;

    onMount(() => {
        isRecurringCheckboxElement = document.getElementById('chore-is-recurring');
        frequencySelectElement = document.getElementById('chore-recurrence-frequency');

        if (isRecurringCheckboxElement) {
            isRecurringCheckboxElement.addEventListener('change', handleIsRecurringChange);
            setIsRecurring(isRecurringCheckboxElement.checked); // Initialize
        }
        if (frequencySelectElement) {
            frequencySelectElement.addEventListener('change', handleFrequencyChange);
            // Initialize selectedFrequency if the section is visible
            if (isRecurringCheckboxElement && isRecurringCheckboxElement.checked) {
                 setSelectedFrequency(frequencySelectElement.value || "DAILY");
            }
        }
    });

    onCleanup(() => {
        if (isRecurringCheckboxElement) {
            isRecurringCheckboxElement.removeEventListener('change', handleIsRecurringChange);
        }
        if (frequencySelectElement) {
            frequencySelectElement.removeEventListener('change', handleFrequencyChange);
        }
    });

    function handleIsRecurringChange(event) {
        setIsRecurring(event.target.checked);
        if (!event.target.checked) {
            // Optionally reset frequency when recurrence is turned off
            // setSelectedFrequency("NONE"); // Or keep last selection for when it's re-enabled
        } else {
            // If turning on, ensure selectedFrequency is a valid default if not already set
             if (frequencySelectElement) setSelectedFrequency(frequencySelectElement.value || "DAILY");
        }
    }
    
    function handleFrequencyChange(event) {
        setSelectedFrequency(event.target.value);
    }

    function getSelectedWeekdays() {
        const weekdays = [];
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        days.forEach(day => {
            const checkbox = document.getElementById(`chore-weekday-${day.toLowerCase()}`);
            if (checkbox && checkbox.checked) {
                weekdays.push(day);
            }
        });
        return weekdays;
    }

    function handleAddNewChore() {
        const title = document.getElementById('chore-title').value;
        const description = document.getElementById('chore-description').value;
        const priority = document.getElementById('chore-priority').value;
        const scheduleInput = document.getElementById('chore-schedule').value;
        
        let scheduleObject = scheduleInput; // Default to the date string

        if (isRecurring() && scheduleInput) {
            const recurrenceFrequencyValue = selectedFrequency();
            // Ensure interval input exists and has a value, otherwise default to 1
            const intervalElement = document.getElementById('chore-recurrence-interval');
            const recurrenceInterval = intervalElement && intervalElement.value ? parseInt(intervalElement.value, 10) : 1;

            const startDate = new StandardDateAdapter(new Date(scheduleInput));
            const options = {
                frequency: recurrenceFrequencyValue,
                interval: recurrenceInterval,
                start: startDate,
            };

            if (recurrenceFrequencyValue === "WEEKLY") {
                const selectedDays = getSelectedWeekdays();
                if (selectedDays.length > 0) {
                    options.byDayOfWeek = selectedDays;
                }
            } else if (recurrenceFrequencyValue === "MONTHLY") {
                const monthDayInput = document.getElementById('chore-month-day');
                if (monthDayInput && monthDayInput.value) {
                    options.byMonthDay = [parseInt(monthDayInput.value, 10)];
                }
            } else if (recurrenceFrequencyValue === "YEARLY") {
                const yearMonthInput = document.getElementById('chore-year-month');
                const yearDayInput = document.getElementById('chore-year-day');
                if (yearMonthInput && yearMonthInput.value) {
                    options.byMonth = [parseInt(yearMonthInput.value, 10)];
                }
                if (yearDayInput && yearDayInput.value) {
                    options.byMonthDay = [parseInt(yearDayInput.value, 10)];
                }
            }
            
            scheduleObject = new Rule(options, { dateAdapter: StandardDateAdapter });
        }

        onAddNewChore({
            title,
            description,
            priority,
            schedule: scheduleObject,
        });
    }

    return (
        <dialog open={open()}>
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onClick={onClose}></button>
                    <p>
                        <strong>🗓️ New Chore</strong>
                    </p>
                </header>
                <form class="compact-modal-form" onSubmit={(e) => e.preventDefault()}>
                    <label htmlFor="chore-title">Title</label>
                    <input type="text" id="chore-title" name="chore-title" />
                    <label htmlFor="chore-description">Description</label>
                    <textarea id="chore-description" name="chore-description" />
                    <label htmlFor="chore-priority">Priority</label>
                    <select id="chore-priority" name="chore-priority">
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                    </select>
                    <label htmlFor="chore-schedule">{isRecurring() ? 'Start Date' : 'Due Date'}</label>
                    <input type="datetime-local" id="chore-schedule" name="chore-schedule" />

                    <div class="form-group">
                        <label for="chore-is-recurring" style="display: inline-block; margin-right: 10px;">
                            <input type="checkbox" id="chore-is-recurring" name="chore-is-recurring" checked={isRecurring()} onChange={handleIsRecurringChange} />
                            Is this chore recurring?
                        </label>
                    </div>

                    <Show when={isRecurring()}>
                        <fieldset style="border: 1px solid #ccc; padding: 10px; margin-top:10px;">
                            <legend>Recurrence Options</legend>
                            
                            <label htmlFor="chore-recurrence-frequency">Frequency</label>
                            <select id="chore-recurrence-frequency" name="chore-recurrence-frequency" onChange={handleFrequencyChange} value={selectedFrequency()}>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>

                            <div class="form-group repeat-every-group">
                                <label htmlFor="chore-recurrence-interval">Repeat Every</label>
                                <input type="number" id="chore-recurrence-interval" name="chore-recurrence-interval" defaultValue="1" min="1" />
                                <span class="repeat-unit-label"> ({selectedFrequency().toLowerCase() === 'daily' ? 'day(s)' : selectedFrequency().toLowerCase().slice(0, -2) + '(s)' })</span>
                            </div>

                            <Show when={selectedFrequency() === 'WEEKLY'}>
                                <div class="form-group">
                                    <label>On Days:</label>
                                    <div>
                                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                            <label for={`chore-weekday-${day.toLowerCase()}`} style="margin-right: 10px; display: inline-block;">
                                                <input type="checkbox" id={`chore-weekday-${day.toLowerCase()}`} name="chore-weekday" value={day} />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </Show>

                            <Show when={selectedFrequency() === 'MONTHLY'}>
                                <div class="form-group">
                                    <label htmlFor="chore-month-day">Day of Month (1-31):</label>
                                    <input type="number" id="chore-month-day" name="chore-month-day" min="1" max="31" />
                                </div>
                            </Show>

                            <Show when={selectedFrequency() === 'YEARLY'}>
                                <div class="form-group">
                                    <label htmlFor="chore-year-month">Month:</label>
                                    <select id="chore-year-month" name="chore-year-month">
                                        {[...Array(12).keys()].map(i => (
                                            <option value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label htmlFor="chore-year-day">Day of Month (1-31):</label>
                                    <input type="number" id="chore-year-day" name="chore-year-day" min="1" max="31" />
                                </div>
                            </Show>
                        </fieldset>
                    </Show>

                    <button type="submit" onClick={handleAddNewChore}>Add Chore</button>
                </form>
            </article>
        </dialog>
    );
}

AddChoreModal.propTypes = {
    open: PropTypes.func,
    onClose: PropTypes.func.isRequired,
    onAddNewChore: PropTypes.func.isRequired,
};

export default AddChoreModal;

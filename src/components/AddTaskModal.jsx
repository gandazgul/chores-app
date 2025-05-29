import PropTypes from "prop-types";
import { Rule, StandardDateAdapter } from "../rschedule.js";
import { Show, createSignal, onMount, onCleanup } from "solid-js"; // For conditional rendering and lifecycle
import './AddTaskModal.less'; // Import the Less file

function AddTaskModal(props) {
    PropTypes.checkPropTypes(AddTaskModal.propTypes, props, 'prop', 'AddTaskModal');
    const { open = () => false, onClose, onAddNewTask } = props;

    // Signals for conditional UI
    const [isRecurring, setIsRecurring] = createSignal(false);
    const [selectedFrequency, setSelectedFrequency] = createSignal("DAILY"); // Default if recurring

    let frequencySelectElement; 
    let isRecurringCheckboxElement;

    onMount(() => {
        isRecurringCheckboxElement = document.getElementById('task-is-recurring');
        frequencySelectElement = document.getElementById('task-recurrence-frequency');

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
            const checkbox = document.getElementById(`task-weekday-${day.toLowerCase()}`);
            if (checkbox && checkbox.checked) {
                weekdays.push(day);
            }
        });
        return weekdays;
    }

    function handleAddNewTask() {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const priority = document.getElementById('task-priority').value;
        const scheduleInput = document.getElementById('task-schedule').value;
        
        let scheduleObject = scheduleInput; // Default to the date string

        if (isRecurring() && scheduleInput) {
            const recurrenceFrequencyValue = selectedFrequency();
            // Ensure interval input exists and has a value, otherwise default to 1
            const intervalElement = document.getElementById('task-recurrence-interval');
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
                const monthDayInput = document.getElementById('task-month-day');
                if (monthDayInput && monthDayInput.value) {
                    options.byMonthDay = [parseInt(monthDayInput.value, 10)];
                }
            } else if (recurrenceFrequencyValue === "YEARLY") {
                const yearMonthInput = document.getElementById('task-year-month');
                const yearDayInput = document.getElementById('task-year-day');
                if (yearMonthInput && yearMonthInput.value) {
                    options.byMonth = [parseInt(yearMonthInput.value, 10)];
                }
                if (yearDayInput && yearDayInput.value) {
                    options.byMonthDay = [parseInt(yearDayInput.value, 10)];
                }
            }
            
            scheduleObject = new Rule(options, { dateAdapter: StandardDateAdapter });
        }

        onAddNewTask({
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
                        <strong>🗓️ New Task</strong>
                    </p>
                </header>
                <form class="compact-modal-form" onSubmit={(e) => e.preventDefault()}>
                    <label htmlFor="task-title">Title</label>
                    <input type="text" id="task-title" name="task-title" />
                    <label htmlFor="task-description">Description</label>
                    <textarea id="task-description" name="task-description" />
                    <label htmlFor="task-priority">Priority</label>
                    <select id="task-priority" name="task-priority">
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                    </select>
                    <label htmlFor="task-schedule">{isRecurring() ? 'Start Date' : 'Due Date'}</label>
                    <input type="datetime-local" id="task-schedule" name="task-schedule" />

                    <div class="form-group">
                        <label for="task-is-recurring" style="display: inline-block; margin-right: 10px;">
                            <input type="checkbox" id="task-is-recurring" name="task-is-recurring" checked={isRecurring()} onChange={handleIsRecurringChange} />
                            Is this task recurring?
                        </label>
                    </div>

                    <Show when={isRecurring()}>
                        <fieldset style="border: 1px solid #ccc; padding: 10px; margin-top:10px;">
                            <legend>Recurrence Options</legend>
                            
                            <label htmlFor="task-recurrence-frequency">Frequency</label>
                            <select id="task-recurrence-frequency" name="task-recurrence-frequency" onChange={handleFrequencyChange} value={selectedFrequency()}>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>

                            <div class="form-group repeat-every-group">
                                <label htmlFor="task-recurrence-interval">Repeat Every</label>
                                <input type="number" id="task-recurrence-interval" name="task-recurrence-interval" defaultValue="1" min="1" />
                                <span class="repeat-unit-label"> ({selectedFrequency().toLowerCase() === 'daily' ? 'day(s)' : selectedFrequency().toLowerCase().slice(0, -2) + '(s)' })</span>
                            </div>

                            <Show when={selectedFrequency() === 'WEEKLY'}>
                                <div class="form-group">
                                    <label>On Days:</label>
                                    <div>
                                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                            <label for={`task-weekday-${day.toLowerCase()}`} style="margin-right: 10px; display: inline-block;">
                                                <input type="checkbox" id={`task-weekday-${day.toLowerCase()}`} name="task-weekday" value={day} />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </Show>

                            <Show when={selectedFrequency() === 'MONTHLY'}>
                                <div class="form-group">
                                    <label htmlFor="task-month-day">Day of Month (1-31):</label>
                                    <input type="number" id="task-month-day" name="task-month-day" min="1" max="31" />
                                </div>
                            </Show>

                            <Show when={selectedFrequency() === 'YEARLY'}>
                                <div class="form-group">
                                    <label htmlFor="task-year-month">Month:</label>
                                    <select id="task-year-month" name="task-year-month">
                                        {[...Array(12).keys()].map(i => (
                                            <option value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label htmlFor="task-year-day">Day of Month (1-31):</label>
                                    <input type="number" id="task-year-day" name="task-year-day" min="1" max="31" />
                                </div>
                            </Show>
                        </fieldset>
                    </Show>

                    <button type="submit" onClick={handleAddNewTask}>Add Task</button>
                </form>
            </article>
        </dialog>
    );
}

AddTaskModal.propTypes = {
    open: PropTypes.func,
    onClose: PropTypes.func.isRequired,
    onAddNewTask: PropTypes.func.isRequired,
};

export default AddTaskModal;

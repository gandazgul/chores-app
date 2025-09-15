import PropTypes from "prop-types";
import { Weekday } from 'dayspan';
import { useState, useEffect } from "react";
import './AddChoreModal.less';

const initialFormData = {
    title: '',
    description: '',
    priority: '1',
    schedule: '',
    isRecurring: false,
    recurrenceFrequency: 'DAILY',
    recurrenceInterval: 1,
    weekdays: [],
    monthDay: '',
    yearMonth: '',
};

function EditChoreModal(props) {
    PropTypes.checkPropTypes(EditChoreModal.propTypes, props, 'prop', 'EditChoreModal');
    const { open, onClose, onUpdateChore, chore } = props;

    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (chore) {
            const scheduleDate = chore.recurrence ? chore.recurrence.start : chore.due_date;
            let frequency = 'DAILY';
            if (chore.recurrence) {
                if (chore.recurrence.type) {
                    frequency = chore.recurrence.type;
                } else if (chore.recurrence.durationUnit) {
                    switch (chore.recurrence.durationUnit) {
                        case 'days': frequency = 'DAILY'; break;
                        case 'weeks': frequency = 'WEEKLY'; break;
                        case 'months': frequency = 'MONTHLY'; break;
                        case 'years': frequency = 'YEARLY'; break;
                        default: frequency = 'DAILY';
                    }
                }
            }

            const dayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };

            setFormData({
                title: chore.title || '',
                description: chore.description || '',
                priority: chore.priority || '1',
                schedule: scheduleDate ? new Date(scheduleDate).toISOString().substring(0, 16) : '',
                isRecurring: !!chore.recurrence,
                recurrenceFrequency: frequency,
                recurrenceInterval: chore.recurrence?.interval || chore.recurrence?.every || 1,
                weekdays: chore.recurrence?.weekdays?.map(dayIndex => dayMap[dayIndex]) || [],
                monthDay: chore.recurrence?.dayOfMonth || '',
                yearMonth: chore.recurrence?.month !== undefined ? chore.recurrence.month + 1 : '',
            });
        }
        else {
            setFormData(initialFormData);
        }
    }, [chore]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            if (name === 'chore-weekday') {
                const day = value;
                const newWeekdays = checked
                    ? [...formData.weekdays, day]
                    : formData.weekdays.filter((d) => d !== day);
                setFormData({ ...formData, weekdays: newWeekdays });
            } else {
                setFormData({ ...formData, isRecurring: checked });
            }
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    function handleUpdateChore(e) {
        e.preventDefault();

        let scheduleObject = formData.schedule ? new Date(formData.schedule) : null;

        if (formData.isRecurring && formData.schedule) {
            const startDate = new Date(formData.schedule);
            let durationUnit;
            switch (formData.recurrenceFrequency) {
                case "DAILY": durationUnit = 'days'; break;
                case "WEEKLY": durationUnit = 'weeks'; break;
                case "MONTHLY": durationUnit = 'months'; break;
                case "YEARLY": durationUnit = 'years'; break;
                default: durationUnit = 'days';
            }

            const options = {
                start: startDate.toISOString(),
                every: formData.recurrenceInterval,
                duration: 1,
                durationUnit: durationUnit,
            };

            if (formData.recurrenceFrequency === 'WEEKLY') {
                const dayMap = {
                    'SU': Weekday.SUNDAY, 'MO': Weekday.MONDAY, 'TU': Weekday.TUESDAY, 'WE': Weekday.WEDNESDAY,
                    'TH': Weekday.THURSDAY, 'FR': Weekday.FRIDAY, 'SA': Weekday.SATURDAY,
                };
                const selectedDays = formData.weekdays.map(day => dayMap[day]);
                if (selectedDays.length > 0) {
                    options.dayOfWeek = selectedDays;
                }
            } else if (formData.recurrenceFrequency === 'MONTHLY') {
                if (formData.monthDay) {
                    options.dayOfMonth = parseInt(formData.monthDay, 10);
                }
            } else if (formData.recurrenceFrequency === 'YEARLY') {
                if (formData.yearMonth) {
                    options.month = parseInt(formData.yearMonth, 10) - 1;
                }
                if (formData.dayOfMonth) {
                    options.dayOfMonth = parseInt(formData.dayOfMonth, 10);
                }
            }
            scheduleObject = options;
        }

        const updatedChoreData = {
            title: formData.title,
            description: formData.description,
            priority: parseInt(formData.priority, 10),
            due_date: !formData.isRecurring && scheduleObject ? scheduleObject.toISOString() : null,
            recurrence: formData.isRecurring ? scheduleObject : null,
        };

        onUpdateChore(chore.id, updatedChoreData);
    }

    if (!open) {
        return null;
    }

    return (
        <dialog open>
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onClick={onClose}></button>
                    <p><strong>✏️ Edit Chore</strong></p>
                </header>
                <form className="compact-modal-form" onSubmit={handleUpdateChore}>
                    <label htmlFor="edit-chore-title">Title</label>
                    <input type="text" id="edit-chore-title" name="title" value={formData.title} onChange={handleInputChange} />
                    <label htmlFor="edit-chore-description">Description</label>
                    <textarea id="edit-chore-description" name="description" value={formData.description} onChange={handleInputChange} />
                    <label htmlFor="edit-chore-priority">Priority</label>
                    <select id="edit-chore-priority" name="priority" value={formData.priority} onChange={handleInputChange}>
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                    </select>
                    <label htmlFor="edit-chore-schedule">{formData.isRecurring ? 'Start Date' : 'Due Date'}</label>
                    <input type="datetime-local" id="edit-chore-schedule" name="schedule" value={formData.schedule} onChange={handleInputChange} />

                    <div className="form-group">
                        <label htmlFor="edit-chore-is-recurring" style={{ display: 'inline-block', marginRight: '10px' }}>
                            <input type="checkbox" id="edit-chore-is-recurring" name="isRecurring" checked={formData.isRecurring} onChange={handleInputChange} />
                            Is this chore recurring?
                        </label>
                    </div>

                    {formData.isRecurring && (
                        <fieldset style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
                            <legend>Recurrence Options</legend>

                            <label htmlFor="edit-chore-recurrence-frequency">Frequency</label>
                            <select id="edit-chore-recurrence-frequency" name="recurrenceFrequency" value={formData.recurrenceFrequency} onChange={handleInputChange}>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>

                            <div className="form-group repeat-every-group">
                                <label htmlFor="edit-chore-recurrence-interval">Repeat Every</label>
                                <input type="number" id="edit-chore-recurrence-interval" name="recurrenceInterval" value={formData.recurrenceInterval} onChange={handleInputChange} min="1" />
                                <span className="repeat-unit-label"> ({formData.recurrenceFrequency.toLowerCase() === 'daily' ? 'day(s)' : formData.recurrenceFrequency.toLowerCase().slice(0, -2) + '(s)'})</span>
                            </div>

                            {formData.recurrenceFrequency === 'WEEKLY' && (
                                <div className="form-group">
                                    <label>On Days:</label>
                                    <div>
                                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                            <label htmlFor={`edit-chore-weekday-${day.toLowerCase()}`} style={{ marginRight: '10px', display: 'inline-block' }} key={day}>
                                                <input type="checkbox" id={`edit-chore-weekday-${day.toLowerCase()}`} name="chore-weekday" value={day} checked={formData.weekdays.includes(day)} onChange={handleInputChange} />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formData.recurrenceFrequency === 'MONTHLY' && (
                                <div className="form-group">
                                    <label htmlFor="edit-chore-month-day">Day of Month (1-31):</label>
                                    <input type="number" id="edit-chore-month-day" name="monthDay" value={formData.monthDay} onChange={handleInputChange} min="1" max="31" />
                                </div>
                            )}

                            {formData.recurrenceFrequency === 'YEARLY' && (
                                <div className="form-group">
                                    <label htmlFor="edit-chore-year-month">Month:</label>
                                    <select id="edit-chore-year-month" name="yearMonth" value={formData.yearMonth} onChange={handleInputChange}>
                                        <option value="" disabled>Select Month</option>
                                        {[...Array(12).keys()].map(i => (
                                            <option value={i + 1} key={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </fieldset>
                    )}

                    <button type="submit">Update Chore</button>
                </form>
            </article>
        </dialog>
    );
}

EditChoreModal.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onUpdateChore: PropTypes.func.isRequired,
    chore: PropTypes.object,
};

export default EditChoreModal;
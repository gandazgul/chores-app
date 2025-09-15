import PropTypes from "prop-types";
import * as ds from 'dayspan';
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

function AddChoreModal(props) {
    PropTypes.checkPropTypes(AddChoreModal.propTypes, props, 'prop', 'AddChoreModal');
    const { open, onClose, onAddNewChore } = props;

    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (!open) {
            setFormData(initialFormData);
        }
    }, [open]);

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
                setFormData({ ...formData, [name]: checked });
            }
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    function handleAddNewChore(e) {
        e.preventDefault();

        try {
            let scheduleObject = formData.schedule ? new Date(formData.schedule) : null;

            if (formData.isRecurring && formData.schedule) {
                const startDate = new Date(formData.schedule);
                const scheduleOptions = {
                    start: startDate,
                };

                switch (formData.recurrenceFrequency) {
                    case "DAILY":
                        scheduleOptions.every = formData.recurrenceInterval;
                        scheduleOptions.duration = 1;
                        scheduleOptions.durationUnit = 'days';
                        break;

                    case "WEEKLY":
                        const dayMap = {
                            'SU': ds.Weekday.SUNDAY, 'MO': ds.Weekday.MONDAY, 'TU': ds.Weekday.TUESDAY,
                            'WE': ds.Weekday.WEDNESDAY, 'TH': ds.Weekday.THURSDAY, 'FR': ds.Weekday.FRIDAY,
                            'SA': ds.Weekday.SATURDAY,
                        };
                        const selectedDays = formData.weekdays.map(day => dayMap[day]);
                        if (selectedDays.length > 0) {
                            scheduleOptions.dayOfWeek = selectedDays;
                        } else {
                            scheduleOptions.dayOfWeek = [ds.Day.fromDate(startDate).dayOfWeek];
                        }
                        scheduleOptions.every = formData.recurrenceInterval;
                        break;

                    case "MONTHLY":
                        scheduleOptions.dayOfMonth = formData.monthDay ? parseInt(formData.monthDay, 10) : ds.Day.fromDate(startDate).dayOfMonth;
                        scheduleOptions.every = formData.recurrenceInterval;
                        break;

                    case "YEARLY":
                        scheduleOptions.month = formData.yearMonth ? parseInt(formData.yearMonth, 10) - 1 : ds.Day.fromDate(startDate).month;
                        scheduleOptions.dayOfMonth = ds.Day.fromDate(startDate).dayOfMonth;
                        scheduleOptions.every = formData.recurrenceInterval;
                        break;
                }
                scheduleObject = scheduleOptions;
            }

            onAddNewChore({
                title: formData.title,
                description: formData.description,
                priority: formData.priority,
                schedule: scheduleObject,
            });
        } catch (error) {
            console.error('Error in form submission:', error);
        }
    }

    if (!open) {
        return null;
    }

    return (
        <dialog open>
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onClick={onClose}></button>
                    <p><strong>🗓️ New Chore</strong></p>
                </header>
                <form className="compact-modal-form" onSubmit={handleAddNewChore}>
                    <label htmlFor="chore-title">Title</label>
                    <input type="text" id="chore-title" name="title" value={formData.title} onChange={handleInputChange} />
                    <label htmlFor="chore-description">Description</label>
                    <textarea id="chore-description" name="description" value={formData.description} onChange={handleInputChange} />
                    <label htmlFor="chore-priority">Priority</label>
                    <select id="chore-priority" name="priority" value={formData.priority} onChange={handleInputChange}>
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                    </select>
                    <label htmlFor="chore-schedule">{formData.isRecurring ? 'Start Date' : 'Due Date'}</label>
                    <input type="datetime-local" id="chore-schedule" name="schedule" value={formData.schedule} onChange={handleInputChange} />

                    <div className="form-group">
                        <label htmlFor="chore-is-recurring" style={{ display: 'inline-block', marginRight: '10px' }}>
                            <input type="checkbox" id="chore-is-recurring" name="isRecurring" checked={formData.isRecurring} onChange={handleInputChange} />
                            Is this chore recurring?
                        </label>
                    </div>

                    {formData.isRecurring && (
                        <fieldset style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
                            <legend>Recurrence Options</legend>

                            <label htmlFor="chore-recurrence-frequency">Frequency</label>
                            <select id="chore-recurrence-frequency" name="recurrenceFrequency" value={formData.recurrenceFrequency} onChange={handleInputChange}>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>

                            <div className="form-group repeat-every-group">
                                <label htmlFor="chore-recurrence-interval">Repeat Every</label>
                                <input type="number" id="chore-recurrence-interval" name="recurrenceInterval" value={formData.recurrenceInterval} onChange={handleInputChange} min="1" />
                                <span className="repeat-unit-label"> ({formData.recurrenceFrequency.toLowerCase() === 'daily' ? 'day(s)' : formData.recurrenceFrequency.toLowerCase().slice(0, -2) + '(s)'})</span>
                            </div>

                            {formData.recurrenceFrequency === 'WEEKLY' && (
                                <div className="form-group">
                                    <label>On Days:</label>
                                    <div>
                                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                            <label htmlFor={`chore-weekday-${day.toLowerCase()}`} style={{ marginRight: '10px', display: 'inline-block' }} key={day}>
                                                <input type="checkbox" id={`chore-weekday-${day.toLowerCase()}`} name="chore-weekday" value={day} checked={formData.weekdays.includes(day)} onChange={handleInputChange} />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formData.recurrenceFrequency === 'MONTHLY' && (
                                <div className="form-group">
                                    <label htmlFor="chore-month-day">Day of Month (1-31):</label>
                                    <input type="number" id="chore-month-day" name="monthDay" value={formData.monthDay} onChange={handleInputChange} min="1" max="31" />
                                </div>
                            )}

                            {formData.recurrenceFrequency === 'YEARLY' && (
                                <div className="form-group">
                                    <label htmlFor="chore-year-month">Month:</label>
                                    <select id="chore-year-month" name="yearMonth" value={formData.yearMonth} onChange={handleInputChange}>
                                        <option value="" disabled>Select Month</option>
                                        {[...Array(12).keys()].map(i => (
                                            <option value={i + 1} key={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </fieldset>
                    )}

                    <button type="submit">Add Chore</button>
                </form>
            </article>
        </dialog>
    );
}

AddChoreModal.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onAddNewChore: PropTypes.func.isRequired,
};

export default AddChoreModal;

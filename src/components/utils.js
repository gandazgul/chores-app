import { Rule, StandardDateAdapter } from '../rschedule.js';

// Standard JavaScript Date object for 'today'
const jsToday = new Date();
// Create StandardDateAdapter instances for the start and end of today for rSchedule operations
const todayStartAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate()));
const todayEndAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 23, 59, 59, 999));

// Helper function to compare if two StandardDateAdapter instances are on the same calendar day
function isSameDateAdapterDay(adapter1, adapter2) {
    if (!adapter1 || !adapter2 || !adapter1.date || !adapter2.date) return false;
    
    return adapter1.date.getFullYear() === adapter2.date.getFullYear() &&
           adapter1.date.getMonth() === adapter2.date.getMonth() &&
           adapter1.date.getDate() === adapter2.date.getDate();
}

function isTaskForToday(task) {
    if (task.dueDate) { // task.dueDate is a JS Date
        const dueDateAdapter = new StandardDateAdapter(task.dueDate);

        return isSameDateAdapterDay(dueDateAdapter, todayStartAdapter);
    }
    if (task.recurrence) {
        // task.recurrence could be a Rule instance or an options object
        const rule = task.recurrence instanceof Rule ? task.recurrence : new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
        // Ensure the rule has a start date to be valid for occurrence checks
        if (!rule.options.start) return false; 
        const occurrencesToday = rule.occurrences({
            start: todayStartAdapter,
            end: todayEndAdapter,
        }).next();

        return !occurrencesToday.done;
    }

    return true; // No due date or recurrence means it's a task for today
}

function getEffectiveDueDate(task) {
    if (task.dueDate) { // task.dueDate is a JS Date
        return new StandardDateAdapter(task.dueDate);
    }

    if (task.recurrence) {
        // task.recurrence could be a Rule instance or an options object
        const rule = task.recurrence instanceof Rule ? task.recurrence : new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
        // Ensure the rule has a start date to be valid for occurrence checks
        if (!rule.options.start) return null;
        // Get the next occurrence from the start of today
        const nextOccurrence = rule.occurrences({ start: todayStartAdapter }).next().value;

        return nextOccurrence ? nextOccurrence : null; // nextOccurrence is already an adapter
    }

    return null;
}

function taskSortFn(a, b) {
    const aDueDateAdapter = getEffectiveDueDate(a);
    const bDueDateAdapter = getEffectiveDueDate(b);

    // Tasks with no due date go to the bottom
    if (!aDueDateAdapter && bDueDateAdapter) return 1;
    if (aDueDateAdapter && !bDueDateAdapter) return -1;
    // If both have no due date, sort by priority
    if (!aDueDateAdapter && !bDueDateAdapter) {
         return a.priority - b.priority;
    }

    // Compare using valueOf() which should return milliseconds for chronological comparison
    // Ensure adapters are valid before calling valueOf
    const aValue = aDueDateAdapter ? aDueDateAdapter.valueOf() : 0;
    const bValue = bDueDateAdapter ? bDueDateAdapter.valueOf() : 0;
    
    const dateComparison = aValue - bValue;
    if (dateComparison !== 0) return dateComparison;

    // If dates are same, sort by priority
    return a.priority - b.priority;
}

const dayMap = {
    SU: 'Sunday',
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday',
};

const monthMap = {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December',
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function getScheduleDisplayString(recurrenceInput) {
    if (!recurrenceInput) return '';

    // recurrenceInput could be a Rule instance or an options object
    const recurrenceOptions = recurrenceInput instanceof Rule ? recurrenceInput.options : recurrenceInput;
    
    // Ensure recurrenceOptions and its start property are valid
    if (!recurrenceOptions || !recurrenceOptions.start) {
        console.warn('Invalid recurrence options for display string:', recurrenceOptions);
        return 'Invalid recurrence data';
    }

    const { frequency, interval = 1, byDayOfWeek, byMonth, byMonthDay, count, until } = recurrenceOptions;
    let displayString = '';

    // Note: rSchedule Rule options use byDayOfWeek, not byDay.
    // The sample data in Chores.jsx uses byDayOfWeek for 'TU', but the old getScheduleDisplayString used byDay.
    // Correcting to use byDayOfWeek if present.
    const daysOfWeek = byDayOfWeek || recurrenceOptions.byDay;


    switch (frequency) {
        case 'DAILY':
            displayString = interval === 1 ? 'Every day' : `Every ${interval} days`;
            break;
        case 'WEEKLY':
            displayString = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
            if (daysOfWeek && daysOfWeek.length > 0) {
                // Sort daysOfWeek according to typical week order (SU, MO, ..., SA)
                // rSchedule byDayOfWeek can be a string like 'MO' or an array ['MO', 2] for "2nd Monday"
                // For simplicity, this display function handles simple day strings.
                const simpleDays = daysOfWeek.map(d => typeof d === 'string' ? d : d[0]);
                const sortedDays = [...simpleDays].sort((a, b) => {
                    const order = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                    return order.indexOf(a) - order.indexOf(b);
                });
                displayString += ' on ' + sortedDays.map(day => dayMap[day]).join(', ');
            }
            break;
        case 'MONTHLY':
            displayString = interval === 1 ? 'Every month' : `Every ${interval} months`;
            if (byMonthDay && byMonthDay.length > 0) {
                // Assuming byMonthDay is an array of numbers
                displayString += ' on the ' + byMonthDay.map(day => `${day}${getOrdinalSuffix(day)}`).join(', ');
            }
            // Could also handle byDay with bySetPos for "first Monday of the month" etc. - more complex
            break;
        case 'YEARLY':
            displayString = interval === 1 ? 'Every year' : `Every ${interval} years`;
            if (byMonth && byMonth.length > 0) {
                displayString += ' in ' + byMonth.map(month => monthMap[month]).join(', ');
                if (byMonthDay && byMonthDay.length > 0) {
                    displayString += ' on the ' + byMonthDay.map(day => `${day}${getOrdinalSuffix(day)}`).join(', ');
                }
            }
            break;
        default:
            return 'Invalid recurrence';
    }

    if (count) {
        displayString += ` for ${count} occurrences`;
    } else if (until) {
        // until is an Adapter instance, its `date` property is a JS Date
        if (until.date && typeof until.date.toLocaleDateString === 'function') {
            displayString += ` until ${until.date.toLocaleDateString()}`;
        } else {
            // Fallback or error if until.date is not as expected
            console.warn('Unexpected "until" date format:', until);
            displayString += ' until an unspecified date';
        }
    }

    return displayString;
}

function getTaskDisplayDetails(task) {
    let displayDate;
    let recurrenceTitle = 'Recurring'; // Default title

    if (task.recurrence) {
        // task.recurrence can be a Rule instance or an options object
        const recurrenceValue = task.recurrence instanceof Rule ? task.recurrence.options : task.recurrence;
        if (recurrenceValue && recurrenceValue.start) { // Ensure it's valid before trying to display
            displayDate = getScheduleDisplayString(recurrenceValue); // Pass options object
            recurrenceTitle = displayDate || 'Recurring Task'; // Use the full display string for the title, or fallback
        } else {
            displayDate = "Invalid recurrence data";
            recurrenceTitle = "Recurring (Error)";
        }
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

    return { displayDate, recurrenceTitle };
}

export {
    jsToday,
    todayStartAdapter,
    todayEndAdapter,
    isSameDateAdapterDay,
    isTaskForToday,
    getEffectiveDueDate,
    taskSortFn,
    getScheduleDisplayString,
    getTaskDisplayDetails
};

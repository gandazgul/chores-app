import { Day, Schedule, Recurrence, Weekday, Month, Timespan } from 'dayspan';

// Dayspan Day object for 'today'
const today = Day.today();

// Helper to convert various date inputs (JS Date, string, Day object) to a Day object
function ensureDay(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Day) return dateInput;
    if (dateInput instanceof Date || typeof dateInput === 'string' || typeof dateInput === 'number') {
        try {
            return Day.fromDate(new Date(dateInput));
        } catch (e) {
            console.error("Failed to convert to Day:", dateInput, e);
            return null;
        }
    }
    console.warn("Unsupported date input type for ensureDay:", dateInput);
    return null;
}

// Helper to create a dayspan Schedule from chore recurrence options
function createScheduleFromChore(recurrenceOptions) {
    if (!recurrenceOptions || !recurrenceOptions.start) {
        console.warn('Invalid recurrence options for creating schedule: missing start date.', recurrenceOptions);
        return null;
    }

    const startDay = ensureDay(recurrenceOptions.start);
    if (!startDay) {
        console.warn('Invalid start date in recurrence options:', recurrenceOptions.start);
        return null;
    }

    const dayspanRecurrenceOptions = {
        ...recurrenceOptions,
        start: startDay,
    };

    if (recurrenceOptions.until) {
        const endDay = ensureDay(recurrenceOptions.until);
        if (endDay) {
            dayspanRecurrenceOptions.end = endDay;
            dayspanRecurrenceOptions.ends = Recurrence.ENDS_ON; // Explicitly set if 'until' is present
        } else {
            console.warn('Invalid until date in recurrence options:', recurrenceOptions.until);
            // Decide if this should prevent schedule creation or just ignore 'until'
        }
    }
    
    // Map rschedule frequency to dayspan type if necessary (assuming options are already dayspan compatible)
    // For example, if chore.recurrence.frequency = 'DAILY', map to type: Recurrence.DAILY

    // Map byDayOfWeek (['MO', 'TU']) to weekdays ([Weekday.MONDAY, Weekday.TUESDAY])
    // This mapping should ideally happen when recurrence is saved, not here.
    // For now, assuming recurrenceOptions are already in dayspan format (e.g., recurrenceOptions.weekdays)

    try {
        return Schedule.forRecurrence(dayspanRecurrenceOptions);
    } catch (e) {
        console.error("Failed to create schedule from options:", dayspanRecurrenceOptions, e);
        return null;
    }
}


function isChoreForToday(chore) {
    if (chore.dueDate) {
        const dueDate = ensureDay(chore.dueDate);
        return dueDate ? dueDate.isSame(today) : false;
    }
    if (chore.recurrence) {
        const schedule = createScheduleFromChore(chore.recurrence);
        return schedule ? schedule.occursOn(today) : false;
    }
    return true; // No due date or recurrence means it's a general task, considered for today
}

function getEffectiveDueDate(chore) {
    if (chore.dueDate) {
        return ensureDay(chore.dueDate);
    }
    if (chore.recurrence) {
        const schedule = createScheduleFromChore(chore.recurrence);
        if (!schedule) return null;
        
        // Find the next occurrence on or after today
        const nextOccurrenceTimespan = schedule.next(today, true); // true to include today
        return nextOccurrenceTimespan ? nextOccurrenceTimespan.start : null;
    }
    return null;
}

function choreSortFn(a, b) {
    const aDueDate = getEffectiveDueDate(a);
    const bDueDate = getEffectiveDueDate(b);

    if (!aDueDate && bDueDate) return 1;
    if (aDueDate && !bDueDate) return -1;
    if (!aDueDate && !bDueDate) {
        return (a.priority || 0) - (b.priority || 0);
    }

    // Both have due dates (Day objects)
    const dateComparison = aDueDate.valueOf() - bDueDate.valueOf();
    if (dateComparison !== 0) return dateComparison;

    return (a.priority || 0) - (b.priority || 0);
}

const dayspanWeekdayMap = {
    [Weekday.SUNDAY.iso]: 'Sunday',
    [Weekday.MONDAY.iso]: 'Monday',
    [Weekday.TUESDAY.iso]: 'Tuesday',
    [Weekday.WEDNESDAY.iso]: 'Wednesday',
    [Weekday.THURSDAY.iso]: 'Thursday',
    [Weekday.FRIDAY.iso]: 'Friday',
    [Weekday.SATURDAY.iso]: 'Saturday',
};

const dayspanMonthMap = {
    [Month.JANUARY.key]: 'January', // Assuming .key or similar gives a usable key like 'january' or 1
    [Month.FEBRUARY.key]: 'February',
    [Month.MARCH.key]: 'March',
    [Month.APRIL.key]: 'April',
    [Month.MAY.key]: 'May',
    [Month.JUNE.key]: 'June',
    [Month.JULY.key]: 'July',
    [Month.AUGUST.key]: 'August',
    [Month.SEPTEMBER.key]: 'September',
    [Month.OCTOBER.key]: 'October',
    [Month.NOVEMBER.key]: 'November',
    [Month.DECEMBER.key]: 'December',
};


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

    // Assuming recurrenceInput is a dayspan-compatible options object
    const { type, interval = 1, weekdays, month, dayOfMonth, max, end } = recurrenceInput;
    let displayString = '';

    switch (type) {
        case Recurrence.DAILY:
            displayString = interval === 1 ? 'Every day' : `Every ${interval} days`;
            break;
        case Recurrence.WEEKLY:
            displayString = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
            if (weekdays && weekdays.length > 0) {
                // weekdays is an array of Weekday enum values (e.g., Weekday.MONDAY)
                // Sort them: Weekday enums are 0 (Sun) to 6 (Sat)
                const sortedDays = [...weekdays].sort((a, b) => a.iso - b.iso);
                displayString += ' on ' + sortedDays.map(wd => dayspanWeekdayMap[wd.iso]).join(', ');
            }
            break;
        case Recurrence.MONTHLY:
            displayString = interval === 1 ? 'Every month' : `Every ${interval} months`;
            if (dayOfMonth) { // dayOfMonth is a number
                displayString += ` on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
            }
            // Dayspan also supports more complex monthly like "first Monday" via dayOfWeekInMonth
            // This simple display string doesn't cover that yet.
            break;
        case Recurrence.YEARLY:
            displayString = interval === 1 ? 'Every year' : `Every ${interval} years`;
            if (month) { // month is a Month enum value (e.g., Month.JANUARY)
                displayString += ` in ${dayspanMonthMap[month.key]}`; // Use .key or appropriate property
                if (dayOfMonth) {
                    displayString += ` on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
                }
            }
            break;
        default:
            console.warn("Unknown recurrence type for display:", type, recurrenceInput);
            return 'Invalid recurrence';
    }

    if (max) { // Corresponds to rschedule's 'count'
        displayString += ` for ${max} occurrences`;
    } else if (end) { // 'end' is a Day object
        const endDay = ensureDay(end);
        if (endDay) {
            displayString += ` until ${endDay.format('L')}`; // 'L' is MM/DD/YYYY
        } else {
            displayString += ' until an unspecified date';
        }
    }

    return displayString;
}

function getChoreDisplayDetails(chore) {
    let displayDate;
    let recurrenceTitle = 'Recurring';

    if (chore.recurrence) {
        // Assuming chore.recurrence is already in dayspan format
        if (chore.recurrence.start) {
            displayDate = getScheduleDisplayString(chore.recurrence);
            recurrenceTitle = displayDate || 'Recurring Chore';
        } else {
            displayDate = "Invalid recurrence data (missing start)";
            recurrenceTitle = "Recurring (Error)";
        }
    } else if (chore.dueDate) {
        const effectiveDay = getEffectiveDueDate(chore); // Returns a Day object
        if (effectiveDay) {
            // Format Day object. For time, we'd need to store time with dueDate.
            // Assuming dueDate is just a date for now.
            displayDate = effectiveDay.format('L'); // MM/DD/YYYY
            
            // If chore.dueDate was a JS Date with time:
            const jsDate = new Date(chore.dueDate);
            if (jsDate.getHours() !== 0 || jsDate.getMinutes() !== 0) {
                let hours = jsDate.getHours();
                const minutes = jsDate.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                displayDate += ` ${hours}:${minutes} ${ampm}`;
            }

        } else {
            displayDate = "No specific date";
        }
    } else {
        displayDate = "No specific date";
    }

    return { displayDate, recurrenceTitle };
}

export {
    today, // Exporting dayspan Day object for today
    isChoreForToday,
    getEffectiveDueDate,
    choreSortFn,
    getScheduleDisplayString,
    getChoreDisplayDetails,
    // Potentially export ensureDay and createScheduleFromChore if needed elsewhere
};

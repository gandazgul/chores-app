import * as ds from 'dayspan';


// Helper function to get current day (always fresh)
function getToday() {
    return ds.Day.today();
}

// Helper to convert various date inputs (JS Date, string, Day object) to a Day object
function ensureDay(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof ds.Day) return dateInput;
    if (dateInput instanceof Date || typeof dateInput === 'string' || typeof dateInput === 'number') {
        try {
            return ds.Day.fromDate(new Date(dateInput));
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
    // Parse if it's a JSON string
    if (typeof recurrenceOptions === 'string') {
        try {
            recurrenceOptions = JSON.parse(recurrenceOptions);
        } catch (error) {
            console.warn('Failed to parse recurrence options:', error);
            return null;
        }
    }

    if (!recurrenceOptions || !recurrenceOptions.start) {
        console.warn('Invalid recurrence options for creating schedule: missing start date.', recurrenceOptions);
        return null;
    }

    console.log('About to call ensureDay with:', recurrenceOptions.start);
    const startDay = ensureDay(recurrenceOptions.start);
    console.log('ensureDay returned:', startDay);

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
            dayspanRecurrenceOptions.ends = ds.Recurrence.ENDS_ON; // Explicitly set if 'until' is present
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
        // Use plain object approach based on Dayspan examples
        const scheduleObject = {
            start: startDay,
            every: recurrenceOptions.every || 1,
            duration: recurrenceOptions.duration || 1,
            durationUnit: recurrenceOptions.durationUnit || 'days'
        };
        console.log('Created schedule object:', scheduleObject);
        return scheduleObject;
    } catch (e) {
        console.error("Failed to create schedule from options:", dayspanRecurrenceOptions, e);
        return null;
    }
}


function isChoreForToday(chore) {
    const today = getToday(); // Get fresh today

    if (chore.due_date) {
        const dueDate = ensureDay(chore.due_date);
        return dueDate ? dueDate.valueOf() === today.valueOf() : false;
    }
    if (chore.recurrence) {
        const schedule = createScheduleFromChore(chore.recurrence);
        if (!schedule) return false;

        try {
            // Manual check for daily recurrence - simpler approach
            if (schedule.durationUnit === 'days' && schedule.every === 1) {
                // For daily recurrence, check if today is on or after start date
                const startDay = schedule.start;
                console.log('Daily recurrence check - startDay:', startDay, 'today:', today);
                console.log('startDay.dayOfYear:', startDay.dayOfYear, 'today.dayOfYear:', today.dayOfYear);
                console.log('startDay.year:', startDay.year, 'today.year:', today.year);
                // Compare just the date, not the time, for daily recurrence
                if (startDay.year !== today.year) {
                    return startDay.year <= today.year;
                }
                return startDay.dayOfYear <= today.dayOfYear;
            }

            // For other types, try to create a proper Schedule if needed
            if (typeof schedule.occursOn !== 'function') {
                console.log('Non-daily schedule, trying Dayspan Schedule:', schedule);
                const dayspanSchedule = new ds.Schedule(schedule);
                return dayspanSchedule.occursOn(today);
            }
            return schedule.occursOn(today);
        } catch (error) {
            console.error('Error in isChoreForToday:', error, 'schedule:', schedule);
            return false;
        }
    }
    return true; // No due date or recurrence means it's a general task, considered for today
}

function getEffectiveDueDate(chore) {
    if (chore.due_date) {
        return ensureDay(chore.due_date);
    }
    if (chore.recurrence) {
        const schedule = createScheduleFromChore(chore.recurrence);
        if (!schedule) return null;

        try {
            // For daily recurrence, just return the start date if it's today or later
            if (schedule.durationUnit === 'days' && schedule.every === 1) {
                const startDay = schedule.start;
                const today = getToday();
                if (startDay.valueOf() >= today.valueOf()) {
                    return startDay;
                }
                return today; // If start was in the past, return today
            }

            // If it's a plain object, try to create a proper Schedule
            if (typeof schedule.next !== 'function') {
                console.log('Schedule is plain object in getEffectiveDueDate, creating Dayspan Schedule:', schedule);
                try {
                    const dayspanSchedule = new ds.Schedule(schedule);
                    const nextOccurrenceTimespan = dayspanSchedule.next(getToday(), true);
                    return nextOccurrenceTimespan ? nextOccurrenceTimespan.start : null;
                } catch (scheduleError) {
                    console.error('Error creating Dayspan Schedule:', scheduleError);
                    // Fallback: return the start date if it exists
                    return schedule.start || null;
                }
            }

            // Find the next occurrence on or after today
            const nextOccurrenceTimespan = schedule.next(getToday(), true); // true to include today
            return nextOccurrenceTimespan ? nextOccurrenceTimespan.start : null;
        } catch (error) {
            console.error('Error in getEffectiveDueDate:', error, 'schedule:', schedule);
            return schedule.start || null; // Fallback
        }
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
    [ds.Weekday.SUNDAY.iso]: 'Sunday',
    [ds.Weekday.MONDAY.iso]: 'Monday',
    [ds.Weekday.TUESDAY.iso]: 'Tuesday',
    [ds.Weekday.WEDNESDAY.iso]: 'Wednesday',
    [ds.Weekday.THURSDAY.iso]: 'Thursday',
    [ds.Weekday.FRIDAY.iso]: 'Friday',
    [ds.Weekday.SATURDAY.iso]: 'Saturday',
};

const dayspanMonthMap = {
    [ds.Month.JANUARY.key]: 'January', // Assuming .key or similar gives a usable key like 'january' or 1
    [ds.Month.FEBRUARY.key]: 'February',
    [ds.Month.MARCH.key]: 'March',
    [ds.Month.APRIL.key]: 'April',
    [ds.Month.MAY.key]: 'May',
    [ds.Month.JUNE.key]: 'June',
    [ds.Month.JULY.key]: 'July',
    [ds.Month.AUGUST.key]: 'August',
    [ds.Month.SEPTEMBER.key]: 'September',
    [ds.Month.OCTOBER.key]: 'October',
    [ds.Month.NOVEMBER.key]: 'November',
    [ds.Month.DECEMBER.key]: 'December',
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

    // Handle both dayspan and rrule-like recurrence objects
    // Map durationUnit to type for display
    let type = recurrenceInput.type || recurrenceInput.freq;
    if (!type && recurrenceInput.durationUnit) {
        switch (recurrenceInput.durationUnit) {
            case 'days': type = 'DAILY'; break;
            case 'weeks': type = 'WEEKLY'; break;
            case 'months': type = 'MONTHLY'; break;
            case 'years': type = 'YEARLY'; break;
        }
    }
    const { interval = 1, weekdays, month, dayOfMonth, max, end } = recurrenceInput;
    let displayString = '';

    switch (type) {
        case 'DAILY':
            displayString = interval === 1 ? 'Every day' : `Every ${interval} days`;
            break;
        case 'WEEKLY':
            displayString = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
            if (weekdays && weekdays.length > 0) {
                // This part is tricky because rrule and dayspan have different weekday formats.
                // The existing code expects dayspan's format.
                // A more robust solution would be to convert rrule weekdays to dayspan format.
                if (typeof weekdays[0] === 'object' && weekdays[0] !== null && 'iso' in weekdays[0]) { // Heuristic for dayspan format
                    const sortedDays = [...weekdays].sort((a, b) => a.iso - b.iso);
                    displayString += ' on ' + sortedDays.map(wd => dayspanWeekdayMap[wd.iso]).join(', ');
                } else {
                    // Assuming rrule format like ['MO', 'TU'], which we don't handle yet.
                    console.warn("Weekday display for rrule format not fully implemented.");
                }
            }
            break;
        case 'MONTHLY':
            displayString = interval === 1 ? 'Every month' : `Every ${interval} months`;
            if (dayOfMonth) { // dayOfMonth is a number
                displayString += ` on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
            }
            break;
        case 'YEARLY':
            displayString = interval === 1 ? 'Every year' : `Every ${interval} years`;
            if (month) { // month is a Month enum value (e.g., Month.JANUARY)
                if (typeof month === 'object' && 'key' in month) { // Heuristic for dayspan format
                    displayString += ` in ${dayspanMonthMap[month.key]}`;
                }
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
    } else if (chore.due_date) {
        const effectiveDay = getEffectiveDueDate(chore); // Returns a Day object
        if (effectiveDay) {
            // Format Day object. For time, we'd need to store time with due_date.
            // Assuming due_date is just a date for now.
            displayDate = effectiveDay.format('L'); // MM/DD/YYYY

            // If chore.due_date was a JS Date with time:
            const jsDate = new Date(chore.due_date);
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

function isOverdue(chore) {
    if (chore.done) {
        return false;
    }
    const dueDate = getEffectiveDueDate(chore);
    if (!dueDate) {
        return false;
    }
    // Compare dueDate (a Day object) with today.
    // valueOf() gives the number of days since epoch, so it's a clean comparison.
    return dueDate.valueOf() < getToday().valueOf();
}

export {
    getToday, // Exporting function to get current day
    isChoreForToday,
    getEffectiveDueDate,
    isOverdue,
    choreSortFn,
    getScheduleDisplayString,
    getChoreDisplayDetails,
    // Potentially export ensureDay and createScheduleFromChore if needed elsewhere
};

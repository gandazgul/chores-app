import { Rule, StandardDateAdapter } from '../rschedule.js';

// Standard JavaScript Date object for 'today'
export const jsToday = new Date();
// Create StandardDateAdapter instances for the start and end of today for rSchedule operations
export const todayStartAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate()));
export const todayEndAdapter = new StandardDateAdapter(new Date(jsToday.getFullYear(), jsToday.getMonth(), jsToday.getDate(), 23, 59, 59, 999));

// Helper function to compare if two StandardDateAdapter instances are on the same calendar day
export function isSameDateAdapterDay(adapter1, adapter2) {
    if (!adapter1 || !adapter2 || !adapter1.date || !adapter2.date) return false;
    return adapter1.date.getFullYear() === adapter2.date.getFullYear() &&
           adapter1.date.getMonth() === adapter2.date.getMonth() &&
           adapter1.date.getDate() === adapter2.date.getDate();
}

export const isTaskForToday = (task) => {
    if (task.dueDate) { // task.dueDate is a JS Date
        const dueDateAdapter = new StandardDateAdapter(task.dueDate);
        return isSameDateAdapterDay(dueDateAdapter, todayStartAdapter);
    }
    if (task.recurrence && task.recurrence.start) { // task.recurrence.start is an adapter
        const rule = new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
        const occurrencesToday = rule.occurrences({
            start: todayStartAdapter,
            end: todayEndAdapter,
        }).next();
        return !occurrencesToday.done;
    }
    return !task.dueDate && !task.recurrence; // Tasks without due date or recurrence are not specifically "for today" unless manually marked or handled differently
};

export const getEffectiveDueDate = (task) => {
    if (task.dueDate) { // task.dueDate is a JS Date
        return new StandardDateAdapter(task.dueDate);
    }
    if (task.recurrence && task.recurrence.start) { // task.recurrence.start is an adapter
        const rule = new Rule(task.recurrence, { dateAdapter: StandardDateAdapter });
        // Get the next occurrence from the start of today
        const nextOccurrence = rule.occurrences({ start: todayStartAdapter }).next().value;
        return nextOccurrence ? nextOccurrence : null; // nextOccurrence is already an adapter
    }
    return null;
};

export const taskSortFn = (a, b) => {
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
};

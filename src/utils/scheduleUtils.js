import rrulePkg from "rrule";

const { rrulestr } = rrulePkg;

/**
 * Calculates the next occurrence date based on an RRULE string and the last completed date.
 * If there is no last completed date, it uses the current date as a starting point.
 *
 * @param {string} rruleString The RRULE string (e.g., "FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,WE,FR")
 * @param {Date | string | null} [lastCompletedDate=null] The date the chore was last completed.
 * @returns {Date | null} A Date object representing the next occurrence, or null if the rrule is invalid or has ended.
 */
export function calculateNextOccurrence(
  rruleString,
  lastCompletedDate = null,
) {
  try {
    const startDate = lastCompletedDate
      ? new Date(lastCompletedDate)
      : new Date();

    // Parse the rule, setting dtstart so it anchors correctly.
    const rule = rrulestr(rruleString, { dtstart: startDate });

    // rrule returns times in UTC based on the input date.
    // If we want the *next* occurrence strictly after the start date, we use `after`.
     // false means strictly after
    return rule.after(startDate, false);
  } catch (error) {
    console.error(`Invalid RRULE string: ${rruleString}`, error);
    return null;
  }
}

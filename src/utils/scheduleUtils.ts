import rrulePkg from "rrule";

const { rrulestr } = rrulePkg;

export function calculateNextOccurrence(
  rruleString: string,
  lastCompletedDate: Date | string | null = null,
): Date | null {
  try {
    const startDate = lastCompletedDate
      ? new Date(lastCompletedDate)
      : new Date();

    const rule = rrulestr(rruleString, { dtstart: startDate });

    return rule.after(startDate, false);
  } catch (error) {
    console.error(`Invalid RRULE string: ${rruleString}`, error);
    return null;
  }
}

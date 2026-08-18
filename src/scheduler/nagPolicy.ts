export interface QuietHours {
  start: string;
  end: string;
}

export interface NagSlot {
  slotKey: string;
  deliverAfter: string;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function toUtcSecond(date: Date): string {
  return new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString();
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${value}`);
  return { hour, minute };
}

export function resolveQuietHours(
  getEnv: (name: string) => string | undefined,
): QuietHours {
  const start = getEnv("QUIET_HOURS_START")?.trim() || "21:00";
  const end = getEnv("QUIET_HOURS_END")?.trim() || "08:00";
  parseTime(start);
  parseTime(end);
  return { start, end };
}

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
    second: value("second"),
  };
}

function localDateKey(date: Date, timeZone: string): string {
  const parts = localParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${
    String(parts.day).padStart(2, "0")
  }`;
}

function localDayNumber(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY,
  );
}

function fromDayNumber(
  day: number,
): { year: number; month: number; day: number } {
  const date = new Date(day * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function localInstant(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const target = {
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time.hour,
    minute: time.minute,
    second: 0,
  };
  const guess = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
  );
  const matches: Date[] = [];
  for (
    let offset = -36 * MS_PER_HOUR;
    offset <= 36 * MS_PER_HOUR;
    offset += 60_000
  ) {
    const candidate = new Date(guess + offset);
    const parts = localParts(candidate, timeZone);
    if (
      parts.year === target.year && parts.month === target.month &&
      parts.day === target.day && parts.hour === target.hour &&
      parts.minute === target.minute
    ) {
      matches.push(candidate);
      break;
    }
  }
  if (matches[0]) return matches[0];

  for (
    let offset = -36 * MS_PER_HOUR;
    offset <= 36 * MS_PER_HOUR;
    offset += 60_000
  ) {
    const candidate = new Date(guess + offset);
    const parts = localParts(candidate, timeZone);
    if (
      parts.year === target.year && parts.month === target.month &&
      parts.day === target.day &&
      (parts.hour > target.hour ||
        (parts.hour === target.hour && parts.minute > target.minute))
    ) {
      return candidate;
    }
  }
  return new Date(guess);
}

function minutes(time: { hour: number; minute: number }): number {
  return time.hour * 60 + time.minute;
}

function isInQuietHours(parts: LocalParts, quietHours: QuietHours): boolean {
  const start = minutes(parseTime(quietHours.start));
  const end = minutes(parseTime(quietHours.end));
  const current = parts.hour * 60 + parts.minute;
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function nextQuietEnd(
  date: Date,
  timeZone: string,
  quietHours: QuietHours,
): Date {
  const end = parseTime(quietHours.end);
  const parts = localParts(date, timeZone);
  const startMinute = minutes(parseTime(quietHours.start));
  const endMinute = minutes(end);
  const currentMinute = parts.hour * 60 + parts.minute;
  let day = localDayNumber(date, timeZone);
  if (startMinute > endMinute && currentMinute >= startMinute) day += 1;
  return localInstant(fromDayNumber(day), end, timeZone);
}

function applyQuietHours(
  slot: Date,
  timeZone: string,
  quietHours: QuietHours,
): Date {
  const parts = localParts(slot, timeZone);
  if (!isInQuietHours(parts, quietHours)) return slot;
  const release = nextQuietEnd(slot, timeZone, quietHours);
  if (release.getTime() - slot.getTime() <= MS_PER_HOUR) return release;
  return release;
}

export function assignedNagSlots(options: {
  dueDate: string;
  fromExclusive: string;
  now: Date;
  timeZone: string;
  quietHours: QuietHours;
}): NagSlot[] {
  const due = new Date(options.dueDate);
  const from = new Date(options.fromExclusive);
  const nowTime = options.now.getTime();
  if (Number.isNaN(due.getTime()) || Number.isNaN(from.getTime())) return [];

  const slots: Date[] = [
    due,
    new Date(due.getTime() + MS_PER_HOUR),
    new Date(due.getTime() + 4 * MS_PER_HOUR),
  ];
  const firstDailyStart = due.getTime() + 4 * MS_PER_HOUR;
  const startDay = localDayNumber(
    new Date(Math.min(from.getTime(), firstDailyStart) - MS_PER_DAY),
    options.timeZone,
  );
  const endDay = localDayNumber(options.now, options.timeZone) + 1;
  for (let day = startDay; day <= endDay; day++) {
    const localDate = fromDayNumber(day);
    for (const time of [{ hour: 9, minute: 0 }, { hour: 18, minute: 0 }]) {
      const slot = localInstant(localDate, time, options.timeZone);
      if (slot.getTime() > firstDailyStart) slots.push(slot);
    }
  }

  const unique = new Map<string, NagSlot>();
  for (const slot of slots) {
    const slotTime = slot.getTime();
    if (slotTime <= from.getTime() || slotTime > nowTime) continue;
    const slotKey = toUtcSecond(slot);
    const deliverAfter = toUtcSecond(
      applyQuietHours(slot, options.timeZone, options.quietHours),
    );
    unique.set(slotKey, { slotKey, deliverAfter });
  }
  return [...unique.values()].sort((left, right) =>
    left.slotKey.localeCompare(right.slotKey)
  );
}

export function quietHoursContain(
  instant: Date,
  timeZone: string,
  quietHours: QuietHours,
): boolean {
  return isInQuietHours(localParts(instant, timeZone), quietHours);
}

export const testInternals = { localInstant, localParts, localDateKey };

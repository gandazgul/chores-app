import type { ChoreStatus } from "../types.ts";

export interface WhatsNextCandidate {
  id: string;
  status: ChoreStatus;
  assignee_id: string | null;
  due_date: string | null;
}

export interface WhatsNextSelection<T extends WhatsNextCandidate> {
  dateKey: string | null;
  chores: T[];
}

function assertValidTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return timeZone;
  } catch (_error) {
    throw new Error(
      `HOUSEHOLD_TZ must be a valid IANA timezone. Received: ${timeZone}`,
    );
  }
}

export function resolveHouseholdTimeZone(value?: string | null): string {
  const candidate = value?.trim();
  if (!candidate) return "UTC";
  return assertValidTimeZone(candidate);
}

export function householdDateKey(
  value: string | Date,
  timeZone: string,
): string | null {
  assertValidTimeZone(timeZone);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function formatHouseholdDueDate(
  value: string | null,
  timeZone: string,
): string | null {
  if (!value) return null;
  assertValidTimeZone(timeZone);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat([], {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sortByDueDate<T extends WhatsNextCandidate>(chores: T[]): T[] {
  return [...chores].sort((left, right) => {
    const leftTime = left.due_date ? new Date(left.due_date).getTime() : 0;
    const rightTime = right.due_date ? new Date(right.due_date).getTime() : 0;
    return leftTime - rightTime;
  });
}

export function selectWhatsNextChores<T extends WhatsNextCandidate>(
  chores: T[],
  currentMemberId: string,
  now: Date,
  timeZone: string,
): WhatsNextSelection<T> {
  const todayKey = householdDateKey(now, timeZone);
  if (!todayKey) return { dateKey: null, chores: [] };

  const buckets = new Map<string, T[]>();
  for (const chore of chores) {
    if (chore.status !== "open") continue;
    if (chore.assignee_id !== currentMemberId) continue;
    if (!chore.due_date) continue;
    const key = householdDateKey(chore.due_date, timeZone);
    if (!key) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), chore]);
  }

  const keys = [...buckets.keys()].sort();
  const selectedKey = buckets.has(todayKey)
    ? todayKey
    : keys.find((key) => key > todayKey) ?? null;
  if (!selectedKey) return { dateKey: null, chores: [] };
  return {
    dateKey: selectedKey,
    chores: sortByDueDate(buckets.get(selectedKey) ?? []),
  };
}

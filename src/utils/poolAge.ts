const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatPoolAge(
  unassignedSince: string | null,
  nowMs: number,
): string | null {
  if (!unassignedSince) return null;

  const enteredAtMs = new Date(unassignedSince).getTime();
  if (Number.isNaN(enteredAtMs)) return null;

  const elapsedDays = Math.max(
    0,
    Math.floor((nowMs - enteredAtMs) / MS_PER_DAY),
  );
  if (elapsedDays === 0) return "In Pool for less than a day";
  if (elapsedDays === 1) return "In Pool for 1 day";
  return `In Pool for ${elapsedDays} days`;
}

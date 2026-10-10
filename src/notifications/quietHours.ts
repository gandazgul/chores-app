import type { DatabaseSync } from "node:sqlite";
import type { QuietHours } from "../scheduler/nagPolicy.ts";

export interface QuietHoursSettings {
  enabled: boolean;
  start: string;
  end: string;
}

interface SettingsRow {
  quiet_hours_enabled: number | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export function readQuietHoursSettings(
  db: DatabaseSync,
  userId: string,
  defaults: QuietHours,
): QuietHoursSettings | null {
  const row = db.prepare(`
    SELECT quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    FROM users WHERE id = ?
  `).get(userId) as unknown as SettingsRow | undefined;
  if (!row) return null;
  return {
    enabled: row.quiet_hours_enabled === null
      ? defaults.start !== defaults.end
      : row.quiet_hours_enabled === 1,
    start: row.quiet_hours_start ?? defaults.start,
    end: row.quiet_hours_end ?? defaults.end,
  };
}

export function recipientQuietHours(
  db: DatabaseSync,
  userId: string,
  defaults: QuietHours,
): QuietHours {
  const settings = readQuietHoursSettings(db, userId, defaults);
  if (!settings) return defaults;
  return settings.enabled
    ? { start: settings.start, end: settings.end }
    : { start: "00:00", end: "00:00" };
}

export function parseQuietHoursSettings(
  value: unknown,
): QuietHoursSettings | null {
  if (!value || typeof value !== "object") return null;
  const { enabled, start, end } = value as Record<string, unknown>;
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
  if (
    typeof enabled !== "boolean" || typeof start !== "string" ||
    typeof end !== "string" || !time.test(start) || !time.test(end) ||
    (enabled && start === end)
  ) return null;
  return { enabled, start, end };
}

export function saveQuietHoursSettings(
  db: DatabaseSync,
  userId: string,
  settings: QuietHoursSettings,
): void {
  db.prepare(`
    UPDATE users SET quiet_hours_enabled = ?, quiet_hours_start = ?,
      quiet_hours_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(settings.enabled ? 1 : 0, settings.start, settings.end, userId);
}

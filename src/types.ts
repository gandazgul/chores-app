export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Recurrence {
  rrule: string;
}

export type SQLiteBoolean = 0 | 1;

export interface ChoreRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: number | null;
  done: SQLiteBoolean;
  due_date: string | null;
  remind_until_done: SQLiteBoolean;
  notification_sent_at: string | null;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompletionLogRow {
  id: string;
  chore_id: string;
  completed_at: string;
}

export interface Chore extends Omit<ChoreRow, "recurrence"> {
  recurrence: Recurrence | string | null;
}

export function parseRecurrence(
  recurrence: ChoreRow["recurrence"],
): Recurrence | string | null {
  if (typeof recurrence !== "string") {
    return recurrence;
  }

  try {
    const parsed: unknown = JSON.parse(recurrence);
    if (
      typeof parsed === "object" && parsed !== null && "rrule" in parsed &&
      typeof parsed.rrule === "string"
    ) {
      return { rrule: parsed.rrule };
    }
  } catch (_error) {
    // Preserve the existing fallback behavior for malformed stored recurrence.
  }

  return recurrence;
}

export function parseChoreRow(row: ChoreRow): Chore {
  return {
    ...row,
    recurrence: parseRecurrence(row.recurrence),
  };
}

export function parseChoreRows(rows: ChoreRow[]): Chore[] {
  return rows.map(parseChoreRow);
}

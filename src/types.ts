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
export type ChoreStatus = "open" | "completed" | "skipped";

export interface ChoreRow {
  id: string;
  user_id: string;
  assignee_id: string | null;
  unassigned_since: string | null;
  title: string;
  description: string | null;
  priority: number | null;
  done: SQLiteBoolean;
  due_date: string | null;
  remind_until_done: SQLiteBoolean;
  nag_eligible_since: string | null;
  recurrence: string | null;
  status: ChoreStatus;
  recurrence_parent_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  name: string | null;
  picture: string | null;
}

export interface CompletionLogRow {
  id: string;
  chore_id: string;
  completed_at: string;
  due_at: string | null;
  resolution: "completed" | "skipped";
}

export type NotificationSendResult =
  | { status: "sent" }
  | { status: "disabled" }
  | {
    status: "undeliverable";
    reason: "missing_token" | "auth_rejected" | "gotify_rejected";
  }
  | {
    status: "retryable_failure";
    reason: "network_error" | "gotify_unavailable";
  };

export interface NotificationSendInput {
  recipientId: string;
  title: string;
}

export interface NotificationPort {
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
}

export type NotificationDeliveryKind = "assigned_nag" | "pool_blast";
export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "superseded"
  | "undeliverable";

export interface NotificationDeliveryRow {
  id: string;
  chore_id: string;
  recipient_id: string;
  kind: NotificationDeliveryKind;
  slot_key: string;
  deliver_after: string;
  status: NotificationDeliveryStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  last_error_code: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
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

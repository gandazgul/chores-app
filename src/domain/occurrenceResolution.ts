import type { DatabaseSync } from "node:sqlite";
import type { ChoreRow, ChoreStatus, SQLiteBoolean } from "../types.ts";
import { parseRecurrence } from "../types.ts";
import { calculateNextOccurrence } from "../utils/scheduleUtils.ts";
import {
  anchorForAssignedNag,
  supersedePendingAssignedNagSlots,
} from "./assignedNagEligibility.ts";

export type OccurrenceResolution = "completed" | "skipped";

export interface OccurrencePatch {
  title?: string;
  description?: string | null;
  rrule?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  done?: boolean;
  remindUntilDone?: boolean;
  resolution?: OccurrenceResolution;
}

export interface UpdateOccurrenceOptions {
  now?: Date;
}

export type UpdateOccurrenceResult =
  | { kind: "updated"; chore: ChoreRow }
  | { kind: "not_found" }
  | { kind: "member_not_found" }
  | { kind: "invalid"; reason: string }
  | { kind: "conflict"; reason: string };

interface CountRow {
  count: number;
}

function syncDone(status: ChoreStatus): SQLiteBoolean {
  return status === "completed" ? 1 : 0;
}

function readChore(db: DatabaseSync, id: string): ChoreRow | undefined {
  return db.prepare("SELECT * FROM chores WHERE id = ?").get(id) as unknown as
    | ChoreRow
    | undefined;
}

function memberExists(db: DatabaseSync, memberId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE id = ?").get(memberId));
}

function hasChild(db: DatabaseSync, id: string): boolean {
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM chores WHERE recurrence_parent_id = ?",
  ).get(id) as unknown as CountRow;
  return Number(row.count) > 0;
}

function directSuccessor(
  db: DatabaseSync,
  id: string,
): ChoreRow | undefined {
  return db.prepare("SELECT * FROM chores WHERE recurrence_parent_id = ?").get(
    id,
  ) as unknown as ChoreRow | undefined;
}

function recurrenceJson(rrule: string | null): string | null {
  return rrule ? JSON.stringify({ rrule }) : null;
}

function nextDueDateIso(rrule: string, now: Date): string | null {
  const nextDueDate = calculateNextOccurrence(rrule, now);
  return nextDueDate ? nextDueDate.toISOString() : null;
}

function dueDateIsValid(value: string | null): boolean {
  return value === null || !Number.isNaN(new Date(value).getTime());
}

function buildFinalFields(
  db: DatabaseSync,
  row: ChoreRow,
  patch: OccurrencePatch,
  now: Date,
):
  | {
    kind: "fields";
    title: string;
    description: string | null;
    dueDate: string | null;
    recurrence: string | null;
    assigneeId: string | null;
    unassignedSince: string | null;
    remindUntilDone: SQLiteBoolean;
    nagEligibleSince: string | null;
    supersedeAssignedNag: boolean;
    changed: boolean;
  }
  | { kind: "member_not_found" }
  | { kind: "invalid"; reason: string } {
  let title = row.title;
  let description = row.description;
  let dueDate = row.due_date;
  let recurrence = row.recurrence;
  let assigneeId = row.assignee_id;
  let unassignedSince = row.unassigned_since;
  let remindUntilDone: SQLiteBoolean = row.remind_until_done;

  if (patch.title !== undefined) title = patch.title;
  if (patch.description !== undefined) description = patch.description;
  if (patch.rrule !== undefined) {
    recurrence = recurrenceJson(patch.rrule);
    if (patch.dueDate === undefined) {
      dueDate = patch.rrule ? nextDueDateIso(patch.rrule, now) : null;
    }
  }
  if (patch.dueDate !== undefined) {
    if (!dueDateIsValid(patch.dueDate)) {
      return { kind: "invalid", reason: "Invalid dueDate" };
    }
    dueDate = patch.dueDate;
  }
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId !== null && !memberExists(db, patch.assigneeId)) {
      return { kind: "member_not_found" };
    }
    if (patch.assigneeId !== row.assignee_id) {
      assigneeId = patch.assigneeId;
      unassignedSince = assigneeId === null ? now.toISOString() : null;
    }
  }
  if (patch.remindUntilDone !== undefined) {
    remindUntilDone = patch.remindUntilDone ? 1 : 0;
  }

  const scheduleChanged = dueDate !== row.due_date ||
    assigneeId !== row.assignee_id || remindUntilDone !== row.remind_until_done;
  const nextAnchor = scheduleChanged
    ? anchorForAssignedNag(
      {
        ...row,
        status: "open",
        assignee_id: assigneeId,
        due_date: dueDate,
        remind_until_done: remindUntilDone,
      },
      now,
    )
    : row.nag_eligible_since;
  const supersedeAssignedNag = scheduleChanged;
  const changed = title !== row.title || description !== row.description ||
    dueDate !== row.due_date || recurrence !== row.recurrence ||
    assigneeId !== row.assignee_id ||
    unassignedSince !== row.unassigned_since ||
    remindUntilDone !== row.remind_until_done ||
    nextAnchor !== row.nag_eligible_since;

  return {
    kind: "fields",
    title,
    description,
    dueDate,
    recurrence,
    assigneeId,
    unassignedSince,
    remindUntilDone,
    nagEligibleSince: nextAnchor,
    supersedeAssignedNag,
    changed,
  };
}

function updateChore(
  db: DatabaseSync,
  id: string,
  fields: {
    title: string;
    description: string | null;
    dueDate: string | null;
    recurrence: string | null;
    assigneeId: string | null;
    unassignedSince: string | null;
    remindUntilDone: SQLiteBoolean;
    nagEligibleSince: string | null;
    status: ChoreStatus;
    incrementRevision: boolean;
  },
) {
  db.prepare(`
    UPDATE chores
    SET title = ?,
        description = ?,
        due_date = ?,
        recurrence = ?,
        assignee_id = ?,
        unassigned_since = ?,
        remind_until_done = ?,
        nag_eligible_since = ?,
        status = ?,
        done = ?,
        revision = revision + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    fields.title,
    fields.description,
    fields.dueDate,
    fields.recurrence,
    fields.assigneeId,
    fields.unassignedSince,
    fields.remindUntilDone,
    fields.status === "open" ? fields.nagEligibleSince : null,
    fields.status,
    syncDone(fields.status),
    fields.incrementRevision ? 1 : 0,
    id,
  );
}

function insertCompletionLog(
  db: DatabaseSync,
  choreId: string,
  dueAt: string | null,
  resolution: OccurrenceResolution,
) {
  db.prepare(
    "INSERT INTO completion_logs (id, chore_id, due_at, resolution) VALUES (?, ?, ?, ?)",
  ).run(crypto.randomUUID(), choreId, dueAt, resolution);
}

function insertSuccessor(
  db: DatabaseSync,
  parent: ChoreRow,
  fields: {
    title: string;
    description: string | null;
    dueDate: string | null;
    recurrence: string | null;
    assigneeId: string | null;
    remindUntilDone: SQLiteBoolean;
  },
  now: Date,
) {
  const parsedRecurrence = parseRecurrence(fields.recurrence);
  if (
    typeof parsedRecurrence !== "object" || parsedRecurrence === null ||
    typeof parsedRecurrence.rrule !== "string"
  ) {
    return;
  }

  const nextDueDate = calculateNextOccurrence(
    parsedRecurrence.rrule,
    fields.dueDate ?? now,
  );
  if (!nextDueDate) {
    return;
  }

  db.prepare(`
    INSERT INTO chores (
      id,
      user_id,
      assignee_id,
      unassigned_since,
      title,
      description,
      due_date,
      recurrence,
      remind_until_done,
      nag_eligible_since,
      done,
      status,
      recurrence_parent_id,
      revision
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, 0)
  `).run(
    crypto.randomUUID(),
    parent.user_id,
    fields.assigneeId,
    fields.assigneeId === null ? now.toISOString() : null,
    fields.title,
    fields.description,
    nextDueDate.toISOString(),
    fields.recurrence,
    fields.remindUntilDone,
    anchorForAssignedNag(
      {
        ...parent,
        status: "open",
        assignee_id: fields.assigneeId,
        due_date: nextDueDate.toISOString(),
        remind_until_done: fields.remindUntilDone,
      },
      now,
    ),
    parent.id,
  );
}

function resolveOpenOccurrence(
  db: DatabaseSync,
  row: ChoreRow,
  fields: Extract<ReturnType<typeof buildFinalFields>, { kind: "fields" }>,
  now: Date,
  resolution: OccurrenceResolution,
) {
  supersedePendingAssignedNagSlots(db, row.id, now);
  updateChore(db, row.id, {
    ...fields,
    nagEligibleSince: null,
    status: resolution,
    incrementRevision: true,
  });
  insertSuccessor(db, row, fields, now);
  insertCompletionLog(db, row.id, fields.dueDate, resolution);
}

function reopenCompletedOccurrence(
  db: DatabaseSync,
  row: ChoreRow,
  fields: Extract<ReturnType<typeof buildFinalFields>, { kind: "fields" }>,
  now: Date,
): UpdateOccurrenceResult | null {
  const successor = directSuccessor(db, row.id);
  if (successor) {
    if (successor.status !== "open") {
      return { kind: "conflict", reason: "successor is resolved" };
    }
    if (Number(successor.revision) !== 0) {
      return { kind: "conflict", reason: "successor was edited" };
    }
    if (hasChild(db, successor.id)) {
      return { kind: "conflict", reason: "successor has advanced" };
    }
  }

  db.prepare("DELETE FROM completion_logs WHERE chore_id = ?").run(row.id);
  if (successor) {
    db.prepare("DELETE FROM chores WHERE id = ?").run(successor.id);
  }
  updateChore(db, row.id, {
    ...fields,
    nagEligibleSince: anchorForAssignedNag(
      {
        ...row,
        status: "open",
        assignee_id: fields.assigneeId,
        due_date: fields.dueDate,
        remind_until_done: fields.remindUntilDone,
      },
      now,
    ),
    status: "open",
    incrementRevision: true,
  });
  return null;
}

export function updateOccurrence(
  db: DatabaseSync,
  id: string,
  patch: OccurrencePatch,
  options: UpdateOccurrenceOptions = {},
): UpdateOccurrenceResult {
  const now = options.now ?? new Date();
  let inTransaction = false;

  try {
    db.exec("BEGIN IMMEDIATE;");
    inTransaction = true;

    const row = readChore(db, id);
    if (!row) {
      db.exec("ROLLBACK;");
      inTransaction = false;
      return { kind: "not_found" };
    }

    const fields = buildFinalFields(db, row, patch, now);
    if (fields.kind === "member_not_found") {
      db.exec("ROLLBACK;");
      inTransaction = false;
      return { kind: "member_not_found" };
    }
    if (fields.kind === "invalid") {
      db.exec("ROLLBACK;");
      inTransaction = false;
      return fields;
    }

    const status = row.status;
    const hasStatePatch = patch.done !== undefined;
    const requestedResolution: OccurrenceResolution | null = patch.resolution ??
      (hasStatePatch && patch.done === true ? "completed" : null);
    const stateChangesToResolved = requestedResolution !== null &&
      status === "open";
    const stateChangesToOpen = hasStatePatch && patch.done === false &&
      status === "completed";

    if (fields.supersedeAssignedNag) {
      supersedePendingAssignedNagSlots(db, row.id, now);
    }

    if (stateChangesToOpen) {
      const conflict = reopenCompletedOccurrence(db, row, fields, now);
      if (conflict) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return conflict;
      }
    } else if (stateChangesToResolved && requestedResolution) {
      resolveOpenOccurrence(db, row, fields, now, requestedResolution);
    } else if (fields.changed || row.done !== syncDone(status)) {
      updateChore(db, row.id, {
        ...fields,
        status,
        incrementRevision: fields.changed,
      });
    }

    const updated = readChore(db, id);
    db.exec("COMMIT;");
    inTransaction = false;

    if (!updated) return { kind: "not_found" };
    return { kind: "updated", chore: updated };
  } catch (error) {
    if (inTransaction) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Keep the original error visible.
      }
    }
    throw error;
  }
}

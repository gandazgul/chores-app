import type { DatabaseSync } from "node:sqlite";
import type { ChoreRow, ChoreStatus, SQLiteBoolean } from "../types.ts";
import { parseRecurrence } from "../types.ts";
import { calculateNextOccurrence } from "../utils/scheduleUtils.ts";

export interface OccurrencePatch {
  title?: string;
  description?: string | null;
  rrule?: string | null;
  done?: boolean;
}

export interface UpdateOccurrenceOptions {
  now?: Date;
}

export type UpdateOccurrenceResult =
  | { kind: "updated"; chore: ChoreRow }
  | { kind: "not_found" }
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

function buildFinalFields(
  row: ChoreRow,
  patch: OccurrencePatch,
  now: Date,
) {
  let title = row.title;
  let description = row.description;
  let dueDate = row.due_date;
  let recurrence = row.recurrence;

  if (patch.title !== undefined) {
    title = patch.title;
  }
  if (patch.description !== undefined) {
    description = patch.description;
  }
  if (patch.rrule !== undefined) {
    recurrence = recurrenceJson(patch.rrule);
    dueDate = patch.rrule ? nextDueDateIso(patch.rrule, now) : null;
  }

  const metadataChanged = title !== row.title ||
    description !== row.description || dueDate !== row.due_date ||
    recurrence !== row.recurrence;

  return { title, description, dueDate, recurrence, metadataChanged };
}

function updateChore(
  db: DatabaseSync,
  id: string,
  fields: {
    title: string;
    description: string | null;
    dueDate: string | null;
    recurrence: string | null;
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
) {
  db.prepare(
    "INSERT INTO completion_logs (id, chore_id, due_at) VALUES (?, ?, ?)",
  ).run(crypto.randomUUID(), choreId, dueAt);
}

function insertSuccessor(
  db: DatabaseSync,
  parent: ChoreRow,
  fields: {
    title: string;
    description: string | null;
    recurrence: string | null;
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

  const nextDueDate = calculateNextOccurrence(parsedRecurrence.rrule, now);
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
      done,
      status,
      recurrence_parent_id,
      revision
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, 0)
  `).run(
    crypto.randomUUID(),
    parent.user_id,
    parent.assignee_id,
    parent.assignee_id === null ? now.toISOString() : null,
    fields.title,
    fields.description,
    nextDueDate.toISOString(),
    fields.recurrence,
    parent.id,
  );
}

function completeOpenOccurrence(
  db: DatabaseSync,
  row: ChoreRow,
  fields: ReturnType<typeof buildFinalFields>,
  now: Date,
) {
  updateChore(db, row.id, {
    ...fields,
    status: "completed",
    incrementRevision: true,
  });
  insertSuccessor(db, row, fields, now);
  insertCompletionLog(db, row.id, fields.dueDate);
}

function reopenCompletedOccurrence(
  db: DatabaseSync,
  row: ChoreRow,
  fields: ReturnType<typeof buildFinalFields>,
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

    const fields = buildFinalFields(row, patch, now);
    const status = row.status;
    const hasStatePatch = patch.done !== undefined;
    const stateChangesToCompleted = hasStatePatch && patch.done === true &&
      status === "open";
    const stateChangesToOpen = hasStatePatch && patch.done === false &&
      status === "completed";

    if (stateChangesToOpen) {
      const conflict = reopenCompletedOccurrence(db, row, fields);
      if (conflict) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return conflict;
      }
    } else if (stateChangesToCompleted) {
      completeOpenOccurrence(db, row, fields, now);
    } else if (fields.metadataChanged || row.done !== syncDone(status)) {
      updateChore(db, row.id, {
        ...fields,
        status,
        incrementRevision: fields.metadataChanged,
      });
    }

    const updated = readChore(db, id);
    db.exec("COMMIT;");
    inTransaction = false;

    if (!updated) {
      return { kind: "not_found" };
    }
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

import type { DatabaseSync } from "node:sqlite";
import type { ChoreRow } from "../types.ts";

export type AssignmentAction = "claim" | "assign" | "release" | "reassign";

export type AssignmentCommand =
  | { action: "claim" }
  | { action: "assign"; assigneeId: string }
  | { action: "release" }
  | { action: "reassign"; assigneeId: string };

export type AssignmentResult =
  | { kind: "updated"; chore: ChoreRow }
  | { kind: "chore_not_found" }
  | { kind: "member_not_found" }
  | { kind: "conflict"; reason: string };

export interface TransitionAssignmentOptions {
  now?: Date;
}

function readChore(db: DatabaseSync, choreId: string): ChoreRow | undefined {
  return db.prepare("SELECT * FROM chores WHERE id = ?").get(choreId) as
    | ChoreRow
    | undefined;
}

function memberExists(db: DatabaseSync, memberId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE id = ?").get(memberId));
}

function updateAssignment(
  db: DatabaseSync,
  choreId: string,
  assigneeId: string | null,
  unassignedSince: string | null,
  updatedAt: string,
) {
  db.prepare(`
    UPDATE chores
    SET assignee_id = ?,
        unassigned_since = ?,
        revision = revision + 1,
        updated_at = ?
    WHERE id = ?
  `).run(assigneeId, unassignedSince, updatedAt, choreId);
}

export function transitionAssignment(
  db: DatabaseSync,
  choreId: string,
  actorId: string,
  command: AssignmentCommand,
  options: TransitionAssignmentOptions = {},
): AssignmentResult {
  const now = options.now ?? new Date();
  let inTransaction = false;

  try {
    db.exec("BEGIN IMMEDIATE;");
    inTransaction = true;

    const chore = readChore(db, choreId);
    if (!chore) {
      db.exec("ROLLBACK;");
      inTransaction = false;
      return { kind: "chore_not_found" };
    }

    if (chore.status !== "open") {
      db.exec("ROLLBACK;");
      inTransaction = false;
      return { kind: "conflict", reason: "chore is resolved" };
    }

    let assigneeId: string | null;
    let unassignedSince: string | null;

    if (command.action === "claim") {
      if (!memberExists(db, actorId)) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "member_not_found" };
      }
      if (chore.assignee_id !== null) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "conflict", reason: "chore is already assigned" };
      }
      assigneeId = actorId;
      unassignedSince = null;
    } else if (command.action === "assign") {
      if (!memberExists(db, command.assigneeId)) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "member_not_found" };
      }
      if (chore.assignee_id !== null) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "conflict", reason: "chore is already assigned" };
      }
      assigneeId = command.assigneeId;
      unassignedSince = null;
    } else if (command.action === "release") {
      if (chore.assignee_id === null) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "conflict", reason: "chore is already in Pool" };
      }
      assigneeId = null;
      unassignedSince = now.toISOString();
    } else {
      if (!memberExists(db, command.assigneeId)) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "member_not_found" };
      }
      if (chore.assignee_id === null) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return { kind: "conflict", reason: "chore is in Pool" };
      }
      if (chore.assignee_id === command.assigneeId) {
        db.exec("ROLLBACK;");
        inTransaction = false;
        return {
          kind: "conflict",
          reason: "chore is already assigned to Member",
        };
      }
      assigneeId = command.assigneeId;
      unassignedSince = null;
    }

    updateAssignment(
      db,
      chore.id,
      assigneeId,
      unassignedSince,
      now.toISOString(),
    );
    const updated = readChore(db, chore.id);
    db.exec("COMMIT;");
    inTransaction = false;

    if (!updated) {
      return { kind: "chore_not_found" };
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

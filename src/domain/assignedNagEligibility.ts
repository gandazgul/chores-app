import type { DatabaseSync } from "node:sqlite";
import type { ChoreRow } from "../types.ts";

export function shouldHaveAssignedNagAnchor(
  chore: Pick<
    ChoreRow,
    "status" | "assignee_id" | "due_date" | "remind_until_done"
  >,
): boolean {
  return chore.status === "open" && chore.assignee_id !== null &&
    chore.due_date !== null && chore.remind_until_done === 1;
}

export function anchorForAssignedNag(
  chore: Pick<
    ChoreRow,
    "status" | "assignee_id" | "due_date" | "remind_until_done"
  >,
  now: Date,
): string | null {
  return shouldHaveAssignedNagAnchor(chore) ? now.toISOString() : null;
}

export function supersedePendingAssignedNagSlots(
  db: DatabaseSync,
  choreId: string,
  now: Date,
) {
  db.prepare(`
    UPDATE notification_deliveries
    SET status = 'superseded',
        updated_at = ?
    WHERE chore_id = ?
      AND kind = 'assigned_nag'
      AND status = 'pending'
  `).run(now.toISOString(), choreId);
}

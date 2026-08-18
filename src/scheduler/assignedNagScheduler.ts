import type { DatabaseSync } from "node:sqlite";
import type {
  ChoreRow,
  NotificationDeliveryRow,
  NotificationPort,
  NotificationSendResult,
} from "../types.ts";
import { assignedNagSlots, type QuietHours } from "./nagPolicy.ts";

interface Logger {
  info?(event: Record<string, unknown>): void;
  warn?(event: Record<string, unknown>): void;
  error?(event: Record<string, unknown>): void;
  log?(event: Record<string, unknown>): void;
}

export interface AssignedNagSchedulerOptions {
  db: DatabaseSync;
  notificationPort: NotificationPort;
  timeZone: string;
  quietHours: QuietHours;
  batchSize: number;
  logger: Logger;
}

export interface AssignedNagScheduler {
  tick(now: Date): Promise<void>;
}

function log(
  logger: Logger,
  level: "info" | "warn" | "error",
  event: Record<string, unknown>,
) {
  const target = logger[level] ?? logger.log;
  if (target) target.call(logger, event);
}

function duePendingRows(db: DatabaseSync, now: Date, batchSize: number) {
  return db.prepare(`
    SELECT *
    FROM notification_deliveries
    WHERE status = 'pending'
      AND kind = 'assigned_nag'
      AND deliver_after <= ?
    ORDER BY deliver_after, slot_key, id
    LIMIT ?
  `).all(now.toISOString(), batchSize) as unknown as NotificationDeliveryRow[];
}

function eligibleChores(db: DatabaseSync): ChoreRow[] {
  return db.prepare(`
    SELECT *
    FROM chores
    WHERE status = 'open'
      AND assignee_id IS NOT NULL
      AND due_date IS NOT NULL
      AND remind_until_done = 1
      AND nag_eligible_since IS NOT NULL
  `).all() as unknown as ChoreRow[];
}

function maxRecordedSlotKey(db: DatabaseSync, choreId: string): string | null {
  const row = db.prepare(`
    SELECT MAX(slot_key) AS slot_key
    FROM notification_deliveries
    WHERE chore_id = ?
      AND kind = 'assigned_nag'
  `).get(choreId) as unknown as { slot_key: string | null };
  return row.slot_key;
}

function createSlots(
  db: DatabaseSync,
  options: AssignedNagSchedulerOptions,
  now: Date,
) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      UPDATE notification_deliveries
      SET status = 'superseded', updated_at = ?
      WHERE kind = 'assigned_nag'
        AND status = 'pending'
        AND NOT EXISTS (
          SELECT 1
          FROM chores
          WHERE chores.id = notification_deliveries.chore_id
            AND chores.status = 'open'
            AND chores.assignee_id = notification_deliveries.recipient_id
            AND chores.due_date IS NOT NULL
            AND chores.remind_until_done = 1
            AND chores.nag_eligible_since IS NOT NULL
        )
    `).run(now.toISOString());

    for (const chore of eligibleChores(db)) {
      const recorded = maxRecordedSlotKey(db, chore.id);
      const fromExclusive = recorded && recorded > chore.nag_eligible_since!
        ? recorded
        : chore.nag_eligible_since!;
      const slots = assignedNagSlots({
        dueDate: chore.due_date!,
        fromExclusive,
        now,
        timeZone: options.timeZone,
        quietHours: options.quietHours,
      });
      for (const slot of slots) {
        db.prepare(`
          INSERT OR IGNORE INTO notification_deliveries (
            id,
            chore_id,
            recipient_id,
            kind,
            slot_key,
            deliver_after,
            status
          )
          VALUES (?, ?, ?, 'assigned_nag', ?, ?, 'pending')
        `).run(
          crypto.randomUUID(),
          chore.id,
          chore.assignee_id,
          slot.slotKey,
          slot.deliverAfter,
        );
      }
    }

    db.prepare(`
      UPDATE notification_deliveries
      SET status = 'superseded', updated_at = ?
      WHERE id IN (
        SELECT earlier.id
        FROM notification_deliveries earlier
        JOIN notification_deliveries later
          ON later.chore_id = earlier.chore_id
         AND later.recipient_id = earlier.recipient_id
         AND later.kind = earlier.kind
         AND later.deliver_after = earlier.deliver_after
         AND later.status = 'pending'
         AND later.slot_key > earlier.slot_key
        WHERE earlier.status = 'pending'
          AND earlier.kind = 'assigned_nag'
      )
    `).run(now.toISOString());

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function readEligibleForDelivery(
  db: DatabaseSync,
  row: NotificationDeliveryRow,
): ChoreRow | undefined {
  return db.prepare(`
    SELECT *
    FROM chores
    WHERE id = ?
      AND status = 'open'
      AND assignee_id = ?
      AND due_date IS NOT NULL
      AND remind_until_done = 1
      AND nag_eligible_since IS NOT NULL
  `).get(row.chore_id, row.recipient_id) as unknown as ChoreRow | undefined;
}

function errorCode(result: NotificationSendResult): string | null {
  if (result.status === "sent" || result.status === "disabled") return null;
  return result.reason;
}

function recordResult(
  db: DatabaseSync,
  row: NotificationDeliveryRow,
  result: NotificationSendResult,
  now: Date,
) {
  const nowIso = now.toISOString();
  if (result.status === "sent") {
    db.prepare(`
      UPDATE notification_deliveries
      SET status = 'sent',
          attempt_count = attempt_count + 1,
          last_attempt_at = ?,
          last_error_code = NULL,
          sent_at = ?,
          updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(nowIso, nowIso, nowIso, row.id);
    return;
  }
  if (result.status === "undeliverable") {
    db.prepare(`
      UPDATE notification_deliveries
      SET status = 'undeliverable',
          attempt_count = attempt_count + 1,
          last_attempt_at = ?,
          last_error_code = ?,
          updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(nowIso, errorCode(result), nowIso, row.id);
    return;
  }
  if (result.status === "retryable_failure") {
    db.prepare(`
      UPDATE notification_deliveries
      SET attempt_count = attempt_count + 1,
          last_attempt_at = ?,
          last_error_code = ?,
          updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(nowIso, errorCode(result), nowIso, row.id);
  }
}

async function deliverDueRows(
  options: AssignedNagSchedulerOptions,
  now: Date,
) {
  const rows = duePendingRows(options.db, now, options.batchSize);
  for (const row of rows) {
    const chore = readEligibleForDelivery(options.db, row);
    if (!chore) {
      options.db.prepare(`
        UPDATE notification_deliveries
        SET status = 'superseded', updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(now.toISOString(), row.id);
      continue;
    }

    try {
      const result = await options.notificationPort.send({
        recipientId: row.recipient_id,
        title: chore.title,
      });
      recordResult(options.db, row, result, now);
      log(options.logger, result.status === "sent" ? "info" : "warn", {
        event: "assigned_nag_delivery_result",
        deliveryId: row.id,
        choreId: row.chore_id,
        recipientId: row.recipient_id,
        status: result.status,
        reason: errorCode(result),
      });
    } catch (_error) {
      recordResult(
        options.db,
        row,
        { status: "retryable_failure", reason: "network_error" },
        now,
      );
      log(options.logger, "warn", {
        event: "assigned_nag_delivery_result",
        deliveryId: row.id,
        choreId: row.chore_id,
        recipientId: row.recipient_id,
        status: "retryable_failure",
        reason: "network_error",
      });
    }
  }
}

export function createAssignedNagScheduler(
  options: AssignedNagSchedulerOptions,
): AssignedNagScheduler {
  return {
    async tick(now: Date) {
      if (options.batchSize <= 0) return;
      createSlots(options.db, options, now);
      await deliverDueRows(options, now);
    },
  };
}

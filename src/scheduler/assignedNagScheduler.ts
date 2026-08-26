import type { DatabaseSync } from "node:sqlite";
import type {
  ChoreRow,
  NotificationDeliveryRow,
  NotificationPort,
  NotificationSendResult,
} from "../types.ts";
import {
  assignedNagSlots,
  poolBlastSlot,
  type QuietHours,
} from "./nagPolicy.ts";

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
  poolBlastLeadHours: number | null;
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
      AND kind IN ('assigned_nag', 'pool_blast')
      AND deliver_after <= ?
    ORDER BY updated_at, deliver_after, slot_key, id
    LIMIT ?
  `).all(now.toISOString(), batchSize) as unknown as NotificationDeliveryRow[];
}

function eligibleAssignedNagChores(db: DatabaseSync): ChoreRow[] {
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

function eligiblePoolBlastChores(db: DatabaseSync): ChoreRow[] {
  return db.prepare(`
    SELECT *
    FROM chores
    WHERE status = 'open'
      AND assignee_id IS NULL
      AND due_date IS NOT NULL
      AND remind_until_done = 1
      AND unassigned_since IS NOT NULL
  `).all() as unknown as ChoreRow[];
}

function userIds(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT id FROM users ORDER BY id")
    .all() as unknown as { id: string }[];
  return rows.map((row) => row.id);
}

function maxRecordedAssignedNagSlotKey(
  db: DatabaseSync,
  choreId: string,
): string | null {
  const row = db.prepare(`
    SELECT MAX(slot_key) AS slot_key
    FROM notification_deliveries
    WHERE chore_id = ?
      AND kind = 'assigned_nag'
  `).get(choreId) as unknown as { slot_key: string | null };
  return row.slot_key;
}

function poolEntryPrecedesSlot(
  chore: ChoreRow,
  slotKey: string,
): boolean {
  if (!chore.unassigned_since) return false;
  const enteredAt = new Date(chore.unassigned_since).getTime();
  const slotAt = new Date(slotKey).getTime();
  if (Number.isNaN(enteredAt) || Number.isNaN(slotAt)) return false;
  return enteredAt < slotAt;
}

function currentPoolBlastSlot(
  chore: ChoreRow,
  options: AssignedNagSchedulerOptions,
) {
  const slot = poolBlastSlot({
    dueDate: chore.due_date,
    leadHours: options.poolBlastLeadHours,
    timeZone: options.timeZone,
    quietHours: options.quietHours,
  });
  if (!slot) return null;
  if (!poolEntryPrecedesSlot(chore, slot.slotKey)) return null;
  return slot;
}

function pendingPoolBlastRows(db: DatabaseSync): NotificationDeliveryRow[] {
  return db.prepare(`
    SELECT *
    FROM notification_deliveries
    WHERE kind = 'pool_blast'
      AND status = 'pending'
  `).all() as unknown as NotificationDeliveryRow[];
}

function choreById(db: DatabaseSync, choreId: string): ChoreRow | undefined {
  return db.prepare("SELECT * FROM chores WHERE id = ?").get(
    choreId,
  ) as unknown as ChoreRow | undefined;
}

function poolBlastRowMatchesCurrentSlot(
  options: AssignedNagSchedulerOptions,
  row: NotificationDeliveryRow,
): boolean {
  const chore = choreById(options.db, row.chore_id);
  if (!chore) return false;
  if (
    chore.status !== "open" || chore.assignee_id !== null ||
    chore.remind_until_done !== 1
  ) return false;
  const slot = currentPoolBlastSlot(chore, options);
  return !!slot && row.slot_key === slot.slotKey;
}

function hasAttemptedPoolBlast(
  db: DatabaseSync,
  choreId: string,
  recipientId: string,
): boolean {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM notification_deliveries
    WHERE chore_id = ?
      AND recipient_id = ?
      AND kind = 'pool_blast'
      AND attempt_count > 0
  `).get(choreId, recipientId) as unknown as { count: number };
  return Number(row.count) > 0;
}

function supersedeStalePoolBlastRows(
  options: AssignedNagSchedulerOptions,
  now: Date,
) {
  for (const row of pendingPoolBlastRows(options.db)) {
    if (poolBlastRowMatchesCurrentSlot(options, row)) continue;
    options.db.prepare(`
      UPDATE notification_deliveries
      SET status = 'superseded', updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(now.toISOString(), row.id);
  }
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

    supersedeStalePoolBlastRows(options, now);

    for (const chore of eligibleAssignedNagChores(db)) {
      const recorded = maxRecordedAssignedNagSlotKey(db, chore.id);
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

    if (options.poolBlastLeadHours !== null) {
      const recipients = userIds(db);
      for (const chore of eligiblePoolBlastChores(db)) {
        const slot = currentPoolBlastSlot(chore, options);
        if (!slot || slot.slotKey > now.toISOString()) continue;
        for (const recipientId of recipients) {
          if (hasAttemptedPoolBlast(db, chore.id, recipientId)) continue;
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
            VALUES (?, ?, ?, 'pool_blast', ?, ?, 'pending')
          `).run(
            crypto.randomUUID(),
            chore.id,
            recipientId,
            slot.slotKey,
            slot.deliverAfter,
          );
        }
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
         AND later.status = 'pending'
         AND later.slot_key > earlier.slot_key
         AND (
           later.deliver_after = earlier.deliver_after
           OR (
             earlier.deliver_after > earlier.slot_key
             AND later.slot_key > earlier.deliver_after
             AND unixepoch(later.slot_key) <= unixepoch(earlier.deliver_after) + 3600
           )
         )
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
  options: AssignedNagSchedulerOptions,
  row: NotificationDeliveryRow,
): ChoreRow | undefined {
  if (row.kind === "assigned_nag") {
    return options.db.prepare(`
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

  if (!poolBlastRowMatchesCurrentSlot(options, row)) return undefined;
  return choreById(options.db, row.chore_id);
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
  if (result.status === "disabled") {
    db.prepare(`
      UPDATE notification_deliveries
      SET last_error_code = NULL,
          updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(nowIso, row.id);
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
    const chore = readEligibleForDelivery(options, row);
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
        event: "notification_delivery_result",
        kind: row.kind,
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
        event: "notification_delivery_result",
        kind: row.kind,
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

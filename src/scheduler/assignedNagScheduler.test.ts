import { DatabaseSync } from "node:sqlite";
import { assertEquals } from "@std/assert";
import { applyMigrations } from "../db/migrations/index.ts";
import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../types.ts";
import { createAssignedNagScheduler } from "./assignedNagScheduler.ts";

interface CountRow {
  count: number;
}

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  db.exec(`
    INSERT INTO users (id, email, name) VALUES ('u', 'u@x', 'User');
    INSERT INTO users (id, email, name) VALUES ('v', 'v@x', 'Other');
  `);
  return db;
}

function insertChore(db: DatabaseSync, fields: {
  id?: string;
  assigneeId?: string | null;
  title?: string;
  dueDate?: string | null;
  remindUntilDone?: 0 | 1;
  nagEligibleSince?: string | null;
  status?: string;
} = {}) {
  const id = fields.id ?? crypto.randomUUID();
  db.prepare(`
    INSERT INTO chores (
      id,
      user_id,
      assignee_id,
      title,
      due_date,
      remind_until_done,
      nag_eligible_since,
      status
    ) VALUES (?, 'u', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fields.assigneeId === undefined ? "u" : fields.assigneeId,
    fields.title ?? "Wash",
    fields.dueDate === undefined ? "2030-01-01T10:00:00.000Z" : fields.dueDate,
    fields.remindUntilDone ?? 1,
    fields.nagEligibleSince === undefined
      ? "2029-12-31T00:00:00.000Z"
      : fields.nagEligibleSince,
    fields.status ?? "open",
  );
  return id;
}

function count(db: DatabaseSync, sql: string): number {
  return Number((db.prepare(sql).get() as unknown as CountRow).count);
}

function makeScheduler(
  db: DatabaseSync,
  results: NotificationSendResult[] = [{ status: "sent" }],
) {
  const sent: NotificationSendInput[] = [];
  const port: NotificationPort = {
    send(input) {
      sent.push(input);
      return Promise.resolve(results.shift() ?? { status: "sent" });
    },
  };
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: port,
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    batchSize: 10,
    logger: console,
  });
  return { scheduler, sent };
}

Deno.test("real tick sends one overdue assigned chore and persists sent exactly once", async () => {
  const db = makeDb();
  insertChore(db);
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-01T10:00:30.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:40.000Z"));

  assertEquals(sent, [{ recipientId: "u", title: "Wash" }]);
  assertEquals(
    db.prepare("SELECT status, sent_at FROM notification_deliveries").get(),
    { status: "sent", sent_at: "2030-01-01T10:00:30.000Z" },
  );
  assertEquals(
    count(db, "SELECT COUNT(*) AS count FROM notification_deliveries"),
    1,
  );
});

Deno.test("tick ignores Pool disabled completed and anchorless chores", async () => {
  const db = makeDb();
  insertChore(db, { id: "pool", assigneeId: null });
  insertChore(db, { id: "disabled", remindUntilDone: 0 });
  insertChore(db, { id: "completed", status: "completed" });
  insertChore(db, { id: "anchorless", nagEligibleSince: null });
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-01T10:00:30.000Z"));

  assertEquals(sent, []);
  assertEquals(
    count(db, "SELECT COUNT(*) AS count FROM notification_deliveries"),
    0,
  );
});

Deno.test("quiet-hour coalescing sends one message for overnight slots", async () => {
  const db = makeDb();
  insertChore(db, {
    dueDate: "2030-01-01T22:00:00.000Z",
    nagEligibleSince: "2030-01-01T21:59:59.000Z",
  });
  const sent: NotificationSendInput[] = [];
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: {
      send: (input) => {
        sent.push(input);
        return Promise.resolve({ status: "sent" });
      },
    },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "09:00" },
    batchSize: 10,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-02T09:00:00.000Z"));

  assertEquals(sent.length, 1);
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM notification_deliveries WHERE status = 'superseded'",
    ),
    3,
  );
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM notification_deliveries WHERE status = 'sent'",
    ),
    1,
  );
});

Deno.test("delivery results keep retryable and disabled pending and make missing token terminal", async () => {
  const db = makeDb();
  insertChore(db);
  const { scheduler } = makeScheduler(db, [
    { status: "retryable_failure", reason: "network_error" },
    { status: "disabled" },
    { status: "undeliverable", reason: "missing_token" },
  ]);

  await scheduler.tick(new Date("2030-01-01T10:00:00.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:01.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:02.000Z"));

  assertEquals(
    db.prepare(
      "SELECT status, attempt_count, last_error_code FROM notification_deliveries",
    ).get(),
    {
      status: "undeliverable",
      attempt_count: 2,
      last_error_code: "missing_token",
    },
  );
});

Deno.test("stale pending rows become superseded before delivery", async () => {
  const db = makeDb();
  insertChore(db, { id: "c" });
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after)
    VALUES ('d', 'c', 'u', 'assigned_nag', '2030-01-01T10:00:00.000Z', '2030-01-01T10:00:00.000Z')
  `).run();
  db.prepare("UPDATE chores SET status = 'completed' WHERE id = 'c'").run();
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-01T10:00:30.000Z"));

  assertEquals(sent, []);
  assertEquals(
    db.prepare("SELECT status FROM notification_deliveries WHERE id = 'd'")
      .get(),
    { status: "superseded" },
  );
});

Deno.test("batch ordering is stable and finite", async () => {
  const db = makeDb();
  insertChore(db, { id: "a", title: "A" });
  insertChore(db, { id: "b", title: "B" });
  const sent: NotificationSendInput[] = [];
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: {
      send: (input) => {
        sent.push(input);
        return Promise.resolve({ status: "sent" });
      },
    },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    batchSize: 1,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-01T10:00:00.000Z"));

  assertEquals(sent.length, 1);
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM notification_deliveries WHERE status = 'pending'",
    ),
    1,
  );
});

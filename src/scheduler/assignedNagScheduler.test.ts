import { DatabaseSync } from "node:sqlite";
import { assertEquals } from "@std/assert";
import { applyMigrations } from "../db/migrations/index.ts";
import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../types.ts";
import { updateOccurrence } from "../domain/occurrenceResolution.ts";
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
  unassignedSince?: string | null;
  remindUntilDone?: 0 | 1;
  nagEligibleSince?: string | null;
  status?: string;
  recurrence?: string | null;
} = {}) {
  const id = fields.id ?? crypto.randomUUID();
  db.prepare(`
    INSERT INTO chores (
      id,
      user_id,
      assignee_id,
      unassigned_since,
      title,
      due_date,
      remind_until_done,
      nag_eligible_since,
      status,
      recurrence
    ) VALUES (?, 'u', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fields.assigneeId === undefined ? "u" : fields.assigneeId,
    fields.unassignedSince === undefined ? null : fields.unassignedSince,
    fields.title ?? "Wash",
    fields.dueDate === undefined ? "2030-01-01T10:00:00.000Z" : fields.dueDate,
    fields.remindUntilDone ?? 1,
    fields.nagEligibleSince === undefined
      ? "2029-12-31T00:00:00.000Z"
      : fields.nagEligibleSince,
    fields.status ?? "open",
    fields.recurrence ?? null,
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
    poolBlastLeadHours: null,
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

Deno.test("tick ignores Pool disabled completed skipped and anchorless chores", async () => {
  const db = makeDb();
  insertChore(db, { id: "pool", assigneeId: null });
  insertChore(db, { id: "disabled", remindUntilDone: 0 });
  insertChore(db, { id: "completed", status: "completed" });
  insertChore(db, { id: "skipped", status: "skipped" });
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
    poolBlastLeadHours: null,
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

Deno.test("quiet-hours forward coalescing supersedes a deferred row when the next ladder slot sends", async () => {
  const db = makeDb();
  insertChore(db, {
    id: "c",
    dueDate: "2030-01-01T07:30:00.000Z",
    nagEligibleSince: "2030-01-01T07:29:59.000Z",
  });
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after)
    VALUES ('deferred', 'c', 'u', 'assigned_nag', '2030-01-01T07:30:00.000Z', '2030-01-01T08:00:00.000Z')
  `).run();
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-01T08:30:00.000Z"));

  assertEquals(sent, [{ recipientId: "u", title: "Wash" }]);
  assertEquals(
    db.prepare(`
      SELECT slot_key, status
      FROM notification_deliveries
      ORDER BY slot_key
    `).all(),
    [
      { slot_key: "2030-01-01T07:30:00.000Z", status: "superseded" },
      { slot_key: "2030-01-01T08:30:00.000Z", status: "sent" },
    ],
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

Deno.test("Skip supersedes pending Nags and the recurring successor can Nag", async () => {
  const db = makeDb();
  const id = insertChore(db, {
    id: "skip-parent",
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after)
    VALUES ('pending-parent', ?, 'u', 'assigned_nag', '2030-01-01T10:00:00.000Z', '2030-01-01T10:00:00.000Z')
  `).run(id);

  updateOccurrence(db, id, { resolution: "skipped" }, {
    now: new Date("2030-01-02T10:00:00.000Z"),
  });
  const child = db.prepare(
    "SELECT id, nag_eligible_since FROM chores WHERE recurrence_parent_id = ?",
  ).get(id) as { id: string; nag_eligible_since: string | null };
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-03T10:00:30.000Z"));

  assertEquals(
    db.prepare(
      "SELECT status FROM notification_deliveries WHERE id = 'pending-parent'",
    )
      .get(),
    { status: "superseded" },
  );
  assertEquals(child.nag_eligible_since, "2030-01-02T10:00:00.000Z");
  assertEquals(sent.length > 0, true);
  assertEquals(
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM notification_deliveries
       WHERE chore_id = '${child.id}' AND status = 'sent'`,
    ) > 0,
    true,
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
    poolBlastLeadHours: null,
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

Deno.test("Pool Blast disabled creates no rows and supersedes old pending rows", async () => {
  const db = makeDb();
  insertChore(db, {
    id: "pool",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after)
    VALUES ('old', 'pool', 'u', 'pool_blast', '2030-01-01T10:00:00.000Z', '2030-01-01T10:00:00.000Z')
  `).run();
  const { scheduler, sent } = makeScheduler(db);

  await scheduler.tick(new Date("2030-01-01T10:00:00.000Z"));

  assertEquals(sent, []);
  assertEquals(
    db.prepare("SELECT status FROM notification_deliveries WHERE id = 'old'")
      .get(),
    { status: "superseded" },
  );
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM notification_deliveries WHERE kind = 'pool_blast' AND status = 'pending'",
    ),
    0,
  );
});

Deno.test("Pool Blast creates one slot for every Member and not across restarts", async () => {
  const db = makeDb();
  insertChore(db, {
    id: "pool",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    dueDate: "2030-01-02T10:00:00.789Z",
  });
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: { send: () => Promise.resolve({ status: "disabled" }) },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    poolBlastLeadHours: 24,
    batchSize: 10,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-01T10:00:01.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:02.000Z"));

  assertEquals(
    db.prepare(`
      SELECT recipient_id, kind, slot_key, deliver_after, status
      FROM notification_deliveries
      ORDER BY recipient_id
    `).all(),
    [
      {
        recipient_id: "u",
        kind: "pool_blast",
        slot_key: "2030-01-01T10:00:00.000Z",
        deliver_after: "2030-01-01T10:00:00.000Z",
        status: "pending",
      },
      {
        recipient_id: "v",
        kind: "pool_blast",
        slot_key: "2030-01-01T10:00:00.000Z",
        deliver_after: "2030-01-01T10:00:00.000Z",
        status: "pending",
      },
    ],
  );
});

Deno.test("Pool Blast eligibility gates prevent late Pool entry and disabled reminders", async () => {
  const db = makeDb();
  insertChore(db, {
    id: "late-entry",
    assigneeId: null,
    unassignedSince: "2030-01-01T10:00:00.000Z",
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  insertChore(db, {
    id: "no-due",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    dueDate: null,
  });
  insertChore(db, {
    id: "disabled",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    remindUntilDone: 0,
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  insertChore(db, {
    id: "assigned",
    assigneeId: "u",
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: { send: () => Promise.resolve({ status: "sent" }) },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    poolBlastLeadHours: 24,
    batchSize: 10,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-01T10:00:01.000Z"));

  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM notification_deliveries WHERE kind = 'pool_blast'",
    ),
    0,
  );
});

Deno.test("Pool Blast replaces stale unattempted slots and blocks replacements after an attempt", async () => {
  const db = makeDb();
  insertChore(db, {
    id: "pool",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after, attempt_count)
    VALUES ('unattempted', 'pool', 'u', 'pool_blast', '2030-01-01T09:00:00.000Z', '2030-01-01T09:00:00.000Z', 0)
  `).run();
  db.prepare(`
    INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after, attempt_count)
    VALUES ('attempted', 'pool', 'v', 'pool_blast', '2030-01-01T09:00:00.000Z', '2030-01-01T09:00:00.000Z', 1)
  `).run();
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: { send: () => Promise.resolve({ status: "disabled" }) },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    poolBlastLeadHours: 24,
    batchSize: 10,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-01T10:00:01.000Z"));

  assertEquals(
    db.prepare(`
      SELECT recipient_id, slot_key, status, attempt_count
      FROM notification_deliveries
      WHERE kind = 'pool_blast'
      ORDER BY recipient_id, slot_key
    `).all(),
    [
      {
        recipient_id: "u",
        slot_key: "2030-01-01T09:00:00.000Z",
        status: "superseded",
        attempt_count: 0,
      },
      {
        recipient_id: "u",
        slot_key: "2030-01-01T10:00:00.000Z",
        status: "pending",
        attempt_count: 0,
      },
      {
        recipient_id: "v",
        slot_key: "2030-01-01T09:00:00.000Z",
        status: "superseded",
        attempt_count: 1,
      },
    ],
  );
});

Deno.test("Pool Blast delivery isolates recipient results and shares a fair batch", async () => {
  const db = makeDb();
  db.exec("INSERT INTO users (id, email, name) VALUES ('w', 'w@x', 'Third');");
  insertChore(db, {
    id: "assigned",
    title: "Assigned",
    assigneeId: "u",
    dueDate: "2030-01-01T10:00:00.000Z",
  });
  insertChore(db, {
    id: "pool",
    title: "Pool",
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
    dueDate: "2030-01-02T10:00:00.000Z",
  });
  const sent: NotificationSendInput[] = [];
  const outcomes: Array<NotificationSendResult | "throw"> = [
    { status: "disabled" },
    { status: "retryable_failure", reason: "network_error" },
    "throw",
    { status: "sent" },
    { status: "sent" },
    { status: "sent" },
    { status: "sent" },
    { status: "sent" },
  ];
  const scheduler = createAssignedNagScheduler({
    db,
    notificationPort: {
      send: (input) => {
        sent.push(input);
        const outcome = outcomes.shift() ?? { status: "sent" };
        if (outcome === "throw") throw new Error("network");
        return Promise.resolve(outcome);
      },
    },
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
    poolBlastLeadHours: 24,
    batchSize: 2,
    logger: console,
  });

  await scheduler.tick(new Date("2030-01-01T10:00:00.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:01.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:02.000Z"));
  await scheduler.tick(new Date("2030-01-01T10:00:03.000Z"));

  assertEquals(sent.length >= 5, true);
  assertEquals(
    db.prepare(`
      SELECT recipient_id, status, last_attempt_at IS NULL AS no_attempt_time
      FROM notification_deliveries
      WHERE kind = 'pool_blast'
      ORDER BY recipient_id
    `).all(),
    [
      { recipient_id: "u", status: "sent", no_attempt_time: 0 },
      { recipient_id: "v", status: "sent", no_attempt_time: 0 },
      { recipient_id: "w", status: "sent", no_attempt_time: 0 },
    ],
  );
});

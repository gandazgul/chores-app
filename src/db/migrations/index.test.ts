import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { baselineMigration } from "./0001_baseline.ts";
import { occurrenceResolutionMigration } from "./0002_occurrence_resolution.ts";
import { userNamesMigration } from "./0003_user_names.ts";
import { householdAssignmentMigration } from "./0004_household_assignment.ts";
import { gotifyTokenMigration } from "./0005_gotify_token.ts";
import { notificationDeliveriesMigration } from "./0006_notification_deliveries.ts";
import { applyMigrations } from "./index.ts";

interface CountRow {
  count: number;
}

interface TableInfoRow {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ForeignKeyRow {
  table: string;
  from: string;
  to: string;
  on_delete: string;
}

function ledgerCount(db: DatabaseSync): number {
  return Number(
    (db.prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as unknown as CountRow).count,
  );
}

function hasTable(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(name),
  );
}

function tableSignature(db: DatabaseSync): Record<string, TableInfoRow[]> {
  const signature: Record<string, TableInfoRow[]> = {};
  for (
    const table of [
      "users",
      "chores",
      "completion_logs",
      "notification_deliveries",
    ]
  ) {
    signature[table] = db.prepare(`PRAGMA table_info(${table})`)
      .all() as unknown as TableInfoRow[];
  }
  return signature;
}

function foreignKeySignature(
  db: DatabaseSync,
): Record<string, ForeignKeyRow[]> {
  return {
    chores: db.prepare("PRAGMA foreign_key_list(chores)")
      .all() as unknown as ForeignKeyRow[],
    completion_logs: db.prepare("PRAGMA foreign_key_list(completion_logs)")
      .all() as unknown as ForeignKeyRow[],
    notification_deliveries: db.prepare(
      "PRAGMA foreign_key_list(notification_deliveries)",
    ).all() as unknown as ForeignKeyRow[],
  };
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableInfoRow[]).map((row) => row.name);
}

function count(db: DatabaseSync, sql: string): number {
  return Number((db.prepare(sql).get() as unknown as CountRow).count);
}

function makeLegacyBaseline(db: DatabaseSync) {
  baselineMigration.up(db);
}

function makeVersion4(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  for (
    const migration of [
      baselineMigration,
      occurrenceResolutionMigration,
      userNamesMigration,
      householdAssignmentMigration,
    ]
  ) {
    migration.up(db);
    migration.validate(db);
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
      .run(migration.version, migration.name);
  }
}

Deno.test("user-name migration preserves version-2 users and adds nullable names", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES ('legacy-user', 'legacy@example.com', '2026-01-01 00:00:00', '2026-01-02 00:00:00');
  `);

  userNamesMigration.up(db);
  userNamesMigration.validate(db);

  assertEquals(columnNames(db, "users"), [
    "id",
    "email",
    "created_at",
    "updated_at",
    "name",
  ]);
  assertEquals(
    db.prepare(
      "SELECT id, email, created_at, updated_at, name FROM users WHERE id = ?",
    ).get("legacy-user"),
    {
      id: "legacy-user",
      email: "legacy@example.com",
      created_at: "2026-01-01 00:00:00",
      updated_at: "2026-01-02 00:00:00",
      name: null,
    },
  );
});

Deno.test("household-assignment migration backfills legacy open chores to the creator", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      name TEXT
    );
    CREATE TABLE chores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      priority INTEGER,
      done BOOLEAN DEFAULT 0,
      due_date TIMESTAMP,
      remind_until_done BOOLEAN DEFAULT 0,
      notification_sent_at TIMESTAMP,
      recurrence JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'open',
      recurrence_parent_id TEXT REFERENCES chores(id) ON DELETE SET NULL,
      revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE completion_logs (
      id TEXT PRIMARY KEY,
      chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      due_at TIMESTAMP
    );
    INSERT INTO users (id, email) VALUES ('legacy-user', 'legacy@example.com');
    INSERT INTO chores (id, user_id, title) VALUES ('legacy-chore', 'legacy-user', 'Legacy Chore');
    INSERT INTO chores (id, user_id, title, status) VALUES ('completed-chore', 'legacy-user', 'Completed Chore', 'completed');
  `);

  householdAssignmentMigration.up(db);
  householdAssignmentMigration.validate(db);

  assert(columnNames(db, "users").includes("picture"));
  assert(columnNames(db, "chores").includes("assignee_id"));
  assert(columnNames(db, "chores").includes("unassigned_since"));
  assertEquals(
    db.prepare(
      "SELECT assignee_id, unassigned_since FROM chores WHERE id = 'legacy-chore'",
    ).get(),
    { assignee_id: "legacy-user", unassigned_since: null },
  );
  assertEquals(
    db.prepare(
      "SELECT assignee_id, unassigned_since FROM chores WHERE id = 'completed-chore'",
    ).get(),
    { assignee_id: null, unassigned_since: null },
  );
  assertThrows(
    () =>
      db.prepare(
        "INSERT INTO chores (id, user_id, title, assignee_id) VALUES ('bad', 'legacy-user', 'Bad', 'missing')",
      ).run(),
    Error,
  );
});

Deno.test("gotify-token migration preserves existing users and adds a nullable token", () => {
  const db = new DatabaseSync(":memory:");
  makeVersion4(db);
  db.prepare(`
    INSERT INTO users (id, email, name, picture, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "legacy-user",
    "legacy@example.com",
    "Legacy Member",
    "https://example.com/member.png",
    "2026-01-01 00:00:00",
    "2026-01-02 00:00:00",
  );

  gotifyTokenMigration.up(db);
  gotifyTokenMigration.validate(db);

  assert(columnNames(db, "users").includes("gotify_token"));
  assertEquals(
    db.prepare(
      "SELECT id, email, name, picture, created_at, updated_at, gotify_token FROM users WHERE id = ?",
    ).get("legacy-user"),
    {
      id: "legacy-user",
      email: "legacy@example.com",
      name: "Legacy Member",
      picture: "https://example.com/member.png",
      created_at: "2026-01-01 00:00:00",
      updated_at: "2026-01-02 00:00:00",
      gotify_token: null,
    },
  );
});

Deno.test("fresh databases receive occurrence-resolution, user-name, assignment, gotify schema, and ledger rows", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);

  for (
    const table of [
      "users",
      "chores",
      "completion_logs",
      "notification_deliveries",
      "schema_migrations",
    ]
  ) {
    assert(hasTable(db, table), `${table} exists`);
  }
  assertEquals(ledgerCount(db), 7);
  assert(columnNames(db, "users").includes("name"));
  assert(columnNames(db, "users").includes("picture"));
  assert(columnNames(db, "users").includes("gotify_token"));
  assert(columnNames(db, "chores").includes("status"));
  assert(columnNames(db, "chores").includes("recurrence_parent_id"));
  assert(columnNames(db, "chores").includes("revision"));
  assert(columnNames(db, "chores").includes("assignee_id"));
  assert(columnNames(db, "chores").includes("unassigned_since"));
  assert(columnNames(db, "chores").includes("nag_eligible_since"));
  assert(!columnNames(db, "chores").includes("notification_sent_at"));
  assert(columnNames(db, "completion_logs").includes("due_at"));
  assert(columnNames(db, "notification_deliveries").includes("deliver_after"));
  assert(columnNames(db, "completion_logs").includes("resolution"));
});

Deno.test("baseline databases keep data, backfill status, and converge", () => {
  const fresh = new DatabaseSync(":memory:");
  applyMigrations(fresh);

  const legacy = new DatabaseSync(":memory:");
  legacy.exec("PRAGMA foreign_keys = ON;");
  makeLegacyBaseline(legacy);
  legacy.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(
    "legacy-user",
    "legacy@example.com",
  );
  legacy.prepare(
    "INSERT INTO chores (id, user_id, title, done, due_date) VALUES (?, ?, ?, ?, ?)",
  ).run(
    "open-chore",
    "legacy-user",
    "Open Chore",
    0,
    "2030-01-01T00:00:00.000Z",
  );
  legacy.prepare(
    "INSERT INTO chores (id, user_id, title, done, due_date) VALUES (?, ?, ?, ?, ?)",
  ).run(
    "done-chore",
    "legacy-user",
    "Done Chore",
    1,
    "2030-01-02T00:00:00.000Z",
  );
  legacy.prepare("INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)")
    .run("legacy-log", "done-chore");

  applyMigrations(legacy);

  assertEquals(tableSignature(legacy), tableSignature(fresh));
  assertEquals(foreignKeySignature(legacy), foreignKeySignature(fresh));
  assertEquals(ledgerCount(legacy), 7);
  assertEquals(
    legacy.prepare(
      "SELECT email, name, picture, gotify_token FROM users WHERE id = ?",
    ).get(
      "legacy-user",
    ),
    {
      email: "legacy@example.com",
      name: null,
      picture: null,
      gotify_token: null,
    },
  );
  assertEquals(
    legacy.prepare(
      "SELECT status, revision, assignee_id, unassigned_since FROM chores WHERE id = ?",
    ).get("open-chore"),
    {
      status: "open",
      revision: 0,
      assignee_id: "legacy-user",
      unassigned_since: null,
    },
  );
  assertEquals(
    legacy.prepare("SELECT status, revision FROM chores WHERE id = ?").get(
      "done-chore",
    ),
    { status: "completed", revision: 0 },
  );
  assertEquals(
    legacy.prepare(
      "SELECT due_at, resolution FROM completion_logs WHERE id = ?",
    )
      .get(
        "legacy-log",
      ),
    { due_at: "2030-01-02T00:00:00.000Z", resolution: "completed" },
  );
});

Deno.test("version-4 databases keep user data and converge with fresh databases", () => {
  const fresh = new DatabaseSync(":memory:");
  applyMigrations(fresh);

  const upgraded = new DatabaseSync(":memory:");
  makeVersion4(upgraded);
  upgraded.prepare(`
    INSERT INTO users (id, email, name, picture, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "version-four-user",
    "v4@example.com",
    "Version Four",
    null,
    "2026-03-01 00:00:00",
    "2026-03-02 00:00:00",
  );

  applyMigrations(upgraded);

  assertEquals(tableSignature(upgraded), tableSignature(fresh));
  assertEquals(ledgerCount(upgraded), 7);
  assertEquals(
    upgraded.prepare(
      "SELECT email, name, picture, created_at, updated_at, gotify_token FROM users WHERE id = ?",
    ).get("version-four-user"),
    {
      email: "v4@example.com",
      name: "Version Four",
      picture: null,
      created_at: "2026-03-01 00:00:00",
      updated_at: "2026-03-02 00:00:00",
      gotify_token: null,
    },
  );
});

Deno.test("occurrence constraints reject invalid states and duplicate links", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run("u", "u@x");
  db.prepare("INSERT INTO chores (id, user_id, title) VALUES (?, ?, ?)").run(
    "parent",
    "u",
    "Parent",
  );
  db.prepare(
    "INSERT INTO chores (id, user_id, title, recurrence_parent_id) VALUES (?, ?, ?, ?)",
  ).run("child", "u", "Child", "parent");
  db.prepare("INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)").run(
    "log",
    "parent",
  );

  assertThrows(
    () =>
      db.prepare("UPDATE chores SET status = 'bad' WHERE id = 'parent'")
        .run(),
    Error,
  );
  assertThrows(
    () =>
      db.prepare("UPDATE chores SET revision = -1 WHERE id = 'parent'")
        .run(),
    Error,
  );
  assertThrows(
    () =>
      db.prepare(
        "INSERT INTO chores (id, user_id, title, recurrence_parent_id) VALUES (?, ?, ?, ?)",
      ).run("child-two", "u", "Child Two", "parent"),
    Error,
  );
  assertThrows(
    () =>
      db.prepare("INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)")
        .run("log-two", "parent"),
    Error,
  );
  assertThrows(
    () =>
      db.prepare(
        "UPDATE completion_logs SET resolution = 'bad' WHERE id = 'log'",
      )
        .run(),
    Error,
  );
});

Deno.test("recurrence parent foreign key is set null when a parent is deleted", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  db.exec(`
    INSERT INTO users (id, email) VALUES ('u', 'u@x');
    INSERT INTO chores (id, user_id, title) VALUES ('parent', 'u', 'Parent');
    INSERT INTO chores (id, user_id, title, recurrence_parent_id)
      VALUES ('child', 'u', 'Child', 'parent');
    DELETE FROM chores WHERE id = 'parent';
  `);

  assertEquals(
    db.prepare("SELECT recurrence_parent_id FROM chores WHERE id = 'child'")
      .get(),
    { recurrence_parent_id: null },
  );
});

Deno.test("already current databases skip applied migrations", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  const firstSignature = tableSignature(db);

  applyMigrations(db);

  assertEquals(ledgerCount(db), 7);
  assertEquals(tableSignature(db), firstSignature);
});

Deno.test("incompatible pre-ledger schemas fail without data loss or a ledger row", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ${"users"}(id INTEGER PRIMARY KEY);`);
  db.prepare("INSERT INTO users VALUES (?)").run(7);

  assertThrows(
    () => applyMigrations(db),
    Error,
    "Migration 1 (0001_baseline) failed",
  );
  assertEquals(db.prepare("SELECT id FROM users").get(), { id: 7 });
  assert(!hasTable(db, "chores"));
  assert(!hasTable(db, "completion_logs"));
  assertEquals(ledgerCount(db), 0);
});

Deno.test("unknown ledger versions stop startup", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO schema_migrations (version, name) VALUES (999, 'future');
  `);

  assertThrows(
    () => applyMigrations(db),
    Error,
    "Unknown migration version recorded: 999",
  );
});

Deno.test("ledger version and name mismatches stop startup", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  db.exec("UPDATE schema_migrations SET name = 'tampered' WHERE version = 1;");

  assertThrows(
    () => applyMigrations(db),
    Error,
    "Migration 1 name mismatch",
  );
});

Deno.test("duplicate legacy completion logs fail migration without deleting data", () => {
  const db = new DatabaseSync(":memory:");
  makeLegacyBaseline(db);
  db.exec(`
    INSERT INTO users (id, email) VALUES ('u', 'u@x');
    INSERT INTO chores (id, user_id, title) VALUES ('c', 'u', 'Chore');
    INSERT INTO completion_logs (id, chore_id) VALUES ('l1', 'c');
    INSERT INTO completion_logs (id, chore_id) VALUES ('l2', 'c');
  `);

  assertThrows(
    () => applyMigrations(db),
    Error,
    "Migration 2 (0002_occurrence_resolution) failed",
  );
  assertEquals(count(db, "SELECT COUNT(*) AS count FROM completion_logs"), 2);
});

Deno.test("notification delivery migration backfills reminders and durable outbox schema", () => {
  const db = new DatabaseSync(":memory:");
  makeVersion4(db);
  gotifyTokenMigration.up(db);
  gotifyTokenMigration.validate(db);
  db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
    .run(gotifyTokenMigration.version, gotifyTokenMigration.name);
  db.exec(`
    INSERT INTO users (id, email) VALUES ('u', 'u@x');
    INSERT INTO chores (id, user_id, assignee_id, title, due_date, remind_until_done, status)
      VALUES ('open-assigned', 'u', 'u', 'Open Assigned', '2030-01-01T10:00:00.000Z', 0, 'open');
    INSERT INTO chores (id, user_id, assignee_id, title, due_date, remind_until_done, status)
      VALUES ('pool', 'u', NULL, 'Pool', '2030-01-01T10:00:00.000Z', 0, 'open');
    INSERT INTO chores (id, user_id, assignee_id, title, due_date, remind_until_done, status)
      VALUES ('completed', 'u', 'u', 'Done', '2030-01-01T10:00:00.000Z', 0, 'completed');
  `);

  notificationDeliveriesMigration.up(db);
  notificationDeliveriesMigration.validate(db);

  assert(!columnNames(db, "chores").includes("notification_sent_at"));
  assert(columnNames(db, "chores").includes("nag_eligible_since"));
  assert(hasTable(db, "notification_deliveries"));
  assertEquals(
    db.prepare(
      "SELECT remind_until_done, nag_eligible_since IS NOT NULL AS anchored FROM chores WHERE id = 'open-assigned'",
    ).get(),
    { remind_until_done: 1, anchored: 1 },
  );
  assertEquals(
    db.prepare(
      "SELECT remind_until_done, nag_eligible_since FROM chores WHERE id = 'pool'",
    ).get(),
    { remind_until_done: 1, nag_eligible_since: null },
  );
  assertThrows(
    () =>
      db.prepare(`
      INSERT INTO notification_deliveries (id, chore_id, recipient_id, kind, slot_key, deliver_after)
      VALUES ('bad', 'open-assigned', 'u', 'bad', '2030-01-01T10:00:00.000Z', '2030-01-01T10:00:00.000Z')
    `).run(),
    Error,
  );
});

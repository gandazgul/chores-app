import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { baselineMigration } from "./0001_baseline.ts";
import { userNamesMigration } from "./0003_user_names.ts";
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
  for (const table of ["users", "chores", "completion_logs"]) {
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

Deno.test("fresh databases receive occurrence-resolution, user-name schema, and ledger rows", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);

  for (
    const table of ["users", "chores", "completion_logs", "schema_migrations"]
  ) {
    assert(hasTable(db, table), `${table} exists`);
  }
  assertEquals(ledgerCount(db), 3);
  assert(columnNames(db, "users").includes("name"));
  assert(columnNames(db, "chores").includes("status"));
  assert(columnNames(db, "chores").includes("recurrence_parent_id"));
  assert(columnNames(db, "chores").includes("revision"));
  assert(columnNames(db, "completion_logs").includes("due_at"));
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
  assertEquals(ledgerCount(legacy), 3);
  assertEquals(
    legacy.prepare("SELECT email, name FROM users WHERE id = ?").get(
      "legacy-user",
    ),
    { email: "legacy@example.com", name: null },
  );
  assertEquals(
    legacy.prepare("SELECT status, revision FROM chores WHERE id = ?").get(
      "open-chore",
    ),
    { status: "open", revision: 0 },
  );
  assertEquals(
    legacy.prepare("SELECT status, revision FROM chores WHERE id = ?").get(
      "done-chore",
    ),
    { status: "completed", revision: 0 },
  );
  assertEquals(
    legacy.prepare("SELECT due_at FROM completion_logs WHERE id = ?").get(
      "legacy-log",
    ),
    { due_at: "2030-01-02T00:00:00.000Z" },
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

  assertEquals(ledgerCount(db), 3);
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

import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { baselineMigration } from "./0001_baseline.ts";
import { applyMigrations, type Migration } from "./index.ts";

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

function makeLegacyBaseline(db: DatabaseSync) {
  baselineMigration.up(db);
}

Deno.test("fresh databases receive the baseline schema and one ledger row", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);

  for (
    const table of ["users", "chores", "completion_logs", "schema_migrations"]
  ) {
    assert(hasTable(db, table), `${table} exists`);
  }
  assertEquals(ledgerCount(db), 1);
  baselineMigration.validate(db);
});

Deno.test("current legacy databases keep data and converge to the fresh schema", () => {
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
    "INSERT INTO chores (id, user_id, title, done) VALUES (?, ?, ?, ?)",
  ).run("legacy-chore", "legacy-user", "Legacy Chore", 0);
  legacy.prepare("INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)")
    .run(
      "legacy-log",
      "legacy-chore",
    );

  applyMigrations(legacy);

  assertEquals(tableSignature(legacy), tableSignature(fresh));
  assertEquals(foreignKeySignature(legacy), foreignKeySignature(fresh));
  assertEquals(ledgerCount(legacy), 1);
  assertEquals(
    legacy.prepare("SELECT email FROM users WHERE id = ?").get("legacy-user"),
    { email: "legacy@example.com" },
  );
  assertEquals(
    legacy.prepare("SELECT title FROM chores WHERE id = ?").get("legacy-chore"),
    { title: "Legacy Chore" },
  );
  assertEquals(
    legacy.prepare("SELECT chore_id FROM completion_logs WHERE id = ?").get(
      "legacy-log",
    ),
    { chore_id: "legacy-chore" },
  );
});

Deno.test("already current databases skip applied migrations", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  const firstSignature = tableSignature(db);

  applyMigrations(db);

  assertEquals(ledgerCount(db), 1);
  assertEquals(tableSignature(db), firstSignature);
});

Deno.test("a thrown migration rolls back its changes and leaves no ledger row", () => {
  const db = new DatabaseSync(":memory:");
  const failingMigration: Migration = {
    version: 1,
    name: "failing_migration",
    up(database) {
      database.exec("CREATE TABLE leaked(id INTEGER);");
      throw new Error("stop");
    },
    validate() {},
  };

  assertThrows(
    () => applyMigrations(db, [failingMigration]),
    Error,
    "Migration 1 (failing_migration) failed",
  );
  assert(!hasTable(db, "leaked"));
  assertEquals(ledgerCount(db), 0);
});

Deno.test("a failed validation rolls back its changes and leaves no ledger row", () => {
  const db = new DatabaseSync(":memory:");
  const invalidMigration: Migration = {
    version: 1,
    name: "invalid_migration",
    up(database) {
      database.exec("CREATE TABLE leaked(id INTEGER);");
    },
    validate() {
      throw new Error("invalid schema");
    },
  };

  assertThrows(
    () => applyMigrations(db, [invalidMigration]),
    Error,
    "Migration 1 (invalid_migration) failed",
  );
  assert(!hasTable(db, "leaked"));
  assertEquals(ledgerCount(db), 0);
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

Deno.test("malformed migration registries stop startup", () => {
  const first: Migration = { ...baselineMigration, name: "first" };
  const second: Migration = {
    ...baselineMigration,
    version: 1,
    name: "second",
  };
  const duplicateName: Migration = {
    ...baselineMigration,
    version: 2,
    name: "first",
  };

  assertThrows(
    () => applyMigrations(new DatabaseSync(":memory:"), [second, first]),
    Error,
    "strictly increasing",
  );
  assertThrows(
    () => applyMigrations(new DatabaseSync(":memory:"), [first, duplicateName]),
    Error,
    "Duplicate migration name",
  );
});

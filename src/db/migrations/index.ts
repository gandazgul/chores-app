import type { DatabaseSync } from "node:sqlite";
import { baselineMigration } from "./0001_baseline.ts";
import { occurrenceResolutionMigration } from "./0002_occurrence_resolution.ts";
import { userNamesMigration } from "./0003_user_names.ts";

export interface Migration {
  version: number;
  name: string;
  up(db: DatabaseSync): void;
  validate(db: DatabaseSync): void;
}

interface LedgerRow {
  version: number;
  name: string;
}

const migrations: Migration[] = [
  baselineMigration,
  occurrenceResolutionMigration,
  userNamesMigration,
];

function assertValidRegistry(registry: Migration[]) {
  let lastVersion = 0;
  const seenNames = new Set<string>();
  for (const migration of registry) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`Invalid migration version: ${migration.version}`);
    }
    if (migration.version <= lastVersion) {
      throw new Error("Migration registry must be strictly increasing");
    }
    if (seenNames.has(migration.name)) {
      throw new Error(`Duplicate migration name: ${migration.name}`);
    }
    lastVersion = migration.version;
    seenNames.add(migration.name);
  }
}

function ensureLedger(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function readLedger(db: DatabaseSync): LedgerRow[] {
  return db.prepare(
    "SELECT version, name FROM schema_migrations ORDER BY version",
  ).all() as unknown as LedgerRow[];
}

function assertKnownHistory(ledger: LedgerRow[]) {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );

  for (const row of ledger) {
    const migration = migrationsByVersion.get(row.version);
    if (!migration) {
      throw new Error(`Unknown migration version recorded: ${row.version}`);
    }
    if (migration.name !== row.name) {
      throw new Error(
        `Migration ${row.version} name mismatch: recorded ${row.name}, expected ${migration.name}`,
      );
    }
  }
}

export function applyMigrations(db: DatabaseSync) {
  assertValidRegistry(migrations);
  ensureLedger(db);

  const ledger = readLedger(db);
  assertKnownHistory(ledger);
  const appliedVersions = new Set(ledger.map((row) => row.version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    try {
      db.exec("BEGIN IMMEDIATE;");
      migration.up(db);
      migration.validate(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
      ).run(migration.version, migration.name);
      db.exec("COMMIT;");
    } catch (error) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback errors so the migration error stays visible.
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${message}`,
        { cause: error },
      );
    }
  }
}

import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
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

interface ExpectedColumn {
  name: string;
  type: string;
  notnull: number;
  dfltValue: string | null;
  pk: number;
}

const expectedColumns: Record<string, ExpectedColumn[]> = {
  users: [
    { name: "id", type: "TEXT", notnull: 0, dfltValue: null, pk: 1 },
    { name: "email", type: "TEXT", notnull: 1, dfltValue: null, pk: 0 },
    {
      name: "created_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: "CURRENT_TIMESTAMP",
      pk: 0,
    },
    {
      name: "updated_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: "CURRENT_TIMESTAMP",
      pk: 0,
    },
  ],
  chores: [
    { name: "id", type: "TEXT", notnull: 0, dfltValue: null, pk: 1 },
    { name: "user_id", type: "TEXT", notnull: 1, dfltValue: null, pk: 0 },
    { name: "title", type: "TEXT", notnull: 1, dfltValue: null, pk: 0 },
    { name: "description", type: "TEXT", notnull: 0, dfltValue: null, pk: 0 },
    { name: "priority", type: "INTEGER", notnull: 0, dfltValue: null, pk: 0 },
    { name: "done", type: "BOOLEAN", notnull: 0, dfltValue: "0", pk: 0 },
    { name: "due_date", type: "TIMESTAMP", notnull: 0, dfltValue: null, pk: 0 },
    {
      name: "remind_until_done",
      type: "BOOLEAN",
      notnull: 0,
      dfltValue: "0",
      pk: 0,
    },
    {
      name: "notification_sent_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: null,
      pk: 0,
    },
    { name: "recurrence", type: "JSON", notnull: 0, dfltValue: null, pk: 0 },
    {
      name: "created_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: "CURRENT_TIMESTAMP",
      pk: 0,
    },
    {
      name: "updated_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: "CURRENT_TIMESTAMP",
      pk: 0,
    },
  ],
  completion_logs: [
    { name: "id", type: "TEXT", notnull: 0, dfltValue: null, pk: 1 },
    { name: "chore_id", type: "TEXT", notnull: 1, dfltValue: null, pk: 0 },
    {
      name: "completed_at",
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: "CURRENT_TIMESTAMP",
      pk: 0,
    },
  ],
};

function normalizeDefault(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.replace(/^\((.*)\)$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function assertTableSchema(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableColumn[];
  const expected = expectedColumns[table];

  if (rows.length !== expected.length) {
    throw new Error(
      `${table} has ${rows.length} columns; expected ${expected.length}`,
    );
  }

  for (const expectedColumn of expected) {
    const actual = rows.find((row) => row.name === expectedColumn.name);
    if (!actual) {
      throw new Error(`${table}.${expectedColumn.name} is missing`);
    }
    if (actual.type.toUpperCase() !== expectedColumn.type) {
      throw new Error(
        `${table}.${expectedColumn.name} type is ${actual.type}; expected ${expectedColumn.type}`,
      );
    }
    if (actual.notnull !== expectedColumn.notnull) {
      throw new Error(
        `${table}.${expectedColumn.name} notnull is ${actual.notnull}; expected ${expectedColumn.notnull}`,
      );
    }
    if (normalizeDefault(actual.dflt_value) !== expectedColumn.dfltValue) {
      throw new Error(
        `${table}.${expectedColumn.name} default is ${actual.dflt_value}; expected ${expectedColumn.dfltValue}`,
      );
    }
    if (actual.pk !== expectedColumn.pk) {
      throw new Error(
        `${table}.${expectedColumn.name} primary-key position is ${actual.pk}; expected ${expectedColumn.pk}`,
      );
    }
  }
}

function assertForeignKey(
  db: DatabaseSync,
  table: string,
  expected: Pick<ForeignKeyRow, "table" | "from" | "to" | "on_delete">,
) {
  const rows = db.prepare(`PRAGMA foreign_key_list(${table})`)
    .all() as unknown as ForeignKeyRow[];
  const found = rows.some((row) =>
    row.table === expected.table && row.from === expected.from &&
    row.to === expected.to && row.on_delete === expected.on_delete
  );
  if (!found) {
    throw new Error(`${table} is missing expected foreign key`);
  }
}

export const baselineMigration: Migration = {
  version: 1,
  name: "0001_baseline",
  up(db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chores (
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS completion_logs (
        id TEXT PRIMARY KEY,
        chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },
  validate(db: DatabaseSync) {
    assertTableSchema(db, "users");
    assertTableSchema(db, "chores");
    assertTableSchema(db, "completion_logs");
    assertForeignKey(db, "chores", {
      table: "users",
      from: "user_id",
      to: "id",
      on_delete: "NO ACTION",
    });
    assertForeignKey(db, "completion_logs", {
      table: "chores",
      from: "chore_id",
      to: "id",
      on_delete: "CASCADE",
    });
  },
};

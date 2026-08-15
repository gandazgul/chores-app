import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

interface ForeignKeyRow {
  table: string;
  from: string;
  to: string;
  on_delete: string;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.replace(/^\((.*)\)$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function column(db: DatabaseSync, table: string, name: string): TableColumn {
  const row = (db.prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableColumn[]).find((candidate) =>
      candidate.name === name
    );
  if (!row) {
    throw new Error(`${table}.${name} is missing`);
  }
  return row;
}

function assertColumn(
  db: DatabaseSync,
  table: string,
  name: string,
  expected: Pick<TableColumn, "type" | "notnull"> & {
    dfltValue: string | null;
  },
) {
  const actual = column(db, table, name);
  if (actual.type.toUpperCase() !== expected.type) {
    throw new Error(
      `${table}.${name} type is ${actual.type}; expected ${expected.type}`,
    );
  }
  if (actual.notnull !== expected.notnull) {
    throw new Error(
      `${table}.${name} notnull is ${actual.notnull}; expected ${expected.notnull}`,
    );
  }
  if (normalizeDefault(actual.dflt_value) !== expected.dfltValue) {
    throw new Error(
      `${table}.${name} default is ${actual.dflt_value}; expected ${expected.dfltValue}`,
    );
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
    throw new Error(`${table} is missing ${expected.from} foreign key`);
  }
}

export const householdAssignmentMigration: Migration = {
  version: 4,
  name: "0004_household_assignment",
  up(db: DatabaseSync) {
    db.exec(`
      ALTER TABLE users
        ADD COLUMN picture TEXT;

      ALTER TABLE chores
        ADD COLUMN assignee_id TEXT
          REFERENCES users(id);

      ALTER TABLE chores
        ADD COLUMN unassigned_since TIMESTAMP;

      UPDATE chores
      SET assignee_id = user_id,
          unassigned_since = NULL
      WHERE status = 'open';
    `);
  },
  validate(db: DatabaseSync) {
    assertColumn(db, "users", "picture", {
      type: "TEXT",
      notnull: 0,
      dfltValue: null,
    });
    assertColumn(db, "chores", "assignee_id", {
      type: "TEXT",
      notnull: 0,
      dfltValue: null,
    });
    assertColumn(db, "chores", "unassigned_since", {
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: null,
    });
    assertForeignKey(db, "chores", {
      table: "users",
      from: "assignee_id",
      to: "id",
      on_delete: "NO ACTION",
    });
  },
};

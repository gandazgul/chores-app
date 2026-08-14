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

interface IndexRow {
  name: string;
  unique: number;
  partial: number;
}

interface CountRow {
  count: number;
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

function assertUniqueIndex(db: DatabaseSync, table: string, name: string) {
  const rows = db.prepare(`PRAGMA index_list(${table})`)
    .all() as unknown as IndexRow[];
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) {
    throw new Error(`${table}.${name} unique index is missing`);
  }
  if (row.unique !== 1) {
    throw new Error(`${table}.${name} is not unique`);
  }
}

function assertNoInvalidRows(db: DatabaseSync) {
  const invalidStatus = db.prepare(`
    SELECT COUNT(*) AS count
    FROM chores
    WHERE status NOT IN ('open', 'completed', 'skipped')
  `).get() as unknown as CountRow;
  if (Number(invalidStatus.count) !== 0) {
    throw new Error("chores.status has invalid values");
  }

  const invalidRevision = db.prepare(`
    SELECT COUNT(*) AS count
    FROM chores
    WHERE revision < 0
  `).get() as unknown as CountRow;
  if (Number(invalidRevision.count) !== 0) {
    throw new Error("chores.revision has invalid values");
  }
}

export const occurrenceResolutionMigration: Migration = {
  version: 2,
  name: "0002_occurrence_resolution",
  up(db: DatabaseSync) {
    db.exec(`
      ALTER TABLE chores
        ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'completed', 'skipped'));

      ALTER TABLE chores
        ADD COLUMN recurrence_parent_id TEXT
          REFERENCES chores(id) ON DELETE SET NULL;

      ALTER TABLE chores
        ADD COLUMN revision INTEGER NOT NULL DEFAULT 0
          CHECK (revision >= 0);

      ALTER TABLE completion_logs
        ADD COLUMN due_at TIMESTAMP;

      UPDATE chores
      SET status = CASE WHEN done = 1 THEN 'completed' ELSE 'open' END;

      UPDATE completion_logs
      SET due_at = (
        SELECT chores.due_date
        FROM chores
        WHERE chores.id = completion_logs.chore_id
      );

      CREATE UNIQUE INDEX chores_one_direct_successor
        ON chores(recurrence_parent_id)
        WHERE recurrence_parent_id IS NOT NULL;

      CREATE UNIQUE INDEX completion_logs_one_per_chore
        ON completion_logs(chore_id);
    `);
  },
  validate(db: DatabaseSync) {
    assertColumn(db, "chores", "status", {
      type: "TEXT",
      notnull: 1,
      dfltValue: "open",
    });
    assertColumn(db, "chores", "recurrence_parent_id", {
      type: "TEXT",
      notnull: 0,
      dfltValue: null,
    });
    assertColumn(db, "chores", "revision", {
      type: "INTEGER",
      notnull: 1,
      dfltValue: "0",
    });
    assertColumn(db, "completion_logs", "due_at", {
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: null,
    });
    assertForeignKey(db, "chores", {
      table: "chores",
      from: "recurrence_parent_id",
      to: "id",
      on_delete: "SET NULL",
    });
    assertUniqueIndex(db, "chores", "chores_one_direct_successor");
    assertUniqueIndex(db, "completion_logs", "completion_logs_one_per_chore");
    assertNoInvalidRows(db);
  },
};

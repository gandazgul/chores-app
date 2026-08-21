import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
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

function assertNoInvalidRows(db: DatabaseSync) {
  const invalidResolution = db.prepare(`
    SELECT COUNT(*) AS count
    FROM completion_logs
    WHERE resolution NOT IN ('completed', 'skipped')
  `).get() as unknown as CountRow;
  if (Number(invalidResolution.count) !== 0) {
    throw new Error("completion_logs.resolution has invalid values");
  }
}

export const completionLogResolutionMigration: Migration = {
  version: 5,
  name: "0005_completion_log_resolution",
  up(db: DatabaseSync) {
    db.exec(`
      ALTER TABLE completion_logs
        ADD COLUMN resolution TEXT NOT NULL DEFAULT 'completed'
          CHECK (resolution IN ('completed', 'skipped'));

      UPDATE completion_logs
      SET resolution = 'completed'
      WHERE resolution IS NULL OR resolution = '';
    `);
  },
  validate(db: DatabaseSync) {
    assertColumn(db, "completion_logs", "resolution", {
      type: "TEXT",
      notnull: 1,
      dfltValue: "completed",
    });
    assertNoInvalidRows(db);
  },
};

import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.replace(/^\((.*)\)$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function userNameColumn(db: DatabaseSync): TableColumn {
  const row = (db.prepare("PRAGMA table_info(users)")
    .all() as unknown as TableColumn[]).find((candidate) =>
      candidate.name === "name"
    );
  if (!row) {
    throw new Error("users.name is missing");
  }
  return row;
}

export const userNamesMigration: Migration = {
  version: 3,
  name: "0003_user_names",
  up(db: DatabaseSync) {
    db.exec(`
      ALTER TABLE users
        ADD COLUMN name TEXT;
    `);
  },
  validate(db: DatabaseSync) {
    const column = userNameColumn(db);
    if (column.type.toUpperCase() !== "TEXT") {
      throw new Error(`users.name type is ${column.type}; expected TEXT`);
    }
    if (column.notnull !== 0) {
      throw new Error(`users.name notnull is ${column.notnull}; expected 0`);
    }
    if (normalizeDefault(column.dflt_value) !== null) {
      throw new Error(
        `users.name default is ${column.dflt_value}; expected null`,
      );
    }
  },
};

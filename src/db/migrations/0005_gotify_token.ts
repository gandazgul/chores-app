import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;
  return value.replace(/^\((.*)\)$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function column(db: DatabaseSync, table: string, name: string): TableColumn {
  const row = (db.prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableColumn[]).find((candidate) =>
      candidate.name === name
    );
  if (!row) throw new Error(`${table}.${name} is missing`);
  return row;
}

export const gotifyTokenMigration: Migration = {
  version: 5,
  name: "0005_gotify_token",
  up(db: DatabaseSync) {
    db.exec(`
      ALTER TABLE users
        ADD COLUMN gotify_token TEXT;
    `);
  },
  validate(db: DatabaseSync) {
    const actual = column(db, "users", "gotify_token");
    if (actual.type.toUpperCase() !== "TEXT") {
      throw new Error(
        `users.gotify_token type is ${actual.type}; expected TEXT`,
      );
    }
    if (actual.notnull !== 0) {
      throw new Error(
        `users.gotify_token notnull is ${actual.notnull}; expected 0`,
      );
    }
    if (normalizeDefault(actual.dflt_value) !== null) {
      throw new Error(
        `users.gotify_token default is ${actual.dflt_value}; expected null`,
      );
    }
  },
};

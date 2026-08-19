import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./index.ts";

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface IndexRow {
  name: string;
  unique: number;
  partial: number;
}

interface ForeignKeyRow {
  table: string;
  from: string;
  to: string;
  on_delete: string;
}

interface CountRow {
  count: number;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;
  return value.replace(/^\((.*)\)$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function tableColumns(db: DatabaseSync, table: string): TableColumn[] {
  return db.prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableColumn[];
}

function column(db: DatabaseSync, table: string, name: string): TableColumn {
  const found = tableColumns(db, table).find((candidate) =>
    candidate.name === name
  );
  if (!found) throw new Error(`${table}.${name} is missing`);
  return found;
}

function assertNoColumn(db: DatabaseSync, table: string, name: string) {
  if (tableColumns(db, table).some((candidate) => candidate.name === name)) {
    throw new Error(`${table}.${name} must not exist`);
  }
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
  if (!found) throw new Error(`${table} is missing ${expected.from} key`);
}

function assertIndex(db: DatabaseSync, table: string, name: string) {
  const rows = db.prepare(`PRAGMA index_list(${table})`)
    .all() as unknown as IndexRow[];
  if (!rows.some((row) => row.name === name)) {
    throw new Error(`${table}.${name} index is missing`);
  }
}

function assertNoInvalidRows(db: DatabaseSync) {
  const invalid = db.prepare(`
    SELECT COUNT(*) AS count
    FROM notification_deliveries
    WHERE kind NOT IN ('assigned_nag', 'pool_blast')
       OR status NOT IN ('pending', 'sent', 'superseded', 'undeliverable')
       OR attempt_count < 0
  `).get() as unknown as CountRow;
  if (Number(invalid.count) !== 0) {
    throw new Error("notification_deliveries has invalid rows");
  }
}

export const notificationDeliveriesMigration: Migration = {
  version: 6,
  name: "0006_notification_deliveries",
  up(db: DatabaseSync) {
    const migrationTime = new Date().toISOString();
    db.exec(`
      ALTER TABLE chores
        ADD COLUMN nag_eligible_since TIMESTAMP;

      UPDATE chores
      SET remind_until_done = 1;

      UPDATE chores
      SET nag_eligible_since = '${migrationTime}'
      WHERE status = 'open'
        AND assignee_id IS NOT NULL
        AND due_date IS NOT NULL;

      ALTER TABLE chores
        DROP COLUMN notification_sent_at;

      CREATE TABLE notification_deliveries (
        id TEXT PRIMARY KEY,
        chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('assigned_nag', 'pool_blast')),
        slot_key TIMESTAMP NOT NULL,
        deliver_after TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'sent', 'superseded', 'undeliverable')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_attempt_at TIMESTAMP,
        last_error_code TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (chore_id, recipient_id, kind, slot_key)
      );

      CREATE INDEX notification_deliveries_due_pending
        ON notification_deliveries(deliver_after, slot_key, id)
        WHERE status = 'pending';

      CREATE INDEX notification_deliveries_chore_status
        ON notification_deliveries(chore_id, kind, status);
    `);
  },
  validate(db: DatabaseSync) {
    assertNoColumn(db, "chores", "notification_sent_at");
    assertColumn(db, "chores", "remind_until_done", {
      type: "BOOLEAN",
      notnull: 0,
      dfltValue: "0",
    });
    assertColumn(db, "chores", "nag_eligible_since", {
      type: "TIMESTAMP",
      notnull: 0,
      dfltValue: null,
    });
    for (
      const name of [
        "id",
        "chore_id",
        "recipient_id",
        "kind",
        "slot_key",
        "deliver_after",
        "status",
        "attempt_count",
        "last_attempt_at",
        "last_error_code",
        "sent_at",
        "created_at",
        "updated_at",
      ]
    ) {
      column(db, "notification_deliveries", name);
    }
    assertForeignKey(db, "notification_deliveries", {
      table: "chores",
      from: "chore_id",
      to: "id",
      on_delete: "CASCADE",
    });
    assertForeignKey(db, "notification_deliveries", {
      table: "users",
      from: "recipient_id",
      to: "id",
      on_delete: "NO ACTION",
    });
    assertIndex(db, "chores", "chores_one_direct_successor");
    assertIndex(
      db,
      "notification_deliveries",
      "notification_deliveries_due_pending",
    );
    assertIndex(
      db,
      "notification_deliveries",
      "notification_deliveries_chore_status",
    );
    assertNoInvalidRows(db);
  },
};

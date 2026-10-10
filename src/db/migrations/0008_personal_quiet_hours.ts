import type { Migration } from "./index.ts";

export const personalQuietHoursMigration: Migration = {
  version: 8,
  name: "0008_personal_quiet_hours",
  up(db) {
    db.exec(`
      ALTER TABLE users ADD COLUMN quiet_hours_enabled INTEGER
        CHECK (quiet_hours_enabled IN (0, 1));
      ALTER TABLE users ADD COLUMN quiet_hours_start TEXT;
      ALTER TABLE users ADD COLUMN quiet_hours_end TEXT;
    `);
  },
  validate(db) {
    const columns = db.prepare("PRAGMA table_info(users)").all() as unknown as {
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }[];
    for (
      const [name, type] of [
        ["quiet_hours_enabled", "INTEGER"],
        ["quiet_hours_start", "TEXT"],
        ["quiet_hours_end", "TEXT"],
      ]
    ) {
      const column = columns.find((item) => item.name === name);
      if (
        !column || column.type !== type || column.notnull !== 0 ||
        column.dflt_value !== null
      ) {
        throw new Error(`Invalid users.${name} column`);
      }
    }
  },
};

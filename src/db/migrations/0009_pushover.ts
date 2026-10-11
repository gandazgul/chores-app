import type { Migration } from "./index.ts";

export const pushoverMigration: Migration = {
  version: 9,
  name: "0009_pushover",
  up(db) {
    db.exec("ALTER TABLE users ADD COLUMN pushover_user_key TEXT;");
  },
  validate(db) {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const column = columns.find((item) => item.name === "pushover_user_key");
    if (!column || column.type !== "TEXT" || column.notnull !== 0) {
      throw new Error("Invalid users.pushover_user_key column");
    }
  },
};

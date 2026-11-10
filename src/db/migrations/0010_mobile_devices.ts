import type { Migration } from "./index.ts";

export const mobileDevicesMigration: Migration = {
  version: 10,
  name: "0010_mobile_devices",
  up(db) {
    db.exec(`CREATE TABLE mobile_devices (
      installation_id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX mobile_devices_user ON mobile_devices(user_id);`);
  },
  validate(db) {
    const columns = db.prepare("PRAGMA table_info(mobile_devices)").all();
    for (const name of ["installation_id", "user_id", "token", "updated_at"]) {
      if (
        !columns.some((column) => column.name === name && column.notnull === 1)
      ) {
        throw new Error(`Invalid mobile_devices.${name}`);
      }
    }
  },
};

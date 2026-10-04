import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "../db/migrations/index.ts";

let dbPath: string;
switch (Deno.env.get("DB_ENV")) {
  case "test":
    dbPath = "./chores.test.db";
    break;
  case "production":
    dbPath = "./chores.db";
    break;
  case "development":
  default:
    dbPath = "./chores.dev.db";
    break;
}

const db = new DatabaseSync(Deno.env.get("DB_PATH") || dbPath, {
  timeout: 10_000,
});
db.exec("PRAGMA foreign_keys = ON;");
applyMigrations(db);

export default db;

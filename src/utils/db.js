import { DatabaseSync } from "node:sqlite";

let dbPath;
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

const db = new DatabaseSync(dbPath);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER,
    done BOOLEAN DEFAULT 0,
    due_date TIMESTAMP,
    remind_until_done BOOLEAN DEFAULT 0,
    recurrence JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create helper functions that mirror simple Knex usage or keep it as-is for pure sql.
export default db;

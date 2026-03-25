import { DatabaseSync } from "node:sqlite";

let dbPath;
switch (Deno.env.get("DB_ENV")) {
    case 'test':
        dbPath = "./chores.test.db";
        break;
    case 'production':
        dbPath = './chores.db';
        break;
    case 'development':
    default:
        dbPath = "./chores.dev.db";
        break;
}

const db = new DatabaseSync(dbPath);

// Create helper functions that mirror simple Knex usage or keep it as-is for pure sql.
export default db;
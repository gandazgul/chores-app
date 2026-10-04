import { DatabaseSync } from "node:sqlite";

const destination = Deno.args[0];
if (!destination) throw new Error("Usage: backup_db.ts /backup/tow.db");
const db = new DatabaseSync(Deno.env.get("DB_PATH") || "./chores.db", {
  readOnly: true,
  timeout: 10_000,
});
try {
  // Creates a consistent snapshot while the app remains online.
  // SQLite refuses to overwrite a non-empty destination.
  db.prepare("VACUUM INTO ?").run(destination);
} finally {
  db.close();
}

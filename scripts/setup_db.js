import db from '../src/utils/db.js';

console.log("Setting up the database...");

// Setup tables
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

console.log("Database tables created.");

// Optionally seed if table is empty
const choreCount = db.prepare("SELECT COUNT(*) AS count FROM chores").get()?.count || 0;

if (choreCount === 0) {
  const seedUserId = 'r0wk2VvPQFhW7bpLpq3MxMhjodD2';
  db.prepare("INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)").run(seedUserId, 'demo@example.com');
  
  const insertChore = db.prepare(`
    INSERT INTO chores (id, user_id, title, description, priority, done)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertChore.run(crypto.randomUUID(), seedUserId, 'Wash the dishes', 'Wash all the dishes in the sink.', 1, 0);
  insertChore.run(crypto.randomUUID(), seedUserId, 'Take out the trash', 'Take out the trash and recycling.', 2, 1);
  insertChore.run(crypto.randomUUID(), seedUserId, 'Clean the bathroom', 'Clean the toilet, sink, and shower.', 3, 0);

  console.log("Database seeded with sample chores.");
} else {
  console.log("Database already contains data, skipping seed.");
}

db.close();
console.log("Setup complete!");

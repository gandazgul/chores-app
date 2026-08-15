import { DatabaseSync } from "node:sqlite";
import { assertEquals, assertExists } from "@std/assert";
import type { ChoreRow } from "../types.ts";
import { applyMigrations } from "../db/migrations/index.ts";
import { updateOccurrence } from "./occurrenceResolution.ts";

interface CountRow {
  count: number;
}

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run("u", "u@x");
  return db;
}

function insertChore(
  db: DatabaseSync,
  fields: {
    id?: string;
    title?: string;
    done?: 0 | 1;
    status?: string;
    dueDate?: string | null;
    recurrence?: string | null;
    parentId?: string | null;
    revision?: number;
    assigneeId?: string | null;
    unassignedSince?: string | null;
  } = {},
): string {
  const id = fields.id ?? crypto.randomUUID();
  db.prepare(`
    INSERT INTO chores (
      id,
      user_id,
      assignee_id,
      unassigned_since,
      title,
      done,
      status,
      due_date,
      recurrence,
      recurrence_parent_id,
      revision
    )
    VALUES (?, 'u', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fields.assigneeId ?? null,
    fields.unassignedSince ?? null,
    fields.title ?? "Chore",
    fields.done ?? 0,
    fields.status ?? "open",
    fields.dueDate ?? "2030-01-01T00:00:00.000Z",
    fields.recurrence ?? null,
    fields.parentId ?? null,
    fields.revision ?? 0,
  );
  return id;
}

function chore(db: DatabaseSync, id: string): ChoreRow {
  const row = db.prepare("SELECT * FROM chores WHERE id = ?").get(id) as
    | ChoreRow
    | undefined;
  assertExists(row);
  return row;
}

function count(
  db: DatabaseSync,
  sql: string,
  ...params: Array<string | number | null>
): number {
  return Number(
    (db.prepare(sql).get(...params) as unknown as CountRow).count,
  );
}

function successor(db: DatabaseSync, id: string): ChoreRow | undefined {
  return db.prepare("SELECT * FROM chores WHERE recurrence_parent_id = ?").get(
    id,
  ) as ChoreRow | undefined;
}

function assertOneOpenPerChain(db: DatabaseSync) {
  const rows = db.prepare(`
    WITH RECURSIVE roots(id, root_id) AS (
      SELECT id, id
      FROM chores
      WHERE recurrence_parent_id IS NULL
      UNION ALL
      SELECT child.id, roots.root_id
      FROM chores child
      JOIN roots ON child.recurrence_parent_id = roots.id
    )
    SELECT roots.root_id, COUNT(*) AS count
    FROM roots
    JOIN chores ON chores.id = roots.id
    WHERE chores.status = 'open'
    GROUP BY roots.root_id
    HAVING COUNT(*) > 1
  `).all() as unknown as Array<{ root_id: string; count: number }>;
  assertEquals(rows, []);
}

Deno.test("one-off completion and un-completion round trip in one transaction", () => {
  const db = makeDb();
  const id = insertChore(db, { dueDate: "2030-01-01T00:00:00.000Z" });

  const completed = updateOccurrence(db, id, { done: true });

  assertEquals(completed.kind, "updated");
  assertEquals(chore(db, id).status, "completed");
  assertEquals(chore(db, id).done, 1);
  assertEquals(chore(db, id).revision, 1);
  assertEquals(
    db.prepare("SELECT due_at FROM completion_logs WHERE chore_id = ?").get(id),
    { due_at: "2030-01-01T00:00:00.000Z" },
  );

  const reopened = updateOccurrence(db, id, { done: false });

  assertEquals(reopened.kind, "updated");
  assertEquals(chore(db, id).status, "open");
  assertEquals(chore(db, id).done, 0);
  assertEquals(chore(db, id).due_date, "2030-01-01T00:00:00.000Z");
  assertEquals(chore(db, id).revision, 2);
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
      id,
    ),
    0,
  );
  assertOneOpenPerChain(db);
});

Deno.test("recurring completion is idempotent and reversible", () => {
  const db = makeDb();
  const recurrence = JSON.stringify({ rrule: "FREQ=DAILY" });
  const id = insertChore(db, { recurrence });
  const now = new Date("2030-01-02T00:00:00.000Z");

  updateOccurrence(db, id, { title: "Updated", done: true }, { now });
  updateOccurrence(db, id, { done: true }, { now });

  const parent = chore(db, id);
  const child = successor(db, id);
  assertExists(child);
  assertEquals(parent.title, "Updated");
  assertEquals(parent.status, "completed");
  assertEquals(parent.done, 1);
  assertEquals(parent.revision, 1);
  assertEquals(parent.recurrence, recurrence);
  assertEquals(child.title, "Updated");
  assertEquals(child.status, "open");
  assertEquals(child.revision, 0);
  assertEquals(child.recurrence, recurrence);
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM chores WHERE recurrence_parent_id = ?",
      id,
    ),
    1,
  );
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
      id,
    ),
    1,
  );
  assertOneOpenPerChain(db);

  updateOccurrence(db, id, { done: false });

  assertEquals(chore(db, id).status, "open");
  assertEquals(chore(db, id).done, 0);
  assertEquals(chore(db, id).revision, 2);
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM chores WHERE recurrence_parent_id = ?",
      id,
    ),
    0,
  );
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
      id,
    ),
    0,
  );
  assertOneOpenPerChain(db);
});

Deno.test("recurring successor inherits assigned state", () => {
  const db = makeDb();
  const id = insertChore(db, {
    assigneeId: "u",
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });

  updateOccurrence(db, id, { done: true }, {
    now: new Date("2030-01-02T00:00:00.000Z"),
  });

  const child = successor(db, id);
  assertExists(child);
  assertEquals(child.assignee_id, "u");
  assertEquals(child.unassigned_since, null);
});

Deno.test("recurring Pool successor starts a fresh Pool clock", () => {
  const db = makeDb();
  const id = insertChore(db, {
    assigneeId: null,
    unassignedSince: "2029-12-31T00:00:00.000Z",
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });
  const now = new Date("2030-01-02T00:00:00.000Z");

  updateOccurrence(db, id, { done: true }, { now });

  const child = successor(db, id);
  assertExists(child);
  assertEquals(child.assignee_id, null);
  assertEquals(child.unassigned_since, now.toISOString());
});

Deno.test("completion failure leaves no partial successor log or status change", () => {
  const db = makeDb();
  const id = insertChore(db, {
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });
  const before = chore(db, id);
  db.exec(`
    CREATE TRIGGER fail_completion_log
    BEFORE INSERT ON completion_logs
    BEGIN
      SELECT RAISE(ABORT, 'forced completion log failure');
    END;
  `);

  try {
    updateOccurrence(db, id, { done: true }, {
      now: new Date("2030-01-02T00:00:00.000Z"),
    });
  } catch {
    // The database trigger forces the rollback path.
  }

  assertEquals(chore(db, id), before);
  assertEquals(count(db, "SELECT COUNT(*) AS count FROM chores"), 1);
  assertEquals(count(db, "SELECT COUNT(*) AS count FROM completion_logs"), 0);
});

Deno.test("un-complete accepts a missing successor", () => {
  const db = makeDb();
  const id = insertChore(db, {
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });
  updateOccurrence(db, id, { done: true });
  const child = successor(db, id);
  assertExists(child);
  db.prepare("DELETE FROM chores WHERE id = ?").run(child.id);

  const result = updateOccurrence(db, id, { done: false });

  assertEquals(result.kind, "updated");
  assertEquals(chore(db, id).status, "open");
  assertEquals(
    chore(db, id).recurrence,
    JSON.stringify({ rrule: "FREQ=DAILY" }),
  );
  assertEquals(
    count(
      db,
      "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
      id,
    ),
    0,
  );
});

Deno.test("reversal conflicts leave the parent and chain unchanged", () => {
  for (const mode of ["edited", "resolved", "advanced"]) {
    const db = makeDb();
    const id = insertChore(db, {
      title: `Parent ${mode}`,
      recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
    });
    updateOccurrence(db, id, { done: true });
    const child = successor(db, id);
    assertExists(child);

    if (mode === "edited") {
      updateOccurrence(db, child.id, { title: "Touched" });
    } else if (mode === "resolved") {
      updateOccurrence(db, child.id, { done: true });
    } else {
      insertChore(db, { id: "grandchild", parentId: child.id });
    }

    const beforeParent = chore(db, id);
    const beforeChild = chore(db, child.id);
    const beforeRows = count(db, "SELECT COUNT(*) AS count FROM chores");
    const beforeLogs = count(
      db,
      "SELECT COUNT(*) AS count FROM completion_logs",
    );

    const result = updateOccurrence(db, id, {
      title: "Should Not Apply",
      done: false,
    });

    assertEquals(result.kind, "conflict");
    assertEquals(chore(db, id), beforeParent);
    assertEquals(chore(db, child.id), beforeChild);
    assertEquals(count(db, "SELECT COUNT(*) AS count FROM chores"), beforeRows);
    assertEquals(
      count(db, "SELECT COUNT(*) AS count FROM completion_logs"),
      beforeLogs,
    );
  }
});

Deno.test("status, not done, decides transitions and writes resynchronize done", () => {
  const db = makeDb();
  const id = insertChore(db, { done: 1, status: "open" });

  updateOccurrence(db, id, { done: false });

  assertEquals(chore(db, id).status, "open");
  assertEquals(chore(db, id).done, 0);
  assertEquals(chore(db, id).revision, 0);
});

Deno.test("metadata edits on open successors increment revision", () => {
  const db = makeDb();
  const id = insertChore(db, {
    recurrence: JSON.stringify({ rrule: "FREQ=DAILY" }),
  });
  updateOccurrence(db, id, { done: true });
  const child = successor(db, id);
  assertExists(child);

  updateOccurrence(db, child.id, { title: "Touched successor" });

  assertEquals(chore(db, child.id).revision, 1);
  assertEquals(updateOccurrence(db, id, { done: false }).kind, "conflict");
});

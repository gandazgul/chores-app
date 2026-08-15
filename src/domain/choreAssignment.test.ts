import { DatabaseSync } from "node:sqlite";
import { assertEquals, assertExists } from "@std/assert";
import type { ChoreRow } from "../types.ts";
import { applyMigrations } from "../db/migrations/index.ts";
import { transitionAssignment } from "./choreAssignment.ts";

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  db.exec(`
    INSERT INTO users (id, email, name) VALUES ('creator', 'creator@example.com', 'Creator');
    INSERT INTO users (id, email, name) VALUES ('other', 'other@example.com', 'Other');
    INSERT INTO users (id, email, name) VALUES ('third', 'third@example.com', 'Third');
  `);
  return db;
}

function insertChore(
  db: DatabaseSync,
  fields: {
    id?: string;
    assigneeId?: string | null;
    unassignedSince?: string | null;
    status?: string;
    revision?: number;
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
      status,
      revision
    )
    VALUES (?, 'creator', ?, ?, 'Chore', ?, ?)
  `).run(
    id,
    fields.assigneeId ?? null,
    fields.unassignedSince ?? null,
    fields.status ?? "open",
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

Deno.test("claim moves a Pool chore to the signed-in Member", () => {
  const db = makeDb();
  const id = insertChore(db, {
    assigneeId: null,
    unassignedSince: "2030-01-01T00:00:00.000Z",
  });

  const now = new Date("2030-01-02T03:04:05.000Z");

  const result = transitionAssignment(db, id, "other", { action: "claim" }, {
    now,
  });

  assertEquals(result.kind, "updated");
  assertEquals(chore(db, id).assignee_id, "other");
  assertEquals(chore(db, id).unassigned_since, null);
  assertEquals(chore(db, id).revision, 1);
  assertEquals(chore(db, id).updated_at, now.toISOString());
});

Deno.test("assign moves a Pool chore to a selected Member", () => {
  const db = makeDb();
  const id = insertChore(db, { assigneeId: null });

  const now = new Date("2030-01-02T03:04:05.000Z");

  const result = transitionAssignment(db, id, "creator", {
    action: "assign",
    assigneeId: "third",
  }, { now });

  assertEquals(result.kind, "updated");
  assertEquals(chore(db, id).assignee_id, "third");
  assertEquals(chore(db, id).unassigned_since, null);
  assertEquals(chore(db, id).revision, 1);
  assertEquals(chore(db, id).updated_at, now.toISOString());
});

Deno.test("release moves an assigned chore to Pool with a fresh timestamp", () => {
  const db = makeDb();
  const id = insertChore(db, { assigneeId: "creator" });
  const now = new Date("2030-01-02T03:04:05.000Z");

  const result = transitionAssignment(db, id, "other", { action: "release" }, {
    now,
  });

  assertEquals(result.kind, "updated");
  assertEquals(chore(db, id).assignee_id, null);
  assertEquals(chore(db, id).unassigned_since, now.toISOString());
  assertEquals(chore(db, id).revision, 1);
  assertEquals(chore(db, id).updated_at, now.toISOString());
});

Deno.test("reassign moves an assigned chore to a different Member", () => {
  const db = makeDb();
  const id = insertChore(db, { assigneeId: "creator" });

  const now = new Date("2030-01-02T03:04:05.000Z");

  const result = transitionAssignment(db, id, "other", {
    action: "reassign",
    assigneeId: "third",
  }, { now });

  assertEquals(result.kind, "updated");
  assertEquals(chore(db, id).assignee_id, "third");
  assertEquals(chore(db, id).unassigned_since, null);
  assertEquals(chore(db, id).revision, 1);
  assertEquals(chore(db, id).updated_at, now.toISOString());
});

Deno.test("invalid source states and missing Members do not write", () => {
  const db = makeDb();
  const poolId = insertChore(db, { assigneeId: null, revision: 4 });
  const assignedId = insertChore(db, { assigneeId: "creator", revision: 7 });
  const completedId = insertChore(db, {
    assigneeId: null,
    status: "completed",
    revision: 2,
  });
  const beforePool = chore(db, poolId);
  const beforeAssigned = chore(db, assignedId);
  const beforeCompleted = chore(db, completedId);

  assertEquals(
    transitionAssignment(db, assignedId, "other", { action: "claim" }).kind,
    "conflict",
  );
  assertEquals(
    transitionAssignment(db, assignedId, "other", {
      action: "assign",
      assigneeId: "third",
    }).kind,
    "conflict",
  );
  assertEquals(
    transitionAssignment(db, poolId, "other", { action: "release" }).kind,
    "conflict",
  );
  assertEquals(
    transitionAssignment(db, poolId, "other", {
      action: "reassign",
      assigneeId: "third",
    }).kind,
    "conflict",
  );
  assertEquals(
    transitionAssignment(db, assignedId, "other", {
      action: "reassign",
      assigneeId: "creator",
    }).kind,
    "conflict",
  );
  assertEquals(
    transitionAssignment(db, poolId, "other", {
      action: "assign",
      assigneeId: "missing",
    }).kind,
    "member_not_found",
  );
  assertEquals(
    transitionAssignment(db, completedId, "other", { action: "claim" }).kind,
    "conflict",
  );

  assertEquals(chore(db, poolId), beforePool);
  assertEquals(chore(db, assignedId), beforeAssigned);
  assertEquals(chore(db, completedId), beforeCompleted);
});

Deno.test("missing chore returns not found without checking assignment state", () => {
  const db = makeDb();

  assertEquals(
    transitionAssignment(db, "missing", "other", { action: "release" }).kind,
    "chore_not_found",
  );
});

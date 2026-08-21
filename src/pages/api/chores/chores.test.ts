import "../../../env.d.ts";
import { assert, assertEquals, assertExists } from "@std/assert";
import type { APIContext } from "astro";
import type { Chore, ChoreRow, UserPayload } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { DELETE, PUT } from "./[id].ts";
import { POST as ASSIGNMENT_POST } from "./[id]/assignment.ts";
import { GET, POST } from "./index.ts";

const MOCK_USER: UserPayload = {
  id: "mock-user-test-1",
  email: "test@example.com",
  name: "Test User",
};

const OTHER_USER: UserPayload = {
  id: "mock-user-test-2",
  email: "other@example.com",
  name: "Other User",
};

const THIRD_USER: UserPayload = {
  id: "mock-user-test-3",
  email: "third@example.com",
  name: "Third User",
};

const MOCK_LOCALS = { user: MOCK_USER };
const OTHER_LOCALS = { user: OTHER_USER };
const UNAUTH_LOCALS = { user: null };

interface CountRow {
  count: number;
}

function ensureUser(user: UserPayload) {
  db.prepare(`
    INSERT INTO users (id, email, name, picture)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      updated_at = CURRENT_TIMESTAMP
  `).run(user.id, user.email, user.name, user.picture ?? null);
}

function cleanup() {
  db.prepare("DELETE FROM chores").run();
  db.prepare("DELETE FROM users").run();
}

function context(fields: Partial<APIContext>): APIContext {
  return fields as unknown as APIContext;
}

function redirect(path: string, status = 302): Response {
  return new Response(null, { status, headers: { location: path } });
}

function jsonPost(body: unknown, user: UserPayload = MOCK_USER) {
  return POST(
    context({
      request: new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      locals: { user },
    }),
  ) as Promise<Response>;
}

function jsonPut(id: string, body: unknown, user: UserPayload = MOCK_USER) {
  return PUT(
    context({
      params: { id },
      request: new Request(`http://localhost/api/chores/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      locals: { user },
    }),
  ) as Promise<Response>;
}

function assignmentPost(
  id: string,
  body: unknown,
  user: UserPayload = MOCK_USER,
) {
  return ASSIGNMENT_POST(
    context({
      params: { id },
      request: new Request(`http://localhost/api/chores/${id}/assignment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      locals: { user },
    }),
  ) as Promise<Response>;
}

function count(sql: string, ...params: Array<string | number | null>): number {
  return Number((db.prepare(sql).get(...params) as unknown as CountRow).count);
}

function chore(id: string): ChoreRow {
  const row = db.prepare("SELECT * FROM chores WHERE id = ?").get(id) as
    | ChoreRow
    | undefined;
  assertExists(row);
  return row;
}

Deno.test({
  name: "Chores API can create a Pool chore for a new authenticated user",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      const res = await jsonPost({ title: "Pool Repro", assigneeId: null });
      assertEquals(res.status, 201);

      const created = await res.json() as Chore;
      assertEquals(created.title, "Pool Repro");
      assertEquals(created.user_id, MOCK_USER.id);
      assertEquals(created.assignee_id, null);
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name:
    "Chores API returns household chores and lets a non-Creator complete and delete",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    try {
      const unauthGetRes = await GET(
        context({ locals: UNAUTH_LOCALS }),
      ) as Response;
      assertEquals(unauthGetRes.status, 401);

      const emptyGetRes = await GET(
        context({ locals: MOCK_LOCALS }),
      ) as Response;
      assertEquals(emptyGetRes.status, 200);
      const emptyChores = await emptyGetRes.json() as Chore[];
      assertEquals(emptyChores.length, 0);

      const postReq = new Request("http://localhost/api/chores", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Chore",
          description: "Test Description",
          rrule: "FREQ=DAILY",
        }),
      });
      const postRes = await POST(
        context({ request: postReq, locals: MOCK_LOCALS }),
      ) as Response;
      assertEquals(postRes.status, 201);
      const createdChore = await postRes.json() as Chore;
      assertEquals(createdChore.title, "Test Chore");
      assertEquals(createdChore.user_id, MOCK_USER.id);
      assertEquals(createdChore.assignee_id, MOCK_USER.id);
      assertEquals(createdChore.unassigned_since, null);
      assertEquals(createdChore.status, "open");
      assertEquals(createdChore.revision, 0);
      assertEquals(
        typeof createdChore.recurrence === "object" &&
          createdChore.recurrence?.rrule,
        "FREQ=DAILY",
      );
      const choreId = createdChore.id;

      const creatorGetRes = await GET(
        context({ locals: MOCK_LOCALS }),
      ) as Response;
      const creatorList = await creatorGetRes.json() as Chore[];
      assertEquals(creatorList.map((item) => item.id), [choreId]);

      const otherGetRes = await GET(
        context({ locals: OTHER_LOCALS }),
      ) as Response;
      assertEquals(otherGetRes.status, 200);
      const otherList = await otherGetRes.json() as Chore[];
      assertEquals(otherList.map((item) => item.id), [choreId]);

      const putRes = await jsonPut(choreId, {
        title: "Updated by Other",
        done: true,
      }, OTHER_USER);
      assertEquals(putRes.status, 200);
      const updatedChore = await putRes.json() as Chore;
      assertEquals(updatedChore.title, "Updated by Other");
      assertEquals(updatedChore.user_id, MOCK_USER.id);
      assertEquals(updatedChore.done, 1);
      assertEquals(updatedChore.status, "completed");
      assertEquals(updatedChore.revision, 1);

      const retryRes = await jsonPut(choreId, { done: true }, OTHER_USER);
      assertEquals(retryRes.status, 200);

      const logs = db.prepare(
        "SELECT * FROM completion_logs WHERE chore_id = ?",
      ).all(choreId);
      assertEquals(logs.length, 1);

      const spawnedRows = db.prepare(
        "SELECT * FROM chores WHERE user_id = ? AND recurrence_parent_id = ?",
      ).all(MOCK_USER.id, choreId) as unknown as ChoreRow[];
      assertEquals(spawnedRows.length, 1);
      assertEquals(spawnedRows[0].assignee_id, MOCK_USER.id);

      const openGetRes = await GET(
        context({ locals: OTHER_LOCALS }),
      ) as Response;
      const openChores = await openGetRes.json() as Chore[];
      assertEquals(openChores.length, 1);
      assertEquals(openChores[0].status, "open");

      const deleteRes = await DELETE(
        context({ params: { id: choreId }, locals: OTHER_LOCALS }),
      ) as Response;
      assertEquals(deleteRes.status, 204);

      const finalGetRes = await GET(
        context({ locals: MOCK_LOCALS }),
      ) as Response;
      const finalChores = await finalGetRes.json() as Chore[];
      assertEquals(finalChores.length, 1);
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name:
    "Chores API skips recurring chores and excludes skipped parents from active list",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    try {
      const createRes = await jsonPost({
        title: "Skip API",
        rrule: "FREQ=DAILY",
        dueDate: "2030-01-01T00:00:00.000Z",
        assigneeId: OTHER_USER.id,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json() as Chore;

      const skipRes = await jsonPut(created.id, { resolution: "skipped" });
      assertEquals(skipRes.status, 200);
      const skipped = await skipRes.json() as Chore;
      assertEquals(skipped.status, "skipped");
      assertEquals(skipped.done, 0);

      const retryRes = await jsonPut(created.id, { resolution: "skipped" });
      assertEquals(retryRes.status, 200);

      const logs = db.prepare(
        "SELECT due_at, resolution FROM completion_logs WHERE chore_id = ?",
      ).all(created.id);
      assertEquals(logs, [{
        due_at: "2030-01-01T00:00:00.000Z",
        resolution: "skipped",
      }]);

      const spawnedRows = db.prepare(
        "SELECT * FROM chores WHERE recurrence_parent_id = ?",
      ).all(created.id) as unknown as ChoreRow[];
      assertEquals(spawnedRows.length, 1);
      assertEquals(spawnedRows[0].status, "open");
      assertEquals(spawnedRows[0].assignee_id, OTHER_USER.id);

      const openGetRes = await GET(
        context({ locals: MOCK_LOCALS }),
      ) as Response;
      const openChores = await openGetRes.json() as Chore[];
      assertEquals(openChores.some((item) => item.id === created.id), false);
      assertEquals(
        openChores.some((item) => item.id === spawnedRows[0].id),
        true,
      );
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "Chores API returns conflict when a touched successor blocks reversal",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    try {
      db.prepare(`
        INSERT INTO chores (id, user_id, assignee_id, title, recurrence, due_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        "api-parent",
        MOCK_USER.id,
        OTHER_USER.id,
        "Parent",
        JSON.stringify({ rrule: "FREQ=DAILY" }),
        "2030-01-01T00:00:00.000Z",
      );

      assertEquals((await jsonPut("api-parent", { done: true })).status, 200);
      const child = db.prepare(
        "SELECT id, assignee_id FROM chores WHERE recurrence_parent_id = ?",
      ).get("api-parent") as { id: string; assignee_id: string } | undefined;
      assertExists(child);
      assertEquals(child.assignee_id, OTHER_USER.id);
      assertEquals(
        (await jsonPut(child.id, { title: "Touched Child" }, OTHER_USER))
          .status,
        200,
      );

      const beforeParent = db.prepare("SELECT * FROM chores WHERE id = ?").get(
        "api-parent",
      );
      const beforeLogs = count(
        "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
        "api-parent",
      );

      const conflictRes = await jsonPut("api-parent", {
        title: "Should Not Apply",
        done: false,
      }, OTHER_USER);

      assertEquals(conflictRes.status, 409);
      assertEquals(
        db.prepare("SELECT * FROM chores WHERE id = ?").get("api-parent"),
        beforeParent,
      );
      assertEquals(
        count(
          "SELECT COUNT(*) AS count FROM completion_logs WHERE chore_id = ?",
          "api-parent",
        ),
        beforeLogs,
      );
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name:
    "Chores API preserves form redirects and supports create assignment choices",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    try {
      const missingTitleRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: new URLSearchParams({ title: "" }),
          }),
          locals: MOCK_LOCALS,
          redirect,
        }),
      ) as Response;
      assertEquals(missingTitleRes.status, 302);
      assertEquals(
        missingTitleRes.headers.get("location"),
        "/?error=Title+is+required",
      );

      const invalidRuleRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: new URLSearchParams({ title: "Bad rule", rrule: "INVALID" }),
          }),
          locals: MOCK_LOCALS,
          redirect,
        }),
      ) as Response;
      assertEquals(invalidRuleRes.status, 302);
      assertEquals(
        invalidRuleRes.headers.get("location"),
        "/?error=Invalid+RRULE",
      );

      const formPoolRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: new URLSearchParams({
              title: "Form Pool Chore",
              assigneeId: "",
            }),
          }),
          locals: MOCK_LOCALS,
          redirect,
        }),
      ) as Response;
      assertEquals(formPoolRes.status, 302);
      assertEquals(formPoolRes.headers.get("location"), "/");

      const formPool = db.prepare(
        "SELECT * FROM chores WHERE user_id = ? AND title = ?",
      ).get(MOCK_USER.id, "Form Pool Chore") as ChoreRow | undefined;
      assertExists(formPool);
      assertEquals(formPool.assignee_id, null);
      assert(typeof formPool.unassigned_since === "string");

      const jsonMemberRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: JSON.stringify({
              title: "JSON Member Chore",
              assigneeId: OTHER_USER.id,
            }),
          }),
          locals: MOCK_LOCALS,
        }),
      ) as Response;
      assertEquals(jsonMemberRes.status, 201);
      const jsonMember = await jsonMemberRes.json() as Chore;
      assertEquals(jsonMember.user_id, MOCK_USER.id);
      assertEquals(jsonMember.assignee_id, OTHER_USER.id);
      assertEquals(jsonMember.unassigned_since, null);

      const unknownMemberRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: JSON.stringify({ title: "Unknown", assigneeId: "missing" }),
          }),
          locals: MOCK_LOCALS,
        }),
      ) as Response;
      assertEquals(unknownMemberRes.status, 404);

      const missingRes = await DELETE(
        context({ params: { id: crypto.randomUUID() }, locals: MOCK_LOCALS }),
      ) as Response;
      assertEquals(missingRes.status, 404);
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "Chores API creates and edits due date and assignment atomically",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    try {
      const jsonCreateRes = await jsonPost({
        title: "Due JSON",
        description: "Has a due date",
        dueDate: "2030-01-05T06:07:00.000Z",
        assigneeId: OTHER_USER.id,
      });
      assertEquals(jsonCreateRes.status, 201);
      const created = await jsonCreateRes.json() as Chore;
      assertEquals(created.title, "Due JSON");
      assertEquals(created.due_date, "2030-01-05T06:07:00.000Z");
      assertEquals(created.assignee_id, OTHER_USER.id);
      assertEquals(created.unassigned_since, null);

      const editRes = await jsonPut(created.id, {
        title: "Edited JSON",
        description: "Edited details",
        rrule: "FREQ=DAILY",
        dueDate: "2030-01-10T12:00:00.000Z",
        assigneeId: null,
      });
      assertEquals(editRes.status, 200);
      const edited = await editRes.json() as Chore;
      assertEquals(edited.title, "Edited JSON");
      assertEquals(edited.description, "Edited details");
      assertEquals(edited.due_date, "2030-01-10T12:00:00.000Z");
      assertEquals(
        typeof edited.recurrence === "object" && edited.recurrence?.rrule,
        "FREQ=DAILY",
      );
      assertEquals(edited.assignee_id, null);
      assert(typeof edited.unassigned_since === "string");
      assertEquals(edited.revision, 1);

      const beforeInvalidDateCount = count(
        "SELECT COUNT(*) AS count FROM chores WHERE user_id = ?",
        MOCK_USER.id,
      );
      const invalidCreateRes = await jsonPost({
        title: "Invalid Date",
        dueDate: "not-a-date",
      });
      assertEquals(invalidCreateRes.status, 400);
      assertEquals(
        count(
          "SELECT COUNT(*) AS count FROM chores WHERE user_id = ?",
          MOCK_USER.id,
        ),
        beforeInvalidDateCount,
      );

      const beforeBadEdit = chore(created.id);
      const badMemberEditRes = await jsonPut(created.id, {
        title: "Should Roll Back",
        dueDate: "2030-02-01T00:00:00.000Z",
        assigneeId: "missing",
      });
      assertEquals(badMemberEditRes.status, 404);
      assertEquals(chore(created.id), beforeBadEdit);

      const formDueRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: new URLSearchParams({
              title: "Form Due",
              dueDate: "2030-03-04T05:06:00.000Z",
              assigneeId: OTHER_USER.id,
            }),
          }),
          locals: MOCK_LOCALS,
          redirect,
        }),
      ) as Response;
      assertEquals(formDueRes.status, 302);
      assertEquals(formDueRes.headers.get("location"), "/");
      const formDue = db.prepare(
        "SELECT * FROM chores WHERE user_id = ? AND title = ?",
      ).get(MOCK_USER.id, "Form Due") as ChoreRow | undefined;
      assertExists(formDue);
      assertEquals(formDue.due_date, "2030-03-04T05:06:00.000Z");
      assertEquals(formDue.assignee_id, OTHER_USER.id);
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "Assignment route enforces strict household transitions",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    ensureUser(OTHER_USER);
    ensureUser(THIRD_USER);
    try {
      db.prepare(`
        INSERT INTO chores (id, user_id, assignee_id, title)
        VALUES ('assigned-chore', ?, ?, 'Assigned Chore')
      `).run(MOCK_USER.id, MOCK_USER.id);
      db.prepare(`
        INSERT INTO chores (id, user_id, assignee_id, unassigned_since, title)
        VALUES ('pool-chore', ?, NULL, ?, 'Pool Chore')
      `).run(MOCK_USER.id, "2030-01-01T00:00:00.000Z");

      const releaseRes = await assignmentPost("assigned-chore", {
        action: "release",
      }, OTHER_USER);
      assertEquals(releaseRes.status, 200);
      const released = await releaseRes.json() as Chore;
      assertEquals(released.assignee_id, null);
      assert(typeof released.unassigned_since === "string");
      assertEquals(released.revision, 1);

      const claimRes = await assignmentPost("assigned-chore", {
        action: "claim",
      }, OTHER_USER);
      assertEquals(claimRes.status, 200);
      const claimed = await claimRes.json() as Chore;
      assertEquals(claimed.assignee_id, OTHER_USER.id);
      assertEquals(claimed.unassigned_since, null);
      assertEquals(claimed.revision, 2);

      const assignRes = await assignmentPost("pool-chore", {
        action: "assign",
        assigneeId: THIRD_USER.id,
      }, MOCK_USER);
      assertEquals(assignRes.status, 200);
      const assigned = await assignRes.json() as Chore;
      assertEquals(assigned.assignee_id, THIRD_USER.id);
      assertEquals(assigned.unassigned_since, null);
      assertEquals(assigned.revision, 1);

      const reassignRes = await assignmentPost("pool-chore", {
        action: "reassign",
        assigneeId: OTHER_USER.id,
      }, MOCK_USER);
      assertEquals(reassignRes.status, 200);
      const reassigned = await reassignRes.json() as Chore;
      assertEquals(reassigned.assignee_id, OTHER_USER.id);
      assertEquals(reassigned.revision, 2);

      const before = chore("pool-chore");
      assertEquals(
        (await assignmentPost("pool-chore", { action: "claim" })).status,
        409,
      );
      assertEquals(chore("pool-chore"), before);

      assertEquals(
        (await assignmentPost("pool-chore", {
          action: "reassign",
          assigneeId: OTHER_USER.id,
        })).status,
        409,
      );
      assertEquals(
        (await assignmentPost("pool-chore", {
          action: "reassign",
          assigneeId: "missing",
        })).status,
        404,
      );
      assertEquals(
        (await assignmentPost("pool-chore", { action: "assign" })).status,
        400,
      );
      assertEquals(
        (await assignmentPost("missing-chore", { action: "release" })).status,
        404,
      );

      await jsonPut("pool-chore", { done: true }, OTHER_USER);
      assertEquals(
        (await assignmentPost("pool-chore", { action: "release" }, OTHER_USER))
          .status,
        409,
      );
    } finally {
      cleanup();
    }
  },
});

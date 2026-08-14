import "../../../env.d.ts";
import { assertEquals, assertExists } from "@std/assert";
import type { APIContext } from "astro";
import type { Chore, UserPayload } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { DELETE, PUT } from "./[id].ts";
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

const MOCK_LOCALS = { user: MOCK_USER };
const OTHER_LOCALS = { user: OTHER_USER };
const UNAUTH_LOCALS = { user: null };

interface CountRow {
  count: number;
}

function ensureUser(user: UserPayload) {
  db.prepare("INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)").run(
    user.id,
    user.email,
  );
}

function cleanup() {
  db.prepare("DELETE FROM chores WHERE user_id IN (?, ?)").run(
    MOCK_USER.id,
    OTHER_USER.id,
  );
  db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(
    MOCK_USER.id,
    OTHER_USER.id,
  );
}

function context(fields: Partial<APIContext>): APIContext {
  return fields as unknown as APIContext;
}

function redirect(path: string, status = 302): Response {
  return new Response(null, { status, headers: { location: path } });
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

function count(sql: string, ...params: Array<string | number | null>): number {
  return Number((db.prepare(sql).get(...params) as unknown as CountRow).count);
}

Deno.test({
  name: "Chores API CRUD preserves recurring completion spawning",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
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
      assertEquals(createdChore.status, "open");
      assertEquals(createdChore.revision, 0);
      assertEquals(
        typeof createdChore.recurrence === "object" &&
          createdChore.recurrence?.rrule,
        "FREQ=DAILY",
      );
      const choreId = createdChore.id;

      const getRes = await GET(context({ locals: MOCK_LOCALS })) as Response;
      assertEquals(getRes.status, 200);
      const choresList = await getRes.json() as Chore[];
      assertEquals(choresList.length, 1);
      assertEquals(choresList[0].id, choreId);

      const putRes = await jsonPut(choreId, {
        title: "Updated Chore",
        done: true,
      });
      assertEquals(putRes.status, 200);
      const updatedChore = await putRes.json() as Chore;
      assertEquals(updatedChore.title, "Updated Chore");
      assertEquals(updatedChore.done, 1);
      assertEquals(updatedChore.status, "completed");
      assertEquals(updatedChore.revision, 1);
      assertEquals(
        typeof updatedChore.recurrence === "object" &&
          updatedChore.recurrence?.rrule,
        "FREQ=DAILY",
      );
      assertEquals(updatedChore.due_date, createdChore.due_date);

      const retryRes = await jsonPut(choreId, { done: true });
      assertEquals(retryRes.status, 200);

      const logs = db.prepare(
        "SELECT * FROM completion_logs WHERE chore_id = ?",
      ).all(choreId);
      assertEquals(logs.length, 1);

      const spawnedRows = db.prepare(
        "SELECT * FROM chores WHERE user_id = ? AND recurrence_parent_id = ?",
      ).all(MOCK_USER.id, choreId);
      assertEquals(spawnedRows.length, 1);

      const openGetRes = await GET(
        context({ locals: MOCK_LOCALS }),
      ) as Response;
      const openChores = await openGetRes.json() as Chore[];
      assertEquals(openChores.length, 1);
      assertEquals(openChores[0].status, "open");

      const deleteRes = await DELETE(
        context({ params: { id: choreId }, locals: MOCK_LOCALS }),
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
  name: "Chores API returns conflict when a touched successor blocks reversal",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    ensureUser(MOCK_USER);
    try {
      db.prepare(`
        INSERT INTO chores (id, user_id, title, recurrence, due_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        "api-parent",
        MOCK_USER.id,
        "Parent",
        JSON.stringify({ rrule: "FREQ=DAILY" }),
        "2030-01-01T00:00:00.000Z",
      );

      assertEquals((await jsonPut("api-parent", { done: true })).status, 200);
      const child = db.prepare(
        "SELECT id FROM chores WHERE recurrence_parent_id = ?",
      ).get("api-parent") as { id: string } | undefined;
      assertExists(child);
      assertEquals(
        (await jsonPut(child.id, { title: "Touched Child" })).status,
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
      });

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
  name: "Chores API preserves form redirects and ownership errors",
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

      const createRes = await POST(
        context({
          request: new Request("http://localhost/api/chores", {
            method: "POST",
            body: new URLSearchParams({ title: "Form Chore" }),
          }),
          locals: MOCK_LOCALS,
          redirect,
        }),
      ) as Response;
      assertEquals(createRes.status, 302);
      assertEquals(createRes.headers.get("location"), "/");

      const created = db.prepare(
        "SELECT id FROM chores WHERE user_id = ? AND title = ?",
      ).get(MOCK_USER.id, "Form Chore") as { id: string } | undefined;
      assertExists(created);

      const forbiddenRes = await DELETE(
        context({ params: { id: created.id }, locals: OTHER_LOCALS }),
      ) as Response;
      assertEquals(forbiddenRes.status, 403);

      const missingRes = await DELETE(
        context({ params: { id: crypto.randomUUID() }, locals: MOCK_LOCALS }),
      ) as Response;
      assertEquals(missingRes.status, 404);
    } finally {
      cleanup();
    }
  },
});

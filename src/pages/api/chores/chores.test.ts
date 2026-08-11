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

      const putReq = new Request(`http://localhost/api/chores/${choreId}`, {
        method: "PUT",
        body: JSON.stringify({ title: "Updated Chore", done: true }),
      });
      const putRes = await PUT(
        context({
          params: { id: choreId },
          request: putReq,
          locals: MOCK_LOCALS,
        }),
      ) as Response;
      assertEquals(putRes.status, 200);
      const updatedChore = await putRes.json() as Chore;
      assertEquals(updatedChore.title, "Updated Chore");
      assertEquals(updatedChore.done, 1);
      assertEquals(updatedChore.recurrence, null);
      assertEquals(updatedChore.due_date, createdChore.due_date);

      const logs = db.prepare(
        "SELECT * FROM completion_logs WHERE chore_id = ?",
      ).all(choreId);
      assertEquals(logs.length, 1);

      const spawnedRows = db.prepare(
        "SELECT * FROM chores WHERE user_id = ? AND id != ?",
      ).all(MOCK_USER.id, choreId);
      assertEquals(spawnedRows.length, 1);

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

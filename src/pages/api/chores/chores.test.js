import { assertEquals } from "@std/assert";
import { GET, POST } from "./index.js";
import { DELETE, PUT } from "./[id].js";
import db from "../../../utils/db.js";

/** @typedef {import('astro').APIContext} APIContext */

const MOCK_LOCALS = {
  user: {
    id: "mock-user-test-1",
    email: "test@example.com",
    name: "Test User",
  },
};

const UNAUTH_LOCALS = {
  user: null,
};

function setupUser() {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(
    MOCK_LOCALS.user.id,
  );
  if (!existing) {
    db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(
      MOCK_LOCALS.user.id,
      MOCK_LOCALS.user.email,
    );
  }
}

function cleanup() {
  db.prepare("DELETE FROM chores WHERE user_id = ?").run(MOCK_LOCALS.user.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(MOCK_LOCALS.user.id);
}

Deno.test({
  name: "Chores API CRUD",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupUser();
    try {
      // 1. Unauthenticated request
      const unauthGetRes = /** @type {Response} */ (await GET(
        /** @type {any} */ ({ locals: UNAUTH_LOCALS }),
      ));
      assertEquals(unauthGetRes.status, 401);

      // 2. GET empty chores list
      const emptyGetRes = /** @type {Response} */ (await GET(
        /** @type {any} */ ({ locals: MOCK_LOCALS }),
      ));
      assertEquals(emptyGetRes.status, 200);
      const emptyChores = await emptyGetRes.json();
      assertEquals(emptyChores.length, 0);

      // 3. POST new chore
      const reqBody = {
        title: "Test Chore",
        description: "Test Description",
        rrule: "FREQ=DAILY",
      };
      const postReq = new Request("http://localhost/api/chores", {
        method: "POST",
        body: JSON.stringify(reqBody),
      });
      const postRes = /** @type {Response} */ (await POST(
        /** @type {any} */ ({ request: postReq, locals: MOCK_LOCALS }),
      ));
      assertEquals(postRes.status, 201);
      const createdChore = await postRes.json();
      assertEquals(createdChore.title, "Test Chore");
      assertEquals(createdChore.recurrence.rrule, "FREQ=DAILY");
      const choreId = createdChore.id;

      // 4. GET chores list with item
      const getRes = /** @type {Response} */ (await GET(
        /** @type {any} */ ({ locals: MOCK_LOCALS }),
      ));
      assertEquals(getRes.status, 200);
      const choresList = await getRes.json();
      assertEquals(choresList.length, 1);
      assertEquals(choresList[0].id, choreId);

      // 5. PUT update chore
      const updateBody = { title: "Updated Chore", done: true };
      const putReq = new Request(`http://localhost/api/chores/${choreId}`, {
        method: "PUT",
        body: JSON.stringify(updateBody),
      });
      const putRes = /** @type {Response} */ (await PUT(
        /** @type {any} */ ({
          params: { id: choreId },
          request: putReq,
          locals: MOCK_LOCALS,
        }),
      ));
      assertEquals(putRes.status, 200);
      const updatedChore = await putRes.json();
      assertEquals(updatedChore.title, "Updated Chore");
      // Since it's DAILY, it should reset to done=0 and set next_due_date
      assertEquals(updatedChore.done, 0);

      // Check completion logs
      const logs = db.prepare(
        "SELECT * FROM completion_logs WHERE chore_id = ?",
      ).all(choreId);
      assertEquals(logs.length, 1);

      // 6. DELETE chore
      const deleteRes = /** @type {Response} */ (await DELETE(
        /** @type {any} */ ({
          params: { id: choreId },
          locals: MOCK_LOCALS,
        }),
      ));
      assertEquals(deleteRes.status, 204);

      // Verify deletion
      const finalGetRes = /** @type {Response} */ (await GET(
        /** @type {any} */ ({ locals: MOCK_LOCALS }),
      ));
      const finalChores = await finalGetRes.json();
      assertEquals(finalChores.length, 0);
    } finally {
      cleanup();
    }
  },
});

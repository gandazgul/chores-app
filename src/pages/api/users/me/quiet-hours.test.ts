import "../../../../env.d.ts";
import { assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import db from "../../../../utils/db.ts";
import { GET, PUT } from "./quiet-hours.ts";

const user = {
  id: "quiet-user",
  email: "quiet@example.com",
  name: "Quiet User",
};
function context(body?: unknown, signedIn = true) {
  return {
    locals: { user: signedIn ? user : null },
    request: new Request("http://example.com/api/users/me/quiet-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

Deno.test("quiet-hours API authenticates, validates and only updates the signed-in member", async () => {
  db.prepare("DELETE FROM chores").run();
  db.prepare("DELETE FROM users").run();
  db.prepare("INSERT INTO users (id,email) VALUES (?,?)").run(
    user.id,
    user.email,
  );
  db.prepare(
    "INSERT INTO users (id,email) VALUES ('other','other@example.com')",
  ).run();
  try {
    for (const handler of [GET, PUT]) {
      assertEquals((await handler(context({}, false)) as Response).status, 401);
    }
    for (
      const body of [
        null,
        {},
        { enabled: 1, start: "01:00", end: "09:00" },
        { enabled: true, start: "25:00", end: "09:00" },
        { enabled: true, start: "1:00", end: "09:00" },
        { enabled: true, start: "01:00", end: "01:00" },
      ]
    ) {
      assertEquals((await PUT(context(body)) as Response).status, 400);
    }
    const settings = { enabled: true, start: "01:00", end: "09:00" };
    assertEquals(
      await (await PUT(context({ ...settings, userId: "other" })) as Response)
        .json(),
      settings,
    );
    const read = await (await GET(context()) as Response).json();
    assertEquals(
      { enabled: read.enabled, start: read.start, end: read.end },
      settings,
    );
    assertEquals(
      db.prepare("SELECT quiet_hours_start FROM users WHERE id = 'other'")
        .get(),
      { quiet_hours_start: null },
    );
    assertEquals(
      (await PUT(context({ ...settings, enabled: false })) as Response).status,
      200,
    );
    assertEquals(
      (await (await GET(context()) as Response).json()).enabled,
      false,
    );
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    assertEquals((await GET(context()) as Response).status, 404);
  } finally {
    db.prepare("DELETE FROM users").run();
  }
});

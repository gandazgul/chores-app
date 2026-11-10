import "../../../../env.d.ts";
import { assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import db from "../../../../utils/db.ts";
import { DELETE, PUT } from "./devices.ts";

function context(userId: string | null, body: unknown): APIContext {
  return {
    locals: {
      user: userId
        ? { id: userId, email: `${userId}@example.com`, name: userId }
        : null,
    },
    request: new Request("https://example.com/api/users/me/devices", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}
Deno.test("device registration rotates tokens, moves accounts and only permits the owner to unregister", async () => {
  const one = "device-test-user-one", two = "device-test-user-two";
  db.prepare("INSERT INTO users(id,email) VALUES (?,?)").run(
    one,
    `${one}@example.com`,
  );
  db.prepare("INSERT INTO users(id,email) VALUES (?,?)").run(
    two,
    `${two}@example.com`,
  );
  const body = {
    installationId: "device-installation-one",
    token: "initial-token-1234567890",
  };
  try {
    assertEquals((await PUT(context(null, body)) as Response).status, 401);
    assertEquals((await PUT(context(one, {})) as Response).status, 400);
    assertEquals((await PUT(context(one, body)) as Response).status, 200);
    assertEquals(
      (await PUT(
        context(one, { ...body, token: "rotated-token-1234567890" }),
      ) as Response).status,
      200,
    );
    assertEquals(
      db.prepare("SELECT token FROM mobile_devices WHERE installation_id=?")
        .get(body.installationId)?.token,
      "rotated-token-1234567890",
    );
    await DELETE(context(two, body));
    assertEquals(
      db.prepare("SELECT user_id FROM mobile_devices WHERE installation_id=?")
        .get(body.installationId)?.user_id,
      one,
    );
    await PUT(context(two, body));
    assertEquals(
      db.prepare("SELECT user_id FROM mobile_devices WHERE installation_id=?")
        .get(body.installationId)?.user_id,
      two,
    );
    await DELETE(context(one, body));
    assertEquals(
      db.prepare("SELECT user_id FROM mobile_devices WHERE installation_id=?")
        .get(body.installationId)?.user_id,
      two,
    );
    await DELETE(context(two, body));
    assertEquals(
      db.prepare("SELECT user_id FROM mobile_devices WHERE installation_id=?")
        .get(body.installationId),
      undefined,
    );
  } finally {
    db.prepare("DELETE FROM mobile_devices WHERE user_id IN (?,?)").run(
      one,
      two,
    );
    db.prepare("DELETE FROM users WHERE id IN (?,?)").run(one, two);
  }
});

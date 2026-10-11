import "../../../../env.d.ts";
import { assert, assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import db from "../../../../utils/db.ts";
import { DELETE, GET, PUT } from "./pushover-key.ts";
import { POST } from "./test-notification.ts";

const user = {
  id: "pushover-user",
  email: "push@example.com",
  name: "Push User",
};
function context(body?: unknown, signedIn = true) {
  return {
    locals: { user: signedIn ? user : null },
    request: new Request("http://example.com/api/users/me/pushover-key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

Deno.test("Pushover settings validate before saving, isolate members, protect secrets, and test only current user", async () => {
  const envNames = [
    "NOTIFICATION_PROVIDER",
    "PUSHOVER_APP_TOKEN",
    "ENABLE_NOTIFICATIONS",
  ];
  const previous = envNames.map((name) => Deno.env.get(name));
  const originalFetch = globalThis.fetch;
  const appToken = "a".repeat(30), key = "u".repeat(30);
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  let providerStatus = 1;
  globalThis.fetch = (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(
      Response.json({ status: providerStatus, errors: [key] }),
    );
  };
  db.prepare("DELETE FROM chores").run();
  db.prepare("DELETE FROM users").run();
  db.prepare("INSERT INTO users(id,email) VALUES (?,?)").run(
    user.id,
    user.email,
  );
  db.prepare("INSERT INTO users(id,email) VALUES (?,?)").run(
    "other",
    "other@example.com",
  );
  try {
    Deno.env.set("NOTIFICATION_PROVIDER", "pushover");
    Deno.env.set("PUSHOVER_APP_TOKEN", appToken);
    Deno.env.set("ENABLE_NOTIFICATIONS", "true");
    for (const handler of [GET, PUT, DELETE, POST]) {
      assertEquals((await handler(context({}, false)) as Response).status, 401);
    }
    for (const body of [null, {}, { userKey: "short" }, { userKey: 0 }]) {
      assertEquals((await PUT(context(body)) as Response).status, 400);
    }
    assertEquals(calls.length, 0);
    assertEquals(
      await (await PUT(context({ userKey: key, userId: "other" })) as Response)
        .json(),
      { pushoverConfigured: true },
    );
    assertEquals(
      calls[0].url,
      "https://api.pushover.net/1/users/validate.json",
    );
    assertEquals(
      db.prepare("SELECT pushover_user_key FROM users WHERE id=?").get("other"),
      { pushover_user_key: null },
    );
    const read = await GET(context()) as Response;
    assertEquals(read.headers.get("Cache-Control"), "no-store");
    assertEquals(await read.json(), { pushoverConfigured: true });
    providerStatus = 0;
    const rejected = await PUT(
      context({ userKey: "v".repeat(30) }),
    ) as Response;
    assertEquals(rejected.status, 400);
    assert(!(await rejected.text()).includes(key));
    assertEquals(
      db.prepare("SELECT pushover_user_key FROM users WHERE id=?").get(user.id),
      { pushover_user_key: key },
    );
    Deno.env.delete("PUSHOVER_APP_TOKEN");
    assertEquals(
      (await PUT(context({ userKey: key })) as Response).status,
      503,
    );
    Deno.env.set("PUSHOVER_APP_TOKEN", appToken);
    providerStatus = 1;
    Deno.env.set("ENABLE_NOTIFICATIONS", "false");
    assertEquals((await POST(context()) as Response).status, 503);
    Deno.env.set("ENABLE_NOTIFICATIONS", "true");
    const tested = await POST(context({ userId: "other" })) as Response;
    assertEquals(tested.status, 200);
    assert((await tested.json()).message.includes("accepted"));
    assertEquals(calls.at(-1)?.url, "https://api.pushover.net/1/messages.json");
    assertEquals(calls.at(-1)?.body.user, key);
    assertEquals((await POST(context()) as Response).status, 429);
    assertEquals(await (await DELETE(context()) as Response).json(), {
      pushoverConfigured: false,
    });
    assertEquals(
      db.prepare("SELECT pushover_user_key FROM users WHERE id=?").get(user.id),
      { pushover_user_key: null },
    );
    db.prepare("DELETE FROM users WHERE id=?").run(user.id);
    for (const handler of [GET, PUT, DELETE, POST]) {
      assertEquals(
        (await handler(context({ userKey: key })) as Response).status,
        404,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    envNames.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    });
    db.prepare("DELETE FROM users").run();
  }
});

import { assert, assertEquals, assertThrows } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "../db/migrations/index.ts";
import {
  createPushoverClient,
  createPushoverNotificationPort,
  parsePushoverKey,
  resolvePushoverToken,
} from "./pushover.ts";
import { resolveNotificationProvider } from "./provider.ts";

const appToken = "a".repeat(30);
const userKey = "u".repeat(30);
const getEnv = (name: string) =>
  name === "PUSHOVER_APP_TOKEN" ? appToken : undefined;

Deno.test("Pushover validates keys and selects only supported providers", () => {
  assertEquals(parsePushoverKey(` ${userKey} `), userKey);
  for (const key of [null, {}, "", "short", "!".repeat(30), "a".repeat(31)]) {
    assertEquals(parsePushoverKey(key), null);
  }
  assertEquals(resolvePushoverToken(() => undefined), null);
  assertThrows(() => resolvePushoverToken(() => "bad"));
  assertEquals(resolveNotificationProvider(() => undefined), "gotify");
  assertEquals(resolveNotificationProvider(() => "pushover"), "pushover");
  assertThrows(() => resolveNotificationProvider(() => "wrong"));
});

Deno.test("Pushover sends audible normal priority, clips long Unicode messages, validates without sending", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const client = createPushoverClient({
    getEnv,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      assertEquals(init?.redirect, "error");
      assert(init?.signal);
      return await Promise.resolve(Response.json({ status: 1 }));
    },
  });
  assertEquals(await client.validate(userKey), { status: "sent" });
  assertEquals(await client.send(userKey, "🐕".repeat(1100)), {
    status: "sent",
  });
  assertEquals(requests[0], {
    url: "https://api.pushover.net/1/users/validate.json",
    body: { token: appToken, user: userKey },
  });
  assertEquals(requests[1].url, "https://api.pushover.net/1/messages.json");
  assertEquals(requests[1].body.priority, 0);
  assertEquals(requests[1].body.sound, "pushover");
  assertEquals([...(requests[1].body.message as string)].length, 1024);
});

Deno.test("Pushover requires provider confirmation and distinguishes retryable errors without reflecting secrets", async () => {
  for (
    const [http, body, expected] of [
      [200, { status: 1 }, { status: "sent" }],
      [200, { status: 0, errors: [appToken] }, {
        status: "undeliverable",
        reason: "pushover_rejected",
      }],
      [400, { status: 0 }, {
        status: "undeliverable",
        reason: "pushover_rejected",
      }],
      [401, { status: 0 }, {
        status: "undeliverable",
        reason: "pushover_rejected",
      }],
      [429, { status: 0 }, {
        status: "retryable_failure",
        reason: "pushover_unavailable",
      }],
      [503, {}, {
        status: "retryable_failure",
        reason: "pushover_unavailable",
      }],
      [200, {}, {
        status: "retryable_failure",
        reason: "pushover_unavailable",
      }],
    ] as const
  ) {
    const client = createPushoverClient({
      getEnv,
      fetchImpl: () => Promise.resolve(Response.json(body, { status: http })),
    });
    assertEquals(await client.send(userKey, "Dogs"), expected);
  }
  const broken = createPushoverClient({
    getEnv,
    fetchImpl: () => Promise.reject(new Error(appToken)),
  });
  assertEquals(await broken.send(userKey, "Dogs"), {
    status: "retryable_failure",
    reason: "network_error",
  });
  const disabled = createPushoverClient({
    getEnv: () => undefined,
    fetchImpl: () => {
      throw new Error("must not send");
    },
  });
  assertEquals(await disabled.send(userKey, "Dogs"), { status: "disabled" });
});

Deno.test("Pushover port reads only recipient credentials at send time and keeps secrets out of logs", async () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  try {
    db.prepare("INSERT INTO users(id,email,pushover_user_key) VALUES (?,?,?)")
      .run("one", "one@example.com", userKey);
    db.prepare("INSERT INTO users(id,email,pushover_user_key) VALUES (?,?,?)")
      .run("two", "two@example.com", "v".repeat(30));
    const sentKeys: string[] = [];
    const logs: unknown[] = [];
    const port = createPushoverNotificationPort({
      db,
      getEnv,
      logger: { warn: (event) => logs.push(event) },
      fetchImpl: (_url, init) => {
        sentKeys.push(JSON.parse(String(init?.body)).user);
        return Promise.resolve(
          Response.json({ status: 0, errors: [appToken, userKey] }, {
            status: 400,
          }),
        );
      },
    });
    assertEquals(await port.send({ recipientId: "missing", title: "Dogs" }), {
      status: "undeliverable",
      reason: "missing_token",
    });
    await port.send({ recipientId: "one", title: "Dogs" });
    db.prepare("UPDATE users SET pushover_user_key=? WHERE id=?").run(
      "w".repeat(30),
      "one",
    );
    await port.send({ recipientId: "one", title: "Dogs" });
    assertEquals(sentKeys, [userKey, "w".repeat(30)]);
    assert(!JSON.stringify(logs).includes(appToken));
    assert(!JSON.stringify(logs).includes(userKey));
  } finally {
    db.close();
  }
});

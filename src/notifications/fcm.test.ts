import { DatabaseSync } from "node:sqlite";
import { assertEquals } from "@std/assert";
import { applyMigrations } from "../db/migrations/index.ts";
import { createFcmNotificationPort } from "./fcm.ts";

Deno.test("FCM isolates recipients, sends audible high-priority messages, prunes only unregistered tokens", async () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  db.exec(
    `INSERT INTO users (id,email) VALUES ('a','a@example.com'),('b','b@example.com');
    INSERT INTO mobile_devices (installation_id,user_id,token) VALUES
    ('one','a','valid'),('two','a','expired'),('three','b','other');`,
  );
  const tokens: string[] = [];
  const port = createFcmNotificationPort({
    db,
    getCredentials: () =>
      Promise.resolve({ projectId: "test", accessToken: "secret" }),
    fetchImpl: (_url, init) => {
      const message = JSON.parse(String(init?.body)).message;
      tokens.push(message.token);
      assertEquals(message.android.priority, "high");
      assertEquals(message.android.notification.channel_id, "tow_reminders_v1");
      assertEquals(message.android.notification.sound, "default");
      assertEquals(message.notification.body, "Wash dishes");
      return Promise.resolve(
        message.token === "valid"
          ? Response.json({ name: "sent" })
          : Response.json({
            error: {
              details: [{
                "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                errorCode: "UNREGISTERED",
              }],
            },
          }, { status: 404 }),
      );
    },
  });
  try {
    assertEquals(await port.send({ recipientId: "a", title: "Wash dishes" }), {
      status: "sent",
    });
    assertEquals(tokens, ["valid", "expired"]);
    assertEquals(
      db.prepare("SELECT count(*) AS count FROM mobile_devices").get()?.count,
      2,
    );
  } finally {
    db.close();
  }
});

Deno.test("FCM retries transient failures, preserves tokens on configuration errors and handles missing setup", async () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  db.exec(`INSERT INTO users(id,email) VALUES ('a','a@example.com');
    INSERT INTO mobile_devices(installation_id,user_id,token) VALUES ('one','a','valid');`);
  try {
    for (
      const [status, expected] of [
        [429, "retryable_failure"],
        [503, "retryable_failure"],
        [403, "undeliverable"],
        [400, "undeliverable"],
      ] as const
    ) {
      const port = createFcmNotificationPort({
        db,
        getCredentials: () =>
          Promise.resolve({ projectId: "test", accessToken: "secret" }),
        fetchImpl: () =>
          Promise.resolve(Response.json({ error: {} }, { status })),
      });
      assertEquals(
        (await port.send({ recipientId: "a", title: "Chore" })).status,
        expected,
      );
      assertEquals(
        db.prepare("SELECT count(*) AS count FROM mobile_devices").get()?.count,
        1,
      );
    }
    const port = createFcmNotificationPort({
      db,
      getCredentials: () => Promise.resolve(null),
      fetchImpl: fetch,
    });
    assertEquals(await port.send({ recipientId: "a", title: "Chore" }), {
      status: "disabled",
    });
    assertEquals(await port.send({ recipientId: "b", title: "Chore" }), {
      status: "undeliverable",
      reason: "missing_token",
    });
  } finally {
    db.close();
  }
});

Deno.test("FCM service account exchange signs the correct scope and reuses access tokens without logging secrets", async () => {
  const { generateKeyPair, exportPKCS8, jwtVerify } = await import("jose");
  const { createFcmAccessToken } = await import("./fcm.ts");
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const privatePem = await exportPKCS8(privateKey);
  let calls = 0;
  const credentials = createFcmAccessToken({
    readServiceAccount: () => ({
      project_id: "tow-test",
      client_email: "sender@tow-test.iam.gserviceaccount.com",
      private_key: privatePem,
    }),
    fetchImpl: async (url, init) => {
      calls++;
      assertEquals(url, "https://oauth2.googleapis.com/token");
      const assertion = new URLSearchParams(String(init?.body)).get(
        "assertion",
      )!;
      const { payload } = await jwtVerify(assertion, publicKey, {
        audience: "https://oauth2.googleapis.com/token",
        issuer: "sender@tow-test.iam.gserviceaccount.com",
      });
      assertEquals(
        payload.scope,
        "https://www.googleapis.com/auth/firebase.messaging",
      );
      return Response.json({
        access_token: "test-access-token",
        expires_in: 3600,
      });
    },
  });
  const [first, second] = await Promise.all([credentials(), credentials()]);
  assertEquals(first?.projectId, "tow-test");
  assertEquals(first?.accessToken, "test-access-token");
  assertEquals(first, second);
  await credentials();
  assertEquals(calls, 1);
});

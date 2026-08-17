import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  createNotificationPort,
  type NotificationPortDependencies,
  resolveGotifyConfig,
} from "./notificationPort.ts";

function makeDb(token: string | null): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      gotify_token TEXT
    );
  `);
  db.prepare("INSERT INTO users (id, gotify_token) VALUES (?, ?)")
    .run("recipient", token);
  return db;
}

function makePort(options: {
  token?: string | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: NotificationPortDependencies["fetchImpl"];
  logs?: Record<string, unknown>[];
}) {
  const logs = options.logs ?? [];
  const fetches: Array<{ input: string | URL | Request; init?: RequestInit }> =
    [];
  const port = createNotificationPort({
    db: makeDb(options.token === undefined ? "secret-token" : options.token),
    getEnv: (name) => options.env?.[name],
    fetchImpl: options.fetchImpl ?? ((input, init) => {
      fetches.push({ input, init });
      return Promise.resolve(new Response("ok", { status: 200 }));
    }),
    logger: {
      info: (event) => logs.push(event),
      warn: (event) => logs.push(event),
      log: (event) => logs.push(event),
    },
  });
  return { port, fetches, logs };
}

Deno.test("notification port sends Gotify messages without returning the token", async () => {
  const { port, fetches } = makePort({
    env: { GOTIFY_URL: "https://gotify.example.com/base/" },
  });

  const result = await port.send({
    recipientId: "recipient",
    title: "Do dishes",
  });

  assertEquals(result, { status: "sent" });
  assertEquals(fetches.length, 1);
  assertEquals(
    String(fetches[0].input),
    "https://gotify.example.com/base/message",
  );
  assertEquals(fetches[0].init?.method, "POST");
  assertEquals(
    (fetches[0].init?.headers as Record<string, string>)["X-Gotify-Key"],
    "secret-token",
  );
  assertEquals(
    fetches[0].init?.body,
    JSON.stringify({ message: "TOW: Do dishes" }),
  );
  assert(!JSON.stringify(result).includes("secret-token"));
});

Deno.test("notification port reads the token at send time", async () => {
  const db = makeDb(null);
  const fetches: Array<{ init?: RequestInit }> = [];
  const port = createNotificationPort({
    db,
    getEnv: () => "https://gotify.example.com",
    fetchImpl: (_input, init) => {
      fetches.push({ init });
      return Promise.resolve(new Response(null, { status: 200 }));
    },
    logger: console,
  });

  assertEquals(
    await port.send({ recipientId: "recipient", title: "Before" }),
    { status: "undeliverable", reason: "missing_token" },
  );
  db.prepare("UPDATE users SET gotify_token = ? WHERE id = ?")
    .run("late-token", "recipient");
  assertEquals(await port.send({ recipientId: "recipient", title: "After" }), {
    status: "sent",
  });
  assertEquals(
    (fetches[0].init?.headers as Record<string, string>)["X-Gotify-Key"],
    "late-token",
  );
});

Deno.test("notification port makes no fetch when token or URL is missing", async () => {
  const withoutToken = makePort({
    token: null,
    env: { GOTIFY_URL: "https://gotify.example.com" },
  });
  assertEquals(
    await withoutToken.port.send({
      recipientId: "recipient",
      title: "No token",
    }),
    { status: "undeliverable", reason: "missing_token" },
  );
  assertEquals(withoutToken.fetches.length, 0);

  const withoutUrl = makePort({ env: {} });
  assertEquals(
    await withoutUrl.port.send({ recipientId: "recipient", title: "No URL" }),
    { status: "disabled" },
  );
  assertEquals(withoutUrl.fetches.length, 0);
  assertEquals(withoutUrl.logs, [{
    event: "push_notification_disabled",
    recipientId: "recipient",
    result: "disabled",
  }]);
});

Deno.test("notification port classifies Gotify responses", async () => {
  const cases: Array<[number, unknown]> = [
    [204, { status: "sent" }],
    [401, { status: "undeliverable", reason: "auth_rejected" }],
    [403, { status: "undeliverable", reason: "auth_rejected" }],
    [404, { status: "undeliverable", reason: "gotify_rejected" }],
    [429, { status: "retryable_failure", reason: "gotify_unavailable" }],
    [500, { status: "retryable_failure", reason: "gotify_unavailable" }],
  ];

  for (const [status, expected] of cases) {
    const { port } = makePort({
      env: { GOTIFY_URL: "https://gotify.example.com" },
      fetchImpl: () =>
        Promise.resolve(
          new Response(status === 204 ? null : "secret body", { status }),
        ),
    });
    assertEquals(
      await port.send({ recipientId: "recipient", title: String(status) }),
      expected,
    );
  }

  const network = makePort({
    env: { GOTIFY_URL: "https://gotify.example.com" },
    fetchImpl: () => Promise.reject(new Error("secret-token raw failure")),
  });
  assertEquals(
    await network.port.send({ recipientId: "recipient", title: "Network" }),
    { status: "retryable_failure", reason: "network_error" },
  );
});

Deno.test("Gotify configuration enforces URL policy", () => {
  assertEquals(resolveGotifyConfig(() => undefined), null);
  assertEquals(
    resolveGotifyConfig((name) =>
      name === "GOTIFY_URL" ? "https://gotify.example.com/root/" : undefined
    ),
    {
      messageUrl: "https://gotify.example.com/root/message",
      origin: "https://gotify.example.com",
    },
  );
  assertEquals(
    resolveGotifyConfig((name) =>
      name === "GOTIFY_URL" ? "http://localhost:3000" : undefined
    )?.messageUrl,
    "http://localhost:3000/message",
  );
  assertEquals(
    resolveGotifyConfig((name) =>
      name === "GOTIFY_URL" ? "http://127.0.0.1:3000" : undefined
    )?.messageUrl,
    "http://127.0.0.1:3000/message",
  );
  assertEquals(
    resolveGotifyConfig((name) =>
      name === "GOTIFY_URL" ? "http://[::1]:3000" : undefined
    )?.messageUrl,
    "http://[::1]:3000/message",
  );
  assertEquals(
    resolveGotifyConfig((name) =>
      name === "GOTIFY_URL"
        ? "http://gotify.lan"
        : name === "ALLOW_INSECURE_GOTIFY"
        ? "true"
        : undefined
    )?.messageUrl,
    "http://gotify.lan/message",
  );
});

Deno.test("Gotify configuration rejects unsafe URLs", async () => {
  const invalid: Record<string, string> = {
    malformed: "not a url",
    scheme: "ftp://gotify.example.com",
    credentials: "https://token@gotify.example.com",
    query: "https://gotify.example.com?x=1",
    fragment: "https://gotify.example.com#x",
    insecure: "http://gotify.example.com",
  };

  for (const url of Object.values(invalid)) {
    await assertRejects(
      async () => {
        await Promise.resolve(
          resolveGotifyConfig((name) =>
            name === "GOTIFY_URL" ? url : undefined
          ),
        );
      },
      Error,
    );
  }
});

Deno.test("notification logs and results omit tokens and response bodies", async () => {
  const logs: Record<string, unknown>[] = [];
  const { port } = makePort({
    env: { GOTIFY_URL: "https://gotify.example.com" },
    fetchImpl: () =>
      Promise.resolve(
        new Response("distinctive-response-body", { status: 500 }),
      ),
    logs,
  });

  const result = await port.send({
    recipientId: "recipient",
    title: "Failure",
  });
  const serialized = JSON.stringify({ result, logs });

  assert(!serialized.includes("secret-token"));
  assert(!serialized.includes("distinctive-response-body"));
  assertEquals(logs, [{
    event: "push_notification_gotify_failure",
    recipientId: "recipient",
    origin: "https://gotify.example.com",
    httpStatus: 500,
    result: "retryable_failure",
  }]);
});

import "../../../../env.d.ts";
import { assert, assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import type { UserPayload } from "../../../../types.ts";
import db from "../../../../utils/db.ts";
import { DELETE, GET, PUT } from "./gotify-token.ts";
import { GET as getMembers } from "../../members/index.ts";

const USER: UserPayload = {
  id: "gotify-route-user",
  email: "gotify-route@example.com",
  name: "Gotify Route User",
};

const MISSING_USER: UserPayload = {
  id: "gotify-route-missing",
  email: "missing@example.com",
  name: "Missing User",
};

function context(fields: Partial<APIContext>): APIContext {
  return fields as unknown as APIContext;
}

function request(method: string, body?: unknown): Request {
  return new Request("http://example.com/api/users/me/gotify-token", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawRequest(method: string, body: string): Request {
  return new Request("http://example.com/api/users/me/gotify-token", {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function cleanup() {
  db.prepare("DELETE FROM chores").run();
  db.prepare("DELETE FROM users").run();
}

function seed(token: string | null = null) {
  db.prepare(`
    INSERT INTO users (id, email, name, gotify_token)
    VALUES (?, ?, ?, ?)
  `).run(USER.id, USER.email, USER.name, token);
}

async function responseText(response: Response): Promise<string> {
  return await response.text();
}

Deno.test({
  name: "gotify-token endpoint rejects unauthenticated requests",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    for (
      const [handler, requestValue] of [
        [GET, undefined],
        [PUT, request("PUT", { gotifyToken: "token" })],
        [DELETE, undefined],
      ] as const
    ) {
      const response = await handler(
        context({ locals: { user: null }, request: requestValue }),
      ) as Response;
      assertEquals(response.status, 401);
    }
  },
});

Deno.test({
  name: "gotify-token endpoint returns 404 when the session user has no row",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      const response = await GET(
        context({ locals: { user: MISSING_USER } }),
      ) as Response;
      assertEquals(response.status, 404);
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "gotify-token endpoint sets replaces clears and returns only state",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      seed();

      let response = await GET(
        context({ locals: { user: USER } }),
      ) as Response;
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { gotifyConfigured: false });

      response = await PUT(
        context({
          locals: { user: USER },
          request: request("PUT", {
            gotifyToken: "  distinctive-route-token  ",
          }),
        }),
      ) as Response;
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { gotifyConfigured: true });
      assertEquals(
        db.prepare("SELECT gotify_token FROM users WHERE id = ?").get(USER.id),
        { gotify_token: "distinctive-route-token" },
      );

      response = await PUT(
        context({
          locals: { user: USER },
          request: request("PUT", { gotifyToken: "replacement-route-token" }),
        }),
      ) as Response;
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { gotifyConfigured: true });
      assertEquals(
        db.prepare("SELECT gotify_token FROM users WHERE id = ?").get(USER.id),
        { gotify_token: "replacement-route-token" },
      );

      response = await DELETE(
        context({ locals: { user: USER } }),
      ) as Response;
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { gotifyConfigured: false });
      assertEquals(
        db.prepare("SELECT gotify_token FROM users WHERE id = ?").get(USER.id),
        { gotify_token: null },
      );
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "gotify-token endpoint rejects invalid input without echoing it",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      seed();
      const invalidCases: Request[] = [
        rawRequest("PUT", "{"),
        request("PUT", { gotifyToken: 7 }),
        request("PUT", { gotifyToken: "   " }),
        request("PUT", { gotifyToken: "x".repeat(1025) }),
      ];

      for (const invalid of invalidCases) {
        const response = await PUT(
          context({ locals: { user: USER }, request: invalid }),
        ) as Response;
        const text = await responseText(response);
        assertEquals(response.status, 400);
        assert(!text.includes("xxxx"));
        assert(!text.includes("   "));
      }
    } finally {
      cleanup();
    }
  },
});

Deno.test({
  name: "gotify-token route and member reads do not disclose stored tokens",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      const secret = "distinctive-token-not-in-responses";
      seed(secret);

      const stateResponse = await GET(
        context({ locals: { user: USER } }),
      ) as Response;
      const mutationResponse = await PUT(
        context({
          locals: { user: USER },
          request: request("PUT", { gotifyToken: secret }),
        }),
      ) as Response;
      const membersResponse = await getMembers(
        context({ locals: { user: USER } }),
      ) as Response;

      const combined = [
        await responseText(stateResponse),
        await responseText(mutationResponse),
        await responseText(membersResponse),
      ].join("\n");
      assert(!combined.includes(secret));
      assert(!combined.includes("gotify_token"));
      assertEquals(
        JSON.parse(
          await responseText(
            await GET(
              context({ locals: { user: USER } }),
            ) as Response,
          ),
        ),
        { gotifyConfigured: true },
      );
    } finally {
      cleanup();
    }
  },
});

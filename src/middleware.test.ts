import "./env.d.ts";
import { assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import { onRequest } from "./middleware.ts";

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(name);
    } else {
      Deno.env.set(name, value);
    }
  }
}

function contextFor(
  method: string,
  origin?: string,
): APIContext {
  const url = new URL("http://127.0.0.1:8080/protected");
  const headers = new Headers();
  if (origin !== undefined) {
    headers.set("Origin", origin);
  }

  return {
    request: new Request(url, { method, headers }),
    url,
    locals: { user: null },
    redirect: (path: string, status = 302) =>
      new Response(null, { status, headers: { location: path } }),
  } as unknown as APIContext;
}

Deno.test("middleware permits safe methods without origin evidence", async () => {
  const snapshot = { ENABLE_AUTH: Deno.env.get("ENABLE_AUTH") };
  Deno.env.set("ENABLE_AUTH", "false");

  try {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const context = contextFor(method);
      let downstreamCalls = 0;
      const response = await onRequest(context, () => {
        downstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      });

      assertEquals(response?.status, 204);
      assertEquals(downstreamCalls, 1);
      assertEquals(context.locals.user?.email, "demo@example.com");
    }
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("middleware rejects unsafe methods without exact same-origin evidence before authentication", async () => {
  const snapshot = { ENABLE_AUTH: Deno.env.get("ENABLE_AUTH") };
  Deno.env.set("ENABLE_AUTH", "false");
  const rejectedOrigins = [
    undefined,
    "http://evil.example",
    "https://127.0.0.1:8080",
    "http://127.0.0.1:9999",
    "http://localhost:8080",
  ];

  try {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const origin of rejectedOrigins) {
        const context = contextFor(method, origin);
        let downstreamCalls = 0;
        const response = await onRequest(context, () => {
          downstreamCalls += 1;
          return Promise.resolve(new Response(null, { status: 204 }));
        });

        assertEquals(response?.status, 403);
        assertEquals(downstreamCalls, 0);
        assertEquals(context.locals.user, null);
      }
    }
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("middleware permits unsafe methods with exact same-origin evidence", async () => {
  const snapshot = { ENABLE_AUTH: Deno.env.get("ENABLE_AUTH") };
  Deno.env.set("ENABLE_AUTH", "false");

  try {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const context = contextFor(method, "http://127.0.0.1:8080");
      let downstreamCalls = 0;
      const response = await onRequest(context, () => {
        downstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      });

      assertEquals(response?.status, 204);
      assertEquals(downstreamCalls, 1);
      assertEquals(context.locals.user?.email, "demo@example.com");
    }
  } finally {
    restoreEnv(snapshot);
  }
});

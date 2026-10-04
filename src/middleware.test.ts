import "./env.d.ts";
import { assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import { onRequest } from "./middleware.ts";
import { resolvePublicOrigin } from "./utils/publicOrigin.ts";
import { assertThrows } from "@std/assert";

Deno.test("public origin configuration rejects paths and non-HTTP URLs", () => {
  assertEquals(resolvePublicOrigin(undefined), undefined);
  assertEquals(
    resolvePublicOrigin("https://todo.example/"),
    "https://todo.example",
  );
  for (
    const value of [
      "null",
      "ftp://todo.example",
      "https://u:p@todo.example",
      "https://todo.example/path",
      "https://todo.example/?x=1",
    ]
  ) {
    assertThrows(() => resolvePublicOrigin(value));
  }
});

Deno.test("configured public origin permits TLS ingress and rejects spoofed proxy headers", async () => {
  const snapshot = {
    ENABLE_AUTH: Deno.env.get("ENABLE_AUTH"),
    PUBLIC_ORIGIN: Deno.env.get("PUBLIC_ORIGIN"),
  };
  Deno.env.set("ENABLE_AUTH", "false");
  Deno.env.set("PUBLIC_ORIGIN", "https://todo.example");
  try {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (
        const origin of [
          "https://todo.example",
          undefined,
          "null",
          "https://evil.example",
          "http://127.0.0.1:8080",
        ]
      ) {
        const context = contextFor(method, origin);
        context.request.headers.set("X-Forwarded-Host", "evil.example");
        context.request.headers.set("X-Forwarded-Proto", "https");
        const response = await onRequest(
          context,
          () => Promise.resolve(new Response(null, { status: 204 })),
        );
        assertEquals(
          response?.status,
          origin === "https://todo.example" ? 204 : 403,
        );
      }
    }
  } finally {
    restoreEnv(snapshot);
  }
});

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

import type { APIContext, MiddlewareNext } from "astro";
import type { UserPayload } from "./types.ts";
import { getSession } from "./utils/auth.ts";
import { resolvePublicOrigin } from "./utils/publicOrigin.ts";

const MOCK_USER: UserPayload = {
  id: "r0wk2VvPQFhW7bpLpq3MxMhjodD2",
  email: "demo@example.com",
  name: "Test User",
  picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=TestUser",
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hasSameOriginEvidence(context: APIContext): boolean {
  if (SAFE_METHODS.has(context.request.method.toUpperCase())) {
    return true;
  }

  const expected = resolvePublicOrigin(Deno.env.get("PUBLIC_ORIGIN")) ??
    context.url.origin;
  return context.request.headers.get("origin") === expected;
}

export async function onRequest(
  context: APIContext,
  next: MiddlewareNext,
): Promise<Response | void> {
  const api = context.url.pathname.startsWith("/api/");
  const authorization = context.request.headers.get("authorization");
  const mobileLogin = context.url.pathname === "/api/auth/mobile" &&
    context.request.method === "POST" &&
    !context.request.headers.has("origin") &&
    !context.request.headers.has("cookie") &&
    context.request.headers.get("content-type")?.split(";")[0].trim() ===
      "application/json";
  // Only a verified, explicitly supplied mobile token can bypass browser CSRF.
  // An invalid token must never fall back to ambient cookies or development auth.
  if (api && authorization !== null) {
    const token = /^Bearer ([^\s]+)$/u.exec(authorization)?.[1];
    const user = token ? await getSession(token, true) : null;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    context.locals.user = user;
    return next();
  }
  if (!mobileLogin && !hasSameOriginEvidence(context)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (
    context.url.pathname === "/healthz" &&
    SAFE_METHODS.has(context.request.method)
  ) {
    return next();
  }

  const envEnableAuth = Deno.env.get("ENABLE_AUTH");
  const isAuthEnabled = String(envEnableAuth).toLowerCase() !== "false";

  if (!isAuthEnabled) {
    context.locals.user = MOCK_USER;
  } else {
    const sessionCookie = context.cookies.get("session")?.value;
    context.locals.user = sessionCookie
      ? await getSession(sessionCookie)
      : null;

    if (sessionCookie && !context.locals.user) {
      context.cookies.delete("session", {
        path: "/",
      });
    }
  }

  const publicRoutes = [
    "/login",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/mobile",
  ];
  const isPublicRoute = publicRoutes.includes(context.url.pathname);

  if (!context.locals.user && !isPublicRoute) {
    if (api) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/login");
  }

  if (context.locals.user && context.url.pathname === "/login") {
    return context.redirect("/");
  }

  return next();
}

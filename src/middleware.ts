import type { APIContext, MiddlewareNext } from "astro";
import type { UserPayload } from "./types.ts";
import { getSession } from "./utils/auth.ts";

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

  return context.request.headers.get("origin") === context.url.origin;
}

export async function onRequest(
  context: APIContext,
  next: MiddlewareNext,
): Promise<Response | void> {
  if (!hasSameOriginEvidence(context)) {
    return new Response("Forbidden", { status: 403 });
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

  const publicRoutes = ["/login", "/api/auth/login", "/api/auth/logout"];
  const isPublicRoute = publicRoutes.includes(context.url.pathname);

  if (!context.locals.user && !isPublicRoute) {
    return context.redirect("/login");
  }

  if (context.locals.user && context.url.pathname === "/login") {
    return context.redirect("/");
  }

  return next();
}

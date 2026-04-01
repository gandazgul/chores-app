import { defineMiddleware } from "astro:middleware";
import { getSession } from "./utils/auth.js";

/** @typedef {import('./utils/auth.js').UserPayload} UserPayload */

/** @type {UserPayload} */
const MOCK_USER = {
  id: "r0wk2VvPQFhW7bpLpq3MxMhjodD2",
  email: "demo@example.com",
  name: "Test User",
  picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=TestUser",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const envEnableAuth = Deno.env.get("ENABLE_AUTH");
  // Only disable auth if explicitly set to the string 'false' or boolean false. Missing or 'true' defaults to enabled.
  const isAuthEnabled = String(envEnableAuth).toLowerCase() !== "false";

  if (!isAuthEnabled) {
    context.locals.user = MOCK_USER;
  } else {
    const sessionCookie = context.cookies.get("session")?.value;

    if (sessionCookie) {
      context.locals.user = await getSession(sessionCookie);
    } else {
      context.locals.user = null;
    }
  }

  // Define public routes that don't require authentication
  const publicRoutes = ["/login", "/api/auth/login", "/api/auth/logout"];
  const isPublicRoute = publicRoutes.includes(context.url.pathname);

  // Redirect to login if unauthenticated and not on a public route
  if (!context.locals.user && !isPublicRoute) {
    return context.redirect("/login");
  }

  // Redirect to home if authenticated and trying to access login
  if (context.locals.user && context.url.pathname === "/login") {
    return context.redirect("/");
  }

  return next();
});

import type { APIRoute } from "astro";
import { resolveHouseholdTimeZone } from "../../../../utils/householdTime.ts";
import { resolveNotificationProvider } from "../../../../notifications/provider.ts";

export const GET: APIRoute = ({ locals }) =>
  new Response(
    JSON.stringify(
      locals.user
        ? {
          user: locals.user,
          timeZone: resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ")),
          notificationProvider: resolveNotificationProvider((name) =>
            Deno.env.get(name)
          ),
        }
        : { error: "Unauthorized" },
    ),
    {
      status: locals.user ? 200 : 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );

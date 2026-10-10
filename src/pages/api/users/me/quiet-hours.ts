import type { APIRoute } from "astro";
import db from "../../../../utils/db.ts";
import { resolveQuietHours } from "../../../../scheduler/nagPolicy.ts";
import { resolveHouseholdTimeZone } from "../../../../utils/householdTime.ts";
import {
  parseQuietHoursSettings,
  readQuietHoursSettings,
  saveQuietHoursSettings,
} from "../../../../notifications/quietHours.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const settings = readQuietHoursSettings(
    db,
    locals.user.id,
    resolveQuietHours((name) => Deno.env.get(name)),
  );
  if (!settings) return json({ error: "Not Found" }, 404);
  return json({
    ...settings,
    timeZone: resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ")),
  });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(locals.user.id)) {
    return json({ error: "Not Found" }, 404);
  }
  const settings = parseQuietHoursSettings(
    await request.json().catch(() => null),
  );
  if (!settings) {
    return json({
      error:
        "Use valid start and end times (HH:MM). When quiet hours are on, choose different times.",
    }, 400);
  }
  saveQuietHoursSettings(db, locals.user.id, settings);
  return json(settings);
};

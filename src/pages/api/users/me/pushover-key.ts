import type { APIRoute } from "astro";
import db from "../../../../utils/db.ts";
import {
  createPushoverClient,
  parsePushoverKey,
  resolvePushoverToken,
} from "../../../../notifications/pushover.ts";
import { resolveNotificationProvider } from "../../../../notifications/provider.ts";

const getEnv = (name: string) => Deno.env.get(name);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const GET: APIRoute = ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const row = db.prepare(
    "SELECT pushover_user_key IS NOT NULL AS configured FROM users WHERE id = ?",
  ).get(locals.user.id);
  if (!row) return json({ error: "Not Found" }, 404);
  return json({ pushoverConfigured: Boolean(row.configured) });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(locals.user.id)) {
    return json({ error: "Not Found" }, 404);
  }
  const body = await request.json().catch(() => null);
  const key = parsePushoverKey(body?.userKey);
  if (!key) {
    return json({ error: "Enter your 30-character Pushover user key." }, 400);
  }
  if (
    resolveNotificationProvider(getEnv) !== "pushover" ||
    !resolvePushoverToken(getEnv)
  ) {
    return json(
      { error: "Pushover setup on the server is not complete yet." },
      503,
    );
  }
  const result = await createPushoverClient({ getEnv, fetchImpl: fetch })
    .validate(key);
  if (result.status !== "sent") {
    return result.status === "undeliverable"
      ? json({
        error:
          "Pushover could not validate this key. Check your user key and that a device is enabled.",
      }, 400)
      : json({
        error:
          "Pushover could not be reached. Your saved key has not changed; try again shortly.",
      }, 503);
  }
  const saved = db.prepare(
    "UPDATE users SET pushover_user_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(key, locals.user.id);
  if (saved.changes !== 1) return json({ error: "Not Found" }, 404);
  return json({ pushoverConfigured: true });
};

export const DELETE: APIRoute = ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const cleared = db.prepare(
    "UPDATE users SET pushover_user_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(locals.user.id);
  if (cleared.changes !== 1) return json({ error: "Not Found" }, 404);
  return json({ pushoverConfigured: false });
};

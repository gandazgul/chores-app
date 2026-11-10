import type { APIRoute } from "astro";
import db from "../../../../utils/db.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9-]{16,128}$/u.test(id);

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  if (
    !validId(body?.installationId) || typeof body?.token !== "string" ||
    body.token.length < 20 || body.token.length > 4096 || /\s/u.test(body.token)
  ) {
    return json({ error: "Invalid device registration" }, 400);
  }
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(locals.user.id)) {
    return json({ error: "Not Found" }, 404);
  }
  // A device can change accounts. A single token must never notify the old account.
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "DELETE FROM mobile_devices WHERE token = ? AND installation_id != ?",
    ).run(body.token, body.installationId);
    db.prepare(
      `INSERT INTO mobile_devices (installation_id, user_id, token) VALUES (?, ?, ?)
      ON CONFLICT(installation_id) DO UPDATE SET user_id = excluded.user_id,
      token = excluded.token, updated_at = CURRENT_TIMESTAMP`,
    ).run(body.installationId, locals.user.id, body.token);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return json({ registered: true });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  if (!validId(body?.installationId)) {
    return json({ error: "Invalid device" }, 400);
  }
  db.prepare(
    "DELETE FROM mobile_devices WHERE installation_id = ? AND user_id = ?",
  )
    .run(body.installationId, locals.user.id);
  return json({ registered: false });
};

import type { APIRoute } from "astro";
import type { UserPayload } from "../../../../types.ts";
import db from "../../../../utils/db.ts";

interface UserTokenStateRow {
  gotifyConfigured: 0 | 1;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function stateFor(
  userId: string,
): { exists: boolean; gotifyConfigured: boolean } {
  const row = db.prepare(
    "SELECT gotify_token IS NOT NULL AS gotifyConfigured FROM users WHERE id = ?",
  ).get(userId) as unknown as UserTokenStateRow | undefined;
  return row
    ? { exists: true, gotifyConfigured: Boolean(row.gotifyConfigured) }
    : { exists: false, gotifyConfigured: false };
}

function requireUser(user: UserPayload | null): Response | null {
  return user ? null : jsonResponse({ error: "Unauthorized" }, 401);
}

function notFoundIfMissing(userId: string): Response | null {
  return stateFor(userId).exists
    ? null
    : jsonResponse({ error: "Not Found" }, 404);
}

async function readReplacementToken(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null) return null;
  const token = (body as Record<string, unknown>).gotifyToken;
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (trimmed.length === 0 || trimmed.length > 1024) return null;
  return trimmed;
}

export const GET: APIRoute = ({ locals }) => {
  const unauthorized = requireUser(locals.user);
  if (unauthorized) return unauthorized;

  const state = stateFor(locals.user!.id);
  if (!state.exists) return jsonResponse({ error: "Not Found" }, 404);
  return jsonResponse({ gotifyConfigured: state.gotifyConfigured });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireUser(locals.user);
  if (unauthorized) return unauthorized;

  const missing = notFoundIfMissing(locals.user!.id);
  if (missing) return missing;

  const token = await readReplacementToken(request);
  if (token === null) return jsonResponse({ error: "Invalid token" }, 400);

  db.prepare(
    "UPDATE users SET gotify_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  )
    .run(token, locals.user!.id);
  return jsonResponse({ gotifyConfigured: true });
};

export const DELETE: APIRoute = ({ locals }) => {
  const unauthorized = requireUser(locals.user);
  if (unauthorized) return unauthorized;

  const missing = notFoundIfMissing(locals.user!.id);
  if (missing) return missing;

  db.prepare(
    "UPDATE users SET gotify_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  )
    .run(locals.user!.id);
  return jsonResponse({ gotifyConfigured: false });
};
